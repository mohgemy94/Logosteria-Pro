import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  Trash2, 
  Power, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Scale, 
  Sparkles, 
  Layers,
  GitFork
} from 'lucide-react';
import ChartOfAccountsTree from './ChartOfAccountsTree';

interface AccountOption {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  type: string;
  level: number;
  isPosting: boolean;
  isActive: boolean;
  subLedgerType: string;
  currency: string;
}

interface JournalLineState {
  accountId: string;
  amountForeign: number;
  exchangeRate: number;
  isDebit: boolean;
  costCenterId: string;
  subLedgerId: string;
  description: string;
}

export default function AccountEngineTester() {
  const [activeTab, setActiveTab] = useState<'tester' | 'tree'>('tester');
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New Analytical Account Form State
  const [parentSubId, setParentSubId] = useState('sub_110101');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [currency, setCurrency] = useState('SAR');
  const [subLedgerType, setSubLedgerType] = useState('NONE');
  const [previewNextCode, setPreviewNextCode] = useState<string | null>(null);

  // Journal Entry Form State
  const [jeDescription, setJeDescription] = useState('قيد تسوية وتحميل مصروفات تشغيلية');
  const [jeReference, setJeReference] = useState('REF-2026-001');
  const [lines, setLines] = useState<JournalLineState[]>([
    {
      accountId: 'an_520101001', // مصروفات رواتب (يتطلب مركز تكلفة)
      amountForeign: 15000,
      exchangeRate: 1,
      isDebit: true,
      costCenterId: 'CC-101', // مركز تكلفة الإدارة
      subLedgerId: '',
      description: 'استحقاق رواتب الإدارة لشهر سبتمبر'
    },
    {
      accountId: 'an_110201001', // بنك الراجحي (ميزانية عمومية - يحظر مركز تكلفة)
      amountForeign: 15000,
      exchangeRate: 1,
      isDebit: false,
      costCenterId: '',
      subLedgerId: '',
      description: 'صرف تحويل بنكي'
    }
  ]);

  // استرجاع الحسابات
  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch('/api/accounts');
      const json = await res.json();
      if (json.success) {
        setAccounts(json.data);
      } else {
        setErrorMsg(json.error);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();

    const handleSync = () => {
      fetchAccounts();
    };

    window.addEventListener('alpha-chart-of-accounts-updated', handleSync);
    window.addEventListener('alpha-system-reset-completed', handleSync);
    window.addEventListener('alpha-data-changed', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('alpha-chart-of-accounts-updated', handleSync);
      window.removeEventListener('alpha-system-reset-completed', handleSync);
      window.removeEventListener('alpha-data-changed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // استعلام الكود القادم تلقائياً
  useEffect(() => {
    if (!parentSubId) return;
    fetch(`/api/accounts/next-code?parentSubAccountId=${encodeURIComponent(parentSubId)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPreviewNextCode(data.data.nextCode);
        } else {
          setPreviewNextCode(null);
        }
      })
      .catch(() => setPreviewNextCode(null));
  }, [parentSubId]);

  // إرسال طلب إنشاء حساب تحليلي
  const handleCreateAnalyticalAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiResponse(null);
    setErrorMsg(null);
    try {
      setLoading(true);
      const res = await fetch('/api/accounts/analytical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'tenant_default',
          parentSubAccountId: parentSubId,
          nameAr,
          nameEn,
          currency,
          subLedgerType
        })
      });
      const data = await res.json();
      setApiResponse({ status: res.status, ...data });
      if (res.ok) {
        setNameAr('');
        setNameEn('');
        fetchAccounts();
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // إرسال قيد يومية
  const handleCreateJournalEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiResponse(null);
    setErrorMsg(null);
    try {
      setLoading(true);
      const res = await fetch('/api/journal-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'tenant_default',
          description: jeDescription,
          reference: jeReference,
          lines: lines.map(l => ({
            ...l,
            amountForeign: Number(l.amountForeign),
            exchangeRate: Number(l.exchangeRate) || 1
          }))
        })
      });
      const data = await res.json();
      setApiResponse({ status: res.status, ...data });
      if (res.ok) {
        fetchAccounts();
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // حذف الحساب
  const handleDeleteAccount = async (id: string) => {
    if (!confirm('هل تريد محاولة حذف هذا الحساب؟ إذا كان يمتلك قيوداً سيرفض المحرك الطلب.')) return;
    setApiResponse(null);
    setErrorMsg(null);
    try {
      setLoading(true);
      const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      setApiResponse({ status: res.status, ...data });
      if (res.ok) {
        fetchAccounts();
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // تجميد / تنشيط الحساب
  const handleToggleStatus = async (id: string) => {
    setApiResponse(null);
    setErrorMsg(null);
    try {
      setLoading(true);
      const res = await fetch(`/api/accounts/${id}/toggle-status`, { method: 'PATCH' });
      const data = await res.json();
      setApiResponse({ status: res.status, ...data });
      if (res.ok) {
        fetchAccounts();
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // حساب إجماليات القيد
  const totalDebit = lines
    .filter(l => l.isDebit)
    .reduce((acc, l) => acc + (Number(l.amountForeign) || 0) * (Number(l.exchangeRate) || 1), 0);
  const totalCredit = lines
    .filter(l => !l.isDebit)
    .reduce((acc, l) => acc + (Number(l.amountForeign) || 0) * (Number(l.exchangeRate) || 1), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;

  const parentOptions = accounts.filter(a => a.level === 4);

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-md bg-blue-500/20 text-blue-300 font-mono text-xs font-bold border border-blue-500/30">
                Backend Services & Engine
              </span>
              <span className="text-xs text-slate-400">REST API v1.0 • Express + Prisma Specs</span>
            </div>
            <h2 className="text-2xl font-bold flex items-center gap-2.5">
              <Sparkles className="text-blue-400" size={24} />
              لوحة اختبار وفحص محرك الحسابات المالي (Account Engine)
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-3xl">
              تطبيق مباشر للقواعد المحاسبية الصارمة: توليد كود المستوى الخامس تلقائياً (001-999)، فحص أسطر القيود ومراكز التكلفة، ومنع حذف الحسابات المقيدة مالياً.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('tester')}
              className={`btn-3d ${
                activeTab === 'tester'
                  ? 'btn-3d-blue'
                  : 'btn-3d-slate'
              } flex items-center gap-2 px-3.5 py-2 text-xs font-bold`}
            >
              <Sparkles size={15} />
              اختبار الـ REST APIs
            </button>
            <button
              onClick={() => setActiveTab('tree')}
              className={`btn-3d ${
                activeTab === 'tree'
                  ? 'btn-3d-indigo'
                  : 'btn-3d-slate'
              } flex items-center gap-2 px-3.5 py-2 text-xs font-bold`}
            >
              <GitFork size={15} />
              شجرة الحسابات (CTE Rollup)
            </button>
            <button
              onClick={fetchAccounts}
              disabled={loading}
              className="btn-3d btn-3d-white flex items-center gap-2 px-3 py-2 text-xs font-bold disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              تحديث
            </button>
          </div>
        </div>
      </div>

      {/* Conditionally Render CTE Tree or Tester */}
      {activeTab === 'tree' ? (
        <ChartOfAccountsTree />
      ) : (
        <>
      {/* Response Box */}
      {apiResponse && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
          apiResponse.success 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
            : 'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          {apiResponse.success ? (
            <CheckCircle2 size={22} className="text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={22} className="text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-sm">
            <div className="font-bold flex items-center gap-2">
              <span>رمز الاستجابة: HTTP {apiResponse.status}</span>
              {apiResponse.code && (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/10">
                  {apiResponse.code}
                </span>
              )}
            </div>
            <p className="mt-1 font-medium">{apiResponse.message || apiResponse.error}</p>
            {apiResponse.data && (
              <pre className="mt-2 p-2.5 bg-black/5 rounded-lg text-xs font-mono overflow-x-auto text-left" dir="ltr">
                {JSON.stringify(apiResponse.data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {errorMsg && !apiResponse && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle size={18} className="text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Endpoint: POST /api/accounts/analytical */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-mono font-bold text-xs rounded">POST</span>
              <code className="text-xs font-bold text-slate-700 font-mono">/api/accounts/analytical</code>
            </div>
            <span className="text-xs text-slate-500 font-medium">1. توليد حساب تحليلي (مستوى 5)</span>
          </div>

          <form onSubmit={handleCreateAnalyticalAccount} className="space-y-4 text-sm">
            <div>
              <label className="block font-bold text-slate-700 mb-1 text-xs">الحساب الفرعي الأب (المستوى 4 - 6 أرقام)</label>
              <select
                value={parentSubId}
                onChange={e => setParentSubId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 bg-white text-right outline-none focus:border-blue-500"
              >
                {parentOptions.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.nameAr} ({p.type})
                  </option>
                ))}
              </select>
            </div>

            {previewNextCode && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
                <span className="font-medium">الكود التسلسلي القادم تلقائياً:</span>
                <span className="font-mono font-bold text-sm bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-300">
                  {previewNextCode}
                </span>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1 text-xs">اسم الحساب (عربي) *</label>
              <input
                type="text"
                required
                value={nameAr}
                onChange={e => setNameAr(e.target.value)}
                placeholder="مثال: صندوق فرع مكة المكرمة"
                className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1 text-xs">الاسم بالإنجليزية (اختياري)</label>
                <input
                  type="text"
                  value={nameEn}
                  onChange={e => setNameEn(e.target.value)}
                  placeholder="Makkah Branch Cash"
                  className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-blue-500"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1 text-xs">العملة</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-white outline-none focus:border-blue-500"
                >
                  <option value="SAR">SAR - ريال سعودي</option>
                  <option value="USD">USD - دولار أمريكي</option>
                  <option value="EUR">EUR - يورو</option>
                  <option value="AED">AED - درهم إماراتي</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 text-xs">دفتر أستاذ مساعد (Sub-Ledger)</label>
              <select
                value={subLedgerType}
                onChange={e => setSubLedgerType(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 bg-white outline-none focus:border-blue-500 text-xs"
              >
                <option value="NONE">بدون دفتر مساعد (عام)</option>
                <option value="CUSTOMER">عملاء (CUSTOMER) - يلزم تحديد العميل</option>
                <option value="VENDOR">موردين (VENDOR) - يلزم تحديد المورد</option>
                <option value="EMPLOYEE">موظفين (EMPLOYEE)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-3d btn-3d-emerald w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2"
            >
              <PlusCircle size={16} />
              إرسال طلب POST لتوليد الحساب
            </button>
          </form>
        </div>

        {/* 2. Endpoint: POST /api/journal-entries */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-mono font-bold text-xs rounded">POST</span>
                <code className="text-xs font-bold text-slate-700 font-mono">/api/journal-entries</code>
              </div>
              <span className="text-xs text-slate-500 font-medium">2. ترحيل قيد يومية متوازن</span>
            </div>

            <form onSubmit={handleCreateJournalEntry} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-xs">رقم المرجع</label>
                  <input
                    type="text"
                    value={jeReference}
                    onChange={e => setJeReference(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-xs">بيان القيد العام *</label>
                  <input
                    type="text"
                    required
                    value={jeDescription}
                    onChange={e => setJeDescription(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Posting Lines */}
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>أسطر القيد والتحقق الصارم ({lines.length}):</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-mono ${isBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      مدين: {totalDebit.toLocaleString()} | دائن: {totalCredit.toLocaleString()}
                    </span>
                  </div>
                </div>

                {lines.map((line, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700">السطر #{idx + 1}</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={line.isDebit ? 'DEBIT' : 'CREDIT'}
                          onChange={e => {
                            const newLines = [...lines];
                            newLines[idx]!.isDebit = e.target.value === 'DEBIT';
                            setLines(newLines);
                          }}
                          className={`font-bold px-2 py-1 rounded border text-xs ${
                            line.isDebit ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-purple-100 text-purple-800 border-purple-200'
                          }`}
                        >
                          <option value="DEBIT">مدين (Debit)</option>
                          <option value="CREDIT">دائن (Credit)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-0.5">الحساب التحليلي (مستوى 5)</label>
                        <select
                          value={line.accountId}
                          onChange={e => {
                            const newLines = [...lines];
                            newLines[idx]!.accountId = e.target.value;
                            setLines(newLines);
                          }}
                          className="w-full border rounded-lg p-1.5 bg-white text-xs outline-none"
                        >
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                              {acc.code} - {acc.nameAr} ({acc.level === 5 ? 'مستوى 5 ✓' : `مستوى ${acc.level} ✕ تجميعي`})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-500 mb-0.5">المبلغ</label>
                        <input
                          type="number"
                          value={line.amountForeign}
                          onChange={e => {
                            const newLines = [...lines];
                            newLines[idx]!.amountForeign = parseFloat(e.target.value) || 0;
                            setLines(newLines);
                          }}
                          className="w-full border rounded-lg p-1.5 text-xs outline-none"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-0.5">
                          مركز التكلفة (إلزامي للمصروفات)
                        </label>
                        <input
                          type="text"
                          value={line.costCenterId}
                          onChange={e => {
                            const newLines = [...lines];
                            newLines[idx]!.costCenterId = e.target.value;
                            setLines(newLines);
                          }}
                          placeholder="مثال: CC-101"
                          className="w-full border rounded-lg p-1.5 text-xs outline-none"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-0.5">
                          معرّف الطرف / الأستاذ المساعد
                        </label>
                        <input
                          type="text"
                          value={line.subLedgerId}
                          onChange={e => {
                            const newLines = [...lines];
                            newLines[idx]!.subLedgerId = e.target.value;
                            setLines(newLines);
                          }}
                          placeholder="مثال: CUST-901"
                          className="w-full border rounded-lg p-1.5 text-xs outline-none"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setLines(prev => [
                      ...prev,
                      {
                        accountId: 'an_110101001',
                        amountForeign: 0,
                        exchangeRate: 1,
                        isDebit: true,
                        costCenterId: '',
                        subLedgerId: '',
                        description: ''
                      }
                    ]);
                  }}
                  className="btn-3d btn-3d-white px-3 py-1.5 text-xs font-bold"
                >
                  + إضافة سطر آخر
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-3d btn-3d-blue flex-1 py-2 text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Scale size={15} />
                  ترحيل القيد الذري (POST /api/journal-entries)
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* 3. Accounts Table & Safe Mutability Tests */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Layers size={18} className="text-purple-600" />
              شجرة الحسابات المسجلة في النظام واختبار الحذف والتجميد الآمن
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              جرب حذف أي حساب مرتبط به قيد لترى استجابة <code>409 Conflict</code> وحظر الحذف بأمر <code>assertAccountMutable</code>.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            إجمالي الحسابات: {accounts.length}
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5 font-mono">الكود</th>
                <th className="px-3 py-2.5">اسم الحساب</th>
                <th className="px-3 py-2.5">النوع</th>
                <th className="px-3 py-2.5 text-center">المستوى</th>
                <th className="px-3 py-2.5 text-center">قابل للقيد؟</th>
                <th className="px-3 py-2.5 text-center">الحالة</th>
                <th className="px-3 py-2.5 text-center">الأستاذ المساعد</th>
                <th className="px-3 py-2.5 text-center">الإجراءات والعمليات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {accounts.map(acc => (
                <tr key={acc.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2.5 font-mono font-bold text-slate-800">{acc.code}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-bold text-slate-800">{acc.nameAr}</span>
                    {acc.nameEn && <span className="block text-[11px] text-slate-400">{acc.nameEn}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold text-[11px]">
                      {acc.type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                      acc.level === 5 ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-600'
                    }`}>
                      مستوى {acc.level}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {acc.isPosting ? (
                      <span className="text-emerald-600 font-bold">نعم ✓</span>
                    ) : (
                      <span className="text-slate-400">تجميعي ✕</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      acc.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {acc.isActive ? 'نشط' : 'مجمد'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center text-slate-500 font-mono text-[11px]">
                    {acc.subLedgerType}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Toggle status */}
                      <button
                        onClick={() => handleToggleStatus(acc.id)}
                        className={`btn-3d ${
                          acc.isActive 
                            ? 'btn-3d-amber-soft' 
                            : 'btn-3d-emerald-soft'
                        } p-1.5 text-[11px] font-bold flex items-center gap-1`}
                        title={acc.isActive ? 'تجميد الحساب (PATCH)' : 'تنشيط الحساب (PATCH)'}
                      >
                        <Power size={13} />
                        <span>{acc.isActive ? 'تجميد' : 'تنشيط'}</span>
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteAccount(acc.id)}
                        className="btn-3d btn-3d-danger-soft p-1.5 text-[11px] font-bold flex items-center gap-1"
                        title="حذف الحساب (DELETE)"
                      >
                        <Trash2 size={13} />
                        <span>حذف</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
