import { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Truck, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  Receipt, 
  Eye, 
  CheckCircle2, 
  Printer, 
  X, 
  FileText, 
  Scale, 
  ShieldCheck, 
  RefreshCw,
  Clock,
  Calendar,
  AlertTriangle,
  RotateCcw,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MessageSquare,
  FileCheck,
  Copy,
  Check
} from 'lucide-react';
import PrintDropdown from './PrintDropdown';
import PrintPreviewModal, { PrintPreviewData } from './PrintPreviewModal';
import VouchersExportModal from './VouchersExportModal';
import BalanceConfirmationModal from './BalanceConfirmationModal';
import PartnerAgingReport from './PartnerAgingReport';
import ExportButtonGroup from './ExportButtonGroup';
import { getSystemSettings } from '../utils/settings';
import { useSystemCurrency } from '../utils/currency';
import { 
  loadAllVouchers, 
  setVoucherPostingStatus, 
  StoredVoucherRecord,
  getPartnerAccountStatement,
  loadCustomers,
  loadVendors
} from '../utils/partnerLedger';
import { VoucherType } from '../types/accounting';
import ReportPrintPreviewToolbar from './ReportPrintPreviewToolbar';

export interface PartnerBalanceItem {
  id: string;
  code: string;
  name: string;
  type: 'CUSTOMER' | 'VENDOR';
  taxNumber?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  address?: string | undefined;
  creditLimit?: number | undefined;
  paymentTermsDays?: number | undefined;
  openingBalance: number; // Positive = Debit, Negative = Credit
  totalWithdrawals: number; // إجمالي المسحوبات (فواتير بيع للعملاء أو فواتير شراء مستلمة من الموردين)
  totalPayments: number; // إجمالي المدفوعات (سدادات نقدية/بنكية مقبوضة من العميل أو مسددة للمورد)
  lastTransactionDate: string;
  category?: string | undefined;
  notes?: string | undefined;
  transactions?: {
    id: string;
    date: string;
    type: 'INVOICE' | 'PAYMENT' | 'OPENING';
    docNumber: string;
    description: string;
    debit: number;
    credit: number;
  }[] | undefined;
  calc: {
    balanceType: 'DEBIT' | 'CREDIT' | 'ZERO';
    balanceAmount: number;
    paymentRatio: number;
    isOverCreditLimit?: boolean;
  };
}

// The list is dynamically loaded from actual ledger data.

export default function PartnerBalances() {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [systemSettings] = useState(() => getSystemSettings());

  // State
  const [partners, setPartners] = useState<PartnerBalanceItem[]>([]);
  const [showReportPrintPreview, setShowReportPrintPreview] = useState(false);

  const loadLivePartners = () => {
    const allCustomers = loadCustomers();
    const allVendors = loadVendors();
    const combined = [...allCustomers, ...allVendors];
    
    const livePartners: PartnerBalanceItem[] = combined.map(p => {
      const stmt = getPartnerAccountStatement(p);
      const creditLimit = (p as any).creditLimit || undefined;
      const paymentTermsDays = (p as any).paymentTermsDays || undefined;
      const email = (p as any).email || undefined;
      const address = (p as any).address || undefined;

      const item: PartnerBalanceItem = {
        id: p.id,
        code: p.code || '',
        name: p.name,
        type: (p.type as 'CUSTOMER' | 'VENDOR') || 'CUSTOMER',
        taxNumber: p.taxNumber,
        phone: p.phone,
        email,
        address,
        creditLimit,
        paymentTermsDays,
        openingBalance: p.openingBalance || 0,
        totalWithdrawals: stmt.totalWithdrawals,
        totalPayments: stmt.totalPayments,
        lastTransactionDate: (stmt.transactions && stmt.transactions.length > 0 && stmt.transactions[stmt.transactions.length - 1]) 
          ? (stmt.transactions[stmt.transactions.length - 1]?.date || '') 
          : '',
        category: p.type === 'CUSTOMER' ? 'عميل' : 'مورد',
        transactions: stmt.transactions as any,
        calc: {
          balanceType: 'ZERO',
          balanceAmount: 0,
          paymentRatio: 0,
          isOverCreditLimit: false
        }
      };
      return item;
    });
    setPartners(livePartners);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [partnerTypeFilter, setPartnerTypeFilter] = useState<'ALL' | 'CUSTOMER' | 'VENDOR'>('ALL');
  const [balanceFilter, setBalanceFilter] = useState<'ALL' | 'DEBIT' | 'CREDIT' | 'ZERO' | 'OVER_LIMIT'>('ALL');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');
  const [selectedPartnerForStatement, setSelectedPartnerForStatement] = useState<PartnerBalanceItem | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [customPreviewData, setCustomPreviewData] = useState<PrintPreviewData | null>(null);

  // Sorting state for table view
  type SortField = 'code' | 'name' | 'type' | 'opening' | 'withdrawals' | 'payments' | 'ratio' | 'balance' | 'status';
  const [sortField, setSortField] = useState<SortField>('balance');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Confirmation letter & quick actions state
  const [selectedPartnerForConfirmation, setSelectedPartnerForConfirmation] = useState<PartnerBalanceItem | null>(null);
  const [phoneCopiedId, setPhoneCopiedId] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'name' || field === 'code' ? 'asc' : 'desc');
    }
  };

  const handleQuickVoucher = (partner: PartnerBalanceItem, actionType: 'RECEIPT' | 'PAYMENT') => {
    sessionStorage.setItem('alpha_pending_voucher_partner', partner.id);
    const viewName = actionType === 'RECEIPT' ? 'externalReceipt' : 'externalPayment';
    window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: viewName } }));
  };

  const handleSendWhatsAppNotice = (partner: PartnerBalanceItem) => {
    if (!partner.phone) {
      alert('لا يتوفر رقم هاتف مسجل لهذا الطرف.');
      return;
    }
    const cleanPhone = partner.phone.replace(/[^\d]/g, '');
    const isCustomer = partner.type === 'CUSTOMER';
    const isDebit = partner.calc.balanceType === 'DEBIT';
    const isCredit = partner.calc.balanceType === 'CREDIT';
    const nature = isDebit 
      ? (isCustomer ? 'مستحق لنا بذمتكم' : 'دفعة مقدمة لكم من طرفنا')
      : isCredit 
      ? (isCustomer ? 'دفعة مقدمة مسددة منكم' : 'مستحق لكم واجب السداد من طرفنا')
      : 'متزن (صفر)';

    const todayStr = new Date().toISOString().split('T')[0];
    const msg = `السلام عليكم ورحمة الله وبركاته،
السادة/ ${partner.name} المحترمين
تحية طيبة وبعد،

نحيطكم علماً بأن رصيد حسابكم المسجل لدينا في ${systemSettings.company.nameAr} حتى تاريخ ${todayStr} هو:
${partner.calc.balanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currencySymbol} (${nature}).

شاكرين حسن تعاونكم الدائم.`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleCopyPhone = (partnerId: string, phone: string) => {
    navigator.clipboard.writeText(phone);
    setPhoneCopiedId(partnerId);
    setTimeout(() => setPhoneCopiedId(null), 2000);
  };

  // Dynamic statement containing all Sub-Ledger transactions (Invoices, Vouchers & Journal Entries)
  const activeStatementData = useMemo(() => {
    if (!selectedPartnerForStatement) return null;
    return getPartnerAccountStatement({
      id: selectedPartnerForStatement.id,
      name: selectedPartnerForStatement.name,
      type: selectedPartnerForStatement.type,
      taxNumber: selectedPartnerForStatement.taxNumber ?? '',
      phone: selectedPartnerForStatement.phone ?? '',
      openingBalance: selectedPartnerForStatement.openingBalance
    });
  }, [selectedPartnerForStatement]);

  // Tab State: Balances vs Aging Report vs Vouchers Ledger Report
  const [activeMainTab, setActiveMainTab] = useState<'BALANCES' | 'AGING' | 'VOUCHERS_LEDGER'>('BALANCES');

  // Vouchers state for the new report
  const [vouchersList, setVouchersList] = useState<StoredVoucherRecord[]>(() => loadAllVouchers());
  const [voucherSearchQuery, setVoucherSearchQuery] = useState('');
  const [voucherStatusFilter, setVoucherStatusFilter] = useState<'ALL' | 'POSTED' | 'DRAFT'>('ALL');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<'ALL' | 'RECEIPT' | 'PAYMENT'>('ALL');
  const [voucherPartnerTypeFilter, setVoucherPartnerTypeFilter] = useState<'ALL' | 'CUSTOMER' | 'VENDOR'>('ALL');
  const [voucherDateFrom, setVoucherDateFrom] = useState('');
  const [voucherDateTo, setVoucherDateTo] = useState('');

  const [showCreditorsModal, setShowCreditorsModal] = useState(false);
  const [showDebtorsModal, setShowDebtorsModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Reload vouchers from storage
  const reloadVouchers = () => {
    setVouchersList(loadAllVouchers());
  };

  useEffect(() => {
    loadLivePartners(); // Initial load
    const handleUpdate = () => {
      reloadVouchers();
      loadLivePartners();
    };
    window.addEventListener('alpha-partner-ledger-updated', handleUpdate);
    window.addEventListener('alpha-system-reset-completed', handleUpdate);
    window.addEventListener('alpha-data-changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('alpha-partner-ledger-updated', handleUpdate);
      window.removeEventListener('alpha-system-reset-completed', handleUpdate);
      window.removeEventListener('alpha-data-changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handleResetData = () => {
    if (window.confirm('لا يمكن إعادة التعيين هنا للبيانات المباشرة. يتم التحكم في العملاء والموردين من شاشاتهم المخصصة.')) {
      // No-op for live data
    }
  };

  // Helper to calculate partner net balance
  // For Customer: Net Balance = openingBalance + totalWithdrawals - totalPayments
  //   If > 0 -> DEBIT (مدين - عليه مبالغ لنا)
  //   If < 0 -> CREDIT (دائن - له مبالغ علينا)
  // For Vendor: Net Balance = -openingBalance + totalWithdrawals - totalPayments (where withdrawals is purchases)
  //   In accounting terms for Vendor:
  //   Total Purchases (Withdrawals) - Total Payments = Net Owed to Vendor
  //   If > 0 -> CREDIT (دائن - التزام علينا للمورد)
  //   If < 0 -> DEBIT (مدين - دفعات مقدمة لنا عند المورد)
  const getPartnerCalculations = (p: PartnerBalanceItem) => {
    let netBalance = 0;
    let balanceType: 'DEBIT' | 'CREDIT' | 'ZERO' = 'ZERO';
    let balanceAmount = 0;

    if (p.type === 'CUSTOMER') {
      netBalance = p.openingBalance + (p.totalWithdrawals - p.totalPayments);
      if (netBalance > 0.001) {
        balanceType = 'DEBIT'; // مدين
        balanceAmount = netBalance;
      } else if (netBalance < -0.001) {
        balanceType = 'CREDIT'; // دائن
        balanceAmount = Math.abs(netBalance);
      } else {
        balanceType = 'ZERO';
        balanceAmount = 0;
      }
    } else {
      // VENDOR
      // Positive balance means we owe the vendor (CREDIT)
      // If opening balance was negative (-18000), it represented an initial credit
      const initialCredit = p.openingBalance < 0 ? Math.abs(p.openingBalance) : -p.openingBalance;
      const owed = initialCredit + p.totalWithdrawals - p.totalPayments;
      if (owed > 0.001) {
        balanceType = 'CREDIT'; // دائن (له عندنا)
        balanceAmount = owed;
      } else if (owed < -0.001) {
        balanceType = 'DEBIT'; // مدين (لنا عنده)
        balanceAmount = Math.abs(owed);
      } else {
        balanceType = 'ZERO';
        balanceAmount = 0;
      }
    }

    // Payment ratio (نسبة التحصيل أو السداد)
    const paymentRatio = p.totalWithdrawals > 0 
      ? Math.min(100, Math.round((p.totalPayments / p.totalWithdrawals) * 100))
      : (p.totalPayments > 0 ? 100 : 0);

    const isOverCreditLimit = !!(p.creditLimit && p.creditLimit > 0 && balanceAmount > p.creditLimit && (
      (p.type === 'CUSTOMER' && balanceType === 'DEBIT') ||
      (p.type === 'VENDOR' && balanceType === 'CREDIT')
    ));

    return {
      balanceType,
      balanceAmount,
      paymentRatio,
      isOverCreditLimit
    };
  };

  // Enriched partners list
  const enrichedPartners = useMemo(() => {
    return partners.map(p => {
      const calc = getPartnerCalculations(p);
      return {
        ...p,
        calc
      };
    });
  }, [partners]);

  // Grand Totals across all customers and suppliers
  const grandTotals = useMemo(() => {
    let totalSalesInvoices = 0;
    let totalPurchaseInvoices = 0;
    let totalCustomerReceipts = 0;
    let totalVendorPayments = 0;

    let totalDebitSum = 0; // إجمالي أرصدة المدينين
    let totalCreditSum = 0; // إجمالي أرصدة الدائنين
    let debtorCount = 0;
    let creditorCount = 0;

    enrichedPartners.forEach(p => {
      if (p.type === 'CUSTOMER') {
        totalSalesInvoices += p.totalWithdrawals;
        totalCustomerReceipts += p.totalPayments;
      } else {
        totalPurchaseInvoices += p.totalWithdrawals;
        totalVendorPayments += p.totalPayments;
      }

      if (p.calc.balanceType === 'DEBIT') {
        totalDebitSum += p.calc.balanceAmount;
        debtorCount++;
      } else if (p.calc.balanceType === 'CREDIT') {
        totalCreditSum += p.calc.balanceAmount;
        creditorCount++;
      }
    });

    const grandWithdrawals = totalSalesInvoices + totalPurchaseInvoices;
    const grandPayments = totalCustomerReceipts + totalVendorPayments;
    const netOverallPosition = totalDebitSum - totalCreditSum;

    return {
      totalSalesInvoices,
      totalPurchaseInvoices,
      totalCustomerReceipts,
      totalVendorPayments,
      grandWithdrawals,
      grandPayments,
      totalDebitSum,
      totalCreditSum,
      debtorCount,
      creditorCount,
      totalPartners: enrichedPartners.length,
      netOverallPosition
    };
  }, [enrichedPartners]);

  // Separate Creditors and Debtors
  const creditorsList = useMemo(() => {
    return enrichedPartners.filter(p => p.calc.balanceType === 'CREDIT');
  }, [enrichedPartners]);

  const debtorsList = useMemo(() => {
    return enrichedPartners.filter(p => p.calc.balanceType === 'DEBIT');
  }, [enrichedPartners]);

  // Card summary metrics for Creditors
  const creditorsSummary = useMemo(() => {
    let withdrawals = 0;
    let payments = 0;
    let totalCredit = 0;
    creditorsList.forEach(p => {
      withdrawals += p.totalWithdrawals;
      payments += p.totalPayments;
      totalCredit += p.calc.balanceAmount;
    });
    return { withdrawals, payments, totalCredit, count: creditorsList.length };
  }, [creditorsList]);

  // Card summary metrics for Debtors
  const debtorsSummary = useMemo(() => {
    let withdrawals = 0;
    let payments = 0;
    let totalDebit = 0;
    debtorsList.forEach(p => {
      withdrawals += p.totalWithdrawals;
      payments += p.totalPayments;
      totalDebit += p.calc.balanceAmount;
    });
    return { withdrawals, payments, totalDebit, count: debtorsList.length };
  }, [debtorsList]);

  // Filtered partners for search & filter
  const filteredPartners = useMemo(() => {
    return enrichedPartners.filter(p => {
      // Type filter
      if (partnerTypeFilter !== 'ALL' && p.type !== partnerTypeFilter) return false;
      // Balance filter
      if (balanceFilter === 'OVER_LIMIT') {
        if (!p.calc.isOverCreditLimit) return false;
      } else if (balanceFilter !== 'ALL' && p.calc.balanceType !== balanceFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchCode = p.code.toLowerCase().includes(q);
        const matchPhone = p.phone && p.phone.includes(q);
        const matchTax = p.taxNumber && p.taxNumber.includes(q);
        return matchName || matchCode || matchPhone || matchTax;
      }
      return true;
    });
  }, [enrichedPartners, partnerTypeFilter, balanceFilter, searchQuery]);

  // Sorted and Filtered partners for table and export
  const sortedAndFilteredPartners = useMemo(() => {
    const list = [...filteredPartners];
    list.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'code':
          comparison = a.code.localeCompare(b.code);
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name, 'ar');
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'opening':
          comparison = Math.abs(a.openingBalance) - Math.abs(b.openingBalance);
          break;
        case 'withdrawals':
          comparison = a.totalWithdrawals - b.totalWithdrawals;
          break;
        case 'payments':
          comparison = a.totalPayments - b.totalPayments;
          break;
        case 'ratio':
          comparison = a.calc.paymentRatio - b.calc.paymentRatio;
          break;
        case 'balance':
          comparison = a.calc.balanceAmount - b.calc.balanceAmount;
          break;
        case 'status':
          comparison = a.calc.balanceType.localeCompare(b.calc.balanceType);
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [filteredPartners, sortField, sortDirection]);

  // Preview data builders
  const createPartnerStatementPreviewData = (partner: PartnerBalanceItem): PrintPreviewData => {
    // Generate full real-time statement with Sub-Ledger journal entries and control accounts
    const stmt = getPartnerAccountStatement({
      id: partner.id,
      name: partner.name,
      type: partner.type,
      taxNumber: partner.taxNumber,
      phone: partner.phone,
      openingBalance: partner.openingBalance
    });

    const calc = getPartnerCalculations(partner);
    const balanceText = stmt ? stmt.balanceLabel : (calc.balanceType === 'DEBIT' ? 'مدين (مستحق لنا)' : calc.balanceType === 'CREDIT' ? 'دائن (مستحق له)' : 'متزن');
    const finalBalAmount = stmt ? stmt.netBalance : calc.balanceAmount;

    const txItems = stmt && stmt.transactions.length > 0
      ? stmt.transactions.map(tx => {
          const isJournal = tx.type === 'JOURNAL_ENTRY' || tx.docNumber.startsWith('#JE-') || tx.docNumber.startsWith('JE-');
          const typePrefix = isJournal ? '[قيد يومية Sub-Ledger] ' : '';
          return {
            description: `[${tx.date}] ${typePrefix}${tx.description} (${tx.docNumber})`,
            quantity: 1,
            unitPrice: tx.debit > 0 ? tx.debit : tx.credit,
            taxRate: 0,
            total: tx.debit > 0 ? tx.debit : -tx.credit
          };
        })
      : (partner.transactions && partner.transactions.length > 0)
      ? partner.transactions.map(tx => ({
          description: `[${tx.date}] ${tx.description} (${tx.docNumber})`,
          quantity: 1,
          unitPrice: tx.debit > 0 ? tx.debit : tx.credit,
          taxRate: 0,
          total: tx.debit > 0 ? tx.debit : -tx.credit
        }))
      : [{
          description: `الرصيد الافتتاحي: ${partner.openingBalance.toLocaleString()} ${currencySymbol} | إجمالي المسحوبات: ${partner.totalWithdrawals.toLocaleString()} ${currencySymbol} | إجمالي المدفوعات: ${partner.totalPayments.toLocaleString()} ${currencySymbol}`,
          quantity: 1,
          unitPrice: finalBalAmount,
          taxRate: 0,
          total: finalBalAmount
        }];

    return {
      title: `كشف حساب ${partner.type === 'CUSTOMER' ? 'عميل' : 'مورد'}`,
      subtitle: `كشف حساب تفصيلي ومطابقة أرصدة - ${partner.name}`,
      docNumber: partner.code,
      date: new Date().toISOString().split('T')[0] as string,
      partnerName: partner.name,
      partnerType: partner.type,
      partnerTaxNo: partner.taxNumber,
      paymentMethod: `الرصيد الصافي: ${finalBalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currencySymbol} (${balanceText})`,
      notes: `الرصيد الافتتاحي: ${(stmt?.openingBalance ?? partner.openingBalance).toLocaleString()} | إجمالي المدين (المسحوبات): ${(stmt?.totalDebit ?? partner.totalWithdrawals).toLocaleString()} | إجمالي الدائن (المدفوعات): ${(stmt?.totalCredit ?? partner.totalPayments).toLocaleString()} | قيود اليومية: ${stmt?.totalJournalEntries ?? 0}`,
      subtotal: stmt?.totalDebit ?? partner.totalWithdrawals,
      taxTotal: 0,
      grandTotal: finalBalAmount,
      paidAmount: stmt?.totalCredit ?? partner.totalPayments,
      remainingAmount: finalBalAmount,
      items: txItems
    };
  };

  const createOverallBalancesPreviewData = (): PrintPreviewData => {
    const items = filteredPartners.map(p => ({
      description: `${p.code} - ${p.name} (${p.type === 'CUSTOMER' ? 'عميل' : 'مورد'}) [مسحوبات: ${p.totalWithdrawals.toLocaleString()} | مدفوعات: ${p.totalPayments.toLocaleString()}]`,
      quantity: 1,
      unitPrice: p.calc.balanceAmount,
      taxRate: 0,
      total: p.calc.balanceAmount
    }));

    return {
      title: 'تقرير كشف ومطابقة أرصدة العملاء والموردين',
      subtitle: 'بيان شامل بالأرصدة الدائنة والمدينة وإجمالي المسحوبات والمدفوعات',
      docNumber: `REP-${new Date().getFullYear()}-${String(filteredPartners.length).padStart(3, '0')}`,
      date: new Date().toISOString().split('T')[0] as string,
      partnerName: 'كافة العملاء والموردين المعتمدين',
      partnerType: 'CUSTOMER',
      paymentMethod: 'تقرير مالي مجمّع',
      notes: `إجمالي مسحوبات الجميع: ${grandTotals.grandWithdrawals.toLocaleString()} ${currencySymbol} | إجمالي مدفوعات الجميع: ${grandTotals.grandPayments.toLocaleString()} ${currencySymbol} | صافي المركز: ${grandTotals.netOverallPosition.toLocaleString()} ${currencySymbol}`,
      subtotal: grandTotals.grandWithdrawals,
      grandTotal: grandTotals.totalDebitSum + grandTotals.totalCreditSum,
      paidAmount: grandTotals.grandPayments,
      remainingAmount: Math.abs(grandTotals.netOverallPosition),
      items: items.length > 0 ? items : [{
        description: 'لا توجد بيانات مطابقة لمعايير البحث',
        quantity: 1,
        unitPrice: 0,
        taxRate: 0,
        total: 0
      }]
    };
  };

  // -------------------------------------------------------------
  // 🌟 VOUCHERS LEDGER REPORT LOGIC & HELPERS (التقرير الجديد) 🌟
  // -------------------------------------------------------------
  
  // Format DateTime in a clean Arabic display
  const formatPostingDateTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'م' : 'ص';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 => 12
      return `${year}/${month}/${day} ${hours}:${minutes} ${ampm}`;
    } catch {
      return isoString;
    }
  };

  // Filtered Vouchers
  const filteredVouchers = useMemo(() => {
    return vouchersList.filter(v => {
      const vStatus = v.status || 'POSTED';
      const vType = v.type === VoucherType.Receipt ? 'RECEIPT' : 'PAYMENT';
      const pType = v.partnerType || (v.type === VoucherType.Receipt ? 'CUSTOMER' : 'VENDOR');

      // Status filter
      if (voucherStatusFilter !== 'ALL' && vStatus !== voucherStatusFilter) return false;

      // Type filter
      if (voucherTypeFilter !== 'ALL' && vType !== voucherTypeFilter) return false;

      // Partner Type filter
      if (voucherPartnerTypeFilter !== 'ALL' && pType !== voucherPartnerTypeFilter) return false;

      // Date Range filter
      if (voucherDateFrom && v.date < voucherDateFrom) return false;
      if (voucherDateTo && v.date > voucherDateTo) return false;

      // Search query
      if (voucherSearchQuery.trim()) {
        const q = voucherSearchQuery.toLowerCase();
        const numMatch = v.voucherNumber.toLowerCase().includes(q);
        const nameMatch = v.partnerName.toLowerCase().includes(q);
        const descMatch = (v.description || '').toLowerCase().includes(q);
        const accMatch = (v.accountId || '').toLowerCase().includes(q);
        return numMatch || nameMatch || descMatch || accMatch;
      }

      return true;
    });
  }, [vouchersList, voucherStatusFilter, voucherTypeFilter, voucherPartnerTypeFilter, voucherDateFrom, voucherDateTo, voucherSearchQuery]);

  // Vouchers Stats
  const voucherStats = useMemo(() => {
    let totalReceiptsPosted = 0;
    let countReceiptsPosted = 0;
    let totalPaymentsPosted = 0;
    let countPaymentsPosted = 0;
    let totalDraftAmount = 0;
    let countDraft = 0;

    vouchersList.forEach(v => {
      const isPosted = (v.status || 'POSTED') === 'POSTED';
      if (isPosted) {
        if (v.type === VoucherType.Receipt) {
          totalReceiptsPosted += v.amount;
          countReceiptsPosted++;
        } else {
          totalPaymentsPosted += v.amount;
          countPaymentsPosted++;
        }
      } else {
        totalDraftAmount += v.amount;
        countDraft++;
      }
    });

    const netCashFlowPosted = totalReceiptsPosted - totalPaymentsPosted;
    const filteredTotalSum = filteredVouchers.reduce((sum, v) => sum + v.amount, 0);

    return {
      totalReceiptsPosted,
      countReceiptsPosted,
      totalPaymentsPosted,
      countPaymentsPosted,
      netCashFlowPosted,
      totalDraftAmount,
      countDraft,
      totalCount: vouchersList.length,
      filteredCount: filteredVouchers.length,
      filteredTotalSum
    };
  }, [vouchersList, filteredVouchers]);

  // Toggle Posting status directly from the report table
  const handleToggleVoucherPosting = (voucher: StoredVoucherRecord) => {
    const currentStatus: 'POSTED' | 'DRAFT' = voucher.status || 'POSTED';
    const targetStatus: 'POSTED' | 'DRAFT' = currentStatus === 'POSTED' ? 'DRAFT' : 'POSTED';

    if (currentStatus === 'POSTED') {
      if (!confirm(`هل أنت متأكد من رغبتك في إلغاء ترحيل السند رقم (#${voucher.voucherNumber})؟\nسيتم إيقاف أثره المالي على حساب (${voucher.partnerName}) وإعادته كمسودة مؤقتة.`)) {
        return;
      }
    }

    const res = setVoucherPostingStatus(voucher.id, voucher.type, targetStatus);
    if (res.success) {
      reloadVouchers();
      if (targetStatus === 'POSTED') {
        alert(`✅ تم ترحيل السند رقم (#${voucher.voucherNumber}) بنجاح إلى حساب (${voucher.partnerName})!`);
      } else {
        alert(`📝 تم إلغاء ترحيل السند رقم (#${voucher.voucherNumber}) وتحويله إلى مسودة.`);
      }
    }
  };

  // Preview data builder for Vouchers Report
  const createVouchersReportPreviewData = (): PrintPreviewData => {
    const items = filteredVouchers.map(v => {
      const isReceipt = v.type === VoucherType.Receipt;
      const isPosted = (v.status || 'POSTED') === 'POSTED';
      const statusText = isPosted ? 'مرحل بالحسابات' : 'مسودة غير مرحل';
      const postingDateText = isPosted ? (v.postedAt ? `[تاريخ الترحيل: ${formatPostingDateTime(v.postedAt)}]` : `[تاريخ الترحيل: ${v.date}]`) : '[غير مرحل]';
      const pType = (v.partnerType || (isReceipt ? 'CUSTOMER' : 'VENDOR')) === 'CUSTOMER' ? 'عميل' : 'مورد';

      return {
        description: `${isReceipt ? 'سند قبض' : 'سند صرف'} #${v.voucherNumber} - ${v.partnerName} (${pType}) [حالة السند: ${statusText}] ${postingDateText} - ${v.description || ''}`,
        quantity: 1,
        unitPrice: v.amount,
        taxRate: 0,
        total: v.amount
      };
    });

    return {
      title: 'تقرير كشف حركة السندات والترحيل (قبض وصرف)',
      subtitle: 'كشف تحليلي تفصيلي لحركات السندات المرحلة وغير المرحلة بحسابات العملاء والموردين وتواريخ اعتمادها',
      docNumber: `VREP-${new Date().getFullYear()}-${String(filteredVouchers.length).padStart(3, '0')}`,
      date: new Date().toISOString().split('T')[0] as string,
      partnerName: 'كافة العملاء والموردين - حركة السندات',
      partnerType: 'CUSTOMER',
      paymentMethod: 'سندات قبض وصرف معتمدة',
      notes: `إجمالي المقبوضات المرحلة: ${voucherStats.totalReceiptsPosted.toLocaleString()} ${currencySymbol} | إجمالي المدفوعات المرحلة: ${voucherStats.totalPaymentsPosted.toLocaleString()} ${currencySymbol} | صافي الأثر: ${voucherStats.netCashFlowPosted.toLocaleString()} ${currencySymbol} | مسودات غير مرحلة: ${voucherStats.countDraft} بقيمة ${voucherStats.totalDraftAmount.toLocaleString()} ${currencySymbol}`,
      subtotal: voucherStats.filteredTotalSum,
      grandTotal: voucherStats.filteredTotalSum,
      paidAmount: voucherStats.totalReceiptsPosted,
      remainingAmount: voucherStats.totalPaymentsPosted,
      items: items.length > 0 ? items : [{
        description: 'لا توجد سندات مطابقة لمعايير البحث والتصفية المحددة',
        quantity: 1,
        unitPrice: 0,
        taxRate: 0,
        total: 0
      }]
    };
  };

  // Open Partner Statement modal directly from voucher row
  const handleOpenPartnerStatementFromVoucher = (voucher: StoredVoucherRecord) => {
    const found = enrichedPartners.find(p => 
      (voucher.partnerId && p.id === voucher.partnerId) || 
      p.name.trim().toLowerCase() === voucher.partnerName.trim().toLowerCase()
    );

    if (found) {
      setSelectedPartnerForStatement(found);
    } else {
      const pType = voucher.partnerType || (voucher.type === VoucherType.Receipt ? 'CUSTOMER' : 'VENDOR');
      const tempPartner: PartnerBalanceItem = {
        id: voucher.partnerId || `p-${Date.now()}`,
        code: voucher.partnerId || 'PRT-999',
        name: voucher.partnerName,
        type: pType,
        openingBalance: 0,
        totalWithdrawals: voucher.type === VoucherType.Receipt ? voucher.amount : 0,
        totalPayments: voucher.amount,
        lastTransactionDate: voucher.date,
        transactions: [
          {
            id: voucher.id,
            date: voucher.date,
            type: 'PAYMENT',
            docNumber: voucher.voucherNumber,
            description: voucher.description || (voucher.type === VoucherType.Receipt ? 'سند قبض' : 'سند صرف'),
            debit: voucher.type === VoucherType.Payment ? voucher.amount : 0,
            credit: voucher.type === VoucherType.Receipt ? voucher.amount : 0
          }
        ],
        calc: {
          balanceType: 'ZERO',
          balanceAmount: 0,
          paymentRatio: 100,
          isOverCreditLimit: false
        }
      };
      setSelectedPartnerForStatement(tempPartner);
    }
  };

  // Preview & print a single voucher receipt directly from the table
  const handlePrintSingleVoucher = (voucher: StoredVoucherRecord) => {
    const isReceipt = voucher.type === VoucherType.Receipt;
    const pType = voucher.partnerType || (isReceipt ? 'CUSTOMER' : 'VENDOR');
    const isPosted = (voucher.status || 'POSTED') === 'POSTED';
    const voucherPrintData: PrintPreviewData = {
      title: isReceipt ? 'سند قبض مالي' : 'سند صرف مالي',
      subtitle: isReceipt ? 'إشعار استلام نقدية / تحويل بنكي معتمد' : 'إشعار سداد وصرف نقدية / بنكي معتمد',
      docNumber: voucher.voucherNumber,
      date: voucher.date,
      partnerName: voucher.partnerName,
      partnerType: pType,
      paymentMethod: voucher.accountId === 'cash' ? 'نقداً (الصندوق الرئيسي)' : 'تحويل بنكي (البنك الأهلي)',
      notes: `${voucher.description || ''} - [حالة السند: ${isPosted ? 'مرحل ومعتمد بالحسابات' : 'مسودة غير مرحل'}] ${voucher.postedAt ? `(تاريخ الترحيل: ${formatPostingDateTime(voucher.postedAt)})` : ''}`,
      subtotal: voucher.amount,
      taxTotal: 0,
      grandTotal: voucher.amount,
      paidAmount: voucher.amount,
      remainingAmount: 0,
      items: [{
        description: `دفعة بموجب ${isReceipt ? 'سند قبض' : 'سند صرف'} رقم #${voucher.voucherNumber} لحساب (${voucher.partnerName}) - البيان: ${voucher.description || 'سداد دفعات متبادلة'}`,
        quantity: 1,
        unitPrice: voucher.amount,
        taxRate: 0,
        total: voucher.amount
      }]
    };
    setCustomPreviewData(voucherPrintData);
    setShowPrintPreview(true);
  };

  return (
    <>
      <ReportPrintPreviewToolbar
        isOpen={showReportPrintPreview}
        onClose={() => setShowReportPrintPreview(false)}
        title="أرصدة العملاء والموردين"
        targetId="partner-balances-export-area"
      />
      <div id="partner-balances-export-area" className="flex flex-col flex-1 pb-10 print-report-target bg-slate-50/50 min-h-screen">
      
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1 text-slate-500">
            <span className="text-xs uppercase font-bold tracking-tight">الحسابات والتقارير المالية</span>
            <span className="text-xs">/</span>
            <span className="text-xs uppercase font-bold tracking-tight text-indigo-600">
              {activeMainTab === 'BALANCES' ? 'أرصدة العملاء والموردين' : 'تقرير حركة السندات والترحيل'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-md ${
              activeMainTab === 'BALANCES' 
                ? 'bg-gradient-to-tr from-indigo-600 to-blue-500 shadow-indigo-500/20' 
                : 'bg-gradient-to-tr from-emerald-600 to-teal-600 shadow-emerald-500/20'
            }`}>
              {activeMainTab === 'BALANCES' ? <Scale size={22} /> : <Receipt size={22} />}
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                {activeMainTab === 'BALANCES' ? 'أرصدة العملاء والموردين' : 'تقرير حركة السندات والترحيل (قبض وصرف)'}
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                {activeMainTab === 'BALANCES' 
                  ? 'متابعة دقيقة للأرصدة الدائنة والمدينة، إجمالي المسحوبات، إجمالي المدفوعات، ومطابقة الحسابات.'
                  : 'كشف تحليلي تفصيلي لحركات السندات المقيدة بحسابات العملاء والموردين، موضحاً حالة السند (مرحل/غير مرحل) وتاريخ الترحيل.'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {activeMainTab === 'BALANCES' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setShowReportPrintPreview(true);
                }}
                className="btn-3d btn-3d-blue flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold hover:scale-105 active:scale-95 transition-all"
                title="طباعة تقرير أرصدة العملاء والموردين"
              >
                <Printer size={15} />
                <span>طباعة التقرير</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCustomPreviewData(createOverallBalancesPreviewData());
                  setShowPrintPreview(true);
                }}
                className="btn-3d btn-3d-indigo flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold hover:scale-105 active:scale-95 transition-all"
                title="معاينة كشف الأرصدة والتقرير الشامل قبل الطباعة"
              >
                <Eye size={15} />
                <span>معاينة قبل الطباعة</span>
              </button>

              <PrintDropdown 
                onPreview={() => {
                  setCustomPreviewData(createOverallBalancesPreviewData());
                  setShowPrintPreview(true);
                }}
              />
              
              <ExportButtonGroup
                title="كشف أرصدة العملاء والموردين الشامل"
                filename="ارصدة_العملاء_والموردين"
                headers={[
                  'الكود',
                  'الاسم',
                  'النوع',
                  'الهاتف',
                  'الرقم الضريبي',
                  'إجمالي المسحوبات',
                  'إجمالي المدفوعات',
                  'حالة الرصيد',
                  'مبلغ الرصيد الصافي'
                ]}
                rows={sortedAndFilteredPartners.map(p => [
                  p.code,
                  p.name,
                  p.type === 'CUSTOMER' ? 'عميل' : 'مورد',
                  p.phone || '-',
                  p.taxNumber || '-',
                  p.totalWithdrawals,
                  p.totalPayments,
                  p.calc.balanceType === 'DEBIT' ? 'مدين (لنا)' : p.calc.balanceType === 'CREDIT' ? 'دائن (له)' : 'متزن',
                  p.calc.balanceAmount
                ])}
                size="sm"
              />

              <button
                type="button"
                onClick={handleResetData}
                className="btn-3d btn-3d-white flex items-center gap-1.5 px-3.5 py-2 text-slate-700 text-xs font-bold hover:scale-105 active:scale-95 transition-all"
                title="استعادة البيانات النموذجية الأولية"
              >
                <RefreshCw size={14} className="text-indigo-600" />
                <span>تحديث وتعيين</span>
              </button>

              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setViewMode('CARDS')}
                  className={`px-3 py-1.5 text-xs rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                    viewMode === 'CARDS' 
                      ? 'btn-3d btn-3d-blue text-white font-bold' 
                      : 'btn-3d btn-3d-white text-slate-600'
                  }`}
                >
                  عرض البطاقات
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('TABLE')}
                  className={`px-3 py-1.5 text-xs rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                    viewMode === 'TABLE' 
                      ? 'btn-3d btn-3d-blue text-white font-bold' 
                      : 'btn-3d btn-3d-white text-slate-600'
                  }`}
                >
                  الجدول الشامل
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setCustomPreviewData(createVouchersReportPreviewData());
                  setShowPrintPreview(true);
                }}
                className="btn-3d btn-3d-emerald flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold hover:scale-105 active:scale-95 transition-all"
                title="معاينة كشف حركة السندات والترحيل قبل الطباعة"
              >
                <Eye size={15} />
                <span>معاينة كشف السندات</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCustomPreviewData(createVouchersReportPreviewData());
                  setShowPrintPreview(true);
                }}
                className="btn-3d btn-3d-slate flex items-center gap-1.5 px-3.5 py-2 text-white text-xs font-bold hover:scale-105 active:scale-95 transition-all"
                title="طباعة التقرير"
              >
                <Printer size={15} />
                <span>طباعة التقرير</span>
              </button>

              <ExportButtonGroup
                title="كشف حركة السندات والترحيل المحاسبي"
                filename="كشف_حركة_السندات_المرحلة"
                headers={[
                  'رقم السند',
                  'نوع السند',
                  'تاريخ السند',
                  'اسم الطرف',
                  'نوع الطرف',
                  'الحساب / الخزينة',
                  'المبلغ',
                  'حالة السند',
                  'تاريخ ووقت الترحيل',
                  'البيان والشرح'
                ]}
                rows={filteredVouchers.map(v => {
                  const isPosted = (v.status || 'POSTED') === 'POSTED';
                  const typeLabel = v.type === VoucherType.Receipt ? 'سند قبض' : 'سند صرف';
                  const pType = v.partnerType || (v.type === VoucherType.Receipt ? 'CUSTOMER' : 'VENDOR');
                  const partnerTypeLabel = pType === 'CUSTOMER' ? 'عميل' : 'مورد';
                  const accountLabel = v.accountId === 'cash' ? 'الصندوق الرئيسي (نقداً)' : 'البنك الأهلي (تحويل بنكي)';
                  const statusLabel = isPosted ? 'مرحل بالحسابات' : 'مسودة (غير مرحل)';
                  const postingDateLabel = isPosted ? (v.postedAt ? formatPostingDateTime(v.postedAt) : `${v.date} (معتمد)`) : 'غير مرحل';

                  return [
                    v.voucherNumber,
                    typeLabel,
                    v.date,
                    v.partnerName,
                    partnerTypeLabel,
                    accountLabel,
                    v.amount,
                    statusLabel,
                    postingDateLabel,
                    v.description || ''
                  ];
                })}
                filterSummary={`إجمالي السندات: ${filteredVouchers.length} | المقبوضات: ${voucherStats.totalReceiptsPosted.toLocaleString()} | المدفوعات: ${voucherStats.totalPaymentsPosted.toLocaleString()}`}
                size="sm"
              />

              <button
                type="button"
                onClick={() => setShowExportModal(true)}
                className="btn-3d btn-3d-indigo flex items-center gap-1.5 px-3.5 py-2 text-white text-xs font-bold hover:scale-105 active:scale-95 transition-all"
                title="تصدير مخصص ومتقدم مع فلاتر زمنية"
              >
                <FileSpreadsheet size={15} />
                <span>تصدير مخصص</span>
              </button>

              <button
                type="button"
                onClick={reloadVouchers}
                className="btn-3d btn-3d-white flex items-center gap-1.5 px-3.5 py-2 text-slate-700 text-xs font-bold hover:scale-105 active:scale-95 transition-all"
                title="إعادة تحميل السندات من التخزين"
              >
                <RefreshCw size={14} className="text-emerald-600" />
                <span>تحديث السندات</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-6 border-b border-slate-200 pb-3 print:hidden overflow-x-auto no-scrollbar scroll-smooth py-1 -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex-wrap">
        <button
          type="button"
          onClick={() => setActiveMainTab('BALANCES')}
          className={`btn-3d flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 ${
            activeMainTab === 'BALANCES'
              ? 'btn-3d-indigo text-white'
              : 'btn-3d-white text-slate-700'
          }`}
        >
          <Scale size={16} className="shrink-0" />
          <span className="whitespace-nowrap">أرصدة العملاء والموردين</span>
          <span className="hidden md:inline text-xs opacity-80 whitespace-nowrap">(الكشف الشامل)</span>
          <span className={`text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full font-mono font-bold shrink-0 ${
            activeMainTab === 'BALANCES' ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {enrichedPartners.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('VOUCHERS_LEDGER')}
          className={`btn-3d flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 ${
            activeMainTab === 'VOUCHERS_LEDGER'
              ? 'btn-3d-success text-white'
              : 'btn-3d-white text-slate-700'
          }`}
        >
          <Receipt size={16} className={`shrink-0 ${activeMainTab === 'VOUCHERS_LEDGER' ? 'text-white' : 'text-emerald-600'}`} />
          <span className="whitespace-nowrap">حركة السندات والترحيل</span>
          <span className="hidden md:inline text-xs opacity-80 whitespace-nowrap">(قبض وصرف)</span>
          <span className={`text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 rounded-full font-mono font-bold shrink-0 ${
            activeMainTab === 'VOUCHERS_LEDGER' ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {voucherStats.countReceiptsPosted + voucherStats.countPaymentsPosted} <span className="hidden sm:inline">مرحل</span>
          </span>
          {voucherStats.countDraft > 0 && (
            <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-mono font-bold shrink-0 ${
              activeMainTab === 'VOUCHERS_LEDGER' ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-800'
            }`}>
              {voucherStats.countDraft} <span className="hidden sm:inline">مسودة</span>
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('AGING')}
          className={`btn-3d flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 ${
            activeMainTab === 'AGING'
              ? 'btn-3d-red text-white shadow-sm'
              : 'btn-3d-white text-rose-700 border-rose-200 hover:border-rose-300 hover:bg-rose-50/50'
          }`}
          title="تحليل أعمار الديون والذمم"
        >
          <Clock size={16} className={`shrink-0 ${activeMainTab === 'AGING' ? 'text-white' : 'text-rose-600'}`} />
          <span className="whitespace-nowrap">تحليل أعمار الديون والذمم</span>
          <span className={`text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 rounded-full font-mono font-bold shrink-0 ${
            activeMainTab === 'AGING' ? 'bg-rose-950/60 text-white' : 'bg-rose-100 text-rose-800'
          }`}>
            {debtorsSummary.count + creditorsSummary.count} <span className="hidden sm:inline">رصيد نشط</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'trialBalance' } }));
          }}
          className="btn-3d btn-3d-slate flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 sm:mr-auto"
          title="الانتقال إلى ميزان المراجعة لمطابقة حسابات ذمم العملاء (1201) وذمم الموردين (2101)"
        >
          <Scale size={15} className="text-blue-400 shrink-0" />
          <span className="whitespace-nowrap">ميزان المراجعة</span>
          <span className="hidden lg:inline whitespace-nowrap"> والمطابقة المحاسبية</span>
          <span className="text-xs">←</span>
        </button>
      </div>

      {activeMainTab === 'BALANCES' && (
        <>

      {/* 🌟 GRAND TOTALS PANEL: إجمالي مسحوبات الجميع وإجمالي مدفوعات الجميع والأرصدة الكلية 🌟 */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-xl mb-7 relative overflow-hidden border border-indigo-800/40">
        
        {/* Decorative ambient background accents */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="font-bold text-sm sm:text-base text-slate-100">
                الموقف المالي الإجمالي لكافة حسابات العملاء والموردين
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <span className="bg-white/10 px-3 py-1 rounded-full font-mono">
                إجمالي الحسابات المسجلة: <strong className="text-white">{grandTotals.totalPartners}</strong>
              </span>
              <span className="bg-white/10 px-3 py-1 rounded-full font-mono hidden md:inline">
                السنة المالية: {systemSettings.financial.fiscalYear}
              </span>
            </div>
          </div>

          {/* 6 Main Grand Metric Blocks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            
            {/* 1. إجمالي المبيعات */}
            <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-colors backdrop-blur-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-300 mb-2">
                <span className="text-xs font-semibold text-blue-200">إجمالي المبيعات</span>
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Receipt size={15} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
                {grandTotals.totalSalesInvoices.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                <span className="text-[10px] font-normal text-slate-400 mr-1.5">{currencySymbol}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                <span>مسحوبات العملاء</span>
              </div>
            </div>

            {/* 2. مقبوضات العملاء */}
            <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-colors backdrop-blur-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-300 mb-2">
                <span className="text-xs font-semibold text-emerald-200">مقبوضات العملاء</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Wallet size={15} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-300 tracking-tight">
                {grandTotals.totalCustomerReceipts.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                <span className="text-[10px] font-normal text-slate-400 mr-1.5">{currencySymbol}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                <span>سندات قبض واردة</span>
              </div>
            </div>

            {/* 3. إجمالي المشتريات */}
            <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-colors backdrop-blur-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-300 mb-2">
                <span className="text-xs font-semibold text-purple-200">إجمالي المشتريات</span>
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Receipt size={15} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-purple-100 tracking-tight">
                {grandTotals.totalPurchaseInvoices.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                <span className="text-[10px] font-normal text-slate-400 mr-1.5">{currencySymbol}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                <span>مسحوبات الموردين</span>
              </div>
            </div>

            {/* 4. مدفوعات الموردين */}
            <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-colors backdrop-blur-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-300 mb-2">
                <span className="text-xs font-semibold text-orange-200">مدفوعات الموردين</span>
                <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
                  <Wallet size={15} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-orange-300 tracking-tight">
                {grandTotals.totalVendorPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                <span className="text-[10px] font-normal text-slate-400 mr-1.5">{currencySymbol}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                <span>سندات صرف مسددة</span>
              </div>
            </div>

            {/* 5. إجمالي أرصدة المدينين (مستحقات لنا) */}
            <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-colors backdrop-blur-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-300 mb-2">
                <span className="text-xs font-semibold text-cyan-200">أرصدة مدينين (لنا)</span>
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <ArrowUpRight size={15} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-cyan-300 tracking-tight">
                {grandTotals.totalDebitSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                <span className="text-[10px] font-normal text-slate-400 mr-1.5">{currencySymbol}</span>
              </div>
              <div className="text-[10px] text-cyan-200/70 mt-2 flex items-center justify-between">
                <span>مستحقات لنا</span>
                <span className="font-mono bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded text-[10px]">
                  {grandTotals.debtorCount} حساب
                </span>
              </div>
            </div>

            {/* 6. إجمالي أرصدة الدائنين (التزامات علينا) */}
            <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-colors backdrop-blur-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-300 mb-2">
                <span className="text-xs font-semibold text-amber-200">أرصدة دائنين (علينا)</span>
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <ArrowDownLeft size={15} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-amber-300 tracking-tight">
                {grandTotals.totalCreditSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                <span className="text-[10px] font-normal text-slate-400 mr-1.5">{currencySymbol}</span>
              </div>
              <div className="text-[10px] text-amber-200/70 mt-2 flex items-center justify-between">
                <span>التزامات للموردين وأرصدة مقدمة</span>
                <span className="font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded text-[10px]">
                  {grandTotals.creditorCount} حساب
                </span>
              </div>
            </div>

          </div>

          {/* Sub-footer inside Grand Banner: Net Balance Status */}
          <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">صافي الموقف المالي للذمم:</span>
              <span className={`font-mono font-bold text-sm ${grandTotals.netOverallPosition >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {Math.abs(grandTotals.netOverallPosition).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                <span className="text-xs font-medium mr-1">
                  ({grandTotals.netOverallPosition >= 0 ? 'فائض مستحقات لصالح المنشأة' : 'عجز - الالتزامات تفوق المستحقات'})
                </span>
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span>معدل التغطية والتحصيل: 
                <strong className="text-emerald-400 font-mono mr-1">
                  {grandTotals.grandWithdrawals > 0 
                    ? Math.round((grandTotals.grandPayments / grandTotals.grandWithdrawals) * 100) 
                    : 100}%
                </strong>
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-6 flex flex-col md:flex-row gap-3 md:items-center justify-between">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            type="text"
            placeholder="بحث سريع بالاسم، الكود، رقم الهاتف، أو الرقم الضريبي..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              مسح
            </button>
          )}
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Partner Type Filter */}
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setPartnerTypeFilter('ALL')}
              className={`px-2.5 py-1 text-xs rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                partnerTypeFilter === 'ALL' ? 'btn-3d btn-3d-blue text-white font-bold' : 'btn-3d btn-3d-white text-slate-600'
              }`}
            >
              الجميع
            </button>
            <button
              type="button"
              onClick={() => setPartnerTypeFilter('CUSTOMER')}
              className={`px-2.5 py-1 text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1 hover:scale-105 active:scale-95 ${
                partnerTypeFilter === 'CUSTOMER' ? 'btn-3d btn-3d-blue text-white font-bold' : 'btn-3d btn-3d-white text-slate-600'
              }`}
            >
              <Users size={12} /> العملاء فقط
            </button>
            <button
              type="button"
              onClick={() => setPartnerTypeFilter('VENDOR')}
              className={`px-2.5 py-1 text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1 hover:scale-105 active:scale-95 ${
                partnerTypeFilter === 'VENDOR' ? 'btn-3d btn-3d-purple text-white font-bold' : 'btn-3d btn-3d-white text-slate-600'
              }`}
            >
              <Truck size={12} /> الموردون فقط
            </button>
          </div>

          {/* Balance Status Filter */}
          <select
            value={balanceFilter}
            onChange={e => setBalanceFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-3 py-2 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="ALL">جميع الحالات (مدين ودائن)</option>
            <option value="DEBIT">المدينون فقط (لنا عندهم)</option>
            <option value="CREDIT">الدائنون فقط (لهم عندنا)</option>
            <option value="ZERO">الحسابات المصفّرة (رصيد صفر)</option>
            <option value="OVER_LIMIT">⚠️ المتجاوزون للحد الائتماني فقط</option>
          </select>

        </div>
      </div>

      {/* 🎴 THE TWO CORE CARDS (CARDS VIEW): 
          1. بطاقة أرصدة العملاء والموردين الدائنين
          2. بطاقة أرصدة العملاء والموردين المدينين 
      */}
      {viewMode === 'CARDS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          
          {/* ============================================================ */}
          {/* 🔴 CARD 1: بطاقة أرصدة العملاء والموردين الدائنين (CREDITORS) */}
          {/* ============================================================ */}
          <div 
            onClick={() => setShowCreditorsModal(true)}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md cursor-pointer hover:border-amber-300"
          >
            
            {/* Card Header */}
            <div className="p-5 bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50/50 border-b border-amber-200/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                  <ArrowDownLeft size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">بطاقة أرصدة العملاء والموردين الدائنين</h3>
                    <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-amber-300 font-mono">
                      {creditorsSummary.count} حساب دائن
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    الأطراف التي لها التزامات ومستحقات على المنشأة (موردون أو دفعات مقدمة لعملاء)
                  </p>
                </div>
              </div>
            </div>

            {/* Card Sub-Metrics: إجمالي مسحوباتهم، إجمالي مدفوعاتهم، صافي الرصيد الدائن */}
            <div className="grid grid-cols-3 p-4 bg-slate-50/70 border-b border-slate-200 divide-x divide-x-reverse divide-slate-200 text-center">
              <div className="px-2">
                <span className="text-[11px] text-slate-500 font-medium block">إجمالي مسحوباتهم</span>
                <span className="text-sm sm:text-base font-bold font-mono text-slate-800 mt-0.5 block">
                  {creditorsSummary.withdrawals.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-400">توريدات وفواتير</span>
              </div>
              <div className="px-2">
                <span className="text-[11px] text-slate-500 font-medium block">إجمالي مدفوعاتهم</span>
                <span className="text-sm sm:text-base font-bold font-mono text-emerald-600 mt-0.5 block">
                  {creditorsSummary.payments.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-400">مبالغ مسددة</span>
              </div>
              <div className="px-2">
                <span className="text-[11px] text-amber-700 font-bold block">صافي الرصيد الدائن</span>
                <span className="text-sm sm:text-base font-bold font-mono text-amber-600 mt-0.5 block">
                  {creditorsSummary.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-amber-700 font-semibold">{currencySymbol} مستحق لهم</span>
              </div>
            </div>

            <div className="p-6 flex justify-center items-center flex-1 bg-white">
               <button 
                 onClick={() => setShowCreditorsModal(true)}
                 className="px-6 py-2.5 bg-amber-50 text-amber-700 font-bold rounded-xl border border-amber-200 hover:bg-amber-100 hover:text-amber-800 transition-colors flex items-center gap-2 w-full justify-center sm:w-auto"
               >
                 <Eye size={18} />
                 عرض قائمة الحسابات الدائنة ({creditorsSummary.count})
               </button>
            </div>

            {/* Card Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <ShieldCheck size={14} className="text-amber-600" />
                يتطلب جدولة سداد الالتزامات لتفادي غرامات التأخير
              </span>
              <span className="font-mono font-bold text-slate-700">
                المجموع: {creditorsSummary.totalCredit.toLocaleString()} {currencySymbol}
              </span>
            </div>

          </div>

          {/* ============================================================ */}
          {/* 🟢 CARD 2: بطاقة أرصدة العملاء والموردين المدينين (DEBTORS)   */}
          {/* ============================================================ */}
          <div 
            onClick={() => setShowDebtorsModal(true)}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md cursor-pointer hover:border-emerald-300"
          >
            
            {/* Card Header */}
            <div className="p-5 bg-gradient-to-r from-emerald-500/10 via-emerald-50 to-teal-50/50 border-b border-emerald-200/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <ArrowUpRight size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">بطاقة أرصدة العملاء والموردين المدينين</h3>
                    <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-300 font-mono">
                      {debtorsSummary.count} حساب مدين
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    الأطراف التي عليها مبالغ ومستحقات واجبة التحصيل للمنشأة (عملاء أو دفعات مقدمة لموردين)
                  </p>
                </div>
              </div>
            </div>

            {/* Card Sub-Metrics: إجمالي مسحوباتهم، إجمالي مدفوعاتهم، صافي الرصيد المدين */}
            <div className="grid grid-cols-3 p-4 bg-slate-50/70 border-b border-slate-200 divide-x divide-x-reverse divide-slate-200 text-center">
              <div className="px-2">
                <span className="text-[11px] text-slate-500 font-medium block">إجمالي مسحوباتهم</span>
                <span className="text-sm sm:text-base font-bold font-mono text-slate-800 mt-0.5 block">
                  {debtorsSummary.withdrawals.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-400">فواتير مبيعات</span>
              </div>

              <div className="px-2">
                <span className="text-[11px] text-slate-500 font-medium block">إجمالي مدفوعاتهم</span>
                <span className="text-sm sm:text-base font-bold font-mono text-emerald-600 mt-0.5 block">
                  {debtorsSummary.payments.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-400">سدادات مقبوضة</span>
              </div>

              <div className="px-2">
                <span className="text-[11px] text-emerald-700 font-bold block">صافي الرصيد المدين</span>
                <span className="text-sm sm:text-base font-bold font-mono text-emerald-600 mt-0.5 block">
                  {debtorsSummary.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold">{currencySymbol} مستحق لنا</span>
              </div>
            </div>

            {/* Debtors List Table */}
            <div className="p-6 flex justify-center items-center flex-1 bg-white">
               <button 
                 onClick={() => setShowDebtorsModal(true)}
                 className="px-6 py-2.5 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 transition-colors flex items-center gap-2 w-full justify-center sm:w-auto"
               >
                 <Eye size={18} />
                 عرض قائمة الحسابات المدينة ({debtorsSummary.count})
               </button>
            </div>

            {/* Card Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <CheckCircle2 size={14} className="text-emerald-600" />
                مستحقات واجبة المتابعة والتحصيل الفوري
              </span>
              <span className="font-mono font-bold text-slate-700">
                المجموع: {debtorsSummary.totalDebit.toLocaleString()} {currencySymbol}
              </span>
            </div>

          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* 📊 TABLE VIEW: جدول الأرصدة الشامل لكافة العملاء والموردين    */}
      {/* ============================================================ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText size={17} className="text-indigo-600" />
            <h4 className="font-bold text-slate-800 text-sm">
              جدول أرصدة ومسحوبات ومدفوعات العملاء والموردين التفصيلي
            </h4>
            <span className="text-xs bg-slate-200/80 px-2 py-0.5 rounded-full font-mono text-slate-600">
              {filteredPartners.length} سجل
            </span>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> مدين (لنا)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> دائن (له)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> مصفّر (0)
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                <th className="p-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('code')}
                    className="inline-flex items-center gap-1 font-bold text-slate-700 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    <span>كود الحساب</span>
                    {sortField === 'code' ? (
                      sortDirection === 'asc' ? <ArrowUp size={13} className="text-indigo-600" /> : <ArrowDown size={13} className="text-indigo-600" />
                    ) : (
                      <ArrowUpDown size={12} className="text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="p-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className="inline-flex items-center gap-1 font-bold text-slate-700 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    <span>الاسم التجاري / الشركة</span>
                    {sortField === 'name' ? (
                      sortDirection === 'asc' ? <ArrowUp size={13} className="text-indigo-600" /> : <ArrowDown size={13} className="text-indigo-600" />
                    ) : (
                      <ArrowUpDown size={12} className="text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="p-3 text-center">
                  <button
                    type="button"
                    onClick={() => handleSort('type')}
                    className="inline-flex items-center gap-1 font-bold text-slate-700 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    <span>النوع</span>
                    {sortField === 'type' ? (
                      sortDirection === 'asc' ? <ArrowUp size={13} className="text-indigo-600" /> : <ArrowDown size={13} className="text-indigo-600" />
                    ) : (
                      <ArrowUpDown size={12} className="text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="p-3 text-left font-mono">
                  <button
                    type="button"
                    onClick={() => handleSort('opening')}
                    className="inline-flex items-center gap-1 font-bold text-slate-700 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    <span>الرصيد الافتتاحي</span>
                    {sortField === 'opening' ? (
                      sortDirection === 'asc' ? <ArrowUp size={13} className="text-indigo-600" /> : <ArrowDown size={13} className="text-indigo-600" />
                    ) : (
                      <ArrowUpDown size={12} className="text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="p-3 text-left font-mono text-blue-700 font-bold">
                  <button
                    type="button"
                    onClick={() => handleSort('withdrawals')}
                    className="inline-flex items-center gap-1 font-bold text-blue-700 hover:text-blue-900 transition-colors cursor-pointer"
                  >
                    <span>إجمالي المسحوبات</span>
                    {sortField === 'withdrawals' ? (
                      sortDirection === 'asc' ? <ArrowUp size={13} className="text-blue-600" /> : <ArrowDown size={13} className="text-blue-600" />
                    ) : (
                      <ArrowUpDown size={12} className="text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="p-3 text-left font-mono text-emerald-700 font-bold">
                  <button
                    type="button"
                    onClick={() => handleSort('payments')}
                    className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-900 transition-colors cursor-pointer"
                  >
                    <span>إجمالي المدفوعات</span>
                    {sortField === 'payments' ? (
                      sortDirection === 'asc' ? <ArrowUp size={13} className="text-emerald-600" /> : <ArrowDown size={13} className="text-emerald-600" />
                    ) : (
                      <ArrowUpDown size={12} className="text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="p-3 text-center">
                  <button
                    type="button"
                    onClick={() => handleSort('ratio')}
                    className="inline-flex items-center gap-1 font-bold text-slate-700 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    <span>نسبة السداد</span>
                    {sortField === 'ratio' ? (
                      sortDirection === 'asc' ? <ArrowUp size={13} className="text-indigo-600" /> : <ArrowDown size={13} className="text-indigo-600" />
                    ) : (
                      <ArrowUpDown size={12} className="text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="p-3 text-left font-mono text-slate-900 font-bold">
                  <button
                    type="button"
                    onClick={() => handleSort('balance')}
                    className="inline-flex items-center gap-1 font-bold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    <span>الرصيد الصافي الحالي</span>
                    {sortField === 'balance' ? (
                      sortDirection === 'asc' ? <ArrowUp size={13} className="text-indigo-600" /> : <ArrowDown size={13} className="text-indigo-600" />
                    ) : (
                      <ArrowUpDown size={12} className="text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="p-3 text-center">
                  <button
                    type="button"
                    onClick={() => handleSort('status')}
                    className="inline-flex items-center gap-1 font-bold text-slate-700 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    <span>الحالة</span>
                    {sortField === 'status' ? (
                      sortDirection === 'asc' ? <ArrowUp size={13} className="text-indigo-600" /> : <ArrowDown size={13} className="text-indigo-600" />
                    ) : (
                      <ArrowUpDown size={12} className="text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="p-3 text-center print:hidden">إجراءات المتابعة والعمليات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedAndFilteredPartners.map(p => {
                const isDebit = p.calc.balanceType === 'DEBIT';
                const isCredit = p.calc.balanceType === 'CREDIT';
                return (
                  <tr 
                    key={p.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="p-3.5 font-mono text-slate-500 font-semibold">{p.code}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span>{p.name}</span>
                        {p.calc.isOverCreditLimit && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-black bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded border border-rose-200">
                            <AlertTriangle size={10} /> تجاوز الحد
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        {p.phone && (
                          <span className="flex items-center gap-1 font-mono">
                            <span>هاتف:</span>
                            <span dir="ltr">{p.phone}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(p.id, p.phone!)}
                              className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                              title="نسخ رقم الهاتف"
                            >
                              {phoneCopiedId === p.id ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                            </button>
                          </span>
                        )}
                        {p.taxNumber && <span>ضريبي: <span className="font-mono">{p.taxNumber}</span></span>}
                      </div>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.type === 'CUSTOMER' 
                          ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}>
                        {p.type === 'CUSTOMER' ? <Users size={11} /> : <Truck size={11} />}
                        {p.type === 'CUSTOMER' ? 'عميل' : 'مورد'}
                      </span>
                    </td>
                    <td className="p-3.5 text-left font-mono text-slate-600">
                      {Math.abs(p.openingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      <span className="text-[10px] text-slate-400 mr-1">
                        {p.openingBalance > 0 ? '(مدين)' : p.openingBalance < 0 ? '(دائن)' : ''}
                      </span>
                    </td>
                    <td className="p-3.5 text-left font-mono font-bold text-blue-700">
                      {p.totalWithdrawals.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 text-left font-mono font-bold text-emerald-700">
                      {p.totalPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              p.calc.paymentRatio >= 90 ? 'bg-emerald-500' : p.calc.paymentRatio >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, p.calc.paymentRatio)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-slate-600 font-bold">{p.calc.paymentRatio}%</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-left font-mono font-bold text-sm">
                      <span className={isDebit ? 'text-emerald-600' : isCredit ? 'text-amber-600' : 'text-slate-500'}>
                        {p.calc.balanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] font-normal text-slate-400 mr-1">{currencySymbol}</span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isDebit 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : isCredit 
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {isDebit ? 'مدين (لنا)' : isCredit ? 'دائن (له)' : 'متزن'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center print:hidden whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        
                        {/* Quick Receipt (if Debit) or Quick Payment (if Credit) */}
                        {isDebit && p.calc.balanceAmount > 0.01 ? (
                          <button
                            type="button"
                            onClick={() => handleQuickVoucher(p, 'RECEIPT')}
                            className="btn-3d btn-3d-success-soft px-2 py-1 text-[11px] font-black flex items-center gap-0.5 hover:scale-105 active:scale-95 transition-all"
                            title="تحصيل وقبض فوري لحساب هذا الطرف"
                          >
                            <ArrowDownLeft size={12} /> قبض
                          </button>
                        ) : isCredit && p.calc.balanceAmount > 0.01 ? (
                          <button
                            type="button"
                            onClick={() => handleQuickVoucher(p, 'PAYMENT')}
                            className="btn-3d btn-3d-warning-soft px-2 py-1 text-[11px] font-black flex items-center gap-0.5 hover:scale-105 active:scale-95 transition-all"
                            title="سداد وصرف فوري لحساب هذا الطرف"
                          >
                            <ArrowUpRight size={12} /> صرف
                          </button>
                        ) : null}

                        {/* WhatsApp Balance Notification */}
                        {p.phone && (
                          <button
                            type="button"
                            onClick={() => handleSendWhatsAppNotice(p)}
                            className="btn-3d btn-3d-white p-1 text-emerald-600 hover:text-emerald-700 hover:scale-105 active:scale-95 transition-all"
                            title="إرسال إشعار رصيد عبر واتساب"
                          >
                            <MessageSquare size={13} />
                          </button>
                        )}

                        {/* Balance Confirmation Letter */}
                        <button
                          type="button"
                          onClick={() => setSelectedPartnerForConfirmation(p)}
                          className="btn-3d btn-3d-white p-1 text-indigo-600 hover:text-indigo-800 hover:scale-105 active:scale-95 transition-all"
                          title="إصدار خطاب مصادقة وتأكيد رصيد رسمي"
                        >
                          <FileCheck size={13} />
                        </button>

                        {/* Detailed Statement View */}
                        <button
                          type="button"
                          onClick={() => setSelectedPartnerForStatement(p)}
                          className="btn-3d btn-3d-blue px-2.5 py-1 text-xs font-bold flex items-center gap-1 hover:scale-105 active:scale-95 transition-all"
                          title="عرض كشف الحساب التفصيلي"
                        >
                          <Eye size={12} /> كشف
                        </button>

                      </div>
                    </td>
                  </tr>
                );
              })}

              {sortedAndFilteredPartners.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 text-sm">
                    لا توجد بيانات مطابقة لمعايير البحث.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
              <tr>
                <td colSpan={4} className="p-3.5 text-right font-bold text-sm">
                  المجموع الكلي ({sortedAndFilteredPartners.length} طرف تعامل):
                </td>
                <td className="p-3.5 text-left font-mono text-blue-700 text-sm">
                  {sortedAndFilteredPartners.reduce((acc, p) => acc + p.totalWithdrawals, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="p-3.5 text-left font-mono text-emerald-700 text-sm">
                  {sortedAndFilteredPartners.reduce((acc, p) => acc + p.totalPayments, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td></td>
                <td className="p-3.5 text-left font-mono text-slate-900 text-sm">
                  {sortedAndFilteredPartners.reduce((acc, p) => acc + p.calc.balanceAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>
      </>
      )}

      {/* ============================================================ */}
      {/* 🌟 NEW REPORT: كشف حركة السندات التفصيلي وحالة الترحيل         */}
      {/* ============================================================ */}
      {activeMainTab === 'VOUCHERS_LEDGER' && (
        <div className="flex flex-col gap-6">

          {/* 1. Summary Cards for Vouchers Movement */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Total Posted Receipts */}
            <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">إجمالي سندات القبض المرحلة</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ArrowDownLeft size={18} />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-emerald-700">
                  {voucherStats.totalReceiptsPosted.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  <span className="text-xs font-normal text-slate-400 mr-1.5">{currencySymbol}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>عدد السندات المعتمدة:</span>
                  <span className="font-bold font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                    {voucherStats.countReceiptsPosted} سند
                  </span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span>مبالغ مقبوضة خفضت مديونيات العملاء</span>
              </div>
            </div>

            {/* Total Posted Payments */}
            <div className="bg-white rounded-2xl border border-rose-100 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">إجمالي سندات الصرف المرحلة</span>
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <ArrowUpRight size={18} />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-rose-700">
                  {voucherStats.totalPaymentsPosted.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  <span className="text-xs font-normal text-slate-400 mr-1.5">{currencySymbol}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>عدد السندات المعتمدة:</span>
                  <span className="font-bold font-mono bg-rose-50 text-rose-700 px-2 py-0.5 rounded">
                    {voucherStats.countPaymentsPosted} سند
                  </span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-1">
                <CheckCircle2 size={12} className="text-rose-500" />
                <span>مدفوعات خفضت مستحقات الموردين</span>
              </div>
            </div>

            {/* Net Cash Flow from Posted Vouchers */}
            <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">صافي التدفق النقدي المرحل</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Wallet size={18} />
                </div>
              </div>
              <div>
                <div className={`text-2xl font-bold font-mono ${voucherStats.netCashFlowPosted >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                  {Math.abs(voucherStats.netCashFlowPosted).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  <span className="text-xs font-normal text-slate-400 mr-1.5">{currencySymbol}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>طبيعة التدفق:</span>
                  <span className={`font-bold px-2 py-0.5 rounded ${
                    voucherStats.netCashFlowPosted >= 0 ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {voucherStats.netCashFlowPosted >= 0 ? 'فائض نقدي مقبوض' : 'صافي تدفق منصرف'}
                  </span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-1">
                <Scale size={12} className="text-blue-500" />
                <span>الفارق = المقبوضات المرحلة - المدفوعات المرحلة</span>
              </div>
            </div>

            {/* Pending / Draft Vouchers */}
            <div className="bg-white rounded-2xl border border-amber-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">سندات غير مرحلة (مسودات)</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock size={18} />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-amber-700">
                  {voucherStats.totalDraftAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  <span className="text-xs font-normal text-slate-400 mr-1.5">{currencySymbol}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>سندات قيد الانتظار:</span>
                  <span className="font-bold font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                    {voucherStats.countDraft} مسودة
                  </span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-amber-100 text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                <AlertTriangle size={12} className="text-amber-500" />
                <span>غير مؤثرة محاسبياً حتى يتم ترحيلها</span>
              </div>
            </div>

          </div>

          {/* 2. Filters & Search Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative w-full lg:w-80">
              <input
                type="text"
                value={voucherSearchQuery}
                onChange={e => setVoucherSearchQuery(e.target.value)}
                placeholder="بحث برقم السند، الطرف، البيان..."
                className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
              />
              <Search className="absolute right-3 top-2.5 text-slate-400" size={15} />
              {voucherSearchQuery && (
                <button
                  type="button"
                  onClick={() => setVoucherSearchQuery('')}
                  className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              
              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-semibold">الحالة:</span>
                <select
                  value={voucherStatusFilter}
                  onChange={e => setVoucherStatusFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="ALL">كافة السندات ({vouchersList.length})</option>
                  <option value="POSTED">المرحلة بالحسابات فقط ({voucherStats.countReceiptsPosted + voucherStats.countPaymentsPosted})</option>
                  <option value="DRAFT">غير المرحلة - مسودات ({voucherStats.countDraft})</option>
                </select>
              </div>

              {/* Voucher Type Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-semibold">نوع السند:</span>
                <select
                  value={voucherTypeFilter}
                  onChange={e => setVoucherTypeFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="ALL">الكل (قبض وصرف)</option>
                  <option value="RECEIPT">سندات قبض</option>
                  <option value="PAYMENT">سندات صرف</option>
                </select>
              </div>

              {/* Partner Type Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-semibold">الطرف:</span>
                <select
                  value={voucherPartnerTypeFilter}
                  onChange={e => setVoucherPartnerTypeFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="ALL">كافة الأطراف</option>
                  <option value="CUSTOMER">العملاء</option>
                  <option value="VENDOR">الموردين</option>
                </select>
              </div>

              {/* Date Filters */}
              <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 text-xs">
                <Calendar size={13} className="text-slate-400" />
                <input
                  type="date"
                  value={voucherDateFrom}
                  onChange={e => setVoucherDateFrom(e.target.value)}
                  className="bg-transparent text-slate-700 focus:outline-hidden text-xs"
                  title="من تاريخ"
                />
                <span className="text-slate-400">إلى</span>
                <input
                  type="date"
                  value={voucherDateTo}
                  onChange={e => setVoucherDateTo(e.target.value)}
                  className="bg-transparent text-slate-700 focus:outline-hidden text-xs"
                  title="إلى تاريخ"
                />
                {(voucherDateFrom || voucherDateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setVoucherDateFrom('');
                      setVoucherDateTo('');
                    }}
                    className="text-slate-400 hover:text-slate-600 mr-1"
                    title="مسح التاريخ"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

            </div>

          </div>

          {/* 3. Detailed Vouchers Movement Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Receipt size={17} className="text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-800">
                  كشف حركة تفصيلي لكل سند (قبض أو صرف) وحالة الترحيل وتاريخه
                </h3>
                <span className="text-xs bg-slate-200 text-slate-700 font-mono px-2 py-0.5 rounded-full font-bold">
                  {filteredVouchers.length} سند
                </span>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <CheckCircle2 size={12} /> مرحل بالحسابات
                </span>
                <span className="inline-flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <AlertTriangle size={12} /> مسودة معلقة
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3.5 text-right whitespace-nowrap"># رقم السند</th>
                    <th className="p-3.5 text-right whitespace-nowrap">تاريخ التحرير</th>
                    <th className="p-3.5 text-right whitespace-nowrap">الطرف (العميل / المورد)</th>
                    <th className="p-3.5 text-right whitespace-nowrap">نوع الحركة والخزينة</th>
                    <th className="p-3.5 text-left font-mono whitespace-nowrap">المبلغ</th>
                    <th className="p-3.5 text-center whitespace-nowrap">حالة السند</th>
                    <th className="p-3.5 text-center whitespace-nowrap">تاريخ ووقت الترحيل</th>
                    <th className="p-3.5 text-right min-w-[180px]">البيان والشرح المحاسبي</th>
                    <th className="p-3.5 text-center whitespace-nowrap">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVouchers.map(v => {
                    const isReceipt = v.type === VoucherType.Receipt;
                    const isPosted = (v.status || 'POSTED') === 'POSTED';
                    const pType = v.partnerType || (isReceipt ? 'CUSTOMER' : 'VENDOR');

                    return (
                      <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                        
                        {/* 1. Voucher Number & Type Badge */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                              isReceipt 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-rose-100 text-rose-800'
                            }`} title={isReceipt ? 'سند قبض' : 'سند صرف'}>
                              {isReceipt ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                            </span>
                            <div>
                              <span className="font-mono font-bold text-slate-900 block">{v.voucherNumber}</span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {isReceipt ? 'سند قبض' : 'سند صرف'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Date */}
                        <td className="p-3.5 whitespace-nowrap font-mono text-slate-600">
                          {v.date}
                        </td>

                        {/* 3. Partner Name & Type */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800">{v.partnerName}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              pType === 'CUSTOMER' 
                                ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                                : 'bg-purple-50 text-purple-700 border border-purple-100'
                            }`}>
                              {pType === 'CUSTOMER' ? 'عميل' : 'مورد'}
                            </span>
                          </div>
                        </td>

                        {/* 4. Movement Type & Treasury */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="text-slate-600">
                            {isReceipt ? (
                              <span className="text-emerald-700 font-medium">قبض من عميل</span>
                            ) : (
                              <span className="text-rose-700 font-medium">سداد لمورد</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {v.accountId === 'cash' ? 'الصندوق الرئيسي (نقداً)' : 'البنك الأهلي (تحويل بنكي)'}
                          </div>
                        </td>

                        {/* 5. Amount */}
                        <td className="p-3.5 text-left font-mono font-bold whitespace-nowrap">
                          <span className={`text-sm ${isReceipt ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {v.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-slate-400 mr-1">{currencySymbol}</span>
                        </td>

                        {/* 6. Voucher Status (مرحل / غير مرحل) */}
                        <td className="p-3.5 text-center whitespace-nowrap">
                          {isPosted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100/80 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 size={13} className="text-emerald-600" />
                              <span>مرحل بالحسابات</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100/90 text-amber-800 border border-amber-300">
                              <AlertTriangle size={13} className="text-amber-600" />
                              <span>مسودة (غير مرحل)</span>
                            </span>
                          )}
                        </td>

                        {/* 7. Posting Date (تاريخ ووقت الترحيل) */}
                        <td className="p-3.5 text-center whitespace-nowrap">
                          {isPosted ? (
                            <div className="flex flex-col items-center">
                              <div className="flex items-center gap-1 font-mono text-slate-700 font-semibold text-[11px]">
                                <Clock size={12} className="text-emerald-600" />
                                <span>{v.postedAt ? formatPostingDateTime(v.postedAt) : `${v.date} (معتمد)`}</span>
                              </div>
                              <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded mt-0.5">
                                مقيد بالحسابات
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">
                              غير مرحل (معلق)
                            </span>
                          )}
                        </td>

                        {/* 8. Description */}
                        <td className="p-3.5 text-slate-600 max-w-xs truncate" title={v.description || ''}>
                          {v.description || '-'}
                        </td>

                        {/* 9. Action Buttons */}
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            
                            {/* Open Statement */}
                            <button
                              type="button"
                              onClick={() => handleOpenPartnerStatementFromVoucher(v)}
                              className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer border border-slate-200"
                              title="عرض كشف حساب هذا الطرف ومطابقة السند"
                            >
                              <FileText size={13} />
                              <span className="hidden sm:inline">كشف حساب</span>
                            </button>

                            {/* Toggle Posting Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleVoucherPosting(v)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-colors flex items-center gap-1 cursor-pointer shadow-2xs ${
                                isPosted 
                                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300' 
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                              title={isPosted ? 'إلغاء ترحيل السند فوراً وإعادته كمسودة (إيقاف الأثر المحاسبي)' : 'ترحيل السند واعتماده في كشف الحساب'}
                            >
                              {isPosted ? (
                                <>
                                  <RotateCcw size={12} className="text-amber-700" />
                                  <span>إلغاء الترحيل</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 size={12} />
                                  <span>ترحيل الآن</span>
                                </>
                              )}
                            </button>

                            {/* Print Voucher Receipt */}
                            <button
                              type="button"
                              onClick={() => handlePrintSingleVoucher(v)}
                              className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer border border-slate-200"
                              title="معاينة وطباعة السند"
                            >
                              <Printer size={13} />
                            </button>

                          </div>
                        </td>

                      </tr>
                    );
                  })}

                  {filteredVouchers.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-400">
                        <Receipt size={32} className="mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-sm text-slate-600">لا توجد سندات مطابقة لمعايير البحث</p>
                        <p className="text-xs text-slate-400 mt-1">جرّب تغيير فلاتر الحالة أو نوع السند أو مسح حقل البحث</p>
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-100/80 border-t-2 border-slate-300 font-bold text-slate-900">
                  <tr>
                    <td colSpan={4} className="p-3.5 text-right font-bold text-sm">
                      إجمالي السندات المعروضة ({filteredVouchers.length} سند):
                    </td>
                    <td className="p-3.5 text-left font-mono text-emerald-800 text-sm">
                      {filteredVouchers.reduce((acc, v) => acc + v.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                    </td>
                    <td colSpan={4} className="p-3.5 text-left text-xs text-slate-500">
                      مقبوضات مرحلة: <strong className="text-emerald-700 font-mono">{filteredVouchers.filter(v => v.type === VoucherType.Receipt && (v.status || 'POSTED') === 'POSTED').reduce((acc, v) => acc + v.amount, 0).toLocaleString()} {currencySymbol}</strong> | 
                      مدفوعات مرحلة: <strong className="text-rose-700 font-mono mr-1">{filteredVouchers.filter(v => v.type === VoucherType.Payment && (v.status || 'POSTED') === 'POSTED').reduce((acc, v) => acc + v.amount, 0).toLocaleString()} {currencySymbol}</strong>
                    </td>
                  </tr>
                </tfoot>
                            </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ⏳ TAB 3: تقرير أعمار الديون والذمم (AGING SCHEDULE REPORT)   */}
      {/* ============================================================ */}
      {activeMainTab === 'AGING' && (
        <PartnerAgingReport
          partners={enrichedPartners}
          currencySymbol={currencySymbol}
          onOpenStatement={(partner) => setSelectedPartnerForStatement(partner)}
          onOpenConfirmation={(partner) => setSelectedPartnerForConfirmation(partner)}
          onQuickVoucher={(partner, type) => handleQuickVoucher(partner, type)}
        />
      )}

      {/* ============================================================ */}
      {/* 📄 MODAL: قائمة الحسابات الدائنة                                */}
      {/* ============================================================ */}
      {showCreditorsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-amber-500 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center border border-white/30">
                  <ArrowDownLeft size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">قائمة أرصدة العملاء والموردين الدائنين</h3>
                  <p className="text-amber-100 text-sm opacity-90 font-medium mt-0.5">
                    إجمالي {creditorsSummary.count} حساب بقيمة {creditorsSummary.totalCredit.toLocaleString()} {currencySymbol}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreditorsModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-600/50 hover:bg-red-500 hover:text-white transition-colors"
                title="إغلاق النافذة"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4">
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 shadow-sm">
                {creditorsList.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    لا توجد حسابات دائنة مطابقة للشروط الحالية.
                  </div>
                ) : (
                  creditorsList.map(item => (
                    <div 
                      key={item.id}
                      className="p-4 hover:bg-amber-50/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm ${
                          item.type === 'CUSTOMER' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {item.type === 'CUSTOMER' ? <Users size={18} /> : <Truck size={18} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-base">{item.name}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              item.type === 'CUSTOMER' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}>
                              {item.type === 'CUSTOMER' ? 'عميل (دفعة مقدمة)' : 'مورد'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{item.code}</span>
                            {item.phone && <span className="flex items-center gap-1"><span className="w-1 h-1 bg-slate-300 rounded-full"></span>{item.phone}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Financial details per creditor */}
                      <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto mt-2 sm:mt-0">
                        <div className="flex flex-col text-left gap-1">
                          <div className="flex justify-between items-center sm:justify-start gap-2">
                            <span className="text-[10px] text-slate-500">المسحوبات:</span>
                            <strong className="font-mono text-slate-700 text-xs">{item.totalWithdrawals.toLocaleString()}</strong>
                          </div>
                          <div className="flex justify-between items-center sm:justify-start gap-2">
                            <span className="text-[10px] text-slate-500">المدفوعات:</span>
                            <strong className="font-mono text-emerald-600 text-xs">{item.totalPayments.toLocaleString()}</strong>
                          </div>
                        </div>

                        <div className="flex flex-col items-end min-w-[120px]">
                          <span className="text-sm font-black text-amber-600 font-mono">
                            {item.calc.balanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                          </span>
                          <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded mt-1">رصيد دائن (له)</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setShowCreditorsModal(false);
                            setSelectedPartnerForStatement(item);
                          }}
                          className="p-2.5 rounded-xl bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 shadow-sm transition-all hover:shadow cursor-pointer shrink-0"
                          title="عرض كشف الحساب التفصيلي"
                        >
                          <Eye size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 📄 MODAL: قائمة الحسابات المدينة                                */}
      {/* ============================================================ */}
      {showDebtorsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-emerald-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center border border-white/30">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">قائمة أرصدة العملاء والموردين المدينين</h3>
                  <p className="text-emerald-100 text-sm opacity-90 font-medium mt-0.5">
                    إجمالي {debtorsSummary.count} حساب بقيمة {debtorsSummary.totalDebit.toLocaleString()} {currencySymbol}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowDebtorsModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-700/50 hover:bg-red-500 hover:text-white transition-colors"
                title="إغلاق النافذة"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4">
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 shadow-sm">
                {debtorsList.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    لا توجد حسابات مدينة مطابقة للشروط الحالية.
                  </div>
                ) : (
                  debtorsList.map(item => (
                    <div 
                      key={item.id}
                      className="p-4 hover:bg-emerald-50/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm ${
                          item.type === 'CUSTOMER' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {item.type === 'CUSTOMER' ? <Users size={18} /> : <Truck size={18} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-base">{item.name}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              item.type === 'CUSTOMER' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}>
                              {item.type === 'CUSTOMER' ? 'عميل' : 'مورد (دفعة مقدمة)'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{item.code}</span>
                            {item.phone && <span className="flex items-center gap-1"><span className="w-1 h-1 bg-slate-300 rounded-full"></span>{item.phone}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Financial details per debtor */}
                      <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto mt-2 sm:mt-0">
                        <div className="flex flex-col text-left gap-1">
                          <div className="flex justify-between items-center sm:justify-start gap-2">
                            <span className="text-[10px] text-slate-500">المسحوبات:</span>
                            <strong className="font-mono text-slate-700 text-xs">{item.totalWithdrawals.toLocaleString()}</strong>
                          </div>
                          <div className="flex justify-between items-center sm:justify-start gap-2">
                            <span className="text-[10px] text-slate-500">المدفوعات:</span>
                            <strong className="font-mono text-emerald-600 text-xs">{item.totalPayments.toLocaleString()}</strong>
                          </div>
                        </div>

                        <div className="flex flex-col items-end min-w-[120px]">
                          <span className="text-sm font-black text-emerald-600 font-mono">
                            {item.calc.balanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded mt-1">رصيد مدين (عليه)</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setShowDebtorsModal(false);
                            setSelectedPartnerForStatement(item);
                          }}
                          className="p-2.5 rounded-xl bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 shadow-sm transition-all hover:shadow cursor-pointer shrink-0"
                          title="عرض كشف الحساب التفصيلي"
                        >
                          <Eye size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ============================================================ */}
      {/* 📄 MODAL: كشف الحساب التفصيلي للطرف المحدد                    */}
      {/* ============================================================ */}
      {selectedPartnerForStatement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <FileText size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-white">كشف حساب تفصيلي ومطابقة أرصدة</h3>
                    <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-2 py-0.5 rounded border border-indigo-400/30 font-semibold">
                      {selectedPartnerForStatement.type === 'CUSTOMER' ? 'عميل' : 'مورد'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedPartnerForStatement.name} (#{selectedPartnerForStatement.code})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCustomPreviewData(createPartnerStatementPreviewData(selectedPartnerForStatement));
                    setShowPrintPreview(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-sm"
                  title="معاينة كشف الحساب قبل الطباعة"
                >
                  <Eye size={14} /> معاينة قبل الطباعة
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Printer size={14} /> طباعة الكشف
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPartnerForStatement(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto flex flex-col gap-4 bg-slate-50/50">
              
              {/* Partner Quick Summary Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="flex flex-col">
                  <span className="text-slate-400 text-[11px]">الرصيد الافتتاحي:</span>
                  <span className="font-bold font-mono text-slate-800 mt-0.5">
                    {Math.abs(activeStatementData?.openingBalance ?? selectedPartnerForStatement.openingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-blue-600 text-[11px] font-semibold">إجمالي المسحوبات (مدين):</span>
                  <span className="font-bold font-mono text-blue-700 mt-0.5">
                    {(activeStatementData?.totalDebit ?? selectedPartnerForStatement.totalWithdrawals).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-emerald-600 text-[11px] font-semibold">إجمالي المدفوعات (دائن):</span>
                  <span className="font-bold font-mono text-emerald-700 mt-0.5">
                    {(activeStatementData?.totalCredit ?? selectedPartnerForStatement.totalPayments).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                  </span>
                </div>
                <div className="flex flex-col bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-500 text-[11px] font-bold">الرصيد الصافي المستحق:</span>
                  <span className="font-bold font-mono text-base text-indigo-700 mt-0.5">
                    {(activeStatementData?.netBalance ?? getPartnerCalculations(selectedPartnerForStatement).balanceAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {activeStatementData ? activeStatementData.balanceLabel : (getPartnerCalculations(selectedPartnerForStatement).balanceType === 'DEBIT' ? 'مدين (مستحق لنا)' : 'دائن (مستحق له)')}
                  </span>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-3 bg-slate-100/70 border-b border-slate-200 font-bold text-xs text-slate-800 flex items-center justify-between">
                  <span>حركات المسحوبات والمدفوعات وقيود الأستاذ المساعد (Sub-Ledger)</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    إجمالي الحركات: {activeStatementData ? activeStatementData.transactions.length : (selectedPartnerForStatement.transactions?.length || 0)}
                  </span>
                </div>
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="p-3 text-right">التاريخ</th>
                      <th className="p-3 text-right">رقم المستند / القيد</th>
                      <th className="p-3 text-right">نوع الحركة</th>
                      <th className="p-3 text-right">البيان / الشرح</th>
                      <th className="p-3 text-left font-mono text-blue-700">مدين (+)</th>
                      <th className="p-3 text-left font-mono text-emerald-700">دائن (-)</th>
                      <th className="p-3 text-left font-mono text-slate-700">الرصيد التراكمي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(activeStatementData ? activeStatementData.transactions : (selectedPartnerForStatement.transactions || [])).map(tx => {
                      const isJournal = tx.type === 'JOURNAL_ENTRY' || ('docNumber' in tx && (tx.docNumber.startsWith('#JE-') || tx.docNumber.startsWith('JE-')));
                      const docTypeLabel = ('docTypeLabel' in tx && tx.docTypeLabel) 
                        ? tx.docTypeLabel 
                        : (isJournal ? 'قيد يومية (Sub-Ledger)' : ('type' in tx && tx.type === 'INVOICE' ? 'فاتورة' : 'سند مالي'));

                      const runningBal = 'runningBalance' in tx ? (tx as any).runningBalance : undefined;
                      const runningBalType = 'runningBalanceType' in tx ? (tx as any).runningBalanceType : undefined;

                      return (
                        <tr key={tx.id} className={`hover:bg-slate-50/60 ${isJournal ? 'bg-amber-50/40' : ''}`}>
                          <td className="p-3 font-mono text-slate-600 whitespace-nowrap">{tx.date}</td>
                          <td className="p-3 font-mono font-bold text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                            <span>{tx.docNumber}</span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              isJournal 
                                ? 'bg-amber-100 text-amber-900 border-amber-300' 
                                : docTypeLabel.includes('فاتورة')
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {docTypeLabel}
                            </span>
                          </td>
                          <td className="p-3 text-slate-700 max-w-xs">{tx.description}</td>
                          <td className="p-3 text-left font-mono font-bold text-blue-700">
                            {tx.debit > 0 ? tx.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                          </td>
                          <td className="p-3 text-left font-mono font-bold text-emerald-700">
                            {tx.credit > 0 ? tx.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                          </td>
                          <td className="p-3 text-left font-mono font-semibold text-slate-800">
                            {runningBal !== undefined ? (
                              <span>
                                {runningBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
                                <span className="text-[10px] text-slate-400 font-normal">
                                  {runningBalType === 'DEBIT' ? '(مدين)' : runningBalType === 'CREDIT' ? '(دائن)' : ''}
                                </span>
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                    {(!activeStatementData || activeStatementData.transactions.length === 0) && (!selectedPartnerForStatement.transactions || selectedPartnerForStatement.transactions.length === 0) && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-400">
                          لا توجد حركات تفصيلية مسجلة في كشف الحساب.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500">تم إنشاء هذا الكشف آلياً وفقاً لقواعد نظام لوجوستريا المحاسبي</span>
              <button
                type="button"
                onClick={() => setSelectedPartnerForStatement(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Balance Confirmation Letter Modal */}
      {selectedPartnerForConfirmation && (
        <BalanceConfirmationModal
          isOpen={!!selectedPartnerForConfirmation}
          onClose={() => setSelectedPartnerForConfirmation(null)}
          partner={selectedPartnerForConfirmation}
          currencySymbol={currencySymbol}
        />
      )}

      {/* Universal Print Preview Modal */}
      <PrintPreviewModal
        isOpen={showPrintPreview}
        onClose={() => {
          setShowPrintPreview(false);
          setCustomPreviewData(null);
        }}
        data={customPreviewData || createOverallBalancesPreviewData()}
      />

      {/* Advanced Vouchers Export Modal */}
      <VouchersExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        initialCategory="EXTERNAL"
        title="تصدير كشوفات السندات والعمليات (Excel .xlsx / CSV / PDF)"
      />

    </div>
    </>
  );
}
