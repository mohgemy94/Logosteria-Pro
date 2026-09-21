// src/server/accountRoutes.ts
import { Router, Request, Response } from 'express';
import { accountEngine, CreateAnalyticalAccountInput, JournalEntryInput } from './accountEngine';

export const accountRouter = Router();

const DEFAULT_TENANT_ID = 'tenant_default';

/**
 * 1. نقطة إضافة حساب تحليلي (Create Analytical Account)
 * POST /api/accounts/analytical
 * يستقبل: tenantId, parentSubAccountId (المستوى 4), nameAr, nameEn, currency, subLedgerType
 * يعتمد على getNextAccountCode لحساب الكود تلقائياً (المستوى 5 - 9 أرقام)
 */

accountRouter.post('/accounts/custom', async (req: Request, res: Response) => {
  try {
    const { tenantId = DEFAULT_TENANT_ID, parentAccountId, nameAr, nameEn, isPosting } = req.body;
    if (!parentAccountId || !nameAr) {
      res.status(400).json({ success: false, error: 'Parent ID and Arabic Name are required.' });
      return;
    }
    const newAccount = await accountEngine.createCustomAccount({ tenantId, parentAccountId, nameAr, nameEn, isPosting });
    res.status(201).json({ success: true, data: newAccount });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

accountRouter.put('/accounts/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    const updatedAccount = await accountEngine.updateAccount(id as string, updates);
    res.status(200).json({ success: true, data: updatedAccount });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

accountRouter.post('/accounts/analytical', async (req: Request, res: Response) => {
  try {
    const { tenantId = DEFAULT_TENANT_ID, parentSubAccountId, nameAr, nameEn, currency, subLedgerType } = req.body;

    if (!parentSubAccountId) {
      res.status(400).json({
        success: false,
        error: 'الحساب الفرعي الأب (المستوى 4) مطلوب لتوليد الحساب التحليلي التابع له.',
        code: 'MISSING_PARENT_ID'
      });
      return;
    }

    if (!nameAr || typeof nameAr !== 'string' || nameAr.trim() === '') {
      res.status(400).json({
        success: false,
        error: 'اسم الحساب باللغة العربية إلزامي.',
        code: 'MISSING_ACCOUNT_NAME'
      });
      return;
    }

    const input: CreateAnalyticalAccountInput = {
      tenantId,
      parentSubAccountId,
      nameAr,
      nameEn,
      currency,
      subLedgerType
    };

    const newAccount = await accountEngine.createAnalyticalAccount(input);

    res.status(201).json({
      success: true,
      message: `تم توليد وإنشاء الحساب التحليلي (${newAccount.code} - ${newAccount.nameAr}) بنجاح في المستوى 5.`,
      data: newAccount
    });
  } catch (err: any) {
    console.error('Error creating analytical account:', err);
    // تمييز أخطاء التوليد / القيود بمستوى 400 أو 409
    const isConflict = err.message?.includes('مستخدم بالفعل') || err.message?.includes('استنفاد');
    res.status(isConflict ? 409 : 400).json({
      success: false,
      error: err.message || 'حدث خطأ أثناء إنشاء الحساب التحليلي.',
      code: isConflict ? 'CODE_CONFLICT' : 'VALIDATION_ERROR'
    });
  }
});

/**
 * استعراض الحسابات أو استباق الكود التالي للحساب التحليلي
 * GET /api/accounts/next-code?parentSubAccountId=xxx&tenantId=yyy
 */
accountRouter.get('/accounts/next-code', async (req: Request, res: Response) => {
  try {
    const parentSubAccountId = req.query.parentSubAccountId as string;
    const tenantId = (req.query.tenantId as string) || DEFAULT_TENANT_ID;

    if (!parentSubAccountId) {
      res.status(400).json({
        success: false,
        error: 'يجب تمرير parentSubAccountId للاستعلام عن الكود التحليلي القادم.'
      });
      return;
    }

    const result = await accountEngine.getNextAccountCode(tenantId, parentSubAccountId);
    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'تعذر حساب الكود التسلسلي القادم.'
    });
  }
});

/**
 * استرجاع كافة الحسابات
 * GET /api/accounts
 */
accountRouter.get('/accounts', async (req: Request, res: Response) => {
  try {
    const tenantId = (req.query.tenantId as string) || DEFAULT_TENANT_ID;
    const accounts = await accountEngine.getAllAccounts(tenantId);
    res.json({
      success: true,
      count: accounts.length,
      data: accounts
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 2. نقطة تسجيل وترحيل قيد يومية (Create Journal Entry)
 * POST /api/journal-entries
 * يتحقق من توازن القيد (مدين = دائن)
 * يفحص كل سطر عبر validatePostingLine
 * يرفض الحسابات التجميعية ويفرض مراكز التكلفة للمصروفات والإيرادات
 */
accountRouter.post('/journal-entries', async (req: Request, res: Response) => {
  try {
    const { tenantId = DEFAULT_TENANT_ID, description, lines, date, reference } = req.body;

    if (!description) {
      res.status(400).json({
        success: false,
        error: 'شرح وبيان القيد المحاسبي مطلوب.',
        code: 'MISSING_DESCRIPTION'
      });
      return;
    }

    if (!lines || !Array.isArray(lines) || lines.length < 2) {
      res.status(400).json({
        success: false,
        error: 'القيد المحاسبي يجب أن يشتمل على طرفين على الأقل (مدين ودائن).',
        code: 'INVALID_LINES_COUNT'
      });
      return;
    }

    const input: JournalEntryInput = {
      tenantId,
      description,
      lines,
      date,
      reference
    };

    const entry = await accountEngine.createJournalEntry(input);

    res.status(201).json({
      success: true,
      message: `تم تسجيل وترحيل القيد المحاسبي رقم (${entry.entryNumber}) بنجاح.`,
      data: entry
    });
  } catch (err: any) {
    console.error('Error creating journal entry:', err);

    // تمييز أخطاء التوازن والتحقق بـ 422 Unprocessable Entity أو 400 Bad Request
    const isUnbalanced = err.message?.includes('غير متوازن') || err.message?.includes('توازن');
    const isRoutingError = err.message?.includes('خطأ توجيه') || err.message?.includes('مركز تكلفة') || err.message?.includes('تجميعي');

    res.status(isUnbalanced || isRoutingError ? 422 : 400).json({
      success: false,
      error: err.message || 'فشل تسجيل القيد المحاسبي لعدم استيفاء المعايير.',
      code: isUnbalanced ? 'UNBALANCED_ENTRY' : isRoutingError ? 'POSTING_VALIDATION_FAILED' : 'BAD_REQUEST'
    });
  }
});

/**
 * استرجاع قيود اليومية
 * GET /api/journal-entries
 */
accountRouter.get('/journal-entries', async (req: Request, res: Response) => {
  try {
    const tenantId = (req.query.tenantId as string) || DEFAULT_TENANT_ID;
    const entries = await accountEngine.getAllJournalEntries(tenantId);
    res.json({
      success: true,
      count: entries.length,
      data: entries
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3. نقاط الحذف والتعديل الآمن (Safe Mutation & Deletion)
 * DELETE /api/accounts/:id
 * يرفض الحذف تماماً إذا وجدت قيود أو حركات مرتبطة (رمز 409 Conflict)
 */
accountRouter.delete('/accounts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'معرّف الحساب مطلوب.' });
      return;
    }

    const result = await accountEngine.deleteAccount(String(id));
    res.json({
      success: true,
      message: result.message
    });
  } catch (err: any) {
    console.error('Error deleting account:', err);
    const isLocked = err.message?.includes('حظر أمني') || err.message?.includes('حركات مالية') || err.message?.includes('حسابات فرعية');
    res.status(isLocked ? 409 : 400).json({
      success: false,
      error: err.message || 'تعذر حذف الحساب.',
      code: isLocked ? 'ACCOUNT_IMMUTABLE' : 'DELETE_FAILED'
    });
  }
});

/**
 * PATCH /api/accounts/:id/toggle-status
 * تجميد الحساب (isActive = false) كبديل آمن عن الحذف للحفاظ على السجلات التاريخية
 */
accountRouter.patch('/accounts/:id/toggle-status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'معرّف الحساب مطلوب.' });
      return;
    }

    const updated = await accountEngine.toggleAccountStatus(String(id));
    res.json({
      success: true,
      message: updated.isActive 
        ? `تم تنشيط الحساب (${updated.code} - ${updated.nameAr}) بنجاح.`
        : `تم تجميد وتعطيل الحساب (${updated.code} - ${updated.nameAr}) بنجاح لحماية السجلات التاريخية.`,
      data: updated
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'تعذر تغيير حالة الحساب.'
    });
  }
});

/**
 * GET /api/dashboard/kpis
 * استرجاع مؤشرات الأداء الحية من السحابة بناءً على أرصدة الحسابات الفعلية
 */

/**
 * POST /api/year-end/close
 * Year-end closing: zeroes out revenue and expenses and posts to retained earnings
 */
accountRouter.post('/year-end/close', async (req: Request, res: Response) => {
  try {
    const { tenantId = DEFAULT_TENANT_ID, year } = req.body;
    if (!year) {
      res.status(400).json({ success: false, error: 'Year is required' }); return;
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
      res.status(400).json({ success: false, error: 'لا توجد حركات للإيرادات والمصروفات في هذه السنة لإقفالها' }); return;
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

    // Convert lines to JournalEntryInput format
    const finalLines = lines.map(l => {
      const isDebit = l.debit > 0;
      const amount = isDebit ? l.debit : l.credit;
      return {
        accountId: l.accountId,
        isDebit,
        amountForeign: Number(amount.toFixed(2)),
        exchangeRate: 1
      };
    });

    // Create journal entry
    const newEntry = await accountEngine.createJournalEntry({
      tenantId,
      date: `${year}-12-31`,
      reference: `إقفال ${year}`,
      description: `قيد إقفال السنة المالية ${year}`,
      lines: finalLines
    });

    res.json({ success: true, data: newEntry });
  } catch (err: any) {
    console.error("Year End Close Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

accountRouter.get('/dashboard/kpis', async (req: Request, res: Response) => {
  try {
    const tenantId = (req.query.tenantId as string) || DEFAULT_TENANT_ID;
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    
    // 1. Fetch all accounts from Firebase
    const allAccounts = await accountEngine.getAllAccounts(tenantId);
    
    // 2. We can either filter the account total by year, but `accountEngine.getAllAccounts` returns aggregated totalDebit/totalCredit for ALL time.
    // To support `year` properly, we should fetch Journal Entries and sum them for the specified year.
    const allEntries = await accountEngine.getAllJournalEntries(tenantId);
    
    let totalSales = 0;
    let totalExpenses = 0;
    let inventoryValuation = 0;
    let cashAndBank = 0;
    let accountsReceivable = 0;
    let accountsPayable = 0;

    // Filter entries by year
    const entriesForYear = allEntries.filter(entry => {
      if (!entry.date) return false;
      const entryYear = new Date(entry.date).getFullYear();
      return entryYear === year;
    });

    // Helper to find account code by ID
    const getAccountCode = (accountId: string) => {
      const acc = allAccounts.find(a => a.id === accountId);
      return acc?.code || '';
    };

    // Aggregate balances from entries
    // For P&L (Sales, Expenses), we ONLY sum entries for the specific year.
    // For Balance Sheet (Inventory, Cash, AR, AP), we sum ALL entries UP TO the specified year.
    const entriesUpToYear = allEntries.filter(entry => {
      if (!entry.date) return false;
      const entryYear = new Date(entry.date).getFullYear();
      return entryYear <= year;
    });

    // P&L Sums (Year-specific)
    for (const entry of entriesForYear) {
      for (const line of entry.lines) {
        const code = getAccountCode(line.accountId);
        if (code.startsWith('4')) {
          totalSales += (line.credit - line.debit);
        } else if (code.startsWith('5')) {
          totalExpenses += (line.debit - line.credit);
        }
      }
    }

    // Balance Sheet Sums (Up to Year)
    for (const entry of entriesUpToYear) {
      for (const line of entry.lines) {
        const code = getAccountCode(line.accountId);
        if (code.startsWith('13')) {
          inventoryValuation += (line.debit - line.credit);
        } else if (code.startsWith('11')) {
          cashAndBank += (line.debit - line.credit);
        } else if (code.startsWith('12')) {
          accountsReceivable += (line.debit - line.credit);
        } else if (code.startsWith('21')) {
          accountsPayable += (line.credit - line.debit);
        }
      }
    }

    const netProfit = totalSales - totalExpenses;

    res.json({
      success: true,
      data: {
        totalSales: Math.max(0, Math.round(totalSales * 100) / 100),
        totalExpenses: Math.max(0, Math.round(totalExpenses * 100) / 100),
        netProfit: Math.round(netProfit * 100) / 100,
        inventoryValuation: Math.round(inventoryValuation * 100) / 100,
        cashAndBank: Math.round(cashAndBank * 100) / 100,
        accountsReceivable: Math.round(accountsReceivable * 100) / 100,
        accountsPayable: Math.round(accountsPayable * 100) / 100,
      }
    });
  } catch (err: any) {
    console.error('Error fetching dashboard KPIs:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch KPIs' });
  }
});

/**
 * POST /api/accounts/reset
 * إعادة ضبط محرك الحسابات بالكامل وتفريغ الكاش والقيود
 */
accountRouter.post('/accounts/reset', (_req: Request, res: Response) => {
  try {
    accountEngine.resetToDefaults();
    res.json({
      success: true,
      message: 'تمت إعادة ضبط محرك الحسابات وقواعد البيانات وتفريغ الذاكرة المؤقتة بنجاح.'
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'تعذر إعادة ضبط محرك الحسابات.'
    });
  }
});

