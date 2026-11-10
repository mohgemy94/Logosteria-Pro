with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update initial windows state -> [] so no window is created for companyProfile on startup
old_windows_init = '''  const [windows, setWindows] = useState<DesktopWindow[]>(() => {
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

new_windows_init = '''  const [windows, setWindows] = useState<DesktopWindow[]>([]);'''

text = text.replace(old_windows_init, new_windows_init)

# 2. Update initial activeWindowId state -> null
old_active_win_init = '''  const [activeWindowId, setActiveWindowId] = useState<string | null>(() => {
    const initialView = activeView || 'companyProfile';
    return typeof window !== 'undefined' && window.innerWidth >= 768
      ? `win_${initialView}`
      : null;
  });'''

new_active_win_init = '''  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);'''

text = text.replace(old_active_win_init, new_active_win_init)

# 3. Update handleNavigate for companyProfile
old_handle_nav_cp = '''      if (view === 'companyProfile') {
        // Show the fixed background screen directly (Company Profile)
        setActiveWindowId(null);
        setActiveView('companyProfile');
        return;
      }'''

new_handle_nav_cp = '''      if (view === 'companyProfile') {
        // Show the fixed background screen directly without any window
        setActiveWindowId(null);
        setActiveView('companyProfile');
        setWindows(prev => prev.filter(w => w.view !== 'companyProfile'));
        return;
      }'''

text = text.replace(old_handle_nav_cp, new_handle_nav_cp)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("CompanyProfileScreen configured as pure fixed background screen without window!")
