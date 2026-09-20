const fs = require('fs');
const p = 'src/utils/trialBalanceStore.ts';
let content = fs.readFileSync(p, 'utf-8');

// The logic starts at `// Build rows per account`
// We want to calculate the leaf movements first, then roll them up.
// Actually, `addMovement` was used for all entries. Some system entries might have directly posted to parent accounts (e.g., '1201' is a parent if it has children, though usually it's a leaf for some modules in this app).
// So a safe rollup is: For every account, add the movements of all its DESCENDANTS to itself.

const searchString = `  // Build rows per account
  let rows: TrialBalanceRow[] = accounts.map(account => {`;

const replacementString = `  // --- Rollup Calculation ---
  // Ensure parent accounts reflect the sum of their children
  // We sort accounts by code length descending to process children before parents
  const sortedAccounts = [...accounts].sort((a, b) => b.code.length - a.code.length);
  sortedAccounts.forEach(acc => {
    // find parent
    const parent = accounts.find(a => a.id === acc.parentId || (acc.code.length > 1 && a.code === acc.code.substring(0, acc.code.length - (acc.code.length % 2 === 0 ? 2 : 1)))); // Fallback for code-based hierarchy
    if (parent && parent.id !== acc.id) {
      const childRec = map.get(acc.id) || { debitMovement: 0, creditMovement: 0 };
      const parentRec = map.get(parent.id) || { debitMovement: 0, creditMovement: 0 };
      parentRec.debitMovement += childRec.debitMovement;
      parentRec.creditMovement += childRec.creditMovement;
      map.set(parent.id, parentRec);
      map.set(parent.code, parentRec);
    }
  });

  // Build rows per account
  let rows: TrialBalanceRow[] = accounts.map(account => {`;

content = content.replace(searchString, replacementString);
fs.writeFileSync(p, content);
