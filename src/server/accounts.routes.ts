// src/server/accounts.routes.ts
import { Router, Request, Response } from 'express';
import { accountRollupService } from './accountRollupService';
import { appCache } from './cacheService';

export const accountsTreeRouter = Router();
const DEFAULT_TENANT_ID = 'tenant_default';

/**
 * 1. مسار إرجاع شجرة الحسابات المتداخلة بالكامل مع الأرصدة المجمعة صعوداً
 * GET /api/accounts/chart-tree
 */
accountsTreeRouter.get('/accounts/chart-tree', async (req: Request, res: Response) => {
  try {
    const tenantId = (req.query.tenantId as string) || DEFAULT_TENANT_ID;
    const tree = await accountRollupService.getFullChartTree(tenantId);

    res.status(200).json({
      success: true,
      count: tree.length,
      data: tree
    });
  } catch (err: any) {
    console.error('Error fetching chart of accounts tree:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'حدث خطأ غير متوقع أثناء بناء شجرة الحسابات المالية.',
      code: 'CHART_TREE_ERROR'
    });
  }
});

/**
 * 2. مسار تجميع رصيد الحساب وأبنائه حتى المستوى الأول
 * GET /api/accounts/:code/rollup-balance
 */
accountsTreeRouter.get('/accounts/:code/rollup-balance', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const tenantId = (req.query.tenantId as string) || DEFAULT_TENANT_ID;

    if (!code) {
      res.status(400).json({
        success: false,
        error: 'كود أو معرّف الحساب مطلوب لجلب الرصيد التجميعي.',
        code: 'MISSING_ACCOUNT_CODE'
      });
      return;
    }

    const rollupData = await accountRollupService.getAggregatedSubAccountBalance(tenantId, String(code));

    res.status(200).json({
      success: true,
      data: rollupData
    });
  } catch (err: any) {
    console.error(`Error calculating rollup balance for account ${req.params.code}:`, err);
    const isNotFound = err.message?.includes('غير موجود');
    res.status(isNotFound ? 404 : 400).json({
      success: false,
      error: err.message || 'فشل في استخراج الرصيد التراكمي المجمع للحساب.',
      code: isNotFound ? 'ACCOUNT_NOT_FOUND' : 'ROLLUP_CALCULATION_ERROR'
    });
  }
});

/**
 * 3. استعلام إحصائيات الذاكرة المؤقتة (In-Memory Cache Stats)
 * GET /api/accounts/cache-stats
 */
accountsTreeRouter.get('/accounts/cache-stats', (_req: Request, res: Response) => {
  const stats = appCache.getStats();
  res.status(200).json({
    success: true,
    data: stats
  });
});

/**
 * 4. تفريغ يدوي للذاكرة المؤقتة لشجرة الحسابات (Manual Cache Purge)
 * POST /api/accounts/cache-clear
 */
accountsTreeRouter.post('/accounts/cache-clear', (req: Request, res: Response) => {
  const tenantId = (req.body?.tenantId as string) || (req.query.tenantId as string) || DEFAULT_TENANT_ID;
  const purgedTreeCount = appCache.invalidatePrefix(`chart_tree:${tenantId}`);
  const purgedRollupCount = appCache.invalidatePrefix(`rollup:${tenantId}`);

  res.status(200).json({
    success: true,
    message: `تم تفريغ الذاكرة المؤقتة (Cache) بنجاح لـ (${tenantId}).`,
    purged: {
      treeKeys: purgedTreeCount,
      rollupKeys: purgedRollupCount
    }
  });
});
