import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  FileText, 
  Receipt, 
  Layers, 
  Calendar, 
  User, 
  Hash, 
  CreditCard, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  Loader2, 
  Building2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { loadSalesInvoices, loadReceiptVouchers } from '../../utils/partnerLedger';
import { loadJournalEntries } from '../../utils/trialBalanceStore';
import { useSystemCurrency } from '../../utils/currency';
import { getSystemSettings } from '../../utils/settings';

export interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId?: string | number | null;
  documentType?: 'invoice' | 'receipt' | 'journal_entry' | string | null;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  documentId,
  documentType
}) => {
  const { symbol: currencySymbol } = useSystemCurrency();
  const settings = getSystemSettings();
  
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Normalized state for the loaded document
  const [invoiceData, setInvoiceData] = useState<{
    id: string;
    invoiceNumber: string;
    date: string;
    dueDate?: string;
    partnerName: string;
    partnerTaxNo?: string;
    status: string;
    invoiceType?: string;
    notes?: string;
    items: Array<{
      id?: string;
      name: string;
      code?: string;
      quantity: number;
      price: number;
      total: number;
      tax?: number;
      unit?: string;
    }>;
    totals: {
      subtotal: number;
      totalDiscount?: number;
      taxAmount: number;
      grandTotal: number;
      cashPaid?: number;
      remainingBalance?: number;
    };
  } | null>(null);

  const [receiptData, setReceiptData] = useState<{
    id: string;
    voucherNumber: string;
    date: string;
    partnerName: string;
    amount: number;
    paymentMethod: string;
    description: string;
    status?: string;
    referenceNo?: string;
    bankName?: string;
  } | null>(null);

  const [journalData, setJournalData] = useState<{
    id: string;
    entryNumber: string;
    date: string;
    description: string;
    lines?: Array<{
      accountCode?: string;
      accountName?: string;
      debit: number;
      credit: number;
      description?: string;
    }>;
    totalDebit?: number;
    totalCredit?: number;
  } | null>(null);

  // Normalize document type: map aliases like 'SALES_INVOICE' -> 'invoice', 'RECEIPT_VOUCHER' -> 'receipt'
  const normalizedType = (() => {
    if (!documentType) return 'invoice';
    const dt = String(documentType).toLowerCase();
    if (dt.includes('inv') || dt === 'sales_invoice') return 'invoice';
    if (dt.includes('receipt') || dt === 'receipt_voucher' || dt.includes('voucher')) return 'receipt';
    if (dt.includes('journal') || dt === 'journal_entry' || dt.includes('entry')) return 'journal_entry';
    return dt;
  })();

  // Data fetching upon opening
  useEffect(() => {
    if (!isOpen || !documentId) {
      setInvoiceData(null);
      setReceiptData(null);
      setJournalData(null);
      setFetchError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setFetchError(null);

    const cleanDocId = String(documentId).trim().replace(/^#/, '').replace(/^inv-/, '').replace(/^rec-/, '');

    async function fetchDocumentDetails() {
      try {
        if (normalizedType === 'invoice') {
          let fetchedInvoice: any = null;
          let fetchedLines: any[] = [];

          // 1. Try Supabase first if available
          if (supabase) {
            try {
              const { data: invRes, error: invErr } = await supabase
                .from('invoices')
                .select('*')
                .or(`id.eq.${cleanDocId},invoice_number.eq.${cleanDocId},invoiceNumber.eq.${cleanDocId}`)
                .maybeSingle();

              if (!invErr && invRes) {
                fetchedInvoice = invRes;

                // Try fetching invoice_lines with JOIN on products if available
                try {
                  const { data: linesRes } = await supabase
                    .from('invoice_lines')
                    .select('*, products(*)')
                    .eq('invoice_id', invRes.id);

                  if (linesRes && linesRes.length > 0) {
                    fetchedLines = linesRes.map((line: any) => ({
                      id: line.id,
                      name: line.products?.name || line.product_name || line.name || 'صنف غير محدد',
                      code: line.products?.code || line.product_code || line.code || '',
                      quantity: Number(line.quantity || line.qty || 1),
                      price: Number(line.price || line.unit_price || 0),
                      total: Number(line.total || (Number(line.quantity || 1) * Number(line.price || 0))),
                      tax: Number(line.tax || line.tax_amount || 0),
                      unit: line.unit || line.products?.unit || 'حبة'
                    }));
                  }
                } catch (lineErr) {
                  console.warn('Supabase invoice_lines join query skipped:', lineErr);
                }
              }
            } catch (supErr) {
              console.warn('Supabase invoice fetch error:', supErr);
            }
          }

          // 2. Fallback to Local Storage invoices if not found or incomplete
          if (!fetchedInvoice) {
            const allLocalInvoices = loadSalesInvoices();
            const foundLocal = allLocalInvoices.find(inv => 
              String(inv.id) === cleanDocId || 
              String(inv.invoiceNumber) === cleanDocId ||
              String(inv.id) === String(documentId) ||
              String(inv.invoiceNumber) === String(documentId).replace(/^#/, '')
            );

            if (foundLocal) {
              fetchedInvoice = foundLocal;
              if (Array.isArray(foundLocal.items) && foundLocal.items.length > 0) {
                fetchedLines = foundLocal.items.map((it: any, idx: number) => ({
                  id: it.id || String(idx),
                  name: it.name || it.itemName || 'صنف مبيعات',
                  code: it.code || '',
                  quantity: Number(it.quantity || it.qty || 1),
                  price: Number(it.price || it.unitPrice || 0),
                  total: Number(it.total || (Number(it.quantity || 1) * Number(it.price || 0))),
                  tax: Number(it.tax || 0),
                  unit: it.unit || 'حبة'
                }));
              }
            }
          }

          // If still invoice found in remote format without lines joined
          if (fetchedInvoice && fetchedLines.length === 0 && Array.isArray(fetchedInvoice.items)) {
            fetchedLines = fetchedInvoice.items.map((it: any, idx: number) => ({
              id: it.id || String(idx),
              name: it.name || it.itemName || 'صنف مبيعات',
              code: it.code || '',
              quantity: Number(it.quantity || it.qty || 1),
              price: Number(it.price || it.unitPrice || 0),
              total: Number(it.total || (Number(it.quantity || 1) * Number(it.price || 0))),
              tax: Number(it.tax || 0),
              unit: it.unit || 'حبة'
            }));
          }

          if (isMounted) {
            if (fetchedInvoice) {
              const totals = fetchedInvoice.totals || {
                subtotal: Number(fetchedInvoice.subtotal || fetchedInvoice.net_total || 0),
                totalDiscount: Number(fetchedInvoice.discount || 0),
                taxAmount: Number(fetchedInvoice.tax || fetchedInvoice.tax_amount || 0),
                grandTotal: Number(fetchedInvoice.grand_total || fetchedInvoice.total || 0),
                cashPaid: Number(fetchedInvoice.cash_paid || 0),
                remainingBalance: Number(fetchedInvoice.remaining_balance || 0)
              };

              setInvoiceData({
                id: fetchedInvoice.id || cleanDocId,
                invoiceNumber: fetchedInvoice.invoiceNumber || fetchedInvoice.invoice_number || cleanDocId,
                date: fetchedInvoice.date || fetchedInvoice.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
                dueDate: fetchedInvoice.dueDate || fetchedInvoice.due_date,
                partnerName: fetchedInvoice.partnerName || fetchedInvoice.customer_name || 'عميل نقدي / عام',
                partnerTaxNo: fetchedInvoice.partnerTaxNo || fetchedInvoice.customer_tax_number,
                status: fetchedInvoice.status || 'POSTED',
                invoiceType: fetchedInvoice.invoiceType || (fetchedInvoice.is_tax_invoice ? 'فاتورة ضريبية' : 'فاتورة مبيعات عادية'),
                notes: fetchedInvoice.notes || fetchedInvoice.description,
                items: fetchedLines,
                totals: {
                  subtotal: Number(totals.subtotal || 0),
                  totalDiscount: Number(totals.totalDiscount || 0),
                  taxAmount: Number(totals.taxAmount || 0),
                  grandTotal: Number(totals.grandTotal || (totals.subtotal + (totals.taxAmount || 0))),
                  cashPaid: Number(totals.cashPaid || 0),
                  remainingBalance: Number(totals.remainingBalance || 0)
                }
              });
            } else {
              setFetchError('لم يتم العثور على بيانات الفاتورة المطلوبة');
            }
          }
        } 
        else if (normalizedType === 'receipt') {
          let fetchedReceipt: any = null;

          // 1. Try Supabase first
          if (supabase) {
            try {
              const { data: recRes } = await supabase
                .from('receipts')
                .select('*')
                .or(`id.eq.${cleanDocId},voucher_number.eq.${cleanDocId},voucherNumber.eq.${cleanDocId}`)
                .maybeSingle();

              if (recRes) {
                fetchedReceipt = recRes;
              }
            } catch (e) {
              console.warn('Supabase receipts fetch fallback to local:', e);
            }
          }

          // 2. Fallback to Local Storage vouchers
          if (!fetchedReceipt) {
            const allLocalReceipts = loadReceiptVouchers();
            const foundRec = allLocalReceipts.find(rc => 
              String(rc.id) === cleanDocId || 
              String(rc.voucherNumber) === cleanDocId ||
              String(rc.voucherNumber) === String(documentId).replace(/^#/, '') ||
              String(rc.id) === String(documentId)
            );
            if (foundRec) {
              fetchedReceipt = foundRec;
            }
          }

          if (isMounted) {
            if (fetchedReceipt) {
              setReceiptData({
                id: fetchedReceipt.id || cleanDocId,
                voucherNumber: fetchedReceipt.voucherNumber || fetchedReceipt.voucher_number || cleanDocId,
                date: fetchedReceipt.date || fetchedReceipt.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
                partnerName: fetchedReceipt.partnerName || fetchedReceipt.customer_name || 'العميل المستلم منه',
                amount: Number(fetchedReceipt.amount || 0),
                paymentMethod: fetchedReceipt.paymentMethod || fetchedReceipt.payment_method || 'CASH',
                description: fetchedReceipt.description || fetchedReceipt.notes || 'سداد دفعة نقدية لحساب العميل',
                status: fetchedReceipt.status || 'POSTED',
                referenceNo: fetchedReceipt.referenceNo || fetchedReceipt.reference_no,
                bankName: fetchedReceipt.bankName || fetchedReceipt.bank_name
              });
            } else {
              setFetchError('لم يتم العثور على بيانات سند القبض');
            }
          }
        }
        else {
          // Journal Entry / General
          const localEntries = loadJournalEntries();
          const foundEntry = localEntries.find(je => 
            String(je.id) === cleanDocId || 
            String(je.entryNumber) === cleanDocId ||
            String(je.entryNumber) === String(documentId).replace(/^#/, '')
          );

          if (isMounted) {
            if (foundEntry) {
              setJournalData({
                id: foundEntry.id,
                entryNumber: foundEntry.entryNumber,
                date: foundEntry.date,
                description: foundEntry.description || 'قيد تسوية محاسبي',
                lines: foundEntry.lines || [],
                totalDebit: foundEntry.lines?.reduce((sum, l) => sum + (Number(l.debit) || 0), 0) || 0,
                totalCredit: foundEntry.lines?.reduce((sum, l) => sum + (Number(l.credit) || 0), 0) || 0
              });
            } else {
              setJournalData({
                id: cleanDocId,
                entryNumber: cleanDocId,
                date: new Date().toISOString().slice(0, 10),
                description: 'حركة قيد محاسبي مسجلة في كشف الحساب',
                lines: []
              });
            }
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Error fetching document:', err);
          setFetchError(err.message || 'حدث خطأ أثناء تحميل بيانات المستند');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchDocumentDetails();

    return () => {
      isMounted = false;
    };
  }, [isOpen, documentId, normalizedType]);

  // Handle printing: Print only the document modal content
  const handlePrint = () => {
    window.print();
  };

  // Navigate directly to original document screen
  const handleOpenScreen = () => {
    if (normalizedType === 'invoice') {
      try {
        sessionStorage.setItem('alpha_target_sales_invoice_id', String(invoiceData?.id || documentId));
        sessionStorage.setItem('alpha_target_sales_invoice_number', String(invoiceData?.invoiceNumber || documentId));
      } catch {}
      window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'sales' } }));
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('alpha-highlight-sales-invoice', { detail: { invoice: invoiceData } }));
      }, 50);
    } else if (normalizedType === 'receipt') {
      try {
        sessionStorage.setItem('alpha_target_voucher_id', String(receiptData?.id || documentId));
        sessionStorage.setItem('alpha_target_voucher_number', String(receiptData?.voucherNumber || documentId));
      } catch {}
      window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'externalReceipt' } }));
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('alpha-highlight-voucher', { detail: { voucher: receiptData } }));
      }, 50);
    } else if (normalizedType === 'journal_entry') {
      try {
        sessionStorage.setItem('alpha_target_journal_entry_id', String(journalData?.id || documentId));
        sessionStorage.setItem('alpha_target_journal_entry_number', String(journalData?.entryNumber || documentId));
      } catch {}
      window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'journal' } }));
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('alpha-highlight-journal-entry', { detail: { entry: journalData } }));
      }, 50);
    }
    onClose();
  };

  if (!isOpen) return null;

  // Title and subtitle builder based on type
  const getHeaderInfo = () => {
    if (normalizedType === 'invoice') {
      const invNum = invoiceData?.invoiceNumber || documentId;
      return {
        title: `تفاصيل فاتورة مبيعات رقم ${invNum}`,
        subtitle: invoiceData?.invoiceType || 'فاتورة معتمدة في قيود المبيعات',
        icon: <FileText className="text-blue-600" size={22} />
      };
    }
    if (normalizedType === 'receipt') {
      const recNum = receiptData?.voucherNumber || documentId;
      return {
        title: `تفاصيل سند قبض نقدية رقم ${recNum}`,
        subtitle: 'سند تحصيل وقبض نقدية مسجل في الحسابات',
        icon: <Receipt className="text-emerald-600" size={22} />
      };
    }
    return {
      title: `تفاصيل القيد المحاسبي رقم ${journalData?.entryNumber || documentId}`,
      subtitle: 'قيد محاسبي مرحل بدفتر اليومية العامة',
      icon: <Layers className="text-indigo-600" size={22} />
    };
  };

  const headerInfo = getHeaderInfo();

  const formatPaymentMethod = (pm?: string) => {
    switch (pm?.toUpperCase()) {
      case 'BANK_TRANSFER':
      case 'BANK':
        return 'تحويل بنكي / إيداع';
      case 'CHECK':
        return 'شيك بنكي';
      case 'SPAN':
        return 'مدى / شبكة نقطة بيع';
      case 'CASH':
      default:
        return 'نقداً من الصندوق الخزينة';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
      dir="rtl"
      role="dialog"
      aria-modal="true"
    >
      {/* Print Specific CSS Style Injection for Clean Isolation */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #document-viewer-printable-modal,
          #document-viewer-printable-modal * {
            visibility: visible !important;
          }
          #document-viewer-printable-modal {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 15mm !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            z-index: 999999 !important;
          }
        }
      `}</style>

      {/* Modal Container */}
      <div 
        id="document-viewer-printable-modal"
        className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 print:block print:max-w-none print:w-full print:max-h-none print:shadow-none print:border-none"
      >
        {/* Header - Visible in Screen & Print */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-xs">
              {headerInfo.icon}
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base sm:text-lg">
                {headerInfo.title}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {headerInfo.subtitle}
              </p>
            </div>
          </div>

          {/* Action buttons (Open Original Screen, Print & Close) - Hidden when printing */}
          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handleOpenScreen}
              disabled={loading || !!fetchError}
              className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 hover:border-blue-600 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="فتح المستند في شاشته الأصلية"
            >
              <ExternalLink size={14} />
              <span className="hidden sm:inline">فتح في الشاشة الأصلية</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !!fetchError}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="طباعة المستند"
            >
              <Printer size={15} />
              <span>طباعة</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer"
              title="إغلاق النافذة"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-slate-800 flex-1">
          {/* Loading State */}
          {loading && (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">جاري جلب تفاصيل المستند من السجلات...</p>
            </div>
          )}

          {/* Error State */}
          {!loading && fetchError && (
            <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
              <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-sm">تعذر عرض المستند:</span>
                <p className="mt-1">{fetchError}</p>
              </div>
            </div>
          )}

          {/* 1. CASE INVOICE (حالة الفاتورة) */}
          {!loading && !fetchError && normalizedType === 'invoice' && invoiceData && (
            <div className="space-y-5">
              {/* Customer & Invoice Metadata Info Bar */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block font-semibold">العميل / السيد:</span>
                  <span className="font-bold text-slate-900 text-sm flex items-center gap-1 mt-0.5">
                    <User size={14} className="text-slate-500" />
                    <span>{invoiceData.partnerName}</span>
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-semibold">تاريخ الفاتورة:</span>
                  <span className="font-mono font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                    <Calendar size={13} className="text-slate-500" />
                    <span>{invoiceData.date}</span>
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-semibold">الرقم الضريبي للعميل:</span>
                  <span className="font-mono font-bold text-slate-700 mt-0.5 block">
                    {invoiceData.partnerTaxNo || 'غير مسجل'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-semibold">حالة الاعتماد:</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold mt-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 size={12} />
                    <span>{invoiceData.status === 'POSTED' ? 'مرحلة ومعتمدة' : 'مسودة قيد المراجعة'}</span>
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                    <Layers size={15} className="text-blue-600" />
                    <span>قائمة الأصناف والبنود المسجلة:</span>
                  </h4>
                  <span className="text-xs text-slate-500 font-mono">
                    عدد البنود: {invoiceData.items.length}
                  </span>
                </div>

                {invoiceData.items.length > 0 ? (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">#</th>
                          <th className="py-2.5 px-3">اسم الصنف</th>
                          <th className="py-2.5 px-3 text-center">الكمية</th>
                          <th className="py-2.5 px-3 text-center">السعر</th>
                          <th className="py-2.5 px-3 text-center">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {invoiceData.items.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-800">
                              <div>{item.name}</div>
                              {item.code && (
                                <span className="font-mono text-[10px] text-slate-400">
                                  [{item.code}]
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                              {item.quantity} {item.unit && <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                              {item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-700">
                              {item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-5 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                    لا تتوفر تفاصيل بنود تفصيلية لهذه الفاتورة
                  </div>
                )}
              </div>

              {/* Notes if available */}
              {invoiceData.notes && (
                <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200 text-xs">
                  <span className="text-slate-400 font-bold block mb-1">ملاحظات الفاتورة:</span>
                  <p className="text-slate-700">{invoiceData.notes}</p>
                </div>
              )}

              {/* Financial Totals Breakdown */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs max-w-sm mr-auto">
                <div className="flex justify-between items-center text-slate-600">
                  <span>المجموع الفرعي (قبل الضريبة):</span>
                  <span className="font-mono font-bold text-slate-900">
                    {invoiceData.totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                  </span>
                </div>

                {Number(invoiceData.totals.totalDiscount || 0) > 0 && (
                  <div className="flex justify-between items-center text-rose-600">
                    <span>مبلغ الخصم:</span>
                    <span className="font-mono font-bold">
                      -{Number(invoiceData.totals.totalDiscount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                    </span>
                  </div>
                )}

                {Number(invoiceData.totals.taxAmount || 0) > 0 && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span>ضريبة القيمة المضافة (15%):</span>
                    <span className="font-mono font-bold text-slate-900">
                      {invoiceData.totals.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center border-t border-slate-200 pt-2 font-black text-slate-900 text-sm">
                  <span>الإجمالي الكلي للفاتورة:</span>
                  <span className="font-mono text-base text-blue-700">
                    {invoiceData.totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 2. CASE RECEIPT (حالة سند القبض) */}
          {!loading && !fetchError && normalizedType === 'receipt' && receiptData && (
            <div className="space-y-5">
              {/* Receipt Visual Certificate Card */}
              <div className="bg-gradient-to-br from-emerald-50/60 via-white to-emerald-50/30 p-6 rounded-3xl border border-emerald-200/80 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-200/20 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center justify-between border-b border-emerald-100 pb-4 mb-4">
                  <div className="flex items-center gap-2 text-emerald-900">
                    <Receipt className="text-emerald-600" size={24} />
                    <span className="font-black text-base">سند قبض نقدية وتحصيل</span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-[11px] text-slate-400 block">رقم السند:</span>
                    <span className="font-black text-emerald-800 text-sm">#{receiptData.voucherNumber}</span>
                  </div>
                </div>

                {/* Structured Acknowledgment Fields */}
                <div className="space-y-4 text-xs sm:text-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white/80 rounded-xl border border-emerald-100">
                    <span className="text-slate-500 font-bold shrink-0">استلمنا من السيد / العميل:</span>
                    <span className="font-black text-slate-900 text-sm">{receiptData.partnerName}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white/80 rounded-xl border border-emerald-100">
                    <span className="text-slate-500 font-bold shrink-0">مبلغ وقدره:</span>
                    <span className="font-mono font-black text-emerald-800 text-base">
                      {receiptData.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white/80 rounded-xl border border-emerald-100">
                    <span className="text-slate-500 font-bold shrink-0">وذلك عن (البيان):</span>
                    <span className="font-bold text-slate-800">{receiptData.description}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 flex items-center justify-between">
                      <span className="text-slate-500 text-xs font-semibold">طريقة الدفع:</span>
                      <span className="font-bold text-slate-900 text-xs">
                        {formatPaymentMethod(receiptData.paymentMethod)}
                      </span>
                    </div>

                    <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 flex items-center justify-between">
                      <span className="text-slate-500 text-xs font-semibold">تاريخ السند:</span>
                      <span className="font-mono font-bold text-slate-900 text-xs">{receiptData.date}</span>
                    </div>
                  </div>

                  {(receiptData.referenceNo || receiptData.bankName) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {receiptData.bankName && (
                        <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 flex items-center justify-between">
                          <span className="text-slate-500 text-xs">البنك المحول إليه:</span>
                          <span className="font-bold text-slate-800 text-xs">{receiptData.bankName}</span>
                        </div>
                      )}
                      {receiptData.referenceNo && (
                        <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 flex items-center justify-between">
                          <span className="text-slate-500 text-xs">رقم العملية / المرجع:</span>
                          <span className="font-mono font-bold text-slate-800 text-xs">{receiptData.referenceNo}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. CASE JOURNAL ENTRY (حالة قيد اليومية) */}
          {!loading && !fetchError && normalizedType === 'journal_entry' && journalData && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-semibold">رقم القيد:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">#{journalData.entryNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">تاريخ القيد:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{journalData.date}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block font-semibold">البيان العام:</span>
                  <span className="font-bold text-slate-800 text-sm">{journalData.description}</span>
                </div>
              </div>

              {journalData.lines && journalData.lines.length > 0 && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">الحساب</th>
                        <th className="py-2.5 px-3">البيان</th>
                        <th className="py-2.5 px-3 text-center text-rose-700 bg-rose-50/50">مدين</th>
                        <th className="py-2.5 px-3 text-center text-emerald-700 bg-emerald-50/50">دائن</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {journalData.lines.map((ln, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            <div>{ln.accountName || 'حساب فرعي'}</div>
                            {ln.accountCode && (
                              <span className="font-mono text-[10px] text-slate-400">[{ln.accountCode}]</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{ln.description || journalData.description}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-700 bg-rose-50/20">
                            {ln.debit > 0 ? ln.debit.toLocaleString() : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700 bg-emerald-50/20">
                            {ln.credit > 0 ? ln.credit.toLocaleString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-black">
                      <tr>
                        <td colSpan={2} className="py-2.5 px-3 text-slate-700">الإجمالي:</td>
                        <td className="py-2.5 px-3 text-center font-mono text-rose-700">
                          {(journalData.totalDebit || 0).toLocaleString()} {currencySymbol}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-emerald-700">
                          {(journalData.totalCredit || 0).toLocaleString()} {currencySymbol}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between print:hidden">
          <span className="text-[11px] text-slate-400 font-medium">
            نظام المحاسبة وإدارة الفواتير المعتمد
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentViewerModal;
