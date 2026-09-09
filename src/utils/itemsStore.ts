import { Item } from '../components/Items';
import { DB_ITEMS_KEY } from './sequences';

export const DEFAULT_INITIAL_ITEMS: Item[] = [
  { 
    id: '1', 
    code: '1', 
    name: 'لابتوب ديل انسبايرون', 
    barcode: '1234567890123', 
    category: 'إلكترونيات', 
    unit: 'حبة / قطعة', 
    costPrice: 1500, 
    wholesalePrice: 1750, 
    retailPrice: 1900, 
    consumerPrice: 2000, 
    salePrice: 2000, 
    stock: 14, 
    minReorderLevel: 20, 
    taxRate: 15, 
    isActive: true 
  },
  { 
    id: '2', 
    code: '2', 
    name: 'أرز بسمتي درجة أولى', 
    barcode: '1234567890124', 
    category: 'مواد غذائية', 
    unit: 'شيكارة', 
    costPrice: 120, 
    wholesalePrice: 135, 
    retailPrice: 150, 
    consumerPrice: 160, 
    salePrice: 160, 
    stock: 45, 
    minReorderLevel: 25, 
    taxRate: 0, 
    isActive: true 
  },
  { 
    id: '3', 
    code: '3', 
    name: 'سكر أبيض ناعم', 
    barcode: '1234567890125', 
    category: 'مواد غذائية', 
    unit: 'شوال', 
    costPrice: 90, 
    wholesalePrice: 100, 
    retailPrice: 110, 
    consumerPrice: 115, 
    salePrice: 115, 
    stock: 6, 
    minReorderLevel: 25, 
    taxRate: 0, 
    isActive: true 
  },
  { 
    id: '4', 
    code: '4', 
    name: 'شاي أسود فاخر 100 فتلة', 
    barcode: '1234567890126', 
    category: 'مواد غذائية', 
    unit: 'باكت / علبة', 
    costPrice: 18, 
    wholesalePrice: 21, 
    retailPrice: 24, 
    consumerPrice: 26, 
    salePrice: 26, 
    stock: 80, 
    minReorderLevel: 30, 
    taxRate: 15, 
    isActive: true 
  },
  {
    id: '5',
    code: '5',
    name: 'زيت دوار الشمس نقي 1.5 لتر',
    barcode: '1234567890127',
    category: 'مواد غذائية',
    unit: 'حبة / قطعة',
    costPrice: 14,
    wholesalePrice: 16,
    retailPrice: 18,
    consumerPrice: 19.5,
    salePrice: 19.5,
    stock: 120,
    minReorderLevel: 35,
    taxRate: 15,
    isActive: true
  },
  {
    id: '6',
    code: '6',
    name: 'طابعة ليزر متعددة الوظائف HP',
    barcode: '1234567890128',
    category: 'إلكترونيات',
    unit: 'حبة / قطعة',
    costPrice: 850,
    wholesalePrice: 950,
    retailPrice: 1050,
    consumerPrice: 1100,
    salePrice: 1100,
    stock: 0,
    minReorderLevel: 8,
    taxRate: 15,
    isActive: true
  },
  {
    id: '7',
    code: '7',
    name: 'شاشة سامسونج 27 بوصة IPS',
    barcode: '1234567890129',
    category: 'إلكترونيات',
    unit: 'حبة / قطعة',
    costPrice: 620,
    wholesalePrice: 700,
    retailPrice: 780,
    consumerPrice: 820,
    salePrice: 820,
    stock: 12,
    minReorderLevel: 15,
    taxRate: 15,
    isActive: true
  },
  {
    id: '8',
    code: '8',
    name: 'لوحة مفاتيح وماوس لاسلكي لوجيتك',
    barcode: '1234567890130',
    category: 'إلكترونيات',
    unit: 'طقم',
    costPrice: 85,
    wholesalePrice: 105,
    retailPrice: 120,
    consumerPrice: 135,
    salePrice: 135,
    stock: 40,
    minReorderLevel: 15,
    taxRate: 15,
    isActive: true
  }
];

export function loadStoredItems(): Item[] {
  if (typeof window === 'undefined') return DEFAULT_INITIAL_ITEMS;
  try {
    const raw = localStorage.getItem(DB_ITEMS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading stored items:', e);
  }
  
  try {
    localStorage.setItem(DB_ITEMS_KEY, JSON.stringify(DEFAULT_INITIAL_ITEMS));
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_INITIAL_ITEMS;
}

/**
 * Normalizes Arabic text for lenient character-by-character search
 */
export function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[\u064B-\u065F]/g, ''); // Remove tashkeel/diacritics
}

/**
 * Advanced fuzzy search across item name, code, barcode, and category
 */
export function searchItems(query: string, itemsList?: Item[]): Item[] {
  const items = itemsList || loadStoredItems();
  if (!query || !query.trim()) {
    return items.filter(i => i.isActive !== false);
  }

  const cleanQ = normalizeArabic(query);
  const rawQ = query.trim().toLowerCase();

  return items
    .filter(item => {
      if (item.isActive === false) return false;
      const normalizedName = normalizeArabic(item.name || '');
      const normalizedCategory = normalizeArabic(item.category || '');
      const code = (item.code || '').toLowerCase();
      const barcode = (item.barcode || '').toLowerCase();

      // Check match in name, code, barcode or category
      return (
        normalizedName.includes(cleanQ) ||
        code.includes(rawQ) ||
        barcode.includes(rawQ) ||
        normalizedCategory.includes(cleanQ)
      );
    })
    .sort((a, b) => {
      // Prioritize exact prefix match
      const aName = normalizeArabic(a.name || '');
      const bName = normalizeArabic(b.name || '');
      const aStarts = aName.startsWith(cleanQ);
      const bStarts = bName.startsWith(cleanQ);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return 0;
    });
}
