import { Employee, PayrollRecord } from '../types/payroll';

const STORAGE_KEY_EMPLOYEES = 'alpha_accounting_employees_v1';

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    code: 'EMP-101',
    name: 'أحمد منصور الحربي',
    department: 'الإدارة المالية',
    jobTitle: 'رئيس حسابات أول',
    nationalId: '1088492019',
    phone: '0551234567',
    email: 'ahmed.harbi@alpha.com',
    joinDate: '2022-01-15',
    bankName: 'مصرف الراجحي',
    iban: 'SA4480000201608010001234',
    basicSalary: 9500,
    housingAllowance: 2375,
    transportAllowance: 800,
    foodAllowance: 400,
    otherAllowances: 300,
    status: 'ACTIVE',
    bonuses: [
      {
        id: 'b-1',
        type: 'EXCELLENCE',
        typeName: 'مكافأة تميز وإقفال مالي',
        amount: 1500,
        date: '2024-09-01',
        reason: 'إنجاز القوائم المالية الشهرية في الوقت القياسي',
        status: 'APPROVED'
      }
    ],
    deductions: [
      {
        id: 'd-1',
        type: 'INSURANCE',
        typeName: 'استقطاع التأمينات الاجتماعية (GOSI)',
        amount: 950,
        date: '2024-09-05',
        reason: 'حصة الموظف من التأمينات 10%',
        status: 'APPLIED'
      }
    ]
  },
  {
    id: 'emp-2',
    code: 'EMP-102',
    name: 'سارة فهد القحطاني',
    department: 'المبيعات والتسويق',
    jobTitle: 'مشرفة مبيعات كبار العملاء',
    nationalId: '1092748192',
    phone: '0569876543',
    email: 'sara.qahtani@alpha.com',
    joinDate: '2022-06-01',
    bankName: 'البنك الأهلي السعودي (SNB)',
    iban: 'SA1210000001234567890123',
    basicSalary: 7500,
    housingAllowance: 1875,
    transportAllowance: 900,
    foodAllowance: 300,
    otherAllowances: 0,
    status: 'ACTIVE',
    bonuses: [
      {
        id: 'b-2',
        type: 'TARGET_INCENTIVE',
        typeName: 'حافز كسر حاجز المبيعات المستهدف',
        amount: 2800,
        date: '2024-09-03',
        reason: 'تخطي حاجز التارجت الشهري بنسبة 135%',
        status: 'APPROVED'
      }
    ],
    deductions: [
      {
        id: 'd-2',
        type: 'DELAY',
        typeName: 'خصم تأخير دقائق حضور',
        amount: 120,
        date: '2024-09-04',
        reason: 'تأخر صباحي تراكمي تجاوز 45 دقيقة',
        status: 'APPLIED'
      },
      {
        id: 'd-3',
        type: 'INSURANCE',
        typeName: 'استقطاع التأمينات الاجتماعية (GOSI)',
        amount: 750,
        date: '2024-09-05',
        reason: 'حصة الموظف من التأمينات 10%',
        status: 'APPLIED'
      }
    ]
  },
  {
    id: 'emp-3',
    code: 'EMP-103',
    name: 'محمد إبراهيم الشمري',
    department: 'إدارة المستودعات واللوجستيات',
    jobTitle: 'أمين مستودع رئيسي',
    nationalId: '1074839201',
    phone: '0503344556',
    email: 'mohamed.shammari@alpha.com',
    joinDate: '2023-02-10',
    bankName: 'مصرف الإنماء',
    iban: 'SA3305000068201938472910',
    basicSalary: 6000,
    housingAllowance: 1500,
    transportAllowance: 600,
    foodAllowance: 500,
    otherAllowances: 400, // بدل طبيعة عمل ومخاطر
    status: 'ACTIVE',
    bonuses: [
      {
        id: 'b-3',
        type: 'BONUS',
        typeName: 'مكافأة جرد دوري بدون فوارق',
        amount: 750,
        date: '2024-09-02',
        reason: 'مطابقة تامة بين الجرد الفعلي والسجلات الدفترية',
        status: 'APPROVED'
      }
    ],
    deductions: [
      {
        id: 'd-4',
        type: 'LOAN_INSTALLMENT',
        typeName: 'قسط سلفة الموظف الشهرية',
        amount: 500,
        date: '2024-09-05',
        reason: 'سداد القسط 3 من 6 لسلفة شهرية سابقة',
        status: 'APPLIED'
      },
      {
        id: 'd-5',
        type: 'INSURANCE',
        typeName: 'استقطاع التأمينات الاجتماعية (GOSI)',
        amount: 600,
        date: '2024-09-05',
        reason: 'حصة الموظف من التأمينات 10%',
        status: 'APPLIED'
      }
    ]
  },
  {
    id: 'emp-4',
    code: 'EMP-104',
    name: 'عمر خالد الدوسري',
    department: 'تقنية المعلومات والنظم',
    jobTitle: 'أخصائي شبكات ونظم تخطيط موارد',
    nationalId: '1063920192',
    phone: '0547788990',
    email: 'omar.dossari@alpha.com',
    joinDate: '2021-11-20',
    bankName: 'بنك الرياض',
    iban: 'SA8820000001092837465019',
    basicSalary: 8800,
    housingAllowance: 2200,
    transportAllowance: 800,
    foodAllowance: 300,
    otherAllowances: 500, // بدل دعم فني وهاتف
    status: 'ACTIVE',
    bonuses: [
      {
        id: 'b-4',
        type: 'BONUS',
        typeName: 'حافز استقرار الأنظمة وسرعة الدعم',
        amount: 1000,
        date: '2024-09-01',
        reason: 'صيانة وتطوير الخوادم وقواعد البيانات بنجاح',
        status: 'APPROVED'
      }
    ],
    deductions: [
      {
        id: 'd-6',
        type: 'INSURANCE',
        typeName: 'استقطاع التأمينات الاجتماعية (GOSI)',
        amount: 880,
        date: '2024-09-05',
        reason: 'حصة الموظف من التأمينات 10%',
        status: 'APPLIED'
      }
    ]
  },
  {
    id: 'emp-5',
    code: 'EMP-105',
    name: 'ريم سلطان العتيبي',
    department: 'الموارد البشرية والشؤون الإدارية',
    jobTitle: 'أخصائية شؤون الموظفين والرواتب',
    nationalId: '1058392018',
    phone: '0591122334',
    email: 'reem.otaibi@alpha.com',
    joinDate: '2023-08-01',
    bankName: 'مصرف الراجحي',
    iban: 'SA9280000301928471928301',
    basicSalary: 6800,
    housingAllowance: 1700,
    transportAllowance: 700,
    foodAllowance: 250,
    otherAllowances: 0,
    status: 'ACTIVE',
    bonuses: [
      {
        id: 'b-5',
        type: 'TARGET_INCENTIVE',
        typeName: 'حافز إنجاز مسيرات حماية الأجور (WPS)',
        amount: 900,
        date: '2024-09-02',
        reason: 'إيداع وتوثيق ملفات حماية الأجور بنسبة التزام 100%',
        status: 'APPROVED'
      }
    ],
    deductions: [
      {
        id: 'd-7',
        type: 'ABSENCE',
        typeName: 'خصم غياب يوم غير مدفوع',
        amount: 226.66,
        date: '2024-09-03',
        reason: 'غياب بدون إذن مسبق ليوم عمل واحد',
        status: 'APPLIED'
      },
      {
        id: 'd-8',
        type: 'INSURANCE',
        typeName: 'استقطاع التأمينات الاجتماعية (GOSI)',
        amount: 680,
        date: '2024-09-05',
        reason: 'حصة الموظف من التأمينات 10%',
        status: 'APPLIED'
      }
    ]
  }
];

export function getStoredEmployees(): Employee[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EMPLOYEES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
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
  } catch (e) {
    console.error('Failed saving employees to localStorage', e);
  }
}

export function calculateEmployeeTotals(emp: Employee) {
  const totalAllowances = (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.foodAllowance || 0) + (emp.otherAllowances || 0);
  const totalBonuses = (emp.bonuses || []).reduce((sum, b) => sum + (b.amount || 0), 0);
  const totalDeductions = (emp.deductions || []).reduce((sum, d) => sum + (d.amount || 0), 0);
  const grossSalary = emp.basicSalary + totalAllowances + totalBonuses;
  const netSalary = Math.max(0, grossSalary - totalDeductions);

  return {
    totalAllowances,
    totalBonuses,
    totalDeductions,
    grossSalary,
    netSalary
  };
}

export function generatePayrollRecords(employees: Employee[], monthStr: string = '2024-09'): PayrollRecord[] {
  return employees.map(emp => {
    const { totalAllowances, totalBonuses, totalDeductions, grossSalary, netSalary } = calculateEmployeeTotals(emp);
    return {
      id: `pr-${emp.id}-${monthStr}`,
      employeeId: emp.id,
      employeeCode: emp.code,
      employeeName: emp.name,
      department: emp.department,
      jobTitle: emp.jobTitle,
      month: monthStr,
      basicSalary: emp.basicSalary,
      housingAllowance: emp.housingAllowance || 0,
      transportAllowance: emp.transportAllowance || 0,
      otherAllowances: (emp.foodAllowance || 0) + (emp.otherAllowances || 0),
      totalAllowances,
      bonusesAmount: totalBonuses,
      grossSalary,
      deductionsAmount: totalDeductions,
      netSalary,
      paymentStatus: 'APPROVED',
      paymentMethod: 'BANK_TRANSFER'
    };
  });
}
