/**
 * Smart Notifications Engine for Logustria Financial & Mobile Android/PWA
 * Manages automated triggers for Check Maturities, Low Inventory, Voucher Approvals, and Daily Summaries.
 */

import { loadBankChecks, getCheckUrgencyInfo } from './checkStore';
import { loadStoredItems } from './itemsStore';
import { loadAllPendingApprovals } from './voucherApproval';
import { loadPurchaseInvoices } from './partnerLedger';

export interface NotificationPreferences {
  enabled: boolean;
  enableCheckAlerts: boolean;
  enableLowStockAlerts: boolean;
  enableApprovalAlerts: boolean;
  enableDueInvoicesAlerts: boolean;
  enableDailyMorningSummary: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // e.g. "22:00"
  quietHoursEnd: string;   // e.g. "08:00"
  sound: boolean;
  vibrate: boolean;
}

export interface NotificationLogItem {
  id: string;
  timestamp: string;
  type: 'CHECK_DUE' | 'LOW_STOCK' | 'APPROVAL_PENDING' | 'INVOICE_DUE' | 'DAILY_SUMMARY' | 'TEST';
  title: string;
  body: string;
  urgency: 'high' | 'medium' | 'info';
  read: boolean;
}

const STORAGE_KEY_PREFS = 'smart_notifications_prefs_v1';
const STORAGE_KEY_LOGS = 'smart_notifications_history_v1';
const STORAGE_KEY_LAST_SENT = 'smart_notifications_last_sent_hashes_v1';

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  enabled: true,
  enableCheckAlerts: true,
  enableLowStockAlerts: true,
  enableApprovalAlerts: true,
  enableDueInvoicesAlerts: true,
  enableDailyMorningSummary: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  sound: true,
  vibrate: true
};

/**
 * Load user notification preferences
 */
export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFS);
    if (!raw) return DEFAULT_NOTIFICATION_PREFS;
    return { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

/**
 * Save user notification preferences
 */
export function saveNotificationPreferences(prefs: NotificationPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent('smart_notifications_prefs_changed', { detail: prefs }));
  } catch (err) {
    console.error('Failed to save notification preferences:', err);
  }
}

/**
 * Load notification history logs
 */
export function getNotificationLogs(): NotificationLogItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOGS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Append to notification history
 */
export function appendNotificationLog(item: Omit<NotificationLogItem, 'id' | 'timestamp' | 'read'>): NotificationLogItem {
  const fullItem: NotificationLogItem = {
    ...item,
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    read: false
  };

  if (typeof window !== 'undefined') {
    try {
      const logs = getNotificationLogs();
      const updated = [fullItem, ...logs].slice(0, 50); // keep last 50
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('smart_notification_history_updated', { detail: updated }));
    } catch {
      // ignore
    }
  }

  return fullItem;
}

/**
 * Clear notification history
 */
export function clearNotificationLogs(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_LOGS);
    window.dispatchEvent(new CustomEvent('smart_notification_history_updated', { detail: [] }));
  } catch {
    // ignore
  }
}

/**
 * Play a gentle notification chime sound using Web Audio API
 */
export function playNotificationChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.12);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.25); // D6

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.15);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.35);
    }
  } catch {
    // AudioContext blocked
  }
}

/**
 * Check if the device is currently in quiet hours
 */
export function isCurrentlyQuietHours(prefs: NotificationPreferences): boolean {
  if (!prefs.quietHoursEnabled) return false;
  try {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const [startH, startM] = prefs.quietHoursStart.split(':').map(Number);
    const [endH, endM] = prefs.quietHoursEnd.split(':').map(Number);
    
    const startMin = (startH ?? 22) * 60 + (startM ?? 0);
    const endMin = (endH ?? 8) * 60 + (endM ?? 0);

    if (startMin < endMin) {
      return currentMinutes >= startMin && currentMinutes <= endMin;
    } else {
      // Crosses midnight (e.g. 22:00 to 08:00)
      return currentMinutes >= startMin || currentMinutes <= endMin;
    }
  } catch {
    return false;
  }
}

/**
 * Check permission status
 */
export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Request notification permission from browser / Android
 */
export async function requestSmartNotificationPermission(): Promise<{
  granted: boolean;
  status: NotificationPermission | 'unsupported';
  message: string;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      granted: false,
      status: 'unsupported',
      message: 'خاصية الإشعارات غير مدعومة في بيئة هذا المتصفح/النظام.'
    };
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      // Send a welcome test notification
      sendSmartNotification({
        title: 'لوجوستريا المحاسبي 🔔',
        body: 'تم تفعيل إشعارات وتنبيهات النظام بنجاح! ستصلك تنبيهات الشيكات والمخزون والاعتمادات.',
        type: 'TEST',
        urgency: 'info'
      });

      return {
        granted: true,
        status: 'granted',
        message: 'تم تفعيل إذن الإشعارات بنجاح على الهاتف/المتصفح.'
      };
    } else {
      return {
        granted: false,
        status: perm,
        message: 'تم رفض إذن الإشعارات. يرجى تفعيل الإشعارات من إعدادات المتصفح أو إعدادات التطبيق في أندرويد.'
      };
    }
  } catch (err: any) {
    return {
      granted: false,
      status: 'denied',
      message: err?.message || 'تعذر طلب إذن الإشعارات.'
    };
  }
}

/**
 * Send a notification through Web Notification API or Service Worker
 */
export async function sendSmartNotification(options: {
  title: string;
  body: string;
  type: NotificationLogItem['type'];
  urgency?: NotificationLogItem['urgency'];
  data?: Record<string, any>;
}): Promise<boolean> {
  const prefs = getNotificationPreferences();
  if (!prefs.enabled) return false;

  const urgency = options.urgency || 'medium';

  // Haptic feedback
  if (prefs.vibrate && typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      if (urgency === 'high') {
        navigator.vibrate([200, 100, 200, 100, 300]);
      } else {
        navigator.vibrate([150, 80, 150]);
      }
    } catch {
      // ignore
    }
  }

  // Audio chime
  if (prefs.sound) {
    playNotificationChime();
  }

  // Record in in-app notification logs
  appendNotificationLog({
    title: options.title,
    body: options.body,
    type: options.type,
    urgency
  });

  // Dispatch custom in-app event for toast notifications
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('smart_notification_dispatched', {
        detail: {
          title: options.title,
          body: options.body,
          type: options.type,
          urgency
        }
      })
    );
  }

  // Try System Notification API
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      // If service worker is active, use showNotification for better mobile background persistence
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(options.title, {
            body: options.body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            dir: 'rtl',
            lang: 'ar',
            tag: `${options.type}_${Date.now()}`,
            data: options.data
          });
          return true;
        }
      }

      // Standard desktop/mobile web notification
      new Notification(options.title, {
        body: options.body,
        icon: '/favicon.ico',
        dir: 'rtl',
        lang: 'ar'
      });
      return true;
    } catch (err) {
      console.warn('System Notification display error:', err);
    }
  }

  return true;
}

/**
 * Evaluate all active conditions and send relevant smart alerts
 */
export async function evaluateAndTriggerSmartAlerts(force = false): Promise<{
  checksAlertCount: number;
  lowStockAlertCount: number;
  approvalsAlertCount: number;
  invoicesAlertCount: number;
  totalAlertsDispatched: number;
}> {
  const prefs = getNotificationPreferences();
  if (!prefs.enabled && !force) {
    return {
      checksAlertCount: 0,
      lowStockAlertCount: 0,
      approvalsAlertCount: 0,
      invoicesAlertCount: 0,
      totalAlertsDispatched: 0
    };
  }

  if (!force && isCurrentlyQuietHours(prefs)) {
    return {
      checksAlertCount: 0,
      lowStockAlertCount: 0,
      approvalsAlertCount: 0,
      invoicesAlertCount: 0,
      totalAlertsDispatched: 0
    };
  }

  const todayStr = new Date().toISOString().split('T')[0] || '';
  let lastSentHashes: Record<string, string> = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LAST_SENT);
    if (raw) lastSentHashes = JSON.parse(raw);
  } catch {
    lastSentHashes = {};
  }

  let totalAlertsDispatched = 0;
  let checksAlertCount = 0;
  let lowStockAlertCount = 0;
  let approvalsAlertCount = 0;
  let invoicesAlertCount = 0;

  // 1. BANK CHECKS DUE ALERTS
  if (prefs.enableCheckAlerts) {
    try {
      const checks = loadBankChecks();
      const urgentChecks = checks.filter(c => {
        if (c.status !== 'UNDER_COLLECTION') return false;
        const info = getCheckUrgencyInfo(c.dueDate, c.status);
        return info.urgency === 'OVERDUE' || info.urgency === 'DUE_TODAY' || info.urgency === 'CRITICAL' || info.daysRemaining <= 2;
      });

      if (urgentChecks.length > 0) {
        const hash = `checks_${todayStr}_${urgentChecks.length}`;
        if (force || lastSentHashes['checks'] !== hash) {
          const dueTodayCount = urgentChecks.filter(c => getCheckUrgencyInfo(c.dueDate, c.status).urgency === 'DUE_TODAY').length;
          const overdueCount = urgentChecks.filter(c => getCheckUrgencyInfo(c.dueDate, c.status).urgency === 'OVERDUE').length;

          let msg = `يوجد عدد ${urgentChecks.length} شيكات بنكية تتطلب المتابعة`;
          if (dueTodayCount > 0) msg += ` (${dueTodayCount} مستحقة اليوم)`;
          if (overdueCount > 0) msg += ` و (${overdueCount} متأخرة)`;

          await sendSmartNotification({
            title: 'تنبيه استحقاق شيكات بنكية 🏦',
            body: msg,
            type: 'CHECK_DUE',
            urgency: 'high'
          });

          lastSentHashes['checks'] = hash;
          checksAlertCount = urgentChecks.length;
          totalAlertsDispatched++;
        }
      }
    } catch (err) {
      console.warn('Check alert eval error:', err);
    }
  }

  // 2. LOW INVENTORY STOCK ALERTS
  if (prefs.enableLowStockAlerts) {
    try {
      const items = loadStoredItems();
      const lowStockItems = items.filter(item => {
        const stock = item.stock ?? 0;
        const min = (item as any).minStockLimit ?? (item as any).minStock ?? 5;
        return stock <= min;
      });

      if (lowStockItems.length > 0) {
        const hash = `lowstock_${todayStr}_${lowStockItems.length}`;
        if (force || lastSentHashes['lowstock'] !== hash) {
          const outOfStockCount = lowStockItems.filter(i => (i.stock ?? 0) <= 0).length;
          let msg = `تنبيه: عدد ${lowStockItems.length} صنف وصل لحد إعادة الطلب الأدنى بالمستودعات`;
          if (outOfStockCount > 0) msg += `، منها ${outOfStockCount} صنف نفد رصيده تماماً (0).`;

          await sendSmartNotification({
            title: 'تنبيه انخفاض ونفاد المخزون 📦',
            body: msg,
            type: 'LOW_STOCK',
            urgency: 'medium'
          });

          lastSentHashes['lowstock'] = hash;
          lowStockAlertCount = lowStockItems.length;
          totalAlertsDispatched++;
        }
      }
    } catch (err) {
      console.warn('Low stock alert eval error:', err);
    }
  }

  // 3. VOUCHER APPROVALS PENDING ALERTS
  if (prefs.enableApprovalAlerts) {
    try {
      const pendingApprovals = loadAllPendingApprovals();
      if (pendingApprovals.length > 0) {
        const hash = `approvals_${todayStr}_${pendingApprovals.length}`;
        if (force || lastSentHashes['approvals'] !== hash) {
          await sendSmartNotification({
            title: 'سندات بانتظار الاعتماد المالي ✍️',
            body: `يوجد عدد ${pendingApprovals.length} سند مالي بانتظار مراجعة واعتماد الإدارة المالية لاستكمال الترحيل.`,
            type: 'APPROVAL_PENDING',
            urgency: 'medium'
          });

          lastSentHashes['approvals'] = hash;
          approvalsAlertCount = pendingApprovals.length;
          totalAlertsDispatched++;
        }
      }
    } catch (err) {
      console.warn('Approval alert eval error:', err);
    }
  }

  // 4. DUE PURCHASE INVOICES
  if (prefs.enableDueInvoicesAlerts) {
    try {
      const purchases = loadPurchaseInvoices();
      const dueInvoices = purchases.filter(p => {
        if (p.status === 'CANCELLED') return false;
        if (!p.dueDate) return false;
        return p.dueDate <= todayStr;
      });

      if (dueInvoices.length > 0) {
        const hash = `purchases_${todayStr}_${dueInvoices.length}`;
        if (force || lastSentHashes['purchases'] !== hash) {
          await sendSmartNotification({
            title: 'فواتير موردين مستحقة السداد 📄',
            body: `يوجد عدد ${dueInvoices.length} فواتير شراء مستحقة السداد لم يتم سدادها بعد.`,
            type: 'INVOICE_DUE',
            urgency: 'medium'
          });

          lastSentHashes['purchases'] = hash;
          invoicesAlertCount = dueInvoices.length;
          totalAlertsDispatched++;
        }
      }
    } catch (err) {
      console.warn('Invoice alert eval error:', err);
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY_LAST_SENT, JSON.stringify(lastSentHashes));
  } catch {
    // ignore
  }

  return {
    checksAlertCount,
    lowStockAlertCount,
    approvalsAlertCount,
    invoicesAlertCount,
    totalAlertsDispatched
  };
}
