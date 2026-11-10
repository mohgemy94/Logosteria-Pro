import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { 
  Scan, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Barcode,
  Camera,
  CameraOff,
  Flashlight,
  FlashlightOff,
  RefreshCw,
  Sparkles,
  Package,
  Plus,
  Layers,
  ShoppingBag,
  ShoppingCart,
  Volume2,
  VolumeX,
  Zap,
  Tag
} from 'lucide-react';
import { Item } from '../utils/itemsStore';
import { useSystemCurrency } from '../utils/currency';
import { mobileNavigationController } from '../utils/mobileNavigation';

export interface ScannedItemEntry {
  item: Item;
  scannedAt: Date;
  barcode: string;
  count: number;
}

interface ItemBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'SALES' | 'PURCHASES';
  itemsCatalog: Item[];
  onScanItem: (item: Item, quantityToAdd?: number) => void;
  currentInvoiceItemsCount?: number;
}

// Sound feedback helper
function playScanBeep(success: boolean = true) {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      if (success) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      }
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (success ? 0.16 : 0.25));
    }
  } catch {
    // AudioContext blocked or not supported
  }
}

export default function ItemBarcodeScannerModal({
  isOpen,
  onClose,
  mode,
  itemsCatalog,
  onScanItem,
  currentInvoiceItemsCount = 0
}: ItemBarcodeScannerModalProps) {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [manualInput, setManualInput] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasTorchSupport, setHasTorchSupport] = useState<boolean>(false);
  const [isLiveScanning, setIsLiveScanning] = useState<boolean>(false);
  const [continuousScan, setContinuousScan] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // Last scan feedback state
  const [lastScannedItem, setLastScannedItem] = useState<{
    item: Item;
    barcode: string;
    timestamp: number;
  } | null>(null);
  const [unmatchedBarcode, setUnmatchedBarcode] = useState<string | null>(null);
  const [scannedSession, setScannedSession] = useState<ScannedItemEntry[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const lastScannedCodeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  const isSales = mode === 'SALES';

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
    const unregister = mobileNavigationController.registerModal('modal-item-barcode-scanner', () => {
      stopCamera();
      onClose();
    });
    return () => unregister();
  }, [isOpen, onClose, stopCamera]);

  // Lookup and process item by code or barcode
  const processScannedCode = useCallback((rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    // Throttle duplicate rapid scans of the exact same barcode within 1.2 seconds
    const now = Date.now();
    if (lastScannedCodeRef.current.code === code && now - lastScannedCodeRef.current.time < 1200) {
      return;
    }
    lastScannedCodeRef.current = { code, time: now };

    const lower = code.toLowerCase();
    // Match in catalog by barcode, code, or id
    const matched = itemsCatalog.find(it => {
      const itBarcode = (it.barcode || '').trim().toLowerCase();
      const itCode = (it.code || '').trim().toLowerCase();
      const itId = (it.id || '').trim().toLowerCase();
      return itBarcode === lower || itCode === lower || itId === lower;
    });

    if (matched) {
      setUnmatchedBarcode(null);
      setLastScannedItem({
        item: matched,
        barcode: code,
        timestamp: now
      });

      if (soundEnabled) {
        playScanBeep(true);
      }
      try {
        if ('vibrate' in navigator) {
          navigator.vibrate(60);
        }
      } catch {
        // ignore
      }

      // Add to session history
      setScannedSession(prev => {
        const existingIdx = prev.findIndex(entry => entry.item.id === matched.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          const curr = updated[existingIdx];
          if (curr) {
            updated[existingIdx] = {
              item: curr.item,
              barcode: curr.barcode,
              scannedAt: new Date(),
              count: curr.count + 1
            };
          }
          return updated;
        }
        return [
          {
            item: matched,
            scannedAt: new Date(),
            barcode: code,
            count: 1
          },
          ...prev
        ];
      });

      // Call parent handler to add/increment in invoice
      onScanItem(matched, 1);

      // If continuous scan is disabled, auto close
      if (!continuousScan) {
        setTimeout(() => {
          stopCamera();
          onClose();
        }, 400);
      }
    } else {
      setLastScannedItem(null);
      setUnmatchedBarcode(code);
      if (soundEnabled) {
        playScanBeep(false);
      }
      try {
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 50, 100]);
        }
      } catch {
        // ignore
      }
    }
  }, [itemsCatalog, onScanItem, continuousScan, soundEnabled, stopCamera, onClose]);

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
          // ignore
        }
      }

      setIsCameraActive(true);
      setFacingMode(targetFacingMode);
    } catch (err: any) {
      console.error('Camera start error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('تم رفض إذن استخدام الكاميرا. يرجى السماح بالوصول للكاميرا من إعدادات المتصفح.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('لم يتم العثور على كاميرا متصلة بهذا الجهاز.');
      } else {
        setCameraError(err.message || 'تعذر تشغيل الكاميرا.');
      }
      setIsCameraActive(false);
    }
  };

  // Toggle flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextState = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }]
      });
      setIsTorchOn(nextState);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  // Flip camera (front / back)
  const flipCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    startCamera(nextMode);
  };

  // Auto start camera when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera('environment');
      setScannedSession([]);
      setLastScannedItem(null);
      setUnmatchedBarcode(null);
      setManualInput('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 350);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Attach stream to video element
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
          console.warn('AutoPlay blocked:', err);
        });
    }
  }, [isCameraActive]);

  // Real-time Barcode Detection Loop
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
        console.warn('BarcodeDetector init error:', err);
      }
    }

    const scanFrame = async () => {
      if (!isScanningActive || !videoRef.current || videoRef.current.readyState < 2) {
        if (isScanningActive) {
          scanLoopRef.current = requestAnimationFrame(scanFrame);
        }
        return;
      }

      if (detector) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const rawVal = barcodes[0].rawValue;
            if (rawVal) {
              processScannedCode(rawVal);
            }
          }
        } catch {
          // frame detect error
        }
      }

      if (isScanningActive) {
        scanLoopRef.current = requestAnimationFrame(scanFrame);
      }
    };

    scanLoopRef.current = requestAnimationFrame(scanFrame);

    return () => {
      isScanningActive = false;
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
        scanLoopRef.current = null;
      }
    };
  }, [isCameraActive, isLiveScanning, processScannedCode]);

  // Handle manual input submit
  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    processScannedCode(manualInput.trim());
    setManualInput('');
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  const totalSessionCount = scannedSession.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopCamera();
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[90vh] animate-modalIn text-right"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Mobile Handle */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-950 via-purple-950 to-slate-900 text-white p-3.5 sm:p-4 flex items-center justify-between gap-3 shrink-0 border-b border-purple-900/50">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-400/40 text-purple-300 flex items-center justify-center shadow-xs shrink-0">
              <Scan size={22} className="animate-pulse text-purple-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm sm:text-base text-white">
                  ماسح الباركود السريع بالكاميرا
                </h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black border shrink-0 ${
                  isSales 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' 
                    : 'bg-blue-500/20 text-blue-300 border-blue-400/40'
                }`}>
                  {isSales ? 'فاتورة مبيعات' : 'فاتورة مشتريات'}
                </span>
              </div>
              <p className="text-[11px] text-purple-200/80 truncate mt-0.5">
                امسح باركود الصنف بكاميرا الهاتف أو القارئ لإدراجه فورياً
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Sound Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                soundEnabled 
                  ? 'bg-purple-900/60 text-purple-200 border-purple-700/60 hover:bg-purple-800' 
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title={soundEnabled ? 'كتم صوت التنبيه' : 'تفعيل صوت التنبيه'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            {/* Continuous Scan Toggle */}
            <button
              type="button"
              onClick={() => setContinuousScan(!continuousScan)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                continuousScan
                  ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50 shadow-2xs'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
              title="المسح المتتالي المستمر للأصناف بدون إغلاق الكاميرا"
            >
              <Zap size={14} className={continuousScan ? 'text-emerald-400' : 'text-slate-400'} />
              <span className="hidden xs:inline">مسح متتالي</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-800 text-slate-200 hover:text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="إغلاق"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-4 overflow-y-auto flex flex-col gap-3 bg-slate-50 flex-1">
          
          {/* Camera Viewfinder Box */}
          <div className="relative w-full aspect-video sm:aspect-21/9 max-h-[260px] sm:max-h-[290px] bg-slate-950 rounded-2xl overflow-hidden border-2 border-purple-900/40 shadow-inner flex items-center justify-center">
            {isCameraActive ? (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />

                {/* Reticle / Viewfinder Frame */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                  <div className="relative w-4/5 sm:w-3/5 h-3/5 border-2 border-dashed border-purple-400/80 rounded-2xl flex items-center justify-center shadow-lg">
                    {/* Corner Brackets */}
                    <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-purple-400 rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-purple-400 rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-purple-400 rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-purple-400 rounded-br-lg" />

                    {/* Animated Scanning Laser */}
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent shadow-[0_0_12px_#a855f7] animate-pulse" />
                    
                    <span className="absolute bottom-2 text-[10px] sm:text-xs font-bold text-white bg-slate-950/70 px-2.5 py-0.5 rounded-full border border-purple-400/30">
                      وجّه الباركود داخل الإطار
                    </span>
                  </div>
                </div>

                {/* Camera Control Overlays */}
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                  {hasTorchSupport && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`p-2 rounded-xl backdrop-blur-md border transition-all cursor-pointer ${
                        isTorchOn 
                          ? 'bg-amber-500 text-white border-amber-300 shadow-md' 
                          : 'bg-slate-900/75 text-slate-200 border-white/20 hover:bg-slate-800'
                      }`}
                      title={isTorchOn ? 'إطفاء الفلاش' : 'تشغيل الفلاش'}
                    >
                      {isTorchOn ? <Flashlight size={16} /> : <FlashlightOff size={16} />}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={flipCamera}
                    className="p-2 rounded-xl bg-slate-900/75 text-slate-200 border border-white/20 hover:bg-slate-800 backdrop-blur-md transition-all cursor-pointer"
                    title="تبديل الكاميرا (أمامية / خلفية)"
                  >
                    <RefreshCw size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={stopCamera}
                    className="p-2 rounded-xl bg-rose-600/80 text-white border border-rose-400/40 hover:bg-rose-600 backdrop-blur-md transition-all cursor-pointer"
                    title="إيقاف الكاميرا"
                  >
                    <CameraOff size={16} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 p-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-purple-900/30 border border-purple-500/30 text-purple-400 flex items-center justify-center">
                  <Camera size={28} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">الكاميرا متوقفة حالياً</h4>
                  {cameraError ? (
                    <p className="text-xs text-rose-300 mt-1 max-w-sm">{cameraError}</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">اضغط على الزر أدناه لتشغيل الكاميرا والمسح المباشر</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Camera size={15} />
                  <span>تشغيل الكاميرا الآن</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Manual Entry & Barcode Gun Scanner Form */}
          <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Barcode size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                placeholder="أدخل رقم الباركود أو كود الصنف يدوياً أو بقارئ الباركود..."
                className="w-full pr-10 pl-3 py-2.5 rounded-xl border-2 border-slate-300 focus:border-purple-600 focus:outline-none bg-white font-mono text-xs font-bold text-slate-800 shadow-2xs"
              />
              {manualInput && (
                <button
                  type="button"
                  onClick={() => setManualInput('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  مسح
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={!manualInput.trim()}
              className="px-4 py-2.5 bg-slate-900 hover:bg-purple-950 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-2xs"
            >
              إدراج
            </button>
          </form>

          {/* Live Scan Notification / Result Card */}
          {lastScannedItem && (
            <div className="p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-400 rounded-2xl shadow-xs animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 mt-0.5 shadow-xs">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-xs sm:text-sm text-emerald-950">
                        {lastScannedItem.item.name}
                      </span>
                      <span className="text-[10px] font-mono font-bold bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded border border-emerald-300">
                        كود: {lastScannedItem.item.code}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-emerald-900 flex-wrap">
                      <span className="font-bold">
                        السعر: {((isSales 
                          ? (lastScannedItem.item.salePrice || lastScannedItem.item.retailPrice || lastScannedItem.item.costPrice || 0)
                          : (lastScannedItem.item.costPrice || lastScannedItem.item.salePrice || 0)
                        )).toLocaleString()} {currencySymbol}
                      </span>
                      <span>•</span>
                      <span className="text-[11px] text-slate-600">
                        المتوفر بالمخزن: <strong className="font-mono text-slate-900">{lastScannedItem.item.stock ?? 0}</strong> {lastScannedItem.item.unit || 'حبة'}
                      </span>
                      {lastScannedItem.item.barcode && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-[10px] text-slate-500">
                            باركود: {lastScannedItem.item.barcode}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <span className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-black rounded-lg shadow-2xs whitespace-nowrap">
                  ✓ تم الإدراج (+1)
                </span>
              </div>
            </div>
          )}

          {/* Unmatched Barcode Alert */}
          {unmatchedBarcode && (
            <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-center justify-between gap-3 text-xs text-rose-950 animate-shake">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-600 shrink-0" />
                <div>
                  <span className="font-black block">لم يتم العثور على صنف مطابق!</span>
                  <span className="text-[11px] text-rose-700 font-mono">الرمز الممسوح: "{unmatchedBarcode}" غير مسجل في دليل الأصناف.</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setUnmatchedBarcode(null)}
                className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-800 rounded-lg font-bold text-[11px] border border-rose-300 cursor-pointer transition-colors"
              >
                تجاهل
              </button>
            </div>
          )}

          {/* Scanned Items in Current Session */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                <ShoppingCart size={14} className="text-purple-600" />
                <span>سجل الأصناف الممسوحة في هذه الجلسة</span>
                <span className="text-[10px] font-mono bg-purple-100 text-purple-900 px-1.5 py-0.2 rounded-full font-bold">
                  {totalSessionCount} قطعة ({scannedSession.length} صنف)
                </span>
              </div>

              {scannedSession.length > 0 && (
                <button
                  type="button"
                  onClick={() => setScannedSession([])}
                  className="text-[10px] text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  مسح السجل
                </button>
              )}
            </div>

            {scannedSession.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-3">
                لم يتم مسح أي أصناف بعد. ابدأ بتوجيه الكاميرا إلى باركود السلعة.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto divide-y divide-slate-50">
                {scannedSession.map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between pt-1.5 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-purple-50 text-purple-700 font-mono font-bold text-[10px] flex items-center justify-center shrink-0 border border-purple-200">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 truncate block">{entry.item.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">كود: {entry.item.code}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-slate-700 font-mono">
                        {((isSales 
                          ? (entry.item.salePrice || entry.item.retailPrice || entry.item.costPrice || 0)
                          : (entry.item.costPrice || entry.item.salePrice || 0)
                        )).toLocaleString()} {currencySymbol}
                      </span>
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded-md font-mono font-black text-xs border border-purple-200">
                        × {entry.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 font-medium">
            <span>إجمالي بنود الفاتورة الحالية: </span>
            <strong className="font-mono text-purple-900 font-bold">{currentInvoiceItemsCount} بند</strong>
          </div>

          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-5 py-2 bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-600 hover:to-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
          >
            تم وإنهاء المسح ({totalSessionCount})
          </button>
        </div>

      </div>
    </div>
  );
}
