import { DB_PURCHASES_INVOICES_KEY } from './sequences';
import { notifyDataChanged } from './localFolderBackup';
import { dispatchPartnerLedgerUpdated } from './partnerLedger';

export interface PurchaseInvoiceItem {
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

export interface StoredPurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierRef?: string;
  date: string;
  dueDate: string;
  partnerId: string;
  partnerName: string;
  classification: 'NORMAL' | 'TAX';
  taxRate?: number;
  invoiceType: string;
  source: string;
  safe: string;
  items: PurchaseInvoiceItem[];
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

export function loadStoredPurchaseInvoices(): StoredPurchaseInvoice[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DB_PURCHASES_INVOICES_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load purchase invoices:', e);
  }
  return [];
}

export function saveStoredPurchaseInvoices(invoices: StoredPurchaseInvoice[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DB_PURCHASES_INVOICES_KEY, JSON.stringify(invoices));
    notifyDataChanged();
    dispatchPartnerLedgerUpdated();
  } catch (e) {
    console.error('Failed to save purchase invoices:', e);
  }
}

export function deleteStoredPurchaseInvoice(targetIdOrNumber: string): StoredPurchaseInvoice[] {
  const current = loadStoredPurchaseInvoices();
  const cleanTarget = targetIdOrNumber.trim().toLowerCase();
  const updated = current.filter(i => {
    if (i.id && i.id.trim().toLowerCase() === cleanTarget) return false;
    if (i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === cleanTarget) return false;
    return true;
  });
  saveStoredPurchaseInvoices(updated);
  return updated;
}
