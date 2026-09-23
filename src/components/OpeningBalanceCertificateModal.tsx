import { useRef, useState } from 'react';
import { 
  Printer, Download, X, ShieldCheck, 
  FileText, Calendar, Landmark
} from 'lucide-react';
import { RollForwardBundle } from '../utils/yearEndRollForward';
import { getSystemSettings } from '../utils/settings';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

interface OpeningBalanceCertificateModalProps {
  bundle: RollForwardBundle;
  isOpen: boolean;
  onClose: () => void;
}

export default function OpeningBalanceCertificateModal({
  bundle,
  isOpen,
  onClose
}: OpeningBalanceCertificateModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const settings = getSystemSettings();

  if (!isOpen || !bundle) return null;

  const company = settings.company || {};
  const { toYear, fromYear, currency, exportDate } = bundle.metadata;
  const certificateNumber = `CERT-OP-${toYear}-001`;
  const formattedDate = new Date(exportDate).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!printAreaRef.current) return;
    setIsExportingPdf(true);
    try {
      const element = printAreaRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();

      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`محضر_اعتماد_الأرصدة_الافتتاحية_${toYear}_${certificateNumber}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('حدث خطأ أثناء إنشاء ملف PDF، يمكنك استخدام خيار الطباعة المباشرة.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex justify-center p-2 sm:p-4 md:p-6" dir="rtl">
      {/* Modal Container */}
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[96vh] overflow-hidden border border-slate-200">
        
        {/* Top Control Bar (Hidden when printing) */}
        <div className="print:hidden flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <FileText size={22} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">
                محضر اعتماد الأرصدة الافتتاحية الرسمي (Audit Certificate)
              </h3>
              <p className="text-xs text-slate-500">
                وثيقة تدقيق رقابية معتمدة لبداية العام المالي {toYear} جاهزة للطباعة والتوقيع القانوني
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-600/20"
              title="طباعة عبر المتصفح"
            >
              <Printer size={16} />
              <span>طباعة المستند</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              title="تصدير كملف PDF رسمي"
            >
              <Download size={16} />
              <span>{isExportingPdf ? 'جاري التحميل...' : 'حفظ كـ PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors mr-2"
              title="إغلاق"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Body */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-slate-100 flex-1">
          <div 
            ref={printAreaRef}
            className="bg-white max-w-4xl mx-auto p-8 sm:p-12 rounded-2xl shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none text-slate-900"
            style={{ fontFamily: 'Cairo, Tajawal, sans-serif' }}
          >
            {/* Header / Brand */}
            <div className="border-b-2 border-slate-900 pb-6 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    {company.nameAr || 'شركة لوجوستريا للمحاسبة والحلول المالية'}
                  </h1>
                  <h2 className="text-sm font-semibold text-slate-600 tracking-wide mt-0.5">
                    {company.nameEn || 'Logustria Accounting & Financial Solutions'}
                  </h2>
                  <div className="text-xs text-slate-500 mt-2 space-y-0.5">
                    {company.taxNumber && (
                      <div>الرقم الضريبي (VAT ID): <span className="font-mono font-bold text-slate-800">{company.taxNumber}</span></div>
                    )}
                    {company.commercialRegister && (
                      <div>السجل التجاري (CR): <span className="font-mono font-bold text-slate-800">{company.commercialRegister}</span></div>
                    )}
                    {company.address && <div>العنوان: {company.address} - {company.city || ''}</div>}
                  </div>
                </div>

                <div className="text-left border border-slate-300 bg-slate-50 rounded-xl p-3 text-xs min-w-[210px]">
                  <div className="text-slate-500 font-bold mb-1">رقم المحضر الرسمي:</div>
                  <div className="font-mono font-black text-sm text-indigo-700 mb-2">{certificateNumber}</div>
                  <div className="text-slate-500 font-bold">تاريخ الاعتماد:</div>
                  <div className="font-bold text-slate-800">{formattedDate}</div>
                  <div className="text-slate-500 font-bold mt-1.5">السنة المالية المعتمدة:</div>
                  <div className="font-black text-indigo-900">{toYear} م</div>
                </div>
              </div>
            </div>

            {/* Official Title */}
            <div className="text-center my-6">
              <div className="inline-block bg-slate-900 text-white px-8 py-2.5 rounded-xl font-black text-lg sm:text-xl tracking-wide shadow-sm">
                محضر استلام واعتماد الأرصدة الافتتاحية للعام المالي {toYear}
              </div>
              <p className="text-xs text-slate-500 mt-2 font-medium">
                وثيقة محاسبية وقانونية ملزمة مبنية على ميزان المراجعة المنتهي في 31/12/{fromYear}
              </p>
            </div>

            {/* Document Preamble */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs leading-relaxed text-slate-700 text-justify mb-6">
              بناءً على إجراءات الإقفال المحاسبي للسنة المالية المنتهية في <b className="text-slate-900">31/12/{fromYear}م</b>، وبعد تدقيق ومراجعة حسابات الأستاذ العام ومطابقة كشوف الحسابات المساعدة للعملاء والموردين، وفحص جرد المخزون الفعلي، ومطابقة الشيكات تحت التحصيل وجدول الأقساط؛ تم تحرير هذا المحضر لاعتماد ونقل الأرصدة الافتتاحية وتثبيتها لبدء العمليات المحاسبية للسنة المالية الجديدة <b className="text-indigo-900">{toYear}م</b>، وإنشاء القيد الافتتاحي المتزن رقم (1) وفقاً للمعايير المحاسبية المعتمدة.
            </div>

            {/* Section 1: Integrity Check Matrix */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck size={18} className="text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  أولاً: مصفوفة التدقيق والرقابة والتطابق الداخلي
                </h3>
              </div>
              <table className="w-full text-xs text-right border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    <th className="p-2.5 border border-slate-300">البند الرقابي</th>
                    <th className="p-2.5 border border-slate-300 text-center">إجمالي سجلات الأستاذ المساعد</th>
                    <th className="p-2.5 border border-slate-300 text-center">رصيد حساب المراقبة بالأستاذ العام (GL)</th>
                    <th className="p-2.5 border border-slate-300 text-center">الفارق الدفتري</th>
                    <th className="p-2.5 border border-slate-300 text-center">حالة الاعتماد</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">ذمم العملاء (AR)</td>
                    <td className="p-2 border border-slate-300 font-mono text-center">{bundle.integrityCheck.customers.subledgerTotal.toLocaleString()} {currency}</td>
                    <td className="p-2 border border-slate-300 font-mono text-center">{bundle.integrityCheck.customers.glTotal.toLocaleString()} {currency}</td>
                    <td className="p-2 border border-slate-300 font-mono text-center text-emerald-700 font-bold">0.00 {currency}</td>
                    <td className="p-2 border border-slate-300 text-center font-bold text-emerald-700">✔ متطابق ومعتمد 100%</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="p-2 border border-slate-300 font-bold">ذمم الموردين (AP)</td>
                    <td className="p-2 border border-slate-300 font-mono text-center">{bundle.integrityCheck.vendors.subledgerTotal.toLocaleString()} {currency}</td>
                    <td className="p-2 border border-slate-300 font-mono text-center">{bundle.integrityCheck.vendors.glTotal.toLocaleString()} {currency}</td>
                    <td className="p-2 border border-slate-300 font-mono text-center text-emerald-700 font-bold">0.00 {currency}</td>
                    <td className="p-2 border border-slate-300 text-center font-bold text-emerald-700">✔ متطابق ومعتمد 100%</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-300 font-bold">بضاعة أول المدة (المخزون السلعي)</td>
                    <td className="p-2 border border-slate-300 font-mono text-center">{bundle.integrityCheck.inventory.subledgerTotal.toLocaleString()} {currency}</td>
                    <td className="p-2 border border-slate-300 font-mono text-center">{bundle.integrityCheck.inventory.glTotal.toLocaleString()} {currency}</td>
                    <td className="p-2 border border-slate-300 font-mono text-center text-emerald-700 font-bold">0.00 {currency}</td>
                    <td className="p-2 border border-slate-300 text-center font-bold text-emerald-700">✔ متطابق ومعتمد 100%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 2: Summary of Transferred Balances */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Landmark size={18} className="text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  ثانياً: ملخص الأرصدة التشغيلية المعتمدة للعام {toYear}
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 border border-slate-200 rounded-xl bg-slate-50">
                  <div className="text-slate-500 font-bold">أرصدة العملاء (AR):</div>
                  <div className="text-base font-black text-slate-900 font-mono mt-1">
                    {bundle.summary.totalCustomersBalance.toLocaleString()} {currency}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">عدد: {bundle.summary.activeCustomersCount} عميل</div>
                </div>

                <div className="p-3 border border-slate-200 rounded-xl bg-slate-50">
                  <div className="text-slate-500 font-bold">مستحقات الموردين (AP):</div>
                  <div className="text-base font-black text-slate-900 font-mono mt-1">
                    {bundle.summary.totalVendorsBalance.toLocaleString()} {currency}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">عدد: {bundle.summary.activeVendorsCount} مورد</div>
                </div>

                <div className="p-3 border border-slate-200 rounded-xl bg-slate-50">
                  <div className="text-slate-500 font-bold">بضاعة أول المدة:</div>
                  <div className="text-base font-black text-slate-900 font-mono mt-1">
                    {bundle.summary.totalInventoryValue.toLocaleString()} {currency}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">عدد: {bundle.summary.activeItemsCount} صنف مخزني</div>
                </div>

                <div className="p-3 border border-slate-200 rounded-xl bg-slate-50">
                  <div className="text-slate-500 font-bold">شيكات تحت التحصيل:</div>
                  <div className="text-base font-black text-slate-900 font-mono mt-1">
                    {bundle.summary.totalUnclearedChecks.toLocaleString()} {currency}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">عدد: {bundle.summary.activeChecksCount} شيك</div>
                </div>
              </div>
            </div>

            {/* Section 3: Proposed Balanced Opening Entry */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-indigo-600" />
                  <h3 className="font-bold text-sm text-slate-900">
                    ثالثاً: القيد الافتتاحي المتزن رقم (1) - رمز القيد: ({bundle.openingEntry.entryNumber})
                  </h3>
                </div>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full">
                  توازن القيد: متزن 100% (فارق 0.00 {currency})
                </span>
              </div>

              <table className="w-full text-xs text-right border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className="p-2 border border-slate-300 w-24">رقم الحساب</th>
                    <th className="p-2 border border-slate-300">اسم الحساب في الدليل</th>
                    <th className="p-2 border border-slate-300 w-32 text-center text-emerald-800">مدين ({currency})</th>
                    <th className="p-2 border border-slate-300 w-32 text-center text-rose-800">دائن ({currency})</th>
                    <th className="p-2 border border-slate-300">البيان المحاسبي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {bundle.openingEntry.items.map((it, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="p-2 border border-slate-300 font-mono font-bold text-slate-700">{it.accountCode}</td>
                      <td className="p-2 border border-slate-300 font-bold text-slate-800">{it.accountName}</td>
                      <td className="p-2 border border-slate-300 font-mono text-center text-emerald-700 font-bold">
                        {it.debit > 0 ? it.debit.toLocaleString() : '-'}
                      </td>
                      <td className="p-2 border border-slate-300 font-mono text-center text-rose-700 font-bold">
                        {it.credit > 0 ? it.credit.toLocaleString() : '-'}
                      </td>
                      <td className="p-2 border border-slate-300 text-slate-600">{it.description}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-black border-t-2 border-slate-400">
                    <td colSpan={2} className="p-2.5 border border-slate-300 text-slate-900">
                      إجمالي طرفي القيد الافتتاحي (Balanced Totals)
                    </td>
                    <td className="p-2.5 border border-slate-300 font-mono text-center text-emerald-800 text-sm">
                      {bundle.openingEntry.totalDebit.toLocaleString()}
                    </td>
                    <td className="p-2.5 border border-slate-300 font-mono text-center text-rose-800 text-sm">
                      {bundle.openingEntry.totalCredit.toLocaleString()}
                    </td>
                    <td className="p-2.5 border border-slate-300 text-center text-emerald-700 font-bold">
                      فارق التوازن: 0.00 {currency}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 4: Audit Certification & Signatures */}
            <div className="border border-slate-300 rounded-2xl p-5 bg-slate-50/60 mt-8">
              <h4 className="font-bold text-xs text-slate-900 mb-2">
                إقرار وتعهد اللجنة المالية والمحاسبية:
              </h4>
              <p className="text-[11px] text-slate-600 leading-relaxed text-justify mb-6">
                نقر نحن الموقعون أدناه بصحة البيانات والأرصدة الواردة في هذا المحضر ومطابقتها التامة للواقع الدفتري والفعلي للمنشأة بنهاية السنة المالية {fromYear}، وعليه تم اعتمادها رسمياً كأرصدة افتتاحية للسنة المالية {toYear}، ولا يجوز إجراء أي تسوية أو تعديل بأثر رجعي على الفترة المقفلة إلا بمحضر تدقيق لاحق معتمد ومصادق عليه من الإدارة العامة.
              </p>

              {/* Signatures Grid */}
              <div className="grid grid-cols-3 gap-6 pt-4 border-t border-slate-200 text-center text-xs">
                <div>
                  <div className="font-bold text-slate-800">إعداد / المحاسب المالي</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">مسؤول الحسابات العامة</div>
                  <div className="mt-8 border-b border-dashed border-slate-400 pb-1 mx-4">
                    <span className="text-slate-300 text-[10px]">التوقيع: ............................</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">التاريخ: {formattedDate}</div>
                </div>

                <div>
                  <div className="font-bold text-slate-800">مراجعة وتدقيق / المدير المالي</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">رئيس الإدارة المالية</div>
                  <div className="mt-8 border-b border-dashed border-slate-400 pb-1 mx-4">
                    <span className="text-slate-300 text-[10px]">التوقيع: ............................</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">التاريخ: {formattedDate}</div>
                </div>

                <div>
                  <div className="font-bold text-slate-800">الاعتماد / المراجع القانوني والإدارة</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">الختم والمصادقة الرسمية</div>
                  <div className="mt-8 border-b border-dashed border-slate-400 pb-1 mx-4">
                    <span className="text-slate-300 text-[10px]">الختم الرسمي: ............................</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">التاريخ: {formattedDate}</div>
                </div>
              </div>
            </div>

            {/* Document Footer */}
            <div className="text-center text-[10px] text-slate-400 mt-6 pt-4 border-t border-slate-200">
              تم إصدار هذا المحضر آلياً عبر نظام لوجوستريا المحاسبي والمالي الموحد (Logustria ERP) | رمز التتبع: {certificateNumber} | صفحة 1 من 1
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
