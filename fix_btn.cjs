const fs = require('fs');
const p = 'src/components/NewJournalEntry.tsx';
let content = fs.readFileSync(p, 'utf-8');

content = content.replace(
  /disabled=\{\!isBalanced \|\| \!isNonZero\}\n          className="btn-3d btn-3d-emerald px-4 py-2 text-xs sm:text-sm font-black"\n        >\n          ترحيل القيد/,
  `disabled={!isBalanced || !isNonZero || isSaving}\n          className="btn-3d btn-3d-emerald px-4 py-2 text-xs sm:text-sm font-black"\n        >\n          {isSaving ? 'جاري الترحيل...' : 'ترحيل القيد'}`
);

fs.writeFileSync(p, content);
