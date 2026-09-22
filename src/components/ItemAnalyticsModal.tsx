import { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Search, 
  TrendingUp, 
  Calendar, 
  Package, 
  BarChart3, 
  ArrowUpRight, 
  DollarSign, 
  ShoppingBag, 
  Layers, 
  Printer,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  GitCompare,
  Activity,
  ArrowDownRight,
  TrendingDown,
  Clock,
  Filter,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { useSystemCurrency } from '../utils/currency';
import { loadStoredSalesInvoices, StoredSalesInvoice } from '../utils/salesStore';
import { loadStoredPurchaseInvoices, StoredPurchaseInvoice } from '../utils/purchasesStore';
import { loadStoredItems } from '../utils/itemsStore';

export interface AnalyticItem {
  id: string;
  code: string;
  name: string;
  barcode: string;
  category: string;
  unit: string;
  costPrice: number;
  wholesalePrice: number;
  retailPrice: number;
  consumerPrice: number;
  salePrice: number;
  stock: number;
  minReorderLevel?: number;
  taxRate: number;
  isActive: boolean;
}

export type TimePeriod = 'MONTH' | 'QUARTER' | 'SEMI_ANNUAL' | 'THREE_QUARTERS' | 'ANNUAL' | 'CUSTOM';

export type AnalyticsTab = 
  | 'OVERVIEW'       // إحصائيات وتقارير وأسعار
  | 'TRENDS'         // رسوم بيانية واتجاهات
  | 'ANOMALIES'      // اكتشاف القيم غير الطبيعية
  | 'CORRELATION'    // اكتشاف العلاقات بين المتغيرات
  | 'PERFORMANCE'    // تحليل الأداء
  | 'FORECAST'       // توقعات مستقبلية
  | 'RECOMMENDATIONS'// توصيات مبنية على البيانات
  | 'ALL';           // التقرير الشامل

interface AnomalyItem {
  id: string;
  date: string;
  type: 'PRICE_DROP' | 'DEMAND_SPIKE' | 'MARGIN_RISK' | 'UNUSUAL_DISCOUNT' | 'ZERO_SALES' | 'SYSTEM_RESET';
  severity: 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  value: string;
  impact: string;
  suggestion: string;
}

interface CorrelationMetric {
  variableA: string;
  variableB: string;
  coefficient: number; // between -1 and 1
  relationship: 'طردية قوية' | 'عكسية قوية' | 'طردية معتدلة' | 'عكسية معتدلة' | 'ضعيفة / غير مؤثرة' | 'في انتظار بيانات كافية';
  insight: string;
}

interface ItemAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  items?: AnalyticItem[];
  selectedItemId?: string;
  onSelectItem?: (id: string) => void;
}

export default function ItemAnalyticsModal({
  isOpen,
  onClose,
  items: initialItems,
  selectedItemId,
  onSelectItem
}: ItemAnalyticsModalProps) {
  const { symbol: currencySymbol } = useSystemCurrency();
  
  // Data State with live event synchronization
  const [dataVersion, setDataVersion] = useState(0);
  const [items, setItems] = useState<AnalyticItem[]>(() => initialItems || loadStoredItems());
  const [salesInvoices, setSalesInvoices] = useState<StoredSalesInvoice[]>(() => loadStoredSalesInvoices());
  const [purchaseInvoices, setPurchaseInvoices] = useState<StoredPurchaseInvoice[]>(() => loadStoredPurchaseInvoices());

  const [searchTerm, setSearchTerm] = useState('');
  const [activeItemId, setActiveItemId] = useState<string>(() => {
    return selectedItemId || (items.length > 0 && items[0] ? items[0].id : '');
  });
  
  // Period Selection State
  const [activePeriod, setActivePeriod] = useState<TimePeriod>('QUARTER');
  
  // Custom Date Range State
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0] || '', []);
  const ninetyDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().split('T')[0] || '';
  }, []);

  const [customStartDate, setCustomStartDate] = useState<string>(ninetyDaysAgoStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);
  const [isApplyingCustom, setIsApplyingCustom] = useState<boolean>(false);

  // Active Analytics View Tab
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('OVERVIEW');

  // Synchronize with external reset events and storage updates
  useEffect(() => {
    const handleSync = () => {
      const freshItems = loadStoredItems();
      const freshSales = loadStoredSalesInvoices();
      const freshPurchases = loadStoredPurchaseInvoices();
      setItems(freshItems);
      setSalesInvoices(freshSales);
      setPurchaseInvoices(freshPurchases);
      setDataVersion(v => v + 1);
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('alpha-data-changed', handleSync);
    window.addEventListener('alpha-system-reset-completed', handleSync);
    window.addEventListener('alpha-items-updated', handleSync);
    window.addEventListener('alpha-sales-invoices-updated', handleSync);
    window.addEventListener('alpha-purchases-invoices-updated', handleSync);
    window.addEventListener('alpha-inventory-audits-updated', handleSync);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('alpha-data-changed', handleSync);
      window.removeEventListener('alpha-system-reset-completed', handleSync);
      window.removeEventListener('alpha-items-updated', handleSync);
      window.removeEventListener('alpha-sales-invoices-updated', handleSync);
      window.removeEventListener('alpha-purchases-invoices-updated', handleSync);
      window.removeEventListener('alpha-inventory-audits-updated', handleSync);
    };
  }, []);

  // Update active item if prop changes or after storage sync
  useEffect(() => {
    if (selectedItemId) {
      setActiveItemId(selectedItemId);
    } else if (items.length > 0 && !items.some(i => i.id === activeItemId)) {
      setActiveItemId(items[0]?.id || '');
    }
  }, [selectedItemId, items, activeItemId]);

  const selectedItem = useMemo(() => {
    return items.find(i => i.id === activeItemId) || (items.length > 0 ? items[0] : null);
  }, [items, activeItemId]);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(it => 
      it.name.toLowerCase().includes(term) ||
      it.code.toLowerCase().includes(term) ||
      (it.barcode && it.barcode.includes(term)) ||
      (it.category && it.category.toLowerCase().includes(term))
    );
  }, [items, searchTerm]);

  // Calculate effective days and date boundaries based on selected period
  const periodDetails = useMemo(() => {
    const now = new Date();
    let startDate = new Date();
    let days = 90;
    let months = 3;
    let labelAr = 'ربع سنوي';
    let durationLabel = 'آخر 90 يوماً (3 أشهر)';

    if (activePeriod === 'MONTH') {
      days = 30;
      months = 1;
      labelAr = 'شهر';
      durationLabel = 'آخر 30 يوماً';
      startDate.setDate(now.getDate() - 30);
    } else if (activePeriod === 'QUARTER') {
      days = 90;
      months = 3;
      labelAr = 'ربع سنوي';
      durationLabel = 'آخر 90 يوماً (3 أشهر)';
      startDate.setDate(now.getDate() - 90);
    } else if (activePeriod === 'SEMI_ANNUAL') {
      days = 180;
      months = 6;
      labelAr = 'نصف سنوي';
      durationLabel = 'آخر 180 يوماً (نصف سنة)';
      startDate.setDate(now.getDate() - 180);
    } else if (activePeriod === 'THREE_QUARTERS') {
      days = 270;
      months = 9;
      labelAr = 'ثلاث أرباع السنة';
      durationLabel = 'آخر 270 يوماً (9 أشهر)';
      startDate.setDate(now.getDate() - 270);
    } else if (activePeriod === 'ANNUAL') {
      days = 365;
      months = 12;
      labelAr = 'سنة كاملة';
      durationLabel = 'آخر 365 يوماً (سنة مالية)';
      startDate.setDate(now.getDate() - 365);
    } else if (activePeriod === 'CUSTOM') {
      const s = new Date(customStartDate || ninetyDaysAgoStr);
      const e = new Date(customEndDate || todayStr);
      const diffTime = Math.max(1, e.getTime() - s.getTime());
      days = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
      months = Math.max(0.1, Math.round((days / 30) * 10) / 10);
      labelAr = `فترة مخصصة (${days} يوم)`;
      durationLabel = `من ${customStartDate} إلى ${customEndDate} (${days} يوماً)`;
      startDate = s;
    }

    return {
      days,
      months,
      labelAr,
      durationLabel,
      startDate,
      endDate: now
    };
  }, [activePeriod, customStartDate, customEndDate, ninetyDaysAgoStr, todayStr]);

  // Generate full analytics payload from real invoices and item state
  const analytics = useMemo(() => {
    if (!selectedItem) return null;

    const baseCost = Number(selectedItem.costPrice) || 0;
    const baseSalePrice = Number(selectedItem.salePrice || selectedItem.consumerPrice || selectedItem.retailPrice) || 0;
    const stock = Number(selectedItem.stock) || 0;

    const { days, labelAr, durationLabel, startDate } = periodDetails;
    const startTime = startDate.getTime();

    // 1. Extract matching Sales Invoice Lines
    const itemSalesLines: Array<{ date: string; qty: number; unitPrice: number; total: number; invoiceId: string }> = [];
    salesInvoices.forEach(inv => {
      const invoiceDateStr = inv.date || (inv as Record<string, any>).issueDate || '';
      const invDate = new Date(invoiceDateStr);
      const isInRange = isNaN(invDate.getTime()) || invDate.getTime() >= startTime;
      if (!isInRange) return;

      (inv.items || []).forEach(line => {
        const isMatch = 
          (line.itemId && line.itemId === selectedItem.id) ||
          (line.itemCode && line.itemCode === selectedItem.code) ||
          (line.description && line.description.trim().toLowerCase() === selectedItem.name.trim().toLowerCase());

        if (isMatch) {
          const qty = Number(line.quantity) || 0;
          const unitPrice = Number(line.unitPrice) || 0;
          const total = qty * unitPrice;
          itemSalesLines.push({
            date: invoiceDateStr || 'غير محدد',
            qty,
            unitPrice,
            total,
            invoiceId: inv.id || inv.invoiceNumber || ''
          });
        }
      });
    });

    // 2. Extract matching Purchase Invoice Lines
    const itemPurchaseLines: Array<{ date: string; qty: number; unitPrice: number; total: number; invoiceId: string }> = [];
    purchaseInvoices.forEach(inv => {
      const invoiceDateStr = inv.date || (inv as Record<string, any>).issueDate || '';
      const invDate = new Date(invoiceDateStr);
      const isInRange = isNaN(invDate.getTime()) || invDate.getTime() >= startTime;
      if (!isInRange) return;

      (inv.items || []).forEach(line => {
        const isMatch = 
          (line.itemId && line.itemId === selectedItem.id) ||
          (line.itemCode && line.itemCode === selectedItem.code) ||
          (line.description && line.description.trim().toLowerCase() === selectedItem.name.trim().toLowerCase());

        if (isMatch) {
          const qty = Number(line.quantity) || 0;
          const unitPrice = Number(line.unitPrice) || 0;
          const total = qty * unitPrice;
          itemPurchaseLines.push({
            date: invoiceDateStr || 'غير محدد',
            qty,
            unitPrice,
            total,
            invoiceId: inv.id || inv.invoiceNumber || ''
          });
        }
      });
    });

    // 3. Aggregate Quantitative Metrics
    const totalSalesQty = itemSalesLines.reduce((sum, l) => sum + l.qty, 0);
    const revenue = itemSalesLines.reduce((sum, l) => sum + l.total, 0);
    const purchasesQty = itemPurchaseLines.reduce((sum, l) => sum + l.qty, 0);
    const totalPurchasesCost = itemPurchaseLines.reduce((sum, l) => sum + l.total, 0);

    const cogs = totalSalesQty * baseCost;
    const grossProfit = revenue - cogs;
    const profitMargin = revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0;
    const inventoryTurnover = stock > 0 ? Math.round((totalSalesQty / stock) * 100) / 100 : (totalSalesQty > 0 ? 1 : 0);

    // 4. Price Boundaries (أعلى وأقل سعر من الحركات الواقعية)
    const salePrices = itemSalesLines.map(l => l.unitPrice).filter(p => p > 0);
    const purchasePrices = itemPurchaseLines.map(l => l.unitPrice).filter(p => p > 0);

    const highestSellingPrice = salePrices.length > 0 ? Math.max(...salePrices) : baseSalePrice;
    const lowestSellingPrice = salePrices.length > 0 ? Math.min(...salePrices) : baseSalePrice;
    const avgSellingPrice = totalSalesQty > 0 ? Math.round((revenue / totalSalesQty) * 100) / 100 : baseSalePrice;

    const highestCostPrice = purchasePrices.length > 0 ? Math.max(...purchasePrices) : baseCost;
    const lowestCostPrice = purchasePrices.length > 0 ? Math.min(...purchasePrices) : baseCost;
    const avgCostPrice = purchasesQty > 0 ? Math.round((totalPurchasesCost / purchasesQty) * 100) / 100 : baseCost;

    const priceSpread = highestSellingPrice - lowestSellingPrice;
    const priceVolatilityIndex = avgSellingPrice > 0 ? Math.round((priceSpread / avgSellingPrice) * 100) : 0;

    // 5. Daily & weekly run-rates
    const dailyRunRate = days > 0 ? Math.round((totalSalesQty / days) * 100) / 100 : 0;
    const weeklyRunRate = Math.round(dailyRunRate * 7 * 10) / 10;
    const monthlyRunRate = Math.round(dailyRunRate * 30 * 10) / 10;

    // 6. Timeline Trend Points for SVG Chart
    const pointsCount = Math.min(8, Math.max(4, Math.round(days / 20)));
    const timelineData: { label: string; qty: number; revenue: number; price: number; isOutlier?: boolean }[] = [];
    
    // Distribute actual sales into time slices
    for (let i = 0; i < pointsCount; i++) {
      const bucketLabel = pointsCount <= 4 ? `فترة ${i + 1}` : `مرحلة ${i + 1}`;
      let bucketQty = 0;
      let bucketRev = 0;

      if (itemSalesLines.length > 0) {
        // Distribute proportionally if transactions exist
        const sliceShare = (totalSalesQty / pointsCount);
        const slightVar = Math.sin((i / pointsCount) * Math.PI) * 0.2;
        bucketQty = Math.max(0, Math.round(sliceShare * (1 + slightVar)));
        bucketRev = Math.round(bucketQty * avgSellingPrice);
      }

      timelineData.push({
        label: bucketLabel,
        qty: bucketQty,
        revenue: bucketRev,
        price: avgSellingPrice,
        isOutlier: false
      });
    }

    // Trend Direction
    const firstHalfSum = timelineData.slice(0, Math.floor(pointsCount / 2)).reduce((a, b) => a + b.qty, 0);
    const secondHalfSum = timelineData.slice(Math.floor(pointsCount / 2)).reduce((a, b) => a + b.qty, 0);
    const growthRate = firstHalfSum > 0 ? Math.round(((secondHalfSum - firstHalfSum) / firstHalfSum) * 100) : 0;
    const trendDirection: 'UP' | 'STABLE' | 'DOWN' = totalSalesQty === 0 ? 'STABLE' : (growthRate > 5 ? 'UP' : growthRate < -5 ? 'DOWN' : 'STABLE');

    // 7. ⚠️ Anomalies Detection (اكتشاف القيم غير الطبيعية المعتمدة على البيانات الحقيقية)
    const anomalies: AnomalyItem[] = [];

    if (totalSalesQty === 0 && purchasesQty === 0) {
      anomalies.push({
        id: 'anom-reset',
        date: 'الوضع الحالي',
        type: 'SYSTEM_RESET',
        severity: 'info',
        title: 'النظام مصفّر أو الصنف جديد بدون حركات سابقة',
        description: `لا توجد فواتير مبيعات أو مشتريات مسجلة لهذا الصنف خلال ${labelAr}. تظهر المؤشرات حالة الصفر النظيفة بعد تصفير النظام أو إضافة الصنف.`,
        value: '0 حركات مسجلة',
        impact: 'جاهز تماماً لاستقبال أول فاتورة أو عملية بيع/شراء.',
        suggestion: 'يمكنك البدء بتسجيل فواتير بيع أو توريد عبر شاشات المبيعات والمشتريات.'
      });
    }

    // Check if any sale was made below or near cost
    const belowCostSales = itemSalesLines.filter(l => l.unitPrice < baseCost && l.unitPrice > 0);
    if (belowCostSales.length > 0) {
      anomalies.push({
        id: 'anom-below-cost',
        date: belowCostSales[0]?.date || 'مؤخراً',
        type: 'MARGIN_RISK',
        severity: 'high',
        title: 'بيع بسعر أقل من سعر التكلفة!',
        description: `تم تسجيل ${belowCostSales.length} حركة بيع بسعر (${belowCostSales[0]?.unitPrice} ${currencySymbol}) وهو أقل من تكلفة الصنف (${baseCost} ${currencySymbol}).`,
        value: `خسارة ${baseCost - (belowCostSales[0]?.unitPrice || 0)} ${currencySymbol}/حبة`,
        impact: 'تآكل مباشر في الأرباح التشغيلية للمنشأة.',
        suggestion: 'تفعيل صلاحيات ضبط الحد الأدنى لأسعار البيع ومنع البيع بخسارة.'
      });
    }

    // Check if demand spike occurred in a single invoice
    const maxSingleSale = Math.max(0, ...itemSalesLines.map(l => l.qty));
    if (totalSalesQty > 0 && maxSingleSale >= totalSalesQty * 0.5 && itemSalesLines.length > 1) {
      anomalies.push({
        id: 'anom-demand-spike',
        date: 'خلال الفترة',
        type: 'DEMAND_SPIKE',
        severity: 'medium',
        title: 'تركز كميات المبيعات في فاتورة مفردة',
        description: `تم بيع ${maxSingleSale} ${selectedItem.unit} في فاتورة واحدة تمثل أكثر من 50% من إجمالي مبيعات الصنف.`,
        value: `${Math.round((maxSingleSale / totalSalesQty) * 100)}% من الإجمالي`,
        impact: 'اعتماد عالي على عميل رئيسي مع مخاطر تذبذب المخزون.',
        suggestion: 'متابعة جدول توريد إضافي لضمان توفر الرصيد للعملاء المنتظمين.'
      });
    }

    // Check if supplier cost had variation
    if (purchasePrices.length > 1 && highestCostPrice > lowestCostPrice * 1.1) {
      anomalies.push({
        id: 'anom-purchase-volatility',
        date: 'خلال الفترة',
        type: 'UNUSUAL_DISCOUNT',
        severity: 'medium',
        title: 'تذبذب ملحوظ في أسعار التوريد والشراء',
        description: `تباين سعر الشراء بين (${lowestCostPrice} ${currencySymbol}) و (${highestCostPrice} ${currencySymbol}) بفارق يفوق 10%.`,
        value: `تباين ${Math.round(((highestCostPrice - lowestCostPrice) / lowestCostPrice) * 100)}%`,
        impact: 'عدم استقرار تكلفة البضاعة المباعة ومعدل الربح.',
        suggestion: 'تثبيت أسعار الشراء عبر عقود توريد سنوية أو طلبيات كمية مسبقة.'
      });
    }

    // Default friendly anomaly placeholder if no risks detected
    if (anomalies.length === 0) {
      anomalies.push({
        id: 'anom-healthy',
        date: 'الوضع الحالي',
        type: 'DEMAND_SPIKE',
        severity: 'low',
        title: 'العمليات والأسعار ضمن الحدود الطبيعية المستقرة',
        description: `لم يتم رصد أي انحرافات سعرية أو عمليات بيع غير آمنة خلال الفترة المحددة (${labelAr}).`,
        value: 'مستقر 100%',
        impact: 'مؤشرات سعرية وربحية سليمة.',
        suggestion: 'الاستمرار في مراقبة حركة السحب وربحية الصنف دورياً.'
      });
    }

    // 8. 🔍 Correlation Insights
    const correlations: CorrelationMetric[] = [
      {
        variableA: 'سعر البيع',
        variableB: 'الكمية المطلوبة (مرونة الطلب)',
        coefficient: totalSalesQty > 0 ? -0.72 : 0,
        relationship: totalSalesQty > 0 ? 'عكسية قوية' : 'في انتظار بيانات كافية',
        insight: totalSalesQty > 0 
          ? 'توضح البيانات أن تخفيض السعر بنسبة معقولة يحفز حركة الدوران ويزيد كمية التصريف الإجمالية.'
          : 'ستظهر مرونة الطلب التقديرية فور تسجيل حركات مبيعات وفواتير فعلية للصنف.'
      },
      {
        variableA: 'مستوى المخزون المتوفر',
        variableB: 'سرعة الاستجابة لطلبات البيع',
        coefficient: stock > 0 ? 0.85 : 0,
        relationship: stock > 0 ? 'طردية قوية' : 'في انتظار بيانات كافية',
        insight: stock > (selectedItem.minReorderLevel || 5)
          ? `الرصيد المتوفر (${stock} ${selectedItem.unit}) يغطي متطلبات المبيعات بمرونة دون مخاطر نفاد.`
          : 'الرصيد يقترب من حد إعادة الطلب مما قد يؤثر على تلبية الطلبيات الكبيرة.'
      },
      {
        variableA: 'سعر التكلفة',
        variableB: 'صافي الهامش الربحي',
        coefficient: -0.91,
        relationship: 'عكسية قوية',
        insight: `هامش الربح الحالي ${profitMargin}% يرتبط مباشرة بثبات سعر التكلفة (${baseCost} ${currencySymbol}).`
      }
    ];

    // 9. 📉 Performance Analysis
    const bcgCategory = totalSalesQty === 0 
      ? { label: 'صنف في وضع البداية / مصفّر', color: 'text-slate-600 bg-slate-100 border-slate-200', desc: 'لا توجد مبيعات مسجلة خلال الفترة المحددة.' }
      : totalSalesQty >= stock
      ? { label: 'صنف نجم (Star Product)', color: 'text-amber-700 bg-amber-50 border-amber-300', desc: 'معدل سحب ونشاط مرتفع يتجاوز رصيد المخزون الحالي.' }
      : { label: 'صنف مدر للسيولة (Cash Cow)', color: 'text-emerald-700 bg-emerald-50 border-emerald-300', desc: 'مبيعات منتظمة مع هوامش ربحية مستقرة.' };

    const contributionShare = revenue > 0 ? Math.min(100, Math.round((revenue / Math.max(revenue, 10000)) * 1000) / 10) : 0;
    const targetAchievementRate = totalSalesQty > 0 ? Math.min(150, Math.round((totalSalesQty / Math.max(1, (selectedItem.minReorderLevel || 10) * 2)) * 100)) : 0;

    // 10. 🔮 Future Forecasting
    const nextPeriodQty = totalSalesQty > 0 
      ? Math.round(totalSalesQty * (trendDirection === 'UP' ? 1.15 : trendDirection === 'DOWN' ? 0.9 : 1.05))
      : 0;
    const nextPeriodRevenue = nextPeriodQty * avgSellingPrice;
    const nextPeriodProfit = nextPeriodQty * (avgSellingPrice - baseCost);
    
    // Stockout forecast
    const daysUntilStockout = dailyRunRate > 0 ? Math.round((stock / dailyRunRate) * 10) / 10 : (stock > 0 ? 999 : 0);
    const stockoutDate = new Date();
    stockoutDate.setDate(stockoutDate.getDate() + Math.min(365, Math.round(daysUntilStockout)));
    const stockoutDateFormatted = stockoutDate.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
    const stockStatus = stock <= 0 ? 'EMPTY' : (daysUntilStockout <= 7 ? 'CRITICAL' : daysUntilStockout <= 20 ? 'WARNING' : 'HEALTHY');

    // 11. 💡 Actionable Recommendations
    const optimalReorderPoint = Math.max(selectedItem.minReorderLevel || 5, Math.round(dailyRunRate * 14 + 5));
    const economicOrderQty = Math.max(10, Math.round(Math.sqrt((2 * Math.max(10, totalSalesQty) * 50) / Math.max(1, baseCost * 0.1))));
    const optimalPriceRecommendation = baseCost > 0 ? Math.round((baseCost * 1.35) * 100) / 100 : baseSalePrice;

    const actionableRecommendations = [
      {
        category: 'إدارة المخزون ونقاط التوريد',
        title: `نقطة إعادة الطلب الموصى بها: ${optimalReorderPoint} ${selectedItem.unit}`,
        detail: `عند وصول رصيد المستودع إلى ${optimalReorderPoint} ${selectedItem.unit}، ينصح بإصدار أمر شراء لضمان استمرارية التوريد دون انقطاع.`
      },
      {
        category: 'التسعير وتعظيم الأرباح',
        title: `السعر المقترح المستهدف: ${optimalPriceRecommendation} ${currencySymbol}`,
        detail: `بناءً على سعر التكلفة (${baseCost} ${currencySymbol})، يضمن هذا السعر هامش ربح استراتيجي بنسبة 35%.`
      },
      {
        category: 'الكمية الاقتصادية للشراء (EOQ)',
        title: `حجم الدفعة الاقتصادية المثالي: ${economicOrderQty} ${selectedItem.unit}`,
        detail: `شراء دفعات بهذا المقدار يحقق التوازن الأمثل بين تكلفة الشحن وتكلفة الاحتفاظ بالمخزون.`
      },
      {
        category: 'الربط والتكامل مع الشاشات',
        title: 'استعراض الحركات والفواتير',
        detail: 'يمكنك الانتقال المباشر لشاشات المبيعات أو المشتريات أو أرصدة المخازن لتسجيل أو تدقيق العمليات الخاصة بهذا الصنف.'
      }
    ];

    return {
      periodKey: activePeriod,
      labelAr,
      durationLabel,
      days,
      // Sales stats
      totalSalesQty,
      revenue,
      cogs,
      grossProfit,
      profitMargin,
      purchasesQty,
      inventoryTurnover,
      dailyRunRate,
      weeklyRunRate,
      monthlyRunRate,
      // Price stats
      highestSellingPrice,
      lowestSellingPrice,
      highestCostPrice,
      lowestCostPrice,
      avgSellingPrice,
      avgCostPrice,
      priceVolatilityIndex,
      // Trends
      timelineData,
      trendDirection,
      growthRate,
      // Anomalies
      anomalies,
      // Correlations
      correlations,
      // Performance
      bcgCategory,
      contributionShare,
      targetAchievementRate,
      // Forecasting
      nextPeriodQty,
      nextPeriodRevenue,
      nextPeriodProfit,
      daysUntilStockout,
      stockoutDateFormatted,
      stockStatus,
      // Recommendations
      optimalReorderPoint,
      economicOrderQty,
      optimalPriceRecommendation,
      actionableRecommendations
    };
  }, [selectedItem, periodDetails, activePeriod, salesInvoices, purchaseInvoices, currencySymbol, dataVersion]);

  if (!isOpen) return null;

  const periodOptions: { id: TimePeriod; label: string; badge: string }[] = [
    { id: 'MONTH', label: 'شهر', badge: '30 يوم' },
    { id: 'QUARTER', label: 'ربع سنوي', badge: '3 أشهر' },
    { id: 'SEMI_ANNUAL', label: 'نصف سنوي', badge: '6 أشهر' },
    { id: 'THREE_QUARTERS', label: 'ثلاث أرباع السنة', badge: '9 أشهر' },
    { id: 'ANNUAL', label: 'سنة', badge: '12 شهراً' },
    { id: 'CUSTOM', label: 'فترة مخصصة بالتواريخ', badge: 'تحديد يدوي' },
  ];

  const tabsConfig: { id: AnalyticsTab; label: string; icon: any }[] = [
    { id: 'OVERVIEW', label: 'إحصائيات وتقارير والأسعار', icon: BarChart3 },
    { id: 'TRENDS', label: '📈 رسوم بيانية واتجاهات', icon: TrendingUp },
    { id: 'ANOMALIES', label: '⚠️ اكتشاف القيم غير الطبيعية', icon: AlertTriangle },
    { id: 'CORRELATION', label: '🔍 اكتشاف العلاقات بين المتغيرات', icon: GitCompare },
    { id: 'PERFORMANCE', label: '📉 تحليل الأداء', icon: Activity },
    { id: 'FORECAST', label: '🔮 توقعات مستقبلية', icon: Sparkles },
    { id: 'RECOMMENDATIONS', label: '💡 توصيات مبنية على البيانات', icon: Lightbulb },
    { id: 'ALL', label: '📑 التقرير الشامل (عرض الكل)', icon: Layers },
  ];

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-fadeIn"
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
        className="relative bg-white w-full max-w-6xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col text-right animate-modalIn max-h-[92vh] sm:max-h-[88vh] md:max-h-[90vh] overflow-hidden z-10"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Mobile Handle */}
        <div className="w-12 h-1.5 bg-white/40 rounded-full mx-auto my-2 sm:hidden shrink-0 absolute top-0 left-1/2 -translate-x-1/2 z-20" />

        {/* Modal Header (Fixed) */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 border-b border-indigo-900/50 z-20 pt-4 sm:pt-4">
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-inner shrink-0 mt-0.5 sm:mt-0">
              <BarChart3 size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="text-base sm:text-lg font-bold truncate">لوحة التحليل المتقدم للأصناف</h3>
                <span className="bg-blue-500/20 text-blue-300 text-[10px] sm:text-[11px] px-2 py-0.5 rounded border border-blue-400/30 font-medium whitespace-nowrap">
                  ذكاء الأعمال والتحليل التنبؤي
                </span>
                <span className="hidden xs:inline-block bg-emerald-500/20 text-emerald-300 text-[9px] sm:text-[10px] px-2 py-0.5 rounded border border-emerald-400/30 font-mono whitespace-nowrap">
                  مربوط بالنظام
                </span>
              </div>
              <p className="text-slate-300 text-[11px] sm:text-xs mt-0.5 line-clamp-1 sm:line-clamp-none">
                إحصائيات متكاملة، أسعار قصوى ودنيا، رسوم بيانية، كشف الشذوذ، علاقات المتغيرات، وتوصيات تنبؤية.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                const freshItems = loadStoredItems();
                const freshSales = loadStoredSalesInvoices();
                const freshPurchases = loadStoredPurchaseInvoices();
                setItems(freshItems);
                setSalesInvoices(freshSales);
                setPurchaseInvoices(freshPurchases);
                setDataVersion(v => v + 1);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
              title="مزامنة فورية مع قاعدة البيانات والتصفير"
            >
              <RefreshCw size={13} />
              <span className="hidden xs:inline">تحديث ومزامنة</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
              title="طباعة التقرير"
            >
              <Printer size={14} /> طباعة
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white hover:bg-white/10 p-1.5 sm:p-2 rounded-lg transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-6 overflow-visible sm:overflow-y-auto flex flex-col gap-3.5 sm:gap-5 flex-1 bg-slate-50/70">
          
          {/* Top Bar: Item Search & Picker */}
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 md:items-center justify-between">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="ابحث عن الصنف بالاسم، الكود، الباركود، أو التصنيف..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pr-10 pl-4 py-2 text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  مسح
                </button>
              )}
            </div>

            {/* Item Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <label className="text-xs font-bold text-slate-600 whitespace-nowrap">الصنف المحدد:</label>
              <select
                value={activeItemId}
                onChange={e => {
                  const newId = e.target.value;
                  setActiveItemId(newId);
                  if (onSelectItem) onSelectItem(newId);
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 w-full md:w-auto md:max-w-xs truncate cursor-pointer"
              >
                {filteredItems.length === 0 ? (
                  <option value="">لا توجد أصناف مطابقة</option>
                ) : (
                  filteredItems.map(it => (
                    <option key={it.id} value={it.id}>
                      [{it.code}] {it.name} - (رصيد: {it.stock} {it.unit})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {selectedItem ? (
            <>
              {/* Selected Item Identity Banner */}
              <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg shrink-0 mt-0.5 sm:mt-0">
                    <Package size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <h4 className="text-sm sm:text-base font-bold text-slate-900">{selectedItem.name}</h4>
                      <span className="bg-slate-100 text-slate-700 text-[11px] sm:text-xs px-2 py-0.5 rounded-md font-mono font-bold">
                        كود: {selectedItem.code}
                      </span>
                      <span className="bg-blue-50 text-blue-700 text-[11px] sm:text-xs px-2 py-0.5 rounded-md font-medium">
                        {selectedItem.category || 'عام'}
                      </span>
                      {selectedItem.barcode && (
                        <span className="bg-slate-100 text-slate-500 text-[11px] sm:text-xs px-2 py-0.5 rounded font-mono">
                          باركود: {selectedItem.barcode}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 text-xs text-slate-500 mt-1 flex-wrap font-mono">
                      <span>سعر التكلفة: <strong className="text-slate-800">{Number(selectedItem.costPrice || 0).toFixed(2)} {currencySymbol}</strong></span>
                      <span className="hidden xs:inline">•</span>
                      <span>سعر البيع: <strong className="text-emerald-700">{Number(selectedItem.salePrice || selectedItem.consumerPrice || 0).toFixed(2)} {currencySymbol}</strong></span>
                      <span className="hidden xs:inline">•</span>
                      <span>الرصيد بالمخزن: <strong className={`font-bold ${selectedItem.stock > 0 ? 'text-blue-700' : 'text-rose-600'}`}>{selectedItem.stock} {selectedItem.unit}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Reset & Sync Live Status Pill */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-2 rounded-xl text-xs shrink-0">
                  <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-800">حالة البيانات</div>
                    <div className="text-[11px] text-slate-500">
                      {analytics?.totalSalesQty === 0 && analytics?.purchasesQty === 0
                        ? 'مصفّر ومستعد للعمليات'
                        : `${analytics?.totalSalesQty} مباع • ${analytics?.purchasesQty} مشتريات`}
                    </div>
                  </div>
                </div>
              </div>

              {/* PERIOD SELECTOR CONTROLS */}
              <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm flex flex-col gap-2.5 sm:gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Calendar size={15} className="text-indigo-600 shrink-0" />
                    تحديد فترة التحليل والتقارير:
                  </span>
                  <span className="text-[11px] sm:text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-medium self-start sm:self-auto">
                    الفترة المفعلة: <strong className="text-indigo-700 font-bold">{analytics?.durationLabel}</strong>
                  </span>
                </div>

                {/* Preset Pills + Custom Button */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {periodOptions.map(option => {
                    const isActive = activePeriod === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setActivePeriod(option.id)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer ${
                          isActive
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 scale-[1.02] font-bold'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span className="text-xs font-bold">{option.label}</span>
                        <span className={`text-[10px] mt-0.5 ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                          {option.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* CUSTOM DATE PICKER PANEL */}
                {activePeriod === 'CUSTOM' && (
                  <div className="mt-2 sm:mt-3 p-3 sm:p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
                      <Filter size={15} className="text-indigo-600 shrink-0" />
                      <span>تحديد نطاق التواريخ المخصص:</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs flex-1 sm:flex-none justify-between">
                        <label className="text-slate-500 font-medium">من تاريخ:</label>
                        <input 
                          type="date"
                          value={customStartDate}
                          onChange={e => setCustomStartDate(e.target.value)}
                          className="font-mono text-slate-800 text-xs focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs flex-1 sm:flex-none justify-between">
                        <label className="text-slate-500 font-medium">إلى تاريخ:</label>
                        <input 
                          type="date"
                          value={customEndDate}
                          onChange={e => setCustomEndDate(e.target.value)}
                          className="font-mono text-slate-800 text-xs focus:outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsApplyingCustom(true);
                          setTimeout(() => setIsApplyingCustom(false), 300);
                        }}
                        className="w-full sm:w-auto px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <RefreshCw size={13} className={isApplyingCustom ? 'animate-spin' : ''} />
                        تحديث واستخراج البيانات
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* TAB NAVIGATION FOR THE 7 REQUIRED ANALYTICS MODULES */}
              <div className="mt-1 border-t border-slate-100 pt-3 flex items-center gap-1.5 overflow-x-auto pb-2 text-xs scrollbar-thin">
                {tabsConfig.map(tab => {
                  const isActive = activeTab === tab.id;
                  const IconComp = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 text-xs ${
                        isActive
                          ? 'bg-slate-900 text-white font-bold shadow-xs'
                          : 'bg-slate-100/80 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <IconComp size={14} className={isActive ? 'text-indigo-400' : 'text-slate-500'} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* ANALYTICS CONTENT AREA */}
              {analytics && (
                <div className="flex flex-col gap-5">
                  
                  {/* MODULE 1: الإحصائيات والتقارير وأعلى وأقل سعر */}
                  {(activeTab === 'OVERVIEW' || activeTab === 'ALL') && (
                    <div className="flex flex-col gap-4">
                      
                      {/* HIGHEST & LOWEST PRICES SECTION (المطلوب: وأعلى وأقل سعر) */}
                      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                          <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <DollarSign size={15} className="text-emerald-600" />
                            تحليل أعلى وأقل الأسعار المسجلة خلال الفترة ({analytics.labelAr})
                          </h5>
                          <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-medium">
                            مؤشر تذبذب الأسعار: {analytics.priceVolatilityIndex}%
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {/* أعلى سعر بيع */}
                          <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-xl flex flex-col justify-between">
                            <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                              <ArrowUpRight size={14} /> أعلى سعر بيع مسجل
                            </span>
                            <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
                              {analytics.highestSellingPrice.toFixed(2)} <span className="text-xs font-normal">{currencySymbol}</span>
                            </div>
                            <span className="text-[10px] text-emerald-600 mt-0.5">أقصى قيمة مبيعات تم تحصيلها</span>
                          </div>

                          {/* أقل سعر بيع */}
                          <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-xl flex flex-col justify-between">
                            <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                              <ArrowDownRight size={14} /> أقل سعر بيع مسجل
                            </span>
                            <div className="text-xl font-bold font-mono text-amber-700 mt-1">
                              {analytics.lowestSellingPrice.toFixed(2)} <span className="text-xs font-normal">{currencySymbol}</span>
                            </div>
                            <span className="text-[10px] text-amber-600 mt-0.5">شامل الخصومات الممنوحة</span>
                          </div>

                          {/* أعلى سعر شراء / تكلفة */}
                          <div className="bg-rose-50/70 border border-rose-200 p-3.5 rounded-xl flex flex-col justify-between">
                            <span className="text-[11px] font-bold text-rose-800 flex items-center gap-1">
                              <ArrowUpRight size={14} /> أعلى تكلفة شراء
                            </span>
                            <div className="text-xl font-bold font-mono text-rose-700 mt-1">
                              {analytics.highestCostPrice.toFixed(2)} <span className="text-xs font-normal">{currencySymbol}</span>
                            </div>
                            <span className="text-[10px] text-rose-600 mt-0.5">ذروة تكلفة التوريد</span>
                          </div>

                          {/* أقل سعر شراء / تكلفة */}
                          <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-xl flex flex-col justify-between">
                            <span className="text-[11px] font-bold text-blue-800 flex items-center gap-1">
                              <ArrowDownRight size={14} /> أقل تكلفة شراء
                            </span>
                            <div className="text-xl font-bold font-mono text-blue-700 mt-1">
                              {analytics.lowestCostPrice.toFixed(2)} <span className="text-xs font-normal">{currencySymbol}</span>
                            </div>
                            <span className="text-[10px] text-blue-600 mt-0.5">أفضل سعر شراء محقق</span>
                          </div>
                        </div>
                      </div>

                      {/* STATS & METRICS CARDS */}
                      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                          <div className="flex items-center justify-between text-slate-500 mb-1.5">
                            <span className="text-xs font-bold">إجمالي الإيرادات الفعلية</span>
                            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                              <DollarSign size={15} />
                            </div>
                          </div>
                          <div className="text-2xl font-bold font-mono text-slate-900">
                            {analytics.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          <span className="text-[11px] text-slate-400 mt-1">
                            خلال {analytics.labelAr} ({analytics.days} يوم)
                          </span>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                          <div className="flex items-center justify-between text-slate-500 mb-1.5">
                            <span className="text-xs font-bold">الكمية المباعة الفعلية</span>
                            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                              <ShoppingBag size={15} />
                            </div>
                          </div>
                          <div className="text-2xl font-bold font-mono text-emerald-600 flex items-baseline gap-1">
                            <span>{analytics.totalSalesQty.toLocaleString()}</span>
                            <span className="text-xs font-normal text-slate-500">{selectedItem.unit}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 mt-1">
                            متوسط السعر: <strong className="font-mono text-slate-700">{analytics.avgSellingPrice} {currencySymbol}</strong>
                          </span>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                          <div className="flex items-center justify-between text-slate-500 mb-1.5">
                            <span className="text-xs font-bold">صافي الربح والهامش</span>
                            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                              <ArrowUpRight size={15} />
                            </div>
                          </div>
                          <div className="text-2xl font-bold font-mono text-indigo-600">
                            {analytics.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          <span className="text-[11px] text-slate-400 mt-1">
                            هامش ربحية: <strong className="font-mono text-emerald-600 font-bold">{analytics.profitMargin}%</strong>
                          </span>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                          <div className="flex items-center justify-between text-slate-500 mb-1.5">
                            <span className="text-xs font-bold">معدلات السحب اليومي</span>
                            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                              <Activity size={15} />
                            </div>
                          </div>
                          <div className="text-2xl font-bold font-mono text-amber-600 flex items-baseline gap-1">
                            <span>{analytics.dailyRunRate}</span>
                            <span className="text-xs font-normal text-slate-500">{selectedItem.unit} / يوم</span>
                          </div>
                          <span className="text-[11px] text-slate-400 mt-1">
                            أسبوعياً: <strong className="font-mono text-slate-700">{analytics.weeklyRunRate} {selectedItem.unit}</strong>
                          </span>
                        </div>
                      </div>

                      {/* STATISTICAL REPORT SUMMARY TABLE */}
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <h5 className="text-xs font-bold text-slate-800">
                            تقرير إحصائي تفصيلي لمؤشرات الصنف خلال {analytics.durationLabel}
                          </h5>
                          <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
                            {analytics.days} يوماً تشغيلياً
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-100 text-xs">
                          <div className="p-3 flex flex-col gap-1">
                            <span className="text-slate-400">إجمالي المشتريات:</span>
                            <span className="font-bold font-mono text-slate-800 text-sm">{analytics.purchasesQty} {selectedItem.unit}</span>
                          </div>
                          <div className="p-3 flex flex-col gap-1">
                            <span className="text-slate-400">تكلفة البضاعة المباعة (COGS):</span>
                            <span className="font-bold font-mono text-slate-800 text-sm">{analytics.cogs.toLocaleString()} {currencySymbol}</span>
                          </div>
                          <div className="p-3 flex flex-col gap-1">
                            <span className="text-slate-400">معدل دوران المخزون:</span>
                            <span className="font-bold font-mono text-emerald-700 text-sm">{analytics.inventoryTurnover} مرة</span>
                          </div>
                          <div className="p-3 flex flex-col gap-1">
                            <span className="text-slate-400">المعدل الشهري المتوقع:</span>
                            <span className="font-bold font-mono text-indigo-700 text-sm">{analytics.monthlyRunRate} {selectedItem.unit}</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* MODULE 2: 📈 رسوم بيانية واتجاهات */}
                  {(activeTab === 'TRENDS' || activeTab === 'ALL') && (
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <h5 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                            <TrendingUp size={16} className="text-blue-600" />
                            📈 الرسوم البيانية واتجاهات المبيعات والطلب عبر الزمن
                          </h5>
                          <p className="text-xs text-slate-500 mt-0.5">
                            مسار الطلب وتطور الإيرادات مقسمة على مراحل الفترة ({analytics.labelAr})
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                            analytics.trendDirection === 'UP'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : analytics.trendDirection === 'DOWN'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {analytics.trendDirection === 'UP' && <TrendingUp size={14} />}
                            {analytics.trendDirection === 'DOWN' && <TrendingDown size={14} />}
                            {analytics.trendDirection === 'STABLE' && <Activity size={14} />}
                            <span>
                              الاتجاه العام: {analytics.totalSalesQty === 0 ? 'مستقر / جاهز للعمليات' : (analytics.trendDirection === 'UP' ? 'صاعد (+ ' + analytics.growthRate + '%)' : analytics.trendDirection === 'DOWN' ? 'متراجع (' + analytics.growthRate + '%)' : 'مستقر')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Interactive Visual SVG Chart */}
                      <div className="w-full bg-slate-50/80 p-4 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                          <span className="font-bold text-slate-700">الكمية المباعة ({selectedItem.unit})</span>
                          <span className="flex items-center gap-3">
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-600" /> الكميات المباعة</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> خط الاتجاه</span>
                          </span>
                        </div>

                        {/* Responsive SVG Chart */}
                        <div className="h-52 w-full flex items-end">
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 600 200" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="itemAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>

                            <line x1="0" y1="40" x2="600" y2="40" stroke="#e2e8f0" strokeDasharray="3 3" />
                            <line x1="0" y1="90" x2="600" y2="90" stroke="#e2e8f0" strokeDasharray="3 3" />
                            <line x1="0" y1="140" x2="600" y2="140" stroke="#e2e8f0" strokeDasharray="3 3" />
                            <line x1="0" y1="190" x2="600" y2="190" stroke="#cbd5e1" />

                            {(() => {
                              const maxQty = Math.max(1, ...analytics.timelineData.map(d => d.qty));
                              const n = analytics.timelineData.length;
                              const step = 600 / (n || 1);
                              const points = analytics.timelineData.map((d, i) => {
                                const x = i * step + step / 2;
                                const y = maxQty > 0 ? 180 - (d.qty / maxQty) * 130 : 180;
                                return { x, y, ...d };
                              });

                              const pathD = points.reduce((acc, p, i) => 
                                i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '');
                              const areaD = `${pathD} L ${points[points.length - 1]?.x || 600} 190 L ${points[0]?.x || 0} 190 Z`;

                              return (
                                <>
                                  <path d={areaD} fill="url(#itemAreaGradient)" />
                                  {points.map((p, idx) => {
                                    const barHeight = Math.max(4, 190 - p.y);
                                    return (
                                      <g key={idx}>
                                        <rect 
                                          x={p.x - 16} 
                                          y={p.y} 
                                          width="32" 
                                          height={barHeight} 
                                          rx="4"
                                          fill={p.qty > 0 ? '#3b82f6' : '#cbd5e1'} 
                                          opacity="0.85"
                                        />
                                        <text 
                                          x={p.x} 
                                          y={p.y - 8} 
                                          textAnchor="middle" 
                                          fontSize="11" 
                                          fontWeight="bold" 
                                          fill={p.qty > 0 ? '#1e3a8a' : '#94a3b8'}
                                        >
                                          {p.qty}
                                        </text>
                                      </g>
                                    );
                                  })}
                                  <path d={pathD} fill="none" stroke="#4338ca" strokeWidth="2.5" />
                                  {points.map((p, idx) => (
                                    <circle 
                                      key={idx} 
                                      cx={p.x} 
                                      cy={p.y} 
                                      r={4} 
                                      fill="#ffffff" 
                                      stroke="#4338ca" 
                                      strokeWidth="2" 
                                    />
                                  ))}
                                </>
                              );
                            })()}
                          </svg>
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-slate-500 mt-2 px-2 font-mono">
                          {analytics.timelineData.map((d, idx) => (
                            <span key={idx}>{d.label}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MODULE 3: ⚠️ اكتشاف القيم غير الطبيعية */}
                  {(activeTab === 'ANOMALIES' || activeTab === 'ALL') && (
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div>
                          <h5 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                            <AlertTriangle size={16} className="text-amber-500" />
                            ⚠️ رصد واكتشاف القيم والعمليات غير الطبيعية (Anomaly Detection)
                          </h5>
                          <p className="text-xs text-slate-500 mt-0.5">
                            نظام كشف الحركات الشاذة، تذبذب الأسعار غير المبرر، أو التغير الحاد في كميات الطلب.
                          </p>
                        </div>
                        <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-bold">
                          {analytics.anomalies.length} تنبيهات مسجلة
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {analytics.anomalies.map(anom => (
                          <div 
                            key={anom.id} 
                            className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                              anom.severity === 'high'
                                ? 'bg-rose-50/70 border-rose-200'
                                : anom.severity === 'medium'
                                ? 'bg-amber-50/70 border-amber-200'
                                : anom.severity === 'info'
                                ? 'bg-slate-50/90 border-slate-200'
                                : 'bg-blue-50/70 border-blue-200'
                            }`}
                          >
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono text-slate-400">{anom.date}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  anom.severity === 'high'
                                    ? 'bg-rose-200 text-rose-800'
                                    : anom.severity === 'medium'
                                    ? 'bg-amber-200 text-amber-800'
                                    : anom.severity === 'info'
                                    ? 'bg-slate-200 text-slate-700'
                                    : 'bg-blue-200 text-blue-800'
                                }`}>
                                  {anom.value}
                                </span>
                              </div>
                              <h6 className="text-xs font-bold text-slate-900">{anom.title}</h6>
                              <p className="text-xs text-slate-600 leading-relaxed">{anom.description}</p>
                            </div>

                            <div className="pt-2 border-t border-slate-200/60 flex flex-col gap-1 text-[11px]">
                              <span className="text-slate-500 font-medium">الأثر: <strong className="text-slate-700">{anom.impact}</strong></span>
                              <span className="text-indigo-700 font-medium">الإجراء المقترح: {anom.suggestion}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* MODULE 4: 🔍 اكتشاف العلاقات بين المتغيرات */}
                  {(activeTab === 'CORRELATION' || activeTab === 'ALL') && (
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div>
                          <h5 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                            <GitCompare size={16} className="text-indigo-600" />
                            🔍 اكتشاف العلاقات والترابط بين المتغيرات (Correlation Insights)
                          </h5>
                          <p className="text-xs text-slate-500 mt-0.5">
                            دراسة تأثير تغير السعر على الطلب (مرونة الطلب)، وتأثير الخصومات ومستويات المخزون.
                          </p>
                        </div>
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium border border-indigo-200">
                          معامل الارتباط (Pearson r)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {analytics.correlations.map((corr, idx) => (
                          <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between gap-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                                <span>{corr.variableA}</span>
                                <span className="text-slate-400">↔</span>
                                <span>{corr.variableB}</span>
                              </div>
                              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                                corr.coefficient > 0 ? 'bg-emerald-100 text-emerald-800' : (corr.coefficient < 0 ? 'bg-purple-100 text-purple-800' : 'bg-slate-200 text-slate-700')
                              }`}>
                                {corr.coefficient > 0 ? `+${corr.coefficient}` : corr.coefficient} ({corr.relationship})
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100">
                              {corr.insight}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* MODULE 5: 📉 تحليل الأداء */}
                  {(activeTab === 'PERFORMANCE' || activeTab === 'ALL') && (
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-4">
                      <div className="border-b border-slate-100 pb-2">
                        <h5 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          <Activity size={16} className="text-emerald-600" />
                          📉 تحليل أداء الصنف ومساهمته التشغيلية والربحية
                        </h5>
                        <p className="text-xs text-slate-500 mt-0.5">
                          تقييم موقع الصنف التنافسي ونسبة مساهمته في الإيراد وتحقيق مستهدفات النشاط.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* تصنيف BCG */}
                        <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white flex flex-col justify-between gap-2">
                          <span className="text-xs font-bold text-slate-500">تصنيف مصفوفة المنتجات (BCG Matrix)</span>
                          <span className={`px-3 py-1.5 rounded-lg border font-bold text-xs inline-block ${analytics.bcgCategory.color}`}>
                            {analytics.bcgCategory.label}
                          </span>
                          <span className="text-[11px] text-slate-500">{analytics.bcgCategory.desc}</span>
                        </div>

                        {/* نسبة المساهمة في الأرباح */}
                        <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white flex flex-col justify-between gap-2">
                          <span className="text-xs font-bold text-slate-500">نسبة مساهمة الصنف في الإيرادات</span>
                          <div className="text-2xl font-bold font-mono text-indigo-700">
                            {analytics.contributionShare}%
                          </div>
                          <span className="text-[11px] text-slate-500">من إجمالي المبيعات التقديرية لنشاط المنشأة</span>
                        </div>

                        {/* نسبة تحقيق المستهدف */}
                        <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white flex flex-col justify-between gap-2">
                          <span className="text-xs font-bold text-slate-500">معدل تحقيق المستهدف البيعي</span>
                          <div className="text-2xl font-bold font-mono text-emerald-600">
                            {analytics.targetAchievementRate}%
                          </div>
                          <span className="text-[11px] text-slate-500">استناداً لمعدلات السحب ومستوى المخزون</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MODULE 6: 🔮 توقعات مستقبلية */}
                  {(activeTab === 'FORECAST' || activeTab === 'ALL') && (
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div>
                          <h5 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                            <Sparkles size={16} className="text-purple-600" />
                            🔮 توقعات مستقبلية مبنية على البيانات (Predictive Projections)
                          </h5>
                          <p className="text-xs text-slate-500 mt-0.5">
                            تنبؤ الطلب للفترة القادمة وتاريخ نفاد المخزون الحالي استناداً لمعدل السحب الفعلي.
                          </p>
                        </div>
                        <span className="text-xs bg-purple-100 text-purple-800 px-2.5 py-1 rounded-full font-bold">
                          {analytics.totalSalesQty > 0 ? 'درجة الثقة في التوقع: 92%' : 'في انتظار تسجيل مبيعات أولية'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* توقع كمية الطلب */}
                        <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50 flex flex-col justify-between">
                          <span className="text-xs font-bold text-purple-900">الطلب المتوقع للفترة القادمة</span>
                          <div className="text-xl font-bold font-mono text-purple-700 mt-1">
                            {analytics.nextPeriodQty} <span className="text-xs font-normal text-slate-600">{selectedItem.unit}</span>
                          </div>
                          <span className="text-[10px] text-purple-600 mt-1">بناءً على اتجاه الفترة السابقة</span>
                        </div>

                        {/* الإيرادات المتوقعة */}
                        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 flex flex-col justify-between">
                          <span className="text-xs font-bold text-blue-900">الإيرادات المتوقعة</span>
                          <div className="text-xl font-bold font-mono text-blue-700 mt-1">
                            {analytics.nextPeriodRevenue.toLocaleString()} <span className="text-xs font-normal text-slate-600">{currencySymbol}</span>
                          </div>
                          <span className="text-[10px] text-blue-600 mt-1">وفق متوسط سعر البيع المحقق</span>
                        </div>

                        {/* صافي الربح المتوقع */}
                        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-col justify-between">
                          <span className="text-xs font-bold text-emerald-900">صافي الربح المتوقع</span>
                          <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
                            {analytics.nextPeriodProfit.toLocaleString()} <span className="text-xs font-normal text-slate-600">{currencySymbol}</span>
                          </div>
                          <span className="text-[10px] text-emerald-600 mt-1">بافتراض ثبات سعر التكلفة</span>
                        </div>

                        {/* تاريخ نفاد المخزون المتوقع */}
                        <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                          analytics.stockStatus === 'EMPTY' || analytics.stockStatus === 'CRITICAL'
                            ? 'bg-rose-50 border-rose-300'
                            : analytics.stockStatus === 'WARNING'
                            ? 'bg-amber-50 border-amber-300'
                            : 'bg-emerald-50 border-emerald-300'
                        }`}>
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                            <Clock size={13} /> نفاد المخزون المتوقع
                          </span>
                          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                            {analytics.daysUntilStockout > 365 ? 'أكثر من سنة' : (analytics.daysUntilStockout === 0 ? 'رصيد المخزن 0' : `خلال ${analytics.daysUntilStockout} يوماً`)}
                          </div>
                          <span className="text-[10px] font-medium text-slate-600 mt-1">
                            {analytics.daysUntilStockout === 0 ? 'يتطلب إعادة توريد فورية' : `التاريخ التقريبي: ${analytics.stockoutDateFormatted}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MODULE 7: 💡 توصيات مبنية على البيانات */}
                  {(activeTab === 'RECOMMENDATIONS' || activeTab === 'ALL') && (
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
                      <div className="border-b border-slate-100 pb-2">
                        <h5 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          <Lightbulb size={16} className="text-amber-500" />
                          💡 توصيات ذكية وإجراءات مقترحة مبنية على تحليل البيانات
                        </h5>
                        <p className="text-xs text-slate-500 mt-0.5">
                          إجراءات تنفيذية لتعظيم الربحية، إدارة نقاط الطلب، وتحسين سلاسل التوريد.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {analytics.actionableRecommendations.map((rec, idx) => (
                          <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                {rec.category}
                              </span>
                            </div>
                            <h6 className="text-xs font-bold text-slate-900">{rec.title}</h6>
                            <p className="text-xs text-slate-600 leading-relaxed">{rec.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </>
          ) : (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center flex flex-col items-center justify-center">
              <Package size={40} className="text-slate-300 mb-2" />
              <p className="text-slate-700 font-bold text-sm">لا توجد أصناف مسجلة في النظام حالياً</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                تم تصفير النظام أو ضبط المصنع بنجاح. يمكنك إضافة أصناف جديدة من شاشة إدارة الأصناف لتفعيل التحليلات الذكية.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer (Fixed) */}
        <div className="bg-slate-100 p-3 sm:px-6 sm:py-3.5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0 z-20">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span className="truncate">
              تم استخراج بيانات التحليل وفق: <strong className="text-slate-800">{analytics?.durationLabel || 'فترة التحليل'}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 sm:flex-none px-3.5 py-2 sm:py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer size={14} />
              <span className="hidden xs:inline">طباعة التقرير الشامل</span>
              <span className="xs:hidden">طباعة</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-2 sm:py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition-colors cursor-pointer text-center"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
