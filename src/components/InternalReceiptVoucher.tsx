import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { 
  Save, ArrowDownLeft, Plus, History, AlertTriangle, Edit3, Trash2, X, Eye,
  Wallet, Sparkles, UserCheck, CheckCircle2, RotateCcw, Send,
  ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft,
  Banknote, Landmark, CreditCard, Calendar, FileText,
  Building2, Scan, FileSpreadsheet, User, Hash, Coins, AlignLeft, Printer, FileDown, MessageSquare
} from 'lucide-react';
import { Account, SystemSettings } from '../types/accounting';
import { loadChartOfAccounts } from '../utils/trialBalanceStore';
import { isCashOrBankAccount } from '../utils/accountingIntegration';
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
import { useIsInWindow } from './DesktopWindowManager';
import { 
  isApprovalRequired, 
  canVoucherBePosted 
} from '../utils/voucherApproval';
import { getSystemSettings } from '../utils/settings';
import { 
  getNextSequentialNumber, 
  isCodeOrNumberDuplicated, 
  advanceSequenceAfterSave, 
  DB_INTERNAL_RECEIPT_VOUCHERS_KEY 
} from '../utils/sequences';

export interface StoredInternalReceiptVoucher {
  id: string;
  voucherNumber: string;
  date: string;
  toAccountId: string;                 // الحساب المستلم / المودع فيه (خزينة/بنك)
  fromAccountId?: string | undefined;   // الحساب المحول منه (إن وجد)
  sourceType: string;                   // نوع التوريد الداخلي (استرداد عهدة، سلفة، توريد مبيعات، إلخ)
  receivedFrom: string;                 // المسلّم / الموظف / الفرع
  receivedBy: string;                   // المستلم / أمين الصندوق
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'SPAN' | 'OTHER';
  referenceNo?: string | undefined;     // رقم الشيك أو التحويل
  bankName?: string | undefined;        // اسم البنك المحول منه أو المسحوب عليه
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



const RECEIPT_SOURCE_TYPES = [
  { id: 'custody_refund', label: 'استرداد / تسوية عهدة موظف' },
  { id: 'advance_refund', label: 'استرداد سلفة موظف' },
  { id: 'branch_sales', label: 'توريد مبيعات فرع / نقطة بيع' },
  { id: 'bank_to_cash', label: 'سحب من حساب بنكي وإيداع بالخزينة' },
  { id: 'internal_revenue', label: 'إيرادات داخلية / استردادات متنوعة' },
  { id: 'transfer_in', label: 'مناقلة مالية واردة من خزينة أخرى' },
  { id: 'other', label: 'توريد داخلي آخر' },
];

function loadStoredInternalReceipts(): StoredInternalReceiptVoucher[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DB_INTERNAL_RECEIPT_VOUCHERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load internal receipt vouchers:', e);
  }
  return [];
}

export default function InternalReceiptVoucher({ isInWindow: explicitIsInWindow }: { isInWindow?: boolean } = {}) {
  const isInWindow = useIsInWindow(explicitIsInWindow);
  const { symbol: currencySymbol, fullNameAr: currencyFullNameAr, tafqeet } = useSystemCurrency();
  const [savedVouchers, setSavedVouchers] = useState<StoredInternalReceiptVoucher[]>(() => loadStoredInternalReceipts());
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
  const [employees, setEmployees] = useState<{ id: string; name: string; jobTitle?: string }[]>(() => {
    try {
      const primary = localStorage.getItem('alpha_accounting_employees_v1');
      const fallback = localStorage.getItem('alpha_payroll_employees_v1');
      const raw = primary || fallback;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map((e: any) => ({ id: e.id, name: e.name, jobTitle: e.jobTitle }));
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    const handleSync = () => {
      try {
        const primary = localStorage.getItem('alpha_accounting_employees_v1');
        const fallback = localStorage.getItem('alpha_payroll_employees_v1');
        const raw = primary || fallback;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setEmployees(parsed.map((e: any) => ({ id: e.id, name: e.name, jobTitle: e.jobTitle })));
          } else {
            setEmployees([]);
          }
        } else {
          setEmployees([]);
        }

        const freshVouchers = loadStoredInternalReceipts();
        setSavedVouchers(freshVouchers);
        setEditingVoucherId(null);
        setVoucherStatus('DRAFT');
        const nextSeq = getNextSequentialNumber('internalReceiptVoucher', freshVouchers.map(v => v.voucherNumber)).formatted;
        setVoucherNumber(nextSeq);
        setAmount('');
        setDescription('');
        setReceivedFrom('');
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
    return getNextSequentialNumber('internalReceiptVoucher', savedVouchers.map(v => v.voucherNumber)).formatted;
  }, [savedVouchers]);

  const [voucherNumber, setVoucherNumber] = useState<string>(() => nextCalculatedVoucherNum);
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0] as string);
  const [chartAccounts, setChartAccounts] = useState<Account[]>(() => loadChartOfAccounts());

  // Compute dynamic internal cash & bank accounts strictly from Chart of Accounts
  const internalAccountsList = useMemo(() => {
    return chartAccounts
      .filter(a => isCashOrBankAccount(a, chartAccounts))
      .map(a => ({
        id: a.id,
        code: a.code,
        name: a.name
      }));
  }, [chartAccounts]);

  // Compute dynamic revenue and receipt accounts (4xxx, 12xx) from Chart of Accounts
  const revenueAccountsList = useMemo(() => {
    return chartAccounts
      .filter(a => {
        if (a.isActive === false) return false;
        if (a.isPosting === false) return false;
        const code = String(a.code || '').trim();
        return a.type === 'REVENUE' || /^4\d+/.test(code) || code.startsWith('1205');
      })
      .map(a => ({
        id: a.id,
        code: a.code,
        name: a.name
      }));
  }, [chartAccounts]);

  // Source accounts (other banks, cash, employees, revenues)
  const sourceAccountsList = useMemo(() => {
    return chartAccounts
      .filter(a => {
        if (a.isActive === false) return false;
        if (a.isPosting === false) return false;
        const code = String(a.code || '').trim();
        return isCashOrBankAccount(a, chartAccounts) || a.type === 'REVENUE' || /^4\d+/.test(code) || code.startsWith('1205');
      })
      .map(a => ({
        id: a.id,
        code: a.code,
        name: a.name
      }));
  }, [chartAccounts]);

  const [toAccountId, setToAccountId] = useState<string>(() => {
    const list = loadChartOfAccounts().filter(a => isCashOrBankAccount(a, loadChartOfAccounts()));
    return list[0]?.id || 'cash1';
  });
  const [fromAccountId, setFromAccountId] = useState<string>('');
  const [sourceType, setSourceType] = useState<string>('custody_refund');
  const [receivedFrom, setReceivedFrom] = useState<string>('');
  const [receivedBy, setReceivedBy] = useState<string>('أمين الخزينة الرئيسي');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'SPAN' | 'OTHER'>('CASH');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [checkDueDate, setCheckDueDate] = useState<string>('');
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
    const handleAccountsUpdate = () => {
      const fresh = loadChartOfAccounts();
      setChartAccounts(fresh);
      const validAccounts = fresh.filter(a => isCashOrBankAccount(a, fresh));
      setToAccountId(prev => {
        if (validAccounts.some(a => a.id === prev || a.code === prev)) return prev;
        return validAccounts[0]?.id || prev;
      });
    };
    window.addEventListener('alpha-chart-of-accounts-updated', handleAccountsUpdate);
    window.addEventListener('alpha-data-changed', handleAccountsUpdate);
    return () => {
      window.removeEventListener('alpha-chart-of-accounts-updated', handleAccountsUpdate);
      window.removeEventListener('alpha-data-changed', handleAccountsUpdate);
    };
  }, []);

  const getAccountName = (id: string) => {
    const chartAcc = chartAccounts.find(a => a.id === id || a.code === id);
    if (chartAcc) return `[${chartAcc.code}] ${chartAcc.name}`;
    const srcType = RECEIPT_SOURCE_TYPES.find(s => s.id === id);
    if (srcType) return srcType.label;
    return id;
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
    return isCodeOrNumberDuplicated(voucherNumber, 'internalReceiptVoucher', listToCheck.map(v => v.voucherNumber));
  }, [voucherNumber, savedVouchers, editingVoucherId]);

  const handleNewVoucher = () => {
    setEditingVoucherId(null);
    setVoucherStatus('DRAFT');
    const nextSeq = getNextSequentialNumber('internalReceiptVoucher', savedVouchers.map(v => v.voucherNumber)).formatted;
    setVoucherNumber(nextSeq);
    setAmount('');
    setDescription('');
    setReceivedFrom('');
    setReferenceNo('');
    setBankName('');
    setCheckDueDate('');
    setPaymentMethod('CASH');
    setCostCenterId('');
  };

  const handleEdit = (v: StoredInternalReceiptVoucher) => {
    setEditingVoucherId(v.id);
    setVoucherStatus(v.status === 'POSTED' ? 'POSTED' : 'DRAFT');
    setVoucherNumber(v.voucherNumber);
    setDate(v.date);
    setToAccountId(v.toAccountId);
    setFromAccountId(v.fromAccountId || '');
    setSourceType(v.sourceType);
    setReceivedFrom(v.receivedFrom);
    setReceivedBy(v.receivedBy);
    setPaymentMethod(v.paymentMethod || 'CASH');
    setReferenceNo(v.referenceNo || '');
    setBankName(v.bankName || '');
    setCheckDueDate(v.checkDueDate || '');
    setCostCenterId(v.costCenterId || '');
    setAmount(v.amount.toString());
    setDescription(v.description);
    setShowHistory(false);
  };

  // Event listener & sessionStorage pickup for highlighting specific internal receipt
  useEffect(() => {
    const handleHighlight = (e: any) => {
      const v = e.detail?.voucher;
      if (v) handleEdit(v);
    };
    window.addEventListener('alpha-highlight-internal-receipt', handleHighlight);
    return () => window.removeEventListener('alpha-highlight-internal-receipt', handleHighlight);
  }, [savedVouchers]);

  useEffect(() => {
    try {
      const targetId = sessionStorage.getItem('alpha_target_internal_receipt_id');
      const targetNum = sessionStorage.getItem('alpha_target_internal_receipt_number');
      if (targetId || targetNum) {
        sessionStorage.removeItem('alpha_target_internal_receipt_id');
        sessionStorage.removeItem('alpha_target_internal_receipt_number');
        const cleanNum = targetNum ? targetNum.replace(/^#/, '').trim().toLowerCase() : '';
        const found = savedVouchers.find(v => 
          (targetId && String(v.id) === String(targetId)) ||
          (cleanNum && v.voucherNumber && String(v.voucherNumber).replace(/^#/, '').trim().toLowerCase() === cleanNum)
        );
        if (found) handleEdit(found);
      }
    } catch (e) {
      console.warn('Failed to load pending internal receipt from sessionStorage:', e);
    }
  }, [savedVouchers]);

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
      alert(`⚠️ لا يمكن حذف سند القبض الداخلي رقم (${vNum}) لأنه مرحل ومعتمد بالحسابات!\n\nيجب أولاً الضغط على زر [إلغاء الترحيل] لتحويل السند إلى مسودة، ثم يمكنك حذفه.`);
      return;
    }

    if (confirm(`هل أنت متأكد من رغبتك في حذف سند القبض الداخلي رقم (${vNum}) نهائياً؟`)) {
      const updated = savedVouchers.filter(v => v.id !== id);
      setSavedVouchers(updated);
      try {
        localStorage.setItem(DB_INTERNAL_RECEIPT_VOUCHERS_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      if (editingVoucherId === id) {
        handleNewVoucher();
      }
    }
  };

  const saveVoucherWithStatus = (targetStatus: 'DRAFT' | 'POSTED') => {
    if (!toAccountId || !amount) {
      alert('يرجى تحديد حساب الإيداع والمبلغ المالي أولاً!');
      return false;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('يرجى إدخال مبلغ مالي صحيح أكبر من صفر!');
      return false;
    }

    const finalNumber = voucherNumber.trim() || nextCalculatedVoucherNum;
    const toAccName = getAccountName(toAccountId);
    const sourceLabel = RECEIPT_SOURCE_TYPES.find(s => s.id === sourceType)?.label || sourceType;
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
        type: 'INTERNAL_RECEIPT',
        amount: numAmount,
        approvalStatus: finalApprovalStatus,
        status: 'DRAFT',
        requiresApproval: finalRequiresApproval
      }, systemSettings);

      if (!postValidation.canPost) {
        alert(`⚠️ تنبيه دورة الاعتماد الهرمية:\n\n${postValidation.reason}\n\nتم حفظ السند كمسودة بانتظار اعتماد الإدارة المالية ولن يتم ترحيله حتى يُعتمد رسمياً.`);
        targetStatus = 'DRAFT';
        isPost = false;
      }
    }

    const voucherData: StoredInternalReceiptVoucher = {
      id: editingVoucherId || Date.now().toString(),
      voucherNumber: finalNumber,
      date,
      toAccountId,
      fromAccountId: fromAccountId || undefined,
      sourceType,
      receivedFrom: receivedFrom.trim() || 'جهة داخلية',
      receivedBy: receivedBy.trim() || 'أمين الصندوق',
      paymentMethod,
      referenceNo: referenceNo.trim() || undefined,
      bankName: bankName.trim() || undefined,
      checkDueDate: checkDueDate.trim() || undefined,
      costCenterId: costCenterId.trim() || undefined,
      costCenterName: selectedCostCenter ? selectedCostCenter.name : undefined,
      amount: numAmount,
      status: targetStatus,
      postedAt: isPost ? (prevVoucher?.postedAt || nowIso) : undefined,
      description: description.trim() || `قبض وتوريد داخلي [${sourceLabel}] إلى ${toAccName}`,
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
      preparedBy: prevVoucher?.preparedBy || receivedBy.trim() || 'المحاسب'
    };

    let updated: StoredInternalReceiptVoucher[];
    if (editingVoucherId) {
      updated = savedVouchers.map(v => v.id === editingVoucherId ? voucherData : v);
    } else {
      updated = [
        voucherData,
        ...savedVouchers.filter(v => v.voucherNumber.trim().toLowerCase() !== finalNumber.toLowerCase())
      ];
      advanceSequenceAfterSave('internalReceiptVoucher', finalNumber);
    }

    setSavedVouchers(updated);
    try {
      localStorage.setItem(DB_INTERNAL_RECEIPT_VOUCHERS_KEY, JSON.stringify(updated));

      // Auto Sync with HR & Payroll Loans if this is a posted Custody / Advance refund
      if (isPost && (sourceType === 'custody_refund' || sourceType === 'advance_refund')) {
        try {
          const rawLoans = localStorage.getItem('alpha_accounting_loans_v1');
          if (rawLoans) {
            const existingLoans = JSON.parse(rawLoans);
            if (Array.isArray(existingLoans)) {
              let updatedAny = false;
              const nextLoans = existingLoans.map((loan: any) => {
                const isEmpMatch = (loan.employeeName && receivedFrom.trim().toLowerCase().includes(loan.employeeName.toLowerCase())) ||
                                  (loan.employeeCode && receivedFrom.trim().toLowerCase().includes(loan.employeeCode.toLowerCase()));
                if (isEmpMatch && loan.status === 'ACTIVE' && loan.remainingAmount > 0) {
                  updatedAny = true;
                  const newPaid = Math.min(loan.amount, (Number(loan.paidAmount) || 0) + numAmount);
                  const newRem = Math.max(0, loan.amount - newPaid);
                  return {
                    ...loan,
                    paidAmount: newPaid,
                    remainingAmount: newRem,
                    status: newRem === 0 ? 'PAID' : 'ACTIVE'
                  };
                }
                return loan;
              });
              if (updatedAny) {
                localStorage.setItem('alpha_accounting_loans_v1', JSON.stringify(nextLoans));
                window.dispatchEvent(new Event('alpha-payroll-updated'));
              }
            }
          }
        } catch (e) {
          console.error('Failed syncing loan refund from internal receipt voucher:', e);
        }
      }

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
      alert(`✅ تم ترحيل سند القبض الداخلي رقم (${finalNumber}) بنجاح في الحسابات!\n\nتم قيد وتأثير المبلغ (${numAmount.toLocaleString()} ${currencySymbol}) في حساب (${toAccName}) ودفتر الأستاذ العام وميزان المراجعة.`);
    } else {
      alert(`📝 تم حفظ سند القبض الداخلي رقم (${finalNumber}) كمسودة (غير مرحل) بنجاح!\n\nلم يتم إثبات أي أثر في دفتر الأستاذ حتى تضغط على زر [ترحيل السند في الحسابات].`);
    }

    return true;
  };

  const handlePostCurrentVoucher = () => {
    saveVoucherWithStatus('POSTED');
  };

  const handleUnpostCurrentVoucher = () => {
    const finalNumber = voucherNumber.trim() || nextCalculatedVoucherNum;
    if (confirm(`هل أنت متأكد من رغبتك في إلغاء ترحيل سند القبض الداخلي رقم (${finalNumber})؟\n\nسيتم إعادته كمسودة مؤقتة وإيقاف أثره المحاسبي في الحسابات العامة ودفتر الأستاذ.`)) {
      saveVoucherWithStatus('DRAFT');
    }
  };

  const handleTogglePostingFromList = (v: StoredInternalReceiptVoucher) => {
    const isCurrentlyPosted = v.status === 'POSTED';
    const newStatus: 'DRAFT' | 'POSTED' = isCurrentlyPosted ? 'DRAFT' : 'POSTED';
    if (isCurrentlyPosted && !confirm(`هل أنت متأكد من إلغاء ترحيل سند القبض الداخلي رقم (${v.voucherNumber})؟`)) {
      return;
    }

    if (!isCurrentlyPosted) {
      const postValidation = canVoucherBePosted({
        id: v.id,
        type: 'INTERNAL_RECEIPT',
        amount: v.amount,
        approvalStatus: v.approvalStatus,
        status: 'DRAFT',
        requiresApproval: v.requiresApproval
      }, systemSettings);

      if (!postValidation.canPost) {
        alert(`⚠️ لا يمكن ترحيل سند القبض الداخلي رقم (${v.voucherNumber}):\n\n${postValidation.reason}`);
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
      localStorage.setItem(DB_INTERNAL_RECEIPT_VOUCHERS_KEY, JSON.stringify(updated));
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

  const handleCurrentVoucherDelete = () => {
    const target = savedVouchers.find(v => v.id === editingVoucherId || v.voucherNumber === voucherNumber);
    if (target) {
      handleDelete(target.id, target.voucherNumber);
    } else {
      if (confirm('هل أنت متأكد من رغبتك في مسح وإلغاء البيانات المدخلة للسند الحالي؟')) {
        handleNewVoucher();
      }
    }
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    saveVoucherWithStatus(isCurrentVoucherPosted ? 'POSTED' : 'DRAFT');
  };

  const handleDirectPrint = () => {
    window.print();
  };

  const handleDirectPdfExport = () => {
    setCustomPreviewData(null);
    setShowPrintPreview(true);
  };

  const handleOpenWhatsApp = () => {
    const textMsg = encodeURIComponent(
      `السلام عليكم ورحمة الله، مرفق تفاصيل سند قبض داخلي رقم #${voucherNumber} بقيمة ${Number(amount || 0).toLocaleString()} ريال - المسلّم: ${receivedFrom || 'جهة داخلية'}.`
    );
    window.open(`https://api.whatsapp.com/send?text=${textMsg}`, '_blank');
  };

  const currentPreviewObject: PrintPreviewData = {
    title: 'سند قبض داخلي',
    subtitle: 'سند توريد واستلام نقدية لحسابات وصناديق المنشأة الداخلية',
    docNumber: voucherNumber,
    date: date,
    partnerName: `المسلّم: ${receivedFrom || 'جهة داخلية'} | المستلم: ${receivedBy}`,
    paymentMethod: paymentMethod === 'BANK_TRANSFER'
      ? `تحويل بنكي ${bankName ? '(' + bankName + ')' : ''} ${referenceNo ? 'مرجع: ' + referenceNo : ''}`
      : paymentMethod === 'CHECK'
        ? `شيك مصرفي ${bankName ? '(' + bankName + ')' : ''} ${referenceNo ? 'رقم: ' + referenceNo : ''} ${checkDueDate ? 'تاريخ الاستحقاق: ' + checkDueDate : ''}`
        : paymentMethod === 'SPAN'
          ? `شبكة / مدى ${referenceNo ? 'عملية #' + referenceNo : ''}`
          : `${getAccountName(toAccountId)} (نقداً)`,
    notes: description || `قبض وتوريد لحساب (${getAccountName(toAccountId)})`,
    grandTotal: Number(amount) || 0,
    subtotal: Number(amount) || 0,
    amount: Number(amount) || 0,
    paidAmount: Number(amount) || 0,
    voucherType: 'RECEIPT',
    amountInWords: tafqeet(Number(amount) || 0),
    items: [{
      description: `قبض داخلي لحساب (${getAccountName(toAccountId)}) - من: ${receivedFrom || 'مصدر داخلي'} [${RECEIPT_SOURCE_TYPES.find(s => s.id === sourceType)?.label || ''}]`,
      quantity: 1,
      unitPrice: Number(amount) || 0,
      taxRate: 0,
      total: Number(amount) || 0
    }]
  };

  return (
    <div className="flex flex-col flex-1">
      {/* Top Application Bar */}
      <div className={`flex flex-col gap-3 ${isInWindow ? 'mb-2' : 'mb-4'} print:hidden`}>
        {/* Screen Title (Shown ONLY in full screen mode; In multi-window mode, the top window bar is the single title) */}
        {!isInWindow && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 flex items-center gap-2">
                  <span className="p-1 bg-teal-100 text-teal-800 rounded-lg shadow-2xs">
                    <ArrowDownLeft size={20} />
                  </span>
                  سند قبض داخلي
                </h2>
                
                {editingVoucherId && (
                  <span className="text-xs bg-amber-50 text-amber-950 px-2.5 py-1 rounded-lg font-black border border-amber-300 flex items-center gap-1 shadow-2xs">
                    <Edit3 size={12} className="text-amber-700" /> وضع التعديل
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Global 3D Responsive Voucher Actions Toolbar */}
        <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-2 sm:p-2.5 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
          {/* Cluster 1: Sequential Navigation & History */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 max-w-full">
            {/* 3D Navigation Bar */}
            <div className="nav-3d-segment max-w-full overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={handleNavigateFirst}
                disabled={!canGoFirst}
                className="p-1.5 text-slate-600 hover:text-teal-900 hover:bg-slate-200/60 disabled:opacity-30 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed min-h-[34px] flex items-center justify-center"
                title="السند الأول (الأقدم)"
              >
                <ChevronsRight size={15} />
              </button>
              <button
                type="button"
                onClick={handleNavigatePrevious}
                disabled={!canGoPrevious}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-black text-slate-800 bg-white hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-200 shadow-2xs min-h-[34px]"
                title="تراجع للخلف - السند السابق"
              >
                <ChevronRight size={14} className="text-slate-700" />
                <span className="hidden sm:inline">تراجع للخلف</span>
                <span className="sm:hidden">السابق</span>
              </button>

              <div className="px-2 sm:px-2.5 py-1 text-[11px] font-mono font-black text-teal-950 bg-teal-50 rounded-lg mx-0.5 select-none border border-teal-200 whitespace-nowrap flex items-center">
                {currentVoucherIndex >= 0 ? (
                  <span>{currentVoucherIndex + 1} / {chronologicallyOrderedVouchers.length}</span>
                ) : (
                  <span className="text-teal-700 font-sans font-bold">سند جديد +</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleNavigateNext}
                disabled={!canGoNext}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-black text-slate-800 bg-white hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-200 shadow-2xs min-h-[34px]"
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
                className="p-1.5 text-slate-600 hover:text-teal-900 hover:bg-slate-200/60 disabled:opacity-30 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed min-h-[34px] flex items-center justify-center"
                title="السند الأخير (الأحدث)"
              >
                <ChevronsLeft size={15} />
              </button>
            </div>

            {/* 3D History Button */}
            <button 
              type="button" 
              onClick={() => setShowHistory(!showHistory)} 
              className={`btn-3d h-9 sm:h-10 px-2 sm:px-3 text-xs font-black min-h-[38px] ${
                showHistory ? 'btn-3d-active' : 'btn-3d-white'
              }`}
            >
              <History size={14} className={showHistory ? 'text-teal-200' : 'text-teal-700'} />
              <span>سجل السندات ({savedVouchers.length})</span>
            </button>

            

            {editingVoucherId && (
              <button
                type="button"
                onClick={handleNewVoucher}
                className="btn-3d btn-3d-white h-9 sm:h-10 px-2.5 sm:px-3 text-xs font-black text-slate-700 hover:text-slate-900 min-h-[38px]"
              >
                <X size={14} /> <span>إلغاء التعديل</span>
              </button>
            )}
          </div>

          {/* Cluster 2: Action Operations & Printing (Unified Actions Toolbar) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* New Voucher Button */}
            <button
              type="button"
              onClick={handleNewVoucher}
              className="h-8 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer transition-all"
              title="سند جديد"
            >
              <Plus size={14} />
              <span>جديد</span>
            </button>

            {/* Primary Action (ترحيل السند) */}
            {isCurrentVoucherDraft ? (
              <button
                type="button"
                onClick={handlePostCurrentVoucher}
                className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
                title="ترحيل السند واعتماده فوراً في الحسابات"
              >
                <CheckCircle2 size={15} />
                <span>ترحيل السند</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleUnpostCurrentVoucher}
                className="h-8 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                title="إلغاء الترحيل وإعادة السند كمسودة"
              >
                <RotateCcw size={14} />
                <span>إلغاء الترحيل</span>
              </button>
            )}

            {/* Secondary Action (حفظ كمسودة - Outline style) */}
            <button
              type="button"
              onClick={() => saveVoucherWithStatus('DRAFT')}
              className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
              title="حفظ السند كمسودة مؤقتة"
            >
              <Save size={14} className="text-slate-600" />
              <span>حفظ كمسودة</span>
            </button>

            {/* Unified Outputs Group (تجميع المخرجات بتصميم هادئ وموحد) */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-300 text-slate-700 shadow-2xs">
              {/* Preview Button */}
              <button
                type="button"
                onClick={() => {
                  setCustomPreviewData(null);
                  setShowPrintPreview(true);
                }}
                className="h-8 px-3 bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 border border-indigo-200 rounded-md text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
                title="معاينة السند قبل الطباعة"
              >
                <Eye size={14} className="text-indigo-600" />
                <span>معاينة</span>
              </button>

              {/* Direct Print */}
              <button
                type="button"
                onClick={handleDirectPrint}
                className="h-8 px-2.5 hover:bg-white text-slate-700 hover:text-slate-900 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                title="طباعة مباشرة"
              >
                <Printer size={14} className="text-slate-600" />
                <span>طباعة</span>
              </button>

              {/* Export PDF */}
              <button
                type="button"
                onClick={handleDirectPdfExport}
                className="h-8 px-2.5 hover:bg-white text-slate-700 hover:text-rose-700 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                title="تصدير PDF"
              >
                <FileDown size={14} className="text-rose-600" />
                <span>PDF</span>
              </button>

              {/* WhatsApp */}
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="h-8 px-2.5 hover:bg-white text-slate-700 hover:text-emerald-700 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                title="إرسال عبر واتساب"
              >
                <MessageSquare size={14} className="text-emerald-600" />
                <span>واتساب</span>
              </button>
            </div>

            {/* Scanner Button */}
            <button
              type="button"
              onClick={() => setShowScannerModal(true)}
              className="h-8 px-2.5 bg-slate-100 hover:bg-purple-50 text-purple-800 border border-slate-300 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
              title="فحص السند بالماسح الضوئي"
            >
              <Scan size={14} className="text-purple-600" />
              <span className="hidden sm:inline">ماسح الباركود</span>
            </button>

            {/* Export Vouchers Button */}
            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="h-8 px-2.5 bg-slate-100 hover:bg-emerald-50 text-emerald-800 border border-slate-300 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
              title="تصدير الكشوفات"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span className="hidden sm:inline">تصدير الكشوفات</span>
            </button>

            {/* Approval Center Button */}
            {systemSettings?.approvalWorkflow?.enabled && (
              <button
                type="button"
                onClick={() => setShowApprovalCenterModal(true)}
                className="h-8 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 relative cursor-pointer transition-all"
                title="مركز الاعتمادات"
              >
                <UserCheck size={14} className="text-amber-600" />
                <span className="hidden sm:inline">مركز الاعتماد</span>
                {pendingApprovalsCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-red-600 text-white rounded-full text-[10px] font-mono font-bold animate-bounce">
                    {pendingApprovalsCount}
                  </span>
                )}
              </button>
            )}

            {/* Delete Action Button (في آخر شريط الإجراءات) */}
            <button
              type="button"
              onClick={handleCurrentVoucherDelete}
              className="h-8 px-3 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-700 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="حذف هذا السند أو مسح البيانات"
            >
              <Trash2 size={14} />
              <span>حذف السند</span>
            </button>
          </div>
        </div>
        </div>
      {/* Collapsible History Drawer */}
      {showHistory && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-4 shadow-sm animate-in fade-in duration-150 print:hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <History size={16} className="text-teal-600" />
              <h3 className="font-bold text-slate-800 text-sm">سجل سندات القبض والتوريد الداخلي بقاعدة البيانات</h3>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">{savedVouchers.length} سندات</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowExportModal(true)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1 transition-colors cursor-pointer"
                title="تصدير كشف سندات القبض والتوريد الداخلي إلى Excel (.xlsx) أو CSV أو PDF"
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
            <p className="text-xs text-slate-400 text-center py-4">لا توجد سندات قبض داخلية محفوظة بعد. السند القادم سيبدأ برقم #{nextCalculatedVoucherNum}.</p>
          ) : (
            <>
              {/* Mobile Cards View (< md) */}
              <div className="md:hidden divide-y divide-slate-100 max-h-72 overflow-y-auto space-y-2">
                {savedVouchers.map(v => (
                  <div 
                    key={v.id} 
                    className={`p-3 rounded-xl space-y-2 transition-all border ${
                      editingVoucherId === v.id 
                        ? 'bg-teal-50/70 border-teal-300 ring-1 ring-teal-200' 
                        : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-teal-900 text-xs bg-teal-100/80 border border-teal-300 px-2 py-0.5 rounded-md">
                          #{v.voucherNumber}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">{v.date}</span>
                      </div>
                      <div>
                        {v.status === 'POSTED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 size={10} className="text-emerald-600" />
                            <span>مرحل</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <AlertTriangle size={10} className="text-amber-600" />
                            <span>مسودة</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">المودع فيه:</span>
                        <span className="font-semibold text-slate-800 truncate block">{getAccountName(v.toAccountId)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">المبلغ:</span>
                        <span className="font-mono font-black text-emerald-700">{v.amount.toLocaleString()} {currencySymbol}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">المسلّم:</span>
                        <span className="text-slate-700 truncate block">{v.receivedFrom || 'جهة داخلية'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">نوع التوريد:</span>
                        <span className="text-slate-600 truncate block">{RECEIPT_SOURCE_TYPES.find(s => s.id === v.sourceType)?.label || v.sourceType}</span>
                      </div>
                    </div>

                    {v.description && (
                      <p className="text-[11px] text-slate-600 truncate bg-white p-1.5 rounded-md border border-slate-200/70">
                        {v.description}
                      </p>
                    )}

                    {/* Actions row */}
                    <div className="flex items-center justify-between pt-1 gap-2 border-t border-slate-200/60">
                      <div className="flex items-center gap-1">
                        {v.status === 'POSTED' ? (
                          <button
                            type="button"
                            onClick={() => handleTogglePostingFromList(v)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            <RotateCcw size={11} />
                            <span>إلغاء الترحيل</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleTogglePostingFromList(v)}
                            className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                          >
                            <Send size={11} />
                            <span>ترحيل</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setCustomPreviewData({
                              title: 'سند قبض داخلي',
                              subtitle: 'سند توريد واستلام نقدية لحسابات وصناديق المنشأة الداخلية',
                              docNumber: v.voucherNumber,
                              date: v.date,
                              partnerName: `المسلّم: ${v.receivedFrom} | المستلم: ${v.receivedBy}`,
                              paymentMethod: v.paymentMethod === 'CASH' ? 'نقداً (خزينة)' : v.paymentMethod === 'BANK_TRANSFER' ? 'تحويل بنكي' : 'شيك مصرفي',
                              notes: v.description,
                              grandTotal: v.amount,
                              subtotal: v.amount,
                              amount: v.amount,
                              paidAmount: v.amount,
                              voucherType: 'RECEIPT',
                              amountInWords: tafqeet(v.amount),
                              items: [{
                                description: `قبض داخلي لحساب (${getAccountName(v.toAccountId)}) - من: ${v.receivedFrom} [${RECEIPT_SOURCE_TYPES.find(s => s.id === sourceType)?.label || ''}]`,
                                quantity: 1,
                                unitPrice: v.amount,
                                taxRate: 0,
                                total: v.amount
                              }]
                            });
                            setShowPrintPreview(true);
                          }}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 cursor-pointer"
                          title="معاينة السند"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(v)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 cursor-pointer"
                          title="تعديل السند"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={v.status === 'POSTED'}
                          onClick={() => handleDelete(v.id, v.voucherNumber)}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            v.status === 'POSTED'
                              ? 'text-slate-300 border-slate-200 opacity-40 cursor-not-allowed'
                              : 'text-red-600 hover:bg-red-50 border-red-200 cursor-pointer'
                          }`}
                          title={v.status === 'POSTED' ? 'السند مرحل بالحسابات. يجب إلغاء الترحيل أولاً لحذفه' : 'حذف السند'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto max-h-56">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400">
                      <th className="pb-2 font-semibold">رقم السند</th>
                      <th className="pb-2 font-semibold text-center">حالة الترحيل</th>
                      <th className="pb-2 font-semibold">المودع فيه (المستلم)</th>
                      <th className="pb-2 font-semibold">مركز التكلفة</th>
                      <th className="pb-2 font-semibold">المسلّم / المصدر</th>
                      <th className="pb-2 font-semibold">نوع التوريد</th>
                      <th className="pb-2 font-semibold">المبلغ</th>
                      <th className="pb-2 font-semibold">التاريخ</th>
                      <th className="pb-2 font-semibold">البيان</th>
                      <th className="pb-2 font-semibold text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {savedVouchers.map(v => (
                      <tr key={v.id} className={`hover:bg-slate-50 transition-colors ${editingVoucherId === v.id ? 'bg-teal-50/60' : ''}`}>
                        <td className="py-2 font-mono font-bold text-teal-700">#{v.voucherNumber}</td>
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
                            <span>{getAccountName(v.toAccountId)}</span>
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
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
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
                        <td className="py-2 text-slate-700 font-medium">{v.receivedFrom}</td>
                        <td className="py-2 text-slate-500">
                          {RECEIPT_SOURCE_TYPES.find(s => s.id === v.sourceType)?.label || v.sourceType}
                        </td>
                        <td className="py-2 font-mono font-bold text-emerald-700">{v.amount.toLocaleString()} {currencySymbol}</td>
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
                                  title: 'سند قبض داخلي',
                                  subtitle: 'سند توريد واستلام نقدية لحسابات وصناديق المنشأة الداخلية',
                                  docNumber: v.voucherNumber,
                                  date: v.date,
                                  partnerName: `المسلّم: ${v.receivedFrom} | المستلم: ${v.receivedBy}`,
                                  paymentMethod: v.paymentMethod === 'CASH' ? 'نقداً (خزينة)' : v.paymentMethod === 'BANK_TRANSFER' ? 'تحويل بنكي' : 'شيك مصرفي',
                                  notes: v.description,
                                  grandTotal: v.amount,
                                  subtotal: v.amount,
                                  amount: v.amount,
                                  paidAmount: v.amount,
                                  voucherType: 'RECEIPT',
                                  amountInWords: tafqeet(v.amount),
                                  items: [{
                                    description: `قبض داخلي لحساب (${getAccountName(v.toAccountId)}) - من: ${v.receivedFrom} [${RECEIPT_SOURCE_TYPES.find(s => s.id === sourceType)?.label || ''}]`,
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
            </>
          )}
        </div>
      )}

      {/* Main Voucher Edit Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-5 md:p-6 shadow-sm mb-6 print:hidden overflow-hidden">
        {/* Status Indicator Banner */}
        {isCurrentVoucherPosted && (
          <div className="bg-emerald-50 border-b border-emerald-200 -mx-3.5 sm:-mx-5 md:-mx-6 -mt-3.5 sm:-mt-5 md:-mt-6 mb-4 sm:mb-6 px-3.5 sm:px-5 md:px-6 py-3 sm:py-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="font-black text-emerald-950 text-xs sm:text-sm">
                    السند مرحل ومعتمد رسمياً في الحسابات العامة
                  </span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full shrink-0">
                    مؤثر على الحسابات والأستاذ
                  </span>
                </div>
                <p className="text-emerald-800 text-[11px] mt-0.5">
                  المبلغ ({Number(amount || 0).toLocaleString()} {currencyFullNameAr}) مقيد في حساب ({getAccountName(toAccountId)}) وميزان المراجعة.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleUnpostCurrentVoucher}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border border-amber-600 rounded-lg text-xs font-black transition-colors cursor-pointer shrink-0 shadow-xs min-h-[38px]"
              title="إلغاء الترحيل وإعادة السند كمسودة مؤقتة وإيقاف أثره المالي"
            >
              <RotateCcw size={14} />
              <span>إلغاء الترحيل</span>
            </button>
          </div>
        )}

        

        <form onSubmit={handleSave} className="space-y-4">
          {/* Row 1: [المسلّم / مستلم من] | [رقم السند] | [تاريخ السند] */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* 1. Received From */}
            <div>
              <label className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <User size={14} className="text-blue-600 shrink-0" />
                  <span>المسلّم / المورد الداخلي (حساب / موظف / جهة)</span>
                </span>
                {fromAccountId && (
                  <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                    مرتبط بحساب: {getAccountName(fromAccountId)}
                  </span>
                )}
              </label>
              <input
                type="text"
                value={receivedFrom}
                onChange={(e) => {
                  const val = e.target.value;
                  setReceivedFrom(val);
                  // Check if selected matches a revenue account
                  const matchedRev = revenueAccountsList.find(a => 
                    `[إيراد] [${a.code}] ${a.name}` === val || 
                    `[${a.code}] ${a.name}` === val || 
                    a.name === val
                  );
                  if (matchedRev) {
                    setFromAccountId(matchedRev.id);
                    setSourceType('internal_revenue');
                    return;
                  }
                  // Check if selected matches an internal safe/bank for cash withdrawal / transfer
                  const matchedSafe = internalAccountsList.find(a => 
                    `[خزينة/بنك] [${a.code}] ${a.name}` === val || 
                    `[${a.code}] ${a.name}` === val || 
                    a.name === val
                  );
                  if (matchedSafe) {
                    setFromAccountId(matchedSafe.id);
                    setSourceType('bank_to_cash');
                    return;
                  }
                  // Check if selected matches an employee
                  const matchedEmp = employees.find(emp => 
                    emp.name === val || 
                    `[موظف] ${emp.name}` === val || 
                    `${emp.name} (${emp.jobTitle})` === val
                  );
                  if (matchedEmp) {
                    setSourceType('custody_refund');
                    const empAdvanceAcc = chartAccounts.find(a => a.code === '1205' || a.code === '5102');
                    if (empAdvanceAcc) setFromAccountId(empAdvanceAcc.id);
                  }
                }}
                placeholder="اختر موظفاً (تسوية عهدة/سلفة)، حساب إيراد (4xxx)، صندوقاً، أو اكتب جهة التوريد..."
                list="receipt-sources-list"
                className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 outline-none transition-all"
              />
              <datalist id="receipt-sources-list">
                {/* 1. موظفو المنشأة (استرداد سلف / تسوية عهد) */}
                {employees.map(emp => (
                  <option 
                    key={`emp-${emp.id}`} 
                    value={`[موظف] ${emp.name}${emp.jobTitle ? ` (${emp.jobTitle})` : ''}`}
                  >
                    موظف: استرداد سلفة أو تسوية عهدة متبقية
                  </option>
                ))}

                {/* 2. بنود وحسابات الإيرادات المتنوعة (4xxx) من شجرة الحسابات */}
                {revenueAccountsList.map(rev => (
                  <option 
                    key={`rev-${rev.id}`} 
                    value={`[إيراد] [${rev.code}] ${rev.name}`}
                  >
                    بند إيراد في شجرة الحسابات
                  </option>
                ))}

                {/* 3. الخزائن والبنوك الأخرى (سحب من بنك أو تحويل وارد من فرع) */}
                {internalAccountsList.filter(a => a.id !== toAccountId).map(acc => (
                  <option 
                    key={`safe-${acc.id}`} 
                    value={`[خزينة/بنك] [${acc.code}] ${acc.name}`}
                  >
                    سحب من حساب بنكي أو مناقلة واردة من صندوق آخر
                  </option>
                ))}
              </datalist>
            </div>

            {/* 2. Voucher Number */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Hash size={14} className="text-indigo-600 shrink-0" />
                <span>رقم السند</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={voucherNumber}
                  onChange={(e) => setVoucherNumber(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl text-xs font-mono font-bold border border-slate-200 bg-slate-50 text-slate-900 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setVoucherNumber(nextCalculatedVoucherNum)}
                  className="px-2.5 py-2 text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 shrink-0 cursor-pointer"
                >
                  تلقائي
                </button>
              </div>
            </div>

            {/* 3. Voucher Date */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Calendar size={14} className="text-amber-600 shrink-0" />
                <span>تاريخ السند</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-teal-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Row 2: [المبلغ المقبوض] | [مركز التكلفة] | [الصندوق / البنك] | [طريقة السداد/الصرف] */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Amount */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-teal-950 mb-1.5">
                <Coins size={14} className="text-emerald-600 shrink-0" />
                <span>المبلغ المقبوض ({currencySymbol})</span>
                <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onFocus={e => e.target.select()}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full py-2 px-3 rounded-xl text-base font-mono font-black border border-teal-300 bg-teal-50/40 text-teal-950 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 outline-none transition-all text-left"
                dir="ltr"
              />
            </div>

            {/* 2. Cost Center */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Building2 size={14} className="text-purple-600 shrink-0" />
                <span>مركز التكلفة</span>
              </label>
              <select
                value={costCenterId}
                onChange={(e) => setCostCenterId(e.target.value)}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-teal-500 outline-none transition-all"
              >
                <option value="">-- بدون تحديد (عام) --</option>
                {costCenters.map(cc => (
                  <option key={cc.id} value={cc.id}>[{cc.code}] {cc.name}</option>
                ))}
              </select>
            </div>

            {/* 3. Deposit Safe / Bank Account */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Landmark size={14} className="text-cyan-600 shrink-0" />
                <span>الصندوق / البنك المودع فيه</span>
              </label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-teal-500 outline-none transition-all"
              >
                {internalAccountsList.map(a => (
                  <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>
                ))}
              </select>
            </div>

            {/* 4. Payment Method */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <CreditCard size={14} className="text-indigo-600 shrink-0" />
                <span>طريقة السداد / القبض</span>
              </label>
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                    paymentMethod === 'CASH'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Banknote size={13} />
                  <span>نقد</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('BANK_TRANSFER')}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                    paymentMethod === 'BANK_TRANSFER'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Landmark size={13} />
                  <span>تحويل</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CHECK')}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                    paymentMethod === 'CHECK'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <FileText size={13} />
                  <span>شيك</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('SPAN')}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                    paymentMethod === 'SPAN'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <CreditCard size={13} />
                  <span>مدى</span>
                </button>
              </div>
            </div>
          </div>

          {/* Linked Transfer / Check details strip */}
          {(paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CHECK' || paymentMethod === 'SPAN' || sourceType === 'bank_to_cash' || sourceType === 'transfer_in') && (
            <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-fadeIn">
              {(sourceType === 'bank_to_cash' || sourceType === 'transfer_in') && (
                <div>
                  <label className="block text-[11px] font-bold text-indigo-950 mb-1">الحساب المسحوب منه</label>
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                    className="w-full py-1.5 px-2.5 rounded-lg border border-indigo-200 bg-white text-xs font-bold"
                  >
                    <option value="">-- اختر الحساب المسحوب منه --</option>
                    {internalAccountsList.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {paymentMethod === 'BANK_TRANSFER' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-indigo-950 mb-1">اسم البنك المحول منه</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                      placeholder="أدخل اسم البنك..."
                      className="w-full py-1.5 px-2.5 rounded-lg border border-indigo-200 bg-white text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-indigo-950 mb-1">رقم المرجع / الحوالة</label>
                    <input
                      type="text"
                      value={referenceNo}
                      onChange={e => setReferenceNo(e.target.value)}
                      placeholder="TRX-123456"
                      className="w-full py-1.5 px-2.5 rounded-lg border border-indigo-200 bg-white text-xs font-mono font-bold"
                    />
                  </div>
                </>
              )}
              {paymentMethod === 'CHECK' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-950 mb-1">رقم الشيك</label>
                    <input
                      type="text"
                      value={referenceNo}
                      onChange={e => setReferenceNo(e.target.value)}
                      placeholder="CHK-0001"
                      className="w-full py-1.5 px-2.5 rounded-lg border border-amber-200 bg-white text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-950 mb-1">تاريخ الاستحقاق</label>
                    <input
                      type="date"
                      value={checkDueDate}
                      onChange={e => setCheckDueDate(e.target.value)}
                      className="w-full py-1.5 px-2.5 rounded-lg border border-amber-200 bg-white text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-950 mb-1">البنك المسحوب عليه</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                      placeholder="مصرف الراجحي..."
                      className="w-full py-1.5 px-2.5 rounded-lg border border-amber-200 bg-white text-xs font-bold"
                    />
                  </div>
                </>
              )}
              {paymentMethod === 'SPAN' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-purple-950 mb-1">رقم عملية مدى / الجهاز</label>
                    <input
                      type="text"
                      value={referenceNo}
                      onChange={e => setReferenceNo(e.target.value)}
                      placeholder="POS-98765"
                      className="w-full py-1.5 px-2.5 rounded-lg border border-purple-200 bg-white text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-purple-950 mb-1">اسم البنك / البطاقة</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                      placeholder="مدى / فيزا / ماستركارد..."
                      className="w-full py-1.5 px-2.5 rounded-lg border border-purple-200 bg-white text-xs font-bold"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Row 3: [البيان والشرح المحاسبي] */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
              <AlignLeft size={14} className="text-slate-600 shrink-0" />
              <span>البيان والشرح المحاسبي</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="استرداد عهدة / سلفة / الشرح المحاسبي للعملية..."
              className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 outline-none transition-all resize-none"
            />
          </div>
        </form>

        {/* Approval Stepper if enabled */}
        {systemSettings?.approvalWorkflow?.enabled && (
          <div className="mt-4">
            <VoucherApprovalStepper
              voucher={activeVoucher}
              voucherId={editingVoucherId}
              voucherType="INTERNAL_RECEIPT"
              voucherNumber={voucherNumber}
              amount={Number(amount) || 0}
              approvalStatus={activeVoucher?.approvalStatus || 'NOT_REQUIRED'}
              preparedBy={activeVoucher?.preparedBy || receivedBy}
              systemSettings={systemSettings}
              onApprovalChanged={() => {
                const fresh = loadStoredInternalReceipts();
                setSavedVouchers(fresh);
              }}
              onOpenApprovalCenter={() => setShowApprovalCenterModal(true)}
              onPost={handlePostCurrentVoucher}
              onUnpost={handleUnpostCurrentVoucher}
            />
          </div>
        )}

        {/* Sleek, Compact Modern Summary Footer Banner */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm border border-slate-800 flex flex-wrap items-center justify-between gap-4 mt-6 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold shrink-0">
              <Banknote size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">إجمالي المبلغ المقبوض</span>
                {isCurrentVoucherPosted ? (
                  <span className="text-[10px] bg-emerald-900/80 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-700/60 flex items-center gap-1">
                    <CheckCircle2 size={10} /> مرحل بالحسابات
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-900/80 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-700/60 flex items-center gap-1">
                    <AlertTriangle size={10} /> مسودة
                  </span>
                )}
              </div>
              <span className="text-xs sm:text-sm font-extrabold text-amber-300 block mt-1 tracking-wide">
                الرصيد كتابة: {tafqeet(Number(amount) || 0)}
              </span>
            </div>
          </div>

          <div className="text-left shrink-0">
            <span className="text-2xl sm:text-3xl font-mono font-black text-emerald-400">
              {amount ? Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
            </span>
            <span className="text-xs text-slate-300 font-bold mr-1">{currencySymbol}</span>
          </div>
        </div>
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
        initialType="RECEIPT"
        title="تصدير كشوفات سندات القبض والتوريد الداخلي (Excel / CSV / PDF)"
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
