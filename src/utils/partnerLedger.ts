import { enqueueSyncRecord } from "../services/DatabaseProvider";
import { Partner, VoucherType, JournalEntryStatus } from '../types/accounting';
import { getCurrencyInfo } from './currency';
import { 
  DB_SALES_INVOICES_KEY, 
  DB_PURCHASES_INVOICES_KEY, 
  DB_RECEIPT_VOUCHERS_KEY, 
  DB_PAYMENT_VOUCHERS_KEY 
} from './sequences';
import { notifyDataChanged } from './localFolderBackup';
import { loadJournalEntries } from './trialBalanceStore';

export const CUSTOMERS_STORAGE_KEY = 'accounting_customers';
export const VENDORS_STORAGE_KEY = 'accounting_vendors';

export const DEFAULT_CUSTOMERS_LIST: Partner[] = [];

export const DEFAULT_VENDORS_LIST: Partner[] = [];

export interface StoredInvoiceTotals {
  subtotal: number;
  totalDiscount: number;
  netTotal: number;
  taxAmount: number;
  grandTotal: number;
  cashPaid?: number;
  remainingBalance?: number;
}

export interface StoredSalesInvoiceRecord {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  partnerId: string;
  partnerName: string;
  partnerTaxNo?: string;
  classification?: string;
  invoiceType?: string;
  source?: string;
  safe?: string;
  items: any[];
  totals: StoredInvoiceTotals;
  status: 'DRAFT' | 'POSTED';
  notes?: string;
  createdAt: string;
}

export interface StoredPurchaseInvoiceRecord {
  id: string;
  invoiceNumber: string;
  supplierRef?: string;
  date: string;
  dueDate?: string;
  partnerId: string;
  partnerName: string;
  classification?: string;
  invoiceType?: string;
  source?: string;
  safe?: string;
  items: any[];
  totals: StoredInvoiceTotals;
  status: 'DRAFT' | 'POSTED';
  notes?: string;
  createdAt: string;
}

import { VoucherInvoiceAllocation, applyVoucherAllocations } from './invoiceAllocation';
export type { VoucherInvoiceAllocation };

export interface StoredVoucherRecord {
  id: string;
  type: VoucherType;
  voucherNumber: string;
  date: string;
  partnerId: string;
  partnerName: string;
  partnerType?: 'CUSTOMER' | 'VENDOR';
  accountId: string;
  amount: number;
  description: string;
  status?: 'DRAFT' | 'POSTED';
  postedAt?: string | undefined;
  createdAt: string;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'SPAN' | 'OTHER' | undefined;
  referenceNo?: string | undefined;
  bankName?: string | undefined;
  checkDueDate?: string | undefined;
  costCenterId?: string | undefined;
  costCenterName?: string | undefined;
  allocations?: VoucherInvoiceAllocation[] | undefined;
  // دورة الاعتماد الهرمية (Approval Hierarchy)
  requiresApproval?: boolean | undefined;
  approvalStatus?: 'NOT_REQUIRED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | undefined;
  approvedBy?: string | undefined;
  approvedAt?: string | undefined;
  approvalRole?: string | undefined;
  approvalNotes?: string | undefined;
  rejectedBy?: string | undefined;
  rejectedAt?: string | undefined;
  rejectionReason?: string | undefined;
  preparedBy?: string | undefined;
  disbursedBy?: string | undefined;
}

export interface PartnerLedgerTx {
  id: string;
  date: string;
  type: 'OPENING' | 'SALES_INVOICE' | 'PURCHASE_INVOICE' | 'RECEIPT_VOUCHER' | 'PAYMENT_VOUCHER' | 'JOURNAL_ENTRY';
  docTypeLabel: string;
  docNumber: string;
  description: string;
  debit: number; // مدين
  credit: number; // دائن
  runningBalance: number;
  runningBalanceType: 'DEBIT' | 'CREDIT' | 'ZERO';
  status?: 'POSTED' | 'DRAFT';
  rawDoc?: any;
}

export interface PartnerStatement {
  partner: Partner;
  partnerType: 'CUSTOMER' | 'VENDOR';
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
  balance: number; // alias to netBalance
  balanceType: 'DEBIT' | 'CREDIT' | 'ZERO';
  balanceLabel: string;
  balanceFormatted: string;
  totalSalesInvoices: number;
  totalPurchaseInvoices: number;
  totalReceiptVouchers: number;
  totalPaymentVouchers: number;
  totalJournalEntries?: number;
  totalWithdrawals: number; // إجمالي المسحوبات/الفواتير
  totalPayments: number; // إجمالي المدفوعات/السندات
  lastTransactionDate: string;
  transactions: PartnerLedgerTx[];
}

export function dispatchPartnerLedgerUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('alpha-partner-ledger-updated'));
    notifyDataChanged();
  }
}

export function loadCustomers(): Partner[] {
  if (typeof window === 'undefined') return DEFAULT_CUSTOMERS_LIST;
  try {
    const raw = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load customers:', e);
  }
  try {
    localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(DEFAULT_CUSTOMERS_LIST));
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_CUSTOMERS_LIST;
}

export function saveCustomers(customers: Partner[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(customers));
    dispatchPartnerLedgerUpdated();
  } catch (e) {
    console.error('Failed to save customers:', e);
  }
}
export const saveCustomersList = saveCustomers;

export function loadVendors(): Partner[] {
  if (typeof window === 'undefined') return DEFAULT_VENDORS_LIST;
  try {
    const raw = localStorage.getItem(VENDORS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load vendors:', e);
  }
  try {
    localStorage.setItem(VENDORS_STORAGE_KEY, JSON.stringify(DEFAULT_VENDORS_LIST));
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_VENDORS_LIST;
}

export function saveVendors(vendors: Partner[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VENDORS_STORAGE_KEY, JSON.stringify(vendors));
    dispatchPartnerLedgerUpdated();
  } catch (e) {
    console.error('Failed to save vendors:', e);
  }
}
export const saveVendorsList = saveVendors;

export function loadSalesInvoices(): StoredSalesInvoiceRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DB_SALES_INVOICES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load sales invoices:', e);
  }
  return [];
}

export function loadPurchaseInvoices(): StoredPurchaseInvoiceRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DB_PURCHASES_INVOICES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load purchase invoices:', e);
  }
  return [];
}

export const DEFAULT_RECEIPT_VOUCHERS: StoredVoucherRecord[] = [];

export const DEFAULT_PAYMENT_VOUCHERS: StoredVoucherRecord[] = [];

export function loadReceiptVouchers(): StoredVoucherRecord[] {
  if (typeof window === 'undefined') return DEFAULT_RECEIPT_VOUCHERS;
  try {
    const raw = localStorage.getItem(DB_RECEIPT_VOUCHERS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load receipt vouchers:', e);
  }
  try {
    localStorage.setItem(DB_RECEIPT_VOUCHERS_KEY, JSON.stringify(DEFAULT_RECEIPT_VOUCHERS));
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_RECEIPT_VOUCHERS;
}

export function loadPaymentVouchers(): StoredVoucherRecord[] {
  if (typeof window === 'undefined') return DEFAULT_PAYMENT_VOUCHERS;
  try {
    const raw = localStorage.getItem(DB_PAYMENT_VOUCHERS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load payment vouchers:', e);
  }
  try {
    localStorage.setItem(DB_PAYMENT_VOUCHERS_KEY, JSON.stringify(DEFAULT_PAYMENT_VOUCHERS));
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_PAYMENT_VOUCHERS;
}

/**
 * Loads all vouchers (both Receipt and Payment) combined, enriched and sorted
 */
export function loadAllVouchers(): StoredVoucherRecord[] {
  const receipts = loadReceiptVouchers();
  const payments = loadPaymentVouchers();
  const combined = [...receipts, ...payments];
  return combined.sort((a, b) => {
    const timeA = new Date(a.date || a.createdAt).getTime();
    const timeB = new Date(b.date || b.createdAt).getTime();
    return timeB - timeA;
  });
}

/**
 * Matches partner ID or Name against a target Partner.
 */
function isPartnerMatch(docPartnerId: string | undefined, docPartnerName: string | undefined, targetPartner: Partner): boolean {
  if (docPartnerId && targetPartner.id && docPartnerId.trim().toLowerCase() === targetPartner.id.trim().toLowerCase()) {
    return true;
  }
  if (docPartnerName && targetPartner.name && docPartnerName.trim().toLowerCase() === targetPartner.name.trim().toLowerCase()) {
    return true;
  }
  // Also match fallback numbers (e.g., '1' or 'c-1' or 'cust-1001')
  if (docPartnerId && targetPartner.id) {
    const cleanDoc = docPartnerId.replace(/[^0-9]/g, '');
    const cleanTarget = targetPartner.id.replace(/[^0-9]/g, '');
    if (cleanDoc && cleanTarget && cleanDoc === cleanTarget) {
      return true;
    }
  }
  return false;
}

/**
 * Generates a full chronological Statement of Account and balances for a Partner.
 */
export function getPartnerAccountStatement(partner: Partner): PartnerStatement {
  const isCustomer = partner.type === 'CUSTOMER';
  const partnerType = isCustomer ? 'CUSTOMER' : 'VENDOR';
  
  const rawSalesInvoices = loadSalesInvoices();
  const rawPurchaseInvoices = loadPurchaseInvoices();
  const rawReceiptVouchers = loadReceiptVouchers();
  const rawPaymentVouchers = loadPaymentVouchers();

  const openingBal = partner.openingBalance || 0;
  const rawTxList: {
    date: string;
    createdAt: string;
    type: 'OPENING' | 'SALES_INVOICE' | 'PURCHASE_INVOICE' | 'RECEIPT_VOUCHER' | 'PAYMENT_VOUCHER' | 'JOURNAL_ENTRY';
    docTypeLabel: string;
    docNumber: string;
    description: string;
    debit: number;
    credit: number;
    status?: 'POSTED' | 'DRAFT';
    rawDoc?: any;
  }[] = [];

  // 1. Opening Balance Transaction
  if (openingBal !== 0) {
    if (isCustomer) {
      // For customer: positive is Debit (owes us), negative is Credit (advance)
      rawTxList.push({
        date: partner.openingBalanceDate || '2026-01-01',
        createdAt: '2026-01-01T00:00:00.000Z',
        type: 'OPENING',
        docTypeLabel: 'رصيد افتتاحي',
        docNumber: 'OP-001',
        description: 'رصيد افتتاحي مرحل لحساب العميل',
        debit: openingBal > 0 ? openingBal : 0,
        credit: openingBal < 0 ? Math.abs(openingBal) : 0,
        status: 'POSTED'
      });
    } else {
      // For vendor: negative or positive credit. If openingBalance < 0, it means credit (we owe vendor).
      const creditVal = openingBal < 0 ? Math.abs(openingBal) : 0;
      const debitVal = openingBal > 0 ? openingBal : 0;
      rawTxList.push({
        date: partner.openingBalanceDate || '2026-01-01',
        createdAt: '2026-01-01T00:00:00.000Z',
        type: 'OPENING',
        docTypeLabel: 'رصيد افتتاحي',
        docNumber: 'OP-V1',
        description: 'رصيد افتتاحي مرحل لحساب المورد',
        debit: debitVal,
        credit: creditVal,
        status: 'POSTED'
      });
    }
  }

  let totalSalesCount = 0;
  let totalPurchaseCount = 0;
  let totalReceiptCount = 0;
  let totalPaymentCount = 0;

  const todayStr = new Date().toISOString().split('T')[0] as string;
  const nowStr = new Date().toISOString();

  // 2. Sales Invoices
  rawSalesInvoices.forEach(inv => {
    if (isPartnerMatch(inv.partnerId, inv.partnerName, partner)) {
      const invStatus = inv.status || 'DRAFT';
      const isPosted = invStatus === 'POSTED';
      if (isPosted) totalSalesCount++;
      const grandTotal = inv.totals?.grandTotal ?? 0;
      const cashPaid = inv.totals?.cashPaid ?? 0;
      const itemsCount = inv.items?.length || 0;
      const isReturn = inv.invoiceType?.includes('RETURN');
      const docLabel = isReturn ? 'مرتجع مبيعات' : 'فاتورة مبيعات';
      const desc = `${docLabel} #${inv.invoiceNumber} (${itemsCount} بنود) ${inv.notes ? '- ' + inv.notes : ''}${!isPosted ? ' (مسودة - غير مرحلة)' : ''}`;
      
      // Customer is debited for invoice total. Only POSTED invoices affect balance.
      // If it's a return, customer is CREDITED.
      rawTxList.push({
        date: inv.date || todayStr,
        createdAt: inv.createdAt || nowStr,
        type: 'SALES_INVOICE',
        docTypeLabel: isPosted ? `${docLabel} (مرحلة)` : `${docLabel} (مسودة - غير مرحلة)`,
        docNumber: `#${inv.invoiceNumber}`,
        description: desc,
        debit: isPosted && !isReturn ? grandTotal : 0,
        credit: isPosted && isReturn ? grandTotal : 0,
        status: invStatus,
        rawDoc: inv
      });

      // If there was an immediate cash payment recorded on the invoice
      if (cashPaid > 0) {
        rawTxList.push({
          date: inv.date || todayStr,
          createdAt: inv.createdAt || nowStr,
          type: 'RECEIPT_VOUCHER',
          docTypeLabel: isPosted ? 'سداد نقدي بالفاتورة' : 'سداد نقدي (مسودة - غير مرحل)',
          docNumber: `INV-PAY-#${inv.invoiceNumber}`,
          description: `سداد فوري مسجل على ${docLabel} #${inv.invoiceNumber}`,
          debit: isPosted && isReturn ? cashPaid : 0,
          credit: isPosted && !isReturn ? cashPaid : 0,
          status: invStatus,
          rawDoc: inv
        });
      }
    }
  });

  // 3. Purchase Invoices
  rawPurchaseInvoices.forEach(inv => {
    if (isPartnerMatch(inv.partnerId, inv.partnerName, partner)) {
      const invStatus = inv.status || 'DRAFT';
      const isPosted = invStatus === 'POSTED';
      if (isPosted) totalPurchaseCount++;
      const grandTotal = inv.totals?.grandTotal ?? 0;
      const cashPaid = inv.totals?.cashPaid ?? 0;
      const itemsCount = inv.items?.length || 0;
      const isReturn = inv.invoiceType?.includes('RETURN');
      const docLabel = isReturn ? 'مرتجع مشتريات' : 'فاتورة مشتريات';
      const desc = `${docLabel} #${inv.invoiceNumber} ${inv.supplierRef ? '(مرجع: ' + inv.supplierRef + ')' : ''} (${itemsCount} بنود)${!isPosted ? ' (مسودة - غير مرحلة)' : ''}`;

      // Vendor is credited for invoice total (we owe vendor). Only POSTED invoices affect balance.
      // If it's a return, vendor is DEBITED.
      rawTxList.push({
        date: inv.date || todayStr,
        createdAt: inv.createdAt || nowStr,
        type: 'PURCHASE_INVOICE',
        docTypeLabel: isPosted ? `${docLabel} (مرحلة)` : `${docLabel} (مسودة - غير مرحلة)`,
        docNumber: `#${inv.invoiceNumber}`,
        description: desc,
        debit: isPosted && isReturn ? grandTotal : 0,
        credit: isPosted && !isReturn ? grandTotal : 0,
        status: invStatus,
        rawDoc: inv
      });

      // If there was an immediate cash payment recorded on the purchase invoice
      if (cashPaid > 0) {
        rawTxList.push({
          date: inv.date || todayStr,
          createdAt: inv.createdAt || nowStr,
          type: 'PAYMENT_VOUCHER',
          docTypeLabel: isPosted ? 'سداد نقدي بالفاتورة' : 'سداد نقدي (مسودة - غير مرحل)',
          docNumber: `PO-PAY-#${inv.invoiceNumber}`,
          description: `سداد فوري مسجل على ${docLabel} #${inv.invoiceNumber}`,
          debit: isPosted && !isReturn ? cashPaid : 0,
          credit: isPosted && isReturn ? cashPaid : 0,
          status: invStatus,
          rawDoc: inv
        });
      }
    }
  });

  // 4. Receipt Vouchers (سندات القبض الخارجية)
  rawReceiptVouchers.forEach(v => {
    if (isPartnerMatch(v.partnerId, v.partnerName, partner)) {
      const vStatus = v.status || 'DRAFT';
      const isPosted = vStatus === 'POSTED';
      if (isPosted) totalReceiptCount++;
      const amount = Number(v.amount) || 0;
      const accountLabel = v.accountId === 'bank' ? 'البنك الأهلي' : 'الصندوق الرئيسي';
      const desc = `${v.description || 'سند قبض نقدية'} [${accountLabel}]${!isPosted ? ' (مسودة - غير مرحل)' : ''}`;

      // Receipt from customer -> Credit to customer (reduces receivable)
      // Receipt from vendor -> Credit to vendor (reduces debit/advance)
      // Only POSTED vouchers affect the accounting running balance
      rawTxList.push({
        date: v.date || todayStr,
        createdAt: v.createdAt || nowStr,
        type: 'RECEIPT_VOUCHER',
        docTypeLabel: isPosted ? 'سند قبض خارجي (مرحل)' : 'سند قبض (مسودة - غير مرحل)',
        docNumber: `#${v.voucherNumber}`,
        description: desc,
        debit: 0,
        credit: isPosted ? amount : 0,
        status: vStatus,
        rawDoc: v
      });
    }
  });

  // 5. Payment Vouchers (سندات الصرف الخارجية)
  rawPaymentVouchers.forEach(v => {
    if (isPartnerMatch(v.partnerId, v.partnerName, partner)) {
      const vStatus = v.status || 'DRAFT';
      const isPosted = vStatus === 'POSTED';
      if (isPosted) totalPaymentCount++;
      const amount = Number(v.amount) || 0;
      const accountLabel = v.accountId === 'bank' ? 'البنك الأهلي' : 'الصندوق الرئيسي';
      const desc = `${v.description || 'سند صرف نقدية'} [${accountLabel}]${!isPosted ? ' (مسودة - غير مرحل)' : ''}`;

      // Payment to vendor -> Debit to vendor (reduces payable)
      // Payment to customer -> Debit to customer (refund/deposit)
      // Only POSTED vouchers affect the accounting running balance
      rawTxList.push({
        date: v.date || todayStr,
        createdAt: v.createdAt || nowStr,
        type: 'PAYMENT_VOUCHER',
        docTypeLabel: isPosted ? 'سند صرف خارجي (مرحل)' : 'سند صرف (مسودة - غير مرحل)',
        docNumber: `#${v.voucherNumber}`,
        description: desc,
        debit: isPosted ? amount : 0,
        credit: 0,
        status: vStatus,
        rawDoc: v
      });
    }
  });

  // 6. Manual Journal Entries with Sub-Ledger Partner Tags (المدرسة الثانية: قيود اليومية المرتبطة بدفتر الأستاذ المساعد)
  let totalJournalCount = 0;
  const rawJournalEntries = loadJournalEntries();
  rawJournalEntries.forEach(entry => {
    if (entry.status !== JournalEntryStatus.Posted) return;
    
    // Check all items in this entry that match the partner
    entry.items.forEach((item, itemIdx) => {
      const match = isPartnerMatch(item.partnerId, item.partnerName, partner);
      if (match) {
        totalJournalCount++;
        const debitAmt = Number(item.debit) || 0;
        const creditAmt = Number(item.credit) || 0;
        const entryDesc = item.partnerName
          ? `قيد يومية #${entry.entryNumber} - ${entry.description || 'تسوية محاسبية'} [حساب مراقبة: ${item.partnerName}]`
          : `قيد يومية #${entry.entryNumber} - ${entry.description || 'تسوية محاسبية'}`;

        rawTxList.push({
          date: entry.date || todayStr,
          createdAt: `${entry.date}T00:00:${String(itemIdx).padStart(2, '0')}.000Z`,
          type: 'JOURNAL_ENTRY',
          docTypeLabel: 'قيد يومية عامة (Sub-Ledger)',
          docNumber: `#${entry.entryNumber}`,
          description: entryDesc,
          debit: debitAmt,
          credit: creditAmt,
          status: 'POSTED',
          rawDoc: entry
        });
      }
    });
  });

  // Chronological sorting
  rawTxList.sort((a, b) => {
    const cmpDate = a.date.localeCompare(b.date);
    if (cmpDate !== 0) return cmpDate;
    return a.createdAt.localeCompare(b.createdAt);
  });

  // Calculate Running Balances
  let currentRunningBal = 0;
  let totalDebitSum = 0;
  let totalCreditSum = 0;
  let lastTxDate = partner.openingBalanceDate || '2026-01-01';

  const transactions: PartnerLedgerTx[] = rawTxList.map((tx, idx) => {
    totalDebitSum += tx.debit;
    totalCreditSum += tx.credit;
    lastTxDate = tx.date;

    if (isCustomer) {
      // For Customer: Net = Debit - Credit
      currentRunningBal += (tx.debit - tx.credit);
    } else {
      // For Vendor: Net Owed = Credit - Debit
      currentRunningBal += (tx.credit - tx.debit);
    }

    let runningType: 'DEBIT' | 'CREDIT' | 'ZERO' = 'ZERO';
    if (currentRunningBal > 0.001) {
      runningType = isCustomer ? 'DEBIT' : 'CREDIT';
    } else if (currentRunningBal < -0.001) {
      runningType = isCustomer ? 'CREDIT' : 'DEBIT';
    }

    return {
      ...tx,
      id: `tx-${partner.id}-${idx + 1}-${tx.type}`,
      runningBalance: Math.abs(currentRunningBal),
      runningBalanceType: runningType
    };
  });

  // Net Final Position
  let netBalance = 0;
  let balanceType: 'DEBIT' | 'CREDIT' | 'ZERO' = 'ZERO';
  let balanceLabel = 'متزن (0.00)';
  let totalWithdrawals = 0;
  let totalPayments = 0;

  if (isCustomer) {
    netBalance = totalDebitSum - totalCreditSum;
    totalWithdrawals = rawTxList.filter(t => t.type === 'SALES_INVOICE').reduce((s, t) => s + t.debit - t.credit, 0) + (openingBal > 0 ? openingBal : 0);
    totalPayments = rawTxList.filter(t => t.type === 'RECEIPT_VOUCHER').reduce((s, t) => s + t.credit - t.debit, 0);

    if (netBalance > 0.001) {
      balanceType = 'DEBIT';
      balanceLabel = 'مدين (مستحق لنا)';
    } else if (netBalance < -0.001) {
      balanceType = 'CREDIT';
      balanceLabel = 'دائن (دفعة مقدمة له)';
    }
  } else {
    // Vendor
    netBalance = totalCreditSum - totalDebitSum;
    totalWithdrawals = rawTxList.filter(t => t.type === 'PURCHASE_INVOICE').reduce((s, t) => s + t.credit - t.debit, 0) + (openingBal < 0 ? Math.abs(openingBal) : 0);
    totalPayments = rawTxList.filter(t => t.type === 'PAYMENT_VOUCHER').reduce((s, t) => s + t.debit - t.credit, 0);

    if (netBalance > 0.001) {
      balanceType = 'CREDIT';
      balanceLabel = 'دائن (مستحق للمورد)';
    } else if (netBalance < -0.001) {
      balanceType = 'DEBIT';
      balanceLabel = 'مدين (دفعة مقدمة لنا)';
    }
  }

  const absNet = Math.abs(netBalance);
  const balanceFormatted = absNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return {
    partner,
    partnerType,
    openingBalance: openingBal,
    totalDebit: totalDebitSum,
    totalCredit: totalCreditSum,
    netBalance: absNet,
    balance: absNet,
    balanceType,
    balanceLabel,
    balanceFormatted,
    totalSalesInvoices: totalSalesCount,
    totalPurchaseInvoices: totalPurchaseCount,
    totalReceiptVouchers: totalReceiptCount,
    totalPaymentVouchers: totalPaymentCount,
    totalJournalEntries: totalJournalCount,
    totalWithdrawals,
    totalPayments,
    lastTransactionDate: lastTxDate,
    transactions
  };
}

/**
 * Quick balance lookup for a partner by ID.
 */
export function getPartnerCurrentBalance(partnerId: string, partnerType?: 'CUSTOMER' | 'VENDOR'): {
  partner: Partner | null;
  balanceAmount: number;
  balanceType: 'DEBIT' | 'CREDIT' | 'ZERO';
  balanceText: string;
  badgeColorClass: string;
} {
  const customers = loadCustomers();
  const vendors = loadVendors();

  let targetPartner: Partner | undefined;
  if (partnerType === 'CUSTOMER') {
    targetPartner = customers.find(c => c.id === partnerId || c.name === partnerId);
  } else if (partnerType === 'VENDOR') {
    targetPartner = vendors.find(v => v.id === partnerId || v.name === partnerId);
  } else {
    targetPartner = customers.find(c => c.id === partnerId || c.name === partnerId) 
      || vendors.find(v => v.id === partnerId || v.name === partnerId);
  }

  if (!targetPartner) {
    return {
      partner: null,
      balanceAmount: 0,
      balanceType: 'ZERO',
      balanceText: 'رصيد 0.00',
      badgeColorClass: 'bg-slate-100 text-slate-600 border-slate-200'
    };
  }

  const statement = getPartnerAccountStatement(targetPartner);
  let badgeColorClass = 'bg-slate-100 text-slate-600 border-slate-200';
  if (statement.balanceType === 'DEBIT') {
    badgeColorClass = 'bg-emerald-50 text-emerald-700 border-emerald-300';
  } else if (statement.balanceType === 'CREDIT') {
    badgeColorClass = 'bg-amber-50 text-amber-700 border-amber-300';
  }

  const currencySymbol = getCurrencyInfo().symbol;

  return {
    partner: targetPartner,
    balanceAmount: statement.netBalance,
    balanceType: statement.balanceType,
    balanceText: `${statement.balanceFormatted} ${currencySymbol} (${statement.balanceLabel})`,
    badgeColorClass
  };
}

export interface InvoicePartnerBalanceImpact {
  partnerName: string;
  partnerType: 'CUSTOMER' | 'VENDOR';
  previousBalance: number;
  previousBalanceFormatted: string;
  previousBalanceType: 'DEBIT' | 'CREDIT' | 'ZERO';
  previousBalanceLabel: string;
  invoiceAmount: number;
  invoiceAmountFormatted: string;
  paidAmount: number;
  paidAmountFormatted: string;
  remainingAmount: number;
  remainingAmountFormatted: string;
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
  paymentStatusLabel: string;
  newBalance: number;
  newBalanceFormatted: string;
  newBalanceType: 'DEBIT' | 'CREDIT' | 'ZERO';
  newBalanceLabel: string;
}

/**
 * Calculates accurate previous balance, paid amount, remaining amount, and new balance after the invoice for Customer/Vendor
 */
export function calculateInvoicePartnerImpact(
  partner: Partner | null | undefined,
  invoiceAmount: number,
  paidAmount: number = 0,
  excludeInvoiceNumber?: string,
  invoiceType: 'CUSTOMER' | 'VENDOR' = 'CUSTOMER',
  existingStatement?: PartnerStatement | null,
  isReturn: boolean = false
): InvoicePartnerBalanceImpact | null {
  if (!partner) return null;

  const isCustomer = (partner.type || invoiceType) === 'CUSTOMER';
  const fullStatement = existingStatement || getPartnerAccountStatement(partner);
  
  let prevNetSigned = 0; // Customer: positive = debit. Vendor: positive = credit.
  
  if (excludeInvoiceNumber && fullStatement.transactions.length > 0) {
    const rawNum = excludeInvoiceNumber.replace(/^#/, '');
    const safeDocNum = `#${rawNum}`;
    const payDocNum1 = `INV-PAY-#${rawNum}`;
    const payDocNum2 = `PO-PAY-#${rawNum}`;
    
    const otherTxs = fullStatement.transactions.filter(t => 
      t.docNumber !== safeDocNum && 
      t.docNumber !== rawNum && 
      t.docNumber !== payDocNum1 && 
      t.docNumber !== payDocNum2
    );
    
    let debitSum = 0;
    let creditSum = 0;
    otherTxs.forEach(t => {
      debitSum += t.debit;
      creditSum += t.credit;
    });

    if (isCustomer) {
      prevNetSigned = debitSum - creditSum;
    } else {
      prevNetSigned = creditSum - debitSum;
    }
  } else {
    if (isCustomer) {
      prevNetSigned = fullStatement.balanceType === 'DEBIT' 
        ? fullStatement.netBalance 
        : fullStatement.balanceType === 'CREDIT' 
        ? -fullStatement.netBalance 
        : 0;
    } else {
      prevNetSigned = fullStatement.balanceType === 'CREDIT' 
        ? fullStatement.netBalance 
        : fullStatement.balanceType === 'DEBIT' 
        ? -fullStatement.netBalance 
        : 0;
    }
  }

  const prevAbs = Math.abs(prevNetSigned);
  let prevType: 'DEBIT' | 'CREDIT' | 'ZERO' = 'ZERO';
  let prevLabel = 'متزن (0.00)';

  if (isCustomer) {
    if (prevNetSigned > 0.001) {
      prevType = 'DEBIT';
      prevLabel = 'مدين (مستحق لنا)';
    } else if (prevNetSigned < -0.001) {
      prevType = 'CREDIT';
      prevLabel = 'دائن (رصيد للعميل)';
    }
  } else {
    if (prevNetSigned > 0.001) {
      prevType = 'CREDIT';
      prevLabel = 'دائن (مستحق للمورد)';
    } else if (prevNetSigned < -0.001) {
      prevType = 'DEBIT';
      prevLabel = 'مدين (دفعة مقدمة)';
    }
  }

  const cleanInvoiceAmount = Number(invoiceAmount) || 0;
  const cleanPaidAmount = Math.max(0, Math.min(cleanInvoiceAmount, Number(paidAmount) || 0));
  const remainingAmount = Math.max(0, cleanInvoiceAmount - cleanPaidAmount);

  // Payment status determination
  let paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID' = 'UNPAID';
  let paymentStatusLabel = 'آجلة (غير مسددة)';

  if (cleanInvoiceAmount > 0) {
    if (cleanPaidAmount >= cleanInvoiceAmount - 0.001) {
      paymentStatus = 'PAID';
      paymentStatusLabel = 'نقدية (مسددة بالكامل)';
    } else if (cleanPaidAmount > 0.001) {
      paymentStatus = 'PARTIAL';
      paymentStatusLabel = 'جزئية (مسدد جزء)';
    } else {
      paymentStatus = 'UNPAID';
      paymentStatusLabel = 'آجلة (غير مسددة)';
    }
  }

  // Net effect on balance is only the remaining unpaid amount
  // If it is a return, it reduces the debt.
  const netAdditionToDebt = isReturn ? -remainingAmount : remainingAmount;
  const newNetSigned = prevNetSigned + netAdditionToDebt;
  const newAbs = Math.abs(newNetSigned);
  let newType: 'DEBIT' | 'CREDIT' | 'ZERO' = 'ZERO';
  let newLabel = 'متزن (0.00)';

  if (isCustomer) {
    if (newNetSigned > 0.001) {
      newType = 'DEBIT';
      newLabel = 'مدين (مطلوب من العميل)';
    } else if (newNetSigned < -0.001) {
      newType = 'CREDIT';
      newLabel = 'دائن (رصيد متبقٍ للعميل)';
    }
  } else {
    if (newNetSigned > 0.001) {
      newType = 'CREDIT';
      newLabel = 'دائن (مستحق للمورد)';
    } else if (newNetSigned < -0.001) {
      newType = 'DEBIT';
      newLabel = 'مدين (رصيد مقدم للمورد)';
    }
  }

  return {
    partnerName: partner.name,
    partnerType: isCustomer ? 'CUSTOMER' : 'VENDOR',
    previousBalance: prevAbs,
    previousBalanceFormatted: prevAbs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    previousBalanceType: prevType,
    previousBalanceLabel: prevLabel,
    invoiceAmount: cleanInvoiceAmount,
    invoiceAmountFormatted: cleanInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    paidAmount: cleanPaidAmount,
    paidAmountFormatted: cleanPaidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    remainingAmount: remainingAmount,
    remainingAmountFormatted: remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    paymentStatus,
    paymentStatusLabel,
    newBalance: newAbs,
    newBalanceFormatted: newAbs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    newBalanceType: newType,
    newBalanceLabel: newLabel
  };
}

/**
 * Toggles or updates the posting status of an external voucher (RECEIPT or PAYMENT)
 */
export function setVoucherPostingStatus(
  voucherId: string, 
  voucherType: VoucherType, 
  targetStatus: 'POSTED' | 'DRAFT'
): { success: boolean; newStatus: 'POSTED' | 'DRAFT'; voucherNumber?: string; partnerName?: string; postedAt?: string | undefined } {
  const isReceipt = voucherType === VoucherType.Receipt;
  const storageKey = isReceipt ? DB_RECEIPT_VOUCHERS_KEY : DB_PAYMENT_VOUCHERS_KEY;
  const list = isReceipt ? loadReceiptVouchers() : loadPaymentVouchers();
  
  let voucherNumber = '';
  let partnerName = '';
  let postedAt: string | undefined = undefined;
  let found = false;

  const nowIso = new Date().toISOString();

  const updated = list.map(v => {
    if (v.id === voucherId) {
      found = true;
      voucherNumber = v.voucherNumber;
      partnerName = v.partnerName;
      postedAt = targetStatus === 'POSTED' ? (v.postedAt || nowIso) : undefined;
      return { 
        ...v, 
        status: targetStatus,
        postedAt
      };
    }
    return v;
  });

  if (!found) {
    return { success: false, newStatus: targetStatus };
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(updated));
    applyVoucherAllocations(voucherType);
    dispatchPartnerLedgerUpdated();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('alpha-chart-of-accounts-updated'));
      window.dispatchEvent(new Event('alpha-journal-entries-updated'));
      window.dispatchEvent(new Event('alpha-vouchers-updated'));
      window.dispatchEvent(new Event('alpha-trial-balance-updated'));
    }
    return { success: true, newStatus: targetStatus, voucherNumber, partnerName, postedAt };
  } catch (err) {
    console.error('Failed to set voucher posting status:', err);
    return { success: false, newStatus: targetStatus };
  }
}




/**
 * Pushes a partner change to the Outbox Sync Engine.
 */
export async function syncPartnerRecord(partner: Partner, type: 'customers' | 'vendors', action: 'INSERT' | 'UPDATE' | 'DELETE') {
  try {
    await enqueueSyncRecord(type, partner.id, action, {
      id: partner.id,
      code: partner.code || '',
      name: partner.name || '',
      phone: partner.phone || '',
      address: partner.address || '',
      tax_number: partner.taxNumber || '',
      opening_balance: partner.openingBalance || 0,
      opening_balance_type: partner.openingBalanceType || 'DEBIT',
      is_active: partner.isActive !== false ? 1 : 0
    });
  } catch (err) {
    console.error(`Failed to sync ${type}:`, err);
  }
}
