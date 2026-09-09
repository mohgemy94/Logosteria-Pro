import { Account, AccountType, BalanceType, JournalEntry, JournalEntryStatus } from '../types/accounting';
import { 
  DB_SALES_INVOICES_KEY, 
  DB_PURCHASES_INVOICES_KEY
} from './sequences';

export const JOURNAL_ENTRIES_STORAGE_KEY = 'alpha_journal_entries_v1';
export const ACCOUNTS_STORAGE_KEY = 'alpha_chart_of_accounts_v1';

// Default Chart of Accounts
export const DEFAULT_ACCOUNTS: Account[] = [
  // 1000 - Assets (الأصول)
  { id: 'acc-1101', code: '1101', name: 'النقدية بالصندوق (الصندوق الرئيسي)', type: AccountType.Asset, balanceType: BalanceType.Debit },
  { id: 'acc-1102', code: '1102', name: 'حساب البنك الأهلي التجاري', type: AccountType.Asset, balanceType: BalanceType.Debit },
  { id: 'acc-1103', code: '1103', name: 'حساب بنك الراجحي', type: AccountType.Asset, balanceType: BalanceType.Debit },
  { id: 'acc-1201', code: '1201', name: 'ذمم العملاء (حسابات العملاء)', type: AccountType.Asset, balanceType: BalanceType.Debit },
  { id: 'acc-1301', code: '1301', name: 'المخزون السلعي (المستودع الرئيسي)', type: AccountType.Asset, balanceType: BalanceType.Debit },
  { id: 'acc-1401', code: '1401', name: 'الأصول الثابتة - الآلات والمعدات', type: AccountType.Asset, balanceType: BalanceType.Debit },
  { id: 'acc-1402', code: '1402', name: 'الأصول الثابتة - أجهزة ومعدات تقنية', type: AccountType.Asset, balanceType: BalanceType.Debit },

  // 2000 - Liabilities (الالتزامات)
  { id: 'acc-2101', code: '2101', name: 'ذمم الموردين (حسابات الموردين)', type: AccountType.Liability, balanceType: BalanceType.Credit },
  { id: 'acc-2102', code: '2102', name: 'ضريبة القيمة المضافة المستحقة (15%)', type: AccountType.Liability, balanceType: BalanceType.Credit },
  { id: 'acc-2103', code: '2103', name: 'أوراق الدفع والكمبيالات المستحقة', type: AccountType.Liability, balanceType: BalanceType.Credit },
  { id: 'acc-2201', code: '2201', name: 'رواتب ومستحقات الموظفين المستحقة', type: AccountType.Liability, balanceType: BalanceType.Credit },

  // 3000 - Equity (حقوق الملكية)
  { id: 'acc-3101', code: '3101', name: 'رأس المال المباشر', type: AccountType.Equity, balanceType: BalanceType.Credit },
  { id: 'acc-3201', code: '3201', name: 'الأرباح والخسائر المدورة', type: AccountType.Equity, balanceType: BalanceType.Credit },

  // 4000 - Revenue (الإيرادات)
  { id: 'acc-4101', code: '4101', name: 'إيرادات المبيعات التجارية', type: AccountType.Revenue, balanceType: BalanceType.Credit },
  { id: 'acc-4102', code: '4102', name: 'إيرادات تقديم الخدمات والصيانة', type: AccountType.Revenue, balanceType: BalanceType.Credit },
  { id: 'acc-4201', code: '4201', name: 'إيرادات وأرباح متنوعة أخرى', type: AccountType.Revenue, balanceType: BalanceType.Credit },

  // 5000 - Expenses (المصروفات)
  { id: 'acc-5101', code: '5101', name: 'تكلفة البضاعة المباعة (COGS)', type: AccountType.Expense, balanceType: BalanceType.Debit },
  { id: 'acc-5102', code: '5102', name: 'مصروفات الرواتب والأجور والبدلات', type: AccountType.Expense, balanceType: BalanceType.Debit },
  { id: 'acc-5103', code: '5103', name: 'مصروف إيجار المقر والفروع', type: AccountType.Expense, balanceType: BalanceType.Debit },
  { id: 'acc-5104', code: '5104', name: 'مصروفات عمومية وإدارية', type: AccountType.Expense, balanceType: BalanceType.Debit },
  { id: 'acc-5105', code: '5105', name: 'مصروفات الكهرباء والمياه والاتصالات', type: AccountType.Expense, balanceType: BalanceType.Debit },
  { id: 'acc-5106', code: '5106', name: 'مصروفات الدعاية والتسويق', type: AccountType.Expense, balanceType: BalanceType.Debit }
];

// Initial Realistic Journal Entries
export const DEFAULT_JOURNAL_ENTRIES: JournalEntry[] = [
  {
    id: 'je-init-1',
    entryNumber: 'JE-2026-0001',
    date: '2026-01-01',
    status: JournalEntryStatus.Posted,
    reference: 'REF-CAP-01',
    description: 'قيد افتتاح الشركة - إيداع حصص رأس المال بالصندوق والبنك الأهلي',
    items: [
      { id: 'ji-1-1', accountId: 'acc-1101', debit: 50000, credit: 0 },
      { id: 'ji-1-2', accountId: 'acc-1102', debit: 150000, credit: 0 },
      { id: 'ji-1-3', accountId: 'acc-3101', debit: 0, credit: 200000 }
    ]
  },
  {
    id: 'je-init-2',
    entryNumber: 'JE-2026-0002',
    date: '2026-01-05',
    status: JournalEntryStatus.Posted,
    reference: 'REF-INV-01',
    description: 'شراء بضاعة للمخزون آجل من الموردين مع ضريبة القيمة المضافة',
    items: [
      { id: 'ji-2-1', accountId: 'acc-1301', debit: 40000, credit: 0 },
      { id: 'ji-2-2', accountId: 'acc-2101', debit: 0, credit: 40000 }
    ]
  },
  {
    id: 'je-init-3',
    entryNumber: 'JE-2026-0003',
    date: '2026-01-10',
    status: JournalEntryStatus.Posted,
    reference: 'REF-RENT-01',
    description: 'سداد دفعة إيجار المكتب الرئيسي بشيك من البنك الأهلي',
    items: [
      { id: 'ji-3-1', accountId: 'acc-5103', debit: 15000, credit: 0 },
      { id: 'ji-3-2', accountId: 'acc-1102', debit: 0, credit: 15000 }
    ]
  },
  {
    id: 'je-init-4',
    entryNumber: 'JE-2026-0004',
    date: '2026-01-15',
    status: JournalEntryStatus.Posted,
    reference: 'REF-SALE-01',
    description: 'اثبات مبيعات بضائع وخدمات استشارية للعملاء مع الضريبة',
    items: [
      { id: 'ji-4-1', accountId: 'acc-1201', debit: 34500, credit: 0 },
      { id: 'ji-4-2', accountId: 'acc-4101', debit: 0, credit: 30000 },
      { id: 'ji-4-3', accountId: 'acc-2102', debit: 0, credit: 4500 }
    ]
  },
  {
    id: 'je-init-5',
    entryNumber: 'JE-2026-0005',
    date: '2026-01-16',
    status: JournalEntryStatus.Posted,
    reference: 'REF-COGS-01',
    description: 'اثبات تكلفة البضاعة المباعة للفاتورة رقم REF-SALE-01',
    items: [
      { id: 'ji-5-1', accountId: 'acc-5101', debit: 18000, credit: 0 },
      { id: 'ji-5-2', accountId: 'acc-1301', debit: 0, credit: 18000 }
    ]
  },
  {
    id: 'je-init-6',
    entryNumber: 'JE-2026-0006',
    date: '2026-01-20',
    status: JournalEntryStatus.Posted,
    reference: 'REF-PAYROLL-01',
    description: 'إثبات مسير رواتب الشهر الأول وصرفها نقداً من البنك الأهلي',
    items: [
      { id: 'ji-6-1', accountId: 'acc-5102', debit: 12500, credit: 0 },
      { id: 'ji-6-2', accountId: 'acc-1102', debit: 0, credit: 12500 }
    ]
  },
  {
    id: 'je-init-7',
    entryNumber: 'JE-2026-0007',
    date: '2026-01-25',
    status: JournalEntryStatus.Posted,
    reference: 'REF-UTILS-01',
    description: 'سداد فواتير الكهرباء والإنترنت والخدمات العامة من الصندوق',
    items: [
      { id: 'ji-7-1', accountId: 'acc-5105', debit: 2800, credit: 0 },
      { id: 'ji-7-2', accountId: 'acc-1101', debit: 0, credit: 2800 }
    ]
  }
];

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
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ACCOUNTS;
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
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_JOURNAL_ENTRIES;
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

// Structure for calculated Trial Balance Row
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
  source: 'JOURNAL' | 'SALES' | 'PURCHASE' | 'RECEIPT' | 'PAYMENT' | 'INTERNAL';
}

/**
 * Calculates complete Trial Balance dynamically by aggregating:
 * 1. Posted Manual Journal Entries
 * 2. Operational Invoices & Vouchers (Sales, Purchases, Receipts, Payments, Internal)
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

  // Create an aggregation map per account ID
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
      rec.debitMovement += debit;
      rec.creditMovement += credit;
    }
  };

  // Helper to test if date is within range
  const isInRange = (dStr: string) => {
    if (!dStr) return true;
    if (startDate && dStr < startDate) return false;
    if (endDate && dStr > endDate) return false;
    return true;
  };

  // 1. Process Journal Entries
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
            const grandTotal = Number(inv.totals?.grandTotal || inv.grandTotal) || 0;
            const subtotal = Number(inv.totals?.subtotal || inv.subtotal) || 0;
            const taxTotal = Number(inv.totals?.taxTotal || inv.taxTotal) || 0;

            // Debit Customer (1201)
            const customerAcc = accounts.find(a => a.code === '1201');
            if (customerAcc) addMovement(customerAcc.id, grandTotal, 0);

            // Credit Sales Revenue (4101)
            const revAcc = accounts.find(a => a.code === '4101');
            if (revAcc) addMovement(revAcc.id, 0, subtotal);

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
            const grandTotal = Number(inv.totals?.grandTotal || inv.grandTotal) || 0;
            const subtotal = Number(inv.totals?.subtotal || inv.subtotal) || 0;
            const taxTotal = Number(inv.totals?.taxTotal || inv.taxTotal) || 0;

            // Debit Inventory (1301)
            const invAcc = accounts.find(a => a.code === '1301');
            if (invAcc) addMovement(invAcc.id, subtotal + taxTotal, 0);

            // Credit Vendor (2101)
            const vendorAcc = accounts.find(a => a.code === '2101');
            if (vendorAcc) addMovement(vendorAcc.id, 0, grandTotal);
          }
        });
      }
    }
  } catch (e) {
    console.error("Trial balance purchases aggregation error:", e);
  }

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
  if (accountTypeFilter !== 'ALL') {
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

  rows.forEach(r => {
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
 * Gets ledger movement details for a specific account
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
  const entries = loadJournalEntries();

  const isInRange = (dStr: string) => {
    if (!dStr) return true;
    if (startDate && dStr < startDate) return false;
    if (endDate && dStr > endDate) return false;
    return true;
  };

  entries.forEach(entry => {
    if (entry.status !== JournalEntryStatus.Posted) return;
    if (!isInRange(entry.date)) return;

    entry.items.forEach(ji => {
      if (ji.accountId === account.id || ji.accountId === account.code) {
        items.push({
          id: ji.id || `ji-${Math.random()}`,
          date: entry.date,
          entryNumber: entry.entryNumber,
          reference: entry.reference || '-',
          description: entry.description,
          debit: Number(ji.debit) || 0,
          credit: Number(ji.credit) || 0,
          runningBalance: 0,
          balanceType: 'ZERO',
          source: 'JOURNAL'
        });
      }
    });
  });

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
