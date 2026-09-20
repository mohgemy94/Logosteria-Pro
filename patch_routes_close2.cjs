const fs = require('fs');
const p = 'src/server/accountRoutes.ts';
let content = fs.readFileSync(p, 'utf-8');

// Fix `return res.status`
content = content.replace(
  /return res\.status\(400\)\.json\(\{ success: false, error: 'Year is required' \}\);/,
  "res.status(400).json({ success: false, error: 'Year is required' }); return;"
);
content = content.replace(
  /return res\.status\(400\)\.json\(\{ success: false, error: 'لا توجد حركات للإيرادات والمصروفات في هذه السنة لإقفالها' \}\);/,
  "res.status(400).json({ success: false, error: 'لا توجد حركات للإيرادات والمصروفات في هذه السنة لإقفالها' }); return;"
);

// Fix `lines` format
const oldFinalLines = `    // Ensure lines have partnerId optional etc.
    const finalLines = lines.map(l => ({ ...l, debit: Number(l.debit.toFixed(2)), credit: Number(l.credit.toFixed(2)) }));`;

const newFinalLines = `    // Convert lines to JournalEntryInput format
    const finalLines = lines.map(l => {
      const isDebit = l.debit > 0;
      const amount = isDebit ? l.debit : l.credit;
      return {
        accountId: l.accountId,
        isDebit,
        amountForeign: Number(amount.toFixed(2)),
        exchangeRate: 1
      };
    });`;

content = content.replace(oldFinalLines, newFinalLines);

fs.writeFileSync(p, content);
