import { forwardRef, useMemo } from 'react';
import { QrCode, Phone, MapPin, User, FileText, Calendar, CreditCard, Clock, ShieldCheck } from 'lucide-react';
import type { PrintPreviewData } from './PrintPreviewModal';
import { tafqeetArabic, tafqeetEnglish } from '../utils/tafqeet';
import { getSystemSettings } from '../utils/settings';
import { getCurrencyInfo } from '../utils/currency';
import { 
  type PrintPaperFormat, 
  type CustomPaperSize, 
  type PrintColorMode,
  getPaperFormatDef 
} from '../utils/printPaperFormats';

export interface CertifiedInvoiceDocumentProps {
  data: PrintPreviewData;
  format?: PrintPaperFormat;
  customSize?: CustomPaperSize;
  colorMode?: PrintColorMode;
  language?: 'ar' | 'en';
  className?: string;
  id?: string;
}

function translateDocTitle(title: string, isEn: boolean): string {
  if (!isEn) return title;
  const map: Record<string, string> = {
    'فاتورة مبيعات ضريبية': 'TAX SALES INVOICE',
    'فاتورة مبيعات عامة': 'SALES INVOICE',
    'فاتورة ضريبية': 'TAX INVOICE',
    'فاتورة مبيعات': 'SALES INVOICE',
    'فاتورة مشتريات ضريبية': 'TAX PURCHASE INVOICE',
    'فاتورة مشتريات عامة': 'PURCHASE INVOICE',
    'فاتورة مشتريات': 'PURCHASE INVOICE',
    'سند قبض': 'RECEIPT VOUCHER',
    'سند قبض مالي': 'RECEIPT VOUCHER',
    'سند صرف': 'PAYMENT VOUCHER',
    'سند صرف مالي': 'PAYMENT VOUCHER',
    'سند قيد': 'JOURNAL ENTRY VOUCHER',
    'سند قيد داخلي': 'INTERNAL JOURNAL VOUCHER',
    'كشف حساب': 'STATEMENT OF ACCOUNT',
    'كشف حساب شريك': 'PARTNER STATEMENT OF ACCOUNT',
    'عرض أسعار': 'PRICE QUOTATION',
    'مسير رواتب': 'PAYROLL SHEET',
    'أمر تصنيع': 'MANUFACTURING ORDER',
  };
  return map[title.trim()] || title.toUpperCase();
}

function translateSubtitle(sub: string | undefined, isEn: boolean): string {
  if (!sub) return '';
  if (!isEn) return sub;
  const map: Record<string, string> = {
    'فاتورة مرحلة ومعتمدة نظامياً': 'Official Posted & Certified Invoice',
    'مسودة فاتورة قيد الإعداد': 'Draft Invoice Under Preparation',
    'سند قبض مرحل ومعتمد': 'Posted & Certified Receipt Voucher',
    'سند صرف مرحل ومعتمد': 'Posted & Certified Payment Voucher',
    'سند قيد محاسبي معتمد': 'Approved Accounting Journal Voucher',
  };
  return map[sub.trim()] || sub;
}

function translatePaymentMethod(method: string | undefined, isEn: boolean): string {
  if (!method) return isEn ? 'Cash' : 'نقدي';
  if (!isEn) return method;
  const map: Record<string, string> = {
    'مبيعات نقدية': 'Cash Sales',
    'مبيعات جزئية': 'Partial Sales',
    'مبيعات آجلة': 'Credit Sales',
    'مرتجع مبيعات نقدي': 'Cash Sales Return',
    'مرتجع مبيعات جزئي': 'Partial Sales Return',
    'مرتجع مبيعات آجل': 'Credit Sales Return',
    'مشتريات نقدية': 'Cash Purchases',
    'مشتريات آجلة': 'Credit Purchases',
    'نقدي': 'Cash',
    'شبكة / مدى': 'POS / Card / Mada',
    'تحويل بنكي': 'Bank Transfer',
    'شيك': 'Cheque',
    'آجل': 'Credit / On Account',
  };
  return map[method.trim()] || method;
}

export const CertifiedInvoiceDocument = forwardRef<HTMLDivElement, CertifiedInvoiceDocumentProps>(
  ({ data, format = 'A4', customSize, colorMode = 'bw', language = 'ar', className = '', id = 'certified-invoice-document' }, ref) => {
    const isEn = language === 'en';
    const settings = getSystemSettings();
    const def = getPaperFormatDef(format, customSize);

    const grandAmount = data.grandTotal ?? data.amount ?? 0;
    
    const currencyInfo = useMemo(() => {
      if (data.currency) {
        return getCurrencyInfo(data.currency);
      }
      return getCurrencyInfo(settings?.financial?.currency);
    }, [data.currency, settings?.financial?.currency]);

    const currSymbol = isEn ? currencyInfo.symbolEn : currencyInfo.symbol;
    const currFullName = isEn ? `${currencyInfo.nameEn} (${currencyInfo.code})` : `${currencyInfo.nameAr} (${currencyInfo.code})`;

    const tafqeetText = useMemo(() => {
      if (isEn) {
        return tafqeetEnglish(grandAmount, currencyInfo.nameEn, currencyInfo.subunitEn);
      }
      return data.amountInWords || tafqeetArabic(grandAmount, currencyInfo.nameAr, currencyInfo.subunitAr);
    }, [data.amountInWords, grandAmount, isEn, currencyInfo]);

    const isCompact = def.widthMm <= 110;
    const isThermal = def.isThermal || isCompact;
    const isBw = colorMode === 'bw';

    const isVoucher = Boolean(
      data.voucherType ||
      data.title.includes('سند') ||
      data.title.toLowerCase().includes('voucher')
    );
    const isReceiptVoucher = data.voucherType === 'RECEIPT' || data.title.includes('قبض');
    const isPaymentVoucher = data.voucherType === 'PAYMENT' || data.title.includes('صرف');
    const isInternalVoucher = data.voucherType === 'INTERNAL' || data.title.includes('تحويل');

    const isSalesDoc = Boolean(
      data.partnerType === 'CUSTOMER' ||
      data.title.includes('مبيعات') ||
      data.title.toLowerCase().includes('sale')
    );
    const isPurchaseDoc = Boolean(
      data.partnerType === 'VENDOR' ||
      data.title.includes('مشتريات') ||
      data.title.toLowerCase().includes('purchase')
    );

    // Color Palette per Document Type:
    // Sales Invoices -> Sky Cyan & Deep Indigo
    // Purchases Invoices -> Green & Emerald
    // Receipt Vouchers -> Emerald / Teal & Dark Blue
    // Payment Vouchers -> Rose / Ruby & Deep Indigo
    // Internal Vouchers -> Violet & Cobalt Blue
    const docTheme = useMemo(() => {
      if (isBw) {
        return {
          banner: 'bg-slate-100 border-2 border-black text-black',
          tableHeader: 'bg-slate-200 text-black border-b-2 border-black',
          accentText: 'text-black',
          totalBg: 'border-2 border-black bg-slate-200 text-black',
          totalText: 'text-black',
          badge: 'bg-white text-black border border-black',
        };
      }

      // Sales Invoice: Sky Cyan & Indigo
      if (isSalesDoc && !isVoucher) {
        return {
          banner: 'bg-gradient-to-r from-sky-600 via-indigo-900 to-slate-950 text-white shadow-md border-b-2 border-sky-400',
          tableHeader: 'bg-gradient-to-r from-indigo-950 via-slate-900 to-sky-950 text-sky-200 border-b border-sky-600/50',
          accentText: 'text-sky-300',
          totalBg: 'bg-gradient-to-r from-indigo-950 via-sky-950 to-indigo-900 text-white shadow-md border border-sky-500/40',
          totalText: 'text-sky-300',
          badge: 'bg-sky-500/20 text-sky-200 border border-sky-400/40',
        };
      }

      // Purchases Invoice: Green & Emerald
      if (isPurchaseDoc && !isVoucher) {
        return {
          banner: 'bg-gradient-to-r from-emerald-600 via-teal-900 to-slate-950 text-white shadow-md border-b-2 border-emerald-400',
          tableHeader: 'bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-emerald-200 border-b border-emerald-600/50',
          accentText: 'text-emerald-300',
          totalBg: 'bg-gradient-to-r from-emerald-950 via-teal-950 to-emerald-900 text-white shadow-md border border-emerald-500/40',
          totalText: 'text-emerald-300',
          badge: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40',
        };
      }

      // Receipt Voucher: Emerald / Teal & Dark Slate
      if (isReceiptVoucher) {
        return {
          banner: 'bg-gradient-to-r from-emerald-700 via-teal-900 to-slate-950 text-white shadow-md border-b-2 border-emerald-400',
          tableHeader: 'bg-gradient-to-r from-emerald-950 to-teal-950 text-emerald-200',
          accentText: 'text-emerald-300',
          totalBg: 'bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white shadow-md',
          totalText: 'text-emerald-300',
          badge: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40',
        };
      }

      // Payment Voucher: Rose / Ruby & Deep Slate
      if (isPaymentVoucher) {
        return {
          banner: 'bg-gradient-to-r from-rose-700 via-purple-950 to-slate-950 text-white shadow-md border-b-2 border-rose-400',
          tableHeader: 'bg-gradient-to-r from-rose-950 to-slate-950 text-rose-200',
          accentText: 'text-rose-300',
          totalBg: 'bg-gradient-to-r from-rose-950 via-slate-900 to-purple-950 text-white shadow-md',
          totalText: 'text-rose-300',
          badge: 'bg-rose-500/20 text-rose-200 border border-rose-400/40',
        };
      }

      // Internal Voucher: Violet & Cobalt Blue
      if (isInternalVoucher) {
        return {
          banner: 'bg-gradient-to-r from-indigo-700 via-purple-900 to-slate-950 text-white shadow-md border-b-2 border-indigo-400',
          tableHeader: 'bg-gradient-to-r from-indigo-950 to-purple-950 text-indigo-200',
          accentText: 'text-indigo-300',
          totalBg: 'bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-900 text-white shadow-md',
          totalText: 'text-indigo-300',
          badge: 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/40',
        };
      }

      // Default (Quotations, Statements, etc.)
      return {
        banner: 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md border-b-2 border-slate-600',
        tableHeader: 'bg-slate-900 text-slate-100',
        accentText: 'text-amber-300',
        totalBg: 'bg-gradient-to-r from-slate-900 to-indigo-950 text-white shadow-md',
        totalText: 'text-amber-300',
        badge: 'bg-white/20 text-amber-300',
      };
    }, [isBw, isSalesDoc, isPurchaseDoc, isVoucher, isReceiptVoucher, isPaymentVoucher, isInternalVoucher]);

    const companyName = isEn 
      ? (settings?.company?.nameEn || settings?.company?.nameAr || 'Logostria Accounting Solutions Co.')
      : (settings?.company?.nameAr || 'شركة لوجوستريا للمحاسبة والحلول المالية');

    const companyAddress = isEn
      ? (settings?.company?.address || 'Kingdom of Saudi Arabia - Riyadh')
      : (settings?.company?.address || 'المملكة العربية السعودية - الرياض');

    const partnerTypeBadge = data.partnerType === 'VENDOR' 
      ? (isEn ? 'Supplier / Vendor' : 'مورد معتمد') 
      : data.partnerType === 'EMPLOYEE' 
      ? (isEn ? 'Employee' : 'موظف') 
      : (isEn ? 'Customer' : 'عميل معتمد');

    const partnerRoleLabel = data.partnerType === 'VENDOR'
      ? (isEn ? 'Vendor / Supplier:' : 'اسم المورد:')
      : data.partnerType === 'EMPLOYEE'
      ? (isEn ? 'Employee Name:' : 'اسم الموظف:')
      : (isEn ? 'Customer Name:' : 'اسم العميل:');

    // ==========================================
    // Thermal / POS Receipt Layout (58mm, 80mm, 110mm, A7)
    // ==========================================
    if (isThermal) {
      return (
        <div
          ref={ref}
          id={id}
          dir={isEn ? 'ltr' : 'rtl'}
          style={{
            width: `${def.baseWidthPx}px`,
            minHeight: def.heightMm ? `${Math.round(def.heightMm * 3.7795)}px` : 'auto',
          }}
          className={`printable-invoice-doc bg-white print:!w-full print:!min-h-0 text-black shadow-sm border-2 border-black mx-auto select-none print:shadow-none print:border-none print:m-0 font-sans leading-relaxed ${
            def.widthMm <= 60 
              ? 'p-2 text-[10px]' 
              : def.widthMm <= 85 
              ? 'p-3 text-[11px]' 
              : 'p-4 text-xs'
          } ${className}`}
        >
          {/* Header */}
          <div className="text-center pb-2.5 border-b-2 border-dashed border-black space-y-1">
            {settings?.company?.logoUrl && (
              <img 
                src={settings.company.logoUrl} 
                alt="Logo" 
                className={`h-10 mx-auto object-contain mb-1 ${isBw ? 'filter grayscale contrast-125' : ''}`} 
              />
            )}
            <h1 className="font-black text-black text-sm leading-tight">
              {companyName}
            </h1>
            <p className="text-[10px] text-black font-semibold">
              {settings?.company?.branchName ? `${settings.company.branchName} - ` : ''}
              {companyAddress}
            </p>
            <div className="text-[10px] text-black font-mono font-bold flex flex-wrap justify-center gap-2">
              <span>{isEn ? 'Tel:' : 'الهاتف:'} {settings?.company?.phone || '+966 11 456 7890'}</span>
              <span>{isEn ? 'VAT No:' : 'الرقم الضريبي:'} {settings?.company?.taxNumber || '310123456700003'}</span>
            </div>
          </div>

          {/* Title & Doc Number */}
          <div className="py-2 border-b-2 border-dashed border-black text-center space-y-1">
            <h2 className="font-black text-xs text-black">
              {translateDocTitle(data.title, isEn)}
            </h2>
            <div className="flex justify-between items-center text-[10px] font-mono font-bold text-black">
              <span>{isEn ? 'Doc No:' : 'رقم المستند:'} #{data.docNumber}</span>
              <span>{isEn ? 'Date:' : 'التاريخ:'} {data.date}</span>
            </div>
          </div>

          {/* Customer Details Box in Thermal Receipt */}
          {data.partnerName && (
            <div className="py-2 border-b-2 border-dashed border-black text-[10px] space-y-1">
              <div className="flex justify-between items-start">
                <span className="font-bold text-black">{partnerRoleLabel}</span>
                <span className="font-black text-black text-right truncate max-w-[170px]">{data.partnerName}</span>
              </div>
              {data.partnerTaxNo && (
                <div className="flex justify-between items-center font-mono">
                  <span className="font-bold text-black">{isEn ? 'VAT No:' : 'الرقم الضريبي:'}</span>
                  <span className="font-black text-black">{data.partnerTaxNo}</span>
                </div>
              )}
              {data.partnerPhone && (
                <div className="flex justify-between items-center font-mono">
                  <span className="font-bold text-black">{isEn ? 'Phone:' : 'الهاتف:'}</span>
                  <span className="font-bold text-black" dir="ltr">{data.partnerPhone}</span>
                </div>
              )}
              {data.partnerAddress && (
                <div className="flex justify-between items-start text-[9px]">
                  <span className="font-bold text-black shrink-0">{isEn ? 'Address:' : 'العنوان:'}</span>
                  <span className="font-medium text-black text-right truncate max-w-[170px]">{data.partnerAddress}</span>
                </div>
              )}
            </div>
          )}

          {/* POS Voucher Monetary Block vs Invoice Items Table */}
          {isVoucher ? (
            <div className="py-2 border-b-2 border-dashed border-black space-y-2">
              {/* Paid Amount */}
              <div className="p-2 border-2 border-black bg-slate-100 rounded text-center">
                <span className="text-[9px] font-black block uppercase text-black">
                  {isEn 
                    ? (isReceiptVoucher ? 'Amount Received:' : 'Paid Amount:') 
                    : (isReceiptVoucher ? 'المبلغ المدفوع (المقبوض):' : 'المبلغ المدفوع:')}
                </span>
                <span className="text-base font-mono font-black text-black">
                  {grandAmount.toFixed(2)} {currSymbol}
                </span>
              </div>

              {/* Amount in Words */}
              <div className="p-1.5 border border-black rounded bg-white text-[9px] text-black">
                <span className="font-bold block text-[8px] text-slate-700">{isEn ? 'Amount in Words:' : 'المبلغ كتابة بالحروف وفقط:'}</span>
                <p className="font-black leading-tight">{tafqeetText}</p>
              </div>

              {/* Accounting Description */}
              {(data.notes || (data.items && data.items[0]?.description)) && (
                <div className="text-[9px] text-black">
                  <span className="font-bold">{isEn ? 'Purpose / Description:' : 'البيان المحاسبي:'} </span>
                  <span className="font-medium">{data.notes || (data.items && data.items[0]?.description)}</span>
                </div>
              )}

              {data.paymentMethod && (
                <div className="text-[9px] text-black">
                  <span className="font-bold">{isEn ? 'Method / Account:' : 'طريقة السداد / الحساب:'} </span>
                  <span className="font-medium">{data.paymentMethod}</span>
                </div>
              )}
            </div>
          ) : (
            /* Regular Invoice Items */
            data.items && data.items.length > 0 && (
              <div className="py-2 border-b-2 border-dashed border-black">
                <table className={`w-full ${isEn ? 'text-left' : 'text-right'} text-[10px] border-collapse`}>
                  <thead>
                    <tr className="border-b-2 border-black font-black text-black bg-slate-100">
                      <th className="py-1 px-1">{isEn ? 'Item' : 'الصنف'}</th>
                      <th className="py-1 px-1 text-center">{isEn ? 'Qty' : 'الكمية'}</th>
                      <th className={`py-1 px-1 ${isEn ? 'text-right' : 'text-left'}`}>{isEn ? 'Total' : 'الإجمالي'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/30">
                    {data.items.map((item, idx) => {
                      const total = item.total ?? ((item.quantity || 1) * (item.unitPrice || 0));
                      return (
                        <tr key={idx} className="py-1">
                          <td className="py-1 pr-1 font-bold text-black leading-tight">{item.description}</td>
                          <td className="py-1 text-center font-mono font-bold text-black">{item.quantity || 1}</td>
                          <td className={`py-1 ${isEn ? 'text-right' : 'text-left'} font-mono font-black text-black`}>
                            {total.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Totals */}
          <div className="py-2 border-b-2 border-dashed border-black space-y-1 font-mono text-[11px] font-bold text-black">
            {data.subtotal !== undefined && (
              <div className="flex justify-between">
                <span className="font-sans font-bold">{isEn ? 'Taxable Amount:' : 'المبلغ الخاضع للضريبة:'}</span>
                <span className="font-black">{data.subtotal.toFixed(2)} {currSymbol}</span>
              </div>
            )}
            {data.taxTotal !== undefined && data.taxTotal > 0 && (
              <div className="flex justify-between">
                <span className="font-sans font-bold">{isEn ? 'VAT 15%:' : 'ضريبة القيمة المضافة 15%:'}</span>
                <span className="font-black">{data.taxTotal.toFixed(2)} {currSymbol}</span>
              </div>
            )}
            {data.discountTotal !== undefined && data.discountTotal > 0 && (
              <div className="flex justify-between">
                <span className="font-sans font-bold">{isEn ? 'Discount:' : 'الخصم الممنوح:'}</span>
                <span className="font-black">-{data.discountTotal.toFixed(2)} {currSymbol}</span>
              </div>
            )}
            <div className="border-t-2 border-b-2 border-black py-2 my-1 flex justify-between items-baseline font-black text-black text-xs bg-slate-100 px-1">
              <span className="font-sans text-xs">{isEn ? 'GRAND TOTAL:' : 'الإجمالي النهائي:'}</span>
              <span className="text-sm font-black">{grandAmount.toFixed(2)} {currSymbol}</span>
            </div>

            {/* المبلغ كتابة بالحروف وفقط أسفل الإجمالي النهائي */}
            <div className="py-1 px-1 bg-slate-50 text-[10px] border border-black/30 rounded font-sans text-black leading-tight">
              <span className="font-bold block text-[9px] text-slate-700">{isEn ? 'Amount in Words:' : 'المبلغ كتابة وفقط:'}</span>
              <span className="font-bold">{tafqeetText}</span>
            </div>

            {data.paidAmount !== undefined && (
              <div className="pt-1 text-[9px] font-mono space-y-0.5 text-black">
                <div className="flex justify-between font-bold">
                  <span className="font-sans">{isEn ? 'Paid Amount:' : 'المسدد:'}</span>
                  <span className="font-black">{Number(data.paidAmount).toFixed(2)} {currSymbol}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="font-sans">{isEn ? 'Remaining:' : 'المتبقي:'}</span>
                  <span className="font-black">{(data.remainingBalance ?? Math.max(0, grandAmount - (data.paidAmount || 0))).toFixed(2)} {currSymbol}</span>
                </div>
                <div className="flex justify-between font-bold pt-0.5 border-t border-dotted border-black">
                  <span className="font-sans">{isEn ? 'Type:' : 'حالة السداد:'}</span>
                  <span className="font-black font-sans">
                    {data.paidAmount >= grandAmount - 0.001 && grandAmount > 0
                      ? (isEn ? 'Cash (Fully Paid)' : 'نقدية (سداد كامل)')
                      : data.paidAmount > 0.001
                      ? (isEn ? 'Partial Payment' : 'سداد جزئي')
                      : (isEn ? 'On Account (Credit)' : 'آجلة (غير مسددة)')}
                  </span>
                </div>
              </div>
            )}

            {data.partnerBalanceImpact && (
              <div className="pt-1.5 mt-1 border-t border-dashed border-black text-[9px] font-mono space-y-0.5 text-black">
                <div className="flex justify-between font-bold">
                  <span className="font-sans">{isEn ? 'Prev Balance:' : 'الرصيد السابق:'}</span>
                  <span>{data.partnerBalanceImpact.previousBalanceFormatted} {currSymbol}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="font-sans">{isEn ? 'This Invoice:' : 'قيمة الفاتورة:'}</span>
                  <span>+{data.partnerBalanceImpact.invoiceAmountFormatted} {currSymbol}</span>
                </div>
                {data.partnerBalanceImpact.paidAmount > 0 && (
                  <div className="flex justify-between font-bold">
                    <span className="font-sans">{isEn ? 'Paid Amount (-):' : 'المسدد (-):'}</span>
                    <span>-{data.partnerBalanceImpact.paidAmountFormatted} {currSymbol}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-[10px] pt-0.5 border-t border-black">
                  <span className="font-sans">{isEn ? 'Balance After:' : 'الرصيد بعد الفاتورة:'}</span>
                  <span>{data.partnerBalanceImpact.newBalanceFormatted} {currSymbol} ({data.partnerBalanceImpact.newBalanceLabel})</span>
                </div>
              </div>
            )}
          </div>

          {/* QR Code */}
          <div className="py-2.5 text-center flex flex-col items-center justify-center">
            <div className="p-1 bg-white border-2 border-black rounded inline-block">
              <QrCode size={def.widthMm <= 60 ? 44 : 56} className="text-black" />
            </div>
            <span className="text-[8px] font-mono font-black text-black mt-1">
              {isEn ? 'ZATCA Certified Simplified Tax Invoice' : 'فاتورة ضريبية مبسطة معتمدة (ZATCA)'}
            </span>
          </div>

          {/* Footer note */}
          <div className="text-center text-[9px] text-black font-bold pt-1 border-t-2 border-dashed border-black">
            {isEn ? 'Thank you for your business' : 'شكراً لتعاملكم معنا'}
          </div>
        </div>
      );
    }

    // ==========================================
    // Standard Paper Formats (A4, A5, A6, Half A4, Custom)
    // ==========================================
    const isMedium = def.widthMm <= 150;

    // Build Customer / Beneficiary items dynamically
    const customerItems: Array<{
      label: string;
      value: string | undefined;
      icon?: typeof Phone;
      isMono?: boolean;
      isBold?: boolean;
      dirLtr?: boolean;
    }> = [];

    // Partner name (always present or fallback)
    customerItems.push({
      label: partnerRoleLabel,
      value: data.partnerName || (isEn ? 'Cash Customer' : 'عميل نقدي'),
      isBold: true,
    });

    // Partner Tax Number (ONLY if exists and not empty)
    if (data.partnerTaxNo && data.partnerTaxNo.trim() !== '') {
      customerItems.push({
        label: isEn ? 'VAT / Tax No:' : 'الرقم الضريبي:',
        value: data.partnerTaxNo,
        isMono: true,
      });
    }

    // Partner Phone (ONLY if exists and not empty)
    if (data.partnerPhone && data.partnerPhone.trim() !== '') {
      customerItems.push({
        label: isEn ? 'Phone / Mobile:' : 'رقم الهاتف:',
        value: data.partnerPhone,
        icon: Phone,
        dirLtr: true,
      });
    }

    // Partner Address (ONLY if exists and not empty)
    if (data.partnerAddress && data.partnerAddress.trim() !== '') {
      customerItems.push({
        label: isEn ? 'Address / HQ:' : 'العنوان / المقر:',
        value: data.partnerAddress,
        icon: MapPin,
      });
    }

    // From Account (if exists)
    if (data.fromAccount && data.fromAccount.trim() !== '') {
      customerItems.push({
        label: isEn ? 'From Account:' : 'من حساب:',
        value: data.fromAccount,
      });
    }

    // To Account (if exists)
    if (data.toAccount && data.toAccount.trim() !== '') {
      customerItems.push({
        label: isEn ? 'To Account:' : 'إلى حساب:',
        value: data.toAccount,
      });
    }

    // Build Invoice / Payment items dynamically
    const invoiceMetaItems: Array<{
      label: string;
      value?: string;
      valueBadge?: string;
      icon?: typeof Calendar;
      iconColor?: string;
      isMono?: boolean;
      isBold?: boolean;
    }> = [];

    // Issue Date
    if (data.date && data.date.trim() !== '') {
      invoiceMetaItems.push({
        label: isEn ? 'Issue Date:' : 'تاريخ الإصدار:',
        value: data.date,
        icon: Calendar,
        iconColor: 'text-blue-600',
        isMono: true,
      });
    }

    // Due Date (ONLY if exists and not empty)
    if (data.dueDate && data.dueDate.trim() !== '') {
      invoiceMetaItems.push({
        label: isEn ? 'Due Date:' : 'تاريخ الاستحقاق:',
        value: data.dueDate,
        icon: Clock,
        iconColor: 'text-amber-600',
        isMono: true,
      });
    }

    // Payment Method (ONLY if exists and not empty)
    if (data.paymentMethod && data.paymentMethod.trim() !== '') {
      invoiceMetaItems.push({
        label: isEn ? 'Payment Method:' : 'طريقة السداد:',
        value: translatePaymentMethod(data.paymentMethod, isEn),
        icon: CreditCard,
        iconColor: 'text-emerald-600',
        isBold: true,
      });
    }


    // Service Type
    if (data.serviceType && data.serviceType.trim() !== '') {
      invoiceMetaItems.push({
        label: isEn ? 'Service Type:' : 'نوع الخدمة:',
        valueBadge: data.serviceType,
        icon: FileText,
        iconColor: 'text-indigo-600',
      });
    }

    // Invoice Classification (ONLY if classification exists and not empty: 'TAX' -> 'فاتورة ضريبية' or 'فاتورة عادية' without numbers)
    if (data.classification && data.classification.trim() !== '') {
      const isTax = data.classification === 'TAX';
      invoiceMetaItems.push({
        label: isEn ? 'Invoice Type:' : 'تصنيف الفاتورة:',
        valueBadge: isTax
          ? (isEn ? 'Tax Invoice' : 'فاتورة ضريبية')
          : (isEn ? 'Standard Invoice' : 'فاتورة عادية'),
        icon: ShieldCheck,
        iconColor: isTax ? 'text-emerald-600' : 'text-slate-600',
      });
    }

    const pairedRowCount = Math.max(customerItems.length, invoiceMetaItems.length);

    return (
      <div
        ref={ref}
        id={id}
        dir={isEn ? 'ltr' : 'rtl'}
        style={{
          width: `${def.baseWidthPx}px`,
          minHeight: def.heightMm ? `${Math.round(def.heightMm * 3.7795)}px` : 'auto',
        }}
        className={`printable-invoice-doc bg-white print:!w-full print:!min-h-0 ${
          isBw ? 'text-black border-2 border-black' : 'text-slate-900 border border-slate-300 shadow-md'
        } transition-all mx-auto select-none print:shadow-none print:border-none print:m-0 font-sans ${
          isMedium 
            ? 'p-4 rounded-lg text-[11px]' 
            : 'p-6 rounded-xl text-xs'
        } ${className}`}
      >
        {/* Header: Company Official Letterhead */}
        <div className={`pb-2.5 mb-2.5 ${isBw ? 'border-b-2 border-black' : 'border-b-2 border-slate-800'}`}>
          <div className="flex justify-between items-start gap-3">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                {settings?.company?.logoUrl ? (
                  <img 
                    src={settings.company.logoUrl} 
                    alt="Logo" 
                    className={`${isMedium ? 'h-8' : 'h-11'} w-auto object-contain rounded shrink-0 ${
                      isBw ? 'filter grayscale contrast-125' : 'shadow-2xs'
                    }`}
                  />
                ) : null}
                <div className="min-w-0">
                  <h1 className={`${isMedium ? 'text-lg' : 'text-xl'} font-black ${isBw ? 'text-black' : 'text-slate-900'} truncate`}>
                    {companyName}
                  </h1>
                  {settings?.company?.nameEn && !isEn && (
                    <p className={`text-[10px] font-bold font-sans ${isBw ? 'text-slate-800' : 'text-indigo-900'}`}>
                      {settings.company.nameEn}
                    </p>
                  )}
                  {settings?.company?.nameAr && isEn && (
                    <p className={`text-[10px] font-bold font-sans ${isBw ? 'text-slate-800' : 'text-indigo-900'}`}>
                      {settings.company.nameAr}
                    </p>
                  )}
                </div>
              </div>

              <p className={`text-[11px] font-bold pt-0.5 ${isBw ? 'text-black' : 'text-slate-700'}`}>
                {settings?.company?.branchName ? `${settings.company.branchName} - ` : ''}
                {companyAddress}
              </p>

              <div className={`flex flex-wrap items-center gap-3 text-[11px] font-bold font-mono pt-0.5 ${isBw ? 'text-black' : 'text-slate-700'}`}>
                <span>{isEn ? 'VAT No:' : 'الرقم الضريبي:'} {settings?.company?.taxNumber || '310123456700003'}</span>
                <span>{isEn ? 'CR:' : 'س.ت:'} {settings?.company?.commercialRegister || '1010987654'}</span>
                <span>{isEn ? 'Tel:' : 'الهاتف:'} {settings?.company?.phone || '+966 11 456 7890'}</span>
              </div>
            </div>

            {/* ZATCA E-Invoice QR Code Badge */}
            <div className={`flex flex-col items-center bg-white p-1.5 rounded-lg shrink-0 ${isBw ? 'border-2 border-black' : 'border border-slate-300 shadow-2xs'}`}>
              <div className={`${isMedium ? 'w-10 h-10' : 'w-12 h-12'} bg-white p-0.5 rounded ${isBw ? 'border border-black' : 'border border-slate-200'} flex items-center justify-center`}>
                <QrCode size={isMedium ? 34 : 42} className={isBw ? 'text-black' : 'text-slate-900'} />
              </div>
              <span className={`text-[7px] font-mono font-black mt-0.5 text-center ${isBw ? 'text-black' : 'text-indigo-800'}`}>
                ZATCA E-INVOICE
              </span>
            </div>
          </div>

          {/* Document Banner */}
          <div className={`mt-2 pt-2 flex justify-between items-center px-3 py-1.5 rounded-lg ${docTheme.banner}`}>
            <div>
              <h2 className={`${isMedium ? 'text-sm' : 'text-base'} font-black ${isBw ? 'text-black' : 'text-white'}`}>
                {translateDocTitle(data.title, isEn)}
              </h2>
              {data.subtitle && (
                <p className={`text-[10px] font-medium ${isBw ? 'text-slate-800' : 'text-slate-200'}`}>
                  {translateSubtitle(data.subtitle, isEn)}
                </p>
              )}
            </div>
            <div className={`${isEn ? 'text-right' : 'text-left'} font-mono`}>
              <span className={`text-[10px] block font-sans font-bold ${isBw ? 'text-slate-800' : 'text-slate-200'}`}>
                {isEn ? 'Document No.' : 'رقم المستند'}
              </span>
              <span className={`text-base font-black ${isBw ? 'text-black' : docTheme.accentText}`}>
                #{data.docNumber || '---'}
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* CUSTOMER & INVOICE DETAILS (PAIRED IN SAME ROWS TO SAVE SPACE) */}
        {/* ============================================================== */}
        {pairedRowCount > 0 && (
          <div className={`mb-2.5 rounded-lg overflow-hidden ${
            isBw ? 'border-2 border-black bg-white' : 'border border-slate-200 bg-white shadow-2xs'
          }`}>
            {/* Card Header Bar */}
            <div className={`px-3 py-1 flex items-center justify-between text-[11px] font-bold ${
              isBw 
                ? 'bg-slate-200 text-black border-b-2 border-black' 
                : 'bg-slate-100/90 text-slate-800 border-b border-slate-200'
            }`}>
              <div className="flex items-center gap-1.5">
                <User size={12} className={isBw ? 'text-black' : 'text-blue-600'} />
                <span className="">
                  {isEn ? 'CUSTOMER & INVOICE DETAILS' : 'بيانات العميل والفاتورة'}
                </span>
              </div>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                isBw ? 'bg-white border-black text-black' : 'bg-white border-slate-300 text-slate-700 shadow-2xs'
              }`}>
                {partnerTypeBadge}
              </span>
            </div>

            {/* Dynamic Paired Rows */}
            <div className={`divide-y text-xs ${isBw ? 'divide-black' : 'divide-slate-100'}`}>
              {Array.from({ length: pairedRowCount }).map((_, idx) => {
                const custItem = customerItems[idx];
                const metaItem = invoiceMetaItems[idx];

                return (
                  <div 
                    key={idx} 
                    className={`grid grid-cols-2 divide-x ${isEn ? '' : 'divide-x-reverse'} ${isBw ? 'divide-black' : 'divide-slate-200'}`}
                  >
                    {/* Customer Side (Right in RTL, Left in LTR) */}
                    <div className="p-1.5 px-2.5 flex items-center gap-1.5 min-w-0">
                      {custItem ? (
                        <>
                          {custItem.icon && (
                            <custItem.icon size={10} className={isBw ? 'text-black' : 'text-slate-600'} />
                          )}
                          <span className={`font-bold text-[10px] min-w-[75px] shrink-0 ${isBw ? 'text-black' : 'text-slate-600'}`}>
                            {custItem.label}
                          </span>
                          <span 
                            className={`text-xs truncate ${
                              custItem.isBold ? 'font-black text-black' : custItem.isMono ? 'font-mono font-black text-black' : 'font-semibold text-black'
                            }`}
                            dir={custItem.dirLtr ? 'ltr' : undefined}
                          >
                            {custItem.value}
                          </span>
                        </>
                      ) : null}
                    </div>

                    {/* Invoice Meta Side (Left in RTL, Right in LTR) */}
                    <div className={`p-1.5 px-2.5 flex items-center gap-1.5 min-w-0 ${isBw ? 'bg-slate-50/70' : 'bg-slate-50/50'}`}>
                      {metaItem ? (
                        <>
                          {metaItem.icon && (
                            <metaItem.icon size={10} className={isBw ? 'text-black' : metaItem.iconColor || 'text-slate-600'} />
                          )}
                          <span className={`font-bold text-[10px] min-w-[75px] shrink-0 ${isBw ? 'text-black' : 'text-slate-600'}`}>
                            {metaItem.label}
                          </span>
                          {metaItem.valueBadge ? (
                            <span className={`font-black text-[10px] inline-block px-1.5 py-0.2 rounded ${
                              isBw 
                                ? 'bg-slate-100 border border-black text-black' 
                                : 'bg-slate-200/80 border border-slate-300 text-slate-800'
                            }`}>
                              {metaItem.valueBadge}
                            </span>
                          ) : (
                            <span className={`text-xs truncate ${
                              metaItem.isBold ? 'font-bold text-black' : metaItem.isMono ? 'font-mono font-black text-black' : 'font-normal text-black'
                            }`}>
                              {metaItem.value}
                            </span>
                          )}
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Itemized Table OR Voucher Monetary Panel */}
        {isVoucher ? (
          <div className={`mb-3 rounded-xl overflow-hidden ${
            isBw ? 'border-2 border-black bg-white' : 'border border-slate-300 bg-white shadow-2xs'
          }`}>
            {/* Voucher Box Header Bar */}
            <div className={`px-4 py-2 flex items-center justify-between text-xs font-black ${
              isBw 
                ? 'bg-slate-200 text-black border-b-2 border-black' 
                : 'bg-gradient-to-r from-slate-900 to-indigo-950 text-white'
            }`}>
              <span className="">
                {isEn 
                  ? (isReceiptVoucher ? 'OFFICIAL RECEIPT VOUCHER DETAILS' : isPaymentVoucher ? 'OFFICIAL PAYMENT VOUCHER DETAILS' : 'INTERNAL TRANSFER VOUCHER DETAILS')
                  : (isReceiptVoucher ? 'بيانات سند القبض المالي المعتمد' : isPaymentVoucher ? 'بيانات سند الصرف المالي المعتمد' : 'بيانات سند التحويل المالي الداخلي')}
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                isBw ? 'bg-white text-black border border-black' : 'bg-white/20 text-amber-300'
              }`}>
                {isEn ? 'CERTIFIED MONETARY VOUCHER' : 'سند مالي مرحل ومعتمد'}
              </span>
            </div>

            <div className="p-4 space-y-3.5">
              {/* 1. المبلغ المدفوع (Paid Amount) */}
              <div className={`p-4 rounded-xl flex flex-row items-center justify-between gap-3 ${
                isBw 
                  ? 'bg-slate-100 border-2 border-black' 
                  : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xs'
              }`}>
                <div className="space-y-0.5">
                  <span className={`text-xs font-black uppercase block ${
                    isBw ? 'text-black' : 'text-slate-300'
                  }`}>
                    {isEn 
                      ? (isReceiptVoucher ? 'Amount Received / Paid:' : 'Paid Amount:') 
                      : (isReceiptVoucher ? 'المبلغ المدفوع (المقبوض):' : 'المبلغ المدفوع:')}
                  </span>
                  <span className={`text-[10px] font-medium block ${
                    isBw ? 'text-slate-700' : 'text-slate-400'
                  }`}>
                    {isEn ? 'Net Certified Monetary Value' : 'صافي القيمة النقدية المقيدة بالسند'}
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-mono font-black ${
                    isBw ? 'text-black' : 'text-amber-300'
                  }`}>
                    {grandAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    isBw ? 'bg-white border border-black text-black' : 'bg-white/10 text-white border border-white/20'
                  }`}>
                    {currFullName}
                  </span>
                </div>
              </div>

              {/* 2. أسفلها: المبلغ بالحروف وفقط (... فقط لا غير) */}
              <div className={`p-3.5 rounded-xl border ${
                isBw 
                  ? 'border-2 border-black bg-white text-black' 
                  : 'border-amber-300 bg-amber-50/90 text-amber-950 shadow-2xs'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-black flex items-center gap-1.5 ${
                    isBw ? 'text-black' : 'text-amber-900'
                  }`}>
                    <span>{isEn ? 'Amount in Words:' : 'المبلغ كتابة بالحروف وفقط:'}</span>
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    isBw ? 'bg-slate-200 text-black' : 'bg-amber-200/80 text-amber-900'
                  }`}>
                    {isEn ? 'Verified Tafqeet' : 'تفقيط معتمد'}
                  </span>
                </div>
                <p className={`text-sm font-black font-sans leading-relaxed ${
                  isBw ? 'text-black' : 'text-amber-950'
                }`}>
                  {tafqeetText}
                </p>
              </div>

              {/* 3. البيان والشرح المحاسبي والحساب */}
              <div className={`grid grid-cols-12 gap-3 p-3 rounded-xl border ${
                isBw ? 'border-2 border-black bg-slate-50' : 'border-slate-200 bg-slate-50/80'
              }`}>
                <div className="col-span-8 space-y-1">
                  <span className={`text-[10px] font-bold block ${
                    isBw ? 'text-black' : 'text-slate-600'
                  }`}>
                    {isEn ? 'Accounting Purpose / Being:' : 'وذلك عن (البيان والشرح المحاسبي لسبب السند):'}
                  </span>
                  <p className={`text-xs font-bold leading-relaxed ${
                    isBw ? 'text-black' : 'text-slate-900'
                  }`}>
                    {data.notes || (data.items && data.items[0]?.description) || (isReceiptVoucher ? 'سند قبض مالي معتمد' : isPaymentVoucher ? 'سند صرف مالي معتمد' : 'سند تحويل ومناقلة داخلية')}
                  </p>
                </div>

                <div className="col-span-4 space-y-1 border-r border-slate-200 pr-3">
                  <span className={`text-[10px] font-bold block ${
                    isBw ? 'text-black' : 'text-slate-600'
                  }`}>
                    {isEn ? 'Payment Method / Account:' : 'طريقة السداد / الحساب:'}
                  </span>
                  <p className={`text-xs font-black ${
                    isBw ? 'text-black' : 'text-indigo-900'
                  }`}>
                    {data.paymentMethod || (isEn ? 'Main Cash Vault' : 'الصندوق الرئيسي (نقداً)')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Regular Itemized Table for Invoices/Quotations/Orders */
          data.items && data.items.length > 0 && (
            <div className={`mb-2.5 overflow-hidden rounded-lg ${isBw ? 'border-2 border-black' : 'border border-slate-200 shadow-2xs'}`}>
              <table className={`w-full ${isEn ? 'text-left' : 'text-right'} border-collapse text-[11px]`}>
                <thead>
                  <tr className={`${docTheme.tableHeader} font-bold`}>
                    <th className={`py-1.5 px-2 w-7 text-center ${isBw ? (isEn ? 'border-r-2 border-black' : 'border-l-2 border-black') : (isEn ? 'border-r border-slate-700/60' : 'border-l border-slate-700/60')}`}>#</th>
                    <th className={`py-1.5 px-2 ${isBw ? (isEn ? 'border-r-2 border-black' : 'border-l-2 border-black') : (isEn ? 'border-r border-slate-700/60' : 'border-l border-slate-700/60')}`}>
                      {isEn ? 'Item' : 'الصنف'}
                    </th>
                    <th className={`py-1.5 px-2 text-center w-16 ${isBw ? (isEn ? 'border-r-2 border-black' : 'border-l-2 border-black') : (isEn ? 'border-r border-slate-700/60' : 'border-l border-slate-700/60')}`}>
                      {isEn ? 'Quantity' : 'الكمية'}
                    </th>
                    <th className={`py-1.5 px-2 ${isEn ? 'text-right' : 'text-left'} w-20 ${isBw ? (isEn ? 'border-r-2 border-black' : 'border-l-2 border-black') : (isEn ? 'border-r border-slate-700/60' : 'border-l border-slate-700/60')}`}>
                      {isEn ? 'Unit Price' : 'سعر الوحدة'}
                    </th>
                    {data.classification === 'TAX' && (
                      <th className={`py-1.5 px-2 text-center w-14 ${isBw ? (isEn ? 'border-r-2 border-black' : 'border-l-2 border-black') : (isEn ? 'border-r border-slate-700/60' : 'border-l border-slate-700/60')}`}>
                        {isEn ? 'VAT %' : 'الضريبة'}
                      </th>
                    )}
                    <th className={`py-1.5 px-2 ${isEn ? 'text-right' : 'text-left'} w-24`}>
                      {isEn ? `Total (${currSymbol})` : `الإجمالي (${currSymbol})`}
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isBw ? 'divide-slate-300' : 'divide-slate-100'}`}>
                  {data.items.map((item, idx) => {
                    const total = item.total ?? ((item.quantity || 1) * (item.unitPrice || 0));
                    return (
                      <tr key={idx} className={`${isBw ? 'even:bg-slate-50/60' : 'even:bg-slate-50/50 hover:bg-slate-50'}`}>
                        <td className={`py-1.5 px-2 text-center font-mono font-bold ${isBw ? (isEn ? 'text-black border-r border-slate-400' : 'text-black border-l border-slate-400') : (isEn ? 'text-slate-500 border-r border-slate-100' : 'text-slate-500 border-l border-slate-100')}`}>
                          {idx + 1}
                        </td>
                        <td className={`py-1.5 px-2 font-bold ${isBw ? (isEn ? 'text-black border-r border-slate-400' : 'text-black border-l border-slate-400') : (isEn ? 'text-slate-900 border-r border-slate-100' : 'text-slate-900 border-l border-slate-100')}`}>
                          {item.description}
                        </td>
                        <td className={`py-1.5 px-2 text-center font-mono font-bold ${isBw ? (isEn ? 'text-black border-r border-slate-400' : 'text-black border-l border-slate-400') : (isEn ? 'text-slate-800 border-r border-slate-100' : 'text-slate-800 border-l border-slate-100')}`}>
                          {item.quantity || 1} {item.unit || ''}
                        </td>
                        <td className={`py-1.5 px-2 ${isEn ? 'text-right' : 'text-left'} font-mono font-bold ${isBw ? (isEn ? 'text-black border-r border-slate-400' : 'text-black border-l border-slate-400') : (isEn ? 'text-slate-800 border-r border-slate-100' : 'text-slate-800 border-l border-slate-100')}`}>
                          {(item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        {data.classification === 'TAX' && (
                          <td className={`py-1.5 px-2 text-center font-mono font-bold ${isBw ? (isEn ? 'text-black border-r border-slate-400' : 'text-black border-l border-slate-400') : (isEn ? 'text-slate-700 border-r border-slate-100' : 'text-slate-700 border-l border-slate-100')}`}>
                            {item.taxRate ?? 15}%
                          </td>
                        )}
                        <td className={`py-1.5 px-2 ${isEn ? 'text-right' : 'text-left'} font-mono font-black ${isBw ? 'text-black' : 'text-indigo-900'}`}>
                          {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Statement of Account Transactions Table (if present) */}
        {data.transactions && data.transactions.length > 0 && (
          <div className={`mb-2.5 overflow-hidden rounded-lg ${isBw ? 'border-2 border-black' : 'border border-slate-200 shadow-2xs'}`}>
            <table className={`w-full ${isEn ? 'text-left' : 'text-right'} border-collapse text-[11px]`}>
              <thead>
                <tr className={`${isBw ? 'bg-slate-200 text-black border-b-2 border-black' : 'bg-slate-800 text-slate-100'} font-bold`}>
                  <th className={`py-1.5 px-2 w-7 text-center ${isBw ? (isEn ? 'border-r-2 border-black' : 'border-l-2 border-black') : (isEn ? 'border-r border-slate-700' : 'border-l border-slate-700')}`}>#</th>
                  <th className={`py-1.5 px-2 w-20 ${isBw ? (isEn ? 'border-r-2 border-black' : 'border-l-2 border-black') : (isEn ? 'border-r border-slate-700' : 'border-l border-slate-700')} font-mono`}>
                    {isEn ? 'Date' : 'التاريخ'}
                  </th>
                  <th className={`py-1.5 px-2 ${isBw ? (isEn ? 'border-r-2 border-black' : 'border-l-2 border-black') : (isEn ? 'border-r border-slate-700' : 'border-l border-slate-700')}`}>
                    {isEn ? 'Description' : 'البيان والتفاصيل'}
                  </th>
                  <th className={`py-1.5 px-2 ${isEn ? 'text-right' : 'text-left'} w-20 ${isBw ? (isEn ? 'border-r-2 border-black' : 'border-l-2 border-black') : (isEn ? 'border-r border-slate-700' : 'border-l border-slate-700')}`}>
                    {isEn ? 'Debit' : 'مدين (له)'}
                  </th>
                  <th className={`py-1.5 px-2 ${isEn ? 'text-right' : 'text-left'} w-20 ${isBw ? (isEn ? 'border-r-2 border-black' : 'border-l-2 border-black') : (isEn ? 'border-r border-slate-700' : 'border-l border-slate-700')}`}>
                    {isEn ? 'Credit' : 'دائن (عليه)'}
                  </th>
                  <th className={`py-1.5 px-2 ${isEn ? 'text-right' : 'text-left'} w-24`}>
                    {isEn ? 'Balance' : 'الرصيد التراكمي'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {data.transactions.map((tx, idx) => (
                  <tr key={tx.id || idx} className={`${isBw ? 'even:bg-slate-50/60' : 'even:bg-slate-50/50'}`}>
                    <td className={`py-1.5 px-2 text-center font-bold ${isBw ? (isEn ? 'text-black border-r border-slate-400' : 'text-black border-l border-slate-400') : (isEn ? 'text-slate-500 border-r border-slate-100' : 'text-slate-500 border-l border-slate-100')}`}>
                      {idx + 1}
                    </td>
                    <td className={`py-1.5 px-2 font-bold ${isBw ? (isEn ? 'text-black border-r border-slate-400' : 'text-black border-l border-slate-400') : (isEn ? 'text-slate-800 border-r border-slate-100' : 'text-slate-800 border-l border-slate-100')}`}>
                      {tx.date}
                    </td>
                    <td className={`py-1.5 px-2 font-sans font-bold ${isBw ? (isEn ? 'text-black border-r border-slate-400' : 'text-black border-l border-slate-400') : (isEn ? 'text-slate-800 border-r border-slate-100' : 'text-slate-800 border-l border-slate-100')}`}>
                      {tx.description}
                    </td>
                    <td className={`py-1.5 px-2 ${isEn ? 'text-right' : 'text-left'} font-bold ${isBw ? (isEn ? 'text-black border-r border-slate-400' : 'text-black border-l border-slate-400') : (isEn ? 'text-emerald-700 border-r border-slate-100' : 'text-emerald-700 border-l border-slate-100')}`}>
                      {tx.debit > 0 ? tx.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className={`py-1.5 px-2 ${isEn ? 'text-right' : 'text-left'} font-bold ${isBw ? (isEn ? 'text-black border-r border-slate-400' : 'text-black border-l border-slate-400') : (isEn ? 'text-rose-700 border-r border-slate-100' : 'text-rose-700 border-l border-slate-100')}`}>
                      {tx.credit > 0 ? tx.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className={`py-1.5 px-2 ${isEn ? 'text-right' : 'text-left'} font-black ${isBw ? 'text-black' : 'text-indigo-900'}`}>
                      {(tx.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary & Totals Calculation Block */}
        <div className="grid grid-cols-2 gap-2.5 items-start mb-3">
          {/* Column 1: Notes & Instructions */}
          <div className={`space-y-2 p-2.5 rounded-lg ${isBw ? 'bg-slate-50 border-2 border-black' : 'bg-slate-50/70 border border-slate-200'}`}>
            <div>
              <span className={`text-[11px] font-bold block mb-0.5 ${isBw ? 'text-black' : 'text-slate-700'}`}>
                {isEn ? 'Notes / Remarks & Terms:' : 'ملاحظات وشروط الفاتورة:'}
              </span>
              <p className={`font-medium text-[11px] leading-relaxed p-2 rounded min-h-[48px] ${isBw ? 'bg-white border-2 border-black text-black' : 'bg-white border border-slate-200 text-slate-700 shadow-2xs'}`}>
                {data.notes || (isEn ? 'Thank you for your business. Goods received in good condition.' : 'شكراً لتعاملكم معنا. البضاعة المسلمة بحالة جيدة وخاضعة للشروط المعتمدة.')}
              </p>
            </div>

            {data.terms && (
              <div>
                <span className={`text-[10px] font-bold block mb-0.5 ${isBw ? 'text-black' : 'text-slate-700'}`}>
                  {isEn ? 'Terms of Sale:' : 'الشروط والأحكام:'}
                </span>
                <p className={`text-[10px] ${isBw ? 'font-bold text-black' : 'font-medium text-slate-600'}`}>{data.terms}</p>
              </div>
            )}
          </div>

          {/* Column 2: Financial Breakdown Box */}
          <div className={`p-2.5 rounded-lg space-y-1.5 text-[11px] ${isBw ? 'bg-slate-50 border-2 border-black' : 'bg-slate-50/70 border border-slate-200'}`}>
            {data.subtotal !== undefined && (
              <div className="flex justify-between items-center text-slate-700 font-medium">
                <span>{isEn ? 'Subtotal (Excl. VAT):' : 'المجموع الفرعي (غير شامل الضريبة):'}</span>
                <span className="font-mono font-bold text-slate-900">
                  {data.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currSymbol}
                </span>
              </div>
            )}

            {data.taxTotal !== undefined && data.taxTotal > 0 && (
              <div className="flex justify-between items-center text-slate-700 font-medium">
                <span>{isEn ? 'Value Added Tax (15%):' : 'ضريبة القيمة المضافة (15%):'}</span>
                <span className="font-mono font-bold text-indigo-700">
                  {data.taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currSymbol}
                </span>
              </div>
            )}

            {data.discountTotal !== undefined && data.discountTotal > 0 && (
              <div className="flex justify-between items-center text-rose-700 font-medium">
                <span>{isEn ? 'Discount Applied:' : 'إجمالي الخصم الممنوح:'}</span>
                <span className="font-mono font-bold">
                  -{data.discountTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currSymbol}
                </span>
              </div>
            )}

            <div className={`p-2 rounded-lg flex justify-between items-baseline mt-1.5 ${docTheme.totalBg}`}>
              <span className="font-black text-xs">
                {isEn ? 'GRAND TOTAL (NET):' : 'صافي المبلغ الإجمالي:'}
              </span>
              <div className={isEn ? 'text-right' : 'text-left'}>
                <span className={`text-base font-mono font-black block ${docTheme.totalText}`}>
                  {grandAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className={`text-[9px] font-bold ${isBw ? 'text-slate-800' : 'text-slate-200'}`}>
                  {currFullName}
                </span>
              </div>
            </div>

            {/* المبلغ كتابة بالحروف وفقط - أسفل خانة صافي المبلغ الإجمالي */}
            <div className={`p-2 rounded-lg text-[11px] font-sans ${
              isBw ? 'border-2 border-black bg-white text-black' : 'border border-slate-200 bg-amber-50/70 text-slate-900'
            }`}>
              <span className={`text-[10px] font-bold block mb-0.5 ${isBw ? 'text-black' : 'text-amber-900'}`}>
                {isEn ? 'Amount in Words:' : 'المبلغ كتابة بالحروف:'}
              </span>
              <p className={`font-bold text-[11px] leading-relaxed ${isBw ? 'text-black' : 'text-slate-900'}`}>
                {tafqeetText}
              </p>
            </div>

            {/* Payment Breakdown Box */}
            {data.paidAmount !== undefined && (
              <div className={`p-2 rounded-lg text-[11px] font-sans border ${
                isBw ? 'border-black bg-slate-100 text-black' : 'border-slate-200 bg-slate-50 text-slate-800'
              }`}>
                <div className="flex justify-between items-center mb-1 pb-1 border-b border-slate-300/80 font-bold">
                  <span className="text-slate-900 font-black">
                    {isEn ? 'Payment Status & Terms:' : 'تفاصيل السداد وطريقة الدفع:'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                    data.paidAmount >= grandAmount - 0.001 && grandAmount > 0
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : data.paidAmount > 0.001
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-blue-100 text-blue-900 border border-blue-300'
                  }`}>
                    {data.paidAmount >= grandAmount - 0.001 && grandAmount > 0
                      ? (isEn ? 'Cash (Fully Paid)' : 'فاتورة نقدية (مسددة بالكامل)')
                      : data.paidAmount > 0.001
                      ? (isEn ? 'Partial Payment' : 'فاتورة جزئية (سداد جزء)')
                      : (isEn ? 'On Account (Credit)' : 'فاتورة آجلة (غير مسددة)')}
                  </span>
                </div>
                <div className="space-y-1 font-mono text-[10px]">
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="font-sans">{isEn ? 'Paid Amount:' : 'المبلغ المسدد:'}</span>
                    <span className="font-bold text-emerald-700">
                      {Number(data.paidAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currSymbol}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="font-sans">{isEn ? 'Remaining Due:' : 'المبلغ المتبقي:'}</span>
                    <span className="font-bold text-rose-700">
                      {(data.remainingBalance ?? Math.max(0, grandAmount - (data.paidAmount || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currSymbol}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {data.partnerBalanceImpact && (
              <div className={`mt-2 p-2 rounded-lg text-[11px] font-sans ${
                isBw 
                  ? 'border-2 border-black bg-slate-100 text-black' 
                  : 'border border-indigo-200 bg-indigo-50/80 text-slate-800 shadow-2xs'
              }`}>
                <div className="flex justify-between items-center font-bold mb-1 pb-1 border-b border-slate-300/80">
                  <span className="text-slate-900 font-black">
                    {isEn ? 'Account Balance Summary:' : `موقف حساب ${data.partnerType === 'VENDOR' ? 'المورد' : 'العميل'}:`}
                  </span>
                  <span className="text-[9px] font-bold text-slate-600">
                    {data.partnerName || ''}
                  </span>
                </div>
                
                <div className="space-y-1 font-mono text-[10px]">
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="font-sans">{isEn ? 'Previous Balance:' : 'الرصيد السابق قبل الفاتورة:'}</span>
                    <span className="font-bold text-slate-900">
                      {data.partnerBalanceImpact.previousBalanceFormatted} {currSymbol} ({data.partnerBalanceImpact.previousBalanceLabel})
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="font-sans">{isEn ? 'Current Invoice:' : 'قيمة الفاتورة الحالية (+):'}</span>
                    <span className="font-bold text-slate-900">
                      +{data.partnerBalanceImpact.invoiceAmountFormatted} {currSymbol}
                    </span>
                  </div>
                  {data.partnerBalanceImpact.paidAmount > 0 && (
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="font-sans">{isEn ? 'Immediate Payment:' : 'المسدد نقداً بالفاتورة (-):'}</span>
                      <span className="font-bold text-emerald-700">
                        -{data.partnerBalanceImpact.paidAmountFormatted} {currSymbol}
                      </span>
                    </div>
                  )}
                  <div className={`flex justify-between items-center pt-1 border-t ${isBw ? 'border-black' : 'border-indigo-300/80'} font-bold`}>
                    <span className="font-sans font-black text-slate-900">
                      {isEn ? 'Balance After Invoice:' : 'موقف الحساب بعد الفاتورة:'}
                    </span>
                    <span className="text-xs font-black text-slate-950">
                      {data.partnerBalanceImpact.newBalanceFormatted} {currSymbol} ({data.partnerBalanceImpact.newBalanceLabel})
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Official Signatures & Stamp Block */}
        <div className="border-t-2 border-black pt-2.5 mt-3">
          <div className="grid grid-cols-3 gap-4 text-center text-[11px] text-black">
            <div className="space-y-3">
              <p className="font-black">{isEn ? 'Prepared by / Accountant' : 'المحاسب المسؤول'}</p>
              <div className="border-b-2 border-black w-3/4 mx-auto"></div>
            </div>
            <div className="space-y-3">
              <p className="font-black">{isEn ? 'Financial Manager Approval' : 'المدير المالي / الاعتماد'}</p>
              <div className="border-b-2 border-black w-3/4 mx-auto"></div>
            </div>
            <div className="space-y-1">
              <p className="font-black">{isEn ? 'Official Company Stamp' : 'الختم الرسمي للمنشأة'}</p>
              <div className="w-12 h-12 rounded-full border-2 border-dashed border-black mx-auto flex items-center justify-center text-[8px] font-black text-black bg-white">
                {isEn ? 'Official Stamp' : 'الختم المعتمد'}
              </div>
            </div>
          </div>

          {/* System Footer Info */}
          <div className="mt-2.5 pt-1.5 border-t border-slate-400 text-[9px] text-slate-800 font-bold flex justify-between items-center">
            <span>
              {isEn 
                ? 'This official document was electronically generated by Logostria Accounting System' 
                : 'تم استخراج هذا المستند إلكترونياً من نظام لوجوستريا المحاسبي'}
            </span>
            <span>
              {isEn 
                ? `Printed: ${new Date().toLocaleDateString('en-US')} ${new Date().toLocaleTimeString('en-US')}` 
                : `تاريخ وتوقيت الاستخراج: ${new Date().toLocaleString('ar-SA')}`}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

CertifiedInvoiceDocument.displayName = 'CertifiedInvoiceDocument';
