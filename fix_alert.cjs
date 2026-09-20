const fs = require('fs');
const p = 'src/components/NewJournalEntry.tsx';
let content = fs.readFileSync(p, 'utf-8');

// Fix the alert message
content = content.replace(
  /ل\{isSaving \? 'جاري الترحيل\.\.\.' : 'ترحيل القيد'\}\.\`\);/,
  "لترحيل القيد.\`);"
);

fs.writeFileSync(p, content);
