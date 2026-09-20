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

export const DEFAULT_INITIAL_ITEMS: Item[] = [
  {
    id: '1',
    code: '1',
    name: 'لابتوب ديل انسبايرون Core i7',
    barcode: '1234567890123',
    category: 'إلكترونيات',
    unit: 'حبة / قطعة',
    costPrice: 1500,
    wholesalePrice: 1750,
    retailPrice: 1900,
    consumerPrice: 2000,
    salePrice: 2000,
    stock: 14,
    taxRate: 15,
    isActive: true,
    warehouseName: 'المستودع الرئيسي - الرياض',
    shelfLocation: 'A-12-R3',
    minReorderLevel: 20, // Low stock
    maxStockLevel: 50,
    lastRestockDate: '2026-08-15',
    daysInStock: 23,
    monthlyVelocity: 28,
    supplierName: 'شركة التوريدات العالمية'
  },
  {
    id: '2',
    code: '2',
    name: 'أرز بسمتي درجة أولى كلاسيك (شيكارة 40 كجم)',
    barcode: '1234567890124',
    category: 'مواد غذائية',
    unit: 'شيكارة',
    costPrice: 120,
    wholesalePrice: 135,
    retailPrice: 150,
    consumerPrice: 160,
    salePrice: 160,
    stock: 45,
    taxRate: 0,
    isActive: true,
    warehouseName: 'المستودع الرئيسي - الرياض',
    shelfLocation: 'B-04-F1',
    minReorderLevel: 30,
    maxStockLevel: 100,
    lastRestockDate: '2026-08-28',
    daysInStock: 10,
    monthlyVelocity: 85,
    supplierName: 'مؤسسة المواد الأولية'
  },
  {
    id: '3',
    code: '3',
    name: 'سكر أبيض ناعم 50 كجم',
    barcode: '1234567890125',
    category: 'مواد غذائية',
    unit: 'شوال',
    costPrice: 90,
    wholesalePrice: 100,
    retailPrice: 110,
    consumerPrice: 115,
    salePrice: 115,
    stock: 8, // Low stock
    taxRate: 0,
    isActive: true,
    warehouseName: 'مستودع فرع جدة',
    shelfLocation: 'C-02-F2',
    minReorderLevel: 25,
    maxStockLevel: 80,
    lastRestockDate: '2026-07-20',
    daysInStock: 49,
    monthlyVelocity: 42,
    supplierName: 'مؤسسة المواد الأولية'
  },
  {
    id: '4',
    code: '4',
    name: 'شاي أسود فاخر 100 فتلة (كرتونة 24 باكت)',
    barcode: '1234567890126',
    category: 'مواد غذائية',
    unit: 'كرتونة',
    costPrice: 18,
    wholesalePrice: 21,
    retailPrice: 24,
    consumerPrice: 26,
    salePrice: 26,
    stock: 80,
    taxRate: 15,
    isActive: true,
    warehouseName: 'المستودع الرئيسي - الرياض',
    shelfLocation: 'B-08-R1',
    minReorderLevel: 20,
    maxStockLevel: 120,
    lastRestockDate: '2026-08-01',
    daysInStock: 37,
    monthlyVelocity: 55,
    supplierName: 'شركة الخليج للتجارة'
  },
  {
    id: '5',
    code: '5',
    name: 'شاشة سامسونج ذكية 55 بوصة 4K Ultra HD',
    barcode: '1234567890127',
    category: 'إلكترونيات',
    unit: 'جهاز',
    costPrice: 1850,
    wholesalePrice: 2100,
    retailPrice: 2350,
    consumerPrice: 2400,
    salePrice: 2400,
    stock: 0, // OUT OF STOCK
    taxRate: 15,
    isActive: true,
    warehouseName: 'المستودع الرئيسي - الرياض',
    shelfLocation: 'A-01-R1',
    minReorderLevel: 10,
    maxStockLevel: 30,
    lastRestockDate: '2026-06-10',
    daysInStock: 89,
    monthlyVelocity: 16,
    supplierName: 'شركة التوريدات العالمية'
  },
  {
    id: '6',
    code: '6',
    name: 'طابعة ليزر متعددة الوظائف HP LaserJet Pro',
    barcode: '1234567890128',
    category: 'إلكترونيات',
    unit: 'جهاز',
    costPrice: 920,
    wholesalePrice: 1050,
    retailPrice: 1180,
    consumerPrice: 1200,
    salePrice: 1200,
    stock: 22,
    taxRate: 15,
    isActive: true,
    warehouseName: 'مستودع فرع جدة',
    shelfLocation: 'A-09-R2',
    minReorderLevel: 15,
    maxStockLevel: 40,
    lastRestockDate: '2026-08-10',
    daysInStock: 28,
    monthlyVelocity: 12,
    supplierName: 'شركة التوريدات العالمية'
  },
  {
    id: '7',
    code: '7',
    name: 'زيت دوار الشمس نقي (كرتون 12 قارورة 1.5 لتر)',
    barcode: '1234567890129',
    category: 'مواد غذائية',
    unit: 'كرتون',
    costPrice: 85,
    wholesalePrice: 98,
    retailPrice: 108,
    consumerPrice: 112,
    salePrice: 112,
    stock: 120, // High stock
    taxRate: 0,
    isActive: true,
    warehouseName: 'المستودع الرئيسي - الرياض',
    shelfLocation: 'B-14-F1',
    minReorderLevel: 30,
    maxStockLevel: 90,
    lastRestockDate: '2026-05-15',
    daysInStock: 115,
    monthlyVelocity: 14,
    supplierName: 'مؤسسة المواد الأولية'
  },
  {
    id: '8',
    code: '8',
    name: 'هاتف ذكي أبل آيفون 15 برو ماكس 256GB',
    barcode: '1234567890130',
    category: 'إلكترونيات',
    unit: 'جهاز',
    costPrice: 4200,
    wholesalePrice: 4550,
    retailPrice: 4800,
    consumerPrice: 4950,
    salePrice: 4950,
    stock: 12,
    taxRate: 15,
    isActive: true,
    warehouseName: 'مستودع معرض المبيعات',
    shelfLocation: 'SAFE-V01',
    minReorderLevel: 8,
    maxStockLevel: 25,
    lastRestockDate: '2026-08-25',
    daysInStock: 13,
    monthlyVelocity: 35,
    supplierName: 'شركة التوريدات العالمية'
  },
  {
    id: '9',
    code: '9',
    name: 'بن قهوة عربي محمص فاخر مع هيل 1 كجم',
    barcode: '1234567890131',
    category: 'مواد غذائية',
    unit: 'كيس',
    costPrice: 45,
    wholesalePrice: 54,
    retailPrice: 62,
    consumerPrice: 65,
    salePrice: 65,
    stock: 0, // OUT OF STOCK
    taxRate: 15,
    isActive: true,
    warehouseName: 'مستودع فرع جدة',
    shelfLocation: 'B-02-R3',
    minReorderLevel: 15,
    maxStockLevel: 60,
    lastRestockDate: '2026-07-05',
    daysInStock: 64,
    monthlyVelocity: 48,
    supplierName: 'شركة الخليج للتجارة'
  },
  {
    id: '10',
    code: '10',
    name: 'مكتب خشبي إداري تنفيذي مقاس 180 سم',
    barcode: '1234567890132',
    category: 'أثاث ومكتبيات',
    unit: 'قطعة',
    costPrice: 1100,
    wholesalePrice: 1350,
    retailPrice: 1500,
    consumerPrice: 1600,
    salePrice: 1600,
    stock: 5,
    taxRate: 15,
    isActive: true,
    warehouseName: 'المستودع الرئيسي - الرياض',
    shelfLocation: 'FURN-03',
    minReorderLevel: 3,
    maxStockLevel: 10,
    lastRestockDate: '2026-06-20',
    daysInStock: 79,
    monthlyVelocity: 4,
    supplierName: 'مصنع الأمل للأثاث'
  }
];

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
          retailPrice: Number(item.retailPrice) || Number(item.salePrice) || 0,
          consumerPrice: Number(item.consumerPrice) || Number(item.salePrice) || 0,
          salePrice: Number(item.salePrice) || Number(item.consumerPrice) || 0,
          minReorderLevel: item.minReorderLevel !== undefined ? Number(item.minReorderLevel) : 10,
          maxStockLevel: item.maxStockLevel !== undefined ? Number(item.maxStockLevel) : 50,
          warehouseName: item.warehouseName || (idx % 2 === 0 ? 'المستودع الرئيسي - الرياض' : 'مستودع فرع جدة'),
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

  saleItems.forEach(sItem => {
    const sQty = Number(sItem.quantity) || 0;
    if (sQty <= 0) return;

    const idx = itemsList.findIndex(it =>
      (sItem.itemId && it.id === sItem.itemId) ||
      (sItem.itemCode && String(it.code).trim().toLowerCase() === String(sItem.itemCode).trim().toLowerCase()) ||
      (sItem.description && it.name.trim().toLowerCase() === sItem.description.trim().toLowerCase())
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

  saleItems.forEach(sItem => {
    const sQty = Number(sItem.quantity) || 0;
    if (sQty <= 0) return;

    const idx = itemsList.findIndex(it =>
      (sItem.itemId && it.id === sItem.itemId) ||
      (sItem.itemCode && String(it.code).trim().toLowerCase() === String(sItem.itemCode).trim().toLowerCase()) ||
      (sItem.description && it.name.trim().toLowerCase() === sItem.description.trim().toLowerCase())
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

  purchaseItems.forEach(pItem => {
    const pQty = Number(pItem.quantity) || 0;
    const pPrice = Number(pItem.unitPrice) || 0;
    if (pQty <= 0) return;

    const idx = itemsList.findIndex(it =>
      (pItem.itemId && it.id === pItem.itemId) ||
      (pItem.itemCode && String(it.code).trim().toLowerCase() === String(pItem.itemCode).trim().toLowerCase()) ||
      (pItem.description && it.name.trim().toLowerCase() === pItem.description.trim().toLowerCase())
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

  purchaseItems.forEach(pItem => {
    const pQty = Number(pItem.quantity) || 0;
    if (pQty <= 0) return;

    const idx = itemsList.findIndex(it =>
      (pItem.itemId && it.id === pItem.itemId) ||
      (pItem.itemCode && String(it.code).trim().toLowerCase() === String(pItem.itemCode).trim().toLowerCase()) ||
      (pItem.description && it.name.trim().toLowerCase() === pItem.description.trim().toLowerCase())
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
