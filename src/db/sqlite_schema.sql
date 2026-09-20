-- ============================================================================
-- OFFLINE-FIRST MULTI-PLATFORM ACCOUNTING SYSTEM
-- CORE SQLITE DDL, PERFORMANCE INDEXES & OUTBOX SYNC TRIGGERS
-- Engine: SQLite 3.38+ (Native JSON functions, WAL Mode, Strict Foreign Keys)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. RUNTIME PRAGMAS & ENGINE CONFIGURATION
-- Must be executed upon opening every SQLite connection in Desktop / Mobile
-- ----------------------------------------------------------------------------
PRAGMA foreign_keys = ON;            -- Enforce relational referential integrity
PRAGMA journal_mode = WAL;           -- Write-Ahead Logging for non-blocking concurrent reads & writes
PRAGMA synchronous = NORMAL;         -- Optimum durability vs speed in WAL mode
PRAGMA busy_timeout = 5000;          -- Wait up to 5s on write contention rather than throwing SQLITE_BUSY
PRAGMA auto_vacuum = INCREMENTAL;    -- Reclaim space from deletions periodically

-- ----------------------------------------------------------------------------
-- 1. SYSTEM CONFIGURATION & SYNCHRONIZATION INFRASTRUCTURE
-- ----------------------------------------------------------------------------

-- MASTER DATA (ITEMS, CUSTOMERS, VENDORS)
CREATE TABLE IF NOT EXISTS items (
    id                TEXT PRIMARY KEY NOT NULL,
    code              TEXT NOT NULL,
    name              TEXT NOT NULL,
    barcode           TEXT,
    category          TEXT,
    unit              TEXT,
    cost_price        REAL DEFAULT 0.0,
    wholesale_price   REAL DEFAULT 0.0,
    retail_price      REAL DEFAULT 0.0,
    consumer_price    REAL DEFAULT 0.0,
    sale_price        REAL DEFAULT 0.0,
    stock             REAL DEFAULT 0.0,
    min_reorder_level REAL DEFAULT 0.0,
    is_active         INTEGER DEFAULT 1,
    created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS customers (
    id                TEXT PRIMARY KEY NOT NULL,
    code              TEXT NOT NULL,
    name              TEXT NOT NULL,
    phone             TEXT,
    address           TEXT,
    tax_number        TEXT,
    opening_balance   REAL DEFAULT 0.0,
    opening_balance_type TEXT,
    is_active         INTEGER DEFAULT 1,
    created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS vendors (
    id                TEXT PRIMARY KEY NOT NULL,
    code              TEXT NOT NULL,
    name              TEXT NOT NULL,
    phone             TEXT,
    address           TEXT,
    tax_number        TEXT,
    opening_balance   REAL DEFAULT 0.0,
    opening_balance_type TEXT,
    is_active         INTEGER DEFAULT 1,
    created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Global App Settings (device_id, branch_id, google_folder_id, auth credentials)
CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);

-- Device-Specific Daily Sequences for Distributed, Collision-Free Document Numbering
-- Example: device 'POS-01', doc_type 'INV', seq_date '2026-09-16', last_sequence = 42
-- Generates formatted numbering: INV-POS01-20260916-0042 without requiring server coordination
CREATE TABLE IF NOT EXISTS daily_sequences (
    device_code   TEXT NOT NULL,
    doc_type      TEXT NOT NULL,       -- 'INV', 'RET', 'JRN', etc.
    seq_date      TEXT NOT NULL,       -- 'YYYY-MM-DD'
    last_sequence INTEGER NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
    PRIMARY KEY (device_code, doc_type, seq_date)
);

-- Transactional Outbox Sync Queue (Append-Only Event Log for Google Drive JSON batches)
CREATE TABLE IF NOT EXISTS sync_queue (
    queue_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_table  TEXT NOT NULL,                                                    -- Name of the origin table (e.g. 'invoices')
    record_id     TEXT NOT NULL,                                                    -- Primary key (UUID/ULID) of the entity
    action_type   TEXT NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE')),
    payload       JSON NOT NULL,                                                    -- Full JSON snapshot of the record at event time
    sync_status   TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'SYNCING', 'SYNCED', 'FAILED')),
    retry_count   INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    error_message TEXT,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Entity Sync High-Water Marks & Metadata (tracks last synced timestamp per table)
CREATE TABLE IF NOT EXISTS sync_meta (
    entity_name         TEXT PRIMARY KEY NOT NULL,                                  -- e.g. 'invoices', 'journal_entries'
    last_sync_timestamp TEXT,                                                       -- Timestamp of last successful cloud batch pull/push
    updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 2. FINANCIAL & INVENTORY TABLES
-- ----------------------------------------------------------------------------

-- Sales Invoices (Header)
CREATE TABLE IF NOT EXISTS invoices (
    id               TEXT PRIMARY KEY NOT NULL,                                     -- Client-generated UUIDv4 / ULID
    invoice_number   TEXT UNIQUE NOT NULL,                                          -- Formatted numbering (e.g. INV-DEV01-20260916-0001)
    customer_id      TEXT NOT NULL,                                                 -- Customer UUID
    total_amount     REAL NOT NULL DEFAULT 0.0 CHECK (total_amount >= 0),          -- Gross total before tax and deductions
    tax_amount       REAL NOT NULL DEFAULT 0.0 CHECK (tax_amount >= 0),            -- VAT / Sales Tax
    net_amount       REAL NOT NULL DEFAULT 0.0 CHECK (net_amount >= 0),            -- Final payable amount (total + tax - discounts)
    status           TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED')),
    device_id        TEXT NOT NULL,                                                 -- Device origin node identifier
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    server_timestamp TEXT                                                           -- Populated when acknowledged by cloud sync
);

-- Invoice Line Items (Details)
CREATE TABLE IF NOT EXISTS invoice_items (
    id         TEXT PRIMARY KEY NOT NULL,                                           -- Item line UUID
    invoice_id TEXT NOT NULL,                                                       -- Foreign key to parent invoice
    item_id    TEXT NOT NULL,                                                       -- Master inventory item UUID
    item_name  TEXT NOT NULL,                                                       -- Historical snapshot of item name at time of sale
    quantity   REAL NOT NULL CHECK (quantity > 0),                                  -- Sold quantity (must be strictly positive)
    unit_price REAL NOT NULL CHECK (unit_price >= 0),                               -- Selling price per unit
    discount   REAL NOT NULL DEFAULT 0.0 CHECK (discount >= 0),                     -- Line-level discount amount
    line_total REAL NOT NULL CHECK (line_total >= 0),                               -- Computed line net: (quantity * unit_price) - discount
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- Sales Returns / Credit Notes (Header)
CREATE TABLE IF NOT EXISTS sales_returns (
    id                      TEXT PRIMARY KEY NOT NULL,                              -- Return document UUID
    return_number           TEXT UNIQUE NOT NULL,                                   -- Formatted numbering (e.g. RET-DEV01-20260916-0001)
    original_invoice_id     TEXT,                                                   -- Optional link to original invoice UUID
    original_invoice_number TEXT,                                                   -- Historical invoice number for audit trail
    customer_id             TEXT NOT NULL,                                          -- Customer UUID
    total_amount            REAL NOT NULL DEFAULT 0.0 CHECK (total_amount >= 0),
    tax_amount              REAL NOT NULL DEFAULT 0.0 CHECK (tax_amount >= 0),
    net_amount              REAL NOT NULL DEFAULT 0.0 CHECK (net_amount >= 0),
    return_reason           TEXT,
    device_id               TEXT NOT NULL,
    created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (original_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
);

-- Sales Return Line Items (Details)
CREATE TABLE IF NOT EXISTS sales_return_items (
    id                TEXT PRIMARY KEY NOT NULL,
    return_id         TEXT NOT NULL,
    item_id           TEXT NOT NULL,
    returned_quantity REAL NOT NULL CHECK (returned_quantity > 0),
    unit_price        REAL NOT NULL CHECK (unit_price >= 0),
    line_total        REAL NOT NULL CHECK (line_total >= 0),
    FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE
);

-- General Ledger Journal Entries (Double-Entry Header)
CREATE TABLE IF NOT EXISTS journal_entries (
    id                TEXT PRIMARY KEY NOT NULL,                                    -- Entry UUID
    entry_number      TEXT UNIQUE NOT NULL,                                         -- Formatted numbering (e.g. JRN-DEV01-20260916-0001)
    reference_doc_type TEXT,                                                        -- 'INVOICE', 'SALES_RETURN', 'PAYMENT', 'RECEIPT', 'MANUAL'
    reference_doc_id   TEXT,                                                        -- ID of the originating document
    description       TEXT NOT NULL,
    device_id         TEXT NOT NULL,
    entry_date        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d', 'now')),          -- Accounting date for ledger posting
    created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Journal Lines (Double-Entry Posting Details)
CREATE TABLE IF NOT EXISTS journal_lines (
    id         TEXT PRIMARY KEY NOT NULL,
    entry_id   TEXT NOT NULL,
    account_id TEXT NOT NULL,                                                       -- Chart of accounts code/UUID (e.g. '1101', '4101')
    debit      REAL NOT NULL DEFAULT 0.0 CHECK (debit >= 0),
    credit     REAL NOT NULL DEFAULT 0.0 CHECK (credit >= 0),
    notes      TEXT,
    -- Strict financial integrity: a line must have a positive debit OR credit, and cannot have both non-zero
    CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)),
    FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 3. HIGH-PERFORMANCE QUERY & SYNC INDEXES
-- ----------------------------------------------------------------------------

-- Outbox Sync Processing Queue Indexes:
-- Composite index for fast queue polling: fetch PENDING records ordered by FIFO sequence
CREATE INDEX IF NOT EXISTS idx_sync_queue_status_created 
    ON sync_queue(sync_status, created_at);

-- Index for entity deduplication and queue status inspection by record
CREATE INDEX IF NOT EXISTS idx_sync_queue_entity_record 
    ON sync_queue(entity_table, record_id);

-- Foreign Key & Query Performance Optimization Indexes:
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id 
    ON invoice_items(invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_items_item_id 
    ON invoice_items(item_id);

CREATE INDEX IF NOT EXISTS idx_sales_return_items_return_id 
    ON sales_return_items(return_id);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry_id 
    ON journal_lines(entry_id);

CREATE INDEX IF NOT EXISTS idx_journal_lines_account_id 
    ON journal_lines(account_id);

-- Temporal Audit & Reconciliation Indexes:
CREATE INDEX IF NOT EXISTS idx_invoices_created_at 
    ON invoices(created_at);

CREATE INDEX IF NOT EXISTS idx_invoices_customer_id 
    ON invoices(customer_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_date 
    ON journal_entries(entry_date);

CREATE INDEX IF NOT EXISTS idx_journal_entries_ref 
    ON journal_entries(reference_doc_type, reference_doc_id);

-- ----------------------------------------------------------------------------
-- 4. AUTOMATIC OUTBOX SYNC TRIGGERS (AFTER INSERT)
-- Uses SQLite native json_object() to capture atomic JSON snapshots
-- ----------------------------------------------------------------------------

-- Trigger: Capture newly inserted Items into the Outbox Queue
CREATE TRIGGER IF NOT EXISTS trg_items_after_insert_sync
AFTER INSERT ON items
FOR EACH ROW
BEGIN
    INSERT INTO sync_queue (
        entity_table, record_id, action_type, payload, sync_status, retry_count, created_at
    ) VALUES (
        'items', NEW.id, 'INSERT',
        json_object(
            'id', NEW.id, 'code', NEW.code, 'name', NEW.name, 'barcode', NEW.barcode,
            'category', NEW.category, 'unit', NEW.unit, 'cost_price', NEW.cost_price,
            'wholesale_price', NEW.wholesale_price, 'retail_price', NEW.retail_price,
            'consumer_price', NEW.consumer_price, 'sale_price', NEW.sale_price,
            'stock', NEW.stock, 'min_reorder_level', NEW.min_reorder_level,
            'is_active', NEW.is_active, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at
        ),
        'PENDING', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    );
END;

-- Trigger: Capture newly inserted Customers into the Outbox Queue
CREATE TRIGGER IF NOT EXISTS trg_customers_after_insert_sync
AFTER INSERT ON customers
FOR EACH ROW
BEGIN
    INSERT INTO sync_queue (
        entity_table, record_id, action_type, payload, sync_status, retry_count, created_at
    ) VALUES (
        'customers', NEW.id, 'INSERT',
        json_object(
            'id', NEW.id, 'code', NEW.code, 'name', NEW.name, 'phone', NEW.phone,
            'address', NEW.address, 'tax_number', NEW.tax_number,
            'opening_balance', NEW.opening_balance, 'opening_balance_type', NEW.opening_balance_type,
            'is_active', NEW.is_active, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at
        ),
        'PENDING', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    );
END;

-- Trigger: Capture newly inserted Vendors into the Outbox Queue
CREATE TRIGGER IF NOT EXISTS trg_vendors_after_insert_sync
AFTER INSERT ON vendors
FOR EACH ROW
BEGIN
    INSERT INTO sync_queue (
        entity_table, record_id, action_type, payload, sync_status, retry_count, created_at
    ) VALUES (
        'vendors', NEW.id, 'INSERT',
        json_object(
            'id', NEW.id, 'code', NEW.code, 'name', NEW.name, 'phone', NEW.phone,
            'address', NEW.address, 'tax_number', NEW.tax_number,
            'opening_balance', NEW.opening_balance, 'opening_balance_type', NEW.opening_balance_type,
            'is_active', NEW.is_active, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at
        ),
        'PENDING', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    );
END;

-- Trigger: Capture newly inserted Invoices into the Outbox Queue
CREATE TRIGGER IF NOT EXISTS trg_invoices_after_insert_sync
AFTER INSERT ON invoices
FOR EACH ROW
BEGIN
    INSERT INTO sync_queue (
        entity_table,
        record_id,
        action_type,
        payload,
        sync_status,
        retry_count,
        created_at
    ) VALUES (
        'invoices',
        NEW.id,
        'INSERT',
        json_object(
            'id', NEW.id,
            'invoice_number', NEW.invoice_number,
            'customer_id', NEW.customer_id,
            'total_amount', NEW.total_amount,
            'tax_amount', NEW.tax_amount,
            'net_amount', NEW.net_amount,
            'status', NEW.status,
            'device_id', NEW.device_id,
            'created_at', NEW.created_at,
            'updated_at', NEW.updated_at,
            'server_timestamp', NEW.server_timestamp
        ),
        'PENDING',
        0,
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    );
END;

-- Trigger: Capture newly inserted Sales Returns into the Outbox Queue
CREATE TRIGGER IF NOT EXISTS trg_sales_returns_after_insert_sync
AFTER INSERT ON sales_returns
FOR EACH ROW
BEGIN
    INSERT INTO sync_queue (
        entity_table,
        record_id,
        action_type,
        payload,
        sync_status,
        retry_count,
        created_at
    ) VALUES (
        'sales_returns',
        NEW.id,
        'INSERT',
        json_object(
            'id', NEW.id,
            'return_number', NEW.return_number,
            'original_invoice_id', NEW.original_invoice_id,
            'original_invoice_number', NEW.original_invoice_number,
            'customer_id', NEW.customer_id,
            'total_amount', NEW.total_amount,
            'tax_amount', NEW.tax_amount,
            'net_amount', NEW.net_amount,
            'return_reason', NEW.return_reason,
            'device_id', NEW.device_id,
            'created_at', NEW.created_at,
            'updated_at', NEW.updated_at
        ),
        'PENDING',
        0,
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    );
END;

-- Trigger: Capture newly inserted Journal Entries into the Outbox Queue
CREATE TRIGGER IF NOT EXISTS trg_journal_entries_after_insert_sync
AFTER INSERT ON journal_entries
FOR EACH ROW
BEGIN
    INSERT INTO sync_queue (
        entity_table,
        record_id,
        action_type,
        payload,
        sync_status,
        retry_count,
        created_at
    ) VALUES (
        'journal_entries',
        NEW.id,
        'INSERT',
        json_object(
            'id', NEW.id,
            'entry_number', NEW.entry_number,
            'reference_doc_type', NEW.reference_doc_type,
            'reference_doc_id', NEW.reference_doc_id,
            'description', NEW.description,
            'device_id', NEW.device_id,
            'entry_date', NEW.entry_date,
            'created_at', NEW.created_at
        ),
        'PENDING',
        0,
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    );
END;

-- ----------------------------------------------------------------------------
-- OPTIONAL EXPANSION: CHILD ITEM OUTBOX TRIGGERS
-- In an append-only batch sync model, item details can also be tracked 
-- so downstream Google Drive workers receive complete line items.
-- ----------------------------------------------------------------------------

CREATE TRIGGER IF NOT EXISTS trg_invoice_items_after_insert_sync
AFTER INSERT ON invoice_items
FOR EACH ROW
BEGIN
    INSERT INTO sync_queue (
        entity_table,
        record_id,
        action_type,
        payload,
        sync_status,
        retry_count,
        created_at
    ) VALUES (
        'invoice_items',
        NEW.id,
        'INSERT',
        json_object(
            'id', NEW.id,
            'invoice_id', NEW.invoice_id,
            'item_id', NEW.item_id,
            'item_name', NEW.item_name,
            'quantity', NEW.quantity,
            'unit_price', NEW.unit_price,
            'discount', NEW.discount,
            'line_total', NEW.line_total
        ),
        'PENDING',
        0,
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_journal_lines_after_insert_sync
AFTER INSERT ON journal_lines
FOR EACH ROW
BEGIN
    INSERT INTO sync_queue (
        entity_table,
        record_id,
        action_type,
        payload,
        sync_status,
        retry_count,
        created_at
    ) VALUES (
        'journal_lines',
        NEW.id,
        'INSERT',
        json_object(
            'id', NEW.id,
            'entry_id', NEW.entry_id,
            'account_id', NEW.account_id,
            'debit', NEW.debit,
            'credit', NEW.credit,
            'notes', NEW.notes
        ),
        'PENDING',
        0,
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_sales_return_items_after_insert_sync
AFTER INSERT ON sales_return_items
FOR EACH ROW
BEGIN
    INSERT INTO sync_queue (
        entity_table,
        record_id,
        action_type,
        payload,
        sync_status,
        retry_count,
        created_at
    ) VALUES (
        'sales_return_items',
        NEW.id,
        'INSERT',
        json_object(
            'id', NEW.id,
            'return_id', NEW.return_id,
            'item_id', NEW.item_id,
            'returned_quantity', NEW.returned_quantity,
            'unit_price', NEW.unit_price,
            'line_total', NEW.line_total
        ),
        'PENDING',
        0,
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    );
END;
