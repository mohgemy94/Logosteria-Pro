import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Calendar, 
  Gift, 
  Search, 
  Printer, 
  FileSpreadsheet, 
  FileText,
  RotateCcw, 
  Package, 
  Building2, 
  ArrowLeft, 
  ArrowRight,
  Sparkles,
  Info,
  CheckCircle2,
  Boxes,
  Truck,
  Warehouse,
  Filter,
  X,
  DollarSign,
  TrendingUp,
  Award
} from 'lucide-react';
import { supabase } from '../../../services/supabaseClient';
import { loadStoredPurchaseInvoices } from '../../../utils/purchasesStore';
import { loadStoredItems, getDynamicWarehousesList, getWarehouseLabel } from '../../../utils/itemsStore';
import { loadVendors } from '../../../utils/partnerLedger';
import { exportToXLSX, exportToPDF } from '../../../utils/universalExport';
import { useSystemCurrency } from '../../../utils/currency';
import { useLanguage } from '../../../i18n/LanguageContext';

export interface SupplierBonusesSummaryProps {
  onNavigate?: (view: string | null) => void;
}

export interface RawBonusItem {
  id: string;
  invoiceId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplierName: string;
  supplierId?: string;
  itemId?: string;
  itemCode?: string;
  itemName: string;
  category?: string;
  warehouseName?: string;
  unit?: string;
  quantity: number;
  actualPrice: number;
  defaultUnitCost: number;
  notes?: string;
}

export interface GroupedSupplierBonus {
  key: string;
  supplierName: string;
  supplierId?: string;
  itemName: string;
  itemCode?: string;
  category: string;
  unit: string;
  total_free_quantity: number;
  default_unit_cost: number;
  estimated_gift_cost: number;
  invoicesCount: number;
  invoicesList: {
    invoiceNumber: string;
    invoiceDate: string;
    quantity: number;
    warehouseName?: string;
    notes?: string;
  }[];
}

export const SupplierBonusesSummary: React.FC<SupplierBonusesSummaryProps> = ({ onNavigate }) => {
  const { symbol: currencySymbol } = useSystemCurrency();
  const { isRtl } = useLanguage();
  const reportRef = useRef<HTMLDivElement>(null);

  const todayStr = new Date().toISOString().substring(0, 10);

  // فلاتر البحث والتواريخ
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // أول الشهر الحالي
    return d.toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(todayStr);

  // فلاتر متقدمة
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [minSavings, setMinSavings] = useState<string>('');

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'quantity' | 'savings' | 'supplier' | 'item'>('savings');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // تفاصيل الصنف والمورد المعروض في النافذة المنبثقة
  const [activeDrilldown, setActiveDrilldown] = useState<GroupedSupplierBonus | null>(null);

  // البيانات
  const [rawBonusItems, setRawBonusItems] = useState<RawBonusItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [productsCatalog, setProductsCatalog] = useState<Map<string, { cost: number; code: string; unit: string; category: string }>>(new Map());
  const [suppliersList, setSuppliersList] = useState<{ id: string; name: string }[]>([]);

  // تحميل كتالوج التكاليف وقائمة الموردين
  useEffect(() => {
    loadCatalogAndSuppliers();
  }, []);

  const loadCatalogAndSuppliers = async () => {
    const costMap = new Map<string, { cost: number; code: string; unit: string; category: string }>();

    try {
      const { data: dbProducts } = await supabase
        .from('products')
        .select('id, name, code, barcode, unit, category, cost_price, costPrice, initial_cost');

      if (dbProducts && dbProducts.length > 0) {
        dbProducts.forEach((p: any) => {
          const cost = Number(p.cost_price ?? p.costPrice ?? p.initial_cost ?? 0);
          const unit = p.unit || 'حبة';
          const category = p.category || 'عام';
          const code = p.code || p.barcode || '';
          if (p.id) costMap.set(String(p.id), { cost, code, unit, category });
          if (p.name) costMap.set(p.name.trim().toLowerCase(), { cost, code, unit, category });
          if (code) costMap.set(code.trim().toLowerCase(), { cost, code, unit, category });
        });
      }
    } catch (err) {
      console.warn('Error loading DB products:', err);
    }

    const localItems = loadStoredItems();
    localItems.forEach(p => {
      const cost = Number(p.costPrice || (p as any).cost_price || 0);
      const unit = p.unit || 'حبة';
      const category = p.category || 'عام';
      const code = p.code || p.barcode || '';
      if (p.id && !costMap.has(String(p.id))) costMap.set(String(p.id), { cost, code, unit, category });
      if (p.name && !costMap.has(p.name.trim().toLowerCase())) costMap.set(p.name.trim().toLowerCase(), { cost, code, unit, category });
    });

    setProductsCatalog(costMap);

    const vendors = loadVendors();
    setSuppliersList(vendors.map(v => ({ id: v.id, name: v.name })));
  };

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

  // استعلام البوانص والهدايا
  const handleSearch = async () => {
    if (!startDate || !endDate) {
      alert('يرجى تحديد فترة البحث');
      return;
    }

    setLoading(true);

    try {
      let foundItems: RawBonusItem[] = [];

      // 1. استعلام Supabase
      const { data: dbLines, error } = await supabase
        .from('purchase_lines')
        .select(`
          id,
          product_id,
          quantity,
          bonus_quantity,
          free_quantity,
          unit_price,
          cost_price,
          notes,
          products (
            id,
            name,
            code,
            unit,
            category,
            cost_price
          ),
          purchase_invoices!inner (
            id,
            invoice_number,
            created_at,
            vendor_id,
            supplier_id,
            supplier_name,
            warehouse_name,
            status
          )
        `)
        .gte('purchase_invoices.created_at', startDate)
        .lte('purchase_invoices.created_at', `${endDate}T23:59:59`);

      if (!error && dbLines && dbLines.length > 0) {
        dbLines.forEach((row: any) => {
          const inv = row.purchase_invoices;
          const p = row.products;
          const price = Number(row.unit_price || row.cost_price || 0);
          const bonusQty = Number(row.bonus_quantity || row.free_quantity || (price === 0 ? row.quantity : 0));

          if (bonusQty > 0) {
            const defCost = Number(p?.cost_price || productsCatalog.get(String(row.product_id))?.cost || 10);
            foundItems.push({
              id: String(row.id),
              invoiceId: inv.id,
              invoiceNumber: inv.invoice_number || inv.id,
              invoiceDate: inv.created_at?.substring(0, 10) || '',
              supplierName: inv.supplier_name || 'مورد عام',
              supplierId: inv.vendor_id || inv.supplier_id,
              itemId: row.product_id,
              itemCode: p?.code,
              itemName: p?.name || 'صنف مجاني / بونص',
              category: p?.category || 'عام',
              warehouseName: inv.warehouse_name || 'MAIN_WAREHOUSE',
              unit: p?.unit || 'حبة',
              quantity: bonusQty,
              actualPrice: 0,
              defaultUnitCost: defCost,
              notes: row.notes || 'بونص مورد'
            });
          }
        });
      }

      // Fallback للمحلي
      if (foundItems.length === 0) {
        const localInvoices = loadStoredPurchaseInvoices();
        const periodInvoices = localInvoices.filter(inv => {
          const invDate = inv.date || inv.createdAt?.substring(0, 10);
          return invDate >= startDate && invDate <= endDate;
        });

        periodInvoices.forEach(inv => {
          const matchedVendor = suppliersList.find(v => v.id === inv.partnerId || v.name === inv.partnerName);
          const supName = inv.partnerName || matchedVendor?.name || 'مورد عام';
          const supId = inv.partnerId || matchedVendor?.id;
          const warehouseName = inv.warehouseName || 'MAIN_WAREHOUSE';

          (inv.items || []).forEach((it: any, idx: number) => {
            const price = Number(it.unitPrice || it.costPrice || 0);
            const bonusQty = Number(it.bonusQty || it.bonus || it.freeQty || (price === 0 ? it.quantity : 0));

            if (bonusQty > 0) {
              const catInfo = productsCatalog.get(String(it.itemId)) || productsCatalog.get((it.description || '').trim().toLowerCase());
              const defCost = catInfo?.cost || (price > 0 ? price : 10);

              foundItems.push({
                id: it.itemId ? `${inv.id}_${it.itemId}_${idx}` : `${inv.id}_bonus_${idx}`,
                invoiceId: inv.id,
                invoiceNumber: inv.invoiceNumber || inv.id,
                invoiceDate: inv.date || inv.createdAt?.substring(0, 10) || '',
                supplierName: supName,
                supplierId: supId,
                itemId: it.itemId,
                itemCode: it.itemCode || catInfo?.code,
                itemName: it.description || 'صنف بونص',
                category: catInfo?.category || (it as any).category || 'عام',
                warehouseName,
                unit: it.unit || catInfo?.unit || 'حبة',
                quantity: bonusQty,
                actualPrice: 0,
                defaultUnitCost: defCost,
                notes: it.notes || 'بونص مجاني'
              });
            }
          });
        });
      }

      setRawBonusItems(foundItems);
    } catch (err) {
      console.error('Error fetching bonuses summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSearch();
  }, []);

  // قائمة الفئات المتاحة
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    rawBonusItems.forEach(b => {
      if (b.category) set.add(b.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [rawBonusItems]);

  // تصفية وتجميع البوانص باستخدام reduce
  const groupedBonuses = useMemo(() => {
    const filtered = rawBonusItems.filter(item => {
      // فلتر المورد
      if (selectedSupplier !== 'ALL') {
        const matchesName = item.supplierName.trim().toLowerCase() === selectedSupplier.trim().toLowerCase();
        const matchesId = item.supplierId === selectedSupplier;
        if (!matchesName && !matchesId) return false;
      }

      // فلتر الفئة
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;

      // فلتر المستودع
      if (selectedWarehouse !== 'ALL') {
        const wh = (item.warehouseName || '').toUpperCase();
        const targetWh = selectedWarehouse.toUpperCase();
        if (targetWh === 'MAIN_WAREHOUSE') {
          if (!wh.includes('MAIN') && !wh.includes('رئيسي')) return false;
        } else if (wh !== targetWh && getWarehouseLabel(item.warehouseName) !== getWarehouseLabel(selectedWarehouse)) {
          return false;
        }
      }

      return true;
    });

    const groupedMap = filtered.reduce((acc: Record<string, GroupedSupplierBonus>, curr) => {
      const key = `${curr.supplierName.trim()}___${curr.itemName.trim()}`;

      if (!acc[key]) {
        acc[key] = {
          key,
          supplierName: curr.supplierName,
          supplierId: curr.supplierId,
          itemName: curr.itemName,
          itemCode: curr.itemCode,
          category: curr.category || 'عام',
          unit: curr.unit || 'حبة',
          total_free_quantity: 0,
          default_unit_cost: curr.defaultUnitCost || 0,
          estimated_gift_cost: 0,
          invoicesCount: 0,
          invoicesList: []
        };
      }

      acc[key].total_free_quantity += curr.quantity;
      if (curr.defaultUnitCost > 0) {
        acc[key].default_unit_cost = curr.defaultUnitCost;
      }
      acc[key].estimated_gift_cost = acc[key].total_free_quantity * acc[key].default_unit_cost;
      acc[key].invoicesCount += 1;
      acc[key].invoicesList.push({
        invoiceNumber: curr.invoiceNumber,
        invoiceDate: curr.invoiceDate,
        quantity: curr.quantity,
        warehouseName: curr.warehouseName,
        notes: curr.notes
      });

      return acc;
    }, {});

    let list = Object.values(groupedMap);

    if (minSavings && parseFloat(minSavings) > 0) {
      list = list.filter(g => g.estimated_gift_cost >= parseFloat(minSavings));
    }

    return list;

  }, [rawBonusItems, selectedSupplier, selectedCategory, selectedWarehouse, minSavings]);

  // إحصائيات KPIs
  const summaryKPIs = useMemo(() => {
    let totalFreeQty = 0;
    let totalEstimatedValue = 0;
    const suppliersSet = new Set<string>();
    const itemsSet = new Set<string>();

    groupedBonuses.forEach(b => {
      totalFreeQty += b.total_free_quantity;
      totalEstimatedValue += b.estimated_gift_cost;
      suppliersSet.add(b.supplierName);
      itemsSet.add(b.itemName);
    });

    return {
      totalFreeQty,
      totalEstimatedValue,
      suppliersCount: suppliersSet.size,
      itemsCount: itemsSet.size,
      avgBonusPerSupplier: suppliersSet.size > 0 ? totalEstimatedValue / suppliersSet.size : 0
    };
  }, [groupedBonuses]);

  // عدد الفلاتر النشطة
  const activeFiltersCount = useMemo(() => {
    let c = 0;
    if (selectedSupplier !== 'ALL') c++;
    if (selectedCategory !== 'ALL') c++;
    if (selectedWarehouse !== 'ALL') c++;
    if (minSavings) c++;
    if (searchTerm.trim()) c++;
    return c;
  }, [selectedSupplier, selectedCategory, selectedWarehouse, minSavings, searchTerm]);

  // إعادة ضبط الفلاتر
  const handleResetFilters = () => {
    setSelectedSupplier('ALL');
    setSelectedCategory('ALL');
    setSelectedWarehouse('ALL');
    setMinSavings('');
    setSearchTerm('');
  };

  // تصفية وترتيب القائمة
  const filteredAndSortedList = useMemo(() => {
    let result = groupedBonuses.filter(row => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (row.supplierName || '').toLowerCase().includes(term) ||
        (row.itemName || '').toLowerCase().includes(term) ||
        (row.itemCode && String(row.itemCode).toLowerCase().includes(term))
      );
    });

    result.sort((a, b) => {
      let valA: any = a.estimated_gift_cost;
      let valB: any = b.estimated_gift_cost;

      if (sortBy === 'quantity') {
        valA = a.total_free_quantity;
        valB = b.total_free_quantity;
      } else if (sortBy === 'supplier') {
        valA = a.supplierName;
        valB = b.supplierName;
      } else if (sortBy === 'item') {
        valA = a.itemName;
        valB = b.itemName;
      }

      if (sortDirection === 'asc') {
        return valA > valB ? 1 : -1;
      }
      return valA < valB ? 1 : -1;
    });

    return result;
  }, [groupedBonuses, searchTerm, sortBy, sortDirection]);

  // تصدير Excel
  const handleExportExcel = () => {
    if (groupedBonuses.length === 0) {
      alert('لا توجد بيانات بوانص متاحة للتصدير');
      return;
    }

    exportToXLSX({
      filename: `ملخص_بوانص_وهدايا_الموردين_${startDate}_إلى_${endDate}.xlsx`,
      sheetName: 'بوانص الموردين',
      title: 'تقرير ملخص بوانص وهدايا الموردين والكميات المجانية',
      subtitle: `الفترة من: ${startDate} إلى: ${endDate}`,
      filterSummary: `الفترة: ${startDate} إلى ${endDate} | إجمالي القيمة التقديرية: ${summaryKPIs.totalEstimatedValue.toFixed(2)} ر.س`,
      headers: [
        'اسم المورد',
        'كود الصنف',
        'اسم الصنف المجاني',
        'الفئة',
        'الوحدة',
        'إجمالي الكمية المجانية',
        'التكلفة التقديرية للوحدة (ر.س)',
        'إجمالي الوفر التقديري (ر.س)',
        'عدد الفواتير'
      ],
      rows: filteredAndSortedList.map(r => [
        r.supplierName,
        r.itemCode || '-',
        r.itemName,
        r.category,
        r.unit,
        r.total_free_quantity,
        r.default_unit_cost.toFixed(2),
        r.estimated_gift_cost.toFixed(2),
        r.invoicesCount
      ]),
      summaryRows: [
        [
          'الإجمالي العام',
          '-',
          `أصناف: ${summaryKPIs.itemsCount}`,
          '-',
          '-',
          summaryKPIs.totalFreeQty,
          '-',
          summaryKPIs.totalEstimatedValue.toFixed(2),
          '-'
        ]
      ]
    });
  };

  // تصدير PDF / طباعة
  const handleExportPDF = () => {
    if (groupedBonuses.length === 0) {
      alert('لا توجد بيانات متاحة للطباعة');
      return;
    }

    const printableElement = document.getElementById('printable-bonuses-summary-report');
    if (printableElement) {
      exportToPDF({
        filename: `ملخص_بوانص_الموردين_${startDate}_إلى_${endDate}.pdf`,
        title: 'تقرير ملخص بوانص وهدايا الموردين',
        subtitle: `الفترة من ${startDate} إلى ${endDate}`,
        headers: ['المورد', 'الصنف المجاني', 'الفئة', 'الكمية المجانية', 'تكلفة الوحدة', 'إجمالي الوفر', 'الفواتير'],
        rows: filteredAndSortedList.map(r => [
          r.supplierName,
          r.itemName,
          r.category,
          r.total_free_quantity,
          r.default_unit_cost.toFixed(2),
          r.estimated_gift_cost.toFixed(2),
          r.invoicesCount
        ]),
        summaryRows: [
          ['الإجمالي', `أصناف: ${summaryKPIs.itemsCount}`, '-', summaryKPIs.totalFreeQty, '-', summaryKPIs.totalEstimatedValue.toFixed(2), '-']
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
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-600">
              <Gift size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800">ملخص بوانص وهدايا الموردين</h1>
              <p className="text-xs text-slate-500 font-medium">حصر الكميات المجانية والبوانص الممنوحة من الموردين وتقدير قيمة الوفر المالي</p>
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
            disabled={groupedBonuses.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <FileSpreadsheet size={16} />
            <span>تصدير Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={groupedBonuses.length === 0}
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
            <Filter size={18} className="text-pink-600" />
            <span className="font-bold text-sm text-slate-800">محددات وفلاتر بوانص وهدايا الموردين</span>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 text-xs font-black">
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
                className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-pink-50 hover:text-pink-600 text-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-200/80"
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
              <Calendar size={13} className="inline ml-1 text-pink-600" />
              من تاريخ
            </label>
            <input 
              type="date" 
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-pink-500 bg-slate-50/50" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
            />
          </div>

          {/* إلى تاريخ */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Calendar size={13} className="inline ml-1 text-pink-600" />
              إلى تاريخ
            </label>
            <input 
              type="date" 
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-pink-500 bg-slate-50/50" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
            />
          </div>

          {/* المورد */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Truck size={13} className="inline ml-1 text-indigo-600" />
              المورد المانح للبونص
            </label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-pink-500 bg-slate-50/50"
            >
              <option value="ALL">جميع الموردين ({suppliersList.length})</option>
              {suppliersList.map(v => (
                <option key={v.id} value={v.name}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* فئة الصنف */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Package size={13} className="inline ml-1 text-purple-600" />
              فئة صنف البونص
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-pink-500 bg-slate-50/50"
            >
              <option value="ALL">جميع الفئات ({availableCategories.length})</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
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
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-pink-500 bg-slate-50/50"
            >
              <option value="ALL">كافة المستودعات والفروع</option>
              {getDynamicWarehousesList([selectedWarehouse !== 'ALL' ? selectedWarehouse : '']).map(w => (
                <option key={w.id} value={w.id}>{w.label}</option>
              ))}
            </select>
          </div>

          {/* الحد الأدنى للوفر */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <DollarSign size={13} className="inline ml-1 text-cyan-600" />
              الحد الأدنى لقيمة الوفر
            </label>
            <input
              type="number"
              placeholder="مثال: 500"
              value={minSavings}
              onChange={(e) => setMinSavings(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-pink-500 bg-slate-50/50"
            />
          </div>

          {/* البحث والتطبيق */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Search size={13} className="inline ml-1 text-slate-400" />
              بحث بالمورد أو الصنف
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="اكتب اسم المورد أو الصنف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-pink-500 bg-slate-50/50"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={loading}
                className="px-5 py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
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
            {selectedSupplier !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-medium">
                المورد: {selectedSupplier}
                <button type="button" onClick={() => setSelectedSupplier('ALL')} className="hover:text-indigo-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedCategory !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg font-medium">
                الفئة: {selectedCategory}
                <button type="button" onClick={() => setSelectedCategory('ALL')} className="hover:text-purple-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedWarehouse !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-medium">
                المستودع: {selectedWarehouse === 'MAIN_WAREHOUSE' ? 'المستودع الرئيسي' : selectedWarehouse}
                <button type="button" onClick={() => setSelectedWarehouse('ALL')} className="hover:text-emerald-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {minSavings && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-lg font-medium">
                الحد الأدنى: {minSavings} ر.س
                <button type="button" onClick={() => setMinSavings('')} className="hover:text-cyan-900 cursor-pointer"><X size={12} /></button>
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
        
        {/* إجمالي الوفر التقديري */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-pink-600 mb-2">
            <span className="text-xs font-bold text-slate-500">إجمالي قيمة الوفر المالي</span>
            <div className="p-2 rounded-xl bg-pink-50 text-pink-600">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
            {summaryKPIs.totalEstimatedValue.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-pink-600 font-bold">{currencySymbol} وفر محقق من البوانص</span>
        </div>

        {/* إجمالي الكميات المجانية */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 mb-2">
            <span className="text-xs font-bold text-slate-500">إجمالي الكميات المجانية</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Gift size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
            {summaryKPIs.totalFreeQty.toLocaleString()}
          </div>
          <span className="text-xs text-indigo-600 font-bold">قطعة بونص مستلمة مجاناً</span>
        </div>

        {/* عدد الموردين المانحين */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold text-slate-500">الموردين المانحين للبونص</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Truck size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
            {summaryKPIs.suppliersCount}
          </div>
          <span className="text-xs text-emerald-600 font-bold">مورد قدم هدايا وبوانص</span>
        </div>

        {/* عدد الأصناف المستفادة */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold text-slate-500">الأصناف المستلمة كبونص</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Boxes size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
            {summaryKPIs.itemsCount}
          </div>
          <span className="text-xs text-amber-600 font-bold">صنفاً مختلفاً</span>
        </div>

      </div>

      {/* 4. Data Table */}
      <div id="printable-bonuses-summary-report" className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gift size={16} className="text-pink-600" />
            <h2 className="font-black text-sm text-slate-800">
              سجل ملخص بوانص الموردين المجمعة ({filteredAndSortedList.length} بند)
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th className="p-3.5">#</th>
                <th className="p-3.5">اسم المورد</th>
                <th className="p-3.5">كود الصنف</th>
                <th className="p-3.5">الصنف المجاني</th>
                <th className="p-3.5">الفئة</th>
                <th className="p-3.5">الوحدة</th>
                <th className="p-3.5">الكمية المجانية</th>
                <th className="p-3.5">التكلفة التقديرية</th>
                <th className="p-3.5">إجمالي الوفر المالي</th>
                <th className="p-3.5">عدد الفواتير</th>
                <th className="p-3.5">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSortedList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Gift size={36} className="text-slate-300" />
                      <p className="font-bold text-sm text-slate-700">لا توجد بيانات بوانص أو هدايا مطابقة لشروط البحث</p>
                      <p className="text-xs text-slate-400">تأكد من تسجيل كميات مجانية أو بوانص في فواتير الشراء</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedList.map((row, idx) => (
                  <tr key={row.key || idx} className="hover:bg-pink-50/30 transition-colors">
                    <td className="p-3.5 font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3.5 font-black text-slate-800">{row.supplierName}</td>
                    <td className="p-3.5 font-mono text-slate-500">{row.itemCode || '-'}</td>
                    <td className="p-3.5 font-bold text-slate-800">{row.itemName}</td>
                    <td className="p-3.5 text-slate-600">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                        {row.category}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500">{row.unit}</td>
                    <td className="p-3.5 font-mono font-black text-pink-700 text-sm">
                      {row.total_free_quantity.toLocaleString()}
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">{row.default_unit_cost.toFixed(2)}</td>
                    <td className="p-3.5 font-mono font-black text-emerald-700 text-sm">
                      {row.estimated_gift_cost.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 font-mono text-slate-700">{row.invoicesCount}</td>
                    <td className="p-3.5">
                      <button
                        type="button"
                        onClick={() => setActiveDrilldown(row)}
                        className="px-2.5 py-1 bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        عرض الفواتير
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredAndSortedList.length > 0 && (
              <tfoot className="bg-slate-100 font-black border-t-2 border-slate-300 text-slate-800">
                <tr>
                  <td colSpan={6} className="p-4 text-sm">
                    الإجمالي العام ({summaryKPIs.suppliersCount} مورد | {summaryKPIs.itemsCount} صنف)
                  </td>
                  <td className="p-4 font-mono text-pink-800 text-base">{summaryKPIs.totalFreeQty.toLocaleString()}</td>
                  <td className="p-4 text-slate-400 font-normal text-xs">-</td>
                  <td className="p-4 font-mono text-emerald-800 text-base">{summaryKPIs.totalEstimatedValue.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td colSpan={2} className="p-4 text-slate-500 font-normal text-xs">{currencySymbol}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 5. Drilldown Modal */}
      {activeDrilldown && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-pink-600 to-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift size={20} />
                <h3 className="font-black text-base">
                  تفاصيل فواتير البونص: {activeDrilldown.itemName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveDrilldown(null)}
                className="p-1 hover:bg-white/20 rounded-lg cursor-pointer transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 max-h-96 overflow-y-auto">
              <div className="mb-4 bg-pink-50 p-3 rounded-xl border border-pink-100 text-xs flex justify-between text-pink-900">
                <span>المورد: <b>{activeDrilldown.supplierName}</b></span>
                <span>إجمالي البونص: <b>{activeDrilldown.total_free_quantity} {activeDrilldown.unit}</b></span>
                <span>إجمالي الوفر: <b>{activeDrilldown.estimated_gift_cost.toFixed(2)} {currencySymbol}</b></span>
              </div>

              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">رقم الفاتورة</th>
                    <th className="p-2.5">التاريخ</th>
                    <th className="p-2.5">المستودع</th>
                    <th className="p-2.5">الكمية المجانية</th>
                    <th className="p-2.5">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeDrilldown.invoicesList.map((inv, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold text-pink-700">{inv.invoiceNumber}</td>
                      <td className="p-2.5 text-slate-600">{inv.invoiceDate}</td>
                      <td className="p-2.5 text-slate-600">{inv.warehouseName === 'MAIN_WAREHOUSE' ? 'الرئيسي' : (inv.warehouseName || 'الرئيسي')}</td>
                      <td className="p-2.5 font-mono font-bold text-slate-800">{inv.quantity}</td>
                      <td className="p-2.5 text-slate-500">{inv.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 text-left">
              <button
                type="button"
                onClick={() => setActiveDrilldown(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SupplierBonusesSummary;
