import { useState, useMemo } from 'react';
import { 
  X, AlertTriangle, CheckCircle2, Clock, 
  Search, MessageSquare, Receipt, 
  CreditCard, ExternalLink
} from 'lucide-react';
import ExportButtonGroup from './ExportButtonGroup';
import { InstallmentContract, InstallmentScheduleItem } from '../types/installment';
import { useSystemCurrency } from '../utils/currency';

export type InstallmentKpiModalType = 'TOTAL_FINANCED' | 'TOTAL_COLLECTED' | 'TOTAL_REMAINING' | 'OVERDUE_ALERTS';

interface InstallmentKpiModalProps {
  type: InstallmentKpiModalType | null;
  isOpen: boolean;
  onClose: () => void;
  contracts: InstallmentContract[];
  onOpenPayment: (contract: InstallmentContract, item: InstallmentScheduleItem) => void;
  onSelectContractForView: (contract: InstallmentContract) => void;
}

export default function InstallmentKpiModal({
  type,
  isOpen,
  onClose,
  contracts,
  onOpenPayment,
  onSelectContractForView
}: InstallmentKpiModalProps) {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [search, setSearch] = useState('');

  // Calculate schedules
  const flattenedSchedules = useMemo(() => {
    const list: { contract: InstallmentContract; item: InstallmentScheduleItem; daysDiff: number; isOverdue: boolean }[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    contracts.forEach(contract => {
      contract.schedule.forEach(item => {
        const due = new Date(item.dueDate);
        due.setHours(0, 0, 0, 0);
        const diffTime = due.getTime() - now.getTime();
        const daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const isOverdue = item.remainingAmount > 0 && (item.status === 'OVERDUE' || daysDiff < 0);

        list.push({ contract, item, daysDiff, isOverdue });
      });
    });

    return list;
  }, [contracts]);

  // Derived content and items based on KPI type
  const { title, subtitle, badgeColor, icon, summaryLabel, summaryValue, items } = useMemo(() => {
    if (!type) {
      return {
        title: '',
        subtitle: '',
        badgeColor: '',
        icon: null,
        summaryLabel: '',
        summaryValue: '',
        items: []
      };
    }

    if (type === 'OVERDUE_ALERTS') {
      const overdueList = flattenedSchedules
        .filter(s => s.isOverdue)
        .sort((a, b) => a.daysDiff - b.daysDiff); // Most overdue first

      const totalOverdueAmount = overdueList.reduce((sum, s) => sum + s.item.remainingAmount, 0);

      return {
        title: 'تقرير ومتابعة الأقساط المتأخرة والتحصيل العاجل',
        subtitle: 'حصر بجميع الأقساط التي حان موعد استحقاقها ولم تُسدد، مع عدد أيام التأخير وروابط التحصيل والتذكير عبر واتساب',
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
        icon: <AlertTriangle size={22} className="text-rose-600" />,
        summaryLabel: 'إجمالي مبالغ الأقساط المتأخرة',
        summaryValue: `${totalOverdueAmount.toLocaleString()} ${currencySymbol} (${overdueList.length} قسط متأخر)`,
        items: overdueList
      };
    }

    if (type === 'TOTAL_REMAINING') {
      const pendingList = flattenedSchedules
        .filter(s => s.item.remainingAmount > 0)
        .sort((a, b) => new Date(a.item.dueDate).getTime() - new Date(b.item.dueDate).getTime());

      const totalRemaining = pendingList.reduce((sum, s) => sum + s.item.remainingAmount, 0);

      return {
        title: 'تقرير الأرصدة المتبقية في ذمة العملاء والمديونيات القائمة',
        subtitle: 'بيان بجميع الأقساط المستحقة مستقبلاً أو حالياً مرتبة حسب أقرب تاريخ استحقاق لإدارة التدفق النقدي',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
        icon: <Clock size={22} className="text-amber-600" />,
        summaryLabel: 'إجمالي المتبقي للتحصيل في ذمة العملاء',
        summaryValue: `${totalRemaining.toLocaleString()} ${currencySymbol} (${pendingList.length} قسط قائم)`,
        items: pendingList
      };
    }

    if (type === 'TOTAL_COLLECTED') {
      const paidList = flattenedSchedules
        .filter(s => s.item.paidAmount > 0)
        .sort((a, b) => {
          const dateA = a.item.paidDate || a.item.dueDate;
          const dateB = b.item.paidDate || b.item.dueDate;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });

      const totalPaid = paidList.reduce((sum, s) => sum + s.item.paidAmount, 0);

      return {
        title: 'سجل المقبوضات والأقساط المحصلة وسندات القبض',
        subtitle: 'سجل تفصيلي لجميع المبالغ التي تم تحصيلها وإيداعها مع أرقام سندات القبض وتواريخ السداد',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        icon: <CheckCircle2 size={22} className="text-emerald-600" />,
        summaryLabel: 'إجمالي المبالغ المحصلة فعلياً',
        summaryValue: `${totalPaid.toLocaleString()} ${currencySymbol} (${paidList.length} حركة سداد)`,
        items: paidList
      };
    }

    // Default: TOTAL_FINANCED
    const allList = [...flattenedSchedules].sort((a, b) => new Date(a.item.dueDate).getTime() - new Date(b.item.dueDate).getTime());
    const totalFinanced = contracts.reduce((sum, c) => sum + c.totalFinanced, 0);
    const totalProfits = contracts.reduce((sum, c) => sum + c.profitAmount, 0);

    return {
      title: 'السجل الشامل لمحفظة عقود التقسيط والتمويل',
      subtitle: 'حصر كامل لكافة العقود وخطط التقسيط الصادرة وقيمة الأرباح المرابحة ونسب التنفيذ',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: <CreditCard size={22} className="text-blue-600" />,
      summaryLabel: 'إجمالي المحفظة التمويلية',
      summaryValue: `${totalFinanced.toLocaleString()} ${currencySymbol} (أرباح مرابحة: ${totalProfits.toLocaleString()} ${currencySymbol})`,
      items: allList
    };
  }, [type, flattenedSchedules, contracts, currencySymbol]);

  // Filtered items inside modal
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase().trim();
    return items.filter(({ contract: c, item: i }) => 
      c.customerName.toLowerCase().includes(q) ||
      c.contractNumber.toLowerCase().includes(q) ||
      (c.customerPhone && c.customerPhone.includes(q)) ||
      (i.receiptVoucherNumber && i.receiptVoucherNumber.toLowerCase().includes(q)) ||
      (i.promissoryNoteId && i.promissoryNoteId.toLowerCase().includes(q))
    );
  }, [items, search]);

  if (!isOpen || !type) return null;

  // WhatsApp quick notification handler
  const handleSendWhatsAppReminder = (contract: InstallmentContract, item: InstallmentScheduleItem, daysDiff: number) => {
    if (!contract.customerPhone) {
      alert('لا يتوفر رقم هاتف مسجل لهذا العميل');
      return;
    }

    const cleanPhone = contract.customerPhone.replace(/[^\d]/g, '');
    const isOver = daysDiff < 0;
    const msg = isOver
      ? `السلام عليكم ورحمة الله، الأخ/ت ${contract.customerName}، نفيدكم بوجود قسط مستحق متأخر بقيمة ${item.remainingAmount.toLocaleString()} ${currencySymbol} بعقد رقم ${contract.contractNumber} كان مستحقاً بتاريخ ${item.dueDate} (تأخر ${Math.abs(daysDiff)} يوم). نرجو التكرم بسرعة السداد شاكرين تعاونكم.`
      : `السلام عليكم ورحمة الله، الأخ/ت ${contract.customerName}، تذكير بموعد استحقاق القسط رقم #${item.installmentNumber} بقيمة ${item.remainingAmount.toLocaleString()} ${currencySymbol} بعقد رقم ${contract.contractNumber} في تاريخ ${item.dueDate}. شاكرين حسن التزامكم.`;

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const modalExportHeaders = [
    'رقم العقد',
    'اسم العميل',
    'رقم الجوال',
    'رقم القسط',
    'تاريخ الاستحقاق',
    'مبلغ القسط',
    'المسدد',
    'المتبقي',
    'حالة القسط',
    'سند القبض'
  ];

  const modalExportRows = useMemo(() => {
    return filteredItems.map(({ contract: c, item: i }) => [
      c.contractNumber,
      c.customerName,
      c.customerPhone || '',
      i.installmentNumber,
      i.dueDate,
      Number(i.totalAmount.toFixed(2)),
      Number(i.paidAmount.toFixed(2)),
      Number(i.remainingAmount.toFixed(2)),
      i.status === 'PAID' ? 'مسدد' : i.status === 'OVERDUE' ? 'متأخر' : 'مستحق',
      i.receiptVoucherNumber || ''
    ]);
  }, [filteredItems]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 animate-fadeIn" dir="rtl">
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
                  {filteredItems.length} سجل
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
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50 cursor-pointer shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar & Summary Banner */}
        <div className="bg-white px-4 sm:px-6 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shrink-0">
          <div>
            <span className="text-slate-400 text-[11px] block">{summaryLabel}</span>
            <span className="font-mono text-base sm:text-lg font-bold text-slate-900">
              {summaryValue}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input 
                type="text"
                placeholder="بحث بالعميل، العقد، الهاتف..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-3 pr-9 py-1.5 w-full bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 font-medium"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <ExportButtonGroup
              title={title}
              filename={`تقرير_اقساط_${type}`}
              headers={modalExportHeaders}
              rows={modalExportRows}
              filterSummary={`العدد: ${filteredItems.length} | ${summaryLabel}: ${summaryValue}`}
              size="xs"
            />
          </div>
        </div>

        {/* Content Table */}
        <div className="overflow-y-auto flex-1 p-0">
          <table className="w-full text-right border-collapse min-w-[750px] text-xs">
            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
              <tr className="text-[10px] uppercase text-slate-500 font-bold">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">العميل والعقد</th>
                <th className="px-4 py-3">القسط #</th>
                <th className="px-4 py-3">تاريخ الاستحقاق</th>
                <th className="px-4 py-3">مبلغ القسط</th>
                <th className="px-4 py-3">المسدد</th>
                <th className="px-4 py-3">المتبقي</th>
                <th className="px-4 py-3 text-center">إجراءات المتابعة والسداد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map(({ contract: c, item: i, daysDiff, isOverdue }, index) => {
                return (
                  <tr key={i.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-400 text-[11px] font-bold">
                      {index + 1}
                    </td>

                    <td className="px-4 py-3">
                      <div>
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <span>{c.customerName}</span>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectContractForView(c);
                              onClose();
                            }}
                            className="text-slate-400 hover:text-blue-600 p-0.5 cursor-pointer"
                            title="فتح تفاصيل العقد كاملة"
                          >
                            <ExternalLink size={12} />
                          </button>
                        </div>
                        <div className="text-[11px] text-emerald-600 font-mono mt-0.5 flex items-center gap-2">
                          <span>{c.contractNumber}</span>
                          {c.customerPhone && (
                            <span dir="ltr" className="text-slate-400 font-sans">{c.customerPhone}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">
                      قسط #{i.installmentNumber}
                      {i.promissoryNoteId && (
                        <div className="text-[10px] text-slate-400 font-mono">{i.promissoryNoteId}</div>
                      )}
                    </td>

                    <td className="px-4 py-3 font-mono whitespace-nowrap">
                      <div className={`font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-800'}`}>
                        {i.dueDate}
                      </div>
                      {isOverdue && (
                        <span className="inline-block text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 mt-0.5">
                          متأخر {Math.abs(daysDiff)} يوم
                        </span>
                      )}
                      {!isOverdue && i.remainingAmount > 0 && (
                        <span className="text-[10px] text-slate-400">
                          باقي {daysDiff} يوم
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                      {i.totalAmount.toLocaleString()} {currencySymbol}
                    </td>

                    <td className="px-4 py-3 font-bold text-emerald-600 whitespace-nowrap">
                      {i.paidAmount.toLocaleString()} {currencySymbol}
                      {i.receiptVoucherNumber && (
                        <div className="text-[10px] text-slate-400 font-mono">{i.receiptVoucherNumber}</div>
                      )}
                    </td>

                    <td className="px-4 py-3 font-bold text-amber-600 whitespace-nowrap">
                      {i.remainingAmount.toLocaleString()} {currencySymbol}
                    </td>

                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {i.remainingAmount > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenPayment(c, i);
                              onClose();
                            }}
                            className="btn-3d btn-3d-emerald px-2.5 py-1 text-xs font-black flex items-center gap-1"
                            title="تحصيل وسداد هذا القسط"
                          >
                            <Receipt size={12} />
                            <span>تحصيل</span>
                          </button>
                        )}

                        {c.customerPhone && (
                          <button
                            type="button"
                            onClick={() => handleSendWhatsAppReminder(c, i, daysDiff)}
                            className="btn-3d btn-3d-white px-2.5 py-1 text-xs font-black flex items-center gap-1 text-emerald-700 border-emerald-300"
                            title="إرسال تذكير بالسداد للعميل عبر واتساب"
                          >
                            <MessageSquare size={12} className="text-emerald-600" />
                            <span>تذكير واتساب</span>
                          </button>
                        )}

                        {i.remainingAmount === 0 && (
                          <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 size={13} />
                            مسدد
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 text-xs">
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
            عدد السجلات المعروضة: <span className="font-mono font-bold text-slate-800">{filteredItems.length}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-3d btn-3d-white px-5 py-1.5 text-xs font-black"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
