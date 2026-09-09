import { useState, useMemo } from 'react';
import { 
  Users, 
  DollarSign, 
  Award, 
  TrendingDown, 
  Plus, 
  Search, 
  FileText, 
  Calendar, 
  CheckCircle2, 
  Phone, 
  CreditCard, 
  X, 
  Eye, 
  Printer, 
  Layers,
  Calculator,
  Edit3,
  Trash2
} from 'lucide-react';
import { Employee, BonusIncentive, DeductionItem, PayrollRecord } from '../types/payroll';
import { 
  getStoredEmployees, 
  saveStoredEmployees, 
  calculateEmployeeTotals, 
  generatePayrollRecords 
} from '../data/mockPayroll';
import { getSystemSettings } from '../utils/settings';
import { useSystemCurrency } from '../utils/currency';
import PrintDropdown from './PrintDropdown';

type TabType = 'employees' | 'payroll' | 'bonuses' | 'allowances' | 'deductions';

export default function PayrollScreen() {
  const [systemSettings] = useState(() => getSystemSettings());
  const [employees, setEmployees] = useState<Employee[]>(() => getStoredEmployees());
  const [activeTab, setActiveTab] = useState<TabType>('payroll');
  const [selectedMonth, setSelectedMonth] = useState('2024-09');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');

  // Modals
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isEditEmployeeOpen, setIsEditEmployeeOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isAddBonusOpen, setIsAddBonusOpen] = useState(false);
  const [isAddDeductionOpen, setIsAddDeductionOpen] = useState(false);
  const [selectedPayslipEmp, setSelectedPayslipEmp] = useState<Employee | null>(null);
  const [journalGeneratedMsg, setJournalGeneratedMsg] = useState<string | null>(null);

  // Form states for adding employee
  const [newEmpData, setNewEmpData] = useState({
    code: `EMP-${Math.floor(100 + Math.random() * 900)}`,
    name: '',
    department: 'المبيعات والتسويق',
    jobTitle: '',
    nationalId: '',
    phone: '',
    email: '',
    joinDate: new Date().toISOString().slice(0, 10),
    bankName: 'مصرف الراجحي',
    iban: 'SA',
    basicSalary: 6000,
    housingAllowance: 1500,
    transportAllowance: 600,
    foodAllowance: 300,
    otherAllowances: 0,
  });

  // Form states for adding bonus/incentive
  const [newBonusData, setNewBonusData] = useState({
    employeeId: '',
    type: 'TARGET_INCENTIVE' as BonusIncentive['type'],
    typeName: 'حافز كسر حاجز المبيعات المستهدف',
    amount: 1500,
    date: new Date().toISOString().slice(0, 10),
    reason: 'تحقيق وتخطي التارجت الشهري بنجاح',
  });

  // Form states for adding deduction
  const [newDeductionData, setNewDeductionData] = useState({
    employeeId: '',
    type: 'ABSENCE' as DeductionItem['type'],
    typeName: 'خصم غياب يوم',
    amount: 250,
    date: new Date().toISOString().slice(0, 10),
    reason: 'غياب بدون عذر مقبول',
  });

  const { symbol: currency } = useSystemCurrency();

  // Distinct departments
  const departments = useMemo(() => {
    const deps = new Set(employees.map(e => e.department));
    return Array.from(deps);
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.nationalId.includes(searchQuery);
      const matchDep = selectedDepartment === 'ALL' || emp.department === selectedDepartment;
      return matchSearch && matchDep;
    });
  }, [employees, searchQuery, selectedDepartment]);

  // Overall calculations across all employees
  const overallStats = useMemo(() => {
    let totalBasic = 0;
    let totalAllowances = 0;
    let totalBonuses = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    employees.forEach(emp => {
      const { totalAllowances: a, totalBonuses: b, totalDeductions: d, netSalary: n } = calculateEmployeeTotals(emp);
      totalBasic += emp.basicSalary;
      totalAllowances += a;
      totalBonuses += b;
      totalDeductions += d;
      totalNet += n;
    });

    return {
      totalEmployees: employees.length,
      totalBasic,
      totalAllowances,
      totalBonuses,
      totalDeductions,
      totalNet
    };
  }, [employees]);

  // Generated payroll records
  const payrollRecords: PayrollRecord[] = useMemo(() => {
    return generatePayrollRecords(filteredEmployees, selectedMonth);
  }, [filteredEmployees, selectedMonth]);

  // Handle Add Employee
  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpData.name.trim()) return;

    const created: Employee = {
      id: `emp-${Date.now()}`,
      code: newEmpData.code || `EMP-${employees.length + 101}`,
      name: newEmpData.name.trim(),
      department: newEmpData.department,
      jobTitle: newEmpData.jobTitle.trim() || 'موظف',
      nationalId: newEmpData.nationalId.trim() || '1000000000',
      phone: newEmpData.phone.trim(),
      email: newEmpData.email.trim(),
      joinDate: newEmpData.joinDate,
      bankName: newEmpData.bankName,
      iban: newEmpData.iban,
      basicSalary: Number(newEmpData.basicSalary) || 0,
      housingAllowance: Number(newEmpData.housingAllowance) || 0,
      transportAllowance: Number(newEmpData.transportAllowance) || 0,
      foodAllowance: Number(newEmpData.foodAllowance) || 0,
      otherAllowances: Number(newEmpData.otherAllowances) || 0,
      status: 'ACTIVE',
      bonuses: [],
      deductions: [
        {
          id: `d-${Date.now()}`,
          type: 'INSURANCE',
          typeName: 'استقطاع التأمينات الاجتماعية (GOSI)',
          amount: Math.round(Number(newEmpData.basicSalary) * 0.1),
          date: new Date().toISOString().slice(0, 10),
          reason: 'حصة الموظف 10%',
          status: 'APPLIED'
        }
      ]
    };

    const updated = [created, ...employees];
    setEmployees(updated);
    saveStoredEmployees(updated);
    setIsAddEmployeeOpen(false);
    // Reset
    setNewEmpData({
      code: `EMP-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      department: 'المبيعات والتسويق',
      jobTitle: '',
      nationalId: '',
      phone: '',
      email: '',
      joinDate: new Date().toISOString().slice(0, 10),
      bankName: 'مصرف الراجحي',
      iban: 'SA',
      basicSalary: 6000,
      housingAllowance: 1500,
      transportAllowance: 600,
      foodAllowance: 300,
      otherAllowances: 0,
    });
  };

  // Handle Edit & Update Employee
  const handleOpenEditEmployee = (emp: Employee) => {
    setEditingEmployee(JSON.parse(JSON.stringify(emp)));
    setIsEditEmployeeOpen(true);
  };

  const handleUpdateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee || !editingEmployee.name.trim()) return;

    const updated = employees.map(emp => emp.id === editingEmployee.id ? editingEmployee : emp);
    setEmployees(updated);
    saveStoredEmployees(updated);
    setIsEditEmployeeOpen(false);
    setEditingEmployee(null);
  };

  // Handle Delete Employee
  const handleDeleteEmployee = (id: string, name: string) => {
    if (confirm(`هل أنت متأكد من رغبتك في حذف الموظف (${name}) نهائياً من قاعدة البيانات ومسيرات الأجور؟`)) {
      const updated = employees.filter(e => e.id !== id);
      setEmployees(updated);
      saveStoredEmployees(updated);
      if (selectedPayslipEmp?.id === id) {
        setSelectedPayslipEmp(null);
      }
    }
  };

  // Handle Add Bonus / Target Incentive
  const handleCreateBonus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBonusData.employeeId || !newBonusData.amount) return;

    const bonus: BonusIncentive = {
      id: `b-${Date.now()}`,
      type: newBonusData.type,
      typeName: newBonusData.typeName,
      amount: Number(newBonusData.amount),
      date: newBonusData.date,
      reason: newBonusData.reason,
      status: 'APPROVED'
    };

    const updated = employees.map(emp => {
      if (emp.id === newBonusData.employeeId) {
        return {
          ...emp,
          bonuses: [bonus, ...(emp.bonuses || [])]
        };
      }
      return emp;
    });

    setEmployees(updated);
    saveStoredEmployees(updated);
    setIsAddBonusOpen(false);
  };

  // Handle Add Deduction
  const handleCreateDeduction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeductionData.employeeId || !newDeductionData.amount) return;

    const deduction: DeductionItem = {
      id: `d-${Date.now()}`,
      type: newDeductionData.type,
      typeName: newDeductionData.typeName,
      amount: Number(newDeductionData.amount),
      date: newDeductionData.date,
      reason: newDeductionData.reason,
      status: 'APPLIED'
    };

    const updated = employees.map(emp => {
      if (emp.id === newDeductionData.employeeId) {
        return {
          ...emp,
          deductions: [deduction, ...(emp.deductions || [])]
        };
      }
      return emp;
    });

    setEmployees(updated);
    saveStoredEmployees(updated);
    setIsAddDeductionOpen(false);
  };

  // Generate Journal Entry
  const handlePostPayrollToJournal = () => {
    const refNum = `PAY-${selectedMonth}-${Math.floor(1000 + Math.random() * 9000)}`;
    setJournalGeneratedMsg(`تم توليد قيد اليومية الآلي بنجاح برقم إسناد [${refNum}] لمسير شهر ${selectedMonth}. تم تحميل حساب مصروف الرواتب والبدلات والمكافآت (مدين: ${(overallStats.totalBasic + overallStats.totalAllowances + overallStats.totalBonuses).toLocaleString()} ${currency})، وقيد الاستقطاعات والرواتب المستحقة للصرف (دائن: ${overallStats.totalNet.toLocaleString()} ${currency}).`);
    setTimeout(() => {
      setJournalGeneratedMsg(null);
    }, 8000);
  };

  return (
    <div className="flex flex-col flex-1 pb-12 print:pb-0" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-4 mb-6 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1 text-slate-500">
            <span className="text-xs uppercase font-bold tracking-tight">الموارد البشرية</span>
            <span className="text-xs">/</span>
            <span className="text-xs uppercase font-bold tracking-tight">الموظفون والأجور والمكافآت والبدلات والخصومات</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 flex items-center gap-2.5">
            <Users className="text-blue-600" size={28} />
            <span>إدارة الموظفين ومسيرات الأجور</span>
          </h2>
          <p className="text-slate-500 mt-1 text-xs sm:text-sm">
            إدارة متكاملة للرواتب الأساسية، البدلات الثابتة، المكافآت وحوافز الإنجاز/الأهداف، الخصومات والاستقطاعات، وقسائم الرواتب.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <PrintDropdown />
          <button
            type="button"
            onClick={() => setIsAddBonusOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors shadow-xs cursor-pointer"
          >
            <Award size={15} className="text-amber-600" />
            <span>+ حافز / مكافأة</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddDeductionOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 text-rose-800 border border-rose-300 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors shadow-xs cursor-pointer"
          >
            <TrendingDown size={15} className="text-rose-600" />
            <span>+ تسجيل خصم</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddEmployeeOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
          >
            <Plus size={16} />
            <span>إضافة موظف جديد</span>
          </button>
        </div>
      </div>

      {/* Confirmation notification banner */}
      {journalGeneratedMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs sm:text-sm flex items-start gap-3 shadow-xs animate-fadeIn">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block mb-0.5">عملية ترحيل قيود الأجور:</span>
            {journalGeneratedMsg}
          </div>
          <button 
            onClick={() => setJournalGeneratedMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Printable Company Header (Visible Only in Print) */}
      <div className="hidden print:block mb-8 border-b-2 border-slate-800 pb-4 text-center">
        <h1 className="text-2xl font-bold font-diwani text-slate-900">{systemSettings.company.nameAr}</h1>
        <p className="text-xs text-slate-600 mt-1">مسير الرواتب والأجور الشهرية - شهر: {selectedMonth}</p>
        <div className="flex justify-between items-center text-[10px] text-slate-500 mt-3">
          <span>الرقم الضريبي: {systemSettings.company.taxNumber || '—'}</span>
          <span>السجل التجاري: {systemSettings.company.commercialRegister || '—'}</span>
          <span>تاريخ الطباعة: {new Date().toLocaleDateString('ar-SA')}</span>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 print:hidden">
        {/* Total Employees */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-bold text-slate-500">الكادر الوظيفي</span>
            <Users size={16} className="text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">
            {overallStats.totalEmployees} <span className="text-xs font-normal text-slate-500">موظف</span>
          </div>
        </div>

        {/* Basic Salaries */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-bold text-slate-500">الرواتب الأساسية</span>
            <DollarSign size={16} className="text-slate-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono truncate">
            {overallStats.totalBasic.toLocaleString()} <span className="text-xs font-normal text-slate-500">{currency}</span>
          </div>
        </div>

        {/* Total Allowances */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-bold text-slate-500">إجمالي البدلات</span>
            <Layers size={16} className="text-indigo-500" />
          </div>
          <div className="text-lg font-bold text-indigo-700 font-mono truncate">
            {overallStats.totalAllowances.toLocaleString()} <span className="text-xs font-normal text-slate-500">{currency}</span>
          </div>
        </div>

        {/* Bonuses & Incentives (الحوافز والمكافآت) */}
        <div className="bg-white rounded-xl p-3.5 border border-amber-200 bg-amber-50/40 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-700 mb-1.5">
            <span className="text-[11px] font-bold text-amber-800">المكافآت والحوافز</span>
            <Award size={16} className="text-amber-600" />
          </div>
          <div className="text-lg font-bold text-amber-900 font-mono truncate">
            {overallStats.totalBonuses.toLocaleString()} <span className="text-xs font-normal text-amber-700">{currency}</span>
          </div>
        </div>

        {/* Deductions */}
        <div className="bg-white rounded-xl p-3.5 border border-rose-200 bg-rose-50/40 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-700 mb-1.5">
            <span className="text-[11px] font-bold text-rose-800">الخصومات والاستقطاع</span>
            <TrendingDown size={16} className="text-rose-600" />
          </div>
          <div className="text-lg font-bold text-rose-900 font-mono truncate">
            -{overallStats.totalDeductions.toLocaleString()} <span className="text-xs font-normal text-rose-700">{currency}</span>
          </div>
        </div>

        {/* Net Payroll */}
        <div className="bg-linear-to-bl from-blue-700 to-blue-900 text-white rounded-xl p-3.5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-200 mb-1.5">
            <span className="text-[11px] font-bold text-blue-100">صافي المسير للدفع</span>
            <CreditCard size={16} className="text-blue-300" />
          </div>
          <div className="text-lg font-bold font-mono text-white truncate">
            {overallStats.totalNet.toLocaleString()} <span className="text-xs font-normal text-blue-200">{currency}</span>
          </div>
        </div>
      </div>

      {/* Tabs Bar & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5 border-b border-slate-200 pb-3 print:hidden">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('payroll')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'payroll'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Calendar size={14} />
            <span>مسير الرواتب والأجور</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('employees')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'employees'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Users size={14} />
            <span>سجل الموظفين ({employees.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bonuses')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'bonuses'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Award size={14} className="text-amber-500" />
            <span>المكافآت وحوافز الأهداف</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('allowances')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'allowances'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Layers size={14} />
            <span>البدلات الثابتة</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('deductions')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'deductions'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <TrendingDown size={14} className="text-rose-500" />
            <span>الخصومات والاستقطاعات</span>
          </button>
        </div>

        {/* Search & Dep Filter */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'payroll' && (
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs shadow-xs">
              <span className="text-slate-500 font-medium">الشهر:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="2024-09">سبتمبر 2024</option>
                <option value="2024-08">أغسطس 2024</option>
                <option value="2024-07">يوليو 2024</option>
                <option value="2024-10">أكتوبر 2024</option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs shadow-xs">
            <span className="text-slate-500 font-medium">القسم:</span>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="ALL">كافة الإدارات والأقسام</option>
              {departments.map(dep => (
                <option key={dep} value={dep}>{dep}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="بحث بالاسم أو الكود أو الهوية..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-3 pr-9 py-1.5 w-48 sm:w-56 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* TAB 1: PAYROLL RUN (مسير الرواتب) */}
      {activeTab === 'payroll' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100 print:hidden">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileText size={16} className="text-blue-600" />
                <span>كشف مسير رواتب وأجور الموظفين المعتمد لشهر ({selectedMonth})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                يتضمن احتساب الرواتب الأساسية مضافاً إليها كافة البدلات والمكافآت وحوافز التارجت، ومستقطعاً منها التأمينات والخصومات.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePostPayrollToJournal}
                className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="توليد قيد الاستحقاق والصرف آلياً في دفتر اليومية"
              >
                <Calculator size={15} />
                <span>ترحيل قيد اليومية للمسير</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 print:border-none print:shadow-none overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse min-w-[880px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-600 font-bold">
                  <tr>
                    <th className="px-4 py-3.5">كود الموظف</th>
                    <th className="px-4 py-3.5">اسم الموظف / الوظيفة</th>
                    <th className="px-4 py-3.5">القسم</th>
                    <th className="px-4 py-3.5">الراتب الأساسي</th>
                    <th className="px-4 py-3.5">إجمالي البدلات</th>
                    <th className="px-4 py-3.5 text-amber-700">المكافآت والحوافز</th>
                    <th className="px-4 py-3.5 bg-slate-100/60 font-black">إجمالي الاستحقاق</th>
                    <th className="px-4 py-3.5 text-rose-700">إجمالي الخصومات</th>
                    <th className="px-4 py-3.5 bg-blue-50/80 text-blue-900 font-black">الصافي للدفع</th>
                    <th className="px-4 py-3.5 print:hidden">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {payrollRecords.map((rec) => {
                    const emp = employees.find(e => e.id === rec.employeeId);
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-600">{rec.employeeCode}</td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900">{rec.employeeName}</div>
                          <div className="text-[10px] text-slate-400">{rec.jobTitle}</div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{rec.department}</td>
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-800">
                          {rec.basicSalary.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-indigo-700 font-semibold">
                          +{rec.totalAllowances.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-amber-700 font-semibold">
                          +{rec.bonusesAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-900 bg-slate-50/50">
                          {rec.grossSalary.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-rose-600 font-semibold">
                          -{rec.deductionsAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 font-mono font-black text-sm text-blue-700 bg-blue-50/30">
                          {rec.netSalary.toLocaleString()} {currency}
                        </td>
                        <td className="px-4 py-3.5 print:hidden">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => emp && setSelectedPayslipEmp(emp)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[11px] font-bold transition-colors cursor-pointer"
                              title="عرض وطباعة قسيمة الراتب"
                            >
                              <Eye size={13} />
                              <span>قسيمة</span>
                            </button>
                            {emp && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditEmployee(emp)}
                                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
                                  title="تعديل بيانات الموظف والراتب"
                                >
                                  <Edit3 size={12} />
                                  <span>تعديل</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-bold transition-colors cursor-pointer"
                                  title="حذف الموظف"
                                >
                                  <Trash2 size={12} />
                                  <span>حذف</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {payrollRecords.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                        لا توجد سجلات مطابقة للبحث
                      </td>
                    </tr>
                  )}
                </tbody>
                {/* Total Footer Row */}
                {payrollRecords.length > 0 && (
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                    <tr>
                      <td colSpan={3} className="px-4 py-3.5 text-center">الإجمالي العام لمسير الأجور:</td>
                      <td className="px-4 py-3.5 font-mono font-black">{overallStats.totalBasic.toLocaleString()}</td>
                      <td className="px-4 py-3.5 font-mono text-indigo-700">+{overallStats.totalAllowances.toLocaleString()}</td>
                      <td className="px-4 py-3.5 font-mono text-amber-700">+{overallStats.totalBonuses.toLocaleString()}</td>
                      <td className="px-4 py-3.5 font-mono font-black">
                        {(overallStats.totalBasic + overallStats.totalAllowances + overallStats.totalBonuses).toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-rose-700">-{overallStats.totalDeductions.toLocaleString()}</td>
                      <td className="px-4 py-3.5 font-mono font-black text-blue-700 text-sm">
                        {overallStats.totalNet.toLocaleString()} {currency}
                      </td>
                      <td className="print:hidden"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Print Signatures */}
            <div className="hidden print:grid grid-cols-4 gap-6 mt-16 pt-8 text-center text-slate-800 border-t border-slate-300">
              <div>
                <p className="text-xs text-slate-500 mb-1">إعداد مسؤول الرواتب</p>
                <div className="font-bold text-xs">ريم سلطان العتيبي</div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">تدقيق رئيس الحسابات</p>
                <div className="font-bold text-xs">أحمد منصور الحربي</div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">المدير المالي</p>
                <div className="font-bold text-xs">أ.د. فهد السبيعي</div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">اعتماد الإدارة العامة</p>
                <div className="font-bold text-xs">المدير العام والتنفيذي</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EMPLOYEES DIRECTORY (دليل الموظفين) */}
      {activeTab === 'employees' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[760px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-600 font-bold">
                <tr>
                  <th className="px-4 py-3.5">كود الموظف</th>
                  <th className="px-4 py-3.5">الاسم وبيانات الهوية</th>
                  <th className="px-4 py-3.5">الوظيفة والقسم</th>
                  <th className="px-4 py-3.5">الاتصال والبنك</th>
                  <th className="px-4 py-3.5">الراتب الأساسي</th>
                  <th className="px-4 py-3.5">إجمالي البدلات</th>
                  <th className="px-4 py-3.5">صافي الاستحقاق الشهري</th>
                  <th className="px-4 py-3.5">الحالة</th>
                  <th className="px-4 py-3.5">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredEmployees.map((emp) => {
                  const { totalAllowances, netSalary } = calculateEmployeeTotals(emp);
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-600">{emp.code}</td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 text-sm">{emp.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">هوية: {emp.nationalId}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-800">{emp.jobTitle}</div>
                        <div className="text-[11px] text-slate-500">{emp.department}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 text-slate-700 dir-ltr text-right">
                          <Phone size={12} className="text-slate-400" />
                          <span>{emp.phone || '—'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]" title={emp.bankName}>
                          {emp.bankName}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-800">
                        {emp.basicSalary.toLocaleString()} {currency}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-indigo-700 font-medium">
                        {totalAllowances.toLocaleString()} {currency}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-blue-700 text-sm">
                        {netSalary.toLocaleString()} {currency}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          نشط على رأس العمل
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPayslipEmp(emp)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold transition-colors cursor-pointer"
                            title="قسيمة الراتب"
                          >
                            كشف وقسيمة
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditEmployee(emp)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
                            title="تعديل بيانات الموظف والراتب"
                          >
                            <Edit3 size={12} />
                            <span>تعديل</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-bold transition-colors cursor-pointer"
                            title="حذف الموظف"
                          >
                            <Trash2 size={12} />
                            <span>حذف</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BONUSES & TARGET INCENTIVES (المكافآت وحوافز الأهداف والتارجت) */}
      {activeTab === 'bonuses' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center bg-amber-50/70 p-4 rounded-2xl border border-amber-200">
            <div>
              <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <Award size={16} className="text-amber-600" />
                <span>سجل المكافآت وحوافز تحقيق الأهداف والتارجت (حواجز الإنجاز)</span>
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                حوافز ومكافآت الأداء المالي والبيعي للموظفين المعتمدة للصرف ضمن مسير الرواتب.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddBonusOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors cursor-pointer shadow-xs"
            >
              <Plus size={15} />
              <span>إضافة مكافأة أو حافز تارجت</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse min-w-[650px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-600 font-bold">
                  <tr>
                    <th className="px-4 py-3.5">الموظف المستحق</th>
                    <th className="px-4 py-3.5">نوع المكافأة / الحافز</th>
                    <th className="px-4 py-3.5">المبلغ</th>
                    <th className="px-4 py-3.5">التاريخ</th>
                    <th className="px-4 py-3.5">سبب وحاجز الاستحقاق</th>
                    <th className="px-4 py-3.5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {employees.flatMap(emp => 
                    (emp.bonuses || []).map(b => (
                      <tr key={b.id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900">{emp.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{emp.code} - {emp.jobTitle}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                            {b.typeName}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-amber-700 text-sm">
                          +{b.amount.toLocaleString()} {currency}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-500">{b.date}</td>
                        <td className="px-4 py-3.5 text-slate-700 max-w-xs">{b.reason}</td>
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            معتمد للصرف
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ALLOWANCES (البدلات الثابتة) */}
      {activeTab === 'allowances' && (
        <div className="flex flex-col gap-4">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Layers size={16} className="text-blue-600" />
              <span>جدول تفصيل البدلات الشهرية الثابتة المعتمدة لكل موظف</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              تشتمل على بدل السكن (25% كمتوسط نظامي)، بدل الانتقال، بدل إعاشة وطبيعة العمل والبدلات الأخرى.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse min-w-[700px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-600 font-bold">
                  <tr>
                    <th className="px-4 py-3.5">الموظف</th>
                    <th className="px-4 py-3.5">الراتب الأساسي</th>
                    <th className="px-4 py-3.5">بدل السكن</th>
                    <th className="px-4 py-3.5">بدل الانتقال</th>
                    <th className="px-4 py-3.5">بدل إعاشة وطبيعة عمل</th>
                    <th className="px-4 py-3.5">بدلات أخرى</th>
                    <th className="px-4 py-3.5 bg-indigo-50/60 font-black">إجمالي البدلات</th>
                    <th className="px-4 py-3.5 print:hidden">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredEmployees.map(emp => {
                    const totalAllow = (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.foodAllowance || 0) + (emp.otherAllowances || 0);
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-slate-900">
                          {emp.name}
                          <span className="block text-[10px] text-slate-400 font-normal">{emp.department}</span>
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-700">{emp.basicSalary.toLocaleString()}</td>
                        <td className="px-4 py-3.5 font-mono text-slate-600">{emp.housingAllowance?.toLocaleString() || 0}</td>
                        <td className="px-4 py-3.5 font-mono text-slate-600">{emp.transportAllowance?.toLocaleString() || 0}</td>
                        <td className="px-4 py-3.5 font-mono text-slate-600">{emp.foodAllowance?.toLocaleString() || 0}</td>
                        <td className="px-4 py-3.5 font-mono text-slate-600">{emp.otherAllowances?.toLocaleString() || 0}</td>
                        <td className="px-4 py-3.5 font-mono font-bold text-indigo-700 bg-indigo-50/30">
                          {totalAllow.toLocaleString()} {currency}
                        </td>
                        <td className="px-4 py-3.5 print:hidden">
                          <button
                            type="button"
                            onClick={() => handleOpenEditEmployee(emp)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
                            title="تعديل البدلات والراتب"
                          >
                            <Edit3 size={12} />
                            <span>تعديل البدلات</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DEDUCTIONS (الخصومات والاستقطاعات) */}
      {activeTab === 'deductions' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center bg-rose-50/70 p-4 rounded-2xl border border-rose-200">
            <div>
              <h3 className="text-sm font-bold text-rose-900 flex items-center gap-2">
                <TrendingDown size={16} className="text-rose-600" />
                <span>سجل الخصومات والاستقطاعات والغياب وسداد السلف</span>
              </h3>
              <p className="text-xs text-rose-700 mt-0.5">
                سجل كافة المبالغ المستقطعة نظامياً مثل التأمينات الاجتماعية (GOSI)، خصم الغياب والتأخيرات، وأقساط السلف.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddDeductionOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer shadow-xs"
            >
              <Plus size={15} />
              <span>تسجيل خصم أو استقطاع</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse min-w-[650px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-600 font-bold">
                  <tr>
                    <th className="px-4 py-3.5">الموظف</th>
                    <th className="px-4 py-3.5">نوع الاستقطاع</th>
                    <th className="px-4 py-3.5">المبلغ المستقطع</th>
                    <th className="px-4 py-3.5">التاريخ</th>
                    <th className="px-4 py-3.5">السبب والتفاصيل</th>
                    <th className="px-4 py-3.5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {employees.flatMap(emp => 
                    (emp.deductions || []).map(d => (
                      <tr key={d.id} className="hover:bg-rose-50/30 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900">{emp.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{emp.code} - {emp.department}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-semibold text-rose-900 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[11px]">
                            {d.typeName}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-rose-600 text-sm">
                          -{d.amount.toLocaleString()} {currency}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-500">{d.date}</td>
                        <td className="px-4 py-3.5 text-slate-700 max-w-xs">{d.reason}</td>
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            مخصوم من المسير
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD EMPLOYEE */}
      {isAddEmployeeOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">إضافة موظف جديد للشركة</h3>
                  <p className="text-xs text-slate-400">سجل بيانات الموظف والراتب الأساسي والبدلات الشهرية</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsAddEmployeeOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">كود الموظف:</label>
                  <input
                    type="text"
                    required
                    value={newEmpData.code}
                    onChange={(e) => setNewEmpData({...newEmpData, code: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-600 font-bold mb-1">الاسم الكامل للموظف:</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: عبدالله محمد الشمري"
                    value={newEmpData.name}
                    onChange={(e) => setNewEmpData({...newEmpData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">الإدارة / القسم:</label>
                  <select
                    value={newEmpData.department}
                    onChange={(e) => setNewEmpData({...newEmpData, department: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  >
                    <option value="المبيعات والتسويق">المبيعات والتسويق</option>
                    <option value="الإدارة المالية">الإدارة المالية</option>
                    <option value="إدارة المستودعات واللوجستيات">إدارة المستودعات واللوجستيات</option>
                    <option value="تقنية المعلومات والنظم">تقنية المعلومات والنظم</option>
                    <option value="الموارد البشرية والشؤون الإدارية">الموارد البشرية والشؤون الإدارية</option>
                    <option value="العمليات التشغيلية">العمليات التشغيلية</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">المسمى الوظيفي:</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: مسؤول مبيعات وتطوير"
                    value={newEmpData.jobTitle}
                    onChange={(e) => setNewEmpData({...newEmpData, jobTitle: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">رقم الهوية الوطنية / الإقامة:</label>
                  <input
                    type="text"
                    required
                    placeholder="10XXXXXXXX"
                    value={newEmpData.nationalId}
                    onChange={(e) => setNewEmpData({...newEmpData, nationalId: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">رقم الهاتف الجوال:</label>
                  <input
                    type="text"
                    placeholder="05XXXXXXXX"
                    value={newEmpData.phone}
                    onChange={(e) => setNewEmpData({...newEmpData, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 dir-ltr"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">تاريخ المباشرة:</label>
                  <input
                    type="date"
                    value={newEmpData.joinDate}
                    onChange={(e) => setNewEmpData({...newEmpData, joinDate: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">اسم البنك المعتمد:</label>
                  <input
                    type="text"
                    value={newEmpData.bankName}
                    onChange={(e) => setNewEmpData({...newEmpData, bankName: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">رقم الآيبان البنكي (IBAN):</label>
                  <input
                    type="text"
                    value={newEmpData.iban}
                    onChange={(e) => setNewEmpData({...newEmpData, iban: e.target.value})}
                    placeholder="SA..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono dir-ltr"
                  />
                </div>
              </div>

              {/* Salary & Allowances Section */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 block text-xs">هيكل الأجر والبدلات الشهرية:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-slate-500 text-[11px] font-bold mb-1">الراتب الأساسي:</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={newEmpData.basicSalary}
                      onChange={(e) => {
                        const basic = Number(e.target.value);
                        setNewEmpData({
                          ...newEmpData,
                          basicSalary: basic,
                          housingAllowance: Math.round(basic * 0.25),
                          transportAllowance: Math.round(basic * 0.1)
                        });
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[11px] font-bold mb-1">بدل سكن (25%):</label>
                    <input
                      type="number"
                      min={0}
                      value={newEmpData.housingAllowance}
                      onChange={(e) => setNewEmpData({...newEmpData, housingAllowance: Number(e.target.value)})}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[11px] font-bold mb-1">بدل انتقال:</label>
                    <input
                      type="number"
                      min={0}
                      value={newEmpData.transportAllowance}
                      onChange={(e) => setNewEmpData({...newEmpData, transportAllowance: Number(e.target.value)})}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[11px] font-bold mb-1">بدلات أخرى:</label>
                    <input
                      type="number"
                      min={0}
                      value={newEmpData.otherAllowances}
                      onChange={(e) => setNewEmpData({...newEmpData, otherAllowances: Number(e.target.value)})}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                  <span>إجمالي الراتب التعاقدي (أساسي + بدلات):</span>
                  <span className="font-mono font-bold text-slate-900">
                    {(Number(newEmpData.basicSalary) + Number(newEmpData.housingAllowance) + Number(newEmpData.transportAllowance) + Number(newEmpData.otherAllowances)).toLocaleString()} {currency}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddEmployeeOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-sm cursor-pointer"
                >
                  حفظ وتسجيل الموظف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT EMPLOYEE (تعديل بيانات الموظف والراتب) */}
      {isEditEmployeeOpen && editingEmployee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">تعديل بيانات الموظف والراتب</h3>
                  <p className="text-xs text-slate-400">تحديث بيانات ({editingEmployee.name}) والرواتب والبدلات</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => { setIsEditEmployeeOpen(false); setEditingEmployee(null); }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateEmployee} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">كود الموظف:</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.code}
                    onChange={(e) => setEditingEmployee({...editingEmployee, code: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-600 font-bold mb-1">الاسم الكامل للموظف:</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.name}
                    onChange={(e) => setEditingEmployee({...editingEmployee, name: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">الإدارة / القسم:</label>
                  <select
                    value={editingEmployee.department}
                    onChange={(e) => setEditingEmployee({...editingEmployee, department: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  >
                    <option value="المبيعات والتسويق">المبيعات والتسويق</option>
                    <option value="الإدارة المالية">الإدارة المالية</option>
                    <option value="إدارة المستودعات واللوجستيات">إدارة المستودعات واللوجستيات</option>
                    <option value="تقنية المعلومات والنظم">تقنية المعلومات والنظم</option>
                    <option value="الموارد البشرية والشؤون الإدارية">الموارد البشرية والشؤون الإدارية</option>
                    <option value="العمليات التشغيلية">العمليات التشغيلية</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">المسمى الوظيفي:</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.jobTitle}
                    onChange={(e) => setEditingEmployee({...editingEmployee, jobTitle: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">رقم الهوية الوطنية / الإقامة:</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.nationalId}
                    onChange={(e) => setEditingEmployee({...editingEmployee, nationalId: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">رقم الهاتف الجوال:</label>
                  <input
                    type="text"
                    value={editingEmployee.phone || ''}
                    onChange={(e) => setEditingEmployee({...editingEmployee, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 dir-ltr"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">البريد الإلكتروني:</label>
                  <input
                    type="email"
                    value={editingEmployee.email || ''}
                    onChange={(e) => setEditingEmployee({...editingEmployee, email: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 dir-ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">اسم البنك المعتمد:</label>
                  <input
                    type="text"
                    value={editingEmployee.bankName}
                    onChange={(e) => setEditingEmployee({...editingEmployee, bankName: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">رقم الآيبان البنكي (IBAN):</label>
                  <input
                    type="text"
                    value={editingEmployee.iban}
                    onChange={(e) => setEditingEmployee({...editingEmployee, iban: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono dir-ltr"
                  />
                </div>
              </div>

              {/* Salary & Allowances Grid */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 block">تفاصيل الراتب والبدلات الشهرية التعاقدية ({currency})</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-500 text-[11px] font-bold mb-1">الراتب الأساسي:</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={editingEmployee.basicSalary}
                      onChange={(e) => setEditingEmployee({...editingEmployee, basicSalary: Number(e.target.value)})}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[11px] font-bold mb-1">بدل سكن:</label>
                    <input
                      type="number"
                      min={0}
                      value={editingEmployee.housingAllowance || 0}
                      onChange={(e) => setEditingEmployee({...editingEmployee, housingAllowance: Number(e.target.value)})}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[11px] font-bold mb-1">بدل انتقال:</label>
                    <input
                      type="number"
                      min={0}
                      value={editingEmployee.transportAllowance || 0}
                      onChange={(e) => setEditingEmployee({...editingEmployee, transportAllowance: Number(e.target.value)})}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[11px] font-bold mb-1">بدل إعاشة وطبيعة عمل:</label>
                    <input
                      type="number"
                      min={0}
                      value={editingEmployee.foodAllowance || 0}
                      onChange={(e) => setEditingEmployee({...editingEmployee, foodAllowance: Number(e.target.value)})}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[11px] font-bold mb-1">بدلات أخرى:</label>
                    <input
                      type="number"
                      min={0}
                      value={editingEmployee.otherAllowances || 0}
                      onChange={(e) => setEditingEmployee({...editingEmployee, otherAllowances: Number(e.target.value)})}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                  <span>إجمالي الراتب التعاقدي:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {(Number(editingEmployee.basicSalary) + Number(editingEmployee.housingAllowance || 0) + Number(editingEmployee.transportAllowance || 0) + Number(editingEmployee.foodAllowance || 0) + Number(editingEmployee.otherAllowances || 0)).toLocaleString()} {currency}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsEditEmployeeOpen(false); setEditingEmployee(null); }}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-sm cursor-pointer"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD BONUS / TARGET INCENTIVE (إضافة مكافأة أو حافز تارجت وحواجز الإنجاز) */}
      {isAddBonusOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Award size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">إضافة مكافأة أو حافز تحقيق هدف</h3>
                  <p className="text-[11px] text-slate-400">منح الموظف حافز إنجاز أو كسر حاجز التارجت</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsAddBonusOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBonus} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">الموظف المستحق:</label>
                <select
                  required
                  value={newBonusData.employeeId}
                  onChange={(e) => setNewBonusData({...newBonusData, employeeId: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                >
                  <option value="">اختر الموظف...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.code} - {emp.jobTitle})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">نوع المكافأة / الحافز:</label>
                  <select
                    value={newBonusData.type}
                    onChange={(e) => {
                      const t = e.target.value as BonusIncentive['type'];
                      let label = 'مكافأة أداء';
                      if (t === 'TARGET_INCENTIVE') label = 'حافز كسر حاجز المبيعات المستهدف';
                      if (t === 'EXCELLENCE') label = 'مكافأة تميز وإنجاز';
                      if (t === 'COMMISSION') label = 'عمولة مبيعات تحصيلية';
                      setNewBonusData({...newBonusData, type: t, typeName: label});
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  >
                    <option value="TARGET_INCENTIVE">حافز تحقيق الهدف (التارجت)</option>
                    <option value="BONUS">مكافأة أداء تشغيلية</option>
                    <option value="EXCELLENCE">مكافأة تميز استثنائية</option>
                    <option value="COMMISSION">عمولة مبيعات</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">قيمة الحافز ({currency}):</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newBonusData.amount}
                    onChange={(e) => setNewBonusData({...newBonusData, amount: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold text-amber-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">التاريخ:</label>
                <input
                  type="date"
                  value={newBonusData.date}
                  onChange={(e) => setNewBonusData({...newBonusData, date: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">السبب وتفاصيل الإنجاز:</label>
                <textarea
                  rows={2}
                  required
                  value={newBonusData.reason}
                  onChange={(e) => setNewBonusData({...newBonusData, reason: e.target.value})}
                  placeholder="مثال: تخطي حاجز المبيعات بنسبة 120% وإغلاق العقود بنجاح"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddBonusOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-colors shadow-sm cursor-pointer"
                >
                  اعتماد الحافز
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD DEDUCTION (تسجيل خصم أو استقطاع) */}
      {isAddDeductionOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <TrendingDown size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">تسجيل خصم أو استقطاع من الراتب</h3>
                  <p className="text-[11px] text-slate-400">إثبات غياب، تأخير، قسط سلفة، أو جزاء</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsAddDeductionOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateDeduction} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">الموظف:</label>
                <select
                  required
                  value={newDeductionData.employeeId}
                  onChange={(e) => setNewDeductionData({...newDeductionData, employeeId: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                >
                  <option value="">اختر الموظف...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.code} - {emp.jobTitle})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">نوع الخصم:</label>
                  <select
                    value={newDeductionData.type}
                    onChange={(e) => {
                      const t = e.target.value as DeductionItem['type'];
                      let label = 'خصم غياب يوم';
                      if (t === 'DELAY') label = 'خصم تأخيرات وتراكم ساعات';
                      if (t === 'LOAN_INSTALLMENT') label = 'قسط سداد سلفة الموظف';
                      if (t === 'PENALTY') label = 'جزاء مخالفة لائحة العمل';
                      if (t === 'INSURANCE') label = 'استقطاع التأمينات الاجتماعية';
                      setNewDeductionData({...newDeductionData, type: t, typeName: label});
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  >
                    <option value="ABSENCE">غياب غير مدفوع</option>
                    <option value="DELAY">تأخيرات زمنية</option>
                    <option value="LOAN_INSTALLMENT">قسط سلفة</option>
                    <option value="PENALTY">جزاء إداري</option>
                    <option value="INSURANCE">تأمينات اجتماعية</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">المبلغ المخصوم ({currency}):</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newDeductionData.amount}
                    onChange={(e) => setNewDeductionData({...newDeductionData, amount: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold text-rose-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">التاريخ:</label>
                <input
                  type="date"
                  value={newDeductionData.date}
                  onChange={(e) => setNewDeductionData({...newDeductionData, date: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">السبب والتفاصيل:</label>
                <textarea
                  rows={2}
                  required
                  value={newDeductionData.reason}
                  onChange={(e) => setNewDeductionData({...newDeductionData, reason: e.target.value})}
                  placeholder="سبب الخصم أو تفاصيل السلفة..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddDeductionOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors shadow-sm cursor-pointer"
                >
                  تسجيل الخصم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: PAYSLIP PREVIEW & PRINT (قسيمة راتب الموظف) */}
      {selectedPayslipEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[95vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:p-0">
            {/* Action buttons inside modal */}
            <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-200 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="text-blue-600" size={20} />
                <span className="font-bold text-slate-900 text-sm">قسيمة الراتب الشهرية (Payslip)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  <Printer size={14} />
                  <span>طباعة القسيمة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPayslipEmp(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Payslip Document Area */}
            <div className="border border-slate-200 rounded-2xl p-5 sm:p-6 bg-slate-50/50 print:border-none print:bg-transparent print:p-0">
              {/* Header */}
              <div className="text-center pb-4 border-b-2 border-slate-800">
                <h2 className="text-xl font-bold font-diwani text-slate-900">{systemSettings.company.nameAr}</h2>
                <div className="text-xs font-bold text-blue-700 mt-1">كشف وقسيمة إيداع الراتب الشهري (Payslip)</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">عن شهر: {selectedMonth}</div>
              </div>

              {/* Employee & Company Info Grid */}
              <div className="grid grid-cols-2 gap-3 my-4 p-3 bg-white rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">اسم الموظف:</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedPayslipEmp.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">كود الموظف:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedPayslipEmp.code}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">الوظيفة:</span>
                  <span className="font-medium text-slate-800">{selectedPayslipEmp.jobTitle}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">القسم / الإدارة:</span>
                  <span className="font-medium text-slate-800">{selectedPayslipEmp.department}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">الهوية الوطنية / الإقامة:</span>
                  <span className="font-mono text-slate-800">{selectedPayslipEmp.nationalId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">الحساب البنكي (الآيبان):</span>
                  <span className="font-mono text-[10px] text-slate-800 dir-ltr block truncate" title={selectedPayslipEmp.iban}>
                    {selectedPayslipEmp.iban || '—'}
                  </span>
                </div>
              </div>

              {/* Earnings & Deductions Breakdown */}
              {(() => {
                const { totalDeductions, grossSalary, netSalary } = calculateEmployeeTotals(selectedPayslipEmp);
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Earnings */}
                      <div className="bg-white rounded-xl p-3 border border-emerald-100">
                        <div className="text-xs font-bold text-emerald-800 pb-2 mb-2 border-b border-emerald-100 flex justify-between">
                          <span>الاستحقاقات والمكافآت (+)</span>
                          <span className="font-mono">{grossSalary.toLocaleString()} {currency}</span>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-600">الراتب الأساسي:</span>
                            <span className="font-mono font-bold text-slate-900">{selectedPayslipEmp.basicSalary.toLocaleString()} {currency}</span>
                          </div>
                          {selectedPayslipEmp.housingAllowance > 0 && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">بدل سكن:</span>
                              <span className="font-mono text-slate-700">+{selectedPayslipEmp.housingAllowance.toLocaleString()}</span>
                            </div>
                          )}
                          {selectedPayslipEmp.transportAllowance > 0 && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">بدل انتقال:</span>
                              <span className="font-mono text-slate-700">+{selectedPayslipEmp.transportAllowance.toLocaleString()}</span>
                            </div>
                          )}
                          {(selectedPayslipEmp.foodAllowance || 0) + (selectedPayslipEmp.otherAllowances || 0) > 0 && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">بدلات أخرى:</span>
                              <span className="font-mono text-slate-700">+{(selectedPayslipEmp.foodAllowance + selectedPayslipEmp.otherAllowances).toLocaleString()}</span>
                            </div>
                          )}
                          {(selectedPayslipEmp.bonuses || []).map(b => (
                            <div key={b.id} className="flex justify-between text-amber-800 font-semibold bg-amber-50/60 p-1 rounded">
                              <span>{b.typeName}:</span>
                              <span className="font-mono">+{b.amount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Deductions */}
                      <div className="bg-white rounded-xl p-3 border border-rose-100">
                        <div className="text-xs font-bold text-rose-800 pb-2 mb-2 border-b border-rose-100 flex justify-between">
                          <span>الاستقطاعات والخصومات (-)</span>
                          <span className="font-mono">-{totalDeductions.toLocaleString()} {currency}</span>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          {(selectedPayslipEmp.deductions || []).map(d => (
                            <div key={d.id} className="flex justify-between text-slate-600">
                              <span className="text-[11px] truncate max-w-[150px]" title={d.typeName}>{d.typeName}:</span>
                              <span className="font-mono text-rose-600 font-bold">-{d.amount.toLocaleString()}</span>
                            </div>
                          ))}
                          {(!selectedPayslipEmp.deductions || selectedPayslipEmp.deductions.length === 0) && (
                            <div className="text-slate-400 text-center py-4">لا توجد استقطاعات</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Net Salary Summary */}
                    <div className="p-4 bg-linear-to-bl from-blue-700 to-blue-900 text-white rounded-2xl flex items-center justify-between shadow-md">
                      <div>
                        <span className="text-[11px] text-blue-200 block font-medium">صافي الراتب المحول للحساب البنكي:</span>
                        <span className="text-xs text-blue-100">نظام حماية الأجور (WPS) - معتمد</span>
                      </div>
                      <div className="text-2xl font-bold font-mono">
                        {netSalary.toLocaleString()} <span className="text-sm font-normal text-blue-200">{currency}</span>
                      </div>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 text-center text-xs text-slate-700">
                      <div>
                        <span className="text-slate-400 block text-[10px] mb-8">توقيع مسؤول الرواتب والموارد البشرية:</span>
                        <div className="border-t border-slate-300 pt-1 font-bold">إدارة الموارد البشرية</div>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] mb-8">توقيع وإقرار استلام الموظف:</span>
                        <div className="border-t border-slate-300 pt-1 font-bold">{selectedPayslipEmp.name}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
