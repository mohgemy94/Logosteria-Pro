import { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  BellOff,
  CheckCircle2,
  AlertTriangle,
  Send,
  Sliders,
  Volume2,
  VolumeX,
  Vibrate,
  ShieldCheck,
  History,
  Trash2,
  Sparkles,
  Smartphone,
  RefreshCw,
  Clock
} from 'lucide-react';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  getNotificationLogs,
  clearNotificationLogs,
  getNotificationPermissionStatus,
  requestSmartNotificationPermission,
  sendSmartNotification,
  evaluateAndTriggerSmartAlerts,
  type NotificationPreferences,
  type NotificationLogItem
} from '../utils/smartNotificationsEngine';

interface Props {
  onClose?: () => void;
  isModal?: boolean;
}

export default function SmartNotificationsManager({ onClose, isModal = false }: Props) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(getNotificationPreferences());
  const [logs, setLogs] = useState<NotificationLogItem[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>(
    getNotificationPermissionStatus()
  );
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evalResultMsg, setEvalResultMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const refreshLogs = () => {
    setLogs(getNotificationLogs());
  };

  useEffect(() => {
    setPermissionStatus(getNotificationPermissionStatus());
    refreshLogs();

    const handleHistoryUpdate = () => {
      refreshLogs();
    };

    window.addEventListener('smart_notification_history_updated', handleHistoryUpdate);
    window.addEventListener('smart_notification_dispatched', handleHistoryUpdate);

    return () => {
      window.removeEventListener('smart_notification_history_updated', handleHistoryUpdate);
      window.removeEventListener('smart_notification_dispatched', handleHistoryUpdate);
    };
  }, []);

  const handleTogglePref = (key: keyof NotificationPreferences) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    saveNotificationPreferences(updated);
  };

  const handleRequestPermission = async () => {
    setStatusMsg(null);
    const res = await requestSmartNotificationPermission();
    setPermissionStatus(res.status);
    if (res.granted) {
      setStatusMsg({ text: res.message, type: 'success' });
    } else {
      setStatusMsg({ text: res.message, type: 'error' });
    }
  };

  const handleSendTestNotification = async () => {
    setStatusMsg(null);
    await sendSmartNotification({
      title: 'إشعار تجريبي من لوجوستريا 🚀',
      body: 'تم اختبار نظام الإشعارات والتنبيهات بنجاح! الصوت والاهتزاز يعملان بكفاءة.',
      type: 'TEST',
      urgency: 'info'
    });
    setStatusMsg({
      text: 'تم إرسال إشعار تجريبي فوري إلى الهاتف بنجاح!',
      type: 'success'
    });
    refreshLogs();
  };

  const handleTriggerActiveAlerts = async () => {
    setIsEvaluating(true);
    setEvalResultMsg(null);
    try {
      const summary = await evaluateAndTriggerSmartAlerts(true);
      if (summary.totalAlertsDispatched > 0) {
        setEvalResultMsg(
          `تم فحص النظام وإرسال ${summary.totalAlertsDispatched} تنبيه فوري: (${summary.checksAlertCount} شيكات، ${summary.lowStockAlertCount} مخزون، ${summary.approvalsAlertCount} اعتمادات).`
        );
      } else {
        setEvalResultMsg('جميع السجلات المحاسبية والمخزنية بحالة ممتازة ولا توجد تنبيهات عاجلة حالياً.');
      }
      refreshLogs();
    } catch {
      setEvalResultMsg('حدث خطأ أثناء فحص التنبيهات.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleClearHistory = () => {
    clearNotificationLogs();
    setLogs([]);
  };

  return (
    <div className={`space-y-6 text-right ${isModal ? 'p-2 sm:p-4' : ''}`} dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-indigo-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner shrink-0">
            <BellRing size={24} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-white">
                مركز الإشعارات والتنبيهات الذكية للأندرويد
              </h3>
              <span className="text-[10px] bg-indigo-900/80 text-indigo-200 border border-indigo-700/50 px-2 py-0.5 rounded-md font-bold">
                Smart Notifications & Push
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              تنبيهات فورية ومجدولة على الهاتف بمواعيد استحقاق الشيكات، نقص المخزون، والاعتمادات المالية
            </p>
          </div>
        </div>

        {/* Permission Status Pill */}
        <div className="flex items-center gap-2">
          {permissionStatus === 'granted' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
              <CheckCircle2 size={15} />
              إذن الإشعارات مفعّل ونشط
            </span>
          ) : permissionStatus === 'denied' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-rose-950/80 border border-rose-500/40 text-rose-300">
              <AlertTriangle size={15} />
              الإشعارات محظورة بالنظام
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-amber-950/80 border border-amber-500/40 text-amber-300">
              <Clock size={15} />
              بانتظار تفعيل الإذن
            </span>
          )}
        </div>
      </div>

      {/* Permission Action Bar */}
      {permissionStatus !== 'granted' && (
        <div className="bg-amber-50/90 border-2 border-amber-300 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
              <Bell size={18} />
            </div>
            <div>
              <h4 className="text-sm font-black text-amber-950">
                تفعيل إذن الإشعارات للهاتف ونظام أندرويد
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                اضغط لتفعيل إذن استقبال التنبيهات حتى تصلك إشعارات الشيكات المستحقة وتنبيهات المخزون فورياً.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRequestPermission}
            className="btn-3d btn-3d-amber px-4 py-2.5 text-xs font-black flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-center cursor-pointer"
          >
            <Sparkles size={15} />
            <span>طلب وتفعيل إذن الإشعارات الآن</span>
          </button>
        </div>
      )}

      {/* Status Feedback Message */}
      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : statusMsg.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
          }`}
        >
          {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Quick Test & Trigger Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSendTestNotification}
            className="btn-3d btn-3d-purple px-4 py-2 text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Send size={14} />
            <span>إرسال إشعار تجريبي للهاتف 📲</span>
          </button>

          <button
            type="button"
            disabled={isEvaluating}
            onClick={handleTriggerActiveAlerts}
            className="btn-3d btn-3d-blue px-4 py-2 text-xs font-black flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={14} className={isEvaluating ? 'animate-spin' : ''} />
            <span>{isEvaluating ? 'جاري الفحص...' : 'فحص وإرسال التنبيهات المستحقة الآن'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleTogglePref('sound')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
              prefs.sound
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
            title="تفعيل/تعطيل الصوت"
          >
            {prefs.sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span>نغمة التنبيه: {prefs.sound ? 'مفعلة' : 'مكتومة'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleTogglePref('vibrate')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
              prefs.vibrate
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
            title="تفعيل/تعطيل الاهتزاز"
          >
            <Vibrate size={15} />
            <span>الاهتزاز: {prefs.vibrate ? 'مفعل' : 'معطل'}</span>
          </button>
        </div>
      </div>

      {evalResultMsg && (
        <div className="p-3 bg-indigo-50/90 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={16} className="text-indigo-600 shrink-0" />
          <span>{evalResultMsg}</span>
        </div>
      )}

      {/* Notification Categories Grid */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Sliders size={18} className="text-indigo-600" />
            <span>قنوات وأنواع التنبيهات المجدولة</span>
          </div>
          <button
            type="button"
            onClick={() => handleTogglePref('enabled')}
            className={`px-3 py-1 rounded-full text-xs font-black transition-colors cursor-pointer ${
              prefs.enabled
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-slate-200 text-slate-700 border border-slate-300'
            }`}
          >
            {prefs.enabled ? 'النظام التلقائي: نشط' : 'النظام التلقائي: متوقف'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* 1. Check alerts */}
          <div className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-start justify-between gap-3 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h5 className="text-xs font-extrabold text-slate-900">
                  تنبيهات استحقاق الشيكات البنكية 🏦
                </h5>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                إشعار يومي بالشيكات الصادرة والواردة المستحقة للصرف اليوم أو المتأخرة لتجنب غرامات الارتجاع.
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.enableCheckAlerts}
              onChange={() => handleTogglePref('enableCheckAlerts')}
              className="w-5 h-5 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500 mt-1 cursor-pointer"
            />
          </div>

          {/* 2. Low stock alerts */}
          <div className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-start justify-between gap-3 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h5 className="text-xs font-extrabold text-slate-900">
                  تنبيهات نفاد وانخفاض المخزون 📦
                </h5>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                تنبيه فوري عند وصول كمية أي صنف لمستوى حد إعادة الطلب الأدنى أو نفاد الرصيد بالمستودعات.
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.enableLowStockAlerts}
              onChange={() => handleTogglePref('enableLowStockAlerts')}
              className="w-5 h-5 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500 mt-1 cursor-pointer"
            />
          </div>

          {/* 3. Approvals alerts */}
          <div className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-start justify-between gap-3 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <h5 className="text-xs font-extrabold text-slate-900">
                  تنبيهات اعتمادات السندات المالية ✍️
                </h5>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                إشعار الإدارة المالية بالسندات المعلقة التي تتطلب مراجعة واعتماداً قبل الترحيل النهائي.
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.enableApprovalAlerts}
              onChange={() => handleTogglePref('enableApprovalAlerts')}
              className="w-5 h-5 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500 mt-1 cursor-pointer"
            />
          </div>

          {/* 4. Due invoices */}
          <div className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-start justify-between gap-3 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <h5 className="text-xs font-extrabold text-slate-900">
                  فواتير الموردين المستحقة للسداد 📄
                </h5>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                تذكير بمواعيد استحقاق فواتير الشراء الآجلة قبل حلول موعد السداد لجدولة المدفوعات النقدية.
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.enableDueInvoicesAlerts}
              onChange={() => handleTogglePref('enableDueInvoicesAlerts')}
              className="w-5 h-5 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500 mt-1 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Android & Mobile Optimization Tips */}
      <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl border border-slate-800 text-xs space-y-2">
        <div className="flex items-center gap-2 text-indigo-400 font-bold">
          <Smartphone size={16} />
          <span>إرشادات خاصة بتطبيق أندرويد (APK / Mobile):</span>
        </div>
        <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-1 pr-1 leading-relaxed">
          <li>
            <strong>على نظام أندرويد 13 فما فوق:</strong> يجب الموافقة على إذن الإشعارات (`POST_NOTIFICATIONS`) عند طلب الإذن لأول مرة.
          </li>
          <li>
            <strong>لضمان استقبال التنبيهات في الخلفية:</strong> تأكد من ضبط إعدادات البطارية لتطبيق لوجوستريا في الهاتف على وضع (غير مقيّد / Unrestricted) لمنع نظام توفير الطاقة من إيقاف الإشعارات.
          </li>
          <li>
            <strong>تطبيق الويب التقديمي (PWA):</strong> عند تثبيت التطبيق على الشاشة الرئيسية للهاتف ستعمل التنبيهات كإشعارات Push أصلية مدمجة.
          </li>
        </ul>
      </div>

      {/* Notification Logs History */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-slate-900">
            <History size={16} className="text-slate-600" />
            <span>سجل الإشعارات والتنبيهات الأخيرة ({logs.length})</span>
          </div>
          {logs.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-[11px] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <Trash2 size={13} />
              <span>مسح السجل</span>
            </button>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            <BellOff size={28} className="mx-auto text-slate-300 mb-2" />
            <span>لا توجد إشعارات مرسلة في السجل حتى الآن.</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-200/80 flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        log.urgency === 'high'
                          ? 'bg-rose-500'
                          : log.urgency === 'medium'
                          ? 'bg-amber-500'
                          : 'bg-indigo-500'
                      }`}
                    />
                    <h6 className="font-black text-slate-900 truncate">{log.title}</h6>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed pr-4">{log.body}</p>
                </div>
                <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Close button if in modal */}
      {isModal && onClose && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}
    </div>
  );
}
