import { useState } from 'react';
import { 
  Printer, 
  X, 
  Check, 
  Copy, 
  MessageSquare, 
  Building2, 
  FileCheck, 
  Scale
} from 'lucide-react';
import { PartnerBalanceItem } from './PartnerBalances';
import { getSystemSettings } from '../utils/settings';
import { useSystemCurrency } from '../utils/currency';

interface BalanceConfirmationModalProps {
  partner: PartnerBalanceItem | null;
  isOpen: boolean;
  onClose: () => void;
  asOfDate?: string;
  currencySymbol?: string;
}

export default function BalanceConfirmationModal({
  partner,
  isOpen,
  onClose,
  asOfDate,
  currencySymbol: customCurrency
}: BalanceConfirmationModalProps) {
  const { symbol: defaultCurrency } = useSystemCurrency();
  const currencySymbol = customCurrency || defaultCurrency;
  const [systemSettings] = useState(() => getSystemSettings());
  const [copied, setCopied] = useState(false);

  if (!isOpen || !partner) return null;

  const todayStr: string = asOfDate || new Date().toISOString().slice(0, 10);
  const company = systemSettings.company;
  const isCustomer = partner.type === 'CUSTOMER';
  const isDebit = partner.calc.balanceType === 'DEBIT';
  const isCredit = partner.calc.balanceType === 'CREDIT';
  
  const balanceNatureLabel = isDebit 
    ? (isCustomer ? 'رصيد مدين (مستحق لنا بذمتكم)' : 'رصيد مدين (دفعة مقدمة لكم من طرفنا)')
    : isCredit 
    ? (isCustomer ? 'رصيد دائن (دفعة مقدمة مسددة منكم)' : 'رصيد دائن (مستحق لكم واجب السداد من طرفنا)')
    : 'رصيد متزن (صفر)';

  const confirmationLetterText = `السلام عليكم ورحمة الله وبركاته،
السادة/ ${partner.name} المحترمين
تحية طيبة وبعد،

ضمن إجراءات المراجعة الدورية ومطابقة الحسابات المتبادلة في ${company.nameAr}، نود إحاطتكم بأن رصيد حسابكم المسجل لدينا حتى تاريخ ${todayStr} هو:
${partner.calc.balanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currencySymbol} (${balanceNatureLabel}).

- إجمالي التعاملات/المسحوبات: ${partner.totalWithdrawals.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currencySymbol}
- إجمالي المدفوعات/السدادات: ${partner.totalPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currencySymbol}

نرجو التكرم بمطابقة الرصيد المذكور والتأكيد بصحته، وفي حال وجود أي فروقات نأمل التكرم بموافاتنا بها.

شاكرين حسن تعاونكم الدائم،
قسم الحسابات والمالية - ${company.nameAr}
هاتف: ${company.phone}`;

  const handleCopyText = () => {
    navigator.clipboard.writeText(confirmationLetterText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsApp = () => {
    if (!partner.phone) {
      alert('لا يتوفر رقم هاتف مسجل لهذا الطرف.');
      return;
    }
    const cleanPhone = partner.phone.replace(/[^\d]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(confirmationLetterText)}`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-xs animate-fadeIn print-preview-modal-root"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] md:max-h-[90vh] animate-modalIn text-right"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Mobile Handle */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0 print:hidden" />

        {/* Top Control Bar (Hidden on Print) */}
        <div className="bg-slate-900 text-white p-3.5 sm:p-5 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 shrink-0 print:hidden border-b border-slate-800">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shrink-0">
              <FileCheck size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-white truncate">خطاب مصادقة وتأكيد رصيد</h3>
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-2 py-0.5 rounded border border-indigo-400/30 font-semibold shrink-0">
                  {isCustomer ? 'عميل' : 'مورد'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate sm:overflow-visible sm:whitespace-normal">
                نموذج محاسبي رسمي لمصادقة وتدقيق الأرصدة الدورية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 mr-auto sm:mr-0">
            {partner.phone && (
              <button
                type="button"
                onClick={handleWhatsApp}
                className="btn-3d btn-3d-success-soft px-3 py-1.5 text-xs font-black flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all"
                title="إرسال نص الخطاب عبر واتساب"
              >
                <MessageSquare size={14} />
                <span className="hidden sm:inline">إرسال واتساب</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyText}
              className="btn-3d btn-3d-white px-3 py-1.5 text-xs font-black flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all"
              title="نسخ نص الخطاب إلى الحافظة"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span className="hidden sm:inline">{copied ? 'تم النسخ!' : 'نسخ النص'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="btn-3d btn-3d-blue px-3.5 py-1.5 text-xs font-black flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all"
              title="طباعة خطاب المصادقة الرسمي"
            >
              <Printer size={14} />
              <span>طباعة الخطاب</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="btn-3d btn-3d-slate p-1.5 rounded-xl text-slate-300 hover:text-white hover:scale-105 active:scale-95 transition-all"
              title="إغلاق النافذة"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Letter Body */}
        <div className="p-4 sm:p-8 md:p-10 overflow-y-auto bg-white text-slate-800 text-xs sm:text-sm leading-relaxed font-sans" id="printable-confirmation-letter">
          
          {/* Letterhead */}
          <div className="border-b-2 border-slate-900 pb-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">
                <Building2 size={24} />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-slate-900">{company.nameAr}</h1>
                <p className="text-xs text-slate-500 font-medium">{company.nameEn}</p>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1 font-mono">
                  {company.commercialRegister && <span>س.ت: {company.commercialRegister}</span>}
                  {company.taxNumber && <span>الرقم الضريبي: {company.taxNumber}</span>}
                </div>
              </div>
            </div>

            <div className="text-left sm:text-left text-xs text-slate-600 font-mono space-y-1">
              <div><strong>التاريخ:</strong> {todayStr}</div>
              <div><strong>رقم الإشارة:</strong> CONF-{partner.code}-{todayStr.replace(/-/g, '')}</div>
              <div><strong>الموضوع:</strong> مصادقة رصيد حساب دوري</div>
            </div>
          </div>

          {/* Addressee */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
            <div className="text-xs text-slate-500 font-medium">السادة الشركاء الكرام:</div>
            <div className="text-base font-bold text-slate-900 mt-0.5">{partner.name} المحترمين</div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-600 mt-1 font-mono">
              <span>كود الحساب: <strong>{partner.code}</strong></span>
              {partner.taxNumber && <span>الرقم الضريبي: <strong>{partner.taxNumber}</strong></span>}
              {partner.phone && <span>الهاتف: <strong dir="ltr">{partner.phone}</strong></span>}
              {partner.address && <span>العنوان: {partner.address}</span>}
            </div>
          </div>

          {/* Body Text */}
          <div className="space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed mb-6">
            <p className="font-semibold text-slate-900">السلام عليكم ورحمة الله وبركاته،،،</p>
            <p>
              ضمن إجراءات المراجعة الدورية وتدقيق ومطابقة أرصدة الحسابات المتبادلة بيننا والمقيدة في دفاتر وسجلات شركتنا المحاسبية، نود إحاطتكم علماً بأن رصيد حسابكم حتى تاريخ <strong>{todayStr}</strong> هو كما هو موضح أدناه:
            </p>
          </div>

          {/* Financial Breakdown Table */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden mb-6">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">البيان المحاسبي</th>
                  <th className="p-3 text-left font-mono">المبلغ بالريال السعودي ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="p-3 text-slate-700">الرصيد الافتتاحي السابق</td>
                  <td className="p-3 text-left font-mono font-medium">
                    {Math.abs(partner.openingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td className="p-3 text-slate-700">
                    {isCustomer ? 'إجمالي المبيعات والمسحوبات الصادرة لكم (مدين)' : 'إجمالي المشتريات والتوريدات المستلمة منكم (دائن)'}
                  </td>
                  <td className="p-3 text-left font-mono font-bold text-blue-700">
                    {partner.totalWithdrawals.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td className="p-3 text-slate-700">
                    {isCustomer ? 'إجمالي المدفوعات والمقبوضات المستلمة منكم (دائن)' : 'إجمالي الدفعات والمسددات المحولة لكم (مدين)'}
                  </td>
                  <td className="p-3 text-left font-mono font-bold text-emerald-700">
                    {partner.totalPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="bg-indigo-50/70 border-t-2 border-indigo-200">
                  <td className="p-3.5 font-black text-slate-900 text-sm">
                    الرصيد النهائي الصافي المستحق:
                    <span className="block text-[11px] font-normal text-slate-600 mt-0.5">
                      ({balanceNatureLabel})
                    </span>
                  </td>
                  <td className="p-3.5 text-left font-mono font-black text-base text-indigo-900">
                    {partner.calc.balanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-600 mb-8 leading-relaxed">
            نرجو التكرم بمراجعة الأرقام الموضحة أعلاه ومطابقتها مع قيودكم وسجلاتكم الدفترية، وتأكيد المصادقة بتوقيع وختم قسيمة الرد المرفقة أدناه وإعادتها إلينا عبر البريد الإلكتروني أو الفاكس خلال (7) أيام عمل من تاريخه. وفي حال وجود أي ملاحظات أو فروقات يرجى إرفاق كشف الحساب المقارن لتسوية الفروقات.
          </p>

          {/* Signatures for Company */}
          <div className="grid grid-cols-2 gap-8 pt-4 pb-8 border-b border-dashed border-slate-300 mb-8 text-xs">
            <div>
              <div className="font-bold text-slate-800">إعداد / قسم الحسابات:</div>
              <div className="mt-8 text-slate-500">التوقيع: .......................................</div>
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-800">المدير المالي والختم الرسمي:</div>
              <div className="mt-8 text-slate-500">التوقيع والختم: .......................................</div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* Acknowledgment Slip (قسيمة الرد والمصادقة للطرف)               */}
          {/* ============================================================ */}
          <div className="bg-slate-50/80 p-5 rounded-2xl border-2 border-slate-300">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
              <h4 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                <Scale size={16} className="text-indigo-600" />
                قسيمة رد ومصادقة الرصيد (يُعاد توقيعها وختمها من قِبل {partner.name})
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">CONF-RESPONSE</span>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded border border-slate-400 mt-0.5 shrink-0 bg-white" />
                <span>
                  <strong>نقر بصحة ومطابقة الرصيد:</strong> نؤيد بأن رصيد حسابنا لدى {company.nameAr} حتى تاريخ {todayStr} هو <strong>({partner.calc.balanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol})</strong> وهو مطابق تماماً لدفاترنا.
                </span>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded border border-slate-400 mt-0.5 shrink-0 bg-white" />
                <span>
                  <strong>الرصيد غير مطابق:</strong> رصيد حسابنا في دفاترنا يظهر بمبلغ (.............................. {currencySymbol})، والفارق قدره (.............................. {currencySymbol})، وتفاصيل أسباب الفروقات مرفقة بهذا الرد.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 mt-2 border-t border-slate-200">
                <div>
                  <span className="text-slate-500 text-[11px] block">اسم المسؤول المفوض:</span>
                  <div className="mt-4 border-b border-slate-300 pb-1 text-slate-400 font-mono">...................................</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">التوقيع والتاريخ:</span>
                  <div className="mt-4 border-b border-slate-300 pb-1 text-slate-400 font-mono">..... / ..... / 202...</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block text-center">الختم الرسمي للمنشأة:</span>
                  <div className="mt-1 h-14 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-300 text-[10px]">
                    موضع الختم الرسمي
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Modal Footer (Hidden on Print) */}
        <div className="p-3.5 sm:p-4 bg-slate-50/95 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden shrink-0">
          <span className="text-slate-500 text-[11px] sm:text-xs">
            يمكن طباعة الخطاب كنسخة PDF أو مشاركة النص المعتمد عبر واتساب مباشرة.
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none btn-3d btn-3d-white px-4 py-2.5 sm:py-2 text-xs font-black hover:scale-105 active:scale-95 transition-all"
            >
              إغلاق
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none btn-3d btn-3d-blue px-4 py-2.5 sm:py-2 text-xs font-black flex items-center justify-center gap-1.5 hover:scale-105 active:scale-95 transition-all"
            >
              <Printer size={14} />
              <span>طباعة المستند</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
