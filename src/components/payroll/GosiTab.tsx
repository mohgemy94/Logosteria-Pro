import React, { useState } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  CheckCircle2, 
  Edit3, 
  X, 
  DollarSign, 
  Users
} from 'lucide-react';
import { Employee } from '../../types/payroll';
import { saveStoredEmployees } from '../../data/mockPayroll';

interface GosiTabProps {
  employees: Employee[];
  currency: string;
  onRefresh: () => void;
}

export default function GosiTab({ employees, currency, onRefresh }: GosiTabProps) {
  const [editingEmpGosi, setEditingEmpGosi] = useState<Employee | null>(null);

  // Compute GOSI stats
  let totalWageBase = 0;
  let totalEmployeeShare = 0;
  let totalEmployerShare = 0;

  const gosiRows = employees.map(emp => {
    const isSubscribed = emp.gosiSubscription !== false; // default true
    const isSaudi = emp.nationalityType === 'SAUDI';
    const wageBase = emp.basicSalary + (emp.housingAllowance || 0);

    const empPercent = emp.gosiEmployeePercent !== undefined 
      ? emp.gosiEmployeePercent 
      : (isSaudi ? 9.75 : 0);

    const companyPercent = emp.gosiCompanyPercent !== undefined 
      ? emp.gosiCompanyPercent 
      : (isSaudi ? 11.75 : 2.0);

    const empShare = isSubscribed ? Math.round((wageBase * empPercent) / 100) : 0;
    const companyShare = isSubscribed ? Math.round((wageBase * companyPercent) / 100) : 0;
    const totalContribution = empShare + companyShare;

    if (isSubscribed) {
      totalWageBase += wageBase;
      totalEmployeeShare += empShare;
      totalEmployerShare += companyShare;
    }

    return {
      emp,
      isSubscribed,
      isSaudi,
      wageBase,
      empPercent,
      companyPercent,
      empShare,
      companyShare,
      totalContribution
    };
  });

  const totalGosiDue = totalEmployeeShare + totalEmployerShare;

  const handleUpdateGosi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmpGosi) return;

    const updated = employees.map(e => e.id === editingEmpGosi.id ? editingEmpGosi : e);
    saveStoredEmployees(updated);
    setEditingEmpGosi(null);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="text-emerald-600" size={22} />
            <span>نظام واحتساب التأمينات الاجتماعية (GOSI)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            توزيع اشتراكات التأمينات وساند، حصة الموظف (المستقطعة)، وحصة المنشأة (المتحملة)
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-slate-400 mb-1">
            <span className="text-xs font-bold text-slate-600">وعاء الأجر الخاضع للاشتراك</span>
            <Users size={18} className="text-blue-600" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">
            {totalWageBase.toLocaleString()} <span className="text-xs font-normal text-slate-500">{currency}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">الأساسي + بدل السكن</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs">
          <div className="flex justify-between items-center text-rose-600 mb-1">
            <span className="text-xs font-bold text-rose-800">حصة الموظفين (المستقطعة)</span>
            <DollarSign size={18} />
          </div>
          <div className="text-xl font-bold font-mono text-rose-700">
            {totalEmployeeShare.toLocaleString()} <span className="text-xs font-normal text-rose-600">{currency}</span>
          </div>
          <div className="text-[11px] text-rose-500 mt-1">تخصم آلياً من صافي الرواتب</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-xs">
          <div className="flex justify-between items-center text-amber-600 mb-1">
            <span className="text-xs font-bold text-amber-800">حصة المنشأة (التزام الشركة)</span>
            <Building2 size={18} />
          </div>
          <div className="text-xl font-bold font-mono text-amber-700">
            {totalEmployerShare.toLocaleString()} <span className="text-xs font-normal text-amber-600">{currency}</span>
          </div>
          <div className="text-[11px] text-amber-600 mt-1">تسددها المنشأة للتأمينات</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs">
          <div className="flex justify-between items-center text-emerald-600 mb-1">
            <span className="text-xs font-bold text-emerald-800">إجمالي فاتورة التأمينات</span>
            <ShieldCheck size={18} />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-700">
            {totalGosiDue.toLocaleString()} <span className="text-xs font-normal text-emerald-600">{currency}</span>
          </div>
          <div className="text-[11px] text-emerald-600 mt-1">المبلغ الإجمالي المستحق للسداد</div>
        </div>
      </div>

      {/* Rules Notice */}
      <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 text-xs text-blue-900 leading-relaxed">
        <span className="font-bold block mb-1">النسب النظامية المعتمدة في المملكة العربية السعودية:</span>
        <ul className="list-disc list-inside space-y-1 text-[11px] text-blue-800">
          <li><strong>الموظف السعودي:</strong> يستقطع 9.75% (9% معاشات + 0.75% ساند)، وتتحمل المنشأة 11.75% (9% معاشات + 2% أخطار مهنية + 0.75% ساند).</li>
          <li><strong>الموظف غير السعودي:</strong> لا يستقطع شيء من الموظف (0%)، وتتحمل المنشأة 2% (فرع الأخطار المهنية).</li>
        </ul>
      </div>

      {/* GOSI Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3.5">الموظف</th>
                <th className="p-3.5">الجنسية</th>
                <th className="p-3.5">الاشتراك</th>
                <th className="p-3.5">وعاء الاشتراك الخاضع</th>
                <th className="p-3.5">نسبة واستقطاع الموظف</th>
                <th className="p-3.5">نسبة وتحمل المنشأة</th>
                <th className="p-3.5 font-bold text-emerald-800">إجمالي المساهمة</th>
                <th className="p-3.5 text-center">تعديل الإعداد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {gosiRows.map(row => (
                <tr key={row.emp.id} className="hover:bg-slate-50/70">
                  <td className="p-3.5">
                    <div className="font-bold text-slate-900">{row.emp.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{row.emp.code} - {row.emp.jobTitle}</div>
                  </td>
                  <td className="p-3.5">
                    {row.isSaudi ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        سعودي
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                        مقيم (غير سعودي)
                      </span>
                    )}
                  </td>
                  <td className="p-3.5">
                    {row.isSubscribed ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                        <CheckCircle2 size={13} />
                        مشترك
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium">غير مسجل</span>
                    )}
                  </td>
                  <td className="p-3.5 font-mono font-bold text-slate-800">
                    {row.wageBase.toLocaleString()} {currency}
                  </td>
                  <td className="p-3.5 font-mono">
                    <div className="font-bold text-rose-600">-{row.empShare.toLocaleString()} {currency}</div>
                    <div className="text-[10px] text-slate-400 font-sans">({row.empPercent}%)</div>
                  </td>
                  <td className="p-3.5 font-mono">
                    <div className="font-bold text-amber-700">+{row.companyShare.toLocaleString()} {currency}</div>
                    <div className="text-[10px] text-slate-400 font-sans">({row.companyPercent}%)</div>
                  </td>
                  <td className="p-3.5 font-mono font-bold text-emerald-700 text-sm">
                    {row.totalContribution.toLocaleString()} {currency}
                  </td>
                  <td className="p-3.5 text-center">
                    <button
                      type="button"
                      onClick={() => setEditingEmpGosi(row.emp)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-b from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all shadow-2xs border border-slate-300 border-b-2 border-b-slate-400 active:translate-y-0.5 cursor-pointer mx-auto"
                    >
                      <Edit3 size={13} className="text-slate-600" />
                      <span>تخصيص</span>
                    </button>
                  </td>
                </tr>
              ))}

              {gosiRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    لا يوجد موظفون مسجلون
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: EDIT GOSI SETTINGS FOR EMPLOYEE */}
      {editingEmpGosi && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">إعدادات التأمينات للموظف</h3>
                  <p className="text-[11px] text-slate-400">{editingEmpGosi.name} ({editingEmpGosi.code})</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingEmpGosi(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateGosi} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">نوع الجنسية:</label>
                <select
                  value={editingEmpGosi.nationalityType || 'NON_SAUDI'}
                  onChange={(e) => {
                    const nat = e.target.value as 'SAUDI' | 'NON_SAUDI';
                    setEditingEmpGosi({
                      ...editingEmpGosi,
                      nationalityType: nat,
                      gosiEmployeePercent: nat === 'SAUDI' ? 9.75 : 0,
                      gosiCompanyPercent: nat === 'SAUDI' ? 11.75 : 2.0
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="SAUDI">سعودي الجنسية (تأمينات + ساند)</option>
                  <option value="NON_SAUDI">مقيم / وافد غير سعودي (أخطار مهنية فقط)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="gosi-sub-chk"
                  checked={editingEmpGosi.gosiSubscription !== false}
                  onChange={(e) => setEditingEmpGosi({
                    ...editingEmpGosi,
                    gosiSubscription: e.target.checked
                  })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <label htmlFor="gosi-sub-chk" className="text-xs font-bold text-slate-700 cursor-pointer">
                  تفعيل استقطاع واشتراك التأمينات الاجتماعية للموظف
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">نسبة استقطاع الموظف (%):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingEmpGosi.gosiEmployeePercent ?? (editingEmpGosi.nationalityType === 'SAUDI' ? 9.75 : 0)}
                    onChange={(e) => setEditingEmpGosi({
                      ...editingEmpGosi,
                      gosiEmployeePercent: Number(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">نسبة مساهمة المنشأة (%):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingEmpGosi.gosiCompanyPercent ?? (editingEmpGosi.nationalityType === 'SAUDI' ? 11.75 : 2.0)}
                    onChange={(e) => setEditingEmpGosi({
                      ...editingEmpGosi,
                      gosiCompanyPercent: Number(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEmpGosi(null)}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 border-b-2 border-b-slate-300 text-slate-700 rounded-xl font-bold transition-all shadow-xs active:translate-y-0.5 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white rounded-xl font-bold transition-all shadow-md shadow-emerald-700/30 border-b-[3px] border-emerald-900 active:border-b active:translate-y-0.5 cursor-pointer"
                >
                  حفظ الإعدادات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
