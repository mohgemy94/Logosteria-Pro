import { useState, useMemo, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  X,
  Eye,
  FileCheck,
  ShieldCheck,
  Percent,
  Layers,
  TrendingUp,
  Receipt,
  Sparkles
} from 'lucide-react';
import {
  InstallmentContract,
  InstallmentScheduleItem,
  PromissoryNote
} from '../types/installment';
import {
  getStoredInstallments,
  saveStoredInstallments,
  getStoredPromissoryNotes,
  saveStoredPromissoryNotes
} from '../data/mockInstallments';
import { getSystemSettings } from '../utils/settings';
import { useSystemCurrency } from '../utils/currency';
import { Partner } from '../types/accounting';
import { loadCustomers } from '../utils/partnerLedger';
import InstallmentKpiModal, { InstallmentKpiModalType } from './InstallmentKpiModal';
import ExportButtonGroup from './ExportButtonGroup';

export default function InstallmentsScreen() {
  const { symbol: currencySymbol, fullNameAr: currencyFullNameAr, tafqeet } = useSystemCurrency();
  const [activeTab, setActiveTab] = useState<'contracts' | 'schedule' | 'promissory' | 'calculator'>('contracts');
  const [contracts, setContracts] = useState<InstallmentContract[]>(() => getStoredInstallments());
  const [promissoryNotes, setPromissoryNotes] = useState<PromissoryNote[]>(() => getStoredPromissoryNotes());
  const [systemSettings] = useState(() => getSystemSettings());
  const [customers, setCustomers] = useState<Partner[]>(() => loadCustomers());

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [scheduleFilter, setScheduleFilter] = useState<'ALL' | 'OVERDUE' | 'DUE_SOON' | 'PAID'>('ALL');
  const [selectedContractForView, setSelectedContractForView] = useState<InstallmentContract | null>(null);

  // KPI Drill-Down Modal State
  const [kpiModalType, setKpiModalType] = useState<InstallmentKpiModalType | null>(null);

  // Modals
  const [isNewContractModalOpen, setIsNewContractModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedScheduleForPayment, setSelectedScheduleForPayment] = useState<{ contract: InstallmentContract; item: InstallmentScheduleItem } | null>(null);
  const [isPrintNoteModalOpen, setIsPrintNoteModalOpen] = useState(false);
  const [selectedNoteForPrint, setSelectedNoteForPrint] = useState<PromissoryNote | null>(null);
  const [isNewNoteModalOpen, setIsNewNoteModalOpen] = useState(false);

  // New Contract Form State
  const [newContract, setNewContract] = useState({
    customerName: '',
    customerPhone: '',
    customerNationalId: '',
    customerAddress: '',
    guarantorName: '',
    guarantorPhone: '',
    guarantorNationalId: '',
    guarantorAddress: '',
    itemDescription: '',
    cashPrice: 15000,
    downPayment: 3000,
    profitRate: 10,
    monthsCount: 6,
    startDate: new Date().toISOString().slice(0, 10),
    installmentFrequency: 'MONTHLY' as const,
    notes: '',
    autoGenerateNotes: true,
  });

  // Payment Form State
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    paymentMethod: 'CASH' as 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'CHECK',
    receiptVoucherNumber: '',
    discountAmount: 0,
    notes: ''
  });

  // Free Promissory Note Form State
  const [newFreeNote, setNewFreeNote] = useState({
    type: 'PROMISSORY_NOTE' as 'PROMISSORY_NOTE' | 'BILL_OF_EXCHANGE',
    drawee: '',
    draweeNationalId: '',
    draweePhone: '',
    draweeAddress: '',
    amount: 5000,
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    guarantor: '',
    guarantorNationalId: '',
    placeOfPayment: 'الرياض - المقر الرئيسي',
    bankName: 'مصرف الراجحي',
    notes: ''
  });

  // Calculator State
  const [calcPrice, setCalcPrice] = useState(25000);
  const [calcDown, setCalcDown] = useState(5000);
  const [calcRate, setCalcRate] = useState(12);
  const [calcMonths, setCalcMonths] = useState(12);

  // Sync with custom events
  useEffect(() => {
    const handleUpdate = () => {
      setContracts(getStoredInstallments());
      setPromissoryNotes(getStoredPromissoryNotes());
      setCustomers(loadCustomers());
    };
    window.addEventListener('alpha-installments-updated', handleUpdate);
    window.addEventListener('alpha-promissory-notes-updated', handleUpdate);
    window.addEventListener('alpha-customers-updated', handleUpdate);
    window.addEventListener('alpha-system-reset-completed', handleUpdate);
    window.addEventListener('alpha-data-changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('alpha-installments-updated', handleUpdate);
      window.removeEventListener('alpha-promissory-notes-updated', handleUpdate);
      window.removeEventListener('alpha-customers-updated', handleUpdate);
      window.removeEventListener('alpha-system-reset-completed', handleUpdate);
      window.removeEventListener('alpha-data-changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalFinancedSum = 0;
    let totalPaidSum = 0;
    let totalRemainingSum = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let totalProfitSum = 0;

    contracts.forEach(c => {
      totalFinancedSum += c.totalFinanced;
      totalPaidSum += c.totalPaid;
      totalRemainingSum += c.totalRemaining;
      totalProfitSum += c.profitAmount;

      c.schedule.forEach(s => {
        if (s.status === 'OVERDUE' || (s.status === 'PENDING' && new Date(s.dueDate) < new Date())) {
          overdueCount++;
          overdueAmount += s.remainingAmount;
        }
      });
    });

    const portfolioNotesCount = promissoryNotes.filter(n => n.status === 'PORTFOLIO').length;
    const collectedNotesCount = promissoryNotes.filter(n => n.status === 'COLLECTED').length;
    const bankNotesCount = promissoryNotes.filter(n => n.status === 'SENT_FOR_COLLECTION').length;

    return {
      totalFinancedSum,
      totalPaidSum,
      totalRemainingSum,
      overdueCount,
      overdueAmount,
      totalProfitSum,
      activeContractsCount: contracts.filter(c => c.status === 'ACTIVE').length,
      portfolioNotesCount,
      collectedNotesCount,
      bankNotesCount,
    };
  }, [contracts, promissoryNotes]);

  // Filtered Contracts
  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      const matchSearch =
        c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.itemDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.customerPhone && c.customerPhone.includes(searchQuery));
      
      const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [contracts, searchQuery, statusFilter]);

  // All schedules flattened
  const allSchedules = useMemo(() => {
    const list: { contract: InstallmentContract; item: InstallmentScheduleItem }[] = [];
    contracts.forEach(contract => {
      contract.schedule.forEach(item => {
        const isMatchSearch =
          contract.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          contract.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.promissoryNoteId && item.promissoryNoteId.toLowerCase().includes(searchQuery.toLowerCase()));

        if (!isMatchSearch) return;

        const isOverdue = item.status === 'OVERDUE' || (item.status === 'PENDING' && new Date(item.dueDate) < new Date());

        if (scheduleFilter === 'OVERDUE' && !isOverdue) return;
        if (scheduleFilter === 'PAID' && item.status !== 'PAID') return;
        if (scheduleFilter === 'DUE_SOON') {
          const now = new Date();
          const due = new Date(item.dueDate);
          const diffDays = (due.getTime() - now.getTime()) / (1000 * 3600 * 24);
          if (item.status === 'PAID' || diffDays < 0 || diffDays > 30) return;
        }

        list.push({ contract, item });
      });
    });

    return list.sort((a, b) => new Date(a.item.dueDate).getTime() - new Date(b.item.dueDate).getTime());
  }, [contracts, searchQuery, scheduleFilter]);

  // Filtered Promissory Notes
  const filteredNotes = useMemo(() => {
    return promissoryNotes.filter(n => {
      const matchSearch =
        n.noteNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.drawee.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.contractNumber && n.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchStatus = statusFilter === 'ALL' || n.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [promissoryNotes, searchQuery, statusFilter]);

  // Calculations for New Contract Modal
  const calculatedContractValues = useMemo(() => {
    const netPrincipal = Math.max(0, newContract.cashPrice - newContract.downPayment);
    const profit = Math.round((netPrincipal * (newContract.profitRate / 100) * (newContract.monthsCount / 12)));
    const totalFinanced = netPrincipal + profit;
    const singleInstallment = newContract.monthsCount > 0 ? Math.round((totalFinanced / newContract.monthsCount) * 100) / 100 : 0;
    return {
      netPrincipal,
      profit,
      totalFinanced,
      singleInstallment
    };
  }, [newContract]);

  // Create New Contract Handler
  const handleSaveContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContract.customerName.trim()) {
      alert('يرجى إدخال اسم العميل');
      return;
    }

    const contractId = 'cnt-' + Date.now();
    const contractNumber = `INS-${new Date().getFullYear()}-${String(contracts.length + 1).padStart(3, '0')}`;
    const { profit, totalFinanced, singleInstallment } = calculatedContractValues;

    // Generate Schedule
    const scheduleItems: InstallmentScheduleItem[] = [];
    const generatedNotes: PromissoryNote[] = [];

    const start = new Date(newContract.startDate);
    const principalPerMonth = Math.round((calculatedContractValues.netPrincipal / newContract.monthsCount) * 100) / 100;
    const profitPerMonth = Math.round((profit / newContract.monthsCount) * 100) / 100;

    for (let i = 1; i <= newContract.monthsCount; i++) {
      const dueDate = new Date(start);
      if (newContract.installmentFrequency === 'MONTHLY') {
        dueDate.setMonth(start.getMonth() + (i - 1));
      } else if (newContract.installmentFrequency === 'QUARTERLY') {
        dueDate.setMonth(start.getMonth() + (i - 1) * 3);
      } else {
        dueDate.setDate(start.getDate() + (i - 1) * 7);
      }

      const noteNumber = `PN-${new Date().getFullYear()}-${String(promissoryNotes.length + i).padStart(3, '0')}`;
      const scheduleId = `sch-${Date.now()}-${i}`;
      const dateStr = dueDate.toISOString().slice(0, 10);

      scheduleItems.push({
        id: scheduleId,
        contractId,
        installmentNumber: i,
        dueDate: dateStr,
        principalAmount: principalPerMonth,
        profitAmount: profitPerMonth,
        totalAmount: singleInstallment,
        paidAmount: 0,
        remainingAmount: singleInstallment,
        status: 'PENDING',
        promissoryNoteId: newContract.autoGenerateNotes ? noteNumber : undefined,
      });

      if (newContract.autoGenerateNotes) {
        generatedNotes.push({
          id: `pn-${Date.now()}-${i}`,
          noteNumber,
          contractId,
          contractNumber,
          installmentNumber: i,
          type: 'PROMISSORY_NOTE',
          issueDate: new Date().toISOString().slice(0, 10),
          dueDate: dateStr,
          amount: singleInstallment,
          amountInWords: tafqeet(singleInstallment),
          currency: currencyFullNameAr,
          drawee: newContract.customerName,
          draweeNationalId: newContract.customerNationalId,
          draweePhone: newContract.customerPhone,
          draweeAddress: newContract.customerAddress || 'المملكة العربية السعودية',
          drawer: systemSettings.company.nameAr || 'شركة لوجوستريا للأنظمة المحاسبية',
          payee: systemSettings.company.nameAr || 'شركة لوجوستريا للأنظمة المحاسبية',
          guarantor: newContract.guarantorName,
          guarantorNationalId: newContract.guarantorNationalId,
          guarantorPhone: newContract.guarantorPhone,
          placeOfPayment: systemSettings.company.city ? `${systemSettings.company.city} - المقر الرئيسي` : 'الرياض',
          status: 'PORTFOLIO',
          legalText: `أتعهد أنا الموقع أدناه بأن أدفع بموجب هذا السند لأمر دون قيد أو شرط لأمر / ${systemSettings.company.nameAr || 'الشركة'}، المبلغ الموضح أعلاه في ميعاد الاستحقاق المحدد.`,
          notes: `سند لأمر عن القسط رقم ${i} من عقد التقسيط رقم ${contractNumber}`
        });
      }
    }

    const createdContract: InstallmentContract = {
      id: contractId,
      contractNumber,
      date: new Date().toISOString().slice(0, 10),
      customerId: 'cust-' + Date.now(),
      customerName: newContract.customerName,
      customerPhone: newContract.customerPhone,
      customerNationalId: newContract.customerNationalId,
      customerAddress: newContract.customerAddress,
      guarantorName: newContract.guarantorName,
      guarantorPhone: newContract.guarantorPhone,
      guarantorNationalId: newContract.guarantorNationalId,
      guarantorAddress: newContract.guarantorAddress,
      itemDescription: newContract.itemDescription || 'بضاعة وأجهزة تجارية',
      cashPrice: Number(newContract.cashPrice),
      downPayment: Number(newContract.downPayment),
      profitRate: Number(newContract.profitRate),
      profitAmount: profit,
      totalFinanced,
      monthsCount: Number(newContract.monthsCount),
      installmentFrequency: newContract.installmentFrequency,
      installmentAmount: singleInstallment,
      startDate: newContract.startDate,
      status: 'ACTIVE',
      totalPaid: 0,
      totalRemaining: totalFinanced,
      notes: newContract.notes,
      schedule: scheduleItems
    };

    const updatedContracts = [createdContract, ...contracts];
    saveStoredInstallments(updatedContracts);
    setContracts(updatedContracts);

    if (generatedNotes.length > 0) {
      const updatedNotes = [...generatedNotes, ...promissoryNotes];
      saveStoredPromissoryNotes(updatedNotes);
      setPromissoryNotes(updatedNotes);
    }

    setIsNewContractModalOpen(false);
    alert(`تم حفظ عقد التقسيط ${contractNumber} بنجاح وتوليد ${scheduleItems.length} قسط وكمبيالة!`);
  };

  // Open Payment Modal
  const handleOpenPayment = (contract: InstallmentContract, item: InstallmentScheduleItem) => {
    setSelectedScheduleForPayment({ contract, item });
    setPaymentData({
      amount: item.remainingAmount,
      paymentMethod: 'CASH',
      receiptVoucherNumber: `RC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      discountAmount: 0,
      notes: `سداد القسط رقم ${item.installmentNumber} لعقد ${contract.contractNumber}`
    });
    setIsPayModalOpen(true);
  };

  // Execute Payment
  const handleExecutePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScheduleForPayment) return;

    const { contract, item } = selectedScheduleForPayment;
    const payAmount = Number(paymentData.amount);

    if (payAmount <= 0) {
      alert('يرجى إدخال مبلغ سداد صالح');
      return;
    }

    const updatedContracts = contracts.map(c => {
      if (c.id !== contract.id) return c;

      let newPaidTotal = 0;
      let newRemainingTotal = 0;

      const updatedSchedule = c.schedule.map(s => {
        if (s.id !== item.id) {
          newPaidTotal += s.paidAmount;
          newRemainingTotal += s.remainingAmount;
          return s;
        }

        const newPaid = s.paidAmount + payAmount;
        const newRemaining = Math.max(0, s.totalAmount - newPaid);
        const newStatus = newRemaining === 0 ? ('PAID' as const) : ('PARTIAL' as const);

        newPaidTotal += newPaid;
        newRemainingTotal += newRemaining;

        return {
          ...s,
          paidAmount: newPaid,
          remainingAmount: newRemaining,
          status: newStatus,
          paidDate: new Date().toISOString().slice(0, 10),
          paymentMethod: paymentData.paymentMethod,
          receiptVoucherNumber: paymentData.receiptVoucherNumber,
          notes: paymentData.notes
        };
      });

      const isAllPaid = updatedSchedule.every(s => s.status === 'PAID');

      return {
        ...c,
        totalPaid: newPaidTotal,
        totalRemaining: newRemainingTotal,
        status: isAllPaid ? ('COMPLETED' as const) : c.status,
        schedule: updatedSchedule
      };
    });

    // Also update associated promissory note status to COLLECTED if fully paid
    if (item.promissoryNoteId) {
      const updatedNotes = promissoryNotes.map(n => {
        if (n.noteNumber === item.promissoryNoteId) {
          return {
            ...n,
            status: 'COLLECTED' as const,
            collectionDate: new Date().toISOString().slice(0, 10),
            notes: `${n.notes || ''} - تم التحصيل بموجب إيصال ${paymentData.receiptVoucherNumber}`
          };
        }
        return n;
      });
      saveStoredPromissoryNotes(updatedNotes);
      setPromissoryNotes(updatedNotes);
    }

    saveStoredInstallments(updatedContracts);
    setContracts(updatedContracts);

    // Update view if currently opened
    if (selectedContractForView && selectedContractForView.id === contract.id) {
      const refreshed = updatedContracts.find(c => c.id === contract.id);
      if (refreshed) setSelectedContractForView(refreshed);
    }

    setIsPayModalOpen(false);
    alert(`تم تسجيل سداد القسط بمبلغ ${payAmount.toLocaleString()} ريال بنجاح!`);
  };

  // Change Promissory Note Status
  const handleUpdateNoteStatus = (noteId: string, newStatus: PromissoryNote['status']) => {
    const updatedNotes = promissoryNotes.map(n => {
      if (n.id === noteId) {
        return {
          ...n,
          status: newStatus,
          collectionDate: newStatus === 'COLLECTED' ? new Date().toISOString().slice(0, 10) : n.collectionDate
        };
      }
      return n;
    });
    saveStoredPromissoryNotes(updatedNotes);
    setPromissoryNotes(updatedNotes);
  };

  // Save Free Note Handler
  const handleSaveFreeNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFreeNote.drawee.trim() || Number(newFreeNote.amount) <= 0) {
      alert('يرجى ملء اسم المدين ومبلغ الكمبيالة');
      return;
    }

    const noteNumber = `${newFreeNote.type === 'PROMISSORY_NOTE' ? 'PN' : 'BE'}-${new Date().getFullYear()}-${String(promissoryNotes.length + 1).padStart(3, '0')}`;
    const amountVal = Number(newFreeNote.amount);

    const createdNote: PromissoryNote = {
      id: 'pn-' + Date.now(),
      noteNumber,
      type: newFreeNote.type,
      issueDate: newFreeNote.issueDate,
      dueDate: newFreeNote.dueDate,
      amount: amountVal,
      amountInWords: tafqeet(amountVal),
      currency: currencyFullNameAr,
      drawee: newFreeNote.drawee,
      draweeNationalId: newFreeNote.draweeNationalId,
      draweePhone: newFreeNote.draweePhone,
      draweeAddress: newFreeNote.draweeAddress || 'المملكة العربية السعودية',
      drawer: systemSettings.company.nameAr || 'شركة لوجوستريا للأنظمة المحاسبية',
      payee: systemSettings.company.nameAr || 'شركة لوجوستريا للأنظمة المحاسبية',
      guarantor: newFreeNote.guarantor,
      placeOfPayment: newFreeNote.placeOfPayment,
      bankName: newFreeNote.bankName,
      status: 'PORTFOLIO',
      legalText: `أتعهد أنا الموقع أدناه بأن أدفع بموجب هذا السند لأمر دون قيد أو شرط لأمر / ${systemSettings.company.nameAr || 'الشركة'}، المبلغ الموضح أعلاه في ميعاد الاستحقاق المحدد.`,
      notes: newFreeNote.notes
    };

    const updated = [createdNote, ...promissoryNotes];
    saveStoredPromissoryNotes(updated);
    setPromissoryNotes(updated);
    setIsNewNoteModalOpen(false);
    alert(`تم إنشاء الورقة التجارية برقم ${noteNumber} بنجاح!`);
  };

  return (
    <div className="flex flex-col flex-1 space-y-5" dir="rtl">
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">نظام التمويل والائتمان المالي</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2.5">
            <CreditCard className="text-emerald-600" size={28} />
            إدارة التقسيط والكمبيالات والسندات لأمر
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            متابعة عقود البيع بالتقسيط، جداول استهلاك الأقساط، محفظة الكمبيالات والسندات الإذنية، وسندات القبض.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsNewContractModalOpen(true)}
            className="btn-3d btn-3d-emerald text-xs sm:text-sm px-4 py-2.5 shadow-sm cursor-pointer"
          >
            <Plus size={16} />
            <span>إنشاء عقد تقسيط جديد</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewNoteModalOpen(true)}
            className="btn-3d btn-3d-slate text-xs sm:text-sm px-4 py-2.5 shadow-sm cursor-pointer"
          >
            <FileCheck size={16} />
            <span>تحرير كمبيالة / سند لأمر</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS OVERVIEW CARDS (Interactive with Drill-down Modals) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:hidden">
        {/* Total Financed */}
        <button
          type="button"
          onClick={() => setKpiModalType('TOTAL_FINANCED')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-400 hover:shadow-md transition-all duration-200 flex flex-col justify-between text-right cursor-pointer group"
          title="انقر لعرض تفاصيل إجمالي التمويل ومحفظة العقود"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2 w-full">
            <span className="text-xs font-semibold group-hover:text-blue-600 transition-colors">إجمالي مبالغ التقسيط</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="w-full">
            <div className="text-xl sm:text-2xl font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
              {metrics.totalFinancedSum.toLocaleString()} <span className="text-xs text-slate-500 font-normal">{currencySymbol}</span>
            </div>
            <div className="text-[11px] text-blue-600 font-medium mt-1 flex items-center justify-between">
              <span>{metrics.activeContractsCount} عقود تقسيط جارية</span>
              <span className="text-[10px] text-blue-500 underline opacity-0 group-hover:opacity-100 transition-opacity">عرض التفاصيل ←</span>
            </div>
          </div>
        </button>

        {/* Collected */}
        <button
          type="button"
          onClick={() => setKpiModalType('TOTAL_COLLECTED')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all duration-200 flex flex-col justify-between text-right cursor-pointer group"
          title="انقر لعرض تفاصيل التحصيلات وسجل الدفعات"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2 w-full">
            <span className="text-xs font-semibold group-hover:text-emerald-700 transition-colors">إجمالي المبالغ المحصلة</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="w-full">
            <div className="text-xl sm:text-2xl font-bold text-emerald-600 group-hover:text-emerald-700 transition-colors">
              {metrics.totalPaidSum.toLocaleString()} <span className="text-xs text-slate-500 font-normal">{currencySymbol}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>نسبة التحصيل: {metrics.totalFinancedSum > 0 ? Math.round((metrics.totalPaidSum / metrics.totalFinancedSum) * 100) : 0}%</span>
              <span className="text-[10px] text-emerald-600 underline opacity-0 group-hover:opacity-100 transition-opacity">كشف السداد ←</span>
            </div>
          </div>
        </button>

        {/* Remaining Balance */}
        <button
          type="button"
          onClick={() => setKpiModalType('TOTAL_REMAINING')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-400 hover:shadow-md transition-all duration-200 flex flex-col justify-between text-right cursor-pointer group"
          title="انقر لعرض المتبقي في ذمة العملاء وجدول الاستحقاقات"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2 w-full">
            <span className="text-xs font-semibold group-hover:text-amber-700 transition-colors">المتبقي في ذمة العملاء</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all shadow-xs">
              <Clock size={16} />
            </div>
          </div>
          <div className="w-full">
            <div className="text-xl sm:text-2xl font-bold text-amber-600 group-hover:text-amber-700 transition-colors">
              {metrics.totalRemainingSum.toLocaleString()} <span className="text-xs text-slate-500 font-normal">{currencySymbol}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>أرباح المرابحة: {metrics.totalProfitSum.toLocaleString()} {currencySymbol}</span>
              <span className="text-[10px] text-amber-600 underline opacity-0 group-hover:opacity-100 transition-opacity">جدول الذمم ←</span>
            </div>
          </div>
        </button>

        {/* Overdue Alerts */}
        <button
          type="button"
          onClick={() => setKpiModalType('OVERDUE_ALERTS')}
          className="bg-white p-4 rounded-2xl border border-red-200 shadow-xs hover:border-red-400 hover:shadow-md transition-all duration-200 flex flex-col justify-between text-right cursor-pointer group relative overflow-hidden"
          title="انقر لعرض تنبيهات الأقساط المتأخرة وإرسال رسائل التذكير"
        >
          {metrics.overdueCount > 0 && (
            <span className="absolute top-2 left-2 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
            </span>
          )}
          <div className="flex items-center justify-between text-slate-500 mb-2 w-full">
            <span className="text-xs font-semibold text-red-700 group-hover:text-red-800 transition-colors">الأقساط المتأخرة</span>
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all shadow-xs">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="w-full">
            <div className="text-xl sm:text-2xl font-bold text-red-600 group-hover:text-red-700 transition-colors">
              {metrics.overdueAmount.toLocaleString()} <span className="text-xs text-slate-500 font-normal">{currencySymbol}</span>
            </div>
            <div className="text-[11px] text-red-600 font-medium mt-1 flex items-center justify-between">
              <span>{metrics.overdueCount} قسط يستوجب المتابعة</span>
              <span className="text-[10px] text-red-700 underline font-bold">تنبيهات ومطالبة ←</span>
            </div>
          </div>
        </button>
      </div>

      {/* TABS NAVIGATION WITH 3D INTERACTIVITY */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs flex items-center gap-2 overflow-x-auto print:hidden">
        <button
          type="button"
          onClick={() => setActiveTab('contracts')}
          className={`btn-3d text-xs sm:text-sm px-4 py-2.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'contracts'
              ? 'btn-3d-emerald shadow-sm'
              : 'btn-3d-white text-slate-700'
          }`}
        >
          <CreditCard size={16} />
          <span>عقود وخطط التقسيط ({contracts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`btn-3d text-xs sm:text-sm px-4 py-2.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'schedule'
              ? 'btn-3d-blue shadow-sm'
              : 'btn-3d-white text-slate-700'
          }`}
        >
          <Layers size={16} />
          <span>جدول الأقساط وسجل السداد</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('promissory')}
          className={`btn-3d text-xs sm:text-sm px-4 py-2.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'promissory'
              ? 'btn-3d-slate shadow-sm'
              : 'btn-3d-white text-slate-700'
          }`}
        >
          <FileCheck size={16} />
          <span>محفظة الكمبيالات والسندات لأمر ({promissoryNotes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calculator')}
          className={`btn-3d text-xs sm:text-sm px-4 py-2.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'calculator'
              ? 'btn-3d-purple shadow-sm'
              : 'btn-3d-white text-slate-700'
          }`}
        >
          <Sparkles size={16} />
          <span>حاسبة التقسيط والأرباح</span>
        </button>
      </div>

      {/* TAB 1: CONTRACTS LIST */}
      {activeTab === 'contracts' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Filter Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث برقم العقد، اسم العميل، الهاتف، أو البيان..."
                className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">جميع الحالات</option>
                <option value="ACTIVE">عقود سارية (نشطة)</option>
                <option value="COMPLETED">عقود مسددة بالكامل</option>
                <option value="DEFAULTED">عقود متعثرة</option>
              </select>

              <ExportButtonGroup
                title="سجل عقود التقسيط والتمويل"
                filename="عقود_التقسيط"
                headers={[
                  'رقم العقد',
                  'اسم العميل',
                  'الهاتف',
                  'البيان / السلعة',
                  'إجمالي العقد',
                  'الدفعة الأولى',
                  'المسدد',
                  'المتبقي',
                  'عدد الأقساط',
                  'الحالة'
                ]}
                rows={filteredContracts.map(c => [
                  c.contractNumber,
                  c.customerName,
                  c.customerPhone || '',
                  c.itemDescription,
                  c.totalFinanced,
                  c.downPayment,
                  c.totalPaid,
                  c.totalRemaining,
                  c.monthsCount,
                  c.status === 'ACTIVE' ? 'ساري' : c.status === 'COMPLETED' ? 'مسدد' : 'متعثر'
                ])}
                size="sm"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3.5 px-4">رقم العقد</th>
                  <th className="py-3.5 px-4">العميل</th>
                  <th className="py-3.5 px-4">البيان / البضاعة</th>
                  <th className="py-3.5 px-4">إجمالي العقد</th>
                  <th className="py-3.5 px-4">المسدد</th>
                  <th className="py-3.5 px-4">المتبقي</th>
                  <th className="py-3.5 px-4">الأقساط</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredContracts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      لا توجد عقود تقسيط تطابق معايير البحث
                    </td>
                  </tr>
                ) : (
                  filteredContracts.map(contract => {
                    const paidPercentage = contract.totalFinanced > 0 ? Math.round((contract.totalPaid / contract.totalFinanced) * 100) : 0;
                    return (
                      <tr key={contract.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                          {contract.contractNumber}
                          <div className="text-[10px] text-slate-400 font-normal">{contract.date}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{contract.customerName}</div>
                          <div className="text-[11px] text-slate-500">{contract.customerPhone || 'بدون هاتف'}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-[200px] truncate" title={contract.itemDescription}>
                          {contract.itemDescription}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {contract.totalFinanced.toLocaleString()} {currencySymbol}
                          <div className="text-[10px] text-slate-400 font-normal">مقدم: {contract.downPayment.toLocaleString()} {currencySymbol}</div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-emerald-600">
                          {contract.totalPaid.toLocaleString()} {currencySymbol}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-amber-600">
                          {contract.totalRemaining.toLocaleString()} {currencySymbol}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-xs font-semibold text-slate-700">
                            {contract.monthsCount} أقساط × {contract.installmentAmount.toLocaleString()}
                          </div>
                          {/* Progress bar */}
                          <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${paidPercentage}%` }} />
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              contract.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : contract.status === 'ACTIVE'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {contract.status === 'COMPLETED' ? 'مكتمل ومسدد' : contract.status === 'ACTIVE' ? 'نشط وساري' : 'متعثر'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedContractForView(contract)}
                              className="btn-3d btn-3d-white p-1.5 text-slate-700 hover:text-emerald-700 cursor-pointer"
                              title="عرض تفاصيل العقد وجدول الأقساط"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedContractForView(contract);
                                setTimeout(() => window.print(), 200);
                              }}
                              className="btn-3d btn-3d-white p-1.5 text-slate-700 hover:text-blue-700 cursor-pointer"
                              title="طباعة العقد وجدول الاستهلاك"
                            >
                              <Printer size={15} />
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
        </div>
      )}

      {/* TAB 2: SCHEDULE LEDGER & COLLECTION */}
      {activeTab === 'schedule' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Filter Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث باسم العميل أو رقم العقد أو الكمبيالة..."
                className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={scheduleFilter}
                onChange={e => setScheduleFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">جميع الأقساط</option>
                <option value="OVERDUE">الأقساط المتأخرة فقط</option>
                <option value="DUE_SOON">مستحقة خلال 30 يوماً</option>
                <option value="PAID">الأقساط المسددة</option>
              </select>

              <ExportButtonGroup
                title="جدول استحقاق الأقساط والتحصيل"
                filename="جدول_الاقساط"
                headers={[
                  'رقم القسط',
                  'اسم العميل',
                  'رقم العقد',
                  'تاريخ الاستحقاق',
                  'مبلغ القسط',
                  'أصل المبلغ',
                  'الأرباح',
                  'المسدد',
                  'المتبقي',
                  'الكمبيالة',
                  'حالة القسط',
                  'سند القبض'
                ]}
                rows={allSchedules.map(({ contract, item }) => [
                  item.installmentNumber,
                  contract.customerName,
                  contract.contractNumber,
                  item.dueDate,
                  item.totalAmount,
                  item.principalAmount,
                  item.profitAmount,
                  item.paidAmount,
                  item.remainingAmount,
                  item.promissoryNoteId || 'غير محدد',
                  item.status === 'PAID' ? 'مسدد' : (item.status === 'OVERDUE' || (item.status === 'PENDING' && new Date(item.dueDate) < new Date())) ? 'متأخر' : item.status === 'PARTIAL' ? 'سداد جزئي' : 'مستحق',
                  item.receiptVoucherNumber || ''
                ])}
                size="sm"
              />
            </div>
          </div>

          {/* Schedule Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3.5 px-4">رقم القسط</th>
                  <th className="py-3.5 px-4">العميل والعقد</th>
                  <th className="py-3.5 px-4">تاريخ الاستحقاق</th>
                  <th className="py-3.5 px-4">مبلغ القسط</th>
                  <th className="py-3.5 px-4">المسدد</th>
                  <th className="py-3.5 px-4">المتبقي</th>
                  <th className="py-3.5 px-4">الكمبيالة</th>
                  <th className="py-3.5 px-4">حالة القسط</th>
                  <th className="py-3.5 px-4 text-center">إجراء السداد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      لا توجد أقساط مطابقة للمحددات
                    </td>
                  </tr>
                ) : (
                  allSchedules.map(({ contract, item }) => {
                    const isOverdue = item.status === 'OVERDUE' || (item.status === 'PENDING' && new Date(item.dueDate) < new Date());
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          قسط #{item.installmentNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{contract.customerName}</div>
                          <div className="text-[11px] text-emerald-600 font-mono">{contract.contractNumber}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          <div className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-slate-800'}`}>
                            {item.dueDate}
                          </div>
                          {isOverdue && <span className="text-[10px] text-red-500">متأخر عن موعده</span>}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {item.totalAmount.toLocaleString()} {currencySymbol}
                          <div className="text-[10px] text-slate-400 font-normal">أصل: {item.principalAmount} + ربح: {item.profitAmount}</div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-emerald-600">
                          {item.paidAmount.toLocaleString()} {currencySymbol}
                          {item.receiptVoucherNumber && (
                            <div className="text-[10px] text-slate-400">{item.receiptVoucherNumber}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-amber-600">
                          {item.remainingAmount.toLocaleString()} {currencySymbol}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {item.promissoryNoteId ? (
                            <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-xs font-semibold">
                              {item.promissoryNoteId}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">غير محدد</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              item.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800'
                                : isOverdue
                                ? 'bg-red-100 text-red-800'
                                : item.status === 'PARTIAL'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {item.status === 'PAID' ? 'مسدد بالكامل' : isOverdue ? 'متأخر' : item.status === 'PARTIAL' ? 'سداد جزئي' : 'مستحق'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {item.remainingAmount > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleOpenPayment(contract, item)}
                              className="btn-3d btn-3d-emerald inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold shadow-2xs cursor-pointer"
                            >
                              <Receipt size={14} />
                              <span>تحصيل وسداد</span>
                            </button>
                          ) : (
                            <span className="text-xs text-emerald-600 font-bold inline-flex items-center gap-1">
                              <CheckCircle2 size={14} />
                              تم السداد
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PROMISSORY NOTES PORTFOLIO */}
      {activeTab === 'promissory' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Filter Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث برقم الكمبيالة، اسم المسحوب عليه، السند..."
                className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">جميع أوراق المحفظة</option>
                <option value="PORTFOLIO">في المحفظة بالخزينة</option>
                <option value="SENT_FOR_COLLECTION">مرسلة للتحصيل بالبنك</option>
                <option value="COLLECTED">محصلة ومودعة</option>
                <option value="PROTESTED">مرفوضة / بروتستو</option>
                <option value="ENDORSED">مظهرة ومجيرة</option>
              </select>

              <ExportButtonGroup
                title="سجل محفظة الكمبيالات والسندات الإذنية"
                filename="محفظة_الكمبيالات"
                headers={[
                  'رقم الورقة',
                  'النوع',
                  'المسحوب عليه (المدين)',
                  'الضامن الكفيل',
                  'تاريخ التحرير',
                  'تاريخ الاستحقاق',
                  'المبلغ المالي',
                  'الحالة',
                  'رقم العقد المربوط'
                ]}
                rows={filteredNotes.map(n => [
                  n.noteNumber,
                  n.type === 'PROMISSORY_NOTE' ? 'سند لأمر' : 'كمبيالة تجارية',
                  n.drawee,
                  n.guarantor || 'لا يوجد',
                  n.issueDate,
                  n.dueDate,
                  n.amount,
                  n.status === 'PORTFOLIO' ? 'في المحفظة' : n.status === 'SENT_FOR_COLLECTION' ? 'مرسلة للتحصيل' : n.status === 'COLLECTED' ? 'محصلة' : n.status === 'PROTESTED' ? 'مرفوضة' : 'مجيرة',
                  n.contractNumber || ''
                ])}
                size="sm"
              />
            </div>
          </div>

          {/* Promissory Notes Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3.5 px-4">رقم الورقة / النوع</th>
                  <th className="py-3.5 px-4">المسحوب عليه (المدين)</th>
                  <th className="py-3.5 px-4">الضامن الكفيل</th>
                  <th className="py-3.5 px-4">تاريخ التحرير</th>
                  <th className="py-3.5 px-4">تاريخ الاستحقاق</th>
                  <th className="py-3.5 px-4">المبلغ المالي</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4 text-center">التحكم والطباعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredNotes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      لا توجد أوراق تجارية تطابق البحث
                    </td>
                  </tr>
                ) : (
                  filteredNotes.map(note => (
                    <tr key={note.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900">{note.noteNumber}</div>
                        <span className="text-[10px] text-emerald-600 font-semibold">
                          {note.type === 'PROMISSORY_NOTE' ? 'سند لأمر رسمي' : 'كمبيالة تجارية'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{note.drawee}</div>
                        <div className="text-[11px] text-slate-500">هوية: {note.draweeNationalId || '—'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {note.guarantor ? (
                          <div>
                            <span className="font-medium text-slate-800">{note.guarantor}</span>
                            <div className="text-[10px] text-slate-400">كفيل متضامن</div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{note.issueDate}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{note.dueDate}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {note.amount.toLocaleString()} {note.currency}
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          value={note.status}
                          onChange={e => handleUpdateNoteStatus(note.id, e.target.value as any)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border focus:outline-none cursor-pointer ${
                            note.status === 'COLLECTED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : note.status === 'SENT_FOR_COLLECTION'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : note.status === 'PROTESTED'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          <option value="PORTFOLIO">في المحفظة</option>
                          <option value="SENT_FOR_COLLECTION">برسم التحصيل</option>
                          <option value="COLLECTED">تم التحصيل</option>
                          <option value="PROTESTED">مرفوضة / بروتستو</option>
                          <option value="ENDORSED">مظهرة لطرف ثالث</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedNoteForPrint(note);
                            setIsPrintNoteModalOpen(true);
                          }}
                          className="btn-3d btn-3d-white inline-flex items-center gap-1 px-3 py-1.5 text-slate-700 text-xs font-bold cursor-pointer"
                        >
                          <Printer size={14} />
                          <span>معاينة وطباعة</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: CALCULATOR */}
      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="text-emerald-600" size={20} />
              حاسبة التقسيط الفورية
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              محاكاة سريعة لحساب الأقساط الشهرية، قيمة الأرباح المضافة، وجدول الاستهلاك المقترح قبل توقيع العقد.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">سعر السلعة كاش ({currencySymbol})</label>
              <input
                type="number"
                value={calcPrice}
                onChange={e => setCalcPrice(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الدفعة المقدمة ({currencySymbol})</label>
              <input
                type="number"
                value={calcDown}
                onChange={e => setCalcDown(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نسبة الربح السنوية %</label>
                <input
                  type="number"
                  value={calcRate}
                  onChange={e => setCalcRate(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">مدة التقسيط (أشهر)</label>
                <input
                  type="number"
                  value={calcMonths}
                  onChange={e => setCalcMonths(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setNewContract(prev => ({
                  ...prev,
                  cashPrice: calcPrice,
                  downPayment: calcDown,
                  profitRate: calcRate,
                  monthsCount: calcMonths
                }));
                setIsNewContractModalOpen(true);
              }}
              className="w-full btn-3d btn-3d-emerald py-3 text-xs sm:text-sm font-bold shadow-sm cursor-pointer"
            >
              تحويل المعطيات إلى عقد تقسيط رسمي ←
            </button>
          </div>

          {/* Calculator Results */}
          <div className="lg:col-span-2 bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col justify-between">
            {(() => {
              const netPrincipal = Math.max(0, calcPrice - calcDown);
              const profit = Math.round(netPrincipal * (calcRate / 100) * (calcMonths / 12));
              const totalAmount = netPrincipal + profit;
              const monthly = calcMonths > 0 ? Math.round((totalAmount / calcMonths) * 100) / 100 : 0;

              return (
                <div className="space-y-6">
                  <h4 className="font-bold text-slate-800 text-base border-b border-slate-200 pb-3">
                    ملخص التمويل وخطة الاستهلاك
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                      <span className="text-[11px] text-slate-500">أصل التمويل (صافي)</span>
                      <div className="text-lg font-bold text-slate-900 mt-1">{netPrincipal.toLocaleString()} {currencySymbol}</div>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                      <span className="text-[11px] text-slate-500">إجمالي الأرباح</span>
                      <div className="text-lg font-bold text-emerald-600 mt-1">{profit.toLocaleString()} {currencySymbol}</div>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                      <span className="text-[11px] text-slate-500">إجمالي العقد بالفوائد</span>
                      <div className="text-lg font-bold text-blue-600 mt-1">{totalAmount.toLocaleString()} {currencySymbol}</div>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                      <span className="text-[11px] text-slate-500">القسط الشهري</span>
                      <div className="text-lg font-bold text-emerald-700 mt-1">{monthly.toLocaleString()} {currencySymbol}</div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-xs font-bold text-slate-700 mb-2">الصيغة التفقيطية للقسط الدوري:</div>
                    <div className="text-xs font-medium text-emerald-800 bg-emerald-50 p-2.5 rounded-lg">
                      {tafqeet(monthly)}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL 1: NEW CONTRACT */}
      {isNewContractModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsNewContractModalOpen(false);
          }}
        >
          <div 
            className="bg-white rounded-t-3xl sm:rounded-3xl max-w-3xl w-full p-4 sm:p-6 md:p-8 shadow-2xl border border-slate-200 text-right max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-modalIn"
            onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Mobile Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-slate-200 shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="text-emerald-600" size={20} />
                <span>إنشاء عقد بيع بالتقسيط وإصدار الأوراق التجارية</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewContractModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveContract} className="space-y-4 text-xs sm:text-sm overflow-y-auto flex-1 pr-0.5">
              {/* Customer Info */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-800 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-blue-600" />
                    بيانات العميل (المشتري / المدين)
                  </span>
                  {customers.length > 0 && (
                    <span className="text-[11px] text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md font-medium">
                      متصل بسجل العملاء ({customers.length} عميل)
                    </span>
                  )}
                </div>

                {/* Fast Select from Existing Customers */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">
                    اختيار سريع من قاعدة بيانات العملاء (تعبئة تلقائية)
                  </label>
                  <select
                    onChange={e => {
                      const selected = customers.find(c => c.id === e.target.value);
                      if (selected) {
                        setNewContract(prev => ({
                          ...prev,
                          customerName: selected.name,
                          customerPhone: selected.phone || '',
                          customerNationalId: selected.taxNumber || '',
                          customerAddress: selected.address || ''
                        }));
                      }
                    }}
                    defaultValue=""
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs mb-2"
                  >
                    <option value="" disabled>-- اختر عميلاً مسجلاً لجلب بياناته تلقائياً --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''} {c.code ? `[${c.code}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">اسم العميل *</label>
                    <input
                      type="text"
                      required
                      value={newContract.customerName}
                      onChange={e => setNewContract({ ...newContract, customerName: e.target.value })}
                      placeholder="الاسم الثلاثي أو اسم الشركة"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">رقم الهوية / السجل التجاري</label>
                    <input
                      type="text"
                      value={newContract.customerNationalId}
                      onChange={e => setNewContract({ ...newContract, customerNationalId: e.target.value })}
                      placeholder="10XXXXXXXX"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">رقم الجوال *</label>
                    <input
                      type="text"
                      value={newContract.customerPhone}
                      onChange={e => setNewContract({ ...newContract, customerPhone: e.target.value })}
                      placeholder="05XXXXXXXX"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Guarantor Info */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <ShieldCheck size={16} className="text-purple-600" />
                  بيانات الكفيل الغارم / الضامن المتضامن (اختياري)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">اسم الكفيل</label>
                    <input
                      type="text"
                      value={newContract.guarantorName}
                      onChange={e => setNewContract({ ...newContract, guarantorName: e.target.value })}
                      placeholder="اسم الكفيل الضامن"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">رقم هوية الكفيل</label>
                    <input
                      type="text"
                      value={newContract.guarantorNationalId}
                      onChange={e => setNewContract({ ...newContract, guarantorNationalId: e.target.value })}
                      placeholder="10XXXXXXXX"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">هاتف الكفيل</label>
                    <input
                      type="text"
                      value={newContract.guarantorPhone}
                      onChange={e => setNewContract({ ...newContract, guarantorPhone: e.target.value })}
                      placeholder="05XXXXXXXX"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Financial & Installment Terms */}
              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200 space-y-3">
                <div className="font-bold text-emerald-950 flex items-center gap-1.5 text-xs">
                  <Percent size={16} className="text-emerald-700" />
                  شروط العقد، المبالغ، ونسب الأرباح
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">وصف البضاعة / الخدمة المباعة</label>
                  <input
                    type="text"
                    value={newContract.itemDescription}
                    onChange={e => setNewContract({ ...newContract, itemDescription: e.target.value })}
                    placeholder="مثال: توريد 5 أجهزة لابتوب + شاشات عرض"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">سعر الكاش ({currencySymbol})</label>
                    <input
                      type="number"
                      value={newContract.cashPrice}
                      onChange={e => setNewContract({ ...newContract, cashPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">الدفعة المقدمة ({currencySymbol})</label>
                    <input
                      type="number"
                      value={newContract.downPayment}
                      onChange={e => setNewContract({ ...newContract, downPayment: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">نسبة الربح %</label>
                    <input
                      type="number"
                      value={newContract.profitRate}
                      onChange={e => setNewContract({ ...newContract, profitRate: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">عدد الأقساط (أشهر)</label>
                    <input
                      type="number"
                      value={newContract.monthsCount}
                      onChange={e => setNewContract({ ...newContract, monthsCount: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">تاريخ استحقاق أول قسط</label>
                    <input
                      type="date"
                      value={newContract.startDate}
                      onChange={e => setNewContract({ ...newContract, startDate: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="autoGen"
                      checked={newContract.autoGenerateNotes}
                      onChange={e => setNewContract({ ...newContract, autoGenerateNotes: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <label htmlFor="autoGen" className="text-slate-800 font-bold cursor-pointer">
                      توليد كمبيالات وسندات لأمر تلقائياً لكل قسط
                    </label>
                  </div>
                </div>

                {/* Calculation summary banner */}
                <div className="bg-white p-3.5 rounded-xl border border-emerald-200 grid grid-cols-3 text-center">
                  <div>
                    <span className="text-[11px] text-slate-500">إجمالي الأرباح</span>
                    <div className="font-bold text-emerald-700">{calculatedContractValues.profit.toLocaleString()} {currencySymbol}</div>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500">إجمالي العقد بالفوائد</span>
                    <div className="font-bold text-blue-700">{calculatedContractValues.totalFinanced.toLocaleString()} {currencySymbol}</div>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500">قيمة القسط الشهري</span>
                    <div className="font-bold text-emerald-800 text-sm sm:text-base">
                      {calculatedContractValues.singleInstallment.toLocaleString()} {currencySymbol}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewContractModalOpen(false)}
                  className="btn-3d btn-3d-white px-5 py-2.5 text-slate-700 font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn-3d btn-3d-emerald px-6 py-2.5 text-white font-bold shadow-sm cursor-pointer"
                >
                  اعتماد وحفظ العقد وتوليد الأقساط ←
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EXECUTE PAYMENT */}
      {isPayModalOpen && selectedScheduleForPayment && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPayModalOpen(false);
          }}
        >
          <div 
            className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 text-right max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-modalIn"
            onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Mobile Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-slate-200 shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="text-emerald-600" size={20} />
                <span>تحصيل وسداد قسط / سند قبض</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleExecutePayment} className="space-y-4 text-xs sm:text-sm overflow-y-auto flex-1 pr-0.5">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">العميل:</span>
                  <span className="font-bold text-slate-900">{selectedScheduleForPayment.contract.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">العقد والقسط:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {selectedScheduleForPayment.contract.contractNumber} (قسط #{selectedScheduleForPayment.item.installmentNumber})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">المبلغ المستحق:</span>
                  <span className="font-bold text-amber-700">
                    {selectedScheduleForPayment.item.remainingAmount.toLocaleString()} {currencySymbol}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">المبلغ المراد تحصيله ({currencySymbol}) *</label>
                <input
                  type="number"
                  required
                  value={paymentData.amount}
                  onChange={e => setPaymentData({ ...paymentData, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-base text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">طريقة السداد</label>
                  <select
                    value={paymentData.paymentMethod}
                    onChange={e => setPaymentData({ ...paymentData, paymentMethod: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none"
                  >
                    <option value="CASH">نقدي في الخزينة</option>
                    <option value="BANK_TRANSFER">تحويل بنكي</option>
                    <option value="CARD">بطاقة بنكية / مدى</option>
                    <option value="CHECK">شيك مصرفي</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">رقم سند القبض</label>
                  <input
                    type="text"
                    value={paymentData.receiptVoucherNumber}
                    onChange={e => setPaymentData({ ...paymentData, receiptVoucherNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">ملاحظات التحصيل</label>
                <input
                  type="text"
                  value={paymentData.notes}
                  onChange={e => setPaymentData({ ...paymentData, notes: e.target.value })}
                  placeholder="ملاحظات السداد أو رقم الإيداع"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="btn-3d btn-3d-white px-5 py-2.5 text-slate-700 font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn-3d btn-3d-emerald px-6 py-2.5 text-white font-bold shadow-sm cursor-pointer"
                >
                  تأكيد السداد وإصدار الإيصال ←
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW SINGLE CONTRACT & DETAILED SCHEDULE */}
      {selectedContractForView && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedContractForView(null);
          }}
        >
          <div 
            className="bg-white rounded-t-3xl sm:rounded-3xl max-w-4xl w-full p-4 sm:p-6 md:p-8 shadow-2xl border border-slate-200 text-right max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-modalIn"
            onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Mobile Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3 sm:pb-4 mb-4 sm:mb-6 border-b border-slate-200 print:hidden shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                  <FileCheck size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-xl font-bold text-slate-900 truncate">
                    عقد بيع بالتقسيط رقم: {selectedContractForView.contractNumber}
                  </h3>
                  <div className="text-xs text-slate-500">تاريخ التحرير: {selectedContractForView.date}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-3d btn-3d-white flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  <Printer size={15} />
                  <span className="hidden sm:inline">طباعة العقد</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedContractForView(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Contract Body (Printable) */}
            <div className="space-y-6 text-xs sm:text-sm overflow-y-auto flex-1 pr-0.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <h5 className="font-bold text-slate-900 mb-2">طرف أول (البائع / الدائن):</h5>
                  <p className="text-slate-700 font-semibold">{systemSettings.company.nameAr || 'شركة لوجوستريا للمحاسبة'}</p>
                  <p className="text-slate-500 text-xs">س.ت: {systemSettings.company.commercialRegister || '1010000000'}</p>
                  <p className="text-slate-500 text-xs">الرقم الضريبي: {systemSettings.company.taxNumber || '300000000000003'}</p>
                </div>
                <div>
                  <h5 className="font-bold text-slate-900 mb-2">طرف ثان (المشتري / المدين):</h5>
                  <p className="text-slate-700 font-semibold">{selectedContractForView.customerName}</p>
                  <p className="text-slate-500 text-xs">الهوية / السجل: {selectedContractForView.customerNationalId || '—'}</p>
                  <p className="text-slate-500 text-xs">الهاتف: {selectedContractForView.customerPhone}</p>
                  {selectedContractForView.guarantorName && (
                    <p className="text-purple-700 text-xs font-semibold mt-1">
                      الكفيل الغارم: {selectedContractForView.guarantorName} ({selectedContractForView.guarantorPhone})
                    </p>
                  )}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                  <span className="text-slate-400 text-[11px]">سعر الكاش</span>
                  <div className="font-bold text-slate-900 text-sm mt-1">{selectedContractForView.cashPrice.toLocaleString()} {currencySymbol}</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                  <span className="text-slate-400 text-[11px]">الدفعة المقدمة</span>
                  <div className="font-bold text-slate-900 text-sm mt-1">{selectedContractForView.downPayment.toLocaleString()} {currencySymbol}</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                  <span className="text-slate-400 text-[11px]">أرباح المرابحة ({selectedContractForView.profitRate}%)</span>
                  <div className="font-bold text-emerald-700 text-sm mt-1">{selectedContractForView.profitAmount.toLocaleString()} {currencySymbol}</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                  <span className="text-slate-400 text-[11px]">إجمالي قيمة العقد</span>
                  <div className="font-bold text-blue-700 text-sm mt-1">{selectedContractForView.totalFinanced.toLocaleString()} {currencySymbol}</div>
                </div>
              </div>

              {/* Schedule Table */}
              <div>
                <h5 className="font-bold text-slate-900 mb-3 flex items-center justify-between">
                  <span>جدول استهلاك الأقساط والاستحقاقات:</span>
                  <span className="text-xs text-slate-500 font-normal">
                    مسدد: {selectedContractForView.totalPaid.toLocaleString()} {currencySymbol} | متبقي: {selectedContractForView.totalRemaining.toLocaleString()} {currencySymbol}
                  </span>
                </h5>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="py-2.5 px-3">القسط #</th>
                        <th className="py-2.5 px-3">تاريخ الاستحقاق</th>
                        <th className="py-2.5 px-3">المبلغ</th>
                        <th className="py-2.5 px-3">المسدد</th>
                        <th className="py-2.5 px-3">المتبقي</th>
                        <th className="py-2.5 px-3">الكمبيالة</th>
                        <th className="py-2.5 px-3">الحالة</th>
                        <th className="py-2.5 px-3 text-center print:hidden">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedContractForView.schedule.map(sch => (
                        <tr key={sch.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-bold">#{sch.installmentNumber}</td>
                          <td className="py-2.5 px-3 font-mono">{sch.dueDate}</td>
                          <td className="py-2.5 px-3 font-bold">{sch.totalAmount.toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-emerald-600 font-semibold">{sch.paidAmount.toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-amber-600 font-semibold">{sch.remainingAmount.toLocaleString()}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{sch.promissoryNoteId || '—'}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                sch.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {sch.status === 'PAID' ? 'مسدد' : 'مستحق'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center print:hidden">
                            {sch.remainingAmount > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenPayment(selectedContractForView, sch)}
                                className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold cursor-pointer"
                              >
                                سداد
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-200 text-center">
                <div>
                  <div className="text-xs font-bold text-slate-700">توقيع وختم الطرف الأول (البائع)</div>
                  <div className="h-14 flex items-end justify-center text-slate-300 text-xs font-serif">.........................</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-700">توقيع الطرف الثاني (المشتري)</div>
                  <div className="h-14 flex items-end justify-center text-slate-300 text-xs font-serif">.........................</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-700">توقيع الكفيل الغارم</div>
                  <div className="h-14 flex items-end justify-center text-slate-300 text-xs font-serif">.........................</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: PRINT PROMISSORY NOTE (Official Legal Template) */}
      {isPrintNoteModalOpen && selectedNoteForPrint && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPrintNoteModalOpen(false);
          }}
        >
          <div 
            className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full p-4 sm:p-6 md:p-8 shadow-2xl border border-slate-200 text-right max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-modalIn"
            onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Mobile Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-slate-200 print:hidden shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="text-emerald-600" size={18} />
                <span>معاينة السند الإذني / الكمبيالة القانونية</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-3d btn-3d-emerald flex items-center gap-1 px-3 sm:px-3.5 py-1.5 text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Printer size={14} />
                  <span>طباعة الورقة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintNoteModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Official Legal Promissory Note Sheet (Scrollable) */}
            <div className="overflow-y-auto flex-1 pr-0.5 space-y-4">
            <div className="border-4 border-double border-slate-800 p-6 sm:p-8 rounded-2xl bg-[#fffdf8] text-slate-950 space-y-6">
              <div className="text-center border-b-2 border-slate-800 pb-4">
                <div className="text-xs tracking-widest text-slate-600 font-bold mb-1">المملكة العربية السعودية - نظام الأوراق التجارية</div>
                <h2 className="text-2xl font-bold font-serif">
                  {selectedNoteForPrint.type === 'PROMISSORY_NOTE' ? 'سـنــــد لأمـــــر' : 'كـمـبـيـالــــة تـجـاريــــة'}
                </h2>
                <div className="flex justify-between items-center mt-3 text-xs font-mono font-bold">
                  <span>الرقم: {selectedNoteForPrint.noteNumber}</span>
                  <span>المبلغ: {selectedNoteForPrint.amount.toLocaleString()} {selectedNoteForPrint.currency}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-600">تاريخ التحرير:</span>{' '}
                  <span className="font-bold font-mono">{selectedNoteForPrint.issueDate}م</span>
                </div>
                <div>
                  <span className="text-slate-600">تاريخ الاستحقاق:</span>{' '}
                  <span className="font-bold font-mono">{selectedNoteForPrint.dueDate}م</span>
                </div>
                <div>
                  <span className="text-slate-600">مكان التحرير والوفاء:</span>{' '}
                  <span className="font-bold">{selectedNoteForPrint.placeOfPayment}</span>
                </div>
              </div>

              <div className="bg-slate-100/70 p-4 rounded-xl text-sm leading-loose text-justify font-serif border border-slate-300">
                أتعهد أنا الموقع أدناه بأن أدفع بموجب هذا السند لأمر دون قيد أو شرط لأمر /{' '}
                <strong className="text-slate-950 font-bold underline">{selectedNoteForPrint.payee}</strong>، المبلغ وقدره:{' '}
                <strong className="text-emerald-950 font-bold">{selectedNoteForPrint.amountInWords}</strong>، وذلك وفاءً للقيمة
                المستحقة بذمتي في ميعاد الاستحقاق المحدد أعلاه دون حاجة إلى احتجاج أو إشعار بعدم الدفع.
              </div>

              <div className="grid grid-cols-2 gap-6 pt-4 text-xs">
                <div className="border border-slate-300 p-3 rounded-xl space-y-1">
                  <div className="font-bold text-slate-900 mb-1">بيانات المحرر (المدين / المشتري):</div>
                  <div>الاسم: <strong>{selectedNoteForPrint.drawee}</strong></div>
                  <div>رقم الهوية: <strong>{selectedNoteForPrint.draweeNationalId || '—'}</strong></div>
                  <div>الجوال: <strong>{selectedNoteForPrint.draweePhone || '—'}</strong></div>
                  <div className="pt-4 text-center">
                    <span>التوقيع والبصمة:</span>
                    <div className="h-10 border-b border-dashed border-slate-400 mt-2" />
                  </div>
                </div>

                <div className="border border-slate-300 p-3 rounded-xl space-y-1">
                  <div className="font-bold text-slate-900 mb-1">بيانات الكفيل الغارم المتضامن:</div>
                  <div>الاسم: <strong>{selectedNoteForPrint.guarantor || '—'}</strong></div>
                  <div>رقم الهوية: <strong>{selectedNoteForPrint.guarantorNationalId || '—'}</strong></div>
                  <div>الجوال: <strong>{selectedNoteForPrint.guarantorPhone || '—'}</strong></div>
                  <div className="pt-4 text-center">
                    <span>توقيع الكفيل:</span>
                    <div className="h-10 border-b border-dashed border-slate-400 mt-2" />
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: NEW FREE PROMISSORY NOTE */}
      {isNewNoteModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsNewNoteModalOpen(false);
          }}
        >
          <div 
            className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 text-right max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-modalIn"
            onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Mobile Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-slate-200 shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="text-emerald-600" size={20} />
                <span>تحرير كمبيالة أو سند لأمر مستقل</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewNoteModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveFreeNote} className="space-y-4 text-xs sm:text-sm overflow-y-auto flex-1 pr-0.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">نوع الورقة التجارية</label>
                  <select
                    value={newFreeNote.type}
                    onChange={e => setNewFreeNote({ ...newFreeNote, type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  >
                    <option value="PROMISSORY_NOTE">سند لأمر رسمي</option>
                    <option value="BILL_OF_EXCHANGE">كمبيالة تجارية</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">المبلغ المالي ({currencySymbol}) *</label>
                  <input
                    type="number"
                    required
                    value={newFreeNote.amount}
                    onChange={e => setNewFreeNote({ ...newFreeNote, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-semibold text-xs">اسم المسحوب عليه (المدين) *</label>
                  {customers.length > 0 && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md font-medium">
                      اختيار من سجل العملاء
                    </span>
                  )}
                </div>

                {/* Fast Select from Customers */}
                <select
                  onChange={e => {
                    const selected = customers.find(c => c.id === e.target.value);
                    if (selected) {
                      setNewFreeNote(prev => ({
                        ...prev,
                        drawee: selected.name,
                        draweePhone: selected.phone || '',
                        draweeNationalId: selected.taxNumber || '',
                        draweeAddress: selected.address || ''
                      }));
                    }
                  }}
                  defaultValue=""
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs mb-2"
                >
                  <option value="" disabled>-- اختر من قاعدة بيانات العملاء لجلب البيانات تلقائياً --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''} {c.code ? `[${c.code}]` : ''}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  required
                  value={newFreeNote.drawee}
                  onChange={e => setNewFreeNote({ ...newFreeNote, drawee: e.target.value })}
                  placeholder="اسم الشخص أو المؤسسة المدينة"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">رقم الهوية الوطنية</label>
                  <input
                    type="text"
                    value={newFreeNote.draweeNationalId}
                    onChange={e => setNewFreeNote({ ...newFreeNote, draweeNationalId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">رقم الجوال</label>
                  <input
                    type="text"
                    value={newFreeNote.draweePhone}
                    onChange={e => setNewFreeNote({ ...newFreeNote, draweePhone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">تاريخ التحرير</label>
                  <input
                    type="date"
                    value={newFreeNote.issueDate}
                    onChange={e => setNewFreeNote({ ...newFreeNote, issueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">تاريخ الاستحقاق *</label>
                  <input
                    type="date"
                    required
                    value={newFreeNote.dueDate}
                    onChange={e => setNewFreeNote({ ...newFreeNote, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">الكفيل الضامن (إن وجد)</label>
                <input
                  type="text"
                  value={newFreeNote.guarantor}
                  onChange={e => setNewFreeNote({ ...newFreeNote, guarantor: e.target.value })}
                  placeholder="اسم الكفيل المتضامن"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNewNoteModalOpen(false)}
                  className="btn-3d btn-3d-white px-5 py-2.5 text-slate-700 font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn-3d btn-3d-emerald px-6 py-2.5 text-white font-bold shadow-sm cursor-pointer"
                >
                  حفظ في محفظة الأوراق المالية ←
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KPI DRILL-DOWN MODAL */}
      <InstallmentKpiModal
        type={kpiModalType}
        isOpen={Boolean(kpiModalType)}
        onClose={() => setKpiModalType(null)}
        contracts={contracts}
        onOpenPayment={(contract, item) => {
          handleOpenPayment(contract, item);
        }}
        onSelectContractForView={contract => {
          setSelectedContractForView(contract);
        }}
      />
    </div>
  );
}
