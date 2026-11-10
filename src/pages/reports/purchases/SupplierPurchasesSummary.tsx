import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, 
  Truck, 
  Search, 
  Printer, 
  FileText, 
  RotateCcw, 
  DollarSign, 
  TrendingUp, 
  FileSpreadsheet, 
  Award,
  Users,
  ArrowUpDown,
  Filter,
  Warehouse,
  CreditCard,
  Scale,
  X,
  Building2,
  ChevronDown,
  BarChart3,
  Percent
} from 'lucide-react';
import { supabase } from '../../../services/supabaseClient';
import { loadStoredPurchaseInvoices } from '../../../utils/purchasesStore';
import { loadVendors } from '../../../utils/partnerLedger';
import { exportToXLSX, exportToPDF } from '../../../utils/universalExport';
import { useSystemCurrency } from '../../../utils/currency';
import { getDynamicWarehousesList, getWarehouseLabel } from '../../../utils/itemsStore';

interface SupplierPurchasesSummaryProps {
  onNavigate?: (view: string | null) => void;
}

interface RawInvoiceItem {
  id: string;
  invoice_number: string;
  vendor_id?: string;
  supplier_id?: string;
  supplier_name: string;
  created_at: string;
  date: string;
  net_amount: number;
  tax_amount: number;
  payment_type: string;
  warehouse_name: string;
}

export interface SupplierGroupRow {
  supplierId: string;
  supplierName: string;
  supplierCode?: string;
  phone?: string;
  invoiceCount: number;
  totalPurchases: number;
  totalTax: number;
  averageInvoiceValue: number;
  purchasesPercentage: number;
  rank: number;
}

export const SupplierPurchasesSummary: React.FC<SupplierPurchasesSummaryProps> = ({ onNavigate }) => {
  const { symbol: currencySymbol } = useSystemCurrency();
  const todayStr = new Date().toISOString().substring(0, 10);
  
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // أول الشهر الحالي افتراضياً
    return d.toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(todayStr);

  // الفلاتر المتقدمة
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [selectedPaymentType, setSelectedPaymentType] = useState<string>('ALL');
  const [selectedClassification, setSelectedClassification] = useState<string>('ALL');
  const [minPurchases, setMinPurchases] = useState<string>('');

  const [rawInvoices, setRawInvoices] = useState<RawInvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'purchases' | 'invoices' | 'name'>('purchases');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // جلب قائمة الموردين لمطابقة الأكواد وبيانات الاتصال
  const allVendors = useMemo(() => {
    try {
      return loadVendors();
    } catch {
      return [];
    }
  }, []);

  // تنفيذ الاستعلام
  const handleSearch = async () => {
    if (!startDate || !endDate) {
      alert('يرجى تحديد فترة البحث (من تاريخ / إلى تاريخ)');
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      let { data, error } = await supabase
        .from('purchase_invoices')
        .select(`
          id,
          invoice_number,
          vendor_id,
          supplier_id,
          supplier_name,
          vendor_name,
          net_amount,
          total_amount,
          grand_total,
          tax_amount,
          vat_total,
          payment_type,
          warehouse_name,
          created_at,
          status,
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

      let parsedInvoices: RawInvoiceItem[] = [];

      if (error || !data || data.length === 0) {
        const localInvoices = loadStoredPurchaseInvoices();
        const filtered = localInvoices.filter((inv: any) => {
          const invDate = inv.date || inv.createdAt?.substring(0, 10);
          return invDate >= startDate && invDate <= endDate;
        });

        parsedInvoices = filtered.map((inv: any) => {
          const matchedVendor = allVendors.find(v => v.id === inv.partnerId || v.name === inv.partnerName);
          const supplierName = inv.partnerName || matchedVendor?.name || 'مورد نقدي / عام';
          const netAmount = Number(inv.totals?.grandTotal || inv.net_amount || inv.total_amount || 0);
          const taxAmount = Number(inv.totals?.vatTotal || inv.totals?.taxTotal || inv.tax_amount || 0);

          return {
            id: inv.id,
            invoice_number: inv.invoiceNumber || inv.id,
            vendor_id: inv.partnerId,
            supplier_id: inv.partnerId,
            supplier_name: supplierName,
            created_at: inv.date || inv.createdAt,
            date: inv.date || inv.createdAt?.substring(0, 10),
            net_amount: netAmount,
            tax_amount: taxAmount,
            payment_type: inv.paymentMethod || inv.paymentType || 'CASH',
            warehouse_name: inv.warehouseName || inv.warehouse || 'MAIN_WAREHOUSE'
          };
        });
      } else {
        parsedInvoices = (data || []).map((inv: any) => {
          const supplierName = inv.supplier_name || 
                               inv.vendor_name || 
                               inv.vendors?.name || 
                               inv.suppliers?.name || 
                               inv.customer_name || 
                               allVendors.find(v => v.id === (inv.vendor_id || inv.supplier_id))?.name || 
                               'مورد عام';

          const netAmount = Number(inv.net_amount || inv.total_amount || inv.grand_total || 0);
          const taxAmount = Number(inv.tax_amount || inv.vat_total || 0);

          return {
            id: inv.id,
            invoice_number: inv.invoice_number || inv.invoiceNumber || inv.id,
            vendor_id: inv.vendor_id,
            supplier_id: inv.supplier_id,
            supplier_name: supplierName,
            created_at: inv.created_at,
            date: inv.created_at?.substring(0, 10),
            net_amount: netAmount,
            tax_amount: taxAmount,
            payment_type: inv.payment_type || 'CASH',
            warehouse_name: inv.warehouse_name || 'MAIN_WAREHOUSE'
          };
        });
      }

      setRawInvoices(parsedInvoices);
    } catch (err) {
      console.error('Error in handleSearch:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSearch();
  }, []);

  // فلاتر التواريخ السريعة
  const setQuickRange = (type: 'today' | 'week' | 'month' | 'quarter' | 'year') => {
    const now = new Date();
    const end = todayStr;
    let start = todayStr;

    if (type === 'today') {
      start = todayStr;
    } else if (type === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      start = d.toISOString().substring(0, 10);
    } else if (type === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().substring(0, 10);
    } else if (type === 'quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), qMonth, 1).toISOString().substring(0, 10);
    } else if (type === 'year') {
      start = new Date(now.getFullYear(), 0, 1).toISOString().substring(0, 10);
    }

    setStartDate(start);
    setEndDate(end);
  };

  // تصفية وتجميع البيانات حسب الموردين
  const reportData = useMemo(() => {
    // 1. تصفية الفواتير الخام
    const filtered = rawInvoices.filter(inv => {
      // فلتر المورد المحدد
      if (selectedSupplierId !== 'ALL') {
        const matchesId = inv.vendor_id === selectedSupplierId || inv.supplier_id === selectedSupplierId;
        const matchedVendorObj = allVendors.find(v => v.id === selectedSupplierId);
        const matchesName = matchedVendorObj && (inv.supplier_name || '').toLowerCase().includes((matchedVendorObj.name || '').toLowerCase());
        if (!matchesId && !matchesName) return false;
      }

      // فلتر المستودع
      if (selectedWarehouse !== 'ALL') {
        const wh = (inv.warehouse_name || '').toUpperCase();
        const targetWh = selectedWarehouse.toUpperCase();
        if (targetWh === 'MAIN_WAREHOUSE') {
          if (!wh.includes('MAIN') && !wh.includes('رئيسي')) return false;
        } else if (wh !== targetWh && getWarehouseLabel(inv.warehouse_name) !== getWarehouseLabel(selectedWarehouse)) {
          return false;
        }
      }

      // فلتر نوع التعامل
      if (selectedPaymentType !== 'ALL') {
        const pType = (inv.payment_type || '').toUpperCase();
        if (selectedPaymentType === 'CASH' && pType !== 'CASH') return false;
        if (selectedPaymentType === 'CREDIT' && pType !== 'CREDIT') return false;
      }

      // فلتر التصنيف الضريبي
      if (selectedClassification !== 'ALL') {
        if (selectedClassification === 'TAX' && inv.tax_amount <= 0) return false;
        if (selectedClassification === 'EXEMPT' && inv.tax_amount > 0) return false;
      }

      return true;
    });

    // 2. تجميع البيانات حسب المورد
    const groupedMap: Record<string, SupplierGroupRow> = {};

    filtered.forEach(inv => {
      const matchedVendor = allVendors.find(v => 
        v.id === (inv.vendor_id || inv.supplier_id) || 
        v.name === inv.supplier_name
      );

      const key = inv.vendor_id || inv.supplier_id || inv.supplier_name;
      const name = inv.supplier_name || matchedVendor?.name || 'مورد عام';
      const code = matchedVendor?.code;
      const phone = matchedVendor?.phone;

      if (!groupedMap[key]) {
        groupedMap[key] = {
          supplierId: key,
          supplierName: name,
          supplierCode: code,
          phone: phone,
          invoiceCount: 0,
          totalPurchases: 0,
          totalTax: 0,
          averageInvoiceValue: 0,
          purchasesPercentage: 0,
          rank: 0
        };
      }

      groupedMap[key].invoiceCount += 1;
      groupedMap[key].totalPurchases += (inv as any).net_amount || 0;
      groupedMap[key].totalTax += (inv as any).tax_amount || 0;
    });

    let list = Object.values(groupedMap);

    // فلتر الحد الأدنى للمشتريات
    if (minPurchases && parseFloat(minPurchases) > 0) {
      const minVal = parseFloat(minPurchases);
      list = list.filter(item => item.totalPurchases >= minVal);
    }

    const totalPeriodPurchases = list.reduce((sum, s) => sum + s.totalPurchases, 0);

    return list
      .map(s => ({
        ...s,
        averageInvoiceValue: s.invoiceCount > 0 ? s.totalPurchases / s.invoiceCount : 0,
        purchasesPercentage: totalPeriodPurchases > 0 ? (s.totalPurchases / totalPeriodPurchases) * 100 : 0
      }))
      .sort((a, b) => b.totalPurchases - a.totalPurchases)
      .map((s, idx) => ({ ...s, rank: idx + 1 }));

  }, [rawInvoices, selectedSupplierId, selectedWarehouse, selectedPaymentType, selectedClassification, minPurchases, allVendors]);

  // المجاميع الإجمالية
  const grandTotalPurchases = useMemo(() => reportData.reduce((sum, r) => sum + r.totalPurchases, 0), [reportData]);
  const grandTotalInvoices = useMemo(() => reportData.reduce((sum, r) => sum + r.invoiceCount, 0), [reportData]);
  const grandTotalTax = useMemo(() => reportData.reduce((sum, r) => sum + r.totalTax, 0), [reportData]);
  const totalSuppliersCount = reportData.length;
  const overallAvgInvoice = grandTotalInvoices > 0 ? grandTotalPurchases / grandTotalInvoices : 0;
  const topSupplier = reportData.length > 0 ? reportData[0] : null;

  // عدد الفلاتر النشطة
  const activeFiltersCount = useMemo(() => {
    let c = 0;
    if (selectedSupplierId !== 'ALL') c++;
    if (selectedWarehouse !== 'ALL') c++;
    if (selectedPaymentType !== 'ALL') c++;
    if (selectedClassification !== 'ALL') c++;
    if (minPurchases) c++;
    if (searchTerm.trim()) c++;
    return c;
  }, [selectedSupplierId, selectedWarehouse, selectedPaymentType, selectedClassification, minPurchases, searchTerm]);

  // إعادة ضبط الفلاتر
  const handleResetFilters = () => {
    setSelectedSupplierId('ALL');
    setSelectedWarehouse('ALL');
    setSelectedPaymentType('ALL');
    setSelectedClassification('ALL');
    setMinPurchases('');
    setSearchTerm('');
  };

  // تصفية وترتيب القائمة المعروضة
  const filteredAndSortedList = useMemo(() => {
    let result = reportData.filter(row => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (row.supplierName || '').toLowerCase().includes(term) ||
        (row.supplierCode && (row.supplierCode || '').toLowerCase().includes(term)) ||
        (row.phone && row.phone.includes(term))
      );
    });

    result.sort((a, b) => {
      let valA: any = a.totalPurchases;
      let valB: any = b.totalPurchases;

      if (sortBy === 'invoices') {
        valA = a.invoiceCount;
        valB = b.invoiceCount;
      } else if (sortBy === 'name') {
        valA = a.supplierName;
        valB = b.supplierName;
      }

      if (sortDirection === 'asc') {
        return valA > valB ? 1 : -1;
      }
      return valA < valB ? 1 : -1;
    });

    return result;
  }, [reportData, searchTerm, sortBy, sortDirection]);

  // تبديل الترتيب
  const toggleSort = (column: 'purchases' | 'invoices' | 'name') => {
    if (sortBy === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  // تصدير Excel
  const handleExportExcel = () => {
    if (reportData.length === 0) {
      alert('لا توجد بيانات متاحة للتصدير');
      return;
    }

    exportToXLSX({
      filename: `تقرير_إجمالي_مشتريات_الموردين_${startDate}_إلى_${endDate}.xlsx`,
      sheetName: 'مشتريات الموردين',
      title: 'تقرير إجمالي مسحوبات ومشتريات الموردين',
      subtitle: `الفترة من: ${startDate} إلى: ${endDate}`,
      filterSummary: `الفترة: ${startDate} إلى ${endDate} | عدد الموردين: ${totalSuppliersCount} | إجمالي المشتريات: ${grandTotalPurchases.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ر.س`,
      headers: [
        'الترتيب',
        'اسم المورد',
        'كود المورد',
        'عدد فواتير المشتريات',
        'متوسط قيمة الفاتورة (ر.س)',
        'إجمالي الضريبة (ر.س)',
        'إجمالي المشتريات (ر.س)',
        'النسبة من الإجمالي %'
      ],
      rows: filteredAndSortedList.map(r => [
        r.rank,
        r.supplierName,
        r.supplierCode || '-',
        r.invoiceCount,
        r.averageInvoiceValue.toFixed(2),
        r.totalTax.toFixed(2),
        r.totalPurchases.toFixed(2),
        `${r.purchasesPercentage.toFixed(1)}%`
      ]),
      summaryRows: [
        [
          'الإجمالي الكلي',
          `عدد الموردين: ${totalSuppliersCount}`,
          '-',
          grandTotalInvoices,
          overallAvgInvoice.toFixed(2),
          grandTotalTax.toFixed(2),
          grandTotalPurchases.toFixed(2),
          '100.0%'
        ]
      ]
    });
  };

  // تصدير PDF / طباعة
  const handleExportPDF = () => {
    if (reportData.length === 0) {
      alert('لا توجد بيانات متاحة للطباعة');
      return;
    }

    const printableElement = document.getElementById('printable-supplier-purchases-report');
    if (printableElement) {
      exportToPDF({
        filename: `تقرير_مشتريات_الموردين_${startDate}_إلى_${endDate}.pdf`,
        title: 'تقرير إجمالي مسحوبات ومشتريات الموردين',
        subtitle: `الفترة من ${startDate} إلى ${endDate}`,
        headers: ['#', 'اسم المورد', 'كود المورد', 'عدد الفواتير', 'متوسط الفاتورة', 'الضريبة', 'إجمالي المشتريات', 'النسبة %'],
        rows: filteredAndSortedList.map(r => [
          r.rank,
          r.supplierName,
          r.supplierCode || '-',
          r.invoiceCount,
          r.averageInvoiceValue.toFixed(2),
          r.totalTax.toFixed(2),
          r.totalPurchases.toFixed(2),
          `${r.purchasesPercentage.toFixed(1)}%`
        ]),
        summaryRows: [
          ['الإجمالي', `موردين: ${totalSuppliersCount}`, '-', grandTotalInvoices, overallAvgInvoice.toFixed(2), grandTotalTax.toFixed(2), grandTotalPurchases.toFixed(2), '100%']
        ],
        elementToCapture: printableElement,
        orientation: 'landscape'
      });
    } else {
      window.print();
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-slate-50 min-h-screen rtl text-slate-800" dir="rtl">
      
      {/* 1. Header Banner & Title */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600">
              <Truck size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800">تقرير إجمالي مشتريات ومسحوبات الموردين</h1>
              <p className="text-xs text-slate-500 font-medium">تحليل حجم التعاملات الشرائية وتصنيف الموردين حسب إجمالي المسحوبات والفروع</p>
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
            disabled={reportData.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <FileSpreadsheet size={16} />
            <span>تصدير Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={reportData.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <Printer size={16} />
            <span>طباعة / PDF</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-teal-600" />
            <span className="font-bold text-sm text-slate-800">محددات وفلاتر مشتريات الموردين</span>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 text-xs font-black">
                {activeFiltersCount} نشط
              </span>
            )}
          </div>

          {/* Quick Date Range Buttons */}
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
                onClick={() => setQuickRange(p.id as any)}
                className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-teal-50 hover:text-teal-600 text-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-200/80"
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
              <Calendar size={13} className="inline ml-1 text-teal-600" />
              من تاريخ
            </label>
            <input 
              type="date" 
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-teal-500 bg-slate-50/50" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
            />
          </div>

          {/* إلى تاريخ */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Calendar size={13} className="inline ml-1 text-teal-600" />
              إلى تاريخ
            </label>
            <input 
              type="date" 
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-teal-500 bg-slate-50/50" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
            />
          </div>

          {/* المورد */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Truck size={13} className="inline ml-1 text-indigo-600" />
              المورد المحدد
            </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-teal-500 bg-slate-50/50"
            >
              <option value="ALL">جميع الموردين ({allVendors.length})</option>
              {allVendors.map(v => (
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
              المستودع / الفرع المستلم
            </label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-teal-500 bg-slate-50/50"
            >
              <option value="ALL">كافة المستودعات والفروع</option>
              {getDynamicWarehousesList([selectedWarehouse !== 'ALL' ? selectedWarehouse : '']).map(w => (
                <option key={w.id} value={w.id}>{w.label}</option>
              ))}
            </select>
          </div>

          {/* نوع التعامل */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <CreditCard size={13} className="inline ml-1 text-amber-600" />
              نوع التعامل (نقدي / آجل)
            </label>
            <select
              value={selectedPaymentType}
              onChange={(e) => setSelectedPaymentType(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-teal-500 bg-slate-50/50"
            >
              <option value="ALL">الكل (نقدي وآجل)</option>
              <option value="CASH">مشتريات نقدية فقط</option>
              <option value="CREDIT">مشتريات آجلة فقط</option>
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
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-teal-500 bg-slate-50/50"
            >
              <option value="ALL">الكل (ضريبي ومعفى)</option>
              <option value="TAX">فواتير ضريبية فقط (15%)</option>
              <option value="EXEMPT">فواتير معفاة / صفرية</option>
            </select>
          </div>

          {/* الحد الأدنى للمشتريات */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <DollarSign size={13} className="inline ml-1 text-cyan-600" />
              الحد الأدنى للمشتريات
            </label>
            <input
              type="number"
              placeholder="مثال: 1000"
              value={minPurchases}
              onChange={(e) => setMinPurchases(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-teal-500 bg-slate-50/50"
            />
          </div>

          {/* البحث النصي والتطبيق */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Search size={13} className="inline ml-1 text-slate-400" />
              بحث فوري باسم المورد أو الكود
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="بحث..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-teal-500 bg-slate-50/50"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={loading}
                className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
              >
                {loading ? 'جاري...' : 'تحديث'}
              </button>
            </div>
          </div>

        </div>

        {/* Active Filter Chips */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-bold ml-1">الفلاتر المطبقة:</span>
            {selectedSupplierId !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-medium">
                المورد: {allVendors.find(v => v.id === selectedSupplierId)?.name || selectedSupplierId}
                <button type="button" onClick={() => setSelectedSupplierId('ALL')} className="hover:text-indigo-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedWarehouse !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-medium">
                المستودع: {selectedWarehouse === 'MAIN_WAREHOUSE' ? 'المستودع الرئيسي' : selectedWarehouse}
                <button type="button" onClick={() => setSelectedWarehouse('ALL')} className="hover:text-emerald-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedPaymentType !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-medium">
                النوع: {selectedPaymentType === 'CASH' ? 'نقدي' : 'آجل'}
                <button type="button" onClick={() => setSelectedPaymentType('ALL')} className="hover:text-amber-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedClassification !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg font-medium">
                الضريبة: {selectedClassification === 'TAX' ? 'ضريبي 15%' : 'معفى'}
                <button type="button" onClick={() => setSelectedClassification('ALL')} className="hover:text-purple-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {minPurchases && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-lg font-medium">
                الحد الأدنى: {minPurchases} ر.س
                <button type="button" onClick={() => setMinPurchases('')} className="hover:text-cyan-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {searchTerm.trim() && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-medium">
                بحث: "{searchTerm}"
                <button type="button" onClick={() => setSearchTerm('')} className="hover:text-slate-900 cursor-pointer"><X size={12} /></button>
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

      {/* 3. KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        
        {/* إجمالي المشتريات */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-teal-600 mb-2">
            <span className="text-xs font-bold text-slate-500">إجمالي مشتريات الموردين</span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
            {grandTotalPurchases.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-teal-600 font-bold">{currencySymbol} خلال الفترة المحددة</span>
        </div>

        {/* عدد الموردين */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 mb-2">
            <span className="text-xs font-bold text-slate-500">عدد الموردين النشطين</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Users size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
            {totalSuppliersCount}
          </div>
          <span className="text-xs text-indigo-600 font-bold">مورد تم الشراء منه</span>
        </div>

        {/* عدد الفواتير */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-bold text-slate-500">إجمالي فواتير الشراء</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <FileText size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
            {grandTotalInvoices}
          </div>
          <span className="text-xs text-blue-600 font-bold">متوسط الفاتورة: {overallAvgInvoice.toFixed(2)} {currencySymbol}</span>
        </div>

        {/* المورد الأعلى مسحوبات */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold text-slate-500">المورد الأعلى مسحوبات</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Award size={18} />
            </div>
          </div>
          <div className="text-base font-black text-slate-800 truncate" title={topSupplier?.supplierName || '-'}>
            {topSupplier?.supplierName || 'لا يوجد'}
          </div>
          <span className="text-xs text-amber-600 font-bold">
            {topSupplier ? `${topSupplier.totalPurchases.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ${currencySymbol} (${topSupplier.purchasesPercentage.toFixed(1)}%)` : '-'}
          </span>
        </div>

      </div>

      {/* 4. Visual Bar Distribution for Top 5 Suppliers */}
      {reportData.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-teal-600" />
            <h3 className="text-sm font-black text-slate-800">توزيع الحصة الشرائية لأبرز الموردين</h3>
          </div>
          <div className="space-y-3">
            {reportData.slice(0, 5).map((sup, idx) => (
              <div key={sup.supplierId || idx}>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>#{sup.rank} {sup.supplierName}</span>
                  <span className="font-mono text-teal-700">{sup.totalPurchases.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {currencySymbol} ({sup.purchasesPercentage.toFixed(1)}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(2, sup.purchasesPercentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Data Table */}
      <div id="printable-supplier-purchases-report" className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-teal-600" />
            <h2 className="font-black text-sm text-slate-800">
              قائمة مشتريات ومسحوبات الموردين ({filteredAndSortedList.length} مورد)
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th className="p-3.5 w-16">#</th>
                <th 
                  className="p-3.5 cursor-pointer hover:bg-slate-200/60 transition"
                  onClick={() => toggleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    <span>اسم المورد</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5">كود المورد</th>
                <th 
                  className="p-3.5 cursor-pointer hover:bg-slate-200/60 transition"
                  onClick={() => toggleSort('invoices')}
                >
                  <div className="flex items-center gap-1">
                    <span>عدد الفواتير</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5">متوسط الفاتورة</th>
                <th className="p-3.5">إجمالي الضريبة</th>
                <th 
                  className="p-3.5 cursor-pointer hover:bg-slate-200/60 transition"
                  onClick={() => toggleSort('purchases')}
                >
                  <div className="flex items-center gap-1">
                    <span>إجمالي المشتريات</span>
                    <ArrowUpDown size={12} className="text-teal-600" />
                  </div>
                </th>
                <th className="p-3.5">نسبة المساهمة %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSortedList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Truck size={36} className="text-slate-300" />
                      <p className="font-bold text-sm text-slate-700">لا توجد بيانات مشتريات موردين مطابقة للبحث</p>
                      <p className="text-xs text-slate-400">يرجى تعديل شروط الفلترة أو النطاق الزمني</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedList.map((row) => (
                  <tr key={row.supplierId} className="hover:bg-teal-50/40 transition-colors">
                    <td className="p-3.5 font-mono text-slate-400 font-bold">
                      <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs ${
                        row.rank === 1 ? 'bg-amber-100 text-amber-800 font-black' :
                        row.rank === 2 ? 'bg-slate-200 text-slate-700 font-bold' :
                        row.rank === 3 ? 'bg-amber-50 text-amber-700 font-bold' : 'text-slate-500'
                      }`}>
                        {row.rank}
                      </span>
                    </td>
                    <td className="p-3.5 font-black text-slate-800">
                      {row.supplierName}
                      {row.phone && <span className="block text-[10px] text-slate-400 font-normal">{row.phone}</span>}
                    </td>
                    <td className="p-3.5 font-mono text-slate-500">{row.supplierCode || '-'}</td>
                    <td className="p-3.5 font-mono font-bold text-slate-700">{row.invoiceCount}</td>
                    <td className="p-3.5 font-mono text-slate-600">{row.averageInvoiceValue.toFixed(2)}</td>
                    <td className="p-3.5 font-mono text-slate-600">{row.totalTax.toFixed(2)}</td>
                    <td className="p-3.5 font-mono font-black text-teal-800 text-sm">
                      {row.totalPurchases.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-700">{row.purchasesPercentage.toFixed(1)}%</span>
                        <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-teal-500 h-full rounded-full" 
                            style={{ width: `${Math.min(100, row.purchasesPercentage)}%` }} 
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredAndSortedList.length > 0 && (
              <tfoot className="bg-slate-100 font-black border-t-2 border-slate-300 text-slate-800">
                <tr>
                  <td colSpan={3} className="p-4 text-sm">
                    الإجمالي العام ({totalSuppliersCount} مورد)
                  </td>
                  <td className="p-4 font-mono">{grandTotalInvoices}</td>
                  <td className="p-4 font-mono">{overallAvgInvoice.toFixed(2)}</td>
                  <td className="p-4 font-mono">{grandTotalTax.toFixed(2)}</td>
                  <td className="p-4 font-mono text-teal-900 text-base">{grandTotalPurchases.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="p-4 font-mono text-slate-600">100.0%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  );
};

export default SupplierPurchasesSummary;
