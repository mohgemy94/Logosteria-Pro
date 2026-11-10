import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, 
  Search, 
  Printer, 
  FileSpreadsheet, 
  Package, 
  ArrowLeft,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Clock,
  Layers,
  Sparkles,
  Building2,
  Receipt,
  AlertCircle,
  Hash,
  ChevronDown,
  RotateCcw,
  Truck,
  Warehouse,
  CreditCard,
  X,
  Filter,
  DollarSign
} from 'lucide-react';
import { supabase } from '../../../services/supabaseClient';
import { loadStoredPurchaseInvoices } from '../../../utils/purchasesStore';
import { loadStoredItems, getDynamicWarehousesList } from '../../../utils/itemsStore';
import { loadVendors } from '../../../utils/partnerLedger';
import { exportToXLSX, exportToPDF } from '../../../utils/universalExport';
import { useSystemCurrency } from '../../../utils/currency';

interface SingleItemPurchaseAnalysisProps {
  onNavigate?: (view: string | null) => void;
}

export interface PurchaseMovementLine {
  id: string;
  date: string;
  invoiceNumber: string;
  invoiceId?: string;
  supplierId?: string;
  supplierName: string;
  warehouseName?: string;
  paymentType?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  unit?: string;
  notes?: string;
  priceDiffVsOpening?: number;
  priceDiffPercentVsOpening?: number;
  priceDiffVsPrev?: number;
  cumulativeQty?: number;
  cumulativeCost?: number;
}

export interface SelectedProductDetails {
  id: string;
  code: string;
  name: string;
  barcode?: string;
  category: string;
  unit: string;
  currentStock: number;
  openingQty: number;
  openingUnitCost: number;
  openingCost: number;
}

export const SingleItemPurchaseAnalysis: React.FC<SingleItemPurchaseAnalysisProps> = ({ onNavigate }) => {
  const { symbol: currencySymbol } = useSystemCurrency();
  const todayStr = new Date().toISOString().substring(0, 10);

  // الفترات الزمنية
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // أول الشهر الحالي افتراضياً
    return d.toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(todayStr);

  // قائمة الأصناف للاختيار
  const [productsList, setProductsList] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearchTerm, setProductSearchTerm] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  // فلاتر إضافية
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [selectedPaymentType, setSelectedPaymentType] = useState<string>('ALL');

  // بيانات التقرير للصنف المختار
  const [selectedProduct, setSelectedProduct] = useState<SelectedProductDetails | null>(null);
  const [rawPurchaseLines, setRawPurchaseLines] = useState<PurchaseMovementLine[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // قائمة الموردين
  const allVendors = useMemo(() => {
    try {
      return loadVendors();
    } catch {
      return [];
    }
  }, []);

  // تحميل قائمة الأصناف عند بدء التشغيل
  useEffect(() => {
    loadProductsCatalog();
  }, []);

  const loadProductsCatalog = async () => {
    try {
      const { data, error } = await supabase
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
          initial_cost
        `)
        .order('name');

      if (!error && data && data.length > 0) {
        setProductsList(data);
        if (!selectedProductId && data[0]?.id) {
          setSelectedProductId(String(data[0].id));
        }
      } else {
        const local = loadStoredItems();
        setProductsList(local);
        if (!selectedProductId && local[0]?.id) {
          setSelectedProductId(String(local[0].id));
        }
      }
    } catch (err) {
      console.warn('Error loading products catalog:', err);
      const local = loadStoredItems();
      setProductsList(local);
      if (local[0]?.id) setSelectedProductId(String(local[0].id));
    }
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

  // جلب حركات الشراء للصنف المختار
  const fetchItemMovements = async () => {
    if (!selectedProductId) return;
    if (!startDate || !endDate) {
      alert('يرجى تحديد فترة البحث');
      return;
    }

    setLoading(true);

    try {
      // 1. تحديد بيانات الصنف
      const prod = productsList.find(p => String(p.id) === String(selectedProductId)) || productsList[0];
      if (prod) {
        const openingQty = Number(prod.opening_stock ?? prod.opening_balance ?? (prod as any).openingStock ?? 0);
        const openingUnitCost = Number(prod.cost_price ?? prod.costPrice ?? prod.initial_cost ?? 0);
        setSelectedProduct({
          id: String(prod.id),
          code: prod.code || prod.barcode || '-',
          name: prod.name || 'صنف',
          barcode: prod.barcode,
          category: prod.category || 'عام',
          unit: prod.unit || 'حبة',
          currentStock: Number(prod.stock ?? openingQty),
          openingQty,
          openingUnitCost,
          openingCost: openingQty * openingUnitCost
        });
      }

      // 2. جلب الحركات من Supabase
      const { data: dbLines, error } = await supabase
        .from('purchase_lines')
        .select(`
          id,
          quantity,
          unit_price,
          cost_price,
          line_total,
          notes,
          product_id,
          products (
            id,
            name,
            code,
            unit
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
        .eq('product_id', selectedProductId)
        .gte('purchase_invoices.created_at', startDate)
        .lte('purchase_invoices.created_at', `${endDate}T23:59:59`)
        .order('purchase_invoices.created_at', { ascending: true });

      if (!error && dbLines && dbLines.length > 0) {
        const lines: PurchaseMovementLine[] = dbLines.map((row: any) => {
          const inv = row.purchase_invoices;
          const qty = Number(row.quantity) || 0;
          const price = Number(row.unit_price || row.cost_price) || 0;
          const total = Number(row.line_total || qty * price) || 0;

          return {
            id: String(row.id),
            date: inv.created_at?.substring(0, 10) || '',
            invoiceNumber: inv.invoice_number || inv.id,
            invoiceId: inv.id,
            supplierId: inv.vendor_id || inv.supplier_id,
            supplierName: inv.supplier_name || 'مورد عام',
            warehouseName: inv.warehouse_name || 'MAIN_WAREHOUSE',
            paymentType: inv.payment_type || 'CASH',
            quantity: qty,
            unitPrice: price,
            lineTotal: total,
            unit: row.products?.unit || 'حبة',
            notes: row.notes || ''
          };
        });

        setRawPurchaseLines(lines);
      } else {
        // Fallback: جلب البيانات المحلية
        const localInvoices = loadStoredPurchaseInvoices();
        const periodInvoices = localInvoices.filter(inv => {
          const invDate = inv.date || inv.createdAt?.substring(0, 10);
          return invDate >= startDate && invDate <= endDate;
        });

        const lines: PurchaseMovementLine[] = [];

        periodInvoices.forEach(inv => {
          const matchedVendor = allVendors.find(v => v.id === inv.partnerId || v.name === inv.partnerName);
          const supplierName = inv.partnerName || matchedVendor?.name || 'مورد عام';
          const supplierId = inv.partnerId || matchedVendor?.id;
          const warehouseName = inv.warehouseName || 'MAIN_WAREHOUSE';
          const paymentType = inv.paymentMethod || inv.paymentType || 'CASH';

          (inv.items || []).forEach((it: any) => {
            const matchesId = it.itemId && String(it.itemId) === String(selectedProductId);
            const matchesCode = prod?.code && it.itemCode && it.itemCode === prod.code;
            const matchesName = prod?.name && it.description && it.description.trim().toLowerCase() === prod.name.trim().toLowerCase();

            if (matchesId || matchesCode || matchesName) {
              const qty = Number(it.quantity) || 0;
              const unitPrice = Number(it.unitPrice || it.costPrice || 0);
              const lineTotal = Number(it.total ?? it.line_total ?? (qty * unitPrice)) || 0;

              lines.push({
                id: it.itemId ? `${inv.id}_${it.itemId}` : `${inv.id}_${Math.random()}`,
                date: inv.date || inv.createdAt?.substring(0, 10) || '',
                invoiceNumber: inv.invoiceNumber || inv.id,
                invoiceId: inv.id,
                supplierId,
                supplierName,
                warehouseName,
                paymentType,
                quantity: qty,
                unitPrice,
                lineTotal,
                unit: (it as any).unit || prod?.unit || 'حبة',
                notes: inv.notes || ''
              });
            }
          });
        });

        lines.sort((a, b) => a.date.localeCompare(b.date));
        setRawPurchaseLines(lines);
      }
    } catch (err) {
      console.error('Error fetching single item purchases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProductId) {
      fetchItemMovements();
    }
  }, [selectedProductId]);

  // تصفية ومعالجة خطوط الحركة
  const filteredLines = useMemo(() => {
    let filtered = rawPurchaseLines.filter(l => {
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
        if (selectedWarehouse === 'MAIN_WAREHOUSE' && !wh.includes('MAIN') && !wh.includes('رئيسي')) return false;
        if (selectedWarehouse === 'BRANCH_RIYADH' && !wh.includes('RIYADH') && !wh.includes('رياض')) return false;
        if (selectedWarehouse === 'BRANCH_JEDDAH' && !wh.includes('JEDDAH') && !wh.includes('جدة')) return false;
        if (selectedWarehouse === 'SHOWROOM' && !wh.includes('SHOWROOM') && !wh.includes('معرض')) return false;
      }

      // فلتر نوع السداد
      if (selectedPaymentType !== 'ALL') {
        const pType = (l.paymentType || '').toUpperCase();
        if (selectedPaymentType === 'CASH' && pType !== 'CASH') return false;
        if (selectedPaymentType === 'CREDIT' && pType !== 'CREDIT') return false;
      }

      return true;
    });

    // احتساب الفروقات والتراكميات
    const openingUnitCost = selectedProduct?.openingUnitCost || 0;
    let prevPrice = openingUnitCost;
    let runQty = selectedProduct?.openingQty || 0;
    let runCost = selectedProduct?.openingCost || 0;

    const processed = filtered.map(line => {
      const priceDiffVsOpening = openingUnitCost > 0 ? line.unitPrice - openingUnitCost : 0;
      const priceDiffPercentVsOpening = openingUnitCost > 0 ? (priceDiffVsOpening / openingUnitCost) * 100 : 0;
      const priceDiffVsPrev = line.unitPrice - prevPrice;
      
      runQty += line.quantity;
      runCost += line.lineTotal;
      prevPrice = line.unitPrice;

      return {
        ...line,
        priceDiffVsOpening,
        priceDiffPercentVsOpening,
        priceDiffVsPrev,
        cumulativeQty: runQty,
        cumulativeCost: runCost
      };
    });

    if (sortOrder === 'desc') {
      return [...processed].reverse();
    }
    return processed;

  }, [rawPurchaseLines, selectedSupplierId, selectedWarehouse, selectedPaymentType, selectedProduct, sortOrder, allVendors]);

  // إحصائيات KPIs
  const movementStats = useMemo(() => {
    let totalQty = 0;
    let totalCost = 0;
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    const suppliersSet = new Set<string>();

    filteredLines.forEach(l => {
      totalQty += l.quantity;
      totalCost += l.lineTotal;
      if (l.unitPrice < minPrice) minPrice = l.unitPrice;
      if (l.unitPrice > maxPrice) maxPrice = l.unitPrice;
      if (l.supplierName) suppliersSet.add(l.supplierName);
    });

    if (minPrice === Infinity) minPrice = 0;
    if (maxPrice === -Infinity) maxPrice = 0;

    const avgPrice = totalQty > 0 ? totalCost / totalQty : 0;
    const lastPrice = filteredLines.length > 0 ? (sortOrder === 'desc' ? filteredLines[0].unitPrice : filteredLines[filteredLines.length - 1].unitPrice) : (selectedProduct?.openingUnitCost || 0);

    return {
      totalQty,
      totalCost,
      minPrice,
      maxPrice,
      avgPrice,
      lastPrice,
      invoiceCount: filteredLines.length,
      suppliersCount: suppliersSet.size
    };
  }, [filteredLines, selectedProduct, sortOrder]);

  // عدد الفلاتر النشطة
  const activeFiltersCount = useMemo(() => {
    let c = 0;
    if (selectedSupplierId !== 'ALL') c++;
    if (selectedWarehouse !== 'ALL') c++;
    if (selectedPaymentType !== 'ALL') c++;
    return c;
  }, [selectedSupplierId, selectedWarehouse, selectedPaymentType]);

  // تصفية قائمة الأصناف للبحث
  const filteredProductsDropdown = useMemo(() => {
    if (!productSearchTerm.trim()) return productsList.slice(0, 30);
    const term = productSearchTerm.toLowerCase();
    return productsList.filter(p => 
      p.name?.toLowerCase().includes(term) || 
      p.code?.toLowerCase().includes(term) ||
      p.barcode?.toLowerCase().includes(term)
    ).slice(0, 30);
  }, [productsList, productSearchTerm]);

  // تصدير Excel
  const handleExportExcel = () => {
    if (!selectedProduct || filteredLines.length === 0) {
      alert('لا توجد حركات شراء متاحة للتصدير');
      return;
    }

    exportToXLSX({
      filename: `تحليل_مشتريات_الصنف_${selectedProduct.code}_${startDate}_إلى_${endDate}.xlsx`,
      sheetName: 'حركة شراء الصنف',
      title: `تقرير تحليل حركة شراء صنف: ${selectedProduct.name}`,
      subtitle: `كود: ${selectedProduct.code} | الفترة: ${startDate} إلى ${endDate}`,
      filterSummary: `الفترة: ${startDate} إلى ${endDate} | إجمالي الكميات: ${movementStats.totalQty} | متوسط سعر الشراء: ${movementStats.avgPrice.toFixed(2)} ر.س`,
      headers: [
        'التاريخ',
        'رقم فاتورة الشراء',
        'اسم المورد',
        'المستودع',
        'طريقة الدفع',
        'الكمية المشتراة',
        'سعر شراء الوحدة (ر.س)',
        'إجمالي الحركة (ر.س)',
        'الفارق عن أول المدة %'
      ],
      rows: filteredLines.map(l => [
        l.date,
        l.invoiceNumber,
        l.supplierName,
        l.warehouseName === 'MAIN_WAREHOUSE' ? 'المستودع الرئيسي' : (l.warehouseName || 'الرئيسي'),
        l.paymentType === 'CASH' ? 'نقدي' : 'آجل',
        l.quantity,
        l.unitPrice.toFixed(2),
        l.lineTotal.toFixed(2),
        `${(l.priceDiffPercentVsOpening || 0).toFixed(1)}%`
      ]),
      summaryRows: [
        [
          'الإجمالي للفترة',
          `حركات: ${movementStats.invoiceCount}`,
          `موردين: ${movementStats.suppliersCount}`,
          '-',
          '-',
          movementStats.totalQty,
          movementStats.avgPrice.toFixed(2),
          movementStats.totalCost.toFixed(2),
          '-'
        ]
      ]
    });
  };

  // تصدير PDF / طباعة
  const handleExportPDF = () => {
    if (!selectedProduct || filteredLines.length === 0) {
      alert('لا توجد بيانات متاحة للطباعة');
      return;
    }

    const printableElement = document.getElementById('printable-single-item-purchases-report');
    if (printableElement) {
      exportToPDF({
        filename: `تحليل_مشتريات_الصنف_${selectedProduct.code}_${startDate}_إلى_${endDate}.pdf`,
        title: `تحليل حركة شراء الصنف: ${selectedProduct.name}`,
        subtitle: `الفترة من ${startDate} إلى ${endDate} | كود: ${selectedProduct.code}`,
        headers: ['التاريخ', 'رقم الفاتورة', 'المورد', 'المستودع', 'الكمية', 'سعر الوحدة', 'الإجمالي', 'الفارق عن الأساس %'],
        rows: filteredLines.map(l => [
          l.date,
          l.invoiceNumber,
          l.supplierName,
          l.warehouseName === 'MAIN_WAREHOUSE' ? 'الرئيسي' : (l.warehouseName || 'الرئيسي'),
          l.quantity,
          l.unitPrice.toFixed(2),
          l.lineTotal.toFixed(2),
          `${(l.priceDiffPercentVsOpening || 0).toFixed(1)}%`
        ]),
        summaryRows: [
          ['الإجمالي للفترة', `حركات: ${movementStats.invoiceCount}`, `موردين: ${movementStats.suppliersCount}`, '-', movementStats.totalQty, movementStats.avgPrice.toFixed(2), movementStats.totalCost.toFixed(2), '-']
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
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600">
              <TrendingUp size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800">تحليل حركة شراء صنف محدد</h1>
              <p className="text-xs text-slate-500 font-medium">متابعة تاريخية لأسعار الشراء ومقارنة عروض الموردين واكتشاف التضخم في التكلفة</p>
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
            disabled={filteredLines.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <FileSpreadsheet size={16} />
            <span>تصدير Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={filteredLines.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <Printer size={16} />
            <span>طباعة / PDF</span>
          </button>
        </div>
      </div>

      {/* 2. Filter & Item Selector Bar */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 mb-6 space-y-4">
        
        {/* Item Selector Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex-1 min-w-[280px]">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Package size={14} className="inline ml-1 text-blue-600" />
              اختر الصنف المراد تحليله
            </label>
            <div className="relative">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full border border-blue-200 bg-blue-50/30 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
              >
                {productsList.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.code ? `[${p.code}]` : ''} - (الرصيد: {p.stock ?? p.opening_stock ?? 0})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Date Range */}
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
                className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-200/80"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Multi-Dimensional Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* من تاريخ */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Calendar size={13} className="inline ml-1 text-blue-600" />
              من تاريخ
            </label>
            <input 
              type="date" 
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-blue-500 bg-slate-50/50" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
            />
          </div>

          {/* إلى تاريخ */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <Calendar size={13} className="inline ml-1 text-blue-600" />
              إلى تاريخ
            </label>
            <input 
              type="date" 
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-blue-500 bg-slate-50/50" 
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
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-blue-500 bg-slate-50/50"
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
              className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 text-xs font-medium focus:border-blue-500 bg-slate-50/50"
            >
              <option value="ALL">كافة المستودعات والفروع</option>
              {getDynamicWarehousesList([selectedWarehouse !== 'ALL' ? selectedWarehouse : '']).map(w => (
                <option key={w.id} value={w.id}>{w.label}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Second Row: Payment Type + Search Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-600">طريقة السداد:</span>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="paymentType"
                  value="ALL"
                  checked={selectedPaymentType === 'ALL'}
                  onChange={() => setSelectedPaymentType('ALL')}
                />
                <span>الكل</span>
              </label>
              <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="paymentType"
                  value="CASH"
                  checked={selectedPaymentType === 'CASH'}
                  onChange={() => setSelectedPaymentType('CASH')}
                />
                <span>نقدي فقط</span>
              </label>
              <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="paymentType"
                  value="CREDIT"
                  checked={selectedPaymentType === 'CREDIT'}
                  onChange={() => setSelectedPaymentType('CREDIT')}
                />
                <span>آجل فقط</span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchItemMovements}
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {loading ? 'جاري التحليل...' : 'تحديث حركة الصنف'}
            </button>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSupplierId('ALL');
                  setSelectedWarehouse('ALL');
                  setSelectedPaymentType('ALL');
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                title="مسح الفلاتر الإضافية"
              >
                <RotateCcw size={14} />
              </button>
            )}
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
          </div>
        )}
      </div>

      {/* 3. Product Info Card */}
      {selectedProduct && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 rounded-2xl shadow-sm mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 text-xs font-bold border border-blue-400/30">
                {selectedProduct.category}
              </span>
              <h2 className="text-xl sm:text-2xl font-black mt-1">{selectedProduct.name}</h2>
              <div className="flex items-center gap-4 text-xs text-slate-300 mt-2 font-mono">
                <span>كود: {selectedProduct.code}</span>
                <span>•</span>
                <span>الوحدة: {selectedProduct.unit}</span>
                <span>•</span>
                <span>الرصيد المخزني: {selectedProduct.currentStock.toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-white/10 p-4 rounded-xl border border-white/10 text-center">
              <span className="text-[11px] text-slate-300 font-medium">تكلفة أول المدة (سعر الأساس)</span>
              <div className="text-xl font-black font-mono text-emerald-400 mt-0.5">
                {selectedProduct.openingUnitCost.toFixed(2)} {currencySymbol}
              </div>
              <span className="text-[10px] text-slate-300">الكمية الافتتاحية: {selectedProduct.openingQty.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Movement KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        
        {/* إجمالي الكميات المشتراة */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-[11px] font-bold text-slate-500">الكميات المشتراة</span>
            <Package size={16} />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-800 font-mono">
            {movementStats.totalQty.toLocaleString()}
          </div>
          <span className="text-[10px] text-blue-600 font-bold">{movementStats.invoiceCount} عملية شراء</span>
        </div>

        {/* إجمالي تكلفة المشتريات */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 mb-1">
            <span className="text-[11px] font-bold text-slate-500">إجمالي التكلفة</span>
            <DollarSign size={16} />
          </div>
          <div className="text-base sm:text-lg font-black text-indigo-700 font-mono">
            {movementStats.totalCost.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-indigo-600 font-bold">{currencySymbol} شامل الضريبة</span>
        </div>

        {/* متوسط سعر الشراء */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-cyan-600 mb-1">
            <span className="text-[11px] font-bold text-slate-500">متوسط سعر الشراء</span>
            <TrendingUp size={16} />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-800 font-mono">
            {movementStats.avgPrice.toFixed(2)}
          </div>
          <span className="text-[10px] text-cyan-600 font-bold">{currencySymbol} / وحدة</span>
        </div>

        {/* آخر سعر شراء */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-[11px] font-bold text-slate-500">آخر سعر شراء</span>
            <Clock size={16} />
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-700 font-mono">
            {movementStats.lastPrice.toFixed(2)}
          </div>
          <span className="text-[10px] text-emerald-600 font-bold">
            {selectedProduct && selectedProduct.openingUnitCost > 0 ? (
              movementStats.lastPrice > selectedProduct.openingUnitCost 
                ? `+${(((movementStats.lastPrice - selectedProduct.openingUnitCost) / selectedProduct.openingUnitCost) * 100).toFixed(1)}% عن الأساس`
                : `${(((movementStats.lastPrice - selectedProduct.openingUnitCost) / selectedProduct.openingUnitCost) * 100).toFixed(1)}% عن الأساس`
            ) : '-'}
          </span>
        </div>

        {/* أقل سعر شراء */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-teal-600 mb-1">
            <span className="text-[11px] font-bold text-slate-500">أقل سعر شراء</span>
            <TrendingDown size={16} />
          </div>
          <div className="text-base sm:text-lg font-black text-teal-700 font-mono">
            {movementStats.minPrice.toFixed(2)}
          </div>
          <span className="text-[10px] text-teal-600 font-bold">{currencySymbol} أقل سعر مورد</span>
        </div>

        {/* أعلى سعر شراء */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-[11px] font-bold text-slate-500">أعلى سعر شراء</span>
            <TrendingUp size={16} />
          </div>
          <div className="text-base sm:text-lg font-black text-rose-700 font-mono">
            {movementStats.maxPrice.toFixed(2)}
          </div>
          <span className="text-[10px] text-rose-600 font-bold">{currencySymbol} أعلى تكلفة مسجلة</span>
        </div>

      </div>

      {/* 5. Movement History Table */}
      <div id="printable-single-item-purchases-report" className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt size={16} className="text-blue-600" />
            <h2 className="font-black text-sm text-slate-800">
              سجل فواتير وحركات شراء الصنف ({filteredLines.length} حركة)
            </h2>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <span>الترتيب الزمني:</span>
            <button
              type="button"
              onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              {sortOrder === 'asc' ? 'الأقدم أولاً (زمنياً)' : 'الأحدث أولاً (تنازلي)'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th className="p-3.5">#</th>
                <th className="p-3.5">التاريخ</th>
                <th className="p-3.5">رقم الفاتورة</th>
                <th className="p-3.5">اسم المورد</th>
                <th className="p-3.5">المستودع</th>
                <th className="p-3.5">طريقة الدفع</th>
                <th className="p-3.5">الكمية</th>
                <th className="p-3.5">سعر الوحدة</th>
                <th className="p-3.5">إجمالي الفاتورة</th>
                <th className="p-3.5">الفارق عن الأساس %</th>
                <th className="p-3.5">التراكمي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLines.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package size={36} className="text-slate-300" />
                      <p className="font-bold text-sm text-slate-700">لا توجد حركات شراء مسجلة لهذا الصنف خلال الفترة المحددة</p>
                      <p className="text-xs text-slate-400">جرب توسيع الفترة الزمنية أو إزالة فلاتر الموردين</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLines.map((line, idx) => {
                  const isHigher = (line.priceDiffVsOpening || 0) > 0.01;
                  const isLower = (line.priceDiffVsOpening || 0) < -0.01;

                  return (
                    <tr key={line.id || idx} className="hover:bg-blue-50/40 transition-colors">
                      <td className="p-3.5 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3.5 font-medium text-slate-700">{line.date}</td>
                      <td className="p-3.5 font-mono font-bold text-blue-700">{line.invoiceNumber}</td>
                      <td className="p-3.5 font-black text-slate-800">{line.supplierName}</td>
                      <td className="p-3.5 text-slate-600">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                          {line.warehouseName === 'MAIN_WAREHOUSE' ? 'المستودع الرئيسي' : (line.warehouseName || 'الرئيسي')}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          line.paymentType === 'CASH' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {line.paymentType === 'CASH' ? 'نقدي' : 'آجل'}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-slate-800">{line.quantity.toLocaleString()}</td>
                      <td className="p-3.5 font-mono font-black text-slate-800 text-sm">{line.unitPrice.toFixed(2)}</td>
                      <td className="p-3.5 font-mono font-bold text-indigo-800">{line.lineTotal.toFixed(2)}</td>
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold ${
                          isHigher ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          isLower ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {isHigher && '↑ +'}
                          {isLower && '↓ '}
                          {(line.priceDiffPercentVsOpening || 0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-500 text-[11px]">
                        {line.cumulativeQty?.toLocaleString()} وحدة
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredLines.length > 0 && (
              <tfoot className="bg-slate-100 font-black border-t-2 border-slate-300 text-slate-800">
                <tr>
                  <td colSpan={6} className="p-4 text-sm">
                    إجمالي حركات الصنف ({movementStats.invoiceCount} حركة شراء)
                  </td>
                  <td className="p-4 font-mono">{movementStats.totalQty.toLocaleString()}</td>
                  <td className="p-4 font-mono text-cyan-800">{movementStats.avgPrice.toFixed(2)}</td>
                  <td className="p-4 font-mono text-indigo-900 text-base">{movementStats.totalCost.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td colSpan={2} className="p-4 text-slate-500 font-normal text-xs">{currencySymbol}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  );
};

export default SingleItemPurchaseAnalysis;
