const fs = require('fs');
const p = 'src/utils/trialBalanceStore.ts';
let content = fs.readFileSync(p, 'utf-8');

// If we roll up balances into parent accounts, summing ALL accounts will duplicate the grand totals.
// Grand totals should only be calculated from the LEAF accounts (accounts with no children).
// Or we calculate grand totals BEFORE the rollup.

const totalsLogicOld = `  rows.forEach(r => {
    totalOpeningDebit += r.openingDebit;
    totalOpeningCredit += r.openingCredit;
    totalDebitMovement += r.debitMovement;
    totalCreditMovement += r.creditMovement;
    totalEndingDebit += r.endingDebit;
    totalEndingCredit += r.endingCredit;
  });`;

const totalsLogicNew = `  // Grand totals must be calculated ONLY from leaf accounts to avoid double counting after rollup
  const leafRows = rows.filter(r => !accounts.some(a => a.parentId === r.account.id || (a.code.length > r.account.code.length && a.code.startsWith(r.account.code))));
  
  leafRows.forEach(r => {
    totalOpeningDebit += r.openingDebit;
    totalOpeningCredit += r.openingCredit;
    totalDebitMovement += r.debitMovement;
    totalCreditMovement += r.creditMovement;
    totalEndingDebit += r.endingDebit;
    totalEndingCredit += r.endingCredit;
  });`;

content = content.replace(totalsLogicOld, totalsLogicNew);
fs.writeFileSync(p, content);
