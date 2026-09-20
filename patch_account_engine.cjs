const fs = require('fs');
let code = fs.readFileSync('src/server/accountEngine.ts', 'utf8');

const createUpdateCode = `
  async updateAccount(id: string, updates: Partial<AccountRecord>): Promise<AccountRecord> {
    const account = this.accounts.get(id);
    if (!account) throw new Error("Account not found.");
    
    if (updates.nameAr !== undefined && updates.nameAr.trim() === '') {
      throw new Error("اسم الحساب باللغة العربية إلزامي");
    }

    const updatedAccount = {
      ...account,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.accounts.set(id, updatedAccount);
    return updatedAccount;
  }

  async createCustomAccount(input: { tenantId: string; parentAccountId: string; nameAr: string; nameEn?: string; isPosting?: boolean }): Promise<AccountRecord> {
    const parent = this.accounts.get(input.parentAccountId);
    if (!parent) throw new Error("الحساب الأب غير موجود");
    
    const children = Array.from(this.accounts.values())
      .filter(acc => acc.parentAccountId === parent.id && acc.tenantId === input.tenantId)
      .sort((a, b) => b.code.localeCompare(a.code));
      
    let nextCode = "";
    if (children.length > 0) {
      const lastChildCode = children[0].code;
      const sequenceStr = lastChildCode.slice(parent.code.length);
      const nextSequence = parseInt(sequenceStr, 10) + 1;
      nextCode = parent.code + String(nextSequence).padStart(sequenceStr.length || 2, '0');
    } else {
      nextCode = parent.code + (parent.level === 4 ? "001" : "01");
    }

    const newId = \`acc_\${nextCode}\`;
    const now = new Date().toISOString();
    
    const newAccount: AccountRecord = {
      id: newId,
      tenantId: input.tenantId,
      code: nextCode,
      nameAr: input.nameAr.trim(),
      nameEn: input.nameEn?.trim() || '',
      currency: parent.currency || 'SAR',
      type: parent.type,
      level: parent.level + 1,
      isPosting: input.isPosting ?? true,
      isActive: true,
      parentAccountId: parent.id,
      subLedgerType: parent.subLedgerType || 'NONE',
      createdAt: now,
      updatedAt: now,
    };
    
    this.accounts.set(newId, newAccount);
    return newAccount;
  }
`;

if (!code.includes('updateAccount(')) {
  code = code.replace(/async createAnalyticalAccount/g, createUpdateCode + '\n  async createAnalyticalAccount');
  fs.writeFileSync('src/server/accountEngine.ts', code);
  console.log("Patched accountEngine.ts");
} else {
  console.log("Already patched accountEngine.ts");
}
