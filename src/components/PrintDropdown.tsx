import { useState, useEffect, useRef } from 'react';
import { 
  Printer, 
  ChevronDown, 
  Eye, 
  Check, 
  Pin, 
  Sliders, 
  Download, 
  FileText, 
  Layers, 
  Receipt, 
  Settings2,
  X
} from 'lucide-react';
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
  type PrintColorMode,
} from '../utils/printPaperFormats';

interface PrintDropdownProps {
  onPrint?: (format: PrintPaperFormat) => void;
  onPreview?: () => void;
  onExportPdf?: () => void;
  previewLabel?: string;
}

export default function PrintDropdown({
  onPrint,
  onPreview,
  onExportPdf,
  previewLabel = 'معاينة قبل الطباعة'
}: PrintDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFormat, setActiveFormat] = useState<PrintPaperFormat>('A4');
  const [customSize, setCustomSize] = useState<CustomPaperSize>({ widthCm: 21, heightCm: 29.7 });
  const [colorMode, setColorMode] = useState<PrintColorMode>(getSavedPrintColorMode());
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [tempWidthCm, setTempWidthCm] = useState<string>('21');
  const [tempHeightCm, setTempHeightCm] = useState<string>('29.7');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync with saved format & listen to cross-component changes
  useEffect(() => {
    const syncFormat = () => {
      const saved = getSavedPrintPaperFormat();
      setActiveFormat(saved.format);
      setCustomSize(saved.customSize);
      setTempWidthCm(saved.customSize.widthCm.toString());
      setTempHeightCm(saved.customSize.heightCm.toString());
      setColorMode(getSavedPrintColorMode());
    };

    syncFormat();

    const handleFormatChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ format: PrintPaperFormat; customSize?: CustomPaperSize }>;
      if (customEvent.detail) {
        setActiveFormat(customEvent.detail.format);
        if (customEvent.detail.customSize) {
          setCustomSize(customEvent.detail.customSize);
          setTempWidthCm(customEvent.detail.customSize.widthCm.toString());
          setTempHeightCm(customEvent.detail.customSize.heightCm.toString());
        }
      }
    };

    window.addEventListener('alpha-paper-format-fixed', handleFormatChanged);
    return () => {
      window.removeEventListener('alpha-paper-format-fixed', handleFormatChanged);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleSelectAndFixFormat = (formatId: PrintPaperFormat) => {
    if (formatId === 'CUSTOM') {
      setShowCustomModal(true);
      setIsOpen(false);
      return;
    }

    const { def } = savePrintPaperFormat(formatId, customSize);
    setActiveFormat(formatId);
    setIsOpen(false);
    showToast(`تم تثبيت مقاس الطباعة: ${def.shortName}`);

    // Trigger print if intended or apply page style
    applyPrintPageStyle(formatId, customSize, colorMode);
  };

  const handlePrintCurrent = () => {
    applyPrintPageStyle(activeFormat, customSize, colorMode);
    if (onPrint) {
      onPrint(activeFormat);
    } else {
      window.print();
    }
  };

  const handleSaveCustomSize = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(tempWidthCm);
    const h = parseFloat(tempHeightCm);

    if (isNaN(w) || w <= 0) {
      alert('يرجى إدخال عرض صحيح بالسنتيمتر');
      return;
    }
    if (isNaN(h) || h <= 0) {
      alert('يرجى إدخال طول/ارتفاع صحيح بالسنتيمتر');
      return;
    }

    const newSize: CustomPaperSize = { widthCm: w, heightCm: h };
    setCustomSize(newSize);
    savePrintPaperFormat('CUSTOM', newSize);
    setActiveFormat('CUSTOM');
    setShowCustomModal(false);
    showToast(`تم تثبيت المقاس المخصص: ${w} × ${h} سم`);
  };

  // Group formats for clean visual scanning
  const standardFormats = PAPER_FORMAT_LIST.filter(f => f.category === 'standard');
  const fractionFormats = PAPER_FORMAT_LIST.filter(f => f.category === 'fraction');
  const thermalFormats = PAPER_FORMAT_LIST.filter(f => f.category === 'thermal');
  const customFormatDef = PAPER_FORMAT_LIST.find(f => f.id === 'CUSTOM');

  const activeDef = getPaperFormatDef(activeFormat, customSize);

  return (
    <div className="relative inline-flex items-center gap-1.5 print:hidden max-w-full" ref={dropdownRef}>
      {/* Toast feedback */}
      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-fadeIn pointer-events-none">
          <Pin size={14} className="text-emerald-400" />
          <span className="font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Dedicated Preview Button (if provided) */}
      {onPreview && (
        <button
          type="button"
          onClick={onPreview}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer shrink-0"
          title="معاينة المستند قبل الطباعة"
        >
          <Eye size={14} className="text-blue-600 shrink-0" />
          <span className="hidden sm:inline">{previewLabel}</span>
          <span className="sm:hidden">معاينة</span>
        </button>
      )}

      {/* Main Print Options Dropdown Trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer border ${
            isOpen 
              ? 'bg-slate-900 text-white border-slate-800 ring-2 ring-blue-500/20' 
              : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
          }`}
          title="خيارات ومقاسات الطباعة وتثبيت المقاس الافتراضي"
        >
          <Printer size={15} className={isOpen ? 'text-blue-400' : 'text-slate-700'} />
          <span className="hidden md:inline">خيارات الطبعات</span>
          <span className="md:hidden">الطبعات</span>
          
          {/* Active pinned paper size badge */}
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 border ${
            isOpen
              ? 'bg-blue-600/30 text-blue-300 border-blue-500/40'
              : 'bg-slate-100 text-slate-700 border-slate-200'
          }`}>
            <Pin size={10} className="text-emerald-500" />
            <span className="truncate max-w-[85px] sm:max-w-[120px]">
              {activeFormat === 'CUSTOM'
                ? `${customSize.widthCm}×${customSize.heightCm}سم`
                : activeDef.shortName}
            </span>
          </span>

          <ChevronDown 
            size={13} 
            className={`transition-transform duration-200 text-slate-400 ${isOpen ? 'rotate-180 text-blue-400' : ''}`} 
          />
        </button>

        {/* Dropdown Menu Popup */}
        {isOpen && (
          <div 
            dir="rtl"
            className="absolute left-0 sm:right-0 sm:left-auto mt-1.5 w-[310px] sm:w-[350px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-fadeIn text-slate-800"
          >
            {/* Header with active pinned info */}
            <div className="bg-slate-900 text-white p-3 border-b border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Printer size={15} />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-white">خيارات ومقاسات الطباعة</h3>
                    <p className="text-[10px] text-slate-400">اختر المقاس لتثبيته في النظام تلقائياً</p>
                  </div>
                </div>

                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Pin size={10} />
                  <span>المقاس مثبت</span>
                </span>
              </div>

              {/* Current Fixed Size Banner */}
              <div className="mt-2.5 bg-slate-800/80 border border-slate-700 rounded-xl p-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-slate-400 text-[11px]">المثبت حالياً:</span>
                  <span className="font-bold text-white truncate">
                    {activeFormat === 'CUSTOM'
                      ? `مقاس مخصص (${customSize.widthCm} × ${customSize.heightCm} سم)`
                      : activeDef.label}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handlePrintCurrent}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold shadow-xs transition-colors shrink-0 flex items-center gap-1"
                >
                  <Printer size={12} />
                  <span>طباعة الآن</span>
                </button>
              </div>

              {/* Color Clarity Mode Selector */}
              <div className="mt-2 bg-slate-800/90 border border-slate-700/80 rounded-xl p-2 flex items-center justify-between text-xs">
                <span className="text-[11px] font-bold text-slate-300">درجة وضوح الطباعة:</span>
                <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-lg border border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setColorMode('bw');
                      savePrintColorMode('bw');
                      applyPrintPageStyle(activeFormat, customSize, 'bw');
                      showToast('تم تثبيت نمط أبيض وأسود فائق الوضوح');
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      colorMode === 'bw'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    أبيض وأسود واضح
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setColorMode('color');
                      savePrintColorMode('color');
                      applyPrintPageStyle(activeFormat, customSize, 'color');
                      showToast('تم تثبيت نمط الألوان');
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      colorMode === 'color'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ملون
                  </button>
                </div>
              </div>
            </div>

            {/* Formats List (Scrollable) */}
            <div className="max-h-[380px] overflow-y-auto p-2 space-y-3 custom-scrollbar text-xs">
              {/* Category 1: المقاسات القياسية */}
              <div>
                <div className="px-2 py-1 flex items-center gap-1.5 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <FileText size={13} className="text-blue-600" />
                  <span>المقاسات القياسية المعتمدة</span>
                </div>
                <div className="space-y-1 mt-1">
                  {standardFormats.map(item => {
                    const isSelected = activeFormat === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectAndFixFormat(item.id)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl transition-all text-right cursor-pointer border ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-extrabold shadow-2xs'
                            : 'hover:bg-slate-50 border-transparent text-slate-700 font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-[10px] font-bold border ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {item.shortName}
                          </div>
                          <div className="min-w-0 text-right">
                            <span className="block text-xs font-bold leading-tight">{item.label}</span>
                            <span className="block text-[10px] text-slate-400 font-normal truncate">
                              {item.description}
                            </span>
                          </div>
                        </div>

                        {isSelected ? (
                          <span className="flex items-center gap-1 text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold shrink-0">
                            <Check size={11} />
                            <span>مثبت</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 group-hover:text-slate-600 font-semibold shrink-0">
                            تثبيت
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category 2: تقسيمات A4 */}
              <div className="border-t border-slate-100 pt-2">
                <div className="px-2 py-1 flex items-center gap-1.5 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <Layers size={13} className="text-indigo-600" />
                  <span>قص وتقسيم ورق A4</span>
                </div>
                <div className="space-y-1 mt-1">
                  {fractionFormats.map(item => {
                    const isSelected = activeFormat === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectAndFixFormat(item.id)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl transition-all text-right cursor-pointer border ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-extrabold shadow-2xs'
                            : 'hover:bg-slate-50 border-transparent text-slate-700 font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-[9px] font-bold border ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {item.id === 'HALF_A4' ? '1/2' : '1/4'}
                          </div>
                          <div className="min-w-0 text-right">
                            <span className="block text-xs font-bold leading-tight">{item.label}</span>
                            <span className="block text-[10px] text-slate-400 font-normal truncate">
                              {item.description}
                            </span>
                          </div>
                        </div>

                        {isSelected ? (
                          <span className="flex items-center gap-1 text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold shrink-0">
                            <Check size={11} />
                            <span>مثبت</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                            تثبيت
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category 3: طابعات الإيصالات الحرارية */}
              <div className="border-t border-slate-100 pt-2">
                <div className="px-2 py-1 flex items-center gap-1.5 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <Receipt size={13} className="text-amber-600" />
                  <span>طابعات الإيصالات الحرارية (كاشير وبوالص)</span>
                </div>
                <div className="space-y-1 mt-1">
                  {thermalFormats.map(item => {
                    const isSelected = activeFormat === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectAndFixFormat(item.id)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl transition-all text-right cursor-pointer border ${
                          isSelected
                            ? 'bg-amber-50/80 border-amber-300 text-amber-950 font-extrabold shadow-2xs'
                            : 'hover:bg-slate-50 border-transparent text-slate-700 font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-[9px] font-bold border ${
                            isSelected
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {item.widthMm}m
                          </div>
                          <div className="min-w-0 text-right">
                            <span className="block text-xs font-bold leading-tight">{item.label}</span>
                            <span className="block text-[10px] text-slate-400 font-normal truncate">
                              {item.description}
                            </span>
                          </div>
                        </div>

                        {isSelected ? (
                          <span className="flex items-center gap-1 text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold shrink-0">
                            <Check size={11} />
                            <span>مثبت</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                            تثبيت
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category 4: مقاس مخصص */}
              {customFormatDef && (
                <div className="border-t border-slate-100 pt-2">
                  <div className="px-2 py-1 flex items-center gap-1.5 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <Sliders size={13} className="text-purple-600" />
                    <span>تخصيص يدوي</span>
                  </div>
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => handleSelectAndFixFormat('CUSTOM')}
                      className={`w-full flex items-center justify-between p-2 rounded-xl transition-all text-right cursor-pointer border ${
                        activeFormat === 'CUSTOM'
                          ? 'bg-purple-50/80 border-purple-300 text-purple-950 font-extrabold shadow-2xs'
                          : 'hover:bg-slate-50 border-transparent text-slate-700 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-[10px] font-bold border ${
                          activeFormat === 'CUSTOM'
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          <Settings2 size={13} />
                        </div>
                        <div className="min-w-0 text-right">
                          <span className="block text-xs font-bold leading-tight">
                            {customFormatDef.label}
                          </span>
                          <span className="block text-[10px] text-slate-500 font-mono">
                            الحالي: {customSize.widthCm} × {customSize.heightCm} سم
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {activeFormat === 'CUSTOM' && (
                          <span className="flex items-center gap-1 text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold shrink-0">
                            <Check size={11} />
                            <span>مثبت</span>
                          </span>
                        )}
                        <span className="text-[11px] text-blue-600 font-bold hover:underline shrink-0">
                          تعديل
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions: PDF Export / Direct Actions */}
            <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 text-xs">
              {onExportPdf && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onExportPdf();
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-rose-700 border border-rose-200 rounded-xl font-bold transition-colors cursor-pointer shadow-2xs"
                >
                  <Download size={13} />
                  <span>تصدير PDF</span>
                </button>
              )}

              {onPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onPreview();
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-bold transition-colors cursor-pointer shadow-2xs"
                >
                  <Eye size={13} />
                  <span>معاينة المستند</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Custom Paper Size Setting */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-fadeIn">
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
                onClick={() => setShowCustomModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomSize} className="p-5 space-y-4">
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

              {/* Quick Presets */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-500 block mb-2">نماذج مسبقة سريعة:</span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setTempWidthCm('10');
                      setTempHeightCm('15');
                    }}
                    className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 font-mono text-center cursor-pointer transition-colors"
                  >
                    <span className="block font-bold">10 × 15 سم</span>
                    <span className="text-[10px] text-slate-400">ملصق شحن</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTempWidthCm('12');
                      setTempHeightCm('18');
                    }}
                    className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 font-mono text-center cursor-pointer transition-colors"
                  >
                    <span className="block font-bold">12 × 18 سم</span>
                    <span className="text-[10px] text-slate-400">إذن استلام</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTempWidthCm('21');
                      setTempHeightCm('14');
                    }}
                    className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 font-mono text-center cursor-pointer transition-colors"
                  >
                    <span className="block font-bold">21 × 14 سم</span>
                    <span className="text-[10px] text-slate-400">سند عرضي</span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-900 leading-relaxed">
                💡 عند تثبيت المقاس المخصص، سيعتمد النظام هذا المقاس تلقائياً في الطباعة ومعاينة الفواتير وتصدير ملفات الـ PDF.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
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
