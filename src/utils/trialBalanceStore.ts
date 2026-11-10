import { Account, AccountType, BalanceType, JournalEntry, JournalEntryStatus, JournalItem } from '../types/accounting';
import { autoLockYearEnd } from './periodLock';
import { 
  DB_SALES_INVOICES_KEY, 
  DB_PURCHASES_INVOICES_KEY,
  DB_RECEIPT_VOUCHERS_KEY,
  DB_PAYMENT_VOUCHERS_KEY,
  DB_INTERNAL_RECEIPT_VOUCHERS_KEY,
  DB_INTERNAL_PAYMENT_VOUCHERS_KEY,
  DB_INTERNAL_VOUCHERS_KEY,
  DB_ITEMS_KEY
} from './sequences';

export const JOURNAL_ENTRIES_STORAGE_KEY = 'alpha_journal_entries_v1';
export const ACCOUNTS_STORAGE_KEY = 'alpha_chart_of_accounts_v1';

// Default Chart of Accounts
export const DEFAULT_ACCOUNTS: Account[] = [
  // 1000 - Assets (الأصول)
  { id: 'acc-1101', code: '1101', name: 'النقدية بالصندوق (الصندوق الرئيسي)', type: AccountType.Asset, balanceType: BalanceType.Debit },
  { id: 'acc-1102', code: '1102', name: 'النقدية بالبنك (الحساب البنكي الجاري)', type: AccountType.Asset, balanceType: BalanceType.Debit },
  { id: 'acc-1104', code: '1104', name: 'شيكات تحت التحصيل (أوراق قبض برسم التحصيل)', type: AccountType.Asset, balanceType: BalanceType.Debit },
  { id: 'acc-1201', code: '1201', name: 'ذمم العملاء (حساب مراقبة المدينين - Sub-Ledger AR)', type: AccountType.Asset, balanceType: BalanceType.Debit, isControlAccount: true, controlType: 'CUSTOMER' },
  { id: 'acc-1205', code: '1205', name: 'سلف وعهد الموظفين (حساب مراقبة شؤون الموظفين)', type: AccountType.Asset, balanceType: BalanceType.Debit, isControlAccount: true, controlType: 'EMPLOYEE' },
  { id: 'acc-1209', code: '1209', name: 'مخصص ديون مشكوك في تحصيلها (خسائر ائتمانية متوقعة - IFRS 9)', type: AccountType.Asset, balanceType: BalanceType.Credit },
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
      let deletedIds = new Set<string>();
      try {
        const deletedRaw = localStorage.getItem('alpha_deleted_accounts_v1');
        if (deletedRaw) {
          const list = JSON.parse(deletedRaw);
          if (Array.isArray(list)) deletedIds = new Set(list);
        }
      } catch {}
      const missingAccounts = DEFAULT_ACCOUNTS.filter(a => 
        !existingIds.has(a.id) && 
        !existingCodes.has(a.code) && 
        !deletedIds.has(a.id) && 
        !deletedIds.has(a.code)
      );
      const combined = [...parsed, ...missingAccounts].filter(
        (acc: Account) => !(acc.code === '1103' && (acc.name === 'حساب بنك الراجحي' || acc.name === 'مصرف الراجحي'))
      );

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
    window.dispatchEvent(new Event('alpha-data-changed'));
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
    window.dispatchEvent(new Event('alpha-data-changed'));
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
    window.dispatchEvent(new Event('alpha-data-changed'));
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
 * Resolves the actual Cashbox or Bank account from the Chart of Accounts
 * based on the invoice/voucher's saved safe/account ID or payment method.
 */
export function resolveCashOrBankAccount(
  accounts: Account[],
  rawSafeOrAccountId?: string,
  paymentMethod?: string
): Account {
  const defaultSafe: Account = accounts.find(a => a.code === '1101') || accounts[0] || {
    id: 'acc-1101',
    code: '1101',
    name: 'النقدية بالصندوق (الصندوق الرئيسي)',
    type: AccountType.Asset,
    balanceType: BalanceType.Debit
  };

  const idStr = String(rawSafeOrAccountId || '').trim();
  if (idStr) {
    const direct = accounts.find(a => a.id === idStr || a.code === idStr || a.name === idStr);
    if (direct) return direct;

    const lower = idStr.toLowerCase();
    const byName = accounts.find(a => a.name.toLowerCase().includes(lower));
    if (byName) return byName;

    if (lower.includes('bank') || lower.includes('بنك') || lower === 'bank1' || lower === 'bank2') {
      const bank = accounts.find(a => a.code === '1102' || a.name.includes('بنك') || a.name.includes('مصرف'));
      if (bank) return bank;
    }
    if (lower === 'main_safe' || lower === 'cash' || lower === 'cash1' || lower.includes('صندوق') || lower.includes('خزينة')) {
      const safe = accounts.find(a => a.code === '1101' || a.name.includes('صندوق') || a.name.includes('خزينة'));
      if (safe) return safe;
    }
  }

  const mStr = String(paymentMethod || '').toUpperCase();
  if (mStr === 'BANK' || mStr === 'BANK_TRANSFER' || mStr === 'TRANSFER' || mStr === 'SPAN' || mStr === 'CARD') {
    return accounts.find(a => a.code === '1102' || a.name.includes('بنك')) || defaultSafe;
  }
  return defaultSafe;
}

/**
 * Computes exact payment breakdown (cash paid vs remaining credit) and return flag for an invoice
 */
export function getInvoicePaymentBreakdown(inv: any): {
  isReturn: boolean;
  isCashInvoice: boolean;
  grandTotal: number;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  servicesTotal: number;
  paidCashAmount: number;
  remainingCreditAmount: number;
} {
  const grandTotal = Math.max(0, Number(inv.totals?.grandTotal ?? inv.grandTotal) || 0);
  const subtotal = Math.max(0, Number(inv.totals?.subtotal ?? inv.subtotal) || 0);
  const taxTotal = Math.max(0, Number(inv.totals?.taxTotal ?? inv.taxTotal) || 0);
  const discountTotal = Math.max(0, Number(inv.totals?.discountTotal ?? inv.discountTotal) || 0);
  const servicesTotal = Math.max(0, Number(inv.totals?.servicesTotal ?? inv.servicesTotal) || 0);
  const typeStr = String(inv.invoiceType || '').toUpperCase();
  const isReturn = typeStr.includes('RETURN') || Boolean(inv.isReturn);
  const isCashInvoice =
    inv.paymentType === 'CASH' ||
    inv.paymentType === 'كاش' ||
    typeStr === 'CASH_SALES' ||
    typeStr === 'CASH_PURCHASE' ||
    typeStr === 'CASH_PURCHASES' ||
    typeStr === 'SIMPLE_TAX_INVOICE' ||
    typeStr === 'CASH';

  let paidCashAmount = 0;
  if (inv.totals?.cashPaid !== undefined && inv.totals?.cashPaid !== null) {
    paidCashAmount = Math.min(grandTotal, Math.max(0, Number(inv.totals.cashPaid) || 0));
  } else if (isCashInvoice) {
    paidCashAmount = grandTotal;
  }

  const remainingCreditAmount = Math.max(0, Number((grandTotal - paidCashAmount).toFixed(2)));
  return {
    isReturn,
    isCashInvoice,
    grandTotal,
    subtotal,
    taxTotal,
    discountTotal,
    servicesTotal,
    paidCashAmount,
    remainingCreditAmount
  };
}

/**
 * Calculates total Cost of Goods Sold (COGS) for a sales invoice's items
 */
export function calculateInvoiceCogs(inv: any, catalogMap?: Map<string, any>): number {
  if (!Array.isArray(inv?.items)) return 0;
  return inv.items.reduce((sum: number, item: any) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    let unitCost = Number(item.costPrice ?? item.purchasePrice) || 0;
    if (unitCost <= 0 && catalogMap) {
      const key = item.itemId || item.itemCode || item.description;
      if (key && catalogMap.has(String(key))) {
        const entry = catalogMap.get(String(key));
        unitCost = typeof entry === 'number' ? entry : (Number(entry?.costPrice ?? entry?.purchasePrice) || 0);
      }
    }
    return sum + qty * unitCost;
  }, 0);
}

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
    openingDebit: number;
    openingCredit: number;
    debitMovement: number;
    creditMovement: number;
  }
  const map = new Map<string, MovementRecord>();
  
  accounts.forEach(acc => {
    const rec: MovementRecord = { openingDebit: 0, openingCredit: 0, debitMovement: 0, creditMovement: 0 };
    map.set(acc.id, rec);
    map.set(acc.code, rec);
  });

  const addMovement = (
    accIdOrCode: string | undefined,
    debit: number,
    credit: number,
    txDate?: string,
    forceOpening: boolean = false
  ) => {
    if (!accIdOrCode) return;
    if (endDate && txDate && txDate > endDate) return;
    const rec = map.get(accIdOrCode);
    if (!rec) return;

    const isBeforeStart = Boolean(startDate && txDate && txDate < startDate);
    if (forceOpening || isBeforeStart) {
      rec.openingDebit += (Number(debit) || 0);
      rec.openingCredit += (Number(credit) || 0);
    } else {
      rec.debitMovement += (Number(debit) || 0);
      rec.creditMovement += (Number(credit) || 0);
    }
  };

  // Helper to test if date is not after endDate (movements before startDate go to opening)
  const isUpToEndDate = (dStr: string) => {
    if (!dStr) return true;
    if (endDate && dStr > endDate) return false;
    return true;
  };

  // 1. Process Manual Journal Entries
  (entries || []).forEach(entry => {
    if (entry.status !== JournalEntryStatus.Posted) return;
    if (!isUpToEndDate(entry.date)) return;

    const isOpeningEntry =
      entry.reference === 'OP-2026' ||
      entry.entryNumber === 'JE-2026-0001' ||
      String(entry.description || '').includes('القيد الافتتاحي') ||
      String(entry.description || '').includes('الرصيد الافتتاحي');

    (entry.items || []).forEach(item => {
      const acc = accounts.find(a => a.id === item.accountId || a.code === item.accountId);
      if (acc) {
        addMovement(acc.id, Number(item.debit) || 0, Number(item.credit) || 0, entry.date, isOpeningEntry);
      }
    });
  });

  // Build catalog cost map for COGS calculation
  const itemCostMap = new Map<string, number>();
  try {
    const itemsRaw = localStorage.getItem(DB_ITEMS_KEY);
    if (itemsRaw) {
      const itemsList = JSON.parse(itemsRaw);
      if (Array.isArray(itemsList)) {
        itemsList.forEach((it: any) => {
          const cost = Number(it.costPrice ?? it.purchasePrice) || 0;
          if (cost > 0) {
            if (it.id) itemCostMap.set(String(it.id), cost);
            if (it.code) itemCostMap.set(String(it.code), cost);
            if (it.name) itemCostMap.set(String(it.name), cost);
          }
        });
      }
    }
  } catch {}

  // 2. Process Sales Invoices
  try {
    const salesRaw = localStorage.getItem(DB_SALES_INVOICES_KEY);
    if (salesRaw) {
      const salesInvoices = JSON.parse(salesRaw);
      if (Array.isArray(salesInvoices)) {
        salesInvoices.forEach(inv => {
          const isPosted = inv.status === 'POSTED' || (!inv.status && Number(inv.totals?.grandTotal ?? inv.grandTotal) > 0);
          if (isPosted && isUpToEndDate(inv.date)) {
            const {
              isReturn,
              subtotal,
              taxTotal,
              discountTotal,
              servicesTotal,
              paidCashAmount,
              remainingCreditAmount
            } = getInvoicePaymentBreakdown(inv);

            const addSalesLeg = (accId: string | undefined, normalDebit: number, normalCredit: number) => {
              if (!accId) return;
              if (isReturn) {
                addMovement(accId, normalCredit, normalDebit, inv.date);
              } else {
                addMovement(accId, normalDebit, normalCredit, inv.date);
              }
            };

            const safeAcc = resolveCashOrBankAccount(accounts, inv.safe || inv.treasuryId || inv.accountId, inv.paymentMethod);
            const customerAcc = accounts.find(a => a.code === '1201');

            if (paidCashAmount > 0 && safeAcc) {
              addSalesLeg(safeAcc.id, paidCashAmount, 0);
            }
            if (remainingCreditAmount > 0 && customerAcc) {
              addSalesLeg(customerAcc.id, remainingCreditAmount, 0);
            }

            // Discount Allowed (4103)
            const discountAllowedAcc = accounts.find(a => a.code === '4103');
            if (discountAllowedAcc && discountTotal > 0) {
              addSalesLeg(discountAllowedAcc.id, discountTotal, 0);
            }

            // Sales Revenue (4101)
            const revAcc = accounts.find(a => a.code === '4101');
            if (revAcc) {
              if (discountAllowedAcc && discountTotal > 0) {
                addSalesLeg(revAcc.id, 0, subtotal);
              } else {
                addSalesLeg(revAcc.id, 0, Math.max(0, subtotal - discountTotal));
              }
            }

            // Service Revenue (4102)
            if (servicesTotal > 0) {
              const serviceRevAcc = accounts.find(a => a.code === '4102') || revAcc;
              if (serviceRevAcc) {
                addSalesLeg(serviceRevAcc.id, 0, servicesTotal);
              }
            }

            // Output VAT Payable (2102)
            if (taxTotal > 0) {
              const vatAcc = accounts.find(a => a.code === '2102');
              if (vatAcc) addSalesLeg(vatAcc.id, 0, taxTotal);
            }

            // Perpetual Inventory COGS (5101 Dr / 1301 Cr)
            const cogsAmount = calculateInvoiceCogs(inv, itemCostMap);
            if (cogsAmount > 0) {
              const cogsAcc = accounts.find(a => a.code === '5101');
              const invAcc = accounts.find(a => a.code === '1301');
              if (cogsAcc && invAcc) {
                addSalesLeg(cogsAcc.id, cogsAmount, 0);
                addSalesLeg(invAcc.id, 0, cogsAmount);
              }
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
          const isPosted = inv.status === 'POSTED' || (!inv.status && Number(inv.totals?.grandTotal ?? inv.grandTotal) > 0);
          if (isPosted && isUpToEndDate(inv.date)) {
            const {
              isReturn,
              subtotal,
              taxTotal,
              discountTotal,
              paidCashAmount,
              remainingCreditAmount
            } = getInvoicePaymentBreakdown(inv);

            const addPurchLeg = (accId: string | undefined, normalDebit: number, normalCredit: number) => {
              if (!accId) return;
              if (isReturn) {
                addMovement(accId, normalCredit, normalDebit, inv.date);
              } else {
                addMovement(accId, normalDebit, normalCredit, inv.date);
              }
            };

            const invAcc = accounts.find(a => a.code === '1301');
            const vatAcc = accounts.find(a => a.code === '2102');
            const discountReceivedAcc = accounts.find(a => a.code === '4203');

            // Debit Inventory (1301) for net cost (excluding recoverable VAT if VAT account exists)
            if (invAcc) {
              const vatIncludedInInv = vatAcc ? 0 : taxTotal;
              if (discountReceivedAcc && discountTotal > 0) {
                addPurchLeg(invAcc.id, subtotal + vatIncludedInInv, 0);
              } else {
                addPurchLeg(invAcc.id, Math.max(0, subtotal + vatIncludedInInv - discountTotal), 0);
              }
            }

            // Debit Input VAT (2102)
            if (vatAcc && taxTotal > 0) {
              addPurchLeg(vatAcc.id, taxTotal, 0);
            }

            // Credit Safe/Bank for paidCashAmount & Credit Vendor (2101) for remainingCreditAmount
            const safeAcc = resolveCashOrBankAccount(accounts, inv.safe || inv.treasuryId || inv.accountId, inv.paymentMethod);
            const vendorAcc = accounts.find(a => a.code === '2101');

            if (paidCashAmount > 0 && safeAcc) {
              addPurchLeg(safeAcc.id, 0, paidCashAmount);
            }
            if (remainingCreditAmount > 0 && vendorAcc) {
              addPurchLeg(vendorAcc.id, 0, remainingCreditAmount);
            }

            // Credit Earned Discount (4203)
            if (discountReceivedAcc && discountTotal > 0) {
              addPurchLeg(discountReceivedAcc.id, 0, discountTotal);
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
          if (v.status === 'POSTED' && isUpToEndDate(v.date)) {
            const amt = Number(v.amount) || 0;
            if (amt > 0) {
              const isCheck = v.paymentMethod === 'CHECK';
              const matchedAcc = accounts.find(a => a.id === v.accountId || a.code === v.accountId);
              const isBank = v.accountId === 'bank' || v.accountId === 'bank1' || v.accountId === 'acc-1102' || v.paymentMethod === 'BANK' || v.paymentMethod === 'BANK_TRANSFER' || v.paymentMethod === 'TRANSFER';
              const chqAcc = accounts.find(a => a.code === '1104');
              const cashOrBank = isCheck ? (chqAcc || accounts.find(a => a.code === '1101')) : (matchedAcc || accounts.find(a => a.code === (isBank ? '1102' : '1101')));
              if (cashOrBank) addMovement(cashOrBank.id, amt, 0, v.date);

              const isVendor = v.partnerType === 'VENDOR';
              const partnerAcc = accounts.find(a => a.code === (isVendor ? '2101' : '1201'));
              if (partnerAcc) addMovement(partnerAcc.id, 0, amt, v.date);
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
          if (v.status === 'POSTED' && isUpToEndDate(v.date)) {
            const amt = Number(v.amount) || 0;
            if (amt > 0) {
              const isCustomer = v.partnerType === 'CUSTOMER';
              const partnerAcc = accounts.find(a => a.code === (isCustomer ? '1201' : '2101'));
              if (partnerAcc) addMovement(partnerAcc.id, amt, 0, v.date);

              const isCheck = v.paymentMethod === 'CHECK';
              const matchedAcc = accounts.find(a => a.id === v.accountId || a.code === v.accountId);
              const isBank = v.accountId === 'bank' || v.accountId === 'bank1' || v.accountId === 'acc-1102' || v.paymentMethod === 'BANK' || v.paymentMethod === 'BANK_TRANSFER' || v.paymentMethod === 'TRANSFER';
              const chqPayAcc = accounts.find(a => a.code === '2104');
              const cashOrBank = isCheck ? (chqPayAcc || accounts.find(a => a.code === '1101')) : (matchedAcc || accounts.find(a => a.code === (isBank ? '1102' : '1101')));
              if (cashOrBank) addMovement(cashOrBank.id, 0, amt, v.date);
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
          if (v.status === 'POSTED' && isUpToEndDate(v.date)) {
            const amt = Number(v.amount) || 0;
            if (amt > 0) {
              const isBank = v.toAccountId && (v.toAccountId.includes('bank') || v.toAccountId === 'acc-1102');
              const targetAcc = accounts.find(a => a.id === v.toAccountId || a.code === v.toAccountId)
                || accounts.find(a => a.code === (isBank ? '1102' : '1101'));
              if (targetAcc) addMovement(targetAcc.id, amt, 0, v.date);

              // If an explicit source account was selected (e.g. from cash/bank, revenue, employee, or other account)
              if (v.fromAccountId) {
                const sourceAcc = accounts.find(a => a.id === v.fromAccountId || a.code === v.fromAccountId);
                if (sourceAcc) {
                  addMovement(sourceAcc.id, 0, amt, v.date);
                  return;
                }
              }

              // Otherwise check sourceType
              if (v.sourceType === 'bank_to_cash' || v.sourceType === 'transfer_in') {
                const isFromBank = v.fromAccountId && (v.fromAccountId.includes('bank') || v.fromAccountId === 'acc-1102');
                const fromAcc = accounts.find(a => a.id === v.fromAccountId || a.code === v.fromAccountId)
                  || accounts.find(a => a.code === (isFromBank ? '1102' : '1101'));
                if (fromAcc) addMovement(fromAcc.id, 0, amt, v.date);
              } else if (v.sourceType === 'custody_refund' || v.sourceType === 'advance_refund') {
                // Employee advance / custody refund -> credit employee advances or salary account
                const empAcc = accounts.find(a => a.code === '1205') || accounts.find(a => a.code === '5102') || accounts.find(a => a.code === '4201');
                if (empAcc) addMovement(empAcc.id, 0, amt, v.date);
              } else {
                const otherRev = accounts.find(a => a.code === '4201') || accounts.find(a => a.code === '4101');
                if (otherRev) addMovement(otherRev.id, 0, amt, v.date);
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
          if (v.status === 'POSTED' && isUpToEndDate(v.date)) {
            const amt = Number(v.amount) || 0;
            if (amt > 0) {
              const isBank = v.fromAccountId && (v.fromAccountId.includes('bank') || v.fromAccountId === 'acc-1102');
              const sourceAcc = accounts.find(a => a.id === v.fromAccountId || a.code === v.fromAccountId)
                || accounts.find(a => a.code === (isBank ? '1102' : '1101'));
              if (sourceAcc) addMovement(sourceAcc.id, 0, amt, v.date);

              // If an explicit target account was selected (e.g. specific expense account, employee advances, branch safe, etc.)
              if (v.toAccountId) {
                const targetAcc = accounts.find(a => a.id === v.toAccountId || a.code === v.toAccountId);
                if (targetAcc) {
                  addMovement(targetAcc.id, amt, 0, v.date);
                  return;
                }
              }

              // Otherwise resolve based on expenseType
              if (v.expenseType === 'cash_to_bank' || v.expenseType === 'branch_feed') {
                const isToBank = v.toAccountId && (v.toAccountId.includes('bank') || v.toAccountId === 'acc-1102');
                const toAcc = accounts.find(a => a.id === v.toAccountId || a.code === v.toAccountId)
                  || accounts.find(a => a.code === (isToBank ? '1102' : '1101'));
                if (toAcc) addMovement(toAcc.id, amt, 0, v.date);
              } else {
                let expCode = '5104';
                if (v.expenseType === 'advance_salary' || v.expenseType === 'salary') expCode = '5102';
                else if (v.expenseType === 'rent') expCode = '5103';
                else if (v.expenseType === 'utility' || v.expenseType === 'electricity') expCode = '5105';
                else if (v.expenseType === 'marketing') expCode = '5106';

                const expAcc = accounts.find(a => a.code === expCode) || accounts.find(a => a.code === '5104');
                if (expAcc) addMovement(expAcc.id, amt, 0, v.date);
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
          if (v.status === 'POSTED' && isUpToEndDate(v.date)) {
            const amt = Number(v.amount) || 0;
            if (amt > 0) {
              const isToBank = v.toAccountId && (v.toAccountId.includes('bank') || v.toAccountId === 'acc-1102');
              const toAcc = accounts.find(a => a.id === v.toAccountId || a.code === v.toAccountId)
                || accounts.find(a => a.code === (isToBank ? '1102' : '1101'));
              if (toAcc) addMovement(toAcc.id, amt, 0, v.date);

              const isFromBank = v.fromAccountId && (v.fromAccountId.includes('bank') || v.fromAccountId === 'acc-1102');
              const fromAcc = accounts.find(a => a.id === v.fromAccountId || a.code === v.fromAccountId)
                || accounts.find(a => a.code === (isFromBank ? '1102' : '1101'));
              if (fromAcc) addMovement(fromAcc.id, 0, amt, v.date);
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
          if (audit.status === 'APPROVED' && !audit.journalEntryId && isUpToEndDate(audit.auditDate || audit.date)) {
            const invAcc = accounts.find(a => a.code === '1301');
            const gainAcc = accounts.find(a => a.code === '4202');
            const lossAcc = accounts.find(a => a.code === '5107');

            audit.items?.forEach((item: any) => {
              const varianceVal = Number(item.varianceValue) || 0;
              if (varianceVal > 0) {
                // Surplus: Debit Inventory 1301, Credit Inventory Gain 4202
                if (invAcc) addMovement(invAcc.id, varianceVal, 0, audit.auditDate);
                if (gainAcc) addMovement(gainAcc.id, 0, varianceVal, audit.auditDate);
              } else if (varianceVal < 0) {
                // Deficit: Debit Inventory Loss 5107, Credit Inventory 1301
                const absLoss = Math.abs(varianceVal);
                if (lossAcc) addMovement(lossAcc.id, absLoss, 0, audit.auditDate);
                if (invAcc) addMovement(invAcc.id, 0, absLoss, audit.auditDate);
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
      const childRec = map.get(acc.id) || { openingDebit: 0, openingCredit: 0, debitMovement: 0, creditMovement: 0 };
      const parentRec = map.get(parent.id) || { openingDebit: 0, openingCredit: 0, debitMovement: 0, creditMovement: 0 };
      parentRec.openingDebit += childRec.openingDebit;
      parentRec.openingCredit += childRec.openingCredit;
      parentRec.debitMovement += childRec.debitMovement;
      parentRec.creditMovement += childRec.creditMovement;
      map.set(parent.id, parentRec);
      map.set(parent.code, parentRec);
    }
  });

  // Build rows per account
  let rows: TrialBalanceRow[] = accounts.map(account => {
    const mov = map.get(account.id) || { openingDebit: 0, openingCredit: 0, debitMovement: 0, creditMovement: 0 };
    
    const netOpening = mov.openingDebit - mov.openingCredit;
    const openDr = netOpening > 0 ? netOpening : 0;
    const openCr = netOpening < 0 ? Math.abs(netOpening) : 0;

    // Calculate total debit & credit
    const totalDebit = openDr + mov.debitMovement;
    const totalCredit = openCr + mov.creditMovement;
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
      openingDebit: Math.round(openDr * 100) / 100,
      openingCredit: Math.round(openCr * 100) / 100,
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
      r.openingDebit > 0 ||
      r.openingCredit > 0 ||
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
  (entries || []).forEach(entry => {
    if (entry.status !== JournalEntryStatus.Posted) return;
    if (!isInRange(entry.date)) return;

    (entry.items || []).forEach(ji => {
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
          const isPosted = inv.status === 'POSTED' || (!inv.status && Number(inv.totals?.grandTotal ?? inv.grandTotal) > 0);
          if (isPosted && isInRange(inv.date)) {
            const {
              isReturn,
              subtotal,
              taxTotal,
              discountTotal,
              servicesTotal,
              paidCashAmount,
              remainingCreditAmount
            } = getInvoicePaymentBreakdown(inv);

            const custName = inv.partnerName || inv.customerName || 'عميل نقدي';
            const safeAcc = resolveCashOrBankAccount(accounts, inv.safe || inv.treasuryId || inv.accountId, inv.paymentMethod);

            // Safe / Bank movement for cash paid
            if (paidCashAmount > 0 && safeAcc && (safeAcc.id === account.id || safeAcc.code === code)) {
              items.push({
                id: `sales-cash-${inv.id}`,
                date: inv.date,
                entryNumber: inv.invoiceNumber || inv.id,
                reference: custName,
                description: `${isReturn ? 'رد نقدية مرتجع مبيعات' : 'تحصيل فاتورة مبيعات'} ${inv.invoiceNumber} - ${custName}`,
                debit: isReturn ? 0 : paidCashAmount,
                credit: isReturn ? paidCashAmount : 0,
                runningBalance: 0,
                balanceType: isReturn ? 'CREDIT' : 'DEBIT',
                source: 'SALES',
                sourceLabel: isReturn ? 'مرتجع مبيعات' : 'فاتورة مبيعات',
                sourceView: 'sales',
                sourceModule: 'فواتير المبيعات'
              });
            }

            // Customer AR (1201) for remaining credit
            if (remainingCreditAmount > 0 && code === '1201') {
              items.push({
                id: `sales-ar-${inv.id}`,
                date: inv.date,
                entryNumber: inv.invoiceNumber || inv.id,
                reference: custName,
                description: `${isReturn ? 'مرتجع مبيعات آجل' : 'استحقاق فاتورة مبيعات'} ${inv.invoiceNumber} للعميل: ${custName}`,
                debit: isReturn ? 0 : remainingCreditAmount,
                credit: isReturn ? remainingCreditAmount : 0,
                runningBalance: 0,
                balanceType: isReturn ? 'CREDIT' : 'DEBIT',
                source: 'SALES',
                sourceLabel: isReturn ? 'مرتجع مبيعات' : 'فاتورة مبيعات',
                sourceView: 'sales',
                sourceModule: 'فواتير المبيعات'
              });
            }

            // Sales Revenue (4101)
            if (code === '4101') {
              const revVal = discountTotal > 0 ? subtotal : Math.max(0, subtotal - discountTotal);
              items.push({
                id: `sales-rev-${inv.id}`,
                date: inv.date,
                entryNumber: inv.invoiceNumber || inv.id,
                reference: custName,
                description: `${isReturn ? 'مرتجع إيراد مبيعات' : 'إيراد مبيعات'} فاتورة رقم ${inv.invoiceNumber}`,
                debit: isReturn ? revVal : 0,
                credit: isReturn ? 0 : revVal,
                runningBalance: 0,
                balanceType: isReturn ? 'DEBIT' : 'CREDIT',
                source: 'SALES',
                sourceLabel: 'إيرادات مبيعات',
                sourceView: 'sales',
                sourceModule: 'فواتير المبيعات'
              });
            }

            // Services Revenue (4102)
            if (code === '4102' && servicesTotal > 0) {
              items.push({
                id: `sales-srv-${inv.id}`,
                date: inv.date,
                entryNumber: inv.invoiceNumber || inv.id,
                reference: custName,
                description: `إيراد خدمات فاتورة مبيعات رقم ${inv.invoiceNumber}`,
                debit: isReturn ? servicesTotal : 0,
                credit: isReturn ? 0 : servicesTotal,
                runningBalance: 0,
                balanceType: isReturn ? 'DEBIT' : 'CREDIT',
                source: 'SALES',
                sourceLabel: 'إيرادات خدمات',
                sourceView: 'sales',
                sourceModule: 'فواتير المبيعات'
              });
            }

            // Discount Allowed (4103)
            if (code === '4103' && discountTotal > 0) {
              items.push({
                id: `sales-disc-${inv.id}`,
                date: inv.date,
                entryNumber: inv.invoiceNumber || inv.id,
                reference: custName,
                description: `خصم مسموح به فاتورة مبيعات ${inv.invoiceNumber} - ${custName}`,
                debit: isReturn ? 0 : discountTotal,
                credit: isReturn ? discountTotal : 0,
                runningBalance: 0,
                balanceType: isReturn ? 'CREDIT' : 'DEBIT',
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
                reference: custName,
                description: `ضريبة مخرجات ${rateLabel ? `(${rateLabel}) ` : ''}لفاتورة مبيعات ${inv.invoiceNumber}`,
                debit: isReturn ? taxTotal : 0,
                credit: isReturn ? 0 : taxTotal,
                runningBalance: 0,
                balanceType: isReturn ? 'DEBIT' : 'CREDIT',
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
          const isPosted = inv.status === 'POSTED' || (!inv.status && Number(inv.totals?.grandTotal ?? inv.grandTotal) > 0);
          if (isPosted && isInRange(inv.date)) {
            const {
              isReturn,
              subtotal,
              taxTotal,
              discountTotal,
              paidCashAmount,
              remainingCreditAmount
            } = getInvoicePaymentBreakdown(inv);

            const vendName = inv.partnerName || inv.vendorName || 'مورد';
            const safeAcc = resolveCashOrBankAccount(accounts, inv.safe || inv.treasuryId || inv.accountId, inv.paymentMethod);

            // Inventory (1301)
            if (code === '1301') {
              const invCost = discountTotal > 0 ? subtotal : Math.max(0, subtotal - discountTotal);
              items.push({
                id: `purch-inv-${inv.id}`,
                date: inv.date,
                entryNumber: inv.invoiceNumber || inv.id,
                reference: vendName,
                description: `${isReturn ? 'مرتجع مخزون مشتريات' : 'إضافة مخزون مشتريات'} فاتورة ${inv.invoiceNumber} من ${vendName}`,
                debit: isReturn ? 0 : invCost,
                credit: isReturn ? invCost : 0,
                runningBalance: 0,
                balanceType: isReturn ? 'CREDIT' : 'DEBIT',
                source: 'PURCHASE',
                sourceLabel: isReturn ? 'مرتجع مشتريات' : 'فاتورة مشتريات',
                sourceView: 'purchases',
                sourceModule: 'فواتير المشتريات'
              });
            }

            // Input VAT (2102)
            if (code === '2102' && taxTotal > 0) {
              items.push({
                id: `purch-vat-${inv.id}`,
                date: inv.date,
                entryNumber: inv.invoiceNumber || inv.id,
                reference: vendName,
                description: `ضريبة مدخلات مشتريات فاتورة ${inv.invoiceNumber} - ${vendName}`,
                debit: isReturn ? 0 : taxTotal,
                credit: isReturn ? taxTotal : 0,
                runningBalance: 0,
                balanceType: isReturn ? 'CREDIT' : 'DEBIT',
                source: 'PURCHASE',
                sourceLabel: 'ضريبة مدخلات',
                sourceView: 'purchases',
                sourceModule: 'فواتير المشتريات'
              });
            }

            // Safe / Bank movement for cash paid
            if (paidCashAmount > 0 && safeAcc && (safeAcc.id === account.id || safeAcc.code === code)) {
              items.push({
                id: `purch-cash-${inv.id}`,
                date: inv.date,
                entryNumber: inv.invoiceNumber || inv.id,
                reference: vendName,
                description: `${isReturn ? 'استرداد نقدية مرتجع مشتريات' : 'سداد فاتورة مشتريات'} ${inv.invoiceNumber} للمورد ${vendName}`,
                debit: isReturn ? paidCashAmount : 0,
                credit: isReturn ? 0 : paidCashAmount,
                runningBalance: 0,
                balanceType: isReturn ? 'DEBIT' : 'CREDIT',
                source: 'PURCHASE',
                sourceLabel: 'فاتورة مشتريات',
                sourceView: 'purchases',
                sourceModule: 'فواتير المشتريات'
              });
            }

            // Vendor AP (2101) for remaining credit
            if (remainingCreditAmount > 0 && code === '2101') {
              items.push({
                id: `purch-ap-${inv.id}`,
                date: inv.date,
                entryNumber: inv.invoiceNumber || inv.id,
                reference: vendName,
                description: `${isReturn ? 'تخفيض ذمة مورد (مرتجع)' : 'استحقاق فاتورة مشتريات'} ${inv.invoiceNumber} للمورد ${vendName}`,
                debit: isReturn ? remainingCreditAmount : 0,
                credit: isReturn ? 0 : remainingCreditAmount,
                runningBalance: 0,
                balanceType: isReturn ? 'DEBIT' : 'CREDIT',
                source: 'PURCHASE',
                sourceLabel: 'فاتورة مشتريات',
                sourceView: 'purchases',
                sourceModule: 'فواتير المشتريات'
              });
            }

            // Discount Received / Earned (4203)
            if (code === '4203' && discountTotal > 0) {
              items.push({
                id: `purch-disc-${inv.id}`,
                date: inv.date,
                entryNumber: inv.invoiceNumber || inv.id,
                reference: vendName,
                description: `خصم مكتسب من المورد لفاتورة مشتريات ${inv.invoiceNumber} - ${vendName}`,
                debit: isReturn ? discountTotal : 0,
                credit: isReturn ? 0 : discountTotal,
                runningBalance: 0,
                balanceType: isReturn ? 'DEBIT' : 'CREDIT',
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
    const rawCust = localStorage.getItem('accounting_customers') || localStorage.getItem('alpha_customers_v1') || localStorage.getItem('customers');
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
    const rawVend = localStorage.getItem('accounting_vendors') || localStorage.getItem('alpha_vendors_v1') || localStorage.getItem('vendors');
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

  // 5. Checks under Collection (1104) & Issued Checks (2104)
  const chqRecRow = tb.rows.find(r => r.account.code === '1104');
  const chqRecBalance = chqRecRow ? (chqRecRow.endingDebit - chqRecRow.endingCredit) : 0;

  const chqPayRow = tb.rows.find(r => r.account.code === '2104');
  const chqPayBalance = chqPayRow ? (chqPayRow.endingCredit - chqPayRow.endingDebit) : 0;

  let checksPortfolioTotal = 0;
  try {
    const rawChqs = localStorage.getItem('alpha_bank_checks_v1');
    if (rawChqs) {
      const chqs = JSON.parse(rawChqs);
      if (Array.isArray(chqs)) {
        checksPortfolioTotal = chqs.filter(c => c.status === 'UNDER_COLLECTION' || c.status === 'PENDING').reduce((s, c) => s + (Number(c.amount) || 0), 0);
      }
    }
  } catch (e) {
    console.error("Failed calculating checks portfolio:", e);
  }

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
    },
    checks: {
      inCollectionBalance: chqRecBalance,
      issuedBalance: chqPayBalance,
      portfolioTotal: checksPortfolioTotal
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

export interface DashboardKPIsData {
  sales: number;
  expenses: number;
  netProfit: number;
  inventoryValuation: number;
  cashAndBank: number;
  accountsReceivable: number;
  accountsPayable: number;
}

export function computeDashboardKPIsLocally(selectedYear: number): DashboardKPIsData {
  const startDate = `${selectedYear}-01-01`;
  const endDate = `${selectedYear}-12-31`;

  const tb = calculateTrialBalance(startDate, endDate);

  // Total Sales (Revenue accounts code starting with '4')
  const sales = tb.rows
    .filter(r => r.account.code.startsWith('4'))
    .reduce((sum, r) => sum + (r.creditMovement - r.debitMovement + (r.account.type === AccountType.Revenue ? (r.openingCredit - r.openingDebit) : 0)), 0);

  // Total Expenses (Expense accounts code starting with '5')
  const expenses = tb.rows
    .filter(r => r.account.code.startsWith('5'))
    .reduce((sum, r) => sum + (r.debitMovement - r.creditMovement + (r.account.type === AccountType.Expense ? (r.openingDebit - r.openingCredit) : 0)), 0);

  const netProfit = sales - expenses;

  // Inventory Valuation (1301)
  const invRow = tb.rows.find(r => r.account.code === '1301');
  let inventoryValuation = invRow ? Math.max(0, invRow.endingDebit - invRow.endingCredit) : 0;
  if (inventoryValuation === 0 && typeof window !== 'undefined') {
    try {
      const rawWh = localStorage.getItem('alpha_warehouse_balances_v2') || localStorage.getItem('items');
      if (rawWh) {
        const parsed = JSON.parse(rawWh);
        if (Array.isArray(parsed)) {
          inventoryValuation = parsed.reduce((sum, item) => sum + (Number(item.stock || item.quantity || 0) * Number(item.costPrice || item.purchasePrice || 0)), 0);
        }
      }
    } catch {}
  }

  // Cash and Bank (1101, 1102, 1103 & custom bank/safe accounts)
  const cashBankRows = tb.rows.filter(r => 
    r.account.code.startsWith('1101') || 
    r.account.code.startsWith('1102') || 
    r.account.code.startsWith('1103') || 
    (r.account.type === AccountType.Asset && (r.account.name.includes('بنك') || r.account.name.includes('صندوق') || r.account.name.includes('خزينة')))
  );
  const cashAndBank = cashBankRows.reduce((sum, r) => sum + (r.endingDebit - r.endingCredit), 0);

  // AR (1201)
  const arRows = tb.rows.filter(r => r.account.code.startsWith('1201'));
  const accountsReceivable = arRows.reduce((sum, r) => sum + (r.endingDebit - r.endingCredit), 0);

  // AP (2101)
  const apRows = tb.rows.filter(r => r.account.code.startsWith('2101'));
  const accountsPayable = apRows.reduce((sum, r) => sum + (r.endingCredit - r.endingDebit), 0);

  return {
    sales: Math.max(0, sales),
    expenses: Math.max(0, expenses),
    netProfit,
    inventoryValuation,
    cashAndBank,
    accountsReceivable,
    accountsPayable
  };
}

export function closeYearLocally(selectedYear: number): void {
  const startDate = `${selectedYear}-01-01`;
  const endDate = `${selectedYear}-12-31`;
  const tb = calculateTrialBalance(startDate, endDate);
  const accounts = loadChartOfAccounts();
  const retainedAcc = accounts.find(a => a.code === '3201') || accounts.find(a => a.type === AccountType.Equity);

  const items: JournalItem[] = [];
  let totalRevenueClosed = 0;
  let totalExpenseClosed = 0;

  // Find all leaf revenue & expense sub-accounts
  const leafRows = tb.rows.filter(r => 
    !accounts.some(a => a.parentId === r.account.id || (a.code.length > r.account.code.length && a.code.startsWith(r.account.code)))
  );

  // Zero out each individual revenue account (code starting with '4')
  leafRows.filter(r => r.account.code.startsWith('4') || r.account.type === AccountType.Revenue).forEach(r => {
    const netCredit = r.totalCredit - r.totalDebit;
    if (Math.abs(netCredit) > 0.001) {
      if (netCredit > 0) {
        // Normal revenue: Debit account to zero out
        items.push({
          id: `close_rev_${r.account.id}_${Date.now()}`,
          accountId: r.account.id,
          debit: Math.round(netCredit * 100) / 100,
          credit: 0
        });
        totalRevenueClosed += netCredit;
      } else {
        // Contra-revenue / discount: Credit account to zero out
        items.push({
          id: `close_rev_${r.account.id}_${Date.now()}`,
          accountId: r.account.id,
          debit: 0,
          credit: Math.round(Math.abs(netCredit) * 100) / 100
        });
        totalRevenueClosed += netCredit;
      }
    }
  });

  // Zero out each individual expense account (code starting with '5')
  leafRows.filter(r => r.account.code.startsWith('5') || r.account.type === AccountType.Expense).forEach(r => {
    const netDebit = r.totalDebit - r.totalCredit;
    if (Math.abs(netDebit) > 0.001) {
      if (netDebit > 0) {
        // Normal expense: Credit account to zero out
        items.push({
          id: `close_exp_${r.account.id}_${Date.now()}`,
          accountId: r.account.id,
          debit: 0,
          credit: Math.round(netDebit * 100) / 100
        });
        totalExpenseClosed += netDebit;
      } else {
        items.push({
          id: `close_exp_${r.account.id}_${Date.now()}`,
          accountId: r.account.id,
          debit: Math.round(Math.abs(netDebit) * 100) / 100,
          credit: 0
        });
        totalExpenseClosed += netDebit;
      }
    }
  });

  const netProfit = Math.round((totalRevenueClosed - totalExpenseClosed) * 100) / 100;

  // Net Profit to Retained Earnings (3201)
  if (retainedAcc && Math.abs(netProfit) > 0) {
    items.push({
      id: `close_ret_${Date.now()}`,
      accountId: retainedAcc.id,
      debit: netProfit < 0 ? Math.abs(netProfit) : 0,
      credit: netProfit > 0 ? netProfit : 0
    });
  }

  if (items.length > 0) {
    const closingEntry: JournalEntry = {
      id: `CLOSE-${selectedYear}-${Date.now()}`,
      entryNumber: `YE-${selectedYear}`,
      date: `${selectedYear}-12-31`,
      reference: `YE-CLOSE-${selectedYear}`,
      description: `قيد إقفال السنة المالية الشامل لعام ${selectedYear}`,
      items,
      status: JournalEntryStatus.Posted
    };
    saveJournalEntry(closingEntry);
    try {
      autoLockYearEnd(selectedYear);
    } catch (e) {
      console.warn('Failed auto-locking year:', e);
    }
  }
}

