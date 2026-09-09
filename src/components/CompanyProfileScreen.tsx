import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  FileText, 
  Calendar, 
  Edit3, 
  QrCode,
  ShieldCheck,
  Award,
  LayoutDashboard
} from 'lucide-react';
import { SystemSettings } from '../types/accounting';
import { useLanguage } from '../i18n/LanguageContext';

interface CompanyProfileScreenProps {
  systemSettings: SystemSettings;
  onNavigateToSettings: () => void;
  onNavigateToDashboard: () => void;
}

export default function CompanyProfileScreen({
  systemSettings,
  onNavigateToSettings,
  onNavigateToDashboard,
}: CompanyProfileScreenProps) {
  const { company, financial } = systemSettings;
  const { language, dir } = useLanguage();

  return (
    <div className="w-full flex flex-col gap-6 print:p-0" dir={dir}>
      {/* Grand Hero Header with Authentic Arabic Diwani Calligraphy */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-bl from-slate-900 via-slate-800 to-blue-950 text-white shadow-xl border border-slate-700/60 p-6 sm:p-10">
        {/* Elegant Arabesque Geometry Background Overlay */}
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:20px_20px]" />
        
        {/* Decorative corner accent motifs */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-6 text-center md:text-start">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Emblem / Monogram Frame */}
            <div className="relative group shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-linear-to-tr from-amber-600 via-amber-500 to-amber-300 p-0.5 shadow-lg shadow-amber-900/30">
                <div className="w-full h-full rounded-[14px] bg-slate-900 flex flex-col items-center justify-center p-2 text-center border border-amber-400/30">
                  {company.logoUrl ? (
                    <img 
                      src={company.logoUrl} 
                      alt={company.nameAr} 
                      className="max-h-full max-w-full object-contain rounded"
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <>
                      <span className="font-diwani text-2xl sm:text-3xl text-amber-300 font-bold tracking-normal leading-none select-none">
                        {language === 'ar' ? 'لوجوستريا' : 'LOGUSTRIA'}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono tracking-widest mt-1 uppercase">
                        EST. {financial.fiscalYear || '2024'}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="absolute -bottom-2 -left-2 bg-emerald-600 text-white rounded-full p-1 border-2 border-slate-900 shadow-xs" title="منشأة معتمدة ونشطة">
                <ShieldCheck size={14} />
              </div>
            </div>

            {/* Typography Section with Arabic Diwani Display */}
            <div className="flex flex-col">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 mb-2">
                <span className="px-3 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/15 text-amber-300 border border-amber-400/30">
                  {company.branchName || (language === 'ar' ? 'الفرع الرئيسي' : 'Main Branch')}
                </span>
                <span className="px-3 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {language === 'ar' ? `السنة المالية: ${financial.fiscalYear}` : `Fiscal Year: ${financial.fiscalYear}`}
                </span>
              </div>

              {/* Company Arabic Name in Artistic Diwani Script */}
              <h1 
                className="font-diwani text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-amber-200 drop-shadow-[0_2px_10px_rgba(251,191,36,0.25)] leading-tight tracking-wide py-1"
                style={{ 
                  fontFamily: language === 'ar' ? "'Aref Ruqaa', 'Amiri', serif" : "'Plus Jakarta Sans', sans-serif",
                  lineHeight: '1.25' 
                }}
              >
                {language === 'ar' 
                  ? (company.nameAr || 'شركة لوجوستريا للمحاسبة والحلول المالية')
                  : (company.nameEn || 'Logustria Financial & ERP Solutions Co.')}
              </h1>

              {/* Secondary English Name */}
              {(language === 'ar' ? company.nameEn : company.nameAr) && (
                <p className="text-sm sm:text-base text-slate-300 font-medium tracking-wide mt-1">
                  {language === 'ar' ? company.nameEn : company.nameAr}
                </p>
              )}

              {/* Summary line */}
              <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
                {language === 'ar'
                  ? 'منظومة الأعمال والعمليات المالية المعتمدة، إدارة السجلات والقيود المحاسبية، فواتير المبيعات والمشتريات، والمستودعات.'
                  : 'Enterprise accounting platform with double-entry ledger, multi-module invoicing, inventory management, and BOM operations.'}
              </p>
            </div>
          </div>

          {/* Quick Actions (Modify in settings & Switch to Dashboard) */}
          <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-stretch gap-2.5 shrink-0 print:hidden mt-2 md:mt-0">
            <button
              type="button"
              onClick={onNavigateToDashboard}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md hover:shadow-blue-500/25"
            >
              <LayoutDashboard size={15} />
              <span>{language === 'ar' ? 'لوحة المؤشرات والرسوم البيانية' : 'Financial Dashboard & Analytics'}</span>
            </button>
            <button
              type="button"
              onClick={onNavigateToSettings}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold backdrop-blur-md transition-all cursor-pointer shadow-sm hover:border-amber-300/50 hover:text-amber-200"
            >
              <Edit3 size={15} />
              <span>{language === 'ar' ? 'تعديل بيانات المنشأة' : 'Edit Company Profile'}</span>
            </button>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-700/50">
              <Award size={13} className="text-amber-400" />
              <span>{language === 'ar' ? 'نظام القيد المزدوج المعتمد' : 'Double-Entry ERP Standard'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Structured Company Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Official & Legal Data */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center gap-3 pb-3 mb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">البيانات النظامية والضريبية</h3>
                <p className="text-[11px] text-slate-400">التراخيص والسجلات المعتمدة</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-500 font-medium">الرقم الضريبي (VAT):</span>
                <span className="font-mono font-bold text-slate-800 tracking-wider">
                  {company.taxNumber || 'غير مسجل'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-500 font-medium">السجل التجاري (CR):</span>
                <span className="font-mono font-bold text-slate-800 tracking-wider">
                  {company.commercialRegister || 'غير مسجل'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-500 font-medium">العملة المعتمدة:</span>
                <span className="font-bold text-slate-800">
                  {financial.currency} ({financial.currencySymbol})
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-500 font-medium">حالة السنة المالية:</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                  financial.isFiscalYearClosed 
                    ? 'bg-rose-100 text-rose-700' 
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {financial.isFiscalYearClosed ? 'مغلقة' : 'مفتوحة للعمليات'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar size={13} />
              <span>فترة السنة: {financial.fiscalYearStart} إلى {financial.fiscalYearEnd}</span>
            </span>
          </div>
        </div>

        {/* Card 2: Contact & Communication Information */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center gap-3 pb-3 mb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Phone size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">بيانات الاتصال والتواصل</h3>
                <p className="text-[11px] text-slate-400">قنوات التواصل والخدمة للعملاء والموردين</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="flex items-center gap-2 text-slate-500 font-medium">
                  <Phone size={14} className="text-slate-400" />
                  <span>الهاتف الموحد:</span>
                </span>
                <a 
                  href={`tel:${company.phone}`} 
                  className="font-mono font-bold text-blue-600 hover:underline dir-ltr"
                >
                  {company.phone || '—'}
                </a>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="flex items-center gap-2 text-slate-500 font-medium">
                  <Mail size={14} className="text-slate-400" />
                  <span>البريد الإلكتروني:</span>
                </span>
                <a 
                  href={`mailto:${company.email}`} 
                  className="font-mono font-bold text-blue-600 hover:underline truncate max-w-[180px]" 
                  title={company.email}
                >
                  {company.email || '—'}
                </a>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="flex items-center gap-2 text-slate-500 font-medium">
                  <Globe size={14} className="text-slate-400" />
                  <span>الموقع الإلكتروني:</span>
                </span>
                {company.website ? (
                  <a 
                    href={company.website} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="font-mono font-bold text-blue-600 hover:underline truncate max-w-[180px]"
                  >
                    {company.website.replace(/^https?:\/\//, '')}
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="flex items-center gap-2 text-slate-500 font-medium">
                  <Building2 size={14} className="text-slate-400" />
                  <span>الفرع النشط:</span>
                </span>
                <span className="font-bold text-slate-800 truncate max-w-[180px]">
                  {company.branchName || 'الفرع الرئيسي'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>خدمة العملاء والاتصالات متاحة خلال أوقات العمل الرسمية</span>
          </div>
        </div>

        {/* Card 3: Address & Headquarters Location */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center gap-3 pb-3 mb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <MapPin size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">العنوان والمقر الرئيسي</h3>
                <p className="text-[11px] text-slate-400">بيانات العنوان الوطني والمستودع</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="text-slate-500 font-medium mb-1">الشارع والحي:</div>
                <div className="font-bold text-slate-800 text-sm">
                  {company.address || 'طريق الملك فهد، حي الصحافة'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-medium block text-[11px]">المدينة:</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {company.city || 'الرياض'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-medium block text-[11px]">الرمز البريدي:</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {company.postalCode || '13315'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                  <QrCode size={14} className="text-slate-400" />
                  <span>رمز التحقق الضريبي:</span>
                </span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  مفعل (ZATCA QR)
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>العنوان الوطني المسجل</span>
            <span className="text-slate-500 font-mono">KSA</span>
          </div>
        </div>
      </div>
    </div>
  );
}
