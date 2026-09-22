import { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Filter, 
  Search, 
  Calendar, 
  Wallet, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowDownLeft, 
  ArrowUpRight, 
  RefreshCw
} from 'lucide-react';
import { 
  type ExportVoucherItem, 
  type VoucherExportFilters, 
  loadAllUnifiedVouchers, 
  filterUnifiedVouchers, 
  exportVouchersToXLSX, 
  exportVouchersToCSV, 
  exportVouchersReportPDF 
} from '../utils/vouchersExport';

interface VouchersExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'ALL' | 'RECEIPT' | 'PAYMENT' | 'INTERNAL_RECEIPT' | 'INTERNAL_PAYMENT' | 'INTERNAL_TRANSFER';
  initialCategory?: 'ALL' | 'EXTERNAL' | 'INTERNAL';
  initialAccountId?: string;
  preloadedItems?: ExportVoucherItem[];
  title?: string;
}

const ACCOUNT_OPTIONS = [
  { id: 'ALL', name: 'جميع الخزائن والحسابات البنكية' },
  { id: 'cash', name: 'الصندوق الرئيسي (نقداً)' },
  { id: 'cash1', name: 'الخزينة الرئيسية (الصندوق العام)' },
  { id: 'cash2', name: 'صندوق المعرض / المبيعات اليومية' },
  { id: 'cash3', name: 'صندوق العهد والمصروفات النثرية' },
  { id: 'bank1', name: 'البنك الأهلي التجاري' },
  { id: 'bank2', name: 'مصرف الراجحي' },
  { id: 'bank3', name: 'بنك الرياض' },
];

export default function VouchersExportModal({
  isOpen,
  onClose,
  initialType = 'ALL',
  initialCategory = 'ALL',
  initialAccountId = 'ALL',
  preloadedItems,
  title = 'تصدير كشوفات السندات والعمليات المالية (Excel / CSV / PDF)'
}: VouchersExportModalProps) {
  // Master vouchers list
  const [allVouchers, setAllVouchers] = useState<ExportVoucherItem[]>(() => {
    return preloadedItems || loadAllUnifiedVouchers();
  });

  // Reload when modal opens
  useEffect(() => {
    if (isOpen) {
      if (preloadedItems && preloadedItems.length > 0) {
        setAllVouchers(preloadedItems);
      } else {
        setAllVouchers(loadAllUnifiedVouchers());
      }
    }
  }, [isOpen, preloadedItems]);

  // Filters state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>(initialAccountId);
  const [postingStatus, setPostingStatus] = useState<'ALL' | 'POSTED' | 'DRAFT'>('ALL');
  const [voucherType, setVoucherType] = useState<VoucherExportFilters['voucherType']>(initialType);
  const [voucherCategory, setVoucherCategory] = useState<'ALL' | 'EXTERNAL' | 'INTERNAL'>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeDatePreset, setActiveDatePreset] = useState<string>('ALL');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Quick Date Presets Helper
  const applyDatePreset = (preset: 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_YEAR') => {
    setActiveDatePreset(preset);
    const now = new Date();
    const toDateStr = (d: Date): string => (d.toISOString().split('T')[0] as string) || '';

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'TODAY') {
      const today = toDateStr(now);
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'THIS_WEEK') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 6 ? 0 : -1); // start Saturday/Sunday
      const start = new Date(now.setDate(diff));
      setStartDate(toDateStr(start));
      setEndDate(toDateStr(new Date()));
    } else if (preset === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toDateStr(start));
      setEndDate(toDateStr(now));
    } else if (preset === 'THIS_YEAR') {
      const start = new Date(now.getFullYear(), 0, 1);
      setStartDate(toDateStr(start));
      setEndDate(toDateStr(now));
    }
  };

  // Filtered vouchers computation
  const filteredVouchers = useMemo(() => {
    const filters: VoucherExportFilters = {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      accountId: selectedAccount,
      status: postingStatus,
      voucherType: voucherType,
      category: voucherCategory,
      searchQuery: searchQuery
    };
    return filterUnifiedVouchers(allVouchers, filters);
  }, [allVouchers, startDate, endDate, selectedAccount, postingStatus, voucherType, voucherCategory, searchQuery]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalCount = filteredVouchers.length;
    const totalReceipts = filteredVouchers
      .filter(i => i.type === 'RECEIPT' || i.type === 'INTERNAL_RECEIPT')
      .reduce((sum, i) => sum + i.amount, 0);
    const totalPayments = filteredVouchers
      .filter(i => i.type === 'PAYMENT' || i.type === 'INTERNAL_PAYMENT')
      .reduce((sum, i) => sum + i.amount, 0);
    const net = totalReceipts - totalPayments;
    const postedCount = filteredVouchers.filter(i => i.status === 'POSTED').length;
    const draftCount = filteredVouchers.filter(i => i.status === 'DRAFT').length;
    const postedRatio = totalCount > 0 ? Math.round((postedCount / totalCount) * 100) : 0;

    return { totalCount, totalReceipts, totalPayments, net, postedCount, draftCount, postedRatio };
  }, [filteredVouchers]);

  // Generate Filter Summary text for reports
  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (startDate && endDate) parts.push(`من ${startDate} إلى ${endDate}`);
    else if (startDate) parts.push(`من ${startDate}`);
    else if (endDate) parts.push(`حتى ${endDate}`);
    else parts.push('كافة الفترات');

    if (selectedAccount !== 'ALL') {
      const acc = ACCOUNT_OPTIONS.find(a => a.id === selectedAccount);
      parts.push(`الحساب: ${acc?.name || selectedAccount}`);
    }
    if (postingStatus === 'POSTED') parts.push('المرحلة بالحسابات فقط');
    if (postingStatus === 'DRAFT') parts.push('المسودات فقط');
    if (voucherType === 'RECEIPT') parts.push('سندات القبض');
    if (voucherType === 'PAYMENT') parts.push('سندات الصرف');
    if (voucherCategory === 'EXTERNAL') parts.push('سندات العملاء والموردين');
    if (voucherCategory === 'INTERNAL') parts.push('سندات الخزينة والعهد الداخلية');
    if (searchQuery) parts.push(`بحث: "${searchQuery}"`);

    return parts.join(' | ');
  }, [startDate, endDate, selectedAccount, postingStatus, voucherType, voucherCategory, searchQuery]);

  // Export handlers
  const handleExportXLSX = () => {
    if (filteredVouchers.length === 0) return;
    setIsExporting(true);
    try {
      exportVouchersToXLSX(filteredVouchers, 'كشف حركة السندات والعمليات المالية', filterSummary);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredVouchers.length === 0) return;
    setIsExporting(true);
    try {
      exportVouchersToCSV(filteredVouchers, 'كشف حركة السندات والعمليات المالية', filterSummary);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (filteredVouchers.length === 0) return;
    setIsExporting(true);
    try {
      await exportVouchersReportPDF(filteredVouchers, 'كشف حركة السندات والعمليات المالية', filterSummary);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefresh = () => {
    setAllVouchers(loadAllUnifiedVouchers());
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white w-full max-w-5xl rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[92vh] sm:max-h-[88vh] md:max-h-[90vh] overflow-hidden text-right animate-modalIn" 
        dir="rtl"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Mobile Handle */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Modal Header (Fixed) */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-3.5 sm:p-5 flex items-center justify-between gap-3 shrink-0 border-b border-slate-700">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 sm:p-2.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl shrink-0">
              <FileSpreadsheet size={22} className="animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-base md:text-lg font-black text-white flex items-center gap-2 flex-wrap truncate">
                <span>{title}</span>
                <span className="text-[10px] sm:text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono font-bold shrink-0">
                  EXCEL / CSV / PDF
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5 truncate sm:overflow-visible sm:whitespace-normal">
                تصدير مجمّع وجداول بيانات دقيقة مع الفلترة حسب التاريخ، الحساب المالي، وحالة الترحيل المحاسبي
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer hover:scale-105 active:scale-95"
              title="تحديث البيانات من السجلات"
              aria-label="تحديث البيانات"
            >
              <RefreshCw size={17} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer hover:scale-105 active:scale-95"
              title="إغلاق"
              aria-label="إغلاق"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-slate-800 text-xs">
          
          {/* Quick Date Presets Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-slate-600 font-bold">
              <Calendar size={15} className="text-indigo-600" />
              <span>فترة التقرير السريعة:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {[
                { id: 'ALL', label: 'كافة الفترات' },
                { id: 'TODAY', label: 'اليوم' },
                { id: 'THIS_WEEK', label: 'هذا الأسبوع' },
                { id: 'THIS_MONTH', label: 'هذا الشهر' },
                { id: 'THIS_YEAR', label: 'العام الحالي' },
              ].map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyDatePreset(preset.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeDatePreset === preset.id
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Detailed Filters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl">
            
            {/* Start Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">من تاريخ</label>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setActiveDatePreset('CUSTOM');
                }}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-mono"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">إلى تاريخ</label>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setActiveDatePreset('CUSTOM');
                }}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-mono"
              />
            </div>

            {/* Account Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">حساب الخزينة / البنك</label>
              <select
                value={selectedAccount}
                onChange={e => setSelectedAccount(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
              >
                {ACCOUNT_OPTIONS.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>

            {/* Posting Status Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">حالة الترحيل المحاسبي</label>
              <select
                value={postingStatus}
                onChange={e => setPostingStatus(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-bold"
              >
                <option value="ALL">الكل (المرحلة والمسودات)</option>
                <option value="POSTED">المرحلة بالحسابات فقط (POSTED)</option>
                <option value="DRAFT">المسودات المؤقتة فقط (DRAFT)</option>
              </select>
            </div>

            {/* Voucher Type */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">نوع السند</label>
              <select
                value={voucherType}
                onChange={e => setVoucherType(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
              >
                <option value="ALL">جميع الأنواع</option>
                <option value="RECEIPT">سندات القبض (مقبوضات نقدية)</option>
                <option value="PAYMENT">سندات الصرف (مدفوعات نقدية)</option>
                <option value="INTERNAL_TRANSFER">تحويلات بين الخزائن والبنوك</option>
              </select>
            </div>

            {/* Classification */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">التصنيف</label>
              <select
                value={voucherCategory}
                onChange={e => setVoucherCategory(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
              >
                <option value="ALL">الكل (داخلي وخارجي)</option>
                <option value="EXTERNAL">سندات أطراف خارجية (عملاء/موردين)</option>
                <option value="INTERNAL">سندات داخلية (عهد/نثريات/تحويلات)</option>
              </select>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث سريع برقم السند، اسم الطرف، البيان، رقم الشيك أو المرجع..."
              className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Live KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Vouchers */}
            <div className="p-3 bg-slate-900 text-white rounded-xl shadow-xs border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-400 font-bold">عدد السندات المطابقة</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                  {stats.postedRatio}% مرحل
                </span>
              </div>
              <div className="text-xl font-black font-mono">{stats.totalCount}</div>
              <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                <span>مرحل: <b className="text-emerald-400">{stats.postedCount}</b></span>
                <span>مسودة: <b className="text-amber-400">{stats.draftCount}</b></span>
              </div>
            </div>

            {/* Total Receipts */}
            <div className="p-3 bg-emerald-50 text-emerald-900 rounded-xl shadow-xs border border-emerald-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-emerald-700 font-bold">إجمالي المقبوضات</span>
                <ArrowDownLeft size={16} className="text-emerald-600" />
              </div>
              <div className="text-xl font-black font-mono text-emerald-800">{stats.totalReceipts.toLocaleString()}</div>
              <div className="text-[10px] text-emerald-600 mt-1">توريدات وقبض من العملاء والجهات</div>
            </div>

            {/* Total Payments */}
            <div className="p-3 bg-rose-50 text-rose-900 rounded-xl shadow-xs border border-rose-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-rose-700 font-bold">إجمالي المدفوعات</span>
                <ArrowUpRight size={16} className="text-rose-600" />
              </div>
              <div className="text-xl font-black font-mono text-rose-800">{stats.totalPayments.toLocaleString()}</div>
              <div className="text-[10px] text-rose-600 mt-1">صرف ونفقات وسداد الموردين والعهد</div>
            </div>

            {/* Net Movement */}
            <div className="p-3 bg-teal-50 text-teal-900 rounded-xl shadow-xs border border-teal-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-teal-700 font-bold">صافي حركة النقدية</span>
                <Wallet size={16} className="text-teal-600" />
              </div>
              <div className={`text-xl font-black font-mono ${stats.net >= 0 ? 'text-teal-800' : 'text-red-700'}`}>
                {stats.net.toLocaleString()}
              </div>
              <div className="text-[10px] text-teal-600 mt-1">الفارق بين المقبوضات والمدفوعات</div>
            </div>
          </div>

          {/* Live Preview Table of Filtered Records */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="p-2.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between font-bold text-slate-700">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-indigo-600" />
                <span>معاينة جدول السندات للتصدير ({filteredVouchers.length} سند)</span>
              </div>
              <span className="text-[11px] text-slate-500 font-normal">
                سيتم تضمين كافة الأعمدة والبيانات في الملف المصدر
              </span>
            </div>

            {filteredVouchers.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <p className="font-bold text-sm">لا توجد سندات مطابقة لمعايير الفلترة المحددة</p>
                <p className="text-xs mt-1">جرّب توسيع نطاق التاريخ أو اختيار "جميع الحسابات" أو إلغاء البحث</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-60">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2 px-3 text-center">#</th>
                      <th className="py-2 px-3">رقم السند</th>
                      <th className="py-2 px-3">النوع</th>
                      <th className="py-2 px-3">التاريخ</th>
                      <th className="py-2 px-3">الطرف / المستفيد</th>
                      <th className="py-2 px-3">حساب الخزينة/البنك</th>
                      <th className="py-2 px-3 text-left">المبلغ</th>
                      <th className="py-2 px-3">طريقة السداد</th>
                      <th className="py-2 px-3 text-center">حالة الترحيل</th>
                      <th className="py-2 px-3">البيان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredVouchers.slice(0, 100).map((v, idx) => {
                      const isReceipt = v.type === 'RECEIPT' || v.type === 'INTERNAL_RECEIPT';
                      return (
                        <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className={`py-2 px-3 font-mono font-bold ${isReceipt ? 'text-emerald-700' : 'text-rose-700'}`}>
                            #{v.voucherNumber}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`inline-block text-[10px] px-2 py-0.5 rounded-md font-bold ${
                              isReceipt ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {v.typeLabel}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">{v.date}</td>
                          <td className="py-2 px-3 font-medium text-slate-800">{v.partyName}</td>
                          <td className="py-2 px-3 text-slate-600">{v.accountName}</td>
                          <td className="py-2 px-3 font-bold font-mono text-left text-slate-900">
                            {v.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-slate-600 text-[11px]">{v.paymentMethod}</td>
                          <td className="py-2 px-3 text-center">
                            {v.status === 'POSTED' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 size={10} className="text-emerald-600" />
                                <span>مرحل</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <AlertTriangle size={10} className="text-amber-600" />
                                <span>مسودة</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-500 max-w-[200px] truncate" title={v.description}>
                            {v.description || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {filteredVouchers.length > 100 && (
              <div className="p-2 bg-slate-50 text-center text-slate-500 text-[11px] border-t border-slate-200">
                يتم عرض أول 100 سند في المعاينة الحية. سيتم تصدير كافة الـ ({filteredVouchers.length}) سند كاملة في الملف.
              </div>
            )}
          </div>
        </div>

        {/* Modal Action Footer (Fixed) */}
        <div className="bg-slate-100/95 px-4 py-3 sm:px-6 sm:py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 hidden md:block">
            <span className="font-bold text-slate-800">الملف المصدّر: </span>
            <span>يشمل {filteredVouchers.length} سند، بإجمالي حركة {stats.totalReceipts.toLocaleString()} مقبوضات و {stats.totalPayments.toLocaleString()} مدفوعات</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none btn-3d btn-3d-white h-10 px-3.5 text-xs font-bold text-slate-700"
            >
              إلغاء
            </button>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredVouchers.length === 0 || isExporting}
              className="flex-1 sm:flex-none btn-3d btn-3d-blue h-10 px-3 text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
              title="تصدير كشف البيانات بصيغة CSV المتوافقة مع كافة جداول البيانات"
            >
              <FileText size={15} />
              <span>CSV</span>
            </button>

            {/* Export PDF Button */}
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={filteredVouchers.length === 0 || isExporting}
              className="flex-1 sm:flex-none btn-3d btn-3d-rose h-10 px-3 text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
              title="تصدير تقرير وكشف السندات بصيغة PDF للطباعة والتدقيق"
            >
              <Printer size={15} />
              <span>PDF</span>
            </button>

            {/* Main Export XLSX Button */}
            <button
              type="button"
              onClick={handleExportXLSX}
              disabled={filteredVouchers.length === 0 || isExporting}
              className="w-full sm:w-auto btn-3d btn-3d-emerald h-10 px-5 text-xs font-black flex items-center justify-center gap-2 shadow-md disabled:opacity-50 disabled:pointer-events-none"
              title="تصدير جدول السندات إلى ملف Microsoft Excel"
            >
              <FileSpreadsheet size={17} className="text-emerald-200" />
              <span>تصدير Excel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
