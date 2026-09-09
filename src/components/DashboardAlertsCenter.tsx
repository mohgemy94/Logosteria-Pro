import { useState, useMemo, useEffect } from 'react';
import { 
  AlertTriangle, ShieldAlert, Package, TrendingDown, 
  ChevronDown, ChevronUp, RefreshCw, ShoppingCart, 
  ArrowRight, CheckCircle2, FileText, 
  AlertCircle
} from 'lucide-react';
import { computeDashboardAlerts, DashboardAlertsData } from '../utils/alerts';
import { useSystemCurrency } from '../utils/currency';

interface DashboardAlertsCenterProps {
  onNavigate: (view: string) => void;
}

export default function DashboardAlertsCenter({ onNavigate }: DashboardAlertsCenterProps) {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [alertsData, setAlertsData] = useState<DashboardAlertsData>(() => computeDashboardAlerts());
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'LOW_STOCK' | 'BELOW_COST'>('ALL');
  const [criticalOnly, setCriticalOnly] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh alerts on data changes
  const refreshAlerts = () => {
    setIsRefreshing(true);
    const updated = computeDashboardAlerts();
    setAlertsData(updated);
    setTimeout(() => setIsRefreshing(false), 300);
  };

  useEffect(() => {
    const handleStorageChange = () => refreshAlerts();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('accounting-data-changed', handleStorageChange);
    window.addEventListener('alpha-settings-updated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('accounting-data-changed', handleStorageChange);
      window.removeEventListener('alpha-settings-updated', handleStorageChange);
    };
  }, []);

  const { lowStockAlerts, belowCostSalesAlerts, summary } = alertsData;

  // Filtered datasets
  const filteredLowStock = useMemo(() => {
    if (criticalOnly) {
      return lowStockAlerts.filter(a => a.severity === 'CRITICAL');
    }
    return lowStockAlerts;
  }, [lowStockAlerts, criticalOnly]);

  const filteredBelowCost = useMemo(() => {
    if (criticalOnly) {
      return belowCostSalesAlerts.filter(a => a.severity === 'CRITICAL');
    }
    return belowCostSalesAlerts;
  }, [belowCostSalesAlerts, criticalOnly]);

  const hasAlerts = summary.totalAlertsCount > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden mb-6 transition-all duration-200">
      {/* Top Header Banner */}
      <div 
        className={`px-5 py-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
          summary.criticalCount > 0 
            ? 'bg-gradient-to-r from-rose-50/90 via-amber-50/40 to-white border-b border-rose-100' 
            : hasAlerts 
            ? 'bg-gradient-to-r from-amber-50/70 via-slate-50 to-white border-b border-amber-100' 
            : 'bg-gradient-to-r from-emerald-50/70 via-slate-50 to-white border-b border-emerald-100'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
            summary.criticalCount > 0 
              ? 'bg-rose-600 text-white animate-pulse' 
              : hasAlerts 
              ? 'bg-amber-500 text-white' 
              : 'bg-emerald-600 text-white'
          }`}>
            {summary.criticalCount > 0 ? (
              <ShieldAlert size={22} />
            ) : hasAlerts ? (
              <AlertTriangle size={22} />
            ) : (
              <CheckCircle2 size={22} />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                مركز التنبيهات والرقابة الذكية
              </h2>
              {hasAlerts ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping"></span>
                  {summary.totalAlertsCount} تنبيه نشط
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  مستقر وآمن
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              رصد فوري لانخفاض المخزون عن حد الطلب ومتابعة فواتير المبيعات المباعة بأقل من سعر التكلفة
            </p>
          </div>
        </div>

        {/* Quick KPI Badges in Header */}
        <div className="flex items-center gap-2 mr-auto sm:mr-0">
          {summary.outOfStockCount > 0 && (
            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg text-xs font-bold">
              <AlertCircle size={13} className="text-rose-600" />
              <span>{summary.outOfStockCount} نفاد مخزون</span>
            </span>
          )}

          {summary.lowStockCount > 0 && (
            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg text-xs font-bold">
              <Package size={13} className="text-amber-600" />
              <span>{summary.lowStockCount} تحت حد الطلب</span>
            </span>
          )}

          {summary.belowCostInvoicesCount > 0 && (
            <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-800 border border-purple-200 px-2.5 py-1 rounded-lg text-xs font-bold">
              <TrendingDown size={13} className="text-purple-600" />
              <span>{summary.belowCostInvoicesCount} فواتير تحت التكلفة</span>
              <span className="text-[11px] font-mono text-rose-600 font-extrabold mr-1">
                (-{summary.totalBelowCostLoss.toLocaleString()} {currencySymbol})
              </span>
            </span>
          )}

          {/* Refresh & Toggle Buttons */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              refreshAlerts();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="تحديث البيانات فورياً"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-blue-600' : ''} />
          </button>

          <button
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title={isExpanded ? 'طي التنبيهات' : 'توسيع التنبيهات'}
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Expandable Body */}
      {isExpanded && (
        <div className="p-5 border-t border-slate-100">
          {!hasAlerts ? (
            /* Empty / Safe State */
            <div className="py-8 px-4 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-3 border border-emerald-100 shadow-2xs">
                <CheckCircle2 size={30} />
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">
                جميع المؤشرات المخزنية والمالية في المنطقة الآمنة
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                لا توجد أصناف منخفضة عن حد الطلب المحدد، كما أن كافة فواتير المبيعات المسجلة تم بيعها بهوامش ربح أعلى من متوسط التكلفة (م.س.ت).
              </p>
            </div>
          ) : (
            /* Active Alerts Section */
            <div>
              {/* Tab Filters Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActiveTab('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'ALL'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>كافة التنبيهات</span>
                    <span className="mr-1.5 bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                      {summary.totalAlertsCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('LOW_STOCK')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'LOW_STOCK'
                        ? 'bg-white text-amber-800 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Package size={13} className="text-amber-500" />
                    <span>تنبيهات حد الطلب والمخزون</span>
                    <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold">
                      {lowStockAlerts.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('BELOW_COST')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'BELOW_COST'
                        ? 'bg-white text-rose-800 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TrendingDown size={13} className="text-rose-500" />
                    <span>فواتير بيعت بأقل من التكلفة</span>
                    <span className="bg-rose-100 text-rose-800 text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold">
                      {belowCostSalesAlerts.length}
                    </span>
                  </button>
                </div>

                {/* Filter toggle: Critical only */}
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={criticalOnly}
                      onChange={(e) => setCriticalOnly(e.target.checked)}
                      className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-medium text-slate-700">الحرجة فقط (نفاد / خسارة عالية)</span>
                  </label>
                </div>
              </div>

              {/* Grid content based on active tab */}
              <div className="space-y-4">
                {/* 1. Low Stock Alerts Section */}
                {(activeTab === 'ALL' || activeTab === 'LOW_STOCK') && filteredLowStock.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <Package size={15} className="text-amber-600" />
                        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                          أصناف هبط رصيدها عن حد الطلب المحدد ({filteredLowStock.length})
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate('warehouseBalances')}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline flex items-center gap-1"
                      >
                        <span>فتح بطاقات المخزن</span>
                        <ArrowRight size={12} className="rotate-180" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredLowStock.map((alertItem) => (
                        <div
                          key={alertItem.id}
                          className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                            alertItem.status === 'OUT_OF_STOCK'
                              ? 'bg-rose-50/40 border-rose-200/80 hover:border-rose-300'
                              : 'bg-amber-50/30 border-amber-200/80 hover:border-amber-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono text-[11px] text-slate-500 bg-white/80 px-2 py-0.5 rounded border border-slate-200/60">
                                كود: #{alertItem.code}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  alertItem.status === 'OUT_OF_STOCK'
                                    ? 'bg-rose-100 text-rose-800 border-rose-200'
                                    : 'bg-amber-100 text-amber-800 border-amber-200'
                                }`}
                              >
                                {alertItem.status === 'OUT_OF_STOCK' ? '🔴 نفاد تام من المخزن' : '⚠️ هبط عن حد الطلب'}
                              </span>
                            </div>

                            <h4 className="text-sm font-bold text-slate-900 leading-snug mb-1">
                              {alertItem.name}
                            </h4>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                              <span>التصنيف: <strong className="text-slate-700">{alertItem.category}</strong></span>
                              <span>•</span>
                              <span>الوحدة: <strong className="text-slate-700">{alertItem.unit}</strong></span>
                            </div>

                            {/* Inventory Metrics Box */}
                            <div className="bg-white/90 p-2.5 rounded-lg border border-slate-200/70 mb-3 grid grid-cols-3 gap-2 text-center text-xs">
                              <div>
                                <span className="text-[10px] text-slate-400 block mb-0.5">المخزون الحالي</span>
                                <span className={`font-mono font-extrabold text-sm ${
                                  alertItem.currentStock <= 0 ? 'text-rose-600' : 'text-amber-700'
                                }`}>
                                  {alertItem.currentStock}
                                </span>
                              </div>
                              <div className="border-x border-slate-100">
                                <span className="text-[10px] text-slate-400 block mb-0.5">حد الطلب (الآمن)</span>
                                <span className="font-mono font-bold text-slate-700 text-sm">
                                  {alertItem.minReorderLevel}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block mb-0.5">العجز المطلوب</span>
                                <span className="font-mono font-bold text-rose-600 text-sm">
                                  +{alertItem.shortage}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-1.5">
                            <button
                              type="button"
                              onClick={() => onNavigate('purchases')}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                              title="إنشاء أمر شراء وتوريد فوري"
                            >
                              <ShoppingCart size={12} />
                              <span>طلب شراء</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onNavigate('items')}
                              className="py-1.5 px-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors cursor-pointer"
                              title="تعديل حد الطلب أو بيانات الصنف"
                            >
                              تعديل الصنف
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Below Cost Sales Invoices Alerts Section */}
                {(activeTab === 'ALL' || activeTab === 'BELOW_COST') && filteredBelowCost.length > 0 && (
                  <div className={activeTab === 'ALL' && filteredLowStock.length > 0 ? 'mt-6 pt-5 border-t border-slate-100' : ''}>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <TrendingDown size={15} className="text-rose-600" />
                        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                          فواتير مبيعات تحتوي أصنافاً بيعت بأقل من سعر التكلفة ({filteredBelowCost.length})
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate('sales')}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline flex items-center gap-1"
                      >
                        <span>فتح شاشة المبيعات</span>
                        <ArrowRight size={12} className="rotate-180" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredBelowCost.map((invAlert) => (
                        <div
                          key={invAlert.invoiceId}
                          className="bg-rose-50/30 border border-rose-200 rounded-xl p-4 flex flex-col justify-between hover:border-rose-300 transition-all shadow-2xs"
                        >
                          <div>
                            {/* Invoice Header */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-sm text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                                  #{invAlert.invoiceNumber}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  invAlert.status === 'POSTED'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {invAlert.status === 'POSTED' ? 'مرحلة' : 'مسودة'}
                                </span>
                              </div>

                              <div className="text-right">
                                <span className="text-xs font-mono font-extrabold text-rose-700 bg-rose-100/90 px-2 py-1 rounded-lg border border-rose-300">
                                  عجز: -{invAlert.totalInvoiceLoss.toLocaleString()} {currencySymbol}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-600 mb-3">
                              <span>العميل: <strong className="text-slate-900">{invAlert.partnerName}</strong></span>
                              <span className="font-mono text-slate-500">{invAlert.date}</span>
                            </div>

                            {/* Table of items sold below cost */}
                            <div className="bg-white rounded-lg border border-rose-100 overflow-hidden mb-3">
                              <table className="w-full text-right text-xs">
                                <thead className="bg-rose-100/50 text-slate-600 text-[10px]">
                                  <tr>
                                    <th className="py-1.5 px-2 font-bold">البند المباع بخسارة</th>
                                    <th className="py-1.5 px-2 text-center font-bold">الكمية</th>
                                    <th className="py-1.5 px-2 text-left font-bold text-rose-700">سعر البيع</th>
                                    <th className="py-1.5 px-2 text-left font-bold text-slate-700">التكلفة (م.س.ت)</th>
                                    <th className="py-1.5 px-2 text-left font-bold text-rose-700">خسارة البند</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-rose-50">
                                  {invAlert.belowCostItems.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-rose-50/20">
                                      <td className="py-2 px-2 font-medium text-slate-800">
                                        {item.name}
                                      </td>
                                      <td className="py-2 px-2 text-center font-mono text-slate-600">
                                        {item.quantity} {item.unit}
                                      </td>
                                      <td className="py-2 px-2 text-left font-mono font-bold text-rose-600">
                                        {item.unitPrice.toLocaleString()} {currencySymbol}
                                      </td>
                                      <td className="py-2 px-2 text-left font-mono text-slate-700 font-semibold">
                                        {item.costPrice.toLocaleString()} {currencySymbol}
                                      </td>
                                      <td className="py-2 px-2 text-left font-mono font-extrabold text-rose-700 bg-rose-50/40">
                                        -{item.totalLoss.toLocaleString()} {currencySymbol}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Action Bar */}
                          <div className="pt-2 border-t border-rose-100 flex items-center justify-between">
                            <span className="text-[11px] text-slate-500">
                              إجمالي قيمة الفاتورة: <strong className="font-mono text-slate-800">{invAlert.totalInvoiceAmount.toLocaleString()} {currencySymbol}</strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => onNavigate('sales')}
                              className="inline-flex items-center gap-1 py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                              title="استعراض وتعديل الفاتورة في شاشة المبيعات"
                            >
                              <FileText size={12} />
                              <span>استعراض الفاتورة في المبيعات</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
