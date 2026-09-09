import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { 
  Save, ArrowUpRight, ArrowDownLeft, Plus, History, AlertTriangle, 
  Edit3, Trash2, X, Eye, FileText, Truck, Users,
  ShieldCheck, DollarSign, Wallet, Sparkles
} from 'lucide-react';
import { VoucherType, Partner } from '../types/accounting';
import PrintDropdown from './PrintDropdown';
import PrintPreviewModal, { PrintPreviewData } from './PrintPreviewModal';
import PartnerStatementModal from './PartnerStatementModal';
import { useSystemCurrency } from '../utils/currency';
import { 
  getNextSequentialNumber, 
  isCodeOrNumberDuplicated, 
  advanceSequenceAfterSave,
  DB_RECEIPT_VOUCHERS_KEY,
  DB_PAYMENT_VOUCHERS_KEY
} from '../utils/sequences';
import { 
  loadCustomers, 
  loadVendors, 
  getPartnerAccountStatement, 
  dispatchPartnerLedgerUpdated,
  StoredVoucherRecord
} from '../utils/partnerLedger';

export type StoredExternalVoucher = StoredVoucherRecord;

function loadStoredVouchers(storageKey: string): StoredExternalVoucher[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load vouchers:', e);
  }
  return [];
}

export default function ExternalVouchers() {
  const { fullNameAr: currencyFullNameAr, tafqeet } = useSystemCurrency();
  const [type, setType] = useState<VoucherType>(VoucherType.Receipt);
  const [receiptVouchers, setReceiptVouchers] = useState<StoredExternalVoucher[]>(() => loadStoredVouchers(DB_RECEIPT_VOUCHERS_KEY));
  const [paymentVouchers, setPaymentVouchers] = useState<StoredExternalVoucher[]>(() => loadStoredVouchers(DB_PAYMENT_VOUCHERS_KEY));
  const [showHistory, setShowHistory] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [customPreviewData, setCustomPreviewData] = useState<PrintPreviewData | null>(null);

  // Dynamic Customers and Vendors loaded from unified ledger
  const [customers, setCustomers] = useState<Partner[]>(() => loadCustomers());
  const [vendors, setVendors] = useState<Partner[]>(() => loadVendors());
  const [partnerFilterCategory, setPartnerFilterCategory] = useState<'AUTO' | 'CUSTOMERS' | 'VENDORS' | 'ALL'>('AUTO');
  
  // Statement Modal State
  const [selectedPartnerForStatement, setSelectedPartnerForStatement] = useState<Partner | null>(null);

  useEffect(() => {
    const handleSync = () => {
      setCustomers(loadCustomers());
      setVendors(loadVendors());
      setReceiptVouchers(loadStoredVouchers(DB_RECEIPT_VOUCHERS_KEY));
      setPaymentVouchers(loadStoredVouchers(DB_PAYMENT_VOUCHERS_KEY));
    };
    window.addEventListener('alpha-partner-ledger-updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('alpha-partner-ledger-updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const isReceipt = type === VoucherType.Receipt;
  const currentKey = isReceipt ? DB_RECEIPT_VOUCHERS_KEY : DB_PAYMENT_VOUCHERS_KEY;
  const currentDocType = isReceipt ? 'receiptVoucher' : 'paymentVoucher';
  const currentSavedList = isReceipt ? receiptVouchers : paymentVouchers;

  // Next calculated sequential voucher number based on DB records
  const nextCalculatedVoucherNum = useMemo(() => {
    return getNextSequentialNumber(currentDocType, currentSavedList.map(v => v.voucherNumber)).formatted;
  }, [currentDocType, currentSavedList]);

  const [voucherNumber, setVoucherNumber] = useState<string>(() => nextCalculatedVoucherNum);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0] as string);
  const [partnerId, setPartnerId] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('cash');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // All combined partners
  const allPartnersCombined = useMemo(() => {
    return [
      ...customers.map(c => ({ ...c, type: 'CUSTOMER' as const })),
      ...vendors.map(v => ({ ...v, type: 'VENDOR' as const }))
    ];
  }, [customers, vendors]);

  // Partners available in dropdown based on active tab and filter category
  const availablePartners = useMemo(() => {
    if (partnerFilterCategory === 'CUSTOMERS') {
      return customers.map(c => ({ ...c, type: 'CUSTOMER' as const }));
    }
    if (partnerFilterCategory === 'VENDORS') {
      return vendors.map(v => ({ ...v, type: 'VENDOR' as const }));
    }
    if (partnerFilterCategory === 'ALL') {
      return allPartnersCombined;
    }
    // AUTO: For receipt, prefer customers first; for payment, prefer vendors first
    if (isReceipt) {
      return [
        ...customers.map(c => ({ ...c, type: 'CUSTOMER' as const })),
        ...vendors.map(v => ({ ...v, type: 'VENDOR' as const }))
      ];
    } else {
      return [
        ...vendors.map(v => ({ ...v, type: 'VENDOR' as const })),
        ...customers.map(c => ({ ...c, type: 'CUSTOMER' as const }))
      ];
    }
  }, [customers, vendors, allPartnersCombined, partnerFilterCategory, isReceipt]);

  // Currently selected partner object
  const selectedPartner = useMemo(() => {
    if (!partnerId) return null;
    return allPartnersCombined.find(p => p.id === partnerId || p.name === partnerId) || null;
  }, [partnerId, allPartnersCombined]);

  // Live Statement of account for selected partner
  const selectedPartnerStatement = useMemo(() => {
    if (!selectedPartner) return null;
    return getPartnerAccountStatement(selectedPartner);
  }, [selectedPartner, receiptVouchers, paymentVouchers]);

  // Simulated balance impact
  const balanceSimulation = useMemo(() => {
    if (!selectedPartner || !selectedPartnerStatement) return null;
    const inputAmt = Number(amount) || 0;
    const currentDebit = selectedPartnerStatement.totalDebit;
    const currentCredit = selectedPartnerStatement.totalCredit;
    const isCust = selectedPartner.type === 'CUSTOMER';

    let projectedDebit = currentDebit;
    let projectedCredit = currentCredit;

    if (isReceipt) {
      // Receipt adds credit to partner (reduces receivable / adds advance)
      projectedCredit += inputAmt;
    } else {
      // Payment adds debit to partner (reduces payable / adds advance)
      projectedDebit += inputAmt;
    }

    let projectedNet = 0;
    let projectedType: 'DEBIT' | 'CREDIT' | 'ZERO' = 'ZERO';
    let projectedLabel = 'متزن (0.00)';

    if (isCust) {
      projectedNet = projectedDebit - projectedCredit;
      if (projectedNet > 0.001) {
        projectedType = 'DEBIT';
        projectedLabel = 'مدين (مستحق لنا)';
      } else if (projectedNet < -0.001) {
        projectedType = 'CREDIT';
        projectedLabel = 'دائن (دفعة مقدمة له)';
      }
    } else {
      // Vendor
      projectedNet = projectedCredit - projectedDebit;
      if (projectedNet > 0.001) {
        projectedType = 'CREDIT';
        projectedLabel = 'دائن (مستحق للمورد)';
      } else if (projectedNet < -0.001) {
        projectedType = 'DEBIT';
        projectedLabel = 'مدين (دفعة مقدمة لنا)';
      }
    }

    return {
      currentBalanceFormatted: selectedPartnerStatement.balanceFormatted,
      currentBalanceLabel: selectedPartnerStatement.balanceLabel,
      currentBalanceType: selectedPartnerStatement.balanceType,
      voucherImpact: inputAmt,
      projectedNetFormatted: Math.abs(projectedNet).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      projectedLabel,
      projectedType
    };
  }, [selectedPartner, selectedPartnerStatement, amount, isReceipt]);

  // Duplicate check (ignoring current editing voucher)
  const isVoucherDuplicate = useMemo(() => {
    if (!voucherNumber) return false;
    const listToCheck = editingVoucherId 
      ? currentSavedList.filter(v => v.id !== editingVoucherId)
      : currentSavedList;
    return isCodeOrNumberDuplicated(voucherNumber, currentDocType, listToCheck.map(v => v.voucherNumber));
  }, [voucherNumber, currentDocType, currentSavedList, editingVoucherId]);

  const handleTypeChange = (newType: VoucherType) => {
    setType(newType);
    setEditingVoucherId(null);
    const newDocType = newType === VoucherType.Receipt ? 'receiptVoucher' : 'paymentVoucher';
    const newList = newType === VoucherType.Receipt ? receiptVouchers : paymentVouchers;
    const nextSeq = getNextSequentialNumber(newDocType, newList.map(v => v.voucherNumber)).formatted;
    setVoucherNumber(nextSeq);
    setPartnerId('');
  };

  const handleNewVoucher = () => {
    setEditingVoucherId(null);
    const nextSeq = getNextSequentialNumber(currentDocType, currentSavedList.map(v => v.voucherNumber)).formatted;
    setVoucherNumber(nextSeq);
    setAmount('');
    setDescription('');
    setPartnerId('');
    setAccountId('cash');
  };

  const handleEdit = (v: StoredExternalVoucher) => {
    setEditingVoucherId(v.id);
    setType(v.type);
    setVoucherNumber(v.voucherNumber);
    setDate(v.date);
    setPartnerId(v.partnerId);
    setAccountId(v.accountId);
    setAmount(v.amount.toString());
    setDescription(v.description);
    setShowHistory(false);
  };

  const handleDelete = (id: string, vNum: string) => {
    if (confirm(`هل أنت متأكد من رغبتك في حذف السند رقم (${vNum}) نهائياً؟ سيتم إلغاء تأثيره المحاسبي فوراً من حساب العميل/المورد.`)) {
      const updatedList = currentSavedList.filter(v => v.id !== id);
      if (isReceipt) {
        setReceiptVouchers(updatedList);
      } else {
        setPaymentVouchers(updatedList);
      }
      try {
        localStorage.setItem(currentKey, JSON.stringify(updatedList));
        dispatchPartnerLedgerUpdated();
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
    if (!partnerId || !amount || !accountId) return;

    const finalNumber = voucherNumber.trim() || nextCalculatedVoucherNum;
    const partner = allPartnersCombined.find(p => p.id === partnerId);
    
    const voucherData: StoredExternalVoucher = {
      id: editingVoucherId || Date.now().toString(),
      type,
      voucherNumber: finalNumber,
      date,
      partnerId,
      partnerName: partner?.name || 'طرف خارجي',
      partnerType: partner?.type || (isReceipt ? 'CUSTOMER' : 'VENDOR'),
      accountId,
      amount: Number(amount) || 0,
      description: description.trim() || (isReceipt ? `سند قبض نقدي من ${partner?.name || 'طرف خارجي'}` : `سند صرف نقدي إلى ${partner?.name || 'طرف خارجي'}`),
      createdAt: new Date().toISOString()
    };

    let updatedList: StoredExternalVoucher[];
    if (editingVoucherId) {
      updatedList = currentSavedList.map(v => v.id === editingVoucherId ? voucherData : v);
    } else {
      updatedList = [
        voucherData,
        ...currentSavedList.filter(v => v.voucherNumber.trim().toLowerCase() !== finalNumber.toLowerCase())
      ];
      advanceSequenceAfterSave(currentDocType, finalNumber);
    }

    if (isReceipt) {
      setReceiptVouchers(updatedList);
    } else {
      setPaymentVouchers(updatedList);
    }

    try {
      localStorage.setItem(currentKey, JSON.stringify(updatedList));
      dispatchPartnerLedgerUpdated();
    } catch (err) {
      console.error(err);
    }

    alert(`تم ${editingVoucherId ? 'تعديل وحفظ' : 'تسجيل'} ${isReceipt ? 'سند القبض' : 'سند الصرف'} رقم (${finalNumber}) بنجاح بقيمة ${Number(amount).toLocaleString()} ريال، وتم تحديث حساب (${partner?.name}) آلياً!`);
    
    setEditingVoucherId(null);
    const nextSeq = getNextSequentialNumber(currentDocType, updatedList.map(v => v.voucherNumber)).formatted;
    setVoucherNumber(nextSeq);
    setAmount('');
    setDescription('');
  };

  return (
    <div className="flex flex-col flex-1">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-6 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1 text-slate-500">
            <span className="text-xs uppercase font-bold tracking-tight">الخزينة والمالية</span>
            <span className="text-xs">/</span>
            <span className="text-xs uppercase font-bold tracking-tight">سندات القبض والصرف</span>
            <span className="text-xs">/</span>
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200">
              مترابط مع حسابات العملاء والموردين
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">
              {isReceipt ? 'سند قبض خارجي (استلام نقدية)' : 'سند صرف خارجي (دفع نقدية)'}
            </h2>
            <span className={`text-xs sm:text-sm font-bold px-2.5 py-1 rounded-md font-mono border ${isReceipt ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
              سند رقم: #{voucherNumber}
            </span>
            {editingVoucherId && (
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold border border-amber-300 flex items-center gap-1">
                <Edit3 size={12} /> وضع التعديل
              </span>
            )}
          </div>
          <p className="text-slate-500 mt-1 text-xs sm:text-sm">
            إصدار سندات القبض والصرف الرسمية مع الترحيل الفوري المباشر لدفاتر وحسابات الأطراف.
          </p>
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
            <History size={15} /> سجل السندات ({currentSavedList.length})
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
            title="معاينة السند قبل الطباعة"
          >
            <Eye size={14} />
            <span>معاينة السند</span>
          </button>
          <PrintDropdown 
            onPreview={() => {
              setCustomPreviewData(null);
              setShowPrintPreview(true);
            }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/80 mb-6 print:hidden">
        <button
          type="button"
          onClick={() => handleTypeChange(VoucherType.Receipt)}
          className={`flex-1 min-w-[220px] flex items-center justify-center gap-2.5 py-3 px-6 rounded-xl font-bold text-sm transition-all cursor-pointer shadow-xs ${
            isReceipt
              ? 'bg-gradient-to-r from-emerald-700 to-teal-700 text-white shadow-emerald-700/20'
              : 'bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent'
          }`}
        >
          <ArrowDownLeft size={18} className={isReceipt ? 'text-emerald-200' : 'text-emerald-600'} />
          <span>سند قبض (استلام نقدية من عميل / مورد)</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-black ${
            isReceipt ? 'bg-emerald-800/80 text-emerald-100' : 'bg-slate-100 text-slate-600'
          }`}>
            {receiptVouchers.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => handleTypeChange(VoucherType.Payment)}
          className={`flex-1 min-w-[220px] flex items-center justify-center gap-2.5 py-3 px-6 rounded-xl font-bold text-sm transition-all cursor-pointer shadow-xs ${
            !isReceipt
              ? 'bg-gradient-to-r from-rose-700 to-amber-700 text-white shadow-rose-700/20'
              : 'bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent'
          }`}
        >
          <ArrowUpRight size={18} className={!isReceipt ? 'text-rose-200' : 'text-rose-600'} />
          <span>سند صرف (دفع نقدية لمورد / عميل)</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-black ${
            !isReceipt ? 'bg-rose-800/80 text-rose-100' : 'bg-slate-100 text-slate-600'
          }`}>
            {paymentVouchers.length}
          </span>
        </button>
      </div>

      {/* Collapsible History Drawer */}
      {showHistory && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-4 shadow-sm animate-in fade-in duration-150 print:hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <History size={16} className={isReceipt ? 'text-emerald-600' : 'text-red-600'} />
              <h3 className="font-bold text-slate-800 text-sm">
                سجل {isReceipt ? 'سندات القبض' : 'سندات الصرف'} المسجلة والمربوطة بالحسابات
              </h3>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">{currentSavedList.length} سندات</span>
            </div>
            <button 
              type="button" 
              onClick={() => setShowHistory(false)}
              className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              إغلاق
            </button>
          </div>
          {currentSavedList.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">لا توجد سندات محفوظة بعد. السند القادم سيبدأ برقم #{nextCalculatedVoucherNum}.</p>
          ) : (
            <div className="overflow-x-auto max-h-56">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400">
                    <th className="pb-2 font-semibold">رقم السند</th>
                    <th className="pb-2 font-semibold">الطرف والحساب</th>
                    <th className="pb-2 font-semibold">حساب الخزينة/البنك</th>
                    <th className="pb-2 font-semibold">المبلغ</th>
                    <th className="pb-2 font-semibold">التاريخ</th>
                    <th className="pb-2 font-semibold">البيان</th>
                    <th className="pb-2 font-semibold text-center">إجراءات وكشف الحساب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {currentSavedList.map(v => {
                    const matchedPartner = allPartnersCombined.find(p => p.id === v.partnerId || p.name === v.partnerName);
                    return (
                      <tr key={v.id} className={`hover:bg-slate-50 transition-colors ${editingVoucherId === v.id ? 'bg-blue-50/60' : ''}`}>
                        <td className={`py-2 font-mono font-bold ${isReceipt ? 'text-emerald-600' : 'text-red-600'}`}>#{v.voucherNumber}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-800 font-medium">{v.partnerName}</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                              (matchedPartner?.type === 'CUSTOMER' || v.partnerType === 'CUSTOMER')
                                ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}>
                              {(matchedPartner?.type === 'CUSTOMER' || v.partnerType === 'CUSTOMER') ? 'عميل' : 'مورد'}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 text-slate-500 font-medium">{v.accountId === 'cash' ? 'الصندوق الرئيسي' : 'البنك الأهلي'}</td>
                        <td className="py-2 font-mono font-bold text-slate-800">{v.amount.toLocaleString()} ريال</td>
                        <td className="py-2 text-slate-500 font-mono">{v.date}</td>
                        <td className="py-2 text-slate-500 truncate max-w-xs">{v.description}</td>
                        <td className="py-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {matchedPartner && (
                              <button
                                type="button"
                                onClick={() => setSelectedPartnerForStatement(matchedPartner)}
                                className="flex items-center gap-0.5 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                                title="عرض كشف الحساب التفصيلي للطرف"
                              >
                                <FileText size={12} />
                                <span>كشف الحساب</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setCustomPreviewData({
                                  title: isReceipt ? 'سند قبض مالي معتمد' : 'سند صرف مالي معتمد',
                                  subtitle: isReceipt ? 'سند استلام نقدية من طرف خارجي ومرحل بالحسابات' : 'سند دفع نقدية لطرف خارجي ومرحل بالحسابات',
                                  docNumber: v.voucherNumber,
                                  date: v.date,
                                  partnerName: v.partnerName,
                                  partnerType: (matchedPartner?.type || v.partnerType || (isReceipt ? 'CUSTOMER' : 'VENDOR')),
                                  paymentMethod: v.accountId === 'cash' ? 'الصندوق الرئيسي (نقداً)' : 'البنك الأهلي (تحويل بنكي)',
                                  notes: v.description,
                                  grandTotal: v.amount,
                                  subtotal: v.amount,
                                  amount: v.amount,
                                  paidAmount: v.amount,
                                  voucherType: isReceipt ? 'RECEIPT' : 'PAYMENT',
                                  amountInWords: tafqeet(v.amount),
                                  items: [{
                                    description: v.description || (isReceipt ? 'مقبوضات نقدية' : 'مدفوعات نقدية'),
                                    quantity: 1,
                                    unitPrice: v.amount,
                                    taxRate: 0,
                                    total: v.amount
                                  }]
                                });
                                setShowPrintPreview(true);
                              }}
                              className="flex items-center gap-0.5 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                              title="معاينة السند"
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSave} className="flex flex-col flex-1">
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 print:border-none print:shadow-none flex flex-col overflow-hidden mb-6">
          
          {/* Top Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-6 border-b border-slate-200 bg-slate-100/90 print:bg-transparent print:p-0 print:mb-6">
            
            {/* Voucher Number */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase text-slate-800 tracking-wide">رقم السند</label>
                <span className="text-[10px] bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md font-black border border-blue-300">تسلسلي تلقائي فريد</span>
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
                    رقم السند مكرر بقاعدة البيانات!
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

            {/* Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black uppercase text-slate-800 tracking-wide">تاريخ السند</label>
              <input 
                type="date" 
                required 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                className="border-2 border-slate-300 p-2.5 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-600 bg-white shadow-2xs" 
              />
            </div>

            {/* Partner Selector (Customer / Vendor) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className={`text-xs font-black uppercase tracking-wide ${isReceipt ? 'text-emerald-950' : 'text-rose-950'}`}>
                  {isReceipt ? 'مستلم من (حساب العميل / المورد)' : 'يصرف إلى (حساب المورد / العميل)'}
                </label>
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setPartnerFilterCategory(partnerFilterCategory === 'ALL' ? 'AUTO' : 'ALL')}
                    className="text-indigo-700 hover:text-indigo-900 font-bold hover:underline cursor-pointer"
                  >
                    {partnerFilterCategory === 'ALL' ? 'تصفية تلقائية' : 'عرض كافة الأطراف'}
                  </button>
                </div>
              </div>

              <select 
                required 
                value={partnerId} 
                onChange={e => setPartnerId(e.target.value)} 
                className={`border-2 p-2.5 rounded-xl text-sm focus:outline-none bg-white font-bold text-slate-900 shadow-2xs ${
                  isReceipt 
                    ? 'border-emerald-300 focus:border-emerald-600' 
                    : 'border-rose-300 focus:border-rose-600'
                }`}
              >
                <option value="">-- اختر حساب الطرف (عميل أو مورد) --</option>
                {availablePartners.map(p => (
                  <option key={`${p.type}-${p.id}`} value={p.id}>
                    [{p.type === 'CUSTOMER' ? 'عميل' : 'مورد'}] {p.name} {p.phone ? `(${p.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* 🌟 LIVE PARTNER FINANCIAL BALANCE & IMPACT CARD 🌟 */}
          {selectedPartner && selectedPartnerStatement && balanceSimulation && (
            <div className="p-4 bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 border-b border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-150">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  selectedPartner.type === 'CUSTOMER' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-purple-100 text-purple-700 border-purple-200'
                }`}>
                  {selectedPartner.type === 'CUSTOMER' ? <Users size={18} /> : <Truck size={18} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{selectedPartner.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                      selectedPartner.type === 'CUSTOMER' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                    }`}>
                      {selectedPartner.type === 'CUSTOMER' ? 'حساب عميل' : 'حساب مورد'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    {selectedPartner.taxNumber && <span>الرقم الضريبي: {selectedPartner.taxNumber}</span>}
                    {selectedPartner.phone && <span>هاتف: {selectedPartner.phone}</span>}
                  </div>
                </div>
              </div>

              {/* Balances Comparison */}
              <div className="flex flex-wrap items-center gap-3 md:gap-6 text-xs bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                
                {/* Current Balance */}
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-medium">الرصيد الحالي قبل السند:</span>
                  <span className="font-bold font-mono text-slate-800 text-sm">
                    {balanceSimulation.currentBalanceFormatted} ريال
                  </span>
                  <span className="text-[10px] text-slate-500">{balanceSimulation.currentBalanceLabel}</span>
                </div>

                <span className="text-slate-300 font-light text-xl hidden sm:inline">←</span>

                {/* Voucher Impact */}
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-medium">قيمة السند الحالي:</span>
                  <span className={`font-bold font-mono text-sm ${isReceipt ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isReceipt ? '+' : '-'} {balanceSimulation.voucherImpact.toLocaleString(undefined, { minimumFractionDigits: 2 })} ريال
                  </span>
                  <span className="text-[10px] text-slate-500">{isReceipt ? 'مقبوضات تسدد الحساب' : 'مدفوعات تصرف للطرف'}</span>
                </div>

                <span className="text-slate-300 font-light text-xl hidden sm:inline">←</span>

                {/* Projected New Balance */}
                <div className="flex flex-col bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-indigo-600 font-bold">الرصيد المتوقع بعد الترحيل:</span>
                  <span className="font-bold font-mono text-indigo-700 text-sm">
                    {balanceSimulation.projectedNetFormatted} ريال
                  </span>
                  <span className="text-[10px] text-slate-600 font-semibold">{balanceSimulation.projectedLabel}</span>
                </div>

                {/* View Statement Button */}
                <button
                  type="button"
                  onClick={() => setSelectedPartnerForStatement(selectedPartner)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  title="عرض كشف حساب تفصيلي كامل ومطابقة الحركات"
                >
                  <FileText size={13} />
                  <span>كشف الحساب</span>
                </button>

              </div>
            </div>
          )}

          {/* Account / Safe / Bank & Amount Details */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-white print:p-0 print:mb-6">
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black uppercase text-slate-800 tracking-wide">حساب الصندوق / البنك المسحوب منه أو المودع فيه</label>
              <select 
                required 
                value={accountId} 
                onChange={e => setAccountId(e.target.value)} 
                className="border-2 border-slate-300 p-2.5 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-600 bg-white shadow-2xs"
              >
                <option value="cash">الصندوق الرئيسي (الخزينة النقدية)</option>
                <option value="bank">البنك الأهلي السعودي (حساب جاري)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={`text-xs font-black uppercase tracking-wide flex items-center justify-between ${
                isReceipt ? 'text-emerald-950' : 'text-rose-950'
              }`}>
                <span>المبلغ المدفوع / المستلم ({currencyFullNameAr}) <span className="text-red-500">*</span></span>
              </label>
              <input 
                type="number" 
                step="0.01" 
                min="0.01" 
                required 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                placeholder="0.00" 
                className={`border-2 p-2.5 rounded-xl text-base focus:outline-none font-mono text-left font-black text-slate-900 bg-white shadow-2xs ${
                  isReceipt 
                    ? 'border-emerald-400 focus:border-emerald-600 text-emerald-950' 
                    : 'border-rose-400 focus:border-rose-600 text-rose-950'
                }`} 
                dir="ltr" 
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black uppercase text-slate-800 tracking-wide">البيان والشرح المحاسبي <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                required 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder={isReceipt ? 'سداد دفعة عن فاتورة مبيعات / دفعة مقدمة...' : 'سداد مستحقات توريد / دفعة لمورد...'} 
                className="border-2 border-slate-300 p-2.5 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-600 bg-white shadow-2xs" 
              />
            </div>

          </div>
          
          {/* 🌟 LUXURY ON-SCREEN INTERACTIVE VOUCHER CERTIFICATE (معاينة السند التفاعلية بالألوان والتصميم الجذاب) 🌟 */}
          <div className="p-5 sm:p-6 bg-slate-50/70 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Sparkles size={14} className={isReceipt ? 'text-emerald-600' : 'text-rose-600'} />
                <span>المعاينة التفاعلية المباشرة للسند (نموذج المستند الرسمي):</span>
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                isReceipt 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                  : 'bg-rose-50 text-rose-800 border-rose-300'
              }`}>
                {isReceipt ? '🟢 نموذج سند قبض نقدية رسمي' : '🔴 نموذج سند صرف نقدية رسمي'}
              </span>
            </div>

            {/* Authentic Ornate Voucher Certificate Box */}
            <div className={`relative rounded-3xl p-6 sm:p-8 border-2 transition-all shadow-md ${
              isReceipt
                ? 'bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40 border-emerald-300/90'
                : 'bg-gradient-to-br from-rose-50/70 via-white to-amber-50/40 border-rose-300/90'
            }`}>
              
              {/* Top Watermark & Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b-2 border-dashed border-slate-300">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm ${
                    isReceipt ? 'bg-gradient-to-br from-emerald-600 to-teal-700' : 'bg-gradient-to-br from-rose-600 to-amber-700'
                  }`}>
                    {isReceipt ? <DollarSign size={24} /> : <Wallet size={24} />}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900">شركة لوجوستريا التجارية</h3>
                    <p className="text-xs text-slate-500 font-medium">سند محاسبي رسمي معتمد - الفرع الرئيسي (المملكة العربية السعودية)</p>
                  </div>
                </div>

                <div className="text-left sm:text-right flex flex-col sm:items-end">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs sm:text-sm font-black px-3 py-1 rounded-xl border ${
                      isReceipt 
                        ? 'bg-emerald-100/90 text-emerald-900 border-emerald-400' 
                        : 'bg-rose-100/90 text-rose-900 border-rose-400'
                    }`}>
                      {isReceipt ? 'سند قبض مالي (Receipt Voucher)' : 'سند صرف مالي (Payment Voucher)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs font-mono">
                    <span className="font-bold text-slate-700">رقم السند: #{voucherNumber}</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-bold text-slate-700">التاريخ: {date}</span>
                  </div>
                </div>
              </div>

              {/* Amount Display & Tafqeet Calligraphy Banner */}
              <div className="my-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                {/* Amount in Numbers */}
                <div className="md:col-span-5 bg-slate-900 text-white p-4 rounded-2xl border-2 border-slate-800 shadow-inner flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                      {isReceipt ? 'المبلغ المدفوع (المقبوض)' : 'المبلغ المدفوع'}
                    </span>
                    <span className={`text-2xl sm:text-3xl font-mono font-black ${
                      isReceipt ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {amount ? Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </span>
                  </div>
                  <span className="text-xs font-extrabold px-2.5 py-1 bg-slate-800 text-amber-300 rounded-lg border border-slate-700 font-sans">
                    {currencyFullNameAr}
                  </span>
                </div>

                {/* Amount in Words (Tafqeet) */}
                <div className="md:col-span-7 bg-amber-50/90 border border-amber-200/90 p-3.5 rounded-2xl">
                  <span className="text-[10px] text-amber-900 font-bold block mb-0.5">المبلغ كتابة بالحروف وفقط:</span>
                  <p className="font-black text-amber-950 font-sans text-xs sm:text-sm leading-relaxed">
                    {amount && Number(amount) > 0 ? tafqeet(Number(amount)) : `فقط صفر ${currencyFullNameAr} لا غير`}
                  </p>
                </div>
              </div>

              {/* Partner & Purpose Details Matrix */}
              <div className="bg-white/90 p-4 rounded-2xl border border-slate-200/90 space-y-3 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500 w-28 shrink-0">
                      {isReceipt ? 'استلمنا من المكرم/السادة:' : 'صرفنا إلى المكرم/السادة:'}
                    </span>
                    <span className="font-black text-slate-900 text-sm">
                      {selectedPartner?.name || 'طرف خارجي غير محدد'}
                    </span>
                    {selectedPartner && (
                      <span className={`text-[10px] px-2 py-0.2 rounded font-bold border ${
                        selectedPartner.type === 'CUSTOMER' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                      }`}>
                        {selectedPartner.type === 'CUSTOMER' ? 'عميل' : 'مورد'}
                      </span>
                    )}
                  </div>
                  {selectedPartner?.phone && (
                    <span className="text-slate-500 font-mono text-[11px]">هاتف: {selectedPartner.phone}</span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-500 w-28 shrink-0">
                    {isReceipt ? 'وذلك عن (البيان والغرض):' : 'وذلك مقابل (البيان والغرض):'}
                  </span>
                  <span className="font-bold text-slate-800 font-sans">
                    {description || (isReceipt ? 'سداد مستحقات مالية / دفعة مبيعات' : 'سداد مستحقات توريد ومشتريات')}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500 w-28 shrink-0">طريقة الدفع والحساب:</span>
                    <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                      {accountId === 'cash' ? '💵 الصندوق الرئيسي (الخزينة النقدية)' : '🏦 البنك الأهلي السعودي (حساب جاري)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    <span>مرحل ومقيد بالدفتر المحاسبي آلياً</span>
                  </div>
                </div>
              </div>

              {/* Signatures & Official Approvals Footer */}
              <div className="mt-5 pt-4 border-t border-slate-200/90 grid grid-cols-3 gap-3 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-white/70 border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">
                    {isReceipt ? 'توقيع المستلم / المحصل' : 'توقيع المستلم للدفعة'}
                  </span>
                  <div className="h-7 flex items-center justify-center font-bold text-slate-800 text-[11px]">
                    ..................................
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-white/70 border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">المحاسب المسؤول</span>
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
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">المبلغ الإجمالي للسند</span>
                <span className={`text-2xl sm:text-3xl font-mono font-black ${
                  isReceipt ? 'text-emerald-400' : 'text-rose-400'
                }`}>
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
                className={`flex items-center justify-center gap-2 px-6 py-3 text-white rounded-xl shadow-lg text-sm font-black transition-all cursor-pointer border ${
                  isReceipt
                    ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 border-emerald-400/30 shadow-emerald-950/40'
                    : 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-600 border-rose-400/30 shadow-rose-950/40'
                }`}
              >
                <Save size={17} /> 
                <span>{editingVoucherId ? 'حفظ تعديلات السند وترحيل الحساب' : 'حفظ وترحيل السند لحساب الطرف'}</span>
              </button>
            </div>
          </div>

        </div>
      </form>

      {/* Partner Statement Modal */}
      <PartnerStatementModal
        partner={selectedPartnerForStatement}
        isOpen={Boolean(selectedPartnerForStatement)}
        onClose={() => setSelectedPartnerForStatement(null)}
      />

      {/* Universal Print Preview Modal */}
      <PrintPreviewModal
        isOpen={showPrintPreview}
        onClose={() => {
          setShowPrintPreview(false);
          setCustomPreviewData(null);
        }}
        data={
          customPreviewData || {
            title: isReceipt ? 'سند قبض مالي معتمد' : 'سند صرف مالي معتمد',
            subtitle: isReceipt ? 'سند استلام نقدية من طرف خارجي ومرحل بالحسابات' : 'سند دفع نقدية لطرف خارجي ومرحل بالحسابات',
            docNumber: voucherNumber,
            date: date,
            partnerName: selectedPartner?.name || 'طرف خارجي غير محدد',
            partnerType: selectedPartner?.type || (isReceipt ? 'CUSTOMER' : 'VENDOR'),
            paymentMethod: accountId === 'cash' ? 'الصندوق الرئيسي (نقداً)' : 'البنك الأهلي (تحويل بنكي)',
            notes: description || (isReceipt ? 'سند قبض نقدية' : 'سند صرف نقدية'),
            grandTotal: Number(amount) || 0,
            subtotal: Number(amount) || 0,
            amount: Number(amount) || 0,
            paidAmount: Number(amount) || 0,
            voucherType: isReceipt ? 'RECEIPT' : 'PAYMENT',
            amountInWords: tafqeet(Number(amount) || 0),
            items: [{
              description: description || (isReceipt ? 'مقبوضات نقدية' : 'مدفوعات نقدية'),
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
