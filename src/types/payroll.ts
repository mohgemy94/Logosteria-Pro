export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED';

export interface BonusIncentive {
  id: string;
  type: 'BONUS' | 'TARGET_INCENTIVE' | 'COMMISSION' | 'EXCELLENCE'; // مكافأة، حافز تحقيق أهداف/تارجت (حواجز الإنجاز)، عمولة، تميز
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
}

export interface AllowanceItem {
  id: string;
  name: string; // بدل سكن، بدل نقل، بدل هاتف، بدل طبيعة عمل
  amount: number;
  isFixed: boolean; // ثابت شهرياً
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
  month: string; // e.g. "2024-09"
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  totalAllowances: number;
  bonusesAmount: number; // إجمالي المكافآت وحوافز التارجت
  grossSalary: number; // إجمالي الاستحقاق
  deductionsAmount: number; // إجمالي الخصومات والغياب والتأمينات
  netSalary: number; // صافي الراتب المستحق
  paymentStatus: 'PENDING' | 'APPROVED' | 'PAID';
  paymentDate?: string;
  paymentMethod: 'BANK_TRANSFER' | 'CASH' | 'CHEQUE';
}
