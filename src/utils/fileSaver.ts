/**
 * Universal File Saver & Mobile/PWA Share Engine
 * 
 * Solves mobile & PWA download issues:
 * 1. WebKit/iOS standalone PWAs ignore `<a download>` on blob: URLs.
 * 2. Asynchronous operations (like html2canvas/jsPDF rendering) cause user gesture expiration on mobile browsers.
 * 3. Instant `URL.revokeObjectURL()` aborts mobile download streams before they finish saving.
 * 4. Utilizes the native Web Share API (navigator.share with File) on Mobile/PWA, allowing direct
 *    saving to "Files" (حفظ في الملفات), Google Drive, WhatsApp, Books, or Native PDF viewers.
 */

export interface SaveResult {
  success: boolean;
  method: 'share' | 'download' | 'open';
  cancelled?: boolean;
  error?: string;
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isTouch = navigator.maxTouchPoints > 1;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isIPadOS = navigator.platform === 'MacIntel' && isTouch;
  return isMobileUA || isIPadOS;
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  );
}

export function canWebShareFiles(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
}

/**
 * Saves a Blob by either opening the native mobile share sheet, opening in a safe viewer tab (PWA),
 * or triggering standard desktop download.
 */
export async function saveOrShareBlob(
  blob: Blob,
  filename: string,
  mimeType?: string
): Promise<SaveResult> {
  const type = mimeType || blob.type || 'application/octet-stream';
  const mobile = isMobileDevice();
  const standalone = isStandalonePwa();

  // 1. Mobile & PWA: Prefer Native Web Share Sheet
  // This allows saving directly into device files (Files app on iOS / Downloads on Android),
  // or sending to WhatsApp, Google Drive, or PDF viewer apps.
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
      // User tapped cancel on the share sheet - not an error
      if (shareErr?.name === 'AbortError') {
        return { success: true, method: 'share', cancelled: true };
      }
      console.warn('Web Share failed or unsupported on this specific file, attempting fallbacks:', shareErr);
    }
  }

  // 2. Mobile Standalone PWA Fallback (when share sheet fails or isn't available)
  // In iOS WebKit standalone PWA, <a download> does not trigger downloads.
  // Opening the blob URL or data URL allows user to view and save it.
  if (mobile && standalone) {
    try {
      const blobUrl = URL.createObjectURL(blob);
      const targetWindow = window.open(blobUrl, '_blank');
      if (!targetWindow) {
        // Fallback to hidden link navigation
        const link = document.createElement('a');
        link.href = blobUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      // Retain blob URL in memory for 2 minutes for mobile viewer to stream
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
      return { success: true, method: 'open' };
    } catch (openErr: any) {
      console.warn('PWA standalone open failed:', openErr);
    }
  }

  // 3. Desktop / Standard Browser Download Fallback
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

    // CRITICAL: Do NOT revoke immediately!
    // On iOS Safari and Chrome Mobile, revoking immediately aborts the download stream.
    // Keeping it for 60s gives the OS download manager sufficient time to finish.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    return { success: true, method: 'download' };
  } catch (downloadErr: any) {
    console.error('Standard download anchor failed:', downloadErr);
    return {
      success: false,
      method: 'download',
      error: downloadErr?.message || 'Failed to download file'
    };
  }
}
