import React, { useState } from 'react';
import { 
  TrendingUp, 
  ShieldAlert, 
  DollarSign, 
  Search, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  FileBarChart,
  Gift,
  Users,
  Package,
  UserCheck,
  PieChart,
  Scale
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface ReportsHubScreenProps {
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

export const ReportsHubScreen: React.FC<ReportsHubScreenProps> = ({ onNavigate }) => {
  const { language, isRtl } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');

  const reportList: ReportCard[] = [
    {
      id: 'account-movements',
      titleAr: 'حركة الحسابات التفصيلية',
      titleEn: 'Account Movements & General Ledger',
      descAr: 'كشف حركة الحسابات بالجدول الثلاثي (مدين - دائن - بيان الحركة)، مع محدد تواريخ وخانة بحث شاملة لكافة الأطراف والحسابات وحساب الرصيد الصافي.',
      descEn: 'Three-column account ledger (Debit - Credit - Description) with universal search and net balance computation.',
      route: '/accounting/account-movements',
      viewKey: 'accountMovements',
      icon: Scale,
      badgeAr: 'محاسبة وأستاذ عام',
      badgeEn: 'Accounting & Ledger',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      accentColor: 'from-indigo-600 to-purple-700',
      statsLabelAr: 'كشف حركات الحساب والرصيد',
      statsLabelEn: 'Account Movements & Balance'
    },
    {
      id: 'total-sales',
      titleAr: 'إجمالي فواتير المبيعات',
      titleEn: 'Total Sales Invoices',
      descAr: 'عرض وتجميع وتحليل فواتير المبيعات الصادرة خلال أي فترة زمنية محددة مع حساب إجماليات المبيعات والضرائب.',
      descEn: 'Aggregate and analyze all issued sales invoices within a selected time frame with gross totals and taxes.',
      route: '/reports/sales/total-invoices',
      viewKey: 'totalSalesInvoices',
      icon: DollarSign,
      badgeAr: 'فواتير ومبيعات',
      badgeEn: 'Sales Invoices',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      accentColor: 'from-blue-600 to-indigo-700',
      statsLabelAr: 'تجميع المبيعات بالفترة',
      statsLabelEn: 'Periodic Sales Summary'
    },
    {
      id: 'item-sales-analysis',
      titleAr: 'تحليل مبيعات الأصناف (الأكثر مبيعاً)',
      titleEn: 'Item Sales & Best Sellers Analysis',
      descAr: 'حصر تراكمي لجميع الأصناف المباعة وتجميع الكميات المشتراة والمبالغ المحققة لفرز الأصناف الأكثر مبيعاً ورواجاً.',
      descEn: 'Cumulative summary of all sold items grouping total units and revenue to rank top best-selling products.',
      route: '/reports/sales/items-summary',
      viewKey: 'itemSalesAnalysis',
      icon: Package,
      badgeAr: 'حركة الأصناف',
      badgeEn: 'Item Analytics',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      accentColor: 'from-amber-600 to-orange-700',
      statsLabelAr: 'حصر الكميات الأكثر مبيعاً',
      statsLabelEn: 'Best Sellers Ranking'
    },
    {
      id: 'daily-item-profits',
      titleAr: 'أرباح الأصناف اليومية والتفصيلية',
      titleEn: 'Daily Item Profits Analysis',
      descAr: 'تحليل دقيق لتكلفة ومبيعات وهوامش أرباح الأصناف المباعة مع حساب صافي الربح ونسبة الهامش % لكل حركة بيع.',
      descEn: 'In-depth profit analysis per sold item comparing selling price vs cost with net margin % per transaction.',
      route: '/reports/profitability/daily-item-profits',
      viewKey: 'dailyItemProfits',
      icon: TrendingUp,
      badgeAr: 'أرباح +ROI',
      badgeEn: 'Profits +ROI',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      accentColor: 'from-emerald-600 to-teal-700',
      statsLabelAr: 'تحليل هوامش الربحية',
      statsLabelEn: 'Profit Margin Analysis'
    },
    {
      id: 'below-cost-sales',
      titleAr: 'تحليلي أصناف بيع بأقل من التكلفة',
      titleEn: 'Sales Below Cost Analysis',
      descAr: 'تقرير رقابي لكشف أخطاء التسعير والخصومات الزائدة التي أدت لبيع أصناف بسعر أقل من تكلفة الشراء المعتمدة.',
      descEn: 'Supervisory report to detect pricing errors and excessive discounts below item purchase cost.',
      route: '/reports/profitability/below-cost',
      viewKey: 'belowCostSales',
      icon: ShieldAlert,
      badgeAr: 'رقابي وتدقيق',
      badgeEn: 'Supervisory & Audit',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
      accentColor: 'from-rose-600 to-red-700',
      statsLabelAr: 'كشف المبيعات الخاسرة',
      statsLabelEn: 'Loss Detection Audit'
    },
    {
      id: 'bonuses-samples',
      titleAr: 'البوانص والعينات المجانية والهدايا',
      titleEn: 'Bonuses, Samples & Free Gifts',
      descAr: 'حصر شامل لكافة الأصناف المنصرفة مجاناً للعملاء (سعر البيع = 0) واحتساب تكلفتها الترويجية والتسويقية على المنشأة.',
      descEn: 'Comprehensive audit of all items dispensed for free (price = 0) with calculated marketing & promotional cost.',
      route: '/reports/profitability/bonuses',
      viewKey: 'bonusesAndSamples',
      icon: Gift,
      badgeAr: 'هدايا وبونص',
      badgeEn: 'Free Gifts',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      accentColor: 'from-purple-600 to-indigo-700',
      statsLabelAr: 'حصر الإنفاق الترويجي',
      statsLabelEn: 'Promotional Cost Audit'
    },
    {
      id: 'customer-sales-summary',
      titleAr: 'إجمالي مبيعات ومسحوبات العملاء',
      titleEn: 'Customer Sales Summary',
      descAr: 'قائمة مجمعة لكل عميل توضح عدد فواتيره وإجمالي مسحوباته مرتبة تنازلياً حسب حجم المبيعات.',
      descEn: 'Consolidated summary per customer showing total invoice count and purchase volume sorted descending.',
      route: '/reports/sales/customers-summary',
      viewKey: 'customerSalesSummary',
      icon: Users,
      badgeAr: 'تحليل عملاء',
      badgeEn: 'Customer KPI',
      badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      accentColor: 'from-cyan-600 to-blue-700',
      statsLabelAr: 'تجميع مسحوبات العملاء',
      statsLabelEn: 'Customer Aggregation'
    },
    {
      id: 'technician-sales',
      titleAr: 'تقرير مبيعات الفنيين ومندوبي المبيعات',
      titleEn: 'Technicians & Sales Reps Performance',
      descAr: 'عرض تفصيلي وتجميعي لمبيعات كل فني أو مندوب مبيعات خلال الفترة مع احتساب عدد العمليات والعمولات التقديرية.',
      descEn: 'Consolidated summary of sales volume per technician or sales representative to evaluate performance and commissions.',
      route: '/reports/sales/technicians',
      viewKey: 'technicianSales',
      icon: UserCheck,
      badgeAr: 'فنيين ومندوبين',
      badgeEn: 'Technicians KPI',
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
      accentColor: 'from-teal-600 to-cyan-700',
      statsLabelAr: 'مبيعات وعمولات الفنيين',
      statsLabelEn: 'Technicians Commission'
    },
    {
      id: 'sales-profitability-summary',
      titleAr: 'تحليل ربحية المبيعات الشامل (هوامش الأرباح)',
      titleEn: 'Comprehensive Sales Profitability Summary',
      descAr: 'تحليل مالي مجمع لربحية المؤسسة مفرزاً حسب العميل، الفئة الرئيسية، واسم الصنف مع احتساب التكاليف وصافي الربح ونسبة الهامش.',
      descEn: 'Comprehensive multi-dimensional profitability analysis grouped by Customer, Category and Product with net profit margins.',
      route: '/reports/profitability/margins',
      viewKey: 'salesProfitabilitySummary',
      icon: PieChart,
      badgeAr: 'أرباح وهامش',
      badgeEn: 'Profitability & Margins',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      accentColor: 'from-emerald-600 to-teal-800',
      statsLabelAr: 'تحليل هوامش الربحية الشاملة',
      statsLabelEn: 'Consolidated Margins Analysis'
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
      <div className="mb-8 bg-linear-to-l from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold mb-3">
              <Sparkles size={14} />
              <span>{language === 'ar' ? 'العملاء والمبيعات والتقسيط' : 'Customers, Sales & Installments'}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <FileBarChart size={34} className="text-indigo-400" />
              <span>{language === 'ar' ? 'مركز تقارير المبيعات' : 'Sales Reports Hub'}</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300 mt-2 max-w-2xl leading-relaxed">
              {language === 'ar' 
                ? 'لوحة موحدة وشاملة للوصول إلى كافة تقارير المبيعات، تحليل أرباح الأصناف اليومية، والرقابة على المبيعات الخاسرة بأقل من التكلفة.'
                : 'Centralized hub to access all sales reports, daily item profitability analysis, and supervisory below-cost audit.'}
            </p>
          </div>

          {/* Search Box */}
          <div className="w-full md:w-80">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={language === 'ar' ? 'ابحث في تقارير المبيعات...' : 'Search sales reports...'}
                className="w-full bg-white/10 hover:bg-white/15 focus:bg-white text-white focus:text-slate-900 placeholder:text-slate-400 border border-white/20 focus:border-white rounded-2xl py-3 pl-4 pr-11 text-sm font-semibold outline-none transition shadow-inner"
              />
              <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Reports Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        {filteredReports.map((report) => {
          const Icon = report.icon;
          const title = language === 'ar' ? report.titleAr : report.titleEn;
          const desc = language === 'ar' ? report.descAr : report.descEn;
          const badge = language === 'ar' ? report.badgeAr : report.badgeEn;
          const statsLabel = language === 'ar' ? report.statsLabelAr : report.statsLabelEn;

          return (
            <div
              key={report.id}
              onClick={() => handleOpenReport(report)}
              className="group bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 hover:border-indigo-400/80 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-200 flex flex-col justify-between cursor-pointer relative overflow-hidden"
            >
              {/* Top Accent Strip */}
              <div className={`absolute top-0 left-0 right-0 h-2 bg-linear-to-r ${report.accentColor}`} />

              <div>
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div className={`w-14 h-14 rounded-2xl bg-linear-to-br ${report.accentColor} text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform`}>
                    <Icon size={26} />
                  </div>

                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${report.badgeColor}`}>
                    {badge}
                  </span>
                </div>

                <h3 className="text-xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors leading-snug mb-3">
                  {title}
                </h3>

                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                  {desc}
                </p>
              </div>

              <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between text-indigo-600 font-bold text-sm group-hover:text-indigo-700">
                <span className="text-xs text-slate-400 font-medium group-hover:text-slate-600">
                  {statsLabel}
                </span>
                <div className="flex items-center gap-1 text-xs font-bold bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white px-3 py-1.5 rounded-xl transition-colors">
                  <span>{language === 'ar' ? 'استعراض التقرير' : 'Open'}</span>
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

export default ReportsHubScreen;
