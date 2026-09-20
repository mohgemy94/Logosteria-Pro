import * as XLSX from 'xlsx';
import { 
  DB_RECEIPT_VOUCHERS_KEY, 
  DB_PAYMENT_VOUCHERS_KEY,
  DB_INTERNAL_RECEIPT_VOUCHERS_KEY,
  DB_INTERNAL_PAYMENT_VOUCHERS_KEY,
  DB_INTERNAL_VOUCHERS_KEY
} from './sequences';
import { getSystemSettings } from './settings';
import { exportElementToPdf, printElementDirectly } from './pdfExport';

export type VoucherUnifiedCategory = 
  | 'EXTERNAL_RECEIPT' 
  | 'EXTERNAL_PAYMENT' 
  | 'INTERNAL_RECEIPT' 
  | 'INTERNAL_PAYMENT' 
  | 'INTERNAL_TRANSFER';

export interface ExportVoucherItem {
  id: string;
  voucherNumber: string;
  type: 'RECEIPT' | 'PAYMENT' | 'INTERNAL_RECEIPT' | 'INTERNAL_PAYMENT' | 'INTERNAL_TRANSFER';
  typeLabel: string;
  category: 'EXTERNAL' | 'INTERNAL';
  categoryLabel: string;
  date: string;
  partyName: string;
  partyType: string;
  accountId: string;
  accountName: string;
  costCenterId?: string;
  costCenterName?: string;
  amount: number;
  paymentMethod: string;
  referenceNo?: string;
  bankName?: string;
  status: 'POSTED' | 'DRAFT';
  statusLabel: string;
  postedAt?: string;
  description: string;
}

export interface VoucherExportFilters {
  startDate?: string | undefined;
  endDate?: string | undefined;
  accountId?: string | undefined;
  status?: 'ALL' | 'POSTED' | 'DRAFT' | undefined;
  voucherType?: 'ALL' | 'RECEIPT' | 'PAYMENT' | 'INTERNAL_RECEIPT' | 'INTERNAL_PAYMENT' | 'INTERNAL_TRANSFER' | undefined;
  category?: 'ALL' | 'EXTERNAL' | 'INTERNAL' | undefined;
  searchQuery?: string | undefined;
}

const ACCOUNT_NAME_MAP: Record<string, string> = {
  cash: 'الصندوق الرئيسي (نقداً)',
  cash1: 'الخزينة الرئيسية (الصندوق العام)',
  cash2: 'صندوق المعرض / المبيعات اليومية',
  cash3: 'صندوق العهد والمصروفات النثرية',
  bank1: 'البنك الأهلي التجاري',
  bank2: 'مصرف الراجحي',
  bank3: 'بنك الرياض',
  '1111': 'الصندوق الرئيسي',
  '1112': 'صندوق الفرع الثاني',
  '1121': 'البنك الأهلي التجاري',
  '1122': 'مصرف الراجحي',
};

export function resolveAccountLabel(accountId?: string): string {
  if (!accountId) return 'الخزينة الرئيسية';
  return ACCOUNT_NAME_MAP[accountId] || accountId;
}

export function resolvePaymentMethodLabel(method?: string, bankName?: string, ref?: string): string {
  switch (method) {
    case 'BANK_TRANSFER':
      return `تحويل بنكي ${bankName ? '(' + bankName + ')' : ''} ${ref ? '#' + ref : ''}`.trim();
    case 'CHECK':
      return `شيك بنكي ${bankName ? '(' + bankName + ')' : ''} ${ref ? '#' + ref : ''}`.trim();
    case 'SPAN':
      return `شبكة / مدى ${ref ? '#' + ref : ''}`.trim();
    case 'CASH':
      return 'نقداً';
    default:
      return method || 'نقداً';
  }
}

/**
 * Loads and unifies all vouchers from across the entire database
 */
export function loadAllUnifiedVouchers(): ExportVoucherItem[] {
  if (typeof window === 'undefined') return [];
  const items: ExportVoucherItem[] = [];

  // 1. External Receipt Vouchers
  try {
    const raw = localStorage.getItem(DB_RECEIPT_VOUCHERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((v: any) => {
          items.push({
            id: v.id || `ext-rec-${v.voucherNumber}`,
            voucherNumber: String(v.voucherNumber || ''),
            type: 'RECEIPT',
            typeLabel: 'سند قبض خارجي',
            category: 'EXTERNAL',
            categoryLabel: 'سندات خارجية',
            date: v.date || '',
            partyName: v.partnerName || 'عميل خارجي',
            partyType: v.partnerType === 'VENDOR' ? 'مورد' : 'عميل',
            accountId: v.accountId || 'cash',
            accountName: resolveAccountLabel(v.accountId),
            costCenterId: v.costCenterId,
            costCenterName: v.costCenterName || v.costCenterId || '',
            amount: Number(v.amount) || 0,
            paymentMethod: resolvePaymentMethodLabel(v.paymentMethod, v.bankName, v.referenceNo),
            referenceNo: v.referenceNo || '',
            bankName: v.bankName || '',
            status: v.status === 'POSTED' ? 'POSTED' : 'DRAFT',
            statusLabel: v.status === 'POSTED' ? 'مرحل بالحسابات' : 'مسودة',
            postedAt: v.postedAt || '',
            description: v.description || ''
          });
        });
      }
    }
  } catch (e) {
    console.error('Failed to load external receipts for export:', e);
  }

  // 2. External Payment Vouchers
  try {
    const raw = localStorage.getItem(DB_PAYMENT_VOUCHERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((v: any) => {
          items.push({
            id: v.id || `ext-pay-${v.voucherNumber}`,
            voucherNumber: String(v.voucherNumber || ''),
            type: 'PAYMENT',
            typeLabel: 'سند صرف خارجي',
            category: 'EXTERNAL',
            categoryLabel: 'سندات خارجية',
            date: v.date || '',
            partyName: v.partnerName || 'مورد خارجي',
            partyType: v.partnerType === 'CUSTOMER' ? 'عميل' : 'مورد',
            accountId: v.accountId || 'cash',
            accountName: resolveAccountLabel(v.accountId),
            costCenterId: v.costCenterId,
            costCenterName: v.costCenterName || v.costCenterId || '',
            amount: Number(v.amount) || 0,
            paymentMethod: resolvePaymentMethodLabel(v.paymentMethod, v.bankName, v.referenceNo),
            referenceNo: v.referenceNo || '',
            bankName: v.bankName || '',
            status: v.status === 'POSTED' ? 'POSTED' : 'DRAFT',
            statusLabel: v.status === 'POSTED' ? 'مرحل بالحسابات' : 'مسودة',
            postedAt: v.postedAt || '',
            description: v.description || ''
          });
        });
      }
    }
  } catch (e) {
    console.error('Failed to load external payments for export:', e);
  }

  // 3. Internal Receipt Vouchers
  try {
    const raw = localStorage.getItem(DB_INTERNAL_RECEIPT_VOUCHERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((v: any) => {
          items.push({
            id: v.id || `int-rec-${v.voucherNumber}`,
            voucherNumber: String(v.voucherNumber || ''),
            type: 'INTERNAL_RECEIPT',
            typeLabel: 'سند قبض وتوريد داخلي',
            category: 'INTERNAL',
            categoryLabel: 'سندات داخلية',
            date: v.date || '',
            partyName: v.receivedFrom || 'جهة داخلية / موظف',
            partyType: 'موظف / جهة داخلية',
            accountId: v.toAccountId || 'cash1',
            accountName: resolveAccountLabel(v.toAccountId),
            costCenterId: v.costCenterId,
            costCenterName: v.costCenterName || v.costCenterId || '',
            amount: Number(v.amount) || 0,
            paymentMethod: resolvePaymentMethodLabel(v.paymentMethod, v.bankName, v.referenceNo),
            referenceNo: v.referenceNo || '',
            bankName: v.bankName || '',
            status: v.status === 'POSTED' ? 'POSTED' : 'DRAFT',
            statusLabel: v.status === 'POSTED' ? 'مرحل بالحسابات' : 'مسودة',
            postedAt: v.postedAt || '',
            description: v.description || ''
          });
        });
      }
    }
  } catch (e) {
    console.error('Failed to load internal receipts for export:', e);
  }

  // 4. Internal Payment Vouchers
  try {
    const raw = localStorage.getItem(DB_INTERNAL_PAYMENT_VOUCHERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((v: any) => {
          items.push({
            id: v.id || `int-pay-${v.voucherNumber}`,
            voucherNumber: String(v.voucherNumber || ''),
            type: 'INTERNAL_PAYMENT',
            typeLabel: 'سند صرف داخلي ومصروفات',
            category: 'INTERNAL',
            categoryLabel: 'سندات داخلية',
            date: v.date || '',
            partyName: v.paidTo || 'جهة داخلية / نثريات',
            partyType: 'مصروفات ونثريات داخلية',
            accountId: v.fromAccountId || 'cash1',
            accountName: resolveAccountLabel(v.fromAccountId),
            costCenterId: v.costCenterId,
            costCenterName: v.costCenterName || v.costCenterId || '',
            amount: Number(v.amount) || 0,
            paymentMethod: resolvePaymentMethodLabel(v.paymentMethod, v.bankName, v.referenceNo),
            referenceNo: v.referenceNo || '',
            bankName: v.bankName || '',
            status: v.status === 'POSTED' ? 'POSTED' : 'DRAFT',
            statusLabel: v.status === 'POSTED' ? 'مرحل بالحسابات' : 'مسودة',
            postedAt: v.postedAt || '',
            description: v.description || ''
          });
        });
      }
    }
  } catch (e) {
    console.error('Failed to load internal payments for export:', e);
  }

  // 5. Internal Transfer Vouchers
  try {
    const raw = localStorage.getItem(DB_INTERNAL_VOUCHERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((v: any) => {
          items.push({
            id: v.id || `int-trf-${v.voucherNumber}`,
            voucherNumber: String(v.voucherNumber || ''),
            type: 'INTERNAL_TRANSFER',
            typeLabel: 'تحويل نقدي بين الخزائن والبنوك',
            category: 'INTERNAL',
            categoryLabel: 'سندات داخلية',
            date: v.date || '',
            partyName: `${resolveAccountLabel(v.fromAccountId)} ➔ ${resolveAccountLabel(v.toAccountId)}`,
            partyType: 'تحويل داخلي',
            accountId: v.fromAccountId || 'cash1',
            accountName: resolveAccountLabel(v.fromAccountId),
            costCenterId: '',
            costCenterName: '',
            amount: Number(v.amount) || 0,
            paymentMethod: 'تحويل داخلي',
            referenceNo: '',
            bankName: '',
            status: v.status === 'POSTED' ? 'POSTED' : 'DRAFT',
            statusLabel: v.status === 'POSTED' ? 'مرحل بالحسابات' : 'مسودة',
            postedAt: v.postedAt || '',
            description: v.description || ''
          });
        });
      }
    }
  } catch (e) {
    console.error('Failed to load internal transfers for export:', e);
  }

  // Sort descending by date, then by voucher number
  return items.sort((a, b) => {
    const cmp = (b.date || '').localeCompare(a.date || '');
    if (cmp !== 0) return cmp;
    return (b.voucherNumber || '').localeCompare(a.voucherNumber || '', undefined, { numeric: true });
  });
}

/**
 * Filter unified vouchers by user-defined criteria
 */
export function filterUnifiedVouchers(items: ExportVoucherItem[], filters: VoucherExportFilters): ExportVoucherItem[] {
  return items.filter(item => {
    // 1. Date Range
    if (filters.startDate && item.date && item.date < filters.startDate) {
      return false;
    }
    if (filters.endDate && item.date && item.date > filters.endDate) {
      return false;
    }

    // 2. Account
    if (filters.accountId && filters.accountId !== 'ALL') {
      if (item.accountId !== filters.accountId) {
        return false;
      }
    }

    // 3. Status (POSTED / DRAFT / ALL)
    if (filters.status && filters.status !== 'ALL') {
      if (item.status !== filters.status) {
        return false;
      }
    }

    // 4. Category (EXTERNAL / INTERNAL / ALL)
    if (filters.category && filters.category !== 'ALL') {
      if (item.category !== filters.category) {
        return false;
      }
    }

    // 5. Voucher Type
    if (filters.voucherType && filters.voucherType !== 'ALL') {
      if (filters.voucherType === 'RECEIPT') {
        if (item.type !== 'RECEIPT' && item.type !== 'INTERNAL_RECEIPT') return false;
      } else if (filters.voucherType === 'PAYMENT') {
        if (item.type !== 'PAYMENT' && item.type !== 'INTERNAL_PAYMENT') return false;
      } else {
        if (item.type !== filters.voucherType) return false;
      }
    }

    // 6. Search Query
    if (filters.searchQuery && filters.searchQuery.trim() !== '') {
      const q = filters.searchQuery.trim().toLowerCase();
      const matchVoucher = item.voucherNumber.toLowerCase().includes(q);
      const matchParty = item.partyName.toLowerCase().includes(q);
      const matchAccount = item.accountName.toLowerCase().includes(q);
      const matchDesc = (item.description || '').toLowerCase().includes(q);
      const matchRef = (item.referenceNo || '').toLowerCase().includes(q);
      if (!matchVoucher && !matchParty && !matchAccount && !matchDesc && !matchRef) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Exports vouchers to an actual Microsoft Excel / Google Sheets (.xlsx) file
 */
export function exportVouchersToXLSX(
  items: ExportVoucherItem[], 
  title = 'كشف حركة السندات والعمليات المالية',
  filterSummary = ''
): void {
  const settings = getSystemSettings();
  const companyName = settings?.company?.nameAr || settings?.company?.nameEn || 'شركة لوجوستريا المحاسبية';
  const taxNumber = settings?.company?.taxNumber || '';
  const nowStr = new Date().toLocaleString('ar-SA');

  // Compute Totals
  const totalCount = items.length;
  const totalReceipts = items
    .filter(i => i.type === 'RECEIPT' || i.type === 'INTERNAL_RECEIPT')
    .reduce((sum, i) => sum + i.amount, 0);
  const totalPayments = items
    .filter(i => i.type === 'PAYMENT' || i.type === 'INTERNAL_PAYMENT')
    .reduce((sum, i) => sum + i.amount, 0);
  const netMovement = totalReceipts - totalPayments;
  const postedCount = items.filter(i => i.status === 'POSTED').length;
  const draftCount = items.filter(i => i.status === 'DRAFT').length;

  // Build Sheet Data Rows
  const sheetData: any[][] = [
    // Header block
    [companyName],
    [`${title} - تصدير معتمد`],
    [`الرقم الضريبي: ${taxNumber || 'غير مسجل'} | تاريخ واستخراج التقرير: ${nowStr}`],
    [filterSummary ? `نطاق التقرير والفلترة: ${filterSummary}` : 'نطاق التقرير: كامل السجلات المحفوظة'],
    [`إجمالي السندات: ${totalCount} (مرحل: ${postedCount} | مسودة: ${draftCount}) | إجمالي المقبوضات: ${totalReceipts.toLocaleString()} | إجمالي المدفوعات: ${totalPayments.toLocaleString()} | صافي الحركة: ${netMovement.toLocaleString()}`],
    [], // empty row separator
    // Table Headers
    [
      'م',
      'رقم السند',
      'نوع السند',
      'التصنيف',
      'التاريخ',
      'الطرف / المستفيد / المسلّم',
      'نوع الطرف',
      'حساب الخزينة / البنك',
      'مركز التكلفة',
      'المبلغ',
      'طريقة السداد',
      'رقم المرجع / الشيك',
      'حالة الترحيل',
      'تاريخ ووقت الترحيل',
      'البيان والملاحظات'
    ]
  ];

  // Populate data rows
  items.forEach((item, index) => {
    sheetData.push([
      index + 1,
      item.voucherNumber,
      item.typeLabel,
      item.categoryLabel,
      item.date,
      item.partyName,
      item.partyType,
      item.accountName,
      item.costCenterName || 'عام',
      item.amount,
      item.paymentMethod,
      item.referenceNo || '-',
      item.statusLabel,
      item.postedAt ? new Date(item.postedAt).toLocaleDateString('ar-SA') : 'غير مرحل',
      item.description || ''
    ]);
  });

  // Add Summary Rows
  sheetData.push([]);
  sheetData.push([
    'الإجمالي',
    `عدد السندات: ${totalCount}`,
    '',
    '',
    '',
    '',
    '',
    '',
    'إجمالي المقبوضات:',
    totalReceipts,
    '',
    '',
    `المرحلة: ${postedCount}`,
    `المسودة: ${draftCount}`,
    ''
  ]);
  sheetData.push([
    'الصافي',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'إجمالي المدفوعات:',
    totalPayments,
    '',
    '',
    '',
    '',
    ''
  ]);
  sheetData.push([
    'صافي النقدية',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'صافي الحركة النقدية:',
    netMovement,
    '',
    '',
    '',
    '',
    ''
  ]);

  // Create Workbook and Worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Set Right-to-Left (RTL) mode for native Arabic support in Excel & Google Sheets
  ws['!views'] = [{ RTL: true }];

  // Configure Column Widths
  ws['!cols'] = [
    { wch: 6 },   // م
    { wch: 14 },  // رقم السند
    { wch: 22 },  // نوع السند
    { wch: 14 },  // التصنيف
    { wch: 12 },  // التاريخ
    { wch: 28 },  // الطرف
    { wch: 16 },  // نوع الطرف
    { wch: 26 },  // الحساب
    { wch: 16 },  // مركز التكلفة
    { wch: 15 },  // المبلغ
    { wch: 20 },  // طريقة السداد
    { wch: 16 },  // المرجع
    { wch: 16 },  // حالة الترحيل
    { wch: 18 },  // تاريخ الترحيل
    { wch: 35 }   // البيان
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'كشف حركة السندات');

  // Write file as binary array buffer
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' 
  });

  const dateSlug = new Date().toISOString().split('T')[0];
  const filename = `كشف_السندات_المالية_${dateSlug}.xlsx`;

  // Trigger Download
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Exports vouchers to a CSV file with UTF-8 BOM for Arabic compatibility
 */
export function exportVouchersToCSV(
  items: ExportVoucherItem[],
  title = 'كشف حركة السندات والعمليات المالية',
  filterSummary = ''
): void {
  const settings = getSystemSettings();
  const companyName = settings?.company?.nameAr || 'شركة لوجوستريا المحاسبية';
  const nowStr = new Date().toLocaleString('ar-SA');

  const headers = [
    'م',
    'رقم السند',
    'نوع السند',
    'التصنيف',
    'التاريخ',
    'الطرف / المستفيد / المسلّم',
    'نوع الطرف',
    'حساب الخزينة / البنك',
    'مركز التكلفة',
    'المبلغ',
    'طريقة السداد',
    'رقم المرجع / الشيك',
    'حالة الترحيل',
    'تاريخ ووقت الترحيل',
    'البيان والملاحظات'
  ];

  const rows = items.map((item, index) => [
    index + 1,
    `"${item.voucherNumber}"`,
    `"${item.typeLabel}"`,
    `"${item.categoryLabel}"`,
    `"${item.date}"`,
    `"${(item.partyName || '').replace(/"/g, '""')}"`,
    `"${item.partyType}"`,
    `"${(item.accountName || '').replace(/"/g, '""')}"`,
    `"${(item.costCenterName || 'عام').replace(/"/g, '""')}"`,
    item.amount.toFixed(2),
    `"${(item.paymentMethod || '').replace(/"/g, '""')}"`,
    `"${(item.referenceNo || '-').replace(/"/g, '""')}"`,
    `"${item.statusLabel}"`,
    `"${item.postedAt ? new Date(item.postedAt).toLocaleDateString('ar-SA') : 'غير مرحل'}"`,
    `"${(item.description || '').replace(/"/g, '""')}"`
  ]);

  const totalReceipts = items
    .filter(i => i.type === 'RECEIPT' || i.type === 'INTERNAL_RECEIPT')
    .reduce((sum, i) => sum + i.amount, 0);
  const totalPayments = items
    .filter(i => i.type === 'PAYMENT' || i.type === 'INTERNAL_PAYMENT')
    .reduce((sum, i) => sum + i.amount, 0);
  const netMovement = totalReceipts - totalPayments;

  const metadataLines = [
    `# ${companyName}`,
    `# ${title}`,
    `# تاريخ الاستخراج: ${nowStr}`,
    filterSummary ? `# الفلترة: ${filterSummary}` : '# النطاق: جميع السجلات',
    `# الإجماليات: عدد السندات=${items.length} | المقبوضات=${totalReceipts.toFixed(2)} | المدفوعات=${totalPayments.toFixed(2)} | الصافي=${netMovement.toFixed(2)}`,
    ''
  ];

  const csvContent = '\uFEFF' + 
    metadataLines.join('\n') + '\n' +
    headers.join(',') + '\n' + 
    rows.map(r => r.join(',')).join('\n') + '\n\n' +
    `"الإجمالي العام",,"عدد السندات: ${items.length}",,,,,,,"مقبوضات: ${totalReceipts.toFixed(2)}",,"مدفوعات: ${totalPayments.toFixed(2)}",,"صافي: ${netMovement.toFixed(2)}",`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const dateSlug = new Date().toISOString().split('T')[0];
  const filename = `كشف_السندات_المالية_${dateSlug}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Builds HTML printable report string and directly triggers PDF download using html2canvas & jsPDF
 */
export async function exportVouchersReportPDF(
  items: ExportVoucherItem[],
  title = 'كشف حركة السندات والعمليات المالية',
  filterSummary = ''
): Promise<void> {
  const settings = getSystemSettings();
  const companyName = settings?.company?.nameAr || settings?.company?.nameEn || 'شركة لوجوستريا المحاسبية';
  const taxNumber = settings?.company?.taxNumber || '';
  const commercialRegister = settings?.company?.commercialRegister || '';
  const nowStr = new Date().toLocaleString('ar-SA');

  const totalCount = items.length;
  const totalReceipts = items
    .filter(i => i.type === 'RECEIPT' || i.type === 'INTERNAL_RECEIPT')
    .reduce((sum, i) => sum + i.amount, 0);
  const totalPayments = items
    .filter(i => i.type === 'PAYMENT' || i.type === 'INTERNAL_PAYMENT')
    .reduce((sum, i) => sum + i.amount, 0);
  const netMovement = totalReceipts - totalPayments;
  const postedCount = items.filter(i => i.status === 'POSTED').length;
  const draftCount = items.filter(i => i.status === 'DRAFT').length;

  // Create temporary off-screen container
  const container = document.createElement('div');
  container.id = 'vouchers-export-pdf-temp';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '1050px'; // standard A4 landscape width for dense tables
  container.style.backgroundColor = '#ffffff';
  container.style.padding = '24px';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Cairo, sans-serif';
  container.dir = 'rtl';

  container.innerHTML = `
    <div style="font-family: 'Cairo', sans-serif; direction: rtl; color: #0f172a;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 16px;">
        <div>
          <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 900; color: #0f172a;">${companyName}</h1>
          <div style="font-size: 11px; color: #475569; line-height: 1.6;">
            ${taxNumber ? `<span>الرقم الضريبي: <b>${taxNumber}</b></span> | ` : ''}
            ${commercialRegister ? `<span>س.ت: <b>${commercialRegister}</b></span> | ` : ''}
            <span>برنامج لوجوستريا المحاسبي</span>
          </div>
        </div>
        <div style="text-align: left;">
          <div style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 14px; border-radius: 8px; text-align: center;">
            <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${title}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">تاريخ الاستخراج: ${nowStr}</div>
          </div>
        </div>
      </div>

      <!-- Filter Summary & Badge -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
        <div>
          <span style="color: #64748b;">نطاق الفلترة والبحث: </span>
          <b style="color: #0f172a;">${filterSummary || 'كافة السجلات المحفوظة في النظام'}</b>
        </div>
        <div>
          <span style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 3px 8px; border-radius: 6px; font-weight: bold; margin-left: 6px;">مرحل: ${postedCount}</span>
          <span style="background: #fffbeb; color: #92400e; border: 1px solid #fde68a; padding: 3px 8px; border-radius: 6px; font-weight: bold;">مسودة: ${draftCount}</span>
        </div>
      </div>

      <!-- Key Metrics Bar -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; text-align: center;">
          <div style="font-size: 10px; color: #64748b;">إجمالي عدد السندات</div>
          <div style="font-size: 16px; font-weight: 900; color: #0f172a;">${totalCount}</div>
        </div>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 8px 12px; text-align: center;">
          <div style="font-size: 10px; color: #166534;">إجمالي المقبوضات</div>
          <div style="font-size: 16px; font-weight: 900; color: #15803d;">${totalReceipts.toLocaleString()}</div>
        </div>
        <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 8px 12px; text-align: center;">
          <div style="font-size: 10px; color: #9f1239;">إجمالي المدفوعات</div>
          <div style="font-size: 16px; font-weight: 900; color: #be123c;">${totalPayments.toLocaleString()}</div>
        </div>
        <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 8px 12px; text-align: center;">
          <div style="font-size: 10px; color: #115e59;">صافي التدفق النقدي</div>
          <div style="font-size: 16px; font-weight: 900; color: ${netMovement >= 0 ? '#0f766e' : '#b91c1c'};">${netMovement.toLocaleString()}</div>
        </div>
      </div>

      <!-- Data Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 20px;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff; text-align: right;">
            <th style="padding: 6px 8px; border: 1px solid #0f172a; width: 30px; text-align: center;">م</th>
            <th style="padding: 6px 8px; border: 1px solid #0f172a; width: 65px;">رقم السند</th>
            <th style="padding: 6px 8px; border: 1px solid #0f172a; width: 100px;">نوع السند</th>
            <th style="padding: 6px 8px; border: 1px solid #0f172a; width: 70px;">التاريخ</th>
            <th style="padding: 6px 8px; border: 1px solid #0f172a;">الطرف / المستفيد</th>
            <th style="padding: 6px 8px; border: 1px solid #0f172a; width: 110px;">حساب الخزينة/البنك</th>
            <th style="padding: 6px 8px; border: 1px solid #0f172a; width: 85px; text-align: left;">المبلغ</th>
            <th style="padding: 6px 8px; border: 1px solid #0f172a; width: 80px;">طريقة السداد</th>
            <th style="padding: 6px 8px; border: 1px solid #0f172a; width: 65px; text-align: center;">الحالة</th>
            <th style="padding: 6px 8px; border: 1px solid #0f172a; width: 130px;">البيان</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, idx) => `
            <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: bold; font-family: monospace;">#${item.voucherNumber}</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1;">${item.typeLabel}</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1;">${item.date}</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: 600;">${item.partyName}</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1;">${item.accountName}</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: bold; text-align: left;">${item.amount.toLocaleString()}</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1;">${item.paymentMethod}</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center;">
                <span style="font-size: 9px; padding: 2px 5px; border-radius: 4px; font-weight: bold; background: ${item.status === 'POSTED' ? '#dcfce7; color: #166534;' : '#fef3c7; color: #92400e;'}">
                  ${item.statusLabel}
                </span>
              </td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; color: #475569;">${item.description || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background: #e2e8f0; font-weight: bold;">
            <td colspan="6" style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">الإجمالي العام لعدد (${totalCount}) سند</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: left; font-size: 11px;">مقبوضات: ${totalReceipts.toLocaleString()} <br/> مدفوعات: ${totalPayments.toLocaleString()}</td>
            <td colspan="3" style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">صافي حركة النقدية: ${netMovement.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Footer & Signatures -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; padding-top: 15px; border-top: 1px dashed #cbd5e1; font-size: 11px;">
        <div style="text-align: center; width: 180px;">
          <div>المحاسب المسؤول</div>
          <div style="margin-top: 35px; border-top: 1px solid #64748b; padding-top: 4px;">التوقيع والاعتماد</div>
        </div>
        <div style="text-align: center; width: 180px;">
          <div>المدير المالي / التدقيق</div>
          <div style="margin-top: 35px; border-top: 1px solid #64748b; padding-top: 4px;">التوقيع والاعتماد</div>
        </div>
        <div style="text-align: center; width: 180px;">
          <div>الختم الرسمي للمنشأة</div>
          <div style="margin-top: 35px; border-top: 1px solid #64748b; padding-top: 4px;">خاتم الاعتماد</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const dateSlug = new Date().toISOString().split('T')[0];
    await exportElementToPdf(container, {
      filename: `كشف_حركة_السندات_${dateSlug}.pdf`,
      format: 'A4',
      scale: 2
    });
  } catch (err) {
    console.warn('PDF direct export fallback to printable iframe:', err);
    printElementDirectly(container, 'A4');
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
