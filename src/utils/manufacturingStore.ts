import { BillOfMaterials, ManufacturingOrder, WorkCenter } from '../types/manufacturing';
import { loadStoredItems, saveStoredItems, Item } from './itemsStore';
import { saveJournalEntry } from './trialBalanceStore';
import { JournalEntry, JournalEntryStatus } from '../types/accounting';
import { notifyDataChanged } from './localFolderBackup';

export const STORAGE_KEY_BOM = 'alpha_accounting_bom_v1';
export const STORAGE_KEY_WORK_ORDERS = 'alpha_accounting_work_orders_v1';
export const STORAGE_KEY_WORK_CENTERS = 'alpha_accounting_work_centers_v1';

export const INITIAL_WORK_CENTERS: WorkCenter[] = [];

export const INITIAL_BOMS: BillOfMaterials[] = [];

export const INITIAL_MANUFACTURING_ORDERS: ManufacturingOrder[] = [];

export function getStoredBOMs(): BillOfMaterials[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BOM);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse BOM storage', e);
  }
  return INITIAL_BOMS;
}

export function saveStoredBOMs(boms: BillOfMaterials[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_BOM, JSON.stringify(boms));
    notifyDataChanged();
    window.dispatchEvent(new Event('alpha-bom-updated'));
    window.dispatchEvent(new Event('alpha-data-changed'));
  } catch (e) {
    console.error('Failed to save BOM', e);
  }
}

export function getStoredWorkOrders(): ManufacturingOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WORK_ORDERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse Work Orders storage', e);
  }
  return INITIAL_MANUFACTURING_ORDERS;
}

export function saveStoredWorkOrders(orders: ManufacturingOrder[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_WORK_ORDERS, JSON.stringify(orders));
    notifyDataChanged();
    window.dispatchEvent(new Event('alpha-work-orders-updated'));
    window.dispatchEvent(new Event('alpha-data-changed'));
  } catch (e) {
    console.error('Failed to save Work Orders', e);
  }
}

export function getStoredWorkCenters(): WorkCenter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WORK_CENTERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse Work Centers storage', e);
  }
  return INITIAL_WORK_CENTERS;
}

export function saveStoredWorkCenters(centers: WorkCenter[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_WORK_CENTERS, JSON.stringify(centers));
    notifyDataChanged();
    window.dispatchEvent(new Event('alpha-work-centers-updated'));
    window.dispatchEvent(new Event('alpha-data-changed'));
  } catch (e) {
    console.error('Failed to save Work Centers', e);
  }
}

/**
 * -------------------------------------------------------------
 * 1. INVENTORY AUTOMATION (صرف الخامات وإضافة المنتج التام)
 * -------------------------------------------------------------
 */

/**
 * Deducts raw materials from store when a work order is started/issued.
 */
export function deductRawMaterialsForOrder(order: ManufacturingOrder): boolean {
  if (order.materialsDeducted) return false;
  const items = loadStoredItems();
  let changed = false;

  (order.materialsConsumed || []).forEach(cMat => {
    const qtyToDeduct = Number(cMat.actualQuantity) || Number(cMat.plannedQuantity) || 0;
    if (qtyToDeduct <= 0) return;

    const idx = items.findIndex(it =>
      (cMat.itemId && it.id === cMat.itemId) ||
      ((it.name || '').trim().toLowerCase() === (cMat.itemName || '').trim().toLowerCase())
    );

    if (idx !== -1 && items[idx]) {
      const currentStock = Number(items[idx].stock) || 0;
      items[idx] = {
        ...items[idx],
        stock: Math.max(0, currentStock - qtyToDeduct)
      };
      changed = true;
    }
  });

  if (changed) {
    saveStoredItems(items, true);
  }
  return true;
}

/**
 * Restores raw materials back into inventory if order is cancelled/reverted.
 */
export function restoreRawMaterialsForOrder(order: ManufacturingOrder): boolean {
  if (!order.materialsDeducted) return false;
  const items = loadStoredItems();
  let changed = false;

  (order.materialsConsumed || []).forEach(cMat => {
    const qtyToRestore = Number(cMat.actualQuantity) || Number(cMat.plannedQuantity) || 0;
    if (qtyToRestore <= 0) return;

    const idx = items.findIndex(it =>
      (cMat.itemId && it.id === cMat.itemId) ||
      ((it.name || '').trim().toLowerCase() === (cMat.itemName || '').trim().toLowerCase())
    );

    if (idx !== -1 && items[idx]) {
      const currentStock = Number(items[idx].stock) || 0;
      items[idx] = {
        ...items[idx],
        stock: currentStock + qtyToRestore
      };
      changed = true;
    }
  });

  if (changed) {
    saveStoredItems(items, true);
  }
  return true;
}

/**
 * Adds finished goods produced from the work order into warehouse items store.
 */
export function addFinishedGoodsForOrder(order: ManufacturingOrder): boolean {
  if (order.finishedGoodsAdded) return false;
  const qtyProduced = Number(order.actualQuantityProduced) > 0 
    ? Number(order.actualQuantityProduced) 
    : Number(order.plannedQuantity);

  if (qtyProduced <= 0) return false;

  const items = loadStoredItems();
  const unitCost = Number(order.actualCostPerUnit) || (Number(order.totalProductionCost) / qtyProduced) || 0;
  const effectiveWarehouse = order.targetWarehouse || 'المستودع الرئيسي - الرياض';

  const idx = items.findIndex(it =>
    (order.finalProductId && it.id === order.finalProductId) ||
    ((it.name || '').trim().toLowerCase() === (order.finalProductName || '').trim().toLowerCase())
  );

  if (idx !== -1 && items[idx]) {
    const existing = items[idx];
    const oldStock = Number(existing.stock) || 0;
    const oldCost = Number(existing.costPrice) || 0;
    const newStock = oldStock + qtyProduced;
    
    // Recalculate Weighted Average Cost
    let newCost = oldCost;
    if (newStock > 0 && unitCost > 0) {
      if (oldStock <= 0) {
        newCost = unitCost;
      } else {
        newCost = ((oldStock * oldCost) + (qtyProduced * unitCost)) / newStock;
      }
    }

    items[idx] = {
      ...existing,
      stock: newStock,
      costPrice: Math.round(newCost * 100) / 100,
      warehouseName: existing.warehouseName || effectiveWarehouse,
      lastRestockDate: order.actualEndDate || order.targetEndDate || new Date().toISOString().slice(0, 10)
    };
  } else {
    // Create new finished good item in the inventory
    const newItem: Item = {
      id: order.finalProductId || 'item-mfg-' + Date.now(),
      code: 'FG-' + Math.floor(1000 + Math.random() * 9000),
      name: order.finalProductName,
      barcode: '99' + Math.floor(1000000000 + Math.random() * 9000000000),
      category: 'إنتاج وتصنيع تام',
      unit: order.unit || 'قطعة',
      costPrice: Math.round(unitCost * 100) / 100,
      wholesalePrice: Math.round(unitCost * 1.25),
      retailPrice: Math.round(unitCost * 1.35),
      consumerPrice: Math.round(unitCost * 1.4),
      salePrice: Math.round(unitCost * 1.4),
      stock: qtyProduced,
      minReorderLevel: 5,
      maxStockLevel: 50,
      taxRate: 15,
      isActive: true,
      warehouseName: effectiveWarehouse,
      shelfLocation: 'FG-PROD-01',
      lastRestockDate: order.actualEndDate || order.targetEndDate || new Date().toISOString().slice(0, 10),
      supplierName: 'قسم الإنتاج والتصنيع الداخلي'
    };
    items.unshift(newItem);
  }

  saveStoredItems(items, true);
  return true;
}

/**
 * -------------------------------------------------------------
 * 2. INDUSTRIAL ACCOUNTING ENTRIES (توليد القيود المحاسبية الصناعية)
 * -------------------------------------------------------------
 */

/**
 * 1) Raw Material Consumption Journal:
 * Dr. 1302 (Work in Progress WIP)
 *   Cr. 1301 (Raw Materials / Stock)
 */
export function createConsumptionJournalEntry(order: ManufacturingOrder): string {
  const materialsCost = order.materialsConsumed.reduce((sum, m) => sum + (Number(m.totalCost) || 0), 0);
  if (materialsCost <= 0) return '';

  const entryNumber = `JV-MFG-MAT-${order.orderNumber}`;
  const date = order.startDate || new Date().toISOString().slice(0, 10);

  const entry: JournalEntry = {
    id: 'jv-mat-' + order.id,
    entryNumber,
    date,
    status: JournalEntryStatus.Posted,
    reference: order.orderNumber,
    description: `قيد صرف خامات ومستلزمات تشغيل لأمر الإنتاج ${order.orderNumber} - تصنيع (${order.finalProductName})`,
    items: [
      {
        id: 'ji-wip-1',
        accountId: 'acc-1302', // مخزون إنتاج تحت التشغيل (WIP)
        debit: materialsCost,
        credit: 0
      },
      {
        id: 'ji-raw-1',
        accountId: 'acc-1301', // المخزون السلعي والمواد الخام
        debit: 0,
        credit: materialsCost
      }
    ]
  };

  saveJournalEntry(entry);
  return entry.id;
}

/**
 * 2) Finished Goods Completion Journal:
 * Dr. 1303 (Finished Goods Inventory) - Total Produced Goods Value
 * Dr. 5109 (Abnormal Scrap Loss - if applicable)
 *   Cr. 1302 (Work in Progress WIP) - Raw materials cost
 *   Cr. 5108 (Applied Direct Labor & Overhead Expenses) - Labor & overheads
 */
export function createCompletionJournalEntry(order: ManufacturingOrder): string {
  const materialsCost = order.materialsConsumed.reduce((sum, m) => sum + (Number(m.totalCost) || 0), 0);
  const laborAndOverhead = (Number(order.directLaborCost) || 0) + (Number(order.overheadAllocatedCost) || 0) + (Number(order.machineHoursCost) || 0);
  const totalCost = materialsCost + laborAndOverhead;
  const scrapLoss = Number(order.scrapCost) || 0;
  const netFinishedGoodsValue = Math.max(0, totalCost - scrapLoss);

  if (totalCost <= 0) return '';

  const entryNumber = `JV-MFG-FIN-${order.orderNumber}`;
  const date = order.actualEndDate || order.targetEndDate || new Date().toISOString().slice(0, 10);

  const itemsList: JournalEntry['items'] = [
    {
      id: 'ji-fg-1',
      accountId: 'acc-1303', // مخزون الإنتاج التام والجاهز للتسليم
      debit: netFinishedGoodsValue,
      credit: 0
    }
  ];

  if (scrapLoss > 0) {
    itemsList.push({
      id: 'ji-scrap-1',
      accountId: 'acc-5109', // خسائر وتكاليف الهالك الصناعي غير الطبيعي
      debit: scrapLoss,
      credit: 0
    });
  }

  itemsList.push({
    id: 'ji-wip-cr-1',
    accountId: 'acc-1302', // إقفال إنتاج تحت التشغيل (WIP)
    debit: 0,
    credit: materialsCost
  });

  if (laborAndOverhead > 0) {
    itemsList.push({
      id: 'ji-overhead-cr-1',
      accountId: 'acc-5108', // أجور وتكاليف ومصاريف تشغيل صناعية محملة
      debit: 0,
      credit: laborAndOverhead
    });
  }

  const entry: JournalEntry = {
    id: 'jv-fin-' + order.id,
    entryNumber,
    date,
    status: JournalEntryStatus.Posted,
    reference: order.orderNumber,
    description: `قيد إثبات استلام وتوريد الإنتاج التام لأمر التشغيل ${order.orderNumber} وإقفال تكاليف التشغيل والأجور المحملة`,
    items: itemsList
  };

  saveJournalEntry(entry);
  return entry.id;
}

/**
 * -------------------------------------------------------------
 * 3. EXPORT HELPERS (Excel / CSV)
 * -------------------------------------------------------------
 */

export function exportWorkOrdersToCSV(orders: ManufacturingOrder[]): void {
  const headers = [
    'رقم أمر التشغيل',
    'المنتج التام',
    'معيار التصنيع (BOM)',
    'الكمية المخططة',
    'الكمية الفعلية المنتجة',
    'الهالك',
    'الوحدة',
    'خط الإنتاج',
    'المشرف',
    'تاريخ البدء',
    'تاريخ التسليم المستهدف',
    'تكلفة الخامات',
    'أجور العمالة المباشرة',
    'المصاريف الصناعية غير المباشرة',
    'إجمالي التكلفة الفعلية',
    'تكلفة الوحدة',
    'الحالة'
  ];

  const rows = orders.map(o => {
    const matCost = o.materialsConsumed.reduce((sum, m) => sum + (Number(m.totalCost) || 0), 0);
    return [
      `"${o.orderNumber}"`,
      `"${o.finalProductName.replace(/"/g, '""')}"`,
      `"${o.bomName.replace(/"/g, '""')}"`,
      o.plannedQuantity,
      o.actualQuantityProduced || o.plannedQuantity,
      o.defectiveQuantity || 0,
      `"${o.unit}"`,
      `"${o.workCenter.replace(/"/g, '""')}"`,
      `"${o.supervisor.replace(/"/g, '""')}"`,
      o.startDate,
      o.targetEndDate,
      matCost,
      o.directLaborCost,
      o.overheadAllocatedCost,
      o.totalProductionCost,
      o.actualCostPerUnit,
      `"${o.status === 'COMPLETED' ? 'مكتمل ومورد' : o.status === 'IN_PROGRESS' ? 'قيد التشغيل' : o.status}"`
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Manufacturing_Orders_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportBOMsToCSV(boms: BillOfMaterials[]): void {
  const headers = [
    'كود المعيار',
    'اسم المعيار',
    'اسم المنتج النهائي',
    'الدفعة المستهدفة',
    'الوحدة',
    'تكلفة الخامات',
    'أجور العمالة المباشرة',
    'المصاريف غير المباشرة',
    'إجمالي التكلفة التقديرية',
    'تكلفة الوحدة المعيارية',
    'الإصدار',
    'الحالة'
  ];

  const rows = boms.map(b => {
    const rawCost = b.rawMaterials.reduce((sum, m) => sum + (Number(m.totalCost) || 0), 0);
    return [
      `"${b.bomCode}"`,
      `"${b.name.replace(/"/g, '""')}"`,
      `"${b.finalProductName.replace(/"/g, '""')}"`,
      b.targetOutputQuantity,
      `"${b.outputUnit}"`,
      rawCost,
      b.directLaborCost,
      b.overheadCost,
      b.totalEstimatedCost,
      b.costPerUnit,
      `"${b.version}"`,
      `"${b.isActive ? 'معتمد ونشط' : 'معطل'}"`
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `BOM_List_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
