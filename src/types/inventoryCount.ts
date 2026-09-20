export type InventoryCountStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export interface InventoryCountLine {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  barcode?: string | undefined;
  category?: string | undefined;
  unit: string;
  warehouseName: string;
  shelfLocation?: string | undefined;
  bookQuantity: number;      // الرصيد الدفتري المسجل في النظام
  actualQuantity: number;    // الرصيد الفعلي بعد العد
  varianceQuantity: number;  // الفارق بالكمية = actualQuantity - bookQuantity
  unitCostPrice: number;     // تكلفة الوحدة
  varianceValue: number;     // القيمة المالية للفارق = varianceQuantity * unitCostPrice
  notes?: string | undefined;            // سبب الفارق (تلف، عجز، زيادة تشغيلية، خطأ تسجيل سابق...)
}

export interface InventoryAuditRecord {
  id: string;
  auditNumber: string;       // كود المحضر مثل AUD-2026-0001
  auditTitle: string;        // عنوان الجرد (مثل: محضر الجرد الدوري للربع الثالث)
  date: string;              // تاريخ الجرد YYYY-MM-DD
  targetWarehouse: string;   // المستودع الخاضع للجرد
  committeeMembers: string;  // لجنة الجرد / القائم بالجرد
  status: InventoryCountStatus;
  lines: InventoryCountLine[];
  totals: {
    totalItems: number;
    matchedCount: number;
    shortageCount: number;
    surplusCount: number;
    totalShortageValue: number;  // إجمالي قيمة العجز (موجبة كقيمة مطلقة)
    totalSurplusValue: number;   // إجمالي قيمة الزيادة (موجبة كقيمة مطلقة)
    netVarianceValue: number;    // صافي الفارق المالي (surplus - shortage)
  };
  notes?: string | undefined;
  journalEntryId?: string | undefined;       // معرف قيد اليومية المرتبط
  journalEntryNumber?: string | undefined;   // رقم قيد اليومية (مثل JE-2026-xxxx)
  postedAt?: string | undefined;             // تاريخ ووقت الترحيل الفعلي
  postedBy?: string | undefined;             // منفذ الترحيل
  createdAt: string;
}
