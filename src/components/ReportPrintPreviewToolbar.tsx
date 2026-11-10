import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Printer, 
  X, 
  ZoomIn, 
  ZoomOut, 
  Type, 
  Layout
} from 'lucide-react';

interface ReportPrintPreviewToolbarProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  targetId: string;
}

export default function ReportPrintPreviewToolbar({
  isOpen,
  onClose,
  title,
  targetId
}: ReportPrintPreviewToolbarProps) {
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [fontSize, setFontSize] = useState<number>(12); // pt
  const [margin, setMargin] = useState<number>(15); // mm

  const resetPan = () => {
    setPan({ x: 0, y: 0 });
  };

  const handleClose = () => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
    onClose();
  };

  // Automatically calculate optimal zoom to fit report width to screen size on mobile/tablet/desktop
  useEffect(() => {
    if (!isOpen) {
      setZoom(100);
      setPan({ x: 0, y: 0 });
      return;
    }

    const calculateReportFit = () => {
      if (typeof window === 'undefined') return;
      // 210mm in standard CSS pixels is ~794px
      const standardA4WidthPx = 794;
      const screenWidth = window.innerWidth;
      const availableWidth = screenWidth - 24; // account for margins/padding

      if (availableWidth < standardA4WidthPx) {
        const calculatedZoom = Math.floor((availableWidth / standardA4WidthPx) * 100);
        // On very small screens, clamp between 35% and 100%
        setZoom(Math.max(35, Math.min(100, calculatedZoom)));
      } else {
        setZoom(100);
      }
    };

    calculateReportFit();
    window.addEventListener('resize', calculateReportFit);
    return () => window.removeEventListener('resize', calculateReportFit);
  }, [isOpen]);

  // Dynamically inject styles for the live preview and the actual print
  useEffect(() => {
    if (!isOpen) return;
    
    const styleId = 'report-print-preview-dynamic-style';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    
    styleEl.innerHTML = `
      /* Live Preview Styles (applied to screen) */
      body {
        background-color: #f1f5f9 !important; /* light slate background for contrast */
        overflow-x: hidden !important;
      }
      .print\\:hidden {
        display: none !important;
      }
      .print\\:block {
        display: block !important;
      }
      
      /* Target the report container specifically */
      #${targetId} {
        background-color: white !important;
        box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25) !important; /* 2xl shadow */
        margin: 110px auto 40px auto !important; /* leave space for toolbar */
        padding: ${margin}mm !important;
        font-size: ${fontSize}pt !important;
        max-width: 210mm !important; /* A4 width */
        min-height: 297mm !important; /* A4 height */
        transform: translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom / 100});
        transform-origin: top center;
        transition: transform 0.15s ease-out;
      }

      @media (max-width: 640px) {
        #${targetId} {
          margin: 155px auto 40px auto !important;
        }
      }

      /* Force inheritance of font size down the tree */
      #${targetId} th, 
      #${targetId} td,
      #${targetId} span,
      #${targetId} p,
      #${targetId} div {
        font-size: inherit !important;
      }

      /* Reset shadows and borders inside for cleaner print look */
      #${targetId} * {
        box-shadow: none !important;
      }

      /* Actual Print Styles (applied when printing) */
      @media print {
        @page { margin: ${margin}mm !important; }
        body { background-color: white !important; overflow: visible !important; }
        #${targetId} {
          margin: 0 !important;
          padding: 0 !important;
          box-shadow: none !important;
          max-width: none !important;
          min-height: 0 !important;
          transform: none !important;
        }
        .report-preview-toolbar-root { display: none !important; }
      }
    `;

    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, [isOpen, fontSize, margin, zoom, targetId]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div className="fixed top-0 left-0 right-0 z-[100] report-preview-toolbar-root">
      {/* Top Toolbar */}
      <div className="bg-slate-900 text-white px-3 sm:px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <h2 className="font-bold text-base sm:text-lg text-blue-100">{title} - معاينة الطباعة</h2>
          <button onClick={handleClose} className="p-1.5 hover:bg-slate-800 rounded-lg sm:hidden">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
          {/* Font Size Control */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-800/80 p-1 sm:p-1.5 px-2 sm:px-3 rounded-xl border border-slate-700">
             <Type size={14} className="text-blue-400 shrink-0"/>
             <span className="text-[10px] text-slate-400 shrink-0">الخط:</span>
             <input type="range" min="8" max="24" step="1" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-14 sm:w-24 accent-blue-500" />
             <span className="text-[11px] sm:text-xs font-mono w-5 sm:w-6 text-center">{fontSize}</span>
          </div>

          {/* Margins Control */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-800/80 p-1 sm:p-1.5 px-2 sm:px-3 rounded-xl border border-slate-700">
             <Layout size={14} className="text-emerald-400 shrink-0"/>
             <span className="text-[10px] text-slate-400 shrink-0">الهامش:</span>
             <input type="range" min="0" max="30" step="5" value={margin} onChange={e => setMargin(Number(e.target.value))} className="w-14 sm:w-24 accent-emerald-500" />
             <span className="text-[11px] sm:text-xs font-mono w-5 sm:w-6 text-center">{margin}</span>
          </div>

          {/* أداة التكبير والتصغير المرنة بأي قيمة (Flexible Zoom Control with Slider & Stepper) */}
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 shadow-2xs text-white">
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(z - 15, 30))}
              className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              title="تصغير (-15%)"
            >
              <ZoomOut size={14} />
            </button>

            <input
              type="range"
              min="30"
              max="220"
              step="5"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-20 sm:w-28 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              title={`نسبة التكبير: ${zoom}% (اسحب للتحكم بأي قيمة)`}
            />

            <button
              type="button"
              onClick={() => setZoom(z => Math.min(z + 15, 220))}
              className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              title="تكبير (+15%)"
            >
              <ZoomIn size={14} />
            </button>

            <button
              type="button"
              onClick={() => {
                setZoom(100);
                resetPan();
              }}
              className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                zoom === 100 
                  ? 'bg-slate-700 text-slate-300' 
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
              title="إعادة ضبط المعاينة إلى 100%"
            >
              {zoom}%
            </button>
          </div>

          <div className="flex items-center gap-2 mr-auto sm:mr-0 ml-auto sm:ml-0">
            <button onClick={handlePrint} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 cursor-pointer text-xs sm:text-sm">
              <Printer size={15} />
              <span>طباعة الآن</span>
            </button>
            <button onClick={handleClose} className="p-1.5 sm:p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors hidden sm:block">
              <X size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
