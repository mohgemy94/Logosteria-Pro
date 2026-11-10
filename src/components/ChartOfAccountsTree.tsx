import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  FileCode2, 
  Layers, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Building2, 
  BarChart3, 
  X,
  Loader2,
  Trash2,
  Plus,
  Edit2,
  Database,
  Mic,
  MicOff,
  Scale,
  ShieldAlert,
  AlertTriangle,
  Power,
  Lock,
  Ban,
  Check,
  Info,
  BookOpen,
  ShieldCheck,
  HelpCircle,
  Coins,
  Undo2,
  Redo2,
  History,
  Link2
} from 'lucide-react';
import ErpAccountMappingModal from './ErpAccountMappingModal';
import { getAccountLinkedModules } from '../utils/accountingIntegration';
import { exportElementToPdf } from '../utils/pdfExport';
import { loadChartOfAccounts, saveChartOfAccounts, calculateTrialBalance } from '../utils/trialBalanceStore';
import { navigateToAccountMovements } from '../utils/accountMovementsStore';
import { Account, AccountType, BalanceType } from '../types/accounting';
import ExportButtonGroup from './ExportButtonGroup';
import { useSystemCurrency } from '../utils/currency';
import {
  isSystemRootAccount,
  checkAccountHasTransactions,
  canDeleteAccount,
  deleteAccountSafely,
  deleteAccount,
  toggleAccountActiveStatus,
  updateAccountSafely
} from '../utils/accountGovernance';

export { deleteAccount };
import {
  undoLastAccountAction,
  redoLastAccountAction,
  recordAccountAction,
  getLastUndoAction,
  getLastRedoAction,
  getUndoStack,
  getRedoStack,
  AccountHistoryAction
} from '../utils/accountHistoryStore';

export interface AccountTreeNode {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  level: number;
  isPosting: boolean;
  isActive: boolean;
  isSystemLocked?: boolean;
  type: string;
  assetClassification?: 'CURRENT' | 'NON_CURRENT';
  subLedgerType: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  children: AccountTreeNode[];
}


// المستوى 2: التصنيفات العامة الافتراضية
export const SYSTEM_LEVEL2_DEFS = [
  { id: 'acc_11', code: '11', parentCode: '1', nameAr: 'الأصول المتداولة', nameEn: 'Current Assets', type: 'ASSET' },
  { id: 'acc_12', code: '12', parentCode: '1', nameAr: 'الأصول غير المتداولة (الثابتة)', nameEn: 'Fixed Assets', type: 'ASSET' },
  { id: 'acc_21', code: '21', parentCode: '2', nameAr: 'الخصوم المتداولة', nameEn: 'Current Liabilities', type: 'LIABILITY' },
  { id: 'acc_22', code: '22', parentCode: '2', nameAr: 'الخصوم غير المتداولة', nameEn: 'Non-Current Liabilities', type: 'LIABILITY' },
  { id: 'acc_31', code: '31', parentCode: '3', nameAr: 'رأس المال', nameEn: 'Capital', type: 'EQUITY' },
  { id: 'acc_32', code: '32', parentCode: '3', nameAr: 'الأرباح والاحتياطيات', nameEn: 'Retained Earnings & Reserves', type: 'EQUITY' },
  { id: 'acc_41', code: '41', parentCode: '4', nameAr: 'إيرادات النشاط والمبيعات', nameEn: 'Operating Revenue', type: 'REVENUE' },
  { id: 'acc_42', code: '42', parentCode: '4', nameAr: 'إيرادات متنوعة وأرباح أخرى', nameEn: 'Other Income', type: 'REVENUE' },
  { id: 'acc_51', code: '51', parentCode: '5', nameAr: 'تكاليف النشاط والتشغيل', nameEn: 'Operating Expenses & COGS', type: 'EXPENSE' },
  { id: 'acc_52', code: '52', parentCode: '5', nameAr: 'المصروفات الإدارية والعمومية', nameEn: 'General & Admin Expenses', type: 'EXPENSE' },
];

// المستوى 3: الحسابات المساعدة الافتراضية (تشمل الترقيم المحلي والسحابي لضمان الربط التام)
export const SYSTEM_LEVEL3_DEFS = [
  // أصول متداولة
  { id: 'acc_110', code: '110', parentCode: '11', nameAr: 'النقدية بالبنوك والصناديق وما في حكمها', nameEn: 'Cash & Bank Equivalents', type: 'ASSET' },
  { id: 'acc_111', code: '111', parentCode: '11', nameAr: 'النقدية وما في حكمها', nameEn: 'Cash & Equivalents', type: 'ASSET' },
  { id: 'acc_120', code: '120', parentCode: '11', nameAr: 'العملاء والذمم المدينة التجارية', nameEn: 'Trade Debtors', type: 'ASSET' },
  { id: 'acc_112', code: '112', parentCode: '11', nameAr: 'العملاء والذمم المدينة', nameEn: 'Accounts Receivable', type: 'ASSET' },
  { id: 'acc_130', code: '130', parentCode: '11', nameAr: 'المخزون السلعي والمواد', nameEn: 'Inventory', type: 'ASSET' },
  { id: 'acc_113', code: '113', parentCode: '11', nameAr: 'المخزون السلعي', nameEn: 'Inventory', type: 'ASSET' },
  // أصول ثابتة
  { id: 'acc_140', code: '140', parentCode: '12', nameAr: 'الآلات والمعدات والأصول الرأسمالية', nameEn: 'Fixed Assets & Machinery', type: 'ASSET' },
  { id: 'acc_121', code: '121', parentCode: '12', nameAr: 'الأصول الثابتة الملموسة', nameEn: 'Tangible Fixed Assets', type: 'ASSET' },
  // خصوم متداولة
  { id: 'acc_210', code: '210', parentCode: '21', nameAr: 'الموردون وحسابات الدائنين التجارية', nameEn: 'Trade Creditors', type: 'LIABILITY' },
  { id: 'acc_211', code: '211', parentCode: '21', nameAr: 'الموردين والذمم الدائنة', nameEn: 'Trade Payables', type: 'LIABILITY' },
  { id: 'acc_212', code: '212', parentCode: '21', nameAr: 'الالتزامات والضرائب المستحقة', nameEn: 'Accrued Liabilities & Taxes', type: 'LIABILITY' },
  // خصوم غير متداولة
  { id: 'acc_220', code: '220', parentCode: '22', nameAr: 'الالتزامات طويلة الأجل والقروض', nameEn: 'Long-term Obligations', type: 'LIABILITY' },
  { id: 'acc_221', code: '221', parentCode: '22', nameAr: 'التزامات وقروض طويلة الأجل', nameEn: 'Long-term Loans', type: 'LIABILITY' },
  // حقوق ملكية
  { id: 'acc_310', code: '310', parentCode: '31', nameAr: 'رأس المال المباشر المدفوع', nameEn: 'Paid Capital', type: 'EQUITY' },
  { id: 'acc_311', code: '311', parentCode: '31', nameAr: 'رأس المال المدفوع', nameEn: 'Paid Capital', type: 'EQUITY' },
  { id: 'acc_320', code: '320', parentCode: '32', nameAr: 'الأرباح والخسائر المدورة والاحتياطيات', nameEn: 'Retained Earnings & Reserves', type: 'EQUITY' },
  { id: 'acc_321', code: '321', parentCode: '32', nameAr: 'الأرباح والخسائر المدورة', nameEn: 'Retained Earnings', type: 'EQUITY' },
  // إيرادات
  { id: 'acc_410', code: '410', parentCode: '41', nameAr: 'إيرادات المبيعات والخدمات', nameEn: 'Sales Revenue', type: 'REVENUE' },
  { id: 'acc_411', code: '411', parentCode: '41', nameAr: 'إيرادات المبيعات والخدمات', nameEn: 'Sales Revenue', type: 'REVENUE' },
  { id: 'acc_420', code: '420', parentCode: '42', nameAr: 'إيرادات وأرباح متنوعة أخرى', nameEn: 'Other Miscellaneous Income', type: 'REVENUE' },
  { id: 'acc_421', code: '421', parentCode: '42', nameAr: 'إيرادات وأرباح أخرى', nameEn: 'Other Income', type: 'REVENUE' },
  // مصروفات
  { id: 'acc_510', code: '510', parentCode: '51', nameAr: 'تكاليف ومصروفات التشغيل', nameEn: 'Operating Costs', type: 'EXPENSE' },
  { id: 'acc_511', code: '511', parentCode: '51', nameAr: 'تكلفة المبيعات والبضاعة المباعة', nameEn: 'Cost of Goods Sold', type: 'EXPENSE' },
  { id: 'acc_521', code: '521', parentCode: '52', nameAr: 'المصروفات العمومية والإدارية', nameEn: 'General & Admin Expenses', type: 'EXPENSE' },
];

/**
 * محرك بناء شجرة الحسابات المالية التراكمية محلياً (5 مستويات هرمية كاملة)
 * يضمن تشغيل شجرة الحسابات فوراً دون الحاجة إلى خادم خارجي أو عند غياب اتصال الشبكة
 */
export function buildLocalChartTree(): AccountTreeNode[] {
  const accounts = loadChartOfAccounts();
  const tb = calculateTrialBalance();

  const actualAccountIds = new Set(accounts.map(a => a.id));
  const actualAccountCodes = new Set(accounts.map(a => a.code));

  const balanceMap = new Map<string, { debit: number; credit: number }>();
  tb.rows.forEach(r => {
    const debit = Number((r as any).totalDebit ?? (r as any).debitMovement ?? 0);
    const credit = Number((r as any).totalCredit ?? (r as any).creditMovement ?? 0);
    balanceMap.set(r.account.id, { debit, credit });
    balanceMap.set(r.account.code, { debit, credit });
  });

  // المستوى 1: الحسابات الرئيسية الخمسة
  const level1Nodes: AccountTreeNode[] = [
    { id: 'acc_1', code: '1', nameAr: 'الأصول', nameEn: 'Assets', level: 1, isPosting: false, isActive: true, isSystemLocked: true, type: 'ASSET', subLedgerType: 'NONE', totalDebit: 0, totalCredit: 0, balance: 0, children: [] },
    { id: 'acc_2', code: '2', nameAr: 'الخصوم والالتزامات', nameEn: 'Liabilities', level: 1, isPosting: false, isActive: true, isSystemLocked: true, type: 'LIABILITY', subLedgerType: 'NONE', totalDebit: 0, totalCredit: 0, balance: 0, children: [] },
    { id: 'acc_3', code: '3', nameAr: 'حقوق الملكية', nameEn: 'Equity', level: 1, isPosting: false, isActive: true, isSystemLocked: true, type: 'EQUITY', subLedgerType: 'NONE', totalDebit: 0, totalCredit: 0, balance: 0, children: [] },
    { id: 'acc_4', code: '4', nameAr: 'الإيرادات', nameEn: 'Revenue', level: 1, isPosting: false, isActive: true, isSystemLocked: true, type: 'REVENUE', subLedgerType: 'NONE', totalDebit: 0, totalCredit: 0, balance: 0, children: [] },
    { id: 'acc_5', code: '5', nameAr: 'المصروفات', nameEn: 'Expenses', level: 1, isPosting: false, isActive: true, isSystemLocked: true, type: 'EXPENSE', subLedgerType: 'NONE', totalDebit: 0, totalCredit: 0, balance: 0, children: [] },
  ];

  const nodeMap = new Map<string, AccountTreeNode>();

  // خريطة المستوى 1
  level1Nodes.forEach(n => {
    nodeMap.set(n.code, n);
    nodeMap.set(n.id, n);
  });

  // إضافة المستوى 2 وربطه بالمستوى 1 (مع تخطي أي عقدة إذا كان المستخدم قد أنشأ أو خصص حساباً فعلياً بنفس الكود)
  SYSTEM_LEVEL2_DEFS.forEach(def => {
    if (actualAccountCodes.has(def.code)) return;
    const node: AccountTreeNode = {
      id: def.id,
      code: def.code,
      nameAr: def.nameAr,
      nameEn: def.nameEn,
      level: 2,
      isPosting: false,
      isActive: true,
      isSystemLocked: true,
      type: def.type,
      assetClassification: def.code === '11' ? 'CURRENT' : def.code === '12' ? 'NON_CURRENT' : undefined,
      subLedgerType: 'NONE',
      totalDebit: 0,
      totalCredit: 0,
      balance: 0,
      children: []
    };
    nodeMap.set(def.code, node);
    nodeMap.set(def.id, node);
    const parent = nodeMap.get(def.parentCode);
    if (parent) {
      parent.children.push(node);
    }
  });

  // إضافة المستوى 3 وربطه بالمستوى 2 (مع إعطاء الأولوية التامة لحساب المستخدم الفعلي وتخطي العقدة الافتراضية إن وجدت)
  SYSTEM_LEVEL3_DEFS.forEach(def => {
    if (actualAccountCodes.has(def.code)) return;
    const node: AccountTreeNode = {
      id: def.id,
      code: def.code,
      nameAr: def.nameAr,
      nameEn: def.nameEn,
      level: 3,
      isPosting: false,
      isActive: true,
      isSystemLocked: isSystemRootAccount(def.code, 3),
      type: def.type,
      assetClassification: def.parentCode === '11' ? 'CURRENT' : def.parentCode === '12' ? 'NON_CURRENT' : undefined,
      subLedgerType: 'NONE',
      totalDebit: 0,
      totalCredit: 0,
      balance: 0,
      children: []
    };
    nodeMap.set(def.code, node);
    nodeMap.set(def.id, node);
    const parent = nodeMap.get(def.parentCode);
    if (parent) {
      parent.children.push(node);
    }
  });

  // معالجة حسابات دليل الحسابات الفعلي (المستويات 3 و 4 و 5 وكافة الحسابات المضافة)
  const sortedAccounts = [...accounts].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  // المرحلة الأولى: إنشاء كافة العقد وتسجيلها في خريطة العقد nodeMap
  const accountNodeList: { acc: Account; node: AccountTreeNode }[] = [];

  sortedAccounts.forEach(acc => {
    const movements = balanceMap.get(acc.id) || balanceMap.get(acc.code) || { debit: 0, credit: 0 };
    const codeLen = acc.code.length;
    let level = acc.level || 4;
    if (!acc.level) {
      if (codeLen <= 1) level = 1;
      else if (codeLen === 2) level = 2;
      else if (codeLen === 3) level = 3;
      else if (codeLen === 4) level = 4;
      else level = 5;
    }

    let subLedgerType = 'NONE';
    if (acc.isControlAccount && acc.controlType === 'CUSTOMER') subLedgerType = 'CUSTOMER';
    else if (acc.isControlAccount && acc.controlType === 'VENDOR') subLedgerType = 'VENDOR';

    const isCreditNormal = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(String(acc.type || '').toUpperCase());
    const debitVal = Math.round(movements.debit * 100) / 100;
    const creditVal = Math.round(movements.credit * 100) / 100;
    const netBal = isCreditNormal 
      ? Math.round((creditVal - debitVal) * 100) / 100
      : Math.round((debitVal - creditVal) * 100) / 100;

    let assetClass: 'CURRENT' | 'NON_CURRENT' | undefined = acc.assetClassification;
    if (!assetClass && String(acc.type || '').toUpperCase() === 'ASSET') {
      if (
        acc.code.startsWith('12') || 
        acc.code.startsWith('14') || 
        acc.parentId === '12' || 
        acc.parentId === 'acc_12' ||
        acc.parentId === '140' ||
        acc.parentId === '121'
      ) {
        assetClass = 'NON_CURRENT';
      } else {
        assetClass = 'CURRENT';
      }
    }

    const isPostingAccount = typeof acc.isPosting === 'boolean'
      ? acc.isPosting
      : (level >= 3);

    const node: AccountTreeNode = {
      id: acc.id,
      code: acc.code,
      nameAr: acc.name,
      nameEn: (acc as any).nameEn || undefined,
      level,
      isPosting: isPostingAccount,
      isActive: acc.isActive !== false,
      isSystemLocked: isSystemRootAccount(acc.code, level),
      type: String(acc.type || 'ASSET').toUpperCase(),
      assetClassification: assetClass,
      subLedgerType,
      totalDebit: debitVal,
      totalCredit: creditVal,
      balance: netBal,
      children: []
    };

    nodeMap.set(acc.code, node);
    nodeMap.set(acc.id, node);
    accountNodeList.push({ acc, node });
  });

  // المرحلة الثانية: ربط كل حساب بالأب الهرمي المناسب بدقة تامة وضمان عدم ضياع أي حساب
  accountNodeList.forEach(({ acc, node }) => {
    let parentNode: AccountTreeNode | undefined;

    // 1. فحص معرف الأب المحدد صراحة acc.parentId (بالـ ID أو بالكود)
    if (acc.parentId) {
      parentNode = nodeMap.get(acc.parentId);
      if (!parentNode) {
        const pAcc = accounts.find(a => a.id === acc.parentId || a.code === acc.parentId);
        if (pAcc) {
          parentNode = nodeMap.get(pAcc.code) || nodeMap.get(pAcc.id);
        }
      }
    }

    // 2. البحث الذكي عبر أطول بادئة كود مطابقة (Code Prefix Matching)
    if (!parentNode && acc.code.length > 4) {
      parentNode = nodeMap.get(acc.code.slice(0, 4));
    }
    if (!parentNode && acc.code.length >= 4) {
      parentNode = nodeMap.get(acc.code.slice(0, 3));
    }
    if (!parentNode && acc.code.length >= 3) {
      parentNode = nodeMap.get(acc.code.slice(0, 2));
    }
    if (!parentNode && acc.code.length >= 2) {
      parentNode = nodeMap.get(acc.code.slice(0, 1));
    }

    // 3. التوجيه الاحتياطي الآمن حسب طبيعة الحساب والتصنيف
    if (!parentNode) {
      if (node.type === 'ASSET') {
        parentNode = node.assetClassification === 'NON_CURRENT'
          ? (nodeMap.get('12') || nodeMap.get('acc_12') || nodeMap.get('1'))
          : (nodeMap.get('11') || nodeMap.get('acc_11') || nodeMap.get('1'));
      } else if (node.type === 'LIABILITY') {
        parentNode = nodeMap.get('21') || nodeMap.get('acc_21') || nodeMap.get('2');
      } else if (node.type === 'EQUITY') {
        parentNode = nodeMap.get('31') || nodeMap.get('acc_31') || nodeMap.get('3');
      } else if (node.type === 'REVENUE') {
        parentNode = nodeMap.get('41') || nodeMap.get('acc_41') || nodeMap.get('4');
      } else if (node.type === 'EXPENSE') {
        parentNode = nodeMap.get('51') || nodeMap.get('acc_51') || nodeMap.get('5');
      }
    }

    // 4. الحصن الأخير: ربط الحساب بالعقدة الرئيسية للمستوى 1 منعاً لفقدانه نهائياً
    if (!parentNode) {
      const root1 = nodeMap.get('1');
      const root2 = nodeMap.get('2');
      const root3 = nodeMap.get('3');
      const root4 = nodeMap.get('4');
      const root5 = nodeMap.get('5');
      if (node.type === 'ASSET') parentNode = root1;
      else if (node.type === 'LIABILITY') parentNode = root2;
      else if (node.type === 'EQUITY') parentNode = root3;
      else if (node.type === 'REVENUE') parentNode = root4;
      else if (node.type === 'EXPENSE') parentNode = root5;
      else parentNode = root1;
    }

    if (parentNode && parentNode !== node) {
      const existingChildIndex = parentNode.children.findIndex(c => c.id === node.id || c.code === node.code);
      if (existingChildIndex >= 0) {
        const existingChild = parentNode.children[existingChildIndex]!;
        // إذا كان الابن الموجود هو عقدة نظامية افتراضية بينما هذه العقدة هي حساب المستخدم الفعلي، نستبدلها وننقل أبناءها
        if (!actualAccountIds.has(existingChild.id)) {
          node.children = [...existingChild.children];
          parentNode.children[existingChildIndex] = node;
        }
      } else {
        parentNode.children.push(node);
      }
    }
  });

  // التجميع التراكمي الصاعد (Hierarchical Rollup CTE)
  function rollupBalances(n: AccountTreeNode) {
    let childDebit = 0;
    let childCredit = 0;
    for (const child of n.children) {
      rollupBalances(child);
      childDebit += child.totalDebit;
      childCredit += child.totalCredit;
    }
    if (n.children.length > 0) {
      // القاعدة الذهبية 1: بمجرد وجود أبناء يتحول الحساب فوراً إلى تجميعي لا يقبل قيود مباشرة
      n.isPosting = false;
      n.totalDebit = Math.round((n.totalDebit + childDebit) * 100) / 100;
      n.totalCredit = Math.round((n.totalCredit + childCredit) * 100) / 100;
      const isCreditNormal = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(n.type);
      n.balance = isCreditNormal
        ? Math.round((n.totalCredit - n.totalDebit) * 100) / 100
        : Math.round((n.totalDebit - n.totalCredit) * 100) / 100;
    } else {
      // القاعدة الذهبية 2: العقدة الطرفية (Leaf Node) بلا أبناء تتحول تلقائياً إلى حركية تقبل القيود (isPosting = true)
      if (n.level >= 3) {
        n.isPosting = true; // تحويله تلقائياً إلى حركي يقبل القيود (Leaf Node)
      } else {
        n.isPosting = false; // المستويات 1 و 2 جذور عامة مقدسة
      }
    }
  }

  // فرز الأبناء تصاعدياً بحسب الكود
  function sortNodes(nodes: AccountTreeNode[]) {
    nodes.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    nodes.forEach(child => sortNodes(child.children));
  }

  // تنقية العقد المساعدة الفارغة التي ليس لها أبناء ولا حركات
  function pruneEmptyNodes(nodes: AccountTreeNode[]): AccountTreeNode[] {
    nodes.forEach(n => {
      if (n.children && n.children.length > 0) {
        n.children = pruneEmptyNodes(n.children);
      }
    });
    return nodes.filter(n => {
      // 1. لا تحذف أبداً أي حساب موجود في دليل الحسابات الفعلي (حسابات المستخدم أو الافتراضية)
      if (actualAccountIds.has(n.id) || actualAccountCodes.has(n.code)) {
        return true;
      }
      // 2. الحسابات الأساسية للمستويات 1 و 2 دائمة الوجود في الهيكل
      if (n.level === 1 || n.level === 2) {
        return true;
      }
      // 3. الحسابات المساعدة الوسيطة (المستوى 3) تبقى إذا كان لها أبناء أو رصيد أو حركات
      if (n.level === 3) {
        return (n.children && n.children.length > 0) || n.balance !== 0 || n.totalDebit !== 0 || n.totalCredit !== 0;
      }
      // 4. أي عقد أخرى
      return (n.children && n.children.length > 0) || n.isPosting || n.balance !== 0 || n.totalDebit !== 0 || n.totalCredit !== 0;
    });
  }

  level1Nodes.forEach(root => rollupBalances(root));
  sortNodes(level1Nodes);
  level1Nodes.forEach(root => {
    root.children = pruneEmptyNodes(root.children);
  });

  return level1Nodes;
}

interface RollupModalData {
  accountCode: string;
  accountNameAr: string;
  level: number;
  total_debit: number;
  total_credit: number;
  net_balance: number;
  affectedAccountsCount: number;
}

// شارات التمييز حسب المستوى المحاسبي الـ 5 المعتمد
// القاعدة: الحساب الحركي الطرفي (isPosting) دائماً أخضر أياً كان مستواه.
// الحسابات التجميعية حسب المستوى: مستوى 1 أزرق، مستوى 2 رمادي غامق، مستوى 3 وردي، مستوى 4 أصفر
export const getLevelBadge = (level: number, isPosting: boolean, hasChildren: boolean) => {
  // الحساب الحركي الطرفي دائماً أخضر أياً كان مستواه
  if (isPosting && !hasChildren) {
    return (
      <span className="px-2.5 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 border shadow-xs bg-emerald-50 text-emerald-800 border-emerald-300" title={`المستوى ${level}: حساب حركي طرفي يقبل القيود (Leaf Node)`}>
        <CheckCircle2 size={12} className="text-emerald-600" />
        حركي طرفي • يقبل القيود
      </span>
    );
  }

  switch (level) {
    case 1:
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-blue-700 text-white shadow-xs border border-blue-800 flex items-center gap-1" title="المستوى 1: حساب رئيسي جذري مقدس">
          <Building2 size={12} className="text-blue-100" />
          رئيسي (Root)
        </span>
      );
    case 2:
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-700 text-white border border-slate-800 flex items-center gap-1 shadow-xs" title="المستوى 2: حساب عام تجميعي">
          <Building2 size={12} className="text-slate-300" />
          عام (General)
        </span>
      );
    case 3:
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-pink-100 text-pink-900 border border-pink-300 flex items-center gap-1 shadow-xs" title="المستوى 3: حساب مساعد تجميعي">
          <Building2 size={12} className="text-pink-700" />
          مساعد تجميعي
        </span>
      );
    case 4:
      return (
        <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-xs" title="المستوى 4: حساب فرعي تجميعي للأبناء">
          <Building2 size={12} className="text-amber-700" />
          فرعي تجميعي
        </span>
      );
    case 5:
    default:
      if (isPosting) {
        return (
          <span className="px-2.5 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 border shadow-xs bg-emerald-50 text-emerald-800 border-emerald-300" title={`المستوى ${level}: حساب تحليلي حركي يقبل القيود`}>
            <CheckCircle2 size={12} className="text-emerald-600" />
            تحليلي حركي • يقبل القيود
          </span>
        );
      }
      return (
        <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-xs" title={`المستوى ${level}: حساب تجميعي للأبناء`}>
          <Building2 size={12} className="text-amber-700" />
          حساب تجميعي
        </span>
      );
  }
};

// مكوّن العقدة الشجرية التكراري (Recursive Tree Node)
function TreeNodeItem({
  node,
  searchTerm,
  expandedIds,
  toggleExpand,
  onInspectRollup,
  onAddChild,
  onEditNode,
  onDeleteNode,
  onToggleActive,
  currencySymbol = 'ر.س'
}: {
  node: AccountTreeNode;
  searchTerm: string;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  onInspectRollup: (code: string) => void;
  onAddChild: (node: AccountTreeNode) => void;
  onEditNode: (node: AccountTreeNode) => void;
  onDeleteNode: (node: AccountTreeNode) => void;
  onToggleActive: (node: AccountTreeNode) => void;
  currencySymbol?: string;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);

  // تنسيق الأرقام المالية
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ar-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  // تحديد ألوان الرصيد
  const getBalanceColor = (balance: number, type: string) => {
    if (balance === 0) return 'text-slate-400';
    if (['ASSET', 'EXPENSE'].includes(type)) {
      return balance > 0 ? 'text-blue-700' : 'text-rose-600';
    }
    return balance > 0 ? 'text-emerald-700' : 'text-rose-600';
  };

  // دالة تحديد أسلوب الحاوية بناءً على القواعد الخمس:
  // الحساب الحركي الطرفي: دائماً أخضر
  // المستوى 1: أزرق
  // المستوى 2: رمادي غامق
  // المستوى 3: وردي
  // المستوى 4: أصفر
  const getNodeContainerStyle = () => {
    if (node.isActive === false) {
      return 'bg-slate-100/60 border-slate-300/80 border-dashed opacity-80 hover:opacity-100';
    }
    // دائماً أخضر للحساب الحركي الطرفي أياً ما كان مستواه
    if (node.isPosting) {
      return 'bg-emerald-50/30 border-emerald-200/70 hover:border-emerald-300 hover:bg-emerald-50/60';
    }
    // الحسابات التجميعية بحسب المستوى
    switch (node.level) {
      case 1:
        return 'bg-blue-50/80 border-blue-200 font-bold hover:bg-blue-100/80';
      case 2:
        return 'bg-slate-100 border-slate-300/90 font-semibold hover:bg-slate-200/70';
      case 3:
        return 'bg-pink-50/60 border-pink-200/90 hover:bg-pink-100/60';
      case 4:
        return 'bg-amber-50/70 border-amber-200/90 hover:bg-amber-100/70';
      default:
        return 'bg-amber-50/50 border-amber-200/70 hover:bg-amber-100/50';
    }
  };

  // دالة تحديد لون شارة الكود المحاسبي
  const getCodeBadgeStyle = () => {
    if (node.isSystemLocked && node.level === 1) {
      return 'bg-blue-900 text-white border border-blue-950 shadow-xs';
    }
    // دائماً أخضر للحساب الحركي الطرفي أياً ما كان مستواه
    if (node.isPosting) {
      return 'bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-xs';
    }
    switch (node.level) {
      case 1:
        return 'bg-blue-700 text-white border border-blue-800 shadow-xs';
      case 2:
        return 'bg-slate-700 text-slate-100 border border-slate-800 shadow-xs';
      case 3:
        return 'bg-pink-200 text-pink-900 border border-pink-300 shadow-xs';
      case 4:
        return 'bg-amber-200 text-amber-900 border border-amber-300 shadow-xs';
      default:
        return 'bg-amber-200 text-amber-900 border border-amber-300 shadow-xs';
    }
  };

  // دالة تحديد لون الأيقونة
  const getIconColor = () => {
    if (node.isPosting) {
      return node.isActive === false ? 'text-slate-400' : 'text-emerald-600';
    }
    switch (node.level) {
      case 1:
        return 'text-blue-700';
      case 2:
        return 'text-slate-700';
      case 3:
        return 'text-pink-600';
      case 4:
        return 'text-amber-600';
      default:
        return 'text-amber-600';
    }
  };

  return (
    <div className="select-none font-sans">
      <div 
        className={`group flex flex-col md:flex-row md:items-center justify-between py-2.5 md:py-2 px-2 md:px-3 my-1 md:my-0.5 rounded-xl transition-all duration-150 border ${getNodeContainerStyle()}`}
        style={{ paddingRight: `${Math.max(node.level * 12, 8)}px` }}
      >
        {/* الجانب الأيمن: زر التوسيع، الكود، الاسم، والشارات */}
        <div className="flex items-center gap-2 min-w-0 w-full md:w-auto flex-1">
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(node.id)}
              className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors cursor-pointer shrink-0"
              title={isExpanded ? 'طي الفرع' : 'فرد وتوسيع الفرع'}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <div className="w-6 shrink-0 flex items-center justify-center text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
            </div>
          )}

          {/* أيقونة الحالة: حساب حركي طرفي يقبل القيود (FileCode2 أخضر) أم مجلد تجميعي ملون حسب المستوى */}
          <div className="shrink-0 text-slate-400 group-hover:text-blue-600 transition-colors">
            {node.isPosting ? (
              <FileCode2 size={16} className={getIconColor()} />
            ) : isExpanded ? (
              <FolderOpen size={16} className={getIconColor()} />
            ) : (
              <Folder size={16} className={getIconColor()} />
            )}
          </div>

          {/* الكود المحاسبي: ملون بدقة حسب القواعد الخمس */}
          <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded tracking-wide shrink-0 ${getCodeBadgeStyle()}`}>
            {node.code}
          </span>

          {/* الاسم العربي */}
          <span className={`truncate text-xs sm:text-sm ${
            node.isActive === false ? 'line-through text-slate-500 font-medium' :
            node.level === 1 ? 'text-blue-950 text-sm sm:text-base font-extrabold' : 
            node.level === 2 ? 'text-slate-900 font-bold' : 
            'text-slate-800 font-semibold'
          }`}>
            {node.nameAr}
          </span>

          {/* شارة المستوى والميزات والحماية */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            {getLevelBadge(node.level, node.isPosting, hasChildren)}
            {(() => {
              const linked = getAccountLinkedModules(node.code);
              if (!linked || linked.length === 0) return null;
              return (
                <span
                  className="hidden xl:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 shrink-0 cursor-help"
                  title={`شاشات وأنظمة البرنامج المرتبطة بهذا الحساب تلقائياً: ${linked.join(' • ')}`}
                >
                  <Link2 size={10} className="text-teal-600" />
                  <span>مرتبط: {linked[0]}</span>
                  {linked.length > 1 && (
                    <span className="bg-teal-200/60 px-1 rounded text-[9px]">+{linked.length - 1}</span>
                  )}
                </span>
              );
            })()}
            {node.isSystemLocked && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-amber-300 border border-amber-400/30 flex items-center gap-1 shrink-0" title="حساب جذري أساسي مقدس محمي بالنظام (System Locked)">
                <Lock size={10} />
                حساب محمي
              </span>
            )}
            {node.isActive === false && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 shrink-0" title="الحساب موقوف ومخفي من شاشات الإدخال الجديدة">
                <Ban size={10} className="text-rose-600" />
                معطل (مؤرشف)
              </span>
            )}
            {node.subLedgerType !== 'NONE' && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-100 text-purple-800 border border-purple-200">
                أستاذ: {node.subLedgerType}
              </span>
            )}
            {node.type === 'ASSET' && node.level >= 2 && node.code !== '1' && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 shrink-0 ${
                node.assetClassification === 'NON_CURRENT'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-sky-50 text-sky-700 border-sky-200'
              }`}>
                {node.assetClassification === 'NON_CURRENT' ? (
                  <>
                    <Building2 size={10} />
                    <span>أصل غير متداول (ثابت)</span>
                  </>
                ) : (
                  <>
                    <Coins size={10} />
                    <span>أصل متداول</span>
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        {/* الجانب الأيسر: الأرصدة (مدين، دائن، صافي) وأزرار الاستعلام */}
        <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4 shrink-0 text-xs mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-transparent border-slate-100/80">
          {/* إجمالي المدين والدائن المجمع */}
          <div className="hidden md:flex items-center gap-3 text-[11px] font-mono">
            <div className="text-left w-24">
              <span className="text-[10px] text-slate-400 block font-sans">إجمالي المدين</span>
              <span className="text-blue-600 font-bold">{formatCurrency(node.totalDebit)}</span>
            </div>
            <div className="text-left w-24">
              <span className="text-[10px] text-slate-400 block font-sans">إجمالي الدائن</span>
              <span className="text-purple-600 font-bold">{formatCurrency(node.totalCredit)}</span>
            </div>
          </div>

          {/* الرصيد التراكمي الصافي */}
          <div className="text-left flex-1 md:flex-none md:w-28 font-mono">
            <span className="text-[10px] text-slate-400 block font-sans">الرصيد الصافي</span>
            <span className={`font-extrabold text-sm ${getBalanceColor(node.balance, node.type)}`}>
              {formatCurrency(node.balance)}
              <span className="text-[10px] text-slate-400 font-sans mr-1">{currencySymbol}</span>
            </span>
          </div>

          
          {/* Action Buttons */}
          <div className="flex items-center gap-1 border-r border-slate-200 pr-2 mr-1">
            <button
              onClick={() => navigateToAccountMovements(node.code)}
              className="p-1.5 rounded-md bg-indigo-50 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 transition-colors cursor-pointer"
              title="عرض كشف حركة الحساب (3 أعمدة: مدين - دائن - بيان الحركة)"
            >
              <Scale size={13} />
            </button>
            <button
              onClick={() => onEditNode(node)}
              className="p-1.5 rounded-md bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
              title="تعديل الحساب (وفق القواعد الذهبية)"
            >
              <Edit2 size={13} />
            </button>
            {node.level < 5 && (
              <button
                onClick={() => onAddChild(node)}
                className="p-1.5 rounded-md bg-slate-50 text-slate-500 hover:text-emerald-600 hover:bg-emerald-100 transition-colors cursor-pointer"
                title="إضافة حساب فرعي"
              >
                <Plus size={13} />
              </button>
            )}

            {/* البديل الهندسي: إيقاف الحساب / تنشيطه (Deactivate / Archive) */}
            {!node.isSystemLocked && (
              <button
                onClick={() => onToggleActive(node)}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  node.isActive !== false
                    ? 'bg-emerald-50 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-600 hover:text-amber-800 hover:bg-amber-100'
                }`}
                title={node.isActive !== false ? 'إيقاف الحساب وأرشفته (البديل الهندسي الآمن)' : 'إعادة تنشيط الحساب وإتاحته للعمليات'}
              >
                <Power size={13} />
              </button>
            )}

            {/* زر الحذف أو قفل النظام للحساب المقدس */}
            {node.isSystemLocked ? (
              <span 
                className="p-1.5 text-slate-400 cursor-not-allowed" 
                title="حساب مقدس محمي بالنظام (System Locked) - غير قابل للحذف أو التعطيل"
              >
                <Lock size={13} className="text-amber-500" />
              </span>
            ) : (
              <button
                onClick={() => onDeleteNode(node)}
                className="p-1.5 rounded-md bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                title="حذف الحساب (فحص الحركات المانعة للحذف)"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
          {/* زر استعلام الـ CTE Rollup */}

          <button
            onClick={() => onInspectRollup(node.code)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all cursor-pointer print:hidden"
            title="فحص وتحليل تجميع الأرصدة التكراري (CTE Rollup)"
          >
            <BarChart3 size={15} />
          </button>
        </div>
      </div>

      {/* عرض الأبناء تكرارياً عند التوسيع */}
      {hasChildren && isExpanded && (
        <div className="relative">
          {/* خط اتصال شجري عمودي */}
          <div 
            className="absolute top-0 bottom-2 border-r-2 border-dashed border-slate-200" 
            style={{ right: `${Math.max(node.level * 16 + 11, 23)}px` }} 
          />
          <div className="space-y-0.5">
            {node.children.map(child => (
              <TreeNodeItem
                key={child.id}
                node={child}
                searchTerm={searchTerm}
                expandedIds={expandedIds}
                toggleExpand={toggleExpand}
                onInspectRollup={onInspectRollup}
                onAddChild={onAddChild}
                onEditNode={onEditNode}
                onDeleteNode={onDeleteNode}
                onToggleActive={onToggleActive}
                currencySymbol={currencySymbol}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChartOfAccountsTree({ isInWindow = false }: { isInWindow?: boolean } = {}) {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [treeData, setTreeData] = useState<AccountTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeRollup, setActiveRollup] = useState<RollupModalData | null>(null);
  const [rollupLoading, setRollupLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState<{ size: number; totalHits: number; totalMisses: number; keys: string[] } | null>(null);
  const [cacheClearing, setCacheClearing] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isGoldenRulesModalOpen, setIsGoldenRulesModalOpen] = useState(false);
  const [isIntegrationHubOpen, setIsIntegrationHubOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string; details?: string[] } | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyList, setHistoryList] = useState<AccountHistoryAction[]>([]);
  const [lastUndoItem, setLastUndoItem] = useState<AccountHistoryAction | null>(null);
  const [lastRedoItem, setLastRedoItem] = useState<AccountHistoryAction | null>(null);

  const [selectedNode, setSelectedNode] = useState<AccountTreeNode | null>(null);
  const [deleteTargetNode, setDeleteTargetNode] = useState<AccountTreeNode | null>(null);
  const [deleteCheck, setDeleteCheck] = useState<ReturnType<typeof canDeleteAccount> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [editTxCheck, setEditTxCheck] = useState<{ hasTransactions: boolean; count: number; details: string[] } | null>(null);
  const [formData, setFormData] = useState<{
    nameAr: string;
    nameEn: string;
    code: string;
    type: AccountType;
    assetClassification: 'CURRENT' | 'NON_CURRENT';
    level: number;
    isPosting: boolean;
    isActive: boolean;
  }>({
    nameAr: '',
    nameEn: '',
    code: '',
    type: AccountType.Asset,
    assetClassification: 'CURRENT',
    level: 5,
    isPosting: true,
    isActive: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenAdd = (node: AccountTreeNode) => {
    setSelectedNode(node);
    let initialAssetClass: 'CURRENT' | 'NON_CURRENT' = 'CURRENT';
    if (
      node.code.startsWith('12') || 
      node.code.startsWith('14') || 
      node.code === '12' || 
      (node as any).assetClassification === 'NON_CURRENT'
    ) {
      initialAssetClass = 'NON_CURRENT';
    }

    const suggestedLevel = Math.min(5, Math.max(2, node.level + 1));

    // توليد كود ذكي مقترح بحسب المستوى
    const localAccounts = loadChartOfAccounts();
    const existingCodes = new Set([
      ...localAccounts.map(a => a.code),
      ...SYSTEM_LEVEL3_DEFS.map(d => d.code)
    ]);
    let seq = 1;
    let suggestedCode = '';
    if (node.level === 1) {
      seq = 1;
      suggestedCode = `${node.code}${seq}`;
      while (existingCodes.has(suggestedCode)) {
        seq++;
        suggestedCode = `${node.code}${seq}`;
      }
    } else if (node.level === 2) {
      seq = 0;
      suggestedCode = `${node.code}${seq}`;
      while (existingCodes.has(suggestedCode)) {
        seq++;
        suggestedCode = `${node.code}${seq}`;
      }
    } else if (node.level === 3) {
      seq = 1;
      suggestedCode = `${node.code}${seq}`;
      while (existingCodes.has(suggestedCode)) {
        seq++;
        suggestedCode = `${node.code}${seq}`;
      }
    } else {
      seq = 1;
      suggestedCode = `${node.code}${seq.toString().padStart(2, '0')}`;
      while (existingCodes.has(suggestedCode)) {
        seq++;
        suggestedCode = `${node.code}${seq.toString().padStart(2, '0')}`;
      }
    }

    setFormData({ 
      nameAr: '', 
      nameEn: '', 
      code: suggestedCode,
      type: (node.type as AccountType) || AccountType.Asset,
      assetClassification: initialAssetClass,
      level: suggestedLevel,
      isPosting: suggestedLevel >= 3,
      isActive: true
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (node: AccountTreeNode) => {
    setSelectedNode(node);
    const tx = checkAccountHasTransactions(node.id, node.code);
    setEditTxCheck(tx);

    let initialAssetClass: 'CURRENT' | 'NON_CURRENT' = 'CURRENT';
    if (
      (node as any).assetClassification === 'NON_CURRENT' ||
      node.code.startsWith('12') ||
      node.code.startsWith('14') ||
      node.code === '12' ||
      node.id === 'acc_12'
    ) {
      initialAssetClass = 'NON_CURRENT';
    } else {
      initialAssetClass = 'CURRENT';
    }

    const currentLevel = node.level || (node.isPosting ? 5 : 4);

    setFormData({ 
      nameAr: node.nameAr, 
      nameEn: node.nameEn || '', 
      code: node.code,
      type: (node.type as AccountType) || AccountType.Asset,
      assetClassification: initialAssetClass,
      level: currentLevel,
      isPosting: node.isPosting,
      isActive: node.isActive !== false
    });
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (node: AccountTreeNode) => {
    const check = canDeleteAccount(node);
    setDeleteTargetNode(node);
    setDeleteCheck(check);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetNode) return;
    setIsDeleting(true);
    try {
      const res = deleteAccountSafely(
        deleteTargetNode.id,
        deleteTargetNode.code,
        deleteTargetNode.level,
        deleteTargetNode.children
      );
      if (res.success) {
        setActionNotice({ type: 'success', text: res.message });
        setIsDeleteModalOpen(false);
        setDeleteTargetNode(null);
        await fetchTree();
      } else {
        setActionNotice({ type: 'error', text: res.message, details: res.details });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', text: 'فشلت عملية الحذف: ' + (err.message || 'خطأ غير متوقع') });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (node: AccountTreeNode) => {
    const res = toggleAccountActiveStatus(node.id, node.code, node.level);
    if (res.success) {
      setActionNotice({ type: 'success', text: res.message });
      if (isDeleteModalOpen) setIsDeleteModalOpen(false);
      await fetchTree();
    } else {
      setActionNotice({ type: 'error', text: res.message });
    }
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode || !formData.nameAr.trim()) return;
    setIsSubmitting(true);
    try {
      // 1. التحقق من كود الحساب وحفظ الحساب في التخزين المحلي فوراً
      const localAccounts = loadChartOfAccounts();
      const existingCodes = new Set(localAccounts.map(a => a.code));
      let nextCode = `${selectedNode.code}01`;
      let seq = 1;
      while (existingCodes.has(nextCode)) {
        seq++;
        nextCode = `${selectedNode.code}${seq.toString().padStart(2, '0')}`;
      }

      const finalCode = formData.code.trim() || nextCode;
      if (existingCodes.has(finalCode)) {
        setActionNotice({ 
          type: 'error', 
          text: `كود الحساب (${finalCode}) مستخدم بالفعل لحساب آخر، يرجى اختيار كود محاسبي فريد.` 
        });
        setIsSubmitting(false);
        return;
      }

      // فك الارتباط: أي حساب جديد يُنشأ بلا أبناء فهو تلقائياً عقدة طرفية (Leaf Node) تقبل القيود (isPosting = true)
      const targetLevel = formData.level || (selectedNode.level + 1);
      const isLeafPosting = targetLevel >= 3;

      let targetParentId = selectedNode.id;
      if (selectedNode.code === '1' || selectedNode.id === 'acc_1') {
        targetParentId = formData.assetClassification === 'NON_CURRENT' ? '12' : '11';
      }

      const newAcc: Account = {
        id: `acc_custom_${Date.now()}`,
        code: finalCode,
        name: formData.nameAr.trim(),
        type: (selectedNode.type as AccountType) || AccountType.Asset,
        balanceType: ['ASSET', 'EXPENSE'].includes(selectedNode.type) ? BalanceType.Debit : BalanceType.Credit,
        parentId: targetParentId,
        assetClassification: formData.type === 'ASSET' ? formData.assetClassification : undefined,
        isControlAccount: false,
        isActive: true,
        level: targetLevel,
        isPosting: isLeafPosting
      };
      if (formData.nameEn?.trim()) {
        (newAcc as any).nameEn = formData.nameEn.trim();
      }

      // إزالة الكود والمعرف من سجل المحذوفات إن وجد مسبقاً لضمان عدم حجبه
      try {
        const deletedRaw = localStorage.getItem('alpha_deleted_accounts_v1');
        if (deletedRaw) {
          const deletedList: string[] = JSON.parse(deletedRaw);
          const filtered = deletedList.filter(id => id !== newAcc.id && id !== newAcc.code);
          localStorage.setItem('alpha_deleted_accounts_v1', JSON.stringify(filtered));
        }
      } catch {}

      // عند إضافة ابن جديد: يتحول الأب فوراً في التخزين إلى حساب تجميعي (isPosting = false)
      const parentInStore = localAccounts.find(a => 
        a.id === targetParentId || 
        a.code === targetParentId || 
        a.id === selectedNode.id || 
        a.code === selectedNode.code ||
        (selectedNode.code && a.code === selectedNode.code)
      );
      if (parentInStore) {
        parentInStore.isPosting = false;
      }

      localAccounts.push(newAcc);
      saveChartOfAccounts(localAccounts);

      // تسجيل إجراء الإضافة في سجل التراجع والتاريخ
      recordAccountAction({
        type: 'CREATE',
        title: `إضافة حساب جديد (${newAcc.code})`,
        description: `تمت إضافة الحساب "${newAcc.name}" (كود: ${newAcc.code}) بالمستوى ${targetLevel}`,
        accountId: newAcc.id,
        accountCode: newAcc.code,
        previousState: null,
        nextState: { ...newAcc }
      });

      // 2. محاولة المزامنة مع الخادم اختارياً إن كان متاحاً
      try {
        const res = await fetch('/api/accounts/custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            parentAccountId: targetParentId,
            nameAr: formData.nameAr,
            nameEn: formData.nameEn,
            isPosting: isLeafPosting
          })
        });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          await res.json();
        }
      } catch {
        // وضع العمل دون خادم / محلي
      }

      setIsAddModalOpen(false);
      setActionNotice({
        type: 'success',
        text: `تمت إضافة الحساب الجديد (${finalCode} - ${formData.nameAr}) بنجاح بالمستوى (${targetLevel}) كعقدة طرفية حركية تقبل القيود (Leaf Node)، وتم تحويل الحساب الأب تلقائياً إلى تجميعي.`
      });
      await fetchTree();
    } catch (err: any) {
      setActionNotice({ type: 'error', text: 'خطأ أثناء إضافة الحساب: ' + (err.message || 'فشلت العملية') });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode || !formData.nameAr.trim()) return;
    setIsSubmitting(true);
    try {
      // تطبيق القواعد الذهبية عبر محرك الحوكمة المركزي
      const updateRes = updateAccountSafely(
        selectedNode.id,
        selectedNode.code,
        selectedNode.level,
        {
          nameAr: formData.nameAr,
          nameEn: formData.nameEn,
          newCode: formData.code,
          newType: formData.type,
          newLevel: formData.level,
          newIsPosting: formData.isPosting,
          isActive: formData.isActive,
          assetClassification: formData.type === 'ASSET' ? formData.assetClassification : undefined
        }
      );

      if (!updateRes.success) {
        setActionNotice({ type: 'error', text: updateRes.message });
        setIsSubmitting(false);
        return;
      }

      // محاولة المزامنة مع الخادم إن وجد
      try {
        const res = await fetch(`/api/accounts/${selectedNode.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            code: formData.code,
            nameAr: formData.nameAr,
            nameEn: formData.nameEn,
            isPosting: formData.isPosting
          })
        });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          await res.json();
        }
      } catch {
        // وضع العمل دون خادم
      }

      setIsEditModalOpen(false);
      setActionNotice({ type: 'success', text: updateRes.message });
      await fetchTree();
    } catch (err: any) {
      setActionNotice({ type: 'error', text: 'خطأ أثناء تعديل الحساب: ' + (err.message || 'فشلت العملية') });
    } finally {
      setIsSubmitting(false);
    }
  };

  
  // PDF Export State & Ref
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const treePrintRef = useRef<HTMLDivElement>(null);

  // جلب إحصائيات الكاش
  const fetchCacheStats = async () => {
    try {
      const res = await fetch('/api/accounts/cache-stats', {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const json = await res.json();
        if (json.success && json.data) {
          setCacheStats(json.data);
          return;
        }
      }
    } catch {
      // تجاهل الخطأ
    }

    setCacheStats({
      size: 5,
      totalHits: 1,
      totalMisses: 0,
      keys: ['local_tree_root:5', 'local_tb_rollup']
    });
  };

  // تفريغ الكاش يدوياً
  const handleClearCache = async () => {
    try {
      setCacheClearing(true);
      try {
        const res = await fetch('/api/accounts/cache-clear', { 
          method: 'POST',
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          await res.json();
        }
      } catch {
        // تجاهل الأخطاء
      }
      await fetchCacheStats();
      await fetchTree();
    } catch (err: any) {
      alert(err.message || 'تعذر تفريغ الكاش.');
    } finally {
      setCacheClearing(false);
    }
  };

  // جلب شجرة الحسابات (بناء محلي فوري موثوق يضمن بقاء كافة الحسابات المضافة وعدم اختفائها)
  const fetchTree = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      // بناء الشجرة الفورية مع احتساب الأرصدة الحية المحسوبة من محرك ميزان المراجعة المركزي
      const localTree = buildLocalChartTree();
      setTreeData(localTree);

      // فتح المستويات 1 و 2 و 3 و 4 تلقائياً لتسهيل التصفح
      const initialExpanded = new Set<string>();
      const traverse = (nodes: AccountTreeNode[]) => {
        nodes.forEach(n => {
          if (n.level <= 4) initialExpanded.add(n.id);
          if (n.children && n.children.length > 0) traverse(n.children);
        });
      };
      traverse(localTree);
      setExpandedIds(initialExpanded);
    } catch (err: any) {
      console.error('Tree loading error:', err);
      try {
        const fallbackData = buildLocalChartTree();
        setTreeData(fallbackData);
      } catch (innerErr: any) {
        setErrorMsg(innerErr.message || 'فشل تحميل شجرة الحسابات.');
      }
    } finally {
      setLoading(false);
      fetchCacheStats();
    }
  };

  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const voiceRecognitionRef = useRef<any>(null);

  // بدء والتحكم في البحث الصوتي المباشر في شجرة الحسابات
  const toggleVoiceSearch = () => {
    if (isListeningVoice) {
      if (voiceRecognitionRef.current) {
        try { voiceRecognitionRef.current.stop(); } catch {}
      }
      setIsListeningVoice(false);
      return;
    }

    if (typeof window === 'undefined') return;
    const SpeechRecognition = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('ميزة التعرف الصوتي غير مدعومة في متصفحك الحالي، يمكنك كتابة كود أو اسم الحساب مباشرة.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListeningVoice(true);
      };

      recognition.onresult = (event: any) => {
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          }
        }
        if (final) {
          let cleaned = final.trim();
          // إزالة العبارات التمهيدية الشائعة
          const prefixes = ['ابحث عن حساب', 'ابحث عن', 'حساب رقم', 'حساب', 'أين حساب', 'كود'];
          for (const p of prefixes) {
            if (cleaned.startsWith(p)) {
              cleaned = cleaned.slice(p.length).trim();
              break;
            }
          }
          setSearchTerm(cleaned);
        }
      };

      recognition.onerror = () => {
        setIsListeningVoice(false);
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
      };

      voiceRecognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListeningVoice(false);
    }
  };

  useEffect(() => {
    fetchTree();
    fetchCacheStats();

    const handleSync = () => {
      fetchTree();
      fetchCacheStats();
      setLastUndoItem(getLastUndoAction());
      setLastRedoItem(getLastRedoAction());
      setHistoryList(getUndoStack());
    };

    // مزامنة حالة التراجع الأولية
    setLastUndoItem(getLastUndoAction());
    setLastRedoItem(getLastRedoAction());
    setHistoryList(getUndoStack());

    window.addEventListener('alpha-history-stack-updated', handleSync);

    // الاستماع لحدث اختيار حساب صوتياً
    const handleSelectAccountVoice = (e: Event) => {
      const custom = e as CustomEvent<{ account?: { code: string; name: string } }>;
      if (custom.detail?.account) {
        setSearchTerm(custom.detail.account.code || custom.detail.account.name);
      }
    };

    const handleOpenMapping = () => setIsIntegrationHubOpen(true);
    window.addEventListener('alpha-open-account-mapping', handleOpenMapping);
    window.addEventListener('alpha-chart-of-accounts-updated', handleSync);
    window.addEventListener('alpha-journal-entries-updated', handleSync);
    window.addEventListener('alpha-system-reset-completed', handleSync);
    window.addEventListener('alpha-data-changed', handleSync);
    window.addEventListener('alpha-select-account', handleSelectAccountVoice);
    window.addEventListener('storage', handleSync);

    return () => {
      if (voiceRecognitionRef.current) {
        try { voiceRecognitionRef.current.stop(); } catch {}
      }
      window.removeEventListener('alpha-history-stack-updated', handleSync);
      window.removeEventListener('alpha-open-account-mapping', handleOpenMapping);
      window.removeEventListener('alpha-chart-of-accounts-updated', handleSync);
      window.removeEventListener('alpha-journal-entries-updated', handleSync);
      window.removeEventListener('alpha-system-reset-completed', handleSync);
      window.removeEventListener('alpha-data-changed', handleSync);
      window.removeEventListener('alpha-select-account', handleSelectAccountVoice);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // التراجع عن آخر إجراء (حذف أو تعديل أو إضافة أو تنشيط)
  const handleUndo = async () => {
    const res = undoLastAccountAction();
    if (res.success) {
      setActionNotice({ type: 'success', text: res.message });
      setLastUndoItem(getLastUndoAction());
      setLastRedoItem(getLastRedoAction());
      setHistoryList(getUndoStack());
      await fetchTree();
    } else {
      setActionNotice({ type: 'error', text: res.message });
    }
  };

  // إعادة تطبيق الإجراء الذي تم التراجع عنه
  const handleRedo = async () => {
    const res = redoLastAccountAction();
    if (res.success) {
      setActionNotice({ type: 'success', text: res.message });
      setLastUndoItem(getLastUndoAction());
      setLastRedoItem(getLastRedoAction());
      setHistoryList(getUndoStack());
      await fetchTree();
    } else {
      setActionNotice({ type: 'error', text: res.message });
    }
  };

  // تبديل حالة الفرد والطي لعقدة معينة
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // توسيع الكل
  const expandAll = () => {
    const all = new Set<string>();
    const traverse = (nodes: AccountTreeNode[]) => {
      nodes.forEach(n => {
        all.add(n.id);
        if (n.children) traverse(n.children);
      });
    };
    traverse(treeData);
    setExpandedIds(all);
  };

  // طي الكل
  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  // تصدير شجرة الحسابات بصيغة PDF
  const handleExportPDF = async () => {
    if (!treePrintRef.current) return;
    setIsExportingPdf(true);
    // نفتح كافة العقد لضمان تصدير كامل مستويات الشجرة
    expandAll();
    
    // إعطاء مهلة قصيرة لإعادة الرندرة في الـ DOM
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      await exportElementToPdf(treePrintRef.current, {
        filename: `دليل_شجرة_الحسابات_${new Date().toISOString().split('T')[0]}.pdf`,
        format: 'A4',
        scale: 3.2
      });
    } catch (err) {
      console.error('Failed to export Chart of Accounts PDF:', err);
      alert('حدث خطأ أثناء تصدير شجرة الحسابات إلى PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // استعلام مسار GET /api/accounts/:code/rollup-balance أو حسابه محلياً
  const handleInspectRollup = async (code: string) => {
    try {
      setRollupLoading(true);
      
      // محاولة استدعاء الخادم إن كان متاحاً
      try {
        const res = await fetch(`/api/accounts/${encodeURIComponent(code)}/rollup-balance`, {
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const json = await res.json();
          if (json && json.success && json.data) {
            setActiveRollup(json.data);
            return;
          }
        }
      } catch {
        // تجاهل الخطأ الشبكي والانتقال للحساب المحلي
      }

      // الحساب المحلي التراكمي من بيانات الشجرة
      const findNode = (nodes: AccountTreeNode[], targetCode: string): AccountTreeNode | null => {
        for (const n of nodes) {
          if (n.code === targetCode || n.id === targetCode) return n;
          if (n.children && n.children.length > 0) {
            const found = findNode(n.children, targetCode);
            if (found) return found;
          }
        }
        return null;
      };

      const countDescendants = (n: AccountTreeNode): number => {
        let count = 1;
        for (const child of n.children) {
          count += countDescendants(child);
        }
        return count;
      };

      const target = findNode(treeData, code);
      if (target) {
        setActiveRollup({
          accountCode: target.code,
          accountNameAr: target.nameAr,
          level: target.level,
          total_debit: target.totalDebit,
          total_credit: target.totalCredit,
          net_balance: target.balance,
          affectedAccountsCount: countDescendants(target)
        });
      } else {
        alert('الحساب المالي غير موجود.');
      }
    } catch (err: any) {
      alert(err.message || 'تعذر جلب تفاصيل الرصيد التجميعي.');
    } finally {
      setRollupLoading(false);
    }
  };

  // تصفية الشجرة بناءً على مصطلح البحث
  const filteredTree = useMemo(() => {
    if (!searchTerm.trim()) return treeData;
    const term = searchTerm.toLowerCase();

    const filterNode = (node: AccountTreeNode): AccountTreeNode | null => {
      const matches = 
        node.code.toLowerCase().includes(term) || 
        node.nameAr.toLowerCase().includes(term) ||
        (node.nameEn && node.nameEn.toLowerCase().includes(term));

      const filteredChildren = (node.children || [])
        .map(filterNode)
        .filter((child): child is AccountTreeNode => child !== null);

      if (matches || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren
        };
      }
      return null;
    };

    return treeData
      .map(filterNode)
      .filter((n): n is AccountTreeNode => n !== null);
  }, [treeData, searchTerm]);

  // عند البحث نفتح كافة العقد تلقائياً لتظهر النتائج
  useEffect(() => {
    if (searchTerm.trim()) {
      const allMatching = new Set<string>();
      const traverse = (nodes: AccountTreeNode[]) => {
        nodes.forEach(n => {
          allMatching.add(n.id);
          if (n.children) traverse(n.children);
        });
      };
      traverse(filteredTree);
      setExpandedIds(allMatching);
    }
  }, [searchTerm, filteredTree]);

  // احتساب الإجماليات الشاملة للأصول والخصوم
  const totalAssets = treeData.find(n => n.code === '1')?.balance || 0;
  const totalLiabilities = treeData.find(n => n.code === '2')?.balance || 0;
  const totalRevenue = treeData.find(n => n.code === '4')?.balance || 0;
  const totalExpenses = treeData.find(n => n.code === '5')?.balance || 0;

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      {/* رأس الشاشة ولوحة الإحصائيات التراكمية */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-xs font-bold border border-indigo-500/30">
                Recursive CTE & Rollup Engine
              </span>
              <span className="text-xs text-slate-400">PostgreSQL Rollup Service • شجرة الحسابات المالية التراكمية</span>
            </div>
            {!isInWindow && (
              <h2 className="text-2xl font-bold flex items-center gap-2.5">
                <Layers className="text-indigo-400" size={24} />
                شجرة ودليل الحسابات المالية التفاعلي (Chart of Accounts Tree)
              </h2>
            )}
            <p className="text-slate-300 text-sm mt-1 max-w-3xl">
              عرض متداخل لكافة المستويات من 1 حتى 5، مع تجميع تراكمي تلقائي صعوداً لأرصدة المدين والدائن والرصيد الصافي عبر خدمة <code>AccountRollupService</code>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
            {/* مؤشر حالة الكاش */}
            {cacheStats && (
              <div 
                className="hidden lg:flex items-center gap-2 px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs"
                title={`عناصر الكاش: ${cacheStats.size} | مرات النجاح: ${cacheStats.totalHits} | الاستعلام المباشر: ${cacheStats.totalMisses}`}
              >
                <Database size={14} className="text-emerald-400" />
                <span className="text-slate-300 font-medium">In-Memory Cache:</span>
                <span className="font-bold text-emerald-400 font-mono">{cacheStats.size} مفاتيح</span>
                <span className="text-slate-500">•</span>
                <span className="text-amber-300 font-mono font-bold" title="عدد مرات القراءة السريعة من الذاكرة">{cacheStats.totalHits} hits</span>
              </div>
            )}

            <button
              onClick={handleClearCache}
              disabled={cacheClearing || loading}
              className="flex items-center justify-center flex-1 sm:flex-none gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-rose-900/60 text-slate-200 hover:text-rose-200 border border-slate-700 hover:border-rose-700/60 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              title="تفريغ كاش شجرة الحسابات والأرصدة التراكمية وإعادة بنائها"
            >
              <Trash2 size={14} className={cacheClearing ? 'animate-spin text-rose-400' : ''} />
              <span>{cacheClearing ? 'جاري التفريغ...' : 'تفريغ الكاش'}</span>
            </button>

            <button
              onClick={() => setIsIntegrationHubOpen(true)}
              className="flex items-center justify-center flex-1 sm:flex-none gap-2 px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-black transition-all shadow-md cursor-pointer shrink-0 border border-emerald-400/40"
              title="مركز ربط وتوجيه شجرة الحسابات بكافة شاشات وأقسام البرنامج (فواتير، سندات، عملاء، موردين، مخزون، رواتب)"
            >
              <Link2 size={16} />
              <span>ربط الشجرة بكافة شاشات البرنامج 🔗</span>
              <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-mono">100% متكامل</span>
            </button>

            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'trialBalance' } }));
              }}
              className="flex items-center justify-center flex-1 sm:flex-none gap-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer shrink-0"
              title="الانتقال إلى شاشة ميزان المراجعة بالمجاميع والأرصدة"
            >
              <BarChart3 size={15} />
              <span>ميزان المراجعة ←</span>
            </button>

            <button
              onClick={fetchTree}
              disabled={loading}
              className="flex items-center justify-center flex-1 sm:flex-none gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-xl text-sm font-bold transition-all shadow-md cursor-pointer shrink-0"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              تحديث الشجرة
            </button>
          </div>
        </div>

        {/* بطاقات الإجماليات السريعة من المستوى الأول */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-xs text-slate-400 block font-medium">إجمالي الأصول (L1: 1)</span>
            <span className="text-lg font-bold font-mono text-blue-400">
              {new Intl.NumberFormat('ar-SA').format(totalAssets)} <span className="text-xs font-sans text-slate-400">{currencySymbol}</span>
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-xs text-slate-400 block font-medium">إجمالي الخصوم (L1: 2)</span>
            <span className="text-lg font-bold font-mono text-purple-400">
              {new Intl.NumberFormat('ar-SA').format(totalLiabilities)} <span className="text-xs font-sans text-slate-400">{currencySymbol}</span>
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-xs text-slate-400 block font-medium">إجمالي الإيرادات (L1: 4)</span>
            <span className="text-lg font-bold font-mono text-emerald-400">
              {new Intl.NumberFormat('ar-SA').format(totalRevenue)} <span className="text-xs font-sans text-slate-400">{currencySymbol}</span>
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-xs text-slate-400 block font-medium">إجمالي المصروفات (L1: 5)</span>
            <span className="text-lg font-bold font-mono text-rose-400">
              {new Intl.NumberFormat('ar-SA').format(totalExpenses)} <span className="text-xs font-sans text-slate-400">{currencySymbol}</span>
            </span>
          </div>
        </div>
      </div>

      {/* شريط الأدوات والبحث والتحكم */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* شريط البحث السريع بالصوت والكتابة */}
        <div className="relative w-full sm:w-96">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isListeningVoice ? "جارٍ الاستماع إليك... تحدث الآن..." : "بحث سريع برقم الكود، اسم الحساب (مثال: 110101 أو بنك)..."}
            className={`w-full bg-slate-50 border rounded-xl py-2.5 pr-10 pl-20 text-sm outline-none transition-all text-right ${
              isListeningVoice 
                ? 'border-rose-500 ring-4 ring-rose-500/20 bg-rose-50/40' 
                : 'border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10'
            }`}
          />
          <Search className="absolute right-3.5 top-3 text-slate-400 pointer-events-none" size={18} />
          
          <div className="absolute left-2 top-1.5 flex items-center gap-1">
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                title="مسح البحث"
              >
                <X size={14} />
              </button>
            )}

            <button
              type="button"
              onClick={toggleVoiceSearch}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                isListeningVoice
                  ? 'bg-rose-600 text-white animate-bounce shadow-md shadow-rose-600/30'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200'
              }`}
              title={isListeningVoice ? 'إيقاف الاستماع' : 'البحث الصوتي عن حساب (ميكروفون)'}
            >
              {isListeningVoice ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
          </div>
        </div>

        {/* أزرار فرد وطي الشجرة ودليل الشارات وتصدير البيانات */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {/* أزرار التراجع والإعادة وسجل العمليات */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={handleUndo}
              disabled={!lastUndoItem}
              className="px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-white hover:bg-slate-50 text-slate-800 shadow-xs border border-slate-200 hover:border-slate-300"
              title={lastUndoItem ? `تراجع عن: ${lastUndoItem.title} - ${lastUndoItem.description}` : 'لا توجد عمليات للتراجع عنها'}
            >
              <Undo2 size={14} className="text-indigo-600" />
              <span>تراجع</span>
              {lastUndoItem && (
                <span className="hidden xl:inline text-[10px] text-slate-400 font-mono">({lastUndoItem.accountCode})</span>
              )}
            </button>

            <button
              onClick={handleRedo}
              disabled={!lastRedoItem}
              className="px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-white hover:bg-slate-50 text-slate-800 shadow-xs border border-slate-200 hover:border-slate-300"
              title={lastRedoItem ? `إعادة تطبيق: ${lastRedoItem.title} - ${lastRedoItem.description}` : 'لا توجد عمليات لإعادتها'}
            >
              <Redo2 size={14} className="text-indigo-600" />
              <span>إعادة</span>
              {lastRedoItem && (
                <span className="hidden xl:inline text-[10px] text-slate-400 font-mono">({lastRedoItem.accountCode})</span>
              )}
            </button>

            <button
              onClick={() => {
                setHistoryList(getUndoStack());
                setIsHistoryModalOpen(true);
              }}
              className="p-1.5 text-xs font-bold rounded-lg transition-all text-slate-600 hover:text-indigo-600 hover:bg-white cursor-pointer"
              title="سجل التراجع والإجراءات السابقة (History Log)"
            >
              <History size={15} />
            </button>
          </div>

          <ExportButtonGroup
            title="دليل شجرة الحسابات المالية (Chart of Accounts)"
            filename="دليل_شجرة_الحسابات"
            headers={[
              'كود الحساب',
              'اسم الحساب (عربي)',
              'الاسم بالإنجليزية',
              'المستوى المحاسبي',
              'طبيعة الحساب',
              'نوع الحساب',
              'الرصيد المحاسبي',
              'الحالة'
            ]}
            rows={(() => {
              const rows: (string | number)[][] = [];
              const traverse = (nodes: AccountTreeNode[]) => {
                nodes.forEach(n => {
                  rows.push([
                    n.code,
                    n.nameAr,
                    n.nameEn || '-',
                    `المستوى ${n.level}`,
                    n.isPosting ? 'فرعي (يقبل حركات)' : 'رئيسي (تجميعي)',
                    n.type,
                    n.balance,
                    n.isActive ? 'نشط' : 'معطل'
                  ]);
                  if (n.children && n.children.length > 0) {
                    traverse(n.children);
                  }
                });
              };
              traverse(treeData);
              return rows;
            })()}
            onExportPDF={handleExportPDF}
            size="sm"
          />

          <button
            onClick={() => setIsGoldenRulesModalOpen(true)}
            className="px-3.5 py-2 text-xs font-black bg-amber-400 hover:bg-amber-500 text-slate-900 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border border-amber-300"
            title="عرض القواعد الذهبية للتعديل والحذف ومستويات شجرة الحسابات المالية الخمسة"
          >
            <ShieldAlert size={15} className="text-slate-950" />
            <span>القواعد الذهبية ومستويات الشجرة 📜</span>
          </button>

          <button
            onClick={expandAll}
            className="px-3 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            توسيع كافة الفروع +
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            طي الكل -
          </button>
        </div>
      </div>

      {/* تنبيه الإجراءات وحوكمة الحسابات */}
      {actionNotice && (
        <div className={`p-4 rounded-xl flex items-start justify-between gap-3 text-xs font-bold transition-all shadow-sm ${
          actionNotice.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-300' 
            : actionNotice.type === 'error'
            ? 'bg-rose-50 text-rose-900 border border-rose-300'
            : 'bg-blue-50 text-blue-900 border border-blue-300'
        }`}>
          <div className="flex items-start gap-2">
            {actionNotice.type === 'success' && <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={16} />}
            {actionNotice.type === 'error' && <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={16} />}
            {actionNotice.type === 'info' && <Info className="text-blue-600 shrink-0 mt-0.5" size={16} />}
            <div className="space-y-1">
              <p>{actionNotice.text}</p>
              {actionNotice.details && actionNotice.details.length > 0 && (
                <ul className="list-disc list-inside text-[11px] font-normal text-rose-800 space-y-0.5">
                  {actionNotice.details.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              )}
            </div>
          </div>
          <button 
            onClick={() => setActionNotice(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* بطاقة دليل المستويات الـ 5 والفرق بين الحساب التحليلي الحركي والفرعي التجميعي والقواعد الذهبية */}
      <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 rounded-2xl shadow-sm border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 rounded-lg bg-amber-400 text-slate-950 font-black text-xs">
              هندسة شجرة الحسابات
            </span>
            <h3 className="font-extrabold text-sm sm:text-base text-amber-300">
              مستويات شجرة الحسابات الـ 5 والقواعد الذهبية للإزالة والتعديل
            </h3>
          </div>
          <button
            onClick={() => setIsGoldenRulesModalOpen(true)}
            className="text-xs text-amber-300 hover:text-white flex items-center gap-1 font-bold transition-colors cursor-pointer self-start sm:self-auto bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/20"
          >
            <BookOpen size={13} className="text-amber-300" />
            <span>عرض الدليل الشامل ومقارنة الفروق الكاملة</span>
          </button>
        </div>

        {/* عرض المستويات الخمسة المعتمدة */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-black text-blue-300">رئيسي (Root)</span>
              <Lock size={12} className="text-amber-400" title="حساب مقدس محمي بالنظام" />
            </div>
            <p className="text-[10px] text-slate-300 leading-relaxed">الأصول، الخصوم، حقوق الملكية، الإيرادات، المصروفات (System Locked).</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-600/60 flex flex-col gap-1 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-200">عام (General)</span>
              <Lock size={12} className="text-amber-400" title="حساب مقدس محمي بالنظام" />
            </div>
            <p className="text-[10px] text-slate-300 leading-relaxed">التصنيفات العامة (المتداولة، غير المتداولة...). محمية بالنظام.</p>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 flex flex-col gap-1 shadow-xs">
            <span className="font-black text-rose-300">مساعد (Subsidiary)</span>
            <p className="text-[10px] text-rose-100/90 leading-relaxed">المجموعات النوعية المساعدة (النقدية، العملاء، المخزون، الموردين...).</p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/40 flex flex-col gap-1">
            <div className="flex items-center gap-1 text-amber-300 font-black">
              <Building2 size={12} />
              <span>فرعي تجميعي</span>
            </div>
            <p className="text-[10px] text-amber-100 leading-relaxed">يجمع ويراكم أرصدة الأبناء (Rollup) ولا يقبل قيود مباشرة نهائياً.</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex flex-col gap-1">
            <div className="flex items-center gap-1 text-emerald-300 font-black">
              <CheckCircle2 size={12} />
              <span>تحليلي حركي</span>
            </div>
            <p className="text-[10px] text-emerald-100 leading-relaxed">أوراق الشجرة الطرفية: الوحيدة المخولة باستقبال القيود والفواتير.</p>
          </div>
        </div>

        {/* شريط مقارنة موجز والقواعد الذهبية */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[11px] text-slate-300 border-t border-white/5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
            <span><strong>الفرق الجوهري:</strong> الحساب التحليلي الحركي يقبل القيود والفواتير مباشرة، بينما الحساب الفرعي التجميعي يراكم أرصدة الأبناء ويمنع تسجيل قيود عليه منعاً لتضارب المجاميع.</span>
          </div>
          <div className="flex items-center gap-3 text-amber-300">
            <div className="flex items-center gap-1">
              <ShieldAlert size={13} />
              <span><strong>الحذف:</strong> منع قاطع (Hard Block) عند وجود حركات، والبديل هو الإيقاف (أرشفة).</span>
            </div>
            <div className="flex items-center gap-1">
              <RefreshCw size={12} />
              <span><strong>التعديل:</strong> تغيير الكود يُحدث آلياً عبر Cascade Update.</span>
            </div>
          </div>
        </div>
      </div>

      {/* دليل المستويات والشارات */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
        <span className="font-bold text-slate-700">دليل الشارات والتمييز اللوني:</span>
        <span className="px-2 py-0.5 rounded bg-blue-700 text-white font-bold text-[11px] shadow-xs">رئيسي (أزرق)</span>
        <span className="px-2 py-0.5 rounded bg-slate-700 text-white font-bold text-[11px] shadow-xs">عام (رمادي غامق)</span>
        <span className="px-2 py-0.5 rounded bg-pink-200 text-pink-900 border border-pink-300 font-bold text-[11px] shadow-xs">مساعد (وردي)</span>
        <span className="px-2.5 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300 font-bold text-[11px] shadow-xs">فرعي تجميعي (أصفر)</span>
        <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[11px] shadow-xs flex items-center gap-1">
          <CheckCircle2 size={12} className="text-emerald-700" />
          حساب حركي طرفي • يقبل القيود (دائماً أخضر أياً كان مستواه)
        </span>
      </div>

      {/* حاوية الشجرة الهرمية المغلفة لطباعة الـ PDF */}
      <div ref={treePrintRef} id="chart-of-accounts-print-area" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm min-h-[400px]">
        {/* ترويسة رسمية خاصة بملف الـ PDF عند التصدير */}
        {isExportingPdf && (
          <div className="pb-4 mb-5 border-b border-slate-300">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-black text-slate-900">شجرة ودليل الحسابات المالية العامة</h1>
                <p className="text-xs text-slate-500 mt-1">
                  نظام لوجوستريا المحاسبي • التجميع الهرمي الصاعد (Hierarchical Rollup CTE Engine)
                </p>
              </div>
              <div className="text-left text-xs text-slate-500">
                <p>تاريخ التصدير: {new Date().toLocaleDateString('ar-SA')}</p>
                <p>عدد الحسابات في الدليل: {treeData.length > 0 ? 'مكتمل' : 'فارغ'}</p>
              </div>
            </div>
          </div>
        )}
        {loading ? (
          <div className="py-20 text-center text-slate-400 space-y-3">
            <RefreshCw size={32} className="animate-spin mx-auto text-indigo-500" />
            <p className="font-medium text-sm">جاري بناء شجرة الحسابات واحتساب الأرصدة التراكمية صعوداً...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-center">
            <p className="font-bold">{errorMsg}</p>
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <p className="font-medium text-sm">لا توجد حسابات تطابق مصطلح البحث المحدد ({searchTerm}).</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredTree.map(rootNode => (
              <TreeNodeItem
                key={rootNode.id}
                node={rootNode}
                searchTerm={searchTerm}
                expandedIds={expandedIds}
                toggleExpand={toggleExpand}
                onInspectRollup={handleInspectRollup}
                onAddChild={handleOpenAdd}
                onEditNode={handleOpenEdit}
                onDeleteNode={handleOpenDelete}
                onToggleActive={handleToggleActive}
                currencySymbol={currencySymbol}
              />
            ))}
          </div>
        )}
      </div>

      {/* مؤشر تحميل فحص الرصيد التجميعي */}
      {rollupLoading && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 shadow-xl border border-slate-200 flex items-center gap-3">
            <Loader2 className="animate-spin text-indigo-600" size={24} />
            <span className="text-sm font-bold text-slate-800">جاري حساب التجميع الهرمي (CTE Rollup)...</span>
          </div>
        </div>
      )}

      
      {/* نافذة إضافة حساب فرعي جديد */}
      {isAddModalOpen && selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col" dir="rtl">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Plus size={18} className="text-emerald-600" />
                <span>إضافة حساب فرعي متفرع من ({selectedNode.code} - {selectedNode.nameAr})</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitAdd} className="p-5 flex flex-col gap-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                <Info size={16} className="text-blue-600 shrink-0" />
                <span>
                  {selectedNode.children.length === 0
                    ? `سيتم إضافة الحساب بالمستوى ${selectedNode.level + 1} كعقدة طرفية حركية (Leaf Node) تقبل القيود، وسيتحول الحساب الأب (${selectedNode.nameAr}) تلقائياً إلى حساب تجميعي.`
                    : `سيتم إنشاء حساب فرعي بالمستوى ${selectedNode.level + 1} كعقدة طرفية (Leaf Node) تقبل تسجيل القيود.`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>كود الحساب المالي *</span>
                    <span className="text-[10px] text-blue-600 font-normal">تلقائي قابل للتعديل</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.trim()})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="مثال: 110101"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم الحساب (عربي) *</label>
                  <input
                    type="text"
                    required
                    value={formData.nameAr}
                    onChange={(e) => setFormData({...formData, nameAr: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="مثال: صندوق فرع الرياض"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الحساب (إنجليزي)</label>
                <input
                  type="text"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({...formData, nameEn: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="e.g. Riyadh Branch Cash Drawer"
                />
              </div>

              {/* اختيار تصنيف الأصل عند الإضافة تحت الأصول */}
              {(selectedNode.code === '1' || selectedNode.type === 'ASSET') && (
                <div className="p-3 bg-sky-50/70 rounded-xl border border-sky-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Building2 size={15} className="text-sky-700" />
                      <span>تصنيف الأصل في الميزانية العمومية</span>
                    </label>
                    <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded border border-sky-200">
                      معايير IFRS
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, assetClassification: 'CURRENT' })}
                      className={`flex items-start gap-2 p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                        formData.assetClassification === 'CURRENT'
                          ? 'bg-blue-600 text-white border-blue-700 shadow-sm ring-2 ring-blue-400/40'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-blue-300'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        formData.assetClassification === 'CURRENT' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                      }`}>
                        <Coins size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold block">الأصول المتداولة</span>
                        <span className={`text-[10px] block mt-0.5 ${
                          formData.assetClassification === 'CURRENT' ? 'text-blue-100' : 'text-slate-500'
                        }`}>
                          نقدية، بنوك، عملاء، مخزون (كود 11x)
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, assetClassification: 'NON_CURRENT' })}
                      className={`flex items-start gap-2 p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                        formData.assetClassification === 'NON_CURRENT'
                          ? 'bg-indigo-700 text-white border-indigo-800 shadow-sm ring-2 ring-indigo-400/40'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-indigo-300'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        formData.assetClassification === 'NON_CURRENT' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        <Building2 size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold block">الأصول غير المتداولة (الثابتة)</span>
                        <span className={`text-[10px] block mt-0.5 ${
                          formData.assetClassification === 'NON_CURRENT' ? 'text-indigo-100' : 'text-slate-500'
                        }`}>
                          آلات، مباني، سيارات، أصول ثابتة (كود 12x)
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* خانة اختيار المستوى المحاسبي للحساب الجديد */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Layers size={14} className="text-blue-600" />
                  <span>المستوى المحاسبي للحساب الجديد *</span>
                </label>
                <select
                  value={formData.level}
                  onChange={(e) => {
                    const newLvl = Number(e.target.value);
                    setFormData({
                      ...formData,
                      level: newLvl,
                      isPosting: newLvl >= 3
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value={2}>المستوى 2: عام (General - حساب عام تجميعي)</option>
                  <option value={3}>المستوى 3: مساعد (Subsidiary - حساب مساعد)</option>
                  <option value={4}>المستوى 4: حساب فرعي (Sub-account - يقبل القيود كعقدة طرفية)</option>
                  <option value={5}>المستوى 5: حساب تحليلي (Analytical - يقبل القيود كعقدة طرفية)</option>
                </select>
                <div className="mt-1.5 flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-medium">معاينة الشارة:</span>
                    {getLevelBadge(formData.level, formData.level >= 3, false)}
                  </div>
                  <span className="text-[10px] text-emerald-700 font-bold">
                    عقدة طرفية جديدة (Leaf Node): تقبل القيود تلقائياً
                  </span>
                </div>
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-sm transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  تأكيد الإضافة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تعديل الحساب وفق القواعد الذهبية */}
      {isEditModalOpen && selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" dir="rtl">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
                  <Edit2 size={18} className="text-blue-600" />
                  <span>تعديل الحساب المالي (وفق القواعد الذهبية)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  الكود الحالي: {selectedNode.code} • {selectedNode.nameAr}
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitEdit} className="p-5 flex flex-col gap-4 overflow-y-auto">
              {/* إشعار حالة الحركات والقواعد الذهبية */}
              {editTxCheck?.hasTransactions ? (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <ShieldAlert size={15} className="text-amber-600" />
                    <span>تم رصد حركات مالية مسجلة على هذا الحساب</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    القواعد الذهبية: يُسمح بتعديل الاسم دائماً، وتعديل الكود مع التحديث التعاقبي (Cascade Update). ويُمنع تماماً تغيير النوع أو المستوى لحماية معادلات الميزانية.
                  </p>
                </div>
              ) : selectedNode.isSystemLocked ? (
                <div className="p-3 bg-slate-100 border border-slate-300 rounded-xl text-xs text-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <Lock size={15} className="text-amber-500" />
                    <span>حساب مقدس محمي بالنظام (System Locked)</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    حساب المستوى 1 أو 2 الأساسي: الكود والنوع مقفلان بالنظام، ويُسمح فقط بتعديل الاسم التوضيحي.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>الحساب جديد أو خالي من الحركات: كافة خيارات التعديل متاحة.</span>
                </div>
              )}

              {/* 1. اسم الحساب (مسموح دائماً) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">اسم الحساب (عربي) *</label>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    مسموح دائماً وفي أي وقت
                  </span>
                </div>
                <input
                  type="text"
                  required
                  value={formData.nameAr}
                  onChange={(e) => setFormData({...formData, nameAr: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="اسم الحساب بالعربية"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الحساب (إنجليزي)</label>
                <input
                  type="text"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({...formData, nameEn: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Account English Name"
                />
              </div>

              {/* 2. كود الحساب (الرقم) مع التحديث التعاقبي */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">كود الحساب (الرقم)</label>
                  {selectedNode.isSystemLocked ? (
                    <span className="text-[10px] text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-300 flex items-center gap-1">
                      <Lock size={10} />
                      مقفل بالنظام (System Locked)
                    </span>
                  ) : (
                    <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      مسموح بشروط (Cascade Update)
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  disabled={selectedNode.isSystemLocked}
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  className={`w-full px-3 py-2 font-mono text-sm rounded-lg border ${
                    selectedNode.isSystemLocked
                      ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200'
                      : 'bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50'
                  }`}
                />
                {!selectedNode.isSystemLocked && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    عند تغيير الكود، سيتم تحديث هذا الكود تلقائياً في كافة القيود والسندات والفواتير المرتبطة به عبر خاصية التحديث التعاقبي.
                  </p>
                )}
              </div>

              {/* 3. المستوى المحاسبي: عام، مساعد، فرعي تجميعي، تحليلي حركي */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Layers size={14} className="text-blue-600" />
                    <span>المستوى المحاسبي في شجرة الحسابات *</span>
                  </label>
                  {editTxCheck?.hasTransactions || selectedNode.isSystemLocked ? (
                    <span className="text-[10px] text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-300 flex items-center gap-1">
                      <Ban size={10} />
                      {selectedNode.isSystemLocked ? 'مقفل بالنظام (System Locked)' : 'ممنوع تماماً (Hard Block)'}
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      متاح للتعديل (حساب جديد)
                    </span>
                  )}
                </div>
                <select
                  disabled={Boolean(editTxCheck?.hasTransactions || selectedNode.isSystemLocked)}
                  value={formData.level}
                  onChange={(e) => {
                    const newLvl = Number(e.target.value);
                    const isLeaf = selectedNode.children.length === 0;
                    setFormData({
                      ...formData,
                      level: newLvl,
                      isPosting: isLeaf && newLvl >= 3
                    });
                  }}
                  className={`w-full px-3 py-2 text-sm rounded-lg border font-sans ${
                    editTxCheck?.hasTransactions || selectedNode.isSystemLocked
                      ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200'
                      : 'bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50'
                  }`}
                >
                  {selectedNode.level === 1 && (
                    <option value={1}>المستوى 1: رئيسي (Root - الحسابات الجذرية الأساسية)</option>
                  )}
                  <option value={2}>المستوى 2: عام (General - الحسابات العامة التجميعية)</option>
                  <option value={3}>المستوى 3: مساعد (Subsidiary - حساب مساعد)</option>
                  <option value={4}>المستوى 4: حساب فرعي (Sub-account - يقبل القيود كعقدة طرفية)</option>
                  <option value={5}>المستوى 5: حساب تحليلي (Analytical - يقبل القيود كعقدة طرفية)</option>
                </select>

                <div className="mt-1.5 flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-medium">معاينة الشارة:</span>
                    {getLevelBadge(formData.level, formData.isPosting, selectedNode.children.length > 0)}
                  </div>
                  <span className="text-[10px] text-slate-600 font-medium">
                    {selectedNode.children.length > 0
                      ? 'حساب تجميعي للأبناء (Aggregation) - لا يقبل قيود مباشرة لوجود أبناء تحته'
                      : (formData.isPosting ? 'عقدة طرفية (Leaf Node) - يقبل تسجيل القيود مباشرة' : 'حساب تجميعي')}
                  </span>
                </div>

                {(editTxCheck?.hasTransactions || selectedNode.isSystemLocked) && (
                  <p className="text-[10px] text-rose-600 mt-1 font-medium">
                    {selectedNode.isSystemLocked 
                      ? 'حساب مقدس محمي بالنظام (مستوى 1 أو 2) لا يمكن تغيير مستواه.'
                      : 'القواعد الذهبية: يمنع تحويل الحساب الحركي إلى تجميعي أو العكس بعد تسجيل حركات مالية عليه لحماية الميزانية وميزان المراجعة.'}
                  </p>
                )}
              </div>

              {/* 4. تعديل النوع والمستوى (ممنوع تماماً بعد تسجيل الحركات) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">طبيعة ونوع الحساب</label>
                  {editTxCheck?.hasTransactions || selectedNode.isSystemLocked ? (
                    <span className="text-[10px] text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-300 flex items-center gap-1">
                      <Ban size={10} />
                      ممنوع تماماً (Hard Block)
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      متاح للتعديل (حساب جديد)
                    </span>
                  )}
                </div>
                <select
                  disabled={Boolean(editTxCheck?.hasTransactions || selectedNode.isSystemLocked)}
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value as AccountType})}
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${
                    editTxCheck?.hasTransactions || selectedNode.isSystemLocked
                      ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200'
                      : 'bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50'
                  }`}
                >
                  <option value="ASSET">أصول (ASSET)</option>
                  <option value="LIABILITY">خصوم والتزامات (LIABILITY)</option>
                  <option value="EQUITY">حقوق ملكية (EQUITY)</option>
                  <option value="REVENUE">إيرادات (REVENUE)</option>
                  <option value="EXPENSE">مصروفات (EXPENSE)</option>
                </select>
                {(editTxCheck?.hasTransactions || selectedNode.isSystemLocked) && (
                  <p className="text-[10px] text-rose-600 mt-1 font-medium">
                    ممنوع نقل الحساب من طبيعة لأخرى لحماية سلامة الميزانية وميزان المراجعة.
                  </p>
                )}
              </div>

              {/* تصنيف الأصل: إمكانية الاختيار بين الأصول المتداولة والأصول غير المتداولة (الثابتة) */}
              {formData.type === 'ASSET' && (
                <div className="p-3.5 bg-sky-50/70 rounded-xl border border-sky-200 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Building2 size={16} className="text-sky-700" />
                      <span>تصنيف الأصل في الميزانية العمومية *</span>
                    </label>
                    <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded border border-sky-200">
                      معايير المحاسبة الدولية (IFRS / GAAP)
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    حدد تصنيف الأصل في شجرة الحسابات وقائمة المركز المالي للتحكم في موقعه المالي والتقارير:
                  </p>

                  {selectedNode.isSystemLocked && (selectedNode.code === '1' || selectedNode.code === '11' || selectedNode.code === '12') ? (
                    <div className="p-3 bg-white/90 rounded-xl border border-sky-200 text-xs text-slate-700 flex items-center gap-2.5">
                      <Lock size={15} className="text-amber-600 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-800 block">
                          {selectedNode.code === '11'
                            ? 'حساب مقفل بالنظام: المظلة الرئيسية لقسم (الأصول المتداولة).'
                            : selectedNode.code === '12'
                            ? 'حساب مقفل بالنظام: المظلة الرئيسية لقسم (الأصول غير المتداولة / الثابتة).'
                            : 'حساب مقفل بالنظام: الجذر العام لشجرة الأصول (المستوى 1).'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          لا يمكن تغيير تصنيف حسابات المظلة النظامية العليا.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
                      {/* الخيار الأول: الأصول المتداولة */}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, assetClassification: 'CURRENT' })}
                        className={`flex items-start gap-2.5 p-3 rounded-xl border text-right transition-all cursor-pointer ${
                          formData.assetClassification === 'CURRENT'
                            ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-400/50'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-blue-300'
                        }`}
                      >
                        <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                          formData.assetClassification === 'CURRENT' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'
                        }`}>
                          <Coins size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold block">الأصول المتداولة</span>
                            {formData.assetClassification === 'CURRENT' && (
                              <CheckCircle2 size={15} className="text-white shrink-0" />
                            )}
                          </div>
                          <span className={`text-[10px] block mt-1 leading-relaxed ${
                            formData.assetClassification === 'CURRENT' ? 'text-blue-100' : 'text-slate-500'
                          }`}>
                            أصول قصيرة الأجل (نقدية، بنوك، عملاء، مخزون، دفعات مقدمة) يُتوقع تحويلها لنقدية خلال سنة مالية أو دورة تشغيلية.
                          </span>
                          <div className="mt-2 flex items-center gap-1 font-mono text-[10px] font-semibold">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                              formData.assetClassification === 'CURRENT' ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-600'
                            }`}>
                              المجموعة: 11 (Current Assets)
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* الخيار الثاني: الأصول غير المتداولة (الثابتة) */}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, assetClassification: 'NON_CURRENT' })}
                        className={`flex items-start gap-2.5 p-3 rounded-xl border text-right transition-all cursor-pointer ${
                          formData.assetClassification === 'NON_CURRENT'
                            ? 'bg-indigo-700 text-white border-indigo-800 shadow-md ring-2 ring-indigo-400/50'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-indigo-300'
                        }`}
                      >
                        <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                          formData.assetClassification === 'NON_CURRENT' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          <Building2 size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold block">الأصول غير المتداولة (الثابتة)</span>
                            {formData.assetClassification === 'NON_CURRENT' && (
                              <CheckCircle2 size={15} className="text-white shrink-0" />
                            )}
                          </div>
                          <span className={`text-[10px] block mt-1 leading-relaxed ${
                            formData.assetClassification === 'NON_CURRENT' ? 'text-indigo-100' : 'text-slate-500'
                          }`}>
                            أصول طويلة الأجل مقتناة للاستخدام التشغيلي والإنتاجي (عقارات، آلات ومعدات، سيارات، أصول غير ملموسة، مجمع إهلاك).
                          </span>
                          <div className="mt-2 flex items-center gap-1 font-mono text-[10px] font-semibold">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                              formData.assetClassification === 'NON_CURRENT' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-100 text-slate-600'
                            }`}>
                              المجموعة: 12 (Non-Current Assets)
                            </span>
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 4. البديل الهندسي: إيقاف الحساب / تنشيطه (Deactivate / Archive) */}
              {!selectedNode.isSystemLocked && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        حالة الحساب في النظام (البديل الهندسي الآمن)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {formData.isActive
                          ? 'الحساب نشط ويظهر في جميع القوائم وشاشات الإدخال'
                          : 'الحساب موقوف (مؤرشف): مخفي من شاشات الإدخال مع الحفاظ على حركاته السابقة بالتقارير'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        formData.isActive
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-amber-500 text-white hover:bg-amber-600'
                      }`}
                    >
                      <Power size={13} />
                      <span>{formData.isActive ? 'الحساب نشط' : 'الحساب موقوف'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-sm transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  حفظ التعديلات وفق القواعد الذهبية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة حوكمة حذف الحساب المالي (القواعد الذهبية للحذف والمنع القاطع) */}
      {isDeleteModalOpen && deleteTargetNode && deleteCheck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col" dir="rtl">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
                <ShieldAlert size={20} className={deleteCheck.allowed ? 'text-emerald-600' : 'text-rose-600'} />
                <span>حوكمة حذف الحساب المالي (القواعد الذهبية)</span>
              </h3>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-right">
              {/* تفاصيل الحساب المستهدف */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">كود الحساب:</span>
                  <span className="font-mono font-bold bg-slate-200 px-2.5 py-0.5 rounded text-slate-900">
                    {deleteTargetNode.code}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">اسم الحساب:</span>
                  <span className="font-bold text-slate-800">{deleteTargetNode.nameAr}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">المستوى المحاسبي:</span>
                  <span>{getLevelBadge(deleteTargetNode.level, deleteTargetNode.isPosting, deleteTargetNode.children.length > 0)}</span>
                </div>
              </div>

              {/* الحالة 1: حساب مقدس محمي بالنظام (System Locked L1/L2) */}
              {deleteCheck.isSystemLocked && (
                <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2 border border-amber-400/40">
                  <div className="flex items-center gap-2 text-amber-300 font-black text-sm">
                    <Lock size={18} />
                    <span>حساب مقدس محمي بالنظام (System Locked)</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {deleteCheck.reason}
                  </p>
                  <p className="text-[11px] text-amber-200/80">
                    حسابات المستوى 1 و 2 تشكل الهيكل الرئيسي للميزانية وقائمة الدخل ولا يمكن حذفها نهائياً تحت أي ظرف.
                  </p>
                </div>
              )}

              {/* الحالة 2: حساب تجميعي يتفرع تحته حسابات أبناء */}
              {!deleteCheck.isSystemLocked && deleteCheck.hasChildren && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-amber-900">
                  <div className="flex items-center gap-2 font-bold text-amber-800 text-sm">
                    <Building2 size={18} />
                    <span>حساب فرعي تجميعي يضم حسابات فرعية</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    {deleteCheck.reason}
                  </p>
                  <p className="text-[11px] text-amber-700">
                    لحذف هذا الحساب، يجب أولاً حذف أو إعادة ربط كافة الحسابات الفرعية التابعة له.
                  </p>
                </div>
              )}

              {/* الحالة 3: منع قاطع (Hard Block) لوجود حركات مالية مسجلة */}
              {!deleteCheck.isSystemLocked && !deleteCheck.hasChildren && deleteCheck.hasTransactions && (
                <div className="space-y-3">
                  <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-2 text-rose-900">
                    <div className="flex items-center gap-2 font-extrabold text-rose-700 text-sm">
                      <Ban size={18} />
                      <span>منع قاطع (Hard Block) - الحذف ممنوع نهائياً</span>
                    </div>
                    <p className="text-xs leading-relaxed font-medium">
                      {deleteCheck.reason}
                    </p>
                    
                    {deleteCheck.reasonsList && deleteCheck.reasonsList.length > 0 && (
                      <div className="pt-2 border-t border-rose-200">
                        <span className="text-[11px] font-bold text-rose-800 block mb-1">تفاصيل الحركات المسجلة التي تمنع الحذف:</span>
                        <ul className="list-disc list-inside text-[11px] text-rose-700 space-y-0.5">
                          {deleteCheck.reasonsList.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* البديل الهندسي الآمن: إيقاف الحساب / أرشفة */}
                  <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2.5 text-emerald-950">
                    <div className="flex items-center gap-2 font-black text-emerald-800 text-xs sm:text-sm">
                      <ShieldCheck size={18} className="text-emerald-600" />
                      <span>البديل الهندسي الآمن: إيقاف الحساب وأرشفته (Deactivate)</span>
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      بدلاً من الحذف، يوفر النظام خيار <strong>"إيقاف الحساب"</strong>. عند إيقاف هذا الحساب، سيختفي تلقائياً من القوائم المنسدلة وشاشات إدخال البيانات الجديدة، مع بقائه محفوظاً بقاعدة البيانات لتظهر حركاته السابقة بدقة في ميزان المراجعة والتقارير التاريخية.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(deleteTargetNode)}
                      className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Power size={14} />
                      <span>
                        {deleteTargetNode.isActive !== false
                          ? 'تطبيق البديل الهندسي: إيقاف الحساب وأرشفته الآن'
                          : 'إعادة تنشيط الحساب وإتاحته للعمليات'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* الحالة 4: الحذف المسموح (حساب جديد خالي من الحركات) */}
              {deleteCheck.allowed && (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2 text-emerald-900">
                  <div className="flex items-center gap-2 font-black text-emerald-700 text-sm">
                    <CheckCircle2 size={18} />
                    <span>الحذف مسموح (Allowed Deletion)</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    {deleteCheck.reason}
                  </p>
                  <p className="text-[11px] text-emerald-700 font-medium">
                    يمكن حذف هذا الحساب بأمان تام ولن يترك أي أثر على ميزان المراجعة أو القوائم المالية.
                  </p>
                </div>
              )}

              {/* أزرار الإجراءات */}
              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-sm transition-colors cursor-pointer"
                >
                  إغلاق النافذة
                </button>

                {deleteCheck.allowed && (
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-sm transition-colors cursor-pointer flex justify-center items-center gap-2 shadow-sm"
                  >
                    {isDeleting && <Loader2 size={16} className="animate-spin" />}
                    <span>تأكيد الحذف النهائي</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة الدليل الشامل للقواعد الذهبية ومستويات شجرة الحسابات المالية */}
      {isGoldenRulesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" dir="rtl">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
              <div className="flex items-center gap-2.5">
                <ShieldAlert size={22} className="text-amber-400" />
                <div>
                  <h3 className="font-black text-base sm:text-lg text-amber-300">
                    الدليل الشامل: القواعد الذهبية ومستويات شجرة الحسابات المالية
                  </h3>
                  <p className="text-xs text-slate-300">
                    المرجع المحاسبي والهندسي القياسي لنظام الحسابات العامة
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsGoldenRulesModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-right text-slate-800 text-xs sm:text-sm">
              {/* القسم الأول: مستويات شجرة الحسابات المالية الـ 5 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <Layers size={18} className="text-indigo-600" />
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                    1. مستويات شجرة الحسابات المالية الـ 5 المعتمدة
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-1">
                    <span className="font-extrabold text-blue-900 text-xs block">رئيسي (Root)</span>
                    <p className="text-[11px] text-blue-800">الأصول، الخصوم، حقوق الملكية، الإيرادات، المصروفات (مقدس محمي بالنظام).</p>
                  </div>
                  <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 space-y-1">
                    <span className="font-extrabold text-indigo-900 text-xs block">عام (General)</span>
                    <p className="text-[11px] text-indigo-800">الأصول المتداولة، الثابتة، الخصوم المتداولة، رأس المال (مقدس محمي).</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-100 border border-slate-300 space-y-1">
                    <span className="font-extrabold text-slate-900 text-xs block">المستوى 3: مساعد (Subsidiary)</span>
                    <p className="text-[11px] text-slate-700">النقدية بالبنوك، العملاء، المخزون، الموردين، القروض، المبيعات.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 space-y-1">
                    <span className="font-extrabold text-amber-900 text-xs block">المستوى 4: حساب فرعي (Sub-account)</span>
                    <p className="text-[11px] text-amber-800">حساب فرعي يقبل القيود تلقائياً كـ (Leaf Node) إذا لم يتفرع تحته أبناء، ويتحول لتجميعي Rollup فور إضافة أبناء تحته.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 space-y-1">
                    <span className="font-extrabold text-emerald-900 text-xs block">المستوى 5: تحليلي حركي (Analytical)</span>
                    <p className="text-[11px] text-emerald-800">عقدة طرفية حركية تقبل القيود والفواتير، وتتحول لتجميعية تلقائياً في حال تفريع حسابات تحتها.</p>
                  </div>
                </div>
              </div>

              {/* القسم الثاني: جدول المقارنة الحاسم بين الحساب التحليلي الحركي والحساب الفرعي التجميعي */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <Scale size={18} className="text-emerald-600" />
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                    2. الفرق بين (عقدة طرفية حركية تقبل القيود Leaf Node) و (عقدة فرعية تجميعية Aggregation Node)
                  </h4>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-extrabold border-b border-slate-200">
                        <th className="p-3 w-1/4">وجه المقارنة</th>
                        <th className="p-3 w-3/8 text-emerald-800 bg-emerald-50/60">عقدة طرفية حركية (تقبل القيود Leaf Node)</th>
                        <th className="p-3 w-3/8 text-amber-800 bg-amber-50/60">عقدة تجميعية (Aggregation Summary)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="p-3 font-bold text-slate-700 bg-slate-50">الموقع الهرمي وحالة الأبناء</td>
                        <td className="p-3 text-emerald-900">أي حساب بلا أبناء متفرعين تحته (children.length === 0)</td>
                        <td className="p-3 text-amber-900">أي حساب يتفرع تحته أبناء (children.length &gt; 0)</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-slate-700 bg-slate-50">قبول القيود والفواتير</td>
                        <td className="p-3 text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          <span>نعم: يقبل قيود اليومية، الفواتير، وسندات القبض/الصرف</span>
                        </td>
                        <td className="p-3 text-rose-700 font-bold">
                          ممنوع قطعي: لا يقبل أي قيد أو فاتورة مباشرة نهائياً
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-slate-700 bg-slate-50">تفرع حسابات تحته</td>
                        <td className="p-3">لا يتفرع تحته أي حساب (حساب طرفي نهائي)</td>
                        <td className="p-3">نعم يتفرع تحته حسابات فرعية وتحليلية تابعة له</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-slate-700 bg-slate-50">احتساب الرصيد</td>
                        <td className="p-3">من واقع الحركات المدينة والدائنة المسجلة عليه مباشرة</td>
                        <td className="p-3 font-bold text-indigo-700">التجميع التراكمي الصاعد (Hierarchical Rollup CTE) لجميع أبنائه</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-slate-700 bg-slate-50">الهدف المحاسبي</td>
                        <td className="p-3">تسجيل الوقائع والعمليات المالية الدقيقة والتفصيلية</td>
                        <td className="p-3">تلخيص وعرض الإجماليات الرقابية في القوائم والتقارير المالية دون تشويه ميزان المراجعة</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* القسم الثالث: القواعد الذهبية الثلاث للإزالة والتعديل */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <ShieldAlert size={18} className="text-amber-600" />
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                    3. القواعد الذهبية المحاسبية والهندسية (Golden Rules)
                  </h4>
                </div>

                <div className="space-y-3">
                  {/* قاعدة 1: قواعد الحذف */}
                  <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/60 space-y-2">
                    <h5 className="font-extrabold text-rose-900 text-xs sm:text-sm flex items-center gap-1.5">
                      <Trash2 size={16} className="text-rose-600" />
                      <span>قواعد الإزالة والحذف (Deletion Rules)</span>
                    </h5>
                    <ul className="space-y-1.5 text-xs text-rose-950 leading-relaxed pr-2">
                      <li>
                        <strong>الحذف المسموح:</strong> يُسمح بحذف الحساب فقط إذا كان جديداً ولم تُسجل عليه أي حركة مالية نهائياً (لم يرتبط بقيد، سند، فاتورة، أو رصيد افتتاحي).
                      </li>
                      <li>
                        <strong>الحذف الممنوع (Hard Block):</strong> يمنع النظام حذف الحساب نهائياً بمجرد تسجيل ولو حركة واحدة عليه. السماح بحذفه سيؤدي إلى كسر القيود المرتبطة به وتدمير ميزان المراجعة.
                      </li>
                      <li>
                        <strong>البديل الهندسي (الإيقاف/التعطيل):</strong> بدلاً من الحذف، يوفر النظام خيار "إيقاف الحساب" (Deactivate/Archive). عند إيقاف حساب قديم، فإنه يختفي من القوائم المنسدلة وشاشات إدخال البيانات الجديدة، ولكنه يظل محفوظاً في قاعدة البيانات لتظهر حركاته القديمة بشكل سليم في التقارير التاريخية.
                      </li>
                    </ul>
                  </div>

                  {/* قاعدة 2: قواعد التعديل */}
                  <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/60 space-y-2">
                    <h5 className="font-extrabold text-blue-900 text-xs sm:text-sm flex items-center gap-1.5">
                      <Edit2 size={16} className="text-blue-600" />
                      <span>قواعد التعديل (Modification Rules)</span>
                    </h5>
                    <ul className="space-y-1.5 text-xs text-blue-950 leading-relaxed pr-2">
                      <li>
                        <strong>تعديل اسم الحساب:</strong> مسموح دائماً وفي أي وقت (مثلاً: تغيير الاسم من "بنك مصر" إلى "بنك مصر - فرع رئيسي"). تغيير النص لا يؤثر على العمليات الحسابية.
                      </li>
                      <li>
                        <strong>تعديل كود الحساب (الرقم):</strong> مسموح بشروط. إذا تم تغيير الكود، تتكفل قاعدة البيانات بتحديث هذا الكود تلقائياً في جميع القيود والفواتير والسندات المرتبطة به عبر خاصية (Cascade Update).
                      </li>
                      <li>
                        <strong>تعديل النوع والمستوى:</strong> ممنوع تماماً بعد تسجيل الحركات. لا يجب أن تسمح للمستخدم بتحويل حساب حركي (يقبل القيود) إلى حساب تجميعي، ولا بنقل حساب من طبيعة (الأصول) إلى (المصروفات)، لأن هذا سيخرب معادلات الميزانية.
                      </li>
                    </ul>
                  </div>

                  {/* قاعدة 3: حماية الحسابات المقدسة */}
                  <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/70 space-y-2">
                    <h5 className="font-extrabold text-amber-900 text-xs sm:text-sm flex items-center gap-1.5">
                      <Lock size={16} className="text-amber-600" />
                      <span>حماية الحسابات "المقدسة" (System / Root Accounts)</span>
                    </h5>
                    <p className="text-xs text-amber-950 leading-relaxed">
                      المستويات العُليا الأساسية (مستوى 1 و 2) مثل (الأصول، الخصوم، حقوق الملكية، الإيرادات، المصروفات) محمية من قِبل النظام برمجياً (System Locked). لا يسمح النظام للمستخدم بتغيير أكوادها أو حذفها نهائياً لضمان استقرار الشجرة والميزانية العمومية.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsGoldenRulesModalOpen(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer shadow-md"
              >
                إغلاق الدليل والعودة للشجرة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة منبثقة لفحص تحليل الـ CTE Rollup */}
      {activeRollup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BarChart3 className="text-indigo-600" size={20} />
                <h3 className="font-bold text-slate-800 text-base">
                  تحليل الرصيد المجمع صعوداً (CTE Rollup Result)
                </h3>
              </div>
              <button
                onClick={() => setActiveRollup(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">كود الحساب:</span>
                <span className="font-mono font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-800">
                  {activeRollup.accountCode}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">اسم الحساب:</span>
                <span className="font-bold text-slate-800">{activeRollup.accountNameAr}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">المستوى في الشجرة:</span>
                <span className="font-bold text-indigo-700">المستوى {activeRollup.level}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">الحسابات والأبناء المشمولة بالتجميع:</span>
                <span className="font-bold text-slate-700">{activeRollup.affectedAccountsCount} حساب</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <span className="text-[11px] text-blue-700 block font-bold mb-1">إجمالي المدين</span>
                <span className="font-mono font-extrabold text-blue-800 text-sm">
                  {new Intl.NumberFormat('ar-SA').format(activeRollup.total_debit)}
                </span>
              </div>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                <span className="text-[11px] text-purple-700 block font-bold mb-1">إجمالي الدائن</span>
                <span className="font-mono font-extrabold text-purple-800 text-sm">
                  {new Intl.NumberFormat('ar-SA').format(activeRollup.total_credit)}
                </span>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="text-[11px] text-emerald-700 block font-bold mb-1">الرصيد الصافي</span>
                <span className="font-mono font-extrabold text-emerald-800 text-sm">
                  {new Intl.NumberFormat('ar-SA').format(activeRollup.net_balance)}
                </span>
              </div>
            </div>

            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-center gap-2">
              <span className="font-mono text-indigo-700 font-bold">SQL CTE:</span>
              <span>تم استدعاء المسار <code>GET /api/accounts/{activeRollup.accountCode}/rollup-balance</code> بنجاح.</span>
            </div>

            <button
              onClick={() => setActiveRollup(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>
      )}

      {/* نافذة منبثقة لسجل التراجع والعمليات السابقة */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 text-right space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <History className="text-indigo-600" size={20} />
                <h3 className="font-bold text-slate-800 text-base">
                  سجل التراجع والعمليات الأخيرة على شجرة الحسابات
                </h3>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 shrink-0">
              يسجل هذا النظام كافة التعديلات، الإضافات، الحذف، وتغيير الحالات ليتيح لك التراجع الفوري بضغطة زر دون الإخلال بتوازن القيود.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {historyList.length === 0 ? (
                <div className="text-center py-10 text-slate-400 space-y-2">
                  <History size={32} className="mx-auto opacity-30 text-indigo-400" />
                  <p className="text-xs">لا توجد عمليات مسجلة في جلسة العمل الحالية بعد.</p>
                </div>
              ) : (
                [...historyList].reverse().map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border transition-all text-xs flex items-center justify-between gap-3 ${
                      idx === 0 
                        ? 'bg-indigo-50/60 border-indigo-200 shadow-xs' 
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          item.type === 'CREATE' ? 'bg-emerald-100 text-emerald-800' :
                          item.type === 'DELETE' ? 'bg-rose-100 text-rose-800' :
                          item.type === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {item.type === 'CREATE' ? 'إضافة' :
                           item.type === 'DELETE' ? 'حذف' :
                           item.type === 'UPDATE' ? 'تعديل' : 'حالة'}
                        </span>
                        <span className="font-bold text-slate-800">{item.title}</span>
                        {idx === 0 && (
                          <span className="bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded">
                            آخر إجراء
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 text-[11px]">{item.description}</p>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {new Date(item.timestamp).toLocaleTimeString('ar-SA')} - {new Date(item.timestamp).toLocaleDateString('ar-SA')}
                      </span>
                    </div>

                    {idx === 0 && (
                      <button
                        onClick={async () => {
                          await handleUndo();
                          setIsHistoryModalOpen(false);
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-1 cursor-pointer"
                      >
                        <Undo2 size={13} />
                        تراجع الآن
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 font-medium">
                إجمالي العمليات المسجلة: {historyList.length}
              </span>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة مركز ربط شجرة الحسابات بكافة شاشات البرنامج */}
      <ErpAccountMappingModal
        isOpen={isIntegrationHubOpen}
        onClose={() => setIsIntegrationHubOpen(false)}
        currencySymbol={currencySymbol}
      />
    </div>
  );
}
