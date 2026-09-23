import { useState, useMemo, useCallback, useEffect, type FormEvent } from 'react';
import { Plus, Trash2, UserCheck, ShieldAlert } from 'lucide-react';
import { Account, JournalEntry, JournalEntryStatus, Partner } from '../types/accounting';
import { checkDateIsLocked } from '../utils/periodLock';
import PrintDropdown from './PrintDropdown';
import { loadChartOfAccounts, saveJournalEntry } from '../utils/trialBalanceStore';
import { loadCustomers, loadVendors } from '../utils/partnerLedger';

const generateId = (): string => Math.random().toString(36).substring(2, 9);

interface JournalItemState {
  id: string;
  accountId: string;
  partnerId?: string | undefined;
  partnerName?: string | undefined;
  partnerType?: 'CUSTOMER' | 'VENDOR' | 'EMPLOYEE' | undefined;
  debit: string;
  credit: string;
  description?: string;
  costCenterId?: string;
}

export default function NewJournalEntry() {
  const [accounts, setAccounts] = useState<Account[]>(() => loadChartOfAccounts());
  const [customers, setCustomers] = useState<Partner[]>(() => loadCustomers());
  const [vendors, setVendors] = useState<Partner[]>(() => loadVendors());
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0] as string);
  const [reference, setReference] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [items, setItems] = useState<JournalItemState[]>([
    { id: generateId(), accountId: '', partnerId: '', debit: '', credit: '', description: '', costCenterId: '' },
    { id: generateId(), accountId: '', partnerId: '', debit: '', credit: '', description: '', costCenterId: '' }
  ]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleUpdate = () => setAccounts(loadChartOfAccounts());
    const handlePartnerUpdate = () => {
      setCustomers(loadCustomers());
      setVendors(loadVendors());
    };
    const handleReset = () => {
      setAccounts(loadChartOfAccounts());
      setCustomers(loadCustomers());
      setVendors(loadVendors());
      setReference('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0] as string);
      setItems([
        { id: generateId(), accountId: '', partnerId: '', debit: '', credit: '' },
        { id: generateId(), accountId: '', partnerId: '', debit: '', credit: '' }
      ]);
    };

    window.addEventListener('alpha-chart-of-accounts-updated', handleUpdate);
    window.addEventListener('alpha-partner-ledger-updated', handlePartnerUpdate);
    window.addEventListener('alpha-system-reset-completed', handleReset);
    window.addEventListener('alpha-data-changed', handleReset);
    window.addEventListener('storage', handleReset);

    const handleCreateVoiceJournal = (e: any) => {
      const payload = e.detail;
      handleReset();
      if (payload?.description) {
        setDescription(payload.description);
      }
      if (payload?.amount) {
        const amtStr = String(payload.amount);
        setItems([
          { id: generateId(), accountId: '', partnerId: '', debit: amtStr, credit: '', description: payload.description || '' },
          { id: generateId(), accountId: '', partnerId: '', debit: '', credit: amtStr, description: payload.description || '' }
        ]);
      }
    };

    window.addEventListener('alpha-voice-create-journal-entry', handleCreateVoiceJournal);

    return () => {
      window.removeEventListener('alpha-chart-of-accounts-updated', handleUpdate);
      window.removeEventListener('alpha-partner-ledger-updated', handlePartnerUpdate);
      window.removeEventListener('alpha-system-reset-completed', handleReset);
      window.removeEventListener('alpha-data-changed', handleReset);
      window.removeEventListener('storage', handleReset);
      window.removeEventListener('alpha-voice-create-journal-entry', handleCreateVoiceJournal);
    };
  }, []);

  // إضافة سطر جديد
  const handleAddItem = useCallback(() => {
    setItems(prev => [...prev, { id: generateId(), accountId: '', partnerId: '', debit: '', credit: '', description: '', costCenterId: '' }]);
  }, []);

  // حذف سطر
  const handleRemoveItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // التحقق هل الحساب المختار هو حساب مراقبة (Control Account) يتطلب تحديد عميل أو مورد
  const getAccountControlInfo = useCallback((accountId: string) => {
    const acc = accounts.find(a => a.id === accountId || a.code === accountId);
    if (!acc) return null;
    const isControl = acc.isControlAccount || acc.code === '1201' || acc.code === '2101';
    let type = acc.controlType;
    if (!type) {
      if (acc.code === '1201') type = 'CUSTOMER';
      else if (acc.code === '2101') type = 'VENDOR';
    }
    return isControl ? { isControl: true, controlType: type || 'CUSTOMER' } : null;
  }, [accounts]);

  // تحديث بيانات السطر
  const handleItemChange = useCallback((id: string, field: keyof JournalItemState, value: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;

      const updatedItem = { ...item, [field]: value };

      // إذا تم تغيير الحساب، نفحص هل هو حساب مراقبة
      if (field === 'accountId') {
        const ctrl = getAccountControlInfo(value);
        if (!ctrl) {
          // حساب عادي، مسح بيانات الشريك
          updatedItem.partnerId = '';
          updatedItem.partnerName = '';
          updatedItem.partnerType = undefined;
        } else {
          updatedItem.partnerType = ctrl.controlType as 'CUSTOMER' | 'VENDOR';
        }
      }

      // إذا تم تغيير الشريك
      if (field === 'partnerId') {
        const partner = [...customers, ...vendors].find(p => p.id === value);
        if (partner) {
          updatedItem.partnerName = partner.name;
          updatedItem.partnerType = partner.type as 'CUSTOMER' | 'VENDOR';
        } else {
          updatedItem.partnerName = '';
        }
      }

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
  }, [customers, vendors, getAccountControlInfo]);

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
  const handleSave = async (e: FormEvent) => {
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
      const accName = acc ? `${acc.code} - ${acc.name}` : 'حساب المراقبة';
      alert(`تطبيق معيار الرقابة (Control Account):\nالحساب (${accName}) هو حساب مراقبة إجمالي، ويجب إلزامياً تحديد العميل أو المورد من دفتر الأستاذ المساعد (Sub-Ledger) لترحيل القيد.`);
      return;
    }

    // التحقق من تجميد وقفل الفترة المالية (Fiscal Period Lock Check)
    const lockCheck = checkDateIsLocked(date);
    if (lockCheck.isLocked) {
      alert(`🔒 تنبيه رقابي - الفترة المالية مقفلة ومحمية:\n${lockCheck.reason}`);
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
        entryNumber: data.data?.entryNumber || `JE-${Date.now().toString().slice(-6)}`,
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

      alert(`تم ترحيل القيد بنجاح إلى قاعدة البيانات السحابية! رقم القيد: ${journalEntry.entryNumber}`);
      
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
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col flex-1">
      <div className="flex flex-wrap items-center justify-end gap-2.5 mb-4 print:hidden">
        <PrintDropdown />
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'trialBalance' } }));
          }}
          className="btn-3d btn-3d-slate px-3.5 py-2 text-xs sm:text-sm font-black"
          title="الانتقال إلى ميزان المراجعة للتحقق من أثر القيود وتوازن الحسابات"
        >
          ميزان المراجعة ←
        </button>
        <button type="button" className="btn-3d btn-3d-white px-4 py-2 text-xs sm:text-sm font-black">
          حفظ كمسودة
        </button>
        <button
          type="submit"
          disabled={!isBalanced || !isNonZero || isSaving}
          className="btn-3d btn-3d-emerald px-4 py-2 text-xs sm:text-sm font-black"
        >
          {isSaving ? 'جاري الترحيل...' : 'ترحيل القيد'}
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
                <th className="px-4 py-3 w-10 text-center">#</th>
                <th className="px-4 py-3 w-1/3">الحساب العام (COA)</th>
                <th className="px-4 py-3 w-1/3">
                  <div className="flex items-center gap-1.5 text-blue-800">
                    <UserCheck size={13} className="text-blue-600" />
                    <span>دفتر الأستاذ المساعد (Sub-Ledger / الشريك)</span>
                  </div>
                </th>
                <th className="px-4 py-3 w-32 text-left">مدين (Debit)</th>
                <th className="px-4 py-3 w-32 text-left">دائن (Credit)</th>
                <th className="px-4 py-3 w-12 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {items.map((item, index) => {
                const ctrlInfo = getAccountControlInfo(item.accountId);
                const isControl = !!ctrlInfo?.isControl;
                const isCustomerControl = ctrlInfo?.controlType === 'CUSTOMER';
                const isVendorControl = ctrlInfo?.controlType === 'VENDOR';

                return (
                  <tr key={item.id} className={`hover:bg-slate-50 ${isControl ? 'bg-amber-50/20' : ''}`}>
                    <td className="px-4 py-3.5 font-mono text-slate-400 text-center text-xs">
                      {String(index + 1).padStart(2, '0')}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1">
                        <select
                          value={item.accountId}
                          onChange={(e) => handleItemChange(item.id, 'accountId', e.target.value)}
                          className="w-full bg-transparent border-dashed border-b border-slate-300 py-1 text-slate-900 text-sm font-medium focus:outline-none focus:border-blue-500"
                        >
                          <option value="">-- اختر الحساب --</option>
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                              {acc.code} - {acc.name} {acc.isControlAccount ? ' [حساب مراقبة]' : ''}
                            </option>
                          ))}
                        </select>
                        {isControl && (
                          <div className="flex items-center gap-1 text-[11px] text-amber-700 font-medium">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            <span>حساب مراقبة إجمالي (Control Account)</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {isControl ? (
                        <div className="flex flex-col gap-1">
                          <select
                            value={item.partnerId || ''}
                            onChange={(e) => handleItemChange(item.id, 'partnerId', e.target.value)}
                            className={`w-full bg-white border rounded px-2.5 py-1 text-xs font-medium focus:outline-none shadow-sm ${
                              !item.partnerId 
                                ? 'border-amber-400 bg-amber-50/40 text-amber-900 ring-1 ring-amber-300' 
                                : 'border-slate-300 text-slate-800'
                            }`}
                          >
                            <option value="">
                              {isCustomerControl 
                                ? '⚠️ اختر العميل (إلزامي للرقابة)...' 
                                : isVendorControl 
                                ? '⚠️ اختر المورد (إلزامي للرقابة)...' 
                                : '⚠️ اختر الشريك (الأستاذ المساعد)...'}
                            </option>
                            {(isCustomerControl ? customers : isVendorControl ? vendors : [...customers, ...vendors]).map(partner => (
                              <option key={partner.id} value={partner.id}>
                                {partner.type === 'CUSTOMER' ? '👤 عميل: ' : '🏢 مورد: '}
                                {partner.name} {partner.taxNumber ? `(ض: ${partner.taxNumber})` : ''}
                              </option>
                            ))}
                          </select>
                          {!item.partnerId && (
                            <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                              <ShieldAlert size={11} /> يلزم ربط القيد بشخص الشريك
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">حساب عام (لا يتطلب شريك)</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-left">
                      <input
                        type="text"
                        placeholder="0.00"
                        dir="ltr"
                        value={item.debit}
                        onChange={(e) => handleItemChange(item.id, 'debit', e.target.value)}
                        className="w-full bg-transparent text-left font-mono font-medium text-blue-600 focus:outline-none placeholder:text-slate-300"
                      />
                    </td>
                    <td className="px-4 py-3.5 text-left">
                      <input
                        type="text"
                        placeholder="0.00"
                        dir="ltr"
                        value={item.credit}
                        onChange={(e) => handleItemChange(item.id, 'credit', e.target.value)}
                        className="w-full bg-transparent text-left font-mono font-medium text-red-600 focus:outline-none placeholder:text-slate-300"
                      />
                    </td>
                    <td className="px-4 py-3.5 text-center">
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
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center gap-4 print:hidden">
          <button
            type="button"
            onClick={handleAddItem}
            className="btn-3d btn-3d-white px-3.5 py-1.5 text-xs font-black"
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
