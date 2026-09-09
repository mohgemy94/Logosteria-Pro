import { Partner, VoucherType } from '../types/accounting';
import { getCurrencyInfo } from './currency';
import { 
  DB_SALES_INVOICES_KEY, 
  DB_PURCHASES_INVOICES_KEY, 
  DB_RECEIPT_VOUCHERS_KEY, 
  DB_PAYMENT_VOUCHERS_KEY 
} from './sequences';
import { notifyDataChanged } from './localFolderBackup';

export const CUSTOMERS_STORAGE_KEY = 'accounting_customers';
export const VENDORS_STORAGE_KEY = 'accounting_vendors';

export const DEFAULT_CUSTOMERS_LIST: Partner[] = [
  { id: 'c-1', name: 'شركة التقنية الحديثة المحدودة', type: 'CUSTOMER', taxNumber: '300000000000003', phone: '0501112233', address: 'المملكة العربية السعودية - الرياض - طريق الملك فهد', openingBalance: 12500 },
  { id: 'c-2', name: 'مؤسسة البناء العمراني للمقاولات', type: 'CUSTOMER', taxNumber: '300000000000004', phone: '0502223344', address: 'المملكة العربية السعودية - جدة - حي الروضة', openingBalance: 25000 },
  { id: 'c-3', name: 'مجموعة المروج التجارية', type: 'CUSTOMER', taxNumber: '310987654300003', phone: '0504445566', address: 'المملكة العربية السعودية - مكة المكرمة - العزيزية', openingBalance: 5000 },
  { id: 'c-4', name: 'مؤسسة الأفق للتجارة والمقاولات', type: 'CUSTOMER', taxNumber: '300555666700003', phone: '0555123456', address: 'المملكة العربية السعودية - الدمام - حي الشاطئ', openingBalance: 0 }
];

export const DEFAULT_VENDORS_LIST: Partner[] = [
  { id: 'v-1', name: 'شركة التوريدات العالمية للصناعة', type: 'VENDOR', taxNumber: '300000000000005', phone: '0503334455', address: 'المملكة العربية السعودية - الرياض - المدينة الصناعية الثانية', openingBalance: -18000 },
  { id: 'v-2', name: 'مصنع الخليج للعبوات والكرتون', type: 'VENDOR', taxNumber: '300777888900003', phone: '0507778899', address: 'المملكة العربية السعودية - جدة - المرحلة الرابعة', openingBalance: -6500 },
  { id: 'v-3', name: 'شركة النقل واللوجستيات السريعة', type: 'VENDOR', taxNumber: '300999111200003', phone: '0508889900', address: 'المملكة العربية السعودية - الخبر - طريق الملك فيصل', openingBalance: 0 },
  { id: 'v-4', name: 'مؤسسة استيراد قطع الغيار الألمانية', type: 'VENDOR', taxNumber: '310444333200003', phone: '0509990011', address: 'المملكة العربية السعودية - الرياض - حي السلي', openingBalance: 0 }
];

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
  createdAt: string;
}

export interface PartnerLedgerTx {
  id: string;
  date: string;
  type: 'OPENING' | 'SALES_INVOICE' | 'PURCHASE_INVOICE' | 'RECEIPT_VOUCHER' | 'PAYMENT_VOUCHER';
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
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to load customers:', e);
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
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to load vendors:', e);
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

export function loadReceiptVouchers(): StoredVoucherRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DB_RECEIPT_VOUCHERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load receipt vouchers:', e);
  }
  return [];
}

export function loadPaymentVouchers(): StoredVoucherRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DB_PAYMENT_VOUCHERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load payment vouchers:', e);
  }
  return [];
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
    type: 'OPENING' | 'SALES_INVOICE' | 'PURCHASE_INVOICE' | 'RECEIPT_VOUCHER' | 'PAYMENT_VOUCHER';
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
      totalSalesCount++;
      const grandTotal = inv.totals?.grandTotal ?? 0;
      const cashPaid = inv.totals?.cashPaid ?? 0;
      const itemsCount = inv.items?.length || 0;
      const desc = `فاتورة مبيعات #${inv.invoiceNumber} (${itemsCount} بنود) ${inv.notes ? '- ' + inv.notes : ''}`;
      
      // Customer is debited for invoice total
      rawTxList.push({
        date: inv.date || todayStr,
        createdAt: inv.createdAt || nowStr,
        type: 'SALES_INVOICE',
        docTypeLabel: 'فاتورة مبيعات',
        docNumber: `#${inv.invoiceNumber}`,
        description: desc,
        debit: grandTotal,
        credit: 0,
        status: inv.status,
        rawDoc: inv
      });

      // If there was an immediate cash payment recorded on the invoice
      if (cashPaid > 0) {
        rawTxList.push({
          date: inv.date || todayStr,
          createdAt: inv.createdAt || nowStr,
          type: 'RECEIPT_VOUCHER',
          docTypeLabel: 'سداد نقدي بالفاتورة',
          docNumber: `INV-PAY-#${inv.invoiceNumber}`,
          description: `سداد فوري مسجل على فاتورة المبيعات #${inv.invoiceNumber}`,
          debit: 0,
          credit: cashPaid,
          status: inv.status,
          rawDoc: inv
        });
      }
    }
  });

  // 3. Purchase Invoices
  rawPurchaseInvoices.forEach(inv => {
    if (isPartnerMatch(inv.partnerId, inv.partnerName, partner)) {
      totalPurchaseCount++;
      const grandTotal = inv.totals?.grandTotal ?? 0;
      const cashPaid = inv.totals?.cashPaid ?? 0;
      const itemsCount = inv.items?.length || 0;
      const desc = `فاتورة مشتريات #${inv.invoiceNumber} ${inv.supplierRef ? '(مرجع: ' + inv.supplierRef + ')' : ''} (${itemsCount} بنود)`;

      // Vendor is credited for invoice total (we owe vendor)
      rawTxList.push({
        date: inv.date || todayStr,
        createdAt: inv.createdAt || nowStr,
        type: 'PURCHASE_INVOICE',
        docTypeLabel: 'فاتورة مشتريات',
        docNumber: `#${inv.invoiceNumber}`,
        description: desc,
        debit: 0,
        credit: grandTotal,
        status: inv.status,
        rawDoc: inv
      });

      // If there was an immediate cash payment recorded on the purchase invoice
      if (cashPaid > 0) {
        rawTxList.push({
          date: inv.date || todayStr,
          createdAt: inv.createdAt || nowStr,
          type: 'PAYMENT_VOUCHER',
          docTypeLabel: 'سداد نقدي بالفاتورة',
          docNumber: `PO-PAY-#${inv.invoiceNumber}`,
          description: `سداد فوري مسجل على فاتورة المشتريات #${inv.invoiceNumber}`,
          debit: cashPaid,
          credit: 0,
          status: inv.status,
          rawDoc: inv
        });
      }
    }
  });

  // 4. Receipt Vouchers (سندات القبض الخارجية)
  rawReceiptVouchers.forEach(v => {
    if (isPartnerMatch(v.partnerId, v.partnerName, partner)) {
      totalReceiptCount++;
      const amount = Number(v.amount) || 0;
      const accountLabel = v.accountId === 'bank' ? 'البنك الأهلي' : 'الصندوق الرئيسي';
      const desc = `${v.description || 'سند قبض نقدية'} [${accountLabel}]`;

      // Receipt from customer -> Credit to customer (reduces receivable)
      // Receipt from vendor -> Credit to vendor (reduces debit/advance)
      rawTxList.push({
        date: v.date || todayStr,
        createdAt: v.createdAt || nowStr,
        type: 'RECEIPT_VOUCHER',
        docTypeLabel: 'سند قبض خارجي',
        docNumber: `#${v.voucherNumber}`,
        description: desc,
        debit: 0,
        credit: amount,
        status: 'POSTED',
        rawDoc: v
      });
    }
  });

  // 5. Payment Vouchers (سندات الصرف الخارجية)
  rawPaymentVouchers.forEach(v => {
    if (isPartnerMatch(v.partnerId, v.partnerName, partner)) {
      totalPaymentCount++;
      const amount = Number(v.amount) || 0;
      const accountLabel = v.accountId === 'bank' ? 'البنك الأهلي' : 'الصندوق الرئيسي';
      const desc = `${v.description || 'سند صرف نقدية'} [${accountLabel}]`;

      // Payment to vendor -> Debit to vendor (reduces payable)
      // Payment to customer -> Debit to customer (refund/deposit)
      rawTxList.push({
        date: v.date || todayStr,
        createdAt: v.createdAt || nowStr,
        type: 'PAYMENT_VOUCHER',
        docTypeLabel: 'سند صرف خارجي',
        docNumber: `#${v.voucherNumber}`,
        description: desc,
        debit: amount,
        credit: 0,
        status: 'POSTED',
        rawDoc: v
      });
    }
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
    totalWithdrawals = rawTxList.filter(t => t.type === 'SALES_INVOICE').reduce((s, t) => s + t.debit, 0) + (openingBal > 0 ? openingBal : 0);
    totalPayments = rawTxList.filter(t => t.type === 'RECEIPT_VOUCHER').reduce((s, t) => s + t.credit, 0);

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
    totalWithdrawals = rawTxList.filter(t => t.type === 'PURCHASE_INVOICE').reduce((s, t) => s + t.credit, 0) + (openingBal < 0 ? Math.abs(openingBal) : 0);
    totalPayments = rawTxList.filter(t => t.type === 'PAYMENT_VOUCHER').reduce((s, t) => s + t.debit, 0);

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
  existingStatement?: PartnerStatement | null
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
  const netAdditionToDebt = remainingAmount;
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

