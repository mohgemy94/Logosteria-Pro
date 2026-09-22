import { useState, useRef, useEffect, type FormEvent } from 'react';
import { 
  Scan, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  ShieldCheck, 
  Barcode,
  Camera,
  CameraOff
} from 'lucide-react';
import { 
  verifyScannedVoucher, 
  type ScannedVerificationResult 
} from '../utils/voucherBarcode';
import { BarcodeImage } from './VoucherBarcodeView';
import type { PrintPreviewData } from './PrintPreviewModal';
import { useSystemCurrency } from '../utils/currency';

interface VoucherScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVoucherForPrint?: (previewData: PrintPreviewData) => void;
}

export default function VoucherScannerModal({
  isOpen,
  onClose,
  onSelectVoucherForPrint
}: VoucherScannerModalProps) {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [inputValue, setInputValue] = useState<string>('');
  const [result, setResult] = useState<ScannedVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop camera helper
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Start phone camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'تم رفض إذن الكاميرا. يرجى السماح بالوصول للكاميرا من إعدادات المتصفح/الهاتف.'
          : 'تعذر تشغيل الكاميرا على هذا الجهاز.'
      );
    }
  };

  // Auto-focus the input field when opened so physical barcode guns can immediately write to it
  useEffect(() => {
    if (isOpen) {
      setResult(null);
      setInputValue('');
      setCameraError(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSearch = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;

    setIsVerifying(true);
    setTimeout(() => {
      const res = verifyScannedVoucher(inputValue);
      setResult(res);
      setIsVerifying(false);
    }, 150);
  };

  const handleQuickTest = (code: string) => {
    setInputValue(code);
    setIsVerifying(true);
    setTimeout(() => {
      const res = verifyScannedVoucher(code);
      setResult(res);
      setIsVerifying(false);
    }, 150);
  };

  const handlePrintMatchedVoucher = () => {
    if (!result?.voucher || !onSelectVoucherForPrint) return;
    const v = result.voucher;

    const previewData: PrintPreviewData = {
      title: v.typeLabel,
      docNumber: v.voucherNumber,
      date: v.date,
      partnerName: v.partnerOrBeneficiary,
      notes: v.description,
      grandTotal: v.amount,
      subtotal: v.amount,
      amount: v.amount,
      paidAmount: v.amount,
      voucherType: v.type.includes('RECEIPT') ? 'RECEIPT' : 'PAYMENT',
      status: v.status,
      items: [{
        description: `${v.typeLabel} #${v.voucherNumber} - ${v.partnerOrBeneficiary}`,
        quantity: 1,
        unitPrice: v.amount,
        total: v.amount
      }]
    };

    onSelectVoucherForPrint(previewData);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-xs p-0 sm:p-4 md:p-6 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] md:max-h-[90vh] animate-modalIn text-right"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Mobile handle */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Modal Header (Fixed) */}
        <div className="bg-slate-900 text-white p-3.5 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0">
              <Scan size={22} className="animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base md:text-lg font-black text-white truncate">
                  التحقق الضوئي والمطابقة لمنع التلاعب
                </h3>
                <span className="text-[10px] bg-purple-900/80 text-purple-300 px-2 py-0.5 rounded font-bold border border-purple-700/50 shrink-0">
                  Barcode & QR Scanner
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate sm:overflow-visible sm:whitespace-normal">
                قراءة الباركود أو كود الـ QR للتحقق الفوري من أصالة ومطابقة السند المحاسبي
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center hover:bg-slate-700 transition-colors cursor-pointer shrink-0 hover:scale-105 active:scale-95"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar">
          {/* Scanner Input Box */}
          <form onSubmit={handleSearch} className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Barcode size={15} className="text-indigo-600" />
                امسح بالماسح الضوئي (Barcode Reader) أو الصق كود الـ QR:
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                يدعم قارئات الليزر وكاميرات الهواتف
              </span>
            </label>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="مثال: PV-2026-0001 أو امسح الباركود مباشرة بالماسح..."
                  className="w-full pr-10 pl-3 py-3 border-2 border-slate-300 rounded-xl text-sm font-bold font-mono focus:outline-none focus:border-purple-600 bg-white text-slate-800 shadow-inner"
                />
                <Scan size={18} className="absolute right-3 top-3.5 text-slate-400" />
              </div>
              <button
                type="button"
                onClick={isCameraActive ? stopCamera : startCamera}
                className={`px-4 py-3 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                  isCameraActive 
                    ? 'bg-rose-50 text-rose-700 border-2 border-rose-300 hover:bg-rose-100' 
                    : 'bg-indigo-50 text-indigo-700 border-2 border-indigo-200 hover:bg-indigo-100'
                }`}
                title={isCameraActive ? 'إيقاف الكاميرا' : 'تشغيل كاميرا الهاتف'}
              >
                {isCameraActive ? (
                  <>
                    <CameraOff size={16} />
                    <span>إيقاف</span>
                  </>
                ) : (
                  <>
                    <Camera size={16} />
                    <span>الكاميرا</span>
                  </>
                )}
              </button>
              <button
                type="submit"
                disabled={isVerifying || !inputValue.trim()}
                className="btn-3d btn-3d-purple px-5 py-3 text-xs sm:text-sm font-black disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {isVerifying ? 'جاري الفحص...' : 'فحص ومطابقة'}
              </button>
            </div>
          </form>

          {/* Camera Viewport (When Active) */}
          {isCameraActive && (
            <div className="bg-slate-950 rounded-2xl overflow-hidden border-2 border-indigo-500 relative flex flex-col items-center justify-center p-3 animate-in zoom-in-95">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full max-h-56 object-cover rounded-xl shadow-lg"
              />
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-1 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse pointer-events-none" />
              <div className="mt-2 text-center">
                <span className="text-[11px] text-indigo-200 font-semibold bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-700/50">
                  وجه الكاميرا نحو باركود أو QR السند لقراءته فورياً
                </span>
              </div>
            </div>
          )}

          {cameraError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {cameraError}
            </div>
          )}

          {/* Quick Examples */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
              نماذج سريعة للتجربة والمطابقة:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {['PV-2026-0001', 'RV-2026-0001', 'IP-0001', 'IR-0001', '0001'].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => handleQuickTest(sample)}
                  className="text-xs font-mono bg-white hover:bg-purple-50 text-purple-900 px-2.5 py-1 rounded-lg border border-purple-200 transition-colors font-bold cursor-pointer"
                >
                  #{sample}
                </button>
              ))}
            </div>
          </div>

          {/* Result Presentation */}
          {result && (
            <div className="animate-fadeIn">
              {result.status === 'FOUND_MATCH' && result.voucher ? (
                <div className="bg-emerald-50/90 border-2 border-emerald-500 rounded-2xl p-4 sm:p-5 text-slate-800 shadow-sm space-y-4">
                  {/* Status Banner */}
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-emerald-950">
                          مستند أصلي معتمد ومطابق بنسبة 100%
                        </h4>
                        <p className="text-[11px] text-emerald-800">
                          تم التحقق من بصمة السند ورقم القيد في السجلات الرسمية
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black font-mono bg-emerald-700 text-white px-3 py-1 rounded-lg">
                      معتمد ومسجل
                    </span>
                  </div>

                  {/* Voucher Key Specs Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-slate-500 block text-[10px]">نوع ورقم السند:</span>
                      <span className="font-bold text-slate-900 block mt-0.5">
                        {result.voucher.typeLabel}
                      </span>
                      <span className="font-mono font-black text-emerald-800 text-xs">
                        #{result.voucher.voucherNumber}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-slate-500 block text-[10px]">المبلغ المعتمد:</span>
                      <span className="font-mono font-black text-emerald-700 text-base block mt-0.5">
                        {result.voucher.amount.toLocaleString()} {currencySymbol}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {result.voucher.status === 'POSTED' ? 'مرحل بالحسابات' : 'مسودة غير مرحلة'}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-slate-500 block text-[10px]">تاريخ السند:</span>
                      <span className="font-bold text-slate-900 font-mono block mt-0.5">
                        {result.voucher.date}
                      </span>
                      <span className="text-[10px] text-slate-500">تاريخ الإصدار المسجل</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-emerald-200 col-span-2">
                      <span className="text-slate-500 block text-[10px]">الطرف المعني / المستفيد:</span>
                      <span className="font-bold text-slate-900 block mt-0.5">
                        {result.voucher.partnerOrBeneficiary}
                      </span>
                      <span className="text-[10px] text-slate-600 block truncate">
                        البيان: {result.voucher.description}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-slate-500 block text-[10px]">رمز التحقق والأمان:</span>
                      <span className="font-mono font-black text-purple-900 text-[11px] block mt-0.5">
                        {result.voucher.verificationHash}
                      </span>
                      {result.voucher.costCenterName && (
                        <span className="text-[10px] text-indigo-700 font-bold block truncate">
                          مركز: {result.voucher.costCenterName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Visual Barcode & QR Stamp */}
                  <div className="bg-white p-3 rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-1 border border-slate-200 rounded bg-white">
                        <BarcodeImage 
                          value={result.voucher.voucherNumber} 
                          height={36} 
                          barWidth={1.3} 
                          fontSize={9} 
                        />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          باركود المطابقة الضوئية
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          Code 128 - قراءة فورية بالماسحات الضوئية
                        </span>
                      </div>
                    </div>

                    {onSelectVoucherForPrint && (
                      <button
                        type="button"
                        onClick={handlePrintMatchedVoucher}
                        className="btn-3d btn-3d-emerald px-4 py-2 text-xs font-black flex items-center gap-1.5 w-full sm:w-auto justify-center"
                      >
                        <Printer size={15} />
                        <span>معاينة وطباعة السند المعتمد</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 sm:p-5 text-slate-800 shadow-sm flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-rose-950">
                      تنبيه: لم يتم العثور على أي سند مطابق
                    </h4>
                    <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                      {result.message}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-2">
                      يرجى فحص ورقة السند جيداً والتحقق من أن رقم السند لم يتم تزويره أو تعديله يدوياً.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer (Fixed) */}
        <div className="bg-slate-50/95 px-4 py-3 sm:px-6 sm:py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 hidden sm:flex">
            <ShieldCheck size={16} className="text-purple-600 shrink-0" />
            <span>نظام الحماية والمطابقة الرقمية لمنع التلاعب في السندات المحاسبية</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 sm:py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 transition-all cursor-pointer hover:scale-105 active:scale-95"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
