import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Gift, 
  Search, 
  Printer, 
  FileSpreadsheet, 
  RotateCcw, 
  Sparkles, 
  Users, 
  Package,
  Filter,
  Warehouse,
  Layers,
  UserCheck,
  Award,
  DollarSign
} from 'lucide-react';
import { loadStoredItems, getDynamicWarehousesList, getWarehouseLabel } from '../../../utils/itemsStore';
import { loadCustomers } from '../../../utils/partnerLedger';
import { exportToXLSX, exportToPDF } from '../../../utils/universalExport';
import { getUnifiedSalesInvoices, getDynamicSalesRepsList, doesInvoiceMatchSalesRep } from '../../../utils/salesReportsUnifiedStore';

interface BonusesAndSamplesProps {
  onNavigate?: (view: string | null) => void;
}

interface BonusRow {
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
  freeQuantity: number;
  unitCost: number;
  totalCost: number;
  regularPrice?: number | undefined;
  status: string;
}

export const BonusesAndSamples: React.FC<BonusesAndSamplesProps> = ({ onNavigate }) => {
  const todayStr = new Date().toISOString().substring(0, 10);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // أول الشهر الحالي
    return d.toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [reportData, setReportData] = useState<BonusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // الفلاتر المتقدمة
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSalesRep, setSelectedSalesRep] = useState<string>('ALL');

  // جلب قائمة العملاء للفلاتر
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

  // تسميات الفلاتر
  const selectedCustomerObj = useMemo(() => {
    if (selectedCustomerId === 'ALL') return null;
    return customersList.find(c => c.id === selectedCustomerId) || null;
  }, [selectedCustomerId, customersList]);

  const selectedSourceLabel = useMemo(() => {
    if (selectedSource === 'ALL') return null;
    return getWarehouseLabel(selectedSource);
  }, [selectedSource]);

  const salesRepsList = useMemo(() => getDynamicSalesRepsList(), []);

  const selectedSalesRepLabel = useMemo(() => {
    if (selectedSalesRep === 'ALL') return null;
    const found = salesRepsList.find(r => r.id === selectedSalesRep);
    return found ? found.label : selectedSalesRep;
  }, [selectedSalesRep, salesRepsList]);

  // تنفيذ الاستعلام وجلب بيانات البوانص والعينات
  const handleSearch = async () => {
    if (!startDate || !endDate) {
      alert('يرجى تحديد فترة البحث (من تاريخ / إلى تاريخ)');
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const allInvoices = await getUnifiedSalesInvoices();
      const rows: BonusRow[] = [];

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

        // فلتر مندوب المبيعات
        if (!doesInvoiceMatchSalesRep(inv.salesRepName, selectedSalesRep)) return;

        (inv.items || []).forEach((item, idx) => {
          const category = item.category || 'عام';
          if (selectedCategory !== 'ALL' && category !== selectedCategory) return;

          const qty = Number(item.quantity) || 0;
          const unitPrice = Number(item.unitPrice) || 0;
          const unitCost = Number(item.costPrice) || 0;

          // شرط البونص / الهدية: سعر البيع = 0 أو محدد كبونص
          if ((unitPrice === 0 || item.isBonus) && qty > 0) {
            const totalCost = Number((qty * unitCost).toFixed(2));

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
              freeQuantity: qty,
              unitCost: unitCost,
              totalCost: totalCost,
              regularPrice: Number(item.costPrice > 0 ? (item.costPrice * 1.3).toFixed(2) : 0),
              status: inv.statusCode === 'POSTED' ? 'معتمدة' : 'مسودة'
            });
          }
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
    setSelectedSalesRep('ALL');
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

  // تصفية البحث النصي
  const filteredRows = useMemo(() => {
    return reportData.filter(r => 
      !searchTerm || 
      (r.itemName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.itemCode && String(r.itemCode).toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [reportData, searchTerm]);

  // المجاميع المحسوبة
  const grandTotalCost = filteredRows.reduce((sum, r) => sum + r.totalCost, 0);
  const grandTotalQuantity = filteredRows.reduce((sum, r) => sum + r.freeQuantity, 0);
  const totalGiftsCount = filteredRows.length;
  const avgUnitCost = grandTotalQuantity > 0 ? grandTotalCost / grandTotalQuantity : 0;

  // تصدير Excel
  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      alert('لا توجد بيانات لتصديرها');
      return;
    }

    exportToXLSX({
      filename: `تقرير_البوانص_والعينات_المجانية_${startDate}_إلى_${endDate}.xlsx`,
      sheetName: 'البوانص والهدايا',
      title: 'تقرير البوانص والعينات المجانية والهدايا الترويجية',
      subtitle: `الفترة من: ${startDate} إلى: ${endDate}`,
      filterSummary: `الفترة: ${startDate} إلى ${endDate} | إجمالي تكلفة البوانص: ${grandTotalCost.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ر.س | إجمالي القطع المجانية: ${grandTotalQuantity.toLocaleString('ar-EG')}`,
      headers: [
        'م',
        'التاريخ',
        'رقم الفاتورة',
        'العميل المستفيد',
        'اسم الصنف المجاني',
        'التصنيف',
        'المستودع',
        'المندوب المسؤول',
        'الكمية المجانية',
        'تكلفة الوحدة',
        'إجمالي التكلفة الترويجية',
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
        r.freeQuantity,
        r.unitCost.toFixed(2),
        r.totalCost.toFixed(2),
        r.status
      ]),
      summaryRows: [
        [
          'الإجمالي الكلي للبوانص والإنفاق الترويجي',
          '-',
          '-',
          '-',
          `حركات: ${totalGiftsCount}`,
          '-',
          '-',
          '-',
          grandTotalQuantity,
          avgUnitCost.toFixed(2),
          grandTotalCost.toFixed(2),
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

    const printableElement = document.getElementById('printable-bonuses-report');
    if (printableElement) {
      exportToPDF({
        filename: `تقرير_البوانص_والعينات_المجانية_${startDate}_إلى_${endDate}.pdf`,
        title: 'تقرير البوانص والعينات المجانية والهدايا',
        subtitle: `الفترة من: ${startDate} إلى: ${endDate}`,
        headers: ['#', 'التاريخ', 'الفاتورة', 'العميل', 'الصنف المجاني', 'المندوب', 'الكمية', 'تكلفة الوحدة', 'إجمالي التكلفة'],
        rows: filteredRows.map((r, idx) => [
          idx + 1,
          r.date,
          r.invoiceNumber,
          r.customerName,
          r.itemName,
          r.salesRep || '-',
          r.freeQuantity,
          r.unitCost.toFixed(2),
          r.totalCost.toFixed(2)
        ]),
        summaryRows: [
          ['الإجمالي', '-', '-', '-', `حركات: ${totalGiftsCount}`, '-', grandTotalQuantity, avgUnitCost.toFixed(2), grandTotalCost.toFixed(2)]
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
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600">
              <Gift size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                تقرير البوانص والعينات المجانية والهدايا
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                حصر شامل لكافة الأصناف المنصرفة مجاناً واحتساب تكلفتها الترويجية والتسويقية
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
            <Filter size={18} className="text-purple-600" />
            <span>فلاتر حصر البوانص والإنفاق الترويجي</span>
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
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            
            {/* فلتر المستودع / الفرع */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Warehouse size={14} className="text-cyan-600" />
                  <span>المستودع المنصرف منه</span>
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
                  <span>العميل المستفيد</span>
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
                  <span>فئة الصنف المجاني</span>
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

            {/* فلتر مندوب المبيعات */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <UserCheck size={14} className="text-teal-600" />
                  <span>المندوب المسؤول</span>
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
                  className="w-full pr-9 pl-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-purple-500 transition-all"
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
                  className="w-full pr-9 pl-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-purple-500 transition-all"
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
                  className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
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
                className="w-full py-2.5 px-3 bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Search size={16} className={loading ? 'animate-spin' : ''} />
                <span>{loading ? 'جاري الحصر...' : 'حصر البوانص'}</span>
              </button>
            </div>
          </div>

        </div>

        {/* شريط الفلاتر النشطة */}
        {(selectedSource !== 'ALL' || selectedCustomerId !== 'ALL' || selectedCategory !== 'ALL' || selectedSalesRep !== 'ALL') && (
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

              {selectedSalesRep !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 font-bold border border-teal-200">
                  <UserCheck size={13} />
                  <span>المندوب: {selectedSalesRepLabel}</span>
                  <button onClick={() => setSelectedSalesRep('ALL')} className="mr-1 text-teal-700 hover:text-rose-600 font-bold cursor-pointer">×</button>
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
                className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-purple-500 focus:bg-white"
              />
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            
            <div className="flex items-center gap-2 text-xs font-bold text-purple-700">
              <Gift size={14} className="text-purple-600" />
              <span>حركات البونص المنصرفة: <strong className="font-mono text-sm">{filteredRows.length}</strong> من أصل {reportData.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. KPI Summary Cards */}
      {hasSearched && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          
          {/* Card 1: Total Promo Cost */}
          <div className="bg-purple-50/70 p-5 rounded-2xl border border-purple-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-purple-800 mb-1">إجمالي التكلفة الترويجية</p>
              <h3 className="text-xl sm:text-2xl font-black text-purple-700">
                {grandTotalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-bold opacity-75">ر.س</span>
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <DollarSign size={24} />
            </div>
          </div>

          {/* Card 2: Total Free Quantity */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1">إجمالي القطع المجانية</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
                {grandTotalQuantity.toLocaleString('en-US')} <span className="text-xs font-semibold text-slate-500">قطعة</span>
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Package size={24} />
            </div>
          </div>

          {/* Card 3: Gifts Operations Count */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1">عدد حركات صرف الهدايا</p>
              <h3 className="text-xl sm:text-2xl font-black text-indigo-600">
                {totalGiftsCount} <span className="text-xs font-semibold text-slate-500">حركة</span>
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Gift size={24} />
            </div>
          </div>

          {/* Card 4: Avg Unit Cost */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1">متوسط تكلفة القطعة</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-800">
                {avgUnitCost.toFixed(2)} <span className="text-xs font-bold text-slate-400">ر.س</span>
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
              <Award size={24} />
            </div>
          </div>
        </div>
      )}

      {/* 4. Main Data Table */}
      <div id="printable-bonuses-report" className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 text-xs font-bold">
              <tr>
                <th className="p-3.5 text-center w-12">#</th>
                <th className="p-3.5">التاريخ</th>
                <th className="p-3.5">رقم الفاتورة</th>
                <th className="p-3.5">العميل المستفيد</th>
                <th className="p-3.5">اسم الصنف المجاني</th>
                <th className="p-3.5 text-center">المستودع</th>
                <th className="p-3.5 text-center">المندوب المسؤول</th>
                <th className="p-3.5 text-center">الكمية المجانية</th>
                <th className="p-3.5 text-left">تكلفة الوحدة</th>
                <th className="p-3.5 text-left">إجمالي التكلفة</th>
                <th className="p-3.5 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!hasSearched ? (
                <tr>
                  <td colSpan={11} className="p-14 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-xs">
                        <Gift size={26} />
                      </div>
                      <p className="font-bold text-slate-700 text-base">يرجى تحديد الفترة والضغط على "حصر البوانص"</p>
                      <p className="text-xs text-slate-400 max-w-md">
                        يقوم هذا التقرير بحصر وتجميع كافة الأصناف المنصرفة مجاناً واحتساب تكاليفها على المنشأة
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-slate-500">
                    لا توجد بوانص أو عينات مجانية منصرفة خلال الفترة المحددة
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  return (
                    <tr key={row.id} className="hover:bg-purple-50/30 transition-colors">
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
                      <td className="p-3 text-center font-bold text-purple-700 font-mono">{row.freeQuantity}</td>
                      <td className="p-3 text-left font-mono text-slate-700 font-medium text-xs">
                        {row.unitCost.toFixed(2)}
                      </td>
                      <td className="p-3 text-left font-mono font-bold text-purple-700 text-xs">
                        {row.totalCost.toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {row.status}
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
                    إجمالي الإنفاق الترويجي ({filteredRows.length} حركة هدية / عينة):
                  </td>
                  <td className="p-4 text-center font-mono text-purple-300">
                    {grandTotalQuantity}
                  </td>
                  <td className="p-4 text-left text-xs text-slate-400">---</td>
                  <td className="p-4 text-left font-mono text-purple-300 text-sm">
                    {grandTotalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

export default BonusesAndSamples;
