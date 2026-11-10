import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Printer, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  Layers, 
  X,
  BookOpen,
  ArrowRight,
  ExternalLink,
  Users,
  Truck,
  Warehouse,
  Receipt,
  ShoppingCart,
  DollarSign,
  Scale,
  Tag,
  Percent,
  HelpCircle,
  Landmark,
  FileSpreadsheet,
  Download,
  FileCheck,
  ShieldCheck,
  FileText,
  Calendar,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { AccountType } from '../types/accounting';
import { 
  calculateTrialBalance, 
  getAccountLedgerMovements,
  getCrossModuleReconciliation,
  getDiscountsSummary
} from '../utils/trialBalanceStore';
import { getSystemSettings } from '../utils/settings';
import { useIsInWindow } from './DesktopWindowManager';
import { useLanguage } from '../i18n/LanguageContext';
import { exportElementToPdf } from '../utils/pdfExport';
import { exportToXLSX } from '../utils/universalExport';
import ReportPrintPreviewToolbar from './ReportPrintPreviewToolbar';
import ExportButtonGroup from './ExportButtonGroup';
import { 
  getSelectedBrowsingYear, 
  getActiveFiscalYear, 
  FISCAL_YEAR_CHANGED_EVENT 
} from '../utils/fiscalYearArchive';

interface TrialBalanceScreenProps {
  onNavigate?: (view: string) => void;
  isInWindow?: boolean;
}

export default function TrialBalanceScreen({ onNavigate, isInWindow: explicitIsInWindow }: TrialBalanceScreenProps = {}) {
  const isInWindow = useIsInWindow(explicitIsInWindow);
  const { t } = useLanguage();
  const [systemSettings] = useState(() => getSystemSettings());
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  
  // Filter States
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>('ALL');
  const [maxLevel, setMaxLevel] = useState<string>('ALL');
  const [hideZeroBalances, setHideZeroBalances] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'TOTALS_AND_BALANCES' | 'BALANCES_ONLY' | 'MOVEMENTS_ONLY'>('TOTALS_AND_BALANCES');

  // Selected Account for Ledger Detail Modal
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [ledgerStartDate, setLedgerStartDate] = useState<string>('');
  const [ledgerEndDate, setLedgerEndDate] = useState<string>('');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  
  // Ledger Movements Modal Zoom & Pan State
  const [ledgerZoom, setLedgerZoom] = useState<number>(100);
  const [ledgerPan, setLedgerPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isLedgerDragging, setIsLedgerDragging] = useState<boolean>(false);
  const ledgerDragRef = useRef<{ startX: number; startY: number; initPanX: number; initPanY: number }>({ startX: 0, startY: 0, initPanX: 0, initPanY: 0 });

  // Reset zoom and pan whenever ledger details modal is opened or closed
  useEffect(() => {
    setLedgerZoom(100);
    setLedgerPan({ x: 0, y: 0 });
  }, [selectedAccountId]);

  const resetLedgerPan = () => {
    setLedgerPan({ x: 0, y: 0 });
  };

  const handleLedgerMouseDown = (e: React.MouseEvent) => {
    if (ledgerZoom <= 100) return;
    setIsLedgerDragging(true);
    ledgerDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initPanX: ledgerPan.x,
      initPanY: ledgerPan.y
    };
  };

  const handleLedgerMouseMove = (e: React.MouseEvent) => {
    if (!isLedgerDragging || ledgerZoom <= 100) return;
    const dx = e.clientX - ledgerDragRef.current.startX;
    const dy = e.clientY - ledgerDragRef.current.startY;
    setLedgerPan({
      x: ledgerDragRef.current.initPanX + dx,
      y: ledgerDragRef.current.initPanY + dy
    });
  };

  const handleLedgerMouseUp = () => {
    setIsLedgerDragging(false);
  };

  const handleLedgerTouchStart = (e: React.TouchEvent) => {
    if (ledgerZoom <= 100 || e.touches.length !== 1) return;
    setIsLedgerDragging(true);
    ledgerDragRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      initPanX: ledgerPan.x,
      initPanY: ledgerPan.y
    };
  };

  const handleLedgerTouchMove = (e: React.TouchEvent) => {
    if (!isLedgerDragging || ledgerZoom <= 100) return;
    const dx = e.touches[0].clientX - ledgerDragRef.current.startX;
    const dy = e.touches[0].clientY - ledgerDragRef.current.startY;
    setLedgerPan({
      x: ledgerDragRef.current.initPanX + dx,
      y: ledgerDragRef.current.initPanY + dy
    });
  };

  const handleLedgerTouchEnd = () => {
    setIsLedgerDragging(false);
  };

  // Educational Accounting Guide Modal for Discounts
  const [showDiscountGuideModal, setShowDiscountGuideModal] = useState<boolean>(false);
  
  // PDF Export State & Ref
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Revision counter for live updates
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Navigate helper
  const navigateToView = (view: string, accountCode?: string) => {
    if (accountCode) {
      sessionStorage.setItem('alpha_target_account_code', accountCode);
    }
    if (onNavigate) {
      onNavigate(view);
    } else {
      window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view } }));
    }
  };

  // Sync date range with selected browsing fiscal year
  useEffect(() => {
    const handleFiscalYearSync = () => {
      const bYear = getSelectedBrowsingYear();
      const aYear = getActiveFiscalYear();
      if (bYear !== aYear) {
        setStartDate(`${bYear}-01-01`);
        setEndDate(`${bYear}-12-31`);
      }
    };
    handleFiscalYearSync();
    window.addEventListener(FISCAL_YEAR_CHANGED_EVENT, handleFiscalYearSync);
    return () => window.removeEventListener(FISCAL_YEAR_CHANGED_EVENT, handleFiscalYearSync);
  }, []);

  // Check if opened with target account
  useEffect(() => {
    const targetAcc = sessionStorage.getItem('alpha_tb_target_account');
    if (targetAcc) {
      setSelectedAccountId(targetAcc);
      sessionStorage.removeItem('alpha_tb_target_account');
    }
  }, []);

  // Subscribe to updates across the entire system
  useEffect(() => {
    const handleUpdate = () => setRefreshKey(prev => prev + 1);
    window.addEventListener('alpha-journal-entries-updated', handleUpdate);
    window.addEventListener('alpha-chart-of-accounts-updated', handleUpdate);
    window.addEventListener('alpha-trial-balance-updated', handleUpdate);
    window.addEventListener('alpha-system-reset-completed', handleUpdate);
    window.addEventListener('alpha-data-changed', handleUpdate);
    window.addEventListener('alpha-partner-ledger-updated', handleUpdate);
    window.addEventListener('alpha-items-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('alpha-journal-entries-updated', handleUpdate);
      window.removeEventListener('alpha-chart-of-accounts-updated', handleUpdate);
      window.removeEventListener('alpha-trial-balance-updated', handleUpdate);
      window.removeEventListener('alpha-system-reset-completed', handleUpdate);
      window.removeEventListener('alpha-data-changed', handleUpdate);
      window.removeEventListener('alpha-partner-ledger-updated', handleUpdate);
      window.removeEventListener('alpha-items-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Compute Trial Balance Data
  const { rows, totals } = useMemo(() => {
    return calculateTrialBalance(
      startDate || undefined,
      endDate || undefined,
      accountTypeFilter,
      hideZeroBalances
    );
  }, [startDate, endDate, accountTypeFilter, hideZeroBalances, refreshKey]);

  // Compute Cross-Module Reconciliation Summary
  const reconciliation = useMemo(() => {
    return getCrossModuleReconciliation();
  }, [refreshKey, rows]);

  // Compute Commercial Discounts Summary (المسموح بها والمكتسبة)
  const discountsSummary = useMemo(() => {
    return getDiscountsSummary();
  }, [refreshKey, rows]);

  // Filter rows by search query
  const filteredRows = useMemo(() => {
    let result = rows;
    
    if (maxLevel !== 'ALL') {
      const targetLevel = Number(maxLevel);
      result = result.filter(r => {
        const len = r.account.code.length;
        let level = 5;
        if (len === 1) level = 1;
        else if (len === 2) level = 2;
        else if (len === 4) level = 3;
        else if (len === 6) level = 4;
        return level <= targetLevel;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r => 
        (r.account.code || '').toLowerCase().includes(q) ||
        (r.account.name || '').toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [rows, searchQuery, maxLevel]);

  // Selected account for ledger modal
  const selectedRow = useMemo(() => {
    if (!selectedAccountId) return null;
    return rows.find(r => r.account.id === selectedAccountId || r.account.code === selectedAccountId) || null;
  }, [rows, selectedAccountId]);

  // Sync in-modal ledger date filters when an account is selected
  useEffect(() => {
    if (selectedAccountId) {
      setLedgerStartDate(startDate || '');
      setLedgerEndDate(endDate || '');
      setLedgerSearch('');
    }
  }, [selectedAccountId, startDate, endDate]);

  const selectedLedgerItems = useMemo(() => {
    if (!selectedAccountId) return [];
    const from = ledgerStartDate || startDate || undefined;
    const to = ledgerEndDate || endDate || undefined;
    let items = getAccountLedgerMovements(selectedAccountId, from, to);
    if (ledgerSearch.trim()) {
      const q = ledgerSearch.toLowerCase().trim();
      items = items.filter(it => 
        (it.entryNumber && it.entryNumber.toLowerCase().includes(q)) ||
        (it.description && it.description.toLowerCase().includes(q)) ||
        (it.reference && it.reference.toLowerCase().includes(q)) ||
        (it.sourceLabel && it.sourceLabel.toLowerCase().includes(q))
      );
    }
    return items;
  }, [selectedAccountId, startDate, endDate, ledgerStartDate, ledgerEndDate, ledgerSearch, refreshKey]);

  // Operational shortcut link per account code
  const getAccountOperationalLink = (code: string) => {
    if (code === '1201' || code.startsWith('1201')) {
      return {
        view: 'customerStatement',
        title: 'كشف حساب عميل وتفصيلي (قائمة متصلة ورصيد تراكمي)',
        shortLabel: 'كشف العميل',
        icon: <Users size={12} className="text-emerald-600" />,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
      };
    }
    if (code === '2101' || code.startsWith('2101')) {
      return {
        view: 'partnerBalances',
        title: 'أرصدة الموردين وأعمار الديون',
        shortLabel: 'أرصدة الموردين',
        icon: <Truck size={12} className="text-rose-600" />,
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
      };
    }
    if (code === '1301' || code.startsWith('1301')) {
      return {
        view: 'warehouseBalances',
        title: 'أرصدة وتقييم المخازن',
        shortLabel: 'أرصدة المخزن',
        icon: <Warehouse size={12} className="text-amber-600" />,
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
      };
    }
    if (code === '1101') {
      return {
        view: 'externalReceipt',
        title: 'سندات القبض النقدية',
        shortLabel: 'سندات القبض',
        icon: <DollarSign size={12} className="text-emerald-600" />,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
      };
    }
    if (code === '1102') {
      return {
        view: 'externalPayment',
        title: 'سندات الصرف البنكية',
        shortLabel: 'سندات الصرف',
        icon: <DollarSign size={12} className="text-blue-600" />,
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
      };
    }
    if (code === '1104' || code === '2104') {
      return {
        view: 'bankChecks',
        title: 'حافظة ودورة حياة الشيكات',
        shortLabel: 'حافظة الشيكات',
        icon: <Landmark size={12} className="text-purple-600" />,
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
      };
    }
    if (code === '4101' || code.startsWith('4101')) {
      return {
        view: 'sales',
        title: 'فواتير المبيعات',
        shortLabel: 'المبيعات',
        icon: <ShoppingCart size={12} className="text-emerald-600" />,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
      };
    }
    if (code === '4103') {
      return {
        view: 'sales',
        title: 'فواتير المبيعات المتضمنة خصم مسموح به',
        shortLabel: 'شاشة المبيعات',
        icon: <Percent size={12} className="text-blue-600" />,
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
      };
    }
    if (code === '4203') {
      return {
        view: 'purchases',
        title: 'فواتير المشتريات المتضمنة خصم مكتسب',
        shortLabel: 'شاشة المشتريات',
        icon: <Percent size={12} className="text-emerald-600" />,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
      };
    }
    if (code === '5101' || code.startsWith('5101')) {
      return {
        view: 'purchases',
        title: 'فواتير المشتريات',
        shortLabel: 'المشتريات',
        icon: <Receipt size={12} className="text-rose-600" />,
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
      };
    }
    if (code === '5102' || code.startsWith('5102')) {
      return {
        view: 'payroll',
        title: 'الموظفون ومسير الرواتب',
        shortLabel: 'الرواتب',
        icon: <Users size={12} className="text-teal-600" />,
        badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
      };
    }
    if (code === '1302' || code === '1303') {
      return {
        view: 'manufacturing',
        title: 'أوامر التصنيع وقوائم التكاليف',
        shortLabel: 'التصنيع',
        icon: <Layers size={12} className="text-cyan-600" />,
        badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100'
      };
    }
    return null;
  };

  // Export Ledger to Excel
  const handleExportLedgerExcel = () => {
    if (!selectedRow) return;
    const headers = ['التاريخ', 'رقم القيد / المستند', 'المصدر', 'البيان والشرح', 'مدين', 'دائن', 'الرصيد التراكمي', 'طبيعة الرصيد'];
    const rowsData = selectedLedgerItems.map(item => [
      item.date,
      item.entryNumber,
      item.sourceLabel || item.sourceModule || 'قيد',
      item.description,
      item.debit > 0 ? item.debit : 0,
      item.credit > 0 ? item.credit : 0,
      item.runningBalance,
      item.balanceType === 'DEBIT' ? 'مدين' : item.balanceType === 'CREDIT' ? 'دائن' : 'متوازن'
    ]);
    const summaryRows = [
      ['الإجمالي', '', '', '', selectedRow.debitMovement, selectedRow.creditMovement, Math.abs(selectedRow.netMovement), selectedRow.netMovement >= 0 ? 'مدين' : 'دائن']
    ];
    exportToXLSX({
      filename: `كشف_حركة_حساب_${selectedRow.account.code}_${selectedRow.account.name.replace(/\\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'كشف حركة الحساب',
      title: `كشف حركة الحساب (دفتر الأستاذ العام) - ${selectedRow.account.code} : ${selectedRow.account.name}`,
      subtitle: `الفترة: ${ledgerStartDate || startDate || 'من البداية'} إلى ${ledgerEndDate || endDate || 'حتى تاريخه'} | التصنيف: ${getAccountTypeLabel(selectedRow.account.type)}`,
      filterSummary: `إجمالي المدين: ${selectedRow.debitMovement.toLocaleString()} | إجمالي الدائن: ${selectedRow.creditMovement.toLocaleString()} | الرصيد: ${Math.abs(selectedRow.netMovement).toLocaleString()} (${selectedRow.netMovement >= 0 ? 'مدين' : 'دائن'})`,
      headers,
      rows: rowsData,
      summaryRows
    });
  };

  // Currency
  const currencySymbol = systemSettings.financial?.currencySymbol || 'ر.س';

  // Quick Date Range Presets
  const handlePresetCurrentMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0] || '';
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0] || '';
    setStartDate(firstDay);
    setEndDate(lastDay);
  };

  const handlePresetCurrentYear = () => {
    const now = new Date();
    const firstDay = `${now.getFullYear()}-01-01`;
    const lastDay = `${now.getFullYear()}-12-31`;
    setStartDate(firstDay);
    setEndDate(lastDay);
  };

  const handleClearDates = () => {
    setStartDate('');
    setEndDate('');
  };

  // Export PDF
  const handleExportPDF = async () => {
    if (!printAreaRef.current) return;
    setIsExportingPdf(true);
    try {
      await exportElementToPdf(printAreaRef.current, {
        filename: `ميزان_المراجعة_${new Date().toISOString().split('T')[0]}.pdf`,
        format: 'A4',
        scale: 3.2
      });
    } catch (error) {
      console.error('Failed to export Trial Balance PDF:', error);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Account Type Helper Labels & Colors
  function getAccountTypeLabel(type: AccountType) {
    switch (type) {
      case AccountType.Asset: return 'أصول';
      case AccountType.Liability: return 'التزامات';
      case AccountType.Equity: return 'حقوق ملكية';
      case AccountType.Revenue: return 'إيرادات';
      case AccountType.Expense: return 'مصروفات';
      default: return type;
    }
  }

  function getAccountTypeBadge(type: AccountType) {
    switch (type) {
      case AccountType.Asset:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case AccountType.Liability:
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case AccountType.Equity:
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case AccountType.Revenue:
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case AccountType.Expense:
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  }

  return (
    <>
      <ReportPrintPreviewToolbar
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="ميزان المراجعة"
        targetId="trial-balance-export-area"
      />
      <div className="flex flex-col flex-1 p-2 sm:p-4 space-y-3 max-w-[1600px] mx-auto w-full">
        
      {/* Screen Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        {!isInWindow && (
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
              <BookOpen size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {t('nav_trialBalance', 'ميزان المراجعة')}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                  مركزي ومترابط مع كافة شاشات النظام
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                تجميع ومطابقة شاملة لجميع العمليات التشغيلية (المبيعات، المشتريات، المخازن، السندات، الرواتب، التصنيع، والقيود)
              </p>
            </div>
          </div>
        </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtonGroup
            title="ميزان المراجعة الشامل ومطابقة الحسابات"
            filename="ميزان_المراجعة"
            headers={['كود الحساب', 'اسم الحساب', 'نوع الحساب', 'حركة مدين', 'حركة دائن', 'رصيد مدين', 'رصيد دائن']}
            rows={[
              ...filteredRows.map(r => [
                r.account.code,
                r.account.name,
                getAccountTypeLabel(r.account.type),
                r.debitMovement,
                r.creditMovement,
                r.endingDebit,
                r.endingCredit
              ]),
              [
                'المجموع الإجمالي',
                '-',
                '-',
                totals.totalDebitMovement,
                totals.totalCreditMovement,
                totals.totalEndingDebit,
                totals.totalEndingCredit
              ]
            ]}
            onExportPDF={handleExportPDF}
            filterSummary={`حالة التوازن: ${totals.isBalanced ? 'متزن ومطابق' : 'غير متزن'} | إجمالي الحركات: ${totals.totalDebitMovement.toLocaleString()} ريال`}
            size="sm"
          />

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="طباعة تقرير ميزان المراجعة"
          >
            <Printer size={15} />
            <span>طباعة التقرير</span>
          </button>
        </div>
      </div>

      {/* Quick Cross-Screen Navigation Strip (الربط المباشر والشامل مع جميع شاشات النظام) */}
      <div className="bg-slate-900 text-white p-2.5 sm:p-3 rounded-xl shadow-xs flex flex-col items-start gap-3 print:hidden">
        <div className="flex items-center justify-between w-full flex-wrap gap-2 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
              <Layers size={16} />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-black text-white block">الانتقال والربط السريع للشاشات المصدرية المرتبطة بميزان المراجعة:</span>
              <span className="text-[10px] text-slate-400">انقر للتحقق من تفاصيل أي حساب في شاشته التشغيلية المطابقة</span>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-400/30">
            تكامل مباشر 100%
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full">
          <button
            type="button"
            onClick={() => navigateToView('accountMovements')}
            className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ring-1 ring-white/20"
            title="فتح شاشة حركة الحسابات التفصيلية (3 أعمدة: مدين - دائن - بيان الحركة)"
          >
            <Scale size={14} className="text-amber-300" />
            <span>حركة الحسابات (Account Movements)</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToView('sales')}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            title="شاشة فواتير المبيعات (حساب 4101)"
          >
            <ShoppingCart size={13} className="text-emerald-400" />
            <span>فواتير المبيعات (4101)</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToView('purchases')}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            title="شاشة فواتير المشتريات (حساب 1301)"
          >
            <Receipt size={13} className="text-rose-400" />
            <span>فواتير المشتريات (1301)</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToView('customerStatement')}
            className="px-2.5 py-1.5 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-700/50 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            title="فتح كشف حساب عميل وتفصيلي (قائمة متصلة ورصيد تراكمي)"
          >
            <BookOpen size={13} className="text-emerald-400" />
            <span>كشف حساب عميل (1201)</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToView('partnerBalances')}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            title="شاشة أرصدة العملاء والموردين وأعمار الديون"
          >
            <Users size={13} className="text-blue-400" />
            <span>أرصدة العملاء والموردين (1201/2101)</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToView('partnerStatement')}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            title="كشف حساب تفصيلي للعميل / المورد"
          >
            <FileSpreadsheet size={13} className="text-amber-400" />
            <span>كشف حساب تفصيلي</span>
          </button>

          <button
            type="button"
            onClick={() => setAccountTypeFilter('DISCOUNTS')}
            className="px-2.5 py-1.5 bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 border border-indigo-700/60 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            title="تصفية الحسابات على الخصم المسموح به والمكتسب"
          >
            <Percent size={13} className="text-amber-400" />
            <span>الخصومات (4103 / 4203)</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToView('warehouseBalances')}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            title="أرصدة وتقييم المخزون (1301)"
          >
            <Warehouse size={13} className="text-amber-400" />
            <span>أرصدة المخازن (1301)</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToView('inventoryCount')}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            title="الجرد الدوري والتسويات الدفترية"
          >
            <Scale size={13} className="text-purple-400" />
            <span>الجرد والتسويات</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToView('bankChecks')}
            className="px-2.5 py-1.5 bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700/50 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            title="حافظة ودورة حياة الشيكات البنكية (1104 / 2104)"
          >
            <Landmark size={13} className="text-blue-300" />
            <span>حافظة الشيكات (1104/2104)</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToView('externalReceipt')}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            title="سندات القبض والصرف النقدية والبنكية"
          >
            <DollarSign size={13} className="text-emerald-400" />
            <span>السندات المالية (1101/1102)</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToView('manufacturing')}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            title="أوامر التصنيع والإنتاج وقوائم التكاليف (BOM)"
          >
            <Layers size={13} className="text-cyan-400" />
            <span>التصنيع والإنتاج (1302/1303)</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToView('payroll')}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            title="الموظفون ومسير الرواتب (5102 / 2201)"
          >
            <Users size={13} className="text-teal-400" />
            <span>مسير الرواتب (5102)</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToView('journal')}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            title="القيود اليومية العامة (GL)"
          >
            <FileText size={13} className="text-indigo-400" />
            <span>القيود اليومية (GL)</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToView('chartTree')}
            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            title="شجرة ودليل الحسابات المالية"
          >
            <BookOpen size={13} />
            <span>شجرة الحسابات</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToView('financialReports')}
            className="px-2.5 py-1.5 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            title="القوائم المالية الختامية (قائمة الدخل والميزانية العمومية)"
          >
            <FileSpreadsheet size={13} />
            <span>القوائم المالية الختامية</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToView('yearEndClosing')}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            title="الإقفال السنوي وترحيل الأرصدة"
          >
            <ShieldCheck size={13} className="text-amber-400" />
            <span>الإقفال السنوي</span>
          </button>
        </div>
      </div>

      {/* الفرق الجوهري المحاسبي بين ميزان المراجعة وحركة الحسابات */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white p-4 sm:p-5 rounded-2xl border border-blue-500/30 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs print:hidden">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl shrink-0 mt-0.5 border border-indigo-400/20">
            <Scale size={20} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-amber-300 text-sm">💡 الفرق الجوهري المحاسبي:</span>
              <span className="font-bold text-slate-200">ميزان المراجعة (Trial Balance) مقابل حركة الحسابات (Account Movements)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-300">
              <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                <span className="font-bold text-blue-300 block mb-0.5">• ميزان المراجعة (إلزامي التوازن):</span>
                <span>توازنه حتمي قطعي (إجمالي المدين = إجمالي الدائن) لإثبات صحة التسجيل المزدوج لكافة حسابات المنشأة، ويعرض ملخص أرصدة كل حساب في سطر واحد.</span>
              </div>
              <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                <span className="font-bold text-emerald-300 block mb-0.5">• كشف حركة الحسابات (غير مشترط التوازن):</span>
                <span>وظيفتها إظهار تدفق العمليات (مدين، دائن، بيان الحركة بالتفصيل)، والفرق بين المدين والدائن يمثل <strong>رصيد الحساب الصافي</strong> وليس خللاً في التوازن.</span>
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigateToView('accountMovements')}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs shrink-0 flex items-center gap-2 transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95"
          title="الانتقال إلى شاشة حركة الحسابات بالجدول الثلاثي (مدين - دائن - بيان الحركة)"
        >
          <Scale size={15} />
          <span>فتح حركة الحسابات ←</span>
        </button>
      </div>

      {/* Cross-Module Live Reconciliation Hub (شريط المطابقة الشاملة مع الأنظمة الفرعية) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 print:hidden">
        
        {/* 1. AR Reconciliation */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Users size={15} className="text-blue-600" />
                <span>مطابقة ذمم العملاء (1201)</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${reconciliation.ar.isReconciled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {reconciliation.ar.isReconciled ? 'مطابق 100%' : 'فارق'}
              </span>
            </div>
            <div className="text-xs space-y-1 font-mono">
              <div className="flex justify-between text-slate-500">
                <span>رصيد الميزان (1201):</span>
                <span className="font-bold text-slate-800">{reconciliation.ar.accountBalance.toLocaleString()} {currencySymbol}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>دفتر أستاذ العملاء:</span>
                <span className="font-bold text-blue-700">{reconciliation.ar.subLedgerTotal.toLocaleString()} {currencySymbol}</span>
              </div>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => navigateToView('customerStatement')}
              className="text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
              title="كشف حساب عميل وتفصيلي"
            >
              <span>كشف العميل</span>
              <ArrowRight size={11} className="rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => navigateToView('partnerBalances')}
              className="text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
              title="أرصدة العملاء والذمم"
            >
              <span>أرصدة العملاء</span>
              <ArrowRight size={11} className="rotate-180" />
            </button>
          </div>
        </div>

        {/* 2. AP Reconciliation */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-rose-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Truck size={15} className="text-rose-600" />
                <span>مطابقة ذمم الموردين (2101)</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${reconciliation.ap.isReconciled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {reconciliation.ap.isReconciled ? 'مطابق 100%' : 'فارق'}
              </span>
            </div>
            <div className="text-xs space-y-1 font-mono">
              <div className="flex justify-between text-slate-500">
                <span>رصيد الميزان (2101):</span>
                <span className="font-bold text-slate-800">{reconciliation.ap.accountBalance.toLocaleString()} {currencySymbol}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>دفتر أستاذ الموردين:</span>
                <span className="font-bold text-rose-700">{reconciliation.ap.subLedgerTotal.toLocaleString()} {currencySymbol}</span>
              </div>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => navigateToView('partnerStatement')}
              className="text-amber-700 hover:underline flex items-center gap-1 cursor-pointer"
              title="كشف حساب تفصيلي للمورد"
            >
              <span>كشف تفصيلي</span>
              <ArrowRight size={11} className="rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => navigateToView('partnerBalances')}
              className="text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
              title="أرصدة الموردين"
            >
              <span>أرصدة الموردين</span>
              <ArrowRight size={11} className="rotate-180" />
            </button>
          </div>
        </div>

        {/* 3. Inventory Reconciliation */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-amber-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Warehouse size={15} className="text-amber-600" />
                <span>مطابقة المخزون السلعي (1301)</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${reconciliation.inventory.isReconciled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {reconciliation.inventory.isReconciled ? 'مطابق 100%' : 'تسوية'}
              </span>
            </div>
            <div className="text-xs space-y-1 font-mono">
              <div className="flex justify-between text-slate-500">
                <span>رصيد الميزان (1301):</span>
                <span className="font-bold text-slate-800">{reconciliation.inventory.accountBalance.toLocaleString()} {currencySymbol}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>تقييم بضاعة المخزن:</span>
                <span className="font-bold text-amber-700">{reconciliation.inventory.valuationTotal.toLocaleString()} {currencySymbol}</span>
              </div>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => navigateToView('inventoryCount')}
              className="text-purple-700 hover:underline flex items-center gap-1 cursor-pointer"
              title="الجرد والتسويات المخزنية"
            >
              <span>الجرد والتسويات</span>
              <ArrowRight size={11} className="rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => navigateToView('warehouseBalances')}
              className="text-amber-600 hover:underline flex items-center gap-1 cursor-pointer"
              title="بطاقات المخزن"
            >
              <span>أرصدة المخزن</span>
              <ArrowRight size={11} className="rotate-180" />
            </button>
          </div>
        </div>

        {/* 4. Cash and Banks */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <DollarSign size={15} className="text-emerald-600" />
                <span>النقدية والبنوك (1101/1102)</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                أرصدة لحظية
              </span>
            </div>
            <div className="text-xs space-y-1 font-mono">
              <div className="flex justify-between text-slate-500">
                <span>الصندوق الرئيسي (1101):</span>
                <span className="font-bold text-emerald-700">{reconciliation.cash.balance.toLocaleString()} {currencySymbol}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>الحساب البنكي (1102):</span>
                <span className="font-bold text-blue-700">{reconciliation.bank.balance.toLocaleString()} {currencySymbol}</span>
              </div>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => navigateToView('externalReceipt')}
              className="text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
              title="سندات القبض"
            >
              <span>سندات القبض</span>
              <ArrowRight size={11} className="rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => navigateToView('externalPayment')}
              className="text-amber-700 hover:underline flex items-center gap-1 cursor-pointer"
              title="سندات الصرف"
            >
              <span>سندات الصرف</span>
              <ArrowRight size={11} className="rotate-180" />
            </button>
          </div>
        </div>

        {/* 5. Check Portfolio Reconciliation */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-purple-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Landmark size={15} className="text-purple-600" />
                <span>دورة الشيكات (1104/2104)</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                حافظة نشطة
              </span>
            </div>
            <div className="text-xs space-y-1 font-mono">
              <div className="flex justify-between text-slate-500">
                <span>شيكات برسم التحصيل:</span>
                <span className="font-bold text-purple-700">{(reconciliation.checks?.inCollectionBalance ?? 0).toLocaleString()} {currencySymbol}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>شيكات صادرة للموردين:</span>
                <span className="font-bold text-slate-800">{(reconciliation.checks?.issuedBalance ?? 0).toLocaleString()} {currencySymbol}</span>
              </div>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => navigateToView('bankChecks')}
              className="text-purple-700 hover:underline flex items-center gap-1 cursor-pointer w-full justify-between"
              title="فتح حافظة ودورة الشيكات البنكية"
            >
              <span>فتح حافظة الشيكات</span>
              <ArrowRight size={11} className="rotate-180" />
            </button>
          </div>
        </div>

      </div>

      {/* Commercial Discounts Hub (الخصومات المكتسبة والمسموح بها وميزان المراجعة) */}
      <div className="bg-white border-2 border-indigo-100 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
              <Percent size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  الخصومات التجارية في ميزان المراجعة (المسموح بها والمكتسبة)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  حسابات مستقلة ومتوازنة
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                تسجيل ومطابقة الخصومات كحركات محاسبية مستقلة في ميزان المراجعة بدلاً من إخفائها في صافي الفاتورة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setShowPrintPreview(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all border border-blue-200 cursor-pointer"
              title="طباعة التقرير"
            >
              <Printer size={14} />
              <span>طباعة التقرير</span>
            </button>
            <button
              type="button"
              onClick={() => setShowDiscountGuideModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all border border-indigo-200 cursor-pointer"
              title="الدليل التوجيهي لمحاسبة الخصومات التجارية"
            >
              <HelpCircle size={14} />
              <span>الدليل المحاسبي للخصومات</span>
            </button>

            <button
              type="button"
              onClick={() => setAccountTypeFilter(accountTypeFilter === 'DISCOUNTS' ? 'ALL' : 'DISCOUNTS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                accountTypeFilter === 'DISCOUNTS'
                  ? 'bg-indigo-700 text-white border-indigo-700'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <Tag size={14} className={accountTypeFilter === 'DISCOUNTS' ? 'text-white' : 'text-indigo-600'} />
              <span>{accountTypeFilter === 'DISCOUNTS' ? 'إلغاء التصفية (عرض الكل)' : 'تصفية الميزان على الخصومات'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Card 1: الخصم المسموح به (4103) */}
          <div className="p-4 bg-gradient-to-br from-blue-50/70 to-slate-50 border border-blue-200/80 rounded-2xl flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="p-1 bg-blue-600 text-white rounded-md text-[10px] font-mono font-bold">4103</span>
                  <span className="text-xs font-black text-slate-900">الخصم المسموح به (خصم المبيعات)</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  مدين (Debit)
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                تخفيض ممنوح للعملاء على فواتير المبيعات (حساب مقابل للإيراد Contra-Revenue)
              </p>
            </div>

            <div className="flex items-baseline justify-between pt-2 border-t border-blue-200/60">
              <div>
                <span className="text-xs text-slate-500 block">إجمالي الخصم الممنوح:</span>
                <span className="text-lg font-mono font-black text-blue-900">
                  {discountsSummary.allowedDiscount.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-600 font-mono bg-white px-2 py-1 rounded-lg border border-slate-200">
                {discountsSummary.allowedDiscount.count} فاتورة
              </span>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-blue-200/60">
              <button
                type="button"
                onClick={() => setSelectedAccountId('acc-4103')}
                className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <BookOpen size={13} />
                <span>كشف حركة الخصم (4103)</span>
              </button>
              <button
                type="button"
                onClick={() => navigateToView('sales')}
                className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                title="فتح شاشة المبيعات"
              >
                <ShoppingCart size={13} className="text-emerald-600" />
                <span>المبيعات</span>
              </button>
            </div>
          </div>

          {/* Card 2: الخصم المكتسب (4203) */}
          <div className="p-4 bg-gradient-to-br from-emerald-50/70 to-slate-50 border border-emerald-200/80 rounded-2xl flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="p-1 bg-emerald-600 text-white rounded-md text-[10px] font-mono font-bold">4203</span>
                  <span className="text-xs font-black text-slate-900">الخصم المكتسب (خصم المشتريات)</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  دائن (Credit)
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                تخفيض محصل من الموردين على فواتير المشتريات (توفير تكلفة أو إيراد مكتسب)
              </p>
            </div>

            <div className="flex items-baseline justify-between pt-2 border-t border-emerald-200/60">
              <div>
                <span className="text-xs text-slate-500 block">إجمالي الخصم المكتسب:</span>
                <span className="text-lg font-mono font-black text-emerald-900">
                  {discountsSummary.earnedDiscount.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-600 font-mono bg-white px-2 py-1 rounded-lg border border-slate-200">
                {discountsSummary.earnedDiscount.count} فاتورة
              </span>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-emerald-200/60">
              <button
                type="button"
                onClick={() => setSelectedAccountId('acc-4203')}
                className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <BookOpen size={13} />
                <span>كشف حركة الخصم (4203)</span>
              </button>
              <button
                type="button"
                onClick={() => navigateToView('purchases')}
                className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                title="فتح شاشة المشتريات"
              >
                <Receipt size={13} className="text-rose-600" />
                <span>المشتريات</span>
              </button>
            </div>
          </div>

          {/* Card 3: صافي أثر الخصومات */}
          <div className="p-4 bg-slate-900 text-white border border-slate-800 rounded-2xl flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <Scale size={15} className="text-amber-400" />
                  <span>صافي أثر الخصومات التجارية</span>
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  discountsSummary.netDiscountImpact >= 0 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                }`}>
                  {discountsSummary.netDiscountImpact >= 0 ? 'وفورات إيجابية' : 'تكلفة تسويقية'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                الفرق بين الخصومات المكتسبة من الموردين والخصومات الممنوحة للعملاء
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-400 block">صافي الأثر المالي:</span>
              <div className="flex items-baseline gap-2">
                <span className={`text-xl font-mono font-black ${
                  discountsSummary.netDiscountImpact >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {discountsSummary.netDiscountImpact >= 0 ? '+' : '-'}{Math.abs(discountsSummary.netDiscountImpact).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {discountsSummary.netDiscountImpact >= 0 
                  ? 'الوفورات المكتسبة من المشتريات تفوق الخصومات الممنوحة للمبيعات'
                  : 'الخصومات الممنوحة للعملاء تفوق الخصومات المكتسبة من الموردين'}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-300">
              <span>تأثير التوازن في الميزان:</span>
              <span className="font-bold text-emerald-400">متوازن 100% محاسبياً</span>
            </div>
          </div>
        </div>
      </div>

      {/* Balance Equilibrium Status Banner */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs ${
        totals.isBalanced 
          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' 
          : 'bg-rose-50 border-rose-300 text-rose-950'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl text-white ${totals.isBalanced ? 'bg-emerald-600' : 'bg-rose-600'}`}>
            {totals.isBalanced ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          </div>
          <div>
            <h3 className="font-bold text-sm">
              {totals.isBalanced 
                ? 'ميزان المراجعة متوازن محاسبياً (إجمالي المدين = إجمالي الدائن)' 
                : `تنبيه: ميزان المراجعة غير متوازن! يوجد فرق مقداره ${Math.abs(totals.difference).toLocaleString()} ${currencySymbol}`}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              إجمالي الحركات: مدين {totals.totalDebitMovement.toLocaleString()} {currencySymbol} | دائن {totals.totalCreditMovement.toLocaleString()} {currencySymbol} — عدد الحسابات النشطة: {totals.activeAccountsCount}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto font-mono text-xs">
          <span className="px-3 py-1 bg-white/80 rounded-lg border border-slate-200 font-bold">
            الرصيد المدين: {totals.totalEndingDebit.toLocaleString()} {currencySymbol}
          </span>
          <span className="px-3 py-1 bg-white/80 rounded-lg border border-slate-200 font-bold">
            الرصيد الدائن: {totals.totalEndingCredit.toLocaleString()} {currencySymbol}
          </span>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:hidden">
        
        {/* KPI 1: Balance Status */}
        <div className={`p-4 rounded-2xl border ${
          totals.isBalanced 
            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' 
            : 'bg-rose-50/60 border-rose-200 text-rose-950'
        } shadow-2xs transition-all`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">حالة الميزان المحاسبي</span>
            {totals.isBalanced ? (
              <CheckCircle2 size={18} className="text-emerald-600" />
            ) : (
              <AlertTriangle size={18} className="text-rose-600" />
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-xl sm:text-2xl font-black ${totals.isBalanced ? 'text-emerald-700' : 'text-rose-700'}`}>
              {totals.isBalanced ? 'متوازن 100%' : 'غير متوازن'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {totals.isBalanced 
              ? 'تطابق تام بين إجمالي المدين والدائن (0.00)' 
              : `فارق التوازن: ${Math.abs(totals.difference).toLocaleString()} ${currencySymbol}`}
          </p>
        </div>

        {/* KPI 2: Total Debit Movements / Ending */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">إجمالي الحركة المدينة</span>
            <div className="w-2 h-2 rounded-full bg-blue-500" />
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {totals.totalDebitMovement.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-400 mr-1">{currencySymbol}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
            <span>الرصيد النهائي المدين:</span>
            <span className="font-bold font-mono text-blue-700">
              {totals.totalEndingDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* KPI 3: Total Credit Movements / Ending */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">إجمالي الحركة الدائنة</span>
            <div className="w-2 h-2 rounded-full bg-purple-500" />
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {totals.totalCreditMovement.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-400 mr-1">{currencySymbol}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
            <span>الرصيد النهائي الدائن:</span>
            <span className="font-bold font-mono text-purple-700">
              {totals.totalEndingCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* KPI 4: Active Accounts Count */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">الحسابات المعروضة</span>
            <Layers size={16} className="text-slate-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {filteredRows.length}
            </span>
            <span className="text-xs text-slate-500 mr-1">حساب</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {hideZeroBalances ? 'تم إخفاء الحسابات الصفريّة' : 'عرض جميع الحسابات بما فيها الصفريّة'}
          </p>
        </div>

      </div>

      {/* Filters & Control Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <label className="text-[11px] font-bold text-slate-600 mb-1 block">البحث برقم أو اسم الحساب</label>
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث بكود الحساب أو الاسم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-blue-500 text-slate-800"
              />
              <Search size={15} className="absolute right-3 top-2.5 text-slate-400" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 mb-1 block">من تاريخ</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-blue-500 text-slate-800"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 mb-1 block">إلى تاريخ</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-blue-500 text-slate-800"
            />
          </div>

          {/* Level Filter */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 mb-1 block">مستوى الحساب</label>
            <select
              value={maxLevel}
              onChange={(e) => setMaxLevel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-blue-500 text-slate-800 font-bold"
            >
              <option value="ALL">كل المستويات (مفصل)</option>
              <option value="1">المستوى 1 (إجمالي الأبواب)</option>
              <option value="2">المستوى 2 (مجموعات رئيسية)</option>
              <option value="3">المستوى 3 (حسابات عامة)</option>
              <option value="4">المستوى 4 (حسابات فرعية)</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 mb-1 block">تصنيف الحساب</label>
            <select
              value={accountTypeFilter}
              onChange={(e) => setAccountTypeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-blue-500 text-slate-800 font-bold"
            >
              <option value="ALL">جميع التبويبات (الكل)</option>
              <option value="DISCOUNTS">الخصومات التجارية (4103 / 4203)</option>
              <option value={AccountType.Asset}>الأصول (Assets)</option>
              <option value={AccountType.Liability}>الالتزامات (Liabilities)</option>
              <option value={AccountType.Equity}>حقوق الملكية (Equity)</option>
              <option value={AccountType.Revenue}>الإيرادات (Revenues)</option>
              <option value={AccountType.Expense}>المصروفات (Expenses)</option>
            </select>
          </div>

        </div>

        {/* Second Row: View Modes & Quick Presets */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          
          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-bold text-[11px]">فترة سريعة:</span>
            <button
              type="button"
              onClick={handlePresetCurrentMonth}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors cursor-pointer text-[11px]"
            >
              الشهر الحالي
            </button>
            <button
              type="button"
              onClick={handlePresetCurrentYear}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors cursor-pointer text-[11px]"
            >
              السنة الحالية
            </button>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={handleClearDates}
                className="px-2.5 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg font-medium transition-colors cursor-pointer text-[11px]"
              >
                مسح التواريخ
              </button>
            )}
          </div>

          {/* View Mode & Checkbox */}
          <div className="flex flex-wrap items-center gap-4">
            
            {/* Toggle Hide Zero Balances */}
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
              <input
                type="checkbox"
                checked={hideZeroBalances}
                onChange={(e) => setHideZeroBalances(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              <span>إخفاء الحسابات الصفريّة (بدون حركة)</span>
            </label>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setViewMode('TOTALS_AND_BALANCES')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'TOTALS_AND_BALANCES'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                المجاميع والأرصدة
              </button>
              <button
                type="button"
                onClick={() => setViewMode('BALANCES_ONLY')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'BALANCES_ONLY'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الأرصدة فقط
              </button>
              <button
                type="button"
                onClick={() => setViewMode('MOVEMENTS_ONLY')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'MOVEMENTS_ONLY'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                المجاميع والحركة
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* Printable Area Wrapper for window.print and PDF Export */}
      <div ref={printAreaRef} id="trial-balance-export-area" className="flex flex-col space-y-5 bg-white p-2 sm:p-4 rounded-2xl border border-slate-200">
        {/* Printable Header Section */}
        <div className={`${isExportingPdf ? 'block' : 'hidden print:block'} text-slate-900 pb-4 mb-4 border-b border-slate-300`}>
          <div className="flex justify-between items-start gap-4 mb-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {systemSettings.company?.logoUrl && (
                <img src={systemSettings.company.logoUrl} alt="Logo" className="h-12 w-auto object-contain rounded shrink-0" />
              )}
              <div className="space-y-0.5 min-w-0 flex-1">
                <h1 className="text-xl font-bold">{systemSettings.company.nameAr || 'لوجوستريا للمحاسبة والأنظمة المالية'}</h1>
                {systemSettings.company.nameEn && (
                  <p className="text-xs text-indigo-900 font-sans font-semibold">{systemSettings.company.nameEn}</p>
                )}
                <p className="text-xs text-slate-600">{systemSettings.company.branchName ? `${systemSettings.company.branchName} - ` : ''}{systemSettings.company.address || 'الفرع الرئيسي - المملكة العربية السعودية'}</p>
                <div className="text-xs text-slate-600 font-mono flex flex-wrap gap-3">
                  <span>الرقم الضريبي: {systemSettings.company.taxNumber || '310123456700003'}</span>
                  {systemSettings.company.commercialRegister && <span>س.ت: {systemSettings.company.commercialRegister}</span>}
                  {systemSettings.company.phone && <span>الهاتف: {systemSettings.company.phone}</span>}
                </div>
              </div>
            </div>
            <div className="text-left shrink-0">
              <h2 className="text-xl font-bold text-blue-900">ميزان المراجعة بالمجاميع والأرصدة</h2>
              <p className="text-xs text-slate-500 mt-1">تاريخ الطباعة: {new Date().toLocaleDateString('ar-SA')}</p>
              <p className="text-xs text-slate-500">
                الفترة: {startDate || 'من بداية النظام'} إلى {endDate || 'حتى تاريخه'}
              </p>
            </div>
          </div>
        </div>

      {/* Main Trial Balance Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              {/* Complex Table Header with multi-level titles */}
              <tr className="bg-slate-900 text-white text-xs font-bold">
                <th className="py-3 px-3 w-28 text-center border-l border-slate-800">كود الحساب</th>
                <th className="py-3 px-4 border-l border-slate-800">اسم الحساب</th>
                <th className="py-3 px-3 w-28 text-center border-l border-slate-800">التصنيف</th>
                
                {(viewMode === 'TOTALS_AND_BALANCES' || viewMode === 'MOVEMENTS_ONLY') && (
                  <th colSpan={2} className="py-2 px-3 text-center border-l border-slate-800 bg-slate-800/80">
                    الحركة خلال الفترة (المجاميع)
                  </th>
                )}

                {(viewMode === 'TOTALS_AND_BALANCES' || viewMode === 'BALANCES_ONLY') && (
                  <th colSpan={2} className="py-2 px-3 text-center border-l border-slate-800 bg-slate-800/50">
                    الأرصدة الصافية النهائية
                  </th>
                )}

                <th className="py-3 px-3 w-20 text-center print:hidden">التفاصيل</th>
              </tr>

              {/* Sub Header for Debit / Credit */}
              <tr className="bg-slate-100 text-slate-700 text-[11px] font-extrabold border-b border-slate-200">
                <th className="py-2 px-3 border-l border-slate-200"></th>
                <th className="py-2 px-4 border-l border-slate-200"></th>
                <th className="py-2 px-3 border-l border-slate-200"></th>

                {(viewMode === 'TOTALS_AND_BALANCES' || viewMode === 'MOVEMENTS_ONLY') && (
                  <>
                    <th className="py-2 px-3 text-left w-36 border-l border-slate-200 text-blue-700 bg-blue-50/50">مدين (Debit)</th>
                    <th className="py-2 px-3 text-left w-36 border-l border-slate-200 text-purple-700 bg-purple-50/50">دائن (Credit)</th>
                  </>
                )}

                {(viewMode === 'TOTALS_AND_BALANCES' || viewMode === 'BALANCES_ONLY') && (
                  <>
                    <th className="py-2 px-3 text-left w-36 border-l border-slate-200 text-emerald-700 bg-emerald-50/50">رصيد مدين</th>
                    <th className="py-2 px-3 text-left w-36 border-l border-slate-200 text-amber-700 bg-amber-50/50">رصيد دائن</th>
                  </>
                )}

                <th className="py-2 px-3 print:hidden"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Layers size={32} className="text-slate-300" />
                      <span className="font-bold">لا توجد حسابات مطابقة لشروط البحث أو الفلاتر المحددة</span>
                      <p className="text-[11px] text-slate-400">جرب إلغاء تفعيل "إخفاء الحسابات الصفريّة" أو تغيير التاريخ</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const opLink = getAccountOperationalLink(row.account.code);
                  return (
                  <tr 
                    key={row.account.id} 
                    onClick={() => setSelectedAccountId(row.account.id)}
                    className="hover:bg-blue-50/60 transition-colors group cursor-pointer"
                    title="انقر لعرض كشف حركة الحساب (دفتر الأستاذ) والتفاصيل"
                  >
                    {/* Account Code */}
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 group-hover:text-blue-700 border-l border-slate-100">
                      <div className="flex items-center justify-center gap-1">
                        <span>{row.account.code}</span>
                        <Eye size={12} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                      </div>
                    </td>

                    {/* Account Name */}
                    <td className="py-2.5 px-4 font-bold text-slate-900 border-l border-slate-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="group-hover:text-blue-800 transition-colors">{row.account.name}</span>
                        {row.account.code === '4103' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                            خصم مبيعات (مدين)
                          </span>
                        )}
                        {row.account.code === '4203' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            خصم مشتريات (دائن)
                          </span>
                        )}
                        {/* Direct operational screen shortcut badge */}
                        {opLink && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigateToView(opLink.view, row.account.code);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer print:hidden ${opLink.badgeClass}`}
                            title={`انتقال مباشر إلى: ${opLink.title}`}
                          >
                            {opLink.icon}
                            <span>{opLink.shortLabel}</span>
                            <ArrowRight size={10} className="rotate-180" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Account Type Badge */}
                    <td className="py-2.5 px-3 text-center border-l border-slate-100">
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-md border ${getAccountTypeBadge(row.account.type)}`}>
                        {getAccountTypeLabel(row.account.type)}
                      </span>
                    </td>

                    {/* Debit Movement */}
                    {(viewMode === 'TOTALS_AND_BALANCES' || viewMode === 'MOVEMENTS_ONLY') && (
                      <td className="py-2.5 px-3 text-left font-mono font-semibold text-slate-800 border-l border-slate-100">
                        {row.debitMovement > 0 
                          ? row.debitMovement.toLocaleString(undefined, { minimumFractionDigits: 2 })
                          : <span className="text-slate-300">-</span>}
                      </td>
                    )}

                    {/* Credit Movement */}
                    {(viewMode === 'TOTALS_AND_BALANCES' || viewMode === 'MOVEMENTS_ONLY') && (
                      <td className="py-2.5 px-3 text-left font-mono font-semibold text-slate-800 border-l border-slate-100">
                        {row.creditMovement > 0 
                          ? row.creditMovement.toLocaleString(undefined, { minimumFractionDigits: 2 })
                          : <span className="text-slate-300">-</span>}
                      </td>
                    )}

                    {/* Ending Debit Balance */}
                    {(viewMode === 'TOTALS_AND_BALANCES' || viewMode === 'BALANCES_ONLY') && (
                      <td className="py-2.5 px-3 text-left font-mono font-bold text-emerald-700 bg-emerald-50/20 border-l border-slate-100">
                        {row.endingDebit > 0 
                          ? row.endingDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })
                          : <span className="text-slate-300 font-normal">-</span>}
                      </td>
                    )}

                    {/* Ending Credit Balance */}
                    {(viewMode === 'TOTALS_AND_BALANCES' || viewMode === 'BALANCES_ONLY') && (
                      <td className="py-2.5 px-3 text-left font-mono font-bold text-purple-700 bg-purple-50/20 border-l border-slate-100">
                        {row.endingCredit > 0 
                          ? row.endingCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })
                          : <span className="text-slate-300 font-normal">-</span>}
                      </td>
                    )}

                    {/* Action Button */}
                    <td className="py-2.5 px-3 text-center print:hidden">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAccountId(row.account.id);
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                          title="عرض كشف وتفاصيل الحركة (دفتر الأستاذ)"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToView('accountMovements', row.account.code);
                          }}
                          className="p-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                          title="فتح في شاشة حركة الحسابات (3 أعمدة: مدين - دائن - بيان الحركة)"
                        >
                          <Scale size={15} />
                        </button>
                      </div>
                    </td>

                  </tr>
                  );
                })
              )}
            </tbody>

            {/* Totals Summary Footer */}
            <tfoot>
              <tr className="bg-slate-900 text-white font-bold text-xs border-t-2 border-slate-900">
                <td className="py-3 px-3 text-center border-l border-slate-800 font-mono">
                  Σ
                </td>
                <td colSpan={2} className="py-3 px-4 border-l border-slate-800 text-sm">
                  المجموع الإجمالي (الإجماليات للتوازن)
                </td>

                {(viewMode === 'TOTALS_AND_BALANCES' || viewMode === 'MOVEMENTS_ONLY') && (
                  <>
                    <td className="py-3 px-3 text-left font-mono text-sm text-blue-300 border-l border-slate-800">
                      {totals.totalDebitMovement.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-left font-mono text-sm text-purple-300 border-l border-slate-800">
                      {totals.totalCreditMovement.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </>
                )}

                {(viewMode === 'TOTALS_AND_BALANCES' || viewMode === 'BALANCES_ONLY') && (
                  <>
                    <td className="py-3 px-3 text-left font-mono text-sm text-emerald-300 border-l border-slate-800 bg-slate-800/60">
                      {totals.totalEndingDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-left font-mono text-sm text-amber-300 border-l border-slate-800 bg-slate-800/60">
                      {totals.totalEndingCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </>
                )}

                <td className="py-3 px-3 print:hidden"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Official Audit & Signatures Box (Print & PDF) */}
      <div className={`${isExportingPdf ? 'block' : 'hidden print:block'} pt-10 mt-8 border-t border-slate-300`}>
        <div className="flex justify-between items-center text-center text-xs text-slate-700">
          <div>
            <p className="font-bold">أعد بواسطة (المحاسب المسؤول)</p>
            <p className="text-[10px] text-slate-500 mt-1">التوقيع: ............................</p>
          </div>
          <div>
            <p className="font-bold">روجِع بواسطة (المراجع الداخلي)</p>
            <p className="text-[10px] text-slate-500 mt-1">التوقيع: ............................</p>
          </div>
          <div>
            <p className="font-bold">اعتُمِد بواسطة (المدير المالي / العام)</p>
            <p className="text-[10px] text-slate-500 mt-1">التوقيع: ............................</p>
          </div>
        </div>
        <p className="text-center text-[10px] text-slate-400 mt-8">
          تم إنشاؤه آلياً بواسطة نظام لوجوستريا المحاسبي - Logustria ERP
        </p>
      </div>

      </div> {/* End of printAreaRef wrapper */}

      {/* Account Ledger Movement Detail Modal */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs print:hidden overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-none sm:max-h-[85vh] flex flex-col sm:overflow-hidden overflow-y-auto my-auto">
            
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 static sm:sticky sm:top-0 z-10 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600 rounded-xl">
                  <BookOpen size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base">
                      كشف حركة الحساب (دفتر الأستاذ العام)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                      {selectedRow.account.code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {selectedRow.account.name} • التصنيف: <span className="font-semibold text-blue-200">{getAccountTypeLabel(selectedRow.account.type)}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    sessionStorage.setItem('alpha_target_account_code', selectedRow.account.code);
                    setSelectedAccountId(null);
                    navigateToView('accountMovements', selectedRow.account.code);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title="فتح هذا الحساب في شاشة حركة الحسابات الشاملة بالجدول الثلاثي"
                >
                  <Scale size={14} />
                  <span>فتح في حركة الحسابات</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportLedgerExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title="تصدير كشف حركة هذا الحساب إلى Excel"
                >
                  <FileSpreadsheet size={14} />
                  <span>تصدير Excel</span>
                </button>

                {/* أداة التكبير والتصغير المرنة بأي قيمة (Flexible Zoom Control with Slider & Stepper) */}
                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 shadow-2xs text-white">
                  <button
                    type="button"
                    onClick={() => setLedgerZoom(z => Math.max(z - 15, 30))}
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
                    value={ledgerZoom}
                    onChange={(e) => setLedgerZoom(Number(e.target.value))}
                    className="w-20 sm:w-28 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    title={`نسبة التكبير: ${ledgerZoom}% (اسحب للتحكم بأي قيمة)`}
                  />

                  <button
                    type="button"
                    onClick={() => setLedgerZoom(z => Math.min(z + 15, 220))}
                    className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                    title="تكبير (+15%)"
                  >
                    <ZoomIn size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLedgerZoom(100);
                      resetLedgerPan();
                    }}
                    className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                      ledgerZoom === 100 
                        ? 'bg-slate-700 text-slate-300' 
                        : 'bg-blue-600 text-white hover:bg-blue-500'
                    }`}
                    title="إعادة ضبط المعاينة إلى 100%"
                  >
                    {ledgerZoom}%
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer"
                  title="طباعة كشف حركة الحساب"
                >
                  <Printer size={14} />
                  <span>طباعة</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedAccountId(null)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer border border-slate-700"
                  title="إغلاق النافذة"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Contextual Jump Banners for Key Operational Accounts */}
            {(selectedRow.account.code === '1201' || selectedRow.account.code.startsWith('1201')) && (
              <div className="mx-4 mt-3 p-3 bg-gradient-to-r from-emerald-900 to-slate-900 text-white border border-emerald-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg">
                    <Users size={18} />
                  </div>
                  <div>
                    <span className="font-bold block text-sm">كشف حساب عميل وتفصيلي متصل (Continuous Detailed Ledger):</span>
                    <span className="text-[11px] text-emerald-200">عرض فواتير وسندات العميل كقائمة متصلة مع تفاصيل الأصناف والرصيد التراكمي اللحظي</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAccountId(null);
                    navigateToView('customerStatement');
                  }}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg font-black shadow-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                >
                  <span>فتح شاشة كشف حساب عميل</span>
                  <ArrowRight size={13} className="rotate-180" />
                </button>
              </div>
            )}

            {(selectedRow.account.code === '2101' || selectedRow.account.code.startsWith('2101')) && (
              <div className="mx-4 mt-3 p-3 bg-gradient-to-r from-rose-900 to-slate-900 text-white border border-rose-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-rose-500/20 text-rose-300 rounded-lg">
                    <Truck size={18} />
                  </div>
                  <div>
                    <span className="font-bold block text-sm">أرصدة وذمم الموردين وكشف الحساب التفصيلي:</span>
                    <span className="text-[11px] text-rose-200">متابعة الفواتير المستحقة، السندات، وتواريخ الاستحقاق لجميع الموردين</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAccountId(null);
                    navigateToView('partnerBalances');
                  }}
                  className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-400 text-slate-950 rounded-lg font-black shadow-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                >
                  <span>أرصدة الموردين</span>
                  <ArrowRight size={13} className="rotate-180" />
                </button>
              </div>
            )}

            {(selectedRow.account.code === '1301' || selectedRow.account.code.startsWith('1301')) && (
              <div className="mx-4 mt-3 p-3 bg-gradient-to-r from-amber-950 to-slate-900 text-white border border-amber-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-amber-500/20 text-amber-300 rounded-lg">
                    <Warehouse size={18} />
                  </div>
                  <div>
                    <span className="font-bold block text-sm">أرصدة وتقييم المخزون السلعي (المستودعات):</span>
                    <span className="text-[11px] text-amber-200">بطاقات الأصناف، الجرد الفعلي، متوسط التكلفة، ومطابقة المخزون</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAccountId(null);
                    navigateToView('warehouseBalances');
                  }}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-black shadow-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                >
                  <span>فتح بطاقات وأرصدة المخازن</span>
                  <ArrowRight size={13} className="rotate-180" />
                </button>
              </div>
            )}

            {/* Account Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 border-b border-slate-200 text-xs">
              <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-slate-500 block text-[10px] font-bold">إجمالي حركة المدين</span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  {selectedRow.debitMovement.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-slate-500 block text-[10px] font-bold">إجمالي حركة الدائن</span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  {selectedRow.creditMovement.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-slate-500 block text-[10px] font-bold">صافي الرصيد النهائي</span>
                <span className={`font-mono font-black text-sm ${selectedRow.netMovement >= 0 ? 'text-emerald-700' : 'text-purple-700'}`}>
                  {Math.abs(selectedRow.netMovement).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-slate-500 block text-[10px] font-bold">طبيعة الرصيد المحاسبي</span>
                <span className="font-bold text-slate-800">
                  {selectedRow.netMovement > 0 ? 'مدين (Debit)' : selectedRow.netMovement < 0 ? 'دائن (Credit)' : 'متوازن (Zero)'}
                </span>
              </div>
            </div>

            {/* Filter & Search Bar inside Ledger Modal */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 bg-slate-100/80 border-b border-slate-200 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                  <Calendar size={14} className="text-blue-600" />
                  <span>الفترة:</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-[10px]">من</span>
                  <input 
                    type="date" 
                    value={ledgerStartDate} 
                    onChange={e => setLedgerStartDate(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 font-mono shadow-2xs"
                  />
                  <span className="text-slate-400 text-[10px]">إلى</span>
                  <input 
                    type="date" 
                    value={ledgerEndDate} 
                    onChange={e => setLedgerEndDate(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 font-mono shadow-2xs"
                  />
                  {(ledgerStartDate || ledgerEndDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setLedgerStartDate('');
                        setLedgerEndDate('');
                      }}
                      className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      إلغاء التحديد
                    </button>
                  )}
                </div>
              </div>

              <div className="relative min-w-[220px]">
                <Search size={13} className="absolute right-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={ledgerSearch}
                  onChange={e => setLedgerSearch(e.target.value)}
                  placeholder="بحث برقم القيد، البيان، المرجع..."
                  className="w-full bg-white border border-slate-300 rounded-lg pr-8 pl-3 py-1.5 text-xs text-slate-800 shadow-2xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Ledger Movements Table with 4-Way Pan & Drag */}
            <div 
              className={`flex-1 overflow-y-auto p-4 select-none ${
                ledgerZoom > 100 
                  ? (isLedgerDragging ? 'cursor-grabbing' : 'cursor-grab') 
                  : 'cursor-default'
              }`}
              onMouseDown={handleLedgerMouseDown}
              onMouseMove={handleLedgerMouseMove}
              onMouseUp={handleLedgerMouseUp}
              onMouseLeave={handleLedgerMouseUp}
              onTouchStart={handleLedgerTouchStart}
              onTouchMove={handleLedgerTouchMove}
              onTouchEnd={handleLedgerTouchEnd}
            >
              <div 
                className="w-full transition-transform duration-100 origin-top"
                style={{
                  transform: `translate3d(${ledgerPan.x}px, ${ledgerPan.y}px, 0px) scale(${ledgerZoom / 100})`,
                  transformOrigin: 'top center',
                  marginBottom: ledgerZoom > 100 ? `${(ledgerZoom - 100) * 8}px` : '0px'
                }}
              >
              {selectedLedgerItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="font-bold text-sm">لا توجد تفاصيل حركات مسجلة لهذا الحساب خلال الفترة المحددة</p>
                </div>
              ) : (
                <table className="w-full text-right border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="py-2 px-3 border-b border-slate-200 w-24">التاريخ</th>
                      <th className="py-2 px-3 border-b border-slate-200 w-28">رقم القيد</th>
                      <th className="py-2 px-3 border-b border-slate-200 w-28">مصدر الحركة</th>
                      <th className="py-2 px-3 border-b border-slate-200">البيان / الوصف</th>
                      <th className="py-2 px-3 border-b border-slate-200 text-left w-28 text-blue-700">مدين</th>
                      <th className="py-2 px-3 border-b border-slate-200 text-left w-28 text-purple-700">دائن</th>
                      <th className="py-2 px-3 border-b border-slate-200 text-left w-28">الرصيد التراكمي</th>
                      <th className="py-2 px-3 border-b border-slate-200 text-center w-24">الشاشة المصدر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedLedgerItems.map((item) => {
                      const getSourceBadge = (source?: string) => {
                        if (source === 'SALES_INVOICE' || source === 'فواتير المبيعات' || item.source === 'SALES') {
                          return { label: item.sourceLabel || 'فاتورة مبيعات', view: 'sales', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
                        }
                        if (source === 'PURCHASE_INVOICE' || source === 'فواتير المشتريات' || item.source === 'PURCHASE') {
                          return { label: item.sourceLabel || 'فاتورة مشتريات', view: 'purchases', color: 'bg-rose-50 text-rose-700 border-rose-200' };
                        }
                        switch (source) {
                          case 'EXTERNAL_RECEIPT':
                            return { label: 'سند قبض عميل', view: 'externalReceipt', color: 'bg-blue-50 text-blue-700 border-blue-200' };
                          case 'EXTERNAL_PAYMENT':
                            return { label: 'سند صرف مورد', view: 'externalPayment', color: 'bg-amber-50 text-amber-700 border-amber-200' };
                          case 'INTERNAL_RECEIPT':
                            return { label: 'قبض داخلي', view: 'internalReceipt', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
                          case 'INTERNAL_PAYMENT':
                            return { label: 'صرف داخلي', view: 'internalPayment', color: 'bg-orange-50 text-orange-700 border-orange-200' };
                          case 'INVENTORY_AUDIT':
                            return { label: 'تسوية جرد', view: 'inventoryCount', color: 'bg-purple-50 text-purple-700 border-purple-200' };
                          case 'PAYROLL':
                            return { label: 'مسير رواتب', view: 'payroll', color: 'bg-teal-50 text-teal-700 border-teal-200' };
                          case 'MANUFACTURING':
                            return { label: 'أمر تصنيع', view: 'manufacturing', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
                          default:
                            return { label: 'قيد يومية عام', view: 'journal', color: 'bg-slate-100 text-slate-700 border-slate-200' };
                        }
                      };
                      const src = getSourceBadge(item.sourceModule);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-slate-600">{item.date}</td>
                          <td className="py-2 px-3 font-mono font-bold text-blue-700">{item.entryNumber}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${src.color}`}>
                              {src.label}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-800 font-medium">{item.description}</td>
                          <td className="py-2 px-3 font-mono font-bold text-left text-blue-700">
                            {item.debit > 0 ? item.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-left text-purple-700">
                            {item.credit > 0 ? item.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-left text-slate-900">
                            {item.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            <span className="text-[10px] text-slate-400 mr-1">
                              ({item.balanceType === 'DEBIT' ? 'مدين' : item.balanceType === 'CREDIT' ? 'دائن' : '-'})
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAccountId(null);
                                navigateToView(src.view);
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 rounded-md text-[10px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title={`الانتقال إلى شاشة ${src.label}`}
                            >
                              <span>فتح</span>
                              <ExternalLink size={10} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAccountId(null)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Educational Accounting Guide Modal for Discounts */}
      {showDiscountGuideModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-none sm:max-h-[85vh] flex flex-col sm:overflow-hidden overflow-y-auto my-auto">
            
            {/* Modal Header */}
            <div className="p-4 bg-indigo-950 text-white flex items-center justify-between static sm:sticky sm:top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 rounded-xl">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    الدليل المحاسبي: الخصومات المكتسبة والمسموح بها في ميزان المراجعة
                  </h3>
                  <p className="text-xs text-indigo-200">
                    المعايير الدولية لإعداد التقارير المالية (IFRS) والقيد المزدوج التلقائي
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDiscountGuideModal(false)}
                className="p-1.5 rounded-lg bg-indigo-900 text-indigo-200 hover:text-white hover:bg-indigo-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs sm:text-sm text-slate-700 leading-relaxed">
              
              {/* Introduction */}
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-950">
                <p className="font-bold text-sm">لماذا يتم تسجيل الخصم كحساب مستقل في ميزان المراجعة؟</p>
                <p className="mt-1 text-xs text-indigo-800 leading-relaxed">
                  في المحاسبة الاحترافية، لا يُحبّذ شطب الخصومات بصمت من صافي الفاتورة دون إثباتها دفترياً؛ لأن الإدارة المالية ومراقبي الحسابات يحتاجون لمعرفة إجمالي حجم المبيعات قبل الخصم، ومقدار التنازلات الترويجية الممنوحة للعملاء (الخصم المسموح به)، وكذلك مقدار الوفورات المحققة عند الشراء من الموردين (الخصم المكتسب).
                </p>
              </div>

              {/* Section 1: الخصم المسموح به */}
              <div className="border border-blue-200 bg-blue-50/40 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md font-mono font-bold text-xs">4103</span>
                    <h4 className="font-black text-blue-950 text-sm">1. الخصم المسموح به (Sales Discount / Discount Allowed)</h4>
                  </div>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold text-xs border border-blue-200">
                    طبيعته: مدين (Debit)
                  </span>
                </div>
                
                <p className="text-xs text-slate-600">
                  هو الخصم الذي تمنحه المنشأة لعملائها كحافز تجاري أو لتعجيل الدفع النقدي. يُصنف محاسبياً كـ <strong>حساب مقابل للإيرادات (Contra-Revenue Account)</strong> ويقع تحت تبويب الإيرادات بكود مستقل.
                </p>

                <div className="bg-white p-3 rounded-xl border border-blue-200 font-mono text-xs space-y-1">
                  <p className="font-sans font-bold text-slate-900 mb-1.5">القيد المحاسبي التلقائي لفاتورة المبيعات المتضمنة خصم:</p>
                  <div className="text-emerald-700">من مذكورين:</div>
                  <div className="pr-4 text-slate-800">• حـ/ العملاء أو الصندوق (الصافي المطلوب بعد الخصم + الضريبة)</div>
                  <div className="pr-4 text-blue-700 font-bold">• حـ/ الخصم المسموح به - كود 4103 (مبلغ الخصم) [مدين]</div>
                  <div className="text-emerald-700 mt-1">إلى مذكورين:</div>
                  <div className="pr-4 text-slate-800">• حـ/ إيرادات المبيعات - كود 4101 (إجمالي الفاتورة قبل الخصم) [دائن]</div>
                  <div className="pr-4 text-slate-800">• حـ/ ضريبة القيمة المضافة المحصلة - كود 2105 [دائن]</div>
                </div>
              </div>

              {/* Section 2: الخصم المكتسب */}
              <div className="border border-emerald-200 bg-emerald-50/40 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-md font-mono font-bold text-xs">4203</span>
                    <h4 className="font-black text-emerald-950 text-sm">2. الخصم المكتسب (Purchases Discount / Discount Received)</h4>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs border border-emerald-200">
                    طبيعته: دائن (Credit)
                  </span>
                </div>
                
                <p className="text-xs text-slate-600">
                  هو الخصم أو الوفر المالي الذي تحصل عليه المنشأة من مورديها عند شراء بضاعة أو تعجيل السداد. يُصنف محاسبياً إما كـ <strong>تخفيض لتكلفة المخزون والمشتريات</strong> أو كـ <strong>إيرادات تجارية متنوعة</strong> ويُقيد دائناً.
                </p>

                <div className="bg-white p-3 rounded-xl border border-emerald-200 font-mono text-xs space-y-1">
                  <p className="font-sans font-bold text-slate-900 mb-1.5">القيد المحاسبي التلقائي لفاتورة المشتريات المتضمنة خصم:</p>
                  <div className="text-emerald-700">من حـ/ المخزون السلعي أو المشتريات - كود 1301 (إجمالي القيمة قبل الخصم) [مدين]</div>
                  <div className="text-emerald-700 mt-1">إلى مذكورين:</div>
                  <div className="pr-4 text-slate-800">• حـ/ الموردين أو الصندوق (الصافي المستحق للمورد بعد الخصم) [دائن]</div>
                  <div className="pr-4 text-emerald-700 font-bold">• حـ/ الخصم المكتسب - كود 4203 (مبلغ الخصم) [دائن]</div>
                </div>
              </div>

              {/* Equilibrium Assurance */}
              <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold">
                    ضمان التوازن المحاسبي في ميزان المراجعة:
                  </span>
                </div>
                <span className="text-xs font-mono text-emerald-300 font-bold">
                  إجمالي المدين = إجمالي الدائن دائماً (100%)
                </span>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDiscountGuideModal(false)}
                className="px-5 py-2 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                فهمت ذلك، إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
    </>
  );
}
