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
  Download, 
  RefreshCw, 
  BarChart3, 
  Building2, 
  CheckCircle2, 
  ArrowUpDown, 
  DollarSign, 
  Sparkles,
  ChevronRight,
  Flame
} from 'lucide-react';
import PrintDropdown from './PrintDropdown';
import ItemAnalyticsModal, { type AnalyticItem } from './ItemAnalyticsModal';
import { getSystemSettings } from '../utils/settings';
import { useSystemCurrency } from '../utils/currency';
import { DB_ITEMS_KEY } from '../utils/sequences';

export interface WarehouseItem extends AnalyticItem {
  warehouseName?: string;
  shelfLocation?: string;
  minReorderLevel?: number;
  maxStockLevel?: number;
  lastRestockDate?: string;
  daysInStock?: number;
  monthlyVelocity?: number; // Units sold per month
  supplierName?: string;
}

// Initial enriched warehouse items if not found
const INITIAL_WAREHOUSE_ITEMS: WarehouseItem[] = [
  {
    id: '1',
    code: '1',
    name: 'لابتوب ديل انسبايرون Core i7',
    barcode: '1234567890123',
    category: 'إلكترونيات',
    unit: 'حبة / قطعة',
    costPrice: 1500,
    wholesalePrice: 1750,
    retailPrice: 1900,
    consumerPrice: 2000,
    salePrice: 2000,
    stock: 14,
    taxRate: 15,
    isActive: true,
    warehouseName: 'المستودع الرئيسي - الرياض',
    shelfLocation: 'A-12-R3',
    minReorderLevel: 20, // Low stock!
    maxStockLevel: 50,
    lastRestockDate: '2026-08-15',
    daysInStock: 23,
    monthlyVelocity: 28,
    supplierName: 'شركة التوريدات العالمية'
  },
  {
    id: '2',
    code: '2',
    name: 'أرز بسمتي درجة أولى كلاسيك (شيكارة 40 كجم)',
    barcode: '1234567890124',
    category: 'مواد غذائية',
    unit: 'شيكارة',
    costPrice: 120,
    wholesalePrice: 135,
    retailPrice: 150,
    consumerPrice: 160,
    salePrice: 160,
    stock: 45,
    taxRate: 0,
    isActive: true,
    warehouseName: 'المستودع الرئيسي - الرياض',
    shelfLocation: 'B-04-F1',
    minReorderLevel: 30,
    maxStockLevel: 100,
    lastRestockDate: '2026-08-28',
    daysInStock: 10,
    monthlyVelocity: 85,
    supplierName: 'مؤسسة المواد الأولية'
  },
  {
    id: '3',
    code: '3',
    name: 'سكر أبيض ناعم 50 كجم',
    barcode: '1234567890125',
    category: 'مواد غذائية',
    unit: 'شوال',
    costPrice: 90,
    wholesalePrice: 100,
    retailPrice: 110,
    consumerPrice: 115,
    salePrice: 115,
    stock: 8, // Low stock!
    taxRate: 0,
    isActive: true,
    warehouseName: 'مستودع فرع جدة',
    shelfLocation: 'C-02-F2',
    minReorderLevel: 25,
    maxStockLevel: 80,
    lastRestockDate: '2026-07-20',
    daysInStock: 49,
    monthlyVelocity: 42,
    supplierName: 'مؤسسة المواد الأولية'
  },
  {
    id: '4',
    code: '4',
    name: 'شاي أسود فاخر 100 فتلة (كرتونة 24 باكت)',
    barcode: '1234567890126',
    category: 'مواد غذائية',
    unit: 'كرتونة',
    costPrice: 18,
    wholesalePrice: 21,
    retailPrice: 24,
    consumerPrice: 26,
    salePrice: 26,
    stock: 80,
    taxRate: 15,
    isActive: true,
    warehouseName: 'المستودع الرئيسي - الرياض',
    shelfLocation: 'B-08-R1',
    minReorderLevel: 20,
    maxStockLevel: 120,
    lastRestockDate: '2026-08-01',
    daysInStock: 37,
    monthlyVelocity: 55,
    supplierName: 'شركة الخليج للتجارة'
  },
  {
    id: '5',
    code: '5',
    name: 'شاشة سامسونج ذكية 55 بوصة 4K Ultra HD',
    barcode: '1234567890127',
    category: 'إلكترونيات',
    unit: 'جهاز',
    costPrice: 1850,
    wholesalePrice: 2100,
    retailPrice: 2350,
    consumerPrice: 2400,
    salePrice: 2400,
    stock: 0, // OUT OF STOCK!
    taxRate: 15,
    isActive: true,
    warehouseName: 'المستودع الرئيسي - الرياض',
    shelfLocation: 'A-01-R1',
    minReorderLevel: 10,
    maxStockLevel: 30,
    lastRestockDate: '2026-06-10',
    daysInStock: 89,
    monthlyVelocity: 16,
    supplierName: 'شركة التوريدات العالمية'
  },
  {
    id: '6',
    code: '6',
    name: 'طابعة ليزر متعددة الوظائف HP LaserJet Pro',
    barcode: '1234567890128',
    category: 'إلكترونيات',
    unit: 'جهاز',
    costPrice: 920,
    wholesalePrice: 1050,
    retailPrice: 1180,
    consumerPrice: 1200,
    salePrice: 1200,
    stock: 22,
    taxRate: 15,
    isActive: true,
    warehouseName: 'مستودع فرع جدة',
    shelfLocation: 'A-09-R2',
    minReorderLevel: 15,
    maxStockLevel: 40,
    lastRestockDate: '2026-08-10',
    daysInStock: 28,
    monthlyVelocity: 12,
    supplierName: 'شركة التوريدات العالمية'
  },
  {
    id: '7',
    code: '7',
    name: 'زيت دوار الشمس نقي (كرتون 12 قارورة 1.5 لتر)',
    barcode: '1234567890129',
    category: 'مواد غذائية',
    unit: 'كرتون',
    costPrice: 85,
    wholesalePrice: 98,
    retailPrice: 108,
    consumerPrice: 112,
    salePrice: 112,
    stock: 120, // High stock / Slow moving
    taxRate: 0,
    isActive: true,
    warehouseName: 'المستودع الرئيسي - الرياض',
    shelfLocation: 'B-14-F1',
    minReorderLevel: 30,
    maxStockLevel: 90,
    lastRestockDate: '2026-05-15',
    daysInStock: 115, // Stagnant!
    monthlyVelocity: 14,
    supplierName: 'مؤسسة المواد الأولية'
  },
  {
    id: '8',
    code: '8',
    name: 'هاتف ذكي أبل آيفون 15 برو ماكس 256GB',
    barcode: '1234567890130',
    category: 'إلكترونيات',
    unit: 'جهاز',
    costPrice: 4200,
    wholesalePrice: 4550,
    retailPrice: 4800,
    consumerPrice: 4950,
    salePrice: 4950,
    stock: 12, // High value asset!
    taxRate: 15,
    isActive: true,
    warehouseName: 'مستودع معرض المبيعات',
    shelfLocation: 'SAFE-V01',
    minReorderLevel: 8,
    maxStockLevel: 25,
    lastRestockDate: '2026-08-25',
    daysInStock: 13,
    monthlyVelocity: 35, // Fast moving high value
    supplierName: 'شركة التوريدات العالمية'
  },
  {
    id: '9',
    code: '9',
    name: 'بن قهوة عربي محمص فاخر مع هيل 1 كجم',
    barcode: '1234567890131',
    category: 'مواد غذائية',
    unit: 'كيس',
    costPrice: 45,
    wholesalePrice: 54,
    retailPrice: 62,
    consumerPrice: 65,
    salePrice: 65,
    stock: 0, // OUT OF STOCK!
    taxRate: 15,
    isActive: true,
    warehouseName: 'مستودع فرع جدة',
    shelfLocation: 'B-02-R3',
    minReorderLevel: 15,
    maxStockLevel: 60,
    lastRestockDate: '2026-07-05',
    daysInStock: 64,
    monthlyVelocity: 48,
    supplierName: 'شركة الخليج للتجارة'
  },
  {
    id: '10',
    code: '10',
    name: 'مكتب خشبي إداري تنفيذي مقاس 180 سم',
    barcode: '1234567890132',
    category: 'أثاث ومكتبيات',
    unit: 'قطعة',
    costPrice: 1100,
    wholesalePrice: 1350,
    retailPrice: 1500,
    consumerPrice: 1600,
    salePrice: 1600,
    stock: 5,
    taxRate: 15,
    isActive: true,
    warehouseName: 'المستودع الرئيسي - الرياض',
    shelfLocation: 'FURN-03',
    minReorderLevel: 3,
    maxStockLevel: 10,
    lastRestockDate: '2026-06-20',
    daysInStock: 79,
    monthlyVelocity: 4,
    supplierName: 'مصنع الأمل للأثاث'
  }
];

export type WarehouseCardType = 
  | 'ALL_ITEMS' 
  | 'LOW_STOCK' 
  | 'OUT_OF_STOCK' 
  | 'HIGH_VALUE' 
  | 'SLOW_MOVING' 
  | 'FAST_MOVING' 
  | 'BY_WAREHOUSE' 
  | 'BY_CATEGORY';

const LOCAL_STORAGE_WAREHOUSE_KEY = 'alpha_warehouse_balances_v2';

export default function WarehouseBalances() {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [systemSettings] = useState(() => getSystemSettings());

  // Load items
  const [items, setItems] = useState<WarehouseItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_WAREHOUSE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
        // If not found, merge with DB_ITEMS_KEY if available
        const mainDbItems = localStorage.getItem(DB_ITEMS_KEY);
        if (mainDbItems) {
          const parsedMain = JSON.parse(mainDbItems);
          if (Array.isArray(parsedMain) && parsedMain.length > 0) {
            // merge main items with enriched warehouse items
            const merged = parsedMain.map((mi: AnalyticItem, idx: number) => {
              const matched = INITIAL_WAREHOUSE_ITEMS.find(iw => iw.code === mi.code || iw.name === mi.name);
              return {
                ...mi,
                warehouseName: matched?.warehouseName || (idx % 2 === 0 ? 'المستودع الرئيسي - الرياض' : 'مستودع فرع جدة'),
                shelfLocation: matched?.shelfLocation || `S-${idx + 1}-R1`,
                minReorderLevel: matched?.minReorderLevel || 15,
                maxStockLevel: matched?.maxStockLevel || 60,
                lastRestockDate: matched?.lastRestockDate || '2026-08-01',
                daysInStock: matched?.daysInStock || 25,
                monthlyVelocity: matched?.monthlyVelocity || 20,
                supplierName: matched?.supplierName || 'شركة التوريدات العامة'
              };
            });
            return merged;
          }
        }
      } catch (err) {
        console.error('Error initializing warehouse items', err);
      }
    }
    return INITIAL_WAREHOUSE_ITEMS;
  });

  // Save to localStorage when updated
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_WAREHOUSE_KEY, JSON.stringify(items));
      } catch (err) {
        console.error(err);
      }
    }
  }, [items]);

  // Selected Card for Drill-Down Data View
  const [selectedCard, setSelectedCard] = useState<WarehouseCardType>('ALL_ITEMS');
  
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

  // Sub-filtering by search query and secondary filters
  const displayItems = useMemo(() => {
    return activeCardItems.filter(item => {
      // search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCode = item.code.toLowerCase().includes(q);
        const matchBar = item.barcode && item.barcode.includes(q);
        const matchLoc = item.shelfLocation && item.shelfLocation.toLowerCase().includes(q);
        const matchSupp = item.supplierName && item.supplierName.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchBar && !matchLoc && !matchSupp) return false;
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
  }, [activeCardItems, searchQuery, categoryFilter, warehouseFilter, sortBy, sortOrder, selectedCard]);

  // Quick stock adjuster function
  const handleQuickAdjustStock = (itemId: string, newQuantity: number) => {
    if (newQuantity < 0) return;
    const updated = items.map(i => i.id === itemId ? { ...i, stock: newQuantity } : i);
    setItems(updated);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
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
    ];

    const rows = displayItems.map(i => {
      let statusStr = 'متوفر';
      if (i.stock === 0) statusStr = 'نافذ تماماً';
      else if (i.stock <= (i.minReorderLevel || 15)) statusStr = 'تحت حد الطلب';
      else if ((i.daysInStock || 0) > 60) statusStr = 'راكد';

      return [
        i.code,
        `"${i.name}"`,
        `"${i.category || '-'}"`,
        `"${i.warehouseName || '-'}"`,
        `"${i.shelfLocation || '-'}"`,
        i.stock,
        `"${i.unit || '-'}"`,
        i.costPrice.toFixed(2),
        (i.salePrice || i.consumerPrice || 0).toFixed(2),
        (i.stock * i.costPrice).toFixed(2),
        i.minReorderLevel || 15,
        i.monthlyVelocity || 0,
        `"${statusStr}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + 
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ارصدة_المخزن_${selectedCard}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset to sample initial items
  const handleResetData = () => {
    if (confirm('هل ترغب في إعادة ضبط بيانات المخازن والأرصدة إلى القيم النموذجية؟')) {
      setItems(INITIAL_WAREHOUSE_ITEMS);
      localStorage.setItem(LOCAL_STORAGE_WAREHOUSE_KEY, JSON.stringify(INITIAL_WAREHOUSE_ITEMS));
    }
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
        <div className="flex flex-wrap items-center gap-2.5">
          <PrintDropdown />

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="تصدير بيانات البطاقة المحددة إلى Excel / CSV"
          >
            <Download size={15} className="text-emerald-600" />
            <span>تصدير البطاقة الحالية</span>
          </button>

          <button
            type="button"
            onClick={handleResetData}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="استعادة البيانات النموذجية الأولية"
          >
            <RefreshCw size={14} className="text-blue-600" />
            <span>إعادة ضبط البيانات</span>
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
            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 backdrop-blur-xs">
              <span className="text-[11px] text-blue-200 font-medium block mb-1">إجمالي تقييم التكلفة</span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-white">
                {cardsData.all.totalCostValuation.toLocaleString()} <span className="text-xs text-slate-300">{currencySymbol}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">رأس المال المستثمر في البضاعة</span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 backdrop-blur-xs">
              <span className="text-[11px] text-emerald-200 font-medium block mb-1">القيمة البيعية المتوقعة</span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
                {cardsData.all.totalRetailValuation.toLocaleString()} <span className="text-xs text-emerald-300">{currencySymbol}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                ربح متوقع: +{cardsData.all.totalPotentialProfit.toLocaleString()} {currencySymbol} ({cardsData.all.profitMarginPercent.toFixed(1)}%)
              </span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 backdrop-blur-xs">
              <span className="text-[11px] text-amber-200 font-medium block mb-1">إجمالي الوحدات بالمخازن</span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-white">
                {cardsData.all.totalStockUnits.toLocaleString()} <span className="text-xs text-slate-300">وحدة</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                موزعة على {cardsData.all.totalItems} صنف معتمد
              </span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 backdrop-blur-xs">
              <span className="text-[11px] text-red-200 font-medium block mb-1">الأصناف الحرجة (نواقص + نفاد)</span>
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
              بطاقات محاور المخزون الذكية (انقر على أي بطاقة لاستعراض بياناتها التفصيلية فوراً)
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
                  setSelectedCard(card.id);
                  // smooth scroll down to detail area if needed
                }}
                className={`relative rounded-xl p-4 transition-all duration-200 cursor-pointer border flex flex-col justify-between select-none ${
                  isSelected 
                    ? `${card.highlightBorder} shadow-md scale-[1.015]` 
                    : 'bg-white hover:bg-slate-50/80 border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                {/* Active selection indicator badge */}
                {isSelected && (
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                    <CheckCircle2 size={11} />
                    <span>نشطة</span>
                  </div>
                )}

                {/* Top section: Icon & Badge */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white bg-gradient-to-tr ${card.headerBg} shadow-xs`}>
                      <IconComponent size={18} />
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${card.badgeColor}`}>
                      {card.badge}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-slate-800 leading-snug">
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
                  <span className={isSelected ? 'text-blue-600 font-bold' : 'text-slate-500'}>
                    {isSelected ? 'البيانات معروضة بالأسفل' : 'انقر لإظهار البيانات'}
                  </span>
                  <ChevronRight size={14} className={`transform transition-transform ${isSelected ? 'text-blue-600 rotate-90' : 'text-slate-400'}`} />
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
          
          {/* Live Search */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="البحث باسم الصنف، الكود، الباركود، الرف، أو المورد..."
              className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Category selector if not in BY_CATEGORY */}
            {selectedCard !== 'BY_CATEGORY' && (
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-500"
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
                className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">كافة المستودعات ({warehouses.length})</option>
                {warehouses.map(wh => (
                  <option key={wh} value={wh}>{wh}</option>
                ))}
              </select>
            )}

            {/* Sort by */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs">
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

        {/* Items Data Table */}
        <div className="overflow-x-auto">
          {displayItems.length === 0 ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <Package size={40} className="stroke-[1.5] mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">لا توجد أصناف تطابق معايير هذه البطاقة والبحث</p>
              <p className="text-xs text-slate-400 mt-1">جرب تغيير كلمات البحث أو إعادة ضبط الفلاتر لتظهر كافة البيانات</p>
            </div>
          ) : (
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
                            className="w-5 h-5 rounded bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 text-xs font-bold flex items-center justify-center cursor-pointer transition-colors"
                            title="إضافة 1 للمخزون"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            disabled={item.stock <= 0}
                            onClick={() => handleQuickAdjustStock(item.id, item.stock - 1)}
                            className="w-5 h-5 rounded bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-700 text-xs font-bold flex items-center justify-center cursor-pointer transition-colors disabled:opacity-40"
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
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedAnalyticItem(item)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="استعراض بطاقة التحليل الشاملة والتوقعات للصنف"
                          >
                            <BarChart3 size={13} />
                            <span>كرت التحليل</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

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
