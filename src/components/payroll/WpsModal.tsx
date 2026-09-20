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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                تصدير ملف حماية الأجور والتحويل البنكي (WPS / SARI)
              </h3>
              <p className="text-xs text-slate-500">
                متوافق مع منصة مدد، نظام حماية الأجور السعودي، والتحويلات البنكية السريعة
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 mb-5 text-xs">
          <div>
            <span className="text-emerald-700 block text-[11px] font-medium">عدد الموظفين في الملف:</span>
            <span className="text-lg font-bold font-mono text-emerald-950">{totalEmployees} موظف</span>
          </div>
          <div>
            <span className="text-emerald-700 block text-[11px] font-medium">إجمالي الرواتب الأساسية:</span>
            <span className="text-lg font-bold font-mono text-emerald-950">
              {filteredRecords.reduce((s, r) => s + r.basicSalary, 0).toLocaleString()} {currency}
            </span>
          </div>
          <div>
            <span className="text-emerald-700 block text-[11px] font-medium">إجمالي الاستقطاعات:</span>
            <span className="text-lg font-bold font-mono text-rose-700">
              {totalDeductions.toLocaleString()} {currency}
            </span>
          </div>
          <div>
            <span className="text-emerald-700 block text-[11px] font-medium">صافي الحوالات البنكية:</span>
            <span className="text-lg font-bold font-mono text-emerald-700">
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

        {/* Modal Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>يتم توليد الملف بصيغة UTF-8 BOM الداعمة للغة العربية في برامج المحاسبة والإكسل مباشرة.</span>
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
