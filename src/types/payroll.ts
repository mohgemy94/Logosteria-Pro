export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED' | 'TERMINATED';

export interface BonusIncentive {
  id: string;
  type: 'BONUS' | 'TARGET_INCENTIVE' | 'COMMISSION' | 'EXCELLENCE' | 'OVERTIME'; // مكافأة، حافز تحقيق أهداف/تارجت، عمولة، تميز، عمل إضافي
  typeName: string; // الاسم العربي
  amount: number;
  date: string;
  reason: string;
  status: 'PENDING' | 'APPROVED';
}

export interface DeductionItem {
  id: string;
  type: 'ABSENCE' | 'DELAY' | 'LOAN_INSTALLMENT' | 'PENALTY' | 'INSURANCE'; // غياب، تأخير، قسط سلفة، جزاء، تأمينات
  typeName: string; // الاسم العربي
  amount: number;
  date: string;
  reason: string;
  status: 'APPLIED';
  loanId?: string; // إذا كان الاستقطاع مرتبط بقسط سلفة
}

export interface AllowanceItem {
  id: string;
  name: string; // بدل سكن، بدل نقل، بدل هاتف، بدل طبيعة عمل
  amount: number;
  isFixed: boolean; // ثابت شهرياً
}

export interface LoanInstallment {
  id: string;
  installmentNumber: number;
  month: string; // "2024-09"
  amount: number;
  status: 'PENDING' | 'PAID' | 'DEFERRED';
  paidDate?: string | undefined;
  notes?: string | undefined;
}

export interface LoanAdvance {
  id: string;
  loanNumber: string; // e.g. "LOAN-2024-001"
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  amount: number; // إجمالي مبلغ السلفة
  disbursementDate: string; // تاريخ الصرف
  installmentsCount: number; // عدد الأقساط
  monthlyInstallment: number; // قيمة القسط الشهري
  startMonth: string; // شهر بداية الاستقطاع "2024-09"
  paidAmount: number; // إجمالي المسدد
  remainingAmount: number; // المتبقي
  status: 'ACTIVE' | 'PAID' | 'SUSPENDED'; // سارية / مسددة / معلقة
  reason: string; // سبب السلفة (سلفة طارئة، سلفة زواج، سلفة علاجية، أخرى)
  disbursementAccount: string; // الخزينة أو الحساب البنكي المنصرف منه
  installments: LoanInstallment[];
  notes?: string;
}

export interface AttendanceOvertimeRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  type: 'OVERTIME' | 'ABSENCE' | 'DELAY';
  hoursOrDays: number; // عدد الساعات للإضافي والتأخير، أو عدد الأيام للغياب
  multiplier: number; // 1.5x للساعات العادية، 2.0x للعطلات
  calculatedAmount: number;
  status: 'APPLIED_TO_PAYROLL' | 'PENDING';
  month: string; // "2024-09"
  notes?: string;
}

export interface EndOfServiceSettlement {
  id: string;
  settlementNumber: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  joinDate: string;
  terminationDate: string;
  serviceDuration: {
    years: number;
    months: number;
    days: number;
    totalDays: number;
  };
  reason: 'RESIGNATION' | 'TERMINATION_BY_EMPLOYER' | 'CONTRACT_EXPIRED' | 'FORCE_MAJEURE';
  reasonLabel: string;
  lastBasicSalary: number;
  lastAllowances: number;
  lastTotalSalary: number;
  serviceGratuityAmount: number; // مكافأة نهاية الخدمة المستحقة
  unusedVacationDays: number;
  unusedVacationAmount: number; // بدل رصيد الإجازات
  otherBenefits: number; // مستحقات ومكافآت أخرى
  outstandingLoansDeduction: number; // خصم السلف المتبقية
  otherDeductions: number; // خصومات أخرى
  netSettlementAmount: number; // صافي مستحقات التصفية
  status: 'DRAFT' | 'APPROVED' | 'PAID';
  paymentDate?: string;
  notes?: string;
}

export interface Employee {
  id: string;
  code: string; // e.g. EMP-101
  name: string;
  department: string;
  jobTitle: string;
  nationalId: string;
  phone: string;
  email: string;
  joinDate: string;
  bankName: string;
  iban: string;
  basicSalary: number; // الراتب الأساسي
  
  // البدلات الثابتة الشهرية
  housingAllowance: number; // بدل سكن
  transportAllowance: number; // بدل انتقال
  foodAllowance: number; // بدل إعاشة/طبيعة عمل
  otherAllowances: number; // بدلات أخرى
  
  status: EmployeeStatus;
  
  // الجنسية والتأمينات (GOSI)
  nationalityType?: 'SAUDI' | 'NON_SAUDI';
  gosiSubscription?: boolean;
  gosiEmployeePercent?: number; // افتراضي 9.75% للسعودي، 0% لغير السعودي
  gosiCompanyPercent?: number;  // افتراضي 11.75% للسعودي، 2% لغير السعودي
  
  // تواريخ انتهاء الوثائق والعقود
  contractExpiryDate?: string;
  idExpiryDate?: string;
  passportExpiryDate?: string;
  insuranceExpiryDate?: string;
  
  // سجل المكافآت والحوافز
  bonuses: BonusIncentive[];
  
  // سجل الخصومات والاستقطاعات
  deductions: DeductionItem[];
  
  notes?: string;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  jobTitle: string;
  nationalId?: string;
  iban?: string;
  bankName?: string;
  month: string; // e.g. "2024-09"
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  totalAllowances: number;
  bonusesAmount: number; // إجمالي المكافآت وحوافز التارجت والعمل الإضافي
  grossSalary: number; // إجمالي الاستحقاق
  deductionsAmount: number; // إجمالي الخصومات والغياب والتأمينات وأقساط السلف
  loanDeduction?: number; // قسط السلفة الخاص بهذا الشهر
  gosiDeduction?: number; // حصة التأمينات
  netSalary: number; // صافي الراتب المستحق
  paymentStatus: 'PENDING' | 'APPROVED' | 'PAID';
  paymentDate?: string;
  paymentMethod: 'BANK_TRANSFER' | 'CASH' | 'CHEQUE';
}

