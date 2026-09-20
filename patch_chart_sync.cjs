const fs = require('fs');
let code = fs.readFileSync('src/components/ChartOfAccountsTree.tsx', 'utf8');

if (!code.includes('loadChartOfAccounts')) {
  // Add imports
  code = code.replace(
    /import \{ exportElementToPdf \} from '\.\.\/utils\/pdfExport';/,
    `import { exportElementToPdf } from '../utils/pdfExport';\nimport { loadChartOfAccounts, saveChartOfAccounts } from '../utils/trialBalanceStore';\nimport { AccountType, BalanceType } from '../types/accounting';`
  );

  // Sync logic in handleSubmitAdd
  const syncAdd = `
      if (data.success) {
        // Sync with LocalStorage for the rest of the app
        try {
          const newAcc = data.data;
          const localAccounts = loadChartOfAccounts();
          localAccounts.push({
            id: newAcc.id || newAcc.code,
            code: newAcc.code,
            name: newAcc.nameAr,
            type: newAcc.type as AccountType,
            balanceType: ['ASSET', 'EXPENSE'].includes(newAcc.type) ? BalanceType.Debit : BalanceType.Credit,
            parentId: newAcc.parentAccountId,
            isControlAccount: false
          });
          saveChartOfAccounts(localAccounts);
        } catch(e) { console.error('Sync error', e); }

        setIsAddModalOpen(false);
`;
  code = code.replace(/if \(data\.success\) \{\n\s+setIsAddModalOpen\(false\);/, syncAdd);

  // Sync logic in handleSubmitEdit
  const syncEdit = `
      if (data.success) {
        // Sync with LocalStorage
        try {
          const updatedAcc = data.data;
          const localAccounts = loadChartOfAccounts();
          const accIndex = localAccounts.findIndex(a => a.id === updatedAcc.id || a.code === updatedAcc.code);
          if (accIndex >= 0) {
            localAccounts[accIndex].name = updatedAcc.nameAr;
            saveChartOfAccounts(localAccounts);
          }
        } catch(e) { console.error('Sync error', e); }

        setIsEditModalOpen(false);
`;
  code = code.replace(/if \(data\.success\) \{\n\s+setIsEditModalOpen\(false\);/, syncEdit);

  fs.writeFileSync('src/components/ChartOfAccountsTree.tsx', code);
  console.log("Patched ChartOfAccountsTree Sync");
} else {
  console.log("Already patched sync");
}
