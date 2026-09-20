import { SystemSettings } from '../types/accounting';

export const DEFAULT_SETTINGS: SystemSettings = {
  company: {
    nameAr: 'شركة لوجوستريا للمحاسبة والحلول المالية',
    nameEn: 'Logustria Financial & ERP Solutions Co.',
    taxNumber: '310123456700003',
    commercialRegister: '1010987654',
    branchName: 'الفرع الرئيسي - الرياض',
    phone: '+966 11 456 7890',
    email: 'info@logustria.com',
    website: 'https://logustria.com',
    address: 'طريق الملك فهد، حي الصحافة',
    city: 'الرياض',
    postalCode: '13315',
    logoUrl: '',
    stampUrl: '',
  },
  financial: {
    currency: 'SAR',
    currencySymbol: 'ر.س',
    fiscalYear: '2024',
    fiscalYearStart: '2024-01-01',
    fiscalYearEnd: '2024-12-31',
    isFiscalYearClosed: false,
    costMethod: 'WEIGHTED_AVG',
    decimalPlaces: 2,
    allowNegativeStock: false,
  },
  currencies: [
    { code: 'SAR', nameAr: 'ريال سعودي', symbol: 'ر.س', rateAgainstBase: 1.0, isBase: true, isEnabled: true },
    { code: 'USD', nameAr: 'دولار أمريكي', symbol: '$', rateAgainstBase: 3.75, isBase: false, isEnabled: true },
    { code: 'EUR', nameAr: 'يورو أوروبي', symbol: '€', rateAgainstBase: 4.10, isBase: false, isEnabled: true },
    { code: 'AED', nameAr: 'درهم إماراتي', symbol: 'د.إ', rateAgainstBase: 1.02, isBase: false, isEnabled: true },
    { code: 'KWD', nameAr: 'دينار كويتي', symbol: 'د.ك', rateAgainstBase: 12.25, isBase: false, isEnabled: false },
    { code: 'EGP', nameAr: 'جنيه مصري', symbol: 'ج.م', rateAgainstBase: 0.078, isBase: false, isEnabled: false },
  ],
  controlAndLimits: {
    enforceCreditLimit: true,
    creditLimitAction: 'WARN',
    preventNegativeStock: true,
    warnLowStock: true,
    lowStockThreshold: 5,
  },
  branding: {
    primaryColor: '#1e293b',
    fontFamily: 'Tajawal',
    showTermsAndConditions: true,
    termsText: 'البضاعة المباعة لا ترد ولا تستبدل بعد 7 أيام من تاريخ الاستلام. تسري هذه الفاتورة كوثيقة إثبات استلام رسمية.',
    stampUrl: '',
    invoiceTitleAr: 'فاتورة ضريبية رسمية',
  },
  users: [
    {
      id: 'usr-1',
      username: 'admin',
      displayName: 'المدير العام (System Administrator)',
      role: 'ADMIN',
      branch: 'الفرع الرئيسي',
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canPost: true,
      canPrint: true,
      canExport: true,
      isActive: true,
    },
    {
      id: 'usr-2',
      username: 'accountant1',
      displayName: 'محاسب أول - الإدارة المالية',
      role: 'ACCOUNTANT',
      branch: 'الفرع الرئيسي',
      canCreate: true,
      canEdit: true,
      canDelete: false,
      canPost: true,
      canPrint: true,
      canExport: true,
      isActive: true,
    },
    {
      id: 'usr-3',
      username: 'cashier_pos',
      displayName: 'كاشير نقطة البيع 1',
      role: 'CASHIER',
      branch: 'معرض المبيعات',
      canCreate: true,
      canEdit: false,
      canDelete: false,
      canPost: false,
      canPrint: true,
      canExport: false,
      isActive: true,
    },
    {
      id: 'usr-4',
      username: 'storekeeper',
      displayName: 'أمين المستودع المركزي',
      role: 'STOREKEEPER',
      branch: 'المستودع الرئيسي',
      canCreate: true,
      canEdit: true,
      canDelete: false,
      canPost: false,
      canPrint: true,
      canExport: true,
      isActive: true,
    }
  ],
  taxAndInvoice: {
    enableVat: true,
    defaultVatRate: 15,
    salesPrefix: 'INV-',
    purchasePrefix: 'PO-',
    journalPrefix: 'JV-',
    receiptVoucherPrefix: 'RV-',
    paymentVoucherPrefix: 'PV-',
    enableQrCode: true,
  },
  printing: {
    defaultFormat: 'A4',
    colorMode: 'bw',
    headerNotes: 'فاتورة ضريبية معتمدة وفقاً لاشتراطات هيئة الزكاة والضريبة والجمارك (ZATCA)',
    footerNotes: 'شكراً لتعاملكم معنا. البضاعة المباعة لا ترد ولا تستبدل بعد مرور 7 أيام من تاريخ الاستلام.',
    showCompanyLogo: true,
    showSignatures: true,
  },
  approvalWorkflow: {
    enabled: false,
    minAmountThreshold: 5000,
    requireGeneralManagerForVeryLarge: true,
    veryLargeThreshold: 50000,
    defaultApproverName: 'أ. د. عبد الرحمن الشهري',
    defaultApproverRole: 'المدير المالي',
    generalManagerName: 'م. فهد بن عبدالعزيز',
    blockPostingWithoutApproval: true,
    enableForInternalVouchers: true,
  },
  invoiceDefaults: {
    salesTransactionType: 'CREDIT_SALES',
    salesClassification: 'TAX',
    salesWarehouse: 'MAIN_WAREHOUSE',
    salesSafe: 'MAIN_SAFE',
    salesServiceType: '',
    purchasesTransactionType: 'CREDIT_PURCHASE',
    purchasesClassification: 'TAX',
    purchasesWarehouse: 'MAIN_WAREHOUSE',
    purchasesSafe: 'MAIN_SAFE',
    purchasesServiceType: '',
  },
};

const SETTINGS_KEY = 'alpha_system_settings_v1';

export function getSystemSettings(): SystemSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      company: { ...DEFAULT_SETTINGS.company, ...(parsed.company || {}) },
      financial: { ...DEFAULT_SETTINGS.financial, ...(parsed.financial || {}) },
      currencies: parsed.currencies && Array.isArray(parsed.currencies) && parsed.currencies.length > 0 ? parsed.currencies : DEFAULT_SETTINGS.currencies,
      controlAndLimits: { ...DEFAULT_SETTINGS.controlAndLimits, ...(parsed.controlAndLimits || {}) },
      branding: { ...DEFAULT_SETTINGS.branding, ...(parsed.branding || {}) },
      users: parsed.users && Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : DEFAULT_SETTINGS.users,
      taxAndInvoice: { ...DEFAULT_SETTINGS.taxAndInvoice, ...(parsed.taxAndInvoice || {}) },
      printing: { ...DEFAULT_SETTINGS.printing, ...(parsed.printing || {}) },
      approvalWorkflow: { ...DEFAULT_SETTINGS.approvalWorkflow, ...(parsed.approvalWorkflow || {}) },
      invoiceDefaults: { ...DEFAULT_SETTINGS.invoiceDefaults, ...(parsed.invoiceDefaults || {}) },
    };
  } catch (err) {
    console.error('Failed to load settings from localStorage:', err);
    return DEFAULT_SETTINGS;
  }
}

export function saveSystemSettings(settings: SystemSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('alpha-settings-updated', { detail: settings }));
  } catch (err) {
    console.error('Failed to save settings to localStorage:', err);
  }
}
