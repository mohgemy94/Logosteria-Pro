const fs = require('fs');
let code = fs.readFileSync('src/components/ChartOfAccountsTree.tsx', 'utf8');

// Import Plus and Edit2
code = code.replace(/Trash2,/g, 'Trash2,\n  Plus,\n  Edit2,');

// Update TreeNodeItem props
code = code.replace(
  /onInspectRollup: \(code: string\) => void;/g,
  `onInspectRollup: (code: string) => void;\n  onAddChild: (node: AccountTreeNode) => void;\n  onEditNode: (node: AccountTreeNode) => void;`
);

// Update TreeNodeItem destructuring
code = code.replace(
  /onInspectRollup\n}: {/g,
  `onInspectRollup,\n  onAddChild,\n  onEditNode\n}: {`
);

// Update recursive calls
code = code.replace(
  /onInspectRollup=\{onInspectRollup\}/g,
  `onInspectRollup={onInspectRollup}\n            onAddChild={onAddChild}\n            onEditNode={onEditNode}`
);

// Add action buttons
const actionsHtml = `
          {/* Action Buttons */}
          <div className="flex items-center gap-1 border-r border-slate-200 pr-2 mr-1">
            <button
              onClick={() => onEditNode(node)}
              className="p-1.5 rounded-md bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-100 transition-colors"
              title="تعديل الحساب"
            >
              <Edit2 size={13} />
            </button>
            {node.level < 5 && (
              <button
                onClick={() => onAddChild(node)}
                className="p-1.5 rounded-md bg-slate-50 text-slate-500 hover:text-emerald-600 hover:bg-emerald-100 transition-colors"
                title="إضافة حساب فرعي"
              >
                <Plus size={13} />
              </button>
            )}
          </div>
          {/* زر استعلام الـ CTE Rollup */}
`;
code = code.replace(/\{\/\* زر استعلام الـ CTE Rollup \*\/\}/g, actionsHtml);

fs.writeFileSync('src/components/ChartOfAccountsTree.tsx', code);
console.log("Patched ChartOfAccountsTree props and buttons");
