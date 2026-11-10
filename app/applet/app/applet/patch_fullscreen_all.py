with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update initial windows state -> always maximized full screen
old_windows_state = '''  const [windows, setWindows] = useState<DesktopWindow[]>(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      const initialView = activeView;
      if (initialView && initialView !== 'dashboard' && initialView !== 'companyProfile') {
        const meta = getWindowMeta(initialView, 'ar');
        return [{
          id: `win_${initialView}`,
          view: initialView,
          title: meta.title,
          badge: meta.badge,
          badgeColor: meta.badgeColor,
          isMinimized: false,
          isMaximized: false,
          zIndex: 100,
          x: 24,
          y: 20
        }];
      }
    }
    return [];
  });'''

new_windows_state = '''  const [windows, setWindows] = useState<DesktopWindow[]>(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      const initialView = activeView || 'companyProfile';
      const meta = getWindowMeta(initialView, 'ar');
      return [{
        id: `win_${initialView}`,
        view: initialView,
        title: meta.title,
        badge: meta.badge,
        badgeColor: meta.badgeColor,
        isMinimized: false,
        isMaximized: true,
        zIndex: 100,
        x: 0,
        y: 0
      }];
    }
    return [];
  });'''

text = text.replace(old_windows_state, new_windows_state)

# 2. Update initial activeWindowId state
old_active_win_id = '''  const [activeWindowId, setActiveWindowId] = useState<string | null>(() => {
    return typeof window !== 'undefined' && window.innerWidth >= 768 && activeView && activeView !== 'dashboard' && activeView !== 'companyProfile'
      ? `win_${activeView}`
      : null;
  });'''

new_active_win_id = '''  const [activeWindowId, setActiveWindowId] = useState<string | null>(() => {
    const initialView = activeView || 'companyProfile';
    return typeof window !== 'undefined' && window.innerWidth >= 768
      ? `win_${initialView}`
      : null;
  });'''

text = text.replace(old_active_win_id, new_active_win_id)

# 3. Update handleNavigate to always open/focus windows in maximized full screen mode, including dashboard
old_handle_nav_body = '''    // On Desktop when Multi-Window MDI mode is active
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
    if (isDesktop && isMultiWindowMode) {
      if (!view || view === 'dashboard' || view === 'companyProfile') {
        setActiveWindowId(null);
      } else {
        setWindows(prev => {
          const existing = prev.find(w => w.view === view);
          nextZIndexRef.current += 1;
          const newZ = nextZIndexRef.current;

          if (existing) {
            setActiveWindowId(existing.id);
            return prev.map(w =>
              w.id === existing.id
                ? { ...w, isMinimized: false, zIndex: newZ }
                : w
            );
          }

          const meta = getWindowMeta(view, language);
          const openCount = prev.filter(w => !w.isMinimized).length;
          const cascadeOffset = (openCount % 6) * 32 + 20;
          const isDesktopRtl = language === 'ar';
          const defaultWinW = Math.min(typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.76) : 960, 1100);
          const workspaceW = typeof window !== 'undefined' ? window.innerWidth - (isDesktopSidebarOpen ? 280 : 30) : 1200;
          const initialX = isDesktopRtl
            ? Math.max(20, workspaceW - defaultWinW - cascadeOffset)
            : cascadeOffset;

          const newWin: DesktopWindow = {
            id: `win_${view}_${Date.now()}`,
            view,
            title: meta.title,
            badge: meta.badge,
            badgeColor: meta.badgeColor,
            isMinimized: false,
            isMaximized: false,
            zIndex: newZ,
            x: initialX,
            y: cascadeOffset,
          };

          setActiveWindowId(newWin.id);
          return [...prev, newWin];
        });
      }
    }'''

new_handle_nav_body = '''    // On Desktop when Multi-Window MDI mode is active
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
    if (isDesktop && isMultiWindowMode) {
      const targetView = view || 'dashboard';
      setWindows(prev => {
        const existing = prev.find(w => w.view === targetView);
        nextZIndexRef.current += 1;
        const newZ = nextZIndexRef.current;

        if (existing) {
          setActiveWindowId(existing.id);
          return prev.map(w =>
            w.id === existing.id
              ? { ...w, isMinimized: false, isMaximized: true, zIndex: newZ }
              : w
          );
        }

        const meta = getWindowMeta(targetView, language);
        const newWin: DesktopWindow = {
          id: `win_${targetView}_${Date.now()}`,
          view: targetView,
          title: meta.title,
          badge: meta.badge,
          badgeColor: meta.badgeColor,
          isMinimized: false,
          isMaximized: true, // Always open screen in full screen mode!
          zIndex: newZ,
          x: 0,
          y: 0,
        };

        setActiveWindowId(newWin.id);
        return [...prev, newWin];
      });
    }'''

text = text.replace(old_handle_nav_body, new_handle_nav_body)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Patch applied: All screens open in maximized full screen mode!")
