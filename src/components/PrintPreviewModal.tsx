import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Printer, 
  X, 
  Download, 
  Eye, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  Minimize2,
  Loader2,
  FileCheck,
  Pin,
  Sliders,
  Palette,
  CheckCircle2,
  Globe,
  Scan,
  Share2
} from 'lucide-react';
import { CertifiedInvoiceDocument } from './CertifiedInvoiceDocument';
import { exportElementToPdf, printElementDirectly } from '../utils/pdfExport';
import { mobileNavigationController } from '../utils/mobileNavigation';
import { shareBlobDirectly, isMobileDevice } from '../utils/fileSaver';
import {
  PAPER_FORMAT_LIST,
  getSavedPrintPaperFormat,
  savePrintPaperFormat,
  applyPrintPageStyle,
  getPaperFormatDef,
  getSavedPrintColorMode,
  savePrintColorMode,
  type PrintPaperFormat,
  type CustomPaperSize,
  type PrintColorMode
} from '../utils/printPaperFormats';
import type { InvoicePartnerBalanceImpact } from '../utils/partnerLedger';

export type { PrintPaperFormat };

export interface PrintPreviewData {
  title: string;
  subtitle?: string | undefined;
  docNumber: string;
  date: string;
  dueDate?: string | undefined;
  partnerName?: string | undefined;
  partnerTaxNo?: string | undefined;
  partnerPhone?: string | undefined;
  partnerAddress?: string | undefined;
  partnerType?: 'CUSTOMER' | 'VENDOR' | 'EMPLOYEE' | 'OTHER' | undefined;
  
  // Financials & details
  classification?: 'NORMAL' | 'TAX' | undefined;
  taxRate?: number | undefined;
  currency?: string | undefined;
  items?: Array<{
    id?: string | undefined;
    description: string;
    quantity?: number | undefined;
    unitPrice?: number | undefined;
    taxRate?: number | undefined;
    taxAmount?: number | undefined;
    total?: number | undefined;
    unit?: string | undefined;
    notes?: string | undefined;
  }> | undefined;
  
  subtotal?: number | undefined;
  taxTotal?: number | undefined;
  discountTotal?: number | undefined;
  grandTotal?: number | undefined;
  paidAmount?: number | undefined;
  remainingAmount?: number | undefined;
  remainingBalance?: number | undefined;
  paymentStatus?: 'PAID' | 'PARTIAL' | 'UNPAID' | undefined;
  
  // For Vouchers
  voucherType?: 'RECEIPT' | 'PAYMENT' | 'INTERNAL' | undefined;
  fromAccount?: string | undefined;
  toAccount?: string | undefined;
  amount?: number | undefined;
  amountInWords?: string | undefined;
  paymentMethod?: string | undefined;
  serviceType?: string | undefined;
  receivedFromOrPaidTo?: string | undefined;
  allocatedInvoices?: Array<{
    invoiceNumber: string;
    allocatedAmount: number;
    invoiceTotal?: number | undefined;
    remainingBalance?: number | undefined;
    date?: string | undefined;
    dueDate?: string | undefined;
  }> | undefined;
  
  // For Statement of Account
  statementPeriod?: { from?: string | undefined; to?: string | undefined } | undefined;
  openingBalance?: number | undefined;
  closingBalance?: number | undefined;
  totalDebit?: number | undefined;
  totalCredit?: number | undefined;
  transactions?: Array<{
    id: string;
    date: string;
    docNumber?: string | undefined;
    description: string;
    debit: number;
    credit: number;
    balance?: number | undefined;
  }> | undefined;

  // For Payroll
  payrollPeriod?: string | undefined;
  employeesCount?: number | undefined;
  totalBasic?: number | undefined;
  totalAllowances?: number | undefined;
  totalDeductions?: number | undefined;
  netPayroll?: number | undefined;

  // For Manufacturing / Production
  productName?: string | undefined;
  orderNumber?: string | undefined;
  targetQuantity?: number | undefined;
  rawMaterialsCost?: number | undefined;
  laborCost?: number | undefined;
  overheadCost?: number | undefined;

  // Custom metadata / notes / terms
  notes?: string | undefined;
  terms?: string | undefined;
  status?: string | undefined;
  signatures?: Array<{ role: string; name?: string | undefined }> | undefined;
  partnerBalanceImpact?: InvoicePartnerBalanceImpact | null | undefined;
}

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PrintPreviewData;
  initialFormat?: PrintPaperFormat;
  initialLanguage?: 'ar' | 'en';
}

export default function PrintPreviewModal({
  isOpen,
  onClose,
  data,
  initialFormat,
  initialLanguage = 'ar'
}: PrintPreviewModalProps) {
  // Initialize with saved format or passed initial format
  const savedInit = getSavedPrintPaperFormat();
  const [format, setFormat] = useState<PrintPaperFormat>(initialFormat || savedInit.format);
  const [customSize, setCustomSize] = useState<CustomPaperSize>(savedInit.customSize);
  const [colorMode, setColorMode] = useState<PrintColorMode>(getSavedPrintColorMode());
  const [language, setLanguage] = useState<'ar' | 'en'>(initialLanguage);
  const [showCustomDialog, setShowCustomDialog] = useState<boolean>(false);
  const [tempWidthCm, setTempWidthCm] = useState<string>(savedInit.customSize.widthCm.toString());
  const [tempHeightCm, setTempHeightCm] = useState<string>(savedInit.customSize.heightCm.toString());

  const [zoom, setZoom] = useState<number>(100);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportSuccess, setIsExportSuccess] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [mobilePdfReady, setMobilePdfReady] = useState<{ blob: Blob; filename: string } | null>(null);

  const printAreaRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sync when opened
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('print-preview-active');
      const saved = getSavedPrintPaperFormat();
      if (!initialFormat) {
        setFormat(saved.format);
      }
      setCustomSize(saved.customSize);
      setTempWidthCm(saved.customSize.widthCm.toString());
      setTempHeightCm(saved.customSize.heightCm.toString());
      setColorMode(getSavedPrintColorMode());
    } else {
      document.body.classList.remove('print-preview-active');
    }
    return () => {
      document.body.classList.remove('print-preview-active');
    };
  }, [isOpen, initialFormat]);

  // Handle hardware & gesture back button on mobile: closes preview first
  useEffect(() => {
    if (!isOpen) return;
    const modalId = `modal-print-preview-${data.docNumber || 'generic'}`;
    const unregister = mobileNavigationController.registerModal(modalId, () => {
      onClose();
    });
    return () => unregister();
  }, [isOpen, onClose, data.docNumber]);

  const activeDef = getPaperFormatDef(format, customSize);
  const baseWidth = activeDef.baseWidthPx;

  const calculateFitZoom = useCallback((fmt: PrintPaperFormat, cSize?: CustomPaperSize): number => {
    const def = getPaperFormatDef(fmt, cSize);
    const baseW = def.baseWidthPx;

    // Determine available width from container or viewport
    let containerWidth = 0;
    if (scrollContainerRef.current && scrollContainerRef.current.clientWidth > 0) {
      // On mobile screens p-1 or p-2 leaves ~12-16px margin, on larger screens 24-48px
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
      const paddingAllowance = isMobile ? 16 : 36;
      containerWidth = scrollContainerRef.current.clientWidth - paddingAllowance;
    } else if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 640;
      containerWidth = window.innerWidth - (isMobile ? 16 : 40);
    }

    if (containerWidth > 0 && containerWidth < baseW + 10) {
      // Calculate exact fit percentage so document shrinks smoothly to screen width
      const fitPercent = Math.floor((containerWidth / baseW) * 100);
      // Clamp between 15% (for huge poster formats on narrow phones) and 100%
      return Math.min(100, Math.max(15, fitPercent));
    }
    return 100;
  }, []);

  // Set initial zoom based on available screen width
  useEffect(() => {
    if (!isOpen) return;

    const applyOptimalZoom = () => {
      const fit = calculateFitZoom(format, customSize);
      setZoom(fit);
    };

    const timer = setTimeout(applyOptimalZoom, 60);
    window.addEventListener('resize', applyOptimalZoom);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', applyOptimalZoom);
    };
  }, [isOpen, format, customSize, calculateFitZoom]);

  if (!isOpen) return null;

  const handleSelectFormatAndFix = (newFormat: PrintPaperFormat) => {
    if (newFormat === 'CUSTOM') {
      setShowCustomDialog(true);
      return;
    }

    const { def } = savePrintPaperFormat(newFormat, customSize);
    setFormat(newFormat);
    applyPrintPageStyle(newFormat, customSize);

    setFeedbackToast(`تم تثبيت مقاس الطباعة: ${def.shortName}`);
    setTimeout(() => setFeedbackToast(null), 2500);

    // Auto recalculate zoom for the new dimensions
    setTimeout(() => {
      setZoom(calculateFitZoom(newFormat, customSize));
    }, 50);
  };

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(tempWidthCm);
    const h = parseFloat(tempHeightCm);
    if (isNaN(w) || w <= 0 || isNaN(h) || h <= 0) {
      alert('يرجى إدخال أبعاد صحيحة بالسنتيمتر');
      return;
    }
    const newSize = { widthCm: w, heightCm: h };
    setCustomSize(newSize);
    savePrintPaperFormat('CUSTOM', newSize);
    setFormat('CUSTOM');
    setShowCustomDialog(false);
    applyPrintPageStyle('CUSTOM', newSize);

    setFeedbackToast(`تم تثبيت المقاس المخصص: ${w} × ${h} سم`);
    setTimeout(() => setFeedbackToast(null), 2500);

    setTimeout(() => {
      setZoom(calculateFitZoom('CUSTOM', newSize));
    }, 50);
  };

  const handleToggleColorMode = () => {
    const nextMode: PrintColorMode = colorMode === 'bw' ? 'color' : 'bw';
    setColorMode(nextMode);
    savePrintColorMode(nextMode);
    applyPrintPageStyle(format, customSize, nextMode);
    setFeedbackToast(
      nextMode === 'bw' 
        ? 'تم تفعيل نمط أبيض وأسود فائق الوضوح للورق' 
        : 'تم تفعيل نمط الألوان القياسي'
    );
    setTimeout(() => setFeedbackToast(null), 2500);
  };

  const handlePrint = () => {
    applyPrintPageStyle(format, customSize, colorMode);
    printElementDirectly(printAreaRef.current, format, customSize, colorMode);
  };

  const handleFitWidth = () => {
    const fit = calculateFitZoom(format, customSize);
    setZoom(fit);
  };

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      const safeTitle = (data.title || 'document').replace(/\s+/g, '_');
      const safeNumber = data.docNumber ? `_${data.docNumber}` : '';
      const filename = `${safeTitle}${safeNumber}.pdf`;

      setFeedbackToast('جاري تجهيز ملف الـ PDF بالمقاس المعتمد...');

      const result = await exportElementToPdf(printAreaRef.current, {
        filename,
        format,
        customSize,
        colorMode,
      });

      setIsExportSuccess(true);
      
      // If on mobile or APK, also store blob for immediate 1-tap save/share
      if (result?.blob) {
        setMobilePdfReady({ blob: result.blob, filename });
      }

      if (result?.method === 'share') {
        setFeedbackToast(
          result.cancelled
            ? 'تم إغلاق نافذة المشاركة'
            : `تم تجهيز ملف PDF (${filename}) - تم فتح قائمة الحفظ والمشاركة!`
        );
      } else if (result?.method === 'action_sheet') {
        setFeedbackToast('تم تجهيز ملف PDF بنجاح! اختر طريقة الحفظ في هاتفك أدناه.');
      } else if (result?.method === 'open') {
        setFeedbackToast(`تم فتح ملف الـ PDF (${filename}) للمعاينة والحفظ`);
      } else {
        setFeedbackToast(
          isMobileDevice()
            ? `تم تجهيز ملف PDF (${filename}) - يمكنك حفظه ومشاركته الآن!`
            : `تم تنزيل ملف PDF (${filename}) بنجاح!`
        );
      }
      setTimeout(() => {
        setIsExportSuccess(false);
        setFeedbackToast(null);
      }, 4000);
    } catch (err) {
      console.error('PDF Export error:', err);
      setFeedbackToast('حدث تنبيه أثناء التصدير المباشر، جاري فتح نافذة الطباعة...');
      setTimeout(() => setFeedbackToast(null), 3000);
      printElementDirectly(printAreaRef.current, format, customSize, colorMode);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const scaledWidth = Math.round(baseWidth * (zoom / 100));

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/90 backdrop-blur-xs overflow-hidden animate-fadeIn print:static print:inset-auto print:bg-white print:overflow-visible print:p-0 print:m-0 print:z-auto print-preview-modal-root">
      {/* Toast Feedback */}
      {feedbackToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-60 bg-emerald-900/95 text-emerald-100 text-xs px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 border border-emerald-500/40 pointer-events-none animate-fadeIn print:hidden">
          <Pin size={13} className="text-emerald-400" />
          <span className="font-bold">{feedbackToast}</span>
        </div>
      )}

      {/* Top Floating Control Bar */}
      <div className="bg-slate-900 text-white px-3 sm:px-6 py-2.5 sm:py-3 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3 shadow-lg shrink-0 print:hidden print-controls-bar">
        
        {/* Row 1: Document Title & Close Button */}
        <div className="flex items-center justify-between gap-2 w-full lg:w-auto">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Eye size={17} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 className="text-xs sm:text-base font-bold text-white tracking-wide truncate max-w-[150px] sm:max-w-[280px]">
                  {data.title}
                </h2>
                <span className="text-[10px] sm:text-xs bg-blue-500/20 text-blue-300 px-1.5 sm:px-2 py-0.5 rounded font-mono font-bold border border-blue-500/30 shrink-0">
                  #{data.docNumber || '0000'}
                </span>
                <span className="text-[10px] bg-purple-900/60 text-purple-200 px-1.5 py-0.5 rounded font-bold border border-purple-500/40 flex items-center gap-1 shrink-0" title="مزود بباركود ورمز QR ضوئي لمنع التلاعب">
                  <Scan size={11} className="text-purple-300" />
                  <span>باركود & QR</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden xl:block">
                اختر المقاس لتثبيته في النظام تلقائياً ولتطبيق الطباعة والـ PDF.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer lg:hidden shrink-0"
            title="إغلاق المعاينة"
          >
            <X size={20} />
          </button>
        </div>

        {/* Row 2: Comprehensive Paper Formats Selector */}
        <div className="flex flex-wrap items-center justify-between lg:justify-center gap-1.5 sm:gap-2 w-full lg:w-auto">
          {/* Format Select Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 p-1 rounded-xl border border-slate-700 text-xs">
            <span className="text-slate-400 font-bold px-1 text-[11px] flex items-center gap-1 shrink-0">
              <Pin size={11} className="text-emerald-400" />
              <span>المقاس:</span>
            </span>

            <select
              value={format}
              onChange={(e) => handleSelectFormatAndFix(e.target.value as PrintPaperFormat)}
              className="bg-slate-900 text-white font-bold text-xs py-1.5 px-2 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer max-w-[210px] sm:max-w-[260px] truncate"
            >
              {PAPER_FORMAT_LIST.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} {format === p.id ? ' (مثبت حالياً)' : ''}
                </option>
              ))}
            </select>

            {format === 'CUSTOM' && (
              <button
                type="button"
                onClick={() => setShowCustomDialog(true)}
                className="px-2 py-1 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                title="تعديل أبعاد المقاس المخصص"
              >
                <Sliders size={11} />
                <span>تعديل</span>
              </button>
            )}
          </div>

          {/* B&W / Color Clarity Mode Toggle */}
          <button
            type="button"
            onClick={handleToggleColorMode}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              colorMode === 'bw'
                ? 'bg-emerald-950/70 border-emerald-500/80 text-emerald-300 hover:bg-emerald-900/80 shadow-xs'
                : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-700/90'
            }`}
            title={
              colorMode === 'bw'
                ? 'نمط أبيض وأسود فائق الوضوح للطباعة الورقية بدون بهتان (نشط)'
                : 'انقر للتبديل إلى نمط الأبيض والأسود عالي الوضوح'
            }
          >
            {colorMode === 'bw' ? (
              <>
                <CheckCircle2 size={13} className="text-emerald-400" />
                <span>أبيض وأسود فائق الوضوح</span>
              </>
            ) : (
              <>
                <Palette size={13} className="text-blue-400" />
                <span>نمط ألوان عادي</span>
              </>
            )}
          </button>

          {/* Language Toggle: Arabic / English */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => {
                setLanguage('ar');
                setFeedbackToast('تم تفعيل عرض المعاينة باللغة العربية');
                setTimeout(() => setFeedbackToast(null), 2200);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                language === 'ar'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="عرض وطباعة المستند باللغة العربية"
            >
              <Globe size={13} className={language === 'ar' ? 'text-white' : 'text-slate-400'} />
              <span>العربية</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLanguage('en');
                setFeedbackToast('Switched document view & print layout to English');
                setTimeout(() => setFeedbackToast(null), 2200);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                language === 'en'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Switch document layout and labels to English"
            >
              <Globe size={13} className={language === 'en' ? 'text-white' : 'text-slate-400'} />
              <span>English</span>
            </button>
          </div>

          {/* Zoom Buttons & Fit to Screen */}
          <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700/60 text-xs">
            <button
              type="button"
              onClick={() => setZoom(prev => Math.max(prev - 10, 25))}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors cursor-pointer"
              title="تصغير"
            >
              <ZoomOut size={14} />
            </button>
            <span className="font-mono text-[10px] sm:text-[11px] text-slate-300 w-8 sm:w-9 text-center font-bold">
              {zoom}%
            </span>
            <button
              type="button"
              onClick={() => setZoom(prev => Math.min(prev + 10, 160))}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors cursor-pointer"
              title="تكبير"
            >
              <ZoomIn size={14} />
            </button>
            <button
              type="button"
              onClick={handleFitWidth}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-blue-400 hover:text-blue-300 hover:bg-slate-700/80 rounded transition-colors cursor-pointer"
              title="احتواء في عرض الشاشة"
            >
              <Minimize2 size={12} />
              <span>احتواء</span>
            </button>
            <button
              type="button"
              onClick={() => setZoom(100)}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors cursor-pointer hidden md:block"
              title="إعادة ضبط 100%"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>

        {/* Row 3: Action Buttons: Print / PDF / Close */}
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 lg:flex-none btn-3d btn-3d-emerald px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-black"
          >
            <Printer size={15} />
            <span>طباعة الآن ({activeDef.shortName})</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className={`flex-1 lg:flex-none btn-3d ${
              isExportSuccess 
                ? 'btn-3d-emerald' 
                : 'btn-3d-rose'
            } px-3 sm:px-3.5 py-2 text-xs font-black disabled:opacity-75 disabled:cursor-wait`}
            title="تصدير المستند كملف PDF معتمد بالمقاس المختار"
          >
            {isExportingPdf ? (
              <>
                <Loader2 size={14} className="animate-spin shrink-0" />
                <span>جاري الـ PDF...</span>
              </>
            ) : isExportSuccess ? (
              <>
                <FileCheck size={14} className="shrink-0" />
                <span>تم التحميل!</span>
              </>
            ) : (
              <>
                <Download size={14} className="shrink-0" />
                <span>تصدير PDF</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="hidden lg:flex btn-3d btn-3d-slate p-2 text-slate-200 hover:text-white shrink-0"
            title="إغلاق المعاينة"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Preview Viewing Canvas Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto p-1.5 sm:p-6 md:p-8 flex justify-center items-start bg-slate-950/70 custom-scrollbar w-full max-w-full -webkit-overflow-scrolling-touch print:overflow-visible print:bg-white print:p-0 print:m-0 print:static print:block"
      >
        <div 
          className="relative transition-all duration-150 flex justify-center shrink-0 my-auto print:static print:m-0 print:w-full print:block max-w-full"
          style={{ 
            width: isExportingPdf ? `${baseWidth}px` : `${scaledWidth}px`,
          }}
        >
          <div 
            style={{ 
              width: `${baseWidth}px`,
              transform: isExportingPdf ? 'none' : `scale(${zoom / 100})`, 
              transformOrigin: 'top center' 
            }}
            className="transition-transform duration-150 shrink-0 shadow-2xl print:shadow-none print:transform-none print:w-full print:m-0 print-document-scaler"
          >
            <CertifiedInvoiceDocument
              ref={printAreaRef}
              data={data}
              format={format}
              customSize={customSize}
              colorMode={colorMode}
              language={language}
            />
          </div>
        </div>
      </div>

      {/* Custom Size Configuration Dialog */}

      {showCustomDialog && (
        <div 
          className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCustomDialog(false);
          }}
        >
          <div 
            dir="rtl"
            className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden text-slate-800 animate-modalIn max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Mobile Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

            <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/30 flex items-center justify-center text-purple-300">
                  <Sliders size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">مقاس مخصص: حسب الحاجة</h3>
                  <p className="text-[11px] text-slate-400">حدد أبعاد الورق بالسنتيمتر وثبّت المقاس</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomDialog(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCustom} className="p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    عرض الورقة (سم):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="2"
                      max="100"
                      value={tempWidthCm}
                      onChange={e => setTempWidthCm(e.target.value)}
                      required
                      className="w-full pl-8 pr-3 py-2.5 sm:py-2 border-2 border-slate-300 rounded-xl text-sm font-bold font-mono focus:outline-none focus:border-purple-600 bg-white"
                      placeholder="مثال: 15"
                    />
                    <span className="absolute left-3 top-3 sm:top-2.5 text-xs text-slate-400 font-bold">سم</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    طول الورقة (سم):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="2"
                      max="200"
                      value={tempHeightCm}
                      onChange={e => setTempHeightCm(e.target.value)}
                      required
                      className="w-full pl-8 pr-3 py-2.5 sm:py-2 border-2 border-slate-300 rounded-xl text-sm font-bold font-mono focus:outline-none focus:border-purple-600 bg-white"
                      placeholder="مثال: 20"
                    />
                    <span className="absolute left-3 top-3 sm:top-2.5 text-xs text-slate-400 font-bold">سم</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-900 leading-relaxed">
                💡 سيتم تثبيت هذا المقاس المخصص تلقائياً في النظام وسيكون هو المعتمد في المعاينة والطباعة وتصدير PDF.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCustomDialog(false)}
                  className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
                >
                  <Pin size={14} />
                  <span>تثبيت وحفظ المقاس</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Mobile / Android APK PDF Save & Share Action Sheet Modal */}
      {mobilePdfReady && (
        <div 
          className="fixed inset-0 z-70 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setMobilePdfReady(null)}
        >
          <div 
            className="w-full max-w-lg bg-slate-900 border-t-4 sm:border-2 border-emerald-500 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom-6 duration-200 text-white flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-inner shrink-0">
                  <FileCheck size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-1.5">
                    <span>خيارات حفظ المستند في الموبايل</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono">PDF</span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-[240px] sm:max-w-[320px]">
                    {mobilePdfReady.filename}
                  </p>
                </div>
              </div>

              <button 
                type="button"
                onClick={() => setMobilePdfReady(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X size={20} />
              </button>
            </div>

            {/* Android Guidance Note */}
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-200 leading-relaxed flex items-start gap-2.5">
              <span className="text-base leading-none shrink-0">📱</span>
              <p>
                اختر <strong>«حفظ ومشاركة في الهاتف»</strong> لإرسال المستند فوراً عبر الواتساب أو حفظه في جوجل درايف والملفات، أو اختر <strong>«حفظ كـ PDF عبر الطباعة»</strong> لحفظه مباشرة في ذاكرة التنزيلات.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5 pt-1">
              {/* Option 1: Native Share Sheet */}
              <button
                type="button"
                onClick={async () => {
                  const shared = await shareBlobDirectly(mobilePdfReady.blob, mobilePdfReady.filename);
                  if (shared) {
                    setFeedbackToast('تم فتح قائمة المشاركة والحفظ بنجاح!');
                    setTimeout(() => setFeedbackToast(null), 3000);
                  }
                }}
                className="w-full btn-3d btn-3d-emerald py-3 px-4 text-sm font-black flex items-center justify-center gap-2.5 shadow-lg"
              >
                <Share2 size={18} />
                <span>حفظ ومشاركة في الهاتف (واتساب / درايف / ملفات)</span>
              </button>

              {/* Option 2: Android Print Spooler Save as PDF */}
              <button
                type="button"
                onClick={() => {
                  setMobilePdfReady(null);
                  handlePrint();
                }}
                className="w-full btn-3d btn-3d-indigo py-3 px-4 text-sm font-black flex items-center justify-center gap-2.5 shadow-md"
              >
                <Printer size={18} />
                <span>حفظ كـ PDF عبر مدير طباعة أندرويد (تنزيلات)</span>
              </button>

              {/* Option 3: Direct Download Anchor Retry */}
              <button
                type="button"
                onClick={() => {
                  try {
                    const blobUrl = URL.createObjectURL(mobilePdfReady.blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = mobilePdfReady.filename;
                    a.target = '_blank';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
                    setFeedbackToast('تم إرسال أمر التنزيل المباشر');
                    setTimeout(() => setFeedbackToast(null), 2500);
                  } catch (e) {
                    console.error('Download click error:', e);
                  }
                }}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download size={15} />
                <span>محاولة تنزيل مباشر كملف عادي</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
