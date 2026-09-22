import { useState, useEffect } from 'react';
import { CalendarCheck, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { useSystemCurrency } from '../utils/currency';
import { computeDashboardKPIsLocally, closeYearLocally } from '../utils/trialBalanceStore';

interface YearEndClosingScreenProps {
  onNavigate: (view: string) => void;
}

export default function YearEndClosingScreen({ onNavigate }: YearEndClosingScreenProps) {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isClosing, setIsClosing] = useState(false);
  const [closeSuccess, setCloseSuccess] = useState(false);
  
  const [previewData, setPreviewData] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    retainedEarningsAccount: '3201 - الأرباح المبقاة (Retained Earnings)'
  });

  useEffect(() => {
    const fetchKPIs = async () => {
      let resData = null;
      try {
        const res = await fetch('/api/dashboard/kpis?year=' + selectedYear, { headers: { 'Accept': 'application/json' } });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const json = await res.json();
          if (json && json.success && json.data) {
            const rev = json.data.sales || json.data.totalSales || 0;
            const exp = json.data.expenses || json.data.totalExpenses || 0;
            resData = {
              totalRevenue: rev,
              totalExpenses: exp,
              netProfit: rev - exp,
              retainedEarningsAccount: '3201 - الأرباح المبقاة (Retained Earnings)'
            };
          }
        }
      } catch {
        // Fallback silently
      }

      if (!resData) {
        const kpis = computeDashboardKPIsLocally(selectedYear);
        resData = {
          totalRevenue: kpis.sales,
          totalExpenses: kpis.expenses,
          netProfit: kpis.netProfit,
          retainedEarningsAccount: '3201 - الأرباح المبقاة (Retained Earnings)'
        };
      }

      setPreviewData(resData);
    };
    fetchKPIs();
  }, [selectedYear]);

  const handleCloseYear = async () => {
    if (confirm(`هل أنت متأكد من إقفال السنة المالية ${selectedYear}؟ سيتم إنشاء قيد تصفير للإيرادات والمصروفات، ولا يمكن التراجع.`)) {
      setIsClosing(true);
      try {
        let success = false;
        try {
          const res = await fetch('/api/year-end/close', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year: selectedYear, tenantId: 'tenant_default' })
          });
          if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
            const json = await res.json();
            if (json && json.success) {
              success = true;
            }
          }
        } catch {
          // Fallback silently
        }

        if (!success) {
          closeYearLocally(selectedYear);
          success = true;
        }

        if (success) {
          setCloseSuccess(true);
        }
      } catch (err) {
        alert('حدث خطأ أثناء إقفال السنة المالية');
      } finally {
        setIsClosing(false);
      }
    }
  };

  if (closeSuccess) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-emerald-100 text-center" dir="rtl">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={40} />
        </div>
        <h2 className="text-3xl font-bold text-slate-800 mb-4">تم إقفال السنة المالية بنجاح!</h2>
        <p className="text-slate-600 max-w-md mx-auto mb-8 text-lg">
          تم تصفية حسابات الإيرادات والمصروفات وترحيل صافي الربح إلى حساب الأرباح المبقاة للسنة المالية {selectedYear}. النظام الآن جاهز للسنة المالية الجديدة.
        </p>
        <button 
          onClick={() => onNavigate('dashboard')}
          className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
        >
          العودة للوحة المؤشرات
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <CalendarCheck size={26} />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800">الإقفال السنوي (Year-End Closing)</h2>
          <p className="text-sm text-slate-500 mt-1">تصفية حسابات قائمة الدخل وترحيل الأرباح للسنة المالية الجديدة</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-4 text-amber-800 items-start">
        <AlertTriangle className="shrink-0 mt-0.5 text-amber-600" size={24} />
        <div>
          <h4 className="font-bold text-lg mb-1">تنبيه هام قبل الإقفال</h4>
          <p className="text-sm leading-relaxed">
            عملية الإقفال السنوي ستقوم بإنشاء قيود إقفال تلقائية لتصفية كافة حسابات الإيرادات والمصروفات (حسابات قائمة الدخل) وجعل أرصدتها صفراً. سيتم ترحيل الفارق (صافي الربح أو الخسارة) إلى حساب حقوق الملكية (الأرباح المبقاة). تأكد من إدخال كافة التسويات الجردية قبل المضي قدماً.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-lg text-slate-800 mb-4 border-b border-slate-100 pb-3">إعدادات الإقفال</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">السنة المالية المراد إقفالها</label>
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all font-bold"
              >
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">حساب ترحيل الأرباح (Retained Earnings)</label>
              <div className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-slate-100 text-slate-600 font-medium flex items-center justify-between cursor-not-allowed">
                <span>{previewData.retainedEarningsAccount}</span>
                <CheckCircle2 size={18} className="text-emerald-500" />
              </div>
              <p className="text-xs text-slate-400 mt-2">محدد تلقائياً من شجرة الحسابات</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-lg text-slate-800 mb-4 border-b border-slate-100 pb-3">معاينة نتيجة الإقفال</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-2 text-emerald-600 mb-2">
                <TrendingUp size={18} />
                <span className="font-bold text-sm">إجمالي الإيرادات المراد إقفالها</span>
              </div>
              <div className="text-2xl font-black text-emerald-700 font-mono">
                {previewData.totalRevenue.toLocaleString()} <span className="text-xs">{currencySymbol}</span>
              </div>
            </div>

            <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
              <div className="flex items-center gap-2 text-rose-600 mb-2">
                <TrendingDown size={18} />
                <span className="font-bold text-sm">إجمالي المصروفات المراد إقفالها</span>
              </div>
              <div className="text-2xl font-black text-rose-700 font-mono">
                {previewData.totalExpenses.toLocaleString()} <span className="text-xs">{currencySymbol}</span>
              </div>
            </div>

            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <div className="flex items-center gap-2 text-indigo-600 mb-2">
                <Scale size={18} />
                <span className="font-bold text-sm">صافي الربح المُرحّل</span>
              </div>
              <div className="text-2xl font-black text-indigo-700 font-mono">
                {previewData.netProfit.toLocaleString()} <span className="text-xs">{currencySymbol}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button 
              onClick={() => onNavigate('dashboard')}
              className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
            >
              إلغاء
            </button>
            <button 
              onClick={handleCloseYear}
              disabled={isClosing}
              className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-70"
            >
              {isClosing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>جاري إنشاء قيود الإقفال...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  <span>اعتماد وإقفال السنة المالية</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
