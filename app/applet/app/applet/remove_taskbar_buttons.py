with open('src/components/DesktopWindowManager.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Remove Dashboard Quick Switch Button and its separators
old_dash_btn = '''          {/* Separator between Sidebar toggle & Dashboard */}
          {onToggleSidebar && (
            <div className="w-[1px] h-5 bg-slate-700 mx-0.5 shrink-0" />
          )}

          {/* Dashboard Quick Switch Button */}
          <button
            type="button"
            onClick={onShowDashboard}
            title={language === 'ar' ? 'إظهار لوحة المؤشرات (الخلفية)' : 'Show Dashboard'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 border ${
              windows.length === 0 || (!activeWindow && visibleWindows.length === 0)
                ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700/70'
            }`}
          >
            <LayoutDashboard size={14} className="text-amber-400" />
            <span className="hidden lg:inline">{language === 'ar' ? 'لوحة المؤشرات' : 'Dashboard'}</span>
          </button>

          {/* Separator if windows exist */}
          {windows.length > 0 && (
            <div className="w-[1px] h-5 bg-slate-700 mx-1 shrink-0" />
          )}'''

new_dash_btn = ''

text = text.replace(old_dash_btn, new_dash_btn)

# 2. Remove Mode Badge Indicator (نظام النوافذ) button
old_mode_btn = '''          {/* Mode Badge Indicator */}
          <button
            type="button"
            onClick={onToggleMultiWindowMode}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
              isMultiWindowMode
                ? 'bg-blue-900/60 hover:bg-blue-800/80 text-blue-200 border-blue-500/60 shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title={
              isMultiWindowMode
                ? (language === 'ar' ? 'وضع النوافذ المنبثقة المتعددة (MDI) نشط — انقر للتبديل إلى وضع ملء الشاشة' : 'Multi-window MDI Mode Active — click to switch to single screen')
                : (language === 'ar' ? 'وضع ملء الشاشة الكلاسيكي نشط — انقر للتبديل إلى نظام النوافذ المتعددة' : 'Classic Single Screen Active — click to switch to MDI')
            }
          >
            <AppWindow size={14} className="text-blue-400 shrink-0" />
            <span className="inline">
              {isMultiWindowMode 
                ? (language === 'ar' ? 'نظام النوافذ (MDI)' : 'MDI Mode') 
                : (language === 'ar' ? 'وضع ملء الشاشة' : 'Classic Mode')}
            </span>
            {windows.length > 0 && (
              <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded font-mono font-bold">
                {windows.length}
              </span>
            )}
          </button>'''

new_mode_btn = ''

text = text.replace(old_mode_btn, new_mode_btn)

with open('src/components/DesktopWindowManager.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Taskbar buttons removed successfully!")
