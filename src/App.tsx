import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Settings as SettingsIcon, 
  ArrowRight, 
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Menu, 
  X, 
  BookOpen, 
  ShoppingCart, 
  Warehouse, 
  Building2,
  Users,
  Globe,
  HardDrive,
  CheckCircle2,
  ClipboardCheck,
  Landmark,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  BarChart3,
  ShieldAlert
} from 'lucide-react';
import AnalyticsScreen from './components/AnalyticsScreen';
import VoiceSearchModal from './components/VoiceSearchModal';
import { GlobalSyncIndicator } from './components/GlobalSyncIndicator';
import LocalFolderBackupManager from './components/LocalFolderBackupManager';
import { 
  getAutoSaveConfig, 
  subscribeAutoSave, 
  triggerAutoSaveNow, 
  type AutoSaveConfig 
} from './utils/localFolderBackup';
import { evaluateAndTriggerSmartAlerts } from './utils/smartNotificationsEngine';
import NewJournalEntry from './components/NewJournalEntry';
import TrialBalanceScreen from './components/TrialBalanceScreen';
import FinancialReportsScreen from './components/FinancialReportsScreen';
import Customers from './components/Customers';
import Sales from './components/Sales';
import Vendors from './components/Vendors';
import Purchases from './components/Purchases';
import { ExternalReceiptVoucher, ExternalPaymentVoucher } from './components/ExternalVouchers';
import InternalReceiptVoucher from './components/InternalReceiptVoucher';
import InternalPaymentVoucher from './components/InternalPaymentVoucher';
import Items from './components/Items';
import Settings from './components/Settings';
import AuditTrailScreen from './components/AuditTrailScreen';
import PartnerBalances from './components/PartnerBalances';
import WarehouseBalances from './components/WarehouseBalances';
import InventoryCountScreen from './components/InventoryCountScreen';
import DashboardScreen from './components/DashboardScreen';
import YearEndClosingScreen from "./components/YearEndClosingScreen";
import CompanyProfileScreen from './components/CompanyProfileScreen';
import PayrollScreen from './components/PayrollScreen';
import InstallmentsScreen from './components/InstallmentsScreen';
import ManufacturingScreen from './components/ManufacturingScreen';
import ChartOfAccountsTree from './components/ChartOfAccountsTree';
import CheckPortfolioScreen from './components/CheckPortfolioScreen';
import CostCenterScreen from './components/CostCenterScreen';
import FiscalYearSelector from './components/FiscalYearSelector';
import FiscalYearArchiveBanner from './components/FiscalYearArchiveBanner';
import { mobileNavigationController } from './utils/mobileNavigation';
import { useSwipeBack } from './hooks/useSwipeBack';
import { getSystemSettings } from './utils/settings';
import { useLanguage } from './i18n/LanguageContext';

export default function App() {
  const [activeView, setActiveView] = useState<string | null>('companyProfile');
  const [systemSettings, setSystemSettings] = useState(() => getSystemSettings());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(() => {
    try {
      return localStorage.getItem('logosteria_sidebar_open') !== 'false';
    } catch {
      return true;
    }
  });
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showVoiceSearch, setShowVoiceSearch] = useState(false);
  const [autoSaveConfig, setAutoSaveConfig] = useState<AutoSaveConfig>(() => getAutoSaveConfig());
  const { language, isRtl, dir, toggleLanguage, t } = useLanguage();
  const [resetToast, setResetToast] = useState<{
    title: string;
    message: string;
    type: 'success' | 'info';
  } | null>(null);

  const toggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsMobileMenuOpen(prev => !prev);
    } else {
      setIsDesktopSidebarOpen(prev => {
        const next = !prev;
        try {
          localStorage.setItem('logosteria_sidebar_open', String(next));
        } catch {
          // ignore
        }
        return next;
      });
    }
  };

  // Global Keyboard Shortcuts: Ctrl + K (Voice Search) & Ctrl + B / Alt + B (Toggle Sidebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowVoiceSearch(prev => !prev);
      } else if (e.altKey && (e.key.toLowerCase() === 'v' || e.key === 'ر')) {
        e.preventDefault();
        setShowVoiceSearch(prev => !prev);
      } else if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') || (e.altKey && (e.key.toLowerCase() === 'b' || e.key === 'لا'))) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleSettingsUpdate = () => {
      setSystemSettings(getSystemSettings());
    };
    window.addEventListener('alpha-settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('alpha-settings-updated', handleSettingsUpdate);
  }, []);

  // Subscribe to system reset completions & custom navigation events
  useEffect(() => {
    const handleResetCompleted = (e: Event) => {
      const custom = e as CustomEvent<{
        summary?: any;
        title?: string;
        message?: string;
      }>;
      setSystemSettings(getSystemSettings());
      setActiveView(null); // Return to Dashboard
      setResetToast({
        title: custom.detail?.title || 'تم تصفير النظام بنجاح',
        message: custom.detail?.message || 'تم تصفير البيانات ومزامنة ذاكرة النظام بالكامل.',
        type: 'success'
      });
    };

    const handleCustomNavigate = (e: Event) => {
      const custom = e as CustomEvent<{ view: string | null }>;
      if (custom.detail !== undefined) {
        handleNavigate(custom.detail.view);
      }
    };

    window.addEventListener('alpha-system-reset-completed', handleResetCompleted);
    window.addEventListener('alpha-navigate', handleCustomNavigate);
    return () => {
      window.removeEventListener('alpha-system-reset-completed', handleResetCompleted);
      window.removeEventListener('alpha-navigate', handleCustomNavigate);
    };
  }, []);

  // Auto-dismiss reset toast after 8 seconds
  useEffect(() => {
    if (!resetToast) return;
    const timer = setTimeout(() => setResetToast(null), 8000);
    return () => clearTimeout(timer);
  }, [resetToast]);

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

  // Background smart notifications evaluator (evaluates checks, stock, approvals, dues)
  useEffect(() => {
    // Initial evaluation 4s after app mount
    const initialTimer = setTimeout(() => {
      evaluateAndTriggerSmartAlerts().catch(() => {});
    }, 4000);

    // Periodic evaluation every 30 minutes
    const periodicTimer = setInterval(() => {
      evaluateAndTriggerSmartAlerts().catch(() => {});
    }, 30 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(periodicTimer);
    };
  }, []);

  // Mobile Back Navigation & Popstate Controller Initialization
  useEffect(() => {
    mobileNavigationController.init((newView) => {
      setActiveView(newView);
      setIsMobileMenuOpen(false);
    }, activeView);

    return () => {
      mobileNavigationController.destroy();
    };
  }, []);

  // Register native modal back handlers for global dialogs
  useEffect(() => {
    if (!showBackupModal) return;
    const unregister = mobileNavigationController.registerModal('modal-backup-manager', () => {
      setShowBackupModal(false);
    });
    return () => unregister();
  }, [showBackupModal]);

  useEffect(() => {
    if (!showVoiceSearch) return;
    const unregister = mobileNavigationController.registerModal('modal-voice-search', () => {
      setShowVoiceSearch(false);
    });
    return () => unregister();
  }, [showVoiceSearch]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const unregister = mobileNavigationController.registerModal('modal-mobile-menu', () => {
      setIsMobileMenuOpen(false);
    });
    return () => unregister();
  }, [isMobileMenuOpen]);

  // Touch Edge Swipe-To-Back Gesture support for smartphones and tablets
  useSwipeBack({
    onBack: () => {
      // Close open drawers / modals first if any
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
        return;
      }
      if (showBackupModal) {
        setShowBackupModal(false);
        return;
      }
      if (showVoiceSearch) {
        setShowVoiceSearch(false);
        return;
      }
      mobileNavigationController.goBack();
    },
    enabled: true
  });

  // Navigate to view with history recording
  const handleNavigate = (view: string | null) => {
    mobileNavigationController.pushView(view);
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
          onNavigate={(view) => handleNavigate(view)}
        />
      );
      case 'analytics': return <AnalyticsScreen onNavigate={(view) => handleNavigate(view)} />;
      case 'journal': return <NewJournalEntry />;
      case 'chartTree': return <ChartOfAccountsTree />;
      case 'trialBalance': return <TrialBalanceScreen onNavigate={(view) => handleNavigate(view)} />;
      case 'financialReports': return <FinancialReportsScreen onNavigate={(view) => handleNavigate(view)} />;
      case "yearEndClosing": return <YearEndClosingScreen onNavigate={(view) => handleNavigate(view)} />;
      case 'customers': return <Customers />;
      case 'sales': return <Sales />;
      case 'installments': return <InstallmentsScreen />;
      case 'vendors': return <Vendors />;
      case 'purchases': return <Purchases />;
      case 'partnerBalances': return <PartnerBalances />;
      case 'warehouseBalances': return <WarehouseBalances onNavigate={(view) => handleNavigate(view)} />;
      case 'inventoryCount': return <InventoryCountScreen onNavigate={(view) => handleNavigate(view)} />;
      case 'items': return <Items />;
      case 'manufacturing': return <ManufacturingScreen />;
      case 'payroll': return <PayrollScreen />;
      case 'externalReceipt': return <ExternalReceiptVoucher />;
      case 'externalPayment': return <ExternalPaymentVoucher />;
      case 'internalReceipt': return <InternalReceiptVoucher />;
      case 'internalPayment': return <InternalPaymentVoucher />;
      case 'bankChecks': return <CheckPortfolioScreen onNavigate={(view) => handleNavigate(view)} />;
      case 'costCenters': return <CostCenterScreen onNavigate={(view) => handleNavigate(view)} />;
      case 'external': return <ExternalReceiptVoucher />;
      case 'internal': return <InternalReceiptVoucher />;
      case 'journalEntries': return <NewJournalEntry />;
      case 'auditTrail': return <AuditTrailScreen onNavigate={(view) => handleNavigate(view)} />;
      case 'settings': return <Settings onNavigateToDashboard={() => handleNavigate(null)} />;
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
    if (mobileNavigationController.canGoBack()) {
      mobileNavigationController.goBack();
    } else if (activeView === 'companyProfile') {
      handleNavigate(null);
    } else {
      handleNavigate('companyProfile');
    }
  };

  const getViewTitle = () => {
    switch (activeView) {
      case 'companyProfile': return t('nav_companyProfile', 'الواجهة الرئيسية (بيانات الشركة)');
      case 'auditTrail': return language === 'ar' ? 'سجل الأنشطة ومسارات التدقيق المالي' : 'Audit Trail & Activity Log';
      case 'settings': return t('nav_settings', 'إعدادات النظام');
      case 'journal': return t('nav_journal', 'القيود اليومية');
      case 'chartTree': return language === 'ar' ? 'دليل وشجرة الحسابات المالية (Tree)' : 'Chart of Accounts Tree';
      case 'trialBalance': return t('nav_trialBalance', 'ميزان المراجعة');
      case 'financialReports': return language === 'ar' ? 'التقارير المالية الختامية (قائمة الدخل والميزانية)' : 'Financial Statements (Income & Balance Sheet)';
      case "yearEndClosing": return language === 'ar' ? 'الإقفال السنوي وترحيل الأرصدة' : 'Year-End Closing & Balance Roll-forward';
      case 'customers': return t('nav_customers', 'إدارة العملاء');
      case 'sales': return t('nav_sales', 'فواتير المبيعات');
      case 'installments': return language === 'ar' ? 'إدارة التقسيط والكمبيالات والسندات لأمر' : 'Installments & Promissory Notes';
      case 'vendors': return t('nav_vendors', 'إدارة الموردين');
      case 'purchases': return t('nav_purchases', 'فواتير المشتريات');
      case 'partnerBalances': return t('nav_partnerBalances', 'أرصدة العملاء والموردين');
      case 'warehouseBalances': return t('nav_warehouseBalances', 'أرصدة المخزن');
      case 'inventoryCount': return language === 'ar' ? 'الجرد المخزني الدوري والتسويات الدفترية' : 'Inventory Stock Count & Adjustments';
      case 'items': return t('nav_items', 'إدارة الأصناف');
      case 'manufacturing': return language === 'ar' ? 'إدارة التصنيع والإنتاج وقوائم التكاليف (BOM)' : 'Manufacturing Orders & Bill of Materials (BOM)';
      case 'payroll': return language === 'ar' ? 'الموظفون والأجور والمكافآت والبدلات ومسير الرواتب' : 'Employees & Payroll Management';
      case 'externalReceipt': return t('nav_externalReceipt', 'سند قبض خارجي');
      case 'externalPayment': return t('nav_externalPayment', 'سند صرف خارجي');
      case 'internalReceipt': return t('nav_internalReceipt', 'سند قبض داخلي');
      case 'internalPayment': return t('nav_internalPayment', 'سند صرف داخلي');
      case 'bankChecks': return language === 'ar' ? 'دورة حياة وحافظة الشيكات البنكية' : 'Bank Check Portfolio & Tracking';
      case 'analytics': return language === 'ar' ? 'الرسوم البيانية والتحليلات (BI Hub)' : 'Visual BI & Analytics Hub';
      case 'external': return t('nav_externalReceipt', 'سند قبض خارجي');
      case 'internal': return t('nav_internalReceipt', 'سند قبض داخلي');
      default: return '';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] font-sans text-slate-900" dir={dir}>
      {/* Header */}
      <header className="h-16 bg-[#1e293b] text-white flex items-center justify-between px-3 sm:px-6 md:px-8 border-b border-slate-700 shrink-0 print:hidden z-20">
        <div className="flex items-center gap-2 sm:gap-3.5">
          {/* Sidebar Toggle Button (Mobile drawer / Desktop toggle) */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={
              (isMobileMenuOpen || isDesktopSidebarOpen)
                ? t('hideSidebar', 'إخفاء القائمة الجانبية (Ctrl+B)')
                : t('showSidebar', 'إظهار القائمة الجانبية (Ctrl+B)')
            }
            title={
              (isMobileMenuOpen || isDesktopSidebarOpen)
                ? (language === 'ar' ? 'إخفاء القائمة الجانبية (Ctrl+B)' : 'Hide Sidebar (Ctrl+B)')
                : (language === 'ar' ? 'إظهار القائمة الجانبية (Ctrl+B)' : 'Show Sidebar (Ctrl+B)')
            }
            className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center border shadow-2xs ${
              !isDesktopSidebarOpen
                ? 'bg-amber-500/20 text-amber-300 border-amber-400/50 hover:bg-amber-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700'
            }`}
          >
            {/* Mobile Icon */}
            <span className="md:hidden flex items-center justify-center">
              {isMobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
            </span>
            {/* Desktop Icon */}
            <span className="hidden md:flex items-center justify-center">
              {isDesktopSidebarOpen ? (
                isRtl ? <PanelRightClose size={19} /> : <PanelLeftClose size={19} />
              ) : (
                isRtl ? <PanelRightOpen size={19} /> : <PanelLeftOpen size={19} />
              )}
            </span>
          </button>

          <div 
            onClick={() => handleNavigate('companyProfile')} 
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none hover:opacity-95 transition-opacity group notranslate"
            title={language === 'ar' ? 'الواجهة الرئيسية (بيانات الشركة)' : 'Company Profile & Overview'}
            data-no-auto-translate="true"
            translate="no"
          >
            <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-linear-to-tr from-amber-500 via-amber-400 to-amber-300 rounded-xl flex items-center justify-center font-extrabold text-xs sm:text-sm shadow-md text-slate-950 font-sans tracking-tight border border-amber-300/40 group-hover:scale-105 transition-transform shrink-0 notranslate" translate="no">
              {language === 'ar' ? 'لوجوستريا' : 'LOGUSTRIA'}
            </div>
            <div className="notranslate" data-no-auto-translate="true" translate="no" key={`top-hdr-company-${language}`}>
              <h1 className="text-sm sm:text-base md:text-lg font-semibold leading-tight line-clamp-1 notranslate" translate="no">
                {language === 'ar' 
                  ? (systemSettings.company.nameAr || 'شركة لوجوستريا للمحاسبة والحلول المالية') 
                  : (systemSettings.company.nameEn || systemSettings.company.nameAr || 'Logustria Financial & ERP Solutions Co.')}
              </h1>
              <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider mt-0.5 line-clamp-1 notranslate" translate="no">
                {language === 'ar' 
                  ? (systemSettings.company.nameEn || 'Logustria Financial & ERP Solutions Co.') 
                  : (systemSettings.company.nameAr || 'شركة لوجوستريا للمحاسبة والحلول المالية')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Voice Search Quick Button */}
          <button
            type="button"
            onClick={() => setShowVoiceSearch(true)}
            title="البحث الصوتي الذكي للشاشات والحسابات (Ctrl+K أو Alt+V)"
            className="flex items-center gap-1.5 px-2 sm:px-3 h-8 sm:h-9 rounded-lg bg-indigo-600/25 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 hover:border-indigo-400 text-xs font-bold transition-all cursor-pointer shadow-xs group"
          >
            <Mic size={15} className="group-hover:scale-110 transition-transform text-indigo-400 group-hover:text-white" />
            <span className="hidden sm:inline">بحث صوتي</span>
            <span className="hidden lg:inline-block text-[10px] opacity-70 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-500/30 font-mono">
              Ctrl+K
            </span>
          </button>

          {/* Sync Status Indicator */}
          <GlobalSyncIndicator />

          {/* Quick Settings Button */}
          <button
            type="button"
            onClick={() => handleNavigate('settings')}
            title={t('systemSettingsBtn', 'إعدادات النظام')}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800 sm:bg-slate-700 hover:bg-slate-600 border border-slate-700 sm:border-slate-600 flex items-center justify-center text-slate-200 hover:text-white transition-colors cursor-pointer"
          >
            <SettingsIcon size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
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

        {/* Sidebar (Responsive: Permanent/Toggleable on Desktop, Slide-over Drawer on Mobile) */}
        <nav className={`
          fixed md:static inset-y-0 ${isRtl ? 'right-0' : 'left-0'} z-50
          w-72 sm:w-80
          bg-[#0f172a] text-slate-300 flex flex-col gap-1 shrink-0 overflow-y-auto print:hidden
          transition-all duration-300 ease-in-out shadow-2xl md:shadow-none
          ${isMobileMenuOpen 
            ? 'translate-x-0 p-4' 
            : isRtl ? 'translate-x-full md:translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isDesktopSidebarOpen 
            ? 'md:w-64 md:p-4 md:opacity-100 md:visible' 
            : 'md:w-0 md:p-0 md:opacity-0 md:invisible md:overflow-hidden md:pointer-events-none md:border-none'}
        `}>
          {/* Unified Sidebar Header */}
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800 shrink-0 notranslate" data-no-auto-translate="true" translate="no">
            <div className="flex items-center gap-2 min-w-0 notranslate" translate="no">
              <div className="px-2 py-0.5 bg-linear-to-r from-amber-500 to-amber-400 rounded-md flex items-center justify-center font-bold text-[11px] text-slate-950 shrink-0 notranslate" translate="no">
                {language === 'ar' ? 'لوجوستريا' : 'LOGUSTRIA'}
              </div>
              <div className="min-w-0 notranslate" translate="no" key={`sidebar-hdr-company-${language}`}>
                <span className="font-bold text-xs text-white truncate block notranslate" translate="no">
                  {language === 'ar' 
                    ? (systemSettings.company.nameAr || 'شركة لوجوستريا للمحاسبة والحلول المالية') 
                    : (systemSettings.company.nameEn || systemSettings.company.nameAr || 'Logustria Financial & ERP Solutions Co.')}
                </span>
                <span className="text-[9px] text-slate-400 truncate block notranslate" translate="no">
                  {language === 'ar' 
                    ? (systemSettings.company.nameEn || 'Logustria Financial & ERP Solutions Co.') 
                    : (systemSettings.company.nameAr || 'شركة لوجوستريا للمحاسبة والحلول المالية')}
                </span>
              </div>
            </div>
            
            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title={language === 'ar' ? 'إغلاق القائمة' : 'Close Menu'}
            >
              <X size={18} />
            </button>

            {/* Desktop Collapse Button */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title={language === 'ar' ? 'طي وإخفاء القائمة الجانبية (Ctrl+B)' : 'Hide Sidebar (Ctrl+B)'}
            >
              {isRtl ? <PanelRightClose size={17} /> : <PanelLeftClose size={17} />}
            </button>
          </div>

          {/* 1. الرئيسية وبيانات المنشأة */}
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
          <div onClick={() => handleNavigate('analytics')} className={navItemClass('analytics')}>
            <BarChart3 size={15} className="text-blue-400 shrink-0" /> 
            <span className="flex items-center justify-between flex-1">
              <span>{language === 'ar' ? 'الرسوم البيانية والتحليلات' : 'Analytics & Charts'}</span>
              <span className="text-[10px] font-bold text-blue-300 bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-700/60">BI Hub</span>
            </span>
          </div>

          {/* 2. العملاء والمبيعات والتقسيط */}
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

          {/* 3. الموردون والمشتريات */}
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

          {/* 4. الخزينة والبنوك */}
          <div className="mt-4 text-[10px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-wider">
            {t('nav_treasuryGroup', 'الخزينة والبنوك')}
          </div>
          <div onClick={() => handleNavigate('externalReceipt')} className={navItemClass('externalReceipt')}>
            <ArrowDownLeft size={15} className="text-emerald-400 shrink-0" />
            <span className="flex items-center justify-between flex-1">
              <span>{t('nav_externalReceipt', 'سند قبض خارجي')}</span>
              <span className="text-[10px] text-slate-400 font-normal">تحصيل عملاء</span>
            </span>
          </div>
          <div onClick={() => handleNavigate('externalPayment')} className={navItemClass('externalPayment')}>
            <ArrowUpRight size={15} className="text-rose-400 shrink-0" />
            <span className="flex items-center justify-between flex-1">
              <span>{t('nav_externalPayment', 'سند صرف خارجي')}</span>
              <span className="text-[10px] text-slate-400 font-normal">سداد موردين ومصاريف</span>
            </span>
          </div>
          <div onClick={() => handleNavigate('internalReceipt')} className={navItemClass('internalReceipt')}>
            <ArrowDownLeft size={15} className="text-teal-400 shrink-0" />
            <span className="flex items-center justify-between flex-1">
              <span>{t('nav_internalReceipt', 'سند قبض داخلي')}</span>
              <span className="text-[10px] text-slate-400 font-normal">تحويل بين الخزن</span>
            </span>
          </div>
          <div onClick={() => handleNavigate('internalPayment')} className={navItemClass('internalPayment')}>
            <ArrowUpRight size={15} className="text-amber-400 shrink-0" />
            <span className="flex items-center justify-between flex-1">
              <span>{t('nav_internalPayment', 'سند صرف داخلي')}</span>
              <span className="text-[10px] text-slate-400 font-normal">تحويل بين الخزن</span>
            </span>
          </div>
          <div onClick={() => handleNavigate('bankChecks')} className={navItemClass('bankChecks')}>
            <Landmark size={15} className="text-blue-400 shrink-0" />
            <span className="flex items-center justify-between flex-1">
              <span>{t('nav_bankChecks', 'حافظة ودورة الشيكات')}</span>
              <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-bold">CHQ</span>
            </span>
          </div>

          {/* 5. الأرصدة والذمم المالية */}
          <div className="mt-4 text-[10px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-wider">
            {t('nav_balancesGroup', 'الأرصدة والذمم المالية')}
          </div>
          <div onClick={() => handleNavigate('partnerBalances')} className={navItemClass('partnerBalances')}>
            <span className="text-xs text-indigo-400 font-bold font-mono bg-slate-800 px-1 rounded">BAL</span> 
            <span>{t('nav_partnerBalances', 'أرصدة العملاء والموردين')}</span>
          </div>

          {/* 6. المخزون والتصنيع والأصناف */}
          <div className="mt-4 text-[10px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-wider">
            {t('nav_inventoryGroup', 'المخزون والتصنيع والأصناف')}
          </div>
          <div onClick={() => handleNavigate('warehouseBalances')} className={navItemClass('warehouseBalances')}>
            <span className="text-xs text-blue-400 font-bold font-mono bg-slate-800 px-1 rounded">STK</span> 
            <span>{t('nav_warehouseBalances', 'أرصدة المخزن')}</span>
          </div>
          <div onClick={() => handleNavigate('inventoryCount')} className={navItemClass('inventoryCount')}>
            <ClipboardCheck size={15} className="text-emerald-400 shrink-0" /> 
            <span>{t('nav_inventoryCount', 'الجرد الدوري والتسويات')}</span>
          </div>
          <div onClick={() => handleNavigate('items')} className={navItemClass('items')}>
            <span className="text-xs opacity-80 font-mono bg-slate-800 px-1 rounded">ITM</span> 
            <span>{t('nav_items', 'إدارة الأصناف')}</span>
          </div>
          <div onClick={() => handleNavigate('manufacturing')} className={navItemClass('manufacturing')}>
            <span className="text-xs text-amber-400 font-bold font-mono bg-slate-800 px-1 rounded">MFG</span> 
            <span>{t('nav_manufacturing', 'إدارة التصنيع والإنتاج (BOM)')}</span>
          </div>

          {/* 7. الموارد البشرية والأجور */}
          <div className="mt-4 text-[10px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-wider">
            {t('nav_hrGroup', 'الموارد البشرية والأجور')}
          </div>
          <div onClick={() => handleNavigate('payroll')} className={navItemClass('payroll')}>
            <Users size={15} className="text-blue-400 shrink-0" /> 
            <span className="flex items-center justify-between flex-1">
              <span>{t('nav_payroll', 'الموظفون والأجور والبدلات (مسير الرواتب)')}</span>
              <span className="text-[10px] font-mono bg-slate-800 text-blue-300 px-1 rounded font-bold">HR</span>
            </span>
          </div>

          {/* 8. المحاسبة العامة */}
          <div className="mt-4 text-[10px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-wider">
            {t('nav_generalAccounting', 'المحاسبة العامة')}
          </div>
          <div onClick={() => handleNavigate('journal')} className={navItemClass('journal')}>
            <span className="text-xs font-mono bg-slate-800 px-1 rounded">GL</span> 
            <span>{t('nav_journal', 'القيود اليومية')}</span>
          </div>
          <div onClick={() => handleNavigate('chartTree')} className={navItemClass('chartTree')}>
            <span className="text-xs font-mono bg-slate-800 text-indigo-400 px-1 rounded">COA</span> 
            <span>{t('nav_chartTree', 'شجرة الحسابات المالية (Tree)')}</span>
          </div>
          <div onClick={() => handleNavigate('trialBalance')} className={navItemClass('trialBalance')}>
            <span className="text-xs font-mono bg-slate-800 text-amber-400 px-1 rounded">TB</span> 
            <span>{t('nav_trialBalance', 'ميزان المراجعة')}</span>
          </div>
          <div onClick={() => handleNavigate('financialReports')} className={navItemClass('financialReports')}>
            <span className="text-xs font-mono bg-slate-800 text-blue-400 px-1 rounded">FS</span> 
            <span>{t('nav_financialReports', 'التقارير المالية الختامية')}</span>
          </div>
          <div onClick={() => handleNavigate('costCenters')} className={navItemClass('costCenters')}>
            <span className="text-xs font-mono bg-slate-800 text-purple-400 px-1 rounded">CC</span> 
            <span className="flex items-center justify-between flex-1">
              <span>{t('nav_costCenters', 'مراكز التكلفة والمشاريع')}</span>
              <span className="text-[10px] font-bold text-purple-300 bg-purple-900/60 px-1.5 py-0.5 rounded border border-purple-700/50">{t('nav_costCentersBadge', 'أرباح وخسائر')}</span>
            </span>
          </div>
          <div onClick={() => handleNavigate("yearEndClosing")} className={navItemClass("yearEndClosing")}>
            <span className="text-xs font-mono bg-slate-800 text-rose-400 px-1 rounded">YC</span>
            <span>{t('nav_yearEndClosing', 'الإقفال السنوي وترحيل الأرصدة')}</span>
          </div>

          {/* الإدارة والنظام */}
          <div className="mt-4 text-[10px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-wider">
            {t('nav_adminGroup', 'الإدارة والنظام')}
          </div>
          <div onClick={() => handleNavigate('auditTrail')} className={navItemClass('auditTrail')}>
            <ShieldAlert size={15} className="text-indigo-400 shrink-0" /> 
            <span className="flex items-center justify-between flex-1">
              <span>{language === 'ar' ? 'سجل الأنشطة والتدقيق (Audit)' : 'Audit Trail & Log'}</span>
              <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-bold">LOG</span>
            </span>
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

            {/* 0. البحث الصوتي السريع */}
            <button
              type="button"
              onClick={() => {
                setShowVoiceSearch(true);
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-200 hover:text-white border border-indigo-700/50 text-xs font-bold transition-all cursor-pointer shadow-2xs group"
              title="البحث الصوتي عن شاشات النظام والحسابات (Ctrl+K أو Alt+V)"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                  <Mic size={14} />
                </div>
                <span>{language === 'ar' ? 'البحث الصوتي الذكي' : 'Voice Assistant'}</span>
              </div>
              <span className="text-[10px] font-mono text-indigo-300 bg-indigo-900/70 px-1.5 py-0.5 rounded border border-indigo-600/40">
                Ctrl+K
              </span>
            </button>

            {/* 1. السنة المالية (Fiscal Year) */}
            <FiscalYearSelector 
              fullWidth 
              onNavigateToYearEnd={() => {
                handleNavigate('yearEndClosing');
                setIsMobileMenuOpen(false);
              }} 
            />

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
        <main className="flex-1 p-2 sm:p-4 md:p-6 lg:p-8 overflow-y-auto flex flex-col bg-[#f1f5f9] print:p-0 relative pb-20 md:pb-8">
          <div className="w-full max-w-7xl 2xl:max-w-[1700px] mx-auto flex-1 flex flex-col transition-all">
            {/* Archived Fiscal Year Read-Only Banner */}
            <FiscalYearArchiveBanner onNavigateToYearEnd={() => handleNavigate('yearEndClosing')} />

            {activeView ? (
              <div className="flex flex-col flex-1">
                {/* View Top Bar with Return to Company Profile / Dashboard Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 mb-4 sm:mb-6 border-b border-slate-200 print:hidden">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {!isDesktopSidebarOpen && (
                      <button
                        type="button"
                        onClick={toggleSidebar}
                        className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 px-3 py-2 rounded-xl transition-all shadow-2xs cursor-pointer"
                        title={language === 'ar' ? 'إظهار القائمة الجانبية (Ctrl+B)' : 'Show Sidebar (Ctrl+B)'}
                      >
                        {isRtl ? <PanelRightOpen size={16} className="text-amber-500" /> : <PanelLeftOpen size={16} className="text-amber-500" />}
                        <span>{language === 'ar' ? 'إظهار القائمة' : 'Show Menu'}</span>
                      </button>
                    )}
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
                    <span>{language === 'ar' ? (systemSettings.company.nameAr || 'نظام لوجوستريا') : (systemSettings.company.nameEn || systemSettings.company.nameAr || 'Logustria ERP')}</span>
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
            onClick={() => setShowVoiceSearch(true)}
            className="flex flex-col items-center justify-center flex-1 py-1 text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
            title="بحث صوتي سريع"
          >
            <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center">
              <Mic size={14} className="text-indigo-300" />
            </div>
            <span className="text-[8px] mt-0.5 whitespace-nowrap font-bold">صوتي</span>
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

      {/* Voice Search Modal for quick navigation and Chart of Accounts lookup */}
      <VoiceSearchModal 
        isOpen={showVoiceSearch}
        onClose={() => setShowVoiceSearch(false)}
        onNavigate={(viewId) => handleNavigate(viewId)}
      />

      {/* Floating System Reset Success Toast Notification */}
      {resetToast && (
        <div 
          className="fixed top-5 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:right-8 z-50 w-11/12 max-w-md bg-slate-900 text-white rounded-2xl shadow-2xl border border-emerald-500/40 p-4 animate-in slide-in-from-top-4 duration-300 flex items-start gap-3"
          dir={dir}
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h5 className="font-extrabold text-sm text-emerald-400 leading-tight">
                {resetToast.title}
              </h5>
              <button
                type="button"
                onClick={() => setResetToast(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {resetToast.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


