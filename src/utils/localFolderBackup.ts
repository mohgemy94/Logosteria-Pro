/**
 * Local Folder Auto-Save & Backup Engine for Logustria ERP
 * Utilizes the W3C File System Access API (showDirectoryPicker)
 * with IndexedDB persistence for seamless background auto-saving to a user-selected local folder.
 */

export interface AutoSaveConfig {
  enabled: boolean;
  intervalMinutes: number; // e.g. 1, 3, 5, 10, 15, 30
  saveOnChange: boolean; // Auto-save after data mutations (debounced)
  saveHistoricalBackups: boolean; // Keep timestamped copies in a /history subfolder
  saveModularFiles: boolean; // Save individual JSON files per module (/modules)
  folderName: string | null;
  lastSavedAt: string | null;
  lastStatus: 'idle' | 'in_progress' | 'success' | 'error';
  lastErrorMessage: string | null;
  lastFileSizeKB: number;
  totalRecordsCount: number;
  historyLog: Array<{
    id: string;
    timestamp: string;
    status: 'success' | 'error';
    summary: string;
    sizeKB: number;
  }>;
}

export interface SystemFullBackup {
  meta: {
    systemName: string;
    version: string;
    exportedAt: string;
    generator: string;
    recordsCount: {
      items: number;
      salesInvoices: number;
      purchaseInvoices: number;
      receiptVouchers: number;
      paymentVouchers: number;
      internalVouchers: number;
      customers: number;
      vendors: number;
      employees: number;
      installmentContracts: number;
      promissoryNotes: number;
      manufacturingBOMs: number;
      workOrders: number;
      workCenters: number;
    };
  };
  settings: any;
  sequences: any;
  items: any[];
  salesInvoices: any[];
  purchaseInvoices: any[];
  receiptVouchers: any[];
  paymentVouchers: any[];
  internalVouchers: any[];
  customers: any[];
  vendors: any[];
  partnerBalances: any[];
  warehouseBalances: any[];
  installmentsContracts: any[];
  promissoryNotes: any[];
  payrollEmployees: any[];
  manufacturingBOMs: any[];
  manufacturingWorkOrders: any[];
  manufacturingWorkCenters: any[];
  journalEntries: any[];
}

// Storage keys
export const AUTO_SAVE_CONFIG_KEY = 'alpha_auto_save_settings_v1';
const IDB_DB_NAME = 'logustria_fs_store';
const IDB_STORE_NAME = 'handles';
const IDB_KEY_HANDLE = 'backup_dir_handle';

export const DEFAULT_AUTO_SAVE_CONFIG: AutoSaveConfig = {
  enabled: false,
  intervalMinutes: 5,
  saveOnChange: true,
  saveHistoricalBackups: true,
  saveModularFiles: true,
  folderName: null,
  lastSavedAt: null,
  lastStatus: 'idle',
  lastErrorMessage: null,
  lastFileSizeKB: 0,
  totalRecordsCount: 0,
  historyLog: []
};

// Listeners for config updates
type ConfigListener = (config: AutoSaveConfig) => void;
const configListeners: Set<ConfigListener> = new Set();

export function getAutoSaveConfig(): AutoSaveConfig {
  if (typeof window === 'undefined') return DEFAULT_AUTO_SAVE_CONFIG;
  try {
    const raw = localStorage.getItem(AUTO_SAVE_CONFIG_KEY);
    if (!raw) return DEFAULT_AUTO_SAVE_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_AUTO_SAVE_CONFIG, ...parsed };
  } catch {
    return DEFAULT_AUTO_SAVE_CONFIG;
  }
}

export function saveAutoSaveConfig(updates: Partial<AutoSaveConfig>): AutoSaveConfig {
  const current = getAutoSaveConfig();
  const next: AutoSaveConfig = {
    ...current,
    ...updates,
    historyLog: updates.historyLog || current.historyLog.slice(0, 25)
  };
  try {
    localStorage.setItem(AUTO_SAVE_CONFIG_KEY, JSON.stringify(next));
  } catch (err) {
    console.error('Failed to save auto-save config:', err);
  }
  configListeners.forEach(l => l(next));
  return next;
}

export function subscribeAutoSave(listener: ConfigListener): () => void {
  configListeners.add(listener);
  return () => configListeners.delete(listener);
}

// IndexedDB Helper to persist FileSystemDirectoryHandle
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not available'));
    }
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function storeDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    tx.objectStore(IDB_STORE_NAME).put(handle, IDB_KEY_HANDLE);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getStoredDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const req = tx.objectStore(IDB_STORE_NAME).get(IDB_KEY_HANDLE);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearDirectoryHandle(): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      tx.objectStore(IDB_STORE_NAME).delete(IDB_KEY_HANDLE);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore error
  }
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';
}

/**
 * Verify or re-request readwrite permission on the stored directory handle.
 */
export async function verifyDirectoryPermission(
  handle: FileSystemDirectoryHandle,
  requestIfNeeded: boolean = true
): Promise<boolean> {
  try {
    const options = { mode: 'readwrite' as const };
    const query = await (handle as any).queryPermission?.(options);
    if (query === 'granted') {
      return true;
    }
    if (requestIfNeeded && (handle as any).requestPermission) {
      const req = await (handle as any).requestPermission(options);
      return req === 'granted';
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Open native OS directory picker dialog to select a folder on the user's computer.
 */
export async function selectLocalDirectory(): Promise<{
  success: boolean;
  handle?: FileSystemDirectoryHandle;
  folderName?: string;
  error?: string;
}> {
  if (!isFileSystemAccessSupported()) {
    return {
      success: false,
      error: 'متصفحك الحالي لا يدعم واجهة اختيار المجلدات المحلية (File System Access API). يُفضل استخدام متصفح Google Chrome أو Microsoft Edge أو Brave على أجهزة الكمبيوتر المكتبية، أو الاستفادة من ميزة تنزيل النسخة المباشرة.'
    };
  }

  try {
    const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents'
    });

    const isGranted = await verifyDirectoryPermission(handle, true);
    if (!isGranted) {
      return {
        success: false,
        error: 'لم يتم منح صلاحية القراءة والكتابة للمجلد المختار.'
      };
    }

    await storeDirectoryHandle(handle);
    const folderName = handle.name || 'مجلد محلي';
    
    saveAutoSaveConfig({
      folderName,
      enabled: true,
      lastStatus: 'idle',
      lastErrorMessage: null
    });

    return { success: true, handle, folderName };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'تم إلغاء اختيار المجلد من قبل المستخدم.' };
    }
    if (err.name === 'SecurityError') {
      return {
        success: false,
        error: 'قيود أمان الإطار: إذا كنت داخل نافذة معاينة مدمجة، يُرجى فتح البرنامج في تبويب مستقل (Open in New Tab) ليتمكن المتصفح من إظهار نافذة اختيار المجلد المحلي.'
      };
    }
    return { success: false, error: err.message || 'تعذر اختيار المجلد المحلي.' };
  }
}

/**
 * Reads any localStorage key safely as parsed JSON array or object
 */
function getStoredJson(key: string, fallback: any = []): any {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Assembles a comprehensive snapshot of the entire accounting database
 */
export function collectSystemBackupData(): SystemFullBackup {
  const items = getStoredJson('alpha_items_store_v1', []);
  const salesInvoices = getStoredJson('alpha_sales_invoices_v1', []);
  const purchaseInvoices = getStoredJson('alpha_purchases_invoices_v1', []);
  const receiptVouchers = getStoredJson('alpha_receipt_vouchers_v1', []);
  const paymentVouchers = getStoredJson('alpha_payment_vouchers_v1', []);
  const internalVouchers = getStoredJson('alpha_internal_vouchers_v1', []);
  const customers = getStoredJson('accounting_customers', []);
  const vendors = getStoredJson('accounting_vendors', []);
  const partnerBalances = getStoredJson('alpha_partner_balances_v1', []);
  const warehouseBalances = getStoredJson('alpha_warehouse_balances_v2', []);
  const installmentsContracts = getStoredJson('alpha_installments_contracts_v1', []);
  const promissoryNotes = getStoredJson('alpha_promissory_notes_v1', []);
  const payrollEmployees = getStoredJson('alpha_payroll_employees_v1', []);
  const manufacturingBOMs = getStoredJson('alpha_mfg_bom_v1', []);
  const manufacturingWorkOrders = getStoredJson('alpha_mfg_work_orders_v1', []);
  const manufacturingWorkCenters = getStoredJson('alpha_mfg_work_centers_v1', []);
  const journalEntries = getStoredJson('alpha_journal_entries_v1', []);
  const settings = getStoredJson('alpha_system_settings_v1', {});
  const sequences = getStoredJson('alpha_document_sequences_v3', {});

  return {
    meta: {
      systemName: 'لوجوستريا للمحاسبة والحلول المالية (LOGUSTRIA ERP)',
      version: '3.5.0',
      exportedAt: new Date().toISOString(),
      generator: 'Logustria Local Folder Auto-Save Engine',
      recordsCount: {
        items: items.length,
        salesInvoices: salesInvoices.length,
        purchaseInvoices: purchaseInvoices.length,
        receiptVouchers: receiptVouchers.length,
        paymentVouchers: paymentVouchers.length,
        internalVouchers: internalVouchers.length,
        customers: customers.length,
        vendors: vendors.length,
        employees: payrollEmployees.length,
        installmentContracts: installmentsContracts.length,
        promissoryNotes: promissoryNotes.length,
        manufacturingBOMs: manufacturingBOMs.length,
        workOrders: manufacturingWorkOrders.length,
        workCenters: manufacturingWorkCenters.length
      }
    },
    settings,
    sequences,
    items,
    salesInvoices,
    purchaseInvoices,
    receiptVouchers,
    paymentVouchers,
    internalVouchers,
    customers,
    vendors,
    partnerBalances,
    warehouseBalances,
    installmentsContracts,
    promissoryNotes,
    payrollEmployees,
    manufacturingBOMs,
    manufacturingWorkOrders,
    manufacturingWorkCenters,
    journalEntries
  };
}

/**
 * Calculates total records across all collections
 */
export function countTotalRecords(backup: SystemFullBackup): number {
  const rc = backup.meta.recordsCount;
  return (
    rc.items +
    rc.salesInvoices +
    rc.purchaseInvoices +
    rc.receiptVouchers +
    rc.paymentVouchers +
    rc.internalVouchers +
    rc.customers +
    rc.vendors +
    rc.employees +
    rc.installmentContracts +
    rc.promissoryNotes +
    rc.manufacturingBOMs +
    rc.workOrders +
    rc.workCenters
  );
}

/**
 * Helper to write a UTF-8 text file directly into a FileSystemDirectoryHandle
 */
async function writeFileToDirectory(
  dir: FileSystemDirectoryHandle,
  fileName: string,
  content: string
): Promise<void> {
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await (fileHandle as any).createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * Writes the entire backup to the user-selected local folder.
 */
export async function writeBackupToDirectory(
  dirHandle: FileSystemDirectoryHandle,
  customBackup?: SystemFullBackup,
  customConfig?: AutoSaveConfig
): Promise<{
  success: boolean;
  error?: string;
  bytesWritten?: number;
  timestamp?: string;
}> {
  const config = customConfig || getAutoSaveConfig();
  const backup = customBackup || collectSystemBackupData();
  const jsonContent = JSON.stringify(backup, null, 2);
  const bytes = new Blob([jsonContent]).size;
  const now = new Date();
  const timestampStr = now.toISOString().replace(/[:.]/g, '-');
  const displayTime = now.toLocaleTimeString('ar-SA');

  try {
    // 1. Write the main single latest file
    await writeFileToDirectory(dirHandle, 'logustria_backup_latest.json', jsonContent);

    // 2. Write an informational README text file
    const readmeContent = `===============================================================
منظومة لوجوستريا للمحاسبة والحلول المالية - النسخ الاحتياطي التلقائي
LOGUSTRIA ERP - AUTOMATIC LOCAL BACKUP REPOSITORY
===============================================================
تاريخ وتوقيت آخر تحديث: ${now.toLocaleString('ar-SA')} (${now.toISOString()})
اسم المجلد: ${dirHandle.name || 'مجلد محلي'}
حجم ملف البيانات: ${(bytes / 1024).toFixed(2)} كيلوبايت
إجمالي السجلات المحفوظة: ${countTotalRecords(backup)} سجل

الملفات المتوفرة:
1. logustria_backup_latest.json : النسخة الاحتياطية الأحدث والأشمل لجميع أقسام النظام.
2. history/ : مجلد الأرشيف الزمني للنسخ المحفوظة تاريخياً للرجوع لأي نقطة زمنية.
3. modules/ : ملفات JSON تفصيلية ومستقلة لكل قسم (فواتير، أصناف، عملاء، موظفين...).

طريقة الاستعادة:
يمكن استعادة هذه البيانات في أي وقت من خلال:
شاشة إعدادات النظام > إدارة البيانات والنسخ الاحتياطي > استعادة من مجلد الحفظ أو استيراد ملف JSON.
===============================================================`;
    await writeFileToDirectory(dirHandle, 'README_BACKUP.txt', readmeContent);

    // 3. Write historical timestamped backup if enabled
    if (config.saveHistoricalBackups) {
      try {
        const historyDir = await dirHandle.getDirectoryHandle('history', { create: true });
        const historyFileName = `backup_${timestampStr}.json`;
        await writeFileToDirectory(historyDir, historyFileName, jsonContent);
      } catch (err) {
        console.warn('Could not write historical backup to history subfolder:', err);
      }
    }

    // 4. Write modular files if enabled
    if (config.saveModularFiles) {
      try {
        const modulesDir = await dirHandle.getDirectoryHandle('modules', { create: true });
        await writeFileToDirectory(modulesDir, 'sales_invoices.json', JSON.stringify(backup.salesInvoices, null, 2));
        await writeFileToDirectory(modulesDir, 'purchase_invoices.json', JSON.stringify(backup.purchaseInvoices, null, 2));
        await writeFileToDirectory(modulesDir, 'items_catalog.json', JSON.stringify(backup.items, null, 2));
        await writeFileToDirectory(modulesDir, 'customers.json', JSON.stringify(backup.customers, null, 2));
        await writeFileToDirectory(modulesDir, 'vendors.json', JSON.stringify(backup.vendors, null, 2));
        await writeFileToDirectory(modulesDir, 'receipt_vouchers.json', JSON.stringify(backup.receiptVouchers, null, 2));
        await writeFileToDirectory(modulesDir, 'payment_vouchers.json', JSON.stringify(backup.paymentVouchers, null, 2));
        await writeFileToDirectory(modulesDir, 'internal_vouchers.json', JSON.stringify(backup.internalVouchers, null, 2));
        await writeFileToDirectory(modulesDir, 'payroll_employees.json', JSON.stringify(backup.payrollEmployees, null, 2));
        await writeFileToDirectory(modulesDir, 'installments.json', JSON.stringify(backup.installmentsContracts, null, 2));
        await writeFileToDirectory(modulesDir, 'manufacturing_bom.json', JSON.stringify(backup.manufacturingBOMs, null, 2));
        await writeFileToDirectory(modulesDir, 'company_settings.json', JSON.stringify(backup.settings, null, 2));
      } catch (err) {
        console.warn('Could not write modular files:', err);
      }
    }

    // Update config status
    const totalRecords = countTotalRecords(backup);
    const sizeKB = Math.round(bytes / 1024);
    const logItem = {
      id: 'log-' + Date.now(),
      timestamp: now.toISOString(),
      status: 'success' as const,
      summary: `تم الحفظ بنجاح (${totalRecords} سجل - ${sizeKB} KB) في ${displayTime}`,
      sizeKB
    };

    saveAutoSaveConfig({
      lastSavedAt: now.toISOString(),
      lastStatus: 'success',
      lastErrorMessage: null,
      lastFileSizeKB: sizeKB,
      totalRecordsCount: totalRecords,
      historyLog: [logItem, ...(config.historyLog || [])].slice(0, 20)
    });

    return { success: true, bytesWritten: bytes, timestamp: now.toISOString() };
  } catch (err: any) {
    const errorMsg = err.message || 'فشل أثناء كتابة ملفات النسخ الاحتياطي في المجلد المحلي.';
    const logItem = {
      id: 'log-' + Date.now(),
      timestamp: now.toISOString(),
      status: 'error' as const,
      summary: `تعذر الحفظ: ${errorMsg}`,
      sizeKB: 0
    };

    saveAutoSaveConfig({
      lastStatus: 'error',
      lastErrorMessage: errorMsg,
      historyLog: [logItem, ...(config.historyLog || [])].slice(0, 20)
    });

    return { success: false, error: errorMsg };
  }
}

/**
 * Triggers an immediate backup write to the currently configured local folder.
 */
export async function triggerAutoSaveNow(): Promise<{
  success: boolean;
  error?: string;
  bytesWritten?: number;
  timestamp?: string;
}> {
  const handle = await getStoredDirectoryHandle();

  if (!handle) {
    return {
      success: false,
      error: 'لم يتم تحديد مجلد محلي للحفظ التلقائي بعد. يُرجى النقر على "اختيار مجلد محلي" أولاً.'
    };
  }

  const hasPermission = await verifyDirectoryPermission(handle, false);
  if (!hasPermission) {
    return {
      success: false,
      error: 'انتهت صلاحية إذن الوصول للمجلد المختار أو تم سحبها. يُرجى إعادة اختيار المجلد لمنح الإذن مجدداً.'
    };
  }

  saveAutoSaveConfig({ lastStatus: 'in_progress' });
  return await writeBackupToDirectory(handle);
}

/**
 * Immediate download of the full backup JSON file to user's browser default downloads folder.
 * Works across ALL browsers without requiring FileSystem API.
 */
export function downloadBackupDirectly(): void {
  const backup = collectSystemBackupData();
  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}`;
  a.href = url;
  a.download = `logustria_full_backup_${dateStr}_${timeStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Restores the entire accounting database from a full backup object.
 */
export function restoreSystemFromBackup(backup: any): {
  success: boolean;
  restoredCounts: Record<string, number>;
  error?: string;
} {
  if (!backup || typeof backup !== 'object') {
    return { success: false, restoredCounts: {}, error: 'صيغة ملف النسخة الاحتياطية غير صالحة.' };
  }

  try {
    const counts: Record<string, number> = {};

    if (Array.isArray(backup.items)) {
      localStorage.setItem('alpha_items_store_v1', JSON.stringify(backup.items));
      counts['الأصناف'] = backup.items.length;
    }
    if (Array.isArray(backup.salesInvoices)) {
      localStorage.setItem('alpha_sales_invoices_v1', JSON.stringify(backup.salesInvoices));
      counts['فواتير المبيعات'] = backup.salesInvoices.length;
    }
    if (Array.isArray(backup.purchaseInvoices)) {
      localStorage.setItem('alpha_purchases_invoices_v1', JSON.stringify(backup.purchaseInvoices));
      counts['فواتير المشتريات'] = backup.purchaseInvoices.length;
    }
    if (Array.isArray(backup.receiptVouchers)) {
      localStorage.setItem('alpha_receipt_vouchers_v1', JSON.stringify(backup.receiptVouchers));
      counts['سندات القبض'] = backup.receiptVouchers.length;
    }
    if (Array.isArray(backup.paymentVouchers)) {
      localStorage.setItem('alpha_payment_vouchers_v1', JSON.stringify(backup.paymentVouchers));
      counts['سندات الصرف'] = backup.paymentVouchers.length;
    }
    if (Array.isArray(backup.internalVouchers)) {
      localStorage.setItem('alpha_internal_vouchers_v1', JSON.stringify(backup.internalVouchers));
      counts['السندات الداخلية'] = backup.internalVouchers.length;
    }
    if (Array.isArray(backup.customers)) {
      localStorage.setItem('accounting_customers', JSON.stringify(backup.customers));
      counts['العملاء'] = backup.customers.length;
    }
    if (Array.isArray(backup.vendors)) {
      localStorage.setItem('accounting_vendors', JSON.stringify(backup.vendors));
      counts['الموردين'] = backup.vendors.length;
    }
    if (Array.isArray(backup.partnerBalances)) {
      localStorage.setItem('alpha_partner_balances_v1', JSON.stringify(backup.partnerBalances));
    }
    if (Array.isArray(backup.warehouseBalances)) {
      localStorage.setItem('alpha_warehouse_balances_v2', JSON.stringify(backup.warehouseBalances));
    }
    if (Array.isArray(backup.installmentsContracts)) {
      localStorage.setItem('alpha_installments_contracts_v1', JSON.stringify(backup.installmentsContracts));
      counts['عقود التقسيط'] = backup.installmentsContracts.length;
    }
    if (Array.isArray(backup.promissoryNotes)) {
      localStorage.setItem('alpha_promissory_notes_v1', JSON.stringify(backup.promissoryNotes));
      counts['الكمبيالات'] = backup.promissoryNotes.length;
    }
    if (Array.isArray(backup.payrollEmployees)) {
      localStorage.setItem('alpha_payroll_employees_v1', JSON.stringify(backup.payrollEmployees));
      counts['الموظفين'] = backup.payrollEmployees.length;
    }
    if (Array.isArray(backup.manufacturingBOMs)) {
      localStorage.setItem('alpha_mfg_bom_v1', JSON.stringify(backup.manufacturingBOMs));
      counts['قوائم التصنيع BOM'] = backup.manufacturingBOMs.length;
    }
    if (Array.isArray(backup.manufacturingWorkOrders)) {
      localStorage.setItem('alpha_mfg_work_orders_v1', JSON.stringify(backup.manufacturingWorkOrders));
      counts['أوامر التشغيل'] = backup.manufacturingWorkOrders.length;
    }
    if (Array.isArray(backup.manufacturingWorkCenters)) {
      localStorage.setItem('alpha_mfg_work_centers_v1', JSON.stringify(backup.manufacturingWorkCenters));
    }
    if (backup.settings && typeof backup.settings === 'object') {
      localStorage.setItem('alpha_system_settings_v1', JSON.stringify(backup.settings));
      counts['إعدادات النظام والمنشأة'] = 1;
    }
    if (backup.sequences && typeof backup.sequences === 'object') {
      localStorage.setItem('alpha_document_sequences_v3', JSON.stringify(backup.sequences));
    }

    // Trigger local storage event so other components refresh
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('logustria-data-restored'));

    return { success: true, restoredCounts: counts };
  } catch (err: any) {
    return { success: false, restoredCounts: {}, error: err.message || 'حدث خطأ أثناء استعادة البيانات.' };
  }
}

/**
 * Reads the latest backup file directly from the chosen local directory handle
 */
export async function readLatestBackupFromDirectory(
  dirHandle: FileSystemDirectoryHandle
): Promise<SystemFullBackup | null> {
  try {
    const fileHandle = await dirHandle.getFileHandle('logustria_backup_latest.json');
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as SystemFullBackup;
  } catch {
    return null;
  }
}

/**
 * Dispatches a notification that data has changed, triggering debounced auto-save.
 */
let debounceTimer: any = null;
export function notifyDataChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('logustria-data-mutated'));

  const config = getAutoSaveConfig();
  if (config.enabled && config.saveOnChange) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      triggerAutoSaveNow().catch(() => {});
    }, 3000); // 3-second debounce
  }
}
