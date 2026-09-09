import { useState, useEffect, useMemo } from 'react';
import { getSystemSettings } from './settings';
import { tafqeetArabic, tafqeetEnglish } from './tafqeet';

export interface CurrencyMetadata {
  code: string;
  nameAr: string;
  nameEn: string;
  symbol: string;
  symbolEn: string;
  subunitAr: string;
  subunitEn: string;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyMetadata> = {
  SAR: {
    code: 'SAR',
    nameAr: 'ريال سعودي',
    nameEn: 'Saudi Riyal',
    symbol: 'ر.س',
    symbolEn: 'SAR',
    subunitAr: 'هللة',
    subunitEn: 'Halalas'
  },
  AED: {
    code: 'AED',
    nameAr: 'درهم إماراتي',
    nameEn: 'UAE Dirham',
    symbol: 'د.إ',
    symbolEn: 'AED',
    subunitAr: 'فلس',
    subunitEn: 'Fils'
  },
  EGP: {
    code: 'EGP',
    nameAr: 'جنيه مصري',
    nameEn: 'Egyptian Pound',
    symbol: 'ج.م',
    symbolEn: 'EGP',
    subunitAr: 'قرش',
    subunitEn: 'Piastres'
  },
  KWD: {
    code: 'KWD',
    nameAr: 'دينار كويتي',
    nameEn: 'Kuwaiti Dinar',
    symbol: 'د.ك',
    symbolEn: 'KWD',
    subunitAr: 'فلس',
    subunitEn: 'Fils'
  },
  QAR: {
    code: 'QAR',
    nameAr: 'ريال قطري',
    nameEn: 'Qatari Riyal',
    symbol: 'ر.ق',
    symbolEn: 'QAR',
    subunitAr: 'درهم',
    subunitEn: 'Dirhams'
  },
  BHD: {
    code: 'BHD',
    nameAr: 'دينار بحريني',
    nameEn: 'Bahraini Dinar',
    symbol: 'د.ب',
    symbolEn: 'BHD',
    subunitAr: 'فلس',
    subunitEn: 'Fils'
  },
  OMR: {
    code: 'OMR',
    nameAr: 'ريال عماني',
    nameEn: 'Omani Rial',
    symbol: 'ر.ع',
    symbolEn: 'OMR',
    subunitAr: 'بيسة',
    subunitEn: 'Baisa'
  },
  JOD: {
    code: 'JOD',
    nameAr: 'دينار أردني',
    nameEn: 'Jordanian Dinar',
    symbol: 'د.أ',
    symbolEn: 'JOD',
    subunitAr: 'قرش',
    subunitEn: 'Piastres'
  },
  IQD: {
    code: 'IQD',
    nameAr: 'دينار عراقي',
    nameEn: 'Iraqi Dinar',
    symbol: 'د.ع',
    symbolEn: 'IQD',
    subunitAr: 'فلس',
    subunitEn: 'Fils'
  },
  USD: {
    code: 'USD',
    nameAr: 'دولار أمريكي',
    nameEn: 'US Dollar',
    symbol: '$',
    symbolEn: '$',
    subunitAr: 'سنت',
    subunitEn: 'Cents'
  },
  EUR: {
    code: 'EUR',
    nameAr: 'يورو أوروبي',
    nameEn: 'Euro',
    symbol: '€',
    symbolEn: '€',
    subunitAr: 'سنت',
    subunitEn: 'Cents'
  },
  GBP: {
    code: 'GBP',
    nameAr: 'جنيه إسترليني',
    nameEn: 'British Pound',
    symbol: '£',
    symbolEn: '£',
    subunitAr: 'بنس',
    subunitEn: 'Pence'
  },
  TRY: {
    code: 'TRY',
    nameAr: 'ليرة تركية',
    nameEn: 'Turkish Lira',
    symbol: '₺',
    symbolEn: 'TRY',
    subunitAr: 'قرش',
    subunitEn: 'Kurus'
  }
};

export const DEFAULT_CURRENCY: CurrencyMetadata = SUPPORTED_CURRENCIES.SAR!;

/**
 * Returns the CurrencyMetadata matching a code or symbol, or falls back to system settings or SAR.
 */
export function getCurrencyInfo(codeOrSymbol?: string): CurrencyMetadata {
  if (codeOrSymbol) {
    const upper = codeOrSymbol.toUpperCase().trim();
    const matchedUpper = SUPPORTED_CURRENCIES[upper];
    if (matchedUpper) {
      return matchedUpper;
    }
    // Match by symbol or name
    const found = Object.values(SUPPORTED_CURRENCIES).find(
      c => c.symbol === codeOrSymbol || c.symbolEn === codeOrSymbol || c.nameAr === codeOrSymbol || c.nameEn.toLowerCase() === codeOrSymbol.toLowerCase()
    );
    if (found) return found;
  }

  // Fallback to currently saved system settings
  try {
    const settings = getSystemSettings();
    const currCode = settings?.financial?.currency;
    if (currCode && SUPPORTED_CURRENCIES[currCode.toUpperCase()]) {
      const base = SUPPORTED_CURRENCIES[currCode.toUpperCase()]!;
      // Respect custom symbol if explicitly saved
      if (settings.financial.currencySymbol && settings.financial.currencySymbol !== base.symbol) {
        return { ...base, symbol: settings.financial.currencySymbol };
      }
      return base;
    }
    if (settings?.financial?.currencySymbol) {
      const match = Object.values(SUPPORTED_CURRENCIES).find(c => c.symbol === settings.financial.currencySymbol);
      if (match) return match;
      return {
        code: settings.financial.currency || 'CUSTOM',
        nameAr: settings.financial.currency || 'عملة النظام',
        nameEn: settings.financial.currency || 'System Currency',
        symbol: settings.financial.currencySymbol,
        symbolEn: settings.financial.currency || settings.financial.currencySymbol,
        subunitAr: 'جزء',
        subunitEn: 'Subunit'
      };
    }
  } catch {
    // ignore
  }

  return DEFAULT_CURRENCY;
}

/**
 * Gets the current system currency info.
 */
export function getActiveCurrency(): CurrencyMetadata {
  return getCurrencyInfo();
}

/**
 * Converts a numeric amount to text in the active system currency.
 */
export function tafqeetSystemCurrency(amount: number, language: 'ar' | 'en' = 'ar'): string {
  const curr = getActiveCurrency();
  if (language === 'en') {
    return tafqeetEnglish(amount, curr.nameEn, curr.subunitEn);
  }
  return tafqeetArabic(amount, curr.nameAr, curr.subunitAr);
}

/**
 * Formats a monetary number with thousands separators and the active currency symbol.
 */
export function formatCurrencyAmount(
  amount: number,
  options?: {
    showSymbol?: boolean;
    symbolPosition?: 'after' | 'before';
    decimalPlaces?: number;
    isEn?: boolean;
    currencyCode?: string;
  }
): string {
  const settings = getSystemSettings();
  const decimals = options?.decimalPlaces ?? (settings.financial?.decimalPlaces ?? 2);
  const curr = getCurrencyInfo(options?.currencyCode);
  const formattedNum = Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  if (options?.showSymbol === false) {
    return formattedNum;
  }

  const sym = options?.isEn ? curr.symbolEn : curr.symbol;
  if (options?.symbolPosition === 'before') {
    return `${sym} ${formattedNum}`;
  }
  return `${formattedNum} ${sym}`;
}

/**
 * React hook that returns active currency metadata and reactive updates when Settings change.
 */
export function useSystemCurrency() {
  const [currency, setCurrency] = useState<CurrencyMetadata>(() => getActiveCurrency());
  const [settings, setSettings] = useState(() => getSystemSettings());

  useEffect(() => {
    const handleUpdate = () => {
      const freshSettings = getSystemSettings();
      setSettings(freshSettings);
      setCurrency(getCurrencyInfo(freshSettings.financial.currency));
    };

    window.addEventListener('alpha-settings-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('alpha-settings-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const formatAmount = useMemo(() => {
    return (val: number, isEn = false, showSymbol = true) => {
      const decimals = settings.financial?.decimalPlaces ?? 2;
      const numStr = Number(val || 0).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
      if (!showSymbol) return numStr;
      const sym = isEn ? currency.symbolEn : currency.symbol;
      return `${numStr} ${sym}`;
    };
  }, [currency, settings.financial?.decimalPlaces]);

  const tafqeet = useMemo(() => {
    return (val: number, isEn = false) => {
      if (isEn) {
        return tafqeetEnglish(val, currency.nameEn, currency.subunitEn);
      }
      return tafqeetArabic(val, currency.nameAr, currency.subunitAr);
    };
  }, [currency]);

  return {
    currency,
    symbol: currency.symbol,
    currencySymbol: currency.symbol,
    symbolEn: currency.symbolEn,
    currencySymbolEn: currency.symbolEn,
    nameAr: currency.nameAr,
    currencyName: currency.nameAr,
    nameEn: currency.nameEn,
    currencyNameEn: currency.nameEn,
    code: currency.code,
    currencyCode: currency.code,
    fullNameAr: `${currency.nameAr} (${currency.code})`,
    fullNameEn: `${currency.nameEn} (${currency.code})`,
    decimalPlaces: settings.financial?.decimalPlaces ?? 2,
    formatAmount,
    tafqeet
  };
}
