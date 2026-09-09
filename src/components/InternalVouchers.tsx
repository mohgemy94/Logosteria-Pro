import { useState, useMemo, type FormEvent } from 'react';
import { 
  Save, ArrowRightLeft, Plus, History, AlertTriangle, Edit3, Trash2, X, Eye,
  Building2, Wallet, Sparkles, ShieldCheck, ArrowLeft
} from 'lucide-react';
import PrintDropdown from './PrintDropdown';
import PrintPreviewModal, { PrintPreviewData } from './PrintPreviewModal';
import { 
  getNextSequentialNumber, 
  isCodeOrNumberDuplicated, 
  advanceSequenceAfterSave, 
  DB_INTERNAL_VOUCHERS_KEY 
} from '../utils/sequences';

export interface StoredInternalVoucher {
  id: string;
  voucherNumber: string;
  date: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description: string;
  createdAt: string;
}

const ACCOUNTS = [
  { id: 'cash1', name: 'الصندوق الرئيسي' },
  { id: 'bank1', name: 'البنك الأهلي' },
  { id: 'bank2', name: 'بنك الراجحي' },
];

function loadStoredInternalVouchers(): StoredInternalVoucher[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DB_INTERNAL_VOUCHERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load internal vouchers:', e);
  }
  return [];
}

import { useSystemCurrency } from '../utils/currency';

export default function InternalVouchers() {
  const { fullNameAr: currencyFullNameAr, tafqeet } = useSystemCurrency();
  const [savedVouchers, setSavedVouchers] = useState<StoredInternalVoucher[]>(() => loadStoredInternalVouchers());
  const [showHistory, setShowHistory] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [customPreviewData, setCustomPreviewData] = useState<PrintPreviewData | null>(null);

  // Derive next sequential voucher number
  const nextCalculatedVoucherNum = useMemo(() => {
    return getNextSequentialNumber('internalVoucher', savedVouchers.map(v => v.voucherNumber)).formatted;
  }, [savedVouchers]);

  const [voucherNumber, setVoucherNumber] = useState<string>(() => nextCalculatedVoucherNum);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0] as string);
  const [fromAccountId, setFromAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Real-time duplicate check (ignoring current editing voucher)
  const isVoucherDuplicate = useMemo(() => {
    if (!voucherNumber) return false;
    const listToCheck = editingVoucherId 
      ? savedVouchers.filter(v => v.id !== editingVoucherId)
      : savedVouchers;
    return isCodeOrNumberDuplicated(voucherNumber, 'internalVoucher', listToCheck.map(v => v.voucherNumber));
  }, [voucherNumber, savedVouchers, editingVoucherId]);

  const handleNewVoucher = () => {
    setEditingVoucherId(null);
    const nextSeq = getNextSequentialNumber('internalVoucher', savedVouchers.map(v => v.voucherNumber)).formatted;
    setVoucherNumber(nextSeq);
    setAmount('');
    setDescription('');
    setFromAccountId('');
    setToAccountId('');
  };

  const handleEdit = (v: StoredInternalVoucher) => {
    setEditingVoucherId(v.id);
    setVoucherNumber(v.voucherNumber);
    setDate(v.date);
    setFromAccountId(v.fromAccountId);
    setToAccountId(v.toAccountId);
    setAmount(v.amount.toString());
    setDescription(v.description);
    setShowHistory(false);
  };

  const handleDelete = (id: string, vNum: string) => {
    if (confirm(`هل أنت متأكد من رغبتك في حذف سند التحويل الداخلي رقم (${vNum}) نهائياً؟`)) {
      const updated = savedVouchers.filter(v => v.id !== id);
      setSavedVouchers(updated);
      try {
        localStorage.setItem(DB_INTERNAL_VOUCHERS_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      if (editingVoucherId === id) {
        handleNewVoucher();
      }
    }
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!fromAccountId || !toAccountId || !amount) return;
    if (fromAccountId === toAccountId) {
      alert("لا يمكن التحويل لنفس الحساب!");
      return;
    }

    const finalNumber = voucherNumber.trim() || nextCalculatedVoucherNum;
    const voucherData: StoredInternalVoucher = {
      id: editingVoucherId || Date.now().toString(),
      voucherNumber: finalNumber,
      date,
      fromAccountId,
      toAccountId,
      amount: Number(amount) || 0,
      description: description.trim() || 'سند تحويل داخلي',
      createdAt: new Date().toISOString()
    };

    let updated: StoredInternalVoucher[];
    if (editingVoucherId) {
      updated = savedVouchers.map(v => v.id === editingVoucherId ? voucherData : v);
    } else {
      updated = [
        voucherData,
        ...savedVouchers.filter(v => v.voucherNumber.trim().toLowerCase() !== finalNumber.toLowerCase())
      ];
      advanceSequenceAfterSave('internalVoucher', finalNumber);
    }

    setSavedVouchers(updated);
    try {
      localStorage.setItem(DB_INTERNAL_VOUCHERS_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }

    alert(`تم ${editingVoucherId ? 'تعديل وحفظ' : 'إنشاء'} سند التحويل الداخلي رقم (${finalNumber}) بنجاح بقيمة ${amount} ريال!`);
    
    setEditingVoucherId(null);
    // Prep next voucher
    const nextSeq = getNextSequentialNumber('internalVoucher', updated.map(v => v.voucherNumber)).formatted;
    setVoucherNumber(nextSeq);
    setAmount('');
    setDescription('');
  };

  const getAccountName = (id: string) => ACCOUNTS.find(a => a.id === id)?.name || id;

  return (
    <div className="flex flex-col flex-1">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-6 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1 text-slate-500">
            <span className="text-xs uppercase font-bold tracking-tight">الخزينة والبنوك</span>
            <span className="text-xs">/</span>
            <span className="text-xs uppercase font-bold tracking-tight">سندات داخلية</span>
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">سند تحويل داخلي</h2>
            <span className="text-xs sm:text-sm font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md font-mono border border-blue-200">
              سند رقم: #{voucherNumber}
            </span>
            {editingVoucherId && (
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold border border-amber-300 flex items-center gap-1">
                <Edit3 size={12} /> وضع التعديل
              </span>
            )}
          </div>
          <p className="text-slate-500 mt-1 text-xs sm:text-sm">تحويل الأموال بين الخزائن والحسابات البنكية مع إمكانية التعديل والحذف.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editingVoucherId && (
            <button
              type="button"
              onClick={handleNewVoucher}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X size={14} /> إلغاء التعديل
            </button>
          )}
          <button 
            type="button" 
            onClick={() => setShowHistory(!showHistory)} 
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg shadow-xs text-xs font-medium border transition-colors cursor-pointer ${showHistory ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
          >
            <History size={15} /> سجل السندات ({savedVouchers.length})
          </button>
          <button 
            type="button" 
            onClick={handleNewVoucher} 
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg shadow-xs text-xs font-medium hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <Plus size={15} /> سند جديد #{nextCalculatedVoucherNum}
          </button>
          <button
            type="button"
            onClick={() => {
              setCustomPreviewData(null);
              setShowPrintPreview(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg shadow-xs text-xs font-bold transition-colors cursor-pointer"
            title="معاينة سند التحويل الداخلي قبل الطباعة"
          >
            <Eye size={14} />
            <span>معاينة قبل الطباعة</span>
          </button>
          <PrintDropdown 
            onPreview={() => {
              setCustomPreviewData(null);
              setShowPrintPreview(true);
            }}
          />
        </div>
      </div>

      {/* Collapsible History Drawer */}
      {showHistory && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-4 shadow-sm animate-in fade-in duration-150 print:hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <History size={16} className="text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-sm">سجل سندات التحويل الداخلي المسجلة بقاعدة البيانات</h3>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">{savedVouchers.length} سندات</span>
            </div>
            <button 
              type="button" 
              onClick={() => setShowHistory(false)}
              className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              إغلاق
            </button>
          </div>
          {savedVouchers.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">لا توجد سندات داخلية محفوظة بعد. السند القادم سيبدأ برقم #{nextCalculatedVoucherNum}.</p>
          ) : (
            <div className="overflow-x-auto max-h-56">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400">
                    <th className="pb-2 font-semibold">رقم السند</th>
                    <th className="pb-2 font-semibold">من حساب</th>
                    <th className="pb-2 font-semibold">إلى حساب</th>
                    <th className="pb-2 font-semibold">المبلغ</th>
                    <th className="pb-2 font-semibold">التاريخ</th>
                    <th className="pb-2 font-semibold">البيان</th>
                    <th className="pb-2 font-semibold text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {savedVouchers.map(v => (
                    <tr key={v.id} className={`hover:bg-slate-50 transition-colors ${editingVoucherId === v.id ? 'bg-blue-50/60' : ''}`}>
                      <td className="py-2 font-mono font-bold text-blue-600">#{v.voucherNumber}</td>
                      <td className="py-2 text-slate-700 font-medium">{getAccountName(v.fromAccountId)}</td>
                      <td className="py-2 text-slate-700 font-medium">{getAccountName(v.toAccountId)}</td>
                      <td className="py-2 font-mono font-bold text-slate-800">{v.amount.toLocaleString()} ريال</td>
                      <td className="py-2 text-slate-500">{v.date}</td>
                      <td className="py-2 text-slate-500 truncate max-w-xs">{v.description}</td>
                      <td className="py-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setCustomPreviewData({
                                title: 'سند تحويل ومناقلة داخلية',
                                subtitle: 'سند تسوية ونقل أموال بين الحسابات والخزائن',
                                docNumber: v.voucherNumber,
                                date: v.date,
                                partnerName: `من: ${getAccountName(v.fromAccountId)} ⬅️ إلى: ${getAccountName(v.toAccountId)}`,
                                paymentMethod: 'مناقلة داخلية',
                                notes: v.description,
                                grandTotal: v.amount,
                                subtotal: v.amount,
                                amount: v.amount,
                                paidAmount: v.amount,
                                voucherType: 'INTERNAL',
                                amountInWords: tafqeet(v.amount),
                                items: [{
                                  description: `تحويل من (${getAccountName(v.fromAccountId)}) إلى (${getAccountName(v.toAccountId)}) - ${v.description || 'مناقلة مالية'}`,
                                  quantity: 1,
                                  unitPrice: v.amount,
                                  taxRate: 0,
                                  total: v.amount
                                }]
                              });
                              setShowPrintPreview(true);
                            }}
                            className="flex items-center gap-0.5 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                            title="معاينة السند الداخلي"
                          >
                            <Eye size={12} />
                            <span>معاينة</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(v)}
                            className="flex items-center gap-0.5 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                            title="تعديل السند"
                          >
                            <Edit3 size={12} />
                            <span>تعديل</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(v.id, v.voucherNumber)}
                            className="flex items-center gap-0.5 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                            title="حذف السند"
                          >
                            <Trash2 size={12} />
                            <span>حذف</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Print Header */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900">لوجوستريا للمحاسبة</h1>
        <p className="text-sm text-slate-500">الفرع الرئيسي - الرياض</p>
        <h2 className="text-xl font-bold mt-4 border-b pb-2 inline-block">سند تحويل داخلي</h2>
        <div className="mt-4 text-sm flex justify-between px-10 text-slate-600">
          <span className="font-bold font-mono">رقم السند: #{voucherNumber}</span>
          <span>التاريخ: {date}</span>
          <span>تاريخ الطباعة: {new Date().toLocaleDateString('ar-SA')}</span>
        </div>
      </div>

      <form onSubmit={handleSave} className="flex flex-col flex-1">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 print:border-none print:shadow-none flex flex-col overflow-hidden mb-6">
          
          {/* Top Parameters Strip */}
          <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-100/90 flex flex-col sm:flex-row sm:items-end justify-between gap-4 print:bg-transparent print:p-0 print:mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col gap-1.5 w-full sm:w-48">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase text-slate-800 tracking-wide">رقم السند</label>
                  <span className="text-[10px] bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md font-black border border-blue-300">تسلسلي تلقائي</span>
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    required 
                    value={voucherNumber} 
                    onChange={e => setVoucherNumber(e.target.value)} 
                    className={`w-full border-2 p-2.5 rounded-xl text-sm focus:outline-none font-mono font-black text-center bg-white shadow-2xs ${
                      isVoucherDuplicate 
                        ? 'border-red-500 text-red-700 bg-red-50/60' 
                        : 'border-slate-300 focus:border-blue-600 text-slate-900'
                    }`} 
                  />
                  <button
                    type="button"
                    onClick={() => setVoucherNumber(nextCalculatedVoucherNum)}
                    title="تطبيق الرقم التسلسلي التالي تلقائياً"
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-blue-700 hover:text-blue-900 bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded-lg font-black transition-colors cursor-pointer border border-blue-200"
                  >
                    #{nextCalculatedVoucherNum}
                  </button>
                </div>
                {isVoucherDuplicate && (
                  <div className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded p-1 flex items-center justify-between mt-0.5 animate-pulse">
                    <span className="flex items-center gap-1 font-bold">
                      <AlertTriangle size={11} />
                      مكرر!
                    </span>
                    <button
                      type="button"
                      onClick={() => setVoucherNumber(nextCalculatedVoucherNum)}
                      className="underline font-bold cursor-pointer"
                    >
                      تطبيق #{nextCalculatedVoucherNum}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5 w-full sm:w-48">
                <label className="text-xs font-black uppercase text-slate-800 tracking-wide">تاريخ السند</label>
                <input 
                  type="date" 
                  required 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  className="border-2 border-slate-300 p-2.5 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-600 bg-white shadow-2xs" 
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs bg-sky-100 text-sky-900 font-black px-3.5 py-2 rounded-xl border border-sky-300 flex items-center gap-1.5 shadow-2xs">
                <ShieldCheck size={16} className="text-sky-700" />
                <span>مناقلة أرصدة داخلية آمنة</span>
              </span>
            </div>
          </div>

          {/* Visual Accounts Flow (من ⬅️ إلى) */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-5 relative bg-white items-center">
            {/* From Account Card */}
            <div className="md:col-span-5 flex flex-col gap-3 border-2 border-rose-200/90 p-4 rounded-2xl bg-gradient-to-br from-rose-50/50 via-white to-amber-50/30 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-rose-800 flex items-center gap-1.5">
                  <Wallet size={15} className="text-rose-600" />
                  <span>الطرف المحوّل منه (خصم من الرصيد)</span>
                </span>
                <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-md">المصدر (خصم)</span>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">اختر حساب الخزينة أو البنك</label>
                <select 
                  required 
                  value={fromAccountId} 
                  onChange={e => setFromAccountId(e.target.value)} 
                  className="border-2 border-slate-300 focus:border-rose-500 p-2.5 rounded-xl text-sm font-bold text-slate-800 bg-white shadow-2xs focus:outline-none"
                >
                  <option value="">-- حدد الحساب المحوّل منه --</option>
                  {ACCOUNTS.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Middle Transfer Arrow Indicator */}
            <div className="md:col-span-2 flex flex-col items-center justify-center my-2 md:my-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md">
                <ArrowRightLeft size={20} />
              </div>
              <span className="text-[10px] font-bold text-slate-500 mt-1">مناقلة أموال</span>
            </div>

            {/* To Account Card */}
            <div className="md:col-span-5 flex flex-col gap-3 border-2 border-emerald-200/90 p-4 rounded-2xl bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/30 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
                  <Building2 size={15} className="text-emerald-600" />
                  <span>الطرف المحوّل إليه (إيداع في الرصيد)</span>
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">المستلم (إيداع)</span>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">اختر حساب الخزينة أو البنك</label>
                <select 
                  required 
                  value={toAccountId} 
                  onChange={e => setToAccountId(e.target.value)} 
                  className="border-2 border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-sm font-bold text-slate-800 bg-white shadow-2xs focus:outline-none"
                >
                  <option value="">-- حدد الحساب المحوّل إليه --</option>
                  {ACCOUNTS.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Amount & Description Inputs */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-slate-200 bg-white">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black uppercase text-blue-950 tracking-wide">المبلغ المحول ({currencyFullNameAr}) <span className="text-red-500">*</span></label>
              <input 
                type="number" 
                step="0.01" 
                min="0.01" 
                required 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                placeholder="0.00" 
                className="border-2 border-blue-400 focus:border-blue-600 p-2.5 rounded-xl text-base focus:outline-none font-mono font-black text-left text-blue-950 bg-white shadow-2xs" 
                dir="ltr" 
              />
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-xs font-black uppercase text-slate-800 tracking-wide">البيان والشرح المحاسبي لسبب التحويل <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                required 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="مثال: تغذية الصندوق الرئيسي من الحساب البنكي / تحويل إيرادات المبيعات..." 
                className="border-2 border-slate-300 focus:border-blue-600 p-2.5 rounded-xl text-sm font-bold text-slate-900 focus:outline-none bg-white shadow-2xs" 
              />
            </div>
          </div>

          {/* 🌟 ON-SCREEN INTERACTIVE INTERNAL TRANSFER CERTIFICATE 🌟 */}
          <div className="p-5 sm:p-6 bg-slate-50/80 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Sparkles size={14} className="text-blue-600" />
                <span>المعاينة التفاعلية المباشرة لسند التحويل الداخلي:</span>
              </span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-blue-50 text-blue-800 border-blue-300">
                🔷 نموذج مناقلة مالية معتمد
              </span>
            </div>

            <div className="rounded-3xl p-6 sm:p-8 border-2 border-blue-300 bg-gradient-to-br from-blue-50/70 via-white to-sky-50/40 shadow-md">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b-2 border-dashed border-slate-300">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-sm">
                    <ArrowRightLeft size={22} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900">شركة لوجوستريا للمحاسبة والتجارة</h3>
                    <p className="text-xs text-slate-500 font-medium">سند مناقلة وتحويل أرصدة نقدية وبنكية داخلية</p>
                  </div>
                </div>

                <div className="text-left sm:text-right flex flex-col sm:items-end">
                  <span className="text-xs sm:text-sm font-black px-3 py-1 rounded-xl border bg-blue-100 text-blue-900 border-blue-400">
                    سند تحويل داخلي (Internal Transfer)
                  </span>
                  <div className="flex items-center gap-3 mt-1 text-xs font-mono">
                    <span className="font-bold text-slate-700">رقم السند: #{voucherNumber}</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-bold text-slate-700">التاريخ: {date}</span>
                  </div>
                </div>
              </div>

              {/* Amount & Tafqeet Calligraphy */}
              <div className="my-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-5 bg-slate-900 text-white p-4 rounded-2xl border-2 border-slate-800 shadow-inner flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">المبلغ المحول</span>
                    <span className="text-2xl sm:text-3xl font-mono font-black text-sky-400">
                      {amount ? Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </span>
                  </div>
                  <span className="text-xs font-extrabold px-2.5 py-1 bg-slate-800 text-amber-300 rounded-lg border border-slate-700 font-sans">
                    {currencyFullNameAr}
                  </span>
                </div>

                <div className="md:col-span-7 bg-amber-50/90 border border-amber-200/90 p-3.5 rounded-2xl">
                  <span className="text-[10px] text-amber-900 font-bold block mb-0.5">المبلغ كتابة بالحروف وفقط:</span>
                  <p className="font-black text-amber-950 font-sans text-xs sm:text-sm leading-relaxed">
                    {amount && Number(amount) > 0 ? tafqeet(Number(amount)) : `فقط صفر ${currencyFullNameAr} لا غير`}
                  </p>
                </div>
              </div>

              {/* Flow Path */}
              <div className="bg-white/90 p-4 rounded-2xl border border-slate-200/90 space-y-3 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500 w-24 shrink-0">مسار التحويل:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                        {getAccountName(fromAccountId) || 'الحساب المصدر (غير محدد)'}
                      </span>
                      <ArrowLeft size={16} className="text-slate-400" />
                      <span className="font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        {getAccountName(toAccountId) || 'الحساب المستلم (غير محدد)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="font-bold text-slate-500 w-24 shrink-0">البيان والسبب:</span>
                  <span className="font-bold text-slate-800">
                    {description || 'تحويل ومناقلة أرصدة نقدية وبنكية'}
                  </span>
                </div>
              </div>

              {/* Signatures Footer */}
              <div className="mt-5 pt-4 border-t border-slate-200/90 grid grid-cols-3 gap-3 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-white/70 border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">المسؤول المحوّل</span>
                  <div className="h-7 flex items-center justify-center font-bold text-slate-800 text-[11px]">
                    ..................................
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/70 border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">المسؤول المستلم</span>
                  <div className="h-7 flex items-center justify-center font-bold text-slate-800 text-[11px]">
                    ..................................
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/70 border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">اعتماد الإدارة المالية</span>
                  <div className="h-7 flex items-center justify-center font-bold text-slate-800 text-[11px]">
                    ..................................
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-slate-900 text-white p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 print:hidden border-t-2 border-slate-800">
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">المبلغ المحول</span>
                <span className="text-2xl sm:text-3xl font-mono font-black text-sky-400">
                  {amount ? Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  <span className="text-xs font-sans text-slate-400 mr-1.5 font-bold">{currencyFullNameAr}</span>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => {
                  setCustomPreviewData(null);
                  setShowPrintPreview(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-xl font-bold text-xs border border-slate-700 transition-colors cursor-pointer"
              >
                <Eye size={15} />
                <span>معاينة الطباعة</span>
              </button>

              <button 
                type="submit" 
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-950/40 text-sm font-black transition-all cursor-pointer border border-blue-400/30"
              >
                <Save size={17} /> 
                <span>{editingVoucherId ? 'حفظ تعديلات السند' : 'حفظ وترحيل سند التحويل'}</span>
              </button>
            </div>
          </div>

          {/* Print Signatures */}
          <div className="hidden print:grid grid-cols-3 gap-8 mt-16 pt-8 text-center text-slate-800">
            <div>
              <p className="font-bold mb-12">المسؤول المحوّل</p>
              <div className="border-b-2 border-dashed border-slate-300 w-2/3 mx-auto"></div>
            </div>
            <div>
              <p className="font-bold mb-12">المسؤول المستلم</p>
              <div className="border-b-2 border-dashed border-slate-300 w-2/3 mx-auto"></div>
            </div>
            <div>
              <p className="font-bold mb-12">اعتماد الإدارة</p>
              <div className="border-b-2 border-dashed border-slate-300 w-2/3 mx-auto"></div>
            </div>
          </div>
        </div>
      </form>

      {/* Universal Print Preview Modal */}
      <PrintPreviewModal
        isOpen={showPrintPreview}
        onClose={() => {
          setShowPrintPreview(false);
          setCustomPreviewData(null);
        }}
        data={
          customPreviewData || {
            title: 'سند تحويل ومناقلة داخلية',
            subtitle: 'سند تحويل مالي بين الحسابات والصناديق الداخلية',
            docNumber: voucherNumber,
            date: date,
            partnerName: `من: ${getAccountName(fromAccountId)} ⬅️ إلى: ${getAccountName(toAccountId)}`,
            paymentMethod: 'تحويل حساب داخلي',
            notes: description,
            grandTotal: Number(amount) || 0,
            subtotal: Number(amount) || 0,
            amount: Number(amount) || 0,
            paidAmount: Number(amount) || 0,
            voucherType: 'INTERNAL',
            amountInWords: tafqeet(Number(amount) || 0),
            items: [{
              description: `مناقلة من (${getAccountName(fromAccountId)}) إلى (${getAccountName(toAccountId)}) - ${description || 'تحويل داخلي'}`,
              quantity: 1,
              unitPrice: Number(amount) || 0,
              taxRate: 0,
              total: Number(amount) || 0
            }]
          }
        }
      />
    </div>
  );
}
