# Patch Customers.tsx
with open('src/components/Customers.tsx', 'r', encoding='utf-8') as f:
    text_cust = f.read()

# Add Layers to lucide-react if not there
if 'Layers,' not in text_cust:
    text_cust = text_cust.replace('Plus,', 'Plus, Layers,', 1)

# Header button
old_cust_btn = """          <PrintDropdown />"""
new_cust_btn = """          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'chartTree' } }));
            }}
            className="btn-3d btn-3d-white h-10 px-3 text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs text-emerald-800 border-emerald-300"
            title="عرض حساب مراقبة العملاء (1201) في شجرة الحسابات المالية"
          >
            <Layers size={15} className="text-emerald-600" />
            <span className="hidden md:inline">شجرة الحسابات (1201)</span>
          </button>
          <PrintDropdown />"""

if old_cust_btn in text_cust:
    text_cust = text_cust.replace(old_cust_btn, new_cust_btn, 1)
    print("Customers.tsx: Header button added")
else:
    print("Customers.tsx: Failed header button")

# Card badge
old_cust_badge = """                {/* Balance & Operations Highlight */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 mb-3 flex items-center justify-between">"""

new_cust_badge = """                {/* شارة الربط بشجرة الحسابات */}
                <div className="flex items-center justify-between px-2.5 py-1 bg-indigo-50/80 border border-indigo-100 rounded-lg text-[11px] text-indigo-900 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-indigo-700">الحساب بالشجرة:</span>
                    <span className="font-mono font-bold">{c.accountId || '1201'}</span>
                    <span className="text-slate-500 text-[10px] truncate">- ذمم العملاء والمدينين (AR)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToAccountMovements(c.accountId || '1201')}
                    className="text-[10px] text-indigo-600 hover:text-indigo-900 font-bold hover:underline"
                    title="كشف حساب الأستاذ العام"
                  >
                    دفتر الأستاذ ←
                  </button>
                </div>

                {/* Balance & Operations Highlight */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 mb-3 flex items-center justify-between">"""

if old_cust_badge in text_cust:
    text_cust = text_cust.replace(old_cust_badge, new_cust_badge, 1)
    print("Customers.tsx: Card badge added")
else:
    print("Customers.tsx: Failed card badge")

with open('src/components/Customers.tsx', 'w', encoding='utf-8') as f:
    f.write(text_cust)

# Patch Vendors.tsx
with open('src/components/Vendors.tsx', 'r', encoding='utf-8') as f:
    text_vend = f.read()

if 'Layers,' not in text_vend:
    text_vend = text_vend.replace('Plus,', 'Plus, Layers,', 1)

old_vend_btn = """          <ExportButtonGroup
            title="دليل وسجل حسابات الموردين" """

new_vend_btn = """          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'chartTree' } }));
            }}
            className="btn-3d btn-3d-white h-10 px-3 text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs text-purple-800 border-purple-300"
            title="عرض حساب مراقبة الموردين (2101) في شجرة الحسابات المالية"
          >
            <Layers size={15} className="text-purple-600" />
            <span className="hidden md:inline">شجرة الحسابات (2101)</span>
          </button>
          <ExportButtonGroup
            title="دليل وسجل حسابات الموردين" """

if old_vend_btn in text_vend:
    text_vend = text_vend.replace(old_vend_btn, new_vend_btn, 1)
    print("Vendors.tsx: Header button added")
else:
    print("Vendors.tsx: Failed header button")

old_vend_badge = """              {/* Financial Metrics Box */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">"""

new_vend_badge = """              {/* شارة الربط بشجرة الحسابات */}
              <div className="flex items-center justify-between px-2.5 py-1 bg-purple-50/80 border border-purple-100 rounded-lg text-[11px] text-purple-900 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-purple-700">الحساب بالشجرة:</span>
                  <span className="font-mono font-bold">{v.accountId || '2101'}</span>
                  <span className="text-slate-500 text-[10px] truncate">- ذمم الموردين والدائنين (AP)</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigateToAccountMovements(v.accountId || '2101')}
                  className="text-[10px] text-purple-600 hover:text-purple-900 font-bold hover:underline"
                  title="كشف حساب الأستاذ العام"
                >
                  دفتر الأستاذ ←
                </button>
              </div>

              {/* Financial Metrics Box */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">"""

if old_vend_badge in text_vend:
    text_vend = text_vend.replace(old_vend_badge, new_vend_badge, 1)
    print("Vendors.tsx: Card badge added")
else:
    print("Vendors.tsx: Failed card badge")

with open('src/components/Vendors.tsx', 'w', encoding='utf-8') as f:
    f.write(text_vend)

print("Customers & Vendors patched successfully!")
