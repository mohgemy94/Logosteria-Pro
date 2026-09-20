import { useState } from 'react';
import { Printer, Palette, Type, FileText, Check } from 'lucide-react';
import { SystemSettings, BrandingSettings } from '../types/accounting';
import { PAPER_FORMAT_LIST } from '../utils/printPaperFormats';
import CompanyLogoUploader from './CompanyLogoUploader';

interface PrintingBrandingPanelProps {
  settings: SystemSettings;
  onPrintingChange: (field: keyof SystemSettings['printing'], value: any) => void;
  onBrandingChange: (branding: BrandingSettings) => void;
  onCompanyChange?: (field: keyof SystemSettings['company'], value: string) => void;
}

const BRAND_COLOR_PRESETS = [
  { name: 'كحلي داكن كلاسيكي', hex: '#1e293b' },
  { name: 'أزرق ملكي عصري', hex: '#2563eb' },
  { name: 'زمردي مالي احترافي', hex: '#0f766e' },
  { name: 'أرجواني ملكي', hex: '#7c3aed' },
  { name: 'عنبري ذهبي', hex: '#b45309' },
  { name: 'رمادي غامق محايد', hex: '#334155' },
];

const FONT_OPTIONS: Array<{ id: BrandingSettings['fontFamily']; label: string; sample: string }> = [
  { id: 'Tajawal', label: 'خط تجوال (Tajawal) - افتراضي مالي حديث', sample: 'نظام لوجوستريا المحاسبي الشامل 12345' },
  { id: 'Cairo', label: 'خط كاييرو (Cairo) - هندسي واضح', sample: 'نظام لوجوستريا المحاسبي الشامل 12345' },
  { id: 'Amiri', label: 'خط أميري (Amiri) - كلاسيكي رسمي', sample: 'نظام لوجوستريا المحاسبي الشامل 12345' },
  { id: 'Arial', label: 'خط آريال (Arial) - قياسي عالمي', sample: 'نظام لوجوستريا المحاسبي الشامل 12345' },
];

export default function PrintingBrandingPanel({
  settings,
  onPrintingChange,
  onBrandingChange,
  onCompanyChange
}: PrintingBrandingPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'formats' | 'branding' | 'notes'>('formats');

  const branding = settings.branding || {
    primaryColor: '#1e293b',
    fontFamily: 'Tajawal',
    showTermsAndConditions: true,
    termsText: 'البضاعة المباعة لا ترد ولا تستبدل بعد 7 أيام من تاريخ الاستلام. تسري هذه الفاتورة كوثيقة إثبات رسمية.',
    stampUrl: '',
    invoiceTitleAr: 'فاتورة ضريبية رسمية',
  };

  const handleBrandingField = <K extends keyof BrandingSettings>(field: K, val: BrandingSettings[K]) => {
    onBrandingChange({
      ...branding,
      [field]: val,
    });
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveSubTab('formats')}
          className={`btn-3d px-4 py-2 text-xs font-bold flex items-center gap-2 ${
            activeSubTab === 'formats'
              ? 'btn-3d-amber'
              : 'btn-3d-white text-slate-700'
          }`}
        >
          <Printer size={15} />
          مقاسات وتهيئات الطباعة (A4 / A5 / حراري)
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('branding')}
          className={`btn-3d px-4 py-2 text-xs font-bold flex items-center gap-2 ${
            activeSubTab === 'branding'
              ? 'btn-3d-purple'
              : 'btn-3d-white text-slate-700'
          }`}
        >
          <Palette size={15} />
          الهوية البصرية والألوان والخطوط
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('notes')}
          className={`btn-3d px-4 py-2 text-xs font-bold flex items-center gap-2 ${
            activeSubTab === 'notes'
              ? 'btn-3d-blue'
              : 'btn-3d-white text-slate-700'
          }`}
        >
          <FileText size={15} />
          الترويسة والتذييل والشروط
        </button>
      </div>

      {/* SUB-TAB 1: FORMATS */}
      {activeSubTab === 'formats' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h4 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Printer size={16} className="text-amber-600" />
              المقاس الافتراضي للورق والمطبوعات
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {PAPER_FORMAT_LIST.map(fmt => {
                const isSelected = settings.printing.defaultFormat === fmt.id;
                return (
                  <div
                    key={fmt.id}
                    onClick={() => onPrintingChange('defaultFormat', fmt.id)}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/50 shadow-xs ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-white hover:border-amber-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-xs text-slate-900">{fmt.label}</span>
                        {isSelected && <Check size={14} className="text-amber-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500">{fmt.description}</p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
                      {fmt.widthMm}mm {fmt.heightMm ? `× ${fmt.heightMm}mm` : '(رول مستمر)'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h4 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Palette size={16} className="text-indigo-600" />
              نمط ألوان الطباعة
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="colorMode"
                  value="color"
                  checked={settings.printing.colorMode === 'color'}
                  onChange={() => onPrintingChange('colorMode', 'color')}
                  className="text-indigo-600"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900">طباعة ملونة كاملة (Full Color)</p>
                  <p className="text-[11px] text-slate-500">استخدام الألوان المؤسسية والشعار الملون</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="colorMode"
                  value="bw"
                  checked={settings.printing.colorMode === 'bw'}
                  onChange={() => onPrintingChange('colorMode', 'bw')}
                  className="text-indigo-600"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900">أبيض وأسود عالي التباين (Black & White)</p>
                  <p className="text-[11px] text-slate-500">موفر للحبر ومثالي للطابعات الليزرية والحرارية</p>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: BRANDING & FONTS */}
      {activeSubTab === 'branding' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Logo & Stamp Uploader */}
          {onCompanyChange && (
            <CompanyLogoUploader
              logoUrl={settings.company.logoUrl || ''}
              onLogoChange={(url) => onCompanyChange('logoUrl', url)}
              stampUrl={settings.company.stampUrl || ''}
              onStampChange={(url) => onCompanyChange('stampUrl', url)}
              title="تحميل شعار وختم المنشأة للمطبوعات"
              mode="both"
            />
          )}
          {/* Brand Color */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h4 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Palette size={16} className="text-purple-600" />
              اللون المؤسسي المعتمد للترويسة والمطبوعات
            </h4>

            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                اختر لون الترويسة والجداول للفواتير والمطبوعات الرسمية:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {BRAND_COLOR_PRESETS.map(preset => {
                  const isSelected = branding.primaryColor.toLowerCase() === preset.hex.toLowerCase();
                  return (
                    <div
                      key={preset.hex}
                      onClick={() => handleBrandingField('primaryColor', preset.hex)}
                      className={`p-3 rounded-xl border-2 cursor-pointer flex flex-col items-center text-center gap-2 transition-all ${
                        isSelected ? 'border-purple-600 bg-purple-50 shadow-xs ring-2 ring-purple-600/20' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full shadow-inner border border-white" style={{ backgroundColor: preset.hex }} />
                      <span className="text-[11px] font-bold text-slate-800">{preset.name}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <span className="text-xs font-bold text-slate-700">أو أدخل كود اللون المخصص (Hex):</span>
                <input
                  type="text"
                  value={branding.primaryColor}
                  onChange={e => handleBrandingField('primaryColor', e.target.value)}
                  className="w-28 px-3 py-1 text-xs bg-white border border-slate-300 rounded font-mono font-bold uppercase"
                />
                <div className="w-6 h-6 rounded border border-slate-300" style={{ backgroundColor: branding.primaryColor }} />
              </div>
            </div>
          </div>

          {/* Typography */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h4 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Type size={16} className="text-blue-600" />
              الخط العربي المعتمد في المطبوعات الرسمية
            </h4>

            <div className="space-y-3">
              {FONT_OPTIONS.map(font => {
                const isSelected = branding.fontFamily === font.id;
                return (
                  <label
                    key={font.id}
                    onClick={() => handleBrandingField('fontFamily', font.id)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-blue-200 bg-white'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900">{font.label}</p>
                      <p className="text-xs text-slate-500 mt-1" style={{ fontFamily: font.id }}>
                        {font.sample}
                      </p>
                    </div>
                    {isSelected && <Check size={16} className="text-blue-600" />}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: HEADER, FOOTER, TERMS */}
      {activeSubTab === 'notes' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h4 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <FileText size={16} className="text-blue-600" />
              ملاحظات الترويسة والتذييل وخانات التوقيع
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="text-xs font-bold text-slate-800">إظهار شعار المنشأة الرسمي</p>
                  <p className="text-[11px] text-slate-500">تضمين الشعار في الترويسة العلوية للمطبوعات</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.printing.showCompanyLogo}
                  onChange={e => onPrintingChange('showCompanyLogo', e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="text-xs font-bold text-slate-800">إظهار خانات التوقيع والاعتماد</p>
                  <p className="text-[11px] text-slate-500">إضافة خانات توقيع (المستلم، المحاسب، المدير)</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.printing.showSignatures}
                  onChange={e => onPrintingChange('showSignatures', e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظة الترويسة العلوية (Header Note)</label>
              <input
                type="text"
                value={settings.printing.headerNotes}
                onChange={e => onPrintingChange('headerNotes', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظة التذييل السفلية (Footer Note)</label>
              <textarea
                rows={2}
                value={settings.printing.footerNotes}
                onChange={e => onPrintingChange('footerNotes', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-800">الشروط والأحكام أسفل الفاتورة</label>
                <input
                  type="checkbox"
                  checked={branding.showTermsAndConditions}
                  onChange={e => handleBrandingField('showTermsAndConditions', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
                />
              </div>
              {branding.showTermsAndConditions && (
                <textarea
                  rows={2}
                  value={branding.termsText}
                  onChange={e => handleBrandingField('termsText', e.target.value)}
                  placeholder="نص الشروط والأحكام وسياسة الاسترجاع والضمان..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
