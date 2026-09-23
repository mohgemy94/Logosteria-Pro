/**
 * Smart Arabic & English Voice Command Parser for ERP Actions & Instant Financial Q&A
 * 
 * 1. Intent Recognition for ERP Actions:
 * - Create Sales Invoice (with customer, items, quantities, prices)
 * - Create Purchase Invoice (with vendor, items, quantities)
 * - Create Receipt Voucher (with partner, amount, payment method)
 * - Create Payment Voucher (with partner, amount, payment method)
 * - Create Journal Entry (with accounts, amounts, description)
 * 
 * 2. Instant Financial Voice Q&A (الميزة الثانية):
 * - Partner Balance Query (e.g. "كم رصيد العميل محمد أحمد؟", "رصيد المورد شركة النور")
 * - Sales Analytics Query (e.g. "كم مبيعات اليوم؟", "إجمالي مبيعات الشهر", "كم فواتير المبيعات؟")
 * - Treasury & Cash Balance Query (e.g. "كم رصيد الصندوق؟", "رصيد الخزينة", "رصيد البنك الأهلي", "كم رصيد الراجحي؟")
 * - Low Stock / Inventory Alert Query (e.g. "ما هي الأصناف التي أوشكت على النفاد؟", "أصناف ناقصة", "أصناف قربت تخلص")
 */

import { Account } from '../types/accounting';
import { Partner } from '../types/accounting';
import { Item } from './itemsStore';
import { getPartnerAccountStatement, StoredSalesInvoiceRecord, StoredPurchaseInvoiceRecord, StoredVoucherRecord } from './partnerLedger';
import { calculateTrialBalance } from './trialBalanceStore';

export type VoiceActionType = 
  | 'CREATE_SALES_INVOICE'
  | 'CREATE_PURCHASE_INVOICE'
  | 'CREATE_RECEIPT_VOUCHER'
  | 'CREATE_PAYMENT_VOUCHER'
  | 'CREATE_JOURNAL_ENTRY'
  | 'NAVIGATE'
  | 'SEARCH';

export interface ParsedVoiceAction {
  type: VoiceActionType;
  confidence: number;
  labelAr: string;
  labelEn: string;
  targetView: string;
  summary: string;
  payload: {
    partner?: Partner | null | undefined;
    partnerName?: string | undefined;
    partnerType?: 'CUSTOMER' | 'VENDOR' | undefined;
    amount?: number | undefined;
    paymentMethod?: 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK' | 'CREDIT' | undefined;
    description?: string | undefined;
    items?: Array<{
      item?: Item | null | undefined;
      name: string;
      quantity: number;
      unitPrice?: number | undefined;
    }> | undefined;
    accountDebit?: Account | null | undefined;
    accountCredit?: Account | null | undefined;
    debitAmount?: number | undefined;
    creditAmount?: number | undefined;
  };
}

export type FinancialQAType = 
  | 'PARTNER_BALANCE'
  | 'TODAY_SALES'
  | 'TREASURY_BALANCE'
  | 'LOW_STOCK'
  | 'TOTAL_CUSTOMERS_DEBT'
  | 'TOTAL_VENDORS_CREDIT';

export interface FinancialQAResult {
  type: FinancialQAType;
  question: string;
  answerText: string;
  spokenText: string;
  primaryValue: string;
  secondaryValue?: string;
  statusBadge?: {
    text: string;
    color: 'emerald' | 'amber' | 'rose' | 'blue' | 'purple';
  };
  navigationView?: string;
  navigationLabel?: string;
  details?: Array<{ label: string; value: string }>;
}

/**
 * Normalizes Arabic text (removes tashkeel, standardizes alef, taa marbouta, etc.)
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\s\t\n]+/g, ' ');
}

/**
 * Extracts numbers from text (both western 123 and eastern numerals ١٢٣ as well as written Arabic words)
 */
export function extractAmountFromText(text: string): number | null {
  if (!text) return null;

  // Replace eastern arabic numerals
  const easternToArabic = text.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());

  // Direct digits match (e.g. 5000, 1250.50)
  const digitMatch = easternToArabic.match(/(\d+([\.,]\d+)?)/);
  if (digitMatch && digitMatch[1]) {
    const num = parseFloat(digitMatch[1].replace(',', '.'));
    if (!isNaN(num) && num > 0) return num;
  }

  // Written Arabic numbers mapping
  const normalized = normalizeArabicText(text);
  let computed = 0;
  let found = false;

  const numberMap: Record<string, number> = {
    'الف': 1000,
    'الفين': 2000,
    'الاف': 1000,
    'مائه': 100,
    'مائتين': 200,
    'ميه': 100,
    'ثلاثمائه': 300,
    'اربعمائه': 400,
    'خمسمائه': 500,
    'ستمائه': 600,
    'سبعمائه': 700,
    'ثمانمائه': 800,
    'تسعمائه': 900,
    'واحد': 1,
    'اثنان': 2,
    'اثنين': 2,
    'ثلاثه': 3,
    'اربعه': 4,
    'خمسه': 5,
    'سته': 6,
    'سبعه': 7,
    'ثمانيه': 8,
    'تسعه': 9,
    'عشره': 10,
    'عشرين': 20,
    'ثلاثين': 30,
    'اربعين': 40,
    'خمسين': 50,
    'ستين': 60,
    'سبعين': 70,
    'ثمانين': 80,
    'تسعين': 90,
    'مليون': 1000000
  };

  const words = normalized.split(/\s+/);
  for (const w of words) {
    if (numberMap[w]) {
      computed += numberMap[w];
      found = true;
    }
  }

  return found && computed > 0 ? computed : null;
}

/**
 * Intelligent parser to extract items, quantities, and prices from voice phrases
 * e.g. "اضف 5 حبات كيبورد بسعر 120 و 2 ماوس لاسلكي بسعر 45"
 * e.g. "3 شاشات سامسونج بسعر 850"
 */
export function parseVoiceItemsFromText(
  text: string, 
  availableCatalog: Item[] = []
): Array<{ item?: Item | null; name: string; quantity: number; unitPrice?: number }> {
  if (!text || !text.trim()) return [];

  const raw = text.trim();
  const norm = normalizeArabicText(raw);

  // Split by item conjunctions: " و " or " ثم " or " مع " or commas
  const clauses = raw.split(/\s+(?:و|ثم|مع|\+|,|،)\s+/);
  const results: Array<{ item?: Item | null; name: string; quantity: number; unitPrice?: number }> = [];

  for (const clause of clauses) {
    if (!clause.trim()) continue;
    const clauseNorm = normalizeArabicText(clause);

    // Try finding matching catalog item
    let matchedItem: Item | null = null;
    let longestMatchLen = 0;

    for (const catItem of availableCatalog) {
      const catNorm = normalizeArabicText(catItem.name);
      if (catNorm && clauseNorm.includes(catNorm)) {
        if (catNorm.length > longestMatchLen) {
          longestMatchLen = catNorm.length;
          matchedItem = catItem;
        }
      }
    }

    // Try extracting quantity (patterns like "5 حبات", "عدد 3", "10 قطع", "5", "كرتونين", "حبتين", "قطعتين")
    let quantity = 1;
    if (clauseNorm.includes('حبتين') || clauseNorm.includes('قطعتين') || clauseNorm.includes('كرتونين') || clauseNorm.includes('جهازين') || clauseNorm.includes('علبتين')) {
      quantity = 2;
    } else {
      const qtyMatch = clause.match(/(?:عدد|كميه|كمية)?\s*(\d+)\s*(?:حبه|حبة|حبات|قطع|قطعه|قطعة|كرتون|كراتين|دستة|بكت|طرد|جهاز|أجهزة|اجهزه)?/);
      if (qtyMatch && qtyMatch[1]) {
        const parsed = parseInt(qtyMatch[1], 10);
        if (parsed > 0) quantity = parsed;
      }
    }

    // Try extracting price (patterns like "بسعر 120", "سعر 50", "بمبلغ 300", "بـ 80", "150 ريال")
    let unitPrice: number | undefined = undefined;
    const priceMatch = clause.match(/(?:بسعر|سعر|بمبلغ|بقيمه|بقيمة|بـ|ب)\s*(\d+(?:[\.,]\d+)?)/);
    if (priceMatch && priceMatch[1]) {
      unitPrice = parseFloat(priceMatch[1].replace(',', '.'));
    } else if (matchedItem) {
      unitPrice = Number(matchedItem.salePrice) || Number(matchedItem.costPrice) || 0;
    }

    // Clean description name
    let itemName = matchedItem ? matchedItem.name : '';
    if (!itemName) {
      // Clean leading commands like "اضف", "فاتورة", "صنف", numbers
      let cleanDesc = clause
        .replace(/^(?:اضف|ضيف|سجل|صنف|بند|فاتورة|فاتوره|مبيعات|شراء)\s+/gi, '')
        .replace(/(?:عدد|كميه|كمية)?\s*\d+\s*(?:حبه|حبة|حبات|قطع|قطعه|قطعة|كرتون|كراتين|دستة|بكت|طرد|جهاز|أجهزة|اجهزه)?/gi, '')
        .replace(/(?:بسعر|سعر|بمبلغ|بقيمه|بقيمة|بـ|ب)\s*\d+(?:[\.,]\d+)?(?:\s*ريال|\s*جنيه|\s*دولار)?/gi, '')
        .trim();
      if (cleanDesc.length > 1) {
        itemName = cleanDesc;
      }
    }

    if (itemName || matchedItem) {
      results.push({
        item: matchedItem,
        name: itemName || matchedItem?.name || 'صنف جديد',
        quantity: quantity,
        unitPrice: unitPrice !== undefined ? unitPrice : (matchedItem?.salePrice || 0)
      });
    }
  }

  // Fallback: If no structured clauses yielded items, search whole text for catalog items
  if (results.length === 0 && availableCatalog.length > 0) {
    for (const it of availableCatalog) {
      const itNorm = normalizeArabicText(it.name);
      if (itNorm && norm.includes(itNorm)) {
        results.push({
          item: it,
          name: it.name,
          quantity: 1,
          unitPrice: it.salePrice
        });
      }
    }
  }

  return results;
}

/**
 * Evaluates Instant Financial Voice Questions (Financial Q&A)
 */
export function evaluateFinancialQA(
  rawTranscript: string,
  context: {
    customers: Partner[];
    vendors: Partner[];
    salesInvoices: StoredSalesInvoiceRecord[];
    purchaseInvoices: StoredPurchaseInvoiceRecord[];
    receiptVouchers: StoredVoucherRecord[];
    paymentVouchers: StoredVoucherRecord[];
    items: Item[];
    accounts: Account[];
    currencySymbol: string;
  }
): FinancialQAResult | null {
  if (!rawTranscript || !rawTranscript.trim()) return null;
  const norm = normalizeArabicText(rawTranscript);

  const isQuestion = 
    norm.includes('كم') || 
    norm.includes('ما هو') || 
    norm.includes('ما هي') || 
    norm.includes('ماذا') || 
    norm.includes('رصيد') || 
    norm.includes('مبيعات اليوم') || 
    norm.includes('اوشكت') || 
    norm.includes('خلصت') || 
    norm.includes('ناقص') || 
    norm.includes('متبقي');

  if (!isQuestion) return null;

  // 1. Partner Balance Question (e.g. "كم رصيد العميل محمد؟", "رصيد شركة الأمل", "حساب المورد النور")
  if (norm.includes('رصيد') || norm.includes('حساب') || norm.includes('مديونيه') || norm.includes('مستحق')) {
    const allPartners = [...context.customers, ...context.vendors];
    for (const partner of allPartners) {
      const pNorm = normalizeArabicText(partner.name);
      if (pNorm && (norm.includes(pNorm) || (pNorm.length > 4 && norm.includes(pNorm.slice(0, 5))))) {
        const stmt = getPartnerAccountStatement(partner);
        const isDebit = stmt.balanceType === 'DEBIT';
        const isCredit = stmt.balanceType === 'CREDIT';
        const isZero = stmt.balanceType === 'ZERO' || stmt.balance === 0;

        let statusText = 'متزن تماماً (صفر)';
        let badgeColor: 'emerald' | 'amber' | 'rose' | 'blue' = 'emerald';
        let spoken = '';

        if (partner.type === 'CUSTOMER') {
          if (isDebit) {
            statusText = `مدين للمنشأة بمبلغ ${Math.abs(stmt.balance).toLocaleString()} ${context.currencySymbol}`;
            badgeColor = 'rose';
            spoken = `رصيد العميل ${partner.name} مدين بمبلغ ${Math.abs(stmt.balance).toLocaleString()} ${context.currencySymbol}`;
          } else if (isCredit) {
            statusText = `دائن (له رصيد مقدم) بمبلغ ${Math.abs(stmt.balance).toLocaleString()} ${context.currencySymbol}`;
            badgeColor = 'blue';
            spoken = `العميل ${partner.name} له رصيد دائن قدره ${Math.abs(stmt.balance).toLocaleString()} ${context.currencySymbol}`;
          } else {
            spoken = `حساب العميل ${partner.name} متزن تماماً ولا توجد مديونية مسجلة.`;
          }
        } else {
          // Vendor
          if (isCredit) {
            statusText = `مستحق للمورد (دائن) بمبلغ ${Math.abs(stmt.balance).toLocaleString()} ${context.currencySymbol}`;
            badgeColor = 'amber';
            spoken = `رصيد المورد ${partner.name} مستحق له دائن بمبلغ ${Math.abs(stmt.balance).toLocaleString()} ${context.currencySymbol}`;
          } else if (isDebit) {
            statusText = `مدين (دفعة مقدمة له) بمبلغ ${Math.abs(stmt.balance).toLocaleString()} ${context.currencySymbol}`;
            badgeColor = 'emerald';
            spoken = `المورد ${partner.name} مدين بدفعة مقدمة قدرها ${Math.abs(stmt.balance).toLocaleString()} ${context.currencySymbol}`;
          } else {
            spoken = `حساب المورد ${partner.name} خالص ومتزن بالكامل.`;
          }
        }

        return {
          type: 'PARTNER_BALANCE',
          question: rawTranscript,
          answerText: `الرصيد الصافي الحالي لـ (${partner.name}):`,
          spokenText: spoken,
          primaryValue: `${Math.abs(stmt.balance).toLocaleString()} ${context.currencySymbol}`,
          secondaryValue: statusText,
          statusBadge: {
            text: partner.type === 'CUSTOMER' ? 'عميل' : 'مورد',
            color: partner.type === 'CUSTOMER' ? 'blue' : 'purple'
          },
          navigationView: partner.type === 'CUSTOMER' ? 'customers' : 'vendors',
          navigationLabel: `فتح كشف حساب ${partner.name}`,
          details: [
            { label: 'إجمالي المسحوبات / الفواتير', value: `${stmt.totalWithdrawals.toLocaleString()} ${context.currencySymbol}` },
            { label: 'إجمالي السدادات / المقبوضات', value: `${stmt.totalPayments.toLocaleString()} ${context.currencySymbol}` },
            { label: 'الرصيد الافتتاحي', value: `${(partner.openingBalance || 0).toLocaleString()} ${context.currencySymbol}` },
            { label: 'آخر حركة مسجلة', value: stmt.lastTransactionDate || 'لا توجد حركات حديثة' }
          ]
        };
      }
    }
  }

  // 2. Today's Sales Query (e.g. "كم مبيعات اليوم؟", "مبيعات النهارده", "إجمالي فواتير اليوم")
  if (norm.includes('مبيعات اليوم') || (norm.includes('مبيعات') && (norm.includes('اليوم') || norm.includes('النهارده') || norm.includes('النهاردة')))) {
    const today = new Date().toISOString().split('T')[0];
    const todayInvoices = context.salesInvoices.filter(inv => inv.date === today && inv.status === 'POSTED');
    const totalTodaySales = todayInvoices.reduce((sum, inv) => sum + (Number(inv.totals?.grandTotal ?? 0)), 0);
    const invoiceCount = todayInvoices.length;

    const spoken = totalTodaySales > 0 
      ? `إجمالي مبيعات اليوم هو ${totalTodaySales.toLocaleString()} ${context.currencySymbol} من واقع ${invoiceCount} فواتير مرحلة.`
      : `لا توجد فواتير مبيعات مرحلة مسجلة بتاريخ اليوم حتى الآن.`;

    return {
      type: 'TODAY_SALES',
      question: rawTranscript,
      answerText: `إجمالي مبيعات اليوم (${today}):`,
      spokenText: spoken,
      primaryValue: `${totalTodaySales.toLocaleString()} ${context.currencySymbol}`,
      secondaryValue: `${invoiceCount} فواتير بيع مرحلة اليوم`,
      statusBadge: {
        text: 'مبيعات اليوم',
        color: 'emerald'
      },
      navigationView: 'sales',
      navigationLabel: 'استعراض فواتير المبيعات',
      details: [
        { label: 'عدد الفواتير المنفذة اليوم', value: `${invoiceCount} فاتورة` },
        { label: 'تاريخ اليوم', value: today },
        { label: 'متوسط الفاتورة', value: invoiceCount > 0 ? `${Math.round(totalTodaySales / invoiceCount).toLocaleString()} ${context.currencySymbol}` : '0' }
      ]
    };
  }

  // 3. Treasury & Bank Balance Query (e.g. "كم رصيد الصندوق؟", "رصيد الخزينة", "رصيد بنك الراجحي", "رصيد البنك الأهلي", "كم نقدية الصندوق؟")
  if (norm.includes('صندوق') || norm.includes('خزينه') || norm.includes('خزنة') || norm.includes('كاش') || norm.includes('راجحي') || norm.includes('اهلي') || norm.includes('بنك')) {
    const tb = calculateTrialBalance();
    let targetAccCode = '1101'; // Default Cash
    let accTitle = 'النقدية بالصندوق الرئيسي (1101)';

    if (norm.includes('راجحي')) {
      targetAccCode = '1103';
      accTitle = 'حساب بنك الراجحي (1103)';
    } else if (norm.includes('اهلي') || norm.includes('الأهلي')) {
      targetAccCode = '1102';
      accTitle = 'حساب البنك الأهلي التجاري (1102)';
    }

    const row = tb.rows.find(r => r.account?.code === targetAccCode);
    const balance = row ? (row.endingDebit - row.endingCredit) : 0;
    const spoken = `الرصيد الدفتري الحالي لـ ${accTitle} هو ${balance.toLocaleString()} ${context.currencySymbol}.`;

    return {
      type: 'TREASURY_BALANCE',
      question: rawTranscript,
      answerText: `الرصيد اللحظي لـ ${accTitle}:`,
      spokenText: spoken,
      primaryValue: `${balance.toLocaleString()} ${context.currencySymbol}`,
      secondaryValue: balance >= 0 ? 'رصيد نقدية متاح (مدين)' : 'رصيد مكشوف / سالب (دائن)',
      statusBadge: {
        text: 'الخزينة والمالية',
        color: balance >= 0 ? 'emerald' : 'rose'
      },
      navigationView: 'trialBalance',
      navigationLabel: 'استعراض ميزان المراجعة والأستاذ العام',
      details: [
        { label: 'كود الحساب في الدليل', value: targetAccCode },
        { label: 'إجمالي الحركات المدينة', value: `${(row?.debitMovement || 0).toLocaleString()} ${context.currencySymbol}` },
        { label: 'إجمالي الحركات الدائنة', value: `${(row?.creditMovement || 0).toLocaleString()} ${context.currencySymbol}` }
      ]
    };
  }

  // 4. Low Stock Query (e.g. "ما هي الأصناف التي أوشكت على النفاد؟", "أصناف ناقصة", "أصناف قربت تخلص", "كم صنف ناقص؟")
  if (norm.includes('اوشكت') || norm.includes('نفاد') || norm.includes('خلصت') || norm.includes('ناقص') || norm.includes('عجز') || norm.includes('قربت تخلص') || norm.includes('حد الطلب')) {
    const lowStockItems = context.items.filter(it => {
      const min = it.minReorderLevel ?? 5;
      return (it.stock || 0) <= min;
    });

    const count = lowStockItems.length;
    const spoken = count > 0 
      ? `يوجد حالياً ${count} أصناف مخزنية بلغت أو تجاوزت حد إعادة الطلب الأدنى.`
      : `جميع الأصناف في المستودع بمستويات آمنة ولا توجد أصناف أوشكت على النفاد.`;

    return {
      type: 'LOW_STOCK',
      question: rawTranscript,
      answerText: `حالة الأصناف التي قاربت على النفاد (حد الطلب):`,
      spokenText: spoken,
      primaryValue: `${count} أصناف ناقصة`,
      secondaryValue: count > 0 ? 'تحتاج إلى إعادة طلب وتوريد فوري' : 'المخزون بمستويات ممتازة',
      statusBadge: {
        text: count > 0 ? 'تنبيه مخزني' : 'مخزون آمن',
        color: count > 0 ? 'amber' : 'emerald'
      },
      navigationView: 'warehouseBalances',
      navigationLabel: 'فتح أرصدة المستودع والجرد',
      details: lowStockItems.slice(0, 4).map(it => ({
        label: it.name,
        value: `المتوفر: ${it.stock || 0} ${it.unit || 'قطعة'} (الحد الأدنى: ${it.minReorderLevel ?? 5})`
      }))
    };
  }

  return null;
}

/**
 * Parses user speech into actionable structured ERP intent
 */
export function parseVoiceAction(
  rawTranscript: string,
  context: {
    customers: Partner[];
    vendors: Partner[];
    items: Item[];
    accounts: Account[];
  }
): ParsedVoiceAction | null {
  if (!rawTranscript || !rawTranscript.trim()) return null;

  const norm = normalizeArabicText(rawTranscript);

  // 1. Detect Sales Invoice Creation Intent
  // e.g.: "انشئ فاتورة مبيعات جديدة للعميل شركة الأمل", "فاتورة بيع للعميل احمد بمبلغ 500", "اعمل فاتورة مبيعات"
  const isSalesInvoiceIntent = 
    (norm.includes('فاتوره') || norm.includes('فاتورة')) && 
    (norm.includes('بيع') || norm.includes('مبيعات') || norm.includes('جديده') || norm.includes('جديدة') || norm.includes('عميل')) &&
    (norm.includes('انشئ') || norm.includes('سوي') || norm.includes('اعمل') || norm.includes('اضف') || norm.includes('جديده') || norm.includes('تحرير') || norm.includes('اصدار') || norm.includes('افتح'));

  if (isSalesInvoiceIntent) {
    // Find customer in transcript
    let matchedCustomer: Partner | null = null;
    for (const c of context.customers) {
      const cNorm = normalizeArabicText(c.name);
      if (cNorm && norm.includes(cNorm)) {
        matchedCustomer = c;
        break;
      }
    }

    // Find items in transcript with intelligent quantity & price extraction
    const matchedItems = parseVoiceItemsFromText(rawTranscript, context.items);

    const amount = extractAmountFromText(rawTranscript);

    return {
      type: 'CREATE_SALES_INVOICE',
      confidence: 0.95,
      labelAr: 'إنشاء فاتورة مبيعات جديدة',
      labelEn: 'Create New Sales Invoice',
      targetView: 'sales',
      summary: matchedCustomer 
        ? `إنشاء وتجهيز فاتورة مبيعات جديدة للعميل (${matchedCustomer.name})${matchedItems.length > 0 ? ` مع إدراج ${matchedItems.length} صنف/أصناف` : ''}`
        : `إنشاء وتجهيز فاتورة مبيعات جديدة${matchedItems.length > 0 ? ` مع إدراج ${matchedItems.length} صنف/أصناف` : ' وبدء إضافة الأصناف'}`,
      payload: {
        partner: matchedCustomer,
        partnerName: matchedCustomer?.name,
        partnerType: 'CUSTOMER',
        amount: amount || undefined,
        items: matchedItems.length > 0 ? matchedItems : undefined
      }
    };
  }

  // 2. Detect Purchase Invoice Creation Intent
  // e.g.: "فاتورة مشتريات من المورد التوريدات الحديثة", "انشئ فاتورة شراء"
  const isPurchaseInvoiceIntent = 
    (norm.includes('فاتوره') || norm.includes('فاتورة')) && 
    (norm.includes('شراء') || norm.includes('مشتريات') || norm.includes('مورد') || norm.includes('توريد')) &&
    (norm.includes('انشئ') || norm.includes('سوي') || norm.includes('اعمل') || norm.includes('اضف') || norm.includes('جديده') || norm.includes('تحرير') || norm.includes('اصدار') || norm.includes('افتح'));

  if (isPurchaseInvoiceIntent) {
    let matchedVendor: Partner | null = null;
    for (const v of context.vendors) {
      const vNorm = normalizeArabicText(v.name);
      if (vNorm && norm.includes(vNorm)) {
        matchedVendor = v;
        break;
      }
    }

    const matchedPurchaseItems = parseVoiceItemsFromText(rawTranscript, context.items);

    return {
      type: 'CREATE_PURCHASE_INVOICE',
      confidence: 0.95,
      labelAr: 'إنشاء فاتورة مشتريات جديدة',
      labelEn: 'Create New Purchase Invoice',
      targetView: 'purchases',
      summary: matchedVendor 
        ? `إنشاء وتجهيز فاتورة شراء جديدة من المورد (${matchedVendor.name})${matchedPurchaseItems.length > 0 ? ` مع ${matchedPurchaseItems.length} صنف/أصناف` : ''}`
        : `إنشاء وتجهيز مسودة فاتورة مشتريات جديدة${matchedPurchaseItems.length > 0 ? ` مع ${matchedPurchaseItems.length} صنف/أصناف` : ''}`,
      payload: {
        partner: matchedVendor,
        partnerName: matchedVendor?.name,
        partnerType: 'VENDOR',
        items: matchedPurchaseItems.length > 0 ? matchedPurchaseItems : undefined
      }
    };
  }

  // 3. Detect Receipt Voucher Creation Intent
  // e.g.: "سند قبض بمبلغ 5000 من العميل محمد نقدا", "انشئ سند قبض", "استلام نقدية 2000 من شركة الامل"
  const isReceiptVoucherIntent = 
    (norm.includes('سند قبض') || norm.includes('قبض') || norm.includes('استلام نقديه') || norm.includes('استلام دفعه')) &&
    (norm.includes('انشئ') || norm.includes('سوي') || norm.includes('اعمل') || norm.includes('سجل') || norm.includes('جديد') || norm.includes('بمبلغ') || norm.includes('من') || norm.includes('تحرير'));

  if (isReceiptVoucherIntent) {
    let matchedPartner: Partner | null = null;
    for (const c of [...context.customers, ...context.vendors]) {
      const pNorm = normalizeArabicText(c.name);
      if (pNorm && norm.includes(pNorm)) {
        matchedPartner = c;
        break;
      }
    }

    const amount = extractAmountFromText(rawTranscript);
    let paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK' = 'CASH';
    if (norm.includes('بنك') || norm.includes('تحويل') || norm.includes('حواله')) paymentMethod = 'TRANSFER';
    else if (norm.includes('شيك') || norm.includes('شيكات')) paymentMethod = 'CHECK';
    else if (norm.includes('شبكه') || norm.includes('مدى') || norm.includes('بطاقه') || norm.includes('فيزا')) paymentMethod = 'CARD';

    return {
      type: 'CREATE_RECEIPT_VOUCHER',
      confidence: 0.92,
      labelAr: 'تحرير سند قبض مالي',
      labelEn: 'Create Receipt Voucher',
      targetView: 'externalReceipt',
      summary: `تحرير سند قبض ${amount ? `بمبلغ ${amount.toLocaleString()}` : ''} ${matchedPartner ? `من (${matchedPartner.name})` : ''}`,
      payload: {
        partner: matchedPartner,
        partnerName: matchedPartner?.name,
        partnerType: (matchedPartner?.type as any) || 'CUSTOMER',
        amount: amount || undefined,
        paymentMethod
      }
    };
  }

  // 4. Detect Payment Voucher Creation Intent
  // e.g.: "سند صرف بمبلغ 1500 للمورد شركة النور", "انشئ سند صرف للمصروفات", "سداد دفعة 3000 للمورد"
  const isPaymentVoucherIntent = 
    (norm.includes('سند صرف') || norm.includes('صرف') || norm.includes('سداد دفعه') || norm.includes('دفع نقديه') || norm.includes('سداد للمورد')) &&
    (norm.includes('انشئ') || norm.includes('سوي') || norm.includes('اعمل') || norm.includes('سجل') || norm.includes('جديد') || norm.includes('بمبلغ') || norm.includes('لـ') || norm.includes('الي') || norm.includes('تحرير'));

  if (isPaymentVoucherIntent) {
    let matchedPartner: Partner | null = null;
    for (const v of [...context.vendors, ...context.customers]) {
      const pNorm = normalizeArabicText(v.name);
      if (pNorm && norm.includes(pNorm)) {
        matchedPartner = v;
        break;
      }
    }

    const amount = extractAmountFromText(rawTranscript);
    let paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK' = 'CASH';
    if (norm.includes('بنك') || norm.includes('تحويل') || norm.includes('حواله')) paymentMethod = 'TRANSFER';
    else if (norm.includes('شيك') || norm.includes('شيكات')) paymentMethod = 'CHECK';
    else if (norm.includes('شبكه') || norm.includes('مدى') || norm.includes('بطاقه')) paymentMethod = 'CARD';

    return {
      type: 'CREATE_PAYMENT_VOUCHER',
      confidence: 0.92,
      labelAr: 'تحرير سند صرف مالي',
      labelEn: 'Create Payment Voucher',
      targetView: 'externalPayment',
      summary: `تحرير سند صرف ${amount ? `بمبلغ ${amount.toLocaleString()}` : ''} ${matchedPartner ? `إلى (${matchedPartner.name})` : ''}`,
      payload: {
        partner: matchedPartner,
        partnerName: matchedPartner?.name,
        partnerType: (matchedPartner?.type as any) || 'VENDOR',
        amount: amount || undefined,
        paymentMethod
      }
    };
  }

  // 5. Detect Journal Entry Creation Intent
  // e.g.: "سجل قيد يومية جديد", "انشئ قيد مصروفات 500 من الصندوق", "قيد تسوية"
  const isJournalIntent = 
    (norm.includes('قيد') || norm.includes('قيود')) &&
    (norm.includes('انشئ') || norm.includes('سجل') || norm.includes('جديد') || norm.includes('اعمل') || norm.includes('يوميه') || norm.includes('تسجيل'));

  if (isJournalIntent) {
    const amount = extractAmountFromText(rawTranscript);
    return {
      type: 'CREATE_JOURNAL_ENTRY',
      confidence: 0.90,
      labelAr: 'تسجيل قيد يومية جديد',
      labelEn: 'Create Journal Entry',
      targetView: 'journal',
      summary: `فتح شاشة اليومية وبدء تسجيل قيد محاسبي ${amount ? `بقيمة ${amount.toLocaleString()}` : ''}`,
      payload: {
        amount: amount || undefined,
        description: rawTranscript
      }
    };
  }

  return null;
}
