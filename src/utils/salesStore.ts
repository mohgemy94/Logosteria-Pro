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
  taxRate?: number;
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

export const DEFAULT_INITIAL_SALES_INVOICES: StoredSalesInvoice[] = [];

export function loadStoredSalesInvoices(): StoredSalesInvoice[] {
  if (typeof window === 'undefined') return DEFAULT_INITIAL_SALES_INVOICES;
  try {
    const raw = localStorage.getItem(DB_SALES_INVOICES_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load sales invoices:', e);
  }
  // If the key has never been initialized in localStorage, seed once
  try {
    localStorage.setItem(DB_SALES_INVOICES_KEY, JSON.stringify(DEFAULT_INITIAL_SALES_INVOICES));
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_INITIAL_SALES_INVOICES;
}
