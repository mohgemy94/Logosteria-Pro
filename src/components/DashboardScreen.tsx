import { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Activity, 
  CreditCard, 
  Users as UsersIcon, 
  Warehouse, 
  Scale, 
  DollarSign, 
  Calendar, 
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Building2,
  Award,
  Factory
} from 'lucide-react';
import DashboardAlertsCenter from './DashboardAlertsCenter';
import { SystemSettings } from '../types/accounting';
import { useSystemCurrency } from '../utils/currency';
import { 
  DB_SALES_INVOICES_KEY, 
  DB_PURCHASES_INVOICES_KEY, 
  DB_PAYMENT_VOUCHERS_KEY 
} from '../utils/sequences';

interface DashboardScreenProps {
  onNavigate: (view: string) => void;
  systemSettings: SystemSettings;
}

// Default monthly dataset for 12 months (2026 / Fiscal Year)
const DEFAULT_MONTHLY_DATA = [
  { month: 'يناير', monthEn: 'Jan', sales: 185000, expenses: 95000, inventoryValue: 420000, netProfit: 90000 },
  { month: 'فبراير', monthEn: 'Feb', sales: 195000, expenses: 102000, inventoryValue: 435000, netProfit: 93000 },
  { month: 'مارس', monthEn: 'Mar', sales: 210000, expenses: 110000, inventoryValue: 450000, netProfit: 100000 },
  { month: 'أبريل', monthEn: 'Apr', sales: 205000, expenses: 98000, inventoryValue: 440000, netProfit: 107000 },
  { month: 'مايو', monthEn: 'May', sales: 228000, expenses: 115000, inventoryValue: 465000, netProfit: 113000 },
  { month: 'يونيو', monthEn: 'Jun', sales: 240000, expenses: 122000, inventoryValue: 480000, netProfit: 118000 },
  { month: 'يوليو', monthEn: 'Jul', sales: 232000, expenses: 108000, inventoryValue: 472000, netProfit: 124000 },
  { month: 'أغسطس', monthEn: 'Aug', sales: 255000, expenses: 119000, inventoryValue: 495000, netProfit: 136000 },
  { month: 'سبتمبر', monthEn: 'Sep', sales: 245000, expenses: 112400, inventoryValue: 490000, netProfit: 132600 },
  { month: 'أكتوبر', monthEn: 'Oct', sales: 260000, expenses: 125000, inventoryValue: 510000, netProfit: 135000 },
  { month: 'نوفمبر', monthEn: 'Nov', sales: 275000, expenses: 130000, inventoryValue: 525000, netProfit: 145000 },
  { month: 'ديسمبر', monthEn: 'Dec', sales: 290000, expenses: 138000, inventoryValue: 540000, netProfit: 152000 }
];

// Default category distribution
const DEFAULT_CATEGORY_DATA = [
  { category: 'إلكترونيات وأجهزة', sales: 98000, expenses: 48000, inventoryValue: 195000, units: 142 },
  { category: 'مواد غذائية وتموينية', sales: 68000, expenses: 32000, inventoryValue: 135000, units: 620 },
  { category: 'أثاث ومستلزمات مكتبية', sales: 42000, expenses: 18500, inventoryValue: 88000, units: 85 },
  { category: 'قطع غيار وصيانة', sales: 24000, expenses: 9800, inventoryValue: 46000, units: 210 },
  { category: 'مواد تغليف واستهلاكيات', sales: 13000, expenses: 4100, inventoryValue: 26000, units: 350 }
];

export default function DashboardScreen({ onNavigate, systemSettings }: DashboardScreenProps) {
  const { symbol: currencySymbol } = useSystemCurrency();

  // Filters for the Trend Line Chart
  const [trendRange, setTrendRange] = useState<'6m' | '12m' | 'q3'>('12m');
  const [visibleLines, setVisibleLines] = useState<{ sales: boolean; expenses: boolean; inventory: boolean }>({
    sales: true,
    expenses: true,
    inventory: true
  });

  // Filter for Categorical Bar Chart
  const [categoryMetric, setCategoryMetric] = useState<'all' | 'sales_vs_expenses' | 'inventory'>('all');

  // Compute live warehouse valuation if present in localStorage
  const currentInventoryStats = useMemo(() => {
    if (typeof window === 'undefined') return { totalValuation: 490000, totalUnits: 1407 };
    try {
      const savedWh = localStorage.getItem('alpha_warehouse_balances_v2');
      if (savedWh) {
        const parsed = JSON.parse(savedWh);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const totalValuation = parsed.reduce((sum: number, item: any) => sum + (Number(item.stock || 0) * Number(item.costPrice || 0)), 0);
          const totalUnits = parsed.reduce((sum: number, item: any) => sum + Number(item.stock || 0), 0);
          return { totalValuation, totalUnits };
        }
      }
    } catch {
      // fallback
    }
    return { totalValuation: 490000, totalUnits: 1407 };
  }, []);

  // Compute live sales & expenses stats
  const financialTotals = useMemo(() => {
    let recordedSales = 0;
    let recordedExpenses = 0;

    if (typeof window !== 'undefined') {
      try {
        const salesData = localStorage.getItem(DB_SALES_INVOICES_KEY);
        if (salesData) {
          const parsed = JSON.parse(salesData);
          if (Array.isArray(parsed)) {
            recordedSales = parsed.reduce((sum: number, inv: any) => sum + (inv.totals?.grandTotal || inv.total || 0), 0);
          }
        }

        const purchasesData = localStorage.getItem(DB_PURCHASES_INVOICES_KEY);
        if (purchasesData) {
          const parsed = JSON.parse(purchasesData);
          if (Array.isArray(parsed)) {
            recordedExpenses += parsed.reduce((sum: number, inv: any) => sum + (inv.totals?.grandTotal || inv.total || 0), 0);
          }
        }

        const paymentVouchers = localStorage.getItem(DB_PAYMENT_VOUCHERS_KEY);
        if (paymentVouchers) {
          const parsed = JSON.parse(paymentVouchers);
          if (Array.isArray(parsed)) {
            recordedExpenses += parsed.reduce((sum: number, v: any) => sum + (v.amount || 0), 0);
          }
        }
      } catch {
        // ignore
      }
    }

    const currentMonthSales = recordedSales > 0 ? recordedSales : 245000;
    const currentMonthExpenses = recordedExpenses > 0 ? recordedExpenses : 112400;
    const currentMonthProfit = currentMonthSales - currentMonthExpenses;
    const profitMargin = currentMonthSales > 0 ? (currentMonthProfit / currentMonthSales) * 100 : 0;

    return {
      sales: currentMonthSales,
      expenses: currentMonthExpenses,
      profit: currentMonthProfit,
      margin: profitMargin
    };
  }, []);

  // Filtered monthly trend data
  const filteredTrendData = useMemo(() => {
    let data = [...DEFAULT_MONTHLY_DATA];

    // Inject live current inventory valuation into recent months
    data = data.map((d, idx) => {
      if (idx >= 8) {
        return {
          ...d,
          inventoryValue: currentInventoryStats.totalValuation || d.inventoryValue
        };
      }
      return d;
    });

    if (trendRange === '6m') {
      return data.slice(6); // Last 6 months (Jul - Dec)
    }
    if (trendRange === 'q3') {
      return data.slice(6, 9); // Q3 (Jul, Aug, Sep)
    }
    return data;
  }, [trendRange, currentInventoryStats]);

  // Format currency helpers for charts
  const formatNumber = (val: number) => {
    if (val >= 1000000) {
      return `${(val / 1000000).toFixed(1)}M`;
    }
    if (val >= 1000) {
      return `${(val / 1000).toFixed(0)}k`;
    }
    return val.toString();
  };

  const CustomLineTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[210px] backdrop-blur-sm" dir="rtl">
          <p className="font-bold text-slate-300 pb-2 mb-2 border-b border-slate-700 flex items-center justify-between">
            <span>شهر {label}</span>
            <span className="text-[10px] text-slate-400 font-mono">2026</span>
          </p>
          <div className="space-y-1.5 font-medium">
            {payload.map((entry: any, index: number) => (
              <div key={`item-${index}`} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
                  <span>{entry.name}:</span>
                </span>
                <span className="font-mono font-bold text-white">
                  {Number(entry.value).toLocaleString()} {currencySymbol}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[220px] backdrop-blur-sm" dir="rtl">
          <p className="font-bold text-blue-300 pb-2 mb-2 border-b border-slate-700">
            {label}
          </p>
          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => (
              <div key={`item-${index}`} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
                  <span>{entry.name}:</span>
                </span>
                <span className="font-mono font-bold text-white">
                  {Number(entry.value).toLocaleString()} {currencySymbol}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800">لوحة المؤشرات المالية والمخزنية</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ملخص بياني تفاعلي للمبيعات الشهرية والمصروفات وحركة تقييم رأس مال المخزون
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('companyProfile')}
            className="text-xs font-bold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <Building2 size={14} className="text-amber-600" />
            <span>الواجهة الرئيسية (بيانات الشركة)</span>
          </button>
          <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5">
            <Calendar size={14} className="text-blue-600" />
            <span>السنة المالية: {systemSettings.financial.fiscalYear}</span>
          </span>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="text-xs font-bold text-slate-600 hover:text-blue-600 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs"
          >
            تعديل العملة والإعدادات
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sales Card */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 hover:border-emerald-300 transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">إجمالي المبيعات (الشهر)</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <TrendingUp size={18} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl md:text-3xl font-mono font-bold text-slate-800">
                {financialTotals.sales.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-slate-400">{currencySymbol}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold mt-2">
              <ArrowUpRight size={15} />
              <span>+12.4% عن الشهر السابق</span>
            </div>
          </div>
        </div>

        {/* Expenses Card */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 hover:border-rose-300 transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">إجمالي المصروفات والمشتريات</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Activity size={18} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl md:text-3xl font-mono font-bold text-slate-800">
                {financialTotals.expenses.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-slate-400">{currencySymbol}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold mt-2">
              <ArrowDownRight size={15} />
              <span>-3.8% انخفاض في التكاليف التشغيلية</span>
            </div>
          </div>
        </div>

        {/* Inventory Valuation Card */}
        <div 
          onClick={() => onNavigate('warehouseBalances')}
          className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 hover:border-blue-400 transition-all flex flex-col justify-between group cursor-pointer"
          title="انقر لفتح أرصدة المخزن"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500">تقييم رأس مال المخزون</span>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">STK</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Warehouse size={18} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl md:text-3xl font-mono font-bold text-blue-700">
                {currentInventoryStats.totalValuation.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-slate-400">{currencySymbol}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
              <span>{currentInventoryStats.totalUnits.toLocaleString()} قطعة بالمستودعات</span>
              <span className="text-blue-600 font-bold group-hover:underline">عرض البطاقات ←</span>
            </div>
          </div>
        </div>

        {/* Net Profit Margin Card */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 hover:border-indigo-300 transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">صافي الربح التقديري (الشهر)</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <DollarSign size={18} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl md:text-3xl font-mono font-bold text-slate-800">
                {financialTotals.profit.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-slate-400">{currencySymbol}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold mt-2">
              <span className="bg-indigo-50 px-2 py-0.5 rounded-full">
                هامش الربح: {financialTotals.margin.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Alerts & Control Center (Low Stock below Reorder Point & Below Cost Invoices) */}
      <DashboardAlertsCenter onNavigate={onNavigate} />

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 1. LINE CHART: Monthly Sales, Expenses & Inventory Value Trends */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            {/* Chart Header with Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <h3 className="text-base font-bold text-slate-800">مسار المبيعات والمصروفات والمخزون</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  رسم بياني خطي (Line Chart) يوضح تطور الإيرادات والتكاليف وتقييم البضاعة شهرياً
                </p>
              </div>

              {/* Time Horizon Selector */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold shrink-0">
                <button
                  type="button"
                  onClick={() => setTrendRange('6m')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    trendRange === '6m' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  6 أشهر
                </button>
                <button
                  type="button"
                  onClick={() => setTrendRange('12m')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    trendRange === '12m' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  سنة كاملة (12 شهر)
                </button>
                <button
                  type="button"
                  onClick={() => setTrendRange('q3')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    trendRange === 'q3' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  الربع الثالث
                </button>
              </div>
            </div>

            {/* Metric Toggle Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
              <span className="text-slate-400 text-[11px] font-medium ml-1">تحديد الخطوط المعروضة:</span>
              <button
                type="button"
                onClick={() => setVisibleLines(prev => ({ ...prev, sales: !prev.sales }))}
                className={`px-2.5 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1.5 font-bold ${
                  visibleLines.sales 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                    : 'bg-slate-50 text-slate-400 border-slate-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                المبيعات
              </button>

              <button
                type="button"
                onClick={() => setVisibleLines(prev => ({ ...prev, expenses: !prev.expenses }))}
                className={`px-2.5 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1.5 font-bold ${
                  visibleLines.expenses 
                    ? 'bg-rose-50 text-rose-700 border-rose-300' 
                    : 'bg-slate-50 text-slate-400 border-slate-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                المصروفات
              </button>

              <button
                type="button"
                onClick={() => setVisibleLines(prev => ({ ...prev, inventory: !prev.inventory }))}
                className={`px-2.5 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1.5 font-bold ${
                  visibleLines.inventory 
                    ? 'bg-blue-50 text-blue-700 border-blue-300' 
                    : 'bg-slate-50 text-slate-400 border-slate-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                قيمة المخزون
              </button>
            </div>

            {/* Recharts Line Chart Container */}
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={filteredTrendData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    stroke="#94a3b8" 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={formatNumber}
                    tickLine={false}
                    axisLine={false}
                    orientation="right"
                  />
                  <Tooltip content={<CustomLineTooltip />} />
                  <Legend 
                    verticalAlign="top" 
                    align="left" 
                    height={32}
                    iconType="circle"
                    formatter={(value) => <span className="text-xs text-slate-600 font-medium mr-1">{value}</span>}
                  />

                  {visibleLines.inventory && (
                    <Line
                      type="monotone"
                      name="قيمة المخزون"
                      dataKey="inventoryValue"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#2563eb' }}
                      activeDot={{ r: 6, fill: '#1d4ed8', stroke: '#fff', strokeWidth: 2 }}
                    />
                  )}

                  {visibleLines.sales && (
                    <Line
                      type="monotone"
                      name="المبيعات"
                      dataKey="sales"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#10b981' }}
                      activeDot={{ r: 6, fill: '#059669', stroke: '#fff', strokeWidth: 2 }}
                    />
                  )}

                  {visibleLines.expenses && (
                    <Line
                      type="monotone"
                      name="المصروفات"
                      dataKey="expenses"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3, fill: '#f43f5e' }}
                      activeDot={{ r: 6, fill: '#e11d48', stroke: '#fff', strokeWidth: 2 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1 text-[11px]">
              <Info size={13} className="text-blue-500" />
              <span>المبالغ المعروضة تشمل التقديرات التراكمية بالعملة المحلية ({currencySymbol})</span>
            </span>
            <span className="font-mono text-[11px] text-slate-500">محدث تلقائياً</span>
          </div>
        </div>

        {/* 2. BAR CHART: Categorical Comparisons */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            {/* Chart Header with Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                  <h3 className="text-base font-bold text-slate-800">المقارنة حسب التصنيفات السلعية</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  رسم بياني بالأعمدة (Bar Chart) لمقارنة المبيعات والمصروفات والمخزون لكل قطاع
                </p>
              </div>

              {/* View Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold shrink-0">
                <button
                  type="button"
                  onClick={() => setCategoryMetric('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    categoryMetric === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  مقارنة شاملة
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryMetric('sales_vs_expenses')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    categoryMetric === 'sales_vs_expenses' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  مبيعات / تكلفة
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryMetric('inventory')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    categoryMetric === 'inventory' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  قيمة المخزون
                </button>
              </div>
            </div>

            {/* Metric Insight Banner */}
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200/70 px-3.5 py-2 rounded-xl mb-4 text-xs">
              <span className="text-slate-600">
                القطاع الأعلى مبيعاً وقيمة: <strong className="text-slate-900">إلكترونيات وأجهزة</strong>
              </span>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                40% من إجمالي الإيرادات
              </span>
            </div>

            {/* Recharts Bar Chart Container */}
            <div className="h-72 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={DEFAULT_CATEGORY_DATA}
                  margin={{ top: 10, right: 10, left: 10, bottom: 15 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis 
                    dataKey="category" 
                    stroke="#94a3b8" 
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={formatNumber}
                    tickLine={false}
                    axisLine={false}
                    orientation="right"
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Legend 
                    verticalAlign="top" 
                    align="left" 
                    height={32}
                    iconType="circle"
                    formatter={(value) => <span className="text-xs text-slate-600 font-medium mr-1">{value}</span>}
                  />

                  {(categoryMetric === 'all' || categoryMetric === 'sales_vs_expenses') && (
                    <Bar 
                      name="المبيعات" 
                      dataKey="sales" 
                      fill="#10b981" 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={32}
                    />
                  )}

                  {(categoryMetric === 'all' || categoryMetric === 'sales_vs_expenses') && (
                    <Bar 
                      name="المصروفات والتكلفة" 
                      dataKey="expenses" 
                      fill="#f43f5e" 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={32}
                    />
                  )}

                  {(categoryMetric === 'all' || categoryMetric === 'inventory') && (
                    <Bar 
                      name="رأس مال المخزون" 
                      dataKey="inventoryValue" 
                      fill="#3b82f6" 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={32}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1 text-[11px]">
              <Layers size={13} className="text-indigo-500" />
              <span>مقارنة قطاعية تشمل كافة الأصناف المعتمدة بالنظام</span>
            </span>
            <button
              type="button"
              onClick={() => onNavigate('items')}
              className="text-indigo-600 hover:text-indigo-700 font-bold hover:underline"
            >
              إدارة الأصناف ←
            </button>
          </div>
        </div>

      </div>

      {/* QUICK ACTIONS & MODULE CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-2">
        {/* Installments & Promissory Notes Card */}
        <div 
          onClick={() => onNavigate('installments')}
          className="bg-gradient-to-br from-emerald-900 via-slate-900 to-emerald-950 text-white p-5 rounded-2xl shadow-md border border-emerald-700/50 hover:border-emerald-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">التمويل والائتمان</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-600/40 text-emerald-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CreditCard size={17} />
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">التقسيط والكمبيالات</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              عقود البيع بالتقسيط، جداول الاستهلاك، محفظة الكمبيالات والسندات لأمر، وإيصالات السداد.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-emerald-300 font-semibold group-hover:text-white">
            <span>فتح شاشة التقسيط ←</span>
            <span className="bg-emerald-500/30 px-2 py-0.5 rounded text-[10px] text-white">كمبيالات وسندات</span>
          </div>
        </div>

        {/* Manufacturing & BOM Card */}
        <div 
          onClick={() => onNavigate('manufacturing')}
          className="bg-gradient-to-br from-blue-900 via-slate-900 to-cyan-950 text-white p-5 rounded-2xl shadow-md border border-cyan-700/50 hover:border-cyan-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">التصنيع والتكاليف</span>
              <div className="w-8 h-8 rounded-xl bg-cyan-600/40 text-cyan-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Factory size={17} />
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">التصنيع وأوامر التشغيل (BOM)</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              معايير المنتجات (BOM)، أوامر الإنتاج، حساب تكاليف المواد والأجور، ومراقبة الجودة.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-cyan-300 font-semibold group-hover:text-white">
            <span>فتح شاشة التصنيع ←</span>
            <span className="bg-cyan-500/30 px-2 py-0.5 rounded text-[10px] text-white">أوامر تشغيل وهياكل تكلفة</span>
          </div>
        </div>

        {/* Warehouse Balances Card */}
        <div 
          onClick={() => onNavigate('warehouseBalances')}
          className="bg-gradient-to-br from-blue-900 via-slate-900 to-blue-950 text-white p-5 rounded-2xl shadow-md border border-blue-700/50 hover:border-blue-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300">المخزون والمستودعات</span>
              <div className="w-8 h-8 rounded-xl bg-blue-600/40 text-blue-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Warehouse size={17} />
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">أرصدة المخزن</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              بطاقات المخزن الذكية: إجمالي البضاعة، النواقص، البضاعة الراكدة، وتقييم رأس المال.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-blue-300 font-semibold group-hover:text-white">
            <span>فتح بطاقات المخزن ←</span>
            <span className="bg-blue-500/30 px-2 py-0.5 rounded text-[10px] text-white">8 بطاقات تفاعلية</span>
          </div>
        </div>

        {/* Partner Balances Card */}
        <div 
          onClick={() => onNavigate('partnerBalances')}
          className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white p-5 rounded-2xl shadow-md border border-indigo-700/50 hover:border-indigo-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">الذمم المالية</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-600/40 text-indigo-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Scale size={17} />
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">أرصدة العملاء والموردين</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              متابعة الأرصدة الدائنة والمدينة، إجمالي مسحوبات ومدفوعات الجميع، وكشوف الحسابات.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-indigo-300 font-semibold group-hover:text-white">
            <span>فتح شاشة الذمم ←</span>
            <span className="bg-indigo-500/30 px-2 py-0.5 rounded text-[10px] text-white">دائنون ومدينون</span>
          </div>
        </div>

        {/* Customers Card */}
        <div 
          onClick={() => onNavigate('customers')}
          className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">إدارة الحسابات</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UsersIcon size={17} />
              </div>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">العملاء والمبيعات</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              تسجيل بيانات العملاء، إصدار فواتير المبيعات، ومتابعة سندات القبض.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-blue-600 font-semibold group-hover:text-blue-700">
            <span>فتح شاشة العملاء ←</span>
            <span className="text-slate-400 text-[10px]">فواتير وتحصيل</span>
          </div>
        </div>

        {/* Vendors Card */}
        <div 
          onClick={() => onNavigate('vendors')}
          className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-purple-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">سلاسل الإمداد</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CreditCard size={17} />
              </div>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">الموردون والمشتريات</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              إدارة بيانات الموردين، فواتير أوامر الشراء، وجدولة سندات الصرف والسداد.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-purple-600 font-semibold group-hover:text-purple-700">
            <span>فتح شاشة الموردين ←</span>
            <span className="text-slate-400 text-[10px]">توريدات والتزامات</span>
          </div>
        </div>

        {/* HR & Payroll Card */}
        <div 
          onClick={() => onNavigate('payroll')}
          className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-amber-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">الموارد البشرية</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Award size={17} />
              </div>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">الموظفون ومسيرات الأجور</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              إدارة الرواتب الأساسية، البدلات، المكافآت وحوافز التارجت، الخصومات وقسائم الراتب.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-amber-600 font-semibold group-hover:text-amber-700">
            <span>فتح شاشة الموظفين والرواتب ←</span>
            <span className="text-slate-400 text-[10px]">مسيرات وقسائم</span>
          </div>
        </div>
      </div>
    </div>
  );
}
