import { Item, loadStoredItems, saveStoredItems, dispatchStockUpdatedEvent } from './itemsStore';
import { recordAuditLog } from './auditLogStore';

export const STOCK_TRANSFERS_STORAGE_KEY = 'alpha_stock_transfers_v1';

export interface StockTransferItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  availableStock: number;
  costPrice: number;
  totalCost: number;
  notes?: string;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  date: string;
  sourceWarehouse: string;
  destinationWarehouse: string;
  senderName?: string;
  receiverName?: string;
  driverName?: string;
  vehicleNumber?: string;
  notes?: string;
  items: StockTransferItem[];
  totalQuantity: number;
  totalCost: number;
  status: 'COMPLETED' | 'CANCELLED';
  createdAt: string;
}

export function loadStockTransfers(): StockTransfer[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STOCK_TRANSFERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load stock transfers:', e);
  }
  return [];
}

export function getNextStockTransferNumber(): string {
  const transfers = loadStockTransfers();
  const nextNum = transfers.length + 1;
  const year = new Date().getFullYear();
  return `TR-${year}-${String(nextNum).padStart(4, '0')}`;
}

export function executeStockTransfer(data: {
  date: string;
  sourceWarehouse: string;
  destinationWarehouse: string;
  senderName?: string;
  receiverName?: string;
  driverName?: string;
  vehicleNumber?: string;
  notes?: string;
  items: Array<{
    itemId?: string;
    itemCode?: string;
    itemName: string;
    unit: string;
    quantity: number;
    notes?: string;
  }>;
}): { success: boolean; transfer?: StockTransfer; error?: string } {
  if (!data.sourceWarehouse || !data.destinationWarehouse) {
    return { success: false, error: 'يرجى تحديد مستودع الصرف (المصدر) ومستودع الاستلام (الوجهة)' };
  }
  if (data.sourceWarehouse.trim() === data.destinationWarehouse.trim()) {
    return { success: false, error: 'لا يمكن التحويل إلى نفس المستودع' };
  }
  if (!data.items || data.items.length === 0) {
    return { success: false, error: 'يرجى إضافة صنف واحد على الأقل للتحويل' };
  }

  const allItems = loadStoredItems();
  const processedItems: StockTransferItem[] = [];
  let totalQuantity = 0;
  let totalCost = 0;

  // Validate quantities against source warehouse
  for (const transferItem of data.items) {
    const qty = Number(transferItem.quantity) || 0;
    if (qty <= 0) {
      return { success: false, error: `الكمية المدخلة للصنف (${transferItem.itemName}) غير صالحة` };
    }

    const sourceItem = allItems.find(it => 
      (it.id === transferItem.itemId || it.code === transferItem.itemCode) &&
      (it.warehouseName === data.sourceWarehouse || (!it.warehouseName && data.sourceWarehouse === 'المستودع الرئيسي'))
    ) || allItems.find(it => it.id === transferItem.itemId || it.code === transferItem.itemCode);

    if (!sourceItem) {
      return { success: false, error: `الصنف (${transferItem.itemName}) غير موجود في قاعدة البيانات` };
    }

    if (sourceItem.stock < qty) {
      return { 
        success: false, 
        error: `الرصيد المتاح للصنف (${sourceItem.name}) في (${data.sourceWarehouse}) هو (${sourceItem.stock}) وهو أقل من الكمية المطلوبة للتحويل (${qty})` 
      };
    }

    const cost = Number(sourceItem.costPrice) || 0;
    const lineCost = qty * cost;
    totalQuantity += qty;
    totalCost += lineCost;

    processedItems.push({
      itemId: sourceItem.id,
      itemCode: sourceItem.code,
      itemName: sourceItem.name,
      unit: sourceItem.unit || transferItem.unit || 'حبة / قطعة',
      quantity: qty,
      availableStock: sourceItem.stock,
      costPrice: cost,
      totalCost: lineCost,
      ...(transferItem.notes ? { notes: transferItem.notes } : {})
    });
  }

  // Execute transfer in itemsStore:
  const updatedItems = [...allItems];

  for (const pItem of processedItems) {
    // 1. Deduct from source warehouse item
    const sourceIdx = updatedItems.findIndex(it =>
      (it.id === pItem.itemId || it.code === pItem.itemCode) &&
      (it.warehouseName === data.sourceWarehouse || (!it.warehouseName && data.sourceWarehouse === 'المستودع الرئيسي'))
    );

    if (sourceIdx !== -1) {
      const src = updatedItems[sourceIdx];
      if (src) {
        updatedItems[sourceIdx] = {
          ...src,
          stock: Math.max(0, src.stock - pItem.quantity)
        };
      }
    } else {
      const fallbackIdx = updatedItems.findIndex(it => it.id === pItem.itemId || it.code === pItem.itemCode);
      if (fallbackIdx !== -1) {
        const fb = updatedItems[fallbackIdx];
        if (fb) {
          updatedItems[fallbackIdx] = {
            ...fb,
            stock: Math.max(0, fb.stock - pItem.quantity)
          };
        }
      }
    }

    // 2. Add to destination warehouse item
    const destIdx = updatedItems.findIndex(it =>
      it.code === pItem.itemCode && it.warehouseName === data.destinationWarehouse
    );

    if (destIdx !== -1) {
      const dst = updatedItems[destIdx];
      if (dst) {
        updatedItems[destIdx] = {
          ...dst,
          stock: (Number(dst.stock) || 0) + pItem.quantity
        };
      }
    } else {
      // Create new branch item row for destination warehouse
      const original = updatedItems.find(it => it.code === pItem.itemCode);
      if (original) {
        const newItemForDest: Item = {
          ...original,
          id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          warehouseName: data.destinationWarehouse,
          stock: pItem.quantity,
          shelfLocation: ''
        };
        updatedItems.push(newItemForDest);
      }
    }
  }

  // Save updated items
  saveStoredItems(updatedItems, true);

  // Create StockTransfer record
  const transferNumber = getNextStockTransferNumber();
  const transferRecord: StockTransfer = {
    id: `trans-${Date.now()}`,
    transferNumber,
    date: data.date,
    sourceWarehouse: data.sourceWarehouse,
    destinationWarehouse: data.destinationWarehouse,
    ...(data.senderName ? { senderName: data.senderName } : {}),
    ...(data.receiverName ? { receiverName: data.receiverName } : {}),
    ...(data.driverName ? { driverName: data.driverName } : {}),
    ...(data.vehicleNumber ? { vehicleNumber: data.vehicleNumber } : {}),
    ...(data.notes ? { notes: data.notes } : {}),
    items: processedItems,
    totalQuantity,
    totalCost,
    status: 'COMPLETED',
    createdAt: new Date().toISOString()
  };

  const existingTransfers = loadStockTransfers();
  const newTransfers = [transferRecord, ...existingTransfers];
  localStorage.setItem(STOCK_TRANSFERS_STORAGE_KEY, JSON.stringify(newTransfers));

  // Audit log
  try {
    recordAuditLog({
      action: 'CREATE',
      module: 'ITEMS',
      documentType: 'إذن صرف وتحويل مخزني',
      documentNumber: transferNumber,
      summary: `إذن تحويل مخزني (${transferNumber}) بعدد ${processedItems.length} صنف وإجمالي ${totalQuantity} وحدة من (${data.sourceWarehouse}) إلى (${data.destinationWarehouse})`,
      summaryEn: `Stock transfer voucher (${transferNumber}) of ${totalQuantity} units across ${processedItems.length} items from (${data.sourceWarehouse}) to (${data.destinationWarehouse})`,
      severity: 'INFO',
      details: {
        transferNumber,
        sourceWarehouse: data.sourceWarehouse,
        destinationWarehouse: data.destinationWarehouse,
        totalQuantity,
        totalCost,
        itemsCount: processedItems.length
      }
    });
  } catch (e) {
    console.error('Audit log failed:', e);
  }

  // Dispatch events
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('alpha-stock-transfers-updated'));
    dispatchStockUpdatedEvent();
  }

  return { success: true, transfer: transferRecord };
}
