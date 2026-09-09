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

export default function InstallmentsScreen() {
  const { symbol: currencySymbol, fullNameAr: currencyFullNameAr, tafqeet } = useSystemCurrency();
  const [activeTab, setActiveTab] = useState<'contracts' | 'schedule' | 'promissory' | 'calculator'>('contracts');
  const [contracts, setContracts] = useState<InstallmentContract[]>(() => getStoredInstallments());
  const [promissoryNotes, setPromissoryNotes] = useState<PromissoryNote[]>(() => getStoredPromissoryNotes());
  const [systemSettings] = useState(() => getSystemSettings());

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [scheduleFilter, setScheduleFilter] = useState<'ALL' | 'OVERDUE' | 'DUE_SOON' | 'PAID'>('ALL');
  const [selectedContractForView, setSelectedContractForView] = useState<InstallmentContract | null>(null);

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
    };
    window.addEventListener('alpha-installments-updated', handleUpdate);
    window.addEventListener('alpha-promissory-notes-updated', handleUpdate);
    return () => {
      window.removeEventListener('alpha-installments-updated', handleUpdate);
      window.removeEventListener('alpha-promissory-notes-updated', handleUpdate);
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
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={16} />
            <span>إنشاء عقد تقسيط جديد</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewNoteModalOpen(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <FileCheck size={16} />
            <span>تحرير كمبيالة / سند لأمر</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:hidden">
        {/* Total Financed */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">إجمالي مبالغ التقسيط</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900">
              {metrics.totalFinancedSum.toLocaleString()} <span className="text-xs text-slate-500 font-normal">{currencySymbol}</span>
            </div>
            <div className="text-[11px] text-blue-600 font-medium mt-1">
              {metrics.activeContractsCount} عقود تقسيط جارية
            </div>
          </div>
        </div>

        {/* Collected */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">إجمالي المبالغ المحصلة</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-600">
              {metrics.totalPaidSum.toLocaleString()} <span className="text-xs text-slate-500 font-normal">{currencySymbol}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              نسبة التحصيل: {metrics.totalFinancedSum > 0 ? Math.round((metrics.totalPaidSum / metrics.totalFinancedSum) * 100) : 0}%
            </div>
          </div>
        </div>

        {/* Remaining Balance */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">المتبقي في ذمة العملاء</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-amber-600">
              {metrics.totalRemainingSum.toLocaleString()} <span className="text-xs text-slate-500 font-normal">{currencySymbol}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              أرباح المرابحة: {metrics.totalProfitSum.toLocaleString()} {currencySymbol}
            </div>
          </div>
        </div>

        {/* Overdue Alerts */}
        <div className="bg-white p-4 rounded-2xl border border-red-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-red-700">الأقساط المتأخرة</span>
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-red-600">
              {metrics.overdueAmount.toLocaleString()} <span className="text-xs text-slate-500 font-normal">{currencySymbol}</span>
            </div>
            <div className="text-[11px] text-red-600 font-medium mt-1">
              {metrics.overdueCount} قسط يستوجب المتابعة العاجلة
            </div>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="bg-white rounded-2xl border border-slate-200 p-1.5 shadow-xs flex items-center gap-1 overflow-x-auto print:hidden">
        <button
          type="button"
          onClick={() => setActiveTab('contracts')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'contracts'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CreditCard size={16} />
          <span>عقود وخطط التقسيط ({contracts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'schedule'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers size={16} />
          <span>جدول الأقساط وسجل السداد</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('promissory')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'promissory'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileCheck size={16} />
          <span>محفظة الكمبيالات والسندات لأمر ({promissoryNotes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calculator')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'calculator'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
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
            <div className="flex items-center gap-2 w-full sm:w-auto">
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
                              className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                              title="عرض تفاصيل العقد وجدول الأقساط"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedContractForView(contract);
                                setTimeout(() => window.print(), 200);
                              }}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              title="طباعة العقد وجدول الاستهلاك"
                            >
                              <Printer size={16} />
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
            <div className="flex items-center gap-2 w-full sm:w-auto">
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
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
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
            <div className="flex items-center gap-2 w-full sm:w-auto">
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
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
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
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer shadow-xs"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-auto text-right">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="text-emerald-600" size={20} />
                إنشاء عقد بيع بالتقسيط وإصدار الأوراق التجارية
              </h3>
              <button
                type="button"
                onClick={() => setIsNewContractModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveContract} className="space-y-4 text-xs sm:text-sm">
              {/* Customer Info */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <ShieldCheck size={16} className="text-blue-600" />
                  بيانات العميل (المشتري / المدين)
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
                  className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-auto text-right">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="text-emerald-600" size={20} />
                تحصيل وسداد قسط / سند قبض
              </h3>
              <button
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleExecutePayment} className="space-y-4 text-xs sm:text-sm">
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

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-auto text-right">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200 print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <FileCheck size={20} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                    عقد بيع بالتقسيط رقم: {selectedContractForView.contractNumber}
                  </h3>
                  <div className="text-xs text-slate-500">تاريخ التحرير: {selectedContractForView.date}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Printer size={15} />
                  <span>طباعة العقد</span>
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
            <div className="space-y-6 text-xs sm:text-sm">
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-auto text-right">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 print:hidden">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="text-emerald-600" size={18} />
                معاينة السند الإذني / الكمبيالة القانونية
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <Printer size={14} />
                  <span>طباعة الورقة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintNoteModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Official Legal Promissory Note Sheet */}
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
      )}

      {/* MODAL 5: NEW FREE PROMISSORY NOTE */}
      {isNewNoteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-auto text-right">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="text-emerald-600" size={20} />
                تحرير كمبيالة أو سند لأمر مستقل
              </h3>
              <button
                type="button"
                onClick={() => setIsNewNoteModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveFreeNote} className="space-y-4 text-xs sm:text-sm">
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
                <label className="block text-slate-700 font-semibold mb-1">اسم المسحوب عليه (المدين) *</label>
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

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewNoteModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors"
                >
                  حفظ في محفظة الأوراق المالية ←
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
