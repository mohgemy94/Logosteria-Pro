export type CheckType = 'INCOMING' | 'OUTGOING';

export type CheckStatus = 'UNDER_COLLECTION' | 'CLEARED' | 'BOUNCED' | 'CANCELLED' | 'ENDORSED';

export type CheckSource = 'EXTERNAL_VOUCHER' | 'INTERNAL_VOUCHER' | 'MANUAL';

export interface BankCheck {
  id: string;
  checkNumber: string;
  type: CheckType;                // INCOMING = شيك وارد (قبض) | OUTGOING = شيك صادر (صرف)
  source: CheckSource;
  sourceVoucherId?: string | undefined;
  sourceVoucherNumber?: string | undefined;
  partnerId?: string | undefined;
  partnerName: string;
  partnerType: 'CUSTOMER' | 'VENDOR' | 'OTHER';
  amount: number;
  issueDate: string;             // تاريخ تحرير أو استلام الشيك (YYYY-MM-DD)
  dueDate: string;               // تاريخ استحقاق وصرف الشيك (YYYY-MM-DD)
  bankName: string;              // البنك المسحوب عليه
  branchName?: string | undefined;
  drawerName?: string | undefined; // الساحب (محرر الشيك)
  payeeName?: string | undefined;  // المستفيد من الشيك
  status: CheckStatus;
  
  // بيانات التحصيل / الصرف
  depositBankAccountId?: string | undefined;   // معرف حساب البنك المودع فيه أو المصروف منه
  depositBankAccountName?: string | undefined; // اسم حساب البنك
  clearanceDate?: string | undefined;          // تاريخ الصرف / التحصيل الفعلي
  clearanceReference?: string | undefined;     // رقم إشعار البنك أو مرجع التحصيل
  
  // بيانات الارتداد
  bounceDate?: string | undefined;
  bounceReason?: string | undefined;           // سبب الارتداد
  bounceFee?: number | undefined;              // مصاريف بنكية
  
  // بيانات التظهير لمورد (Endorsement)
  endorsementDate?: string | undefined;
  endorsedToVendorId?: string | undefined;
  endorsedToVendorName?: string | undefined;

  // القيد المحاسبي التلقائي
  journalEntryId?: string | undefined;         // معرف القيد المحاسبي المتولد آلياً
  journalEntryNumber?: string | undefined;     // رقم القيد اليومي (JV-CHQ-...)
  bounceJournalEntryId?: string | undefined;   // معرف قيد الارتداد إن وجد

  notes?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export type CheckUrgency = 
  | 'OVERDUE'      // متأخر الاستحقاق
  | 'DUE_TODAY'    // مستحق اليوم
  | 'DUE_SOON'     // يستحق خلال 3 أيام
  | 'DUE_THIS_WEEK'// يستحق خلال 4 إلى 7 أيام
  | 'FUTURE'       // مستقبلي (أكثر من 7 أيام)
  | 'SETTLED';     // تم التحصيل أو ملغي أو مرتد أو مظهر

export interface CheckStats {
  totalCount: number;
  totalAmount: number;
  incomingCount: number;
  incomingAmount: number;
  outgoingCount: number;
  outgoingAmount: number;
  
  underCollectionCount: number;
  underCollectionAmount: number;
  clearedCount: number;
  clearedAmount: number;
  bouncedCount: number;
  bouncedAmount: number;
  endorsedCount: number;
  endorsedAmount: number;

  overdueCount: number;
  overdueAmount: number;
  dueTodayCount: number;
  dueTodayAmount: number;
  dueSoonCount: number; // خلال 7 أيام
  dueSoonAmount: number;
}
