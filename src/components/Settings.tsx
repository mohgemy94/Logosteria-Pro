import { useState, useEffect, type FormEvent } from 'react';
import { 
  Building2, 
  Landmark, 
  Receipt, 
  Printer, 
  Database, 
  Save, 
  CheckCircle, 
  RotateCcw, 
  AlertTriangle,
  FileText,
  Hash,
  Sliders,
  ChevronLeft,
  HardDrive
} from 'lucide-react';
import { SystemSettings } from '../types/accounting';
import { getSystemSettings, saveSystemSettings, DEFAULT_SETTINGS } from '../utils/settings';
import { SUPPORTED_CURRENCIES, getCurrencyInfo } from '../utils/currency';
import { getSequences, setCustomSequence, type SequencesStore, type SequenceType } from '../utils/sequences';
import LocalFolderBackupManager from './LocalFolderBackupManager';
import { 
  PAPER_FORMAT_LIST, 
  savePrintPaperFormat, 
  applyPrintPageStyle, 
  savePrintColorMode,
  type PrintPaperFormat,
  type PrintColorMode
} from '../utils/printPaperFormats';

type SettingsSection = 'company' | 'financial' | 'tax' | 'printing' | 'backup';

export default function Settings() {
  const [settings, setSettings] = useState<SystemSettings>(() => getSystemSettings());
  const [activeSection, setActiveSection] = useState<SettingsSection>('company');
  const [isSaved, setIsSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [seqs, setSeqs] = useState<SequencesStore>(() => getSequences());

  useEffect(() => {
    const current = getSystemSettings();
    setSettings(current);
    setSeqs(getSequences());
  }, []);

  const handleCompanyChange = (field: keyof SystemSettings['company'], value: string) => {
    setSettings(prev => ({
      ...prev,
      company: { ...prev.company, [field]: value }
    }));
    setHasChanges(true);
    setIsSaved(false);
  };

  const handleFinancialChange = (field: keyof SystemSettings['financial'], value: string | number | boolean) => {
    setSettings(prev => ({
      ...prev,
      financial: { ...prev.financial, [field]: value }
    }));
    setHasChanges(true);
    setIsSaved(false);
  };

  const handleTaxChange = (field: keyof SystemSettings['taxAndInvoice'], value: string | number | boolean) => {
    setSettings(prev => ({
      ...prev,
      taxAndInvoice: { ...prev.taxAndInvoice, [field]: value }
    }));
    setHasChanges(true);
    setIsSaved(false);
  };

  const handlePrintingChange = (field: keyof SystemSettings['printing'], value: any) => {
    setSettings(prev => {
      const updated = { ...prev, printing: { ...prev.printing, [field]: value } };
      if (field === 'defaultFormat') {
        savePrintPaperFormat(value as PrintPaperFormat, updated.printing.customPaperSize);
      }
      return updated;
    });
    setHasChanges(true);
    setIsSaved(false);
  };

  const handleSaveSettings = (e?: FormEvent) => {
    if (e) e.preventDefault();
    saveSystemSettings(settings);
    savePrintPaperFormat(settings.printing.defaultFormat, settings.printing.customPaperSize);
    applyPrintPageStyle(settings.printing.defaultFormat, settings.printing.customPaperSize);
    setIsSaved(true);
    setHasChanges(false);
    setTimeout(() => setIsSaved(false), 4000);
  };

  const handleResetToDefault = () => {
    setSettings(DEFAULT_SETTINGS);
    saveSystemSettings(DEFAULT_SETTINGS);
    setConfirmReset(false);
    setHasChanges(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // Cards definitions according to exact user prompt requirements
  const settingsCards: {
    id: SettingsSection;
    title: string;
    description: string;
    icon: typeof Building2;
    color: string;
    highlights: { label: string; value: string }[];
  }[] = [
    {
      id: 'company',
      title: 'بيانات المنشأة',
      description: 'الاسم التجاري الرسمي بالعربية والإنجليزية، الرقم الضريبي (VAT)، السجل التجاري، الفروع، والعناوين وأرقام التواصل.',
      icon: Building2,
      color: 'blue',
      highlights: [
        { label: 'الاسم:', value: settings.company.nameAr || 'غير محدد' },
        { label: 'الرقم الضريبي:', value: settings.company.taxNumber || 'غير محدد' },
        { label: 'الفرع:', value: settings.company.branchName || 'الرئيسي' },
      ]
    },
    {
      id: 'financial',
      title: 'المعايير المالية والمحاسبية',
      description: 'العملة الأساسية والرمز، الخانات العشرية، طريقة تقييم تكلفة المخزون، وتواريخ وفترات إقفال السنة المالية.',
      icon: Landmark,
      color: 'indigo',
      highlights: [
        { label: 'العملة:', value: `${settings.financial.currency} (${settings.financial.currencySymbol})` },
        { label: 'تقييم المخزون:', value: settings.financial.costMethod === 'WEIGHTED_AVG' ? 'متوسط مرجح' : settings.financial.costMethod === 'FIFO' ? 'FIFO' : 'LIFO' },
        { label: 'السنة المالية:', value: settings.financial.fiscalYear || '2024' },
      ]
    },
    {
      id: 'tax',
      title: 'الضرائب والترقيم التسلسلي',
      description: 'تفعيل حساب ضريبة القيمة المضافة، النسبة الافتراضية، باركود هيئة الزكاة (ZATCA QR)، وبادئات وأرقام التسلسل للمستندات.',
      icon: Receipt,
      color: 'emerald',
      highlights: [
        { label: 'نسبة الضريبة:', value: settings.taxAndInvoice.enableVat ? `${settings.taxAndInvoice.defaultVatRate}%` : 'معطلة' },
        { label: 'رمز QR الزكاة:', value: settings.taxAndInvoice.enableQrCode ? 'مفعل ومطابق' : 'معطل' },
        { label: 'بادئة المبيعات:', value: settings.taxAndInvoice.salesPrefix || 'INV-' },
      ]
    },
    {
      id: 'printing',
      title: 'تفضيلات الطباعة',
      description: 'المقاس الافتراضي للطباعة (A4 / A5 / رول إيصالات حراري)، إظهار الشعار والتوقيعات، وملاحظات الترويسة والتذييل.',
      icon: Printer,
      color: 'amber',
      highlights: [
        { label: 'مقاس الورق:', value: settings.printing.defaultFormat === 'RECEIPT' ? 'إيصالات حرارية 80mm' : settings.printing.defaultFormat },
        { label: 'شعار المنشأة:', value: settings.printing.showCompanyLogo ? 'مضمن في الطباعة' : 'مخفي' },
        { label: 'خانات التوقيع:', value: settings.printing.showSignatures ? 'مفعلة' : 'معطلة' },
      ]
    },
    {
      id: 'backup',
      title: 'الحفظ التلقائي في مجلد محلي والنسخ الاحتياطي',
      description: 'اختيار مجلد محلي على حاسوبك لحفظ البيانات تلقائياً، إعداد الفترات الدورية، وتصدير واسترجاع النسخ الاحتياطية الشاملة.',
      icon: Database,
      color: 'purple',
      highlights: [
        { label: 'المجلد المحلي:', value: 'حفظ تلقائي دوري' },
        { label: 'صيغة النسخ:', value: 'JSON شامل وتفصيلي' },
        { label: 'الاستعادة:', value: 'استرجاع مباشر بضغطة زر' },
      ]
    }
  ];

  return (
    <div className="flex flex-col flex-1 pb-12" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1 text-slate-500">
            <span className="text-xs uppercase font-bold tracking-tight">النظام والإدارة</span>
            <span className="text-xs">/</span>
            <span className="text-xs font-semibold text-blue-600">لوحة الإعدادات العامة</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-800">إعدادات النظام</h2>
          <p className="text-slate-500 mt-1 text-sm">
            انقر على أي بطاقة لعرض بياناتها وتعديل خياراتها في نافذة منبثقة مخصصة ومباشرة.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isSaved && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium animate-in fade-in">
              <CheckCircle size={14} className="text-emerald-600" />
              تم حفظ الإعدادات بنجاح
            </div>
          )}

          {hasChanges && !isSaved && (
            <span className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
              يوجد تعديلات غير محفوظة
            </span>
          )}

          <button
            type="button"
            onClick={() => handleSaveSettings()}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm text-sm font-semibold transition-colors cursor-pointer"
          >
            <Save size={16} />
            حفظ التغييرات
          </button>
        </div>
      </div>

      {/* Cards Grid as requested */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        {settingsCards.map((card) => {
          const Icon = card.icon;
          const isActive = activeSection === card.id;
          return (
            <div
              key={card.id}
              onClick={() => {
                setActiveSection(card.id);
                const el = document.getElementById('settings-detail-section');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`bg-white rounded-2xl p-6 border transition-all duration-200 cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
                isActive
                  ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md bg-blue-50/10'
                  : 'border-slate-200 hover:border-blue-300 hover:shadow-md'
              }`}
            >
              {/* Top Accent Line */}
              <div className={`absolute top-0 left-0 right-0 ${isActive ? 'h-1.5' : 'h-1'} bg-gradient-to-r ${
                card.color === 'blue' ? 'from-blue-500 to-cyan-500' :
                card.color === 'indigo' ? 'from-indigo-500 to-purple-500' :
                card.color === 'emerald' ? 'from-emerald-500 to-teal-500' :
                card.color === 'amber' ? 'from-amber-500 to-orange-500' :
                'from-purple-500 to-pink-500'
              }`} />

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm ${
                    card.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                    card.color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
                    card.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                    card.color === 'amber' ? 'bg-amber-50 text-amber-600' :
                    'bg-purple-50 text-purple-600'
                  }`}>
                    <Icon size={24} />
                  </div>
                  {isActive ? (
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle size={13} /> القسم المعروض حالياً
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-400 group-hover:text-blue-600 transition-colors flex items-center gap-1">
                      عرض وتعديل <ChevronLeft size={14} />
                    </span>
                  )}
                </div>

                <h3 className={`text-lg font-bold mb-2 transition-colors ${
                  isActive ? 'text-blue-700' : 'text-slate-800 group-hover:text-blue-600'
                }`}>
                  {card.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  {card.description}
                </p>
              </div>

              <div>
                {/* Live Highlights */}
                <div className="space-y-1.5 pt-3 border-t border-slate-100 mb-4 text-xs">
                  {card.highlights.map((h, i) => (
                    <div key={i} className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400 font-medium">{h.label}</span>
                      <span className="font-semibold text-slate-700 truncate max-w-[180px]">{h.value}</span>
                    </div>
                  ))}
                </div>

                <div className={`flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-bold ${
                  isActive ? 'text-blue-700' : 'text-slate-600 group-hover:text-blue-600'
                }`}>
                  <span>{isActive ? 'معروض ومتاح للتعديل في الأسفل ↓' : 'انقر لتعديل هذا القسم مباشرة ←'}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                    isActive ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-slate-100 group-hover:bg-blue-50 text-slate-600 group-hover:text-blue-700'
                  }`}>
                    {isActive ? 'القسم النشط' : 'تعديل'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Summary Overview of Current System Setup */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 border border-slate-700 shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Building2 size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                المنشأة الحالية
              </span>
              <span className="text-xs text-slate-400">
                السجل: {settings.company.commercialRegister || '—'}
              </span>
            </div>
            <h4 className="text-lg font-bold text-white">{settings.company.nameAr}</h4>
            <p className="text-xs text-slate-300 mt-0.5">
              الرقم الضريبي: <span className="font-mono text-blue-300 font-bold">{settings.company.taxNumber || 'غير مسجل'}</span> • العملة: <span className="font-bold text-emerald-400">{settings.financial.currencySymbol} ({settings.financial.currency})</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={() => {
              setActiveSection('backup');
              const el = document.getElementById('settings-detail-section');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <HardDrive size={14} className="text-emerald-400" />
            الحفظ التلقائي والنسخ الاحتياطي
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSection('company');
              const el = document.getElementById('settings-detail-section');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
          >
            <Sliders size={14} />
            تعديل بيانات المنشأة
          </button>
        </div>
      </div>

      {/* IN-LINE SETTINGS DETAIL PANEL (مدمجة مباشرة في الصفحة دون أي نافذة منبثقة) */}
      <div 
        id="settings-detail-section" 
        className="bg-white rounded-2xl shadow-sm border border-slate-200 w-full flex flex-col overflow-hidden my-6 scroll-mt-4"
      >
        {/* Panel Header */}
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl text-white flex items-center justify-center shadow-sm shrink-0 ${
              activeSection === 'company' ? 'bg-blue-600' :
              activeSection === 'financial' ? 'bg-indigo-600' :
              activeSection === 'tax' ? 'bg-emerald-600' :
              activeSection === 'printing' ? 'bg-amber-600' :
              'bg-purple-600'
            }`}>
              {activeSection === 'company' && <Building2 size={22} />}
              {activeSection === 'financial' && <Landmark size={22} />}
              {activeSection === 'tax' && <Receipt size={22} />}
              {activeSection === 'printing' && <Printer size={22} />}
              {activeSection === 'backup' && <Database size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                  تعديل تفصيلي مباشر
                </span>
                <h3 className="text-lg font-bold text-slate-800">
                  {activeSection === 'company' && 'بيانات المنشأة'}
                  {activeSection === 'financial' && 'المعايير المالية والمحاسبية'}
                  {activeSection === 'tax' && 'الضرائب والترقيم التسلسلي'}
                  {activeSection === 'printing' && 'تفضيلات الطباعة'}
                  {activeSection === 'backup' && 'إدارة البيانات والنسخ الاحتياطي'}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeSection === 'company' && 'تخصيص الاسم التجاري، الرقم الضريبي، السجل، والعناوين الرسمية'}
                {activeSection === 'financial' && 'ضبط العملة الأساسية، الخانات العشرية، وتكلفة المخزون والسنة المالية'}
                {activeSection === 'tax' && 'إعدادات ضريبة القيمة المضافة، ZATCA QR، وتنسيق أرقام التسلسل'}
                {activeSection === 'printing' && 'تحديد مقاس الطباعة، الترويسة، التذييل، والتوقيعات الرسمية'}
                {activeSection === 'backup' && 'حفظ واستعادة وتصدير ملفات النسخ الاحتياطي للنظام'}
              </p>
            </div>
          </div>

          {/* Quick tab switch buttons */}
          <div className="flex items-center gap-1.5 bg-slate-200/80 p-1.5 rounded-xl overflow-x-auto">
            {settingsCards.map((c) => {
              const CIcon = c.icon;
              const isSelected = activeSection === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveSection(c.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <CIcon size={14} />
                  <span>{c.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Panel Body */}
        <div className="p-6 md:p-8 space-y-6">

          {/* 1. بيانات المنشأة */}
          {activeSection === 'company' && (
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700">اسم المنشأة بالعربية <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={settings.company.nameAr}
                        onChange={e => handleCompanyChange('nameAr', e.target.value)}
                        placeholder="مثال: شركة لوجوستريا للتجارة"
                        className="border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700">اسم المنشأة بالإنجليزية</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={settings.company.nameEn}
                        onChange={e => handleCompanyChange('nameEn', e.target.value)}
                        placeholder="Logustria Trading Co."
                        className="border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-left"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700">الرقم الضريبي (VAT Number) <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        dir="ltr"
                        maxLength={15}
                        value={settings.company.taxNumber}
                        onChange={e => handleCompanyChange('taxNumber', e.target.value)}
                        placeholder="300000000000003"
                        className="border border-slate-200 rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-left"
                      />
                      <span className="text-[10px] text-slate-400">15 خانة يبدأ وينتهي بالرقم 3 لهيئة الزكاة والضريبة والجمارك</span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700">رقم السجل التجاري (CR)</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={settings.company.commercialRegister}
                        onChange={e => handleCompanyChange('commercialRegister', e.target.value)}
                        placeholder="1010000000"
                        className="border border-slate-200 rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-left"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700">الفرع الحالي / المركز</label>
                      <input
                        type="text"
                        value={settings.company.branchName}
                        onChange={e => handleCompanyChange('branchName', e.target.value)}
                        placeholder="الفرع الرئيسي - الرياض"
                        className="border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 bg-white"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700">رقم الهاتف / الجوال</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={settings.company.phone}
                        onChange={e => handleCompanyChange('phone', e.target.value)}
                        placeholder="+966 11 000 0000"
                        className="border border-slate-200 rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:border-blue-500 bg-white text-left"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700">البريد الإلكتروني الرسمي</label>
                      <input
                        type="email"
                        dir="ltr"
                        value={settings.company.email}
                        onChange={e => handleCompanyChange('email', e.target.value)}
                        placeholder="contact@company.com"
                        className="border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 bg-white text-left"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700">الموقع الإلكتروني</label>
                      <input
                        type="url"
                        dir="ltr"
                        value={settings.company.website}
                        onChange={e => handleCompanyChange('website', e.target.value)}
                        placeholder="https://company.com"
                        className="border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 bg-white text-left"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <h4 className="text-sm font-bold text-slate-800 mb-3">العنوان الوطني والمدينة</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1 md:col-span-2">
                        <label className="text-xs font-bold text-slate-700">اسم الشارع والحي</label>
                        <input
                          type="text"
                          value={settings.company.address}
                          onChange={e => handleCompanyChange('address', e.target.value)}
                          placeholder="طريق الملك فهد، حي الصحافة"
                          className="border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 bg-white"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-700">المدينة</label>
                        <input
                          type="text"
                          value={settings.company.city}
                          onChange={e => handleCompanyChange('city', e.target.value)}
                          placeholder="الرياض"
                          className="border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 bg-white"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-700">الرمز البريدي</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={settings.company.postalCode}
                          onChange={e => handleCompanyChange('postalCode', e.target.value)}
                          placeholder="13315"
                          className="border border-slate-200 rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:border-blue-500 bg-white text-left"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Real-time Preview */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                      <span className="text-xs font-bold text-slate-700">معاينة بطاقة المنشأة بالفواتير</span>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-semibold">
                        {settings.company.branchName || 'الفرع الرئيسي'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">الاسم العربي:</span>
                        <span className="font-bold text-slate-800">{settings.company.nameAr || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">الرقم الضريبي:</span>
                        <span className="font-mono font-bold text-blue-700">{settings.company.taxNumber || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">السجل التجاري:</span>
                        <span className="font-mono">{settings.company.commercialRegister || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">الهاتف:</span>
                        <span className="font-mono">{settings.company.phone || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. المعايير المالية والمحاسبية */}
              {activeSection === 'financial' && (
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700">العملة الأساسية للنظام</label>
                      <select
                        value={settings.financial.currency}
                        onChange={e => {
                          const val = e.target.value;
                          const currInfo = getCurrencyInfo(val);
                          setSettings(prev => ({
                            ...prev,
                            financial: { 
                              ...prev.financial, 
                              currency: val, 
                              currencySymbol: currInfo.symbol 
                            }
                          }));
                          setHasChanges(true);
                        }}
                        className="border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 bg-white font-medium"
                      >
                        {Object.values(SUPPORTED_CURRENCIES).map(curr => (
                          <option key={curr.code} value={curr.code}>
                            {curr.nameAr} ({curr.code} - {curr.symbol}) | {curr.subunitAr}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200 mt-1">
                        <span>الرمز المعتمد: <strong className="text-indigo-700 font-bold">{settings.financial.currencySymbol}</strong> ({settings.financial.currency})</span>
                        <span>فئة الكسر (التفقيط): <strong className="text-emerald-700 font-bold">{getCurrencyInfo(settings.financial.currency).subunitAr}</strong></span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700">عدد الخانات العشرية للمبالغ</label>
                      <select
                        value={settings.financial.decimalPlaces}
                        onChange={e => handleFinancialChange('decimalPlaces', Number(e.target.value))}
                        className="border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 bg-white"
                      >
                        <option value={2}>خانتان عشريتان (0.00) - افتراضي</option>
                        <option value={3}>ثلاث خانات عشرية (0.000) - للموازين والكسور الدقيقة</option>
                        <option value={0}>بدون كسور (0)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700">السنة المالية الحالية</label>
                      <input
                        type="text"
                        value={settings.financial.fiscalYear}
                        onChange={e => handleFinancialChange('fiscalYear', e.target.value)}
                        placeholder="2024"
                        className="border border-slate-200 rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:border-blue-500 bg-white"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700">طريقة تقييم تكلفة المخزون</label>
                      <select
                        value={settings.financial.costMethod}
                        onChange={e => handleFinancialChange('costMethod', e.target.value as 'FIFO' | 'WEIGHTED_AVG' | 'LIFO')}
                        className="border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 bg-white"
                      >
                        <option value="WEIGHTED_AVG">المتوسط المرجح للتكلفة (Weighted Average) - المعيار الدولي</option>
                        <option value="FIFO">الوارد أولاً صادر أولاً (FIFO)</option>
                        <option value="LIFO">الوارد أخيراً صادر أولاً (LIFO)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700">تاريخ بداية السنة المالية</label>
                      <input
                        type="date"
                        value={settings.financial.fiscalYearStart}
                        onChange={e => handleFinancialChange('fiscalYearStart', e.target.value)}
                        className="border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 bg-white"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700">تاريخ نهاية السنة المالية</label>
                      <input
                        type="date"
                        value={settings.financial.fiscalYearEnd}
                        onChange={e => handleFinancialChange('fiscalYearEnd', e.target.value)}
                        className="border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 bg-white"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-5 flex flex-col gap-3">
                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">ضوابط الإقفال والعمليات</h4>

                    <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.financial.isFiscalYearClosed}
                        onChange={e => handleFinancialChange('isFiscalYearClosed', e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800">إقفال السنة المالية (منع الترحيل والتعديل)</span>
                        <span className="text-xs text-slate-500">عند تفعيل الإقفال، سيتم منع إضافة أو ترحيل قيود يومية جديدة لهذه الفترة المالية.</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.financial.allowNegativeStock}
                        onChange={e => handleFinancialChange('allowNegativeStock', e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800">السماح بالصرف بالسالب للمخزون</span>
                        <span className="text-xs text-slate-500">إتاحة تسجيل فواتير مبيعات حتى لو كان الرصيد المخزني الحالي للمادة صفراً.</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* 3. الضرائب والترقيم التسلسلي */}
              {activeSection === 'tax' && (
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-4">
                      <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.taxAndInvoice.enableVat}
                          onChange={e => handleTaxChange('enableVat', e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800">تفعيل حساب ضريبة القيمة المضافة (VAT)</span>
                          <span className="text-xs text-slate-500">احتساب الضريبة آلياً على فواتير البيع والشراء والسندات.</span>
                        </div>
                      </label>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-700">نسبة الضريبة الافتراضية (%)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={settings.taxAndInvoice.defaultVatRate}
                            onChange={e => handleTaxChange('defaultVatRate', parseFloat(e.target.value) || 0)}
                            className="border border-slate-200 rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:border-blue-500 w-32 bg-white"
                          />
                          <span className="text-sm font-bold text-slate-600">%</span>
                          <span className="text-xs text-slate-400 mr-2">(15% هو المعدل الأساسي لهيئة الزكاة والضريبة)</span>
                        </div>
                      </div>

                      <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.taxAndInvoice.enableQrCode}
                          onChange={e => handleTaxChange('enableQrCode', e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800">توليد رمز الاستجابة السريعة (ZATCA QR Code)</span>
                          <span className="text-xs text-slate-500">طباعة QR مشفر بالفاتورة متوافق مع هيئة الزكاة والضريبة.</span>
                        </div>
                      </label>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-3">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        بادئات الترقيم التسلسلي للمستندات (Prefixes)
                      </h4>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-600">فواتير المبيعات</label>
                          <input
                            type="text"
                            dir="ltr"
                            value={settings.taxAndInvoice.salesPrefix}
                            onChange={e => handleTaxChange('salesPrefix', e.target.value)}
                            className="border border-slate-200 rounded p-2 text-xs font-mono bg-white"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-600">فواتير المشتريات</label>
                          <input
                            type="text"
                            dir="ltr"
                            value={settings.taxAndInvoice.purchasePrefix}
                            onChange={e => handleTaxChange('purchasePrefix', e.target.value)}
                            className="border border-slate-200 rounded p-2 text-xs font-mono bg-white"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-600">قيود اليومية</label>
                          <input
                            type="text"
                            dir="ltr"
                            value={settings.taxAndInvoice.journalPrefix}
                            onChange={e => handleTaxChange('journalPrefix', e.target.value)}
                            className="border border-slate-200 rounded p-2 text-xs font-mono bg-white"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-600">سندات القبض</label>
                          <input
                            type="text"
                            dir="ltr"
                            value={settings.taxAndInvoice.receiptVoucherPrefix}
                            onChange={e => handleTaxChange('receiptVoucherPrefix', e.target.value)}
                            className="border border-slate-200 rounded p-2 text-xs font-mono bg-white"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-600">سندات الصرف</label>
                          <input
                            type="text"
                            dir="ltr"
                            value={settings.taxAndInvoice.paymentVoucherPrefix}
                            onChange={e => handleTaxChange('paymentVoucherPrefix', e.target.value)}
                            className="border border-slate-200 rounded p-2 text-xs font-mono bg-white"
                          />
                        </div>
                      </div>

                      <span className="text-[11px] text-slate-500 mt-1">
                        مثال للرقم المتولد: <span className="font-mono font-bold text-blue-600">{settings.taxAndInvoice.salesPrefix}2024-00142</span>
                      </span>
                    </div>
                  </div>

                  {/* Sequential Counters Control */}
                  <div className="border-t border-slate-200 pt-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <Hash size={16} className="text-blue-600" />
                          أرقام التسلسل الحالية للمستندات (الترقيم التلقائي)
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          الرقم التالي الذي سيتم توليده تلقائياً لكل نوع مستند عند الإضافة. يمكنك تعديل الرقم يدوياً.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("هل أنت متأكد من إعادة ضبط جميع عدادات الترقيم التسلسلي لتبدأ من 1؟")) {
                            (['itemCode', 'salesInvoice', 'purchaseInvoice', 'receiptVoucher', 'paymentVoucher', 'internalVoucher'] as SequenceType[]).forEach(k => {
                              setCustomSequence(k, 1);
                            });
                            setSeqs(getSequences());
                            alert("تمت إعادة ضبط عدادات التسلسل إلى 1 بنجاح!");
                          }
                        }}
                        className="text-xs text-red-600 hover:text-red-700 font-medium px-2.5 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        إعادة ضبط للرقم 1
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col gap-1">
                        <span className="text-[11px] font-bold text-slate-600">كود الأصناف الجديدة</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs text-slate-400 font-mono">#</span>
                          <input
                            type="number"
                            min="1"
                            value={seqs.itemCode || 1}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 1;
                              setCustomSequence('itemCode', val);
                              setSeqs(getSequences());
                            }}
                            className="w-full bg-white border border-slate-200 rounded p-1.5 text-sm font-mono font-bold text-slate-800 text-center focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col gap-1">
                        <span className="text-[11px] font-bold text-slate-600">فواتير المبيعات</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs text-slate-400 font-mono">#</span>
                          <input
                            type="number"
                            min="1"
                            value={seqs.salesInvoice}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 1;
                              setCustomSequence('salesInvoice', val);
                              setSeqs(getSequences());
                            }}
                            className="w-full bg-white border border-slate-200 rounded p-1.5 text-sm font-mono font-bold text-slate-800 text-center focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col gap-1">
                        <span className="text-[11px] font-bold text-slate-600">فواتير المشتريات</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs text-slate-400 font-mono">#</span>
                          <input
                            type="number"
                            min="1"
                            value={seqs.purchaseInvoice}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 1;
                              setCustomSequence('purchaseInvoice', val);
                              setSeqs(getSequences());
                            }}
                            className="w-full bg-white border border-slate-200 rounded p-1.5 text-sm font-mono font-bold text-slate-800 text-center focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col gap-1">
                        <span className="text-[11px] font-bold text-slate-600">سندات القبض</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs text-slate-400 font-mono">#</span>
                          <input
                            type="number"
                            min="1"
                            value={seqs.receiptVoucher}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 1;
                              setCustomSequence('receiptVoucher', val);
                              setSeqs(getSequences());
                            }}
                            className="w-full bg-white border border-slate-200 rounded p-1.5 text-sm font-mono font-bold text-slate-800 text-center focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col gap-1">
                        <span className="text-[11px] font-bold text-slate-600">سندات الصرف</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs text-slate-400 font-mono">#</span>
                          <input
                            type="number"
                            min="1"
                            value={seqs.paymentVoucher}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 1;
                              setCustomSequence('paymentVoucher', val);
                              setSeqs(getSequences());
                            }}
                            className="w-full bg-white border border-slate-200 rounded p-1.5 text-sm font-mono font-bold text-slate-800 text-center focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col gap-1">
                        <span className="text-[11px] font-bold text-slate-600">التحويل الداخلي</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs text-slate-400 font-mono">#</span>
                          <input
                            type="number"
                            min="1"
                            value={seqs.internalVoucher}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 1;
                              setCustomSequence('internalVoucher', val);
                              setSeqs(getSequences());
                            }}
                            className="w-full bg-white border border-slate-200 rounded p-1.5 text-sm font-mono font-bold text-slate-800 text-center focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. تفضيلات الطباعة */}
              {activeSection === 'printing' && (
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-xs font-bold text-slate-700">المقاس الافتراضي للطباعة المباشرة والمثبت بالنظام</label>
                      <select
                        value={settings.printing.defaultFormat}
                        onChange={e => handlePrintingChange('defaultFormat', e.target.value as PrintPaperFormat)}
                        className="border border-slate-200 rounded-lg p-2.5 text-sm font-bold focus:outline-none focus:border-blue-500 bg-white"
                      >
                        {PAPER_FORMAT_LIST.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.label} - {p.description}
                          </option>
                        ))}
                      </select>

                      {settings.printing.defaultFormat === 'CUSTOM' && (
                        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">عرض الورق (سم):</label>
                            <input
                              type="number"
                              step="0.1"
                              min="2"
                              value={settings.printing.customPaperSize?.widthCm || 21}
                              onChange={e => {
                                const w = parseFloat(e.target.value) || 21;
                                const curH = settings.printing.customPaperSize?.heightCm || 29.7;
                                handlePrintingChange('customPaperSize', { widthCm: w, heightCm: curH });
                              }}
                              className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">طول الورق (سم):</label>
                            <input
                              type="number"
                              step="0.1"
                              min="2"
                              value={settings.printing.customPaperSize?.heightCm || 29.7}
                              onChange={e => {
                                const curW = settings.printing.customPaperSize?.widthCm || 21;
                                const h = parseFloat(e.target.value) || 29.7;
                                handlePrintingChange('customPaperSize', { widthCm: curW, heightCm: h });
                              }}
                              className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold bg-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-xs font-bold text-slate-700">درجة وضوح ألوان الطباعة الافتراضية للفواتير والسندات</label>
                      <select
                        value={settings.printing.colorMode || 'bw'}
                        onChange={e => {
                          const mode = e.target.value as PrintColorMode;
                          handlePrintingChange('colorMode', mode);
                          savePrintColorMode(mode);
                        }}
                        className="border border-slate-200 rounded-lg p-2.5 text-sm font-bold focus:outline-none focus:border-blue-500 bg-white"
                      >
                        <option value="bw">أبيض وأسود فائق الوضوح (الموصى به لطباعة نقية وتباين حاد على الورق بدون بهتان)</option>
                        <option value="color">نمط ألوان عادي (مع بقاء الألوان الأصلية)</option>
                      </select>
                      <span className="text-[11px] text-slate-500">
                        النمط الأبيض والأسود يحوّل النصوص والجداول إلى أسود نقي 100% ويضبط الترويسة والشعار لضمان خروج الورقة مقروءة بأعلى جودة على جميع الطابعات العادية والحرارية.
                      </span>
                    </div>

                    <div className="flex items-center gap-6 pt-5">
                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.printing.showCompanyLogo}
                          onChange={e => handlePrintingChange('showCompanyLogo', e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        إظهار شعار المنشأة في الترويسة
                      </label>

                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.printing.showSignatures}
                          onChange={e => handlePrintingChange('showSignatures', e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        تضمين خانات الاعتماد والتوقيعات
                      </label>
                    </div>

                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-xs font-bold text-slate-700">ملاحظة الترويسة العلوية (Header Notes)</label>
                      <input
                        type="text"
                        value={settings.printing.headerNotes}
                        onChange={e => handlePrintingChange('headerNotes', e.target.value)}
                        placeholder="فاتورة ضريبية رسمية..."
                        className="border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 bg-white"
                      />
                    </div>

                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-xs font-bold text-slate-700">الشروط والأحكام أسفل المستند (Footer Terms & Notes)</label>
                      <textarea
                        rows={3}
                        value={settings.printing.footerNotes}
                        onChange={e => handlePrintingChange('footerNotes', e.target.value)}
                        placeholder="البضاعة المباعة لا ترد ولا تستبدل بعد 7 أيام..."
                        className="border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 bg-white resize-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      <FileText size={14} />
                      معاينة وطباعة صفحة تجريبية
                    </button>
                  </div>
                </div>
              )}

              {/* 5. إدارة البيانات والنسخ الاحتياطي والحفظ في مجلد محلي */}
              {activeSection === 'backup' && (
                <div className="flex flex-col gap-8">
                  {/* Comprehensive Local Folder Auto-Save Manager */}
                  <LocalFolderBackupManager />

                  {/* Reset Section */}
                  <div className="border border-red-200 bg-red-50/40 p-5 rounded-2xl">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center shrink-0">
                        <AlertTriangle size={20} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-sm text-red-800 mb-1">استعادة ضبط المصنع الافتراضي</h4>
                        <p className="text-xs text-red-600 mb-4 leading-relaxed">
                          سيؤدي هذا الإجراء إلى إعادة تعيين جميع إعدادات النظام، بيانات المنشأة، والمعايير المحاسبية إلى القيم الافتراضية الأولية.
                        </p>

                        {confirmReset ? (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleResetToDefault}
                              className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer"
                            >
                              تأكيد استعادة الافتراضي الآن
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmReset(false)}
                              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmReset(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-red-300 text-red-700 hover:bg-red-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          >
                            <RotateCcw size={14} />
                            استعادة الإعدادات الافتراضية
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
        </div>

        {/* Panel Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            {hasChanges && (
              <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 inline-flex items-center gap-1.5">
                ● يوجد تعديلات غير محفوظة
              </span>
            )}
            {isSaved && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                <CheckCircle size={14} /> تم حفظ التعديلات بنجاح
              </span>
            )}
            {!hasChanges && !isSaved && (
              <span className="text-xs text-slate-400">
                يتم تطبيق الإعدادات المحفوظة فوراً على جميع فواتير وسندات وتقارير النظام
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSaveSettings()}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer hover:shadow"
            >
              <Save size={15} />
              حفظ التغييرات
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
