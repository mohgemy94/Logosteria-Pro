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
  DB_PAYMENT_VOUCHERS_KEY, 
  DB_RECEIPT_VOUCHERS_KEY,
  DB_INTERNAL_PAYMENT_VOUCHERS_KEY,
  DB_INTERNAL_RECEIPT_VOUCHERS_KEY
} from './sequences';
import { JOURNAL_ENTRIES_STORAGE_KEY } from './trialBalanceStore';
import { JournalEntry, JournalEntryStatus } from '../types/accounting';

export const COST_CENTERS_STORAGE_KEY = 'alpha_cost_centers_v1';

export const DEFAULT_COST_CENTERS: CostCenter[] = [
  {
    id: 'cc-branch-riyadh',
    code: 'CC-101',
    name: 'الفرع الرئيسي - الرياض',
    type: 'BRANCH',
    manager: 'م. أحمد الشهري',
    budget: 150000,
    description: 'المركز الرئيسي للإدارة والمعرض المركزي والمبيعات',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'cc-branch-jeddah',
    code: 'CC-102',
    name: 'فرع جدة والمنطقة الغربية',
    type: 'BRANCH',
    manager: 'أ. خالد العمودي',
    budget: 100000,
    description: 'معرض ومستودع توزيع المنطقة الغربية وميناء جدة',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'cc-proj-capital-towers',
    code: 'CC-201',
    name: 'مشروع أبراج العاصمة والتشييد',
    type: 'PROJECT',
    manager: 'م. سلطان المنصور',
    budget: 350000,
    description: 'مشروع توريد وتركيب المقاولات للمباني الذكية والأبراج',
    status: 'ACTIVE',
    createdAt: '2026-01-05T00:00:00.000Z'
  },
  {
    id: 'cc-proj-modern-mall',
    code: 'CC-202',
    name: 'مشروع مجمع المعارض والتجزئة',
    type: 'PROJECT',
    manager: 'م. عمر فاروق',
    budget: 200000,
    description: 'مشروع تجهيز المنافذ التجارية ومراكز التسوق',
    status: 'ACTIVE',
    createdAt: '2026-01-10T00:00:00.000Z'
  },
  {
    id: 'cc-fleet-transport',
    code: 'CC-301',
    name: 'أسطول النقليات والتوزيع اللوجستي',
    type: 'FLEET',
    manager: 'أ. فهد الدوسري',
    budget: 85000,
    description: 'شاحنات التوزيع وسيارات النقل الخفيف، الوقود والصيانة',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'cc-dept-it-systems',
    code: 'CC-401',
    name: 'قسم تقنية المعلومات وتطوير الأنظمة',
    type: 'DEPARTMENT',
    manager: 'م. ياسر القحطاني',
    budget: 45000,
    description: 'الخوادم، الرخص البرمجية، الدعم الفني وتحديث البنية التحتية',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'cc-dept-marketing',
    code: 'CC-402',
    name: 'إدارة التسويق والحملات الرقمية',
    type: 'DEPARTMENT',
    manager: 'أ. سارة التميمي',
    budget: 60000,
    description: 'الإعلانات الممولة، المعارض التجارية، والهوية التسويقية',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

export function loadCostCenters(): CostCenter[] {
  if (typeof window === 'undefined') return DEFAULT_COST_CENTERS;
  try {
    const raw = localStorage.getItem(COST_CENTERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(COST_CENTERS_STORAGE_KEY, JSON.stringify(DEFAULT_COST_CENTERS));
      return DEFAULT_COST_CENTERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    localStorage.setItem(COST_CENTERS_STORAGE_KEY, JSON.stringify(DEFAULT_COST_CENTERS));
    return DEFAULT_COST_CENTERS;
  } catch (err) {
    console.error('Failed to load cost centers:', err);
    return DEFAULT_COST_CENTERS;
  }
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
                // Debit movement on cost center (typically expense or asset assignment)
                totalExpenses += debit;
                addExpenseCategory(entry.description || 'قيد تسوية يومية', debit);
                transactions.push({
                  id: `tx-je-d-${entry.id}-${item.id}`,
                  date: entry.date,
                  docNumber: entry.entryNumber,
                  docType: 'JOURNAL_ENTRY',
                  docTypeLabel: 'قيد يومية تسوية',
                  partnerName: item.partnerName || 'حساب أستاذ عام',
                  description: entry.description || 'قيد محاسبي مباشر لمركز التكلفة',
                  amount: debit,
                  entryType: 'EXPENSE'
                });
              } else if (credit > 0) {
                // Credit movement on cost center (typically revenue or recovery)
                totalRevenues += credit;
                transactions.push({
                  id: `tx-je-c-${entry.id}-${item.id}`,
                  date: entry.date,
                  docNumber: entry.entryNumber,
                  docType: 'JOURNAL_ENTRY',
                  docTypeLabel: 'قيد يومية تسوية',
                  partnerName: item.partnerName || 'حساب أستاذ عام',
                  description: entry.description || 'قيد إيراد / تسوية دائنة للمركز',
                  amount: credit,
                  entryType: 'REVENUE'
                });
              }
            }
          });
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
