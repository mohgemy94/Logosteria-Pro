with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update initial activeView default to 'companyProfile'
old_default = "    return null; // Main Dashboard is the fixed default home screen\n  });"
new_default = "    return 'companyProfile'; // Company Profile is the fixed default home screen\n  });"

text = text.replace(old_default, new_default)

# 2. Update getViewTitle
old_titles = '''      case 'dashboard':
      case null: return language === 'ar' ? 'الواجهة الرئيسية (لوحة المؤشرات)' : 'Main Dashboard';
      case 'companyProfile': return t('nav_companyProfile', 'بيانات وإعدادات المنشأة');'''

new_titles = '''      case 'companyProfile': return t('nav_companyProfile', 'الواجهة الرئيسية (بيانات الشركة)');
      case 'dashboard':
      case null: return language === 'ar' ? 'لوحة المؤشرات والقيادة' : 'Main Dashboard';'''

text = text.replace(old_titles, new_titles)

# 3. Update Sidebar items
old_sidebar = '''          {/* 1. الرئيسية وبيانات المنشأة */}
          <div className="text-[10px] uppercase font-bold text-slate-500 px-3 mt-1 mb-2 tracking-wider">
            {t('nav_general', 'الرئيسية وبيانات المنشأة')}
          </div>
          <div onClick={() => handleNavigate(null)} className={navItemClass('dashboard')}>
            <LayoutDashboard size={15} className="text-amber-400 shrink-0" /> 
            <span>{t('nav_dashboard', 'الواجهة الرئيسية (لوحة المؤشرات)')}</span>
          </div>
          <div onClick={() => handleNavigate('companyProfile')} className={navItemClass('companyProfile')}>
            <Building2 size={15} className="opacity-80 shrink-0" /> 
            <span>{t('nav_companyProfile', 'بيانات وإعدادات المنشأة')}</span>
          </div>'''

new_sidebar = '''          {/* 1. الرئيسية وبيانات المنشأة */}
          <div className="text-[10px] uppercase font-bold text-slate-500 px-3 mt-1 mb-2 tracking-wider">
            {t('nav_general', 'الرئيسية وبيانات المنشأة')}
          </div>
          <div onClick={() => handleNavigate('companyProfile')} className={navItemClass('companyProfile')}>
            <Building2 size={15} className="text-amber-400 shrink-0" /> 
            <span>{t('nav_companyProfile', 'الواجهة الرئيسية (بيانات الشركة)')}</span>
          </div>
          <div onClick={() => handleNavigate(null)} className={navItemClass('dashboard')}>
            <LayoutDashboard size={15} className="opacity-80 shrink-0" /> 
            <span>{t('nav_dashboard', 'لوحة المؤشرات')}</span>
          </div>'''

text = text.replace(old_sidebar, new_sidebar)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("App.tsx default view set to companyProfile successfully!")
