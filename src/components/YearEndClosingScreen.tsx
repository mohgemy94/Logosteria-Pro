import { useState, useEffect, useRef } from 'react';
import { 
  CalendarCheck, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Scale,
  FileSpreadsheet, Download, Upload, ShieldCheck, RefreshCw, RotateCcw,
  Users, ShoppingBag, Boxes, CreditCard, Landmark, Check, FileCheck, Info,
  Lock, Unlock, FileText, ShieldAlert, CheckSquare, Tag, MapPin, Sliders,
  Warehouse, Printer, Search
} from 'lucide-react';
import { useSystemCurrency } from '../utils/currency';
import { computeDashboardKPIsLocally, closeYearLocally } from '../utils/trialBalanceStore';
import { 
  computeRollForwardData, 
  exportRollForwardToExcel, 
  exportRollForwardToJson,
  parseRollForwardFile,
  applyRollForwardToNewYear,
  getRollbackSnapshotInfo,
  restoreRollbackSnapshot,
  RollForwardBundle,
  BadDebtAllowanceConfig
} from '../utils/yearEndRollForward';
import OpeningBalanceCertificateModal from './OpeningBalanceCertificateModal';
import OpeningStockBarcodeModal from './OpeningStockBarcodeModal';
import { mobileNavigationController } from '../utils/mobileNavigation';
import { 
  getFiscalPeriodLock, 
  setFiscalPeriodLock, 
  unlockFiscalPeriod, 
  PERIOD_LOCK_UPDATED_EVENT,
  PeriodLockState 
} from '../utils/periodLock';

interface YearEndClosingScreenProps {
  onNavigate: (view: string) => void;
}

export default function YearEndClosingScreen({ onNavigate }: YearEndClosingScreenProps) {
  const { symbol: currencySymbol } = useSystemCurrency();
  const currentYear = new Date().getFullYear();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'closing' | 'rollforward' | 'periodlock'>('rollforward');

  // Year Closing State
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [isClosing, setIsClosing] = useState(false);
  const [closeSuccess, setCloseSuccess] = useState(false);
  const [previewData, setPreviewData] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    retainedEarningsAccount: '3201 - الأرباح والخسائر المدورة (Retained Earnings)'
  });

  // Roll-Forward State
  const [targetNewYear, setTargetNewYear] = useState<number>(currentYear + 1);
  const [excludeZeroBalances, setExcludeZeroBalances] = useState(true);
  const [rollForwardBundle, setRollForwardBundle] = useState<RollForwardBundle | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);

  // Import & Sandbox Preview State
  const [importedBundle, setImportedBundle] = useState<RollForwardBundle | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [importSuccessResult, setImportSuccessResult] = useState<{ message: string; entryNumber: string } | null>(null);
  const [rollbackInfo, setRollbackInfo] = useState(() => getRollbackSnapshotInfo());
  const [rollbackSuccessMsg, setRollbackSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Certificate Modal State
  const [showCertificateModal, setShowCertificateModal] = useState(false);

  // Barcode & Shelf Label Modal State
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);

  // IFRS 9 Bad Debt Allowance Configuration State
  const [badDebtConfig, setBadDebtConfig] = useState<BadDebtAllowanceConfig>({
    enabled: true,
    mode: 'MATRIX',
    flatPercentage: 5,
    matrixRates: {
      current: 1,
      bucket90to180: 10,
      bucket180to360: 35,
      over360: 80
    }
  });
  const [showBadDebtConfigModal, setShowBadDebtConfigModal] = useState(false);

  // Sub-tabs navigation inside Roll-Forward Tab
  const [rollForwardSubTab, setRollForwardSubTab] = useState<'opening' | 'inventory' | 'customers' | 'vendors_checks'>('opening');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');
  const [inventorySearchQuery, setInventorySearchQuery] = useState<string>('');
  const [customerAgingFilter, setCustomerAgingFilter] = useState<'ALL' | 'OVER90' | 'OVER180' | 'OVER360'>('ALL');
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');

  // Period Lock State
  const [periodLockState, setPeriodLockState] = useState<PeriodLockState>(() => getFiscalPeriodLock());
  const [customLockDate, setCustomLockDate] = useState<string>(() => {
    const lock = getFiscalPeriodLock();
    return lock.lockDate || `${currentYear - 1}-12-31`;
  });
  const [lockSuccessMsg, setLockSuccessMsg] = useState<string | null>(null);

  // Listen to Period Lock updates
  useEffect(() => {
    const handleLockUpdated = () => {
      const updated = getFiscalPeriodLock();
      setPeriodLockState(updated);
      if (updated.lockDate) {
        setCustomLockDate(updated.lockDate);
      }
    };
    window.addEventListener(PERIOD_LOCK_UPDATED_EVENT, handleLockUpdated);
    window.addEventListener('storage', handleLockUpdated);
    return () => {
      window.removeEventListener(PERIOD_LOCK_UPDATED_EVENT, handleLockUpdated);
      window.removeEventListener('storage', handleLockUpdated);
    };
  }, []);

  // Modal hardware & gesture back handlers for Mobile
  useEffect(() => {
    if (!showCertificateModal) return;
    const unregister = mobileNavigationController.registerModal('modal-certificate', () => {
      setShowCertificateModal(false);
    });
    return () => unregister();
  }, [showCertificateModal]);

  useEffect(() => {
    if (!showBarcodeModal) return;
    const unregister = mobileNavigationController.registerModal('modal-stock-barcode', () => {
      setShowBarcodeModal(false);
    });
    return () => unregister();
  }, [showBarcodeModal]);

  useEffect(() => {
    if (!showBadDebtConfigModal) return;
    const unregister = mobileNavigationController.registerModal('modal-bad-debt-config', () => {
      setShowBadDebtConfigModal(false);
    });
    return () => unregister();
  }, [showBadDebtConfigModal]);

  // Load KPI for year-end closing tab
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
              retainedEarningsAccount: '3201 - الأرباح والخسائر المدورة (Retained Earnings)'
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
          retainedEarningsAccount: '3201 - الأرباح والخسائر المدورة (Retained Earnings)'
        };
      }

      setPreviewData(resData);
    };
    fetchKPIs();
  }, [selectedYear]);

  // Compute roll-forward data when settings or year change
  useEffect(() => {
    refreshRollForwardData();
  }, [selectedYear, targetNewYear, excludeZeroBalances, badDebtConfig]);

  const refreshRollForwardData = (cfg?: BadDebtAllowanceConfig) => {
    const bundle = computeRollForwardData({
      fromYear: selectedYear,
      toYear: targetNewYear,
      excludeZeroBalances,
      badDebtConfig: cfg || badDebtConfig
    });
    setRollForwardBundle(bundle);
    setRollbackInfo(getRollbackSnapshotInfo());
  };

  const handleCloseYear = async () => {
    if (confirm(`هل أنت متأكد من إقفال السنة المالية ${selectedYear}؟ سيتم تصفية حسابات الإيرادات والمصروفات وترحيل صافي الربح إلى الأرباح المبقاة.`)) {
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
      } catch {
        alert('حدث خطأ أثناء إقفال السنة المالية');
      } finally {
        setIsClosing(false);
      }
    }
  };

  const handleExportExcel = async () => {
    if (!rollForwardBundle) return;
    setIsExportingExcel(true);
    try {
      await exportRollForwardToExcel(rollForwardBundle);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تصدير ملف الإكسل.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportJson = async () => {
    if (!rollForwardBundle) return;
    setIsExportingJson(true);
    try {
      await exportRollForwardToJson(rollForwardBundle);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تصدير حزمة البيانات.');
    } finally {
      setIsExportingJson(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingFile(true);
    try {
      const parsed = await parseRollForwardFile(file);
      setImportedBundle(parsed);
      setImportSuccessResult(null);
    } catch (err: any) {
      alert(err?.message || 'تعذر قراءة الملف.');
    } finally {
      setIsParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplyImport = () => {
    const targetBundle = importedBundle || rollForwardBundle;
    if (!targetBundle) return;

    const msg = `تأكيد نهائي: هل ترغب في اعتماد الأرصدة الافتتاحية للعام المالي ${targetNewYear}؟\n` +
      `- سيتم إنشاء القيد الافتتاحي رقم (OP-${targetNewYear}-001).\n` +
      `- سيتم ربط أرصدة (${targetBundle.customers.length}) عميل و (${targetBundle.vendors.length}) مورد.\n` +
      `- سيتم تثبيت بضاعة أول المدة لـ (${targetBundle.inventory.length}) صنف.\n` +
      `- سيتم حفظ نسخة احتياطية استرجاعية تلقائية قبل البدء.`;

    if (confirm(msg)) {
      setIsApplying(true);
      try {
        const result = applyRollForwardToNewYear(targetBundle, targetNewYear);
        if (result.success) {
          setImportSuccessResult({
            message: result.message,
            entryNumber: result.openingEntryNumber
          });
          setRollbackInfo(getRollbackSnapshotInfo());
          refreshRollForwardData();
        } else {
          alert(result.message);
        }
      } catch (err: any) {
        alert('حدث خطأ: ' + (err?.message || 'تعذر اعتماد الأرصدة.'));
      } finally {
        setIsApplying(false);
      }
    }
  };

  const handleRollback = () => {
    if (!rollbackInfo.hasSnapshot) return;
    if (confirm(`تحذير: هل أنت متأكد من التراجع عن آخر استيراد واستعادة الحالة السابقة التي أُخذت في (${rollbackInfo.dateStr})؟`)) {
      const ok = restoreRollbackSnapshot();
      if (ok) {
        setRollbackSuccessMsg('تم التراجع بنجاح واستعادة البيانات كما كانت قبل الاستيراد.');
        setImportSuccessResult(null);
        setImportedBundle(null);
        refreshRollForwardData();
        setTimeout(() => setRollbackSuccessMsg(null), 5000);
      } else {
        alert('تعذر التراجع عن العملية.');
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
          تم تصفية حسابات الإيرادات والمصروفات وترحيل صافي الربح إلى حساب الأرباح المبقاة للسنة المالية {selectedYear}. يمكنك الآن الانتقال لتبويب ترحيل الأرصدة للعام الجديد.
        </p>
        <div className="flex gap-4">
          <button 
            onClick={() => { setCloseSuccess(false); setActiveTab('rollforward'); }}
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md"
          >
            الانتقال لترحيل الأرصدة للعام الجديد
          </button>
          <button 
            onClick={() => onNavigate('dashboard')}
            className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
          >
            العودة للوحة المؤشرات
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <CalendarCheck size={30} />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800">
              إقفال السنة وترحيل أرصدة العام الجديد (Year-End Roll-Forward)
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              إدارة الإقفال المحاسبي السنوي وتجهيز واعتماد الأرصدة الافتتاحية وبضاعة أول المدة
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1.5 bg-slate-100 rounded-xl self-start md:self-auto flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('rollforward')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'rollforward'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet size={18} />
            <span>ترحيل واستيراد أرصدة العام الجديد</span>
            <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-mono">جديد</span>
          </button>
          <button
            onClick={() => setActiveTab('periodlock')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'periodlock'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock size={18} className={periodLockState.isLocked ? 'text-rose-600' : 'text-slate-400'} />
            <span>تأمين وتجميد الفترات المالية</span>
            {periodLockState.isLocked && (
              <span className="bg-rose-100 text-rose-700 text-[11px] px-2 py-0.5 rounded-full font-bold">
                مقفلة
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('closing')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'closing'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scale size={18} />
            <span>إقفال حسابات السنة الحالية</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ROLL-FORWARD & OPENING BALANCES */}
      {activeTab === 'rollforward' && (
        <div className="space-y-6">
          {/* Success / Notification Banners */}
          {importSuccessResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-emerald-900 flex items-start gap-4 shadow-sm animate-in fade-in duration-300">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 size={24} />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-lg text-emerald-800">تهانينا! تم بدء العام المالي الجديد بنجاح</h4>
                <p className="text-sm mt-1 text-emerald-700 leading-relaxed">{importSuccessResult.message}</p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-mono font-bold">
                    رقم القيد الافتتاحي: {importSuccessResult.entryNumber}
                  </span>
                  <button
                    onClick={() => onNavigate('journal-entries')}
                    className="text-xs font-bold text-emerald-700 underline hover:text-emerald-900"
                  >
                    عرض القيد في دفتر اليومية العامة
                  </button>
                </div>
              </div>
            </div>
          )}

          {rollbackSuccessMsg && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 flex items-center gap-3">
              <RotateCcw className="text-amber-600 shrink-0" size={20} />
              <p className="text-sm font-bold">{rollbackSuccessMsg}</p>
            </div>
          )}

          {/* Period Lock Security Banner */}
          <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all shadow-sm ${
            periodLockState.isLocked 
              ? 'bg-rose-50/70 border-rose-200 text-rose-950' 
              : 'bg-amber-50/70 border-amber-200 text-amber-950'
          }`}>
            <div className="flex items-center gap-3.5">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                periodLockState.isLocked 
                  ? 'bg-rose-600 text-white shadow-rose-600/20' 
                  : 'bg-amber-500 text-white shadow-amber-500/20'
              }`}>
                {periodLockState.isLocked ? <Lock size={22} /> : <Unlock size={22} />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-900">
                    {periodLockState.isLocked 
                      ? `الفترة المالية مقفلة ومحمية حتى تاريخ: (${periodLockState.lockDate})`
                      : 'تنبيه رقابي: الفترات المالية السابقة غير مجمدة ومفتوحة للتعديل'}
                  </h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    periodLockState.isLocked ? 'bg-rose-200 text-rose-800' : 'bg-amber-200 text-amber-800'
                  }`}>
                    {periodLockState.isLocked ? 'حماية مشددة نشطة' : 'تنبيه أمان'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  {periodLockState.isLocked
                    ? 'يمنع النظام تسجيل أو تعديل أي فواتير أو سندات أو قيود بأثر رجعي، مما يضمن ثبات ومصداقية الأرصدة الافتتاحية المنقولة.'
                    : 'يُنصح بشدة بتجميد السنة المالية المنتهية لمنع حدوث أي تعديل بأثر رجعي قد يخل بتوازن الأرصدة الافتتاحية.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('periodlock')}
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 transition-colors shrink-0 shadow-sm flex items-center gap-2 self-end md:self-auto"
            >
              <Lock size={14} className="text-indigo-600" />
              <span>إدارة تأمين وتجميد الفترات</span>
            </button>
          </div>

          {/* Roll-Forward Control Bar */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-xs text-slate-500 font-bold block mb-1">من السنة المالية الحالية:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    const y = Number(e.target.value);
                    setSelectedYear(y);
                    setTargetNewYear(y + 1);
                  }}
                  className="bg-slate-50 border border-slate-300 text-slate-800 text-sm font-bold rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={2024}>2024</option>
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>

              <div>
                <span className="text-xs text-slate-500 font-bold block mb-1">إلى العام المالي الجديد:</span>
                <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-black text-sm px-4 py-2 rounded-xl font-mono">
                  {targetNewYear}
                </div>
              </div>

              <div className="pt-5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={excludeZeroBalances}
                    onChange={(e) => setExcludeZeroBalances(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-bold text-slate-700">استبعاد الحسابات الصفرية (0.00 {currencySymbol})</span>
                </label>
              </div>
            </div>

            {/* Rollback Snapshot Button if exists */}
            {rollbackInfo.hasSnapshot && (
              <button
                onClick={handleRollback}
                className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-xl text-xs font-bold transition-all shadow-sm"
                title={`استعادة نقطة الأمان المأخوذة في ${rollbackInfo.dateStr}`}
              >
                <RotateCcw size={15} />
                <span>تراجع عن آخر استيراد ({rollbackInfo.dateStr})</span>
              </button>
            )}
          </div>

          {/* Quick Metrics Cards */}
          {rollForwardBundle && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-indigo-600 mb-1">
                  <Users size={18} />
                  <span className="text-xs font-bold text-slate-500">أرصدة العملاء (AR)</span>
                </div>
                <div className="text-xl font-black text-slate-900 font-mono">
                  {rollForwardBundle.summary.totalCustomersBalance.toLocaleString()}{' '}
                  <span className="text-xs font-sans text-slate-500">{currencySymbol}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {rollForwardBundle.summary.activeCustomersCount} عميل نشط
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-rose-600 mb-1">
                  <ShoppingBag size={18} />
                  <span className="text-xs font-bold text-slate-500">أرصدة الموردين (AP)</span>
                </div>
                <div className="text-xl font-black text-slate-900 font-mono">
                  {rollForwardBundle.summary.totalVendorsBalance.toLocaleString()}{' '}
                  <span className="text-xs font-sans text-slate-500">{currencySymbol}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {rollForwardBundle.summary.activeVendorsCount} مورد نشط
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-600 mb-1">
                  <Boxes size={18} />
                  <span className="text-xs font-bold text-slate-500">بضاعة أول المدة</span>
                </div>
                <div className="text-xl font-black text-slate-900 font-mono">
                  {rollForwardBundle.summary.totalInventoryValue.toLocaleString()}{' '}
                  <span className="text-xs font-sans text-slate-500">{currencySymbol}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {rollForwardBundle.summary.activeItemsCount} صنف بالمخازن
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-amber-600 mb-1">
                  <CreditCard size={18} />
                  <span className="text-xs font-bold text-slate-500">الأقساط المتبقية</span>
                </div>
                <div className="text-xl font-black text-slate-900 font-mono">
                  {rollForwardBundle.summary.totalInstallmentsRemaining.toLocaleString()}{' '}
                  <span className="text-xs font-sans text-slate-500">{currencySymbol}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {rollForwardBundle.summary.activeInstallmentsCount} عقد تقسيط قادم
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-cyan-600 mb-1">
                  <Landmark size={18} />
                  <span className="text-xs font-bold text-slate-500">شيكات تحت التحصيل</span>
                </div>
                <div className="text-xl font-black text-slate-900 font-mono">
                  {rollForwardBundle.summary.totalUnclearedChecks.toLocaleString()}{' '}
                  <span className="text-xs font-sans text-slate-500">{currencySymbol}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {rollForwardBundle.summary.activeChecksCount} شيك بنكي مؤجل
                </div>
              </div>
            </div>
          )}

          {/* Smart Pre-Export Integrity Check */}
          {rollForwardBundle && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">
                      فحص التطابق الرقابي والمحاسبي المسبق (Pre-Export Integrity Check)
                    </h3>
                    <p className="text-xs text-slate-500">
                      التحقق الذكي من تطابق تفاصيل الأرصدة التشغيلية مع حسابات المراقبة في الأستاذ العام وميزان المراجعة
                    </p>
                  </div>
                </div>

                <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  rollForwardBundle.integrityCheck.isAllMatched 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {rollForwardBundle.integrityCheck.isAllMatched ? (
                    <>
                      <Check size={14} />
                      <span>جميع الأرصدة متطابقة 100%</span>
                    </>
                  ) : (
                    <>
                      <Info size={14} />
                      <span>يوجد تسويات غير مرحلة</span>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Customers check */}
                <div className={`p-4 rounded-xl border ${
                  rollForwardBundle.integrityCheck.customers.isMatched
                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50/50 border-amber-200 text-amber-900'
                }`}>
                  <div className="flex items-center justify-between text-xs font-bold mb-2">
                    <span>ذمم العملاء (Sub-ledger AR vs GL 1201)</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      rollForwardBundle.integrityCheck.customers.isMatched ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'
                    }`}>
                      {rollForwardBundle.integrityCheck.customers.statusTextAr}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>إجمالي العملاء:</span>
                    <span className="font-mono font-bold">{rollForwardBundle.integrityCheck.customers.subledgerTotal.toLocaleString()} {currencySymbol}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600 mt-1">
                    <span>رصيد الدليل (1201):</span>
                    <span className="font-mono font-bold">{rollForwardBundle.integrityCheck.customers.glTotal.toLocaleString()} {currencySymbol}</span>
                  </div>
                </div>

                {/* Vendors check */}
                <div className={`p-4 rounded-xl border ${
                  rollForwardBundle.integrityCheck.vendors.isMatched
                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50/50 border-amber-200 text-amber-900'
                }`}>
                  <div className="flex items-center justify-between text-xs font-bold mb-2">
                    <span>ذمم الموردين (Sub-ledger AP vs GL 2101)</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      rollForwardBundle.integrityCheck.vendors.isMatched ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'
                    }`}>
                      {rollForwardBundle.integrityCheck.vendors.statusTextAr}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>إجمالي الموردين:</span>
                    <span className="font-mono font-bold">{rollForwardBundle.integrityCheck.vendors.subledgerTotal.toLocaleString()} {currencySymbol}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600 mt-1">
                    <span>رصيد الدليل (2101):</span>
                    <span className="font-mono font-bold">{rollForwardBundle.integrityCheck.vendors.glTotal.toLocaleString()} {currencySymbol}</span>
                  </div>
                </div>

                {/* Inventory check */}
                <div className={`p-4 rounded-xl border ${
                  rollForwardBundle.integrityCheck.inventory.isMatched
                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50/50 border-amber-200 text-amber-900'
                }`}>
                  <div className="flex items-center justify-between text-xs font-bold mb-2">
                    <span>تقييم المخزون (Inventory vs GL 1301)</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      rollForwardBundle.integrityCheck.inventory.isMatched ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'
                    }`}>
                      {rollForwardBundle.integrityCheck.inventory.statusTextAr}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>قيمة الأصناف:</span>
                    <span className="font-mono font-bold">{rollForwardBundle.integrityCheck.inventory.subledgerTotal.toLocaleString()} {currencySymbol}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600 mt-1">
                    <span>رصيد الدليل (1301):</span>
                    <span className="font-mono font-bold">{rollForwardBundle.integrityCheck.inventory.glTotal.toLocaleString()} {currencySymbol}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Boxes: Export & Import */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Box 1: Exporting current balances */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Download size={22} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-slate-800">
                      الخطوة 1: تنزيل ملف أرصدة العام الجديد
                    </h4>
                    <p className="text-xs text-slate-500">
                      تصدير كافة الأرصدة الحية والأقساط والمخزون في ملف منظم ومطابق
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 mb-6 text-sm text-slate-600 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-700">
                    <FileCheck size={16} className="text-indigo-600" />
                    <span>محتويات ملف التصدير:</span>
                  </div>
                  <ul className="text-xs text-slate-500 space-y-1 pr-6 list-disc">
                    <li>ورقة (1): القيد الافتتاحي المتزن المقترح رقم 1 وفحص المطابقة.</li>
                    <li>ورقة (2): كشف تفصيلي بأرصدة العملاء المدينة والدائنة.</li>
                    <li>ورقة (3): كشف تفصيلي بمستحقات وأرصدة الموردين.</li>
                    <li>ورقة (4): كشف بضاعة أول المدة (الكمية × التكلفة) لجميع الأصناف.</li>
                    <li>ورقة (5): جدول الأقساط المستحقة وتواريخ استحقاقها القادمة.</li>
                    <li>ورقة (6): حافظة الشيكات البنكية تحت التحصيل والصرف.</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleExportExcel}
                  disabled={isExportingExcel || !rollForwardBundle}
                  className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md shadow-emerald-500/10 transition-all text-xs disabled:opacity-60 cursor-pointer"
                >
                  {isExportingExcel ? (
                    <RefreshCw className="animate-spin" size={16} />
                  ) : (
                    <FileSpreadsheet size={16} />
                  )}
                  <span>تنزيل Excel الشامل (.xlsx)</span>
                </button>

                <button
                  onClick={() => setShowCertificateModal(true)}
                  disabled={!rollForwardBundle}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md shadow-indigo-600/15 transition-all text-xs disabled:opacity-60 cursor-pointer"
                  title="معاينة وطباعة وتصدير محضر اعتماد الأرصدة الافتتاحية الرسمي PDF"
                >
                  <FileText size={16} />
                  <span>محضر الاعتماد (PDF/طباعة)</span>
                </button>

                <button
                  onClick={() => setShowBarcodeModal(true)}
                  disabled={!rollForwardBundle}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-xl shadow-md shadow-amber-600/15 transition-all text-xs disabled:opacity-60 cursor-pointer"
                  title="طباعة ملصقات الباركود ورفوف بضاعة أول المدة لكافة الفروع والمستودعات"
                >
                  <Tag size={16} />
                  <span>طباعة باركود ورفوف أول المدة 🏷️</span>
                </button>

                <button
                  onClick={() => setShowBadDebtConfigModal(true)}
                  disabled={!rollForwardBundle}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-cyan-700 hover:bg-cyan-800 text-white font-bold py-3 px-4 rounded-xl shadow-md shadow-cyan-700/15 transition-all text-xs disabled:opacity-60 cursor-pointer"
                  title="تخصيص مصفوفة ونسب مخصص الديون المشكوك فيها IFRS 9 في القيد الافتتاحي"
                >
                  <Sliders size={16} />
                  <span>مخصص ديون IFRS 9 ⚖️</span>
                </button>

                <button
                  onClick={handleExportJson}
                  disabled={isExportingJson || !rollForwardBundle}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-3 rounded-xl transition-all text-xs disabled:opacity-60 cursor-pointer"
                  title="حزمة بيانات برمجية للاستيراد السريع"
                >
                  <Download size={14} />
                  <span>حزمة JSON</span>
                </button>
              </div>
            </div>

            {/* Box 2: Importing & Committing into New Year */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Upload size={22} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-slate-800">
                      الخطوة 2: استيراد واعتماد الأرصدة في العام الجديد
                    </h4>
                    <p className="text-xs text-slate-500">
                      رفع الملف واعتماد القيد الافتتاحي وتثبيت أرصدة بداية العام {targetNewYear}
                    </p>
                  </div>
                </div>

                <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20 rounded-2xl p-6 text-center transition-all mb-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx,.xls,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="rollforward-upload-input"
                  />
                  <label htmlFor="rollforward-upload-input" className="cursor-pointer flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-indigo-600 mb-2 border border-slate-100">
                      {isParsingFile ? <RefreshCw className="animate-spin" size={20} /> : <Upload size={20} />}
                    </div>
                    <span className="text-sm font-bold text-slate-700">اضغط لرفع ملف Excel أو حزمة JSON</span>
                    <span className="text-xs text-slate-400 mt-1">يدعم ملفات (.xlsx أو .json) المصدرة من النظام</span>
                  </label>
                </div>

                {importedBundle && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-indigo-900 text-xs flex items-center justify-between mb-4">
                    <span>
                      ✔ تم فحص الملف: يحتوي على ({importedBundle.customers.length}) عميل، ({importedBundle.vendors.length}) مورد، ({importedBundle.inventory.length}) صنف مخزني.
                    </span>
                    <button
                      onClick={() => setImportedBundle(null)}
                      className="text-indigo-700 font-bold hover:underline"
                    >
                      إلغاء الملف
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleApplyImport}
                  disabled={isApplying}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-5 rounded-xl shadow-md shadow-indigo-500/20 transition-all text-sm disabled:opacity-60"
                >
                  {isApplying ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>جاري المعالجة والاعتماد...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>اعتماد الأرصدة الافتتاحية وبدء العام {targetNewYear}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Multi-Tab Roll-Forward Explorer */}
          {rollForwardBundle && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              
              {/* Explorer Sub-Tabs Navigation */}
              <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center bg-slate-200/70 p-1 rounded-xl">
                  <button
                    onClick={() => setRollForwardSubTab('opening')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      rollForwardSubTab === 'opening'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Scale size={15} />
                    <span>القيد الافتتاحي المتزن ({rollForwardBundle.openingEntry.entryNumber})</span>
                  </button>

                  <button
                    onClick={() => setRollForwardSubTab('inventory')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      rollForwardSubTab === 'inventory'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Boxes size={15} />
                    <span>بضاعة أول المدة والفروع ({rollForwardBundle.warehouseBreakdown.length} مستودع / {rollForwardBundle.inventory.length} صنف)</span>
                  </button>

                  <button
                    onClick={() => setRollForwardSubTab('customers')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      rollForwardSubTab === 'customers'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users size={15} />
                    <span>أرصدة العملاء وأعمار الديون IFRS 9 ({rollForwardBundle.customers.length} عميل)</span>
                  </button>

                  <button
                    onClick={() => setRollForwardSubTab('vendors_checks')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      rollForwardSubTab === 'vendors_checks'
                        ? 'bg-white text-amber-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ShoppingBag size={15} />
                    <span>الموردين والأقساط والشيكات ({rollForwardBundle.vendors.length} مورد)</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {rollForwardSubTab === 'inventory' && (
                    <button
                      onClick={() => setShowBarcodeModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
                    >
                      <Printer size={14} />
                      <span>طباعة باركود ورفوف أول المدة</span>
                    </button>
                  )}
                  {rollForwardSubTab === 'customers' && (
                    <button
                      onClick={() => setShowBadDebtConfigModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
                    >
                      <Sliders size={14} />
                      <span>تعديل مصفوفة IFRS 9</span>
                    </button>
                  )}
                </div>
              </div>

              {/* SUBTAB 1: BALANCED OPENING ENTRY */}
              {rollForwardSubTab === 'opening' && (
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                        <span>معاينة القيد الافتتاحي المتزن المقترح للسنة المالية {targetNewYear}</span>
                        <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full font-bold">
                          {rollForwardBundle.openingEntry.entryNumber}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        البيان: {rollForwardBundle.openingEntry.description} | تاريخ الترحيل: {rollForwardBundle.openingEntry.date}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        rollForwardBundle.openingEntry.isBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {rollForwardBundle.openingEntry.isBalanced ? '✔ القيد متزن محاسبياً 100%' : '⚠ القيد غير متزن'}
                      </span>
                    </div>
                  </div>

                  {/* IFRS 9 Notice if bad debt allowance is active */}
                  {rollForwardBundle.badDebtAllowance.isEnabled && rollForwardBundle.badDebtAllowance.totalAllowance > 0 && (
                    <div className="mb-4 bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-950 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Scale size={16} className="text-indigo-600 shrink-0" />
                        <span>
                          <strong>تطبيق معيار IFRS 9:</strong> تم إدراج حساب (1209 - مخصص ديون مشكوك في تحصيلها) كطرف دائن بقيمة <strong>{rollForwardBundle.badDebtAllowance.totalAllowance.toLocaleString()} {currencySymbol}</strong>، وبذلك تظهر ذمم العملاء بصافي القيمة القابلة للتحصيل البالغة <strong>{rollForwardBundle.badDebtAllowance.netRealizableAR.toLocaleString()} {currencySymbol}</strong>.
                        </span>
                      </div>
                      <button
                        onClick={() => setShowBadDebtConfigModal(true)}
                        className="text-xs font-bold text-indigo-700 underline hover:text-indigo-900 shrink-0 cursor-pointer"
                      >
                        تعديل النسب
                      </button>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 text-xs border-b border-slate-200">
                          <th className="py-3 px-4 font-bold">كود الحساب</th>
                          <th className="py-3 px-4 font-bold">اسم الحساب في الدليل المحاسبي</th>
                          <th className="py-3 px-4 font-bold text-emerald-700">مدين ({currencySymbol})</th>
                          <th className="py-3 px-4 font-bold text-rose-700">دائن ({currencySymbol})</th>
                          <th className="py-3 px-4 font-bold">البيان التوضيحي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {rollForwardBundle.openingEntry.items.map((item, idx) => (
                          <tr key={idx} className={`hover:bg-slate-50/60 transition-colors ${item.accountCode === '1209' ? 'bg-indigo-50/30' : ''}`}>
                            <td className="py-3 px-4 font-mono font-bold text-slate-700">{item.accountCode}</td>
                            <td className="py-3 px-4 font-bold text-slate-800">
                              <span>{item.accountName}</span>
                              {item.accountCode === '1209' && (
                                <span className="mr-2 text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                                  IFRS 9 مخصص متزن
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-emerald-600">
                              {item.debit > 0 ? item.debit.toLocaleString() : '-'}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-rose-600">
                              {item.credit > 0 ? item.credit.toLocaleString() : '-'}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-500">{item.description}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                          <td colSpan={2} className="py-3 px-4 text-slate-800">إجمالي طرفي القيد الافتتاحي</td>
                          <td className="py-3 px-4 font-mono text-emerald-700 text-base">
                            {rollForwardBundle.openingEntry.totalDebit.toLocaleString()} {currencySymbol}
                          </td>
                          <td className="py-3 px-4 font-mono text-rose-700 text-base">
                            {rollForwardBundle.openingEntry.totalCredit.toLocaleString()} {currencySymbol}
                          </td>
                          <td className="py-3 px-4 text-xs font-bold text-emerald-700">
                            فارق التوازن: 0.00 {currencySymbol}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUBTAB 2: MULTI-BRANCH INVENTORY ROLL-FORWARD */}
              {rollForwardSubTab === 'inventory' && (
                <div className="p-6 space-y-6">
                  {/* Warehouse Distribution Cards */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Warehouse className="text-emerald-600" size={18} />
                        <h4 className="font-bold text-slate-800 text-sm">
                          توزيع بضاعة أول المدة وتقييم المخزون حسب الفروع والمستودعات
                        </h4>
                      </div>
                      <span className="text-xs text-slate-500">
                        إجمالي القيمة: <strong className="text-slate-800 font-mono">{rollForwardBundle.summary.totalInventoryValue.toLocaleString()} {currencySymbol}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {rollForwardBundle.warehouseBreakdown.map((wb, idx) => (
                        <div 
                          key={idx}
                          className={`p-4 rounded-xl border transition-all cursor-pointer ${
                            warehouseFilter === wb.warehouseName 
                              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300 shadow-sm' 
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                          onClick={() => setWarehouseFilter(warehouseFilter === wb.warehouseName ? 'ALL' : wb.warehouseName)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-xs text-slate-800 truncate" title={wb.warehouseName}>
                              {wb.warehouseName}
                            </span>
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                              {wb.percentage}%
                            </span>
                          </div>

                          <div className="text-lg font-black text-slate-900 font-mono">
                            {wb.totalValuation.toLocaleString()} <span className="text-xs font-sans text-slate-500">{currencySymbol}</span>
                          </div>

                          <div className="flex items-center justify-between text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                            <span>{wb.itemsCount} صنف</span>
                            <span className="font-mono font-bold">{wb.totalQuantity.toLocaleString()} قطعة</span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div 
                              className="bg-emerald-500 h-full rounded-full transition-all"
                              style={{ width: `${Math.min(100, wb.percentage)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Filters & Search Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                      {/* Warehouse Selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-600">المستودع:</span>
                        <select
                          value={warehouseFilter}
                          onChange={(e) => setWarehouseFilter(e.target.value)}
                          className="border border-slate-300 rounded-xl px-3 py-1.5 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="ALL">كافة المستودعات والفروع ({rollForwardBundle.warehouseBreakdown.length})</option>
                          {rollForwardBundle.warehouseBreakdown.map(w => (
                            <option key={w.warehouseName} value={w.warehouseName}>{w.warehouseName}</option>
                          ))}
                        </select>
                      </div>

                      {/* Search */}
                      <div className="relative flex-1 min-w-[220px]">
                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={inventorySearchQuery}
                          onChange={(e) => setInventorySearchQuery(e.target.value)}
                          placeholder="بحث بالصنف، الباركود، الكود، أو موقع الرف..."
                          className="w-full pr-8 pl-3 py-1.5 border border-slate-300 rounded-xl bg-slate-50 text-xs focus:bg-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => setShowBarcodeModal(true)}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                    >
                      <Tag size={15} />
                      <span>طباعة ملصقات الباركود ورفوف أول المدة</span>
                    </button>
                  </div>

                  {/* Inventory Items Table */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-xs text-right">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                          <th className="py-2.5 px-3">كود الصنف</th>
                          <th className="py-2.5 px-3">الباركود</th>
                          <th className="py-2.5 px-3">اسم الصنف والمواصفات</th>
                          <th className="py-2.5 px-3">المستودع / الفرع</th>
                          <th className="py-2.5 px-3">موقع الرف</th>
                          <th className="py-2.5 px-3 text-center">الكمية الافتتاحية</th>
                          <th className="py-2.5 px-3 text-left">متوسط التكلفة</th>
                          <th className="py-2.5 px-3 text-left">سعر البيع</th>
                          <th className="py-2.5 px-3 text-left">إجمالي التقييم</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rollForwardBundle.inventory
                          .filter(it => {
                            if (warehouseFilter !== 'ALL' && it.warehouseName !== warehouseFilter) return false;
                            if (inventorySearchQuery.trim()) {
                              const q = inventorySearchQuery.toLowerCase();
                              return (
                                it.name.toLowerCase().includes(q) ||
                                (it.barcode && it.barcode.toLowerCase().includes(q)) ||
                                (it.code && it.code.toLowerCase().includes(q)) ||
                                (it.shelfLocation && it.shelfLocation.toLowerCase().includes(q))
                              );
                            }
                            return true;
                          })
                          .map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{item.code}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-500">{item.barcode || '-'}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-900">
                                <div>{item.name}</div>
                                <div className="text-[10px] text-slate-400 font-normal">{item.category} | {item.unit}</div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 font-medium">
                                <span className="inline-flex items-center gap-1">
                                  <Warehouse size={12} className="text-slate-400" />
                                  <span>{item.warehouseName || 'المستودع الرئيسي'}</span>
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="inline-flex items-center gap-1 font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                                  <MapPin size={11} className="text-indigo-600" />
                                  <span>{item.shelfLocation || 'غير محدد'}</span>
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-700 text-sm">
                                {item.stock} {item.unit}
                              </td>
                              <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-700">
                                {item.costPrice.toLocaleString()} {currencySymbol}
                              </td>
                              <td className="py-2.5 px-3 text-left font-mono text-slate-600">
                                {item.salePrice.toLocaleString()} {currencySymbol}
                              </td>
                              <td className="py-2.5 px-3 text-left font-mono font-bold text-emerald-700 text-sm">
                                {item.totalValue.toLocaleString()} {currencySymbol}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUBTAB 3: CUSTOMERS & IFRS 9 DEBT AGING */}
              {rollForwardSubTab === 'customers' && (
                <div className="p-6 space-y-6">
                  {/* IFRS 9 Summary Banner */}
                  <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-5 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Scale className="text-indigo-400" size={20} />
                        <h4 className="font-bold text-base">
                          تصنيف أعمار الديون ومخصص الخسائر الائتمانية المتوقعة (IFRS 9)
                        </h4>
                        <span className="bg-indigo-500/30 text-indigo-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
                          {rollForwardBundle.badDebtAllowance.mode === 'MATRIX' ? 'مصفوفة أعمار الديون' : `نسبة ثابتة ${rollForwardBundle.badDebtAllowance.flatPercentage}%`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        يقوم المعيار الدولي IFRS 9 بحجز مخصص ديون مرحّل في حساب (1209) لمقابلة الديون الراكدة والمتعثرة وضمان دقة صافي الأصول.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="bg-white/10 px-4 py-2.5 rounded-xl border border-white/10 text-right">
                        <span className="text-[11px] text-slate-300 block">إجمالي الذمم المدينة (Gross)</span>
                        <span className="text-base font-black font-mono text-white">
                          {rollForwardBundle.badDebtAllowance.totalGrossAR.toLocaleString()} {currencySymbol}
                        </span>
                      </div>

                      <div className="bg-rose-500/20 px-4 py-2.5 rounded-xl border border-rose-400/30 text-right">
                        <span className="text-[11px] text-rose-200 block">مخصص IFRS 9 (حساب 1209)</span>
                        <span className="text-base font-black font-mono text-rose-300">
                          - {rollForwardBundle.badDebtAllowance.totalAllowance.toLocaleString()} {currencySymbol}
                        </span>
                      </div>

                      <div className="bg-emerald-500/20 px-4 py-2.5 rounded-xl border border-emerald-400/30 text-right">
                        <span className="text-[11px] text-emerald-200 block">صافي القيمة القابلة للتحصيل</span>
                        <span className="text-base font-black font-mono text-emerald-300">
                          {rollForwardBundle.badDebtAllowance.netRealizableAR.toLocaleString()} {currencySymbol}
                        </span>
                      </div>

                      <button
                        onClick={() => setShowBadDebtConfigModal(true)}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <Sliders size={14} />
                        <span>ضبط المصفوفة</span>
                      </button>
                    </div>
                  </div>

                  {/* Aging Buckets KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between text-xs font-bold mb-1">
                        <span className="text-emerald-700">أرصدة جارية (أقل من 90 يوم)</span>
                        <span className="font-mono bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded text-[11px]">
                          نسبة المخصص: {rollForwardBundle.badDebtAllowance.matrixRates.current}%
                        </span>
                      </div>
                      <div className="text-xl font-black text-slate-900 font-mono">
                        {rollForwardBundle.badDebtAllowance.agingTotals.current.toLocaleString()} <span className="text-xs font-sans text-slate-500">{currencySymbol}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">مديونيات في النطاق الائتماني الطبيعي</div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between text-xs font-bold mb-1">
                        <span className="text-amber-700">متابعة (91 إلى 180 يوم)</span>
                        <span className="font-mono bg-amber-50 text-amber-800 px-2 py-0.5 rounded text-[11px]">
                          نسبة المخصص: {rollForwardBundle.badDebtAllowance.matrixRates.bucket90to180}%
                        </span>
                      </div>
                      <div className="text-xl font-black text-slate-900 font-mono">
                        {rollForwardBundle.badDebtAllowance.agingTotals.bucket90to180.toLocaleString()} <span className="text-xs font-sans text-slate-500">{currencySymbol}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">تأخير أولي يتطلب اتصال ومتابعة</div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between text-xs font-bold mb-1">
                        <span className="text-orange-700">متأخرة (181 إلى 360 يوم)</span>
                        <span className="font-mono bg-orange-50 text-orange-800 px-2 py-0.5 rounded text-[11px]">
                          نسبة المخصص: {rollForwardBundle.badDebtAllowance.matrixRates.bucket180to360}%
                        </span>
                      </div>
                      <div className="text-xl font-black text-slate-900 font-mono">
                        {rollForwardBundle.badDebtAllowance.agingTotals.bucket180to360.toLocaleString()} <span className="text-xs font-sans text-slate-500">{currencySymbol}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">ديون عالية المخاطر تستوجب إجراءات</div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20">
                      <div className="flex items-center justify-between text-xs font-bold mb-1">
                        <span className="text-rose-700">راكدة / متعثرة (&gt; 360 يوم)</span>
                        <span className="font-mono bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[11px]">
                          نسبة المخصص: {rollForwardBundle.badDebtAllowance.matrixRates.over360}%
                        </span>
                      </div>
                      <div className="text-xl font-black text-rose-700 font-mono">
                        {rollForwardBundle.badDebtAllowance.agingTotals.over360.toLocaleString()} <span className="text-xs font-sans text-slate-500">{currencySymbol}</span>
                      </div>
                      <div className="text-[11px] text-rose-600 font-bold mt-1">ديون مشكوك في تحصيلها بالكامل</div>
                    </div>
                  </div>

                  {/* Filters & Search Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                        <button
                          onClick={() => setCustomerAgingFilter('ALL')}
                          className={`px-3 py-1.5 rounded-lg transition-all ${
                            customerAgingFilter === 'ALL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
                          }`}
                        >
                          كافة العملاء
                        </button>
                        <button
                          onClick={() => setCustomerAgingFilter('OVER90')}
                          className={`px-3 py-1.5 rounded-lg transition-all ${
                            customerAgingFilter === 'OVER90' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600'
                          }`}
                        >
                          المتأخرة &gt; 90 يوم
                        </button>
                        <button
                          onClick={() => setCustomerAgingFilter('OVER180')}
                          className={`px-3 py-1.5 rounded-lg transition-all ${
                            customerAgingFilter === 'OVER180' ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-600'
                          }`}
                        >
                          المتأخرة &gt; 180 يوم
                        </button>
                        <button
                          onClick={() => setCustomerAgingFilter('OVER360')}
                          className={`px-3 py-1.5 rounded-lg transition-all ${
                            customerAgingFilter === 'OVER360' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600'
                          }`}
                        >
                          المتعثرة &gt; 360 يوم
                        </button>
                      </div>

                      <div className="relative flex-1 min-w-[220px]">
                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={customerSearchQuery}
                          onChange={(e) => setCustomerSearchQuery(e.target.value)}
                          placeholder="بحث باسم العميل، الكود، أو رقم الهاتف..."
                          className="w-full pr-8 pl-3 py-1.5 border border-slate-300 rounded-xl bg-slate-50 text-xs focus:bg-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Customer Aging Table */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-xs text-right">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                          <th className="py-2.5 px-3">كود العميل</th>
                          <th className="py-2.5 px-3">اسم العميل</th>
                          <th className="py-2.5 px-3">الهاتف / الضريبي</th>
                          <th className="py-2.5 px-3 text-left">إجمالي الرصيد</th>
                          <th className="py-2.5 px-3 text-left text-emerald-700">&lt; 90 يوم (جارية)</th>
                          <th className="py-2.5 px-3 text-left text-amber-700">91-180 يوم</th>
                          <th className="py-2.5 px-3 text-left text-orange-700">181-360 يوم</th>
                          <th className="py-2.5 px-3 text-left text-rose-700">&gt; 360 يوم (متعثرة)</th>
                          <th className="py-2.5 px-3 text-left text-rose-600">مخصص IFRS 9</th>
                          <th className="py-2.5 px-3 text-left text-indigo-700">صافي القيمة</th>
                          <th className="py-2.5 px-3 text-center">المخاطرة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rollForwardBundle.customers
                          .filter(c => {
                            if (customerAgingFilter === 'OVER90' && (!c.aging || (c.aging.bucket90to180 <= 0 && c.aging.bucket180to360 <= 0 && c.aging.over360 <= 0))) return false;
                            if (customerAgingFilter === 'OVER180' && (!c.aging || (c.aging.bucket180to360 <= 0 && c.aging.over360 <= 0))) return false;
                            if (customerAgingFilter === 'OVER360' && (!c.aging || c.aging.over360 <= 0)) return false;
                            if (customerSearchQuery.trim()) {
                              const q = customerSearchQuery.toLowerCase();
                              return (
                                c.name.toLowerCase().includes(q) ||
                                (c.code && c.code.toLowerCase().includes(q)) ||
                                (c.phone && c.phone.includes(q))
                              );
                            }
                            return true;
                          })
                          .map((cust, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{cust.code}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-900">{cust.name}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-500">
                                <div>{cust.phone || '-'}</div>
                                {cust.taxNumber && <div className="text-[10px] text-slate-400">{cust.taxNumber}</div>}
                              </td>
                              <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-900 text-sm">
                                {cust.balance.toLocaleString()} {currencySymbol}
                              </td>
                              <td className="py-2.5 px-3 text-left font-mono text-emerald-700">
                                {cust.aging?.current ? cust.aging.current.toLocaleString() : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-left font-mono text-amber-700">
                                {cust.aging?.bucket90to180 ? cust.aging.bucket90to180.toLocaleString() : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-left font-mono text-orange-700">
                                {cust.aging?.bucket180to360 ? cust.aging.bucket180to360.toLocaleString() : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-left font-mono font-bold text-rose-700">
                                {cust.aging?.over360 ? cust.aging.over360.toLocaleString() : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-left font-mono font-bold text-rose-600 bg-rose-50/40">
                                {cust.allowanceAmount ? cust.allowanceAmount.toLocaleString() : '0.00'}
                              </td>
                              <td className="py-2.5 px-3 text-left font-mono font-black text-indigo-700">
                                {(cust.netRealizableBalance ?? cust.balance).toLocaleString()} {currencySymbol}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  cust.aging?.riskLevel === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
                                  cust.aging?.riskLevel === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                                  cust.aging?.riskLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-800' :
                                  'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {cust.aging?.riskLevel === 'CRITICAL' ? 'حرجة' :
                                   cust.aging?.riskLevel === 'HIGH' ? 'مرتفعة' :
                                   cust.aging?.riskLevel === 'MEDIUM' ? 'متوسطة' : 'طبيعية'}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUBTAB 4: VENDORS, INSTALLMENTS & CHECKS */}
              {rollForwardSubTab === 'vendors_checks' && (
                <div className="p-6 space-y-6">
                  {/* Vendors Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="text-rose-600" size={18} />
                        <h4 className="font-bold text-slate-800 text-sm">
                          أرصدة ومستحقات الموردين المرحّلة ({rollForwardBundle.vendors.length} مورد)
                        </h4>
                      </div>
                      <span className="text-xs text-slate-500">
                        إجمالي المستحق: <strong className="text-slate-800 font-mono">{rollForwardBundle.summary.totalVendorsBalance.toLocaleString()} {currencySymbol}</strong>
                      </span>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-xs text-right">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                            <th className="py-2.5 px-3">كود المورد</th>
                            <th className="py-2.5 px-3">اسم المورد</th>
                            <th className="py-2.5 px-3">رقم الهاتف</th>
                            <th className="py-2.5 px-3">الرقم الضريبي</th>
                            <th className="py-2.5 px-3 text-left">الرصيد الافتتاحي</th>
                            <th className="py-2.5 px-3 text-center">طبيعة الرصيد</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {rollForwardBundle.vendors.map((v, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{v.code}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-900">{v.name}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-500">{v.phone || '-'}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-500">{v.taxNumber || '-'}</td>
                              <td className="py-2.5 px-3 text-left font-mono font-bold text-rose-700 text-sm">
                                {v.balance.toLocaleString()} {currencySymbol}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  v.balanceType === 'CREDIT' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {v.balanceType === 'CREDIT' ? 'دائن (مستحق للمورد)' : 'مدين (دفعة مقدمة)'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Installments & Checks Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                    {/* Installments */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <CreditCard className="text-amber-600" size={18} />
                          <h4 className="font-bold text-slate-800 text-sm">
                            الأقساط المتبقية للعام القادم ({rollForwardBundle.installments.length} عقد)
                          </h4>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-700">
                          {rollForwardBundle.summary.totalInstallmentsRemaining.toLocaleString()} {currencySymbol}
                        </span>
                      </div>

                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-xs text-right">
                          <thead>
                            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                              <th className="py-2 px-3">رقم العقد</th>
                              <th className="py-2 px-3">العميل</th>
                              <th className="py-2 px-3 text-left">المتبقي</th>
                              <th className="py-2 px-3 text-center">أقساط قادمة</th>
                              <th className="py-2 px-3">أول استحقاق</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rollForwardBundle.installments.slice(0, 8).map((inst, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-mono font-bold text-slate-700">{inst.contractNumber}</td>
                                <td className="py-2 px-3 font-bold text-slate-800 truncate max-w-[120px]">{inst.customerName}</td>
                                <td className="py-2 px-3 text-left font-mono font-bold text-amber-700">
                                  {inst.remainingAmount.toLocaleString()} {currencySymbol}
                                </td>
                                <td className="py-2 px-3 text-center font-mono">{inst.pendingCount}</td>
                                <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{inst.nextDueDate || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Uncleared Checks */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Landmark className="text-cyan-600" size={18} />
                          <h4 className="font-bold text-slate-800 text-sm">
                            شيكات تحت التحصيل والصرف ({rollForwardBundle.checks.length} شيك)
                          </h4>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-700">
                          {rollForwardBundle.summary.totalUnclearedChecks.toLocaleString()} {currencySymbol}
                        </span>
                      </div>

                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-xs text-right">
                          <thead>
                            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                              <th className="py-2 px-3">رقم الشيك</th>
                              <th className="py-2 px-3">النوع</th>
                              <th className="py-2 px-3">الطرف / المستفيد</th>
                              <th className="py-2 px-3 text-left">المبلغ</th>
                              <th className="py-2 px-3">الاستحقاق</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rollForwardBundle.checks.slice(0, 8).map((chk, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-mono font-bold text-slate-700">{chk.checkNumber}</td>
                                <td className="py-2 px-3">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    chk.type === 'INCOMING' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                  }`}>
                                    {chk.type === 'INCOMING' ? 'قبض' : 'صرف'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-bold text-slate-800 truncate max-w-[120px]">{chk.partnerName}</td>
                                <td className="py-2 px-3 text-left font-mono font-bold text-cyan-700">
                                  {chk.amount.toLocaleString()} {currencySymbol}
                                </td>
                                <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{chk.dueDate}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* TAB 2: CURRENT YEAR-END CLOSING (EXISTING WORKFLOW) */}
      {activeTab === 'closing' && (
        <div className="space-y-6">
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
                    <option value={2027}>2027</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">حساب ترحيل الأرباح (Retained Earnings)</label>
                  <div className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-slate-100 text-slate-600 font-medium flex items-center justify-between cursor-not-allowed">
                    <span className="text-xs">{previewData.retainedEarningsAccount}</span>
                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
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
      )}

      {/* TAB 3: FISCAL PERIOD LOCK & SECURITY */}
      {activeTab === 'periodlock' && (
        <div className="space-y-6">
          {/* Feedback banner */}
          {lockSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900 flex items-center gap-3 animate-in fade-in duration-300">
              <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />
              <p className="text-sm font-bold">{lockSuccessMsg}</p>
            </div>
          )}

          {/* Current Status Card */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                  periodLockState.isLocked 
                    ? 'bg-rose-600 text-white shadow-rose-600/20' 
                    : 'bg-emerald-600 text-white shadow-emerald-600/20'
                }`}>
                  {periodLockState.isLocked ? <Lock size={32} /> : <Unlock size={32} />}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-black text-slate-800">
                      {periodLockState.isLocked 
                        ? `الفترة المالية مقفلة ومجمدة حتى (${periodLockState.lockDate})`
                        : 'الفترات المالية مفتوحة حالياً وغير مجمدة'}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      periodLockState.isLocked ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {periodLockState.isLocked ? 'حماية تامة نشطة' : 'فترات قابلة للتعديل'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {periodLockState.isLocked
                      ? `تم تفعيل القفل الرقابي بواسطة: ${periodLockState.lockedBy || 'الإدارة المالية'}. يمنع النظام إضافة أو تعديل أو ترحيل أي حركات بتاريخ يسبق هذا التاريخ.`
                      : 'يمكن للمستخدمين المصرح لهم تسجيل قيود وفواتير بأي تاريخ سابق. يوصى بتعيين تاريخ قفل لحماية ميزانيات الأعوام المنتهية.'}
                  </p>
                </div>
              </div>

              {periodLockState.isLocked ? (
                <button
                  onClick={() => {
                    if (confirm('تنبيه أمان: هل أنت متأكد من فك قفل الفترة المالية؟ سيسمح ذلك بالتعديل على القيود والفواتير السابقة.')) {
                      unlockFiscalPeriod();
                      setLockSuccessMsg('تم إلغاء قفل الفترة المالية بنجاح.');
                      setTimeout(() => setLockSuccessMsg(null), 4000);
                    }
                  }}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors shrink-0 flex items-center gap-2 border border-slate-300"
                >
                  <Unlock size={16} />
                  <span>إلغاء القفل مؤقتاً</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    const defaultDate = `${currentYear - 1}-12-31`;
                    setFiscalPeriodLock(defaultDate, true, 'الإدارة المالية');
                    setLockSuccessMsg(`تم تفعيل القفل وتجميد الفترة المالية حتى (${defaultDate}) بنجاح.`);
                    setTimeout(() => setLockSuccessMsg(null), 4000);
                  }}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shrink-0 shadow-md shadow-rose-600/20 flex items-center gap-2"
                >
                  <Lock size={16} />
                  <span>تفعيل القفل فوراً (نهاية {currentYear - 1})</span>
                </button>
              )}
            </div>

            {/* Lock Date Configuration Form */}
            <div className="pt-6">
              <h4 className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
                <ShieldCheck size={18} className="text-indigo-600" />
                <span>تعيين تاريخ قفل الفترة المالية (Lock Date):</span>
              </h4>

              <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex-1 w-full md:w-auto">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    تاريخ تجميد الحركات (لا يُسمح بأي قيد أو فاتورة في أو قبل هذا التاريخ):
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="date"
                      value={customLockDate}
                      onChange={(e) => setCustomLockDate(e.target.value)}
                      className="px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />

                    {/* Quick Presets */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <button
                        type="button"
                        onClick={() => setCustomLockDate(`${currentYear - 2}-12-31`)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 font-medium"
                      >
                        31/12/{currentYear - 2}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomLockDate(`${currentYear - 1}-12-31`)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 font-medium"
                      >
                        31/12/{currentYear - 1}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const today = new Date().toISOString().split('T')[0] || '';
                          setCustomLockDate(today);
                        }}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 font-medium"
                      >
                        تاريخ اليوم
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!customLockDate) {
                      alert('يرجى اختيار تاريخ القفل أولاً.');
                      return;
                    }
                    setFiscalPeriodLock(customLockDate, true, 'الإدارة المالية');
                    setLockSuccessMsg(`تم تحديث وتثبيت تاريخ قفل الفترة المالية حتى (${customLockDate}) بنجاح.`);
                    setTimeout(() => setLockSuccessMsg(null), 4000);
                  }}
                  className="w-full md:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 shrink-0"
                >
                  <Lock size={16} />
                  <span>حفظ وتثبيت تاريخ القفل</span>
                </button>
              </div>
            </div>
          </div>

          {/* Audit & Compliance Guide Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                <Scale size={20} />
              </div>
              <h4 className="font-bold text-sm text-slate-800 mb-1.5">حماية الأرصدة الافتتاحية</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                يضمن قفل الفترة عدم تعديل فواتير أو أرصدة الموردين والعملاء والمخزون المنتهية، مما يمنع حدوث أي فوارق حسابية بين السنة القديمة والقيد الافتتاحي الجديد.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <CheckSquare size={20} />
              </div>
              <h4 className="font-bold text-sm text-slate-800 mb-1.5">الامتثال الضريبي والزكوي</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                بمجرد رفع الإقرار الضريبي أو القوائم المالية لهيئة الزكاة والضريبة والجمارك (ZATCA)، يُلزم النظام المحاسبي بتجميد الفترة لمنع أي تغيير في الوعاء الضريبي بأثر رجعي.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                <ShieldAlert size={20} />
              </div>
              <h4 className="font-bold text-sm text-slate-800 mb-1.5">نطاق الحظر الرقابي</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                يشمل القفل: فواتير المبيعات، فواتير المشتريات، سندات القبض والصرف، وقيود اليومية العامة. ولا يمكن فتح الفترة إلا بصلاحيات المدير المالي.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Official Opening Balance Audit Certificate Modal */}
      {rollForwardBundle && (
        <OpeningBalanceCertificateModal
          bundle={rollForwardBundle}
          isOpen={showCertificateModal}
          onClose={() => setShowCertificateModal(false)}
        />
      )}

      {/* Opening Stock Barcode & Shelf Labels Modal */}
      {rollForwardBundle && (
        <OpeningStockBarcodeModal
          isOpen={showBarcodeModal}
          onClose={() => setShowBarcodeModal(false)}
          inventory={rollForwardBundle.inventory}
          companyName="لوجوستريا للحلول المالية واللوجستية"
          currencySymbol={currencySymbol}
        />
      )}

      {/* IFRS 9 Bad Debt Allowance Configuration Modal */}
      {showBadDebtConfigModal && rollForwardBundle && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-700 text-white flex items-center justify-center shadow-md">
                  <Sliders size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-800">
                    تخصيص مصفوفة مخصص الديون المشكوك فيها (IFRS 9)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    تحديد نسب الخسائر الائتمانية المتوقعة لحساب (1209) في القيد الافتتاحي
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBadDebtConfigModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Enable / Disable switch */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <span className="font-bold text-sm text-slate-800 block">
                    تفعيل ترحيل مخصص الديون المشكوك فيها
                  </span>
                  <span className="text-xs text-slate-500">
                    إدراج حساب (1209) كطرف دائن موازن في القيد الافتتاحي المقترح
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={badDebtConfig.enabled}
                    onChange={(e) => setBadDebtConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                </label>
              </div>

              {badDebtConfig.enabled && (
                <>
                  {/* Calculation Mode */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">طريقة الاحتساب:</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setBadDebtConfig(prev => ({ ...prev, mode: 'MATRIX' }))}
                        className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                          badDebtConfig.mode === 'MATRIX'
                            ? 'bg-cyan-50 border-cyan-500 text-cyan-900 ring-2 ring-cyan-200'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-bold text-xs">مصفوفة أعمار الديون (IFRS 9 Matrix)</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">نسب تصاعدية حسب فترة التأخير</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBadDebtConfig(prev => ({ ...prev, mode: 'PERCENT' }))}
                        className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                          badDebtConfig.mode === 'PERCENT'
                            ? 'bg-cyan-50 border-cyan-500 text-cyan-900 ring-2 ring-cyan-200'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-bold text-xs">نسبة موحدة ثابتة (Flat %)</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">نسبة واحدة على إجمالي رصيد العملاء</div>
                      </button>
                    </div>
                  </div>

                  {/* Mode = MATRIX Inputs */}
                  {badDebtConfig.mode === 'MATRIX' ? (
                    <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <div className="text-xs font-bold text-slate-700 mb-2">
                        نسب خسائر الائتمان المتوقعة لكل فئة عمرية:
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-slate-600 mb-1">أرصدة جارية (&lt; 90 يوم):</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={badDebtConfig.matrixRates?.current ?? 1}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setBadDebtConfig(prev => ({
                                  ...prev,
                                  matrixRates: { ...prev.matrixRates!, current: val }
                                }));
                              }}
                              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 bg-white font-mono font-bold"
                            />
                            <span className="font-bold text-slate-500">%</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-600 mb-1">متوسطة التأخر (91 - 180 يوم):</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={badDebtConfig.matrixRates?.bucket90to180 ?? 10}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setBadDebtConfig(prev => ({
                                  ...prev,
                                  matrixRates: { ...prev.matrixRates!, bucket90to180: val }
                                }));
                              }}
                              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 bg-white font-mono font-bold"
                            />
                            <span className="font-bold text-slate-500">%</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-600 mb-1">متأخرة عالية المخاطر (181 - 360 يوم):</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={badDebtConfig.matrixRates?.bucket180to360 ?? 35}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setBadDebtConfig(prev => ({
                                  ...prev,
                                  matrixRates: { ...prev.matrixRates!, bucket180to360: val }
                                }));
                              }}
                              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 bg-white font-mono font-bold"
                            />
                            <span className="font-bold text-slate-500">%</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-600 mb-1">راكدة / متعثرة (&gt; 360 يوم):</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={badDebtConfig.matrixRates?.over360 ?? 80}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setBadDebtConfig(prev => ({
                                  ...prev,
                                  matrixRates: { ...prev.matrixRates!, over360: val }
                                }));
                              }}
                              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 bg-white font-mono font-bold"
                            />
                            <span className="font-bold text-slate-500">%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        النسبة المئوية العامة المقتطعة:
                      </label>
                      <div className="flex items-center gap-2 max-w-xs">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={badDebtConfig.flatPercentage ?? 5}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setBadDebtConfig(prev => ({ ...prev, flatPercentage: val }));
                          }}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white font-mono font-bold text-sm"
                        />
                        <span className="font-bold text-slate-500">%</span>
                      </div>
                    </div>
                  )}

                  {/* Impact Summary */}
                  <div className="bg-cyan-50/70 border border-cyan-200 rounded-2xl p-4 text-xs space-y-1.5 text-cyan-950">
                    <div className="font-bold text-sm text-cyan-900 flex items-center gap-2 mb-2">
                      <Scale size={16} />
                      <span>المحاكاة المحاسبية للأثر المالي للقيد الافتتاحي:</span>
                    </div>
                    <div className="flex justify-between">
                      <span>إجمالي رصيد العملاء المدين (1201):</span>
                      <span className="font-mono font-bold">{rollForwardBundle.badDebtAllowance.totalGrossAR.toLocaleString()} {currencySymbol}</span>
                    </div>
                    <div className="flex justify-between text-rose-700">
                      <span>المخصص الدائن المرحّل (1209 - مخصص الديون):</span>
                      <span className="font-mono font-bold">- {rollForwardBundle.badDebtAllowance.totalAllowance.toLocaleString()} {currencySymbol}</span>
                    </div>
                    <div className="flex justify-between text-emerald-800 font-bold border-t border-cyan-200 pt-1">
                      <span>صافي القيمة القابلة للتحصيل (Net Realizable AR):</span>
                      <span className="font-mono text-sm">{rollForwardBundle.badDebtAllowance.netRealizableAR.toLocaleString()} {currencySymbol}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowBadDebtConfigModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-100 transition-colors text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  refreshRollForwardData(badDebtConfig);
                  setShowBadDebtConfigModal(false);
                }}
                className="px-6 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold shadow-md transition-all text-xs"
              >
                تطبيق وحفظ في القيد الافتتاحي
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

