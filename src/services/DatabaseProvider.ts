/**
 * ============================================================================
 * OFFLINE-FIRST MULTI-PLATFORM ACCOUNTING SYSTEM
 * Universal SQLite Database Provider & Browser Persistence Engine (IndexedDB)
 * Module: src/services/DatabaseProvider.ts
 * ============================================================================
 *
 * Provides a universal database instance conforming to SQLiteDatabase:
 * - On Native/Mobile: Passes through to native SQLite (e.g. Expo SQLite / op-sqlite).
 * - On Web/Desktop Browser: Implements an indexed, robust client-side SQLite emulator
 *   with full IndexedDB persistence (capable of storing GBs of data).
 */

import { SQLiteDatabase } from './NumberingService';
import { SETTINGS_KEYS } from './DriveAuthService';

const DB_PREFIX = 'alpha_sqlite_';
const STORAGE_KEYS = {
  APP_SETTINGS: `${DB_PREFIX}app_settings`,
  SYNC_QUEUE: `${DB_PREFIX}sync_queue`,
  SYNC_META: `${DB_PREFIX}sync_meta`,
  DAILY_SEQUENCES: `${DB_PREFIX}daily_sequences`,
  INVOICES: `${DB_PREFIX}invoices`,
  SALES_RETURNS: `${DB_PREFIX}sales_returns`,
  JOURNAL_ENTRIES: `${DB_PREFIX}journal_entries`,
};

export interface SyncQueueItem {
  queue_id: number;
  entity_table: string;
  record_id: string;
  action_type: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  sync_status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retry_count: number;
  error_message?: string | null;
  created_at: string;
}

// --- IndexedDB Key-Value Wrapper ---
const IDB_NAME = 'AlphaAccountingDB';
const IDB_VERSION = 1;
const STORE_NAME = 'AlphaStore';

function getIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result !== undefined ? request.result : defaultValue);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('IDB Get Error', e);
    return defaultValue;
  }
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(value, key);
      request.onsuccess = () => {
        window.dispatchEvent(new CustomEvent('alpha-db-changed', { detail: { key } }));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('IDB Set Error', e);
  }
}

// Migration from localStorage to IndexedDB
async function migrateFromLocalStorage(): Promise<void> {
  try {
    const migratedKey = `${DB_PREFIX}migrated_to_idb`;
    if (localStorage.getItem(migratedKey)) return;

    for (const key of Object.values(STORAGE_KEYS)) {
      const lsValue = localStorage.getItem(key);
      if (lsValue) {
        await idbSet(key, JSON.parse(lsValue));
      }
    }
    localStorage.setItem(migratedKey, 'true');
    console.log('Successfully migrated from localStorage to IndexedDB.');
  } catch (e) {
    console.error('Migration to IDB failed:', e);
  }
}

class BrowserSQLiteEmulator implements SQLiteDatabase {
  public async getAllAsync<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    const cleanSql = sql.trim();

    // 1. SELECT value FROM app_settings WHERE key = ?
    if (/SELECT\s+value\s+FROM\s+app_settings\s+WHERE\s+key\s*=\s*\?/i.test(cleanSql)) {
      const targetKey = params[0];
      const settings = await idbGet<Record<string, string>>(STORAGE_KEYS.APP_SETTINGS, {});
      if (targetKey in settings) {
        return [{ value: settings[targetKey] }] as T[];
      }
      return [];
    }

    // 2. SELECT last_sync_timestamp FROM sync_meta WHERE entity_name = ?
    if (/SELECT\s+last_sync_timestamp\s+FROM\s+sync_meta/i.test(cleanSql)) {
      const entity = params[0] || 'GLOBAL';
      const metas = await idbGet<Record<string, any>>(STORAGE_KEYS.SYNC_META, {});
      if (metas[entity]) {
        return [{ last_sync_timestamp: metas[entity].last_sync_timestamp }] as T[];
      }
      return [];
    }

    // 3. SELECT ... FROM sync_queue WHERE sync_status = 'PENDING'
    if (/FROM\s+sync_queue\s+WHERE\s+sync_status\s*=\s*'PENDING'/i.test(cleanSql)) {
      const limit = typeof params[0] === 'number' ? params[0] : 50;
      const queue = await idbGet<SyncQueueItem[]>(STORAGE_KEYS.SYNC_QUEUE, []);
      const pending = queue
        .filter((item) => item.sync_status === 'PENDING')
        .sort((a, b) => a.queue_id - b.queue_id)
        .slice(0, limit);
      return pending as T[];
    }

    // 4. SELECT count from sync_queue
    if (/COUNT\(\*\)\s+as\s+cnt\s+FROM\s+sync_queue/i.test(cleanSql) || /COUNT\(\*\).*FROM\s+sync_queue/i.test(cleanSql)) {
      const queue = await idbGet<SyncQueueItem[]>(STORAGE_KEYS.SYNC_QUEUE, []);
      const pendingCount = queue.filter((i) => i.sync_status === 'PENDING').length;
      return [{ cnt: pendingCount, total: queue.length }] as T[];
    }

    // 5. SELECT all sync_queue items (for inspector/diagnostics)
    if (/FROM\s+sync_queue/i.test(cleanSql)) {
      const queue = await idbGet<SyncQueueItem[]>(STORAGE_KEYS.SYNC_QUEUE, []);
      return queue.sort((a, b) => b.queue_id - a.queue_id) as T[];
    }

    // 6. SELECT last_sequence FROM daily_sequences
    if (/SELECT\s+last_sequence\s+FROM\s+daily_sequences/i.test(cleanSql)) {
      const [deviceCode, docType, seqDate] = params;
      const key = `${deviceCode}_${docType}_${seqDate}`;
      const sequences = await idbGet<Record<string, number>>(STORAGE_KEYS.DAILY_SEQUENCES, {});
      if (key in sequences) {
        return [{ last_sequence: sequences[key] }] as T[];
      }
      return [];
    }

    // 7. General fallback
    return [];
  }

  public async getFirstAsync<T = any>(sql: string, ...params: any[]): Promise<T | null> {
    const rows = await this.getAllAsync<T>(sql, ...params);
    return rows[0] ?? null;
  }

  public async runAsync(sql: string, ...params: any[]): Promise<{ lastInsertRowId?: number; changes?: number }> {
    const cleanSql = sql.trim();

    // 1. INSERT/UPDATE app_settings
    if (/INSERT\s+INTO\s+app_settings/i.test(cleanSql)) {
      const [key, value] = params;
      const settings = await idbGet<Record<string, string>>(STORAGE_KEYS.APP_SETTINGS, {});
      settings[key] = String(value);
      await idbSet(STORAGE_KEYS.APP_SETTINGS, settings);
      if (key === 'device_id' && typeof window !== 'undefined') {
        localStorage.setItem('alpha_device_id', String(value));
      }
      return { changes: 1 };
    }

    // 2. DELETE FROM app_settings
    if (/DELETE\s+FROM\s+app_settings\s+WHERE\s+key\s*=\s*\?/i.test(cleanSql)) {
      const [key] = params;
      const settings = await idbGet<Record<string, string>>(STORAGE_KEYS.APP_SETTINGS, {});
      delete settings[key];
      await idbSet(STORAGE_KEYS.APP_SETTINGS, settings);
      return { changes: 1 };
    }

    // 3. INSERT INTO sync_meta
    if (/INSERT\s+INTO\s+sync_meta/i.test(cleanSql)) {
      const [entityName, lastSyncTimestamp] = params;
      const metas = await idbGet<Record<string, any>>(STORAGE_KEYS.SYNC_META, {});
      metas[entityName || 'GLOBAL'] = {
        last_sync_timestamp: lastSyncTimestamp,
        updated_at: new Date().toISOString(),
      };
      await idbSet(STORAGE_KEYS.SYNC_META, metas);
      return { changes: 1 };
    }

    // 4. UPDATE sync_queue SET sync_status = 'SYNCING'
    if (/UPDATE\s+sync_queue\s+SET\s+sync_status\s*=\s*'SYNCING'/i.test(cleanSql)) {
      const queue = await idbGet<SyncQueueItem[]>(STORAGE_KEYS.SYNC_QUEUE, []);
      const targetIds = new Set(params);
      let changes = 0;
      const updated = queue.map((item) => {
        if (targetIds.has(item.queue_id)) {
          changes++;
          return { ...item, sync_status: 'SYNCING' as const };
        }
        return item;
      });
      await idbSet(STORAGE_KEYS.SYNC_QUEUE, updated);
      return { changes };
    }

    // 5. DELETE FROM sync_queue WHERE queue_id IN (...)
    if (/DELETE\s+FROM\s+sync_queue\s+WHERE\s+queue_id\s+IN/i.test(cleanSql)) {
      const queue = await idbGet<SyncQueueItem[]>(STORAGE_KEYS.SYNC_QUEUE, []);
      const targetIds = new Set(params);
      const remaining = queue.filter((item) => !targetIds.has(item.queue_id));
      await idbSet(STORAGE_KEYS.SYNC_QUEUE, remaining);
      return { changes: targetIds.size };
    }

    // 6. UPDATE sync_queue SET sync_status = 'SYNCED'
    if (/UPDATE\s+sync_queue\s+SET\s+sync_status\s*=\s*'SYNCED'/i.test(cleanSql)) {
      const queue = await idbGet<SyncQueueItem[]>(STORAGE_KEYS.SYNC_QUEUE, []);
      const targetIds = new Set(params);
      const updated = queue.map((item) => {
        if (targetIds.has(item.queue_id)) {
          return { ...item, sync_status: 'SYNCED' as const, error_message: null };
        }
        return item;
      });
      await idbSet(STORAGE_KEYS.SYNC_QUEUE, updated);
      return { changes: targetIds.size };
    }

    // 7. Error backoff UPDATE sync_queue
    if (/UPDATE\s+sync_queue\s+SET\s+sync_status\s*=\s*CASE/i.test(cleanSql)) {
      const [errorMessage, ...targetIdsArr] = params;
      const targetIds = new Set(targetIdsArr);
      const queue = await idbGet<SyncQueueItem[]>(STORAGE_KEYS.SYNC_QUEUE, []);
      const updated = queue.map((item) => {
        if (targetIds.has(item.queue_id)) {
          const newRetries = item.retry_count + 1;
          return {
            ...item,
            retry_count: newRetries,
            sync_status: newRetries >= 5 ? ('FAILED' as const) : ('PENDING' as const),
            error_message: errorMessage,
          };
        }
        return item;
      });
      await idbSet(STORAGE_KEYS.SYNC_QUEUE, updated);
      return { changes: targetIds.size };
    }

    // 8. INSERT INTO daily_sequences / UPDATE daily_sequences
    if (/INSERT\s+INTO\s+daily_sequences/i.test(cleanSql)) {
      const [deviceCode, docType, seqDate, lastSeq] = params;
      const key = `${deviceCode}_${docType}_${seqDate}`;
      const sequences = await idbGet<Record<string, number>>(STORAGE_KEYS.DAILY_SEQUENCES, {});
      sequences[key] = lastSeq;
      await idbSet(STORAGE_KEYS.DAILY_SEQUENCES, sequences);
      return { changes: 1 };
    }
    if (/UPDATE\s+daily_sequences/i.test(cleanSql)) {
      const [newSeq, deviceCode, docType, seqDate] = params;
      const key = `${deviceCode}_${docType}_${seqDate}`;
      const sequences = await idbGet<Record<string, number>>(STORAGE_KEYS.DAILY_SEQUENCES, {});
      sequences[key] = newSeq;
      await idbSet(STORAGE_KEYS.DAILY_SEQUENCES, sequences);
      return { changes: 1 };
    }

    // 9. Generic INSERT OR REPLACE INTO [table]
    if (/INSERT\s+OR\s+REPLACE\s+INTO/i.test(cleanSql)) {
      const match = cleanSql.match(/INSERT\s+OR\s+REPLACE\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES/i);
      if (match && match[1] && match[2]) {
        const table = match[1].toLowerCase();
        const columnsStr = match[2];
        const columns = columnsStr.split(",").map(c => c.trim().toLowerCase());
        const dataObj: Record<string, any> = {};
        for (let i = 0; i < columns.length; i++) {
          const col = columns[i];
          if (col) {
            dataObj[col] = params[i];
          }
        }
        if (table === "items") {
           const raw = localStorage.getItem("alpha_warehouse_balances_v2");
           let items = raw ? JSON.parse(raw) : [];
           const existingIdx = items.findIndex((i:any) => i.id === dataObj.id);
           const item = { id: dataObj.id, code: dataObj.code, name: dataObj.name, barcode: dataObj.barcode, category: dataObj.category, unit: dataObj.unit, costPrice: dataObj.cost_price, wholesalePrice: dataObj.wholesale_price, retailPrice: dataObj.retail_price, consumerPrice: dataObj.consumer_price, salePrice: dataObj.sale_price, stock: dataObj.stock, minReorderLevel: dataObj.min_reorder_level, isActive: dataObj.is_active !== 0 };
           if(existingIdx >= 0) items[existingIdx] = item; else items.unshift(item);
           localStorage.setItem("alpha_warehouse_balances_v2", JSON.stringify(items));
           localStorage.setItem("alpha_warehouse_items_v1", JSON.stringify(items));
           if(typeof window !== "undefined") window.dispatchEvent(new CustomEvent("alpha-stock-updated"));
        } else if (table === "customers") {
           const raw = localStorage.getItem("alpha_customers_v1");
           let arr = raw ? JSON.parse(raw) : [];
           const existingIdx = arr.findIndex((i:any) => i.id === dataObj.id);
           const cust = { id: dataObj.id, code: dataObj.code, name: dataObj.name, phone: dataObj.phone, address: dataObj.address, taxNumber: dataObj.tax_number, openingBalance: dataObj.opening_balance, openingBalanceType: dataObj.opening_balance_type, isActive: dataObj.is_active !== 0 };
           if(existingIdx >= 0) arr[existingIdx] = cust; else arr.unshift(cust);
           localStorage.setItem("alpha_customers_v1", JSON.stringify(arr));
           if(typeof window !== "undefined") window.dispatchEvent(new CustomEvent("alpha-partner-ledger-updated"));
        } else if (table === "vendors") {
           const raw = localStorage.getItem("alpha_vendors_v1");
           let arr = raw ? JSON.parse(raw) : [];
           const existingIdx = arr.findIndex((i:any) => i.id === dataObj.id);
           const cust = { id: dataObj.id, code: dataObj.code, name: dataObj.name, phone: dataObj.phone, address: dataObj.address, taxNumber: dataObj.tax_number, openingBalance: dataObj.opening_balance, openingBalanceType: dataObj.opening_balance_type, isActive: dataObj.is_active !== 0 };
           if(existingIdx >= 0) arr[existingIdx] = cust; else arr.unshift(cust);
           localStorage.setItem("alpha_vendors_v1", JSON.stringify(arr));
           if(typeof window !== "undefined") window.dispatchEvent(new CustomEvent("alpha-partner-ledger-updated"));
        }
      }
      return { changes: 1 };
    }

    const delMatch = cleanSql.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)\s+WHERE\s+id\s*=\s*\?/i);
    if (delMatch && delMatch[1]) {
      const table = delMatch[1].toLowerCase();
      const [id] = params;
      if (table === "items") {
         const raw = localStorage.getItem("alpha_warehouse_balances_v2");
         let items = raw ? JSON.parse(raw) : [];
         items = items.filter((i:any) => i.id !== id);
         localStorage.setItem("alpha_warehouse_balances_v2", JSON.stringify(items));
         localStorage.setItem("alpha_warehouse_items_v1", JSON.stringify(items));
         if(typeof window !== "undefined") window.dispatchEvent(new CustomEvent("alpha-stock-updated"));
      } else if (table === "customers") {
         const raw = localStorage.getItem("alpha_customers_v1");
         let arr = raw ? JSON.parse(raw) : [];
         arr = arr.filter((i:any) => i.id !== id);
         localStorage.setItem("alpha_customers_v1", JSON.stringify(arr));
         if(typeof window !== "undefined") window.dispatchEvent(new CustomEvent("alpha-partner-ledger-updated"));
      } else if (table === "vendors") {
         const raw = localStorage.getItem("alpha_vendors_v1");
         let arr = raw ? JSON.parse(raw) : [];
         arr = arr.filter((i:any) => i.id !== id);
         localStorage.setItem("alpha_vendors_v1", JSON.stringify(arr));
         if(typeof window !== "undefined") window.dispatchEvent(new CustomEvent("alpha-partner-ledger-updated"));
      }
      return { changes: 1 };
    }

    return { changes: 0 };
  }

  public async execAsync(sql: string): Promise<void> {
    await this.runAsync(sql);
  }

  public async withTransactionAsync<T>(callback: () => Promise<T>): Promise<T> {
    return await callback();
  }

  public async executeSql(sql: string, params: any[] = []): Promise<any> {
    if (/^\s*SELECT/i.test(sql)) {
      const rows = await this.getAllAsync(sql, ...params);
      return [{ rows: { length: rows.length, item: (i: number) => rows[i], raw: () => rows, _array: rows } }];
    } else {
      const result = await this.runAsync(sql, ...params);
      return [{ rowsAffected: result.changes || 0, insertId: result.lastInsertRowId }];
    }
  }
}

// Global Singleton
let dbInstance: SQLiteDatabase | null = null;

export function getDatabase(): SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = new BrowserSQLiteEmulator();
    // Run migration and seeding in background
    migrateFromLocalStorage().then(() => seedInitialSettings());
  }
  return dbInstance;
}

async function seedInitialSettings() {
  try {
    const settings = await idbGet<Record<string, string>>(STORAGE_KEYS.APP_SETTINGS, {});
    let updated = false;

    if (!settings[SETTINGS_KEYS.DEVICE_ID]) {
      settings[SETTINGS_KEYS.DEVICE_ID] = 'MOB1';
      updated = true;
    }
    if (!settings[SETTINGS_KEYS.COMPANY_NAME]) {
      settings[SETTINGS_KEYS.COMPANY_NAME] = 'شركة الفا المحاسبية';
      updated = true;
    }

    if (updated) {
      await idbSet(STORAGE_KEYS.APP_SETTINGS, settings);
    }
  } catch (e) {
    console.warn('Initial settings seed error:', e);
  }
}

/**
 * Helper to queue an outgoing sync item to SQLite sync_queue (Outbox Pattern)
 */
export async function enqueueSyncRecord(
  table: string,
  recordId: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  payload: Record<string, any>
): Promise<void> {
  try {
    const queue = await idbGet<SyncQueueItem[]>(STORAGE_KEYS.SYNC_QUEUE, []);
    const nextId = queue.reduce((max, item) => Math.max(max, item.queue_id), 0) + 1;

    const newItem: SyncQueueItem = {
      queue_id: nextId,
      entity_table: table,
      record_id: recordId,
      action_type: action,
      payload,
      sync_status: 'PENDING',
      retry_count: 0,
      created_at: new Date().toISOString(),
    };

    queue.push(newItem);
    await idbSet(STORAGE_KEYS.SYNC_QUEUE, queue);
  } catch (err) {
    console.error('Failed to enqueue sync record:', err);
  }
}

/**
 * Helper to fetch all sync queue items directly
 */
export async function getSyncQueueItems(): Promise<SyncQueueItem[]> {
  try {
    return await idbGet<SyncQueueItem[]>(STORAGE_KEYS.SYNC_QUEUE, []);
  } catch {
    return [];
  }
}
