import { appCache } from './cacheService';
import { db } from './firebaseServer';
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, query, where } from 'firebase/firestore';

export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE'
}

export type SubLedgerType = 'NONE' | 'CUSTOMER' | 'VENDOR' | 'EMPLOYEE' | 'PARTNER';

export interface AccountRecord {
  id: string;
  tenantId: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  currency: string;
  type: AccountType;
  level: number; // 1 to 5
  isPosting: boolean;
  isActive: boolean;
  parentAccountId?: string | null;
  subLedgerType: SubLedgerType;
  totalDebit: number;
  totalCredit: number;
  createdAt: string;
  updatedAt: string;
}

export interface JournalLineRecord {
  id: string;
  journalEntryId: string;
  accountId: string;
  costCenterId: string | null;
  subLedgerId: string | null;
  debit: number;
  credit: number;
  amountForeign: number;
  exchangeRate: number;
  description: string;
}

export interface JournalEntryRecord {
  id: string;
  tenantId: string;
  entryNumber: string;
  date: string; // YYYY-MM-DD
  reference: string;
  description: string;
  totalDebit: number;
  totalCredit: number;
  status: 'DRAFT' | 'POSTED' | 'VOIDED';
  lines: JournalLineRecord[];
  createdAt: string;
}

export interface JournalEntryInput {
  tenantId: string;
  description: string;
  date?: string;
  reference?: string;
  lines: {
    accountId: string;
    isDebit: boolean;
    amountForeign: number;
    exchangeRate: number;
    costCenterId?: string;
    subLedgerId?: string;
    description?: string;
  }[];
}

export interface CreateAnalyticalAccountInput {
  tenantId: string;
  parentSubAccountId: string;
  nameAr: string;
  nameEn?: string;
  currency?: string;
  subLedgerType?: SubLedgerType;
}

export class AccountEngine {
  
  private seedLock: boolean = false;

  constructor() {
    this.seedInitialAccountsIfNeeded();
  }

  private async seedInitialAccountsIfNeeded() {
    if (this.seedLock) return;
    this.seedLock = true;
    try {
      const q = query(collection(db, 'accounts'), where('level', '==', 1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        
        return;
      }

      console.log("Seeding initial accounts into Firestore...");
      const defaultTenant = 'tenant_default';
      const now = new Date().toISOString();
      
      const seedAccounts: Partial<AccountRecord>[] = [
        // Level 1
        { id: 'acc_1', tenantId: defaultTenant, code: '1', nameAr: 'الأصول', type: AccountType.ASSET, level: 1, isPosting: false, isActive: true, subLedgerType: 'NONE' },
        { id: 'acc_2', tenantId: defaultTenant, code: '2', nameAr: 'الخصوم والالتزامات', type: AccountType.LIABILITY, level: 1, isPosting: false, isActive: true, subLedgerType: 'NONE' },
        { id: 'acc_3', tenantId: defaultTenant, code: '3', nameAr: 'حقوق الملكية', type: AccountType.EQUITY, level: 1, isPosting: false, isActive: true, subLedgerType: 'NONE' },
        { id: 'acc_4', tenantId: defaultTenant, code: '4', nameAr: 'الإيرادات', type: AccountType.REVENUE, level: 1, isPosting: false, isActive: true, subLedgerType: 'NONE' },
        { id: 'acc_5', tenantId: defaultTenant, code: '5', nameAr: 'المصروفات', type: AccountType.EXPENSE, level: 1, isPosting: false, isActive: true, subLedgerType: 'NONE' },
        // Level 2
        { id: 'acc_11', tenantId: defaultTenant, code: '11', nameAr: 'الأصول المتداولة', type: AccountType.ASSET, level: 2, isPosting: false, isActive: true, parentAccountId: 'acc_1', subLedgerType: 'NONE' },
        { id: 'acc_12', tenantId: defaultTenant, code: '12', nameAr: 'الأصول غير المتداولة (الثابتة)', type: AccountType.ASSET, level: 2, isPosting: false, isActive: true, parentAccountId: 'acc_1', subLedgerType: 'NONE' },
        { id: 'acc_21', tenantId: defaultTenant, code: '21', nameAr: 'الخصوم المتداولة', type: AccountType.LIABILITY, level: 2, isPosting: false, isActive: true, parentAccountId: 'acc_2', subLedgerType: 'NONE' },
        { id: 'acc_22', tenantId: defaultTenant, code: '22', nameAr: 'الخصوم غير المتداولة', type: AccountType.LIABILITY, level: 2, isPosting: false, isActive: true, parentAccountId: 'acc_2', subLedgerType: 'NONE' },
        // Level 3
        { id: 'acc_111', tenantId: defaultTenant, code: '111', nameAr: 'النقدية وما في حكمها', type: AccountType.ASSET, level: 3, isPosting: false, isActive: true, parentAccountId: 'acc_11', subLedgerType: 'NONE' },
        { id: 'acc_112', tenantId: defaultTenant, code: '112', nameAr: 'العملاء والذمم المدينة', type: AccountType.ASSET, level: 3, isPosting: false, isActive: true, parentAccountId: 'acc_11', subLedgerType: 'NONE' },
        { id: 'acc_113', tenantId: defaultTenant, code: '113', nameAr: 'المخزون', type: AccountType.ASSET, level: 3, isPosting: false, isActive: true, parentAccountId: 'acc_11', subLedgerType: 'NONE' },
        { id: 'acc_211', tenantId: defaultTenant, code: '211', nameAr: 'الموردين والذمم الدائنة', type: AccountType.LIABILITY, level: 3, isPosting: false, isActive: true, parentAccountId: 'acc_21', subLedgerType: 'NONE' },
        // Level 4
        { id: 'acc_1111', tenantId: defaultTenant, code: '1111', nameAr: 'الصندوق (النقدية بالصندوق)', type: AccountType.ASSET, level: 4, isPosting: false, isActive: true, parentAccountId: 'acc_111', subLedgerType: 'NONE' },
        { id: 'acc_1112', tenantId: defaultTenant, code: '1112', nameAr: 'البنوك', type: AccountType.ASSET, level: 4, isPosting: false, isActive: true, parentAccountId: 'acc_111', subLedgerType: 'NONE' },
        { id: 'acc_1121', tenantId: defaultTenant, code: '1121', nameAr: 'العملاء التجاريين', type: AccountType.ASSET, level: 4, isPosting: false, isActive: true, parentAccountId: 'acc_112', subLedgerType: 'CUSTOMER' },
        { id: 'acc_2111', tenantId: defaultTenant, code: '2111', nameAr: 'الموردين التجاريين', type: AccountType.LIABILITY, level: 4, isPosting: false, isActive: true, parentAccountId: 'acc_211', subLedgerType: 'VENDOR' },
      ];

      const batch = writeBatch(db);
      for (const acc of seedAccounts) {
        const fullAcc: AccountRecord = {
          ...acc,
          totalDebit: 0,
          totalCredit: 0,
          currency: 'SAR',
          createdAt: now,
          updatedAt: now,
        } as AccountRecord;
        batch.set(doc(db, 'accounts', fullAcc.id), fullAcc);
      }
      await batch.commit();
      
      console.log("Seeding complete.");
    } catch (e) {
      console.error("Seeding failed", e);
    }
  }

  async getAllAccounts(tenantId: string): Promise<AccountRecord[]> {
    const q = query(collection(db, 'accounts'), where('tenantId', '==', tenantId));
    const snapshot = await getDocs(q);
    const accounts = snapshot.docs.map(doc => doc.data() as AccountRecord);
    return accounts.sort((a, b) => a.code.localeCompare(b.code));
  }

  async getAllJournalEntries(tenantId: string): Promise<JournalEntryRecord[]> {
    const q = query(collection(db, 'journal_entries'), where('tenantId', '==', tenantId));
    const snapshot = await getDocs(q);
    const entries = snapshot.docs.map(doc => doc.data() as JournalEntryRecord);
    return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getNextAccountCode(tenantId: string, parentAccountId: string): Promise<string> {
    const allAccounts = await this.getAllAccounts(tenantId);
    const parent = allAccounts.find(a => a.id === parentAccountId);
    if (!parent) throw new Error("Parent not found");
    const children = allAccounts.filter(a => a.parentAccountId === parentAccountId);
    if (children.length === 0) {
      return `${parent.code}01`;
    }
    const codes = children.map(c => c.code).sort();
    const latestCode = codes[codes.length - 1]!;
    const prefix = parent.code;
    const suffix = latestCode.substring(prefix.length);
    const nextSeq = parseInt(suffix, 10) + 1;
    return `${prefix}${nextSeq.toString().padStart(suffix.length, '0')}`;
  }

  async createCustomAccount(input: { tenantId: string; parentAccountId: string; nameAr: string; nameEn?: string; isPosting?: boolean }): Promise<AccountRecord> {
    const code = await this.getNextAccountCode(input.tenantId, input.parentAccountId);
    const allAccounts = await this.getAllAccounts(input.tenantId);
    const parent = allAccounts.find(a => a.id === input.parentAccountId);
    if (!parent) throw new Error("Parent not found");

    const newAcc: AccountRecord = {
      id: `acc_${Date.now()}`,
      tenantId: input.tenantId,
      code,
      nameAr: input.nameAr,
      nameEn: input.nameEn || '',
      type: parent.type,
      level: parent.level + 1,
      isPosting: input.isPosting !== undefined ? input.isPosting : true,
      isActive: true,
      parentAccountId: parent.id,
      subLedgerType: parent.subLedgerType,
      currency: parent.currency,
      totalDebit: 0,
      totalCredit: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'accounts', newAcc.id), newAcc);
    appCache.invalidatePrefix(`chart_tree:${input.tenantId}`);
    appCache.invalidatePrefix(`rollup:${input.tenantId}`);
    return newAcc;
  }

  async updateAccount(accountId: string, updates: Partial<AccountRecord>): Promise<AccountRecord> {
    const docRef = doc(db, 'accounts', accountId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Account not found");
    const existing = docSnap.data() as AccountRecord;
    const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await updateDoc(docRef, merged);
    appCache.invalidatePrefix(`chart_tree:${existing.tenantId}`);
    appCache.invalidatePrefix(`rollup:${existing.tenantId}`);
    return merged;
  }

  async createAnalyticalAccount(input: CreateAnalyticalAccountInput): Promise<AccountRecord> {
    const newAcc = await this.createCustomAccount({
      tenantId: input.tenantId,
      parentAccountId: input.parentSubAccountId,
      nameAr: input.nameAr,
      ...(input.nameEn ? { nameEn: input.nameEn } : {}),
      isPosting: true
    });
    if (input.subLedgerType) {
      newAcc.subLedgerType = input.subLedgerType;
      await updateDoc(doc(db, 'accounts', newAcc.id), { subLedgerType: input.subLedgerType });
    }
    return newAcc;
  }

  private async validatePostingLine(line: any, allAccounts: AccountRecord[]): Promise<AccountRecord> {
    const account = allAccounts.find(a => a.id === line.accountId);
    if (!account) throw new Error(`Account ${line.accountId} not found.`);
    if (!account.isActive) throw new Error(`Account ${account.code} is inactive.`);
    if (!account.isPosting) throw new Error(`Account ${account.code} is not a posting account.`);
    return account;
  }

  async createJournalEntry(input: JournalEntryInput): Promise<JournalEntryRecord> {
    const { tenantId, description, lines, date, reference } = input;
    if (!lines || lines.length < 2) throw new Error("Journal entry must have at least 2 lines.");
    
    let totalDebit = 0, totalCredit = 0;
    const allAccounts = await this.getAllAccounts(tenantId);

    for (const line of lines) {
      await this.validatePostingLine(line, allAccounts);
      const amount = Math.round(line.amountForeign * (line.exchangeRate || 1) * 100) / 100;
      if (line.isDebit) totalDebit += amount;
      else totalCredit += amount;
    }
    totalDebit = Math.round(totalDebit * 100) / 100;
    totalCredit = Math.round(totalCredit * 100) / 100;
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new Error(`Unbalanced entry! Debit: ${totalDebit}, Credit: ${totalCredit}`);
    }

    const entryId = `je_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    
    const entryLines: JournalLineRecord[] = lines.map((line, idx) => {
      const amount = Math.round(line.amountForeign * (line.exchangeRate || 1) * 100) / 100;
      return {
        id: `jl_${entryId}_${idx + 1}`,
        journalEntryId: entryId,
        accountId: line.accountId,
        costCenterId: line.costCenterId || null,
        subLedgerId: line.subLedgerId || null,
        debit: line.isDebit ? amount : 0,
        credit: line.isDebit ? 0 : amount,
        amountForeign: line.amountForeign,
        exchangeRate: line.exchangeRate || 1,
        description: line.description || description,
      };
    });

    const sequenceSnap = await getDocs(query(collection(db, 'journal_entries')));
    const count = sequenceSnap.size + 1000;
    
    const record: JournalEntryRecord = {
      id: entryId,
      tenantId,
      entryNumber: `JE-${new Date().getFullYear()}-${count}`,
      date: date || now.split('T')[0]!,
      reference: reference || '',
      description: description.trim(),
      totalDebit,
      totalCredit,
      status: 'POSTED',
      lines: entryLines,
      createdAt: now,
    };

    // Firebase Batch Write
    const batch = writeBatch(db);
    batch.set(doc(db, 'journal_entries', entryId), record);
    
    // Update Accounts
    for (const line of entryLines) {
      const acc = allAccounts.find(a => a.id === line.accountId)!;
      batch.update(doc(db, 'accounts', line.accountId), {
        totalDebit: acc.totalDebit + line.debit,
        totalCredit: acc.totalCredit + line.credit,
        updatedAt: now
      });
    }

    await batch.commit();

    appCache.invalidatePrefix(`chart_tree:${tenantId}`);
    appCache.invalidatePrefix(`rollup:${tenantId}`);
    return record;
  }

  async deleteAccount(accountId: string): Promise<{ success: boolean; message: string }> {
    const docRef = doc(db, 'accounts', accountId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error("Account not found");
    const acc = snap.data() as AccountRecord;
    
    const allAccounts = await this.getAllAccounts(acc.tenantId);
    const children = allAccounts.filter(a => a.parentAccountId === accountId);
    if (children.length > 0) throw new Error("Cannot delete account with children");
    
    const entries = await this.getAllJournalEntries(acc.tenantId);
    const isUsed = entries.some(e => e.lines.some(l => l.accountId === accountId));
    if (isUsed) throw new Error("Cannot delete account with existing transactions");

    await deleteDoc(docRef);
    appCache.invalidatePrefix(`chart_tree:${acc.tenantId}`);
    appCache.invalidatePrefix(`rollup:${acc.tenantId}`);
    return { success: true, message: "Deleted successfully" };
  }

  async toggleAccountStatus(accountId: string): Promise<AccountRecord> {
    const docRef = doc(db, 'accounts', accountId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error("Account not found");
    const acc = snap.data() as AccountRecord;
    const newState = !acc.isActive;
    await updateDoc(docRef, { isActive: newState, updatedAt: new Date().toISOString() });
    appCache.invalidatePrefix(`chart_tree:${acc.tenantId}`);
    appCache.invalidatePrefix(`rollup:${acc.tenantId}`);
    return { ...acc, isActive: newState };
  }

  async resetToDefaults(_tenantId: string = 'tenant_default') {
    // Dangerous, usually for dev only.
    const batch = writeBatch(db);
    const accSnap = await getDocs(collection(db, 'accounts'));
    accSnap.forEach(d => batch.delete(d.ref));
    const jeSnap = await getDocs(collection(db, 'journal_entries'));
    jeSnap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    this.seedLock = false;
    await this.seedInitialAccountsIfNeeded();
    appCache.clear();
  }
}

export const accountEngine = new AccountEngine();
