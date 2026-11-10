import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Award, 
  TrendingDown, 
  Plus, 
  FileText, 
  Calendar, 
  CheckCircle2, 
  CreditCard, 
  X, 
  Printer, 
  Calculator,
  Edit3,
  Trash2,
  Download,
  Clock,
  ShieldAlert,
  Building2,
  Receipt,
  FileSpreadsheet,
  Scale
} from 'lucide-react';
import { Employee, BonusIncentive, DeductionItem, PayrollRecord, LoanAdvance } from '../types/payroll';
import { 
  getStoredEmployees, 
  saveStoredEmployees, 
  calculateEmployeeTotals, 
  generatePayrollRecords,
  getStoredLoans
} from '../data/mockPayroll';
import { getSystemSettings } from '../utils/settings';
import { useIsInWindow } from './DesktopWindowManager';
import { useSystemCurrency } from '../utils/currency';
import { saveJournalEntry, loadChartOfAccounts } from '../utils/trialBalanceStore';
import { isCashOrBankAccount } from '../utils/accountingIntegration';
import { navigateToAccountMovements } from '../utils/accountMovementsStore';
import { JournalEntry, JournalEntryStatus } from '../types/accounting';
import { loadCostCenters } from '../utils/costCenterStore';
import PrintDropdown from './PrintDropdown';
import ExportButtonGroup from './ExportButtonGroup';

// Import our rich sub-components for the 6 enhancements
import LoansTab from './payroll/LoansTab';
import WpsModal from './payroll/WpsModal';
import OvertimeAttendanceTab from './payroll/OvertimeAttendanceTab';
import EndOfServiceTab from './payroll/EndOfServiceTab';
import DocumentAlertsTab from './payroll/DocumentAlertsTab';
import GosiTab from './payroll/GosiTab';

type TabType = 
  | 'payroll' 
  | 'employees' 
  | 'loans' 
  | 'overtime_attendance' 
  | 'end_of_service' 
  | 'documents_alerts' 
  | 'gosi' 
  | 'bonuses' 
  | 'deductions';

export default function PayrollScreen({ isInWindow: explicitIsInWindow }: { isInWindow?: boolean } = {}) {
  const isInWindow = useIsInWindow(explicitIsInWindow);
  const [systemSettings] = useState(() => getSystemSettings());
  const [employees, setEmployees] = useState<Employee[]>(() => getStoredEmployees());
  const [loans, setLoans] = useState<LoanAdvance[]>(() => getStoredLoans());
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
  const [isWpsModalOpen, setIsWpsModalOpen] = useState(false);
  const [selectedPayslipEmp, setSelectedPayslipEmp] = useState<Employee | null>(null);
  const [journalGeneratedMsg, setJournalGeneratedMsg] = useState<string | null>(null);
  const [treasuryAccounts, setTreasuryAccounts] = useState(() => {
    const all = loadChartOfAccounts();
    return all.filter(a => isCashOrBankAccount(a, all));
  });
  const [disbursementAccountId, setDisbursementAccountId] = useState<string>('acc-1102');

  const { symbol: currency } = useSystemCurrency();

  const refreshAll = () => {
    setEmployees(getStoredEmployees());
    setLoans(getStoredLoans());
    const all = loadChartOfAccounts();
    setTreasuryAccounts(all.filter(a => isCashOrBankAccount(a, all)));
  };

  useEffect(() => {
    const handleSync = () => {
      refreshAll();
    };
    window.addEventListener('alpha-payroll-updated', handleSync);
    window.addEventListener('alpha-system-reset-completed', handleSync);
    window.addEventListener('alpha-data-changed', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('alpha-payroll-updated', handleSync);
      window.removeEventListener('alpha-system-reset-completed', handleSync);
      window.removeEventListener('alpha-data-changed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Form states for adding employee
  const [newEmpData, setNewEmpData] = useState({
    code: `EMP-${Math.floor(100 + Math.random() * 900)}`,
    name: '',
    department: '',
    jobTitle: '',
    nationalId: '',
    phone: '',
    email: '',
    joinDate: new Date().toISOString().slice(0, 10),
    bankName: '',
    iban: 'SA',
    basicSalary: 0,
    housingAllowance: 0,
    transportAllowance: 0,
    foodAllowance: 0,
    otherAllowances: 0,
    nationalityType: 'SAUDI' as 'SAUDI' | 'NON_SAUDI',
    gosiSubscription: true,
    contractExpiryDate: '',
    idExpiryDate: '',
    insuranceExpiryDate: ''
  });

  // Form states for adding bonus/incentive
  const [newBonusData, setNewBonusData] = useState({
    employeeId: '',
    type: 'TARGET_INCENTIVE' as BonusIncentive['type'],
    typeName: '',
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    reason: '',
  });

  // Form states for adding deduction
  const [newDeductionData, setNewDeductionData] = useState({
    employeeId: '',
    type: 'ABSENCE' as DeductionItem['type'],
    typeName: '',
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    reason: '',
  });

  // Dynamic departments and jobs from MasterDatabaseSettings, Cost Centers, and existing employees
  const dynamicDepartmentsList = useMemo(() => {
    const list = new Set<string>();
    // From Master Database Settings
    try {
      const raw = localStorage.getItem('alpha_master_database_settings_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.departments)) {
          parsed.departments.forEach((d: any) => { if (d.name) list.add(d.name.trim()); });
        }
      }
    } catch {}
    // From Cost Centers (departments)
    try {
      const ccs = loadCostCenters();
      ccs.filter(c => c.type === 'DEPARTMENT' && c.name).forEach(c => list.add(c.name.trim()));
    } catch {}
    // From registered employees
    employees.forEach(e => { if (e.department) list.add(e.department.trim()); });
    // Default standard business departments if none defined yet
    if (list.size === 0) {
      ['المبيعات والتسويق', 'الإدارة المالية', 'إدارة المستودعات واللوجستيات', 'تقنية المعلومات والنظم', 'الموارد البشرية والشؤون الإدارية', 'العمليات التشغيلية'].forEach(d => list.add(d));
    }
    return Array.from(list);
  }, [employees]);

  const dynamicJobsList = useMemo(() => {
    const list = new Set<string>();
    try {
      const raw = localStorage.getItem('alpha_master_database_settings_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.jobs)) {
          parsed.jobs.forEach((j: any) => {
            const title = j.title || j.name;
            if (title) list.add(title.trim());
          });
        }
      }
    } catch {}
    employees.forEach(e => { if (e.jobTitle) list.add(e.jobTitle.trim()); });
    return Array.from(list);
  }, [employees]);

  // Distinct departments for filtering
  const departments = dynamicDepartmentsList;

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

  // Generated payroll records for the month
  const payrollRecords: PayrollRecord[] = useMemo(() => {
    return generatePayrollRecords(filteredEmployees, selectedMonth, loans);
  }, [filteredEmployees, selectedMonth, loans]);

  // Overall calculations across current filtered payroll
  const overallStats = useMemo(() => {
    let totalBasic = 0;
    let totalAllowances = 0;
    let totalBonuses = 0;
    let totalDeductions = 0;
    let totalLoansDeducted = 0;
    let totalGosiDeducted = 0;
    let totalNet = 0;

    payrollRecords.forEach(rec => {
      totalBasic += rec.basicSalary;
      totalAllowances += rec.totalAllowances;
      totalBonuses += rec.bonusesAmount;
      totalDeductions += rec.deductionsAmount;
      totalLoansDeducted += (rec.loanDeduction || 0);
      totalGosiDeducted += (rec.gosiDeduction || 0);
      totalNet += rec.netSalary;
    });

    return {
      totalEmployees: payrollRecords.length,
      totalBasic,
      totalAllowances,
      totalBonuses,
      totalDeductions,
      totalLoansDeducted,
      totalGosiDeducted,
      totalNet
    };
  }, [payrollRecords]);

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
      nationalityType: newEmpData.nationalityType,
      gosiSubscription: newEmpData.gosiSubscription,
      gosiEmployeePercent: newEmpData.nationalityType === 'SAUDI' ? 9.75 : 0,
      gosiCompanyPercent: newEmpData.nationalityType === 'SAUDI' ? 11.75 : 2.0,
      contractExpiryDate: newEmpData.contractExpiryDate,
      idExpiryDate: newEmpData.idExpiryDate,
      insuranceExpiryDate: newEmpData.insuranceExpiryDate,
      bonuses: [],
      deductions: []
    };

    const updated = [created, ...employees];
    setEmployees(updated);
    saveStoredEmployees(updated);
    setIsAddEmployeeOpen(false);
  };

  // Handle Edit & Update Employee
  const handleUpdateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    const updated = employees.map(emp => emp.id === editingEmployee.id ? editingEmployee : emp);
    setEmployees(updated);
    saveStoredEmployees(updated);
    setIsEditEmployeeOpen(false);
    setEditingEmployee(null);
  };

  // Handle Delete Employee
  const handleDeleteEmployee = (id: string) => {
    if (window.confirm('هل أنت متأكد من رغبتك في حذف بيانات هذا الموظف وسجلاته؟')) {
      const updated = employees.filter(emp => emp.id !== id);
      setEmployees(updated);
      saveStoredEmployees(updated);
    }
  };

  // Handle Add Bonus / Target Incentive
  const handleCreateBonus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBonusData.employeeId) return;

    const emp = employees.find(e => e.id === newBonusData.employeeId);
    if (!emp) return;

    const bonusItem: BonusIncentive = {
      id: `b-${Date.now()}`,
      type: newBonusData.type,
      typeName: newBonusData.typeName,
      amount: Number(newBonusData.amount) || 0,
      date: newBonusData.date,
      reason: newBonusData.reason,
      status: 'APPROVED'
    };

    const updatedEmp: Employee = {
      ...emp,
      bonuses: [...(emp.bonuses || []), bonusItem]
    };

    const updatedList = employees.map(e => e.id === emp.id ? updatedEmp : e);
    setEmployees(updatedList);
    saveStoredEmployees(updatedList);
    setIsAddBonusOpen(false);
  };

  // Handle Add Deduction
  const handleCreateDeduction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeductionData.employeeId) return;

    const emp = employees.find(e => e.id === newDeductionData.employeeId);
    if (!emp) return;

    const deductionItem: DeductionItem = {
      id: `d-${Date.now()}`,
      type: newDeductionData.type,
      typeName: newDeductionData.typeName,
      amount: Number(newDeductionData.amount) || 0,
      date: newDeductionData.date,
      reason: newDeductionData.reason,
      status: 'APPLIED'
    };

    const updatedEmp: Employee = {
      ...emp,
      deductions: [...(emp.deductions || []), deductionItem]
    };

    const updatedList = employees.map(e => e.id === emp.id ? updatedEmp : e);
    setEmployees(updatedList);
    saveStoredEmployees(updatedList);
    setIsAddDeductionOpen(false);
  };

  // Generate Accounting Journal Entry for Monthly Payroll
  const handleGeneratePayrollJournalEntry = () => {
    if (payrollRecords.length === 0) return;

    const grossTotal = overallStats.totalBasic + overallStats.totalAllowances + overallStats.totalBonuses;
    const netTotal = overallStats.totalNet;
    const deductionsTotal = overallStats.totalDeductions;
    const loanDeductions = overallStats.totalLoansDeducted || 0;
    const gosiDeductions = overallStats.totalGosiDeducted || 0;
    const otherDeductions = Math.max(0, deductionsTotal - loanDeductions - gosiDeductions);

    try {
      const items = [
        {
          id: `ji-${Date.now()}-1`,
          accountId: 'acc-5102',
          debit: grossTotal,
          credit: 0
        },
        {
          id: `ji-${Date.now()}-2`,
          accountId: 'acc-2201',
          debit: 0,
          credit: netTotal
        },
        ...(loanDeductions > 0 ? [
          {
            id: `ji-${Date.now()}-3`,
            accountId: 'acc-1205',
            debit: 0,
            credit: loanDeductions
          }
        ] : []),
        ...(otherDeductions + gosiDeductions > 0 ? [
          {
            id: `ji-${Date.now()}-4`,
            accountId: 'acc-4201',
            debit: 0,
            credit: otherDeductions + gosiDeductions
          }
        ] : [])
      ];

      const entry: JournalEntry = {
        id: `je-pay-${Date.now()}`,
        entryNumber: `JV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        date: new Date().toISOString().slice(0, 10),
        status: JournalEntryStatus.Posted,
        description: `إثبات وقيد استحقاق مسير رواتب وأجور شهر (${selectedMonth}) لعدد (${payrollRecords.length}) موظف (مع تسوية اقتطاعات السلف 1205)`,
        reference: `PAYROLL-${selectedMonth}`,
        items
      };

      saveJournalEntry(entry);

      // Auto update loan installment statuses for this month
      if (loanDeductions > 0 && loans.length > 0) {
        const updatedLoans = loans.map(loan => {
          let instChanged = false;
          const nextInsts = loan.installments.map(inst => {
            if (inst.month === selectedMonth && inst.status === 'PENDING') {
              instChanged = true;
              return {
                ...inst,
                status: 'PAID' as const,
                paidDate: new Date().toISOString().slice(0, 10)
              };
            }
            return inst;
          });

          if (instChanged) {
            const totalPaid = nextInsts.filter(i => i.status === 'PAID').reduce((sum, i) => sum + i.amount, 0);
            const remaining = Math.max(0, loan.amount - totalPaid);
            return {
              ...loan,
              installments: nextInsts,
              paidAmount: totalPaid,
              remainingAmount: remaining,
              status: remaining === 0 ? ('PAID' as const) : ('ACTIVE' as const)
            };
          }
          return loan;
        });

        saveStoredLoans(updatedLoans);
        setLoans(updatedLoans);
      }

      setJournalGeneratedMsg(`تم إنشاء وترحيل قيد استحقاق الرواتب (${entry.entryNumber}) لمسير شهر ${selectedMonth} بنجاح (مع تسوية حـ/ السلف 1205 وحـ/ الرواتب المستحقة 2201).`);
      setTimeout(() => setJournalGeneratedMsg(null), 7000);
    } catch (err) {
      console.error(err);
      setJournalGeneratedMsg('حدث خطأ أثناء إنشاء القيد المحاسبي لاستحقاق الرواتب');
    }
  };

  // Disburse / Pay Monthly Payroll from Selected Safe or Bank
  const handleDisburseMonthlyPayroll = () => {
    if (payrollRecords.length === 0 || overallStats.totalNet <= 0) return;

    const netTotal = overallStats.totalNet;
    const selectedTreasury = treasuryAccounts.find(a => a.id === disbursementAccountId || a.code === disbursementAccountId);
    const targetAccId = selectedTreasury ? selectedTreasury.id : (disbursementAccountId || 'acc-1102');
    const targetAccName = selectedTreasury ? `${selectedTreasury.name} (${selectedTreasury.code})` : 'البنك / الصندوق';

    try {
      const entry: JournalEntry = {
        id: `je-pay-disb-${Date.now()}`,
        entryNumber: `JV-PAY-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        date: new Date().toISOString().slice(0, 10),
        status: JournalEntryStatus.Posted,
        description: `صرف وسداد صافي رواتب وأجور شهر (${selectedMonth}) لعدد (${payrollRecords.length}) موظف من: ${targetAccName}`,
        reference: `PAY-DISB-${selectedMonth}`,
        items: [
          {
            id: `ji-${Date.now()}-1`,
            accountId: 'acc-2201',
            debit: netTotal,
            credit: 0
          },
          {
            id: `ji-${Date.now()}-2`,
            accountId: targetAccId,
            debit: 0,
            credit: netTotal
          }
        ]
      };

      saveJournalEntry(entry);

      setJournalGeneratedMsg(`تم صرف وسداد صافي مسير رواتب شهر ${selectedMonth} بمبلغ (${netTotal.toLocaleString()} ${currency}) خصماً من (${targetAccName}) وترحيل القيد (${entry.entryNumber}) بنجاح.`);
      setTimeout(() => setJournalGeneratedMsg(null), 7000);
    } catch (err) {
      console.error(err);
      setJournalGeneratedMsg('حدث خطأ أثناء ترحيل قيد صرف وسداد الرواتب');
    }
  };

  // Active loans count
  const activeLoansCount = loans.filter(l => l.status === 'ACTIVE').length;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          {!isInWindow && (
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-xs">
              <Users size={26} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 font-diwani">
                نظام الموارد البشرية والرواتب والأجور الشامل
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                إدارة الموظفين، السلف والقروض، حماية الأجور (WPS)، العمل الإضافي، تصفية نهاية الخدمة، والتأمينات (GOSI)
              </p>
            </div>
          </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigateToAccountMovements('acc-5102')}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-b from-indigo-500 via-indigo-600 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-700/25 border-b-[3.5px] border-indigo-900 active:border-b active:translate-y-[2.5px] cursor-pointer"
              title="فتح حركة حساب الرواتب والأجور (5102) في شاشة حركة الحسابات"
            >
              <Scale size={16} className="text-amber-300" />
              <span>حركة حساب الرواتب (3 أعمدة)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsWpsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-700/25 border-b-[3.5px] border-emerald-900 active:border-b active:translate-y-[2.5px] cursor-pointer"
            >
              <FileSpreadsheet size={16} className="text-emerald-100" />
              <span>تصدير حماية الأجور (WPS)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddEmployeeOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-700/25 border-b-[3.5px] border-blue-900 active:border-b active:translate-y-[2.5px] cursor-pointer"
            >
              <Plus size={16} className="text-blue-100" />
              <span>إضافة موظف جديد</span>
            </button>

            <PrintDropdown 
              onPrint={() => window.print()}
            />
          </div>
        </div>

        {/* Success message if journal entry generated */}
        {journalGeneratedMsg && (
          <div className="mt-4 p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span className="font-semibold">{journalGeneratedMsg}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setJournalGeneratedMsg(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* 3D NAVIGATION TABS WITH MEANINGFUL SEMANTIC COLORS */}
        <div className="mt-6 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-inner flex items-center gap-2 overflow-x-auto text-xs scrollbar-none">
          {/* Tab 1: Payroll - Deep Indigo */}
          <button
            type="button"
            onClick={() => setActiveTab('payroll')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'payroll' 
                ? 'bg-gradient-to-b from-indigo-500 via-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30 border-b-[3px] border-indigo-900 ring-1 ring-white/25 active:translate-y-0.5' 
                : 'bg-white/90 hover:bg-white text-slate-700 hover:text-indigo-700 border border-slate-200 border-b-[2.5px] border-b-slate-300 shadow-xs hover:border-indigo-300 active:translate-y-0.5'
            }`}
          >
            <Calendar size={16} className={activeTab === 'payroll' ? 'text-indigo-100' : 'text-indigo-600'} />
            <span>مسير الرواتب الشهري</span>
          </button>

          {/* Tab 2: Employees - Azure Blue */}
          <button
            type="button"
            onClick={() => setActiveTab('employees')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'employees' 
                ? 'bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700 text-white shadow-md shadow-blue-600/30 border-b-[3px] border-blue-900 ring-1 ring-white/25 active:translate-y-0.5' 
                : 'bg-white/90 hover:bg-white text-slate-700 hover:text-blue-700 border border-slate-200 border-b-[2.5px] border-b-slate-300 shadow-xs hover:border-blue-300 active:translate-y-0.5'
            }`}
          >
            <Users size={16} className={activeTab === 'employees' ? 'text-blue-100' : 'text-blue-600'} />
            <span>الموظفون</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeTab === 'employees' ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-800'
            }`}>
              {employees.length}
            </span>
          </button>

          {/* Tab 3: Loans & Advances - Amber Gold */}
          <button
            type="button"
            onClick={() => setActiveTab('loans')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'loans' 
                ? 'bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 text-white shadow-md shadow-amber-600/30 border-b-[3px] border-amber-900 ring-1 ring-white/25 active:translate-y-0.5' 
                : 'bg-white/90 hover:bg-white text-slate-700 hover:text-amber-700 border border-slate-200 border-b-[2.5px] border-b-slate-300 shadow-xs hover:border-amber-300 active:translate-y-0.5'
            }`}
          >
            <CreditCard size={16} className={activeTab === 'loans' ? 'text-amber-100' : 'text-amber-600'} />
            <span>السلف والقروض</span>
            {activeLoansCount > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'loans' ? 'bg-white text-amber-900 shadow-xs' : 'bg-amber-100 text-amber-900'
              }`}>
                {activeLoansCount}
              </span>
            )}
          </button>

          {/* Tab 4: Overtime & Attendance - Vivid Purple */}
          <button
            type="button"
            onClick={() => setActiveTab('overtime_attendance')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'overtime_attendance' 
                ? 'bg-gradient-to-b from-purple-500 via-purple-600 to-purple-700 text-white shadow-md shadow-purple-600/30 border-b-[3px] border-purple-900 ring-1 ring-white/25 active:translate-y-0.5' 
                : 'bg-white/90 hover:bg-white text-slate-700 hover:text-purple-700 border border-slate-200 border-b-[2.5px] border-b-slate-300 shadow-xs hover:border-purple-300 active:translate-y-0.5'
            }`}
          >
            <Clock size={16} className={activeTab === 'overtime_attendance' ? 'text-purple-100' : 'text-purple-600'} />
            <span>الإضافي والغياب</span>
          </button>

          {/* Tab 5: End of Service - Crimson Rose */}
          <button
            type="button"
            onClick={() => setActiveTab('end_of_service')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'end_of_service' 
                ? 'bg-gradient-to-b from-rose-500 via-rose-600 to-rose-700 text-white shadow-md shadow-rose-600/30 border-b-[3px] border-rose-900 ring-1 ring-white/25 active:translate-y-0.5' 
                : 'bg-white/90 hover:bg-white text-slate-700 hover:text-rose-700 border border-slate-200 border-b-[2.5px] border-b-slate-300 shadow-xs hover:border-rose-300 active:translate-y-0.5'
            }`}
          >
            <Calculator size={16} className={activeTab === 'end_of_service' ? 'text-rose-100' : 'text-rose-600'} />
            <span>تصفية نهاية الخدمة</span>
          </button>

          {/* Tab 6: Document Alerts - Vibrant Orange */}
          <button
            type="button"
            onClick={() => setActiveTab('documents_alerts')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'documents_alerts' 
                ? 'bg-gradient-to-b from-orange-500 via-orange-600 to-orange-700 text-white shadow-md shadow-orange-600/30 border-b-[3px] border-orange-900 ring-1 ring-white/25 active:translate-y-0.5' 
                : 'bg-white/90 hover:bg-white text-slate-700 hover:text-orange-700 border border-slate-200 border-b-[2.5px] border-b-slate-300 shadow-xs hover:border-orange-300 active:translate-y-0.5'
            }`}
          >
            <ShieldAlert size={16} className={activeTab === 'documents_alerts' ? 'text-orange-100' : 'text-orange-600'} />
            <span>تنبيهات الوثائق</span>
          </button>

          {/* Tab 7: GOSI Social Insurance - Teal / Emerald */}
          <button
            type="button"
            onClick={() => setActiveTab('gosi')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'gosi' 
                ? 'bg-gradient-to-b from-teal-500 via-teal-600 to-teal-700 text-white shadow-md shadow-teal-600/30 border-b-[3px] border-teal-900 ring-1 ring-white/25 active:translate-y-0.5' 
                : 'bg-white/90 hover:bg-white text-slate-700 hover:text-teal-700 border border-slate-200 border-b-[2.5px] border-b-slate-300 shadow-xs hover:border-teal-300 active:translate-y-0.5'
            }`}
          >
            <Building2 size={16} className={activeTab === 'gosi' ? 'text-teal-100' : 'text-teal-600'} />
            <span>التأمينات (GOSI)</span>
          </button>

          {/* Tab 8: Bonuses - Gold */}
          <button
            type="button"
            onClick={() => setActiveTab('bonuses')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'bonuses' 
                ? 'bg-gradient-to-b from-amber-500 via-yellow-600 to-amber-600 text-white shadow-md shadow-amber-600/30 border-b-[3px] border-amber-900 ring-1 ring-white/25 active:translate-y-0.5' 
                : 'bg-white/90 hover:bg-white text-slate-700 hover:text-amber-700 border border-slate-200 border-b-[2.5px] border-b-slate-300 shadow-xs hover:border-amber-300 active:translate-y-0.5'
            }`}
          >
            <Award size={16} className={activeTab === 'bonuses' ? 'text-amber-100' : 'text-amber-600'} />
            <span>المكافآت والحوافز</span>
          </button>

          {/* Tab 9: Deductions - Slate Dark */}
          <button
            type="button"
            onClick={() => setActiveTab('deductions')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'deductions' 
                ? 'bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 text-white shadow-md shadow-slate-900/30 border-b-[3px] border-slate-950 ring-1 ring-white/25 active:translate-y-0.5' 
                : 'bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 border-b-[2.5px] border-b-slate-300 shadow-xs hover:border-slate-400 active:translate-y-0.5'
            }`}
          >
            <TrendingDown size={16} className={activeTab === 'deductions' ? 'text-slate-300' : 'text-slate-600'} />
            <span>الخصومات والاستقطاعات</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: MONTHLY PAYROLL RUN (مسير الرواتب الشهري) */}
      {/* ======================================================== */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          {/* Top Monthly KPI Ribbons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-bold block mb-1">إجمالي الرواتب الأساسية:</span>
              <div className="text-lg font-bold font-mono text-slate-900">
                {overallStats.totalBasic.toLocaleString()} <span className="text-xs font-normal text-slate-500">{currency}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">لعدد {overallStats.totalEmployees} موظف</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-xs">
              <span className="text-[11px] text-blue-700 font-bold block mb-1">إجمالي البدلات والمكافآت:</span>
              <div className="text-lg font-bold font-mono text-blue-700">
                +{(overallStats.totalAllowances + overallStats.totalBonuses).toLocaleString()} <span className="text-xs font-normal text-blue-500">{currency}</span>
              </div>
              <span className="text-[10px] text-blue-500 mt-1 block">سكن، نقل، مكافآت، وإضافي</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-xs">
              <span className="text-[11px] text-amber-700 font-bold block mb-1">أقساط السلف المخصومة:</span>
              <div className="text-lg font-bold font-mono text-amber-700">
                -{overallStats.totalLoansDeducted.toLocaleString()} <span className="text-xs font-normal text-amber-500">{currency}</span>
              </div>
              <span className="text-[10px] text-amber-600 mt-1 block">خصمت من سلف الموظفين</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs">
              <span className="text-[11px] text-rose-700 font-bold block mb-1">إجمالي الخصومات والتأمينات:</span>
              <div className="text-lg font-bold font-mono text-rose-700">
                -{overallStats.totalDeductions.toLocaleString()} <span className="text-xs font-normal text-rose-500">{currency}</span>
              </div>
              <span className="text-[10px] text-rose-500 mt-1 block">غياب، تأمينات GOSI، وجزاءات</span>
            </div>

            <div className="bg-linear-to-bl from-blue-700 to-blue-900 text-white p-4 rounded-2xl shadow-md">
              <span className="text-[11px] text-blue-200 font-bold block mb-1">صافي الرواتب المستحقة (Net):</span>
              <div className="text-xl font-bold font-mono text-white">
                {overallStats.totalNet.toLocaleString()} <span className="text-xs font-normal text-blue-200">{currency}</span>
              </div>
              <span className="text-[10px] text-blue-200 mt-1 block">المبلغ الإجمالي للتحويل البنكي</span>
            </div>
          </div>

          {/* Month Selector & Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">شهر المسير:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-blue-500 bg-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">القسم:</span>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 bg-white"
                >
                  <option value="ALL">جميع الأقسام والإدارات</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <ExportButtonGroup
                title={`مسير الرواتب والأجور لشهر ${selectedMonth}`}
                filename={`مسير_رواتب_${selectedMonth}`}
                headers={[
                  'اسم الموظف',
                  'المسمى الوظيفي',
                  'القسم',
                  'الراتب الأساسي',
                  'بدل السكن',
                  'بدل النقل',
                  'بدلات أخرى',
                  'المكافآت والإضافي',
                  'إجمالي المستحق',
                  'خصم التأمينات GOSI',
                  'أقساط السلف والخصومات',
                  'إجمالي الاستقطاعات',
                  'صافي الراتب المستحق',
                  'اسم البنك',
                  'الآيبان IBAN'
                ]}
                rows={payrollRecords.map(r => [
                  r.employeeName,
                  r.jobTitle,
                  r.department,
                  r.basicSalary,
                  r.housingAllowance,
                  r.transportAllowance,
                  r.otherAllowances,
                  r.bonusesAmount,
                  r.grossSalary,
                  r.gosiDeduction || 0,
                  r.loanDeduction || 0,
                  r.deductionsAmount,
                  r.netSalary,
                  r.bankName || '-',
                  r.iban || '-'
                ])}
                filterSummary={`الشهر: ${selectedMonth} | القسم: ${selectedDepartment} | إجمالي الرواتب الصافية: ${overallStats.totalNet.toLocaleString()} ريال`}
                size="sm"
              />

              <button
                type="button"
                onClick={handleGeneratePayrollJournalEntry}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-b from-indigo-500 via-indigo-600 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-600/25 border-b-[2.5px] border-indigo-900 active:border-b active:translate-y-[1.5px] cursor-pointer"
                title="إثبات استحقاق الرواتب (من حـ/ مصروف الرواتب 5102 إلى حـ/ الرواتب المستحقة 2201)"
              >
                <Receipt size={15} className="text-indigo-100" />
                <span>1. قيد استحقاق الرواتب</span>
              </button>

              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 gap-1.5">
                <select
                  value={disbursementAccountId}
                  onChange={(e) => setDisbursementAccountId(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
                  title="اختر الصندوق أو البنك لصرف الرواتب منه"
                >
                  {treasuryAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.code})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleDisburseMonthlyPayroll}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-amber-600/25 border-b-[2.5px] border-amber-900 active:border-b active:translate-y-[1.5px] cursor-pointer"
                  title="صرف وسداد صافي الرواتب من الخزينة أو البنك المختار (من حـ/ الرواتب المستحقة 2201 إلى حـ/ البنك أو الصندوق)"
                >
                  <CreditCard size={15} className="text-amber-100" />
                  <span>2. صرف وسداد الرواتب</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsWpsModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-600/25 border-b-[2.5px] border-emerald-900 active:border-b active:translate-y-[1.5px] cursor-pointer"
              >
                <Download size={15} className="text-emerald-100" />
                <span>تصدير ملف WPS البنكي</span>
              </button>
            </div>
          </div>

          {/* Payroll Sheet Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="p-3.5">الموظف</th>
                    <th className="p-3.5">الأساسي</th>
                    <th className="p-3.5">بدل السكن</th>
                    <th className="p-3.5">بدل النقل</th>
                    <th className="p-3.5">بدلات أخرى</th>
                    <th className="p-3.5">المكافآت والإضافي</th>
                    <th className="p-3.5">إجمالي الاستحقاق</th>
                    <th className="p-3.5">قسط السلفة</th>
                    <th className="p-3.5">تأمينات وخصومات</th>
                    <th className="p-3.5 font-bold text-blue-900 bg-blue-50/50">صافي الراتب (Net)</th>
                    <th className="p-3.5 text-center">قسيمة الراتب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payrollRecords.map(rec => {
                    const emp = employees.find(e => e.id === rec.employeeId);
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">{rec.employeeName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{rec.employeeCode} - {rec.jobTitle}</div>
                        </td>
                        <td className="p-3.5 font-mono font-medium text-slate-800">
                          {rec.basicSalary.toLocaleString()} {currency}
                        </td>
                        <td className="p-3.5 font-mono text-slate-600">
                          +{rec.housingAllowance.toLocaleString()}
                        </td>
                        <td className="p-3.5 font-mono text-slate-600">
                          +{rec.transportAllowance.toLocaleString()}
                        </td>
                        <td className="p-3.5 font-mono text-slate-600">
                          +{rec.otherAllowances.toLocaleString()}
                        </td>
                        <td className="p-3.5 font-mono text-amber-700 font-medium">
                          {rec.bonusesAmount > 0 ? `+${rec.bonusesAmount.toLocaleString()}` : '0'}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-slate-900">
                          {rec.grossSalary.toLocaleString()} {currency}
                        </td>
                        <td className="p-3.5 font-mono text-amber-700 font-bold">
                          {rec.loanDeduction && rec.loanDeduction > 0 ? `-${rec.loanDeduction.toLocaleString()}` : '—'}
                        </td>
                        <td className="p-3.5 font-mono text-rose-600 font-bold">
                          -{rec.deductionsAmount.toLocaleString()}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-blue-700 bg-blue-50/30 text-sm">
                          {rec.netSalary.toLocaleString()} {currency}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => emp && setSelectedPayslipEmp(emp)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs border-b-2 border-blue-800 active:border-b active:translate-y-0.5 cursor-pointer mx-auto"
                          >
                            <FileText size={13} className="text-blue-100" />
                            <span>قسيمة الراتب</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {payrollRecords.length === 0 && (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">
                        لا يوجد موظفون مدرجون في مسير هذا الشهر
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: EMPLOYEES DIRECTORY (الموظفون والرواتب التعاقدية) */}
      {/* ======================================================== */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="بحث بالاسم، الكود، الهوية، أو الوظيفة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddEmployeeOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <Plus size={15} />
                <span>إضافة موظف جديد</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="p-3.5">كود</th>
                    <th className="p-3.5">الموظف</th>
                    <th className="p-3.5">الإدارة / القسم</th>
                    <th className="p-3.5">المسمى الوظيفي</th>
                    <th className="p-3.5">الهوية / الإقامة</th>
                    <th className="p-3.5">الراتب الأساسي</th>
                    <th className="p-3.5">إجمالي البدلات</th>
                    <th className="p-3.5 font-bold text-slate-900">الراتب التعاقدي</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map(emp => {
                    const totalAllowances = (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.foodAllowance || 0) + (emp.otherAllowances || 0);
                    const contractualTotal = emp.basicSalary + totalAllowances;
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/70">
                        <td className="p-3.5 font-mono font-bold text-blue-700">{emp.code}</td>
                        <td className="p-3.5 font-bold text-slate-900">{emp.name}</td>
                        <td className="p-3.5 text-slate-700">{emp.department}</td>
                        <td className="p-3.5 text-slate-700">{emp.jobTitle}</td>
                        <td className="p-3.5 font-mono text-slate-600">{emp.nationalId}</td>
                        <td className="p-3.5 font-mono text-slate-800">{emp.basicSalary.toLocaleString()} {currency}</td>
                        <td className="p-3.5 font-mono text-slate-600">+{totalAllowances.toLocaleString()} {currency}</td>
                        <td className="p-3.5 font-mono font-bold text-slate-900">{contractualTotal.toLocaleString()} {currency}</td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => { setEditingEmployee(emp); setIsEditEmployeeOpen(true); }}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="تعديل الموظف"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedPayslipEmp(emp)}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="قسيمة الراتب"
                            >
                              <FileText size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEmployee(emp.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 size={15} />
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
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: POINT 1 - LOANS & ADVANCES (السلف والقروض) */}
      {/* ======================================================== */}
      {activeTab === 'loans' && (
        <LoansTab 
          employees={employees} 
          currency={currency} 
          onRefresh={refreshAll} 
        />
      )}

      {/* ======================================================== */}
      {/* TAB 4: POINT 3 - OVERTIME & ATTENDANCE (الإضافي والغياب) */}
      {/* ======================================================== */}
      {activeTab === 'overtime_attendance' && (
        <OvertimeAttendanceTab
          employees={employees}
          currency={currency}
          selectedMonth={selectedMonth}
          onRefresh={refreshAll}
        />
      )}

      {/* ======================================================== */}
      {/* TAB 5: POINT 4 - END OF SERVICE (تصفية نهاية الخدمة) */}
      {/* ======================================================== */}
      {activeTab === 'end_of_service' && (
        <EndOfServiceTab
          employees={employees}
          currency={currency}
          onRefresh={refreshAll}
        />
      )}

      {/* ======================================================== */}
      {/* TAB 6: POINT 5 - DOCUMENT EXPIRY ALERTS (تنبيهات الوثائق) */}
      {/* ======================================================== */}
      {activeTab === 'documents_alerts' && (
        <DocumentAlertsTab
          employees={employees}
          onRefresh={refreshAll}
        />
      )}

      {/* ======================================================== */}
      {/* TAB 7: POINT 6 - GOSI INTEGRATION (التأمينات الاجتماعية) */}
      {/* ======================================================== */}
      {activeTab === 'gosi' && (
        <GosiTab
          employees={employees}
          currency={currency}
          onRefresh={refreshAll}
        />
      )}

      {/* ======================================================== */}
      {/* TAB 8: BONUSES & INCENTIVES (المكافآت والحوافز) */}
      {/* ======================================================== */}
      {activeTab === 'bonuses' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">سجل المكافآت وحوافز تحقيق الأهداف والتارجت</h3>
              <p className="text-xs text-slate-400">منح مكافآت التميز ونسب تحقيق مستهدفات المبيعات والعمل الإضافي</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddBonusOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus size={15} />
              <span>إضافة مكافأة / حافز</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.flatMap(emp => (emp.bonuses || []).map(b => ({ emp, bonus: b }))).map(({ emp, bonus }) => (
              <div key={bonus.id} className="bg-white p-4 rounded-2xl border border-amber-100 shadow-xs space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">{emp.name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">{emp.code} - {emp.jobTitle}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    {bonus.typeName}
                  </span>
                </div>
                <div className="text-base font-bold font-mono text-amber-700 pt-1">
                  +{bonus.amount.toLocaleString()} {currency}
                </div>
                <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  {bonus.reason}
                </p>
                <div className="text-[10px] font-mono text-slate-400 text-left pt-1">
                  التاريخ: {bonus.date}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 9: DEDUCTIONS (الخصومات والاستقطاعات) */}
      {/* ======================================================== */}
      {activeTab === 'deductions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">سجل الخصومات والاستقطاعات الإدارية</h3>
              <p className="text-xs text-slate-400">إثبات الغياب، التأخير، الجزاءات، وأقساط السداد</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddDeductionOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus size={15} />
              <span>تسجيل خصم / استقطاع</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.flatMap(emp => (emp.deductions || []).map(d => ({ emp, deduction: d }))).map(({ emp, deduction }) => (
              <div key={deduction.id} className="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">{emp.name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">{emp.code} - {emp.jobTitle}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    {deduction.typeName}
                  </span>
                </div>
                <div className="text-base font-bold font-mono text-rose-600 pt-1">
                  -{deduction.amount.toLocaleString()} {currency}
                </div>
                <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  {deduction.reason}
                </p>
                <div className="text-[10px] font-mono text-slate-400 text-left pt-1">
                  التاريخ: {deduction.date}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== GLOBAL MODALS ==================== */}

      {/* MODAL: WPS EXPORT MODAL */}
      {isWpsModalOpen && (
        <WpsModal
          payrollRecords={payrollRecords}
          monthStr={selectedMonth}
          currency={currency}
          onClose={() => setIsWpsModalOpen(false)}
        />
      )}

      {/* MODAL: ADD EMPLOYEE */}
      {isAddEmployeeOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">تسجيل موظف جديد في المنشأة</h3>
                  <p className="text-xs text-slate-400">إدخال البيانات الشخصية والوظيفية وهيكل الراتب والبدلات</p>
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
                  <label className="block text-slate-600 font-bold mb-1">الرقم الوظيفي (الكود):</label>
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
                    placeholder="مثال: عبد العزيز محمد الشمري"
                    value={newEmpData.name}
                    onChange={(e) => setNewEmpData({...newEmpData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">الإدارة / القسم:</label>
                  <input
                    list="dynamic-departments-list-add"
                    type="text"
                    required
                    placeholder="اختر أو اكتب القسم..."
                    value={newEmpData.department}
                    onChange={(e) => setNewEmpData({...newEmpData, department: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                  />
                  <datalist id="dynamic-departments-list-add">
                    {dynamicDepartmentsList.map((dep, idx) => (
                      <option key={idx} value={dep} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">المسمى الوظيفي:</label>
                  <input
                    list="dynamic-jobs-list-add"
                    type="text"
                    required
                    placeholder="مثال: مسؤول مبيعات وتطوير"
                    value={newEmpData.jobTitle}
                    onChange={(e) => setNewEmpData({...newEmpData, jobTitle: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                  />
                  <datalist id="dynamic-jobs-list-add">
                    {dynamicJobsList.map((job, idx) => (
                      <option key={idx} value={job} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">الجنسية والتأمينات:</label>
                  <select
                    value={newEmpData.nationalityType}
                    onChange={(e) => setNewEmpData({...newEmpData, nationalityType: e.target.value as any})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold"
                  >
                    <option value="SAUDI">سعودي (خاضع للتأمينات وساند)</option>
                    <option value="NON_SAUDI">مقيم / وافد غير سعودي</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">الهوية الوطنية / الإقامة:</label>
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
                  <label className="block text-slate-600 font-bold mb-1">رقم الجوال:</label>
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
                      value={newEmpData.basicSalary ?? ''}
                      onFocus={e => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value;
                        const basic = val === '' ? ('' as any) : Number(val);
                        setNewEmpData({
                          ...newEmpData,
                          basicSalary: basic,
                          housingAllowance: basic ? Math.round(Number(basic) * 0.25) : 0,
                          transportAllowance: basic ? Math.round(Number(basic) * 0.1) : 0
                        });
                      }}
                      onBlur={() => {
                        if ((newEmpData.basicSalary as any) === '') {
                          setNewEmpData(prev => ({ ...prev, basicSalary: 0 }));
                        }
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[11px] font-bold mb-1">بدل سكن (25%):</label>
                    <input
                      type="number"
                      min={0}
                      value={newEmpData.housingAllowance ?? ''}
                      onFocus={e => e.target.select()}
                      onChange={(e) => setNewEmpData({...newEmpData, housingAllowance: e.target.value === '' ? ('' as any) : Number(e.target.value)})}
                      onBlur={() => {
                        if ((newEmpData.housingAllowance as any) === '') {
                          setNewEmpData(prev => ({ ...prev, housingAllowance: 0 }));
                        }
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[11px] font-bold mb-1">بدل انتقال:</label>
                    <input
                      type="number"
                      min={0}
                      value={newEmpData.transportAllowance ?? ''}
                      onFocus={e => e.target.select()}
                      onChange={(e) => setNewEmpData({...newEmpData, transportAllowance: e.target.value === '' ? ('' as any) : Number(e.target.value)})}
                      onBlur={() => {
                        if ((newEmpData.transportAllowance as any) === '') {
                          setNewEmpData(prev => ({ ...prev, transportAllowance: 0 }));
                        }
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[11px] font-bold mb-1">بدلات أخرى:</label>
                    <input
                      type="number"
                      min={0}
                      value={newEmpData.otherAllowances ?? ''}
                      onFocus={e => e.target.select()}
                      onChange={(e) => setNewEmpData({...newEmpData, otherAllowances: e.target.value === '' ? ('' as any) : Number(e.target.value)})}
                      onBlur={() => {
                        if ((newEmpData.otherAllowances as any) === '') {
                          setNewEmpData(prev => ({ ...prev, otherAllowances: 0 }));
                        }
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                  <span>إجمالي الراتب التعاقدي:</span>
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

      {/* MODAL: EDIT EMPLOYEE */}
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
                  <p className="text-xs text-slate-400">تحديث بيانات ({editingEmployee.name})</p>
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
                  <label className="block text-slate-600 font-bold mb-1">الاسم الكامل:</label>
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
                  <input
                    list="dynamic-departments-list-edit"
                    type="text"
                    required
                    placeholder="اختر أو اكتب القسم..."
                    value={editingEmployee.department}
                    onChange={(e) => setEditingEmployee({...editingEmployee, department: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                  />
                  <datalist id="dynamic-departments-list-edit">
                    {dynamicDepartmentsList.map((dep, idx) => (
                      <option key={idx} value={dep} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">المسمى الوظيفي:</label>
                  <input
                    list="dynamic-jobs-list-edit"
                    type="text"
                    required
                    placeholder="المسمى الوظيفي..."
                    value={editingEmployee.jobTitle}
                    onChange={(e) => setEditingEmployee({...editingEmployee, jobTitle: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                  />
                  <datalist id="dynamic-jobs-list-edit">
                    {dynamicJobsList.map((job, idx) => (
                      <option key={idx} value={job} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 block">تفاصيل الراتب والبدلات الشهرية التعاقدية ({currency})</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-500 text-[11px] font-bold mb-1">الراتب الأساسي:</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={editingEmployee.basicSalary ?? ''}
                      onFocus={e => e.target.select()}
                      onChange={(e) => setEditingEmployee({...editingEmployee, basicSalary: e.target.value === '' ? ('' as any) : Number(e.target.value)})}
                      onBlur={() => {
                        if ((editingEmployee.basicSalary as any) === '') setEditingEmployee({...editingEmployee, basicSalary: 0});
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[11px] font-bold mb-1">بدل سكن:</label>
                    <input
                      type="number"
                      min={0}
                      value={editingEmployee.housingAllowance ?? ''}
                      onFocus={e => e.target.select()}
                      onChange={(e) => setEditingEmployee({...editingEmployee, housingAllowance: e.target.value === '' ? ('' as any) : Number(e.target.value)})}
                      onBlur={() => {
                        if ((editingEmployee.housingAllowance as any) === '') setEditingEmployee({...editingEmployee, housingAllowance: 0});
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[11px] font-bold mb-1">بدل انتقال:</label>
                    <input
                      type="number"
                      min={0}
                      value={editingEmployee.transportAllowance ?? ''}
                      onFocus={e => e.target.select()}
                      onChange={(e) => setEditingEmployee({...editingEmployee, transportAllowance: e.target.value === '' ? ('' as any) : Number(e.target.value)})}
                      onBlur={() => {
                        if ((editingEmployee.transportAllowance as any) === '') setEditingEmployee({...editingEmployee, transportAllowance: 0});
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[11px] font-bold mb-1">بدل إعاشة وطبيعة عمل:</label>
                    <input
                      type="number"
                      min={0}
                      value={editingEmployee.foodAllowance ?? ''}
                      onFocus={e => e.target.select()}
                      onChange={(e) => setEditingEmployee({...editingEmployee, foodAllowance: e.target.value === '' ? ('' as any) : Number(e.target.value)})}
                      onBlur={() => {
                        if ((editingEmployee.foodAllowance as any) === '') setEditingEmployee({...editingEmployee, foodAllowance: 0});
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[11px] font-bold mb-1">بدلات أخرى:</label>
                    <input
                      type="number"
                      min={0}
                      value={editingEmployee.otherAllowances ?? ''}
                      onFocus={e => e.target.select()}
                      onChange={(e) => setEditingEmployee({...editingEmployee, otherAllowances: e.target.value === '' ? ('' as any) : Number(e.target.value)})}
                      onBlur={() => {
                        if ((editingEmployee.otherAllowances as any) === '') setEditingEmployee({...editingEmployee, otherAllowances: 0});
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono"
                    />
                  </div>
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

      {/* MODAL: ADD BONUS */}
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
                  <label className="block text-slate-600 font-bold mb-1">نوع المكافأة:</label>
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
                    value={newBonusData.amount ?? ''}
                    onFocus={e => e.target.select()}
                    onChange={(e) => setNewBonusData({...newBonusData, amount: e.target.value === '' ? ('' as any) : Number(e.target.value)})}
                    onBlur={() => {
                      if ((newBonusData.amount as any) === '') setNewBonusData(prev => ({ ...prev, amount: 0 }));
                    }}
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
                  placeholder="مثال: تخطي حاجز المبيعات بنسبة 120%"
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

      {/* MODAL: ADD DEDUCTION */}
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
                  <p className="text-[11px] text-slate-400">إثبات غياب، تأخير، أو جزاء إداري</p>
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
                    value={newDeductionData.amount ?? ''}
                    onFocus={e => e.target.select()}
                    onChange={(e) => setNewDeductionData({...newDeductionData, amount: e.target.value === '' ? ('' as any) : Number(e.target.value)})}
                    onBlur={() => {
                      if ((newDeductionData.amount as any) === '') setNewDeductionData(prev => ({ ...prev, amount: 0 }));
                    }}
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
                  placeholder="سبب الخصم..."
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

      {/* MODAL: PAYSLIP PREVIEW & PRINT */}
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
                const { totalDeductions, grossSalary, netSalary, loanInstallmentAmount, gosiAmount } = calculateEmployeeTotals(selectedPayslipEmp, selectedMonth, loans);
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
                          {loanInstallmentAmount > 0 && (
                            <div className="flex justify-between text-amber-800 font-bold bg-amber-50/60 p-1 rounded">
                              <span>قسط سداد سلفة شهر {selectedMonth}:</span>
                              <span className="font-mono">-{loanInstallmentAmount.toLocaleString()}</span>
                            </div>
                          )}
                          {gosiAmount > 0 && (
                            <div className="flex justify-between text-slate-700">
                              <span>اشتراك التأمينات (GOSI):</span>
                              <span className="font-mono text-rose-600 font-bold">-{gosiAmount.toLocaleString()}</span>
                            </div>
                          )}
                          {(selectedPayslipEmp.deductions || []).map(d => (
                            <div key={d.id} className="flex justify-between text-slate-600">
                              <span className="text-[11px] truncate max-w-[150px]" title={d.typeName}>{d.typeName}:</span>
                              <span className="font-mono text-rose-600 font-bold">-{d.amount.toLocaleString()}</span>
                            </div>
                          ))}
                          {totalDeductions === 0 && (
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
