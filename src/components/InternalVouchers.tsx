import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { 
  Save, ArrowRightLeft, Plus, History, AlertTriangle, Edit3, Trash2, X, Eye,
  Building2, Wallet, Sparkles, ShieldCheck, ArrowLeft, CheckCircle2, RotateCcw,
  ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft,
  FileSpreadsheet, UserCheck
} from 'lucide-react';
import { SystemSettings } from '../types/accounting';
import PrintDropdown from './PrintDropdown';
import PrintPreviewModal, { PrintPreviewData } from './PrintPreviewModal';
import VouchersExportModal from './VouchersExportModal';
import VoucherApprovalStepper from './VoucherApprovalStepper';
import VouchersApprovalCenterModal from './VouchersApprovalCenterModal';
import { 
  isApprovalRequired, 
  canVoucherBePosted 
} from '../utils/voucherApproval';
import { getSystemSettings } from '../utils/settings';
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
  status?: 'DRAFT' | 'POSTED' | undefined;
  postedAt?: string | undefined;
  // دورة الاعتماد الهرمية (Approval Hierarchy)
  requiresApproval?: boolean | undefined;
  approvalStatus?: 'NOT_REQUIRED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | undefined;
  approvedBy?: string | undefined;
  approvedAt?: string | undefined;
  approvalRole?: string | undefined;
  approvalNotes?: string | undefined;
  rejectedBy?: string | undefined;
  rejectedAt?: string | undefined;
  rejectionReason?: string | undefined;
  preparedBy?: string | undefined;
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
  const { symbol: currencySymbol, fullNameAr: currencyFullNameAr, tafqeet } = useSystemCurrency();
  const [savedVouchers, setSavedVouchers] = useState<StoredInternalVoucher[]>(() => loadStoredInternalVouchers());
  const [showHistory, setShowHistory] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [voucherStatus, setVoucherStatus] = useState<'DRAFT' | 'POSTED'>('DRAFT');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'ALL' | 'POSTED' | 'DRAFT'>('ALL');
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [customPreviewData, setCustomPreviewData] = useState<PrintPreviewData | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showApprovalCenterModal, setShowApprovalCenterModal] = useState(false);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => getSystemSettings());

  useEffect(() => {
    const handleSettingsUpdate = () => {
      setSystemSettings(getSystemSettings());
    };
    window.addEventListener('alpha-system-settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('alpha-system-settings-updated', handleSettingsUpdate);
  }, []);

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

  const activeVoucher = useMemo(() => {
    if (editingVoucherId) return savedVouchers.find(v => v.id === editingVoucherId);
    return savedVouchers.find(v => v.voucherNumber === voucherNumber);
  }, [editingVoucherId, voucherNumber, savedVouchers]);

  const pendingApprovalsCount = useMemo(() => {
    return savedVouchers.filter(v => v.approvalStatus === 'PENDING_APPROVAL' && v.status !== 'POSTED').length;
  }, [savedVouchers]);

  const handleNewVoucher = () => {
    setEditingVoucherId(null);
    const nextSeq = getNextSequentialNumber('internalVoucher', savedVouchers.map(v => v.voucherNumber)).formatted;
    setVoucherNumber(nextSeq);
    setAmount('');
    setDescription('');
    setFromAccountId('');
    setToAccountId('');
    setVoucherStatus('DRAFT');
  };

  useEffect(() => {
    const handleSync = () => {
      const updated = loadStoredInternalVouchers();
      setSavedVouchers(updated);
      setEditingVoucherId(null);
      const nextSeq = getNextSequentialNumber('internalVoucher', updated.map(v => v.voucherNumber)).formatted;
      setVoucherNumber(nextSeq);
      setAmount('');
      setDescription('');
      setFromAccountId('');
      setToAccountId('');
      setVoucherStatus('DRAFT');
    };

    window.addEventListener('alpha-vouchers-updated', handleSync);
    window.addEventListener('alpha-system-reset-completed', handleSync);
    window.addEventListener('alpha-data-changed', handleSync);
    window.addEventListener('alpha-device-id-changed', handleSync);
    window.addEventListener('alpha-sequences-updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('alpha-vouchers-updated', handleSync);
      window.removeEventListener('alpha-system-reset-completed', handleSync);
      window.removeEventListener('alpha-data-changed', handleSync);
      window.removeEventListener('alpha-device-id-changed', handleSync);
      window.removeEventListener('alpha-sequences-updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const handleEdit = (v: StoredInternalVoucher) => {
    setEditingVoucherId(v.id);
    setVoucherNumber(v.voucherNumber);
    setDate(v.date);
    setFromAccountId(v.fromAccountId);
    setToAccountId(v.toAccountId);
    setAmount(v.amount.toString());
    setDescription(v.description);
    setVoucherStatus(v.status || 'DRAFT');
    setShowHistory(false);
  };

  // Chronologically sorted list of vouchers for sequential ERP browsing
  const chronologicallyOrderedVouchers = useMemo(() => {
    if (!Array.isArray(savedVouchers)) return [];
    return [...savedVouchers].sort((a, b) => {
      const dateCmp = (a.date || '').localeCompare(b.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.voucherNumber || '').localeCompare(b.voucherNumber || '', undefined, { numeric: true });
    });
  }, [savedVouchers]);

  const currentVoucherIndex = useMemo(() => {
    if (!editingVoucherId) return -1;
    return chronologicallyOrderedVouchers.findIndex(v => v.id === editingVoucherId);
  }, [editingVoucherId, chronologicallyOrderedVouchers]);

  const handleNavigatePrevious = () => {
    if (chronologicallyOrderedVouchers.length === 0) return;
    if (currentVoucherIndex === -1) {
      const target = chronologicallyOrderedVouchers[chronologicallyOrderedVouchers.length - 1];
      if (target) handleEdit(target);
    } else if (currentVoucherIndex > 0) {
      const target = chronologicallyOrderedVouchers[currentVoucherIndex - 1];
      if (target) handleEdit(target);
    }
  };

  const handleNavigateNext = () => {
    if (chronologicallyOrderedVouchers.length === 0) return;
    if (currentVoucherIndex >= 0 && currentVoucherIndex < chronologicallyOrderedVouchers.length - 1) {
      const target = chronologicallyOrderedVouchers[currentVoucherIndex + 1];
      if (target) handleEdit(target);
    } else if (currentVoucherIndex === chronologicallyOrderedVouchers.length - 1) {
      handleNewVoucher();
    }
  };

  const handleNavigateFirst = () => {
    if (chronologicallyOrderedVouchers.length > 0) {
      const first = chronologicallyOrderedVouchers[0];
      if (first) handleEdit(first);
    }
  };

  const handleNavigateLast = () => {
    if (chronologicallyOrderedVouchers.length > 0) {
      const last = chronologicallyOrderedVouchers[chronologicallyOrderedVouchers.length - 1];
      if (last) handleEdit(last);
    }
  };

  const canGoPrevious = chronologicallyOrderedVouchers.length > 0 && (currentVoucherIndex === -1 || currentVoucherIndex > 0);
  const canGoNext = chronologicallyOrderedVouchers.length > 0 && currentVoucherIndex !== -1;
  const canGoFirst = chronologicallyOrderedVouchers.length > 0 && currentVoucherIndex !== 0;
  const canGoLast = chronologicallyOrderedVouchers.length > 0 && (currentVoucherIndex === -1 || currentVoucherIndex < chronologicallyOrderedVouchers.length - 1);

  const handleDelete = (id: string, vNum: string) => {
    const targetVoucher = savedVouchers.find(v => v.id === id);
    if (targetVoucher && targetVoucher.status === 'POSTED') {
      alert(`⚠️ لا يمكن حذف سند التحويل الداخلي رقم (${vNum}) لأنه مرحل ومعتمد بالحسابات!\n\nيجب أولاً الضغط على زر [إلغاء الترحيل] لتحويل السند إلى مسودة، ثم يمكنك حذفه.`);
      return;
    }

    if (confirm(`هل أنت متأكد من رغبتك في حذف سند التحويل الداخلي رقم (${vNum}) نهائياً؟`)) {
      const updated = savedVouchers.filter(v => v.id !== id);
      setSavedVouchers(updated);
      try {
        localStorage.setItem(DB_INTERNAL_VOUCHERS_KEY, JSON.stringify(updated));
        window.dispatchEvent(new Event('alpha-chart-of-accounts-updated'));
        window.dispatchEvent(new Event('alpha-journal-entries-updated'));
        window.dispatchEvent(new Event('alpha-vouchers-updated'));
        window.dispatchEvent(new Event('alpha-trial-balance-updated'));
        window.dispatchEvent(new Event('storage'));
      } catch (err) {
        console.error(err);
      }
      if (editingVoucherId === id) {
        handleNewVoucher();
      }
    }
  };

  const saveVoucherWithStatus = (targetStatus: 'POSTED' | 'DRAFT'): boolean => {
    if (!fromAccountId || !toAccountId) {
      alert("يرجى تحديد حساب المصدر وحساب المستلم!");
      return false;
    }
    if (fromAccountId === toAccountId) {
      alert("لا يمكن التحويل لنفس الحساب!");
      return false;
    }
    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      alert("يرجى إدخال مبلغ تحويل صحيح أكبر من الصفر!");
      return false;
    }

    const finalNumber = voucherNumber.trim() || nextCalculatedVoucherNum;
    let isPost = targetStatus === 'POSTED';
    const prevVoucher = editingVoucherId ? savedVouchers.find(v => v.id === editingVoucherId) : undefined;
    const nowIso = new Date().toISOString();

    // Verification against Approval Workflow (دورة الاعتماد الهرمية)
    const approvalCheck = isApprovalRequired(numAmount, systemSettings);
    let finalRequiresApproval = approvalCheck.required;
    let finalApprovalStatus: 'NOT_REQUIRED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' = 
      prevVoucher?.approvalStatus || (approvalCheck.required ? 'PENDING_APPROVAL' : 'NOT_REQUIRED');

    if (!approvalCheck.required) {
      finalRequiresApproval = false;
      finalApprovalStatus = 'NOT_REQUIRED';
    } else if (prevVoucher && prevVoucher.approvalStatus === 'APPROVED' && prevVoucher.amount === numAmount) {
      finalApprovalStatus = 'APPROVED';
    } else if (!prevVoucher?.approvalStatus || prevVoucher.approvalStatus === 'NOT_REQUIRED') {
      finalApprovalStatus = 'PENDING_APPROVAL';
    }

    if (isPost) {
      const postValidation = canVoucherBePosted({
        id: editingVoucherId || 'new',
        type: 'INTERNAL_TRANSFER',
        amount: numAmount,
        approvalStatus: finalApprovalStatus,
        status: 'DRAFT',
        requiresApproval: finalRequiresApproval
      }, systemSettings);

      if (!postValidation.canPost) {
        alert(`⚠️ تنبيه دورة الاعتماد الهرمية:\n\n${postValidation.reason}\n\nتم حفظ سند التحويل كمسودة بانتظار اعتماد الإدارة المالية ولن يتم ترحيله حتى يُعتمد رسمياً.`);
        targetStatus = 'DRAFT';
        isPost = false;
      }
    }

    const voucherData: StoredInternalVoucher = {
      id: editingVoucherId || Date.now().toString(),
      voucherNumber: finalNumber,
      date,
      fromAccountId,
      toAccountId,
      amount: numAmount,
      status: targetStatus,
      postedAt: isPost ? (prevVoucher?.postedAt || nowIso) : undefined,
      description: description.trim() || 'سند تحويل ومناقلة داخلية',
      createdAt: prevVoucher?.createdAt || nowIso,
      requiresApproval: finalRequiresApproval,
      approvalStatus: finalApprovalStatus,
      approvedBy: finalApprovalStatus === 'APPROVED' ? prevVoucher?.approvedBy : undefined,
      approvedAt: finalApprovalStatus === 'APPROVED' ? prevVoucher?.approvedAt : undefined,
      approvalRole: finalApprovalStatus === 'APPROVED' ? prevVoucher?.approvalRole : undefined,
      approvalNotes: finalApprovalStatus === 'APPROVED' ? prevVoucher?.approvalNotes : undefined,
      rejectedBy: finalApprovalStatus === 'REJECTED' ? prevVoucher?.rejectedBy : undefined,
      rejectedAt: finalApprovalStatus === 'REJECTED' ? prevVoucher?.rejectedAt : undefined,
      rejectionReason: finalApprovalStatus === 'REJECTED' ? prevVoucher?.rejectionReason : undefined,
      preparedBy: prevVoucher?.preparedBy || 'المحاسب'
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
      window.dispatchEvent(new Event('alpha-chart-of-accounts-updated'));
      window.dispatchEvent(new Event('alpha-journal-entries-updated'));
      window.dispatchEvent(new Event('alpha-vouchers-updated'));
      window.dispatchEvent(new Event('alpha-trial-balance-updated'));
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error(err);
    }

    setEditingVoucherId(voucherData.id);
    setVoucherStatus(targetStatus);

    const fromAccName = getAccountName(fromAccountId);
    const toAccName = getAccountName(toAccountId);

    if (isPost) {
      alert(`✅ تم ترحيل سند التحويل الداخلي رقم (${finalNumber}) بنجاح في الحسابات!\n\nتم قيد وتأثير المبلغ (${numAmount.toLocaleString()} ${currencySymbol}) في حركة الحسابات من (${fromAccName}) إلى (${toAccName}) وميزان المراجعة.`);
    } else {
      alert(`📝 تم حفظ سند التحويل الداخلي رقم (${finalNumber}) كمسودة (غير مرحل) بنجاح!\n\nلم يتم إثبات أي أثر في الحسابات حتى تضغط على زر [ترحيل السند في الحسابات].`);
    }

    return true;
  };

  const handlePostCurrentVoucher = () => {
    saveVoucherWithStatus('POSTED');
  };

  const handleUnpostCurrentVoucher = () => {
    const finalNumber = voucherNumber.trim() || nextCalculatedVoucherNum;
    if (confirm(`هل أنت متأكد من رغبتك في إلغاء ترحيل سند التحويل الداخلي رقم (${finalNumber})؟\n\nسيتم إعادته كمسودة مؤقتة وإيقاف أثره المحاسبي في الحسابات العامة وميزان المراجعة.`)) {
      saveVoucherWithStatus('DRAFT');
    }
  };

  const handleTogglePostingFromList = (v: StoredInternalVoucher) => {
    const isCurrentlyPosted = v.status === 'POSTED';
    const newStatus: 'DRAFT' | 'POSTED' = isCurrentlyPosted ? 'DRAFT' : 'POSTED';
    if (isCurrentlyPosted && !confirm(`هل أنت متأكد من إلغاء ترحيل سند التحويل الداخلي رقم (${v.voucherNumber})؟`)) {
      return;
    }

    if (!isCurrentlyPosted) {
      const postValidation = canVoucherBePosted({
        id: v.id,
        type: 'INTERNAL_TRANSFER',
        amount: v.amount,
        approvalStatus: v.approvalStatus,
        status: 'DRAFT',
        requiresApproval: v.requiresApproval
      }, systemSettings);

      if (!postValidation.canPost) {
        alert(`⚠️ لا يمكن ترحيل سند التحويل الداخلي رقم (${v.voucherNumber}):\n\n${postValidation.reason}`);
        return;
      }
    }

    const updated = savedVouchers.map(item => {
      if (item.id === v.id) {
        return {
          ...item,
          status: newStatus,
          postedAt: newStatus === 'POSTED' ? new Date().toISOString() : undefined
        };
      }
      return item;
    });
    setSavedVouchers(updated);
    try {
      localStorage.setItem(DB_INTERNAL_VOUCHERS_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event('alpha-chart-of-accounts-updated'));
      window.dispatchEvent(new Event('alpha-journal-entries-updated'));
      window.dispatchEvent(new Event('alpha-vouchers-updated'));
      window.dispatchEvent(new Event('alpha-trial-balance-updated'));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error(e);
    }
    if (editingVoucherId === v.id) {
      setVoucherStatus(newStatus);
    }
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    saveVoucherWithStatus(voucherStatus || 'DRAFT');
  };

  const getAccountName = (id: string) => ACCOUNTS.find(a => a.id === id)?.name || id;

  return (
    <div className="flex flex-col flex-1">
      {/* Top Application Bar */}
      <div className="flex flex-col gap-3 mb-4 print:hidden">
        {/* Breadcrumb & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2 mb-1 text-slate-500 text-xs font-bold">
              <span>الخزينة والبنوك</span>
              <span>/</span>
              <span className="text-slate-800 font-extrabold">سندات داخلية</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800">سند تحويل داخلي</h2>
              <span className="text-xs sm:text-sm font-black text-blue-950 bg-blue-50 px-2.5 py-1 rounded-lg font-mono border border-blue-200 shadow-2xs">
                سند رقم: #{voucherNumber}
              </span>
              {editingVoucherId && (
                <span className="text-xs bg-amber-50 text-amber-950 px-2.5 py-1 rounded-lg font-black border border-amber-300 flex items-center gap-1 shadow-2xs">
                  <Edit3 size={12} className="text-amber-700" /> وضع التعديل
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Global 3D Responsive Internal Voucher Actions Toolbar */}
        <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-2 sm:p-2.5 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
          {/* Cluster 1: Sequential Navigation & History */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* 3D Navigation Bar */}
            <div className="nav-3d-segment">
              <button
                type="button"
                onClick={handleNavigateFirst}
                disabled={!canGoFirst}
                className="p-1.5 text-slate-600 hover:text-blue-900 hover:bg-slate-200/60 disabled:opacity-30 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                title="السند الأول (الأقدم)"
              >
                <ChevronsRight size={15} />
              </button>
              <button
                type="button"
                onClick={handleNavigatePrevious}
                disabled={!canGoPrevious}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-black text-slate-800 bg-white hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-200 shadow-2xs"
                title="تراجع للخلف - السند السابق"
              >
                <ChevronRight size={14} className="text-slate-700" />
                <span className="hidden sm:inline">تراجع للخلف</span>
                <span className="sm:hidden">السابق</span>
              </button>

              <div className="px-2 sm:px-2.5 py-1 text-[11px] font-mono font-black text-slate-800 bg-slate-100 rounded-lg mx-0.5 select-none border border-slate-200 whitespace-nowrap">
                {currentVoucherIndex >= 0 ? (
                  <span>{currentVoucherIndex + 1} / {chronologicallyOrderedVouchers.length}</span>
                ) : (
                  <span className="text-blue-700 font-sans font-bold">سند جديد +</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleNavigateNext}
                disabled={!canGoNext}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-black text-slate-800 bg-white hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-200 shadow-2xs"
                title="تقديم للأمام - السند التالي"
              >
                <span className="hidden sm:inline">تقديم للأمام</span>
                <span className="sm:hidden">التالي</span>
                <ChevronLeft size={14} className="text-slate-700" />
              </button>
              <button
                type="button"
                onClick={handleNavigateLast}
                disabled={!canGoLast}
                className="p-1.5 text-slate-600 hover:text-blue-900 hover:bg-slate-200/60 disabled:opacity-30 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                title="السند الأخير (الأحدث)"
              >
                <ChevronsLeft size={15} />
              </button>
            </div>

            {/* 3D History Button */}
            <button 
              type="button" 
              onClick={() => setShowHistory(!showHistory)} 
              className={`btn-3d h-9 sm:h-10 px-2.5 sm:px-3 text-xs font-black ${
                showHistory ? 'btn-3d-active' : 'btn-3d-white'
              }`}
            >
              <History size={14} className={showHistory ? 'text-indigo-200' : 'text-indigo-600'} />
              <span>سجل السندات ({savedVouchers.length})</span>
            </button>

            {editingVoucherId && (
              <button
                type="button"
                onClick={handleNewVoucher}
                className="btn-3d btn-3d-white h-9 sm:h-10 px-2.5 sm:px-3 text-xs font-black text-slate-700 hover:text-slate-900"
              >
                <X size={14} /> <span>إلغاء التعديل</span>
              </button>
            )}
          </div>

          {/* Cluster 2: New, Print & Preview Controls */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* 3D New Voucher Button */}
            <button 
              type="button" 
              onClick={handleNewVoucher} 
              className="btn-3d btn-3d-blue h-9 sm:h-10 px-2.5 sm:px-3.5 text-xs font-black"
            >
              <Plus size={15} />
              <span>سند جديد #{nextCalculatedVoucherNum}</span>
            </button>

            {/* Print & Preview Group */}
            <div className="flex items-center gap-1.5 border-r border-slate-300/80 pr-2 mr-0.5">
              <button
                type="button"
                onClick={() => {
                  setCustomPreviewData(null);
                  setShowPrintPreview(true);
                }}
                className="btn-3d btn-3d-slate h-9 sm:h-10 px-2.5 sm:px-3 text-xs font-black"
                title="معاينة سند التحويل الداخلي قبل الطباعة"
              >
                <Eye size={14} />
                <span className="hidden sm:inline">معاينة قبل الطباعة</span>
                <span className="sm:hidden">معاينة</span>
              </button>
              <PrintDropdown 
                onPreview={() => {
                  setCustomPreviewData(null);
                  setShowPrintPreview(true);
                }}
              />
            </div>

            {/* 3D Export Vouchers Button */}
            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="btn-3d btn-3d-emerald h-9 sm:h-10 px-2.5 sm:px-3 text-xs font-black flex items-center gap-1.5 shadow-sm"
              title="تصدير كشوفات السندات والعمليات إلى Excel (.xlsx) و CSV و PDF"
            >
              <FileSpreadsheet size={15} className="text-emerald-200" />
              <span className="hidden sm:inline">تصدير الكشوفات (Excel/PDF)</span>
              <span className="sm:hidden">تصدير</span>
            </button>

            {/* Approval Center Button */}
            {systemSettings?.approvalWorkflow?.enabled && (
              <button
                type="button"
                onClick={() => setShowApprovalCenterModal(true)}
                className="btn-3d btn-3d-amber h-9 sm:h-10 px-2.5 sm:px-3 text-xs font-black flex items-center gap-1.5 shadow-sm relative"
                title="مركز اعتمادات وموافقات الإدارة المالية"
              >
                <UserCheck size={15} className="text-amber-200" />
                <span className="hidden sm:inline">مركز الاعتماد</span>
                {pendingApprovalsCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-red-600 text-white rounded-full text-[10px] font-mono font-bold animate-bounce">
                    {pendingApprovalsCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible History Drawer */}
      {showHistory && (
        <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm animate-in fade-in duration-150 print:hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <History size={16} className="text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-sm">سجل سندات التحويل الداخلي المسجلة بقاعدة البيانات</h3>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">{savedVouchers.length} سندات</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Filter Tabs */}
              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    historyStatusFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  الكل ({savedVouchers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter('POSTED')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                    historyStatusFilter === 'POSTED'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-emerald-700 hover:text-emerald-900'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  مرحلة ({savedVouchers.filter(v => v.status === 'POSTED').length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter('DRAFT')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                    historyStatusFilter === 'DRAFT'
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'text-amber-700 hover:text-amber-900'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  مسودات ({savedVouchers.filter(v => v.status !== 'POSTED').length})
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowExportModal(true)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1 transition-colors cursor-pointer"
                  title="تصدير كشف سندات التحويل الداخلي إلى Excel (.xlsx) أو CSV أو PDF"
                >
                  <FileSpreadsheet size={13} className="text-emerald-600" />
                  <span>تصدير كشف السندات</span>
                </button>

                <button 
                  type="button" 
                  onClick={() => setShowHistory(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer px-2 py-1"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>

          {(() => {
            const filteredList = savedVouchers.filter(v => {
              if (historyStatusFilter === 'POSTED') return v.status === 'POSTED';
              if (historyStatusFilter === 'DRAFT') return v.status !== 'POSTED';
              return true;
            });

            if (filteredList.length === 0) {
              return (
                <p className="text-xs text-slate-400 text-center py-6">
                  {savedVouchers.length === 0 
                    ? `لا توجد سندات داخلية محفوظة بعد. السند القادم سيبدأ برقم #${nextCalculatedVoucherNum}.`
                    : 'لا توجد سندات تطابق الفلتر المحدد حالياً.'}
                </p>
              );
            }

            return (
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400">
                      <th className="pb-2 font-semibold">رقم السند</th>
                      <th className="pb-2 font-semibold text-center">الحالة</th>
                      <th className="pb-2 font-semibold">من حساب</th>
                      <th className="pb-2 font-semibold">إلى حساب</th>
                      <th className="pb-2 font-semibold">المبلغ</th>
                      <th className="pb-2 font-semibold">التاريخ</th>
                      <th className="pb-2 font-semibold">البيان</th>
                      <th className="pb-2 font-semibold text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredList.map(v => {
                      const isPosted = v.status === 'POSTED';
                      return (
                        <tr key={v.id} className={`hover:bg-slate-50 transition-colors ${editingVoucherId === v.id ? 'bg-blue-50/60' : ''}`}>
                          <td className="py-2.5 font-mono font-bold text-blue-600">#{v.voucherNumber}</td>
                          <td className="py-2.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                              isPosted 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                                : 'bg-amber-50 text-amber-700 border-amber-300'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isPosted ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                              {isPosted ? 'مرحل' : 'مسودة'}
                            </span>

                            {systemSettings?.approvalWorkflow?.enabled && (
                              <div className="mt-1">
                                {v.approvalStatus === 'APPROVED' ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span>معتمد ({v.approvalRole || 'الإدارة'})</span>
                                  </span>
                                ) : v.approvalStatus === 'REJECTED' ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    <span>مرفوض</span>
                                  </span>
                                ) : v.approvalStatus === 'PENDING_APPROVAL' ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                                    <span>بانتظار الاعتماد</span>
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-slate-400">لا يتطلب</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 text-slate-700 font-medium">{getAccountName(v.fromAccountId)}</td>
                          <td className="py-2.5 text-slate-700 font-medium">{getAccountName(v.toAccountId)}</td>
                          <td className="py-2.5 font-mono font-bold text-slate-800">{v.amount.toLocaleString()} {currencySymbol}</td>
                          <td className="py-2.5 text-slate-500">{v.date}</td>
                          <td className="py-2.5 text-slate-500 truncate max-w-xs">{v.description}</td>
                          <td className="py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Post/Unpost toggle button */}
                              <button
                                type="button"
                                onClick={() => handleTogglePostingFromList(v)}
                                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
                                  isPosted
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-300'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300'
                                }`}
                                title={isPosted ? 'إلغاء الترحيل وإعادته لمسودة' : 'ترحيل السند في الحسابات العامة وميزان المراجعة'}
                              >
                                {isPosted ? (
                                  <>
                                    <RotateCcw size={11} />
                                    <span>إلغاء</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 size={11} />
                                    <span>ترحيل</span>
                                  </>
                                )}
                              </button>

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
                                disabled={v.status === 'POSTED'}
                                onClick={() => handleDelete(v.id, v.voucherNumber)}
                                className={`flex items-center gap-0.5 px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                                  v.status === 'POSTED'
                                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50'
                                    : 'bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer'
                                }`}
                                title={v.status === 'POSTED' ? 'السند مرحل بالحسابات. يجب إلغاء الترحيل أولاً لحذفه' : 'حذف السند'}
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
            );
          })()}
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

      {/* Prominent Posting Status Banner */}
      <div className={`p-4 rounded-2xl border mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs print:hidden ${
        voucherStatus === 'POSTED' 
          ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950' 
          : 'bg-amber-50/90 border-amber-300 text-amber-950'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            voucherStatus === 'POSTED' 
              ? 'bg-emerald-100 text-emerald-700 border-emerald-300' 
              : 'bg-amber-100 text-amber-700 border-amber-300'
          }`}>
            {voucherStatus === 'POSTED' ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm">
                {voucherStatus === 'POSTED' ? 'سند تحويل مرحّل في الحسابات العامة' : 'سند تحويل مؤقت - مسودة (غير مرحل)'}
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                voucherStatus === 'POSTED'
                  ? 'bg-emerald-200 text-emerald-900 border-emerald-300'
                  : 'bg-amber-200 text-amber-900 border-amber-300'
              }`}>
                {voucherStatus === 'POSTED' ? 'مرحل ومقيد' : 'مسودة غير مرحلة'}
              </span>
            </div>
            <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
              {voucherStatus === 'POSTED' 
                ? 'تم إثبات أثر المناقلة في دفاتر الحسابات وميزان المراجعة. لإلغاء القيد اضغط على زر [إلغاء الترحيل].' 
                : 'تم إيقاف الترحيل التلقائي - هذا السند لا يؤثر على أرصدة الصناديق أو البنوك أو ميزان المراجعة حتى تضغط على زر [ترحيل السند في الحسابات].'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {voucherStatus === 'POSTED' ? (
            <button
              type="button"
              onClick={handleUnpostCurrentVoucher}
              className="px-4 py-2 bg-white hover:bg-amber-50 text-amber-800 border-2 border-amber-300 rounded-xl text-xs font-black transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <RotateCcw size={14} />
              <span>إلغاء الترحيل</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePostCurrentVoucher}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-700/20"
            >
              <CheckCircle2 size={14} />
              <span>ترحيل السند في الحسابات الآن</span>
            </button>
          )}
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
                    {amount && Number(amount) > 0 ? tafqeet(Number(amount)) : `صفر ${currencyFullNameAr} فقط لا غير`}
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

          {/* Approval Hierarchy Stepper */}
          {systemSettings?.approvalWorkflow?.enabled && (
            <div className="p-4 bg-slate-50 border-t border-slate-200">
              <VoucherApprovalStepper
                voucher={activeVoucher}
                voucherId={editingVoucherId}
                voucherNumber={voucherNumber || nextCalculatedVoucherNum}
                voucherType="INTERNAL_TRANSFER"
                amount={Number(amount) || 0}
                date={date}
                isPosted={voucherStatus === 'POSTED'}
                postedAt={activeVoucher?.postedAt}
                approvalStatus={activeVoucher?.approvalStatus}
                approvedBy={activeVoucher?.approvedBy}
                approvedAt={activeVoucher?.approvedAt}
                approvalRole={activeVoucher?.approvalRole}
                approvalNotes={activeVoucher?.approvalNotes}
                rejectedBy={activeVoucher?.rejectedBy}
                rejectedAt={activeVoucher?.rejectedAt}
                rejectionReason={activeVoucher?.rejectionReason}
                preparedBy={activeVoucher?.preparedBy}
                systemSettings={systemSettings}
                onApprovalChanged={() => {
                  const fresh = loadStoredInternalVouchers();
                  setSavedVouchers(fresh);
                }}
                onOpenApprovalCenter={() => setShowApprovalCenterModal(true)}
                onPost={handlePostCurrentVoucher}
                onUnpost={handleUnpostCurrentVoucher}
              />
            </div>
          )}

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
                type="button"
                onClick={() => saveVoucherWithStatus('DRAFT')}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs border border-slate-700 transition-colors cursor-pointer"
              >
                <Save size={15} />
                <span>حفظ كمسودة (غير مرحل)</span>
              </button>

              {voucherStatus === 'POSTED' ? (
                <button
                  type="button"
                  onClick={handleUnpostCurrentVoucher}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl font-bold text-xs border border-amber-500/40 transition-colors cursor-pointer"
                >
                  <RotateCcw size={15} />
                  <span>إلغاء الترحيل</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePostCurrentVoucher}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-xl shadow-lg shadow-emerald-950/40 text-sm font-black transition-all cursor-pointer border border-emerald-400/30"
                >
                  <CheckCircle2 size={16} />
                  <span>ترحيل السند في الحسابات</span>
                </button>
              )}
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

      {/* Export Modal */}
      <VouchersExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        initialCategory="INTERNAL"
        initialType="INTERNAL_TRANSFER"
        title="تصدير كشوفات سندات التحويل الداخلي بين الخزائن والبنوك (Excel / CSV / PDF)"
      />

      {/* Vouchers Approval Center Modal */}
      <VouchersApprovalCenterModal
        isOpen={showApprovalCenterModal}
        onClose={() => setShowApprovalCenterModal(false)}
        systemSettings={systemSettings}
        onSelectVoucher={(voucher) => {
          setShowApprovalCenterModal(false);
          const found = savedVouchers.find(v => v.id === voucher.id || v.voucherNumber === voucher.voucherNumber);
          if (found) {
            handleEdit(found);
          }
        }}
      />
    </div>
  );
}
