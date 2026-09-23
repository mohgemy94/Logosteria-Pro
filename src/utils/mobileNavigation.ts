/**
 * Navigation History Manager for Logustria ERP
 * Provides native mobile back button support, hardware popstate handling,
 * modal stack management, and edge swipe-to-go-back gesture detection.
 */

export interface HistoryState {
  view: string | null;
  hasModal?: boolean;
  modalId?: string;
  step?: number;
}

type BackHandler = () => boolean; // return true if handled, false to continue

class MobileNavigationController {
  private modalHandlers: Map<string, BackHandler> = new Map();
  private historyStack: (string | null)[] = ['companyProfile'];
  private initialized = false;
  private isProcessingPopState = false;
  private onNavigateCallback: ((view: string | null) => void) | null = null;

  init(onNavigate: (view: string | null) => void, initialView: string | null = 'companyProfile') {
    if (this.initialized) return;
    this.initialized = true;
    this.onNavigateCallback = onNavigate;
    this.historyStack = [initialView];

    // Replace current state with initial
    if (typeof window !== 'undefined' && window.history) {
      try {
        const state: HistoryState = { view: initialView, step: 0 };
        window.history.replaceState(state, '');
      } catch {
        // ignore
      }

      window.addEventListener('popstate', this.handlePopState);
    }
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', this.handlePopState);
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
          step: window.history.state?.step ? window.history.state.step + 1 : 1
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
          step: this.historyStack.length - 1
        };
        window.history.pushState(state, '');
      } catch {
        // ignore
      }
    }
  }

  /**
   * Trigger back navigation programmatically
   */
  goBack(): boolean {
    if (typeof window !== 'undefined' && window.history) {
      // Check if there are modals registered
      if (this.modalHandlers.size > 0) {
        window.history.back();
        return true;
      }

      if (this.historyStack.length > 1) {
        window.history.back();
        return true;
      }

      // If at root and not at dashboard or companyProfile, return to companyProfile / dashboard
      const current = this.getCurrentView();
      if (current !== null && current !== 'companyProfile') {
        if (this.onNavigateCallback) {
          this.onNavigateCallback('companyProfile');
          return true;
        }
      }
    }
    return false;
  }

  getCurrentView(): string | null {
    return this.historyStack.length > 0 ? this.historyStack[this.historyStack.length - 1] : null;
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

  private handlePopState = (event: PopStateEvent) => {
    this.isProcessingPopState = true;

    try {
      // 1. Check if we have registered modals that need closing
      if (this.modalHandlers.size > 0) {
        // Close latest modal
        const entries = Array.from(this.modalHandlers.entries());
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          const [id, handler] = lastEntry;
          this.modalHandlers.delete(id);
          const handled = handler();
          if (handled) {
            this.isProcessingPopState = false;
            return;
          }
        }
      }

      // 2. Otherwise, update view
      if (this.historyStack.length > 1) {
        this.historyStack.pop();
        const prevView = this.historyStack[this.historyStack.length - 1];
        if (this.onNavigateCallback) {
          this.onNavigateCallback(prevView);
        }
      } else {
        // Fallback: If stack was empty or 1, check event.state
        const state = event.state as HistoryState | null;
        if (state && state.view !== undefined) {
          if (this.onNavigateCallback) {
            this.onNavigateCallback(state.view);
          }
        } else {
          // Default to companyProfile or dashboard
          if (this.onNavigateCallback) {
            this.onNavigateCallback('companyProfile');
          }
        }
      }
    } finally {
      this.isProcessingPopState = false;
    }
  };
}

export const mobileNavigationController = new MobileNavigationController();
