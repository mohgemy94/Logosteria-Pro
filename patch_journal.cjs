const fs = require('fs');
const p = 'src/components/NewJournalEntry.tsx';
let content = fs.readFileSync(p, 'utf-8');

// Add description and costCenter to JournalItemState
content = content.replace(
  /debit: string;\n  credit: string;\n}/,
  "debit: string;\n  credit: string;\n  description?: string;\n  costCenterId?: string;\n}"
);

// Initial state items
content = content.replace(
  /const \[items, setItems\] = useState<JournalItemState\[\]>\(\[\n    \{ id: generateId\(\), accountId: '', partnerId: '', debit: '', credit: '' \},\n    \{ id: generateId\(\), accountId: '', partnerId: '', debit: '', credit: '' \}\n  \]\);/,
  `const [items, setItems] = useState<JournalItemState[]>([
    { id: generateId(), accountId: '', partnerId: '', debit: '', credit: '', description: '', costCenterId: '' },
    { id: generateId(), accountId: '', partnerId: '', debit: '', credit: '', description: '', costCenterId: '' }
  ]);
  const [isSaving, setIsSaving] = useState(false);`
);

// handleAddItem
content = content.replace(
  /setItems\(prev => \[\.\.\.prev, \{ id: generateId\(\), accountId: '', partnerId: '', debit: '', credit: '' \}\]\);/,
  `setItems(prev => [...prev, { id: generateId(), accountId: '', partnerId: '', debit: '', credit: '', description: '', costCenterId: '' }]);`
);

// handleSave
const oldHandleSaveRegex = /const handleSave = \(e: FormEvent\) => \{[\s\S]*?setDescription\(''\);\n  \};/;
const newHandleSave = `const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!isBalanced || !isNonZero) return;

    // التحقق من أن كل الأسطر تمتلك حساباً مرتبطاً
    const hasEmptyAccounts = items.some(i => i.accountId === '' && (Number(i.debit) > 0 || Number(i.credit) > 0));
    if (hasEmptyAccounts) {
      alert("يرجى اختيار الحساب لجميع الأطراف المعبأة.");
      return;
    }

    // التحقق الصارم من متطلبات المدرسة الثانية (حساب المراقبة + دفتر الأستاذ المساعد):
    const missingSubLedgerItem = items.find(i => {
      const isFilled = Number(i.debit) > 0 || Number(i.credit) > 0;
      if (!isFilled) return false;
      const ctrl = getAccountControlInfo(i.accountId);
      return ctrl && ctrl.isControl && (!i.partnerId || i.partnerId.trim() === '');
    });
    
    if (missingSubLedgerItem) {
      const acc = accounts.find(a => a.id === missingSubLedgerItem.accountId || a.code === missingSubLedgerItem.accountId);
      const accName = acc ? \`\${acc.code} - \${acc.name}\` : 'حساب المراقبة';
      alert(\`تطبيق معيار الرقابة (Control Account):\\nالحساب (\${accName}) هو حساب مراقبة إجمالي، ويجب إلزامياً تحديد العميل أو المورد من دفتر الأستاذ المساعد (Sub-Ledger) لترحيل القيد.\`);
      return;
    }

    setIsSaving(true);
    try {
      // 1. Post to Cloud API
      const apiLines = items
        .filter(i => Number(i.debit) > 0 || Number(i.credit) > 0)
        .map(i => ({
          accountId: i.accountId,
          isDebit: Number(i.debit) > 0,
          amountForeign: Number(i.debit) > 0 ? Number(i.debit) : Number(i.credit),
          exchangeRate: 1, // Defaulting to base currency for now
          subLedgerId: i.partnerId || undefined,
          costCenterId: i.costCenterId || undefined,
          description: i.description || description || undefined
        }));

      const res = await fetch('/api/journal-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'tenant_default',
          description,
          date,
          reference,
          lines: apiLines
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل ترحيل القيد في السحابة');
      }

      // 2. Also save to local storage (for legacy components that still read from it)
      const journalEntry: JournalEntry = {
        id: generateId(),
        entryNumber: data.data?.entryNumber || \`JE-\${Date.now().toString().slice(-6)}\`,
        date,
        status: JournalEntryStatus.Posted,
        reference,
        description,
        items: items
          .filter(i => Number(i.debit) > 0 || Number(i.credit) > 0)
          .map(i => ({
            id: i.id,
            accountId: i.accountId,
            partnerId: i.partnerId || undefined,
            partnerName: i.partnerName || undefined,
            partnerType: i.partnerType || undefined,
            debit: Number(i.debit),
            credit: Number(i.credit),
          }))
      };
      saveJournalEntry(journalEntry);
      
      // Emit event so other components refresh
      window.dispatchEvent(new Event('alpha-data-changed'));

      alert(\`تم ترحيل القيد بنجاح إلى قاعدة البيانات السحابية! رقم القيد: \${journalEntry.entryNumber}\`);
      
      // إعادة ضبط النموذج
      setItems([
        { id: generateId(), accountId: '', partnerId: '', debit: '', credit: '', description: '', costCenterId: '' },
        { id: generateId(), accountId: '', partnerId: '', debit: '', credit: '', description: '', costCenterId: '' }
      ]);
      setReference('');
      setDescription('');
    } catch (err: any) {
      alert(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setIsSaving(false);
    }
  };`;

content = content.replace(oldHandleSaveRegex, newHandleSave);

// Table UI Adjustments
// Add Description column header
content = content.replace(
  /<th className="px-4 py-3 text-right font-bold w-1\/3">الحساب<\/th>/,
  `<th className="px-4 py-3 text-right font-bold w-1/4">الحساب</th>
   <th className="px-4 py-3 text-right font-bold w-1/5">البيان (شرح السطر)</th>`
);

// Add Description cell in tbody
const accountCellRegex = /(<td className="px-4 py-3\.5 relative">[\s\S]*?<\/td>)/;
content = content.replace(accountCellRegex, `$1
<td className="px-4 py-3.5">
  <input
    type="text"
    placeholder="شرح السطر (اختياري)..."
    value={item.description || ''}
    onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-blue-500 shadow-sm"
  />
</td>`);

// Update submit button to show loading
content = content.replace(
  /ترحيل القيد/,
  `{isSaving ? 'جاري الترحيل...' : 'ترحيل القيد'}`
);

fs.writeFileSync(p, content);
