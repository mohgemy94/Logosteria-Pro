import * as XLSX from 'xlsx';
import { loadCustomers, loadVendors, saveCustomers, saveVendors, getPartnerAccountStatement } from './partnerLedger';
import { loadStoredItems, saveStoredItems } from './itemsStore';
import { getStoredInstallments } from '../data/mockInstallments';
import { loadBankChecks } from './checkStore';
import { calculateTrialBalance, saveJournalEntry, loadChartOfAccounts } from './trialBalanceStore';
import { getSystemSettings } from './settings';
import { saveOrShareBlob } from './fileSaver';
import { JournalEntry, JournalEntryStatus, JournalItem, Partner } from '../types/accounting';
import { BankCheck, CheckType } from '../types/check';
import { autoLockYearEnd } from './periodLock';
import { recordAuditLog } from './auditLogStore';

export interface IntegrityCheckItem {
  nameAr: string;
  subledgerTotal: number;
  glTotal: number;
  difference: number;
  isMatched: boolean;
  statusTextAr: string;
}

export interface RollForwardOpeningEntryItem {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
}

export interface CustomerAgingBucket {
  current: number;       // < 90 days (جارية)
  bucket90to180: number; // 91 - 180 days (متوسطة)
  bucket180to360: number;// 181 - 360 days (متأخرة / راكدة)
  over360: number;       // > 360 days (متعثرة)
  daysOldest: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface RollForwardCustomerItem {
  id: string;
  code: string;
  name: string;
  phone: string;
  taxNumber?: string;
  balance: number;
  balanceType: 'DEBIT' | 'CREDIT' | 'ZERO';
  aging?: CustomerAgingBucket;
  allowanceAmount?: number;
  netRealizableBalance?: number;
}

export interface RollForwardVendorItem {
  id: string;
  code: string;
  name: string;
  phone: string;
  taxNumber?: string;
  balance: number;
  balanceType: 'DEBIT' | 'CREDIT' | 'ZERO';
}

export interface RollForwardInventoryItem {
  id: string;
  code: string;
  barcode: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  costPrice: number;
  salePrice: number;
  totalValue: number;
  warehouseName?: string;
  shelfLocation?: string;
}

export interface WarehouseStockSummary {
  warehouseName: string;
  itemsCount: number;
  totalQuantity: number;
  totalValuation: number;
  percentage: number;
}

export interface BadDebtAllowanceConfig {
  enabled: boolean;
  mode: 'PERCENT' | 'MATRIX';
  flatPercentage?: number;
  matrixRates?: {
    current: number;
    bucket90to180: number;
    bucket180to360: number;
    over360: number;
  };
}

export interface BadDebtAllowanceSummary {
  isEnabled: boolean;
  mode: 'PERCENT' | 'MATRIX';
  flatPercentage: number;
  matrixRates: {
    current: number;
    bucket90to180: number;
    bucket180to360: number;
    over360: number;
  };
  totalGrossAR: number;
  totalAllowance: number;
  netRealizableAR: number;
  agingTotals: {
    current: number;
    bucket90to180: number;
    bucket180to360: number;
    over360: number;
  };
}

export interface RollForwardInstallmentItem {
  contractId: string;
  contractNumber: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  remainingAmount: number;
  pendingCount: number;
  nextDueDate: string;
  pendingItems: {
    installmentNumber: number;
    dueDate: string;
    amount: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
  }[];
}

export interface RollForwardCheckItem {
  id: string;
  checkNumber: string;
  type: CheckType;
  partnerName: string;
  bankName: string;
  amount: number;
  dueDate: string;
  status: string;
}

export interface RollForwardBundle {
  metadata: {
    system: string;
    version: string;
    exportDate: string;
    fromYear: number;
    toYear: number;
    companyName: string;
    taxNumber: string;
    currency: string;
    excludedZeroBalances: boolean;
  };
  integrityCheck: {
    customers: IntegrityCheckItem;
    vendors: IntegrityCheckItem;
    inventory: IntegrityCheckItem;
    isAllMatched: boolean;
  };
  openingEntry: {
    entryNumber: string;
    date: string;
    description: string;
    items: RollForwardOpeningEntryItem[];
    totalDebit: number;
    totalCredit: number;
    retainedEarningsAdjustment: number;
    isBalanced: boolean;
  };
  customers: RollForwardCustomerItem[];
  vendors: RollForwardVendorItem[];
  inventory: RollForwardInventoryItem[];
  warehouseBreakdown: WarehouseStockSummary[];
  badDebtAllowance: BadDebtAllowanceSummary;
  installments: RollForwardInstallmentItem[];
  checks: RollForwardCheckItem[];
  summary: {
    totalCustomersBalance: number;
    totalVendorsBalance: number;
    totalInventoryValue: number;
    totalInstallmentsRemaining: number;
    totalUnclearedChecks: number;
    activeCustomersCount: number;
    activeVendorsCount: number;
    activeItemsCount: number;
    activeInstallmentsCount: number;
    activeChecksCount: number;
  };
}

export const ROLLBACK_SNAPSHOT_KEY = 'alpha_pre_rollforward_snapshot_v1';

/**
 * 1. Computes the complete Roll-Forward bundle with integrity verification, multi-branch inventory, and IFRS 9 aging allowance
 */
export function computeRollForwardData(options?: {
  fromYear?: number;
  toYear?: number;
  excludeZeroBalances?: boolean;
  badDebtConfig?: BadDebtAllowanceConfig;
}): RollForwardBundle {
  const fromYear = options?.fromYear || new Date().getFullYear();
  const toYear = options?.toYear || fromYear + 1;
  const excludeZero = options?.excludeZeroBalances ?? true;

  const badDebtConfig: BadDebtAllowanceConfig = options?.badDebtConfig || {
    enabled: true,
    mode: 'MATRIX',
    flatPercentage: 5,
    matrixRates: {
      current: 1,       // 1% for <90 days
      bucket90to180: 10, // 10% for 91-180 days
      bucket180to360: 35,// 35% for 181-360 days
      over360: 80        // 80% for >360 days (راكدة / متعثرة)
    }
  };

  const settings = getSystemSettings();
  const currency = settings.financial?.currencySymbol || settings.financial?.currency || 'ر.س';
  const companyName = settings.company?.nameAr || settings.company?.nameEn || 'لوجوستريا للمحاسبة';
  const taxNumber = settings.company?.taxNumber || '';

  // 1. Process Customers with Aging Analysis & IFRS 9 Bad Debt Provisioning
  const rawCustomers = loadCustomers();
  const customersList: RollForwardCustomerItem[] = [];
  let totalCustomersBalance = 0;
  let totalAllowanceSum = 0;

  const agingTotals = {
    current: 0,
    bucket90to180: 0,
    bucket180to360: 0,
    over360: 0
  };

  const asOfDate = new Date(`${fromYear}-12-31T23:59:59`);

  for (const c of rawCustomers) {
    const stmt = getPartnerAccountStatement(c);
    const bal = stmt.netBalance;
    if (excludeZero && Math.abs(bal) < 0.01) continue;

    // Calculate Debt Aging Buckets
    let currentBucket = 0;
    let b90to180 = 0;
    let b180to360 = 0;
    let over360 = 0;
    let daysOldest = 0;

    if (bal > 0.01) {
      // Collect debit transactions for FIFO aging analysis
      const debitTxs = (stmt.transactions || []).filter(tx => tx.debit > 0);
      if (debitTxs.length > 0) {
        // Sort descending by date (newest first)
        const sorted = [...debitTxs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        let unallocated = bal;

        for (const tx of sorted) {
          if (unallocated <= 0.01) break;
          const alloc = Math.min(unallocated, tx.debit);
          const txDate = new Date(tx.date);
          const diffDays = Math.max(0, Math.floor((asOfDate.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24)));
          if (diffDays > daysOldest) daysOldest = diffDays;

          if (diffDays <= 90) {
            currentBucket += alloc;
          } else if (diffDays <= 180) {
            b90to180 += alloc;
          } else if (diffDays <= 360) {
            b180to360 += alloc;
          } else {
            over360 += alloc;
          }
          unallocated -= alloc;
        }

        // Remaining balance unallocated goes to oldest or current
        if (unallocated > 0.01) {
          if (daysOldest > 360) over360 += unallocated;
          else if (daysOldest > 180) b180to360 += unallocated;
          else if (daysOldest > 90) b90to180 += unallocated;
          else currentBucket += unallocated;
        }
      } else {
        // Fallback if no detailed transactions: estimate from lastTransactionDate or balance
        const lastTxDate = stmt.lastTransactionDate ? new Date(stmt.lastTransactionDate) : asOfDate;
        const diffDays = Math.max(0, Math.floor((asOfDate.getTime() - lastTxDate.getTime()) / (1000 * 60 * 60 * 24)));
        daysOldest = diffDays;
        if (diffDays <= 90) currentBucket = bal;
        else if (diffDays <= 180) b90to180 = bal;
        else if (diffDays <= 360) b180to360 = bal;
        else over360 = bal;
      }
    }

    // Determine Risk Level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (over360 > 0.01) riskLevel = 'CRITICAL';
    else if (b180to360 > 0.01) riskLevel = 'HIGH';
    else if (b90to180 > 0.01) riskLevel = 'MEDIUM';

    // Calculate Allowance for Bad Debts (IFRS 9 Expected Credit Losses)
    let customerAllowance = 0;
    if (badDebtConfig.enabled && bal > 0.01) {
      if (badDebtConfig.mode === 'PERCENT') {
        const pct = (badDebtConfig.flatPercentage ?? 5) / 100;
        customerAllowance = bal * pct;
      } else {
        const rates = badDebtConfig.matrixRates || {
          current: 1,
          bucket90to180: 10,
          bucket180to360: 35,
          over360: 80
        };
        customerAllowance = 
          (currentBucket * (rates.current / 100)) +
          (b90to180 * (rates.bucket90to180 / 100)) +
          (b180to360 * (rates.bucket180to360 / 100)) +
          (over360 * (rates.over360 / 100));
      }
      customerAllowance = Math.round(customerAllowance * 100) / 100;
      totalAllowanceSum += customerAllowance;
    }

    agingTotals.current += currentBucket;
    agingTotals.bucket90to180 += b90to180;
    agingTotals.bucket180to360 += b180to360;
    agingTotals.over360 += over360;

    customersList.push({
      id: c.id,
      code: c.code || '',
      name: c.name,
      phone: c.phone || '',
      taxNumber: c.taxNumber || '',
      balance: Math.round(bal * 100) / 100,
      balanceType: stmt.balanceType,
      aging: {
        current: Math.round(currentBucket * 100) / 100,
        bucket90to180: Math.round(b90to180 * 100) / 100,
        bucket180to360: Math.round(b180to360 * 100) / 100,
        over360: Math.round(over360 * 100) / 100,
        daysOldest,
        riskLevel
      },
      allowanceAmount: customerAllowance,
      netRealizableBalance: Math.round(Math.max(0, bal - customerAllowance) * 100) / 100
    });
    totalCustomersBalance += bal;
  }

  const badDebtAllowance: BadDebtAllowanceSummary = {
    isEnabled: badDebtConfig.enabled,
    mode: badDebtConfig.mode,
    flatPercentage: badDebtConfig.flatPercentage ?? 5,
    matrixRates: badDebtConfig.matrixRates || {
      current: 1,
      bucket90to180: 10,
      bucket180to360: 35,
      over360: 80
    },
    totalGrossAR: Math.round(totalCustomersBalance * 100) / 100,
    totalAllowance: Math.round(totalAllowanceSum * 100) / 100,
    netRealizableAR: Math.round(Math.max(0, totalCustomersBalance - totalAllowanceSum) * 100) / 100,
    agingTotals: {
      current: Math.round(agingTotals.current * 100) / 100,
      bucket90to180: Math.round(agingTotals.bucket90to180 * 100) / 100,
      bucket180to360: Math.round(agingTotals.bucket180to360 * 100) / 100,
      over360: Math.round(agingTotals.over360 * 100) / 100
    }
  };

  // 2. Process Vendors
  const rawVendors = loadVendors();
  const vendorsList: RollForwardVendorItem[] = [];
  let totalVendorsBalance = 0;

  for (const v of rawVendors) {
    const stmt = getPartnerAccountStatement(v);
    const bal = stmt.netBalance;
    if (excludeZero && Math.abs(bal) < 0.01) continue;

    vendorsList.push({
      id: v.id,
      code: v.code || '',
      name: v.name,
      phone: v.phone || '',
      taxNumber: v.taxNumber || '',
      balance: Math.round(bal * 100) / 100,
      balanceType: stmt.balanceType
    });
    totalVendorsBalance += bal;
  }

  // 3. Process Inventory Items with Multi-Branch Breakdown
  const rawItems = loadStoredItems();
  const inventoryList: RollForwardInventoryItem[] = [];
  let totalInventoryValue = 0;

  for (const it of rawItems) {
    const stock = Number(it.stock) || 0;
    const cost = Number(it.costPrice) || 0;
    const sale = Number(it.salePrice || it.retailPrice) || 0;
    const totalVal = Math.round(stock * cost * 100) / 100;

    if (excludeZero && stock <= 0 && totalVal <= 0) continue;

    inventoryList.push({
      id: it.id,
      code: it.code || '',
      barcode: it.barcode || '',
      name: it.name,
      category: it.category || 'عام',
      unit: it.unit || 'حبة',
      stock,
      costPrice: cost,
      salePrice: sale,
      totalValue: totalVal,
      warehouseName: it.warehouseName || 'المستودع الرئيسي - الرياض',
      shelfLocation: it.shelfLocation || ''
    });
    totalInventoryValue += totalVal;
  }

  // Calculate Warehouse / Branch Inventory Breakdown
  const warehouseMap = new Map<string, { itemsCount: number; totalQuantity: number; totalValuation: number }>();
  for (const item of inventoryList) {
    const wName = item.warehouseName || 'المستودع الرئيسي - الرياض';
    const existing = warehouseMap.get(wName) || { itemsCount: 0, totalQuantity: 0, totalValuation: 0 };
    existing.itemsCount += 1;
    existing.totalQuantity += item.stock;
    existing.totalValuation += item.totalValue;
    warehouseMap.set(wName, existing);
  }

  const warehouseBreakdown: WarehouseStockSummary[] = Array.from(warehouseMap.entries()).map(([warehouseName, data]) => ({
    warehouseName,
    itemsCount: data.itemsCount,
    totalQuantity: Math.round(data.totalQuantity * 100) / 100,
    totalValuation: Math.round(data.totalValuation * 100) / 100,
    percentage: totalInventoryValue > 0 ? Math.round((data.totalValuation / totalInventoryValue) * 1000) / 10 : 0
  })).sort((a, b) => b.totalValuation - a.totalValuation);

  // 4. Process Installments
  const rawContracts = getStoredInstallments();
  const installmentsList: RollForwardInstallmentItem[] = [];
  let totalInstallmentsRemaining = 0;

  for (const ct of rawContracts) {
    const pendingSchedules = (ct.schedule || []).filter(s => s.status !== 'PAID' && (s.remainingAmount > 0 || (s.totalAmount - (s.paidAmount || 0)) > 0));
    if (pendingSchedules.length === 0) continue;

    const contractRemaining = pendingSchedules.reduce((acc, curr) => acc + (curr.remainingAmount || (curr.totalAmount - (curr.paidAmount || 0))), 0);
    if (excludeZero && contractRemaining <= 0) continue;

    installmentsList.push({
      contractId: ct.id,
      contractNumber: ct.contractNumber,
      customerId: ct.customerId || '',
      customerName: ct.customerName,
      totalAmount: ct.totalFinanced || ct.cashPrice,
      remainingAmount: Math.round(contractRemaining * 100) / 100,
      pendingCount: pendingSchedules.length,
      nextDueDate: pendingSchedules[0]?.dueDate || '',
      pendingItems: pendingSchedules.map(s => ({
        installmentNumber: s.installmentNumber,
        dueDate: s.dueDate,
        amount: s.totalAmount,
        paidAmount: s.paidAmount || 0,
        remainingAmount: s.remainingAmount || (s.totalAmount - (s.paidAmount || 0)),
        status: s.status
      }))
    });
    totalInstallmentsRemaining += contractRemaining;
  }

  // 5. Process Uncleared Checks
  const rawChecks: BankCheck[] = loadBankChecks();
  const checksList: RollForwardCheckItem[] = [];
  let totalUnclearedChecks = 0;

  for (const chk of rawChecks) {
    if (chk.status === 'UNDER_COLLECTION') {
      checksList.push({
        id: chk.id,
        checkNumber: chk.checkNumber,
        type: chk.type,
        partnerName: chk.partnerName || chk.partnerId || 'غير محدد',
        bankName: chk.bankName,
        amount: chk.amount,
        dueDate: chk.dueDate,
        status: chk.status
      });
      totalUnclearedChecks += (chk.type === 'INCOMING' ? chk.amount : -chk.amount);
    }
  }

  // 6. Trial Balance / GL Integrity Verification
  const tb = calculateTrialBalance();
  const findGlBalance = (codes: string[]) => {
    let sum = 0;
    for (const code of codes) {
      const row = tb.rows.find(r => r.account.code === code);
      if (row) {
        sum += (row.endingDebit - row.endingCredit);
      }
    }
    return sum;
  };

  const arGlBalance = findGlBalance(['1201']); // ذمم العملاء
  const apGlBalance = Math.abs(findGlBalance(['2101'])); // ذمم الموردين
  const invGlBalance = findGlBalance(['1301', '1302', '1303']); // المخزون
  const cashBanksBalance = findGlBalance(['1101', '1102', '1103']); // النقدية والبنوك

  const arDiff = Math.abs(totalCustomersBalance - arGlBalance);
  const apDiff = Math.abs(totalVendorsBalance - apGlBalance);
  const invDiff = Math.abs(totalInventoryValue - invGlBalance);

  const integrityCheck = {
    customers: {
      nameAr: 'مطابقة ذمم العملاء (Sub-ledger AR vs GL 1201)',
      subledgerTotal: Math.round(totalCustomersBalance * 100) / 100,
      glTotal: Math.round(arGlBalance * 100) / 100,
      difference: Math.round(arDiff * 100) / 100,
      isMatched: arDiff < 1.0,
      statusTextAr: arDiff < 1.0 ? 'متطابق تماماً' : `فارق: ${arDiff.toLocaleString()} ${currency}`
    },
    vendors: {
      nameAr: 'مطابقة ذمم الموردين (Sub-ledger AP vs GL 2101)',
      subledgerTotal: Math.round(totalVendorsBalance * 100) / 100,
      glTotal: Math.round(apGlBalance * 100) / 100,
      difference: Math.round(apDiff * 100) / 100,
      isMatched: apDiff < 1.0,
      statusTextAr: apDiff < 1.0 ? 'متطابق تماماً' : `فارق: ${apDiff.toLocaleString()} ${currency}`
    },
    inventory: {
      nameAr: 'مطابقة تقييم المخزون (Inventory Valuation vs GL 1301)',
      subledgerTotal: Math.round(totalInventoryValue * 100) / 100,
      glTotal: Math.round(invGlBalance * 100) / 100,
      difference: Math.round(invDiff * 100) / 100,
      isMatched: invDiff < 1.0,
      statusTextAr: invDiff < 1.0 ? 'متطابق تماماً' : `فارق: ${invDiff.toLocaleString()} ${currency}`
    },
    isAllMatched: arDiff < 1.0 && apDiff < 1.0 && invDiff < 1.0
  };

  // 7. Auto-Balanced Opening Entry Generation
  const openingItems: RollForwardOpeningEntryItem[] = [];

  // Cash and Banks (if positive)
  if (cashBanksBalance > 0) {
    openingItems.push({
      accountCode: '1101',
      accountName: 'النقدية والأرصدة بالبنوك (افتتاحي)',
      debit: Math.round(cashBanksBalance * 100) / 100,
      credit: 0,
      description: 'رصيد افتتاحي منقول للنقدية والبنوك'
    });
  }

  // Customers (AR)
  if (totalCustomersBalance > 0) {
    openingItems.push({
      accountCode: '1201',
      accountName: 'ذمم العملاء (حساب مراقبة المدينين - إجمالي الذمم)',
      debit: Math.round(totalCustomersBalance * 100) / 100,
      credit: 0,
      description: `أرصدة افتتاحية مرحلة لـ (${customersList.length}) عميل`
    });
  }

  // Allowance for Bad Debts (IFRS 9 Contra-Asset Account 1209)
  if (badDebtAllowance.isEnabled && badDebtAllowance.totalAllowance > 0) {
    openingItems.push({
      accountCode: '1209',
      accountName: 'مخصص ديون مشكوك في تحصيلها (خسائر ائتمانية متوقعة - IFRS 9)',
      debit: 0,
      credit: Math.round(badDebtAllowance.totalAllowance * 100) / 100,
      description: `مخصص ديون مشكوك في تحصيلها (IFRS 9) - صافي القيمة القابلة للتحصيل: ${badDebtAllowance.netRealizableAR.toLocaleString()} ${currency}`
    });
  }

  // Inventory (Beginning Stock)
  if (totalInventoryValue > 0) {
    openingItems.push({
      accountCode: '1301',
      accountName: 'بضاعة أول المدة والمخزون السلعي (كافة الفروع)',
      debit: Math.round(totalInventoryValue * 100) / 100,
      credit: 0,
      description: `تقييم بضاعة أول المدة لـ (${inventoryList.length}) صنف موزعة على (${warehouseBreakdown.length}) مستودع`
    });
  }

  // Checks under collection
  if (totalUnclearedChecks > 0) {
    openingItems.push({
      accountCode: '1104',
      accountName: 'شيكات تحت التحصيل برسم الصرف',
      debit: Math.round(totalUnclearedChecks * 100) / 100,
      credit: 0,
      description: `حافظة شيكات افتتاحية مرحلة (${checksList.length} شيك)`
    });
  }

  // Vendors (AP)
  if (totalVendorsBalance > 0) {
    openingItems.push({
      accountCode: '2101',
      accountName: 'ذمم الموردين (حساب مراقبة الدائنين)',
      debit: 0,
      credit: Math.round(totalVendorsBalance * 100) / 100,
      description: `أرصدة افتتاحية مرحلة لـ (${vendorsList.length}) مورد`
    });
  }

  // Calculate balancing line to Retained Earnings (3201) or Capital (3101)
  const sumDebits = openingItems.reduce((acc, curr) => acc + curr.debit, 0);
  const sumCredits = openingItems.reduce((acc, curr) => acc + curr.credit, 0);
  const balanceDiff = sumDebits - sumCredits;

  if (Math.abs(balanceDiff) > 0.001) {
    if (balanceDiff > 0) {
      // Assets exceed Liabilities -> Positive Equity (Retained Earnings Credit)
      openingItems.push({
        accountCode: '3201',
        accountName: 'الأرباح والخسائر المدورة / رأس المال العامل',
        debit: 0,
        credit: Math.round(balanceDiff * 100) / 100,
        description: `رصيد ميزان الافتتاح التلقائي المتزن للعام ${toYear}`
      });
    } else {
      // Liabilities exceed Assets -> Deficit Debit
      openingItems.push({
        accountCode: '3201',
        accountName: 'الأرباح والخسائر المدورة (عجز مرحل)',
        debit: Math.round(Math.abs(balanceDiff) * 100) / 100,
        credit: 0,
        description: `تسوية عجز الميزان الافتتاحي للعام ${toYear}`
      });
    }
  }

  const finalDebits = openingItems.reduce((acc, curr) => acc + curr.debit, 0);
  const finalCredits = openingItems.reduce((acc, curr) => acc + curr.credit, 0);

  const bundle: RollForwardBundle = {
    metadata: {
      system: 'Logustria ERP & Financial Solutions',
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      fromYear,
      toYear,
      companyName,
      taxNumber,
      currency,
      excludedZeroBalances: excludeZero
    },
    integrityCheck,
    openingEntry: {
      entryNumber: `OP-${toYear}-001`,
      date: `${toYear}-01-01`,
      description: `القيد الافتتاحي للعام المالي ${toYear} (ترحيل الأرصدة التلقائي)`,
      items: openingItems,
      totalDebit: Math.round(finalDebits * 100) / 100,
      totalCredit: Math.round(finalCredits * 100) / 100,
      retainedEarningsAdjustment: Math.round(balanceDiff * 100) / 100,
      isBalanced: Math.abs(finalDebits - finalCredits) < 0.01
    },
    customers: customersList,
    vendors: vendorsList,
    inventory: inventoryList,
    warehouseBreakdown,
    badDebtAllowance,
    installments: installmentsList,
    checks: checksList,
    summary: {
      totalCustomersBalance: Math.round(totalCustomersBalance * 100) / 100,
      totalVendorsBalance: Math.round(totalVendorsBalance * 100) / 100,
      totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
      totalInstallmentsRemaining: Math.round(totalInstallmentsRemaining * 100) / 100,
      totalUnclearedChecks: Math.round(totalUnclearedChecks * 100) / 100,
      activeCustomersCount: customersList.length,
      activeVendorsCount: vendorsList.length,
      activeItemsCount: inventoryList.length,
      activeInstallmentsCount: installmentsList.length,
      activeChecksCount: checksList.length
    }
  };

  return bundle;
}

/**
 * 2. Exports the bundle into a pristine 6-sheet Excel (.xlsx) workbook
 */
export async function exportRollForwardToExcel(bundle: RollForwardBundle, customFilename?: string): Promise<void> {
  const wb = XLSX.utils.book_new();
  const { toYear, companyName, currency, exportDate } = bundle.metadata;
  const dateStr = new Date(exportDate).toLocaleDateString('ar-SA');

  // Helper to append a sheet with RTL enabled
  const addSheetWithRtl = (sheetData: any[][], sheetName: string) => {
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    (ws as any)['!views'] = [{ rightToLeft: true }];
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  };

  // Sheet 1: ملخص القيد الافتتاحي
  const sheet1Data: any[][] = [
    [companyName],
    [`ملخص القيد الافتتاحي للعام المالي الجديد ${toYear}`],
    [`تاريخ التصدير: ${dateStr} | العملة: ${currency}`],
    [],
    ['رقم الحساب', 'اسم الحساب في الدليل', 'مدين (Debit)', 'دائن (Credit)', 'البيان التوضيحي'],
    ...bundle.openingEntry.items.map(it => [
      it.accountCode,
      it.accountName,
      it.debit,
      it.credit,
      it.description
    ]),
    [],
    ['الإجمالي العام', '', bundle.openingEntry.totalDebit, bundle.openingEntry.totalCredit, bundle.openingEntry.isBalanced ? '✔ القيد متزن 100%' : '⚠ يوجد فارق'],
    [],
    ['فحص المطابقة الرقابي مع ميزان المراجعة:'],
    ['البند', 'إجمالي التفاصيل', 'رصيد الأستاذ العام', 'الفارق', 'حالة التطابق'],
    ['ذمم العملاء (AR)', bundle.integrityCheck.customers.subledgerTotal, bundle.integrityCheck.customers.glTotal, bundle.integrityCheck.customers.difference, bundle.integrityCheck.customers.statusTextAr],
    ['ذمم الموردين (AP)', bundle.integrityCheck.vendors.subledgerTotal, bundle.integrityCheck.vendors.glTotal, bundle.integrityCheck.vendors.difference, bundle.integrityCheck.vendors.statusTextAr],
    ['بضاعة أول المدة', bundle.integrityCheck.inventory.subledgerTotal, bundle.integrityCheck.inventory.glTotal, bundle.integrityCheck.inventory.difference, bundle.integrityCheck.inventory.statusTextAr]
  ];
  addSheetWithRtl(sheet1Data, 'القيد الافتتاحي والمطابقة');

  // Sheet 2: أرصدة العملاء وأعمار الديون ومخصص IFRS 9
  const sheet2Data: any[][] = [
    [companyName],
    [`كشف أرصدة العملاء وتصنيف أعمار الديون ومخصص IFRS 9 المرحّلة للعام ${toYear}`],
    [`إجمالي العملاء: ${bundle.customers.length} | إجمالي المدينين: ${bundle.summary.totalCustomersBalance.toLocaleString()} ${currency} | إجمالي مخصص IFRS 9: ${bundle.badDebtAllowance.totalAllowance.toLocaleString()} ${currency}`],
    [],
    ['كود العميل', 'اسم العميل', 'رقم الهاتف', 'الرقم الضريبي', 'إجمالي الرصيد', 'طبيعة الرصيد', 'أقل من 90 يوماً (جارية)', '91 - 180 يوماً', '181 - 360 يوماً (متأخرة)', 'أكثر من 360 يوماً (راكدة / متعثرة)', 'مخصص IFRS 9', 'صافي القيمة القابلة للتحصيل', 'مستوى المخاطرة'],
    ...bundle.customers.map(c => [
      c.code,
      c.name,
      c.phone,
      c.taxNumber || '',
      c.balance,
      c.balanceType === 'DEBIT' ? 'مدين (مستحق لنا)' : c.balanceType === 'CREDIT' ? 'دائن (دفعة مقدمة)' : 'صفري',
      c.aging?.current || 0,
      c.aging?.bucket90to180 || 0,
      c.aging?.bucket180to360 || 0,
      c.aging?.over360 || 0,
      c.allowanceAmount || 0,
      c.netRealizableBalance ?? c.balance,
      c.aging?.riskLevel === 'CRITICAL' ? 'حرج (متعثر)' : c.aging?.riskLevel === 'HIGH' ? 'مرتفع' : c.aging?.riskLevel === 'MEDIUM' ? 'متوسط' : 'طبيعي / منخفض'
    ]),
    [],
    ['الإجمالي العام', '', '', '', bundle.summary.totalCustomersBalance, '', bundle.badDebtAllowance.agingTotals.current, bundle.badDebtAllowance.agingTotals.bucket90to180, bundle.badDebtAllowance.agingTotals.bucket180to360, bundle.badDebtAllowance.agingTotals.over360, bundle.badDebtAllowance.totalAllowance, bundle.badDebtAllowance.netRealizableAR, '']
  ];
  addSheetWithRtl(sheet2Data, 'أرصدة العملاء وأعمار الديون');

  // Sheet 3: أرصدة الموردين
  const sheet3Data: any[][] = [
    [companyName],
    [`كشف أرصدة الموردين الافتتاحية المرحّلة للعام ${toYear}`],
    [`إجمالي عدد الموردين: ${bundle.vendors.length} | إجمالي المستحقات: ${bundle.summary.totalVendorsBalance.toLocaleString()} ${currency}`],
    [],
    ['كود المورد', 'اسم المورد', 'رقم الهاتف', 'الرقم الضريبي', 'الرصيد الافتتاحي', 'طبيعة الرصيد'],
    ...bundle.vendors.map(v => [
      v.code,
      v.name,
      v.phone,
      v.taxNumber || '',
      v.balance,
      v.balanceType === 'CREDIT' ? 'دائن (مستحق للمورد)' : v.balanceType === 'DEBIT' ? 'مدين (دفعة مقدمة)' : 'صفري'
    ]),
    [],
    ['الإجمالي', '', '', '', bundle.summary.totalVendorsBalance, '']
  ];
  addSheetWithRtl(sheet3Data, 'أرصدة الموردين');

  // Sheet 4: بضاعة أول المدة والمخزون مفصلة حسب الفروع ومواقع الرفوف
  const sheet4Data: any[][] = [
    [companyName],
    [`بضاعة أول المدة وتقييم المخزون المرحّل للعام ${toYear} (مفصل بالفروع والرفوف)`],
    [`إجمالي الأصناف: ${bundle.inventory.length} | إجمالي القيمة: ${bundle.summary.totalInventoryValue.toLocaleString()} ${currency} | عدد المستودعات: ${bundle.warehouseBreakdown.length}`],
    [],
    ['كود الصنف', 'الباركود', 'اسم الصنف', 'المستودع / الفرع', 'موقع الرف (Shelf)', 'التصنيف', 'الوحدة', 'الكمية الافتتاحية', 'متوسط التكلفة', 'سعر البيع', 'إجمالي القيمة'],
    ...bundle.inventory.map(it => [
      it.code,
      it.barcode,
      it.name,
      it.warehouseName || 'المستودع الرئيسي - الرياض',
      it.shelfLocation || '',
      it.category,
      it.unit,
      it.stock,
      it.costPrice,
      it.salePrice,
      it.totalValue
    ]),
    [],
    ['الإجمالي العام', '', '', '', '', '', '', '', '', '', bundle.summary.totalInventoryValue]
  ];
  addSheetWithRtl(sheet4Data, 'بضاعة أول المدة');

  // Sheet 5: تقرير توزيع بضاعة أول المدة حسب المستودعات والفروع
  const sheetWarehouseData: any[][] = [
    [companyName],
    [`توزيع بضاعة أول المدة وتقييم المخزون حسب الفروع والمستودعات للعام ${toYear}`],
    [`إجمالي قيمة المخزون العام: ${bundle.summary.totalInventoryValue.toLocaleString()} ${currency}`],
    [],
    ['اسم المستودع / الفرع', 'عدد الأصناف المسجلة', 'إجمالي الكمية الافتتاحية', 'إجمالي التقييم المالي', 'النسبة من المخزون %'],
    ...bundle.warehouseBreakdown.map(wbItem => [
      wbItem.warehouseName,
      wbItem.itemsCount,
      wbItem.totalQuantity,
      wbItem.totalValuation,
      `${wbItem.percentage}%`
    ]),
    [],
    ['الإجمالي الكلي لكافة الفروع', bundle.inventory.length, bundle.warehouseBreakdown.reduce((sum, w) => sum + w.totalQuantity, 0), bundle.summary.totalInventoryValue, '100%']
  ];
  addSheetWithRtl(sheetWarehouseData, 'توزيع المخزون بالمستودعات');

  // Sheet 5: الأقساط المتبقية
  const sheet5Data: any[][] = [
    [companyName],
    [`جدول الأقساط المتبقية والمستحقة في العام ${toYear}`],
    [`إجمالي العقود: ${bundle.installments.length} | إجمالي المتبقي: ${bundle.summary.totalInstallmentsRemaining.toLocaleString()} ${currency}`],
    [],
    ['رقم العقد', 'اسم العميل', 'إجمالي العقد', 'المتبقي', 'عدد الأقساط المتبقية', 'تاريخ أول استحقاق قادم'],
    ...bundle.installments.map(inst => [
      inst.contractNumber,
      inst.customerName,
      inst.totalAmount,
      inst.remainingAmount,
      inst.pendingCount,
      inst.nextDueDate
    ]),
    [],
    ['الإجمالي', '', '', bundle.summary.totalInstallmentsRemaining, '', '']
  ];
  addSheetWithRtl(sheet5Data, 'الأقساط المتبقية');

  // Sheet 6: حافظة الشيكات تحت التحصيل
  const sheet6Data: any[][] = [
    [companyName],
    [`حافظة الشيكات تحت التحصيل والصرف المرحّلة للعام ${toYear}`],
    [`إجمالي عدد الشيكات: ${bundle.checks.length} | إجمالي صافي الشيكات: ${bundle.summary.totalUnclearedChecks.toLocaleString()} ${currency}`],
    [],
    ['رقم الشيك', 'نوع الشيك', 'اسم الطرف / العميل / المورد', 'البنك المسحوب عليه', 'تاريخ الاستحقاق', 'المبلغ', 'الحالة'],
    ...bundle.checks.map(chk => [
      chk.checkNumber,
      chk.type === 'INCOMING' ? 'قبض (وارد)' : 'صرف (صادر)',
      chk.partnerName,
      chk.bankName,
      chk.dueDate,
      chk.amount,
      'تحت التحصيل'
    ]),
    [],
    ['الإجمالي', '', '', '', '', bundle.summary.totalUnclearedChecks, '']
  ];
  addSheetWithRtl(sheet6Data, 'الشيكات المؤجلة');

  const filename = customFilename || `أرصدة_العام_الجديد_${toYear}_شاملة_${new Date().toISOString().split('T')[0]}.xlsx`;
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  await saveOrShareBlob(blob, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/**
 * 3. Exports the bundle as a portable JSON file for 1-Click Roll-Forward
 */
export async function exportRollForwardToJson(bundle: RollForwardBundle, customFilename?: string): Promise<void> {
  const jsonStr = JSON.stringify(bundle, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const filename = customFilename || `Logustria_RollForward_${bundle.metadata.toYear}_Package.json`;
  await saveOrShareBlob(blob, filename, 'application/json');
}

/**
 * 4. Creates an instant rollback snapshot before any import
 */
export function createRollbackSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const snapshot = {
      timestamp: new Date().toISOString(),
      customers: localStorage.getItem('accounting_customers'),
      vendors: localStorage.getItem('accounting_vendors'),
      warehouse: localStorage.getItem('alpha_warehouse_balances_v2'),
      installments: localStorage.getItem('alpha_accounting_installments_v1'),
      checks: localStorage.getItem('alpha_bank_checks_v1'),
      journalEntries: localStorage.getItem('alpha_journal_entries_v1'),
    };
    localStorage.setItem(ROLLBACK_SNAPSHOT_KEY, JSON.stringify(snapshot));
    return true;
  } catch (err) {
    console.error('Failed to create rollback snapshot:', err);
    return false;
  }
}

/**
 * 5. Returns information about available rollback snapshot
 */
export function getRollbackSnapshotInfo(): { hasSnapshot: boolean; dateStr?: string; ageMinutes?: number } {
  if (typeof window === 'undefined') return { hasSnapshot: false };
  try {
    const raw = localStorage.getItem(ROLLBACK_SNAPSHOT_KEY);
    if (!raw) return { hasSnapshot: false };
    const parsed = JSON.parse(raw);
    const date = new Date(parsed.timestamp);
    const ageMinutes = Math.round((Date.now() - date.getTime()) / 60000);
    return {
      hasSnapshot: true,
      dateStr: date.toLocaleString('ar-SA'),
      ageMinutes
    };
  } catch {
    return { hasSnapshot: false };
  }
}

/**
 * 6. Restores the rollback snapshot
 */
export function restoreRollbackSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(ROLLBACK_SNAPSHOT_KEY);
    if (!raw) return false;
    const snapshot = JSON.parse(raw);

    if (snapshot.customers) localStorage.setItem('accounting_customers', snapshot.customers);
    if (snapshot.vendors) localStorage.setItem('accounting_vendors', snapshot.vendors);
    if (snapshot.warehouse) localStorage.setItem('alpha_warehouse_balances_v2', snapshot.warehouse);
    if (snapshot.installments) localStorage.setItem('alpha_accounting_installments_v1', snapshot.installments);
    if (snapshot.checks) localStorage.setItem('alpha_bank_checks_v1', snapshot.checks);
    if (snapshot.journalEntries) localStorage.setItem('alpha_journal_entries_v1', snapshot.journalEntries);

    // Notify all components
    window.dispatchEvent(new Event('alpha-partner-ledger-updated'));
    window.dispatchEvent(new Event('alpha-stock-updated'));
    window.dispatchEvent(new Event('alpha-items-updated'));
    window.dispatchEvent(new Event('alpha-journal-entries-updated'));
    window.dispatchEvent(new Event('alpha-bank-checks-updated'));
    window.dispatchEvent(new Event('alpha-data-changed'));

    return true;
  } catch (err) {
    console.error('Failed to restore snapshot:', err);
    return false;
  }
}

/**
 * 7. Parses uploaded file (Excel .xlsx or JSON) into RollForwardBundle
 */
export async function parseRollForwardFile(file: File): Promise<RollForwardBundle> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'json') {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed.metadata || !parsed.customers || !parsed.inventory) {
      throw new Error('ملف JSON غير صالح أو لا يحتوي على بنية ترحيل الأرصدة الصحيحة.');
    }
    return parsed as RollForwardBundle;
  }

  if (extension === 'xlsx' || extension === 'xls') {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    // Look for customer sheet
    const custSheetName = wb.SheetNames.find(n => n.includes('عملاء') || n.toLowerCase().includes('customer')) || wb.SheetNames[1];
    const vendSheetName = wb.SheetNames.find(n => n.includes('مورد') || n.toLowerCase().includes('vendor')) || wb.SheetNames[2];
    const itemSheetName = wb.SheetNames.find(n => n.includes('بضاعة') || n.includes('مخزون') || n.toLowerCase().includes('inventory')) || wb.SheetNames[3];

    const currentYear = new Date().getFullYear();
    const bundle = computeRollForwardData({ toYear: currentYear });

    // If Excel has custom modified rows, parse them into bundle
    if (custSheetName && wb.Sheets[custSheetName]) {
      const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[custSheetName], { header: 1 });
      const parsedCustomers: RollForwardCustomerItem[] = [];
      // Row 4 is usually header (0-indexed)
      for (let i = 4; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[1] || row[0] === 'الإجمالي') continue;
        const code = String(row[0] || '');
        const name = String(row[1] || '');
        const phone = String(row[2] || '');
        const taxNumber = String(row[3] || '');
        const balance = Number(row[4]) || 0;
        parsedCustomers.push({
          id: `c-imp-${i}`,
          code,
          name,
          phone,
          taxNumber,
          balance,
          balanceType: balance > 0 ? 'DEBIT' : balance < 0 ? 'CREDIT' : 'ZERO'
        });
      }
      if (parsedCustomers.length > 0) {
        bundle.customers = parsedCustomers;
        bundle.summary.totalCustomersBalance = parsedCustomers.reduce((acc, c) => acc + c.balance, 0);
        bundle.summary.activeCustomersCount = parsedCustomers.length;
      }
    }

    if (vendSheetName && wb.Sheets[vendSheetName]) {
      const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[vendSheetName], { header: 1 });
      const parsedVendors: RollForwardVendorItem[] = [];
      for (let i = 4; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[1] || row[0] === 'الإجمالي') continue;
        const code = String(row[0] || '');
        const name = String(row[1] || '');
        const phone = String(row[2] || '');
        const taxNumber = String(row[3] || '');
        const balance = Number(row[4]) || 0;
        parsedVendors.push({
          id: `v-imp-${i}`,
          code,
          name,
          phone,
          taxNumber,
          balance,
          balanceType: balance > 0 ? 'CREDIT' : balance < 0 ? 'DEBIT' : 'ZERO'
        });
      }
      if (parsedVendors.length > 0) {
        bundle.vendors = parsedVendors;
        bundle.summary.totalVendorsBalance = parsedVendors.reduce((acc, v) => acc + v.balance, 0);
        bundle.summary.activeVendorsCount = parsedVendors.length;
      }
    }

    if (itemSheetName && wb.Sheets[itemSheetName]) {
      const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[itemSheetName], { header: 1 });
      const parsedItems: RollForwardInventoryItem[] = [];
      for (let i = 4; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[2] || row[0] === 'الإجمالي') continue;
        const code = String(row[0] || '');
        const barcode = String(row[1] || '');
        const name = String(row[2] || '');
        const category = String(row[3] || 'عام');
        const unit = String(row[4] || 'حبة');
        const stock = Number(row[5]) || 0;
        const costPrice = Number(row[6]) || 0;
        const salePrice = Number(row[7]) || 0;
        const totalValue = Number(row[8]) || (stock * costPrice);

        parsedItems.push({
          id: `it-imp-${i}`,
          code,
          barcode,
          name,
          category,
          unit,
          stock,
          costPrice,
          salePrice,
          totalValue
        });
      }
      if (parsedItems.length > 0) {
        bundle.inventory = parsedItems;
        bundle.summary.totalInventoryValue = parsedItems.reduce((acc, it) => acc + it.totalValue, 0);
        bundle.summary.activeItemsCount = parsedItems.length;
      }
    }

    return bundle;
  }

  throw new Error('نوع الملف غير مدعوم. يرجى اختيار ملف Excel (.xlsx) أو ملف حزمة (.json).');
}

/**
 * 8. Applies and commits the Roll-Forward bundle into the new fiscal year
 */
export function applyRollForwardToNewYear(bundle: RollForwardBundle, targetYear: number): {
  success: boolean;
  message: string;
  openingEntryNumber: string;
} {
  try {
    // 1. Take safety snapshot first!
    createRollbackSnapshot();

    const openingDate = `${targetYear}-01-01`;

    // 2. Commit Opening Balances to Customers
    const existingCustomers = loadCustomers();
    const updatedCustomers: Partner[] = [...existingCustomers];

    for (const rollCust of bundle.customers) {
      const idx = updatedCustomers.findIndex(c => (c.code && c.code === rollCust.code) || c.name.trim().toLowerCase() === rollCust.name.trim().toLowerCase());
      if (idx >= 0) {
        const currentCust = updatedCustomers[idx];
        if (currentCust) {
          currentCust.openingBalance = rollCust.balance;
          currentCust.openingBalanceDate = openingDate;
        }
      } else {
        updatedCustomers.push({
          id: rollCust.id || `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          code: rollCust.code || `CUST-${updatedCustomers.length + 1}`,
          name: rollCust.name,
          type: 'CUSTOMER',
          phone: rollCust.phone,
          taxNumber: rollCust.taxNumber,
          openingBalance: rollCust.balance,
          openingBalanceDate: openingDate,
          isActive: true
        });
      }
    }
    saveCustomers(updatedCustomers);

    // 3. Commit Opening Balances to Vendors
    const existingVendors = loadVendors();
    const updatedVendors: Partner[] = [...existingVendors];

    for (const rollVend of bundle.vendors) {
      const idx = updatedVendors.findIndex(v => (v.code && v.code === rollVend.code) || v.name.trim().toLowerCase() === rollVend.name.trim().toLowerCase());
      if (idx >= 0) {
        const currentVend = updatedVendors[idx];
        if (currentVend) {
          currentVend.openingBalance = rollVend.balance;
          currentVend.openingBalanceDate = openingDate;
        }
      } else {
        updatedVendors.push({
          id: rollVend.id || `v-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          code: rollVend.code || `VEND-${updatedVendors.length + 1}`,
          name: rollVend.name,
          type: 'VENDOR',
          phone: rollVend.phone,
          taxNumber: rollVend.taxNumber,
          openingBalance: rollVend.balance,
          openingBalanceDate: openingDate,
          isActive: true
        });
      }
    }
    saveVendors(updatedVendors);

    // 4. Commit Inventory Beginning Stock & Cost
    const existingItems = loadStoredItems();
    const updatedItems = [...existingItems];

    for (const rollItem of bundle.inventory) {
      const idx = updatedItems.findIndex(it => (it.barcode && it.barcode === rollItem.barcode) || (it.code && it.code === rollItem.code) || it.name.trim().toLowerCase() === rollItem.name.trim().toLowerCase());
      if (idx >= 0) {
        const it = updatedItems[idx];
        if (it) {
          it.stock = rollItem.stock;
          it.costPrice = rollItem.costPrice;
          it.lastRestockDate = openingDate;
          if (rollItem.warehouseName) it.warehouseName = rollItem.warehouseName;
          if (rollItem.shelfLocation) it.shelfLocation = rollItem.shelfLocation;
        }
      } else {
        updatedItems.push({
          id: rollItem.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          code: rollItem.code || `${updatedItems.length + 1}`,
          barcode: rollItem.barcode || '',
          name: rollItem.name,
          category: rollItem.category || 'عام',
          unit: rollItem.unit || 'حبة',
          costPrice: rollItem.costPrice,
          wholesalePrice: rollItem.salePrice * 0.9,
          retailPrice: rollItem.salePrice,
          consumerPrice: rollItem.salePrice,
          salePrice: rollItem.salePrice,
          stock: rollItem.stock,
          taxRate: 15,
          isActive: true,
          warehouseName: rollItem.warehouseName || 'المستودع الرئيسي - الرياض',
          shelfLocation: rollItem.shelfLocation || '',
          lastRestockDate: openingDate
        });
      }
    }
    saveStoredItems(updatedItems);

    // 5. Create Opening Journal Entry #1
    const coa = loadChartOfAccounts();
    const fallbackAcc = coa[0] || { id: 'acc-1101', code: '1101', name: 'النقدية' };

    const journalItems: JournalItem[] = bundle.openingEntry.items.map((it, idx) => {
      const acc = coa.find(a => a.code === it.accountCode) || fallbackAcc;
      return {
        id: `ji-op-${idx + 1}`,
        accountId: acc.id,
        debit: it.debit,
        credit: it.credit
      };
    });

    const entryNumber = `OP-${targetYear}-001`;
    const openingEntry: JournalEntry = {
      id: `je-opening-${targetYear}`,
      entryNumber,
      date: openingDate,
      reference: `ROLLFORWARD-${targetYear}`,
      description: `القيد الافتتاحي للعام المالي ${targetYear} - ترحيل الأرصدة والمخزون`,
      status: JournalEntryStatus.Posted,
      items: journalItems
    };

    saveJournalEntry(openingEntry);

    // 6. Freeze & Lock the Previous Fiscal Year automatically!
    try {
      const prevYear = bundle.metadata.fromYear || (targetYear - 1);
      autoLockYearEnd(prevYear);
    } catch (lockErr) {
      console.warn('Failed to auto-lock period:', lockErr);
    }

    // 7. Dispatch System Sync Events
    window.dispatchEvent(new Event('alpha-partner-ledger-updated'));
    window.dispatchEvent(new Event('alpha-stock-updated'));
    window.dispatchEvent(new Event('alpha-items-updated'));
    window.dispatchEvent(new Event('alpha-journal-entries-updated'));
    window.dispatchEvent(new Event('alpha-bank-checks-updated'));
    window.dispatchEvent(new Event('alpha-data-changed'));

    // Record audit trail event
    try {
      recordAuditLog({
        action: 'ROLLFORWARD',
        module: 'YEAR_END',
        documentType: 'ترحيل أرصدة سنوية',
        documentNumber: entryNumber,
        summary: `اعتماد وترحيل الأرصدة الافتتاحية للسنة المالية الجديدة ${targetYear} وتوليد القيد الافتتاحي (${entryNumber}) لـ ${bundle.customers.length} عميل و${bundle.vendors.length} مورد و${bundle.inventory.length} صنف مخزني`,
        summaryEn: `Applied year-end roll forward to FY${targetYear} with opening entry ${entryNumber}`,
        severity: 'CRITICAL',
        details: {
          targetYear,
          entryNumber,
          customersCount: bundle.customers.length,
          vendorsCount: bundle.vendors.length,
          inventoryCount: bundle.inventory.length,
          totalInventoryValue: bundle.summary.totalInventoryValue,
          totalCustomersBalance: bundle.summary.totalCustomersBalance,
          totalVendorsBalance: bundle.summary.totalVendorsBalance
        }
      });
    } catch {}

    return {
      success: true,
      message: `تم اعتماد الأرصدة الافتتاحية للعام ${targetYear} بنجاح، وتم إنشاء القيد الافتتاحي رقم ${entryNumber}.`,
      openingEntryNumber: entryNumber
    };
  } catch (err: any) {
    console.error('Error applying roll forward:', err);
    return {
      success: false,
      message: err?.message || 'حدث خطأ أثناء اعتماد الأرصدة الافتتاحية.',
      openingEntryNumber: ''
    };
  }
}
