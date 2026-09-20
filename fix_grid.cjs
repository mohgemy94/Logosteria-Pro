const fs = require('fs');
const p = 'src/components/DashboardScreen.tsx';
let content = fs.readFileSync(p, 'utf-8');

const regex = /\{\/\* KPI Cards Row \*\/\}[\s\S]*?(?=\{\/\* Smart Alerts & Control Center)/;

const newKpiRow = `
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
            <p className={\`text-2xl font-black font-mono \${financialTotals.netProfit >= 0 ? 'text-indigo-700' : 'text-rose-600'}\`}>
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
      
      `;
      
content = content.replace(regex, newKpiRow);
fs.writeFileSync(p, content);
