/**
 * Universal File Saver & Mobile/PWA/Android APK Share Engine
 * 
 * Solves mobile & Android APK download issues:
 * 1. Android WebViews/APKs block silent `<a download>` on blob: URLs without custom native download listeners.
 * 2. Asynchronous operations cause user gesture expiration on mobile browsers.
 * 3. Utilizes the native Web Share API (navigator.share with File) on Mobile/PWA/Android,
 *    allowing direct saving to "Files" (حفظ في الملفات), Google Drive, WhatsApp, Books, or Native PDF viewers.
 * 4. Supports Capacitor Filesystem & Share plugins if running in native APK environment.
 */

export interface SaveResult {
  success: boolean;
  method: 'share' | 'download' | 'open' | 'capacitor' | 'action_sheet';
  cancelled?: boolean;
  error?: string;
  blob?: Blob;
  filename?: string;
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isTouch = navigator.maxTouchPoints > 1;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isIPadOS = navigator.platform === 'MacIntel' && isTouch;
  return isMobileUA || isIPadOS;
}

export function isAndroidDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  );
}

export function isAndroidApkOrWebView(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isWebView = /wv|Version\/[\d.]+/i.test(ua) || (window as any).Capacitor !== undefined || (window as any).cordova !== undefined;
  return isAndroid && (isWebView || isStandalonePwa());
}

export function canWebShareFiles(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
}

/**
 * Convert Blob to Base64 String
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(base64 || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Direct synchronous share trigger for mobile button clicks (preserves active user gesture)
 */
export async function shareBlobDirectly(
  blob: Blob,
  filename: string,
  mimeType = 'application/pdf'
): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;

  // 1. Try Capacitor Native Share if in APK
  try {
    const cap = (window as any).Capacitor;
    if (cap?.Plugins?.Filesystem && cap?.Plugins?.Share) {
      const base64Data = await blobToBase64(blob);
      const writeRes = await cap.Plugins.Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: 'CACHE',
        recursive: true
      });
      await cap.Plugins.Share.share({
        title: filename,
        url: writeRes.uri
      });
      return true;
    }
  } catch (err) {
    console.warn('Capacitor direct share error:', err);
  }

  // 2. Try Web Share API
  if (canWebShareFiles()) {
    try {
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
          text: `مستند مالي معتمد: ${filename}`
        });
        return true;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return true; // user closed sheet
      console.warn('Web Share direct error:', err);
    }
  }

  return false;
}

/**
 * Saves a Blob with maximum cross-platform compatibility
 */
export async function saveOrShareBlob(
  blob: Blob,
  filename: string,
  mimeType?: string
): Promise<SaveResult> {
  const type = mimeType || blob.type || 'application/octet-stream';
  const mobile = isMobileDevice();
  const isApk = isAndroidApkOrWebView();

  // 1. Try Capacitor Native Filesystem Write if running in Capacitor APK
  try {
    const cap = (window as any).Capacitor;
    if (cap?.Plugins?.Filesystem) {
      const base64Data = await blobToBase64(blob);
      const writeResult = await cap.Plugins.Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: 'DOCUMENTS',
        recursive: true
      });
      
      // If Share plugin exists, invoke it
      if (cap.Plugins?.Share) {
        try {
          await cap.Plugins.Share.share({
            title: filename,
            url: writeResult.uri
          });
        } catch {}
      }

      return { success: true, method: 'capacitor' };
    }
  } catch (capErr) {
    console.warn('Capacitor Filesystem error, falling back:', capErr);
  }

  // 2. Mobile & PWA: Attempt Native Web Share Sheet
  if (mobile && canWebShareFiles()) {
    try {
      const file = new File([blob], filename, { type });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
        });
        return { success: true, method: 'share' };
      }
    } catch (shareErr: any) {
      if (shareErr?.name === 'AbortError') {
        return { success: true, method: 'share', cancelled: true };
      }
      console.warn('Web Share failed or gesture expired:', shareErr);
    }
  }

  // 3. Desktop / Standard Browser Download
  try {
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = filename;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

    // If on Android APK/WebView, standard anchor might be ignored by OS, so return metadata
    return { 
      success: true, 
      method: isApk ? 'action_sheet' : 'download',
      blob,
      filename
    };
  } catch (downloadErr: any) {
    console.error('Standard download anchor failed:', downloadErr);
    return {
      success: false,
      method: 'download',
      error: downloadErr?.message || 'Failed to download file',
      blob,
      filename
    };
  }
}
