export type AuditAction = 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'POST' 
  | 'UNPOST' 
  | 'APPROVE' 
  | 'REJECT' 
  | 'PRINT' 
  | 'EXPORT' 
  | 'LOGIN' 
  | 'SETTINGS_CHANGE' 
  | 'SYSTEM_RESET' 
  | 'YEAR_END_CLOSE'
  | 'STATUS_CHANGE';

export type AuditModule = 
  | 'SALES' 
  | 'PURCHASES' 
  | 'CUSTOMERS' 
  | 'VENDORS' 
  | 'ITEMS' 
  | 'TREASURY' 
  | 'JOURNAL' 
  | 'PAYROLL' 
  | 'MANUFACTURING' 
  | 'INSTALLMENTS' 
  | 'INVENTORY_COUNT' 
  | 'SETTINGS' 
  | 'YEAR_END' 
  | 'SYSTEM';

export type AuditSeverity = 'INFO' | 'WARN' | 'DANGER' | 'CRITICAL';

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO String: 2026-09-23T08:58:00.000Z
  action: AuditAction;
  module: AuditModule;
  documentType?: string; // e.g. 'فاتورة مبيعات', 'سند صرف', 'قيد يومية', 'صنف'
  documentNumber?: string; // e.g. 'INV-2026-0012', 'RV-0043', 'JE-2026-089'
  documentId?: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    role: string;
    branch?: string;
  };
  summary: string; // وصف ملخص للعملية (عربي)
  summaryEn?: string; // وصف بالإنجليزي
  severity: AuditSeverity;
  ipAddress?: string;
  deviceInfo?: string;
  details?: Record<string, unknown>; // حقول قبل وبعد أو أرقام المبالغ
  changes?: Array<{
    field: string;
    fieldLabel: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
}

export interface AuditLogFilterOptions {
  searchQuery?: string;
  action?: AuditAction | 'ALL';
  module?: AuditModule | 'ALL';
  userId?: string | 'ALL';
  severity?: AuditSeverity | 'ALL';
  startDate?: string;
  endDate?: string;
  documentNumber?: string;
}
