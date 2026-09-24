/**
 * Universal Mobile & Android APK Navigation Controller
 * 
 * Specifically engineered for Android WebViews, APKs (Cordova, Capacitor, WebIntoApp, Website2APK),
 * PWAs, and mobile browsers.
 * 
 * Why this fixes Android APK Back Button:
 * Android WebViews only respect hardware back buttons and gestures if the WebBackForwardList 
 * contains distinct URL hash entries (`#viewId`, `#modal=...`). Without hash updates, 
 * `webView.canGoBack()` evaluates to false, causing Android to abruptly terminate the app Activity.
 * 
 * By synchronizing active views and modal layers with URL hashes and intercepting popstate/hashchange,
 * Android OS hardware back buttons & edge-swipe gestures smoothly traverse backwards through screens
 * and close open modals before exiting.
 */

import { App } from '@capacitor/app';

export interface HistoryState {
  view: string | null;
  hasModal?: boolean;
  modalId?: string;
  timestamp?: number;
}

type ModalCloseHandler = () => void;

class MobileNavigationController {
  private modalHandlers: Map<string, ModalCloseHandler> = new Map();
  private historyStack: (string | null)[] = ['companyProfile'];
  private initialized = false;
  private isProcessingPopState = false;
  private onNavigateCallback: ((view: string | null) => void) | null = null;
  private lastBackPressTime = 0;
  private exitToastTimeout: any = null;

  init(onNavigate: (view: string | null) => void, initialView: string | null = 'companyProfile') {
    if (this.initialized) return;
    this.initialized = true;
    this.onNavigateCallback = onNavigate;
    const startView = initialView || 'companyProfile';
    this.historyStack = [startView];

    if (typeof window !== 'undefined') {
      const initialHash = '#' + (startView || 'companyProfile');
      
      // Ensure the initial history entry has proper state and hash
      try {
        if (!window.location.hash || window.location.hash === '#') {
          window.history.replaceState({ view: startView, timestamp: Date.now() }, '', initialHash);
        }
      } catch {
        // ignore
      }

      // 1. Core popstate listener (fires when Android hardware back is pressed in WebView)
      window.addEventListener('popstate', this.handlePopState);

      // 2. Hashchange listener as secondary safety for WebView wrappers
      window.addEventListener('hashchange', this.handleHashChange);

      // 3. Cordova / PhoneGap / Android WebView backbutton event
      if (typeof document !== 'undefined') {
        document.addEventListener('backbutton', this.handleHardwareBackButton as any, false);
      }

      // 4. Capacitor App native backButton plugin
      try {
        App.addListener('backButton', () => {
          this.handleNativeHardwareBack();
        });
      } catch (err) {
        console.warn('Capacitor App listener:', err);
      }

      // 5. Physical Keyboard / Android TV remote / Back keys
      window.addEventListener('keydown', this.handleKeyDown);
    }
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', this.handlePopState);
      window.removeEventListener('hashchange', this.handleHashChange);
      window.removeEventListener('keydown', this.handleKeyDown);
      if (typeof document !== 'undefined') {
        document.removeEventListener('backbutton', this.handleHardwareBackButton as any);
      }
    }
    this.initialized = false;
    this.modalHandlers.clear();
  }

  /**
   * Register a modal or popup with the browser history stack.
   * When Android back is pressed, the modal closes without leaving the current screen.
   */
  registerModal(id: string, onClose: () => void): () => void {
    if (this.modalHandlers.has(id)) {
      this.modalHandlers.set(id, onClose);
      return () => this.unregisterModal(id);
    }

    this.modalHandlers.set(id, onClose);

    if (typeof window !== 'undefined' && window.history && !this.isProcessingPopState) {
      try {
        const currentHash = window.location.hash || '#companyProfile';
        const modalParam = `modal=${encodeURIComponent(id)}`;
        const newHash = currentHash.includes('?') 
          ? `${currentHash}&${modalParam}` 
          : `${currentHash}?${modalParam}`;

        window.history.pushState({
          view: this.getCurrentView(),
          hasModal: true,
          modalId: id,
          timestamp: Date.now()
        }, '', newHash);
      } catch {
        // ignore
      }
    }

    return () => {
      this.unregisterModal(id);
    };
  }

  unregisterModal(id: string) {
    if (this.modalHandlers.has(id)) {
      this.modalHandlers.delete(id);
    }
  }

  /**
   * Called when active view changes. Pushes new state to WebBackForwardList so Android can go back.
   */
  pushView(newView: string | null) {
    if (this.isProcessingPopState) return;

    const current = this.getCurrentView();
    if (current === newView) return;

    this.historyStack.push(newView);

    if (typeof window !== 'undefined' && window.history) {
      try {
        const viewSlug = newView || 'dashboard';
        const targetHash = '#' + viewSlug;
        
        if (window.location.hash !== targetHash) {
          window.history.pushState({
            view: newView,
            timestamp: Date.now()
          }, '', targetHash);
        }
      } catch {
        // ignore
      }
    }
  }

  /**
   * Universal programmatic back trigger
   */
  goBack(): boolean {
    if (typeof window !== 'undefined' && window.history && window.history.length > 1) {
      window.history.back();
      return true;
    }
    return this.handleNativeHardwareBack();
  }

  getCurrentView(): string | null {
    if (this.historyStack.length === 0) return null;
    const top = this.historyStack[this.historyStack.length - 1];
    return top !== undefined ? top : null;
  }

  canGoBack(): boolean {
    if (this.modalHandlers.size > 0) return true;
    if (this.historyStack.length > 1) return true;
    const current = this.getCurrentView();
    return current !== null && current !== 'companyProfile';
  }

  private handleHardwareBackButton = (e: Event) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    this.handleNativeHardwareBack();
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'GoBack' || e.key === 'Back' || e.keyCode === 4) {
      if (this.canGoBack()) {
        e.preventDefault();
        this.goBack();
      }
    }
  };

  private handleHashChange = () => {
    if (this.isProcessingPopState) return;
    this.parseCurrentHashAndSync();
  };

  private handlePopState = (event: PopStateEvent) => {
    this.isProcessingPopState = true;

    try {
      // 1. Check if any modals were open and need closing
      if (this.modalHandlers.size > 0) {
        const entries = Array.from(this.modalHandlers.entries());
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          const [id, handler] = lastEntry;
          this.modalHandlers.delete(id);
          try {
            handler();
          } catch (err) {
            console.error('Error closing modal on back:', err);
          }
          return;
        }
      }

      // 2. Resolve target view from state or URL hash
      let targetView: string | null = null;
      if (event.state && typeof event.state === 'object') {
        const state = event.state as HistoryState;
        if (state.view !== undefined) {
          targetView = state.view;
        }
      }

      if (targetView === null && typeof window !== 'undefined') {
        const hash = window.location.hash.replace(/^#/, '').split('?')[0] || '';
        targetView = hash === 'dashboard' ? null : (hash || 'companyProfile');
      }

      // Update history stack
      if (this.historyStack.length > 1) {
        this.historyStack.pop();
      }

      if (this.onNavigateCallback) {
        this.onNavigateCallback(targetView);
      }
    } finally {
      this.isProcessingPopState = false;
    }
  };

  private parseCurrentHashAndSync() {
    if (typeof window === 'undefined') return;
    const rawHash = window.location.hash.replace(/^#/, '');
    const cleanSlug = rawHash.split('?')[0] || '';
    const targetView = cleanSlug === 'dashboard' ? null : (cleanSlug || 'companyProfile');
    
    if (targetView !== this.getCurrentView() && this.onNavigateCallback) {
      this.onNavigateCallback(targetView);
    }
  }

  /**
   * Native back logic when popstate isn't natively triggered by OS
   */
  handleNativeHardwareBack(): boolean {
    // 1. Close open modal first
    if (this.modalHandlers.size > 0) {
      const entries = Array.from(this.modalHandlers.entries());
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        const [id, handler] = lastEntry;
        this.modalHandlers.delete(id);
        try {
          handler();
        } catch (err) {
          console.error(err);
        }
        return true;
      }
    }

    // 2. Navigate back through stack
    if (this.historyStack.length > 1) {
      this.historyStack.pop();
      const prevView = this.historyStack[this.historyStack.length - 1] ?? 'companyProfile';
      if (this.onNavigateCallback) {
        this.onNavigateCallback(prevView);
      }
      return true;
    }

    // 3. If on subview, return to main overview
    const current = this.getCurrentView();
    if (current !== null && current !== 'companyProfile') {
      this.historyStack = ['companyProfile'];
      if (this.onNavigateCallback) {
        this.onNavigateCallback('companyProfile');
      }
      return true;
    }

    // 4. On root: double tap to exit protection
    return this.handleRootBackExit();
  }

  /**
   * Double-tap back on root to prevent accidental app close in Android APK
   */
  private handleRootBackExit(): boolean {
    const now = Date.now();
    if (now - this.lastBackPressTime < 2000) {
      try {
        App.exitApp();
        return true;
      } catch {
        // ignore
      }
      return false;
    }

    this.lastBackPressTime = now;
    this.showExitToast();
    return true;
  }

  private showExitToast() {
    if (typeof document === 'undefined') return;

    const existing = document.getElementById('logustria-exit-toast');
    if (existing) {
      existing.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'logustria-exit-toast';
    toast.className = 'fixed bottom-16 left-1/2 -translate-x-1/2 z-9999 bg-slate-950/95 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2 pointer-events-none animate-in fade-in zoom-in-95 duration-150';
    toast.dir = 'rtl';
    toast.innerHTML = `
      <span class="text-amber-400 text-sm">📱</span>
      <span>اضغط رجوع مرة أخرى للخروج من التطبيق</span>
    `;

    document.body.appendChild(toast);

    if (this.exitToastTimeout) {
      clearTimeout(this.exitToastTimeout);
    }

    this.exitToastTimeout = setTimeout(() => {
      if (document.body.contains(toast)) {
        toast.remove();
      }
    }, 2000);
  }
}

export const mobileNavigationController = new MobileNavigationController();
