import { loadStoredItems } from './itemsStore';
import { Item } from '../components/Items';
import { StoredSalesInvoice, DEFAULT_INITIAL_SALES_INVOICES, loadStoredSalesInvoices } from './salesStore';
export { DEFAULT_INITIAL_SALES_INVOICES };

export interface LowStockAlert {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minReorderLevel: number;
  shortage: number; // Required quantity to reach safe reorder point
  costPrice: number;
  salePrice: number;
  status: 'OUT_OF_STOCK' | 'BELOW_REORDER_POINT';
  severity: 'CRITICAL' | 'WARNING';
}

export interface BelowCostItemLine {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  unitLoss: number; // costPrice - unitPrice
  totalLoss: number; // (costPrice - unitPrice) * quantity
  unit: string;
}

export interface BelowCostSaleAlert {
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  partnerName: string;
  partnerId: string;
  status: 'DRAFT' | 'POSTED';
  totalInvoiceLoss: number;
  totalInvoiceAmount: number;
  belowCostItems: BelowCostItemLine[];
  severity: 'CRITICAL' | 'WARNING';
}

export interface DashboardAlertsData {
  lowStockAlerts: LowStockAlert[];
  belowCostSalesAlerts: BelowCostSaleAlert[];
  summary: {
    totalAlertsCount: number;
    criticalCount: number;
    warningCount: number;
    totalBelowCostLoss: number;
    outOfStockCount: number;
    lowStockCount: number;
    belowCostInvoicesCount: number;
  };
}

export function getStoredOrInitialSalesInvoices(): StoredSalesInvoice[] {
  return loadStoredSalesInvoices();
}

export function computeDashboardAlerts(): DashboardAlertsData {
  const itemsCatalog: Item[] = loadStoredItems();
  const salesInvoices: StoredSalesInvoice[] = getStoredOrInitialSalesInvoices();

  // 1. Low Stock & Reorder Point Alerts
  const lowStockAlerts: LowStockAlert[] = [];
  itemsCatalog.forEach(item => {
    const stock = Number(item.stock) || 0;
    const minReorder = Number(item.minReorderLevel) || 10;

    if (stock <= minReorder) {
      const isOutOfStock = stock <= 0;
      const shortage = Math.max(0, minReorder - stock);

      lowStockAlerts.push({
        id: item.id,
        code: item.code,
        name: item.name,
        category: item.category || 'عام',
        unit: item.unit || 'حبة',
        currentStock: stock,
        minReorderLevel: minReorder,
        shortage,
        costPrice: Number(item.costPrice) || 0,
        salePrice: Number(item.salePrice || item.consumerPrice || item.retailPrice) || 0,
        status: isOutOfStock ? 'OUT_OF_STOCK' : 'BELOW_REORDER_POINT',
        severity: isOutOfStock ? 'CRITICAL' : 'WARNING'
      });
    }
  });

  // Sort: Critical out-of-stock first, then biggest shortage
  lowStockAlerts.sort((a, b) => {
    if (a.severity === 'CRITICAL' && b.severity !== 'CRITICAL') return -1;
    if (b.severity === 'CRITICAL' && a.severity !== 'CRITICAL') return 1;
    return b.shortage - a.shortage;
  });

  // 2. Below Cost Sales Invoices Alerts
  const belowCostSalesAlerts: BelowCostSaleAlert[] = [];

  salesInvoices.forEach(inv => {
    const belowCostLines: BelowCostItemLine[] = [];
    let invoiceLoss = 0;

    (inv.items || []).forEach(line => {
      const qty = Number(line.quantity) || 0;
      const sellPrice = Number(line.unitPrice) || 0;
      let costPrice = Number(line.costPrice) || 0;

      // Lookup from catalog if cost price is missing
      if (costPrice <= 0) {
        const matched = itemsCatalog.find(
          it =>
            (line.itemId && it.id === line.itemId) ||
            (line.itemCode && it.code === line.itemCode) ||
            (line.description && it.name.trim().toLowerCase() === line.description.trim().toLowerCase())
        );
        if (matched) {
          costPrice = Number(matched.costPrice) || 0;
        }
      }

      if (costPrice > 0 && sellPrice < costPrice) {
        const unitLoss = costPrice - sellPrice;
        const totalLoss = unitLoss * qty;
        invoiceLoss += totalLoss;

        belowCostLines.push({
          id: line.id,
          name: line.description || 'صنف بدون اسم',
          quantity: qty,
          unitPrice: sellPrice,
          costPrice,
          unitLoss,
          totalLoss,
          unit: line.unit || 'حبة'
        });
      }
    });

    if (belowCostLines.length > 0) {
      const isCritical = invoiceLoss >= 100 || (inv.status === 'POSTED' && invoiceLoss >= 50);
      belowCostSalesAlerts.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        partnerName: inv.partnerName || 'عميل نقدي',
        partnerId: inv.partnerId || '',
        status: inv.status,
        totalInvoiceLoss: Math.round(invoiceLoss * 100) / 100,
        totalInvoiceAmount: inv.totals?.grandTotal || inv.totals?.subtotal || 0,
        belowCostItems: belowCostLines,
        severity: isCritical ? 'CRITICAL' : 'WARNING'
      });
    }
  });

  // Sort by highest loss amount first
  belowCostSalesAlerts.sort((a, b) => b.totalInvoiceLoss - a.totalInvoiceLoss);

  // Summary Metrics
  const criticalCount = 
    lowStockAlerts.filter(a => a.severity === 'CRITICAL').length +
    belowCostSalesAlerts.filter(a => a.severity === 'CRITICAL').length;
  
  const warningCount = 
    lowStockAlerts.filter(a => a.severity === 'WARNING').length +
    belowCostSalesAlerts.filter(a => a.severity === 'WARNING').length;

  const totalBelowCostLoss = belowCostSalesAlerts.reduce((sum, inv) => sum + inv.totalInvoiceLoss, 0);
  const outOfStockCount = lowStockAlerts.filter(a => a.status === 'OUT_OF_STOCK').length;
  const lowStockCount = lowStockAlerts.filter(a => a.status === 'BELOW_REORDER_POINT').length;

  return {
    lowStockAlerts,
    belowCostSalesAlerts,
    summary: {
      totalAlertsCount: lowStockAlerts.length + belowCostSalesAlerts.length,
      criticalCount,
      warningCount,
      totalBelowCostLoss: Math.round(totalBelowCostLoss * 100) / 100,
      outOfStockCount,
      lowStockCount,
      belowCostInvoicesCount: belowCostSalesAlerts.length
    }
  };
}
