const fs = require('fs');
let code = fs.readFileSync('src/components/ChartOfAccountsTree.tsx', 'utf8');

const modalsInjection = `
      {/* Modals for Add/Edit Account */}
      {(isAddModalOpen || isEditModalOpen) && selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col" dir="rtl">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                {isAddModalOpen ? (
                  <><Plus size={18} className="text-emerald-600" /> إضافة حساب فرعي لـ {selectedNode.nameAr}</>
                ) : (
                  <><Edit2 size={18} className="text-blue-600" /> تعديل حساب {selectedNode.nameAr}</>
                )}
              </h3>
              <button
                onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={isAddModalOpen ? handleSubmitAdd : handleSubmitEdit} className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الحساب (عربي) *</label>
                <input
                  type="text"
                  required
                  value={formData.nameAr}
                  onChange={(e) => setFormData({...formData, nameAr: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="مثال: البنك الأهلي"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الحساب (إنجليزي)</label>
                <input
                  type="text"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({...formData, nameEn: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="e.g. Bank Name"
                />
              </div>

              {isAddModalOpen && selectedNode.level === 4 && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="isPosting"
                    checked={formData.isPosting}
                    onChange={(e) => setFormData({...formData, isPosting: e.target.checked})}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <label htmlFor="isPosting" className="text-xs font-bold text-slate-700 cursor-pointer">
                    حساب حركي (يقبل قيود يومية)
                  </label>
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-sm transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
`;

if (!code.includes('isAddModalOpen || isEditModalOpen')) {
  code = code.replace(/\{\/\* نافذة منبثقة لفحص تحليل الـ CTE Rollup \*\/\}/, modalsInjection + '\n      {/* نافذة منبثقة لفحص تحليل الـ CTE Rollup */}');
  fs.writeFileSync('src/components/ChartOfAccountsTree.tsx', code);
  console.log("Injected Modals successfully");
} else {
  console.log("Modals already injected");
}
