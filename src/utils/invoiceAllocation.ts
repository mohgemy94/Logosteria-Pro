import { DB_SALES_INVOICES_KEY, DB_PURCHASES_INVOICES_KEY, DB_RECEIPT_VOUCHERS_KEY, DB_PAYMENT_VOUCHERS_KEY } from './sequences';
import { VoucherType } from '../types/accounting';
import { notifyDataChanged } from './localFolderBackup';

export interface VoucherInvoiceAllocation {
  invoiceId: string;
  invoiceNumber: string;
  invoiceType: 'SALES' | 'PURCHASE';
  allocatedAmount: number;
  invoiceTotal: number;
  previousRemaining: number;
  newRemaining: number;
  date?: string | undefined;
  dueDate?: string | undefined;
}

export interface PendingPartnerInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate?: string | undefined;
  classification?: string | undefined;
  invoiceTypeLabel?: string | undefined;
  grandTotal: number;
  initialPaid: number;
  otherAllocated: number;
  currentAllocated: number;
  totalPaid: number;
  remainingBeforeCurrent: number;
  remainingAfterCurrent: number;
  status: 'DRAFT' | 'POSTED';
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
  invoiceType: 'SALES' | 'PURCHASE';
  notes?: string | undefined;
}

function safeParse<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as unknown as T) : fallback;
  } catch (err) {
    console.error(`Error reading ${key}:`, err);
    return fallback;
  }
}

/**
 * Checks if a document belongs to the target partner by ID or Name.
 */
function isPartnerMatch(docPartnerId: string | undefined, docPartnerName: string | undefined, targetId: string, targetName?: string): boolean {
  const cleanDocId = (docPartnerId || '').trim().toLowerCase();
  const cleanTargetId = targetId.trim().toLowerCase();
  if (cleanDocId && cleanTargetId && cleanDocId === cleanTargetId) return true;

  const cleanDocNum = cleanDocId.replace(/[^0-9]/g, '');
  const cleanTargetNum = cleanTargetId.replace(/[^0-9]/g, '');
  if (cleanDocNum && cleanTargetNum && cleanDocNum === cleanTargetNum) return true;

  if (targetName) {
    const cleanDocName = (docPartnerName || '').trim().toLowerCase();
    const cleanTargetName = targetName.trim().toLowerCase();
    if (cleanDocName && cleanTargetName && (cleanDocName === cleanTargetName || cleanDocName.includes(cleanTargetName) || cleanTargetName.includes(cleanDocName))) {
      return true;
    }
  }

  return false;
}

/**
 * Retrieves all outstanding (unpaid or partially paid) invoices for a given partner.
 * Calculates how much has been paid initially and through other vouchers.
 */
export function getPendingInvoicesForPartner(
  partnerId: string,
  partnerType: 'CUSTOMER' | 'VENDOR',
  partnerName?: string,
  currentVoucherId?: string
): PendingPartnerInvoice[] {
  if (!partnerId) return [];

  const isCustomer = partnerType === 'CUSTOMER';
  const invoicesKey = isCustomer ? DB_SALES_INVOICES_KEY : DB_PURCHASES_INVOICES_KEY;
  const vouchersKey = isCustomer ? DB_RECEIPT_VOUCHERS_KEY : DB_PAYMENT_VOUCHERS_KEY;

  const rawInvoices = safeParse<any[]>(invoicesKey, []);
  const rawVouchers = safeParse<any[]>(vouchersKey, []);

  // Filter invoices for this partner (exclude return invoices from positive debt matching)
  const partnerInvoices = rawInvoices.filter(inv => {
    if (!isPartnerMatch(inv.partnerId, inv.partnerName, partnerId, partnerName)) return false;
    const isReturn = (inv.invoiceType || '').includes('RETURN');
    return !isReturn;
  });

  const result: PendingPartnerInvoice[] = [];

  for (const inv of partnerInvoices) {
    const grandTotal = Number(inv.totals?.grandTotal ?? inv.grandTotal ?? 0);
    if (grandTotal <= 0) continue;

    // Direct cash paid at creation time
    const initialPaid = Number(
      typeof inv.initialCashPaid === 'number' 
        ? inv.initialCashPaid 
        : (inv.totals?.cashPaid ?? inv.cashPaid ?? 0)
    );

    // Sum allocations from other vouchers
    let otherAllocated = 0;
    let currentAllocated = 0;

    for (const v of rawVouchers) {
      if (!v.allocations || !Array.isArray(v.allocations)) continue;
      for (const alloc of v.allocations) {
        const matchesThis = (alloc.invoiceId && alloc.invoiceId === inv.id) ||
                            (alloc.invoiceNumber && alloc.invoiceNumber.trim().toLowerCase() === inv.invoiceNumber?.trim().toLowerCase());
        if (matchesThis) {
          const amt = Number(alloc.allocatedAmount) || 0;
          if (currentVoucherId && v.id === currentVoucherId) {
            currentAllocated += amt;
          } else {
            otherAllocated += amt;
          }
        }
      }
    }

    const netPaidWithoutCurrent = Math.min(grandTotal, initialPaid + otherAllocated);
    const remainingBeforeCurrent = Math.max(0, grandTotal - netPaidWithoutCurrent);
    const remainingAfterCurrent = Math.max(0, remainingBeforeCurrent - currentAllocated);
    const totalPaidWithCurrent = Math.min(grandTotal, netPaidWithoutCurrent + currentAllocated);

    let paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID' = 'UNPAID';
    if (remainingAfterCurrent <= 0.001) {
      paymentStatus = 'PAID';
    } else if (totalPaidWithCurrent > 0.001) {
      paymentStatus = 'PARTIAL';
    }

    result.push({
      id: inv.id || inv.invoiceNumber,
      invoiceNumber: inv.invoiceNumber,
      date: inv.date || '',
      dueDate: inv.dueDate || '',
      classification: inv.classification,
      invoiceTypeLabel: inv.invoiceType,
      grandTotal,
      initialPaid,
      otherAllocated,
      currentAllocated,
      totalPaid: totalPaidWithCurrent,
      remainingBeforeCurrent,
      remainingAfterCurrent,
      status: inv.status || 'POSTED',
      paymentStatus,
      invoiceType: isCustomer ? 'SALES' : 'PURCHASE',
      notes: inv.notes
    });
  }

  // Sort by date ascending (FIFO: oldest unpaid invoices first)
  return result.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

/**
 * Automatically allocates a given voucher total amount across pending invoices in FIFO order (oldest first).
 */
export function distributeAmountFifo(
  invoices: PendingPartnerInvoice[],
  totalAmountToDistribute: number
): Record<string, number> {
  const allocationMap: Record<string, number> = {};
  let remainingPool = Math.max(0, Number(totalAmountToDistribute) || 0);

  for (const inv of invoices) {
    if (remainingPool <= 0.001) {
      allocationMap[inv.id] = 0;
      continue;
    }
    const maxNeeded = inv.remainingBeforeCurrent;
    const canAllocate = Math.min(remainingPool, maxNeeded);
    const rounded = Math.round(canAllocate * 100) / 100;
    allocationMap[inv.id] = rounded;
    remainingPool = Math.max(0, remainingPool - rounded);
  }

  return allocationMap;
}

/**
 * Re-computes and applies all voucher allocations to sales or purchase invoices in localStorage.
 * Automatically updates `totals.cashPaid`, `totals.remainingBalance`, and `paymentStatus` for each invoice.
 */
export function applyVoucherAllocations(
  voucherType: VoucherType
): void {
  if (typeof window === 'undefined') return;

  const isReceipt = voucherType === VoucherType.Receipt;
  const invoicesKey = isReceipt ? DB_SALES_INVOICES_KEY : DB_PURCHASES_INVOICES_KEY;
  const vouchersKey = isReceipt ? DB_RECEIPT_VOUCHERS_KEY : DB_PAYMENT_VOUCHERS_KEY;

  const rawInvoices = safeParse<any[]>(invoicesKey, []);
  const rawVouchers = safeParse<any[]>(vouchersKey, []);

  // Map: invoiceKey (id or number) -> list of allocations
  const allocationsByInvoice: Record<string, Array<{ voucherId: string; voucherNumber: string; amount: number; date: string }>> = {};

  for (const v of rawVouchers) {
    if (!v.allocations || !Array.isArray(v.allocations)) continue;
    for (const alloc of v.allocations) {
      const amt = Number(alloc.allocatedAmount) || 0;
      if (amt <= 0) continue;
      const keyId = alloc.invoiceId;
      const keyNum = alloc.invoiceNumber?.trim().toLowerCase();

      const item = {
        voucherId: v.id,
        voucherNumber: v.voucherNumber,
        amount: amt,
        date: v.date
      };

      if (keyId) {
        if (!allocationsByInvoice[keyId]) allocationsByInvoice[keyId] = [];
        allocationsByInvoice[keyId].push(item);
      }
      if (keyNum && keyNum !== keyId) {
        if (!allocationsByInvoice[keyNum]) allocationsByInvoice[keyNum] = [];
        allocationsByInvoice[keyNum].push(item);
      }
    }
  }

  let hasChanges = false;
  const updatedInvoices = rawInvoices.map(inv => {
    const grandTotal = Number(inv.totals?.grandTotal ?? inv.grandTotal ?? 0);
    const initialPaid = Number(
      typeof inv.initialCashPaid === 'number' 
        ? inv.initialCashPaid 
        : (inv.totals?.cashPaid ?? inv.cashPaid ?? 0)
    );

    const idAllocations = allocationsByInvoice[inv.id] || [];
    const numAllocations = inv.invoiceNumber ? (allocationsByInvoice[inv.invoiceNumber.trim().toLowerCase()] || []) : [];
    
    // Merge deduplicated allocations by voucherId
    const uniqueMap = new Map<string, { voucherId: string; voucherNumber: string; amount: number; date: string }>();
    [...idAllocations, ...numAllocations].forEach(a => uniqueMap.set(a.voucherId, a));
    const mergedAllocations = Array.from(uniqueMap.values());

    const totalVoucherAllocated = mergedAllocations.reduce((sum, a) => sum + a.amount, 0);
    const totalPaid = Math.min(grandTotal, initialPaid + totalVoucherAllocated);
    const remainingBalance = Math.max(0, grandTotal - totalPaid);

    let paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID' = 'UNPAID';
    if (grandTotal > 0) {
      if (remainingBalance <= 0.001) {
        paymentStatus = 'PAID';
      } else if (totalPaid > 0.001) {
        paymentStatus = 'PARTIAL';
      } else {
        paymentStatus = 'UNPAID';
      }
    }

    const oldPaid = inv.totals?.cashPaid;
    const oldRem = inv.totals?.remainingBalance;
    const oldStatus = inv.paymentStatus;

    if (oldPaid !== totalPaid || oldRem !== remainingBalance || oldStatus !== paymentStatus) {
      hasChanges = true;
    }

    return {
      ...inv,
      initialCashPaid: initialPaid,
      allocatedAmount: totalVoucherAllocated,
      allocatedVouchers: mergedAllocations,
      paymentStatus,
      totals: {
        ...(inv.totals || {}),
        subtotal: inv.totals?.subtotal ?? 0,
        taxTotal: inv.totals?.taxTotal ?? inv.totals?.taxAmount ?? 0,
        discountTotal: inv.totals?.discountTotal ?? inv.totals?.totalDiscount ?? 0,
        grandTotal,
        cashPaid: totalPaid,
        remainingBalance
      }
    };
  });

  if (hasChanges) {
    try {
      localStorage.setItem(invoicesKey, JSON.stringify(updatedInvoices));
      notifyDataChanged();
      window.dispatchEvent(new Event(isReceipt ? 'alpha-sales-invoices-updated' : 'alpha-purchases-invoices-updated'));
      window.dispatchEvent(new Event('alpha-partner-ledger-updated'));
      window.dispatchEvent(new Event('alpha-data-changed'));
    } catch (err) {
      console.error(`Failed to save updated invoices to ${invoicesKey}:`, err);
    }
  }
}

/**
 * Reconciles and synchronizes all invoices (Sales and Purchases) against all vouchers.
 */
export function syncAllInvoicesPaymentStatus(): void {
  applyVoucherAllocations(VoucherType.Receipt);
  applyVoucherAllocations(VoucherType.Payment);
}
