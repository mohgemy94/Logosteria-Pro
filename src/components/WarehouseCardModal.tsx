import { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Search, 
  Filter, 
  Printer, 
  ArrowUpDown, 
  Sliders, 
  ArrowRightLeft, 
  BarChart3, 
  Building2, 
  AlertTriangle, 
  CheckCircle2, 
  Package, 
  Tag,
  LayoutGrid,
  Table as TableIcon
} from 'lucide-react';
import { type Item } from '../utils/itemsStore';
import { useSystemCurrency } from '../utils/currency';
import ExportButtonGroup from './ExportButtonGroup';

export interface WarehouseCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string;
  cardTitle: string;
  cardSubtitle?: string | undefined;
  cardDescription?: string | undefined;
  cardBadge?: string | undefined;
  cardBadgeColor?: string | undefined;
  cardHeaderBg?: string | undefined;
  icon?: React.ElementType | undefined;
  items: Item[];
  allItems: Item[];
  systemSettings?: any;
  onOpenAnalytics?: ((item: Item) => void) | undefined;
  onOpenTransfer?: ((item: Item) => void) | undefined;
  onOpenAdjust?: ((item: Item) => void) | undefined;
  onQuickAdjustStock?: ((itemId: string, newStock: number) => void) | undefined;
}

export const WarehouseCardModal: React.FC<WarehouseCardModalProps> = ({
  isOpen,
  onClose,
  cardId,
  cardTitle,
  cardSubtitle,
  cardDescription,
  cardBadge,
  cardBadgeColor = 'bg-blue-100 text-blue-800 border-blue-200',
  cardHeaderBg = 'from-blue-600 to-indigo-700',
  icon: IconComponent = Package,
  items,
  allItems,
  systemSettings: _systemSettings,
  onOpenAnalytics,
  onOpenTransfer,
  onOpenAdjust,
  onQuickAdjustStock: _onQuickAdjustStock
}) => {
  const { symbol: currencySymbol } = useSystemCurrency();

  // Internal search and filters
  const [modalSearch, setModalSearch] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStockStatus, setSelectedStockStatus] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [sortBy, setSortBy] = useState<'stock' | 'valuation' | 'cost' | 'name' | 'velocity'>('valuation');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'AUTO' | 'CARDS' | 'TABLE'>('AUTO');

  // Lock background scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = 'unset';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
    document.body.style.overflow = 'unset';
    return undefined;
  }, [isOpen, onClose]);

  // Reset filters when opened with a new card
  useEffect(() => {
    if (isOpen) {
      setModalSearch('');
      setSelectedWarehouse('ALL');
      setSelectedCategory('ALL');
      setSelectedStockStatus('ALL');
    }
  }, [isOpen, cardId]);

  // Unique list of warehouses and categories
  const warehousesList = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach(i => {
      if (i.warehouseName) set.add(i.warehouseName);
    });
    return Array.from(set);
  }, [allItems]);

  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach(i => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [allItems]);

  // Filter and sort items inside the modal
  const filteredModalItems = useMemo(() => {
    return items.filter(item => {
      // Search
      if (modalSearch.trim()) {
        const q = modalSearch.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCode = item.code.toLowerCase().includes(q);
        const matchBar = item.barcode && item.barcode.includes(q);
        const matchLoc = item.shelfLocation && item.shelfLocation.toLowerCase().includes(q);
        const matchSupp = item.supplierName && item.supplierName.toLowerCase().includes(q);
        const matchCat = item.category && item.category.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchBar && !matchLoc && !matchSupp && !matchCat) return false;
      }

      // Warehouse
      if (selectedWarehouse !== 'ALL' && item.warehouseName !== selectedWarehouse) {
        return false;
      }

      // Category
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }

      // Stock status
      if (selectedStockStatus === 'OUT_OF_STOCK' && item.stock !== 0) return false;
      if (selectedStockStatus === 'LOW_STOCK') {
        const minLvl = item.minReorderLevel || 15;
        if (item.stock <= 0 || item.stock > minLvl) return false;
      }
      if (selectedStockStatus === 'IN_STOCK') {
        const minLvl = item.minReorderLevel || 15;
        if (item.stock <= minLvl) return false;
      }

      return true;
    }).sort((a, b) => {
      let valA = 0;
      let valB = 0;
      if (sortBy === 'stock') {
        valA = a.stock;
        valB = b.stock;
      } else if (sortBy === 'valuation') {
        valA = a.stock * a.costPrice;
        valB = b.stock * b.costPrice;
      } else if (sortBy === 'cost') {
        valA = a.costPrice;
        valB = b.costPrice;
      } else if (sortBy === 'velocity') {
        valA = a.monthlyVelocity || 0;
        valB = b.monthlyVelocity || 0;
      } else if (sortBy === 'name') {
        return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [items, modalSearch, selectedWarehouse, selectedCategory, selectedStockStatus, sortBy, sortOrder]);

  // Aggregated KPIs for filtered items
  const stats = useMemo(() => {
    let totalUnits = 0;
    let totalCostVal = 0;
    let totalRetailVal = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;

    filteredModalItems.forEach(i => {
      const q = i.stock;
      totalUnits += q;
      totalCostVal += q * i.costPrice;
      const saleP = i.salePrice || i.consumerPrice || i.costPrice;
      totalRetailVal += q * saleP;
      if (q === 0) outOfStockCount++;
      else if (q <= (i.minReorderLevel || 15)) lowStockCount++;
    });

    const potentialProfit = totalRetailVal - totalCostVal;
    const profitMargin = totalRetailVal > 0 ? (potentialProfit / totalRetailVal) * 100 : 0;

    return {
      count: filteredModalItems.length,
      totalUnits,
      totalCostVal,
      totalRetailVal,
      potentialProfit,
      profitMargin,
      outOfStockCount,
      lowStockCount
    };
  }, [filteredModalItems]);

  const modalHeaders = [
    'كود الصنف',
    'اسم الصنف',
    'الباركود',
    'التصنيف',
    'الوحدة',
    'المستودع',
    'موقع الرف',
    'الرصيد الفعلي',
    'حد الطلب',
    'الحد الأقصى',
    'سعر التكلفة',
    'سعر البيع',
    'تقييم التكلفة',
    'القيمة البيعية',
    'المورد الرئيسي',
    'حالة الرصيد'
  ];

  const modalRows = useMemo(() => {
    return filteredModalItems.map(i => [
      i.code,
      i.name,
      i.barcode || '',
      i.category || '',
      i.unit || 'قطعة',
      i.warehouseName || 'المستودع الرئيسي',
      i.shelfLocation || '',
      i.stock,
      i.minReorderLevel || 15,
      i.maxStockLevel || 100,
      i.costPrice,
      i.salePrice || i.consumerPrice || i.costPrice,
      Number((i.stock * i.costPrice).toFixed(2)),
      Number((i.stock * (i.salePrice || i.consumerPrice || i.costPrice)).toFixed(2)),
      i.supplierName || '',
      i.stock === 0 ? 'نافذ تماماً' : i.stock <= (i.minReorderLevel || 15) ? 'تحت حد الطلب' : 'متوفر'
    ]);
  }, [filteredModalItems]);

  // Trigger Print for this modal
  const handlePrintModal = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 overflow-hidden animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Background Overlay */}
      <div 
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs" 
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div 
        className="relative bg-white rounded-t-3xl sm:rounded-3xl max-w-6xl w-full max-h-[92vh] sm:max-h-[88vh] md:max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 text-right animate-modalIn overflow-hidden z-10"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Mobile Handle */}
        <div className="w-12 h-1.5 bg-white/40 rounded-full mx-auto my-2 sm:hidden shrink-0 absolute top-0 left-1/2 -translate-x-1/2 z-20" />
        
        {/* 🌟 1. MODAL HEADER BANNER (Mobile-Friendly & High Contrast) 🌟 */}
        <div className={`p-3.5 sm:p-5 md:p-6 bg-gradient-to-r ${cardHeaderBg} text-white relative shrink-0 shadow-sm pt-4 sm:pt-5`}>
          <div className="flex items-start justify-between gap-2.5 sm:gap-4">
            
            {/* Left/Start: Title, Icon & Description */}
            <div className="flex items-start gap-2.5 sm:gap-4 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-13 sm:h-13 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-inner border border-white/20">
                <IconComponent className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-[10px] sm:text-xs bg-white/25 border border-white/30 px-2 sm:px-2.5 py-0.5 rounded-full font-bold">
                    نافذة تفاصيل البطاقة
                  </span>
                  {cardBadge && (
                    <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-semibold border ${cardBadgeColor}`}>
                      {cardBadge}
                    </span>
                  )}
                  <span className="text-[10px] sm:text-xs font-mono text-white/90">
                    ({stats.count} صنف معروض)
                  </span>
                </div>

                <h3 className="text-base sm:text-xl md:text-2xl font-black mt-1 tracking-tight text-white leading-tight truncate">
                  {cardTitle}
                </h3>
                
                {cardSubtitle && (
                  <p className="text-xs sm:text-sm text-white/90 font-medium mt-0.5 line-clamp-1 sm:line-clamp-none">
                    {cardSubtitle}
                  </p>
                )}

                {cardDescription && (
                  <p className="text-[11px] sm:text-xs text-white/80 mt-1 max-w-2xl hidden md:block leading-relaxed">
                    {cardDescription}
                  </p>
                )}
              </div>
            </div>

            {/* Right/End: Quick Action & Close Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className="hidden sm:block">
                <ExportButtonGroup
                  title={`تقرير بطاقة المستودع - ${cardTitle}`}
                  filename={`بطاقة_${cardTitle.replace(/\s+/g, '_')}`}
                  headers={modalHeaders}
                  rows={modalRows}
                  size="xs"
                />
              </div>

              <button
                type="button"
                onClick={handlePrintModal}
                className="btn-3d btn-3d-white hidden sm:flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black text-slate-800 shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
                title="طباعة محتويات البطاقة"
              >
                <Printer size={14} className="text-blue-600" />
                <span className="hidden md:inline">طباعة</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="btn-3d btn-3d-white w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-slate-800 shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
                title="إغلاق النافذة (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* 🌟 Top Metric Cards Strip Inside Header 🌟 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-3 mt-3 pt-2.5 sm:mt-4 sm:pt-3.5 border-t border-white/15 text-xs">
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-1.5 sm:p-2.5 border border-white/15">
              <span className="text-[10px] sm:text-[11px] text-white/80 block">إجمالي تقييم التكلفة</span>
              <div className="text-xs sm:text-base md:text-lg font-bold font-mono text-white mt-0.5">
                {stats.totalCostVal.toLocaleString()} <span className="text-[10px] text-white/75">{currencySymbol}</span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-1.5 sm:p-2.5 border border-white/15">
              <span className="text-[10px] sm:text-[11px] text-white/80 block">القيمة البيعية المتوقعة</span>
              <div className="text-xs sm:text-base md:text-lg font-bold font-mono text-emerald-200 mt-0.5">
                {stats.totalRetailVal.toLocaleString()} <span className="text-[10px] text-emerald-300">{currencySymbol}</span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-1.5 sm:p-2.5 border border-white/15">
              <span className="text-[10px] sm:text-[11px] text-white/80 block">إجمالي الوحدات بالمخزن</span>
              <div className="text-xs sm:text-base md:text-lg font-bold font-mono text-white mt-0.5">
                {stats.totalUnits.toLocaleString()} <span className="text-[10px] text-white/75">وحدة</span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-1.5 sm:p-2.5 border border-white/15">
              <span className="text-[10px] sm:text-[11px] text-white/80 block">متوسط الربح المتوقع</span>
              <div className="text-xs sm:text-base md:text-lg font-bold font-mono text-amber-200 mt-0.5">
                +{stats.potentialProfit.toLocaleString()} <span className="text-[10px] text-amber-300 font-sans">({stats.profitMargin.toFixed(1)}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* 🌟 2. SEARCH & FILTER TOOLBAR (Responsive) 🌟 */}
        <div className="p-2.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
            
            {/* Live Search Bar */}
            <div className="relative flex-1">
              <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={modalSearch}
                onChange={e => setModalSearch(e.target.value)}
                placeholder="ابحث بالاسم، الكود، الباركود، المستودع، الرف..."
                className="w-full pl-8 pr-10 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-xs"
              />
              {modalSearch && (
                <button
                  type="button"
                  onClick={() => setModalSearch('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* View Mode & Filter Dropdowns */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
              {/* View Switcher Toggle */}
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('AUTO')}
                  className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    viewMode === 'AUTO' 
                      ? 'bg-white text-blue-700 shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="عرض تلقائي يتكيف مع شاشتك"
                >
                  تلقائي
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('CARDS')}
                  className={`flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    viewMode === 'CARDS' 
                      ? 'bg-white text-blue-700 shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="عرض بطاقات"
                >
                  <LayoutGrid size={12} />
                  <span>بطاقات</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('TABLE')}
                  className={`flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    viewMode === 'TABLE' 
                      ? 'bg-white text-blue-700 shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="عرض جدول"
                >
                  <TableIcon size={12} />
                  <span>جدول</span>
                </button>
              </div>

              {/* Filter Selects Grid on Mobile, Flex on Desktop */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2">
                {/* Warehouse selector */}
                <select
                  value={selectedWarehouse}
                  onChange={e => setSelectedWarehouse(e.target.value)}
                  className="px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-xs"
                >
                  <option value="ALL">كافة المستودعات ({allItems.length})</option>
                  {warehousesList.map(wh => (
                    <option key={wh} value={wh}>{wh}</option>
                  ))}
                </select>

                {/* Category selector */}
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-xs"
                >
                  <option value="ALL">كافة التصنيفات ({categoriesList.length})</option>
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {/* Stock Status selector */}
                <select
                  value={selectedStockStatus}
                  onChange={e => setSelectedStockStatus(e.target.value as any)}
                  className="px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-xs"
                >
                  <option value="ALL">كافة الحالات</option>
                  <option value="IN_STOCK">متوفر بأمان</option>
                  <option value="LOW_STOCK">تحت حد الطلب</option>
                  <option value="OUT_OF_STOCK">نافذ تماماً (0)</option>
                </select>

                {/* Sorting selector */}
                <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    className="px-2 py-1.5 bg-transparent text-xs font-medium text-slate-700 focus:outline-none flex-1"
                  >
                    <option value="valuation">ترتيب: القيمة</option>
                    <option value="stock">ترتيب: الرصيد</option>
                    <option value="cost">ترتيب: التكلفة</option>
                    <option value="velocity">ترتيب: السحب</option>
                    <option value="name">ترتيب: أبجدي</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="px-2 py-1.5 text-slate-500 hover:text-blue-600 border-r border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                    title="عكس اتجاه الترتيب (تصاعدي / تنازلي)"
                  >
                    <ArrowUpDown size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Active Filters tags if any */}
          {(modalSearch || selectedWarehouse !== 'ALL' || selectedCategory !== 'ALL' || selectedStockStatus !== 'ALL') && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
              <span className="text-slate-500 font-bold flex items-center gap-1">
                <Filter size={12} /> عوامل التصفية:
              </span>
              {modalSearch && (
                <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  بحث: "{modalSearch}"
                  <button type="button" onClick={() => setModalSearch('')}><X size={10} /></button>
                </span>
              )}
              {selectedWarehouse !== 'ALL' && (
                <span className="bg-cyan-50 text-cyan-800 border border-cyan-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  المستودع: {selectedWarehouse}
                  <button type="button" onClick={() => setSelectedWarehouse('ALL')}><X size={10} /></button>
                </span>
              )}
              {selectedCategory !== 'ALL' && (
                <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  التصنيف: {selectedCategory}
                  <button type="button" onClick={() => setSelectedCategory('ALL')}><X size={10} /></button>
                </span>
              )}
              {selectedStockStatus !== 'ALL' && (
                <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  الحالة: {selectedStockStatus === 'OUT_OF_STOCK' ? 'نافذ' : selectedStockStatus === 'LOW_STOCK' ? 'منخفض' : 'متوفر'}
                  <button type="button" onClick={() => setSelectedStockStatus('ALL')}><X size={10} /></button>
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setModalSearch('');
                  setSelectedWarehouse('ALL');
                  setSelectedCategory('ALL');
                  setSelectedStockStatus('ALL');
                }}
                className="text-red-600 hover:text-red-700 font-semibold underline mr-1 cursor-pointer"
              >
                مسح التصفية
              </button>
            </div>
          )}
        </div>

        {/* 🌟 3. MAIN ITEMS CONTENT (Responsive: Table for Desktop, Sleek Cards for Mobile) 🌟 */}
        <div className="flex-1 sm:overflow-y-auto p-3 sm:p-5">
          {filteredModalItems.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 my-4">
              <Package size={44} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-600">لا توجد أصناف مطابقة للتصفية الحالية</p>
              <p className="text-xs text-slate-400 mt-1">جرب تغيير معايير البحث أو اختيار مستودع آخر</p>
            </div>
          ) : (
            <>
              {/* 📱 CARDS VIEW (Mobile by default on AUTO, or forced on CARDS mode) 📱 */}
              {(viewMode === 'CARDS' || viewMode === 'AUTO') && (
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${
                  viewMode === 'AUTO' ? 'md:hidden' : ''
                }`}>
                {filteredModalItems.map(item => {
                  const isOutOfStock = item.stock === 0;
                  const isLowStock = !isOutOfStock && item.stock <= (item.minReorderLevel || 15);
                  const valuation = item.stock * item.costPrice;
                  const retailPrice = item.salePrice || item.consumerPrice || item.costPrice;

                  return (
                    <div 
                      key={item.id}
                      className={`p-3.5 rounded-xl border bg-white shadow-2xs space-y-2.5 transition-all ${
                        isOutOfStock 
                          ? 'border-red-200 bg-red-50/20' 
                          : isLowStock 
                          ? 'border-amber-200 bg-amber-50/20' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Top row: Code, Category, Stock Status Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                              {item.code}
                            </span>
                            {item.category && (
                              <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                {item.category}
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-sm text-slate-900 mt-1 leading-snug">
                            {item.name}
                          </h4>
                        </div>

                        {/* Stock Quantity Badge */}
                        <div className="text-left shrink-0">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                            isOutOfStock 
                              ? 'bg-red-50 text-red-700 border-red-200' 
                              : isLowStock 
                              ? 'bg-amber-50 text-amber-800 border-amber-200' 
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}>
                            {isOutOfStock ? (
                              <>
                                <AlertTriangle size={11} className="text-red-600" />
                                <span>نافذ (0)</span>
                              </>
                            ) : isLowStock ? (
                              <>
                                <AlertTriangle size={11} className="text-amber-600" />
                                <span>{item.stock} {item.unit}</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={11} className="text-emerald-600" />
                                <span>{item.stock} {item.unit}</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Warehouse & Location info */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-1">
                          <Building2 size={12} className="text-slate-400" />
                          <span className="font-medium text-slate-700">{item.warehouseName || 'المستودع الرئيسي'}</span>
                        </div>
                        {item.shelfLocation && (
                          <div className="flex items-center gap-1">
                            <Tag size={12} className="text-slate-400" />
                            <span className="font-mono text-slate-700 font-semibold">{item.shelfLocation}</span>
                          </div>
                        )}
                      </div>

                      {/* Pricing & Valuation stats */}
                      <div className="grid grid-cols-3 gap-1 text-[10px] pt-1 border-t border-slate-100">
                        <div>
                          <span className="text-slate-400 block">التكلفة:</span>
                          <span className="font-mono font-bold text-slate-800">{item.costPrice} {currencySymbol}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">سعر البيع:</span>
                          <span className="font-mono font-bold text-emerald-700">{retailPrice} {currencySymbol}</span>
                        </div>
                        <div className="text-left">
                          <span className="text-slate-400 block">تقييم المخزون:</span>
                          <span className="font-mono font-bold text-blue-700">{valuation.toLocaleString()} {currencySymbol}</span>
                        </div>
                      </div>

                      {/* Action buttons on mobile */}
                      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                        {onOpenAnalytics && (
                          <button
                            type="button"
                            onClick={() => onOpenAnalytics(item)}
                            className="btn-3d btn-3d-primary-soft flex-1 py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                          >
                            <BarChart3 size={12} />
                            <span>تحليل</span>
                          </button>
                        )}
                        {onOpenTransfer && (
                          <button
                            type="button"
                            onClick={() => onOpenTransfer(item)}
                            className="btn-3d btn-3d-white text-indigo-700 border-indigo-200 flex-1 py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                          >
                            <ArrowRightLeft size={12} />
                            <span>تحويل</span>
                          </button>
                        )}
                        {onOpenAdjust && (
                          <button
                            type="button"
                            onClick={() => onOpenAdjust(item)}
                            className="btn-3d btn-3d-white text-slate-700 flex-1 py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                          >
                            <Sliders size={12} />
                            <span>تسوية</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
              )}

              {/* 🖥️ DESKTOP VIEW: High-Detail Sortable Table (Desktop by default on AUTO, or forced on TABLE mode) 🖥️ */}
              {(viewMode === 'TABLE' || viewMode === 'AUTO') && (
                <div className={`overflow-x-auto rounded-xl border border-slate-200 shadow-2xs ${
                  viewMode === 'AUTO' ? 'hidden md:block' : ''
                }`}>
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 text-[11px] font-bold">
                      <th className="py-3 px-3 text-center w-12">#</th>
                      <th className="py-3 px-3 text-right">كود الصنف والباركود</th>
                      <th className="py-3 px-3 text-right">اسم الصنف والتصنيف</th>
                      <th className="py-3 px-3 text-right">المستودع / الرف</th>
                      <th className="py-3 px-3 text-center">الرصيد الفعلي</th>
                      <th className="py-3 px-3 text-center">حد الطلب</th>
                      <th className="py-3 px-3 text-left font-mono">سعر التكلفة</th>
                      <th className="py-3 px-3 text-left font-mono">سعر البيع</th>
                      <th className="py-3 px-3 text-left font-mono">تقييم المخزون</th>
                      <th className="py-3 px-3 text-center">حالة الرصيد</th>
                      <th className="py-3 px-3 text-center w-36">إجراءات سريعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredModalItems.map((item, index) => {
                      const isOutOfStock = item.stock === 0;
                      const isLowStock = !isOutOfStock && item.stock <= (item.minReorderLevel || 15);
                      const valuation = item.stock * item.costPrice;
                      const retailPrice = item.salePrice || item.consumerPrice || item.costPrice;

                      return (
                        <tr 
                          key={item.id}
                          className={`hover:bg-blue-50/40 transition-colors ${
                            isOutOfStock 
                              ? 'bg-red-50/20' 
                              : isLowStock 
                              ? 'bg-amber-50/20' 
                              : index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {index + 1}
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="font-mono font-bold text-blue-800">{item.code}</div>
                            {item.barcode && (
                              <div className="text-[10px] font-mono text-slate-400">{item.barcode}</div>
                            )}
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{item.name}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              {item.category && (
                                <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                  {item.category}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400">({item.unit || 'قطعة'})</span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="text-slate-800 font-medium">{item.warehouseName || 'المستودع الرئيسي'}</div>
                            {item.shelfLocation && (
                              <div className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1 rounded inline-block">
                                رف: {item.shelfLocation}
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <span className="font-mono font-bold text-sm text-slate-900">
                              {item.stock}
                            </span>
                            <span className="text-[10px] text-slate-400 mr-1">{item.unit || 'وحدة'}</span>
                          </td>

                          <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                            {item.minReorderLevel || 15}
                          </td>

                          <td className="py-2.5 px-3 text-left font-mono text-slate-700">
                            {item.costPrice.toFixed(2)}
                          </td>

                          <td className="py-2.5 px-3 text-left font-mono font-bold text-emerald-700">
                            {retailPrice.toFixed(2)}
                          </td>

                          <td className="py-2.5 px-3 text-left font-mono font-bold text-blue-900 bg-blue-50/20">
                            {valuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-[10px] font-bold border border-red-200">
                                <AlertTriangle size={10} /> نافذ تماماً
                              </span>
                            ) : isLowStock ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold border border-amber-200">
                                <AlertTriangle size={10} /> تحت حد الطلب
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold border border-emerald-200">
                                <CheckCircle2 size={10} /> متوفر
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {onOpenAnalytics && (
                                <button
                                  type="button"
                                  onClick={() => onOpenAnalytics(item)}
                                  className="btn-3d btn-3d-primary-soft p-1.5 rounded-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                  title="كرت التحليل والتوقعات"
                                >
                                  <BarChart3 size={13} />
                                </button>
                              )}
                              {onOpenTransfer && (
                                <button
                                  type="button"
                                  onClick={() => onOpenTransfer(item)}
                                  className="btn-3d btn-3d-white text-indigo-700 border-indigo-200 p-1.5 rounded-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                  title="تحويل كمية لمستودع آخر"
                                >
                                  <ArrowRightLeft size={13} />
                                </button>
                              )}
                              {onOpenAdjust && (
                                <button
                                  type="button"
                                  onClick={() => onOpenAdjust(item)}
                                  className="btn-3d btn-3d-white text-slate-700 p-1.5 rounded-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                  title="تسوية رصيد الصنف"
                                >
                                  <Sliders size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-800 text-[11px]">
                    <tr>
                      <td colSpan={4} className="py-2.5 px-3 text-right">
                        الإجمالي ({filteredModalItems.length} صنف مطابق)
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-blue-900">
                        {stats.totalUnits.toLocaleString()}
                      </td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td className="py-2.5 px-3 text-left font-mono text-blue-900">
                        {stats.totalCostVal.toLocaleString()} {currencySymbol}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              )}
            </>
          )}
        </div>

        {/* 🌟 4. MODAL FOOTER BAR (Fixed) 🌟 */}
        <div className="p-3 sm:p-4 bg-slate-50/95 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0 text-xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-slate-600 font-medium text-[11px] sm:text-xs">
            <span>عدد الأصناف: <strong>{stats.count}</strong></span>
            <span className="hidden sm:inline">•</span>
            <span>إجمالي الكمية: <strong>{stats.totalUnits.toLocaleString()}</strong> وحدة</span>
            <span className="hidden sm:inline">•</span>
            <span>قيمة التكلفة: <strong className="font-mono text-blue-700 font-bold">{stats.totalCostVal.toLocaleString()} {currencySymbol}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 justify-end w-full sm:w-auto">
            <div className="hidden sm:block">
              <ExportButtonGroup
                title={`تقرير بطاقة المستودع - ${cardTitle}`}
                filename={`بطاقة_${cardTitle.replace(/\s+/g, '_')}`}
                headers={modalHeaders}
                rows={modalRows}
                filterSummary={`عدد الأصناف: ${stats.count} | إجمالي الكمية: ${stats.totalUnits.toLocaleString()} | القيمة: ${stats.totalCostVal.toLocaleString()} ريال`}
                size="sm"
              />
            </div>

            <button
              type="button"
              onClick={handlePrintModal}
              className="btn-3d btn-3d-white flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 text-slate-700 rounded-xl text-xs font-black shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Printer size={14} className="text-blue-600" />
              <span>طباعة</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="btn-3d btn-3d-slate flex-1 sm:flex-none px-5 py-2 text-white rounded-xl text-xs font-black shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer text-center"
            >
              إغلاق
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default WarehouseCardModal;
