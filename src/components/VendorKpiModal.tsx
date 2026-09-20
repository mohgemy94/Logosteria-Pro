import { useState, useMemo } from 'react';
import { 
  X, Truck, ArrowUpRight, ArrowDownLeft, 
  Search, MessageSquare, ShieldAlert,
  FileText, Check, Copy, CreditCard
} from 'lucide-react';
import ExportButtonGroup from './ExportButtonGroup';
import { Partner } from '../types/accounting';
import { PartnerStatement } from '../utils/partnerLedger';

export type VendorKpiModalType = 'TOTAL_VENDORS' | 'CREDITORS_PAYABLES' | 'DEBTORS_ADVANCES' | 'TOTAL_PURCHASES';

interface VendorKpiModalProps {
  type: VendorKpiModalType | null;
  isOpen: boolean;
  onClose: () => void;
  vendorsWithStatements: Array<{
    vendor: Partner;
    statement: PartnerStatement;
  }>;
  onSelectPartnerForStatement: (partner: Partner) => void;
  onQuickPayment: (partner: Partner) => void;
}

export default function VendorKpiModal({
  type,
  isOpen,
  onClose,
  vendorsWithStatements,
  onSelectPartnerForStatement,
  onQuickPayment
}: VendorKpiModalProps) {
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

    if (type === 'CREDITORS_PAYABLES') {
      const creditors = vendorsWithStatements
        .filter(item => item.statement.balanceType === 'CREDIT')
        .sort((a, b) => b.statement.balance - a.statement.balance);

      const totalPayables = creditors.reduce((sum, item) => sum + item.statement.balance, 0);
      const overLimitCount = creditors.filter(
        item => item.vendor.creditLimit && item.statement.balance > item.vendor.creditLimit
      ).length;

      return {
        title: 'سجل مستحقات والتزامات الموردين القائمة (علينا - دائنون)',
        subtitle: 'قائمة الموردين المستحق لهم مبالغ واجبة السداد مرتبين تنازلياً حسب الرصيد، لجدولة الصرف وإدارة السيولة النقدية',
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
        icon: <ArrowUpRight size={22} className="text-rose-600" />,
        data: creditors,
        summary: {
          countLabel: 'موردون مستحق لهم',
          count: creditors.length,
          amountLabel: 'إجمالي التزامات الموردين (علينا)',
          amount: totalPayables,
          extraNote: overLimitCount > 0 ? `${overLimitCount} مورد تجاوزت مستحقاتهم سقف الائتمان المتفق عليه` : 'جميع الالتزامات ضمن الحدود الائتمانية'
        }
      };
    }

    if (type === 'DEBTORS_ADVANCES') {
      const debtors = vendorsWithStatements
        .filter(item => item.statement.balanceType === 'DEBIT')
        .sort((a, b) => b.statement.balance - a.statement.balance);

      const totalAdvances = debtors.reduce((sum, item) => sum + item.statement.balance, 0);

      return {
        title: 'سجل الدفعات المقدمة وأرصدة الموردين المدينة (لنا)',
        subtitle: 'قائمة الموردين الذين تم سداد دفعات مقدمة لهم أو مبالغ مسددة بالزيادة بانتظار استلام البضائع وفواتير المشتريات',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        icon: <ArrowDownLeft size={22} className="text-emerald-600" />,
        data: debtors,
        summary: {
          countLabel: 'موردون لديهم دفعات مقدمة',
          count: debtors.length,
          amountLabel: 'إجمالي الدفعات المقدمة للموردين',
          amount: totalAdvances,
          extraNote: 'يتم استهلاك هذه الدفعات تلقائياً عند اعتماد فواتير مشتريات آجلة جديدة'
        }
      };
    }

    if (type === 'TOTAL_PURCHASES') {
      const suppliers = vendorsWithStatements
        .filter(item => item.statement.totalCredit > 0)
        .sort((a, b) => b.statement.totalCredit - a.statement.totalCredit);

      const totalPurchases = suppliers.reduce((sum, item) => sum + item.statement.totalCredit, 0);

      return {
        title: 'تحليل كبار الموردين وحجم التوريدات والمشتريات (دائن)',
        subtitle: 'ترتيب الموردين تنازلياً وفقاً لحجم التوريدات وفواتير المشتريات الإجمالية لقياس قوة العلاقات التجارية',
        badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        icon: <CreditCard size={22} className="text-indigo-600" />,
        data: suppliers,
        summary: {
          countLabel: 'موردون نشطون بالتوريد',
          count: suppliers.length,
          amountLabel: 'إجمالي حجم مشتريات وتوريدات الموردين',
          amount: totalPurchases,
          extraNote: `متوسط حجم توريدات المورد: ${(suppliers.length ? totalPurchases / suppliers.length : 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ريال`
        }
      };
    }

    // Default: TOTAL_VENDORS
    const all = [...vendorsWithStatements].sort((a, b) => a.vendor.name.localeCompare(b.vendor.name, 'ar'));
    const creditorsCount = all.filter(i => i.statement.balanceType === 'CREDIT').length;
    const debtorsCount = all.filter(i => i.statement.balanceType === 'DEBIT').length;
    const zeroCount = all.filter(i => i.statement.balanceType === 'ZERO').length;

    return {
      title: 'السجل الشامل والتوزيع الإحصائي لقاعدة الموردين',
      subtitle: 'عرض شامل لجميع الموردين المسجلين وتوزيع التزاماتهم المالية وتفاصيل الاتصال والحدود الائتمانية',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
      icon: <Truck size={22} className="text-purple-600" />,
      data: all,
      summary: {
        countLabel: 'إجمالي الموردين المسجلين',
        count: all.length,
        amountLabel: 'التوزيع المالي للالتزامات',
        amount: 0,
        distribution: { creditorsCount, debtorsCount, zeroCount }
      }
    };
  }, [type, vendorsWithStatements]);

  // Filtered rows inside modal
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase().trim();
    return data.filter(({ vendor: v }) => 
      v.name.toLowerCase().includes(q) ||
      (v.phone && v.phone.includes(q)) ||
      (v.taxNumber && v.taxNumber.includes(q)) ||
      (v.code && v.code.toLowerCase().includes(q)) ||
      (v.address && v.address.toLowerCase().includes(q)) ||
      (v.email && v.email.toLowerCase().includes(q))
    );
  }, [data, search]);

  if (!isOpen || !type) return null;

  const modalExportHeaders = [
    'الكود',
    'اسم المورد',
    'الهاتف',
    'الرقم الضريبي',
    'سقف الائتمان الممنوح',
    'فترة السداد (أيام)',
    'إجمالي المدفوعات (مدين)',
    'إجمالي المشتريات (دائن)',
    'الرصيد الفعلي',
    'حالة الرصيد'
  ];

  const modalExportRows = useMemo(() => {
    return filteredData.map(({ vendor: v, statement: s }) => [
      v.code || '',
      v.name,
      v.phone || '',
      v.taxNumber || '',
      v.creditLimit || '',
      v.paymentTermsDays || '0',
      Number(s.totalDebit.toFixed(2)),
      Number(s.totalCredit.toFixed(2)),
      Number(s.balance.toFixed(2)),
      s.balanceType === 'CREDIT' ? 'دائن (علينا للمورد)' : s.balanceType === 'DEBIT' ? 'مدين (دفعة لنا)' : 'متزن'
    ]);
  }, [filteredData]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0 bg-slate-50/50">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">{title}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-black border font-mono ${badgeColor}`}>
                  {summary.count} {summary.countLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                {subtitle}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="btn-3d btn-3d-white p-1.5 rounded-xl text-slate-500 hover:text-slate-800 cursor-pointer hover:scale-105 active:scale-95 transition-all shrink-0"
            title="إغلاق النافذة"
          >
            <X size={18} />
          </button>
        </div>

        {/* Highlight KPI Banner */}
        <div className="bg-white px-4 sm:px-6 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-4 sm:gap-8">
            <div>
              <span className="text-slate-400 text-[11px] block">{summary.amountLabel}</span>
              {type === 'TOTAL_VENDORS' ? (
                <div className="flex items-center gap-3 mt-0.5 font-mono text-xs font-bold">
                  <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                    مستحق لهم (دائنون): {summary.distribution?.creditorsCount}
                  </span>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    دفعات مقدمة (مدينون): {summary.distribution?.debtorsCount}
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
              filename={`تقرير_موردين_${type}`}
              headers={modalExportHeaders}
              rows={modalExportRows}
              filterSummary={`العدد: ${filteredData.length} مورد | ${summary.amountLabel}: ${summary.amount.toLocaleString()} ريال`}
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
                <th className="px-5 py-3">اسم المورد / الشركة</th>
                <th className="px-4 py-3">الاتصال والتواصل</th>
                <th className="px-4 py-3 text-center">سقف الائتمان</th>
                {type === 'TOTAL_PURCHASES' && (
                  <th className="px-4 py-3 text-center text-indigo-800">إجمالي المشتريات (دائن)</th>
                )}
                <th className="px-5 py-3">الرصيد الحالي</th>
                <th className="px-4 py-3 text-center">إجراءات سريعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map(({ vendor: v, statement: s }, index) => {
                const isOverLimit = Boolean(
                  v.creditLimit && 
                  s.balanceType === 'CREDIT' && 
                  s.balance > v.creditLimit
                );

                return (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-400 text-[11px] font-bold">
                      {index + 1}
                    </td>

                    <td className="px-4 py-3 font-mono text-slate-600 font-bold text-xs whitespace-nowrap">
                      {v.code || '-'}
                    </td>

                    <td className="px-5 py-3 font-medium text-slate-900">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-800 text-sm">{v.name}</span>
                          {isOverLimit && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-200" title={`تجاوز سقف الائتمان (${v.creditLimit?.toLocaleString()} ريال)`}>
                              <ShieldAlert size={10} /> تجاوز الحد
                            </span>
                          )}
                        </div>
                        {v.address && (
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">{v.address}</p>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {v.phone ? (
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span dir="ltr" className="font-medium text-slate-700">{v.phone}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyPhone(v.phone!, v.id)}
                            className="btn-3d btn-3d-white p-1 rounded-md text-slate-500 hover:text-slate-800 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                            title="نسخ رقم الهاتف"
                          >
                            {copiedId === v.id ? (
                              <Check size={12} className="text-emerald-600" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                          <a
                            href={`https://wa.me/${v.phone.replace(/[^\d]/g, '')}`}
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
                      {v.creditLimit ? (
                        <span className="font-mono font-bold text-slate-700 text-xs">
                          {v.creditLimit.toLocaleString()} ريال
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">مفتوح</span>
                      )}
                    </td>

                    {type === 'TOTAL_PURCHASES' && (
                      <td className="px-4 py-3 text-center font-mono font-bold text-indigo-700 text-sm whitespace-nowrap">
                        {s.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })} ريال
                      </td>
                    )}

                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className={`font-mono font-bold text-sm ${
                          s.balanceType === 'CREDIT' 
                            ? 'text-rose-700' 
                            : s.balanceType === 'DEBIT' 
                            ? 'text-emerald-700' 
                            : 'text-slate-500'
                        }`}>
                          {s.balanceFormatted} ريال
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            s.balanceType === 'CREDIT' 
                              ? 'bg-rose-500' 
                              : s.balanceType === 'DEBIT' 
                              ? 'bg-emerald-500' 
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
                            onQuickPayment(v);
                            onClose();
                          }}
                          className="btn-3d btn-3d-danger-soft px-2.5 py-1 text-xs font-black flex items-center gap-1 hover:scale-105 active:scale-95 transition-all"
                          title="صرف دفعة أو سداد للمورد"
                        >
                          <CreditCard size={12} />
                          <span>صرف</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onSelectPartnerForStatement(v);
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
                  <td colSpan={type === 'TOTAL_PURCHASES' ? 8 : 7} className="text-center py-12 text-slate-400 text-xs">
                    لا توجد سجلات مطابقة في هذا التقرير
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500">
            عدد السجلات المعروضة: <span className="font-mono font-bold text-slate-800">{filteredData.length}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-3d btn-3d-white px-5 py-1.5 text-xs font-black hover:scale-105 active:scale-95 transition-all"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
