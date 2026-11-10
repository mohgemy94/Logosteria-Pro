import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Package, 
  Search, 
  Printer, 
  FileText, 
  RotateCcw, 
  DollarSign, 
  TrendingUp, 
  FileSpreadsheet,
  Award,
  Layers,
  BarChart2,
  ArrowUpDown,
  Filter,
  Warehouse,
  Users,
  Receipt,
  Scale,
  Briefcase,
  Landmark,
  UserCheck
} from 'lucide-react';
import { loadStoredItems, getDynamicWarehousesList, getWarehouseLabel } from '../../../utils/itemsStore';
import { loadCustomers } from '../../../utils/partnerLedger';
import { exportToXLSX, exportToPDF } from '../../../utils/universalExport';
import { getUnifiedSalesInvoices, getDynamicSalesRepsList, doesInvoiceMatchSalesRep } from '../../../utils/salesReportsUnifiedStore';
import { loadChartOfAccounts } from '../../../utils/trialBalanceStore';
import { isCashOrBankAccount } from '../../../utils/accountingIntegration';

interface ItemSalesAnalysisProps {
  onNavigate?: (view: string | null) => void;
}

interface ItemSalesGroupRow {
  itemId: string;
  itemName: string;
  itemCode?: string | undefined;
  category?: string | undefined;
  totalQuantity: number;
  totalRevenue: number;
  averageUnitPrice: number;
  salesPercentage: number;
  invoiceCount: number;
  rank: number;
}

export const ItemSalesAnalysis: React.FC<ItemSalesAnalysisProps> = ({ onNavigate }) => {
  const todayStr = new Date().toISOString().substring(0, 10);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // أول الشهر الحالي افتراضياً
    return d.toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [reportData, setReportData] = useState<ItemSalesGroupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  
  // الفلاتر المتقدمة المناسبة لتحليل مبيعات الأصناف
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('ALL');
  const [selectedInvoiceType, setSelectedInvoiceType] = useState<string>('ALL');
  const [selectedClassification, setSelectedClassification] = useState<string>('ALL');
  const [selectedServiceType, setSelectedServiceType] = useState<string>('ALL');
  const [selectedSafe, setSelectedSafe] = useState<string>('ALL');
  const [selectedSalesRep, setSelectedSalesRep] = useState<string>('ALL');
  const [customersList, setCustomersList] = useState<{ id: string; name: string; code?: string }[]>([]);

  // تحميل العملاء
  useMemo(() => {
    try {
      const custs = loadCustomers();
      setCustomersList(custs.map(c => ({ id: c.id, name: c.name, code: c.code || '' })));
    } catch {}
  }, []);

  const selectedCustomerObj = useMemo(() => {
    if (selectedCustomerId === 'ALL') return null;
    return customersList.find(c => c.id === selectedCustomerId) || null;
  }, [selectedCustomerId, customersList]);

  const cashBankOptions = useMemo(() => {
    const chart = loadChartOfAccounts();
    return chart.filter(a => isCashOrBankAccount(a, chart)).map(a => ({ id: a.code || a.id, label: `${a.code} - ${a.name}` }));
  }, []);

  const dynamicWarehouses = useMemo(() => {
    return getDynamicWarehousesList([selectedSource !== 'ALL' ? selectedSource : '']);
  }, [selectedSource]);

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

  const [sortBy, setSortBy] = useState<'quantity' | 'revenue' | 'name'>('quantity');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // جلب قائمة الأصناف لمطابقة الأكواد والتصنيفات
  const localCatalog = useMemo(() => {
    try {
      return loadStoredItems();
    } catch {
      return [];
    }
  }, []);

  // استخراج قائمة الفئات والتصنيفات المتاحة ديناميكياً
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    (localCatalog || []).forEach(item => {
      if (item.category && item.category.trim()) set.add(item.category.trim());
    });
    (reportData || []).forEach(row => {
      if (row.category && row.category.trim()) set.add(row.category.trim());
    });
    return Array.from(set).sort();
  }, [localCatalog, reportData]);

  // المجاميع الإجمالية
  const grandTotalQuantity = useMemo(() => reportData.reduce((sum, r) => sum + r.totalQuantity, 0), [reportData]);
  const grandTotalRevenue = useMemo(() => reportData.reduce((sum, r) => sum + r.totalRevenue, 0), [reportData]);
  const totalItemsCount = reportData.length;
  const overallAvgPrice = grandTotalQuantity > 0 ? grandTotalRevenue / grandTotalQuantity : 0;
  const topSoldItem = reportData.length > 0 ? reportData[0] : null;

  // تصفية الفواتير وفق الفلاتر النشطة
  const isInvoiceMatchingFilters = (inv: any) => {
    const invDate = inv.date || inv.createdAt?.substring(0, 10);
    if (!invDate || invDate < startDate || invDate > endDate) return false;

    // 1. فلتر المستودع / الفرع
    if (selectedSource !== 'ALL') {
      const s = (inv.source || inv.warehouse || 'MAIN_WAREHOUSE').toUpperCase();
      if (s !== selectedSource.toUpperCase()) return false;
    }

    // 2. فلتر العميل
    if (selectedCustomerId !== 'ALL') {
      const pId = inv.partnerId || inv.customer_id;
      const pName = inv.partnerName || inv.customer_name;
      if (pId !== selectedCustomerId && (!selectedCustomerObj || pName !== selectedCustomerObj.name)) return false;
    }

    // 3. فلتر نوع الفاتورة
    if (selectedInvoiceType !== 'ALL') {
      const t = (inv.invoiceType || inv.type || '').toUpperCase();
      const paid = Number(inv.totals?.cashPaid ?? inv.paid_amount ?? 0);
      const total = Number(inv.totals?.grandTotal ?? inv.total_amount ?? 0);
      if (selectedInvoiceType === 'CASH_SALES' && !t.includes('CASH') && !(paid >= total && total > 0 && !t.includes('RETURN'))) return false;
      if (selectedInvoiceType === 'CREDIT_SALES' && !t.includes('CREDIT')) return false;
      if (selectedInvoiceType === 'RETURNS' && !t.includes('RETURN') && !t.includes('مرتجع')) return false;
    }

    // 4. فلتر التصنيف الضريبي
    const isTax = inv.classification === 'TAX' || Number(inv.totals?.taxTotal ?? inv.tax_amount ?? 0) > 0;
    if (selectedClassification === 'TAX' && !isTax) return false;
    if (selectedClassification === 'NORMAL' && isTax) return false;

    // 5. فلتر نوع الخدمة
    if (selectedServiceType === 'NONE') {
      const s = (inv.serviceType || inv.service_type || '').trim();
      if (s && s !== '-- بدون خدمة محددة --') return false;
    } else if (selectedServiceType !== 'ALL') {
      const s = (inv.serviceType || inv.service_type || '').trim().toLowerCase();
      if (s !== selectedServiceType.trim().toLowerCase()) return false;
    }

    // 6. فلتر خزينة التحصيل
    if (selectedSafe !== 'ALL') {
      const currentSafe = (inv.safe || inv.paymentAccount || inv.treasury || 'MAIN_SAFE').toUpperCase();
      if (currentSafe !== selectedSafe.toUpperCase()) return false;
    }

    // 7. فلتر مندوب المبيعات ومنشئ الفاتورة
    if (selectedSalesRep !== 'ALL') {
      const rawRep = ((inv as any).salesRepName || (inv as any).technicianName || (inv as any).salesman || (inv as any).salesPerson || (inv as any).createdBy || (inv as any).userId || 'مندوب المبيعات العام').trim();
      if (!doesInvoiceMatchSalesRep(rawRep, selectedSalesRep)) return false;
    }

    return true;
  };

  // تنفيذ الاستعلام وتجميع البيانات (Grouping Logic)
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
        if (!invDate || invDate < startDate || invDate > endDate) return false;

        // 1. فلتر المستودع / الفرع
        if (selectedSource !== 'ALL') {
          const s = (inv.source || 'MAIN_WAREHOUSE').toUpperCase();
          if (s !== selectedSource.toUpperCase()) return false;
        }

        // 2. فلتر العميل
        if (selectedCustomerId !== 'ALL') {
          const matchId = inv.partnerId === selectedCustomerId;
          const matchName = selectedCustomerObj && (inv.partnerName || '').toLowerCase().includes((selectedCustomerObj.name || '').toLowerCase());
          if (!matchId && !matchName) return false;
        }

        // 3. فلتر نوع الفاتورة
        if (selectedInvoiceType !== 'ALL') {
          const t = (inv.invoiceType || '').toUpperCase();
          if (selectedInvoiceType === 'CASH_SALES' && !t.includes('CASH') && inv.paymentStatus !== 'PAID') return false;
          if (selectedInvoiceType === 'CREDIT_SALES' && !t.includes('CREDIT') && inv.paymentStatus !== 'UNPAID') return false;
          if (selectedInvoiceType === 'RETURNS' && !inv.isReturn && !t.includes('RETURN') && !t.includes('مرتجع')) return false;
        }

        // 4. فلتر التصنيف الضريبي
        const isTax = inv.classification === 'TAX' || inv.totals.taxTotal > 0;
        if (selectedClassification === 'TAX' && !isTax) return false;
        if (selectedClassification === 'NORMAL' && isTax) return false;

        // 5. فلتر نوع الخدمة
        if (selectedServiceType === 'NONE') {
          const s = (inv.serviceType || '').trim();
          if (s && s !== '-- بدون خدمة محددة --') return false;
        } else if (selectedServiceType !== 'ALL') {
          const s = (inv.serviceType || '').trim().toLowerCase();
          if (s !== selectedServiceType.trim().toLowerCase()) return false;
        }

        // 6. فلتر خزينة التحصيل
        if (selectedSafe !== 'ALL') {
          const currentSafe = (inv.safe || 'MAIN_SAFE').toUpperCase();
          if (currentSafe !== selectedSafe.toUpperCase()) return false;
        }

        // 7. فلتر مندوب المبيعات
        if (!doesInvoiceMatchSalesRep(inv.salesRepName, selectedSalesRep)) return false;

        return true;
      });

      const groupedMap: Record<string, ItemSalesGroupRow> = {};

      filteredInvoices.forEach(inv => {
        (inv.items || []).forEach(item => {
          const key = item.itemId || item.itemCode || item.description || 'صنف غير محدد';
          const name = item.description || 'صنف غير محدد';
          const code = item.itemCode;
          const category = item.category || 'عام';
          const qty = Number(item.quantity) || 0;
          const lineTotal = Number(item.totalSale ?? (qty * item.unitPrice)) || 0;

          if (qty > 0) {
            if (!groupedMap[key]) {
              groupedMap[key] = {
                itemId: item.itemId || key,
                itemName: name,
                itemCode: code,
                category: category,
                totalQuantity: 0,
                totalRevenue: 0,
                averageUnitPrice: 0,
                salesPercentage: 0,
                invoiceCount: 0,
                rank: 0
              };
            }

            const row = groupedMap[key]!;
            row.totalQuantity += qty;
            row.totalRevenue += lineTotal;
            row.invoiceCount += 1;
          }
        });
      });

      const totalPeriodSales = Object.values(groupedMap).reduce((sum, c) => sum + c.totalRevenue, 0);

      // تحويل الكائن إلى مصفوفة وترتيبها تنازلياً حسب إجمالي الكمية المباعة
      const sortedList: ItemSalesGroupRow[] = Object.values(groupedMap)
        .map(c => ({
          ...c,
          averageUnitPrice: c.totalQuantity > 0 ? c.totalRevenue / c.totalQuantity : 0,
          salesPercentage: totalPeriodSales > 0 ? (c.totalRevenue / totalPeriodSales) * 100 : 0
        }))
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .map((c, idx) => ({ ...c, rank: idx + 1 }));

      setReportData(sortedList);
    } catch (err: any) {
      console.error('Error fetching item sales analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  // إعادة التعيين
  const handleReset = () => {
    const d = new Date();
    d.setDate(1);
    setStartDate(d.toISOString().substring(0, 10));
    setEndDate(todayStr);
    setSelectedCategory('ALL');
    setSelectedSource('ALL');
    setSelectedCustomerId('ALL');
    setSelectedInvoiceType('ALL');
    setSelectedClassification('ALL');
    setSelectedServiceType('ALL');
    setSelectedSafe('ALL');
    setSelectedSalesRep('ALL');
    setSearchTerm('');
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

  // فلترة وترتيب القائمة المعروضة
  const filteredAndSortedList = useMemo(() => {
    let result = reportData.filter(row => {
      // تطبيق فلتر الفئة والتصنيف
      if (selectedCategory !== 'ALL') {
        const itemCat = (row.category || '').trim();
        if (itemCat !== selectedCategory) {
          return false;
        }
      }

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (row.itemName || '').toLowerCase().includes(term) ||
        (row.itemCode && String(row.itemCode).toLowerCase().includes(term)) ||
        (row.category && (row.category || '').toLowerCase().includes(term))
      );
    });

    result.sort((a, b) => {
      let valA: any = a.totalQuantity;
      let valB: any = b.totalQuantity;

      if (sortBy === 'revenue') {
        valA = a.totalRevenue;
        valB = b.totalRevenue;
      } else if (sortBy === 'name') {
        valA = a.itemName;
        valB = b.itemName;
      }

      if (sortDirection === 'asc') {
        return valA > valB ? 1 : -1;
      }
      return valA < valB ? 1 : -1;
    });

    return result;
  }, [reportData, selectedCategory, searchTerm, sortBy, sortDirection]);

  // المجاميع المحسوبة للقائمة المفلترة حالياً (لضمان تحديث الـ KPIs والجدول تلقائياً مع الفئة المختارة)
  const currentTotalQuantity = useMemo(() => filteredAndSortedList.reduce((sum, r) => sum + r.totalQuantity, 0), [filteredAndSortedList]);
  const currentTotalRevenue = useMemo(() => filteredAndSortedList.reduce((sum, r) => sum + r.totalRevenue, 0), [filteredAndSortedList]);
  const currentItemsCount = filteredAndSortedList.length;
  const currentAvgPrice = currentTotalQuantity > 0 ? currentTotalRevenue / currentTotalQuantity : 0;
  const currentTopSoldItem = filteredAndSortedList.length > 0 ? filteredAndSortedList[0] : null;

  // تبديل الترتيب
  const toggleSort = (column: 'quantity' | 'revenue' | 'name') => {
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

    const categoryTitle = selectedCategory === 'ALL' ? 'جميع الفئات والتصنيفات' : `فئة: ${selectedCategory}`;

    exportToXLSX({
      filename: `تقرير_حصر_ومبيعات_الأصناف_${startDate}_إلى_${endDate}.xlsx`,
      sheetName: 'تحليل مبيعات الأصناف',
      title: 'تقرير تحليل مبيعات الأصناف وحصر الكميات المباعة',
      subtitle: `الفترة من: ${startDate} إلى: ${endDate}`,
      filterSummary: `الفترة: ${startDate} إلى ${endDate} | ${categoryTitle} | إجمالي الكميات المباعة: ${currentTotalQuantity.toLocaleString('ar-EG')} قطعة | إجمالي المبيعات: ${currentTotalRevenue.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ر.س`,
      headers: [
        'الترتيب',
        'كود الصنف',
        'اسم الصنف',
        'التصنيف',
        'إجمالي الكمية المباعة',
        'متوسط سعر البيع',
        'إجمالي قيمة المبيعات (ر.س)',
        'النسبة من الإجمالي %',
        'عدد مرات البيع'
      ],
      rows: filteredAndSortedList.map(r => [
        r.rank,
        r.itemCode || '-',
        r.itemName,
        r.category || 'عام',
        r.totalQuantity,
        r.averageUnitPrice.toFixed(2),
        r.totalRevenue.toFixed(2),
        `${r.salesPercentage.toFixed(1)}%`,
        r.invoiceCount
      ]),
      summaryRows: [
        [
          'الإجمالي الكلي',
          '-',
          `عدد الأصناف: ${currentItemsCount}`,
          '-',
          currentTotalQuantity,
          currentAvgPrice.toFixed(2),
          currentTotalRevenue.toFixed(2),
          '100.0%',
          '-'
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

    const categoryTitle = selectedCategory === 'ALL' ? 'كافة الفئات' : `فئة: ${selectedCategory}`;
    const printableElement = document.getElementById('printable-item-sales-report');
    if (printableElement) {
      exportToPDF({
        filename: `تقرير_مبيعات_الأصناف_${startDate}_إلى_${endDate}.pdf`,
        title: 'تقرير تحليل مبيعات وحصر الأصناف المباعة',
        subtitle: `الفترة من ${startDate} إلى ${endDate} | ${categoryTitle}`,
        headers: ['#', 'كود الصنف', 'اسم الصنف', 'التصنيف', 'الكمية المباعة', 'متوسط السعر', 'إجمالي المبيعات', 'النسبة %'],
        rows: filteredAndSortedList.map(r => [
          r.rank,
          r.itemCode || '-',
          r.itemName,
          r.category || 'عام',
          r.totalQuantity.toLocaleString('ar-EG'),
          r.averageUnitPrice.toFixed(2),
          r.totalRevenue.toFixed(2),
          `${r.salesPercentage.toFixed(1)}%`
        ]),
        summaryRows: [
          ['الإجمالي', '-', `أصناف: ${currentItemsCount}`, '-', currentTotalQuantity.toLocaleString('ar-EG'), currentAvgPrice.toFixed(2), currentTotalRevenue.toFixed(2), '100%']
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
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <Package size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                تحليل مبيعات الأصناف وحصر الكميات الأكثر مبيعاً
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                حصر شامل لجميع الأصناف المباعة وتجميع الكميات وقيم المبيعات لمعرفة الأصناف الرابحة وحجم المسحوبات
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
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 mb-6">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <Filter size={18} className="text-amber-600" />
            <span>فلاتر تحليل مبيعات الأصناف وحصر الكميات</span>
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
          
          {/* الصف الأول: الفئة، المستودع/الفرع، العميل، نوع الفاتورة، التصنيف الضريبي، نوع الخدمة، الخزينة، ومندوب المبيعات */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            
            {/* فلتر الفئة والتصنيف */}
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
                {dynamicWarehouses.map(w => (
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

            {/* فلتر التصنيف الضريبي */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Scale size={14} className="text-purple-600" />
                  <span>التصنيف</span>
                </span>
                {selectedClassification !== 'ALL' && (
                  <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded font-bold border border-purple-200">
                    مفلتر
                  </span>
                )}
              </label>
              <select
                value={selectedClassification}
                onChange={(e) => setSelectedClassification(e.target.value)}
                className="w-full py-2 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-purple-500 transition-all cursor-pointer"
              >
                <option value="ALL">📑 الكل</option>
                <option value="TAX">🏢 ضريبية</option>
                <option value="NORMAL">📄 عادية</option>
              </select>
            </div>

            {/* فلتر نوع الخدمة والنشاط */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Briefcase size={14} className="text-amber-600" />
                  <span>الخدمة / النشاط</span>
                </span>
                {selectedServiceType !== 'ALL' && (
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-bold border border-amber-200">
                    مفلتر
                  </span>
                )}
              </label>
              <select
                value={selectedServiceType}
                onChange={(e) => setSelectedServiceType(e.target.value)}
                className="w-full py-2 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 transition-all cursor-pointer"
              >
                <option value="ALL">💼 جميع الخدمات</option>
                <option value="NONE">📦 بضائع فقط</option>
                <option value="استشارات">💡 استشارات</option>
                <option value="تصميم">🎨 تصميم</option>
                <option value="برمجة">💻 برمجة</option>
                <option value="صيانة">🔧 صيانة</option>
                <option value="تركيب">🛠️ تركيب</option>
                <option value="دعم فني">🎧 دعم فني</option>
                <option value="خدمات عامة">⚙️ خدمات عامة</option>
              </select>
            </div>

            {/* فلتر الخزينة والحساب */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Landmark size={14} className="text-indigo-600" />
                  <span>الخزينة / الحساب</span>
                </span>
                {selectedSafe !== 'ALL' && (
                  <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-bold border border-indigo-200">
                    مفلتر
                  </span>
                )}
              </label>
              <select
                value={selectedSafe}
                onChange={(e) => setSelectedSafe(e.target.value)}
                className="w-full py-2 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value="ALL">🏦 جميع الخزائن</option>
                {cashBankOptions.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.label}</option>
                ))}
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
                  className="w-full pr-9 pl-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 transition-all"
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
                  className="w-full pr-9 pl-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 transition-all"
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
                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
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
                className="w-full py-2.5 px-3 bg-linear-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Search size={16} className={loading ? 'animate-spin' : ''} />
                <span>{loading ? 'جاري التحليل...' : 'تطبيق الفلاتر'}</span>
              </button>
            </div>
          </div>

        </div>

        {/* شريط الفلاتر النشطة (Active Filter Chips) */}
        {(selectedCategory !== 'ALL' || selectedSource !== 'ALL' || selectedCustomerId !== 'ALL' || selectedInvoiceType !== 'ALL' || selectedClassification !== 'ALL' || selectedServiceType !== 'ALL' || selectedSafe !== 'ALL' || selectedSalesRep !== 'ALL') && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-500 font-bold">الفلاتر النشطة:</span>
              
              {selectedCategory !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-bold border border-amber-200">
                  <Layers size={13} />
                  <span>الفئة: {selectedCategory}</span>
                  <button onClick={() => setSelectedCategory('ALL')} className="mr-1 text-amber-700 hover:text-rose-600 font-bold cursor-pointer">×</button>
                </span>
              )}

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

              {selectedInvoiceType !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                  <Receipt size={13} />
                  <span>النوع: {selectedInvoiceTypeLabel}</span>
                  <button onClick={() => setSelectedInvoiceType('ALL')} className="mr-1 text-emerald-700 hover:text-rose-600 font-bold cursor-pointer">×</button>
                </span>
              )}

              {selectedClassification !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 font-bold border border-purple-200">
                  <Scale size={13} />
                  <span>التصنيف: {selectedClassificationLabel}</span>
                  <button onClick={() => setSelectedClassification('ALL')} className="mr-1 text-purple-700 hover:text-rose-600 font-bold cursor-pointer">×</button>
                </span>
              )}

              {selectedServiceType !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-bold border border-amber-200">
                  <Briefcase size={13} />
                  <span>الخدمة: {selectedServiceTypeLabel}</span>
                  <button onClick={() => setSelectedServiceType('ALL')} className="mr-1 text-amber-700 hover:text-rose-600 font-bold cursor-pointer">×</button>
                </span>
              )}

              {selectedSafe !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 font-bold border border-indigo-200">
                  <Landmark size={13} />
                  <span>الخزينة: {selectedSafeLabel}</span>
                  <button onClick={() => setSelectedSafe('ALL')} className="mr-1 text-indigo-700 hover:text-rose-600 font-bold cursor-pointer">×</button>
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

        {/* Realtime In-table Search */}
        {reportData.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="تصفية سريعة بالاسم أو الكود..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-200"
                />
              </div>

              {/* شريحة فلتر الفئة النشطة */}
              {selectedCategory !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold shadow-2xs">
                  <Layers size={13} className="text-amber-600" />
                  <span>الفئة: <strong>{selectedCategory}</strong></span>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('ALL')}
                    className="mr-1 text-amber-700 hover:text-rose-600 font-black cursor-pointer text-sm"
                    title="إلغاء فلتر الفئة"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <Filter size={14} className="text-amber-600" />
              <span>عدد الأصناف المطابقة: <strong className="text-amber-700 font-mono text-sm">{filteredAndSortedList.length}</strong> من أصل {reportData.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. KPI Summary Cards */}
      {hasSearched && reportData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          
          {/* Card 1: Total Sold Quantity */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 mb-1">إجمالي الكميات المباعة</p>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                  {currentTotalQuantity.toLocaleString('ar-EG')} <span className="text-xs font-normal text-slate-500">قطعة / وحدة</span>
                </h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Package size={24} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-amber-700 font-bold bg-amber-50/70 px-2.5 py-1 rounded-lg">
              <Layers size={13} />
              <span>موزعة على {currentItemsCount} صنف {selectedCategory !== 'ALL' ? `(فئة ${selectedCategory})` : ''}</span>
            </div>
          </div>

          {/* Card 2: Total Sales Revenue */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 mb-1">إجمالي قيمة المبيعات</p>
                <h3 className="text-xl sm:text-2xl font-black text-emerald-600">
                  {currentTotalRevenue.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-slate-500">ر.س</span>
                </h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign size={24} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-700 font-bold bg-emerald-50/70 px-2.5 py-1 rounded-lg">
              <TrendingUp size={13} />
              <span>متوسط بيع الوحدة: {currentAvgPrice.toFixed(2)} ر.س</span>
            </div>
          </div>

          {/* Card 3: Top Selling Item */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 mb-1">الأكثر مبيعاً {selectedCategory !== 'ALL' ? `(${selectedCategory})` : '(رقم 1)'}</p>
                <h3 className="text-base sm:text-lg font-black text-slate-900 truncate" title={currentTopSoldItem?.itemName}>
                  {currentTopSoldItem?.itemName || '-'}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Award size={24} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-blue-700 font-bold bg-blue-50/70 px-2.5 py-1 rounded-lg">
              <span>كمية: {currentTopSoldItem?.totalQuantity.toLocaleString('ar-EG') || 0} ({currentTopSoldItem?.salesPercentage.toFixed(1) || 0}% من المبيعات)</span>
            </div>
          </div>

          {/* Card 4: Catalog Coverage */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 mb-1">الأصناف النشطة المباعة</p>
                <h3 className="text-xl sm:text-2xl font-black text-indigo-600">
                  {currentItemsCount} <span className="text-xs font-normal text-slate-500">صنف متحرك</span>
                </h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <BarChart2 size={24} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-indigo-700 font-bold bg-indigo-50/70 px-2.5 py-1 rounded-lg">
              <span>{selectedCategory !== 'ALL' ? `ضمن فئة ${selectedCategory}` : 'ضمن كافة فئات الأصناف'}</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Main Data Table */}
      <div id="printable-item-sales-report" className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-amber-600" />
            <h2 className="font-bold text-sm sm:text-base text-slate-900">
              جدول حصر مبيعات الأصناف التراكمية
            </h2>
            <span className="text-xs text-slate-400 font-normal">
              (مرتب تنازلياً حسب الأكثر مبيعاً)
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
                <th className="py-3 px-3">كود الصنف</th>
                <th 
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                  onClick={() => toggleSort('name')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>اسم الصنف</span>
                    <ArrowUpDown size={13} className="text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3">التصنيف</th>
                <th 
                  className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none"
                  onClick={() => toggleSort('quantity')}
                >
                  <div className="flex items-center justify-center gap-1.5 text-amber-700">
                    <span>إجمالي الكمية المباعة</span>
                    <ArrowUpDown size={13} className="text-amber-500" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">متوسط سعر البيع</th>
                <th 
                  className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none"
                  onClick={() => toggleSort('revenue')}
                >
                  <div className="flex items-center justify-center gap-1.5 text-emerald-700">
                    <span>القيمة الإجمالية للمبيعات</span>
                    <ArrowUpDown size={13} className="text-emerald-500" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">النسبة من المبيعات</th>
                <th className="py-3 px-3 text-center">عدد العمليات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-bold text-slate-600">جاري تجميع وحساب مبيعات الأصناف...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAndSortedList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package size={36} className="text-slate-300 stroke-1" />
                      <p className="text-xs font-bold text-slate-500">
                        {hasSearched ? 'لا توجد مبيعات للأصناف مسجلة خلال الفترة المحددة' : 'حدد الفترة الزمنية واضغط على "عرض التقرير" لبدء التحليل'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedList.map((row, index) => (
                  <tr key={row.itemId || index} className="hover:bg-amber-50/30 transition-colors">
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
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                      {row.itemCode || '-'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        {row.rank === 1 && <Award size={14} className="text-amber-500 shrink-0" />}
                        <span>{row.itemName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                        {row.category || 'عام'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-black text-amber-700 bg-amber-50/20">
                      {row.totalQuantity.toLocaleString('ar-EG')}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-700">
                      {row.averageUnitPrice.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-black text-emerald-700 bg-emerald-50/20">
                      {row.totalRevenue.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-amber-500 h-1.5 rounded-full" 
                            style={{ width: `${Math.min(row.salesPercentage, 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] font-bold text-slate-600">
                          {row.salesPercentage.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-500 text-[11px]">
                      {row.invoiceCount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Table Footer with Summaries */}
            {filteredAndSortedList.length > 0 && (
              <tfoot className="bg-slate-100 text-slate-900 font-black border-t-2 border-slate-300">
                <tr>
                  <td colSpan={4} className="py-3.5 px-4 text-right">
                    <span className="text-sm font-black text-slate-900">
                      الإجمالي الكلي لجميع الأصناف ({totalItemsCount} صنف)
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-sm text-amber-800 bg-amber-100/50">
                    {grandTotalQuantity.toLocaleString('ar-EG')}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-700">
                    {overallAvgPrice.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-sm text-emerald-800 bg-emerald-100/50">
                    {grandTotalRevenue.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-800">
                    100.0%
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono text-xs text-slate-500">
                    -
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

export default ItemSalesAnalysis;
