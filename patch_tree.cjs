const fs = require('fs');
let code = fs.readFileSync('src/components/ChartOfAccountsTree.tsx', 'utf8');

// Update TreeNodeItem layout to be responsive
code = code.replace(
  /className=\{`group flex items-center justify-between py-2 px-3 my-0\.5 rounded-xl transition-all duration-150 border/,
  'className={`group flex flex-col md:flex-row md:items-center justify-between py-2.5 md:py-2 px-2 md:px-3 my-1 md:my-0.5 rounded-xl transition-all duration-150 border'
);

// Reduce padding right slightly for better mobile fit
code = code.replace(
  /style=\{\{ paddingRight: `\$\{Math\.max\(node\.level \* 16, 12\)\}px` \}\}/g,
  'style={{ paddingRight: `${Math.max(node.level * 12, 8)}px` }}'
);

// Adjust the first inner div (right side) to take full width on mobile if needed
code = code.replace(
  /<div className="flex items-center gap-2\.5 min-w-0 flex-1">/g,
  '<div className="flex items-center gap-2 min-w-0 w-full md:w-auto flex-1">'
);

// Adjust the second inner div (left side balances and actions) to add top margin/border on mobile
code = code.replace(
  /<div className="flex items-center gap-4 shrink-0 text-xs">/g,
  '<div className="flex items-center justify-between md:justify-end gap-2 md:gap-4 shrink-0 text-xs mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-transparent border-slate-100/80">'
);

// Truncate name better
code = code.replace(
  /truncate text-sm \$\{node\.level === 1 \? 'text-slate-900 text-base/g,
  'truncate text-xs sm:text-sm ${node.level === 1 ? \'text-slate-900 text-sm sm:text-base'
);

// Make the net balance taking full width flex space on mobile, keeping its width on desktop
code = code.replace(
  /<div className="text-left w-28 font-mono">/g,
  '<div className="text-left flex-1 md:flex-none md:w-28 font-mono">'
);

fs.writeFileSync('src/components/ChartOfAccountsTree.tsx', code);
console.log("Tree Node responsive layout updated");
