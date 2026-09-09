import { DB_SALES_INVOICES_KEY } from './sequences';

export interface InvoiceItem {
  id: string;
  itemId?: string;
  itemCode?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  unit?: string;
  availableStock?: number;
  costPrice?: number;
}

export interface StoredSalesInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  partnerId: string;
  partnerName: string;
  classification: 'NORMAL' | 'TAX';
  invoiceType: string;
  source: string;
  safe: string;
  serviceType?: string;
  items: InvoiceItem[];
  totals: {
    subtotal: number;
    taxTotal: number;
    discountTotal?: number;
    grandTotal: number;
    cashPaid?: number;
    remainingBalance?: number;
  };
  status: 'DRAFT' | 'POSTED';
  notes?: string;
  createdAt: string;
}

export const DEFAULT_INITIAL_SALES_INVOICES: StoredSalesInvoice[] = [
  {
    id: 'demo-inv-1',
    invoiceNumber: 'INV-1001',
    date: '2026-09-02',
    dueDate: '2026-09-16',
    partnerId: '1',
    partnerName: 'شركة التقنية الحديثة',
    classification: 'TAX',
    invoiceType: 'CASH_SALES',
    source: 'MAIN_WAREHOUSE',
    safe: 'MAIN_SAFE',
    items: [
      {
        id: 'line-1-1',
        itemCode: '1',
        description: 'لابتوب ديل انسبايرون',
        quantity: 2,
        unitPrice: 1900,
        costPrice: 1500,
        taxRate: 15,
        unit: 'حبة / قطعة'
      },
      {
        id: 'line-1-2',
        itemCode: '8',
        description: 'لوحة مفاتيح وماوس لاسلكي لوجيتك',
        quantity: 4,
        unitPrice: 120,
        costPrice: 85,
        taxRate: 15,
        unit: 'طقم'
      }
    ],
    totals: { subtotal: 4280, taxTotal: 642, discountTotal: 0, grandTotal: 4922, cashPaid: 4922, remainingBalance: 0 },
    status: 'POSTED',
    notes: 'توريد أجهزة حاسب مع ملحقاتها للفرع الرئيسي',
    createdAt: '2026-09-02T10:30:00.000Z'
  },
  {
    id: 'demo-inv-2',
    invoiceNumber: 'INV-1002',
    date: '2026-09-05',
    dueDate: '2026-09-20',
    partnerId: '2',
    partnerName: 'مؤسسة البناء العمراني',
    classification: 'TAX',
    invoiceType: 'CREDIT_SALES',
    source: 'MAIN_WAREHOUSE',
    safe: 'MAIN_SAFE',
    items: [
      {
        id: 'line-2-1',
        itemCode: '1',
        description: 'لابتوب ديل انسبايرون',
        quantity: 2,
        unitPrice: 1350,
        costPrice: 1500,
        taxRate: 15,
        unit: 'حبة / قطعة'
      },
      {
        id: 'line-2-2',
        itemCode: '3',
        description: 'سكر أبيض ناعم',
        quantity: 10,
        unitPrice: 82,
        costPrice: 90,
        taxRate: 0,
        unit: 'شوال'
      }
    ],
    totals: { subtotal: 3520, taxTotal: 405, discountTotal: 0, grandTotal: 3925, cashPaid: 0, remainingBalance: 3925 },
    status: 'POSTED',
    notes: 'عرض خاص موسمي وتصفية - تم البيع دون هامش التكلفة القياسي',
    createdAt: '2026-09-05T14:15:00.000Z'
  },
  {
    id: 'demo-inv-3',
    invoiceNumber: 'INV-1003',
    date: '2026-09-07',
    dueDate: '2026-09-21',
    partnerId: '3',
    partnerName: 'مؤسسة الأفق للتجارة والمقاولات',
    classification: 'TAX',
    invoiceType: 'CASH_SALES',
    source: 'MAIN_WAREHOUSE',
    safe: 'MAIN_SAFE',
    items: [
      {
        id: 'line-3-1',
        itemCode: '2',
        description: 'أرز بسمتي درجة أولى',
        quantity: 15,
        unitPrice: 150,
        costPrice: 120,
        taxRate: 0,
        unit: 'شيكارة'
      }
    ],
    totals: { subtotal: 2250, taxTotal: 0, discountTotal: 0, grandTotal: 2250, cashPaid: 2250, remainingBalance: 0 },
    status: 'POSTED',
    notes: 'شحنة مواد تموينية دورية',
    createdAt: '2026-09-07T09:00:00.000Z'
  }
];

export function loadStoredSalesInvoices(): StoredSalesInvoice[] {
  if (typeof window === 'undefined') return DEFAULT_INITIAL_SALES_INVOICES;
  try {
    const raw = localStorage.getItem(DB_SALES_INVOICES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to load sales invoices:', e);
  }
  return DEFAULT_INITIAL_SALES_INVOICES;
}
