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
      taxAndInvoice: { ...DEFAULT_SETTINGS.taxAndInvoice, ...(parsed.taxAndInvoice || {}) },
      printing: { ...DEFAULT_SETTINGS.printing, ...(parsed.printing || {}) },
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
