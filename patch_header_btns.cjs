const fs = require('fs');
let code = fs.readFileSync('src/components/ChartOfAccountsTree.tsx', 'utf8');

// The banner button container is currently:
// <div className="flex items-center gap-2 shrink-0">
code = code.replace(
  /<div className="flex items-center gap-2 shrink-0">/,
  '<div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">'
);

// We might want to make the buttons flex-1 on mobile so they stretch properly instead of breaking.
// <button className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 ...
// <button className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-600 ...
// <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 ...

code = code.replace(
  /className="flex items-center gap-1\.5 px-3 py-2\.5 bg-slate-800/g,
  'className="flex items-center justify-center flex-1 sm:flex-none gap-1.5 px-3 py-2.5 bg-slate-800'
);
code = code.replace(
  /className="flex items-center gap-1\.5 px-3\.5 py-2\.5 bg-blue-600/g,
  'className="flex items-center justify-center flex-1 sm:flex-none gap-1.5 px-3.5 py-2.5 bg-blue-600'
);
code = code.replace(
  /className="flex items-center gap-2 px-4 py-2\.5 bg-indigo-600/g,
  'className="flex items-center justify-center flex-1 sm:flex-none gap-2 px-4 py-2.5 bg-indigo-600'
);

fs.writeFileSync('src/components/ChartOfAccountsTree.tsx', code);
console.log("Patched banner buttons container");
