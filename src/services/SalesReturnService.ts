/**
 * ============================================================================
 * OFFLINE-FIRST MULTI-PLATFORM ACCOUNTING SYSTEM
 * Service: Sales Return Controller & Automated Balanced Ledger Service
 * Module:  src/services/SalesReturnService.ts
 * ============================================================================
 *
 * ARCHITECTURAL SPECIFICATIONS & FINANCIAL INTEGRITY:
 * 1. Strict Original Invoice Line Validation:
 *    - Verifies items existed in the original invoice.
 *    - Calculates remaining returnable quantity:
 *      maxReturnable = originalQuantity - sum(previouslyReturnedQuantity)
 *    - Throws ExcessiveReturnQuantityException if requestedQuantity > maxReturnable.
 *    - Locks unit price and discount strictly to original invoice line values.
 * 2. Atomic Database Transaction:
 *    - Generates return number (RET-...) via NumberingService.
 *    - Inserts into `sales_returns` and `sales_return_items`.
 *    - Automatically transitions invoice status:
 *      'FULLY_RETURNED' (100% of all items returned) vs 'PARTIALLY_RETURNED'.
 * 3. Automated Double-Entry Bookkeeping (Ledger Engine):
 *    - Generates journal number (JRN-...) via NumberingService.
 *    - Inserts into `journal_entries` (reference_doc_type = 'SALES_RETURN').
 *    - Balanced double-entry postings in `journal_lines`:
 *      * DEBIT:  Sales Returns Account (4102) -> Gross/Net Sales Return Amount
 *      * DEBIT:  VAT Output / Tax Payable (2201) -> Tax Amount
 *      * CREDIT: Cash on Hand (1101) or Accounts Receivable (1201) -> Total Refund
 *    - Strictly enforces sum(debit) === sum(credit).
 */

import {
  SQLiteDatabase,
  NumberingService,
} from './NumberingService';

// ----------------------------------------------------------------------------
// 1. CHART OF ACCOUNTS DEFAULTS
// ----------------------------------------------------------------------------
export const ACCOUNT_CODES = {
  SALES_RETURNS: '4102',        // Revenue contra account (Debit)
  VAT_OUTPUT_PAYABLE: '2201',   // Current Liabilities (Debit to reverse output tax)
  CASH_ON_HAND: '1101',         // Current Assets - Cash (Credit if CASH refund)
  ACCOUNTS_RECEIVABLE: '1201',  // Current Assets - AR (Credit if ON_ACCOUNT)
} as const;

// ----------------------------------------------------------------------------
// 2. TYPES & DATA INTERFACES
// ----------------------------------------------------------------------------

export type PaymentMethod = 'CASH' | 'ON_ACCOUNT';

export interface ReturnItemInput {
  itemId: string;
  quantity: number;
  returnReason?: string;
}

export interface ProcessReturnParams {
  originalInvoiceId: string;
  returnedItems: ReturnItemInput[];
  paymentMethod: PaymentMethod;
  notes?: string;
  customAccounts?: {
    salesReturnsAccount?: string;
    taxPayableAccount?: string;
    cashAccount?: string;
    receivableAccount?: string;
  };
}

export interface ReturnItemSummary {
  id: string;
  itemId: string;
  itemName: string;
  returnedQuantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface JournalLineSummary {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
  notes: string;
}

export interface ReturnProcessResult {
  salesReturnId: string;
  returnNumber: string;
  originalInvoiceId: string;
  originalInvoiceNumber: string;
  customerId: string;
  totalAmount: number;
  taxAmount: number;
  netAmount: number;
  newInvoiceStatus: 'PARTIALLY_RETURNED' | 'FULLY_RETURNED';
  returnedItems: ReturnItemSummary[];
  journalEntry: {
    id: string;
    entryNumber: string;
    referenceDocType: string;
    referenceDocId: string;
    totalDebit: number;
    totalCredit: number;
    lines: JournalLineSummary[];
  };
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  customer_id: string;
  total_amount: number;
  tax_amount: number;
  net_amount: number;
  status: string;
  device_id: string;
}

interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
}

interface ItemPriorReturnRow {
  item_id: string;
  total_previously_returned: number;
}

// ----------------------------------------------------------------------------
// 3. DOMAIN EXCEPTIONS
// ----------------------------------------------------------------------------

export class InvoiceNotFoundException extends Error {
  constructor(invoiceId: string) {
    super(`Invoice with ID '${invoiceId}' was not found in the database.`);
    this.name = 'InvoiceNotFoundException';
    Object.setPrototypeOf(this, InvoiceNotFoundException.prototype);
  }
}

export class InvoiceAlreadyReturnedException extends Error {
  constructor(invoiceNumber: string) {
    super(`Invoice '${invoiceNumber}' is already fully returned. No further returns are permitted.`);
    this.name = 'InvoiceAlreadyReturnedException';
    Object.setPrototypeOf(this, InvoiceAlreadyReturnedException.prototype);
  }
}

export class InvalidReturnQuantityException extends Error {
  constructor(itemId: string, quantity: number) {
    super(`Invalid return quantity '${quantity}' for item '${itemId}'. Quantity must be strictly positive.`);
    this.name = 'InvalidReturnQuantityException';
    Object.setPrototypeOf(this, InvalidReturnQuantityException.prototype);
  }
}

export class ItemNotInInvoiceException extends Error {
  constructor(itemId: string, invoiceNumber: string) {
    super(`Item with ID '${itemId}' does not exist on original invoice '${invoiceNumber}'.`);
    this.name = 'ItemNotInInvoiceException';
    Object.setPrototypeOf(this, ItemNotInInvoiceException.prototype);
  }
}

export class ExcessiveReturnQuantityException extends Error {
  public readonly itemId: string;
  public readonly requested: number;
  public readonly maxReturnable: number;

  constructor(itemId: string, requested: number, maxReturnable: number) {
    super(
      `Requested return quantity (${requested}) exceeds max returnable quantity (${maxReturnable}) for item '${itemId}'.`
    );
    this.name = 'ExcessiveReturnQuantityException';
    this.itemId = itemId;
    this.requested = requested;
    this.maxReturnable = maxReturnable;
    Object.setPrototypeOf(this, ExcessiveReturnQuantityException.prototype);
  }
}

export class UnbalancedJournalEntryException extends Error {
  public readonly debit: number;
  public readonly credit: number;

  constructor(debit: number, credit: number) {
    super(
      `Double-entry balance violation: Total Debits (${debit.toFixed(2)}) must equal Total Credits (${credit.toFixed(2)}).`
    );
    this.name = 'UnbalancedJournalEntryException';
    this.debit = debit;
    this.credit = credit;
    Object.setPrototypeOf(this, UnbalancedJournalEntryException.prototype);
  }
}

export class SalesReturnTransactionException extends Error {
  constructor(originalError: any) {
    super(`Sales return transaction failed and was rolled back: ${originalError?.message || originalError}`);
    this.name = 'SalesReturnTransactionException';
    Object.setPrototypeOf(this, SalesReturnTransactionException.prototype);
  }
}

// ----------------------------------------------------------------------------
// 4. LOW-LEVEL DATABASE HELPERS
// ----------------------------------------------------------------------------

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Standard RFC4122 v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function queryRows<T = any>(db: SQLiteDatabase, sql: string, params: any[] = []): Promise<T[]> {
  if (typeof db.getAllAsync === 'function') {
    return await db.getAllAsync<T>(sql, ...params);
  }

  if (typeof db.executeSql === 'function') {
    const result = await db.executeSql(sql, params);
    const rowsObj = Array.isArray(result) ? result[0]?.rows : result?.rows;
    if (!rowsObj) return [];

    if (Array.isArray(rowsObj._array)) {
      return rowsObj._array as T[];
    }
    if (typeof rowsObj.raw === 'function') {
      return rowsObj.raw() as T[];
    }
    const output: T[] = [];
    const len = rowsObj.length || 0;
    for (let i = 0; i < len; i++) {
      output.push(rowsObj.item ? rowsObj.item(i) : rowsObj[i]);
    }
    return output;
  }

  throw new Error('Unsupported SQLite Database driver interface.');
}

async function executeStatement(db: SQLiteDatabase, sql: string, params: any[] = []): Promise<any> {
  if (typeof db.runAsync === 'function') {
    return await db.runAsync(sql, ...params);
  }
  if (typeof db.executeSql === 'function') {
    return await db.executeSql(sql, params);
  }
  throw new Error('Unsupported SQLite Database driver interface.');
}

/**
 * Runs a transactional block safely across different SQLite engines:
 * - expo-sqlite / op-sqlite `withTransactionAsync`
 * - Standard `BEGIN IMMEDIATE TRANSACTION` fallback
 */
async function runInTransaction<T>(db: SQLiteDatabase, callback: () => Promise<T>): Promise<T> {
  if (typeof db.withTransactionAsync === 'function') {
    return await db.withTransactionAsync(callback);
  }

  // Fallback: manual transaction orchestration with immediate write locking
  await executeStatement(db, 'BEGIN IMMEDIATE TRANSACTION;');
  try {
    const result = await callback();
    await executeStatement(db, 'COMMIT;');
    return result;
  } catch (error) {
    try {
      await executeStatement(db, 'ROLLBACK;');
    } catch {
      // Ignore rollback errors if already aborted
    }
    throw error;
  }
}

function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// ----------------------------------------------------------------------------
// 5. SALES RETURN CONTROLLER & SERVICE
// ----------------------------------------------------------------------------

export class SalesReturnService {
  /**
   * Processes a complete sales return with strict original invoice validation
   * and automated balanced double-entry general ledger posting.
   */
  public static async processSalesReturn(
    db: SQLiteDatabase,
    params: ProcessReturnParams
  ): Promise<ReturnProcessResult> {
    const { originalInvoiceId, returnedItems, paymentMethod, notes, customAccounts } = params;

    // --- Pre-validation on inputs ---
    if (!returnedItems || returnedItems.length === 0) {
      throw new Error('Return payload must contain at least one item.');
    }

    for (const item of returnedItems) {
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        throw new InvalidReturnQuantityException(item.itemId, item.quantity);
      }
    }

    // --- Fetch Original Invoice ---
    const invoiceSql = `
      SELECT id, invoice_number, customer_id, total_amount, tax_amount, net_amount, status, device_id
      FROM invoices
      WHERE id = ? LIMIT 1;
    `;
    const invoiceRows = await queryRows<InvoiceRow>(db, invoiceSql, [originalInvoiceId]);
    const invoice = invoiceRows[0];
    if (!invoice) {
      throw new InvoiceNotFoundException(originalInvoiceId);
    }

    if (invoice.status === 'FULLY_RETURNED' || invoice.status === 'CANCELLED') {
      throw new InvoiceAlreadyReturnedException(invoice.invoice_number);
    }

    // --- Fetch Original Invoice Items ---
    const itemsSql = `
      SELECT id, invoice_id, item_id, item_name, quantity, unit_price, discount, line_total
      FROM invoice_items
      WHERE invoice_id = ?;
    `;
    const originalItemRows = await queryRows<InvoiceItemRow>(db, itemsSql, [originalInvoiceId]);
    if (originalItemRows.length === 0) {
      throw new Error(`Original invoice '${invoice.invoice_number}' contains no line items.`);
    }

    const originalItemsMap = new Map<string, InvoiceItemRow>();
    for (const origItem of originalItemRows) {
      originalItemsMap.set(origItem.item_id, origItem);
    }

    // --- Fetch Prior Returns for this Invoice ---
    const priorReturnsSql = `
      SELECT sri.item_id, COALESCE(SUM(sri.returned_quantity), 0) AS total_previously_returned
      FROM sales_returns sr
      JOIN sales_return_items sri ON sr.id = sri.return_id
      WHERE sr.original_invoice_id = ?
      GROUP BY sri.item_id;
    `;
    const priorReturnRows = await queryRows<ItemPriorReturnRow>(db, priorReturnsSql, [originalInvoiceId]);
    const previouslyReturnedMap = new Map<string, number>();
    for (const prior of priorReturnRows) {
      previouslyReturnedMap.set(prior.item_id, Number(prior.total_previously_returned));
    }

    // --- Line Item Validation & Financial Valuation ---
    // Enforce locked original prices and verify returnable quantity bounds
    const preparedReturnItems: ReturnItemSummary[] = [];
    let calculatedReturnTotal = 0; // Gross/Net sales amount returned (before tax)

    for (const reqItem of returnedItems) {
      const origItem = originalItemsMap.get(reqItem.itemId);
      if (!origItem) {
        throw new ItemNotInInvoiceException(reqItem.itemId, invoice.invoice_number);
      }

      const previouslyReturned = previouslyReturnedMap.get(reqItem.itemId) || 0;
      const maxReturnable = roundToTwo(origItem.quantity - previouslyReturned);

      if (reqItem.quantity > maxReturnable) {
        throw new ExcessiveReturnQuantityException(reqItem.itemId, reqItem.quantity, maxReturnable);
      }

      // Lock unit price strictly to original invoice line
      const lockedUnitPrice = origItem.unit_price;

      // Calculate proportionate line discount (if any)
      const proportionateDiscount = origItem.quantity > 0
        ? roundToTwo((origItem.discount / origItem.quantity) * reqItem.quantity)
        : 0;

      // Line Total = (Quantity * Locked Unit Price) - Proportionate Discount
      const lineTotal = roundToTwo((reqItem.quantity * lockedUnitPrice) - proportionateDiscount);

      preparedReturnItems.push({
        id: generateUUID(),
        itemId: reqItem.itemId,
        itemName: origItem.item_name,
        returnedQuantity: reqItem.quantity,
        unitPrice: lockedUnitPrice,
        discount: proportionateDiscount,
        lineTotal,
      });

      calculatedReturnTotal += lineTotal;
    }

    calculatedReturnTotal = roundToTwo(calculatedReturnTotal);

    // --- Calculate Proportionate VAT / Tax Amount ---
    // If original invoice had tax, calculate proportionate tax on returned items
    let calculatedReturnTax = 0;
    if (invoice.total_amount > 0 && invoice.tax_amount > 0) {
      const taxRate = invoice.tax_amount / invoice.total_amount;
      calculatedReturnTax = roundToTwo(calculatedReturnTotal * taxRate);
    }

    const calculatedReturnNet = roundToTwo(calculatedReturnTotal + calculatedReturnTax);

    // --- Compute New Invoice Status (PARTIALLY_RETURNED vs FULLY_RETURNED) ---
    // Check if the sum of all returns (past + current) matches the invoice's total quantities
    let allOriginalQuantity = 0;
    let allReturnedQuantity = 0;

    for (const origItem of originalItemRows) {
      allOriginalQuantity += origItem.quantity;
      const priorQty = previouslyReturnedMap.get(origItem.item_id) || 0;
      const currentReturnQty = returnedItems.find((r) => r.itemId === origItem.item_id)?.quantity || 0;
      allReturnedQuantity += priorQty + currentReturnQty;
    }

    allOriginalQuantity = roundToTwo(allOriginalQuantity);
    allReturnedQuantity = roundToTwo(allReturnedQuantity);

    const newInvoiceStatus: 'PARTIALLY_RETURNED' | 'FULLY_RETURNED' =
      allReturnedQuantity >= allOriginalQuantity ? 'FULLY_RETURNED' : 'PARTIALLY_RETURNED';

    // --- Execute Atomic Database Transaction ---
    try {
      return await runInTransaction<ReturnProcessResult>(db, async () => {
        const deviceId = await NumberingService.getDeviceId(db);
        const returnDocId = generateUUID();
        const returnNumber = await NumberingService.generateDocNumber(db, 'RET');
        const nowIso = new Date().toISOString();
        const todayDate = nowIso.slice(0, 10);

        // 1. Insert Sales Return Header
        const insertReturnSql = `
          INSERT INTO sales_returns (
            id, return_number, original_invoice_id, original_invoice_number,
            customer_id, total_amount, tax_amount, net_amount,
            return_reason, device_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;
        await executeStatement(db, insertReturnSql, [
          returnDocId,
          returnNumber,
          invoice.id,
          invoice.invoice_number,
          invoice.customer_id,
          calculatedReturnTotal,
          calculatedReturnTax,
          calculatedReturnNet,
          notes || 'Customer Return',
          deviceId,
          nowIso,
          nowIso,
        ]);

        // 2. Insert Sales Return Line Items
        const insertItemSql = `
          INSERT INTO sales_return_items (
            id, return_id, item_id, returned_quantity, unit_price, line_total
          ) VALUES (?, ?, ?, ?, ?, ?);
        `;
        for (const item of preparedReturnItems) {
          await executeStatement(db, insertItemSql, [
            item.id,
            returnDocId,
            item.itemId,
            item.returnedQuantity,
            item.unitPrice,
            item.lineTotal,
          ]);
        }

        // 3. Update Invoice Status
        const updateInvoiceSql = `
          UPDATE invoices 
          SET status = ?, updated_at = ? 
          WHERE id = ?;
        `;
        await executeStatement(db, updateInvoiceSql, [newInvoiceStatus, nowIso, invoice.id]);

        // 4. Automated Balanced Double-Entry Bookkeeping
        const journalEntryId = generateUUID();
        const journalNumber = await NumberingService.generateDocNumber(db, 'JRN');

        const insertJournalHeaderSql = `
          INSERT INTO journal_entries (
            id, entry_number, reference_doc_type, reference_doc_id,
            description, device_id, entry_date, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        `;
        const journalDesc = `Sales Return: ${returnNumber} for Invoice ${invoice.invoice_number}`;
        await executeStatement(db, insertJournalHeaderSql, [
          journalEntryId,
          journalNumber,
          'SALES_RETURN',
          returnDocId,
          journalDesc,
          deviceId,
          todayDate,
          nowIso,
        ]);

        // Configure Chart of Accounts codes
        const salesReturnsAccount = customAccounts?.salesReturnsAccount || ACCOUNT_CODES.SALES_RETURNS;
        const taxPayableAccount = customAccounts?.taxPayableAccount || ACCOUNT_CODES.VAT_OUTPUT_PAYABLE;
        const creditAccount =
          paymentMethod === 'CASH'
            ? customAccounts?.cashAccount || ACCOUNT_CODES.CASH_ON_HAND
            : customAccounts?.receivableAccount || ACCOUNT_CODES.ACCOUNTS_RECEIVABLE;

        const journalLines: JournalLineSummary[] = [];

        // Line 1: DEBIT Sales Returns (Contra Revenue)
        if (calculatedReturnTotal > 0) {
          const lineId = generateUUID();
          journalLines.push({
            id: lineId,
            accountId: salesReturnsAccount,
            debit: calculatedReturnTotal,
            credit: 0,
            notes: `Sales Return Value [Invoice: ${invoice.invoice_number}]`,
          });
        }

        // Line 2: DEBIT VAT Output / Tax Payable (Reverse tax liability)
        if (calculatedReturnTax > 0) {
          const lineId = generateUUID();
          journalLines.push({
            id: lineId,
            accountId: taxPayableAccount,
            debit: calculatedReturnTax,
            credit: 0,
            notes: `Reverse Output VAT on Return [Invoice: ${invoice.invoice_number}]`,
          });
        }

        // Line 3: CREDIT Cash or Accounts Receivable (Refund outflow / AR credit)
        if (calculatedReturnNet > 0) {
          const lineId = generateUUID();
          journalLines.push({
            id: lineId,
            accountId: creditAccount,
            debit: 0,
            credit: calculatedReturnNet,
            notes:
              paymentMethod === 'CASH'
                ? `Cash Refund for Return ${returnNumber}`
                : `Credit Customer AR for Return ${returnNumber}`,
          });
        }

        // Strict Financial Double-Entry Invariant: sum(debits) === sum(credits)
        let totalDebit = 0;
        let totalCredit = 0;
        for (const line of journalLines) {
          totalDebit += line.debit;
          totalCredit += line.credit;
        }

        totalDebit = roundToTwo(totalDebit);
        totalCredit = roundToTwo(totalCredit);

        if (Math.abs(totalDebit - totalCredit) > 0.001) {
          throw new UnbalancedJournalEntryException(totalDebit, totalCredit);
        }

        // Insert Journal Lines
        const insertLineSql = `
          INSERT INTO journal_lines (
            id, entry_id, account_id, debit, credit, notes
          ) VALUES (?, ?, ?, ?, ?, ?);
        `;
        for (const line of journalLines) {
          await executeStatement(db, insertLineSql, [
            line.id,
            journalEntryId,
            line.accountId,
            line.debit,
            line.credit,
            line.notes,
          ]);
        }

        return {
          salesReturnId: returnDocId,
          returnNumber,
          originalInvoiceId: invoice.id,
          originalInvoiceNumber: invoice.invoice_number,
          customerId: invoice.customer_id,
          totalAmount: calculatedReturnTotal,
          taxAmount: calculatedReturnTax,
          netAmount: calculatedReturnNet,
          newInvoiceStatus,
          returnedItems: preparedReturnItems,
          journalEntry: {
            id: journalEntryId,
            entryNumber: journalNumber,
            referenceDocType: 'SALES_RETURN',
            referenceDocId: returnDocId,
            totalDebit,
            totalCredit,
            lines: journalLines,
          },
        };
      });
    } catch (error) {
      if (
        error instanceof InvoiceNotFoundException ||
        error instanceof InvoiceAlreadyReturnedException ||
        error instanceof InvalidReturnQuantityException ||
        error instanceof ItemNotInInvoiceException ||
        error instanceof ExcessiveReturnQuantityException ||
        error instanceof UnbalancedJournalEntryException
      ) {
        throw error;
      }
      throw new SalesReturnTransactionException(error);
    }
  }
}

// ----------------------------------------------------------------------------
// 6. CONVENIENCE FUNCTIONAL EXPORT
// ----------------------------------------------------------------------------

export async function processSalesReturn(
  db: SQLiteDatabase,
  params: ProcessReturnParams
): Promise<ReturnProcessResult> {
  return await SalesReturnService.processSalesReturn(db, params);
}

export default SalesReturnService;
