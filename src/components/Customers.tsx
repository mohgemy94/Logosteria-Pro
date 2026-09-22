import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { 
  Plus, Search, Edit3, Trash2, Save, X, FileText, Users, 
  ArrowUpRight, ArrowDownLeft, Receipt,
  Mail, MessageSquare, ShieldAlert,
  Copy, Check, FileCheck, Phone, LayoutGrid, Table as TableIcon
} from 'lucide-react';
import { Partner } from '../types/accounting';
import AddCustomerForm from './AddCustomerForm';
import PrintDropdown from './PrintDropdown';
import PartnerStatementModal from './PartnerStatementModal';
import CustomerKpiModal, { CustomerKpiModalType } from './CustomerKpiModal';
import BalanceConfirmationModal from './BalanceConfirmationModal';
import { PartnerBalanceItem } from './PartnerBalances';
import { 
  loadCustomers, 
  saveCustomersList, 
  getPartnerAccountStatement,
  syncPartnerRecord
} from '../utils/partnerLedger';
import ExportButtonGroup from './ExportButtonGroup';
import { useSystemCurrency } from '../utils/currency';

export type CustomerFilterTab = 'ALL' | 'DEBTORS' | 'CREDITORS' | 'ZERO';

export default function Customers() {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [customers, setCustomers] = useState<Partner[]>(() => loadCustomers());
  const [isAdding, setIsAdding] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Partner | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState<CustomerFilterTab>('ALL');
  const [viewMode, setViewMode] = useState<'AUTO' | 'CARDS' | 'TABLE'>('AUTO');
  const [selectedPartnerForStatement, setSelectedPartnerForStatement] = useState<Partner | null>(null);
  const [selectedPartnerForConfirmation, setSelectedPartnerForConfirmation] = useState<PartnerBalanceItem | null>(null);
  const [selectedKpiModal, setSelectedKpiModal] = useState<CustomerKpiModalType | null>(null);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  useEffect(() => {
    const handleSync = () => {
      setCustomers(loadCustomers());
    };
    window.addEventListener('alpha-partner-ledger-updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('alpha-partner-ledger-updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const generateCustomerCode = () => {
    let maxNum = 0;
    for (const c of customers) {
      if (c.code) {
        const match = c.code.match(/\d+$/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }
    return `CUST-${(maxNum + 1).toString().padStart(3, '0')}`;
  };

  const handleAddCustomer = (customerData: { 
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
    const newCustomer: Partner = { 
      id: `cust-${Date.now()}`, 
      type: 'CUSTOMER', 
      ...customerData 
    };
    const updated = [...customers, newCustomer];
    setCustomers(updated);
    saveCustomersList(updated);
    syncPartnerRecord(newCustomer, 'customers', 'INSERT');
    setIsAdding(false);
  };

  const handleUpdateCustomer = (e: FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !editingCustomer.name.trim()) return;

    const updated = customers.map(c => c.id === editingCustomer.id ? editingCustomer : c);
    setCustomers(updated);
    saveCustomersList(updated);
    syncPartnerRecord(editingCustomer, 'customers', 'UPDATE');
    setEditingCustomer(null);
  };

  const handleDeleteCustomer = (id: string, name: string) => {
    const customer = customers.find(c => c.id === id);
    if (!customer) return;

    const statement = getPartnerAccountStatement(customer);
    const hasTransactions = statement.transactions.some(t => t.type !== 'OPENING');
    
    let hasInstallments = false;
    try {
      const rawIns = localStorage.getItem('alpha_accounting_installments_v1');
      if (rawIns) {
        const installments = JSON.parse(rawIns);
        hasInstallments = installments.some((ins: any) => ins.customerId === id);
      }
    } catch (e) {}

    if (hasTransactions || hasInstallments) {
      alert(`لا يمكن حذف العميل (${name}) لأنه مرتبط ببيانات (فواتير، سندات، أو أقساط). يرجى حذف الحركات المرتبطة به أولاً.`);
      return;
    }

    if (confirm(`هل أنت متأكد من رغبتك في حذف العميل (${name})؟`)) {
      const updated = customers.filter(c => c.id !== id);
      setCustomers(updated);
      saveCustomersList(updated);
      syncPartnerRecord(customer, 'customers', 'DELETE');
    }
  };

  // Precalculate statements for all customers
  const customersWithStatements = useMemo(() => {
    return customers.map(c => {
      const statement = getPartnerAccountStatement(c);
      return {
        customer: c,
        statement
      };
    });
  }, [customers]);

  // Overall totals and breakdown
  const overallStats = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    let netReceivables = 0;
    let totalCreditBalances = 0;
    let debtorsCount = 0;
    let creditorsCount = 0;
    let zeroCount = 0;

    customersWithStatements.forEach(({ statement }) => {
      totalDebit += statement.totalDebit;
      totalCredit += statement.totalCredit;
      if (statement.balanceType === 'DEBIT') {
        netReceivables += statement.balance;
        debtorsCount++;
      } else if (statement.balanceType === 'CREDIT') {
        totalCreditBalances += statement.balance;
        creditorsCount++;
      } else {
        zeroCount++;
      }
    });

    return {
      count: customers.length,
      totalDebit,
      totalCredit,
      netReceivables,
      totalCreditBalances,
      debtorsCount,
      creditorsCount,
      zeroCount,
      avgReceivable: debtorsCount > 0 ? netReceivables / debtorsCount : 0
    };
  }, [customersWithStatements, customers.length]);

  // Filter by Tab and Search
  const filteredCustomers = useMemo(() => {
    return customersWithStatements.filter(({ customer: c, statement }) => {
      // Tab filter
      if (activeFilterTab === 'DEBTORS' && statement.balanceType !== 'DEBIT') return false;
      if (activeFilterTab === 'CREDITORS' && statement.balanceType !== 'CREDIT') return false;
      if (activeFilterTab === 'ZERO' && statement.balanceType !== 'ZERO') return false;

      // Text search
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        c.name.toLowerCase().includes(q) || 
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.taxNumber && c.taxNumber.includes(q)) ||
        (c.code && c.code.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
      );
    });
  }, [customersWithStatements, activeFilterTab, searchQuery]);

  // Totals for filtered customers
  const filteredTotals = useMemo(() => {
    let debitSum = 0;
    let creditSum = 0;
    let netDebitBalance = 0;
    let netCreditBalance = 0;

    filteredCustomers.forEach(({ statement }) => {
      debitSum += statement.totalDebit;
      creditSum += statement.totalCredit;
      if (statement.balanceType === 'DEBIT') {
        netDebitBalance += statement.balance;
      } else if (statement.balanceType === 'CREDIT') {
        netCreditBalance += statement.balance;
      }
    });

    return {
      count: filteredCustomers.length,
      debitSum,
      creditSum,
      netDebitBalance,
      netCreditBalance
    };
  }, [filteredCustomers]);

  // Quick Action: Navigate to receipt voucher with prefilled customer
  const handleQuickReceipt = (customer: Partner) => {
    try {
      sessionStorage.setItem('alpha_pending_voucher_partner', customer.id);
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'externalReceipt' } }));
  };

  // Open official Balance Confirmation Letter Modal
  const handleOpenConfirmation = (customer: Partner, statement: any) => {
    const item: PartnerBalanceItem = {
      id: customer.id,
      code: customer.code || 'CUST',
      name: customer.name,
      type: 'CUSTOMER',
      phone: customer.phone,
      taxNumber: customer.taxNumber,
      email: customer.email,
      address: customer.address,
      creditLimit: customer.creditLimit,
      paymentTermsDays: customer.paymentTermsDays,
      openingBalance: customer.openingBalance || 0,
      totalWithdrawals: statement.totalDebit,
      totalPayments: statement.totalCredit,
      lastTransactionDate: statement.transactions[statement.transactions.length - 1]?.date || '',
      calc: {
        balanceType: statement.balanceType,
        balanceAmount: statement.balance,
        paymentRatio: statement.totalDebit > 0 && statement.totalCredit > 0 
          ? Math.round((statement.totalCredit / statement.totalDebit) * 100)
          : 0,
        isOverCreditLimit: !!(customer.creditLimit && customer.creditLimit > 0 && statement.balance > customer.creditLimit && statement.balanceType === 'DEBIT')
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

  const customerExportHeaders = [
    'كود العميل',
    'اسم العميل',
    'الرقم الضريبي',
    'الهاتف',
    'البريد الإلكتروني',
    'العنوان',
    'حد الائتمان',
    'فترة السداد (أيام)',
    'إجمالي المسحوبات (مدين)',
    'إجمالي المدفوعات (دائن)',
    'الرصيد الحالي',
    'حالة الرصيد'
  ];

  const customerExportRows = useMemo(() => {
    return filteredCustomers.map(({ customer: c, statement }) => [
      c.code || '',
      c.name,
      c.taxNumber || '',
      c.phone || '',
      c.email || '',
      c.address || '',
      c.creditLimit !== undefined ? c.creditLimit : '',
      c.paymentTermsDays !== undefined ? c.paymentTermsDays : '0',
      Number(statement.totalDebit.toFixed(2)),
      Number(statement.totalCredit.toFixed(2)),
      Number(statement.balance.toFixed(2)),
      statement.balanceType === 'DEBIT' ? 'مدين (لنا)' : statement.balanceType === 'CREDIT' ? 'دائن (له)' : 'متزن'
    ]);
  }, [filteredCustomers]);

  return (
    <div className="flex flex-col flex-1">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1 text-slate-500">
            <span className="text-[11px] sm:text-xs uppercase font-bold tracking-tight">العملاء والمبيعات</span>
            <span className="text-xs">/</span>
            <span className="text-[11px] sm:text-xs uppercase font-bold tracking-tight">العملاء والحسابات المربوطة</span>
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800">إدارة حسابات العملاء</h2>
          <p className="text-slate-500 mt-1 text-xs sm:text-sm max-w-2xl">
            متابعة أرصدة العملاء، تحصيل الدفعات الفورية، وإدارة الحدود الائتمانية وكشوف الحسابات.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
          <PrintDropdown />
          <ExportButtonGroup
            title="دليل وسجل حسابات العملاء"
            filename="قائمة_العملاء"
            headers={customerExportHeaders}
            rows={customerExportRows}
            filterSummary={`العدد: ${filteredCustomers.length} عميل | التصفية: ${activeFilterTab}`}
          />
          {!isAdding && !editingCustomer && (
            <button 
              onClick={() => setIsAdding(true)}
              className="btn-3d btn-3d-blue h-10 px-4 text-xs sm:text-sm font-black hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <Plus size={16} /> إضافة عميل جديد
            </button>
          )}
        </div>
      </div>

      {/* Interactive Summary KPI Cards (Click to open Drill-Down Report Modal) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-4 sm:mb-6 print:hidden">
        {/* Total Customers */}
        <div 
          onClick={() => setSelectedKpiModal('TOTAL_CUSTOMERS')}
          className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer shadow-xs flex items-center justify-between group min-w-0"
          title="انقر لفتح نافذة تحليل وتوزيع سجل العملاء الشامل"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-[11px] sm:text-xs text-slate-500 font-bold group-hover:text-blue-600 transition-colors truncate">إجمالي العملاء</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold font-mono text-slate-800 mt-0.5 sm:mt-1 truncate">{overallStats.count} عميل</div>
            <div className="text-[10px] sm:text-[11px] text-blue-600 font-medium mt-0.5 flex items-center gap-1 truncate">
              <span>عرض التقرير</span>
              <span className="text-[9px]">↗</span>
            </div>
          </div>
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs mr-2">
            <Users size={18} />
          </div>
        </div>

        {/* Total Receivables (Debtors) */}
        <div 
          onClick={() => setSelectedKpiModal('DEBTORS_RECEIVABLES')}
          className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer shadow-xs flex items-center justify-between group min-w-0"
          title="انقر لفتح نافذة تقرير العملاء المدينين ومتابعة التحصيل"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-[11px] sm:text-xs text-emerald-800 font-bold group-hover:text-emerald-700 transition-colors truncate">مستحقات (لنا)</span>
            </div>
            <div className="text-base sm:text-xl lg:text-2xl font-bold font-mono text-emerald-700 mt-0.5 sm:mt-1 truncate">
              {overallStats.netReceivables.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
            </div>
            <div className="text-[10px] sm:text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1 truncate">
              <span>{overallStats.debtorsCount} عميل مدين</span>
              <span className="text-[9px]">↗</span>
            </div>
          </div>
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs mr-2">
            <ArrowDownLeft size={18} />
          </div>
        </div>

        {/* Advances / Credit Balances (Creditors) */}
        <div 
          onClick={() => setSelectedKpiModal('CREDITORS_ADVANCES')}
          className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer shadow-xs flex items-center justify-between group min-w-0"
          title="انقر لفتح نافذة تقرير أرصدة العملاء الدائنة والدفعات المقدمة"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-[11px] sm:text-xs text-purple-800 font-bold group-hover:text-purple-700 transition-colors truncate">أرصدة دائنة (مقدماً)</span>
            </div>
            <div className="text-base sm:text-xl lg:text-2xl font-bold font-mono text-purple-700 mt-0.5 sm:mt-1 truncate">
              {overallStats.totalCreditBalances.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
            </div>
            <div className="text-[10px] sm:text-[11px] text-purple-600 font-medium mt-0.5 flex items-center gap-1 truncate">
              <span>{overallStats.creditorsCount} عميل دائن</span>
              <span className="text-[9px]">↗</span>
            </div>
          </div>
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-xs mr-2">
            <Receipt size={18} />
          </div>
        </div>

        {/* Total Sales Volume (Debit) */}
        <div 
          onClick={() => setSelectedKpiModal('TOTAL_SALES')}
          className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer shadow-xs flex items-center justify-between group min-w-0"
          title="انقر لفتح نافذة تحليل كبار العملاء وحجم المبيعات والمسحوبات"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-[11px] sm:text-xs text-slate-500 font-bold group-hover:text-indigo-600 transition-colors truncate">إجمالي مبيعات العملاء</span>
            </div>
            <div className="text-base sm:text-xl lg:text-2xl font-bold font-mono text-slate-800 mt-0.5 sm:mt-1 truncate">
              {overallStats.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
            </div>
            <div className="text-[10px] sm:text-[11px] text-indigo-600 font-medium mt-0.5 flex items-center gap-1 truncate">
              <span>تحليل كبار العملاء</span>
              <span className="text-[9px]">↗</span>
            </div>
          </div>
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xs mr-2">
            <ArrowUpRight size={18} />
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
            <span>جميع العملاء</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200/70 text-slate-700 text-[10px] font-mono">
              {overallStats.count}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilterTab('DEBTORS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 hover:scale-105 active:scale-95 shrink-0 ${
              activeFilterTab === 'DEBTORS'
                ? 'btn-3d btn-3d-success text-white shadow-sm'
                : 'btn-3d btn-3d-white text-green-700 border-green-300'
            }`}
          >
            <span>مدينون (لنا)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeFilterTab === 'DEBTORS'
                ? 'bg-green-800/60 text-white font-bold'
                : 'bg-green-100 text-green-800'
            }`}>
              {overallStats.debtorsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilterTab('CREDITORS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 hover:scale-105 active:scale-95 shrink-0 ${
              activeFilterTab === 'CREDITORS'
                ? 'btn-3d btn-3d-purple text-white shadow-sm'
                : 'btn-3d btn-3d-white text-purple-700 border-purple-200'
            }`}
          >
            <span>دائنون (مقدماً)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 text-[10px] font-mono">
              {overallStats.creditorsCount}
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

      {/* Add Customer Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 shrink-0">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Users size={18} className="text-blue-600" /> إضافة عميل جديد
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
            <div className="p-0 overflow-y-auto">
              <div className="p-4 sm:p-6">
                <AddCustomerForm 
                  initialCode={generateCustomerCode()}
                  onSave={handleAddCustomer} 
                  onCancel={() => setIsAdding(false)} 
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex justify-between items-center p-4 sm:p-6 pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Edit3 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">تعديل بيانات العميل</h3>
                  <p className="text-[11px] text-slate-400">تحديث معلومات الاتصال، الشروط الائتمانية، والرقم الضريبي</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingCustomer(null)}
                className="btn-3d btn-3d-white p-1.5 rounded-xl text-slate-500 hover:text-slate-800 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                title="إغلاق النافذة"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto">
              <form onSubmit={handleUpdateCustomer} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">كود العميل:</label>
                    <input
                      type="text"
                      value={editingCustomer.code || ''}
                      onChange={(e) => setEditingCustomer({...editingCustomer, code: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                      placeholder="CUST-001"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">اسم العميل / المؤسسة <span className="text-red-500">*</span>:</label>
                    <input
                      type="text"
                      required
                      value={editingCustomer.name}
                      onChange={(e) => setEditingCustomer({...editingCustomer, name: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">الرقم الضريبي:</label>
                    <input
                      type="text"
                      value={editingCustomer.taxNumber || ''}
                      onChange={(e) => setEditingCustomer({...editingCustomer, taxNumber: e.target.value})}
                      placeholder="300000000000003"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">رقم الهاتف الجوال / تليفون:</label>
                    <input
                      type="text"
                      value={editingCustomer.phone || ''}
                      onChange={(e) => setEditingCustomer({...editingCustomer, phone: e.target.value})}
                      placeholder="05XXXXXXXX"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">البريد الإلكتروني:</label>
                    <input
                      type="email"
                      value={editingCustomer.email || ''}
                      onChange={(e) => setEditingCustomer({...editingCustomer, email: e.target.value})}
                      placeholder="billing@customer.com"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">العنوان / المقر:</label>
                    <input
                      type="text"
                      value={editingCustomer.address || ''}
                      onChange={(e) => setEditingCustomer({...editingCustomer, address: e.target.value})}
                      placeholder="المدينة - الحي - الشارع"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">حد الائتمان المسموح (ريال):</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingCustomer.creditLimit !== undefined ? editingCustomer.creditLimit : ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer, 
                        creditLimit: e.target.value ? Number(e.target.value) : undefined
                      })}
                      placeholder="مثال: 50000"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">فترة الائتمان / السداد:</label>
                    <select
                      value={editingCustomer.paymentTermsDays || 0}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer, 
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
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">الرصيد الافتتاحي السابق ({currencySymbol}):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingCustomer.openingBalance || 0}
                    onChange={(e) => setEditingCustomer({...editingCustomer, openingBalance: Number(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    القيمة الموجبة تعني رصيد مدين مستحق لنا، والقيمة السالبة تعني رصيد دائن للعميل.
                  </span>
                </div>

                <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingCustomer(null)}
                    className="btn-3d btn-3d-white w-full sm:w-auto px-4 py-2.5 sm:py-2 text-xs font-black hover:scale-105 active:scale-95 transition-all text-center justify-center"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="btn-3d btn-3d-blue w-full sm:w-auto px-5 py-2.5 sm:py-2 text-xs font-black hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1.5"
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
        <h2 className="text-xl font-bold mt-4 border-b pb-2 inline-block">كشف بيانات وأرصدة العملاء</h2>
        <div className="mt-4 text-sm flex justify-between px-10 text-slate-600">
          <span>تاريخ الطباعة: {new Date().toLocaleDateString('ar-SA')}</span>
          <span>عدد السجلات: {filteredCustomers.length} عميل</span>
        </div>
      </div>

      {/* Mobile / Responsive Cards Feed (Visible on Mobile by default or when CARDS mode is active) */}
      {(viewMode === 'CARDS' || viewMode === 'AUTO') && (
        <div className={`space-y-3 mb-4 print:hidden ${viewMode === 'AUTO' ? 'md:hidden' : ''}`}>
          {filteredCustomers.map(({ customer: c, statement }) => {
            const isOverCreditLimit = Boolean(
              c.creditLimit && 
              statement.balanceType === 'DEBIT' && 
              statement.balance > c.creditLimit
            );

            return (
              <div 
                key={c.id} 
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400 p-4 shadow-xs transition-all flex flex-col justify-between group"
              >
                {/* Top Badge & Customer Info */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] font-bold border border-slate-200 shrink-0">
                      {c.code || '-'}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate" title={c.name}>
                      {c.name}
                    </h3>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                    statement.balanceType === 'DEBIT' 
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                      : statement.balanceType === 'CREDIT' 
                      ? 'bg-purple-50 text-purple-800 border border-purple-200' 
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {statement.balanceLabel}
                  </span>
                </div>

                {/* Over Limit Alert */}
                {isOverCreditLimit && (
                  <div className="mb-2 px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] font-bold flex items-center gap-1.5">
                    <ShieldAlert size={14} className="text-rose-600 shrink-0" />
                    <span>تجاوز الحد الائتماني المسموح ({c.creditLimit?.toLocaleString()} {currencySymbol})</span>
                  </div>
                )}

                {/* Contact and address */}
                <div className="space-y-1.5 mb-3 text-xs">
                  {c.phone ? (
                    <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <a 
                        href={`tel:${c.phone}`}
                        dir="ltr" 
                        className="font-mono font-bold text-slate-700 hover:text-blue-600 flex items-center gap-1.5"
                        title="اتصال هاتفي مباشر"
                      >
                        <Phone size={13} className="text-blue-600 shrink-0" />
                        <span>{c.phone}</span>
                      </a>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(c.phone!, c.id)}
                          className="btn-3d btn-3d-white p-1 rounded-md text-slate-500 hover:text-slate-800"
                          title="نسخ رقم الهاتف"
                        >
                          {copiedPhoneId === c.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        </button>
                        <a
                          href={`https://wa.me/${c.phone.replace(/[^\d]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-3d btn-3d-white p-1 rounded-md text-emerald-600 hover:text-emerald-700"
                          title="محادثة واتساب"
                        >
                          <MessageSquare size={12} />
                        </a>
                      </div>
                    </div>
                  ) : null}

                  {c.taxNumber && (
                    <div className="text-[11px] text-slate-500 font-mono px-1">
                      الرقم الضريبي: {c.taxNumber}
                    </div>
                  )}

                  {c.address && (
                    <div className="text-[11px] text-slate-500 truncate px-1" title={c.address}>
                      📍 {c.address}
                    </div>
                  )}
                </div>

                {/* Balance & Operations Highlight */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 mb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">الرصيد الفعلي الحالي</span>
                    <span className={`font-mono text-base font-black ${
                      statement.balanceType === 'DEBIT' ? 'text-emerald-700' : statement.balanceType === 'CREDIT' ? 'text-purple-700' : 'text-slate-600'
                    }`}>
                      {statement.balanceFormatted} <span className="text-xs font-normal">{currencySymbol}</span>
                    </span>
                  </div>
                  <div className="text-left text-[11px] text-slate-500">
                    <div className="font-mono font-bold text-slate-700">
                      {statement.transactions.length} حركات
                    </div>
                    {c.creditLimit ? (
                      <span className="text-[10px] text-slate-400">سقف: {c.creditLimit.toLocaleString()} {currencySymbol}</span>
                    ) : (
                      <span className="text-[10px] text-slate-400">ائتمان مفتوح</span>
                    )}
                  </div>
                </div>

                {/* 3D Action Buttons on Card */}
                <div className="pt-2 border-t border-slate-100 grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickReceipt(c)}
                    className="btn-3d btn-3d-blue py-2 px-1 text-xs font-black flex items-center justify-center gap-1 col-span-1"
                    title="سند قبض فوري"
                  >
                    <Receipt size={13} />
                    <span>قبض</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPartnerForStatement(c)}
                    className="btn-3d btn-3d-success-soft py-2 px-1 text-xs font-black flex items-center justify-center gap-1 col-span-1"
                    title="كشف الحساب"
                  >
                    <FileText size={13} />
                    <span>كشف</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenConfirmation(c, statement)}
                    className="btn-3d btn-3d-white py-2 px-1 text-xs font-black flex items-center justify-center gap-1 text-indigo-700 col-span-1"
                    title="مصادقة الرصيد"
                  >
                    <FileCheck size={13} className="text-indigo-600" />
                    <span>مصادقة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCustomer(c)}
                    className="btn-3d btn-3d-white py-2 px-1 text-xs font-black flex items-center justify-center gap-1 col-span-1 sm:col-span-1"
                    title="تعديل العميل"
                  >
                    <Edit3 size={13} />
                    <span className="sm:hidden">تعديل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomer(c.id, c.name)}
                    className="btn-3d btn-3d-danger-soft py-2 px-1 text-xs font-black flex items-center justify-center gap-1 col-span-2 sm:col-span-1"
                    title="حذف العميل"
                  >
                    <Trash2 size={13} />
                    <span className="sm:hidden">حذف</span>
                  </button>
                </div>
              </div>
            );
          })}

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              لا توجد حسابات عملاء مطابقة للفلاتر أو معايير البحث الحالية
            </div>
          )}
        </div>
      )}

      {/* Main Customers Table (Visible on Desktop by default, or when TABLE mode is active) */}
      <div className={`bg-white rounded-xl shadow-xs border border-slate-200 print:border-none print:shadow-none overflow-hidden flex-1 flex flex-col ${
        viewMode === 'AUTO' ? 'hidden md:flex print:flex' : viewMode === 'TABLE' ? 'flex print:flex' : 'hidden'
      }`}>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-right border-collapse min-w-[760px]">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr className="text-[10px] uppercase text-slate-500 font-bold">
                <th className="px-4 py-3.5">الكود</th>
                <th className="px-5 py-3.5">اسم العميل / المؤسسة</th>
                <th className="px-4 py-3.5 hidden sm:table-cell">بيانات الاتصال</th>
                <th className="px-4 py-3.5 hidden md:table-cell">الرقم الضريبي</th>
                <th className="px-4 py-3.5 text-center hidden lg:table-cell">حد الائتمان</th>
                <th className="px-4 py-3.5 text-center hidden md:table-cell">العمليات</th>
                <th className="px-5 py-3.5">الرصيد الفعلي الحالي</th>
                <th className="px-4 py-3.5 text-center print:hidden">إجراءات سريعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredCustomers.map(({ customer: c, statement }) => {
                const isOverCreditLimit = Boolean(
                  c.creditLimit && 
                  statement.balanceType === 'DEBIT' && 
                  statement.balance > c.creditLimit
                );

                return (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Code */}
                    <td className="px-4 py-3.5 text-slate-600 font-mono text-xs font-semibold whitespace-nowrap">
                      {c.code || '-'}
                    </td>

                    {/* Name & Address */}
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-800 text-sm">{c.name}</span>
                          {isOverCreditLimit && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-200" title={`تجاوز حد الائتمان (${c.creditLimit?.toLocaleString()} ريال)`}>
                              <ShieldAlert size={10} /> تجاوز الحد
                            </span>
                          )}
                        </div>
                        {c.address && (
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">{c.address}</p>
                        )}
                      </div>
                    </td>

                    {/* Contact (Phone / WhatsApp / Email) */}
                    <td className="px-4 py-3.5 text-slate-600 text-xs hidden sm:table-cell">
                      <div className="flex flex-col gap-1">
                        {c.phone ? (
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            <span dir="ltr" className="font-medium text-slate-700">{c.phone}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(c.phone!, c.id)}
                              className="btn-3d btn-3d-white p-1 rounded-md text-slate-500 hover:text-slate-800 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                              title="نسخ رقم الهاتف"
                            >
                              {copiedPhoneId === c.id ? (
                                <Check size={12} className="text-emerald-600" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                            <a
                              href={`https://wa.me/${c.phone.replace(/[^\d]/g, '')}`}
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
                        {c.email && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono truncate max-w-[150px]" title={c.email}>
                            <Mail size={11} className="shrink-0 text-slate-400" />
                            <span className="truncate">{c.email}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Tax Number */}
                    <td className="px-4 py-3.5 text-slate-600 font-mono text-xs hidden md:table-cell whitespace-nowrap">
                      {c.taxNumber || '-'}
                    </td>

                    {/* Credit Limit & Terms */}
                    <td className="px-4 py-3.5 text-center hidden lg:table-cell">
                      <div className="flex flex-col items-center">
                        {c.creditLimit ? (
                          <span className="font-mono font-bold text-xs text-slate-700">
                            {c.creditLimit.toLocaleString()} {currencySymbol}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">مفتوح</span>
                        )}
                        {c.paymentTermsDays ? (
                          <span className="text-[10px] text-slate-400 font-medium">
                            سداد {c.paymentTermsDays} يوم
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
                          statement.balanceType === 'DEBIT' 
                            ? 'text-emerald-700' 
                            : statement.balanceType === 'CREDIT' 
                            ? 'text-purple-700' 
                            : 'text-slate-500'
                        }`}>
                          {statement.balanceFormatted} {currencySymbol}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            statement.balanceType === 'DEBIT' 
                              ? 'bg-emerald-500' 
                              : statement.balanceType === 'CREDIT' 
                              ? 'bg-purple-500' 
                              : 'bg-slate-400'
                          }`} />
                          <span className="text-[10px] text-slate-500">{statement.balanceLabel}</span>
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 print:hidden text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Quick Receipt Voucher Button */}
                        <button
                          type="button"
                          onClick={() => handleQuickReceipt(c)}
                          className="btn-3d btn-3d-blue px-2.5 py-1 text-xs font-black flex items-center gap-1 hover:scale-105 active:scale-95 transition-all"
                          title="إنشاء سند قبض فوري للعميل"
                        >
                          <Receipt size={12} />
                          <span>قبض</span>
                        </button>

                        {/* Statement Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedPartnerForStatement(c)}
                          className="btn-3d btn-3d-success-soft px-2.5 py-1 text-xs font-black flex items-center gap-1 hover:scale-105 active:scale-95 transition-all"
                          title="فتح كشف حساب العميل التفصيلي المطابق"
                        >
                          <FileText size={12} />
                          <span>كشف الحساب</span>
                        </button>

                        {/* Balance Confirmation Letter Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenConfirmation(c, statement)}
                          className="btn-3d btn-3d-white px-2 py-1 text-xs font-black flex items-center gap-1 text-indigo-700 hover:text-indigo-900 hover:scale-105 active:scale-95 transition-all"
                          title="إصدار وطباعة خطاب مصادقة رصيد العميل الدوري"
                        >
                          <FileCheck size={12} className="text-indigo-600" />
                          <span>مصادقة</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => setEditingCustomer(c)}
                          className="btn-3d btn-3d-white p-1.5 text-xs font-black hover:scale-105 active:scale-95 transition-all"
                          title="تعديل بيانات العميل"
                        >
                          <Edit3 size={13} />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomer(c.id, c.name)}
                          className="btn-3d btn-3d-danger-soft p-1.5 text-xs font-black hover:scale-105 active:scale-95 transition-all"
                          title="حذف العميل"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 text-xs">
                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                    لا توجد حسابات عملاء مطابقة للفلاتر أو معايير البحث الحالية
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Floating Table Footer Summary */}
        {filteredCustomers.length > 0 && (
          <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
            <div className="font-bold">
              إجمالي النتائج المعروضة: <span className="font-mono text-slate-900">{filteredTotals.count}</span> عميل
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <div>
                إجمالي المدين (لنا): <span className="font-bold text-emerald-700">{filteredTotals.netDebitBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} ريال</span>
              </div>
              {filteredTotals.netCreditBalance > 0 && (
                <div>
                  إجمالي الدائن (مقدماً): <span className="font-bold text-purple-700">{filteredTotals.netCreditBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} ريال</span>
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
        <CustomerKpiModal
          type={selectedKpiModal}
          isOpen={true}
          onClose={() => setSelectedKpiModal(null)}
          customersWithStatements={customersWithStatements}
          onSelectPartnerForStatement={(partner) => setSelectedPartnerForStatement(partner)}
          onQuickReceipt={handleQuickReceipt}
        />
      )}
    </div>
  );
}
