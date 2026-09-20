const fs = require('fs');
const p = 'src/server/accountRoutes.ts';
let content = fs.readFileSync(p, 'utf-8');

const closeEndpoint = `
/**
 * POST /api/year-end/close
 * Year-end closing: zeroes out revenue and expenses and posts to retained earnings
 */
accountRouter.post('/year-end/close', async (req: Request, res: Response) => {
  try {
    const { tenantId = DEFAULT_TENANT_ID, year } = req.body;
    if (!year) {
      return res.status(400).json({ success: false, error: 'Year is required' });
    }

    const allAccounts = await accountEngine.getAllAccounts(tenantId);
    const allEntries = await accountEngine.getAllJournalEntries(tenantId);

    // 1. Ensure Retained Earnings account exists (3201)
    let retainedEarningsAcc = allAccounts.find(a => a.code === '3201');
    if (!retainedEarningsAcc) {
      // Find parent equity account (e.g., 32 or 3)
      let parent = allAccounts.find(a => a.code === '32');
      if (!parent) parent = allAccounts.find(a => a.code === '3');
      if (!parent) throw new Error("لا يوجد حساب حقوق ملكية رئيسي (3)");
      
      retainedEarningsAcc = await accountEngine.createCustomAccount({
        tenantId,
        parentAccountId: parent.id,
        nameAr: 'الأرباح المبقاة',
        nameEn: 'Retained Earnings',
        isPosting: true
      });
      // Force code to 3201 if possible, but createCustomAccount auto-generates.
      // We'll just use what it generated, or we can manually insert it if we want exact code.
      // Let's manually create it to ensure code is exactly 3201
      // For now, we'll just use the generated one and tag it as retained earnings.
    }

    // Actually, let's just make sure we find or create exactly 3201.
    // In accountEngine, createCustomAccount generates sequential codes. We can't force '3201' easily via API without modifying engine.
    // But let's check if we can. 

    // Aggregate balances for the year
    const entriesForYear = allEntries.filter(entry => {
      if (!entry.date) return false;
      return new Date(entry.date).getFullYear() === year;
    });

    const accountBalances = new Map<string, number>(); // ID -> net balance (positive = debit, negative = credit)

    entriesForYear.forEach(entry => {
      entry.lines.forEach(line => {
        const acc = allAccounts.find(a => a.id === line.accountId);
        if (acc && (acc.code.startsWith('4') || acc.code.startsWith('5'))) {
          const current = accountBalances.get(acc.id) || 0;
          accountBalances.set(acc.id, current + line.debit - line.credit);
        }
      });
    });

    const lines = [];
    let totalDebitLines = 0;
    let totalCreditLines = 0;

    for (const [accountId, balance] of accountBalances.entries()) {
      if (Math.abs(balance) < 0.01) continue; // Skip zero balances
      
      // To zero out a debit balance, we must credit it.
      // To zero out a credit balance, we must debit it.
      if (balance > 0) { // Debit balance
        lines.push({ accountId, debit: 0, credit: balance });
        totalCreditLines += balance;
      } else { // Credit balance (negative)
        const absBal = Math.abs(balance);
        lines.push({ accountId, debit: absBal, credit: 0 });
        totalDebitLines += absBal;
      }
    }

    if (lines.length === 0) {
      return res.status(400).json({ success: false, error: 'لا توجد حركات للإيرادات والمصروفات في هذه السنة لإقفالها' });
    }

    // Balance the entry with Retained Earnings
    // If we debited more than we credited, we need to credit retained earnings (Profit)
    // If we credited more than we debited, we need to debit retained earnings (Loss)
    
    // BUT wait! 
    // Total debits and credits must balance.
    // Let's say Revenue = 1000 (Credit balance). To zero it, we Debit 1000. totalDebitLines = 1000.
    // Expense = 400 (Debit balance). To zero it, we Credit 400. totalCreditLines = 400.
    // We need 600 Credit to balance. So Retained earnings gets a Credit of 600. (Profit).
    const diff = totalDebitLines - totalCreditLines;
    
    // We must find 3201. If it doesn't exist, we fallback to the parent Equity account directly just to avoid errors, or try creating it.
    let targetEqAcc = allAccounts.find(a => a.code === '3201' || a.code === '3101' || a.code.startsWith('32'));
    if (!targetEqAcc) targetEqAcc = allAccounts.find(a => a.code === '3');
    if (!targetEqAcc) throw new Error("No Equity account found");

    if (diff > 0) {
      lines.push({ accountId: targetEqAcc.id, debit: 0, credit: Math.abs(diff) });
    } else if (diff < 0) {
      lines.push({ accountId: targetEqAcc.id, debit: Math.abs(diff), credit: 0 });
    }

    // Ensure lines have partnerId optional etc.
    const finalLines = lines.map(l => ({ ...l, debit: Number(l.debit.toFixed(2)), credit: Number(l.credit.toFixed(2)) }));

    // Create journal entry
    const newEntry = await accountEngine.createJournalEntry({
      tenantId,
      date: \`\${year}-12-31\`,
      reference: \`إقفال \${year}\`,
      description: \`قيد إقفال السنة المالية \${year}\`,
      lines: finalLines
    });

    res.json({ success: true, data: newEntry });
  } catch (err: any) {
    console.error("Year End Close Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
`;

// Insert the new endpoint before 'accountRouter.get('/dashboard/kpis''
content = content.replace(
  "accountRouter.get('/dashboard/kpis'",
  closeEndpoint + "\naccountRouter.get('/dashboard/kpis'"
);

fs.writeFileSync(p, content);
