import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Printer, 
  Search, 
  Filter, 
  Calendar, 
  Eye, 
  RotateCcw, 
  ArrowRight, 
  X, 
  Check, 
  Download, 
  Scale, 
  Layers, 
  Wrench, 
  HardHat, 
  Package, 
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ShieldCheck,
  CheckCircle2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { 
  getAllSearchableEntities, 
  getUnifiedAccountMovements, 
  AccountMovementRow, 
  SearchableEntity, 
  EntityCategory 
} from '../utils/accountMovementsStore';
import { useSystemCurrency } from '../utils/currency';
import { getSystemSettings } from '../utils/settings';
import { exportToXLSX } from '../utils/universalExport';
import { printElementDirectly } from '../utils/pdfExport';
import { useLanguage } from '../i18n/LanguageContext';
import { useIsInWindow } from './DesktopWindowManager';
import { 
  getSelectedBrowsingYear, 
  getActiveFiscalYear, 
  FISCAL_YEAR_CHANGED_EVENT 
} from '../utils/fiscalYearArchive';

interface AccountMovementsScreenProps {
  initialEntityId?: string;
  onNavigate?: (view: string) => void;
  isInWindow?: boolean;
}

export default function AccountMovementsScreen({
  initialEntityId,
  onNavigate,
  isInWindow: explicitIsInWindow
}: AccountMovementsScreenProps) {
  const isInWindow = useIsInWindow(explicitIsInWindow);
  const { t } = useLanguage();
  const { symbol: currencySymbol, fullNameAr: currencyFullNameAr, tafqeet } = useSystemCurrency();
  const systemSettings = getSystemSettings();
  const companyName = systemSettings?.company?.nameAr || systemSettings?.company?.nameEn || 'لوجوستريا للمحاسبة';

  const initialFiscalYear = useMemo(() => {
    const bYear = getSelectedBrowsingYear();
    const aYear = getActiveFiscalYear();
    const curYear = new Date().getFullYear();
    return bYear || aYear || curYear;
  }, []);

  // Filters State
  const [startDate, setStartDate] = useState<string>(() => `${initialFiscalYear}-01-01`);
  const [endDate, setEndDate] = useState<string>(() => `${initialFiscalYear}-12-31`);
  const [selectedEntityId, setSelectedEntityId] = useState<string>(() => {
    if (initialEntityId) return initialEntityId;
    try {
      const stored = sessionStorage.getItem('alpha_target_account_code') || sessionStorage.getItem('alpha_target_entity_id');
      if (stored) return stored;
    } catch {}
    return 'ALL'; // Default to ALL to immediately showcase all movements and balances!
  });

  // Listen to cross-screen navigation and data change events in real time
  useEffect(() => {
    const handleAccountTarget = () => {
      try {
        const stored = sessionStorage.getItem('alpha_target_account_code') || sessionStorage.getItem('alpha_target_entity_id');
        if (stored) {
          setSelectedEntityId(stored);
        }
      } catch {}
    };

    const handleDataChanged = () => {
      setRefreshKey(prev => prev + 1);
    };

    handleAccountTarget();
    window.addEventListener('alpha-account-target-changed', handleAccountTarget);
    window.addEventListener('storage', handleDataChanged);
    window.addEventListener('alpha-data-changed', handleDataChanged);
    window.addEventListener('fiscal-year-changed', handleDataChanged);
    window.addEventListener('alpha-journal-updated', handleDataChanged);

    return () => {
      window.removeEventListener('alpha-account-target-changed', handleAccountTarget);
      window.removeEventListener('storage', handleDataChanged);
      window.removeEventListener('alpha-data-changed', handleDataChanged);
      window.removeEventListener('fiscal-year-changed', handleDataChanged);
      window.removeEventListener('alpha-journal-updated', handleDataChanged);
    };
  }, []);

  // Sort Order State: 'ASC' (الأسبق أولاً من الأعلى للأسفل) vs 'DESC' (الأحدث أولاً من الأعلى للأسفل)
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

  // Applied Filters State (Data is displayed ONLY when user clicks 'بحث')
  const [appliedFilters, setAppliedFilters] = useState<{
    startDate: string;
    endDate: string;
    selectedEntityId: string;
    category: EntityCategory;
    searchTerm: string;
    sortOrder: 'ASC' | 'DESC';
  } | null>(null);

  const hasSearched = appliedFilters !== null;

  // Toggle sort direction and immediately update results if search is active
  const handleToggleSortOrder = (newOrder: 'ASC' | 'DESC') => {
    setSortOrder(newOrder);
    if (appliedFilters) {
      setAppliedFilters(prev => prev ? { ...prev, sortOrder: newOrder } : null);
    }
  };

  // Handle executing account search and data retrieval
  const handleExecuteAccountSearch = (entityIdToApply?: string) => {
    let target = entityIdToApply || selectedEntityId;
    if (isEntityDropdownOpen && entitySearchInput.trim() && filteredEntitiesForDropdown.length > 0) {
      target = filteredEntitiesForDropdown[0].id;
    }
    setSelectedEntityId(target);
    const cat = target && target !== 'ALL' ? 'ALL' : categoryFilter;
    if (target && target !== 'ALL') {
      setCategoryFilter('ALL');
    }
    try {
      sessionStorage.setItem('alpha_target_account_code', target);
      sessionStorage.setItem('alpha_target_entity_id', target);
    } catch {}
    setIsEntityDropdownOpen(false);
    setEntitySearchInput('');
    setAppliedFilters({
      startDate,
      endDate,
      selectedEntityId: target,
      category: cat,
      searchTerm: searchTerm.trim(),
      sortOrder
    });
    setRefreshKey(prev => prev + 1);
  };

  // Cross-screen navigator to open origin document or module
  const handleNavigateToSource = (sourceView?: string, mov?: AccountMovementRow) => {
    if (!sourceView) return;
    if (mov?.entityId) {
      try {
        sessionStorage.setItem('alpha_target_account_code', mov.entityId);
        sessionStorage.setItem('alpha_target_entity_id', mov.entityId);
      } catch {}
    }
    if (onNavigate) {
      onNavigate(sourceView);
    } else {
      window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: sourceView } }));
    }
  };

  const [categoryFilter, setCategoryFilter] = useState<EntityCategory>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [displayMode, setDisplayMode] = useState<'STANDARD_3_COLS' | 'DETAILED_MULTI_COLS'>('STANDARD_3_COLS');
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);

  // Search dropdown state
  const [isEntityDropdownOpen, setIsEntityDropdownOpen] = useState(false);
  const [entitySearchInput, setEntitySearchInput] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const entitySearchInputRef = useRef<HTMLInputElement>(null);

  // Print Preview Modal State
  const [showPrintPreviewModal, setShowPrintPreviewModal] = useState<boolean>(false);
  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const [previewPan, setPreviewPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isModalDragging, setIsModalDragging] = useState<boolean>(false);
  const modalDragRef = useRef<{ startX: number; startY: number; initPanX: number; initPanY: number }>({ startX: 0, startY: 0, initPanX: 0, initPanY: 0 });
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Reset zoom and pan whenever preview modal is opened or closed
  useEffect(() => {
    setPreviewZoom(100);
    setPreviewPan({ x: 0, y: 0 });
  }, [showPrintPreviewModal]);

  const resetPreviewPan = () => {
    setPreviewPan({ x: 0, y: 0 });
  };

  const handleModalMouseDown = (e: React.MouseEvent) => {
    if (previewZoom <= 100) return;
    setIsModalDragging(true);
    modalDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initPanX: previewPan.x,
      initPanY: previewPan.y
    };
  };

  const handleModalMouseMove = (e: React.MouseEvent) => {
    if (!isModalDragging || previewZoom <= 100) return;
    const dx = e.clientX - modalDragRef.current.startX;
    const dy = e.clientY - modalDragRef.current.startY;
    setPreviewPan({
      x: modalDragRef.current.initPanX + dx,
      y: modalDragRef.current.initPanY + dy
    });
  };

  const handleModalMouseUp = () => {
    setIsModalDragging(false);
  };

  const handleModalTouchStart = (e: React.TouchEvent) => {
    if (previewZoom <= 100 || e.touches.length !== 1) return;
    setIsModalDragging(true);
    modalDragRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      initPanX: previewPan.x,
      initPanY: previewPan.y
    };
  };

  const handleModalTouchMove = (e: React.TouchEvent) => {
    if (!isModalDragging || previewZoom <= 100) return;
    const dx = e.touches[0].clientX - modalDragRef.current.startX;
    const dy = e.touches[0].clientY - modalDragRef.current.startY;
    setPreviewPan({
      x: modalDragRef.current.initPanX + dx,
      y: modalDragRef.current.initPanY + dy
    });
  };

  const handleModalTouchEnd = () => {
    setIsModalDragging(false);
  };

  // Refresh trigger
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Sync date range with selected browsing fiscal year
  useEffect(() => {
    const handleFiscalYearSync = () => {
      const bYear = getSelectedBrowsingYear();
      const aYear = getActiveFiscalYear();
      const curYear = new Date().getFullYear();
      const targetYear = bYear || aYear || curYear;
      if (targetYear) {
        setStartDate(`${targetYear}-01-01`);
        setEndDate(`${targetYear}-12-31`);
      }
      setRefreshKey(prev => prev + 1);
    };

    handleFiscalYearSync();
    window.addEventListener(FISCAL_YEAR_CHANGED_EVENT, handleFiscalYearSync);
    window.addEventListener('storage', handleFiscalYearSync);
    window.addEventListener('alpha-journal-entries-updated', handleFiscalYearSync);
    window.addEventListener('alpha-chart-of-accounts-updated', handleFiscalYearSync);

    return () => {
      window.removeEventListener(FISCAL_YEAR_CHANGED_EVENT, handleFiscalYearSync);
      window.removeEventListener('storage', handleFiscalYearSync);
      window.removeEventListener('alpha-journal-entries-updated', handleFiscalYearSync);
      window.removeEventListener('alpha-chart-of-accounts-updated', handleFiscalYearSync);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsEntityDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load all searchable entities
  const allEntities = useMemo(() => {
    return getAllSearchableEntities();
  }, [refreshKey]);

  // Selected Entity Object
  const selectedEntity = useMemo(() => {
    if (!selectedEntityId || selectedEntityId === 'ALL') return null;
    return allEntities.find(e => e.id === selectedEntityId || e.code === selectedEntityId) || null;
  }, [allEntities, selectedEntityId]);

  // Filtered entity list for the dropdown
  const filteredEntitiesForDropdown = useMemo(() => {
    if (!entitySearchInput.trim()) {
      return allEntities;
    }
    const q = entitySearchInput.toLowerCase().trim();
    return allEntities.filter(e => 
      e.name.toLowerCase().includes(q) ||
      e.code.toLowerCase().includes(q) ||
      e.categoryLabel.toLowerCase().includes(q) ||
      (e.phone && e.phone.includes(q))
    );
  }, [allEntities, entitySearchInput]);

  // Compute Movements & Summary (Calculates ONLY after user clicks 'بحث')
  const { movements, summary } = useMemo(() => {
    if (!appliedFilters) {
      return {
        movements: [],
        summary: {
          totalDebit: 0,
          totalCredit: 0,
          netMovement: 0,
          difference: 0,
          count: 0,
          balanceType: 'ZERO' as const,
          openingBalance: 0,
          endingBalance: 0,
          currency: currencySymbol
        }
      };
    }
    return getUnifiedAccountMovements({
      startDate: appliedFilters.startDate,
      endDate: appliedFilters.endDate,
      selectedEntityId: appliedFilters.selectedEntityId === 'ALL' ? undefined : appliedFilters.selectedEntityId,
      category: appliedFilters.category === 'ALL' ? undefined : appliedFilters.category,
      searchTerm: appliedFilters.searchTerm,
      sortOrder: appliedFilters.sortOrder || sortOrder
    });
  }, [appliedFilters, currencySymbol, refreshKey, sortOrder]);

  // Quick Date Range Presets
  const setDatePreset = (preset: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all') => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'week') {
      const firstDay = new Date(today);
      firstDay.setDate(today.getDate() - 7);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'month') {
      setStartDate(`${yyyy}-${mm}-01`);
      setEndDate(todayStr);
    } else if (preset === 'quarter') {
      const qMonth = Math.floor(today.getMonth() / 3) * 3 + 1;
      const qStart = `${yyyy}-${String(qMonth).padStart(2, '0')}-01`;
      setStartDate(qStart);
      setEndDate(todayStr);
    } else if (preset === 'year') {
      setStartDate(`${yyyy}-01-01`);
      setEndDate(`${yyyy}-12-31`);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!hasSearched) {
      alert('يرجى الضغط على زر "بحث" أولاً لعرض الحركات المراد تصديرها.');
      return;
    }
    if (movements.length === 0) {
      alert('لا توجد حركات مسجلة لتصديرها.');
      return;
    }

    const exportRows = movements.map(m => [
      m.date,
      m.documentNumber,
      m.documentType,
      m.entityName,
      m.description,
      m.reference || '-',
      m.debit > 0 ? m.debit : 0,
      m.credit > 0 ? m.credit : 0,
      m.runningBalance ?? 0
    ]);

    const entityLabel = selectedEntity ? `${selectedEntity.name} (${selectedEntity.categoryLabel})` : 'جميع الحسابات والجهات';
    const periodLabel = `من: ${appliedFilters?.startDate || 'البداية'} إلى: ${appliedFilters?.endDate || 'تاريخه'}`;

    exportToXLSX({
      filename: `كشف_حركة_الحسابات_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'حركة الحسابات',
      title: 'كشف حركة الحسابات العام',
      subtitle: `${entityLabel} | ${periodLabel}`,
      headers: [
        'التاريخ',
        'رقم المستند',
        'نوع العملية',
        'الحساب / الجهة',
        'بيان الحركة التفصيلي',
        'المرجع',
        'مدين',
        'دائن',
        'الرصيد التراكمي'
      ],
      rows: exportRows,
      summaryRows: [
        ['', '', '', '', 'إجمالي المدين', '', summary.totalDebit, '', ''],
        ['', '', '', '', 'إجمالي الدائن', '', '', summary.totalCredit, ''],
        ['', '', '', '', 'الفرق (مدين - دائن)', '', '', '', summary.difference]
      ]
    });
  };

  // Direct Print
  const handlePrint = () => {
    if (!hasSearched) {
      alert('يرجى الضغط على زر "بحث" أولاً لعرض الحركات قبل الطباعة.');
      return;
    }
    if (printAreaRef.current) {
      printElementDirectly(printAreaRef.current);
    } else {
      window.print();
    }
  };

  // Formatting helpers
  const fmt = (num: number) => {
    return (num || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <div className="flex flex-col space-y-5 print:space-y-2 pb-16">
      {/* Top Banner / Title */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-4 sm:p-6 shadow-md border border-slate-700/60 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {!isInWindow && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                <Scale size={24} />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">حركة الحسابات</h1>
                <p className="text-xs sm:text-sm text-slate-300">
                  كشف حركة وتحليل قيود الحسابات، العملاء، الموردين، الخزن، البنوك، والمصروفات بالجدول الثلاثي (مدين - دائن - بيان الحركة)
                </p>
              </div>
            </div>
          </div>
          )}

          {/* Action Buttons: Preview, Direct Print, Excel, Refresh (3D tactile styling) */}
          <div className="flex items-center flex-wrap gap-2.5 self-start md:self-auto">
            {/* زر المعاينة 3D */}
            <button
              type="button"
              onClick={() => setShowPrintPreviewModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-b from-indigo-500 to-indigo-700 hover:from-indigo-400 hover:to-indigo-600 text-white rounded-xl text-xs font-black shadow-[0_4px_0_0_#312e81,0_6px_10px_rgba(0,0,0,0.3)] hover:shadow-[0_5px_0_0_#312e81,0_8px_12px_rgba(0,0,0,0.35)] active:shadow-[0_1px_0_0_#312e81] active:translate-y-[3px] transition-all cursor-pointer border-t border-indigo-300/40"
              title="معاينة كشف حركة الحسابات قبل الطباعة"
            >
              <Eye size={15} />
              <span>معاينة الطباعة</span>
            </button>

            {/* زر الطباعة 3D */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-b from-slate-700 to-slate-900 hover:from-slate-600 hover:to-slate-800 text-white rounded-xl text-xs font-black shadow-[0_4px_0_0_#0f172a,0_6px_10px_rgba(0,0,0,0.3)] hover:shadow-[0_5px_0_0_#0f172a,0_8px_12px_rgba(0,0,0,0.35)] active:shadow-[0_1px_0_0_#0f172a] active:translate-y-[3px] transition-all cursor-pointer border-t border-slate-500/40"
              title="طباعة فورية للكشف"
            >
              <Printer size={15} />
              <span>طباعة</span>
            </button>

            {/* زر تصدير Excel 3D */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-b from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white rounded-xl text-xs font-black shadow-[0_4px_0_0_#064e3b,0_6px_10px_rgba(0,0,0,0.3)] hover:shadow-[0_5px_0_0_#064e3b,0_8px_12px_rgba(0,0,0,0.35)] active:shadow-[0_1px_0_0_#064e3b] active:translate-y-[3px] transition-all cursor-pointer border-t border-emerald-400/40"
              title="تصدير إلى ملف Excel"
            >
              <FileSpreadsheet size={15} />
              <span>تصدير Excel</span>
            </button>

            {/* زر تحديث البيانات 3D */}
            <button
              type="button"
              onClick={() => setRefreshKey(prev => prev + 1)}
              className="p-2.5 bg-gradient-to-b from-slate-700 to-slate-900 hover:from-slate-600 hover:to-slate-800 text-slate-200 hover:text-white rounded-xl shadow-[0_4px_0_0_#0f172a,0_6px_10px_rgba(0,0,0,0.3)] hover:shadow-[0_5px_0_0_#0f172a] active:shadow-[0_1px_0_0_#0f172a] active:translate-y-[3px] transition-all cursor-pointer border-t border-slate-500/40"
              title="تحديث البيانات"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Card: Date Range & Universal Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4 print:hidden">
        {/* Row 1: Date Range & Quick Presets */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {/* Date From */}
          <div className="md:col-span-3 space-y-1">
            <label className="block text-xs font-black text-slate-800">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="text-slate-700" />
                <span>تاريخ من:</span>
              </span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-300 border-t-slate-200 border-b-slate-400 bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 text-xs font-mono font-black text-slate-900 shadow-[0_4px_0_0_#64748b,0_5px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_5px_0_0_#475569,0_7px_12px_rgba(0,0,0,0.16)] hover:-translate-y-0.5 focus:bg-white focus:outline-none focus:border-slate-500 focus:shadow-[0_2px_0_0_#64748b,inset_0_2px_4px_rgba(0,0,0,0.1)] focus:translate-y-[2px] transition-all cursor-pointer"
            />
          </div>

          {/* Date To */}
          <div className="md:col-span-3 space-y-1">
            <label className="block text-xs font-black text-slate-800">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="text-slate-700" />
                <span>تاريخ إلى:</span>
              </span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-300 border-t-slate-200 border-b-slate-400 bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 text-xs font-mono font-black text-slate-900 shadow-[0_4px_0_0_#64748b,0_5px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_5px_0_0_#475569,0_7px_12px_rgba(0,0,0,0.16)] hover:-translate-y-0.5 focus:bg-white focus:outline-none focus:border-slate-500 focus:shadow-[0_2px_0_0_#64748b,inset_0_2px_4px_rgba(0,0,0,0.1)] focus:translate-y-[2px] transition-all cursor-pointer"
            />
          </div>

          {/* Quick Date Presets */}
          <div className="md:col-span-6 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 ml-1">فترات سريعة:</span>
            <button
              type="button"
              onClick={() => setDatePreset('today')}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-800 text-xs font-black border border-slate-300 shadow-[0_3px_0_0_#cbd5e1,0_2px_4px_rgba(0,0,0,0.06)] active:shadow-[0_1px_0_0_#cbd5e1] active:translate-y-[2px] transition-all cursor-pointer"
            >
              اليوم
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('week')}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-800 text-xs font-black border border-slate-300 shadow-[0_3px_0_0_#cbd5e1,0_2px_4px_rgba(0,0,0,0.06)] active:shadow-[0_1px_0_0_#cbd5e1] active:translate-y-[2px] transition-all cursor-pointer"
            >
              آخر 7 أيام
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('month')}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-800 text-xs font-black border border-slate-300 shadow-[0_3px_0_0_#cbd5e1,0_2px_4px_rgba(0,0,0,0.06)] active:shadow-[0_1px_0_0_#cbd5e1] active:translate-y-[2px] transition-all cursor-pointer"
            >
              هذا الشهر
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('quarter')}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-800 text-xs font-black border border-slate-300 shadow-[0_3px_0_0_#cbd5e1,0_2px_4px_rgba(0,0,0,0.06)] active:shadow-[0_1px_0_0_#cbd5e1] active:translate-y-[2px] transition-all cursor-pointer"
            >
              هذا الربع
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('year')}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-800 text-xs font-black border border-slate-300 shadow-[0_3px_0_0_#cbd5e1,0_2px_4px_rgba(0,0,0,0.06)] active:shadow-[0_1px_0_0_#cbd5e1] active:translate-y-[2px] transition-all cursor-pointer"
            >
              هذا العام
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('all')}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-b from-indigo-50 to-indigo-100 hover:from-white hover:to-indigo-200 text-indigo-900 text-xs font-black border border-indigo-200 shadow-[0_3px_0_0_#c7d2fe,0_2px_4px_rgba(0,0,0,0.06)] active:shadow-[0_1px_0_0_#c7d2fe] active:translate-y-[2px] transition-all cursor-pointer"
            >
              كل التواريخ
            </button>

            {/* زر بحث سريع للفترة المحددة 3D */}
            <button
              type="button"
              onClick={() => handleExecuteAccountSearch()}
              className="mr-auto px-4 py-2 rounded-xl bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white text-xs font-black shadow-[0_3px_0_0_#1e3a8a,0_4px_6px_rgba(0,0,0,0.15)] active:shadow-[0_1px_0_0_#1e3a8a] active:translate-y-[2px] flex items-center gap-1.5 cursor-pointer border-t border-blue-400/40 transition-all"
              title="تطبيق والبحث في الفترة المحددة"
            >
              <Search size={13} />
              <span>بحث في الفترة</span>
            </button>
          </div>
        </div>

        {/* Row 2: The Comprehensive Search Bar & Account Selector */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-2 border-t border-slate-100">
          {/* Searchable Account / Entity Dropdown Selector */}
          <div className="md:col-span-4 relative" ref={dropdownRef}>
            <label className="block text-xs font-black text-slate-800 mb-1">
              اختر الحساب أو الجهة (عميل / مورد / خزينة / بنك / مصروف...):
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEntityDropdownOpen(!isEntityDropdownOpen)}
                className="flex-1 min-w-0 h-11 px-4 bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 hover:from-slate-50 hover:via-slate-150 hover:to-slate-250 border-2 border-slate-300 border-t-slate-200 border-b-slate-400 rounded-xl flex items-center justify-between text-xs text-right transition-all cursor-pointer shadow-[0_4px_0_0_#64748b,0_5px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_5px_0_0_#475569,0_7px_12px_rgba(0,0,0,0.16)] hover:-translate-y-0.5 active:shadow-[0_1px_0_0_#64748b] active:translate-y-[3px]"
              >
                <div className="flex items-center gap-2 truncate">
                  {selectedEntity ? (
                    <>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${selectedEntity.badgeColor}`}>
                        {selectedEntity.categoryLabel}
                      </span>
                      <span className="font-black text-slate-900 truncate">{selectedEntity.name}</span>
                      <span className="font-mono text-slate-500 font-bold text-[11px]">({selectedEntity.code})</span>
                    </>
                  ) : (
                    <span className="text-slate-800 font-black flex items-center gap-1.5 truncate">
                      <Layers size={14} className="text-blue-700 shrink-0" />
                      <span className="truncate">جميع الحسابات والجهات (كشف شامل)</span>
                    </span>
                  )}
                </div>
                <ChevronDown size={14} className={`text-slate-600 transition-transform shrink-0 mr-1 ${isEntityDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* زر بحث مخصص 3D في نفس السطر لاستدعاء بيانات الحساب المختار */}
              <button
                type="button"
                onClick={() => handleExecuteAccountSearch()}
                className="h-10 px-5 bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-[0_3px_0_0_#1e3a8a,0_4px_6px_rgba(0,0,0,0.15)] active:shadow-[0_1px_0_0_#1e3a8a] active:translate-y-[2px] shrink-0 cursor-pointer border-t border-blue-400/50"
                title="استدعاء وبحث حركات الحساب المختار فوراً"
              >
                <Search size={14} />
                <span>بحث</span>
              </button>
            </div>

            {/* Dropdown Menu */}
            {isEntityDropdownOpen && (
              <div className="absolute top-full right-0 left-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-80 animate-in fade-in-50 duration-150">
                {/* Search inside Dropdown */}
                <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                  <Search size={14} className="text-slate-400" />
                  <input
                    ref={entitySearchInputRef}
                    type="text"
                    value={entitySearchInput}
                    onChange={(e) => setEntitySearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleExecuteAccountSearch();
                      }
                    }}
                    placeholder="ابحث بالاسم أو الكود أو رقم الهاتف..."
                    className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
                    autoFocus
                  />
                  {entitySearchInput && (
                    <button type="button" onClick={() => setEntitySearchInput('')} className="text-slate-400 hover:text-slate-600">
                      <X size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleExecuteAccountSearch()}
                    className="px-3.5 py-1.5 bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white rounded-lg text-xs font-black shrink-0 transition-all shadow-[0_2px_0_0_#1e3a8a] active:shadow-none active:translate-y-[1px] cursor-pointer border-t border-blue-400/40"
                  >
                    استدعاء
                  </button>
                </div>

                {/* List items */}
                <div className="overflow-y-auto divide-y divide-slate-100 text-xs">
                  {/* Option: All Accounts */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEntityId('ALL');
                      setIsEntityDropdownOpen(false);
                      setEntitySearchInput('');
                    }}
                    className={`w-full text-right p-2.5 flex items-center justify-between hover:bg-blue-50 transition-colors ${
                      selectedEntityId === 'ALL' ? 'bg-blue-50/70 font-bold text-blue-700' : 'text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Layers size={14} className="text-blue-600" />
                      <span>جميع الحسابات والجهات (شامل كل العمليات)</span>
                    </div>
                    {selectedEntityId === 'ALL' && <Check size={14} className="text-blue-600" />}
                  </button>

                  {filteredEntitiesForDropdown.map((ent) => {
                    const isSelected = selectedEntityId === ent.id || selectedEntityId === ent.code;
                    return (
                      <button
                        key={ent.id}
                        type="button"
                        onClick={() => {
                          setSelectedEntityId(ent.id);
                          setCategoryFilter('ALL');
                          try {
                            sessionStorage.setItem('alpha_target_account_code', ent.id);
                            sessionStorage.setItem('alpha_target_entity_id', ent.id);
                          } catch {}
                          setIsEntityDropdownOpen(false);
                          setEntitySearchInput('');
                          setRefreshKey(prev => prev + 1);
                        }}
                        className={`w-full text-right p-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                          isSelected ? 'bg-blue-50 font-bold text-blue-800' : 'text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${ent.badgeColor}`}>
                            {ent.categoryLabel}
                          </span>
                          <span className="truncate">{ent.name}</span>
                          <span className="font-mono text-[10px] text-slate-400 shrink-0">({ent.code})</span>
                        </div>
                        {isSelected && <Check size={14} className="text-blue-600 shrink-0 mr-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Universal Text Search Bar */}
          <div className="md:col-span-4 space-y-1">
            <label className="block text-xs font-black text-slate-800">
              خانة البحث الشاملة (رقم سند، فاتورة، بيان، فني، موظف، أصل...):
            </label>
            <div className="relative">
              <Search size={16} className="absolute right-3.5 top-3.5 text-slate-700 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleExecuteAccountSearch();
                  }
                }}
                placeholder="ابحث في كل شيء: اسم العميل، المورد، الخزينة، الفني، رقم المستند، البيان..."
                className="w-full h-11 pr-10 pl-9 rounded-xl border-2 border-slate-300 border-t-slate-200 border-b-slate-400 bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 text-xs font-black text-slate-900 placeholder-slate-600 shadow-[0_4px_0_0_#64748b,0_5px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_5px_0_0_#475569,0_7px_12px_rgba(0,0,0,0.16)] hover:-translate-y-0.5 focus:bg-white focus:outline-none focus:border-slate-500 focus:shadow-[0_2px_0_0_#64748b,inset_0_2px_4px_rgba(0,0,0,0.1)] focus:translate-y-[2px] transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute left-3.5 top-3.5 text-slate-500 hover:text-slate-800"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Sort Order Toggle: By Movement Entry Date & Time (الأسبق أولاً من الأعلى للأسفل vs الأحدث) */}
          <div className="md:col-span-2 space-y-1">
            <label className="block text-xs font-bold text-slate-700">ترتيب تاريخ ووقت الإدخال:</label>
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => handleToggleSortOrder('ASC')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black transition-all text-center cursor-pointer flex items-center justify-center gap-1 ${
                  sortOrder === 'ASC'
                    ? 'bg-gradient-to-b from-indigo-600 to-indigo-800 text-white shadow-[0_3px_0_0_#312e81,0_2px_4px_rgba(0,0,0,0.2)] border-t border-indigo-400/50 active:shadow-[0_1px_0_0_#312e81] active:translate-y-[2px]'
                    : 'bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-700 border border-slate-300 shadow-[0_2px_0_0_#cbd5e1] active:translate-y-[1px]'
                }`}
                title="الترتيب حسب تاريخ ووقت إدخال الحركة: الأسبق أولاً من الأعلى للأسفل"
              >
                <span>الأسبق ⬇️</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleSortOrder('DESC')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black transition-all text-center cursor-pointer flex items-center justify-center gap-1 ${
                  sortOrder === 'DESC'
                    ? 'bg-gradient-to-b from-indigo-600 to-indigo-800 text-white shadow-[0_3px_0_0_#312e81,0_2px_4px_rgba(0,0,0,0.2)] border-t border-indigo-400/50 active:shadow-[0_1px_0_0_#312e81] active:translate-y-[2px]'
                    : 'bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-700 border border-slate-300 shadow-[0_2px_0_0_#cbd5e1] active:translate-y-[1px]'
                }`}
                title="الترتيب حسب تاريخ ووقت إدخال الحركة: الأحدث أولاً من الأعلى للأسفل"
              >
                <span>الأحدث ⬆️</span>
              </button>
            </div>
          </div>

          {/* View Mode Toggle: 3 Columns (Default) vs Detailed */}
          <div className="md:col-span-2 space-y-1">
            <label className="block text-xs font-bold text-slate-700">نمط عرض الجدول:</label>
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setDisplayMode('STANDARD_3_COLS')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black transition-all text-center cursor-pointer ${
                  displayMode === 'STANDARD_3_COLS'
                    ? 'bg-gradient-to-b from-indigo-600 to-indigo-800 text-white shadow-[0_3px_0_0_#312e81,0_2px_4px_rgba(0,0,0,0.2)] border-t border-indigo-400/50 active:shadow-[0_1px_0_0_#312e81] active:translate-y-[2px]'
                    : 'bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-700 border border-slate-300 shadow-[0_2px_0_0_#cbd5e1] active:translate-y-[1px]'
                }`}
                title="الجدول المطلوب المكون من ثلاث أعمدة: بيان الحركة | مدين | دائن"
              >
                3 أعمدة
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('DETAILED_MULTI_COLS')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black transition-all text-center cursor-pointer ${
                  displayMode === 'DETAILED_MULTI_COLS'
                    ? 'bg-gradient-to-b from-indigo-600 to-indigo-800 text-white shadow-[0_3px_0_0_#312e81,0_2px_4px_rgba(0,0,0,0.2)] border-t border-indigo-400/50 active:shadow-[0_1px_0_0_#312e81] active:translate-y-[2px]'
                    : 'bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-700 border border-slate-300 shadow-[0_2px_0_0_#cbd5e1] active:translate-y-[1px]'
                }`}
                title="عرض مفصل للأعمدة مع الرصيد التراكمي والتاريخ المنفصل"
              >
                مفصل
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Account Movement Table Area */}
      <div 
        ref={printAreaRef}
        id="account-movements-print-area" 
        className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col p-2 sm:p-5"
      >
        {!hasSearched ? (
          <div className="py-16 sm:py-24 px-4 text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-blue-100">
              <Search size={32} />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-2">
              اضغط على زر "بحث" لعرض بيانات وحركات الحسابات
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
              قم باختيار الحساب أو الجهة وتحديد الفترة من الخيارات أعلاه، ثم اضغط على زر [بحث] لعرض كشف الحركات التفصيلي والرصيد التراكمي.
            </p>
            <button
              type="button"
              onClick={() => handleExecuteAccountSearch()}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white text-xs sm:text-sm font-black rounded-xl shadow-[0_4px_0_0_#1e3a8a,0_6px_10px_rgba(0,0,0,0.2)] active:shadow-[0_1px_0_0_#1e3a8a] active:translate-y-[3px] transition-all cursor-pointer border-t border-blue-400/50"
            >
              <Search size={16} />
              <span>بحث وعرض البيانات</span>
            </button>
          </div>
        ) : (
          <>
            {/* Printable Official Header (Shown during Print & Preview) */}
        <div className="hidden print:block pb-4 mb-4 border-b border-slate-300 text-slate-900">
          <div className="flex justify-between items-start gap-4">
            {!isInWindow && (
          <div className="space-y-1">
              <h1 className="text-xl font-bold">{companyName}</h1>
              {systemSettings.company?.nameEn && (
                <p className="text-xs text-slate-600 font-sans font-semibold">{systemSettings.company.nameEn}</p>
              )}
              <p className="text-xs text-slate-500">{systemSettings.company.address || 'المملكة العربية السعودية'}</p>
              <div className="text-xs text-slate-600 font-mono flex gap-4">
                <span>الرقم الضريبي: {systemSettings.company.taxNumber || '310123456700003'}</span>
                {systemSettings.company.commercialRegister && <span>س.ت: {systemSettings.company.commercialRegister}</span>}
              </div>
            </div>
            )}
            <div className="text-left">
              <h2 className="text-lg font-bold text-indigo-900">كشف حركة الحسابات</h2>
              <p className="text-xs text-slate-600 mt-1 font-bold">
                {selectedEntity ? `${selectedEntity.name} (${selectedEntity.code})` : 'جميع الحسابات والجهات'}
              </p>
              <p className="text-xs text-slate-500">
                الفترة: {startDate || 'بداية النشاط'} إلى {endDate || 'تاريخه'}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">تاريخ الاستخراج: {new Date().toLocaleDateString('ar-SA')}</p>
            </div>
          </div>
        </div>

        {/* The Exact 3-Column Table Requested by the User:
            [ بيان الحركة | مدين | دائن ]
            مع إمكانية التبديل إلى العرض المفصل
        */}
        <div className="overflow-x-auto p-1.5 sm:p-2.5">
          {displayMode === 'STANDARD_3_COLS' ? (
            /* Standard 3-Column Layout */
            <table className="w-full text-right border-separate border-spacing-y-2 print:border-collapse print:border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-900 text-white text-xs font-bold border-b border-slate-800 shadow-sm">
                  <th className="py-3.5 px-4 w-[60%] rounded-r-xl print:rounded-none border-l border-slate-800">بيان الحركة</th>
                  <th className="py-3.5 px-4 w-[20%] text-center border-l border-slate-800">مدين ({currencySymbol})</th>
                  <th className="py-3.5 px-4 w-[20%] text-center rounded-l-xl print:rounded-none">دائن ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-slate-400 bg-white rounded-xl">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Layers size={32} className="text-slate-300" />
                        <span className="font-bold text-slate-600">لا توجد حركات مسجلة تطابق شروط البحث أو الفترة المحددة</span>
                        <p className="text-[11px] text-slate-400">جرب توسيع نطاق التواريخ أو مسح كلمة البحث</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  movements.map((mov, idx) => {
                    const isSelected = selectedMovementId === mov.id;
                    return (
                      <tr 
                        key={mov.id} 
                        onClick={() => setSelectedMovementId(isSelected ? null : mov.id)}
                        className={`group cursor-pointer transition-all duration-200 origin-center relative select-none ${
                          isSelected 
                            ? 'scale-[1.025] -translate-y-1 z-30 bg-indigo-50/95 shadow-2xl shadow-indigo-900/20 ring-2 ring-indigo-600 rounded-2xl' 
                            : 'hover:scale-[1.025] hover:-translate-y-1 hover:z-20 hover:shadow-2xl hover:shadow-indigo-500/15 hover:bg-white hover:ring-2 hover:ring-indigo-400 rounded-2xl ' + (idx % 2 === 0 ? 'bg-white shadow-xs' : 'bg-slate-50/80 shadow-xs')
                        }`}
                        title="انقر أو قف على الحركة لتكبيرها وتوضيح كافة تفاصيلها"
                      >
                        {/* عمود 1: بيان الحركة المتكامل والمنسق */}
                        <td className="py-3.5 px-4 rounded-r-2xl print:rounded-none border-y border-r border-slate-200/80 print:border-slate-100">
                          <div className="space-y-2 transition-transform duration-200 group-hover:scale-[1.01] origin-right">
                            {/* شريط البيانات التوثيقية: التاريخ + نوع المستند ورقم المرجع */}
                            <div className="flex items-center gap-2 flex-wrap text-[11px] group-hover:text-xs transition-all">
                              <span className="font-mono font-black text-slate-700 bg-slate-100 group-hover:bg-slate-200/80 px-2 py-0.5 rounded-lg border border-slate-200 inline-flex items-center gap-1.5 transition-all">
                                <span>📅 {mov.date}</span>
                                {mov.formattedTime && (
                                  <span className="text-indigo-800 bg-indigo-50 group-hover:bg-indigo-100 px-1.5 py-0.5 rounded-md border border-indigo-200 text-[10px] font-bold">
                                    🕒 {mov.formattedTime}
                                  </span>
                                )}
                              </span>
                              {mov.sourceView ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleNavigateToSource(mov.sourceView, mov);
                                  }}
                                  className="font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer"
                                  title={`انقر لفتح شاشة ${mov.sourceModule}`}
                                >
                                  <span>{mov.documentTypeBadge}</span>
                                  <ExternalLink size={11} />
                                </button>
                              ) : (
                                <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                                  {mov.documentTypeBadge}
                                </span>
                              )}
                              <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                                #{mov.documentNumber}
                              </span>
                              {mov.runningBalance !== undefined && (
                                <span className={`font-mono text-[10px] font-black px-2 py-0.5 rounded-lg border transition-all ${
                                  mov.balanceType === 'DEBIT' ? 'bg-blue-50 text-blue-800 border-blue-200 group-hover:bg-blue-100' :
                                  mov.balanceType === 'CREDIT' ? 'bg-emerald-50 text-emerald-800 border-emerald-200 group-hover:bg-emerald-100' :
                                  'bg-slate-50 text-slate-700 border-slate-200'
                                }`}>
                                  الرصيد التراكمي: {fmt(mov.runningBalance)} {currencySymbol} ({mov.balanceType === 'DEBIT' ? 'مدين' : mov.balanceType === 'CREDIT' ? 'دائن' : 'متزن'})
                                </span>
                              )}
                              {mov.technicianOrEmployee && (
                                <span className="font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 flex items-center gap-1">
                                  <HardHat size={11} />
                                  <span>{mov.technicianOrEmployee}</span>
                                </span>
                              )}
                              {isSelected && (
                                <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                                  ✓ حركة محددة ومكبرة
                                </span>
                              )}
                            </div>

                            {/* اسم الحساب / الجهة المعنية بالعملية */}
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                                mov.entityCategory === 'CUSTOMER' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                mov.entityCategory === 'VENDOR' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                mov.entityCategory === 'SAFE' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                mov.entityCategory === 'BANK' ? 'bg-cyan-100 text-cyan-800 border-cyan-200' :
                                mov.entityCategory === 'EXPENSE' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                                'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {mov.entityCategoryLabel}
                              </span>
                              {mov.entityId ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEntityId(mov.entityId!);
                                  }}
                                  className="font-black text-slate-900 group-hover:text-blue-700 text-xs sm:text-sm text-right cursor-pointer hover:underline transition-all"
                                  title="انقر لتصفية وحصر الكشف على هذا الحساب فقط"
                                >
                                  {mov.entityName}
                                </button>
                              ) : (
                                <span className="font-black text-slate-900 text-xs sm:text-sm">{mov.entityName}</span>
                              )}
                            </div>

                            {/* الشرح وبيان الحركة التفصيلي */}
                            <div className="text-slate-700 group-hover:text-slate-950 text-xs sm:text-[13px] font-medium leading-relaxed transition-colors">
                              {mov.description}
                              {mov.reference && mov.reference !== '-' && (
                                <span className="text-slate-400 group-hover:text-slate-600 text-[11px] mr-2">
                                  (مرجع: {mov.reference})
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* عمود 2: مدين */}
                        <td className="py-3.5 px-4 text-center border-y border-slate-200/80 print:border-slate-100 align-middle">
                          {mov.debit > 0 ? (
                            <span className="font-mono font-black text-sm text-blue-700 group-hover:text-base group-hover:scale-115 inline-block transition-transform drop-shadow-xs">
                              {fmt(mov.debit)}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono">-</span>
                          )}
                        </td>

                        {/* عمود 3: دائن */}
                        <td className="py-3.5 px-4 text-center rounded-l-2xl print:rounded-none border-y border-l border-slate-200/80 print:border-slate-100 align-middle">
                          {mov.credit > 0 ? (
                            <span className="font-mono font-black text-sm text-emerald-700 group-hover:text-base group-hover:scale-115 inline-block transition-transform drop-shadow-xs">
                              {fmt(mov.credit)}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* نهاية الجدول: إجمالي الدائن آخر عمود الدائن وإجمالي المدين آخر عمود المدين */}
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-xs border-t-2 border-slate-700 shadow-md">
                  <td className="py-3.5 px-4 rounded-r-xl print:rounded-none border-l border-slate-800 text-right">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-amber-300">الإجماليات الكلية للحركات</span>
                      <span className="text-[11px] font-normal text-slate-300">
                        عدد العمليات: {summary.count} حركة
                      </span>
                    </div>
                  </td>
                  {/* إجمالي المدين آخر عمود المدين */}
                  <td className="py-3.5 px-4 text-center border-l border-slate-800">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-blue-300 font-normal">إجمالي المدين</span>
                      <span className="font-mono font-black text-base text-blue-400">
                        {fmt(summary.totalDebit)}
                      </span>
                    </div>
                  </td>
                  {/* إجمالي الدائن آخر عمود الدائن */}
                  <td className="py-3.5 px-4 text-center rounded-l-xl print:rounded-none">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-emerald-300 font-normal">إجمالي الدائن</span>
                      <span className="font-mono font-black text-base text-emerald-400">
                        {fmt(summary.totalCredit)}
                      </span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          ) : (
            /* Detailed Multi-Column Table Layout */
            <table className="w-full text-right border-separate border-spacing-y-2 print:border-collapse print:border-spacing-0 text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-900 text-white font-bold border-b border-slate-800 shadow-sm">
                  <th className="py-3.5 px-3 w-32 text-center rounded-r-xl print:rounded-none border-l border-slate-800">تاريخ ووقت الإدخال</th>
                  <th className="py-3.5 px-3 w-28 text-center border-l border-slate-800">رقم المستند</th>
                  <th className="py-3.5 px-3 w-32 border-l border-slate-800">نوع الحركة</th>
                  <th className="py-3.5 px-3 w-48 border-l border-slate-800">الحساب / الجهة</th>
                  <th className="py-3.5 px-4 border-l border-slate-800">بيان الحركة</th>
                  <th className="py-3.5 px-3 w-28 text-center border-l border-slate-800">مدين ({currencySymbol})</th>
                  <th className="py-3.5 px-3 w-28 text-center border-l border-slate-800">دائن ({currencySymbol})</th>
                  <th className="py-3.5 px-3 w-32 text-center rounded-l-xl print:rounded-none">الرصيد التراكمي</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400 font-bold bg-white rounded-xl">
                      لا توجد بيانات مطابقة
                    </td>
                  </tr>
                ) : (
                  movements.map((mov, idx) => {
                    const isSelected = selectedMovementId === mov.id;
                    return (
                      <tr 
                        key={mov.id} 
                        onClick={() => setSelectedMovementId(isSelected ? null : mov.id)}
                        className={`group cursor-pointer transition-all duration-200 origin-center relative select-none ${
                          isSelected
                            ? 'scale-[1.025] -translate-y-1 z-30 bg-indigo-50/95 shadow-2xl ring-2 ring-indigo-600 rounded-xl'
                            : 'hover:scale-[1.025] hover:-translate-y-1 hover:z-20 hover:shadow-2xl hover:shadow-indigo-500/15 hover:bg-white hover:ring-2 hover:ring-indigo-400 rounded-xl ' + (idx % 2 === 0 ? 'bg-white shadow-xs' : 'bg-slate-50/90 shadow-xs')
                        }`}
                        title="انقر أو قف على الحركة لتكبيرها وتوضيح تفاصيلها"
                      >
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 rounded-r-xl print:rounded-none border-y border-r border-slate-200/80 print:border-slate-100">
                          <div className="group-hover:scale-105 transition-transform">{mov.date}</div>
                          {mov.formattedTime && (
                            <div className="text-[10px] text-indigo-700 font-bold mt-0.5 whitespace-nowrap group-hover:scale-105 transition-transform">
                              🕒 {mov.formattedTime}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 border-y border-slate-200/80 print:border-slate-100">
                          <span className="group-hover:scale-105 inline-block transition-transform">#{mov.documentNumber}</span>
                        </td>
                        <td className="py-2.5 px-3 border-y border-slate-200/80 print:border-slate-100">
                          {mov.sourceView ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigateToSource(mov.sourceView, mov);
                              }}
                              className="font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer hover:underline"
                              title={`انقر لفتح شاشة ${mov.sourceModule}`}
                            >
                              <span>{mov.documentTypeBadge}</span>
                              <ExternalLink size={10} />
                            </button>
                          ) : (
                            <span className="font-bold text-indigo-700">{mov.documentTypeBadge}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 border-y border-slate-200/80 print:border-slate-100 font-black text-slate-800">
                          {mov.entityId ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEntityId(mov.entityId!);
                              }}
                              className="hover:text-blue-700 text-right cursor-pointer hover:underline group-hover:scale-105 transition-all"
                              title="انقر لتصفية وحصر الكشف على هذا الحساب"
                            >
                              {mov.entityName}
                            </button>
                          ) : (
                            <span className="group-hover:scale-105 transition-transform inline-block">{mov.entityName}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 border-y border-slate-200/80 print:border-slate-100 text-slate-700 group-hover:text-slate-950 group-hover:font-semibold transition-all">
                          {mov.description}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-black text-blue-700 border-y border-slate-200/80 print:border-slate-100">
                          {mov.debit > 0 ? (
                            <span className="group-hover:text-sm group-hover:scale-110 inline-block transition-transform">
                              {fmt(mov.debit)}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-black text-emerald-700 border-y border-slate-200/80 print:border-slate-100">
                          {mov.credit > 0 ? (
                            <span className="group-hover:text-sm group-hover:scale-110 inline-block transition-transform">
                              {fmt(mov.credit)}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-black text-slate-800 rounded-l-xl print:rounded-none border-y border-l border-slate-200/80 print:border-slate-100">
                          <span className="group-hover:scale-110 inline-block transition-transform">{fmt(mov.runningBalance ?? 0)}</span>
                          <span className="text-[10px] text-slate-500 mr-1 block">
                            {mov.balanceType === 'DEBIT' ? 'مدين' : mov.balanceType === 'CREDIT' ? 'دائن' : ''}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-xs border-t-2 border-slate-700 shadow-md">
                  <td colSpan={5} className="py-3 px-4 rounded-r-xl print:rounded-none border-l border-slate-800 text-right">
                    إجمالي الفترة ({summary.count} حركة)
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-black text-blue-400 border-l border-slate-800">
                    {fmt(summary.totalDebit)}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-black text-emerald-400 border-l border-slate-800">
                    {fmt(summary.totalCredit)}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-black text-amber-300 rounded-l-xl print:rounded-none">
                    {fmt(Math.abs(summary.difference))}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* الخانة المطلوبة أسفل الجدول تماماً:
            "وخانة أسفلهم بعد طرح هذا من ذاك"
            رصيد الحساب الحالي / صافي حركة الحساب (مدين - دائن)
        */}
        <div className="mt-4 pt-4 border-t-2 border-slate-200">
          <div className={`p-2.5 sm:p-3 rounded-xl border transition-all ${
            summary.balanceType === 'DEBIT'
              ? 'bg-blue-50/80 border-blue-200 text-blue-950'
              : summary.balanceType === 'CREDIT'
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Left/Right Text description */}
              {!isInWindow && (
          <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`p-1.5 rounded-lg text-white font-bold ${
                    summary.balanceType === 'DEBIT' ? 'bg-blue-600' :
                    summary.balanceType === 'CREDIT' ? 'bg-emerald-600' : 'bg-slate-600'
                  }`}>
                    <Scale size={16} />
                  </span>
                  <span className="text-sm sm:text-base font-black">
                    رصيد الحساب الصافي بعد طرح هذا من ذاك (إجمالي المدين - إجمالي الدائن):
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm">
                  <span className="font-bold">حالة رصيد الحساب:</span>
                  {summary.balanceType === 'DEBIT' && (
                    <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-black text-xs">
                      رصيد الحساب مدين ({fmt(summary.difference)} {currencySymbol}) • (طبيعة الحساب: أصل / ذمة مدينة / مصروف)
                    </span>
                  )}
                  {summary.balanceType === 'CREDIT' && (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black text-xs">
                      رصيد الحساب دائن ({fmt(Math.abs(summary.difference))} {currencySymbol}) • (طبيعة الحساب: التزام / ذمة دائنة / إيراد)
                    </span>
                  )}
                  {summary.balanceType === 'ZERO' && (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-700 text-white font-black text-xs">
                      {selectedEntity ? `رصيد الحساب مصفّر بالكامل (الرصيد = 0.00 ${currencySymbol})` : `كشف شامل متوازن محاسبياً (إجمالي المدين = إجمالي الدائن)`}
                    </span>
                  )}
                </div>

                {/* التفقيط بالعربية الفصحى */}
                {Math.abs(summary.difference) > 0 && (
                  <p className="text-xs text-slate-600 font-medium pt-1">
                    الرصيد كتابة: <span className="font-bold text-slate-900">{tafqeet(Math.abs(summary.difference))}</span>
                  </p>
                )}

                {/* قاعدة محاسبية صريحة تؤكد ملاحظة المستخدم */}
                <div className="mt-2.5 pt-2 border-t border-slate-200/80 text-[11px] text-slate-600 flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                    💡 قاعدة محاسبية:
                  </span>
                  <span className="text-slate-700 font-medium">
                    كشف حركة حساب العميل أو المورد ليس شرطاً أن يكون متزناً (مصفّراً)؛ إذ وظيفته إظهار صافي المديونية ورصيد الحساب المستحق (مدين إذا كان عليه مستحقات، دائن إذا كانت له دفعات مقدمة، أو مصفّر إذا تم سداد كامل الرصيد).
                  </span>
                </div>
              </div>

            )}
              {/* Difference value badge */}
              <div className="flex flex-col items-end shrink-0 bg-white/90 p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  رصيد الحساب الحالي
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className={`text-2xl sm:text-3xl font-black font-mono ${
                    summary.balanceType === 'DEBIT' ? 'text-blue-700' :
                    summary.balanceType === 'CREDIT' ? 'text-emerald-700' : 'text-slate-700'
                  }`}>
                    {fmt(Math.abs(summary.difference))}
                  </span>
                  <span className="text-xs font-bold text-slate-600">{currencySymbol}</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 font-mono">
                  {fmt(summary.totalDebit)} (مدين) - {fmt(summary.totalCredit)} (دائن)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Official Signatures Section for Printing */}
        <div className="hidden print:grid grid-cols-3 gap-6 pt-12 mt-8 text-center text-xs font-bold text-slate-700 border-t border-slate-300">
          <div>
            <p>إعداد المحاسب المسؤول</p>
            <p className="mt-8 text-slate-400 font-normal">........................</p>
          </div>
          <div>
            <p>المراجعة والتدقيق المالي</p>
            <p className="mt-8 text-slate-400 font-normal">........................</p>
          </div>
          <div>
            <p>اعتماد الإدارة العامة</p>
            <p className="mt-8 text-slate-400 font-normal">........................</p>
          </div>
        </div>
          </>
        )}
      </div>

      {/* Print Preview Modal (عند الضغط على زر معاينة) */}
      {showPrintPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-300 animate-in fade-in-50 zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white rounded-t-2xl flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Eye size={18} className="text-indigo-400" />
                <h3 className="font-bold text-sm sm:text-base">معاينة طباعة: كشف حركة الحسابات</h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* أداة التكبير والتصغير المرنة بأي قيمة (Flexible Zoom Control with Slider & Stepper) */}
                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 shadow-2xs text-white">
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(z => Math.max(z - 15, 30))}
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
                    value={previewZoom}
                    onChange={(e) => setPreviewZoom(Number(e.target.value))}
                    className="w-20 sm:w-28 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    title={`نسبة التكبير: ${previewZoom}% (اسحب للتحكم بأي قيمة)`}
                  />

                  <button
                    type="button"
                    onClick={() => setPreviewZoom(z => Math.min(z + 15, 220))}
                    className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                    title="تكبير (+15%)"
                  >
                    <ZoomIn size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPreviewZoom(100);
                      resetPreviewPan();
                    }}
                    className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                      previewZoom === 100 
                        ? 'bg-slate-700 text-slate-300' 
                        : 'bg-blue-600 text-white hover:bg-blue-500'
                    }`}
                    title="إعادة ضبط المعاينة إلى 100%"
                  >
                    {previewZoom}%
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 text-white rounded-xl text-xs font-black shadow-[0_3px_0_0_#1e3a8a] active:shadow-[0_1px_0_0_#1e3a8a] active:translate-y-[2px] transition-all cursor-pointer border-t border-blue-300/40"
                >
                  <Printer size={14} />
                  <span>طباعة الآن</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintPreviewModal(false)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Printable Preview Body with 4-Way Pan & Drag */}
            <div 
              className={`p-6 overflow-auto flex-1 space-y-6 text-slate-900 bg-slate-100 flex justify-center items-start select-none ${
                previewZoom > 100 
                  ? (isModalDragging ? 'cursor-grabbing' : 'cursor-grab') 
                  : 'cursor-default'
              }`}
              onMouseDown={handleModalMouseDown}
              onMouseMove={handleModalMouseMove}
              onMouseUp={handleModalMouseUp}
              onMouseLeave={handleModalMouseUp}
              onTouchStart={handleModalTouchStart}
              onTouchMove={handleModalTouchMove}
              onTouchEnd={handleModalTouchEnd}
            >
              <div 
                className="bg-white p-6 sm:p-8 rounded-xl shadow-xs border border-slate-200 w-full transition-transform duration-100 origin-top"
                style={{
                  transform: `translate3d(${previewPan.x}px, ${previewPan.y}px, 0px) scale(${previewZoom / 100})`,
                  transformOrigin: 'top center',
                  marginBottom: previewZoom > 100 ? `${(previewZoom - 100) * 8}px` : '0px'
                }}
              >
                {/* Official Letterhead */}
                <div className="flex justify-between items-start pb-4 border-b border-slate-300 mb-6">
                  <div>
                    <h2 className="text-xl font-black">{companyName}</h2>
                    <p className="text-xs text-slate-500 mt-1">{systemSettings.company.address || 'المملكة العربية السعودية'}</p>
                    <p className="text-xs font-mono text-slate-600 mt-0.5">الرقم الضريبي: {systemSettings.company.taxNumber || '310123456700003'}</p>
                  </div>
                  <div className="text-left">
                    <span className="inline-block px-3 py-1 bg-indigo-900 text-white rounded-md text-sm font-black mb-1">
                      كشف حركة الحسابات
                    </span>
                    <p className="text-xs font-bold text-slate-700">
                      {selectedEntity ? `${selectedEntity.name} (${selectedEntity.code})` : 'جميع الحسابات والجهات'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      الفترة: {startDate || 'البداية'} إلى {endDate || 'تاريخه'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">تاريخ الاستخراج: {new Date().toLocaleDateString('ar-SA')}</p>
                  </div>
                </div>

                {/* 3-Column Preview Table */}
                <table className="w-full text-right border-collapse border border-slate-200 text-xs">
                  <thead>
                    <tr className="bg-slate-800 text-white font-bold">
                      <th className="py-2 px-3 border border-slate-300 w-[60%]">بيان الحركة</th>
                      <th className="py-2 px-3 border border-slate-300 text-center w-[20%]">مدين ({currencySymbol})</th>
                      <th className="py-2 px-3 border border-slate-300 text-center w-[20%]">دائن ({currencySymbol})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.slice(0, 100).map((m, idx) => (
                      <tr key={m.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="py-2 px-3 border border-slate-200">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>{m.date}</span>
                            {m.formattedTime && (
                              <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded font-normal">
                                🕒 {m.formattedTime}
                              </span>
                            )}
                            <span>• {m.documentTypeBadge} #{m.documentNumber}</span>
                            {m.runningBalance !== undefined && (
                              <span className="text-[10px] font-mono text-slate-600 mr-auto">
                                (الرصيد: {fmt(m.runningBalance)} {m.balanceType === 'DEBIT' ? 'مدين' : m.balanceType === 'CREDIT' ? 'دائن' : 'متزن'})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-indigo-900 font-semibold">{m.entityName}</div>
                          <div className="text-slate-600 text-[11px]">{m.description}</div>
                        </td>
                        <td className="py-2 px-3 border border-slate-200 text-center font-mono font-bold text-blue-700">
                          {m.debit > 0 ? fmt(m.debit) : '-'}
                        </td>
                        <td className="py-2 px-3 border border-slate-200 text-center font-mono font-bold text-emerald-700">
                          {m.credit > 0 ? fmt(m.credit) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black border-t-2 border-slate-800">
                      <td className="py-2.5 px-3 border border-slate-300 text-right">
                        الإجماليات (عدد العمليات: {summary.count})
                      </td>
                      <td className="py-2.5 px-3 border border-slate-300 text-center font-mono text-blue-800">
                        {fmt(summary.totalDebit)}
                      </td>
                      <td className="py-2.5 px-3 border border-slate-300 text-center font-mono text-emerald-800">
                        {fmt(summary.totalCredit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Preview Totals Difference Card */}
                <div className="mt-4 p-4 rounded-xl border border-slate-300 bg-slate-50 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold block text-sm">
                      رصيد الحساب الصافي (مدين - دائن): {fmt(Math.abs(summary.difference))} {currencySymbol}
                    </span>
                    <span className="text-slate-600 text-xs">
                      {summary.balanceType === 'DEBIT' ? 'رصيد الحساب مدين' : summary.balanceType === 'CREDIT' ? 'رصيد الحساب دائن' : 'رصيد الحساب مصفّر'}
                      {' '}- {tafqeet(Math.abs(summary.difference))}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-1">
                      * كشف حركة الحساب يبيّن حركات الحساب ورصيده الختامي وليس ميزان مراجعة يشترط فيه التساوي.
                    </p>
                  </div>
                  <div className="font-mono font-bold text-slate-500 text-left">
                    <div>إجمالي المدين: {fmt(summary.totalDebit)}</div>
                    <div>إجمالي الدائن: {fmt(summary.totalCredit)}</div>
                  </div>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-3 gap-4 pt-10 mt-6 text-center text-xs font-bold text-slate-700 border-t border-slate-300">
                  <div>
                    <p>المحاسب المسؤول</p>
                    <p className="mt-6 text-slate-400">........................</p>
                  </div>
                  <div>
                    <p>المراجعة المالية</p>
                    <p className="mt-6 text-slate-400">........................</p>
                  </div>
                  <div>
                    <p>المدير المالي</p>
                    <p className="mt-6 text-slate-400">........................</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-100 rounded-b-2xl border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowPrintPreviewModal(false)}
                className="px-4 py-2 bg-gradient-to-b from-white to-slate-200 hover:from-slate-100 hover:to-slate-300 text-slate-800 rounded-xl text-xs font-black border border-slate-300 shadow-[0_3px_0_0_#cbd5e1] active:shadow-[0_1px_0_0_#cbd5e1] active:translate-y-[2px] transition-all cursor-pointer"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white rounded-xl text-xs font-black shadow-[0_3px_0_0_#1e3a8a,0_4px_6px_rgba(0,0,0,0.2)] active:shadow-[0_1px_0_0_#1e3a8a] active:translate-y-[2px] transition-all cursor-pointer border-t border-blue-400/50"
              >
                <Printer size={15} />
                <span>طباعة</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
