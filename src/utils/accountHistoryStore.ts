import { Account } from '../types/accounting';
import { loadChartOfAccounts, saveChartOfAccounts, JOURNAL_ENTRIES_STORAGE_KEY } from './trialBalanceStore';
import { DELETED_ACCOUNTS_KEY } from './accountGovernance';
import { recordAuditLog } from './auditLogStore';

export const UNDO_STACK_STORAGE_KEY = 'alpha_accounts_undo_stack_v1';
export const REDO_STACK_STORAGE_KEY = 'alpha_accounts_redo_stack_v1';

export type AccountActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'TOGGLE_STATUS';

export interface AccountHistoryAction {
  id: string;
  timestamp: string;
  type: AccountActionType;
  title: string;
  description: string;
  accountId: string;
  accountCode: string;
  // Snapshot of the account before the action (null if CREATE)
  previousState: Account | null;
  // Snapshot of the account after the action (null if DELETE)
  nextState: Account | null;
  // If journal entries were updated by cascade
  journalEntriesSnapshot?: any[] | null;
}

const MAX_HISTORY_ITEMS = 25;

export function getUndoStack(): AccountHistoryAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(UNDO_STACK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getRedoStack(): AccountHistoryAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REDO_STACK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUndoStack(stack: AccountHistoryAction[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(UNDO_STACK_STORAGE_KEY, JSON.stringify(stack.slice(-MAX_HISTORY_ITEMS)));
    window.dispatchEvent(new Event('alpha-history-stack-updated'));
  } catch (e) {
    console.error('Failed to save undo stack:', e);
  }
}

function saveRedoStack(stack: AccountHistoryAction[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REDO_STACK_STORAGE_KEY, JSON.stringify(stack.slice(-MAX_HISTORY_ITEMS)));
    window.dispatchEvent(new Event('alpha-history-stack-updated'));
  } catch (e) {
    console.error('Failed to save redo stack:', e);
  }
}

/**
 * Record a new action into the undo stack and clear redo stack
 */
export function recordAccountAction(action: Omit<AccountHistoryAction, 'id' | 'timestamp'>): void {
  try {
    const entry: AccountHistoryAction = {
      ...action,
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString()
    };
    const undoStack = getUndoStack();
    undoStack.push(entry);
    saveUndoStack(undoStack);
    // Clearing redo stack on new user action
    saveRedoStack([]);
  } catch (e) {
    console.error('Failed recording account action:', e);
  }
}

/**
 * Get the last action that can be undone
 */
export function getLastUndoAction(): AccountHistoryAction | null {
  const stack = getUndoStack();
  return stack.length > 0 ? (stack[stack.length - 1] ?? null) : null;
}

/**
 * Get the last action that can be redone
 */
export function getLastRedoAction(): AccountHistoryAction | null {
  const stack = getRedoStack();
  return stack.length > 0 ? (stack[stack.length - 1] ?? null) : null;
}

/**
 * Undo the last action (حذف / تعديل / إضافة / تنشيط)
 */
export function undoLastAccountAction(): { success: boolean; message: string; action?: AccountHistoryAction } {
  const undoStack = getUndoStack();
  if (undoStack.length === 0) {
    return { success: false, message: 'لا توجد إجراءات سابقة للتراجع عنها.' };
  }

  const action = undoStack.pop()!;
  const localAccounts = loadChartOfAccounts();

  try {
    switch (action.type) {
      case 'CREATE': {
        // Undo of create = delete the created account
        const updated = localAccounts.filter(a => a.id !== action.accountId && a.code !== action.accountCode);
        saveChartOfAccounts(updated);

        // Add to deleted ids list
        const deletedRaw = localStorage.getItem(DELETED_ACCOUNTS_KEY);
        const deletedList: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
        if (!deletedList.includes(action.accountId)) deletedList.push(action.accountId);
        if (!deletedList.includes(action.accountCode)) deletedList.push(action.accountCode);
        localStorage.setItem(DELETED_ACCOUNTS_KEY, JSON.stringify(deletedList));
        break;
      }

      case 'DELETE': {
        // Undo of delete = restore the account from previousState
        if (!action.previousState) {
          throw new Error('بيانات الحساب السابقة غير متوفرة لاستعادتها.');
        }
        // Remove from deleted list
        const deletedRaw = localStorage.getItem(DELETED_ACCOUNTS_KEY);
        if (deletedRaw) {
          const deletedList: string[] = JSON.parse(deletedRaw);
          const filtered = deletedList.filter(id => id !== action.accountId && id !== action.accountCode);
          localStorage.setItem(DELETED_ACCOUNTS_KEY, JSON.stringify(filtered));
        }
        // Re-insert account
        const exists = localAccounts.some(a => a.id === action.accountId || a.code === action.accountCode);
        if (!exists) {
          localAccounts.push(action.previousState);
          saveChartOfAccounts(localAccounts);
        }
        break;
      }

      case 'UPDATE':
      case 'TOGGLE_STATUS': {
        // Undo of update = restore previousState
        if (!action.previousState) {
          throw new Error('بيانات الحساب السابقة غير متوفرة للتراجع.');
        }
        const idx = localAccounts.findIndex(a => a.id === action.accountId || a.code === action.accountCode);
        if (idx !== -1) {
          localAccounts[idx] = { ...action.previousState };
        } else {
          localAccounts.push(action.previousState);
        }
        saveChartOfAccounts(localAccounts);

        // If journal entries were modified, restore previous snapshot
        if (action.journalEntriesSnapshot) {
          localStorage.setItem(JOURNAL_ENTRIES_STORAGE_KEY, JSON.stringify(action.journalEntriesSnapshot));
        }
        break;
      }
    }

    // Push to redo stack
    const redoStack = getRedoStack();
    redoStack.push(action);
    saveRedoStack(redoStack);
    saveUndoStack(undoStack);

    // Notify the app
    window.dispatchEvent(new Event('alpha-chart-of-accounts-updated'));
    window.dispatchEvent(new Event('alpha-data-changed'));
    window.dispatchEvent(new Event('alpha-journal-entries-updated'));
    window.dispatchEvent(new Event('alpha-trial-balance-updated'));

    // Audit log
    try {
      recordAuditLog({
        action: 'UPDATE',
        module: 'SYSTEM',
        documentType: 'تراجع عن إجراء',
        documentNumber: action.accountCode,
        documentId: action.accountId,
        summary: `تم التراجع عن إجراء (${action.title}): ${action.description}`,
        severity: 'INFO'
      });
    } catch {}

    return {
      success: true,
      message: `تم التراجع بنجاح عن: ${action.title} (${action.accountCode})`,
      action
    };
  } catch (err: any) {
    // Put action back
    undoStack.push(action);
    saveUndoStack(undoStack);
    return {
      success: false,
      message: `فشل التراجع عن الإجراء: ${err.message || 'خطأ غير متوقع'}`
    };
  }
}

/**
 * Redo the previously undone action (إعادة تطبيق الإجراء)
 */
export function redoLastAccountAction(): { success: boolean; message: string; action?: AccountHistoryAction } {
  const redoStack = getRedoStack();
  if (redoStack.length === 0) {
    return { success: false, message: 'لا توجد إجراءات متراجع عنها لإعادتها.' };
  }

  const action = redoStack.pop()!;
  const localAccounts = loadChartOfAccounts();

  try {
    switch (action.type) {
      case 'CREATE': {
        // Redo create = re-add nextState
        if (!action.nextState) throw new Error('بيانات الحساب غير متوفرة لإعادة إنشائه.');
        // Remove from deleted list
        const deletedRaw = localStorage.getItem(DELETED_ACCOUNTS_KEY);
        if (deletedRaw) {
          const deletedList: string[] = JSON.parse(deletedRaw);
          const filtered = deletedList.filter(id => id !== action.accountId && id !== action.accountCode);
          localStorage.setItem(DELETED_ACCOUNTS_KEY, JSON.stringify(filtered));
        }
        const exists = localAccounts.some(a => a.id === action.accountId || a.code === action.accountCode);
        if (!exists) {
          localAccounts.push(action.nextState);
          saveChartOfAccounts(localAccounts);
        }
        break;
      }

      case 'DELETE': {
        // Redo delete = remove account again
        const updated = localAccounts.filter(a => a.id !== action.accountId && a.code !== action.accountCode);
        saveChartOfAccounts(updated);

        const deletedRaw = localStorage.getItem(DELETED_ACCOUNTS_KEY);
        const deletedList: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
        if (!deletedList.includes(action.accountId)) deletedList.push(action.accountId);
        if (!deletedList.includes(action.accountCode)) deletedList.push(action.accountCode);
        localStorage.setItem(DELETED_ACCOUNTS_KEY, JSON.stringify(deletedList));
        break;
      }

      case 'UPDATE':
      case 'TOGGLE_STATUS': {
        // Redo update = restore nextState
        if (!action.nextState) throw new Error('بيانات الحساب المعدلة غير متوفرة لإعادتها.');
        const idx = localAccounts.findIndex(a => a.id === action.accountId || a.code === action.accountCode);
        if (idx !== -1) {
          localAccounts[idx] = { ...action.nextState };
        } else {
          localAccounts.push(action.nextState);
        }
        saveChartOfAccounts(localAccounts);
        break;
      }
    }

    // Push back to undo stack
    const undoStack = getUndoStack();
    undoStack.push(action);
    saveUndoStack(undoStack);
    saveRedoStack(redoStack);

    // Notify app
    window.dispatchEvent(new Event('alpha-chart-of-accounts-updated'));
    window.dispatchEvent(new Event('alpha-data-changed'));
    window.dispatchEvent(new Event('alpha-journal-entries-updated'));
    window.dispatchEvent(new Event('alpha-trial-balance-updated'));

    return {
      success: true,
      message: `تمت إعادة تطبيق: ${action.title} (${action.accountCode})`,
      action
    };
  } catch (err: any) {
    redoStack.push(action);
    saveRedoStack(redoStack);
    return {
      success: false,
      message: `فشلت إعادة الإجراء: ${err.message || 'خطأ غير متوقع'}`
    };
  }
}
