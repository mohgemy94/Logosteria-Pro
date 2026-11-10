
export function getWarehouseLabel(warehouseKey?: string): string {
  if (!warehouseKey) return 'المستودع الرئيسي';
  if (warehouseKey === 'MAIN_WAREHOUSE') return 'المستودع الرئيسي';
  if (warehouseKey === 'SHOWROOM') return 'معرض المبيعات';
  if (warehouseKey === 'BRANCH_1') return 'فرع الرياض';
  return warehouseKey;
}

import { DB_ITEMS_KEY } from './sequences';
import { notifyDataChanged } from './localFolderBackup';

import { enqueueSyncRecord } from '../services/DatabaseProvider';

export const LOCAL_STORAGE_WAREHOUSE_KEY = 'alpha_warehouse_balances_v2';
export const LEGACY_WAREHOUSE_KEY = 'alpha_warehouse_items_v1';

export interface Item {
  id: string;
  code: string;
  name: string;
  barcode: string;
  category: string;
  unit: string;
  costPrice: number;
  wholesalePrice: number;
  semiWholesalePrice?: number;
  retailPrice: number;
  consumerPrice: number;
  salePrice: number;
  stock: number;
  minReorderLevel?: number;
  maxStockLevel?: number;
  taxRate: number;
  isActive: boolean;
  warehouseName?: string;
  shelfLocation?: string;
  lastRestockDate?: string;
  daysInStock?: number;
  monthlyVelocity?: number;
  supplierName?: string;
}

export interface InvoiceItemPayload {
  id?: string;
  itemId?: string;
  itemCode?: string;
  description?: string;
  quantity: number | string;
  unitPrice?: number | string;
  unit?: string;
  costPrice?: number | string;
  availableStock?: number | string;
  warehouseName?: string;
}

export interface StockStatusInfo {
  status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK' | 'OVER_STOCK';
  labelAr: string;
  badgeClass: string;
  textClass: string;
}

export const DEFAULT_INITIAL_ITEMS: Item[] = [];

export const CUSTOM_WAREHOUSES_STORAGE_KEY = 'alpha_custom_warehouses_v1';

/**
 * Returns dynamic list of warehouses from stored items, custom warehouses, and active transactions.
 */
export function getDynamicWarehousesList(extraWarehouseNames?: string[]): { id: string; label: string }[] {
  const map = new Map<string, string>();
  map.set('MAIN_WAREHOUSE', 'المستودع الرئيسي');

  if (typeof window !== 'undefined') {
    try {
      const customRaw = localStorage.getItem(CUSTOM_WAREHOUSES_STORAGE_KEY);
      if (customRaw) {
        const parsed = JSON.parse(customRaw);
        if (Array.isArray(parsed)) {
          parsed.forEach((w: any) => {
            const name = typeof w === 'string' ? w.trim() : String(w?.name || w?.label || '').trim();
            const id = typeof w === 'string' ? w.trim() : String(w?.id || name).trim();
            if (name) map.set(id, name);
          });
        }
      }
    } catch {
      // ignore
    }

    try {
      const items = loadStoredItems();
      items.forEach(item => {
        const wh = (item.warehouseName || '').trim();
        if (wh && wh !== 'المستودع الرئيسي') {
          map.set(wh, wh);
        }
      });
    } catch {
      // ignore
    }
  }

  if (Array.isArray(extraWarehouseNames)) {
    extraWarehouseNames.forEach(wh => {
      const clean = (wh || '').trim();
      if (clean && !map.has(clean)) {
        map.set(clean, getWarehouseLabel(clean));
      }
    });
  }

  return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
}

/**
 * Broadcasts events across the window so all components (Sales, Purchases, Items, Warehouse, Dashboard, Alerts)
 * update immediately and stay in perfect synchronization.
 */
export function dispatchStockUpdatedEvent() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('alpha-items-updated'));
  window.dispatchEvent(new CustomEvent('alpha-stock-updated'));
  window.dispatchEvent(new CustomEvent('alpha-data-changed'));
  window.dispatchEvent(new Event('storage'));
}

/**
 * Load stored items from DB_ITEMS_KEY.
 * Accurately returns stored items, preserving empty state after factory reset.
 */
export function loadStoredItems(): Item[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DB_ITEMS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return [];
        return parsed.map((item: any, idx: number) => ({
          ...item,
          stock: Number(item.stock) || 0,
          costPrice: Number(item.costPrice) || 0,
          wholesalePrice: Number(item.wholesalePrice) || Number(item.costPrice) || 0,
          semiWholesalePrice: item.semiWholesalePrice !== undefined ? Number(item.semiWholesalePrice) : (Number(item.wholesalePrice) ? Math.round(Number(item.wholesalePrice) * 1.1) : undefined),
          retailPrice: Number(item.retailPrice) || Number(item.salePrice) || 0,
          consumerPrice: Number(item.consumerPrice) || Number(item.salePrice) || 0,
          salePrice: Number(item.salePrice) || Number(item.consumerPrice) || 0,
          minReorderLevel: item.minReorderLevel !== undefined ? Number(item.minReorderLevel) : 10,
          maxStockLevel: item.maxStockLevel !== undefined ? Number(item.maxStockLevel) : 50,
          warehouseName: item.warehouseName || 'المستودع الرئيسي',
          shelfLocation: item.shelfLocation || `S-${idx + 1}-R1`,
          taxRate: item.taxRate !== undefined ? Number(item.taxRate) : 15,
          isActive: item.isActive !== false
        }));
      }
    }

    // Check if legacy warehouse storage has items to migrate
    const legacyRaw = localStorage.getItem(LOCAL_STORAGE_WAREHOUSE_KEY);
    if (legacyRaw !== null) {
      const legacyParsed = JSON.parse(legacyRaw);
      if (Array.isArray(legacyParsed)) {
        localStorage.setItem(DB_ITEMS_KEY, JSON.stringify(legacyParsed));
        return legacyParsed;
      }
    }
  } catch (e) {
    console.error('Error loading stored items:', e);
  }

  return [];
}

/**
 * Saves items list to DB_ITEMS_KEY and syncs warehouse mirror, then broadcasts update.
 */
export function saveStoredItems(items: Item[], broadcast = true): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DB_ITEMS_KEY, JSON.stringify(items));
    localStorage.setItem(LOCAL_STORAGE_WAREHOUSE_KEY, JSON.stringify(items));
    notifyDataChanged();
    if (broadcast) {
      dispatchStockUpdatedEvent();
    }
  } catch (err) {
    console.error('Failed to save stored items:', err);
  }
}

/**
 * Returns comprehensive stock status info with localized Arabic label and Tailwind classes.
 */
export function getItemStockStatus(item: Item): StockStatusInfo {
  const stock = Number(item.stock) || 0;
  const minReorder = item.minReorderLevel !== undefined ? Number(item.minReorderLevel) : 10;
  const maxStock = item.maxStockLevel !== undefined ? Number(item.maxStockLevel) : 60;

  if (stock <= 0) {
    return {
      status: 'OUT_OF_STOCK',
      labelAr: 'نافذ تماماً',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 ring-1 ring-rose-300/50',
      textClass: 'text-rose-600 font-bold'
    };
  }

  if (stock <= minReorder) {
    return {
      status: 'LOW_STOCK',
      labelAr: 'تحت حد الطلب',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 ring-1 ring-amber-300/50',
      textClass: 'text-amber-700 font-bold'
    };
  }

  if (stock >= maxStock && maxStock > 0) {
    return {
      status: 'OVER_STOCK',
      labelAr: 'فائض / بطيء الحركة',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 ring-1 ring-indigo-300/50',
      textClass: 'text-indigo-600 font-semibold'
    };
  }

  return {
    status: 'IN_STOCK',
    labelAr: 'متوفر',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 ring-1 ring-emerald-300/50',
    textClass: 'text-emerald-700 font-semibold'
  };
}

/**
 * Deducts or restores items stock upon posting a Sales Invoice.
 * - Standard Sales (CASH, CREDIT, PARTIAL): DEDUCTS stock.
 * - Sales Returns (CASH_RETURN, CREDIT_RETURN, PARTIAL_RETURN): ADDS stock back.
 * - Quotations (QUOTATION): Does NOT modify stock.
 */
export function deductStockOnSalesInvoice(
  saleItems: InvoiceItemPayload[], 
  invoiceType = 'CASH_SALES'
): Item[] {
  if (invoiceType === 'QUOTATION') return loadStoredItems();

  const isReturn = invoiceType.includes('RETURN');
  const itemsList = loadStoredItems();
  let changed = false;

  (saleItems || []).forEach(sItem => {
    const sQty = Number(sItem.quantity) || 0;
    if (sQty <= 0) return;

    const idx = itemsList.findIndex(it =>
      (sItem.itemId && it.id === sItem.itemId) ||
      (sItem.itemCode && String(it.code).trim().toLowerCase() === String(sItem.itemCode).trim().toLowerCase()) ||
      (sItem.description && (it.name || '').trim().toLowerCase() === (sItem.description || '').trim().toLowerCase())
    );

    if (idx !== -1 && itemsList[idx]) {
      const it = itemsList[idx];
      const oldStock = Number(it.stock) || 0;
      // If return, we add to stock; if normal sale, we deduct from stock
      const newStock = isReturn ? (oldStock + sQty) : Math.max(0, oldStock - sQty);
      itemsList[idx] = {
        ...it,
        stock: newStock
      } as Item;
      changed = true;
    }
  });

  if (changed) {
    saveStoredItems(itemsList, true);
  }
  return itemsList;
}

/**
 * Reverses the stock deduction/addition when a Sales Invoice is UNPOSTED or deleted.
 */
export function restoreStockOnSalesInvoiceUnpost(
  saleItems: InvoiceItemPayload[], 
  invoiceType = 'CASH_SALES'
): Item[] {
  if (invoiceType === 'QUOTATION') return loadStoredItems();

  const isReturn = invoiceType.includes('RETURN');
  const itemsList = loadStoredItems();
  let changed = false;

  (saleItems || []).forEach(sItem => {
    const sQty = Number(sItem.quantity) || 0;
    if (sQty <= 0) return;

    const idx = itemsList.findIndex(it =>
      (sItem.itemId && it.id === sItem.itemId) ||
      (sItem.itemCode && String(it.code).trim().toLowerCase() === String(sItem.itemCode).trim().toLowerCase()) ||
      (sItem.description && (it.name || '').trim().toLowerCase() === (sItem.description || '').trim().toLowerCase())
    );

    if (idx !== -1 && itemsList[idx]) {
      const it = itemsList[idx];
      const oldStock = Number(it.stock) || 0;
      // Reversal: If it was a return, unposting deducts stock; if it was normal sale, unposting restores stock
      const newStock = isReturn ? Math.max(0, oldStock - sQty) : (oldStock + sQty);
      itemsList[idx] = {
        ...it,
        stock: newStock
      } as Item;
      changed = true;
    }
  });

  if (changed) {
    saveStoredItems(itemsList, true);
  }
  return itemsList;
}

/**
 * Adds or deducts items stock and recalculates Weighted Average Cost upon posting a Purchase Invoice.
 * - Standard Purchases (CASH, CREDIT, PARTIAL, OPENING_BALANCE, INVENTORY_SURPLUS): ADDS stock & recalculates WAC cost.
 * - Purchase Returns (CASH_RETURN, CREDIT_RETURN, PARTIAL_RETURN, INVENTORY_DEFICIT): DEDUCTS stock.
 * - Purchase Orders (PURCHASE_ORDER): Does NOT modify stock.
 */
export function addStockOnPurchaseInvoice(
  purchaseItems: InvoiceItemPayload[], 
  invoiceType = 'CASH_PURCHASE',
  invoiceDate?: string
): Item[] {
  if (invoiceType === 'PURCHASE_ORDER') return loadStoredItems();

  const isReturnOrDeficit = invoiceType.includes('RETURN') || invoiceType === 'INVENTORY_DEFICIT';
  const itemsList = loadStoredItems();
  let changed = false;
  const effectiveDate = invoiceDate || new Date().toISOString().split('T')[0];

  (purchaseItems || []).forEach(pItem => {
    const pQty = Number(pItem.quantity) || 0;
    const pPrice = Number(pItem.unitPrice) || 0;
    if (pQty <= 0) return;

    const idx = itemsList.findIndex(it =>
      (pItem.itemId && it.id === pItem.itemId) ||
      (pItem.itemCode && String(it.code).trim().toLowerCase() === String(pItem.itemCode).trim().toLowerCase()) ||
      (pItem.description && (it.name || '').trim().toLowerCase() === (pItem.description || '').trim().toLowerCase())
    );

    if (idx !== -1 && itemsList[idx]) {
      const it = itemsList[idx];
      const currentStock = Number(it.stock) || 0;
      const currentCost = Number(it.costPrice) || 0;

      if (isReturnOrDeficit) {
        // Deduct from stock on purchase return
        itemsList[idx] = {
          ...it,
          stock: Math.max(0, currentStock - pQty)
        } as Item;
      } else {
        // Add to stock & calculate Weighted Average Cost
        const newStock = currentStock + pQty;
        let newCostPrice = currentCost;
        if (newStock > 0 && pPrice > 0) {
          if (currentStock <= 0) {
            newCostPrice = pPrice;
          } else {
            newCostPrice = ((currentStock * currentCost) + (pQty * pPrice)) / newStock;
          }
        }

        itemsList[idx] = {
          ...it,
          stock: newStock,
          costPrice: Math.round(newCostPrice * 100) / 100,
          lastRestockDate: effectiveDate,
          daysInStock: 0
        } as Item;
      }
      changed = true;
    }
  });

  if (changed) {
    saveStoredItems(itemsList, true);
  }
  return itemsList;
}

/**
 * Reverses the stock addition/deduction when a Purchase Invoice is UNPOSTED or deleted.
 */
export function restoreStockOnPurchaseInvoiceUnpost(
  purchaseItems: InvoiceItemPayload[], 
  invoiceType = 'CASH_PURCHASE'
): Item[] {
  if (invoiceType === 'PURCHASE_ORDER') return loadStoredItems();

  const isReturnOrDeficit = invoiceType.includes('RETURN') || invoiceType === 'INVENTORY_DEFICIT';
  const itemsList = loadStoredItems();
  let changed = false;

  (purchaseItems || []).forEach(pItem => {
    const pQty = Number(pItem.quantity) || 0;
    if (pQty <= 0) return;

    const idx = itemsList.findIndex(it =>
      (pItem.itemId && it.id === pItem.itemId) ||
      (pItem.itemCode && String(it.code).trim().toLowerCase() === String(pItem.itemCode).trim().toLowerCase()) ||
      (pItem.description && (it.name || '').trim().toLowerCase() === (pItem.description || '').trim().toLowerCase())
    );

    if (idx !== -1 && itemsList[idx]) {
      const it = itemsList[idx];
      const currentStock = Number(it.stock) || 0;
      // Reversal: If it was a return, unposting adds stock; if normal purchase, unposting deducts stock
      const newStock = isReturnOrDeficit ? (currentStock + pQty) : Math.max(0, currentStock - pQty);
      itemsList[idx] = {
        ...it,
        stock: newStock
      } as Item;
      changed = true;
    }
  });

  if (changed) {
    saveStoredItems(itemsList, true);
  }
  return itemsList;
}

/**
 * Quick direct stock adjustment for an item with instant broadcast
 */
export function updateSingleItemStock(itemId: string, newStock: number, _reason?: string): Item[] {
  const items = loadStoredItems();
  const updated = items.map(i => i.id === itemId ? ({ ...i, stock: Math.max(0, Number(newStock) || 0) } as Item) : i);
  saveStoredItems(updated, true);
  return updated;
}

/**
 * Transfer stock between warehouses or assign new warehouse
 */
export function transferItemWarehouse(
  itemId: string, 
  targetWarehouse: string, 
  _quantity?: number, 
  targetShelf?: string,
  _notes?: string
): { success: boolean; message?: string; items: Item[] } {
  const items = loadStoredItems();
  const updated = items.map(i => {
    if (i.id === itemId) {
      return {
        ...i,
        warehouseName: targetWarehouse,
        shelfLocation: targetShelf !== undefined && targetShelf !== '' ? targetShelf : i.shelfLocation
      } as Item;
    }
    return i;
  });
  saveStoredItems(updated, true);
  return { success: true, message: 'تم التحويل بنجاح', items: updated };
}

/**
 * Normalizes Arabic text for lenient character-by-character search
 */
export function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[\u064B-\u065F]/g, ''); // Remove tashkeel/diacritics
}

/**
 * Advanced fuzzy search across item name, code, barcode, warehouse, and category
 */
export function searchItems(query: string, itemsList?: Item[]): Item[] {
  const items = itemsList || loadStoredItems();
  if (!query || !query.trim()) {
    return items.filter(i => i.isActive !== false);
  }

  const cleanQ = normalizeArabic(query);
  const rawQ = query.trim().toLowerCase();

  return items
    .filter(item => {
      if (item.isActive === false) return false;
      const normalizedName = normalizeArabic(item.name || '');
      const normalizedCategory = normalizeArabic(item.category || '');
      const normalizedWarehouse = normalizeArabic(item.warehouseName || '');
      const code = (item.code || '').toLowerCase();
      const barcode = (item.barcode || '').toLowerCase();

      // Check match in name, code, barcode, warehouse or category
      return (
        normalizedName.includes(cleanQ) ||
        code.includes(rawQ) ||
        barcode.includes(rawQ) ||
        normalizedCategory.includes(cleanQ) ||
        normalizedWarehouse.includes(cleanQ)
      );
    })
    .sort((a, b) => {
      // Prioritize exact prefix match
      const aName = normalizeArabic(a.name || '');
      const bName = normalizeArabic(b.name || '');
      const aStarts = aName.startsWith(cleanQ);
      const bStarts = bName.startsWith(cleanQ);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return 0;
    });
}

/**
 * Pushes an item change to the Outbox Sync Engine.
 */
export async function syncItemRecord(item: Item, action: 'INSERT' | 'UPDATE' | 'DELETE') {
  try {
    await enqueueSyncRecord('items', item.id, action, {
      id: item.id,
      code: item.code || '',
      name: item.name || '',
      barcode: item.barcode || '',
      category: item.category || '',
      unit: item.unit || '',
      cost_price: item.costPrice || 0,
      wholesale_price: item.wholesalePrice || 0,
      retail_price: item.retailPrice || 0,
      consumer_price: item.consumerPrice || 0,
      sale_price: item.salePrice || 0,
      stock: item.stock || 0,
      min_reorder_level: item.minReorderLevel || 0,
      is_active: item.isActive !== false ? 1 : 0
    });
  } catch (err) {
    console.error('Failed to sync item:', err);
  }
}
