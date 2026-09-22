import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { 
  Save, ArrowUpRight, Plus, History, AlertTriangle, Edit3, Trash2, X, Eye,
  Wallet, Sparkles, UserCheck, CheckCircle2, RotateCcw, Send,
  ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft,
  Banknote, Landmark, CreditCard, Calendar, FileText,
  Building2, Scan, FileSpreadsheet
} from 'lucide-react';
import { Account, SystemSettings } from '../types/accounting';
import { loadChartOfAccounts } from '../utils/trialBalanceStore';
import { 
  type CostCenter, 
  loadCostCenters, 
  getCostCenterTypeLabel 
} from '../utils/costCenterStore';
import PrintDropdown from './PrintDropdown';
import PrintPreviewModal, { PrintPreviewData } from './PrintPreviewModal';
import { useSystemCurrency } from '../utils/currency';
import { BarcodeImage, VoucherQrCodeImage } from './VoucherBarcodeView';
import VoucherScannerModal from './VoucherScannerModal';
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
  DB_INTERNAL_PAYMENT_VOUCHERS_KEY 
} from '../utils/sequences';

export interface StoredInternalPaymentVoucher {
  id: string;
  voucherNumber: string;
  date: string;
  fromAccountId: string;               // الحساب المصروف منه (الخزينة/البنك)
  toAccountId?: string | undefined;     // الحساب المستفيد الداخلي (إن وجد)
  expenseType: string;                  // نوع الصرف الداخلي (صرف عهدة، سلفة، مصاريف نثرية، تغذية فرع)
  paidTo: string;                       // المستفيد / المستلم الداخلي
  disbursedBy: string;                  // الصارف / أمين الصندوق
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'SPAN' | 'OTHER';
  referenceNo?: string | undefined;     // رقم الشيك أو التحويل
  bankName?: string | undefined;        // اسم البنك
  checkDueDate?: string | undefined;    // تاريخ استحقاق وصرف الشيك
  costCenterId?: string | undefined;    // مركز التكلفة المرتبط (فرع / مشروع / أسطول)
  costCenterName?: string | undefined;  // اسم مركز التكلفة
  amount: number;
  status?: 'DRAFT' | 'POSTED' | undefined;          // حالة الترحيل المحاسبي
  postedAt?: string | undefined;                    // تاريخ ووقت الترحيل
  description: string;
  createdAt: string;
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

const INTERNAL_ACCOUNTS = [
  { id: 'cash1', name: 'الخزينة الرئيسية (الصندوق العام)' },
  { id: 'cash2', name: 'صندوق المعرض / المبيعات اليومية' },
  { id: 'cash3', name: 'صندوق العهد والمصروفات النثرية' },
  { id: 'bank1', name: 'البنك الأهلي التجاري' },
  { id: 'bank2', name: 'مصرف الراجحي' },
  { id: 'bank3', name: 'بنك الرياض' },
];

const PAYMENT_EXPENSE_TYPES = [
  { id: 'custody_issue', label: 'صرف عهدة مالية لموظف' },
  { id: 'advance_salary', label: 'صرف سلفة موظف على الراتب' },
  { id: 'petty_cash', label: 'مصاريف إدارية ونثرية وتشغيلية' },
  { id: 'branch_feed', label: 'تغذية صندوق فرع / معرض' },
  { id: 'cash_to_bank', label: 'إيداع نقدية بالبنك من الخزينة' },
  { id: 'internal_expense', label: 'مصاريف داخلية وصيانة ونظافة' },
  { id: 'other', label: 'صرف داخلي آخر' },
];

function loadStoredInternalPayments(): StoredInternalPaymentVoucher[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DB_INTERNAL_PAYMENT_VOUCHERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load internal payment vouchers:', e);
  }
  return [];
}

export default function InternalPaymentVoucher() {
  const { symbol: currencySymbol, fullNameAr: currencyFullNameAr, tafqeet } = useSystemCurrency();
  const [savedVouchers, setSavedVouchers] = useState<StoredInternalPaymentVoucher[]>(() => loadStoredInternalPayments());
  const [showHistory, setShowHistory] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [customPreviewData, setCustomPreviewData] = useState<PrintPreviewData | null>(null);
  const [showScannerModal, setShowScannerModal] = useState(false);
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

  // List of employees from payroll
  const [employees, setEmployees] = useState<{ id: string; name: string; jobTitle?: string }[]>([]);

  useEffect(() => {
    const handleSync = () => {
      try {
        const raw = localStorage.getItem('alpha_payroll_employees_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setEmployees(parsed.map(e => ({ id: e.id, name: e.name, jobTitle: e.jobTitle })));
          } else {
            setEmployees([]);
          }
        } else {
          setEmployees([]);
        }

        const freshVouchers = loadStoredInternalPayments();
        setSavedVouchers(freshVouchers);
        setEditingVoucherId(null);
        setVoucherStatus('DRAFT');
        const nextSeq = getNextSequentialNumber('internalPaymentVoucher', freshVouchers.map(v => v.voucherNumber)).formatted;
        setVoucherNumber(nextSeq);
        setAmount('');
        setDescription('');
        setPaidTo('');
        setReferenceNo('');
      } catch (e) {
        console.error(e);
      }
    };

    handleSync();

    window.addEventListener('alpha-vouchers-updated', handleSync);
    window.addEventListener('alpha-payroll-updated', handleSync);
    window.addEventListener('alpha-system-reset-completed', handleSync);
    window.addEventListener('alpha-data-changed', handleSync);
    window.addEventListener('alpha-device-id-changed', handleSync);
    window.addEventListener('alpha-sequences-updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('alpha-vouchers-updated', handleSync);
      window.removeEventListener('alpha-payroll-updated', handleSync);
      window.removeEventListener('alpha-system-reset-completed', handleSync);
      window.removeEventListener('alpha-data-changed', handleSync);
      window.removeEventListener('alpha-device-id-changed', handleSync);
      window.removeEventListener('alpha-sequences-updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Next calculated sequential voucher number
  const nextCalculatedVoucherNum = useMemo(() => {
    return getNextSequentialNumber('internalPaymentVoucher', savedVouchers.map(v => v.voucherNumber)).formatted;
  }, [savedVouchers]);

  const [voucherNumber, setVoucherNumber] = useState<string>(() => nextCalculatedVoucherNum);
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0] as string);
  const [fromAccountId, setFromAccountId] = useState<string>('cash1');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [expenseType, setExpenseType] = useState<string>('custody_issue');
  const [paidTo, setPaidTo] = useState<string>('');
  const [disbursedBy, setDisbursedBy] = useState<string>('أمين الخزينة الرئيسي');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'SPAN' | 'OTHER'>('CASH');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [checkDueDate, setCheckDueDate] = useState<string>('');
  const [chartAccounts, setChartAccounts] = useState<Account[]>(() => loadChartOfAccounts());
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [voucherStatus, setVoucherStatus] = useState<'DRAFT' | 'POSTED'>('DRAFT');

  // Cost Centers
  const [costCenters, setCostCenters] = useState<CostCenter[]>(() => loadCostCenters());
  const [costCenterId, setCostCenterId] = useState<string>('');

  useEffect(() => {
    const handleCostCentersUpdate = () => setCostCenters(loadCostCenters());
    window.addEventListener('alpha-cost-centers-updated', handleCostCentersUpdate);
    return () => window.removeEventListener('alpha-cost-centers-updated', handleCostCentersUpdate);
  }, []);

  const selectedCostCenter = useMemo(() => {
    if (!costCenterId) return null;
    return costCenters.find(c => c.id === costCenterId || c.code === costCenterId) || null;
  }, [costCenters, costCenterId]);

  // Sync with Chart of Accounts
  useEffect(() => {
    const handleAccountsUpdate = () => setChartAccounts(loadChartOfAccounts());
    window.addEventListener('alpha-chart-of-accounts-updated', handleAccountsUpdate);
    return () => window.removeEventListener('alpha-chart-of-accounts-updated', handleAccountsUpdate);
  }, []);

  // Compute dynamic internal cash & bank accounts
  const internalAccountsList = useMemo(() => {
    const dynamicAccounts = chartAccounts.filter(a => {
      const code = a.code || '';
      const name = (a.name || '').toLowerCase();
      return (
        code.startsWith('110') ||
        code === '1101' ||
        code === '1102' ||
        code === '1103' ||
        name.includes('خزينة') ||
        name.includes('صندوق') ||
        name.includes('بنك') ||
        name.includes('نقدية')
      );
    }).map(a => ({
      id: a.id,
      name: `[${a.code}] ${a.name}`
    }));

    if (dynamicAccounts.length > 0) {
      const combined = [...dynamicAccounts];
      INTERNAL_ACCOUNTS.forEach(legacy => {
        if (!combined.some(c => c.id === legacy.id)) {
          combined.push(legacy);
        }
      });
      return combined;
    }
    return INTERNAL_ACCOUNTS;
  }, [chartAccounts]);

  const getAccountName = (id: string) => {
    const chartAcc = chartAccounts.find(a => a.id === id || a.code === id);
    if (chartAcc) return `[${chartAcc.code}] ${chartAcc.name}`;
    return INTERNAL_ACCOUNTS.find(a => a.id === id)?.name || id;
  };

  // Existing voucher matching current number
  const existingVoucherByNumber = useMemo(() => {
    if (!voucherNumber) return null;
    return savedVouchers.find(v => v.voucherNumber.trim() === voucherNumber.trim()) || null;
  }, [voucherNumber, savedVouchers]);

  // Posting status of current voucher
  const isCurrentVoucherPosted = Boolean(
    (editingVoucherId && voucherStatus === 'POSTED') ||
    (!editingVoucherId && existingVoucherByNumber && existingVoucherByNumber.status === 'POSTED')
  );

  const isCurrentVoucherDraft = !isCurrentVoucherPosted;

  const activeVoucher = useMemo(() => {
    if (editingVoucherId) return savedVouchers.find(v => v.id === editingVoucherId);
    if (existingVoucherByNumber) return existingVoucherByNumber;
    return undefined;
  }, [editingVoucherId, existingVoucherByNumber, savedVouchers]);

  const pendingApprovalsCount = useMemo(() => {
    return savedVouchers.filter(v => v.approvalStatus === 'PENDING_APPROVAL' && v.status !== 'POSTED').length;
  }, [savedVouchers]);

  // Duplicate check
  const isVoucherDuplicate = useMemo(() => {
    if (!voucherNumber) return false;
    const listToCheck = editingVoucherId 
      ? savedVouchers.filter(v => v.id !== editingVoucherId)
      : savedVouchers;
    return isCodeOrNumberDuplicated(voucherNumber, 'internalPaymentVoucher', listToCheck.map(v => v.voucherNumber));
  }, [voucherNumber, savedVouchers, editingVoucherId]);

  const handleNewVoucher = () => {
    setEditingVoucherId(null);
    setVoucherStatus('DRAFT');
    const nextSeq = getNextSequentialNumber('internalPaymentVoucher', savedVouchers.map(v => v.voucherNumber)).formatted;
    setVoucherNumber(nextSeq);
    setAmount('');
    setDescription('');
    setPaidTo('');
    setReferenceNo('');
    setBankName('');
    setCheckDueDate('');
    setPaymentMethod('CASH');
    setCostCenterId('');
  };

  const handleEdit = (v: StoredInternalPaymentVoucher) => {
    setEditingVoucherId(v.id);
    setVoucherStatus(v.status === 'POSTED' ? 'POSTED' : 'DRAFT');
    setVoucherNumber(v.voucherNumber);
    setDate(v.date);
    setFromAccountId(v.fromAccountId);
    setToAccountId(v.toAccountId || '');
    setExpenseType(v.expenseType);
    setPaidTo(v.paidTo);
    setDisbursedBy(v.disbursedBy);
    setPaymentMethod(v.paymentMethod || 'CASH');
    setReferenceNo(v.referenceNo || '');
    setBankName(v.bankName || '');
    setCheckDueDate(v.checkDueDate || '');
    setCostCenterId(v.costCenterId || '');
    setAmount(v.amount.toString());
    setDescription(v.description);
    setShowHistory(false);
  };

  // Chronologically sorted list of vouchers (oldest to newest) for sequential ERP browsing
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
      alert(`⚠️ لا يمكن حذف سند الصرف الداخلي رقم (${vNum}) لأنه مرحل ومعتمد بالحسابات!\n\nيجب أولاً الضغط على زر [إلغاء الترحيل] لتحويل السند إلى مسودة، ثم يمكنك حذفه.`);
      return;
    }

    if (confirm(`هل أنت متأكد من رغبتك في حذف سند الصرف الداخلي رقم (${vNum}) نهائياً؟`)) {
      const updated = savedVouchers.filter(v => v.id !== id);
      setSavedVouchers(updated);
      try {
        localStorage.setItem(DB_INTERNAL_PAYMENT_VOUCHERS_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      if (editingVoucherId === id) {
        handleNewVoucher();
      }
    }
  };

  const saveVoucherWithStatus = (targetStatus: 'DRAFT' | 'POSTED') => {
    if (!fromAccountId || !amount) {
      alert('يرجى تحديد حساب الصرف والمبلغ المالي أولاً!');
      return false;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('يرجى إدخال مبلغ مالي صحيح أكبر من صفر!');
      return false;
    }

    const finalNumber = voucherNumber.trim() || nextCalculatedVoucherNum;
    const fromAccName = INTERNAL_ACCOUNTS.find(a => a.id === fromAccountId)?.name || fromAccountId;
    const expenseLabel = PAYMENT_EXPENSE_TYPES.find(s => s.id === expenseType)?.label || expenseType;
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
        type: 'INTERNAL_PAYMENT',
        amount: numAmount,
        approvalStatus: finalApprovalStatus,
        status: 'DRAFT',
        requiresApproval: finalRequiresApproval
      }, systemSettings);

      if (!postValidation.canPost) {
        alert(`⚠️ تنبيه دورة الاعتماد الهرمية:\n\n${postValidation.reason}\n\nتم حفظ السند كمسودة بانتظار اعتماد الإدارة المالية ولن يتم ترحيله أو صرفه حتى يُعتمد رسمياً.`);
        targetStatus = 'DRAFT';
        isPost = false;
      }
    }

    const voucherData: StoredInternalPaymentVoucher = {
      id: editingVoucherId || Date.now().toString(),
      voucherNumber: finalNumber,
      date,
      fromAccountId,
      toAccountId: toAccountId || undefined,
      expenseType,
      paidTo: paidTo.trim() || 'جهة داخلية',
      disbursedBy: disbursedBy.trim() || 'أمين الصندوق',
      paymentMethod,
      referenceNo: referenceNo.trim() || undefined,
      bankName: bankName.trim() || undefined,
      checkDueDate: checkDueDate.trim() || undefined,
      costCenterId: costCenterId.trim() || undefined,
      costCenterName: selectedCostCenter ? selectedCostCenter.name : undefined,
      amount: numAmount,
      status: targetStatus,
      postedAt: isPost ? (prevVoucher?.postedAt || nowIso) : undefined,
      description: description.trim() || `صرف ونفقة داخلية [${expenseLabel}] من ${fromAccName}`,
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
      preparedBy: prevVoucher?.preparedBy || disbursedBy.trim() || 'المحاسب'
    };

    let updated: StoredInternalPaymentVoucher[];
    if (editingVoucherId) {
      updated = savedVouchers.map(v => v.id === editingVoucherId ? voucherData : v);
    } else {
      updated = [
        voucherData,
        ...savedVouchers.filter(v => v.voucherNumber.trim().toLowerCase() !== finalNumber.toLowerCase())
      ];
      advanceSequenceAfterSave('internalPaymentVoucher', finalNumber);
    }

    setSavedVouchers(updated);
    try {
      localStorage.setItem(DB_INTERNAL_PAYMENT_VOUCHERS_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event('alpha-chart-of-accounts-updated'));
      window.dispatchEvent(new Event('alpha-journal-entries-updated'));
      window.dispatchEvent(new Event('alpha-vouchers-updated'));
      window.dispatchEvent(new Event('alpha-trial-balance-updated'));
      window.dispatchEvent(new Event('alpha-cost-centers-updated'));
    } catch (err) {
      console.error(err);
    }

    setEditingVoucherId(voucherData.id);
    setVoucherStatus(targetStatus);

    if (isPost) {
      alert(`✅ تم ترحيل سند الصرف الداخلي رقم (${finalNumber}) بنجاح في الحسابات!\n\nتم خصم وقيد المبلغ (${numAmount.toLocaleString()} ${currencySymbol}) من حساب (${fromAccName}) ودفتر الأستاذ العام وميزان المراجعة.`);
    } else {
      alert(`📝 تم حفظ سند الصرف الداخلي رقم (${finalNumber}) كمسودة (غير مرحل) بنجاح!\n\nلم يتم إثبات أي أثر في دفتر الأستاذ حتى تضغط على زر [ترحيل السند في الحسابات].`);
    }

    return true;
  };

  const handlePostCurrentVoucher = () => {
    saveVoucherWithStatus('POSTED');
  };

  const handleUnpostCurrentVoucher = () => {
    const finalNumber = voucherNumber.trim() || nextCalculatedVoucherNum;
    if (confirm(`هل أنت متأكد من رغبتك في إلغاء ترحيل سند الصرف الداخلي رقم (${finalNumber})؟\n\nسيتم إعادته كمسودة مؤقتة وإيقاف أثره المحاسبي في الحسابات العامة ودفتر الأستاذ.`)) {
      saveVoucherWithStatus('DRAFT');
    }
  };

  const handleTogglePostingFromList = (v: StoredInternalPaymentVoucher) => {
    const isCurrentlyPosted = v.status === 'POSTED';
    const newStatus: 'DRAFT' | 'POSTED' = isCurrentlyPosted ? 'DRAFT' : 'POSTED';
    if (isCurrentlyPosted && !confirm(`هل أنت متأكد من إلغاء ترحيل سند الصرف الداخلي رقم (${v.voucherNumber})؟`)) {
      return;
    }

    if (!isCurrentlyPosted) {
      const postValidation = canVoucherBePosted({
        id: v.id,
        type: 'INTERNAL_PAYMENT',
        amount: v.amount,
        approvalStatus: v.approvalStatus,
        status: 'DRAFT',
        requiresApproval: v.requiresApproval
      }, systemSettings);

      if (!postValidation.canPost) {
        alert(`⚠️ لا يمكن ترحيل سند الصرف الداخلي رقم (${v.voucherNumber}):\n\n${postValidation.reason}`);
        return;
      }
    }

    const updated = savedVouchers.map(item => 
      item.id === v.id 
        ? { ...item, status: newStatus, postedAt: newStatus === 'POSTED' ? new Date().toISOString() : undefined } 
        : item
    );
    setSavedVouchers(updated);
    try {
      localStorage.setItem(DB_INTERNAL_PAYMENT_VOUCHERS_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event('alpha-chart-of-accounts-updated'));
      window.dispatchEvent(new Event('alpha-journal-entries-updated'));
      window.dispatchEvent(new Event('alpha-vouchers-updated'));
      window.dispatchEvent(new Event('alpha-trial-balance-updated'));
      window.dispatchEvent(new Event('alpha-cost-centers-updated'));
    } catch (e) {
      console.error(e);
    }
    if (editingVoucherId === v.id) {
      setVoucherStatus(newStatus);
    }
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    saveVoucherWithStatus(isCurrentVoucherPosted ? 'POSTED' : 'DRAFT');
  };

  const currentPreviewObject: PrintPreviewData = {
    title: 'سند صرف داخلي',
    docNumber: voucherNumber,
    date: date,
    partnerName: `المستفيد / المستلم: ${paidTo || 'جهة داخلية'} | الصارف: ${disbursedBy}`,
    paymentMethod: paymentMethod === 'BANK_TRANSFER'
      ? `تحويل بنكي ${bankName ? '(' + bankName + ')' : ''} ${referenceNo ? 'مرجع: ' + referenceNo : ''}`
      : paymentMethod === 'CHECK'
        ? `شيك مصرفي ${bankName ? '(' + bankName + ')' : ''} ${referenceNo ? 'رقم: ' + referenceNo : ''} ${checkDueDate ? 'تاريخ الاستحقاق: ' + checkDueDate : ''}`
        : paymentMethod === 'SPAN'
          ? `شبكة / مدى ${referenceNo ? 'عملية #' + referenceNo : ''}`
          : `${getAccountName(fromAccountId)} (نقداً)`,
    notes: description || `صرف ونفقة من حساب (${getAccountName(fromAccountId)})`,
    grandTotal: Number(amount) || 0,
    subtotal: Number(amount) || 0,
    amount: Number(amount) || 0,
    paidAmount: Number(amount) || 0,
    voucherType: 'PAYMENT',
    amountInWords: tafqeet(Number(amount) || 0),
    items: [{
      description: `صرف داخلي من حساب (${getAccountName(fromAccountId)}) - لصالح: ${paidTo || 'مصدر داخلي'} [${PAYMENT_EXPENSE_TYPES.find(s => s.id === expenseType)?.label || ''}]`,
      quantity: 1,
      unitPrice: Number(amount) || 0,
      taxRate: 0,
      total: Number(amount) || 0
    }]
  };

  return (
    <div className="flex flex-col flex-1">
      {/* Page Header */}
      {/* Top Application Bar */}
      <div className="flex flex-col gap-3 mb-4 print:hidden">
        {/* Breadcrumb & Screen Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2 mb-1 text-slate-500 text-xs font-bold">
              <span>الخزينة والبنوك</span>
              <span>/</span>
              <span className="text-rose-900 font-extrabold">سندات داخلية</span>
              <span>/</span>
              <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-bold border border-rose-200">
                صرف ودفع داخلي
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 flex items-center gap-2">
                <span className="p-1 bg-rose-100 text-rose-800 rounded-lg shadow-2xs">
                  <ArrowUpRight size={20} />
                </span>
                سند صرف داخلي
              </h2>
              <span className="text-xs sm:text-sm font-black text-rose-950 bg-rose-50 px-2.5 py-1 rounded-lg font-mono border border-rose-300 shadow-2xs">
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

        {/* Global 3D Responsive Voucher Actions Toolbar */}
        <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-2 sm:p-2.5 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
          {/* Cluster 1: Sequential Navigation & History */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* 3D Navigation Bar */}
            <div className="nav-3d-segment">
              <button
                type="button"
                onClick={handleNavigateFirst}
                disabled={!canGoFirst}
                className="p-1.5 text-slate-600 hover:text-rose-900 hover:bg-slate-200/60 disabled:opacity-30 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
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

              <div className="px-2 sm:px-2.5 py-1 text-[11px] font-mono font-black text-rose-950 bg-rose-50 rounded-lg mx-0.5 select-none border border-rose-200 whitespace-nowrap">
                {currentVoucherIndex >= 0 ? (
                  <span>{currentVoucherIndex + 1} / {chronologicallyOrderedVouchers.length}</span>
                ) : (
                  <span className="text-rose-700 font-sans font-bold">سند جديد +</span>
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
                className="p-1.5 text-slate-600 hover:text-rose-900 hover:bg-slate-200/60 disabled:opacity-30 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
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
              <History size={14} className={showHistory ? 'text-rose-200' : 'text-rose-700'} />
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

          {/* Cluster 2: Action Operations & Printing */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* 3D New Voucher */}
            <button 
              type="button" 
              onClick={handleNewVoucher} 
              className="btn-3d btn-3d-rose h-9 sm:h-10 px-2.5 sm:px-3.5 text-xs font-black"
            >
              <Plus size={15} />
              <span>سند جديد #{nextCalculatedVoucherNum}</span>
            </button>

            {/* 3D Post / Unpost */}
            {isCurrentVoucherDraft && (
              <button
                type="button"
                onClick={handlePostCurrentVoucher}
                className="btn-3d btn-3d-emerald h-9 sm:h-10 px-2.5 sm:px-3.5 text-xs font-black"
                title="ترحيل السند في الحسابات العامة ودفتر الأستاذ وتحديث الأرصدة"
              >
                <Send size={14} />
                <span>ترحيل السند</span>
              </button>
            )}
            {isCurrentVoucherPosted && (
              <button
                type="button"
                onClick={handleUnpostCurrentVoucher}
                className="btn-3d btn-3d-amber h-9 sm:h-10 px-3 sm:px-4 text-xs font-black"
                title="إلغاء ترحيل هذا السند وإعادته كمسودة مؤقتة وإيقاف أثره المحاسبي"
              >
                <RotateCcw size={14} />
                <span>إلغاء الترحيل</span>
              </button>
            )}

            {/* Print & Preview Group */}
            <div className="flex items-center gap-1.5 border-r border-slate-300/80 pr-2 mr-0.5">
              <button
                type="button"
                onClick={() => {
                  setCustomPreviewData(null);
                  setShowPrintPreview(true);
                }}
                className="btn-3d btn-3d-slate h-9 sm:h-10 px-2.5 sm:px-3 text-xs font-black"
                title="معاينة سند الصرف الداخلي قبل الطباعة"
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

            {/* 3D Optical Scanner Button */}
            <button
              type="button"
              onClick={() => setShowScannerModal(true)}
              className="btn-3d btn-3d-purple h-9 sm:h-10 px-2.5 sm:px-3 text-xs font-black flex items-center gap-1.5 shadow-sm"
              title="فحص السند بالماسح الضوئي وقارئ الباركود للتحقق من صحته ومطابقته لمنع التلاعب"
            >
              <Scan size={14} className="text-purple-200 animate-pulse" />
              <span className="hidden sm:inline">ماسح الباركود & QR</span>
              <span className="sm:hidden">ماسح ضوئي</span>
            </button>

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
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-4 shadow-sm animate-in fade-in duration-150 print:hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <History size={16} className="text-rose-600" />
              <h3 className="font-bold text-slate-800 text-sm">سجل سندات الصرف والمدفوعات الداخلية بقاعدة البيانات</h3>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">{savedVouchers.length} سندات</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowExportModal(true)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1 transition-colors cursor-pointer"
                title="تصدير كشف سندات الصرف الداخلي إلى Excel (.xlsx) أو CSV أو PDF"
              >
                <FileSpreadsheet size={13} className="text-emerald-600" />
                <span>تصدير كشف السندات</span>
              </button>

              <button 
                type="button" 
                onClick={() => setShowHistory(false)}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
          {savedVouchers.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">لا توجد سندات صرف داخلية محفوظة بعد. السند القادم سيبدأ برقم #{nextCalculatedVoucherNum}.</p>
          ) : (
            <div className="overflow-x-auto max-h-56">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400">
                    <th className="pb-2 font-semibold">رقم السند</th>
                    <th className="pb-2 font-semibold text-center">حالة الترحيل</th>
                    <th className="pb-2 font-semibold">المصروف منه</th>
                    <th className="pb-2 font-semibold">مركز التكلفة</th>
                    <th className="pb-2 font-semibold">المستفيد / المستلم</th>
                    <th className="pb-2 font-semibold">نوع النفقة / الصرف</th>
                    <th className="pb-2 font-semibold">المبلغ</th>
                    <th className="pb-2 font-semibold">التاريخ</th>
                    <th className="pb-2 font-semibold">البيان</th>
                    <th className="pb-2 font-semibold text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {savedVouchers.map(v => (
                    <tr key={v.id} className={`hover:bg-slate-50 transition-colors ${editingVoucherId === v.id ? 'bg-rose-50/60' : ''}`}>
                      <td className="py-2 font-mono font-bold text-rose-700">#{v.voucherNumber}</td>
                      <td className="py-2 text-center">
                        {v.status === 'POSTED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 size={11} className="text-emerald-600" />
                            <span>مرحل بالحسابات</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <AlertTriangle size={11} className="text-amber-600" />
                            <span>مسودة (غير مرحل)</span>
                          </span>
                        )}

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
                      <td className="py-2 text-slate-700 font-medium">
                        <div className="flex flex-col gap-0.5">
                          <span>{getAccountName(v.fromAccountId)}</span>
                          <div className="flex items-center gap-1 text-[10px]">
                            {v.paymentMethod === 'BANK_TRANSFER' ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                                <Landmark size={10} />
                                <span>تحويل بنكي {v.referenceNo ? `#${v.referenceNo}` : ''}</span>
                              </span>
                            ) : v.paymentMethod === 'CHECK' ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 font-bold border border-amber-200">
                                <FileText size={10} />
                                <span>شيك {v.referenceNo ? `#${v.referenceNo}` : ''}</span>
                              </span>
                            ) : v.paymentMethod === 'SPAN' ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-bold border border-purple-200">
                                <CreditCard size={10} />
                                <span>مدى {v.referenceNo ? `#${v.referenceNo}` : ''}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200">
                                <Banknote size={10} />
                                <span>نقداً</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2">
                        {v.costCenterId ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200" title={v.costCenterName || v.costCenterId}>
                            <Building2 size={10} className="text-indigo-600" />
                            <span className="max-w-[110px] truncate">{v.costCenterName || v.costCenterId}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">عام</span>
                        )}
                      </td>
                      <td className="py-2 text-slate-700 font-medium">{v.paidTo}</td>
                      <td className="py-2 text-slate-500">
                        {PAYMENT_EXPENSE_TYPES.find(s => s.id === v.expenseType)?.label || v.expenseType}
                      </td>
                      <td className="py-2 font-mono font-bold text-rose-700">{v.amount.toLocaleString()} {currencySymbol}</td>
                      <td className="py-2 text-slate-500">{v.date}</td>
                      <td className="py-2 text-slate-500 truncate max-w-xs">{v.description}</td>
                      <td className="py-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {v.status === 'POSTED' ? (
                            <button
                              type="button"
                              onClick={() => handleTogglePostingFromList(v)}
                              className="flex items-center gap-1 px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded text-[11px] font-bold cursor-pointer transition-colors"
                              title="إلغاء الترحيل وإعادته كمسودة مؤقتة"
                            >
                              <RotateCcw size={11} />
                              <span>إلغاء الترحيل</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleTogglePostingFromList(v)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                              title="ترحيل السند في الحسابات العامة"
                            >
                              <Send size={11} />
                              <span>ترحيل</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setCustomPreviewData({
                                title: 'سند صرف داخلي',
                                docNumber: v.voucherNumber,
                                date: v.date,
                                partnerName: `المستفيد / المستلم: ${v.paidTo} | الصارف: ${v.disbursedBy}`,
                                paymentMethod: v.paymentMethod === 'CASH' ? 'نقداً (خزينة)' : v.paymentMethod === 'BANK_TRANSFER' ? 'تحويل بنكي' : 'شيك مصرفي',
                                notes: v.description,
                                grandTotal: v.amount,
                                subtotal: v.amount,
                                amount: v.amount,
                                paidAmount: v.amount,
                                voucherType: 'PAYMENT',
                                amountInWords: tafqeet(v.amount),
                                items: [{
                                  description: `صرف داخلي من حساب (${getAccountName(v.fromAccountId)}) - لصالح: ${v.paidTo} [${PAYMENT_EXPENSE_TYPES.find(s => s.id === v.expenseType)?.label || ''}]`,
                                  quantity: 1,
                                  unitPrice: v.amount,
                                  taxRate: 0,
                                  total: v.amount
                                }]
                              });
                              setShowPrintPreview(true);
                            }}
                            className="p-1 text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer"
                            title="معاينة السند الداخلي"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(v)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                            title="تعديل السند"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={v.status === 'POSTED'}
                            onClick={() => handleDelete(v.id, v.voucherNumber)}
                            className={`p-1 rounded ${
                              v.status === 'POSTED'
                                ? 'text-slate-300 cursor-not-allowed opacity-40'
                                : 'text-red-600 hover:bg-red-50 cursor-pointer'
                            }`}
                            title={v.status === 'POSTED' ? 'السند مرحل بالحسابات. يجب إلغاء الترحيل أولاً لحذفه' : 'حذف السند'}
                          >
                            <Trash2 size={13} />
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

      {/* Main Voucher Edit Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6 print:hidden overflow-hidden">
        {/* Status Indicator Banner */}
        {isCurrentVoucherPosted && (
          <div className="bg-emerald-50 border-b border-emerald-200 -mx-6 -mt-6 mb-6 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-emerald-950 text-sm">
                    السند مرحل ومعتمد رسمياً في الحسابات العامة
                  </span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2.5 py-0.5 rounded-full">
                    مؤثر على الحسابات ودفتر الأستاذ
                  </span>
                </div>
                <p className="text-emerald-800 text-[11px] mt-0.5">
                  المبلغ ({Number(amount || 0).toLocaleString()} {currencyFullNameAr}) مخصوم ومقيد في حساب ({getAccountName(fromAccountId)}) وميزان المراجعة.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleUnpostCurrentVoucher}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border border-amber-600 rounded-lg text-xs font-black transition-colors cursor-pointer shrink-0 shadow-xs"
              title="إلغاء الترحيل وإعادة السند كمسودة مؤقتة وإيقاف أثره المالي"
            >
              <RotateCcw size={14} />
              <span>إلغاء الترحيل</span>
            </button>
          </div>
        )}

        {isCurrentVoucherDraft && (
          <div className="bg-amber-50 border-b border-amber-200 -mx-6 -mt-6 mb-6 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <AlertTriangle size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-amber-950 text-sm">
                    السند في وضع المسودة (غير مرحل في الحسابات)
                  </span>
                  <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2.5 py-0.5 rounded-full">
                    لا يؤثر على الأرصدة أو الحسابات
                  </span>
                </div>
                <p className="text-amber-800 text-[11px] mt-0.5">
                  تم إلغاء الترحيل التلقائي. لن يتم إثبات أي أثر مالي في الحسابات أو الأستاذ العام إلا بعد الضغط على زر الترحيل.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handlePostCurrentVoucher}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer shrink-0 animate-pulse"
              title="ترحيل السند في الحسابات العامة ودفتر الأستاذ"
            >
              <Send size={14} />
              <span>ترحيل السند في الحسابات</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Voucher Number */}
            <div className="space-y-1">
              <label className="text-xs font-black uppercase text-slate-800 tracking-wide">رقم سند الصرف الداخلي</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleNavigatePrevious}
                  disabled={!canGoPrevious}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  title="تراجع للخلف (السابق)"
                >
                  <ChevronRight size={14} />
                </button>
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    value={voucherNumber}
                    onChange={(e) => setVoucherNumber(e.target.value)}
                    placeholder={nextCalculatedVoucherNum}
                    required
                    className={`w-full px-3 py-2 text-sm font-mono font-bold rounded-lg border outline-none transition-all ${
                      isVoucherDuplicate
                        ? 'border-red-500 bg-red-50 text-red-900 focus:ring-2 focus:ring-red-200'
                        : 'border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setVoucherNumber(nextCalculatedVoucherNum)}
                    className="absolute left-2 top-2 text-[10px] text-rose-600 hover:text-rose-800 font-bold bg-rose-50 px-1.5 py-0.5 rounded cursor-pointer"
                    title="استعادة الرقم التسلسلي المقترح آلياً"
                  >
                    تلقائي
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleNavigateNext}
                  disabled={!canGoNext}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  title="تقديم للأمام (التالي)"
                >
                  <ChevronLeft size={14} />
                </button>
              </div>
              {isVoucherDuplicate && (
                <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                  <AlertTriangle size={12} /> هذا الرقم مستخدم بالفعل في سند آخر!
                </p>
              )}
            </div>

            {/* Date */}
            <div className="space-y-1">
              <label className="text-xs font-black uppercase text-slate-800 tracking-wide">تاريخ الصرف</label>
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
              />
            </div>

            {/* Expense Type */}
            <div className="space-y-1">
              <label className="text-xs font-black uppercase text-slate-800 tracking-wide">نوع وجهة الصرف الداخلي</label>
              <select
                value={expenseType}
                onChange={(e) => setExpenseType(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
              >
                {PAYMENT_EXPENSE_TYPES.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* From Account (Disbursed from) */}
            <div className="space-y-1">
              <label className="text-xs font-black uppercase text-slate-800 tracking-wide flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Wallet size={14} className="text-rose-600" />
                  الحساب المصروف منه (الخزينة أو البنك)
                </span>
                <span className="text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-bold">دليل الحسابات</span>
              </label>
              <select
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-lg border border-rose-300 bg-rose-50/40 text-rose-950 font-bold focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
              >
                {internalAccountsList.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* If cash deposit to bank or branch feed: To Account */}
            {(expenseType === 'cash_to_bank' || expenseType === 'branch_feed') && (
              <div className="space-y-1 animate-fadeIn">
                <label className="text-xs font-black uppercase text-slate-800 tracking-wide flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Landmark size={14} className="text-indigo-600" />
                    الحساب المودع فيه (المستفيد)
                  </span>
                  <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-bold">مناقلة داخلية</span>
                </label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-indigo-300 bg-indigo-50/40 text-indigo-950 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                >
                  <option value="">-- اختر الحساب المودع فيه --</option>
                  {internalAccountsList.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Paid To (Beneficiary) */}
            <div className="space-y-1">
              <label className="text-xs font-black uppercase text-slate-800 tracking-wide flex items-center gap-1.5">
                <UserCheck size={14} className="text-slate-500" />
                المستلم / المستفيد الداخلي
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={paidTo}
                  onChange={(e) => setPaidTo(e.target.value)}
                  placeholder="اسم الموظف / صاحب العهدة / المستلم"
                  list="employees-payment-list"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                />
                <datalist id="employees-payment-list">
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.name}>
                      {emp.name} {emp.jobTitle ? `(${emp.jobTitle})` : ''}
                    </option>
                  ))}
                  <option value="صندوق مبيعات المعرض" />
                  <option value="مسؤول المشتريات النثرية" />
                  <option value="أمين عهدة النظافة والصيانة" />
                </datalist>
              </div>
            </div>

            {/* Disbursed By (Cashier) */}
            <div className="space-y-1">
              <label className="text-xs font-black uppercase text-slate-800 tracking-wide">الصارف / أمين الصندوق</label>
              <input
                type="text"
                value={disbursedBy}
                onChange={(e) => setDisbursedBy(e.target.value)}
                placeholder="اسم أمين الصندوق"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Amount */}
            <div className="space-y-1">
              <label className="text-xs font-black uppercase text-slate-800 tracking-wide">المبلغ المصروف ({currencyFullNameAr})</label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full px-3 py-2 text-base font-mono font-bold rounded-lg border border-rose-300 bg-rose-50/30 text-rose-800 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none pl-12"
                />
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">{currencySymbol}</span>
              </div>
              {/* Tafqeet in Words */}
              <div className="mt-1.5 p-2 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center gap-1.5 text-xs text-slate-600">
                <Sparkles size={13} className="text-amber-500 shrink-0" />
                <span className="font-medium truncate font-serif">
                  {tafqeet(Number(amount) || 0)}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1">
              <label className="text-xs font-black uppercase text-slate-800 tracking-wide">طريقة الصرف والدفع</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    paymentMethod === 'CASH'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Banknote size={13} />
                  <span>نقداً</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('BANK_TRANSFER')}
                  className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    paymentMethod === 'BANK_TRANSFER'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Landmark size={13} />
                  <span>تحويل بنكي</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CHECK')}
                  className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    paymentMethod === 'CHECK'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <FileText size={13} />
                  <span>شيك</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('SPAN')}
                  className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    paymentMethod === 'SPAN'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <CreditCard size={13} />
                  <span>مدى / بطاقة</span>
                </button>
              </div>
            </div>

            {/* Reference No */}
            <div className="space-y-1">
              <label className="text-xs font-black uppercase text-slate-800 tracking-wide">
                {paymentMethod === 'CHECK' ? 'رقم الشيك المصرفي' : paymentMethod === 'BANK_TRANSFER' ? 'رقم التحويل / العملية' : 'رقم المرجع (اختياري)'}
              </label>
              <input 
                type="text" 
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder={paymentMethod === 'CHECK' ? 'مثال: CHQ-8840' : 'رقم الحوالة أو الشيك'}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none font-mono"
              />
            </div>
          </div>

          {/* Conditional Bank & Check details */}
          {(paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CHECK') && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Landmark size={13} className="text-rose-600" />
                  <span>{paymentMethod === 'CHECK' ? 'اسم البنك المسحوب عليه الشيك' : 'اسم البنك المصروف منه'}</span>
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="مثال: مصرف الراجحي / البنك الأهلي"
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                />
              </div>

              {paymentMethod === 'CHECK' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Calendar size={13} className="text-amber-600" />
                    <span>تاريخ استحقاق وصرف الشيك</span>
                  </label>
                  <input
                    type="date"
                    value={checkDueDate}
                    onChange={(e) => setCheckDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none font-mono"
                  />
                </div>
              )}
            </div>
          )}

          {/* Cost Center & Description */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cost Center Selector */}
            <div className="space-y-1">
              <label className="text-xs font-black uppercase text-slate-800 tracking-wide flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 size={13} className="text-indigo-600" />
                  <span>مركز التكلفة (Cost Center)</span>
                </span>
                <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-bold border border-indigo-200">
                  ربط السند
                </span>
              </label>
              <select
                value={costCenterId}
                onChange={(e) => setCostCenterId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-indigo-200 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              >
                <option value="">-- بدون تحديد مركز تكلفة (عام) --</option>
                {costCenters.map(cc => (
                  <option key={cc.id} value={cc.id}>
                    [{cc.code}] {cc.name} - ({getCostCenterTypeLabel(cc.type)})
                  </option>
                ))}
              </select>
              {selectedCostCenter && (
                <div className="text-[11px] text-slate-600 flex items-center justify-between bg-indigo-50/70 px-2 py-1 rounded-md border border-indigo-100">
                  <span className="font-bold text-indigo-900">المسؤول: {selectedCostCenter.manager || 'غير محدد'}</span>
                  <span className="font-mono text-indigo-700">الميزانية: {selectedCostCenter.budget?.toLocaleString() || 0} {currencyFullNameAr}</span>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-black uppercase text-slate-800 tracking-wide">البيان والشرح المحاسبي</label>
              <input 
                type="text" 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="وذلك عن: صرف عهدة مشتريات / سداد مصاريف صيانة ونثرية..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
              />
            </div>
          </div>

          {/* Live Interactive Card with Anti-Tamper Barcode & QR Code */}
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/30 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-rose-800">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-rose-600" />
                ملخص سند الصرف الداخلي والمطابقة الرقمية
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-purple-100 text-purple-900 border border-purple-200 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <Scan size={11} /> رمز الاستجابة السريعة والباركود مفعل
                </span>
                <span className="font-mono font-bold text-rose-900 bg-rose-100/80 px-2 py-0.5 rounded">
                  #{voucherNumber}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-rose-100">
                <span className="text-slate-400 block text-[10px]">الحساب المصروف منه:</span>
                <span className="font-bold text-slate-800">{getAccountName(fromAccountId)}</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-rose-100">
                <span className="text-slate-400 block text-[10px]">المستفيد والبيان:</span>
                <span className="font-bold text-slate-800">{paidTo || 'جهة داخلية'}</span>
                <span className="text-[10px] text-rose-600 block truncate">
                  {PAYMENT_EXPENSE_TYPES.find(s => s.id === expenseType)?.label}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-rose-100 flex flex-col justify-between">
                <span className="text-slate-400 block text-[10px]">صافي القيمة المصروفة:</span>
                <span className="font-mono font-black text-rose-700 text-sm">
                  {(Number(amount) || 0).toLocaleString()} {currencyFullNameAr}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-rose-100 flex items-center justify-between gap-2">
                <div className="flex-1 overflow-hidden">
                  <BarcodeImage 
                    value={voucherNumber || nextCalculatedVoucherNum} 
                    height={30} 
                    barWidth={1.1} 
                    fontSize={7.5} 
                  />
                </div>
                {systemSettings?.taxAndInvoice?.enableQrCode !== false && (
                  <VoucherQrCodeImage data={currentPreviewObject} size={38} showVerificationHash={false} />
                )}
              </div>
            </div>
          </div>

          {/* Approval Hierarchy Stepper */}
          {systemSettings?.approvalWorkflow?.enabled && (
            <div className="pt-2">
              <VoucherApprovalStepper
                voucher={activeVoucher}
                voucherId={editingVoucherId}
                voucherNumber={voucherNumber || nextCalculatedVoucherNum}
                voucherType="INTERNAL_PAYMENT"
                amount={Number(amount) || 0}
                date={date}
                isPosted={isCurrentVoucherPosted}
                postedAt={activeVoucher?.postedAt}
                approvalStatus={activeVoucher?.approvalStatus}
                approvedBy={activeVoucher?.approvedBy}
                approvedAt={activeVoucher?.approvedAt}
                approvalRole={activeVoucher?.approvalRole}
                approvalNotes={activeVoucher?.approvalNotes}
                rejectedBy={activeVoucher?.rejectedBy}
                rejectedAt={activeVoucher?.rejectedAt}
                rejectionReason={activeVoucher?.rejectionReason}
                preparedBy={activeVoucher?.preparedBy || disbursedBy}
                systemSettings={systemSettings}
                onApprovalChanged={() => {
                  const fresh = loadStoredInternalPayments();
                  setSavedVouchers(fresh);
                }}
                onOpenApprovalCenter={() => setShowApprovalCenterModal(true)}
                onPost={handlePostCurrentVoucher}
                onUnpost={handleUnpostCurrentVoucher}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <div>
              {isCurrentVoucherPosted && (
                <button
                  type="button"
                  onClick={handleUnpostCurrentVoucher}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-amber-400 bg-amber-50 text-amber-900 font-bold text-xs hover:bg-amber-100 transition-colors cursor-pointer shadow-xs"
                  title="إلغاء ترحيل هذا السند وإعادته كمسودة"
                >
                  <RotateCcw size={15} />
                  <span>إلغاء الترحيل (إعادة كمسودة)</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              {editingVoucherId && (
                <button
                  type="button"
                  onClick={handleNewVoucher}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              )}
              {!isCurrentVoucherPosted && (
                <button
                  type="button"
                  onClick={() => saveVoucherWithStatus('DRAFT')}
                  disabled={isVoucherDuplicate || !amount}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer ${
                    isVoucherDuplicate || !amount
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40'
                  }`}
                  title="حفظ السند كمسودة غير مرحلة في الحسابات"
                >
                  <Save size={15} />
                  <span>حفظ كمسودة (غير مرحل)</span>
                </button>
              )}
              {!isCurrentVoucherPosted && (
                <button
                  type="button"
                  onClick={handlePostCurrentVoucher}
                  disabled={isVoucherDuplicate || !amount}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs text-white transition-all shadow-md cursor-pointer ${
                    isVoucherDuplicate || !amount
                      ? 'bg-slate-400 cursor-not-allowed opacity-60'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-700/20'
                  }`}
                  title="ترحيل السند في الحسابات العامة ودفتر الأستاذ"
                >
                  <Send size={15} />
                  <span>ترحيل السند في الحسابات</span>
                </button>
              )}
              {isCurrentVoucherPosted && (
                <button
                  type="button"
                  onClick={() => saveVoucherWithStatus('POSTED')}
                  disabled={isVoucherDuplicate || !amount}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs text-white transition-all shadow-md cursor-pointer bg-rose-700 hover:bg-rose-800 shadow-rose-700/20"
                  title="حفظ التعديلات على السند المرحل"
                >
                  <Save size={15} />
                  <span>حفظ تعديلات السند المرحل</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Print Preview Modal */}
      <PrintPreviewModal 
        isOpen={showPrintPreview}
        onClose={() => {
          setShowPrintPreview(false);
          setCustomPreviewData(null);
        }}
        data={customPreviewData || currentPreviewObject}
      />

      {/* Optical Barcode & QR Scanner Modal */}
      <VoucherScannerModal 
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onSelectVoucherForPrint={(previewData) => {
          setShowScannerModal(false);
          setCustomPreviewData(previewData);
          setShowPrintPreview(true);
        }}
      />

      {/* Export Modal */}
      <VouchersExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        initialCategory="INTERNAL"
        initialType="PAYMENT"
        title="تصدير كشوفات سندات الصرف الداخلي والمصروفات (Excel / CSV / PDF)"
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
