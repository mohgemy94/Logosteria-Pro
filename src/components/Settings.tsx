import { useState, useEffect, type FormEvent } from 'react';
import { 
  Building2, 
  Landmark, 
  Receipt, 
  Printer, 
  Database, 
  Save, 
  CheckCircle, 
  Users,
  HardDrive,
  ShieldCheck,
  ShieldAlert,
  ChevronLeft,
  X,
  RotateCcw,
  Download,
  AlertTriangle,
  CheckCircle2,
  Monitor
} from 'lucide-react';
import MobilePermissionsModal from './MobilePermissionsModal';
import { SystemSettings, CurrencySetting, UserPermission, CreditAndStockControlSettings, BrandingSettings } from '../types/accounting';
import { getSystemSettings, saveSystemSettings, DEFAULT_SETTINGS } from '../utils/settings';
import { getSequences, type SequencesStore } from '../utils/sequences';
import { 
  resetEntireSystemToFactoryDefaults, 
  resetTransactionsOnly, 
  downloadSystemBackupJSON, 
  type ResetSummary, 
  type ResetType 
} from '../utils/systemReset';
import LocalFolderBackupManager from './LocalFolderBackupManager';
import DriveSyncSettingsCard from './DriveSyncSettingsCard';
import MasterDatabaseSettings from './MasterDatabaseSettings';
import AccountEngineTester from './AccountEngineTester';
import ApprovalWorkflowSettingsPanel from './ApprovalWorkflowSettingsPanel';
import CurrencySettingsPanel from './CurrencySettingsPanel';
import InvoicingControlPanel from './InvoicingControlPanel';
import PrintingBrandingPanel from './PrintingBrandingPanel';
import UsersPermissionsPanel from './UsersPermissionsPanel';
import CompanyLogoUploader from './CompanyLogoUploader';
import { 
  savePrintPaperFormat, 
  applyPrintPageStyle, 
  type PrintPaperFormat 
} from '../utils/printPaperFormats';

type SettingsPortal = 
  | 'company' 
  | 'financial_currency' 
  | 'invoicing_control' 
  | 'printing_branding' 
  | 'backup_cloud' 
  | 'users_permissions' 
  | 'master_data_engine' 
  | 'approvals_and_reset'
  | 'mobile_permissions';

interface SettingsProps {
  onNavigateToDashboard?: () => void;
}

export default function Settings({ onNavigateToDashboard }: SettingsProps = {}) {
  const [settings, setSettings] = useState<SystemSettings>(() => getSystemSettings());
  const [activeSection, setActiveSection] = useState<SettingsPortal | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<ResetSummary | null>(null);
  const [seqs, setSeqs] = useState<SequencesStore>(() => getSequences());

  // Modal and Security States for 2-Tier Factory Reset / Clear Data
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedResetType, setSelectedResetType] = useState<ResetType>('TRANSACTIONS_ONLY');
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isBackupDownloaded, setIsBackupDownloaded] = useState(false);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [isExecutingReset, setIsExecutingReset] = useState(false);

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

  const handleCurrenciesChange = (currencies: CurrencySetting[]) => {
    setSettings(prev => ({
      ...prev,
      currencies
    }));
    setHasChanges(true);
    setIsSaved(false);
  };

  const handleBaseCurrencyChange = (baseCode: string) => {
    setSettings(prev => {
      const target = prev.currencies?.find(c => c.code === baseCode);
      return {
        ...prev,
        financial: {
          ...prev.financial,
          currency: baseCode,
          currencySymbol: target?.symbol || baseCode
        }
      };
    });
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

  const handleInvoiceDefaultsChange = (field: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      invoiceDefaults: {
        ...(prev.invoiceDefaults || DEFAULT_SETTINGS.invoiceDefaults!),
        [field]: value
      }
    }));
    setHasChanges(true);
    setIsSaved(false);
  };

  const handleControlLimitsChange = (control: CreditAndStockControlSettings) => {
    setSettings(prev => ({
      ...prev,
      controlAndLimits: control
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

  const handleBrandingChange = (branding: BrandingSettings) => {
    setSettings(prev => ({
      ...prev,
      branding
    }));
    setHasChanges(true);
    setIsSaved(false);
  };

  const handleUsersChange = (users: UserPermission[]) => {
    setSettings(prev => ({
      ...prev,
      users
    }));
    setHasChanges(true);
    setIsSaved(false);
  };

  const handleApprovalWorkflowChange = (field: keyof NonNullable<SystemSettings['approvalWorkflow']>, value: any) => {
    setSettings(prev => ({
      ...prev,
      approvalWorkflow: {
        ...(prev.approvalWorkflow || DEFAULT_SETTINGS.approvalWorkflow!),
        [field]: value
      }
    }));
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

  const openResetModal = (type: ResetType) => {
    setSelectedResetType(type);
    setConfirmationInput('');
    setIsBackupDownloaded(false);
    setShowResetModal(true);
  };

  const handleDownloadBackup = () => {
    setIsDownloadingBackup(true);
    const ok = downloadSystemBackupJSON();
    if (ok) {
      setIsBackupDownloaded(true);
    }
    setIsDownloadingBackup(false);
  };

  const normalizedInput = confirmationInput.trim().toUpperCase();
  const isConfirmationValid = normalizedInput === 'تصفير' || normalizedInput === 'RESET';

  const handleExecuteReset = () => {
    if (!isConfirmationValid) return;
    setIsExecutingReset(true);

    try {
      let summary: ResetSummary;
      if (selectedResetType === 'TRANSACTIONS_ONLY') {
        summary = resetTransactionsOnly();
      } else {
        summary = resetEntireSystemToFactoryDefaults();
      }

      setResetFeedback(summary);
      setShowResetModal(false);
      setSettings(getSystemSettings());
      setSeqs(getSequences());

      window.dispatchEvent(new CustomEvent('alpha-system-reset-completed', {
        detail: {
          summary,
          title: selectedResetType === 'TRANSACTIONS_ONLY' ? 'تم تصفير العمليات والفواتير' : 'تمت استعادة ضبط المصنع بالكامل',
          message: selectedResetType === 'TRANSACTIONS_ONLY' ? 'تم تصفير القيود والفواتير بنجاح' : 'تمت إعادة ضبط المصنع ومسح كافة السجلات'
        }
      }));
    } catch (err: any) {
      alert(`حدث خطأ أثناء تنفيذ عملية التصفير: ${err?.message || 'خطأ غير معروف'}`);
    } finally {
      setIsExecutingReset(false);
    }
  };

  // 8 Non-redundant unified portals
  const settingsPortals = [
    {
      id: 'company' as SettingsPortal,
      title: 'بيانات المنشأة والهوية المؤسسية',
      description: 'الاسم الرسمي بالعربية والإنجليزية، السجل التجاري، الرقم الضريبي، بيانات الاتصال، الفروع، وشعار وختم المنشأة.',
      icon: Building2,
      color: 'blue',
      highlights: [
        { label: 'المنشأة:', value: settings.company.nameAr || 'لوجوستريا' },
        { label: 'الرقم الضريبي:', value: settings.company.taxNumber || 'غير مسجل' },
        { label: 'الفرع الرئيسي:', value: settings.company.branchName || 'الرياض' },
      ]
    },
    {
      id: 'financial_currency' as SettingsPortal,
      title: 'المعايير المحاسبية والعملات المتعددة',
      description: 'السنة المالية وفترات الإقفال، تقييم المخزون (متوسط مرجح/FIFO)، الخانات العشرية، وجدول أسعار صرف العملات الأجنبية.',
      icon: Landmark,
      color: 'indigo',
      highlights: [
        { label: 'العملة الأساسية:', value: `${settings.financial.currency} (${settings.financial.currencySymbol})` },
        { label: 'تقييم المخزون:', value: settings.financial.costMethod === 'WEIGHTED_AVG' ? 'متوسط مرجح' : settings.financial.costMethod === 'FIFO' ? 'FIFO' : 'LIFO' },
        { label: 'العملات النشطة:', value: `${(settings.currencies || []).filter(c => c.isEnabled).length} عملات مسجلة` },
      ]
    },
    {
      id: 'invoicing_control' as SettingsPortal,
      title: 'الفوترة والضرائب والرقابة الائتمانية',
      description: 'ضريبة 15%، باركود هيئة الزكاة (ZATCA QR)، بادئات الترقيم، القيم الافتراضية، وفحص الحد الائتماني ومنع البيع بالسالب.',
      icon: Receipt,
      color: 'emerald',
      highlights: [
        { label: 'الضريبة (VAT):', value: settings.taxAndInvoice.enableVat ? `${settings.taxAndInvoice.defaultVatRate}%` : 'معطلة' },
        { label: 'باركود ZATCA:', value: settings.taxAndInvoice.enableQrCode ? 'مفعل ومطابق' : 'معطل' },
        { label: 'الحد الائتماني:', value: settings.controlAndLimits?.enforceCreditLimit ? `مفعل (${settings.controlAndLimits.creditLimitAction === 'BLOCK' ? 'حظر' : 'تحذير'})` : 'غير مقيد' },
      ]
    },
    {
      id: 'printing_branding' as SettingsPortal,
      title: 'قوالب وتفضيلات الطباعة والهوية',
      description: 'مقاس الورق (A4 / A5 / رول حراري 80mm)، اللون المؤسسي، اختيار الخط العربي، الترويسة والتذييل، والشروط والأحكام.',
      icon: Printer,
      color: 'amber',
      highlights: [
        { label: 'مقاس المطبوعات:', value: settings.printing.defaultFormat === 'RECEIPT' ? 'إيصالات حرارية 80mm' : settings.printing.defaultFormat },
        { label: 'اللون المؤسسي:', value: settings.branding?.primaryColor || '#1e293b' },
        { label: 'الخط العربي:', value: settings.branding?.fontFamily || 'Tajawal' },
      ]
    },
    {
      id: 'backup_cloud' as SettingsPortal,
      title: 'النسخ الاحتياطي والمزامنة السحابية',
      description: 'الحفظ التلقائي في مجلد محلي، تصدير واسترجاع JSON، والمزامنة السحابية عبر Google Drive واقتران نقاط البيع بـ QR.',
      icon: Database,
      color: 'sky',
      highlights: [
        { label: 'الحفظ المحلي:', value: 'حفظ دوري للمجلد' },
        { label: 'المزامنة السحابية:', value: 'Google Drive Sync' },
        { label: 'اقتران الأجهزة:', value: 'كود QR آمن' },
      ]
    },
    {
      id: 'users_permissions' as SettingsPortal,
      title: 'إدارة المستخدمين ومصفوفة الصلاحيات (RBAC)',
      description: 'حسابات المستخدمين والأدوار (مدير، محاسب، كاشير، أمين مستودع، مدقق) ومصفوفة أذونات الإضافة والتعديل والحذف والترحيل.',
      icon: Users,
      color: 'purple',
      highlights: [
        { label: 'المستخدمون:', value: `${(settings.users || []).length} حسابات` },
        { label: 'المصفوفة:', value: 'تحكم دقيق بالعمليات' },
        { label: 'الأدوار:', value: '5 مستويات وظيفية' },
      ]
    },
    {
      id: 'master_data_engine' as SettingsPortal,
      title: 'الجداول التعريفية ومحرك الحسابات',
      description: 'قواعد البيانات الأساسية (الإدارات، الوظائف، المخازن، المناطق)، توليد الأكواد التحليلية م5، وفحص التوازن الذري.',
      icon: HardDrive,
      color: 'cyan',
      highlights: [
        { label: 'الجداول التعريفية:', value: '11 قاعدة مرجعية' },
        { label: 'محرك الحسابات:', value: 'توليد وفحص ذري' },
        { label: 'الدليل المحاسبي:', value: 'ربط مباشر بالشجرة' },
      ]
    },
    {
      id: 'approvals_and_reset' as SettingsPortal,
      title: 'الرقابة الإدارية ودورة الاعتماد والتصفير',
      description: 'هرمية اعتماد السندات الكبيرة (محاسب -> مدير مالي -> مدير عام)، وتصفير العمليات الآمن وضبط المصنع مع ضمانات الحماية.',
      icon: ShieldCheck,
      color: 'rose',
      highlights: [
        { label: 'دورة الاعتماد:', value: settings.approvalWorkflow?.enabled ? 'مفعلة' : 'معطلة' },
        { label: 'حد الاعتماد:', value: `${(settings.approvalWorkflow?.minAmountThreshold || 5000).toLocaleString()} ر.س` },
        { label: 'ضبط المصنع:', value: 'حماية وتأكيد أمني' },
      ]
    },
    {
      id: 'mobile_permissions' as SettingsPortal,
      title: 'أذونات سطح المكتب والموبايل (Desktop & Mobile)',
      description: 'إدارة وتفعيل أذونات سطح المكتب (المجلد الصامت، الميكروفون، التخزين الدائم، الطباعة المباشرة) وأذونات الموبايل (الكاميرا، البلوتوث، الموقع).',
      icon: Monitor,
      color: 'indigo',
      highlights: [
        { label: 'سطح المكتب:', value: 'مجلد صامت وبحث صوتي' },
        { label: 'الموبايل:', value: 'كاميرا وبلوتوث وموقع' },
        { label: 'التخزين والطباعة:', value: 'دائم ونوافذ منبثقة' },
      ]
    }
  ];

  return (
    <div className="flex flex-col flex-1 pb-12" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1 text-slate-500">
            {onNavigateToDashboard ? (
              <button
                type="button"
                onClick={onNavigateToDashboard}
                className="text-xs uppercase font-bold tracking-tight text-slate-500 hover:text-blue-600 cursor-pointer"
              >
                الرئيسية
              </button>
            ) : (
              <span className="text-xs uppercase font-bold tracking-tight">النظام والإدارة</span>
            )}
            <span className="text-xs">/</span>
            <span className="text-xs font-semibold text-blue-600">لوحة الإعدادات المركزية (8 بوابات موحدة)</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">إعدادات النظام الشاملة</h2>
          <p className="text-slate-500 mt-1 text-xs sm:text-sm">
            تم تنظيم الإعدادات في 8 بوابات متكاملة تمنع التكرار وتوفر تحكماً دقيقاً في الهوية، العملات، الفوترة، والصلاحيات.
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
            className="btn-3d btn-3d-blue flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
          >
            <Save size={16} />
            حفظ كافة الإعدادات
          </button>
        </div>
      </div>

      {/* Grid of 8 Unified Portals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
        {settingsPortals.map((card) => {
          const Icon = card.icon;
          const isActive = activeSection === card.id;
          return (
            <div
              key={card.id}
              onClick={() => setActiveSection(card.id)}
              className={`bg-white rounded-2xl p-5 border transition-all duration-200 cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
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
                card.color === 'sky' ? 'from-sky-500 to-blue-500' :
                card.color === 'purple' ? 'from-purple-500 to-pink-500' :
                card.color === 'cyan' ? 'from-cyan-500 to-teal-500' :
                'from-rose-500 to-amber-500'
              }`} />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs ${
                    card.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                    card.color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
                    card.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                    card.color === 'amber' ? 'bg-amber-50 text-amber-600' :
                    card.color === 'sky' ? 'bg-sky-50 text-sky-600' :
                    card.color === 'purple' ? 'bg-purple-50 text-purple-600' :
                    card.color === 'cyan' ? 'bg-cyan-50 text-cyan-600' :
                    'bg-rose-50 text-rose-600'
                  }`}>
                    <Icon size={22} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 group-hover:text-blue-600 transition-colors flex items-center gap-1">
                    فتح القسم <ChevronLeft size={13} />
                  </span>
                </div>

                <h3 className={`text-base font-bold mb-1.5 transition-colors ${
                  isActive ? 'text-blue-700' : 'text-slate-800 group-hover:text-blue-600'
                }`}>
                  {card.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">
                  {card.description}
                </p>
              </div>

              <div>
                {/* Highlights */}
                <div className="space-y-1 pt-2.5 border-t border-slate-100 mb-3 text-xs">
                  {card.highlights.map((h, i) => (
                    <div key={i} className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400 text-[11px] font-medium">{h.label}</span>
                      <span className="font-semibold text-slate-700 text-[11px] truncate max-w-[150px]">{h.value}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-blue-600">
                  <span>تعديل الخيارات</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
                    دخول
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Summary Overview Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-5 sm:p-6 border border-slate-700 shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-13 h-13 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Building2 size={26} />
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
              الرقم الضريبي: <span className="font-mono text-blue-300 font-bold">{settings.company.taxNumber || 'غير مسجل'}</span> • العملة الأساسية: <span className="font-bold text-emerald-400">{settings.financial.currencySymbol} ({settings.financial.currency})</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
          <button
            type="button"
            onClick={() => setActiveSection('backup_cloud')}
            className="btn-3d btn-3d-slate px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5"
          >
            <HardDrive size={14} className="text-emerald-400" />
            النسخ السحابي والمحلي
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('users_permissions')}
            className="btn-3d btn-3d-purple px-3.5 py-2 text-xs font-bold flex items-center gap-1.5"
          >
            <Users size={14} />
            إدارة الصلاحيات
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('mobile_permissions')}
            className="btn-3d btn-3d-blue px-3.5 py-2 text-xs font-bold flex items-center gap-1.5"
          >
            <Monitor size={14} />
            أذونات سطح المكتب والموبايل
          </button>
        </div>
      </div>

      {/* POPUP MODAL FOR ACTIVE SETTINGS PORTAL */}
      {activeSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  {activeSection === 'company' && <Building2 size={20} />}
                  {activeSection === 'financial_currency' && <Landmark size={20} />}
                  {activeSection === 'invoicing_control' && <Receipt size={20} />}
                  {activeSection === 'printing_branding' && <Printer size={20} />}
                  {activeSection === 'backup_cloud' && <Database size={20} />}
                  {activeSection === 'users_permissions' && <Users size={20} />}
                  {activeSection === 'master_data_engine' && <HardDrive size={20} />}
                  {activeSection === 'approvals_and_reset' && <ShieldCheck size={20} />}
                  {activeSection === 'mobile_permissions' && <Monitor size={20} />}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    {activeSection === 'company' && 'بيانات المنشأة والهوية المؤسسية'}
                    {activeSection === 'financial_currency' && 'المعايير المحاسبية والعملات المتعددة'}
                    {activeSection === 'invoicing_control' && 'الفوترة والضرائب والرقابة الائتمانية والمخزون'}
                    {activeSection === 'printing_branding' && 'قوالب وتفضيلات الطباعة والهوية البصرية'}
                    {activeSection === 'backup_cloud' && 'النسخ الاحتياطي والمزامنة السحابية'}
                    {activeSection === 'users_permissions' && 'إدارة المستخدمين ومصفوفة الصلاحيات (RBAC)'}
                    {activeSection === 'master_data_engine' && 'الجداول التعريفية ومحرك الحسابات المالي'}
                    {activeSection === 'approvals_and_reset' && 'الرقابة الإدارية ودورة الاعتماد والتصفير الآمن'}
                    {activeSection === 'mobile_permissions' && 'أذونات وإعدادات سطح المكتب وتطبيق الموبايل (Desktop & Mobile)'}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    قم بإجراء التعديلات المطلوبة ثم اضغط على حفظ الإعدادات لتطبيقها في كامل النظام.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveSettings()}
                  className="hidden sm:flex items-center gap-1.5 px-4 py-1.5 btn-3d btn-3d-emerald text-xs font-bold"
                >
                  <Save size={14} />
                  حفظ
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection(null)}
                  className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* 1. COMPANY PROFILE */}
              {activeSection === 'company' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
                    <h4 className="font-bold text-sm text-slate-900 mb-4 border-b border-slate-100 pb-2">
                      البيانات الرسمية والتجارية
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">اسم المنشأة بالعربية *</label>
                        <input
                          type="text"
                          value={settings.company.nameAr}
                          onChange={e => handleCompanyChange('nameAr', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">اسم المنشأة بالإنجليزية</label>
                        <input
                          type="text"
                          value={settings.company.nameEn}
                          onChange={e => handleCompanyChange('nameEn', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">الرقم الضريبي (15 رقم)</label>
                        <input
                          type="text"
                          value={settings.company.taxNumber}
                          onChange={e => handleCompanyChange('taxNumber', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">رقم السجل التجاري (CR)</label>
                        <input
                          type="text"
                          value={settings.company.commercialRegister}
                          onChange={e => handleCompanyChange('commercialRegister', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">الفرع الرئيسي</label>
                        <input
                          type="text"
                          value={settings.company.branchName}
                          onChange={e => handleCompanyChange('branchName', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف / الجوال</label>
                        <input
                          type="text"
                          value={settings.company.phone}
                          onChange={e => handleCompanyChange('phone', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني</label>
                        <input
                          type="email"
                          value={settings.company.email}
                          onChange={e => handleCompanyChange('email', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">الموقع الإلكتروني</label>
                        <input
                          type="url"
                          value={settings.company.website}
                          onChange={e => handleCompanyChange('website', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">المدينة والرمز البريدي</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="المدينة"
                            value={settings.company.city}
                            onChange={e => handleCompanyChange('city', e.target.value)}
                            className="w-2/3 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                          <input
                            type="text"
                            placeholder="الرمز"
                            value={settings.company.postalCode}
                            onChange={e => handleCompanyChange('postalCode', e.target.value)}
                            className="w-1/3 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                          />
                        </div>
                      </div>
                      <div className="md:col-span-2 lg:col-span-3">
                        <label className="block text-xs font-bold text-slate-700 mb-1">العنوان الوطني / التفصيلي</label>
                        <input
                          type="text"
                          value={settings.company.address}
                          onChange={e => handleCompanyChange('address', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Logo & Stamp Uploader */}
                  <CompanyLogoUploader
                    logoUrl={settings.company.logoUrl || ''}
                    onLogoChange={(url) => handleCompanyChange('logoUrl', url)}
                    stampUrl={settings.company.stampUrl || ''}
                    onStampChange={(url) => handleCompanyChange('stampUrl', url)}
                    title="تحميل وتحديد شعار وختم المنشأة الرسمي"
                    mode="both"
                  />
                </div>
              )}

              {/* 2. FINANCIAL STANDARDS & MULTI-CURRENCY */}
              {activeSection === 'financial_currency' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
                    <h4 className="font-bold text-sm text-slate-900 mb-4 border-b border-slate-100 pb-2">
                      المعايير المالية والسنة المالية
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">السنة المالية</label>
                        <input
                          type="text"
                          value={settings.financial.fiscalYear}
                          onChange={e => handleFinancialChange('fiscalYear', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ بداية السنة المالية</label>
                        <input
                          type="date"
                          value={settings.financial.fiscalYearStart}
                          onChange={e => handleFinancialChange('fiscalYearStart', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ نهاية السنة المالية</label>
                        <input
                          type="date"
                          value={settings.financial.fiscalYearEnd}
                          onChange={e => handleFinancialChange('fiscalYearEnd', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">طريقة تقييم تكلفة المخزون</label>
                        <select
                          value={settings.financial.costMethod}
                          onChange={e => handleFinancialChange('costMethod', e.target.value as any)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-bold"
                        >
                          <option value="WEIGHTED_AVG">متوسط التكلفة المرجح (Weighted Average)</option>
                          <option value="FIFO">الوارد أولاً يصرف أولاً (FIFO)</option>
                          <option value="LIFO">الوارد أخيراً يصرف أولاً (LIFO)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">عدد الخانات العشرية</label>
                        <input
                          type="number"
                          min="0"
                          max="4"
                          value={settings.financial.decimalPlaces}
                          onChange={e => handleFinancialChange('decimalPlaces', parseInt(e.target.value) || 2)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Multi-Currency Manager */}
                  <CurrencySettingsPanel
                    currencies={settings.currencies || DEFAULT_SETTINGS.currencies!}
                    baseCurrency={settings.financial.currency}
                    onCurrenciesChange={handleCurrenciesChange}
                    onBaseCurrencyChange={handleBaseCurrencyChange}
                  />
                </div>
              )}

              {/* 3. INVOICING, TAXES, & LIMITS */}
              {activeSection === 'invoicing_control' && (
                <InvoicingControlPanel
                  settings={settings}
                  seqs={seqs}
                  onTaxChange={handleTaxChange}
                  onInvoiceDefaultsChange={handleInvoiceDefaultsChange}
                  onControlLimitsChange={handleControlLimitsChange}
                />
              )}

              {/* 4. PRINTING & BRANDING */}
              {activeSection === 'printing_branding' && (
                <PrintingBrandingPanel
                  settings={settings}
                  onPrintingChange={handlePrintingChange}
                  onBrandingChange={handleBrandingChange}
                />
              )}

              {/* 5. BACKUP & CLOUD SYNC */}
              {activeSection === 'backup_cloud' && (
                <div className="space-y-6 animate-in fade-in">
                  <LocalFolderBackupManager />
                  <DriveSyncSettingsCard />
                </div>
              )}

              {/* 6. USERS & RBAC MATRIX */}
              {activeSection === 'users_permissions' && (
                <UsersPermissionsPanel
                  users={settings.users || DEFAULT_SETTINGS.users!}
                  onUsersChange={handleUsersChange}
                />
              )}

              {/* 7. MASTER DATA & FINANCIAL ENGINE */}
              {activeSection === 'master_data_engine' && (
                <div className="space-y-6 animate-in fade-in">
                  <MasterDatabaseSettings />
                  <AccountEngineTester />
                </div>
              )}

              {/* 8. APPROVAL WORKFLOW & SYSTEM RESET */}
              {activeSection === 'approvals_and_reset' && (
                <div className="space-y-6 animate-in fade-in">
                  <ApprovalWorkflowSettingsPanel
                    settings={settings}
                    onChange={handleApprovalWorkflowChange}
                  />

                  {/* Danger Zone: Factory Reset & Clear Data */}
                  <div className="bg-rose-50/70 rounded-2xl border-2 border-rose-200 p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <ShieldAlert size={24} />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-rose-950">منطقة العمليات الحساسة وتصفير النظام (System Reset)</h4>
                        <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                          يتيح لك هذا القسم تفريغ وتصفير بيانات الفواتير والقيود والعمليات لبدء سنة مالية جديدة، أو استعادة ضبط المصنع الشامل مع تنزيل نسخة احتياطية إجبارية للأمان.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      <button
                        type="button"
                        onClick={() => openResetModal('TRANSACTIONS_ONLY')}
                        className="btn-3d btn-3d-amber p-3.5 text-xs font-bold flex items-center justify-center gap-2"
                      >
                        <RotateCcw size={16} />
                        تصفير العمليات والفواتير فقط (مع الاحتفاظ بالحسابات والأصناف)
                      </button>

                      <button
                        type="button"
                        onClick={() => openResetModal('FULL_FACTORY_RESET')}
                        className="btn-3d btn-3d-danger p-3.5 text-xs font-bold flex items-center justify-center gap-2"
                      >
                        <ShieldAlert size={16} />
                        استعادة ضبط المصنع الكامل (مسح كافة البيانات وإعادة التهيئة)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 9. ANDROID & MOBILE PERMISSIONS (THE 5 KEY PERMISSIONS) */}
              {activeSection === 'mobile_permissions' && (
                <MobilePermissionsModal />
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {hasChanges ? 'توجد تعديلات غير محفوظة' : 'كافة الإعدادات متزامنة ومحفوظة'}
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveSection(null)}
                  className="btn-3d btn-3d-white px-4 py-2 text-xs font-bold"
                >
                  إغلاق النافذة
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveSettings()}
                  className="btn-3d btn-3d-blue px-5 py-2 text-xs font-bold flex items-center gap-1.5"
                >
                  <Save size={14} />
                  حفظ التغييرات
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESET CONFIRMATION MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95" dir="rtl">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>

            <div className="text-center">
              <h4 className="text-lg font-bold text-slate-900">
                {selectedResetType === 'TRANSACTIONS_ONLY' ? 'تأكيد تصفير العمليات المالية' : 'تأكيد استعادة ضبط المصنع الشامل'}
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                {selectedResetType === 'TRANSACTIONS_ONLY'
                  ? 'سيتم حذف جميع الفواتير والقيود وسندات القبض والصرف، مع الإبقاء على العملاء والموردين والأصناف ودليل الحسابات.'
                  : 'تحذير شديد: سيتم مسح كافة البيانات المسجلة بالكامل وإعادة النظام لحالته الأولية.'}
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900">تنزيل نسخة احتياطية للأمان:</span>
              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={isDownloadingBackup}
                className="btn-3d btn-3d-blue px-3 py-1.5 text-xs font-bold flex items-center gap-1"
              >
                <Download size={13} />
                {isBackupDownloaded ? 'تم التنزيل ✓' : 'تنزيل نسخة JSON'}
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                لتأكيد العملية، اكتب كلمة <span className="text-rose-600 font-mono font-bold">تصفير</span> أو <span className="text-rose-600 font-mono font-bold">RESET</span> أدناه:
              </label>
              <input
                type="text"
                value={confirmationInput}
                onChange={e => setConfirmationInput(e.target.value)}
                placeholder="اكتب تصفير هنا..."
                className="w-full px-3 py-2 text-sm bg-white border-2 border-rose-300 rounded-lg text-center font-bold text-rose-700"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="btn-3d btn-3d-white flex-1 py-2 text-xs font-bold"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={!isConfirmationValid || isExecutingReset}
                className={`btn-3d flex-1 py-2 text-xs font-bold ${
                  isConfirmationValid && !isExecutingReset
                    ? 'btn-3d-danger'
                    : 'btn-3d-white opacity-60 cursor-not-allowed'
                }`}
              >
                {isExecutingReset ? 'جارٍ التصفير...' : 'تنفيذ التصفير الآن'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Feedback Notification */}
      {resetFeedback && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
          <div className="text-xs">
            <p className="font-bold">
              {resetFeedback.resetType === 'TRANSACTIONS_ONLY' ? 'تم تصفير العمليات والفواتير بنجاح' : 'تمت استعادة ضبط المصنع بنجاح'}
            </p>
            <p className="text-slate-400 mt-0.5">
              تم مسح {resetFeedback.clearedInvoicesCount} فاتورة، {resetFeedback.clearedVouchersCount} سنداً، و{resetFeedback.clearedJournalEntriesCount} قيداً.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setResetFeedback(null)}
            className="text-slate-400 hover:text-white mr-2"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
