import { supabase } from '../services/supabaseClient';
import { loadStoredSalesInvoices, StoredSalesInvoice } from './salesStore';
import { loadStoredItems, Item } from './itemsStore';
import { loadCustomers } from './partnerLedger';
import { Partner } from '../types/accounting';

export interface UnifiedSalesInvoiceItem {
  id: string;
  itemId?: string | undefined;
  itemCode?: string | undefined;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  unit?: string | undefined;
  availableStock?: number | undefined;
  costPrice: number;
  totalCost: number;
  totalSale: number;
  netProfit: number;
  profitMargin: number;
  category?: string | undefined;
  isBonus?: boolean | undefined;
}

export interface UnifiedSalesInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate?: string | undefined;
  partnerId: string;
  partnerName: string;
  customerCode?: string | undefined;
  phone?: string | undefined;
  classification: 'NORMAL' | 'TAX';
  taxRate?: number | undefined;
  invoiceType: string;
  source: string;
  safe: string;
  serviceType?: string | undefined;
  salesRepName: string;
  salesRepId?: string | undefined;
  status: 'DRAFT' | 'POSTED' | 'PAID' | 'PARTIAL' | 'UNPAID';
  statusCode: 'DRAFT' | 'POSTED';
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
  items: UnifiedSalesInvoiceItem[];
  totals: {
    subtotal: number;
    taxTotal: number;
    discountTotal: number;
    grandTotal: number;
    cashPaid: number;
    remainingBalance: number;
    totalCost: number;
    totalProfit: number;
  };
  notes?: string | undefined;
  createdAt: string;
  isReturn?: boolean | undefined;
}

/**
 * Fetches and unifies sales invoices from both LocalStorage and Supabase,
 * enriching each invoice and item with accurate catalog and customer data.
 */
export async function getUnifiedSalesInvoices(): Promise<UnifiedSalesInvoice[]> {
  // 1. Load local catalog items for price/cost/code/category enrichment
  const catalogMap = new Map<string, Item>();
  try {
    const items = loadStoredItems();
    (items || []).forEach(it => {
      if (it.id) catalogMap.set(String(it.id), it);
      if (it.code) catalogMap.set(String(it.code).toLowerCase(), it);
      if (it.name) catalogMap.set(String(it.name).trim().toLowerCase(), it);
    });
  } catch (err) {
    console.warn('Error loading items store:', err);
  }

  // 2. Load customers for partner code and phone enrichment
  const customerMap = new Map<string, Partner>();
  try {
    const custs = loadCustomers();
    (custs || []).forEach(c => {
      if (c.id) customerMap.set(String(c.id), c);
      if (c.name) customerMap.set(String(c.name).trim().toLowerCase(), c);
    });
  } catch (err) {
    console.warn('Error loading customers:', err);
  }

  // 3. Load local stored invoices
  let localInvoices: StoredSalesInvoice[] = [];
  try {
    localInvoices = loadStoredSalesInvoices() || [];
  } catch (err) {
    console.warn('Error loading local sales invoices:', err);
  }

  // 4. Load remote Supabase invoices
  let remoteInvoices: any[] = [];
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      remoteInvoices = data;
    }
  } catch (err) {
    console.warn('Supabase remote fetch warning:', err);
  }

  // 5. Merge invoices by ID and invoiceNumber to prevent duplication
  const unifiedMap = new Map<string, UnifiedSalesInvoice>();

  // Process local invoices first
  localInvoices.forEach(inv => {
    const enriched = enrichLocalInvoice(inv, catalogMap, customerMap);
    const key = (enriched.invoiceNumber || enriched.id || Math.random().toString()).trim().toUpperCase();
    unifiedMap.set(key, enriched);
    if (enriched.id) unifiedMap.set(enriched.id, enriched);
  });

  // Process remote invoices and merge/update
  remoteInvoices.forEach(rInv => {
    const invNum = (rInv.invoice_number || rInv.invoiceNumber || rInv.id || '').toString().trim().toUpperCase();
    const existing = unifiedMap.get(invNum) || (rInv.id ? unifiedMap.get(rInv.id) : undefined);

    if (existing) {
      // If existing has items array, keep the detailed items, but update remote status if needed
      if ((!existing.items || existing.items.length === 0) && rInv.items) {
        existing.items = enrichItems(rInv.items, catalogMap);
      }
    } else {
      const enriched = enrichRemoteInvoice(rInv, catalogMap, customerMap);
      unifiedMap.set(invNum || enriched.id, enriched);
      if (enriched.id) unifiedMap.set(enriched.id, enriched);
    }
  });

  // Convert to unique array
  const uniqueInvoices = Array.from(new Set(unifiedMap.values()));

  // Sort descending by date
  return uniqueInvoices.sort((a, b) => {
    const dateA = a.date || a.createdAt || '';
    const dateB = b.date || b.createdAt || '';
    return dateB.localeCompare(dateA);
  });
}

function enrichItems(
  items: any[], 
  catalogMap: Map<string, Item>
): UnifiedSalesInvoiceItem[] {
  if (!Array.isArray(items)) return [];

  return items.map((raw, idx) => {
    const itemId = raw.itemId || raw.item_id || raw.id || `item-${idx}`;
    const name = (raw.description || raw.name || raw.itemName || raw.item_name || 'صنف مبيعات').trim();
    const code = raw.itemCode || raw.item_code || raw.code || '';
    
    // Lookup catalog for best cost and metadata
    let catalogItem = catalogMap.get(String(itemId));
    if (!catalogItem && code) catalogItem = catalogMap.get(String(code).toLowerCase());
    if (!catalogItem && name) catalogItem = catalogMap.get(String(name).toLowerCase());

    const qty = Number(raw.quantity ?? raw.qty ?? 1);
    const unitPrice = Number(raw.unitPrice ?? raw.unit_price ?? raw.price ?? 0);
    const taxRate = Number(raw.taxRate ?? raw.tax_rate ?? 15);
    const unit = raw.unit || catalogItem?.unit || 'حبة';
    const category = raw.category || catalogItem?.category || 'عام';

    // Determine cost price: check raw item first, then catalog cost/avgCost/purchasePrice
    let costPrice = Number(
      raw.costPrice ?? 
      raw.cost_price ?? 
      raw.unitCost ?? 
      raw.unit_cost ?? 
      catalogItem?.costPrice ?? 
      0
    );

    // If cost price is 0, provide a reasonable fallback if item has standard margins
    if (costPrice === 0 && catalogItem?.salePrice && catalogItem.salePrice > 0) {
      costPrice = Number(catalogItem.costPrice || (catalogItem.salePrice * 0.75).toFixed(2));
    }

    const totalSale = Number((qty * unitPrice).toFixed(2));
    const totalCost = Number((qty * costPrice).toFixed(2));
    const netProfit = Number((totalSale - totalCost).toFixed(2));
    const profitMargin = totalSale > 0 ? Number(((netProfit / totalSale) * 100).toFixed(2)) : (costPrice > 0 ? -100 : 0);
    const isBonus = unitPrice === 0 || raw.isBonus === true || raw.is_bonus === true;

    return {
      id: itemId,
      itemId,
      itemCode: code || catalogItem?.code || '',
      description: name,
      quantity: qty,
      unitPrice,
      taxRate,
      unit,
      availableStock: raw.availableStock ?? catalogItem?.stock ?? 0,
      costPrice,
      totalCost,
      totalSale,
      netProfit,
      profitMargin,
      category,
      isBonus
    };
  });
}

function enrichLocalInvoice(
  inv: StoredSalesInvoice,
  catalogMap: Map<string, Item>,
  customerMap: Map<string, Partner>
): UnifiedSalesInvoice {
  const customer = customerMap.get(inv.partnerId) || (inv.partnerName ? customerMap.get(inv.partnerName.trim().toLowerCase()) : undefined);
  const enrichedItems = enrichItems(inv.items || [], catalogMap);

  const subtotal = Number(inv.totals?.subtotal ?? enrichedItems.reduce((s, it) => s + (it.quantity * it.unitPrice), 0));
  const taxTotal = Number(inv.totals?.taxTotal ?? (inv.classification === 'TAX' ? subtotal * 0.15 : 0));
  const discountTotal = Number(inv.totals?.discountTotal ?? 0);
  const grandTotal = Number(inv.totals?.grandTotal ?? (subtotal + taxTotal - discountTotal));
  const cashPaid = Number(inv.totals?.cashPaid ?? 0);
  const remainingBalance = Number(inv.totals?.remainingBalance ?? Math.max(0, grandTotal - cashPaid));

  const totalCost = Number(enrichedItems.reduce((s, it) => s + it.totalCost, 0).toFixed(2));
  const totalProfit = Number((grandTotal - taxTotal - totalCost).toFixed(2));

  const isReturn = (inv.invoiceType || '').toUpperCase().includes('RETURN') || (inv.invoiceType || '').includes('مرتجع');

  let payStatus: 'PAID' | 'PARTIAL' | 'UNPAID' = 'PAID';
  if (remainingBalance <= 0 && grandTotal > 0) {
    payStatus = 'PAID';
  } else if (cashPaid > 0 && remainingBalance > 0) {
    payStatus = 'PARTIAL';
  } else {
    payStatus = 'UNPAID';
  }

  const rawRep = ((inv as any).salesRepName || (inv as any).technicianName || (inv as any).salesman || (inv as any).createdBy || 'مندوب المبيعات العام').trim();

  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber || inv.id,
    date: inv.date || inv.createdAt?.substring(0, 10) || new Date().toISOString().substring(0, 10),
    dueDate: inv.dueDate,
    partnerId: inv.partnerId || 'WALK_IN',
    partnerName: inv.partnerName || customer?.name || 'عميل نقدي عام',
    customerCode: customer?.code || '',
    phone: customer?.phone || '',
    classification: inv.classification || (taxTotal > 0 ? 'TAX' : 'NORMAL'),
    taxRate: inv.taxRate || (inv.classification === 'TAX' ? 15 : 0),
    invoiceType: inv.invoiceType || (payStatus === 'PAID' ? 'CASH_SALES' : 'CREDIT_SALES'),
    source: inv.source || 'MAIN_WAREHOUSE',
    safe: inv.safe || 'MAIN_SAFE',
    serviceType: inv.serviceType || '',
    salesRepName: rawRep,
    salesRepId: (inv as any).salesRepId,
    status: inv.status || 'POSTED',
    statusCode: inv.status || 'POSTED',
    paymentStatus: payStatus,
    items: enrichedItems,
    totals: {
      subtotal,
      taxTotal,
      discountTotal,
      grandTotal,
      cashPaid,
      remainingBalance,
      totalCost,
      totalProfit
    },
    notes: inv.notes,
    createdAt: inv.createdAt || inv.date,
    isReturn
  };
}

function enrichRemoteInvoice(
  rInv: any,
  catalogMap: Map<string, Item>,
  customerMap: Map<string, Partner>
): UnifiedSalesInvoice {
  const pId = rInv.customer_id || rInv.partner_id || rInv.partnerId || 'WALK_IN';
  const pName = rInv.customer_name || rInv.partner_name || rInv.partnerName || 'عميل نقدي عام';
  const customer = customerMap.get(pId) || (pName ? customerMap.get(String(pName).trim().toLowerCase()) : undefined);

  let rawItems = rInv.items || [];
  if (typeof rawItems === 'string') {
    try { rawItems = JSON.parse(rawItems); } catch { rawItems = []; }
  }
  const enrichedItems = enrichItems(rawItems, catalogMap);

  const grandTotal = Number(rInv.net_amount ?? rInv.total_amount ?? rInv.grand_total ?? 0);
  const taxTotal = Number(rInv.tax_amount ?? rInv.tax_total ?? 0);
  const discountTotal = Number(rInv.discount_amount ?? rInv.discount_total ?? 0);
  const subtotal = Number(rInv.subtotal ?? (grandTotal - taxTotal + discountTotal));
  const cashPaid = Number(rInv.paid_amount ?? rInv.cash_paid ?? (rInv.payment_status === 'PAID' ? grandTotal : 0));
  const remainingBalance = Number(rInv.remaining_amount ?? Math.max(0, grandTotal - cashPaid));

  let totalCost = Number(enrichedItems.reduce((s, it) => s + it.totalCost, 0).toFixed(2));
  if (totalCost === 0 && grandTotal > 0) {
    totalCost = Number((grandTotal * 0.70).toFixed(2)); // Realistic estimate if no items array exists
  }
  const totalProfit = Number((grandTotal - taxTotal - totalCost).toFixed(2));

  let payStatus: 'PAID' | 'PARTIAL' | 'UNPAID' = 'PAID';
  if (remainingBalance <= 0 && grandTotal > 0) {
    payStatus = 'PAID';
  } else if (cashPaid > 0 && remainingBalance > 0) {
    payStatus = 'PARTIAL';
  } else {
    payStatus = 'UNPAID';
  }

  const rawRep = (rInv.sales_rep_name || rInv.technician_name || rInv.created_by || rInv.salesman || 'مندوب المبيعات العام').trim();
  const isReturn = (rInv.invoice_type || '').toUpperCase().includes('RETURN') || (rInv.invoice_type || '').includes('مرتجع');

  return {
    id: rInv.id,
    invoiceNumber: rInv.invoice_number || rInv.invoiceNumber || rInv.id,
    date: (rInv.created_at || rInv.date || new Date().toISOString()).substring(0, 10),
    dueDate: rInv.due_date,
    partnerId: pId,
    partnerName: pName,
    customerCode: customer?.code || rInv.customer_code || '',
    phone: customer?.phone || rInv.customer_phone || '',
    classification: rInv.classification || (taxTotal > 0 ? 'TAX' : 'NORMAL'),
    taxRate: Number(rInv.tax_rate ?? (taxTotal > 0 ? 15 : 0)),
    invoiceType: rInv.invoice_type || (payStatus === 'PAID' ? 'CASH_SALES' : 'CREDIT_SALES'),
    source: rInv.source || rInv.warehouse || 'MAIN_WAREHOUSE',
    safe: rInv.safe || rInv.payment_account || rInv.treasury || 'MAIN_SAFE',
    serviceType: rInv.service_type || '',
    salesRepName: rawRep,
    salesRepId: rInv.sales_rep_id,
    status: rInv.status === 'DRAFT' ? 'DRAFT' : 'POSTED',
    statusCode: rInv.status === 'DRAFT' ? 'DRAFT' : 'POSTED',
    paymentStatus: payStatus,
    items: enrichedItems,
    totals: {
      subtotal,
      taxTotal,
      discountTotal,
      grandTotal,
      cashPaid,
      remainingBalance,
      totalCost,
      totalProfit
    },
    notes: rInv.notes,
    createdAt: rInv.created_at || rInv.date,
    isReturn
  };
}

/**
 * Returns a dynamic list of sales representatives extracted from active employees and stored sales invoices.
 */
export function getDynamicSalesRepsList(): { id: string; label: string }[] {
  const map = new Map<string, string>();
  map.set('GENERAL_REP', 'مندوب المبيعات العام / الإدارة');

  if (typeof window !== 'undefined') {
    try {
      const rawEmp = localStorage.getItem('alpha_payroll_employees_v1') || localStorage.getItem('alpha_accounting_employees_v1');
      if (rawEmp) {
        const parsed = JSON.parse(rawEmp);
        if (Array.isArray(parsed)) {
          parsed.forEach((e: any) => {
            const name = String(e?.name || '').trim();
            const job = String(e?.jobTitle || e?.job || '').trim();
            if (name) {
              map.set(name, job ? `${name} (${job})` : name);
            }
          });
        }
      }
    } catch {}

    try {
      const invoices = loadStoredSalesInvoices() || [];
      invoices.forEach((inv: any) => {
        const rep = String(inv?.salesRepName || inv?.technicianName || inv?.salesman || '').trim();
        if (
          rep &&
          rep !== 'مندوب المبيعات العام' &&
          rep !== 'فني المبيعات العام' &&
          rep !== 'المبيعات العامة' &&
          rep !== 'GENERAL_REP' &&
          !map.has(rep)
        ) {
          map.set(rep, rep);
        }
      });
    } catch {}
  }

  return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
}

/**
 * Checks whether an invoice's salesRepName matches the selected sales rep filter.
 */
export function doesInvoiceMatchSalesRep(rawInvoiceRep: string | undefined, selectedSalesRep: string): boolean {
  if (!selectedSalesRep || selectedSalesRep === 'ALL') return true;
  const rawRep = String(rawInvoiceRep || 'مندوب المبيعات العام').trim().toLowerCase();
  if (selectedSalesRep === 'GENERAL_REP') {
    return rawRep.includes('عام') || rawRep.includes('admin') || rawRep.includes('general');
  }
  return rawRep.includes(selectedSalesRep.trim().toLowerCase());
}

