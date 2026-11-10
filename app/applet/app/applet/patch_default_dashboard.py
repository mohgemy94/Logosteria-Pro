with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update initial activeView default from 'companyProfile' to null (DashboardScreen)
old_default_view = "    return 'companyProfile';\n  });"
new_default_view = "    return null; // Main Dashboard is the fixed default home screen\n  });"

text = text.replace(old_default_view, new_default_view)

# 2. Update getViewTitle for null / dashboard & companyProfile
old_title_case = "      case 'companyProfile': return t('nav_companyProfile', 'الواجهة الرئيسية (بيانات الشركة)');"
new_title_case = "      case 'dashboard':\n      case null: return language === 'ar' ? 'الواجهة الرئيسية (لوحة المؤشرات)' : 'Main Dashboard';\n      case 'companyProfile': return t('nav_companyProfile', 'بيانات وإعدادات المنشأة');"

text = text.replace(old_title_case, new_title_case)

# 3. Update sidebar items order and labels
old_sidebar_block = '''          {/* 1. الرئيسية وبيانات المنشأة */}
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

new_sidebar_block = '''          {/* 1. الرئيسية وبيانات المنشأة */}
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

text = text.replace(old_sidebar_block, new_sidebar_block)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("App.tsx default view set to DashboardScreen successfully!")
