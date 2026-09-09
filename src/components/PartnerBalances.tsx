import { useState, useMemo } from 'react';
import { 
  Users, 
  Truck, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  Receipt, 
  Download, 
  Eye, 
  CheckCircle2, 
  Printer, 
  X, 
  FileText, 
  Scale, 
  ShieldCheck, 
  RefreshCw 
} from 'lucide-react';
import PrintDropdown from './PrintDropdown';
import PrintPreviewModal, { PrintPreviewData } from './PrintPreviewModal';
import { getSystemSettings } from '../utils/settings';
import { useSystemCurrency } from '../utils/currency';

export interface PartnerBalanceItem {
  id: string;
  code: string;
  name: string;
  type: 'CUSTOMER' | 'VENDOR';
  taxNumber?: string;
  phone?: string;
  openingBalance: number; // Positive = Debit, Negative = Credit
  totalWithdrawals: number; // إجمالي المسحوبات (فواتير بيع للعملاء أو فواتير شراء مستلمة من الموردين)
  totalPayments: number; // إجمالي المدفوعات (سدادات نقدية/بنكية مقبوضة من العميل أو مسددة للمورد)
  lastTransactionDate: string;
  category?: string;
  notes?: string;
  transactions?: {
    id: string;
    date: string;
    type: 'INVOICE' | 'PAYMENT' | 'OPENING';
    docNumber: string;
    description: string;
    debit: number;
    credit: number;
  }[];
}

// Initial rich realistic dataset
const INITIAL_PARTNERS: PartnerBalanceItem[] = [
  // عملاء مدينون (عليهم مبالغ لنا)
  {
    id: 'c-1',
    code: 'CUST-1001',
    name: 'شركة التقنية الحديثة المحدودة',
    type: 'CUSTOMER',
    taxNumber: '300000000000003',
    phone: '0501112233',
    openingBalance: 12500,
    totalWithdrawals: 85400,
    totalPayments: 64200,
    lastTransactionDate: '2026-09-02',
    category: 'شركات ومؤسسات',
    transactions: [
      { id: 'tx-1', date: '2026-01-01', type: 'OPENING', docNumber: 'OP-001', description: 'رصيد افتتاحي مرحل', debit: 12500, credit: 0 },
      { id: 'tx-2', date: '2026-03-14', type: 'INVOICE', docNumber: 'INV-1042', description: 'فاتورة مبيعات أجهزة ومعدات', debit: 45000, credit: 0 },
      { id: 'tx-3', date: '2026-04-01', type: 'PAYMENT', docNumber: 'RV-501', description: 'سند قبض نقدي تحويل بنكي', debit: 0, credit: 30000 },
      { id: 'tx-4', date: '2026-06-20', type: 'INVOICE', docNumber: 'INV-1120', description: 'فاتورة مبيعات خدمات برمجية', debit: 40400, credit: 0 },
      { id: 'tx-5', date: '2026-08-15', type: 'PAYMENT', docNumber: 'RV-640', description: 'سداد دفعة من الحساب', debit: 0, credit: 34200 },
    ]
  },
  {
    id: 'c-2',
    code: 'CUST-1002',
    name: 'مؤسسة البناء العمراني للمقاولات',
    type: 'CUSTOMER',
    taxNumber: '300000000000004',
    phone: '0502223344',
    openingBalance: 25000,
    totalWithdrawals: 142000,
    totalPayments: 110000,
    lastTransactionDate: '2026-08-28',
    category: 'مقاولات وإنشاءات',
    transactions: [
      { id: 'tx-6', date: '2026-01-01', type: 'OPENING', docNumber: 'OP-002', description: 'رصيد افتتاحي', debit: 25000, credit: 0 },
      { id: 'tx-7', date: '2026-02-10', type: 'INVOICE', docNumber: 'INV-1015', description: 'توريد مواد بناء وإنشاءات', debit: 82000, credit: 0 },
      { id: 'tx-8', date: '2026-03-05', type: 'PAYMENT', docNumber: 'RV-512', description: 'سند قبض - شيك مصرفي', debit: 0, credit: 60000 },
      { id: 'tx-9', date: '2026-05-18', type: 'INVOICE', docNumber: 'INV-1098', description: 'توريد كابلات وتجهيزات', debit: 60000, credit: 0 },
      { id: 'tx-10', date: '2026-07-22', type: 'PAYMENT', docNumber: 'RV-605', description: 'حوالة بنكية سريعة', debit: 0, credit: 50000 },
    ]
  },
  {
    id: 'c-3',
    code: 'CUST-1003',
    name: 'مجموعة المروج التجارية',
    type: 'CUSTOMER',
    taxNumber: '310987654300003',
    phone: '0504445566',
    openingBalance: 5000,
    totalWithdrawals: 48600,
    totalPayments: 32000,
    lastTransactionDate: '2026-09-05',
    category: 'تجارة تجزئة',
    transactions: [
      { id: 'tx-11', date: '2026-01-01', type: 'OPENING', docNumber: 'OP-003', description: 'رصيد افتتاحي', debit: 5000, credit: 0 },
      { id: 'tx-12', date: '2026-04-12', type: 'INVOICE', docNumber: 'INV-1077', description: 'بضاعة ومنتجات استهلاكية', debit: 48600, credit: 0 },
      { id: 'tx-13', date: '2026-05-30', type: 'PAYMENT', docNumber: 'RV-580', description: 'سداد نقدي من الصندوق', debit: 0, credit: 32000 },
    ]
  },
  // عميل دائن (له رصيد عندنا كدفعة مقدمة)
  {
    id: 'c-4',
    code: 'CUST-1004',
    name: 'مؤسسة الأفق للاستيراد والتصدير',
    type: 'CUSTOMER',
    taxNumber: '300555666700003',
    phone: '0506667788',
    openingBalance: 0,
    totalWithdrawals: 30000,
    totalPayments: 45000, // سدد دفعات مقدمة أكثر من مسحوباته
    lastTransactionDate: '2026-09-01',
    category: 'استيراد وتوزيع',
    transactions: [
      { id: 'tx-14', date: '2026-07-01', type: 'PAYMENT', docNumber: 'RV-630', description: 'دفعة مقدمة لحجز طلبيات توريد', debit: 0, credit: 45000 },
      { id: 'tx-15', date: '2026-08-12', type: 'INVOICE', docNumber: 'INV-1150', description: 'تسليم الدفعة الأولى من المنتجات', debit: 30000, credit: 0 },
    ]
  },

  // موردون دائنون (لهم مبالغ علينا)
  {
    id: 'v-1',
    code: 'VEND-2001',
    name: 'شركة التوريدات العالمية للصناعة',
    type: 'VENDOR',
    taxNumber: '300000000000005',
    phone: '0503334455',
    openingBalance: -18000, // رصيد افتتاحي دائن
    totalWithdrawals: 195000, // مشتريات/توريدات مستلمة
    totalPayments: 135000, // سدادات نقدية مسددة للمورد
    lastTransactionDate: '2026-09-04',
    category: 'مواد خام وصناعة',
    transactions: [
      { id: 'tx-16', date: '2026-01-01', type: 'OPENING', docNumber: 'OP-V1', description: 'رصيد دائن افتتاحي', debit: 0, credit: 18000 },
      { id: 'tx-17', date: '2026-02-15', type: 'INVOICE', docNumber: 'PO-201', description: 'فاتورة شراء بضائع مركزية', debit: 0, credit: 110000 },
      { id: 'tx-18', date: '2026-03-20', type: 'PAYMENT', docNumber: 'PV-305', description: 'سند صرف حوالة بنكية', debit: 80000, credit: 0 },
      { id: 'tx-19', date: '2026-06-10', type: 'INVOICE', docNumber: 'PO-245', description: 'شحنة إضافية مواد مصنعة', debit: 0, credit: 85000 },
      { id: 'tx-20', date: '2026-08-01', type: 'PAYMENT', docNumber: 'PV-390', description: 'سداد دفعة للمورد شيك مصرفي', debit: 55000, credit: 0 },
    ]
  },
  {
    id: 'v-2',
    code: 'VEND-2002',
    name: 'مصنع الخليج للعبوات والكرتون',
    type: 'VENDOR',
    taxNumber: '300777888900003',
    phone: '0507778899',
    openingBalance: -6500,
    totalWithdrawals: 62000,
    totalPayments: 42000,
    lastTransactionDate: '2026-08-30',
    category: 'تغليف وتعبئة',
    transactions: [
      { id: 'tx-21', date: '2026-01-01', type: 'OPENING', docNumber: 'OP-V2', description: 'رصيد دائن سابق', debit: 0, credit: 6500 },
      { id: 'tx-22', date: '2026-04-05', type: 'INVOICE', docNumber: 'PO-218', description: 'توريد كراتين وتغليف شيكارات', debit: 62000, credit: 0 },
      { id: 'tx-23', date: '2026-05-15', type: 'PAYMENT', docNumber: 'PV-340', description: 'سداد نقدي من الصندوق', debit: 42000, credit: 0 },
    ]
  },
  {
    id: 'v-3',
    code: 'VEND-2003',
    name: 'شركة النقل واللوجستيات السريعة',
    type: 'VENDOR',
    taxNumber: '300999111200003',
    phone: '0508889900',
    openingBalance: 0,
    totalWithdrawals: 28400,
    totalPayments: 18000,
    lastTransactionDate: '2026-09-03',
    category: 'شحن ونقل',
    transactions: [
      { id: 'tx-24', date: '2026-03-01', type: 'INVOICE', docNumber: 'PO-230', description: 'خدمات شحن وتوزيع البضائع', debit: 0, credit: 28400 },
      { id: 'tx-25', date: '2026-06-25', type: 'PAYMENT', docNumber: 'PV-370', description: 'سند صرف مصرفي', debit: 18000, credit: 0 },
    ]
  },
  // مورد مدين (لنا عنده دفعة مقدمة)
  {
    id: 'v-4',
    code: 'VEND-2004',
    name: 'مؤسسة استيراد قطع الغيار الألمانية',
    type: 'VENDOR',
    taxNumber: '310444333200003',
    phone: '0509990011',
    openingBalance: 0,
    totalWithdrawals: 20000,
    totalPayments: 35000, // سددنا له دفعة مقدمة قبل وصول الشحنة
    lastTransactionDate: '2026-08-25',
    category: 'قطع غيار وصيانة',
    transactions: [
      { id: 'tx-26', date: '2026-07-15', type: 'PAYMENT', docNumber: 'PV-385', description: 'دفعة مقدمة اعتماد بنكي لقطع غيار', debit: 35000, credit: 0 },
      { id: 'tx-27', date: '2026-08-20', type: 'INVOICE', docNumber: 'PO-250', description: 'فاتورة استلام جزئي للشحنة', debit: 0, credit: 20000 },
    ]
  },
];

const LOCAL_STORAGE_KEY = 'alpha_partner_balances_v2';

export default function PartnerBalances() {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [systemSettings] = useState(() => getSystemSettings());

  // State
  const [partners, setPartners] = useState<PartnerBalanceItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading partner balances', e);
      }
    }
    return INITIAL_PARTNERS;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [partnerTypeFilter, setPartnerTypeFilter] = useState<'ALL' | 'CUSTOMER' | 'VENDOR'>('ALL');
  const [balanceFilter, setBalanceFilter] = useState<'ALL' | 'DEBIT' | 'CREDIT' | 'ZERO'>('ALL');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');
  const [selectedPartnerForStatement, setSelectedPartnerForStatement] = useState<PartnerBalanceItem | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [customPreviewData, setCustomPreviewData] = useState<PrintPreviewData | null>(null);

  const handleResetData = () => {
    if (window.confirm('هل تريد إعادة تعيين الأرصدة إلى البيانات النموذجية الأولية؟')) {
      setPartners(INITIAL_PARTNERS);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_PARTNERS));
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

    return {
      balanceType,
      balanceAmount,
      paymentRatio
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

  // Grand Totals across all customers and suppliers (المطلوب: إجمالي مسحوبات الجميع وإجمالي مدفوعات الجميع)
  const grandTotals = useMemo(() => {
    let grandWithdrawals = 0; // إجمالي مسحوبات الجميع
    let grandPayments = 0; // إجمالي مدفوعات الجميع
    let totalDebitSum = 0; // إجمالي أرصدة المدينين
    let totalCreditSum = 0; // إجمالي أرصدة الدائنين
    let debtorCount = 0;
    let creditorCount = 0;

    enrichedPartners.forEach(p => {
      grandWithdrawals += p.totalWithdrawals;
      grandPayments += p.totalPayments;

      if (p.calc.balanceType === 'DEBIT') {
        totalDebitSum += p.calc.balanceAmount;
        debtorCount++;
      } else if (p.calc.balanceType === 'CREDIT') {
        totalCreditSum += p.calc.balanceAmount;
        creditorCount++;
      }
    });

    const netOverallPosition = totalDebitSum - totalCreditSum; // صافي الذمم (مستحقات - التزامات)

    return {
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
      if (balanceFilter !== 'ALL' && p.calc.balanceType !== balanceFilter) return false;
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

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'الكود',
      'الاسم',
      'النوع',
      'الهاتف',
      'الرقم الضريبي',
      'إجمالي المسحوبات',
      'إجمالي المدفوعات',
      'حالة الرصيد',
      'مبلغ الرصيد الصافي'
    ];

    const rows = filteredPartners.map(p => [
      p.code,
      `"${p.name}"`,
      p.type === 'CUSTOMER' ? 'عميل' : 'مورد',
      p.phone || '-',
      p.taxNumber || '-',
      p.totalWithdrawals.toFixed(2),
      p.totalPayments.toFixed(2),
      p.calc.balanceType === 'DEBIT' ? 'مدين (لنا)' : p.calc.balanceType === 'CREDIT' ? 'دائن (له)' : 'متزن',
      p.calc.balanceAmount.toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + 
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ارصدة_العملاء_والموردين_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Preview data builders
  const createPartnerStatementPreviewData = (partner: PartnerBalanceItem): PrintPreviewData => {
    const calc = getPartnerCalculations(partner);
    const isDebit = calc.balanceType === 'DEBIT';
    const isCredit = calc.balanceType === 'CREDIT';
    const balanceText = isDebit ? 'مدين (مستحق لنا)' : isCredit ? 'دائن (مستحق له)' : 'متزن';

    const txItems = (partner.transactions && partner.transactions.length > 0)
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
          unitPrice: calc.balanceAmount,
          taxRate: 0,
          total: calc.balanceAmount
        }];

    return {
      title: `كشف حساب ${partner.type === 'CUSTOMER' ? 'عميل' : 'مورد'}`,
      subtitle: `كشف حساب تفصيلي ومطابقة أرصدة - ${partner.name}`,
      docNumber: partner.code,
      date: new Date().toISOString().split('T')[0] as string,
      partnerName: partner.name,
      partnerType: partner.type,
      partnerTaxNo: partner.taxNumber,
      paymentMethod: `الرصيد الصافي: ${calc.balanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currencySymbol} (${balanceText})`,
      notes: `الرصيد الافتتاحي: ${partner.openingBalance.toLocaleString()} | إجمالي المسحوبات: ${partner.totalWithdrawals.toLocaleString()} | إجمالي المدفوعات: ${partner.totalPayments.toLocaleString()}`,
      subtotal: partner.totalWithdrawals,
      taxTotal: 0,
      grandTotal: calc.balanceAmount,
      paidAmount: partner.totalPayments,
      remainingAmount: calc.balanceAmount,
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

  return (
    <div className="flex flex-col flex-1 pb-10">
      
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1 text-slate-500">
            <span className="text-xs uppercase font-bold tracking-tight">الحسابات والتقارير المالية</span>
            <span className="text-xs">/</span>
            <span className="text-xs uppercase font-bold tracking-tight text-indigo-600">أرصدة العملاء والموردين</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Scale size={22} />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">أرصدة العملاء والموردين</h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                متابعة دقيقة للأرصدة الدائنة والمدينة، إجمالي المسحوبات، إجمالي المدفوعات، ومطابقة الحسابات.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setCustomPreviewData(createOverallBalancesPreviewData());
              setShowPrintPreview(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
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
          
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="تصدير جدول الأرصدة إلى Excel / CSV"
          >
            <Download size={15} className="text-emerald-600" />
            <span>تصدير تقرير</span>
          </button>

          <button
            type="button"
            onClick={handleResetData}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="استعادة البيانات النموذجية الأولية"
          >
            <RefreshCw size={14} className="text-indigo-600" />
            <span>تحديث وتعيين</span>
          </button>

          <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('CARDS')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'CARDS' 
                  ? 'bg-white text-slate-900 shadow-xs font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              عرض البطاقات
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'TABLE' 
                  ? 'bg-white text-slate-900 shadow-xs font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الجدول الشامل
            </button>
          </div>
        </div>
      </div>

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

          {/* 4 Main Grand Metric Blocks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* 1. إجمالي مسحوبات الجميع */}
            <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-colors backdrop-blur-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-300 mb-2">
                <span className="text-xs font-semibold text-blue-200">إجمالي مسحوبات الجميع</span>
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Receipt size={17} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
                {grandTotals.grandWithdrawals.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                <span className="text-xs font-normal text-slate-400 mr-1.5">{currencySymbol}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                <span>كافة فواتير المبيعات + فواتير الشراء المستلمة</span>
              </div>
            </div>

            {/* 2. إجمالي مدفوعات الجميع */}
            <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-colors backdrop-blur-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-300 mb-2">
                <span className="text-xs font-semibold text-emerald-200">إجمالي مدفوعات الجميع</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Wallet size={17} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-300 tracking-tight">
                {grandTotals.grandPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                <span className="text-xs font-normal text-slate-400 mr-1.5">{currencySymbol}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                <span>سندات القبض الواردة + سندات الصرف المسددة</span>
              </div>
            </div>

            {/* 3. إجمالي أرصدة المدينين (مستحقات لنا) */}
            <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-colors backdrop-blur-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-300 mb-2">
                <span className="text-xs font-semibold text-cyan-200">إجمالي أرصدة المدينين (لنا)</span>
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <ArrowUpRight size={17} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-cyan-300 tracking-tight">
                {grandTotals.totalDebitSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                <span className="text-xs font-normal text-slate-400 mr-1.5">{currencySymbol}</span>
              </div>
              <div className="text-[11px] text-cyan-200/70 mt-2 flex items-center justify-between">
                <span>مستحقات على العملاء والموردين</span>
                <span className="font-mono bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded text-[10px]">
                  {grandTotals.debtorCount} حساب
                </span>
              </div>
            </div>

            {/* 4. إجمالي أرصدة الدائنين (التزامات علينا) */}
            <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-colors backdrop-blur-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-300 mb-2">
                <span className="text-xs font-semibold text-amber-200">إجمالي أرصدة الدائنين (علينا)</span>
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <ArrowDownLeft size={17} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-300 tracking-tight">
                {grandTotals.totalCreditSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                <span className="text-xs font-normal text-slate-400 mr-1.5">{currencySymbol}</span>
              </div>
              <div className="text-[11px] text-amber-200/70 mt-2 flex items-center justify-between">
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
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setPartnerTypeFilter('ALL')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                partnerTypeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الجميع
            </button>
            <button
              type="button"
              onClick={() => setPartnerTypeFilter('CUSTOMER')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                partnerTypeFilter === 'CUSTOMER' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={12} /> العملاء فقط
            </button>
            <button
              type="button"
              onClick={() => setPartnerTypeFilter('VENDOR')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                partnerTypeFilter === 'VENDOR' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck size={12} /> الموردون فقط
            </button>
          </div>

          {/* Balance Status Filter */}
          <select
            value={balanceFilter}
            onChange={e => setBalanceFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">جميع الحالات (مدين ودائن)</option>
            <option value="DEBIT">المدينون فقط (لنا عندهم)</option>
            <option value="CREDIT">الدائنون فقط (لهم عندنا)</option>
            <option value="ZERO">الحسابات المصفّرة (رصيد صفر)</option>
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md">
            
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

            {/* Creditors List Table */}
            <div className="flex-1 overflow-x-auto divide-y divide-slate-100">
              {creditorsList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  لا توجد حسابات دائنة مطابقة للشروط الحالية.
                </div>
              ) : (
                creditorsList.map(item => (
                  <div 
                    key={item.id}
                    className="p-4 hover:bg-amber-50/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                        item.type === 'CUSTOMER' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {item.type === 'CUSTOMER' ? <Users size={16} /> : <Truck size={16} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                            item.type === 'CUSTOMER' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}>
                            {item.type === 'CUSTOMER' ? 'عميل (دفعة مقدمة)' : 'مورد'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                          <span className="font-mono">{item.code}</span>
                          {item.phone && <span>هاتف: {item.phone}</span>}
                          <span>آخر حركة: {item.lastTransactionDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Financial details per creditor */}
                    <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="flex flex-col text-left">
                        <span className="text-[10px] text-slate-400">إجمالي المسحوبات: <strong className="font-mono text-slate-700">{item.totalWithdrawals.toLocaleString()}</strong></span>
                        <span className="text-[10px] text-slate-400">إجمالي المدفوعات: <strong className="font-mono text-emerald-600">{item.totalPayments.toLocaleString()}</strong></span>
                      </div>

                      <div className="flex flex-col items-end">
                        <span className="text-xs font-bold text-amber-600 font-mono text-base">
                          {item.calc.balanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                        </span>
                        <span className="text-[10px] text-amber-700 font-semibold">رصيد دائن (له)</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedPartnerForStatement(item)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 transition-colors cursor-pointer"
                        title="عرض كشف الحساب التفصيلي"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md">
            
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
            <div className="flex-1 overflow-x-auto divide-y divide-slate-100">
              {debtorsList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  لا توجد حسابات مدينة مطابقة للشروط الحالية.
                </div>
              ) : (
                debtorsList.map(item => (
                  <div 
                    key={item.id}
                    className="p-4 hover:bg-emerald-50/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                        item.type === 'CUSTOMER' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {item.type === 'CUSTOMER' ? <Users size={16} /> : <Truck size={16} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                            item.type === 'CUSTOMER' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}>
                            {item.type === 'CUSTOMER' ? 'عميل' : 'مورد (دفعة مقدمة)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                          <span className="font-mono">{item.code}</span>
                          {item.phone && <span>هاتف: {item.phone}</span>}
                          <span>آخر حركة: {item.lastTransactionDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Financial details per debtor */}
                    <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="flex flex-col text-left">
                        <span className="text-[10px] text-slate-400">إجمالي المسحوبات: <strong className="font-mono text-slate-700">{item.totalWithdrawals.toLocaleString()}</strong></span>
                        <span className="text-[10px] text-slate-400">إجمالي المدفوعات: <strong className="font-mono text-emerald-600">{item.totalPayments.toLocaleString()}</strong></span>
                      </div>

                      <div className="flex flex-col items-end">
                        <span className="text-xs font-bold text-emerald-600 font-mono text-base">
                          {item.calc.balanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-semibold">رصيد مدين (عليه)</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedPartnerForStatement(item)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 transition-colors cursor-pointer"
                        title="عرض كشف الحساب التفصيلي"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
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
                <th className="p-3.5 text-right">كود الحساب</th>
                <th className="p-3.5 text-right">الاسم التجاري / الشركة</th>
                <th className="p-3.5 text-center">النوع</th>
                <th className="p-3.5 text-left font-mono">الرصيد الافتتاحي</th>
                <th className="p-3.5 text-left font-mono text-blue-700 font-bold">إجمالي المسحوبات</th>
                <th className="p-3.5 text-left font-mono text-emerald-700 font-bold">إجمالي المدفوعات</th>
                <th className="p-3.5 text-center">نسبة السداد</th>
                <th className="p-3.5 text-left font-mono text-slate-900 font-bold">الرصيد الصافي الحالي</th>
                <th className="p-3.5 text-center">الحالة</th>
                <th className="p-3.5 text-center print:hidden">كشف حساب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPartners.map(p => {
                const isDebit = p.calc.balanceType === 'DEBIT';
                const isCredit = p.calc.balanceType === 'CREDIT';
                return (
                  <tr 
                    key={p.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="p-3.5 font-mono text-slate-500 font-semibold">{p.code}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {p.phone && <span className="mr-2">هاتف: {p.phone}</span>}
                        {p.taxNumber && <span>ضريبي: {p.taxNumber}</span>}
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
                    <td className="p-3.5 text-center print:hidden">
                      <button
                        type="button"
                        onClick={() => setSelectedPartnerForStatement(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition-colors cursor-pointer"
                      >
                        <Eye size={12} /> كشف
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredPartners.length === 0 && (
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
                  المجموع الكلي ({filteredPartners.length} طرف تعامل):
                </td>
                <td className="p-3.5 text-left font-mono text-blue-700 text-sm">
                  {filteredPartners.reduce((acc, p) => acc + p.totalWithdrawals, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="p-3.5 text-left font-mono text-emerald-700 text-sm">
                  {filteredPartners.reduce((acc, p) => acc + p.totalPayments, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td></td>
                <td className="p-3.5 text-left font-mono text-slate-900 text-sm">
                  {filteredPartners.reduce((acc, p) => acc + p.calc.balanceAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>

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
                    {Math.abs(selectedPartnerForStatement.openingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-blue-600 text-[11px] font-semibold">إجمالي المسحوبات:</span>
                  <span className="font-bold font-mono text-blue-700 mt-0.5">
                    {selectedPartnerForStatement.totalWithdrawals.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-emerald-600 text-[11px] font-semibold">إجمالي المدفوعات:</span>
                  <span className="font-bold font-mono text-emerald-700 mt-0.5">
                    {selectedPartnerForStatement.totalPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                  </span>
                </div>
                <div className="flex flex-col bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-500 text-[11px] font-bold">الرصيد الصافي المستحق:</span>
                  <span className="font-bold font-mono text-base text-indigo-700 mt-0.5">
                    {getPartnerCalculations(selectedPartnerForStatement).balanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {getPartnerCalculations(selectedPartnerForStatement).balanceType === 'DEBIT' ? 'مدين (مستحق لنا)' : 'دائن (مستحق له)'}
                  </span>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-3 bg-slate-100/70 border-b border-slate-200 font-bold text-xs text-slate-800">
                  حركات المسحوبات والمدفوعات المسجلة
                </div>
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="p-3 text-right">التاريخ</th>
                      <th className="p-3 text-right">رقم المستند</th>
                      <th className="p-3 text-right">البيان / الحركة</th>
                      <th className="p-3 text-left font-mono text-blue-700">مسحوبات (مدين)</th>
                      <th className="p-3 text-left font-mono text-emerald-700">مدفوعات (دائن)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedPartnerForStatement.transactions?.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50/60">
                        <td className="p-3 font-mono text-slate-600">{tx.date}</td>
                        <td className="p-3 font-mono font-bold text-slate-800">{tx.docNumber}</td>
                        <td className="p-3 text-slate-700">{tx.description}</td>
                        <td className="p-3 text-left font-mono font-bold text-blue-700">
                          {tx.debit > 0 ? tx.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="p-3 text-left font-mono font-bold text-emerald-700">
                          {tx.credit > 0 ? tx.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </td>
                      </tr>
                    ))}
                    {(!selectedPartnerForStatement.transactions || selectedPartnerForStatement.transactions.length === 0) && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400">
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

      {/* Universal Print Preview Modal */}
      <PrintPreviewModal
        isOpen={showPrintPreview}
        onClose={() => {
          setShowPrintPreview(false);
          setCustomPreviewData(null);
        }}
        data={customPreviewData || createOverallBalancesPreviewData()}
      />

    </div>
  );
}
