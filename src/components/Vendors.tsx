import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { 
  Plus, Truck, Save, Edit3, Trash2, Search, X, FileText, 
  ArrowUpRight, ArrowDownLeft, MessageSquare, 
  ShieldAlert, Check, Copy, Mail, CreditCard, FileCheck,
  Phone, LayoutGrid, Table as TableIcon
} from 'lucide-react';
import { Partner } from '../types/accounting';
import PrintDropdown from './PrintDropdown';
import PartnerStatementModal from './PartnerStatementModal';
import VendorKpiModal, { VendorKpiModalType } from './VendorKpiModal';
import AddVendorForm from './AddVendorForm';
import BalanceConfirmationModal from './BalanceConfirmationModal';
import { PartnerBalanceItem } from './PartnerBalances';
import { 
  loadVendors, 
  saveVendorsList, 
  getPartnerAccountStatement,
  syncPartnerRecord
} from '../utils/partnerLedger';
import ExportButtonGroup from './ExportButtonGroup';
import { useSystemCurrency } from '../utils/currency';

export default function Vendors() {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [vendors, setVendors] = useState<Partner[]>(() => loadVendors());
  const [isAdding, setIsAdding] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Partner | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState<'ALL' | 'CREDITORS' | 'DEBTORS' | 'ZERO'>('ALL');
  const [viewMode, setViewMode] = useState<'AUTO' | 'CARDS' | 'TABLE'>('AUTO');
  const [selectedKpiModal, setSelectedKpiModal] = useState<VendorKpiModalType | null>(null);
  const [selectedPartnerForStatement, setSelectedPartnerForStatement] = useState<Partner | null>(null);
  const [selectedPartnerForConfirmation, setSelectedPartnerForConfirmation] = useState<PartnerBalanceItem | null>(null);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  useEffect(() => {
    const handleSync = () => {
      setVendors(loadVendors());
    };
    window.addEventListener('alpha-partner-ledger-updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('alpha-partner-ledger-updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const generateVendorCode = () => {
    let maxNum = 0;
    for (const v of vendors) {
      if (v.code) {
        const match = v.code.match(/\d+$/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }
    return `VEND-${(maxNum + 1).toString().padStart(3, '0')}`;
  };

  const handleAddVendor = (vendorData: { 
    code?: string;
    name: string; 
    taxNumber: string; 
    phone: string; 
    address?: string | undefined;
    email?: string | undefined;
    creditLimit?: number | undefined;
    paymentTermsDays?: number | undefined;
    openingBalance?: number;
  }) => {
    const code = vendorData.code || generateVendorCode();
    const added: Partner = { 
      id: `vend-${Date.now()}`, 
      type: 'VENDOR', 
      code,
      name: vendorData.name,
      taxNumber: vendorData.taxNumber || undefined,
      phone: vendorData.phone || undefined,
      email: vendorData.email || undefined,
      address: vendorData.address || undefined,
      creditLimit: vendorData.creditLimit,
      paymentTermsDays: vendorData.paymentTermsDays,
      openingBalance: vendorData.openingBalance || 0,
      openingBalanceType: (vendorData.openingBalance || 0) < 0 ? 'DEBIT' : 'CREDIT'
    };
    const updated = [...vendors, added];
    setVendors(updated);
    saveVendorsList(updated);
    syncPartnerRecord(added, "vendors", "INSERT");
    setIsAdding(false);
  };

  const handleUpdate = (e: FormEvent) => {
    e.preventDefault();
    if (!editingVendor || !editingVendor.name.trim()) return;

    const updated = vendors.map(v => v.id === editingVendor.id ? editingVendor : v);
    setVendors(updated);
    saveVendorsList(updated);
    syncPartnerRecord(editingVendor, "vendors", "UPDATE");
    setEditingVendor(null);
  };

  const handleDelete = (id: string, name: string) => {
    const vendor = vendors.find(v => v.id === id);
    if (!vendor) return;

    const statement = getPartnerAccountStatement(vendor);
    const hasTransactions = statement.transactions.some(t => t.type !== 'OPENING');

    if (hasTransactions) {
      alert(`لا يمكن حذف المورد (${name}) لأنه مرتبط ببيانات وعمليات (فواتير مشتريات، سندات صرف، أو قيود). يرجى تسوية الحركات المرتبطة به أولاً.`);
      return;
    }

    if (confirm(`هل أنت متأكد من رغبتك في حذف المورد (${name})؟`)) {
      const updated = vendors.filter(v => v.id !== id);
      setVendors(updated);
      saveVendorsList(updated);
      syncPartnerRecord(vendor, "vendors", "DELETE");
    }
  };

  // Precalculate statements for all vendors
  const vendorsWithStatements = useMemo(() => {
    return vendors.map(v => {
      const statement = getPartnerAccountStatement(v);
      return {
        vendor: v,
        statement
      };
    });
  }, [vendors]);

  // Overall stats
  const overallStats = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    let netPayables = 0;
    let totalAdvances = 0;
    let creditorsCount = 0;
    let debtorsCount = 0;
    let zeroCount = 0;

    vendorsWithStatements.forEach(({ statement }) => {
      totalDebit += statement.totalDebit;
      totalCredit += statement.totalCredit;
      if (statement.balanceType === 'CREDIT') {
        netPayables += statement.balance;
        creditorsCount++;
      } else if (statement.balanceType === 'DEBIT') {
        totalAdvances += statement.balance;
        debtorsCount++;
      } else {
        zeroCount++;
      }
    });

    return {
      count: vendors.length,
      totalDebit,
      totalCredit,
      netPayables,
      totalAdvances,
      creditorsCount,
      debtorsCount,
      zeroCount,
      avgPayable: creditorsCount > 0 ? netPayables / creditorsCount : 0
    };
  }, [vendorsWithStatements, vendors.length]);

  // Filter by Tab and Search
  const filteredVendors = useMemo(() => {
    return vendorsWithStatements.filter(({ vendor: v, statement }) => {
      // Tab filter
      if (activeFilterTab === 'CREDITORS' && statement.balanceType !== 'CREDIT') return false;
      if (activeFilterTab === 'DEBTORS' && statement.balanceType !== 'DEBIT') return false;
      if (activeFilterTab === 'ZERO' && statement.balanceType !== 'ZERO') return false;

      // Text search
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        v.name.toLowerCase().includes(q) ||
        (v.phone && v.phone.includes(q)) ||
        (v.email && v.email.toLowerCase().includes(q)) ||
        (v.taxNumber && v.taxNumber.includes(q)) ||
        (v.code && v.code.toLowerCase().includes(q)) ||
        (v.address && v.address.toLowerCase().includes(q))
      );
    });
  }, [vendorsWithStatements, activeFilterTab, searchQuery]);

  // Totals for filtered vendors
  const filteredTotals = useMemo(() => {
    let debitSum = 0;
    let creditSum = 0;
    let netPayablesBalance = 0;
    let netAdvancesBalance = 0;

    filteredVendors.forEach(({ statement }) => {
      debitSum += statement.totalDebit;
      creditSum += statement.totalCredit;
      if (statement.balanceType === 'CREDIT') {
        netPayablesBalance += statement.balance;
      } else if (statement.balanceType === 'DEBIT') {
        netAdvancesBalance += statement.balance;
      }
    });

    return {
      count: filteredVendors.length,
      debitSum,
      creditSum,
      netPayablesBalance,
      netAdvancesBalance
    };
  }, [filteredVendors]);

  // Quick Action: Navigate to payment voucher with prefilled vendor
  const handleQuickPayment = (vendor: Partner) => {
    try {
      sessionStorage.setItem('alpha_pending_voucher_partner', vendor.id);
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'externalPayment' } }));
  };

  // Open official Balance Confirmation Letter Modal
  const handleOpenConfirmation = (vendor: Partner, statement: any) => {
    const item: PartnerBalanceItem = {
      id: vendor.id,
      code: vendor.code || 'VEND',
      name: vendor.name,
      type: 'VENDOR',
      phone: vendor.phone,
      taxNumber: vendor.taxNumber,
      email: vendor.email,
      address: vendor.address,
      creditLimit: vendor.creditLimit,
      paymentTermsDays: vendor.paymentTermsDays,
      openingBalance: vendor.openingBalance || 0,
      totalWithdrawals: statement.totalDebit,
      totalPayments: statement.totalCredit,
      lastTransactionDate: statement.transactions[statement.transactions.length - 1]?.date || '',
      calc: {
        balanceType: statement.balanceType,
        balanceAmount: statement.balance,
        paymentRatio: statement.totalCredit > 0 && statement.totalDebit > 0 
          ? Math.round((statement.totalCredit / statement.totalDebit) * 100)
          : 0,
        isOverCreditLimit: !!(vendor.creditLimit && vendor.creditLimit > 0 && statement.balance > vendor.creditLimit && statement.balanceType === 'CREDIT')
      }
    };
    setSelectedPartnerForConfirmation(item);
  };

  // Copy phone number
  const handleCopyPhone = (phone: string, id: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhoneId(id);
    setTimeout(() => setCopiedPhoneId(null), 2000);
  };

  const vendorExportHeaders = [
    'كود المورد',
    'اسم المورد',
    'الرقم الضريبي',
    'الهاتف',
    'البريد الإلكتروني',
    'العنوان',
    'سقف الائتمان',
    'فترة السداد (أيام)',
    'إجمالي المدفوعات (مدين)',
    'إجمالي المشتريات (دائن)',
    'الرصيد الفعلي',
    'حالة الرصيد'
  ];

  const vendorExportRows = useMemo(() => {
    return filteredVendors.map(({ vendor: v, statement }) => [
      v.code || '',
      v.name,
      v.taxNumber || '',
      v.phone || '',
      v.email || '',
      v.address || '',
      v.creditLimit || '',
      v.paymentTermsDays || '0',
      Number(statement.totalDebit.toFixed(2)),
      Number(statement.totalCredit.toFixed(2)),
      Number(statement.balance.toFixed(2)),
      statement.balanceType === 'CREDIT' ? 'دائن (علينا للمورد)' : statement.balanceType === 'DEBIT' ? 'مدين (دفعة لنا)' : 'متزن'
    ]);
  }, [filteredVendors]);

  return (
    <div className="flex flex-col flex-1">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1 text-slate-500">
            <span className="text-[11px] sm:text-xs uppercase font-bold tracking-tight">الموردون والمشتريات</span>
            <span className="text-xs">/</span>
            <span className="text-[11px] sm:text-xs uppercase font-bold tracking-tight">الموردون والحسابات المربوطة</span>
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800">إدارة حسابات الموردين</h2>
          <p className="text-slate-500 mt-1 text-xs sm:text-sm max-w-2xl">
            متابعة مستحقات والتزامات الموردين، صرف الدفعات الفورية، وإدارة سقوف الائتمان ومطابقة كشوف الحسابات.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
          <PrintDropdown />
          <ExportButtonGroup
            title="دليل وسجل حسابات الموردين"
            filename="كشف_الموردين"
            headers={vendorExportHeaders}
            rows={vendorExportRows}
            filterSummary={`العدد: ${filteredVendors.length} مورد | التصفية: ${activeFilterTab}`}
          />
          {!isAdding && !editingVendor && (
            <button 
              onClick={() => setIsAdding(true)}
              className="btn-3d btn-3d-blue h-10 px-4 text-xs sm:text-sm font-black hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <Plus size={16} /> إضافة مورد جديد
            </button>
          )}
        </div>
      </div>

      {/* Interactive Summary KPI Cards (Click to open Drill-Down Report Modal) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-4 sm:mb-6 print:hidden">
        {/* Total Vendors */}
        <div 
          onClick={() => setSelectedKpiModal('TOTAL_VENDORS')}
          className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer shadow-xs flex items-center justify-between group min-w-0"
          title="انقر لفتح نافذة تحليل وتوزيع سجل الموردين الشامل"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-[11px] sm:text-xs text-slate-500 font-bold group-hover:text-purple-600 transition-colors truncate">إجمالي الموردين</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold font-mono text-slate-800 mt-0.5 sm:mt-1 truncate">{overallStats.count} مورد</div>
            <div className="text-[10px] sm:text-[11px] text-purple-600 font-medium mt-0.5 flex items-center gap-1 truncate">
              <span>عرض التقرير</span>
              <span className="text-[9px]">↗</span>
            </div>
          </div>
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-xs mr-2">
            <Truck size={18} />
          </div>
        </div>

        {/* Total Payables (Creditors - علينا) */}
        <div 
          onClick={() => setSelectedKpiModal('CREDITORS_PAYABLES')}
          className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 hover:border-rose-400 hover:shadow-md transition-all cursor-pointer shadow-xs flex items-center justify-between group min-w-0"
          title="انقر لفتح نافذة تقرير التزامات ومستحقات الموردين واجبة السداد"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-[11px] sm:text-xs text-rose-800 font-bold group-hover:text-rose-700 transition-colors truncate">مستحقات (علينا)</span>
            </div>
            <div className="text-base sm:text-xl lg:text-2xl font-bold font-mono text-rose-600 mt-0.5 sm:mt-1 truncate">
              {overallStats.netPayables.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
            </div>
            <div className="text-[10px] sm:text-[11px] text-rose-600 font-medium mt-0.5 flex items-center gap-1 truncate">
              <span>{overallStats.creditorsCount} مورد دائن</span>
              <span className="text-[9px]">↗</span>
            </div>
          </div>
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 group-hover:bg-rose-600 group-hover:text-white transition-all shadow-xs mr-2">
            <ArrowUpRight size={18} />
          </div>
        </div>

        {/* Advance Payments (Debtors - لنا) */}
        <div 
          onClick={() => setSelectedKpiModal('DEBTORS_ADVANCES')}
          className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer shadow-xs flex items-center justify-between group min-w-0"
          title="انقر لفتح نافذة تقرير الدفعات المقدمة للموردين"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-[11px] sm:text-xs text-emerald-800 font-bold group-hover:text-emerald-700 transition-colors truncate">دفعات مقدمة (لنا)</span>
            </div>
            <div className="text-base sm:text-xl lg:text-2xl font-bold font-mono text-emerald-700 mt-0.5 sm:mt-1 truncate">
              {overallStats.totalAdvances.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
            </div>
            <div className="text-[10px] sm:text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1 truncate">
              <span>{overallStats.debtorsCount} مورد مدين</span>
              <span className="text-[9px]">↗</span>
            </div>
          </div>
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs mr-2">
            <ArrowDownLeft size={18} />
          </div>
        </div>

        {/* Total Purchases Volume (Credit) */}
        <div 
          onClick={() => setSelectedKpiModal('TOTAL_PURCHASES')}
          className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer shadow-xs flex items-center justify-between group min-w-0"
          title="انقر لفتح نافذة تحليل كبار الموردين وحجم التوريدات والمشتريات"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-[11px] sm:text-xs text-slate-500 font-bold group-hover:text-indigo-600 transition-colors truncate">إجمالي التوريدات</span>
            </div>
            <div className="text-base sm:text-xl lg:text-2xl font-bold font-mono text-slate-800 mt-0.5 sm:mt-1 truncate">
              {overallStats.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
            </div>
            <div className="text-[10px] sm:text-[11px] text-indigo-600 font-medium mt-0.5 flex items-center gap-1 truncate">
              <span>تحليل كبار الموردين</span>
              <span className="text-[9px]">↗</span>
            </div>
          </div>
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xs mr-2">
            <CreditCard size={18} />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search & View Switcher Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3 mb-4 print:hidden">
        {/* 3D Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-1 -mx-1 px-1 sm:mx-0 sm:px-0">
          <button
            type="button"
            onClick={() => setActiveFilterTab('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 hover:scale-105 active:scale-95 shrink-0 ${
              activeFilterTab === 'ALL'
                ? 'btn-3d btn-3d-blue text-white shadow-sm'
                : 'btn-3d btn-3d-white text-slate-600'
            }`}
          >
            <span>جميع الموردين</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200/70 text-slate-700 text-[10px] font-mono">
              {overallStats.count}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilterTab('CREDITORS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 hover:scale-105 active:scale-95 shrink-0 ${
              activeFilterTab === 'CREDITORS'
                ? 'btn-3d btn-3d-danger text-white shadow-sm'
                : 'btn-3d btn-3d-white text-rose-700 border-rose-200'
            }`}
          >
            <span>مستحق لهم (علينا)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeFilterTab === 'CREDITORS'
                ? 'bg-rose-800/60 text-white font-bold'
                : 'bg-rose-100 text-rose-800'
            }`}>
              {overallStats.creditorsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilterTab('DEBTORS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 hover:scale-105 active:scale-95 shrink-0 ${
              activeFilterTab === 'DEBTORS'
                ? 'btn-3d btn-3d-success text-white shadow-sm'
                : 'btn-3d btn-3d-white text-emerald-700 border-emerald-300'
            }`}
          >
            <span>دفعات مقدمة (لنا)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeFilterTab === 'DEBTORS'
                ? 'bg-emerald-800/60 text-white font-bold'
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              {overallStats.debtorsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilterTab('ZERO')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 hover:scale-105 active:scale-95 shrink-0 ${
              activeFilterTab === 'ZERO'
                ? 'btn-3d btn-3d-blue text-white shadow-sm'
                : 'btn-3d btn-3d-white text-slate-600'
            }`}
          >
            <span>رصيد متزن (صفر)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200/70 text-slate-700 text-[10px] font-mono">
              {overallStats.zeroCount}
            </span>
          </button>
        </div>

        {/* Search input & View Switcher */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-60 lg:w-72">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input 
              type="text"
              placeholder="بحث بالاسم، الهاتف، الضريبي، الكود..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-4 pr-9 py-2 w-full bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="btn-3d btn-3d-white p-1 rounded-lg absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                title="مسح نص البحث"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* View Mode Toggle: Auto / Cards / Table */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('AUTO')}
              className={`px-2 py-1 rounded-lg transition-all text-xs font-bold cursor-pointer ${
                viewMode === 'AUTO' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="تكيّف تلقائي (بطاقات على الجوال، جدول على الكمبيوتر)"
            >
              تلقائي
            </button>
            <button
              type="button"
              onClick={() => setViewMode('CARDS')}
              className={`p-1.5 rounded-lg transition-all text-xs font-bold cursor-pointer flex items-center gap-1 ${
                viewMode === 'CARDS' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="عرض البطاقات"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`p-1.5 rounded-lg transition-all text-xs font-bold cursor-pointer flex items-center gap-1 ${
                viewMode === 'TABLE' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="عرض الجدول المالي"
            >
              <TableIcon size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Add Vendor Modal */}
      {isAdding && (
        <div 
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAdding(false);
          }}
        >
          <div 
            className="bg-white rounded-t-3xl sm:rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-modalIn text-right"
            onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Mobile Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

            <div className="flex justify-between items-center p-4 border-b border-slate-100 shrink-0">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
                <Truck size={18} className="text-purple-600" /> إضافة مورد جديد وربط الحساب
              </h3>
              <button 
                type="button" 
                onClick={() => setIsAdding(false)}
                className="btn-3d btn-3d-white p-1.5 rounded-xl text-slate-500 hover:text-slate-800 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                title="إغلاق النافذة"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-0 overflow-y-auto flex-1">
              <div className="p-4 sm:p-6">
                <AddVendorForm 
                  initialCode={generateVendorCode()}
                  onSave={handleAddVendor} 
                  onCancel={() => setIsAdding(false)} 
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Vendor Modal */}
      {editingVendor && (
        <div 
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingVendor(null);
          }}
        >
          <div 
            className="bg-white rounded-t-3xl sm:rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-modalIn text-right"
            onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Mobile Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

            <div className="flex justify-between items-center p-4 sm:p-6 pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                  <Edit3 size={16} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">تعديل بيانات المورد</h3>
                  <p className="text-[11px] text-slate-400">تحديث معلومات المورد، شروط السداد، وسقف الائتمان</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingVendor(null)}
                className="btn-3d btn-3d-white p-1.5 rounded-xl text-slate-500 hover:text-slate-800 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                title="إغلاق النافذة"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <form onSubmit={handleUpdate} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">كود المورد:</label>
                    <input
                      type="text"
                      value={editingVendor.code || ''}
                      onChange={(e) => setEditingVendor({...editingVendor, code: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                      placeholder="VEND-001"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">اسم المورد / الشركة <span className="text-red-500">*</span>:</label>
                    <input
                      type="text"
                      required
                      value={editingVendor.name}
                      onChange={(e) => setEditingVendor({...editingVendor, name: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">الرقم الضريبي / السجل:</label>
                    <input
                      type="text"
                      value={editingVendor.taxNumber || ''}
                      onChange={(e) => setEditingVendor({...editingVendor, taxNumber: e.target.value})}
                      placeholder="300000000000005"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">رقم الهاتف الجوال / تليفون:</label>
                    <input
                      type="text"
                      value={editingVendor.phone || ''}
                      onChange={(e) => setEditingVendor({...editingVendor, phone: e.target.value})}
                      placeholder="05XXXXXXXX"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">البريد الإلكتروني:</label>
                    <input
                      type="email"
                      value={editingVendor.email || ''}
                      onChange={(e) => setEditingVendor({...editingVendor, email: e.target.value})}
                      placeholder="vendor@company.com"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">العنوان / المقر:</label>
                    <input
                      type="text"
                      value={editingVendor.address || ''}
                      onChange={(e) => setEditingVendor({...editingVendor, address: e.target.value})}
                      placeholder="المدينة - الحي - الشارع"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">سقف الائتمان الممنوح (ريال):</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingVendor.creditLimit !== undefined ? editingVendor.creditLimit : ''}
                      onChange={(e) => setEditingVendor({
                        ...editingVendor, 
                        creditLimit: e.target.value ? Number(e.target.value) : undefined
                      })}
                      placeholder="مثال: 100000"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">فترة السداد المتفق عليها:</label>
                    <select
                      value={editingVendor.paymentTermsDays || 0}
                      onChange={(e) => setEditingVendor({
                        ...editingVendor, 
                        paymentTermsDays: Number(e.target.value) || 0
                      })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                    >
                      <option value="0">سداد فوري / نقدي (Cash on Delivery)</option>
                      <option value="15">خلال 15 يوماً</option>
                      <option value="30">خلال 30 يوماً (شهر)</option>
                      <option value="45">خلال 45 يوماً</option>
                      <option value="60">خلال 60 يوماً (شهران)</option>
                      <option value="90">خلال 90 يوماً (3 أشهر)</option>
                      <option value="120">خلال 120 يوماً (4 أشهر)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-slate-600 font-bold mb-1">الرصيد الافتتاحي السابق ({currencySymbol}):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingVendor.openingBalance || 0}
                    onChange={(e) => setEditingVendor({...editingVendor, openingBalance: Number(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    القيمة الموجبة تعني رصيد دائن للمورد علينا (التزام)، والقيمة السالبة تعني رصيد مدين له (دفعة مقدمة سابقة لصالحنا).
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingVendor(null)}
                    className="btn-3d btn-3d-white px-4 py-2 text-xs font-black hover:scale-105 active:scale-95 transition-all"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="btn-3d btn-3d-blue px-5 py-2 text-xs font-black hover:scale-105 active:scale-95 transition-all"
                  >
                    <Save size={15} />
                    <span>حفظ التعديلات</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Print Header */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900">لوجوستريا للمحاسبة</h1>
        <p className="text-sm text-slate-500">الفرع الرئيسي - الرياض</p>
        <h2 className="text-xl font-bold mt-4 border-b pb-2 inline-block">كشف بيانات وأرصدة الموردين</h2>
        <div className="mt-4 text-sm flex justify-between px-10 text-slate-600">
          <span>تاريخ الطباعة: {new Date().toLocaleDateString('ar-SA')}</span>
          <span>عدد السجلات: {filteredVendors.length} مورد</span>
        </div>
      </div>

      {/* Mobile-First Responsive Cards Feed (Shown on mobile by default or when viewMode === 'CARDS') */}
      <div className={`print:hidden flex-col gap-3 mb-4 ${viewMode === 'TABLE' ? 'hidden' : viewMode === 'CARDS' ? 'flex' : 'flex md:hidden'}`}>
        {filteredVendors.map(({ vendor: v, statement }) => {
          const isOverCreditLimit = Boolean(
            v.creditLimit && 
            statement.balanceType === 'CREDIT' && 
            statement.balance > v.creditLimit
          );

          return (
            <div 
              key={v.id} 
              className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col gap-3 transition-all hover:border-blue-300"
            >
              {/* Card Header: Partner Code, Name & Status Badges */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                      {v.code || 'بدون كود'}
                    </span>
                    {isOverCreditLimit && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                        <ShieldAlert size={11} /> تجاوز سقف الائتمان
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 text-base leading-snug">{v.name}</h3>
                  {v.address && (
                    <p className="text-xs text-slate-500 mt-0.5">{v.address}</p>
                  )}
                </div>

                {/* Status Badge */}
                <div className="shrink-0 text-left">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                    statement.balanceType === 'CREDIT'
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : statement.balanceType === 'DEBIT'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      statement.balanceType === 'CREDIT'
                        ? 'bg-rose-500'
                        : statement.balanceType === 'DEBIT'
                        ? 'bg-emerald-500'
                        : 'bg-slate-400'
                    }`} />
                    {statement.balanceLabel}
                  </span>
                </div>
              </div>

              {/* Contact Information Row */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                {v.phone ? (
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`tel:${v.phone}`}
                      className="inline-flex items-center gap-1 font-mono font-bold text-slate-800 hover:text-blue-600"
                      dir="ltr"
                    >
                      <Phone size={13} className="text-blue-600" />
                      <span>{v.phone}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyPhone(v.phone!, v.id)}
                      className="btn-3d btn-3d-white p-1 rounded-md text-slate-500 hover:text-slate-800 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                      title="نسخ رقم الهاتف"
                    >
                      {copiedPhoneId === v.id ? (
                        <Check size={12} className="text-emerald-600" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                    <a
                      href={`https://wa.me/${v.phone.replace(/[^\d]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-3d btn-3d-white p-1 rounded-md text-emerald-600 hover:text-emerald-700 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                      title="محادثة واتساب"
                    >
                      <MessageSquare size={12} />
                    </a>
                  </div>
                ) : (
                  <span className="text-slate-400">لا يوجد هاتف مسجل</span>
                )}

                {v.email && (
                  <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500 mr-auto">
                    <Mail size={12} className="text-slate-400" />
                    <a href={`mailto:${v.email}`} className="hover:underline truncate max-w-[160px]">
                      {v.email}
                    </a>
                  </div>
                )}

                {v.taxNumber && (
                  <div className="w-full text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                    <span>الرقم الضريبي:</span>
                    <span className="font-bold text-slate-700">{v.taxNumber}</span>
                  </div>
                )}
              </div>

              {/* Financial Metrics Box */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div>
                  <div className="text-[11px] text-slate-500 font-bold">الرصيد الفعلي الحالي</div>
                  <div className={`text-base font-bold font-mono mt-0.5 ${
                    statement.balanceType === 'CREDIT'
                      ? 'text-rose-700'
                      : statement.balanceType === 'DEBIT'
                      ? 'text-emerald-700'
                      : 'text-slate-600'
                  }`}>
                    {statement.balanceFormatted} {currencySymbol}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {statement.balanceType === 'CREDIT' ? 'مستحق له (علينا)' : statement.balanceType === 'DEBIT' ? 'دفعة مقدمة (لنا)' : 'حساب متوازن'}
                  </div>
                </div>

                <div className="text-left border-r border-slate-200 pr-2">
                  <div className="text-[11px] text-slate-500 font-bold">سقف الائتمان والشروط</div>
                  <div className="text-xs font-mono font-bold text-slate-700 mt-0.5">
                    {v.creditLimit ? `${v.creditLimit.toLocaleString()} ${currencySymbol}` : 'مفتوح'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {v.paymentTermsDays ? `سداد ${v.paymentTermsDays} يوم • ` : ''}
                    {statement.transactions.length} حركات
                  </div>
                </div>
              </div>

              {/* 3D Action Buttons Toolbar */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                {/* Quick Payment Button */}
                <button
                  type="button"
                  onClick={() => handleQuickPayment(v)}
                  className="btn-3d btn-3d-danger-soft h-9 px-2 text-xs font-black flex items-center justify-center gap-1 hover:scale-105 active:scale-95 transition-all"
                  title="إنشاء سند صرف فوري للمورد"
                >
                  <CreditCard size={14} />
                  <span>صرف</span>
                </button>

                {/* Statement Button */}
                <button
                  type="button"
                  onClick={() => setSelectedPartnerForStatement(v)}
                  className="btn-3d btn-3d-success-soft h-9 px-2 text-xs font-black flex items-center justify-center gap-1 hover:scale-105 active:scale-95 transition-all"
                  title="كشف الحساب التفصيلي"
                >
                  <FileText size={14} />
                  <span>كشف الحساب</span>
                </button>

                {/* Balance Confirmation Letter Button */}
                <button
                  type="button"
                  onClick={() => handleOpenConfirmation(v, statement)}
                  className="btn-3d btn-3d-white h-9 px-2 text-xs font-black flex items-center justify-center gap-1 text-indigo-700 hover:text-indigo-900 hover:scale-105 active:scale-95 transition-all"
                  title="خطاب مصادقة الرصيد"
                >
                  <FileCheck size={14} className="text-indigo-600" />
                  <span>مصادقة</span>
                </button>

                {/* Edit Button */}
                <button
                  type="button"
                  onClick={() => setEditingVendor(v)}
                  className="btn-3d btn-3d-white h-9 px-3 text-xs font-black flex items-center justify-center gap-1.5 hover:scale-105 active:scale-95 transition-all col-span-2 text-slate-700"
                  title="تعديل بيانات المورد"
                >
                  <Edit3 size={14} />
                  <span>تعديل البيانات</span>
                </button>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => handleDelete(v.id, v.name)}
                  className="btn-3d btn-3d-danger-soft h-9 px-2 text-xs font-black flex items-center justify-center gap-1 hover:scale-105 active:scale-95 transition-all text-rose-700"
                  title="حذف المورد"
                >
                  <Trash2 size={14} />
                  <span>حذف</span>
                </button>
              </div>
            </div>
          );
        })}

        {filteredVendors.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-400 text-xs border border-slate-200">
            <Truck size={36} className="mx-auto mb-2 opacity-30 text-slate-500" />
            <p className="font-bold text-slate-600 mb-1">لا توجد حسابات موردين مطابقة</p>
            <p className="text-slate-400">جرب تغيير كلمات البحث أو تبويب التصفية أعلاه</p>
          </div>
        )}
      </div>

      {/* Main Vendors Table (Shown on desktop by default or when viewMode === 'TABLE') */}
      <div className={`bg-white rounded-xl shadow-xs border border-slate-200 print:border-none print:shadow-none overflow-hidden flex-col ${
        viewMode === 'CARDS' ? 'hidden print:flex' : viewMode === 'TABLE' ? 'flex' : 'hidden md:flex print:flex'
      }`}>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-right border-collapse min-w-[760px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[10px] uppercase text-slate-500 font-bold">
                <th className="px-4 py-3.5">الكود</th>
                <th className="px-5 py-3.5">اسم المورد / الشركة</th>
                <th className="px-4 py-3.5 hidden sm:table-cell">بيانات الاتصال</th>
                <th className="px-4 py-3.5 hidden md:table-cell">الرقم الضريبي</th>
                <th className="px-4 py-3.5 text-center hidden lg:table-cell">سقف الائتمان</th>
                <th className="px-4 py-3.5 text-center hidden md:table-cell">العمليات</th>
                <th className="px-5 py-3.5">الرصيد الفعلي الحالي</th>
                <th className="px-4 py-3.5 text-center print:hidden">إجراءات سريعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredVendors.map(({ vendor: v, statement }) => {
                const isOverCreditLimit = Boolean(
                  v.creditLimit && 
                  statement.balanceType === 'CREDIT' && 
                  statement.balance > v.creditLimit
                );

                return (
                  <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Code */}
                    <td className="px-4 py-3.5 text-slate-600 font-mono text-xs font-semibold whitespace-nowrap">
                      {v.code || '-'}
                    </td>

                    {/* Name & Address */}
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-800 text-sm">{v.name}</span>
                          {isOverCreditLimit && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-200" title={`تجاوز سقف الائتمان (${v.creditLimit?.toLocaleString()} ريال)`}>
                              <ShieldAlert size={10} /> تجاوز الحد
                            </span>
                          )}
                        </div>
                        {v.address && (
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">{v.address}</p>
                        )}
                      </div>
                    </td>

                    {/* Contact (Phone / WhatsApp / Email) */}
                    <td className="px-4 py-3.5 text-slate-600 text-xs hidden sm:table-cell">
                      <div className="flex flex-col gap-1">
                        {v.phone ? (
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            <span dir="ltr" className="font-medium text-slate-700">{v.phone}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(v.phone!, v.id)}
                              className="btn-3d btn-3d-white p-1 rounded-md text-slate-500 hover:text-slate-800 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                              title="نسخ رقم الهاتف"
                            >
                              {copiedPhoneId === v.id ? (
                                <Check size={12} className="text-emerald-600" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                            <a
                              href={`https://wa.me/${v.phone.replace(/[^\d]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-3d btn-3d-white p-1 rounded-md text-emerald-600 hover:text-emerald-700 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                              title="محادثة واتساب سريعة"
                            >
                              <MessageSquare size={12} />
                            </a>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                        {v.email && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono truncate max-w-[150px]" title={v.email}>
                            <Mail size={11} className="shrink-0 text-slate-400" />
                            <span className="truncate">{v.email}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Tax Number */}
                    <td className="px-4 py-3.5 text-slate-600 font-mono text-xs hidden md:table-cell whitespace-nowrap">
                      {v.taxNumber || '-'}
                    </td>

                    {/* Credit Limit & Terms */}
                    <td className="px-4 py-3.5 text-center hidden lg:table-cell">
                      <div className="flex flex-col items-center">
                        {v.creditLimit ? (
                          <span className="font-mono font-bold text-xs text-slate-700">
                            {v.creditLimit.toLocaleString()} {currencySymbol}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">مفتوح</span>
                        )}
                        {v.paymentTermsDays ? (
                          <span className="text-[10px] text-slate-400 font-medium">
                            سداد {v.paymentTermsDays} يوم
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* Transactions Count */}
                    <td className="px-4 py-3.5 text-center font-mono text-xs font-bold text-slate-600 hidden md:table-cell whitespace-nowrap">
                      <span className="bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                        {statement.transactions.length} حركات
                      </span>
                    </td>

                    {/* Actual Balance */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className={`font-mono font-bold text-sm ${
                          statement.balanceType === 'CREDIT' 
                            ? 'text-rose-700' 
                            : statement.balanceType === 'DEBIT' 
                            ? 'text-emerald-700' 
                            : 'text-slate-500'
                        }`}>
                          {statement.balanceFormatted} {currencySymbol}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            statement.balanceType === 'CREDIT' 
                              ? 'bg-rose-500' 
                              : statement.balanceType === 'DEBIT' 
                              ? 'bg-emerald-500' 
                              : 'bg-slate-400'
                          }`} />
                          <span className="text-[10px] text-slate-500">{statement.balanceLabel}</span>
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 print:hidden text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Quick Payment Voucher Button */}
                        <button
                          type="button"
                          onClick={() => handleQuickPayment(v)}
                          className="btn-3d btn-3d-danger-soft px-2.5 py-1 text-xs font-black flex items-center gap-1 hover:scale-105 active:scale-95 transition-all"
                          title="إنشاء سند صرف فوري للمورد"
                        >
                          <CreditCard size={12} />
                          <span>صرف</span>
                        </button>

                        {/* Statement Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedPartnerForStatement(v)}
                          className="btn-3d btn-3d-success-soft px-2.5 py-1 text-xs font-black flex items-center gap-1 hover:scale-105 active:scale-95 transition-all"
                          title="فتح كشف حساب المورد التفصيلي المطابق"
                        >
                          <FileText size={12} />
                          <span>كشف الحساب</span>
                        </button>

                        {/* Balance Confirmation Letter Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenConfirmation(v, statement)}
                          className="btn-3d btn-3d-white px-2 py-1 text-xs font-black flex items-center gap-1 text-indigo-700 hover:text-indigo-900 hover:scale-105 active:scale-95 transition-all"
                          title="إصدار وطباعة خطاب مصادقة رصيد المورد الدوري"
                        >
                          <FileCheck size={12} className="text-indigo-600" />
                          <span>مصادقة</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => setEditingVendor(v)}
                          className="btn-3d btn-3d-white p-1.5 text-xs font-black hover:scale-105 active:scale-95 transition-all"
                          title="تعديل بيانات المورد"
                        >
                          <Edit3 size={13} />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDelete(v.id, v.name)}
                          className="btn-3d btn-3d-danger-soft p-1.5 text-xs font-black hover:scale-105 active:scale-95 transition-all"
                          title="حذف المورد"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredVendors.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 text-xs">
                    <Truck size={32} className="mx-auto mb-2 opacity-30" />
                    لا توجد حسابات موردين مطابقة للفلاتر أو معايير البحث الحالية
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Floating Table Footer Summary */}
        {filteredVendors.length > 0 && (
          <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
            <div className="font-bold">
              إجمالي النتائج المعروضة: <span className="font-mono text-slate-900">{filteredTotals.count}</span> مورد
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <div>
                إجمالي مستحق للموردين (علينا): <span className="font-bold text-rose-700">{filteredTotals.netPayablesBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} ريال</span>
              </div>
              {filteredTotals.netAdvancesBalance > 0 && (
                <div>
                  إجمالي دفعات مقدمة (لنا): <span className="font-bold text-emerald-700">{filteredTotals.netAdvancesBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} ريال</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Partner Statement Modal */}
      <PartnerStatementModal
        partner={selectedPartnerForStatement}
        isOpen={Boolean(selectedPartnerForStatement)}
        onClose={() => setSelectedPartnerForStatement(null)}
      />

      {/* Balance Confirmation Letter Modal */}
      {selectedPartnerForConfirmation && (
        <BalanceConfirmationModal
          partner={selectedPartnerForConfirmation}
          isOpen={!!selectedPartnerForConfirmation}
          onClose={() => setSelectedPartnerForConfirmation(null)}
        />
      )}

      {/* KPI Drill-down Report Modal */}
      {selectedKpiModal && (
        <VendorKpiModal
          type={selectedKpiModal}
          isOpen={true}
          onClose={() => setSelectedKpiModal(null)}
          vendorsWithStatements={vendorsWithStatements}
          onSelectPartnerForStatement={(partner) => setSelectedPartnerForStatement(partner)}
          onQuickPayment={handleQuickPayment}
        />
      )}
    </div>
  );
}
