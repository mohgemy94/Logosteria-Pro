import { useState, useMemo, useEffect } from 'react';
import { 
  Warehouse, 
  Package, 
  AlertTriangle, 
  XCircle, 
  Layers, 
  Boxes, 
  Clock, 
  Search, 
  RefreshCw, 
  BarChart3, 
  Building2, 
  CheckCircle2, 
  ArrowUpDown, 
  DollarSign, 
  TrendingUp,
  Sparkles,
  ChevronRight,
  Flame,
  ClipboardCheck,
  ArrowRightLeft,
  Sliders,
  X,
  Save,
  LayoutGrid,
  Table as TableIcon,
  PlusCircle,
  Copy,
  Check,
  Filter
} from 'lucide-react';
import PrintDropdown from './PrintDropdown';
import ItemAnalyticsModal, { type AnalyticItem } from './ItemAnalyticsModal';
import WarehouseCardModal from './WarehouseCardModal';
import ExportButtonGroup from './ExportButtonGroup';
import { getSystemSettings } from '../utils/settings';
import { useSystemCurrency } from '../utils/currency';
import { 
  loadStoredItems, 
  saveStoredItems, 
  updateSingleItemStock, 
  transferItemWarehouse, 
  DEFAULT_INITIAL_ITEMS,
  type Item 
} from '../utils/itemsStore';

export type WarehouseItem = Item;

export type StockStatusFilter = 'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'SLOW_MOVING' | 'SAFE_STOCK';

export type WarehouseCardType = 
  | 'ALL_ITEMS' 
  | 'LOW_STOCK' 
  | 'OUT_OF_STOCK' 
  | 'HIGH_VALUE' 
  | 'SLOW_MOVING' 
  | 'FAST_MOVING' 
  | 'BY_WAREHOUSE' 
  | 'BY_CATEGORY';

export default function WarehouseBalances({ onNavigate }: { onNavigate?: (view: string) => void } = {}) {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [systemSettings] = useState(() => getSystemSettings());

  // Load items from centralized store
  const [items, setItems] = useState<WarehouseItem[]>(() => loadStoredItems());

  // Inter-warehouse transfer modal state
  const [transferModalData, setTransferModalData] = useState<{
    isOpen: boolean;
    item: WarehouseItem | null;
    targetWarehouse: string;
    quantity: number;
    newShelfLocation: string;
    notes: string;
  }>({
    isOpen: false,
    item: null,
    targetWarehouse: 'مستودع فرع جدة',
    quantity: 1,
    newShelfLocation: '',
    notes: ''
  });

  // Quick stock adjustment modal state
  const [adjustModalData, setAdjustModalData] = useState<{
    isOpen: boolean;
    item: WarehouseItem | null;
    newStock: number;
    reason: string;
  }>({
    isOpen: false,
    item: null,
    newStock: 0,
    reason: 'تسوية جردية دورية للمخزون'
  });

  // Sync with external resets and storage updates
  useEffect(() => {
    const handleSync = () => {
      setSelectedAnalyticItem(null);
      setItems(loadStoredItems());
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('alpha-data-changed', handleSync);
    window.addEventListener('alpha-items-updated', handleSync);
    window.addEventListener('alpha-stock-updated', handleSync);
    window.addEventListener('alpha-system-reset-completed', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('alpha-data-changed', handleSync);
      window.removeEventListener('alpha-items-updated', handleSync);
      window.removeEventListener('alpha-stock-updated', handleSync);
      window.removeEventListener('alpha-system-reset-completed', handleSync);
    };
  }, []);

  // Selected Card for Drill-Down Data View
  const [selectedCard, setSelectedCard] = useState<WarehouseCardType>('ALL_ITEMS');
  
  // Popup Modal Config for Detailed Card View
  const [modalCardConfig, setModalCardConfig] = useState<{
    isOpen: boolean;
    cardId: string;
    title: string;
    subtitle?: string | undefined;
    description?: string | undefined;
    badge?: string | undefined;
    badgeColor?: string | undefined;
    headerBg?: string | undefined;
    icon?: any;
    items: WarehouseItem[];
  }>({
    isOpen: false,
    cardId: 'ALL_ITEMS',
    title: '',
    items: []
  });

  // View mode and interactive filters
  const [viewMode, setViewMode] = useState<'AUTO' | 'CARDS' | 'TABLE'>('AUTO');
  const [stockStatusFilter, setStockStatusFilter] = useState<StockStatusFilter>('ALL');
  const [copiedBarcodeId, setCopiedBarcodeId] = useState<string | null>(null);

  const handleCopyBarcode = (barcode: string, itemId: string) => {
    if (!barcode) return;
    navigator.clipboard.writeText(barcode);
    setCopiedBarcodeId(itemId);
    setTimeout(() => setCopiedBarcodeId(null), 1800);
  };

  // Search and Filters inside the detail view
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'stock' | 'cost' | 'valuation' | 'name'>('valuation');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal for Item Analytics
  const [selectedAnalyticItem, setSelectedAnalyticItem] = useState<AnalyticItem | null>(null);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set);
  }, [items]);

  // Warehouses list
  const warehouses = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => {
      if (item.warehouseName) set.add(item.warehouseName);
    });
    return Array.from(set);
  }, [items]);

  // Calculations for Cards
  const cardsData = useMemo(() => {
    // 1. ALL ITEMS
    let totalStockUnits = 0;
    let totalCostValuation = 0;
    let totalRetailValuation = 0;

    items.forEach(item => {
      const q = Math.max(0, item.stock);
      totalStockUnits += q;
      totalCostValuation += q * item.costPrice;
      totalRetailValuation += q * (item.salePrice || item.consumerPrice || item.costPrice);
    });

    const totalPotentialProfit = totalRetailValuation - totalCostValuation;
    const profitMarginPercent = totalRetailValuation > 0 ? (totalPotentialProfit / totalRetailValuation) * 100 : 0;

    // 2. LOW STOCK (stock > 0 and stock <= minReorderLevel)
    const lowStockItems = items.filter(i => i.stock > 0 && i.stock <= (i.minReorderLevel || 15));
    let lowStockDeficitCost = 0;
    lowStockItems.forEach(i => {
      const deficitUnits = Math.max(0, (i.maxStockLevel || 50) - i.stock);
      lowStockDeficitCost += deficitUnits * i.costPrice;
    });

    // 3. OUT OF STOCK (stock === 0)
    const outOfStockItems = items.filter(i => i.stock === 0);
    let outOfStockRestockCost = 0;
    outOfStockItems.forEach(i => {
      const restockUnits = i.maxStockLevel || 30;
      outOfStockRestockCost += restockUnits * i.costPrice;
    });

    // 4. HIGH VALUE (Sort by item stock * costPrice descending)
    const sortedByValuation = [...items].sort((a, b) => (b.stock * b.costPrice) - (a.stock * a.costPrice));
    // Top 30% or items with valuation > 10,000
    const highValueItems = sortedByValuation.slice(0, Math.max(3, Math.ceil(items.length * 0.35)));
    const highValueValuation = highValueItems.reduce((sum, i) => sum + (i.stock * i.costPrice), 0);
    const highValueCapitalPercent = totalCostValuation > 0 ? (highValueValuation / totalCostValuation) * 100 : 0;

    // 5. SLOW MOVING / DEAD STOCK (daysInStock > 60 or monthlyVelocity <= 5)
    const slowMovingItems = items.filter(i => (i.daysInStock || 0) >= 60 || (i.monthlyVelocity || 0) <= 5);
    const slowMovingValuation = slowMovingItems.reduce((sum, i) => sum + (i.stock * i.costPrice), 0);

    // 6. FAST MOVING (monthlyVelocity >= 25)
    const fastMovingItems = items.filter(i => (i.monthlyVelocity || 0) >= 25);
    const fastMovingValuation = fastMovingItems.reduce((sum, i) => sum + (i.stock * i.costPrice), 0);

    // 7. BY WAREHOUSE stats
    const warehouseGroups: { [key: string]: { count: number; units: number; valuation: number } } = {};
    items.forEach(i => {
      const wh = i.warehouseName || 'المستودع الرئيسي';
      if (!warehouseGroups[wh]) {
        warehouseGroups[wh] = { count: 0, units: 0, valuation: 0 };
      }
      warehouseGroups[wh].count += 1;
      warehouseGroups[wh].units += i.stock;
      warehouseGroups[wh].valuation += i.stock * i.costPrice;
    });

    // 8. BY CATEGORY stats
    const categoryGroups: { [key: string]: { count: number; units: number; valuation: number } } = {};
    items.forEach(i => {
      const cat = i.category || 'عام';
      if (!categoryGroups[cat]) {
        categoryGroups[cat] = { count: 0, units: 0, valuation: 0 };
      }
      categoryGroups[cat].count += 1;
      categoryGroups[cat].units += i.stock;
      categoryGroups[cat].valuation += i.stock * i.costPrice;
    });

    return {
      all: {
        totalItems: items.length,
        totalStockUnits,
        totalCostValuation,
        totalRetailValuation,
        totalPotentialProfit,
        profitMarginPercent
      },
      lowStock: {
        items: lowStockItems,
        count: lowStockItems.length,
        deficitCost: lowStockDeficitCost
      },
      outOfStock: {
        items: outOfStockItems,
        count: outOfStockItems.length,
        restockCost: outOfStockRestockCost
      },
      highValue: {
        items: highValueItems,
        count: highValueItems.length,
        valuation: highValueValuation,
        capitalPercent: highValueCapitalPercent
      },
      slowMoving: {
        items: slowMovingItems,
        count: slowMovingItems.length,
        valuation: slowMovingValuation
      },
      fastMoving: {
        items: fastMovingItems,
        count: fastMovingItems.length,
        valuation: fastMovingValuation
      },
      warehouseGroups,
      categoryGroups
    };
  }, [items]);

  // Current items filtered based on the active selected card
  const activeCardItems = useMemo(() => {
    switch (selectedCard) {
      case 'LOW_STOCK':
        return cardsData.lowStock.items;
      case 'OUT_OF_STOCK':
        return cardsData.outOfStock.items;
      case 'HIGH_VALUE':
        return cardsData.highValue.items;
      case 'SLOW_MOVING':
        return cardsData.slowMoving.items;
      case 'FAST_MOVING':
        return cardsData.fastMoving.items;
      case 'BY_WAREHOUSE':
        if (warehouseFilter !== 'ALL') {
          return items.filter(i => i.warehouseName === warehouseFilter);
        }
        return items;
      case 'BY_CATEGORY':
        if (categoryFilter !== 'ALL') {
          return items.filter(i => i.category === categoryFilter);
        }
        return items;
      case 'ALL_ITEMS':
      default:
        return items;
    }
  }, [selectedCard, cardsData, items, warehouseFilter, categoryFilter]);

  // Status counts for quick filters
  const stockCounts = useMemo(() => {
    let low = 0;
    let out = 0;
    let slow = 0;
    let safe = 0;
    items.forEach(i => {
      if (i.stock === 0) out++;
      else if (i.stock <= (i.minReorderLevel || 15)) low++;
      else safe++;

      if ((i.daysInStock || 0) >= 60 || (i.monthlyVelocity || 0) <= 5) slow++;
    });
    return { all: items.length, low, out, slow, safe };
  }, [items]);

  // Sub-filtering by search query and secondary filters
  const displayItems = useMemo(() => {
    return activeCardItems.filter(item => {
      // Stock status filter
      if (stockStatusFilter === 'LOW_STOCK') {
        const isLow = item.stock > 0 && item.stock <= (item.minReorderLevel || 15);
        if (!isLow) return false;
      } else if (stockStatusFilter === 'OUT_OF_STOCK') {
        if (item.stock !== 0) return false;
      } else if (stockStatusFilter === 'SLOW_MOVING') {
        const isSlow = (item.daysInStock || 0) >= 60 || (item.monthlyVelocity || 0) <= 5;
        if (!isSlow) return false;
      } else if (stockStatusFilter === 'SAFE_STOCK') {
        const isSafe = item.stock > (item.minReorderLevel || 15);
        if (!isSafe) return false;
      }

      // search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCode = item.code.toLowerCase().includes(q);
        const matchBar = item.barcode && item.barcode.includes(q);
        const matchLoc = item.shelfLocation && item.shelfLocation.toLowerCase().includes(q);
        const matchSupp = item.supplierName && item.supplierName.toLowerCase().includes(q);
        const matchWh = item.warehouseName && item.warehouseName.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchBar && !matchLoc && !matchSupp && !matchWh) return false;
      }

      // category filter (if not already filtered by card)
      if (selectedCard !== 'BY_CATEGORY' && categoryFilter !== 'ALL' && item.category !== categoryFilter) {
        return false;
      }

      // warehouse filter (if not already filtered by card)
      if (selectedCard !== 'BY_WAREHOUSE' && warehouseFilter !== 'ALL' && item.warehouseName !== warehouseFilter) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      let valA = 0;
      let valB = 0;
      if (sortBy === 'stock') {
        valA = a.stock;
        valB = b.stock;
      } else if (sortBy === 'cost') {
        valA = a.costPrice;
        valB = b.costPrice;
      } else if (sortBy === 'valuation') {
        valA = a.stock * a.costPrice;
        valB = b.stock * b.costPrice;
      } else if (sortBy === 'name') {
        return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [activeCardItems, searchQuery, categoryFilter, warehouseFilter, sortBy, sortOrder, selectedCard, stockStatusFilter]);

  // Quick stock adjuster function with store integration
  const handleQuickAdjustStock = (itemId: string, newQuantity: number) => {
    if (newQuantity < 0) return;
    const updated = updateSingleItemStock(itemId, newQuantity, 'تعديل يدوي سريع من شاشة أرصدة المخازن');
    setItems(updated);
  };

  // Execute full adjustment with reason
  const handleSaveDetailedAdjustment = () => {
    if (!adjustModalData.item) return;
    const updated = updateSingleItemStock(
      adjustModalData.item.id,
      Math.max(0, adjustModalData.newStock),
      adjustModalData.reason || 'تسوية جردية للمخزون'
    );
    setItems(updated);
    setAdjustModalData({ isOpen: false, item: null, newStock: 0, reason: '' });
  };

  // Execute inter-warehouse transfer
  const handleSaveTransfer = () => {
    if (!transferModalData.item || transferModalData.quantity <= 0) return;
    const res = transferItemWarehouse(
      transferModalData.item.id,
      transferModalData.targetWarehouse,
      transferModalData.quantity,
      transferModalData.newShelfLocation,
      transferModalData.notes
    );
    if (res.success) {
      setItems(loadStoredItems());
      setTransferModalData({
        isOpen: false,
        item: null,
        targetWarehouse: 'مستودع فرع جدة',
        quantity: 1,
        newShelfLocation: '',
        notes: ''
      });
    } else {
      alert(res.message);
    }
  };

  // Reset to sample initial items
  const handleResetData = () => {
    if (confirm('هل ترغب في إعادة ضبط بيانات المخازن والأرصدة إلى القيم النموذجية؟')) {
      saveStoredItems(DEFAULT_INITIAL_ITEMS, true);
      setItems(DEFAULT_INITIAL_ITEMS);
    }
  };

  // Helper to open the comprehensive modal popup for any card
  const openCardDetailModal = (
    cardId: WarehouseCardType | string,
    title: string,
    subtitle?: string,
    description?: string,
    badge?: string,
    badgeColor?: string,
    headerBg?: string,
    icon?: any,
    customItems?: WarehouseItem[]
  ) => {
    if (['ALL_ITEMS', 'LOW_STOCK', 'OUT_OF_STOCK', 'HIGH_VALUE', 'SLOW_MOVING', 'FAST_MOVING', 'BY_WAREHOUSE', 'BY_CATEGORY'].includes(cardId)) {
      setSelectedCard(cardId as WarehouseCardType);
    }

    let targetItems = customItems;
    if (!targetItems) {
      switch (cardId) {
        case 'LOW_STOCK':
          targetItems = cardsData.lowStock.items;
          break;
        case 'OUT_OF_STOCK':
          targetItems = cardsData.outOfStock.items;
          break;
        case 'HIGH_VALUE':
          targetItems = cardsData.highValue.items;
          break;
        case 'SLOW_MOVING':
          targetItems = cardsData.slowMoving.items;
          break;
        case 'FAST_MOVING':
          targetItems = cardsData.fastMoving.items;
          break;
        case 'BY_WAREHOUSE':
          targetItems = warehouseFilter !== 'ALL' ? items.filter(i => i.warehouseName === warehouseFilter) : items;
          break;
        case 'BY_CATEGORY':
          targetItems = categoryFilter !== 'ALL' ? items.filter(i => i.category === categoryFilter) : items;
          break;
        case 'ALL_ITEMS':
        default:
          targetItems = items;
          break;
      }
    }

    setModalCardConfig({
      isOpen: true,
      cardId,
      title,
      subtitle,
      description,
      badge,
      badgeColor,
      headerBg,
      icon,
      items: targetItems
    });
  };

  // Card Definition List with metadata
  const cardsList = [
    {
      id: 'ALL_ITEMS' as WarehouseCardType,
      title: 'إجمالي بضاعة المخزن',
      subtitle: 'كافة الأصناف والأرصدة التراكمية',
      icon: Boxes,
      badge: `${cardsData.all.totalItems} صنف`,
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      highlightBorder: 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20',
      headerBg: 'from-blue-600 to-indigo-600',
      metricPrimary: `${cardsData.all.totalCostValuation.toLocaleString()} ${currencySymbol}`,
      labelPrimary: 'إجمالي تقييم التكلفة',
      metricSecondary: `${cardsData.all.totalStockUnits.toLocaleString()} قطعة`,
      labelSecondary: 'إجمالي الوحدات الفعلية',
      description: 'نظرة شاملة لكافة الأرصدة وتقييم المخزون بسعر التكلفة والقيمة البيعية المتوقعة.'
    },
    {
      id: 'LOW_STOCK' as WarehouseCardType,
      title: 'أصناف قاربت على النفاد',
      subtitle: 'تحت حد الطلب / النواقص الحرجة',
      icon: AlertTriangle,
      badge: `${cardsData.lowStock.count} نواقص`,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      highlightBorder: 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20',
      headerBg: 'from-amber-600 to-orange-600',
      metricPrimary: `${cardsData.lowStock.deficitCost.toLocaleString()} ${currencySymbol}`,
      labelPrimary: 'تكلفة استكمال النواقص',
      metricSecondary: `${cardsData.lowStock.count} صنف`,
      labelSecondary: 'أصناف بحاجة لإعادة طلب',
      description: 'أصناف وصلت كمياتها لحد إعادة الطلب الأدنى وتستلزم إصدار أوامر شراء عاجلة.'
    },
    {
      id: 'OUT_OF_STOCK' as WarehouseCardType,
      title: 'أصناف نافذة تماماً',
      subtitle: 'رصيد صفري / فاقد مبيعات',
      icon: XCircle,
      badge: `${cardsData.outOfStock.count} نافذ`,
      badgeColor: 'bg-red-100 text-red-800 border-red-200',
      highlightBorder: 'border-red-500 ring-2 ring-red-500/20 bg-red-50/20',
      headerBg: 'from-red-600 to-rose-700',
      metricPrimary: `${cardsData.outOfStock.restockCost.toLocaleString()} ${currencySymbol}`,
      labelPrimary: 'تكلفة الشراء لإعادة الملء',
      metricSecondary: `${cardsData.outOfStock.count} صنف`,
      labelSecondary: 'مخزونها صفر حالياً',
      description: 'بضائع غير متوفرة في أي رف، تسبب خسارة فرص بيعية ويجب توريدها فوراً.'
    },
    {
      id: 'HIGH_VALUE' as WarehouseCardType,
      title: 'الأصناف الأعلى قيمة واستثماراً',
      subtitle: 'فئة A / رأس المال المركّز بالمخزن',
      icon: DollarSign,
      badge: `${cardsData.highValue.capitalPercent.toFixed(1)}% من المخزون`,
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      highlightBorder: 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/20',
      headerBg: 'from-purple-600 to-indigo-700',
      metricPrimary: `${cardsData.highValue.valuation.toLocaleString()} ${currencySymbol}`,
      labelPrimary: 'قيمة البضائع الثمينة',
      metricSecondary: `${cardsData.highValue.count} أصناف`,
      labelSecondary: 'تمثل معظم رأس المال',
      description: 'أهم الأصناف التي تحوز النسبة الكبرى من رأس المال وتتطلب رقابة مشددة وجرداً دورياً.'
    },
    {
      id: 'SLOW_MOVING' as WarehouseCardType,
      title: 'الأصناف الراكدة وبطيئة الحركة',
      subtitle: 'رأس مال مجمد / إشغال مساحات',
      icon: Clock,
      badge: `${cardsData.slowMoving.count} راكد`,
      badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
      highlightBorder: 'border-slate-500 ring-2 ring-slate-500/20 bg-slate-50/40',
      headerBg: 'from-slate-700 to-slate-800',
      metricPrimary: `${cardsData.slowMoving.valuation.toLocaleString()} ${currencySymbol}`,
      labelPrimary: 'رأس مال مجمد بالرفوف',
      metricSecondary: `${cardsData.slowMoving.count} أصناف`,
      labelSecondary: 'تجاوزت 60 يوماً ركود',
      description: 'بضائع تمكث طويلاً بالمستودع وتستدعي خطة ترويجية أو خصومات لتحرير السيولة.'
    },
    {
      id: 'FAST_MOVING' as WarehouseCardType,
      title: 'الأصناف سريعة الدوران والطلب',
      subtitle: 'أعلى سرعة مبيعات وتدفق نقدي',
      icon: Flame,
      badge: 'أعلى سحب',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      highlightBorder: 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20',
      headerBg: 'from-emerald-600 to-teal-700',
      metricPrimary: `${cardsData.fastMoving.valuation.toLocaleString()} ${currencySymbol}`,
      labelPrimary: 'قيمة المخزون النشط',
      metricSecondary: `${cardsData.fastMoving.count} صنف`,
      labelSecondary: 'مبيعات شهرية كثيفة',
      description: 'الأصناف البطلة سريعة التصريف التي تدر أعلى تدفقات نقدية للشركة.'
    },
    {
      id: 'BY_WAREHOUSE' as WarehouseCardType,
      title: 'أرصدة المستودعات والفروع',
      subtitle: 'توزيع البضائع جغرافياً ولوجستياً',
      icon: Building2,
      badge: `${Object.keys(cardsData.warehouseGroups).length} فروع/مخازن`,
      badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      highlightBorder: 'border-cyan-500 ring-2 ring-cyan-500/20 bg-cyan-50/20',
      headerBg: 'from-cyan-600 to-blue-700',
      metricPrimary: `${Object.keys(cardsData.warehouseGroups).length} مستودعات`,
      labelPrimary: 'مواقع تخزين معتمدة',
      metricSecondary: `${cardsData.all.totalStockUnits} وحدة`,
      labelSecondary: 'موزعة بالكامل',
      description: 'متابعة رصيد كل مستودع على حدة وتحديد الفائض والعجز بين المستودعات للتحويل.'
    },
    {
      id: 'BY_CATEGORY' as WarehouseCardType,
      title: 'المخزون حسب المجموعات والتصنيفات',
      subtitle: 'هيكلية الأصناف وتنوع التشكيلة',
      icon: Layers,
      badge: `${Object.keys(cardsData.categoryGroups).length} مجموعات`,
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      highlightBorder: 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20',
      headerBg: 'from-indigo-600 to-purple-800',
      metricPrimary: `${Object.keys(cardsData.categoryGroups).length} تصنيفات`,
      labelPrimary: 'قطاعات المنتجات',
      metricSecondary: `${cardsData.all.profitMarginPercent.toFixed(1)}%`,
      labelSecondary: 'متوسط هامش الربح',
      description: 'تحليل توزيع المخزون واستثمارات الشركة عبر مختلف فئات المنتجات الغذائية والإلكترونية.'
    }
  ];

  // Active card metadata
  const currentCardMeta = cardsList.find(c => c.id === selectedCard) ?? cardsList[0]!;

  return (
    <div className="flex flex-col flex-1 pb-12">
      
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1 text-slate-500">
            <span className="text-xs uppercase font-bold tracking-tight">المخزون والمستودعات</span>
            <span className="text-xs">/</span>
            <span className="text-xs uppercase font-bold tracking-tight text-blue-600">أرصدة المخزن</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Warehouse size={22} />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">أرصدة المخزن والمستودعات</h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                متابعة دقيقة لأرصدة البضائع، النواقص، البضاعة الراكدة، وتقييم رأس المال المخزني مع تفاصيل فورية عند النقر.
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <PrintDropdown />

          <button
            type="button"
            onClick={() => {
              if (onNavigate) {
                onNavigate('trialBalance');
              } else {
                window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'trialBalance' } }));
              }
            }}
            className="btn-3d btn-3d-slate flex items-center gap-1.5 px-3.5 py-2 text-white rounded-xl text-xs font-black shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="الانتقال إلى ميزان المراجعة لمطابقة حساب المخزون السلعي (1301)"
          >
            <BarChart3 size={15} className="text-amber-400" />
            <span>ميزان المراجعة (1301) ←</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onNavigate) {
                onNavigate('inventoryCount');
              } else {
                window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'inventoryCount' } }));
              }
            }}
            className="btn-3d btn-3d-blue flex items-center gap-1.5 px-3.5 py-2 text-white rounded-xl text-xs font-black shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="الانتقال إلى شاشة الجرد الدوري ومطابقة الأرصدة وإصدار قيود التسوية"
          >
            <ClipboardCheck size={15} />
            <span>الجرد الدوري والتسويات</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onNavigate) {
                onNavigate('items');
              } else {
                window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'items' } }));
              }
            }}
            className="btn-3d btn-3d-success flex items-center gap-1.5 px-3.5 py-2 text-white rounded-xl text-xs font-black shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="الانتقال إلى دليل الأصناف لتسجيل صنف جديد أو طباعة الباركود وتعديل الأسعار"
          >
            <PlusCircle size={15} />
            <span>دليل الأصناف والباركود</span>
          </button>

          <ExportButtonGroup
            title={`تقرير أرصدة المخزون والمستودعات - ${selectedCard}`}
            filename={`ارصدة_المخزن_${selectedCard}`}
            headers={[
              'كود الصنف',
              'اسم الصنف',
              'التصنيف',
              'المستودع',
              'الموقع / الرف',
              'الرصيد الفعلي',
              'الوحدة',
              'سعر التكلفة',
              'سعر البيع',
              'إجمالي تقييم الرصيد',
              'حد الطلب',
              'معدل الدوران الشهري',
              'حالة المخزون'
            ]}
            rows={displayItems.map(i => {
              let statusStr = 'متوفر';
              if (i.stock === 0) statusStr = 'نافذ تماماً';
              else if (i.stock <= (i.minReorderLevel || 15)) statusStr = 'تحت حد الطلب';
              else if ((i.daysInStock || 0) > 60) statusStr = 'راكد';

              return [
                i.code,
                i.name,
                i.category || '-',
                i.warehouseName || '-',
                i.shelfLocation || '-',
                i.stock,
                i.unit || '-',
                i.costPrice,
                i.salePrice || i.consumerPrice || 0,
                Number((i.stock * i.costPrice).toFixed(2)),
                i.minReorderLevel || 15,
                i.monthlyVelocity || 0,
                statusStr
              ];
            })}
            size="sm"
          />

          <button
            type="button"
            onClick={handleResetData}
            className="btn-3d btn-3d-white flex items-center gap-1.5 px-3.5 py-2 text-slate-700 rounded-xl text-xs font-black shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="استعادة البيانات النموذجية الأولية"
          >
            <RefreshCw size={14} className="text-blue-600" />
            <span>إعادة ضبط</span>
          </button>
        </div>
      </div>

      {/* 🌟 GRAND SUMMARY BANNER 🌟 */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-xl mb-7 relative overflow-hidden border border-blue-800/40">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
              <h3 className="font-bold text-sm sm:text-base text-slate-100">
                الموقف الشامل لأرصدة وتقييم المخازن ({systemSettings.company.branchName || 'الفرع الرئيسي'})
              </h3>
            </div>
            <div className="text-xs text-slate-300 flex items-center gap-2 font-mono">
              <span>تاريخ الجرد اللحظي: <strong>{new Date().toISOString().split('T')[0]}</strong></span>
              <span className="hidden md:inline">•</span>
              <span className="hidden md:inline">العملة: <strong>{currencySymbol}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div 
              onClick={() => openCardDetailModal(
                'HIGH_VALUE',
                'إجمالي تقييم تكلفة المخزون',
                'رأس المال المستثمر في البضائع بالمخازن',
                'استعراض تفصيلي لكافة الأصناف بالمخازن مرتبة حسب أعلى رأس مال مستثمر وقيمة التكلفة الإجمالية.',
                `${cardsData.all.totalCostValuation.toLocaleString()} ${currencySymbol}`,
                'bg-blue-100 text-blue-800 border-blue-200',
                'from-blue-700 to-indigo-800',
                DollarSign,
                items
              )}
              className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl p-3.5 backdrop-blur-xs transition-all cursor-pointer group shadow-xs"
              title="انقر لفتح نافذة تفصيلية لتقييم التكلفة ورأس المال"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-blue-200 font-medium">إجمالي تقييم التكلفة</span>
                <ChevronRight size={14} className="text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-white">
                {cardsData.all.totalCostValuation.toLocaleString()} <span className="text-xs text-slate-300">{currencySymbol}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">رأس المال المستثمر (انقر لعرض النافذة)</span>
            </div>

            <div 
              onClick={() => openCardDetailModal(
                'ALL_ITEMS',
                'القيمة البيعية المتوقعة وهوامش الأرباح',
                'العوائد النقدية عند بيع كامل البضائع بالأسعار المعتمدة',
                'تحليل مقارن بين تكلفة الشراء وسعر البيع لحساب الأرباح المحتملة لكل صنف بالمستودع.',
                `ربح متوقع +${cardsData.all.totalPotentialProfit.toLocaleString()} ${currencySymbol}`,
                'bg-emerald-100 text-emerald-800 border-emerald-200',
                'from-emerald-600 to-teal-700',
                TrendingUp,
                items
              )}
              className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl p-3.5 backdrop-blur-xs transition-all cursor-pointer group shadow-xs"
              title="انقر لفتح نافذة القيمة البيعية وهوامش الربح"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-emerald-200 font-medium">القيمة البيعية المتوقعة</span>
                <ChevronRight size={14} className="text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
                {cardsData.all.totalRetailValuation.toLocaleString()} <span className="text-xs text-emerald-300">{currencySymbol}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                ربح متوقع: +{cardsData.all.totalPotentialProfit.toLocaleString()} {currencySymbol} ({cardsData.all.profitMarginPercent.toFixed(1)}%)
              </span>
            </div>

            <div 
              onClick={() => openCardDetailModal(
                'ALL_ITEMS',
                'إجمالي الوحدات والأصناف المخزنة',
                'الكميات الفعلية المعتمدة بكافة الفروع والمستودعات',
                'بيان شامل بجميع البضائع والكميات المتوفرة وأماكن توزيعها على الأرفف والمستودعات.',
                `${cardsData.all.totalStockUnits.toLocaleString()} وحدة`,
                'bg-amber-100 text-amber-800 border-amber-200',
                'from-amber-600 to-orange-700',
                Boxes,
                items
              )}
              className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl p-3.5 backdrop-blur-xs transition-all cursor-pointer group shadow-xs"
              title="انقر لفتح نافذة إجمالي بضاعة المخزن"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-amber-200 font-medium">إجمالي الوحدات بالمخازن</span>
                <ChevronRight size={14} className="text-amber-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-white">
                {cardsData.all.totalStockUnits.toLocaleString()} <span className="text-xs text-slate-300">وحدة</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                موزعة على {cardsData.all.totalItems} صنف معتمد (انقر للتفاصيل)
              </span>
            </div>

            <div 
              onClick={() => openCardDetailModal(
                'LOW_STOCK',
                'الأصناف الحرجة (النواقص والنفاد التام)',
                'تنبيهات عاجلة لإعادة الشراء والطلب',
                'قائمة المنتجات التي بلغت مستوى الصفر أو انخفض رصيدها عن حد إعادة الطلب الأدنى وتتطلب أوامر شراء فورية.',
                `${cardsData.lowStock.count + cardsData.outOfStock.count} صنف بحاجة لطلب`,
                'bg-red-100 text-red-800 border-red-200',
                'from-red-600 to-rose-700',
                AlertTriangle,
                [...cardsData.outOfStock.items, ...cardsData.lowStock.items]
              )}
              className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl p-3.5 backdrop-blur-xs transition-all cursor-pointer group shadow-xs"
              title="انقر لفتح نافذة النواقص والأصناف النافذة"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-red-200 font-medium">الأصناف الحرجة (نواقص + نفاد)</span>
                <ChevronRight size={14} className="text-red-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-amber-400">
                {cardsData.lowStock.count + cardsData.outOfStock.count} <span className="text-xs text-slate-300">صنف بحاجة لطلب</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {cardsData.outOfStock.count} نافذ تماماً و {cardsData.lowStock.count} تحت حد الطلب
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 8 INTERACTIVE WAREHOUSE CARDS 🌟 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-blue-600" />
            <h3 className="text-base font-bold text-slate-800">
              بطاقات محاور المخزون الذكية (انقر على أي بطاقة لفتح نافذة البيانات المنبثقة فوراً)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            البطاقة المعروضة حالياً: <strong className="text-blue-700 font-bold">{currentCardMeta.title}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cardsList.map(card => {
            const isSelected = selectedCard === card.id;
            const IconComponent = card.icon;

            return (
              <div
                key={card.id}
                onClick={() => {
                  openCardDetailModal(
                    card.id,
                    card.title,
                    card.subtitle,
                    card.description,
                    card.badge,
                    card.badgeColor,
                    card.headerBg,
                    card.icon
                  );
                }}
                className={`relative rounded-xl p-4 transition-all duration-200 cursor-pointer border flex flex-col justify-between select-none group ${
                  isSelected 
                    ? `${card.highlightBorder} shadow-md scale-[1.015]` 
                    : 'bg-white hover:bg-slate-50/90 border-slate-200 hover:border-blue-300 hover:shadow-sm'
                }`}
                title={`انقر لفتح نافذة تفاصيل ${card.title}`}
              >
                {/* Top section: Icon, Active Status & Badge */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white bg-gradient-to-tr ${card.headerBg} shadow-xs group-hover:scale-105 transition-transform shrink-0`}>
                        <IconComponent size={18} />
                      </div>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs border border-blue-500 animate-in fade-in shrink-0">
                          <CheckCircle2 size={11} className="text-white" />
                          <span>نشطة</span>
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${card.badgeColor} shrink-0`}>
                      {card.badge}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-slate-800 leading-snug group-hover:text-blue-700 transition-colors">
                    {card.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                    {card.subtitle}
                  </p>
                </div>

                {/* Metrics */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-end justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium block">
                      {card.labelPrimary}
                    </span>
                    <span className="text-base font-bold font-mono text-slate-900 tracking-tight">
                      {card.metricPrimary}
                    </span>
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] text-slate-400 font-medium block">
                      {card.labelSecondary}
                    </span>
                    <span className="text-xs font-bold font-mono text-slate-700">
                      {card.metricSecondary}
                    </span>
                  </div>
                </div>

                {/* Bottom Click Hint */}
                <div className="mt-3 pt-2 flex items-center justify-between text-[11px] font-semibold border-t border-slate-100/70">
                  {isSelected ? (
                    <div className="flex items-center justify-between w-full text-blue-700 bg-blue-50/70 px-2 py-1 rounded-lg border border-blue-200/80">
                      <span className="flex items-center gap-1 font-bold text-xs">
                        <CheckCircle2 size={12} className="text-blue-600" />
                        <span>البطاقة الحالية المختارة</span>
                      </span>
                      <span className="text-[10px] font-medium text-blue-600 underline">فتح النافذة ←</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full text-blue-600">
                      <span className="group-hover:underline">
                        انقر لفتح النافذة التفصيلية
                      </span>
                      <ChevronRight size={14} className="transform group-hover:translate-x-[-2px] transition-transform text-blue-600" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🌟 DETAIL DATA CONTAINER FOR THE SELECTED CARD 🌟 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mt-4 overflow-hidden">
        
        {/* Detail Header Banner */}
        <div className={`p-5 sm:p-6 bg-gradient-to-r ${currentCardMeta.headerBg} text-white flex flex-col md:flex-row md:items-center justify-between gap-4`}>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-inner">
              {(() => {
                const Icon = currentCardMeta.icon;
                return <Icon size={24} />;
              })()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-bold">
                  بيانات البطاقة المختارة
                </span>
                <span className="text-xs font-mono text-white/80">
                  ({displayItems.length} سجل مطابق)
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mt-1">
                {currentCardMeta.title}
              </h3>
              <p className="text-xs text-white/90 mt-0.5 max-w-2xl">
                {currentCardMeta.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/15">
            <div className="text-right">
              <span className="text-[10px] text-white/80 font-medium block">إجمالي تقييم تكلفة هذه البطاقة</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-white">
                {displayItems.reduce((acc, i) => acc + (i.stock * i.costPrice), 0).toLocaleString()} {currencySymbol}
              </span>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="text-right">
              <span className="text-[10px] text-white/80 font-medium block">إجمالي الوحدات الفعلية</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-white">
                {displayItems.reduce((acc, i) => acc + i.stock, 0).toLocaleString()} وحدة
              </span>
            </div>
          </div>
        </div>

        {/* Special widgets depending on selected card */}
        {selectedCard === 'BY_WAREHOUSE' && (
          <div className="p-4 bg-cyan-50/50 border-b border-cyan-100 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-cyan-700" />
              <span className="text-xs font-bold text-cyan-900">توزيع المستودعات:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setWarehouseFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  warehouseFilter === 'ALL' ? 'bg-cyan-700 text-white' : 'bg-white border border-cyan-200 text-cyan-800 hover:bg-cyan-100'
                }`}
              >
                كافة المستودعات ({items.length})
              </button>
              {warehouses.map(wh => (
                <button
                  key={wh}
                  type="button"
                  onClick={() => setWarehouseFilter(wh)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    warehouseFilter === wh ? 'bg-cyan-700 text-white' : 'bg-white border border-cyan-200 text-cyan-800 hover:bg-cyan-100'
                  }`}
                >
                  {wh} ({items.filter(i => i.warehouseName === wh).length})
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedCard === 'BY_CATEGORY' && (
          <div className="p-4 bg-indigo-50/50 border-b border-indigo-100 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-indigo-700" />
              <span className="text-xs font-bold text-indigo-900">تصفية حسب التصنيف السلعي:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategoryFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  categoryFilter === 'ALL' ? 'bg-indigo-700 text-white' : 'bg-white border border-indigo-200 text-indigo-800 hover:bg-indigo-100'
                }`}
              >
                كافة التصنيفات ({items.length})
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    categoryFilter === cat ? 'bg-indigo-700 text-white' : 'bg-white border border-indigo-200 text-indigo-800 hover:bg-indigo-100'
                  }`}
                >
                  {cat} ({items.filter(i => i.category === cat).length})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
          
          {/* Live Search & View Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px] max-w-xl">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="البحث بالاسم، الكود، الباركود، الرف، المستودع، أو المورد..."
                className="w-full pl-8 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder-slate-400 shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="btn-3d btn-3d-white p-1 rounded-lg absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                  title="مسح البحث"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* View Mode Switcher: Auto / Cards / Table */}
            <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl text-xs font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('AUTO')}
                className={`px-2.5 py-1 rounded-lg transition-all text-xs font-bold cursor-pointer ${
                  viewMode === 'AUTO' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="تكيّف تلقائي (بطاقات على الجوال، جدول على الشاشات الكبيرة)"
              >
                تلقائي
              </button>
              <button
                type="button"
                onClick={() => setViewMode('CARDS')}
                className={`p-1.5 rounded-lg transition-all text-xs font-bold cursor-pointer flex items-center gap-1 ${
                  viewMode === 'CARDS' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="عرض البطاقات"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('TABLE')}
                className={`p-1.5 rounded-lg transition-all text-xs font-bold cursor-pointer flex items-center gap-1 ${
                  viewMode === 'TABLE' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="عرض الجدول المفصل"
              >
                <TableIcon size={14} />
              </button>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Category selector if not in BY_CATEGORY */}
            {selectedCard !== 'BY_CATEGORY' && (
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-blue-500 shadow-xs cursor-pointer font-medium"
              >
                <option value="ALL">كافة التصنيفات ({categories.length})</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}

            {/* Warehouse selector if not in BY_WAREHOUSE */}
            {selectedCard !== 'BY_WAREHOUSE' && (
              <select
                value={warehouseFilter}
                onChange={e => setWarehouseFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-blue-500 shadow-xs cursor-pointer font-medium"
              >
                <option value="ALL">كافة المستودعات ({warehouses.length})</option>
                {warehouses.map(wh => (
                  <option key={wh} value={wh}>{wh}</option>
                ))}
              </select>
            )}

            {/* Sort by */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs shadow-xs">
              <ArrowUpDown size={13} className="text-slate-400" />
              <span className="text-slate-400 text-[11px]">ترتيب:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer"
              >
                <option value="valuation">إجمالي القيمة</option>
                <option value="stock">الكمية المتوفرة</option>
                <option value="cost">سعر التكلفة</option>
                <option value="name">الاسم أبجدياً</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="text-slate-500 hover:text-slate-800 px-1 font-bold cursor-pointer"
                title="عكس اتجاه الترتيب"
              >
                {sortOrder === 'desc' ? 'تنازلي ↓' : 'تصاعدي ↑'}
              </button>
            </div>
          </div>
        </div>

        {/* 🌟 Smart Stock Status Quick Filter Pills 🌟 */}
        <div className="px-4 py-2.5 bg-slate-50/90 border-b border-slate-200/80 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <Filter size={13} className="text-slate-400" />
            حالة المخزون:
          </span>

          <button
            type="button"
            onClick={() => setStockStatusFilter('ALL')}
            className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              stockStatusFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span>كافة الأصناف</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              stockStatusFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {stockCounts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStockStatusFilter('LOW_STOCK')}
            className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              stockStatusFilter === 'LOW_STOCK'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white border border-amber-200 text-amber-800 hover:bg-amber-50'
            }`}
          >
            <AlertTriangle size={12} className={stockStatusFilter === 'LOW_STOCK' ? 'text-white' : 'text-amber-600'} />
            <span>تحت حد الطلب</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              stockStatusFilter === 'LOW_STOCK' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
            }`}>
              {stockCounts.low}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStockStatusFilter('OUT_OF_STOCK')}
            className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              stockStatusFilter === 'OUT_OF_STOCK'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white border border-red-200 text-red-700 hover:bg-red-50'
            }`}
          >
            <XCircle size={12} className={stockStatusFilter === 'OUT_OF_STOCK' ? 'text-white' : 'text-red-600'} />
            <span>نافذ تماماً</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              stockStatusFilter === 'OUT_OF_STOCK' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-800'
            }`}>
              {stockCounts.out}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStockStatusFilter('SLOW_MOVING')}
            className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              stockStatusFilter === 'SLOW_MOVING'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Clock size={12} className={stockStatusFilter === 'SLOW_MOVING' ? 'text-white' : 'text-slate-500'} />
            <span>بضاعة راكدة</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              stockStatusFilter === 'SLOW_MOVING' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {stockCounts.slow}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStockStatusFilter('SAFE_STOCK')}
            className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              stockStatusFilter === 'SAFE_STOCK'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50'
            }`}
          >
            <CheckCircle2 size={12} className={stockStatusFilter === 'SAFE_STOCK' ? 'text-white' : 'text-emerald-600'} />
            <span>رصيد متوفر</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              stockStatusFilter === 'SAFE_STOCK' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {stockCounts.safe}
            </span>
          </button>
        </div>

        {/* Empty State */}
        {displayItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
            <Package size={44} className="stroke-[1.5] mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">لا توجد أصناف تطابق معايير هذه البطاقة والبحث</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">جرب تغيير كلمات البحث أو إعادة ضبط فلاتر الحالة والمستودعات</p>
            {(searchQuery || stockStatusFilter !== 'ALL' || categoryFilter !== 'ALL' || warehouseFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStockStatusFilter('ALL');
                  setCategoryFilter('ALL');
                  setWarehouseFilter('ALL');
                }}
                className="btn-3d btn-3d-white mt-4 px-4 py-1.5 rounded-xl text-xs font-black text-blue-600 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                إعادة ضبط كافة الفلاتر
              </button>
            )}
          </div>
        ) : (
          <>
            {/* 📱 MOBILE CARDS FEED (Shown when viewMode === 'AUTO' on mobile, or when viewMode === 'CARDS') */}
            <div className={`p-4 ${
              viewMode === 'AUTO'
                ? 'block sm:hidden space-y-3'
                : viewMode === 'CARDS'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5'
                : 'hidden'
            }`}>
              {displayItems.map(item => {
                const itemValuation = item.stock * item.costPrice;
                const isZero = item.stock === 0;
                const isLow = !isZero && item.stock <= (item.minReorderLevel || 15);
                const isHigh = item.stock >= (item.maxStockLevel || 50);

                return (
                  <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:shadow-md transition-all space-y-3">
                    {/* Header row: Code, Category, Status badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-black text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            #{item.code}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {item.category || 'عام'}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 mt-1.5 leading-snug truncate" title={item.name}>
                          {item.name}
                        </h4>
                        {item.barcode && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-mono text-slate-400">باركود: {item.barcode}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyBarcode(item.barcode, item.id)}
                              className="p-0.5 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                              title="نسخ الباركود"
                            >
                              {copiedBarcodeId === item.id ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Status badge */}
                      <div className="shrink-0">
                        {isZero ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                            <XCircle size={11} /> نافذ تماماً
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle size={11} /> تحت الطلب
                          </span>
                        ) : (item.daysInStock || 0) > 60 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                            <Clock size={11} /> راكدة
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={11} /> متوفر
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Warehouse & Shelf location */}
                    <div className="flex items-center justify-between text-[11px] text-slate-600 bg-slate-50/80 px-2.5 py-1.5 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-1 font-medium truncate">
                        <Building2 size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate">{item.warehouseName || 'المستودع الرئيسي'}</span>
                      </div>
                      <div className="text-slate-500 font-mono text-[10px] shrink-0">
                        الرف: <strong className="text-slate-800">{item.shelfLocation || 'غير محدد'}</strong>
                      </div>
                    </div>

                    {/* Stock & Quick Adjustment Box */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold block">الرصيد الفعلي بالمخزن</span>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className={`font-mono text-xl font-black ${
                            isZero ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-900'
                          }`}>
                            {item.stock}
                          </span>
                          <span className="text-[11px] text-slate-500 font-semibold">{item.unit || 'قطعة'}</span>
                        </div>
                      </div>

                      {/* Quick increment/decrement buttons in 3D */}
                      <div className="flex items-center gap-1.5 print:hidden">
                        <button
                          type="button"
                          disabled={item.stock <= 0}
                          onClick={() => handleQuickAdjustStock(item.id, item.stock - 1)}
                          className="btn-3d btn-3d-white w-7 h-7 rounded-lg text-slate-700 hover:text-red-700 text-sm font-black flex items-center justify-center cursor-pointer disabled:opacity-40 hover:scale-105 active:scale-95 transition-all"
                          title="خصم 1 من المخزون"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAdjustStock(item.id, item.stock + 1)}
                          className="btn-3d btn-3d-white w-7 h-7 rounded-lg text-slate-700 hover:text-blue-700 text-sm font-black flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all"
                          title="إضافة 1 للمخزون"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Stock Levels Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                        <span>حد الطلب: {item.minReorderLevel || 15}</span>
                        <span>الحد الأقصى: {item.maxStockLevel || 50}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            isZero ? 'bg-red-500 w-0' : isLow ? 'bg-amber-500' : isHigh ? 'bg-emerald-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, (item.stock / (item.maxStockLevel || 50)) * 100))}%` }}
                        />
                      </div>
                    </div>

                    {/* Financial metrics grid */}
                    <div className="grid grid-cols-3 gap-1.5 text-center pt-2 border-t border-slate-100 text-[11px] font-mono">
                      <div className="bg-slate-50/80 p-1.5 rounded-lg">
                        <span className="text-[10px] text-slate-400 block">التكلفة</span>
                        <span className="font-bold text-slate-700">{item.costPrice.toFixed(1)} {currencySymbol}</span>
                      </div>
                      <div className="bg-emerald-50/60 p-1.5 rounded-lg">
                        <span className="text-[10px] text-emerald-700 block">سعر البيع</span>
                        <span className="font-bold text-emerald-800">{(item.salePrice || item.consumerPrice || 0).toFixed(1)} {currencySymbol}</span>
                      </div>
                      <div className="bg-blue-50/60 p-1.5 rounded-lg">
                        <span className="text-[10px] text-blue-700 block">تقييم المخزون</span>
                        <span className="font-black text-blue-900">{itemValuation.toLocaleString(undefined, { maximumFractionDigits: 0 })} {currencySymbol}</span>
                      </div>
                    </div>

                    {/* 3D Action Toolbar */}
                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100 print:hidden">
                      <button
                        type="button"
                        onClick={() => setSelectedAnalyticItem(item)}
                        className="btn-3d btn-3d-primary-soft h-8 px-2 text-xs font-black flex items-center justify-center gap-1 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        title="تحليل شامل للمبيعات والربحية"
                      >
                        <BarChart3 size={13} />
                        <span>تحليل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransferModalData({
                          isOpen: true,
                          item,
                          targetWarehouse: item.warehouseName === 'المستودع الرئيسي - الرياض' ? 'مستودع فرع جدة' : 'المستودع الرئيسي - الرياض',
                          quantity: Math.min(item.stock, 5) || 1,
                          newShelfLocation: '',
                          notes: `تحويل بضاعة الصنف ${item.name} بين المستودعات`
                        })}
                        className="btn-3d btn-3d-white text-indigo-700 border-indigo-200 h-8 px-2 text-xs font-black flex items-center justify-center gap-1 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        title="تحويل بين المستودعات"
                      >
                        <ArrowRightLeft size={13} />
                        <span>تحويل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustModalData({
                          isOpen: true,
                          item,
                          newStock: item.stock,
                          reason: 'تسوية جردية دورية للمخزون'
                        })}
                        className="btn-3d btn-3d-white text-slate-700 h-8 px-2 text-xs font-black flex items-center justify-center gap-1 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        title="تسوية وتعديل رصيد المخزن"
                      >
                        <Sliders size={13} />
                        <span>تسوية</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 🖥️ DESKTOP / DETAILED DATA TABLE (Shown when viewMode === 'AUTO' on desktop, or when viewMode === 'TABLE') */}
            <div className={`overflow-x-auto ${
              viewMode === 'AUTO'
                ? 'hidden sm:block'
                : viewMode === 'TABLE'
                ? 'block'
                : 'hidden'
            }`}>
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200 font-semibold">
                    <th className="py-3 px-4">كود الصنف</th>
                    <th className="py-3 px-4">اسم الصنف والباركود</th>
                    <th className="py-3 px-4">المستودع والموقع</th>
                    <th className="py-3 px-4 text-center">الرصيد الفعلي</th>
                    <th className="py-3 px-4 text-center">حدود المخزون</th>
                    <th className="py-3 px-4 text-left">سعر التكلفة</th>
                    <th className="py-3 px-4 text-left">سعر البيع</th>
                    <th className="py-3 px-4 text-left">إجمالي التقييم</th>
                    <th className="py-3 px-4 text-center">حالة المخزون</th>
                    <th className="py-3 px-4 text-center print:hidden">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayItems.map(item => {
                    const itemValuation = item.stock * item.costPrice;
                    const isZero = item.stock === 0;
                    const isLow = !isZero && item.stock <= (item.minReorderLevel || 15);
                    const isHigh = item.stock >= (item.maxStockLevel || 50);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Code */}
                        <td className="py-3 px-4 font-mono font-bold text-blue-600">
                          #{item.code}
                        </td>

                        {/* Name & Barcode */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800 text-xs">
                            {item.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                            <span className="bg-slate-100 px-1.5 py-0.2 rounded font-mono">
                              {item.barcode || 'بدون باركود'}
                            </span>
                            <span>•</span>
                            <span className="text-slate-500 font-medium">
                              {item.category || 'عام'}
                            </span>
                          </div>
                        </td>

                        {/* Warehouse & Shelf */}
                        <td className="py-3 px-4">
                          <div className="text-slate-700 font-medium flex items-center gap-1">
                            <Building2 size={12} className="text-slate-400" />
                            <span>{item.warehouseName || 'المستودع الرئيسي'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            الرف: <strong className="text-slate-600">{item.shelfLocation || 'غير محدد'}</strong>
                          </div>
                        </td>

                        {/* Stock units with quick editor */}
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                            <span className={`font-mono font-bold text-sm ${
                              isZero ? 'text-red-600 font-black' : isLow ? 'text-amber-600' : 'text-slate-900'
                            }`}>
                              {item.stock}
                            </span>
                            <span className="text-[10px] text-slate-500">{item.unit || 'قطعة'}</span>
                          </div>

                          {/* Quick increment / decrement in UI */}
                          <div className="flex items-center justify-center gap-1 mt-1 print:hidden">
                            <button
                              type="button"
                              onClick={() => handleQuickAdjustStock(item.id, item.stock + 1)}
                              className="btn-3d btn-3d-white w-5 h-5 rounded text-slate-700 hover:text-blue-700 text-xs font-bold flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all"
                              title="إضافة 1 للمخزون"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              disabled={item.stock <= 0}
                              onClick={() => handleQuickAdjustStock(item.id, item.stock - 1)}
                              className="btn-3d btn-3d-white w-5 h-5 rounded text-slate-700 hover:text-red-700 text-xs font-bold flex items-center justify-center cursor-pointer disabled:opacity-40 hover:scale-105 active:scale-95 transition-all"
                              title="خصم 1 من المخزون"
                            >
                              -
                            </button>
                          </div>
                        </td>

                        {/* Stock Level Bar & Min/Max */}
                        <td className="py-3 px-4 text-center min-w-[130px]">
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mb-1">
                            <span>حد: {item.minReorderLevel || 15}</span>
                            <span>أقصى: {item.maxStockLevel || 50}</span>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                isZero ? 'bg-red-500 w-0' : isLow ? 'bg-amber-500' : isHigh ? 'bg-emerald-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, (item.stock / (item.maxStockLevel || 50)) * 100))}%` }}
                            />
                          </div>
                          <div className="text-[9px] text-slate-400 mt-1">
                            دوران: {item.monthlyVelocity || 0} شهرياً
                          </div>
                        </td>

                        {/* Cost Price */}
                        <td className="py-3 px-4 font-mono text-left text-slate-700">
                          {item.costPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                        </td>

                        {/* Sale Price */}
                        <td className="py-3 px-4 font-mono text-left font-medium text-emerald-700">
                          {(item.salePrice || item.consumerPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                        </td>

                        {/* Valuation */}
                        <td className="py-3 px-4 font-mono font-bold text-left text-slate-900">
                          {itemValuation.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4 text-center">
                          {isZero ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                              <XCircle size={11} />
                              نافذ تماماً
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle size={11} />
                              تحت حد الطلب
                            </span>
                          ) : (item.daysInStock || 0) > 60 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                              <Clock size={11} />
                              بضاعة راكدة
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 size={11} />
                              متوفر بسلامة
                            </span>
                          )}
                        </td>

                        {/* Action buttons */}
                        <td className="py-3 px-4 text-center print:hidden">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setSelectedAnalyticItem(item)}
                              className="btn-3d btn-3d-primary-soft px-2 py-1 rounded text-[11px] font-black flex items-center gap-1 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                              title="استعراض بطاقة التحليل الشاملة والتوقعات للصنف"
                            >
                              <BarChart3 size={13} />
                              <span>تحليل</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setTransferModalData({
                                isOpen: true,
                                item,
                                targetWarehouse: item.warehouseName === 'المستودع الرئيسي - الرياض' ? 'مستودع فرع جدة' : 'المستودع الرئيسي - الرياض',
                                quantity: Math.min(item.stock, 5) || 1,
                                newShelfLocation: '',
                                notes: `تحويل بضاعة الصنف ${item.name} بين المستودعات`
                              })}
                              className="btn-3d btn-3d-white text-indigo-700 border-indigo-200 px-2 py-1 rounded text-[11px] font-black flex items-center gap-1 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                              title="تحويل كمية من هذا الصنف إلى مستودع أو فرع آخر"
                            >
                              <ArrowRightLeft size={13} />
                              <span>تحويل</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setAdjustModalData({
                                isOpen: true,
                                item,
                                newStock: item.stock,
                                reason: 'تسوية جردية دورية للمخزون'
                              })}
                              className="btn-3d btn-3d-white text-slate-700 px-2 py-1 rounded text-[11px] font-black flex items-center gap-1 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                              title="تسوية رصيد الصنف وتعديل كميته المسجلة بالمخزن"
                            >
                              <Sliders size={13} />
                              <span>تسوية</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Table Footer with Summary Stats */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">إجمالي الأصناف المعروضة:</span>
            <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
              {displayItems.length} من أصل {items.length} صنف
            </span>
          </div>

          <div className="flex items-center gap-4 font-mono">
            <span>مجموع الكميات: <strong className="text-slate-900">{displayItems.reduce((sum, i) => sum + i.stock, 0).toLocaleString()}</strong></span>
            <span>•</span>
            <span>إجمالي التكلفة: <strong className="text-blue-700">{displayItems.reduce((sum, i) => sum + (i.stock * i.costPrice), 0).toLocaleString()} {currencySymbol}</strong></span>
            <span>•</span>
            <span>إجمالي البيعي: <strong className="text-emerald-700">{displayItems.reduce((sum, i) => sum + (i.stock * (i.salePrice || i.consumerPrice || 0)), 0).toLocaleString()} {currencySymbol}</strong></span>
          </div>
        </div>
      </div>

      {/* Item Analytics Modal if user clicks on "كرت التحليل" */}
      {selectedAnalyticItem && (
        <ItemAnalyticsModal
          isOpen={true}
          items={items}
          selectedItemId={selectedAnalyticItem.id}
          onClose={() => setSelectedAnalyticItem(null)}
          onSelectItem={(id) => {
            const found = items.find(i => i.id === id);
            if (found) setSelectedAnalyticItem(found);
          }}
        />
      )}

      {/* Inter-Warehouse Transfer Modal */}
      {transferModalData.isOpen && transferModalData.item && (
        <div className="fixed inset-0 z-[100] overflow-y-auto sm:overflow-hidden flex items-start sm:items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setTransferModalData({ ...transferModalData, isOpen: false, item: null })}
          />
          <div className="relative bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 text-right space-y-4 flex flex-col animate-in fade-in zoom-in-95 duration-200 sm:max-h-full sm:overflow-y-auto my-4 sm:my-0">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2 text-indigo-700">
                <ArrowRightLeft size={20} />
                <h3 className="font-bold text-base text-slate-900">تحويل مخزني بين المستودعات والفروع</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setTransferModalData({ ...transferModalData, isOpen: false, item: null })}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">الصنف:</span>
                <span className="font-bold text-slate-900">{transferModalData.item.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">المستودع الحالي:</span>
                <span className="font-bold text-indigo-900">{transferModalData.item.warehouseName || 'المستودع الرئيسي'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">الرصيد المتوفر للتحويل:</span>
                <span className="font-mono font-bold text-slate-900">{transferModalData.item.stock} {transferModalData.item.unit}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">المستودع المحول إليه (الوجهة):</label>
                <select
                  value={transferModalData.targetWarehouse}
                  onChange={e => setTransferModalData({ ...transferModalData, targetWarehouse: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="المستودع الرئيسي - الرياض">المستودع الرئيسي - الرياض</option>
                  <option value="مستودع فرع جدة">مستودع فرع جدة</option>
                  <option value="مستودع معرض المبيعات">مستودع معرض المبيعات</option>
                  <option value="مستودع المنطقة الشرقية">مستودع المنطقة الشرقية</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">الكمية المحولة:</label>
                  <input
                    type="number"
                    min={1}
                    max={transferModalData.item.stock}
                    value={transferModalData.quantity}
                    onChange={e => setTransferModalData({ ...transferModalData, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">الموقع / الرف الجديد (اختياري):</label>
                  <input
                    type="text"
                    placeholder="مثال: JED-B02"
                    value={transferModalData.newShelfLocation}
                    onChange={e => setTransferModalData({ ...transferModalData, newShelfLocation: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">ملاحظات التحويل / أمر الحركة:</label>
                <textarea
                  rows={2}
                  value={transferModalData.notes}
                  onChange={e => setTransferModalData({ ...transferModalData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="سبب التحويل أو رقم إذن الصرف الداخلي..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTransferModalData({ ...transferModalData, isOpen: false, item: null })}
                className="btn-3d btn-3d-white px-4 py-2 text-slate-700 text-xs rounded-xl font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveTransfer}
                disabled={transferModalData.quantity <= 0 || transferModalData.quantity > transferModalData.item.stock}
                className="btn-3d btn-3d-primary flex items-center gap-1.5 px-5 py-2 text-white text-xs rounded-xl font-black transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <ArrowRightLeft size={14} />
                <span>تأكيد التحويل المخزني</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stock Adjustment Modal */}
      {adjustModalData.isOpen && adjustModalData.item && (
        <div className="fixed inset-0 z-[100] overflow-y-auto sm:overflow-hidden flex items-start sm:items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setAdjustModalData({ ...adjustModalData, isOpen: false, item: null })}
          />
          <div className="relative bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-200 text-right space-y-4 flex flex-col animate-in fade-in zoom-in-95 duration-200 sm:max-h-full sm:overflow-y-auto my-4 sm:my-0">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2 text-blue-700">
                <Sliders size={20} />
                <h3 className="font-bold text-base text-slate-900">تسوية وتعديل رصيد المخزن</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setAdjustModalData({ ...adjustModalData, isOpen: false, item: null })}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">الصنف:</span>
                <span className="font-bold text-slate-900">{adjustModalData.item.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">الرصيد الدفتري الحالي:</span>
                <span className="font-mono font-bold text-blue-800">{adjustModalData.item.stock} {adjustModalData.item.unit}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">الرصيد الفعلي الجديد بعد التسوية:</label>
                <input
                  type="number"
                  min={0}
                  value={adjustModalData.newStock}
                  onChange={e => setAdjustModalData({ ...adjustModalData, newStock: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono text-base font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">سبب التسوية / المبرر الرقابي:</label>
                <input
                  type="text"
                  value={adjustModalData.reason}
                  onChange={e => setAdjustModalData({ ...adjustModalData, reason: e.target.value })}
                  placeholder="مثال: تسوية جردية سنوية، تالف، فاقد نقل..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAdjustModalData({ ...adjustModalData, isOpen: false, item: null })}
                className="btn-3d btn-3d-white px-4 py-2 text-slate-700 text-xs rounded-xl font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveDetailedAdjustment}
                className="btn-3d btn-3d-blue flex items-center gap-1.5 px-5 py-2 text-white text-xs rounded-xl font-black transition-all shadow-sm cursor-pointer"
              >
                <Save size={14} />
                <span>حفظ التسوية وتحديث الأرصدة فوراً</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 4. POPUP CARD DETAIL MODAL (Responsive for Mobile & Desktop) 🌟 */}
      <WarehouseCardModal
        isOpen={modalCardConfig.isOpen}
        onClose={() => setModalCardConfig(prev => ({ ...prev, isOpen: false }))}
        cardId={modalCardConfig.cardId}
        cardTitle={modalCardConfig.title}
        cardSubtitle={modalCardConfig.subtitle}
        cardDescription={modalCardConfig.description}
        cardBadge={modalCardConfig.badge}
        cardBadgeColor={modalCardConfig.badgeColor}
        cardHeaderBg={modalCardConfig.headerBg}
        icon={modalCardConfig.icon}
        items={modalCardConfig.items}
        allItems={items}
        systemSettings={systemSettings}
        onOpenAnalytics={(it) => {
          setSelectedAnalyticItem({
            id: it.id,
            code: it.code,
            name: it.name,
            barcode: it.barcode || '',
            category: it.category || 'عام',
            unit: it.unit || 'قطعة',
            costPrice: it.costPrice,
            wholesalePrice: it.wholesalePrice || it.costPrice * 1.15,
            retailPrice: it.salePrice || it.consumerPrice || it.costPrice * 1.3,
            consumerPrice: it.consumerPrice || it.salePrice || it.costPrice * 1.3,
            salePrice: it.salePrice || it.consumerPrice || it.costPrice * 1.3,
            stock: it.stock,
            minReorderLevel: it.minReorderLevel || 15,
            taxRate: 15,
            isActive: it.isActive !== false
          });
        }}
        onOpenTransfer={(it) => {
          setTransferModalData({
            isOpen: true,
            item: it,
            targetWarehouse: warehouses.find(w => w !== it.warehouseName) || 'مستودع فرع جدة',
            quantity: 1,
            newShelfLocation: '',
            notes: ''
          });
        }}
        onOpenAdjust={(it) => {
          setAdjustModalData({
            isOpen: true,
            item: it,
            newStock: it.stock,
            reason: 'تسوية جردية للمخزون'
          });
        }}
        onQuickAdjustStock={handleQuickAdjustStock}
      />

      {/* Print-Only Footer for official documentation */}
      <div className="hidden print:block text-center mt-12 pt-6 border-t border-slate-300 text-slate-600 text-xs">
        <div className="flex justify-between items-center px-8">
          <div>
            <p className="font-bold">أمين المستودع / الجارد</p>
            <div className="mt-8 border-b border-dashed border-slate-400 w-36 mx-auto" />
          </div>
          <div>
            <p className="font-bold">مدير المخازن واللوجستيات</p>
            <div className="mt-8 border-b border-dashed border-slate-400 w-36 mx-auto" />
          </div>
          <div>
            <p className="font-bold">الإدارة المالية / المراجعة</p>
            <div className="mt-8 border-b border-dashed border-slate-400 w-36 mx-auto" />
          </div>
        </div>
        <p className="mt-6 text-[10px] text-slate-400">
          تقرير أرصدة المخازن مستخرج من نظام لوجوستريا للمحاسبة والمستودعات - {new Date().toLocaleString('ar-SA')}
        </p>
      </div>

    </div>
  );
}
