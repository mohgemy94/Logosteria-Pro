// src/server/cacheService.ts
/**
 * In-Memory Caching Engine with TTL and Event-Driven Invalidation
 * مصمم خصيصاً للأنظمة المالية لتسريع شجرة الحسابات واستعلامات الأرصدة التراكمية
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number | null; // null يعني دائم حتى يتم الإبطال بالحدث
  createdAt: number;
  hits: number;
}

export interface CacheStats {
  size: number;
  totalHits: number;
  totalMisses: number;
  keys: string[];
}

export class MemoryCacheService {
  private store: Map<string, CacheEntry<any>> = new Map();
  private hitsCount = 0;
  private missesCount = 0;

  /**
   * جلب القيمة من الكاش إذا كانت صالحة ولم تنتهِ صلاحيتها
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.missesCount++;
      return null;
    }

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.missesCount++;
      return null;
    }

    entry.hits++;
    this.hitsCount++;
    return entry.data as T;
  }

  /**
   * حفظ قيمة في الكاش مع مدة صلاحية اختيارية (بالمللي ثانية)
   * الافتراضي: 5 دقائق (300,000ms)
   */
  set<T>(key: string, data: T, ttlMs: number | null = 300_000): void {
    const expiresAt = ttlMs !== null ? Date.now() + ttlMs : null;
    this.store.set(key, {
      data,
      expiresAt,
      createdAt: Date.now(),
      hits: 0,
    });
  }

  /**
   * حذف مفتاح محدد
   */
  del(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * إبطال جماعي بالمطابقة (Prefix / Pattern Invalidation)
   * مثال: invalidatePrefix("chart_tree:tenant_default")
   */
  invalidatePrefix(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * تفريغ كامل الكاش
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * إحصائيات أداء الكاش
   */
  getStats(): CacheStats {
    return {
      size: this.store.size,
      totalHits: this.hitsCount,
      totalMisses: this.missesCount,
      keys: Array.from(this.store.keys()),
    };
  }
}

// تصدير كائن أحادي (Singleton)
export const appCache = new MemoryCacheService();
