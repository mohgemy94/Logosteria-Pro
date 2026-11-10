import { DEFAULT_SETTINGS, saveSystemSettings } from './settings';
import { DEFAULT_ACCOUNTS, ACCOUNTS_STORAGE_KEY, JOURNAL_ENTRIES_STORAGE_KEY } from './trialBalanceStore';
import { CUSTOMERS_STORAGE_KEY, VENDORS_STORAGE_KEY, dispatchPartnerLedgerUpdated } from './partnerLedger';
import { 
  DB_ITEMS_KEY,
  DB_SALES_INVOICES_KEY, 
  DB_PURCHASES_INVOICES_KEY, 
  DB_RECEIPT_VOUCHERS_KEY, 
  DB_PAYMENT_VOUCHERS_KEY, 
  DB_INTERNAL_VOUCHERS_KEY, 
  DB_INTERNAL_RECEIPT_VOUCHERS_KEY, 
  DB_INTERNAL_PAYMENT_VOUCHERS_KEY,
  getSequences,
  saveSequences,
  SequencesStore
} from './sequences';
import { notifyDataChanged } from './localFolderBackup';
import { STORAGE_KEY_INSTALLMENTS, STORAGE_KEY_PROMISSORY_NOTES } from '../data/mockInstallments';
import { STORAGE_KEY_EMPLOYEES } from '../data/mockPayroll';
import { STORAGE_KEY_BOM, STORAGE_KEY_WORK_ORDERS, STORAGE_KEY_WORK_CENTERS } from '../data/mockManufacturing';
import { savePrintPaperFormat, savePrintColorMode } from './printPaperFormats';
import { STORAGE_KEY_INVENTORY_AUDITS } from './inventoryAuditStore';
import { recordAuditLog } from './auditLogStore';

export type ResetType = 'TRANSACTIONS_ONLY' | 'FULL_FACTORY_RESET';

export interface ResetSummary {
  success: boolean;
  resetType: ResetType;
  clearedItemsCount: number;
  clearedCustomersCount: number;
  clearedVendorsCount: number;
  clearedInvoicesCount: number;
  clearedVouchersCount: number;
  clearedJournalEntriesCount: number;
  clearedInventoryAuditsCount: number;
  preservedItemsCount?: number;
  preservedCustomersCount?: number;
  preservedVendorsCount?: number;
  timestamp: string;
}

/**
 * Creates and triggers automatic download of a complete JSON backup of the system
 * containing all operational, financial, and master data before any reset operation.
 */
export function downloadSystemBackupJSON(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const backupData: Record<string, unknown> = {
      app: 'Logustria Accounting ERP',
      exportedAt: new Date().toISOString(),
      version: '2.5',
      exportNote: 'نسخة احتياطية شاملة تم تنزيلها قبل تنفيذ عملية تصفير البيانات',
      data: {}
    };

    const keysToBackup = [
      'alpha_system_settings_v1',
      'alpha_coa_v2',
      'accounting_customers',
      'accounting_vendors',
      'alpha_partner_balances_v1',
      'alpha_partner_balances_v2',
      'alpha_items_store_v1',
      'alpha_warehouse_balances_v1',
      'alpha_warehouse_balances_v2',
      'alpha_sales_invoices_v1',
      'alpha_purchases_invoices_v1',
      'alpha_receipt_vouchers_v1',
      'alpha_payment_vouchers_v1',
      'alpha_internal_vouchers_v1',
      'alpha_internal_receipt_vouchers_v1',
      'alpha_internal_payment_vouchers_v1',
      'alpha_journal_entries_v2',
      'alpha_document_sequences_v3',
      'alpha_installments_contracts_v1',
      'alpha_promissory_notes_v1',
      'alpha_employees_v1',
      'alpha_payroll_employees_v1',
      'alpha_mfg_bom_v1',
      'alpha_mfg_work_orders_v1',
      'alpha_mfg_work_centers_v1',
      'alpha_inventory_audits_v1',
      'alpha_bank_checks_v1',
      'alpha_audit_trail_v1',
      'alpha_stock_transfers_v1',
      'alpha_print_paper_format',
      'alpha_print_color_mode'
    ];

    const dataObj: Record<string, unknown> = {};
    keysToBackup.forEach(k => {
      const val = localStorage.getItem(k);
      if (val !== null) {
        try {
          dataObj[k] = JSON.parse(val);
        } catch {
          dataObj[k] = val;
        }
      }
    });

    backupData.data = dataObj;

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    a.href = url;
    a.download = `backup_before_reset_${dateStr}_${timeStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('Failed to download system backup JSON:', err);
    return false;
  }
}

/**
 * Level 1 Reset: Resets transactions and operations only.
 * Deletes all Sales/Purchase Invoices, Journal Entries, Vouchers, Inventory movements,
 * Installments, and Work Orders, and resets document sequences to 1.
 * PRESERVES Customer records/pages, Vendor records/pages, Items catalog, Chart of Accounts, and Company settings,
 * while resetting all customer and vendor opening balances and financial dues to 0.
 */
export function resetTransactionsOnly(): ResetSummary {
  if (typeof window === 'undefined') {
    return {
      success: false,
      resetType: 'TRANSACTIONS_ONLY',
      clearedItemsCount: 0,
      clearedCustomersCount: 0,
      clearedVendorsCount: 0,
      clearedInvoicesCount: 0,
      clearedVouchersCount: 0,
      clearedJournalEntriesCount: 0,
      clearedInventoryAuditsCount: 0,
      timestamp: new Date().toISOString()
    };
  }

  // Count existing records before deletion
  const countKey = (key: string): number => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  };

  const clearedInvoicesCount = countKey(DB_SALES_INVOICES_KEY) + countKey(DB_PURCHASES_INVOICES_KEY);
  const clearedVouchersCount = 
    countKey(DB_RECEIPT_VOUCHERS_KEY) + 
    countKey(DB_PAYMENT_VOUCHERS_KEY) + 
    countKey(DB_INTERNAL_VOUCHERS_KEY) + 
    countKey(DB_INTERNAL_RECEIPT_VOUCHERS_KEY) + 
    countKey(DB_INTERNAL_PAYMENT_VOUCHERS_KEY);
  const clearedJournalEntriesCount = countKey(JOURNAL_ENTRIES_STORAGE_KEY);
  const clearedInventoryAuditsCount = countKey(STORAGE_KEY_INVENTORY_AUDITS);

  // 1. Preserve Customer records/pages, but zero out all their financial data (opening balances to 0)
  let currentCustomers: any[] = [];
  try {
    const raw = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
    if (raw) currentCustomers = JSON.parse(raw);
  } catch {}
  if (!Array.isArray(currentCustomers) || currentCustomers.length === 0) {
    try {
      const fallbackRaw = localStorage.getItem('alpha_customers_v1') || localStorage.getItem('customers');
      if (fallbackRaw) currentCustomers = JSON.parse(fallbackRaw);
    } catch {}
  }
  if (!Array.isArray(currentCustomers)) {
    currentCustomers = [];
  }
  const zeroedCustomers = currentCustomers.map(cust => ({
    ...cust,
    openingBalance: 0,
    openingBalanceType: undefined,
    openingBalanceDate: undefined
  }));
  localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(zeroedCustomers));
  localStorage.setItem('alpha_customers_v1', JSON.stringify(zeroedCustomers));
  localStorage.setItem('customers', JSON.stringify(zeroedCustomers));

  // 2. Preserve Vendor records/pages, but zero out all their financial data (opening balances to 0)
  let currentVendors: any[] = [];
  try {
    const raw = localStorage.getItem(VENDORS_STORAGE_KEY);
    if (raw) currentVendors = JSON.parse(raw);
  } catch {}
  if (!Array.isArray(currentVendors) || currentVendors.length === 0) {
    try {
      const fallbackRaw = localStorage.getItem('alpha_vendors_v1') || localStorage.getItem('vendors');
      if (fallbackRaw) currentVendors = JSON.parse(fallbackRaw);
    } catch {}
  }
  if (!Array.isArray(currentVendors)) {
    currentVendors = [];
  }
  const zeroedVendors = currentVendors.map(vend => ({
    ...vend,
    openingBalance: 0,
    openingBalanceType: undefined,
    openingBalanceDate: undefined
  }));
  localStorage.setItem(VENDORS_STORAGE_KEY, JSON.stringify(zeroedVendors));
  localStorage.setItem('alpha_vendors_v1', JSON.stringify(zeroedVendors));
  localStorage.setItem('vendors', JSON.stringify(zeroedVendors));

  // 3. Preserve Items catalog on the items page
  const preservedItemsCount = countKey(DB_ITEMS_KEY);
  const preservedCustomersCount = zeroedCustomers.length;
  const preservedVendorsCount = zeroedVendors.length;

  // 4. Wipe Invoices (Sales & Purchases)
  localStorage.setItem(DB_SALES_INVOICES_KEY, JSON.stringify([]));
  localStorage.setItem(DB_PURCHASES_INVOICES_KEY, JSON.stringify([]));

  // 5. Wipe Vouchers (External & Internal)
  localStorage.setItem(DB_RECEIPT_VOUCHERS_KEY, JSON.stringify([]));
  localStorage.setItem(DB_PAYMENT_VOUCHERS_KEY, JSON.stringify([]));
  localStorage.setItem(DB_INTERNAL_VOUCHERS_KEY, JSON.stringify([]));
  localStorage.setItem(DB_INTERNAL_RECEIPT_VOUCHERS_KEY, JSON.stringify([]));
  localStorage.setItem(DB_INTERNAL_PAYMENT_VOUCHERS_KEY, JSON.stringify([]));

  // 6. Wipe Journal Entries
  localStorage.setItem(JOURNAL_ENTRIES_STORAGE_KEY, JSON.stringify([]));

  // 7. Wipe Transaction Running Balances (Partner movements & Warehouse movements)
  localStorage.setItem('alpha_partner_balances_v1', JSON.stringify([]));
  localStorage.setItem('alpha_partner_balances_v2', JSON.stringify([]));
  localStorage.setItem('alpha_warehouse_balances_v1', JSON.stringify([]));
  localStorage.setItem('alpha_warehouse_balances_v2', JSON.stringify([]));

  // 8. Wipe Operational Transactions & Periodic Inventory Audits
  localStorage.setItem(STORAGE_KEY_INSTALLMENTS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEY_PROMISSORY_NOTES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEY_WORK_ORDERS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEY_INVENTORY_AUDITS, JSON.stringify([]));
  localStorage.setItem('alpha_bank_checks_v1', JSON.stringify([]));
  localStorage.setItem('alpha_stock_transfers_v1', JSON.stringify([]));

  // 9. Reset Document Sequences back to 1 for transactional documents, keeping itemCode sequence intact
  const currentSeqs = getSequences();
  const txSequences: SequencesStore = {
    salesInvoice: 1,
    purchaseInvoice: 1,
    receiptVoucher: 1,
    paymentVoucher: 1,
    internalVoucher: 1,
    internalReceiptVoucher: 1,
    internalPaymentVoucher: 1,
    itemCode: currentSeqs.itemCode || 1,
  };
  saveSequences(txSequences);

  // 10. Dispatch comprehensive notification events across the entire application
  notifyDataChanged();
  dispatchPartnerLedgerUpdated();
  window.dispatchEvent(new Event('alpha-partners-updated'));
  window.dispatchEvent(new Event('alpha-customers-updated'));
  window.dispatchEvent(new Event('alpha-vendors-updated'));
  window.dispatchEvent(new Event('alpha-chart-of-accounts-updated'));
  window.dispatchEvent(new Event('alpha-journal-entries-updated'));
  window.dispatchEvent(new Event('alpha-vouchers-updated'));
  window.dispatchEvent(new Event('alpha-trial-balance-updated'));
  window.dispatchEvent(new Event('alpha-items-updated'));
  window.dispatchEvent(new Event('alpha-inventory-audits-updated'));
  window.dispatchEvent(new Event('alpha-installments-updated'));
  window.dispatchEvent(new Event('alpha-promissory-notes-updated'));
  window.dispatchEvent(new Event('alpha-checks-updated'));
  window.dispatchEvent(new Event('alpha-stock-transfers-updated'));
  window.dispatchEvent(new Event('alpha-work-orders-updated'));
  window.dispatchEvent(new Event('alpha-payroll-updated'));
  window.dispatchEvent(new Event('alpha-master-data-updated'));
  window.dispatchEvent(new Event('alpha-data-changed'));
  window.dispatchEvent(new Event('alpha-system-reset-completed'));
  window.dispatchEvent(new Event('storage'));

  // Reset server account engine in background
  try {
    fetch('/api/accounts/reset', { method: 'POST' }).catch(() => {});
  } catch {}

  // Record critical audit log for transaction reset
  try {
    recordAuditLog({
      action: 'SYSTEM_RESET',
      module: 'SYSTEM',
      documentType: 'تصفير العمليات والفواتير وأرصدة العملاء والموردين',
      summary: `تم تصفير جميع العمليات والفواتير وأرصدة وحركات العملاء والموردين بالكامل مع الإبقاء على ملفاتهم وأصناف المخزون (مسح ${clearedInvoicesCount} فاتورة، و${clearedVouchersCount} سند، و${clearedJournalEntriesCount} قيد، وتصفير أرصدة ${preservedCustomersCount} عميل و${preservedVendorsCount} مورد إلى صفر)`,
      summaryEn: `Reset all transactional data and partner balances while preserving customer, vendor, and item profiles (cleared ${clearedInvoicesCount} invoices, ${clearedVouchersCount} vouchers, ${clearedJournalEntriesCount} journal entries, zeroed balances for ${preservedCustomersCount} customers and ${preservedVendorsCount} vendors)`,
      severity: 'CRITICAL',
      details: {
        clearedInvoicesCount,
        clearedVouchersCount,
        clearedJournalEntriesCount,
        clearedInventoryAuditsCount,
        preservedItemsCount,
        preservedCustomersCount,
        preservedVendorsCount
      }
    });
  } catch (e) {
    console.error('Audit logging failed on reset:', e);
  }

  return {
    success: true,
    resetType: 'TRANSACTIONS_ONLY',
    clearedItemsCount: 0,
    clearedCustomersCount: 0,
    clearedVendorsCount: 0,
    clearedInvoicesCount,
    clearedVouchersCount,
    clearedJournalEntriesCount,
    clearedInventoryAuditsCount,
    preservedItemsCount,
    preservedCustomersCount,
    preservedVendorsCount,
    timestamp: new Date().toISOString()
  };
}

/**
 * Level 2 Reset: Resets the entire application to clean factory defaults.
 * Clears all user-entered records: Customers, Vendors, Items Catalog,
 * Invoices, Vouchers, Journal Entries, Partner & Warehouse Balances,
 * Payroll, Manufacturing, Installments, and resets Document Sequences to 1.
 */
export function resetEntireSystemToFactoryDefaults(): ResetSummary {
  if (typeof window === 'undefined') {
    return {
      success: false,
      resetType: 'FULL_FACTORY_RESET',
      clearedItemsCount: 0,
      clearedCustomersCount: 0,
      clearedVendorsCount: 0,
      clearedInvoicesCount: 0,
      clearedVouchersCount: 0,
      clearedJournalEntriesCount: 0,
      clearedInventoryAuditsCount: 0,
      timestamp: new Date().toISOString()
    };
  }

  // Count existing records before deletion
  const countKey = (key: string): number => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  };

  const clearedItemsCount = Math.max(
    countKey(DB_ITEMS_KEY),
    countKey('alpha_warehouse_items_v1'),
    countKey('alpha_warehouse_balances_v2')
  );
  const clearedCustomersCount = Math.max(
    countKey(CUSTOMERS_STORAGE_KEY),
    countKey('alpha_customers_v1'),
    countKey('customers')
  );
  const clearedVendorsCount = Math.max(
    countKey(VENDORS_STORAGE_KEY),
    countKey('alpha_vendors_v1'),
    countKey('vendors')
  );
  const clearedInvoicesCount = countKey(DB_SALES_INVOICES_KEY) + countKey(DB_PURCHASES_INVOICES_KEY);
  const clearedVouchersCount = 
    countKey(DB_RECEIPT_VOUCHERS_KEY) + 
    countKey(DB_PAYMENT_VOUCHERS_KEY) + 
    countKey(DB_INTERNAL_VOUCHERS_KEY) + 
    countKey(DB_INTERNAL_RECEIPT_VOUCHERS_KEY) + 
    countKey(DB_INTERNAL_PAYMENT_VOUCHERS_KEY);
  const clearedJournalEntriesCount = countKey(JOURNAL_ENTRIES_STORAGE_KEY);
  const clearedInventoryAuditsCount = countKey(STORAGE_KEY_INVENTORY_AUDITS);

  // 1. Wipe Master Data completely (Items, Customers, Vendors, Partner Balances, Warehouse Balances)
  localStorage.setItem(DB_ITEMS_KEY, JSON.stringify([]));
  localStorage.setItem('alpha_warehouse_items_v1', JSON.stringify([]));
  localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify([]));
  localStorage.setItem('alpha_customers_v1', JSON.stringify([]));
  localStorage.setItem('customers', JSON.stringify([]));
  localStorage.setItem(VENDORS_STORAGE_KEY, JSON.stringify([]));
  localStorage.setItem('alpha_vendors_v1', JSON.stringify([]));
  localStorage.setItem('vendors', JSON.stringify([]));
  localStorage.setItem('alpha_partner_balances_v1', JSON.stringify([]));
  localStorage.setItem('alpha_partner_balances_v2', JSON.stringify([]));
  localStorage.setItem('alpha_warehouse_balances_v1', JSON.stringify([]));
  localStorage.setItem('alpha_warehouse_balances_v2', JSON.stringify([]));

  // 2. Wipe Invoices (Sales & Purchases)
  localStorage.setItem(DB_SALES_INVOICES_KEY, JSON.stringify([]));
  localStorage.setItem(DB_PURCHASES_INVOICES_KEY, JSON.stringify([]));

  // 3. Wipe Vouchers (External & Internal)
  localStorage.setItem(DB_RECEIPT_VOUCHERS_KEY, JSON.stringify([]));
  localStorage.setItem(DB_PAYMENT_VOUCHERS_KEY, JSON.stringify([]));
  localStorage.setItem(DB_INTERNAL_VOUCHERS_KEY, JSON.stringify([]));
  localStorage.setItem(DB_INTERNAL_RECEIPT_VOUCHERS_KEY, JSON.stringify([]));
  localStorage.setItem(DB_INTERNAL_PAYMENT_VOUCHERS_KEY, JSON.stringify([]));

  // 4. Wipe Journal Entries
  localStorage.setItem(JOURNAL_ENTRIES_STORAGE_KEY, JSON.stringify([]));

  // 5. Wipe Operational Modules (Installments, Promissory Notes, Payroll, Manufacturing, Inventory Audits)
  localStorage.setItem(STORAGE_KEY_INSTALLMENTS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEY_PROMISSORY_NOTES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify([]));
  localStorage.setItem('alpha_payroll_employees_v1', JSON.stringify([]));
  localStorage.setItem(STORAGE_KEY_BOM, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEY_WORK_ORDERS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEY_WORK_CENTERS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEY_INVENTORY_AUDITS, JSON.stringify([]));
  localStorage.setItem('alpha_bank_checks_v1', JSON.stringify([]));
  localStorage.setItem('alpha_stock_transfers_v1', JSON.stringify([]));
  localStorage.setItem('alpha_audit_trail_v1', JSON.stringify([]));

  // 6. Reset Chart of Accounts to default standard base
  localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(DEFAULT_ACCOUNTS));

  // 7. Reset Document Sequences back to 1
  const cleanSequences: SequencesStore = {
    salesInvoice: 1,
    purchaseInvoice: 1,
    receiptVoucher: 1,
    paymentVoucher: 1,
    internalVoucher: 1,
    internalReceiptVoucher: 1,
    internalPaymentVoucher: 1,
    itemCode: 1,
  };
  saveSequences(cleanSequences);

  // 8. Reset System & Printing Settings
  saveSystemSettings(DEFAULT_SETTINGS);
  savePrintPaperFormat('A4');
  savePrintColorMode('bw');
  localStorage.removeItem('alpha_master_database_settings_v1');
  localStorage.setItem('alpha_cost_centers_v1', JSON.stringify([]));
  localStorage.removeItem('alpha_custom_warehouses_v1');

  // 9. Dispatch comprehensive notification events across the entire application
  notifyDataChanged();
  dispatchPartnerLedgerUpdated();
  window.dispatchEvent(new Event('alpha-partners-updated'));
  window.dispatchEvent(new Event('alpha-customers-updated'));
  window.dispatchEvent(new Event('alpha-vendors-updated'));
  window.dispatchEvent(new Event('alpha-chart-of-accounts-updated'));
  window.dispatchEvent(new Event('alpha-cost-centers-updated'));
  window.dispatchEvent(new Event('alpha-journal-entries-updated'));
  window.dispatchEvent(new Event('alpha-vouchers-updated'));
  window.dispatchEvent(new Event('alpha-trial-balance-updated'));
  window.dispatchEvent(new Event('alpha-items-updated'));
  window.dispatchEvent(new Event('alpha-stock-updated'));
  window.dispatchEvent(new Event('alpha-installments-updated'));
  window.dispatchEvent(new Event('alpha-promissory-notes-updated'));
  window.dispatchEvent(new Event('alpha-checks-updated'));
  window.dispatchEvent(new Event('alpha-stock-transfers-updated'));
  window.dispatchEvent(new Event('alpha-audit-trail-updated'));
  window.dispatchEvent(new Event('alpha-bom-updated'));
  window.dispatchEvent(new Event('alpha-work-orders-updated'));
  window.dispatchEvent(new Event('alpha-work-centers-updated'));
  window.dispatchEvent(new Event('alpha-inventory-audits-updated'));
  window.dispatchEvent(new Event('alpha-payroll-updated'));
  window.dispatchEvent(new Event('alpha-master-data-updated'));
  window.dispatchEvent(new Event('alpha-data-changed'));
  window.dispatchEvent(new Event('alpha-system-reset-completed'));
  window.dispatchEvent(new Event('storage'));

  // Reset server account engine in background
  try {
    fetch('/api/accounts/reset', { method: 'POST' }).catch(() => {});
  } catch {}

  // Record audit log for full factory reset
  try {
    recordAuditLog({
      action: 'SYSTEM_RESET',
      module: 'SYSTEM',
      documentType: 'استعادة ضبط المصنع الكامل',
      summary: `تمت استعادة ضبط المصنع ومسح كافة البيانات وسجلات وأسماء العملاء (${clearedCustomersCount}) والموردين (${clearedVendorsCount}) والأصناف (${clearedItemsCount}) والفواتير والعمليات بالكامل`,
      summaryEn: `Full factory reset: cleared all customers (${clearedCustomersCount}), vendors (${clearedVendorsCount}), items (${clearedItemsCount}), invoices, vouchers, and transactions`,
      severity: 'CRITICAL',
      details: {
        clearedCustomersCount,
        clearedVendorsCount,
        clearedItemsCount,
        clearedInvoicesCount,
        clearedVouchersCount,
        clearedJournalEntriesCount,
        clearedInventoryAuditsCount
      }
    });
  } catch (e) {
    console.error('Audit logging failed on factory reset:', e);
  }

  return {
    success: true,
    resetType: 'FULL_FACTORY_RESET',
    clearedItemsCount,
    clearedCustomersCount,
    clearedVendorsCount,
    clearedInvoicesCount,
    clearedVouchersCount,
    clearedJournalEntriesCount,
    clearedInventoryAuditsCount,
    timestamp: new Date().toISOString()
  };
}

/**
 * Dedicated Reset: Resets only Periodic Inventory Count Audits & Reconciliations
 * Clears alpha_inventory_audits_v1 without touching financial transactions or items catalog.
 */
export function resetInventoryAuditsOnly(): {
  success: boolean;
  clearedAuditsCount: number;
  timestamp: string;
} {
  if (typeof window === 'undefined') {
    return { success: false, clearedAuditsCount: 0, timestamp: new Date().toISOString() };
  }

  const countKey = (key: string): number => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  };

  const clearedAuditsCount = countKey(STORAGE_KEY_INVENTORY_AUDITS);
  localStorage.setItem(STORAGE_KEY_INVENTORY_AUDITS, JSON.stringify([]));

  notifyDataChanged();
  window.dispatchEvent(new Event('alpha-inventory-audits-updated'));
  window.dispatchEvent(new Event('alpha-data-changed'));
  window.dispatchEvent(new Event('storage'));

  return {
    success: true,
    clearedAuditsCount,
    timestamp: new Date().toISOString()
  };
}
