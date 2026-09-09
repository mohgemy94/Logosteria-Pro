export interface InstallmentScheduleItem {
  id: string;
  contractId: string;
  installmentNumber: number;
  dueDate: string; // YYYY-MM-DD
  principalAmount: number; // أصل القسط
  profitAmount: number; // نصيب الفائدة/الربح
  totalAmount: number; // إجمالي القسط
  paidAmount: number; // المبلغ المسدد
  remainingAmount: number; // المبلغ المتبقي
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE';
  paidDate?: string | undefined;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'CARD' | undefined;
  receiptVoucherNumber?: string | undefined;
  promissoryNoteId?: string | undefined; // كود الكمبيالة المرتبطة
  penaltyAmount?: number | undefined;
  notes?: string | undefined;
}

export interface InstallmentContract {
  id: string;
  contractNumber: string;
  date: string; // YYYY-MM-DD
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerNationalId: string;
  customerAddress?: string | undefined;
  guarantorName?: string | undefined;
  guarantorPhone?: string | undefined;
  guarantorNationalId?: string | undefined;
  guarantorAddress?: string | undefined;
  itemDescription: string;
  cashPrice: number; // سعر الكاش
  downPayment: number; // الدفعة المقدمة
  profitRate: number; // نسبة المرابحة / الربح %
  profitAmount: number; // قيمة الأرباح
  totalFinanced: number; // إجمالي قيمة العقد (المتبقي + الأرباح)
  monthsCount: number; // عدد الأقساط
  installmentFrequency: 'MONTHLY' | 'WEEKLY' | 'QUARTERLY';
  installmentAmount: number; // قيمة القسط الفردي
  startDate: string; // تاريخ أول قسط
  status: 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'CANCELLED';
  totalPaid: number;
  totalRemaining: number;
  notes?: string | undefined;
  schedule: InstallmentScheduleItem[];
}

export interface PromissoryNote {
  id: string;
  noteNumber: string;
  contractId?: string | undefined;
  contractNumber?: string | undefined;
  installmentNumber?: number | undefined;
  type: 'PROMISSORY_NOTE' | 'BILL_OF_EXCHANGE'; // سند لأمر أو كمبيالة تجارية
  issueDate: string; // تاريخ التحرير
  dueDate: string; // تاريخ الاستحقاق
  amount: number;
  amountInWords: string;
  currency: string;
  drawee: string; // المسحوب عليه (المدين / العميل)
  draweeNationalId: string;
  draweePhone: string;
  draweeAddress: string;
  drawer: string; // الساحب / الدائن (الشركة)
  payee: string; // المستفيد
  guarantor?: string | undefined; // الضامن المتضامن
  guarantorNationalId?: string | undefined;
  guarantorPhone?: string | undefined;
  placeOfPayment: string; // مكان الوفاء
  bankName?: string | undefined;
  status: 'PORTFOLIO' | 'SENT_FOR_COLLECTION' | 'COLLECTED' | 'PROTESTED' | 'ENDORSED' | 'CANCELLED';
  collectionDate?: string | undefined;
  endorseeName?: string | undefined; // في حالة التظهير لطرف ثالث
  legalText: string; // الصيغة القانونية الرسمية
  notes?: string | undefined;
}

export interface InstallmentFilterState {
  search: string;
  status: string;
  contractId: string;
  overdueOnly: boolean;
  dateRange: 'ALL' | 'THIS_MONTH' | 'NEXT_MONTH' | 'OVERDUE';
}
