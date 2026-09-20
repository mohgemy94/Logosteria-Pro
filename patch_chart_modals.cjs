const fs = require('fs');
let code = fs.readFileSync('src/components/ChartOfAccountsTree.tsx', 'utf8');

// Add State
const stateInjection = `
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<AccountTreeNode | null>(null);
  const [formData, setFormData] = useState({ nameAr: '', nameEn: '', isPosting: true });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenAdd = (node: AccountTreeNode) => {
    setSelectedNode(node);
    setFormData({ nameAr: '', nameEn: '', isPosting: true });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (node: AccountTreeNode) => {
    setSelectedNode(node);
    setFormData({ nameAr: node.nameAr, nameEn: node.nameEn || '', isPosting: node.isPosting });
    setIsEditModalOpen(true);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode || !formData.nameAr.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/accounts/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentAccountId: selectedNode.id,
          nameAr: formData.nameAr,
          nameEn: formData.nameEn,
          isPosting: formData.isPosting
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsAddModalOpen(false);
        fetchTree();
      } else {
        alert('خطأ: ' + (data.error || 'فشل في الإضافة'));
      }
    } catch (err) {
      alert('خطأ في الاتصال بالخادم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode || !formData.nameAr.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(\`/api/accounts/\${selectedNode.id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameAr: formData.nameAr,
          nameEn: formData.nameEn,
          isPosting: formData.isPosting
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsEditModalOpen(false);
        fetchTree();
      } else {
        alert('خطأ: ' + (data.error || 'فشل في التعديل'));
      }
    } catch (err) {
      alert('خطأ في الاتصال بالخادم');
    } finally {
      setIsSubmitting(false);
    }
  };
`;
code = code.replace(/const \[cacheClearing, setCacheClearing\] = useState\(false\);/, 'const [cacheClearing, setCacheClearing] = useState(false);\n' + stateInjection);

// Inject Modals
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
                  placeholder="e.g. AlAhli Bank"
                />
              </div>

              {isAddModalOpen && (
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
code = code.replace(/\{\/\* Modal لعرض نتيجة الـ Rollup \*\/\}/, modalsInjection + '\n      {/* Modal لعرض نتيجة الـ Rollup */}');

// Link the handlers in the JSX where TreeNodeItem is rendered
code = code.replace(
  /<TreeNodeItem\s+key=\{node.id\}\s+node=\{node\}\s+searchTerm=\{searchTerm\}\s+expandedIds=\{expandedIds\}\s+toggleExpand=\{toggleExpand\}\s+onInspectRollup=\{fetchRollupBalance\}/g,
  `<TreeNodeItem
                key={node.id}
                node={node}
                searchTerm={searchTerm}
                expandedIds={expandedIds}
                toggleExpand={toggleExpand}
                onInspectRollup={fetchRollupBalance}
                onAddChild={handleOpenAdd}
                onEditNode={handleOpenEdit}`
);

fs.writeFileSync('src/components/ChartOfAccountsTree.tsx', code);
console.log("Patched ChartOfAccountsTree Modals");
