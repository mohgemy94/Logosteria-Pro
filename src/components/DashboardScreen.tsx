import { useState, useMemo, useEffect } from 'react';
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
  Factory,
  CheckCircle2,
  BarChart3,
  BookOpen,
  Landmark,
  AlertTriangle
} from 'lucide-react';
import DashboardAlertsCenter from './DashboardAlertsCenter';
import ItemAnalyticsModal from './ItemAnalyticsModal';
import { SystemSettings } from '../types/accounting';
import { useSystemCurrency } from '../utils/currency';
import { calculateTrialBalance, computeDashboardKPIsLocally } from '../utils/trialBalanceStore';
import { loadBankChecks, getCheckStats } from '../utils/checkStore';
import { 
  DB_SALES_INVOICES_KEY, 
  DB_PURCHASES_INVOICES_KEY, 
  DB_PAYMENT_VOUCHERS_KEY,
  DB_ITEMS_KEY
} from '../utils/sequences';
import { getSelectedBrowsingYear, FISCAL_YEAR_CHANGED_EVENT } from '../utils/fiscalYearArchive';

interface DashboardScreenProps {
  onNavigate: (view: string) => void;
  systemSettings: SystemSettings;
}

export default function DashboardScreen({ onNavigate, systemSettings }: DashboardScreenProps) {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [dataVersion, setDataVersion] = useState(0);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);

  // Filters for the Trend Line Chart
  const [trendRange, setTrendRange] = useState<'6m' | '12m' | 'q3'>('12m');
  const [visibleLines, setVisibleLines] = useState<{ sales: boolean; expenses: boolean; inventory: boolean }>({
    sales: true,
    expenses: true,
    inventory: true
  });

  // Filter for Categorical Bar Chart
  const [categoryMetric, setCategoryMetric] = useState<'all' | 'sales_vs_expenses' | 'inventory'>('all');

  // Listen to reset and data change events across the application
  useEffect(() => {
    const handleDataRefresh = () => {
      setDataVersion(v => v + 1);
    };

    window.addEventListener('storage', handleDataRefresh);
    window.addEventListener('alpha-data-changed', handleDataRefresh);
    window.addEventListener('alpha-system-reset-completed', handleDataRefresh);
    window.addEventListener('alpha-partner-ledger-updated', handleDataRefresh);
    window.addEventListener('alpha-items-updated', handleDataRefresh);
    window.addEventListener('alpha-settings-updated', handleDataRefresh);
    window.addEventListener('accounting-data-changed', handleDataRefresh);
    window.addEventListener('alpha-checks-updated', handleDataRefresh);

    const handleFiscalYearChanged = () => {
      setSelectedYear(getSelectedBrowsingYear());
      setDataVersion(v => v + 1);
    };
    window.addEventListener(FISCAL_YEAR_CHANGED_EVENT, handleFiscalYearChanged);

    return () => {
      window.removeEventListener('storage', handleDataRefresh);
      window.removeEventListener('alpha-data-changed', handleDataRefresh);
      window.removeEventListener('alpha-system-reset-completed', handleDataRefresh);
      window.removeEventListener('alpha-partner-ledger-updated', handleDataRefresh);
      window.removeEventListener('alpha-items-updated', handleDataRefresh);
      window.removeEventListener('alpha-settings-updated', handleDataRefresh);
      window.removeEventListener('accounting-data-changed', handleDataRefresh);
      window.removeEventListener('alpha-checks-updated', handleDataRefresh);
      window.removeEventListener(FISCAL_YEAR_CHANGED_EVENT, handleFiscalYearChanged);
    };
  }, []);

  const checkStats = useMemo(() => {
    return getCheckStats(loadBankChecks());
  }, [dataVersion]);

  // Compute live warehouse valuation from localStorage (strictly 0 if reset or empty)
  const currentInventoryStats = useMemo(() => {
    if (typeof window === 'undefined') return { totalValuation: 0, totalUnits: 0 };
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

      const savedItems = localStorage.getItem(DB_ITEMS_KEY);
      if (savedItems) {
        const parsed = JSON.parse(savedItems);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const totalValuation = parsed.reduce((sum: number, item: any) => sum + (Number(item.stock || 0) * Number(item.costPrice || 0)), 0);
          const totalUnits = parsed.reduce((sum: number, item: any) => sum + Number(item.stock || 0), 0);
          return { totalValuation, totalUnits };
        }
      }
    } catch {
      // fallback
    }
    return { totalValuation: 0, totalUnits: 0 };
  }, [dataVersion]);

  // Compute live sales & expenses stats directly from storage (strictly 0 if reset)
  
  const [financialTotals, setFinancialTotals] = useState({
    sales: 0,
    expenses: 0,
    netProfit: 0,
    inventoryValuation: 0,
    cashAndBank: 0,
    accountsReceivable: 0,
    accountsPayable: 0
  });
  const [selectedYear, setSelectedYear] = useState(() => getSelectedBrowsingYear());
  const [isLoadingKPIs, setIsLoadingKPIs] = useState(false);

  useEffect(() => {
    const fetchKPIs = async () => {
      setIsLoadingKPIs(true);
      let totals = null;

      try {
        const res = await fetch('/api/dashboard/kpis?year=' + selectedYear, { headers: { 'Accept': 'application/json' } });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const json = await res.json();
          if (json && json.success && json.data) {
            totals = {
              sales: json.data.totalSales ?? json.data.sales ?? 0,
              expenses: json.data.totalExpenses ?? json.data.expenses ?? 0,
              netProfit: json.data.netProfit ?? 0,
              inventoryValuation: json.data.inventoryValuation ?? 0,
              cashAndBank: json.data.cashAndBank ?? 0,
              accountsReceivable: json.data.accountsReceivable ?? 0,
              accountsPayable: json.data.accountsPayable ?? 0
            };
          }
        }
      } catch {
        // Fetch endpoint not active or not returning JSON; fall back silently to local calculation
      }

      if (!totals) {
        totals = computeDashboardKPIsLocally(selectedYear);
      }

      setFinancialTotals(totals);
      setIsLoadingKPIs(false);
    };
    fetchKPIs();
  }, [selectedYear, dataVersion]);


  // Compute live Trial Balance Stats
  const trialBalanceStats = useMemo(() => {
    return calculateTrialBalance();
  }, [dataVersion]);

  // Filtered monthly trend data generated dynamically from actual invoices
  const filteredTrendData = useMemo(() => {
    const MONTHS = [
      { month: 'يناير', monthEn: 'Jan', m: 0 },
      { month: 'فبراير', monthEn: 'Feb', m: 1 },
      { month: 'مارس', monthEn: 'Mar', m: 2 },
      { month: 'أبريل', monthEn: 'Apr', m: 3 },
      { month: 'مايو', monthEn: 'May', m: 4 },
      { month: 'يونيو', monthEn: 'Jun', m: 5 },
      { month: 'يوليو', monthEn: 'Jul', m: 6 },
      { month: 'أغسطس', monthEn: 'Aug', m: 7 },
      { month: 'سبتمبر', monthEn: 'Sep', m: 8 },
      { month: 'أكتوبر', monthEn: 'Oct', m: 9 },
      { month: 'نوفمبر', monthEn: 'Nov', m: 10 },
      { month: 'ديسمبر', monthEn: 'Dec', m: 11 }
    ];

    let salesInvoices: any[] = [];
    let purchasesInvoices: any[] = [];
    let paymentVouchers: any[] = [];

    if (typeof window !== 'undefined') {
      try {
        const s = localStorage.getItem(DB_SALES_INVOICES_KEY);
        if (s) salesInvoices = JSON.parse(s) || [];
        const p = localStorage.getItem(DB_PURCHASES_INVOICES_KEY);
        if (p) purchasesInvoices = JSON.parse(p) || [];
        const v = localStorage.getItem(DB_PAYMENT_VOUCHERS_KEY);
        if (v) paymentVouchers = JSON.parse(v) || [];
      } catch {}
    }

    const getMonthIdx = (dStr?: string) => {
      if (!dStr) return -1;
      const d = new Date(dStr);
      return isNaN(d.getTime()) ? -1 : d.getMonth();
    };

    let data = MONTHS.map(mItem => {
      const mSales = salesInvoices
        .filter(inv => getMonthIdx(inv.date || inv.createdAt) === mItem.m)
        .reduce((sum, inv) => sum + (inv.totals?.grandTotal || inv.total || 0), 0);

      const mPurchases = purchasesInvoices
        .filter(inv => getMonthIdx(inv.date || inv.createdAt) === mItem.m)
        .reduce((sum, inv) => sum + (inv.totals?.grandTotal || inv.total || 0), 0);

      const mVouchers = paymentVouchers
        .filter(v => getMonthIdx(v.date || v.createdAt) === mItem.m)
        .reduce((sum, v) => sum + (v.amount || 0), 0);

      const mExpenses = mPurchases + mVouchers;
      const mNetProfit = mSales - mExpenses;
      const mInvVal = (mSales > 0 || mExpenses > 0)
        ? currentInventoryStats.totalValuation
        : (currentInventoryStats.totalValuation > 0 && mItem.m === 8 ? currentInventoryStats.totalValuation : 0);

      return {
        month: mItem.month,
        monthEn: mItem.monthEn,
        sales: mSales,
        expenses: mExpenses,
        inventoryValue: mInvVal,
        netProfit: mNetProfit
      };
    });

    if (trendRange === '6m') {
      return data.slice(6); // Last 6 months (Jul - Dec)
    }
    if (trendRange === 'q3') {
      return data.slice(6, 9); // Q3 (Jul, Aug, Sep)
    }
    return data;
  }, [trendRange, currentInventoryStats, dataVersion]);

  // Categorical Data computed from real items store and recorded invoices
  const liveCategoryData = useMemo(() => {
    let items: any[] = [];
    let salesInvoices: any[] = [];
    let purchasesInvoices: any[] = [];

    if (typeof window !== 'undefined') {
      try {
        const rawItems = localStorage.getItem(DB_ITEMS_KEY);
        if (rawItems) items = JSON.parse(rawItems) || [];
        const rawSales = localStorage.getItem(DB_SALES_INVOICES_KEY);
        if (rawSales) salesInvoices = JSON.parse(rawSales) || [];
        const rawPurchases = localStorage.getItem(DB_PURCHASES_INVOICES_KEY);
        if (rawPurchases) purchasesInvoices = JSON.parse(rawPurchases) || [];
      } catch {}
    }

    if (items.length === 0 && salesInvoices.length === 0 && purchasesInvoices.length === 0) {
      return [];
    }

    const catMap: Record<string, { category: string; sales: number; expenses: number; inventoryValue: number; units: number }> = {};

    items.forEach(it => {
      const cat = it.category || 'عام';
      if (!catMap[cat]) {
        catMap[cat] = { category: cat, sales: 0, expenses: 0, inventoryValue: 0, units: 0 };
      }
      catMap[cat].units += Number(it.stock || 0);
      catMap[cat].inventoryValue += (Number(it.stock || 0) * Number(it.costPrice || 0));
    });

    salesInvoices.forEach(inv => {
      if (Array.isArray(inv.items)) {
        inv.items.forEach((line: any) => {
          const matchedItem = items.find(i => i.id === line.itemId || i.code === line.itemCode);
          const cat = matchedItem?.category || 'عام';
          if (!catMap[cat]) {
            catMap[cat] = { category: cat, sales: 0, expenses: 0, inventoryValue: 0, units: 0 };
          }
          catMap[cat].sales += (Number(line.quantity || 0) * Number(line.unitPrice || 0));
        });
      }
    });

    purchasesInvoices.forEach(inv => {
      if (Array.isArray(inv.items)) {
        inv.items.forEach((line: any) => {
          const matchedItem = items.find(i => i.id === line.itemId || i.code === line.itemCode);
          const cat = matchedItem?.category || 'عام';
          if (!catMap[cat]) {
            catMap[cat] = { category: cat, sales: 0, expenses: 0, inventoryValue: 0, units: 0 };
          }
          catMap[cat].expenses += (Number(line.quantity || 0) * Number(line.unitPrice || 0));
        });
      }
    });

    return Object.values(catMap);
  }, [dataVersion]);

  const topCategory = useMemo(() => {
    if (liveCategoryData.length === 0) return null;
    return [...liveCategoryData].sort((a, b) => (b.sales + b.inventoryValue) - (a.sales + a.inventoryValue))[0];
  }, [liveCategoryData]);

  const isSystemZeroed = financialTotals.sales === 0 && financialTotals.expenses === 0 && currentInventoryStats.totalValuation === 0;

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
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="border border-slate-200 bg-white rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500 shadow-sm"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>السنة المالية {y}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => onNavigate('analytics')}
            className="btn-3d btn-3d-blue px-3.5 py-1.5 text-xs font-black flex items-center gap-1.5"
          >
            <BarChart3 size={14} />
            <span>الرسوم البيانية والذكاء التجاري (BI)</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('companyProfile')}
            className="btn-3d btn-3d-amber px-3.5 py-1.5 text-xs font-black flex items-center gap-1.5"
          >
            <Building2 size={14} />
            <span>الواجهة الرئيسية (بيانات الشركة)</span>
          </button>
          <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5">
            <Calendar size={14} className="text-blue-600" />
            <span>السنة المالية: {systemSettings.financial.fiscalYear}</span>
          </span>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="btn-3d btn-3d-white px-3 py-1.5 text-xs font-black"
          >
            تعديل العملة والإعدادات
          </button>
        </div>
      </div>

      {/* System Zeroed / Fresh Reset Notification Banner */}
      {isSystemZeroed && (
        <div className="p-4 rounded-2xl bg-blue-50/90 border border-blue-200 text-blue-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h4 className="font-bold text-sm text-blue-950">
                لوحة المؤشرات في وضع التصفير الأولي (البيانات مصفّرة بالكامل)
              </h4>
              <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                تم تصفير جميع حركات المبيعات والمصروفات والأرصدة بنجاح (المبيعات: 0 {currencySymbol} | المصروفات: 0 {currencySymbol} | الأرباح: 0 {currencySymbol}). ستتحدّث المخططات التراكمية فور إصدار أول فاتورة.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('sales')}
            className="btn-3d btn-3d-blue px-4 py-2 text-xs font-black shrink-0"
          >
            إصدار أول فاتورة مبيعات ←
          </button>
        </div>
      )}

      
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sales Card */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 hover:border-emerald-300 transition-all flex flex-col justify-between group relative overflow-hidden">
          {isLoadingKPIs && <div className="absolute inset-0 bg-slate-50/50 flex items-center justify-center backdrop-blur-[1px]"><div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-500">إجمالي المبيعات الإيرادات</h3>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingUp size={20} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800 font-mono">
              {Number(financialTotals.sales).toLocaleString()} <span className="text-sm font-bold text-slate-400">{currencySymbol}</span>
            </p>
          </div>
        </div>

        {/* Expenses Card */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 hover:border-rose-300 transition-all flex flex-col justify-between group relative overflow-hidden">
          {isLoadingKPIs && <div className="absolute inset-0 bg-slate-50/50 flex items-center justify-center backdrop-blur-[1px]"><div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-500">المصروفات وتكلفة البضاعة</h3>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Activity size={20} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800 font-mono">
              {Number(financialTotals.expenses).toLocaleString()} <span className="text-sm font-bold text-slate-400">{currencySymbol}</span>
            </p>
          </div>
        </div>

        {/* Net Profit Margin Card */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 hover:border-indigo-300 transition-all flex flex-col justify-between group relative overflow-hidden">
          {isLoadingKPIs && <div className="absolute inset-0 bg-slate-50/50 flex items-center justify-center backdrop-blur-[1px]"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-500">صافي الربح</h3>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Scale size={20} />
            </div>
          </div>
          <div>
            <p className={`text-2xl font-black font-mono ${financialTotals.netProfit >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>
              {Number(financialTotals.netProfit).toLocaleString()} <span className="text-sm font-bold text-slate-400">{currencySymbol}</span>
            </p>
          </div>
        </div>

        {/* Inventory Valuation Card */}
        <div 
          onClick={() => onNavigate('warehouseBalances')}
          className="bg-slate-900 p-5 rounded-2xl shadow-xs border border-slate-800 hover:border-blue-400 cursor-pointer transition-all flex flex-col justify-between group relative overflow-hidden"
          title="انقر لفتح أرصدة المخزن"
        >
          {isLoadingKPIs && <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center backdrop-blur-[1px]"><div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-400">تقييم المخزون</h3>
            <div className="w-10 h-10 rounded-xl bg-slate-800 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Warehouse size={20} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-white font-mono flex items-center justify-between">
              <span>{Number(financialTotals.inventoryValuation).toLocaleString()} <span className="text-sm font-medium text-slate-500">{currencySymbol}</span></span>
              <ArrowUpRight size={20} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
            </p>
          </div>
        </div>

        {/* Liquidity Card */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 hover:border-teal-300 transition-all flex flex-col justify-between group relative overflow-hidden">
          {isLoadingKPIs && <div className="absolute inset-0 bg-slate-50/50 flex items-center justify-center backdrop-blur-[1px]"><div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-500">السيولة النقدية (صندوق وبنك)</h3>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <DollarSign size={20} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800 font-mono">
              {Number(financialTotals.cashAndBank).toLocaleString()} <span className="text-sm font-bold text-slate-400">{currencySymbol}</span>
            </p>
          </div>
        </div>
        
        {/* AR vs AP Card (Double Span) */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 hover:border-purple-300 transition-all flex flex-col justify-between group sm:col-span-2 lg:col-span-3 relative overflow-hidden">
          {isLoadingKPIs && <div className="absolute inset-0 bg-slate-50/50 flex items-center justify-center backdrop-blur-[1px]"><div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-500">ميزان الذمم (المطالبات مقابل الالتزامات)</h3>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Scale size={20} />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-6 mt-2">
            <div className="flex-1 w-full p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-600 mb-1">العملاء (ذمم مدينة لك)</p>
                <p className="text-xl font-black text-emerald-700 font-mono">{Number(financialTotals.accountsReceivable).toLocaleString()} <span className="text-xs">{currencySymbol}</span></p>
              </div>
              <ArrowDownRight size={24} className="text-emerald-500/50" />
            </div>
            <div className="text-slate-300 font-black text-xl hidden sm:block">VS</div>
            <div className="flex-1 w-full p-4 rounded-xl bg-rose-50/50 border border-rose-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-rose-600 mb-1">الموردين (ذمم دائنة عليك)</p>
                <p className="text-xl font-black text-rose-700 font-mono">{Number(financialTotals.accountsPayable).toLocaleString()} <span className="text-xs">{currencySymbol}</span></p>
              </div>
              <ArrowUpRight size={24} className="text-rose-500/50" />
            </div>
          </div>
        </div>

      </div>
      
      {/* Smart Alerts & Control Center (Low Stock below Reorder Point & Below Cost Invoices) */}
      <DashboardAlertsCenter onNavigate={onNavigate} />

      {/* Trial Balance & Accounting Equilibrium Live Widget (ربط ميزان المراجعة باللوحة الرئيسية) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:border-blue-300 transition-all">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className={`p-3 rounded-2xl text-white shrink-0 ${trialBalanceStats.totals.isBalanced ? 'bg-gradient-to-br from-blue-600 to-indigo-700 shadow-xs' : 'bg-rose-600'}`}>
            <BookOpen size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                ميزان المراجعة والتوازن المحاسبي العام للشركة
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                trialBalanceStats.totals.isBalanced 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {trialBalanceStats.totals.isBalanced ? '✓ متوازن ومطابق 100%' : 'تنبيه: يوجد فارق محاسبي'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              تجميع لحظي لجميع الحركات من فواتير المبيعات والمشتريات وسندات القبض والصرف والمخازن والرواتب والقيود ({trialBalanceStats.totals.activeAccountsCount} حساب نشط بالميزان).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full lg:w-auto shrink-0 justify-end">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono">
            <span className="text-slate-500 text-[11px]">إجمالي الحركات:</span>
            <span className="font-bold text-blue-700">{trialBalanceStats.totals.totalDebitMovement.toLocaleString()}</span>
            <span className="text-slate-400">/</span>
            <span className="font-bold text-purple-700">{trialBalanceStats.totals.totalCreditMovement.toLocaleString()} {currencySymbol}</span>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('trialBalance')}
            className="btn-3d btn-3d-blue px-4 py-2 text-xs font-black shrink-0"
          >
            <span>فتح ميزان المراجعة</span>
            <ArrowUpRight size={15} />
          </button>
        </div>
      </div>

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
              {topCategory && (topCategory.sales > 0 || topCategory.inventoryValue > 0) ? (
                <>
                  <span className="text-slate-600">
                    القطاع الأعلى نشاطاً وقيمة: <strong className="text-slate-900">{topCategory.category}</strong>
                  </span>
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                    {topCategory.sales > 0 && financialTotals.sales > 0 
                      ? `${((topCategory.sales / financialTotals.sales) * 100).toFixed(0)}% من إجمالي المبيعات`
                      : 'قطاع نشط'}
                  </span>
                </>
              ) : (
                <span className="text-slate-500 text-[11px]">
                  النظام مصفّر ومستعد لاستقبال الحركات والعمليات المالية الجديدة
                </span>
              )}
            </div>

            {/* Recharts Bar Chart Container */}
            <div className="h-72 w-full pt-1">
              {liveCategoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={liveCategoryData}
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
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <Layers size={36} className="text-slate-300 mb-2 stroke-1" />
                  <p className="text-xs font-bold text-slate-600">لا توجد أصناف أو مبيعات مصنفة حالياً</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                    تم تصفير البيانات بنجاح. ستظهر الأعمدة البيانية التوزيعية للقطاعات فور إضافة أصناف وفواتير
                  </p>
                </div>
              )}
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
          className="bg-gradient-to-br from-sky-900 via-slate-900 to-sky-950 text-white p-5 rounded-2xl shadow-md border border-sky-700/50 hover:border-sky-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-300">إدارة الحسابات</span>
              <div className="w-8 h-8 rounded-xl bg-sky-600/40 text-sky-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UsersIcon size={17} />
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">العملاء والمبيعات</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              تسجيل بيانات العملاء، إصدار فواتير المبيعات، ومتابعة سندات القبض.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-sky-300 font-semibold group-hover:text-white">
            <span>فتح شاشة العملاء ←</span>
            <span className="bg-sky-500/30 px-2 py-0.5 rounded text-[10px] text-white">فواتير وتحصيل</span>
          </div>
        </div>

        {/* Vendors Card */}
        <div 
          onClick={() => onNavigate('vendors')}
          className="bg-gradient-to-br from-purple-900 via-slate-900 to-purple-950 text-white p-5 rounded-2xl shadow-md border border-purple-700/50 hover:border-purple-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300">سلاسل الإمداد</span>
              <div className="w-8 h-8 rounded-xl bg-purple-600/40 text-purple-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CreditCard size={17} />
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">الموردون والمشتريات</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              إدارة بيانات الموردين، فواتير أوامر الشراء، وجدولة سندات الصرف والسداد.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-purple-300 font-semibold group-hover:text-white">
            <span>فتح شاشة الموردين ←</span>
            <span className="bg-purple-500/30 px-2 py-0.5 rounded text-[10px] text-white">توريدات والتزامات</span>
          </div>
        </div>

        {/* HR & Payroll Card */}
        <div 
          onClick={() => onNavigate('payroll')}
          className="bg-gradient-to-br from-amber-900 via-slate-900 to-amber-950 text-white p-5 rounded-2xl shadow-md border border-amber-700/50 hover:border-amber-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">الموارد البشرية</span>
              <div className="w-8 h-8 rounded-xl bg-amber-600/40 text-amber-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Award size={17} />
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">الموظفون ومسيرات الأجور</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              إدارة الرواتب الأساسية، البدلات، المكافآت وحوافز التارجت، الخصومات وقسائم الراتب.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-amber-300 font-semibold group-hover:text-white">
            <span>فتح شاشة الموظفين والرواتب ←</span>
            <span className="bg-amber-500/30 px-2 py-0.5 rounded text-[10px] text-white">مسيرات وقسائم</span>
          </div>
        </div>

        {/* Bank Checks Lifecycle Card */}
        <div 
          onClick={() => onNavigate('bankChecks')}
          className="bg-gradient-to-br from-blue-950 via-slate-900 to-cyan-950 text-white p-5 rounded-2xl shadow-md border border-blue-700/60 hover:border-blue-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300">الخزينة والحسابات البنكية</span>
              <div className="w-8 h-8 rounded-xl bg-blue-600/40 text-blue-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Landmark size={17} />
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">دورة حياة الشيكات البنكية</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              متابعة الشيكات الواردة والصادرة (تحت التحصيل ⏳ ⟵ تم الصرف ✅ ⟵ مرتد ❌)، إشعارات الاستحقاق، والقيود التلقائية.
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs font-mono">
              <span className="bg-blue-500/20 text-blue-200 px-2 py-0.5 rounded border border-blue-400/30">
                قيد التحصيل: {checkStats.underCollectionCount}
              </span>
              {(checkStats.overdueCount > 0 || checkStats.dueTodayCount > 0) && (
                <span className="bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded font-bold animate-pulse">
                  مستحق: {checkStats.overdueCount + checkStats.dueTodayCount}
                </span>
              )}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-blue-300 font-semibold group-hover:text-white">
            <span>فتح حافظة الشيكات ←</span>
            <span className="bg-blue-500/30 px-2 py-0.5 rounded text-[10px] text-white">إدارة الشيكات والقيود</span>
          </div>
        </div>

        {/* Item Analytics Center Card */}
        <div 
          onClick={() => setIsAnalyticsModalOpen(true)}
          className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white p-5 rounded-2xl shadow-md border border-indigo-700/60 hover:border-indigo-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">الذكاء والتحليل المتقدم</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-600/40 text-indigo-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                <BarChart3 size={17} />
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">تحليل الأصناف والمخزون</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              كشف الربحية، معدلات السحب، تقلبات أسعار التوريد والبيع، واكتشاف الأصناف الراكدة.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-indigo-300 font-semibold group-hover:text-white">
            <span>فتح بطاقة التحليل الذكي ←</span>
            <span className="bg-indigo-500/30 px-2 py-0.5 rounded text-[10px] text-white">تحليل شامل</span>
          </div>
        </div>

        {/* Manufacturing & Production Card */}
        <div 
          onClick={() => onNavigate('manufacturing')}
          className="bg-gradient-to-br from-amber-950 via-slate-900 to-orange-950 text-white p-5 rounded-2xl shadow-md border border-amber-700/60 hover:border-amber-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">الإنتاج الصناعي والتكاليف</span>
              <div className="w-8 h-8 rounded-xl bg-amber-600/40 text-amber-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Factory size={17} />
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">إدارة التصنيع ومعايير التكاليف (BOM)</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              إصدار أوامر الإنتاج، خصم الخامات وتوريد المنتج التام آلياً، القيود الصناعية المحاسبية، وتتبع انحرافات التكاليف والهالك.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-amber-300 font-semibold group-hover:text-white">
            <span>فتح شاشة التصنيع والإنتاج ←</span>
            <span className="bg-amber-500/30 px-2 py-0.5 rounded text-[10px] text-white">أوامر تشغيل وBOM</span>
          </div>
        </div>

        {/* Cost Centers & Projects Card */}
        <div 
          onClick={() => onNavigate('costCenters')}
          className="bg-gradient-to-br from-purple-950 via-slate-900 to-violet-950 text-white p-5 rounded-2xl shadow-md border border-purple-700/60 hover:border-purple-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300">المحاسبة التحليلية والمشاريع</span>
              <div className="w-8 h-8 rounded-xl bg-purple-600/40 text-purple-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Building2 size={17} />
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">مراكز التكلفة وقوائم الأرباح والخسائر</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              تتبع الإيرادات والمصروفات لكل فرع، مشروع، أسطول نقليات، وقسم على حدة، ومقارنة الميزانية مع التكاليف الفعلية.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-purple-300 font-semibold group-hover:text-white">
            <span>فتح شاشة مراكز التكلفة والتقارير ←</span>
            <span className="bg-purple-500/30 px-2 py-0.5 rounded text-[10px] text-white">P&L تحليلي</span>
          </div>
        </div>
      </div>

      {/* Item Analytics Modal */}
      <ItemAnalyticsModal
        isOpen={isAnalyticsModalOpen}
        onClose={() => setIsAnalyticsModalOpen(false)}
      />
    </div>
  );
}
