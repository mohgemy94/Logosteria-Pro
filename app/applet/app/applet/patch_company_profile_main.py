with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update activeView initial default state
old_active_view = "    return 'companyProfile'; // Company Profile is the fixed default home screen"
new_active_view = "    return 'companyProfile'; // Company Profile (بيانات الشركة) is the default startup screen"

text = text.replace(old_active_view, new_active_view)

# 2. Update windows initial state
old_windows_init = "      if (initialView && initialView !== 'dashboard') {"
new_windows_init = "      if (initialView && initialView !== 'dashboard' && initialView !== 'companyProfile') {"

text = text.replace(old_windows_init, new_windows_init)

# 3. Update activeWindowId initial state
old_active_win_id = "    return typeof window !== 'undefined' && window.innerWidth >= 768 && activeView && activeView !== 'dashboard'"
new_active_win_id = "    return typeof window !== 'undefined' && window.innerWidth >= 768 && activeView && activeView !== 'dashboard' && activeView !== 'companyProfile'"

text = text.replace(old_active_win_id, new_active_win_id)

# 4. Update handleNavigate MDI condition for companyProfile
old_handle_nav_cond = "      if (!view || view === 'dashboard') {"
new_handle_nav_cond = "      if (!view || view === 'dashboard' || view === 'companyProfile') {"

text = text.replace(old_handle_nav_cond, new_handle_nav_cond)

# 5. Update backgroundContent to render CompanyProfileScreen when activeView === 'companyProfile' or default
old_bg_content = '''              backgroundContent={
                <div className="p-4 lg:p-6 w-full max-w-7xl 2xl:max-w-[1700px] mx-auto flex-1 flex flex-col">
                  <FiscalYearArchiveBanner onNavigateToYearEnd={() => handleNavigate('yearEndClosing')} />
                  <DashboardScreen 
                    onNavigate={(view) => handleNavigate(view)} 
                    systemSettings={systemSettings} 
                  />
                </div>
              }'''

new_bg_content = '''              backgroundContent={
                <div className="p-4 lg:p-6 w-full max-w-7xl 2xl:max-w-[1700px] mx-auto flex-1 flex flex-col">
                  <FiscalYearArchiveBanner onNavigateToYearEnd={() => handleNavigate('yearEndClosing')} />
                  {activeView === 'dashboard' ? (
                    <DashboardScreen 
                      onNavigate={(view) => handleNavigate(view)} 
                      systemSettings={systemSettings} 
                    />
                  ) : (
                    <CompanyProfileScreen 
                      systemSettings={systemSettings} 
                      onNavigateToSettings={() => handleNavigate('settings')} 
                      onNavigateToDashboard={() => handleNavigate('dashboard')}
                      onNavigate={(view) => handleNavigate(view)}
                    />
                  )}
                </div>
              }'''

text = text.replace(old_bg_content, new_bg_content)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("CompanyProfileScreen configured as main full screen on startup successfully!")
