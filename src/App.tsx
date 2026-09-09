import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Settings as SettingsIcon, 
  ArrowRight, 
  ArrowLeft,
  Menu, 
  X, 
  BookOpen, 
  ShoppingCart, 
  Warehouse, 
  Building2,
  Users,
  Globe,
  HardDrive,
  Calendar
} from 'lucide-react';
import LocalFolderBackupManager from './components/LocalFolderBackupManager';
import { 
  getAutoSaveConfig, 
  subscribeAutoSave, 
  triggerAutoSaveNow, 
  type AutoSaveConfig 
} from './utils/localFolderBackup';
import NewJournalEntry from './components/NewJournalEntry';
import TrialBalanceScreen from './components/TrialBalanceScreen';
import Customers from './components/Customers';
import Sales from './components/Sales';
import Vendors from './components/Vendors';
import Purchases from './components/Purchases';
import ExternalVouchers from './components/ExternalVouchers';
import InternalVouchers from './components/InternalVouchers';
import Items from './components/Items';
import Settings from './components/Settings';
import PartnerBalances from './components/PartnerBalances';
import WarehouseBalances from './components/WarehouseBalances';
import DashboardScreen from './components/DashboardScreen';
import CompanyProfileScreen from './components/CompanyProfileScreen';
import PayrollScreen from './components/PayrollScreen';
import InstallmentsScreen from './components/InstallmentsScreen';
import ManufacturingScreen from './components/ManufacturingScreen';
import { getSystemSettings } from './utils/settings';
import { useLanguage } from './i18n/LanguageContext';

export default function App() {
  const [activeView, setActiveView] = useState<string | null>('companyProfile');
  const [systemSettings, setSystemSettings] = useState(() => getSystemSettings());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [autoSaveConfig, setAutoSaveConfig] = useState<AutoSaveConfig>(() => getAutoSaveConfig());
  const { language, isRtl, dir, toggleLanguage, t } = useLanguage();

  useEffect(() => {
    const handleSettingsUpdate = () => {
      setSystemSettings(getSystemSettings());
    };
    window.addEventListener('alpha-settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('alpha-settings-updated', handleSettingsUpdate);
  }, []);

  // Subscribe to auto-save configuration and run periodic timer
  useEffect(() => {
    const unsub = subscribeAutoSave((newCfg) => {
      setAutoSaveConfig(newCfg);
    });

    const intervalMinutes = Math.max(1, autoSaveConfig.intervalMinutes || 5);
    const intervalMs = intervalMinutes * 60 * 1000;

    const timer = setInterval(async () => {
      const cfg = getAutoSaveConfig();
      if (cfg.enabled && cfg.folderName) {
        await triggerAutoSaveNow();
      }
    }, intervalMs);

    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [autoSaveConfig.intervalMinutes, autoSaveConfig.enabled]);

  // Close mobile menu on view change
  const handleNavigate = (view: string | null) => {
    setActiveView(view);
    setIsMobileMenuOpen(false);
  };

  const renderView = () => {
    switch (activeView) {
      case 'companyProfile': return (
        <CompanyProfileScreen 
          systemSettings={systemSettings} 
          onNavigateToSettings={() => handleNavigate('settings')} 
          onNavigateToDashboard={() => handleNavigate(null)}
        />
      );
      case 'journal': return <NewJournalEntry />;
      case 'trialBalance': return <TrialBalanceScreen />;
      case 'customers': return <Customers />;
      case 'sales': return <Sales />;
      case 'installments': return <InstallmentsScreen />;
      case 'vendors': return <Vendors />;
      case 'purchases': return <Purchases />;
      case 'partnerBalances': return <PartnerBalances />;
      case 'warehouseBalances': return <WarehouseBalances />;
      case 'items': return <Items />;
      case 'manufacturing': return <ManufacturingScreen />;
      case 'payroll': return <PayrollScreen />;
      case 'external': return <ExternalVouchers />;
      case 'internal': return <InternalVouchers />;
      case 'settings': return <Settings />;
      default: return null;
    }
  };

  const navItemClass = (viewName: string) => {
    const isActive = activeView === viewName || (viewName === 'dashboard' && activeView === null);
    return `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer text-sm ${
      isActive 
        ? 'bg-blue-600/20 text-blue-400 border border-blue-600/40 font-semibold' 
        : 'hover:bg-slate-800 text-slate-300 hover:text-white'
    }`;
  };

  const closeModal = () => {
    if (activeView === 'companyProfile') {
      handleNavigate(null);
    } else {
      handleNavigate('companyProfile');
    }
  };

  const getViewTitle = () => {
    switch (activeView) {
      case 'companyProfile': return t('nav_companyProfile', 'الواجهة الرئيسية (بيانات الشركة)');
      case 'settings': return t('nav_settings', 'إعدادات النظام');
      case 'journal': return t('nav_journal', 'القيود اليومية');
      case 'trialBalance': return t('nav_trialBalance', 'ميزان المراجعة');
      case 'customers': return t('nav_customers', 'إدارة العملاء');
      case 'sales': return t('nav_sales', 'فواتير المبيعات');
      case 'installments': return t('nav_installments', 'إدارة التقسيط والكمبيالات والسندات لأمر');
      case 'vendors': return t('nav_vendors', 'إدارة الموردين');
      case 'purchases': return t('nav_purchases', 'فواتير المشتريات');
      case 'partnerBalances': return t('nav_partnerBalances', 'أرصدة العملاء والموردين');
      case 'warehouseBalances': return t('nav_warehouseBalances', 'أرصدة المخزن');
      case 'items': return t('nav_items', 'إدارة الأصناف');
      case 'manufacturing': return t('nav_manufacturing', 'إدارة التصنيع والإنتاج وقوائم التكاليف (BOM)');
      case 'payroll': return t('nav_payroll', 'الموظفون والأجور والمكافآت والبدلات والخصومات');
      case 'external': return t('nav_external', 'سندات خارجية (قبض/صرف)');
      case 'internal': return t('nav_internal', 'سندات داخلية (تحويلات)');
      default: return '';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] font-sans text-slate-900" dir={dir}>
      {/* Header */}
      <header className="h-16 bg-[#1e293b] text-white flex items-center justify-between px-3 sm:px-6 md:px-8 border-b border-slate-700 shrink-0 print:hidden z-20">
        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Mobile Menu Hamburger Toggle */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={t('systemMenu', 'القائمة الرئيسية')}
            className="md:hidden p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors cursor-pointer"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div 
            onClick={() => handleNavigate('companyProfile')} 
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none hover:opacity-95 transition-opacity group"
            title={t('homeOverview', 'الواجهة الرئيسية (بيانات الشركة)')}
          >
            <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-linear-to-tr from-amber-500 via-amber-400 to-amber-300 rounded-xl flex items-center justify-center font-extrabold text-xs sm:text-sm shadow-md text-slate-950 font-sans tracking-tight border border-amber-300/40 group-hover:scale-105 transition-transform shrink-0">
              {language === 'ar' ? 'لوجوستريا' : 'LOGUSTRIA'}
            </div>
            <div>
              <h1 className="text-sm sm:text-base md:text-lg font-semibold leading-tight line-clamp-1">
                {language === 'ar' 
                  ? (systemSettings.company.nameAr || 'لوجوستريا للمحاسبة') 
                  : (systemSettings.company.nameEn || 'Logustria ERP')}
              </h1>
              <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider mt-0.5 line-clamp-1">
                {language === 'ar' 
                  ? (systemSettings.company.nameEn || 'النظام المالي المؤسسي') 
                  : 'Enterprise Financial & Accounting ERP'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Settings Button */}
          <button
            type="button"
            onClick={() => handleNavigate('settings')}
            title={t('systemSettingsBtn', 'إعدادات النظام')}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800 sm:bg-slate-700 hover:bg-slate-600 border border-slate-700 sm:border-slate-600 flex items-center justify-center text-slate-200 hover:text-white transition-colors cursor-pointer"
          >
            <SettingsIcon size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>

          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-600/30 border border-blue-500/50 text-blue-200 flex items-center justify-center text-xs sm:text-sm font-bold font-mono">
            {language === 'ar' ? 'م' : 'U'}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Backdrop Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 md:hidden transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar (Responsive: Permanent on Desktop, Slide-over Drawer on Mobile) */}
        <nav className={`
          fixed md:static inset-y-0 ${isRtl ? 'right-0' : 'left-0'} z-50
          w-72 sm:w-80 md:w-64
          bg-[#0f172a] text-slate-300 p-4 flex flex-col gap-1 shrink-0 overflow-y-auto print:hidden
          transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
          ${isMobileMenuOpen 
            ? 'translate-x-0' 
            : isRtl ? 'translate-x-full md:translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          {/* Mobile Drawer Header */}
          <div className="md:hidden flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="px-2 py-0.5 bg-linear-to-r from-amber-500 to-amber-400 rounded-md flex items-center justify-center font-bold text-[11px] text-slate-950">
                {language === 'ar' ? 'لوجوستريا' : 'LOGUSTRIA'}
              </div>
              <span className="font-bold text-xs text-white">{t('systemMenu', 'قائمة النظام المحاسبي')}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="text-[10px] uppercase font-bold text-slate-500 px-3 mt-1 mb-2 tracking-wider">
            {t('nav_general', 'الرئيسية وبيانات المنشأة')}
          </div>
          <div onClick={() => handleNavigate('companyProfile')} className={navItemClass('companyProfile')}>
            <Building2 size={15} className="text-amber-400 shrink-0" /> 
            <span>{t('nav_companyProfile', 'الواجهة الرئيسية (بيانات الشركة)')}</span>
          </div>
          <div onClick={() => handleNavigate(null)} className={navItemClass('dashboard')}>
            <LayoutDashboard size={15} className="opacity-80 shrink-0" /> 
            <span>{t('nav_dashboard', 'لوحة المؤشرات')}</span>
          </div>

          <div className="mt-4 text-[10px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-wider">
            {t('nav_generalAccounting', 'المحاسبة العامة')}
          </div>
          <div onClick={() => handleNavigate('journal')} className={navItemClass('journal')}>
            <span className="text-xs font-mono bg-slate-800 px-1 rounded">GL</span> 
            <span>{t('nav_journal', 'القيود اليومية')}</span>
          </div>
          <div onClick={() => handleNavigate('trialBalance')} className={navItemClass('trialBalance')}>
            <span className="text-xs font-mono bg-slate-800 text-amber-400 px-1 rounded">TB</span> 
            <span>{t('nav_trialBalance', 'ميزان المراجعة')}</span>
          </div>
          
          <div className="mt-4 text-[10px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-wider">
            {t('nav_salesGroup', 'العملاء والمبيعات والتقسيط')}
          </div>
          <div onClick={() => handleNavigate('customers')} className={navItemClass('customers')}>
            <span className="text-xs font-mono bg-slate-800 px-1 rounded">AR</span> 
            <span>{t('nav_customers', 'إدارة العملاء')}</span>
          </div>
          <div onClick={() => handleNavigate('sales')} className={navItemClass('sales')}>
            <span className="text-xs font-mono bg-slate-800 px-1 rounded">INV</span> 
            <span>{t('nav_sales', 'فواتير المبيعات')}</span>
          </div>
          <div onClick={() => handleNavigate('installments')} className={navItemClass('installments')}>
            <span className="text-xs text-emerald-400 font-bold font-mono bg-slate-800 px-1 rounded">INS</span> 
            <span>{t('nav_installments', 'التقسيط والكمبيالات')}</span>
          </div>

          <div className="mt-4 text-[10px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-wider">
            {t('nav_purchasesGroup', 'الموردون والمشتريات')}
          </div>
          <div onClick={() => handleNavigate('vendors')} className={navItemClass('vendors')}>
            <span className="text-xs font-mono bg-slate-800 px-1 rounded">AP</span> 
            <span>{t('nav_vendors', 'إدارة الموردين')}</span>
          </div>
          <div onClick={() => handleNavigate('purchases')} className={navItemClass('purchases')}>
            <span className="text-xs font-mono bg-slate-800 px-1 rounded">PO</span> 
            <span>{t('nav_purchases', 'فواتير المشتريات')}</span>
          </div>

          <div className="mt-4 text-[10px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-wider">
            {t('nav_balancesGroup', 'الأرصدة والذمم المالية')}
          </div>
          <div onClick={() => handleNavigate('partnerBalances')} className={navItemClass('partnerBalances')}>
            <span className="text-xs text-indigo-400 font-bold font-mono bg-slate-800 px-1 rounded">BAL</span> 
            <span>{t('nav_partnerBalances', 'أرصدة العملاء والموردين')}</span>
          </div>

          <div className="mt-4 text-[10px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-wider">
            {t('nav_inventoryGroup', 'المخزون والتصنيع والأصناف')}
          </div>
          <div onClick={() => handleNavigate('warehouseBalances')} className={navItemClass('warehouseBalances')}>
            <span className="text-xs text-blue-400 font-bold font-mono bg-slate-800 px-1 rounded">STK</span> 
            <span>{t('nav_warehouseBalances', 'أرصدة المخزن')}</span>
          </div>
          <div onClick={() => handleNavigate('items')} className={navItemClass('items')}>
            <span className="text-xs opacity-80 font-mono bg-slate-800 px-1 rounded">ITM</span> 
            <span>{t('nav_items', 'إدارة الأصناف')}</span>
          </div>
          <div onClick={() => handleNavigate('manufacturing')} className={navItemClass('manufacturing')}>
            <span className="text-xs text-amber-400 font-bold font-mono bg-slate-800 px-1 rounded">MFG</span> 
            <span>{t('nav_manufacturing', 'إدارة التصنيع والإنتاج (BOM)')}</span>
          </div>

          <div className="mt-4 text-[10px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-wider">
            {t('nav_hrGroup', 'الموارد البشرية والأجور')}
          </div>
          <div onClick={() => handleNavigate('payroll')} className={navItemClass('payroll')}>
            <Users size={15} className="text-blue-400 shrink-0" /> 
            <span>{t('nav_payroll', 'الموظفون والأجور والبدلات')}</span>
          </div>

          <div className="mt-4 text-[10px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-wider">
            {t('nav_treasuryGroup', 'الخزينة والبنوك')}
          </div>
          <div onClick={() => handleNavigate('external')} className={navItemClass('external')}>
            <span className="text-xs opacity-80 font-mono bg-slate-800 px-1 rounded">TR</span> 
            <span>{t('nav_external', 'سندات خارجية (قبض/صرف)')}</span>
          </div>
          <div onClick={() => handleNavigate('internal')} className={navItemClass('internal')}>
            <span className="text-xs opacity-80 font-mono bg-slate-800 px-1 rounded">TR</span> 
            <span>{t('nav_internal', 'سندات داخلية (تحويلات)')}</span>
          </div>

          <div className="mt-4 text-[10px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-wider">
            {t('nav_adminGroup', 'الإدارة والنظام')}
          </div>
          <div onClick={() => handleNavigate('settings')} className={navItemClass('settings')}>
            <SettingsIcon size={15} className="opacity-80 shrink-0" /> 
            <span>{t('nav_settings', 'إعدادات النظام')}</span>
          </div>

          {/* System Status & Tools: Fiscal Year, Auto-Save, Language */}
          <div className="mt-5 pt-3.5 border-t border-slate-800 flex flex-col gap-2.5">
            <div className="text-[10px] uppercase font-bold text-slate-500 px-2 tracking-wider">
              {language === 'ar' ? 'أدوات وحالة النظام' : 'System Tools & Status'}
            </div>

            {/* 1. السنة المالية (Fiscal Year) */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs shadow-2xs">
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-amber-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {t('fiscalYearLabel', 'السنة المالية')}
                  </div>
                  <div className="font-mono font-bold text-slate-100 text-xs">
                    {systemSettings.financial.fiscalYear}
                  </div>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                systemSettings.financial.isFiscalYearClosed 
                  ? 'bg-rose-950/60 text-rose-300 border-rose-800/60' 
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
              }`}>
                {systemSettings.financial.isFiscalYearClosed ? t('yearClosed', 'مغلقة') : t('yearOpen', 'مفتوحة')}
              </span>
            </div>

            {/* 2. الحفظ التلقائي في مجلد محلي (Auto-Save) */}
            <button
              type="button"
              onClick={() => {
                setShowBackupModal(true);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                autoSaveConfig.enabled && autoSaveConfig.folderName
                  ? 'bg-emerald-950/40 text-emerald-200 border-emerald-700/60 hover:bg-emerald-900/50'
                  : 'bg-slate-800/70 text-slate-300 border-slate-700/60 hover:bg-slate-700/80 hover:text-white'
              }`}
              title={
                autoSaveConfig.enabled && autoSaveConfig.folderName
                  ? `الحفظ التلقائي نشط في: ${autoSaveConfig.folderName}`
                  : 'حفظ تلقائي للبيانات في مجلد محلي (انقر للاختيار)'
              }
            >
              <div className="flex items-center gap-2 min-w-0">
                <HardDrive size={15} className={autoSaveConfig.enabled && autoSaveConfig.folderName ? 'text-emerald-400 shrink-0' : 'text-slate-400 shrink-0'} />
                <div className="text-start truncate">
                  <div className="text-[10px] text-slate-400 font-normal">
                    {language === 'ar' ? 'الحفظ التلقائي المحلي' : 'Local Auto-Save'}
                  </div>
                  <div className="truncate text-xs font-mono font-semibold">
                    {autoSaveConfig.enabled && autoSaveConfig.folderName ? autoSaveConfig.folderName : (language === 'ar' ? 'غير مربوط بمجلد' : 'Not configured')}
                  </div>
                </div>
              </div>
              {autoSaveConfig.enabled && autoSaveConfig.folderName ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
              ) : (
                <span className="text-[10px] text-slate-400 bg-slate-700/60 px-1.5 py-0.5 rounded border border-slate-600 shrink-0">
                  {language === 'ar' ? 'ربط' : 'Link'}
                </span>
              )}
            </button>

            {/* 3. لغة النظام (Language Switcher) */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-200 hover:text-white border border-slate-700/60 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              title={language === 'ar' ? 'Switch display language to English' : 'تغيير لغة العرض إلى العربية'}
            >
              <div className="flex items-center gap-2">
                <Globe size={15} className="text-blue-400 shrink-0" />
                <span>{language === 'ar' ? 'لغة النظام' : 'Language'}</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 font-mono text-[11px] text-blue-300">
                {language === 'ar' ? 'English (EN)' : 'العربية (AR)'}
              </span>
            </button>
          </div>

          {/* Extra bottom space for mobile scrollability */}
          <div className="h-8 md:hidden" />
        </nav>

        {/* Main Content Workspace */}
        <main className="flex-1 p-3 sm:p-6 md:p-8 overflow-y-auto flex flex-col bg-[#f1f5f9] print:p-0 relative pb-20 md:pb-8">
          <div className="max-w-6xl w-full mx-auto flex-1 flex flex-col">
            {activeView ? (
              <div className="flex flex-col flex-1">
                {/* View Top Bar with Return to Company Profile / Dashboard Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 mb-4 sm:mb-6 border-b border-slate-200 print:hidden">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex items-center justify-center sm:justify-start gap-2 text-xs font-bold text-slate-700 hover:text-blue-600 bg-white hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-xs flex-1 sm:flex-initial"
                    >
                      {isRtl ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
                      <span>{activeView === 'companyProfile' ? t('goToDashboard', 'الانتقال إلى لوحة المؤشرات المالية') : t('backToOverview', 'العودة إلى الواجهة الرئيسية (بيانات الشركة)')}</span>
                    </button>
                    {activeView !== 'companyProfile' && (
                      <button
                        type="button"
                        onClick={() => handleNavigate(null)}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors cursor-pointer"
                        title={t('dashboardTitle', 'لوحة المؤشرات')}
                      >
                        <span>{t('dashboardTitle', 'لوحة المؤشرات')}</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 text-xs text-slate-400">
                    <span>{language === 'ar' ? (systemSettings.company.nameAr || 'نظام لوجوستريا') : (systemSettings.company.nameEn || 'Logustria ERP')}</span>
                    <span>/</span>
                    <span className="font-bold text-slate-700">
                      {getViewTitle()}
                    </span>
                  </div>
                </div>
                {renderView()}
              </div>
            ) : (
              <DashboardScreen 
                onNavigate={(view) => handleNavigate(view)} 
                systemSettings={systemSettings} 
              />
            )}
          </div>
        </main>

        {/* Mobile Bottom Navigation Bar (Smart Thumb Controls for Phones) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#0f172a] border-t border-slate-800 flex items-center justify-around px-1 z-30 shadow-lg text-slate-400 print:hidden" dir={dir}>
          <button
            type="button"
            onClick={() => handleNavigate('companyProfile')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
              activeView === 'companyProfile' ? 'text-amber-400 font-bold' : 'hover:text-slate-200'
            }`}
            title={t('mob_company', 'بيانات المنشأة')}
          >
            <Building2 size={18} />
            <span className="text-[9px] mt-0.5 whitespace-nowrap">{t('mob_company', 'المنشأة')}</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate(null)}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
              activeView === null ? 'text-blue-400 font-bold' : 'hover:text-slate-200'
            }`}
          >
            <LayoutDashboard size={18} />
            <span className="text-[9px] mt-0.5 whitespace-nowrap">{t('mob_dashboard', 'المؤشرات')}</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('journal')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
              activeView === 'journal' ? 'text-blue-400 font-bold' : 'hover:text-slate-200'
            }`}
          >
            <BookOpen size={18} />
            <span className="text-[9px] mt-0.5 whitespace-nowrap">{t('mob_journal', 'القيود')}</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('sales')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
              activeView === 'sales' ? 'text-blue-400 font-bold' : 'hover:text-slate-200'
            }`}
          >
            <ShoppingCart size={18} />
            <span className="text-[9px] mt-0.5 whitespace-nowrap">{t('mob_sales', 'المبيعات')}</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('warehouseBalances')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
              activeView === 'warehouseBalances' ? 'text-blue-400 font-bold' : 'hover:text-slate-200'
            }`}
          >
            <Warehouse size={18} />
            <span className="text-[9px] mt-0.5 whitespace-nowrap">{t('mob_warehouse', 'المخزن')}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
              isMobileMenuOpen ? 'text-white font-bold' : 'hover:text-slate-200'
            }`}
          >
            <Menu size={18} />
            <span className="text-[9px] mt-0.5 whitespace-nowrap">{t('mob_more', 'المزيد')}</span>
          </button>
        </nav>
      </div>

      {/* Local Folder Auto-Save Manager Modal */}
      {showBackupModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150"
          dir={dir}
        >
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col relative z-10 animate-in zoom-in-95 duration-150">
            <LocalFolderBackupManager isModal={true} onClose={() => setShowBackupModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}


