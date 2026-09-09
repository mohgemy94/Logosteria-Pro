import { useState, useRef, useEffect, useCallback } from 'react';
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
  Globe
} from 'lucide-react';
import { CertifiedInvoiceDocument } from './CertifiedInvoiceDocument';
import { exportElementToPdf } from '../utils/pdfExport';
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

  const printAreaRef = useRef<HTMLDivElement>(null);
  const pdfExportRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sync when opened
  useEffect(() => {
    if (isOpen) {
      const saved = getSavedPrintPaperFormat();
      if (!initialFormat) {
        setFormat(saved.format);
      }
      setCustomSize(saved.customSize);
      setTempWidthCm(saved.customSize.widthCm.toString());
      setTempHeightCm(saved.customSize.heightCm.toString());
      setColorMode(getSavedPrintColorMode());
    }
  }, [isOpen, initialFormat]);

  const activeDef = getPaperFormatDef(format, customSize);
  const baseWidth = activeDef.baseWidthPx;

  const calculateFitZoom = useCallback((fmt: PrintPaperFormat, cSize?: CustomPaperSize): number => {
    const def = getPaperFormatDef(fmt, cSize);
    const baseW = def.baseWidthPx;

    if (!scrollContainerRef.current) {
      if (typeof window !== 'undefined') {
        const availableWidth = window.innerWidth - 32;
        if (availableWidth < baseW) {
          return Math.min(100, Math.max(30, Math.floor((availableWidth / baseW) * 100)));
        }
      }
      return 100;
    }
    const containerWidth = scrollContainerRef.current.clientWidth - 32;
    if (containerWidth < baseW + 20) {
      return Math.min(100, Math.max(25, Math.floor((containerWidth / baseW) * 100)));
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
    window.print();
  };

  const handleFitWidth = () => {
    const fit = calculateFitZoom(format, customSize);
    setZoom(fit);
  };

  const handleExportPdf = async () => {
    if (!pdfExportRef.current || isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      const safeTitle = (data.title || 'document').replace(/\s+/g, '_');
      const safeNumber = data.docNumber ? `_${data.docNumber}` : '';
      const filename = `${safeTitle}${safeNumber}.pdf`;

      await exportElementToPdf(pdfExportRef.current, {
        filename,
        format,
        customSize,
        scale: 2,
      });

      setIsExportSuccess(true);
      setTimeout(() => setIsExportSuccess(false), 3000);
    } catch (err) {
      console.error('PDF Export error:', err);
      alert('⚠️ حدث خطأ غير متوقع أثناء إنشاء ملف الـ PDF. يمكنك استخدام زر [طباعة الآن] واختيار "حفظ بتنسيق PDF" كبديل مباشر.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const scaledWidth = Math.round(baseWidth * (zoom / 100));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/90 backdrop-blur-xs overflow-hidden animate-fadeIn">
      {/* Toast Feedback */}
      {feedbackToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-60 bg-emerald-900/95 text-emerald-100 text-xs px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 border border-emerald-500/40 pointer-events-none animate-fadeIn">
          <Pin size={13} className="text-emerald-400" />
          <span className="font-bold">{feedbackToast}</span>
        </div>
      )}

      {/* Top Floating Control Bar */}
      <div className="bg-slate-900 text-white px-3 sm:px-6 py-2.5 sm:py-3 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3 shadow-lg shrink-0 print:hidden">
        
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
            className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-colors cursor-pointer"
          >
            <Printer size={15} />
            <span>طباعة الآن ({activeDef.shortName})</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
              isExportSuccess 
                ? 'bg-emerald-700 border-emerald-600 text-white' 
                : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 border-rose-500 text-white'
            } disabled:opacity-75 disabled:cursor-wait`}
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
            className="hidden lg:block p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0"
            title="إغلاق المعاينة"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Preview Viewing Canvas Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto p-2 sm:p-6 md:p-8 flex justify-center items-start bg-slate-950/70 custom-scrollbar w-full"
      >
        <div 
          className="relative transition-all duration-150 flex justify-center shrink-0 my-auto"
          style={{ 
            width: `${scaledWidth}px`,
          }}
        >
          <div 
            style={{ 
              width: `${baseWidth}px`,
              transform: `scale(${zoom / 100})`, 
              transformOrigin: 'top center' 
            }}
            className="transition-transform duration-150 shrink-0 shadow-2xl"
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

      
      {/* Hidden Unscaled Copy for PDF Export */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
        <CertifiedInvoiceDocument
          ref={pdfExportRef}
          data={data}
          format={format}
          customSize={customSize}
          colorMode={colorMode}
          language={language}
        />
      </div>

      {/* Custom Size Configuration Dialog */}

      {showCustomDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-fadeIn">
          <div 
            dir="rtl"
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden text-slate-800"
          >
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

            <form onSubmit={handleSaveCustom} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                      className="w-full pl-8 pr-3 py-2 border-2 border-slate-300 rounded-xl text-sm font-bold font-mono focus:outline-none focus:border-purple-600 bg-white"
                      placeholder="مثال: 15"
                    />
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">سم</span>
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
                      className="w-full pl-8 pr-3 py-2 border-2 border-slate-300 rounded-xl text-sm font-bold font-mono focus:outline-none focus:border-purple-600 bg-white"
                      placeholder="مثال: 20"
                    />
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">سم</span>
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
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
                >
                  <Pin size={14} />
                  <span>تثبيت وحفظ المقاس</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
