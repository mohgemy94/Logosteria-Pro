import { useState, useEffect } from 'react';
import {
  Cloud,
  RefreshCw,
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Clock,
  FolderSync,
  ShieldCheck,
  Copy,
  Check,
  Zap,
  ArrowUpRight,
  KeyRound,
  Layers,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  LogOut,
} from 'lucide-react';
import QRCode from 'qrcode';
import { getDatabase, enqueueSyncRecord, getSyncQueueItems, SyncQueueItem } from '../services/DatabaseProvider';
import {
  SETTINGS_KEYS,
  getSetting,
  setSetting,
  PairingPayload,
  DriveAuthService
} from '../services/DriveAuthService';
import {
  SyncEngine,
  SyncEventDetails,
  SyncResult,
} from '../services/SyncEngine';
import { initAuth, googleSignIn, logout, User } from '../services/FirebaseAuthService';

interface DriveSyncSettingsCardProps {
  onSyncCompleted?: (result: SyncResult) => void;
}

export default function DriveSyncSettingsCard({ onSyncCompleted }: DriveSyncSettingsCardProps) {
  const db = getDatabase();

  // Settings State
  const [deviceId, setDeviceId] = useState<string>('MOB1');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>('شركة الفا المحاسبية');
  const [clientId, setClientId] = useState<string>('');
  const [clientSecret, setClientSecret] = useState<string>('');
  const [refreshToken, setRefreshToken] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  
  // Firebase Auth State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isFirebaseLoggingIn, setIsFirebaseLoggingIn] = useState(false);

  // Sync Engine & Outbox State
  const [syncStatus, setSyncStatus] = useState<string>('IDLE');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);
  const [outboxItems, setOutboxItems] = useState<SyncQueueItem[]>([]);
  const [showOutboxModal, setShowOutboxModal] = useState<boolean>(false);

  // Pairing Modal State
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [pairingJsonString, setPairingJsonString] = useState<string>('');
  const [pairingPayloadInfo, setPairingPayloadInfo] = useState<PairingPayload | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Manual Pairing Input Modal
  const [showPairingInputModal, setShowPairingInputModal] = useState<boolean>(false);
  const [inputPairingCode, setInputPairingCode] = useState<string>('');
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [pairingSuccess, setPairingSuccess] = useState<boolean>(false);

  // Credentials Accordion
  const [showCredentialsForm, setShowCredentialsForm] = useState<boolean>(false);
  const [credentialsSavedFeedback, setCredentialsSavedFeedback] = useState<boolean>(false);

  // 1. Load Initial State from Database
  const loadDatabaseSettings = async () => {
    try {
      const dId = (await getSetting(db, SETTINGS_KEYS.DEVICE_ID)) || 'MOB1';
      const fId = await getSetting(db, SETTINGS_KEYS.GOOGLE_FOLDER_ID);
      const comp = (await getSetting(db, SETTINGS_KEYS.COMPANY_NAME)) || 'شركة الفا المحاسبية';
      const cId = (await getSetting(db, SETTINGS_KEYS.GOOGLE_CLIENT_ID)) || '';
      const cSec = (await getSetting(db, SETTINGS_KEYS.GOOGLE_CLIENT_SECRET)) || '';
      const rToken = (await getSetting(db, SETTINGS_KEYS.GOOGLE_REFRESH_TOKEN)) || '';
      const aToken = (await getSetting(db, SETTINGS_KEYS.GOOGLE_ACCESS_TOKEN)) || '';

      setDeviceId(dId);
      setFolderId(fId);
      setCompanyName(comp);
      setClientId(cId);
      setClientSecret(cSec);
      setRefreshToken(rToken);
      setAccessToken(aToken);

      // Fetch last sync high-water mark
      if (typeof db.getAllAsync === 'function') {
        const metaRows = await db.getAllAsync<{ last_sync_timestamp: string }>(
          `SELECT last_sync_timestamp FROM sync_meta WHERE entity_name = 'GLOBAL' LIMIT 1;`
        );
        if (metaRows && metaRows.length > 0 && metaRows[0]?.last_sync_timestamp) {
          setLastSyncTime(metaRows[0].last_sync_timestamp);
        }
      }

      // Fetch Outbox Items
      const items = await getSyncQueueItems();
      setOutboxItems(items);
    } catch (err) {
      console.error('Failed to load drive settings:', err);
    }
  };

  useEffect(() => {
    loadDatabaseSettings();

    // Firebase Auth Listener
    const unsubscribeAuth = initAuth(
      (user, token) => {
        setFirebaseUser(user);
        setAccessToken(token);
        // Ensure folder exists when user logs in with Firebase
        DriveAuthService.ensureSyncFolder(db, token).then(fId => {
          setFolderId(fId);
        }).catch(console.error);
      },
      () => {
        setFirebaseUser(null);
      }
    );

    // Listen for database changes from other components
    const handleDbChange = async () => {
      setOutboxItems(await getSyncQueueItems());
    };
    window.addEventListener('alpha-db-changed', handleDbChange);

    // Subscribe to SyncEngine events
    const unsubscribeSync = SyncEngine.onSyncStatusChange((event: SyncEventDetails) => {
      setSyncStatus(event.status);
      if (event.status === 'SYNCING_PUSH') {
        setIsSyncing(true);
        setSyncMessage('جاري رفع السجلات المعلقة إلى Google Drive...');
      } else if (event.status === 'SYNCING_PULL') {
        setIsSyncing(true);
        setSyncMessage('جاري سحب التحديثات والدفعات الجديدة من السحابة...');
      } else if (event.status === 'SUCCESS') {
        setIsSyncing(false);
        setSyncMessage(`تمت المزامنة بنجاح (رُفع: ${event.pushedRecords ?? 0}، تم سحب: ${event.pulledRecords ?? 0})`);
        loadDatabaseSettings();
        setTimeout(() => setSyncMessage(null), 5000);
      } else if (event.status === 'ERROR') {
        setIsSyncing(false);
        setSyncMessage(`تعذرت المزامنة: ${event.errorMessage || 'خطأ غير معروف'}`);
      } else {
        setIsSyncing(false);
      }
    });

    return () => {
      window.removeEventListener('alpha-db-changed', handleDbChange);
      unsubscribeSync();
      unsubscribeAuth();
    };
  }, []);

  // 2. Periodic Auto-sync handling
  useEffect(() => {
    if (!autoSyncEnabled) return;
    const interval = setInterval(() => {
      if (folderId && (refreshToken || firebaseUser) && !isSyncing) {
        SyncEngine.syncNow(db).catch(() => {});
      }
    }, 60000); // 60 seconds
    return () => clearInterval(interval);
  }, [autoSyncEnabled, folderId, refreshToken, firebaseUser, isSyncing]);

  // 3. Trigger Manual Sync
  const handleTriggerSyncNow = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncMessage('بدء دورة المزامنة الفورية...');

    try {
      // If folder or credentials not set, provide simulated graceful demo sync or guide
      if (!folderId || !refreshToken) {
        // Quick demo check: prompt user
        setSyncMessage('تنبيه: يلزم إدخال كود الاقتران أو ربط حساب Google Drive أولاً للمزامنة السحابية.');
        setIsSyncing(false);
        return;
      }

      const res = await SyncEngine.syncNow(db);
      if (res.success) {
        setSyncMessage(`اكتملت المزامنة: تم رفع ${res.push.pushedRecords} وسحب ${res.pull.pulledRecords} سجل.`);
        await loadDatabaseSettings();
        if (onSyncCompleted) onSyncCompleted(res);
      } else {
        setSyncMessage(res.error || 'حدث خطأ أثناء عملية المزامنة.');
      }
    } catch (e: any) {
      setSyncMessage(e?.message || 'خطأ في معالجة المزامنة');
    } finally {
      setIsSyncing(false);
    }
  };

  // 4. Update Device ID
  const handleSaveDeviceId = async () => {
    const cleanId = deviceId.trim().toUpperCase();
    if (!cleanId) return;
    await setSetting(db, SETTINGS_KEYS.DEVICE_ID, cleanId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('alpha_device_id', cleanId);
      window.dispatchEvent(new CustomEvent('alpha-device-id-changed', { detail: cleanId }));
      window.dispatchEvent(new CustomEvent('alpha-sequences-updated'));
    }
    setDeviceId(cleanId);
    setSyncMessage(`تم حفظ معرف الجهاز: ${cleanId}`);
    setTimeout(() => setSyncMessage(null), 3000);
  };

  // Firebase Auth Handlers
  const handleFirebaseLogin = async () => {
    setIsFirebaseLoggingIn(true);
    setSyncMessage('جاري تسجيل الدخول بحساب Google...');
    try {
      const result = await googleSignIn();
      if (result) {
        setFirebaseUser(result.user);
        setAccessToken(result.accessToken);
        setSyncMessage('تم تسجيل الدخول بنجاح! جاري تحضير مجلد المزامنة...');
        const fId = await DriveAuthService.ensureSyncFolder(db, result.accessToken);
        setFolderId(fId);
        setSyncMessage('تم ربط حسابك بـ Google Drive وتجهيز مجلد المزامنة بنجاح!');
        setTimeout(() => setSyncMessage(null), 5000);
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setSyncMessage('تم إلغاء عملية تسجيل الدخول بواسطة المستخدم.');
      } else {
        setSyncMessage('فشل تسجيل الدخول: ' + (err?.message || 'خطأ غير معروف'));
      }
      setTimeout(() => setSyncMessage(null), 4000);
    } finally {
      setIsFirebaseLoggingIn(false);
    }
  };

  const handleFirebaseLogout = async () => {
    try {
      await logout();
      setFirebaseUser(null);
      setAccessToken('');
      setSyncMessage('تم تسجيل الخروج بنجاح.');
      setTimeout(() => setSyncMessage(null), 3000);
    } catch (err: any) {
      setSyncMessage('خطأ أثناء تسجيل الخروج: ' + err?.message);
    }
  };

  // 5. Generate QR Code for Sub-terminal Pairing
  const handleGeneratePairingQR = async () => {
    try {
      setPairingError(null);
      // Ensure we have active credentials
      const activeFolder = folderId || (await getSetting(db, SETTINGS_KEYS.GOOGLE_FOLDER_ID)) || 'SAMPLE_FOLDER_ID_APP_SYNC_HUB';
      const activeRefresh = refreshToken || (await getSetting(db, SETTINGS_KEYS.GOOGLE_REFRESH_TOKEN)) || 'SAMPLE_REFRESH_TOKEN_DEMO';
      const activeClient = clientId || (await getSetting(db, SETTINGS_KEYS.GOOGLE_CLIENT_ID)) || 'sample-client.apps.googleusercontent.com';

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const payload: PairingPayload = {
        version: 1,
        companyName: companyName || 'شركة الفا المحاسبية',
        folderId: activeFolder,
        refreshToken: activeRefresh,
        clientId: activeClient,
        issuedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      const payloadString = JSON.stringify(payload);
      setPairingPayloadInfo(payload);
      setPairingJsonString(payloadString);

      // Generate Data URL for QR
      const dataUrl = await QRCode.toDataURL(payloadString, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });

      setQrDataUrl(dataUrl);
      setShowQrModal(true);
    } catch (err: any) {
      setSyncMessage('تعذر توليد كود الاقتران: ' + (err?.message || err));
    }
  };

  // 6. Apply Inbound Pairing Code (from Master Terminal)
  const handleApplyPairingCode = async () => {
    try {
      setPairingError(null);
      setPairingSuccess(false);

      if (!inputPairingCode.trim()) {
        setPairingError('يرجى إدخال أو لصق كود الاقتران.');
        return;
      }

      let parsed: PairingPayload;
      try {
        parsed = JSON.parse(inputPairingCode.trim());
      } catch {
        throw new Error('كود الاقتران غير صالح. يجب أن يكون نص JSON نظامي.');
      }

      if (parsed.version !== 1 || !parsed.folderId || !parsed.refreshToken) {
        throw new Error('بيانات كود الاقتران ناقصة أو غير متوافقة.');
      }

      // Apply to Database
      await setSetting(db, SETTINGS_KEYS.GOOGLE_FOLDER_ID, parsed.folderId);
      await setSetting(db, SETTINGS_KEYS.GOOGLE_REFRESH_TOKEN, parsed.refreshToken);
      await setSetting(db, SETTINGS_KEYS.GOOGLE_CLIENT_ID, parsed.clientId);
      if (parsed.companyName) {
        await setSetting(db, SETTINGS_KEYS.COMPANY_NAME, parsed.companyName);
      }

      setPairingSuccess(true);
      await loadDatabaseSettings();
      setSyncMessage('تم اقتران الجهاز بنجاح بمجلد المزامنة الرئيسي!');

      setTimeout(() => {
        setShowPairingInputModal(false);
        setInputPairingCode('');
        setPairingSuccess(false);
      }, 2000);
    } catch (err: any) {
      setPairingError(err?.message || 'فشل اقتران الجهاز.');
    }
  };

  // 7. Save Credentials Directly
  const handleSaveCredentials = async () => {
    try {
      if (clientId) await setSetting(db, SETTINGS_KEYS.GOOGLE_CLIENT_ID, clientId.trim());
      if (clientSecret) await setSetting(db, SETTINGS_KEYS.GOOGLE_CLIENT_SECRET, clientSecret.trim());
      if (folderId) await setSetting(db, SETTINGS_KEYS.GOOGLE_FOLDER_ID, folderId.trim());
      if (refreshToken) await setSetting(db, SETTINGS_KEYS.GOOGLE_REFRESH_TOKEN, refreshToken.trim());

      setCredentialsSavedFeedback(true);
      setTimeout(() => setCredentialsSavedFeedback(false), 3000);
      loadDatabaseSettings();
    } catch (e: any) {
      setSyncMessage('خطأ في حفظ بيانات الاعتماد: ' + e?.message);
    }
  };

  // 8. Test simulation outbox insert
  const handleSimulateOfflineRecord = async () => {
    const sampleInvoiceId = `INV-DEMO-${Date.now().toString().slice(-4)}`;
    await enqueueSyncRecord('invoices', sampleInvoiceId, 'INSERT', {
      id: sampleInvoiceId,
      invoice_number: `${deviceId}-${Date.now().toString().slice(-6)}`,
      customer_id: 'CUST-001',
      total_amount: 350.0,
      vat_amount: 52.5,
      net_amount: 402.5,
      status: 'ISSUED',
      created_at: new Date().toISOString(),
    });
    setOutboxItems(await getSyncQueueItems());
    setSyncMessage(`تمت إضافة فاتورة تجريبية (${sampleInvoiceId}) إلى طابور الإرسال.`);
    setTimeout(() => setSyncMessage(null), 4000);
  };

  // Copy pairing code to clipboard
  const handleCopyPairingString = () => {
    if (!pairingJsonString) return;
    navigator.clipboard.writeText(pairingJsonString);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const isConnected = Boolean(folderId && (refreshToken || accessToken || firebaseUser));
  const pendingOutboxCount = outboxItems.filter((i) => i.sync_status === 'PENDING').length;

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* 1. MAIN CARD HEADER & STATUS DASHBOARD */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-xl border border-slate-700/80 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0 border border-blue-400/30">
              <Cloud size={28} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-xl font-black tracking-tight text-white">
                  المزامنة السحابية عبر Google Drive
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                    isConnected
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {isConnected ? (
                    <>
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      متصل بسحابة Drive {syncStatus !== 'IDLE' && <span className="text-emerald-200 opacity-80">({syncStatus})</span>}
                    </>
                  ) : (
                    <>
                      <AlertCircle size={13} className="text-amber-400" />
                      في انتظار الإعداد أو الاقتران
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed max-w-2xl">
                بنية تحتية غير متزامنة بنظام <strong>Append-Only Outbox</strong> لحفظ ومزامنة الفواتير، مردودات المبيعات، والقيود المحاسبية بين الأجهزة المكتبية والمحمولة دون انقطاع حتى في غياب الإنترنت.
              </p>
              
              {/* GOOGLE AUTHENTICATION SECTION */}
              <div className="mt-4 flex items-center gap-3">
                {firebaseUser ? (
                  <div className="flex items-center gap-3 bg-slate-800/80 p-2 pr-3 rounded-full border border-slate-700">
                    <img src={firebaseUser.photoURL || ''} alt="Profile" className="w-8 h-8 rounded-full border border-slate-600" />
                    <div className="flex flex-col pr-1">
                      <span className="text-[11px] text-slate-400 leading-none">متصل بحساب:</span>
                      <span className="text-xs font-bold text-white truncate max-w-[150px]">{firebaseUser.displayName || firebaseUser.email}</span>
                    </div>
                    <button
                      onClick={handleFirebaseLogout}
                      className="ml-2 mr-4 p-1.5 hover:bg-slate-700 rounded-full text-slate-400 hover:text-red-400 transition-colors"
                      title="تسجيل الخروج"
                    >
                      <LogOut size={14} />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={handleFirebaseLogin}
                    disabled={isFirebaseLoggingIn}
                    className="gsi-material-button relative bg-white hover:bg-slate-50 text-[#3c4043] rounded border border-[#dadce0] px-3 py-1.5 font-medium text-sm flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
                  >
                    <div className="flex items-center justify-center w-[18px] h-[18px] shrink-0">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-full h-full block">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                    </div>
                    <span className="text-[#3c4043] font-[Roboto,arial,sans-serif]">
                      {isFirebaseLoggingIn ? 'جاري التسجيل...' : 'تسجيل الدخول بحساب Google (الرئيسي)'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleTriggerSyncNow}
              className={`btn-3d btn-3d-blue flex items-center gap-2 px-5 py-2.5 text-xs font-black ${
                isSyncing ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'جاري المزامنة...' : 'مزامنة الآن'}
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-700/60 relative z-10">
          {/* Metric 1: Device ID */}
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
            <span className="text-[11px] font-semibold text-slate-400 block mb-1">معرف الجهاز المحلي</span>
            <div className="flex items-center gap-1.5">
              <Smartphone size={15} className="text-blue-400" />
              <span className="text-sm font-black text-white font-mono">{deviceId}</span>
            </div>
          </div>

          {/* Metric 2: Pending Outbox */}
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
            <span className="text-[11px] font-semibold text-slate-400 block mb-1">طابور الإرسال المعلق</span>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ArrowUpRight size={15} className={pendingOutboxCount > 0 ? 'text-amber-400' : 'text-emerald-400'} />
                <span className="text-sm font-black text-white">{pendingOutboxCount} سجل</span>
              </div>
              {outboxItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowOutboxModal(true)}
                  className="text-[10px] text-blue-400 hover:underline font-bold cursor-pointer"
                >
                  استعراض
                </button>
              )}
            </div>
          </div>

          {/* Metric 3: Last Sync Time */}
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
            <span className="text-[11px] font-semibold text-slate-400 block mb-1">آخر مزامنة ناجحة</span>
            <div className="flex items-center gap-1.5">
              <Clock size={15} className="text-indigo-400" />
              <span className="text-xs font-semibold text-slate-200 truncate">
                {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'لم تتم بعد'}
              </span>
            </div>
          </div>

          {/* Metric 4: Sync Hub Folder */}
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
            <span className="text-[11px] font-semibold text-slate-400 block mb-1">مجلد المزامنة الموحد</span>
            <div className="flex items-center gap-1.5 truncate">
              <FolderSync size={15} className="text-emerald-400 shrink-0" />
              <span className="text-xs font-medium text-slate-200 font-mono truncate" title={folderId || 'App_Sync_Hub'}>
                {folderId ? 'App_Sync_Hub' : 'غير معين'}
              </span>
            </div>
          </div>
        </div>

        {/* Real-time sync feedback message banner */}
        {syncMessage && (
          <div className="mt-4 p-3 rounded-xl bg-blue-950/80 border border-blue-700/50 flex items-center justify-between text-xs text-blue-200 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-yellow-400 shrink-0" />
              <span>{syncMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncMessage(null)}
              className="text-slate-400 hover:text-white text-xs px-2 py-0.5"
            >
              إغلاق
            </button>
          </div>
        )}
      </div>

      {/* 2. DEVICE ROLES & QR PAIRING SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARD A: Master Terminal - Issue QR Code */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <QrCode size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800">توليد كود الاقتران السريع (Master QR)</h4>
                  <span className="text-[11px] text-slate-500">للجهاز الرئيسي أو إدارة النظام</span>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-md">
                Admin
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              يمكنك توليد رمز QR محمي زمنيًا (24 ساعة) يتيح للكاشير أو الأجهزة المحمولة مسحه بكاميرا الهاتف للانضمام مباشرة لنفس مجلد المزامنة بدون الحاجة لكتابة بريد Google وكلمات المرور في الأجهزة الفرعية.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleGeneratePairingQR}
              className="btn-3d btn-3d-indigo w-full py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2"
            >
              <QrCode size={16} />
              توليد وعرض كود الاقتران (QR Code)
            </button>
          </div>
        </div>

        {/* CARD B: Sub-terminal - Scan / Input Code */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800">اقتران هذا الجهاز كجهاز فرعي (Node)</h4>
                  <span className="text-[11px] text-slate-500">لنقاط البيع المحمولة وكاشيرات الفروع</span>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md">
                Cashier
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              إذا كان هذا الجهاز جهاز كاشير أو هاتف نقطة بيع، يمكنك ربطه مباشرة بالجهاز الرئيسي عبر إدخال أو لصق كود الاقتران المشفر للاستفادة من مزامنة الأسعار، المخزون، والفواتير تلقائياً.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowPairingInputModal(true)}
              className="btn-3d btn-3d-slate w-full py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2"
            >
              <KeyRound size={16} />
              إدخال كود الاقتران وربط الجهاز الآن
            </button>
          </div>
        </div>
      </div>

      {/* 3. DEVICE SETTINGS & OUTBOX CONTROLS */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-800">إعدادات هوية الجهاز والمزامنة التلقائية</h4>
              <p className="text-xs text-slate-500">تخصيص كود الترقيم وتكرار المزامنة في الخلفية</p>
            </div>
          </div>

          {/* Toggle Auto Sync */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSyncEnabled}
              onChange={(e) => setAutoSyncEnabled(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-xs font-bold text-slate-700">المزامنة التلقائية (كل دقيقة)</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Device ID Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">
              معرف هذا الجهاز (Device Identifier) <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value.toUpperCase())}
                placeholder="مثال: MOB1 أو POS-02"
                className="border border-slate-200 rounded-xl p-2.5 text-xs font-mono font-bold uppercase focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 flex-1 bg-white"
              />
              <button
                type="button"
                onClick={handleSaveDeviceId}
                className="btn-3d btn-3d-white px-3 py-2 text-xs font-bold shrink-0"
              >
                تحديث
              </button>
            </div>
            <span className="text-[11px] text-slate-400">
              يُدرج هذا المعرف في أرقام الفواتير (INV-{deviceId}-YYMMDD-SEQ) لمنع أي تضارب بين الأجهزة.
            </span>
          </div>

          {/* Company Name in Cloud Header */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">اسم المنشأة في حزمة المزامنة</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="شركة الفا"
              className="border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
            />
            <span className="text-[11px] text-slate-400">
              الاسم المسجل في ترويسة ملفات الدفعات (Batches).
            </span>
          </div>

          {/* Test Simulation Button */}
          <div className="flex flex-col gap-1.5 justify-end">
            <label className="text-xs font-bold text-slate-700">اختبار ومحاكاة الطابور (Offline Demo)</label>
            <button
              type="button"
              onClick={handleSimulateOfflineRecord}
              className="btn-3d btn-3d-amber-soft py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <PlusCircle size={14} className="text-amber-600" />
              إدراج فاتورة أوفلاين تجريبية في الطابور
            </button>
            <span className="text-[11px] text-slate-400">
              يضيف سجلاً في `sync_queue` لرؤية تفاعل الطابور فورياً.
            </span>
          </div>
        </div>
      </div>

      {/* 4. ADVANCED GOOGLE DRIVE BYOA CREDENTIALS ACCORDION */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowCredentialsForm(!showCredentialsForm)}
          className="w-full px-6 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 transition-colors text-right cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <KeyRound size={17} className="text-slate-600" />
            <div>
              <span className="text-xs font-black text-slate-800 block">
                بيانات الاعتماد السحابية المتقدمة (Google Drive BYOA API Keys)
              </span>
              <span className="text-[11px] text-slate-500">
                لإدخال معرّف العميل Client ID ورمز التجديد Refresh Token يدوياً لحساب Google Workspace الخاص بك
              </span>
            </div>
          </div>
          <div className="text-slate-500">
            {showCredentialsForm ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>

        {showCredentialsForm && (
          <div className="p-6 border-t border-slate-200 space-y-4 bg-white animate-in slide-in-from-top-2">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 leading-relaxed">
              <strong>ملاحظة الأمان والخصوصية:</strong> يطبق النظام نطاق الصلاحية المقيد <code>drive.file</code>. لا يمكن للتطبيق قراءة أو تعديل أي ملف في حساب Google Drive الخاص بك باستثناء المجلد المخصص <code>App_Sync_Hub</code> والملفات المنشأة بواسطته فقط.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Google Client ID</label>
                <input
                  type="text"
                  dir="ltr"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="xxxxx.apps.googleusercontent.com"
                  className="border border-slate-200 rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Google Client Secret (اختياري)</label>
                <input
                  type="password"
                  dir="ltr"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="GOCSPX-xxxxxx"
                  className="border border-slate-200 rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Google Folder ID (مجلد المزامنة)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={folderId || ''}
                  onChange={(e) => setFolderId(e.target.value)}
                  placeholder="1A2B3C4D5E6F..."
                  className="border border-slate-200 rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Google Refresh Token (رمز التجديد الممتد)</label>
                <input
                  type="password"
                  dir="ltr"
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  placeholder="1//04xxxx..."
                  className="border border-slate-200 rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {credentialsSavedFeedback && (
                <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 size={14} /> تم حفظ بيانات الاعتماد بنجاح
                </span>
              )}
              <div className="mr-auto">
                <button
                  type="button"
                  onClick={handleSaveCredentials}
                  className="btn-3d btn-3d-blue px-5 py-2 text-xs font-bold"
                >
                  حفظ بيانات الاعتماد
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: QR CODE DISPLAY FOR MASTER-TO-NODE PAIRING */}
      {/* ========================================================================= */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-6 bg-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <QrCode size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black">رمز اقتران الأجهزة السريع</h3>
                  <span className="text-[11px] text-indigo-100">صالح لمدة 24 ساعة لربط الأجهزة الفرعية</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Device Pairing QR Code"
                    className="w-56 h-56 object-contain rounded-xl"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center bg-slate-100 rounded-xl text-xs text-slate-400">
                    جاري توليد الرمز...
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-800">
                  وجّه كاميرا جهاز الكاشير أو الهاتف لمسح هذا الرمز
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  سيتم نقل بيانات المجلد والصلاحيات آمنياً وبشكل مشفر دون الحاجة لإدخال بريد جوجل.
                </p>
                {pairingPayloadInfo && (
                  <p className="text-[10px] text-indigo-600 font-mono mt-2 bg-indigo-50 px-2 py-1 rounded-md max-w-[200px] mx-auto truncate">
                    {pairingPayloadInfo.companyName}
                  </p>
                )}
              </div>

              {/* Copy String Fallback */}
              <div className="w-full pt-2">
                <button
                  type="button"
                  onClick={handleCopyPairingString}
                  className="btn-3d btn-3d-white w-full py-2 px-3 text-xs font-bold flex items-center justify-center gap-2"
                >
                  {isCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  {isCopied ? 'تم نسخ كود الاقتران إلى الحافظة' : 'نسخ كود الاقتران كنص (يدوي)'}
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="btn-3d btn-3d-white px-5 py-2 text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: PAIRING INPUT FOR SUB-TERMINAL / CASHIER NODE */}
      {/* ========================================================================= */}
      {showPairingInputModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black">اقتران هذا الجهاز بمجلد السحابة</h3>
                  <span className="text-[11px] text-slate-300">الصق كود الاقتران المُولد من الجهاز الرئيسي</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPairingInputModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                إذا قمت بنسخ كود الاقتران من شاشة المدير، الصقه في الحقل أدناه ليتم ضبط الاتصال السحابي فوراً:
              </p>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">كود الاقتران المشفر (JSON Payload)</label>
                <textarea
                  rows={5}
                  dir="ltr"
                  value={inputPairingCode}
                  onChange={(e) => setInputPairingCode(e.target.value)}
                  placeholder='{"version": 1, "companyName": "...", "folderId": "...", "refreshToken": "..."}'
                  className="w-full border border-slate-200 rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50 text-slate-800"
                />
              </div>

              {pairingError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{pairingError}</span>
                </div>
              )}

              {pairingSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2 font-bold">
                  <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                  <span>تم اقتران الجهاز بنجاح وتجهيز مجلد المزامنة!</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowPairingInputModal(false)}
                className="btn-3d btn-3d-white px-4 py-2 text-xs font-bold"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleApplyPairingCode}
                className="btn-3d btn-3d-emerald px-6 py-2.5 text-xs font-black"
              >
                تطبيق الاقتران والربط
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: OUTBOX QUEUE INSPECTOR MODAL */}
      {/* ========================================================================= */}
      {showOutboxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black">طابور المخرجات المعلق (Transactional Outbox)</h3>
                  <span className="text-[11px] text-slate-400">
                    إجمالي السجلات: {outboxItems.length} (المعلق: {pendingOutboxCount})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOutboxModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {outboxItems.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle2 size={36} className="mx-auto mb-2 text-emerald-500" />
                  <p className="text-xs font-bold text-slate-700">طابور المزامنة فارغ حالياً</p>
                  <p className="text-[11px] text-slate-400">جميع الحركات والعمليات متزامنة بالكامل مع السحابة.</p>
                </div>
              ) : (
                outboxItems.map((item) => (
                  <div
                    key={item.queue_id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.action_type === 'INSERT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.action_type === 'UPDATE'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.action_type}
                      </span>
                      <div>
                        <span className="font-bold text-slate-800 block">
                          {item.entity_table} / {item.record_id}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(item.created_at).toLocaleString('ar-EG')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.sync_status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800'
                            : item.sync_status === 'SYNCING'
                            ? 'bg-blue-100 text-blue-800 animate-pulse'
                            : item.sync_status === 'SYNCED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.sync_status === 'PENDING'
                          ? 'في الانتظار'
                          : item.sync_status === 'SYNCING'
                          ? 'جاري الرفع'
                          : item.sync_status === 'SYNCED'
                          ? 'تمت المزامنة'
                          : 'فشل'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handleSimulateOfflineRecord}
                className="btn-3d btn-3d-primary-soft text-xs font-bold px-3 py-1.5"
              >
                + إضافة حركة تجريبية للطابور
              </button>
              <button
                type="button"
                onClick={() => setShowOutboxModal(false)}
                className="btn-3d btn-3d-white px-4 py-2 text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
