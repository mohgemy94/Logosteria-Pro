import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Calendar, 
  Gift, 
  Search, 
  Printer, 
  FileSpreadsheet, 
  FileText,
  RotateCcw, 
  Building2, 
  ArrowLeft, 
  ArrowRight,
  Info,
  CheckCircle2,
  Boxes,
  ScrollText,
  DollarSign,
  Truck,
  Warehouse,
  Filter,
  X,
  Package,
  Layers
} from 'lucide-react';
import { supabase } from '../../../services/supabaseClient';
import { loadStoredPurchaseInvoices } from '../../../utils/purchasesStore';
import { loadStoredItems, Item, getDynamicWarehousesList, getWarehouseLabel } from '../../../utils/itemsStore';
import { loadVendors } from '../../../utils/partnerLedger';
import { exportToXLSX, exportToPDF } from '../../../utils/universalExport';
import { useSystemCurrency } from '../../../utils/currency';
import { useLanguage } from '../../../i18n/LanguageContext';

export interface DetailedSupplierBonusesProps {
  onNavigate?: (view: string | null) => void;
}

export interface DetailedBonusAuditRow {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplierName: string;
  supplierId?: string;
  itemId?: string;
  itemCode?: string;
  itemName: string;
  category?: string;
  warehouseName?: string;
  unit: string;
  quantity: number;
  baseCost: number;
  estimatedTotalValue: number;
  notes: string;
  source: 'cloud' | 'local';
}

export const DetailedSupplierBonuses: React.FC<DetailedSupplierBonusesProps> = ({ onNavigate }) => {
  const { symbol: currencySymbol } = useSystemCurrency();
  const { isRtl } = useLanguage();
  const reportRef = useRef<HTMLDivElement>(null);

  const todayStr = new Date().toISOString().substring(0, 10);

  // شريط البحث والتواريخ
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // أول الشهر الحالي
    return d.toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(todayStr);

  // الفلاتر المتقدمة
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  const [selectedItem, setSelectedItem] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'supplier' | 'item' | 'quantity' | 'cost' | 'total'>('date');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // البيانات
  const [auditRows, setAuditRows] = useState<DetailedBonusAuditRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [productsCatalog, setProductsCatalog] = useState<Map<string, { cost: number; code: string; unit: string; name: string; category: string }>>(new Map());

  // قوائم الفلترة
  const [suppliersList, setSuppliersList] = useState<{ id: string; name: string }[]>([]);
  const [productsList, setProductsList] = useState<{ id: string; name: string; code: string }[]>([]);

  // تحميل الكتالوج وقوائم الفلاتر
  useEffect(() => {
    loadCatalogAndFilters();
  }, []);

  const loadCatalogAndFilters = async () => {
    const costMap = new Map<string, { cost: number; code: string; unit: string; name: string; category: string }>();
    const prods: { id: string; name: string; code: string }[] = [];

    try {
      const { data: dbProducts } = await supabase
        .from('products')
        .select('id, name, code, barcode, unit, category, cost_price, costPrice, initial_cost');

      if (dbProducts && dbProducts.length > 0) {
        dbProducts.forEach((p: any) => {
          const cost = Number(p.cost_price ?? p.costPrice ?? p.initial_cost ?? 0);
          const unit = p.unit || 'حبة';
          const code = p.code || p.barcode || '';
          const name = p.name || 'بدون اسم';
          const category = p.category || 'عام';
          const entry = { cost, code, unit, name, category };

          if (p.id) costMap.set(String(p.id), entry);
          if (p.name) costMap.set(p.name.trim().toLowerCase(), entry);
          if (code) costMap.set(code.trim().toLowerCase(), entry);

          prods.push({ id: String(p.id || code || name), name, code });
        });
      }
    } catch {
      // Continue
    }

    const localItems: Item[] = loadStoredItems();
    localItems.forEach(it => {
      const cost = Number(it.costPrice || 0);
      const unit = it.unit || 'حبة';
      const code = it.code || it.barcode || '';
      const name = it.name || 'بدون اسم';
      const category = it.category || 'عام';
      const entry = { cost, code, unit, name, category };

      if (it.id && !costMap.has(String(it.id))) costMap.set(String(it.id), entry);
      if (it.name && !costMap.has(it.name.trim().toLowerCase())) costMap.set(it.name.trim().toLowerCase(), entry);

      if (!prods.some(p => p.name === name || (code && p.code === code))) {
        prods.push({ id: String(it.id || code || name), name, code });
      }
    });

    setProductsCatalog(costMap);
    setProductsList(prods);

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

  // استعلام البوانص التفصيلية
  const handleSearch = async () => {
    if (!startDate || !endDate) {
      alert('يرجى تحديد فترة البحث');
      return;
    }

    setLoading(true);

    try {
      const rows: DetailedBonusAuditRow[] = [];

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
            const baseCost = Number(p?.cost_price || productsCatalog.get(String(row.product_id))?.cost || 10);
            rows.push({
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
              baseCost,
              estimatedTotalValue: bonusQty * baseCost,
              notes: row.notes || 'بونص مورد مسجل',
              source: 'cloud'
            });
          }
        });
      }

      // Fallback للمحلي
      if (rows.length === 0) {
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
              const baseCost = catInfo?.cost || (price > 0 ? price : 10);

              rows.push({
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
                baseCost,
                estimatedTotalValue: bonusQty * baseCost,
                notes: it.notes || 'بونص مجاني محلي',
                source: 'local'
              });
            }
          });
        });
      }

      setAuditRows(rows);
    } catch (err) {
      console.error('Error in DetailedSupplierBonuses handleSearch:', err);
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
    auditRows.forEach(r => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [auditRows]);

  // تطبيق الفلاتر
  const filteredRows = useMemo(() => {
    return auditRows.filter(row => {
      // فلتر المورد
      if (selectedSupplier !== 'ALL') {
        const matchesName = row.supplierName.trim().toLowerCase() === selectedSupplier.trim().toLowerCase();
        const matchesId = row.supplierId === selectedSupplier;
        if (!matchesName && !matchesId) return false;
      }

      // فلتر الصنف
      if (selectedItem !== 'ALL') {
        const matchesName = row.itemName.trim().toLowerCase() === selectedItem.trim().toLowerCase();
        const matchesId = row.itemId === selectedItem || row.itemCode === selectedItem;
        if (!matchesName && !matchesId) return false;
      }

      // فلتر الفئة
      if (selectedCategory !== 'ALL' && row.category !== selectedCategory) return false;

      // فلتر المستودع
      if (selectedWarehouse !== 'ALL') {
        const wh = (row.warehouseName || '').toUpperCase();
        const targetWh = selectedWarehouse.toUpperCase();
        if (targetWh === 'MAIN_WAREHOUSE') {
          if (!wh.includes('MAIN') && !wh.includes('رئيسي')) return false;
        } else if (wh !== targetWh && getWarehouseLabel(row.warehouseName) !== getWarehouseLabel(selectedWarehouse)) {
          return false;
        }
      }

      // فلتر البحث النصي
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const mInv = (row.invoiceNumber || '').toLowerCase().includes(term);
        const mSup = (row.supplierName || '').toLowerCase().includes(term);
        const mItem = (row.itemName || '').toLowerCase().includes(term);
        const mCode = row.itemCode ? String(row.itemCode).toLowerCase().includes(term) : false;
        if (!mInv && !mSup && !mItem && !mCode) return false;
      }

      return true;
    }).sort((a, b) => {
      let valA: any = a.invoiceDate;
      let valB: any = b.invoiceDate;

      if (sortBy === 'supplier') {
        valA = a.supplierName;
        valB = b.supplierName;
      } else if (sortBy === 'item') {
        valA = a.itemName;
        valB = b.itemName;
      } else if (sortBy === 'quantity') {
        valA = a.quantity;
        valB = b.quantity;
      } else if (sortBy === 'cost') {
        valA = a.baseCost;
        valB = b.baseCost;
      } else if (sortBy === 'total') {
        valA = a.estimatedTotalValue;
        valB = b.estimatedTotalValue;
      }

      if (sortDirection === 'asc') {
        return valA > valB ? 1 : -1;
      }
      return valA < valB ? 1 : -1;
    });
  }, [auditRows, selectedSupplier, selectedItem, selectedCategory, selectedWarehouse, searchTerm, sortBy, sortDirection]);

  // إحصائيات KPIs
  const auditKPIs = useMemo(() => {
    let totalFreeQty = 0;
    let totalEstimatedValue = 0;
    const suppliersSet = new Set<string>();
    const invoicesSet = new Set<string>();
    const itemsSet = new Set<string>();

    filteredRows.forEach(r => {
      totalFreeQty += r.quantity;
      totalEstimatedValue += r.estimatedTotalValue;
      suppliersSet.add(r.supplierName);
      invoicesSet.add(r.invoiceNumber);
      itemsSet.add(r.itemName);
    });

    return {
      totalFreeQty,
      totalEstimatedValue,
      suppliersCount: suppliersSet.size,
      invoicesCount: invoicesSet.size,
      itemsCount: itemsSet.size
    };
  }, [filteredRows]);

  // عدد الفلاتر النشطة
  const activeFiltersCount = useMemo(() => {
    let c = 0;
    if (selectedSupplier !== 'ALL') c++;
    if (selectedItem !== 'ALL') c++;
    if (selectedCategory !== 'ALL') c++;
    if (selectedWarehouse !== 'ALL') c++;
    if (searchTerm.trim()) c++;
    return c;
  }, [selectedSupplier, selectedItem, selectedCategory, selectedWarehouse, searchTerm]);

  // إعادة تعيين الفلاتر
  const handleResetFilters = () => {
    setSelectedSupplier('ALL');
    setSelectedItem('ALL');
    setSelectedCategory('ALL');
    setSelectedWarehouse('ALL');
    setSearchTerm('');
  };

  // تصدير Excel
  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      alert('لا توجد بيانات بوانص تفصيلية متاحة للتصدير');
      return;
    }

    exportToXLSX({
      filename: `سجل_بوانص_وهدايا_الموردين_التفصيلي_${startDate}_إلى_${endDate}.xlsx`,
      sheetName: 'سجل البوانص التفصيلي',
      title: 'سجل بوانص وهدايا الموردين التفصيلي (Audit Trail)',
      subtitle: `الفترة من: ${startDate} إلى: ${endDate}`,
      filterSummary: `الفترة: ${startDate} إلى ${endDate} | عدد العمليات: ${filteredRows.length} | إجمالي قيمة الوفر: ${auditKPIs.totalEstimatedValue.toFixed(2)} ر.س`,
      headers: [
        'تاريخ الفاتورة',
        'رقم فاتورة الشراء',
        'اسم المورد',
        'المستودع المستلم',
        'كود الصنف',
        'اسم الصنف المجاني',
        'الفئة',
        'الكمية المجانية',
        'الوحدة',
        'التكلفة الافتراضية (ر.س)',
        'إجمالي الوفر التقديري (ر.س)',
        'البيان والملاحظات'
      ],
      rows: filteredRows.map(r => [
        r.invoiceDate,
        r.invoiceNumber,
        r.supplierName,
        r.warehouseName === 'MAIN_WAREHOUSE' ? 'المستودع الرئيسي' : (r.warehouseName || 'الرئيسي'),
        r.itemCode || '-',
        r.itemName,
        r.category || 'عام',
        r.quantity,
        r.unit,
        r.baseCost.toFixed(2),
        r.estimatedTotalValue.toFixed(2),
        r.notes
      ]),
      summaryRows: [
        [
          'الإجمالي العام',
          `فواتير: ${auditKPIs.invoicesCount}`,
          `موردين: ${auditKPIs.suppliersCount}`,
          '-',
          '-',
          `أصناف: ${auditKPIs.itemsCount}`,
          '-',
          auditKPIs.totalFreeQty,
          '-',
          '-',
          auditKPIs.totalEstimatedValue.toFixed(2),
          '-'
        ]
      ]
    });
  };

  // تصدير PDF / طباعة
  const handleExportPDF = () => {
    if (filteredRows.length === 0) {
      alert('لا توجد بيانات متاحة للطباعة');
      return;
    }

    const printableElement = document.getElementById('printable-detailed-bonuses-report');
    if (printableElement) {
      exportToPDF({
        filename: `سجل_بوانص_الموردين_التفصيلي_${startDate}_إلى_${endDate}.pdf`,
        title: 'سجل بوانص وهدايا الموردين التفصيلي',
        subtitle: `الفترة من ${startDate} إلى ${endDate}`,
        headers: ['التاريخ', 'رقم الفاتورة', 'المورد', 'المستودع', 'الصنف المجاني', 'الكمية', 'التكلفة', 'إجمالي الوفر'],
        rows: filteredRows.map(r => [
          r.invoiceDate,
          r.invoiceNumber,
          r.supplierName,
          r.warehouseName === 'MAIN_WAREHOUSE' ? 'الرئيسي' : (r.warehouseName || 'الرئيسي'),
          r.itemName,
          r.quantity,
          r.baseCost.toFixed(2),
          r.estimatedTotalValue.toFixed(2)
        ]),
        summaryRows: [
          ['الإجمالي', `فواتير: ${auditKPIs.invoicesCount}`, `موردين: ${auditKPIs.suppliersCount}`, '-', `أصناف: ${auditKPIs.itemsCount}`, auditKPIs.totalFreeQty, '-', auditKPIs.totalEstimatedValue.toFixed(2)]
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
              <ScrollText size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800">سجل بوانص وهدايا الموردين التفصيلي</h1>
              <p className="text-xs text-slate-500 font-medium">سجل تدقيق كامل لكل حركة بونص واردة مع رقم الفاتورة والتاريخ والمستودع</p>
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
            disabled={filteredRows.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <FileSpreadsheet size={16} />
            <span>تصدير Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={filteredRows.length === 0}
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
            <span className="font-bold text-sm text-slate-800">محددات وفلاتر سجل البوانص التفصيلي</span>
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

          {/* المورد */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Truck size={13} className="inline ml-1 text-indigo-600" />
              المورد المانح للبونص
            </label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-purple-500 bg-slate-50/50"
            >
              <option value="ALL">جميع الموردين ({suppliersList.length})</option>
              {suppliersList.map(v => (
                <option key={v.id} value={v.name}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* الصنف */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Package size={13} className="inline ml-1 text-cyan-600" />
              الصنف المجاني
            </label>
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-purple-500 bg-slate-50/50"
            >
              <option value="ALL">جميع الأصناف ({productsList.length})</option>
              {productsList.map(p => (
                <option key={p.id} value={p.name}>{p.name} {p.code ? `(${p.code})` : ''}</option>
              ))}
            </select>
          </div>

          {/* فئة الصنف */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Layers size={13} className="inline ml-1 text-pink-600" />
              فئة الصنف
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-purple-500 bg-slate-50/50"
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
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-purple-500 bg-slate-50/50"
            >
              <option value="ALL">كافة المستودعات والفروع</option>
              {getDynamicWarehousesList([selectedWarehouse !== 'ALL' ? selectedWarehouse : '']).map(w => (
                <option key={w.id} value={w.id}>{w.label}</option>
              ))}
            </select>
          </div>

          {/* البحث والتطبيق */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Search size={13} className="inline ml-1 text-slate-400" />
              بحث برقم الفاتورة أو المورد أو الصنف
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="بحث..."
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
            {selectedSupplier !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-medium">
                المورد: {selectedSupplier}
                <button type="button" onClick={() => setSelectedSupplier('ALL')} className="hover:text-indigo-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedItem !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-lg font-medium">
                الصنف: {selectedItem}
                <button type="button" onClick={() => setSelectedItem('ALL')} className="hover:text-cyan-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedCategory !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-pink-50 text-pink-700 border border-pink-200 rounded-lg font-medium">
                الفئة: {selectedCategory}
                <button type="button" onClick={() => setSelectedCategory('ALL')} className="hover:text-pink-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedWarehouse !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-medium">
                المستودع: {selectedWarehouse === 'MAIN_WAREHOUSE' ? 'المستودع الرئيسي' : selectedWarehouse}
                <button type="button" onClick={() => setSelectedWarehouse('ALL')} className="hover:text-emerald-900 cursor-pointer"><X size={12} /></button>
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
        
        {/* إجمالي الوفر المالي */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-purple-600 mb-2">
            <span className="text-xs font-bold text-slate-500">إجمالي قيمة الوفر التقديري</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
            {auditKPIs.totalEstimatedValue.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-purple-600 font-bold">{currencySymbol} قيمة بوانص مجانية</span>
        </div>

        {/* إجمالي الكميات المجانية */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-pink-600 mb-2">
            <span className="text-xs font-bold text-slate-500">إجمالي الكميات المجانية المستلمة</span>
            <div className="p-2 rounded-xl bg-pink-50 text-pink-600">
              <Gift size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
            {auditKPIs.totalFreeQty.toLocaleString()}
          </div>
          <span className="text-xs text-pink-600 font-bold">وحدة مجانية</span>
        </div>

        {/* عدد فواتير الشراء */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-bold text-slate-500">فواتير الشراء المحتوية على بونص</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <FileText size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
            {auditKPIs.invoicesCount}
          </div>
          <span className="text-xs text-blue-600 font-bold">فاتورة شراء</span>
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
            {auditKPIs.suppliersCount}
          </div>
          <span className="text-xs text-emerald-600 font-bold">مورد في السجل</span>
        </div>

      </div>

      {/* 4. Data Table */}
      <div id="printable-detailed-bonuses-report" className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ScrollText size={16} className="text-purple-600" />
            <h2 className="font-black text-sm text-slate-800">
              سجل تدقيق البوانص التفصيلي ({filteredRows.length} حركة)
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th className="p-3.5">#</th>
                <th className="p-3.5">تاريخ الفاتورة</th>
                <th className="p-3.5">رقم الفاتورة</th>
                <th className="p-3.5">اسم المورد</th>
                <th className="p-3.5">المستودع المستلم</th>
                <th className="p-3.5">كود الصنف</th>
                <th className="p-3.5">اسم الصنف المجاني</th>
                <th className="p-3.5">الفئة</th>
                <th className="p-3.5">الكمية</th>
                <th className="p-3.5">الوحدة</th>
                <th className="p-3.5">التكلفة الأساسية</th>
                <th className="p-3.5">إجمالي الوفر التقديري</th>
                <th className="p-3.5">البيان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Gift size={36} className="text-slate-300" />
                      <p className="font-bold text-sm text-slate-700">لا توجد حركات بوانص مسجلة مطابقة لشروط الفلترة</p>
                      <p className="text-xs text-slate-400">تأكد من اختيار الفترة الزمنية المناسبة</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-purple-50/30 transition-colors">
                    <td className="p-3.5 font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3.5 font-medium text-slate-700">{row.invoiceDate}</td>
                    <td className="p-3.5 font-mono font-bold text-purple-700">{row.invoiceNumber}</td>
                    <td className="p-3.5 font-black text-slate-800">{row.supplierName}</td>
                    <td className="p-3.5 text-slate-600">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                        {row.warehouseName === 'MAIN_WAREHOUSE' ? 'المستودع الرئيسي' : (row.warehouseName || 'الرئيسي')}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-500">{row.itemCode || '-'}</td>
                    <td className="p-3.5 font-bold text-slate-800">{row.itemName}</td>
                    <td className="p-3.5 text-slate-600">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                        {row.category || 'عام'}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono font-black text-purple-700 text-sm">
                      {row.quantity.toLocaleString()}
                    </td>
                    <td className="p-3.5 text-slate-500">{row.unit}</td>
                    <td className="p-3.5 font-mono text-slate-600">{row.baseCost.toFixed(2)}</td>
                    <td className="p-3.5 font-mono font-black text-emerald-700 text-sm">
                      {row.estimatedTotalValue.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 text-slate-500 text-[11px] max-w-xs truncate" title={row.notes}>
                      {row.notes || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot className="bg-slate-100 font-black border-t-2 border-slate-300 text-slate-800">
                <tr>
                  <td colSpan={8} className="p-4 text-sm">
                    الإجمالي العام ({auditKPIs.invoicesCount} فاتورة | {auditKPIs.suppliersCount} مورد | {auditKPIs.itemsCount} صنف)
                  </td>
                  <td className="p-4 font-mono text-purple-900 text-base">{auditKPIs.totalFreeQty.toLocaleString()}</td>
                  <td className="p-4 text-slate-400 font-normal text-xs">-</td>
                  <td className="p-4 text-slate-400 font-normal text-xs">-</td>
                  <td className="p-4 font-mono text-emerald-900 text-base">{auditKPIs.totalEstimatedValue.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="p-4 text-slate-500 font-normal text-xs">{currencySymbol}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  );
};

export default DetailedSupplierBonuses;
