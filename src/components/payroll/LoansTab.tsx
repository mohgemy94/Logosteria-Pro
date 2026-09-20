import React, { useState } from 'react';
import { 
  CreditCard, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  X, 
  Receipt,
  User,
  DollarSign
} from 'lucide-react';
import { Employee, LoanAdvance, LoanInstallment } from '../../types/payroll';
import { 
  getStoredLoans, 
  saveStoredLoans, 
  generateLoanSchedule 
} from '../../data/mockPayroll';

interface LoansTabProps {
  employees: Employee[];
  currency: string;
  onRefresh: () => void;
}

export default function LoansTab({ employees, currency, onRefresh }: LoansTabProps) {
  const [loans, setLoans] = useState<LoanAdvance[]>(() => getStoredLoans());
  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false);
  const [selectedLoanForSchedule, setSelectedLoanForSchedule] = useState<LoanAdvance | null>(null);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'PAID'>('ALL');
  const [searchEmp, setSearchEmp] = useState('');

  // New Loan Form State
  const [newLoanData, setNewLoanData] = useState({
    employeeId: '',
    amount: 5000,
    installmentsCount: 5,
    startMonth: new Date().toISOString().slice(0, 7), // "YYYY-MM"
    disbursementDate: new Date().toISOString().slice(0, 10),
    disbursementAccount: 'الصندوق الرئيسي - الخزينة',
    reason: 'سلفة شخصية طارئة',
    notes: ''
  });

  const refreshLoans = () => {
    const updated = getStoredLoans();
    setLoans(updated);
    onRefresh();
  };

  const handleCreateLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === newLoanData.employeeId);
    if (!emp) return;

    const loanId = `loan-${Date.now()}`;
    const schedule = generateLoanSchedule(
      loanId,
      Number(newLoanData.amount),
      Number(newLoanData.installmentsCount),
      newLoanData.startMonth
    );

    const monthly = schedule[0]?.amount ?? Math.round(Number(newLoanData.amount) / Number(newLoanData.installmentsCount));

    const newLoan: LoanAdvance = {
      id: loanId,
      loanNumber: `LN-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeCode: emp.code,
      amount: Number(newLoanData.amount),
      disbursementDate: newLoanData.disbursementDate,
      installmentsCount: Number(newLoanData.installmentsCount),
      monthlyInstallment: monthly,
      startMonth: newLoanData.startMonth,
      paidAmount: 0,
      remainingAmount: Number(newLoanData.amount),
      status: 'ACTIVE',
      reason: newLoanData.reason,
      disbursementAccount: newLoanData.disbursementAccount,
      installments: schedule,
      notes: newLoanData.notes
    };

    const updatedLoans = [newLoan, ...loans];
    saveStoredLoans(updatedLoans);
    setLoans(updatedLoans);
    setIsAddLoanOpen(false);
    refreshLoans();

    // Reset Form
    setNewLoanData({
      employeeId: '',
      amount: 5000,
      installmentsCount: 5,
      startMonth: new Date().toISOString().slice(0, 7),
      disbursementDate: new Date().toISOString().slice(0, 10),
      disbursementAccount: 'الصندوق الرئيسي - الخزينة',
      reason: 'سلفة شخصية طارئة',
      notes: ''
    });
  };

  const handleToggleInstallmentStatus = (loanId: string, installmentId: string) => {
    const updatedLoans: LoanAdvance[] = loans.map(loan => {
      if (loan.id !== loanId) return loan;

      const updatedInstallments: LoanInstallment[] = loan.installments.map(inst => {
        if (inst.id !== installmentId) return inst;
        const newStatus: 'PAID' | 'PENDING' = inst.status === 'PAID' ? 'PENDING' : 'PAID';
        const updatedInst: LoanInstallment = {
          ...inst,
          status: newStatus,
          paidDate: newStatus === 'PAID' ? new Date().toISOString().slice(0, 10) : undefined
        };
        return updatedInst;
      });

      const totalPaid = updatedInstallments
        .filter(i => i.status === 'PAID')
        .reduce((sum, i) => sum + i.amount, 0);

      const remaining = Math.max(0, loan.amount - totalPaid);
      const loanStatus: 'PAID' | 'ACTIVE' = remaining === 0 ? 'PAID' : 'ACTIVE';

      const updatedLoan: LoanAdvance = {
        ...loan,
        installments: updatedInstallments,
        paidAmount: totalPaid,
        remainingAmount: remaining,
        status: loanStatus
      };
      return updatedLoan;
    });

    saveStoredLoans(updatedLoans);
    setLoans(updatedLoans);
    if (selectedLoanForSchedule && selectedLoanForSchedule.id === loanId) {
      setSelectedLoanForSchedule(updatedLoans.find(l => l.id === loanId) || null);
    }
    refreshLoans();
  };

  const handleDeleteLoan = (loanId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه السلفة بالكامل؟')) return;
    const updated = loans.filter(l => l.id !== loanId);
    saveStoredLoans(updated);
    setLoans(updated);
    if (selectedLoanForSchedule?.id === loanId) {
      setSelectedLoanForSchedule(null);
    }
    refreshLoans();
  };

  const handleSettleFullLoan = (loanId: string) => {
    if (!window.confirm('هل تريد تسوية وإغلاق كامل مبلغ السلفة دفعة واحدة؟')) return;
    const updatedLoans = loans.map(loan => {
      if (loan.id !== loanId) return loan;
      return {
        ...loan,
        paidAmount: loan.amount,
        remainingAmount: 0,
        status: 'PAID' as const,
        installments: loan.installments.map(i => ({
          ...i,
          status: 'PAID' as const,
          paidDate: i.paidDate || new Date().toISOString().slice(0, 10)
        }))
      };
    });

    saveStoredLoans(updatedLoans);
    setLoans(updatedLoans);
    if (selectedLoanForSchedule?.id === loanId) {
      setSelectedLoanForSchedule(updatedLoans.find(l => l.id === loanId) || null);
    }
    refreshLoans();
  };

  // KPIs
  const totalLoaned = loans.reduce((s, l) => s + l.amount, 0);
  const totalPaid = loans.reduce((s, l) => s + l.paidAmount, 0);
  const totalRemaining = loans.reduce((s, l) => s + l.remainingAmount, 0);
  const activeLoansCount = loans.filter(l => l.status === 'ACTIVE').length;

  const filteredLoans = loans.filter(l => {
    const matchStatus = filterStatus === 'ALL' || l.status === filterStatus;
    const matchSearch = l.employeeName.toLowerCase().includes(searchEmp.toLowerCase()) ||
                        l.employeeCode.toLowerCase().includes(searchEmp.toLowerCase()) ||
                        l.loanNumber.toLowerCase().includes(searchEmp.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="text-blue-600" size={22} />
            <span>نظام سلف وقروض الموظفين والجدولة الشهرية</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            صرف السلف، إنشاء جداول الأقساط تلقائياً، والخصم المباشر من مسير الرواتب الشهري
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddLoanOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-600/25 border-b-[3.5px] border-amber-900 active:border-b active:translate-y-[2.5px] cursor-pointer"
        >
          <Plus size={16} className="text-amber-100" />
          <span>صرف سلفة جديدة لموظف</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-slate-400 mb-1">
            <span className="text-xs font-bold text-slate-600">إجمالي مبالغ السلف</span>
            <DollarSign size={18} className="text-amber-600" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">
            {totalLoaned.toLocaleString()} <span className="text-xs font-normal text-slate-500">{currency}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">إجمالي ما تم صرفه للموظفين</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs">
          <div className="flex justify-between items-center text-emerald-600 mb-1">
            <span className="text-xs font-bold text-emerald-800">الأقساط المسددة</span>
            <CheckCircle2 size={18} />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-700">
            {totalPaid.toLocaleString()} <span className="text-xs font-normal text-emerald-600">{currency}</span>
          </div>
          <div className="text-[11px] text-emerald-600 mt-1">تم تحصيله وخصمه من الرواتب</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-xs">
          <div className="flex justify-between items-center text-amber-600 mb-1">
            <span className="text-xs font-bold text-amber-800">المتبقي للتحصيل</span>
            <Clock size={18} />
          </div>
          <div className="text-xl font-bold font-mono text-amber-700">
            {totalRemaining.toLocaleString()} <span className="text-xs font-normal text-amber-600">{currency}</span>
          </div>
          <div className="text-[11px] text-amber-600 mt-1">أرصدة سلف قائمة ومستحقة</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-xs">
          <div className="flex justify-between items-center text-blue-600 mb-1">
            <span className="text-xs font-bold text-blue-800">السلف الجارية</span>
            <User size={18} />
          </div>
          <div className="text-xl font-bold font-mono text-blue-700">
            {activeLoansCount} <span className="text-xs font-normal text-blue-600">سلفة سارية</span>
          </div>
          <div className="text-[11px] text-blue-500 mt-1">من إجمالي {loans.length} سلفة مسجلة</div>
        </div>
      </div>

      {/* 3D Filter Tabs & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="p-1 bg-slate-100 rounded-xl border border-slate-200/80 shadow-inner flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterStatus === 'ALL' 
                ? 'bg-gradient-to-b from-slate-700 to-slate-900 text-white shadow-xs border-b-2 border-slate-950 active:translate-y-0.5' 
                : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 border-b-2 border-b-slate-300 shadow-2xs hover:bg-slate-50'
            }`}
          >
            الكل ({loans.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterStatus === 'ACTIVE' 
                ? 'bg-gradient-to-b from-amber-500 to-amber-700 text-white shadow-xs border-b-2 border-amber-900 active:translate-y-0.5' 
                : 'bg-white text-amber-800 hover:text-amber-900 border border-amber-200 border-b-2 border-b-amber-300 shadow-2xs hover:bg-amber-50'
            }`}
          >
            سارية ({loans.filter(l => l.status === 'ACTIVE').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('PAID')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterStatus === 'PAID' 
                ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-xs border-b-2 border-emerald-900 active:translate-y-0.5' 
                : 'bg-white text-emerald-800 hover:text-emerald-900 border border-emerald-200 border-b-2 border-b-emerald-300 shadow-2xs hover:bg-emerald-50'
            }`}
          >
            مسددة بالكامل ({loans.filter(l => l.status === 'PAID').length})
          </button>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="بحث باسم الموظف أو رقم السلفة..."
            value={searchEmp}
            onChange={(e) => setSearchEmp(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 bg-white"
          />
        </div>
      </div>

      {/* Loans Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3.5">رقم السلفة</th>
                <th className="p-3.5">الموظف المستفيد</th>
                <th className="p-3.5">تاريخ الصرف</th>
                <th className="p-3.5">إجمالي السلفة</th>
                <th className="p-3.5">القسط الشهري</th>
                <th className="p-3.5">نسبة السداد</th>
                <th className="p-3.5">المتبقي</th>
                <th className="p-3.5">الحالة</th>
                <th className="p-3.5 text-center">جدول الأقساط والتحكم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLoans.map(loan => {
                const progressPct = loan.amount > 0 ? Math.min(100, Math.round((loan.paidAmount / loan.amount) * 100)) : 0;
                return (
                  <tr key={loan.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-amber-700">
                      {loan.loanNumber}
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{loan.employeeName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{loan.employeeCode} - {loan.reason}</div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">
                      {loan.disbursementDate}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-slate-900">
                      {loan.amount.toLocaleString()} {currency}
                    </td>
                    <td className="p-3.5 font-mono font-medium text-slate-700">
                      {loan.monthlyInstallment.toLocaleString()} {currency} / شهر
                      <span className="text-[10px] text-slate-400 block font-sans">({loan.installmentsCount} أقساط)</span>
                    </td>
                    <td className="p-3.5 w-36">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <span>{loan.paidAmount.toLocaleString()}</span>
                        <span className="font-bold">{progressPct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            loan.status === 'PAID' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-amber-700">
                      {loan.remainingAmount.toLocaleString()} {currency}
                    </td>
                    <td className="p-3.5">
                      {loan.status === 'PAID' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={12} />
                          مسددة بالكامل
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock size={12} />
                          سارية ومجدولة
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedLoanForSchedule(loan)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs border-b-2 border-amber-900 active:border-b active:translate-y-0.5 cursor-pointer"
                        >
                          <Receipt size={14} className="text-amber-100" />
                          <span>عرض الأقساط ({loan.installments.filter(i => i.status === 'PAID').length}/{loan.installments.length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLoan(loan.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                          title="حذف السلفة"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredLoans.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    لا توجد سلف أو قروض مسجلة حالياً
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD NEW LOAN */}
      {isAddLoanOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">صرف سلفة مالية جديدة لموظف</h3>
                  <p className="text-[11px] text-slate-400">تحديد مبلغ السلفة وعدد الأقساط والجدولة التلقائية</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsAddLoanOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateLoan} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">الموظف المستفيد:</label>
                <select
                  required
                  value={newLoanData.employeeId}
                  onChange={(e) => setNewLoanData({...newLoanData, employeeId: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="">اختر الموظف...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.code} - الراتب الأساسي: {emp.basicSalary} {currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">إجمالي مبلغ السلفة ({currency}):</label>
                  <input
                    type="number"
                    required
                    min={100}
                    value={newLoanData.amount}
                    onChange={(e) => setNewLoanData({...newLoanData, amount: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold text-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">عدد الأقساط الشهرية:</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={60}
                    value={newLoanData.installmentsCount}
                    onChange={(e) => setNewLoanData({...newLoanData, installmentsCount: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Installment preview calculation banner */}
              <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-100 flex items-center justify-between">
                <span className="text-blue-900 font-medium text-[11px]">قيمة القسط الشهري المحسوبة:</span>
                <span className="font-mono font-bold text-blue-700 text-sm">
                  {Math.round(Number(newLoanData.amount) / Math.max(1, Number(newLoanData.installmentsCount))).toLocaleString()} {currency} / شهر
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">شهر بدء الخصم (YYYY-MM):</label>
                  <input
                    type="month"
                    required
                    value={newLoanData.startMonth}
                    onChange={(e) => setNewLoanData({...newLoanData, startMonth: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">تاريخ صرف السلفة:</label>
                  <input
                    type="date"
                    required
                    value={newLoanData.disbursementDate}
                    onChange={(e) => setNewLoanData({...newLoanData, disbursementDate: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">الخزينة / الحساب المنصرف منه:</label>
                <select
                  value={newLoanData.disbursementAccount}
                  onChange={(e) => setNewLoanData({...newLoanData, disbursementAccount: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                >
                  <option value="الصندوق الرئيسي - الخزينة">الصندوق الرئيسي - الخزينة</option>
                  <option value="حساب مصرف الراجحي">حساب مصرف الراجحي</option>
                  <option value="حساب البنك الأهلي التجاري">حساب البنك الأهلي التجاري</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">سبب أو نوع السلفة:</label>
                <input
                  type="text"
                  required
                  placeholder="سلفة شخصية، علاجية، زواج، طارئة..."
                  value={newLoanData.reason}
                  onChange={(e) => setNewLoanData({...newLoanData, reason: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddLoanOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 border-b-2 border-b-slate-300 text-slate-700 rounded-xl font-bold transition-all shadow-xs active:translate-y-0.5 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white rounded-xl font-bold transition-all shadow-md shadow-amber-600/30 border-b-[3px] border-amber-900 active:border-b active:translate-y-0.5 cursor-pointer"
                >
                  اعتماد وجدولة السلفة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW & MANAGE INSTALLMENTS SCHEDULE */}
      {selectedLoanForSchedule && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-b from-amber-500 to-amber-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    جدول أقساط السلفة ({selectedLoanForSchedule.loanNumber})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    الموظف: {selectedLoanForSchedule.employeeName} ({selectedLoanForSchedule.employeeCode})
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedLoanForSchedule(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Loan Header info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs mb-4">
              <div>
                <span className="text-slate-400 block text-[10px]">إجمالي السلفة:</span>
                <span className="font-mono font-bold text-slate-900">{selectedLoanForSchedule.amount.toLocaleString()} {currency}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">المسدد:</span>
                <span className="font-mono font-bold text-emerald-600">{selectedLoanForSchedule.paidAmount.toLocaleString()} {currency}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">المتبقي:</span>
                <span className="font-mono font-bold text-amber-700">{selectedLoanForSchedule.remainingAmount.toLocaleString()} {currency}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">حساب الصرف:</span>
                <span className="font-medium text-slate-700 truncate block">{selectedLoanForSchedule.disbursementAccount}</span>
              </div>
            </div>

            {/* Installments Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden mb-4">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="p-3">رقم القسط</th>
                    <th className="p-3">شهر الاستحقاق</th>
                    <th className="p-3">مبلغ القسط</th>
                    <th className="p-3">حالة السداد</th>
                    <th className="p-3 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedLoanForSchedule.installments.map((inst) => (
                    <tr key={inst.id} className="hover:bg-slate-50/70">
                      <td className="p-3 font-mono font-bold">
                        القسط #{inst.installmentNumber}
                      </td>
                      <td className="p-3 font-mono">
                        {inst.month}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">
                        {inst.amount.toLocaleString()} {currency}
                      </td>
                      <td className="p-3">
                        {inst.status === 'PAID' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={12} />
                            تم السداد {inst.paidDate ? `(${inst.paidDate})` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock size={12} />
                            قيد الاستحقاق (سيخصم من الراتب)
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleInstallmentStatus(selectedLoanForSchedule.id, inst.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
                            inst.status === 'PAID' 
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 border-b-2 border-b-rose-300 active:translate-y-0.5' 
                              : 'bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white border-b-2 border-emerald-800 active:border-b active:translate-y-0.5'
                          }`}
                        >
                          {inst.status === 'PAID' ? 'إلغاء السداد' : 'تسجيل السداد'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions in Modal */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => handleSettleFullLoan(selectedLoanForSchedule.id)}
                disabled={selectedLoanForSchedule.status === 'PAID'}
                className="px-4 py-2.5 bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-md shadow-emerald-700/25 border-b-[3px] border-emerald-900 active:border-b active:translate-y-0.5 cursor-pointer"
              >
                تسوية وإغلاق كامل السلفة الآن
              </button>

              <button
                type="button"
                onClick={() => setSelectedLoanForSchedule(null)}
                className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 border-b-2 border-b-slate-300 text-slate-700 rounded-xl font-bold transition-all shadow-xs active:translate-y-0.5 cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
