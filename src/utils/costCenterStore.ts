import { 
  CostCenter, 
  CostCenterType, 
  CostCenterSummary, 
  CostCenterExpenseItem, 
  CostCenterTransaction 
} from '../types/costCenter';

export type { 
  CostCenter, 
  CostCenterType, 
  CostCenterSummary, 
  CostCenterExpenseItem, 
  CostCenterTransaction 
};
import { 
  DB_SALES_INVOICES_KEY,
  DB_PURCHASES_INVOICES_KEY,
  DB_PAYMENT_VOUCHERS_KEY, 
  DB_RECEIPT_VOUCHERS_KEY,
  DB_INTERNAL_PAYMENT_VOUCHERS_KEY,
  DB_INTERNAL_RECEIPT_VOUCHERS_KEY
} from './sequences';
import { JOURNAL_ENTRIES_STORAGE_KEY } from './trialBalanceStore';
import { JournalEntry, JournalEntryStatus } from '../types/accounting';

export const COST_CENTERS_STORAGE_KEY = 'alpha_cost_centers_v1';

export const DEFAULT_COST_CENTERS: CostCenter[] = [];

const LEGACY_SEEDED_COST_CENTER_IDS = new Set([
  'cc-101',
  'cc-102',
  'cc-103',
  'cc-104',
  'cc-105'
]);

const LEGACY_SEEDED_COST_CENTER_NAMES = new Set([
  'الفرع الرئيسي - الرياض',
  'فرع جدة الإقليمي',
  'فرع الدمام والمنطقة الشرقية',
  'مشروع توريد وتجهيز المجمع التجاري',
  'أسطول النقليات والتوزيع اللوجستي'
]);

export function loadCostCenters(): CostCenter[] {
  if (typeof window === 'undefined') return DEFAULT_COST_CENTERS;
  try {
    const raw = localStorage.getItem(COST_CENTERS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_COST_CENTERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const cleaned = parsed.filter((item: any) => {
        if (!item || typeof item !== 'object') return false;
        if (LEGACY_SEEDED_COST_CENTER_IDS.has(String(item.id))) return false;
        if (item.createdAt === '2025-01-01' && LEGACY_SEEDED_COST_CENTER_NAMES.has(String(item.name))) {
          return false;
        }
        return true;
      });
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(COST_CENTERS_STORAGE_KEY, JSON.stringify(cleaned));
      }
      return cleaned;
    }
    return DEFAULT_COST_CENTERS;
  } catch (err) {
    console.error('Failed to load cost centers:', err);
    return DEFAULT_COST_CENTERS;
  }
}

export function getFlatCostCenters(): CostCenter[] {
  return loadCostCenters().filter(c => c.status === 'ACTIVE');
}

export function saveCostCenters(centers: CostCenter[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COST_CENTERS_STORAGE_KEY, JSON.stringify(centers));
    window.dispatchEvent(new CustomEvent('alpha-cost-centers-updated', { detail: centers }));
  } catch (err) {
    console.error('Failed to save cost centers:', err);
  }
}

export function addCostCenter(centerData: Omit<CostCenter, 'id' | 'createdAt'>): CostCenter {
  const centers = loadCostCenters();
  const id = `cc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const newCenter: CostCenter = {
    ...centerData,
    id,
    createdAt: new Date().toISOString(),
    status: centerData.status || 'ACTIVE'
  };

  const updated = [...centers, newCenter];
  saveCostCenters(updated);
  return newCenter;
}

export function updateCostCenter(id: string, updates: Partial<CostCenter>): boolean {
  const centers = loadCostCenters();
  const idx = centers.findIndex(c => c.id === id);
  if (idx === -1) return false;

  const existing = centers[idx];
  if (!existing) return false;
  centers[idx] = {
    id: existing.id,
    code: updates.code !== undefined ? updates.code : existing.code,
    name: updates.name !== undefined ? updates.name : existing.name,
    type: updates.type !== undefined ? updates.type : existing.type,
    manager: updates.manager !== undefined ? updates.manager : existing.manager,
    budget: updates.budget !== undefined ? updates.budget : existing.budget,
    description: updates.description !== undefined ? updates.description : existing.description,
    status: updates.status !== undefined ? updates.status : existing.status,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString()
  };

  saveCostCenters(centers);
  return true;
}

export function deleteCostCenter(id: string): boolean {
  const centers = loadCostCenters();
  const filtered = centers.filter(c => c.id !== id);
  if (filtered.length === centers.length) return false;
  saveCostCenters(filtered);
  return true;
}

export function getCostCenterById(id: string): CostCenter | undefined {
  const centers = loadCostCenters();
  return centers.find(c => c.id === id || c.code === id);
}

export function getCostCenterTypeLabel(type: CostCenterType): string {
  switch (type) {
    case 'BRANCH': return 'فرع تشغيلي';
    case 'PROJECT': return 'مشروع مقاولات / توريد';
    case 'FLEET': return 'أسطول نقليات ولوجستيات';
    case 'DEPARTMENT': return 'قسم / إدارة داخلية';
    case 'OTHER': return 'مركز تكلفة عام';
    default: return 'مركز تكلفة';
  }
}

export function getCostCenterTypeColor(type: CostCenterType): { bg: string; text: string; border: string } {
  switch (type) {
    case 'BRANCH':
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-700', border: 'border-emerald-300' };
    case 'PROJECT':
      return { bg: 'bg-indigo-500/10', text: 'text-indigo-700', border: 'border-indigo-300' };
    case 'FLEET':
      return { bg: 'bg-amber-500/10', text: 'text-amber-700', border: 'border-amber-300' };
    case 'DEPARTMENT':
      return { bg: 'bg-purple-500/10', text: 'text-purple-700', border: 'border-purple-300' };
    default:
      return { bg: 'bg-slate-500/10', text: 'text-slate-700', border: 'border-slate-300' };
  }
}

/**
 * Calculates profit & loss and expense analytics for cost centers.
 * Extracts movements from External Payments, Internal Payments, Receipts, and Journal Entries.
 */
export function calculateCostCenterAnalytics(
  targetCostCenterId?: string,
  startDate?: string,
  endDate?: string
): CostCenterSummary[] {
  const centers = loadCostCenters();
  const targetCenters = targetCostCenterId && targetCostCenterId !== 'ALL'
    ? centers.filter(c => c.id === targetCostCenterId || c.code === targetCostCenterId)
    : centers;

  const isInRange = (dateStr?: string): boolean => {
    if (!dateStr) return true;
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  };

  // 1. Load External Payments
  let externalPayments: any[] = [];
  try {
    const raw = localStorage.getItem(DB_PAYMENT_VOUCHERS_KEY);
    if (raw) externalPayments = JSON.parse(raw);
  } catch (e) {
    console.error('Error loading external payments for cost center:', e);
  }

  // 2. Load External Receipts
  let externalReceipts: any[] = [];
  try {
    const raw = localStorage.getItem(DB_RECEIPT_VOUCHERS_KEY);
    if (raw) externalReceipts = JSON.parse(raw);
  } catch (e) {
    console.error('Error loading external receipts for cost center:', e);
  }

  // 3. Load Internal Payments
  let internalPayments: any[] = [];
  try {
    const raw = localStorage.getItem(DB_INTERNAL_PAYMENT_VOUCHERS_KEY);
    if (raw) internalPayments = JSON.parse(raw);
  } catch (e) {
    console.error('Error loading internal payments for cost center:', e);
  }

  // 4. Load Internal Receipts
  let internalReceipts: any[] = [];
  try {
    const raw = localStorage.getItem(DB_INTERNAL_RECEIPT_VOUCHERS_KEY);
    if (raw) internalReceipts = JSON.parse(raw);
  } catch (e) {
    console.error('Error loading internal receipts for cost center:', e);
  }

  // 5. Load Journal Entries
  let journalEntries: JournalEntry[] = [];
  try {
    const raw = localStorage.getItem(JOURNAL_ENTRIES_STORAGE_KEY);
    if (raw) journalEntries = JSON.parse(raw);
  } catch (e) {
    console.error('Error loading journal entries for cost center:', e);
  }

  // 6. Load Sales Invoices
  let salesInvoices: any[] = [];
  try {
    const raw = localStorage.getItem(DB_SALES_INVOICES_KEY);
    if (raw) salesInvoices = JSON.parse(raw);
  } catch (e) {
    console.error('Error loading sales invoices for cost center:', e);
  }

  // 7. Load Purchase Invoices
  let purchaseInvoices: any[] = [];
  try {
    const raw = localStorage.getItem(DB_PURCHASES_INVOICES_KEY);
    if (raw) purchaseInvoices = JSON.parse(raw);
  } catch (e) {
    console.error('Error loading purchase invoices for cost center:', e);
  }

  // 8. Load Manufacturing Work Orders
  let workOrders: any[] = [];
  try {
    const raw = localStorage.getItem('alpha_accounting_work_orders_v1');
    if (raw) workOrders = JSON.parse(raw);
  } catch (e) {
    console.error('Error loading work orders for cost center:', e);
  }

  // Build summary for each center
  return targetCenters.map(center => {
    const transactions: CostCenterTransaction[] = [];
    const expenseCategoryMap: Record<string, { name: string; amount: number }> = {};

    let totalExpenses = 0;
    let totalRevenues = 0;

    // Helper to add expense category breakdown
    const addExpenseCategory = (categoryName: string, amount: number) => {
      const key = categoryName.trim() || 'مصروفات عامة';
      if (!expenseCategoryMap[key]) {
        expenseCategoryMap[key] = { name: key, amount: 0 };
      }
      expenseCategoryMap[key].amount += amount;
    };

    // A) External Payment Vouchers linked to this center
    if (Array.isArray(externalPayments)) {
      externalPayments.forEach(v => {
        const matchesCenter = (v.costCenterId === center.id || v.costCenterId === center.code);
        if (matchesCenter && v.status === 'POSTED' && isInRange(v.date)) {
          const amt = Number(v.amount) || 0;
          if (amt > 0) {
            totalExpenses += amt;
            const catName = v.partnerType === 'VENDOR' ? `مشتريات وتوريدات: ${v.partnerName || 'مورد'}` : (v.description || 'سند صرف خارجي');
            addExpenseCategory(catName, amt);

            transactions.push({
              id: `tx-ext-pay-${v.id || v.voucherNumber}`,
              date: v.date || '',
              docNumber: v.voucherNumber,
              docType: 'EXTERNAL_PAYMENT',
              docTypeLabel: 'سند صرف خارجي',
              partnerName: v.partnerName || 'مورد / طرف خارجي',
              description: v.description || 'صرف لمورد',
              amount: amt,
              entryType: 'EXPENSE',
              paymentMethod: v.paymentMethod
            });
          }
        }
      });
    }

    // B) Internal Payment Vouchers linked to this center
    if (Array.isArray(internalPayments)) {
      internalPayments.forEach(v => {
        const matchesCenter = (v.costCenterId === center.id || v.costCenterId === center.code);
        if (matchesCenter && v.status === 'POSTED' && isInRange(v.date)) {
          const amt = Number(v.amount) || 0;
          if (amt > 0) {
            totalExpenses += amt;
            const catName = v.expenseType ? `صرف داخلي: ${v.expenseType}` : (v.description || 'مصروف داخلي');
            addExpenseCategory(catName, amt);

            transactions.push({
              id: `tx-int-pay-${v.id || v.voucherNumber}`,
              date: v.date || '',
              docNumber: v.voucherNumber,
              docType: 'INTERNAL_PAYMENT',
              docTypeLabel: 'سند صرف داخلي',
              partnerName: v.paidTo || 'المستفيد الداخلي',
              description: v.description || v.expenseType || 'مصروفات تشغيلية داخلية',
              amount: amt,
              entryType: 'EXPENSE',
              paymentMethod: v.paymentMethod
            });
          }
        }
      });
    }

    // C) External Receipts linked to this center (Revenues)
    if (Array.isArray(externalReceipts)) {
      externalReceipts.forEach(v => {
        const matchesCenter = (v.costCenterId === center.id || v.costCenterId === center.code);
        if (matchesCenter && v.status === 'POSTED' && isInRange(v.date)) {
          const amt = Number(v.amount) || 0;
          if (amt > 0) {
            totalRevenues += amt;
            transactions.push({
              id: `tx-ext-rec-${v.id || v.voucherNumber}`,
              date: v.date || '',
              docNumber: v.voucherNumber,
              docType: 'EXTERNAL_RECEIPT',
              docTypeLabel: 'سند قبض خارجي',
              partnerName: v.partnerName || 'عميل / طرف خارجي',
              description: v.description || 'إيراد / تحصيل خارجي للمركز',
              amount: amt,
              entryType: 'REVENUE',
              paymentMethod: v.paymentMethod
            });
          }
        }
      });
    }

    // D) Internal Receipts linked to this center
    if (Array.isArray(internalReceipts)) {
      internalReceipts.forEach(v => {
        const matchesCenter = (v.costCenterId === center.id || v.costCenterId === center.code);
        if (matchesCenter && v.status === 'POSTED' && isInRange(v.date)) {
          const amt = Number(v.amount) || 0;
          if (amt > 0) {
            totalRevenues += amt;
            transactions.push({
              id: `tx-int-rec-${v.id || v.voucherNumber}`,
              date: v.date || '',
              docNumber: v.voucherNumber,
              docType: 'INTERNAL_RECEIPT',
              docTypeLabel: 'سند قبض داخلي',
              partnerName: v.receivedFrom || 'المصدر الداخلي',
              description: v.description || 'توريد / إيداع داخلي للمركز',
              amount: amt,
              entryType: 'REVENUE',
              paymentMethod: v.paymentMethod
            });
          }
        }
      });
    }

    // E) Journal Entries with line items tagged with this costCenterId
    if (Array.isArray(journalEntries)) {
      journalEntries.forEach(entry => {
        if (entry.status === JournalEntryStatus.Posted && isInRange(entry.date) && Array.isArray(entry.items)) {
          entry.items.forEach(item => {
            const itemCostCenter = (item as any).costCenterId;
            if (itemCostCenter === center.id || itemCostCenter === center.code) {
              const debit = Number(item.debit) || 0;
              const credit = Number(item.credit) || 0;
              
              if (debit > 0) {
                totalExpenses += debit;
                addExpenseCategory(item.description || entry.description || 'قيد تسوية يومية', debit);
                transactions.push({
                  id: `tx-je-d-${entry.id}-${item.id}`,
                  date: entry.date,
                  docNumber: entry.entryNumber,
                  docType: 'JOURNAL_ENTRY',
                  docTypeLabel: 'قيد يومية تسوية',
                  partnerName: item.partnerName || 'حساب أستاذ عام',
                  description: item.description || entry.description || 'قيد محاسبي مباشر لمركز التكلفة',
                  amount: debit,
                  entryType: 'EXPENSE'
                });
              } else if (credit > 0) {
                totalRevenues += credit;
                transactions.push({
                  id: `tx-je-c-${entry.id}-${item.id}`,
                  date: entry.date,
                  docNumber: entry.entryNumber,
                  docType: 'JOURNAL_ENTRY',
                  docTypeLabel: 'قيد يومية تسوية',
                  partnerName: item.partnerName || 'حساب أستاذ عام',
                  description: item.description || entry.description || 'قيد إيراد / تسوية دائنة للمركز',
                  amount: credit,
                  entryType: 'REVENUE'
                });
              }
            }
          });
        }
      });
    }

    // F) Sales Invoices linked to this center
    if (Array.isArray(salesInvoices)) {
      salesInvoices.forEach(inv => {
        const isPosted = inv.status === 'POSTED' || (!inv.status && Number(inv.totals?.grandTotal ?? inv.grandTotal) > 0);
        const matchesCenter =
          inv.costCenterId === center.id ||
          inv.costCenterId === center.code;

        if (isPosted && matchesCenter && isInRange(inv.date)) {
          const isReturn = String(inv.invoiceType || '').toUpperCase().includes('RETURN') || Boolean(inv.isReturn);
          const netRev = Math.max(0, Number(inv.totals?.subtotal ?? inv.subtotal ?? inv.totals?.grandTotal ?? inv.grandTotal) - Number(inv.totals?.discountTotal ?? inv.discountTotal ?? 0));
          if (netRev > 0) {
            if (isReturn) {
              totalExpenses += netRev;
              addExpenseCategory('مرتجعات مبيعات الفرع/المركز', netRev);
              transactions.push({
                id: `tx-sinv-ret-${inv.id}`,
                date: inv.date,
                docNumber: inv.invoiceNumber || inv.id,
                docType: 'SALES_INVOICE',
                docTypeLabel: 'مرتجع مبيعات',
                partnerName: inv.partnerName || inv.customerName || 'عميل',
                description: `مرتجع فاتورة مبيعات رقم ${inv.invoiceNumber}`,
                amount: netRev,
                entryType: 'EXPENSE'
              });
            } else {
              totalRevenues += netRev;
              transactions.push({
                id: `tx-sinv-${inv.id}`,
                date: inv.date,
                docNumber: inv.invoiceNumber || inv.id,
                docType: 'SALES_INVOICE',
                docTypeLabel: 'فاتورة مبيعات',
                partnerName: inv.partnerName || inv.customerName || 'عميل',
                description: `إيراد مبيعات فاتورة رقم ${inv.invoiceNumber}`,
                amount: netRev,
                entryType: 'REVENUE'
              });
            }
          }
        }
      });
    }

    // G) Purchase Invoices linked to this center
    if (Array.isArray(purchaseInvoices)) {
      purchaseInvoices.forEach(inv => {
        const isPosted = inv.status === 'POSTED' || (!inv.status && Number(inv.totals?.grandTotal ?? inv.grandTotal) > 0);
        const matchesCenter =
          inv.costCenterId === center.id ||
          inv.costCenterId === center.code;

        if (isPosted && matchesCenter && isInRange(inv.date)) {
          const isReturn = String(inv.invoiceType || '').toUpperCase().includes('RETURN') || Boolean(inv.isReturn);
          const netCost = Math.max(0, Number(inv.totals?.subtotal ?? inv.subtotal ?? inv.totals?.grandTotal ?? inv.grandTotal) - Number(inv.totals?.discountTotal ?? inv.discountTotal ?? 0));
          if (netCost > 0 && !isReturn) {
            totalExpenses += netCost;
            addExpenseCategory(`توريدات ومشتريات: ${inv.partnerName || inv.vendorName || 'مورد'}`, netCost);
            transactions.push({
              id: `tx-pinv-${inv.id}`,
              date: inv.date,
              docNumber: inv.invoiceNumber || inv.id,
              docType: 'PURCHASE_INVOICE',
              docTypeLabel: 'فاتورة مشتريات',
              partnerName: inv.partnerName || inv.vendorName || 'مورد',
              description: `فاتورة مشتريات وتوريد رقم ${inv.invoiceNumber}`,
              amount: netCost,
              entryType: 'EXPENSE'
            });
          }
        }
      });
    }

    // H) Manufacturing Work Orders linked to this center
    if (Array.isArray(workOrders)) {
      workOrders.forEach(wo => {
        const matchesCenter =
          wo.costCenterId === center.id ||
          wo.costCenterId === center.code;
        if (matchesCenter && (wo.status === 'IN_PROGRESS' || wo.status === 'COMPLETED') && isInRange(wo.startDate)) {
          const prodCost = Number(wo.totalProductionCost) || 0;
          if (prodCost > 0) {
            totalExpenses += prodCost;
            addExpenseCategory(`تكاليف تشغيل وتصنيع (${wo.finalProductName})`, prodCost);
            transactions.push({
              id: `tx-mfg-${wo.id}`,
              date: wo.startDate,
              docNumber: wo.orderNumber,
              docType: 'MANUFACTURING_ORDER',
              docTypeLabel: 'أمر تشغيل صناعي',
              partnerName: wo.supervisor || wo.workCenter,
              description: `تكاليف إنتاج ${wo.plannedQuantity} ${wo.unit} من ${wo.finalProductName}`,
              amount: prodCost,
              entryType: 'EXPENSE'
            });
          }
        }
      });
    }

    // Sort transactions by date descending
    transactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Compute expense breakdown percentages
    const expenseBreakdown: CostCenterExpenseItem[] = Object.values(expenseCategoryMap).map(cat => ({
      accountCode: center.code,
      accountName: cat.name,
      amount: cat.amount,
      percentage: totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0
    })).sort((a, b) => b.amount - a.amount);

    const netIncome = totalRevenues - totalExpenses;
    const budget = center.budget && center.budget > 0 ? center.budget : 0;
    const budgetUtilizationPercent = budget > 0 ? (totalExpenses / budget) * 100 : 0;

    return {
      costCenter: center,
      totalExpenses,
      totalRevenues,
      netIncome,
      budgetUtilizationPercent,
      vouchersCount: transactions.length,
      expenseBreakdown,
      transactions
    };
  });
}
