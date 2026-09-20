export type SequenceType = 
  | 'salesInvoice' 
  | 'purchaseInvoice' 
  | 'receiptVoucher' 
  | 'paymentVoucher' 
  | 'internalVoucher'
  | 'internalReceiptVoucher'
  | 'internalPaymentVoucher'
  | 'itemCode';

export const SEQUENCES_KEY = 'alpha_document_sequences_v3';
export const DAILY_SEQUENCES_KEY = 'alpha_daily_sequences_v1';
export const DEVICE_ID_KEY = 'alpha_device_id';

// Database storage keys in localStorage
export const DB_ITEMS_KEY = 'alpha_items_store_v1';
export const DB_SALES_INVOICES_KEY = 'alpha_sales_invoices_v1';
export const DB_PURCHASES_INVOICES_KEY = 'alpha_purchases_invoices_v1';
export const DB_RECEIPT_VOUCHERS_KEY = 'alpha_receipt_vouchers_v1';
export const DB_PAYMENT_VOUCHERS_KEY = 'alpha_payment_vouchers_v1';
export const DB_INTERNAL_VOUCHERS_KEY = 'alpha_internal_vouchers_v1';
export const DB_INTERNAL_RECEIPT_VOUCHERS_KEY = 'alpha_internal_receipt_vouchers_v1';
export const DB_INTERNAL_PAYMENT_VOUCHERS_KEY = 'alpha_internal_payment_vouchers_v1';

export interface SequencesStore {
  salesInvoice: number;
  purchaseInvoice: number;
  receiptVoucher: number;
  paymentVoucher: number;
  internalVoucher: number;
  internalReceiptVoucher: number;
  internalPaymentVoucher: number;
  itemCode: number;
}

export const DEFAULT_SEQUENCES: SequencesStore = {
  salesInvoice: 1,
  purchaseInvoice: 1,
  receiptVoucher: 1,
  paymentVoucher: 1,
  internalVoucher: 1,
  internalReceiptVoucher: 1,
  internalPaymentVoucher: 1,
  itemCode: 5, // Since default items are 1, 2, 3, 4
};

/**
 * Retrieves the currently active device identifier (e.g. 'MOB1', 'POS-01').
 * Cached synchronously in localStorage for instant render performance.
 */
export function getDeviceIdentifier(): string {
  if (typeof window === 'undefined') return 'MOB1';
  try {
    const direct = localStorage.getItem(DEVICE_ID_KEY);
    if (direct && direct.trim()) return direct.trim().toUpperCase();

    // Check system settings
    const sysRaw = localStorage.getItem('alpha_system_settings_v1');
    if (sysRaw) {
      const parsed = JSON.parse(sysRaw);
      if (parsed?.device?.deviceId) return String(parsed.device.deviceId).trim().toUpperCase();
    }

    // Check app settings table cached in localStorage
    const appSettingsRaw = localStorage.getItem('alpha_sqlite_app_settings');
    if (appSettingsRaw) {
      const parsed = JSON.parse(appSettingsRaw);
      if (parsed?.device_id) return String(parsed.device_id).trim().toUpperCase();
    }
  } catch {
    // fallback
  }
  return 'MOB1';
}

/**
 * Generates date components in YYMMDD format (e.g. 260916 for Sept 16, 2026).
 */
export function getCurrentDateSequenceKey(targetDate?: string | Date): { dateKey: string; yy: string; mm: string; dd: string } {
  const d = targetDate ? (typeof targetDate === 'string' ? new Date(targetDate) : targetDate) : new Date();
  const dateObj = isNaN(d.getTime()) ? new Date() : d;
  const yy = String(dateObj.getFullYear()).slice(-2);
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return {
    dateKey: `${yy}${mm}${dd}`,
    yy,
    mm,
    dd,
  };
}

/**
 * Extracts the trailing or largest numeric sequence from any string or code.
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
 * Reads the daily sequences mapping from localStorage (deviceId_docType_dateKey -> lastSeq)
 */
export function getDailySequences(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DAILY_SEQUENCES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Saves updated daily sequences to localStorage
 */
export function saveDailySequences(dailyMap: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DAILY_SEQUENCES_KEY, JSON.stringify(dailyMap));
    window.dispatchEvent(new CustomEvent('alpha-sequences-updated', { detail: dailyMap }));
  } catch (e) {
    console.error('Error saving daily sequences:', e);
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
      case 'internalReceiptVoucher':
        key = DB_INTERNAL_RECEIPT_VOUCHERS_KEY;
        extractor = (it) => String(it.voucherNumber || '');
        break;
      case 'internalPaymentVoucher':
        key = DB_INTERNAL_PAYMENT_VOUCHERS_KEY;
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
 * Resolves the appropriate prefix for a document type (e.g. 'INV', 'PO', 'REC', 'PAY', 'JRN')
 * by inspecting system settings or falling back to architecture standards.
 */
export function getSequencePrefix(type: SequenceType, _codes?: string[]): string {
  if (type === 'itemCode') return '';
  
  // 1. Check system settings in localStorage
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('alpha_system_settings_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.taxAndInvoice) {
          if (type === 'salesInvoice' && parsed.taxAndInvoice.salesPrefix) {
            return String(parsed.taxAndInvoice.salesPrefix).replace(/[-_#]+$/, '').trim();
          }
          if (type === 'purchaseInvoice' && parsed.taxAndInvoice.purchasePrefix) {
            return String(parsed.taxAndInvoice.purchasePrefix).replace(/[-_#]+$/, '').trim();
          }
          if (type === 'receiptVoucher' && parsed.taxAndInvoice.receiptVoucherPrefix) {
            return String(parsed.taxAndInvoice.receiptVoucherPrefix).replace(/[-_#]+$/, '').trim();
          }
          if (type === 'paymentVoucher' && parsed.taxAndInvoice.paymentVoucherPrefix) {
            return String(parsed.taxAndInvoice.paymentVoucherPrefix).replace(/[-_#]+$/, '').trim();
          }
          if (type === 'internalVoucher' && parsed.taxAndInvoice.journalPrefix) {
            return String(parsed.taxAndInvoice.journalPrefix).replace(/[-_#]+$/, '').trim();
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  // 2. Standard Document Type Prefixes
  switch (type) {
    case 'salesInvoice': return 'INV';
    case 'purchaseInvoice': return 'PO';
    case 'receiptVoucher': return 'REC';
    case 'paymentVoucher': return 'PAY';
    case 'internalVoucher': return 'JRN';
    case 'internalReceiptVoucher': return 'IRV';
    case 'internalPaymentVoucher': return 'IPV';
    default: return '';
  }
}

/**
 * Calculates the next unique sequence number guaranteed to be:
 * 1. Formatted according to the multi-platform distributed architecture:
 *    [PREFIX]-[DEVICE_ID]-[YYMMDD]-[SEQ] (e.g. INV-MOB1-260916-0001)
 * 2. Strictly greater than any existing document for today on this device node.
 * 3. Guaranteed collision-free across multiple offline-synced devices.
 */
export function getNextSequentialNumber(
  type: SequenceType,
  inMemoryRecords?: (string | number)[],
  options?: { date?: string | Date; deviceId?: string }
): { nextNumber: number; formatted: string } {
  const codes = inMemoryRecords !== undefined 
    ? inMemoryRecords.map(String).map(s => s.trim()).filter(Boolean)
    : getStoredDatabaseCodes(type);

  // 1. Items retain clean sequential numeric codes (e.g. 1, 2, 3...)
  if (type === 'itemCode') {
    const rawMax = getMaxNumberFromList(codes);
    const maxInExisting = typeof rawMax === 'number' && !isNaN(rawMax) && isFinite(rawMax) && rawMax >= 0 ? rawMax : 0;
    const rawCounter = getSequences().itemCode;
    const currentCounter = typeof rawCounter === 'number' && !isNaN(rawCounter) && isFinite(rawCounter) && rawCounter >= 1 ? rawCounter : 1;
    const candidate = Math.max(currentCounter, maxInExisting + 1, 1);
    return {
      nextNumber: candidate,
      formatted: candidate.toString(),
    };
  }

  // 2. Financial Documents: [PREFIX]-[DEVICE_ID]-[YYMMDD]-[SEQ]
  const prefix = getSequencePrefix(type, codes);
  const deviceId = (options?.deviceId || getDeviceIdentifier()).trim().toUpperCase() || 'MOB1';
  const { dateKey } = getCurrentDateSequenceKey(options?.date);

  // Scan existing codes for today's highest sequence matching this device & date
  let maxSeqToday = 0;
  const matchRegex = new RegExp(`^${prefix}[-_]${deviceId}[-_]${dateKey}[-_](\\d+)`, 'i');
  const genericMatchRegex = new RegExp(`^${prefix}[-_].*${dateKey}[-_](\\d+)`, 'i');

  for (const c of codes) {
    const match = c.match(matchRegex);
    if (match && match[1]) {
      const seqNum = parseInt(match[1], 10);
      if (!isNaN(seqNum) && seqNum > maxSeqToday) {
        maxSeqToday = seqNum;
      }
    } else {
      const gMatch = c.match(genericMatchRegex);
      if (gMatch && gMatch[1]) {
        const seqNum = parseInt(gMatch[1], 10);
        if (!isNaN(seqNum) && seqNum > maxSeqToday) {
          maxSeqToday = seqNum;
        }
      }
    }
  }

  // Check stored daily sequence counter
  const dailyMap = getDailySequences();
  const dailyKey = `${deviceId}_${type}_${dateKey}`;
  const prefixDailyKey = `${deviceId}_${prefix}_${dateKey}`;
  const storedDailySeq = Math.max(dailyMap[dailyKey] || 0, dailyMap[prefixDailyKey] || 0);

  let candidateSeq = Math.max(maxSeqToday + 1, storedDailySeq + 1, 1);
  let seqPadded = candidateSeq < 10000 ? String(candidateSeq).padStart(4, '0') : String(candidateSeq);
  let formatted = `${prefix}-${deviceId}-${dateKey}-${seqPadded}`;

  // Collision Safety: If candidate or formatted string exists, increment until strictly unique
  const existingSet = new Set(codes.map(c => String(c).trim().toLowerCase()));
  let safetyLoop = 0;
  while (existingSet.has(formatted.toLowerCase()) && safetyLoop < 5000) {
    candidateSeq++;
    seqPadded = candidateSeq < 10000 ? String(candidateSeq).padStart(4, '0') : String(candidateSeq);
    formatted = `${prefix}-${deviceId}-${dateKey}-${seqPadded}`;
    safetyLoop++;
  }

  return {
    nextNumber: candidateSeq,
    formatted,
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
  if (type === 'itemCode') {
    const usedNum = extractTrailingNumber(usedNumberOrCode);
    const seqs = getSequences();
    const current = seqs.itemCode || 1;
    const nextSeq = Math.max(usedNum + 1, current + 1);
    seqs.itemCode = nextSeq;
    saveSequences(seqs);
    return nextSeq;
  }

  // Financial Documents
  const prefix = getSequencePrefix(type);
  const deviceId = getDeviceIdentifier();
  const { dateKey } = getCurrentDateSequenceKey();

  const usedStr = String(usedNumberOrCode).trim();
  const match = usedStr.match(new RegExp(`[-_](\\d+)$`));
  const usedSeq = match && match[1] ? parseInt(match[1], 10) : extractTrailingNumber(usedStr);

  const dailyMap = getDailySequences();
  const dailyKey = `${deviceId}_${type}_${dateKey}`;
  const prefixDailyKey = `${deviceId}_${prefix}_${dateKey}`;

  const current = Math.max(dailyMap[dailyKey] || 0, dailyMap[prefixDailyKey] || 0);
  const nextSeq = Math.max(usedSeq, current + 1, 1);

  dailyMap[dailyKey] = nextSeq;
  dailyMap[prefixDailyKey] = nextSeq;
  saveDailySequences(dailyMap);

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
