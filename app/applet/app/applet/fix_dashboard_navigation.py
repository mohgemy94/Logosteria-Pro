with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update getWindowMeta to include dashboard
old_get_meta = "      case 'companyProfile': return { title, badge: 'INFO', badgeColor: 'bg-amber-600 text-white' };"
new_get_meta = "      case 'dashboard': return { title: language === 'ar' ? 'لوحة المؤشرات والقيادة' : 'Dashboard', badge: 'DASH', badgeColor: 'bg-emerald-600 text-white' };\n      case 'companyProfile': return { title, badge: 'INFO', badgeColor: 'bg-amber-600 text-white' };"

text = text.replace(old_get_meta, new_get_meta)

# 2. Update handleNavigate MDI condition
old_handle_nav = '''    // On Desktop when Multi-Window MDI mode is active
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
    if (isDesktop && isMultiWindowMode) {
      if (!view || view === 'companyProfile') {
        // Show the fixed background screen directly (Company Profile)
        setActiveWindowId(null);
        setActiveView('companyProfile');
        return;
      }

      const targetView = view;
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

new_handle_nav = '''    // On Desktop when Multi-Window MDI mode is active
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
    if (isDesktop && isMultiWindowMode) {
      if (view === 'companyProfile') {
        // Show the fixed background screen directly (Company Profile)
        setActiveWindowId(null);
        setActiveView('companyProfile');
        return;
      }

      const targetView = view || 'dashboard';
      setActiveView(targetView);
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

text = text.replace(old_handle_nav, new_handle_nav)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Dashboard navigation fix applied successfully!")
