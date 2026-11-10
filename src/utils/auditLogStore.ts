import { AuditLogEntry, AuditLogFilterOptions, AuditAction, AuditModule, AuditSeverity } from '../types/auditLog';
import { getSystemSettings } from './settings';

export const STORAGE_KEY_AUDIT_LOGS = 'alpha_audit_trail_v1';
export const AUDIT_LOG_EVENT = 'alpha-audit-log-updated';

/**
 * Get active user session information from settings or fallback to admin
 */
export function getCurrentAuditUser(): { id: string; username: string; displayName: string; role: string; branch: string } {
  try {
    const settings = getSystemSettings();
    if (settings?.users && settings.users.length > 0) {
      const activeUser = settings.users.find(u => u.isActive) || settings.users[0];
      if (activeUser) {
        return {
          id: activeUser.id,
          username: activeUser.username,
          displayName: activeUser.displayName,
          role: activeUser.role,
          branch: activeUser.branch || settings.company?.branchName || 'الفرع الرئيسي'
        };
      }
    }
  } catch (err) {
    console.warn('Failed resolving current audit user:', err);
  }

  return {
    id: 'usr-admin',
    username: 'admin',
    displayName: 'المدير العام (System Administrator)',
    role: 'ADMIN',
    branch: 'الفرع الرئيسي'
  };
}

/**
 * Load all audit logs from localStorage, filtering out any legacy demo seed records
 */
export function loadAuditLogs(): AuditLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUDIT_LOGS);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const cleaned = parsed.filter((item: any) => {
        if (!item || typeof item !== 'object') return false;
        if (String(item.id || '').startsWith('aud-seed-')) return false;
        return true;
      });
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEY_AUDIT_LOGS, JSON.stringify(cleaned));
      }
      return cleaned;
    }
    return [];
  } catch (err) {
    console.error('Failed reading audit logs from storage:', err);
    return [];
  }
}

/**
 * Log a new audit event into the centralized audit trail
 */
export function recordAuditLog(entry: {
  action: AuditAction;
  module: AuditModule;
  documentType?: string;
  documentNumber?: string;
  documentId?: string;
  summary: string;
  summaryEn?: string;
  severity?: AuditSeverity;
  user?: {
    id: string;
    username: string;
    displayName: string;
    role: string;
    branch?: string;
  };
  details?: Record<string, unknown>;
  changes?: Array<{
    field: string;
    fieldLabel: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
}): AuditLogEntry {
  const activeUser = entry.user || getCurrentAuditUser();
  const severity = entry.severity || (entry.action === 'DELETE' || entry.action === 'SYSTEM_RESET' ? 'DANGER' : (entry.action === 'UPDATE' || entry.action === 'SETTINGS_CHANGE' || entry.action === 'UNPOST' ? 'WARN' : 'INFO'));

  const newLog: AuditLogEntry = {
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    action: entry.action,
    module: entry.module,
    ...(entry.documentType !== undefined ? { documentType: entry.documentType } : {}),
    ...(entry.documentNumber !== undefined ? { documentNumber: entry.documentNumber } : {}),
    ...(entry.documentId !== undefined ? { documentId: entry.documentId } : {}),
    user: activeUser,
    summary: entry.summary,
    ...(entry.summaryEn !== undefined ? { summaryEn: entry.summaryEn } : {}),
    severity,
    deviceInfo: typeof navigator !== 'undefined' ? (navigator.userAgent.includes('Mobile') ? 'Mobile Browser' : 'Desktop Browser') : 'System',
    ...(entry.details !== undefined ? { details: entry.details } : {}),
    ...(entry.changes !== undefined ? { changes: entry.changes } : {})
  };

  try {
    const current = loadAuditLogs();
    // Keep last 1500 logs to guarantee optimal performance while preserving extensive history
    const updated = [newLog, ...current].slice(0, 1500);
    localStorage.setItem(STORAGE_KEY_AUDIT_LOGS, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(AUDIT_LOG_EVENT, { detail: newLog }));
  } catch (err) {
    console.error('Failed saving audit log entry:', err);
  }

  return newLog;
}

/**
 * Filter audit logs based on search criteria
 */
export function filterAuditLogs(logs: AuditLogEntry[], options: AuditLogFilterOptions): AuditLogEntry[] {
  return logs.filter(log => {
    // Action filter
    if (options.action && options.action !== 'ALL' && log.action !== options.action) {
      return false;
    }

    // Module filter
    if (options.module && options.module !== 'ALL' && log.module !== options.module) {
      return false;
    }

    // Severity filter
    if (options.severity && options.severity !== 'ALL' && log.severity !== options.severity) {
      return false;
    }

    // User filter
    if (options.userId && options.userId !== 'ALL') {
      if (log.user.id !== options.userId && log.user.username !== options.userId) {
        return false;
      }
    }

    // Date range filter
    const logDate = (log.timestamp || '').split('T')[0] || '';
    if (options.startDate && logDate < options.startDate) {
      return false;
    }
    if (options.endDate && logDate > options.endDate) {
      return false;
    }

    // Specific Document Number
    if (options.documentNumber && options.documentNumber.trim()) {
      const searchDoc = options.documentNumber.trim().toLowerCase();
      if (!log.documentNumber?.toLowerCase().includes(searchDoc)) {
        return false;
      }
    }

    // General text query
    if (options.searchQuery && options.searchQuery.trim()) {
      const query = options.searchQuery.trim().toLowerCase();
      const matchDocNum = log.documentNumber?.toLowerCase().includes(query);
      const matchDocType = log.documentType?.toLowerCase().includes(query);
      const matchSummary = (log.summary || '').toLowerCase().includes(query);
      const matchSummaryEn = log.summaryEn?.toLowerCase().includes(query);
      const matchUser = (log.user?.displayName || '').toLowerCase().includes(query) || (log.user?.username || '').toLowerCase().includes(query);
      
      if (!matchDocNum && !matchDocType && !matchSummary && !matchSummaryEn && !matchUser) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Export audit logs to CSV
 */
export function exportAuditLogsToCSV(logs: AuditLogEntry[]): void {
  if (typeof window === 'undefined' || logs.length === 0) return;

  const headers = [
    'المعرف',
    'التاريخ والوقت',
    'نوع العملية (Action)',
    'الوحدة / الموديول',
    'المستند',
    'رقم المستند',
    'المستخدم',
    'الدور الوظيفي',
    'الفرع',
    'الأهمية',
    'البيان والتفاصيل'
  ];

  const rows = logs.map(l => [
    `"${l.id}"`,
    `"${new Date(l.timestamp).toLocaleString('ar-EG')}"`,
    `"${l.action}"`,
    `"${l.module}"`,
    `"${l.documentType || '-'}"`,
    `"${l.documentNumber || '-'}"`,
    `"${l.user.displayName} (${l.user.username})"`,
    `"${l.user.role}"`,
    `"${l.user.branch || '-'}"`,
    `"${l.severity}"`,
    `"${l.summary.replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Audit_Trail_Logustria_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Purge / Clear all audit logs (with confirmation log)
 */
export function clearAuditLogs(): void {
  if (typeof window === 'undefined') return;
  const user = getCurrentAuditUser();
  const resetEntry: AuditLogEntry = {
    id: `aud-clear-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'SYSTEM_RESET',
    module: 'SYSTEM',
    documentType: 'سجل التدقيق',
    user,
    summary: `تم تفريغ مسارات التدقيق وسجل الأنشطة بالكامل بواسطة ${user.displayName}`,
    summaryEn: `Audit trail history was cleared completely by ${user.displayName}`,
    severity: 'CRITICAL',
    deviceInfo: 'Desktop Web'
  };

  localStorage.setItem(STORAGE_KEY_AUDIT_LOGS, JSON.stringify([resetEntry]));
  window.dispatchEvent(new CustomEvent(AUDIT_LOG_EVENT, { detail: resetEntry }));
}
