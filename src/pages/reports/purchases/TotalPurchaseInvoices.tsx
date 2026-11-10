import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar, 
  Truck, 
  Search, 
  Printer, 
  FileSpreadsheet, 
  FileText, 
  RotateCcw, 
  DollarSign, 
  ArrowRight, 
  ArrowLeft,
  Filter,
  CheckCircle2,
  FileBarChart,
  UserCheck,
  CheckCircle,
  Clock,
  Wallet,
  AlertCircle,
  CreditCard,
  Receipt,
  Banknote,
  Scale,
  Landmark,
  Warehouse,
  Briefcase,
  Layers,
  ChevronDown,
  X,
  Package
} from 'lucide-react';
import { supabase } from '../../../services/supabaseClient';
import { loadStoredPurchaseInvoices } from '../../../utils/purchasesStore';
import { loadVendors } from '../../../utils/partnerLedger';
import { exportToXLSX, exportToPDF } from '../../../utils/universalExport';
import { useSystemCurrency } from '../../../utils/currency';
import { useLanguage } from '../../../i18n/LanguageContext';
import { loadChartOfAccounts } from '../../../utils/trialBalanceStore';
import { isCashOrBankAccount } from '../../../utils/accountingIntegration';
import { getDynamicWarehousesList, getWarehouseLabel } from '../../../utils/itemsStore';

interface TotalPurchaseInvoicesProps {
  onNavigate?: (view: string | null) => void;
}

interface VendorOption {
  id: string;
  name: string;
  code?: string;
  phone?: string;
}

export const TotalPurchaseInvoices: React.FC<TotalPurchaseInvoicesProps> = ({ onNavigate }) => {
  const { symbol: currencySymbol } = useSystemCurrency();
  const { language, isRtl } = useLanguage();
  const reportRef = useRef<HTMLDivElement>(null);

  const todayStr = new Date().toISOString().substring(0, 10);
  
  // حقول الفلترة الزمنية
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // أول الشهر الحالي افتراضياً
    return d.toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(todayStr);
  
  // الفلتر 1: المورد (Supplier Filter)
  const [selectedVendorId, setSelectedVendorId] = useState<string>('ALL');
  const [vendorsList, setVendorsList] = useState<VendorOption[]>([]);
  const [vendorSearchQuery, setVendorSearchQuery] = useState<string>('');

  // الفلتر 2: حالة الفاتورة وحالة السداد (Invoice & Payment Status Filter)
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // الفلتر 3: نوع الفاتورة وطريقة التعامل (Invoice Type & Payment Method Filter)
  const [selectedInvoiceType, setSelectedInvoiceType] = useState<string>('ALL');

  // الفلتر 4: نطاق مبلغ الفاتورة (Invoice Amount Range Filter)
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  
  // الفلتر 5: التصنيف الضريبي والمالي (Tax Classification Filter)
  const [selectedClassification, setSelectedClassification] = useState<string>('ALL');
  
  // الفلتر 6: خزينة الصرف والحساب المسدد منه (Safe & Treasury Filter)
  const [selectedSafe, setSelectedSafe] = useState<string>('ALL');
  
  // الفلتر 7: مستودع الاستلام والفرع (Warehouse & Branch Filter)
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  
  // البيانات والحالة
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'vendor' | 'number'>('date');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // تحميل قائمة الموردين من قاعدة البيانات والتخزين المحلي
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const localVendors = loadVendors();
        const mappedLocal: VendorOption[] = (localVendors || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          code: v.code || '',
          phone: v.phone || ''
        }));

        // محاولة جلب الموردين من Supabase
        const { data, error } = await supabase
          .from('vendors')
          .select('id, name, code, phone')
          .order('name');

        if (!error && data && data.length > 0) {
          const mergedMap = new Map<string, VendorOption>();
          (mappedLocal || []).forEach(v => mergedMap.set(v.id, v));
          (data || []).forEach(v => mergedMap.set(v.id, { id: v.id, name: v.name, code: v.code || '', phone: v.phone || '' }));
          setVendorsList(Array.from(mergedMap.values()));
        } else {
          // بديل: فحص جدول suppliers أو partners
          const { data: partnersData } = await supabase
            .from('partners')
            .select('id, name, code, phone')
            .eq('type', 'VENDOR')
            .order('name');

          if (partnersData && partnersData.length > 0) {
            const mergedMap = new Map<string, VendorOption>();
            (mappedLocal || []).forEach(v => mergedMap.set(v.id, v));
            (partnersData || []).forEach(v => mergedMap.set(v.id, { id: v.id, name: v.name, code: v.code || '', phone: v.phone || '' }));
            setVendorsList(Array.from(mergedMap.values()));
          } else {
            setVendorsList(mappedLocal);
          }
        }
      } catch (err) {
        console.warn('Error loading vendors:', err);
        const fallback = loadVendors();
        setVendorsList(fallback.map((v: any) => ({ id: v.id, name: v.name, code: v.code, phone: v.phone })));
      }
    };

    fetchVendors();
  }, []);

  // المورد المحدد حالياً
  const selectedVendorObj = useMemo(() => {
    if (selectedVendorId === 'ALL') return null;
    return vendorsList.find(v => v.id === selectedVendorId) || null;
  }, [selectedVendorId, vendorsList]);

  // تسمية الحالة المحددة حالياً
  const selectedStatusLabel = useMemo(() => {
    switch (selectedStatus) {
      case 'POSTED': return 'فواتير مرحلة ومعتمدة';
      case 'DRAFT': return 'مسودات غير مرحلة';
      case 'PAID': return 'مسددة بالكامل';
      case 'PARTIALLY_PAID': return 'مسددة جزئياً';
      case 'UNPAID': return 'غير مسددة / آجلة';
      default: return null;
    }
  }, [selectedStatus]);

  // تسمية نوع الفاتورة
  const selectedInvoiceTypeLabel = useMemo(() => {
    switch (selectedInvoiceType) {
      case 'CASH': return 'مشتريات نقدية (كاش)';
      case 'CREDIT': return 'مشتريات آجلة (ذمم موردين)';
      case 'PARTIAL': return 'مشتريات سداد جزئي';
      case 'PURCHASE_RETURN': return 'مرتجعات مشتريات';
      default: return null;
    }
  }, [selectedInvoiceType]);

  // تسمية التصنيف الضريبي
  const selectedClassificationLabel = useMemo(() => {
    switch (selectedClassification) {
      case 'TAX': return 'فواتير ضريبية (15% VAT)';
      case 'ZERO_OR_EXEMPT': return 'فواتير معفاة / صفرية';
      default: return null;
    }
  }, [selectedClassification]);

  const cashBankOptions = useMemo(() => {
    const chart = loadChartOfAccounts();
    return chart.filter(a => isCashOrBankAccount(a, chart)).map(a => ({ id: a.code || a.id, label: `${a.code} - ${a.name}` }));
  }, []);

  const dynamicWarehouses = useMemo(() => {
    return getDynamicWarehousesList([selectedWarehouse !== 'ALL' ? selectedWarehouse : '']);
  }, [selectedWarehouse]);

  // تسمية الخزينة
  const selectedSafeLabel = useMemo(() => {
    if (selectedSafe === 'ALL') return null;
    const found = cashBankOptions.find(a => a.id === selectedSafe);
    if (found) return found.label;
    return selectedSafe;
  }, [selectedSafe, cashBankOptions]);

  // تسمية المستودع
  const selectedWarehouseLabel = useMemo(() => {
    if (selectedWarehouse === 'ALL') return null;
    return getWarehouseLabel(selectedWarehouse);
  }, [selectedWarehouse]);

  // أزرار الفترات السريعة
  const handleQuickPeriod = (period: 'today' | 'week' | 'month' | 'quarter' | 'year') => {
    const now = new Date();
    const end = todayStr;
    let start = todayStr;

    if (period === 'today') {
      start = todayStr;
    } else if (period === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      start = d.toISOString().substring(0, 10);
    } else if (period === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      start = d.toISOString().substring(0, 10);
    } else if (period === 'quarter') {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      const d = new Date(now.getFullYear(), quarterMonth, 1);
      start = d.toISOString().substring(0, 10);
    } else if (period === 'year') {
      const d = new Date(now.getFullYear(), 0, 1);
      start = d.toISOString().substring(0, 10);
    }

    setStartDate(start);
    setEndDate(end);
  };

  // استعلام وجلب البيانات
  const handleSearch = async () => {
    if (!startDate || !endDate) {
      alert('يرجى تحديد فترة البحث');
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      // 1. استعلام Supabase
      let { data, error } = await supabase
        .from('purchase_invoices')
        .select(`
          *,
          vendors:vendor_id (id, name, code, phone),
          suppliers:supplier_id (id, name, code, phone)
        `)
        .gte('created_at', startDate)
        .lte('created_at', `${endDate}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) {
        const altQuery = await supabase
          .from('invoices')
          .select('*')
          .eq('type', 'purchase')
          .gte('created_at', startDate)
          .lte('created_at', `${endDate}T23:59:59`)
          .order('created_at', { ascending: false });

        if (!altQuery.error && altQuery.data && altQuery.data.length > 0) {
          data = altQuery.data as any;
          error = null;
        }
      }

      let allInvoices: any[] = [];

      if (error || !data || data.length === 0) {
        // جلب من التخزين المحلي
        const localData = loadStoredPurchaseInvoices();
        const allVendors = loadVendors();

        const filtered = localData.filter(inv => {
          const invDate = inv.date || inv.createdAt?.substring(0, 10);
          return invDate >= startDate && invDate <= endDate;
        });

        allInvoices = filtered.map((inv: any) => {
          const matchedVendor = allVendors.find(v => v.id === inv.partnerId || v.name === inv.partnerName);
          const supplierName = inv.partnerName || matchedVendor?.name || 'مورد نقدي / عام';

          const grandTotal = Number(inv.totals?.grandTotal || inv.net_amount || inv.total_amount || 0);
          const taxTotal = Number(inv.totals?.vatTotal || inv.tax_amount || grandTotal * 0.15 / 1.15 || 0);
          const subTotal = Number(inv.totals?.subTotal || (grandTotal - taxTotal) || 0);
          const paid = Number(inv.paidAmount ?? (inv.paymentMethod === 'CASH' || inv.paymentType === 'CASH' ? grandTotal : 0));
          const remaining = Number(inv.remainingAmount ?? (grandTotal - paid));

          return {
            id: inv.id,
            invoice_number: inv.invoiceNumber || inv.invoice_no || inv.id,
            created_at: inv.date || inv.createdAt,
            date: inv.date || inv.createdAt?.substring(0, 10),
            supplier_id: inv.partnerId,
            supplier_name: supplierName,
            partnerName: supplierName,
            partnerId: inv.partnerId,
            sub_total: subTotal,
            tax_amount: taxTotal,
            net_amount: grandTotal,
            total_amount: grandTotal,
            paid_amount: paid,
            remaining_amount: remaining,
            status: inv.status || 'POSTED',
            payment_type: inv.paymentMethod || inv.paymentType || (remaining <= 0 ? 'CASH' : paid > 0 ? 'PARTIAL' : 'CREDIT'),
            safe_account: inv.safe || inv.safeId || (inv.paymentMethod === 'BANK' ? '1102' : '1101'),
            warehouse_name: inv.source || inv.warehouseName || inv.warehouseId || 'MAIN_WAREHOUSE',
            notes: inv.notes || '',
            items_count: inv.items?.length || 1
          };
        });
      } else {
        const allVendors = loadVendors();
        allInvoices = (data || []).map((inv: any) => {
          const supplierName = inv.supplier_name || 
                               inv.vendor_name || 
                               inv.vendors?.name || 
                               inv.suppliers?.name || 
                               inv.partnerName || 
                               allVendors.find(v => v.id === (inv.vendor_id || inv.supplier_id || inv.partnerId))?.name || 
                               'مورد نقدي / عام';

          const grandTotal = Number(inv.net_amount || inv.total_amount || inv.grand_total || 0);
          const taxTotal = Number(inv.tax_amount || inv.vat_total || 0);
          const subTotal = Number(inv.sub_total || (grandTotal - taxTotal) || 0);
          const paid = Number(inv.paid_amount ?? (inv.payment_type === 'CASH' || inv.status === 'PAID' ? grandTotal : 0));
          const remaining = Number(inv.remaining_amount ?? (grandTotal - paid));

          return {
            id: inv.id,
            invoice_number: inv.invoice_number || inv.invoiceNumber || inv.id,
            created_at: inv.created_at || inv.date,
            date: (inv.created_at || inv.date)?.substring(0, 10),
            supplier_id: inv.supplier_id || inv.vendor_id || inv.partnerId,
            supplier_name: supplierName,
            partnerName: supplierName,
            sub_total: subTotal,
            tax_amount: taxTotal,
            net_amount: grandTotal,
            total_amount: grandTotal,
            paid_amount: paid,
            remaining_amount: remaining,
            status: inv.status || 'POSTED',
            payment_type: inv.payment_type || inv.paymentMethod || (remaining <= 0 ? 'CASH' : paid > 0 ? 'PARTIAL' : 'CREDIT'),
            safe_account: inv.safe_account || inv.safeId || 'MAIN_SAFE',
            warehouse_name: inv.warehouse_name || inv.warehouse_id || 'MAIN_WAREHOUSE',
            notes: inv.notes || '',
            items_count: inv.items_count || 1
          };
        });
      }

      setInvoices(allInvoices);
    } catch (error: any) {
      alert(`خطأ أثناء جلب البيانات: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // تنفيذ البحث التلقائي عند أول تحميل
  useEffect(() => {
    handleSearch();
  }, []);

  // تطبيق الفلاتر المتقدمة في الذاكرة
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // 1. فلتر المورد
      if (selectedVendorId !== 'ALL') {
        const matchesId = inv.supplier_id === selectedVendorId || inv.partnerId === selectedVendorId;
        const matchedVendorObj = vendorsList.find(v => v.id === selectedVendorId);
        const matchesName = matchedVendorObj && (inv.supplier_name || '').toLowerCase().includes((matchedVendorObj.name || '').toLowerCase());
        if (!matchesId && !matchesName) return false;
      }

      // 2. فلتر الحالة
      if (selectedStatus !== 'ALL') {
        const status = (inv.status || '').toUpperCase();
        if (selectedStatus === 'POSTED' && status !== 'POSTED' && status !== 'ISSUED' && status !== 'معتمدة / مرحلة') return false;
        if (selectedStatus === 'DRAFT' && status !== 'DRAFT' && status !== 'مسودة') return false;
        if (selectedStatus === 'PAID' && inv.remaining_amount > 0.01) return false;
        if (selectedStatus === 'PARTIALLY_PAID' && (inv.paid_amount <= 0 || inv.remaining_amount <= 0.01)) return false;
        if (selectedStatus === 'UNPAID' && inv.paid_amount > 0.01) return false;
      }

      // 3. فلتر نوع الفاتورة / السداد
      if (selectedInvoiceType !== 'ALL') {
        const payType = (inv.payment_type || '').toUpperCase();
        if (selectedInvoiceType === 'CASH' && payType !== 'CASH' && inv.remaining_amount > 0.01) return false;
        if (selectedInvoiceType === 'CREDIT' && payType !== 'CREDIT' && inv.paid_amount > 0.01) return false;
        if (selectedInvoiceType === 'PARTIAL' && (inv.paid_amount <= 0 || inv.remaining_amount <= 0.01)) return false;
        if (selectedInvoiceType === 'PURCHASE_RETURN' && !inv.invoice_number?.includes('RET') && !inv.type?.includes('return')) return false;
      }

      // 4. فلتر نطاق المبلغ
      const amount = Number(inv.net_amount || inv.total_amount || 0);
      if (minAmount && amount < parseFloat(minAmount)) return false;
      if (maxAmount && amount > parseFloat(maxAmount)) return false;

      // 5. فلتر التصنيف الضريبي
      if (selectedClassification !== 'ALL') {
        const tax = Number(inv.tax_amount || 0);
        if (selectedClassification === 'TAX' && tax <= 0) return false;
        if (selectedClassification === 'ZERO_OR_EXEMPT' && tax > 0) return false;
      }

      // 6. فلتر الخزينة / الحساب
      if (selectedSafe !== 'ALL') {
        const safe = (inv.safe_account || '').toUpperCase();
        const targetSafe = selectedSafe.toUpperCase();
        if (targetSafe === '1101' || targetSafe === 'MAIN_SAFE') {
          if (!safe.includes('1101') && !safe.includes('SAFE') && !safe.includes('MAIN') && !safe.includes('صندوق')) return false;
        } else if (targetSafe === '1102') {
          if (!safe.includes('1102') && !safe.includes('BANK') && !safe.includes('بنك')) return false;
        } else if (safe !== targetSafe) {
          return false;
        }
      }

      // 7. فلتر المستودع
      if (selectedWarehouse !== 'ALL') {
        const wh = (inv.warehouse_name || '').toUpperCase();
        const targetWh = selectedWarehouse.toUpperCase();
        if (targetWh === 'MAIN_WAREHOUSE') {
          if (!wh.includes('MAIN') && !wh.includes('رئيسي')) return false;
        } else if (wh !== targetWh && getWarehouseLabel(inv.warehouse_name) !== getWarehouseLabel(selectedWarehouse)) {
          return false;
        }
      }

      // 8. فلتر البحث النصي السريع
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchNum = inv.invoice_number?.toLowerCase().includes(query);
        const matchSup = inv.supplier_name?.toLowerCase().includes(query);
        const matchNotes = inv.notes?.toLowerCase().includes(query);
        if (!matchNum && !matchSup && !matchNotes) return false;
      }

      return true;
    }).sort((a, b) => {
      let valA: any = a.date;
      let valB: any = b.date;

      if (sortBy === 'amount') {
        valA = Number(a.net_amount || 0);
        valB = Number(b.net_amount || 0);
      } else if (sortBy === 'vendor') {
        valA = a.supplier_name || '';
        valB = b.supplier_name || '';
      } else if (sortBy === 'number') {
        valA = a.invoice_number || '';
        valB = b.invoice_number || '';
      }

      if (sortDirection === 'asc') {
        return valA > valB ? 1 : -1;
      }
      return valA < valB ? 1 : -1;
    });
  }, [invoices, selectedVendorId, selectedStatus, selectedInvoiceType, minAmount, maxAmount, selectedClassification, selectedSafe, selectedWarehouse, searchTerm, sortBy, sortDirection, vendorsList]);

  // إحصائيات KPIs
  const summaryStats = useMemo(() => {
    let totalPurchases = 0;
    let totalTax = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    const vendorSet = new Set<string>();

    filteredInvoices.forEach(inv => {
      totalPurchases += Number(inv.net_amount || inv.total_amount || 0);
      totalTax += Number(inv.tax_amount || 0);
      totalPaid += Number(inv.paid_amount || 0);
      totalRemaining += Number(inv.remaining_amount || 0);
      if (inv.supplier_name) vendorSet.add(inv.supplier_name);
    });

    const count = filteredInvoices.length;
    const avgInvoice = count > 0 ? totalPurchases / count : 0;

    return {
      totalPurchases,
      totalTax,
      totalPaid,
      totalRemaining,
      invoiceCount: count,
      vendorCount: vendorSet.size,
      avgInvoice
    };
  }, [filteredInvoices]);

  // عدد الفلاتر النشطة
  const activeFiltersCount = useMemo(() => {
    let c = 0;
    if (selectedVendorId !== 'ALL') c++;
    if (selectedStatus !== 'ALL') c++;
    if (selectedInvoiceType !== 'ALL') c++;
    if (selectedClassification !== 'ALL') c++;
    if (selectedSafe !== 'ALL') c++;
    if (selectedWarehouse !== 'ALL') c++;
    if (minAmount || maxAmount) c++;
    if (searchTerm.trim()) c++;
    return c;
  }, [selectedVendorId, selectedStatus, selectedInvoiceType, selectedClassification, selectedSafe, selectedWarehouse, minAmount, maxAmount, searchTerm]);

  // إعادة ضبط جميع الفلاتر
  const handleResetFilters = () => {
    setSelectedVendorId('ALL');
    setSelectedStatus('ALL');
    setSelectedInvoiceType('ALL');
    setMinAmount('');
    setMaxAmount('');
    setSelectedClassification('ALL');
    setSelectedSafe('ALL');
    setSelectedWarehouse('ALL');
    setSearchTerm('');
  };

  // بناء ملخص نصي للفلاتر للطباعة والتصدير
  const filterSummaryString = useMemo(() => {
    const parts: string[] = [`الفترة من ${startDate} إلى ${endDate}`];
    if (selectedVendorObj) parts.push(`المورد: ${selectedVendorObj.name}`);
    if (selectedStatusLabel) parts.push(`الحالة: ${selectedStatusLabel}`);
    if (selectedInvoiceTypeLabel) parts.push(`النوع: ${selectedInvoiceTypeLabel}`);
    if (selectedWarehouseLabel) parts.push(`المستودع: ${selectedWarehouseLabel}`);
    if (selectedClassificationLabel) parts.push(`الضريبة: ${selectedClassificationLabel}`);
    if (minAmount || maxAmount) parts.push(`المبلغ: ${minAmount || '0'} إلى ${maxAmount || '∞'}`);
    return parts.join(' | ');
  }, [startDate, endDate, selectedVendorObj, selectedStatusLabel, selectedInvoiceTypeLabel, selectedWarehouseLabel, selectedClassificationLabel, minAmount, maxAmount]);

  // تصدير Excel
  const handleExportExcel = () => {
    if (filteredInvoices.length === 0) {
      alert('لا توجد بيانات متاحة للتصدير');
      return;
    }

    exportToXLSX({
      filename: `تقرير_إجمالي_فواتير_المشتريات_${startDate}_إلى_${endDate}.xlsx`,
      sheetName: 'فواتير المشتريات',
      title: 'تقرير إجمالي فواتير المشتريات من الموردين',
      subtitle: `الفترة من: ${startDate} إلى: ${endDate}`,
      filterSummary: filterSummaryString,
      headers: [
        'رقم فاتورة الشراء',
        'تاريخ الفاتورة',
        'اسم المورد',
        'المستودع المستلم',
        'نوع التعامل',
        'الضريبة (ر.س)',
        'إجمالي الفاتورة (ر.س)',
        'المسدد (ر.س)',
        'المتبقي / الآجل (ر.س)',
        'الحالة'
      ],
      rows: filteredInvoices.map(inv => [
        inv.invoice_number || inv.id,
        new Date(inv.created_at || inv.date).toLocaleDateString('ar-EG'),
        inv.supplier_name || 'مورد عام',
        inv.warehouse_name === 'MAIN_WAREHOUSE' ? 'المستودع الرئيسي' : (inv.warehouse_name || 'المستودع الرئيسي'),
        inv.payment_type === 'CASH' ? 'نقدي' : inv.payment_type === 'CREDIT' ? 'آجل' : 'دفع جزئي',
        Number(inv.tax_amount || 0).toFixed(2),
        Number(inv.net_amount || 0).toFixed(2),
        Number(inv.paid_amount || 0).toFixed(2),
        Number(inv.remaining_amount || 0).toFixed(2),
        inv.status === 'POSTED' ? 'معتمدة / مرحلة' : inv.status
      ]),
      summaryRows: [
        [
          'الإجمالي العام للفترة',
          `عدد الفواتير: ${summaryStats.invoiceCount}`,
          `الموردين: ${summaryStats.vendorCount}`,
          '-',
          '-',
          summaryStats.totalTax.toFixed(2),
          summaryStats.totalPurchases.toFixed(2),
          summaryStats.totalPaid.toFixed(2),
          summaryStats.totalRemaining.toFixed(2),
          '-'
        ]
      ]
    });
  };

  // تصدير PDF / طباعة
  const handleExportPDF = () => {
    if (filteredInvoices.length === 0) {
      alert('لا توجد بيانات متاحة للطباعة');
      return;
    }

    const printableElement = document.getElementById('printable-purchase-invoices-report');
    if (printableElement) {
      exportToPDF({
        filename: `تقرير_إجمالي_فواتير_المشتريات_${startDate}_إلى_${endDate}.pdf`,
        title: 'تقرير إجمالي فواتير المشتريات من الموردين',
        subtitle: `الفترة من ${startDate} إلى ${endDate} | ${filterSummaryString}`,
        headers: ['رقم الفاتورة', 'التاريخ', 'المورد', 'المستودع', 'النوع', 'الضريبة', 'الإجمالي', 'المسدد', 'المتبقي', 'الحالة'],
        rows: filteredInvoices.map(inv => [
          inv.invoice_number || inv.id,
          new Date(inv.created_at || inv.date).toLocaleDateString('ar-EG'),
          inv.supplier_name || 'مورد عام',
          inv.warehouse_name === 'MAIN_WAREHOUSE' ? 'الرئيسي' : (inv.warehouse_name || 'الرئيسي'),
          inv.payment_type === 'CASH' ? 'نقدي' : inv.payment_type === 'CREDIT' ? 'آجل' : 'جزئي',
          Number(inv.tax_amount || 0).toFixed(2),
          Number(inv.net_amount || 0).toFixed(2),
          Number(inv.paid_amount || 0).toFixed(2),
          Number(inv.remaining_amount || 0).toFixed(2),
          inv.status === 'POSTED' ? 'معتمدة' : inv.status
        ]),
        summaryRows: [
          ['الإجمالي العام', `فواتير: ${summaryStats.invoiceCount}`, `موردين: ${summaryStats.vendorCount}`, '-', '-', summaryStats.totalTax.toFixed(2), summaryStats.totalPurchases.toFixed(2), summaryStats.totalPaid.toFixed(2), summaryStats.totalRemaining.toFixed(2), '-']
        ],
        elementToCapture: printableElement,
        orientation: 'landscape'
      });
    } else {
      window.print();
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen rtl" dir="rtl">
      
      {/* Header with Title and Action Buttons */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
              <Truck size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800">إجمالي فواتير المشتريات</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">حصر وتجميع فواتير المشتريات ومسحوبات الموردين بجميع الفلاتر الرقابية</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('purchasesReportsHub')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer shadow-xs"
            >
              <RotateCcw size={15} />
              <span>مركز تقارير المشتريات</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredInvoices.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <FileSpreadsheet size={16} />
            <span>تصدير Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={filteredInvoices.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <Printer size={16} />
            <span>طباعة / PDF</span>
          </button>
        </div>
      </div>

      {/* Advanced Filter Panel */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-blue-600" />
            <span className="font-bold text-sm text-slate-800">محددات وفلاتر فواتير المشتريات المتقدمة</span>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-black">
                {activeFiltersCount} نشط
              </span>
            )}
          </div>

          {/* Quick Period Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-400 ml-1 font-medium">فترات سريعة:</span>
            {[
              { id: 'today', label: 'اليوم' },
              { id: 'week', label: 'أسبوع' },
              { id: 'month', label: 'هذا الشهر' },
              { id: 'quarter', label: 'هذا الربع' },
              { id: 'year', label: 'هذا العام' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleQuickPeriod(p.id as any)}
                className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-200/80"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* من تاريخ */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Calendar size={13} className="inline ml-1 text-blue-600" />
              من تاريخ
            </label>
            <input 
              type="date" 
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/50" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
            />
          </div>

          {/* إلى تاريخ */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Calendar size={13} className="inline ml-1 text-blue-600" />
              إلى تاريخ
            </label>
            <input 
              type="date" 
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/50" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
            />
          </div>

          {/* المورد */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Truck size={13} className="inline ml-1 text-indigo-600" />
              المورد (Vendor / Supplier)
            </label>
            <select
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-blue-500 bg-slate-50/50"
            >
              <option value="ALL">جميع الموردين ({vendorsList.length})</option>
              {vendorsList.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.code ? `(${v.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* المستودع المستلم */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Warehouse size={13} className="inline ml-1 text-emerald-600" />
              المستودع المستلم
            </label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-blue-500 bg-slate-50/50"
            >
              <option value="ALL">كافة المستودعات والفروع</option>
              {dynamicWarehouses.map(w => (
                <option key={w.id} value={w.id}>{w.label}</option>
              ))}
            </select>
          </div>

          {/* نوع التعامل والسداد */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <CreditCard size={13} className="inline ml-1 text-amber-600" />
              طريقة ونوع التعامل
            </label>
            <select
              value={selectedInvoiceType}
              onChange={(e) => setSelectedInvoiceType(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-blue-500 bg-slate-50/50"
            >
              <option value="ALL">جميع طرق التعامل</option>
              <option value="CASH">مشتريات نقدية (كاش)</option>
              <option value="CREDIT">مشتريات آجلة (ذمم موردين)</option>
              <option value="PARTIAL">مشتريات سداد جزئي</option>
              <option value="PURCHASE_RETURN">مرتجعات مشتريات</option>
            </select>
          </div>

          {/* حالة الفاتورة */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <CheckCircle2 size={13} className="inline ml-1 text-teal-600" />
              حالة الفاتورة والسداد
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-blue-500 bg-slate-50/50"
            >
              <option value="ALL">جميع الحالات</option>
              <option value="POSTED">معتمدة ومرحلة</option>
              <option value="DRAFT">مسودة غير مرحلة</option>
              <option value="PAID">مسددة بالكامل</option>
              <option value="PARTIALLY_PAID">مسددة جزئياً</option>
              <option value="UNPAID">غير مسددة / بالكامل على الحساب</option>
            </select>
          </div>

          {/* التصنيف الضريبي */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Scale size={13} className="inline ml-1 text-purple-600" />
              التصنيف الضريبي
            </label>
            <select
              value={selectedClassification}
              onChange={(e) => setSelectedClassification(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-blue-500 bg-slate-50/50"
            >
              <option value="ALL">الكل (ضريبي ومعفى)</option>
              <option value="TAX">فواتير خاضعة للضريبة (15%)</option>
              <option value="ZERO_OR_EXEMPT">فواتير معفاة / صفرية</option>
            </select>
          </div>

          {/* الخزينة / الحساب المسدد منه */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Landmark size={13} className="inline ml-1 text-cyan-600" />
              خزينة الصرف / البنك
            </label>
            <select
              value={selectedSafe}
              onChange={(e) => setSelectedSafe(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-blue-500 bg-slate-50/50"
            >
              <option value="ALL">كافة الخزائن والحسابات</option>
              {cashBankOptions.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.label}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Second Filter Row: Range + Search + Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          
          {/* Amount range */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-600">نطاق المبلغ:</span>
            <input
              type="number"
              placeholder="من"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="w-24 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 bg-slate-50/50"
            />
            <span className="text-xs text-slate-400">-</span>
            <input
              type="number"
              placeholder="إلى"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              className="w-24 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 bg-slate-50/50"
            />
          </div>

          {/* Search box & Action buttons */}
          <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
            <div className="relative flex-1">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث برقم الفاتورة أو اسم المورد..."
                className="w-full pr-8 pl-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-blue-500 bg-slate-50/50"
              />
            </div>

            <button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {loading ? 'جاري التحديث...' : 'تطبيق'}
            </button>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                title="إعادة ضبط الفلاتر"
              >
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-bold ml-1">الفلاتر المطبقة:</span>
            {selectedVendorObj && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-medium">
                المورد: {selectedVendorObj.name}
                <button type="button" onClick={() => setSelectedVendorId('ALL')} className="hover:text-indigo-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedWarehouseLabel && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-medium">
                المستودع: {selectedWarehouseLabel}
                <button type="button" onClick={() => setSelectedWarehouse('ALL')} className="hover:text-emerald-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedInvoiceTypeLabel && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-medium">
                النوع: {selectedInvoiceTypeLabel}
                <button type="button" onClick={() => setSelectedInvoiceType('ALL')} className="hover:text-amber-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedStatusLabel && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg font-medium">
                الحالة: {selectedStatusLabel}
                <button type="button" onClick={() => setSelectedStatus('ALL')} className="hover:text-teal-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedClassificationLabel && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg font-medium">
                الضريبة: {selectedClassificationLabel}
                <button type="button" onClick={() => setSelectedClassification('ALL')} className="hover:text-purple-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedSafeLabel && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-lg font-medium">
                الخزينة: {selectedSafeLabel}
                <button type="button" onClick={() => setSelectedSafe('ALL')} className="hover:text-cyan-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {(minAmount || maxAmount) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-medium">
                المبلغ: {minAmount || '0'} - {maxAmount || '∞'}
                <button type="button" onClick={() => { setMinAmount(''); setMaxAmount(''); }} className="hover:text-slate-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {searchTerm.trim() && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-medium">
                بحث: "{searchTerm}"
                <button type="button" onClick={() => setSearchTerm('')} className="hover:text-blue-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-rose-600 hover:underline font-bold mr-auto cursor-pointer"
            >
              مسح الكل
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        
        {/* إجمالي المشتريات */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-[11px] font-bold text-slate-500">إجمالي المشتريات</span>
            <DollarSign size={16} />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-800 font-mono">
            {summaryStats.totalPurchases.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-blue-600 font-bold">{currencySymbol} شامل الضريبة</span>
        </div>

        {/* عدد الفواتير */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 mb-1">
            <span className="text-[11px] font-bold text-slate-500">عدد الفواتير</span>
            <Receipt size={16} />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-800 font-mono">
            {summaryStats.invoiceCount}
          </div>
          <span className="text-[10px] text-indigo-600 font-bold">فاتورة شراء</span>
        </div>

        {/* عدد الموردين */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-[11px] font-bold text-slate-500">الموردين</span>
            <Truck size={16} />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-800 font-mono">
            {summaryStats.vendorCount}
          </div>
          <span className="text-[10px] text-emerald-600 font-bold">مورد تم الشراء منه</span>
        </div>

        {/* متوسط قيمة الفاتورة */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-cyan-600 mb-1">
            <span className="text-[11px] font-bold text-slate-500">متوسط الفاتورة</span>
            <Scale size={16} />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-800 font-mono">
            {summaryStats.avgInvoice.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-cyan-600 font-bold">{currencySymbol} / فاتورة</span>
        </div>

        {/* المسدد نقدياً / بنكياً */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-teal-600 mb-1">
            <span className="text-[11px] font-bold text-slate-500">المسدد للموردين</span>
            <Banknote size={16} />
          </div>
          <div className="text-base sm:text-lg font-black text-teal-700 font-mono">
            {summaryStats.totalPaid.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-teal-600 font-bold">{currencySymbol} مدفوع</span>
        </div>

        {/* الآجل / المتبقي */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-[11px] font-bold text-slate-500">الآجل / المستحق</span>
            <Clock size={16} />
          </div>
          <div className="text-base sm:text-lg font-black text-amber-700 font-mono">
            {summaryStats.totalRemaining.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-amber-600 font-bold">{currencySymbol} ذمم موردين</span>
        </div>

      </div>

      {/* Data Table Container */}
      <div id="printable-purchase-invoices-report" ref={reportRef} className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        
        {/* Table Header Controls */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileBarChart size={16} className="text-blue-600" />
            <h2 className="font-black text-sm text-slate-800">
              سجل فواتير المشتريات التفصيلي ({filteredInvoices.length} فاتورة)
            </h2>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
            <span>ترتيب حسب:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border border-slate-200 rounded-lg p-1.5 bg-white text-xs"
            >
              <option value="date">التاريخ</option>
              <option value="amount">مبلغ الفاتورة</option>
              <option value="vendor">اسم المورد</option>
              <option value="number">رقم الفاتورة</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDirection(d => d === 'desc' ? 'asc' : 'desc')}
              className="p-1.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-100 cursor-pointer"
              title={sortDirection === 'desc' ? 'تنازلي' : 'تصاعدي'}
            >
              {sortDirection === 'desc' ? '↓ تنازلي' : '↑ تصاعدي'}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th className="p-3.5">#</th>
                <th className="p-3.5">رقم فاتورة الشراء</th>
                <th className="p-3.5">التاريخ</th>
                <th className="p-3.5">اسم المورد</th>
                <th className="p-3.5">المستودع المستلم</th>
                <th className="p-3.5">طريقة التعامل</th>
                <th className="p-3.5">الضريبة (15%)</th>
                <th className="p-3.5">إجمالي الفاتورة</th>
                <th className="p-3.5">المسدد</th>
                <th className="p-3.5">المتبقي / الآجل</th>
                <th className="p-3.5">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Truck size={36} className="text-slate-300" />
                      <p className="font-bold text-sm text-slate-700">لا توجد فواتير مشتريات مطابقة لشروط الفلترة المحددة</p>
                      <p className="text-xs text-slate-400">جرب تعديل فترة البحث أو مسح بعض الفلاتر لعرض النتائج</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv, idx) => (
                  <tr key={inv.id || inv.invoice_number || idx} className="hover:bg-blue-50/40 transition-colors">
                    <td className="p-3.5 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-3.5 font-mono font-bold text-blue-700">{inv.invoice_number || inv.id}</td>
                    <td className="p-3.5 font-medium text-slate-600">
                      {new Date(inv.created_at || inv.date).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="p-3.5 font-bold text-slate-800">
                      {inv.supplier_name || 'مورد عام'}
                    </td>
                    <td className="p-3.5 text-slate-600">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                        {inv.warehouse_name === 'MAIN_WAREHOUSE' ? 'المستودع الرئيسي' : (inv.warehouse_name || 'المستودع الرئيسي')}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        inv.payment_type === 'CASH' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : inv.payment_type === 'CREDIT' 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-cyan-100 text-cyan-800'
                      }`}>
                        {inv.payment_type === 'CASH' ? 'نقدي' : inv.payment_type === 'CREDIT' ? 'آجل' : 'دفع جزئي'}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-600 font-medium">
                      {Number(inv.tax_amount || 0).toFixed(2)}
                    </td>
                    <td className="p-3.5 font-mono font-black text-blue-800 text-sm">
                      {Number(inv.net_amount || inv.total_amount || 0).toFixed(2)}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-emerald-700">
                      {Number(inv.paid_amount || 0).toFixed(2)}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-amber-700">
                      {Number(inv.remaining_amount || 0).toFixed(2)}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                        inv.status === 'POSTED' || inv.status === 'PAID' || inv.status === 'معتمدة / مرحلة'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {inv.status === 'POSTED' ? 'معتمدة' : inv.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredInvoices.length > 0 && (
              <tfoot className="bg-slate-100 font-black border-t-2 border-slate-300 text-slate-800">
                <tr>
                  <td colSpan={5} className="p-4 text-sm">
                    إجمالي النتائج المفلترة ({filteredInvoices.length} فاتورة شراء)
                  </td>
                  <td className="p-4 text-slate-500 font-normal text-xs">-</td>
                  <td className="p-4 font-mono text-slate-700">{summaryStats.totalTax.toFixed(2)}</td>
                  <td className="p-4 font-mono text-blue-900 text-base">{summaryStats.totalPurchases.toFixed(2)}</td>
                  <td className="p-4 font-mono text-emerald-800">{summaryStats.totalPaid.toFixed(2)}</td>
                  <td className="p-4 font-mono text-amber-800">{summaryStats.totalRemaining.toFixed(2)}</td>
                  <td className="p-4 text-xs text-slate-500 font-normal">{currencySymbol}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  );
};

export default TotalPurchaseInvoices;
