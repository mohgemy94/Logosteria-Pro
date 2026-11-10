import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  UserCheck, 
  Search, 
  Printer, 
  FileSpreadsheet, 
  RotateCcw, 
  DollarSign, 
  TrendingUp, 
  FileText, 
  Award, 
  Percent, 
  ArrowUpDown, 
  Filter,
  Users,
  Warehouse,
  Receipt,
  Scale,
  Landmark,
  Briefcase,
  X,
  CheckCircle
} from 'lucide-react';
import { exportToXLSX, exportToPDF } from '../../../utils/universalExport';
import { getUnifiedSalesInvoices } from '../../../utils/salesReportsUnifiedStore';
import { loadChartOfAccounts } from '../../../utils/trialBalanceStore';
import { isCashOrBankAccount } from '../../../utils/accountingIntegration';
import { getDynamicWarehousesList, getWarehouseLabel } from '../../../utils/itemsStore';

interface TechnicianSalesProps {
  onNavigate?: (view: string | null) => void;
}

interface TechnicianSalesRow {
  technicianId: string;
  technicianName: string;
  technicianCode?: string | undefined;
  phone?: string | undefined;
  invoiceCount: number;
  totalSales: number;
  averageInvoiceValue: number;
  salesPercentage: number;
  estimatedCommission?: number | undefined;
  rank: number;
}

export const TechnicianSales: React.FC<TechnicianSalesProps> = ({ onNavigate }) => {
  const todayStr = new Date().toISOString().substring(0, 10);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // أول الشهر الحالي افتراضياً
    return d.toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [reportData, setReportData] = useState<TechnicianSalesRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [commissionRate, setCommissionRate] = useState<number>(0); // نسبة العمولة الافتراضية %
  const [sortBy, setSortBy] = useState<'sales' | 'invoices' | 'name'>('sales');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // الفلاتر المتقدمة
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [selectedInvoiceType, setSelectedInvoiceType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedClassification, setSelectedClassification] = useState<string>('ALL');
  const [selectedServiceType, setSelectedServiceType] = useState<string>('ALL');
  const [selectedSafe, setSelectedSafe] = useState<string>('ALL');

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

  // المجاميع الإجمالية
  const grandTotalSales = useMemo(() => reportData.reduce((sum, r) => sum + r.totalSales, 0), [reportData]);
  const grandTotalInvoices = useMemo(() => reportData.reduce((sum, r) => sum + r.invoiceCount, 0), [reportData]);
  const totalTechniciansCount = reportData.length;
  const overallAvgInvoice = grandTotalInvoices > 0 ? grandTotalSales / grandTotalInvoices : 0;
  const grandTotalCommission = useMemo(() => (grandTotalSales * commissionRate) / 100, [grandTotalSales, commissionRate]);
  const topTechnician = reportData.length > 0 ? reportData[0] : null;

  // إعادة ضبط الفلاتر
  const handleResetFilters = () => {
    setSelectedSource('ALL');
    setSelectedInvoiceType('ALL');
    setSelectedStatus('ALL');
    setSelectedClassification('ALL');
    setSelectedServiceType('ALL');
    setSelectedSafe('ALL');
    setSearchTerm('');
  };

  // تنفيذ الاستعلام وتجميع مبيعات الفنيين (Grouping Logic)
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

        return true;
      });

      // تجميع الفواتير بناءً على الفني / المندوب
      const groupedMap: Record<string, TechnicianSalesRow> = {};

      filteredInvoices.forEach(inv => {
        const rawTechName = inv.salesRepName || 'فني المبيعات العام';
        const techId = inv.salesRepId || rawTechName;
        const techName = rawTechName.trim();
        const amount = Number(inv.totals?.grandTotal || 0);

        if (!groupedMap[techName]) {
          groupedMap[techName] = {
            technicianId: techId,
            technicianName: techName,
            technicianCode: undefined,
            phone: undefined,
            invoiceCount: 0,
            totalSales: 0,
            averageInvoiceValue: 0,
            salesPercentage: 0,
            estimatedCommission: 0,
            rank: 0
          };
        }

        const entry = groupedMap[techName]!;
        entry.invoiceCount += 1;
        entry.totalSales += amount;
      });

      const totalPeriodSales = Object.values(groupedMap).reduce((sum, t) => sum + t.totalSales, 0);

      const sortedList: TechnicianSalesRow[] = Object.values(groupedMap)
        .map(t => ({
          ...t,
          averageInvoiceValue: t.invoiceCount > 0 ? t.totalSales / t.invoiceCount : 0,
          salesPercentage: totalPeriodSales > 0 ? (t.totalSales / totalPeriodSales) * 100 : 0,
          estimatedCommission: commissionRate > 0 ? (t.totalSales * commissionRate) / 100 : 0
        }))
        .sort((a, b) => b.totalSales - a.totalSales)
        .map((t, idx) => ({ ...t, rank: idx + 1 }));

      setReportData(sortedList);
    } catch (err: any) {
      console.error('Error fetching technician sales:', err);
    } finally {
      setLoading(false);
    }
  };

  // فلاتر التواريخ السريعة
  const setQuickRange = (type: 'today' | 'week' | 'month' | 'quarter' | 'year') => {
    const now = new Date();
    const end = now.toISOString().substring(0, 10);
    let start = new Date();

    if (type === 'today') {
      start = now;
    } else if (type === 'week') {
      start.setDate(now.getDate() - 7);
    } else if (type === 'month') {
      start.setDate(1);
    } else if (type === 'quarter') {
      start.setMonth(now.getMonth() - 3);
    } else if (type === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
    }

    setStartDate(start.toISOString().substring(0, 10));
    setEndDate(end);
  };

  // فلترة وترتيب البيانات
  const filteredAndSortedList = useMemo(() => {
    let result = reportData.filter(row => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (row.technicianName || '').toLowerCase().includes(term) ||
        (row.technicianCode && (row.technicianCode || '').toLowerCase().includes(term))
      );
    });

    result.sort((a, b) => {
      let valA: any = a.totalSales;
      let valB: any = b.totalSales;

      if (sortBy === 'invoices') {
        valA = a.invoiceCount;
        valB = b.invoiceCount;
      } else if (sortBy === 'name') {
        valA = a.technicianName;
        valB = b.technicianName;
      }

      if (sortDirection === 'asc') {
        return valA > valB ? 1 : -1;
      }
      return valA < valB ? 1 : -1;
    });

    return result;
  }, [reportData, searchTerm, sortBy, sortDirection]);

  // تبديل الترتيب
  const toggleSort = (column: 'sales' | 'invoices' | 'name') => {
    if (sortBy === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
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
    return parts.join(' | ');
  }, [startDate, endDate, selectedSourceLabel, selectedInvoiceTypeLabel, selectedStatusLabel, selectedClassificationLabel, selectedServiceTypeLabel, selectedSafeLabel]);

  // تصدير Excel
  const handleExportExcel = () => {
    if (reportData.length === 0) {
      alert('لا توجد بيانات متاحة للتصدير');
      return;
    }

    exportToXLSX({
      filename: `تقرير_مبيعات_الفنيين_والمندوبين_${startDate}_إلى_${endDate}.xlsx`,
      sheetName: 'مبيعات الفنيين',
      title: 'تقرير إجمالي مبيعات الفنيين ومندوبي المبيعات',
      subtitle: `الفترة من: ${startDate} إلى: ${endDate}`,
      filterSummary: `${filterSummaryString} | عدد الفنيين: ${totalTechniciansCount} | إجمالي المبيعات: ${grandTotalSales.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ر.س`,
      headers: [
        'الترتيب',
        'اسم الفني / المندوب',
        'كود المندوب',
        'عدد الفواتير المصدرة',
        'متوسط قيمة الفاتورة (ر.س)',
        'إجمالي قيمة المبيعات (ر.س)',
        'النسبة من الإجمالي %',
        commissionRate > 0 ? `العمولة التقديرية (${commissionRate}%)` : 'ملاحظات'
      ],
      rows: filteredAndSortedList.map(r => [
        r.rank,
        r.technicianName,
        r.technicianCode || '-',
        r.invoiceCount,
        r.averageInvoiceValue.toFixed(2),
        r.totalSales.toFixed(2),
        `${r.salesPercentage.toFixed(1)}%`,
        commissionRate > 0 ? ((r.totalSales * commissionRate) / 100).toFixed(2) : '-'
      ]),
      summaryRows: [
        [
          'الإجمالي الكلي',
          `عدد الفنيين: ${totalTechniciansCount}`,
          '-',
          grandTotalInvoices,
          overallAvgInvoice.toFixed(2),
          grandTotalSales.toFixed(2),
          '100.0%',
          commissionRate > 0 ? grandTotalCommission.toFixed(2) : '-'
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

    const printableElement = document.getElementById('printable-technician-sales-report');
    if (printableElement) {
      exportToPDF({
        filename: `تقرير_مبيعات_الفنيين_${startDate}_إلى_${endDate}.pdf`,
        title: 'تقرير إجمالي مبيعات الفنيين ومندوبي المبيعات',
        subtitle: filterSummaryString,
        headers: ['#', 'اسم الفني / المندوب', 'عدد الفواتير', 'متوسط الفاتورة', 'إجمالي المبيعات', 'النسبة %'],
        rows: filteredAndSortedList.map(r => [
          r.rank,
          r.technicianName,
          r.invoiceCount,
          r.averageInvoiceValue.toFixed(2),
          r.totalSales.toFixed(2),
          `${r.salesPercentage.toFixed(1)}%`
        ]),
        summaryRows: [
          ['الإجمالي', `فنيين: ${totalTechniciansCount}`, grandTotalInvoices, overallAvgInvoice.toFixed(2), grandTotalSales.toFixed(2), '100%']
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
              <UserCheck size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                تقرير مبيعات الفنيين ومندوبي المبيعات
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                حصر مبيعات الفنيين وحجم الفواتير المصدرة لتسهيل احتساب الأداء وعمولات المبيعات مع فلاتر تشغيلية متكاملة
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('reportsHub')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
            >
              <RotateCcw size={15} />
              <span>العودة لمركز التقارير</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={reportData.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet size={16} />
            <span>تصدير Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={reportData.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <Printer size={16} />
            <span>طباعة / PDF</span>
          </button>
        </div>
      </div>

      {/* 2. Top Search & Filter Bar */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 mb-6 space-y-4">
        {/* Date Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end pb-4 border-b border-slate-100">
          
          {/* Start Date */}
          <div className="lg:col-span-3">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              من تاريخ (تاريخ الفاتورة)
            </label>
            <div className="relative">
              <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-all"
              />
            </div>
          </div>

          {/* End Date */}
          <div className="lg:col-span-3">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              إلى تاريخ (تاريخ الفاتورة)
            </label>
            <div className="relative">
              <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-all"
              />
            </div>
          </div>

          {/* Quick Date Range Buttons */}
          <div className="lg:col-span-3">
            <label className="block text-xs font-bold text-slate-500 mb-1.5">
              فترات سريعة
            </label>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setQuickRange('today')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => setQuickRange('week')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                الأسبوع
              </button>
              <button
                type="button"
                onClick={() => setQuickRange('month')}
                className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                هذا الشهر
              </button>
              <button
                type="button"
                onClick={() => setQuickRange('year')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                العام
              </button>
            </div>
          </div>

          {/* Commission Estimator Option */}
          <div className="lg:col-span-1">
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5 truncate" title="نسبة العمولة %">
              العمولة %
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={commissionRate || ''}
                placeholder="0%"
                onFocus={e => e.target.select()}
                onChange={(e) => setCommissionRate(e.target.value === '' ? ('' as any) : Math.max(0, Number(e.target.value)))}
                onBlur={() => {
                  if ((commissionRate as any) === '') setCommissionRate(0);
                }}
                className="w-full px-2 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 text-center focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-200"
              />
            </div>
          </div>

          {/* Search Button */}
          <div className="lg:col-span-2">
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-linear-to-r from-teal-600 to-cyan-700 hover:from-teal-700 hover:to-cyan-800 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Search size={16} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'جاري التحميل...' : 'عرض التقرير'}</span>
            </button>
          </div>
        </div>

        {/* Operational & Financial Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          
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

        </div>

        {/* Active Filter Chips */}
        {(selectedSource !== 'ALL' || selectedInvoiceType !== 'ALL' || selectedStatus !== 'ALL' || selectedClassification !== 'ALL' || selectedServiceType !== 'ALL' || selectedSafe !== 'ALL') && (
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
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-rose-600 hover:underline cursor-pointer mr-auto"
            >
              إعادة ضبط الفلاتر
            </button>
          </div>
        )}

        {/* Realtime In-table Search & Filter */}
        {reportData.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="البحث باسم الفني أو كود المندوب..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-200"
              />
            </div>
            
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <Filter size={14} />
              <span>عدد الفنيين المطابقين: <strong className="text-teal-600">{filteredAndSortedList.length}</strong> من أصل {reportData.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. KPI Summary Cards */}
      {hasSearched && reportData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          
          {/* Card 1: Grand Total Sales */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 mb-1">إجمالي مبيعات الفنيين</p>
                <h3 className="text-xl sm:text-2xl font-black text-emerald-600">
                  {grandTotalSales.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-slate-500">ر.س</span>
                </h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign size={24} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-700 font-bold bg-emerald-50/70 px-2.5 py-1 rounded-lg">
              <TrendingUp size={13} />
              <span>متوسط الفاتورة: {overallAvgInvoice.toFixed(2)} ر.س</span>
            </div>
          </div>

          {/* Card 2: Total Invoices Count */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 mb-1">إجمالي الفواتير الصادرة</p>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                  {grandTotalInvoices.toLocaleString('ar-EG')} <span className="text-xs font-normal text-slate-500">فاتورة</span>
                </h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <FileText size={24} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-teal-700 font-bold bg-teal-50/70 px-2.5 py-1 rounded-lg">
              <Users size={13} />
              <span>موزعة على {totalTechniciansCount} فني / مندوب</span>
            </div>
          </div>

          {/* Card 3: Top Performing Technician */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 mb-1">الفني الأعلى مبيعاً (المتصدر)</p>
                <h3 className="text-base sm:text-lg font-black text-slate-900 truncate" title={topTechnician?.technicianName}>
                  {topTechnician?.technicianName || '-'}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Award size={24} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-amber-700 font-bold bg-amber-50/70 px-2.5 py-1 rounded-lg">
              <span>{topTechnician?.totalSales.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ر.س ({topTechnician?.salesPercentage.toFixed(1)}% من المبيعات)</span>
            </div>
          </div>

          {/* Card 4: Estimated Commissions */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 mb-1">
                  {commissionRate > 0 ? `إجمالي العمولات (${commissionRate}%)` : 'عدد الفنيين النشطين'}
                </p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-700">
                  {commissionRate > 0 
                    ? `${grandTotalCommission.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ر.س`
                    : `${totalTechniciansCount} مندوب / فني`}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <Percent size={24} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-cyan-700 font-bold bg-cyan-50/70 px-2.5 py-1 rounded-lg">
              <span>{commissionRate > 0 ? 'محسوبة بناءً على نسبة العمولة المحددة' : 'فنيين لديهم مبيعات بالفترة'}</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Main Data Table */}
      <div id="printable-technician-sales-report" className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UserCheck size={18} className="text-teal-600" />
            <h2 className="font-bold text-sm sm:text-base text-slate-900">
              جدول مبيعات الفنيين ومندوبي المبيعات
            </h2>
            <span className="text-xs text-slate-400 font-normal">
              (مرتب تنازلياً حسب الأعلى مبيعاً)
            </span>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            الفترة المحددة: <strong className="text-slate-800">{startDate}</strong> إلى <strong className="text-slate-800">{endDate}</strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-700 border-b border-slate-200 font-bold">
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th 
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                  onClick={() => toggleSort('name')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>اسم الفني / المندوب</span>
                    <ArrowUpDown size={13} className="text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3">كود المندوب</th>
                <th 
                  className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none"
                  onClick={() => toggleSort('invoices')}
                >
                  <div className="flex items-center justify-center gap-1.5 text-teal-700">
                    <span>عدد الفواتير</span>
                    <ArrowUpDown size={13} className="text-teal-500" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">متوسط قيمة الفاتورة</th>
                <th 
                  className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none"
                  onClick={() => toggleSort('sales')}
                >
                  <div className="flex items-center justify-center gap-1.5 text-emerald-700">
                    <span>إجمالي المبيعات</span>
                    <ArrowUpDown size={13} className="text-emerald-500" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">النسبة من الإجمالي</th>
                {commissionRate > 0 && (
                  <th className="py-3 px-4 text-center text-cyan-800 bg-cyan-50/50">
                    العمولة ({commissionRate}%)
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={commissionRate > 0 ? 8 : 7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-bold text-slate-600">جاري تجميع مبيعات الفنيين...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAndSortedList.length === 0 ? (
                <tr>
                  <td colSpan={commissionRate > 0 ? 8 : 7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <UserCheck size={36} className="text-slate-300 stroke-1" />
                      <p className="text-xs font-bold text-slate-500">
                        {hasSearched ? 'لا توجد مبيعات مسجلة للفنيين تطابق معايير الفلترة المحددة' : 'حدد الفترة الزمنية والفلاتر واضغط على "عرض التقرير"'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedList.map((row, index) => (
                  <tr key={row.technicianId || index} className="hover:bg-teal-50/30 transition-colors">
                    <td className="py-3 px-3 text-center font-bold text-slate-400">
                      {row.rank <= 3 ? (
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black text-white ${
                          row.rank === 1 ? 'bg-amber-500' : row.rank === 2 ? 'bg-slate-400' : 'bg-amber-700'
                        }`}>
                          {row.rank}
                        </span>
                      ) : (
                        row.rank
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        {row.rank === 1 && <Award size={14} className="text-amber-500 shrink-0" />}
                        <span>{row.technicianName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                      {row.technicianCode || '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-black text-teal-700 bg-teal-50/20">
                      {row.invoiceCount}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-700">
                      {row.averageInvoiceValue.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-black text-emerald-700 bg-emerald-50/20">
                      {row.totalSales.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-teal-500 h-1.5 rounded-full" 
                            style={{ width: `${Math.min(row.salesPercentage, 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] font-bold text-slate-600">
                          {row.salesPercentage.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    {commissionRate > 0 && (
                      <td className="py-3 px-4 text-center font-mono font-bold text-cyan-800 bg-cyan-50/30">
                        {((row.totalSales * commissionRate) / 100).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>

            {/* Table Footer with Summaries */}
            {filteredAndSortedList.length > 0 && (
              <tfoot className="bg-slate-100 text-slate-900 font-black border-t-2 border-slate-300">
                <tr>
                  <td colSpan={3} className="py-3.5 px-4 text-right">
                    <span className="text-sm font-black text-slate-900">
                      إجمالي مبيعات جميع الفنيين ({totalTechniciansCount} فني / مندوب)
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-sm text-teal-800 bg-teal-100/50">
                    {grandTotalInvoices.toLocaleString('ar-EG')}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-700">
                    {overallAvgInvoice.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-sm text-emerald-800 bg-emerald-100/50">
                    {grandTotalSales.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-800">
                    100.0%
                  </td>
                  {commissionRate > 0 && (
                    <td className="py-3.5 px-4 text-center font-mono text-sm text-cyan-900 bg-cyan-100/60">
                      {grandTotalCommission.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س
                    </td>
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  );
};

export default TechnicianSales;
