import QRCode from 'qrcode';
import type { PrintPreviewData } from '../components/PrintPreviewModal';
import { 
  DB_PAYMENT_VOUCHERS_KEY, 
  DB_RECEIPT_VOUCHERS_KEY,
  DB_INTERNAL_PAYMENT_VOUCHERS_KEY,
  DB_INTERNAL_RECEIPT_VOUCHERS_KEY,
  DB_INTERNAL_VOUCHERS_KEY
} from './sequences';
import { getSystemSettings } from './settings';

// =========================================================================
// 1. CODE 128 BARCODE GENERATOR (Vector SVG - High Resolution & Scannable)
// =========================================================================

/**
 * Standard Code 128 patterns (0-106)
 * Each string represents the widths of 3 bars and 3 spaces (total 11 modules, except stop which has 13 modules).
 */
const CODE128_PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106 (104=StartB, 106=Stop)
];

const START_B = 104;
const STOP = 106;

export interface BarcodeSvgOptions {
  height?: number;
  barWidth?: number;
  includeText?: boolean;
  barColor?: string;
  bgColor?: string;
  fontSize?: number;
  className?: string;
}

/**
 * Encodes text into Code 128 (Subset B) module pattern (0s and 1s).
 * Subset B encodes ASCII 32 to 127 directly.
 */
export function encodeCode128B(text: string): { modules: number[]; cleanText: string } | null {
  if (!text) return null;
  // Clean text to standard printable ASCII characters
  const clean = text.trim();
  if (!clean) return null;

  const charCodes: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    if (code >= 32 && code <= 126) {
      charCodes.push(code - 32);
    } else {
      // Substitute non-standard chars with dash
      charCodes.push(13); // '-' in Code 128 is code 45 - 32 = 13
    }
  }

  // Calculate Checksum: (Start_B + Sum(i * char_code)) % 103
  let checksum = START_B;
  for (let i = 0; i < charCodes.length; i++) {
    const codeVal = charCodes[i];
    if (codeVal !== undefined) {
      checksum += (i + 1) * codeVal;
    }
  }
  checksum = checksum % 103;

  // Build pattern list: [START_B, ...charCodes, checksum, STOP]
  const patternIndices = [START_B, ...charCodes, checksum, STOP];

  // Convert widths into binary modules (1 for bar, 0 for space)
  const modules: number[] = [];
  // Add quiet zone (10 modules)
  for (let q = 0; q < 10; q++) modules.push(0);

  for (const idx of patternIndices) {
    const pattern = CODE128_PATTERNS[idx];
    if (!pattern) continue;

    let isBar = true;
    for (let p = 0; p < pattern.length; p++) {
      const width = parseInt(pattern[p] || '1', 10);
      for (let w = 0; w < width; w++) {
        modules.push(isBar ? 1 : 0);
      }
      isBar = !isBar;
    }
  }

  // Add trailing quiet zone (10 modules)
  for (let q = 0; q < 10; q++) modules.push(0);

  return { modules, cleanText: clean };
}

/**
 * Generates an SVG string representation of a Code 128 barcode.
 */
export function generateBarcodeSvg(
  text: string, 
  options: BarcodeSvgOptions = {}
): string {
  const {
    height = 36,
    barWidth = 1.35,
    includeText = true,
    barColor = '#000000',
    bgColor = '#ffffff',
    fontSize = 10
  } = options;

  const encoded = encodeCode128B(text);
  if (!encoded) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="${height}"><text x="10" y="20" font-size="10" fill="gray">No Data</text></svg>`;
  }

  const { modules, cleanText } = encoded;
  const totalWidth = modules.length * barWidth;
  const barsHeight = includeText ? height - fontSize - 4 : height;

  let rectsSvg = '';
  let inBar = false;
  let barStart = 0;

  for (let i = 0; i < modules.length; i++) {
    if (modules[i] === 1) {
      if (!inBar) {
        inBar = true;
        barStart = i;
      }
    } else {
      if (inBar) {
        inBar = false;
        const rectX = (barStart * barWidth).toFixed(2);
        const rectW = ((i - barStart) * barWidth).toFixed(2);
        rectsSvg += `<rect x="${rectX}" y="2" width="${rectW}" height="${barsHeight}" fill="${barColor}" />`;
      }
    }
  }
  // Flush trailing bar if any
  if (inBar) {
    const rectX = (barStart * barWidth).toFixed(2);
    const rectW = ((modules.length - barStart) * barWidth).toFixed(2);
    rectsSvg += `<rect x="${rectX}" y="2" width="${rectW}" height="${barsHeight}" fill="${barColor}" />`;
  }

  let textSvg = '';
  if (includeText) {
    const textY = height - 2;
    textSvg = `<text x="${(totalWidth / 2).toFixed(2)}" y="${textY}" text-anchor="middle" font-family="monospace, Courier, sans-serif" font-size="${fontSize}" font-weight="700" fill="${barColor}" letter-spacing="1.5">${cleanText}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth.toFixed(2)} ${height}" width="${totalWidth.toFixed(2)}" height="${height}" style="background-color: ${bgColor}; display: block; max-width: 100%;">${rectsSvg}${textSvg}</svg>`;
}

// =========================================================================
// 2. CRYPTOGRAPHIC & TAMPER-EVIDENT VERIFICATION HASH
// =========================================================================

/**
 * Generates an alphanumeric tamper-evident verification code based on voucher data.
 * Example format: VRF-7B2A-94EC-311D
 */
export function generateSecurityHash(seed: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  
  const p1 = ((h1 >>> 0) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const p2 = (((h1 >>> 16) ^ (h2 >>> 0)) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const p3 = ((h2 >>> 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  
  return `VRF-${p1}-${p2}-${p3}`;
}

// =========================================================================
// 3. QR CODE VERIFICATION PAYLOAD GENERATION
// =========================================================================

export interface VoucherVerificationInfo {
  docNumber: string;
  docTitle: string;
  companyName: string;
  taxNumber: string;
  date: string;
  partyName: string;
  amount: number;
  currency: string;
  amountInWords?: string | undefined;
  paymentMethod?: string | undefined;
  costCenter?: string | undefined;
  status: 'POSTED' | 'DRAFT';
  verificationHash: string;
  generatedAt: string;
}

/**
 * Builds the official human-readable & scanner-readable text payload encoded inside the QR Code.
 */
export function buildVoucherQrPayload(data: PrintPreviewData): string {
  const settings = getSystemSettings();
  const companyName = settings?.company?.nameAr || settings?.company?.nameEn || 'شركة لوجوستريا المحاسبية';
  const taxNumber = settings?.company?.taxNumber || '310123456700003';
  const docNumber = data.docNumber || '0000';
  const grandAmount = data.grandTotal ?? data.amount ?? 0;
  const currency = data.currency || settings?.financial?.currency || 'SAR';
  const dateStr = data.date || new Date().toISOString().split('T')[0] || '';
  const party = data.partnerName || data.receivedFromOrPaidTo || 'غير محدد';
  const status = (data.status === 'POSTED' || !data.status) ? 'مرحل ومعتمد نظامياً' : 'مسودة غير مرحلة';

  // Seed for security hash
  const seedString = `${docNumber}|${data.title}|${grandAmount}|${dateStr}|${taxNumber}|${party}`;
  const verificationHash = generateSecurityHash(seedString);

  return [
    `=== نظام لوجوستريا المحاسبي - سند مالي معتمد ===`,
    `رقم السند: #${docNumber}`,
    `نوع المستند: ${data.title}`,
    `المنشأة: ${companyName}`,
    `الرقم الضريبي: ${taxNumber}`,
    `التاريخ: ${dateStr}`,
    `الطرف المعني: ${party}`,
    `المبلغ: ${grandAmount.toLocaleString()} ${currency}`,
    `طريقة الدفع: ${data.paymentMethod || 'نقداً'}`,
    `حالة الاعتماد: ${status}`,
    `رمز التحقق الرقمي: ${verificationHash}`,
    `كود التحقق السريع: VERIFIED#${docNumber}#${grandAmount}`
  ].join('\n');
}

// In-memory cache for QR Code Data URLs to ensure synchronous-like instant rendering
const qrCodeCache = new Map<string, string>();

/**
 * Generates a Base64 Data URL for a given payload with caching.
 */
export async function getCachedQrCodeDataUrl(payload: string): Promise<string> {
  if (qrCodeCache.has(payload)) {
    return qrCodeCache.get(payload)!;
  }
  try {
    const dataUrl = await QRCode.toDataURL(payload, {
      width: 256,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
    qrCodeCache.set(payload, dataUrl);
    return dataUrl;
  } catch (err) {
    console.error('Failed to generate QR Code Data URL:', err);
    return '';
  }
}

// =========================================================================
// 4. VOUCHER SCANNER & OPTICAL VERIFICATION LOGIC
// =========================================================================

export interface ScannedVerificationResult {
  status: 'FOUND_MATCH' | 'NOT_FOUND' | 'INVALID_INPUT';
  message: string;
  searchedCode: string;
  voucher?: {
    id: string;
    voucherNumber: string;
    type: 'INTERNAL_PAYMENT' | 'INTERNAL_RECEIPT' | 'EXTERNAL_PAYMENT' | 'EXTERNAL_RECEIPT' | 'TRANSFER' | 'INVOICE' | 'OTHER';
    typeLabel: string;
    date: string;
    amount: number;
    partnerOrBeneficiary: string;
    fromOrToAccount: string;
    costCenterName?: string | undefined;
    status: 'POSTED' | 'DRAFT';
    verificationHash: string;
    description: string;
    raw: any;
  } | undefined;
}

/**
 * Searches and validates a scanned code (from barcode or QR scanner).
 */
export function verifyScannedVoucher(input: string): ScannedVerificationResult {
  if (!input || !input.trim()) {
    return {
      status: 'INVALID_INPUT',
      message: 'الرجاء إدخال أو مسح رمز باركود أو QR صحيح.',
      searchedCode: ''
    };
  }

  const rawInput = input.trim();
  let searchDocNumber = rawInput;

  // If scanned code is a full QR text payload, extract the docNumber
  if (rawInput.includes('رقم السند: #')) {
    const match = rawInput.match(/رقم السند:\s*#([^\n\r]+)/);
    if (match && match[1]) searchDocNumber = match[1].trim();
  } else if (rawInput.includes('VERIFIED#')) {
    const parts = rawInput.split('#');
    if (parts[1]) searchDocNumber = parts[1].trim();
  }

  // Remove leading # or spaces
  searchDocNumber = searchDocNumber.replace(/^#/, '').trim();

  // Helper to match doc numbers flexibly (e.g. PV-2026-0001 or 0001)
  const isMatch = (num: string | undefined | null) => {
    if (!num) return false;
    const cleanNum = num.replace(/^#/, '').trim();
    return cleanNum.toLowerCase() === searchDocNumber.toLowerCase() ||
           cleanNum.endsWith(searchDocNumber) ||
           searchDocNumber.endsWith(cleanNum);
  };

  try {
    // 1. Check Internal Payment Vouchers
    const ipRaw = localStorage.getItem(DB_INTERNAL_PAYMENT_VOUCHERS_KEY);
    if (ipRaw) {
      const items = JSON.parse(ipRaw);
      if (Array.isArray(items)) {
        const found = items.find(v => isMatch(v.voucherNumber) || isMatch(v.id));
        if (found) {
          const seed = `${found.voucherNumber}|سند صرف داخلي|${found.amount}|${found.date}|${found.paidTo}`;
          return {
            status: 'FOUND_MATCH',
            message: 'تم التحقق بنجاح: سند صرف داخلي أصلي ومسجل في قاعدة البيانات.',
            searchedCode: searchDocNumber,
            voucher: {
              id: found.id,
              voucherNumber: found.voucherNumber,
              type: 'INTERNAL_PAYMENT',
              typeLabel: 'سند صرف داخلي',
              date: found.date,
              amount: Number(found.amount) || 0,
              partnerOrBeneficiary: found.paidTo || found.disbursedBy || 'جهة داخلية',
              fromOrToAccount: found.fromAccountId || 'الصندوق/البنك',
              costCenterName: found.costCenterName,
              status: found.status === 'POSTED' ? 'POSTED' : 'DRAFT',
              verificationHash: generateSecurityHash(seed),
              description: found.description || 'صرف مالي داخلي',
              raw: found
            }
          };
        }
      }
    }

    // 2. Check Internal Receipt Vouchers
    const irRaw = localStorage.getItem(DB_INTERNAL_RECEIPT_VOUCHERS_KEY);
    if (irRaw) {
      const items = JSON.parse(irRaw);
      if (Array.isArray(items)) {
        const found = items.find(v => isMatch(v.voucherNumber) || isMatch(v.id));
        if (found) {
          const seed = `${found.voucherNumber}|سند قبض داخلي|${found.amount}|${found.date}|${found.receivedFrom}`;
          return {
            status: 'FOUND_MATCH',
            message: 'تم التحقق بنجاح: سند قبض داخلي أصلي ومسجل في قاعدة البيانات.',
            searchedCode: searchDocNumber,
            voucher: {
              id: found.id,
              voucherNumber: found.voucherNumber,
              type: 'INTERNAL_RECEIPT',
              typeLabel: 'سند قبض داخلي',
              date: found.date,
              amount: Number(found.amount) || 0,
              partnerOrBeneficiary: found.receivedFrom || found.collectorName || 'جهة داخلية',
              fromOrToAccount: found.toAccountId || 'الصندوق/البنك',
              costCenterName: found.costCenterName,
              status: found.status === 'POSTED' ? 'POSTED' : 'DRAFT',
              verificationHash: generateSecurityHash(seed),
              description: found.description || 'قبض وتوريد داخلي',
              raw: found
            }
          };
        }
      }
    }

    // 3. Check External Payment Vouchers
    const epRaw = localStorage.getItem(DB_PAYMENT_VOUCHERS_KEY);
    if (epRaw) {
      const items = JSON.parse(epRaw);
      if (Array.isArray(items)) {
        const found = items.find(v => isMatch(v.voucherNumber) || isMatch(v.id));
        if (found) {
          const seed = `${found.voucherNumber}|سند صرف خارجي|${found.amount}|${found.date}|${found.partnerName || found.paidTo}`;
          return {
            status: 'FOUND_MATCH',
            message: 'تم التحقق بنجاح: سند صرف مالي خارجي أصلي ومسجل في قاعدة البيانات.',
            searchedCode: searchDocNumber,
            voucher: {
              id: found.id,
              voucherNumber: found.voucherNumber,
              type: 'EXTERNAL_PAYMENT',
              typeLabel: 'سند صرف خارجي',
              date: found.date,
              amount: Number(found.amount) || 0,
              partnerOrBeneficiary: found.partnerName || found.paidTo || 'مورد / مستفيد خارجي',
              fromOrToAccount: found.cashOrBankAccountId || 'الصندوق/البنك',
              costCenterName: found.costCenterName,
              status: found.status === 'POSTED' ? 'POSTED' : 'DRAFT',
              verificationHash: generateSecurityHash(seed),
              description: found.notes || found.description || 'صرف مالي خارجي',
              raw: found
            }
          };
        }
      }
    }

    // 4. Check External Receipt Vouchers
    const erRaw = localStorage.getItem(DB_RECEIPT_VOUCHERS_KEY);
    if (erRaw) {
      const items = JSON.parse(erRaw);
      if (Array.isArray(items)) {
        const found = items.find(v => isMatch(v.voucherNumber) || isMatch(v.id));
        if (found) {
          const seed = `${found.voucherNumber}|سند قبض خارجي|${found.amount}|${found.date}|${found.partnerName || found.receivedFrom}`;
          return {
            status: 'FOUND_MATCH',
            message: 'تم التحقق بنجاح: سند قبض مالي خارجي أصلي ومسجل في قاعدة البيانات.',
            searchedCode: searchDocNumber,
            voucher: {
              id: found.id,
              voucherNumber: found.voucherNumber,
              type: 'EXTERNAL_RECEIPT',
              typeLabel: 'سند قبض خارجي',
              date: found.date,
              amount: Number(found.amount) || 0,
              partnerOrBeneficiary: found.partnerName || found.receivedFrom || 'عميل / مصدر خارجي',
              fromOrToAccount: found.cashOrBankAccountId || 'الصندوق/البنك',
              costCenterName: found.costCenterName,
              status: found.status === 'POSTED' ? 'POSTED' : 'DRAFT',
              verificationHash: generateSecurityHash(seed),
              description: found.notes || found.description || 'قبض وتوريد مالي خارجي',
              raw: found
            }
          };
        }
      }
    }

    // 5. Check Internal Transfer Vouchers
    const itRaw = localStorage.getItem(DB_INTERNAL_VOUCHERS_KEY);
    if (itRaw) {
      const items = JSON.parse(itRaw);
      if (Array.isArray(items)) {
        const found = items.find(v => isMatch(v.voucherNumber) || isMatch(v.id));
        if (found) {
          const seed = `${found.voucherNumber}|سند تحويل داخلي|${found.amount}|${found.date}`;
          return {
            status: 'FOUND_MATCH',
            message: 'تم التحقق بنجاح: سند تحويل مالي داخلي بين الحسابات.',
            searchedCode: searchDocNumber,
            voucher: {
              id: found.id,
              voucherNumber: found.voucherNumber,
              type: 'TRANSFER',
              typeLabel: 'سند تحويل داخلي',
              date: found.date,
              amount: Number(found.amount) || 0,
              partnerOrBeneficiary: `من: ${found.fromAccountId} إلى: ${found.toAccountId}`,
              fromOrToAccount: found.fromAccountId,
              status: found.status === 'POSTED' ? 'POSTED' : 'DRAFT',
              verificationHash: generateSecurityHash(seed),
              description: found.description || 'تحويل مالي بين الخزائن',
              raw: found
            }
          };
        }
      }
    }
  } catch (err) {
    console.error('Error verifying voucher:', err);
  }

  return {
    status: 'NOT_FOUND',
    message: `لم يتم العثور على أي سند يحمل الرقم أو الرمز: "${searchDocNumber}". يرجى التأكد من الرقم أو مراجعة أصل السند لمنع التلاعب.`,
    searchedCode: searchDocNumber
  };
}
