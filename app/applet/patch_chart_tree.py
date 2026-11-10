with open('src/components/ChartOfAccountsTree.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add imports
old_imp = """  Undo2,
  Redo2,
  History
} from 'lucide-react';"""

new_imp = """  Undo2,
  Redo2,
  History,
  Link2
} from 'lucide-react';
import ErpAccountMappingModal from './ErpAccountMappingModal';
import { getAccountLinkedModules } from '../utils/accountingIntegration';"""

if old_imp in text:
    text = text.replace(old_imp, new_imp, 1)
    print("1. Imports updated")
else:
    print("1. Failed imports")

# 2. Add isIntegrationHubOpen state
old_state = "  const [isGoldenRulesModalOpen, setIsGoldenRulesModalOpen] = useState(false);"
new_state = """  const [isGoldenRulesModalOpen, setIsGoldenRulesModalOpen] = useState(false);
  const [isIntegrationHubOpen, setIsIntegrationHubOpen] = useState(false);"""
if old_state in text:
    text = text.replace(old_state, new_state, 1)
    print("2. State updated")
else:
    print("2. Failed state")

# 3. Add event listener
old_listener = "    window.addEventListener('alpha-chart-of-accounts-updated', handleSync);"
new_listener = """    const handleOpenMapping = () => setIsIntegrationHubOpen(true);
    window.addEventListener('alpha-open-account-mapping', handleOpenMapping);
    window.addEventListener('alpha-chart-of-accounts-updated', handleSync);"""
if old_listener in text:
    text = text.replace(old_listener, new_listener, 1)
    print("3. Listener updated")
else:
    print("3. Failed listener")

old_cleanup = "      window.removeEventListener('alpha-chart-of-accounts-updated', handleSync);"
new_cleanup = """      window.removeEventListener('alpha-open-account-mapping', handleOpenMapping);
      window.removeEventListener('alpha-chart-of-accounts-updated', handleSync);"""
if old_cleanup in text:
    text = text.replace(old_cleanup, new_cleanup, 1)
    print("4. Cleanup updated")
else:
    print("4. Failed cleanup")

# 5. Add header button
old_btn = """            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'trialBalance' } }));
              }}"""

new_btn = """            <button
              onClick={() => setIsIntegrationHubOpen(true)}
              className="flex items-center justify-center flex-1 sm:flex-none gap-2 px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-black transition-all shadow-md cursor-pointer shrink-0 border border-emerald-400/40"
              title="مركز ربط وتوجيه شجرة الحسابات بكافة شاشات وأقسام البرنامج (فواتير، سندات، عملاء، موردين، مخزون، رواتب)"
            >
              <Link2 size={16} />
              <span>ربط الشجرة بكافة شاشات البرنامج 🔗</span>
              <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-mono">100% متكامل</span>
            </button>

            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'trialBalance' } }));
              }}"""

if old_btn in text:
    text = text.replace(old_btn, new_btn, 1)
    print("5. Header button updated")
else:
    print("5. Failed header button")

# 6. Add badge to TreeNodeItem
old_badge = "{getLevelBadge(node.level, node.isPosting, hasChildren)}"
new_badge = """{getLevelBadge(node.level, node.isPosting, hasChildren)}
            {(() => {
              const linked = getAccountLinkedModules(node.code);
              if (!linked || linked.length === 0) return null;
              return (
                <span
                  className="hidden xl:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 shrink-0 cursor-help"
                  title={`شاشات وأنظمة البرنامج المرتبطة بهذا الحساب تلقائياً: ${linked.join(' • ')}`}
                >
                  <Link2 size={10} className="text-teal-600" />
                  <span>مرتبط: {linked[0]}</span>
                  {linked.length > 1 && (
                    <span className="bg-teal-200/60 px-1 rounded text-[9px]">+{linked.length - 1}</span>
                  )}
                </span>
              );
            })()}"""

if old_badge in text:
    text = text.replace(old_badge, new_badge, 1)
    print("6. Badge updated")
else:
    print("6. Failed badge")

# 7. Add modal before the end
old_end = """            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 font-medium">
                إجمالي العمليات المسجلة: {historyList.length}
              </span>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );"""

new_end = """            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 font-medium">
                إجمالي العمليات المسجلة: {historyList.length}
              </span>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة مركز ربط شجرة الحسابات بكافة شاشات البرنامج */}
      <ErpAccountMappingModal
        isOpen={isIntegrationHubOpen}
        onClose={() => setIsIntegrationHubOpen(false)}
        currencySymbol={currencySymbol}
      />
    </div>
  );"""

if old_end in text:
    text = text.replace(old_end, new_end, 1)
    print("7. Modal updated")
else:
    print("7. Failed modal")

with open('src/components/ChartOfAccountsTree.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("Saved ChartOfAccountsTree.tsx successfully!")
