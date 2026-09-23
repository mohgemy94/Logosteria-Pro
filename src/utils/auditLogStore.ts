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
      return {
        id: activeUser.id,
        username: activeUser.username,
        displayName: activeUser.displayName,
        role: activeUser.role,
        branch: activeUser.branch || settings.company.branchName || 'الفرع الرئيسي'
      };
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
 * Generate initial realistic seed logs to demonstrate audit trail capabilities immediately
 */
function getInitialSeedLogs(): AuditLogEntry[] {
  const now = new Date();
  const getPastIso = (minutesAgo: number) => {
    const d = new Date(now.getTime() - minutesAgo * 60 * 1000);
    return d.toISOString();
  };

  return [
    {
      id: 'aud-seed-1',
      timestamp: getPastIso(12),
      action: 'CREATE',
      module: 'SALES',
      documentType: 'فاتورة مبيعات ضريبية',
      documentNumber: 'INV-2026-0089',
      documentId: 'inv-89',
      user: {
        id: 'usr-1',
        username: 'admin',
        displayName: 'المدير العام (System Administrator)',
        role: 'ADMIN',
        branch: 'الفرع الرئيسي - الرياض'
      },
      summary: 'إصدار وترحيل فاتورة مبيعات نقدية جديدة برقم INV-2026-0089 بمبلغ 4,830.00 ر.س',
      summaryEn: 'Created & posted new tax sales invoice INV-2026-0089 with total 4,830.00 SAR',
      severity: 'INFO',
      deviceInfo: 'Chrome / Desktop Web',
      details: {
        customerName: 'مؤسسة الأفق للتجارة',
        itemsCount: 4,
        totalWithVat: 4830.00,
        vatAmount: 630.00,
        paymentMethod: 'CASH'
      }
    },
    {
      id: 'aud-seed-2',
      timestamp: getPastIso(35),
      action: 'APPROVE',
      module: 'TREASURY',
      documentType: 'سند صرف خارجي',
      documentNumber: 'PV-2026-0034',
      documentId: 'pv-34',
      user: {
        id: 'usr-1',
        username: 'admin',
        displayName: 'المدير العام (System Administrator)',
        role: 'ADMIN',
        branch: 'الفرع الرئيسي - الرياض'
      },
      summary: 'اعتماد سند صرف خارجي لسداد مستحقات شركة التوريدات المتحدة بمبلغ 12,500.00 ر.س',
      summaryEn: 'Approved payment voucher PV-2026-0034 for United Supplies Co. (12,500.00 SAR)',
      severity: 'INFO',
      deviceInfo: 'Chrome / Desktop Web',
      details: {
        vendorName: 'شركة التوريدات المتحدة',
        amount: 12500.00,
        approvalStage: 'FINAL_APPROVAL'
      }
    },
    {
      id: 'aud-seed-3',
      timestamp: getPastIso(75),
      action: 'UPDATE',
      module: 'ITEMS',
      documentType: 'بطاقة صنف',
      documentNumber: 'ITM-1002',
      documentId: 'itm-1002',
      user: {
        id: 'usr-2',
        username: 'accountant1',
        displayName: 'محاسب أول - الإدارة المالية',
        role: 'ACCOUNTANT',
        branch: 'الفرع الرئيسي - الرياض'
      },
      summary: 'تعديل سعر البيع والحد الأدنى للمخزون لصنف "طابعة ليزر متعددة المهام"',
      summaryEn: 'Updated sale price and reorder limit for item "Multifunction Laser Printer"',
      severity: 'WARN',
      deviceInfo: 'Edge / Windows',
      changes: [
        {
          field: 'price',
          fieldLabel: 'سعر البيع',
          oldValue: '1,450.00 ر.س',
          newValue: '1,620.00 ر.س'
        },
        {
          field: 'minStock',
          fieldLabel: 'الحد الأدنى للطلب',
          oldValue: 3,
          newValue: 5
        }
      ]
    },
    {
      id: 'aud-seed-4',
      timestamp: getPastIso(160),
      action: 'POST',
      module: 'JOURNAL',
      documentType: 'قيد يومية عامة',
      documentNumber: 'JE-2026-0145',
      documentId: 'je-145',
      user: {
        id: 'usr-2',
        username: 'accountant1',
        displayName: 'محاسب أول - الإدارة المالية',
        role: 'ACCOUNTANT',
        branch: 'الفرع الرئيسي - الرياض'
      },
      summary: 'ترحيل قيد إثبات استحقاق إيجار الفرع والمعارض بمبلغ 25,000.00 ر.س',
      summaryEn: 'Posted journal entry JE-2026-0145 for branch rent accrual (25,000.00 SAR)',
      severity: 'INFO',
      deviceInfo: 'Edge / Windows',
      details: {
        totalDebit: 25000.00,
        totalCredit: 25000.00,
        isBalanced: true
      }
    },
    {
      id: 'aud-seed-5',
      timestamp: getPastIso(320),
      action: 'SETTINGS_CHANGE',
      module: 'SETTINGS',
      documentType: 'إعدادات النظام المالية',
      user: {
        id: 'usr-1',
        username: 'admin',
        displayName: 'المدير العام (System Administrator)',
        role: 'ADMIN',
        branch: 'الفرع الرئيسي - الرياض'
      },
      summary: 'تحديث حد الائتمان وسياسة منع البيع بالسالب للأصناف',
      summaryEn: 'Updated credit limit enforcement and negative stock prevention policy',
      severity: 'WARN',
      deviceInfo: 'Chrome / Desktop Web',
      changes: [
        {
          field: 'preventNegativeStock',
          fieldLabel: 'منع البيع بالسالب',
          oldValue: false,
          newValue: true
        },
        {
          field: 'lowStockThreshold',
          fieldLabel: 'تنبيه الركود والحد الأدنى',
          oldValue: 3,
          newValue: 5
        }
      ]
    },
    {
      id: 'aud-seed-6',
      timestamp: getPastIso(500),
      action: 'EXPORT',
      module: 'SALES',
      documentType: 'تقرير مبيعات مجمع',
      user: {
        id: 'usr-1',
        username: 'admin',
        displayName: 'المدير العام (System Administrator)',
        role: 'ADMIN',
        branch: 'الفرع الرئيسي - الرياض'
      },
      summary: 'تصدير تقرير إقرارات ضريبة القيمة المضافة والمبيعات إلى ملف Excel (XLSX)',
      summaryEn: 'Exported VAT declarations and sales report to Excel file',
      severity: 'INFO',
      deviceInfo: 'Chrome / Desktop Web'
    }
  ];
}

/**
 * Load all audit logs from localStorage, fallback to seed records
 */
export function loadAuditLogs(): AuditLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUDIT_LOGS);
    if (!raw) {
      const initial = getInitialSeedLogs();
      localStorage.setItem(STORAGE_KEY_AUDIT_LOGS, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
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
    documentType: entry.documentType,
    documentNumber: entry.documentNumber,
    documentId: entry.documentId,
    user: activeUser,
    summary: entry.summary,
    summaryEn: entry.summaryEn,
    severity,
    deviceInfo: typeof navigator !== 'undefined' ? (navigator.userAgent.includes('Mobile') ? 'Mobile Browser' : 'Desktop Browser') : 'System',
    details: entry.details,
    changes: entry.changes
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
    if (options.startDate) {
      const logDate = log.timestamp.split('T')[0];
      if (logDate < options.startDate) return false;
    }
    if (options.endDate) {
      const logDate = log.timestamp.split('T')[0];
      if (logDate > options.endDate) return false;
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
      const matchSummary = log.summary.toLowerCase().includes(query);
      const matchSummaryEn = log.summaryEn?.toLowerCase().includes(query);
      const matchUser = log.user.displayName.toLowerCase().includes(query) || log.user.username.toLowerCase().includes(query);
      
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
