import { useState, useEffect, type ChangeEvent } from 'react';
import {
  Folder,
  FolderCheck,
  FolderSync,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  Database,
  RefreshCw,
  HardDrive,
  Download,
  Upload,
  Layers,
  History,
  FileText
} from 'lucide-react';
import {
  getAutoSaveConfig,
  saveAutoSaveConfig,
  subscribeAutoSave,
  selectLocalDirectory,
  triggerAutoSaveNow,
  downloadBackupDirectly,
  restoreSystemFromBackup,
  readLatestBackupFromDirectory,
  getStoredDirectoryHandle,
  clearDirectoryHandle,
  collectSystemBackupData,
  isFileSystemAccessSupported,
  verifyDirectoryPermission,
  type AutoSaveConfig,
  type SystemFullBackup
} from '../utils/localFolderBackup';

interface Props {
  onClose?: () => void;
  isModal?: boolean;
}

export default function LocalFolderBackupManager({ onClose, isModal = false }: Props) {
  const [config, setConfig] = useState<AutoSaveConfig>(() => getAutoSaveConfig());
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [isSavingNow, setIsSavingNow] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const [hasFolderHandle, setHasFolderHandle] = useState<boolean>(false);
  const [isPermissionGranted, setIsPermissionGranted] = useState<boolean>(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSummary, setRestoreSummary] = useState<Record<string, number> | null>(null);
  const [confirmRestoreModal, setConfirmRestoreModal] = useState<SystemFullBackup | null>(null);
  const [inventory, setInventory] = useState<SystemFullBackup>(() => collectSystemBackupData());
  const [activeTab, setActiveTab] = useState<'config' | 'inventory' | 'history' | 'restore'>('config');

  // Check stored handle on mount
  useEffect(() => {
    async function checkHandle() {
      const handle = await getStoredDirectoryHandle();
      if (handle) {
        setHasFolderHandle(true);
        const granted = await verifyDirectoryPermission(handle, false);
        setIsPermissionGranted(granted);
      } else {
        setHasFolderHandle(false);
      }
      setInventory(collectSystemBackupData());
    }
    checkHandle();

    // Subscribe to auto-save config changes
    const unsub = subscribeAutoSave((newCfg) => {
      setConfig(newCfg);
      setInventory(collectSystemBackupData());
    });

    return () => unsub();
  }, []);

  // Handle folder selection
  const handlePickFolder = async () => {
    setIsSelectingFolder(true);
    setSaveErrorMsg(null);
    setSaveSuccessMsg(null);

    const res = await selectLocalDirectory();
    setIsSelectingFolder(false);

    if (res.success && res.handle) {
      setHasFolderHandle(true);
      setIsPermissionGranted(true);
      setSaveSuccessMsg(`تم بنجاح اختيار وربط المجلد: "${res.folderName}"! جاري كتابة أول نسخة احتياطية...`);

      // Immediately write the initial backup
      try {
        const saveRes = await triggerAutoSaveNow();
        if (saveRes.success) {
          setSaveSuccessMsg(`تم ربط المجلد "${res.folderName}" بنجاح وكتابة النسخة الاحتياطية الأولى!`);
        } else {
          setSaveErrorMsg(saveRes.error || 'تم ربط المجلد لكن تعذر كتابة النسخة الأولى.');
        }
      } catch (err: any) {
        setSaveErrorMsg(err.message || 'حدث خطأ أثناء كتابة النسخة الأولى.');
      }
    } else {
      setSaveErrorMsg(res.error || 'تعذر اختيار المجلد.');
    }
  };

  // Immediate Save Now
  const handleSaveNow = async () => {
    setIsSavingNow(true);
    setSaveErrorMsg(null);
    setSaveSuccessMsg(null);

    try {
      const res = await triggerAutoSaveNow();
      if (res.success) {
        setSaveSuccessMsg(`تم حفظ وتحديث النسخة الاحتياطية في المجلد المحلي بنجاح!`);
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      } else {
        setSaveErrorMsg(res.error || 'تعذر الحفظ في المجلد.');
      }
    } catch (e: any) {
      setSaveErrorMsg(e.message || 'حدث خطأ أثناء عملية الحفظ.');
    } finally {
      setIsSavingNow(false);
    }
  };

  // Disconnect Folder
  const handleDisconnectFolder = async () => {
    if (confirm('هل أنت متأكد من إيقاف الربط مع المجلد المحلي الحالي؟')) {
      await clearDirectoryHandle();
      saveAutoSaveConfig({
        folderName: null,
        enabled: false,
        lastStatus: 'idle'
      });
      setHasFolderHandle(false);
      setSaveSuccessMsg('تم إلغاء الربط مع المجلد المحلي.');
    }
  };

  // Restore from current local folder
  const handleRestoreFromCurrentFolder = async () => {
    const handle = await getStoredDirectoryHandle();
    if (!handle) {
      alert('لم يتم ربط أي مجلد محلي بعد.');
      return;
    }

    setIsRestoring(true);
    try {
      const backup = await readLatestBackupFromDirectory(handle);
      if (!backup) {
        alert('لم يتم العثور على ملف النسخة الاحتياطية (logustria_backup_latest.json) داخل هذا المجلد.');
        setIsRestoring(false);
        return;
      }
      setConfirmRestoreModal(backup);
    } catch (err: any) {
      alert('فشل قراءة النسخة من المجلد: ' + (err.message || err));
    } finally {
      setIsRestoring(false);
    }
  };

  // Execute confirmation of restore
  const handleExecuteRestore = (backupToRestore: SystemFullBackup) => {
    const res = restoreSystemFromBackup(backupToRestore);
    if (res.success) {
      setRestoreSummary(res.restoredCounts);
      setConfirmRestoreModal(null);
      setInventory(collectSystemBackupData());
      setSaveSuccessMsg('تمت استعادة كافة البيانات بنجاح وتحديث النظام!');
    } else {
      alert('فشلت عملية الاستعادة: ' + (res.error || 'خطأ غير معروف'));
    }
  };

  // Restore via JSON file upload
  const handleUploadBackupJson = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.items || json.salesInvoices || json.settings) {
          setConfirmRestoreModal(json);
        } else {
          alert('الملف المختار لا يحتوي على بنية بيانات متوافقة مع منظومة لوجوستريا.');
        }
      } catch {
        alert('حدث خطأ أثناء فك ترميز ملف JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const isSupported = isFileSystemAccessSupported();

  return (
    <div className={`flex flex-col bg-white ${isModal ? 'p-6 rounded-2xl max-w-4xl w-full mx-auto max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200' : 'w-full'}`}>
      {/* Header section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
              <HardDrive size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 flex items-center gap-2">
                الحفظ التلقائي في مجلد محلي على جهازك
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  W3C File System API
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تحديد مجلد على القرص الصلب لحفظ كافة الفواتير، الأصناف، السندات، والإعدادات تلقائياً وبشكل دوري
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={downloadBackupDirectly}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            title="تحميل نسخة احتياطية فورية لملف التنزيلات المباشر"
          >
            <Download size={14} className="text-blue-600" />
            <span>تنزيل نسخة JSON</span>
          </button>

          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              إغلاق
            </button>
          )}
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 mt-4 overflow-x-auto text-xs font-bold text-slate-600">
        <button
          type="button"
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'config'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50'
              : 'border-transparent hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <FolderSync size={15} />
          <span>المجلد وإعدادات الحفظ التلقائي</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'inventory'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50'
              : 'border-transparent hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Database size={15} />
          <span>محتويات وسجلات النسخة ({inventory.meta.recordsCount ? Object.values(inventory.meta.recordsCount).reduce((a, b) => a + b, 0) : 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'history'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50'
              : 'border-transparent hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <History size={15} />
          <span>سجل الحفظ الأخير ({config.historyLog?.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('restore')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'restore'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50'
              : 'border-transparent hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Upload size={15} />
          <span>الاستعادة والاسترجاع</span>
        </button>
      </div>

      {/* Notifications and Alerts */}
      {saveSuccessMsg && (
        <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-medium">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {saveErrorMsg && (
        <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 font-medium">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{saveErrorMsg}</span>
        </div>
      )}

      {!isSupported && (
        <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2.5">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">ملاحظة توافق المتصفح (Browser Compatibility):</p>
            <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
              المتصفح الحالي لا يدعم نافذة اختيار المجلدات المباشرة (File System Access). تعمل هذه الميزة بكفاءة كاملة على متصفحات Chrome و Edge و Brave و Opera على أنظمة Windows و macOS و Linux. يمكنك في الوقت الحالي استخدام زر "تنزيل نسخة JSON" لتنزيل نسخة كاملة فوراً.
            </p>
          </div>
        </div>
      )}

      {/* TAB 1: Main Configuration & Local Folder Selection */}
      {activeTab === 'config' && (
        <div className="flex flex-col gap-6 mt-5">
          {/* Main Folder Status Box */}
          <div className={`p-5 rounded-2xl border transition-all ${
            hasFolderHandle 
              ? 'bg-emerald-50/40 border-emerald-200/90' 
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${
                  hasFolderHandle 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {hasFolderHandle ? <FolderCheck size={26} /> : <Folder size={26} />}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-700">مجلد الحفظ المحلي المستهدف:</span>
                    {hasFolderHandle ? (
                      isPermissionGranted ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          مجلد متصل ونشط
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          بحاجة لتأكيد الإذن
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-700">
                        لم يتم ربط مجلد بعد
                      </span>
                    )}
                  </div>

                  <p className="font-mono font-extrabold text-sm sm:text-base text-slate-900 mt-1">
                    {config.folderName ? `📁 ${config.folderName}` : 'لم يتم تحديد مجلد على جهازك'}
                  </p>

                  {config.lastSavedAt ? (
                    <div className="flex items-center gap-3 text-slate-500 text-[11px] mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock size={12} className="text-blue-500" />
                        آخر حفظ تلقائي: {new Date(config.lastSavedAt).toLocaleTimeString('ar-SA')} ({new Date(config.lastSavedAt).toLocaleDateString('ar-SA')})
                      </span>
                      {config.lastFileSizeKB > 0 && (
                        <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">
                          {config.lastFileSizeKB} KB
                        </span>
                      )}
                      {config.totalRecordsCount > 0 && (
                        <span className="text-emerald-700 font-semibold">
                          ({config.totalRecordsCount} سجل محاسبي)
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-1">
                      سيتم حفظ النسخ تلقائياً بمجرد اختيار المجلد وتفعيل الخاصية.
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 self-end md:self-center flex-wrap">
                <button
                  type="button"
                  onClick={handlePickFolder}
                  disabled={isSelectingFolder}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <Folder size={16} />
                  <span>{hasFolderHandle ? 'تغيير المجلد' : 'اختيار مجلد محلي على الجهاز'}</span>
                </button>

                {hasFolderHandle && (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveNow}
                      disabled={isSavingNow}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      title="حفظ فوري فوري لجميع البيانات في المجلد"
                    >
                      <Save size={15} className={isSavingNow ? 'animate-spin' : ''} />
                      <span>{isSavingNow ? 'جاري الحفظ...' : 'حفظ فوري الآن'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDisconnectFolder}
                      className="px-3 py-2.5 bg-white border border-slate-300 text-slate-600 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      title="فصل الربط مع هذا المجلد"
                    >
                      إلغاء الربط
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Auto-Save Toggle and Timing */}
            <div className="p-5 border border-slate-200 rounded-2xl bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Clock size={18} className="text-blue-600" />
                    <h4 className="font-bold text-sm text-slate-800">جدولة وتكرار الحفظ التلقائي</h4>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => {
                        saveAutoSaveConfig({ enabled: e.target.checked });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      فترة التكرار الدوري للحفظ في المجلد:
                    </label>
                    <select
                      value={config.intervalMinutes}
                      onChange={(e) => saveAutoSaveConfig({ intervalMinutes: Number(e.target.value) })}
                      disabled={!config.enabled}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    >
                      <option value={1}>كل 1 دقيقة (تحديث متزامن مستمر فائق السرعة)</option>
                      <option value={3}>كل 3 دقائق (موصى به للعمل المكثف)</option>
                      <option value={5}>كل 5 دقائق (الافتراضي المتوازن)</option>
                      <option value={10}>كل 10 دقائق</option>
                      <option value={15}>كل 15 دقيقة</option>
                      <option value={30}>كل 30 دقيقة</option>
                      <option value={60}>كل ساعة (60 دقيقة)</option>
                    </select>
                  </div>

                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={config.saveOnChange}
                      onChange={(e) => saveAutoSaveConfig({ saveOnChange: e.target.checked })}
                      className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold block">حفظ تلقائي عند أي تعديل أو حفظ فاتورة / سند:</span>
                      <span className="text-[11px] text-slate-500 block leading-relaxed mt-0.5">
                        يقوم النظام بحفظ فوري وتحديث الملفات في المجلد المحلي بعد 3 ثوانٍ من تسجيل أي عملية جديدة.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Folder Structure & File Generation Options */}
            <div className="p-5 border border-slate-200 rounded-2xl bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Layers size={18} className="text-emerald-600" />
                  <h4 className="font-bold text-sm text-slate-800">بنية الملفات المحفوظة داخل المجلد</h4>
                </div>

                <div className="space-y-3 text-xs">
                  <label className="flex items-start gap-2.5 cursor-pointer text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={config.saveHistoricalBackups}
                      onChange={(e) => saveAutoSaveConfig({ saveHistoricalBackups: e.target.checked })}
                      className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold block">إنشاء نسخ تاريخية مؤرخة (History Versions):</span>
                      <span className="text-[11px] text-slate-500 block leading-relaxed mt-0.5">
                        حفظ ملفات مؤرخة مثل <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[10px]">history/backup_2026-09-08_12-30.json</code> للرجوع لأي نقطة زمنية سابقة.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={config.saveModularFiles}
                      onChange={(e) => saveAutoSaveConfig({ saveModularFiles: e.target.checked })}
                      className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold block">توليد ملفات JSON تفصيلية مستقلة لكل قسم (Modules):</span>
                      <span className="text-[11px] text-slate-500 block leading-relaxed mt-0.5">
                        حفظ ملفات منفصلة داخل <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[10px]">modules/</code> مثل (فواتير المبيعات، المشتريات، الأصناف، العملاء) لسهولة الاطلاع والتحليل.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>الملف الأحدث دائماً:</span>
                <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                  logustria_backup_latest.json
                </span>
              </div>
            </div>
          </div>

          {/* Folder Content Structure Visualizer */}
          <div className="p-4 bg-slate-900 text-slate-200 rounded-2xl font-mono text-xs shadow-inner">
            <div className="flex items-center justify-between text-slate-400 text-[11px] border-b border-slate-800 pb-2 mb-3">
              <span className="flex items-center gap-1.5 font-sans font-bold text-slate-300">
                <FileText size={14} className="text-blue-400" />
                شكل وتوزيع الملفات التي يتم توليدها داخل مجلدك المحلي:
              </span>
              <span>UTF-8 JSON Files</span>
            </div>
            <pre className="text-[11px] leading-relaxed text-slate-300 overflow-x-auto whitespace-pre">
{`📁 [المجلد المحلي المختار]/
├── 📄 logustria_backup_latest.json       (النسخة الشاملة الأحدث لجميع بيانات النظام)
├── 📄 README_BACKUP.txt                  (دليل توضيحي وتاريخ آخر مزامنة وعدد السجلات)
├── 📁 history/                           (مجلد الأرشيف الزمني)
│   ├── 📄 backup_2026-09-08_10-00-00.json
│   └── 📄 backup_2026-09-08_10-05-00.json
└── 📁 modules/                           (الملفات التفصيلية المستقلة)
    ├── 📄 sales_invoices.json           (فواتير المبيعات)
    ├── 📄 purchase_invoices.json        (فواتير المشتريات)
    ├── 📄 items_catalog.json            (دليل الأصناف والمخزون)
    ├── 📄 customers.json                (دليل العملاء)
    ├── 📄 vendors.json                  (دليل الموردين)
    ├── 📄 receipt_vouchers.json         (سندات القبض)
    └── 📄 company_settings.json         (إعدادات وبيانات المنشأة والضريبة)`}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 2: Inventory & Saved Records Breakdown */}
      {activeTab === 'inventory' && (
        <div className="mt-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-800">بيانات النظام المشمولة بالنسخ التلقائي:</h4>
              <p className="text-xs text-slate-500">
                يتم حفظ كل هذه الأقسام والجداول كاملة في ملف النسخة الاحتياطية
              </p>
            </div>
            <button
              type="button"
              onClick={() => setInventory(collectSystemBackupData())}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
            >
              <RefreshCw size={13} />
              تحديث العد الآن
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { label: 'فواتير المبيعات', count: inventory.salesInvoices.length, color: 'text-blue-600 bg-blue-50' },
              { label: 'فواتير المشتريات', count: inventory.purchaseInvoices.length, color: 'text-rose-600 bg-rose-50' },
              { label: 'الأصناف والمخزون', count: inventory.items.length, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'دليل العملاء', count: inventory.customers.length, color: 'text-cyan-600 bg-cyan-50' },
              { label: 'دليل الموردين', count: inventory.vendors.length, color: 'text-amber-600 bg-amber-50' },
              { label: 'سندات القبض', count: inventory.receiptVouchers.length, color: 'text-indigo-600 bg-indigo-50' },
              { label: 'سندات الصرف', count: inventory.paymentVouchers.length, color: 'text-purple-600 bg-purple-50' },
              { label: 'السندات والتحويلات', count: inventory.internalVouchers.length, color: 'text-teal-600 bg-teal-50' },
              { label: 'عقود التقسيط', count: inventory.installmentsContracts.length, color: 'text-orange-600 bg-orange-50' },
              { label: 'الكمبيالات والسندات لأمر', count: inventory.promissoryNotes.length, color: 'text-lime-600 bg-lime-50' },
              { label: 'الموظفون والرواتب', count: inventory.payrollEmployees.length, color: 'text-sky-600 bg-sky-50' },
              { label: 'قوائم تصنيع BOM', count: inventory.manufacturingBOMs.length, color: 'text-violet-600 bg-violet-50' },
              { label: 'أوامر تشغيل الإنتاج', count: inventory.manufacturingWorkOrders.length, color: 'text-fuchsia-600 bg-fuchsia-50' },
              { label: 'مراكز الإنتاج', count: inventory.manufacturingWorkCenters.length, color: 'text-pink-600 bg-pink-50' },
              { label: 'إعدادات المنشأة والضريبة', count: inventory.settings?.company?.nameAr ? 1 : 0, color: 'text-slate-600 bg-slate-100' },
              { label: 'سلاسل الترقيم التسلسلي', count: inventory.sequences ? Object.keys(inventory.sequences).length : 0, color: 'text-slate-600 bg-slate-100' },
            ].map((item, idx) => (
              <div key={idx} className="p-3.5 border border-slate-200 rounded-xl bg-white shadow-2xs flex flex-col justify-between">
                <span className="text-xs text-slate-500 font-medium">{item.label}</span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-lg font-extrabold font-mono text-slate-900">{item.count}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.color}`}>
                    سجل
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between">
            <span className="font-bold">
              إجمالي السجلات المحفوظة في قاعدة البيانات المحلية:
            </span>
            <span className="font-mono font-extrabold text-sm text-blue-700 bg-white px-3 py-1 rounded-lg border border-blue-200">
              {Object.values(inventory.meta.recordsCount || {}).reduce((a, b) => a + b, 0)} سجل
            </span>
          </div>
        </div>
      )}

      {/* TAB 3: History & Recent Auto-Save Logs */}
      {activeTab === 'history' && (
        <div className="mt-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800">سجل عمليات الحفظ التلقائي الأخيرة في المجلد:</h4>
            <span className="text-xs text-slate-500">يتم تسجيل آخر 20 عملية حفظ دوري</span>
          </div>

          {config.historyLog && config.historyLog.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-3">التوقيت والتاريخ</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">التفاصيل</th>
                    <th className="p-3">الحجم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {config.historyLog.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="p-3 font-mono text-slate-600">
                        {new Date(log.timestamp).toLocaleString('ar-SA')}
                      </td>
                      <td className="p-3">
                        {log.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={12} /> ناجح
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            <AlertCircle size={12} /> تعذر
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-800">{log.summary}</td>
                      <td className="p-3 font-mono text-slate-500">
                        {log.sizeKB > 0 ? `${log.sizeKB} KB` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <History size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-xs font-bold text-slate-700">لا يوجد سجلات حفظ سابقة بعد</p>
              <p className="text-[11px] text-slate-500 mt-1">
                ستظهر هنا تفاصيل كل عملية حفظ تلقائي دورية بمجرد تشغيلها.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Restore & Recovery */}
      {activeTab === 'restore' && (
        <div className="mt-5 flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Restore from currently connected folder */}
            <div className="border border-slate-200 p-5 rounded-2xl bg-slate-50/70 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-3">
                  <FolderSync size={20} />
                </div>
                <h4 className="font-bold text-sm text-slate-800 mb-1">الاستعادة من المجلد المحلي المختار</h4>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  قراءة واسترجاع أحدث نسخة احتياطية موجودة داخل المجلد المحلي المربوط (<code className="font-mono text-[11px] bg-white px-1 py-0.5 rounded border">logustria_backup_latest.json</code>) وتطبيقها فوراً على النظام.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRestoreFromCurrentFolder}
                disabled={!hasFolderHandle || isRestoring}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <FolderCheck size={14} className="text-emerald-600" />
                <span>{isRestoring ? 'جاري الفحص...' : 'فحص واستعادة أحدث نسخة من المجلد'}</span>
              </button>
            </div>

            {/* Restore via uploading JSON file */}
            <div className="border border-slate-200 p-5 rounded-2xl bg-slate-50/70 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3">
                  <Upload size={20} />
                </div>
                <h4 className="font-bold text-sm text-slate-800 mb-1">استيراد ملف نسخة احتياطية من جهازك</h4>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  رفع ملف نسخة احتياطية سابقة بصيغة JSON من أي مكان على حاسوبك (سواء كانت نسخة سابقة من مجلد history أو تنزيل مباشر).
                </p>
              </div>

              <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer">
                <Upload size={14} className="text-blue-600" />
                <span>اختيار ملف JSON للاستعادة</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleUploadBackupJson}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Restore Confirmation Modal/Drawer if triggered */}
          {confirmRestoreModal && (
            <div className="p-5 bg-amber-50 border border-amber-300 rounded-2xl shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle size={22} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h5 className="font-bold text-sm text-amber-900">
                    تأكيد استعادة قاعدة البيانات
                  </h5>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    تم العثور على نسخة احتياطية صالحة بتاريخ {confirmRestoreModal.meta?.exportedAt ? new Date(confirmRestoreModal.meta.exportedAt).toLocaleString('ar-SA') : 'غير محدد'}.
                    استعادة هذه النسخة ستؤدي إلى استبدال البيانات الحالية بمحتويات هذه النسخة:
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3 text-[11px] font-bold">
                    <span className="p-2 bg-white/80 rounded border border-amber-200">
                      فواتير مبيعات: {confirmRestoreModal.salesInvoices?.length || 0}
                    </span>
                    <span className="p-2 bg-white/80 rounded border border-amber-200">
                      فواتير مشتريات: {confirmRestoreModal.purchaseInvoices?.length || 0}
                    </span>
                    <span className="p-2 bg-white/80 rounded border border-amber-200">
                      الأصناف: {confirmRestoreModal.items?.length || 0}
                    </span>
                    <span className="p-2 bg-white/80 rounded border border-amber-200">
                      العملاء: {confirmRestoreModal.customers?.length || 0}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleExecuteRestore(confirmRestoreModal)}
                      className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                    >
                      تأكيد استعادة هذه النسخة وتطبيقها الآن
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRestoreModal(null)}
                      className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {restoreSummary && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
              <h5 className="font-bold mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-600" />
                ملخص السجلات المستعادة بنجاح:
              </h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                {Object.entries(restoreSummary).map(([key, val]) => (
                  <div key={key} className="bg-white/80 px-2.5 py-1.5 rounded border border-emerald-200 flex justify-between font-mono">
                    <span className="text-slate-700">{key}:</span>
                    <span className="font-bold text-emerald-800">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
