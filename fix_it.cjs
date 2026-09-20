const fs = require('fs');

const files = [
  'src/utils/itemsStore.ts',
  'src/utils/salesStore.ts',
  'src/utils/trialBalanceStore.ts',
  'src/utils/partnerLedger.ts',
  'src/data/mockPayroll.ts',
  'src/data/mockManufacturing.ts',
  'src/data/mockInstallments.ts'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\\\[\\\]/g, '[]');
  fs.writeFileSync(file, content, 'utf8');
}

console.log('Fixed escaped brackets.');
