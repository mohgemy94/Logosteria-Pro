import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  FileText, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Plus, 
  Search, 
  RotateCw, 
  Printer, 
  Landmark, 
  Undo2, 
  Eye, 
  Sparkles,
  Info,
  Trash2,
  ArrowRightLeft,
  Calendar,
  Receipt
} from 'lucide-react';
import type { BankCheck, CheckType, CheckStatus } from '../types/check';
import { 
  loadBankChecks, 
  clearBankCheck, 
  bounceBankCheck, 
  endorseBankCheck,
  clearMultipleBankChecks,
  resetCheckStatus, 
  deleteBankCheck, 
  saveBankCheck,
  getCheckUrgencyInfo, 
  getCheckStats, 
  getTodayIsoDate
} from '../utils/checkStore';
import { loadChartOfAccounts, loadJournalEntries } from '../utils/trialBalanceStore';
import { loadVendors } from '../utils/partnerLedger';
import { getSystemSettings } from '../utils/settings';
import { tafqeetArabic } from '../utils/tafqeet';
import { JournalEntry, Partner } from '../types/accounting';
import ExportButtonGroup from './ExportButtonGroup';

interface CheckPortfolioScreenProps {
  onNavigate?: (view: string) => void;
}

export default function CheckPortfolioScreen({ onNavigate }: CheckPortfolioScreenProps) {
  const [checks, setChecks] = useState<BankCheck[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNDER_COLLECTION' | 'URGENT' | 'CLEARED' | 'ENDORSED' | 'BOUNCED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | CheckType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CheckStatus>('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState<'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'DUE_7_DAYS'>('ALL');
  const [bankFilter, setBankFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Multi-Selection State
  const [selectedCheckIds, setSelectedCheckIds] = useState<string[]>([]);

  // Modals state
  const [selectedCheckForClear, setSelectedCheckForClear] = useState<BankCheck | null>(null);
  const [clearanceDate, setClearanceDate] = useState<string>(getTodayIsoDate());
  const [clearanceBankId, setClearanceBankId] = useState<string>('');
  const [clearanceRef, setClearanceRef] = useState<string>('');
  const [clearanceNotes, setClearanceNotes] = useState<string>('');

  const [selectedCheckForBounce, setSelectedCheckForBounce] = useState<BankCheck | null>(null);
  const [bounceDate, setBounceDate] = useState<string>(getTodayIsoDate());
  const [bounceReason, setBounceReason] = useState<string>('عدم كفاية الرصيد (Insufficient Funds)');
  const [bounceCustomReason, setBounceCustomReason] = useState<string>('');
  const [bounceFee, setBounceFee] = useState<number>(0);
  const [bounceFeeBankId, setBounceFeeBankId] = useState<string>('');

  // Endorsement Modal State (تظهير الشيك لمورد)
  const [selectedCheckForEndorse, setSelectedCheckForEndorse] = useState<BankCheck | null>(null);
  const [endorsementDate, setEndorsementDate] = useState<string>(getTodayIsoDate());
  const [endorsedVendorId, setEndorsedVendorId] = useState<string>('');
  const [endorsementNotes, setEndorsementNotes] = useState<string>('');

  // Bulk Operations State
  const [isBulkClearModalOpen, setIsBulkClearModalOpen] = useState(false);
  const [bulkClearDate, setBulkClearDate] = useState<string>(getTodayIsoDate());
  const [bulkClearBankId, setBulkClearBankId] = useState<string>('');
  const [bulkClearRef, setBulkClearRef] = useState<string>('');

  // Print Modals
  const [viewJournalEntry, setViewJournalEntry] = useState<JournalEntry | null>(null);
  const [viewCheckCard, setViewCheckCard] = useState<BankCheck | null>(null);
  const [printableDepositSlip, setPrintableDepositSlip] = useState<{
    checks: BankCheck[];
    bankName: string;
    depositDate: string;
    slipNumber: string;
  } | null>(null);
  const [printableSingleCheckVoucher, setPrintableSingleCheckVoucher] = useState<BankCheck | null>(null);

  const [isNewCheckModalOpen, setIsNewCheckModalOpen] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // New Check form state
  const [newCheckType, setNewCheckType] = useState<CheckType>('INCOMING');
  const [newCheckNumber, setNewCheckNumber] = useState('');
  const [newCheckAmount, setNewCheckAmount] = useState<number | ''>('');
  const [newCheckIssueDate, setNewCheckIssueDate] = useState(getTodayIsoDate());
  const [newCheckDueDate, setNewCheckDueDate] = useState(getTodayIsoDate());
  const [newCheckBankName, setNewCheckBankName] = useState('مصرف الراجحي');
  const [newCheckPartnerName, setNewCheckPartnerName] = useState('');
  const [newCheckDrawer, setNewCheckDrawer] = useState('');
  const [newCheckNotes, setNewCheckNotes] = useState('');

  const systemSettings = useMemo(() => getSystemSettings(), []);
  const currencySymbol = systemSettings.financial?.currencySymbol || 'ر.س';
  const companyName = systemSettings.company?.nameAr || systemSettings.company?.nameEn || 'مؤسسة صرح الأعمال للتجارة والتوريدات';

  // Available bank accounts from Chart of Accounts
  const bankAccounts = useMemo(() => {
    const accs = loadChartOfAccounts();
    return accs.filter(a => 
      a.code.startsWith('1102') || 
      a.code.startsWith('1103') || 
      a.name.includes('بنك') || 
      a.name.includes('مصرف')
    );
  }, []);

  const defaultBankId = bankAccounts[0]?.id || 'acc-1102';

  // Available Vendors for Endorsement
  const vendorsList = useMemo<Partner[]>(() => {
    return loadVendors();
  }, []);

  // Load checks
  const reloadChecks = () => {
    setIsRefreshing(true);
    const loaded = loadBankChecks();
    setChecks(loaded);
    setTimeout(() => setIsRefreshing(false), 300);
  };

  useEffect(() => {
    reloadChecks();
    const handleUpdate = () => reloadChecks();
    window.addEventListener('alpha-checks-updated', handleUpdate);
    window.addEventListener('alpha-journal-entries-updated', handleUpdate);
    window.addEventListener('alpha-partner-ledger-updated', handleUpdate);
    return () => {
      window.removeEventListener('alpha-checks-updated', handleUpdate);
      window.removeEventListener('alpha-journal-entries-updated', handleUpdate);
      window.removeEventListener('alpha-partner-ledger-updated', handleUpdate);
    };
  }, []);

  // Show feedback toast
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedbackToast({ message, type });
    setTimeout(() => setFeedbackToast(null), 5000);
  };

  // Distinct banks for filtering
  const distinctBanks = useMemo(() => {
    const set = new Set<string>();
    checks.forEach(c => {
      if (c.bankName && c.bankName.trim()) set.add(c.bankName.trim());
    });
    return Array.from(set);
  }, [checks]);

  // Statistics
  const stats = useMemo(() => getCheckStats(checks), [checks]);

  // Filtered checks
  const filteredChecks = useMemo(() => {
    return checks.filter(c => {
      // Tab filter
      if (activeTab === 'UNDER_COLLECTION' && c.status !== 'UNDER_COLLECTION') return false;
      if (activeTab === 'CLEARED' && c.status !== 'CLEARED') return false;
      if (activeTab === 'ENDORSED' && c.status !== 'ENDORSED') return false;
      if (activeTab === 'BOUNCED' && c.status !== 'BOUNCED') return false;
      if (activeTab === 'URGENT') {
        if (c.status !== 'UNDER_COLLECTION') return false;
        const urgency = getCheckUrgencyInfo(c.dueDate, c.status);
        if (urgency.urgency !== 'OVERDUE' && urgency.urgency !== 'DUE_TODAY' && urgency.urgency !== 'DUE_SOON' && urgency.urgency !== 'DUE_THIS_WEEK') return false;
      }

      // Type filter
      if (typeFilter !== 'ALL' && c.type !== typeFilter) return false;

      // Status filter
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;

      // Bank filter
      if (bankFilter !== 'ALL' && c.bankName !== bankFilter) return false;

      // Date Range Filter (by Due Date or Issue Date)
      if (dateFrom && c.dueDate && c.dueDate < dateFrom) return false;
      if (dateTo && c.dueDate && c.dueDate > dateTo) return false;

      // Urgency filter
      if (urgencyFilter !== 'ALL') {
        const urgency = getCheckUrgencyInfo(c.dueDate, c.status);
        if (urgencyFilter === 'OVERDUE' && urgency.urgency !== 'OVERDUE') return false;
        if (urgencyFilter === 'DUE_TODAY' && urgency.urgency !== 'DUE_TODAY') return false;
        if (urgencyFilter === 'DUE_7_DAYS' && (urgency.urgency !== 'DUE_SOON' && urgency.urgency !== 'DUE_THIS_WEEK' && urgency.urgency !== 'DUE_TODAY' && urgency.urgency !== 'OVERDUE')) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = (c.checkNumber || '').toLowerCase().includes(q);
        const partnerMatch = (c.partnerName || '').toLowerCase().includes(q);
        const bankMatch = (c.bankName || '').toLowerCase().includes(q);
        const voucherMatch = (c.sourceVoucherNumber || '').toLowerCase().includes(q);
        const jeMatch = (c.journalEntryNumber || '').toLowerCase().includes(q);
        const endorsedMatch = (c.endorsedToVendorName || '').toLowerCase().includes(q);
        if (!numMatch && !partnerMatch && !bankMatch && !voucherMatch && !jeMatch && !endorsedMatch) return false;
      }

      return true;
    });
  }, [checks, activeTab, typeFilter, statusFilter, bankFilter, urgencyFilter, dateFrom, dateTo, searchQuery]);

  // Selected checks objects
  const selectedChecksList = useMemo(() => {
    return checks.filter(c => selectedCheckIds.includes(c.id));
  }, [checks, selectedCheckIds]);

  const selectedTotalAmount = useMemo(() => {
    return selectedChecksList.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  }, [selectedChecksList]);

  // Handle Multi-Select toggle
  const toggleSelectCheck = (id: string) => {
    setSelectedCheckIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedCheckIds.length === filteredChecks.length) {
      setSelectedCheckIds([]);
    } else {
      setSelectedCheckIds(filteredChecks.map(c => c.id));
    }
  };

  // Handle Clear Check Action
  const handleOpenClearModal = (check: BankCheck) => {
    setSelectedCheckForClear(check);
    setClearanceDate(getTodayIsoDate());
    setClearanceBankId(defaultBankId);
    setClearanceRef(`إشعار بنكي #${check.checkNumber}`);
    setClearanceNotes('');
  };

  const handleConfirmClear = () => {
    if (!selectedCheckForClear) return;
    const res = clearBankCheck(selectedCheckForClear.id, {
      clearanceDate,
      bankAccountId: clearanceBankId || defaultBankId,
      reference: clearanceRef,
      notes: clearanceNotes
    });

    if (res.success) {
      showToast(res.message, 'success');
      setSelectedCheckForClear(null);
      reloadChecks();
    } else {
      showToast(res.message, 'error');
    }
  };

  // Handle Bulk Clearance
  const handleConfirmBulkClear = () => {
    if (selectedCheckIds.length === 0) return;
    const res = clearMultipleBankChecks(selectedCheckIds, {
      clearanceDate: bulkClearDate,
      bankAccountId: bulkClearBankId || defaultBankId,
      reference: bulkClearRef || `تحصيل مجمع لـ ${selectedCheckIds.length} شيك`
    });

    if (res.successCount > 0) {
      showToast(`تم تحصيل وصرف ${res.successCount} شيك بنجاح وتوليد قيودها المحاسبية`, 'success');
      setIsBulkClearModalOpen(false);
      setSelectedCheckIds([]);
      reloadChecks();
    } else {
      showToast(`فشلت العملية: ${res.messages.join(' | ')}`, 'error');
    }
  };

  // Handle Endorsement Modal (تظهير الشيك لمورد)
  const handleOpenEndorseModal = (check: BankCheck) => {
    setSelectedCheckForEndorse(check);
    setEndorsementDate(getTodayIsoDate());
    setEndorsedVendorId(vendorsList[0]?.id || '');
    setEndorsementNotes('');
  };

  const handleConfirmEndorse = () => {
    if (!selectedCheckForEndorse) return;
    const targetVendor = vendorsList.find(v => v.id === endorsedVendorId);
    if (!targetVendor) {
      showToast('يرجى اختيار المورد المراد تظهير الشيك لصالحه', 'error');
      return;
    }

    const res = endorseBankCheck(selectedCheckForEndorse.id, {
      endorsementDate,
      vendorId: targetVendor.id,
      vendorName: targetVendor.name,
      notes: endorsementNotes
    });

    if (res.success) {
      showToast(res.message, 'success');
      setSelectedCheckForEndorse(null);
      reloadChecks();
    } else {
      showToast(res.message, 'error');
    }
  };

  // Handle Bounce Check Action
  const handleOpenBounceModal = (check: BankCheck) => {
    setSelectedCheckForBounce(check);
    setBounceDate(getTodayIsoDate());
    setBounceReason('عدم كفاية الرصيد (Insufficient Funds)');
    setBounceCustomReason('');
    setBounceFee(0);
    setBounceFeeBankId(defaultBankId);
  };

  const handleConfirmBounce = () => {
    if (!selectedCheckForBounce) return;
    const reasonText = bounceReason === 'أخرى (سبب مخصص)' ? (bounceCustomReason.trim() || 'سبب غير محدد') : bounceReason;
    const bounceOptions: {
      bounceDate: string;
      reason: string;
      fee?: number;
      feeBankAccountId?: string;
    } = {
      bounceDate,
      reason: reasonText
    };
    if (bounceFee > 0) {
      bounceOptions.fee = bounceFee;
      bounceOptions.feeBankAccountId = bounceFeeBankId || defaultBankId;
    }
    const res = bounceBankCheck(selectedCheckForBounce.id, bounceOptions);

    if (res.success) {
      showToast(res.message, 'success');
      setSelectedCheckForBounce(null);
      reloadChecks();
    } else {
      showToast(res.message, 'error');
    }
  };

  // Handle Reset Check
  const handleResetCheck = (check: BankCheck) => {
    if (confirm(`هل أنت متأكد من التراجع عن حالة الشيك رقم [${check.checkNumber}] وعكس القيد اليومي المرتبط به؟`)) {
      const res = resetCheckStatus(check.id);
      if (res.success) {
        showToast(res.message, 'success');
        reloadChecks();
      } else {
        showToast(res.message, 'error');
      }
    }
  };

  // Handle Delete Check
  const handleDeleteCheck = (check: BankCheck) => {
    if (confirm(`هل أنت متأكد من حذف الشيك رقم [${check.checkNumber}] نهائياً؟`)) {
      deleteBankCheck(check.id);
      showToast('تم حذف الشيك بنجاح', 'success');
      reloadChecks();
    }
  };

  // Open Journal Entry details modal
  const handleOpenJournalEntry = (jeNumberOrId?: string) => {
    if (!jeNumberOrId) return;
    const entries = loadJournalEntries();
    const found = entries.find(e => e.id === jeNumberOrId || e.entryNumber === jeNumberOrId);
    if (found) {
      setViewJournalEntry(found);
    } else {
      showToast('لم يتم العثور على القيد المحاسبي في دفتر اليومية', 'error');
    }
  };

  // Handle Save New Manual Check
  const handleSaveNewCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheckNumber.trim()) {
      showToast('يرجى إدخال رقم الشيك', 'error');
      return;
    }
    const amt = Number(newCheckAmount);
    if (!amt || amt <= 0) {
      showToast('يرجى إدخال مبلغ صحيح للشيك', 'error');
      return;
    }
    if (!newCheckPartnerName.trim()) {
      showToast('يرجى إدخال اسم الطرف (العميل أو المورد أو المستفيد)', 'error');
      return;
    }

    const check: BankCheck = {
      id: `chq_manual_${Date.now()}`,
      checkNumber: newCheckNumber.trim(),
      type: newCheckType,
      source: 'MANUAL',
      partnerName: newCheckPartnerName.trim(),
      partnerType: newCheckType === 'INCOMING' ? 'CUSTOMER' : 'VENDOR',
      amount: amt,
      issueDate: newCheckIssueDate || getTodayIsoDate(),
      dueDate: newCheckDueDate || getTodayIsoDate(),
      bankName: newCheckBankName.trim() || 'البنك المسحوب عليه',
      drawerName: newCheckDrawer.trim() || undefined,
      payeeName: newCheckType === 'OUTGOING' ? newCheckPartnerName.trim() : undefined,
      status: 'UNDER_COLLECTION',
      notes: newCheckNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    saveBankCheck(check);
    showToast('تم تسجيل الشيك الجديد في الحافظة بنجاح', 'success');
    setIsNewCheckModalOpen(false);
    // Reset form
    setNewCheckNumber('');
    setNewCheckAmount('');
    setNewCheckPartnerName('');
    setNewCheckDrawer('');
    setNewCheckNotes('');
    reloadChecks();
  };

  // Open Deposit Slip Print Preview
  const handleOpenDepositSlip = () => {
    if (selectedChecksList.length === 0) {
      showToast('يرجى تحديد شيك واحد على الأقل لإنشاء حافظة الإيداع', 'error');
      return;
    }
    setPrintableDepositSlip({
      checks: selectedChecksList,
      bankName: selectedChecksList[0]?.bankName || 'البنك المسحوب عليه',
      depositDate: getTodayIsoDate(),
      slipNumber: `DEP-SLIP-${Date.now().toString().slice(-6)}`
    });
  };

  return (
    <div className="min-h-full p-3 sm:p-5 md:p-6 bg-slate-50 text-slate-900" dir="rtl">
      {/* Toast Notification */}
      {feedbackToast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-2xl border text-sm font-bold flex items-center gap-3 transition-all animate-bounce ${
          feedbackToast.type === 'success' 
            ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/20' 
            : 'bg-rose-600 text-white border-rose-500 shadow-rose-900/20'
        }`}>
          {feedbackToast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{feedbackToast.message}</span>
        </div>
      )}

      {/* Screen Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <Landmark size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                حافظة ودورة حياة الشيكات البنكية (Bank Check Cycle)
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                متابعة التحصيل، إشعارات الاستحقاق، التظهير للموردين، والقيود المحاسبية التلقائية
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={reloadChecks}
            disabled={isRefreshing}
            className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 font-semibold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            title="مزامنة وتحديث الشيكات من السندات"
          >
            <RotateCw size={14} className={isRefreshing ? 'animate-spin text-blue-600' : ''} />
            <span>مزامنة</span>
          </button>

          <ExportButtonGroup
            title="حافظة ودورة الشيكات البنكية (شيكات القبض والصرف)"
            filename="حافظة_الشيكات_البنكية"
            headers={[
              'رقم الشيك',
              'نوع الشيك',
              'الطرف المستفيد / الساحب',
              'المبلغ',
              'تاريخ الاستحقاق',
              'البنك المسحوب عليه',
              'الحالة الحالية',
              'رقم الحساب / الفرع',
              'رقم السند المرجعي',
              'البيان والشرح'
            ]}
            rows={filteredChecks.map(c => [
              c.checkNumber,
              c.type === 'INCOMING' ? 'شيك قبض (وارد)' : 'شيك صرف (صادر)',
              c.partnerName,
              c.amount,
              c.dueDate,
              c.bankName,
              c.status === 'CLEARED' ? 'تم التحصيل / الصرف' : c.status === 'BOUNCED' ? 'مرتد ومرفوض' : c.status === 'UNDER_COLLECTION' ? 'برسم التحصيل' : 'في المحفظة',
              c.depositBankAccountName || c.bankName,
              c.sourceVoucherNumber || '-',
              c.notes || '-'
            ])}
            filterSummary={`إجمالي الشيكات: ${filteredChecks.length} | إجمالي المبالغ: ${filteredChecks.reduce((s, c) => s + c.amount, 0).toLocaleString()} ${currencySymbol}`}
            size="sm"
          />

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 font-semibold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Printer size={14} />
            <span>طباعة الحافظة</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewCheckModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>تسجيل شيك جديد</span>
          </button>
        </div>
      </div>

      {/* Maturity Real-Time Notification Banner */}
      {(stats.overdueCount > 0 || stats.dueTodayCount > 0 || stats.dueSoonCount > 0) && (
        <div className="my-4 p-4 rounded-xl border bg-linear-to-r from-amber-50 via-orange-50 to-amber-50 border-amber-200 shadow-sm print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500 text-white rounded-lg shrink-0 mt-0.5 animate-pulse">
                <Clock size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-amber-950 flex items-center gap-2">
                  <span>إشعار وتنبيه استحقاق الشيكات البنكية القادمة</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-200 text-amber-900">
                    {stats.overdueCount + stats.dueTodayCount + stats.dueSoonCount} شيك يحتاج للمتابعة
                  </span>
                </h3>
                <div className="text-xs text-amber-900/90 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {stats.overdueCount > 0 && (
                    <span className="font-bold text-rose-700 flex items-center gap-1">
                      <AlertTriangle size={13} />
                      {stats.overdueCount} شيك متأخر الاستحقاق ({stats.overdueAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol})
                    </span>
                  )}
                  {stats.dueTodayCount > 0 && (
                    <span className="font-bold text-amber-800 flex items-center gap-1">
                      <Clock size={13} />
                      {stats.dueTodayCount} شيك مستحق اليوم ({stats.dueTodayAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol})
                    </span>
                  )}
                  {stats.dueSoonCount > 0 && (
                    <span className="font-medium text-slate-700">
                      🔔 {stats.dueSoonCount} شيك يستحق خلال 7 أيام ({stats.dueSoonAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('URGENT');
                  setUrgencyFilter('DUE_7_DAYS');
                  setStatusFilter('UNDER_COLLECTION');
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                عرض الشيكات المستحقة الآن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 my-4">
        {/* 1. Under Collection */}
        <div 
          onClick={() => { setActiveTab('UNDER_COLLECTION'); setStatusFilter('UNDER_COLLECTION'); setUrgencyFilter('ALL'); }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'UNDER_COLLECTION' 
              ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-400/20 shadow-xs' 
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold flex items-center gap-1 text-blue-700">
              <Clock size={14} />
              تحت التحصيل ⏳
            </span>
            <span className="text-[11px] font-mono font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">
              {stats.underCollectionCount}
            </span>
          </div>
          <div className="text-lg font-black text-slate-900 font-mono tracking-tight mt-0.5">
            {stats.underCollectionAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal text-slate-500">{currencySymbol}</span>
          </div>
          <div className="mt-1.5 text-[10px] text-slate-500 flex justify-between border-t border-slate-100 pt-1">
            <span>وارد: {stats.incomingCount}</span>
            <span>صادر: {stats.outgoingCount}</span>
          </div>
        </div>

        {/* 2. Urgent (7 Days) */}
        <div 
          onClick={() => { setActiveTab('URGENT'); setUrgencyFilter('DUE_7_DAYS'); setStatusFilter('UNDER_COLLECTION'); }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'URGENT' 
              ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-400/20 shadow-xs' 
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold flex items-center gap-1 text-amber-700">
              <AlertTriangle size={14} />
              استحقاق عاجل ⚠️
            </span>
            <span className="text-[11px] font-mono font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-full">
              {stats.overdueCount + stats.dueTodayCount + stats.dueSoonCount}
            </span>
          </div>
          <div className="text-lg font-black text-amber-950 font-mono tracking-tight mt-0.5">
            {(stats.overdueAmount + stats.dueTodayAmount + stats.dueSoonAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal text-slate-500">{currencySymbol}</span>
          </div>
          <div className="mt-1.5 text-[10px] text-amber-800 flex justify-between border-t border-slate-100 pt-1">
            <span>متأخر: {stats.overdueCount}</span>
            <span>اليوم: {stats.dueTodayCount}</span>
          </div>
        </div>

        {/* 3. Cleared */}
        <div 
          onClick={() => { setActiveTab('CLEARED'); setStatusFilter('CLEARED'); setUrgencyFilter('ALL'); }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'CLEARED' 
              ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-400/20 shadow-xs' 
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold flex items-center gap-1 text-emerald-700">
              <CheckCircle2 size={14} />
              محصلة ومصروفة ✅
            </span>
            <span className="text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full">
              {stats.clearedCount}
            </span>
          </div>
          <div className="text-lg font-black text-emerald-950 font-mono tracking-tight mt-0.5">
            {stats.clearedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal text-slate-500">{currencySymbol}</span>
          </div>
          <div className="mt-1.5 text-[10px] text-emerald-700 flex justify-between border-t border-slate-100 pt-1">
            <span>تم الإيداع بالبنك</span>
            <span>بقيد تلقائي</span>
          </div>
        </div>

        {/* 4. Endorsed to Vendors (مظهرة لموردين) */}
        <div 
          onClick={() => { setActiveTab('ENDORSED'); setStatusFilter('ENDORSED'); setUrgencyFilter('ALL'); }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'ENDORSED' 
              ? 'bg-purple-50/90 border-purple-400 ring-2 ring-purple-400/20 shadow-xs' 
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold flex items-center gap-1 text-purple-700">
              <ArrowRightLeft size={14} />
              مظهرة لموردين 🔄
            </span>
            <span className="text-[11px] font-mono font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-full">
              {stats.endorsedCount}
            </span>
          </div>
          <div className="text-lg font-black text-purple-950 font-mono tracking-tight mt-0.5">
            {stats.endorsedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal text-slate-500">{currencySymbol}</span>
          </div>
          <div className="mt-1.5 text-[10px] text-purple-700 flex justify-between border-t border-slate-100 pt-1">
            <span>تحويل لسداد الموردين</span>
            <span>خصم ذمم</span>
          </div>
        </div>

        {/* 5. Bounced */}
        <div 
          onClick={() => { setActiveTab('BOUNCED'); setStatusFilter('BOUNCED'); setUrgencyFilter('ALL'); }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'BOUNCED' 
              ? 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-400/20 shadow-xs' 
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold flex items-center gap-1 text-rose-700">
              <XCircle size={14} />
              شيكات مرتدة ❌
            </span>
            <span className="text-[11px] font-mono font-bold bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded-full">
              {stats.bouncedCount}
            </span>
          </div>
          <div className="text-lg font-black text-rose-950 font-mono tracking-tight mt-0.5">
            {stats.bouncedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal text-slate-500">{currencySymbol}</span>
          </div>
          <div className="mt-1.5 text-[10px] text-rose-700 flex justify-between border-t border-slate-100 pt-1">
            <span>إعادة مديونية</span>
            <span>مرفوض بنكياً</span>
          </div>
        </div>
      </div>

      {/* Floating Bulk Operations Toolbar */}
      {selectedCheckIds.length > 0 && (
        <div className="my-3 p-3 bg-slate-900 text-white rounded-xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-150 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-sm font-mono">
              {selectedCheckIds.length}
            </div>
            <div>
              <div className="text-xs font-bold">تم تحديد {selectedCheckIds.length} شيك في الحافظة</div>
              <div className="text-[11px] text-slate-300 font-mono">
                إجمالي القيمة: <strong className="text-amber-400">{selectedTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> {currencySymbol}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleOpenDepositSlip}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Printer size={14} />
              <span>طباعة حافظة إيداع بنكية</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBulkClearDate(getTodayIsoDate());
                setBulkClearBankId(defaultBankId);
                setBulkClearRef(`تحصيل مجمع لـ ${selectedCheckIds.length} شيك`);
                setIsBulkClearModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <CheckCircle2 size={14} />
              <span>تحصيل مجمع بالبنك</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCheckIds([])}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg cursor-pointer transition-colors"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 mb-4 shadow-2xs print:hidden space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الشيك، اسم العميل، اسم المورد المظهر له، اسم البنك، أو رقم القيد..."
              className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                مسح
              </button>
            )}
          </div>

          {/* Quick Filter Selectors */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Type selector */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setTypeFilter('ALL')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  typeFilter === 'ALL' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('INCOMING')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  typeFilter === 'INCOMING' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowDownLeft size={13} className="text-emerald-600" />
                وارد (قبض)
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('OUTGOING')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  typeFilter === 'OUTGOING' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowUpRight size={13} className="text-rose-600" />
                صادر (صرف)
              </button>
            </div>

            {/* Bank selector */}
            {distinctBanks.length > 0 && (
              <select
                value={bankFilter}
                onChange={(e) => setBankFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">جميع البنوك ({distinctBanks.length})</option>
                {distinctBanks.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}

            {/* Urgency selector */}
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">جميع مواعيد الاستحقاق</option>
              <option value="OVERDUE">متأخر الاستحقاق ⚠️</option>
              <option value="DUE_TODAY">مستحق اليوم 🔔</option>
              <option value="DUE_7_DAYS">يستحق خلال 7 أيام</option>
            </select>
          </div>
        </div>

        {/* Date Range Selector Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-slate-400" />
            <span className="text-slate-600 font-semibold">تاريخ الاستحقاق:</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">من:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">إلى:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
            />
          </div>

          {(dateFrom || dateTo || searchQuery || typeFilter !== 'ALL' || statusFilter !== 'ALL' || urgencyFilter !== 'ALL' || bankFilter !== 'ALL' || activeTab !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('ALL');
                setStatusFilter('ALL');
                setUrgencyFilter('ALL');
                setBankFilter('ALL');
                setDateFrom('');
                setDateTo('');
                setActiveTab('ALL');
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2 py-1 cursor-pointer mr-auto"
            >
              إعادة ضبط الفلاتر
            </button>
          )}
        </div>
      </div>

      {/* Main Checks Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 select-none">
                <th className="py-3 px-3 text-center print:hidden w-8">
                  <input
                    type="checkbox"
                    checked={filteredChecks.length > 0 && selectedCheckIds.length === filteredChecks.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    title="تحديد الكل"
                  />
                </th>
                <th className="py-3 px-3.5">رقم الشيك</th>
                <th className="py-3 px-3">النوع</th>
                <th className="py-3 px-3.5">الطرف (العميل / المورد)</th>
                <th className="py-3 px-3">البنك المسحوب عليه</th>
                <th className="py-3 px-3.5 text-left">المبلغ</th>
                <th className="py-3 px-3">تاريخ التحرير</th>
                <th className="py-3 px-3">تاريخ الاستحقاق</th>
                <th className="py-3 px-3">الحالة المحاسبية</th>
                <th className="py-3 px-3">القيد المحاسبي</th>
                <th className="py-3 px-3.5 text-center print:hidden">إجراءات دورة الحياة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal text-slate-800">
              {filteredChecks.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Landmark size={36} className="text-slate-300" />
                      <p className="font-bold text-slate-600">لا توجد شيكات مسجلة تطابق محددات البحث</p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        يمكنك إضافة شيك جديد يدوياً، أو تسجيل سند قبض / صرف بطريقة دفع شيك ليتم إدراجه تلقائياً.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsNewCheckModalOpen(true)}
                        className="mt-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 cursor-pointer"
                      >
                        تسجيل شيك الآن
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredChecks.map((check) => {
                  const urgency = getCheckUrgencyInfo(check.dueDate, check.status);
                  const isIncoming = check.type === 'INCOMING';
                  const isSelected = selectedCheckIds.includes(check.id);

                  return (
                    <tr 
                      key={check.id}
                      className={`hover:bg-slate-50/80 transition-colors group ${isSelected ? 'bg-blue-50/40' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center print:hidden">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectCheck(check.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Check Number */}
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span className="text-blue-700">#{check.checkNumber}</span>
                          {check.sourceVoucherNumber && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono" title="رقم السند المرتبط">
                              {check.sourceVoucherNumber}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-3 px-3">
                        {isIncoming ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ArrowDownLeft size={12} />
                            وارد (قبض)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <ArrowUpRight size={12} />
                            صادر (صرف)
                          </span>
                        )}
                      </td>

                      {/* Partner Name */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900">{check.partnerName}</div>
                        {check.drawerName && check.drawerName !== check.partnerName && (
                          <div className="text-[10px] text-slate-400">الساحب: {check.drawerName}</div>
                        )}
                        {check.endorsedToVendorName && (
                          <div className="text-[10px] text-purple-700 font-bold flex items-center gap-0.5 mt-0.5">
                            <ArrowRightLeft size={10} />
                            <span>مظهر لـ: {check.endorsedToVendorName}</span>
                          </div>
                        )}
                      </td>

                      {/* Bank Name */}
                      <td className="py-3 px-3">
                        <div className="text-slate-700 font-medium">{check.bankName}</div>
                        {check.branchName && (
                          <div className="text-[10px] text-slate-400">فرع: {check.branchName}</div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3.5 text-left font-mono font-black text-slate-900 text-sm">
                        {Number(check.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-[10px] font-normal text-slate-500 mr-1">{currencySymbol}</span>
                      </td>

                      {/* Issue Date */}
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {check.issueDate || '-'}
                      </td>

                      {/* Due Date & Urgency Badge */}
                      <td className="py-3 px-3">
                        <div className="font-mono font-semibold text-slate-900">{check.dueDate || '-'}</div>
                        <div className="mt-1">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${urgency.badgeClass}`}>
                            {urgency.labelAr}
                          </span>
                        </div>
                      </td>

                      {/* Accounting Status */}
                      <td className="py-3 px-3">
                        {check.status === 'UNDER_COLLECTION' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                            <Clock size={12} />
                            تحت التحصيل ⏳
                          </span>
                        ) : check.status === 'CLEARED' ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 size={12} />
                              تم الصرف والتحصيل ✅
                            </span>
                            {check.depositBankAccountName && (
                              <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                                في: {check.depositBankAccountName} ({check.clearanceDate})
                              </div>
                            )}
                          </div>
                        ) : check.status === 'ENDORSED' ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-300">
                              <ArrowRightLeft size={12} />
                              مظهر لمورد 🔄
                            </span>
                            <div className="text-[10px] text-purple-700 mt-0.5 font-medium">
                              سداد لـ {check.endorsedToVendorName}
                            </div>
                          </div>
                        ) : check.status === 'BOUNCED' ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-300">
                              <XCircle size={12} />
                              مرتد ❌
                            </span>
                            {check.bounceReason && (
                              <div className="text-[10px] text-rose-600 mt-0.5 font-medium truncate max-w-[150px]" title={check.bounceReason}>
                                {check.bounceReason}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                            ملغي
                          </span>
                        )}
                      </td>

                      {/* Auto Journal Entry */}
                      <td className="py-3 px-3">
                        {check.journalEntryNumber ? (
                          <button
                            type="button"
                            onClick={() => handleOpenJournalEntry(check.journalEntryNumber)}
                            className="font-mono text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer"
                            title="عرض القيد المحاسبي المتولد آلياً"
                          >
                            <FileText size={12} />
                            <span>{check.journalEntryNumber}</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">بانتظار الصرف</span>
                        )}
                      </td>

                      {/* Lifecycle Action Buttons */}
                      <td className="py-3 px-3.5 text-center print:hidden">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {check.status === 'UNDER_COLLECTION' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenClearModal(check)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-md transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                                title="تأكيد صرف وتحصيل الشيك بالبنك وتوليد القيد"
                              >
                                <CheckCircle2 size={12} />
                                <span>صرف / تحصيل</span>
                              </button>

                              {check.type === 'INCOMING' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEndorseModal(check)}
                                  className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-[11px] rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                                  title="تظهير وتحويل الشيك لمورد لسداد حسابه"
                                >
                                  <ArrowRightLeft size={12} />
                                  <span>تظهير</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenBounceModal(check)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                                title="تسجيل ارتداد الشيك وتوليد قيد الارتداد"
                              >
                                <XCircle size={12} />
                                <span>مرتد</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleResetCheck(check)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                              title="التراجع عن الحالة وعكس القيد التلقائي"
                            >
                              <Undo2 size={12} />
                              <span>تراجع</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setPrintableSingleCheckVoucher(check)}
                            className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                            title="طباعة سند استلام الشيك الرسمي"
                          >
                            <Printer size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setViewCheckCard(check)}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            title="عرض بطاقة الشيك"
                          >
                            <Eye size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteCheck(check)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="حذف الشيك"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="bg-slate-50 p-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-2">
          <div>
            إجمالي الشيكات المعروضة: <span className="font-bold text-slate-900">{filteredChecks.length}</span> شيك
          </div>
          <div className="flex items-center gap-4 font-mono">
            <span>
              إجمالي المبالغ المعروضة: <strong className="text-slate-900 text-sm">{filteredChecks.reduce((s, c) => s + (Number(c.amount) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> {currencySymbol}
            </span>
          </div>
        </div>
      </div>

      {/* MODAL 1: Clear Check & Auto Journal Entry Generation */}
      {selectedCheckForClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={20} />
                <div>
                  <h3 className="font-black text-base">تأكيد صرف وتحصيل الشيك في الحساب البنكي</h3>
                  <p className="text-xs text-emerald-100">سيتم توليد قيد استحقاق محاسبي نظامي تلقائياً في دفتر اليومية</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedCheckForClear(null)}
                className="text-emerald-100 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-500">بيانات الشيك المطلوب صرفه:</div>
                  <div className="font-bold text-slate-900 text-sm">
                    شيك #{selectedCheckForClear.checkNumber} - {selectedCheckForClear.partnerName}
                  </div>
                  <div className="text-slate-600 mt-0.5">البنك: {selectedCheckForClear.bankName}</div>
                </div>
                <div className="text-left font-mono">
                  <div className="text-[10px] text-slate-500">المبلغ</div>
                  <div className="font-black text-emerald-700 text-base">
                    {Number(selectedCheckForClear.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">تاريخ التحصيل والصرف الفعلي *</label>
                  <input
                    type="date"
                    value={clearanceDate}
                    onChange={(e) => setClearanceDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {selectedCheckForClear.type === 'INCOMING' ? 'إيداع في حساب البنك *' : 'صرف وخصم من حساب البنك *'}
                  </label>
                  <select
                    value={clearanceBankId || defaultBankId}
                    onChange={(e) => setClearanceBankId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 cursor-pointer"
                  >
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>[{b.code}] {b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">رقم الإشعار أو المرجع البنكي</label>
                <input
                  type="text"
                  value={clearanceRef}
                  onChange={(e) => setClearanceRef(e.target.value)}
                  placeholder="مثال: إشعار إيداع بنكي رقم 44921"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* Live Journal Entry Preview */}
              <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200">
                <div className="flex items-center gap-1.5 text-blue-900 font-bold mb-2">
                  <Sparkles size={14} className="text-blue-600" />
                  <span>معاينة قيد الاستحقاق التلقائي الذي سيتم إنشاؤه:</span>
                </div>
                <table className="w-full text-right text-[11px] bg-white rounded-lg overflow-hidden border border-blue-100">
                  <thead className="bg-blue-100/60 text-blue-900 font-bold">
                    <tr>
                      <th className="py-1 px-2">الحساب</th>
                      <th className="py-1 px-2 text-left">مدين ({currencySymbol})</th>
                      <th className="py-1 px-2 text-left">دائن ({currencySymbol})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50 font-mono">
                    {selectedCheckForClear.type === 'INCOMING' ? (
                      <>
                        <tr>
                          <td className="py-1.5 px-2 font-sans text-slate-800">
                            حـ/ {bankAccounts.find(a => a.id === clearanceBankId)?.name || 'البنك المودع فيه'}
                          </td>
                          <td className="py-1.5 px-2 text-left font-bold text-emerald-700">
                            {Number(selectedCheckForClear.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-1.5 px-2 text-left text-slate-400">0.00</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-2 font-sans text-slate-800">
                            حـ/ شيكات تحت التحصيل (1104)
                          </td>
                          <td className="py-1.5 px-2 text-left text-slate-400">0.00</td>
                          <td className="py-1.5 px-2 text-left font-bold text-emerald-700">
                            {Number(selectedCheckForClear.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </>
                    ) : (
                      <>
                        <tr>
                          <td className="py-1.5 px-2 font-sans text-slate-800">
                            حـ/ شيكات صادرة برسم الصرف (2104)
                          </td>
                          <td className="py-1.5 px-2 text-left font-bold text-emerald-700">
                            {Number(selectedCheckForClear.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-1.5 px-2 text-left text-slate-400">0.00</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-2 font-sans text-slate-800">
                            حـ/ {bankAccounts.find(a => a.id === clearanceBankId)?.name || 'البنك المصروف منه'}
                          </td>
                          <td className="py-1.5 px-2 text-left text-slate-400">0.00</td>
                          <td className="py-1.5 px-2 text-left font-bold text-emerald-700">
                            {Number(selectedCheckForClear.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedCheckForClear(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 size={15} />
                <span>تأكيد الصرف وتوليد القيد الآلي</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Endorse Check to Vendor Modal (تظهير الشيك لمورد) */}
      {selectedCheckForEndorse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-purple-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={20} />
                <div>
                  <h3 className="font-black text-base">تظهير وتحويل الشيك لمورد (Check Endorsement)</h3>
                  <p className="text-xs text-purple-100">تحويل ملكية الشيك الوارد لسداد رصيد مورد وتوليد القيد آلياً</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedCheckForEndorse(null)}
                className="text-purple-100 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-purple-600 font-bold">الشيك المراد تظهيره:</div>
                  <div className="font-black text-slate-900 text-sm">
                    #{selectedCheckForEndorse.checkNumber} - من العميل: {selectedCheckForEndorse.partnerName}
                  </div>
                  <div className="text-slate-600 mt-0.5">البنك: {selectedCheckForEndorse.bankName}</div>
                </div>
                <div className="text-left font-mono">
                  <div className="text-[10px] text-slate-500">المبلغ</div>
                  <div className="font-black text-purple-700 text-base">
                    {Number(selectedCheckForEndorse.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">المورد المحول إليه الشيك (المظهر له) *</label>
                <select
                  value={endorsedVendorId}
                  onChange={(e) => setEndorsedVendorId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
                  required
                >
                  <option value="">-- اختر المورد المطلوب سداد حسابه --</option>
                  {vendorsList.map(v => (
                    <option key={v.id} value={v.id}>[{v.code || 'VND'}] {v.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">تاريخ التظهير والتحويل *</label>
                  <input
                    type="date"
                    value={endorsementDate}
                    onChange={(e) => setEndorsementDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">ملاحظات التظهير</label>
                  <input
                    type="text"
                    value={endorsementNotes}
                    onChange={(e) => setEndorsementNotes(e.target.value)}
                    placeholder="مثال: سداد دفعة من فاتورة توريد رقم..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Endorsement Journal Entry Preview */}
              <div className="p-3.5 bg-purple-50/70 rounded-xl border border-purple-200">
                <div className="flex items-center gap-1.5 text-purple-950 font-bold mb-2">
                  <Sparkles size={14} className="text-purple-600" />
                  <span>معاينة القيد المحاسبي لتظهير الشيك:</span>
                </div>
                <div className="text-[11px] text-slate-700 space-y-1">
                  <div className="flex justify-between font-mono bg-white p-1.5 rounded border border-purple-100">
                    <span>من حـ/ ذمم الموردين (2101) - {vendorsList.find(v => v.id === endorsedVendorId)?.name || 'المورد المختار'}</span>
                    <span className="font-bold text-purple-700">
                      {Number(selectedCheckForEndorse.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol} (مدين)
                    </span>
                  </div>
                  <div className="flex justify-between font-mono bg-white p-1.5 rounded border border-purple-100">
                    <span>إلى حـ/ شيكات تحت التحصيل (1104) - تخفيض الحافظة</span>
                    <span className="font-bold text-purple-700">
                      {Number(selectedCheckForEndorse.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol} (دائن)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedCheckForEndorse(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmEndorse}
                className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold shadow-md shadow-purple-700/20 cursor-pointer flex items-center gap-1.5"
              >
                <ArrowRightLeft size={15} />
                <span>تأكيد التظهير وتوليد القيد</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Bounce Check Modal */}
      {selectedCheckForBounce && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle size={20} />
                <div>
                  <h3 className="font-black text-base">تسجيل ارتداد الشيك (Bounced Check)</h3>
                  <p className="text-xs text-rose-100">سيتم عكس إقفال الشيك وإعادة المديونية للطرف المعني نظامياً</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedCheckForBounce(null)}
                className="text-rose-100 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-rose-600 font-bold">شيك مرتد:</div>
                  <div className="font-black text-slate-900 text-sm">
                    #{selectedCheckForBounce.checkNumber} - {selectedCheckForBounce.partnerName}
                  </div>
                </div>
                <div className="text-left font-mono">
                  <div className="font-black text-rose-700 text-base">
                    {Number(selectedCheckForBounce.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">سبب الارتداد البنكي *</label>
                <select
                  value={bounceReason}
                  onChange={(e) => setBounceReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 cursor-pointer"
                >
                  <option value="عدم كفاية الرصيد (Insufficient Funds)">عدم كفاية الرصيد (Insufficient Funds)</option>
                  <option value="توقيع غير مطابق (Signature Mismatch)">توقيع غير مطابق (Signature Mismatch)</option>
                  <option value="شيك مسحوب على حساب مغلق (Account Closed)">شيك مسحوب على حساب مغلق (Account Closed)</option>
                  <option value="شيك متقادم تجاوز المدة النظامية (Stale Check)">شيك متقادم تجاوز المدة النظامية (Stale Check)</option>
                  <option value="أمر إيقاف صرف من الساحب (Stop Payment)">أمر إيقاف صرف من الساحب (Stop Payment)</option>
                  <option value="شطب أو خطأ في كتابة المبلغ (Amount Altered)">شطب أو خطأ في كتابة المبلغ (Amount Altered)</option>
                  <option value="أخرى (سبب مخصص)">أخرى (سبب مخصص)</option>
                </select>
              </div>

              {bounceReason === 'أخرى (سبب مخصص)' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">اكتب سبب الارتداد *</label>
                  <input
                    type="text"
                    value={bounceCustomReason}
                    onChange={(e) => setBounceCustomReason(e.target.value)}
                    placeholder="وضح سبب رفض الشيك بالتفصيل..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">تاريخ الارتداد *</label>
                  <input
                    type="date"
                    value={bounceDate}
                    onChange={(e) => setBounceDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">مصاريف بنكية لرفض الشيك (إن وجدت)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bounceFee || ''}
                    onChange={(e) => setBounceFee(Number(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
                ℹ️ <strong>الأثر المحاسبي التلقائي:</strong> سيقوم النظام بإنشاء قيد يومية عكسي مدين فيه حساب الطرف (العميل 1201 / المورد 2101) ودائن حساب الشيكات (1104 / 2104) لضمان دقة كشف الحساب والذمم.
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedCheckForBounce(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmBounce}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-md shadow-rose-600/20 cursor-pointer flex items-center gap-1.5"
              >
                <XCircle size={15} />
                <span>تسجيل الارتداد وتوليد قيد العكس</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Bulk Clearance Modal */}
      {isBulkClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={20} />
                <div>
                  <h3 className="font-black text-base">تحصيل وصرف مجمع للشيكات المحددة</h3>
                  <p className="text-xs text-emerald-100">تحصيل ({selectedCheckIds.length}) شيك بقيمة إجمالية ({selectedTotalAmount.toLocaleString()} {currencySymbol})</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsBulkClearModalOpen(false)}
                className="text-emerald-100 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">تاريخ التحصيل الجماعي *</label>
                  <input
                    type="date"
                    value={bulkClearDate}
                    onChange={(e) => setBulkClearDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">حساب البنك المودع فيه *</label>
                  <select
                    value={bulkClearBankId || defaultBankId}
                    onChange={(e) => setBulkClearBankId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>[{b.code}] {b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">المرجع أو البيان الجماعي</label>
                <input
                  type="text"
                  value={bulkClearRef}
                  onChange={(e) => setBulkClearRef(e.target.value)}
                  placeholder="مثال: إيداع شيكات مجمعة بحافظة رقم..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed">
                ✓ سيتم تغيير حالة جميع الشيكات المحددة إلى <strong>(تم الصرف والتحصيل)</strong> وتوليد القيود المحاسبية المقابلة تلقائياً لكل شيك على حدة.
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBulkClearModalOpen(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkClear}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 size={15} />
                <span>تنفيذ التحصيل المجمع</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Printable Bank Deposit Slip (حافظة إيداع شيكات للبنك) */}
      {printableDepositSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8">
            {/* Top Toolbar */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Landmark size={20} className="text-amber-400" />
                <h3 className="font-bold text-sm">معاينة حافظة تسليم وإيداع الشيكات للبنك</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer size={14} />
                  <span>طباعة الحافظة الآن</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintableDepositSlip(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Document Paper */}
            <div className="p-8 bg-white text-slate-900 space-y-6 text-xs print:p-0 print:m-0" id="deposit-slip-print">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900">{companyName}</h2>
                  <p className="text-slate-500 text-[11px] mt-0.5">قسم الخزينة والحسابات العامة</p>
                </div>
                <div className="text-left font-mono">
                  <div className="text-base font-black text-blue-900">حافظة إيداع شيكات مصرفية</div>
                  <div className="text-xs text-slate-600 mt-1 font-bold">الرقم: {printableDepositSlip.slipNumber}</div>
                  <div className="text-xs text-slate-500">التاريخ: {printableDepositSlip.depositDate}</div>
                </div>
              </div>

              {/* Deposit Meta Box */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">البنك المودع فيه:</span>
                  <span className="font-bold text-slate-900">{printableDepositSlip.bankName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">عدد الشيكات المرفقة:</span>
                  <span className="font-bold font-mono text-blue-800">{printableDepositSlip.checks.length} شيك</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">إجمالي قيمة الحافظة:</span>
                  <span className="font-black font-mono text-emerald-800">
                    {printableDepositSlip.checks.reduce((s, c) => s + (Number(c.amount) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                  </span>
                </div>
              </div>

              {/* Checks Breakdown Table */}
              <table className="w-full text-right text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className="py-2 px-2.5 border border-slate-300 w-8 text-center">م</th>
                    <th className="py-2 px-3 border border-slate-300">رقم الشيك</th>
                    <th className="py-2 px-3 border border-slate-300">الساحب / العميل</th>
                    <th className="py-2 px-3 border border-slate-300">البنك المسحوب عليه</th>
                    <th className="py-2 px-3 border border-slate-300">تاريخ الاستحقاق</th>
                    <th className="py-2 px-3 border border-slate-300 text-left">المبلغ ({currencySymbol})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {printableDepositSlip.checks.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-2 px-2 border border-slate-300 text-center font-mono">{idx + 1}</td>
                      <td className="py-2 px-3 border border-slate-300 font-mono font-bold text-blue-900">#{c.checkNumber}</td>
                      <td className="py-2 px-3 border border-slate-300 font-bold text-slate-900">{c.partnerName}</td>
                      <td className="py-2 px-3 border border-slate-300">{c.bankName}</td>
                      <td className="py-2 px-3 border border-slate-300 font-mono">{c.dueDate}</td>
                      <td className="py-2 px-3 border border-slate-300 font-mono font-bold text-left text-slate-900">
                        {Number(c.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-900 text-slate-900">
                    <td colSpan={5} className="py-2.5 px-3 border border-slate-300 text-right font-black">
                      إجمالي مبلغ الحافظة:
                    </td>
                    <td className="py-2.5 px-3 border border-slate-300 font-mono font-black text-left text-emerald-800 text-sm">
                      {printableDepositSlip.checks.reduce((s, c) => s + (Number(c.amount) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Tafqeet in Arabic Words */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-amber-950 font-bold text-[11px]">
                المبلغ بالحروف: {tafqeetArabic(printableDepositSlip.checks.reduce((s, c) => s + (Number(c.amount) || 0), 0))}
              </div>

              {/* Signatures & Approvals */}
              <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-200 text-center">
                <div>
                  <span className="text-[11px] font-bold text-slate-700 block mb-8">مندوب تسليم الشركة:</span>
                  <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto"></div>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-700 block mb-8">أمين الخزينة / المحاسب:</span>
                  <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto"></div>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-700 block mb-8">توقيع وختم استلام البنك:</span>
                  <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Single Check Voucher Print Modal (سند استلام شيك رسمي) */}
      {printableSingleCheckVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Receipt size={20} className="text-amber-400" />
                <h3 className="font-bold text-sm">سند وحافظة استلام الشيك المصرفي #{printableSingleCheckVoucher.checkNumber}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer size={14} />
                  <span>طباعة السند</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintableSingleCheckVoucher(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-8 bg-white text-slate-900 space-y-5 text-xs print:p-0 print:m-0" id="single-check-print">
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900">{companyName}</h2>
                  <p className="text-slate-500 text-[11px]">سند استلام شيك مصرفي معتمد</p>
                </div>
                <div className="text-left font-mono">
                  <div className="text-sm font-black text-blue-900">CHQ-VOUCHER</div>
                  <div className="text-xs text-slate-700 font-bold">رقم الشيك: #{printableSingleCheckVoucher.checkNumber}</div>
                  <div className="text-xs text-slate-500">التاريخ: {printableSingleCheckVoucher.issueDate}</div>
                </div>
              </div>

              <div className="p-4 bg-linear-to-r from-amber-50 to-amber-100/50 rounded-xl border border-amber-300 text-center">
                <div className="text-[10px] text-amber-800 uppercase font-bold tracking-wider">مبلغ الشيك المصرفي</div>
                <div className="text-2xl font-black text-amber-950 font-mono mt-1">
                  {Number(printableSingleCheckVoucher.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                </div>
                <div className="text-xs font-bold text-amber-900 mt-1">
                  فقط: {tafqeetArabic(Number(printableSingleCheckVoucher.amount))}
                </div>
              </div>

              <div className="space-y-2 border border-slate-200 rounded-xl p-4 bg-slate-50/70 text-xs">
                <div className="grid grid-cols-2 gap-3 py-1 border-b border-slate-200">
                  <span className="text-slate-500">نوع العملية:</span>
                  <span className="font-bold">{printableSingleCheckVoucher.type === 'INCOMING' ? 'شيك وارد (قبض من عميل)' : 'شيك صادر (صرف لمورد)'}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 py-1 border-b border-slate-200">
                  <span className="text-slate-500">الطرف المسلم / المستفيد:</span>
                  <span className="font-bold text-slate-900">{printableSingleCheckVoucher.partnerName}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 py-1 border-b border-slate-200">
                  <span className="text-slate-500">البنك المسحوب عليه:</span>
                  <span className="font-bold">{printableSingleCheckVoucher.bankName}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 py-1 border-b border-slate-200">
                  <span className="text-slate-500">تاريخ الاستحقاق والصرف:</span>
                  <span className="font-mono font-bold text-blue-800">{printableSingleCheckVoucher.dueDate}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 py-1">
                  <span className="text-slate-500">حالة الشيك في الحافظة:</span>
                  <span className="font-bold">
                    {printableSingleCheckVoucher.status === 'UNDER_COLLECTION' && '⏳ تحت التحصيل بالخزينة'}
                    {printableSingleCheckVoucher.status === 'CLEARED' && '✅ تم الصرف والتحصيل بالبنك'}
                    {printableSingleCheckVoucher.status === 'ENDORSED' && `🔄 مظهر للمورد: ${printableSingleCheckVoucher.endorsedToVendorName}`}
                    {printableSingleCheckVoucher.status === 'BOUNCED' && '❌ مرتد ومرفوض بنكياً'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-200 text-center">
                <div>
                  <span className="text-[11px] font-bold text-slate-700 block mb-8">توقيع المستلم:</span>
                  <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto"></div>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-700 block mb-8">المدير المالي / الاعتماد:</span>
                  <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: View Auto Journal Entry */}
      {viewJournalEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-blue-400" />
                <div>
                  <h3 className="font-black text-base font-mono">
                    القيد اليومي المحاسبي [{viewJournalEntry.entryNumber}]
                  </h3>
                  <p className="text-xs text-slate-400">{viewJournalEntry.description}</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setViewJournalEntry(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 font-medium">
                <div>
                  <span className="text-[10px] text-slate-400 block">التاريخ</span>
                  <span className="font-mono font-bold">{viewJournalEntry.date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">المرجع</span>
                  <span className="font-semibold">{viewJournalEntry.reference || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">الحالة</span>
                  <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                    مرحل (POSTED)
                  </span>
                </div>
              </div>

              {/* Journal Items Table */}
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2 px-3">رقم واسم الحساب</th>
                    <th className="py-2 px-3 text-left font-mono">مدين ({currencySymbol})</th>
                    <th className="py-2 px-3 text-left font-mono">دائن ({currencySymbol})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewJournalEntry.items.map((item, idx) => {
                    const accs = loadChartOfAccounts();
                    const acc = accs.find(a => a.id === item.accountId || a.code === item.accountId);
                    return (
                      <tr key={idx} className="hover:bg-slate-50 font-mono">
                        <td className="py-2 px-3 font-sans">
                          <div className="font-bold text-slate-900">[{acc?.code || item.accountId}] {acc?.name || 'حساب'}</div>
                          {item.partnerName && (
                            <div className="text-[10px] text-slate-500 font-normal">الطرف: {item.partnerName}</div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-left font-black text-slate-900">
                          {Number(item.debit) > 0 ? Number(item.debit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="py-2 px-3 text-left font-black text-slate-900">
                          {Number(item.credit) > 0 ? Number(item.credit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold font-mono border-t border-slate-200 text-slate-900">
                    <td className="py-2 px-3 font-sans">الإجمالي المتوازن</td>
                    <td className="py-2 px-3 text-left text-emerald-700 font-black">
                      {viewJournalEntry.items.reduce((s, i) => s + (Number(i.debit) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-left text-emerald-700 font-black">
                      {viewJournalEntry.items.reduce((s, i) => s + (Number(i.credit) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    setViewJournalEntry(null);
                    onNavigate('journal');
                  }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  الانتقال إلى دفتر القيود اليومية ←
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewJournalEntry(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: Check Details / Card Modal */}
      {viewCheckCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark size={20} className="text-amber-400" />
                <h3 className="font-black text-sm">بطاقة الشيك المصرفي #{viewCheckCard.checkNumber}</h3>
              </div>
              <button type="button" onClick={() => setViewCheckCard(null)} className="text-slate-400 hover:text-white p-1 cursor-pointer">✕</button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="p-4 bg-linear-to-r from-amber-50 to-amber-100/60 rounded-xl border border-amber-300 text-center">
                <div className="text-[10px] text-amber-800 uppercase font-bold tracking-wider">مبلغ الشيك المصرفي</div>
                <div className="text-2xl font-black text-amber-950 font-mono mt-1">
                  {Number(viewCheckCard.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                </div>
              </div>

              <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/60">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">نوع الشيك:</span>
                  <span className="font-bold">{viewCheckCard.type === 'INCOMING' ? 'شيك وارد (قبض)' : 'شيك صادر (صرف)'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">الطرف:</span>
                  <span className="font-bold">{viewCheckCard.partnerName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">البنك المسحوب عليه:</span>
                  <span className="font-bold">{viewCheckCard.bankName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">تاريخ التحرير:</span>
                  <span className="font-mono">{viewCheckCard.issueDate}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">تاريخ الاستحقاق:</span>
                  <span className="font-mono font-bold text-blue-700">{viewCheckCard.dueDate}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">الحالة الحالية:</span>
                  <span className="font-bold">
                    {viewCheckCard.status === 'UNDER_COLLECTION' && '⏳ تحت التحصيل'}
                    {viewCheckCard.status === 'CLEARED' && '✅ تم الصرف والتحصيل'}
                    {viewCheckCard.status === 'ENDORSED' && `🔄 مظهر للمورد (${viewCheckCard.endorsedToVendorName})`}
                    {viewCheckCard.status === 'BOUNCED' && '❌ شيك مرتد'}
                  </span>
                </div>
                {viewCheckCard.journalEntryNumber && (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">رقم القيد الآلي:</span>
                    <span className="font-mono font-bold text-emerald-700">{viewCheckCard.journalEntryNumber}</span>
                  </div>
                )}
                {viewCheckCard.notes && (
                  <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-100">
                    ملاحظات: {viewCheckCard.notes}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  const target = viewCheckCard;
                  setViewCheckCard(null);
                  setPrintableSingleCheckVoucher(target);
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Printer size={13} />
                <span>طباعة سند الشيك</span>
              </button>
              <button
                type="button"
                onClick={() => setViewCheckCard(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 9: Register New Check Manually */}
      {isNewCheckModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus size={20} />
                <h3 className="font-black text-base">تسجيل شيك بنكي جديد في الحافظة</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsNewCheckModalOpen(false)}
                className="text-blue-100 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewCheck} className="p-5 space-y-4 text-xs">
              {/* Type Switcher */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">نوع الشيك *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCheckType('INCOMING')}
                    className={`py-2 px-3 rounded-lg font-bold border text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      newCheckType === 'INCOMING'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowDownLeft size={14} />
                    شيك وارد (قبض من عميل)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCheckType('OUTGOING')}
                    className={`py-2 px-3 rounded-lg font-bold border text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      newCheckType === 'OUTGOING'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowUpRight size={14} />
                    شيك صادر (صرف لمورد)
                  </button>
                </div>
              </div>

              {/* Number and Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">رقم الشيك المصرفي *</label>
                  <input
                    type="text"
                    value={newCheckNumber}
                    onChange={(e) => setNewCheckNumber(e.target.value)}
                    placeholder="مثال: CHQ-55921"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">مبلغ الشيك ({currencySymbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={newCheckAmount}
                    onChange={(e) => setNewCheckAmount(e.target.value ? Number(e.target.value) : '')}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-black focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    required
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">تاريخ التحرير / الاستلام *</label>
                  <input
                    type="date"
                    value={newCheckIssueDate}
                    onChange={(e) => setNewCheckIssueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">تاريخ الاستحقاق والصرف *</label>
                  <input
                    type="date"
                    value={newCheckDueDate}
                    onChange={(e) => setNewCheckDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-blue-700"
                    required
                  />
                </div>
              </div>

              {/* Bank & Partner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">البنك المسحوب عليه *</label>
                  <input
                    type="text"
                    value={newCheckBankName}
                    onChange={(e) => setNewCheckBankName(e.target.value)}
                    placeholder="مثال: مصرف الراجحي"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {newCheckType === 'INCOMING' ? 'اسم العميل / الساحب *' : 'اسم المورد / المستفيد *'}
                  </label>
                  <input
                    type="text"
                    value={newCheckPartnerName}
                    onChange={(e) => setNewCheckPartnerName(e.target.value)}
                    placeholder={newCheckType === 'INCOMING' ? 'اسم العميل أو الجهة الدافعة' : 'اسم المورد أو المستفيد'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">ملاحظات وبيان إضافي</label>
                <textarea
                  rows={2}
                  value={newCheckNotes}
                  onChange={(e) => setNewCheckNotes(e.target.value)}
                  placeholder="ملاحظات حول الشيك، الغرض، أو شروط الصرف..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-blue-900 text-[11px] leading-relaxed flex items-start gap-2">
                <Info size={16} className="shrink-0 mt-0.5 text-blue-600" />
                <div>
                  سيتم حفظ الشيك في الحافظة بحالة <strong>(تحت التحصيل ⏳)</strong>، وسيقوم النظام بتنبيهك تلقائياً قبل تاريخ استحقاقه لإيداعه أو صرفه وتوليد القيد المحاسبي.
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewCheckModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  حفظ الشيك في الحافظة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
