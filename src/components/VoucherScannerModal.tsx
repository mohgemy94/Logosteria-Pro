import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { 
  Scan, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  ShieldCheck, 
  Barcode,
  Camera,
  CameraOff,
  Flashlight,
  FlashlightOff,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { 
  verifyScannedVoucher, 
  type ScannedVerificationResult 
} from '../utils/voucherBarcode';
import { BarcodeImage } from './VoucherBarcodeView';
import type { PrintPreviewData } from './PrintPreviewModal';
import { useSystemCurrency } from '../utils/currency';
import { mobileNavigationController } from '../utils/mobileNavigation';

interface VoucherScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVoucherForPrint?: (previewData: PrintPreviewData) => void;
}

// Sound feedback helper
function playScanSuccessBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    }
  } catch {
    // AudioContext blocked or not supported
  }
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
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasTorchSupport, setHasTorchSupport] = useState<boolean>(false);
  const [isLiveScanning, setIsLiveScanning] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsTorchOn(false);
    setHasTorchSupport(false);
    setIsLiveScanning(false);
  }, []);

  // Mobile hardware/gesture back support
  useEffect(() => {
    if (!isOpen) return;
    const unregister = mobileNavigationController.registerModal('modal-voucher-scanner', () => {
      stopCamera();
      onClose();
    });
    return () => unregister();
  }, [isOpen, onClose, stopCamera]);

  const executeVerification = useCallback((code: string) => {
    if (!code.trim()) return;
    setIsVerifying(true);
    setTimeout(() => {
      const res = verifyScannedVoucher(code);
      setResult(res);
      setIsVerifying(false);
    }, 120);
  }, []);

  // Start camera helper
  const startCamera = async (targetFacingMode: 'environment' | 'user' = facingMode) => {
    setCameraError(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('الكاميرا غير مدعومة في هذا المتصفح/البيئة.');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: targetFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Check if torch/flashlight is supported
      const track = stream.getVideoTracks()[0];
      if (track && typeof track.getCapabilities === 'function') {
        try {
          const caps: any = track.getCapabilities();
          if (caps && caps.torch) {
            setHasTorchSupport(true);
          }
        } catch {
          // capability check error
        }
      }

      setIsCameraActive(true);
      setFacingMode(targetFacingMode);
    } catch (err: any) {
      console.error('Camera start error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('تم رفض إذن الكاميرا. يرجى تفعيل إذن الكاميرا من إعدادات التطبيق أو الهاتف.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('لم يتم العثور على كاميرا متصلة بالجهاز.');
      } else {
        setCameraError(err.message || 'تعذر تشغيل الكاميرا على هذا الجهاز.');
      }
      setIsCameraActive(false);
    }
  };

  // Attach stream to video element whenever camera is active and video element is mounted
  useEffect(() => {
    if (!isCameraActive || !videoRef.current || !streamRef.current) return;

    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.muted = true;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsLiveScanning(true);
        })
        .catch(err => {
          console.warn('AutoPlay blocked or failed, retrying on user interaction:', err);
          // Try user tap play
          const handleUserPlay = () => {
            video.play().catch(() => {});
            window.removeEventListener('click', handleUserPlay);
            window.removeEventListener('touchstart', handleUserPlay);
          };
          window.addEventListener('click', handleUserPlay);
          window.addEventListener('touchstart', handleUserPlay);
        });
    }
  }, [isCameraActive]);

  // Real-time Barcode & QR Detection Loop using standard Web BarcodeDetector API
  useEffect(() => {
    if (!isCameraActive || !isLiveScanning) return;

    let isScanningActive = true;
    let detector: any = null;

    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        detector = new (window as any).BarcodeDetector({
          formats: [
            'qr_code',
            'code_128',
            'code_39',
            'ean_13',
            'ean_8',
            'upc_a',
            'upc_e',
            'itf',
            'data_matrix'
          ]
        });
      } catch (err) {
        console.warn('BarcodeDetector format init warning:', err);
      }
    }

    let lastDetectedCode = '';
    let consecutiveMatches = 0;

    const scanFrame = async () => {
      if (!isScanningActive) return;

      if (videoRef.current && videoRef.current.readyState >= 2 && detector) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const detectedValue = barcodes[0].rawValue?.trim();
            if (detectedValue) {
              if (detectedValue === lastDetectedCode) {
                consecutiveMatches++;
              } else {
                lastDetectedCode = detectedValue;
                consecutiveMatches = 1;
              }

              // Confirm detection
              if (consecutiveMatches >= 1) {
                playScanSuccessBeep();
                try {
                  if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate([100, 50, 100]);
                  }
                } catch {
                  // vibration not supported
                }

                setInputValue(detectedValue);
                executeVerification(detectedValue);
                stopCamera();
                return;
              }
            }
          }
        } catch {
          // Frame decode error - continue to next frame
        }
      }

      if (isScanningActive && isCameraActive) {
        scanLoopRef.current = requestAnimationFrame(scanFrame);
      }
    };

    const startTimer = setTimeout(() => {
      scanLoopRef.current = requestAnimationFrame(scanFrame);
    }, 250);

    return () => {
      isScanningActive = false;
      clearTimeout(startTimer);
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
        scanLoopRef.current = null;
      }
    };
  }, [isCameraActive, isLiveScanning, executeVerification, stopCamera]);

  // Flashlight / Torch toggle
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      if (track && typeof track.applyConstraints === 'function') {
        const nextState = !isTorchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState } as any]
        });
        setIsTorchOn(nextState);
      }
    } catch (err) {
      console.warn('Torch toggle error:', err);
    }
  };

  // Flip Camera (Front / Back)
  const toggleCameraFacing = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    await startCamera(nextMode);
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
  }, [isOpen, stopCamera]);

  if (!isOpen) return null;

  const handleSearch = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;
    executeVerification(inputValue);
  };

  const handleQuickTest = (code: string) => {
    setInputValue(code);
    executeVerification(code);
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
        if (e.target === e.currentTarget) {
          stopCamera();
          onClose();
        }
      }}
    >
      <div 
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] md:max-h-[90vh] animate-modalIn text-right"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Mobile drag handle */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Modal Header */}
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
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center hover:bg-slate-700 transition-colors cursor-pointer shrink-0 hover:scale-105 active:scale-95"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar">
          {/* Scanner Input Box Form */}
          <form onSubmit={handleSearch} className="space-y-3">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Barcode size={16} className="text-indigo-600" />
                امسح بالماسح الضوئي (Barcode Reader) أو الصق كود الـ QR:
              </span>
              <span className="text-[11px] text-slate-400 font-normal hidden sm:inline">
                يدعم قارئات الليزر وكاميرات الهواتف
              </span>
            </label>

            {/* Input Field Row */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="مثال: PV-2026-0001 أو امسح الباركود مباشرة بالماسح..."
                className="w-full pr-10 pl-3 py-3 border-2 border-slate-300 rounded-xl text-sm font-bold font-mono focus:outline-none focus:border-purple-600 bg-white text-slate-800 shadow-inner"
              />
              <Scan size={18} className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" />
            </div>

            {/* Responsive Action Buttons Row */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={isCameraActive ? stopCamera : () => startCamera()}
                className={`flex-1 sm:flex-initial px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                  isCameraActive 
                    ? 'bg-rose-600 hover:bg-rose-700 text-white border-2 border-rose-700' 
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-indigo-700'
                }`}
              >
                {isCameraActive ? (
                  <>
                    <CameraOff size={16} />
                    <span>إيقاف الكاميرا</span>
                  </>
                ) : (
                  <>
                    <Camera size={16} />
                    <span>تشغيل الكاميرا للمسح</span>
                  </>
                )}
              </button>

              <button
                type="submit"
                disabled={isVerifying || !inputValue.trim()}
                className="flex-1 sm:flex-initial btn-3d btn-3d-purple px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                <Sparkles size={16} />
                <span>{isVerifying ? 'جاري الفحص...' : 'فحص ومطابقة'}</span>
              </button>
            </div>
          </form>

          {/* Camera Viewport (When Active) */}
          {isCameraActive && (
            <div className="bg-slate-950 rounded-2xl overflow-hidden border-2 border-indigo-500 relative flex flex-col items-center justify-center p-2 sm:p-3 shadow-xl animate-in zoom-in-95">
              {/* Video Stream */}
              <div className="relative w-full max-h-72 rounded-xl overflow-hidden bg-black flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  controls={false}
                  className="w-full h-full max-h-72 object-cover"
                />

                {/* Camera Viewfinder Corners Overlay */}
                <div className="absolute inset-4 sm:inset-8 border-2 border-dashed border-white/40 rounded-2xl pointer-events-none flex flex-col justify-between p-2">
                  <div className="flex justify-between">
                    <span className="w-5 h-5 border-t-4 border-r-4 border-indigo-400 rounded-tr-md" />
                    <span className="w-5 h-5 border-t-4 border-l-4 border-indigo-400 rounded-tl-md" />
                  </div>
                  <div className="flex justify-between">
                    <span className="w-5 h-5 border-b-4 border-r-4 border-indigo-400 rounded-br-md" />
                    <span className="w-5 h-5 border-b-4 border-l-4 border-indigo-400 rounded-bl-md" />
                  </div>
                </div>

                {/* Animated Red Laser Scanning Line */}
                <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,1)] animate-pulse pointer-events-none" />

                {/* Top Camera Controls Overlay */}
                <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2 pointer-events-auto">
                  <div className="flex items-center gap-1">
                    {hasTorchSupport && (
                      <button
                        type="button"
                        onClick={toggleTorch}
                        className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 backdrop-blur-md transition-colors cursor-pointer shadow-md ${
                          isTorchOn 
                            ? 'bg-amber-400 text-slate-950' 
                            : 'bg-black/60 text-white hover:bg-black/80'
                        }`}
                        title="تشغيل/إطفاء الفلاش"
                      >
                        {isTorchOn ? <FlashlightOff size={16} /> : <Flashlight size={16} />}
                        <span className="text-[11px]">{isTorchOn ? 'إطفاء' : 'فلاش'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={toggleCameraFacing}
                      className="p-2 rounded-xl text-xs font-bold flex items-center gap-1 bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-colors cursor-pointer shadow-md"
                      title="تبديل الكاميرا (أمامية/خلفية)"
                    >
                      <RefreshCw size={15} />
                      <span className="text-[11px]">تبديل</span>
                    </button>
                  </div>

                  <span className="text-[11px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/50 px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    مسح تلقائي نشط
                  </span>
                </div>
              </div>

              {/* Bottom Instructions */}
              <div className="mt-2.5 text-center px-2">
                <span className="text-xs text-indigo-200 font-semibold bg-indigo-950/80 px-3.5 py-1.5 rounded-full border border-indigo-700/50 inline-flex items-center gap-1.5 shadow-sm">
                  <Scan size={14} className="animate-spin text-indigo-300" />
                  وجه الكاميرا نحو باركود أو كود QR السند لقراءته فورياً وتلقائياً
                </span>
              </div>
            </div>
          )}

          {/* Camera Error Message */}
          {cameraError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertTriangle size={18} className="shrink-0 text-rose-600" />
              <span>{cameraError}</span>
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
                        className="btn-3d btn-3d-emerald px-4 py-2 text-xs font-black flex items-center gap-1.5 w-full sm:w-auto justify-center cursor-pointer"
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

        {/* Modal Footer */}
        <div className="bg-slate-50/95 px-4 py-3 sm:px-6 sm:py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 hidden sm:flex">
            <ShieldCheck size={16} className="text-purple-600 shrink-0" />
            <span>نظام الحماية والمطابقة الرقمية لمنع التلاعب في السندات المحاسبية</span>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-full sm:w-auto px-5 py-2.5 sm:py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 transition-all cursor-pointer hover:scale-105 active:scale-95"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
