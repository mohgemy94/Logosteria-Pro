import { useState, useMemo } from 'react';
import { 
  Printer, 
  RefreshCcw,
  Calendar,
  Building2,
  TrendingUp,
  Scale,
  PieChart,
  DollarSign,
  X,
  ChevronLeft,
  BookOpen,
  ExternalLink,
  Activity,
  Percent,
  Target,
  Wallet,
  ArrowRightLeft,
  Banknote
} from 'lucide-react';
import { AccountType } from '../types/accounting';
import { calculateTrialBalance, getAccountLedgerMovements } from '../utils/trialBalanceStore';
import { getSystemSettings } from '../utils/settings';
import ExportButtonGroup from './ExportButtonGroup';

interface FinancialReportsScreenProps {
  onNavigate?: (view: string) => void;
}

export default function FinancialReportsScreen({ onNavigate }: FinancialReportsScreenProps) {
  const systemSettings = getSystemSettings();
  const currencySymbol = systemSettings.financial?.currencySymbol || 'ر.س';

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<'INCOME' | 'BALANCE' | 'CASH_FLOW' | 'RATIOS' | 'COMPARISON' | null>(null);
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState<any | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Period comparison date ranges
  const [compPeriod1Start, setCompPeriod1Start] = useState<string>('');
  const [compPeriod1End, setCompPeriod1End] = useState<string>('');
  const [compPeriod2Start, setCompPeriod2Start] = useState<string>('');
  const [compPeriod2End, setCompPeriod2End] = useState<string>('');

  const { rows } = useMemo(() => {
    return calculateTrialBalance(
      startDate || undefined,
      endDate || undefined,
      'ALL',
      true
    );
  }, [startDate, endDate, refreshKey]);

  // Comparative data calculation
  const compPeriod1Rows = useMemo(() => {
    if (!compPeriod1Start && !compPeriod1End) return rows;
    return calculateTrialBalance(compPeriod1Start || undefined, compPeriod1End || undefined, 'ALL', true).rows;
  }, [compPeriod1Start, compPeriod1End, rows]);

  const compPeriod2Rows = useMemo(() => {
    if (!compPeriod2Start && !compPeriod2End) return [];
    return calculateTrialBalance(compPeriod2Start || undefined, compPeriod2End || undefined, 'ALL', true).rows;
  }, [compPeriod2Start, compPeriod2End]);

  const selectedLedgerItems = useMemo(() => {
    if (!selectedLedgerAccount) return [];
    return getAccountLedgerMovements(selectedLedgerAccount.account.id, startDate || undefined, endDate || undefined);
  }, [selectedLedgerAccount, startDate, endDate, refreshKey]);

  // Income Statement Calculations
  const revenues = rows.filter(r => r.account.type === AccountType.Revenue);
  const expenses = rows.filter(r => r.account.type === AccountType.Expense);
  
  const operatingRevenues = revenues.filter(r => r.account.code.startsWith('41'));
  const otherRevenues = revenues.filter(r => !r.account.code.startsWith('41'));
  
  const cogsExpenses = expenses.filter(r => r.account.code.startsWith('5101') || r.account.name.includes('تكلفة البضاعة'));
  const operatingExpenses = expenses.filter(r => !r.account.code.startsWith('5101') && !r.account.name.includes('تكلفة البضاعة'));
  
  const totalOpRevs = operatingRevenues.reduce((sum, r) => sum + (r.endingCredit - r.endingDebit), 0);
  const totalOtherRevs = otherRevenues.reduce((sum, r) => sum + (r.endingCredit - r.endingDebit), 0);
  const totalCogs = cogsExpenses.reduce((sum, r) => sum + (r.endingDebit - r.endingCredit), 0);
  const totalOpExps = operatingExpenses.reduce((sum, r) => sum + (r.endingDebit - r.endingCredit), 0);
  
  const totalRevenues = totalOpRevs + totalOtherRevs;
  const grossProfit = totalOpRevs - totalCogs;
  const netIncome = grossProfit + totalOtherRevs - totalOpExps;

  // Balance Sheet Calculations
  const assets = rows.filter(r => r.account.type === AccountType.Asset);
  const liabilities = rows.filter(r => r.account.type === AccountType.Liability);
  const equity = rows.filter(r => r.account.type === AccountType.Equity);

  const totalAssets = assets.reduce((sum, r) => sum + (r.endingDebit - r.endingCredit), 0);
  const totalLiabilities = liabilities.reduce((sum, r) => sum + (r.endingCredit - r.endingDebit), 0);
  const totalEquityBase = equity.reduce((sum, r) => sum + (r.endingCredit - r.endingDebit), 0);
  
  const totalEquity = totalEquityBase + netIncome;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  // Cash & Cash Equivalents (1101, 1102, etc.)
  const cashAccounts = assets.filter(r => r.account.code.startsWith('1101') || r.account.code.startsWith('1102') || r.account.name.includes('صندوق') || r.account.name.includes('بنك') || r.account.name.includes('خزينة'));
  const endingCashBalance = cashAccounts.reduce((sum, r) => sum + (r.endingDebit - r.endingCredit), 0);
  const beginningCashBalance = cashAccounts.reduce((sum, r) => sum + (r.openingDebit - r.openingCredit), 0);

  // Cash Flow Statement (Indirect Method)
  // 1. Operating Activities
  // Receivables change (negative if increased)
  const arAccounts = assets.filter(r => r.account.code.startsWith('1103') || r.account.name.includes('عملاء') || r.account.name.includes('مدين'));
  const arChange = arAccounts.reduce((sum, r) => sum + ((r.endingDebit - r.endingCredit) - (r.openingDebit - r.openingCredit)), 0);
  const cashFromAr = -arChange; // Increase in AR consumes cash

  // Inventory change (negative if increased)
  const invAccounts = assets.filter(r => r.account.code.startsWith('1104') || r.account.name.includes('مخزون') || r.account.name.includes('بضاعة'));
  const invChange = invAccounts.reduce((sum, r) => sum + ((r.endingDebit - r.endingCredit) - (r.openingDebit - r.openingCredit)), 0);
  const cashFromInv = -invChange;

  // Payables change (positive if increased)
  const apAccounts = liabilities.filter(r => r.account.code.startsWith('2101') || r.account.name.includes('موردين') || r.account.name.includes('دائن'));
  const apChange = apAccounts.reduce((sum, r) => sum + ((r.endingCredit - r.endingDebit) - (r.openingCredit - r.openingDebit)), 0);
  const cashFromAp = apChange; // Increase in AP provides cash

  const operatingCashFlow = netIncome + cashFromAr + cashFromInv + cashFromAp;

  // 2. Investing Activities (Fixed Assets changes)
  const fixedAssetAccounts = assets.filter(r => r.account.code.startsWith('12') || (!r.account.code.startsWith('11') && r.account.type === AccountType.Asset));
  const fixedAssetChange = fixedAssetAccounts.reduce((sum, r) => sum + ((r.endingDebit - r.endingCredit) - (r.openingDebit - r.openingCredit)), 0);
  const investingCashFlow = -fixedAssetChange;

  // 3. Financing Activities (Equity changes, capital, drawings, loans)
  const nonCurrentLiabilities = liabilities.filter(r => !r.account.code.startsWith('21'));
  const loanChange = nonCurrentLiabilities.reduce((sum, r) => sum + ((r.endingCredit - r.endingDebit) - (r.openingCredit - r.openingDebit)), 0);
  const equityBaseChange = equity.reduce((sum, r) => sum + ((r.endingCredit - r.endingDebit) - (r.openingCredit - r.openingDebit)), 0);
  const financingCashFlow = loanChange + equityBaseChange;

  // Net Cash Flow
  const calculatedNetCashChange = operatingCashFlow + investingCashFlow + financingCashFlow;

  // Financial Ratios Calculations
  const currentAssets = assets.filter(r => r.account.code.startsWith("11")).reduce((sum, r) => sum + (r.endingDebit - r.endingCredit), 0);
  const currentLiabilities = liabilities.filter(r => r.account.code.startsWith("21")).reduce((sum, r) => sum + (r.endingCredit - r.endingDebit), 0);

  const netProfitMargin = totalRevenues > 0 ? (netIncome / totalRevenues) * 100 : 0;
  const grossProfitMargin = totalOpRevs > 0 ? (grossProfit / totalOpRevs) * 100 : 0;
  const currentRatio = currentLiabilities > 0 ? (currentAssets / currentLiabilities) : (currentAssets > 0 ? Infinity : 0);
  const roe = totalEquity > 0 ? (netIncome / totalEquity) * 100 : 0;
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  const handleClearDates = () => {
    setStartDate('');
    setEndDate('');
  };

  const handlePrint = () => {
    window.print();
  };

  const formatMoney = (amount: number) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getAccountTypeLabel = (type: AccountType) => {
    switch (type) {
      case AccountType.Asset: return 'أصول';
      case AccountType.Liability: return 'التزامات';
      case AccountType.Equity: return 'حقوق ملكية';
      case AccountType.Revenue: return 'إيرادات';
      case AccountType.Expense: return 'مصروفات';
      default: return type;
    }
  };

  // Export preparation data helpers (returns rows array for ExportButtonGroup)
  const getIncomeStatementExportRows = () => {
    const dataRows: (string | number)[][] = [];
    dataRows.push(['إيرادات النشاط الأساسي', '', '', '']);
    operatingRevenues.forEach(r => {
      dataRows.push(['إيرادات تشغيلية', r.account.code, r.account.name, r.endingCredit - r.endingDebit]);
    });
    dataRows.push(['إجمالي إيرادات النشاط', '', '', totalOpRevs]);
    dataRows.push(['تكلفة البضاعة المباعة', '', '', '']);
    cogsExpenses.forEach(r => {
      dataRows.push(['تكلفة المبيعات', r.account.code, r.account.name, r.endingDebit - r.endingCredit]);
    });
    dataRows.push(['إجمالي تكلفة المبيعات', '', '', totalCogs]);
    dataRows.push(['مجمل الربح / الخسارة', '', '', grossProfit]);
    dataRows.push(['المصروفات التشغيلية والعمومية', '', '', '']);
    operatingExpenses.forEach(r => {
      dataRows.push(['مصروفات عمومية', r.account.code, r.account.name, r.endingDebit - r.endingCredit]);
    });
    dataRows.push(['إجمالي المصروفات', '', '', totalOpExps]);
    dataRows.push(['صافي الربح / الخسارة النهائي', '', '', netIncome]);
    return dataRows;
  };

  const getBalanceSheetExportRows = () => {
    const dataRows: (string | number)[][] = [];
    dataRows.push(['الأصول (الموجودات)', '', '', '']);
    assets.forEach(r => {
      dataRows.push(['الأصول', r.account.code, r.account.name, r.endingDebit - r.endingCredit]);
    });
    dataRows.push(['إجمالي الأصول', '', '', totalAssets]);
    dataRows.push(['الخصوم (الالتزامات)', '', '', '']);
    liabilities.forEach(r => {
      dataRows.push(['الخصوم', r.account.code, r.account.name, r.endingCredit - r.endingDebit]);
    });
    dataRows.push(['إجمالي الخصوم', '', '', totalLiabilities]);
    dataRows.push(['حقوق الملكية', '', '', '']);
    equity.forEach(r => {
      dataRows.push(['حقوق الملكية', r.account.code, r.account.name, r.endingCredit - r.endingDebit]);
    });
    dataRows.push(['صافي أرباح الفترة', '', '', netIncome]);
    dataRows.push(['إجمالي حقوق الملكية', '', '', totalEquity]);
    dataRows.push(['إجمالي الخصوم وحقوق الملكية', '', '', totalLiabilitiesAndEquity]);
    return dataRows;
  };

  const getCashFlowExportRows = () => {
    return [
      ['صافي الدخل من النشاط (Net Income)', netIncome],
      ['التغير في الذمم المدينة والعملاء', cashFromAr],
      ['التغير في المخزون السلعي والبضاعة', cashFromInv],
      ['التغير في الذمم الدائنة والموردين', cashFromAp],
      ['صافي التدفقات النقدية من الأنشطة التشغيلية', operatingCashFlow],
      ['صافي التدفقات النقدية من الأنشطة الاستثمارية (الأصول الثابتة)', investingCashFlow],
      ['صافي التدفقات النقدية من الأنشطة التمويلية (رأس المال والديون)', financingCashFlow],
      ['صافي التغير في النقدية وما في حكمها للفترة', calculatedNetCashChange],
      ['رصيد النقدية وما في حكمها في بداية الفترة', beginningCashBalance],
      ['رصيد النقدية وما في حكمها في نهاية الفترة', endingCashBalance]
    ];
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 relative">
      
      {/* --- Main Dashboard Area --- */}
      <div className={`flex-1 flex flex-col ${selectedReport ? 'hidden print:hidden' : 'block print:block'}`}>
        
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 p-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-950 flex items-center justify-center text-blue-100 shadow-sm border border-blue-800">
                <PieChart size={20} />
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-800">التقارير المالية الختامية</h1>
                <p className="text-xs text-slate-500 font-medium mt-0.5">لوحة تحكم القوائم المالية</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setRefreshKey(k => k + 1)}
                className="btn-3d btn-3d-white h-10 px-4 text-xs font-black text-slate-700"
                title="تحديث البيانات"
              >
                <RefreshCcw size={15} />
                <span className="hidden sm:inline">تحديث</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-5 flex flex-wrap items-center gap-3 bg-slate-100/50 p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-slate-500" />
              <span className="text-xs font-bold text-slate-700">تحديد الفترة المالية:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-mono shadow-2xs"
              />
              <span className="text-slate-400 text-xs font-bold">إلى</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-mono shadow-2xs"
              />
              {(startDate || endDate) && (
                <button
                  onClick={handleClearDates}
                  className="px-2.5 py-1.5 text-[11px] font-black text-rose-600 hover:bg-rose-100 bg-rose-50 rounded-lg transition-colors border border-rose-200"
                >
                  مسح التواريخ
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            
            {/* 1. Income Statement Card (Dark Gradient) */}
            <div 
              onClick={() => setSelectedReport('INCOME')}
              className="group relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 border border-slate-700/60 rounded-[2rem] p-6 sm:p-8 shadow-2xl hover:shadow-[0_15px_50px_rgba(0,0,0,0.4)] transition-all duration-300 overflow-hidden cursor-pointer hover:-translate-y-1.5"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 to-emerald-600 opacity-80"></div>
              <div className="absolute -bottom-6 -left-6 text-slate-700/20 group-hover:text-emerald-500/10 transition-colors duration-500 transform group-hover:scale-110">
                <TrendingUp size={160} strokeWidth={1} />
              </div>

              <div className="relative z-10 flex flex-col h-full">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                  <TrendingUp size={28} />
                </div>
                
                <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">قائمة الدخل</h2>
                <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
                  تقرير الأرباح والخسائر الشامل، يوضح تفاصيل الإيرادات والمصروفات وصافي النتيجة للفترة المحددة.
                </p>
                
                <div className="mt-auto">
                  <div className="bg-slate-950/60 rounded-2xl p-4 sm:p-5 border border-slate-700/50 backdrop-blur-md flex items-center justify-between group-hover:border-emerald-500/30 transition-colors">
                    <div>
                      <div className="text-slate-400 text-xs font-bold mb-1">صافي النتيجة (للفترة)</div>
                      <div className={`text-xl sm:text-2xl font-mono font-black tracking-tight ${netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatMoney(Math.abs(netIncome))} <span className="text-sm font-bold text-slate-500">{currencySymbol}</span>
                      </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-black border ${netIncome >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                      {netIncome >= 0 ? 'ربح' : 'خسارة'}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end text-emerald-400 text-sm font-bold gap-1 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-4 group-hover:translate-x-0 duration-300">
                  <span>عرض التقرير</span>
                  <ChevronLeft size={16} />
                </div>
              </div>
            </div>

            {/* 2. Balance Sheet Card (Dark Gradient) */}
            <div 
              onClick={() => setSelectedReport('BALANCE')}
              className="group relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 border border-slate-700/60 rounded-[2rem] p-6 sm:p-8 shadow-2xl hover:shadow-[0_15px_50px_rgba(0,0,0,0.4)] transition-all duration-300 overflow-hidden cursor-pointer hover:-translate-y-1.5"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-400 to-indigo-600 opacity-80"></div>
              <div className="absolute -bottom-6 -left-6 text-slate-700/20 group-hover:text-indigo-500/10 transition-colors duration-500 transform group-hover:scale-110">
                <Scale size={160} strokeWidth={1} />
              </div>

              <div className="relative z-10 flex flex-col h-full">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
                  <Scale size={28} />
                </div>
                
                <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">الميزانية العمومية</h2>
                <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
                  المركز المالي للشركة الشامل، يستعرض الموجودات (الأصول) والالتزامات (الخصوم) وحقوق الملكية.
                </p>
                
                <div className="mt-auto">
                  <div className="bg-slate-950/60 rounded-2xl p-4 sm:p-5 border border-slate-700/50 backdrop-blur-md flex items-center justify-between group-hover:border-indigo-500/30 transition-colors">
                    <div>
                      <div className="text-slate-400 text-xs font-bold mb-1">إجمالي الأصول</div>
                      <div className="text-xl sm:text-2xl font-mono font-black tracking-tight text-indigo-400">
                        {formatMoney(totalAssets)} <span className="text-sm font-bold text-slate-500">{currencySymbol}</span>
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg text-xs font-black border bg-indigo-500/10 text-indigo-300 border-indigo-500/20">
                      متوازنة
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end text-indigo-400 text-sm font-bold gap-1 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-4 group-hover:translate-x-0 duration-300">
                  <span>عرض التقرير</span>
                  <ChevronLeft size={16} />
                </div>
              </div>
            </div>

            {/* 3. Cash Flow Statement Card (NEW) */}
            <div 
              onClick={() => setSelectedReport('CASH_FLOW')}
              className="group relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 border border-slate-700/60 rounded-[2rem] p-6 sm:p-8 shadow-2xl hover:shadow-[0_15px_50px_rgba(0,0,0,0.4)] transition-all duration-300 overflow-hidden cursor-pointer hover:-translate-y-1.5"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 to-teal-500 opacity-80"></div>
              <div className="absolute -bottom-6 -left-6 text-slate-700/20 group-hover:text-amber-500/10 transition-colors duration-500 transform group-hover:scale-110">
                <Wallet size={160} strokeWidth={1} />
              </div>

              <div className="relative z-10 flex flex-col h-full">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-6 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                  <Wallet size={28} />
                </div>
                
                <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">قائمة التدفقات النقدية</h2>
                <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
                  حركة السيولة النقدية عبر الأنشطة التشغيلية والاستثمارية والتمويلية ومطابقة أرصدة الصناديق والبنوك.
                </p>
                
                <div className="mt-auto">
                  <div className="bg-slate-950/60 rounded-2xl p-4 sm:p-5 border border-slate-700/50 backdrop-blur-md flex items-center justify-between group-hover:border-amber-500/30 transition-colors">
                    <div>
                      <div className="text-slate-400 text-xs font-bold mb-1">صافي التدفق التشغيلي</div>
                      <div className={`text-xl sm:text-2xl font-mono font-black tracking-tight ${operatingCashFlow >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {formatMoney(Math.abs(operatingCashFlow))} <span className="text-sm font-bold text-slate-500">{currencySymbol}</span>
                      </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-black border ${operatingCashFlow >= 0 ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                      {operatingCashFlow >= 0 ? 'فائض نقدي' : 'عجز نقدي'}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end text-amber-400 text-sm font-bold gap-1 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-4 group-hover:translate-x-0 duration-300">
                  <span>عرض قائمة التدفقات</span>
                  <ChevronLeft size={16} />
                </div>
              </div>
            </div>

            {/* 4. Financial Ratios Indicator Card */}
            <div 
              onClick={() => setSelectedReport("RATIOS")}
              className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 rounded-[2rem] p-6 sm:p-8 cursor-pointer group hover:-translate-y-1 transition-all duration-300 relative overflow-hidden border border-slate-700 hover:border-fuchsia-500/30 hover:shadow-2xl hover:shadow-fuchsia-500/20"
            >
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl group-hover:bg-fuchsia-500/20 transition-all duration-500"></div>
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center border border-fuchsia-500/20 group-hover:scale-110 transition-transform duration-300">
                    <Activity size={28} className="text-fuchsia-400" />
                  </div>
                  <div className="bg-slate-800/80 px-4 py-1.5 rounded-full border border-slate-700 backdrop-blur-sm">
                    <span className="text-xs font-bold text-slate-300 tracking-wide">النسب المالية</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-black text-white mb-2 tracking-tight group-hover:text-fuchsia-50 transition-colors">المؤشرات والنسب المالية</h3>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed">
                    تحليل الأداء المالي، معدلات الربحية، ونسب السيولة والمديونية وكفاءة التشغيل.
                  </p>
                </div>
                <div className="mt-8 pt-6 border-t border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-black text-slate-500 mb-1 uppercase tracking-wider">هامش صافي الربح</div>
                      <div className="text-xl sm:text-2xl font-mono font-black tracking-tight text-fuchsia-400">
                        {netProfitMargin.toFixed(1)} <span className="text-sm font-bold text-slate-500">%</span>
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg text-xs font-black border bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20">
                      مؤشر الأداء
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-end text-fuchsia-400 text-sm font-bold gap-1 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-4 group-hover:translate-x-0 duration-300">
                  <span>عرض المؤشرات</span>
                  <ChevronLeft size={16} />
                </div>
              </div>
            </div>

            {/* 5. Comparative Period Analytics Card (NEW) */}
            <div 
              onClick={() => setSelectedReport("COMPARISON")}
              className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 rounded-[2rem] p-6 sm:p-8 cursor-pointer group hover:-translate-y-1 transition-all duration-300 relative overflow-hidden border border-slate-700 hover:border-cyan-500/30 hover:shadow-2xl hover:shadow-cyan-500/20"
            >
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition-all duration-500"></div>
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 group-hover:scale-110 transition-transform duration-300">
                    <ArrowRightLeft size={28} className="text-cyan-400" />
                  </div>
                  <div className="bg-slate-800/80 px-4 py-1.5 rounded-full border border-slate-700 backdrop-blur-sm">
                    <span className="text-xs font-bold text-cyan-300 tracking-wide">تحليل مقارن</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-black text-white mb-2 tracking-tight group-hover:text-cyan-50 transition-colors">مقارنة الفترات والسنوات المالية</h3>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed">
                    مقارنة تفصيلية بين فترتين ماليتين وحساب نسب النمو والانحراف (Variance) للإيرادات والمصروفات.
                  </p>
                </div>
                <div className="mt-8 pt-6 border-t border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-black text-slate-500 mb-1 uppercase tracking-wider">النمو المالي المقارن</div>
                      <div className="text-xl sm:text-2xl font-mono font-black tracking-tight text-cyan-400">
                        مقارنة حية
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg text-xs font-black border bg-cyan-500/10 text-cyan-300 border-cyan-500/20">
                      تحليل الفترات
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-end text-cyan-400 text-sm font-bold gap-1 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-4 group-hover:translate-x-0 duration-300">
                  <span>فتح شاشة المقارنة</span>
                  <ChevronLeft size={16} />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* --- Popup Modal for Reports --- */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 sm:p-6 print:static print:block print:inset-auto print:bg-transparent print:p-0 animate-fadeIn">
          <div className="bg-slate-50 w-full max-w-5xl h-[95vh] sm:h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-slate-300 print:h-auto print:border-none print:shadow-none print:rounded-none">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden border-b border-slate-700">
              <div className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                  {selectedReport === 'INCOME' ? <TrendingUp size={20} className="text-emerald-400" /> : 
                   selectedReport === 'BALANCE' ? <Scale size={20} className="text-indigo-400" /> : 
                   selectedReport === 'CASH_FLOW' ? <Wallet size={20} className="text-amber-400" /> : 
                   selectedReport === 'COMPARISON' ? <ArrowRightLeft size={20} className="text-cyan-400" /> : 
                   <Activity size={20} className="text-fuchsia-400" />}
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black">
                    {selectedReport === 'INCOME' ? 'قائمة الدخل (الأرباح والخسائر)' : 
                     selectedReport === 'BALANCE' ? 'الميزانية العمومية (المركز المالي)' : 
                     selectedReport === 'CASH_FLOW' ? 'قائمة التدفقات النقدية' : 
                     selectedReport === 'COMPARISON' ? 'المقارنة والتحليل المالي المتقدم للفترات' : 
                     'المؤشرات والنسب المالية'}
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {startDate || endDate ? `للفترة: ${startDate || 'بداية النشاط'} إلى ${endDate || 'تاريخه'}` : 'لجميع الفترات المالية'}
                  </p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {/* 3D Export Button Group for the open report */}
                {selectedReport === 'INCOME' && (
                  <ExportButtonGroup
                    headers={['البند / التصنيف', 'رقم الحساب', 'اسم الحساب', `المبلغ (${currencySymbol})`]}
                    rows={getIncomeStatementExportRows()}
                    filename="قائمة_الدخل"
                    title="قائمة الدخل - الأرباح والخسائر"
                    subtitle={`الفترة: ${startDate || 'البداية'} إلى ${endDate || 'الآن'}`}
                  />
                )}

                {selectedReport === 'BALANCE' && (
                  <ExportButtonGroup
                    headers={['التصنيف الرئيسي', 'رقم الحساب', 'اسم الحساب', `الرصيد (${currencySymbol})`]}
                    rows={getBalanceSheetExportRows()}
                    filename="الميزانية_العمومية"
                    title="الميزانية العمومية - المركز المالي"
                    subtitle={`الفترة: ${startDate || 'البداية'} إلى ${endDate || 'الآن'}`}
                  />
                )}

                {selectedReport === 'CASH_FLOW' && (
                  <ExportButtonGroup
                    headers={['بند التدفق النقدي', `القيمة (${currencySymbol})`]}
                    rows={getCashFlowExportRows()}
                    filename="قائمة_التدفقات_النقدية"
                    title="قائمة التدفقات النقدية"
                    subtitle={`الفترة: ${startDate || 'البداية'} إلى ${endDate || 'الآن'}`}
                  />
                )}

                <button 
                  onClick={handlePrint} 
                  className="btn-3d btn-3d-slate h-9 px-3 sm:px-4 text-xs font-black shadow-none border-slate-700 bg-slate-800 hover:bg-slate-700 text-white"
                  title="طباعة التقرير"
                >
                  <Printer size={15} className="sm:mr-1.5" /> 
                  <span className="hidden sm:inline">طباعة</span>
                </button>
                <button 
                  onClick={() => setSelectedReport(null)} 
                  className="w-9 h-9 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 flex items-center justify-center transition-colors border border-rose-500/30 cursor-pointer"
                  title="إغلاق"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Content (The Report) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 print:overflow-visible print:p-0">
              
              {/* Print Header (Visible only when printing) */}
              <div className="hidden print:block text-slate-900 mb-8 border-b-2 border-slate-800 pb-6">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {systemSettings.company?.logoUrl && (
                      <img src={systemSettings.company.logoUrl} alt="Logo" className="h-12 w-auto object-contain rounded shrink-0" />
                    )}
                    <div className="space-y-0.5 min-w-0 flex-1 text-right">
                      <h1 className="text-xl font-black text-slate-900">{systemSettings.company?.nameAr || 'لوجوستريا للمحاسبة والحلول المالية'}</h1>
                      {systemSettings.company?.nameEn && (
                        <p className="text-xs text-indigo-900 font-sans font-semibold">{systemSettings.company.nameEn}</p>
                      )}
                      <p className="text-xs text-slate-700">{systemSettings.company?.branchName ? `${systemSettings.company.branchName} - ` : ''}{systemSettings.company?.address || 'المملكة العربية السعودية - الرياض'}</p>
                      <div className="text-xs text-slate-700 font-mono flex flex-wrap gap-3">
                        <span>الرقم الضريبي: {systemSettings.company?.taxNumber || '310123456700003'}</span>
                        {systemSettings.company?.commercialRegister && <span>س.ت: {systemSettings.company.commercialRegister}</span>}
                        {systemSettings.company?.phone && <span>الهاتف: {systemSettings.company.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <h2 className="text-lg font-bold text-slate-800">
                      {selectedReport === 'INCOME' ? 'قائمة الدخل (الأرباح والخسائر)' : 
                       selectedReport === 'BALANCE' ? 'الميزانية العمومية (المركز المالي)' : 
                       selectedReport === 'CASH_FLOW' ? 'قائمة التدفقات النقدية' : 
                       selectedReport === 'COMPARISON' ? 'التحليل المقارن للفترات المالية' : 
                       'المؤشرات والنسب المالية'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      للفترة من: <span className="font-bold">{startDate || 'بداية النشاط'}</span> إلى: <span className="font-bold">{endDate || 'تاريخه'}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* INCOME STATEMENT DETAILS */}
              {selectedReport === 'INCOME' && (
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden print:border-none print:shadow-none max-w-4xl mx-auto">
                  
                  {/* 1. Operating Revenues */}
                  <div className="bg-emerald-50/70 p-4 sm:px-6 border-b border-slate-200">
                    <h3 className="text-lg font-black text-emerald-900 flex items-center gap-2">
                      <TrendingUp size={18} />
                      <span>إيرادات النشاط الأساسي</span>
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {operatingRevenues.length > 0 ? operatingRevenues.map((row, idx) => (
                      <div key={idx} onClick={() => setSelectedLedgerAccount(row)} className="flex justify-between items-center p-3.5 sm:px-6 hover:bg-blue-50/50 transition-colors cursor-pointer group">
                        <span className="text-sm font-bold text-slate-700 group-hover:text-blue-700 transition-colors flex items-center gap-1.5"><BookOpen size={14} className="text-slate-400 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all" />{row.account.code} - {row.account.name}</span>
                        <span className="font-mono font-bold text-slate-900">{formatMoney(row.endingCredit - row.endingDebit)}</span>
                      </div>
                    )) : (
                      <div className="p-5 text-center text-slate-400 text-sm font-medium">لا توجد حركات إيرادات تشغيلية</div>
                    )}
                    <div className="flex justify-between items-center p-4 sm:px-6 bg-emerald-50/50 border-t-2 border-emerald-100">
                      <span className="text-sm font-black text-emerald-800">إجمالي إيرادات النشاط</span>
                      <span className="font-mono font-black text-emerald-700 text-lg">{formatMoney(totalOpRevs)}</span>
                    </div>
                  </div>

                  {/* 2. Less: COGS */}
                  <div className="bg-orange-50/70 p-4 sm:px-6 border-b border-slate-200 border-t-4 border-t-slate-100">
                    <h3 className="text-lg font-black text-orange-900 flex items-center gap-2">
                      <DollarSign size={18} />
                      <span>يخصم: تكلفة البضاعة المباعة</span>
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {cogsExpenses.length > 0 ? cogsExpenses.map((row, idx) => (
                      <div key={idx} onClick={() => setSelectedLedgerAccount(row)} className="flex justify-between items-center p-3.5 sm:px-6 hover:bg-blue-50/50 transition-colors cursor-pointer group">
                        <span className="text-sm font-bold text-slate-700 group-hover:text-blue-700 transition-colors flex items-center gap-1.5"><BookOpen size={14} className="text-slate-400 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all" />{row.account.code} - {row.account.name}</span>
                        <span className="font-mono font-bold text-slate-900">{formatMoney(row.endingDebit - row.endingCredit)}</span>
                      </div>
                    )) : (
                      <div className="p-5 text-center text-slate-400 text-sm font-medium">لا توجد تكلفة بضاعة مباعة</div>
                    )}
                    <div className="flex justify-between items-center p-4 sm:px-6 bg-orange-50/50 border-t-2 border-orange-100">
                      <span className="text-sm font-black text-orange-800">إجمالي تكلفة البضاعة المباعة</span>
                      <span className="font-mono font-black text-orange-700 text-lg">{formatMoney(totalCogs)}</span>
                    </div>
                  </div>

                  {/* 3. Gross Profit Summary */}
                  <div className={`p-5 sm:px-6 border-y border-slate-200 ${grossProfit >= 0 ? 'bg-slate-800 text-white' : 'bg-slate-800 text-white'}`}>
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                      <h3 className="text-lg font-black text-emerald-400">
                        مجمل الربح (الخسارة)
                      </h3>
                      <span className="font-mono font-black text-xl">{formatMoney(grossProfit)} {currencySymbol}</span>
                    </div>
                  </div>

                  {/* 4. Add: Other Revenues */}
                  <div className="bg-emerald-50/40 p-4 sm:px-6 border-b border-slate-200">
                    <h3 className="text-md font-black text-emerald-900 flex items-center gap-2">
                      <span>يضاف: إيرادات وأرباح أخرى</span>
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {otherRevenues.length > 0 ? otherRevenues.map((row, idx) => (
                      <div key={idx} onClick={() => setSelectedLedgerAccount(row)} className="flex justify-between items-center p-3.5 sm:px-6 hover:bg-blue-50/50 transition-colors cursor-pointer group">
                        <span className="text-sm font-bold text-slate-700 group-hover:text-blue-700 transition-colors flex items-center gap-1.5"><BookOpen size={14} className="text-slate-400 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all" />{row.account.code} - {row.account.name}</span>
                        <span className="font-mono font-bold text-slate-900">{formatMoney(row.endingCredit - row.endingDebit)}</span>
                      </div>
                    )) : (
                      <div className="p-3 text-center text-slate-400 text-xs font-medium">لا توجد إيرادات أخرى</div>
                    )}
                  </div>

                  {/* 5. Less: Operating Expenses */}
                  <div className="bg-rose-50/70 p-4 sm:px-6 border-b border-slate-200 border-t-2 border-t-slate-100">
                    <h3 className="text-md font-black text-rose-900 flex items-center gap-2">
                      <span>يخصم: المصروفات التشغيلية والعمومية</span>
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {operatingExpenses.length > 0 ? operatingExpenses.map((row, idx) => (
                      <div key={idx} onClick={() => setSelectedLedgerAccount(row)} className="flex justify-between items-center p-3.5 sm:px-6 hover:bg-blue-50/50 transition-colors cursor-pointer group">
                        <span className="text-sm font-bold text-slate-700 group-hover:text-blue-700 transition-colors flex items-center gap-1.5"><BookOpen size={14} className="text-slate-400 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all" />{row.account.code} - {row.account.name}</span>
                        <span className="font-mono font-bold text-slate-900">{formatMoney(row.endingDebit - row.endingCredit)}</span>
                      </div>
                    )) : (
                      <div className="p-5 text-center text-slate-400 text-sm font-medium">لا توجد مصروفات تشغيلية</div>
                    )}
                    <div className="flex justify-between items-center p-4 sm:px-6 bg-rose-50/50 border-t-2 border-rose-100">
                      <span className="text-sm font-black text-rose-800">إجمالي المصروفات التشغيلية</span>
                      <span className="font-mono font-black text-rose-700 text-lg">{formatMoney(totalOpExps)}</span>
                    </div>
                  </div>

                  {/* 6. Net Income Summary */}
                  <div className={`p-6 sm:px-8 border-t-4 ${netIncome >= 0 ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-rose-600 border-rose-700 text-white'}`}>
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                      <h3 className="text-xl sm:text-2xl font-black">
                        {netIncome >= 0 ? 'صافي الربح' : 'صافي الخسارة'}
                      </h3>
                      <span className="font-mono font-black text-2xl sm:text-3xl">{formatMoney(Math.abs(netIncome))} {currencySymbol}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* BALANCE SHEET DETAILS */}
              {selectedReport === 'BALANCE' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2">
                  
                  {/* Assets Column */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden print:border-none print:shadow-none h-fit flex flex-col">
                    <div className="bg-blue-50/80 p-4 sm:px-6 border-b border-slate-200">
                      <h3 className="text-lg font-black text-blue-900 flex items-center gap-2">
                        <Building2 size={18} />
                        <span>الأصول (الموجودات)</span>
                      </h3>
                    </div>
                    <div className="divide-y divide-slate-100 flex-1">
                      {assets.length > 0 ? assets.map((row, idx) => (
                        <div key={idx} onClick={() => setSelectedLedgerAccount(row)} className="flex justify-between items-center p-3.5 sm:px-6 hover:bg-blue-50/50 transition-colors cursor-pointer group">
                          <span className="text-sm font-bold text-slate-700 group-hover:text-blue-700 transition-colors flex items-center gap-1.5"><BookOpen size={14} className="text-slate-400 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all" />{row.account.code} - {row.account.name}</span>
                          <span className="font-mono font-bold text-slate-900">{formatMoney(row.endingDebit - row.endingCredit)}</span>
                        </div>
                      )) : (
                        <div className="p-5 text-center text-slate-400 text-sm font-medium">لا توجد أصول</div>
                      )}
                    </div>
                    <div className="flex justify-between items-center p-4 sm:px-6 bg-blue-600 text-white mt-auto">
                      <span className="text-base font-black">إجمالي الأصول</span>
                      <span className="font-mono font-black text-lg">{formatMoney(totalAssets)} {currencySymbol}</span>
                    </div>
                  </div>

                  {/* Liabilities and Equity Column */}
                  <div className="flex flex-col gap-6">
                    
                    {/* Liabilities */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden print:border-none print:shadow-none">
                      <div className="bg-rose-50/80 p-4 sm:px-6 border-b border-slate-200">
                        <h3 className="text-lg font-black text-rose-900 flex items-center gap-2">
                          <TrendingUp size={18} className="rotate-180" />
                          <span>الخصوم (الالتزامات)</span>
                        </h3>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {liabilities.length > 0 ? liabilities.map((row, idx) => (
                          <div key={idx} onClick={() => setSelectedLedgerAccount(row)} className="flex justify-between items-center p-3.5 sm:px-6 hover:bg-blue-50/50 transition-colors cursor-pointer group">
                            <span className="text-sm font-bold text-slate-700 group-hover:text-blue-700 transition-colors flex items-center gap-1.5"><BookOpen size={14} className="text-slate-400 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all" />{row.account.code} - {row.account.name}</span>
                            <span className="font-mono font-bold text-slate-900">{formatMoney(row.endingCredit - row.endingDebit)}</span>
                          </div>
                        )) : (
                          <div className="p-5 text-center text-slate-400 text-sm font-medium">لا توجد خصوم</div>
                        )}
                      </div>
                      <div className="flex justify-between items-center p-4 sm:px-6 bg-rose-50/50 border-t-2 border-rose-100">
                        <span className="text-sm font-black text-rose-800">إجمالي الخصوم</span>
                        <span className="font-mono font-bold text-rose-700 text-lg">{formatMoney(totalLiabilities)}</span>
                      </div>
                    </div>

                    {/* Equity */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden print:border-none print:shadow-none">
                      <div className="bg-indigo-50/80 p-4 sm:px-6 border-b border-slate-200">
                        <h3 className="text-lg font-black text-indigo-900 flex items-center gap-2">
                          <Scale size={18} />
                          <span>حقوق الملكية</span>
                        </h3>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {equity.length > 0 && equity.map((row, idx) => (
                          <div key={idx} onClick={() => setSelectedLedgerAccount(row)} className="flex justify-between items-center p-3.5 sm:px-6 hover:bg-blue-50/50 transition-colors cursor-pointer group">
                            <span className="text-sm font-bold text-slate-700 group-hover:text-blue-700 transition-colors flex items-center gap-1.5"><BookOpen size={14} className="text-slate-400 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all" />{row.account.code} - {row.account.name}</span>
                            <span className="font-mono font-bold text-slate-900">{formatMoney(row.endingCredit - row.endingDebit)}</span>
                          </div>
                        ))}
                        
                        {/* Auto-injected Net Income from Income Statement */}
                        <div className="flex justify-between items-center p-4 sm:px-6 bg-yellow-50/50">
                          <span className="text-sm font-bold text-yellow-800 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                            صافي أرباح (خسائر) الفترة
                          </span>
                          <span className="font-mono font-bold text-yellow-900">{formatMoney(netIncome)}</span>
                        </div>

                      </div>
                      <div className="flex justify-between items-center p-4 sm:px-6 bg-indigo-50/50 border-t-2 border-indigo-100">
                        <span className="text-sm font-black text-indigo-800">إجمالي حقوق الملكية</span>
                        <span className="font-mono font-bold text-indigo-700 text-lg">{formatMoney(totalEquity)}</span>
                      </div>
                    </div>

                    {/* Grand Total L+E */}
                    <div className={`flex justify-between items-center p-4 sm:px-6 rounded-2xl text-white mt-auto shadow-md ${
                      Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01 ? 'bg-indigo-600' : 'bg-rose-600'
                    }`}>
                      <span className="text-base font-black">إجمالي الخصوم وحقوق الملكية</span>
                      <span className="font-mono font-black text-xl">{formatMoney(totalLiabilitiesAndEquity)} {currencySymbol}</span>
                    </div>
                    
                    {Math.abs(totalAssets - totalLiabilitiesAndEquity) > 0.01 && (
                      <div className="p-4 bg-rose-100 text-rose-800 text-sm font-bold rounded-xl flex items-center justify-between border-2 border-rose-200">
                        <span className="flex items-center gap-2">
                          <X size={16} /> يوجد عدم توازن (فرق)!
                        </span>
                        <span className="font-mono">{formatMoney(Math.abs(totalAssets - totalLiabilitiesAndEquity))}</span>
                      </div>
                    )}

                  </div>
                </div>
              )}
              {/* CASH FLOW STATEMENT DETAILS */}
              {selectedReport === 'CASH_FLOW' && (
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Top Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                      <div className="text-slate-500 text-xs font-bold mb-1">صافي التدفق التشغيلي</div>
                      <div className={`text-xl font-mono font-black ${operatingCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatMoney(operatingCashFlow)} {currencySymbol}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">النشاط التجاري والعمليات اليومية</span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                      <div className="text-slate-500 text-xs font-bold mb-1">صافي التدفق الاستثماري</div>
                      <div className={`text-xl font-mono font-black ${investingCashFlow >= 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {formatMoney(investingCashFlow)} {currencySymbol}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">الأصول والمعدات والممتلكات</span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                      <div className="text-slate-500 text-xs font-bold mb-1">صافي التدفق التمويلي</div>
                      <div className={`text-xl font-mono font-black ${financingCashFlow >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                        {formatMoney(financingCashFlow)} {currencySymbol}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">رأس المال والتمويل وحقوق الشركاء</span>
                    </div>
                  </div>

                  {/* Detailed Cash Flow Sections */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden print:border-none print:shadow-none">
                    
                    {/* 1. Operating Activities */}
                    <div className="bg-amber-50/80 p-4 sm:px-6 border-b border-slate-200 flex justify-between items-center">
                      <h3 className="text-lg font-black text-amber-900 flex items-center gap-2">
                        <TrendingUp size={18} />
                        <span>1. التدفقات النقدية من الأنشطة التشغيلية (Operating Activities)</span>
                      </h3>
                      <span className="font-mono font-black text-amber-900 text-base">{formatMoney(operatingCashFlow)} {currencySymbol}</span>
                    </div>
                    <div className="divide-y divide-slate-100 text-xs sm:text-sm">
                      <div className="flex justify-between items-center p-3.5 sm:px-6 hover:bg-slate-50">
                        <span className="font-bold text-slate-800">صافي الدخل من قائمة الدخل (Net Income)</span>
                        <span className={`font-mono font-bold ${netIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatMoney(netIncome)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3.5 sm:px-6 hover:bg-slate-50">
                        <span className="text-slate-700 font-medium">تعديل: (الزيادة) النقص في حسابات المدينين والعملاء</span>
                        <span className={`font-mono font-bold ${cashFromAr >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatMoney(cashFromAr)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3.5 sm:px-6 hover:bg-slate-50">
                        <span className="text-slate-700 font-medium">تعديل: (الزيادة) النقص في المخزون السلعي</span>
                        <span className={`font-mono font-bold ${cashFromInv >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatMoney(cashFromInv)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3.5 sm:px-6 hover:bg-slate-50">
                        <span className="text-slate-700 font-medium">تعديل: الزيادة (النقص) في حسابات الموردين والدائنين</span>
                        <span className={`font-mono font-bold ${cashFromAp >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatMoney(cashFromAp)}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 sm:px-6 bg-amber-50/50 border-t-2 border-amber-100 font-black">
                        <span className="text-amber-900">صافي النقد المتوفر من الأنشطة التشغيلية</span>
                        <span className="font-mono text-amber-800 text-base">{formatMoney(operatingCashFlow)}</span>
                      </div>
                    </div>

                    {/* 2. Investing Activities */}
                    <div className="bg-slate-50 p-4 sm:px-6 border-b border-t-2 border-slate-200 flex justify-between items-center">
                      <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <Building2 size={18} />
                        <span>2. التدفقات النقدية من الأنشطة الاستثمارية (Investing Activities)</span>
                      </h3>
                      <span className="font-mono font-black text-slate-800 text-base">{formatMoney(investingCashFlow)} {currencySymbol}</span>
                    </div>
                    <div className="divide-y divide-slate-100 text-xs sm:text-sm">
                      <div className="flex justify-between items-center p-3.5 sm:px-6 hover:bg-slate-50">
                        <span className="text-slate-700 font-medium">صافي التغير في الأصول الثابتة والمشروعات الرأسمالية</span>
                        <span className="font-mono font-bold text-slate-800">{formatMoney(investingCashFlow)}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 sm:px-6 bg-slate-100/50 border-t-2 border-slate-200 font-black">
                        <span className="text-slate-900">صافي النقد المستخدم في الأنشطة الاستثمارية</span>
                        <span className="font-mono text-slate-800 text-base">{formatMoney(investingCashFlow)}</span>
                      </div>
                    </div>

                    {/* 3. Financing Activities */}
                    <div className="bg-indigo-50/70 p-4 sm:px-6 border-b border-t-2 border-slate-200 flex justify-between items-center">
                      <h3 className="text-lg font-black text-indigo-900 flex items-center gap-2">
                        <Scale size={18} />
                        <span>3. التدفقات النقدية من الأنشطة التمويلية (Financing Activities)</span>
                      </h3>
                      <span className="font-mono font-black text-indigo-900 text-base">{formatMoney(financingCashFlow)} {currencySymbol}</span>
                    </div>
                    <div className="divide-y divide-slate-100 text-xs sm:text-sm">
                      <div className="flex justify-between items-center p-3.5 sm:px-6 hover:bg-slate-50">
                        <span className="text-slate-700 font-medium">التغير في القروض والتسهيلات البنكية طويلة الأجل</span>
                        <span className="font-mono font-bold text-slate-800">{formatMoney(loanChange)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3.5 sm:px-6 hover:bg-slate-50">
                        <span className="text-slate-700 font-medium">التغير في رأس المال ومسحوبات وإيداعات الشركاء</span>
                        <span className="font-mono font-bold text-slate-800">{formatMoney(equityBaseChange)}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 sm:px-6 bg-indigo-50/50 border-t-2 border-indigo-100 font-black">
                        <span className="text-indigo-900">صافي النقد المتوفر من (المستخدم في) الأنشطة التمويلية</span>
                        <span className="font-mono text-indigo-800 text-base">{formatMoney(financingCashFlow)}</span>
                      </div>
                    </div>

                    {/* Reconciliation and Net Cash Position */}
                    <div className="p-6 sm:px-8 bg-slate-900 text-white border-t-4 border-amber-500">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm font-bold border-b border-slate-800 pb-2">
                          <span>صافي التغير في النقدية وما في حكمها للفترة:</span>
                          <span className={`font-mono text-base font-black ${calculatedNetCashChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatMoney(calculatedNetCashChange)} {currencySymbol}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-400">
                          <span>رصيد النقدية في بداية الفترة:</span>
                          <span className="font-mono font-bold text-slate-200">{formatMoney(beginningCashBalance)} {currencySymbol}</span>
                        </div>
                        <div className="flex justify-between items-center text-lg font-black text-amber-400 pt-2 border-t border-slate-700">
                          <span>رصيد النقدية وما في حكمها في نهاية الفترة:</span>
                          <span className="font-mono text-2xl">{formatMoney(endingCashBalance)} {currencySymbol}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cash Accounts Live Breakdown */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                    <h4 className="font-black text-slate-800 text-sm mb-3 flex items-center gap-2">
                      <Banknote size={16} className="text-emerald-600" />
                      <span>تفاصيل أرصدة الصناديق والبنوك المكونة للنقدية</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {cashAccounts.map((acc, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                          <div>
                            <p className="font-mono text-[10px] text-slate-400">{acc.account.code}</p>
                            <p className="text-xs font-bold text-slate-800">{acc.account.name}</p>
                          </div>
                          <span className="font-mono font-black text-xs text-slate-900">
                            {formatMoney(acc.endingDebit - acc.endingCredit)} {currencySymbol}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* MULTI-PERIOD COMPARISON DETAILS */}
              {selectedReport === 'COMPARISON' && (
                <div className="max-w-5xl mx-auto space-y-6">
                  {/* Period Selection Controls */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                    <h3 className="font-black text-slate-800 text-sm mb-4 flex items-center gap-2">
                      <ArrowRightLeft size={16} className="text-cyan-600" />
                      <span>تحديد نطاق الفترتين للمقارنة</span>
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Period 1 */}
                      <div className="p-4 bg-cyan-50/50 rounded-xl border border-cyan-100">
                        <span className="text-xs font-black text-cyan-900 block mb-2">الفترة الأولى (الفترة الحالية):</span>
                        <div className="flex items-center gap-2">
                          <input 
                            type="date" 
                            value={compPeriod1Start} 
                            onChange={(e) => setCompPeriod1Start(e.target.value)} 
                            className="px-2.5 py-1.5 bg-white border border-cyan-200 rounded-lg text-xs font-mono text-slate-800 w-full" 
                            placeholder="من"
                          />
                          <span className="text-xs text-slate-400 font-bold">إلى</span>
                          <input 
                            type="date" 
                            value={compPeriod1End} 
                            onChange={(e) => setCompPeriod1End(e.target.value)} 
                            className="px-2.5 py-1.5 bg-white border border-cyan-200 rounded-lg text-xs font-mono text-slate-800 w-full" 
                            placeholder="إلى"
                          />
                        </div>
                      </div>

                      {/* Period 2 */}
                      <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                        <span className="text-xs font-black text-purple-900 block mb-2">الفترة الثانية (الفترة المقارنة / السابقة):</span>
                        <div className="flex items-center gap-2">
                          <input 
                            type="date" 
                            value={compPeriod2Start} 
                            onChange={(e) => setCompPeriod2Start(e.target.value)} 
                            className="px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-xs font-mono text-slate-800 w-full" 
                            placeholder="من"
                          />
                          <span className="text-xs text-slate-400 font-bold">إلى</span>
                          <input 
                            type="date" 
                            value={compPeriod2End} 
                            onChange={(e) => setCompPeriod2End(e.target.value)} 
                            className="px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-xs font-mono text-slate-800 w-full" 
                            placeholder="إلى"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Comparative KPI Cards */}
                  {(() => {
                    const p1Revs = compPeriod1Rows.filter(r => r.account.type === AccountType.Revenue).reduce((s, r) => s + (r.endingCredit - r.endingDebit), 0);
                    const p2Revs = compPeriod2Rows.filter(r => r.account.type === AccountType.Revenue).reduce((s, r) => s + (r.endingCredit - r.endingDebit), 0);
                    const revDiff = p1Revs - p2Revs;
                    const revGrowth = p2Revs > 0 ? (revDiff / p2Revs) * 100 : (p1Revs > 0 ? 100 : 0);

                    const p1Exps = compPeriod1Rows.filter(r => r.account.type === AccountType.Expense).reduce((s, r) => s + (r.endingDebit - r.endingCredit), 0);
                    const p2Exps = compPeriod2Rows.filter(r => r.account.type === AccountType.Expense).reduce((s, r) => s + (r.endingDebit - r.endingCredit), 0);
                    const expDiff = p1Exps - p2Exps;

                    const p1Net = p1Revs - p1Exps;
                    const p2Net = p2Revs - p2Exps;
                    const netDiff = p1Net - p2Net;

                    return (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                            <span className="text-xs font-bold text-slate-500 block mb-1">مقارنة إجمالي الإيرادات</span>
                            <div className="flex items-baseline justify-between mb-2">
                              <span className="text-lg font-mono font-black text-cyan-700">{formatMoney(p1Revs)}</span>
                              <span className="text-sm font-mono text-purple-700">{formatMoney(p2Revs)}</span>
                            </div>
                            <div className={`text-xs font-black flex items-center gap-1 ${revDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              <span>{revDiff >= 0 ? '↑ نمو' : '↓ انخفاض'}: {Math.abs(revGrowth).toFixed(1)}%</span>
                              <span className="font-mono">({formatMoney(Math.abs(revDiff))} {currencySymbol})</span>
                            </div>
                          </div>

                          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                            <span className="text-xs font-bold text-slate-500 block mb-1">مقارنة إجمالي المصروفات</span>
                            <div className="flex items-baseline justify-between mb-2">
                              <span className="text-lg font-mono font-black text-cyan-700">{formatMoney(p1Exps)}</span>
                              <span className="text-sm font-mono text-purple-700">{formatMoney(p2Exps)}</span>
                            </div>
                            <div className={`text-xs font-black ${expDiff <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                              <span>{expDiff <= 0 ? 'وفورات في المصروفات' : 'زيادة في المصروفات'}: </span>
                              <span className="font-mono">{formatMoney(Math.abs(expDiff))} {currencySymbol}</span>
                            </div>
                          </div>

                          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                            <span className="text-xs font-bold text-slate-500 block mb-1">مقارنة صافي الأرباح</span>
                            <div className="flex items-baseline justify-between mb-2">
                              <span className={`text-lg font-mono font-black ${p1Net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatMoney(p1Net)}</span>
                              <span className={`text-sm font-mono ${p2Net >= 0 ? 'text-purple-700' : 'text-rose-700'}`}>{formatMoney(p2Net)}</span>
                            </div>
                            <div className={`text-xs font-black ${netDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              <span>فارق النتيجة: </span>
                              <span className="font-mono">{netDiff >= 0 ? '+' : ''}{formatMoney(netDiff)} {currencySymbol}</span>
                            </div>
                          </div>
                        </div>

                        {/* Comparative Breakdown Table */}
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                          <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                            <h4 className="font-bold text-sm">جدول مقارنة بنود الإيرادات والمصروفات بين الفترتين</h4>
                            <span className="text-xs text-slate-400">الفترة 1 (سماوي) مقابل الفترة 2 (بنفسجي)</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-right text-xs">
                              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                <tr>
                                  <th className="py-2.5 px-4">رقم الحساب</th>
                                  <th className="py-2.5 px-4">اسم الحساب</th>
                                  <th className="py-2.5 px-4">النوع</th>
                                  <th className="py-2.5 px-4 text-left text-cyan-800">الفترة الأولى</th>
                                  <th className="py-2.5 px-4 text-left text-purple-800">الفترة الثانية</th>
                                  <th className="py-2.5 px-4 text-left">الفارق (الانحراف)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {compPeriod1Rows.filter(r => r.account.type === AccountType.Revenue || r.account.type === AccountType.Expense).map((row, idx) => {
                                  const matchingP2 = compPeriod2Rows.find(r2 => r2.account.id === row.account.id);
                                  const isRev = row.account.type === AccountType.Revenue;
                                  const val1 = isRev ? (row.endingCredit - row.endingDebit) : (row.endingDebit - row.endingCredit);
                                  const val2 = matchingP2 ? (isRev ? (matchingP2.endingCredit - matchingP2.endingDebit) : (matchingP2.endingDebit - matchingP2.endingCredit)) : 0;
                                  const diff = val1 - val2;

                                  return (
                                    <tr key={idx} className="hover:bg-slate-50 font-medium">
                                      <td className="py-2 px-4 font-mono text-slate-600">{row.account.code}</td>
                                      <td className="py-2 px-4 text-slate-800 font-bold">{row.account.name}</td>
                                      <td className="py-2 px-4">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isRev ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                          {isRev ? 'إيراد' : 'مصروف'}
                                        </span>
                                      </td>
                                      <td className="py-2 px-4 font-mono font-bold text-left text-cyan-900">{formatMoney(val1)}</td>
                                      <td className="py-2 px-4 font-mono font-bold text-left text-purple-900">{formatMoney(val2)}</td>
                                      <td className={`py-2 px-4 font-mono font-black text-left ${diff > 0 ? (isRev ? 'text-emerald-600' : 'text-amber-600') : diff < 0 ? (isRev ? 'text-rose-600' : 'text-emerald-600') : 'text-slate-400'}`}>
                                        {diff > 0 ? '+' : ''}{formatMoney(diff)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {selectedReport === "RATIOS" && (
                <div className="max-w-5xl mx-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    
                    {/* Net Profit Margin */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-slate-500 text-xs font-bold mb-1">هامش صافي الربح</p>
                          <h4 className="text-2xl font-black text-slate-800">{netProfitMargin.toFixed(1)}%</h4>
                        </div>
                        <div className={`p-2 rounded-xl ${netProfitMargin >= 10 ? "bg-emerald-100 text-emerald-600" : netProfitMargin > 0 ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"}`}>
                          <Percent size={20} />
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
                        <div className={`h-1.5 rounded-full ${netProfitMargin >= 10 ? "bg-emerald-500" : netProfitMargin > 0 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${Math.min(Math.max(netProfitMargin, 0), 100)}%` }}></div>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        المثالي: &gt; 10% | يمثل نسبة الأرباح الصافية من إجمالي الإيرادات
                      </p>
                    </div>

                    {/* Gross Profit Margin */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-slate-500 text-xs font-bold mb-1">هامش مجمل الربح</p>
                          <h4 className="text-2xl font-black text-slate-800">{grossProfitMargin.toFixed(1)}%</h4>
                        </div>
                        <div className={`p-2 rounded-xl ${grossProfitMargin >= 20 ? "bg-emerald-100 text-emerald-600" : grossProfitMargin > 0 ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"}`}>
                          <TrendingUp size={20} />
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
                        <div className={`h-1.5 rounded-full ${grossProfitMargin >= 20 ? "bg-emerald-500" : grossProfitMargin > 0 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${Math.min(Math.max(grossProfitMargin, 0), 100)}%` }}></div>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        مدى الكفاءة في تسعير المنتجات والتحكم في تكلفة المبيعات
                      </p>
                    </div>

                    {/* Current Ratio */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-slate-500 text-xs font-bold mb-1">نسبة التداول (السيولة)</p>
                          <h4 className="text-2xl font-black text-slate-800">{currentRatio === Infinity ? "ممتاز" : currentRatio.toFixed(2)}</h4>
                        </div>
                        <div className={`p-2 rounded-xl ${currentRatio >= 1.5 || currentRatio === Infinity ? "bg-blue-100 text-blue-600" : currentRatio >= 1.0 ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"}`}>
                          <Activity size={20} />
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
                        <div className={`h-1.5 rounded-full ${currentRatio >= 1.5 || currentRatio === Infinity ? "bg-blue-500" : currentRatio >= 1.0 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${Math.min(currentRatio === Infinity ? 100 : (currentRatio / 3) * 100, 100)}%` }}></div>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        المثالي: 1.5 إلى 2 | قدرة الشركة على سداد التزاماتها قصيرة الأجل
                      </p>
                    </div>

                    {/* Debt Ratio */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-slate-500 text-xs font-bold mb-1">نسبة المديونية</p>
                          <h4 className="text-2xl font-black text-slate-800">{debtRatio.toFixed(1)}%</h4>
                        </div>
                        <div className={`p-2 rounded-xl ${debtRatio <= 40 ? "bg-emerald-100 text-emerald-600" : debtRatio <= 60 ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"}`}>
                          <Scale size={20} />
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
                        <div className={`h-1.5 rounded-full ${debtRatio <= 40 ? "bg-emerald-500" : debtRatio <= 60 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${Math.min(Math.max(debtRatio, 0), 100)}%` }}></div>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        المثالي: &lt; 50% | نسبة تمويل الأصول عن طريق الديون
                      </p>
                    </div>

                    {/* Return on Equity (ROE) */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-slate-500 text-xs font-bold mb-1">العائد على حقوق الملكية</p>
                          <h4 className="text-2xl font-black text-slate-800">{roe.toFixed(1)}%</h4>
                        </div>
                        <div className={`p-2 rounded-xl ${roe >= 15 ? "bg-emerald-100 text-emerald-600" : roe > 0 ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"}`}>
                          <Target size={20} />
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
                        <div className={`h-1.5 rounded-full ${roe >= 15 ? "bg-emerald-500" : roe > 0 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${Math.min(Math.max(roe, 0), 100)}%` }}></div>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        المثالي: &gt; 15% | كفاءة الشركة في توليد أرباح من استثمارات الملاك
                      </p>
                    </div>

                  </div>

                  {/* Detailed Explanation Section */}
                  <div className="mt-8 bg-blue-50/50 rounded-2xl p-6 border border-blue-100">
                    <h3 className="text-blue-900 font-black mb-4 flex items-center gap-2">
                      <Activity size={18} />
                      قراءة تحليلية سريعة
                    </h3>
                    <ul className="space-y-3 text-sm text-blue-800 font-medium">
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></span>
                        {netProfitMargin >= 10 ? "هامش الربح ممتاز، مما يدل على كفاءة عالية في إدارة التكاليف التشغيلية." : netProfitMargin > 0 ? "الشركة تحقق أرباحاً، لكن يُنصح بمراجعة التكاليف لتحسين الهامش." : "الشركة تحقق خسائر، هناك حاجة ماسة لخفض التكاليف أو زيادة الإيرادات."}
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></span>
                        {currentRatio >= 1.5 || currentRatio === Infinity ? "مستوى السيولة آمن جداً، الشركة قادرة على الوفاء بالتزاماتها بسهولة." : currentRatio >= 1 ? "السيولة مقبولة، لكن يجب الحذر في إدارة النقدية." : "يوجد خطر نقص سيولة محتمل للوفاء بالالتزامات قصيرة الأجل."}
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></span>
                        {debtRatio > 60 ? "نسبة المديونية مرتفعة، مما قد يشكل مخاطرة مالية في حالة تقلب الإيرادات." : "هيكل رأس المال متوازن ولا يوجد اعتماد مفرط على الديون."}
                      </li>
                    </ul>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Account Ledger Movement Detail Modal */}
      {selectedLedgerAccount && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs print:hidden overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-none sm:max-h-[85vh] flex flex-col sm:overflow-hidden overflow-y-auto my-auto">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between static sm:sticky sm:top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-600 rounded-lg">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    كشف حركة الحساب: <span className="text-blue-300 font-mono">{selectedLedgerAccount.account.code}</span> - {selectedLedgerAccount.account.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    تصنيف الحساب: {getAccountTypeLabel(selectedLedgerAccount.account.type)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLedgerAccount(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Account Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 border-b border-slate-200 text-xs">
              <div className="p-2 bg-white rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px] font-bold">إجمالي حركة المدين</span>
                <span className="font-mono font-black text-slate-900">
                  {selectedLedgerAccount.debitMovement.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                </span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px] font-bold">إجمالي حركة الدائن</span>
                <span className="font-mono font-black text-slate-900">
                  {selectedLedgerAccount.creditMovement.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                </span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px] font-bold">صافي الرصيد النهائي</span>
                <span className={`font-mono font-black ${selectedLedgerAccount.netMovement >= 0 ? "text-emerald-700" : "text-purple-700"}`}>
                  {Math.abs(selectedLedgerAccount.netMovement).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                </span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px] font-bold">طبيعة الرصيد</span>
                <span className="font-bold text-slate-800">
                  {selectedLedgerAccount.netMovement > 0 ? "مدين (Debit)" : selectedLedgerAccount.netMovement < 0 ? "دائن (Credit)" : "متوازن (Zero)"}
                </span>
              </div>
            </div>

            {/* Ledger Movements Table */}
            <div className="flex-1 overflow-y-auto p-4">
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
                        if (source === "SALES_INVOICE" || source === "فواتير المبيعات" || item.source === "SALES") {
                          return { label: item.sourceLabel || "فاتورة مبيعات", view: "sales", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
                        }
                        if (source === "PURCHASE_INVOICE" || source === "فواتير المشتريات" || item.source === "PURCHASE") {
                          return { label: item.sourceLabel || "فاتورة مشتريات", view: "purchases", color: "bg-rose-50 text-rose-700 border-rose-200" };
                        }
                        switch (source) {
                          case "EXTERNAL_RECEIPT":
                            return { label: "سند قبض عميل", view: "externalReceipt", color: "bg-blue-50 text-blue-700 border-blue-200" };
                          case "EXTERNAL_PAYMENT":
                            return { label: "سند صرف مورد", view: "externalPayment", color: "bg-amber-50 text-amber-700 border-amber-200" };
                          case "INTERNAL_RECEIPT":
                            return { label: "قبض داخلي", view: "internalReceipt", color: "bg-indigo-50 text-indigo-700 border-indigo-200" };
                          case "INTERNAL_PAYMENT":
                            return { label: "صرف داخلي", view: "internalPayment", color: "bg-orange-50 text-orange-700 border-orange-200" };
                          case "INVENTORY_AUDIT":
                            return { label: "تسوية جرد", view: "inventoryCount", color: "bg-purple-50 text-purple-700 border-purple-200" };
                          case "PAYROLL":
                            return { label: "مسير رواتب", view: "payroll", color: "bg-teal-50 text-teal-700 border-teal-200" };
                          case "MANUFACTURING":
                            return { label: "أمر تصنيع", view: "manufacturing", color: "bg-cyan-50 text-cyan-700 border-cyan-200" };
                          default:
                            return { label: "قيد يومية عام", view: "journal", color: "bg-slate-100 text-slate-700 border-slate-200" };
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
                            {item.debit > 0 ? item.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-left text-purple-700">
                            {item.credit > 0 ? item.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-left text-slate-900">
                            {item.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            <span className="text-[10px] text-slate-400 mr-1">
                              ({item.balanceType === "DEBIT" ? "مدين" : item.balanceType === "CREDIT" ? "دائن" : "-"})
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLedgerAccount(null);
                                if (onNavigate) onNavigate(src.view);
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
            {/* Modal Footer */}
            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLedgerAccount(null)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
