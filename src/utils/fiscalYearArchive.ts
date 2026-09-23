import { getSystemSettings } from './settings';
import { 
  DB_SALES_INVOICES_KEY, 
  DB_PURCHASES_INVOICES_KEY, 
  DB_RECEIPT_VOUCHERS_KEY,
  DB_PAYMENT_VOUCHERS_KEY
} from './sequences';
import { JOURNAL_ENTRIES_STORAGE_KEY } from './trialBalanceStore';

export const FISCAL_YEAR_CHANGED_EVENT = 'alpha-fiscal-year-changed';
const STORAGE_BROWSING_YEAR_KEY = 'logosteria_browsing_fiscal_year';

/**
 * Returns the currently active (live operational) fiscal year defined in system settings
 */
export function getActiveFiscalYear(): number {
  const settings = getSystemSettings();
  const fy = Number(settings.financial?.fiscalYear);
  return !isNaN(fy) && fy > 2000 ? fy : new Date().getFullYear();
}

/**
 * Returns the list of officially closed fiscal years
 */
export function getClosedFiscalYears(): number[] {
  const settings = getSystemSettings();
  const fin = settings.financial || {};
  const closed = new Set<number>(fin.closedFiscalYears || []);
  
  if (fin.isFiscalYearClosed && fin.fiscalYear) {
    const num = Number(fin.fiscalYear);
    if (!isNaN(num)) closed.add(num);
  }

  return Array.from(closed).sort((a, b) => b - a);
}

/**
 * Discovers all fiscal years that have records in the database or are defined in settings
 */
export function getAllDiscoveredFiscalYears(): number[] {
  const activeYear = getActiveFiscalYear();
  const yearsSet = new Set<number>([activeYear]);

  // Include previous year by default for comparison
  yearsSet.add(activeYear - 1);

  // Include any closed fiscal years
  getClosedFiscalYears().forEach(y => yearsSet.add(y));

  // Scan transactions safely from storage
  if (typeof window !== 'undefined') {
    const extractYearsFromStorageKey = (key: string, datePropName: string) => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            list.slice(0, 300).forEach((item: any) => {
              const d = item?.[datePropName];
              if (d) {
                const yr = new Date(d).getFullYear();
                if (!isNaN(yr) && yr > 2000 && yr < 2100) {
                  yearsSet.add(yr);
                }
              }
            });
          }
        }
      } catch (err) {
        console.warn(`Error scanning years from ${key}:`, err);
      }
    };

    extractYearsFromStorageKey(DB_SALES_INVOICES_KEY, 'date');
    extractYearsFromStorageKey(DB_PURCHASES_INVOICES_KEY, 'date');
    extractYearsFromStorageKey(JOURNAL_ENTRIES_STORAGE_KEY, 'date');
    extractYearsFromStorageKey(DB_RECEIPT_VOUCHERS_KEY, 'date');
    extractYearsFromStorageKey(DB_PAYMENT_VOUCHERS_KEY, 'date');
  }

  return Array.from(yearsSet).sort((a, b) => b - a);
}

/**
 * Checks whether a specific year is considered an archived/closed year
 */
export function isYearArchived(year: number): boolean {
  const activeYear = getActiveFiscalYear();
  if (year < activeYear) return true;
  const closed = getClosedFiscalYears();
  return closed.includes(year);
}

/**
 * Returns the currently selected year the user is browsing in the application
 */
export function getSelectedBrowsingYear(): number {
  if (typeof window === 'undefined') return getActiveFiscalYear();
  try {
    const stored = sessionStorage.getItem(STORAGE_BROWSING_YEAR_KEY);
    if (stored) {
      const parsed = Number(stored);
      if (!isNaN(parsed) && parsed > 2000) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading browsing year:', err);
  }
  return getActiveFiscalYear();
}

/**
 * Changes the active browsing fiscal year and alerts listeners across the UI
 */
export function setSelectedBrowsingYear(year: number): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_BROWSING_YEAR_KEY, String(year));
    window.dispatchEvent(new CustomEvent(FISCAL_YEAR_CHANGED_EVENT, {
      detail: { 
        year, 
        isArchived: isYearArchived(year),
        activeYear: getActiveFiscalYear()
      }
    }));
  } catch (err) {
    console.warn('Error setting browsing year:', err);
  }
}

/**
 * Returns true if the user is currently browsing an archived fiscal year (read-only mode)
 */
export function isBrowsingArchivedYear(): boolean {
  const browsingYear = getSelectedBrowsingYear();
  return isYearArchived(browsingYear);
}

/**
 * Helper to reset browsing year back to live operational year
 */
export function returnToLiveActiveYear(): void {
  setSelectedBrowsingYear(getActiveFiscalYear());
}
