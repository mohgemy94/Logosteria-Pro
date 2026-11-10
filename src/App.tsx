import { useState, useEffect, useRef, useCallback } from 'react';
import { DesktopWindowManager, type DesktopWindow } from './components/DesktopWindowManager';
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
  ShieldAlert,
  FileSpreadsheet,
  AppWindow
} from 'lucide-react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ReportsHubScreen } from './components/ReportsHubScreen';
import { PurchasesReportsHubScreen } from './components/PurchasesReportsHubScreen';
import { TotalSalesInvoices } from './pages/reports/sales/TotalSalesInvoices';
import { TotalPurchaseInvoices } from './pages/reports/purchases/TotalPurchaseInvoices';
import { SupplierPurchasesSummary } from './pages/reports/purchases/SupplierPurchasesSummary';
import { MainCategoryPurchases } from './pages/reports/purchases/MainCategoryPurchases';
import { SubCategoryItemPurchases } from './pages/reports/purchases/SubCategoryItemPurchases';
import { InventoryAndPurchasesAnalysis } from './pages/reports/purchases/InventoryAndPurchasesAnalysis';
import { SingleItemPurchaseAnalysis } from './pages/reports/purchases/SingleItemPurchaseAnalysis';
import { SupplierBonusesSummary } from './pages/reports/purchases/SupplierBonusesSummary';
import { DetailedSupplierBonuses } from './pages/reports/purchases/DetailedSupplierBonuses';
import { ItemSalesAnalysis } from './pages/reports/sales/ItemSalesAnalysis';
import { TechnicianSales } from './pages/reports/sales/TechnicianSales';
import { DailyItemProfits } from './pages/reports/profitability/DailyItemProfits';
import { BelowCostSales } from './pages/reports/profitability/BelowCostSales';
import { BonusesAndSamples } from './pages/reports/profitability/BonusesAndSamples';
import { SalesProfitabilitySummary } from './pages/reports/profitability/SalesProfitabilitySummary';
import { CustomerSalesSummary } from './pages/reports/sales/CustomerSalesSummary';
import DetailedStatementScreen from './components/DetailedStatementScreen';
import CustomerStatementScreen from './components/CustomerStatementScreen';
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
import AccountMovementsScreen from './components/AccountMovementsScreen';
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
import { mobileNavigationController, useSequentialNavigation } from './utils/mobileNavigation';
import { useSwipeBack } from './hooks/useSwipeBack';
import { getSystemSettings } from './utils/settings';
import { useLanguage } from './i18n/LanguageContext';
import AlertsNotificationBell from './components/AlertsNotificationBell';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeView, setActiveView] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/reports') {
        return 'reportsHub';
      }
      if (window.location.pathname === '/reports/purchases/single-item-analysis') {
        return 'singleItemPurchaseAnalysis';
      }
      if (window.location.pathname === '/reports/purchases/supplier-bonuses') {
        return 'supplierBonusesSummary';
      }
      if (window.location.pathname === '/reports/purchases/detailed-supplier-bonuses') {
        return 'detailedSupplierBonuses';
      }
      if (window.location.pathname === '/reports/purchases/inventory-analysis') {
        return 'inventoryAndPurchasesAnalysis';
      }
      if (window.location.pathname === '/reports/sales/total-invoices') {
        return 'totalSalesInvoices';
      }
      if (window.location.pathname === '/reports/profitability/daily-item-profits') {
        return 'dailyItemProfits';
      }
      if (window.location.pathname === '/reports/profitability/below-cost') {
        return 'belowCostSales';
      }
      if (window.location.pathname === '/reports/profitability/bonuses') {
        return 'bonusesAndSamples';
      }
      if (window.location.pathname === '/reports/sales/customers-summary') {
        return 'customerSalesSummary';
      }
    }
    return 'companyProfile'; // Company Profile (بيانات الشركة) is the default startup screen
  });
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
  const { canGoBack, previousViewTitle, goBack: stepBack } = useSequentialNavigation();
  const [resetToast, setResetToast] = useState<{
    title: string;
    message: string;
    type: 'success' | 'info';
  } | null>(null);

  // Desktop Multi-Window (MDI) State
  const [isMultiWindowMode, setIsMultiWindowMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('logosteria_mdi_mode') !== 'false';
    } catch {
      return true;
    }
  });

  const [isDesktopScreen, setIsDesktopScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => setIsDesktopScreen(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const nextZIndexRef = useRef<number>(110);

  const getViewTitle = (targetView?: string | null) => {
    const v = targetView !== undefined ? targetView : activeView;
    switch (v) {
      case 'companyProfile': return t('nav_companyProfile', 'الواجهة الرئيسية (بيانات الشركة)');
      case 'dashboard':
      case null: return language === 'ar' ? 'لوحة المؤشرات والقيادة' : 'Main Dashboard';
      case 'reportsHub': return language === 'ar' ? 'مركز تقارير المبيعات' : 'Sales Reports Hub';
      case 'auditTrail': return language === 'ar' ? 'سجل الأنشطة ومسارات التدقيق المالي' : 'Audit Trail & Activity Log';
      case 'settings': return t('nav_settings', 'إعدادات النظام');
      case 'journal': return t('nav_journal', 'القيود اليومية');
      case 'chartTree': return language === 'ar' ? 'دليل وشجرة الحسابات المالية (Tree)' : 'Chart of Accounts Tree';
      case 'trialBalance': return t('nav_trialBalance', 'ميزان المراجعة');
      case 'accountMovements': return language === 'ar' ? 'حركة الحسابات' : 'Account Movements';
      case 'financialReports': return language === 'ar' ? 'التقارير المالية الختامية (قائمة الدخل والميزانية)' : 'Financial Statements (Income & Balance Sheet)';
      case "yearEndClosing": return language === 'ar' ? 'الإقفال السنوي وترحيل الأرصدة' : 'Year-End Closing & Balance Roll-forward';
      case 'customers': return t('nav_customers', 'إدارة العملاء');
      case 'sales': return t('nav_sales', 'فواتير المبيعات');
      case 'totalSalesInvoices': return language === 'ar' ? 'تقرير إجمالي فواتير المبيعات' : 'Total Sales Invoices Report';
      case 'itemSalesAnalysis': return language === 'ar' ? 'تقرير تحليل مبيعات الأصناف (الأكثر مبيعاً)' : 'Item Sales & Best Sellers Analysis';
      case 'technicianSales': return language === 'ar' ? 'تقرير مبيعات الفنيين ومندوبي المبيعات' : 'Technicians & Sales Reps Performance Report';
      case 'dailyItemProfits': return language === 'ar' ? 'تقرير أرباح الأصناف اليومية' : 'Daily Item Profits Report';
      case 'belowCostSales': return language === 'ar' ? 'تقرير تحليلي: أصناف بيع بأقل من التكلفة' : 'Sales Below Cost Analysis Report';
      case 'bonusesAndSamples': return language === 'ar' ? 'تقرير البوانص والعينات المجانية والهدايا' : 'Bonuses & Samples Report';
      case 'salesProfitabilitySummary': return language === 'ar' ? 'تقرير تحليل ربحية المبيعات الشامل' : 'Sales Profitability Summary Report';
      case 'customerSalesSummary': return language === 'ar' ? 'تقرير إجمالي مبيعات ومسحوبات العملاء' : 'Customer Sales Summary';
      case 'installments': return language === 'ar' ? 'إدارة التقسيط والكمبيالات والسندات لأمر' : 'Installments & Promissory Notes';
      case 'vendors': return t('nav_vendors', 'إدارة الموردين');
      case 'purchases': return t('nav_purchases', 'فواتير المشتريات');
      case 'purchasesReportsHub': return language === 'ar' ? 'مركز تقارير المشتريات' : 'Purchases Reports Hub';
      case 'totalPurchaseInvoices': return language === 'ar' ? 'تقرير إجمالي فواتير المشتريات' : 'Total Purchase Invoices Report';
      case 'supplierPurchasesSummary': return language === 'ar' ? 'تقرير إجمالي مشتريات ومسحوبات الموردين' : 'Supplier Purchases Summary Report';
      case 'mainCategoryPurchases': return language === 'ar' ? 'تقرير مشتريات الفئات الرئيسية' : 'Main Category Purchases Report';
      case 'subCategoryItemPurchases': return language === 'ar' ? 'تقرير مشتريات الفئات الفرعية والأصناف' : 'Subcategory & Item Purchases Report';
      case 'inventoryAndPurchasesAnalysis': return language === 'ar' ? 'تقرير تحليل المخزون وحركة المشتريات' : 'Inventory & Purchases Analysis Report';
      case 'singleItemPurchaseAnalysis': return language === 'ar' ? 'تقرير تحليل حركة شراء صنف محدد' : 'Single Item Purchase Analysis Report';
      case 'supplierBonusesSummary': return language === 'ar' ? 'تقرير ملخص بوانص وهدايا الموردين' : 'Supplier Bonuses Summary Report';
      case 'detailedSupplierBonuses': return language === 'ar' ? 'تقرير سجل بوانص وهدايا الموردين التفصيلي' : 'Detailed Supplier Bonuses Audit Trail';
      case 'partnerBalances': return t('nav_partnerBalances', 'أرصدة العملاء والموردين');
      case 'customerStatement': return language === 'ar' ? 'كشف حساب عميل أو مورد' : 'Customer & Vendor Account Statement';
      case 'partnerStatement': return language === 'ar' ? 'كشف حساب تفصيلي للعميل / المورد' : 'Detailed Account Statement';
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
      case 'costCenters': return language === 'ar' ? 'مراكز التكلفة' : 'Cost Centers';
      case 'analytics': return language === 'ar' ? 'الرسوم البيانية والتحليلات (BI Hub)' : 'Visual BI & Analytics Hub';
      case 'external': return t('nav_externalReceipt', 'سند قبض خارجي');
      case 'internal': return t('nav_internalReceipt', 'سند قبض داخلي');
      case 'journalEntries': return t('nav_journal', 'القيود اليومية');
      default: return '';
    }
  };

  const getWindowMeta = (view: string, lang: 'ar' | 'en'): { title: string; badge: string; badgeColor: string } => {
    const title = getViewTitle(view) || (lang === 'ar' ? 'نافذة عمل' : 'Work Window');
    switch (view) {
      case 'sales': return { title, badge: 'INV', badgeColor: 'bg-blue-600 text-white' };
      case 'purchases': return { title, badge: 'PO', badgeColor: 'bg-amber-600 text-white' };
      case 'customers': return { title, badge: 'AR', badgeColor: 'bg-emerald-600 text-white' };
      case 'vendors': return { title, badge: 'AP', badgeColor: 'bg-purple-600 text-white' };
      case 'installments': return { title, badge: 'INS', badgeColor: 'bg-teal-600 text-white' };
      case 'customerStatement': return { title, badge: 'CUST', badgeColor: 'bg-teal-700 text-white' };
      case 'partnerStatement': return { title, badge: 'STMT', badgeColor: 'bg-blue-700 text-white' };
      case 'journal':
      case 'journalEntries': return { title, badge: 'JRN', badgeColor: 'bg-cyan-600 text-white' };
      case 'chartTree': return { title, badge: 'COA', badgeColor: 'bg-sky-600 text-white' };
      case 'trialBalance': return { title, badge: 'TB', badgeColor: 'bg-rose-600 text-white' };
      case 'accountMovements': return { title, badge: 'ACC', badgeColor: 'bg-indigo-600 text-white' };
      case 'financialReports': return { title, badge: 'FIN', badgeColor: 'bg-emerald-700 text-white' };
      case "yearEndClosing": return { title, badge: 'YEC', badgeColor: 'bg-purple-700 text-white' };
      case 'partnerBalances': return { title, badge: 'BAL', badgeColor: 'bg-amber-700 text-white' };
      case 'warehouseBalances': return { title, badge: 'STK', badgeColor: 'bg-indigo-600 text-white' };
      case 'inventoryCount': return { title, badge: 'INV-C', badgeColor: 'bg-orange-600 text-white' };
      case 'items': return { title, badge: 'ITM', badgeColor: 'bg-slate-700 text-white' };
      case 'manufacturing': return { title, badge: 'MFG', badgeColor: 'bg-stone-700 text-white' };
      case 'payroll': return { title, badge: 'HR', badgeColor: 'bg-pink-700 text-white' };
      case 'externalReceipt':
      case 'external': return { title, badge: 'CR-O', badgeColor: 'bg-emerald-600 text-white' };
      case 'externalPayment': return { title, badge: 'DR-O', badgeColor: 'bg-rose-600 text-white' };
      case 'internalReceipt':
      case 'internal': return { title, badge: 'CR-I', badgeColor: 'bg-emerald-700 text-white' };
      case 'internalPayment': return { title, badge: 'DR-I', badgeColor: 'bg-rose-700 text-white' };
      case 'bankChecks': return { title, badge: 'CHK', badgeColor: 'bg-amber-600 text-white' };
      case 'costCenters': return { title, badge: 'CC', badgeColor: 'bg-cyan-700 text-white' };
      case 'auditTrail': return { title, badge: 'AUD', badgeColor: 'bg-yellow-700 text-white' };
      case 'analytics': return { title, badge: 'BI', badgeColor: 'bg-blue-600 text-white' };
      case 'reportsHub': return { title, badge: 'HUB', badgeColor: 'bg-indigo-600 text-white' };
      case 'purchasesReportsHub': return { title, badge: 'HUB', badgeColor: 'bg-emerald-600 text-white' };
      case 'totalSalesInvoices': return { title, badge: 'RPT', badgeColor: 'bg-blue-600 text-white' };
      case 'totalPurchaseInvoices': return { title, badge: 'RPT', badgeColor: 'bg-amber-600 text-white' };
      case 'supplierPurchasesSummary': return { title, badge: 'RPT', badgeColor: 'bg-amber-600 text-white' };
      case 'mainCategoryPurchases': return { title, badge: 'RPT', badgeColor: 'bg-purple-600 text-white' };
      case 'subCategoryItemPurchases': return { title, badge: 'RPT', badgeColor: 'bg-sky-600 text-white' };
      case 'inventoryAndPurchasesAnalysis': return { title, badge: 'RPT', badgeColor: 'bg-teal-600 text-white' };
      case 'singleItemPurchaseAnalysis': return { title, badge: 'RPT', badgeColor: 'bg-cyan-600 text-white' };
      case 'supplierBonusesSummary': return { title, badge: 'RPT', badgeColor: 'bg-emerald-600 text-white' };
      case 'detailedSupplierBonuses': return { title, badge: 'RPT', badgeColor: 'bg-emerald-700 text-white' };
      case 'itemSalesAnalysis': return { title, badge: 'RPT', badgeColor: 'bg-blue-700 text-white' };
      case 'technicianSales': return { title, badge: 'RPT', badgeColor: 'bg-indigo-700 text-white' };
      case 'dailyItemProfits': return { title, badge: 'RPT', badgeColor: 'bg-green-600 text-white' };
      case 'belowCostSales': return { title, badge: 'RPT', badgeColor: 'bg-rose-600 text-white' };
      case 'bonusesAndSamples': return { title, badge: 'RPT', badgeColor: 'bg-amber-600 text-white' };
      case 'salesProfitabilitySummary': return { title, badge: 'RPT', badgeColor: 'bg-indigo-600 text-white' };
      case 'customerSalesSummary': return { title, badge: 'RPT', badgeColor: 'bg-emerald-600 text-white' };
      case 'dashboard': return { title: language === 'ar' ? 'لوحة المؤشرات والقيادة' : 'Dashboard', badge: 'DASH', badgeColor: 'bg-emerald-600 text-white' };
      case 'companyProfile': return { title, badge: 'INFO', badgeColor: 'bg-amber-600 text-white' };
      case 'settings': return { title, badge: 'SET', badgeColor: 'bg-slate-700 text-white' };
      default: return { title, badge: 'WIN', badgeColor: 'bg-slate-700 text-white' };
    }
  };

  const [windows, setWindows] = useState<DesktopWindow[]>([]);

  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);

  const handleFocusWindow = (id: string) => {
    nextZIndexRef.current += 1;
    setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: nextZIndexRef.current, isMinimized: false } : w));
    setActiveWindowId(id);
    const win = windows.find(w => w.id === id);
    if (win) {
      setActiveView(win.view);
    }
  };

  const handleCloseWindow = (id: string) => {
    setWindows(prev => {
      const remaining = prev.filter(w => w.id !== id);
      if (activeWindowId === id) {
        const topRemaining = [...remaining].filter(w => !w.isMinimized).sort((a, b) => b.zIndex - a.zIndex)[0];
        setActiveWindowId(topRemaining ? topRemaining.id : null);
        setActiveView(topRemaining ? topRemaining.view : 'companyProfile');
      }
      return remaining;
    });
  };

  const handleMinimizeWindow = (id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: true } : w));
    if (activeWindowId === id) {
      setWindows(prev => {
        const remaining = prev.filter(w => w.id !== id && !w.isMinimized).sort((a, b) => b.zIndex - a.zIndex);
        setActiveWindowId(remaining[0] ? remaining[0].id : null);
        setActiveView(remaining[0] ? remaining[0].view : 'companyProfile');
        return prev;
      });
    }
  };

  const handleRestoreWindow = (id: string) => {
    nextZIndexRef.current += 1;
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: false, zIndex: nextZIndexRef.current } : w));
    setActiveWindowId(id);
    const win = windows.find(w => w.id === id);
    if (win) {
      setActiveView(win.view);
    }
  };

  const handleToggleMaximize = (id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMaximized: !w.isMaximized } : w));
    handleFocusWindow(id);
  };

  const handleUpdatePosition = useCallback((id: string, x: number, y: number) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, x, y } : w));
  }, []);

  const handleUpdateDimensions = useCallback((id: string, width: number, height: number, x?: number, y?: number) => {
    setWindows(prev => prev.map(w => {
      if (w.id !== id) return w;
      return {
        ...w,
        width,
        height,
        ...(x !== undefined ? { x } : {}),
        ...(y !== undefined ? { y } : {})
      };
    }));
  }, []);

  const handleCascadeWindows = () => {
    const isDesktopRtl = language === 'ar';
    const workspaceW = typeof window !== 'undefined' ? window.innerWidth - (isDesktopSidebarOpen ? 280 : 30) : 1200;
    const defaultW = 860;
    setWindows(prev => prev.map((w, idx) => {
      const offset = (idx % 6) * 36;
      const x = isDesktopRtl
        ? Math.max(20, workspaceW - defaultW - offset - 20)
        : offset + 20;
      return {
        ...w,
        isMinimized: false,
        isMaximized: false,
        x,
        y: offset + 20,
        zIndex: 100 + idx
      };
    }));
  };

  const handleTileWindows = () => {
    const isDesktopRtl = language === 'ar';
    setWindows(prev => {
      const visible = prev.filter(w => !w.isMinimized);
      if (visible.length === 0) return prev;
      return prev.map((w) => {
        if (w.isMinimized) return w;
        const vIdx = visible.findIndex(v => v.id === w.id);
        const col = vIdx % 2;
        const row = Math.floor(vIdx / 2);
        const colX = isDesktopRtl
          ? (col === 0 ? 620 : 20)
          : (col === 0 ? 20 : 620);
        return {
          ...w,
          isMaximized: false,
          x: colX,
          y: row * 380 + 20,
          width: 580,
          height: 520
        };
      });
    });
  };

  const handleMinimizeAll = () => {
    setWindows(prev => prev.map(w => ({ ...w, isMinimized: true })));
    setActiveWindowId(null);
    setActiveView('companyProfile');
  };

  const handleRestoreAll = () => {
    setWindows(prev => prev.map(w => ({ ...w, isMinimized: false })));
  };

  const handleCloseAll = () => {
    setWindows([]);
    setActiveWindowId(null);
    setActiveView('companyProfile');
  };

  const handleToggleMultiWindowMode = () => {
    setIsMultiWindowMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem('logosteria_mdi_mode', String(next));
      } catch {}
      return next;
    });
  };

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
      if (!e.key) return;
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault();
        setShowVoiceSearch(prev => !prev);
      } else if (e.altKey && (key === 'v' || e.key === 'ر')) {
        e.preventDefault();
        setShowVoiceSearch(prev => !prev);
      } else if (((e.ctrlKey || e.metaKey) && key === 'b') || (e.altKey && (key === 'b' || e.key === 'لا'))) {
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
      setWindows([]);
      setActiveWindowId(null);
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

  // Sync URL location with activeView
  useEffect(() => {
    if (location.pathname === '/reports') {
      setActiveView('reportsHub');
    } else if (location.pathname === '/reports/purchases') {
      setActiveView('purchasesReportsHub');
    } else if (location.pathname === '/reports/sales/total-invoices') {
      setActiveView('totalSalesInvoices');
    } else if (location.pathname === '/reports/purchases/total-invoices') {
      setActiveView('totalPurchaseInvoices');
    } else if (location.pathname === '/reports/purchases/suppliers-summary') {
      setActiveView('supplierPurchasesSummary');
    } else if (location.pathname === '/reports/purchases/categories-summary' || location.pathname === '/reports/purchases/main-category') {
      setActiveView('mainCategoryPurchases');
    } else if (location.pathname === '/reports/purchases/sub-categories') {
      setActiveView('subCategoryItemPurchases');
    } else if (location.pathname === '/reports/purchases/inventory-analysis') {
      setActiveView('inventoryAndPurchasesAnalysis');
    } else if (location.pathname === '/reports/purchases/single-item-analysis') {
      setActiveView('singleItemPurchaseAnalysis');
    } else if (location.pathname === '/reports/purchases/supplier-bonuses') {
      setActiveView('supplierBonusesSummary');
    } else if (location.pathname === '/reports/purchases/detailed-supplier-bonuses') {
      setActiveView('detailedSupplierBonuses');
    } else if (location.pathname === '/reports/sales/items-summary') {
      setActiveView('itemSalesAnalysis');
    } else if (location.pathname === '/reports/sales/technicians') {
      setActiveView('technicianSales');
    } else if (location.pathname === '/reports/profitability/daily-item-profits') {
      setActiveView('dailyItemProfits');
    } else if (location.pathname === '/reports/profitability/below-cost') {
      setActiveView('belowCostSales');
    } else if (location.pathname === '/reports/profitability/bonuses') {
      setActiveView('bonusesAndSamples');
    } else if (location.pathname === '/reports/profitability/margins') {
      setActiveView('salesProfitabilitySummary');
    } else if (location.pathname === '/reports/sales/customers-summary') {
      setActiveView('customerSalesSummary');
    }
  }, [location.pathname]);

  // Navigate to view with history recording & multi-window desktop support
  const handleNavigate = (view: string | null) => {
    mobileNavigationController.pushView(view);
    setActiveView(view);
    setIsMobileMenuOpen(false);

    // On Desktop when Multi-Window MDI mode is active
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
    if (isDesktop && isMultiWindowMode) {
      if (view === 'companyProfile') {
        // Show the fixed background screen directly without any window
        setActiveWindowId(null);
        setActiveView('companyProfile');
        setWindows(prev => prev.filter(w => w.view !== 'companyProfile'));
        return;
      }

      const targetView = view || 'dashboard';
      setActiveView(targetView);
      setWindows(prev => {
        const existing = prev.find(w => w.view === targetView);
        nextZIndexRef.current += 1;
        const newZ = nextZIndexRef.current;

        if (existing) {
          setActiveWindowId(existing.id);
          return prev.map(w =>
            w.id === existing.id
              ? { ...w, isMinimized: false, isMaximized: true, zIndex: newZ }
              : w
          );
        }

        const meta = getWindowMeta(targetView, language);
        const newWin: DesktopWindow = {
          id: `win_${targetView}_${Date.now()}`,
          view: targetView,
          title: meta.title,
          badge: meta.badge,
          badgeColor: meta.badgeColor,
          isMinimized: false,
          isMaximized: true, // Always open screen in full screen mode!
          zIndex: newZ,
          x: 0,
          y: 0,
        };

        setActiveWindowId(newWin.id);
        return [...prev, newWin];
      });
    }

    if (view === 'reportsHub') {
      if (location.pathname !== '/reports') {
        navigate('/reports');
      }
    } else if (view === 'purchasesReportsHub') {
      if (location.pathname !== '/reports/purchases') {
        navigate('/reports/purchases');
      }
    } else if (view === 'totalSalesInvoices') {
      if (location.pathname !== '/reports/sales/total-invoices') {
        navigate('/reports/sales/total-invoices');
      }
    } else if (view === 'totalPurchaseInvoices') {
      if (location.pathname !== '/reports/purchases/total-invoices') {
        navigate('/reports/purchases/total-invoices');
      }
    } else if (view === 'supplierPurchasesSummary') {
      if (location.pathname !== '/reports/purchases/suppliers-summary') {
        navigate('/reports/purchases/suppliers-summary');
      }
    } else if (view === 'mainCategoryPurchases') {
      if (location.pathname !== '/reports/purchases/categories-summary') {
        navigate('/reports/purchases/categories-summary');
      }
    } else if (view === 'subCategoryItemPurchases') {
      if (location.pathname !== '/reports/purchases/sub-categories') {
        navigate('/reports/purchases/sub-categories');
      }
    } else if (view === 'inventoryAndPurchasesAnalysis') {
      if (location.pathname !== '/reports/purchases/inventory-analysis') {
        navigate('/reports/purchases/inventory-analysis');
      }
    } else if (view === 'singleItemPurchaseAnalysis') {
      if (location.pathname !== '/reports/purchases/single-item-analysis') {
        navigate('/reports/purchases/single-item-analysis');
      }
    } else if (view === 'supplierBonusesSummary') {
      if (location.pathname !== '/reports/purchases/supplier-bonuses') {
        navigate('/reports/purchases/supplier-bonuses');
      }
    } else if (view === 'detailedSupplierBonuses') {
      if (location.pathname !== '/reports/purchases/detailed-supplier-bonuses') {
        navigate('/reports/purchases/detailed-supplier-bonuses');
      }
    } else if (view === 'itemSalesAnalysis') {
      if (location.pathname !== '/reports/sales/items-summary') {
        navigate('/reports/sales/items-summary');
      }
    } else if (view === 'technicianSales') {
      if (location.pathname !== '/reports/sales/technicians') {
        navigate('/reports/sales/technicians');
      }
    } else if (view === 'dailyItemProfits') {
      if (location.pathname !== '/reports/profitability/daily-item-profits') {
        navigate('/reports/profitability/daily-item-profits');
      }
    } else if (view === 'belowCostSales') {
      if (location.pathname !== '/reports/profitability/below-cost') {
        navigate('/reports/profitability/below-cost');
      }
    } else if (view === 'bonusesAndSamples') {
      if (location.pathname !== '/reports/profitability/bonuses') {
        navigate('/reports/profitability/bonuses');
      }
    } else if (view === 'salesProfitabilitySummary') {
      if (location.pathname !== '/reports/profitability/margins') {
        navigate('/reports/profitability/margins');
      }
    } else if (view === 'customerSalesSummary') {
      if (location.pathname !== '/reports/sales/customers-summary') {
        navigate('/reports/sales/customers-summary');
      }
    } else {
      if (
        location.pathname === '/reports' ||
        location.pathname === '/reports/purchases' ||
        location.pathname === '/reports/sales/total-invoices' || 
        location.pathname === '/reports/purchases/inventory-analysis' ||
        location.pathname === '/reports/purchases/single-item-analysis' ||
        location.pathname === '/reports/purchases/supplier-bonuses' ||
        location.pathname === '/reports/purchases/detailed-supplier-bonuses' ||
        location.pathname === '/reports/purchases/total-invoices' || 
        location.pathname === '/reports/purchases/suppliers-summary' || 
        location.pathname === '/reports/sales/items-summary' ||
        location.pathname === '/reports/sales/technicians' ||
        location.pathname === '/reports/profitability/daily-item-profits' ||
        location.pathname === '/reports/profitability/below-cost' ||
        location.pathname === '/reports/profitability/bonuses' ||
        location.pathname === '/reports/profitability/margins' ||
        location.pathname === '/reports/sales/customers-summary'
      ) {
        navigate('/');
      }
    }
  };

  const renderViewComponent = (viewName: string | null, isInWindow: boolean = false) => {
    switch (viewName) {
      case 'dashboard':
      case null: return (
        <DashboardScreen 
          onNavigate={(view) => handleNavigate(view)} 
          systemSettings={systemSettings} 
        />
      );
      case 'companyProfile': return (
        <CompanyProfileScreen 
          systemSettings={systemSettings} 
          onNavigateToSettings={() => handleNavigate('settings')} 
          onNavigateToDashboard={() => handleNavigate(null)}
          onNavigate={(view) => handleNavigate(view)}
        />
      );
      case 'reportsHub': return <ReportsHubScreen onNavigate={(view) => handleNavigate(view)} isInWindow={isInWindow} />;
      case 'purchasesReportsHub': return <PurchasesReportsHubScreen onNavigate={(view) => handleNavigate(view)} />;
      case 'analytics': return <AnalyticsScreen onNavigate={(view) => handleNavigate(view)} isInWindow={isInWindow} />;
      case 'journal': return <NewJournalEntry />;
      case 'chartTree': return <ChartOfAccountsTree isInWindow={isInWindow} />;
      case 'trialBalance': return <TrialBalanceScreen onNavigate={(view) => handleNavigate(view)} isInWindow={isInWindow} />;
      case 'accountMovements': return <AccountMovementsScreen onNavigate={(view) => handleNavigate(view)} isInWindow={isInWindow} />;
      case 'financialReports': return <FinancialReportsScreen onNavigate={(view) => handleNavigate(view)} isInWindow={isInWindow} />;
      case "yearEndClosing": return <YearEndClosingScreen onNavigate={(view) => handleNavigate(view)} isInWindow={isInWindow} />;
      case 'customers': return <Customers isInWindow={isInWindow} />;
      case 'sales': return <Sales />;
      case 'totalSalesInvoices': return <TotalSalesInvoices onNavigate={(view) => handleNavigate(view)} />;
      case 'totalPurchaseInvoices': return <TotalPurchaseInvoices onNavigate={(view) => handleNavigate(view)} />;
      case 'supplierPurchasesSummary': return <SupplierPurchasesSummary onNavigate={(view) => handleNavigate(view)} />;
      case 'mainCategoryPurchases': return <MainCategoryPurchases onNavigate={(view) => handleNavigate(view)} />;
      case 'subCategoryItemPurchases': return <SubCategoryItemPurchases onNavigate={(view) => handleNavigate(view)} />;
      case 'inventoryAndPurchasesAnalysis': return <InventoryAndPurchasesAnalysis onNavigate={(view) => handleNavigate(view)} />;
      case 'singleItemPurchaseAnalysis': return <SingleItemPurchaseAnalysis onNavigate={(view) => handleNavigate(view)} />;
      case 'supplierBonusesSummary': return <SupplierBonusesSummary onNavigate={(view) => handleNavigate(view)} />;
      case 'detailedSupplierBonuses': return <DetailedSupplierBonuses onNavigate={(view) => handleNavigate(view)} />;
      case 'itemSalesAnalysis': return <ItemSalesAnalysis onNavigate={(view) => handleNavigate(view)} />;
      case 'technicianSales': return <TechnicianSales onNavigate={(view) => handleNavigate(view)} />;
      case 'dailyItemProfits': return <DailyItemProfits onNavigate={(view) => handleNavigate(view)} />;
      case 'belowCostSales': return <BelowCostSales onNavigate={(view) => handleNavigate(view)} />;
      case 'bonusesAndSamples': return <BonusesAndSamples onNavigate={(view) => handleNavigate(view)} />;
      case 'salesProfitabilitySummary': return <SalesProfitabilitySummary onNavigate={(view) => handleNavigate(view)} />;
      case 'customerSalesSummary': return <CustomerSalesSummary onNavigate={(view) => handleNavigate(view)} />;
      case 'installments': return <InstallmentsScreen isInWindow={isInWindow} />;
      case 'vendors': return <Vendors isInWindow={isInWindow} />;
      case 'purchases': return <Purchases />;
      case 'partnerBalances': return <PartnerBalances isInWindow={isInWindow} />;
      case 'customerStatement': return <CustomerStatementScreen onNavigate={(view) => handleNavigate(view)} />;
      case 'partnerStatement': return <DetailedStatementScreen onNavigate={(view) => handleNavigate(view)} />;
      case 'warehouseBalances': return <WarehouseBalances onNavigate={(view) => handleNavigate(view)} isInWindow={isInWindow} />;
      case 'inventoryCount': return <InventoryCountScreen onNavigate={(view) => handleNavigate(view)} isInWindow={isInWindow} />;
      case 'items': return <Items isInWindow={isInWindow} />;
      case 'manufacturing': return <ManufacturingScreen isInWindow={isInWindow} />;
      case 'payroll': return <PayrollScreen isInWindow={isInWindow} />;
      case 'externalReceipt': return <ExternalReceiptVoucher isInWindow={isInWindow} />;
      case 'externalPayment': return <ExternalPaymentVoucher isInWindow={isInWindow} />;
      case 'internalReceipt': return <InternalReceiptVoucher isInWindow={isInWindow} />;
      case 'internalPayment': return <InternalPaymentVoucher isInWindow={isInWindow} />;
      case 'bankChecks': return <CheckPortfolioScreen onNavigate={(view) => handleNavigate(view)} isInWindow={isInWindow} />;
      case 'costCenters': return <CostCenterScreen onNavigate={(view) => handleNavigate(view)} isInWindow={isInWindow} />;
      case 'external': return <ExternalReceiptVoucher isInWindow={isInWindow} />;
      case 'internal': return <InternalReceiptVoucher isInWindow={isInWindow} />;
      case 'journalEntries': return <NewJournalEntry />;
      case 'auditTrail': return <AuditTrailScreen onNavigate={(view) => handleNavigate(view)} isInWindow={isInWindow} />;
      case 'settings': return <Settings onNavigateToDashboard={() => handleNavigate(null)} isInWindow={isInWindow} />;
      default: return null;
    }
  };

  const renderView = () => renderViewComponent(activeView);

  const navItemClass = (viewName: string) => {
    const isCurrentlyActive = activeView === viewName || (viewName === 'companyProfile' && (activeView === null || activeView === 'companyProfile'));
    const isOpenInWindow = isMultiWindowMode && windows.some(w => w.view === viewName && !w.isMinimized);
    const isActiveWindow = isMultiWindowMode && activeWindowId && windows.find(w => w.id === activeWindowId)?.view === viewName;

    const isHighlighted = isMultiWindowMode
      ? (isActiveWindow || (viewName === 'companyProfile' && (!activeWindowId || windows.length === 0)))
      : isCurrentlyActive;

    return `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer text-sm relative ${
      isHighlighted 
        ? 'bg-blue-600/20 text-blue-400 border border-blue-600/40 font-semibold shadow-xs' 
        : isOpenInWindow
          ? 'bg-slate-800/80 text-slate-200 border border-slate-700/60'
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

  const isInvoiceOrVoucherScreen = Boolean(
    activeView && [
      'sales',
      'purchases',
      'externalReceipt',
      'externalPayment',
      'internalReceipt',
      'internalPayment',
      'bankChecks',
      'installments',
      'external',
      'internal',
      'journal',
      'journalEntries',
      'partnerStatement',
      'customerStatement',
      'totalSalesInvoices',
      'dailyItemProfits',
      'belowCostSales',
      'bonusesAndSamples',
      'supplierBonusesSummary',
      'customerSalesSummary'
    ].includes(activeView)
  );

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] font-sans text-slate-900" dir={dir}>
      {/* Header: Visible only on Mobile (< md), hidden on Desktop (>= md) */}
      <header className="flex md:hidden h-16 bg-[#1e293b] text-white items-center justify-between px-3 sm:px-6 border-b border-slate-700 shrink-0 print:hidden z-20">
        <div className="flex items-center gap-2 sm:gap-3.5">
          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={
              isMobileMenuOpen
                ? t('hideSidebar', 'إخفاء القائمة الجانبية')
                : t('showSidebar', 'إظهار القائمة الجانبية')
            }
            title={language === 'ar' ? 'القائمة الرئيسية' : 'Main Menu'}
            className="p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center border shadow-2xs bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700"
          >
            {isMobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
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
              <h1 className="text-sm sm:text-base font-semibold leading-tight line-clamp-1 notranslate" translate="no">
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

        <div className="flex items-center gap-2">
          {/* Voice Search Quick Button */}
          <button
            type="button"
            onClick={() => setShowVoiceSearch(true)}
            title="البحث الصوتي الذكي للشاشات والحسابات (Ctrl+K أو Alt+V)"
            className="flex items-center gap-1.5 px-2.5 h-8.5 rounded-lg bg-indigo-600/25 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 hover:border-indigo-400 text-xs font-bold transition-all cursor-pointer shadow-xs group"
          >
            <Mic size={15} className="group-hover:scale-110 transition-transform text-indigo-400 group-hover:text-white" />
            <span className="hidden sm:inline">بحث صوتي</span>
          </button>

          {/* Unified Alerts Center Bell */}
          <AlertsNotificationBell 
            onNavigate={handleNavigate} 
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition-colors cursor-pointer"
            iconSize={16}
          />

          {/* Sync Status Indicator */}
          <GlobalSyncIndicator />

          {/* Quick Settings Button */}
          <button
            type="button"
            onClick={() => handleNavigate('settings')}
            title={t('systemSettingsBtn', 'إعدادات النظام')}
            className="w-8.5 h-8.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-200 hover:text-white transition-colors cursor-pointer"
          >
            <SettingsIcon size={16} />
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
            
            <div className="flex items-center gap-1">
              {/* Unified Alerts Notification Bell */}
              <AlertsNotificationBell
                onNavigate={handleNavigate}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                iconSize={16}
              />

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
          <div onClick={() => handleNavigate('reportsHub')} className={navItemClass('reportsHub')}>
            <BarChart3 size={15} className="text-indigo-400 shrink-0" /> 
            <span className="flex items-center justify-between flex-1">
              <span>{language === 'ar' ? 'مركز تقارير المبيعات' : 'Sales Reports Hub'}</span>
              <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-700/60 font-mono">HUB</span>
            </span>
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
          <div onClick={() => handleNavigate('purchasesReportsHub')} className={navItemClass('purchasesReportsHub')}>
            <BarChart3 size={15} className="text-emerald-400 shrink-0" /> 
            <span className="flex items-center justify-between flex-1">
              <span>{language === 'ar' ? 'مركز تقارير المشتريات' : 'Purchases Reports Hub'}</span>
              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-700/60 font-mono">HUB</span>
            </span>
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
          <div onClick={() => handleNavigate('customerStatement')} className={navItemClass('customerStatement')}>
            <BookOpen size={15} className="text-emerald-400 shrink-0" />
            <span className="flex items-center justify-between flex-1">
              <span>{t('nav_customerStatement', 'كشف حساب عميل أو مورد')}</span>
              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">CUST/VEND</span>
            </span>
          </div>
          <div onClick={() => handleNavigate('partnerStatement')} className={navItemClass('partnerStatement')}>
            <FileSpreadsheet size={15} className="text-amber-400 shrink-0" />
            <span className="flex items-center justify-between flex-1">
              <span>{language === 'ar' ? 'كشف حساب تفصيلي' : 'Detailed Statement'}</span>
              <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">STMT</span>
            </span>
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
            <span className="text-xs font-mono bg-slate-800 text-emerald-400 px-1 rounded">COA</span> 
            <span className="flex items-center justify-between flex-1">
              <span>{t('nav_chartTree', 'شجرة الحسابات المالية')}</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-700/60 font-mono">مربوطة 🔗</span>
            </span>
          </div>
          <div onClick={() => handleNavigate('trialBalance')} className={navItemClass('trialBalance')}>
            <span className="text-xs font-mono bg-slate-800 text-amber-400 px-1 rounded">TB</span> 
            <span>{t('nav_trialBalance', 'ميزان المراجعة')}</span>
          </div>
          <div onClick={() => handleNavigate('accountMovements')} className={navItemClass('accountMovements')}>
            <span className="text-xs font-mono bg-slate-800 text-emerald-400 px-1 rounded">AM</span> 
            <span>{language === 'ar' ? 'حركة الحسابات' : 'Account Movements'}</span>
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
            <div className="text-[10px] uppercase font-bold text-slate-500 px-2 tracking-wider flex items-center justify-between">
              <span>{language === 'ar' ? 'أدوات وحالة النظام' : 'System Tools & Status'}</span>
              <div className="hidden md:flex items-center scale-90 origin-end">
                <GlobalSyncIndicator />
              </div>
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

            {/* 4. نمط عرض الديسك توب (Desktop Multi-Window MDI Toggle Button) */}
            <div className="hidden md:block pt-1">
              <button
                type="button"
                onClick={handleToggleMultiWindowMode}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs ${
                  isMultiWindowMode
                    ? 'bg-gradient-to-r from-blue-950/70 to-indigo-950/60 text-blue-200 border-blue-500/60 hover:from-blue-900/80 hover:to-indigo-900/70 ring-1 ring-blue-500/30'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700/70 hover:bg-slate-700/80 hover:text-white'
                }`}
                title={
                  isMultiWindowMode
                    ? (language === 'ar' ? 'انقر للتبديل إلى وضع الشاشة الواحدة التقليدي (ملء الشاشة)' : 'Click to switch to classic single screen mode')
                    : (language === 'ar' ? 'انقر لتفعيل نظام النوافذ المنبثقة المتعددة (Desktop MDI)' : 'Click to switch to Desktop Multi-Window MDI mode')
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                    isMultiWindowMode ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-700 text-slate-300'
                  }`}>
                    <AppWindow size={14} />
                  </div>
                  <div className="text-start truncate">
                    <div className="text-[10px] text-slate-400 font-normal">
                      {language === 'ar' ? 'نمط العرض (ديسك توب)' : 'Desktop View'}
                    </div>
                    <div className="truncate text-xs font-semibold">
                      {isMultiWindowMode
                        ? (language === 'ar' ? 'نوافذ منبثقة MDI' : 'Multi-Window MDI')
                        : (language === 'ar' ? 'شاشة واحدة كاملة' : 'Single Screen')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                    isMultiWindowMode
                      ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-400'
                      : 'bg-slate-700 text-slate-300 border border-slate-600'
                  }`}>
                    {isMultiWindowMode ? (language === 'ar' ? 'MDI نشط' : 'MDI ON') : (language === 'ar' ? 'شاشة كاملة' : 'CLASSIC')}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Extra bottom space for mobile scrollability */}
          <div className="h-8 md:hidden" />
        </nav>

        {/* Desktop View: Multi-Window Manager (MDI Popup Windows for Desktop) */}
        {isMultiWindowMode ? (
          <div className="hidden md:flex flex-1 overflow-hidden relative flex-col bg-[#f1f5f9] print:hidden">
            <DesktopWindowManager
              windows={windows}
              activeWindowId={activeWindowId}
              onFocusWindow={handleFocusWindow}
              onCloseWindow={handleCloseWindow}
              onMinimizeWindow={handleMinimizeWindow}
              onRestoreWindow={handleRestoreWindow}
              onToggleMaximize={handleToggleMaximize}
              onUpdatePosition={handleUpdatePosition}
              onUpdateDimensions={handleUpdateDimensions}
              onBatchUpdateWindows={setWindows}
              onMinimizeAll={handleMinimizeAll}
              onRestoreAll={handleRestoreAll}
              onCloseAll={handleCloseAll}
              onCascadeWindows={handleCascadeWindows}
              onTileWindows={handleTileWindows}
              onShowDashboard={() => {
                setActiveWindowId(null);
                setActiveView('companyProfile');
              }}
              renderContent={(winView) => (
                <div className="flex flex-col flex-1">
                  {renderViewComponent(winView, true)}
                </div>
              )}
              language={language}
              isRtl={isRtl}
              isMultiWindowMode={isMultiWindowMode}
              onToggleMultiWindowMode={handleToggleMultiWindowMode}
              isSidebarOpen={isDesktopSidebarOpen}
              onToggleSidebar={toggleSidebar}
              onNavigate={handleNavigate}
              backgroundContent={
                <div className="p-4 lg:p-6 w-full max-w-7xl 2xl:max-w-[1700px] mx-auto flex-1 flex flex-col">
                  <FiscalYearArchiveBanner onNavigateToYearEnd={() => handleNavigate('yearEndClosing')} />
                  {activeView === 'dashboard' ? (
                    <DashboardScreen 
                      onNavigate={(view) => handleNavigate(view)} 
                      systemSettings={systemSettings} 
                    />
                  ) : (
                    <CompanyProfileScreen 
                      systemSettings={systemSettings} 
                      onNavigateToSettings={() => handleNavigate('settings')} 
                      onNavigateToDashboard={() => handleNavigate('dashboard')}
                      onNavigate={(view) => handleNavigate(view)}
                    />
                  )}
                </div>
              }
            />
          </div>
        ) : null}

        {/* Mobile View / Classic Single-Screen Mode (and for Print rendering) */}
        {(!isMultiWindowMode || !isDesktopScreen) && (
          <main className={`${isMultiWindowMode ? 'md:hidden' : 'flex'} flex-1 ${
            activeView === 'sales' || activeView === 'purchases'
              ? 'p-1 sm:p-2 md:p-3 print:p-0'
              : 'p-2 sm:p-4 md:p-6 lg:p-8 print:p-0'
          } overflow-y-auto flex flex-col bg-[#f1f5f9] relative pb-20 md:pb-8`}>
            {/* Desktop Floating Sidebar Expand Button (Shown ONLY in Desktop Classic Single Screen mode when sidebar is collapsed) */}
            {!isMultiWindowMode && !isDesktopSidebarOpen && (
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={language === 'ar' ? 'إظهار القائمة الجانبية (Ctrl+B)' : 'Show Sidebar (Ctrl+B)'}
                title={language === 'ar' ? 'إظهار القائمة الجانبية (Ctrl+B)' : 'Show Sidebar (Ctrl+B)'}
                className={`hidden md:flex fixed top-4 ${
                  isRtl ? 'left-6' : 'right-6'
                } z-40 items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/95 hover:bg-slate-800 text-amber-400 border border-slate-700/80 shadow-2xl backdrop-blur-md text-xs font-bold transition-all cursor-pointer hover:scale-105 active:scale-95 group print:hidden`}
              >
                {isRtl ? (
                  <PanelRightOpen size={16} className="text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                ) : (
                  <PanelLeftOpen size={16} className="text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                )}
                <span className="text-slate-200">
                  {language === 'ar' ? 'القائمة الرئيسية' : 'Main Menu'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                  Ctrl+B
                </span>
              </button>
            )}

          <div className={`w-full ${activeView === 'sales' || activeView === 'purchases' ? '' : 'max-w-7xl 2xl:max-w-[1700px] mx-auto'} flex-1 flex flex-col transition-all`}>
            {/* Archived Fiscal Year Read-Only Banner */}
            <FiscalYearArchiveBanner onNavigateToYearEnd={() => handleNavigate('yearEndClosing')} />

            <Routes>
              {/* Route for Reports Hub */}
              <Route path="/reports" element={<ReportsHubScreen onNavigate={(view) => handleNavigate(view)} />} />

              {/* Route for Purchases Reports Hub */}
              <Route path="/reports/purchases" element={<PurchasesReportsHubScreen onNavigate={(view) => handleNavigate(view)} />} />

              {/* Route for Total Purchase Invoices report */}
              <Route path="/reports/purchases/total-invoices" element={<TotalPurchaseInvoices onNavigate={(view) => handleNavigate(view)} />} />

              {/* Route for Supplier Purchases Summary report */}
              <Route path="/reports/purchases/suppliers-summary" element={<SupplierPurchasesSummary onNavigate={(view) => handleNavigate(view)} />} />

              {/* Route for Main Category Purchases report */}
              <Route path="/reports/purchases/categories-summary" element={<MainCategoryPurchases onNavigate={(view) => handleNavigate(view)} />} />
              <Route path="/reports/purchases/main-category" element={<MainCategoryPurchases onNavigate={(view) => handleNavigate(view)} />} />

              {/* Route for Subcategory & Item Purchases report */}
              <Route path="/reports/purchases/sub-categories" element={<SubCategoryItemPurchases onNavigate={(view) => handleNavigate(view)} />} />

              {/* Route for Inventory & Purchases Analysis report */}
              <Route path="/reports/purchases/inventory-analysis" element={<InventoryAndPurchasesAnalysis onNavigate={(view) => handleNavigate(view)} />} />

              {/* Route for Single Item Purchase Analysis report */}
              <Route path="/reports/purchases/single-item-analysis" element={<SingleItemPurchaseAnalysis onNavigate={(view) => handleNavigate(view)} />} />

              {/* Route for Supplier Bonuses Summary report */}
              <Route path="/reports/purchases/supplier-bonuses" element={<SupplierBonusesSummary onNavigate={(view) => handleNavigate(view)} />} />

              {/* Route for Detailed Supplier Bonuses report */}
              <Route path="/reports/purchases/detailed-supplier-bonuses" element={<DetailedSupplierBonuses onNavigate={(view) => handleNavigate(view)} />} />

              {/* Route for Total Sales Invoices report */}
              <Route path="/reports/sales/total-invoices" element={<TotalSalesInvoices />} />

              {/* Route for Item Sales Analysis (Best Sellers) report */}
              <Route path="/reports/sales/items-summary" element={<ItemSalesAnalysis />} />

              {/* Route for Technician & Sales Rep Sales report */}
              <Route path="/reports/sales/technicians" element={<TechnicianSales />} />

              {/* Route for Daily Item Profits report */}
              <Route path="/reports/profitability/daily-item-profits" element={<DailyItemProfits />} />

              {/* Route for Sales Below Cost report */}
              <Route path="/reports/profitability/below-cost" element={<BelowCostSales />} />

              {/* Route for Bonuses & Samples report */}
              <Route path="/reports/profitability/bonuses" element={<BonusesAndSamples />} />

              {/* Route for Sales Profitability Summary report */}
              <Route path="/reports/profitability/margins" element={<SalesProfitabilitySummary />} />

              {/* Route for Customer Sales Summary report */}
              <Route path="/reports/sales/customers-summary" element={<CustomerSalesSummary />} />

              {/* Default application route */}
              <Route path="*" element={
                activeView ? (
                  <div className="flex flex-col flex-1">
                    {/* زر فقط للرجوع المتسلسل بتصميم 3D مجسم (Sequential 3D Back Button Only) */}
                    <div className="flex items-center mb-3 sm:mb-4 print:hidden">
                      <button
                        type="button"
                        onClick={() => {
                          if (canGoBack) {
                            stepBack();
                          } else {
                            handleNavigate(null);
                          }
                        }}
                        className="btn-3d btn-3d-nav-back px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-extrabold flex items-center gap-2 group cursor-pointer shadow-md"
                        title={previousViewTitle ? `الرجوع خطوة للخلف إلى: ${previousViewTitle}` : 'الرجوع إلى لوحة التحكم'}
                      >
                        {isRtl ? (
                          <ArrowRight size={16} className="text-white drop-shadow-xs group-hover:-translate-x-0.5 transition-transform shrink-0" />
                        ) : (
                          <ArrowLeft size={16} className="text-white drop-shadow-xs group-hover:translate-x-0.5 transition-transform shrink-0" />
                        )}
                        <span className="tracking-wide">رجوع للخلف</span>
                        {previousViewTitle && (
                          <span className="badge-3d-dest text-[11px] font-bold text-white px-2 py-0.5 hidden sm:inline-block max-w-[220px] truncate">
                            إلى «{previousViewTitle}»
                          </span>
                        )}
                      </button>
                    </div>
                    {renderView()}
                  </div>
                ) : (
                  <DashboardScreen 
                    onNavigate={(view) => handleNavigate(view)} 
                    systemSettings={systemSettings} 
                  />
                )
              } />
            </Routes>
          </div>
        </main>
        )}

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


