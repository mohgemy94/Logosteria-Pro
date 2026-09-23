import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { 
  Save, ArrowUpRight, ArrowDownLeft, Plus, History, AlertTriangle, 
  Edit3, Trash2, X, Eye, FileText, Truck, Users,
  CheckCircle2, RotateCcw, Send,
  ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft,
  Banknote, Landmark, CreditCard, Calendar, Hash,
  Sparkles, Calculator, CheckSquare, Layers, SplitSquareVertical,
  Building2, Scan, FileSpreadsheet, ShieldCheck, Stamp
} from 'lucide-react';
import { VoucherType, Partner, Account, AccountType } from '../types/accounting';
import { getSystemSettings } from '../utils/settings';
import { loadChartOfAccounts } from '../utils/trialBalanceStore';
import { 
  type CostCenter, 
  loadCostCenters, 
  getCostCenterTypeLabel 
} from '../utils/costCenterStore';
import PrintDropdown from './PrintDropdown';
import PrintPreviewModal, { PrintPreviewData } from './PrintPreviewModal';
import PartnerStatementModal from './PartnerStatementModal';
import { BarcodeImage, VoucherQrCodeImage } from './VoucherBarcodeView';
import VoucherScannerModal from './VoucherScannerModal';
import VouchersExportModal from './VouchersExportModal';
import VoucherApprovalStepper from './VoucherApprovalStepper';
import VouchersApprovalCenterModal from './VouchersApprovalCenterModal';
import { 
  isApprovalRequired, 
  canVoucherBePosted, 
  approveVoucherRecord, 
  rejectVoucherRecord,
  countPendingApprovals
} from '../utils/voucherApproval';
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
  StoredVoucherRecord,
  setVoucherPostingStatus
} from '../utils/partnerLedger';
import { 
  getPendingInvoicesForPartner, 
  distributeAmountFifo, 
  applyVoucherAllocations, 
  VoucherInvoiceAllocation 
} from '../utils/invoiceAllocation';

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

export interface ExternalVouchersProps {
  fixedType?: VoucherType;
}

export default function ExternalVouchers({ fixedType }: ExternalVouchersProps = {}) {
  const { symbol: currencySymbol, fullNameAr: currencyFullNameAr, tafqeet } = useSystemCurrency();
  const [type, setType] = useState<VoucherType>(() => fixedType || VoucherType.Receipt);
  const [receiptVouchers, setReceiptVouchers] = useState<StoredExternalVoucher[]>(() => loadStoredVouchers(DB_RECEIPT_VOUCHERS_KEY));
  const [paymentVouchers, setPaymentVouchers] = useState<StoredExternalVoucher[]>(() => loadStoredVouchers(DB_PAYMENT_VOUCHERS_KEY));
  const [showHistory, setShowHistory] = useState(false);
  const [historyPostingFilter, setHistoryPostingFilter] = useState<'ALL' | 'POSTED' | 'DRAFT'>('ALL');
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  
  const [voucherStatus, setVoucherStatus] = useState<'DRAFT' | 'POSTED'>('DRAFT');

  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [customPreviewData, setCustomPreviewData] = useState<PrintPreviewData | null>(null);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    if (fixedType && fixedType !== type) {
      setType(fixedType);
    }
  }, [fixedType]);

  // Dynamic Customers and Vendors loaded from unified ledger
  const [customers, setCustomers] = useState<Partner[]>(() => loadCustomers());
  const [vendors, setVendors] = useState<Partner[]>(() => loadVendors());
  const [partnerFilterCategory, setPartnerFilterCategory] = useState<'AUTO' | 'CUSTOMERS' | 'VENDORS' | 'ALL'>('AUTO');
  
  // Statement Modal State
  const [selectedPartnerForStatement, setSelectedPartnerForStatement] = useState<Partner | null>(null);

  // System Settings for Approval Workflow
  const [systemSettings, setSystemSettings] = useState(() => getSystemSettings());
  const [showApprovalCenterModal, setShowApprovalCenterModal] = useState(false);

  const isReceipt = type === VoucherType.Receipt;
  const currentKey = isReceipt ? DB_RECEIPT_VOUCHERS_KEY : DB_PAYMENT_VOUCHERS_KEY;
  const currentDocType = isReceipt ? 'receiptVoucher' : 'paymentVoucher';

  const pendingApprovalsCount = useMemo(() => {
    return countPendingApprovals();
  }, [receiptVouchers, paymentVouchers, systemSettings.approvalWorkflow?.enabled, systemSettings.approvalWorkflow?.minAmountThreshold]);

  useEffect(() => {
    const handleSettingsUpdate = () => {
      setSystemSettings(getSystemSettings());
    };
    window.addEventListener('system_settings_updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('system_settings_updated', handleSettingsUpdate);
    };
  }, []);

  useEffect(() => {
    const handleSync = () => {
      setCustomers(loadCustomers());
      setVendors(loadVendors());
      const freshReceipts = loadStoredVouchers(DB_RECEIPT_VOUCHERS_KEY);
      const freshPayments = loadStoredVouchers(DB_PAYMENT_VOUCHERS_KEY);
      setReceiptVouchers(freshReceipts);
      setPaymentVouchers(freshPayments);
      setEditingVoucherId(null);
      setVoucherStatus('DRAFT');
      const list = type === VoucherType.Receipt ? freshReceipts : freshPayments;
      const nextSeq = getNextSequentialNumber(currentDocType, list.map(v => v.voucherNumber)).formatted;
      setVoucherNumber(nextSeq);
      setAmount('');
      setDescription('');
      setPartnerId('');
    };

    window.addEventListener('alpha-partner-ledger-updated', handleSync);
    window.addEventListener('alpha-vouchers-updated', handleSync);
    window.addEventListener('alpha-voucher-approval-updated', handleSync);
    window.addEventListener('alpha-system-reset-completed', handleSync);
    window.addEventListener('alpha-data-changed', handleSync);
    window.addEventListener('alpha-device-id-changed', handleSync);
    window.addEventListener('alpha-sequences-updated', handleSync);
    window.addEventListener('storage', handleSync);

    const handleCreateVoiceVoucher = (e: any) => {
      const payload = e.detail;
      handleNewVoucher();
      if (payload?.partner?.id) {
        setPartnerId(payload.partner.id);
      } else if (payload?.partnerId) {
        setPartnerId(payload.partnerId);
      }
      if (payload?.amount) {
        setAmount(String(payload.amount));
      }
      if (payload?.paymentMethod) {
        if (payload.paymentMethod === 'TRANSFER') setPaymentMethod('BANK_TRANSFER');
        else if (payload.paymentMethod === 'CHECK') setPaymentMethod('CHECK');
        else if (payload.paymentMethod === 'CARD') setPaymentMethod('CREDIT_CARD');
        else setPaymentMethod('CASH');
      }
    };

    const handleHighlightVoucher = (e: any) => {
      const v = e.detail?.voucher;
      if (v) {
        handleEdit(v);
      }
    };

    window.addEventListener('alpha-voice-create-voucher', handleCreateVoiceVoucher);
    window.addEventListener('alpha-highlight-voucher', handleHighlightVoucher);

    return () => {
      window.removeEventListener('alpha-partner-ledger-updated', handleSync);
      window.removeEventListener('alpha-vouchers-updated', handleSync);
      window.removeEventListener('alpha-voucher-approval-updated', handleSync);
      window.removeEventListener('alpha-system-reset-completed', handleSync);
      window.removeEventListener('alpha-data-changed', handleSync);
      window.removeEventListener('alpha-device-id-changed', handleSync);
      window.removeEventListener('alpha-sequences-updated', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('alpha-voice-create-voucher', handleCreateVoiceVoucher);
      window.removeEventListener('alpha-highlight-voucher', handleHighlightVoucher);
    };
  }, [type, currentDocType]);

  const currentSavedList = isReceipt ? receiptVouchers : paymentVouchers;

  // Next calculated sequential voucher number based on DB records
  const nextCalculatedVoucherNum = useMemo(() => {
    return getNextSequentialNumber(currentDocType, currentSavedList.map(v => v.voucherNumber)).formatted;
  }, [currentDocType, currentSavedList]);

  const [voucherNumber, setVoucherNumber] = useState<string>(() => nextCalculatedVoucherNum);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0] as string);
  const [partnerId, setPartnerId] = useState<string>(() => {
    try {
      const pending = sessionStorage.getItem('alpha_pending_voucher_partner');
      if (pending) {
        sessionStorage.removeItem('alpha_pending_voucher_partner');
        return pending;
      }
    } catch (e) {}
    return '';
  });
  const [accountId, setAccountId] = useState<string>('acc-1101');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'SPAN' | 'OTHER'>('CASH');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [checkDueDate, setCheckDueDate] = useState<string>('');
  const [chartAccounts, setChartAccounts] = useState<Account[]>(() => loadChartOfAccounts());
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Cost Centers State
  const [costCenters, setCostCenters] = useState<CostCenter[]>(() => loadCostCenters());
  const [costCenterId, setCostCenterId] = useState<string>('');

  // Sync Cost Centers dynamically
  useEffect(() => {
    const handleCostCentersUpdate = () => setCostCenters(loadCostCenters());
    window.addEventListener('alpha-cost-centers-updated', handleCostCentersUpdate);
    return () => window.removeEventListener('alpha-cost-centers-updated', handleCostCentersUpdate);
  }, []);

  const selectedCostCenter = useMemo(() => {
    if (!costCenterId) return null;
    return costCenters.find(c => c.id === costCenterId || c.code === costCenterId) || null;
  }, [costCenters, costCenterId]);

  // Sync Chart of Accounts dynamically
  useEffect(() => {
    const handleAccountsUpdate = () => setChartAccounts(loadChartOfAccounts());
    window.addEventListener('alpha-chart-of-accounts-updated', handleAccountsUpdate);
    return () => window.removeEventListener('alpha-chart-of-accounts-updated', handleAccountsUpdate);
  }, []);

  // Filter dynamic Treasury, Safe, and Bank Accounts from Chart of Accounts
  const cashAndBankAccounts = useMemo(() => {
    const list = chartAccounts.filter(a => {
      const code = a.code || '';
      const name = (a.name || '').toLowerCase();
      return (
        code.startsWith('110') ||
        code === '1101' ||
        code === '1102' ||
        code === '1103' ||
        name.includes('صندوق') ||
        name.includes('خزينة') ||
        name.includes('بنك') ||
        name.includes('نقدية')
      );
    });
    if (list.length > 0) return list;
    return [
      { id: 'acc-1101', code: '1101', name: 'الصندوق الرئيسي (الخزينة النقدية)', type: AccountType.Asset, balanceType: 'DEBIT' as any },
      { id: 'acc-1102', code: '1102', name: 'البنك الأهلي التجاري (حساب جاري)', type: AccountType.Asset, balanceType: 'DEBIT' as any },
      { id: 'acc-1103', code: '1103', name: 'مصرف الراجحي (حساب جاري)', type: AccountType.Asset, balanceType: 'DEBIT' as any },
    ];
  }, [chartAccounts]);

  // Account display resolver
  const getAccountDisplay = (accId: string) => {
    if (accId === 'cash') return 'الصندوق الرئيسي';
    if (accId === 'bank') return 'البنك الأهلي التجاري';
    const found = chartAccounts.find(a => a.id === accId || a.code === accId);
    return found ? `[${found.code}] ${found.name}` : accId;
  };

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
      projectedNet,
      projectedNetFormatted: Math.abs(projectedNet).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      projectedLabel,
      projectedType
    };
  }, [selectedPartner, selectedPartnerStatement, amount, isReceipt]);

  // --- INVOICE MATCHING & ALLOCATION STATE & HANDLERS ---
  const [allocationsMap, setAllocationsMap] = useState<Record<string, number>>({});
  const [allocationMode, setAllocationMode] = useState<'AUTO_ALLOCATE' | 'GENERAL_ON_ACCOUNT'>('AUTO_ALLOCATE');
  const [allocationMessage, setAllocationMessage] = useState<string | null>(null);

  // Pending unpaid invoices for the selected partner
  const pendingInvoices = useMemo(() => {
    if (!selectedPartner) return [];
    return getPendingInvoicesForPartner(
      selectedPartner.id,
      selectedPartner.type,
      selectedPartner.name,
      editingVoucherId || undefined
    );
  }, [selectedPartner, editingVoucherId, receiptVouchers, paymentVouchers]);

  // Reset or initialize allocations when switching partner (only if not editing an existing voucher)
  useEffect(() => {
    if (!editingVoucherId) {
      setAllocationsMap({});
      if (pendingInvoices.length > 0) {
        setAllocationMode('AUTO_ALLOCATE');
      }
    }
  }, [partnerId, editingVoucherId]);

  const totalAllocatedAmount = useMemo(() => {
    if (allocationMode !== 'AUTO_ALLOCATE') return 0;
    return Object.values(allocationsMap).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }, [allocationsMap, allocationMode]);

  const totalPendingInvoicesRemaining = useMemo(() => {
    return pendingInvoices.reduce((sum, inv) => sum + inv.remainingBeforeCurrent, 0);
  }, [pendingInvoices]);

  const voucherNumericAmount = Number(amount) || 0;
  const unallocatedAmount = Math.max(0, voucherNumericAmount - totalAllocatedAmount);
  const isOverAllocated = totalAllocatedAmount > voucherNumericAmount && voucherNumericAmount > 0;

  const handleDistributeFifo = () => {
    if (voucherNumericAmount <= 0) {
      alert('يرجى إدخال مبلغ السند أولاً لتوزيعه على الفواتير المستحقة.');
      return;
    }
    const map = distributeAmountFifo(pendingInvoices, voucherNumericAmount);
    setAllocationsMap(map);
    setAllocationMode('AUTO_ALLOCATE');
    setAllocationMessage(`تم توزيع مبلغ (${voucherNumericAmount.toLocaleString()} ريال) تلقائياً على أقدم الفواتير المستحقة.`);
    setTimeout(() => setAllocationMessage(null), 4000);
  };

  const handleMatchVoucherToAllocations = () => {
    if (totalAllocatedAmount <= 0) {
      alert('يرجى تحديد مبالغ التخصيص أولاً.');
      return;
    }
    setAmount(totalAllocatedAmount.toFixed(2));
    setAllocationMessage(`تمت مطابقة مبلغ السند ليصبح (${totalAllocatedAmount.toLocaleString()} ريال) مساوياً لمجموع الفواتير المسواة.`);
    setTimeout(() => setAllocationMessage(null), 4000);
  };

  const handlePayAllInvoices = () => {
    if (pendingInvoices.length === 0) return;
    const map: Record<string, number> = {};
    let total = 0;
    for (const inv of pendingInvoices) {
      map[inv.id] = inv.remainingBeforeCurrent;
      total += inv.remainingBeforeCurrent;
    }
    setAllocationsMap(map);
    setAmount(total.toFixed(2));
    setAllocationMode('AUTO_ALLOCATE');
    setAllocationMessage(`تم تخصيص كامل الرصيد المتبقي لجميع الفواتير (${total.toLocaleString()} ريال) وضبط مبلغ السند.`);
    setTimeout(() => setAllocationMessage(null), 4000);
  };

  const handleClearAllocations = () => {
    setAllocationsMap({});
    setAllocationMessage('تم إلغاء وتصفير تخصيص الفواتير.');
    setTimeout(() => setAllocationMessage(null), 2500);
  };

  const handleSingleInvoiceAllocationChange = (invoiceId: string, val: number, maxNeeded: number) => {
    const safeVal = Math.min(Math.max(0, val || 0), maxNeeded);
    setAllocationsMap(prev => ({
      ...prev,
      [invoiceId]: Math.round(safeVal * 100) / 100
    }));
  };

  const handleSettleInvoiceFull = (invoiceId: string, maxNeeded: number) => {
    setAllocationsMap(prev => ({
      ...prev,
      [invoiceId]: Math.round(maxNeeded * 100) / 100
    }));
  };

  // Duplicate check (ignoring current editing voucher)
  const isVoucherDuplicate = useMemo(() => {
    if (!voucherNumber) return false;
    const listToCheck = editingVoucherId 
      ? currentSavedList.filter(v => v.id !== editingVoucherId)
      : currentSavedList;
    return isCodeOrNumberDuplicated(voucherNumber, currentDocType, listToCheck.map(v => v.voucherNumber));
  }, [voucherNumber, currentDocType, currentSavedList, editingVoucherId]);

  // Existing voucher matching current number
  const existingVoucherByNumber = useMemo(() => {
    if (!voucherNumber) return null;
    return currentSavedList.find(v => v.voucherNumber.trim() === voucherNumber.trim()) || null;
  }, [voucherNumber, currentSavedList]);

  // Is the currently viewed or targeted voucher posted
  const isCurrentVoucherPosted = Boolean(
    (editingVoucherId && voucherStatus === 'POSTED') ||
    (!editingVoucherId && existingVoucherByNumber && existingVoucherByNumber.status === 'POSTED')
  );

  // Is the currently viewed or targeted voucher a draft
  const isCurrentVoucherDraft = !isCurrentVoucherPosted;

  const handleTypeChange = (newType: VoucherType) => {
    setType(newType);
    setEditingVoucherId(null);
    setVoucherStatus('DRAFT');
    setAllocationsMap({});
    setAllocationMode('AUTO_ALLOCATE');
    setAllocationMessage(null);
    const newDocType = newType === VoucherType.Receipt ? 'receiptVoucher' : 'paymentVoucher';
    const newList = newType === VoucherType.Receipt ? receiptVouchers : paymentVouchers;
    const nextSeq = getNextSequentialNumber(newDocType, newList.map(v => v.voucherNumber)).formatted;
    setVoucherNumber(nextSeq);
    setPartnerId('');
  };

  const handleNewVoucher = () => {
    setEditingVoucherId(null);
    setVoucherStatus('DRAFT');
    setAllocationsMap({});
    setAllocationMode('AUTO_ALLOCATE');
    setAllocationMessage(null);
    const nextSeq = getNextSequentialNumber(currentDocType, currentSavedList.map(v => v.voucherNumber)).formatted;
    setVoucherNumber(nextSeq);
    setAmount('');
    setDescription('');
    setPartnerId('');
    setAccountId(cashAndBankAccounts[0]?.id || 'acc-1101');
    setPaymentMethod('CASH');
    setReferenceNo('');
    setBankName('');
    setCheckDueDate('');
    setCostCenterId('');
  };

  const handleEdit = (v: StoredExternalVoucher) => {
    setEditingVoucherId(v.id);
    setVoucherStatus(v.status === 'POSTED' ? 'POSTED' : 'DRAFT');
    setType(v.type);
    setVoucherNumber(v.voucherNumber);
    setDate(v.date);
    setPartnerId(v.partnerId);
    setAccountId(v.accountId);
    setAmount(v.amount.toString());
    setDescription(v.description);
    setPaymentMethod(v.paymentMethod || (v.accountId === 'bank' || v.accountId.includes('bank') ? 'BANK_TRANSFER' : 'CASH'));
    setReferenceNo(v.referenceNo || '');
    setBankName(v.bankName || '');
    setCheckDueDate(v.checkDueDate || '');
    setCostCenterId(v.costCenterId || '');
    
    // Load allocations if saved
    if (v.allocations && v.allocations.length > 0) {
      const map: Record<string, number> = {};
      v.allocations.forEach(a => {
        if (a.invoiceId) map[a.invoiceId] = a.allocatedAmount;
        if (a.invoiceNumber) map[a.invoiceNumber] = a.allocatedAmount;
      });
      setAllocationsMap(map);
      setAllocationMode('AUTO_ALLOCATE');
    } else {
      setAllocationsMap({});
    }
    setAllocationMessage(null);
    setShowHistory(false);
  };

  // Chronologically sorted list of vouchers (oldest to newest) for sequential ERP browsing
  const chronologicallyOrderedVouchers = useMemo(() => {
    if (!Array.isArray(currentSavedList)) return [];
    return [...currentSavedList].sort((a, b) => {
      const dateCmp = (a.date || '').localeCompare(b.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.voucherNumber || '').localeCompare(b.voucherNumber || '', undefined, { numeric: true });
    });
  }, [currentSavedList]);

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
    const targetVoucher = currentSavedList.find(v => v.id === id);
    if (targetVoucher && targetVoucher.status === 'POSTED') {
      alert(`⚠️ لا يمكن حذف السند رقم (#${vNum}) لأنه مرحل ومعتمد بالحسابات!\n\nيجب أولاً الضغط على زر [إلغاء الترحيل] لتحويل السند إلى مسودة، ثم يمكنك حذفه.`);
      return;
    }

    if (confirm(`هل أنت متأكد من رغبتك في حذف السند رقم (${vNum}) نهائياً؟`)) {
      const updatedList = currentSavedList.filter(v => v.id !== id);
      if (isReceipt) {
        setReceiptVouchers(updatedList);
      } else {
        setPaymentVouchers(updatedList);
      }
      try {
        localStorage.setItem(currentKey, JSON.stringify(updatedList));
        applyVoucherAllocations(type);
        dispatchPartnerLedgerUpdated();
      } catch (err) {
        console.error(err);
      }
      if (editingVoucherId === id) {
        handleNewVoucher();
      }
    }
  };

  const saveVoucherWithStatus = (targetStatus: 'POSTED' | 'DRAFT'): boolean => {
    if (!partnerId) {
      alert('يرجى اختيار العميل أو المورد أولاً');
      return false;
    }
    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return false;
    }
    if (!accountId) {
      alert('يرجى تحديد حساب الخزينة أو البنك');
      return false;
    }

    const finalNumber = voucherNumber.trim() || nextCalculatedVoucherNum;
    const partner = allPartnersCombined.find(p => p.id === partnerId);
    let isPost = targetStatus === 'POSTED';
    
    const prevVoucher = editingVoucherId ? currentSavedList.find(v => v.id === editingVoucherId) : undefined;
    const nowIso = new Date().toISOString();

    // Verification against Approval Workflow (دورة الاعتماد الهرمية)
    const approvalCheck = isApprovalRequired(numAmount, systemSettings);
    let finalRequiresApproval = approvalCheck.required;
    let finalApprovalStatus = prevVoucher?.approvalStatus || (approvalCheck.required ? 'PENDING_APPROVAL' : 'NOT_REQUIRED');

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
        type,
        voucherNumber: finalNumber,
        date,
        partnerId,
        partnerName: partner?.name || 'طرف خارجي',
        accountId,
        amount: numAmount,
        description,
        createdAt: nowIso,
        status: 'DRAFT',
        requiresApproval: finalRequiresApproval,
        approvalStatus: finalApprovalStatus
      }, systemSettings);

      if (!postValidation.canPost) {
        alert(`⚠️ تنبيه دورة الاعتماد الهرمية:\n\n${postValidation.reason}\n\nتم حفظ السند كمسودة بانتظار اعتماد الإدارة المالية (المرحلة 2) ولن يتم ترحيله أو صرفه حتى يُعتمد رسمياً.`);
        targetStatus = 'DRAFT';
        isPost = false;
      }
    }

    // Prepare allocations if in allocation mode
    const finalAllocations: VoucherInvoiceAllocation[] = [];
    if (allocationMode === 'AUTO_ALLOCATE' && selectedPartner) {
      for (const inv of pendingInvoices) {
        const allocAmt = Number(allocationsMap[inv.id] ?? allocationsMap[inv.invoiceNumber] ?? 0);
        if (allocAmt > 0) {
          const newRem = Math.max(0, inv.remainingBeforeCurrent - allocAmt);
          finalAllocations.push({
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            invoiceType: isReceipt ? 'SALES' : 'PURCHASE',
            allocatedAmount: allocAmt,
            invoiceTotal: inv.grandTotal,
            previousRemaining: inv.remainingBeforeCurrent,
            newRemaining: newRem,
            date: inv.date,
            dueDate: inv.dueDate
          });
        }
      }
    }

    const voucherData: StoredExternalVoucher = {
      id: editingVoucherId || Date.now().toString(),
      type,
      voucherNumber: finalNumber,
      date,
      partnerId,
      partnerName: partner?.name || 'طرف خارجي',
      partnerType: partner?.type || (isReceipt ? 'CUSTOMER' : 'VENDOR'),
      accountId,
      amount: numAmount,
      status: targetStatus,
      postedAt: isPost ? (prevVoucher?.postedAt || nowIso) : undefined,
      description: description.trim() || (isReceipt ? `سند قبض نقدي من ${partner?.name || 'طرف خارجي'}` : `سند صرف نقدي إلى ${partner?.name || 'طرف خارجي'}`),
      createdAt: prevVoucher?.createdAt || nowIso,
      paymentMethod,
      referenceNo: referenceNo.trim() || undefined,
      bankName: bankName.trim() || undefined,
      checkDueDate: checkDueDate.trim() || undefined,
      costCenterId: costCenterId.trim() || undefined,
      costCenterName: selectedCostCenter ? selectedCostCenter.name : undefined,
      allocations: finalAllocations.length > 0 ? finalAllocations : undefined,
      requiresApproval: finalRequiresApproval,
      approvalStatus: finalApprovalStatus,
      approvedBy: prevVoucher?.approvedBy,
      approvedAt: prevVoucher?.approvedAt,
      approvalRole: prevVoucher?.approvalRole,
      approvalNotes: prevVoucher?.approvalNotes,
      rejectedBy: prevVoucher?.rejectedBy,
      rejectedAt: prevVoucher?.rejectedAt,
      rejectionReason: prevVoucher?.rejectionReason
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
      applyVoucherAllocations(type);
      dispatchPartnerLedgerUpdated();
    } catch (err) {
      console.error(err);
    }

    setEditingVoucherId(voucherData.id);
    setVoucherStatus(targetStatus);

    if (isPost) {
      alert(`✅ تم ترحيل ${isReceipt ? 'سند القبض' : 'سند الصرف'} رقم (${finalNumber}) بنجاح بقيمة ${numAmount.toLocaleString()} ${currencySymbol}!\n\nتم ترحيل السند رسمياً في حساب (${partner?.name}) وتحديث الرصيد ودفتر الأستاذ.`);
    } else {
      if (finalRequiresApproval && finalApprovalStatus === 'PENDING_APPROVAL') {
        alert(`📝 تم حفظ ${isReceipt ? 'سند القبض' : 'سند الصرف'} رقم (${finalNumber}) كمسودة بانتظار الاعتماد!\n\n⚠️ يتطلب السند موافقة الإدارة المالية لاعتماده قبل إمكانية الترحيل والصرف الفعلي.`);
      } else {
        alert(`📝 تم حفظ ${isReceipt ? 'سند القبض' : 'سند الصرف'} رقم (${finalNumber}) كمسودة (غير مرحل) بنجاح!\n\nلم يتأثر حساب (${partner?.name}) ويمكنك مراجعته والضغط على [ترحيل السند] في أي وقت لترحيله يدوياً.`);
      }
    }

    return true;
  };

  const handlePostCurrentVoucher = () => {
    const targetVoucher = editingVoucherId 
      ? currentSavedList.find(v => v.id === editingVoucherId)
      : existingVoucherByNumber;

    if (targetVoucher) {
      const postValidation = canVoucherBePosted(targetVoucher, systemSettings);
      if (!postValidation.canPost) {
        alert(`⚠️ لا يمكن ترحيل وصرف السند حالياً:\n\n${postValidation.reason}\n\nيجب مراجعة واعتماد السند أولاً من الإدارة المالية.`);
        return;
      }

      if (targetVoucher.status === 'DRAFT') {
        const res = setVoucherPostingStatus(targetVoucher.id, targetVoucher.type, 'POSTED');
        if (res.success) {
          setEditingVoucherId(targetVoucher.id);
          setVoucherStatus('POSTED');
          const updated = currentSavedList.map(v => 
            v.id === targetVoucher.id ? { ...v, status: 'POSTED' as const, postedAt: res.postedAt } : v
          );
          if (isReceipt) {
            setReceiptVouchers(updated);
          } else {
            setPaymentVouchers(updated);
          }
          alert(`✅ تم ترحيل السند رقم (#${targetVoucher.voucherNumber}) بنجاح إلى حساب (${targetVoucher.partnerName}) وتحديث الرصيد ودفتر الأستاذ!`);
          return;
        }
      }
    } else {
      saveVoucherWithStatus('POSTED');
    }
  };

  const handleApproveCurrent = (notes?: string) => {
    const targetId = editingVoucherId || existingVoucherByNumber?.id;
    if (!targetId) {
      // Auto save as draft first
      const saved = saveVoucherWithStatus('DRAFT');
      if (!saved) return;
      const freshList = isReceipt ? loadStoredVouchers(DB_RECEIPT_VOUCHERS_KEY) : loadStoredVouchers(DB_PAYMENT_VOUCHERS_KEY);
      const created = freshList.find(v => v.voucherNumber.toLowerCase() === voucherNumber.trim().toLowerCase());
      if (created) {
        approveVoucherRecord(created.id, type, { notes });
        const reloaded = isReceipt ? loadStoredVouchers(DB_RECEIPT_VOUCHERS_KEY) : loadStoredVouchers(DB_PAYMENT_VOUCHERS_KEY);
        if (isReceipt) setReceiptVouchers(reloaded);
        else setPaymentVouchers(reloaded);
        alert('✅ تم اعتماد السند بنجاح من الإدارة المالية! أصبح السند الآن جاهزاً للترحيل والصرف الفعلي.');
      }
      return;
    }

    const res = approveVoucherRecord(targetId, type, { notes });
    if (res.success) {
      const freshList = loadStoredVouchers(currentKey);
      if (isReceipt) setReceiptVouchers(freshList);
      else setPaymentVouchers(freshList);
      alert('✅ تم اعتماد السند بنجاح من الإدارة المالية! أصبح السند الآن جاهزاً للترحيل والصرف الفعلي.');
    } else {
      alert(res.message);
    }
  };

  const handleRejectCurrent = (reason: string) => {
    const targetId = editingVoucherId || existingVoucherByNumber?.id;
    if (!targetId) {
      alert('يرجى حفظ السند كمسودة أولاً قبل الرفض.');
      return;
    }
    const res = rejectVoucherRecord(targetId, type, { reason });
    if (res.success) {
      const freshList = loadStoredVouchers(currentKey);
      if (isReceipt) setReceiptVouchers(freshList);
      else setPaymentVouchers(freshList);
      alert('⚠️ تم تسجيل رفض السند وإعادته للمحاسب مع توثيق سبب الرفض.');
    } else {
      alert(res.message);
    }
  };

  const handleUnpostCurrentVoucher = () => {
    const targetVoucher = editingVoucherId 
      ? currentSavedList.find(v => v.id === editingVoucherId)
      : existingVoucherByNumber;

    if (!targetVoucher && !editingVoucherId) {
      alert('يرجى تحديد السند المراد إلغاء ترحيله أولاً.');
      return;
    }

    const docNum = targetVoucher ? targetVoucher.voucherNumber : voucherNumber;
    const pName = targetVoucher ? targetVoucher.partnerName : (selectedPartner?.name || 'الطرف');

    if (!confirm(`هل أنت متأكد من رغبتك في إلغاء ترحيل السند رقم (#${docNum})؟\n\n⚠️ سيتم إلغاء تأثيره المحاسبي فوراً من حساب (${pName}) وتحديث الرصيد ودفتر الأستاذ وإعادة السند إلى وضع المسودة (غير مرحل).`)) {
      return;
    }

    if (targetVoucher) {
      const res = setVoucherPostingStatus(targetVoucher.id, targetVoucher.type, 'DRAFT');
      if (res.success) {
        setEditingVoucherId(targetVoucher.id);
        setVoucherStatus('DRAFT');
        const updated = currentSavedList.map(v => 
          v.id === targetVoucher.id ? { ...v, status: 'DRAFT' as const, postedAt: undefined } : v
        );
        if (isReceipt) {
          setReceiptVouchers(updated);
        } else {
          setPaymentVouchers(updated);
        }
        alert(`📝 تم إلغاء ترحيل السند رقم (#${docNum}) بنجاح وإعادته كمسودة (غير مرحل)!\n\nتم إيقاف الأثر المالي فوراً وتحديث كشف حساب (${pName}) ودفتر الأستاذ.`);
      }
    } else {
      saveVoucherWithStatus('DRAFT');
    }
  };

  const handleTogglePostingFromList = (voucher: StoredExternalVoucher) => {
    const currentStatus: 'POSTED' | 'DRAFT' = voucher.status || 'POSTED';
    const targetStatus: 'POSTED' | 'DRAFT' = currentStatus === 'POSTED' ? 'DRAFT' : 'POSTED';
    
    if (currentStatus === 'POSTED') {
      if (!confirm(`هل أنت متأكد من رغبتك في إلغاء ترحيل السند رقم (#${voucher.voucherNumber}) وإعادته كمسودة؟\nسيتم إيقاف تأثيره المحاسبي على حساب (${voucher.partnerName}).`)) {
        return;
      }
    } else {
      // Check approval requirements before allowing posting
      const postValidation = canVoucherBePosted(voucher, systemSettings);
      if (!postValidation.canPost) {
        alert(`⚠️ لا يمكن ترحيل وصرف هذا السند:\n\n${postValidation.reason}\n\nيجب اعتماد السند أولاً من الإدارة المالية.`);
        return;
      }
    }

    const res = setVoucherPostingStatus(voucher.id, voucher.type, targetStatus);
    if (res.success) {
      if (editingVoucherId === voucher.id) {
        setVoucherStatus(targetStatus);
      }
      const updated: StoredExternalVoucher[] = currentSavedList.map(v => 
        v.id === voucher.id ? { ...v, status: targetStatus, postedAt: res.postedAt } : v
      );
      if (isReceipt) {
        setReceiptVouchers(updated);
      } else {
        setPaymentVouchers(updated);
      }
      if (targetStatus === 'POSTED') {
        alert(`✅ تم ترحيل السند رقم (#${voucher.voucherNumber}) بنجاح إلى حساب (${voucher.partnerName})!`);
      } else {
        alert(`📝 تم إلغاء ترحيل السند رقم (#${voucher.voucherNumber}) وتحويله إلى مسودة.`);
      }
    }
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    const statusToSave = (editingVoucherId && voucherStatus === 'POSTED') ? 'POSTED' : 'DRAFT';
    saveVoucherWithStatus(statusToSave);
  };

  const currentPreviewObject: PrintPreviewData = useMemo(() => ({
    title: isReceipt ? 'سند قبض مالي' : 'سند صرف مالي',
    subtitle: isReceipt ? 'سند استلام نقدية من طرف خارجي' : 'سند دفع نقدية لطرف خارجي',
    docNumber: voucherNumber,
    date: date,
    partnerName: selectedPartner?.name || 'طرف خارجي غير محدد',
    partnerType: selectedPartner?.type || (isReceipt ? 'CUSTOMER' : 'VENDOR'),
    paymentMethod: paymentMethod === 'BANK_TRANSFER'
      ? `تحويل بنكي ${bankName ? '(' + bankName + ')' : ''} ${referenceNo ? 'مرجع: ' + referenceNo : ''}`
      : paymentMethod === 'CHECK'
        ? `شيك مصرفي ${bankName ? '(' + bankName + ')' : ''} ${referenceNo ? 'رقم: ' + referenceNo : ''} ${checkDueDate ? 'استحقاق: ' + checkDueDate : ''}`
        : paymentMethod === 'SPAN'
          ? `شبكة / مدى ${referenceNo ? 'عملية #' + referenceNo : ''}`
          : `${getAccountDisplay(accountId)} (نقداً)`,
    notes: description,
    grandTotal: Number(amount) || 0,
    subtotal: Number(amount) || 0,
    amount: Number(amount) || 0,
    paidAmount: Number(amount) || 0,
    remainingAmount: balanceSimulation ? Math.abs(balanceSimulation.projectedNet) : 0,
    remainingBalance: balanceSimulation ? Math.abs(balanceSimulation.projectedNet) : 0,
    voucherType: isReceipt ? 'RECEIPT' : 'PAYMENT',
    amountInWords: tafqeet(Number(amount) || 0),
    allocatedInvoices: pendingInvoices
      .filter(inv => (allocationsMap[inv.id] ?? allocationsMap[inv.invoiceNumber] ?? 0) > 0)
      .map(inv => {
        const alloc = allocationsMap[inv.id] ?? allocationsMap[inv.invoiceNumber] ?? 0;
        return {
          invoiceNumber: inv.invoiceNumber,
          allocatedAmount: alloc,
          invoiceTotal: inv.grandTotal,
          remainingBalance: Math.max(0, inv.remainingBeforeCurrent - alloc),
          date: inv.date,
          dueDate: inv.dueDate
        };
      }),
    items: [{
      description: description || (isReceipt ? 'مقبوضات نقدية' : 'مدفوعات نقدية'),
      quantity: 1,
      unitPrice: Number(amount) || 0,
      taxRate: 0,
      total: Number(amount) || 0
    }]
  }), [isReceipt, voucherNumber, date, selectedPartner, paymentMethod, bankName, referenceNo, checkDueDate, accountId, description, amount, balanceSimulation, tafqeet, pendingInvoices, allocationsMap]);

  const currentActiveVoucher = useMemo(() => {
    return editingVoucherId
      ? currentSavedList.find(v => v.id === editingVoucherId)
      : existingVoucherByNumber;
  }, [editingVoucherId, currentSavedList, existingVoucherByNumber]);

  const voucherForStepper: StoredVoucherRecord = useMemo(() => {
    if (currentActiveVoucher) return currentActiveVoucher;
    const numAmount = Number(amount) || 0;
    const req = isApprovalRequired(numAmount, systemSettings);
    return {
      id: 'current-draft',
      type,
      voucherNumber: voucherNumber || 'جديد',
      date,
      partnerId,
      partnerName: selectedPartner?.name || 'طرف خارجي',
      accountId,
      amount: numAmount,
      description,
      status: voucherStatus,
      createdAt: new Date().toISOString(),
      requiresApproval: req.required,
      approvalStatus: req.required ? 'PENDING_APPROVAL' : 'NOT_REQUIRED'
    };
  }, [currentActiveVoucher, amount, systemSettings, type, voucherNumber, date, partnerId, selectedPartner, accountId, description, voucherStatus]);

  return (
    <div className="flex flex-col flex-1">
      {/* Page Header */}
      {/* Top Application Bar */}
      <div className="flex flex-col gap-3 mb-4 print:hidden">
        {/* Breadcrumb & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2 mb-1 text-slate-500 text-xs font-bold">
              <span>الخزينة والمالية</span>
              <span>/</span>
              <span className="text-slate-800 font-extrabold">سندات القبض والصرف</span>
              <span>/</span>
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">
                مترابط مع الحسابات
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800">
                {isReceipt ? 'سند قبض خارجي (استلام نقدية)' : 'سند صرف خارجي (دفع نقدية)'}
              </h2>
              <span className={`text-xs sm:text-sm font-black px-2.5 py-1 rounded-lg font-mono border shadow-2xs ${
                isReceipt ? 'text-emerald-950 bg-emerald-50 border-emerald-200' : 'text-rose-950 bg-rose-50 border-rose-200'
              }`}>
                سند رقم: #{voucherNumber}
              </span>
              {editingVoucherId ? (
                voucherStatus === 'POSTED' ? (
                  <span className="text-xs bg-emerald-50 text-emerald-950 px-2.5 py-1 rounded-lg font-black border border-emerald-300 flex items-center gap-1 shadow-2xs">
                    <CheckCircle2 size={13} className="text-emerald-700" /> مرحل بالحسابات
                  </span>
                ) : (
                  <span className="text-xs bg-amber-50 text-amber-950 px-2.5 py-1 rounded-lg font-black border border-amber-300 flex items-center gap-1 shadow-2xs">
                    <AlertTriangle size={13} className="text-amber-700" /> مسودة (غير مرحل)
                  </span>
                )
              ) : (
                <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-bold border border-slate-300">
                  سند جديد
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
                  <span className="text-emerald-700 font-sans font-bold">سند جديد +</span>
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

            {/* 3D Voucher History */}
            <button 
              type="button" 
              onClick={() => setShowHistory(!showHistory)} 
              className={`btn-3d h-9 sm:h-10 px-2.5 sm:px-3 text-xs font-black ${
                showHistory ? 'btn-3d-active' : 'btn-3d-white'
              }`}
            >
              <History size={14} className={showHistory ? 'text-indigo-200' : 'text-indigo-600'} />
              <span>سجل السندات ({currentSavedList.length})</span>
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
              className="btn-3d btn-3d-blue h-9 sm:h-10 px-2.5 sm:px-3.5 text-xs font-black"
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

            {/* Print & Preview 3D Controls */}
            <div className="flex items-center gap-1.5 border-r border-slate-300/80 pr-2 mr-0.5">
              <button
                type="button"
                onClick={() => {
                  setCustomPreviewData(null);
                  setShowPrintPreview(true);
                }}
                className="btn-3d btn-3d-slate h-9 sm:h-10 px-2.5 sm:px-3 text-xs font-black"
                title="معاينة السند قبل الطباعة"
              >
                <Eye size={14} />
                <span className="hidden sm:inline">معاينة السند</span>
                <span className="sm:hidden">معاينة</span>
              </button>

              <PrintDropdown 
                onPreview={() => {
                  setCustomPreviewData(null);
                  setShowPrintPreview(true);
                }}
              />
            </div>

            {/* 3D Approval Center Button */}
            {systemSettings?.approvalWorkflow?.enabled && (
              <button
                type="button"
                onClick={() => setShowApprovalCenterModal(true)}
                className="btn-3d btn-3d-indigo h-9 sm:h-10 px-2.5 sm:px-3 text-xs font-black flex items-center gap-1.5 shadow-sm relative"
                title="مركز دورة الموافقات والاعتماد الهرمية للسندات الكبيرة"
              >
                <ShieldCheck size={15} className="text-indigo-200" />
                <span className="hidden sm:inline">مركز الاعتمادات</span>
                <span className="sm:hidden">الاعتمادات</span>
                {pendingApprovalsCount > 0 && (
                  <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-1.5 py-0.5 rounded-full shadow-xs animate-bounce" title={`${pendingApprovalsCount} سند بانتظار الاعتماد`}>
                    {pendingApprovalsCount}
                  </span>
                )}
              </button>
            )}

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
          </div>
        </div>
      </div>

      {/* Tabs - Only shown when not in dedicated fixed mode */}
      {!fixedType && (
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
      )}

      {/* Collapsible History Drawer */}
      {showHistory && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-4 shadow-sm animate-in fade-in duration-150 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <History size={16} className={isReceipt ? 'text-emerald-600' : 'text-red-600'} />
              <h3 className="font-bold text-slate-800 text-sm">
                سجل {isReceipt ? 'سندات القبض' : 'سندات الصرف'} المسجلة
              </h3>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">{currentSavedList.length} سندات</span>
            </div>

            {/* فلتر حالة الترحيل */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setHistoryPostingFilter('ALL')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  historyPostingFilter === 'ALL'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل ({currentSavedList.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryPostingFilter('POSTED')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                  historyPostingFilter === 'POSTED'
                    ? 'bg-white text-emerald-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span>المرحلة ({currentSavedList.filter(v => v.status === 'POSTED').length})</span>
              </button>
              <button
                type="button"
                onClick={() => setHistoryPostingFilter('DRAFT')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                  historyPostingFilter === 'DRAFT'
                    ? 'bg-white text-amber-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-amber-700'
                }`}
              >
                <AlertTriangle size={12} className="text-amber-600" />
                <span>المسودات ({currentSavedList.filter(v => v.status === 'DRAFT' || !v.status).length})</span>
              </button>
            </div>

            {/* Quick Export in History */}
            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1 transition-colors cursor-pointer"
              title="تصدير كشف السندات الحالية إلى Excel (.xlsx) أو CSV أو PDF"
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
          {currentSavedList.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">لا توجد سندات محفوظة بعد. السند القادم سيبدأ برقم #{nextCalculatedVoucherNum}.</p>
          ) : (
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400">
                    <th className="pb-2 font-semibold">رقم السند</th>
                    <th className="pb-2 font-semibold">الطرف والحساب</th>
                    <th className="pb-2 font-semibold">حساب الخزينة/البنك</th>
                    <th className="pb-2 font-semibold">مركز التكلفة</th>
                    <th className="pb-2 font-semibold">المبلغ</th>
                    <th className="pb-2 font-semibold">التاريخ</th>
                    <th className="pb-2 font-semibold">البيان</th>
                    <th className="pb-2 font-semibold text-center">الفواتير المسواة</th>
                    <th className="pb-2 font-semibold text-center">حالة الترحيل</th>
                    {systemSettings?.approvalWorkflow?.enabled && (
                      <th className="pb-2 font-semibold text-center">دورة الاعتماد</th>
                    )}
                    <th className="pb-2 font-semibold text-center">الإجراءات والترحيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {currentSavedList
                    .filter(v => {
                      if (historyPostingFilter === 'POSTED') return v.status === 'POSTED';
                      if (historyPostingFilter === 'DRAFT') return v.status === 'DRAFT' || !v.status;
                      return true;
                    })
                    .map(v => {
                    const matchedPartner = allPartnersCombined.find(p => p.id === v.partnerId || p.name === v.partnerName);
                    const isPosted = v.status === 'POSTED';
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
                        <td className="py-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-slate-700 font-semibold text-xs">{getAccountDisplay(v.accountId)}</span>
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
                                  <span>مدى / شبكة {v.referenceNo ? `#${v.referenceNo}` : ''}</span>
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
                        <td className="py-2 font-mono font-bold text-slate-800">{v.amount.toLocaleString()} {currencySymbol}</td>
                        <td className="py-2 text-slate-500 font-mono">{v.date}</td>
                        <td className="py-2 text-slate-500 truncate max-w-xs">{v.description}</td>
                        <td className="py-2 text-center">
                          {v.allocations && v.allocations.length > 0 ? (
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 cursor-help"
                              title={v.allocations.map(a => `فاتورة #${a.invoiceNumber} (${a.allocatedAmount.toLocaleString()} ${currencySymbol})`).join('\n')}
                            >
                              <Layers size={11} className="text-indigo-600" />
                              <span>{v.allocations.length} {v.allocations.length === 1 ? 'فاتورة' : 'فواتير'}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">دفعة على الحساب</span>
                          )}
                        </td>
                        <td className="py-2 text-center">
                          {isPosted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 size={11} className="text-emerald-600" />
                              <span>مرحل بالحسابات</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <AlertTriangle size={11} className="text-amber-600" />
                              <span>مسودة (غير مرحل)</span>
                            </span>
                          )}
                        </td>
                        {systemSettings?.approvalWorkflow?.enabled && (
                          <td className="py-2 text-center">
                            {v.approvalStatus === 'APPROVED' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title={`معتمد بواسطة: ${v.approvedBy || 'المدير المالي'}\n${v.approvedAt ? new Date(v.approvedAt).toLocaleDateString('ar-SA') : ''}`}>
                                <Stamp size={11} className="text-emerald-600" />
                                <span>معتمد</span>
                              </span>
                            ) : v.approvalStatus === 'PENDING_APPROVAL' ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                                  <ShieldCheck size={11} className="text-amber-600" />
                                  <span>بانتظار الاعتماد</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const res = approveVoucherRecord(v.id, v.type);
                                    if (res.success) {
                                      const fresh = loadStoredVouchers(currentKey);
                                      if (isReceipt) setReceiptVouchers(fresh);
                                      else setPaymentVouchers(fresh);
                                      alert('✅ تم اعتماد السند بنجاح!');
                                    }
                                  }}
                                  className="text-[9px] bg-indigo-600 hover:bg-indigo-700 text-white font-black px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                                  title="اعتماد فوري من الإدارة المالية"
                                >
                                  اعتماد فوري
                                </button>
                              </div>
                            ) : v.approvalStatus === 'REJECTED' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200" title={`سبب الرفض: ${v.rejectionReason || 'غير محدد'}`}>
                                <X size={11} className="text-rose-600" />
                                <span>مرفوض</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium">غير مشروط</span>
                            )}
                          </td>
                        )}
                        <td className="py-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* زر الترحيل المباشر أو إلغاء الترحيل من الجدول */}
                            {!isPosted ? (
                              <button
                                type="button"
                                onClick={() => handleTogglePostingFromList(v)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-black shadow-xs transition-colors cursor-pointer"
                                title="ترحيل السند فوراً لحساب الطرف وتحديث الرصيد"
                              >
                                <CheckCircle2 size={12} />
                                <span>ترحيل السند</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleTogglePostingFromList(v)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded text-[11px] font-black transition-colors cursor-pointer shadow-2xs"
                                title="إلغاء ترحيل هذا السند فوراً وإعادته كمسودة (غير مرحل)"
                              >
                                <RotateCcw size={12} className="text-amber-700" />
                                <span>إلغاء الترحيل</span>
                              </button>
                            )}

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
                                const matchedPartnerStmt = matchedPartner ? getPartnerAccountStatement(matchedPartner) : null;
                                const remainingVal = matchedPartnerStmt ? Math.abs(matchedPartnerStmt.netBalance) : 0;

                                const methodLabel = v.paymentMethod === 'BANK_TRANSFER'
                                  ? `تحويل بنكي ${v.bankName ? '(' + v.bankName + ')' : ''} ${v.referenceNo ? 'مرجع: ' + v.referenceNo : ''}`
                                  : v.paymentMethod === 'CHECK'
                                    ? `شيك مصرفي ${v.bankName ? '(' + v.bankName + ')' : ''} ${v.referenceNo ? 'رقم: ' + v.referenceNo : ''} ${v.checkDueDate ? 'تاريخ الاستحقاق: ' + v.checkDueDate : ''}`
                                    : v.paymentMethod === 'SPAN'
                                      ? `شبكة / مدى ${v.referenceNo ? 'عملية #' + v.referenceNo : ''}`
                                      : `${getAccountDisplay(v.accountId)} (نقداً)`;

                                setCustomPreviewData({
                                  title: isReceipt ? 'سند قبض مالي معتمد' : 'سند صرف مالي معتمد',
                                  subtitle: isReceipt ? 'سند استلام نقدية من طرف خارجي ومرحل بالحسابات' : 'سند دفع نقدية لطرف خارجي ومرحل بالحسابات',
                                  docNumber: v.voucherNumber,
                                  date: v.date,
                                  partnerName: v.partnerName,
                                  partnerType: (matchedPartner?.type || v.partnerType || (isReceipt ? 'CUSTOMER' : 'VENDOR')),
                                  paymentMethod: methodLabel,
                                  notes: v.description,
                                  grandTotal: v.amount,
                                  subtotal: v.amount,
                                  amount: v.amount,
                                  paidAmount: v.amount,
                                  remainingAmount: remainingVal,
                                  remainingBalance: remainingVal,
                                  voucherType: isReceipt ? 'RECEIPT' : 'PAYMENT',
                                  amountInWords: tafqeet(v.amount),
                                  allocatedInvoices: v.allocations?.map(a => ({
                                    invoiceNumber: a.invoiceNumber,
                                    allocatedAmount: a.allocatedAmount,
                                    invoiceTotal: a.invoiceTotal,
                                    remainingBalance: a.newRemaining,
                                    date: a.date,
                                    dueDate: a.dueDate
                                  })),
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
                              disabled={isPosted}
                              onClick={() => handleDelete(v.id, v.voucherNumber)}
                              className={`flex items-center gap-0.5 px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                                isPosted
                                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50'
                                  : 'bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer'
                              }`}
                              title={isPosted ? 'السند مرحل بالحسابات. يجب إلغاء الترحيل أولاً لحذفه' : 'حذف السند'}
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
          
          {/* Approval Workflow & Status Stepper (دورة الاعتماد والموافقات الهرمية) */}
          {systemSettings?.approvalWorkflow?.enabled && (
            <VoucherApprovalStepper
              voucher={voucherForStepper}
              systemSettings={systemSettings}
              onApprove={handleApproveCurrent}
              onReject={handleRejectCurrent}
              onPost={handlePostCurrentVoucher}
              onUnpost={handleUnpostCurrentVoucher}
            />
          )}

          {/* Top Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-6 border-b border-slate-200 bg-slate-100/90 print:bg-transparent print:p-0 print:mb-6">
            
            {/* Voucher Number */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase text-slate-800 tracking-wide">رقم السند</label>
                <span className="text-[10px] bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md font-black border border-blue-300">تسلسلي تلقائي فريد</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleNavigatePrevious}
                  disabled={!canGoPrevious}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  title="تراجع للخلف (السابق)"
                >
                  <ChevronRight size={14} />
                </button>
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    required 
                    value={voucherNumber} 
                    onChange={e => setVoucherNumber(e.target.value)} 
                    disabled={isCurrentVoucherPosted}
                    className={`w-full border-2 p-2.5 rounded-xl text-sm focus:outline-none font-mono font-black text-center shadow-2xs ${
                      isVoucherDuplicate 
                        ? 'border-red-500 text-red-700 bg-red-50/60' 
                        : isCurrentVoucherPosted
                          ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'
                          : 'border-slate-300 focus:border-blue-600 text-slate-900 bg-white'
                    }`} 
                  />
                  {!isCurrentVoucherPosted && (
                    <button
                      type="button"
                      onClick={() => setVoucherNumber(nextCalculatedVoucherNum)}
                      title="تطبيق الرقم التسلسلي التالي تلقائياً"
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-blue-700 hover:text-blue-900 bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded-lg font-black transition-colors cursor-pointer border border-blue-200"
                    >
                      #{nextCalculatedVoucherNum}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleNavigateNext}
                  disabled={!canGoNext}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  title="تقديم للأمام (التالي)"
                >
                  <ChevronLeft size={14} />
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
                disabled={isCurrentVoucherPosted}
                className={`border-2 p-2.5 rounded-xl text-sm font-bold shadow-2xs focus:outline-none focus:border-blue-600 ${
                  isCurrentVoucherPosted ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'border-slate-300 text-slate-800 bg-white'
                }`} 
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
                    disabled={isCurrentVoucherPosted}
                    className="text-indigo-700 hover:text-indigo-900 font-bold hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {partnerFilterCategory === 'ALL' ? 'تصفية تلقائية' : 'عرض كافة الأطراف'}
                  </button>
                </div>
              </div>

              <select 
                required 
                value={partnerId} 
                onChange={e => setPartnerId(e.target.value)} 
                disabled={isCurrentVoucherPosted}
                className={`border-2 p-2.5 rounded-xl text-sm focus:outline-none font-bold shadow-2xs ${
                  isCurrentVoucherPosted
                    ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                    : isReceipt 
                      ? 'border-emerald-300 focus:border-emerald-600 bg-white text-slate-900' 
                      : 'border-rose-300 focus:border-rose-600 bg-white text-slate-900'
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
                    {isReceipt ? '+' : '-'} {balanceSimulation.voucherImpact.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                  </span>
                  <span className="text-[10px] text-slate-500">{isReceipt ? 'مقبوضات تسدد الحساب' : 'مدفوعات تصرف للطرف'}</span>
                </div>

                <span className="text-slate-300 font-light text-xl hidden sm:inline">←</span>

                {/* Projected New Balance */}
                <div className="flex flex-col bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-indigo-600 font-bold">الرصيد المتوقع بعد الترحيل:</span>
                  <span className="font-bold font-mono text-indigo-700 text-sm">
                    {balanceSimulation.projectedNetFormatted} {currencySymbol}
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
          <div className="p-6 bg-white print:p-0 print:mb-6 flex flex-col gap-6">
            
            {/* Row 1: Account, Payment Method & Amount */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black uppercase text-slate-800 tracking-wide flex items-center justify-between">
                  <span>حساب الصندوق / البنك <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-bold">دليل الحسابات</span>
                </label>
                <select 
                  required 
                  value={accountId} 
                  onChange={e => setAccountId(e.target.value)} 
                  disabled={isCurrentVoucherPosted}
                  className={`border-2 p-2.5 rounded-xl text-sm font-bold focus:outline-none focus:border-blue-600 shadow-2xs ${
                    isCurrentVoucherPosted ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'border-slate-300 text-slate-900 bg-white'
                  }`}
                >
                  {cashAndBankAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      [{acc.code}] {acc.name}
                    </option>
                  ))}
                  {/* Backward compatibility */}
                  {accountId === 'cash' && <option value="cash">الصندوق الرئيسي (الخزينة النقدية)</option>}
                  {accountId === 'bank' && <option value="bank">البنك الأهلي السعودي (حساب جاري)</option>}
                </select>
              </div>

              {/* Payment Method Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black uppercase text-slate-800 tracking-wide">طريقة السداد / التحصيل</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    disabled={isCurrentVoucherPosted}
                    onClick={() => setPaymentMethod('CASH')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      paymentMethod === 'CASH'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Banknote size={14} />
                    <span>نقداً</span>
                  </button>

                  <button
                    type="button"
                    disabled={isCurrentVoucherPosted}
                    onClick={() => setPaymentMethod('BANK_TRANSFER')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      paymentMethod === 'BANK_TRANSFER'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Landmark size={14} />
                    <span>تحويل بنكي</span>
                  </button>

                  <button
                    type="button"
                    disabled={isCurrentVoucherPosted}
                    onClick={() => setPaymentMethod('CHECK')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      paymentMethod === 'CHECK'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <FileText size={14} />
                    <span>شيك</span>
                  </button>

                  <button
                    type="button"
                    disabled={isCurrentVoucherPosted}
                    onClick={() => setPaymentMethod('SPAN')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      paymentMethod === 'SPAN'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CreditCard size={14} />
                    <span>شبكة / مدى</span>
                  </button>
                </div>
              </div>

              {/* Amount */}
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
                  disabled={isCurrentVoucherPosted}
                  placeholder="0.00" 
                  className={`border-2 p-2.5 rounded-xl text-base focus:outline-none font-mono text-left font-black shadow-2xs ${
                    isCurrentVoucherPosted
                      ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                      : isReceipt 
                        ? 'border-emerald-400 focus:border-emerald-600 text-emerald-950 bg-white' 
                        : 'border-rose-400 focus:border-rose-600 text-rose-950 bg-white'
                  }`} 
                  dir="ltr" 
                />
                <div className="text-[11px] font-bold text-slate-600 flex flex-wrap items-baseline gap-1 mt-0.5">
                  <span className="text-slate-500">المبلغ كتابة:</span>
                  <span className="text-slate-900 font-black">({tafqeet(Number(amount) || 0)})</span>
                </div>
              </div>
            </div>

            {/* Row 2: Conditional Payment Method Metadata */}
            {paymentMethod !== 'CASH' && (
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/90 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fadeIn">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Hash size={13} className="text-indigo-600" />
                    <span>
                      {paymentMethod === 'BANK_TRANSFER' ? 'رقم الحوالة / المرجع البنكي' : paymentMethod === 'CHECK' ? 'رقم الشيك المصرفي' : 'رقم إيصال العملية / البطاقة'}
                    </span>
                  </label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={e => setReferenceNo(e.target.value)}
                    disabled={isCurrentVoucherPosted}
                    placeholder={paymentMethod === 'CHECK' ? 'مثال: CHQ-98214' : 'مثال: TRF-2024-001'}
                    className="border border-slate-300 p-2 rounded-xl text-sm font-mono font-bold focus:outline-none focus:border-blue-600 bg-white"
                  />
                </div>

                {(paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CHECK') && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Landmark size={13} className="text-indigo-600" />
                      <span>{paymentMethod === 'CHECK' ? 'اسم البنك المسحوب عليه الشيك' : 'اسم البنك المحول منه'}</span>
                    </label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                      disabled={isCurrentVoucherPosted}
                      placeholder="مثال: مصرف الراجحي / البنك الأهلي"
                      className="border border-slate-300 p-2 rounded-xl text-sm font-bold focus:outline-none focus:border-blue-600 bg-white"
                    />
                  </div>
                )}

                {paymentMethod === 'CHECK' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Calendar size={13} className="text-amber-600" />
                      <span>تاريخ استحقاق وصرف الشيك</span>
                    </label>
                    <input
                      type="date"
                      value={checkDueDate}
                      onChange={e => setCheckDueDate(e.target.value)}
                      disabled={isCurrentVoucherPosted}
                      className="border border-slate-300 p-2 rounded-xl text-sm font-mono font-bold focus:outline-none focus:border-blue-600 bg-white"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Row 3: Cost Center, Balance & Description */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Cost Center Selector */}
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-black uppercase text-slate-800 tracking-wide flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 size={13} className="text-indigo-600" />
                    <span>مركز التكلفة (Cost Center)</span>
                  </span>
                  <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-bold border border-indigo-200">
                    ربط المشاريع والفروع
                  </span>
                </label>
                <select
                  value={costCenterId}
                  onChange={e => setCostCenterId(e.target.value)}
                  disabled={isCurrentVoucherPosted}
                  className={`border-2 p-2.5 rounded-xl text-sm font-bold focus:outline-none focus:border-indigo-600 shadow-2xs ${
                    isCurrentVoucherPosted ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'border-slate-300 text-slate-900 bg-white'
                  }`}
                >
                  <option value="">-- بدون تحديد مركز تكلفة (عام) --</option>
                  {costCenters.map(cc => (
                    <option key={cc.id} value={cc.id}>
                      [{cc.code}] {cc.name} - ({getCostCenterTypeLabel(cc.type)})
                    </option>
                  ))}
                </select>
                {selectedCostCenter && (
                  <div className="text-[11px] text-slate-600 flex items-center justify-between bg-indigo-50/70 px-2.5 py-1 rounded-lg border border-indigo-100">
                    <span className="font-bold text-indigo-900">المسؤول: {selectedCostCenter.manager || 'غير محدد'}</span>
                    <span className="font-mono text-indigo-700">الميزانية: {selectedCostCenter.budget?.toLocaleString() || 0} {currencyFullNameAr}</span>
                  </div>
                )}
              </div>

              {/* المبلغ المتبقي */}
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-black uppercase text-slate-800 tracking-wide flex items-center justify-between">
                  <span>المبلغ المتبقي ({currencyFullNameAr})</span>
                  {balanceSimulation && (
                    <span className="text-[11px] font-bold text-slate-600 font-sans">
                      {balanceSimulation.projectedLabel}
                    </span>
                  )}
                </label>
                <div className="border-2 border-slate-300 bg-slate-50 p-2.5 rounded-xl text-base font-mono text-left font-black text-slate-900 shadow-2xs flex justify-between items-center" dir="ltr">
                  <span>{balanceSimulation ? balanceSimulation.projectedNetFormatted : '0.00'}</span>
                  <span className="text-xs font-sans text-slate-500 font-bold">{currencyFullNameAr}</span>
                </div>
              </div>

              {/* البيان والشرح المحاسبي */}
              <div className="md:col-span-4 flex flex-col gap-1.5">
                <label className="text-xs font-black uppercase text-slate-800 tracking-wide">البيان والشرح المحاسبي <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  required 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  disabled={isCurrentVoucherPosted}
                  placeholder={isReceipt ? 'سداد دفعة عن فاتورة مبيعات / دفعة مقدمة...' : 'سداد مستحقات توريد / دفعة لمورد...'} 
                  className={`border-2 p-2.5 rounded-xl text-sm font-bold focus:outline-none focus:border-blue-600 shadow-2xs ${
                    isCurrentVoucherPosted ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'border-slate-300 text-slate-900 bg-white'
                  }`} 
                />
              </div>
            </div>

            {/* 🌟 INVOICE MATCHING & ALLOCATION CARD (البند رقم 1: تسوية وتخصيص السندات على الفواتير) 🌟 */}
            {selectedPartner && (
              <div className="p-4 sm:p-5 bg-slate-50/80 rounded-2xl border-2 border-slate-200 flex flex-col gap-3.5 shadow-2xs">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black ${
                      isReceipt ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}>
                      <SplitSquareVertical size={18} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-black text-slate-900">
                          تسوية وتخصيص الفواتير المستحقة (Invoice Matching & Allocation)
                        </h3>
                        <span className="text-[10px] bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded-full font-bold border border-indigo-200">
                          {isReceipt ? 'فواتير مبيعات العميل' : 'فواتير مشتريات المورد'}
                        </span>
                        {pendingInvoices.length > 0 && (
                          <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full font-bold border border-amber-200 font-mono">
                            {pendingInvoices.length} فواتير معلقة
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        ربط مبلغ السند بتسوية الفواتير المعلقة كلياً أو جزئياً وتحديث حالتها تلقائياً إلى "مدفوعة" أو "مدفوعة جزئياً"
                      </p>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto">
                    <button
                      type="button"
                      disabled={isCurrentVoucherPosted}
                      onClick={() => setAllocationMode('AUTO_ALLOCATE')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        allocationMode === 'AUTO_ALLOCATE'
                          ? (isReceipt ? 'bg-emerald-600 text-white shadow-xs' : 'bg-rose-600 text-white shadow-xs')
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <CheckSquare size={13} />
                      <span>تخصيص فواتير محددة</span>
                    </button>
                    <button
                      type="button"
                      disabled={isCurrentVoucherPosted}
                      onClick={() => {
                        setAllocationMode('GENERAL_ON_ACCOUNT');
                        setAllocationsMap({});
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        allocationMode === 'GENERAL_ON_ACCOUNT'
                          ? 'bg-slate-800 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Banknote size={13} />
                      <span>دفعة عامة على الحساب</span>
                    </button>
                  </div>
                </div>

                {/* Feedback message */}
                {allocationMessage && (
                  <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs font-bold flex items-center justify-between animate-fadeIn">
                    <span>{allocationMessage}</span>
                    <button type="button" onClick={() => setAllocationMessage(null)} className="text-blue-500 hover:text-blue-700">
                      <X size={14} />
                    </button>
                  </div>
                )}

                {allocationMode === 'GENERAL_ON_ACCOUNT' ? (
                  <div className="p-4 bg-white rounded-xl border border-dashed border-slate-300 text-slate-600 text-xs font-medium flex items-center gap-2.5">
                    <Banknote size={18} className="text-slate-400 shrink-0" />
                    <span>
                      تم اختيار تسجيل هذا السند كـ <strong>دفعة عامة على الحساب</strong> دون ربطه بفواتير معينة. سيتم تسجيل السند مباشرة وتحديث رصيد ({selectedPartner.name}) في دفتر الأستاذ وكشف الحساب.
                    </span>
                  </div>
                ) : pendingInvoices.length === 0 ? (
                  <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2.5">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    <span>
                      لا توجد أي فواتير معلقة أو غير مسددة لـ ({selectedPartner.name}) حالياً. جميع فواتيره السابقة مسددة بالكامل، ومبلغ هذا السند سيقيد كدفعة في رصيده العام.
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {/* Action buttons */}
                    {!isCurrentVoucherPosted && (
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black text-slate-700">أدوات التسوية السريعة:</span>
                          <button
                            type="button"
                            onClick={handleDistributeFifo}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                            title="توزيع المبلغ المدخل تلقائياً على الفواتير الأقدم أولاً (FIFO)"
                          >
                            <Sparkles size={13} className="text-indigo-600" />
                            <span>توزيع تلقائي للمبلغ (FIFO - الأقدم أولاً)</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleMatchVoucherToAllocations}
                            disabled={totalAllocatedAmount <= 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                            title="ضبط خانة مبلغ السند ليطابق إجمالي الفواتير المخصصة"
                          >
                            <Calculator size={13} className="text-emerald-600" />
                            <span>مطابقة مبلغ السند مع التخصيص</span>
                          </button>

                          <button
                            type="button"
                            onClick={handlePayAllInvoices}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                            title="تخصيص كامل المتبقي لجميع الفواتير دفعة واحدة وتحديث مبلغ السند"
                          >
                            <CheckCircle2 size={13} className="text-blue-600" />
                            <span>سداد كافة الفواتير بالكامل ({totalPendingInvoicesRemaining.toLocaleString()} {currencyFullNameAr})</span>
                          </button>
                        </div>

                        {totalAllocatedAmount > 0 && (
                          <button
                            type="button"
                            onClick={handleClearAllocations}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <RotateCcw size={12} />
                            <span>تصفير التخصيص</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Warning if over allocated */}
                    {isOverAllocated && (
                      <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs font-bold flex flex-wrap items-center justify-between gap-2 animate-fadeIn">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                          <span>
                            تنبيه: مجموع المبالغ المخصصة للفواتير ({totalAllocatedAmount.toLocaleString()} {currencySymbol}) أكبر من مبلغ السند ({voucherNumericAmount.toLocaleString()} {currencySymbol})!
                          </span>
                        </div>
                        {!isCurrentVoucherPosted && (
                          <button
                            type="button"
                            onClick={handleMatchVoucherToAllocations}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black transition-colors cursor-pointer shadow-2xs"
                          >
                            مطابقة وتحديث مبلغ السند فوراً
                          </button>
                        )}
                      </div>
                    )}

                    {/* Table of Invoices */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                            <th className="py-2.5 px-3">رقم الفاتورة والحالة</th>
                            <th className="py-2.5 px-3">تاريخها والاستحقاق</th>
                            <th className="py-2.5 px-3 text-left">إجمالي الفاتورة</th>
                            <th className="py-2.5 px-3 text-left">المسدد سابقاً</th>
                            <th className="py-2.5 px-3 text-left">المتبقي المستحق</th>
                            <th className="py-2.5 px-3 w-48 text-center">المبلغ المخصص بالسند</th>
                            <th className="py-2.5 px-3 text-center">الرصيد والحالة بعد التسوية</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {pendingInvoices.map(inv => {
                            const currentAlloc = allocationsMap[inv.id] ?? allocationsMap[inv.invoiceNumber] ?? 0;
                            const newRem = Math.max(0, inv.remainingBeforeCurrent - currentAlloc);
                            const willBeFullyPaid = currentAlloc > 0 && newRem <= 0.001;
                            const willBePartial = currentAlloc > 0 && newRem > 0.001;

                            return (
                              <tr key={inv.id} className={`hover:bg-slate-50/70 transition-colors ${currentAlloc > 0 ? 'bg-indigo-50/30' : ''}`}>
                                <td className="py-2.5 px-3">
                                  <div className="flex flex-col">
                                    <span className="font-mono font-bold text-blue-700">#{inv.invoiceNumber}</span>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                        inv.status === 'POSTED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                      }`}>
                                        {inv.status === 'POSTED' ? 'مرحلة' : 'مسودة'}
                                      </span>
                                      {inv.classification && (
                                        <span className="text-[9px] text-slate-500 font-medium">
                                          {inv.classification === 'TAX' ? 'ضريبية' : 'عادية'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                <td className="py-2.5 px-3">
                                  <div className="flex flex-col font-mono text-slate-600">
                                    <span>{inv.date || '-'}</span>
                                    {inv.dueDate && (
                                      <span className="text-[10px] text-slate-400">استحقاق: {inv.dueDate}</span>
                                    )}
                                  </div>
                                </td>

                                <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-800" dir="ltr">
                                  {inv.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>

                                <td className="py-2.5 px-3 text-left font-mono text-slate-500" dir="ltr">
                                  {(inv.initialPaid + inv.otherAllocated).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>

                                <td className="py-2.5 px-3 text-left font-mono font-black text-rose-700" dir="ltr">
                                  {inv.remainingBeforeCurrent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>

                                <td className="py-2 px-3">
                                  <div className="flex items-center gap-1.5 justify-center">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max={inv.remainingBeforeCurrent}
                                      value={currentAlloc > 0 ? currentAlloc : ''}
                                      onChange={e => handleSingleInvoiceAllocationChange(inv.id, parseFloat(e.target.value) || 0, inv.remainingBeforeCurrent)}
                                      disabled={isCurrentVoucherPosted}
                                      placeholder="0.00"
                                      className={`w-28 border-2 p-1.5 rounded-lg text-xs font-mono font-bold text-left focus:outline-none shadow-2xs ${
                                        isCurrentVoucherPosted
                                          ? 'bg-slate-100 border-slate-200 text-slate-500'
                                          : currentAlloc > 0
                                            ? 'border-indigo-500 bg-indigo-50/50 text-indigo-950 font-black'
                                            : 'border-slate-300 bg-white text-slate-900 focus:border-indigo-600'
                                      }`}
                                      dir="ltr"
                                    />
                                    {!isCurrentVoucherPosted && (
                                      <button
                                        type="button"
                                        onClick={() => handleSettleInvoiceFull(inv.id, inv.remainingBeforeCurrent)}
                                        className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer whitespace-nowrap shadow-2xs ${
                                          willBeFullyPaid
                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                            : 'bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-slate-700 border-slate-200'
                                        }`}
                                        title="سداد كامل المبلغ المتبقي لهذه الفاتورة"
                                      >
                                        سداد كامل
                                      </button>
                                    )}
                                  </div>
                                </td>

                                <td className="py-2.5 px-3 text-center">
                                  {willBeFullyPaid ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      <CheckCircle2 size={11} className="text-emerald-600" />
                                      <span>ستصبح مدفوعة بالكامل</span>
                                    </span>
                                  ) : willBePartial ? (
                                    <div className="flex flex-col items-center">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">
                                        <span>مدفوعة جزئياً</span>
                                      </span>
                                      <span className="text-[10px] font-mono text-slate-500 mt-0.5">
                                        متبقي: {newRem.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-semibold">غير مخصصة (معلقة)</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Summary row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-slate-500">إجمالي المخصص للفواتير:</span>
                        <span className="text-base font-mono font-black text-indigo-700">
                          {totalAllocatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencyFullNameAr}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {Object.values(allocationsMap).filter(v => Number(v) > 0).length} فواتير مسواة
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-slate-500">مبلغ السند الإجمالي:</span>
                        <span className={`text-base font-mono font-black ${
                          isReceipt ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {voucherNumericAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencyFullNameAr}
                        </span>
                        <span className="text-[10px] text-slate-400">قيمة السند المسجلة</span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-slate-500">المتبقي كدفعة عامة على الحساب:</span>
                        <span className="text-base font-mono font-black text-slate-800">
                          {unallocatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencyFullNameAr}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {unallocatedAmount > 0.001 ? 'رصيد دائن/مدين عام' : 'مخصص بالكامل للفواتير'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
          
          {/* Live Anti-Tamper Barcode & QR Verification Banner */}
          <div className="p-3.5 bg-slate-50 border-t border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs print:hidden">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                <Scan size={18} />
              </div>
              <div>
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span>المطابقة الضوئية لمنع التلاعب (Anti-Tamper Barcode & QR)</span>
                  <span className="text-[10px] bg-purple-100 text-purple-900 border border-purple-200 px-1.5 py-0.5 rounded font-mono font-bold">
                    #{voucherNumber}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  كود تحقق أمني مشفر ومقروء بالماسح الضوئي في قوالب الطباعة الحرارية والرسمية
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
              <div className="h-8 flex items-center overflow-hidden">
                <BarcodeImage value={voucherNumber || nextCalculatedVoucherNum} height={26} barWidth={1.05} fontSize={7} />
              </div>
              {systemSettings?.taxAndInvoice?.enableQrCode !== false && (
                <div className="border-r border-slate-200 pr-2">
                  <VoucherQrCodeImage data={currentPreviewObject} size={32} showVerificationHash={false} />
                </div>
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-slate-900 text-white p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 print:hidden border-t-2 border-slate-800">
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">المبلغ الإجمالي للسند</span>
                  {voucherStatus === 'POSTED' ? (
                    <span className="text-[10px] bg-emerald-900/80 text-emerald-300 px-2 py-0.2 rounded-md font-bold border border-emerald-700/60 flex items-center gap-1">
                      <CheckCircle2 size={10} /> مرحل بالحسابات
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-900/80 text-amber-300 px-2 py-0.2 rounded-md font-bold border border-amber-700/60 flex items-center gap-1">
                      <AlertTriangle size={10} /> مسودة غير مرحلة
                    </span>
                  )}
                </div>
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
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-xl font-bold text-xs border border-slate-700 transition-colors cursor-pointer"
              >
                <Eye size={15} />
                <span>معاينة الطباعة</span>
              </button>

              {/* زر الحفظ كمسودة */}
              {!isCurrentVoucherPosted && (
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-amber-950/40 text-amber-300 hover:text-amber-200 border border-amber-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                  title="حفظ السند كمسودة غير مرحلة بانتظار الترحيل اليدوي"
                >
                  <Save size={15} />
                  <span>حفظ كمسودة (غير مرحل)</span>
                </button>
              )}

              {/* زر إلغاء الترحيل البارز والواضح جداً إذا كان السند مرحلاً */}
              {isCurrentVoucherPosted && (
                <button
                  type="button"
                  onClick={handleUnpostCurrentVoucher}
                  className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl shadow-lg shadow-amber-950/40 text-sm font-black transition-all cursor-pointer border border-amber-400/40"
                  title="إلغاء ترحيل هذا السند فوراً وإعادته كمسودة وإيقاف أثره المالي"
                >
                  <RotateCcw size={17} />
                  <span>إلغاء الترحيل</span>
                </button>
              )}

              {/* زر الترحيل اليدوي */}
              {!isCurrentVoucherPosted && (
                <button 
                  type="button"
                  onClick={handlePostCurrentVoucher}
                  className={`flex items-center justify-center gap-2 px-6 py-3 text-white rounded-xl shadow-lg text-sm font-black transition-all cursor-pointer border ${
                    isReceipt
                      ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 border-emerald-400/30 shadow-emerald-950/40'
                      : 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-600 border-rose-400/30 shadow-rose-950/40'
                  }`}
                  title="ترحيل السند في الحسابات العامة وتحديث كشف الحساب ودفتر الأستاذ فوراً"
                >
                  <CheckCircle2 size={18} /> 
                  <span>ترحيل السند في الحسابات</span>
                </button>
              )}
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

      <VouchersExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        initialCategory="EXTERNAL"
        initialType={isReceipt ? 'RECEIPT' : 'PAYMENT'}
        title={`تصدير كشوفات ${isReceipt ? 'سندات القبض' : 'سندات الصرف'} (Excel / CSV / PDF)`}
      />

      {/* Vouchers Approval Center Modal */}
      <VouchersApprovalCenterModal
        isOpen={showApprovalCenterModal}
        onClose={() => setShowApprovalCenterModal(false)}
        systemSettings={systemSettings}
      />
    </div>
  );
}

export function ExternalReceiptVoucher() {
  return <ExternalVouchers fixedType={VoucherType.Receipt} />;
}

export function ExternalPaymentVoucher() {
  return <ExternalVouchers fixedType={VoucherType.Payment} />;
}
