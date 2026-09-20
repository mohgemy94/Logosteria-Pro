import { BankCheck, CheckUrgency, CheckStats } from '../types/check';
import { 
  DB_RECEIPT_VOUCHERS_KEY, 
  DB_PAYMENT_VOUCHERS_KEY, 
  DB_INTERNAL_RECEIPT_VOUCHERS_KEY, 
  DB_INTERNAL_PAYMENT_VOUCHERS_KEY 
} from './sequences';
import { loadChartOfAccounts, saveJournalEntry, deleteJournalEntry } from './trialBalanceStore';
import { JournalEntry, JournalEntryStatus } from '../types/accounting';

export const CHECKS_STORAGE_KEY = 'alpha_bank_checks_v1';

function safeParse<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error(`Error reading ${key} from storage:`, e);
    return fallback;
  }
}

/**
 * Returns today's ISO date string (YYYY-MM-DD)
 */
export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Computes the urgency status and days remaining for a check.
 */
export function getCheckUrgencyInfo(dueDateStr: string, status: BankCheck['status']): {
  urgency: CheckUrgency;
  daysRemaining: number;
  labelAr: string;
  badgeClass: string;
} {
  if (status !== 'UNDER_COLLECTION') {
    if (status === 'CLEARED') {
      return {
        urgency: 'SETTLED',
        daysRemaining: 0,
        labelAr: 'تم الصرف والتحصيل',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300'
      };
    }
    if (status === 'ENDORSED') {
      return {
        urgency: 'SETTLED',
        daysRemaining: 0,
        labelAr: 'مظهر لمورد',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-300'
      };
    }
    if (status === 'BOUNCED') {
      return {
        urgency: 'SETTLED',
        daysRemaining: 0,
        labelAr: 'شيك مرتد',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300'
      };
    }
    return {
      urgency: 'SETTLED',
      daysRemaining: 0,
      labelAr: 'ملغي',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-300'
    };
  }

  if (!dueDateStr) {
    return {
      urgency: 'FUTURE',
      daysRemaining: 999,
      labelAr: 'غير محدد التاريخ',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-300'
    };
  }

  const todayStr = getTodayIsoDate();
  const today = new Date(todayStr + 'T00:00:00');
  const due = new Date(dueDateStr + 'T00:00:00');
  const diffTime = due.getTime() - today.getTime();
  const daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    const overdueDays = Math.abs(daysRemaining);
    return {
      urgency: 'OVERDUE',
      daysRemaining,
      labelAr: `متأخر (${overdueDays} ${overdueDays === 1 ? 'يوم' : 'أيام'})`,
      badgeClass: 'bg-rose-600 text-white font-black border-rose-700 animate-pulse'
    };
  }

  if (daysRemaining === 0) {
    return {
      urgency: 'DUE_TODAY',
      daysRemaining: 0,
      labelAr: 'مستحق اليوم ⚠️',
      badgeClass: 'bg-amber-500 text-white font-black border-amber-600 shadow-xs'
    };
  }

  if (daysRemaining <= 3) {
    return {
      urgency: 'DUE_SOON',
      daysRemaining,
      labelAr: `يستحق خلال ${daysRemaining} ${daysRemaining === 1 ? 'يوم' : 'أيام'}`,
      badgeClass: 'bg-amber-100 text-amber-900 font-bold border-amber-300'
    };
  }

  if (daysRemaining <= 7) {
    return {
      urgency: 'DUE_THIS_WEEK',
      daysRemaining,
      labelAr: `يستحق خلال ${daysRemaining} أيام`,
      badgeClass: 'bg-blue-100 text-blue-900 font-bold border-blue-300'
    };
  }

  return {
    urgency: 'FUTURE',
    daysRemaining,
    labelAr: `مستقبلي (${daysRemaining} يوم)`,
    badgeClass: 'bg-slate-100 text-slate-700 font-medium border-slate-200'
  };
}

/**
 * Synchronizes checks from External and Internal Vouchers into the bank checks store.
 */
export function syncChecksFromVouchers(): BankCheck[] {
  if (typeof window === 'undefined') return [];
  const existingChecks: BankCheck[] = safeParse(CHECKS_STORAGE_KEY, []);
  const existingMap = new Map<string, BankCheck>();
  
  // Index existing checks by source voucher ID or check number
  existingChecks.forEach(chq => {
    if (chq.sourceVoucherId) existingMap.set(`voucher_${chq.sourceVoucherId}`, chq);
    existingMap.set(`id_${chq.id}`, chq);
  });

  const newOrUpdated: BankCheck[] = [...existingChecks];
  let hasChanges = false;

  // 1. External Receipt Vouchers (سندات القبض الخارجية)
  const extReceipts = safeParse<any[]>(DB_RECEIPT_VOUCHERS_KEY, []);
  extReceipts.forEach(v => {
    if (v.paymentMethod === 'CHECK') {
      const key = `voucher_${v.id}`;
      const existing = existingMap.get(key);
      const chqNumber = v.referenceNo || `CHQ-${v.voucherNumber || v.id.slice(-6)}`;
      const amt = Number(v.amount) || 0;
      const dueDate = v.checkDueDate || v.date || getTodayIsoDate();

      if (!existing) {
        const newCheck: BankCheck = {
          id: `chq_rec_${v.id}`,
          checkNumber: chqNumber,
          type: 'INCOMING',
          source: 'EXTERNAL_VOUCHER',
          sourceVoucherId: v.id,
          sourceVoucherNumber: v.voucherNumber,
          partnerId: v.partnerId,
          partnerName: v.partnerName || 'عميل غير محدد',
          partnerType: v.partnerType || 'CUSTOMER',
          amount: amt,
          issueDate: v.date || getTodayIsoDate(),
          dueDate: dueDate,
          bankName: v.bankName || 'البنك المسحوب عليه',
          drawerName: v.partnerName,
          status: 'UNDER_COLLECTION',
          notes: v.description,
          createdAt: v.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        newOrUpdated.unshift(newCheck);
        existingMap.set(key, newCheck);
        hasChanges = true;
      } else {
        // Sync any updated fields if still pending
        if (existing.status === 'UNDER_COLLECTION') {
          if (
            existing.amount !== amt || 
            existing.checkNumber !== chqNumber || 
            existing.bankName !== (v.bankName || existing.bankName) ||
            existing.dueDate !== dueDate
          ) {
            existing.amount = amt;
            existing.checkNumber = chqNumber;
            existing.bankName = v.bankName || existing.bankName;
            existing.dueDate = dueDate;
            existing.updatedAt = new Date().toISOString();
            hasChanges = true;
          }
        }
      }
    }
  });

  // 2. External Payment Vouchers (سندات الصرف الخارجية)
  const extPayments = safeParse<any[]>(DB_PAYMENT_VOUCHERS_KEY, []);
  extPayments.forEach(v => {
    if (v.paymentMethod === 'CHECK') {
      const key = `voucher_${v.id}`;
      const existing = existingMap.get(key);
      const chqNumber = v.referenceNo || `CHQ-${v.voucherNumber || v.id.slice(-6)}`;
      const amt = Number(v.amount) || 0;
      const dueDate = v.checkDueDate || v.date || getTodayIsoDate();

      if (!existing) {
        const newCheck: BankCheck = {
          id: `chq_pay_${v.id}`,
          checkNumber: chqNumber,
          type: 'OUTGOING',
          source: 'EXTERNAL_VOUCHER',
          sourceVoucherId: v.id,
          sourceVoucherNumber: v.voucherNumber,
          partnerId: v.partnerId,
          partnerName: v.partnerName || 'مورد غير محدد',
          partnerType: v.partnerType || 'VENDOR',
          amount: amt,
          issueDate: v.date || getTodayIsoDate(),
          dueDate: dueDate,
          bankName: v.bankName || 'بنك الشركة المسحوب منه',
          payeeName: v.partnerName,
          status: 'UNDER_COLLECTION',
          notes: v.description,
          createdAt: v.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        newOrUpdated.unshift(newCheck);
        existingMap.set(key, newCheck);
        hasChanges = true;
      } else {
        if (existing.status === 'UNDER_COLLECTION') {
          if (
            existing.amount !== amt || 
            existing.checkNumber !== chqNumber || 
            existing.bankName !== (v.bankName || existing.bankName) ||
            existing.dueDate !== dueDate
          ) {
            existing.amount = amt;
            existing.checkNumber = chqNumber;
            existing.bankName = v.bankName || existing.bankName;
            existing.dueDate = dueDate;
            existing.updatedAt = new Date().toISOString();
            hasChanges = true;
          }
        }
      }
    }
  });

  // 3. Internal Receipt Vouchers
  const intReceipts = safeParse<any[]>(DB_INTERNAL_RECEIPT_VOUCHERS_KEY, []);
  intReceipts.forEach(v => {
    if (v.paymentMethod === 'CHECK') {
      const key = `voucher_${v.id}`;
      const existing = existingMap.get(key);
      const chqNumber = v.referenceNo || `CHQ-${v.voucherNumber || v.id.slice(-6)}`;
      const amt = Number(v.amount) || 0;
      const dueDate = v.checkDueDate || v.date || getTodayIsoDate();

      if (!existing) {
        const newCheck: BankCheck = {
          id: `chq_int_rec_${v.id}`,
          checkNumber: chqNumber,
          type: 'INCOMING',
          source: 'INTERNAL_VOUCHER',
          sourceVoucherId: v.id,
          sourceVoucherNumber: v.voucherNumber,
          partnerName: v.payerName || 'قبض داخلي',
          partnerType: 'OTHER',
          amount: amt,
          issueDate: v.date || getTodayIsoDate(),
          dueDate: dueDate,
          bankName: v.bankName || 'البنك المسحوب عليه',
          status: 'UNDER_COLLECTION',
          notes: v.description,
          createdAt: v.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        newOrUpdated.unshift(newCheck);
        existingMap.set(key, newCheck);
        hasChanges = true;
      }
    }
  });

  // 4. Internal Payment Vouchers
  const intPayments = safeParse<any[]>(DB_INTERNAL_PAYMENT_VOUCHERS_KEY, []);
  intPayments.forEach(v => {
    if (v.paymentMethod === 'CHECK') {
      const key = `voucher_${v.id}`;
      const existing = existingMap.get(key);
      const chqNumber = v.referenceNo || `CHQ-${v.voucherNumber || v.id.slice(-6)}`;
      const amt = Number(v.amount) || 0;
      const dueDate = v.checkDueDate || v.date || getTodayIsoDate();

      if (!existing) {
        const newCheck: BankCheck = {
          id: `chq_int_pay_${v.id}`,
          checkNumber: chqNumber,
          type: 'OUTGOING',
          source: 'INTERNAL_VOUCHER',
          sourceVoucherId: v.id,
          sourceVoucherNumber: v.voucherNumber,
          partnerName: v.receiverName || 'صرف داخلي',
          partnerType: 'OTHER',
          amount: amt,
          issueDate: v.date || getTodayIsoDate(),
          dueDate: dueDate,
          bankName: v.bankName || 'بنك الشركة المسحوب منه',
          status: 'UNDER_COLLECTION',
          notes: v.description,
          createdAt: v.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        newOrUpdated.unshift(newCheck);
        existingMap.set(key, newCheck);
        hasChanges = true;
      }
    }
  });

  if (hasChanges) {
    try {
      localStorage.setItem(CHECKS_STORAGE_KEY, JSON.stringify(newOrUpdated));
    } catch (e) {
      console.error("Failed persisting synced checks:", e);
    }
  }

  return newOrUpdated;
}

/**
 * Loads all checks from storage with automatic sync.
 */
export function loadBankChecks(): BankCheck[] {
  return syncChecksFromVouchers();
}

/**
 * Saves or updates a single bank check.
 */
export function saveBankCheck(check: BankCheck): void {
  if (typeof window === 'undefined') return;
  try {
    const list = syncChecksFromVouchers();
    const idx = list.findIndex(c => c.id === check.id);
    let updated: BankCheck[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = { ...check, updatedAt: new Date().toISOString() };
    } else {
      updated = [{ ...check, updatedAt: new Date().toISOString() }, ...list];
    }
    localStorage.setItem(CHECKS_STORAGE_KEY, JSON.stringify(updated));
    dispatchChecksUpdated();
  } catch (e) {
    console.error("Failed saving bank check:", e);
  }
}

/**
 * Deletes a bank check and its generated journal entry if any.
 */
export function deleteBankCheck(checkId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = syncChecksFromVouchers();
    const target = list.find(c => c.id === checkId);
    if (target?.journalEntryId) {
      deleteJournalEntry(target.journalEntryId);
    }
    if (target?.bounceJournalEntryId) {
      deleteJournalEntry(target.bounceJournalEntryId);
    }
    const updated = list.filter(c => c.id !== checkId);
    localStorage.setItem(CHECKS_STORAGE_KEY, JSON.stringify(updated));
    dispatchChecksUpdated();
  } catch (e) {
    console.error("Failed deleting bank check:", e);
  }
}

/**
 * Helper to dispatch checks update event across components.
 */
export function dispatchChecksUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('alpha-checks-updated'));
  window.dispatchEvent(new Event('alpha-trial-balance-updated'));
}

/**
 * Executes the clearance of a check and generates the automatic balanced journal entry.
 */
export function clearBankCheck(
  checkId: string, 
  options: { 
    clearanceDate: string; 
    bankAccountId: string; 
    bankAccountName?: string;
    reference?: string; 
    notes?: string; 
  }
): { success: boolean; message: string; journalEntryNumber?: string } {
  if (typeof window === 'undefined') return { success: false, message: 'بيئة غير صالحة' };

  try {
    const list = syncChecksFromVouchers();
    const check = list.find(c => c.id === checkId);
    if (!check) {
      return { success: false, message: 'الشيك غير موجود' };
    }

    if (check.status === 'CLEARED') {
      return { success: false, message: 'الشيك تم صرفه وتحصيله مسبقاً' };
    }

    const accounts = loadChartOfAccounts();
    const bankAccount = accounts.find(a => a.id === options.bankAccountId || a.code === options.bankAccountId) 
      || accounts.find(a => a.code === '1102') 
      || accounts[0]
      || { id: 'acc-1102', code: '1102', name: 'حساب البنك الأهلي التجاري' };

    // Check account 1104 (Checks under collection) and 2104 (Issued checks payable)
    const checkCollectionAcc = accounts.find(a => a.code === '1104') || { id: 'acc-1104', code: '1104', name: 'شيكات تحت التحصيل' };
    const checkPayableAcc = accounts.find(a => a.code === '2104') || { id: 'acc-2104', code: '2104', name: 'شيكات صادرة برسم الصرف' };

    const clearanceDate = options.clearanceDate || getTodayIsoDate();
    const jeId = `je-chq-clr-${check.id}-${Date.now()}`;
    const jeNumber = `JV-CHQ-${check.checkNumber.replace(/\s+/g, '')}`;

    // Create automatic balanced journal entry
    let journalEntry: JournalEntry;

    if (check.type === 'INCOMING') {
      // شيك وارد (قبض):
      // من حـ/ البنك (مدين)
      // إلى حـ/ شيكات تحت التحصيل (دائن)
      journalEntry = {
        id: jeId,
        entryNumber: jeNumber,
        date: clearanceDate,
        status: JournalEntryStatus.Posted,
        reference: options.reference || `شيك #${check.checkNumber}`,
        description: `تحصيل وإيداع شيك مصرفي رقم [${check.checkNumber}] مسحوب على ${check.bankName} من ${check.partnerName} في ${bankAccount.name}`,
        items: [
          {
            id: `ji-${Date.now()}-1`,
            accountId: bankAccount.id,
            debit: check.amount,
            credit: 0
          },
          {
            id: `ji-${Date.now()}-2`,
            accountId: checkCollectionAcc.id,
            partnerId: check.partnerId,
            partnerName: check.partnerName,
            partnerType: check.partnerType === 'CUSTOMER' ? 'CUSTOMER' : undefined,
            debit: 0,
            credit: check.amount
          }
        ]
      };
    } else {
      // شيك صادر (صرف):
      // من حـ/ شيكات صادرة برسم الصرف (مدين)
      // إلى حـ/ البنك (دائن)
      journalEntry = {
        id: jeId,
        entryNumber: jeNumber,
        date: clearanceDate,
        status: JournalEntryStatus.Posted,
        reference: options.reference || `شيك #${check.checkNumber}`,
        description: `صرف وخصم شيك مصرفي رقم [${check.checkNumber}] لصالح ${check.partnerName} من حساب ${bankAccount.name}`,
        items: [
          {
            id: `ji-${Date.now()}-1`,
            accountId: checkPayableAcc.id,
            partnerId: check.partnerId,
            partnerName: check.partnerName,
            partnerType: check.partnerType === 'VENDOR' ? 'VENDOR' : undefined,
            debit: check.amount,
            credit: 0
          },
          {
            id: `ji-${Date.now()}-2`,
            accountId: bankAccount.id,
            debit: 0,
            credit: check.amount
          }
        ]
      };
    }

    // Save generated journal entry
    saveJournalEntry(journalEntry);

    // Update check record
    check.status = 'CLEARED';
    check.depositBankAccountId = bankAccount.id;
    check.depositBankAccountName = bankAccount.name;
    check.clearanceDate = clearanceDate;
    check.clearanceReference = options.reference;
    check.journalEntryId = journalEntry.id;
    check.journalEntryNumber = journalEntry.entryNumber;
    if (options.notes) {
      check.notes = check.notes ? `${check.notes} | ${options.notes}` : options.notes;
    }
    check.updatedAt = new Date().toISOString();

    localStorage.setItem(CHECKS_STORAGE_KEY, JSON.stringify(list));
    dispatchChecksUpdated();

    return {
      success: true,
      message: `تم تأكيد صرف وتحصيل الشيك بنجاح وتوليد القيد المحاسبي برقم (${jeNumber})`,
      journalEntryNumber: jeNumber
    };
  } catch (err: any) {
    console.error("Error clearing check:", err);
    return { success: false, message: err?.message || 'حدث خطأ أثناء صرف الشيك' };
  }
}

/**
 * Records a check as bounced (مرتد) and generates the corresponding journal entry.
 */
export function bounceBankCheck(
  checkId: string,
  options: {
    bounceDate: string;
    reason: string;
    fee?: number;
    feeBankAccountId?: string;
    notes?: string;
  }
): { success: boolean; message: string; journalEntryNumber?: string } {
  if (typeof window === 'undefined') return { success: false, message: 'بيئة غير صالحة' };

  try {
    const list = syncChecksFromVouchers();
    const check = list.find(c => c.id === checkId);
    if (!check) {
      return { success: false, message: 'الشيك غير موجود' };
    }

    // If it had a clearance journal entry, remove it first
    if (check.journalEntryId) {
      deleteJournalEntry(check.journalEntryId);
      check.journalEntryId = undefined;
      check.journalEntryNumber = undefined;
    }

    const accounts = loadChartOfAccounts();
    const bounceDate = options.bounceDate || getTodayIsoDate();
    const jeId = `je-chq-bnc-${check.id}-${Date.now()}`;
    const jeNumber = `JV-BNC-${check.checkNumber.replace(/\s+/g, '')}`;

    const customerAcc = accounts.find(a => a.code === '1201') || { id: 'acc-1201', code: '1201', name: 'ذمم العملاء' };
    const vendorAcc = accounts.find(a => a.code === '2101') || { id: 'acc-2101', code: '2101', name: 'ذمم الموردين' };
    const checkCollectionAcc = accounts.find(a => a.code === '1104') || { id: 'acc-1104', code: '1104', name: 'شيكات تحت التحصيل' };
    const checkPayableAcc = accounts.find(a => a.code === '2104') || { id: 'acc-2104', code: '2104', name: 'شيكات صادرة برسم الصرف' };
    const bankFeeAcc = accounts.find(a => a.code === '5104') || { id: 'acc-5104', code: '5104', name: 'مصروفات بنكية وإدارية' };
    const feeBank = accounts.find(a => a.id === options.feeBankAccountId || a.code === options.feeBankAccountId) 
      || accounts.find(a => a.code === '1102') 
      || accounts[0]
      || { id: 'acc-1102', code: '1102', name: 'حساب البنك الأهلي التجاري' };

    const feeAmt = Number(options.fee) || 0;

    let journalEntry: JournalEntry;

    if (check.type === 'INCOMING') {
      // شيك وارد مرتد:
      // من حـ/ ذمم العملاء (مدين) - لإعادة المديونية على العميل
      // إلى حـ/ شيكات تحت التحصيل (دائن)
      const items = [
        {
          id: `ji-bnc-${Date.now()}-1`,
          accountId: customerAcc.id,
          partnerId: check.partnerId,
          partnerName: check.partnerName,
          partnerType: 'CUSTOMER' as const,
          debit: check.amount,
          credit: 0
        },
        {
          id: `ji-bnc-${Date.now()}-2`,
          accountId: checkCollectionAcc.id,
          debit: 0,
          credit: check.amount
        }
      ];

      if (feeAmt > 0) {
        items.push({
          id: `ji-bnc-${Date.now()}-fee1`,
          accountId: bankFeeAcc.id,
          debit: feeAmt,
          credit: 0
        });
        items.push({
          id: `ji-bnc-${Date.now()}-fee2`,
          accountId: feeBank.id,
          debit: 0,
          credit: feeAmt
        });
      }

      journalEntry = {
        id: jeId,
        entryNumber: jeNumber,
        date: bounceDate,
        status: JournalEntryStatus.Posted,
        reference: `ارتداد شيك #${check.checkNumber}`,
        description: `قيد ارتداد شيك مصرفي رقم [${check.checkNumber}] من ${check.partnerName} - السبب: ${options.reason || 'عدم كفاية الرصيد'}`,
        items
      };
    } else {
      // شيك صادر مرتد:
      // من حـ/ شيكات صادرة برسم الصرف (مدين)
      // إلى حـ/ ذمم الموردين (دائن) - لإعادة استحقاق المورد
      journalEntry = {
        id: jeId,
        entryNumber: jeNumber,
        date: bounceDate,
        status: JournalEntryStatus.Posted,
        reference: `ارتداد شيك #${check.checkNumber}`,
        description: `قيد ارتداد شيك صادر رقم [${check.checkNumber}] للمورد ${check.partnerName} - السبب: ${options.reason || 'مرفوض من البنك'}`,
        items: [
          {
            id: `ji-bnc-${Date.now()}-1`,
            accountId: checkPayableAcc.id,
            debit: check.amount,
            credit: 0
          },
          {
            id: `ji-bnc-${Date.now()}-2`,
            accountId: vendorAcc.id,
            partnerId: check.partnerId,
            partnerName: check.partnerName,
            partnerType: 'VENDOR' as const,
            debit: 0,
            credit: check.amount
          }
        ]
      };
    }

    saveJournalEntry(journalEntry);

    check.status = 'BOUNCED';
    check.bounceDate = bounceDate;
    check.bounceReason = options.reason;
    check.bounceFee = feeAmt;
    check.bounceJournalEntryId = journalEntry.id;
    check.journalEntryNumber = journalEntry.entryNumber;
    if (options.notes) {
      check.notes = check.notes ? `${check.notes} | ارتداد: ${options.notes}` : `ارتداد: ${options.notes}`;
    }
    check.updatedAt = new Date().toISOString();

    localStorage.setItem(CHECKS_STORAGE_KEY, JSON.stringify(list));
    dispatchChecksUpdated();

    return {
      success: true,
      message: `تم تسجيل ارتداد الشيك وإعادة تقييده بالدفاتر بنجاح برقم قيد (${jeNumber})`,
      journalEntryNumber: jeNumber
    };
  } catch (err: any) {
    console.error("Error marking check bounced:", err);
    return { success: false, message: err?.message || 'حدث خطأ أثناء تسجيل ارتداد الشيك' };
  }
}

/**
 * Cancels or resets check clearance/bounce back to UNDER_COLLECTION.
 */
export function resetCheckStatus(checkId: string): { success: boolean; message: string } {
  if (typeof window === 'undefined') return { success: false, message: 'بيئة غير صالحة' };
  try {
    const list = syncChecksFromVouchers();
    const check = list.find(c => c.id === checkId);
    if (!check) return { success: false, message: 'الشيك غير موجود' };

    if (check.journalEntryId) {
      deleteJournalEntry(check.journalEntryId);
    }
    if (check.bounceJournalEntryId) {
      deleteJournalEntry(check.bounceJournalEntryId);
    }

    check.status = 'UNDER_COLLECTION';
    check.depositBankAccountId = undefined;
    check.depositBankAccountName = undefined;
    check.clearanceDate = undefined;
    check.clearanceReference = undefined;
    check.bounceDate = undefined;
    check.bounceReason = undefined;
    check.bounceFee = undefined;
    check.endorsementDate = undefined;
    check.endorsedToVendorId = undefined;
    check.endorsedToVendorName = undefined;
    check.journalEntryId = undefined;
    check.journalEntryNumber = undefined;
    check.bounceJournalEntryId = undefined;
    check.updatedAt = new Date().toISOString();

    localStorage.setItem(CHECKS_STORAGE_KEY, JSON.stringify(list));
    dispatchChecksUpdated();

    return { success: true, message: 'تم التراجع عن الإجراء وإعادة الشيك لحالة (تحت التحصيل)' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'فشل التراجع' };
  }
}

/**
 * Endorses an incoming check to a vendor (تظهير الشيك لمورد لسداد حسابه) and creates the corresponding journal entry.
 */
export function endorseBankCheck(
  checkId: string,
  options: {
    endorsementDate: string;
    vendorId: string;
    vendorName: string;
    notes?: string;
  }
): { success: boolean; message: string; journalEntryNumber?: string } {
  if (typeof window === 'undefined') return { success: false, message: 'بيئة غير صالحة' };

  try {
    const list = syncChecksFromVouchers();
    const check = list.find(c => c.id === checkId);
    if (!check) {
      return { success: false, message: 'الشيك غير موجود' };
    }

    if (check.type !== 'INCOMING') {
      return { success: false, message: 'لا يمكن تظهير سوى الشيكات الواردة من العملاء' };
    }

    if (check.status !== 'UNDER_COLLECTION') {
      return { success: false, message: 'الشيك ليس بحالة تحت التحصيل' };
    }

    const accounts = loadChartOfAccounts();
    const endorsementDate = options.endorsementDate || getTodayIsoDate();
    const jeId = `je-chq-end-${check.id}-${Date.now()}`;
    const jeNumber = `JV-END-${check.checkNumber.replace(/\s+/g, '')}`;

    const vendorAcc = accounts.find(a => a.code === '2101') || { id: 'acc-2101', code: '2101', name: 'ذمم الموردين' };
    const checkCollectionAcc = accounts.find(a => a.code === '1104') || { id: 'acc-1104', code: '1104', name: 'شيكات تحت التحصيل' };

    // القيد المحاسبي لتظهير الشيك:
    // من حـ/ ذمم الموردين (مدين) - باسم المورد المسدد له
    // إلى حـ/ شيكات تحت التحصيل (دائن) - بتخفيض حافظة الشيكات الواردة
    const journalEntry: JournalEntry = {
      id: jeId,
      entryNumber: jeNumber,
      date: endorsementDate,
      status: JournalEntryStatus.Posted,
      reference: `تظهير شيك #${check.checkNumber}`,
      description: `تظهير وتحويل شيك وارد رقم [${check.checkNumber}] من العميل ${check.partnerName} لصالح المورد ${options.vendorName}`,
      items: [
        {
          id: `ji-end-${Date.now()}-1`,
          accountId: vendorAcc.id,
          partnerId: options.vendorId,
          partnerName: options.vendorName,
          partnerType: 'VENDOR',
          debit: check.amount,
          credit: 0
        },
        {
          id: `ji-end-${Date.now()}-2`,
          accountId: checkCollectionAcc.id,
          partnerId: check.partnerId,
          partnerName: check.partnerName,
          partnerType: 'CUSTOMER',
          debit: 0,
          credit: check.amount
        }
      ]
    };

    saveJournalEntry(journalEntry);

    check.status = 'ENDORSED';
    check.endorsementDate = endorsementDate;
    check.endorsedToVendorId = options.vendorId;
    check.endorsedToVendorName = options.vendorName;
    check.journalEntryId = journalEntry.id;
    check.journalEntryNumber = journalEntry.entryNumber;
    if (options.notes) {
      check.notes = check.notes ? `${check.notes} | تظهير: ${options.notes}` : `تظهير: ${options.notes}`;
    }
    check.updatedAt = new Date().toISOString();

    localStorage.setItem(CHECKS_STORAGE_KEY, JSON.stringify(list));
    dispatchChecksUpdated();

    return {
      success: true,
      message: `تم تظهير الشيك للمورد (${options.vendorName}) وتوليد القيد المحاسبي برقم (${jeNumber}) بنجاح`,
      journalEntryNumber: jeNumber
    };
  } catch (err: any) {
    console.error("Error endorsing check:", err);
    return { success: false, message: err?.message || 'حدث خطأ أثناء تظهير الشيك' };
  }
}

/**
 * Executes clearance for multiple checks in bulk.
 */
export function clearMultipleBankChecks(
  checkIds: string[],
  options: {
    clearanceDate: string;
    bankAccountId: string;
    bankAccountName?: string;
    reference?: string;
    notes?: string;
  }
): { successCount: number; failCount: number; messages: string[] } {
  let successCount = 0;
  let failCount = 0;
  const messages: string[] = [];

  checkIds.forEach(id => {
    const res = clearBankCheck(id, options);
    if (res.success) {
      successCount++;
    } else {
      failCount++;
      messages.push(res.message);
    }
  });

  return { successCount, failCount, messages };
}

/**
 * Exports checks portfolio to CSV format.
 */
export function exportChecksToCSV(checks: BankCheck[], currencySymbol = 'ر.س'): void {
  const headers = [
    'رقم الشيك',
    'نوع الشيك',
    'مصدر الشيك',
    'الطرف (العميل / المورد)',
    'البنك المسحوب عليه',
    'الفرع',
    'الساحب / المستفيد',
    'المبلغ',
    'العملة',
    'تاريخ التحرير',
    'تاريخ الاستحقاق',
    'الحالة',
    'تاريخ الصرف/التحصيل',
    'حساب البنك المودع فيه/المصروف منه',
    'المرجع البنكي',
    'سبب الارتداد (إن وجد)',
    'المورد المظهر إليه (إن وجد)',
    'رقم القيد المحاسبي الآلي',
    'ملاحظات'
  ];

  const rows = checks.map(c => {
    const statusLabel = 
      c.status === 'UNDER_COLLECTION' ? 'تحت التحصيل' :
      c.status === 'CLEARED' ? 'تم الصرف والتحصيل' :
      c.status === 'ENDORSED' ? 'مظهر لمورد' :
      c.status === 'BOUNCED' ? 'مرتد' : 'ملغي';

    const typeLabel = c.type === 'INCOMING' ? 'شيك وارد (قبض)' : 'شيك صادر (صرف)';
    const sourceLabel = 
      c.source === 'EXTERNAL_VOUCHER' ? 'سند خارجي' :
      c.source === 'INTERNAL_VOUCHER' ? 'سند داخلي' : 'تسجيل يدوي بالحافظة';

    return [
      `"${c.checkNumber}"`,
      `"${typeLabel}"`,
      `"${sourceLabel}"`,
      `"${(c.partnerName || '').replace(/"/g, '""')}"`,
      `"${(c.bankName || '').replace(/"/g, '""')}"`,
      `"${(c.branchName || '').replace(/"/g, '""')}"`,
      `"${(c.drawerName || c.payeeName || '').replace(/"/g, '""')}"`,
      c.amount,
      `"${currencySymbol}"`,
      `"${c.issueDate || ''}"`,
      `"${c.dueDate || ''}"`,
      `"${statusLabel}"`,
      `"${c.clearanceDate || ''}"`,
      `"${(c.depositBankAccountName || '').replace(/"/g, '""')}"`,
      `"${(c.clearanceReference || '').replace(/"/g, '""')}"`,
      `"${(c.bounceReason || '').replace(/"/g, '""')}"`,
      `"${(c.endorsedToVendorName || '').replace(/"/g, '""')}"`,
      `"${c.journalEntryNumber || ''}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `حافظة_الشيكات_${getTodayIsoDate()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Calculates check statistics and notifications.
 */
export function getCheckStats(checks: BankCheck[]): CheckStats {
  const stats: CheckStats = {
    totalCount: checks.length,
    totalAmount: 0,
    incomingCount: 0,
    incomingAmount: 0,
    outgoingCount: 0,
    outgoingAmount: 0,

    underCollectionCount: 0,
    underCollectionAmount: 0,
    clearedCount: 0,
    clearedAmount: 0,
    bouncedCount: 0,
    bouncedAmount: 0,
    endorsedCount: 0,
    endorsedAmount: 0,

    overdueCount: 0,
    overdueAmount: 0,
    dueTodayCount: 0,
    dueTodayAmount: 0,
    dueSoonCount: 0,
    dueSoonAmount: 0
  };

  checks.forEach(chq => {
    const amt = Number(chq.amount) || 0;
    stats.totalAmount += amt;

    if (chq.type === 'INCOMING') {
      stats.incomingCount++;
      stats.incomingAmount += amt;
    } else {
      stats.outgoingCount++;
      stats.outgoingAmount += amt;
    }

    if (chq.status === 'UNDER_COLLECTION') {
      stats.underCollectionCount++;
      stats.underCollectionAmount += amt;

      const urgency = getCheckUrgencyInfo(chq.dueDate, chq.status);
      if (urgency.urgency === 'OVERDUE') {
        stats.overdueCount++;
        stats.overdueAmount += amt;
      } else if (urgency.urgency === 'DUE_TODAY') {
        stats.dueTodayCount++;
        stats.dueTodayAmount += amt;
      } else if (urgency.urgency === 'DUE_SOON' || urgency.urgency === 'DUE_THIS_WEEK') {
        stats.dueSoonCount++;
        stats.dueSoonAmount += amt;
      }
    } else if (chq.status === 'CLEARED') {
      stats.clearedCount++;
      stats.clearedAmount += amt;
    } else if (chq.status === 'ENDORSED') {
      stats.endorsedCount++;
      stats.endorsedAmount += amt;
    } else if (chq.status === 'BOUNCED') {
      stats.bouncedCount++;
      stats.bouncedAmount += amt;
    }
  });

  return stats;
}
