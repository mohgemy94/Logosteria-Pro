import { AccountType, BalanceType, Account } from '../types/accounting';
import { 
  JOURNAL_ENTRIES_STORAGE_KEY, 
  loadChartOfAccounts, 
  saveChartOfAccounts,
  calculateTrialBalance
} from './trialBalanceStore';
import { 
  DB_SALES_INVOICES_KEY, 
  DB_PURCHASES_INVOICES_KEY, 
  DB_RECEIPT_VOUCHERS_KEY, 
  DB_PAYMENT_VOUCHERS_KEY,
  DB_INTERNAL_RECEIPT_VOUCHERS_KEY,
  DB_INTERNAL_PAYMENT_VOUCHERS_KEY,
  DB_INTERNAL_VOUCHERS_KEY
} from './sequences';
import { recordAccountAction } from './accountHistoryStore';

export const DELETED_ACCOUNTS_KEY = 'alpha_deleted_accounts_v1';

/**
 * فحص ما إذا كان الحساب من الحسابات "المقدسة" الجذرية المحمية بالنظام (مستوى 1 و 2)
 */
export function isSystemRootAccount(code: string, level?: number): boolean {
  if (!code) return false;
  const cleanCode = code.trim();
  // المستوى 1: 1، 2، 3، 4، 5
  if (['1', '2', '3', '4', '5'].includes(cleanCode)) return true;
  // المستوى 2: 11، 12، 21، 22، 31، 32، 41، 42، 51، 52
  if (['11', '12', '21', '22', '31', '32', '41', '42', '51', '52'].includes(cleanCode)) return true;
  if (level !== undefined && (level === 1 || level === 2)) return true;
  return cleanCode.length <= 2;
}

/**
 * فحص وجود أي حركات مالية أو قيود مسجلة على الحساب
 */
export function checkAccountHasTransactions(accountIdOrCode: string, optionalCode?: string): { 
  hasTransactions: boolean; 
  count: number; 
  details: string[];
} {
  if (typeof window === 'undefined') {
    return { hasTransactions: false, count: 0, details: [] };
  }

  const details: string[] = [];
  let count = 0;
  const targets = Array.from(new Set([accountIdOrCode, optionalCode].filter(Boolean).map(s => String(s).trim())));

  // 1. فحص ميزان المراجعة الفعلي (أرصدة وحركات مباشرة)
  try {
    const tb = calculateTrialBalance();
    const matchedRow = tb.rows.find(r => targets.includes(r.account.id) || targets.includes(r.account.code));
    if (matchedRow) {
      const d = Number(matchedRow.totalDebit || matchedRow.debitMovement || 0);
      const c = Number(matchedRow.totalCredit || matchedRow.creditMovement || 0);
      const net = Math.abs(Number(matchedRow.netMovement || (d - c) || 0));
      if (d > 0 || c > 0 || net > 0) {
        count += 1;
        details.push(`رصيد حركات بميزان المراجعة: مدين (${d.toLocaleString()}) • دائن (${c.toLocaleString()})`);
      }
    }
  } catch (e) {
    console.error("Error checking trial balance for account:", e);
  }

  // 2. فحص قيود اليومية (مسودة أو مرحلة)
  try {
    const rawEntries = localStorage.getItem(JOURNAL_ENTRIES_STORAGE_KEY);
    if (rawEntries) {
      const entries = JSON.parse(rawEntries);
      if (Array.isArray(entries)) {
        let entriesCount = 0;
        entries.forEach(entry => {
          if (Array.isArray(entry.items)) {
            const hasItem = entry.items.some((it: any) => targets.includes(it.accountId) || targets.includes(it.accountCode));
            if (hasItem) entriesCount++;
          }
        });
        if (entriesCount > 0) {
          count += entriesCount;
          details.push(`مرتبط بـ (${entriesCount}) قيد يومية مسجل في دفتر اليومية العامة`);
        }
      }
    }
  } catch (e) {
    console.error("Error checking journal entries:", e);
  }

  // 3. فحص فواتير المبيعات
  try {
    const rawSales = localStorage.getItem(DB_SALES_INVOICES_KEY);
    if (rawSales) {
      const sales = JSON.parse(rawSales);
      if (Array.isArray(sales)) {
        const isSalesRev = targets.some(t => ['4101', '4102', '4103', '2102', '1101', '1201'].includes(t));
        if (isSalesRev && sales.length > 0) {
          count += sales.length;
          details.push(`حساب رئيسي في دورة فواتير المبيعات (${sales.length} فاتورة مسجلة)`);
        }
      }
    }
  } catch (e) {
    console.error("Error checking sales invoices:", e);
  }

  // 4. فحص فواتير المشتريات
  try {
    const rawPurch = localStorage.getItem(DB_PURCHASES_INVOICES_KEY);
    if (rawPurch) {
      const purch = JSON.parse(rawPurch);
      if (Array.isArray(purch)) {
        const isPurchAcc = targets.some(t => ['1301', '2101', '4203', '1101'].includes(t));
        if (isPurchAcc && purch.length > 0) {
          count += purch.length;
          details.push(`حساب رئيسي في دورة فواتير المشتريات (${purch.length} فاتورة مسجلة)`);
        }
      }
    }
  } catch (e) {
    console.error("Error checking purchase invoices:", e);
  }

  // 5. فحص سندات القبض والصرف
  const voucherKeys = [
    { key: DB_RECEIPT_VOUCHERS_KEY, label: 'سندات قبض خارجية' },
    { key: DB_PAYMENT_VOUCHERS_KEY, label: 'سندات صرف خارجية' },
    { key: DB_INTERNAL_RECEIPT_VOUCHERS_KEY, label: 'سندات قبض داخلية' },
    { key: DB_INTERNAL_PAYMENT_VOUCHERS_KEY, label: 'سندات صرف داخلية' },
    { key: DB_INTERNAL_VOUCHERS_KEY, label: 'سندات تحويل داخلي' }
  ];

  voucherKeys.forEach(v => {
    try {
      const rawV = localStorage.getItem(v.key);
      if (rawV) {
        const vouchers = JSON.parse(rawV);
        if (Array.isArray(vouchers)) {
          const matched = vouchers.filter((item: any) => 
            targets.includes(item.accountId) || 
            targets.includes(item.fromAccountId) || 
            targets.includes(item.toAccountId)
          );
          if (matched.length > 0) {
            count += matched.length;
            details.push(`مرتبط بـ (${matched.length}) ${v.label}`);
          }
        }
      }
    } catch (e) {
      console.error(`Error checking ${v.key}:`, e);
    }
  });

  return {
    hasTransactions: count > 0,
    count,
    details
  };
}

/**
 * فحص إمكانية حذف الحساب وتطبيق القواعد الذهبية
 */
export function canDeleteAccount(node: { 
  id: string; 
  code: string; 
  level: number; 
  children?: any[] | undefined;
}): {
  allowed: boolean;
  isHardBlocked: boolean;
  isSystemLocked: boolean;
  hasChildren: boolean;
  childrenCount: number;
  hasTransactions: boolean;
  reason: string;
  reasonsList: string[];
} {
  const childrenCount = Array.isArray(node.children) ? node.children.length : 0;

  // 1. حماية الحسابات المقدسة (System / Root Accounts) - المستويات 1 و 2
  if (isSystemRootAccount(node.code, node.level)) {
    return {
      allowed: false,
      isHardBlocked: true,
      isSystemLocked: true,
      hasChildren: childrenCount > 0,
      childrenCount,
      hasTransactions: false,
      reason: 'هذا الحساب حساب جذري أساسي (مقدس) محمي بالنظام (System Locked). لا يمكن حذفه أو تغيير كوده نهائياً.',
      reasonsList: ['حساب المستوى الأول أو الثاني الأساسي لبناء وتوازن النظام المحاسبي']
    };
  }

  // 2. فحص وجود حسابات أبناء متفرعة تحته (حساب فرعي تجميعي)
  if (childrenCount > 0) {
    return {
      allowed: false,
      isHardBlocked: true,
      isSystemLocked: false,
      hasChildren: true,
      childrenCount,
      hasTransactions: false,
      reason: `لا يمكن حذف هذا الحساب لأنه حساب تجميعي يتفرع تحته (${childrenCount}) حسابات فرعية. يجب حذف أو نقل الحسابات التابعة له أولاً.`,
      reasonsList: [`يتفرع تحته عدد (${childrenCount}) حسابات فرعية`]
    };
  }

  // 3. فحص الحركات المالية (Hard Block)
  const txCheck = checkAccountHasTransactions(node.id, node.code);
  if (txCheck.hasTransactions) {
    return {
      allowed: false,
      isHardBlocked: true,
      isSystemLocked: false,
      hasChildren: false,
      childrenCount: 0,
      hasTransactions: true,
      reason: 'منع قاطع (Hard Block): يمنع النظام حذف هذا الحساب نهائياً نظراً لوجود حركات مالية مسجلة عليه. السماح بحذفه سيؤدي إلى كسر القيود المرتبطة به وتدمير ميزان المراجعة. البديل الهندسي الآمن هو "إيقاف الحساب (أرشفة)".',
      reasonsList: txCheck.details
    };
  }

  // 4. الحذف مسموح: حساب جديد خالي تماماً من الحركات والأبناء
  return {
    allowed: true,
    isHardBlocked: false,
    isSystemLocked: false,
    hasChildren: false,
    childrenCount: 0,
    hasTransactions: false,
    reason: 'الحساب جديد ولم تُسجل عليه أي حركة مالية نهائياً (لم يرتبط بقيد، سند، فاتورة، أو رصيد افتتاحي). يُسمح بحذفه بأمان.',
    reasonsList: []
  };
}

/**
 * حذف الحساب بأمان وفق القواعد الذهبية
 */
export function deleteAccountSafely(
  accountId: string, 
  accountCode: string, 
  level: number,
  children?: any[]
): { success: boolean; message: string; hardBlocked?: boolean; details?: string[] } {
  const check = canDeleteAccount({ id: accountId, code: accountCode, level, children });
  if (!check.allowed) {
    return {
      success: false,
      message: check.reason,
      hardBlocked: check.isHardBlocked,
      details: check.reasonsList
    };
  }

  try {
    const localAccounts = loadChartOfAccounts();
    const targetAccount = localAccounts.find(a => a.id === accountId || a.code === accountCode);
    const parentId = targetAccount?.parentId;
    
    // 1. تنفيذ عملية الحذف
    const updated = localAccounts.filter(a => a.id !== accountId && a.code !== accountCode);

    // 2. التحقق من الأب وإعادة تقييمه بعد الحذف
    let parentNotice = '';
    if (parentId) {
      const parentAcc = updated.find(a => 
        a.id === parentId || 
        a.code === parentId ||
        (targetAccount?.code && a.code === targetAccount.code.slice(0, 4)) ||
        (targetAccount?.code && a.code === targetAccount.code.slice(0, -2))
      );
      if (parentAcc) {
        // فحص ما إذا كان للأب أي أبناء آخرين متبقين في الدليل
        const remainingChildren = updated.filter(a => 
          a.parentId === parentAcc.id || 
          a.parentId === parentAcc.code ||
          (a.code.length > parentAcc.code.length && a.code.startsWith(parentAcc.code))
        );

        // إذا أصبح الأب بلا أبناء (أصبح Leaf Node)
        if (remainingChildren.length === 0) {
          const parentLevel = parentAcc.level || (parentAcc.code.length <= 4 ? 4 : 5);
          // فك الارتباط برقم المستوى: أي حساب طرفي غير جذري (مستوى 3 فما فوق) بلا أبناء يتحول تلقائياً إلى حركي يقبل القيود
          if (parentLevel >= 3) {
            parentAcc.isPosting = true; // تحويله تلقائياً إلى حركي يقبل القيود
            parentNotice = `، وتمت إعادة تقييم الحساب الأب (${parentAcc.code} - ${parentAcc.name}) وتحويله تلقائياً إلى حساب حركي يقبل القيود (Leaf Node) بعد أن أصبح بلا أبناء`;
          }
        }
      }
    }

    saveChartOfAccounts(updated);

    // تسجيل الإجراء في سجل التراجع والتاريخ
    if (targetAccount) {
      recordAccountAction({
        type: 'DELETE',
        title: `حذف الحساب (${targetAccount.code})`,
        description: `تم حذف الحساب "${targetAccount.name}" (كود: ${targetAccount.code})`,
        accountId: targetAccount.id,
        accountCode: targetAccount.code,
        previousState: { ...targetAccount },
        nextState: null
      });
    }

    // إضافة لمعرفات المحذوفة لمنع إعادة زرعها
    const deletedRaw = localStorage.getItem(DELETED_ACCOUNTS_KEY);
    const deletedList: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
    if (!deletedList.includes(accountId)) deletedList.push(accountId);
    if (!deletedList.includes(accountCode)) deletedList.push(accountCode);
    localStorage.setItem(DELETED_ACCOUNTS_KEY, JSON.stringify(deletedList));

    window.dispatchEvent(new Event('alpha-chart-of-accounts-updated'));
    window.dispatchEvent(new Event('alpha-data-changed'));

    return {
      success: true,
      message: `تم حذف الحساب (${accountCode}) بنجاح لعدم وجود أي حركات مالية عليه${parentNotice}.`
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'فشلت عملية الحذف: ' + (err.message || 'خطأ غير متوقع')
    };
  }
}

/**
 * دالة حذف الحساب مع فحص وإعادة تقييم الأب إذا أصبح بلا أبناء (Leaf Node)
 * 1. تنفيذ عملية الحذف
 * 2. التحقق من الأب وإعادة تقييمه وتحويله إلى حركي (isPosting = true)
 */
export function deleteAccount(accountId: string): { success: boolean; message: string; hardBlocked?: boolean } {
  const localAccounts = loadChartOfAccounts();
  const targetAccount = localAccounts.find(a => a.id === accountId || a.code === accountId);
  return deleteAccountSafely(
    targetAccount?.id || accountId,
    targetAccount?.code || accountId,
    targetAccount?.level || 5
  );
}

/**
 * البديل الهندسي: إيقاف الحساب / تنشيط الحساب (Deactivate / Archive)
 */
export function toggleAccountActiveStatus(
  accountId: string, 
  accountCode: string,
  level?: number
): { success: boolean; isActive: boolean; message: string } {
  if (isSystemRootAccount(accountCode, level)) {
    return {
      success: false,
      isActive: true,
      message: 'لا يمكن إيقاف أو تعطيل الحسابات الجذرية الأساسية للنظام.'
    };
  }

  try {
    const localAccounts = loadChartOfAccounts();
    const targetIdx = localAccounts.findIndex(a => a.id === accountId || a.code === accountCode);
    if (targetIdx === -1) {
      return { success: false, isActive: true, message: 'الحساب غير موجود في دليل الحسابات.' };
    }

    const currentActive = localAccounts[targetIdx]!.isActive !== false;
    const newActiveState = !currentActive;
    const previousSnapshot: Account = { ...localAccounts[targetIdx]! };

    localAccounts[targetIdx]!.isActive = newActiveState;
    const nextSnapshot: Account = { ...localAccounts[targetIdx]! };
    saveChartOfAccounts(localAccounts);

    recordAccountAction({
      type: 'TOGGLE_STATUS',
      title: newActiveState ? `تنشيط الحساب (${accountCode})` : `تعطيل/أرشفة الحساب (${accountCode})`,
      description: newActiveState ? `تم إعادة تنشيط الحساب "${previousSnapshot.name}"` : `تم إيقاف/أرشفة الحساب "${previousSnapshot.name}"`,
      accountId: previousSnapshot.id,
      accountCode: previousSnapshot.code,
      previousState: previousSnapshot,
      nextState: nextSnapshot
    });

    window.dispatchEvent(new Event('alpha-chart-of-accounts-updated'));
    window.dispatchEvent(new Event('alpha-data-changed'));

    return {
      success: true,
      isActive: newActiveState,
      message: newActiveState 
        ? `تم تنشيط الحساب (${accountCode}) بنجاح وإعادته للقوائم وشاشات الإدخال.`
        : `تم إيقاف الحساب (${accountCode}) بنجاح (مؤرشف). تم إخفاؤه من شاشات الإدخال الجديدة مع الحفاظ التام على سلامة حركاته التاريخية والتقارير.`
    };
  } catch (err: any) {
    return {
      success: false,
      isActive: true,
      message: 'فشل تغيير حالة الحساب: ' + (err.message || 'خطأ غير متوقع')
    };
  }
}

/**
 * تحديث الحساب بأمان مع تطبيق قواعد تعديل الاسم، الكود التتابعي، ومنع تعديل النوع/المستوى
 */
export function updateAccountSafely(
  accountId: string,
  currentCode: string,
  currentLevel: number,
  updates: {
    nameAr: string;
    nameEn?: string;
    newCode?: string;
    newType?: AccountType;
    newLevel?: number;
    newIsPosting?: boolean;
    isActive?: boolean;
    assetClassification?: 'CURRENT' | 'NON_CURRENT';
    parentId?: string;
  }
): { 
  success: boolean; 
  message: string; 
  cascadeUpdatedCount?: number;
  hardBlockedField?: string;
} {
  const localAccounts = loadChartOfAccounts();
  let targetIdx = localAccounts.findIndex(a => a.id === accountId || a.code === currentCode);
  if (targetIdx === -1) {
    if (isSystemRootAccount(currentCode, currentLevel) && currentLevel <= 2) {
      return { success: false, message: 'الحساب المالي غير موجود أو حساب نظامي مغلق.' };
    }
    // إذا كان الحساب من المستوى 3 أو أعلى (حساب مساعد أو وسيط)، ننشئه في التخزين فوراً باسمه وبياناته المعدلة
    const cleanCode = (updates.newCode || currentCode).trim();
    const cleanName = updates.nameAr.trim();
    const derivedType = updates.newType || (
      currentCode.startsWith('1') ? AccountType.Asset :
      currentCode.startsWith('2') ? AccountType.Liability :
      currentCode.startsWith('3') ? AccountType.Equity :
      currentCode.startsWith('4') ? AccountType.Revenue : AccountType.Expense
    );
    const newAcc: Account = {
      id: accountId.startsWith('acc_') ? accountId : `acc_${cleanCode}_${Date.now()}`,
      code: cleanCode,
      name: cleanName,
      type: derivedType,
      balanceType: ['ASSET', 'EXPENSE'].includes(String(derivedType)) ? BalanceType.Debit : BalanceType.Credit,
      level: currentLevel || 3,
      isPosting: updates.newIsPosting ?? false,
      isActive: updates.isActive !== false,
      isControlAccount: false
    };
    if (updates.nameEn?.trim()) {
      (newAcc as any).nameEn = updates.nameEn.trim();
    }
    localAccounts.push(newAcc);
    saveChartOfAccounts(localAccounts);
    recordAccountAction({
      type: 'UPDATE',
      title: `تعديل الحساب (${cleanCode})`,
      description: `تم تخصيص وتعديل الحساب المساعد "${cleanName}"`,
      accountId: newAcc.id,
      accountCode: newAcc.code,
      previousState: null,
      nextState: { ...newAcc }
    });
    window.dispatchEvent(new Event('alpha-chart-of-accounts-updated'));
    window.dispatchEvent(new Event('alpha-data-changed'));
    return {
      success: true,
      message: `تم تحديث وتخصيص الحساب (${cleanCode} - ${cleanName}) بنجاح.`
    };
  }

  const existingAcc = localAccounts[targetIdx]!;
  const previousSnapshot: Account = JSON.parse(JSON.stringify(existingAcc));
  let journalEntriesSnapshot: any[] | null = null;
  try {
    const raw = localStorage.getItem(JOURNAL_ENTRIES_STORAGE_KEY);
    if (raw) journalEntriesSnapshot = JSON.parse(raw);
  } catch {}

  const isRoot = isSystemRootAccount(currentCode, currentLevel);
  const txCheck = checkAccountHasTransactions(accountId, currentCode);

  // 1. فحص حماية تعديل النوع والمستوى للحسابات التي عليها حركات
  if (txCheck.hasTransactions) {
    if (updates.newType && updates.newType !== existingAcc.type) {
      return {
        success: false,
        message: 'ممنوع تماماً (Hard Block): لا يُسمح بتعديل نوع الحساب بعد تسجيل حركات مالية عليه لحماية معادلات الميزانية وميزان المراجعة.',
        hardBlockedField: 'type'
      };
    }
    if (updates.newLevel !== undefined && updates.newLevel !== currentLevel) {
      return {
        success: false,
        message: 'ممنوع تماماً (Hard Block): لا يُسمح بتعديل المستوى المحاسبي بعد تسجيل حركات مالية عليه لحماية تسلسل القيود وميزان المراجعة.',
        hardBlockedField: 'level'
      };
    }
  }

  // 2. فحص حماية الحسابات المقدسة (ممنوع تغيير الكود)
  if (isRoot && updates.newCode && updates.newCode.trim() !== currentCode.trim()) {
    return {
      success: false,
      message: 'ممنوع تغيير أكواد الحسابات الجذرية الأساسية للنظام (System Locked).',
      hardBlockedField: 'code'
    };
  }

  // 3. التحقق من كود الحساب الجديد إذا تم تغييره
  let cascadeUpdatedCount = 0;
  const newCodeClean = updates.newCode ? updates.newCode.trim() : currentCode;

  if (newCodeClean !== currentCode) {
    // التأكد من عدم التكرار
    const isDuplicate = localAccounts.some(a => a.code === newCodeClean && a.id !== accountId);
    if (isDuplicate) {
      return {
        success: false,
        message: `الكود الجديد (${newCodeClean}) مستخدم بالفعل لحساب آخر. يرجى اختيار كود فريد.`
      };
    }

    // تطبيق التحديث التعاقبي (Cascade Update) في قيود اليومية
    try {
      const rawEntries = localStorage.getItem(JOURNAL_ENTRIES_STORAGE_KEY);
      if (rawEntries) {
        const entries = JSON.parse(rawEntries);
        if (Array.isArray(entries)) {
          let updatedEntriesCount = 0;
          const updatedEntries = entries.map(entry => {
            let entryModified = false;
            const updatedItems = (entry.items || []).map((it: any) => {
              if (it.accountId === currentCode || it.accountId === accountId || it.accountCode === currentCode) {
                entryModified = true;
                return { ...it, accountId: newCodeClean, accountCode: newCodeClean };
              }
              return it;
            });
            if (entryModified) updatedEntriesCount++;
            return { ...entry, items: updatedItems };
          });
          if (updatedEntriesCount > 0) {
            localStorage.setItem(JOURNAL_ENTRIES_STORAGE_KEY, JSON.stringify(updatedEntries));
            cascadeUpdatedCount += updatedEntriesCount;
          }
        }
      }
    } catch (e) {
      console.error("Error executing cascade update on journal entries:", e);
    }

    // تطبيق التحديث التعاقبي في السندات المالية (قبض، صرف، تحويل داخلي)
    const voucherKeys = [
      DB_RECEIPT_VOUCHERS_KEY,
      DB_PAYMENT_VOUCHERS_KEY,
      DB_INTERNAL_RECEIPT_VOUCHERS_KEY,
      DB_INTERNAL_PAYMENT_VOUCHERS_KEY,
      DB_INTERNAL_VOUCHERS_KEY
    ];

    voucherKeys.forEach(vKey => {
      try {
        const rawV = localStorage.getItem(vKey);
        if (rawV) {
          const vouchers = JSON.parse(rawV);
          if (Array.isArray(vouchers)) {
            let modified = false;
            const updated = vouchers.map((item: any) => {
              let itemUpdated = false;
              if (item.accountId === currentCode || item.accountId === accountId) {
                item.accountId = newCodeClean;
                itemUpdated = true;
              }
              if (item.fromAccountId === currentCode || item.fromAccountId === accountId) {
                item.fromAccountId = newCodeClean;
                itemUpdated = true;
              }
              if (item.toAccountId === currentCode || item.toAccountId === accountId) {
                item.toAccountId = newCodeClean;
                itemUpdated = true;
              }
              if (itemUpdated) modified = true;
              return item;
            });
            if (modified) {
              localStorage.setItem(vKey, JSON.stringify(updated));
              cascadeUpdatedCount++;
            }
          }
        }
      } catch (err) {
        console.error(`Error cascading into ${vKey}:`, err);
      }
    });

    // تحديث أي حسابات أبناء في التخزين
    localAccounts.forEach(acc => {
      if (acc.parentId === accountId || acc.parentId === currentCode) {
        acc.parentId = newCodeClean;
        cascadeUpdatedCount++;
      }
    });

    existingAcc.code = newCodeClean;
  }

  // 4. تعديل الاسم (مسموح دائماً وفي أي وقت)
  if (updates.nameAr?.trim()) {
    existingAcc.name = updates.nameAr.trim();
  }
  if (updates.nameEn !== undefined) {
    existingAcc.nameEn = updates.nameEn.trim();
  }

  // 5. تعديل النوع والمستوى (ممنوع بعد تسجيل حركات، مسموح للحساب الجديد)
  if (updates.newType && !txCheck.hasTransactions) {
    existingAcc.type = updates.newType;
    existingAcc.balanceType = ['ASSET', 'EXPENSE'].includes(updates.newType) 
      ? BalanceType.Debit 
      : BalanceType.Credit;
  }

  if (updates.newLevel !== undefined && !txCheck.hasTransactions && !isRoot) {
    existingAcc.level = updates.newLevel;
    existingAcc.isPosting = updates.newIsPosting !== undefined ? updates.newIsPosting : (updates.newLevel >= 3);
  } else if (updates.newIsPosting !== undefined && !txCheck.hasTransactions && !isRoot) {
    existingAcc.isPosting = updates.newIsPosting;
  }

  // 6. تعديل حالة التنشيط (البديل الهندسي)
  if (updates.isActive !== undefined && !isRoot) {
    existingAcc.isActive = updates.isActive;
  }

  // 7. تعديل تصنيف الأصول (الأصول المتداولة مقابل الأصول غير المتداولة / الثابتة)
  if (updates.assetClassification !== undefined && existingAcc.type === 'ASSET') {
    existingAcc.assetClassification = updates.assetClassification;
    if (updates.assetClassification === 'NON_CURRENT') {
      if (
        !existingAcc.parentId || 
        existingAcc.parentId === '11' || 
        existingAcc.parentId === 'acc_11' || 
        existingAcc.parentId === '1' || 
        existingAcc.parentId === 'acc_1' ||
        String(existingAcc.parentId).startsWith('11')
      ) {
        existingAcc.parentId = '12';
      }
    } else if (updates.assetClassification === 'CURRENT') {
      if (
        !existingAcc.parentId || 
        existingAcc.parentId === '12' || 
        existingAcc.parentId === 'acc_12' || 
        existingAcc.parentId === '1' || 
        existingAcc.parentId === 'acc_1' ||
        String(existingAcc.parentId).startsWith('12')
      ) {
        existingAcc.parentId = '11';
      }
    }
  }

  if (updates.parentId) {
    existingAcc.parentId = updates.parentId;
  }

  const nextSnapshot: Account = JSON.parse(JSON.stringify(existingAcc));

  // تسجيل الإجراء في سجل التراجع والتاريخ
  recordAccountAction({
    type: 'UPDATE',
    title: `تعديل الحساب (${existingAcc.code})`,
    description: `تم تعديل بيانات الحساب "${existingAcc.name}" (كود: ${existingAcc.code})`,
    accountId: existingAcc.id,
    accountCode: existingAcc.code,
    previousState: previousSnapshot,
    nextState: nextSnapshot,
    journalEntriesSnapshot
  });

  // حفظ الحسابات
  saveChartOfAccounts(localAccounts);
  window.dispatchEvent(new Event('alpha-chart-of-accounts-updated'));
  window.dispatchEvent(new Event('alpha-data-changed'));
  window.dispatchEvent(new Event('alpha-journal-entries-updated'));
  window.dispatchEvent(new Event('alpha-trial-balance-updated'));

  return {
    success: true,
    message: cascadeUpdatedCount > 0
      ? `تم تعديل الحساب بنجاح، وتحديث (${cascadeUpdatedCount}) قيد/سجل مرتبط به تعاقبياً (Cascade Update).`
      : 'تم حفظ تعديلات الحساب بنجاح.',
    cascadeUpdatedCount
  };
}
