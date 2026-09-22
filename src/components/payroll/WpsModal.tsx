import { useState } from 'react';
import { 
  Download, 
  X, 
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { PayrollRecord } from '../../types/payroll';
import { exportWpsPayrollCsv } from '../../utils/wpsExport';

interface WpsModalProps {
  payrollRecords: PayrollRecord[];
  monthStr: string;
  currency: string;
  onClose: () => void;
}

export default function WpsModal({ 
  payrollRecords, 
  monthStr, 
  currency, 
  onClose 
}: WpsModalProps) {
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('ALL');

  // Banks list
  const banks = Array.from(new Set(payrollRecords.map(r => r.bankName || 'مصرف الراجحي')));

  const filteredRecords = payrollRecords.filter(rec => {
    if (selectedBankFilter === 'ALL') return true;
    return (rec.bankName || 'مصرف الراجحي') === selectedBankFilter;
  });

  const totalEmployees = filteredRecords.length;
  const totalNetSalary = filteredRecords.reduce((s, r) => s + r.netSalary, 0);
  const totalDeductions = filteredRecords.reduce((s, r) => s + r.deductionsAmount, 0);

  const handleExport = () => {
    exportWpsPayrollCsv(filteredRecords, monthStr);
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-t-3xl sm:rounded-3xl max-w-4xl w-full p-4 sm:p-6 md:p-8 shadow-2xl border border-slate-200 max-h-[92vh] sm:max-h-[90vh] flex flex-col animate-modalIn text-right overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Mobile Handle */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

        {/* Header (Fixed) */}
        <div className="flex justify-between items-center pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                تصدير ملف حماية الأجور والتحويل البنكي (WPS / SARI)
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate sm:overflow-visible sm:whitespace-normal">
                متوافق مع منصة مدد، نظام حماية الأجور السعودي، والتحويلات البنكية السريعة
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto flex-1 pr-0.5 space-y-4">
          {/* Stats summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 p-3.5 sm:p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 text-xs">
            <div>
              <span className="text-emerald-700 block text-[11px] font-medium">عدد الموظفين في الملف:</span>
              <span className="text-base sm:text-lg font-bold font-mono text-emerald-950">{totalEmployees} موظف</span>
            </div>
            <div>
              <span className="text-emerald-700 block text-[11px] font-medium">إجمالي الرواتب الأساسية:</span>
              <span className="text-base sm:text-lg font-bold font-mono text-emerald-950">
                {filteredRecords.reduce((s, r) => s + r.basicSalary, 0).toLocaleString()} {currency}
              </span>
            </div>
            <div>
              <span className="text-emerald-700 block text-[11px] font-medium">إجمالي الاستقطاعات:</span>
              <span className="text-base sm:text-lg font-bold font-mono text-rose-700">
                {totalDeductions.toLocaleString()} {currency}
              </span>
            </div>
            <div>
              <span className="text-emerald-700 block text-[11px] font-medium">صافي الحوالات البنكية:</span>
              <span className="text-base sm:text-lg font-bold font-mono text-emerald-700">
                {totalNetSalary.toLocaleString()} {currency}
              </span>
            </div>
          </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-600">تصفية حسب البنك:</span>
            <select
              value={selectedBankFilter}
              onChange={(e) => setSelectedBankFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="ALL">جميع البنوك المعتمدة ({payrollRecords.length})</option>
              {banks.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="text-xs font-mono text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
            شهر الاستحقاق: <span className="font-bold text-slate-900">{monthStr}</span>
          </div>
        </div>

        {/* Preview Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden mb-6">
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
                <tr>
                  <th className="p-3">كود</th>
                  <th className="p-3">اسم الموظف</th>
                  <th className="p-3">الهوية / الإقامة</th>
                  <th className="p-3">البنك</th>
                  <th className="p-3">الآيبان (IBAN)</th>
                  <th className="p-3">الأساسي</th>
                  <th className="p-3">البدلات</th>
                  <th className="p-3">الخصم/السلف</th>
                  <th className="p-3 font-bold text-emerald-800">صافي المحول</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map(rec => (
                  <tr key={rec.id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-mono font-bold text-blue-700">{rec.employeeCode}</td>
                    <td className="p-3 font-medium text-slate-900">{rec.employeeName}</td>
                    <td className="p-3 font-mono text-slate-600">{rec.nationalId || '—'}</td>
                    <td className="p-3 text-slate-600">{rec.bankName || 'مصرف الراجحي'}</td>
                    <td className="p-3 font-mono text-[11px] dir-ltr text-slate-600 truncate max-w-[140px]" title={rec.iban}>
                      {rec.iban || '—'}
                    </td>
                    <td className="p-3 font-mono">{rec.basicSalary.toLocaleString()}</td>
                    <td className="p-3 font-mono">+{rec.totalAllowances.toLocaleString()}</td>
                    <td className="p-3 font-mono text-rose-600">-{rec.deductionsAmount.toLocaleString()}</td>
                    <td className="p-3 font-mono font-bold text-emerald-700">{rec.netSalary.toLocaleString()} {currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>

        {/* Modal Actions (Sticky Footer) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span className="text-[11px] sm:text-xs">يتم توليد الملف بصيغة UTF-8 BOM الداعمة للغة العربية في برامج المحاسبة والإكسل مباشرة.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 border-b-2 border-b-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs active:translate-y-0.5 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-700/25 border-b-[3px] border-emerald-900 active:border-b active:translate-y-0.5 cursor-pointer"
            >
              <Download size={16} className="text-emerald-100" />
              <span>تحميل ملف حماية الأجور (CSV / WPS)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
