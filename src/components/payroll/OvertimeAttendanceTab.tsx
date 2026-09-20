import React, { useState } from 'react';
import { 
  Clock, 
  Plus, 
  Trash2, 
  X, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { Employee, AttendanceOvertimeRecord, BonusIncentive, DeductionItem } from '../../types/payroll';
import { 
  getStoredAttendanceRecords, 
  saveStoredAttendanceRecords, 
  saveStoredEmployees 
} from '../../data/mockPayroll';

interface OvertimeAttendanceTabProps {
  employees: Employee[];
  currency: string;
  selectedMonth?: string;
  onRefresh: () => void;
}

export default function OvertimeAttendanceTab({
  employees,
  currency,
  onRefresh
}: OvertimeAttendanceTabProps) {
  const [records, setRecords] = useState<AttendanceOvertimeRecord[]>(() => getStoredAttendanceRecords());
  const [isOpenAddModal, setIsOpenAddModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'OVERTIME' | 'ABSENCE' | 'DELAY'>('ALL');

  // New Record Form State
  const [formData, setFormData] = useState({
    employeeId: '',
    date: new Date().toISOString().slice(0, 10),
    type: 'OVERTIME' as 'OVERTIME' | 'ABSENCE' | 'DELAY',
    overtimeType: 'NORMAL' as 'NORMAL' | 'HOLIDAY', // 1.5x vs 2.0x
    hoursOrDays: 2,
    notes: ''
  });

  const selectedEmp = employees.find(e => e.id === formData.employeeId);

  // Hourly and daily rate calculation according to Saudi Labor Law:
  // Base for hourly rate = (Basic + Housing) / 240 hrs (30 days * 8 hrs)
  const hourlyRate = selectedEmp 
    ? (selectedEmp.basicSalary + (selectedEmp.housingAllowance || 0)) / 240
    : 0;

  const dailyRate = selectedEmp 
    ? (selectedEmp.basicSalary + (selectedEmp.housingAllowance || 0) + (selectedEmp.transportAllowance || 0)) / 30
    : 0;

  let computedAmount = 0;
  let multiplier = 1.0;

  if (formData.type === 'OVERTIME') {
    multiplier = formData.overtimeType === 'HOLIDAY' ? 2.0 : 1.5;
    computedAmount = Math.round(formData.hoursOrDays * hourlyRate * multiplier);
  } else if (formData.type === 'ABSENCE') {
    computedAmount = Math.round(formData.hoursOrDays * dailyRate);
  } else if (formData.type === 'DELAY') {
    computedAmount = Math.round(formData.hoursOrDays * hourlyRate);
  }

  const handleCreateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;

    const newRecord: AttendanceOvertimeRecord = {
      id: `att-${Date.now()}`,
      employeeId: selectedEmp.id,
      employeeName: selectedEmp.name,
      date: formData.date,
      type: formData.type,
      hoursOrDays: Number(formData.hoursOrDays),
      multiplier: formData.type === 'OVERTIME' ? multiplier : 1.0,
      calculatedAmount: computedAmount,
      status: 'PENDING',
      month: formData.date.slice(0, 7),
      notes: formData.notes
    };

    const updated = [newRecord, ...records];
    saveStoredAttendanceRecords(updated);
    setRecords(updated);
    setIsOpenAddModal(false);

    // Reset Form
    setFormData({
      employeeId: '',
      date: new Date().toISOString().slice(0, 10),
      type: 'OVERTIME',
      overtimeType: 'NORMAL',
      hoursOrDays: 2,
      notes: ''
    });
  };

  // Direct Apply to Employee Payroll
  const handleApplyToPayroll = (record: AttendanceOvertimeRecord) => {
    const emp = employees.find(e => e.id === record.employeeId);
    if (!emp) return;

    let updatedEmp = { ...emp };

    if (record.type === 'OVERTIME') {
      const bonusItem: BonusIncentive = {
        id: `bonus-ot-${Date.now()}`,
        type: 'OVERTIME',
        typeName: `ساعات عمل إضافية (${record.hoursOrDays} ساعة × ${record.multiplier}x)`,
        amount: record.calculatedAmount,
        date: record.date,
        reason: record.notes || 'ساعات عمل إضافية معتمدة',
        status: 'APPROVED'
      };
      updatedEmp.bonuses = [...(updatedEmp.bonuses || []), bonusItem];
    } else {
      const isAbsence = record.type === 'ABSENCE';
      const deductionItem: DeductionItem = {
        id: `ded-att-${Date.now()}`,
        type: isAbsence ? 'ABSENCE' : 'DELAY',
        typeName: isAbsence 
          ? `خصم غياب (${record.hoursOrDays} يوم)` 
          : `خصم تأخيرات (${record.hoursOrDays} ساعة)`,
        amount: record.calculatedAmount,
        date: record.date,
        reason: record.notes || (isAbsence ? 'غياب بدون عذر' : 'تأخير متراكم'),
        status: 'APPLIED'
      };
      updatedEmp.deductions = [...(updatedEmp.deductions || []), deductionItem];
    }

    // Update employees in storage
    const updatedEmployees = employees.map(e => e.id === emp.id ? updatedEmp : e);
    saveStoredEmployees(updatedEmployees);

    // Update attendance record status
    const updatedRecords = records.map(r => 
      r.id === record.id ? { ...r, status: 'APPLIED_TO_PAYROLL' as const } : r
    );
    saveStoredAttendanceRecords(updatedRecords);
    setRecords(updatedRecords);
    onRefresh();
  };

  const handleDeleteRecord = (id: string) => {
    const updated = records.filter(r => r.id !== id);
    saveStoredAttendanceRecords(updated);
    setRecords(updated);
  };

  // Filtered
  const filteredRecords = records.filter(r => {
    if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
    return true;
  });

  const totalOvertimeHours = records.filter(r => r.type === 'OVERTIME').reduce((s, r) => s + r.hoursOrDays, 0);
  const totalOvertimeAmount = records.filter(r => r.type === 'OVERTIME').reduce((s, r) => s + r.calculatedAmount, 0);
  const totalAbsenceDays = records.filter(r => r.type === 'ABSENCE').reduce((s, r) => s + r.hoursOrDays, 0);
  const totalAbsenceAmount = records.filter(r => r.type === 'ABSENCE' || r.type === 'DELAY').reduce((s, r) => s + r.calculatedAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock className="text-indigo-600" size={22} />
            <span>حاسبة وسجل العمل الإضافي، التأخيرات، والغياب</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            احتساب أجر ساعة الإضافي (150% - 200%) والخصومات والغياب وترحيلها مباشرة لكشف الرواتب
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpenAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          <Plus size={16} />
          <span>تسجيل إضافي / غياب جديد</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-xs">
          <div className="flex justify-between items-center text-indigo-600 mb-1">
            <span className="text-xs font-bold text-indigo-900">ساعات العمل الإضافي</span>
            <TrendingUp size={18} />
          </div>
          <div className="text-xl font-bold font-mono text-indigo-700">
            {totalOvertimeHours} <span className="text-xs font-normal text-indigo-500">ساعة</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            المستحق: <span className="font-bold text-indigo-950 font-mono">+{totalOvertimeAmount.toLocaleString()} {currency}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs">
          <div className="flex justify-between items-center text-rose-600 mb-1">
            <span className="text-xs font-bold text-rose-900">إجمالي أيام الغياب</span>
            <TrendingDown size={18} />
          </div>
          <div className="text-xl font-bold font-mono text-rose-700">
            {totalAbsenceDays} <span className="text-xs font-normal text-rose-500">أيام</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            المخصوم: <span className="font-bold text-rose-950 font-mono">-{totalAbsenceAmount.toLocaleString()} {currency}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-slate-400 mb-1">
            <span className="text-xs font-bold text-slate-600">معادلة العمل الإضافي</span>
            <Clock size={18} className="text-slate-600" />
          </div>
          <div className="text-sm font-bold text-slate-800 mt-1">
            1.5x الأيام العادية / 2.0x العطلات
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">وفق المادة 107 من نظام العمل السعودي</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-slate-400 mb-1">
            <span className="text-xs font-bold text-slate-600">حالات بانتظار الترحيل</span>
            <AlertTriangle size={18} className="text-amber-500" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-600">
            {records.filter(r => r.status === 'PENDING').length} <span className="text-xs font-normal text-slate-500">حالة معلقة</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">جاهزة للترحيل لمسير الراتب</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => setTypeFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            typeFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          الكل ({records.length})
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter('OVERTIME')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            typeFilter === 'OVERTIME' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
          }`}
        >
          عمل إضافي ({records.filter(r => r.type === 'OVERTIME').length})
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter('ABSENCE')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            typeFilter === 'ABSENCE' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
          }`}
        >
          غياب ({records.filter(r => r.type === 'ABSENCE').length})
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter('DELAY')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            typeFilter === 'DELAY' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}
        >
          تأخير ({records.filter(r => r.type === 'DELAY').length})
        </button>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3.5">الموظف</th>
                <th className="p-3.5">التاريخ والشهر</th>
                <th className="p-3.5">النوع</th>
                <th className="p-3.5">المدة / الساعات</th>
                <th className="p-3.5">المعامل</th>
                <th className="p-3.5">المبلغ المحسوب</th>
                <th className="p-3.5">حالة الترحيل للراتب</th>
                <th className="p-3.5 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map(rec => (
                <tr key={rec.id} className="hover:bg-slate-50/70">
                  <td className="p-3.5 font-bold text-slate-900">
                    {rec.employeeName}
                  </td>
                  <td className="p-3.5 font-mono text-slate-600">
                    {rec.date} <span className="text-[10px] text-slate-400">({rec.month})</span>
                  </td>
                  <td className="p-3.5">
                    {rec.type === 'OVERTIME' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <TrendingUp size={12} />
                        عمل إضافي
                      </span>
                    ) : rec.type === 'ABSENCE' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <TrendingDown size={12} />
                        غياب غير مدفوع
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock size={12} />
                        تأخير
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 font-mono font-bold text-slate-800">
                    {rec.hoursOrDays} {rec.type === 'ABSENCE' ? 'أيام' : 'ساعات'}
                  </td>
                  <td className="p-3.5 font-mono text-slate-600">
                    {rec.type === 'OVERTIME' ? `${rec.multiplier}x` : '1.0x'}
                  </td>
                  <td className="p-3.5 font-mono font-bold">
                    <span className={rec.type === 'OVERTIME' ? 'text-indigo-700' : 'text-rose-600'}>
                      {rec.type === 'OVERTIME' ? '+' : '-'}{rec.calculatedAmount.toLocaleString()} {currency}
                    </span>
                  </td>
                  <td className="p-3.5">
                    {rec.status === 'APPLIED_TO_PAYROLL' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={12} />
                        مرحل لكشف الراتب
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock size={12} />
                        بانتظار الاعتماد
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {rec.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => handleApplyToPayroll(rec)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          <span>ترحيل للراتب</span>
                          <ArrowRight size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteRecord(rec.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    لا توجد سجلات إضافي أو غياب مسجلة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD OVERTIME / ABSENCE */}
      {isOpenAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">تسجيل عمل إضافي أو غياب / تأخير</h3>
                  <p className="text-[11px] text-slate-400">احتساب القيمة تلقائياً طبقاً للراتب ولائحة العمل</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsOpenAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">الموظف:</label>
                <select
                  required
                  value={formData.employeeId}
                  onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="">اختر الموظف...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.code} - الراتب: {emp.basicSalary + emp.housingAllowance} {currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">نوع السجل:</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({
                      ...formData, 
                      type: e.target.value as 'OVERTIME' | 'ABSENCE' | 'DELAY'
                    })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-bold"
                  >
                    <option value="OVERTIME">عمل إضافي (استحقاق)</option>
                    <option value="ABSENCE">غياب غير مدفوع (خصم)</option>
                    <option value="DELAY">تأخير بالدقائق/الساعات (خصم)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">التاريخ:</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {formData.type === 'OVERTIME' && (
                <div>
                  <label className="block text-slate-600 font-bold mb-1">نوع الإضافي:</label>
                  <select
                    value={formData.overtimeType}
                    onChange={(e) => setFormData({
                      ...formData, 
                      overtimeType: e.target.value as 'NORMAL' | 'HOLIDAY'
                    })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  >
                    <option value="NORMAL">أيام العمل العادية (ساعة ونصف = 1.5x)</option>
                    <option value="HOLIDAY">عطلة رسمية / يوم الجمعة (ساعتان = 2.0x)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-600 font-bold mb-1">
                  {formData.type === 'ABSENCE' ? 'عدد أيام الغياب:' : 'عدد ساعات الإضافي / التأخير:'}
                </label>
                <input
                  type="number"
                  required
                  step={formData.type === 'ABSENCE' ? '0.5' : '1'}
                  min={0.5}
                  value={formData.hoursOrDays}
                  onChange={(e) => setFormData({...formData, hoursOrDays: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono font-bold"
                />
              </div>

              {/* Real-time Calculation Result */}
              {selectedEmp && (
                <div className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-100 flex items-center justify-between">
                  <span className="text-indigo-900 font-medium text-[11px]">
                    {formData.type === 'OVERTIME' ? 'إجمالي أجر الإضافي المستحق:' : 'إجمالي مبلغ الخصم:'}
                  </span>
                  <span className="font-mono font-bold text-indigo-700 text-sm">
                    {formData.type === 'OVERTIME' ? '+' : '-'}{computedAmount.toLocaleString()} {currency}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-slate-600 font-bold mb-1">ملاحظات وسبب التكليف / الغياب:</label>
                <input
                  type="text"
                  placeholder="مثال: تكليف بمشروع الجرد السنوي..."
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpenAddModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-sm cursor-pointer"
                >
                  حفظ السجل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
