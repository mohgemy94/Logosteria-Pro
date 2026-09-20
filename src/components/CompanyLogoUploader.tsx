import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  Link as LinkIcon, 
  Sparkles, 
  FileImage, 
  CheckCircle2,
  Info
} from 'lucide-react';

interface CompanyLogoUploaderProps {
  logoUrl?: string;
  onLogoChange: (url: string) => void;
  stampUrl?: string;
  onStampChange?: (url: string) => void;
  title?: string;
  mode?: 'logo' | 'stamp' | 'both';
}

export default function CompanyLogoUploader({
  logoUrl = '',
  onLogoChange,
  stampUrl = '',
  onStampChange,
  title = 'شعار وختم الشركة الرسمي',
  mode = 'both'
}: CompanyLogoUploaderProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [inputUrl, setInputUrl] = useState(logoUrl);
  const [inputStampUrl, setInputStampUrl] = useState(stampUrl);
  const [dragOverLogo, setDragOverLogo] = useState(false);
  const [dragOverStamp, setDragOverStamp] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const stampFileInputRef = useRef<HTMLInputElement>(null);

  // Helper to read image file and convert to base64 Data URL
  const processImageFile = (file: File, target: 'logo' | 'stamp') => {
    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالحة (PNG, JPG, SVG, WebP)');
      return;
    }

    // Max 3MB warning recommendation
    if (file.size > 3 * 1024 * 1024) {
      alert('حجم الصورة كبير نسبياً (أكبر من 3 ميجابايت). يُفضل استخدام صورة بحجم أصفر لضمان سرعة الطباعة.');
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        if (target === 'logo') {
          onLogoChange(result);
          setInputUrl(result);
          setUploadMessage('تم رفع شعار الشركة بنجاح وسيطبق في كافة الفواتير والتقارير!');
        } else if (target === 'stamp' && onStampChange) {
          onStampChange(result);
          setInputStampUrl(result);
          setUploadMessage('تم رفع ختم الشركة بنجاح!');
        }
        setTimeout(() => setUploadMessage(null), 4000);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file, 'logo');
    }
  };

  const handleStampFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file, 'stamp');
    }
  };

  const handleDropLogo = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverLogo(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file, 'logo');
  };

  const handleDropStamp = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverStamp(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file, 'stamp');
  };

  const handleApplyUrl = (target: 'logo' | 'stamp') => {
    if (target === 'logo') {
      onLogoChange(inputUrl.trim());
      setUploadMessage('تم تحديث رابط الشعار بنجاح');
    } else if (target === 'stamp' && onStampChange) {
      onStampChange(inputStampUrl.trim());
      setUploadMessage('تم تحديث رابط الختم بنجاح');
    }
    setTimeout(() => setUploadMessage(null), 3000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-300/40 flex items-center justify-center shrink-0">
            <FileImage size={20} />
          </div>
          <div>
            <h4 className="font-bold text-sm sm:text-base text-slate-900">{title}</h4>
            <p className="text-xs text-slate-500">
              رفع وتحديد الشعار الرسمي ليعرض أعلى الفواتير الضريبية وسندات القبض والصرف
            </p>
          </div>
        </div>

        {/* Input Method Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload size={13} />
            تحميل صورة من الجهاز
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'url'
                ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LinkIcon size={13} />
            رابط مباشر (URL)
          </button>
        </div>
      </div>

      {uploadMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          {uploadMessage}
        </div>
      )}

      {/* Grid for Logo and Stamp */}
      <div className={`grid grid-cols-1 ${mode === 'both' ? 'md:grid-cols-2' : ''} gap-5`}>
        {/* 1. COMPANY LOGO SECTION */}
        {(mode === 'logo' || mode === 'both') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ImageIcon size={14} className="text-blue-600" />
                شعار المنشأة الرئيسي (Company Logo)
              </label>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => {
                    onLogoChange('');
                    setInputUrl('');
                  }}
                  className="text-rose-600 hover:text-rose-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={12} />
                  حذف الشعار
                </button>
              )}
            </div>

            {/* Preview Box & Upload Area */}
            {activeTab === 'upload' ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOverLogo(true); }}
                onDragLeave={() => setDragOverLogo(false)}
                onDrop={handleDropLogo}
                onClick={() => logoFileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[160px] group ${
                  dragOverLogo
                    ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
                    : logoUrl
                    ? 'border-emerald-300 bg-emerald-50/20 hover:border-blue-400'
                    : 'border-slate-300 bg-slate-50/70 hover:border-blue-400 hover:bg-slate-100/80'
                }`}
              >
                <input
                  type="file"
                  ref={logoFileInputRef}
                  onChange={handleLogoFileChange}
                  accept="image/png, image/jpeg, image/webp, image/svg+xml"
                  className="hidden"
                />

                {logoUrl ? (
                  <div className="flex flex-col items-center space-y-2">
                    <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-xs max-h-24 max-w-[200px] flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform">
                      <img
                        src={logoUrl}
                        alt="Logo Preview"
                        className="max-h-20 max-w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-300/50">
                      الشعار محمل ومعتمد للفواتير
                    </span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 group-hover:text-blue-600">
                      <Upload size={11} /> انقر أو اسحب صورة جديدة للتغيير
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xs">
                      <Upload size={22} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        انقر لاختيار صورة الشعار من جهازك
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        أو قم بسحب وإسقاط الصورة هنا (PNG, JPG, SVG)
                      </p>
                    </div>
                    <span className="btn-3d btn-3d-blue text-[11px] px-3.5 py-1.5 font-bold mt-1">
                      اختيار ملف الشعار
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono text-slate-900 bg-slate-50/50 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyUrl('logo')}
                    className="btn-3d btn-3d-blue text-xs px-3.5 py-2 font-bold"
                  >
                    تطبيق
                  </button>
                </div>
                {logoUrl && (
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                    <img src={logoUrl} alt="Logo" className="h-10 max-w-[100px] object-contain rounded bg-white p-1 border" />
                    <span className="text-xs text-slate-600 font-mono truncate">{logoUrl}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. OFFICIAL STAMP SECTION */}
        {(mode === 'stamp' || mode === 'both') && onStampChange && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-600" />
                ختم المنشأة وتوقيع الاعتماد (Official Stamp)
              </label>
              {stampUrl && (
                <button
                  type="button"
                  onClick={() => {
                    onStampChange('');
                    setInputStampUrl('');
                  }}
                  className="text-rose-600 hover:text-rose-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={12} />
                  حذف الختم
                </button>
              )}
            </div>

            {/* Preview Box & Upload Area */}
            {activeTab === 'upload' ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOverStamp(true); }}
                onDragLeave={() => setDragOverStamp(false)}
                onDrop={handleDropStamp}
                onClick={() => stampFileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[160px] group ${
                  dragOverStamp
                    ? 'border-purple-500 bg-purple-50/50 scale-[1.01]'
                    : stampUrl
                    ? 'border-purple-300 bg-purple-50/20 hover:border-purple-400'
                    : 'border-slate-300 bg-slate-50/70 hover:border-purple-400 hover:bg-slate-100/80'
                }`}
              >
                <input
                  type="file"
                  ref={stampFileInputRef}
                  onChange={handleStampFileChange}
                  accept="image/png, image/jpeg, image/webp, image/svg+xml"
                  className="hidden"
                />

                {stampUrl ? (
                  <div className="flex flex-col items-center space-y-2">
                    <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-xs max-h-24 max-w-[200px] flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform">
                      <img
                        src={stampUrl}
                        alt="Stamp Preview"
                        className="max-h-20 max-w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-100/80 px-2.5 py-0.5 rounded-full border border-purple-300/50">
                      الختم محمل ومعتمد للمطبوعات
                    </span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 group-hover:text-purple-600">
                      <Upload size={11} /> انقر أو اسحب صورة ختم جديدة
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xs">
                      <Upload size={22} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        انقر لاختيار صورة الختم الرسمي
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        صورة شفافة (PNG) تظهر أسفل السندات والفواتير
                      </p>
                    </div>
                    <span className="btn-3d btn-3d-purple text-[11px] px-3.5 py-1.5 font-bold mt-1">
                      اختيار ملف الختم
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://example.com/stamp.png"
                    value={inputStampUrl}
                    onChange={(e) => setInputStampUrl(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono text-slate-900 bg-slate-50/50 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyUrl('stamp')}
                    className="btn-3d btn-3d-purple text-xs px-3.5 py-2 font-bold"
                  >
                    تطبيق
                  </button>
                </div>
                {stampUrl && (
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                    <img src={stampUrl} alt="Stamp" className="h-10 max-w-[100px] object-contain rounded bg-white p-1 border" />
                    <span className="text-xs text-slate-600 font-mono truncate">{stampUrl}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info Box */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-[11px] flex items-start gap-2">
        <Info size={15} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-800 block mb-0.5">أين يظهر الشعار والختم في النظام؟</span>
          يتم تضمين الشعار تلقائياً أعلى جميع الفواتير الضريبية (Standard & Simplified ZATCA)، الفواتير الحرارية 80mm، كشوفات الحسابات، وسندات الدفع والقبض.
        </div>
      </div>
    </div>
  );
}
