/**
 * Universal Mobile & Android APK Navigation Controller
 * 
 * Specifically engineered for Capacitor Android APKs, WebViews, PWAs, and Mobile Browsers.
 * 
 * Guarantees STRICT SEQUENTIAL (step-by-step) back navigation:
 * 1. Closes open dialogs/modals first without leaving the current screen.
 * 2. Navigates back strictly one step at a time through the navigation stack (Screen C -> Screen B -> Screen A).
 * 3. Incorporates a 350ms debounce guard to prevent double-firing when Capacitor's native
 *    `App.addListener('backButton')` and Android WebView's `popstate` trigger simultaneously.
 * 4. At the root screen ('companyProfile' or initial screen), requires double-tap within 2s to exit safely.
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
  // Navigation stack: preserves exact sequence of user-visited screens
  private historyStack: (string | null)[] = ['companyProfile'];
  private initialized = false;
  private isPerformingBack = false;
  private lastBackEventTime = 0;
  private onNavigateCallback: ((view: string | null) => void) | null = null;
  private lastExitPressTime = 0;
  private exitToastTimeout: any = null;

  init(onNavigate: (view: string | null) => void, initialView: string | null = 'companyProfile') {
    if (this.initialized) {
      this.onNavigateCallback = onNavigate;
      return;
    }
    this.initialized = true;
    this.onNavigateCallback = onNavigate;
    const startView = initialView || 'companyProfile';
    this.historyStack = [startView];

    if (typeof window !== 'undefined') {
      const initialSlug = startView || 'companyProfile';
      const initialHash = '#' + initialSlug;

      try {
        if (!window.location.hash || window.location.hash === '#' || window.location.hash === '') {
          window.history.replaceState({ view: startView, timestamp: Date.now() }, '', initialHash);
        }
      } catch {
        // ignore
      }

      // 1. Capacitor Native backButton listener (primary source for Android APK)
      try {
        App.addListener('backButton', () => {
          this.executeStepBack();
        });
      } catch (err) {
        console.warn('Capacitor App listener initialization:', err);
      }

      // 2. Cordova / WebView backbutton event fallback
      if (typeof document !== 'undefined') {
        document.addEventListener('backbutton', (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          this.executeStepBack();
        }, false);
      }

      // 3. Browser popstate fallback (for Mobile Web / PWAs)
      window.addEventListener('popstate', (e: PopStateEvent) => {
        // Only handle if not already handled by native backButton in this cycle
        const now = Date.now();
        if (now - this.lastBackEventTime < 350) {
          return;
        }
        this.executeStepBack();
      });

      // 4. Physical Keyboard / Android TV remote (Escape, Back key code 4)
      window.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape' || e.key === 'GoBack' || e.key === 'Back' || e.keyCode === 4) {
          if (this.canGoBack()) {
            e.preventDefault();
            this.executeStepBack();
          }
        }
      });
    }
  }

  destroy() {
    this.initialized = false;
    this.modalHandlers.clear();
  }

  /**
   * Register a modal or popup with the navigation controller.
   * When back button is pressed, only the modal closes — the screen stays intact.
   */
  registerModal(id: string, onClose: () => void): () => void {
    this.modalHandlers.set(id, onClose);
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
   * Push a new screen onto the sequential history stack.
   * Automatically deduplicates consecutive identical views.
   */
  pushView(newView: string | null) {
    if (this.isPerformingBack) return;

    const current = this.getCurrentView();
    // Do not add if already on this view
    if (current === newView) return;

    // Push new view to the sequential stack
    this.historyStack.push(newView);

    // Sync browser URL hash smoothly
    if (typeof window !== 'undefined' && window.history) {
      try {
        const slug = newView || 'dashboard';
        const targetHash = '#' + slug;
        if (window.location.hash !== targetHash) {
          window.history.pushState({
            view: newView,
            index: this.historyStack.length - 1,
            timestamp: Date.now()
          }, '', targetHash);
        }
      } catch {
        // ignore
      }
    }
  }

  /**
   * Programmatic back trigger (e.g. from UI back button)
   */
  goBack(): boolean {
    return this.executeStepBack();
  }

  getCurrentView(): string | null {
    if (this.historyStack.length === 0) return null;
    return this.historyStack[this.historyStack.length - 1] ?? null;
  }

  canGoBack(): boolean {
    if (this.modalHandlers.size > 0) return true;
    if (this.historyStack.length > 1) return true;
    const current = this.getCurrentView();
    return current !== null && current !== 'companyProfile';
  }

  /**
   * Single Source of Truth for Step-by-Step Back Navigation.
   * Strictly processes ONE navigation level per press:
   * Level 1: Open modal -> Closes modal only.
   * Level 2: Stack depth > 1 -> Steps back to previous screen (e.g. Sales -> Customers).
   * Level 3: Subview with depth 1 -> Steps to main overview ('companyProfile').
   * Level 4: Root screen -> Double-tap to exit app.
   */
  executeStepBack(): boolean {
    const now = Date.now();
    // Debounce to strictly eliminate multi-firing across native and web events
    if (now - this.lastBackEventTime < 350) {
      return true;
    }
    this.lastBackEventTime = now;
    this.isPerformingBack = true;

    try {
      // 1. If any modal/sheet is open, close the newest one first
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
          return true;
        }
      }

      // 2. Sequential Step-by-Step Back in history stack
      if (this.historyStack.length > 1) {
        // Pop current view
        this.historyStack.pop();
        // Target is the preceding view in the stack
        const prevView = this.historyStack[this.historyStack.length - 1] ?? 'companyProfile';
        
        // Update URL hash cleanly
        if (typeof window !== 'undefined') {
          try {
            const slug = prevView || 'dashboard';
            window.history.replaceState({
              view: prevView,
              index: this.historyStack.length - 1,
              timestamp: Date.now()
            }, '', '#' + slug);
          } catch {
            // ignore
          }
        }

        // Notify App component to render previous view
        if (this.onNavigateCallback) {
          this.onNavigateCallback(prevView);
        }
        return true;
      }

      // 3. If on a sub-screen with only 1 item in stack, return to root ('companyProfile')
      const current = this.getCurrentView();
      if (current !== null && current !== 'companyProfile') {
        this.historyStack = ['companyProfile'];
        if (typeof window !== 'undefined') {
          try {
            window.history.replaceState({
              view: 'companyProfile',
              timestamp: Date.now()
            }, '', '#companyProfile');
          } catch {
            // ignore
          }
        }
        if (this.onNavigateCallback) {
          this.onNavigateCallback('companyProfile');
        }
        return true;
      }

      // 4. At the root screen: Double-tap back within 2s to exit
      return this.handleRootExitProtection();
    } finally {
      setTimeout(() => {
        this.isPerformingBack = false;
      }, 200);
    }
  }

  /**
   * Double-tap back on root to prevent accidental app close in Android APK
   */
  private handleRootExitProtection(): boolean {
    const now = Date.now();
    if (now - this.lastExitPressTime < 2000) {
      try {
        App.exitApp();
        return true;
      } catch {
        // ignore
      }
      return false;
    }

    this.lastExitPressTime = now;
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
