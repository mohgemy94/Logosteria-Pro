import { getSystemSettings, saveSystemSettings } from './settings';
import { recordAuditLog } from './auditLogStore';

export interface PeriodLockState {
  isLocked: boolean;
  lockDate: string | null;
  lockedYears: number[];
  lockedBy?: string;
}

export const PERIOD_LOCK_UPDATED_EVENT = 'alpha-period-lock-updated';

/**
 * Gets the current fiscal period lock configuration
 */
export function getFiscalPeriodLock(): PeriodLockState {
  const settings = getSystemSettings();
  const fin = settings.financial || {};
  return {
    isLocked: !!fin.isPeriodLocked && !!fin.lockDate,
    lockDate: fin.lockDate || null,
    lockedYears: fin.closedFiscalYears || (fin.isFiscalYearClosed && fin.fiscalYear ? [Number(fin.fiscalYear)] : []),
    lockedBy: fin.lockedBy || 'الإدارة المالية'
  };
}

/**
 * Updates or sets the fiscal period lock date
 */
export function setFiscalPeriodLock(lockDate: string, isLocked: boolean = true, lockedBy: string = 'الإدارة المالية'): void {
  const settings = getSystemSettings();
  const fin = settings.financial || {};

  const updatedFinancial = {
    ...fin,
    lockDate,
    isPeriodLocked: isLocked,
    lockedBy
  };

  saveSystemSettings({
    ...settings,
    financial: updatedFinancial as any
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PERIOD_LOCK_UPDATED_EVENT, {
      detail: { isLocked, lockDate, lockedBy }
    }));
  }

  try {
    recordAuditLog({
      action: isLocked ? 'LOCK' : 'UNLOCK',
      module: 'PERIOD_LOCK',
      documentType: 'قفل الفترات المحاسبية',
      summary: isLocked ? `قفل العمليات المالية حتى تاريخ (${lockDate}) بواسطة ${lockedBy}` : 'إلغاء قفل الفترات المحاسبية والسماح بتسجيل القيود',
      summaryEn: isLocked ? `Fiscal period locked up to ${lockDate} by ${lockedBy}` : 'Fiscal period unlocked',
      severity: isLocked ? 'WARN' : 'INFO',
      details: { isLocked, lockDate, lockedBy }
    });
  } catch {}
}

/**
 * Unlocks the fiscal period lock
 */
export function unlockFiscalPeriod(): void {
  const settings = getSystemSettings();
  const fin = settings.financial || {};

  saveSystemSettings({
    ...settings,
    financial: {
      ...fin,
      isPeriodLocked: false
    } as any
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PERIOD_LOCK_UPDATED_EVENT, {
      detail: { isLocked: false, lockDate: fin.lockDate }
    }));
  }

  try {
    recordAuditLog({
      action: 'UNLOCK',
      module: 'PERIOD_LOCK',
      documentType: 'قفل الفترات المحاسبية',
      summary: 'إلغاء قفل الفترات المحاسبية وفتح ترحيل القيود والسندات',
      summaryEn: 'Fiscal period unlocked for operations',
      severity: 'WARN',
      details: { isLocked: false }
    });
  } catch {}
}

/**
 * Automatically locks the period upon closing or rolling forward a fiscal year
 */
export function autoLockYearEnd(closedYear: number): void {
  const endOfYearDate = `${closedYear}-12-31`;
  const settings = getSystemSettings();
  const fin = settings.financial || {};
  const currentClosedYears = new Set<number>(fin.closedFiscalYears || []);
  currentClosedYears.add(closedYear);

  saveSystemSettings({
    ...settings,
    financial: {
      ...fin,
      isPeriodLocked: true,
      lockDate: endOfYearDate,
      lockedBy: 'إقفال السنة المالي التلقائي',
      closedFiscalYears: Array.from(currentClosedYears).sort((a, b) => a - b)
    } as any
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PERIOD_LOCK_UPDATED_EVENT, {
      detail: { isLocked: true, lockDate: endOfYearDate, closedYear }
    }));
  }
}

/**
 * Checks whether a given transaction date falls within a locked period
 * Returns { isLocked: boolean, reason?: string, lockDate?: string }
 */
export function checkDateIsLocked(dateInput: string | Date | undefined | null): {
  isLocked: boolean;
  reason?: string;
  lockDate?: string;
} {
  if (!dateInput) return { isLocked: false };
  const lock = getFiscalPeriodLock();
  if (!lock.isLocked || !lock.lockDate) {
    return { isLocked: false };
  }

  try {
    let targetDateStr = '';
    if (typeof dateInput === 'string') {
      targetDateStr = dateInput.split('T')[0] || dateInput;
    } else if (dateInput instanceof Date) {
      targetDateStr = dateInput.toISOString().split('T')[0] || '';
    }

    if (!targetDateStr) return { isLocked: false };

    // If transaction date is less than or equal to lockDate, it's locked
    if (targetDateStr <= lock.lockDate) {
      return {
        isLocked: true,
        lockDate: lock.lockDate,
        reason: `هذه الفترة المالية مقفلة ومجمدة حتى تاريخ (${lock.lockDate}). لا يُسمح بإضافة أو تعديل أو ترحيل قيود أو فواتير بأثر رجعي لحماية الأرصدة الافتتاحية والميزانيات المقفلة.`
      };
    }
  } catch (err) {
    console.error('Error checking period lock date:', err);
  }

  return { isLocked: false };
}
