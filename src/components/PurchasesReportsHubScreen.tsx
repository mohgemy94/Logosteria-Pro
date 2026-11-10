import React, { useState } from 'react';
import { 
  Search, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Truck,
  Layers,
  FolderTree,
  Warehouse,
  PackageSearch,
  Gift,
  ScrollText,
  Scale
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface PurchasesReportsHubScreenProps {
  onNavigate?: (view: string | null) => void;
}

interface ReportCard {
  id: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  route: string;
  viewKey: string;
  icon: React.ElementType;
  badgeAr: string;
  badgeEn: string;
  badgeColor: string;
  accentColor: string;
  statsLabelAr: string;
  statsLabelEn: string;
}

export const PurchasesReportsHubScreen: React.FC<PurchasesReportsHubScreenProps> = ({ onNavigate }) => {
  const { language, isRtl } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');

  const reportList: ReportCard[] = [
    {
      id: 'account-movements-purchases',
      titleAr: 'حركة حسابات الموردين والأستاذ',
      titleEn: 'Supplier Movements & General Ledger',
      descAr: 'كشف حركة الحسابات بالجدول الثلاثي (مدين - دائن - بيان الحركة)، مع بحث شامل في حسابات الموردين والخزن والمشتريات وحساب الرصيد الصافي.',
      descEn: 'Consolidated three-column ledger for suppliers, purchases, and payments with net balance calculation.',
      route: '/accounting/account-movements',
      viewKey: 'accountMovements',
      icon: Scale,
      badgeAr: 'حركة الحسابات',
      badgeEn: 'Account Movements',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      accentColor: 'from-indigo-600 to-purple-700',
      statsLabelAr: 'كشف حركات المورد والرصيد',
      statsLabelEn: 'Vendor Ledger & Balance'
    },
    {
      id: 'total-purchases',
      titleAr: 'إجمالي فواتير المشتريات',
      titleEn: 'Total Purchase Invoices',
      descAr: 'عرض وتجميع وتحليل فواتير المشتريات الواردة من الموردين خلال أي فترة زمنية محددة مع إجمالي المبالغ والحالات.',
      descEn: 'Aggregate and analyze all incoming supplier purchase invoices within a selected time frame with gross totals.',
      route: '/reports/purchases/total-invoices',
      viewKey: 'totalPurchaseInvoices',
      icon: DollarSign,
      badgeAr: 'فواتير وموردين',
      badgeEn: 'Purchases & Vendors',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      accentColor: 'from-emerald-600 to-teal-700',
      statsLabelAr: 'تجميع المشتريات بالفترة',
      statsLabelEn: 'Periodic Purchases Summary'
    },
    {
      id: 'supplier-purchases-summary',
      titleAr: 'إجمالي مشتريات ومسحوبات الموردين',
      titleEn: 'Supplier Purchases Summary',
      descAr: 'قائمة مجمعة لكل مورد توضح عدد فواتير الشراء وإجمالي مسحوباتنا منه مرتبة تنازلياً حسب حجم التوريدات.',
      descEn: 'Consolidated summary per vendor showing total invoice count and purchase volume sorted descending.',
      route: '/reports/purchases/suppliers-summary',
      viewKey: 'supplierPurchasesSummary',
      icon: Truck,
      badgeAr: 'تحليل موردين',
      badgeEn: 'Vendor KPI',
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
      accentColor: 'from-teal-600 to-emerald-700',
      statsLabelAr: 'تجميع مسحوبات الموردين',
      statsLabelEn: 'Vendor Aggregation'
    },
    {
      id: 'main-category-purchases',
      titleAr: 'مشتريات الفئات الرئيسية',
      titleEn: 'Main Category Purchases',
      descAr: 'حصر وتجميع فواتير المشتريات بناءً على التصنيف (الفئة الرئيسية) للأصناف لمعرفة حجم الإنفاق والكميات.',
      descEn: 'Aggregate purchase spending and quantities grouped by main product category to evaluate inventory procurement distribution.',
      route: '/reports/purchases/categories-summary',
      viewKey: 'mainCategoryPurchases',
      icon: Layers,
      badgeAr: 'تصنيفات وفئات',
      badgeEn: 'Category Procurement',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      accentColor: 'from-indigo-600 to-blue-700',
      statsLabelAr: 'تجميع المشتريات بالفئة',
      statsLabelEn: 'Category Aggregation'
    },
    {
      id: 'sub-category-item-purchases',
      titleAr: 'مشتريات الفئات الفرعية والأصناف',
      titleEn: 'Subcategory & Item Purchases',
      descAr: 'حصر وتجميع كميات وتكلفة كل صنف تم شراؤه داخل فئته الفرعية خلال فترة محددة.',
      descEn: 'Consolidated purchase report grouped by subcategory and item name with total quantities and costs.',
      route: '/reports/purchases/sub-categories',
      viewKey: 'subCategoryItemPurchases',
      icon: FolderTree,
      badgeAr: 'فئات فرعية وأصناف',
      badgeEn: 'Subcategories & Items',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      accentColor: 'from-amber-600 to-teal-700',
      statsLabelAr: 'تجميع الأصناف بالفئة الفرعية',
      statsLabelEn: 'Subcategory Item Breakdown'
    },
    {
      id: 'inventory-purchases-analysis',
      titleAr: 'تحليل المخزون وحركة المشتريات',
      titleEn: 'Inventory & Purchases Analysis',
      descAr: 'عرض رصيد أول المدة لكل صنف مضافاً إليه الكميات المشتراة خلال الفترة لمعرفة إجمالي حركة الوارد والتكلفة.',
      descEn: 'Track opening inventory stock combined with period purchases to determine total inbound quantities and cost.',
      route: '/reports/purchases/inventory-analysis',
      viewKey: 'inventoryAndPurchasesAnalysis',
      icon: Warehouse,
      badgeAr: 'مخزون وواردات',
      badgeEn: 'Inventory & Inbound',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      accentColor: 'from-blue-600 to-teal-700',
      statsLabelAr: 'حصر رصيد أول المدة والوارد',
      statsLabelEn: 'Opening Stock & Inbound'
    },
    {
      id: 'single-item-purchase-analysis',
      titleAr: 'تحليل حركة شراء صنف محدد',
      titleEn: 'Single Item Purchase Analysis',
      descAr: 'تتبع حركة الشراء التفصيلية وتغير أسعار التكلفة لصنف محدد، من رصيد أول المدة وحتى آخر فاتورة شراء.',
      descEn: 'Detailed purchase movement and cost fluctuations tracking for a single item, starting from opening inventory to the latest invoice.',
      route: '/reports/purchases/single-item-analysis',
      viewKey: 'singleItemPurchaseAnalysis',
      icon: PackageSearch,
      badgeAr: 'حركة صنف وتكلفة',
      badgeEn: 'Item & Cost History',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      accentColor: 'from-indigo-600 to-cyan-700',
      statsLabelAr: 'تتبع حركة الصنف وتغير الأسعار',
      statsLabelEn: 'Item Movement & Price History'
    },
    {
      id: 'supplier-bonuses-summary',
      titleAr: 'ملخص بوانص وهدايا الموردين',
      titleEn: 'Supplier Bonuses & Samples Summary',
      descAr: 'حصر وتجميع الأصناف والكميات المجانية (هدايا، عينات، بوانص) المستلمة من الموردين وحساب قيمة التوفير التقديرية.',
      descEn: 'Consolidated report of complimentary bonus items, samples, and gifts received from vendors with total quantity and cost savings value.',
      route: '/reports/purchases/supplier-bonuses',
      viewKey: 'supplierBonusesSummary',
      icon: Gift,
      badgeAr: 'بوانص وتوفير',
      badgeEn: 'Bonuses & Savings',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      accentColor: 'from-amber-600 to-emerald-700',
      statsLabelAr: 'حصر البوانص وحساب قيمة التوفير',
      statsLabelEn: 'Vendor Bonuses & Free Items'
    },
    {
      id: 'detailed-supplier-bonuses',
      titleAr: 'سجل بوانص وهدايا الموردين التفصيلي',
      titleEn: 'Detailed Supplier Bonuses Audit Trail',
      descAr: 'عرض سجل تفصيلي وتدقيقي (Audit Trail) لكافة البوانص والهدايا والعينات المجانية مع تواريخ وأرقام الفواتير والتكلفة.',
      descEn: 'Audit trail of every free bonus item, gift, and sample received from vendors with invoice numbers, dates, suppliers, and base costs.',
      route: '/reports/purchases/detailed-supplier-bonuses',
      viewKey: 'detailedSupplierBonuses',
      icon: ScrollText,
      badgeAr: 'سجل تدقيق تفصيلي',
      badgeEn: 'Audit Trail',
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
      accentColor: 'from-teal-600 to-emerald-700',
      statsLabelAr: 'سجل تدقيق البوانص حسب الفواتير',
      statsLabelEn: 'Detailed Bonus Lines by Invoice'
    }
  ];

  const filteredReports = reportList.filter(report => {
    const title = language === 'ar' ? report.titleAr : report.titleEn;
    const desc = language === 'ar' ? report.descAr : report.descEn;
    return !searchTerm || 
      title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      desc.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleOpenReport = (report: ReportCard) => {
    if (onNavigate) {
      onNavigate(report.viewKey);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-slate-50 min-h-screen rtl" dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* Header Banner */}
      <div className="mb-8 bg-linear-to-l from-slate-900 via-emerald-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold mb-3">
              <Sparkles size={14} />
              <span>{language === 'ar' ? 'الموردون والمشتريات' : 'Suppliers & Purchases'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white mb-2">
              {language === 'ar' ? 'مركز تقارير المشتريات' : 'Purchases Reports Hub'}
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              {language === 'ar' 
                ? 'المنصة المركزية الشاملة لتقارير المشتريات وفواتير الموردين ومتابعة التكاليف والتوريدات بدقة.'
                : 'Centralized analytics and reporting hub for supplier purchase invoices, cost analysis, and procurement operations.'}
            </p>
          </div>

          {/* Quick Search */}
          <div className="w-full md:w-72 relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder={language === 'ar' ? 'البحث عن تقرير مشتريات...' : 'Search purchase reports...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent backdrop-blur-md shadow-inner transition-all"
            />
          </div>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredReports.map((report) => {
          const Icon = report.icon;
          return (
            <div 
              key={report.id}
              onClick={() => handleOpenReport(report)}
              className="group bg-white rounded-3xl p-6 border border-slate-200/80 hover:border-emerald-300 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer relative overflow-hidden hover:-translate-y-1"
            >
              {/* Top Accent Gradient Bar */}
              <div className={`absolute top-0 right-0 left-0 h-1.5 bg-linear-to-r ${report.accentColor}`} />

              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className={`w-14 h-14 rounded-2xl bg-linear-to-br ${report.accentColor} text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300`}>
                    <Icon size={26} />
                  </div>
                  <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${report.badgeColor}`}>
                    {language === 'ar' ? report.badgeAr : report.badgeEn}
                  </span>
                </div>

                <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-700 transition-colors mb-2">
                  {language === 'ar' ? report.titleAr : report.titleEn}
                </h3>

                <p className="text-xs sm:text-sm text-slate-500 line-clamp-3 leading-relaxed mb-6 font-medium">
                  {language === 'ar' ? report.descAr : report.descEn}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">
                  {language === 'ar' ? report.statsLabelAr : report.statsLabelEn}
                </span>

                <div className="flex items-center gap-1 text-xs font-black text-emerald-700 group-hover:gap-2 transition-all">
                  <span>{language === 'ar' ? 'عرض التقرير' : 'Open Report'}</span>
                  {isRtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default PurchasesReportsHubScreen;
