import { Account, AccountType, BalanceType, JournalEntry, JournalEntryStatus } from '../types/accounting';
import { 
  DB_SALES_INVOICES_KEY, 
  DB_PURCHASES_INVOICES_KEY,
  DB_RECEIPT_VOUCHERS_KEY,
  DB_PAYMENT_VOUCHERS_KEY,
  DB_INTERNAL_RECEIPT_VOUCHERS_KEY,
  DB_INTERNAL_PAYMENT_VOUCHERS_KEY,
  DB_INTERNAL_VOUCHERS_KEY
} from './sequences';

export const JOURNAL_ENTRIES_STORAGE_KEY = 'alpha_journal_entries_v1';
export const ACCOUNTS_STORAGE_KEY = 'alpha_chart_of_accounts_v1';

// Default Chart of Accounts
export const DEFAULT_ACCOUNTS: Account[] = [
  // 1000 - Assets (الأصول)
  { id: 'acc-1101', code: '1101', name: 'النقدية بالصندوق (الصندوق الرئيسي)', type: AccountType.Asset, balanceType: BalanceType.Debit },
  { id: 'acc-1102', code: '1102', name: 'حساب البنك الأهلي التجاري', type: AccountType.Asset, balanceType: BalanceType.Debit },
  { id: 'acc-1103', code: '1103', name: 'حساب بنك الراجحي', type: AccountType.Asset, balanceType: BalanceType.Debit },
  { id: 'acc-1104', code: '1104', name: 'شيكات تحت التحصيل (أوراق قبض برسم التحصيل)', type: AccountType.Asset, balanceType: BalanceType.Debit },
  { id: 'acc-1201', code: '1201', name: 'ذمم العملاء (حساب مراقبة المدينين - Sub-Ledger AR)', type: AccountType.Asset, balanceType: BalanceType.Debit, isControlAccount: true, controlType: 'CUSTOMER' },
  { id: 'acc-1301', code: '1301', name: 'المخزون السلعي والمواد الخام (المستودع الرئيسي)', type: AccountType.Asset, balanceType: BalanceType.Debit },
  { id: 'acc-1302', code: '1302', name: 'مخزون إنتاج تحت التشغيل (WIP - حساب مراقبة التشغيل)', type: AccountType.Asset, balanceType: BalanceType.Debit },
  { id: 'acc-1303', code: '1303', name: 'مخزون الإنتاج التام والجاهز للتسليم', type: AccountType.Asset, balanceType: BalanceType.Debit },
  { id: 'acc-1401', code: '1401', name: 'الأصول الثابتة - الآلات والمعدات', type: AccountType.Asset, balanceType: BalanceType.Debit },
  { id: 'acc-1402', code: '1402', name: 'الأصول الثابتة - أجهزة ومعدات تقنية', type: AccountType.Asset, balanceType: BalanceType.Debit },

  // 2000 - Liabilities (الالتزامات)
  { id: 'acc-2101', code: '2101', name: 'ذمم الموردين (حساب مراقبة الدائنين - Sub-Ledger AP)', type: AccountType.Liability, balanceType: BalanceType.Credit, isControlAccount: true, controlType: 'VENDOR' },
  { id: 'acc-2102', code: '2102', name: 'ضريبة القيمة المضافة المستحقة (VAT)', type: AccountType.Liability, balanceType: BalanceType.Credit },
  { id: 'acc-2103', code: '2103', name: 'أوراق الدفع والكمبيالات المستحقة', type: AccountType.Liability, balanceType: BalanceType.Credit },
  { id: 'acc-2104', code: '2104', name: 'شيكات صادرة للموردين برسم الصرف (أوراق دفع مؤجلة)', type: AccountType.Liability, balanceType: BalanceType.Credit },
  { id: 'acc-2201', code: '2201', name: 'رواتب ومستحقات الموظفين المستحقة', type: AccountType.Liability, balanceType: BalanceType.Credit },

  // 3000 - Equity (حقوق الملكية)
  { id: 'acc-3101', code: '3101', name: 'رأس المال المباشر', type: AccountType.Equity, balanceType: BalanceType.Credit },
  { id: 'acc-3201', code: '3201', name: 'الأرباح والخسائر المدورة', type: AccountType.Equity, balanceType: BalanceType.Credit },

  // 4000 - Revenue (الإيرادات)
  { id: 'acc-4101', code: '4101', name: 'إيرادات المبيعات التجارية', type: AccountType.Revenue, balanceType: BalanceType.Credit },
  { id: 'acc-4102', code: '4102', name: 'إيرادات تقديم الخدمات والصيانة', type: AccountType.Revenue, balanceType: BalanceType.Credit },
  { id: 'acc-4103', code: '4103', name: 'الخصم المسموح به (خصم المبيعات الممنوح للعملاء)', type: AccountType.Revenue, balanceType: BalanceType.Debit },
  { id: 'acc-4201', code: '4201', name: 'إيرادات وأرباح متنوعة أخرى', type: AccountType.Revenue, balanceType: BalanceType.Credit },
  { id: 'acc-4202', code: '4202', name: 'أرباح وفروقات تسوية زيادة المخزون', type: AccountType.Revenue, balanceType: BalanceType.Credit },
  { id: 'acc-4203', code: '4203', name: 'الخصم المكتسب (خصم المشتريات والتوريد من الموردين)', type: AccountType.Revenue, balanceType: BalanceType.Credit },

  // 5000 - Expenses (المصروفات)
  { id: 'acc-5101', code: '5101', name: 'تكلفة البضاعة المباعة (COGS)', type: AccountType.Expense, balanceType: BalanceType.Debit },
  { id: 'acc-5102', code: '5102', name: 'مصروفات الرواتب والأجور والبدلات', type: AccountType.Expense, balanceType: BalanceType.Debit },
  { id: 'acc-5103', code: '5103', name: 'مصروف إيجار المقر والفروع', type: AccountType.Expense, balanceType: BalanceType.Debit },
  { id: 'acc-5104', code: '5104', name: 'مصروفات عمومية وإدارية', type: AccountType.Expense, balanceType: BalanceType.Debit },
  { id: 'acc-5105', code: '5105', name: 'مصروفات الكهرباء والمياه والاتصالات', type: AccountType.Expense, balanceType: BalanceType.Debit },
  { id: 'acc-5106', code: '5106', name: 'مصروفات الدعاية والتسويق', type: AccountType.Expense, balanceType: BalanceType.Debit },
  { id: 'acc-5107', code: '5107', name: 'مصروفات وخسائر عجز وتلف المخزون', type: AccountType.Expense, balanceType: BalanceType.Debit },
  { id: 'acc-5108', code: '5108', name: 'أجور وتكاليف ومصاريف تشغيل صناعية محملة (Applied Overheads & Labor)', type: AccountType.Expense, balanceType: BalanceType.Debit },
  { id: 'acc-5109', code: '5109', name: 'خسائر وتكاليف الهالك الصناعي غير الطبيعي', type: AccountType.Expense, balanceType: BalanceType.Debit }
];

// Initial Realistic Journal Entries
export const DEFAULT_JOURNAL_ENTRIES: JournalEntry[] = [];

// Load Chart of Accounts
export function loadChartOfAccounts(): Account[] {
  if (typeof window === 'undefined') return DEFAULT_ACCOUNTS;
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(DEFAULT_ACCOUNTS));
      return DEFAULT_ACCOUNTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const existingIds = new Set(parsed.map((a: Account) => a.id));
      const existingCodes = new Set(parsed.map((a: Account) => a.code));
      const missingAccounts = DEFAULT_ACCOUNTS.filter(a => !existingIds.has(a.id) && !existingCodes.has(a.code));
      const combined = [...parsed, ...missingAccounts];

      // Ensure control account flags for 1201 and 2101 if missing in stored data
      return combined.map((acc: Account) => {
        if (acc.code === '1201' || acc.id === 'acc-1201') {
          return {
            ...acc,
            isControlAccount: true,
            controlType: 'CUSTOMER' as const
          };
        }
        if (acc.code === '2101' || acc.id === 'acc-2101') {
          return {
            ...acc,
            isControlAccount: true,
            controlType: 'VENDOR' as const
          };
        }
        return acc;
      });
    }
    return DEFAULT_ACCOUNTS;
  } catch (e) {
    console.error("Failed loading COA:", e);
    return DEFAULT_ACCOUNTS;
  }
}

// Save Chart of Accounts
export function saveChartOfAccounts(accounts: Account[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
    window.dispatchEvent(new Event('alpha-chart-of-accounts-updated'));
  } catch (e) {
    console.error("Failed saving COA:", e);
  }
}

// Load Journal Entries
export function loadJournalEntries(): JournalEntry[] {
  if (typeof window === 'undefined') return DEFAULT_JOURNAL_ENTRIES;
  try {
    const raw = localStorage.getItem(JOURNAL_ENTRIES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(JOURNAL_ENTRIES_STORAGE_KEY, JSON.stringify(DEFAULT_JOURNAL_ENTRIES));
      return DEFAULT_JOURNAL_ENTRIES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_JOURNAL_ENTRIES;
  } catch (e) {
    console.error("Failed loading journal entries:", e);
    return DEFAULT_JOURNAL_ENTRIES;
  }
}

// Save a single Journal Entry
export function saveJournalEntry(entry: JournalEntry): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadJournalEntries();
    const updated = [entry, ...existing.filter(e => e.id !== entry.id)];
    localStorage.setItem(JOURNAL_ENTRIES_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('alpha-journal-entries-updated'));
  } catch (e) {
    console.error("Failed saving journal entry:", e);
  }
}

// Delete a Journal Entry
export function deleteJournalEntry(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadJournalEntries();
    const updated = existing.filter(e => e.id !== id);
    localStorage.setItem(JOURNAL_ENTRIES_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('alpha-journal-entries-updated'));
  } catch (e) {
    console.error("Failed deleting journal entry:", e);
  }
}

export interface TrialBalanceRow {
  account: Account;
  openingDebit: number;
  openingCredit: number;
  debitMovement: number;
  creditMovement: number;
  totalDebit: number;
  totalCredit: number;
  endingDebit: number;
  endingCredit: number;
  netMovement: number;
}

// Structure for Ledger Item (Detail Movement modal)
export interface AccountLedgerItem {
  id: string;
  date: string;
  entryNumber: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  balanceType: 'DEBIT' | 'CREDIT' | 'ZERO';
  source: 'JOURNAL' | 'SALES' | 'PURCHASE' | 'RECEIPT' | 'PAYMENT' | 'INTERNAL' | 'PAYROLL' | 'INVENTORY_AUDIT' | 'MANUFACTURING' | 'INSTALLMENT';
  sourceLabel: string;
  sourceView: string;
  sourceModule?: string;
}

// Constants for storage keys
export const STORAGE_KEY_INVENTORY_AUDITS = 'alpha_inventory_audits_v1';
export const STORAGE_KEY_EMPLOYEES = 'alpha_accounting_employees_v1';
export const STORAGE_KEY_WORK_ORDERS = 'alpha_accounting_work_orders_v1';
export const STORAGE_KEY_PROMISSORY_NOTES = 'alpha_accounting_promissory_notes_v1';

/**
 * Calculates complete Trial Balance dynamically by aggregating:
 * 1. Posted Manual Journal Entries
 * 2. Operational Invoices & Vouchers (Sales, Purchases, Receipts, Payments, Internal)
 * 3. Inventory Audits & Settlements (Gains/Deficits)
 * 4. Payroll & Salaries
 * 5. Manufacturing Work Orders
 * 6. Installments & Promissory Notes
 */
export function calculateTrialBalance(
  startDate?: string,
  endDate?: string,
  accountTypeFilter: string = 'ALL',
  hideZeroBalances: boolean = false
): {
  rows: TrialBalanceRow[];
  totals: {
    totalOpeningDebit: number;
    totalOpeningCredit: number;
    totalDebitMovement: number;
    totalCreditMovement: number;
    totalEndingDebit: number;
    totalEndingCredit: number;
    isBalanced: boolean;
    difference: number;
    activeAccountsCount: number;
  };
} {
  const accounts = loadChartOfAccounts();
  const entries = loadJournalEntries();

  // Create an aggregation map per account ID and Code
  interface MovementRecord {
    debitMovement: number;
    creditMovement: number;
  }
  const map = new Map<string, MovementRecord>();
  
  accounts.forEach(acc => {
    const rec: MovementRecord = { debitMovement: 0, creditMovement: 0 };
    map.set(acc.id, rec);
    map.set(acc.code, rec);
  });

  const addMovement = (accIdOrCode: string | undefined, debit: number, credit: number) => {
    if (!accIdOrCode) return;
    const rec = map.get(accIdOrCode);
    if (rec) {
      rec.debitMovement += (Number(debit) || 0);
      rec.creditMovement += (Number(credit) || 0);
    }
  };

  // Helper to test if date is within range
  const isInRange = (dStr: string) => {
    if (!dStr) return true;
    if (startDate && dStr < startDate) return false;
    if (endDate && dStr > endDate) return false;
    return true;
  };

  // 1. Process Manual Journal Entries
  entries.forEach(entry => {
    if (entry.status !== JournalEntryStatus.Posted) return;
    if (!isInRange(entry.date)) return;

    entry.items.forEach(item => {
      const acc = accounts.find(a => a.id === item.accountId || a.code === item.accountId);
      if (acc) {
        addMovement(acc.id, Number(item.debit) || 0, Number(item.credit) || 0);
      }
    });
  });

  // 2. Process Sales Invoices
  try {
    const salesRaw = localStorage.getItem(DB_SALES_INVOICES_KEY);
    if (salesRaw) {
      const salesInvoices = JSON.parse(salesRaw);
      if (Array.isArray(salesInvoices)) {
        salesInvoices.forEach(inv => {
          if (inv.status === 'POSTED' && isInRange(inv.date)) {
            const grandTotal = Number(inv.totals?.grandTotal ?? inv.grandTotal) || 0;
            const subtotal = Number(inv.totals?.subtotal ?? inv.subtotal) || 0;
            const taxTotal = Number(inv.totals?.taxTotal ?? inv.taxTotal) || 0;
            const discountTotal = Number(inv.totals?.discountTotal ?? inv.discountTotal) || 0;

            // Debit Customer (1201) or Cash (1101) if cash invoice
            const isCashInvoice = inv.paymentType === 'CASH' || inv.paymentType === 'كاش' || inv.paymentMethod === 'CASH';
            const debitAccountCode = isCashInvoice ? '1101' : '1201';
            const targetAcc = accounts.find(a => a.code === debitAccountCode) || accounts.find(a => a.code === '1201');
            if (targetAcc) addMovement(targetAcc.id, grandTotal, 0);

            // Debit Discount Allowed (4103) if discount was granted
            const discountAllowedAcc = accounts.find(a => a.code === '4103');
            if (discountAllowedAcc && discountTotal > 0) {
              addMovement(discountAllowedAcc.id, discountTotal, 0);
            }

            // Credit Sales Revenue (4101)
            // If separate discount allowed account exists, credit gross subtotal; otherwise credit net (subtotal - discountTotal)
            const revAcc = accounts.find(a => a.code === '4101');
            if (revAcc) {
              if (discountAllowedAcc && discountTotal > 0) {
                addMovement(revAcc.id, 0, subtotal);
              } else {
                addMovement(revAcc.id, 0, subtotal - discountTotal);
              }
            }

            // Credit VAT Payable (2102)
            if (taxTotal > 0) {
              const vatAcc = accounts.find(a => a.code === '2102');
              if (vatAcc) addMovement(vatAcc.id, 0, taxTotal);
            }
          }
        });
      }
    }
  } catch (e) {
    console.error("Trial balance sales aggregation error:", e);
  }

  // 3. Process Purchase Invoices
  try {
    const purchRaw = localStorage.getItem(DB_PURCHASES_INVOICES_KEY);
    if (purchRaw) {
      const purchInvoices = JSON.parse(purchRaw);
      if (Array.isArray(purchInvoices)) {
        purchInvoices.forEach(inv => {
          if (inv.status === 'POSTED' && isInRange(inv.date)) {
            const grandTotal = Number(inv.totals?.grandTotal ?? inv.grandTotal) || 0;
            const subtotal = Number(inv.totals?.subtotal ?? inv.subtotal) || 0;
            const taxTotal = Number(inv.totals?.taxTotal ?? inv.taxTotal) || 0;
            const discountTotal = Number(inv.totals?.discountTotal ?? inv.discountTotal) || 0;

            // Debit Inventory (1301)
            const invAcc = accounts.find(a => a.code === '1301');
            const discountReceivedAcc = accounts.find(a => a.code === '4203');

            if (invAcc) {
              if (discountReceivedAcc && discountTotal > 0) {
                addMovement(invAcc.id, subtotal + taxTotal, 0);
              } else {
                addMovement(invAcc.id, (subtotal + taxTotal) - discountTotal, 0);
              }
            }

            // Credit Vendor (2101) or Cash (1101)
            const isCashInvoice = inv.paymentType === 'CASH' || inv.paymentType === 'كاش';
            const creditAccountCode = isCashInvoice ? '1101' : '2101';
            const vendorAcc = accounts.find(a => a.code === creditAccountCode) || accounts.find(a => a.code === '2101');
            if (vendorAcc) addMovement(vendorAcc.id, 0, grandTotal);

            // Credit Earned Discount (4203)
            if (discountReceivedAcc && discountTotal > 0) {
              addMovement(discountReceivedAcc.id, 0, discountTotal);
            }
          }
        });
      }
    }
  } catch (e) {
    console.error("Trial balance purchases aggregation error:", e);
  }

  // 4. Process External Receipt Vouchers (POSTED only)
  try {
    const recRaw = localStorage.getItem(DB_RECEIPT_VOUCHERS_KEY);
    if (recRaw) {
      const recVouchers = JSON.parse(recRaw);
      if (Array.isArray(recVouchers)) {
        recVouchers.forEach(v => {
          if (v.status === 'POSTED' && isInRange(v.date)) {
            const amt = Number(v.amount) || 0;
            if (amt > 0) {
              const isCheck = v.paymentMethod === 'CHECK';
              const matchedAcc = accounts.find(a => a.id === v.accountId || a.code === v.accountId);
              const isBank = v.accountId === 'bank' || v.accountId === 'bank1' || v.accountId === 'acc-1102' || v.paymentMethod === 'BANK' || v.paymentMethod === 'BANK_TRANSFER' || v.paymentMethod === 'TRANSFER';
              const chqAcc = accounts.find(a => a.code === '1104');
              const cashOrBank = isCheck ? (chqAcc || accounts.find(a => a.code === '1101')) : (matchedAcc || accounts.find(a => a.code === (isBank ? '1102' : '1101')));
              if (cashOrBank) addMovement(cashOrBank.id, amt, 0);

              const isVendor = v.partnerType === 'VENDOR';
              const partnerAcc = accounts.find(a => a.code === (isVendor ? '2101' : '1201'));
              if (partnerAcc) addMovement(partnerAcc.id, 0, amt);
            }
          }
        });
      }
    }
  } catch (e) {
    console.error("Trial balance receipt vouchers error:", e);
  }

  // 5. Process External Payment Vouchers (POSTED only)
  try {
    const payRaw = localStorage.getItem(DB_PAYMENT_VOUCHERS_KEY);
    if (payRaw) {
      const payVouchers = JSON.parse(payRaw);
      if (Array.isArray(payVouchers)) {
        payVouchers.forEach(v => {
          if (v.status === 'POSTED' && isInRange(v.date)) {
            const amt = Number(v.amount) || 0;
            if (amt > 0) {
              const isCustomer = v.partnerType === 'CUSTOMER';
              const partnerAcc = accounts.find(a => a.code === (isCustomer ? '1201' : '2101'));
              if (partnerAcc) addMovement(partnerAcc.id, amt, 0);

              const isCheck = v.paymentMethod === 'CHECK';
              const matchedAcc = accounts.find(a => a.id === v.accountId || a.code === v.accountId);
              const isBank = v.accountId === 'bank' || v.accountId === 'bank1' || v.accountId === 'acc-1102' || v.paymentMethod === 'BANK' || v.paymentMethod === 'BANK_TRANSFER' || v.paymentMethod === 'TRANSFER';
              const chqPayAcc = accounts.find(a => a.code === '2104');
              const cashOrBank = isCheck ? (chqPayAcc || accounts.find(a => a.code === '1101')) : (matchedAcc || accounts.find(a => a.code === (isBank ? '1102' : '1101')));
              if (cashOrBank) addMovement(cashOrBank.id, 0, amt);
            }
          }
        });
      }
    }
  } catch (e) {
    console.error("Trial balance payment vouchers error:", e);
  }

  // 6. Process Internal Receipt Vouchers (POSTED only)
  try {
    const intRecRaw = localStorage.getItem(DB_INTERNAL_RECEIPT_VOUCHERS_KEY);
    if (intRecRaw) {
      const intRecVouchers = JSON.parse(intRecRaw);
      if (Array.isArray(intRecVouchers)) {
        intRecVouchers.forEach(v => {
          if (v.status === 'POSTED' && isInRange(v.date)) {
            const amt = Number(v.amount) || 0;
            if (amt > 0) {
              const isBank = v.toAccountId && (v.toAccountId.includes('bank') || v.toAccountId === 'acc-1102');
              const targetAcc = accounts.find(a => a.id === v.toAccountId || a.code === v.toAccountId)
                || accounts.find(a => a.code === (isBank ? '1102' : '1101'));
              if (targetAcc) addMovement(targetAcc.id, amt, 0);

              // If internal transfer between two accounts
              if (v.fromAccountId && (v.sourceType === 'bank_to_cash' || v.sourceType === 'transfer_in')) {
                const isFromBank = v.fromAccountId.includes('bank') || v.fromAccountId === 'acc-1102';
                const fromAcc = accounts.find(a => a.id === v.fromAccountId || a.code === v.fromAccountId)
                  || accounts.find(a => a.code === (isFromBank ? '1102' : '1101'));
                if (fromAcc) addMovement(fromAcc.id, 0, amt);
              } else {
                const otherRev = accounts.find(a => a.code === '4201') || accounts.find(a => a.code === '4101');
                if (otherRev) addMovement(otherRev.id, 0, amt);
              }
            }
          }
        });
      }
    }
  } catch (e) {
    console.error("Trial balance internal receipts error:", e);
  }

  // 7. Process Internal Payment Vouchers (POSTED only)
  try {
    const intPayRaw = localStorage.getItem(DB_INTERNAL_PAYMENT_VOUCHERS_KEY);
    if (intPayRaw) {
      const intPayVouchers = JSON.parse(intPayRaw);
      if (Array.isArray(intPayVouchers)) {
        intPayVouchers.forEach(v => {
          if (v.status === 'POSTED' && isInRange(v.date)) {
            const amt = Number(v.amount) || 0;
            if (amt > 0) {
              const isBank = v.fromAccountId && (v.fromAccountId.includes('bank') || v.fromAccountId === 'acc-1102');
              const sourceAcc = accounts.find(a => a.id === v.fromAccountId || a.code === v.fromAccountId)
                || accounts.find(a => a.code === (isBank ? '1102' : '1101'));
              if (sourceAcc) addMovement(sourceAcc.id, 0, amt);

              // If internal transfer between accounts (e.g. deposit cash to bank)
              if (v.toAccountId && (v.expenseType === 'cash_to_bank' || v.expenseType === 'branch_feed')) {
                const isToBank = v.toAccountId.includes('bank') || v.toAccountId === 'acc-1102';
                const toAcc = accounts.find(a => a.id === v.toAccountId || a.code === v.toAccountId)
                  || accounts.find(a => a.code === (isToBank ? '1102' : '1101'));
                if (toAcc) addMovement(toAcc.id, amt, 0);
              } else {
                let expCode = '5104';
                if (v.expenseType === 'advance_salary' || v.expenseType === 'salary') expCode = '5102';
                else if (v.expenseType === 'rent') expCode = '5103';
                else if (v.expenseType === 'utility' || v.expenseType === 'electricity') expCode = '5105';
                else if (v.expenseType === 'marketing') expCode = '5106';

                const expAcc = accounts.find(a => a.code === expCode) || accounts.find(a => a.code === '5104');
                if (expAcc) addMovement(expAcc.id, amt, 0);
              }
            }
          }
        });
      }
    }
  } catch (e) {
    console.error("Trial balance internal payments error:", e);
  }

  // 8. Process Internal Transfer Vouchers (POSTED only)
  try {
    const intVouchRaw = localStorage.getItem(DB_INTERNAL_VOUCHERS_KEY);
    if (intVouchRaw) {
      const intVouchers = JSON.parse(intVouchRaw);
      if (Array.isArray(intVouchers)) {
        intVouchers.forEach(v => {
          if (v.status === 'POSTED' && isInRange(v.date)) {
            const amt = Number(v.amount) || 0;
            if (amt > 0) {
              const isToBank = v.toAccountId && (v.toAccountId.includes('bank') || v.toAccountId === 'acc-1102');
              const toAcc = accounts.find(a => a.id === v.toAccountId || a.code === v.toAccountId)
                || accounts.find(a => a.code === (isToBank ? '1102' : '1101'));
              if (toAcc) addMovement(toAcc.id, amt, 0);

              const isFromBank = v.fromAccountId && (v.fromAccountId.includes('bank') || v.fromAccountId === 'acc-1102');
              const fromAcc = accounts.find(a => a.id === v.fromAccountId || a.code === v.fromAccountId)
                || accounts.find(a => a.code === (isFromBank ? '1102' : '1101'));
              if (fromAcc) addMovement(fromAcc.id, 0, amt);
            }
          }
        });
      }
    }
  } catch (e) {
    console.error("Trial balance internal transfers error:", e);
  }

  // 9. Process Inventory Audits & Settlements (APPROVED audits)
  try {
    const auditRaw = localStorage.getItem(STORAGE_KEY_INVENTORY_AUDITS);
    if (auditRaw) {
      const audits = JSON.parse(auditRaw);
      if (Array.isArray(audits)) {
        audits.forEach(audit => {
          if (audit.status === 'APPROVED' && isInRange(audit.auditDate)) {
            const invAcc = accounts.find(a => a.code === '1301');
            const gainAcc = accounts.find(a => a.code === '4202');
            const lossAcc = accounts.find(a => a.code === '5107');

            audit.items?.forEach((item: any) => {
              const varianceVal = Number(item.varianceValue) || 0;
              if (varianceVal > 0) {
                // Surplus: Debit Inventory 1301, Credit Inventory Gain 4202
                if (invAcc) addMovement(invAcc.id, varianceVal, 0);
                if (gainAcc) addMovement(gainAcc.id, 0, varianceVal);
              } else if (varianceVal < 0) {
                // Deficit: Debit Inventory Loss 5107, Credit Inventory 1301
                const absLoss = Math.abs(varianceVal);
                if (lossAcc) addMovement(lossAcc.id, absLoss, 0);
                if (invAcc) addMovement(invAcc.id, 0, absLoss);
              }
            });
          }
        });
      }
    }
  } catch (e) {
    console.error("Trial balance inventory audits aggregation error:", e);
  }

  // --- Rollup Calculation ---
  // Ensure parent accounts reflect the sum of their children
  // We sort accounts by code length descending to process children before parents
  const sortedAccounts = [...accounts].sort((a, b) => b.code.length - a.code.length);
  sortedAccounts.forEach(acc => {
    // find parent
    const parent = accounts.find(a => a.id === acc.parentId || (acc.code.length > 1 && a.code === acc.code.substring(0, acc.code.length - (acc.code.length % 2 === 0 ? 2 : 1)))); // Fallback for code-based hierarchy
    if (parent && parent.id !== acc.id) {
      const childRec = map.get(acc.id) || { debitMovement: 0, creditMovement: 0 };
      const parentRec = map.get(parent.id) || { debitMovement: 0, creditMovement: 0 };
      parentRec.debitMovement += childRec.debitMovement;
      parentRec.creditMovement += childRec.creditMovement;
      map.set(parent.id, parentRec);
      map.set(parent.code, parentRec);
    }
  });

  // Build rows per account
  let rows: TrialBalanceRow[] = accounts.map(account => {
    const mov = map.get(account.id) || { debitMovement: 0, creditMovement: 0 };
    
    // Calculate total debit & credit
    const totalDebit = mov.debitMovement;
    const totalCredit = mov.creditMovement;
    const net = totalDebit - totalCredit;

    let endingDebit = 0;
    let endingCredit = 0;

    if (net > 0) {
      endingDebit = net;
    } else if (net < 0) {
      endingCredit = Math.abs(net);
    }

    return {
      account,
      openingDebit: 0,
      openingCredit: 0,
      debitMovement: Math.round(mov.debitMovement * 100) / 100,
      creditMovement: Math.round(mov.creditMovement * 100) / 100,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      endingDebit: Math.round(endingDebit * 100) / 100,
      endingCredit: Math.round(endingCredit * 100) / 100,
      netMovement: Math.round(net * 100) / 100,
    };
  });

  // Apply Account Type Filter
  if (accountTypeFilter === 'DISCOUNTS') {
    rows = rows.filter(r => r.account.code === '4103' || r.account.code === '4203');
  } else if (accountTypeFilter !== 'ALL') {
    rows = rows.filter(r => r.account.type === accountTypeFilter);
  }

  // Apply Hide Zero Balances Filter
  if (hideZeroBalances) {
    rows = rows.filter(r => 
      r.debitMovement > 0 || 
      r.creditMovement > 0 || 
      r.endingDebit > 0 || 
      r.endingCredit > 0
    );
  }

  // Compute grand totals
  let totalOpeningDebit = 0;
  let totalOpeningCredit = 0;
  let totalDebitMovement = 0;
  let totalCreditMovement = 0;
  let totalEndingDebit = 0;
  let totalEndingCredit = 0;

  // Grand totals must be calculated ONLY from leaf accounts to avoid double counting after rollup
  const leafRows = rows.filter(r => !accounts.some(a => a.parentId === r.account.id || (a.code.length > r.account.code.length && a.code.startsWith(r.account.code))));
  
  leafRows.forEach(r => {
    totalOpeningDebit += r.openingDebit;
    totalOpeningCredit += r.openingCredit;
    totalDebitMovement += r.debitMovement;
    totalCreditMovement += r.creditMovement;
    totalEndingDebit += r.endingDebit;
    totalEndingCredit += r.endingCredit;
  });

  totalOpeningDebit = Math.round(totalOpeningDebit * 100) / 100;
  totalOpeningCredit = Math.round(totalOpeningCredit * 100) / 100;
  totalDebitMovement = Math.round(totalDebitMovement * 100) / 100;
  totalCreditMovement = Math.round(totalCreditMovement * 100) / 100;
  totalEndingDebit = Math.round(totalEndingDebit * 100) / 100;
  totalEndingCredit = Math.round(totalEndingCredit * 100) / 100;

  const diff = Math.round((totalEndingDebit - totalEndingCredit) * 100) / 100;
  const isBalanced = Math.abs(diff) < 0.01;

  return {
    rows,
    totals: {
      totalOpeningDebit,
      totalOpeningCredit,
      totalDebitMovement,
      totalCreditMovement,
      totalEndingDebit,
      totalEndingCredit,
      isBalanced,
      difference: diff,
      activeAccountsCount: rows.length
    }
  };
}

/**
 * Gets ledger movement details for a specific account from ALL modules
 */
export function getAccountLedgerMovements(
  accountId: string,
  startDate?: string,
  endDate?: string
): AccountLedgerItem[] {
  const accounts = loadChartOfAccounts();
  const account = accounts.find(a => a.id === accountId || a.code === accountId);
  if (!account) return [];

  const items: AccountLedgerItem[] = [];
  const isInRange = (dStr: string) => {
    if (!dStr) return true;
    if (startDate && dStr < startDate) return false;
    if (endDate && dStr > endDate) return false;
    return true;
  };

  const code = account.code;

  // 1. Manual Journal Entries
  const entries = loadJournalEntries();
  entries.forEach(entry => {
    if (entry.status !== JournalEntryStatus.Posted) return;
    if (!isInRange(entry.date)) return;

    entry.items.forEach(ji => {
      if (ji.accountId === account.id || ji.accountId === code) {
        const d = Number(ji.debit) || 0;
        const c = Number(ji.credit) || 0;
        if (d > 0 || c > 0) {
          items.push({
            id: ji.id || `ji-${Math.random()}`,
            date: entry.date,
            entryNumber: entry.entryNumber || 'JV-000',
            reference: entry.reference || '-',
            description: entry.description || 'قيد يومية يدوي',
            debit: d,
            credit: c,
            runningBalance: 0,
            balanceType: 'ZERO',
            source: 'JOURNAL',
            sourceLabel: 'قيد يومية',
            sourceView: 'journal'
          });
        }
      }
    });
  });

  // 2. Sales Invoices
  try {
    const salesRaw = localStorage.getItem(DB_SALES_INVOICES_KEY);
    if (salesRaw) {
      const invoices = JSON.parse(salesRaw);
      if (Array.isArray(invoices)) {
        invoices.forEach(inv => {
          if (inv.status === 'POSTED' && isInRange(inv.date)) {
            const grandTotal = Number(inv.totals?.grandTotal ?? inv.grandTotal) || 0;
            const subtotal = Number(inv.totals?.subtotal ?? inv.subtotal) || 0;
            const taxTotal = Number(inv.totals?.taxTotal ?? inv.taxTotal) || 0;
            const discountTotal = Number(inv.totals?.discountTotal ?? inv.discountTotal) || 0;
            const isCash = inv.paymentType === 'CASH' || inv.paymentType === 'كاش' || inv.paymentMethod === 'CASH';

            // Customer AR (1201) or Cash (1101)
            if ((code === '1201' && !isCash) || (code === '1101' && isCash)) {
              items.push({
                id: `sales-ar-${inv.id}`,
                date: inv.date,
                entryNumber: inv.invoiceNumber || inv.id,
                reference: inv.customerName || 'عميل نقدي',
                description: `فاتورة مبيعات ${inv.invoiceNumber} للعميل: ${inv.customerName || 'نقدي'}`,
                debit: grandTotal,
                credit: 0,
                runningBalance: 0,
                balanceType: 'DEBIT',
                source: 'SALES',
                sourceLabel: 'فاتورة مبيعات',
                sourceView: 'sales'
              });
            }

            // Sales Revenue (4101)
            if (code === '4101') {
              items.push({
                id: `sales-rev-${inv.id}`,
                date: inv.date,
                entryNumber: inv.invoiceNumber || inv.id,
                reference: inv.customerName || '-',
                description: `إيراد مبيعات فاتورة رقم ${inv.invoiceNumber}${discountTotal > 0 ? ' (إجمالي قبل الخصم)' : ''}`,
                debit: 0,
                credit: discountTotal > 0 ? subtotal : (subtotal - discountTotal),
                runningBalance: 0,
                balanceType: 'CREDIT',
                source: 'SALES',
                sourceLabel: 'إيرادات مبيعات',
                sourceView: 'sales',
                sourceModule: 'فواتير المبيعات'
              });
            }

            // Discount Allowed (4103) - الخصم المسموح به (مدين)
            if (code === '4103' && discountTotal > 0) {
              items.push({
                id: `sales-disc-${inv.id}`,
                date: inv.date,
                entryNumber: inv.invoiceNumber || inv.id,
                reference: inv.customerName || '-',
                description: `خصم مسموح به (ممنوح للعميل) فاتورة مبيعات ${inv.invoiceNumber} - ${inv.customerName || 'نقدي'}`,
                debit: discountTotal,
                credit: 0,
                runningBalance: 0,
                balanceType: 'DEBIT',
                source: 'SALES',
                sourceLabel: 'خصم مسموح به',
                sourceView: 'sales',
                sourceModule: 'فواتير المبيعات'
              });
            }

            // VAT (2102)
            if (code === '2102' && taxTotal > 0) {
              const rateLabel = (inv.taxRate !== undefined && inv.taxRate > 0) ? `${inv.taxRate}%` : '';
              items.push({
                id: `sales-vat-${inv.id}`,
                date: inv.date,
                entryNumber: inv.invoiceNumber || inv.id,
                reference: inv.customerName || '-',
                description: `ضريبة مخرجات ${rateLabel ? `(${rateLabel}) ` : ''}لفاتورة مبيعات ${inv.invoiceNumber}`,
                debit: 0,
                credit: taxTotal,
                runningBalance: 0,
                balanceType: 'CREDIT',
                source: 'SALES',
                sourceLabel: 'ضريبة مبيعات',
                sourceView: 'sales',
                sourceModule: 'فواتير المبيعات'
              });
            }
          }
        });
      }
    }
  } catch (e) {
    console.error("Sales ledger parsing error:", e);
  }

  // 3. Purchase Invoices
  try {
    const purchRaw = localStorage.getItem(DB_PURCHASES_INVOICES_KEY);
    if (purchRaw) {
      const invoices = JSON.parse(purchRaw);
      if (Array.isArray(invoices)) {
        invoices.forEach(inv => {
          if (inv.status === 'POSTED' && isInRange(inv.date)) {
            const grandTotal = Number(inv.totals?.grandTotal ?? inv.grandTotal) || 0;
            const subtotal = Number(inv.totals?.subtotal ?? inv.subtotal) || 0;
            const taxTotal = Number(inv.totals?.taxTotal ?? inv.taxTotal) || 0;
            const discountTotal = Number(inv.totals?.discountTotal ?? inv.discountTotal) || 0;
            const isCash = inv.paymentType === 'CASH' || inv.paymentType === 'كاش';

            // Inventory (1301)
            if (code === '1301') {
              items.push({
                id: `purch-inv-${inv.id}`,
                date: inv.date,
                entryNumber: inv.invoiceNumber || inv.id,
                reference: inv.vendorName || '-',
                description: `إضافة مخزون مشتريات فاتورة ${inv.invoiceNumber} من ${inv.vendorName || 'مورد'}`,
                debit: discountTotal > 0 ? (subtotal + taxTotal) : ((subtotal + taxTotal) - discountTotal),
                credit: 0,
                runningBalance: 0,
                balanceType: 'DEBIT',
                source: 'PURCHASE',
                sourceLabel: 'فاتورة مشتريات',
                sourceView: 'purchases',
                sourceModule: 'فواتير المشتريات'
              });
            }

            // Vendor AP (2101) or Cash (1101)
            if ((code === '2101' && !isCash) || (code === '1101' && isCash)) {
              items.push({
                id: `purch-ap-${inv.id}`,
                date: inv.date,
                entryNumber: inv.invoiceNumber || inv.id,
                reference: inv.vendorName || '-',
                description: `استحقاق فاتورة مشتريات ${inv.invoiceNumber} للمورد ${inv.vendorName || ''}`,
                debit: 0,
                credit: grandTotal,
                runningBalance: 0,
                balanceType: 'CREDIT',
                source: 'PURCHASE',
                sourceLabel: 'فاتورة مشتريات',
                sourceView: 'purchases',
                sourceModule: 'فواتير المشتريات'
              });
            }

            // Discount Received / Earned (4203) - الخصم المكتسب (دائن)
            if (code === '4203' && discountTotal > 0) {
              items.push({
                id: `purch-disc-${inv.id}`,
                date: inv.date,
                entryNumber: inv.invoiceNumber || inv.id,
                reference: inv.vendorName || '-',
                description: `خصم مكتسب من المورد لفاتورة مشتريات ${inv.invoiceNumber} - ${inv.vendorName || 'مورد'}`,
                debit: 0,
                credit: discountTotal,
                runningBalance: 0,
                balanceType: 'CREDIT',
                source: 'PURCHASE',
                sourceLabel: 'خصم مكتسب',
                sourceView: 'purchases',
                sourceModule: 'فواتير المشتريات'
              });
            }
          }
        });
      }
    }
  } catch (e) {
    console.error("Purchases ledger parsing error:", e);
  }

  // 4. External Receipt Vouchers
  try {
    const recRaw = localStorage.getItem(DB_RECEIPT_VOUCHERS_KEY);
    if (recRaw) {
      const vouchers = JSON.parse(recRaw);
      if (Array.isArray(vouchers)) {
        vouchers.forEach(v => {
          if (v.status === 'POSTED' && isInRange(v.date)) {
            const amt = Number(v.amount) || 0;
            const matchedAcc = accounts.find(a => a.id === v.accountId || a.code === v.accountId);
            const isBank = v.accountId === 'bank' || v.accountId === 'bank1' || v.accountId === 'acc-1102' || v.paymentMethod === 'BANK' || v.paymentMethod === 'BANK_TRANSFER' || v.paymentMethod === 'TRANSFER';
            const isVendor = v.partnerType === 'VENDOR';

            const isMatchedCashOrBank = matchedAcc ? matchedAcc.code === code : ((code === '1102' && isBank) || (code === '1101' && !isBank));

            if (isMatchedCashOrBank) {
              items.push({
                id: `rec-cash-${v.id}`,
                date: v.date,
                entryNumber: v.voucherNumber || v.id,
                reference: v.partnerName || '-',
                description: `سند قبض خارجي ${v.voucherNumber} من: ${v.partnerName || ''}`,
                debit: amt,
                credit: 0,
                runningBalance: 0,
                balanceType: 'DEBIT',
                source: 'RECEIPT',
                sourceLabel: 'سند قبض',
                sourceView: 'externalReceipt'
              });
            }

            if ((code === '2101' && isVendor) || (code === '1201' && !isVendor)) {
              items.push({
                id: `rec-partner-${v.id}`,
                date: v.date,
                entryNumber: v.voucherNumber || v.id,
                reference: v.partnerName || '-',
                description: `سداد بسند قبض خارجي ${v.voucherNumber} من: ${v.partnerName || ''}`,
                debit: 0,
                credit: amt,
                runningBalance: 0,
                balanceType: 'CREDIT',
                source: 'RECEIPT',
                sourceLabel: 'سند قبض',
                sourceView: 'externalReceipt'
              });
            }
          }
        });
      }
    }
  } catch (e) {
    console.error("Receipt voucher ledger error:", e);
  }

  // 5. External Payment Vouchers
  try {
    const payRaw = localStorage.getItem(DB_PAYMENT_VOUCHERS_KEY);
    if (payRaw) {
      const vouchers = JSON.parse(payRaw);
      if (Array.isArray(vouchers)) {
        vouchers.forEach(v => {
          if (v.status === 'POSTED' && isInRange(v.date)) {
            const amt = Number(v.amount) || 0;
            const matchedAcc = accounts.find(a => a.id === v.accountId || a.code === v.accountId);
            const isBank = v.accountId === 'bank' || v.accountId === 'bank1' || v.accountId === 'acc-1102' || v.paymentMethod === 'BANK' || v.paymentMethod === 'BANK_TRANSFER' || v.paymentMethod === 'TRANSFER';
            const isCustomer = v.partnerType === 'CUSTOMER';

            if ((code === '1201' && isCustomer) || (code === '2101' && !isCustomer)) {
              items.push({
                id: `pay-partner-${v.id}`,
                date: v.date,
                entryNumber: v.voucherNumber || v.id,
                reference: v.partnerName || '-',
                description: `سداد بسند صرف خارجي ${v.voucherNumber} إلى: ${v.partnerName || ''}`,
                debit: amt,
                credit: 0,
                runningBalance: 0,
                balanceType: 'DEBIT',
                source: 'PAYMENT',
                sourceLabel: 'سند صرف',
                sourceView: 'externalPayment'
              });
            }

            const isMatchedCashOrBank = matchedAcc ? matchedAcc.code === code : ((code === '1102' && isBank) || (code === '1101' && !isBank));

            if (isMatchedCashOrBank) {
              items.push({
                id: `pay-cash-${v.id}`,
                date: v.date,
                entryNumber: v.voucherNumber || v.id,
                reference: v.partnerName || '-',
                description: `سند صرف خارجي ${v.voucherNumber} إلى: ${v.partnerName || ''}`,
                debit: 0,
                credit: amt,
                runningBalance: 0,
                balanceType: 'CREDIT',
                source: 'PAYMENT',
                sourceLabel: 'سند صرف',
                sourceView: 'externalPayment'
              });
            }
          }
        });
      }
    }
  } catch (e) {
    console.error("Payment voucher ledger error:", e);
  }

  // 6. Internal Receipts & Payments
  try {
    // Internal Receipts
    const intRecRaw = localStorage.getItem(DB_INTERNAL_RECEIPT_VOUCHERS_KEY);
    if (intRecRaw) {
      const recList = JSON.parse(intRecRaw);
      if (Array.isArray(recList)) {
        recList.forEach(v => {
          if (v.status === 'POSTED' && isInRange(v.date)) {
            const amt = Number(v.amount) || 0;
            const isBank = v.toAccountId && (v.toAccountId.includes('bank') || v.toAccountId === 'acc-1102');
            const targetAcc = accounts.find(a => a.id === v.toAccountId || a.code === v.toAccountId)
              || accounts.find(a => a.code === (isBank ? '1102' : '1101'));

            // Entry in target account (Debit cash/bank)
            if (targetAcc && (targetAcc.id === accountId || targetAcc.code === code)) {
              items.push({
                id: `int-rec-dst-${v.id}`,
                date: v.date,
                entryNumber: v.voucherNumber || v.id,
                reference: v.receivedFrom || '-',
                description: `سند قبض داخلي رقم ${v.voucherNumber}: ${v.description || ''}`,
                debit: amt,
                credit: 0,
                runningBalance: 0,
                balanceType: 'DEBIT',
                source: 'INTERNAL',
                sourceLabel: 'قبض داخلي',
                sourceView: 'internalReceipt'
              });
            }

            // Entry in source/credit account
            if (v.fromAccountId && (v.sourceType === 'bank_to_cash' || v.sourceType === 'transfer_in')) {
              const isFromBank = v.fromAccountId.includes('bank') || v.fromAccountId === 'acc-1102';
              const fromAcc = accounts.find(a => a.id === v.fromAccountId || a.code === v.fromAccountId)
                || accounts.find(a => a.code === (isFromBank ? '1102' : '1101'));
              if (fromAcc && (fromAcc.id === accountId || fromAcc.code === code)) {
                items.push({
                  id: `int-rec-src-${v.id}`,
                  date: v.date,
                  entryNumber: v.voucherNumber || v.id,
                  reference: v.receivedFrom || '-',
                  description: `تحويل داخلي إلى ${targetAcc?.name || 'الخزينة'} بسند قبض ${v.voucherNumber}`,
                  debit: 0,
                  credit: amt,
                  runningBalance: 0,
                  balanceType: 'CREDIT',
                  source: 'INTERNAL',
                  sourceLabel: 'قبض داخلي',
                  sourceView: 'internalReceipt'
                });
              }
            } else if (code === '4201' || code === '4101') {
              items.push({
                id: `int-rec-rev-${v.id}`,
                date: v.date,
                entryNumber: v.voucherNumber || v.id,
                reference: v.receivedFrom || '-',
                description: `إيراد توريد داخلي بسند رقم ${v.voucherNumber}`,
                debit: 0,
                credit: amt,
                runningBalance: 0,
                balanceType: 'CREDIT',
                source: 'INTERNAL',
                sourceLabel: 'قبض داخلي',
                sourceView: 'internalReceipt'
              });
            }
          }
        });
      }
    }

    // Internal Payments
    const intPayRaw = localStorage.getItem(DB_INTERNAL_PAYMENT_VOUCHERS_KEY);
    if (intPayRaw) {
      const vList = JSON.parse(intPayRaw);
      if (Array.isArray(vList)) {
        vList.forEach(v => {
          if (v.status === 'POSTED' && isInRange(v.date)) {
            const amt = Number(v.amount) || 0;
            let expCode = '5104';
            if (v.expenseType === 'advance_salary' || v.expenseType === 'salary') expCode = '5102';
            else if (v.expenseType === 'rent') expCode = '5103';
            else if (v.expenseType === 'utility' || v.expenseType === 'electricity') expCode = '5105';
            else if (v.expenseType === 'marketing') expCode = '5106';

            if (code === expCode) {
              items.push({
                id: `int-pay-exp-${v.id}`,
                date: v.date,
                entryNumber: v.voucherNumber || v.id,
                reference: v.paidTo || v.recipientName || '-',
                description: `مصروف بسند صرف داخلي: ${v.description || v.expenseType || ''}`,
                debit: amt,
                credit: 0,
                runningBalance: 0,
                balanceType: 'DEBIT',
                source: 'INTERNAL',
                sourceLabel: 'صرف داخلي',
                sourceView: 'internalPayment'
              });
            }

            const isBank = v.fromAccountId && (v.fromAccountId.includes('bank') || v.fromAccountId === 'acc-1102');
            const sourceAcc = accounts.find(a => a.id === v.fromAccountId || a.code === v.fromAccountId)
              || accounts.find(a => a.code === (isBank ? '1102' : '1101'));

            if (sourceAcc && (sourceAcc.id === accountId || sourceAcc.code === code)) {
              items.push({
                id: `int-pay-src-${v.id}`,
                date: v.date,
                entryNumber: v.voucherNumber || v.id,
                reference: v.paidTo || v.recipientName || '-',
                description: `سند صرف داخلي رقم ${v.voucherNumber}: ${v.description || ''}`,
                debit: 0,
                credit: amt,
                runningBalance: 0,
                balanceType: 'CREDIT',
                source: 'INTERNAL',
                sourceLabel: 'صرف داخلي',
                sourceView: 'internalPayment'
              });
            }
          }
        });
      }
    }
  } catch (e) {
    console.error("Internal vouchers ledger error:", e);
  }

  // 7. Inventory Audits (Surplus / Deficit)
  try {
    const auditRaw = localStorage.getItem(STORAGE_KEY_INVENTORY_AUDITS);
    if (auditRaw) {
      const audits = JSON.parse(auditRaw);
      if (Array.isArray(audits)) {
        audits.forEach(audit => {
          if (audit.status === 'APPROVED' && isInRange(audit.auditDate)) {
            audit.items?.forEach((it: any) => {
              const val = Number(it.varianceValue) || 0;
              if (val > 0) {
                if (code === '1301') {
                  items.push({
                    id: `audit-gain-inv-${audit.id}-${it.itemId}`,
                    date: audit.auditDate,
                    entryNumber: audit.auditNumber || audit.id,
                    reference: audit.warehouseName || '-',
                    description: `تسوية جرد بزيادة مخزون للصنف ${it.itemName || ''}`,
                    debit: val,
                    credit: 0,
                    runningBalance: 0,
                    balanceType: 'DEBIT',
                    source: 'INVENTORY_AUDIT',
                    sourceLabel: 'جرد وتسوية',
                    sourceView: 'inventoryCount'
                  });
                }
                if (code === '4202') {
                  items.push({
                    id: `audit-gain-rev-${audit.id}-${it.itemId}`,
                    date: audit.auditDate,
                    entryNumber: audit.auditNumber || audit.id,
                    reference: audit.warehouseName || '-',
                    description: `أرباح وفروقات تسوية زيادة جرد للصنف ${it.itemName || ''}`,
                    debit: 0,
                    credit: val,
                    runningBalance: 0,
                    balanceType: 'CREDIT',
                    source: 'INVENTORY_AUDIT',
                    sourceLabel: 'جرد وتسوية',
                    sourceView: 'inventoryCount'
                  });
                }
              } else if (val < 0) {
                const absVal = Math.abs(val);
                if (code === '1301') {
                  items.push({
                    id: `audit-loss-inv-${audit.id}-${it.itemId}`,
                    date: audit.auditDate,
                    entryNumber: audit.auditNumber || audit.id,
                    reference: audit.warehouseName || '-',
                    description: `تسوية جرد بعجز مخزون للصنف ${it.itemName || ''}`,
                    debit: 0,
                    credit: absVal,
                    runningBalance: 0,
                    balanceType: 'CREDIT',
                    source: 'INVENTORY_AUDIT',
                    sourceLabel: 'جرد وتسوية',
                    sourceView: 'inventoryCount'
                  });
                }
                if (code === '5107') {
                  items.push({
                    id: `audit-loss-exp-${audit.id}-${it.itemId}`,
                    date: audit.auditDate,
                    entryNumber: audit.auditNumber || audit.id,
                    reference: audit.warehouseName || '-',
                    description: `خسائر وعجز تسوية جرد للصنف ${it.itemName || ''}`,
                    debit: absVal,
                    credit: 0,
                    runningBalance: 0,
                    balanceType: 'DEBIT',
                    source: 'INVENTORY_AUDIT',
                    sourceLabel: 'جرد وتسوية',
                    sourceView: 'inventoryCount'
                  });
                }
              }
            });
          }
        });
      }
    }
  } catch (e) {
    console.error("Audit ledger parsing error:", e);
  }

  // Sort by date ascending
  items.sort((a, b) => a.date.localeCompare(b.date));

  // Compute running balance
  let balance = 0;
  items.forEach(item => {
    balance += (item.debit - item.credit);
    item.runningBalance = Math.abs(Math.round(balance * 100) / 100);
    item.balanceType = balance > 0 ? 'DEBIT' : balance < 0 ? 'CREDIT' : 'ZERO';
  });

  return items;
}

/**
 * Returns a high-level cross-module reconciliation summary comparing
 * Trial Balance control accounts with Sub-Ledgers / Operational screens.
 */
export function getCrossModuleReconciliation() {
  const tb = calculateTrialBalance();

  // 1. Customers AR (1201)
  const arRow = tb.rows.find(r => r.account.code === '1201');
  const arBalance = arRow ? (arRow.endingDebit - arRow.endingCredit) : 0;

  // Calculate Customers sub-ledger balance
  let customersSubLedgerTotal = 0;
  try {
    const rawCust = localStorage.getItem('alpha_customers_v1') || localStorage.getItem('customers');
    if (rawCust) {
      const custs = JSON.parse(rawCust);
      if (Array.isArray(custs)) {
        customersSubLedgerTotal = custs.reduce((sum, c) => sum + (Number(c.currentBalance ?? c.balance) || 0), 0);
      }
    }
  } catch (e) {
    console.error("Failed calculating customer sub-ledger:", e);
  }

  // 2. Vendors AP (2101)
  const apRow = tb.rows.find(r => r.account.code === '2101');
  const apBalance = apRow ? (apRow.endingCredit - apRow.endingDebit) : 0;

  let vendorsSubLedgerTotal = 0;
  try {
    const rawVend = localStorage.getItem('alpha_vendors_v1') || localStorage.getItem('vendors');
    if (rawVend) {
      const vends = JSON.parse(rawVend);
      if (Array.isArray(vends)) {
        vendorsSubLedgerTotal = vends.reduce((sum, v) => sum + (Number(v.currentBalance ?? v.balance) || 0), 0);
      }
    }
  } catch (e) {
    console.error("Failed calculating vendor sub-ledger:", e);
  }

  // 3. Inventory (1301)
  const invRow = tb.rows.find(r => r.account.code === '1301');
  const invBalance = invRow ? (invRow.endingDebit - invRow.endingCredit) : 0;

  let warehouseValuationTotal = 0;
  try {
    const rawItems = localStorage.getItem('alpha_pos_items_v1');
    if (rawItems) {
      const itemsList = JSON.parse(rawItems);
      if (Array.isArray(itemsList)) {
        warehouseValuationTotal = itemsList.reduce((sum, it) => {
          const qty = Number(it.quantity || it.stock || 0);
          const cost = Number(it.costPrice || it.purchasePrice || it.price || 0);
          return sum + (qty * cost);
        }, 0);
      }
    }
  } catch (e) {
    console.error("Failed calculating inventory valuation:", e);
  }

  // 4. Cash in Hand (1101) & Bank (1102)
  const cashRow = tb.rows.find(r => r.account.code === '1101');
  const cashBalance = cashRow ? (cashRow.endingDebit - cashRow.endingCredit) : 0;

  const bankRow = tb.rows.find(r => r.account.code === '1102');
  const bankBalance = bankRow ? (bankRow.endingDebit - bankRow.endingCredit) : 0;

  return {
    isBalanced: tb.totals.isBalanced,
    difference: tb.totals.difference,
    totalDebitMovement: tb.totals.totalDebitMovement,
    totalCreditMovement: tb.totals.totalCreditMovement,
    totalEndingDebit: tb.totals.totalEndingDebit,
    totalEndingCredit: tb.totals.totalEndingCredit,
    ar: {
      accountBalance: arBalance,
      subLedgerTotal: customersSubLedgerTotal,
      diff: Math.abs(arBalance - customersSubLedgerTotal),
      isReconciled: Math.abs(arBalance - customersSubLedgerTotal) < 1
    },
    ap: {
      accountBalance: apBalance,
      subLedgerTotal: vendorsSubLedgerTotal,
      diff: Math.abs(apBalance - vendorsSubLedgerTotal),
      isReconciled: Math.abs(apBalance - vendorsSubLedgerTotal) < 1
    },
    inventory: {
      accountBalance: invBalance,
      valuationTotal: warehouseValuationTotal,
      diff: Math.abs(invBalance - warehouseValuationTotal),
      isReconciled: Math.abs(invBalance - warehouseValuationTotal) < 1
    },
    cash: {
      balance: cashBalance
    },
    bank: {
      balance: bankBalance
    }
  };
}

export interface DiscountsSummary {
  allowedDiscount: {
    account: Account | null;
    totalAmount: number;
    count: number;
  };
  earnedDiscount: {
    account: Account | null;
    totalAmount: number;
    count: number;
  };
  netDiscountImpact: number; // positive = net savings/income, negative = net promotional expense
}

/**
 * Summarizes commercial discounts (allowed on sales & earned on purchases) in trial balance
 */
export function getDiscountsSummary(): DiscountsSummary {
  const tb = calculateTrialBalance();
  const allowedRow = tb.rows.find(r => r.account.code === '4103');
  const earnedRow = tb.rows.find(r => r.account.code === '4203');

  const allowedTotal = allowedRow ? (allowedRow.endingDebit || allowedRow.debitMovement) : 0;
  const earnedTotal = earnedRow ? (earnedRow.endingCredit || earnedRow.creditMovement) : 0;

  // Count invoices with discounts
  let salesDiscountCount = 0;
  let purchDiscountCount = 0;

  try {
    const sRaw = localStorage.getItem(DB_SALES_INVOICES_KEY);
    if (sRaw) {
      const sInvoices = JSON.parse(sRaw);
      if (Array.isArray(sInvoices)) {
        salesDiscountCount = sInvoices.filter(i => i.status === 'POSTED' && Number(i.totals?.discountTotal ?? i.discountTotal) > 0).length;
      }
    }
  } catch (e) {}

  try {
    const pRaw = localStorage.getItem(DB_PURCHASES_INVOICES_KEY);
    if (pRaw) {
      const pInvoices = JSON.parse(pRaw);
      if (Array.isArray(pInvoices)) {
        purchDiscountCount = pInvoices.filter(i => i.status === 'POSTED' && Number(i.totals?.discountTotal ?? i.discountTotal) > 0).length;
      }
    }
  } catch (e) {}

  return {
    allowedDiscount: {
      account: allowedRow?.account || null,
      totalAmount: Math.round(allowedTotal * 100) / 100,
      count: salesDiscountCount
    },
    earnedDiscount: {
      account: earnedRow?.account || null,
      totalAmount: Math.round(earnedTotal * 100) / 100,
      count: purchDiscountCount
    },
    netDiscountImpact: Math.round((earnedTotal - allowedTotal) * 100) / 100
  };
}
