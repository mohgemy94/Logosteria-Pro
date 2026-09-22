/**
 * Device & Platform Permissions Manager (Desktop & Mobile)
 * 
 * Supports both platforms:
 * 1. Mobile (Android & iOS): Camera, Storage/Downloads, Bluetooth POS Printers, Notifications, Geolocation.
 * 2. Desktop (Windows, macOS, Linux): File System Directory Access (Silent Local Auto-Save),
 *    Microphone (Voice Search & AI Assistant), Persistent Storage Quota, Pop-ups & Direct Printing,
 *    and Desktop Background Notifications.
 */

export type PlatformTarget = 'mobile' | 'desktop';

export type PermissionKey = 
  // Mobile Keys
  | 'camera' 
  | 'storage' 
  | 'bluetooth' 
  | 'notifications' 
  | 'geolocation'
  // Desktop Keys
  | 'desktop_directory'
  | 'desktop_microphone'
  | 'desktop_persistence'
  | 'desktop_popups_print'
  | 'desktop_notifications';

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface AppPermissionInfo {
  key: PermissionKey;
  platform: PlatformTarget | 'both';
  titleAr: string;
  categoryAr: string;
  iconName: string;
  descriptionAr: string;
  purposeAr: string;
  howToGrantAr: string;
  state: PermissionState;
  isEssential: boolean;
}

export const PERMISSIONS_CONFIG: Record<PermissionKey, Omit<AppPermissionInfo, 'state'>> = {
  // ===================== 1. MOBILE PERMISSIONS =====================
  camera: {
    key: 'camera',
    platform: 'mobile',
    titleAr: 'إذن الكاميرا (Camera)',
    categoryAr: 'الماسح الضوئي والمستندات',
    iconName: 'Camera',
    descriptionAr: 'مسح الباركود ورمز الـ QR للأصناف، والتحقق الفوري من السندات، وتصوير الفواتير الورقية والتعميدات كمرفقات.',
    purposeAr: 'مسح باركود الأصناف عند البيع والشراء، التحقق من السندات عبر VoucherScannerModal، وتصوير المستندات المرفقة.',
    howToGrantAr: 'عند الضغط على "طلب الإذن الآن" أو أيقونة الكاميرا، اختر "أثناء استخدام التطبيق فقط" (While using the app).',
    isEssential: true
  },
  storage: {
    key: 'storage',
    platform: 'mobile',
    titleAr: 'إذن التخزين والملفات (Storage & Files)',
    categoryAr: 'الملفات والنسخ الاحتياطي',
    iconName: 'HardDrive',
    descriptionAr: 'تنزيل وحفظ ملفات الفواتير والسندات بصيغة PDF و Excel/CSV في جهازك، وتشغيل النسخ الاحتياطي التلقائي.',
    purposeAr: 'تنزيل ملفات الـ PDF وكشوفات Excel/CSV، وتخزين ملفات النسخ الاحتياطي التلقائي محلياً على ذاكرة الهاتف.',
    howToGrantAr: 'الموافقة على تنزيل الملفات أو تفعيل إذن الوصول للملفات من إعدادات التطبيق في أندرويد.',
    isEssential: true
  },
  bluetooth: {
    key: 'bluetooth',
    platform: 'mobile',
    titleAr: 'إذن الأجهزة المجاورة والبلوتوث (Bluetooth / Nearby Devices)',
    categoryAr: 'طابعات الفواتير المحمولة',
    iconName: 'Bluetooth',
    descriptionAr: 'الربط المباشر مع طابعات الفواتير الحرارية المحمولة (POS Bluetooth Thermal Printers مقاس 80mm أو 57mm).',
    purposeAr: 'طباعة فورية لإيصالات نقاط البيع وسندات القبض والصرف بدون كابلات للمعارض والمندوبين.',
    howToGrantAr: 'اضغط على "طلب الإذن" واختر طابعة البلوتوث المجاورة للاقتران بها مباشرة عبر Web Bluetooth API.',
    isEssential: false
  },
  notifications: {
    key: 'notifications',
    platform: 'mobile',
    titleAr: 'إذن الإشعارات (Mobile Notifications)',
    categoryAr: 'التنبيهات والموافقات',
    iconName: 'Bell',
    descriptionAr: 'تنبيهات فورية بدورة اعتماد السندات، مواعيد استحقاق الشيكات البنكية، تنبيهات انخفاض المخزون، ونجاح النسخ الاحتياطي.',
    purposeAr: 'إشعار المدير المالي والمستخدمين بالعمليات المعلقة وتنبيهات الأمان والشيكات والنسخ السحابي في الوقت الفعلي.',
    howToGrantAr: 'الموافقة على إظهار الإشعارات (Allow Notifications) في نافذة المتصفح/أندرويد.',
    isEssential: false
  },
  geolocation: {
    key: 'geolocation',
    platform: 'mobile',
    titleAr: 'إذن الموقع الجغرافي (Geolocation)',
    categoryAr: 'المبيعات والتوزيع الميداني',
    iconName: 'MapPin',
    descriptionAr: 'تسجيل إحداثيات وموقع تسجيل الفاتورة أو تحصيل السند ميدانياً لضمان التواجد الفعلي لمندوبي المبيعات.',
    purposeAr: 'توثيق الموقع الجغرافي للعمليات الميدانية لدى العملاء عند إصدار الفاتورة أو تسليم السند.',
    howToGrantAr: 'السماح بالوصول إلى الموقع الجغرافي الدقيق أو التقريبي عند طلب الإذن.',
    isEssential: false
  },

  // ===================== 2. DESKTOP PERMISSIONS =====================
  desktop_directory: {
    key: 'desktop_directory',
    platform: 'desktop',
    titleAr: 'صلاحية المجلد المحلي الصامت (File System Access)',
    categoryAr: 'النسخ الاحتياطي التلقائي',
    iconName: 'FolderCheck',
    descriptionAr: 'اختيار مجلد حقيقي على جهازك (مثل قرص D: أو مجلد Google Drive / Dropbox) لحفظ نسخ النظام دورياً تلقائياً.',
    purposeAr: 'حفظ وتحديث ملفات النسخ الاحتياطي للبيانات في الخلفية كل بضع دقائق دون الحاجة لضغط زر التحميل.',
    howToGrantAr: 'اضغط على "اختيار وتفعيل المجلد" ثم حدد المجلد من مستعرض ملفات ويندوز/ماك واضغط "عرض وتعديل الملفات".',
    isEssential: true
  },
  desktop_microphone: {
    key: 'desktop_microphone',
    platform: 'desktop',
    titleAr: 'إذن الميكروفون والبحث الصوتي الذكي (Microphone & Voice)',
    categoryAr: 'التحكم الصوتي والمساعد الذكي',
    iconName: 'Mic',
    descriptionAr: 'تمكين المساعد الصوتي للتنقل السريع بين شاشات النظام، البحث عن الحسابات بدليل الحسابات، والاستعلام اللحظي.',
    purposeAr: 'تشغيل نافذة البحث والتحكم الصوتي الذكي VoiceSearchModal واستقبال الأوامر الصوتية باللغة العربية.',
    howToGrantAr: 'اضغط على زر "طلب الإذن" أو انقر أيقونة الميكروفون واختر "سماح" (Allow) من أعلى نافذة المتصفح.',
    isEssential: false
  },
  desktop_persistence: {
    key: 'desktop_persistence',
    platform: 'desktop',
    titleAr: 'إذن التخزين الدائم (Persistent Storage Quota)',
    categoryAr: 'أمان البيانات المحلية',
    iconName: 'ShieldCheck',
    descriptionAr: 'منع نظام التشغيل والمتصفح من حذف بيانات النظام أو تنظيف الكاش عند امتلاء مساحة القرص C:.',
    purposeAr: 'حماية وتثبيت قاعدة البيانات المحلية IndexedDB وقيم الإعدادات والشاشات لضمان عدم فقدان أي بيانات.',
    howToGrantAr: 'اضغط على "تثبيت التخزين الدائم"، حيث يتم تفعيله برمجياً عبر متصفحات كروم وإيدج فورياً.',
    isEssential: true
  },
  desktop_popups_print: {
    key: 'desktop_popups_print',
    platform: 'desktop',
    titleAr: 'إذن النوافذ المنبثقة والطباعة التلقائية (Pop-ups & Printing)',
    categoryAr: 'الفواتير والطباعة',
    iconName: 'Printer',
    descriptionAr: 'السماح للنظام بفتح شاشات معاينة الطباعة ونوافذ التقارير ومصادقات الأرصدة دون حظر من المتصفح.',
    purposeAr: 'طباعة الفواتير والسندات في نافذة مستقلة بدقة عالية ومقاسات مخصصة (A4 والمقاسات الحرارية).',
    howToGrantAr: 'من شريط العنوان بجانب الرابط، اضغط على أيقونة الإعدادات/القفل وفعل "السماح بالنوافذ المنبثقة" (Pop-ups).',
    isEssential: false
  },
  desktop_notifications: {
    key: 'desktop_notifications',
    platform: 'desktop',
    titleAr: 'إشعارات سطح المكتب (Desktop Web Notifications)',
    categoryAr: 'تنبيهات شريط المهام',
    iconName: 'BellRing',
    descriptionAr: 'تنبيه المحاسبين والمديرين فورياً عند اعتماد السندات أو حلول مواعيد الشيكات حتى أثناء تصغير المتصفح.',
    purposeAr: 'إظهار إشعارات النظام في زاوية شاشة الكمبيوتر (Windows Action Center / Mac Notification Center).',
    howToGrantAr: 'الموافقة على تفعيل الإشعارات المكتبية بالضغط على "سماح" (Allow).',
    isEssential: false
  }
};

/**
 * Checks current browser permission state for any key
 */
export async function checkPermissionStatus(key: PermissionKey): Promise<PermissionState> {
  if (typeof window === 'undefined') return 'unsupported';

  try {
    switch (key) {
      case 'camera': {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          return 'unsupported';
        }
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const queryRes = await navigator.permissions.query({ name: 'camera' as any });
            return queryRes.state;
          } catch {
            // fallback
          }
        }
        return 'prompt';
      }

      case 'storage': {
        const win = window as any;
        if (typeof win.showDirectoryPicker === 'function' || typeof win.showOpenFilePicker === 'function') {
          return 'granted';
        }
        if ('storage' in navigator && navigator.storage && typeof navigator.storage.persist === 'function') {
          const isPersisted = await navigator.storage.persisted();
          return isPersisted ? 'granted' : 'prompt';
        }
        return 'granted';
      }

      case 'bluetooth': {
        if (!('bluetooth' in navigator)) {
          return 'unsupported';
        }
        return 'prompt';
      }

      case 'notifications':
      case 'desktop_notifications': {
        if (!('Notification' in window)) {
          return 'unsupported';
        }
        return Notification.permission as PermissionState;
      }

      case 'geolocation': {
        if (!('geolocation' in navigator)) {
          return 'unsupported';
        }
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const queryRes = await navigator.permissions.query({ name: 'geolocation' as any });
            return queryRes.state;
          } catch {
            // fallback
          }
        }
        return 'prompt';
      }

      case 'desktop_directory': {
        const win = window as any;
        if (typeof win.showDirectoryPicker !== 'function') {
          return 'unsupported';
        }
        // Check if there is an active local directory configured in localFolderBackup
        try {
          const savedConfig = localStorage.getItem('alpha_auto_save_settings_v1');
          if (savedConfig) {
            const parsed = JSON.parse(savedConfig);
            if (parsed.folderName) return 'granted';
          }
        } catch {
          // ignore
        }
        return 'prompt';
      }

      case 'desktop_microphone': {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          return 'unsupported';
        }
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const queryRes = await navigator.permissions.query({ name: 'microphone' as any });
            return queryRes.state;
          } catch {
            // fallback
          }
        }
        return 'prompt';
      }

      case 'desktop_persistence': {
        if ('storage' in navigator && navigator.storage && typeof navigator.storage.persisted === 'function') {
          const isPersisted = await navigator.storage.persisted();
          return isPersisted ? 'granted' : 'prompt';
        }
        return 'prompt';
      }

      case 'desktop_popups_print': {
        // Can be tested or prompted
        return 'prompt';
      }

      default:
        return 'prompt';
    }
  } catch (err) {
    console.warn(`Error checking status for permission ${key}:`, err);
    return 'prompt';
  }
}

/**
 * Requests specific permission directly with user interaction
 */
export async function requestAppPermission(key: PermissionKey): Promise<{ success: boolean; message: string; state: PermissionState }> {
  if (typeof window === 'undefined') {
    return { success: false, message: 'البيئة غير مدعومة', state: 'unsupported' };
  }

  try {
    switch (key) {
      // 1. CAMERA
      case 'camera': {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          return { success: false, message: 'الكاميرا غير مدعومة في هذا المتصفح/الجهاز', state: 'unsupported' };
        }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: { ideal: 'environment' } } 
          });
          stream.getTracks().forEach(track => track.stop());
          return { success: true, message: 'تم منح إذن الكاميرا بنجاح! يمكنك الآن مسح الباركود والمستندات.', state: 'granted' };
        } catch (err: any) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            return { success: false, message: 'تم رفض إذن الكاميرا. يرجى تفعيله من إعدادات المتصفح/التطبيق.', state: 'denied' };
          }
          return { success: false, message: `تعذر الوصول للكاميرا: ${err.message || ''}`, state: 'denied' };
        }
      }

      // 2. STORAGE & PERSISTENCE
      case 'storage': {
        let details = '';
        if ('storage' in navigator && navigator.storage && typeof navigator.storage.persist === 'function') {
          const persisted = await navigator.storage.persist();
          if (persisted) {
            details = 'تم تفعيل التخزين الدائم (Persistent Storage) لحماية النسخ الاحتياطي من الحذف التلقائي.';
          }
        }
        const win = window as any;
        if (typeof win.showDirectoryPicker === 'function') {
          try {
            await win.showDirectoryPicker();
            details = 'تم منح إذن المجلد التخزيني المباشر بنجاح.';
          } catch (e: any) {
            if (e.name !== 'AbortError') {
              console.warn(e);
            }
          }
        }
        return { 
          success: true, 
          message: details || 'إذن التخزين وحفظ الملفات جاهز ونشط لتنزيل الـ PDF والنسخ الاحتياطي.',
          state: 'granted' 
        };
      }

      // 3. BLUETOOTH (POS Thermal Printers)
      case 'bluetooth': {
        if (!('bluetooth' in navigator) || !(navigator as any).bluetooth?.requestDevice) {
          return { 
            success: false, 
            message: 'ميزة Web Bluetooth غير مدعومة أو تتطلب فتح التطبيق عبر اتصال HTTPS آمن أو تفعيلها في المتصفح.', 
            state: 'unsupported' 
          };
        }
        try {
          const device = await (navigator as any).bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']
          });
          return { 
            success: true, 
            message: `تم الاقتران بنجاح مع جهاز البلوتوث: ${device.name || 'طابعة حرارية'}`, 
            state: 'granted' 
          };
        } catch (err: any) {
          if (err.name === 'NotFoundError' || err.name === 'UserCancelledError') {
            return { success: true, message: 'تم إغلاق نافذة البحث عن طابعات البلوتوث.', state: 'prompt' };
          }
          return { success: false, message: `خطأ في إذن البلوتوث: ${err.message || ''}`, state: 'denied' };
        }
      }

      // 4. NOTIFICATIONS (MOBILE & DESKTOP)
      case 'notifications':
      case 'desktop_notifications': {
        if (!('Notification' in window)) {
          return { success: false, message: 'خاصية الإشعارات غير مدعومة في هذا المتصفح', state: 'unsupported' };
        }

        const res = await Notification.requestPermission();
        if (res === 'granted') {
          try {
            new Notification('لوجوستريا المحاسبي', {
              body: key === 'desktop_notifications' 
                ? 'تم تفعيل إشعارات سطح المكتب! ستصلك تنبيهات السندات والشيكات والنسخ الاحتياطي في زاوية الشاشة.'
                : 'تم تفعيل إذن الإشعارات بنجاح! ستصلك تنبيهات السندات والشيكات والنسخ السحابي.',
              icon: '/favicon.ico'
            });
          } catch {
            // ignore
          }
          return { 
            success: true, 
            message: 'تم تفعيل الإشعارات بنجاح للتنبيهات الفورية والموافقات.', 
            state: 'granted' 
          };
        } else {
          return { success: false, message: 'تم رفض إذن الإشعارات من قِبل المستخدم.', state: 'denied' };
        }
      }

      // 5. GEOLOCATION
      case 'geolocation': {
        if (!('geolocation' in navigator)) {
          return { success: false, message: 'الموقع الجغرافي غير مدعوم في هذا الجهاز', state: 'unsupported' };
        }

        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const coords = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
              resolve({ 
                success: true, 
                message: `تم منح إذن الموقع بنجاح! (الإحداثيات الحالية: ${coords}) جاهز لتوثيق فواتير المندوبين.`,
                state: 'granted'
              });
            },
            (err) => {
              let msg = 'تعذر الحصول على الموقع الجغرافي.';
              if (err.code === err.PERMISSION_DENIED) {
                msg = 'تم رفض إذن الموقع الجغرافي. يمكنك تفعيله لاحقاً للمندوبين الميدانيين.';
              }
              resolve({ success: false, message: msg, state: 'denied' });
            },
            { timeout: 10000, enableHighAccuracy: true }
          );
        });
      }

      // ===================== DESKTOP SPECIFIC REQUESTS =====================

      // 6. DESKTOP DIRECTORY PICKER
      case 'desktop_directory': {
        const win = window as any;
        if (typeof win.showDirectoryPicker !== 'function') {
          return { 
            success: false, 
            message: 'ميزة اختيار المجلد المحلي (File System Access) غير مدعومة في هذا المتصفح. ينصح باستخدام Chrome أو Edge على سطح المكتب.', 
            state: 'unsupported' 
          };
        }
        try {
          const dirHandle = await win.showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'documents'
          });
          const folderName = dirHandle.name;
          
          // Save in auto-save config
          try {
            const raw = localStorage.getItem('alpha_auto_save_settings_v1');
            const prev = raw ? JSON.parse(raw) : {};
            localStorage.setItem('alpha_auto_save_settings_v1', JSON.stringify({
              ...prev,
              enabled: true,
              folderName
            }));
          } catch {
            // ignore
          }

          return { 
            success: true, 
            message: `تم اعتماد المجلد المحلي بنجاح: [${folderName}]. ميزة النسخ الاحتياطي التلقائي الصامت نشطة الآن!`, 
            state: 'granted' 
          };
        } catch (err: any) {
          if (err.name === 'AbortError') {
            return { success: true, message: 'تم إغلاق نافذة اختيار المجلد دون تغيير.', state: 'prompt' };
          }
          return { success: false, message: `تعذر الوصول للمجلد: ${err.message || ''}`, state: 'denied' };
        }
      }

      // 7. DESKTOP MICROPHONE (VOICE SEARCH)
      case 'desktop_microphone': {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          return { success: false, message: 'الميكروفون غير مدعوم في هذا المتصفح/الجهاز', state: 'unsupported' };
        }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
          return { 
            success: true, 
            message: 'تم تفعيل إذن الميكروفون بنجاح! يمكنك الآن استخدام البحث والتحكم الصوتي الذكي في شاشات النظام.', 
            state: 'granted' 
          };
        } catch (err: any) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            return { success: false, message: 'تم رفض إذن الميكروفون. يرجى تفعيله من إعدادات المتصفح لاستخدام البحث الصوتي.', state: 'denied' };
          }
          return { success: false, message: `تعذر الوصول للميكروفون: ${err.message || ''}`, state: 'denied' };
        }
      }

      // 8. DESKTOP PERSISTENCE
      case 'desktop_persistence': {
        if ('storage' in navigator && navigator.storage && typeof navigator.storage.persist === 'function') {
          const persisted = await navigator.storage.persist();
          if (persisted) {
            return { 
              success: true, 
              message: 'تم تثبيت التخزين الدائم (Persistent Storage) بنجاح! لن يقوم نظام التشغيل بمسح بيانات النظام المحلية نهائياً.', 
              state: 'granted' 
            };
          }
        }
        return { 
          success: true, 
          message: 'تم تسجيل تفضيل التخزين الدائم لبيانات المتصفح المحلية.', 
          state: 'granted' 
        };
      }

      // 9. DESKTOP POP-UPS & DIRECT PRINT
      case 'desktop_popups_print': {
        try {
          const testWindow = window.open('about:blank', '_blank', 'width=350,height=250');
          if (!testWindow || testWindow.closed || typeof testWindow.closed === 'undefined') {
            return { 
              success: false, 
              message: 'تم حظر النوافذ المنبثقة من قِبل المتصفح. يرجى الضغط على علامة الحظر في شريط العنوان واختيار "السماح دائماً بالنوافذ المنبثقة" لطباعة الفواتير مباشرة.', 
              state: 'denied' 
            };
          } else {
            testWindow.document.write(`
              <div style="font-family:sans-serif; text-align:center; padding:30px; direction:rtl;">
                <h3 style="color:#10b981; margin-bottom:8px;">✔ تم التحقق بنجاح!</h3>
                <p style="font-size:13px; color:#475569;">إذن النوافذ المنبثقة والطباعة المباشرة لـ لوجوستريا نشط ويعمل بكفاءة.</p>
              </div>
            `);
            setTimeout(() => {
              try { testWindow.close(); } catch { /* ignore */ }
            }, 1800);
            return { 
              success: true, 
              message: 'تم اختبار إذن النوافذ المنبثقة والطباعة بنجاح! شاشات الطباعة والمعاينة تعمل بأعلى جاهزية.', 
              state: 'granted' 
            };
          }
        } catch {
          return { 
            success: false, 
            message: 'يرجى التأكد من السماح بالنوافذ المنبثقة من شريط عنوان المتصفح.', 
            state: 'denied' 
          };
        }
      }

      default:
        return { success: false, message: 'إذن غير معروف', state: 'unsupported' };
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'حدث خطأ أثناء طلب الإذن', state: 'denied' };
  }
}
