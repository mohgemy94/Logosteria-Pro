import { accountEngine, AccountRecord } from './accountEngine';
import { appCache } from './cacheService';

export interface AccountTreeNode {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string | undefined;
  level: number;
  isPosting: boolean;
  isActive: boolean;
  type: string;
  subLedgerType: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  children: AccountTreeNode[];
}

export interface RollupBalanceResult {
  accountCode: string;
  accountNameAr: string;
  level: number;
  total_debit: number;
  total_credit: number;
  net_balance: number;
  affectedAccountsCount: number;
}

export class AccountRollupService {
  /**
   * جلب الأبناء والأحفاد تكرارياً لحساب معين
   */
  private getAllDescendantIds(allAccounts: AccountRecord[], parentId: string): string[] {
    const directChildren = allAccounts.filter(a => a.parentAccountId === parentId);
    let ids: string[] = [parentId];
    for (const child of directChildren) {
      ids = ids.concat(this.getAllDescendantIds(allAccounts, child.id));
    }
    return ids;
  }

  /**
   * تجميع أرصدة الحساب التحليلي وحسابات آبائه حتى المستوى الأول
   * بمحاكاة دقيقة لاستعلام الـ Recursive CTE مع كاش سريع (TTL: 60s أو Event-driven)
   */
  async getAggregatedSubAccountBalance(tenantId: string, accountCode: string): Promise<RollupBalanceResult> {
    const cacheKey = `rollup:${tenantId}:${accountCode}`;
    const cached = appCache.get<RollupBalanceResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const allAccounts = await accountEngine.getAllAccounts(tenantId);
    const targetAccount = allAccounts.find(a => a.code === accountCode || a.id === accountCode);
    if (!targetAccount) {
      throw new Error(`الحساب المالي ذو الكود (${accountCode}) غير موجود.`);
    }

    // جلب كل المعرّفات التابعة لهذا الحساب في الهيكل الشجري
    const descendantIds = this.getAllDescendantIds(allAccounts, targetAccount.id);

    let totalDebit = 0;
    let totalCredit = 0;

    // Accounts collection already tracks direct movements per account
    for (const acc of allAccounts) {
      if (descendantIds.includes(acc.id)) {
        totalDebit += (acc.totalDebit || 0);
        totalCredit += (acc.totalCredit || 0);
      }
    }

    totalDebit = Math.round(totalDebit * 100) / 100;
    totalCredit = Math.round(totalCredit * 100) / 100;
    const netBalance = Math.round((totalDebit - totalCredit) * 100) / 100;

    const result: RollupBalanceResult = {
      accountCode: targetAccount.code,
      accountNameAr: targetAccount.nameAr,
      level: targetAccount.level,
      total_debit: totalDebit,
      total_credit: totalCredit,
      net_balance: netBalance,
      affectedAccountsCount: descendantIds.length,
    };

    // حفظ في الكاش لمدة 5 دقائق (أو حتى يبطله حدث ترحيل قيد)
    appCache.set(cacheKey, result, 300_000);
    return result;
  }

  /**
   * حساب الأرصدة الشجرية التكرارية وحساب مجاميع الآباء صعوداً
   */
  private calculateSubtreeBalances(node: AccountTreeNode, accountBalances: Map<string, { debit: number; credit: number }>): { debit: number; credit: number } {
    let selfDebit = 0;
    let selfCredit = 0;

    // رصيد الحركات المباشرة على الحساب إن وجدت
    if (accountBalances.has(node.id)) {
      const b = accountBalances.get(node.id)!;
      selfDebit += b.debit;
      selfCredit += b.credit;
    }

    // تجميع أرصدة الأبناء صعوداً
    for (const child of node.children) {
      const childTotals = this.calculateSubtreeBalances(child, accountBalances);
      selfDebit += childTotals.debit;
      selfCredit += childTotals.credit;
    }

    node.totalDebit = Math.round(selfDebit * 100) / 100;
    node.totalCredit = Math.round(selfCredit * 100) / 100;
    node.balance = Math.round((selfDebit - selfCredit) * 100) / 100;

    return { debit: selfDebit, credit: selfCredit };
  }

  /**
   * بناء شجرة الحسابات المالية بالكامل بصيغة شجرية هرمية مجهزة للواجهات (Nested Tree View)
   * مدعومة بـ In-Memory Cache فائق السرعة مع إبطال فوري عند حدوث تعديل
   */
  async getFullChartTree(tenantId: string): Promise<AccountTreeNode[]> {
    const cacheKey = `chart_tree:${tenantId}`;
    const cached = appCache.get<AccountTreeNode[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const allAccounts = await accountEngine.getAllAccounts(tenantId);
    const activeAccounts = allAccounts.filter(a => a.isActive);

    const accountBalances = new Map<string, { debit: number; credit: number }>();
    for (const acc of activeAccounts) {
      if (acc.totalDebit > 0 || acc.totalCredit > 0) {
        accountBalances.set(acc.id, { debit: acc.totalDebit, credit: acc.totalCredit });
      }
    }

    const accountMap = new Map<string, AccountTreeNode>();
    activeAccounts.forEach((acc) => {
      accountMap.set(acc.id, {
        id: acc.id,
        code: acc.code,
        nameAr: acc.nameAr,
        nameEn: acc.nameEn,
        level: acc.level,
        isPosting: acc.isPosting,
        isActive: acc.isActive,
        type: acc.type,
        subLedgerType: acc.subLedgerType,
        totalDebit: 0,
        totalCredit: 0,
        balance: 0,
        children: [],
      });
    });

    const rootNodes: AccountTreeNode[] = [];
    activeAccounts.forEach((acc) => {
      const currentNode = accountMap.get(acc.id)!;
      if (acc.parentAccountId && accountMap.has(acc.parentAccountId)) {
        const parentNode = accountMap.get(acc.parentAccountId)!;
        parentNode.children.push(currentNode);
      } else {
        rootNodes.push(currentNode);
      }
    });

    // فرز الأبناء حسب الكود تصاعدياً
    const sortTree = (nodes: AccountTreeNode[]) => {
      nodes.sort((a, b) => a.code.localeCompare(b.code));
      nodes.forEach(n => sortTree(n.children));
    };
    sortTree(rootNodes);

    // حساب الأرصدة التجميعية التراكمية لكل عقدة من الأسفل للأعلى (Recursive Rollup)
    for (const root of rootNodes) {
      this.calculateSubtreeBalances(root, accountBalances);
    }

    // حفظ في الكاش لمدة 10 دقائق (أو حتى يبطله حدث إضافة حساب أو قيد جديد)
    appCache.set(cacheKey, rootNodes, 600_000);
    return rootNodes;
  }
}

export const accountRollupService = new AccountRollupService();
