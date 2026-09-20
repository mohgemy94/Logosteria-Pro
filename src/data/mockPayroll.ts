import { 
  Employee, 
  PayrollRecord, 
  LoanAdvance, 
  LoanInstallment, 
  AttendanceOvertimeRecord, 
  EndOfServiceSettlement 
} from '../types/payroll';

export const STORAGE_KEY_EMPLOYEES = 'alpha_accounting_employees_v1';
export const STORAGE_KEY_LOANS = 'alpha_accounting_loans_v1';
export const STORAGE_KEY_ATTENDANCE = 'alpha_accounting_attendance_v1';
export const STORAGE_KEY_SETTLEMENTS = 'alpha_accounting_settlements_v1';

export const INITIAL_EMPLOYEES: Employee[] = [];

// ==================== EMPLOYEES ====================
export function getStoredEmployees(): Employee[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EMPLOYEES);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed reading employees from localStorage', e);
  }
  return INITIAL_EMPLOYEES;
}

export function saveStoredEmployees(employees: Employee[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(employees));
    window.dispatchEvent(new Event('alpha-payroll-updated'));
  } catch (e) {
    console.error('Failed saving employees to localStorage', e);
  }
}

// ==================== LOANS & ADVANCES (السلف والقروض) ====================
export function getStoredLoans(): LoanAdvance[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOANS);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed reading loans from localStorage', e);
  }
  return [];
}

export function saveStoredLoans(loans: LoanAdvance[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_LOANS, JSON.stringify(loans));
    window.dispatchEvent(new Event('alpha-payroll-updated'));
  } catch (e) {
    console.error('Failed saving loans to localStorage', e);
  }
}

export function generateLoanSchedule(
  loanId: string, 
  amount: number, 
  installmentsCount: number, 
  startMonth: string
): LoanInstallment[] {
  const count = Math.max(1, installmentsCount);
  const monthly = Math.floor(amount / count);
  const remainder = amount - (monthly * count);

  const parts = (startMonth || '2024-09').split('-');
  const yearStr = parts[0] || '2024';
  const monthStr = parts[1] || '09';
  let currentYear = parseInt(yearStr, 10) || new Date().getFullYear();
  let currentMonth = parseInt(monthStr, 10) || (new Date().getMonth() + 1);

  const schedule: LoanInstallment[] = [];

  for (let i = 1; i <= count; i++) {
    // Add remainder to the last installment
    const installmentAmt = (i === count) ? (monthly + remainder) : monthly;
    const formattedMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    schedule.push({
      id: `inst-${loanId}-${i}`,
      installmentNumber: i,
      month: formattedMonth,
      amount: installmentAmt,
      status: 'PENDING'
    });

    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }

  return schedule;
}

// ==================== ATTENDANCE & OVERTIME ====================
export function getStoredAttendanceRecords(): AttendanceOvertimeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ATTENDANCE);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed reading attendance records from localStorage', e);
  }
  return [];
}

export function saveStoredAttendanceRecords(records: AttendanceOvertimeRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(records));
    window.dispatchEvent(new Event('alpha-payroll-updated'));
  } catch (e) {
    console.error('Failed saving attendance records to localStorage', e);
  }
}

// ==================== END OF SERVICE SETTLEMENTS ====================
export function getStoredSettlements(): EndOfServiceSettlement[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTLEMENTS);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed reading settlements from localStorage', e);
  }
  return [];
}

export function saveStoredSettlements(settlements: EndOfServiceSettlement[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_SETTLEMENTS, JSON.stringify(settlements));
    window.dispatchEvent(new Event('alpha-payroll-updated'));
  } catch (e) {
    console.error('Failed saving settlements to localStorage', e);
  }
}

// ==================== TOTALS & PAYROLL CALCULATIONS ====================
export function calculateEmployeeTotals(emp: Employee, targetMonth?: string, activeLoans: LoanAdvance[] = []) {
  const totalAllowances = (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.foodAllowance || 0) + (emp.otherAllowances || 0);
  
  // Filter bonuses if targetMonth is provided, or sum all for employee general view
  const totalBonuses = (emp.bonuses || []).reduce((sum, b) => {
    if (!targetMonth || b.date.startsWith(targetMonth)) {
      return sum + (b.amount || 0);
    }
    return sum + (b.amount || 0);
  }, 0);

  // Deductions from employee profile
  let totalDeductions = (emp.deductions || []).reduce((sum, d) => {
    return sum + (d.amount || 0);
  }, 0);

  // Active Loan installment for target month
  let loanInstallmentAmount = 0;
  if (targetMonth) {
    activeLoans
      .filter(l => l.employeeId === emp.id && l.status === 'ACTIVE')
      .forEach(l => {
        const inst = l.installments.find(i => i.month === targetMonth && i.status === 'PENDING');
        if (inst) {
          loanInstallmentAmount += inst.amount;
        }
      });
  }

  // GOSI Calculation (if enabled)
  let gosiAmount = 0;
  if (emp.gosiSubscription) {
    const rate = emp.gosiEmployeePercent !== undefined ? emp.gosiEmployeePercent : (emp.nationalityType === 'SAUDI' ? 9.75 : 0);
    const wageBase = emp.basicSalary + (emp.housingAllowance || 0);
    gosiAmount = Math.round((wageBase * rate) / 100);
  }

  const grandDeductions = totalDeductions + loanInstallmentAmount + gosiAmount;
  const grossSalary = emp.basicSalary + totalAllowances + totalBonuses;
  const netSalary = Math.max(0, grossSalary - grandDeductions);

  return {
    totalAllowances,
    totalBonuses,
    totalDeductions: grandDeductions,
    baseDeductions: totalDeductions,
    loanInstallmentAmount,
    gosiAmount,
    grossSalary,
    netSalary
  };
}

export function generatePayrollRecords(
  employees: Employee[], 
  monthStr: string = '2024-09',
  loans: LoanAdvance[] = []
): PayrollRecord[] {
  return employees.map(emp => {
    const { 
      totalAllowances, 
      totalBonuses, 
      totalDeductions, 
      loanInstallmentAmount,
      gosiAmount,
      grossSalary, 
      netSalary 
    } = calculateEmployeeTotals(emp, monthStr, loans);

    return {
      id: `pr-${emp.id}-${monthStr}`,
      employeeId: emp.id,
      employeeCode: emp.code,
      employeeName: emp.name,
      department: emp.department,
      jobTitle: emp.jobTitle,
      nationalId: emp.nationalId,
      iban: emp.iban,
      bankName: emp.bankName,
      month: monthStr,
      basicSalary: emp.basicSalary,
      housingAllowance: emp.housingAllowance || 0,
      transportAllowance: emp.transportAllowance || 0,
      otherAllowances: (emp.foodAllowance || 0) + (emp.otherAllowances || 0),
      totalAllowances,
      bonusesAmount: totalBonuses,
      grossSalary,
      deductionsAmount: totalDeductions,
      loanDeduction: loanInstallmentAmount,
      gosiDeduction: gosiAmount,
      netSalary,
      paymentStatus: 'APPROVED',
      paymentMethod: 'BANK_TRANSFER'
    };
  });
}

// ==================== END OF SERVICE CALCULATOR HELPER ====================
export function calculateGratuity(
  basicSalary: number,
  allowances: number,
  joinDateStr: string,
  endDateStr: string,
  reason: 'RESIGNATION' | 'TERMINATION_BY_EMPLOYER' | 'CONTRACT_EXPIRED' | 'FORCE_MAJEURE',
  unusedVacationDays: number = 0
) {
  const start = new Date(joinDateStr);
  const end = new Date(endDateStr);
  const diffTime = Math.max(0, end.getTime() - start.getTime());
  const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  const years = Math.floor(totalDays / 365.25);
  const remainingDays = totalDays % 365.25;
  const months = Math.floor(remainingDays / 30.4375);
  const days = Math.floor(remainingDays % 30.4375);

  const totalWage = basicSalary + allowances;
  const serviceYearsFraction = totalDays / 365.25;

  let baseGratuity = 0;
  if (serviceYearsFraction <= 5) {
    baseGratuity = serviceYearsFraction * (totalWage / 2);
  } else {
    const first5 = 5 * (totalWage / 2);
    const extraYears = serviceYearsFraction - 5;
    const rest = extraYears * totalWage;
    baseGratuity = first5 + rest;
  }

  // Reason multiplier
  let entitlementRatio = 1.0;
  let reasonLabel = 'إنهاء العقد من المنشأة / فسخ نظامي';

  if (reason === 'RESIGNATION') {
    reasonLabel = 'استقالة بمبادرة الموظف';
    if (serviceYearsFraction < 2) {
      entitlementRatio = 0;
    } else if (serviceYearsFraction >= 2 && serviceYearsFraction < 5) {
      entitlementRatio = 1 / 3;
    } else if (serviceYearsFraction >= 5 && serviceYearsFraction < 10) {
      entitlementRatio = 2 / 3;
    } else {
      entitlementRatio = 1.0;
    }
  } else if (reason === 'CONTRACT_EXPIRED') {
    reasonLabel = 'انتهاء مدة العقد المحددة';
    entitlementRatio = 1.0;
  } else if (reason === 'FORCE_MAJEURE') {
    reasonLabel = 'قوة قاهرة / ترك العمل لسبب مشروع';
    entitlementRatio = 1.0;
  }

  const finalGratuity = Math.round(baseGratuity * entitlementRatio);
  const dayRate = totalWage / 30;
  const vacationCompensation = Math.round(unusedVacationDays * dayRate);

  return {
    years,
    months,
    days,
    totalDays,
    serviceYearsFraction,
    totalWage,
    baseGratuity: Math.round(baseGratuity),
    entitlementRatio,
    reasonLabel,
    finalGratuity,
    vacationCompensation,
    totalSettlement: finalGratuity + vacationCompensation
  };
}
