import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Users, 
  Search, 
  Printer, 
  FileText, 
  RotateCcw, 
  DollarSign, 
  TrendingUp, 
  FileSpreadsheet,
  Award,
  Filter,
  Warehouse,
  Receipt,
  Scale,
  Landmark,
  Briefcase,
  UserCheck,
  X,
  CheckCircle
} from 'lucide-react';
import { loadCustomers } from '../../../utils/partnerLedger';
import { exportToXLSX, exportToPDF } from '../../../utils/universalExport';
import { getUnifiedSalesInvoices, getDynamicSalesRepsList, doesInvoiceMatchSalesRep } from '../../../utils/salesReportsUnifiedStore';
import { loadChartOfAccounts } from '../../../utils/trialBalanceStore';
import { isCashOrBankAccount } from '../../../utils/accountingIntegration';
import { getDynamicWarehousesList, getWarehouseLabel } from '../../../utils/itemsStore';

interface CustomerSalesSummaryProps {
  onNavigate?: (view: string | null) => void;
}

interface CustomerGroupRow {
  customerId: string;
  customerName: string;
  customerCode?: string | undefined;
  phone?: string | undefined;
  invoiceCount: number;
  totalSales: number;
  averageInvoiceValue: number;
  salesPercentage: number;
  rank: number;
}

export const CustomerSalesSummary: React.FC<CustomerSalesSummaryProps> = ({ onNavigate }) => {
  const todayStr = new Date().toISOString().substring(0, 10);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // أول الشهر الحالي افتراضياً
    return d.toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [reportData, setReportData] = useState<CustomerGroupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // الفلاتر المتقدمة
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [selectedInvoiceType, setSelectedInvoiceType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedClassification, setSelectedClassification] = useState<string>('ALL');
  const [selectedServiceType, setSelectedServiceType] = useState<string>('ALL');
  const [selectedSafe, setSelectedSafe] = useState<string>('ALL');
  const [selectedSalesRep, setSelectedSalesRep] = useState<string>('ALL');

  // جلب قائمة العملاء لمطابقة الأكواد وبيانات الاتصال
  const allCustomers = useMemo(() => {
    try {
      return loadCustomers();
    } catch {
      return [];
    }
  }, []);

  const cashBankOptions = useMemo(() => {
    const chart = loadChartOfAccounts();
    return chart.filter(a => isCashOrBankAccount(a, chart)).map(a => ({ id: a.code || a.id, label: `${a.code} - ${a.name}` }));
  }, []);

  const dynamicWarehouses = useMemo(() => {
    return getDynamicWarehousesList([selectedSource !== 'ALL' ? selectedSource : '']);
  }, [selectedSource]);

  // تسميات الفلاتر النشطة
  const selectedSourceLabel = useMemo(() => {
    if (selectedSource === 'ALL') return null;
    return getWarehouseLabel(selectedSource);
  }, [selectedSource]);

  const selectedInvoiceTypeLabel = useMemo(() => {
    switch (selectedInvoiceType) {
      case 'CASH_SALES': return 'مبيعات نقدية (كاش)';
      case 'CREDIT_SALES': return 'مبيعات آجلة (ذمم)';
      case 'RETURNS': return 'مرتجعات المبيعات';
      default: return null;
    }
  }, [selectedInvoiceType]);

  const selectedStatusLabel = useMemo(() => {
    switch (selectedStatus) {
      case 'POSTED': return 'معتمدة / مرحلة';
      case 'DRAFT': return 'مسودة';
      case 'PAID': return 'مسددة بالكامل';
      case 'PARTIAL': return 'مسددة جزئياً';
      case 'UNPAID': return 'غير مسددة (مستحقة)';
      default: return null;
    }
  }, [selectedStatus]);

  const selectedClassificationLabel = useMemo(() => {
    switch (selectedClassification) {
      case 'TAX': return 'فواتير ضريبية (VAT)';
      case 'NORMAL': return 'فواتير عادية / مبسطة';
      default: return null;
    }
  }, [selectedClassification]);

  const selectedServiceTypeLabel = useMemo(() => {
    switch (selectedServiceType) {
      case 'NONE': return 'بضائع وسلع فقط (بدون خدمة)';
      case 'استشارات': return 'استشارات';
      case 'تصميم': return 'تصميم';
      case 'برمجة': return 'برمجة وحلول تقنية';
      case 'صيانة': return 'صيانة';
      case 'تركيب': return 'تركيب وتجهيز';
      case 'دعم فني': return 'دعم فني';
      case 'خدمات عامة': return 'خدمات عامة';
      default: return selectedServiceType !== 'ALL' ? selectedServiceType : null;
    }
  }, [selectedServiceType]);

  const selectedSafeLabel = useMemo(() => {
    if (selectedSafe === 'ALL') return null;
    const found = cashBankOptions.find(a => a.id === selectedSafe);
    if (found) return found.label;
    return selectedSafe;
  }, [selectedSafe, cashBankOptions]);

  const salesRepsList = useMemo(() => getDynamicSalesRepsList(), []);

  const selectedSalesRepLabel = useMemo(() => {
    if (selectedSalesRep === 'ALL') return null;
    const found = salesRepsList.find(r => r.id === selectedSalesRep);
    return found ? found.label : selectedSalesRep;
  }, [selectedSalesRep, salesRepsList]);

  // المجاميع الإجمالية
  const grandTotalSales = reportData.reduce((sum, r) => sum + r.totalSales, 0);
  const grandTotalInvoices = reportData.reduce((sum, r) => sum + r.invoiceCount, 0);
  const totalCustomersCount = reportData.length;
  const overallAvgInvoice = grandTotalInvoices > 0 ? grandTotalSales / grandTotalInvoices : 0;

  // إعادة ضبط جميع الفلاتر
  const handleResetFilters = () => {
    setSelectedSource('ALL');
    setSelectedInvoiceType('ALL');
    setSelectedStatus('ALL');
    setSelectedClassification('ALL');
    setSelectedServiceType('ALL');
    setSelectedSafe('ALL');
    setSelectedSalesRep('ALL');
    setSearchTerm('');
  };

  // تنفيذ الاستعلام ومنطق التجميع (Grouping Logic)
  const handleSearch = async () => {
    if (!startDate || !endDate) {
      alert('يرجى تحديد فترة البحث (من تاريخ / إلى تاريخ)');
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const allInvoices = await getUnifiedSalesInvoices();

      const filteredInvoices = allInvoices.filter(inv => {
        const invDate = (inv.date || inv.createdAt || '').substring(0, 10);
        const inDateRange = invDate >= startDate && invDate <= endDate;
        if (!inDateRange) return false;

        // فلتر 1: مستودع التوريد والفرع
        if (selectedSource !== 'ALL') {
          const currentSource = (inv.source || 'MAIN_WAREHOUSE').toUpperCase();
          if (currentSource !== selectedSource.toUpperCase()) return false;
        }

        // فلتر 2: نوع الفاتورة وطريقة الدفع
        if (selectedInvoiceType !== 'ALL') {
          const t = (inv.invoiceType || '').toUpperCase();
          if (selectedInvoiceType === 'CASH_SALES' && !t.includes('CASH') && inv.paymentStatus !== 'PAID') return false;
          if (selectedInvoiceType === 'CREDIT_SALES' && !t.includes('CREDIT') && inv.paymentStatus !== 'UNPAID') return false;
          if (selectedInvoiceType === 'RETURNS' && !inv.isReturn && !t.includes('RETURN') && !t.includes('مرتجع')) return false;
        }

        // فلتر 3: حالة الفاتورة وحالة السداد
        if (selectedStatus !== 'ALL') {
          if (selectedStatus === 'POSTED' && inv.statusCode !== 'POSTED') return false;
          if (selectedStatus === 'DRAFT' && inv.statusCode !== 'DRAFT') return false;
          if (selectedStatus === 'PAID' && inv.paymentStatus !== 'PAID') return false;
          if (selectedStatus === 'PARTIAL' && inv.paymentStatus !== 'PARTIAL') return false;
          if (selectedStatus === 'UNPAID' && inv.paymentStatus !== 'UNPAID') return false;
        }

        // فلتر 4: التصنيف الضريبي
        if (selectedClassification !== 'ALL') {
          const isTax = inv.classification === 'TAX' || inv.totals.taxTotal > 0;
          if (selectedClassification === 'TAX' && !isTax) return false;
          if (selectedClassification === 'NORMAL' && isTax) return false;
        }

        // فلتر 5: نوع الخدمة والنشاط
        if (selectedServiceType !== 'ALL') {
          const currentService = (inv.serviceType || '').trim();
          if (selectedServiceType === 'NONE') {
            if (currentService && currentService !== '-- بدون خدمة محددة --') return false;
          } else {
            if (selectedServiceType && !currentService.toLowerCase().includes(selectedServiceType.toLowerCase())) return false;
          }
        }

        // فلتر 6: خزينة التحصيل
        if (selectedSafe !== 'ALL') {
          const currentSafe = (inv.safe || 'MAIN_SAFE').toUpperCase();
          if (currentSafe !== selectedSafe.toUpperCase()) return false;
        }

        // فلتر 7: مندوب المبيعات ومنشئ الفاتورة
        if (!doesInvoiceMatchSalesRep(inv.salesRepName, selectedSalesRep)) return false;

        return true;
      });

      const groupedMap: Record<string, CustomerGroupRow> = {};
      
      filteredInvoices.forEach(inv => {
        const key = inv.partnerId || inv.partnerName || 'عميل نقدي';
        const name = inv.partnerName || 'عميل نقدي';
        const amount = Number(inv.totals.grandTotal || 0);

        if (!groupedMap[key]) {
          const matchedCustomer = allCustomers.find(c => c.id === inv.partnerId || c.name === inv.partnerName);
          groupedMap[key] = {
            customerId: inv.partnerId || key,
            customerName: name,
            customerCode: matchedCustomer?.code || inv.customerCode,
            phone: matchedCustomer?.phone || inv.phone,
            invoiceCount: 0,
            totalSales: 0,
            averageInvoiceValue: 0,
            salesPercentage: 0,
            rank: 0
          };
        }

        const entry = groupedMap[key]!;
        entry.invoiceCount += 1;
        entry.totalSales += amount;
      });

      const totalPeriodSales = Object.values(groupedMap).reduce((sum, c) => sum + c.totalSales, 0);

      const sortedList: CustomerGroupRow[] = Object.values(groupedMap)
        .map(c => ({
          ...c,
          averageInvoiceValue: c.invoiceCount > 0 ? c.totalSales / c.invoiceCount : 0,
          salesPercentage: totalPeriodSales > 0 ? (c.totalSales / totalPeriodSales) * 100 : 0
        }))
        .sort((a, b) => b.totalSales - a.totalSales)
        .map((c, idx) => ({ ...c, rank: idx + 1 }));

      setReportData(sortedList);

    } catch (err: any) {
      alert(`خطأ أثناء جلب البيانات: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // فترات سريعة
  const setQuickPeriod = (type: 'today' | 'week' | 'month' | 'lastMonth') => {
    const today = new Date();
    const todayFormatted = today.toISOString().substring(0, 10);

    if (type === 'today') {
      setStartDate(todayFormatted);
      setEndDate(todayFormatted);
    } else if (type === 'week') {
      const start = new Date();
      start.setDate(today.getDate() - 7);
      setStartDate(start.toISOString().substring(0, 10));
      setEndDate(todayFormatted);
    } else if (type === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(start.toISOString().substring(0, 10));
      setEndDate(todayFormatted);
    } else if (type === 'lastMonth') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      setStartDate(start.toISOString().substring(0, 10));
      setEndDate(end.toISOString().substring(0, 10));
    }
  };

  // نص ملخص الفلاتر
  const filterSummaryString = useMemo(() => {
    const parts = [`الفترة: من ${startDate} إلى ${endDate}`];
    if (selectedSourceLabel) parts.push(`الفرع: ${selectedSourceLabel}`);
    if (selectedInvoiceTypeLabel) parts.push(`النوع: ${selectedInvoiceTypeLabel}`);
    if (selectedStatusLabel) parts.push(`الحالة: ${selectedStatusLabel}`);
    if (selectedClassificationLabel) parts.push(`التصنيف: ${selectedClassificationLabel}`);
    if (selectedServiceTypeLabel) parts.push(`الخدمة: ${selectedServiceTypeLabel}`);
    if (selectedSafeLabel) parts.push(`الخزينة: ${selectedSafeLabel}`);
    if (selectedSalesRepLabel) parts.push(`المندوب: ${selectedSalesRepLabel}`);
    return parts.join(' | ');
  }, [startDate, endDate, selectedSourceLabel, selectedInvoiceTypeLabel, selectedStatusLabel, selectedClassificationLabel, selectedServiceTypeLabel, selectedSafeLabel, selectedSalesRepLabel]);

  // تصدير Excel
  const handleExportExcel = () => {
    if (reportData.length === 0) {
      alert('لا توجد بيانات لتصديرها');
      return;
    }

    const headers = [
      'الترتيب',
      'اسم العميل',
      'كود العميل',
      'عدد الفواتير',
      'متوسط قيمة الفاتورة',
      'إجمالي مسحوبات العميل',
      'النسبة من إجمالي المبيعات %'
    ];

    const rows = reportData.map(r => [
      r.rank,
      r.customerName,
      r.customerCode || '---',
      r.invoiceCount,
      r.averageInvoiceValue.toFixed(2),
      r.totalSales.toFixed(2),
      `${r.salesPercentage.toFixed(1)}%`
    ]);

    const summaryRows = [
      [
        'الإجمالي العام لجميع العملاء',
        `عدد العملاء: ${totalCustomersCount}`,
        '',
        grandTotalInvoices,
        overallAvgInvoice.toFixed(2),
        grandTotalSales.toFixed(2),
        '100%'
      ]
    ];

    exportToXLSX({
      filename: `تقرير_إجمالي_مبيعات_العملاء_${startDate}_إلى_${endDate}`,
      title: 'تقرير مجمع: إجمالي مسحوبات ومبيعات العملاء (Customer Sales Summary)',
      subtitle: filterSummaryString,
      headers,
      rows,
      summaryRows
    });
  };

  // تصدير PDF
  const handleExportPDF = async () => {
    if (reportData.length === 0) {
      alert('لا توجد بيانات لتصديرها');
      return;
    }

    const headers = [
      '#',
      'اسم العميل',
      'كود العميل',
      'عدد الفواتير',
      'متوسط الفاتورة',
      'إجمالي المبيعات (ج.م)',
      'النسبة %'
    ];

    const rows = reportData.map(r => [
      r.rank,
      r.customerName,
      r.customerCode || '---',
      r.invoiceCount,
      r.averageInvoiceValue.toFixed(2),
      r.totalSales.toFixed(2),
      `${r.salesPercentage.toFixed(1)}%`
    ]);

    const summaryRows = [
      [
        'الإجمالي',
        `العملاء: ${totalCustomersCount}`,
        '',
        grandTotalInvoices,
        overallAvgInvoice.toFixed(2),
        grandTotalSales.toFixed(2),
        '100%'
      ]
    ];

    await exportToPDF({
      filename: `تقرير_إجمالي_مبيعات_العملاء_${startDate}_إلى_${endDate}`,
      title: 'تقرير إجمالي مسحوبات ومبيعات العملاء (Customer Sales Summary)',
      subtitle: filterSummaryString,
      headers,
      rows,
      summaryRows,
      orientation: 'portrait'
    });
  };

  // تصفية حسب البحث النصي
  const filteredRows = reportData.filter(r => 
    !searchTerm || 
    (r.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.customerCode && String(r.customerCode).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen rtl" dir="rtl">
      
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-900 font-bold text-xs mb-1">
            <span>مركز تقارير المبيعات</span>
            <span>/</span>
            <span className="text-blue-600">تقارير تجميعية وتحليل العملاء</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Users size={22} />
            </span>
            تقرير إجمالي مبيعات ومسحوبات العملاء (Customer Sales Summary)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            عرض مجمع ومبسط يوضح عدد فواتير كل عميل وإجمالي مسحوباته مرتبة تنازلياً حسب حجم المبيعات مع فلاتر شاملة
          </p>
        </div>

        {/* Action Tools */}
        <div className="flex items-center gap-2">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('reportsHub')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition shadow-2xs cursor-pointer"
            >
              <RotateCcw size={15} />
              <span>العودة للمركز</span>
            </button>
          )}
          {reportData.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <FileSpreadsheet size={15} />
                <span>تصدير Excel</span>
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <FileText size={15} />
                <span>تصدير PDF</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Printer size={15} />
                <span>طباعة</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 mb-6 space-y-4">
        {/* Row 1: Date and Quick Pickers */}
        <div className="flex flex-wrap items-end gap-4 pb-4 border-b border-slate-100">
          
          {/* Start Date */}
          <div className="flex flex-col min-w-[150px]">
            <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-blue-600" />
              من تاريخ
            </label>
            <input 
              type="date" 
              className="border border-slate-300 rounded-xl p-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-semibold text-slate-800 bg-slate-50/50"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          
          {/* End Date */}
          <div className="flex flex-col min-w-[150px]">
            <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-blue-600" />
              إلى تاريخ
            </label>
            <input 
              type="date" 
              className="border border-slate-300 rounded-xl p-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-semibold text-slate-800 bg-slate-50/50"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* Quick Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setQuickPeriod('today')}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-white text-slate-700 transition cursor-pointer"
            >
              اليوم
            </button>
            <button
              type="button"
              onClick={() => setQuickPeriod('week')}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-white text-slate-700 transition cursor-pointer"
            >
              آخر 7 أيام
            </button>
            <button
              type="button"
              onClick={() => setQuickPeriod('month')}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-white text-slate-700 transition cursor-pointer"
            >
              الشهر الحالي
            </button>
            <button
              type="button"
              onClick={() => setQuickPeriod('lastMonth')}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-white text-slate-700 transition cursor-pointer"
            >
              الشهر الماضي
            </button>
          </div>

          {/* Search Button */}
          <button 
            type="button"
            onClick={handleSearch} 
            disabled={loading} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl transition shadow-md shadow-blue-500/20 h-[43px] flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <Search size={16} />
            <span>{loading ? 'جاري تجميع البيانات...' : 'بحث وتجميع مسحوبات العملاء'}</span>
          </button>

          {/* Reset Filters */}
          {(selectedSource !== 'ALL' || selectedInvoiceType !== 'ALL' || selectedStatus !== 'ALL' || selectedClassification !== 'ALL' || selectedServiceType !== 'ALL' || selectedSafe !== 'ALL' || selectedSalesRep !== 'ALL') && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-[43px] px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>إعادة ضبط الفلاتر</span>
            </button>
          )}
        </div>

        {/* Row 2: Advanced Operational & Financial Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          
          {/* 1. المستودع والفرع */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
            <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Warehouse size={13} className="text-cyan-600" />
              <span>الفرع والمستودع</span>
            </label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-200 outline-none"
            >
              <option value="ALL">🏢 جميع الفروع والمستودعات</option>
              {dynamicWarehouses.map(w => (
                <option key={w.id} value={w.id}>{w.label}</option>
              ))}
            </select>
          </div>

          {/* 2. نوع الفاتورة والدفع */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
            <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Receipt size={13} className="text-indigo-600" />
              <span>نوع الفاتورة والدفع</span>
            </label>
            <select
              value={selectedInvoiceType}
              onChange={(e) => setSelectedInvoiceType(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none"
            >
              <option value="ALL">📑 جميع الأنواع</option>
              <option value="CASH_SALES">💵 مبيعات نقدية (كاش)</option>
              <option value="CREDIT_SALES">💳 مبيعات آجلة (ذمم)</option>
              <option value="RETURNS">↩️ مرتجعات المبيعات</option>
            </select>
          </div>

          {/* 3. حالة الفاتورة والسداد */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
            <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <CheckCircle size={13} className="text-emerald-600" />
              <span>حالة الفاتورة والسداد</span>
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none"
            >
              <option value="ALL">🟢 جميع الحالات</option>
              <option value="POSTED">✅ معتمدة / مرحلة</option>
              <option value="DRAFT">📝 مسودة</option>
              <option value="PAID">💰 مسددة بالكامل</option>
              <option value="PARTIAL">⚖️ مسددة جزئياً</option>
              <option value="UNPAID">⏳ غير مسددة (مستحقة)</option>
            </select>
          </div>

          {/* 4. التصنيف الضريبي */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
            <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Scale size={13} className="text-violet-600" />
              <span>التصنيف الضريبي</span>
            </label>
            <select
              value={selectedClassification}
              onChange={(e) => setSelectedClassification(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-200 outline-none"
            >
              <option value="ALL">⚖️ جميع التصنيفات</option>
              <option value="TAX">🏛️ فواتير ضريبية (VAT)</option>
              <option value="NORMAL">📄 فواتير عادية / مبسطة</option>
            </select>
          </div>

          {/* 5. نوع الخدمة والنشاط */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
            <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Briefcase size={13} className="text-teal-600" />
              <span>نوع الخدمة والنشاط</span>
            </label>
            <select
              value={selectedServiceType}
              onChange={(e) => setSelectedServiceType(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-200 outline-none"
            >
              <option value="ALL">💼 جميع الخدمات والأنشطة</option>
              <option value="NONE">📦 بضائع وسلع فقط</option>
              <option value="استشارات">💡 استشارات</option>
              <option value="تصميم">🎨 تصميم</option>
              <option value="برمجة">💻 برمجة وحلول تقنية</option>
              <option value="صيانة">🔧 صيانة</option>
              <option value="تركيب">⚙️ تركيب وتجهيز</option>
              <option value="دعم فني">📞 دعم فني</option>
              <option value="خدمات عامة">🛠️ خدمات عامة</option>
            </select>
          </div>

          {/* 6. خزينة التحصيل */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
            <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Landmark size={13} className="text-amber-600" />
              <span>خزينة التحصيل</span>
            </label>
            <select
              value={selectedSafe}
              onChange={(e) => setSelectedSafe(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-200 outline-none"
            >
              <option value="ALL">🏦 جميع الخزائن والحسابات</option>
              {cashBankOptions.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.label}</option>
              ))}
            </select>
          </div>

          {/* 7. مندوب المبيعات / المنشئ */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
            <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <UserCheck size={13} className="text-rose-600" />
              <span>مندوب المبيعات</span>
            </label>
            <select
              value={selectedSalesRep}
              onChange={(e) => setSelectedSalesRep(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-200 outline-none"
            >
              <option value="ALL">👤 جميع المناديب</option>
              {salesRepsList.map(rep => (
                <option key={rep.id} value={rep.id}>{rep.label}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Active Filter Chips */}
        {(selectedSource !== 'ALL' || selectedInvoiceType !== 'ALL' || selectedStatus !== 'ALL' || selectedClassification !== 'ALL' || selectedServiceType !== 'ALL' || selectedSafe !== 'ALL' || selectedSalesRep !== 'ALL') && (
          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs font-bold">
            <span className="text-slate-400 flex items-center gap-1">
              <Filter size={13} />
              فلاتر نشطة:
            </span>
            {selectedSourceLabel && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-200">
                <Warehouse size={12} />
                {selectedSourceLabel}
                <button type="button" onClick={() => setSelectedSource('ALL')} className="hover:text-rose-600 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedInvoiceTypeLabel && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200">
                <Receipt size={12} />
                {selectedInvoiceTypeLabel}
                <button type="button" onClick={() => setSelectedInvoiceType('ALL')} className="hover:text-rose-600 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedStatusLabel && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle size={12} />
                {selectedStatusLabel}
                <button type="button" onClick={() => setSelectedStatus('ALL')} className="hover:text-rose-600 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedClassificationLabel && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-50 text-violet-800 border border-violet-200">
                <Scale size={12} />
                {selectedClassificationLabel}
                <button type="button" onClick={() => setSelectedClassification('ALL')} className="hover:text-rose-600 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedServiceTypeLabel && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200">
                <Briefcase size={12} />
                {selectedServiceTypeLabel}
                <button type="button" onClick={() => setSelectedServiceType('ALL')} className="hover:text-rose-600 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedSafeLabel && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                <Landmark size={12} />
                {selectedSafeLabel}
                <button type="button" onClick={() => setSelectedSafe('ALL')} className="hover:text-rose-600 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedSalesRepLabel && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200">
                <UserCheck size={12} />
                {selectedSalesRepLabel}
                <button type="button" onClick={() => setSelectedSalesRep('ALL')} className="hover:text-rose-600 cursor-pointer"><X size={12} /></button>
              </span>
            )}
          </div>
        )}

        {/* Live Search Input */}
        {reportData.length > 0 && (
          <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                placeholder="بحث سريع باسم أو كود العميل..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-3 pr-9 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 bg-white"
              />
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
              >
                مسح البحث
              </button>
            )}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {reportData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          
          {/* Total Sales */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">إجمالي مبيعات الفترة المفلترة</span>
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <DollarSign size={18} />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800">
                {grandTotalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-slate-400">ج.م</span>
            </div>
          </div>

          {/* Active Customers */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">عدد العملاء المشترين</span>
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Users size={18} />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800">
                {totalCustomersCount}
              </span>
              <span className="text-xs font-bold text-slate-400">عميل نشط</span>
            </div>
          </div>

          {/* Total Invoices Count */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">إجمالي عدد الفواتير</span>
              <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <FileText size={18} />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800">
                {grandTotalInvoices}
              </span>
              <span className="text-xs font-bold text-slate-400">فاتورة صادرة</span>
            </div>
          </div>

          {/* Average Invoice Value */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">متوسط قيمة الفاتورة</span>
              <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <TrendingUp size={18} />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800">
                {overallAvgInvoice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-slate-400">ج.م / فاتورة</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="p-3.5 text-center w-14">#</th>
                <th className="p-3.5">اسم العميل</th>
                <th className="p-3.5">كود العميل</th>
                <th className="p-3.5 text-center">عدد الفواتير</th>
                <th className="p-3.5 text-left">متوسط الفاتورة</th>
                <th className="p-3.5 text-left">إجمالي مسحوبات العميل</th>
                <th className="p-3.5 text-center w-36">النسبة من المبيعات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!hasSearched ? (
                <tr>
                  <td colSpan={7} className="p-14 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                        <Users size={26} />
                      </div>
                      <p className="font-bold text-slate-700 text-base">يرجى تحديد الفترة الزمنية والضغط على "بحث وتجميع مسحوبات العملاء"</p>
                      <p className="text-xs text-slate-400 max-w-md">
                        يقوم هذا التقرير بتجميع الفواتير وإظهار كل عميل في سطر واحد مرتبة تنازلياً من الأعلى مسحوبات مع تطبيق كافة الفلاتر التشغيلية والمالية
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    لا توجد بيانات مسحوبات مسجلة للعملاء تطابق معايير الفلترة المحددة
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isTopThree = row.rank <= 3;
                  return (
                    <tr key={row.customerId} className="hover:bg-blue-50/40 transition-colors bg-white">
                      <td className="p-3.5 text-center">
                        {isTopThree ? (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                            row.rank === 1 ? 'bg-amber-400 text-slate-950 shadow-xs' :
                            row.rank === 2 ? 'bg-slate-300 text-slate-900' :
                            'bg-amber-700/80 text-white'
                          }`}>
                            {row.rank}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-mono">{row.rank}</span>
                        )}
                      </td>
                      <td className="p-3.5 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          {row.rank === 1 && <Award size={16} className="text-amber-500 shrink-0" />}
                          <span>{row.customerName}</span>
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-xs text-slate-500">
                        {row.customerCode ? (
                          <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {row.customerCode}
                          </span>
                        ) : (
                          <span className="text-slate-300">---</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200/60">
                          {row.invoiceCount} فاتورة
                        </span>
                      </td>
                      <td className="p-3.5 text-left font-mono text-slate-600 font-medium">
                        {row.averageInvoiceValue.toFixed(2)}
                      </td>
                      <td className="p-3.5 text-left font-mono font-black text-blue-700 text-base">
                        {row.totalSales.toFixed(2)}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-bold text-slate-700">
                            {row.salesPercentage.toFixed(1)}%
                          </span>
                          <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-blue-600 h-full rounded-full transition-all" 
                              style={{ width: `${Math.min(100, Math.max(2, row.salesPercentage))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Footer Summary */}
            {filteredRows.length > 0 && (
              <tfoot className="bg-slate-900 text-white font-bold border-t-2 border-blue-500">
                <tr>
                  <td colSpan={3} className="p-4 text-base">
                    الإجمالي العام لجميع العملاء ({filteredRows.length} عميل نشط):
                  </td>
                  <td className="p-4 text-center font-mono text-amber-400 text-lg">
                    {filteredRows.reduce((sum, r) => sum + r.invoiceCount, 0)} فاتورة
                  </td>
                  <td className="p-4 text-left font-mono text-slate-300 text-sm">
                    {overallAvgInvoice.toFixed(2)}
                  </td>
                  <td className="p-4 text-left font-mono text-blue-300 text-lg font-black tracking-tight">
                    {grandTotalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                  </td>
                  <td className="p-4 text-center text-emerald-300 font-mono text-xs">
                    100%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  );
};

export default CustomerSalesSummary;
