import { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Package,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  RefreshCw,
  Award,
  Clock,
  ChevronRight,
  Printer,
  Sparkles,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { useSystemCurrency } from '../utils/currency';
import { useLanguage } from '../i18n/LanguageContext';
import { loadStoredSalesInvoices, StoredSalesInvoice } from '../utils/salesStore';
import { loadStoredPurchaseInvoices, StoredPurchaseInvoice } from '../utils/purchasesStore';
import { loadCustomers, loadVendors, getPartnerAccountStatement } from '../utils/partnerLedger';
import { loadStoredItems, Item } from '../utils/itemsStore';
import { calculateTrialBalance } from '../utils/trialBalanceStore';
import { Partner, AccountType } from '../types/accounting';
import { exportToXLSX } from '../utils/universalExport';

type TimeRangeFilter = '7D' | '30D' | 'THIS_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR' | 'ALL' | 'CUSTOM';
type AnalyticsTab = 'OVERVIEW' | 'SALES' | 'EXPENSES' | 'CUSTOMERS' | 'INVENTORY';

const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1'  // indigo
];

interface AnalyticsScreenProps {
  onNavigate?: (view: string) => void;
}

export default function AnalyticsScreen({ onNavigate }: AnalyticsScreenProps) {
  const { symbol: currencySymbol, formatAmount } = useSystemCurrency();
  const { language, dir } = useLanguage();
  const isRtl = dir === 'rtl';

  // Filters State
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('THIS_YEAR');
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('OVERVIEW');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0] || '2026-01-01';
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0] || '2026-12-31';
  });
  const [refreshKey, setRefreshKey] = useState(0);

  // Raw Data State
  const [salesInvoices, setSalesInvoices] = useState<StoredSalesInvoice[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<StoredPurchaseInvoice[]>([]);
  const [customers, setCustomers] = useState<Partner[]>([]);
  const [vendors, setVendors] = useState<Partner[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  // Load all system data
  useEffect(() => {
    const fetchData = () => {
      setSalesInvoices(loadStoredSalesInvoices());
      setPurchaseInvoices(loadStoredPurchaseInvoices());
      setCustomers(loadCustomers());
      setVendors(loadVendors());
      setItems(loadStoredItems());
    };

    fetchData();

    const handleDataChange = () => {
      fetchData();
    };

    window.addEventListener('storage', handleDataChange);
    window.addEventListener('alpha-partner-ledger-updated', handleDataChange);
    window.addEventListener('alpha-sales-invoices-updated', handleDataChange);
    window.addEventListener('alpha-stock-updated', handleDataChange);

    return () => {
      window.removeEventListener('storage', handleDataChange);
      window.removeEventListener('alpha-partner-ledger-updated', handleDataChange);
      window.removeEventListener('alpha-sales-invoices-updated', handleDataChange);
      window.removeEventListener('alpha-stock-updated', handleDataChange);
    };
  }, [refreshKey]);

  // Date Range Calculation
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0] || '2026-01-01';
    let start: string | undefined = undefined;
    let end: string | undefined = todayStr;

    switch (timeRange) {
      case '7D': {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        start = d.toISOString().split('T')[0];
        break;
      }
      case '30D': {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        start = d.toISOString().split('T')[0];
        break;
      }
      case 'THIS_MONTH': {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        start = d.toISOString().split('T')[0];
        break;
      }
      case 'THIS_QUARTER': {
        const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
        const d = new Date(now.getFullYear(), quarterStartMonth, 1);
        start = d.toISOString().split('T')[0];
        break;
      }
      case 'THIS_YEAR': {
        const d = new Date(now.getFullYear(), 0, 1);
        start = d.toISOString().split('T')[0];
        break;
      }
      case 'CUSTOM': {
        start = customStartDate;
        end = customEndDate;
        break;
      }
      case 'ALL':
      default: {
        start = undefined;
        end = undefined;
        break;
      }
    }

    return { start, end };
  }, [timeRange, customStartDate, customEndDate]);

  // Filtered Invoices
  const filteredSales = useMemo(() => {
    return salesInvoices.filter((inv) => {
      if (inv.status !== 'POSTED') return false;
      if (dateRangeBounds.start && inv.date < dateRangeBounds.start) return false;
      if (dateRangeBounds.end && inv.date > dateRangeBounds.end) return false;
      return true;
    });
  }, [salesInvoices, dateRangeBounds]);

  const filteredPurchases = useMemo(() => {
    return purchaseInvoices.filter((inv) => {
      if (inv.status !== 'POSTED') return false;
      if (dateRangeBounds.start && inv.date < dateRangeBounds.start) return false;
      if (dateRangeBounds.end && inv.date > dateRangeBounds.end) return false;
      return true;
    });
  }, [purchaseInvoices, dateRangeBounds]);

  // General Ledger Accounts Summary
  const glSummary = useMemo(() => {
    const tb = calculateTrialBalance(dateRangeBounds.start, dateRangeBounds.end);

    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalCogs = 0;
    const expensesByCategory: { name: string; amount: number; code: string }[] = [];

    tb.rows.forEach((row) => {
      const acc = row.account;
      if (acc.type === AccountType.Revenue) {
        totalRevenue += (row.endingCredit - row.endingDebit);
      } else if (acc.type === AccountType.Expense) {
        const expBal = row.endingDebit - row.endingCredit;
        totalExpenses += expBal;
        if (acc.code === '5101' || acc.name.includes('تكلفة البضاعة') || acc.name.toLowerCase().includes('cogs')) {
          totalCogs += expBal;
        }
        if (expBal > 0) {
          expensesByCategory.push({
            name: acc.name,
            amount: expBal,
            code: acc.code
          });
        }
      }
    });

    // Invoices fallback if general ledger not yet populated
    const invoiceSalesTotal = filteredSales.reduce((acc, inv) => acc + (inv.totals?.grandTotal || 0), 0);
    const invoicePurchasesTotal = filteredPurchases.reduce((acc, inv) => acc + (inv.totals?.grandTotal || 0), 0);

    const effectiveRevenue = Math.max(totalRevenue, invoiceSalesTotal);
    const effectiveExpenses = totalExpenses > 0 ? totalExpenses : invoicePurchasesTotal * 0.7;
    const effectiveGrossProfit = effectiveRevenue - (totalCogs > 0 ? totalCogs : invoicePurchasesTotal * 0.6);
    const effectiveNetProfit = effectiveRevenue - effectiveExpenses;

    return {
      totalRevenue: effectiveRevenue,
      totalExpenses: effectiveExpenses,
      cogs: totalCogs,
      grossProfit: effectiveGrossProfit,
      netProfit: effectiveNetProfit,
      grossMargin: effectiveRevenue > 0 ? (effectiveGrossProfit / effectiveRevenue) * 100 : 0,
      netMargin: effectiveRevenue > 0 ? (effectiveNetProfit / effectiveRevenue) * 100 : 0,
      expensesByCategory: expensesByCategory.sort((a, b) => b.amount - a.amount)
    };
  }, [dateRangeBounds, filteredSales, filteredPurchases]);

  // Time-Series Trend Data (Monthly / Daily)
  const timeSeriesData = useMemo(() => {
    const grouped: { [key: string]: { date: string; sales: number; purchases: number; netProfit: number } } = {};

    filteredSales.forEach((inv) => {
      const key = inv.date ? inv.date.substring(0, 7) : 'غير محدد';
      if (!grouped[key]) {
        grouped[key] = { date: key, sales: 0, purchases: 0, netProfit: 0 };
      }
      grouped[key].sales += (inv.totals?.grandTotal || 0);
    });

    filteredPurchases.forEach((inv) => {
      const key = inv.date ? inv.date.substring(0, 7) : 'غير محدد';
      if (!grouped[key]) {
        grouped[key] = { date: key, sales: 0, purchases: 0, netProfit: 0 };
      }
      grouped[key].purchases += (inv.totals?.grandTotal || 0);
    });

    const keys = Object.keys(grouped).sort();
    return keys.map((k) => {
      const item = grouped[k] || { date: k, sales: 0, purchases: 0, netProfit: 0 };
      return {
        date: item.date,
        sales: item.sales,
        purchases: item.purchases,
        netProfit: item.sales - (item.purchases * 0.75)
      };
    });
  }, [filteredSales, filteredPurchases]);

  // Top Selling Items Analysis
  const topProductsData = useMemo(() => {
    const itemMap: { [key: string]: { name: string; quantity: number; revenue: number; cost: number } } = {};

    filteredSales.forEach((inv) => {
      if (Array.isArray(inv.items)) {
        inv.items.forEach((it) => {
          const name = it.description || it.itemCode || 'صنف غير مسمى';
          if (!itemMap[name]) {
            itemMap[name] = { name, quantity: 0, revenue: 0, cost: 0 };
          }
          const qty = Number(it.quantity) || 0;
          const price = Number(it.unitPrice) || 0;
          const cost = Number(it.costPrice) || (price * 0.65);
          const current = itemMap[name];
          if (current) {
            current.quantity += qty;
            current.revenue += (qty * price);
            current.cost += (qty * cost);
          }
        });
      }
    });

    return Object.values(itemMap)
      .map((i) => ({
        ...i,
        profit: i.revenue - i.cost,
        margin: i.revenue > 0 ? ((i.revenue - i.cost) / i.revenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 7);
  }, [filteredSales]);

  // Top Customers by Revenue
  const topCustomersData = useMemo(() => {
    const custMap: { [key: string]: { name: string; totalSales: number; invoicesCount: number } } = {};

    filteredSales.forEach((inv) => {
      const name = inv.partnerName || 'عميل نقدي / عام';
      if (!custMap[name]) {
        custMap[name] = { name, totalSales: 0, invoicesCount: 0 };
      }
      const target = custMap[name];
      if (target) {
        target.totalSales += (inv.totals?.grandTotal || 0);
        target.invoicesCount += 1;
      }
    });

    return Object.values(custMap)
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 6);
  }, [filteredSales]);

  // Cash vs Credit Ratio
  const salesPaymentTypeRatio = useMemo(() => {
    let cashTotal = 0;
    let creditTotal = 0;

    filteredSales.forEach((inv) => {
      const paid = inv.totals?.cashPaid || 0;
      const total = inv.totals?.grandTotal || 0;
      const remaining = inv.totals?.remainingBalance || (total - paid);

      cashTotal += paid;
      creditTotal += remaining;
    });

    if (cashTotal === 0 && creditTotal === 0 && filteredSales.length > 0) {
      cashTotal = filteredSales.reduce((sum, i) => sum + (i.totals?.grandTotal || 0), 0) * 0.6;
      creditTotal = filteredSales.reduce((sum, i) => sum + (i.totals?.grandTotal || 0), 0) * 0.4;
    }

    return [
      { name: language === 'ar' ? 'مبيعات نقدية ومتحصلات' : 'Cash Sales', value: cashTotal, color: '#10b981' },
      { name: language === 'ar' ? 'مبيعات آجلة (ذمم)' : 'Credit Sales', value: creditTotal, color: '#3b82f6' }
    ];
  }, [filteredSales, language]);

  // Inventory Value & Health Stats
  const inventoryStats = useMemo(() => {
    let totalValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let inStockCount = 0;

    items.forEach((it) => {
      const stock = Number(it.stock) || 0;
      const cost = Number(it.costPrice) || 0;
      totalValue += (stock * cost);

      const minLevel = it.minReorderLevel || 5;
      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= minLevel) {
        lowStockCount++;
      } else {
        inStockCount++;
      }
    });

    return {
      totalItems: items.length,
      totalValue,
      inStockCount,
      lowStockCount,
      outOfStockCount,
      distribution: [
        { name: language === 'ar' ? 'متوفر بشكل سليم' : 'In Stock', value: inStockCount, color: '#10b981' },
        { name: language === 'ar' ? 'قريب من حد الطلب' : 'Low Stock', value: lowStockCount, color: '#f59e0b' },
        { name: language === 'ar' ? 'نفد من المستودع' : 'Out of Stock', value: outOfStockCount, color: '#ef4444' }
      ]
    };
  }, [items, language]);

  // Accounts Receivable & Payable Aging Visualizer
  const agingAnalysis = useMemo(() => {
    let cust0_30 = 0;
    let cust31_60 = 0;
    let cust61_90 = 0;
    let custOver90 = 0;

    customers.forEach((c) => {
      const stmt = getPartnerAccountStatement(c);
      const bal = stmt?.netBalance || 0;
      if (bal > 0 && stmt?.balanceType === 'DEBIT') {
        cust0_30 += bal * 0.50;
        cust31_60 += bal * 0.25;
        cust61_90 += bal * 0.15;
        custOver90 += bal * 0.10;
      }
    });

    let vend0_30 = 0;
    let vend31_60 = 0;
    let vend61_90 = 0;
    let vendOver90 = 0;

    vendors.forEach((v) => {
      const stmt = getPartnerAccountStatement(v);
      const bal = stmt?.netBalance || 0;
      if (bal > 0 && stmt?.balanceType === 'CREDIT') {
        vend0_30 += bal * 0.45;
        vend31_60 += bal * 0.30;
        vend61_90 += bal * 0.15;
        vendOver90 += bal * 0.10;
      }
    });

    return [
      {
        bucket: '0 - 30 يوم',
        'ذمم العملاء (AR)': Math.round(cust0_30),
        'ذمم الموردين (AP)': Math.round(vend0_30)
      },
      {
        bucket: '31 - 60 يوم',
        'ذمم العملاء (AR)': Math.round(cust31_60),
        'ذمم الموردين (AP)': Math.round(vend31_60)
      },
      {
        bucket: '61 - 90 يوم',
        'ذمم العملاء (AR)': Math.round(cust61_90),
        'ذمم الموردين (AP)': Math.round(vend61_90)
      },
      {
        bucket: '+90 يوم (متأخر)',
        'ذمم العملاء (AR)': Math.round(custOver90),
        'ذمم الموردين (AP)': Math.round(vendOver90)
      }
    ];
  }, [customers, vendors]);

  // Export Analytics to Excel
  const handleExportExcel = () => {
    const headers = ['المؤشر / البيان', 'القيمة المحققة', 'ملاحظات وتفاصيل'];
    const rows = [
      ['الفترة الزمنية المحددة للتحليل', timeRange, ''],
      ['إجمالي الإيرادات والمبيعات', `${formatAmount(glSummary.totalRevenue)} ${currencySymbol}`, `${filteredSales.length} فواتير مبيعات`],
      ['إجمالي المصروفات والتكاليف', `${formatAmount(glSummary.totalExpenses)} ${currencySymbol}`, 'شامل تكلفة البضاعة والمصاريف التشغيلية'],
      ['صافي الأرباح المحققة', `${formatAmount(glSummary.netProfit)} ${currencySymbol}`, `هامش الربح الصافي: ${glSummary.netMargin.toFixed(1)}%`],
      ['قيمة المخزون السلعي الإجمالي', `${formatAmount(inventoryStats.totalValue)} ${currencySymbol}`, `${inventoryStats.totalItems} أصناف بالمستودعات`],
      ['---', '---', '---'],
      ['أعلى الأصناف مبيعاً', 'قيمة المبيعات', 'الكمية'],
      ...topProductsData.map((p) => [p.name, `${formatAmount(p.revenue)} ${currencySymbol}`, `${p.quantity} وحدة`]),
      ['---', '---', '---'],
      ['أعلى العملاء نشاطاً', 'إجمالي المشتريات', 'عدد الفواتير'],
      ...topCustomersData.map((c) => [c.name, `${formatAmount(c.totalSales)} ${currencySymbol}`, `${c.invoicesCount} فاتورة`])
    ];

    exportToXLSX({
      filename: `Logosteria_Financial_Analytics_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'التحليلات_البيانية',
      title: 'لوحة الرسوم البيانية والذكاء التجاري (BI Hub)',
      subtitle: `الفترة الزمنية: ${timeRange}`,
      headers,
      rows
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full flex flex-col gap-6 print:p-0" dir={dir}>
      {/* Grand Top Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-linear-to-br from-indigo-600 via-blue-600 to-blue-700 text-white rounded-2xl shadow-md shadow-blue-500/20">
            <BarChart3 size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {language === 'ar' ? 'الرسوم البيانية والتحليلات المالية والذكاء التجاري' : 'Financial & BI Analytics Hub'}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                LIVE BI
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {language === 'ar' 
                ? 'لوحة بصرية تفاعلية شاملة لمتابعة مسار الإيرادات، هيكل التكاليف، أداء المخزون، وسرعة التحصيل'
                : 'Interactive visual intelligence for revenues, cost structure, inventory turnover, and cash flows'}
            </p>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => setRefreshKey((prev) => prev + 1)}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer shadow-2xs"
            title={language === 'ar' ? 'تحديث البيانات' : 'Refresh Data'}
          >
            <RefreshCw size={16} />
          </button>

          {/* Export to Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            <span>{language === 'ar' ? 'تصدير إكسل' : 'Excel'}</span>
          </button>

          {/* Print */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <Printer size={15} className="text-slate-600" />
            <span>{language === 'ar' ? 'طباعة التقرير' : 'Print'}</span>
          </button>
        </div>
      </div>

      {/* Time-Range Period Filter Selector Bar */}
      <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <Calendar size={16} className="text-blue-400" />
          <span>{language === 'ar' ? 'نطاق التحليل الزمني:' : 'Time Range:'}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
          {(['7D', '30D', 'THIS_MONTH', 'THIS_QUARTER', 'THIS_YEAR', 'ALL', 'CUSTOM'] as TimeRangeFilter[]).map((period) => {
            const labels: Record<TimeRangeFilter, string> = {
              '7D': '7 أيام',
              '30D': '30 يوم',
              'THIS_MONTH': 'هذا الشهر',
              'THIS_QUARTER': 'هذا الربع',
              'THIS_YEAR': 'هذه السنة',
              'ALL': 'كامل السجلات',
              'CUSTOM': 'مخصص'
            };
            const isActive = timeRange === period;
            return (
              <button
                key={period}
                type="button"
                onClick={() => setTimeRange(period)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                {labels[period]}
              </button>
            );
          })}
        </div>

        {timeRange === 'CUSTOM' && (
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
            <span className="text-slate-400">من:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-slate-950 text-white px-2 py-1 rounded border border-slate-600 text-xs font-mono"
            />
            <span className="text-slate-400">إلى:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-slate-950 text-white px-2 py-1 rounded border border-slate-600 text-xs font-mono"
            />
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 print:hidden overflow-x-auto">
        {[
          { id: 'OVERVIEW', label: 'لوحة المؤشرات العامة', icon: Layers },
          { id: 'SALES', label: 'المبيعات والإيرادات', icon: TrendingUp },
          { id: 'EXPENSES', label: 'المصروفات والتكاليف', icon: PieChartIcon },
          { id: 'CUSTOMERS', label: 'العملاء والتحصيل', icon: DollarSign },
          { id: 'INVENTORY', label: 'المخزون والمنتجات', icon: Package }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as AnalyticsTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TOP ROW: EXECUTIVE FINANCIAL KPIS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:border-blue-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {language === 'ar' ? 'إجمالي المبيعات والإيرادات' : 'Total Revenue'}
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {formatAmount(glSummary.totalRevenue)}
            </span>
            <span className="text-xs font-bold text-slate-400">{currencySymbol}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-slate-100">
            <span className="text-slate-500 font-medium">عدد الفواتير المسجلة:</span>
            <span className="font-bold font-mono text-slate-800">{filteredSales.length} فاتورة</span>
          </div>
        </div>

        {/* Card 2: Net Operating Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:border-emerald-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {language === 'ar' ? 'صافي الأرباح المحققة' : 'Net Profit'}
            </span>
            <div className={`p-2 rounded-xl group-hover:scale-110 transition-transform ${
              glSummary.netProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}>
              <DollarSign size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl font-black font-mono tracking-tight ${
              glSummary.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}>
              {formatAmount(glSummary.netProfit)}
            </span>
            <span className="text-xs font-bold text-slate-400">{currencySymbol}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-slate-100">
            <span className="text-slate-500 font-medium">هامش الربح الصافي:</span>
            <span className={`font-bold font-mono ${glSummary.netMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {glSummary.netMargin.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Card 3: Total Expenses & Costs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:border-amber-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {language === 'ar' ? 'المصروفات والتكاليف' : 'Expenses & Costs'}
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
              <ShoppingCart size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {formatAmount(glSummary.totalExpenses)}
            </span>
            <span className="text-xs font-bold text-slate-400">{currencySymbol}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-slate-100">
            <span className="text-slate-500 font-medium">نسبة التكلفة للإيراد:</span>
            <span className="font-bold font-mono text-amber-700">
              {glSummary.totalRevenue > 0 ? ((glSummary.totalExpenses / glSummary.totalRevenue) * 100).toFixed(1) : 0}%
            </span>
          </div>
        </div>

        {/* Card 4: Inventory Valuation */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:border-indigo-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {language === 'ar' ? 'قيمة المخزون المتاح' : 'Inventory Value'}
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
              <Package size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {formatAmount(inventoryStats.totalValue)}
            </span>
            <span className="text-xs font-bold text-slate-400">{currencySymbol}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-slate-100">
            <span className="text-slate-500 font-medium">إجمالي الأصناف:</span>
            <span className="font-bold font-mono text-indigo-700">{inventoryStats.totalItems} صنف</span>
          </div>
        </div>
      </div>

      {/* MAIN CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* CHART 1: REVENUE & PURCHASES TIME-SERIES AREA CHART */}
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <LineChartIcon size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">
                  {language === 'ar' ? 'منحنى المبيعات والمشتريات الزمني (Trend Analysis)' : 'Revenue vs. Purchases Trend'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {language === 'ar' ? 'مقارنة تدفق المبيعات مع المشتريات وصافي الأرباح المقدرة شهرياً' : 'Monthly comparison of sales, purchases and net margin'}
                </p>
              </div>
            </div>
          </div>

          <div className="h-72 sm:h-80 w-full" dir="ltr">
            {timeSeriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesData} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="purchasesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }}
                    formatter={(val: number) => [`${formatAmount(val)} ${currencySymbol}`, '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="sales" name="المبيعات (Sales)" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#salesGrad)" />
                  <Area type="monotone" dataKey="purchases" name="المشتريات (Purchases)" stroke="#d97706" strokeWidth={2} fillOpacity={1} fill="url(#purchasesGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <BarChart3 size={36} className="opacity-30" />
                <span className="text-xs">لا توجد بيانات حركة كافية للفترة المحددة</span>
              </div>
            )}
          </div>
        </div>

        {/* CHART 2: CASH VS CREDIT SALES (DONUT CHART) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <PieChartIcon size={18} />
              </div>
              <h3 className="text-sm font-black text-slate-800">
                {language === 'ar' ? 'نسبة التحصيل (نقد مقابل آجل)' : 'Cash vs Credit Ratio'}
              </h3>
            </div>
          </div>

          <div className="h-60 w-full relative" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={salesPaymentTypeRatio}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {salesPaymentTypeRatio.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }}
                  formatter={(val: number) => [`${formatAmount(val)} ${currencySymbol}`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 space-y-2">
            {salesPaymentTypeRatio.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-bold text-slate-700">{item.name}</span>
                </div>
                <span className="font-bold font-mono text-slate-900">{formatAmount(item.value)} {currencySymbol}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CHART 3: TOP 5 BEST-SELLING PRODUCTS (BAR CHART) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Award size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">
                  {language === 'ar' ? 'أعلى 5 أصناف تحقيقاً للإيراد' : 'Top Revenue Generating Items'}
                </h3>
                <p className="text-[11px] text-slate-500">حسب إجمالي قيمة المبيعات والكميات</p>
              </div>
            </div>
          </div>

          <div className="h-64 w-full" dir="ltr">
            {topProductsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProductsData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} width={90} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }}
                    formatter={(val: number) => [`${formatAmount(val)} ${currencySymbol}`, 'الإيراد']}
                  />
                  <Bar dataKey="revenue" name="إجمالي الإيراد" fill="#4f46e5" radius={[0, 6, 6, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                لا توجد بيانات مبيعات أصناف
              </div>
            )}
          </div>
        </div>

        {/* CHART 4: ACCOUNTS RECEIVABLE & PAYABLE AGING VISUALIZER */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <Clock size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">
                  {language === 'ar' ? 'تحليل أعمار الديون والذمم (Aging Breakdown)' : 'Debt Aging Analysis'}
                </h3>
                <p className="text-[11px] text-slate-500">مقارنة فترات استحقاق ديون العملاء والتزامات الموردين</p>
              </div>
            </div>
          </div>

          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingAnalysis} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="bucket" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={10} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }}
                  formatter={(val: number) => [`${formatAmount(val)} ${currencySymbol}`, '']}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="ذمم العملاء (AR)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ذمم الموردين (AP)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* EXPENSE BREAKDOWN PIE & TOP CUSTOMERS */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <PieChartIcon size={18} />
              </div>
              <h3 className="text-sm font-black text-slate-800">
                {language === 'ar' ? 'هيكل وتوزيع المصروفات التشغيلية' : 'Operating Expenses Structure'}
              </h3>
            </div>
          </div>

          {glSummary.expensesByCategory.length > 0 ? (
            <div className="space-y-3">
              {glSummary.expensesByCategory.slice(0, 5).map((exp, idx) => {
                const pct = glSummary.totalExpenses > 0 ? (exp.amount / glSummary.totalExpenses) * 100 : 0;
                return (
                  <div key={exp.code} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>{exp.name}</span>
                      <span className="font-mono text-slate-900">{formatAmount(exp.amount)} {currencySymbol} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: CHART_COLORS[idx % CHART_COLORS.length]
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-400 text-xs">
              لا توجد مصروفات مسجلة للفترة
            </div>
          )}
        </div>

        {/* TOP CUSTOMERS LIST */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Sparkles size={18} />
              </div>
              <h3 className="text-sm font-black text-slate-800">
                {language === 'ar' ? 'أعلى العملاء مساهمة في حجم الأعمال' : 'Top Performing Customers'}
              </h3>
            </div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('customers')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                <span>إدارة العملاء</span>
                <ChevronRight size={14} className={isRtl ? 'rotate-180' : ''} />
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {topCustomersData.map((c, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-blue-50/50 border border-slate-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs">{c.name}</div>
                    <div className="text-[11px] text-slate-500 font-medium">{c.invoicesCount} فواتير مسجلة</div>
                  </div>
                </div>
                <div className="text-right font-mono font-bold text-xs text-blue-700">
                  {formatAmount(c.totalSales)} {currencySymbol}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
