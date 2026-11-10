import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, 
  Search, 
  Printer, 
  FileText, 
  DollarSign, 
  FileSpreadsheet, 
  Package, 
  Boxes, 
  Warehouse,
  ArrowUpDown, 
  ArrowLeft,
  Filter,
  TrendingUp,
  RefreshCw,
  Layers,
  Sparkles,
  Truck,
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../../../services/supabaseClient';
import { loadStoredPurchaseInvoices } from '../../../utils/purchasesStore';
import { loadStoredItems, getDynamicWarehousesList, getWarehouseLabel } from '../../../utils/itemsStore';
import { loadVendors } from '../../../utils/partnerLedger';
import { exportToXLSX, exportToPDF } from '../../../utils/universalExport';
import { useSystemCurrency } from '../../../utils/currency';

interface InventoryAndPurchasesAnalysisProps {
  onNavigate?: (view: string | null) => void;
}

export interface InventoryPurchaseItemRow {
  productId: string;
  itemCode: string;
  itemName: string;
  category: string;
  unit: string;
  openingQty: number; // مخزون أول المدة
  openingUnitCost: number; // تكلفة وحدة أول المدة
  openingCost: number; // إجمالي تكلفة أول المدة
  purchasedQty: number; // كمية المشتريات خلال الفترة
  purchasedCost: number; // إجمالي تكلفة المشتريات خلال الفترة
  totalInQty: number; // إجمالي الكمية الواردة = openingQty + purchasedQty
  totalCost: number; // إجمالي تكلفة الوارد
  averageUnitCost: number; // متوسط تكلفة الوحدة المرجح
  purchasesCount: number; // عدد فواتير الشراء
  currentStock: number; // الرصيد المخزني الحالي
  warehouseName?: string;
  supplierName?: string;
}

export const InventoryAndPurchasesAnalysis: React.FC<InventoryAndPurchasesAnalysisProps> = ({ onNavigate }) => {
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
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('ALL');
  const [movementFilter, setMovementFilter] = useState<'ALL' | 'WITH_PURCHASES' | 'WITH_OPENING' | 'WITH_ANY_STOCK' | 'STAGNANT'>('ALL');

  const [rawProducts, setRawProducts] = useState<any[]>([]);
  const [rawPurchasesLines, setRawPurchasesLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'totalCost' | 'totalInQty' | 'purchasedQty' | 'openingQty' | 'itemName'>('totalCost');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // جلب كتالوج الأصناف والموردين
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

  // استعلام البيانات
  const handleSearch = async () => {
    if (!startDate || !endDate) {
      alert('يرجى تحديد فترة البحث (من تاريخ / إلى تاريخ)');
      return;
    }

    setLoading(true);

    try {
      // 1. جلب الأصناف
      let productsList: any[] = [];
      const { data: dbProducts, error: prodError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          code,
          barcode,
          category,
          unit,
          stock,
          opening_stock,
          opening_balance,
          cost_price,
          costPrice,
          initial_cost,
          warehouse_name
        `);

      if (!prodError && dbProducts && dbProducts.length > 0) {
        productsList = dbProducts;
      } else {
        productsList = localCatalog;
      }
      setRawProducts(productsList);

      // 2. جلب مشتريات الفترة
      let purchaseLines: any[] = [];
      const { data: dbLines, error: linesError } = await supabase
        .from('purchase_lines')
        .select(`
          id,
          purchase_id,
          product_id,
          item_id,
          quantity,
          unit_price,
          cost_price,
          line_total,
          products (
            id,
            name,
            code,
            category
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

      if (!linesError && dbLines && dbLines.length > 0) {
        purchaseLines = dbLines.map(line => ({
          productId: line.product_id || line.products?.id,
          itemCode: line.products?.code,
          itemName: line.products?.name || 'صنف',
          category: line.products?.category || 'عام',
          quantity: Number(line.quantity) || 0,
          cost: Number(line.line_total || (Number(line.quantity) * Number(line.unit_price || line.cost_price || 0))) || 0,
          supplierId: line.purchase_invoices?.vendor_id || line.purchase_invoices?.supplier_id,
          supplierName: line.purchase_invoices?.supplier_name,
          warehouseName: line.purchase_invoices?.warehouse_name || 'MAIN_WAREHOUSE',
          invoiceId: line.purchase_invoices?.id
        }));
      } else {
        // Fallback للمحلي
        const storedInvoices = loadStoredPurchaseInvoices();
        const periodInvoices = storedInvoices.filter(inv => {
          const invDate = inv.date || inv.createdAt?.substring(0, 10);
          return invDate >= startDate && invDate <= endDate;
        });

        const lines: any[] = [];
        periodInvoices.forEach(inv => {
          const matchedVendor = allVendors.find(v => v.id === inv.partnerId || v.name === inv.partnerName);
          const supplierName = inv.partnerName || matchedVendor?.name || 'مورد عام';
          const supplierId = inv.partnerId || matchedVendor?.id || 'VENDOR_GENERAL';
          const warehouseName = inv.warehouseName || 'MAIN_WAREHOUSE';

          (inv.items || []).forEach(it => {
            const matchedCat = localCatalog.find(c => 
              (it.itemId && c.id === it.itemId) || 
              (it.itemCode && c.code === it.itemCode) || 
              (it.description && c.name.trim().toLowerCase() === it.description.trim().toLowerCase())
            );

            const qty = Number(it.quantity) || 0;
            const unitCost = Number(it.unitPrice || (it as any).costPrice || 0);
            const lineTotal = Number((it as any).total ?? (it as any).line_total ?? (qty * unitCost)) || 0;

            if (qty > 0) {
              lines.push({
                productId: matchedCat?.id || it.itemId,
                itemCode: it.itemCode || matchedCat?.code,
                itemName: it.description || matchedCat?.name || 'صنف',
                category: matchedCat?.category || (it as any).category || 'عام',
                quantity: qty,
                cost: lineTotal,
                supplierId,
                supplierName,
                warehouseName,
                invoiceId: inv.id || inv.invoiceNumber
              });
            }
          });
        });

        purchaseLines = lines;
      }

      setRawPurchasesLines(purchaseLines);

    } catch (err) {
      console.error('Error in handleSearch InventoryAndPurchasesAnalysis:', err);
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

  // قائمة الفئات المتاحة
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    rawProducts.forEach(p => {
      if (p.category) set.add(p.category.trim());
    });
    rawPurchasesLines.forEach(l => {
      if (l.category) set.add(l.category.trim());
    });
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [rawProducts, rawPurchasesLines]);

  // بناء التقرير المجمع
  const reportData = useMemo(() => {
    // 1. تصفية خطوط المشتريات
    const filteredPurchases = rawPurchasesLines.filter(l => {
      if (selectedWarehouse !== 'ALL') {
        const wh = (l.warehouseName || '').toUpperCase();
        const targetWh = selectedWarehouse.toUpperCase();
        if (targetWh === 'MAIN_WAREHOUSE') {
          if (!wh.includes('MAIN') && !wh.includes('رئيسي')) return false;
        } else if (wh !== targetWh && getWarehouseLabel(l.warehouseName) !== getWarehouseLabel(selectedWarehouse)) {
          return false;
        }
      }

      if (selectedSupplierId !== 'ALL') {
        const matchId = l.supplierId === selectedSupplierId;
        const matchedVendorObj = allVendors.find(v => v.id === selectedSupplierId);
        const matchName = matchedVendorObj && (l.supplierName || '').toLowerCase().includes((matchedVendorObj.name || '').toLowerCase());
        if (!matchId && !matchName) return false;
      }

      return true;
    });

    // تجميع مشتريات الأصناف
    const purchasesByItemMap: Record<string, { qty: number; cost: number; count: number; supplierNames: Set<string> }> = {};

    filteredPurchases.forEach(line => {
      const key = (line.productId || line.itemCode || line.itemName).trim().toLowerCase();
      if (!purchasesByItemMap[key]) {
        purchasesByItemMap[key] = { qty: 0, cost: 0, count: 0, supplierNames: new Set() };
      }
      purchasesByItemMap[key].qty += line.quantity;
      purchasesByItemMap[key].cost += line.cost;
      purchasesByItemMap[key].count += 1;
      if (line.supplierName) purchasesByItemMap[key].supplierNames.add(line.supplierName);
    });

    // 2. دمج الأصناف مع المشتريات
    const resultMap: Record<string, InventoryPurchaseItemRow> = {};

    rawProducts.forEach(prod => {
      const prodKey = (prod.id || prod.code || prod.name).trim().toLowerCase();
      const nameKey = (prod.name || '').trim().toLowerCase();
      const codeKey = (prod.code || '').trim().toLowerCase();

      const purchaseData = purchasesByItemMap[prodKey] || purchasesByItemMap[codeKey] || purchasesByItemMap[nameKey];

      const openingQty = Number(prod.opening_stock ?? prod.opening_balance ?? (prod as any).openingStock ?? 0);
      const openingUnitCost = Number(prod.cost_price ?? prod.costPrice ?? prod.initial_cost ?? 0);
      const openingCost = openingQty * openingUnitCost;

      const purchasedQty = purchaseData ? purchaseData.qty : 0;
      const purchasedCost = purchaseData ? purchaseData.cost : 0;
      const purchasesCount = purchaseData ? purchaseData.count : 0;

      const totalInQty = openingQty + purchasedQty;
      const totalCost = openingCost + purchasedCost;
      const averageUnitCost = totalInQty > 0 ? totalCost / totalInQty : openingUnitCost;
      const currentStock = Number(prod.stock ?? (totalInQty));

      resultMap[prodKey] = {
        productId: prod.id || prodKey,
        itemCode: prod.code || prod.barcode || '-',
        itemName: prod.name || 'صنف غير مسمى',
        category: prod.category || 'عام / غير مصنف',
        unit: prod.unit || 'حبة',
        openingQty,
        openingUnitCost,
        openingCost,
        purchasedQty,
        purchasedCost,
        totalInQty,
        totalCost,
        averageUnitCost,
        purchasesCount,
        currentStock,
        warehouseName: prod.warehouse_name || 'MAIN_WAREHOUSE',
        supplierName: purchaseData ? Array.from(purchaseData.supplierNames).join(', ') : '-'
      };
    });

    // تضمين الأصناف التي قد تكون موجودة في المشتريات فقط ولم تسجل في الكتالوج الرئيسي
    filteredPurchases.forEach(pLine => {
      const key = (pLine.productId || pLine.itemCode || pLine.itemName).trim().toLowerCase();
      if (!resultMap[key]) {
        const totalInQty = pLine.quantity;
        const totalCost = pLine.cost;
        resultMap[key] = {
          productId: pLine.productId || key,
          itemCode: pLine.itemCode || '-',
          itemName: pLine.itemName,
          category: pLine.category || 'عام / غير مصنف',
          unit: 'حبة',
          openingQty: 0,
          openingUnitCost: 0,
          openingCost: 0,
          purchasedQty: pLine.quantity,
          purchasedCost: pLine.cost,
          totalInQty,
          totalCost,
          averageUnitCost: totalInQty > 0 ? totalCost / totalInQty : 0,
          purchasesCount: 1,
          currentStock: totalInQty,
          warehouseName: pLine.warehouseName,
          supplierName: pLine.supplierName
        };
      }
    });

    let list = Object.values(resultMap);

    // 3. تطبيق الفلاتر
    list = list.filter(item => {
      // فلتر الفئة
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;

      // فلتر نوع الحركة
      if (movementFilter === 'WITH_PURCHASES' && item.purchasedQty <= 0) return false;
      if (movementFilter === 'WITH_OPENING' && item.openingQty <= 0) return false;
      if (movementFilter === 'WITH_ANY_STOCK' && item.currentStock <= 0) return false;
      if (movementFilter === 'STAGNANT' && (item.purchasedQty > 0 || item.totalInQty <= 0)) return false;

      // فلتر المورد المحدد (إذا تم اختياره، يجب أن يكون الصنف قد تم شراؤه منه)
      if (selectedSupplierId !== 'ALL' && item.purchasedQty <= 0) return false;

      return true;
    });

    return list;

  }, [rawProducts, rawPurchasesLines, selectedCategory, selectedWarehouse, selectedSupplierId, movementFilter, allVendors]);

  // إحصائيات KPIs
  const summaryStats = useMemo(() => {
    let totalPurchasesCost = 0;
    let totalPurchasesQty = 0;
    let totalOpeningCost = 0;
    let totalOpeningQty = 0;
    let grandTotalCost = 0;
    let grandTotalInQty = 0;
    let itemsWithPurchases = 0;

    reportData.forEach(r => {
      totalPurchasesCost += r.purchasedCost;
      totalPurchasesQty += r.purchasedQty;
      totalOpeningCost += r.openingCost;
      totalOpeningQty += r.openingQty;
      grandTotalCost += r.totalCost;
      grandTotalInQty += r.totalInQty;
      if (r.purchasedQty > 0) itemsWithPurchases++;
    });

    const activeItemsCount = reportData.length;
    const overallAvgCost = grandTotalInQty > 0 ? grandTotalCost / grandTotalInQty : 0;

    return {
      totalPurchasesCost,
      totalPurchasesQty,
      totalOpeningCost,
      totalOpeningQty,
      grandTotalCost,
      grandTotalInQty,
      activeItemsCount,
      itemsWithPurchases,
      overallAvgCost
    };
  }, [reportData]);

  // عدد الفلاتر النشطة
  const activeFiltersCount = useMemo(() => {
    let c = 0;
    if (selectedCategory !== 'ALL') c++;
    if (selectedWarehouse !== 'ALL') c++;
    if (selectedSupplierId !== 'ALL') c++;
    if (movementFilter !== 'ALL') c++;
    if (searchTerm.trim()) c++;
    return c;
  }, [selectedCategory, selectedWarehouse, selectedSupplierId, movementFilter, searchTerm]);

  // إعادة تعيين الفلاتر
  const handleResetFilters = () => {
    setSelectedCategory('ALL');
    setSelectedWarehouse('ALL');
    setSelectedSupplierId('ALL');
    setMovementFilter('ALL');
    setSearchTerm('');
  };

  // تصفية وترتيب القائمة المعروضة
  const filteredAndSortedList = useMemo(() => {
    let result = reportData.filter(row => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (row.itemName || '').toLowerCase().includes(term) ||
        (row.itemCode && String(row.itemCode).toLowerCase().includes(term)) ||
        (row.category && (row.category || '').toLowerCase().includes(term))
      );
    });

    result.sort((a, b) => {
      let valA: any = a.totalCost;
      let valB: any = b.totalCost;

      if (sortBy === 'totalInQty') {
        valA = a.totalInQty;
        valB = b.totalInQty;
      } else if (sortBy === 'purchasedQty') {
        valA = a.purchasedQty;
        valB = b.purchasedQty;
      } else if (sortBy === 'openingQty') {
        valA = a.openingQty;
        valB = b.openingQty;
      } else if (sortBy === 'itemName') {
        valA = a.itemName;
        valB = b.itemName;
      }

      if (sortDirection === 'asc') {
        return valA > valB ? 1 : -1;
      }
      return valA < valB ? 1 : -1;
    });

    return result;
  }, [reportData, searchTerm, sortBy, sortDirection]);

  // تبديل الترتيب
  const toggleSort = (column: 'totalCost' | 'totalInQty' | 'purchasedQty' | 'openingQty' | 'itemName') => {
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
      filename: `تحليل_المخزون_وحركة_المشتريات_${startDate}_إلى_${endDate}.xlsx`,
      sheetName: 'المخزون والمشتريات',
      title: 'تقرير تحليل المخزون وحركة المشتريات وتكلفة الوارد',
      subtitle: `الفترة من: ${startDate} إلى: ${endDate}`,
      filterSummary: `الفترة: ${startDate} إلى ${endDate} | عدد الأصناف: ${summaryStats.activeItemsCount} | إجمالي تكلفة الوارد: ${summaryStats.grandTotalCost.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ر.س`,
      headers: [
        'كود الصنف',
        'اسم الصنف',
        'الفئة',
        'رصيد أول المدة',
        'تكلفة أول المدة (ر.س)',
        'كمية المشتريات',
        'تكلفة المشتريات (ر.س)',
        'إجمالي الكمية الواردة',
        'متوسط تكلفة الوحدة (ر.س)',
        'إجمالي تكلفة الوارد (ر.س)'
      ],
      rows: filteredAndSortedList.map(r => [
        r.itemCode,
        r.itemName,
        r.category,
        r.openingQty,
        r.openingCost.toFixed(2),
        r.purchasedQty,
        r.purchasedCost.toFixed(2),
        r.totalInQty,
        r.averageUnitCost.toFixed(2),
        r.totalCost.toFixed(2)
      ]),
      summaryRows: [
        [
          'الإجمالي الكلي',
          `أصناف: ${summaryStats.activeItemsCount}`,
          '-',
          summaryStats.totalOpeningQty,
          summaryStats.totalOpeningCost.toFixed(2),
          summaryStats.totalPurchasesQty,
          summaryStats.totalPurchasesCost.toFixed(2),
          summaryStats.grandTotalInQty,
          summaryStats.overallAvgCost.toFixed(2),
          summaryStats.grandTotalCost.toFixed(2)
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

    const printableElement = document.getElementById('printable-inventory-purchases-report');
    if (printableElement) {
      exportToPDF({
        filename: `تحليل_المخزون_والمشتريات_${startDate}_إلى_${endDate}.pdf`,
        title: 'تحليل المخزون وحركة المشتريات وتكلفة الوارد',
        subtitle: `الفترة من ${startDate} إلى ${endDate}`,
        headers: ['كود الصنف', 'اسم الصنف', 'الفئة', 'أول المدة', 'مشتريات الفترة', 'إجمالي الوارد', 'متوسط التكلفة', 'إجمالي التكلفة'],
        rows: filteredAndSortedList.map(r => [
          r.itemCode,
          r.itemName,
          r.category,
          r.openingQty,
          r.purchasedQty,
          r.totalInQty,
          r.averageUnitCost.toFixed(2),
          r.totalCost.toFixed(2)
        ]),
        summaryRows: [
          ['الإجمالي', `أصناف: ${summaryStats.activeItemsCount}`, '-', summaryStats.totalOpeningQty, summaryStats.totalPurchasesQty, summaryStats.grandTotalInQty, summaryStats.overallAvgCost.toFixed(2), summaryStats.grandTotalCost.toFixed(2)]
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
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <Boxes size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800">تحليل المخزون وحركة المشتريات</h1>
              <p className="text-xs text-slate-500 font-medium">مقارنة رصيد وتكلفة أول المدة مع واردات المشتريات واحتساب متوسط تكلفة الوحدة المرجح</p>
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
            <Filter size={18} className="text-emerald-600" />
            <span className="font-bold text-sm text-slate-800">محددات وفلاتر حركة المخزون والمشتريات</span>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">
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
                className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-200/80"
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
              <Calendar size={13} className="inline ml-1 text-emerald-600" />
              من تاريخ
            </label>
            <input 
              type="date" 
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-emerald-500 bg-slate-50/50" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
            />
          </div>

          {/* إلى تاريخ */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Calendar size={13} className="inline ml-1 text-emerald-600" />
              إلى تاريخ
            </label>
            <input 
              type="date" 
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-emerald-500 bg-slate-50/50" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
            />
          </div>

          {/* فئة الصنف */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Layers size={13} className="inline ml-1 text-purple-600" />
              فئة الصنف
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-emerald-500 bg-slate-50/50"
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
              المستودع / الفرع
            </label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-emerald-500 bg-slate-50/50"
            >
              <option value="ALL">كافة المستودعات والفروع</option>
              {getDynamicWarehousesList([selectedWarehouse !== 'ALL' ? selectedWarehouse : '']).map(w => (
                <option key={w.id} value={w.id}>{w.label}</option>
              ))}
            </select>
          </div>

          {/* المورد */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Truck size={13} className="inline ml-1 text-indigo-600" />
              المورد المورد للأصناف
            </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-emerald-500 bg-slate-50/50"
            >
              <option value="ALL">جميع الموردين ({allVendors.length})</option>
              {allVendors.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.code ? `(${v.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* حالة الحركة والمخزون */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Boxes size={13} className="inline ml-1 text-cyan-600" />
              حالة الحركة والنشاط
            </label>
            <select
              value={movementFilter}
              onChange={(e) => setMovementFilter(e.target.value as any)}
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-emerald-500 bg-slate-50/50"
            >
              <option value="ALL">كافة الأصناف (بحركة أو بدون)</option>
              <option value="WITH_PURCHASES">أصناف بها مشتريات خلال الفترة فقط</option>
              <option value="WITH_OPENING">أصناف لها رصيد أول مدة فقط</option>
              <option value="WITH_ANY_STOCK">أصناف لها رصيد متبقي</option>
              <option value="STAGNANT">أصناف راكدة (بدون مشتريات)</option>
            </select>
          </div>

          {/* البحث والتحديث */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Search size={13} className="inline ml-1 text-slate-400" />
              بحث بالاسم أو الكود
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="اسم الصنف أو الكود..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-emerald-500 bg-slate-50/50"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={loading}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
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
            {selectedWarehouse !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-medium">
                المستودع: {selectedWarehouse === 'MAIN_WAREHOUSE' ? 'المستودع الرئيسي' : selectedWarehouse}
                <button type="button" onClick={() => setSelectedWarehouse('ALL')} className="hover:text-emerald-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {selectedSupplierId !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-medium">
                المورد: {allVendors.find(v => v.id === selectedSupplierId)?.name || selectedSupplierId}
                <button type="button" onClick={() => setSelectedSupplierId('ALL')} className="hover:text-indigo-900 cursor-pointer"><X size={12} /></button>
              </span>
            )}
            {movementFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-lg font-medium">
                الحركة: {
                  movementFilter === 'WITH_PURCHASES' ? 'بها مشتريات' :
                  movementFilter === 'WITH_OPENING' ? 'بها أول مدة' :
                  movementFilter === 'WITH_ANY_STOCK' ? 'بها رصيد' : 'راكدة'
                }
                <button type="button" onClick={() => setMovementFilter('ALL')} className="hover:text-cyan-900 cursor-pointer"><X size={12} /></button>
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
        
        {/* إجمالي تكلفة الوارد */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold text-slate-500">إجمالي تكلفة الوارد (أول مدة + مشتريات)</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
            {summaryStats.grandTotalCost.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-emerald-600 font-bold">{currencySymbol} تكلفة مرجحة</span>
        </div>

        {/* مشتريات الفترة */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-bold text-slate-500">تكلفة مشتريات الفترة</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Package size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-700 font-mono">
            {summaryStats.totalPurchasesCost.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-blue-600 font-bold">{summaryStats.totalPurchasesQty.toLocaleString()} قطعة مشتراة</span>
        </div>

        {/* تكلفة أول المدة */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-purple-600 mb-2">
            <span className="text-xs font-bold text-slate-500">تكلفة مخزون أول المدة</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Warehouse size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
            {summaryStats.totalOpeningCost.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-purple-600 font-bold">{summaryStats.totalOpeningQty.toLocaleString()} قطعة أول مدة</span>
        </div>

        {/* إجمالي الكميات ومتوسط التكلفة */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold text-slate-500">متوسط تكلفة الوحدة المرجح</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
            {summaryStats.overallAvgCost.toFixed(2)}
          </div>
          <span className="text-xs text-amber-600 font-bold">{currencySymbol} / وحدة عبر {summaryStats.activeItemsCount} صنف</span>
        </div>

      </div>

      {/* 4. Data Table */}
      <div id="printable-inventory-purchases-report" className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Boxes size={16} className="text-emerald-600" />
            <h2 className="font-black text-sm text-slate-800">
              جدول تحليل حركة المخزون وتكلفة المشتريات ({filteredAndSortedList.length} صنف)
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th className="p-3.5">كود الصنف</th>
                <th 
                  className="p-3.5 cursor-pointer hover:bg-slate-200/60 transition"
                  onClick={() => toggleSort('itemName')}
                >
                  <div className="flex items-center gap-1">
                    <span>اسم الصنف</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5">الفئة</th>
                <th 
                  className="p-3.5 cursor-pointer hover:bg-slate-200/60 transition"
                  onClick={() => toggleSort('openingQty')}
                >
                  <div className="flex items-center gap-1">
                    <span>أول المدة</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5">تكلفة أول المدة</th>
                <th 
                  className="p-3.5 cursor-pointer hover:bg-slate-200/60 transition"
                  onClick={() => toggleSort('purchasedQty')}
                >
                  <div className="flex items-center gap-1">
                    <span>مشتريات الفترة</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5">تكلفة المشتريات</th>
                <th 
                  className="p-3.5 cursor-pointer hover:bg-slate-200/60 transition"
                  onClick={() => toggleSort('totalInQty')}
                >
                  <div className="flex items-center gap-1">
                    <span>إجمالي الوارد</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5">متوسط التكلفة</th>
                <th 
                  className="p-3.5 cursor-pointer hover:bg-slate-200/60 transition"
                  onClick={() => toggleSort('totalCost')}
                >
                  <div className="flex items-center gap-1">
                    <span>إجمالي تكلفة الوارد</span>
                    <ArrowUpDown size={12} className="text-emerald-600" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSortedList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Boxes size={36} className="text-slate-300" />
                      <p className="font-bold text-sm text-slate-700">لا توجد أصناف مطابقة للبحث وشروط الفلترة</p>
                      <p className="text-xs text-slate-400">يرجى تعديل الفلاتر أو الفترة الزمنية</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedList.map((row) => (
                  <tr key={row.productId} className="hover:bg-emerald-50/40 transition-colors">
                    <td className="p-3.5 font-mono text-slate-500">{row.itemCode}</td>
                    <td className="p-3.5 font-black text-slate-800">{row.itemName}</td>
                    <td className="p-3.5 text-slate-600">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                        {row.category}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-700 font-bold">{row.openingQty.toLocaleString()}</td>
                    <td className="p-3.5 font-mono text-slate-600">{row.openingCost.toFixed(2)}</td>
                    <td className="p-3.5 font-mono font-bold text-blue-700">{row.purchasedQty.toLocaleString()}</td>
                    <td className="p-3.5 font-mono text-blue-800">{row.purchasedCost.toFixed(2)}</td>
                    <td className="p-3.5 font-mono font-black text-slate-800">{row.totalInQty.toLocaleString()}</td>
                    <td className="p-3.5 font-mono text-amber-700 font-bold">{row.averageUnitCost.toFixed(2)}</td>
                    <td className="p-3.5 font-mono font-black text-emerald-800 text-sm">
                      {row.totalCost.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredAndSortedList.length > 0 && (
              <tfoot className="bg-slate-100 font-black border-t-2 border-slate-300 text-slate-800">
                <tr>
                  <td colSpan={3} className="p-4 text-sm">
                    الإجمالي العام ({summaryStats.activeItemsCount} صنف)
                  </td>
                  <td className="p-4 font-mono">{summaryStats.totalOpeningQty.toLocaleString()}</td>
                  <td className="p-4 font-mono">{summaryStats.totalOpeningCost.toFixed(2)}</td>
                  <td className="p-4 font-mono text-blue-900">{summaryStats.totalPurchasesQty.toLocaleString()}</td>
                  <td className="p-4 font-mono text-blue-900">{summaryStats.totalPurchasesCost.toFixed(2)}</td>
                  <td className="p-4 font-mono">{summaryStats.grandTotalInQty.toLocaleString()}</td>
                  <td className="p-4 font-mono text-amber-900">{summaryStats.overallAvgCost.toFixed(2)}</td>
                  <td className="p-4 font-mono text-emerald-900 text-base">{summaryStats.grandTotalCost.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  );
};

export default InventoryAndPurchasesAnalysis;
