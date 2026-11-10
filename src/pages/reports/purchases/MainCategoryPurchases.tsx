import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, 
  Layers, 
  Search, 
  Printer, 
  FileText, 
  RotateCcw, 
  DollarSign, 
  FileSpreadsheet, 
  Package,
  Award,
  ArrowUpDown,
  ArrowLeft,
  Filter,
  Truck,
  Warehouse,
  CreditCard,
  X,
  PieChart,
  BarChart3,
  TrendingUp
} from 'lucide-react';
import { supabase } from '../../../services/supabaseClient';
import { loadStoredPurchaseInvoices } from '../../../utils/purchasesStore';
import { loadStoredItems, getDynamicWarehousesList, getWarehouseLabel } from '../../../utils/itemsStore';
import { loadVendors } from '../../../utils/partnerLedger';
import { exportToXLSX, exportToPDF } from '../../../utils/universalExport';
import { useSystemCurrency } from '../../../utils/currency';

interface MainCategoryPurchasesProps {
  onNavigate?: (view: string | null) => void;
}

export interface RawCategoryPurchaseLine {
  categoryId: string;
  categoryName: string;
  quantity: number;
  lineTotal: number;
  itemName: string;
  invoiceId: string;
  supplierId: string;
  supplierName: string;
  warehouseName: string;
  paymentType: string;
  date: string;
}

export interface CategoryPurchaseGroupRow {
  categoryId: string;
  categoryName: string;
  totalQuantity: number;
  totalCost: number;
  itemsCount: number;
  invoiceCount: number;
  percentageOfTotal: number;
  averageItemCost: number;
  rank: number;
}

export const MainCategoryPurchases: React.FC<MainCategoryPurchasesProps> = ({ onNavigate }) => {
  const { symbol: currencySymbol } = useSystemCurrency();
  const todayStr = new Date().toISOString().substring(0, 10);
  
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // أول الشهر الحالي افتراضياً
    return d.toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(todayStr);

  // الفلاتر المتقدمة
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [selectedPaymentType, setSelectedPaymentType] = useState<string>('ALL');

  const [rawLines, setRawLines] = useState<RawCategoryPurchaseLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'cost' | 'quantity' | 'name'>('cost');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // جلب كتالوج الأصناف وقائمة الموردين
  const localCatalog = useMemo(() => {
    try {
      return loadStoredItems();
    } catch {
      return [];
    }
  }, []);

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

    try {
      let { data, error } = await supabase
        .from('purchase_lines')
        .select(`
          id,
          purchase_id,
          product_id,
          quantity,
          unit_price,
          line_total,
          cost_price,
          products (
            id,
            name,
            category,
            category_id,
            categories (
              id,
              name
            )
          ),
          purchase_invoices!inner (
            id,
            invoice_number,
            created_at,
            vendor_id,
            supplier_id,
            supplier_name,
            warehouse_name,
            payment_type,
            status
          )
        `)
        .gte('purchase_invoices.created_at', startDate)
        .lte('purchase_invoices.created_at', `${endDate}T23:59:59`);

      if (error || !data || data.length === 0) {
        // Fallback: جلب البيانات من التخزين المحلي
        const localInvoices = loadStoredPurchaseInvoices();
        const filteredInvoices = localInvoices.filter(inv => {
          const invDate = inv.date || inv.createdAt?.substring(0, 10);
          return invDate >= startDate && invDate <= endDate;
        });

        const lines: RawCategoryPurchaseLine[] = [];

        filteredInvoices.forEach(inv => {
          const matchedVendor = allVendors.find(v => v.id === inv.partnerId || v.name === inv.partnerName);
          const supplierName = inv.partnerName || matchedVendor?.name || 'مورد عام';
          const supplierId = inv.partnerId || matchedVendor?.id || 'VENDOR_GENERAL';
          const warehouseName = inv.warehouseName || 'MAIN_WAREHOUSE';
          const paymentType = inv.paymentMethod || inv.paymentType || 'CASH';
          const invDate = inv.date || inv.createdAt?.substring(0, 10) || todayStr;

          (inv.items || []).forEach(item => {
            const matchedCatalogItem = localCatalog.find(c => 
              (item.itemId && c.id === item.itemId) || 
              (item.itemCode && c.code === item.itemCode) ||
              (item.description && c.name.trim().toLowerCase() === item.description.trim().toLowerCase())
            );

            const categoryName = (matchedCatalogItem as any)?.category || 
                                 (matchedCatalogItem as any)?.categoryName || 
                                 (item as any)?.category || 
                                 'عام / غير مصنف';
            
            const categoryId = (matchedCatalogItem as any)?.categoryId || categoryName;
            const qty = Number(item.quantity) || 0;
            const unitPrice = Number(item.unitPrice || (item as any).costPrice || 0);
            const lineTotal = Number((item as any).total ?? (item as any).line_total ?? (qty * unitPrice)) || 0;
            const itemName = item.description || matchedCatalogItem?.name || 'صنف';

            if (qty > 0) {
              lines.push({
                categoryId,
                categoryName: categoryName.trim(),
                quantity: qty,
                lineTotal,
                itemName,
                invoiceId: inv.id || inv.invoiceNumber,
                supplierId,
                supplierName,
                warehouseName,
                paymentType,
                date: invDate
              });
            }
          });
        });

        setRawLines(lines);
      } else {
        const lines: RawCategoryPurchaseLine[] = [];

        (data || []).forEach((row: any) => {
          const p = row.products;
          const inv = row.purchase_invoices;
          const categoryName = p?.categories?.name || p?.category || 'عام / غير مصنف';
          const categoryId = p?.categories?.id || p?.category_id || categoryName;
          const qty = Number(row.quantity) || 0;
          const lineTotal = Number(row.line_total || (qty * Number(row.unit_price || row.cost_price || 0))) || 0;
          const itemName = p?.name || 'صنف';

          if (qty > 0) {
            lines.push({
              categoryId,
              categoryName: categoryName.trim(),
              quantity: qty,
              lineTotal,
              itemName,
              invoiceId: inv?.id || inv?.invoice_number || 'INV',
              supplierId: inv?.vendor_id || inv?.supplier_id || 'VENDOR',
              supplierName: inv?.supplier_name || 'مورد عام',
              warehouseName: inv?.warehouse_name || 'MAIN_WAREHOUSE',
              paymentType: inv?.payment_type || 'CASH',
              date: inv?.created_at?.substring(0, 10) || todayStr
            });
          }
        });

        setRawLines(lines);
      }
    } catch (err) {
      console.error('Error fetching category purchases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSearch();
  }, []);

  // أزرار الفترات السريعة
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

  // قائمة الفئات المتاحة للفلترة
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    rawLines.forEach(l => {
      if (l.categoryName) set.add(l.categoryName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [rawLines]);

  // تصفية وتجميع البيانات حسب الفئات الرئيسية
  const reportData = useMemo(() => {
    const filtered = rawLines.filter(l => {
      // فلتر الفئة المحددة
      if (selectedCategory !== 'ALL' && l.categoryName !== selectedCategory) return false;

      // فلتر المورد
      if (selectedSupplierId !== 'ALL') {
        const matchId = l.supplierId === selectedSupplierId;
        const matchedVendorObj = allVendors.find(v => v.id === selectedSupplierId);
        const matchName = matchedVendorObj && (l.supplierName || '').toLowerCase().includes((matchedVendorObj.name || '').toLowerCase());
        if (!matchId && !matchName) return false;
      }

      // فلتر المستودع
      if (selectedWarehouse !== 'ALL') {
        const wh = (l.warehouseName || '').toUpperCase();
        const targetWh = selectedWarehouse.toUpperCase();
        if (targetWh === 'MAIN_WAREHOUSE') {
          if (!wh.includes('MAIN') && !wh.includes('رئيسي')) return false;
        } else if (wh !== targetWh && getWarehouseLabel(l.warehouseName) !== getWarehouseLabel(selectedWarehouse)) {
          return false;
        }
      }

      // فلتر نوع السداد
      if (selectedPaymentType !== 'ALL') {
        const pType = (l.paymentType || '').toUpperCase();
        if (selectedPaymentType === 'CASH' && pType !== 'CASH') return false;
        if (selectedPaymentType === 'CREDIT' && pType !== 'CREDIT') return false;
      }

      return true;
    });

    // تجميع البيانات
    const groupedMap = filtered.reduce((acc: Record<string, {
      categoryId: string;
      categoryName: string;
      totalQuantity: number;
      totalCost: number;
      itemNames: Set<string>;
      invoiceIds: Set<string>;
    }>, line) => {
      const key = line.categoryName.trim() || 'عام / غير مصنف';

      if (!acc[key]) {
        acc[key] = {
          categoryId: line.categoryId || key,
          categoryName: key,
          totalQuantity: 0,
          totalCost: 0,
          itemNames: new Set<string>(),
          invoiceIds: new Set<string>()
        };
      }

      acc[key].totalQuantity += line.quantity;
      acc[key].totalCost += line.lineTotal;
      if (line.itemName) acc[key].itemNames.add(line.itemName);
      if (line.invoiceId) acc[key].invoiceIds.add(line.invoiceId);

      return acc;
    }, {});

    const totalPeriodCost = Object.values(groupedMap).reduce((sum, g) => sum + g.totalCost, 0);

    return Object.values(groupedMap)
      .map(g => ({
        categoryId: g.categoryId,
        categoryName: g.categoryName,
        totalQuantity: g.totalQuantity,
        totalCost: g.totalCost,
        itemsCount: g.itemNames.size || 1,
        invoiceCount: g.invoiceIds.size || 1,
        percentageOfTotal: totalPeriodCost > 0 ? (g.totalCost / totalPeriodCost) * 100 : 0,
        averageItemCost: g.totalQuantity > 0 ? g.totalCost / g.totalQuantity : 0,
        rank: 0
      }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .map((row, idx) => ({ ...row, rank: idx + 1 }));

  }, [rawLines, selectedCategory, selectedSupplierId, selectedWarehouse, selectedPaymentType, allVendors]);

  // المجاميع الإجمالية
  const grandTotalCost = useMemo(() => reportData.reduce((sum, r) => sum + r.totalCost, 0), [reportData]);
  const grandTotalQuantity = useMemo(() => reportData.reduce((sum, r) => sum + r.totalQuantity, 0), [reportData]);
  const totalCategoriesCount = reportData.length;
  const overallAvgCost = grandTotalQuantity > 0 ? grandTotalCost / grandTotalQuantity : 0;
  const topCategory = reportData.length > 0 ? reportData[0] : null;

  // عدد الفلاتر النشطة
  const activeFiltersCount = useMemo(() => {
    let c = 0;
    if (selectedCategory !== 'ALL') c++;
    if (selectedSupplierId !== 'ALL') c++;
    if (selectedWarehouse !== 'ALL') c++;
    if (selectedPaymentType !== 'ALL') c++;
    if (searchTerm.trim()) c++;
    return c;
  }, [selectedCategory, selectedSupplierId, selectedWarehouse, selectedPaymentType, searchTerm]);

  // إعادة تعيين الفلاتر
  const handleResetFilters = () => {
    setSelectedCategory('ALL');
    setSelectedSupplierId('ALL');
    setSelectedWarehouse('ALL');
    setSelectedPaymentType('ALL');
    setSearchTerm('');
  };

  // تصفية وترتيب القائمة المعروضة
  const filteredAndSortedList = useMemo(() => {
    let result = reportData.filter(row => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (row.categoryName || '').toLowerCase().includes(term);
    });

    result.sort((a, b) => {
      let valA: any = a.totalCost;
      let valB: any = b.totalCost;

      if (sortBy === 'quantity') {
        valA = a.totalQuantity;
        valB = b.totalQuantity;
      } else if (sortBy === 'name') {
        valA = a.categoryName;
        valB = b.categoryName;
      }

      if (sortDirection === 'asc') {
        return valA > valB ? 1 : -1;
      }
      return valA < valB ? 1 : -1;
    });

    return result;
  }, [reportData, searchTerm, sortBy, sortDirection]);

  // تبديل الترتيب
  const toggleSort = (column: 'cost' | 'quantity' | 'name') => {
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
      filename: `تقرير_مشتريات_الفئات_الرئيسية_${startDate}_إلى_${endDate}.xlsx`,
      sheetName: 'مشتريات الفئات الرئيسية',
      title: 'تقرير مشتريات الفئات الرئيسية للأصناف والمخزون',
      subtitle: `الفترة من: ${startDate} إلى: ${endDate}`,
      filterSummary: `الفترة: ${startDate} إلى ${endDate} | عدد الفئات: ${totalCategoriesCount} | إجمالي التكلفة: ${grandTotalCost.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ر.س`,
      headers: [
        'الترتيب',
        'اسم الفئة الرئيسية',
        'عدد الأصناف المشتراة',
        'عدد الفواتير',
        'إجمالي الكمية المشتراة',
        'متوسط تكلفة الوحدة (ر.س)',
        'إجمالي تكلفة المشتريات (ر.س)',
        'النسبة من الإجمالي %'
      ],
      rows: filteredAndSortedList.map(r => [
        r.rank,
        r.categoryName,
        r.itemsCount,
        r.invoiceCount,
        r.totalQuantity,
        r.averageItemCost.toFixed(2),
        r.totalCost.toFixed(2),
        `${r.percentageOfTotal.toFixed(1)}%`
      ]),
      summaryRows: [
        [
          'الإجمالي الكلي',
          `عدد الفئات: ${totalCategoriesCount}`,
          '-',
          '-',
          grandTotalQuantity,
          overallAvgCost.toFixed(2),
          grandTotalCost.toFixed(2),
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

    const printableElement = document.getElementById('printable-category-purchases-report');
    if (printableElement) {
      exportToPDF({
        filename: `تقرير_مشتريات_الفئات_الرئيسية_${startDate}_إلى_${endDate}.pdf`,
        title: 'تقرير مشتريات الفئات الرئيسية للأصناف',
        subtitle: `الفترة من ${startDate} إلى ${endDate}`,
        headers: ['#', 'الفئة الرئيسية', 'الأصناف', 'الفواتير', 'الكمية المشتراة', 'متوسط التكلفة', 'إجمالي المشتريات', 'النسبة %'],
        rows: filteredAndSortedList.map(r => [
          r.rank,
          r.categoryName,
          r.itemsCount,
          r.invoiceCount,
          r.totalQuantity,
          r.averageItemCost.toFixed(2),
          r.totalCost.toFixed(2),
          `${r.percentageOfTotal.toFixed(1)}%`
        ]),
        summaryRows: [
          ['الإجمالي', `فئات: ${totalCategoriesCount}`, '-', '-', grandTotalQuantity, overallAvgCost.toFixed(2), grandTotalCost.toFixed(2), '100%']
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
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600">
              <Layers size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800">تقرير مشتريات الفئات الرئيسية</h1>
              <p className="text-xs text-slate-500 font-medium">تحليل حجم وتكلفة مشتريات الأقسام الرئيسية وتوزيع السيولة حسب التصنيفات</p>
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
            <Filter size={18} className="text-purple-600" />
            <span className="font-bold text-sm text-slate-800">محددات وفلاتر مشتريات الفئات الرئيسية</span>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-black">
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
                className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-purple-50 hover:text-purple-600 text-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-200/80"
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
              <Calendar size={13} className="inline ml-1 text-purple-600" />
              من تاريخ
            </label>
            <input 
              type="date" 
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-purple-500 bg-slate-50/50" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
            />
          </div>

          {/* إلى تاريخ */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Calendar size={13} className="inline ml-1 text-purple-600" />
              إلى تاريخ
            </label>
            <input 
              type="date" 
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-purple-500 bg-slate-50/50" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
            />
          </div>

          {/* الفئة الرئيسية */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Layers size={13} className="inline ml-1 text-indigo-600" />
              الفئة الرئيسية المحددة
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-purple-500 bg-slate-50/50"
            >
              <option value="ALL">جميع الفئات الرئيسية ({availableCategories.length})</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* المورد */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Truck size={13} className="inline ml-1 text-blue-600" />
              المورد المورد للفئة
            </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-purple-500 bg-slate-50/50"
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
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-purple-500 bg-slate-50/50"
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
              نوع الفاتورة (نقدي / آجل)
            </label>
            <select
              value={selectedPaymentType}
              onChange={(e) => setSelectedPaymentType(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-purple-500 bg-slate-50/50"
            >
              <option value="ALL">الكل (نقدي وآجل)</option>
              <option value="CASH">مشتريات نقدية فقط</option>
              <option value="CREDIT">مشتريات آجلة فقط</option>
            </select>
          </div>

          {/* البحث النصي والتحديث */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Search size={13} className="inline ml-1 text-slate-400" />
              بحث باسم الفئة
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="اكتب اسم الفئة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-purple-500 bg-slate-50/50"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={loading}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
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
            {selectedCategory !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg font-medium">
                الفئة: {selectedCategory}
                <button type="button" onClick={() => setSelectedCategory('ALL')} className="hover:text-purple-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedSupplierId !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-medium">
                المورد: {allVendors.find(v => v.id === selectedSupplierId)?.name || selectedSupplierId}
                <button type="button" onClick={() => setSelectedSupplierId('ALL')} className="hover:text-blue-900 cursor-pointer"><X size={12} /></button>
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
          <div className="flex items-center justify-between text-purple-600 mb-2">
            <span className="text-xs font-bold text-slate-500">إجمالي تكلفة المشتريات</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
            {grandTotalCost.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-purple-600 font-bold">{currencySymbol} تكلفة فعلية</span>
        </div>

        {/* إجمالي الكميات المشتراة */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 mb-2">
            <span className="text-xs font-bold text-slate-500">إجمالي الكميات الواردة</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Package size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
            {grandTotalQuantity.toLocaleString('ar-EG')}
          </div>
          <span className="text-xs text-indigo-600 font-bold">متوسط تكلفة الوحدة: {overallAvgCost.toFixed(2)} {currencySymbol}</span>
        </div>

        {/* عدد الفئات النشطة */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-bold text-slate-500">عدد الفئات المشتراة</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Layers size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
            {totalCategoriesCount}
          </div>
          <span className="text-xs text-blue-600 font-bold">فئة رئيسية نشطة</span>
        </div>

        {/* الفئة الأكثر شراءً */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold text-slate-500">الفئة الأكثر استهلاكاً للسيولة</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Award size={18} />
            </div>
          </div>
          <div className="text-base font-black text-slate-800 truncate" title={topCategory?.categoryName || '-'}>
            {topCategory?.categoryName || 'لا يوجد'}
          </div>
          <span className="text-xs text-amber-600 font-bold">
            {topCategory ? `${topCategory.totalCost.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ${currencySymbol} (${topCategory.percentageOfTotal.toFixed(1)}%)` : '-'}
          </span>
        </div>

      </div>

      {/* 4. Visual Bar Distribution */}
      {reportData.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-purple-600" />
            <h3 className="text-sm font-black text-slate-800">توزيع الإنفاق الشرائي حسب الفئات الرئيسية</h3>
          </div>
          <div className="space-y-3">
            {reportData.slice(0, 5).map((cat, idx) => (
              <div key={cat.categoryId || idx}>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>#{cat.rank} {cat.categoryName} ({cat.totalQuantity.toLocaleString()} قطعة)</span>
                  <span className="font-mono text-purple-700">{cat.totalCost.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {currencySymbol} ({cat.percentageOfTotal.toFixed(1)}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(2, cat.percentageOfTotal))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Data Table */}
      <div id="printable-category-purchases-report" className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-purple-600" />
            <h2 className="font-black text-sm text-slate-800">
              قائمة تفاصيل مشتريات الفئات الرئيسية ({filteredAndSortedList.length} فئة)
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
                    <span>اسم الفئة الرئيسية</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5">عدد الأصناف</th>
                <th className="p-3.5">عدد الفواتير</th>
                <th 
                  className="p-3.5 cursor-pointer hover:bg-slate-200/60 transition"
                  onClick={() => toggleSort('quantity')}
                >
                  <div className="flex items-center gap-1">
                    <span>إجمالي الكمية المشتراة</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5">متوسط تكلفة الوحدة</th>
                <th 
                  className="p-3.5 cursor-pointer hover:bg-slate-200/60 transition"
                  onClick={() => toggleSort('cost')}
                >
                  <div className="flex items-center gap-1">
                    <span>إجمالي تكلفة المشتريات</span>
                    <ArrowUpDown size={12} className="text-purple-600" />
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
                      <Layers size={36} className="text-slate-300" />
                      <p className="font-bold text-sm text-slate-700">لا توجد مشتريات فئات مطابقة للبحث</p>
                      <p className="text-xs text-slate-400">يرجى تغيير شروط الفلترة أو الفترة المحددة</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedList.map((row) => (
                  <tr key={row.categoryId} className="hover:bg-purple-50/40 transition-colors">
                    <td className="p-3.5 font-mono text-slate-400 font-bold">
                      <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs ${
                        row.rank === 1 ? 'bg-amber-100 text-amber-800 font-black' :
                        row.rank === 2 ? 'bg-slate-200 text-slate-700 font-bold' :
                        row.rank === 3 ? 'bg-amber-50 text-amber-700 font-bold' : 'text-slate-500'
                      }`}>
                        {row.rank}
                      </span>
                    </td>
                    <td className="p-3.5 font-black text-slate-800">{row.categoryName}</td>
                    <td className="p-3.5 font-mono text-slate-600 font-bold">{row.itemsCount} صنف</td>
                    <td className="p-3.5 font-mono text-slate-600">{row.invoiceCount}</td>
                    <td className="p-3.5 font-mono font-bold text-slate-700">{row.totalQuantity.toLocaleString()}</td>
                    <td className="p-3.5 font-mono text-slate-600">{row.averageItemCost.toFixed(2)}</td>
                    <td className="p-3.5 font-mono font-black text-purple-800 text-sm">
                      {row.totalCost.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-700">{row.percentageOfTotal.toFixed(1)}%</span>
                        <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-purple-500 h-full rounded-full" 
                            style={{ width: `${Math.min(100, row.percentageOfTotal)}%` }} 
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
                  <td colSpan={4} className="p-4 text-sm">
                    الإجمالي العام ({totalCategoriesCount} فئة رئيسية)
                  </td>
                  <td className="p-4 font-mono">{grandTotalQuantity.toLocaleString()}</td>
                  <td className="p-4 font-mono">{overallAvgCost.toFixed(2)}</td>
                  <td className="p-4 font-mono text-purple-900 text-base">{grandTotalCost.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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

export default MainCategoryPurchases;
