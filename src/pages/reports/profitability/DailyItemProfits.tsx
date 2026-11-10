import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  Search, 
  Printer, 
  FileSpreadsheet, 
  RotateCcw,
  Percent,
  Sparkles,
  Filter,
  Warehouse,
  Users,
  Receipt,
  Layers,
  UserCheck,
  Award,
  ChevronLeft,
  X
} from 'lucide-react';
import { loadStoredItems, getDynamicWarehousesList, getWarehouseLabel } from '../../../utils/itemsStore';
import { loadCustomers } from '../../../utils/partnerLedger';
import { exportToXLSX, exportToPDF } from '../../../utils/universalExport';
import { getUnifiedSalesInvoices, getDynamicSalesRepsList, doesInvoiceMatchSalesRep } from '../../../utils/salesReportsUnifiedStore';

interface DailyItemProfitsProps {
  onNavigate?: (view: string | null) => void;
}

interface ProfitRow {
  id: string;
  date: string;
  invoiceNumber: string;
  customerName: string;
  customerId?: string | undefined;
  itemName: string;
  itemCode?: string | undefined;
  category?: string | undefined;
  source?: string | undefined;
  salesRep?: string | undefined;
  quantity: number;
  unitPrice: number;
  totalSale: number;
  unitCost: number;
  totalCost: number;
  netProfit: number;
  profitMargin: number;
  status: string;
  invoiceType?: string | undefined;
}

export const DailyItemProfits: React.FC<DailyItemProfitsProps> = ({ onNavigate }) => {
  const todayStr = new Date().toISOString().substring(0, 10);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // أول الشهر الحالي افتراضياً
    return d.toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [reportData, setReportData] = useState<ProfitRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // الفلاتر المتقدمة
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedInvoiceType, setSelectedInvoiceType] = useState<string>('ALL');
  const [selectedSalesRep, setSelectedSalesRep] = useState<string>('ALL');
  const [selectedProfitStatus, setSelectedProfitStatus] = useState<string>('ALL');

  // جلب العملاء والكتالوج
  const customersList = useMemo(() => {
    try {
      return loadCustomers();
    } catch {
      return [];
    }
  }, []);

  const localCatalog = useMemo(() => {
    try {
      return loadStoredItems();
    } catch {
      return [];
    }
  }, []);

  // قائمة الفئات المتاحة
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    localCatalog.forEach(item => {
      if (item.category && item.category.trim()) set.add(item.category.trim());
    });
    reportData.forEach(row => {
      if (row.category && row.category.trim()) set.add(row.category.trim());
    });
    return Array.from(set).sort();
  }, [localCatalog, reportData]);

  // تسميات الفلاتر النشطة
  const selectedCustomerObj = useMemo(() => {
    if (selectedCustomerId === 'ALL') return null;
    return customersList.find(c => c.id === selectedCustomerId) || null;
  }, [selectedCustomerId, customersList]);

  const selectedSourceLabel = useMemo(() => {
    if (selectedSource === 'ALL') return null;
    return getWarehouseLabel(selectedSource);
  }, [selectedSource]);

  const selectedInvoiceTypeLabel = useMemo(() => {
    switch (selectedInvoiceType) {
      case 'CASH_SALES': return 'نقدي (كاش)';
      case 'CREDIT_SALES': return 'آجل (ذمم)';
      case 'RETURNS': return 'مرتجعات';
      default: return null;
    }
  }, [selectedInvoiceType]);

  const salesRepsList = useMemo(() => getDynamicSalesRepsList(), []);

  const selectedSalesRepLabel = useMemo(() => {
    if (selectedSalesRep === 'ALL') return null;
    const found = salesRepsList.find(r => r.id === selectedSalesRep);
    return found ? found.label : selectedSalesRep;
  }, [selectedSalesRep, salesRepsList]);

  const selectedProfitStatusLabel = useMemo(() => {
    switch (selectedProfitStatus) {
      case 'PROFITABLE': return 'أصناف رابحة (+)';
      case 'LOSS': return 'أصناف خاسرة (-)';
      case 'BREAK_EVEN': return 'نقطة تعادل (0)';
      default: return null;
    }
  }, [selectedProfitStatus]);

  // تنفيذ الاستعلام وجلب البيانات
  const handleSearch = async () => {
    if (!startDate || !endDate) {
      alert('يرجى تحديد فترة البحث (من تاريخ / إلى تاريخ)');
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const allInvoices = await getUnifiedSalesInvoices();
      const rows: ProfitRow[] = [];

      allInvoices.forEach(inv => {
        const invDate = (inv.date || inv.createdAt || '').substring(0, 10);
        if (invDate < startDate || invDate > endDate) return;

        // فلتر المستودع
        if (selectedSource !== 'ALL') {
          const src = (inv.source || 'MAIN_WAREHOUSE').toUpperCase();
          if (src !== selectedSource.toUpperCase()) return;
        }

        // فلتر العميل
        if (selectedCustomerId !== 'ALL') {
          const matchId = inv.partnerId === selectedCustomerId;
          const matchName = selectedCustomerObj && (inv.partnerName || '').toLowerCase().includes((selectedCustomerObj.name || '').toLowerCase());
          if (!matchId && !matchName) return;
        }

        // فلتر نوع الفاتورة
        if (selectedInvoiceType !== 'ALL') {
          const t = (inv.invoiceType || '').toUpperCase();
          if (selectedInvoiceType === 'CASH_SALES' && !t.includes('CASH') && inv.paymentStatus !== 'PAID') return;
          if (selectedInvoiceType === 'CREDIT_SALES' && !t.includes('CREDIT') && inv.paymentStatus !== 'UNPAID') return;
          if (selectedInvoiceType === 'RETURNS' && !inv.isReturn && !t.includes('RETURN') && !t.includes('مرتجع')) return;
        }

        // فلتر مندوب المبيعات
        if (!doesInvoiceMatchSalesRep(inv.salesRepName, selectedSalesRep)) return;

        (inv.items || []).forEach((item, idx) => {
          const category = item.category || 'عام';

          // فلتر الفئة
          if (selectedCategory !== 'ALL' && category !== selectedCategory) {
            return;
          }

          const qty = Number(item.quantity) || 0;
          const unitPrice = Number(item.unitPrice) || 0;
          const unitCost = Number(item.costPrice) || 0;
          const totalSale = Number(item.totalSale ?? (qty * unitPrice)) || 0;
          const totalCost = Number(item.totalCost ?? (qty * unitCost)) || 0;
          const netProfit = Number((totalSale - totalCost).toFixed(2));
          const profitMargin = totalSale > 0 ? Number(((netProfit / totalSale) * 100).toFixed(2)) : (totalCost > 0 ? -100 : 0);

          // فلتر حالة الربحية
          if (selectedProfitStatus === 'PROFITABLE' && netProfit <= 0) return;
          if (selectedProfitStatus === 'LOSS' && netProfit >= 0) return;
          if (selectedProfitStatus === 'BREAK_EVEN' && Math.abs(netProfit) > 0.01) return;

          rows.push({
            id: `${inv.id}-${idx}`,
            date: invDate,
            invoiceNumber: inv.invoiceNumber || inv.id,
            customerName: inv.partnerName || 'عميل نقدي',
            customerId: inv.partnerId,
            itemName: item.description || 'صنف غير محدد',
            itemCode: item.itemCode,
            category: category,
            source: inv.source || 'MAIN_WAREHOUSE',
            salesRep: inv.salesRepName || 'مندوب المبيعات العام',
            quantity: qty,
            unitPrice: unitPrice,
            totalSale: totalSale,
            unitCost: unitCost,
            totalCost: totalCost,
            netProfit: netProfit,
            profitMargin: profitMargin,
            status: inv.statusCode === 'POSTED' ? 'معتمدة' : 'مسودة',
            invoiceType: inv.invoiceType || 'CASH_SALES'
          });
        });
      });

      setReportData(rows);
    } catch (err: any) {
      alert(`خطأ أثناء جلب البيانات: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // إعادة ضبط الفلاتر
  const handleReset = () => {
    const d = new Date();
    d.setDate(1);
    setStartDate(d.toISOString().substring(0, 10));
    setEndDate(todayStr);
    setSelectedSource('ALL');
    setSelectedCustomerId('ALL');
    setSelectedCategory('ALL');
    setSelectedInvoiceType('ALL');
    setSelectedSalesRep('ALL');
    setSelectedProfitStatus('ALL');
    setSearchTerm('');
  };

  // فترات سريعة
  const setQuickPeriod = (type: 'today' | 'week' | 'month' | 'quarter' | 'year') => {
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

  // تصفية حسب البحث النصي
  const filteredRows = useMemo(() => {
    return reportData.filter(r => 
      !searchTerm || 
      (r.itemName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.itemCode && String(r.itemCode).toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [reportData, searchTerm]);

  // المجاميع المحسوبة
  const grandTotalSales = filteredRows.reduce((sum, r) => sum + r.totalSale, 0);
  const grandTotalCost = filteredRows.reduce((sum, r) => sum + r.totalCost, 0);
  const grandNetProfit = grandTotalSales - grandTotalCost;
  const overallMargin = grandTotalSales > 0 ? (grandNetProfit / grandTotalSales) * 100 : 0;
  const totalQuantity = filteredRows.reduce((sum, r) => sum + r.quantity, 0);

  // تصدير Excel
  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      alert('لا توجد بيانات لتصديرها');
      return;
    }

    exportToXLSX({
      filename: `تقرير_أرباح_الأصناف_${startDate}_إلى_${endDate}.xlsx`,
      sheetName: 'أرباح الأصناف التفصيلية',
      title: 'تقرير أرباح الأصناف اليومية والتفصيلية',
      subtitle: `الفترة من: ${startDate} إلى: ${endDate}`,
      filterSummary: `الفترة: ${startDate} إلى ${endDate} | إجمالي المبيعات: ${grandTotalSales.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ر.س | صافي الربح: ${grandNetProfit.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ر.س (${overallMargin.toFixed(1)}%)`,
      headers: [
        'م',
        'التاريخ',
        'رقم الفاتورة',
        'العميل',
        'اسم الصنف',
        'التصنيف',
        'المستودع',
        'المندوب',
        'الكمية المباعة',
        'سعر الوحدة',
        'إجمالي المبيع',
        'إجمالي التكلفة',
        'صافي الربح',
        'نسبة الهامش %',
        'الحالة'
      ],
      rows: filteredRows.map((r, idx) => [
        idx + 1,
        r.date,
        r.invoiceNumber,
        r.customerName,
        r.itemName,
        r.category || 'عام',
        r.source || 'المستودع الرئيسي',
        r.salesRep || '-',
        r.quantity,
        r.unitPrice.toFixed(2),
        r.totalSale.toFixed(2),
        r.totalCost.toFixed(2),
        r.netProfit.toFixed(2),
        `${r.profitMargin.toFixed(1)}%`,
        r.status
      ]),
      summaryRows: [
        [
          'الإجمالي الكلي',
          '-',
          '-',
          '-',
          `عدد العمليات: ${filteredRows.length}`,
          '-',
          '-',
          '-',
          totalQuantity,
          '-',
          grandTotalSales.toFixed(2),
          grandTotalCost.toFixed(2),
          grandNetProfit.toFixed(2),
          `${overallMargin.toFixed(1)}%`,
          '-'
        ]
      ]
    });
  };

  // تصدير PDF
  const handleExportPDF = () => {
    if (filteredRows.length === 0) {
      alert('لا توجد بيانات للطباعة');
      return;
    }

    const printableElement = document.getElementById('printable-daily-profits-report');
    if (printableElement) {
      exportToPDF({
        filename: `تقرير_أرباح_الأصناف_${startDate}_إلى_${endDate}.pdf`,
        title: 'تقرير أرباح الأصناف اليومية والتفصيلية',
        subtitle: `الفترة من: ${startDate} إلى: ${endDate}`,
        headers: ['#', 'التاريخ', 'الفاتورة', 'العميل', 'الصنف', 'الكمية', 'سعر البيع', 'التكلفة', 'صافي الربح', 'الهامش %'],
        rows: filteredRows.map((r, idx) => [
          idx + 1,
          r.date,
          r.invoiceNumber,
          r.customerName,
          r.itemName,
          r.quantity,
          r.unitPrice.toFixed(2),
          r.totalCost.toFixed(2),
          r.netProfit.toFixed(2),
          `${r.profitMargin.toFixed(1)}%`
        ]),
        summaryRows: [
          ['الإجمالي', '-', '-', '-', `عمليات: ${filteredRows.length}`, totalQuantity, grandTotalSales.toFixed(2), grandTotalCost.toFixed(2), grandNetProfit.toFixed(2), `${overallMargin.toFixed(1)}%`]
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
      
      {/* 1. Header Banner */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <TrendingUp size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                تقرير أرباح الأصناف اليومية والتفصيلية
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                تحليل تكلفة ومبيعات وهوامش أرباح الأصناف المباعة بدقة بناءً على فواتير المبيعات
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

      {/* 2. Advanced Filters Bar */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 mb-6">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <Filter size={18} className="text-emerald-600" />
            <span>فلاتر تحليل أرباح وتكاليف المبيعات</span>
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>إعادة ضبط</span>
          </button>
        </div>

        {/* شبكة الفلاتر */}
        <div className="space-y-4">
          
          {/* الصف الأول من الفلاتر */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            
            {/* فلتر المستودع / الفرع */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Warehouse size={14} className="text-cyan-600" />
                  <span>المستودع / الفرع</span>
                </span>
                {selectedSource !== 'ALL' && (
                  <span className="text-[10px] text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded font-bold border border-cyan-200">
                    مفلتر
                  </span>
                )}
              </label>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="w-full py-2 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-cyan-500 transition-all cursor-pointer"
              >
                <option value="ALL">🏢 جميع المستودعات</option>
                {getDynamicWarehousesList([selectedSource !== 'ALL' ? selectedSource : '']).map(w => (
                  <option key={w.id} value={w.id}>{w.label}</option>
                ))}
              </select>
            </div>

            {/* فلتر العميل */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users size={14} className="text-blue-600" />
                  <span>العميل</span>
                </span>
                {selectedCustomerId !== 'ALL' && (
                  <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-bold border border-blue-200">
                    محدد
                  </span>
                )}
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full py-2 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="ALL">👥 جميع العملاء</option>
                {customersList.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* فلتر فئة الصنف */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers size={14} className="text-amber-600" />
                  <span>فئة الصنف</span>
                </span>
                {selectedCategory !== 'ALL' && (
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-bold border border-amber-200">
                    مفلتر
                  </span>
                )}
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full py-2 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 transition-all cursor-pointer"
              >
                <option value="ALL">📦 جميع الفئات</option>
                {availableCategories.map(cat => (
                  <option key={cat} value={cat}>
                    🏷️ {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* فلتر نوع الفاتورة والتعامل */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Receipt size={14} className="text-emerald-600" />
                  <span>نوع التعامل</span>
                </span>
                {selectedInvoiceType !== 'ALL' && (
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold border border-emerald-200">
                    مفلتر
                  </span>
                )}
              </label>
              <select
                value={selectedInvoiceType}
                onChange={(e) => setSelectedInvoiceType(e.target.value)}
                className="w-full py-2 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 transition-all cursor-pointer"
              >
                <option value="ALL">🧾 جميع الأنواع</option>
                <option value="CASH_SALES">💵 نقدي (كاش)</option>
                <option value="CREDIT_SALES">💳 آجل (ذمم)</option>
                <option value="RETURNS">↩️ مرتجعات</option>
              </select>
            </div>

            {/* فلتر مندوب المبيعات */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <UserCheck size={14} className="text-teal-600" />
                  <span>مندوب المبيعات</span>
                </span>
                {selectedSalesRep !== 'ALL' && (
                  <span className="text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded font-bold border border-teal-200">
                    محدد
                  </span>
                )}
              </label>
              <select
                value={selectedSalesRep}
                onChange={(e) => setSelectedSalesRep(e.target.value)}
                className="w-full py-2 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-teal-500 transition-all cursor-pointer"
              >
                <option value="ALL">👤 جميع المندوبين</option>
                {salesRepsList.map(rep => (
                  <option key={rep.id} value={rep.id}>{rep.label}</option>
                ))}
              </select>
            </div>

            {/* فلتر حالة الربحية */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-emerald-600" />
                  <span>حالة الربحية</span>
                </span>
                {selectedProfitStatus !== 'ALL' && (
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold border border-emerald-200">
                    مفلتر
                  </span>
                )}
              </label>
              <select
                value={selectedProfitStatus}
                onChange={(e) => setSelectedProfitStatus(e.target.value)}
                className="w-full py-2 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 transition-all cursor-pointer"
              >
                <option value="ALL">📊 جميع حالات الربح</option>
                <option value="PROFITABLE">🟢 أصناف رابحة فقط (+)</option>
                <option value="LOSS">🔴 أصناف خاسرة بأقل من التكلفة (-)</option>
                <option value="BREAK_EVEN">⚪ نقطة تعادل (بدون ربح/خسارة)</option>
              </select>
            </div>

          </div>

          {/* الصف الثاني: التواريخ والفترات السريعة وزر التحليل */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end pt-2 border-t border-slate-100">
            
            {/* Start Date */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                من تاريخ
              </label>
              <div className="relative">
                <Calendar size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pr-9 pl-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* End Date */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                إلى تاريخ
              </label>
              <div className="relative">
                <Calendar size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pr-9 pl-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* Quick Date Range Buttons */}
            <div className="lg:col-span-4">
              <label className="block text-xs font-bold text-slate-500 mb-1.5">
                فترات سريعة
              </label>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQuickPeriod('today')}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  اليوم
                </button>
                <button
                  type="button"
                  onClick={() => setQuickPeriod('week')}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  الأسبوع
                </button>
                <button
                  type="button"
                  onClick={() => setQuickPeriod('month')}
                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  الشهر
                </button>
                <button
                  type="button"
                  onClick={() => setQuickPeriod('quarter')}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  الربع
                </button>
                <button
                  type="button"
                  onClick={() => setQuickPeriod('year')}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  العام
                </button>
              </div>
            </div>

            {/* Search Button */}
            <div className="lg:col-span-2">
              <button
                type="button"
                onClick={handleSearch}
                disabled={loading}
                className="w-full py-2.5 px-3 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Search size={16} className={loading ? 'animate-spin' : ''} />
                <span>{loading ? 'جاري التحليل...' : 'تطبيق الفلاتر'}</span>
              </button>
            </div>
          </div>

        </div>

        {/* شريط الفلاتر النشطة */}
        {(selectedSource !== 'ALL' || selectedCustomerId !== 'ALL' || selectedCategory !== 'ALL' || selectedInvoiceType !== 'ALL' || selectedSalesRep !== 'ALL' || selectedProfitStatus !== 'ALL') && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-500 font-bold">الفلاتر النشطة:</span>
              
              {selectedSource !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-800 font-bold border border-cyan-200">
                  <Warehouse size={13} />
                  <span>المستودع: {selectedSourceLabel}</span>
                  <button onClick={() => setSelectedSource('ALL')} className="mr-1 text-cyan-700 hover:text-rose-600 font-bold cursor-pointer">×</button>
                </span>
              )}

              {selectedCustomerObj && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 font-bold border border-blue-200">
                  <Users size={13} />
                  <span>العميل: {selectedCustomerObj.name}</span>
                  <button onClick={() => setSelectedCustomerId('ALL')} className="mr-1 text-blue-700 hover:text-rose-600 font-bold cursor-pointer">×</button>
                </span>
              )}

              {selectedCategory !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-bold border border-amber-200">
                  <Layers size={13} />
                  <span>الفئة: {selectedCategory}</span>
                  <button onClick={() => setSelectedCategory('ALL')} className="mr-1 text-amber-700 hover:text-rose-600 font-bold cursor-pointer">×</button>
                </span>
              )}

              {selectedInvoiceType !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                  <Receipt size={13} />
                  <span>النوع: {selectedInvoiceTypeLabel}</span>
                  <button onClick={() => setSelectedInvoiceType('ALL')} className="mr-1 text-emerald-700 hover:text-rose-600 font-bold cursor-pointer">×</button>
                </span>
              )}

              {selectedSalesRep !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 font-bold border border-teal-200">
                  <UserCheck size={13} />
                  <span>المندوب: {selectedSalesRepLabel}</span>
                  <button onClick={() => setSelectedSalesRep('ALL')} className="mr-1 text-teal-700 hover:text-rose-600 font-bold cursor-pointer">×</button>
                </span>
              )}

              {selectedProfitStatus !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 font-bold border border-purple-200">
                  <TrendingUp size={13} />
                  <span>الحالة: {selectedProfitStatusLabel}</span>
                  <button onClick={() => setSelectedProfitStatus('ALL')} className="mr-1 text-purple-700 hover:text-rose-600 font-bold cursor-pointer">×</button>
                </span>
              )}
            </div>

            <button onClick={handleReset} className="text-xs text-rose-600 hover:underline font-bold cursor-pointer">
              مسح الفلاتر
            </button>
          </div>
        )}

        {/* Live Filter in Report */}
        {reportData.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                placeholder="بحث باسم الصنف، العميل، أو الفاتورة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white"
              />
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <Filter size={14} className="text-emerald-600" />
              <span>النتائج المطابقة: <strong className="text-emerald-700 font-mono text-sm">{filteredRows.length}</strong> من أصل {reportData.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. KPI Summary Cards */}
      {hasSearched && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          
          {/* Card 1: Total Sales */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1">إجمالي المبيعات</p>
              <h3 className="text-xl sm:text-2xl font-black text-blue-600">
                {grandTotalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-bold text-slate-400">ر.س</span>
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <DollarSign size={24} />
            </div>
          </div>

          {/* Card 2: Total Cost */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1">إجمالي التكلفة</p>
              <h3 className="text-xl sm:text-2xl font-black text-amber-600">
                {grandTotalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-bold text-slate-400">ر.س</span>
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Package size={24} />
            </div>
          </div>

          {/* Card 3: Net Profit */}
          <div className={`p-5 rounded-2xl border shadow-xs flex items-center justify-between ${grandNetProfit >= 0 ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'}`}>
            <div>
              <p className={`text-xs font-bold mb-1 ${grandNetProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>صافي الأرباح المحققة</p>
              <h3 className={`text-xl sm:text-2xl font-black ${grandNetProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {grandNetProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-bold opacity-75">ر.س</span>
              </h3>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${grandNetProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {grandNetProfit >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
            </div>
          </div>

          {/* Card 4: Profit Margin */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1">هامش الربح الإجمالي</p>
              <h3 className={`text-xl sm:text-2xl font-black ${overallMargin >= 20 ? 'text-emerald-600' : overallMargin >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                {overallMargin.toFixed(1)}%
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Percent size={24} />
            </div>
          </div>
        </div>
      )}

      {/* 4. Main Data Table */}
      <div id="printable-daily-profits-report" className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 text-xs font-bold">
              <tr>
                <th className="p-3.5 text-center w-12">#</th>
                <th className="p-3.5">التاريخ</th>
                <th className="p-3.5">رقم الفاتورة</th>
                <th className="p-3.5">العميل</th>
                <th className="p-3.5">اسم الصنف</th>
                <th className="p-3.5 text-center">المستودع</th>
                <th className="p-3.5 text-center">المندوب</th>
                <th className="p-3.5 text-center">الكمية</th>
                <th className="p-3.5 text-left">سعر الوحدة</th>
                <th className="p-3.5 text-left">إجمالي المبيع</th>
                <th className="p-3.5 text-left">التكلفة</th>
                <th className="p-3.5 text-left">صافي الربح</th>
                <th className="p-3.5 text-center">الهامش %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!hasSearched ? (
                <tr>
                  <td colSpan={13} className="p-14 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
                        <Sparkles size={26} />
                      </div>
                      <p className="font-bold text-slate-700 text-base">يرجى تحديد معايير البحث والضغط على "تطبيق الفلاتر"</p>
                      <p className="text-xs text-slate-400 max-w-md">
                        يقوم هذا التقرير بتحليل أرباح وتكاليف كل حركة بيع للأصناف وربطها بالعملاء والمستودعات والمناديب
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-12 text-center text-slate-500">
                    لا توجد بيانات مبيعات مطابقة للفلاتر المحددة
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const isProfitable = row.netProfit >= 0;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-center text-xs text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-semibold text-slate-700 whitespace-nowrap text-xs">{row.date}</td>
                      <td className="p-3 font-mono font-bold text-blue-600 whitespace-nowrap text-xs">{row.invoiceNumber}</td>
                      <td className="p-3 font-semibold text-slate-800 text-xs">
                        <div className="truncate max-w-[140px]">{row.customerName}</div>
                      </td>
                      <td className="p-3 font-bold text-slate-800 text-xs">
                        <div>{row.itemName}</div>
                        {row.itemCode && <div className="text-[10px] text-slate-400 font-mono">{row.itemCode}</div>}
                      </td>
                      <td className="p-3 text-center text-xs text-slate-600">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold">
                          {getWarehouseLabel(row.source)}
                        </span>
                      </td>
                      <td className="p-3 text-center text-xs text-slate-600">
                        <span className="text-[11px] font-medium text-slate-700">{row.salesRep || '-'}</span>
                      </td>
                      <td className="p-3 text-center font-bold text-slate-800 font-mono">{row.quantity}</td>
                      <td className="p-3 text-left font-mono text-slate-700 font-medium text-xs">
                        {row.unitPrice.toFixed(2)}
                      </td>
                      <td className="p-3 text-left font-mono font-bold text-blue-700 text-xs">
                        {row.totalSale.toFixed(2)}
                      </td>
                      <td className="p-3 text-left font-mono text-slate-600 text-xs">
                        {row.totalCost.toFixed(2)}
                      </td>
                      <td className={`p-3 text-left font-mono font-black text-xs ${isProfitable ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {row.netProfit.toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                          row.profitMargin >= 25 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : row.profitMargin >= 10
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : row.profitMargin >= 0
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {row.profitMargin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Footer Summary */}
            {filteredRows.length > 0 && (
              <tfoot className="bg-slate-900 text-white font-bold border-t-2 border-slate-700">
                <tr>
                  <td colSpan={7} className="p-4 text-xs">
                    إجمالي مبيعات وأرباح الفترة ({filteredRows.length} حركة):
                  </td>
                  <td className="p-4 text-center font-mono text-amber-400">
                    {totalQuantity}
                  </td>
                  <td className="p-4 text-left text-xs text-slate-400">---</td>
                  <td className="p-4 text-left font-mono text-blue-300 text-sm">
                    {grandTotalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 text-left font-mono text-amber-300 text-sm">
                    {grandTotalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`p-4 text-left font-mono text-sm ${grandNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {grandNetProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 text-center text-emerald-300 font-mono text-xs">
                    {overallMargin.toFixed(1)}%
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

export default DailyItemProfits;
