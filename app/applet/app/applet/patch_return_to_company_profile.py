with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update handleCloseWindow
old_close_win = '''        setActiveWindowId(topRemaining ? topRemaining.id : null);
        setActiveView(topRemaining ? topRemaining.view : null);'''

new_close_win = '''        setActiveWindowId(topRemaining ? topRemaining.id : null);
        setActiveView(topRemaining ? topRemaining.view : 'companyProfile');'''

text = text.replace(old_close_win, new_close_win)

# 2. Update handleMinimizeWindow
old_min_win = '''        setActiveWindowId(remaining[0] ? remaining[0].id : null);
        setActiveView(remaining[0] ? remaining[0].view : null);'''

new_min_win = '''        setActiveWindowId(remaining[0] ? remaining[0].id : null);
        setActiveView(remaining[0] ? remaining[0].view : 'companyProfile');'''

text = text.replace(old_min_win, new_min_win)

# 3. Update handleMinimizeAll
old_min_all = '''  const handleMinimizeAll = () => {
    setWindows(prev => prev.map(w => ({ ...w, isMinimized: true })));
    setActiveWindowId(null);
    setActiveView(null);
  };'''

new_min_all = '''  const handleMinimizeAll = () => {
    setWindows(prev => prev.map(w => ({ ...w, isMinimized: true })));
    setActiveWindowId(null);
    setActiveView('companyProfile');
  };'''

text = text.replace(old_min_all, new_min_all)

# 4. Update handleCloseAll
old_close_all = '''  const handleCloseAll = () => {
    setWindows([]);
    setActiveWindowId(null);
    setActiveView(null);
  };'''

new_close_all = '''  const handleCloseAll = () => {
    setWindows([]);
    setActiveWindowId(null);
    setActiveView('companyProfile');
  };'''

text = text.replace(old_close_all, new_close_all)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Return to CompanyProfileScreen on window close configured successfully!")
