import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { 
  Save, ArrowUpRight, ArrowDownLeft, ArrowRight, Plus, History, AlertTriangle, 
  Edit3, Trash2, X, Eye, FileText, Truck, Users,
  CheckCircle2, RotateCcw, Send,
  ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft,
  Banknote, Landmark, CreditCard, Calendar, Hash,
  Sparkles, Calculator, CheckSquare, Layers, SplitSquareVertical,
  Building2, Scan, FileSpreadsheet, User, Coins, AlignLeft, ShieldCheck, Stamp, MessageSquare, Printer, FileDown
} from 'lucide-react';
import { VoucherType, Partner, Account, AccountType } from '../types/accounting';
import { getSystemSettings } from '../utils/settings';
import { loadChartOfAccounts } from '../utils/trialBalanceStore';
import { isCashOrBankAccount } from '../utils/accountingIntegration';
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
import { useIsInWindow } from './DesktopWindowManager';
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
import { navigateToAccountMovements } from '../utils/accountMovementsStore';

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
  isInWindow?: boolean;
}

export default function ExternalVouchers({ fixedType, isInWindow: explicitIsInWindow }: ExternalVouchersProps = {}) {
  const isInWindow = useIsInWindow(explicitIsInWindow);
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
    const list = chartAccounts.filter(a => isCashOrBankAccount(a, chartAccounts));
    if (list.length > 0) return list;
    return [
      { id: 'acc-1101', code: '1101', name: 'الصندوق الرئيسي (الخزينة النقدية)', type: AccountType.Asset, balanceType: 'DEBIT' as any },
      { id: 'acc-1102', code: '1102', name: 'النقدية بالبنك (الحساب البنكي الجاري)', type: AccountType.Asset, balanceType: 'DEBIT' as any },
    ];
  }, [chartAccounts]);

  // Account display resolver
  const getAccountDisplay = (accId: string) => {
    const found = chartAccounts.find(a => a.id === accId || a.code === accId);
    if (found) return `[${found.code}] ${found.name}`;
    if (accId === 'cash') {
      const cashAcc = chartAccounts.find(a => a.code === '1101');
      return cashAcc ? `[${cashAcc.code}] ${cashAcc.name}` : 'الصندوق الرئيسي';
    }
    if (accId === 'bank') {
      const bankAcc = chartAccounts.find(a => a.code === '1102');
      return bankAcc ? `[${bankAcc.code}] ${bankAcc.name}` : 'الحساب البنكي';
    }
    return accId;
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

  const handleAutoDistributeFifo = handleDistributeFifo;

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

  function handleNewVoucher() {
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

  // Check for pending target voucher on mount / when currentSavedList loads
  useEffect(() => {
    try {
      const targetId = sessionStorage.getItem('alpha_target_voucher_id');
      const targetNum = sessionStorage.getItem('alpha_target_voucher_number');
      if (targetId || targetNum) {
        sessionStorage.removeItem('alpha_target_voucher_id');
        sessionStorage.removeItem('alpha_target_voucher_number');
        const list = Array.isArray(currentSavedList) ? currentSavedList : [];
        const cleanNum = targetNum ? targetNum.replace(/^#/, '').trim().toLowerCase() : '';
        const found = list.find(v => 
          (targetId && String(v.id) === String(targetId)) ||
          (cleanNum && v.voucherNumber && String(v.voucherNumber).replace(/^#/, '').trim().toLowerCase() === cleanNum)
        );
        if (found) {
          handleEdit(found);
        }
      }
    } catch (e) {
      console.warn('Failed to load pending voucher from sessionStorage:', e);
    }
  }, [currentSavedList]);

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

  const handleDelete = (id: string, vNum: string = voucherNumber) => {
    const targetVoucher = currentSavedList.find(v => v.id === id);
    const displayNum = vNum || targetVoucher?.voucherNumber || id;
    if (targetVoucher && targetVoucher.status === 'POSTED') {
      alert(`⚠️ لا يمكن حذف السند رقم (#${displayNum}) لأنه مرحل ومعتمد بالحسابات!\n\nيجب أولاً الضغط على زر [إلغاء الترحيل] لتحويل السند إلى مسودة، ثم يمكنك حذفه.`);
      return;
    }

    if (confirm(`هل أنت متأكد من رغبتك في حذف السند رقم (${displayNum}) نهائياً؟`)) {
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

  const handleCurrentVoucherDelete = () => {
    const target = currentSavedList.find(v => v.id === editingVoucherId || v.voucherNumber === voucherNumber);
    if (target) {
      handleDelete(target.id, target.voucherNumber);
    } else {
      if (confirm('هل أنت متأكد من رغبتك في مسح وإلغاء البيانات المدخلة للسند الحالي؟')) {
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

  // Direct Print, PDF, WhatsApp handlers
  const handleDirectPrint = () => {
    window.print();
  };

  const handleDirectPdfExport = () => {
    setCustomPreviewData(null);
    setShowPrintPreview(true);
  };

  const handleOpenWhatsApp = () => {
    const pPhone = selectedPartner?.phone || '';
    const cleanPhone = pPhone.replace(/[^0-9]/g, '');
    const vTitle = isReceipt ? 'سند قبض' : 'سند صرف';
    const textMsg = encodeURIComponent(
      `السلام عليكم ورحمة الله، مرفق تفاصيل ${vTitle} رقم #${voucherNumber} بقيمة ${Number(amount || 0).toLocaleString()} ريال - طرف الحساب: ${selectedPartner?.name || 'العميل/المورد'}.`
    );
    if (cleanPhone) {
      window.open(`https://wa.me/${cleanPhone}?text=${textMsg}`, '_blank');
    } else {
      window.open(`https://api.whatsapp.com/send?text=${textMsg}`, '_blank');
    }
  };

  return (
    <div className="flex flex-col flex-1">
      {/* Compact Unified Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2 sm:p-2.5 shadow-xs mb-3 print:hidden">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Stepper Navigation & Status */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center bg-slate-100 border border-slate-300 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={handleNavigateFirst}
                disabled={!canGoFirst}
                className="p-1 text-slate-700 hover:text-blue-900 hover:bg-white disabled:opacity-30 rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
                title="السند الأول (الأقدم)"
              >
                <ChevronsRight size={13} />
              </button>
              <button
                type="button"
                onClick={handleNavigatePrevious}
                disabled={!canGoPrevious}
                className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-slate-800 bg-white hover:bg-slate-50 hover:text-blue-900 disabled:opacity-30 rounded transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-200 shadow-2xs"
                title="السند السابق"
              >
                <ChevronRight size={13} className="text-blue-700" />
                <span className="hidden sm:inline">السابق</span>
              </button>
              <div className="px-2 py-0.5 text-xs font-mono font-bold text-slate-900 bg-slate-100 rounded mx-0.5 select-none border border-slate-200 shadow-2xs whitespace-nowrap">
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
                className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-slate-800 bg-white hover:bg-slate-50 hover:text-blue-900 disabled:opacity-30 rounded transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-200 shadow-2xs"
                title="السند التالي"
              >
                <span className="hidden sm:inline">التالي</span>
                <ChevronLeft size={13} className="text-blue-700" />
              </button>
              <button
                type="button"
                onClick={handleNavigateLast}
                disabled={!canGoLast}
                className="p-1 text-slate-700 hover:text-blue-900 hover:bg-white disabled:opacity-30 rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
                title="السند الأخير (الأحدث)"
              >
                <ChevronsLeft size={13} />
              </button>
            </div>

            {/* Voucher Status Pill */}
            <span className={`px-2 py-1 text-xs font-bold rounded-lg border shadow-2xs ${
              voucherStatus === 'POSTED'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-amber-50 text-amber-900 border-amber-300'
            }`}>
              {voucherStatus === 'POSTED' ? 'مرحل بالحسابات' : 'مسودة'}
            </span>

            {/* Voucher Number badge in window mode */}
            

            {/* Receipt vs Payment Switcher (Shown ONLY when not fixed to a specific voucher type) */}
            {!fixedType && (
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleTypeChange(VoucherType.Receipt)}
                  className={`px-2 py-0.5 text-xs font-bold rounded transition-all cursor-pointer ${
                    isReceipt ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  قبض ({receiptVouchers.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange(VoucherType.Payment)}
                  className={`px-2 py-0.5 text-xs font-bold rounded transition-all cursor-pointer ${
                    !isReceipt ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  صرف ({paymentVouchers.length})
                </button>
              </div>
            )}
          </div>

          {/* Action Operations Toolbar */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleNewVoucher}
              className="h-8 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer transition-all"
              title="سند جديد"
            >
              <Plus size={14} />
              <span>جديد</span>
            </button>

            {/* Primary Action (ترحيل) */}
            {voucherStatus === 'DRAFT' ? (
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
              {/* Preview Button - Bariz & Clear (معاينة) */}
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
                onClick={() => handleOpenWhatsApp()}
                className="h-8 px-2.5 hover:bg-white text-slate-700 hover:text-emerald-700 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                title="إرسال عبر واتساب"
              >
                <MessageSquare size={14} className="text-emerald-600" />
                <span>واتساب</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className={`h-8 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all border ${
                showHistory ? 'bg-blue-700 text-white border-blue-800 shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 shadow-2xs'
              }`}
            >
              <History size={13} />
              <span>السجل</span>
              <span className="px-1 py-0.2 rounded-full font-mono text-[10px] font-bold bg-slate-200 text-slate-800">
                {currentSavedList.length}
              </span>
            </button>

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

            {editingVoucherId && (
              <button
                type="button"
                onClick={() => handleDelete(editingVoucherId, voucherNumber)}
                className="h-8 px-2 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-700 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                title="حذف السند"
              >
                <Trash2 size={13} />
                <span>حذف</span>
              </button>
            )}
          </div>
        </div>
      </div>
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
            <>
              {/* Mobile Cards View (< md) */}
              <div className="md:hidden divide-y divide-slate-100 max-h-72 overflow-y-auto space-y-2">
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
                      <div
                        key={v.id}
                        className={`p-3 rounded-xl space-y-2 transition-all border ${
                          editingVoucherId === v.id
                            ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-200'
                            : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-black text-xs px-2 py-0.5 rounded-md border ${
                              isReceipt ? 'text-emerald-900 bg-emerald-100/80 border-emerald-300' : 'text-rose-900 bg-rose-100/80 border-rose-300'
                            }`}>
                              #{v.voucherNumber}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">{v.date}</span>
                          </div>
                          <div>
                            {isPosted ? (
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
                            <span className="text-[10px] text-slate-400 block">الطرف:</span>
                            <span className="font-semibold text-slate-800 truncate block">{v.partnerName}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">المبلغ:</span>
                            <span className={`font-mono font-black ${isReceipt ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {v.amount.toLocaleString()} {currencySymbol}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">الحساب:</span>
                            <span className="text-slate-700 truncate block">{getAccountDisplay(v.accountId)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">طريقة الدفع:</span>
                            <span className="text-slate-600 truncate block">
                              {v.paymentMethod === 'BANK_TRANSFER' ? 'تحويل بنكي' : v.paymentMethod === 'CHECK' ? 'شيك' : v.paymentMethod === 'SPAN' ? 'مدى' : 'نقداً'}
                            </span>
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
                            {!isPosted ? (
                              <button
                                type="button"
                                onClick={() => handleTogglePostingFromList(v)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                              >
                                <CheckCircle2 size={11} />
                                <span>ترحيل</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleTogglePostingFromList(v)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              >
                                <RotateCcw size={11} />
                                <span>إلغاء الترحيل</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {matchedPartner && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setSelectedPartnerForStatement(matchedPartner)}
                                  className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg border border-emerald-200 cursor-pointer"
                                  title="كشف الحساب"
                                >
                                  <FileText size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => navigateToAccountMovements(matchedPartner.id)}
                                  className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg border border-amber-200 cursor-pointer"
                                  title="عرض في حركة الحسابات"
                                >
                                  <Layers size={14} />
                                </button>
                              </>
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
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 cursor-pointer"
                              title="معاينة"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEdit(v)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 cursor-pointer"
                              title="تعديل"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={isPosted}
                              onClick={() => handleDelete(v.id, v.voucherNumber)}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                isPosted
                                  ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-40'
                                  : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200 cursor-pointer'
                              }`}
                              title={isPosted ? 'السند مرحل بالحسابات. يجب إلغاء الترحيل أولاً لحذفه' : 'حذف'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto max-h-72">
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
                              <>
                                <button
                                  type="button"
                                  onClick={() => setSelectedPartnerForStatement(matchedPartner)}
                                  className="flex items-center gap-0.5 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                                  title="عرض كشف الحساب التفصيلي للطرف"
                                >
                                  <FileText size={12} />
                                  <span>كشف الحساب</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => navigateToAccountMovements(matchedPartner.id)}
                                  className="flex items-center gap-0.5 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                                  title="عرض في حركة الحسابات"
                                >
                                  <Layers size={12} />
                                  <span>حركة الحساب</span>
                                </button>
                              </>
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
          </>
        )}
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs mb-6 space-y-4">
          {/* Row 1: [يصرف إلى / المستلم / العميل] | [رقم السند] | [تاريخ السند] */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* 1. Party Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                  <User size={14} className="text-blue-600 shrink-0" />
                  <span>{isReceipt ? 'مستلم من (العميل / الطرف الخارجي)' : 'يصرف إلى (المورد / الطرف الخارجي)'}</span>
                  <span className="text-red-500 font-bold">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setPartnerFilterCategory(partnerFilterCategory === 'ALL' ? 'AUTO' : 'ALL')}
                  disabled={isCurrentVoucherPosted}
                  className="text-[10px] text-indigo-700 hover:underline font-bold cursor-pointer"
                >
                  {partnerFilterCategory === 'ALL' ? 'تلقائي' : 'الكل'}
                </button>
              </div>

              <select
                required
                value={partnerId}
                onChange={e => setPartnerId(e.target.value)}
                disabled={isCurrentVoucherPosted}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold border focus:outline-none transition-all ${
                  isReceipt ? 'border-emerald-300 text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500/10' : 'border-rose-300 text-slate-900 bg-white focus:ring-2 focus:ring-rose-500/10'
                } disabled:bg-slate-100 disabled:text-slate-500`}
              >
                <option value="">-- اختر الطرف الخارجي --</option>
                {availablePartners.map(p => (
                  <option key={`${p.type}-${p.id}`} value={p.id}>
                    [{p.type === 'CUSTOMER' ? 'عميل' : 'مورد'}] {p.name}
                  </option>
                ))}
              </select>

              {/* Party Remaining Balance Badge */}
              {selectedPartner && (
                <div className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-[11px] animate-fadeIn">
                  <span className="text-slate-600 font-bold truncate">المتبقي للطرف:</span>
                  <span className={`font-mono font-black ${
                    (selectedPartner.balance || 0) > 0 ? 'text-rose-700' : (selectedPartner.balance || 0) < 0 ? 'text-emerald-700' : 'text-slate-700'
                  }`}>
                    {Math.abs(selectedPartner.balance || 0).toLocaleString()} {currencySymbol}
                  </span>
                </div>
              )}
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
                  required
                  value={voucherNumber}
                  onChange={e => setVoucherNumber(e.target.value)}
                  disabled={isCurrentVoucherPosted}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-mono font-bold border ${
                    isVoucherDuplicate
                      ? 'border-red-500 text-red-700 bg-red-50'
                      : 'border-slate-200 bg-slate-50 text-slate-900 focus:bg-white'
                  }`}
                />
                {!isCurrentVoucherPosted && (
                  <button
                    type="button"
                    onClick={() => setVoucherNumber(nextCalculatedVoucherNum)}
                    className="px-2.5 py-2 text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 shrink-0 cursor-pointer"
                  >
                    تلقائي
                  </button>
                )}
              </div>
            </div>

            {/* 3. Voucher Date */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Calendar size={14} className="text-amber-600 shrink-0" />
                <span>تاريخ السند</span>
                <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                disabled={isCurrentVoucherPosted}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-blue-600 outline-none transition-all disabled:bg-slate-100"
              />
            </div>
          </div>

          {/* Row 2: [المبلغ المصروف / المقبوض] | [مركز التكلفة] | [الصندوق / البنك] | [طريقة السداد/الصرف] */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Amount */}
            <div>
              <label className={`flex items-center gap-1.5 text-xs font-bold mb-1.5 ${isReceipt ? 'text-emerald-950' : 'text-rose-950'}`}>
                <Coins size={14} className={isReceipt ? 'text-emerald-600 shrink-0' : 'text-rose-600 shrink-0'} />
                <span>{isReceipt ? 'المبلغ المقبوض' : 'المبلغ المصروف'} ({currencySymbol})</span>
                <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                disabled={isCurrentVoucherPosted}
                onFocus={e => e.target.select()}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className={`w-full py-2 px-3 rounded-xl text-base font-mono font-black text-left border focus:outline-none transition-all ${
                  isReceipt ? 'border-emerald-300 bg-emerald-50/40 text-emerald-950 focus:ring-2 focus:ring-emerald-500/10' : 'border-rose-300 bg-rose-50/40 text-rose-950 focus:ring-2 focus:ring-rose-500/10'
                } disabled:bg-slate-100 disabled:text-slate-500`}
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
                onChange={e => setCostCenterId(e.target.value)}
                disabled={isCurrentVoucherPosted}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-blue-600 outline-none transition-all disabled:bg-slate-100"
              >
                <option value="">-- بدون تحديد (عام) --</option>
                {costCenters.map(cc => (
                  <option key={cc.id} value={cc.id}>
                    [{cc.code}] {cc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Safe / Bank */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Landmark size={14} className="text-cyan-600 shrink-0" />
                <span>الصندوق / البنك</span>
                <span className="text-red-500 font-bold">*</span>
              </label>
              <select
                required
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                disabled={isCurrentVoucherPosted}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-blue-600 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500"
              >
                {cashAndBankAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    [{acc.code}] {acc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Payment Method */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <CreditCard size={14} className="text-indigo-600 shrink-0" />
                <span>طريقة السداد / الصرف</span>
              </label>
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  disabled={isCurrentVoucherPosted}
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                    paymentMethod === 'CASH'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Banknote size={13} />
                  <span>نقد</span>
                </button>
                <button
                  type="button"
                  disabled={isCurrentVoucherPosted}
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
                  disabled={isCurrentVoucherPosted}
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
                  disabled={isCurrentVoucherPosted}
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

          {/* Linked Transfer / Check / Mada details */}
          {(paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CHECK' || paymentMethod === 'SPAN') && (
            <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-fadeIn">
              <div>
                <label className="block text-[11px] font-bold text-indigo-950 mb-1">
                  {paymentMethod === 'CHECK' ? 'رقم الشيك' : 'رقم الحوالة / المرجع'}
                </label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={e => setReferenceNo(e.target.value)}
                  disabled={isCurrentVoucherPosted}
                  placeholder="Ref / Check No..."
                  className="w-full py-1.5 px-2.5 rounded-lg border border-indigo-200 bg-white text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-indigo-950 mb-1">اسم البنك</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  disabled={isCurrentVoucherPosted}
                  placeholder="مصرف الراجحي / البنك الأهلي..."
                  className="w-full py-1.5 px-2.5 rounded-lg border border-indigo-200 bg-white text-xs font-bold"
                />
              </div>
              {paymentMethod === 'CHECK' && (
                <div>
                  <label className="block text-[11px] font-bold text-amber-950 mb-1">تاريخ استحقاق الشيك</label>
                  <input
                    type="date"
                    value={checkDueDate}
                    onChange={e => setCheckDueDate(e.target.value)}
                    disabled={isCurrentVoucherPosted}
                    className="w-full py-1.5 px-2.5 rounded-lg border border-amber-200 bg-white text-xs font-bold"
                  />
                </div>
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
              onChange={e => setDescription(e.target.value)}
              disabled={isCurrentVoucherPosted}
              placeholder="بيان الشرح المحاسبي والسبب التفصيلي للعملية..."
              className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all resize-none disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>

          {/* Invoice Allocations / Matching Section if partner selected */}
          {selectedPartner && (
            <div className="pt-2 border-t border-slate-100">
              <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-blue-600" />
                    <span className="font-bold text-xs text-slate-800">تسوية وتخصيص السند على فواتير ({selectedPartner.name})</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setAllocationMode('GENERAL_ON_ACCOUNT')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        allocationMode === 'GENERAL_ON_ACCOUNT' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      دفعة عامة على الحساب
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllocationMode('AUTO_ALLOCATE')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        allocationMode === 'AUTO_ALLOCATE' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ربط بفواتير معينة
                    </button>
                  </div>
                </div>

                {allocationMode === 'GENERAL_ON_ACCOUNT' ? (
                  <p className="text-xs text-slate-600 font-medium">
                    سيتم قيد هذا السند كـ <strong>دفعة عامة على الحساب</strong> لـ ({selectedPartner.name}) دون تخصيص لفواتير محددة.
                  </p>
                ) : pendingInvoices.length === 0 ? (
                  <p className="text-xs text-emerald-700 font-medium bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                    لا توجد فواتير معلقة لـ ({selectedPartner.name}) حالياً. سيقيد السند بالكامل على الحساب العام.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-slate-600 font-bold">
                        الفواتير المعلقة ({pendingInvoices.length}) — إجمالي المتبقي: {totalPendingInvoicesRemaining.toLocaleString()} {currencySymbol}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleDistributeFifo}
                          className="text-xs text-indigo-700 hover:underline font-bold cursor-pointer"
                        >
                          توزيع تلقائي (FIFO)
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={handlePayAllInvoices}
                          className="text-xs text-emerald-700 hover:underline font-bold cursor-pointer"
                        >
                          تخصيص كامل المتبقي
                        </button>
                        {totalAllocatedAmount > 0 && (
                          <>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={handleMatchVoucherToAllocations}
                              className="text-xs text-amber-700 hover:underline font-bold cursor-pointer"
                            >
                              مطابقة مبلغ السند ({totalAllocatedAmount.toLocaleString()})
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {allocationMessage && (
                      <div className="text-[11px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 rounded-lg">
                        {allocationMessage}
                      </div>
                    )}
                    {isOverAllocated && (
                      <div className="text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg">
                        تنبيه: مجموع المبالغ المخصصة ({totalAllocatedAmount.toLocaleString()}) أكبر من مبلغ السند ({voucherNumericAmount.toLocaleString()}).
                      </div>
                    )}
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {pendingInvoices.map(inv => (
                        <div key={inv.id} className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs gap-2">
                          <div>
                            <span className="font-bold text-slate-800">فاتورة #{inv.invoiceNumber}</span>
                            <span className="text-[10px] text-slate-500 mr-2">المتبقي: {inv.remainingBeforeCurrent.toLocaleString()} {currencySymbol}</span>
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            value={allocationsMap[inv.id] ?? ''}
                            onChange={e => setAllocationsMap(prev => ({ ...prev, [inv.id]: Number(e.target.value) || 0 }))}
                            placeholder="0.00"
                            className="w-24 py-1 px-2 rounded-lg border border-slate-300 font-mono text-xs font-bold text-left"
                            dir="ltr"
                          />
                        </div>
                      ))}
                    </div>
                    {unallocatedAmount > 0 && totalAllocatedAmount > 0 && (
                      <div className="text-[11px] text-slate-500 font-medium">
                        المبلغ غير المخصص المتبقي من السند: <span className="font-bold text-slate-800">{unallocatedAmount.toLocaleString()} {currencySymbol}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Approval Stepper if enabled */}
        {systemSettings?.approvalWorkflow?.enabled && (
          <div className="mt-4">
            <VoucherApprovalStepper
              voucher={currentActiveVoucher}
              voucherId={editingVoucherId}
              voucherType={isReceipt ? 'RECEIPT' : 'PAYMENT'}
              voucherNumber={voucherNumber}
              amount={Number(amount) || 0}
              approvalStatus={currentActiveVoucher?.approvalStatus || 'NOT_REQUIRED'}
              preparedBy={currentActiveVoucher?.preparedBy || 'المحاسب'}
              systemSettings={systemSettings}
              onApprovalChanged={() => {
                const fresh = loadStoredVouchers(isReceipt ? DB_RECEIPT_VOUCHERS_KEY : DB_PAYMENT_VOUCHERS_KEY);
                if (isReceipt) setReceiptVouchers(fresh);
                else setPaymentVouchers(fresh);
              }}
              onOpenApprovalCenter={() => setShowApprovalCenterModal(true)}
              onPost={handlePostCurrentVoucher}
              onUnpost={handleUnpostCurrentVoucher}
            />
          </div>
        )}

        {/* Sleek, Compact Modern Summary Footer Banner (شريط التلخيص المالي والتفقيط) */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md border border-slate-800 flex flex-wrap items-center justify-between gap-4 mt-5 print:hidden">
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0 ${
              isReceipt ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}>
              <Banknote size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">
                  {isReceipt ? 'إجمالي المبلغ المقبوض' : 'إجمالي المبلغ المصروف'}
                </span>
                {voucherStatus === 'POSTED' ? (
                  <span className="text-[10px] bg-emerald-900/90 text-emerald-300 px-2.5 py-0.5 rounded-full font-bold border border-emerald-700/60 flex items-center gap-1">
                    <CheckCircle2 size={11} /> مرحل بالحسابات
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-900/90 text-amber-300 px-2.5 py-0.5 rounded-full font-bold border border-amber-700/60 flex items-center gap-1">
                    <AlertTriangle size={11} /> مسودة (غير مرحل)
                  </span>
                )}
              </div>
              <span className="text-xs sm:text-sm font-extrabold text-amber-300 block mt-1 tracking-wide">
                الرصيد كتابة: {tafqeet(Number(amount) || 0)}
              </span>
            </div>
          </div>

          <div className="text-left shrink-0">
            <span className={`text-2xl sm:text-3xl font-mono font-black ${isReceipt ? 'text-emerald-400' : 'text-rose-400'}`}>
              {amount ? Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
            </span>
            <span className="text-xs text-slate-300 font-bold mr-1.5">{currencySymbol}</span>
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

export function ExternalReceiptVoucher({ isInWindow }: { isInWindow?: boolean } = {}) {
  return <ExternalVouchers fixedType={VoucherType.Receipt} isInWindow={isInWindow} />;
}

export function ExternalPaymentVoucher({ isInWindow }: { isInWindow?: boolean } = {}) {
  return <ExternalVouchers fixedType={VoucherType.Payment} isInWindow={isInWindow} />;
}
