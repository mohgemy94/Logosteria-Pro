import { InventoryAuditRecord, InventoryCountLine } from '../types/inventoryCount';
import { JournalEntry, JournalEntryStatus } from '../types/accounting';
import { loadStoredItems } from './itemsStore';
import { DB_ITEMS_KEY } from './sequences';
import { saveJournalEntry, loadJournalEntries } from './trialBalanceStore';

export const STORAGE_KEY_INVENTORY_AUDITS = 'alpha_inventory_audits_v1';
export const LOCAL_STORAGE_WAREHOUSE_KEY = 'alpha_warehouse_balances_v2';

// Default empty inventory audits
const INITIAL_DEMO_AUDITS: InventoryAuditRecord[] = [];

export function loadInventoryAudits(): InventoryAuditRecord[] {
  if (typeof window === 'undefined') return INITIAL_DEMO_AUDITS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INVENTORY_AUDITS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_INVENTORY_AUDITS, JSON.stringify(INITIAL_DEMO_AUDITS));
      return INITIAL_DEMO_AUDITS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_DEMO_AUDITS;
  } catch (e) {
    console.error('Failed loading inventory audits:', e);
    return INITIAL_DEMO_AUDITS;
  }
}

export function saveInventoryAudit(audit: InventoryAuditRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadInventoryAudits();
    const index = existing.findIndex(a => a.id === audit.id);
    let updated: InventoryAuditRecord[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = audit;
    } else {
      updated = [audit, ...existing];
    }
    localStorage.setItem(STORAGE_KEY_INVENTORY_AUDITS, JSON.stringify(updated));
    window.dispatchEvent(new Event('alpha-inventory-audits-updated'));
    window.dispatchEvent(new Event('alpha-data-changed'));
  } catch (e) {
    console.error('Failed saving inventory audit:', e);
  }
}

/**
 * Purge and wipe all inventory audits (resets to empty array [])
 */
export function clearAllInventoryAudits(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_INVENTORY_AUDITS, JSON.stringify([]));
  window.dispatchEvent(new Event('alpha-inventory-audits-updated'));
  window.dispatchEvent(new Event('alpha-data-changed'));
}

/**
 * Re-seeds the initial realistic demo audit for demonstration
 */
export function restoreDefaultDemoAudits(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_INVENTORY_AUDITS, JSON.stringify(INITIAL_DEMO_AUDITS));
  window.dispatchEvent(new Event('alpha-inventory-audits-updated'));
  window.dispatchEvent(new Event('alpha-data-changed'));
}

export function deleteInventoryAudit(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadInventoryAudits();
    const updated = existing.filter(a => a.id !== id);
    localStorage.setItem(STORAGE_KEY_INVENTORY_AUDITS, JSON.stringify(updated));
    window.dispatchEvent(new Event('alpha-inventory-audits-updated'));
    window.dispatchEvent(new Event('alpha-data-changed'));
  } catch (e) {
    console.error('Failed deleting inventory audit:', e);
  }
}

export function getNextAuditNumber(): string {
  const audits = loadInventoryAudits();
  const year = new Date().getFullYear();
  let maxSeq = 0;
  audits.forEach(a => {
    const match = a.auditNumber.match(/AUD-(\d{4})-(\d+)/);
    if (match && Number(match[1]) === year) {
      const num = parseInt(match[2] as string, 10);
      if (num > maxSeq) maxSeq = num;
    }
  });
  const nextNum = String(maxSeq + 1).padStart(4, '0');
  return `AUD-${year}-${nextNum}`;
}

export function calculateAuditTotals(lines: InventoryCountLine[]) {
  let shortageValue = 0;
  let surplusValue = 0;
  let shortageCount = 0;
  let surplusCount = 0;
  let matchedCount = 0;

  lines.forEach(l => {
    if (l.varianceQuantity < 0) {
      shortageCount++;
      shortageValue += Math.abs(l.varianceValue);
    } else if (l.varianceQuantity > 0) {
      surplusCount++;
      surplusValue += Math.abs(l.varianceValue);
    } else {
      matchedCount++;
    }
  });

  return {
    totalItems: lines.length,
    matchedCount,
    shortageCount,
    surplusCount,
    totalShortageValue: Math.round(shortageValue * 100) / 100,
    totalSurplusValue: Math.round(surplusValue * 100) / 100,
    netVarianceValue: Math.round((surplusValue - shortageValue) * 100) / 100
  };
}

/**
 * Builds a fresh draft inventory audit populated with current items and book balances
 */
export function createDraftAuditSession(
  targetWarehouse: string = 'المستودع الرئيسي - الرياض',
  auditTitle?: string,
  committeeMembers?: string,
  categoryScope?: string
): InventoryAuditRecord {
  const currentItems = loadStoredItems();
  const today = new Date().toISOString().split('T')[0] as string;
  const auditNumber = getNextAuditNumber();

  // Try to read enriched warehouse items for shelf locations
  let warehouseDetails: any[] = [];
  if (typeof window !== 'undefined') {
    try {
      const whRaw = localStorage.getItem(LOCAL_STORAGE_WAREHOUSE_KEY);
      if (whRaw) warehouseDetails = JSON.parse(whRaw) || [];
    } catch {}
  }

  const filteredItems = currentItems.filter(i => {
    if (i.isActive === false) return false;
    if (categoryScope && categoryScope !== 'ALL' && i.category !== categoryScope) return false;
    return true;
  });

  const lines: InventoryCountLine[] = filteredItems
    .map(item => {
      const whMatch = warehouseDetails.find((w: any) => w.id === item.id || w.code === item.code);
      const bookQty = Number(item.stock || 0);
      const costPrice = Number(item.costPrice || 0);
      return {
        id: `aud-line-${item.id}-${Math.random().toString(36).substring(2, 7)}`,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        barcode: item.barcode,
        category: item.category,
        unit: item.unit,
        warehouseName: targetWarehouse,
        shelfLocation: whMatch?.shelfLocation || 'A-01',
        bookQuantity: bookQty,
        actualQuantity: bookQty, // default to book for convenient review
        varianceQuantity: 0,
        unitCostPrice: costPrice,
        varianceValue: 0,
        notes: ''
      };
    });

  const totals = calculateAuditTotals(lines);

  return {
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    auditNumber,
    auditTitle: auditTitle || `محضر جرد دوري بتاريخ ${today}`,
    date: today,
    targetWarehouse,
    committeeMembers: committeeMembers || 'لجنة الجرد والمطابقة المخزنية',
    status: 'DRAFT',
    lines,
    totals,
    notes: 'جرد دوري للأصناف والمطابقة مع الأرصدة الدفترية للنظام',
    createdAt: new Date().toISOString()
  };
}

/**
 * Reconciles the stock inventory:
 * 1. Adjusts actual physical stock in the store (both alpha_items_store_v1 & alpha_warehouse_balances_v2).
 * 2. Generates a balanced double-entry Journal Entry for inventory variances (acc-5107 / acc-4202 / acc-1301).
 * 3. Updates audit record status to POSTED with journal entry reference.
 */
export function postInventoryAuditAndReconcile(
  auditId: string,
  postedBy: string = 'مدير المستودعات والحسابات'
): { success: boolean; journalEntry?: JournalEntry | undefined; error?: string | undefined } {
  if (typeof window === 'undefined') return { success: false, error: 'بيئة غير صالحة' };

  try {
    const audits = loadInventoryAudits();
    const auditIndex = audits.findIndex(a => a.id === auditId);
    if (auditIndex < 0) {
      return { success: false, error: 'لم يتم العثور على محضر الجرد المحدد.' };
    }

    const audit = audits[auditIndex] as InventoryAuditRecord;
    if (audit.status === 'POSTED') {
      return { success: false, error: 'تم ترحيل واعتماد هذا المحضر مسبقاً.' };
    }

    // 1. Calculate totals & variances
    let shortageValue = 0;
    let surplusValue = 0;
    let shortageCount = 0;
    let surplusCount = 0;
    let matchedCount = 0;

    const computedLines = audit.lines.map(line => {
      const varianceQty = Number(line.actualQuantity) - Number(line.bookQuantity);
      const unitCost = Number(line.unitCostPrice || 0);
      const varianceVal = varianceQty * unitCost;

      if (varianceQty < 0) {
        shortageCount += 1;
        shortageValue += Math.abs(varianceVal);
      } else if (varianceQty > 0) {
        surplusCount += 1;
        surplusValue += Math.abs(varianceVal);
      } else {
        matchedCount += 1;
      }

      return {
        ...line,
        varianceQuantity: varianceQty,
        varianceValue: varianceVal
      };
    });

    const netVariance = surplusValue - shortageValue;

    // 2. Update stock in DB_ITEMS_KEY and LOCAL_STORAGE_WAREHOUSE_KEY
    const items = loadStoredItems();
    const updatedItems = items.map(item => {
      const line = computedLines.find(l => l.itemId === item.id || l.itemCode === item.code);
      if (line) {
        return {
          ...item,
          stock: Number(line.actualQuantity)
        };
      }
      return item;
    });

    localStorage.setItem(DB_ITEMS_KEY, JSON.stringify(updatedItems));

    // Also update warehouse items if stored
    try {
      const whRaw = localStorage.getItem(LOCAL_STORAGE_WAREHOUSE_KEY);
      if (whRaw) {
        const whItems = JSON.parse(whRaw);
        if (Array.isArray(whItems)) {
          const updatedWh = whItems.map((wi: any) => {
            const line = computedLines.find(l => l.itemId === wi.id || l.itemCode === wi.code);
            if (line) {
              return {
                ...wi,
                stock: Number(line.actualQuantity),
                lastRestockDate: audit.date
              };
            }
            return wi;
          });
          localStorage.setItem(LOCAL_STORAGE_WAREHOUSE_KEY, JSON.stringify(updatedWh));
        }
      }
    } catch {}

    // 3. Generate Automatic Journal Entry for Inventory Adjustments (if any variances exist)
    let generatedJournalEntry: JournalEntry | undefined = undefined;

    if (shortageValue > 0 || surplusValue > 0) {
      const existingEntries = loadJournalEntries();
      const currentYear = new Date().getFullYear();
      let maxJeNum = 0;
      existingEntries.forEach(je => {
        const m = je.entryNumber.match(/JE-(\d{4})-(\d+)/);
        if (m && Number(m[1]) === currentYear) {
          const n = parseInt(m[2] as string, 10);
          if (n > maxJeNum) maxJeNum = n;
        }
      });
      const nextJeNumber = `JE-${currentYear}-${String(maxJeNum + 1).padStart(4, '0')}`;

      const journalLines: any[] = [];
      let lineCounter = 1;

      // Handle Shortage:
      // من حـ/ مصروفات وخسائر عجز وتلف المخزون (مدين)
      // إلى حـ/ المخزون السلعي (المستودع الرئيسي) (دائن)
      if (shortageValue > 0) {
        journalLines.push({
          id: `ji-aud-${Date.now()}-${lineCounter++}`,
          accountId: 'acc-5107', // مصروفات وخسائر عجز وتلف المخزون
          debit: Math.round(shortageValue * 100) / 100,
          credit: 0
        });
        journalLines.push({
          id: `ji-aud-${Date.now()}-${lineCounter++}`,
          accountId: 'acc-1301', // المخزون السلعي
          debit: 0,
          credit: Math.round(shortageValue * 100) / 100
        });
      }

      // Handle Surplus:
      // من حـ/ المخزون السلعي (المستودع الرئيسي) (مدين)
      // إلى حـ/ أرباح وفروقات تسوية زيادة المخزون (دائن)
      if (surplusValue > 0) {
        journalLines.push({
          id: `ji-aud-${Date.now()}-${lineCounter++}`,
          accountId: 'acc-1301', // المخزون السلعي
          debit: Math.round(surplusValue * 100) / 100,
          credit: 0
        });
        journalLines.push({
          id: `ji-aud-${Date.now()}-${lineCounter++}`,
          accountId: 'acc-4202', // أرباح وفروقات تسوية زيادة المخزون
          debit: 0,
          credit: Math.round(surplusValue * 100) / 100
        });
      }

      generatedJournalEntry = {
        id: `je-aud-${Date.now()}`,
        entryNumber: nextJeNumber,
        date: audit.date,
        status: JournalEntryStatus.Posted,
        reference: `REF-${audit.auditNumber}`,
        description: `قيد تسوية فروقات الجرد المخزني الدوري - محضر رقم (${audit.auditNumber}) بمستودع: ${audit.targetWarehouse}`,
        items: journalLines
      };

      saveJournalEntry(generatedJournalEntry);
    }

    // 4. Update and persist Audit record
    const updatedAudit: InventoryAuditRecord = {
      ...audit,
      lines: computedLines,
      status: 'POSTED',
      journalEntryId: generatedJournalEntry?.id,
      journalEntryNumber: generatedJournalEntry?.entryNumber,
      postedAt: new Date().toISOString(),
      postedBy,
      totals: {
        totalItems: computedLines.length,
        matchedCount,
        shortageCount,
        surplusCount,
        totalShortageValue: Math.round(shortageValue * 100) / 100,
        totalSurplusValue: Math.round(surplusValue * 100) / 100,
        netVarianceValue: Math.round(netVariance * 100) / 100
      }
    };

    audits[auditIndex] = updatedAudit;
    localStorage.setItem(STORAGE_KEY_INVENTORY_AUDITS, JSON.stringify(audits));

    // 5. Dispatch global synchronization events
    window.dispatchEvent(new Event('alpha-inventory-audits-updated'));
    window.dispatchEvent(new Event('alpha-items-updated'));
    window.dispatchEvent(new Event('alpha-warehouse-balances-updated'));
    window.dispatchEvent(new Event('alpha-journal-entries-updated'));
    window.dispatchEvent(new Event('alpha-trial-balance-updated'));
    window.dispatchEvent(new Event('alpha-data-changed'));
    window.dispatchEvent(new Event('accounting-data-changed'));
    window.dispatchEvent(new Event('storage'));

    return {
      success: true,
      journalEntry: generatedJournalEntry
    };
  } catch (err: any) {
    console.error('Error posting inventory audit:', err);
    return { success: false, error: err?.message || 'حدث خطأ غير متوقع أثناء معالجة الجرد.' };
  }
}
