with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

old_switch = '''  const renderViewComponent = (viewName: string | null, isInWindow: boolean = false) => {
    switch (viewName) {
      case 'companyProfile': return ('''

new_switch = '''  const renderViewComponent = (viewName: string | null, isInWindow: boolean = false) => {
    switch (viewName) {
      case 'dashboard':
      case null: return (
        <DashboardScreen 
          onNavigate={(view) => handleNavigate(view)} 
          systemSettings={systemSettings} 
        />
      );
      case 'companyProfile': return ('''

text = text.replace(old_switch, new_switch)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Dashboard case added to renderViewComponent successfully!")
