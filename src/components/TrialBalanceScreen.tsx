import { useState, useMemo, useEffect } from 'react';
import { 
  Printer, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  FileSpreadsheet, 
  Eye, 
  Layers,
  X,
  BookOpen
} from 'lucide-react';
import { AccountType } from '../types/accounting';
import { 
  calculateTrialBalance, 
  getAccountLedgerMovements
} from '../utils/trialBalanceStore';
import { getSystemSettings } from '../utils/settings';
import { useLanguage } from '../i18n/LanguageContext';

export default function TrialBalanceScreen() {
  const { t } = useLanguage();
  const [systemSettings] = useState(() => getSystemSettings());
  
  // Filter States
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>('ALL');
  const [hideZeroBalances, setHideZeroBalances] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'TOTALS_AND_BALANCES' | 'BALANCES_ONLY' | 'MOVEMENTS_ONLY'>('TOTALS_AND_BALANCES');

  // Selected Account for Ledger Detail Modal
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  
  // Revision counter for live updates
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Subscribe to updates
  useEffect(() => {
    const handleUpdate = () => setRefreshKey(prev => prev + 1);
    window.addEventListener('alpha-journal-entries-updated', handleUpdate);
    window.addEventListener('alpha-chart-of-accounts-updated', handleUpdate);
    return () => {
      window.removeEventListener('alpha-journal-entries-updated', handleUpdate);
      window.removeEventListener('alpha-chart-of-accounts-updated', handleUpdate);
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

  // Filter rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows.filter(r => 
      r.account.code.toLowerCase().includes(q) ||
      r.account.name.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  // Selected account for ledger modal
  const selectedRow = useMemo(() => {
    if (!selectedAccountId) return null;
    return rows.find(r => r.account.id === selectedAccountId || r.account.code === selectedAccountId) || null;
  }, [rows, selectedAccountId]);

  const selectedLedgerItems = useMemo(() => {
    if (!selectedAccountId) return [];
    return getAccountLedgerMovements(selectedAccountId, startDate || undefined, endDate || undefined);
  }, [selectedAccountId, startDate, endDate, refreshKey]);

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

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['كود الحساب', 'اسم الحساب', 'نوع الحساب', 'حركة مدين', 'حركة دائن', 'رصيد مدين', 'رصيد دائن'];
    const csvLines = [headers.join(',')];

    filteredRows.forEach(r => {
      const line = [
        `"${r.account.code}"`,
        `"${r.account.name}"`,
        `"${getAccountTypeLabel(r.account.type)}"`,
        r.debitMovement,
        r.creditMovement,
        r.endingDebit,
        r.endingCredit
      ];
      csvLines.push(line.join(','));
    });

    // Add Totals Line
    csvLines.push([
      '"المجموع الإجمالي"',
      '""',
      '""',
      totals.totalDebitMovement,
      totals.totalCreditMovement,
      totals.totalEndingDebit,
      totals.totalEndingCredit
    ].join(','));

    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ميزان_المراجعة_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    <div className="flex flex-col flex-1 p-3 sm:p-6 space-y-5 max-w-[1600px] mx-auto w-full">
      
      {/* Printable Header Section (visible only when printing) */}
      <div className="hidden print:block text-slate-900 pb-4 mb-6 border-b border-slate-300">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold">{systemSettings.company.nameAr || 'لوجوستريا للمحاسبة والأنظمة المالية'}</h1>
            <p className="text-xs text-slate-600 mt-1">الرقم الضريبي: {systemSettings.company.taxNumber || '300000000000003'}</p>
            <p className="text-xs text-slate-600">{systemSettings.company.address || 'الفرع الرئيسي - المملكة العربية السعودية'}</p>
          </div>
          <div className="text-left">
            <h2 className="text-xl font-bold text-blue-900">ميزان المراجعة بالمجاميع والأرصدة</h2>
            <p className="text-xs text-slate-500 mt-1">تاريخ الطباعة: {new Date().toLocaleDateString('ar-SA')}</p>
            <p className="text-xs text-slate-500">
              الفترة: {startDate || 'من بداية النظام'} إلى {endDate || 'حتى تاريخه'}
            </p>
          </div>
        </div>
      </div>

      {/* Screen Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
              <BookOpen size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {t('nav_trialBalance', 'ميزان المراجعة')}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                تقرير توازن ومطابقة الحسابات العامة (المجاميع والأرصدة) بناءً على جميع القيود والعمليات
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            <Printer size={15} />
            <span>طباعة الميزان</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            <FileSpreadsheet size={15} />
            <span>تصدير Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setRefreshKey(prev => prev + 1)}
            className="p-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs transition-colors cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw size={16} />
          </button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          
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

          {/* Category Filter */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 mb-1 block">تصنيف الحساب</label>
            <select
              value={accountTypeFilter}
              onChange={(e) => setAccountTypeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-blue-500 text-slate-800 font-bold"
            >
              <option value="ALL">جميع التبويبات (الكل)</option>
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
                filteredRows.map((row) => (
                  <tr 
                    key={row.account.id} 
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Account Code */}
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 border-l border-slate-100">
                      {row.account.code}
                    </td>

                    {/* Account Name */}
                    <td className="py-2.5 px-4 font-bold text-slate-900 border-l border-slate-100">
                      {row.account.name}
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
                      <button
                        type="button"
                        onClick={() => setSelectedAccountId(row.account.id)}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="عرض كشف وتفاصيل الحركة"
                      >
                        <Eye size={15} />
                      </button>
                    </td>

                  </tr>
                ))
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

      {/* Official Audit & Signatures Box (Print Only) */}
      <div className="hidden print:block pt-10 mt-8 border-t border-slate-300">
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

      {/* Account Ledger Movement Detail Modal */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs print:hidden">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-600 rounded-lg">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    كشف حركة الحساب: <span className="text-blue-300 font-mono">{selectedRow.account.code}</span> - {selectedRow.account.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    تصنيف الحساب: {getAccountTypeLabel(selectedRow.account.type)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAccountId(null)}
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
                  {selectedRow.debitMovement.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                </span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px] font-bold">إجمالي حركة الدائن</span>
                <span className="font-mono font-black text-slate-900">
                  {selectedRow.creditMovement.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                </span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px] font-bold">صافي الرصيد النهائي</span>
                <span className={`font-mono font-black ${selectedRow.netMovement >= 0 ? 'text-emerald-700' : 'text-purple-700'}`}>
                  {Math.abs(selectedRow.netMovement).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                </span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px] font-bold">طبيعة الرصيد</span>
                <span className="font-bold text-slate-800">
                  {selectedRow.netMovement > 0 ? 'مدين (Debit)' : selectedRow.netMovement < 0 ? 'دائن (Credit)' : 'متوازن (Zero)'}
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
                      <th className="py-2 px-3 border-b border-slate-200 w-24">المرجع</th>
                      <th className="py-2 px-3 border-b border-slate-200">البيان / الوصف</th>
                      <th className="py-2 px-3 border-b border-slate-200 text-left w-28 text-blue-700">مدين</th>
                      <th className="py-2 px-3 border-b border-slate-200 text-left w-28 text-purple-700">دائن</th>
                      <th className="py-2 px-3 border-b border-slate-200 text-left w-28">الرصيد التراكمي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedLedgerItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-slate-600">{item.date}</td>
                        <td className="py-2 px-3 font-mono font-bold text-blue-700">{item.entryNumber}</td>
                        <td className="py-2 px-3 text-slate-500">{item.reference}</td>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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

    </div>
  );
}
