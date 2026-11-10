# Patch Sales.tsx
with open('src/components/Sales.tsx', 'r', encoding='utf-8') as f:
    text_sales = f.read()

target_sales = """            </div>
          </div>
        </div>
      </div>
{/* History Drawer */}"""

replacement_sales = """            </div>
          </div>
        </div>
      </div>

      {/* شريط مؤشر الربط المحاسبي المباشر بشجرة الحسابات */}
      <div className="bg-gradient-to-r from-emerald-50/90 via-teal-50/90 to-indigo-50/90 border border-emerald-200/90 rounded-2xl px-4 py-2 mb-3 flex items-center justify-between gap-3 text-xs print:hidden shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap text-emerald-950 font-medium">
          <span className="flex items-center gap-1.5 font-black text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            الربط المحاسبي المباشر بشجرة الحسابات:
          </span>
          <span className="bg-white/90 border border-emerald-200 px-2.5 py-0.5 rounded-lg text-[11px] font-mono text-slate-800 shadow-2xs">
            دائن: 4101 (إيرادات المبيعات)
          </span>
          <span className="bg-white/90 border border-emerald-200 px-2.5 py-0.5 rounded-lg text-[11px] font-mono text-slate-800 shadow-2xs">
            دائن: 2102 (ضريبة القيمة المضافة)
          </span>
          <span className="bg-white/90 border border-emerald-200 px-2.5 py-0.5 rounded-lg text-[11px] font-mono text-slate-800 shadow-2xs">
            مدين: {paymentType === 'CASH' ? '1101 (الصندوق الرئيسي)' : '1201 (ذمم العملاء والمدينين)'}
          </span>
          <span className="bg-white/90 border border-emerald-200 px-2.5 py-0.5 rounded-lg text-[11px] font-mono text-slate-800 shadow-2xs">
            تكلفة المخزون: 5101 / 1301
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'chartTree' } }))}
            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 hover:underline flex items-center gap-1 cursor-pointer bg-white/70 px-2.5 py-1 rounded-lg border border-emerald-200/60"
            title="الانتقال لشجرة الحسابات المالية"
          >
            <span>شجرة الحسابات (4101) 🌳</span>
          </button>
        </div>
      </div>

{/* History Drawer */}"""

if target_sales in text_sales:
    text_sales = text_sales.replace(target_sales, replacement_sales, 1)
    with open('src/components/Sales.tsx', 'w', encoding='utf-8') as f:
        f.write(text_sales)
    print("Sales.tsx patched successfully!")
else:
    print("Failed to find target in Sales.tsx")

# Patch Purchases.tsx
with open('src/components/Purchases.tsx', 'r', encoding='utf-8') as f:
    text_purch = f.read()

target_purch = """            </div>
          </div>
        </div>
      </div>
{/* History Drawer */}"""

replacement_purch = """            </div>
          </div>
        </div>
      </div>

      {/* شريط مؤشر الربط المحاسبي المباشر بشجرة الحسابات */}
      <div className="bg-gradient-to-r from-purple-50/90 via-indigo-50/90 to-slate-50/90 border border-purple-200/90 rounded-2xl px-4 py-2 mb-3 flex items-center justify-between gap-3 text-xs print:hidden shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap text-purple-950 font-medium">
          <span className="flex items-center gap-1.5 font-black text-purple-800">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
            الربط المحاسبي المباشر بشجرة الحسابات:
          </span>
          <span className="bg-white/90 border border-purple-200 px-2.5 py-0.5 rounded-lg text-[11px] font-mono text-slate-800 shadow-2xs">
            مدين: 1301 (المخزون السلعي والمشتريات)
          </span>
          <span className="bg-white/90 border border-purple-200 px-2.5 py-0.5 rounded-lg text-[11px] font-mono text-slate-800 shadow-2xs">
            مدين: 2102 (ضريبة القيمة المضافة)
          </span>
          <span className="bg-white/90 border border-purple-200 px-2.5 py-0.5 rounded-lg text-[11px] font-mono text-slate-800 shadow-2xs">
            دائن: {paymentType === 'CASH' ? '1101 (الصندوق الرئيسي)' : '2101 (ذمم الموردين والدائنين)'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'chartTree' } }))}
            className="text-xs font-bold text-purple-800 hover:text-purple-950 hover:underline flex items-center gap-1 cursor-pointer bg-white/70 px-2.5 py-1 rounded-lg border border-purple-200/60"
            title="الانتقال لشجرة الحسابات المالية"
          >
            <span>شجرة الحسابات (1301) 🌳</span>
          </button>
        </div>
      </div>

{/* History Drawer */}"""

if target_purch in text_purch:
    text_purch = text_purch.replace(target_purch, replacement_purch, 1)
    with open('src/components/Purchases.tsx', 'w', encoding='utf-8') as f:
        f.write(text_purch)
    print("Purchases.tsx patched successfully!")
else:
    print("Failed to find target in Purchases.tsx")
