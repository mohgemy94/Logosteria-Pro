/**
 * Universal File Saver & Mobile/PWA/Android APK Share Engine
 * 
 * Specifically engineered for Android WebViews & Capacitor Native APKs:
 * 1. Android APK Native: Directly writes file via Capacitor Filesystem plugin
 *    and launches Android's native Share Sheet (Save to Downloads, Drive, WhatsApp, etc.).
 * 2. Mobile / PWA: Uses Web Share API (navigator.share with File).
 * 3. Desktop: Uses clean standard `<a download>` trigger.
 */

import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

export interface SaveResult {
  success: boolean;
  method: 'share' | 'download' | 'open' | 'capacitor' | 'action_sheet';
  cancelled?: boolean;
  error?: string;
  blob?: Blob;
  filename?: string;
}

export function isCapacitorNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
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
  if (isCapacitorNative()) return true;
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
 * Convert Blob to Base64 String (clean, without data URL prefix)
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
 * Check and request Filesystem permissions if needed
 */
async function ensureFilesystemPermission(): Promise<void> {
  try {
    const status = await Filesystem.checkPermissions();
    if (status.publicStorage === 'prompt' || status.publicStorage === 'prompt-with-rationale') {
      await Filesystem.requestPermissions();
    }
  } catch {
    // ignore
  }
}

/**
 * Direct share trigger for mobile button clicks
 */
export async function shareBlobDirectly(
  blob: Blob,
  filename: string,
  mimeType = 'application/pdf'
): Promise<boolean> {
  // 1. Capacitor Native Plugins (Android / iOS APK)
  if (isCapacitorNative()) {
    try {
      await ensureFilesystemPermission();
      const base64Data = await blobToBase64(blob);

      // Write to Cache directory (accessible by FileProvider for sharing)
      const cacheFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true
      });

      // Also write to Documents directory so it's permanently stored on the device
      try {
        await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });
      } catch (docErr) {
        console.warn('Could not write to Documents directory:', docErr);
      }

      await Share.share({
        title: filename,
        text: `مستند مالي معتمد: ${filename}`,
        url: cacheFile.uri,
        dialogTitle: 'حفظ أو مشاركة ملف PDF'
      });
      return true;
    } catch (err: any) {
      if (err?.message?.includes('canceled') || err?.name === 'AbortError') {
        return true;
      }
      console.warn('Capacitor share error:', err);
    }
  }

  // 2. Web Share API on mobile browsers / PWAs
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
      if (err?.name === 'AbortError') return true;
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

  // 1. Capacitor Native APK Environment
  if (isCapacitorNative()) {
    try {
      await ensureFilesystemPermission();
      const base64Data = await blobToBase64(blob);

      // Write to Cache directory (allows immediate native sharing)
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true
      });

      // Write copy to Documents directory for permanent local storage
      try {
        await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });
      } catch (e) {
        console.warn('Could not write to Documents directory:', e);
      }

      // Automatically launch Android native Share / Save sheet
      try {
        await Share.share({
          title: filename,
          text: `مستند مالي معتمد: ${filename}`,
          url: writeResult.uri,
          dialogTitle: 'حفظ أو مشاركة ملف PDF'
        });
        return { success: true, method: 'capacitor', blob, filename };
      } catch (shareErr: any) {
        if (shareErr?.message?.includes('canceled') || shareErr?.name === 'AbortError') {
          return { success: true, method: 'capacitor', cancelled: true, blob, filename };
        }
        return { success: true, method: 'capacitor', blob, filename };
      }
    } catch (capErr) {
      console.warn('Capacitor native save failed, falling back:', capErr);
    }
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
        return { success: true, method: 'share', blob, filename };
      }
    } catch (shareErr: any) {
      if (shareErr?.name === 'AbortError') {
        return { success: true, method: 'share', cancelled: true, blob, filename };
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
