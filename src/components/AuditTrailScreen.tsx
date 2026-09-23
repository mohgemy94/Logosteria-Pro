import { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  Download, 
  RotateCcw, 
  Calendar, 
  User, 
  Layers, 
  Activity, 
  FileText, 
  PlusCircle, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Settings, 
  Clock, 
  Eye, 
  X,
  Lock,
  Printer,
  FileSpreadsheet
} from 'lucide-react';
import { 
  loadAuditLogs, 
  filterAuditLogs, 
  exportAuditLogsToCSV, 
  clearAuditLogs,
  AUDIT_LOG_EVENT 
} from '../utils/auditLogStore';
import { AuditLogEntry, AuditAction, AuditModule, AuditSeverity } from '../types/auditLog';
import { useLanguage } from '../i18n/LanguageContext';
import { getSystemSettings } from '../utils/settings';

interface AuditTrailScreenProps {
  onNavigate?: (view: string) => void;
}

export default function AuditTrailScreen({ onNavigate }: AuditTrailScreenProps) {
  const { language, isRtl, t } = useLanguage();
  const [logs, setLogs] = useState<AuditLogEntry[]>(() => loadAuditLogs());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<AuditAction | 'ALL'>('ALL');
  const [selectedModule, setSelectedModule] = useState<AuditModule | 'ALL'>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<AuditSeverity | 'ALL'>('ALL');
  const [selectedUserId, setSelectedUserId] = useState<string | 'ALL'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLogForDetails, setSelectedLogForDetails] = useState<AuditLogEntry | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const systemSettings = useMemo(() => getSystemSettings(), []);

  // Reload on events
  useEffect(() => {
    const handleUpdate = () => {
      setLogs(loadAuditLogs());
    };
    window.addEventListener(AUDIT_LOG_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(AUDIT_LOG_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Filtered entries
  const filteredLogs = useMemo(() => {
    return filterAuditLogs(logs, {
      searchQuery,
      action: selectedAction,
      module: selectedModule,
      severity: selectedSeverity,
      userId: selectedUserId,
      startDate,
      endDate
    });
  }, [logs, searchQuery, selectedAction, selectedModule, selectedSeverity, selectedUserId, startDate, endDate]);

  // Statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const creates = logs.filter(l => l.action === 'CREATE' || l.action === 'POST').length;
    const updates = logs.filter(l => l.action === 'UPDATE' || l.action === 'SETTINGS_CHANGE').length;
    const deletes = logs.filter(l => l.action === 'DELETE' || l.action === 'SYSTEM_RESET').length;
    const critical = logs.filter(l => l.severity === 'CRITICAL' || l.severity === 'DANGER').length;
    return { total, creates, updates, deletes, critical };
  }, [logs]);

  // Unique users list for filtering
  const availableUsers = useMemo(() => {
    const userMap = new Map<string, string>();
    logs.forEach(l => {
      if (l.user?.id) {
        userMap.set(l.user.id, l.user.displayName || l.user.username);
      }
    });
    return Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));
  }, [logs]);

  const getActionBadge = (action: AuditAction) => {
    switch (action) {
      case 'CREATE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-700 border border-emerald-300">
            <PlusCircle size={12} />
            <span>{language === 'ar' ? 'إنشاء جديد' : 'Created'}</span>
          </span>
        );
      case 'UPDATE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-500/15 text-amber-700 border border-amber-300">
            <Edit3 size={12} />
            <span>{language === 'ar' ? 'تعديل' : 'Updated'}</span>
          </span>
        );
      case 'DELETE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-rose-500/15 text-rose-700 border border-rose-300">
            <Trash2 size={12} />
            <span>{language === 'ar' ? 'حذف' : 'Deleted'}</span>
          </span>
        );
      case 'POST':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-blue-500/15 text-blue-700 border border-blue-300">
            <CheckCircle2 size={12} />
            <span>{language === 'ar' ? 'ترحيل مالي' : 'Posted'}</span>
          </span>
        );
      case 'APPROVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-teal-500/15 text-teal-700 border border-teal-300">
            <CheckCircle2 size={12} />
            <span>{language === 'ar' ? 'اعتماد رسمي' : 'Approved'}</span>
          </span>
        );
      case 'SETTINGS_CHANGE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-purple-500/15 text-purple-700 border border-purple-300">
            <Settings size={12} />
            <span>{language === 'ar' ? 'تعديل إعدادات' : 'Config Change'}</span>
          </span>
        );
      case 'SYSTEM_RESET':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-red-600 text-white shadow-xs">
            <AlertTriangle size={12} />
            <span>{language === 'ar' ? 'تصفير نظام' : 'System Reset'}</span>
          </span>
        );
      case 'PRINT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <Printer size={12} />
            <span>{language === 'ar' ? 'طباعة' : 'Printed'}</span>
          </span>
        );
      case 'EXPORT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-500/15 text-indigo-700 border border-indigo-300">
            <FileSpreadsheet size={12} />
            <span>{language === 'ar' ? 'تصدير بيانات' : 'Exported'}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-slate-200 text-slate-700">
            <Activity size={12} />
            <span>{action}</span>
          </span>
        );
    }
  };

  const getModuleBadge = (module: AuditModule) => {
    const map: Record<AuditModule, { nameAr: string; nameEn: string; color: string }> = {
      SALES: { nameAr: 'المبيعات والعملاء', nameEn: 'Sales & POS', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
      PURCHASES: { nameAr: 'المشتريات والموردين', nameEn: 'Purchases & AP', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
      TREASURY: { nameAr: 'الخزينة والبنوك', nameEn: 'Treasury & Cash', color: 'bg-amber-50 text-amber-800 border-amber-200' },
      JOURNAL: { nameAr: 'القيود والحسابات العامة', nameEn: 'General Ledger', color: 'bg-blue-50 text-blue-800 border-blue-200' },
      ITEMS: { nameAr: 'المخزون والأصناف', nameEn: 'Items Catalog', color: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
      INVENTORY_COUNT: { nameAr: 'الجرد والتسويات', nameEn: 'Stock Count', color: 'bg-teal-50 text-teal-800 border-teal-200' },
      PAYROLL: { nameAr: 'الرواتب والموظفين', nameEn: 'Payroll & HR', color: 'bg-violet-50 text-violet-800 border-violet-200' },
      MANUFACTURING: { nameAr: 'التصنيع والتكاليف', nameEn: 'Manufacturing', color: 'bg-orange-50 text-orange-800 border-orange-200' },
      INSTALLMENTS: { nameAr: 'التقسيط والكمبيالات', nameEn: 'Installments', color: 'bg-sky-50 text-sky-800 border-sky-200' },
      CUSTOMERS: { nameAr: 'العملاء والمدينون', nameEn: 'Customers', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
      VENDORS: { nameAr: 'الموردون والدائنون', nameEn: 'Vendors', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
      SETTINGS: { nameAr: 'إعدادات النظام', nameEn: 'System Settings', color: 'bg-slate-100 text-slate-800 border-slate-300' },
      YEAR_END: { nameAr: 'الإقفال السنوي', nameEn: 'Year-End Closing', color: 'bg-rose-50 text-rose-800 border-rose-200' },
      SYSTEM: { nameAr: 'عمليات النظام المركزية', nameEn: 'Core System', color: 'bg-red-50 text-red-800 border-red-200' }
    };

    const def = map[module] || { nameAr: module, nameEn: module, color: 'bg-slate-100 text-slate-700' };
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${def.color}`}>
        {language === 'ar' ? def.nameAr : def.nameEn}
      </span>
    );
  };

  const getSeverityDot = (severity: AuditSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" title="حرج للغاية / Critical" />;
      case 'DANGER':
        return <span className="w-2.5 h-2.5 rounded-full bg-rose-500" title="خطر / حذف" />;
      case 'WARN':
        return <span className="w-2.5 h-2.5 rounded-full bg-amber-500" title="تحذير / تعديل" />;
      default:
        return <span className="w-2.5 h-2.5 rounded-full bg-blue-500" title="معلوماتي / Info" />;
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedAction('ALL');
    setSelectedModule('ALL');
    setSelectedSeverity('ALL');
    setSelectedUserId('ALL');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 sm:p-7 shadow-xl border border-slate-700 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0 shadow-inner">
              <ShieldAlert size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  {language === 'ar' ? 'سجل الأنشطة ومسارات التدقيق المالي' : 'Audit Trail & Activity Log'}
                </h1>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                  {language === 'ar' ? 'تتبع لحظي نشط' : 'Live Tracking'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {language === 'ar'
                  ? 'سجل مركزي غير قابل للتعديل يوثق أدق تفاصيل العمليات المالية، والإنشاء، والتعديلات، والترحيل، وهوية المستخدمين، والتوقيت الزمني الدقيق لضمان الحوكمة والامتثال المحاسبي.'
                  : 'Immutable centralized ledger documenting every transaction, modification, deletion, approval, user action, and timestamp for strict compliance.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end lg:self-auto shrink-0">
            <button
              type="button"
              onClick={() => exportAuditLogsToCSV(filteredLogs)}
              disabled={filteredLogs.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              title="تصدير السجل إلى ملف Excel / CSV"
            >
              <Download size={15} />
              <span>{language === 'ar' ? 'تصدير السجل (CSV)' : 'Export Log (CSV)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-700/60 rounded-xl text-xs font-bold transition-all cursor-pointer"
              title="إفراغ وتصفير السجل"
            >
              <Trash2 size={15} />
              <span>{language === 'ar' ? 'إفراغ السجل' : 'Clear Log'}</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-700/70">
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <Activity size={16} />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">{language === 'ar' ? 'إجمالي الأحداث المسجلة' : 'Total Events'}</div>
              <div className="text-lg font-black text-white">{stats.total}</div>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <PlusCircle size={16} />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">{language === 'ar' ? 'عمليات إنشاء وترحيل' : 'Creates & Posts'}</div>
              <div className="text-lg font-black text-emerald-400">{stats.creates}</div>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Edit3 size={16} />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">{language === 'ar' ? 'تعديلات وتغيير إعدادات' : 'Updates & Edits'}</div>
              <div className="text-lg font-black text-amber-400">{stats.updates}</div>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
              <AlertTriangle size={16} />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">{language === 'ar' ? 'حذف وعمليات حرجة' : 'Deletions & Critical'}</div>
              <div className="text-lg font-black text-rose-400">{stats.critical || stats.deletes}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Control Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Main Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'ar' ? 'بحث برقم المستند (INV-001)، اسم المستخدم، البيان، أو نوع المعاملة...' : 'Search by doc #, username, description, or action...'}
              className="w-full pl-3 pr-10 py-2.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-300 focus:border-indigo-500 rounded-xl text-xs sm:text-sm font-medium transition-all outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Reset Filters button */}
          {(searchQuery || selectedAction !== 'ALL' || selectedModule !== 'ALL' || selectedSeverity !== 'ALL' || selectedUserId !== 'ALL' || startDate || endDate) && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200/70 rounded-xl transition-all cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>{language === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}</span>
            </button>
          )}
        </div>

        {/* Dropdowns Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          {/* Module Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              {language === 'ar' ? 'الوحدة / الموديول' : 'Module'}
            </label>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">{language === 'ar' ? 'كل الوحدات (الكل)' : 'All Modules'}</option>
              <option value="SALES">{language === 'ar' ? 'المبيعات والعملاء' : 'Sales'}</option>
              <option value="PURCHASES">{language === 'ar' ? 'المشتريات والموردين' : 'Purchases'}</option>
              <option value="TREASURY">{language === 'ar' ? 'الخزينة والبنوك' : 'Treasury'}</option>
              <option value="JOURNAL">{language === 'ar' ? 'القيود اليومية' : 'Journal Entries'}</option>
              <option value="ITEMS">{language === 'ar' ? 'المخزون والأصناف' : 'Items'}</option>
              <option value="INVENTORY_COUNT">{language === 'ar' ? 'الجرد والتسويات' : 'Inventory Count'}</option>
              <option value="PAYROLL">{language === 'ar' ? 'الرواتب والموظفين' : 'Payroll'}</option>
              <option value="MANUFACTURING">{language === 'ar' ? 'التصنيع والإنتاج' : 'Manufacturing'}</option>
              <option value="SETTINGS">{language === 'ar' ? 'إعدادات النظام' : 'Settings'}</option>
              <option value="YEAR_END">{language === 'ar' ? 'الإقفال السنوي' : 'Year-End'}</option>
            </select>
          </div>

          {/* Action Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              {language === 'ar' ? 'نوع الإجراء' : 'Action Type'}
            </label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">{language === 'ar' ? 'كل الإجراءات' : 'All Actions'}</option>
              <option value="CREATE">{language === 'ar' ? 'إنشاء جديد (Create)' : 'Create'}</option>
              <option value="UPDATE">{language === 'ar' ? 'تعديل (Update)' : 'Update'}</option>
              <option value="DELETE">{language === 'ar' ? 'حذف (Delete)' : 'Delete'}</option>
              <option value="POST">{language === 'ar' ? 'ترحيل (Post)' : 'Post'}</option>
              <option value="APPROVE">{language === 'ar' ? 'اعتماد (Approve)' : 'Approve'}</option>
              <option value="SETTINGS_CHANGE">{language === 'ar' ? 'تعديل إعدادات' : 'Settings Change'}</option>
              <option value="PRINT">{language === 'ar' ? 'طباعة مستند' : 'Print'}</option>
              <option value="EXPORT">{language === 'ar' ? 'تصدير بيانات' : 'Export'}</option>
            </select>
          </div>

          {/* User Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              {language === 'ar' ? 'المستخدم القائم بالعملية' : 'User'}
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">{language === 'ar' ? 'جميع المستخدمين' : 'All Users'}</option>
              {availableUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Severity Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              {language === 'ar' ? 'مستوى الأهمية' : 'Severity'}
            </label>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">{language === 'ar' ? 'كل المستويات' : 'All Severities'}</option>
              <option value="INFO">{language === 'ar' ? 'عادي (Info)' : 'Info'}</option>
              <option value="WARN">{language === 'ar' ? 'تنبيه / تعديل (Warning)' : 'Warning'}</option>
              <option value="DANGER">{language === 'ar' ? 'حرج / حذف (Danger)' : 'Danger'}</option>
              <option value="CRITICAL">{language === 'ar' ? 'حرج جداً (Critical)' : 'Critical'}</option>
            </select>
          </div>

          {/* Date Start */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              {language === 'ar' ? 'من تاريخ' : 'From Date'}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 font-medium"
            />
          </div>

          {/* Date End */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              {language === 'ar' ? 'إلى تاريخ' : 'To Date'}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Audit Logs Table View */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-slate-500" />
            <span className="text-xs sm:text-sm font-bold text-slate-800">
              {language === 'ar' ? `سجل العمليات المعروضة (${filteredLogs.length})` : `Filtered Entries (${filteredLogs.length})`}
            </span>
          </div>
          <span className="text-xs text-slate-500">
            {language === 'ar' ? 'مرتبة تنازلياً من الأحدث إلى الأقدم' : 'Sorted from newest to oldest'}
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
              <Search size={22} />
            </div>
            <div className="text-sm font-bold text-slate-700">
              {language === 'ar' ? 'لا توجد سجلات تطابق شروط البحث الحالية' : 'No audit entries match the filters'}
            </div>
            <p className="text-xs text-slate-500 max-w-sm">
              {language === 'ar' ? 'جرب تعديل كلمات البحث أو مسح نطاق التواريخ المحددة.' : 'Try changing your search query or reset date ranges.'}
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
            >
              {language === 'ar' ? 'إعادة ضبط كل الفلاتر' : 'Clear all filters'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3.5 text-center w-8">#</th>
                  <th className="py-3 px-3.5">{language === 'ar' ? 'التوقيت الزمني' : 'Timestamp'}</th>
                  <th className="py-3 px-3.5">{language === 'ar' ? 'نوع الإجراء' : 'Action'}</th>
                  <th className="py-3 px-3.5">{language === 'ar' ? 'الوحدة / الموديول' : 'Module'}</th>
                  <th className="py-3 px-3.5">{language === 'ar' ? 'المستند / المعاملة' : 'Document / Target'}</th>
                  <th className="py-3 px-3.5">{language === 'ar' ? 'المستخدم والفرع' : 'User & Branch'}</th>
                  <th className="py-3 px-3.5">{language === 'ar' ? 'البيان والملخص' : 'Summary'}</th>
                  <th className="py-3 px-3.5 text-center">{language === 'ar' ? 'التفاصيل' : 'Details'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log, index) => {
                  const dateObj = new Date(log.timestamp);
                  const dateFormatted = dateObj.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
                  const timeFormatted = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                  return (
                    <tr 
                      key={log.id} 
                      className="hover:bg-indigo-50/40 transition-colors group cursor-pointer"
                      onClick={() => setSelectedLogForDetails(log)}
                    >
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center">
                          {getSeverityDot(log.severity)}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{timeFormatted}</div>
                        <div className="text-[10px] text-slate-400">{dateFormatted}</div>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {getModuleBadge(log.module)}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-800">
                          {log.documentNumber || log.documentType || '-'}
                        </div>
                        {log.documentNumber && log.documentType && (
                          <div className="text-[10px] text-slate-500">{log.documentType}</div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <User size={13} className="text-slate-400" />
                          <span>{log.user.displayName || log.user.username}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {log.user.role} {log.user.branch ? `• ${log.user.branch}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 font-medium text-slate-700 max-w-xs md:max-w-md truncate">
                        <span title={log.summary}>
                          {language === 'ar' ? log.summary : (log.summaryEn || log.summary)}
                        </span>
                        {log.changes && log.changes.length > 0 && (
                          <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                            {language === 'ar' ? `[تعديل ${log.changes.length} حقول]` : `[${log.changes.length} fields modified]`}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLogForDetails(log);
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-indigo-600 text-slate-600 group-hover:text-white transition-colors cursor-pointer"
                          title="عرض التفاصيل الكاملة"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Slide-over / Modal */}
      {selectedLogForDetails && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-in fade-in"
          onClick={() => setSelectedLogForDetails(null)}
        >
          <div 
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
                  <Activity size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">
                    {language === 'ar' ? 'تفاصيل الحركة ومسار التدقيق' : 'Audit Entry Details'}
                  </h3>
                  <div className="text-xs text-slate-400 font-mono">
                    ID: {selectedLogForDetails.id}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLogForDetails(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Summary Box */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 mb-1">
                  {language === 'ar' ? 'البيان والملخص العام' : 'Summary'}
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {language === 'ar' ? selectedLogForDetails.summary : (selectedLogForDetails.summaryEn || selectedLogForDetails.summary)}
                </div>
              </div>

              {/* Grid Attributes */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-slate-400 text-[10px] font-bold">{language === 'ar' ? 'التوقيت الزمني' : 'Timestamp'}</div>
                  <div className="font-mono font-bold text-slate-800 mt-0.5">
                    {new Date(selectedLogForDetails.timestamp).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-slate-400 text-[10px] font-bold">{language === 'ar' ? 'المستخدم المنفذ' : 'Executed By'}</div>
                  <div className="font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                    <User size={12} className="text-slate-400" />
                    <span>{selectedLogForDetails.user.displayName}</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-slate-400 text-[10px] font-bold">{language === 'ar' ? 'الدور الوظيفي' : 'Role & Branch'}</div>
                  <div className="font-bold text-indigo-700 mt-0.5">
                    {selectedLogForDetails.user.role} {selectedLogForDetails.user.branch ? `(${selectedLogForDetails.user.branch})` : ''}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-slate-400 text-[10px] font-bold">{language === 'ar' ? 'الموديول / الوحدة' : 'Module'}</div>
                  <div className="mt-1">{getModuleBadge(selectedLogForDetails.module)}</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-slate-400 text-[10px] font-bold">{language === 'ar' ? 'نوع الإجراء' : 'Action'}</div>
                  <div className="mt-1">{getActionBadge(selectedLogForDetails.action)}</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-slate-400 text-[10px] font-bold">{language === 'ar' ? 'رقم المستند' : 'Document #'}</div>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">
                    {selectedLogForDetails.documentNumber || '-'}
                  </div>
                </div>
              </div>

              {/* Changes Diff Table if Available */}
              {selectedLogForDetails.changes && selectedLogForDetails.changes.length > 0 && (
                <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-3.5 space-y-2">
                  <div className="font-bold text-amber-900 flex items-center gap-1.5">
                    <Edit3 size={14} />
                    <span>{language === 'ar' ? 'سجل الحقول المعدلة (Before & After)' : 'Changed Fields (Before & After)'}</span>
                  </div>
                  <table className="w-full text-right bg-white rounded-lg border border-amber-200 overflow-hidden">
                    <thead className="bg-amber-100/60 font-bold text-amber-900">
                      <tr>
                        <th className="p-2">{language === 'ar' ? 'الحقل' : 'Field'}</th>
                        <th className="p-2 text-rose-700">{language === 'ar' ? 'القيمة السابقة' : 'Old Value'}</th>
                        <th className="p-2 text-emerald-700">{language === 'ar' ? 'القيمة الجديدة' : 'New Value'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {selectedLogForDetails.changes.map((c, i) => (
                        <tr key={i}>
                          <td className="p-2 font-bold text-slate-800">{c.fieldLabel || c.field}</td>
                          <td className="p-2 font-mono text-rose-600 line-through">{String(c.oldValue ?? '-')}</td>
                          <td className="p-2 font-mono text-emerald-700 font-bold">{String(c.newValue ?? '-')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Raw Details JSON */}
              {selectedLogForDetails.details && Object.keys(selectedLogForDetails.details).length > 0 && (
                <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto">
                  <div className="text-slate-400 font-bold mb-1 font-sans text-xs">
                    {language === 'ar' ? 'بيانات وحقول إضافية (Metadata):' : 'Additional Metadata:'}
                  </div>
                  <pre className="whitespace-pre-wrap">{JSON.stringify(selectedLogForDetails.details, null, 2)}</pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-3.5 border-t border-slate-200 flex items-center justify-between">
              <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                <Lock size={12} className="text-emerald-600" />
                <span>{language === 'ar' ? 'سجل محاسبي رقمي موثق وغير قابل للتلاعب' : 'Tamper-evident system log'}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLogForDetails(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-rose-200 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <h4 className="font-extrabold text-base text-slate-900">
              {language === 'ar' ? 'هل أنت متأكد من تفريغ سجل التدقيق؟' : 'Are you sure you want to clear audit logs?'}
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              {language === 'ar'
                ? 'سيتم مسح سجل الأنشطة السابق وتوثيق عملية التفريغ نفسها كحدث أمان محوري في السجل الجديد.'
                : 'All historical activity logs will be cleared, and this clear action itself will be recorded as a critical security event.'}
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  clearAuditLogs();
                  setShowClearConfirm(false);
                }}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {language === 'ar' ? 'نعم، قم بالتفريغ' : 'Yes, Clear Log'}
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
