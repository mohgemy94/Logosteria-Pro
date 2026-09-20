import { loadStoredSalesInvoices, type StoredSalesInvoice } from './salesStore';
import { loadStoredPurchaseInvoices, type StoredPurchaseInvoice } from './purchasesStore';

export interface ItemInvoicesUsage {
  hasSales: boolean;
  hasPurchases: boolean;
  hasAny: boolean;
  salesCount: number;
  purchasesCount: number;
  totalCount: number;
  salesInvoices: { invoiceNumber: string; date: string }[];
  purchaseInvoices: { invoiceNumber: string; date: string }[];
  reasonMessage?: string | undefined;
}

/**
 * Checks whether an item is referenced in any sales or purchase invoices.
 * Matches by itemId, itemCode, barcode, or item name/description (case-insensitive and trimmed).
 */
export function checkItemInvoicesUsage(
  item: { id?: string; code?: string; name?: string; barcode?: string },
  customSales?: StoredSalesInvoice[],
  customPurchases?: StoredPurchaseInvoice[]
): ItemInvoicesUsage {
  const sales = customSales || loadStoredSalesInvoices();
  const purchases = customPurchases || loadStoredPurchaseInvoices();

  const itemId = item.id ? item.id.trim().toLowerCase() : '';
  const itemCode = item.code ? item.code.trim().toLowerCase() : '';
  const itemName = item.name ? item.name.trim().toLowerCase() : '';
  const itemBarcode = item.barcode ? item.barcode.trim().toLowerCase() : '';

  const isLineMatching = (line: { itemId?: string | undefined; itemCode?: string | undefined; description?: string | undefined; barcode?: string | undefined }): boolean => {
    if (itemId && line.itemId && line.itemId.trim().toLowerCase() === itemId) return true;
    if (itemCode && line.itemCode && line.itemCode.trim().toLowerCase() === itemCode) return true;
    if (itemName && line.description && line.description.trim().toLowerCase() === itemName) return true;
    if (itemBarcode && line.barcode && line.barcode.trim().toLowerCase() === itemBarcode) return true;
    return false;
  };

  const matchedSales: { invoiceNumber: string; date: string }[] = [];
  for (const inv of sales) {
    if (!inv.items || !Array.isArray(inv.items)) continue;
    const isUsed = inv.items.some(isLineMatching);
    if (isUsed) {
      matchedSales.push({ invoiceNumber: inv.invoiceNumber, date: inv.date });
    }
  }

  const matchedPurchases: { invoiceNumber: string; date: string }[] = [];
  for (const inv of purchases) {
    if (!inv.items || !Array.isArray(inv.items)) continue;
    const isUsed = inv.items.some(isLineMatching);
    if (isUsed) {
      matchedPurchases.push({ invoiceNumber: inv.invoiceNumber, date: inv.date });
    }
  }

  const hasSales = matchedSales.length > 0;
  const hasPurchases = matchedPurchases.length > 0;
  const hasAny = hasSales || hasPurchases;
  const totalCount = matchedSales.length + matchedPurchases.length;

  let reasonMessage: string | undefined;
  if (hasAny) {
    const parts: string[] = [];
    if (hasSales) {
      parts.push(`${matchedSales.length} فاتورة مبيعات (${matchedSales.slice(0, 3).map(s => s.invoiceNumber).join(', ')}${matchedSales.length > 3 ? '...' : ''})`);
    }
    if (hasPurchases) {
      parts.push(`${matchedPurchases.length} فاتورة مشتريات (${matchedPurchases.slice(0, 3).map(p => p.invoiceNumber).join(', ')}${matchedPurchases.length > 3 ? '...' : ''})`);
    }
    reasonMessage = `لا يمكن حذف هذا الصنف لوجود حركات مسجلة مرتبطة به: ${parts.join(' و ')}.`;
  }

  return {
    hasSales,
    hasPurchases,
    hasAny,
    salesCount: matchedSales.length,
    purchasesCount: matchedPurchases.length,
    totalCount,
    salesInvoices: matchedSales,
    purchaseInvoices: matchedPurchases,
    reasonMessage,
  };
}
