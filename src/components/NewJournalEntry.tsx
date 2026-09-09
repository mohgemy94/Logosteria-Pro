import { useState, useMemo, useCallback, useEffect, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Account, JournalEntry, JournalEntryStatus } from '../types/accounting';
import PrintDropdown from './PrintDropdown';
import { loadChartOfAccounts, saveJournalEntry } from '../utils/trialBalanceStore';

const generateId = (): string => Math.random().toString(36).substring(2, 9);

interface JournalItemState {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
}

export default function NewJournalEntry() {
  const [accounts, setAccounts] = useState<Account[]>(() => loadChartOfAccounts());
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0] as string);
  const [reference, setReference] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [items, setItems] = useState<JournalItemState[]>([
    { id: generateId(), accountId: '', debit: '', credit: '' },
    { id: generateId(), accountId: '', debit: '', credit: '' }
  ]);

  useEffect(() => {
    const handleUpdate = () => setAccounts(loadChartOfAccounts());
    window.addEventListener('alpha-chart-of-accounts-updated', handleUpdate);
    return () => window.removeEventListener('alpha-chart-of-accounts-updated', handleUpdate);
  }, []);

  // إضافة سطر جديد
  const handleAddItem = useCallback(() => {
    setItems(prev => [...prev, { id: generateId(), accountId: '', debit: '', credit: '' }]);
  }, []);

  // حذف سطر
  const handleRemoveItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // تحديث بيانات السطر (منع الإدخال السالب ومنع الجمع بين المدين والدائن في نفس السطر)
  const handleItemChange = useCallback((id: string, field: keyof JournalItemState, value: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;

      const updatedItem = { ...item, [field]: value };

      if (field === 'debit' || field === 'credit') {
        // فلترة القيم لتكون أرقام موجبة وعشرية صحيحة فقط
        const sanitized = value.replace(/[^0-9.]/g, '');
        const parts = sanitized.split('.');
        const finalValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;
        
        updatedItem[field] = finalValue;
        
        // إذا قام بإدخال قيمة في المدين، نمسح الدائن والعكس
        if (finalValue !== '' && Number(finalValue) > 0) {
           updatedItem[field === 'debit' ? 'credit' : 'debit'] = '';
        }
      }

      return updatedItem;
    }));
  }, []);

  // الحسابات الإجمالية
  const { totalDebit, totalCredit, isBalanced, isNonZero } = useMemo(() => {
    const sumDebit = items.reduce((acc, curr) => acc + (Number(curr.debit) || 0), 0);
    const sumCredit = items.reduce((acc, curr) => acc + (Number(curr.credit) || 0), 0);
    
    // حل مشكلة التقريب العشري
    const roundedDebit = Math.round(sumDebit * 10000) / 10000;
    const roundedCredit = Math.round(sumCredit * 10000) / 10000;
    
    const _isBalanced = roundedDebit === roundedCredit;
    const _isNonZero = roundedDebit > 0;

    return { 
      totalDebit: roundedDebit, 
      totalCredit: roundedCredit, 
      isBalanced: _isBalanced,
      isNonZero: _isNonZero
    };
  }, [items]);

  // الترحيل والحفظ
  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!isBalanced || !isNonZero) return;

    // التحقق من أن كل الأسطر تمتلك حساباً مرتبطاً
    const hasEmptyAccounts = items.some(i => i.accountId === '' && (Number(i.debit) > 0 || Number(i.credit) > 0));
    if (hasEmptyAccounts) {
      alert("يرجى اختيار الحساب لجميع الأطراف المعبأة.");
      return;
    }

    // بناء كائن القيد المحاسبي المكتمل
    const journalEntry: JournalEntry = {
      id: generateId(),
      entryNumber: `JE-${Date.now().toString().slice(-6)}`,
      date,
      status: JournalEntryStatus.Posted,
      reference,
      description,
      items: items
        .filter(i => Number(i.debit) > 0 || Number(i.credit) > 0)
        .map(i => ({
          id: i.id,
          accountId: i.accountId,
          debit: Number(i.debit),
          credit: Number(i.credit),
        }))
    };

    saveJournalEntry(journalEntry);
    alert(`تم ترحيل القيد بنجاح إلى ميزان المراجعة! رقم القيد: ${journalEntry.entryNumber}`);
    
    // إعادة ضبط النموذج
    setItems([
      { id: generateId(), accountId: '', debit: '', credit: '' },
      { id: generateId(), accountId: '', debit: '', credit: '' }
    ]);
    setReference('');
    setDescription('');
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col flex-1">
      <div className="flex justify-end gap-3 mb-4 print:hidden">
        <PrintDropdown />
        <button type="button" className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded shadow-sm text-sm font-medium hover:bg-slate-50 transition-colors">
          حفظ كمسودة
        </button>
        <button
          type="submit"
          disabled={!isBalanced || !isNonZero}
          className="px-4 py-2 bg-blue-600 text-white rounded shadow-sm text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ترحيل القيد
        </button>
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900">لوجوستريا للمحاسبة</h1>
        <p className="text-sm text-slate-500">الفرع الرئيسي - الرياض</p>
        <h2 className="text-xl font-bold mt-4 border-b pb-2 inline-block">سند قيد يومية</h2>
        <div className="mt-4 text-sm flex justify-between px-10 text-slate-600">
          <span>تاريخ الطباعة: {new Date().toLocaleDateString('ar-SA')}</span>
          <span>رقم القيد: مسودة</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 print:border-none print:shadow-none flex flex-col overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6 border-b border-slate-100 bg-slate-50/50 print:bg-transparent print:p-0 print:mb-6">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">رقم القيد</label>
            <input type="text" disabled value="تلقائي" className="bg-slate-100 border border-slate-200 p-2 rounded text-sm font-mono text-slate-600" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">التاريخ</label>
            <input 
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-slate-200 p-2 rounded text-sm focus:outline-none focus:border-blue-500" 
            />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-[10px] font-bold uppercase text-slate-500">المرجع / الوصف</label>
            <input 
              type="text"
              required
              placeholder="مثال: سداد إيجار المكتب"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border border-slate-200 p-2 rounded text-sm focus:outline-none focus:border-blue-500" 
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto min-h-[300px]">
          <table className="w-full text-right border-collapse">
            <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
              <tr className="text-[10px] uppercase text-slate-500 font-bold">
                <th className="px-6 py-3 w-12 text-center">#</th>
                <th className="px-6 py-3">الحساب (COA)</th>
                <th className="px-6 py-3 w-40 text-left">مدين (Debit)</th>
                <th className="px-6 py-3 w-40 text-left">دائن (Credit)</th>
                <th className="px-6 py-3 w-16 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {items.map((item, index) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono text-slate-400 text-center">
                    {String(index + 1).padStart(2, '0')}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={item.accountId}
                      onChange={(e) => handleItemChange(item.id, 'accountId', e.target.value)}
                      className="w-full bg-transparent border-dashed border-b border-slate-300 py-1 text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- اختر الحساب --</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-left">
                    <input
                      type="text"
                      placeholder="0.00"
                      dir="ltr"
                      value={item.debit}
                      onChange={(e) => handleItemChange(item.id, 'debit', e.target.value)}
                      className="w-full bg-transparent text-left font-mono font-medium text-blue-600 focus:outline-none placeholder:text-slate-300"
                    />
                  </td>
                  <td className="px-6 py-4 text-left">
                    <input
                      type="text"
                      placeholder="0.00"
                      dir="ltr"
                      value={item.credit}
                      onChange={(e) => handleItemChange(item.id, 'credit', e.target.value)}
                      className="w-full bg-transparent text-left font-mono font-medium text-red-600 focus:outline-none placeholder:text-slate-300"
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={items.length <= 2}
                      className="text-slate-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center gap-4 print:hidden">
          <button
            type="button"
            onClick={handleAddItem}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase text-slate-600 hover:bg-slate-200 rounded transition-colors"
          >
            <Plus size={14} /> إضافة سطر
          </button>
        </div>

        <div className="bg-[#1e293b] text-white p-6 grid grid-cols-1 md:grid-cols-3 gap-8 shrink-0 print:bg-slate-50 print:text-slate-900 print:border-t print:border-slate-300 print:mt-6">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-slate-400 mb-1">إجمالي المدين</span>
            <span className="text-2xl font-mono text-blue-400">{totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-slate-400 mb-1">إجمالي الدائن</span>
            <span className="text-2xl font-mono text-red-400">{totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center md:justify-end print:hidden">
            {isBalanced && isNonZero ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 py-3 rounded-lg flex items-center gap-3 w-full md:w-auto">
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                <div className="flex flex-col text-left" dir="ltr">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-tighter">Journal Balanced</span>
                  <span className="text-[10px] text-emerald-100 opacity-60">Difference: 0.00</span>
                </div>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/20 px-6 py-3 rounded-lg flex items-center gap-3 w-full md:w-auto">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="flex flex-col text-left" dir="ltr">
                  <span className="text-xs font-bold text-red-400 uppercase tracking-tighter">Unbalanced</span>
                  <span className="text-[10px] text-red-100 opacity-60">Difference: {Math.abs(totalDebit - totalCredit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Print Signatures */}
        <div className="hidden print:grid grid-cols-3 gap-8 mt-16 pt-8 text-center text-slate-800">
          <div>
            <p className="font-bold mb-12">أعده (المحاسب)</p>
            <div className="border-b-2 border-dashed border-slate-300 w-2/3 mx-auto"></div>
          </div>
          <div>
            <p className="font-bold mb-12">راجعه (المدير المالي)</p>
            <div className="border-b-2 border-dashed border-slate-300 w-2/3 mx-auto"></div>
          </div>
          <div>
            <p className="font-bold mb-12">اعتمد (المدير العام)</p>
            <div className="border-b-2 border-dashed border-slate-300 w-2/3 mx-auto"></div>
          </div>
        </div>
      </div>
    </form>
  );
}
