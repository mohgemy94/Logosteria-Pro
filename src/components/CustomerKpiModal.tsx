import { useState, useMemo } from 'react';
import { 
  X, Users, ArrowDownLeft, Receipt, ArrowUpRight, 
  Search, MessageSquare, ShieldAlert,
  FileText, Check, Copy
} from 'lucide-react';
import ExportButtonGroup from './ExportButtonGroup';
import { Partner } from '../types/accounting';
import { PartnerStatement } from '../utils/partnerLedger';

export type CustomerKpiModalType = 'TOTAL_CUSTOMERS' | 'DEBTORS_RECEIVABLES' | 'CREDITORS_ADVANCES' | 'TOTAL_SALES';

interface CustomerKpiModalProps {
  type: CustomerKpiModalType | null;
  isOpen: boolean;
  onClose: () => void;
  customersWithStatements: Array<{
    customer: Partner;
    statement: PartnerStatement;
  }>;
  onSelectPartnerForStatement: (partner: Partner) => void;
  onQuickReceipt: (partner: Partner) => void;
}

export default function CustomerKpiModal({
  type,
  isOpen,
  onClose,
  customersWithStatements,
  onSelectPartnerForStatement,
  onQuickReceipt
}: CustomerKpiModalProps) {
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyPhone = (phone: string, id: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Specific data slices and sorting depending on modal type
  const { title, subtitle, badgeColor, icon, data, summary } = useMemo(() => {
    if (!type) {
      return {
        title: '',
        subtitle: '',
        badgeColor: '',
        icon: null,
        data: [],
        summary: { countLabel: '', count: 0, amountLabel: '', amount: 0 }
      };
    }

    if (type === 'DEBTORS_RECEIVABLES') {
      const debtors = customersWithStatements
        .filter(item => item.statement.balanceType === 'DEBIT')
        .sort((a, b) => b.statement.balance - a.statement.balance);

      const totalDebt = debtors.reduce((sum, item) => sum + item.statement.balance, 0);
      const overLimitCount = debtors.filter(
        item => item.customer.creditLimit && item.statement.balance > item.customer.creditLimit
      ).length;

      return {
        title: 'سجل وتحليل العملاء المدينين (المستحقات القائمة لنا)',
        subtitle: 'قائمة العملاء المطلوب منهم سداد مرتبين تنازلياً حسب الرصيد المستحق، لمتابعة التحصيل وإدارة الائتمان',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        icon: <ArrowDownLeft size={22} className="text-emerald-600" />,
        data: debtors,
        summary: {
          countLabel: 'عملاء مدينون',
          count: debtors.length,
          amountLabel: 'إجمالي المبالغ المستحقة لنا',
          amount: totalDebt,
          extraNote: overLimitCount > 0 ? `${overLimitCount} عميل تجاوزوا الحد الائتماني المسموح` : 'جميع العملاء ضمن الحدود الائتمانية'
        }
      };
    }

    if (type === 'CREDITORS_ADVANCES') {
      const creditors = customersWithStatements
        .filter(item => item.statement.balanceType === 'CREDIT')
        .sort((a, b) => b.statement.balance - a.statement.balance);

      const totalCredit = creditors.reduce((sum, item) => sum + item.statement.balance, 0);

      return {
        title: 'سجل الدفعات المقدمة وأرصدة العملاء الدائنة',
        subtitle: 'قائمة العملاء أصحاب الأرصدة الدائنة (دفعات مقدمة أو مبالغ زائدة لصالحهم) لتسويتها مع الفواتير القادمة',
        badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
        icon: <Receipt size={22} className="text-purple-600" />,
        data: creditors,
        summary: {
          countLabel: 'عملاء أصحاب أرصدة دائنة',
          count: creditors.length,
          amountLabel: 'إجمالي الأرصدة الدائنة (دفعات مقدمة)',
          amount: totalCredit,
          extraNote: 'يتم استهلاك هذه الأرصدة تلقائياً عند إصدار فواتير مبيعات آجلة جديدة'
        }
      };
    }

    if (type === 'TOTAL_SALES') {
      const buyers = customersWithStatements
        .filter(item => item.statement.totalDebit > 0)
        .sort((a, b) => b.statement.totalDebit - a.statement.totalDebit);

      const totalSales = buyers.reduce((sum, item) => sum + item.statement.totalDebit, 0);

      return {
        title: 'تحليل حجم تعاملات ومبيعات العملاء (أعلى العملاء سحباً)',
        subtitle: 'ترتيب العملاء تنازلياً وفقاً لحجم المبيعات والمسحوبات الإجمالية (مدين) لقياس القوة الشرائية',
        badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        icon: <ArrowUpRight size={22} className="text-indigo-600" />,
        data: buyers,
        summary: {
          countLabel: 'عملاء أجروا مسحوبات',
          count: buyers.length,
          amountLabel: 'إجمالي مسحوبات ومبيعات العملاء',
          amount: totalSales,
          extraNote: `متوسط حجم مشتريات العميل: ${(buyers.length ? totalSales / buyers.length : 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ريال`
        }
      };
    }

    // Default: TOTAL_CUSTOMERS
    const all = [...customersWithStatements].sort((a, b) => a.customer.name.localeCompare(b.customer.name, 'ar'));
    const debtorsCount = all.filter(i => i.statement.balanceType === 'DEBIT').length;
    const creditorsCount = all.filter(i => i.statement.balanceType === 'CREDIT').length;
    const zeroCount = all.filter(i => i.statement.balanceType === 'ZERO').length;

    return {
      title: 'السجل الشامل والتوزيع الإحصائي لقاعدة العملاء',
      subtitle: 'عرض شامل لجميع العملاء المسجلين وتوزيع حالتهم المالية وتفاصيل الاتصال',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: <Users size={22} className="text-blue-600" />,
      data: all,
      summary: {
        countLabel: 'إجمالي العملاء المسجلين',
        count: all.length,
        amountLabel: 'التوزيع المالي',
        amount: 0,
        distribution: { debtorsCount, creditorsCount, zeroCount }
      }
    };
  }, [type, customersWithStatements]);

  // Filtered rows inside modal
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase().trim();
    return data.filter(({ customer: c }) => 
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.taxNumber && c.taxNumber.includes(q)) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q))
    );
  }, [data, search]);

  if (!isOpen || !type) return null;

  const modalExportHeaders = [
    'الكود',
    'اسم العميل',
    'الهاتف',
    'الرقم الضريبي',
    'حد الائتمان',
    'فترة السداد (أيام)',
    'إجمالي المسحوبات (مدين)',
    'إجمالي المدفوعات (دائن)',
    'الرصيد الفعلي',
    'حالة الرصيد'
  ];

  const modalExportRows = useMemo(() => {
    return filteredData.map(({ customer: c, statement: s }) => [
      c.code || '',
      c.name,
      c.phone || '',
      c.taxNumber || '',
      c.creditLimit || '',
      c.paymentTermsDays || '0',
      Number(s.totalDebit.toFixed(2)),
      Number(s.totalCredit.toFixed(2)),
      Number(s.balance.toFixed(2)),
      s.balanceType === 'DEBIT' ? 'مدين (لنا)' : s.balanceType === 'CREDIT' ? 'دائن (له)' : 'متزن'
    ]);
  }, [filteredData]);

  return (
    <div 
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 z-50 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-t-3xl sm:rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] md:max-h-[90vh] animate-modalIn text-right"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Mobile Handle */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header (Fixed) */}
        <div className="p-3.5 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0 bg-slate-50/90">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base md:text-lg font-black text-slate-900 truncate">{title}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black border font-mono shrink-0 ${badgeColor}`}>
                  {summary.count} {summary.countLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 max-w-2xl leading-relaxed truncate sm:overflow-visible sm:whitespace-normal">
                {subtitle}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
            title="إغلاق النافذة"
            aria-label="إغلاق النافذة"
          >
            <X size={18} />
          </button>
        </div>

        {/* Highlight KPI Banner */}
        <div className="bg-white px-4 sm:px-6 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-4 sm:gap-8">
            <div>
              <span className="text-slate-400 text-[11px] block">{summary.amountLabel}</span>
              {type === 'TOTAL_CUSTOMERS' ? (
                <div className="flex items-center gap-3 mt-0.5 font-mono text-xs font-bold">
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    مدينون: {summary.distribution?.debtorsCount}
                  </span>
                  <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                    دائنون: {summary.distribution?.creditorsCount}
                  </span>
                  <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    متزن: {summary.distribution?.zeroCount}
                  </span>
                </div>
              ) : (
                <span className="font-mono text-lg font-bold text-slate-900">
                  {summary.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ريال
                </span>
              )}
            </div>

            {summary.extraNote && (
              <div className="hidden md:block">
                <span className="text-slate-400 text-[11px] block">ملاحظة تحليلية</span>
                <span className="text-slate-600 font-medium">{summary.extraNote}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input 
                type="text"
                placeholder="تصفية السجلات في هذا التقرير..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-3 pr-9 py-1.5 w-full bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 font-medium"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="btn-3d btn-3d-white p-1 rounded-md absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 hover:scale-105 active:scale-95 transition-all"
                  title="مسح البحث"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <ExportButtonGroup
              title={title}
              filename={`تقرير_عملاء_${type}`}
              headers={modalExportHeaders}
              rows={modalExportRows}
              filterSummary={`العدد: ${filteredData.length} عميل | ${summary.amountLabel}: ${summary.amount.toLocaleString()} ريال`}
              size="xs"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-y-auto flex-1 p-0">
          <table className="w-full text-right border-collapse min-w-[700px] text-xs">
            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
              <tr className="text-[10px] uppercase text-slate-500 font-bold">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">الكود</th>
                <th className="px-5 py-3">اسم العميل / المؤسسة</th>
                <th className="px-4 py-3">الاتصال والتواصل</th>
                <th className="px-4 py-3 text-center">حد الائتمان</th>
                {type === 'TOTAL_SALES' && (
                  <th className="px-4 py-3 text-center text-indigo-800">إجمالي المبيعات (مدين)</th>
                )}
                <th className="px-5 py-3">الرصيد الحالي</th>
                <th className="px-4 py-3 text-center">إجراءات سريعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map(({ customer: c, statement: s }, index) => {
                const isOverLimit = Boolean(
                  c.creditLimit && 
                  s.balanceType === 'DEBIT' && 
                  s.balance > c.creditLimit
                );

                return (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-400 text-[11px] font-bold">
                      {index + 1}
                    </td>

                    <td className="px-4 py-3 font-mono text-slate-600 font-bold text-xs whitespace-nowrap">
                      {c.code || '-'}
                    </td>

                    <td className="px-5 py-3 font-medium text-slate-900">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-800 text-sm">{c.name}</span>
                          {isOverLimit && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-200" title={`تجاوز حد الائتمان (${c.creditLimit?.toLocaleString()} ريال)`}>
                              <ShieldAlert size={10} /> تجاوز الحد
                            </span>
                          )}
                        </div>
                        {c.address && (
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">{c.address}</p>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {c.phone ? (
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span dir="ltr" className="font-medium text-slate-700">{c.phone}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyPhone(c.phone!, c.id)}
                            className="btn-3d btn-3d-white p-1 rounded-md text-slate-500 hover:text-slate-800 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                            title="نسخ رقم الهاتف"
                          >
                            {copiedId === c.id ? (
                              <Check size={12} className="text-emerald-600" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                          <a
                            href={`https://wa.me/${c.phone.replace(/[^\d]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-3d btn-3d-white p-1 rounded-md text-emerald-600 hover:text-emerald-700 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                            title="محادثة واتساب"
                          >
                            <MessageSquare size={12} />
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      {c.creditLimit ? (
                        <span className="font-mono font-bold text-slate-700 text-xs">
                          {c.creditLimit.toLocaleString()} ريال
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">مفتوح</span>
                      )}
                    </td>

                    {type === 'TOTAL_SALES' && (
                      <td className="px-4 py-3 text-center font-mono font-bold text-indigo-700 text-sm whitespace-nowrap">
                        {s.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })} ريال
                      </td>
                    )}

                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className={`font-mono font-bold text-sm ${
                          s.balanceType === 'DEBIT' 
                            ? 'text-emerald-700' 
                            : s.balanceType === 'CREDIT' 
                            ? 'text-purple-700' 
                            : 'text-slate-500'
                        }`}>
                          {s.balanceFormatted} ريال
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            s.balanceType === 'DEBIT' 
                              ? 'bg-emerald-500' 
                              : s.balanceType === 'CREDIT' 
                              ? 'bg-purple-500' 
                              : 'bg-slate-400'
                          }`} />
                          <span className="text-[10px] text-slate-500">{s.balanceLabel}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onQuickReceipt(c);
                            onClose();
                          }}
                          className="btn-3d btn-3d-blue px-2.5 py-1 text-xs font-black flex items-center gap-1 hover:scale-105 active:scale-95 transition-all"
                          title="تحصيل وقبض دفعة من العميل"
                        >
                          <Receipt size={12} />
                          <span>قبض</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onSelectPartnerForStatement(c);
                            onClose();
                          }}
                          className="btn-3d btn-3d-success-soft px-2.5 py-1 text-xs font-black flex items-center gap-1 hover:scale-105 active:scale-95 transition-all"
                          title="عرض كشف الحساب التفصيلي"
                        >
                          <FileText size={12} />
                          <span>كشف الحساب</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={type === 'TOTAL_SALES' ? 8 : 7} className="text-center py-12 text-slate-400 text-xs">
                    لا توجد سجلات مطابقة في هذا التقرير
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer (Fixed) */}
        <div className="p-3.5 sm:p-4 bg-slate-50/95 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <span className="text-slate-500">
            عدد السجلات المعروضة: <span className="font-mono font-bold text-slate-800">{filteredData.length}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto btn-3d btn-3d-white px-5 py-2.5 sm:py-2 text-xs font-black hover:scale-105 active:scale-95 transition-all"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
