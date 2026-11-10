import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Search, 
  Printer, 
  FileSpreadsheet, 
  RotateCcw, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  PieChart, 
  Layers, 
  Users, 
  ArrowUpDown, 
  PackageCheck,
  Filter,
  Warehouse,
  Receipt,
  UserCheck,
  Award,
  ChevronLeft
} from 'lucide-react';
import { loadStoredItems, getDynamicWarehousesList, getWarehouseLabel } from '../../../utils/itemsStore';
import { loadCustomers } from '../../../utils/partnerLedger';
import { exportToXLSX, exportToPDF } from '../../../utils/universalExport';
import { getUnifiedSalesInvoices, getDynamicSalesRepsList, doesInvoiceMatchSalesRep } from '../../../utils/salesReportsUnifiedStore';

interface SalesProfitabilitySummaryProps {
  onNavigate?: (view: string | null) => void;
}

interface ProfitabilityGroupRow {
  id: string;
  customerName: string;
  customerId?: string | undefined;
  categoryName: string;
  itemName: string;
  itemCode?: string | undefined;
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  profitMargin: number;
  invoiceCount: number;
  rank: number;
}

export const SalesProfitabilitySummary: React.FC<SalesProfitabilitySummaryProps> = ({ onNavigate }) => {
  const todayStr = new Date().toISOString().substring(0, 10);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // أول الشهر الحالي افتراضياً
    return d.toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [reportData, setReportData] = useState<ProfitabilityGroupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // الفلاتر المتقدمة
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedInvoiceType, setSelectedInvoiceType] = useState<string>('ALL');
  const [selectedSalesRep, setSelectedSalesRep] = useState<string>('ALL');
  const [selectedProfitStatus, setSelectedProfitStatus] = useState<string>('ALL');

  const [sortBy, setSortBy] = useState<'profit' | 'revenue' | 'quantity' | 'margin'>('profit');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // جلب كتالوج الأصناف وقائمة العملاء
  const localCatalog = useMemo(() => {
    try {
      return loadStoredItems();
    } catch {
      return [];
    }
  }, []);

  const customersList = useMemo(() => {
    try {
      return loadCustomers();
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
      if (row.categoryName && row.categoryName !== 'عام') set.add(row.categoryName);
    });
    return Array.from(set).sort();
  }, [localCatalog, reportData]);

  // تسميات الفلاتر
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
      default: return null;
    }
  }, [selectedProfitStatus]);

  // استعلام وجلب وتجميع بيانات الربحية
  const handleSearch = async () => {
    if (!startDate || !endDate) {
      alert('يرجى تحديد فترة البحث (من تاريخ / إلى تاريخ)');
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const allInvoices = await getUnifiedSalesInvoices();
      const groupedMap: Record<string, ProfitabilityGroupRow> = {};

      allInvoices.forEach(inv => {
        const invDate = (inv.date || inv.createdAt || '').substring(0, 10);
        if (!invDate || invDate < startDate || invDate > endDate) return;

        // فلتر المستودع
        if (selectedSource !== 'ALL') {
          const src = (inv.source || 'MAIN_WAREHOUSE').toUpperCase();
          if (src !== selectedSource.toUpperCase()) return;
        }

        // فلتر العميل
        if (selectedCustomer !== 'ALL') {
          if (inv.partnerId !== selectedCustomer && inv.partnerName !== selectedCustomer) return;
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

        const custName = inv.partnerName || 'عميل نقدي';
        const custId = inv.partnerId || 'general';

        (inv.items || []).forEach(item => {
          const categoryName = item.category || 'عام';
          if (selectedCategory !== 'ALL' && categoryName !== selectedCategory) return;

          const itemName = item.description || 'صنف غير محدد';
          const itemCode = item.itemCode;
          const qty = Number(item.quantity) || 0;
          const unitPrice = Number(item.unitPrice) || 0;
          const unitCost = Number(item.costPrice) || 0;
          const lineRevenue = Number(item.totalSale ?? (qty * unitPrice)) || 0;
          const lineCost = Number(item.totalCost ?? (qty * unitCost)) || 0;

          if (qty > 0) {
            const compositeKey = `${custName}:::${categoryName}:::${itemName}`;

            if (!groupedMap[compositeKey]) {
              groupedMap[compositeKey] = {
                id: compositeKey,
                customerName: custName,
                customerId: custId,
                categoryName: categoryName,
                itemName: itemName,
                itemCode: itemCode,
                totalQuantity: 0,
                totalRevenue: 0,
                totalCost: 0,
                netProfit: 0,
                profitMargin: 0,
                invoiceCount: 0,
                rank: 0
              };
            }

            const entry = groupedMap[compositeKey]!;
            entry.totalQuantity += qty;
            entry.totalRevenue += lineRevenue;
            entry.totalCost += lineCost;
            entry.invoiceCount += 1;
          }
        });
      });

      // احتساب الأرباح والهوامش
      let sortedList: ProfitabilityGroupRow[] = Object.values(groupedMap)
        .map(row => {
          const netProfit = Number((row.totalRevenue - row.totalCost).toFixed(2));
          const margin = row.totalRevenue > 0 ? Number(((netProfit / row.totalRevenue) * 100).toFixed(2)) : (row.totalCost > 0 ? -100 : 0);
          return {
            ...row,
            netProfit: netProfit,
            profitMargin: margin
          };
        });

      if (selectedProfitStatus === 'PROFITABLE') {
        sortedList = sortedList.filter(r => r.netProfit > 0);
      } else if (selectedProfitStatus === 'LOSS') {
        sortedList = sortedList.filter(r => r.netProfit < 0);
      }

      sortedList.sort((a, b) => b.netProfit - a.netProfit);
      sortedList = sortedList.map((r, idx) => ({ ...r, rank: idx + 1 }));

      setReportData(sortedList);
    } catch (err: any) {
      alert(`خطأ أثناء استعلام الربحية: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // إعادة ضبط
  const handleReset = () => {
    const d = new Date();
    d.setDate(1);
    setStartDate(d.toISOString().substring(0, 10));
    setEndDate(todayStr);
    setSelectedSource('ALL');
    setSelectedCustomer('ALL');
    setSelectedCategory('ALL');
    setSelectedInvoiceType('ALL');
    setSelectedSalesRep('ALL');
    setSelectedProfitStatus('ALL');
    setSearchTerm('');
  };

  // فترات سريعة
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

  // تصفية وترتيب القائمة
  const filteredAndSortedList = useMemo(() => {
    let result = reportData.filter(row => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (row.customerName || '').toLowerCase().includes(term) ||
        (row.itemName || '').toLowerCase().includes(term) ||
        (row.categoryName || '').toLowerCase().includes(term) ||
        (row.itemCode && String(row.itemCode).toLowerCase().includes(term))
      );
    });

    result.sort((a, b) => {
      let valA: any = a.netProfit;
      let valB: any = b.netProfit;

      if (sortBy === 'revenue') {
        valA = a.totalRevenue;
        valB = b.totalRevenue;
      } else if (sortBy === 'quantity') {
        valA = a.totalQuantity;
        valB = b.totalQuantity;
      } else if (sortBy === 'margin') {
        valA = a.profitMargin;
        valB = b.profitMargin;
      }

      if (sortDirection === 'asc') {
        return valA > valB ? 1 : -1;
      }
      return valA < valB ? 1 : -1;
    });

    return result;
  }, [reportData, searchTerm, sortBy, sortDirection]);

  // المجاميع المحسوبة
  const grandTotalQuantity = useMemo(() => filteredAndSortedList.reduce((sum, r) => sum + r.totalQuantity, 0), [filteredAndSortedList]);
  const grandTotalRevenue = useMemo(() => filteredAndSortedList.reduce((sum, r) => sum + r.totalRevenue, 0), [filteredAndSortedList]);
  const grandTotalCost = useMemo(() => filteredAndSortedList.reduce((sum, r) => sum + r.totalCost, 0), [filteredAndSortedList]);
  const grandTotalNetProfit = useMemo(() => filteredAndSortedList.reduce((sum, r) => sum + r.netProfit, 0), [filteredAndSortedList]);
  const overallProfitMargin = grandTotalRevenue > 0 ? (grandTotalNetProfit / grandTotalRevenue) * 100 : 0;
  const profitableGroupsCount = filteredAndSortedList.filter(r => r.netProfit > 0).length;
  const lossGroupsCount = filteredAndSortedList.filter(r => r.netProfit < 0).length;

  // تصدير Excel
  const handleExportExcel = () => {
    if (filteredAndSortedList.length === 0) {
      alert('لا توجد بيانات للتصدير');
      return;
    }

    exportToXLSX({
      filename: `تقرير_ربحية_المبيعات_الشامل_${startDate}_إلى_${endDate}.xlsx`,
      sheetName: 'تحليل الربحية والهوامش',
      title: 'تقرير تحليل ربحية المبيعات الشامل وهوامش الأرباح',
      subtitle: `الفترة من: ${startDate} إلى: ${endDate}`,
      filterSummary: `الفترة: ${startDate} إلى ${endDate} | إجمالي المبيعات: ${grandTotalRevenue.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ر.س | صافي الأرباح: ${grandTotalNetProfit.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ر.س | هامش الربح: ${overallProfitMargin.toFixed(1)}%`,
      headers: [
        'الترتيب',
        'العميل',
        'فئة الصنف',
        'اسم الصنف',
        'الكمية المباعة',
        'إجمالي الإيراد (المبيعات)',
        'إجمالي التكلفة التقديرية',
        'صافي الربح المحقق',
        'هامش الربح %',
        'عدد الفواتير'
      ],
      rows: filteredAndSortedList.map(r => [
        r.rank,
        r.customerName,
        r.categoryName,
        r.itemName,
        r.totalQuantity,
        r.totalRevenue.toFixed(2),
        r.totalCost.toFixed(2),
        r.netProfit.toFixed(2),
        `${r.profitMargin.toFixed(1)}%`,
        r.invoiceCount
      ]),
      summaryRows: [
        [
          'الإجمالي الكلي',
          '-',
          '-',
          `مجموعات: ${filteredAndSortedList.length}`,
          grandTotalQuantity,
          grandTotalRevenue.toFixed(2),
          grandTotalCost.toFixed(2),
          grandTotalNetProfit.toFixed(2),
          `${overallProfitMargin.toFixed(1)}%`,
          '-'
        ]
      ]
    });
  };

  // تصدير PDF
  const handleExportPDF = () => {
    if (filteredAndSortedList.length === 0) {
      alert('لا توجد بيانات للطباعة');
      return;
    }

    const printableElement = document.getElementById('printable-profitability-summary-report');
    if (printableElement) {
      exportToPDF({
        filename: `تقرير_ربحية_المبيعات_${startDate}_إلى_${endDate}.pdf`,
        title: 'تقرير تحليل ربحية المبيعات الشامل',
        subtitle: `الفترة من ${startDate} إلى ${endDate}`,
        headers: ['#', 'العميل', 'الفئة', 'الصنف', 'الكمية', 'الإيراد', 'التكلفة', 'صافي الربح', 'الهامش %'],
        rows: filteredAndSortedList.map(r => [
          r.rank,
          r.customerName,
          r.categoryName,
          r.itemName,
          r.totalQuantity,
          r.totalRevenue.toFixed(2),
          r.totalCost.toFixed(2),
          r.netProfit.toFixed(2),
          `${r.profitMargin.toFixed(1)}%`
        ]),
        summaryRows: [
          ['الإجمالي', '-', '-', `مجموعات: ${filteredAndSortedList.length}`, grandTotalQuantity, grandTotalRevenue.toFixed(2), grandTotalCost.toFixed(2), grandTotalNetProfit.toFixed(2), `${overallProfitMargin.toFixed(1)}%`]
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
              <PieChart size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                تحليل ربحية المبيعات الشامل (هوامش الأرباح)
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                تحليل مالي مجمع لربحية المبيعات مفرزاً حسب العميل، الفئة، والصنف مع احتساب هوامش الربح
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
            <span>فلاتر تحليل الربحية وهوامش الأرباح</span>
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
                {selectedCustomer !== 'ALL' && (
                  <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-bold border border-blue-200">
                    محدد
                  </span>
                )}
              </label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
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
                <option value="ALL">👤 جميع المناديب</option>
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
                <option value="ALL">📊 جميع المعاملات</option>
                <option value="PROFITABLE">🟢 صفقات رابحة فقط (+)</option>
                <option value="LOSS">🔴 صفقات خاسرة (-)</option>
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
                  onClick={() => setQuickRange('today')}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  اليوم
                </button>
                <button
                  type="button"
                  onClick={() => setQuickRange('week')}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  الأسبوع
                </button>
                <button
                  type="button"
                  onClick={() => setQuickRange('month')}
                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  الشهر
                </button>
                <button
                  type="button"
                  onClick={() => setQuickRange('quarter')}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  الربع
                </button>
                <button
                  type="button"
                  onClick={() => setQuickRange('year')}
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
        {(selectedSource !== 'ALL' || selectedCustomer !== 'ALL' || selectedCategory !== 'ALL' || selectedInvoiceType !== 'ALL' || selectedSalesRep !== 'ALL' || selectedProfitStatus !== 'ALL') && (
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

              {selectedCustomer !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 font-bold border border-blue-200">
                  <Users size={13} />
                  <span>العميل: {customersList.find(c => c.id === selectedCustomer)?.name || selectedCustomer}</span>
                  <button onClick={() => setSelectedCustomer('ALL')} className="mr-1 text-blue-700 hover:text-rose-600 font-bold cursor-pointer">×</button>
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
                placeholder="بحث بالعميل أو اسم الصنف أو الفئة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white"
              />
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <Filter size={14} className="text-emerald-600" />
              <span>المجموعات المطابقة: <strong className="text-emerald-700 font-mono text-sm">{filteredAndSortedList.length}</strong> من أصل {reportData.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. KPI Summary Cards */}
      {hasSearched && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          
          {/* Card 1: Total Revenue */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1">إجمالي الإيرادات (المبيعات)</p>
              <h3 className="text-xl sm:text-2xl font-black text-blue-600">
                {grandTotalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-bold text-slate-400">ر.س</span>
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
              <Layers size={24} />
            </div>
          </div>

          {/* Card 3: Net Profit */}
          <div className={`p-5 rounded-2xl border shadow-xs flex items-center justify-between ${grandTotalNetProfit >= 0 ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'}`}>
            <div>
              <p className={`text-xs font-bold mb-1 ${grandTotalNetProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>صافي الأرباح الإجمالية</p>
              <h3 className={`text-xl sm:text-2xl font-black ${grandTotalNetProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {grandTotalNetProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-bold opacity-75">ر.س</span>
              </h3>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${grandTotalNetProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {grandTotalNetProfit >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
            </div>
          </div>

          {/* Card 4: Profit Margin */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1">متوسط هامش الربح</p>
              <h3 className={`text-xl sm:text-2xl font-black ${overallProfitMargin >= 20 ? 'text-emerald-600' : overallProfitMargin >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                {overallProfitMargin.toFixed(1)}%
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <PieChart size={24} />
            </div>
          </div>
        </div>
      )}

      {/* 4. Main Data Table */}
      <div id="printable-profitability-summary-report" className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 text-xs font-bold">
              <tr>
                <th className="p-3.5 text-center w-12">#</th>
                <th className="p-3.5">العميل</th>
                <th className="p-3.5">فئة الصنف</th>
                <th className="p-3.5">اسم الصنف</th>
                <th className="p-3.5 text-center cursor-pointer hover:bg-slate-100" onClick={() => { setSortBy('quantity'); setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); }}>
                  <div className="flex items-center justify-center gap-1">
                    <span>الكمية المباعة</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5 text-left cursor-pointer hover:bg-slate-100" onClick={() => { setSortBy('revenue'); setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); }}>
                  <div className="flex items-center justify-end gap-1">
                    <span>إجمالي الإيراد</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5 text-left">التكلفة</th>
                <th className="p-3.5 text-left cursor-pointer hover:bg-slate-100" onClick={() => { setSortBy('profit'); setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); }}>
                  <div className="flex items-center justify-end gap-1">
                    <span>صافي الربح</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5 text-center cursor-pointer hover:bg-slate-100" onClick={() => { setSortBy('margin'); setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); }}>
                  <div className="flex items-center justify-center gap-1">
                    <span>الهامش %</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5 text-center">الفواتير</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!hasSearched ? (
                <tr>
                  <td colSpan={10} className="p-14 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
                        <PieChart size={26} />
                      </div>
                      <p className="font-bold text-slate-700 text-base">يرجى تحديد الفترة والضغط على "تطبيق الفلاتر"</p>
                      <p className="text-xs text-slate-400 max-w-md">
                        يقوم هذا التقرير بتحليل شامل لربحية المبيعات وهوامش الربح مفرزاً حسب العميل والفئة والصنف
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredAndSortedList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-500">
                    لا توجد بيانات ربحية مطابقة للفلاتر المحددة
                  </td>
                </tr>
              ) : (
                filteredAndSortedList.map((row, idx) => {
                  const isProfitable = row.netProfit >= 0;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-center text-xs text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-semibold text-slate-800 text-xs">
                        <div className="truncate max-w-[140px]">{row.customerName}</div>
                      </td>
                      <td className="p-3 text-xs text-slate-600">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold">
                          {row.categoryName}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-800 text-xs">
                        <div>{row.itemName}</div>
                        {row.itemCode && <div className="text-[10px] text-slate-400 font-mono">{row.itemCode}</div>}
                      </td>
                      <td className="p-3 text-center font-bold text-slate-800 font-mono">{row.totalQuantity}</td>
                      <td className="p-3 text-left font-mono font-bold text-blue-700 text-xs">
                        {row.totalRevenue.toFixed(2)}
                      </td>
                      <td className="p-3 text-left font-mono text-slate-600 text-xs">
                        {row.totalCost.toFixed(2)}
                      </td>
                      <td className={`p-3 text-left font-mono font-black text-xs ${isProfitable ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {row.netProfit.toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
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
                      <td className="p-3 text-center font-mono text-xs text-slate-600">{row.invoiceCount}</td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Footer Summary */}
            {filteredAndSortedList.length > 0 && (
              <tfoot className="bg-slate-900 text-white font-bold border-t-2 border-slate-700">
                <tr>
                  <td colSpan={4} className="p-4 text-xs">
                    الإجمالي الكلي ({filteredAndSortedList.length} مجموعة):
                  </td>
                  <td className="p-4 text-center font-mono text-amber-400">
                    {grandTotalQuantity}
                  </td>
                  <td className="p-4 text-left font-mono text-blue-300 text-sm">
                    {grandTotalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 text-left font-mono text-amber-300 text-sm">
                    {grandTotalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`p-4 text-left font-mono text-sm ${grandTotalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {grandTotalNetProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 text-center text-emerald-300 font-mono text-xs">
                    {overallProfitMargin.toFixed(1)}%
                  </td>
                  <td className="p-4 text-center text-slate-400 text-xs">-</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  );
};

export default SalesProfitabilitySummary;
