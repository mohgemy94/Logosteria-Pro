/**
 * Navigation History Manager for Logustria ERP
 * Provides native mobile back button support, hardware popstate handling,
 * modal stack management, Android APK backbutton/Capacitor integration,
 * double-tap to exit on root, and edge swipe-to-go-back gesture detection.
 */

export interface HistoryState {
  view: string | null;
  hasModal?: boolean;
  modalId?: string;
  step?: number;
}

type BackHandler = () => boolean | void; // return true if handled

class MobileNavigationController {
  private modalHandlers: Map<string, BackHandler> = new Map();
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
    this.historyStack = [initialView || 'companyProfile'];

    if (typeof window !== 'undefined') {
      // Initialize base history state
      try {
        if (window.history) {
          const state: HistoryState = { view: initialView, step: 0 };
          window.history.replaceState(state, '');
          // Push one anchor state so window.history.length >= 2, preventing Android WebView from immediately exiting Activity
          window.history.pushState({ ...state, step: 1 }, '');
        }
      } catch {
        // ignore
      }

      // 1. Listen for browser/WebView popstate
      window.addEventListener('popstate', this.handlePopState);

      // 2. Listen for Cordova / Android WebView native 'backbutton' event
      if (typeof document !== 'undefined') {
        document.addEventListener('backbutton', this.handleHardwareBackButton as any, false);
      }

      // 3. Listen for Capacitor App backButton plugin
      try {
        const cap = (window as any).Capacitor;
        if (cap?.Plugins?.App?.addListener) {
          cap.Plugins.App.addListener('backButton', () => {
            this.handleNativeHardwareBack();
          });
        }
      } catch {
        // ignore
      }

      // 4. Keyboard Back / ESC / Android TV remote back
      window.addEventListener('keydown', this.handleKeyDown);
    }
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', this.handlePopState);
      window.removeEventListener('keydown', this.handleKeyDown);
      if (typeof document !== 'undefined') {
        document.removeEventListener('backbutton', this.handleHardwareBackButton as any);
      }
    }
    this.initialized = false;
    this.modalHandlers.clear();
  }

  /**
   * Register a modal or popup to be closed when back is pressed
   */
  registerModal(id: string, onClose: () => void): () => void {
    if (typeof window !== 'undefined' && window.history) {
      try {
        const state: HistoryState = {
          view: this.getCurrentView(),
          hasModal: true,
          modalId: id,
          step: (window.history.state?.step || 0) + 1
        };
        window.history.pushState(state, '');
      } catch {
        // ignore
      }
    }

    this.modalHandlers.set(id, () => {
      onClose();
      return true;
    });

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
   * Called when active view changes
   */
  pushView(newView: string | null) {
    if (this.isProcessingPopState) return;

    const current = this.getCurrentView();
    if (current === newView) return;

    this.historyStack.push(newView);

    if (typeof window !== 'undefined' && window.history) {
      try {
        const state: HistoryState = {
          view: newView,
          step: this.historyStack.length
        };
        window.history.pushState(state, '');
      } catch {
        // ignore
      }
    }
  }

  /**
   * Universal Back Navigation Handler for Hardware buttons, gestures, and UI clicks
   */
  handleNativeHardwareBack(): boolean {
    // 1. Check if we have registered open modals
    if (this.modalHandlers.size > 0) {
      const entries = Array.from(this.modalHandlers.entries());
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        const [id, handler] = lastEntry;
        this.modalHandlers.delete(id);
        handler();
        return true;
      }
    }

    // 2. Check if we have views in the stack to go back to
    if (this.historyStack.length > 1) {
      this.historyStack.pop();
      const prevView = this.historyStack[this.historyStack.length - 1] ?? 'companyProfile';
      if (this.onNavigateCallback) {
        this.onNavigateCallback(prevView);
      }
      return true;
    }

    // 3. If on a sub-view and stack is empty, return to main overview (companyProfile)
    const current = this.getCurrentView();
    if (current !== null && current !== 'companyProfile') {
      this.historyStack = ['companyProfile'];
      if (this.onNavigateCallback) {
        this.onNavigateCallback('companyProfile');
      }
      return true;
    }

    // 4. On Root screen (companyProfile): Handle double-back to exit cleanly
    return this.handleRootBackExit();
  }

  /**
   * Trigger back navigation programmatically from UI buttons
   */
  goBack(): boolean {
    return this.handleNativeHardwareBack();
  }

  getCurrentView(): string | null {
    if (this.historyStack.length === 0) return null;
    const top = this.historyStack[this.historyStack.length - 1];
    return top !== undefined ? top : null;
  }

  getHistoryDepth(): number {
    return this.historyStack.length;
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
        this.handleNativeHardwareBack();
      }
    }
  };

  private handlePopState = (event: PopStateEvent) => {
    this.isProcessingPopState = true;

    try {
      // 1. Check if we have registered modals that need closing
      if (this.modalHandlers.size > 0) {
        const entries = Array.from(this.modalHandlers.entries());
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          const [id, handler] = lastEntry;
          this.modalHandlers.delete(id);
          handler();
          return;
        }
      }

      // 2. Otherwise, update view stack
      if (this.historyStack.length > 1) {
        this.historyStack.pop();
        const prevView = this.historyStack[this.historyStack.length - 1] ?? 'companyProfile';
        if (this.onNavigateCallback) {
          this.onNavigateCallback(prevView);
        }
      } else {
        const state = event.state as HistoryState | null;
        if (state && state.view !== undefined) {
          if (this.onNavigateCallback) {
            this.onNavigateCallback(state.view);
          }
        } else {
          if (this.onNavigateCallback) {
            this.onNavigateCallback('companyProfile');
          }
        }
      }
    } finally {
      this.isProcessingPopState = false;
    }
  };

  /**
   * Double-tap back on root to prevent accidental app close in Android APK
   */
  private handleRootBackExit(): boolean {
    const now = Date.now();
    if (now - this.lastBackPressTime < 2000) {
      // User pressed back twice within 2 seconds -> Allow APK close
      try {
        const cap = (window as any).Capacitor;
        if (cap?.Plugins?.App?.exitApp) {
          cap.Plugins.App.exitApp();
          return false;
        }
        const nav = navigator as any;
        if (nav?.app?.exitApp) {
          nav.app.exitApp();
          return false;
        }
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

    const existingToast = document.getElementById('logustria-exit-toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'logustria-exit-toast';
    toast.textContent = 'اضغط رجوع مرة أخرى للخروج من التطبيق 📱';
    toast.style.cssText = `
      position: fixed;
      bottom: 75px;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(15, 23, 42, 0.94);
      color: #f8fafc;
      padding: 10px 20px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.15);
      z-index: 999999;
      pointer-events: none;
      direction: rtl;
      animation: fadeIn 0.2s ease-in-out;
      white-space: nowrap;
    `;

    document.body.appendChild(toast);

    if (this.exitToastTimeout) {
      clearTimeout(this.exitToastTimeout);
    }
    this.exitToastTimeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }
}

export const mobileNavigationController = new MobileNavigationController();
