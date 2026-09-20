import React, { useState } from 'react';
import { 
  Calculator, 
  FileText, 
  Printer, 
  Plus, 
  CheckCircle2, 
  Trash2, 
  X, 
  AlertCircle
} from 'lucide-react';
import { Employee, EndOfServiceSettlement, LoanAdvance } from '../../types/payroll';
import { 
  getStoredSettlements, 
  saveStoredSettlements, 
  getStoredLoans, 
  calculateGratuity 
} from '../../data/mockPayroll';
import { getSystemSettings } from '../../utils/settings';

interface EndOfServiceTabProps {
  employees: Employee[];
  currency: string;
  onRefresh: () => void;
}

export default function EndOfServiceTab({ employees, currency, onRefresh }: EndOfServiceTabProps) {
  const [systemSettings] = useState(() => getSystemSettings());
  const [settlements, setSettlements] = useState<EndOfServiceSettlement[]>(() => getStoredSettlements());
  const [loans] = useState<LoanAdvance[]>(() => getStoredLoans());
  const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);
  const [selectedSettlementForPrint, setSelectedSettlementForPrint] = useState<EndOfServiceSettlement | null>(null);

  // Form State
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [terminationDate, setTerminationDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState<'RESIGNATION' | 'TERMINATION_BY_EMPLOYER' | 'CONTRACT_EXPIRED' | 'FORCE_MAJEURE'>('CONTRACT_EXPIRED');
  const [unusedVacationDays, setUnusedVacationDays] = useState(15);
  const [otherBenefits, setOtherBenefits] = useState(0);
  const [otherDeductions, setOtherDeductions] = useState(0);
  const [notes, setNotes] = useState('');

  const selectedEmp = employees.find(e => e.id === selectedEmpId);
  const joinDate = selectedEmp ? selectedEmp.joinDate : new Date().toISOString().slice(0, 10);
  const basicSalary = selectedEmp ? selectedEmp.basicSalary : 0;
  const allowances = selectedEmp ? ((selectedEmp.housingAllowance || 0) + (selectedEmp.transportAllowance || 0) + (selectedEmp.foodAllowance || 0) + (selectedEmp.otherAllowances || 0)) : 0;

  // Outstanding loans of the employee
  const employeeActiveLoans = loans.filter(l => l.employeeId === selectedEmpId && l.status === 'ACTIVE');
  const totalOutstandingLoanAmount = employeeActiveLoans.reduce((s, l) => s + l.remainingAmount, 0);

  // Gratuity calculation
  const gratuityResult = calculateGratuity(
    basicSalary,
    allowances,
    joinDate,
    terminationDate,
    reason,
    unusedVacationDays
  );

  const netPayable = Math.max(
    0,
    gratuityResult.finalGratuity +
    gratuityResult.vacationCompensation +
    Number(otherBenefits) -
    totalOutstandingLoanAmount -
    Number(otherDeductions)
  );

  const handleSaveSettlement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;

    const newSettlement: EndOfServiceSettlement = {
      id: `eos-${Date.now()}`,
      settlementNumber: `EOS-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      employeeId: selectedEmp.id,
      employeeName: selectedEmp.name,
      employeeCode: selectedEmp.code,
      joinDate: selectedEmp.joinDate,
      terminationDate,
      serviceDuration: {
        years: gratuityResult.years,
        months: gratuityResult.months,
        days: gratuityResult.days,
        totalDays: gratuityResult.totalDays
      },
      reason,
      reasonLabel: gratuityResult.reasonLabel,
      lastBasicSalary: basicSalary,
      lastAllowances: allowances,
      lastTotalSalary: basicSalary + allowances,
      serviceGratuityAmount: gratuityResult.finalGratuity,
      unusedVacationDays,
      unusedVacationAmount: gratuityResult.vacationCompensation,
      otherBenefits: Number(otherBenefits),
      outstandingLoansDeduction: totalOutstandingLoanAmount,
      otherDeductions: Number(otherDeductions),
      netSettlementAmount: netPayable,
      status: 'APPROVED',
      paymentDate: new Date().toISOString().slice(0, 10),
      notes
    };

    const updated = [newSettlement, ...settlements];
    saveStoredSettlements(updated);
    setSettlements(updated);
    setIsCalculatorModalOpen(false);
    setSelectedSettlementForPrint(newSettlement);
    onRefresh();
  };

  const handleDeleteSettlement = (id: string) => {
    if (!window.confirm('هل تريد حذف هذه التصفية؟')) return;
    const updated = settlements.filter(s => s.id !== id);
    saveStoredSettlements(updated);
    setSettlements(updated);
    if (selectedSettlementForPrint?.id === id) {
      setSelectedSettlementForPrint(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="text-teal-600" size={22} />
            <span>حاسبة وتصفية مستحقات نهاية الخدمة (نظام العمل السعودي)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            احتساب مكافأة نهاية الخدمة، رصيد الإجازات، وتسوية السلف وإصدار المخالصات النهائية
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCalculatorModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-b from-teal-500 via-teal-600 to-teal-700 hover:from-teal-600 hover:to-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-600/25 border-b-[3.5px] border-teal-900 active:border-b active:translate-y-[2.5px] cursor-pointer"
        >
          <Plus size={16} className="text-teal-100" />
          <span>احتساب وتصفية موظف جديد</span>
        </button>
      </div>

      {/* Saudi Labor Law Rule Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-xs">
          <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5 text-teal-700">
            <CheckCircle2 size={16} />
            <span>المادة 84 (إنهاء العقد من صاحب العمل)</span>
          </div>
          <p className="text-slate-500 text-[11px] leading-relaxed">
            أجر نصف شهر عن كل سنة من السنوات الخمس الأولى، وأجر شهر كامل عن كل سنة من السنوات التالية.
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-xs">
          <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5 text-amber-700">
            <CheckCircle2 size={16} />
            <span>المادة 85 (استقالة الموظف)</span>
          </div>
          <p className="text-slate-500 text-[11px] leading-relaxed">
            أقل من سنتين: لا شيء | 2 - 5 سنوات: ثلث المكافأة | 5 - 10 سنوات: ثلثا المكافأة | 10+ سنوات: المكافأة كاملة.
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-xs">
          <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5 text-blue-700">
            <CheckCircle2 size={16} />
            <span>المادة 87 (حالات الاستحقاق الكامل)</span>
          </div>
          <p className="text-slate-500 text-[11px] leading-relaxed">
            استحقاق المكافأة كاملة في حالة انتهاء مدة العقد المحدد أو ترك العمل لسبب مشروع أو قوة قاهرة.
          </p>
        </div>
      </div>

      {/* Settlements Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <span className="font-bold text-slate-800 text-xs">سجل مخالصات وتصفيات نهاية الخدمة المعتمدة</span>
          <span className="text-xs font-mono text-slate-500">العدد: {settlements.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3.5">رقم المخالصة</th>
                <th className="p-3.5">الموظف</th>
                <th className="p-3.5">مدة الخدمة</th>
                <th className="p-3.5">سبب الانتهاء</th>
                <th className="p-3.5">مكافأة نهاية الخدمة</th>
                <th className="p-3.5">بدل الإجازات</th>
                <th className="p-3.5">خصم السلف</th>
                <th className="p-3.5 font-bold text-teal-800">صافي المستحق</th>
                <th className="p-3.5 text-center">الطباعة والمستند</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {settlements.map(s => (
                <tr key={s.id} className="hover:bg-slate-50/70">
                  <td className="p-3.5 font-mono font-bold text-teal-700">{s.settlementNumber}</td>
                  <td className="p-3.5">
                    <div className="font-bold text-slate-900">{s.employeeName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{s.employeeCode}</div>
                  </td>
                  <td className="p-3.5 font-mono text-slate-700">
                    {s.serviceDuration.years} سنة و {s.serviceDuration.months} شهر
                  </td>
                  <td className="p-3.5 text-slate-600 font-medium">{s.reasonLabel}</td>
                  <td className="p-3.5 font-mono text-slate-900">{s.serviceGratuityAmount.toLocaleString()} {currency}</td>
                  <td className="p-3.5 font-mono text-slate-600">+{s.unusedVacationAmount.toLocaleString()}</td>
                  <td className="p-3.5 font-mono text-rose-600">-{s.outstandingLoansDeduction.toLocaleString()}</td>
                  <td className="p-3.5 font-mono font-bold text-teal-700 text-sm">
                    {s.netSettlementAmount.toLocaleString()} {currency}
                  </td>
                  <td className="p-3.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedSettlementForPrint(s)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-b from-teal-500 via-teal-600 to-teal-700 hover:from-teal-600 hover:to-teal-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs border-b-2 border-teal-900 active:border-b active:translate-y-0.5 cursor-pointer"
                      >
                        <Printer size={14} className="text-teal-100" />
                        <span>طباعة المخالصة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSettlement(s.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {settlements.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    لا توجد تصفيات نهاية خدمة مسجلة بعد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: CALCULATOR & NEW SETTLEMENT */}
      {isCalculatorModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                  <Calculator size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">احتساب تصفية ومكافأة نهاية الخدمة</h3>
                  <p className="text-[11px] text-slate-400">حساب آلي دقيق متطابق مع مواد نظام العمل السعودي</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsCalculatorModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSettlement} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">الموظف المراد تصفيته:</label>
                <select
                  required
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-medium"
                >
                  <option value="">اختر الموظف...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.code} - تاريخ المباشرة: {emp.joinDate})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">سبب انتهاء العلاقة التعاقدية:</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-medium"
                  >
                    <option value="CONTRACT_EXPIRED">انتهاء مدة العقد المحددة (مكافأة كاملة)</option>
                    <option value="TERMINATION_BY_EMPLOYER">فسخ العقد من صاحب العمل (مكافأة كاملة)</option>
                    <option value="RESIGNATION">استقالة بمبادرة الموظف (تخضع لنسب المدد)</option>
                    <option value="FORCE_MAJEURE">ترك العمل لظرف قاهر أو سبب مشروع</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">تاريخ نهاية الخدمة والعمل:</label>
                  <input
                    type="date"
                    required
                    value={terminationDate}
                    onChange={(e) => setTerminationDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>

              {/* Service & Salary Calculation Details */}
              {selectedEmp && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center text-slate-700">
                    <div className="p-2 bg-white rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">مدة الخدمة الإجمالية</span>
                      <span className="font-mono font-bold text-teal-800 text-xs">
                        {gratuityResult.years} سنة و {gratuityResult.months} شهر و {gratuityResult.days} يوم
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">آخر راتب فعلي شامل</span>
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        {(basicSalary + allowances).toLocaleString()} {currency}
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">نسبة الاستحقاق النظامية</span>
                      <span className="font-mono font-bold text-amber-700 text-xs">
                        {Math.round(gratuityResult.entitlementRatio * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">رصيد الإجازات المتبقي (أيام):</label>
                      <input
                        type="number"
                        min={0}
                        value={unusedVacationDays}
                        onChange={(e) => setUnusedVacationDays(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-bold mb-1">مستحقات أو مكافآت أخرى:</label>
                      <input
                        type="number"
                        min={0}
                        value={otherBenefits}
                        onChange={(e) => setOtherBenefits(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-bold mb-1">استقطاعات أخرى:</label>
                      <input
                        type="number"
                        min={0}
                        value={otherDeductions}
                        onChange={(e) => setOtherDeductions(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Active Loans Deduction Warning */}
                  {totalOutstandingLoanAmount > 0 && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between text-amber-900">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle size={16} className="text-amber-600" />
                        <span>سيتم خصم رصيد السلف القائمة على الموظف تلقائياً:</span>
                      </div>
                      <span className="font-mono font-bold text-amber-800">
                        -{totalOutstandingLoanAmount.toLocaleString()} {currency}
                      </span>
                    </div>
                  )}

                  {/* Net Result Summary */}
                  <div className="p-3 bg-teal-800 text-white rounded-xl flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-[11px] text-teal-200 block">صافي مبلغ التصفية والمخالصة المستحق صرفه:</span>
                      <span className="text-xs font-bold text-teal-100">
                        مكافأة: {gratuityResult.finalGratuity.toLocaleString()} + إجازات: {gratuityResult.vacationCompensation.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xl font-bold font-mono">
                      {netPayable.toLocaleString()} <span className="text-xs font-normal text-teal-200">{currency}</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-600 font-bold mb-1">ملاحظات إضافية على المخالصة:</label>
                <input
                  type="text"
                  placeholder="ملاحظات التسليم والمخالصة..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCalculatorModalOpen(false)}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 border-b-2 border-b-slate-300 text-slate-700 rounded-xl font-bold transition-all shadow-xs active:translate-y-0.5 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!selectedEmp}
                  className="px-5 py-2.5 bg-gradient-to-b from-teal-500 via-teal-600 to-teal-700 hover:from-teal-600 hover:to-teal-800 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-md shadow-teal-600/30 border-b-[3px] border-teal-900 active:border-b active:translate-y-0.5 cursor-pointer"
                >
                  اعتماد التصفية وإصدار المخالصة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PRINTABLE SETTLEMENT & CLEARANCE SHEET */}
      {selectedSettlementForPrint && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[95vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:p-0">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-200 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="text-teal-600" size={20} />
                <span className="font-bold text-slate-900 text-sm">مستند تصفية ومخالصة نهاية الخدمة</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-b from-teal-500 via-teal-600 to-teal-700 hover:from-teal-600 hover:to-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs border-b-2 border-teal-900 active:border-b active:translate-y-0.5 cursor-pointer"
                >
                  <Printer size={14} className="text-teal-100" />
                  <span>طباعة المخالصة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSettlementForPrint(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/40 text-xs space-y-5 print:border-none print:bg-transparent print:p-0">
              {/* Header */}
              <div className="text-center pb-4 border-b-2 border-slate-800">
                <h2 className="text-xl font-bold font-diwani text-slate-900">{systemSettings.company.nameAr}</h2>
                <div className="text-sm font-bold text-teal-800 mt-1">مستند إقرار مخالصة وتصفية مستحقات نهاية خدمة</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">رقم السجل: {selectedSettlementForPrint.settlementNumber}</div>
              </div>

              {/* Employee Info Grid */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-white rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px]">اسم الموظف:</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedSettlementForPrint.employeeName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">الرقم الوظيفي:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedSettlementForPrint.employeeCode}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">تاريخ المباشرة:</span>
                  <span className="font-mono text-slate-800">{selectedSettlementForPrint.joinDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">تاريخ نهاية الخدمة:</span>
                  <span className="font-mono text-slate-800">{selectedSettlementForPrint.terminationDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">إجمالي مدة الخدمة:</span>
                  <span className="font-mono font-bold text-teal-800">
                    {selectedSettlementForPrint.serviceDuration.years} سنة و {selectedSettlementForPrint.serviceDuration.months} شهر و {selectedSettlementForPrint.serviceDuration.days} يوم
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">سبب إنهاء العلاقة التعاقدية:</span>
                  <span className="font-medium text-slate-800">{selectedSettlementForPrint.reasonLabel}</span>
                </div>
              </div>

              {/* Financial Calculation Breakdown */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">بيان المستحقات والاستقطاعات</th>
                      <th className="p-2.5 text-left">المبلغ ({currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2.5">مكافأة نهاية الخدمة النظامية المستحقة (نظام العمل السعودي)</td>
                      <td className="p-2.5 font-mono font-bold text-emerald-700 text-left">
                        +{selectedSettlementForPrint.serviceGratuityAmount.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5">بدل رصيد الإجازات السنوية غير المستنفذة ({selectedSettlementForPrint.unusedVacationDays} يوم)</td>
                      <td className="p-2.5 font-mono text-slate-700 text-left">
                        +{selectedSettlementForPrint.unusedVacationAmount.toLocaleString()}
                      </td>
                    </tr>
                    {selectedSettlementForPrint.otherBenefits > 0 && (
                      <tr>
                        <td className="p-2.5">مستحقات ومكافآت أخرى</td>
                        <td className="p-2.5 font-mono text-slate-700 text-left">
                          +{selectedSettlementForPrint.otherBenefits.toLocaleString()}
                        </td>
                      </tr>
                    )}
                    {selectedSettlementForPrint.outstandingLoansDeduction > 0 && (
                      <tr>
                        <td className="p-2.5 text-rose-700">استقطاع رصيد السلف والقروض المتبقية للمنشأة (-)</td>
                        <td className="p-2.5 font-mono font-bold text-rose-700 text-left">
                          -{selectedSettlementForPrint.outstandingLoansDeduction.toLocaleString()}
                        </td>
                      </tr>
                    )}
                    {selectedSettlementForPrint.otherDeductions > 0 && (
                      <tr>
                        <td className="p-2.5 text-rose-700">استقطاعات أخرى (-)</td>
                        <td className="p-2.5 font-mono font-bold text-rose-700 text-left">
                          -{selectedSettlementForPrint.otherDeductions.toLocaleString()}
                        </td>
                      </tr>
                    )}
                    <tr className="bg-teal-50/80 font-bold text-teal-950">
                      <td className="p-3 text-sm">صافي المبلغ المستحق صرفه للموظف (Net Settlement)</td>
                      <td className="p-3 font-mono text-base text-teal-800 text-left">
                        {selectedSettlementForPrint.netSettlementAmount.toLocaleString()} {currency}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Clearance Text & Legal Acknowledgment */}
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
                <span className="font-bold text-slate-800 block mb-1">إقرار ومخالصة نهائية تامة:</span>
                أقر أنا الموقع أدناه (<span className="font-bold text-slate-900">{selectedSettlementForPrint.employeeName}</span>) بأنني استلمت كافة مستحقاتي النظامية والمالية من رواتب وبدلات ومكافأة نهاية خدمة وبدل إجازات، ولا يحق لي مطالبة المنشأة بأي التزام مالي أو قانوني لاحقاً، وهذا إقرار وإبراء ذمة نهائي مني بذلك.
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-300 text-center text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] mb-8">اعتماد إدارة الموارد البشرية والمالية:</span>
                  <div className="border-t border-slate-300 pt-1 font-bold">المدير العام / المسؤول المالي</div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] mb-8">توقيع وإقرار الموظف المقر بما فيه:</span>
                  <div className="border-t border-slate-300 pt-1 font-bold">{selectedSettlementForPrint.employeeName}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
