import { AccountType, JournalEntryStatus } from '../types/accounting';
import { 
  loadChartOfAccounts, 
  loadJournalEntries,
  resolveCashOrBankAccount,
  calculateInvoiceCogs
} from './trialBalanceStore';
import { loadStoredItems } from './itemsStore';
import { 
  loadCustomers, 
  loadVendors, 
  loadSalesInvoices, 
  loadPurchaseInvoices, 
  loadReceiptVouchers, 
  loadPaymentVouchers 
} from './partnerLedger';
import { 
  DB_INTERNAL_RECEIPT_VOUCHERS_KEY,
  DB_INTERNAL_PAYMENT_VOUCHERS_KEY
} from './sequences';
import { STORAGE_KEY_INVENTORY_AUDITS, STORAGE_KEY_EMPLOYEES } from './trialBalanceStore';

export type EntityCategory = 
  | 'ALL'
  | 'SAFE'
  | 'BANK'
  | 'CUSTOMER'
  | 'VENDOR'
  | 'EXPENSE'
  | 'EMPLOYEE'
  | 'TECHNICIAN'
  | 'ASSET'
  | 'INVENTORY'
  | 'REVENUE'
  | 'EQUITY'
  | 'GENERAL';

export interface SearchableEntity {
  id: string;
  code: string;
  name: string;
  category: EntityCategory;
  categoryLabel: string;
  type?: string | undefined;
  phone?: string | undefined;
  badgeColor?: string | undefined;
  extraInfo?: string | undefined;
}

export interface AccountMovementRow {
  id: string;
  orderIndex?: number | undefined;
  createdAt?: string | undefined;
  entryTimestamp?: number | undefined;
  formattedTime?: string | undefined;
  date: string; // YYYY-MM-DD
  documentNumber: string;
  documentType: string;
  documentTypeBadge: string;
  sourceModule: string;
  sourceView?: string | undefined;
  entityId?: string | undefined;
  entityName: string;
  entityCategory: EntityCategory;
  entityCategoryLabel: string;
  description: string;
  reference?: string | undefined;
  technicianOrEmployee?: string | undefined;
  safeOrBankName?: string | undefined;
  debit: number;
  credit: number;
  runningBalance?: number | undefined;
  balanceType?: 'DEBIT' | 'CREDIT' | 'ZERO' | undefined;
  notes?: string | undefined;
  statementHtml?: string | undefined;
}

export interface AccountMovementsFilter {
  startDate?: string;
  endDate?: string;
  selectedEntityId?: string;
  category?: EntityCategory;
  searchTerm?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface AccountMovementsSummary {
  openingBalance: number;
  openingBalanceType: 'DEBIT' | 'CREDIT' | 'ZERO';
  periodDebit: number;
  periodCredit: number;
  totalDebit: number;
  totalCredit: number;
  difference: number; // net account balance (totalDebit - totalCredit)
  balanceType: 'DEBIT' | 'CREDIT' | 'ZERO';
  count: number;
}

/**
 * Returns a comprehensive list of all searchable entities across the ERP:
 * - العملاء (Customers)
 * - الموردين (Vendors)
 * - الخزن والصناديق (Cash / Safes)
 * - البنوك والمصارف (Banks)
 * - المصروفات والتكاليف (Expenses)
 * - الموظفون والفنيون (Employees & Technicians)
 * - الأصول والممتلكات (Fixed Assets & Properties)
 * - المخازن والمستودعات (Warehouses & Stock)
 * - الإيرادات (Revenues)
 * - جميع حسابات دليل وشجرة الحسابات العامة
 */
export function getAllSearchableEntities(): SearchableEntity[] {
  const entities: SearchableEntity[] = [];
  const accounts = loadChartOfAccounts();

  // 1. Chart of Accounts categorized
  accounts.forEach(acc => {
    let cat: EntityCategory = 'GENERAL';
    let catLabel = 'حساب عام';
    let badge = 'bg-slate-100 text-slate-700 border-slate-200';

    if (acc.code === '1101' || acc.name.includes('صندوق') || acc.name.includes('خزينة')) {
      cat = 'SAFE';
      catLabel = 'خزينة / نقدية';
      badge = 'bg-amber-100 text-amber-800 border-amber-300';
    } else if (acc.code === '1102' || acc.code === '1103' || acc.code === '1104' || acc.name.includes('بنك') || acc.name.includes('شيك')) {
      cat = 'BANK';
      catLabel = 'بنك / مصرف';
      badge = 'bg-cyan-100 text-cyan-800 border-cyan-300';
    } else if (acc.code === '1201' || acc.name.includes('عملاء') || acc.name.includes('مدينين')) {
      cat = 'CUSTOMER';
      catLabel = 'حساب العملاء العام';
      badge = 'bg-blue-100 text-blue-800 border-blue-300';
    } else if (acc.code === '2101' || acc.name.includes('موردين') || acc.name.includes('دائنين')) {
      cat = 'VENDOR';
      catLabel = 'حساب الموردين العام';
      badge = 'bg-purple-100 text-purple-800 border-purple-300';
    } else if (acc.code.startsWith('5') || acc.type === AccountType.Expense) {
      cat = 'EXPENSE';
      catLabel = 'مصروف / تكاليف';
      badge = 'bg-rose-100 text-rose-800 border-rose-300';
    } else if (acc.code.startsWith('4') || acc.type === AccountType.Revenue) {
      cat = 'REVENUE';
      catLabel = 'إيرادات ومبيعات';
      badge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    } else if (acc.code.startsWith('14') || acc.name.includes('أصول') || acc.name.includes('معدات') || acc.name.includes('آلات') || acc.name.includes('سيارات') || acc.name.includes('ممتلكات')) {
      cat = 'ASSET';
      catLabel = 'أصول وممتلكات';
      badge = 'bg-orange-100 text-orange-800 border-orange-300';
    } else if (acc.code.startsWith('13') || acc.name.includes('مخزون') || acc.name.includes('بضاعة')) {
      cat = 'INVENTORY';
      catLabel = 'مخزون ومستودعات';
      badge = 'bg-yellow-100 text-yellow-800 border-yellow-300';
    } else if (acc.code.startsWith('3') || acc.type === AccountType.Equity) {
      cat = 'EQUITY';
      catLabel = 'حقوق ملكية ورأس مال';
      badge = 'bg-indigo-100 text-indigo-800 border-indigo-300';
    }

    entities.push({
      id: acc.id,
      code: acc.code,
      name: acc.name,
      category: cat,
      categoryLabel: catLabel,
      badgeColor: badge,
      extraInfo: `دليل الحسابات (${acc.code})`
    });
  });

  // 2. Customers
  const customers = loadCustomers();
  customers.forEach(cust => {
    entities.push({
      id: `cust-${cust.id}`,
      code: cust.code || cust.id,
      name: cust.name,
      category: 'CUSTOMER',
      categoryLabel: 'عميل',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
      phone: cust.phone,
      extraInfo: cust.phone ? `هاتف: ${cust.phone}` : 'عميل مسجل'
    });
  });

  // 3. Vendors
  const vendors = loadVendors();
  vendors.forEach(vend => {
    entities.push({
      id: `vend-${vend.id}`,
      code: vend.code || vend.id,
      name: vend.name,
      category: 'VENDOR',
      categoryLabel: 'مورد',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
      phone: vend.phone,
      extraInfo: vend.phone ? `هاتف: ${vend.phone}` : 'مورد مسجل'
    });
  });

  // 4. Employees & Technicians
  try {
    const rawEmp = localStorage.getItem(STORAGE_KEY_EMPLOYEES);
    if (rawEmp) {
      const emps = JSON.parse(rawEmp);
      if (Array.isArray(emps)) {
        emps.forEach((emp: any) => {
          const isTech = emp.jobTitle?.includes('فني') || emp.department?.includes('صيانة') || emp.role?.includes('technician');
          entities.push({
            id: `emp-${emp.id}`,
            code: emp.code || emp.id,
            name: emp.name || emp.fullName,
            category: isTech ? 'TECHNICIAN' : 'EMPLOYEE',
            categoryLabel: isTech ? 'فني صيانة / تشغيل' : 'موظف',
            badgeColor: isTech ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-teal-100 text-teal-800 border-teal-300',
            extraInfo: `${emp.jobTitle || 'موظف'} - ${emp.department || 'العمليات'}`
          });
        });
      }
    }
  } catch (e) {
    console.error("Error loading employees for search:", e);
  }

  // 5. Technicians & Sales Reps extracted from sales invoices
  try {
    let invoices: any[] = [];
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('alpha_sales_invoices_v1') : null;
      if (raw) invoices = JSON.parse(raw);
    } catch {
      // fallback
    }
    if (!Array.isArray(invoices) || invoices.length === 0) {
      invoices = typeof loadSalesInvoices === 'function' ? loadSalesInvoices() : [];
    }
    if (Array.isArray(invoices)) {
      const techNames = new Set<string>();
      invoices.forEach((inv: any) => {
        if (inv && inv.technicianName && typeof inv.technicianName === 'string' && inv.technicianName.trim()) {
          techNames.add(inv.technicianName.trim());
        }
        if (inv && inv.salesRep && typeof inv.salesRep === 'string' && inv.salesRep.trim()) {
          techNames.add(inv.salesRep.trim());
        }
      });
      techNames.forEach(name => {
        const exists = entities.some(e => e.name && e.name.toLowerCase() === name.toLowerCase());
        if (!exists) {
          entities.push({
            id: `tech-${name}`,
            code: 'TECH',
            name: name,
            category: 'TECHNICIAN',
            categoryLabel: 'فني / مندوب',
            badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
            extraInfo: 'فني معتمد من الفواتير'
          });
        }
      });
    }
  } catch (e) {
    console.error("Error loading technicians for search:", e);
  }

  return entities;
}

/**
 * Helper to normalize entity IDs without prefix duplication
 */
function normalizeEntityId(cat: 'CUSTOMER' | 'VENDOR' | 'ACCOUNT' | 'EMPLOYEE' | 'TECH', id?: string): string | undefined {
  if (!id) return undefined;
  const clean = id.replace(/^(cust-|vend-|acc-|emp-|tech-)+/, '');
  if (cat === 'CUSTOMER') return `cust-${clean}`;
  if (cat === 'VENDOR') return `vend-${clean}`;
  if (cat === 'EMPLOYEE') return `emp-${clean}`;
  if (cat === 'TECH') return `tech-${clean}`;
  return `acc-${clean}`;
}

/**
 * Main calculation engine that unifies all transactions across all modules
 * into structured movement rows matching the 3-column format:
 * [ بيان الحركة | مدين | دائن ]
 */
export function getUnifiedAccountMovements(filter: AccountMovementsFilter = {}): {
  movements: AccountMovementRow[];
  summary: AccountMovementsSummary;
} {
  const { startDate, endDate, selectedEntityId, category, searchTerm } = filter;
  const accounts = loadChartOfAccounts();
  const allEntities = getAllSearchableEntities();

  const rawId = (selectedEntityId || '').trim();
  const cleanId = rawId.replace(/^(cust-|vend-|acc-|emp-|tech-)+/, '');

  const entityTarget = (rawId && rawId !== 'ALL') ? allEntities.find(e => 
    e.id === rawId || 
    e.code === rawId || 
    e.id === `cust-${cleanId}` ||
    e.id === `vend-${cleanId}` ||
    e.id === `acc-${cleanId}` ||
    e.id === `emp-${cleanId}` ||
    e.id === `tech-${cleanId}` ||
    e.code === cleanId ||
    (e.name && e.name.toLowerCase().trim() === rawId.toLowerCase().trim()) ||
    (e.name && rawId.toLowerCase().includes(e.name.toLowerCase().trim()))
  ) : undefined;

  const isBeforeEndDate = (dStr: string) => {
    if (!dStr) return true;
    if (endDate && dStr > endDate) return false;
    return true;
  };

  const rawRows: AccountMovementRow[] = [];
  let rowOrderCounter = 0;

  // Helper to add movement
  const pushRow = (row: Omit<AccountMovementRow, 'id'> & { id?: string }) => {
    const id = row.id || `mov-${Math.random().toString(36).substring(2, 9)}`;
    const orderIdx = rowOrderCounter++;

    // Calculate exact timestamp of movement entry (تاريخ ووقت إدخال الحركة)
    let entryTimestamp = 0;
    if (row.createdAt) {
      const parsed = new Date(row.createdAt).getTime();
      if (!isNaN(parsed) && parsed > 0) {
        entryTimestamp = parsed;
      }
    }
    if (!entryTimestamp && row.date) {
      const datePart = row.date.length === 10 ? `${row.date}T00:00:00.000Z` : row.date;
      const parsed = new Date(datePart).getTime();
      if (!isNaN(parsed) && parsed > 0) {
        entryTimestamp = parsed + orderIdx * 1000;
      }
    }
    if (!entryTimestamp) {
      entryTimestamp = Date.now() + orderIdx;
    }

    // Format human-readable time of movement entry (وقت الإدخال)
    let formattedTime = row.formattedTime;
    if (!formattedTime && row.createdAt) {
      try {
        const d = new Date(row.createdAt);
        if (!isNaN(d.getTime())) {
          formattedTime = d.toLocaleTimeString('ar-SA', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          });
        }
      } catch {}
    }

    rawRows.push({
      ...row,
      id,
      orderIndex: orderIdx,
      entryTimestamp,
      formattedTime
    });
  };

  // 0. Opening Balances for Customers and Vendors
  try {
    const customers = loadCustomers();
    customers.forEach(cust => {
      const op = Number(cust.openingBalance) || 0;
      if (op !== 0 && isBeforeEndDate(cust.openingBalanceDate || '2026-01-01')) {
        const normId = normalizeEntityId('CUSTOMER', cust.id);
        pushRow({
          id: `op-cust-${cust.id}`,
          date: cust.openingBalanceDate || '2026-01-01',
          createdAt: (cust as any).createdAt || `${cust.openingBalanceDate || '2026-01-01'}T00:00:00.000Z`,
          documentNumber: 'OP-BAL',
          documentType: 'رصيد افتتاحي للعميل',
          documentTypeBadge: 'رصيد افتتاحي',
          sourceModule: 'بيانات العملاء',
          sourceView: 'customers',
          entityId: normId,
          entityName: cust.name,
          entityCategory: 'CUSTOMER',
          entityCategoryLabel: 'عميل',
          description: `رصيد افتتاحي مرحل لحساب العميل: ${cust.name}`,
          reference: cust.phone || cust.code,
          debit: op > 0 ? op : 0,
          credit: op < 0 ? Math.abs(op) : 0
        });
      }
    });

    const vendors = loadVendors();
    vendors.forEach(vend => {
      const op = Number(vend.openingBalance) || 0;
      if (op !== 0 && isBeforeEndDate(vend.openingBalanceDate || '2026-01-01')) {
        const normId = normalizeEntityId('VENDOR', vend.id);
        pushRow({
          id: `op-vend-${vend.id}`,
          date: vend.openingBalanceDate || '2026-01-01',
          createdAt: (vend as any).createdAt || `${vend.openingBalanceDate || '2026-01-01'}T00:00:00.000Z`,
          documentNumber: 'OP-BAL',
          documentType: 'رصيد افتتاحي للمورد',
          documentTypeBadge: 'رصيد افتتاحي',
          sourceModule: 'بيانات الموردين',
          sourceView: 'vendors',
          entityId: normId,
          entityName: vend.name,
          entityCategory: 'VENDOR',
          entityCategoryLabel: 'مورد',
          description: `رصيد افتتاحي مرحل لحساب المورد: ${vend.name}`,
          reference: vend.phone || vend.code,
          debit: op > 0 ? op : 0,
          credit: op < 0 ? Math.abs(op) : 0
        });
      }
    });
  } catch (e) {
    console.error("Opening balance extraction error:", e);
  }

  // 1. Manual Journal Entries
  try {
    const entries = loadJournalEntries();
    entries.forEach(entry => {
      if (entry.status !== JournalEntryStatus.Posted) return;
      if (!isBeforeEndDate(entry.date)) return;

      (entry.items || []).forEach((ji, idx) => {
        const d = Number(ji.debit) || 0;
        const c = Number(ji.credit) || 0;
        if (d === 0 && c === 0) return;

        const matchedAcc = accounts.find(a => a.id === ji.accountId || a.code === ji.accountId);
        const accName = matchedAcc ? matchedAcc.name : ((ji as any).accountName || 'حساب عام');
        const accCode = matchedAcc ? matchedAcc.code : (ji.accountId || '');

        let entCat: EntityCategory = 'GENERAL';
        let entCatLabel = 'قيد محاسبي';
        if (accCode === '1101') { entCat = 'SAFE'; entCatLabel = 'خزينة'; }
        else if (accCode === '1102' || accCode === '1103') { entCat = 'BANK'; entCatLabel = 'بنك'; }
        else if (accCode === '1201') { entCat = 'CUSTOMER'; entCatLabel = 'عملاء'; }
        else if (accCode === '2101') { entCat = 'VENDOR'; entCatLabel = 'موردين'; }
        else if (accCode.startsWith('5')) { entCat = 'EXPENSE'; entCatLabel = 'مصروف'; }
        else if (accCode.startsWith('4')) { entCat = 'REVENUE'; entCatLabel = 'إيراد'; }
        else if (accCode.startsWith('14')) { entCat = 'ASSET'; entCatLabel = 'أصول وممتلكات'; }

        const entryCreatedAt = (entry as any).createdAt || (entry as any).created_at || `${entry.date}T00:00:${String(idx).padStart(2, '0')}.000Z`;

        // Account movement row
        pushRow({
          id: `jv-${entry.id}-${idx}`,
          date: entry.date,
          createdAt: entryCreatedAt,
          documentNumber: entry.entryNumber || 'JV',
          documentType: 'قيد يومية يدوي',
          documentTypeBadge: 'قيد يومية',
          sourceModule: 'القيود اليومية العامة',
          sourceView: 'journal',
          entityId: matchedAcc?.id || ji.accountId,
          entityName: `${accName} (${accCode})`,
          entityCategory: entCat,
          entityCategoryLabel: entCatLabel,
          description: (ji as any).description || entry.description || 'تسجيل قيد يومية عام',
          reference: entry.reference || ji.partnerName || '-',
          debit: d,
          credit: c
        });

        // If line is tagged with a subledger partner, also push partner movement
        if (ji.partnerId || ji.partnerName) {
          const isVend = ji.partnerType === 'VENDOR';
          const pNormId = ji.partnerId ? normalizeEntityId(isVend ? 'VENDOR' : 'CUSTOMER', ji.partnerId) : undefined;
          pushRow({
            id: `jv-p-${entry.id}-${idx}`,
            date: entry.date,
            createdAt: entryCreatedAt,
            documentNumber: entry.entryNumber || 'JV',
            documentType: 'تسوية قيد يومية للعميل/المورد',
            documentTypeBadge: 'قيد يومية',
            sourceModule: 'القيود اليومية العامة',
            sourceView: 'journal',
            entityId: pNormId,
            entityName: `${isVend ? 'المورد' : 'العميل'}: ${ji.partnerName || 'جهة مسجلة'}`,
            entityCategory: isVend ? 'VENDOR' : 'CUSTOMER',
            entityCategoryLabel: isVend ? 'مورد' : 'عميل',
            description: (ji as any).description || entry.description || `تسوية قيد يومية #${entry.entryNumber}`,
            reference: entry.reference || ji.partnerName,
            debit: d,
            credit: c
          });
        }
      });
    });
  } catch (e) {
    console.error("Journal movements extraction error:", e);
  }

  // Load items map once for Perpetual Inventory COGS calculation
  const itemsList = loadStoredItems();
  const itemsMap = new Map<string, any>();
  itemsList.forEach(item => {
    if (item.id) itemsMap.set(String(item.id), item);
    if (item.code) itemsMap.set(String(item.code), item);
    if (item.name) itemsMap.set(String(item.name).trim(), item);
  });

  // 2. Sales Invoices
  try {
    let invoices: any[] = [];
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('alpha_sales_invoices_v1') : null;
      if (raw) invoices = JSON.parse(raw);
    } catch {}
    if (!Array.isArray(invoices) || invoices.length === 0) {
      invoices = typeof loadSalesInvoices === 'function' ? loadSalesInvoices() : [];
    }
    if (Array.isArray(invoices)) {
      invoices.forEach((rawInv: any) => {
        const inv = rawInv;
        const invStatus = (inv.status || 'POSTED').toUpperCase();
        if ((invStatus === 'POSTED' || invStatus === 'APPROVED' || !inv.status || inv.isPosted) && isBeforeEndDate(inv.date)) {
          const grandTotal = Number(inv.totals?.grandTotal ?? inv.grandTotal) || 0;
          const subtotal = Number(inv.totals?.subtotal ?? inv.subtotal) || 0;
          const taxTotal = Number(inv.totals?.taxTotal ?? inv.totals?.vatTotal ?? inv.taxTotal) || 0;
          const discountTotal = Number(inv.totals?.discountTotal ?? inv.totals?.discount ?? inv.discountTotal) || 0;
          const isCash = inv.invoiceType === 'CASH' || inv.paymentType === 'CASH' || inv.paymentType === 'كاش' || inv.paymentMethod === 'CASH';
          const isReturn = inv.isReturn === true || inv.type === 'RETURN' || String(inv.invoiceNumber || '').startsWith('SR-');
          const partnerId = inv.partnerId || inv.customerId || '';
          const custName = inv.partnerName || inv.customerName || 'عميل نقدي';
          const invNo = inv.invoiceNumber || inv.id;
          const normCustId = partnerId ? normalizeEntityId('CUSTOMER', partnerId) : undefined;

          const treasuryAcc = resolveCashOrBankAccount(
            accounts,
            inv.safe || inv.treasuryId || inv.accountId,
            inv.paymentMethod || inv.paymentType
          );
          const isTreasuryBank = treasuryAcc.code === '1102' || treasuryAcc.code === '1103' || treasuryAcc.name.includes('بنك') || treasuryAcc.name.includes('مصرف');

          // Leg 1: Customer AR
          pushRow({
            id: `sale-ar-${inv.id}`,
            date: inv.date,
            createdAt: inv.createdAt,
            documentNumber: invNo,
            documentType: isReturn ? 'مرتجع مبيعات' : 'فاتورة مبيعات',
            documentTypeBadge: isReturn ? 'مرتجع مبيعات' : (isCash ? 'مبيعات نقدية' : 'مبيعات آجل'),
            sourceModule: 'فواتير المبيعات',
            sourceView: 'sales',
            entityId: normCustId,
            entityName: `العميل: ${custName}`,
            entityCategory: 'CUSTOMER',
            entityCategoryLabel: 'عميل',
            description: `${isReturn ? 'مرتجع مبيعات' : 'فاتورة مبيعات'} رقم ${invNo} - العميل: ${custName}${inv.technicianName ? ` | الفني: ${inv.technicianName}` : ''}`,
            reference: inv.reference || custName,
            technicianOrEmployee: inv.technicianName || inv.salesRep,
            debit: isReturn ? 0 : grandTotal,
            credit: isReturn ? grandTotal : 0
          });

          // Paid amount inside the invoice (cash sale or partial down-payment paid at invoice creation)
          const rawPaid = Number(
            inv.paidAmount ?? 
            inv.totals?.cashPaid ?? 
            inv.totals?.paidAmount ?? 
            inv.paid_amount ?? 
            inv.amountPaid ?? 
            inv.cashPaid ?? 
            (isCash ? grandTotal : 0)
          );
          const paidAmount = Math.min(grandTotal, Math.max(0, isNaN(rawPaid) ? (isCash ? grandTotal : 0) : rawPaid));

          if (paidAmount > 0) {
            // Customer credit (or debit on return)
            pushRow({
              id: `sale-pay-cust-${inv.id}`,
              date: inv.date,
              createdAt: inv.createdAt,
              documentNumber: invNo,
              documentType: isReturn ? 'رد نقدية لمرتجع مبيعات' : (isCash ? 'سداد فوري لفاتورة مبيعات نقدية' : 'دفعة مسددة من فاتورة مبيعات'),
              documentTypeBadge: isReturn ? 'رد نقدي' : (isCash ? 'تحصيل نقدي' : 'دفعة مسددة'),
              sourceModule: 'فواتير المبيعات',
              sourceView: 'sales',
              entityId: normCustId,
              entityName: `العميل: ${custName}`,
              entityCategory: 'CUSTOMER',
              entityCategoryLabel: 'عميل',
              description: isCash
                ? `سداد فوري مسجل على ${isReturn ? 'مرتجع' : 'فاتورة'} مبيعات #${invNo} - ${custName} عبر ${treasuryAcc.name}`
                : `دفعة مسددة على فاتورة مبيعات #${invNo} - ${custName} (${paidAmount.toLocaleString()} ر.س) عبر ${treasuryAcc.name}`,
              reference: custName,
              technicianOrEmployee: inv.technicianName || inv.salesRep,
              debit: isReturn ? paidAmount : 0,
              credit: isReturn ? 0 : paidAmount
            });

            // Selected Cash Safe or Bank
            pushRow({
              id: `sale-safe-${inv.id}`,
              date: inv.date,
              createdAt: inv.createdAt,
              documentNumber: invNo,
              documentType: isReturn ? `رد قيمة مرتجع مبيعات من ${treasuryAcc.name}` : (isCash ? `تحصيل مبيعات في ${treasuryAcc.name}` : `تحصيل دفعة مبيعات في ${treasuryAcc.name}`),
              documentTypeBadge: isTreasuryBank ? 'تحصيل بنكي' : 'تحصيل نقدي',
              sourceModule: 'فواتير المبيعات',
              sourceView: 'sales',
              entityId: treasuryAcc.id,
              entityName: `${treasuryAcc.name} (${treasuryAcc.code})`,
              entityCategory: isTreasuryBank ? 'BANK' : 'SAFE',
              entityCategoryLabel: isTreasuryBank ? 'بنك / مصرف' : 'خزينة / نقدية',
              description: isCash
                ? `${isReturn ? 'رد مبلغ مرتجع' : 'تحصيل'} مبيعات #${invNo} للعميل ${custName} (${treasuryAcc.name})`
                : `تحصيل دفعة فاتورة مبيعات #${invNo} للعميل ${custName} (${paidAmount.toLocaleString()} ر.س) في ${treasuryAcc.name}`,
              reference: custName,
              safeOrBankName: treasuryAcc.name,
              technicianOrEmployee: inv.technicianName || inv.salesRep,
              debit: isReturn ? 0 : paidAmount,
              credit: isReturn ? paidAmount : 0
            });
          }

          // Leg 2: Sales Revenue (Credit on Sale, Debit on Return)
          const revAccId = isReturn ? 'acc-4102' : 'acc-4101';
          const revAccName = isReturn ? 'مردودات ومسموحات المبيعات (4102)' : 'إيرادات المبيعات التجارية (4101)';
          const revAmount = discountTotal > 0 ? subtotal : (subtotal - discountTotal);
          pushRow({
            id: `sale-rev-${inv.id}`,
            date: inv.date,
            documentNumber: invNo,
            documentType: isReturn ? 'مرتجع مبيعات (مردودات)' : 'فاتورة مبيعات (إيراد)',
            documentTypeBadge: isReturn ? 'مردودات مبيعات' : 'إيراد مبيعات',
            sourceModule: 'فواتير المبيعات',
            sourceView: 'sales',
            entityId: revAccId,
            entityName: revAccName,
            entityCategory: 'REVENUE',
            entityCategoryLabel: 'إيرادات ومبيعات',
            description: `${isReturn ? 'مردودات' : 'إيراد'} مبيعات فاتورة ${invNo} للعميل ${custName}`,
            reference: custName,
            technicianOrEmployee: inv.technicianName || inv.salesRep,
            debit: isReturn ? revAmount : 0,
            credit: isReturn ? 0 : revAmount
          });

          // Leg 3: VAT Output
          if (taxTotal > 0) {
            pushRow({
              id: `sale-vat-${inv.id}`,
              date: inv.date,
              documentNumber: invNo,
              documentType: isReturn ? 'عكس ضريبة مخرجات مبيعات' : 'ضريبة مخرجات مبيعات',
              documentTypeBadge: 'ضريبة VAT',
              sourceModule: 'فواتير المبيعات',
              sourceView: 'sales',
              entityId: 'acc-2102',
              entityName: 'ضريبة القيمة المضافة المستحقة (2102)',
              entityCategory: 'GENERAL',
              entityCategoryLabel: 'التزامات ضريبية',
              description: `ضريبة القيمة المضافة لفاتورة مبيعات ${invNo} (${taxTotal.toLocaleString()} ر.س)`,
              reference: custName,
              debit: isReturn ? taxTotal : 0,
              credit: isReturn ? 0 : taxTotal
            });
          }

          // Leg 4: Discount Allowed
          if (discountTotal > 0) {
            pushRow({
              id: `sale-disc-${inv.id}`,
              date: inv.date,
              documentNumber: invNo,
              documentType: 'خصم مسموح به',
              documentTypeBadge: 'خصم ممنوح',
              sourceModule: 'فواتير المبيعات',
              sourceView: 'sales',
              entityId: 'acc-4103',
              entityName: 'الخصم المسموح به للعملاء (4103)',
              entityCategory: 'EXPENSE',
              entityCategoryLabel: 'خصم مبيعات',
              description: `خصم تجاري ممنوح للعميل ${custName} في الفاتورة ${invNo}`,
              reference: custName,
              debit: isReturn ? 0 : discountTotal,
              credit: isReturn ? discountTotal : 0
            });
          }

          // Leg 5: Perpetual Inventory COGS (5101 Dr / 1301 Cr)
          const cogsAmount = calculateInvoiceCogs(inv, itemsMap);
          if (cogsAmount > 0) {
            pushRow({
              id: `sale-cogs-${inv.id}`,
              date: inv.date,
              documentNumber: invNo,
              documentType: isReturn ? 'رد تكلفة بضاعة مباعة (مرتجع)' : 'تكلفة البضاعة المباعة (COGS)',
              documentTypeBadge: 'تكلفة مبيعات',
              sourceModule: 'فواتير المبيعات',
              sourceView: 'sales',
              entityId: 'acc-5101',
              entityName: 'تكلفة البضاعة المباعة - COGS (5101)',
              entityCategory: 'EXPENSE',
              entityCategoryLabel: 'تكلفة مبيعات',
              description: `${isReturn ? 'عكس تكلفة البضاعة المباعة لمرتجع' : 'إثبات تكلفة البضاعة المباعة لفاتورة'} مبيعات رقم ${invNo}`,
              reference: custName,
              debit: isReturn ? 0 : cogsAmount,
              credit: isReturn ? cogsAmount : 0
            });

            pushRow({
              id: `sale-inv-out-${inv.id}`,
              date: inv.date,
              documentNumber: invNo,
              documentType: isReturn ? 'إعادة مخزون من مرتجع مبيعات' : 'صرف مخزون بضاعة مباعة',
              documentTypeBadge: 'حركة مخزون',
              sourceModule: 'فواتير المبيعات',
              sourceView: 'sales',
              entityId: 'acc-1301',
              entityName: 'المخزون السلعي والمواد الخام (1301)',
              entityCategory: 'INVENTORY',
              entityCategoryLabel: 'مخزون ومستودعات',
              description: `${isReturn ? 'إرجاع بضاعة للمخزون بموجب مرتجع' : 'صرف بضاعة مباعة بالتكلفة لفاتورة'} مبيعات رقم ${invNo}`,
              reference: custName,
              debit: isReturn ? cogsAmount : 0,
              credit: isReturn ? 0 : cogsAmount
            });
          }
        }
      });
    }
  } catch (e) {
    console.error("Sales movements extraction error:", e);
  }

  // 3. Purchase Invoices
  try {
    let invoices: any[] = [];
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('alpha_purchases_invoices_v1') : null;
      if (raw) invoices = JSON.parse(raw);
    } catch {}
    if (!Array.isArray(invoices) || invoices.length === 0) {
      invoices = typeof loadPurchaseInvoices === 'function' ? loadPurchaseInvoices() : [];
    }
    if (Array.isArray(invoices)) {
      invoices.forEach((rawInv: any) => {
        const inv = rawInv;
        const invStatus = (inv.status || 'POSTED').toUpperCase();
        if ((invStatus === 'POSTED' || invStatus === 'APPROVED' || !inv.status || inv.isPosted) && isBeforeEndDate(inv.date)) {
          const grandTotal = Number(inv.totals?.grandTotal ?? inv.grandTotal) || 0;
          const subtotal = Number(inv.totals?.subtotal ?? inv.subtotal) || 0;
          const taxTotal = Number(inv.totals?.taxTotal ?? inv.totals?.vatTotal ?? inv.taxTotal) || 0;
          const discountTotal = Number(inv.totals?.discountTotal ?? inv.totals?.discount ?? inv.discountTotal) || 0;
          const isCash = inv.invoiceType === 'CASH' || inv.paymentType === 'CASH' || inv.paymentType === 'كاش' || inv.paymentMethod === 'CASH';
          const isReturn = inv.isReturn === true || inv.type === 'RETURN' || String(inv.invoiceNumber || '').startsWith('PR-');
          const partnerId = inv.partnerId || inv.vendorId || '';
          const vendName = inv.partnerName || inv.vendorName || 'مورد عام';
          const invNo = inv.invoiceNumber || inv.id;
          const normVendId = partnerId ? normalizeEntityId('VENDOR', partnerId) : undefined;

          const treasuryAcc = resolveCashOrBankAccount(
            accounts,
            inv.safe || inv.treasuryId || inv.accountId,
            inv.paymentMethod || inv.paymentType
          );
          const isTreasuryBank = treasuryAcc.code === '1102' || treasuryAcc.code === '1103' || treasuryAcc.name.includes('بنك') || treasuryAcc.name.includes('مصرف');

          // Net inventory cost excluding recoverable Input VAT (2102)
          const inventoryAmount = subtotal > 0 ? subtotal : Math.max(0, grandTotal - taxTotal + discountTotal);

          // Leg 1: Inventory (1301)
          pushRow({
            id: `purch-inv-${inv.id}`,
            date: inv.date,
            documentNumber: invNo,
            documentType: isReturn ? 'مرتجع مشتريات (تخفيض مخزون)' : 'فاتورة مشتريات (مخزون)',
            documentTypeBadge: isReturn ? 'مرتجع مشتريات' : 'مشتريات مخزون',
            sourceModule: 'فواتير المشتريات',
            sourceView: 'purchases',
            entityId: 'acc-1301',
            entityName: 'المخزون السلعي والمواد الخام (1301)',
            entityCategory: 'INVENTORY',
            entityCategoryLabel: 'مخزون ومستودعات',
            description: `${isReturn ? 'رد مخزون للمورد بموجب مرتجع' : 'إضافة مخزون سلع بموجب فاتورة'} مشتريات ${invNo} - المورد ${vendName}`,
            reference: vendName,
            debit: isReturn ? 0 : inventoryAmount,
            credit: isReturn ? inventoryAmount : 0
          });

          // Leg 1b: Input VAT (2102)
          if (taxTotal > 0) {
            pushRow({
              id: `purch-vat-${inv.id}`,
              date: inv.date,
              documentNumber: invNo,
              documentType: isReturn ? 'عكس ضريبة مدخلات مشتريات' : 'ضريبة مدخلات مشتريات (VAT)',
              documentTypeBadge: 'ضريبة مدخلات',
              sourceModule: 'فواتير المشتريات',
              sourceView: 'purchases',
              entityId: 'acc-2102',
              entityName: 'ضريبة القيمة المضافة المستحقة (2102)',
              entityCategory: 'GENERAL',
              entityCategoryLabel: 'ضريبة القيمة المضافة',
              description: `ضريبة مدخلات مستردة لفاتورة مشتريات ${invNo} من المورد ${vendName}`,
              reference: vendName,
              debit: isReturn ? 0 : taxTotal,
              credit: isReturn ? taxTotal : 0
            });
          }

          // Leg 2: Vendor AP
          pushRow({
            id: `purch-ap-${inv.id}`,
            date: inv.date,
            createdAt: inv.createdAt,
            documentNumber: invNo,
            documentType: isReturn ? 'مرتجع مشتريات' : 'فاتورة مشتريات',
            documentTypeBadge: isReturn ? 'مرتجع مشتريات' : (isCash ? 'مشتريات نقدية' : 'مشتريات آجل'),
            sourceModule: 'فواتير المشتريات',
            sourceView: 'purchases',
            entityId: normVendId,
            entityName: `المورد: ${vendName}`,
            entityCategory: 'VENDOR',
            entityCategoryLabel: 'مورد',
            description: `${isReturn ? 'تخفيض استحقاق بمرتجع' : 'استحقاق فاتورة'} مشتريات رقم ${invNo} لصالح المورد ${vendName}`,
            reference: inv.supplierRef || vendName,
            debit: isReturn ? grandTotal : 0,
            credit: isReturn ? 0 : grandTotal
          });

          // Paid amount inside the purchase invoice (cash purchase or down-payment)
          const rawPaid = Number(
            inv.paidAmount ?? 
            inv.totals?.cashPaid ?? 
            inv.totals?.paidAmount ?? 
            inv.paid_amount ?? 
            inv.amountPaid ?? 
            inv.cashPaid ?? 
            (isCash ? grandTotal : 0)
          );
          const paidAmount = Math.min(grandTotal, Math.max(0, isNaN(rawPaid) ? (isCash ? grandTotal : 0) : rawPaid));

          if (paidAmount > 0) {
            // Vendor debit (or credit on return)
            pushRow({
              id: `purch-pay-vend-${inv.id}`,
              date: inv.date,
              createdAt: inv.createdAt,
              documentNumber: invNo,
              documentType: isReturn ? 'استرداد نقدية لمرتجع مشتريات' : (isCash ? 'سداد فوري لفاتورة مشتريات نقدية' : 'دفعة مسددة لفاتورة مشتريات'),
              documentTypeBadge: isReturn ? 'استرداد نقدي' : (isCash ? 'سداد نقدي' : 'دفعة مسددة'),
              sourceModule: 'فواتير المشتريات',
              sourceView: 'purchases',
              entityId: normVendId,
              entityName: `المورد: ${vendName}`,
              entityCategory: 'VENDOR',
              entityCategoryLabel: 'مورد',
              description: isCash
                ? `سداد فوري مسجل على ${isReturn ? 'مرتجع' : 'فاتورة'} مشتريات #${invNo} للمورد ${vendName} من ${treasuryAcc.name}`
                : `دفعة مسددة على فاتورة مشتريات #${invNo} للمورد ${vendName} (${paidAmount.toLocaleString()} ر.س) من ${treasuryAcc.name}`,
              reference: vendName,
              debit: isReturn ? 0 : paidAmount,
              credit: isReturn ? paidAmount : 0
            });

            // Selected Cash Safe or Bank
            pushRow({
              id: `purch-safe-${inv.id}`,
              date: inv.date,
              createdAt: inv.createdAt,
              documentNumber: invNo,
              documentType: isReturn ? `استرداد قيمة مرتجع مشتريات في ${treasuryAcc.name}` : (isCash ? `صرف مشتريات من ${treasuryAcc.name}` : `صرف دفعة مشتريات من ${treasuryAcc.name}`),
              documentTypeBadge: isTreasuryBank ? 'صرف بنكي' : 'صرف نقدي',
              sourceModule: 'فواتير المشتريات',
              sourceView: 'purchases',
              entityId: treasuryAcc.id,
              entityName: `${treasuryAcc.name} (${treasuryAcc.code})`,
              entityCategory: isTreasuryBank ? 'BANK' : 'SAFE',
              entityCategoryLabel: isTreasuryBank ? 'بنك / مصرف' : 'خزينة / نقدية',
              description: isCash
                ? `${isReturn ? 'استرداد' : 'صرف'} قيمة فاتورة مشتريات #${invNo} للمورد ${vendName} (${treasuryAcc.name})`
                : `صرف دفعة فاتورة مشتريات #${invNo} للمورد ${vendName} (${paidAmount.toLocaleString()} ر.س) من ${treasuryAcc.name}`,
              reference: vendName,
              safeOrBankName: treasuryAcc.name,
              debit: isReturn ? paidAmount : 0,
              credit: isReturn ? 0 : paidAmount
            });
          }

          // Leg 3: Discount Received
          if (discountTotal > 0) {
            pushRow({
              id: `purch-disc-${inv.id}`,
              date: inv.date,
              documentNumber: invNo,
              documentType: 'خصم مكتسب مشتريات',
              documentTypeBadge: 'خصم مكتسب',
              sourceModule: 'فواتير المشتريات',
              sourceView: 'purchases',
              entityId: 'acc-4203',
              entityName: 'الخصم المكتسب من الموردين (4203)',
              entityCategory: 'REVENUE',
              entityCategoryLabel: 'خصم مكتسب',
              description: `خصم مكتسب من المورد ${vendName} على فاتورة الشراء ${invNo}`,
              reference: vendName,
              debit: isReturn ? discountTotal : 0,
              credit: isReturn ? 0 : discountTotal
            });
          }
        }
      });
    }
  } catch (e) {
    console.error("Purchase movements extraction error:", e);
  }

  // 4. External Receipt Vouchers
  try {
    const vouchers = loadReceiptVouchers();
    if (Array.isArray(vouchers)) {
      vouchers.forEach((rawV: any) => {
        const v = rawV;
        const vStatus = (v.status || 'POSTED').toUpperCase();
        if ((vStatus === 'POSTED' || vStatus === 'APPROVED' || !v.status) && isBeforeEndDate(v.date)) {
          const amt = Number(v.amount) || 0;
          const treasuryAcc = resolveCashOrBankAccount(
            accounts,
            v.accountId || v.treasuryId || v.safe,
            v.paymentMethod
          );
          const isBank = treasuryAcc.code === '1102' || treasuryAcc.code === '1103' || treasuryAcc.name.includes('بنك') || treasuryAcc.name.includes('مصرف');
          const partnerName = v.partnerName || 'عميل / جهة تحصيل';
          const vNo = v.voucherNumber || v.id;
          const partnerId = v.partnerId || v.customerId || '';
          const isVendor = v.partnerType === 'VENDOR';
          const normPartnerId = partnerId ? normalizeEntityId(isVendor ? 'VENDOR' : 'CUSTOMER', partnerId) : undefined;

          const vCreatedAt = v.createdAt || v.created_at || (v.date ? `${v.date}T00:00:00.000Z` : undefined);

          // Debit Cash or Bank
          pushRow({
            id: `rec-cash-${v.id}`,
            date: v.date,
            createdAt: vCreatedAt,
            documentNumber: vNo,
            documentType: 'سند قبض خارجي',
            documentTypeBadge: isBank ? 'قبض بنكي' : 'قبض نقدي',
            sourceModule: 'سندات القبض الخارجية',
            sourceView: 'externalReceipt',
            entityId: treasuryAcc.id,
            entityName: `${treasuryAcc.name} (${treasuryAcc.code})`,
            entityCategory: isBank ? 'BANK' : 'SAFE',
            entityCategoryLabel: isBank ? 'بنك / مصرف' : 'خزينة / نقدية',
            description: `سند قبض رقم ${vNo} من: ${partnerName} في ${treasuryAcc.name} - ${v.description || ''}`,
            reference: partnerName,
            safeOrBankName: treasuryAcc.name,
            debit: amt,
            credit: 0
          });

          // Credit Partner (Customer or Vendor)
          pushRow({
            id: `rec-partner-${v.id}`,
            date: v.date,
            createdAt: vCreatedAt,
            documentNumber: vNo,
            documentType: 'سند قبض (تسوية ذمة)',
            documentTypeBadge: isVendor ? 'سداد مورد' : 'سداد عميل',
            sourceModule: 'سندات القبض الخارجية',
            sourceView: 'externalReceipt',
            entityId: normPartnerId,
            entityName: `${isVendor ? 'المورد' : 'العميل'}: ${partnerName}`,
            entityCategory: isVendor ? 'VENDOR' : 'CUSTOMER',
            entityCategoryLabel: isVendor ? 'مورد' : 'عميل',
            description: `تسوية وسداد بسند قبض رقم ${vNo} من ${partnerName}`,
            reference: partnerName,
            debit: 0,
            credit: amt
          });
        }
      });
    }
  } catch (e) {
    console.error("Receipt vouchers extraction error:", e);
  }

  // 5. External Payment Vouchers
  try {
    const vouchers = loadPaymentVouchers();
    if (Array.isArray(vouchers)) {
      vouchers.forEach((rawV: any) => {
        const v = rawV;
        const vStatus = (v.status || 'POSTED').toUpperCase();
        if ((vStatus === 'POSTED' || vStatus === 'APPROVED' || !v.status) && isBeforeEndDate(v.date)) {
          const amt = Number(v.amount) || 0;
          const treasuryAcc = resolveCashOrBankAccount(
            accounts,
            v.accountId || v.treasuryId || v.safe,
            v.paymentMethod
          );
          const isBank = treasuryAcc.code === '1102' || treasuryAcc.code === '1103' || treasuryAcc.name.includes('بنك') || treasuryAcc.name.includes('مصرف');
          const partnerName = v.partnerName || 'مورد / جهة صرف';
          const vNo = v.voucherNumber || v.id;
          const partnerId = v.partnerId || v.vendorId || '';
          const isCustomer = v.partnerType === 'CUSTOMER';
          const normPartnerId = partnerId ? normalizeEntityId(isCustomer ? 'CUSTOMER' : 'VENDOR', partnerId) : undefined;
          const vCreatedAt = v.createdAt || v.created_at || (v.date ? `${v.date}T00:00:00.000Z` : undefined);

          // Debit Partner or Expense
          pushRow({
            id: `pay-partner-${v.id}`,
            date: v.date,
            createdAt: vCreatedAt,
            documentNumber: vNo,
            documentType: 'سند صرف خارجي',
            documentTypeBadge: isCustomer ? 'صرف لعميل' : 'صرف لمورد',
            sourceModule: 'سندات الصرف الخارجية',
            sourceView: 'externalPayment',
            entityId: normPartnerId,
            entityName: `${isCustomer ? 'العميل' : 'المورد'}: ${partnerName}`,
            entityCategory: isCustomer ? 'CUSTOMER' : 'VENDOR',
            entityCategoryLabel: isCustomer ? 'عميل' : 'مورد',
            description: `سند صرف للمستفيد: ${partnerName} بموجب سند رقم ${vNo} - ${v.description || ''}`,
            reference: partnerName,
            debit: amt,
            credit: 0
          });

          // Credit Cash or Bank
          pushRow({
            id: `pay-cash-${v.id}`,
            date: v.date,
            createdAt: vCreatedAt,
            documentNumber: vNo,
            documentType: 'سند صرف (خروج سيولة)',
            documentTypeBadge: isBank ? 'صرف بنكي' : 'صرف نقدي',
            sourceModule: 'سندات الصرف الخارجية',
            sourceView: 'externalPayment',
            entityId: treasuryAcc.id,
            entityName: `${treasuryAcc.name} (${treasuryAcc.code})`,
            entityCategory: isBank ? 'BANK' : 'SAFE',
            entityCategoryLabel: isBank ? 'بنك / مصرف' : 'خزينة / نقدية',
            description: `خروج مبالغ بسند صرف ${vNo} لصالح: ${partnerName} من ${treasuryAcc.name}`,
            reference: partnerName,
            safeOrBankName: treasuryAcc.name,
            debit: 0,
            credit: amt
          });
        }
      });
    }
  } catch (e) {
    console.error("Payment vouchers extraction error:", e);
  }

  // 6. Internal Receipts & Payments
  try {
    const intRecRaw = localStorage.getItem(DB_INTERNAL_RECEIPT_VOUCHERS_KEY);
    if (intRecRaw) {
      const recList = JSON.parse(intRecRaw);
      if (Array.isArray(recList)) {
        recList.forEach(v => {
          if (v.status === 'POSTED' && isBeforeEndDate(v.date)) {
            const amt = Number(v.amount) || 0;
            const vNo = v.voucherNumber || v.id;
            const recFrom = v.receivedFrom || 'المسؤول';

            const treasuryAcc = resolveCashOrBankAccount(
              accounts,
              v.treasuryId || v.safe || v.accountId,
              v.paymentMethod
            );
            const isBank = treasuryAcc.code === '1102' || treasuryAcc.code === '1103' || treasuryAcc.name.includes('بنك') || treasuryAcc.name.includes('مصرف');

            const explicitCreditAcc = v.sourceAccountId
              ? accounts.find(a => a.id === v.sourceAccountId || a.code === v.sourceAccountId)
              : undefined;
            const creditEntityId = explicitCreditAcc ? explicitCreditAcc.id : 'acc-4201';
            const creditEntityName = explicitCreditAcc
              ? `${explicitCreditAcc.name} (${explicitCreditAcc.code})`
              : `تسوية وتوريد: ${recFrom}`;

            // Debit Cash or Bank
            pushRow({
              id: `int-rec-dst-${v.id}`,
              date: v.date,
              documentNumber: vNo,
              documentType: 'سند قبض داخلي',
              documentTypeBadge: 'قبض داخلي',
              sourceModule: 'سندات القبض الداخلية',
              sourceView: 'internalReceipt',
              entityId: treasuryAcc.id,
              entityName: `${treasuryAcc.name} (${treasuryAcc.code})`,
              entityCategory: isBank ? 'BANK' : 'SAFE',
              entityCategoryLabel: isBank ? 'بنك / مصرف' : 'خزينة / نقدية',
              description: `سند قبض وتوريد داخلي رقم ${vNo} من: ${recFrom} في ${treasuryAcc.name} - ${v.description || ''}`,
              reference: recFrom,
              safeOrBankName: treasuryAcc.name,
              technicianOrEmployee: recFrom,
              debit: amt,
              credit: 0
            });

            // Credit Source / Revenue / Employee Advance Settlement
            pushRow({
              id: `int-rec-src-${v.id}`,
              date: v.date,
              documentNumber: vNo,
              documentType: 'سند قبض داخلي (إيراد/تسوية عهدة)',
              documentTypeBadge: 'تسوية داخلية',
              sourceModule: 'سندات القبض الداخلية',
              sourceView: 'internalReceipt',
              entityId: creditEntityId,
              entityName: creditEntityName,
              entityCategory: 'EMPLOYEE',
              entityCategoryLabel: 'موظف / عهدة',
              description: `تسوية عهدة أو إيراد داخلي بسند رقم ${vNo} (${recFrom})`,
              reference: recFrom,
              technicianOrEmployee: recFrom,
              debit: 0,
              credit: amt
            });
          }
        });
      }
    }

    const intPayRaw = localStorage.getItem(DB_INTERNAL_PAYMENT_VOUCHERS_KEY);
    if (intPayRaw) {
      const vList = JSON.parse(intPayRaw);
      if (Array.isArray(vList)) {
        vList.forEach(v => {
          if (v.status === 'POSTED' && isBeforeEndDate(v.date)) {
            const amt = Number(v.amount) || 0;
            const vNo = v.voucherNumber || v.id;
            const paidTo = v.paidTo || v.recipientName || 'المستفيد';

            const treasuryAcc = resolveCashOrBankAccount(
              accounts,
              v.treasuryId || v.safe || v.sourceAccountId,
              v.paymentMethod
            );
            const isBank = treasuryAcc.code === '1102' || treasuryAcc.code === '1103' || treasuryAcc.name.includes('بنك') || treasuryAcc.name.includes('مصرف');

            // Determine expense/debit account
            const explicitDebitAcc = (v.targetAccountId || v.accountId)
              ? accounts.find(a => a.id === (v.targetAccountId || v.accountId) || a.code === (v.targetAccountId || v.accountId))
              : undefined;

            let expEntityId = explicitDebitAcc?.id || 'acc-5104';
            let expName = explicitDebitAcc ? `${explicitDebitAcc.name} (${explicitDebitAcc.code})` : 'مصروفات عمومية وإدارية (5104)';
            let catL = 'مصروف عمومي';
            if (!explicitDebitAcc) {
              if (v.expenseType === 'advance_salary' || v.expenseType === 'salary' || v.category === 'رواتب وأجور' || v.category === 'سلف موظفين') {
                expName = 'مصروفات الرواتب والأجور وسلف الموظفين (5102)';
                expEntityId = 'acc-5102';
                catL = 'رواتب وسلف';
              } else if (v.expenseType === 'rent' || v.category === 'إيجارات') {
                expName = 'مصروف إيجار المقر والفروع (5103)';
                expEntityId = 'acc-5103';
                catL = 'إيجار';
              } else if (v.expenseType === 'utility' || v.expenseType === 'electricity' || v.category === 'كهرباء ومياه ومرافق') {
                expName = 'مصروفات الكهرباء والمياه والاتصالات (5105)';
                expEntityId = 'acc-5105';
                catL = 'خدمات ومرافق';
              } else if (v.expenseType === 'marketing' || v.category === 'دعاية وإعلان') {
                expName = 'مصروفات الدعاية والتسويق (5106)';
                expEntityId = 'acc-5106';
                catL = 'تسويق وإعلان';
              }
            }

            // Debit Expense / Target Account
            pushRow({
              id: `int-pay-exp-${v.id}`,
              date: v.date,
              documentNumber: vNo,
              documentType: 'سند صرف داخلي (مصروف)',
              documentTypeBadge: 'مصروفات داخلية',
              sourceModule: 'سندات الصرف الداخلية',
              sourceView: 'internalPayment',
              entityId: expEntityId,
              entityName: expName,
              entityCategory: 'EXPENSE',
              entityCategoryLabel: `مصروف (${catL})`,
              description: `صرف داخلي بموجب سند ${vNo} لصالح: ${paidTo} - ${v.description || ''}`,
              reference: paidTo,
              technicianOrEmployee: paidTo,
              debit: amt,
              credit: 0
            });

            // Credit Cash or Bank
            pushRow({
              id: `int-pay-src-${v.id}`,
              date: v.date,
              documentNumber: vNo,
              documentType: 'سند صرف داخلي (خزينة/بنك)',
              documentTypeBadge: isBank ? 'صرف بنكي' : 'صرف نقدي',
              sourceModule: 'سندات الصرف الداخلية',
              sourceView: 'internalPayment',
              entityId: treasuryAcc.id,
              entityName: `${treasuryAcc.name} (${treasuryAcc.code})`,
              entityCategory: isBank ? 'BANK' : 'SAFE',
              entityCategoryLabel: isBank ? 'بنك / مصرف' : 'خزينة / نقدية',
              description: `صرف داخلي للمستفيد: ${paidTo} بسند ${vNo} من ${treasuryAcc.name}`,
              reference: paidTo,
              safeOrBankName: treasuryAcc.name,
              debit: 0,
              credit: amt
            });
          }
        });
      }
    }
  } catch (e) {
    console.error("Internal vouchers extraction error:", e);
  }

  // 7. Inventory Stock Audits
  try {
    const auditRaw = localStorage.getItem(STORAGE_KEY_INVENTORY_AUDITS);
    if (auditRaw) {
      const audits = JSON.parse(auditRaw);
      if (Array.isArray(audits)) {
        audits.forEach(audit => {
          if (audit.status === 'APPROVED' && isBeforeEndDate(audit.auditDate)) {
            audit.items?.forEach((it: any, itIdx: number) => {
              const val = Number(it.varianceValue) || 0;
              if (val > 0) {
                // Surplus: Debit Inventory, Credit Surplus Gain (4202)
                pushRow({
                  id: `audit-gain-inv-${audit.id}-${itIdx}`,
                  date: audit.auditDate,
                  documentNumber: audit.auditNumber || audit.id,
                  documentType: 'تسوية زيادة جرد مخزني',
                  documentTypeBadge: 'فروقات جرد (+)',
                  sourceModule: 'الجرد المخزني',
                  sourceView: 'inventoryCount',
                  entityId: 'acc-1301',
                  entityName: `المخزون السلعي (مستودع: ${audit.warehouseName || 'الرئيسي'})`,
                  entityCategory: 'INVENTORY',
                  entityCategoryLabel: 'مخزون ومستودعات',
                  description: `تسوية زيادة جرد للصنف ${it.itemName || ''} بمقدار ${it.varianceQty || 0} وحدة`,
                  reference: audit.warehouseName,
                  debit: val,
                  credit: 0
                });
                pushRow({
                  id: `audit-gain-rev-${audit.id}-${itIdx}`,
                  date: audit.auditDate,
                  documentNumber: audit.auditNumber || audit.id,
                  documentType: 'أرباح تسوية زيادة مخزون',
                  documentTypeBadge: 'أرباح جرد',
                  sourceModule: 'الجرد المخزني',
                  sourceView: 'inventoryCount',
                  entityId: 'acc-4202',
                  entityName: 'أرباح وفروقات تسوية زيادة المخزون (4202)',
                  entityCategory: 'REVENUE',
                  entityCategoryLabel: 'إيرادات وأرباح',
                  description: `أرباح تسوية زيادة جرد الصنف ${it.itemName || ''}`,
                  reference: audit.warehouseName,
                  debit: 0,
                  credit: val
                });
              } else if (val < 0) {
                // Deficit: Debit Deficit Expense (5107), Credit Inventory
                const absVal = Math.abs(val);
                pushRow({
                  id: `audit-loss-exp-${audit.id}-${itIdx}`,
                  date: audit.auditDate,
                  documentNumber: audit.auditNumber || audit.id,
                  documentType: 'تسوية عجز جرد مخزني',
                  documentTypeBadge: 'عجز جرد (-)',
                  sourceModule: 'الجرد المخزني',
                  sourceView: 'inventoryCount',
                  entityId: 'acc-5107',
                  entityName: 'مصروفات وخسائر عجز وتلف المخزون (5107)',
                  entityCategory: 'EXPENSE',
                  entityCategoryLabel: 'مصروف وخسائر',
                  description: `عجز وتلف جرد للصنف ${it.itemName || ''} بمقدار ${Math.abs(it.varianceQty || 0)} وحدة`,
                  reference: audit.warehouseName,
                  debit: absVal,
                  credit: 0
                });
                pushRow({
                  id: `audit-loss-inv-${audit.id}-${itIdx}`,
                  date: audit.auditDate,
                  documentNumber: audit.auditNumber || audit.id,
                  documentType: 'تخفيض مخزون (عجز)',
                  documentTypeBadge: 'تخفيض مخزون',
                  sourceModule: 'الجرد المخزني',
                  sourceView: 'inventoryCount',
                  entityId: 'acc-1301',
                  entityName: `المخزون السلعي (مستودع: ${audit.warehouseName || 'الرئيسي'})`,
                  entityCategory: 'INVENTORY',
                  entityCategoryLabel: 'مخزون ومستودعات',
                  description: `تخفيض رصيد المخزون لعجز جرد الصنف ${it.itemName || ''}`,
                  reference: audit.warehouseName,
                  debit: 0,
                  credit: absVal
                });
              }
            });
          }
        });
      }
    }
  } catch (e) {
    console.error("Audit extraction error:", e);
  }

  // 8. Bank Checks & Promissory Notes
  try {
    const checksRaw = localStorage.getItem('alpha_bank_checks_v1');
    if (checksRaw) {
      const checks = JSON.parse(checksRaw);
      if (Array.isArray(checks)) {
        checks.forEach(chk => {
          if ((chk.status === 'CLEARED' || chk.status === 'DEPOSITED' || chk.status === 'POSTED') && isBeforeEndDate(chk.dueDate || chk.date)) {
            const amt = Number(chk.amount) || 0;
            const isReceived = chk.type === 'RECEIPT' || chk.checkType === 'INCOMING';
            const chkNo = chk.checkNumber || chk.id;
            const party = chk.partnerName || chk.issuer || 'الطرف الآخر';

            if (isReceived) {
              // Received Check: Debit Bank / Checks under collection, Credit Partner
              pushRow({
                id: `chk-rec-${chk.id}`,
                date: chk.clearingDate || chk.dueDate || chk.date,
                documentNumber: chkNo,
                documentType: 'شيك مقبوض ومحصل',
                documentTypeBadge: 'شيك مقبوض',
                sourceModule: 'الشيكات البنكية',
                sourceView: 'externalReceipt',
                entityId: 'acc-1102',
                entityName: 'حساب البنك / شيكات برسم التحصيل (1102)',
                entityCategory: 'BANK',
                entityCategoryLabel: 'بنك / شيكات',
                description: `تحصيل شيك مقبوض رقم ${chkNo} مسحوب على بنك ${chk.bankName || 'الأهلي'} من ${party}`,
                reference: party,
                debit: amt,
                credit: 0
              });
              pushRow({
                id: `chk-rec-p-${chk.id}`,
                date: chk.clearingDate || chk.dueDate || chk.date,
                documentNumber: chkNo,
                documentType: 'شيك مقبوض (تسوية عميل)',
                documentTypeBadge: 'تسوية عميل',
                sourceModule: 'الشيكات البنكية',
                sourceView: 'customerStatement',
                entityId: chk.partnerId ? `cust-${chk.partnerId}` : undefined,
                entityName: `العميل: ${party}`,
                entityCategory: 'CUSTOMER',
                entityCategoryLabel: 'عميل',
                description: `سداد عميل بشيك رقم ${chkNo}`,
                reference: party,
                debit: 0,
                credit: amt
              });
            } else {
              // Issued Check: Debit Vendor/Expense, Credit Bank
              pushRow({
                id: `chk-pay-p-${chk.id}`,
                date: chk.clearingDate || chk.dueDate || chk.date,
                documentNumber: chkNo,
                documentType: 'شيك صادر ومسدد',
                documentTypeBadge: 'شيك صادر',
                sourceModule: 'الشيكات البنكية',
                sourceView: 'partnerStatement',
                entityId: chk.partnerId ? `vend-${chk.partnerId}` : undefined,
                entityName: `المورد / المستفيد: ${party}`,
                entityCategory: 'VENDOR',
                entityCategoryLabel: 'مورد',
                description: `سداد للمستفيد ${party} بشيك صادر رقم ${chkNo}`,
                reference: party,
                debit: amt,
                credit: 0
              });
              pushRow({
                id: `chk-pay-b-${chk.id}`,
                date: chk.clearingDate || chk.dueDate || chk.date,
                documentNumber: chkNo,
                documentType: 'شيك صادر (خصم بنكي)',
                documentTypeBadge: 'خصم بنكي',
                sourceModule: 'الشيكات البنكية',
                sourceView: 'externalPayment',
                entityId: 'acc-1102',
                entityName: 'حساب البنك الأهلي التجاري (1102)',
                entityCategory: 'BANK',
                entityCategoryLabel: 'بنك / مصرف',
                description: `صرف وخصم شيك صادر رقم ${chkNo} لصالح ${party}`,
                reference: party,
                debit: 0,
                credit: amt
              });
            }
          }
        });
      }
    }
  } catch (e) {
    console.error("Checks extraction error:", e);
  }

  // 9. Payroll & Salary Sheets
  try {
    const payrollRaw = localStorage.getItem('alpha_payroll_runs_v1') || localStorage.getItem('alpha_payroll_entries_v1');
    if (payrollRaw) {
      const runs = JSON.parse(payrollRaw);
      if (Array.isArray(runs)) {
        runs.forEach(run => {
          if ((run.status === 'PAID' || run.status === 'POSTED' || run.status === 'APPROVED') && isBeforeEndDate(run.date || run.periodEnd)) {
            const netPaid = Number(run.totalNet || run.netAmount || run.totalAmount) || 0;
            const runNo = run.runNumber || run.id;
            const periodLabel = run.periodName || run.month || 'مسير رواتب';

            pushRow({
              id: `payroll-exp-${run.id}`,
              date: run.date || run.periodEnd || new Date().toISOString().split('T')[0],
              documentNumber: runNo,
              documentType: 'مسير رواتب وأجور',
              documentTypeBadge: 'رواتب موظفين',
              sourceModule: 'شؤون الموظفين والرواتب',
              sourceView: 'payroll',
              entityId: 'acc-5102',
              entityName: 'مصروفات الرواتب والأجور وسلف الموظفين (5102)',
              entityCategory: 'EXPENSE',
              entityCategoryLabel: 'رواتب وأجور',
              description: `صرف واستحقاق مسير رواتب ${periodLabel} لعدد (${run.employeesCount || run.items?.length || 1}) موظف`,
              reference: periodLabel,
              debit: netPaid,
              credit: 0
            });
            pushRow({
              id: `payroll-cash-${run.id}`,
              date: run.date || run.periodEnd || new Date().toISOString().split('T')[0],
              documentNumber: runNo,
              documentType: 'صرف مسير رواتب (سيولة)',
              documentTypeBadge: run.paymentMethod === 'BANK' ? 'تحويل بنكي' : 'نقدية',
              sourceModule: 'شؤون الموظفين والرواتب',
              sourceView: 'payroll',
              entityId: run.paymentMethod === 'BANK' ? 'acc-1102' : 'acc-1101',
              entityName: run.paymentMethod === 'BANK' ? 'حساب البنك (تحويل رواتب - 1102)' : 'النقدية بالصندوق (1101)',
              entityCategory: run.paymentMethod === 'BANK' ? 'BANK' : 'SAFE',
              entityCategoryLabel: run.paymentMethod === 'BANK' ? 'بنك' : 'خزينة',
              description: `تحويل وصرف رواتب ${periodLabel} بموجب مسير ${runNo}`,
              reference: periodLabel,
              debit: 0,
              credit: netPaid
            });
          }
        });
      }
    }
  } catch (e) {
    console.error("Payroll extraction error:", e);
  }

  // Filter the rows according to parameters
  let filtered = rawRows;

  // 1. Entity / Account Filter
  if (selectedEntityId && selectedEntityId !== 'ALL') {
    filtered = filtered.filter(row => {
      // When a specific target is resolved
      if (entityTarget) {
        const targetName = entityTarget.name ? entityTarget.name.toLowerCase().trim() : '';

        // CUSTOMER filter: ONLY rows representing the customer subledger/AR
        if (entityTarget.category === 'CUSTOMER') {
          if (row.entityCategory !== 'CUSTOMER') return false;
          if (row.entityId === entityTarget.id || row.entityId === cleanId || row.entityId === `cust-${cleanId}`) return true;
          if (entityTarget.code && (row.entityId === entityTarget.code || row.entityId === `cust-${entityTarget.code}`)) return true;
          if (targetName && row.entityName) {
            const rowEnt = row.entityName.toLowerCase().trim();
            if (rowEnt === targetName || rowEnt.includes(targetName) || targetName.includes(rowEnt)) return true;
          }
          if (entityTarget.phone && row.reference && row.reference.includes(entityTarget.phone)) return true;
          return false;
        }

        // VENDOR filter: ONLY rows representing the vendor subledger/AP
        if (entityTarget.category === 'VENDOR') {
          if (row.entityCategory !== 'VENDOR') return false;
          if (row.entityId === entityTarget.id || row.entityId === cleanId || row.entityId === `vend-${cleanId}`) return true;
          if (entityTarget.code && (row.entityId === entityTarget.code || row.entityId === `vend-${entityTarget.code}`)) return true;
          if (targetName && row.entityName) {
            const rowEnt = row.entityName.toLowerCase().trim();
            if (rowEnt === targetName || rowEnt.includes(targetName) || targetName.includes(rowEnt)) return true;
          }
          if (entityTarget.phone && row.reference && row.reference.includes(entityTarget.phone)) return true;
          return false;
        }

        // SAFE filter: ONLY Cash Safe movements
        if (entityTarget.code === '1101' || entityTarget.category === 'SAFE') {
          return row.entityCategory === 'SAFE' || 
                 row.safeOrBankName === 'الصندوق' || 
                 row.safeOrBankName === 'الصندوق الرئيسي' || 
                 row.entityId === 'acc-1101' || 
                 row.entityId === '1101';
        }

        // BANK filter: ONLY Bank movements
        if (entityTarget.code === '1102' || entityTarget.code === '1103' || entityTarget.code === '1104' || entityTarget.category === 'BANK') {
          return row.entityCategory === 'BANK' || 
                 (row.safeOrBankName && row.safeOrBankName.includes('بنك')) || 
                 row.entityId === 'acc-1102' || 
                 row.entityId === '1102' ||
                 row.entityId === 'acc-1103' || 
                 row.entityId === '1103';
        }

        // GENERAL CONTROL ACCOUNTS from Chart of Accounts
        if (entityTarget.code === '1201') return row.entityCategory === 'CUSTOMER' || row.entityId === 'acc-1201' || row.entityId === '1201';
        if (entityTarget.code === '2101') return row.entityCategory === 'VENDOR' || row.entityId === 'acc-2101' || row.entityId === '2101';

        // EXPENSE / REVENUE / INVENTORY / ASSET / EQUITY accounts
        if (entityTarget.category === 'EXPENSE') {
          return row.entityCategory === 'EXPENSE' || row.entityId === entityTarget.id || (entityTarget.code && (row.entityId === entityTarget.code || row.entityId === `acc-${entityTarget.code}`));
        }
        if (entityTarget.category === 'REVENUE') {
          return row.entityCategory === 'REVENUE' || row.entityId === entityTarget.id || (entityTarget.code && (row.entityId === entityTarget.code || row.entityId === `acc-${entityTarget.code}`));
        }
        if (entityTarget.category === 'INVENTORY') {
          return row.entityCategory === 'INVENTORY' || row.entityId === entityTarget.id || (entityTarget.code && (row.entityId === entityTarget.code || row.entityId === `acc-${entityTarget.code}`));
        }
        if (entityTarget.category === 'ASSET') {
          return row.entityCategory === 'ASSET' || row.entityId === entityTarget.id || (entityTarget.code && (row.entityId === entityTarget.code || row.entityId === `acc-${entityTarget.code}`));
        }
        if (entityTarget.category === 'EQUITY') {
          return row.entityCategory === 'EQUITY' || row.entityId === entityTarget.id || (entityTarget.code && (row.entityId === entityTarget.code || row.entityId === `acc-${entityTarget.code}`));
        }

        // TECHNICIAN / EMPLOYEE
        if (entityTarget.category === 'TECHNICIAN' || entityTarget.category === 'EMPLOYEE') {
          if (row.technicianOrEmployee && targetName) {
            const tech = row.technicianOrEmployee.toLowerCase().trim();
            if (tech === targetName || tech.includes(targetName) || targetName.includes(tech)) return true;
          }
          if (row.entityCategory === entityTarget.category) {
            if (row.entityId === entityTarget.id || row.entityId === cleanId) return true;
            if (targetName && row.entityName && row.entityName.toLowerCase().includes(targetName)) return true;
          }
          return false;
        }

        // Default direct ID / Code match for general chart of account items
        if (row.entityId === entityTarget.id) return true;
        if (entityTarget.code && (row.entityId === entityTarget.code || row.entityId === `acc-${entityTarget.code}`)) return true;
        if (targetName && row.entityName && row.entityName.toLowerCase().trim() === targetName) return true;
      }

      // Fallback direct entity ID match
      if (rawId.startsWith('cust-')) {
        return row.entityCategory === 'CUSTOMER' && (row.entityId === rawId || row.entityId === cleanId || row.entityId === `cust-${cleanId}`);
      }
      if (rawId.startsWith('vend-')) {
        return row.entityCategory === 'VENDOR' && (row.entityId === rawId || row.entityId === cleanId || row.entityId === `vend-${cleanId}`);
      }
      if (row.entityId === rawId || row.entityId === cleanId) return true;
      if (row.entityId === `cust-${cleanId}` || row.entityId === `vend-${cleanId}` || row.entityId === `acc-${cleanId}` || row.entityId === `emp-${cleanId}` || row.entityId === `tech-${cleanId}`) return true;

      return false;
    });
  }

  // 2. Category Filter (applies when viewing all entities or filtering generally)
  if (category && category !== 'ALL' && (!selectedEntityId || selectedEntityId === 'ALL')) {
    filtered = filtered.filter(row => {
      if (row.entityCategory === category) return true;
      if (category === 'SAFE' && (row.safeOrBankName === 'الصندوق' || row.safeOrBankName === 'الصندوق الرئيسي')) return true;
      if (category === 'BANK' && row.safeOrBankName === 'البنك') return true;
      if (category === 'EMPLOYEE' && row.technicianOrEmployee) return true;
      if (category === 'TECHNICIAN' && row.technicianOrEmployee) return true;
      return false;
    });
  }

  // 3. Search query across EVERYTHING (عملاء وموردين وخزن ومصروفات وبنوك وفنيين وموظفين وممتلكات ومستندات)
  if (searchTerm && searchTerm.trim()) {
    const q = searchTerm.trim().toLowerCase();
    filtered = filtered.filter(row => {
      return (
        (row.documentNumber && row.documentNumber.toLowerCase().includes(q)) ||
        (row.documentType && row.documentType.toLowerCase().includes(q)) ||
        (row.entityName && row.entityName.toLowerCase().includes(q)) ||
        (row.description && row.description.toLowerCase().includes(q)) ||
        (row.reference && row.reference.toLowerCase().includes(q)) ||
        (row.technicianOrEmployee && row.technicianOrEmployee.toLowerCase().includes(q)) ||
        (row.safeOrBankName && row.safeOrBankName.toLowerCase().includes(q)) ||
        (row.entityCategoryLabel && row.entityCategoryLabel.toLowerCase().includes(q)) ||
        (row.sourceModule && row.sourceModule.toLowerCase().includes(q))
      );
    });
  }

  // Separate prior movements (Opening Balance) vs movements within the selected period
  let openingDebit = 0;
  let openingCredit = 0;
  const periodRows: AccountMovementRow[] = [];

  filtered.forEach(row => {
    if (startDate && row.date < startDate) {
      openingDebit += row.debit;
      openingCredit += row.credit;
    } else {
      periodRows.push(row);
    }
  });

  const sortOrder = filter.sortOrder || 'ASC';

  // Sort period rows chronologically by exact date and time of movement entry (تاريخ ووقت إدخال الحركة من الأعلى للأسفل: الأسبق فالسابق فالتالي)
  periodRows.sort((a, b) => {
    // 1. Opening balance always comes first in ascending sequence
    const aIsOp = a.id.startsWith('op-') || a.documentTypeBadge === 'رصيد افتتاحي';
    const bIsOp = b.id.startsWith('op-') || b.documentTypeBadge === 'رصيد افتتاحي';
    if (aIsOp && !bIsOp) return -1;
    if (!aIsOp && bIsOp) return 1;

    // 2. Compare document dates (YYYY-MM-DD) first so earlier dates appear first
    const aDate = (a.date || '').substring(0, 10);
    const bDate = (b.date || '').substring(0, 10);
    if (aDate && bDate && aDate !== bDate) {
      return aDate.localeCompare(bDate);
    }

    // 3. Exact timestamp of entry (تاريخ ووقت الإدخال الفعلي بالمللي ثانية)
    const timeA = a.entryTimestamp ?? 0;
    const timeB = b.entryTimestamp ?? 0;
    if (timeA !== timeB) {
      return timeA - timeB;
    }

    // 4. For movements with identical timestamp on the same invoice document:
    // Invoice (debit) comes first, payment/settlement (credit) comes next
    if (a.documentNumber && b.documentNumber && a.documentNumber === b.documentNumber) {
      if (a.entityCategory === 'CUSTOMER' || b.entityCategory === 'CUSTOMER') {
        if (a.debit > 0 && b.credit > 0) return -1;
        if (a.credit > 0 && b.debit > 0) return 1;
      }
      if (a.entityCategory === 'VENDOR' || b.entityCategory === 'VENDOR') {
        if (a.credit > 0 && b.debit > 0) return -1;
        if (a.debit > 0 && b.credit > 0) return 1;
      }
    }

    // 5. Stable entry sequence fallback
    return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
  });

  const openingNet = Math.round((openingDebit - openingCredit) * 100) / 100;
  const openingBalanceType: 'DEBIT' | 'CREDIT' | 'ZERO' = openingNet > 0 ? 'DEBIT' : openingNet < 0 ? 'CREDIT' : 'ZERO';

  const finalMovements: AccountMovementRow[] = [];

  // If there is an opening balance before startDate, prepend the opening balance row
  if (startDate && openingNet !== 0) {
    const isDebit = openingNet > 0;
    const absOpening = Math.abs(openingNet);
    finalMovements.push({
      id: 'row-opening-balance',
      date: startDate,
      createdAt: `${startDate}T00:00:00.000Z`,
      entryTimestamp: new Date(`${startDate}T00:00:00.000Z`).getTime(),
      formattedTime: '00:00:00',
      documentNumber: 'OPN-BAL',
      documentType: 'رصيد سابق منقول',
      documentTypeBadge: 'رصيد سابق',
      sourceModule: 'أرصدة ما قبل الفترة',
      entityName: entityTarget ? entityTarget.name : 'رصيد سابق منقول',
      entityCategory: entityTarget ? entityTarget.category : 'GENERAL',
      entityCategoryLabel: 'رصيد سابق',
      description: `رصيد سابق منقول للحساب حتى بداية الفترة (${startDate})`,
      debit: isDebit ? absOpening : 0,
      credit: !isDebit ? absOpening : 0,
      runningBalance: absOpening,
      balanceType: isDebit ? 'DEBIT' : 'CREDIT'
    });
  }

  // Running balance calculation in chronological order
  let runningBalance = openingNet;
  let periodDebit = 0;
  let periodCredit = 0;

  periodRows.forEach(row => {
    periodDebit += row.debit;
    periodCredit += row.credit;
    runningBalance += (row.debit - row.credit);
    row.runningBalance = Math.abs(Math.round(runningBalance * 100) / 100);
    row.balanceType = runningBalance > 0 ? 'DEBIT' : runningBalance < 0 ? 'CREDIT' : 'ZERO';
    finalMovements.push(row);
  });

  const totalDebit = Math.round(finalMovements.reduce((sum, r) => sum + r.debit, 0) * 100) / 100;
  const totalCredit = Math.round(finalMovements.reduce((sum, r) => sum + r.credit, 0) * 100) / 100;
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100;
  let summaryBalanceType: 'DEBIT' | 'CREDIT' | 'ZERO' = 'ZERO';
  if (difference > 0) summaryBalanceType = 'DEBIT';
  else if (difference < 0) summaryBalanceType = 'CREDIT';

  // Apply requested sort order from top to bottom
  const returnedMovements = sortOrder === 'DESC' ? [...finalMovements].reverse() : finalMovements;

  return {
    movements: returnedMovements,
    summary: {
      openingBalance: Math.abs(openingNet),
      openingBalanceType,
      periodDebit: Math.round(periodDebit * 100) / 100,
      periodCredit: Math.round(periodCredit * 100) / 100,
      totalDebit,
      totalCredit,
      difference,
      balanceType: summaryBalanceType,
      count: periodRows.length
    }
  };
}

/**
 * Universal Navigation Helper to jump directly to Account Movements Screen from ANY screen in the app
 * @param targetIdOrCode - Entity ID (customer, vendor, safe, bank, employee, etc.) or Account Code ('1101', '1201', etc.)
 * @param onNavigate - Optional view navigation callback from parent
 */
export function navigateToAccountMovements(targetIdOrCode?: string, onNavigate?: (view: string) => void) {
  try {
    if (targetIdOrCode) {
      sessionStorage.setItem('alpha_target_account_code', targetIdOrCode);
      sessionStorage.setItem('alpha_target_entity_id', targetIdOrCode);
    }
    window.dispatchEvent(new CustomEvent('alpha-account-target-changed', {
      detail: { target: targetIdOrCode }
    }));
  } catch {}

  if (onNavigate) {
    onNavigate('accountMovements');
  } else {
    window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'accountMovements' } }));
  }
}
