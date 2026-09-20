export type CostCenterType = 'BRANCH' | 'PROJECT' | 'FLEET' | 'DEPARTMENT' | 'OTHER';

export type CostCenterStatus = 'ACTIVE' | 'INACTIVE';

export interface CostCenter {
  id: string;
  code: string;                  // e.g. CC-101
  name: string;                  // e.g. الفرع الرئيسي - الرياض
  type: CostCenterType;          // فرع، مشروع، أسطول نقليات، قسم
  manager?: string | undefined;              // مسؤول / مدير المركز
  budget?: number | undefined;               // الميزانية التقديرية المعتمدة
  description?: string | undefined;          // ملاحظات ووصف المركز
  status: CostCenterStatus;      // نشط / غير نشط
  createdAt: string;
  updatedAt?: string | undefined;
}

export interface CostCenterExpenseItem {
  accountCode: string;
  accountName: string;
  amount: number;
  percentage: number;
}

export interface CostCenterTransaction {
  id: string;
  date: string;
  docNumber: string;
  docType: 'EXTERNAL_PAYMENT' | 'EXTERNAL_RECEIPT' | 'INTERNAL_PAYMENT' | 'INTERNAL_RECEIPT' | 'JOURNAL_ENTRY';
  docTypeLabel: string;
  partnerName?: string | undefined;
  description: string;
  amount: number;
  entryType: 'EXPENSE' | 'REVENUE' | 'TRANSFER';
  paymentMethod?: string | undefined;
}

export interface CostCenterSummary {
  costCenter: CostCenter;
  totalExpenses: number;
  totalRevenues: number;
  netIncome: number;             // الإيرادات - المصروفات (أرباح وخسائر المركز)
  budgetUtilizationPercent: number; // نسبة استهلاك الميزانية
  vouchersCount: number;
  expenseBreakdown: CostCenterExpenseItem[];
  transactions: CostCenterTransaction[];
}
