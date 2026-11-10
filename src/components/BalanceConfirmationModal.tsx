import { useState, useRef } from 'react';
import { 
  Printer, 
  X, 
  Check, 
  Copy, 
  MessageSquare, 
  Building2, 
  FileCheck, 
  Scale,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { PartnerBalanceItem } from './PartnerBalances';
import { getSystemSettings } from '../utils/settings';
import { useSystemCurrency } from '../utils/currency';
import { mobileNavigationController } from '../utils/mobileNavigation';
import { useEffect } from 'react';

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
  const [zoom, setZoom] = useState<number>(100);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number }>({ startX: 0, startY: 0, initialPanX: 0, initialPanY: 0 });

  // Reset zoom and pan whenever modal is opened or closed
  useEffect(() => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
  }, [isOpen]);

  const resetPan = () => {
    setPan({ x: 0, y: 0 });
  };

  const handleClose = () => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
    onClose();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 100) return;
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: pan.x,
      initialPanY: pan.y
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 100) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({
      x: dragRef.current.initialPanX + dx,
      y: dragRef.current.initialPanY + dy
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoom <= 100 || e.touches.length !== 1) return;
    setIsDragging(true);
    dragRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      initialPanX: pan.x,
      initialPanY: pan.y
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || zoom <= 100) return;
    const dx = e.touches[0].clientX - dragRef.current.startX;
    const dy = e.touches[0].clientY - dragRef.current.startY;
    setPan({
      x: dragRef.current.initialPanX + dx,
      y: dragRef.current.initialPanY + dy
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Register with mobile navigation controller so back button closes modal first
  useEffect(() => {
    if (!isOpen || !partner) return;
    const modalId = `modal-balance-confirm-${partner.id}`;
    const unregister = mobileNavigationController.registerModal(modalId, () => {
      onClose();
    });
    return () => unregister();
  }, [isOpen, partner, onClose]);

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

            {/* أداة التكبير والتصغير المرنة بأي قيمة (Flexible Zoom Control with Slider & Stepper) */}
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 shadow-2xs text-white">
              <button
                type="button"
                onClick={() => setZoom(z => Math.max(z - 15, 30))}
                className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                title="تصغير (-15%)"
              >
                <ZoomOut size={14} />
              </button>

              <input
                type="range"
                min="30"
                max="220"
                step="5"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-20 sm:w-28 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                title={`نسبة التكبير: ${zoom}% (اسحب للتحكم بأي قيمة)`}
              />

              <button
                type="button"
                onClick={() => setZoom(z => Math.min(z + 15, 220))}
                className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                title="تكبير (+15%)"
              >
                <ZoomIn size={14} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setZoom(100);
                  resetPan();
                }}
                className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                  zoom === 100 
                    ? 'bg-slate-700 text-slate-300' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-500'
                }`}
                title="إعادة ضبط المعاينة إلى 100%"
              >
                {zoom}%
              </button>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="btn-3d btn-3d-slate p-1.5 rounded-xl text-slate-300 hover:text-white hover:scale-105 active:scale-95 transition-all"
              title="إغلاق النافذة"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Letter Body with Interactive Pan & Drag */}
        <div 
          className={`p-4 sm:p-8 md:p-10 overflow-y-auto bg-slate-100 flex justify-center items-start flex-1 select-none ${
            zoom > 100 
              ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') 
              : 'cursor-default'
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div 
            id="printable-confirmation-letter" 
            className="bg-white text-slate-800 text-xs sm:text-sm leading-relaxed font-sans w-full p-6 sm:p-10 rounded-2xl shadow-xs transition-transform duration-100 origin-top pointer-events-auto"
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom / 100})`,
              transformOrigin: 'top center',
              marginBottom: zoom > 100 ? `${(zoom - 100) * 8}px` : '0px'
            }}
          >
          
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
            نرجو التكرم بمراجعة الأرقام الموضحة أعلاه ومطابقتها مع قيودكم وسجلاتكم الدفترية، وتأكيد المصادقة بإعادتها إلينا عبر البريد الإلكتروني أو الفاكس خلال (7) أيام عمل من تاريخه. وفي حال وجود أي ملاحظات أو فروقات يرجى إرفاق كشف الحساب المقارن لتسوية الفروقات.
          </p>

          {/* Signatures for Company */}
          <div className="grid grid-cols-2 gap-8 pt-4 pb-4 mb-2 text-xs">
            <div>
              <div className="font-bold text-slate-800">إعداد / قسم الحسابات:</div>
              <div className="mt-8 text-slate-500">التوقيع: .......................................</div>
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-800">المدير المالي والختم الرسمي:</div>
              <div className="mt-8 text-slate-500">التوقيع والختم: .......................................</div>
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
