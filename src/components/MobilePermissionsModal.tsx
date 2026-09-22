import { useState, useEffect } from 'react';
import { 
  Camera, 
  HardDrive, 
  Bluetooth, 
  Bell, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  Smartphone, 
  ShieldCheck, 
  RefreshCw,
  Sparkles,
  Zap,
  Info,
  Monitor,
  FolderCheck,
  Mic,
  Printer,
  BellRing
} from 'lucide-react';
import { 
  PERMISSIONS_CONFIG, 
  checkPermissionStatus, 
  requestAppPermission, 
  type PermissionKey, 
  type PermissionState,
  type PlatformTarget
} from '../utils/mobilePermissions';

export default function MobilePermissionsModal() {
  const [activeTab, setActiveTab] = useState<PlatformTarget>('desktop');
  const [statuses, setStatuses] = useState<Record<PermissionKey, PermissionState>>({
    camera: 'prompt',
    storage: 'prompt',
    bluetooth: 'prompt',
    notifications: 'prompt',
    geolocation: 'prompt',
    desktop_directory: 'prompt',
    desktop_microphone: 'prompt',
    desktop_persistence: 'prompt',
    desktop_popups_print: 'prompt',
    desktop_notifications: 'prompt'
  });
  const [loadingKey, setLoadingKey] = useState<PermissionKey | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isAutoExecutingAll, setIsAutoExecutingAll] = useState<boolean>(false);

  const mobileKeys: readonly PermissionKey[] = ['camera', 'storage', 'bluetooth', 'notifications', 'geolocation'] as const;
  const desktopKeys: readonly PermissionKey[] = [
    'desktop_directory', 
    'desktop_microphone', 
    'desktop_persistence', 
    'desktop_popups_print', 
    'desktop_notifications'
  ] as const;

  const currentKeys = activeTab === 'desktop' ? desktopKeys : mobileKeys;

  const refreshAllStatuses = async () => {
    const allKeys: PermissionKey[] = [...desktopKeys, ...mobileKeys];
    const updated: Record<PermissionKey, PermissionState> = { ...statuses };
    for (const key of allKeys) {
      updated[key] = await checkPermissionStatus(key);
    }
    setStatuses(updated);
  };

  useEffect(() => {
    refreshAllStatuses();
  }, []);

  const handleRequestOne = async (key: PermissionKey) => {
    setLoadingKey(key);
    setStatusMessage(null);
    try {
      const res = await requestAppPermission(key);
      setStatuses(prev => ({ ...prev, [key]: res.state }));
      setStatusMessage({
        text: res.message,
        type: res.success ? 'success' : (res.state === 'prompt' ? 'info' : 'error')
      });
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || 'حدث خطأ أثناء طلب الإذن',
        type: 'error'
      });
    } finally {
      setLoadingKey(null);
    }
  };

  const handleExecuteAllOneByOne = async () => {
    setIsAutoExecutingAll(true);
    const platformLabel = activeTab === 'desktop' ? 'سطح المكتب (Desktop)' : 'الموبايل وأندرويد';
    setStatusMessage({
      text: `جاري البدء بتفعيل أذونات ${platformLabel} تتابعياً (الواحد تلو الآخر)...`,
      type: 'info'
    });

    for (let i = 0; i < currentKeys.length; i++) {
      const currentKey = currentKeys[i];
      if (!currentKey) continue;
      setCurrentStepIndex(i);
      setLoadingKey(currentKey);
      try {
        const res = await requestAppPermission(currentKey);
        setStatuses(prev => ({ ...prev, [currentKey]: res.state }));
        setStatusMessage({
          text: `[الخطوة ${i + 1}/${currentKeys.length}] ${res.message}`,
          type: res.success ? 'success' : 'info'
        });
      } catch (e: any) {
        console.warn(`Failed permission step for ${currentKey}:`, e);
      }
      // Small delay between requests for a smooth experience
      await new Promise(r => setTimeout(r, 600));
    }

    setLoadingKey(null);
    setIsAutoExecutingAll(false);
    setStatusMessage({
      text: `اكتملت دورة فحص وتفعيل أذونات ${platformLabel} الخمسة بنجاح!`,
      type: 'success'
    });
  };

  const getStatusBadge = (state: PermissionState) => {
    switch (state) {
      case 'granted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={13} className="text-emerald-600" />
            مُفعل ونشط
          </span>
        );
      case 'denied':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle size={13} className="text-rose-600" />
            مرفوض / مقيّد
          </span>
        );
      case 'unsupported':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            غير مدعوم بالمتصفح
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <HelpCircle size={13} className="text-amber-600" />
            بانتظار الموافقة
          </span>
        );
    }
  };

  const getIcon = (key: PermissionKey) => {
    switch (key) {
      // Mobile
      case 'camera':
        return <Camera className="text-blue-600" size={20} />;
      case 'storage':
        return <HardDrive className="text-emerald-600" size={20} />;
      case 'bluetooth':
        return <Bluetooth className="text-indigo-600" size={20} />;
      case 'notifications':
        return <Bell className="text-amber-600" size={20} />;
      case 'geolocation':
        return <MapPin className="text-rose-600" size={20} />;
      // Desktop
      case 'desktop_directory':
        return <FolderCheck className="text-blue-600" size={20} />;
      case 'desktop_microphone':
        return <Mic className="text-purple-600" size={20} />;
      case 'desktop_persistence':
        return <ShieldCheck className="text-emerald-600" size={20} />;
      case 'desktop_popups_print':
        return <Printer className="text-indigo-600" size={20} />;
      case 'desktop_notifications':
        return <BellRing className="text-amber-600" size={20} />;
    }
  };

  const grantedCount = currentKeys.filter(k => statuses[k] === 'granted').length;

  return (
    <div className="space-y-6 animate-in fade-in" dir="rtl">
      {/* Platform Switcher Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => { setActiveTab('desktop'); setStatusMessage(null); }}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'desktop'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Monitor size={17} className={activeTab === 'desktop' ? 'text-blue-600' : 'text-slate-400'} />
            <span>نسخة سطح المكتب (Desktop / الكمبيوتر)</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
              5 أذونات
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('mobile'); setStatusMessage(null); }}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'mobile'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Smartphone size={17} className={activeTab === 'mobile' ? 'text-indigo-600' : 'text-slate-400'} />
            <span>نسخة الموبايل (أندرويد / iOS)</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
              5 أذونات
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={refreshAllStatuses}
          className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-2xs transition-colors self-end sm:self-center"
          title="تحديث فحص حالة الأذونات لكافة المنصات"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 sm:p-6 border border-slate-700 shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
              {activeTab === 'desktop' ? <Monitor size={26} /> : <Smartphone size={26} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  {activeTab === 'desktop' ? 'أذونات وإعدادات نظام سطح المكتب' : 'أذونات وإعدادات تطبيق الموبايل'}
                </span>
                <span className="text-xs text-slate-300">
                  {grantedCount} من 5 أذونات نشطة
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mt-1">
                {activeTab === 'desktop'
                  ? 'أذونات وميزات نسخة سطح المكتب (Windows / Mac / Linux)'
                  : 'أذونات وميزات نسخة تطبيق الموبايل وأندرويد'}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
                {activeTab === 'desktop'
                  ? 'تمكين ميزة النسخ الاحتياطي التلقائي الصامت بمجلد محلي، البحث والتحكم الصوتي الذكي بالميكروفون، حماية التخزين الدائم، والنوافذ المنبثقة لطباعة الفواتير مباشرة.'
                  : 'تهيئة الأذونات الأساسية لضمان عمل مسح باركود الأصناف والسندات بالكاميرا، وتنزيل فواتير الـ PDF، والطباعة الحرارية عبر البلوتوث، وتنبيهات الإشعارات، وتحديد موقع المندوبين.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={handleExecuteAllOneByOne}
              disabled={isAutoExecutingAll}
              className="btn-3d btn-3d-blue flex items-center gap-2 px-4 py-2.5 text-xs font-bold w-full sm:w-auto justify-center"
            >
              <Zap size={15} />
              {isAutoExecutingAll ? 'جاري التنفيذ التتابعي...' : 'تفعيل كافة الأذونات الواحد تلو الآخر'}
            </button>
          </div>
        </div>

        {/* Status Message Alert */}
        {statusMessage && (
          <div className={`mt-4 p-3 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' 
              : statusMessage.type === 'error'
              ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
              : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
          }`}>
            <Info size={15} className="shrink-0" />
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* The 5 Permissions List (Sequential execution & detail) */}
      <div className="space-y-4">
        {currentKeys.map((key, index) => {
          const config = PERMISSIONS_CONFIG[key];
          const state = statuses[key];
          const isLoading = loadingKey === key;
          const isCurrentExecuting = isAutoExecutingAll && currentStepIndex === index;

          return (
            <div 
              key={key}
              className={`bg-white rounded-2xl border transition-all duration-200 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                isCurrentExecuting 
                  ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md bg-blue-50/10' 
                  : state === 'granted'
                  ? 'border-emerald-200 bg-emerald-50/5'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Left Details */}
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                  {getIcon(key)}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">
                      {config.titleAr}
                    </h4>
                    {config.isEssential && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        أساسي
                      </span>
                    )}
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {config.categoryAr}
                    </span>
                    {getStatusBadge(state)}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {config.descriptionAr}
                  </p>

                  <div className="pt-1.5 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-[11px] text-slate-500">
                    <div>
                      <strong className="text-slate-700 font-semibold">سبب الحاجة: </strong>
                      <span>{config.purposeAr}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-indigo-700 bg-indigo-50/70 border border-indigo-100 rounded-lg px-2.5 py-1 inline-block mt-1">
                    <strong className="font-semibold">طريقة المنح: </strong>
                    <span>{config.howToGrantAr}</span>
                  </div>
                </div>
              </div>

              {/* Right Action Button */}
              <div className="flex items-center gap-2 self-end md:self-center shrink-0 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => handleRequestOne(key)}
                  disabled={isLoading || isAutoExecutingAll}
                  className={`w-full md:w-auto px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    state === 'granted'
                      ? 'btn-3d btn-3d-slate text-emerald-700'
                      : 'btn-3d btn-3d-blue'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      جاري التنفيذ...
                    </>
                  ) : state === 'granted' ? (
                    <>
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      إعادة الاختبار / مفعّل
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      طلب وتفعيل الإذن الآن
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Helpful Tips Platform-specific */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-xs sm:text-sm">
          <ShieldCheck size={18} className="text-blue-600" />
          {activeTab === 'desktop' 
            ? 'إرشادات لتحقيق أفضل أداء لنسخة سطح المكتب (Desktop):' 
            : 'إرشادات ضبط أندرويد لضمان استقرار التطبيق في الخلفية:'}
        </div>
        {activeTab === 'desktop' ? (
          <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside pr-1">
            <li>
              <strong>مجلد النسخ الاحتياطي الصامت:</strong> يمكنك تحديد مجلد على قرص D: أو مجلد متزامن مع Google Drive أو Dropbox لضمان حفظ كل فاتورة وسند آلياً في الخلفية.
            </li>
            <li>
              <strong>البحث الصوتي الذكي (Voice Search):</strong> اختصار لوحة المفاتيح المعتمد أو زر الميكروفون يتيح لك البحث عن أي حساب، عميل، أو شاشة بالأمر الصوتي العربي مباشرة.
            </li>
            <li>
              <strong>طباعة الفواتير:</strong> تفعيل النوافذ المنبثقة يتيح طباعة الفاتورة بضغطة زر واحدة على أي طابعة متصلة بجهازك (A4 أو طابعات الباركود والإيصالات الحرارية).
            </li>
          </ul>
        ) : (
          <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside pr-1">
            <li>
              <strong>إلغاء قيود توفير البطارية (Unrestricted):</strong> من إعدادات الهاتف &gt; التطبيقات &gt; لوجوستريا &gt; البطارية &gt; اختر <strong>غير مقيّد (Unrestricted)</strong> لتجنب إيقاف المزامنة السحابية والنسخ الاحتياطي في الخلفية.
            </li>
            <li>
              <strong>السماح بالنوافذ المنبثقة والتنزيل:</strong> تأكد من تفعيل إذن التنزيل لمتصفح كروم أو سامسونج لتنزيل ملفات الـ PDF وكشوفات الإكسل مباشرة.
            </li>
            <li>
              <strong>طباعة البلوتوث:</strong> تأكد من تشغيل البلوتوث والموقع الجغرافي على هاتفك لتتمكن ميزة Web Bluetooth من العثور على طابعة الفواتير المجاورة.
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
