with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

old_nav_class = '''  const navItemClass = (viewName: string) => {
    const isCurrentlyActive = activeView === viewName || (viewName === 'dashboard' && activeView === null);
    const isOpenInWindow = isMultiWindowMode && windows.some(w => w.view === viewName && !w.isMinimized);
    const isActiveWindow = isMultiWindowMode && activeWindowId && windows.find(w => w.id === activeWindowId)?.view === viewName;

    const isHighlighted = isMultiWindowMode
      ? (isActiveWindow || (viewName === 'dashboard' && !activeWindowId && windows.length === 0))
      : isCurrentlyActive;'''

new_nav_class = '''  const navItemClass = (viewName: string) => {
    const isCurrentlyActive = activeView === viewName || (viewName === 'companyProfile' && (activeView === null || activeView === 'companyProfile'));
    const isOpenInWindow = isMultiWindowMode && windows.some(w => w.view === viewName && !w.isMinimized);
    const isActiveWindow = isMultiWindowMode && activeWindowId && windows.find(w => w.id === activeWindowId)?.view === viewName;

    const isHighlighted = isMultiWindowMode
      ? (isActiveWindow || (viewName === 'companyProfile' && (!activeWindowId || windows.length === 0)))
      : isCurrentlyActive;'''

text = text.replace(old_nav_class, new_nav_class)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("navItemClass patched to highlight companyProfile when windows are closed!")
