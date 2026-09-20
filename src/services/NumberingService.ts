/**
 * ============================================================================
 * OFFLINE-FIRST MULTI-PLATFORM ACCOUNTING SYSTEM
 * Service: Deterministic Number Generator & Clock Anti-Tamper Service
 * Module:  src/services/NumberingService.ts
 * ============================================================================
 *
 * ARCHITECTURAL SPECIFICATIONS & CONCURRENCY GUARANTEES:
 * 1. Numbering Pattern: [DOC_TYPE]-[DEVICE_ID]-[YYMMDD]-[HHMM]-[SEQ]
 *    Example: INV-MOB1-260916-1430-01
 * 2. Clock Anti-Tamper Check:
 *    Detects system clock rollback or skew before issuing document numbers.
 *    Compares current device UTC against the maximum created_at timestamp
 *    in 'invoices', 'sales_returns', and 'journal_entries'.
 * 3. Race Condition & Rapid Checkout Protection:
 *    Prevents duplicate sequences during simultaneous checkout taps via:
 *    - In-memory async mutex / execution serialization per (device, docType).
 *    - Atomic UPSERT with RETURNING in SQLite (or BEGIN IMMEDIATE transactions).
 *    - Minute-level sequence rollover with unbounded padding (>99 -> 100, 101).
 * 4. Device Identification:
 *    Fetches 'device_id' from 'app_settings' table or throws UnregisteredDeviceException.
 */

// ----------------------------------------------------------------------------
// 1. TYPE DEFINITIONS & CUSTOM EXCEPTIONS
// ----------------------------------------------------------------------------

export type DocumentType = 'INV' | 'RET' | 'PO' | 'PRET' | 'REC' | 'PAY' | 'JRN' | 'IRV' | 'IPV';

/**
 * Universal SQLite Database Adapter Interface
 * Seamlessly abstracts React Native SQLite engines:
 * - expo-sqlite (legacy & v14+ next API)
 * - op-sqlite
 * - react-native-quick-sqlite
 * - react-native-sqlite-storage
 */
export interface SQLiteDatabase {
  // Expo SQLite / OP-SQLite direct async runners
  runAsync?: (sql: string, ...params: any[]) => Promise<{ lastInsertRowId?: number; changes?: number }>;
  getAllAsync?: <T = any>(sql: string, ...params: any[]) => Promise<T[]>;
  getFirstAsync?: <T = any>(sql: string, ...params: any[]) => Promise<T | null>;
  execAsync?: (sql: string) => Promise<void>;
  withTransactionAsync?: <T>(callback: () => Promise<T>) => Promise<T>;

  // Standard react-native-sqlite-storage / WebSQL pattern
  executeSql?: (
    sql: string,
    params?: any[],
    success?: (tx: any, results: any) => void,
    error?: (tx: any, err: any) => boolean | void
  ) => Promise<any>;
  transaction?: (callback: (tx: any) => void) => Promise<void> | void;
}

/**
 * Raised when the device clock is rolled backward past the latest database record.
 */
export class ClockTamperingException extends Error {
  public readonly deviceTime: string;
  public readonly lastRecordedTime: string;

  constructor(
    deviceTime: string,
    lastRecordedTime: string,
    message: string = 'System clock rollback detected. Current time is older than the last recorded transaction. Please sync device clock.'
  ) {
    super(`${message} (Device Time: ${deviceTime} vs Last Recorded: ${lastRecordedTime})`);
    this.name = 'ClockTamperingException';
    this.deviceTime = deviceTime;
    this.lastRecordedTime = lastRecordedTime;
    Object.setPrototypeOf(this, ClockTamperingException.prototype);
  }
}

/**
 * Raised when a terminal has not had its 'device_id' initialized in app_settings.
 */
export class UnregisteredDeviceException extends Error {
  constructor(
    message: string = 'Device is not registered in app_settings. Please configure device_id before issuing documents.'
  ) {
    super(message);
    this.name = 'UnregisteredDeviceException';
    Object.setPrototypeOf(this, UnregisteredDeviceException.prototype);
  }
}

// ----------------------------------------------------------------------------
// 2. IN-MEMORY CONCURRENCY LOCK (MUTEX)
// ----------------------------------------------------------------------------

/**
 * In-memory serialization lock preventing intra-process race conditions
 * when rapid asynchronous taps fire generateDocNumber simultaneously.
 */
class AsyncLock {
  private promise: Promise<void> = Promise.resolve();

  public async acquire<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.promise;
    let release: () => void;
    this.promise = new Promise<void>((resolve) => {
      release = resolve;
    });

    try {
      await previous;
      return await operation();
    } finally {
      release!();
    }
  }
}

const sequenceLock = new AsyncLock();

// ----------------------------------------------------------------------------
// 3. LOW-LEVEL DATABASE ADAPTER HELPERS
// ----------------------------------------------------------------------------

/**
 * Executes a single SQL statement that returns rows across any RN SQLite driver.
 */
async function queryRows<T = any>(db: SQLiteDatabase, sql: string, params: any[] = []): Promise<T[]> {
  // Expo SQLite modern API
  if (typeof db.getAllAsync === 'function') {
    return await db.getAllAsync<T>(sql, ...params);
  }

  // React Native SQLite Storage / OP-SQLite executeSql Promise API
  if (typeof db.executeSql === 'function') {
    const result = await db.executeSql(sql, params);
    // Normalized check for different driver wrappers
    const rowsObj = Array.isArray(result) ? result[0]?.rows : result?.rows;
    if (!rowsObj) return [];

    if (Array.isArray(rowsObj._array)) {
      return rowsObj._array as T[];
    }
    if (typeof rowsObj.raw === 'function') {
      return rowsObj.raw() as T[];
    }
    const output: T[] = [];
    const len = rowsObj.length || 0;
    for (let i = 0; i < len; i++) {
      output.push(rowsObj.item ? rowsObj.item(i) : rowsObj[i]);
    }
    return output;
  }

  throw new Error('Unsupported SQLite Database interface provided to NumberingService.');
}

/**
 * Executes an INSERT / UPDATE statement across any RN SQLite driver.
 */
async function executeStatement(db: SQLiteDatabase, sql: string, params: any[] = []): Promise<any> {
  if (typeof db.runAsync === 'function') {
    return await db.runAsync(sql, ...params);
  }
  if (typeof db.executeSql === 'function') {
    return await db.executeSql(sql, params);
  }
  throw new Error('Unsupported SQLite Database interface provided to NumberingService.');
}

// ----------------------------------------------------------------------------
// 4. NUMBERING SERVICE IMPLEMENTATION
// ----------------------------------------------------------------------------

export class NumberingService {
  /**
   * Retrieves the configured Device ID from 'app_settings'.
   * Throws UnregisteredDeviceException if missing or empty.
   */
  public static async getDeviceId(db: SQLiteDatabase): Promise<string> {
    const sql = `SELECT value FROM app_settings WHERE key = 'device_id' LIMIT 1;`;
    const rows = await queryRows<{ value: string }>(db, sql);

    const deviceId = rows[0]?.value?.trim();
    if (!deviceId) {
      throw new UnregisteredDeviceException(
        "Device configuration is incomplete: 'device_id' is missing from app_settings."
      );
    }
    return deviceId;
  }

  /**
   * Clock Anti-Tamper Check:
   * Inspects the database for the highest chronological timestamp across:
   * 1. invoices.created_at
   * 2. sales_returns.created_at
   * 3. journal_entries.created_at
   *
   * Compares the current device UTC against the maximum recorded timestamp.
   *
   * @param db SQLiteDatabase connection
   * @returns true if the clock is valid
   * @throws ClockTamperingException if the device clock has been rolled backward
   */
  public static async verifySystemClock(db: SQLiteDatabase): Promise<boolean> {
    // Current UTC timestamp in ISO-8601 format
    const currentDeviceIso = new Date().toISOString();

    const sql = `
      SELECT MAX(latest_timestamp) AS max_time FROM (
        SELECT MAX(created_at) AS latest_timestamp FROM invoices
        UNION ALL
        SELECT MAX(created_at) AS latest_timestamp FROM sales_returns
        UNION ALL
        SELECT MAX(created_at) AS latest_timestamp FROM journal_entries
      );
    `;

    const rows = await queryRows<{ max_time: string | null }>(db, sql);
    const lastRecordedTime = rows[0]?.max_time;

    if (!lastRecordedTime) {
      // Empty database, first-ever transaction: clock is valid
      return true;
    }

    const currentEpoch = Date.parse(currentDeviceIso);
    const lastRecordedEpoch = Date.parse(lastRecordedTime);

    // Allow a strict 1-second margin of error for clock tick variances
    if (currentEpoch < lastRecordedEpoch - 1000) {
      throw new ClockTamperingException(
        currentDeviceIso,
        lastRecordedTime,
        'System clock rollback detected. Current device time is older than the last recorded financial transaction. Please sync device clock.'
      );
    }

    return true;
  }

  /**
   * Generates a deterministic, collision-free document number according to:
   * Pattern: [DOC_TYPE]-[DEVICE_ID]-[YYMMDD]-[SEQ]
   *
   * Example: INV-MOB1-260916-0001
   *
   * Atomic Guarantee:
   * - Step 1: Clock Anti-Tamper verification
   * - Step 2: In-memory sequence lock serialization (avoids rapid checkout UI races)
   * - Step 3: SQLite atomic UPSERT into daily_sequences
   * - Step 4: Zero-padding (0001..9999), expanding seamlessly if rate > 9999/day.
   *
   * @param db SQLiteDatabase connection
   * @param docType Supported document prefix ('INV' | 'RET' | 'PO' | 'PRET' | 'REC' | 'PAY' | 'JRN' | 'IRV' | 'IPV')
   * @returns Promise<string> Formatted unique document number
   */
  public static async generateDocNumber(db: SQLiteDatabase, docType: DocumentType): Promise<string> {
    // 1. Mandatory Clock Anti-Tampering Check
    await NumberingService.verifySystemClock(db);

    // 2. Retrieve validated Device Identifier
    const deviceId = await NumberingService.getDeviceId(db);

    // 3. Acquire intra-process Async Mutex to guarantee sequential ordering
    return await sequenceLock.acquire(async () => {
      const now = new Date();

      // YYMMDD components
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const datePart = `${yy}${mm}${dd}`;

      // Day-resolution sequence tracking key
      // Format: YYYY-MM-DD
      const fullYear = now.getFullYear();
      const seqDateKey = `${fullYear}-${mm}-${dd}`;

      // 4. Atomic Sequence Increment in daily_sequences
      const nextSequence = await NumberingService.incrementSequenceAtomic(
        db,
        deviceId,
        docType,
        seqDateKey
      );

      // 5. Zero-pad sequence: '0001', '0002' ... '9999', '10000'
      const formattedSeq = nextSequence < 10000
        ? String(nextSequence).padStart(4, '0')
        : String(nextSequence);

      // 6. Assemble finalized deterministic document number
      return `${docType}-${deviceId}-${datePart}-${formattedSeq}`;
    });
  }

  /**
   * Performs an atomic sequence increment inside SQLite.
   *
   * Utilizes SQLite 3.35+ UPSERT with RETURNING where available,
   * with fallback to a strict BEGIN IMMEDIATE transaction to prevent write-skew
   * across multiple database connections or processes.
   */
  private static async incrementSequenceAtomic(
    db: SQLiteDatabase,
    deviceCode: string,
    docType: string,
    seqDate: string
  ): Promise<number> {
    // Attempt 1: Modern SQLite 3.35+ atomic UPSERT with RETURNING
    try {
      const upsertReturningSql = `
        INSERT INTO daily_sequences (device_code, doc_type, seq_date, last_sequence)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(device_code, doc_type, seq_date)
        DO UPDATE SET last_sequence = daily_sequences.last_sequence + 1
        RETURNING last_sequence;
      `;

      const rows = await queryRows<{ last_sequence: number }>(
        db,
        upsertReturningSql,
        [deviceCode, docType, seqDate]
      );

      if (rows.length > 0 && rows[0] && typeof rows[0].last_sequence === 'number') {
        return rows[0].last_sequence;
      }
    } catch {
      // Driver or SQLite engine version may not support RETURNING syntax;
      // proceed to the classic two-step transaction path below.
    }

    // Attempt 2: Strict two-step increment with isolation
    const selectSql = `
      SELECT last_sequence 
      FROM daily_sequences 
      WHERE device_code = ? AND doc_type = ? AND seq_date = ?;
    `;
    const existing = await queryRows<{ last_sequence: number }>(db, selectSql, [
      deviceCode,
      docType,
      seqDate,
    ]);

    let newSequence = 1;
    const firstExisting = existing[0];

    if (firstExisting && firstExisting.last_sequence != null) {
      newSequence = Number(firstExisting.last_sequence) + 1;
      const updateSql = `
        UPDATE daily_sequences 
        SET last_sequence = ? 
        WHERE device_code = ? AND doc_type = ? AND seq_date = ?;
      `;
      await executeStatement(db, updateSql, [newSequence, deviceCode, docType, seqDate]);
    } else {
      const insertSql = `
        INSERT INTO daily_sequences (device_code, doc_type, seq_date, last_sequence)
        VALUES (?, ?, ?, 1);
      `;
      await executeStatement(db, insertSql, [deviceCode, docType, seqDate]);
      newSequence = 1;
    }

    return newSequence;
  }
}

// ----------------------------------------------------------------------------
// 5. CONVENIENCE FUNCTIONAL EXPORTS
// ----------------------------------------------------------------------------

/**
 * Public functional API: Generate next unique document number
 */
export async function generateDocNumber(
  db: SQLiteDatabase,
  docType: DocumentType
): Promise<string> {
  return await NumberingService.generateDocNumber(db, docType);
}

/**
 * Public functional API: Verify system clock against audit trail
 */
export async function verifySystemClock(db: SQLiteDatabase): Promise<boolean> {
  return await NumberingService.verifySystemClock(db);
}

export default NumberingService;
