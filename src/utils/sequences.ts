export type SequenceType = 
  | 'salesInvoice' 
  | 'purchaseInvoice' 
  | 'receiptVoucher' 
  | 'paymentVoucher' 
  | 'internalVoucher'
  | 'itemCode';

export const SEQUENCES_KEY = 'alpha_document_sequences_v3';

// Database storage keys in localStorage
export const DB_ITEMS_KEY = 'alpha_items_store_v1';
export const DB_SALES_INVOICES_KEY = 'alpha_sales_invoices_v1';
export const DB_PURCHASES_INVOICES_KEY = 'alpha_purchases_invoices_v1';
export const DB_RECEIPT_VOUCHERS_KEY = 'alpha_receipt_vouchers_v1';
export const DB_PAYMENT_VOUCHERS_KEY = 'alpha_payment_vouchers_v1';
export const DB_INTERNAL_VOUCHERS_KEY = 'alpha_internal_vouchers_v1';

export interface SequencesStore {
  salesInvoice: number;
  purchaseInvoice: number;
  receiptVoucher: number;
  paymentVoucher: number;
  internalVoucher: number;
  itemCode: number;
}

export const DEFAULT_SEQUENCES: SequencesStore = {
  salesInvoice: 1,
  purchaseInvoice: 1,
  receiptVoucher: 1,
  paymentVoucher: 1,
  internalVoucher: 1,
  itemCode: 5, // Since default items are 1, 2, 3, 4
};

/**
 * Extracts the trailing or largest numeric sequence from any string or code.
 * Examples:
 *  "12" -> 12
 *  "ITM-005" -> 5
 *  "INV-2024-0014" -> 14
 *  "PO-105" -> 105
 */
export function extractTrailingNumber(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const clean = String(val).trim();
  if (!clean) return 0;
  
  if (/^\d+$/.test(clean)) {
    return parseInt(clean, 10);
  }
  
  // Find the last contiguous group of digits in the string
  const match = clean.match(/(\d+)(?!.*\d)/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  
  const allDigits = clean.replace(/\D/g, '');
  return allDigits ? parseInt(allDigits, 10) : 0;
}

/**
 * Reads the current saved sequence numbers from localStorage.
 */
export function getSequences(): SequencesStore {
  if (typeof window === 'undefined') return DEFAULT_SEQUENCES;
  try {
    const raw = localStorage.getItem(SEQUENCES_KEY);
    if (!raw) return DEFAULT_SEQUENCES;
    return { ...DEFAULT_SEQUENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SEQUENCES;
  }
}

/**
 * Saves updated sequences to localStorage and notifies listeners.
 */
export function saveSequences(seqs: SequencesStore): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SEQUENCES_KEY, JSON.stringify(seqs));
    window.dispatchEvent(new CustomEvent('alpha-sequences-updated', { detail: seqs }));
  } catch (e) {
    console.error('Error saving sequences:', e);
  }
}

/**
 * Reads existing records of a specific document type from localStorage database.
 */
export function getStoredDatabaseCodes(type: SequenceType): string[] {
  if (typeof window === 'undefined') return [];
  try {
    let key = '';
    let extractor: (item: any) => string = () => '';

    switch (type) {
      case 'itemCode':
        key = DB_ITEMS_KEY;
        extractor = (it) => String(it.code || '');
        break;
      case 'salesInvoice':
        key = DB_SALES_INVOICES_KEY;
        extractor = (it) => String(it.invoiceNumber || '');
        break;
      case 'purchaseInvoice':
        key = DB_PURCHASES_INVOICES_KEY;
        extractor = (it) => String(it.invoiceNumber || '');
        break;
      case 'receiptVoucher':
        key = DB_RECEIPT_VOUCHERS_KEY;
        extractor = (it) => String(it.voucherNumber || '');
        break;
      case 'paymentVoucher':
        key = DB_PAYMENT_VOUCHERS_KEY;
        extractor = (it) => String(it.voucherNumber || '');
        break;
      case 'internalVoucher':
        key = DB_INTERNAL_VOUCHERS_KEY;
        extractor = (it) => String(it.voucherNumber || '');
        break;
    }

    if (!key) return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(extractor).map(s => s.trim()).filter(Boolean);
  } catch (e) {
    console.error(`Error reading database records for ${type}:`, e);
    return [];
  }
}

/**
 * Computes the maximum numeric value across a list of codes or document numbers.
 */
export function getMaxNumberFromList(list: (string | number)[]): number {
  if (!list || list.length === 0) return 0;
  let max = 0;
  for (const item of list) {
    const num = extractTrailingNumber(item);
    if (num > max) {
      max = num;
    }
  }
  return max;
}

/**
 * Calculates the next unique sequence number guaranteed to be:
 * 1. Strictly greater than the highest number in existing records
 * 2. Greater than or equal to the sequence counter store
 * 3. Never colliding with any existing record
 */
export function getNextSequentialNumber(
  type: SequenceType,
  inMemoryRecords?: (string | number)[]
): { nextNumber: number; formatted: string } {
  const codes = inMemoryRecords !== undefined 
    ? inMemoryRecords.map(String).map(s => s.trim()).filter(Boolean)
    : getStoredDatabaseCodes(type);

  const rawMax = getMaxNumberFromList(codes);
  const maxInExisting = typeof rawMax === 'number' && !isNaN(rawMax) && isFinite(rawMax) && rawMax >= 0 ? rawMax : 0;
  
  const rawCounter = getSequences()[type];
  const currentCounter = typeof rawCounter === 'number' && !isNaN(rawCounter) && isFinite(rawCounter) && rawCounter >= 1 ? rawCounter : 1;

  // The next number MUST be strictly greater than any existing record in database
  const rawCandidate = Math.max(currentCounter, maxInExisting + 1);
  let candidate = isFinite(rawCandidate) && !isNaN(rawCandidate) && rawCandidate >= 1 ? Math.floor(rawCandidate) : 1;

  // If candidate happens to match an existing code, increment until unique (with safety guard)
  const existingSet = new Set(codes.map(c => String(c).trim().toLowerCase()));
  let safetyLoop = 0;
  while (existingSet.has(String(candidate).toLowerCase()) && safetyLoop < 5000) {
    candidate++;
    safetyLoop++;
  }

  return {
    nextNumber: candidate,
    formatted: candidate.toString(),
  };
}

/**
 * Checks if a specific number or code already exists in database or memory.
 */
export function isCodeOrNumberDuplicated(
  val: string | number,
  type: SequenceType,
  inMemoryRecords?: (string | number)[]
): boolean {
  if (val === undefined || val === null) return false;
  const target = String(val).trim().toLowerCase();
  if (!target) return false;

  const recordsToCheck = inMemoryRecords !== undefined 
    ? inMemoryRecords 
    : getStoredDatabaseCodes(type);

  return recordsToCheck.some(item => {
    if (item === undefined || item === null) return false;
    const cleanItem = String(item).trim().toLowerCase();
    return cleanItem.length > 0 && cleanItem === target;
  });
}

/**
 * Advances the sequence counter when a document is saved, ensuring the counter
 * moves past the saved number to guarantee subsequent auto-increments don't duplicate.
 */
export function advanceSequenceAfterSave(
  type: SequenceType,
  usedNumberOrCode: string | number
): number {
  const usedNum = extractTrailingNumber(usedNumberOrCode);
  const seqs = getSequences();
  const current = seqs[type] || 1;

  const nextSeq = Math.max(usedNum + 1, current + 1);
  seqs[type] = nextSeq;
  saveSequences(seqs);
  return nextSeq;
}

/**
 * Synchronizes all sequence counters with the actual highest numbers
 * present in database records across all modules.
 */
export function syncSequencesWithDatabase(): SequencesStore {
  const seqs = getSequences();
  const types: SequenceType[] = [
    'salesInvoice',
    'purchaseInvoice',
    'receiptVoucher',
    'paymentVoucher',
    'internalVoucher',
    'itemCode',
  ];

  for (const t of types) {
    const dbCodes = getStoredDatabaseCodes(t);
    const maxInDb = getMaxNumberFromList(dbCodes);
    seqs[t] = Math.max(seqs[t] || 1, maxInDb + 1);
  }

  saveSequences(seqs);
  return seqs;
}

/**
 * Legacy support for getCurrentSequence and advanceSequence
 */
export function getCurrentSequence(type: SequenceType): number {
  return getNextSequentialNumber(type).nextNumber;
}

export function advanceSequence(type: SequenceType): number {
  const seqs = getSequences();
  const current = getNextSequentialNumber(type).nextNumber;
  seqs[type] = current + 1;
  saveSequences(seqs);
  return current;
}

export function setCustomSequence(type: SequenceType, val: number): void {
  const seqs = getSequences();
  seqs[type] = Math.max(1, val);
  saveSequences(seqs);
}
