import { useState, useMemo, useCallback, useEffect, type FormEvent } from 'react';
import { Plus, Trash2, UserCheck, ShieldAlert, Scale, Building2, FileText, Sparkles } from 'lucide-react';
import { Account, JournalEntry, JournalEntryStatus, Partner } from '../types/accounting';
import { checkDateIsLocked } from '../utils/periodLock';
import PrintDropdown from './PrintDropdown';
import { loadChartOfAccounts, saveJournalEntry, loadJournalEntries, deleteJournalEntry } from '../utils/trialBalanceStore';
import { loadCustomers, loadVendors } from '../utils/partnerLedger';
import { navigateToAccountMovements } from '../utils/accountMovementsStore';
import { loadCostCenters, type CostCenter } from '../utils/costCenterStore';
import { getStoredEmployees } from '../data/mockPayroll';
import { getSystemSettings } from '../utils/settings';

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
  const [employees, setEmployees] = useState<Partner[]>(() =>
    getStoredEmployees().map(emp => ({
      id: emp.id,
      code: emp.code,
      name: emp.name,
      type: 'EMPLOYEE' as const,
      phone: emp.phone
    }))
  );
  const [costCenters, setCostCenters] = useState<CostCenter[]>(() => loadCostCenters());
  const [draftEntries, setDraftEntries] = useState<JournalEntry[]>(() =>
    loadJournalEntries().filter(e => e.status === JournalEntryStatus.Draft)
  );
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0] as string);
  const [reference, setReference] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [viewingEntryNumber, setViewingEntryNumber] = useState<string | null>(null);
  const [items, setItems] = useState<JournalItemState[]>([
    { id: generateId(), accountId: '', partnerId: '', debit: '', credit: '', description: '', costCenterId: '' },
    { id: generateId(), accountId: '', partnerId: '', debit: '', credit: '', description: '', costCenterId: '' }
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const populateEntry = (entry: any) => {
    if (!entry) return;
    setEditingEntryId(entry.id || null);
    setViewingEntryNumber(entry.entryNumber || entry.id || null);
    if (entry.date) setDate(entry.date);
    if (entry.reference) setReference(entry.reference);
    if (entry.description) setDescription(entry.description);
    if (Array.isArray(entry.items) && entry.items.length > 0) {
      setItems(entry.items.map((it: any) => ({
        id: it.id || generateId(),
        accountId: it.accountId || '',
        partnerId: it.partnerId || '',
        partnerName: it.partnerName || '',
        partnerType: it.partnerType || undefined,
        debit: Number(it.debit) > 0 ? String(it.debit) : '',
        credit: Number(it.credit) > 0 ? String(it.credit) : '',
        description: it.description || '',
        costCenterId: it.costCenterId || ''
      })));
    } else if (Array.isArray(entry.lines) && entry.lines.length > 0) {
      setItems(entry.lines.map((it: any) => ({
        id: it.id || generateId(),
        accountId: it.accountId || it.accountCode || '',
        partnerId: it.partnerId || it.subLedgerId || '',
        partnerName: it.partnerName || '',
        partnerType: it.partnerType || undefined,
        debit: Number(it.debit) > 0 ? String(it.debit) : '',
        credit: Number(it.credit) > 0 ? String(it.credit) : '',
        description: it.description || '',
        costCenterId: it.costCenterId || ''
      })));
    }
  };

  const refreshData = useCallback(() => {
    setAccounts(loadChartOfAccounts());
    setCustomers(loadCustomers());
    setVendors(loadVendors());
    setEmployees(
      getStoredEmployees().map(emp => ({
        id: emp.id,
        code: emp.code,
        name: emp.name,
        type: 'EMPLOYEE' as const,
        phone: emp.phone
      }))
    );
    setCostCenters(loadCostCenters());
    setDraftEntries(loadJournalEntries().filter(e => e.status === JournalEntryStatus.Draft));
  }, []);

  useEffect(() => {
    const handleReset = () => {
      refreshData();
      setReference('');
      setDescription('');
      setEditingEntryId(null);
      setViewingEntryNumber(null);
      setDate(new Date().toISOString().split('T')[0] as string);
      setItems([
        { id: generateId(), accountId: '', partnerId: '', debit: '', credit: '', description: '', costCenterId: '' },
        { id: generateId(), accountId: '', partnerId: '', debit: '', credit: '', description: '', costCenterId: '' }
      ]);
    };

    window.addEventListener('alpha-chart-of-accounts-updated', refreshData);
    window.addEventListener('alpha-partner-ledger-updated', refreshData);
    window.addEventListener('alpha-payroll-updated', refreshData);
    window.addEventListener('alpha-cost-centers-updated', refreshData);
    window.addEventListener('alpha-journal-entries-updated', refreshData);
    window.addEventListener('alpha-system-reset-completed', handleReset);
    window.addEventListener('alpha-data-changed', refreshData);
    window.addEventListener('storage', refreshData);

    const handleHighlight = (e: any) => {
      const entry = e.detail?.entry;
      if (entry) {
        populateEntry(entry);
      }
    };
    window.addEventListener('alpha-highlight-journal-entry', handleHighlight);

    const handleCreateVoiceJournal = (e: any) => {
      const payload = e.detail;
      handleReset();
      if (payload?.description) {
        setDescription(payload.description);
      }
      if (payload?.amount) {
        const amtStr = String(payload.amount);
        setItems([
          { id: generateId(), accountId: '', partnerId: '', debit: amtStr, credit: '', description: payload.description || '', costCenterId: '' },
          { id: generateId(), accountId: '', partnerId: '', debit: '', credit: amtStr, description: payload.description || '', costCenterId: '' }
        ]);
      }
    };

    window.addEventListener('alpha-voice-create-journal-entry', handleCreateVoiceJournal);

    // Check sessionStorage on mount
    try {
      const targetId = sessionStorage.getItem('alpha_target_journal_entry_id');
      const targetNum = sessionStorage.getItem('alpha_target_journal_entry_number');
      if (targetId || targetNum) {
        sessionStorage.removeItem('alpha_target_journal_entry_id');
        sessionStorage.removeItem('alpha_target_journal_entry_number');
        const allEntries = loadJournalEntries();
        const cleanNum = targetNum ? targetNum.replace(/^#/, '').trim().toLowerCase() : '';
        const found = allEntries.find(je => 
          (targetId && String(je.id) === String(targetId)) ||
          (cleanNum && je.entryNumber && String(je.entryNumber).replace(/^#/, '').trim().toLowerCase() === cleanNum)
        );
        if (found) {
          populateEntry(found);
        }
      }
    } catch (e) {
      console.warn('Failed to load pending journal entry from sessionStorage:', e);
    }

    return () => {
      window.removeEventListener('alpha-chart-of-accounts-updated', refreshData);
      window.removeEventListener('alpha-partner-ledger-updated', refreshData);
      window.removeEventListener('alpha-payroll-updated', refreshData);
      window.removeEventListener('alpha-cost-centers-updated', refreshData);
      window.removeEventListener('alpha-journal-entries-updated', refreshData);
      window.removeEventListener('alpha-system-reset-completed', handleReset);
      window.removeEventListener('alpha-data-changed', refreshData);
      window.removeEventListener('storage', refreshData);
      window.removeEventListener('alpha-voice-create-journal-entry', handleCreateVoiceJournal);
      window.removeEventListener('alpha-highlight-journal-entry', handleHighlight);
    };
  }, [refreshData]);

  // إضافة سطر جديد
  const handleAddItem = useCallback(() => {
    setItems(prev => [...prev, { id: generateId(), accountId: '', partnerId: '', debit: '', credit: '', description: '', costCenterId: '' }]);
  }, []);

  // حذف سطر
  const handleRemoveItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // التحقق هل الحساب المختار هو حساب مراقبة (Control Account) يتطلب تحديد عميل أو مورد أو موظف
  const getAccountControlInfo = useCallback((accountId: string) => {
    const acc = accounts.find(a => a.id === accountId || a.code === accountId);
    if (!acc) return null;
    const isControl =
      acc.isControlAccount ||
      acc.code === '1201' ||
      acc.code === '2101' ||
      acc.code === '1205' ||
      acc.code === '2201';
    let type = acc.controlType;
    if (!type || type === 'NONE') {
      if (acc.code === '1201') type = 'CUSTOMER';
      else if (acc.code === '2101') type = 'VENDOR';
      else if (acc.code === '1205' || acc.code === '2201') type = 'EMPLOYEE';
    }
    return isControl ? { isControl: true, controlType: (type || 'CUSTOMER') as 'CUSTOMER' | 'VENDOR' | 'EMPLOYEE' } : null;
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
          updatedItem.partnerId = '';
          updatedItem.partnerName = '';
          updatedItem.partnerType = undefined;
        } else {
          updatedItem.partnerType = ctrl.controlType;
          updatedItem.partnerId = '';
          updatedItem.partnerName = '';
        }
      }

      // إذا تم تغيير الشريك (عميل / مورد / موظف)
      if (field === 'partnerId') {
        const partner = [...customers, ...vendors, ...employees].find(p => p.id === value);
        if (partner) {
          updatedItem.partnerName = partner.name;
          updatedItem.partnerType = partner.type;
        } else {
          updatedItem.partnerName = '';
        }
      }

      if (field === 'debit' || field === 'credit') {
        const sanitized = value.replace(/[^0-9.]/g, '');
        const parts = sanitized.split('.');
        const finalValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;
        
        updatedItem[field] = finalValue;
        
        if (finalValue !== '' && Number(finalValue) > 0) {
           updatedItem[field === 'debit' ? 'credit' : 'debit'] = '';
        }
      }

      return updatedItem;
    }));
  }, [customers, vendors, employees, getAccountControlInfo]);

  // الحسابات الإجمالية
  const { totalDebit, totalCredit, isBalanced, isNonZero } = useMemo(() => {
    const sumDebit = items.reduce((acc, curr) => acc + (Number(curr.debit) || 0), 0);
    const sumCredit = items.reduce((acc, curr) => acc + (Number(curr.credit) || 0), 0);
    
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

  // موازنة القيد تلقائياً
  const handleAutoBalance = useCallback(() => {
    const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
    if (Math.abs(diff) < 0.01) return;

    setItems(prev => {
      const emptyIdx = prev.findIndex(it => (Number(it.debit) || 0) === 0 && (Number(it.credit) || 0) === 0);
      if (emptyIdx !== -1) {
        return prev.map((it, idx) => {
          if (idx !== emptyIdx) return it;
          return {
            ...it,
            debit: diff < 0 ? String(Math.abs(diff)) : '',
            credit: diff > 0 ? String(diff) : ''
          };
        });
      }
      return [
        ...prev,
        {
          id: generateId(),
          accountId: '',
          partnerId: '',
          debit: diff < 0 ? String(Math.abs(diff)) : '',
          credit: diff > 0 ? String(diff) : '',
          description: description || '',
          costCenterId: ''
        }
      ];
    });
  }, [totalDebit, totalCredit, description]);

  // حفظ كمسودة
  const handleSaveDraft = () => {
    const validLines = items.filter(i => i.accountId !== '' || Number(i.debit) > 0 || Number(i.credit) > 0);
    if (validLines.length === 0 && !description.trim()) {
      alert('يرجى إدخال بيان القيد أو سطر واحد على الأقل لحفظ المسودة.');
      return;
    }

    const entryId = editingEntryId || generateId();
    const entryNum = viewingEntryNumber || `DRAFT-${Date.now().toString().slice(-5)}`;

    const draftEntry: JournalEntry = {
      id: entryId,
      entryNumber: entryNum,
      date,
      status: JournalEntryStatus.Draft,
      reference,
      description: description || 'مسودة قيد يومية',
      items: validLines.map(i => {
        const cc = costCenters.find(c => c.id === i.costCenterId || c.code === i.costCenterId);
        return {
          id: i.id,
          accountId: i.accountId,
          partnerId: i.partnerId || undefined,
          partnerName: i.partnerName || undefined,
          partnerType: i.partnerType || undefined,
          costCenterId: i.costCenterId || undefined,
          costCenterName: cc ? cc.name : undefined,
          description: i.description || undefined,
          debit: Number(i.debit) || 0,
          credit: Number(i.credit) || 0
        };
      })
    };

    saveJournalEntry(draftEntry);
    refreshData();
    setEditingEntryId(entryId);
    setViewingEntryNumber(entryNum);
    alert(`تم حفظ القيد كمسودة برقم (${entryNum}) بنجاح! يمكنك استكماله وترحيله في أي وقت.`);
  };

  // الترحيل والحفظ النهائي
  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!isBalanced || !isNonZero) return;

    const hasEmptyAccounts = items.some(i => i.accountId === '' && (Number(i.debit) > 0 || Number(i.credit) > 0));
    if (hasEmptyAccounts) {
      alert("يرجى اختيار الحساب لجميع الأطراف المعبأة.");
      return;
    }

    // التحقق من حساب المراقبة + دفتر الأستاذ المساعد (عميل / مورد / موظف)
    const missingSubLedgerItem = items.find(i => {
      const isFilled = Number(i.debit) > 0 || Number(i.credit) > 0;
      if (!isFilled) return false;
      const ctrl = getAccountControlInfo(i.accountId);
      return ctrl && ctrl.isControl && (!i.partnerId || i.partnerId.trim() === '');
    });
    
    if (missingSubLedgerItem) {
      const acc = accounts.find(a => a.id === missingSubLedgerItem.accountId || a.code === missingSubLedgerItem.accountId);
      const accName = acc ? `${acc.code} - ${acc.name}` : 'حساب المراقبة';
      alert(`تطبيق معيار الرقابة (Control Account):\nالحساب (${accName}) هو حساب مراقبة إجمالي، ويجب إلزامياً تحديد الطرف المرتبط (عميل / مورد / موظف) من دفتر الأستاذ المساعد لترحيل القيد.`);
      return;
    }

    const lockCheck = checkDateIsLocked(date);
    if (lockCheck.isLocked) {
      alert(`🔒 تنبيه رقابي - الفترة المالية مقفلة ومحمية:\n${lockCheck.reason}`);
      return;
    }

    setIsSaving(true);
    try {
      const apiLines = items
        .filter(i => Number(i.debit) > 0 || Number(i.credit) > 0)
        .map(i => ({
          accountId: i.accountId,
          isDebit: Number(i.debit) > 0,
          amountForeign: Number(i.debit) > 0 ? Number(i.debit) : Number(i.credit),
          exchangeRate: 1,
          subLedgerId: i.partnerId || undefined,
          costCenterId: i.costCenterId || undefined,
          description: i.description || description || undefined
        }));

      let entryNum = viewingEntryNumber && !viewingEntryNumber.startsWith('DRAFT-')
        ? viewingEntryNumber
        : `JE-${Date.now().toString().slice(-6)}`;

      try {
        const res = await fetch('/api/journal-entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            tenantId: 'tenant_default',
            description,
            date,
            reference,
            lines: apiLines
          })
        });

        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          if (data && data.success && data.data?.entryNumber) {
            entryNum = data.data.entryNumber;
          }
        }
      } catch {
        // وضع العمل المحلي
      }

      const journalEntry: JournalEntry = {
        id: editingEntryId || generateId(),
        entryNumber: entryNum,
        date,
        status: JournalEntryStatus.Posted,
        reference,
        description,
        items: items
          .filter(i => Number(i.debit) > 0 || Number(i.credit) > 0)
          .map(i => {
            const cc = costCenters.find(c => c.id === i.costCenterId || c.code === i.costCenterId);
            return {
              id: i.id,
              accountId: i.accountId,
              partnerId: i.partnerId || undefined,
              partnerName: i.partnerName || undefined,
              partnerType: i.partnerType || undefined,
              costCenterId: i.costCenterId || undefined,
              costCenterName: cc ? cc.name : undefined,
              description: i.description || undefined,
              debit: Number(i.debit),
              credit: Number(i.credit)
            };
          })
      };
      saveJournalEntry(journalEntry);
      refreshData();
      window.dispatchEvent(new Event('alpha-data-changed'));

      alert(`تم ترحيل القيد بنجاح! رقم القيد: ${journalEntry.entryNumber}`);
      
      setEditingEntryId(null);
      setViewingEntryNumber(null);
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
      {/* Saved Drafts Quick Bar */}
      {draftEntries.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 mb-3 print:hidden flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <FileText size={15} className="text-amber-600" />
            <span>مسودات قيود محفوظة بانتظار الاستكمال والترحيل ({draftEntries.length}):</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {draftEntries.map(draft => (
              <div
                key={draft.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                  editingEntryId === draft.id
                    ? 'bg-amber-600 text-white border-amber-700'
                    : 'bg-white text-slate-800 border-amber-300 hover:bg-amber-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => populateEntry(draft)}
                  className="cursor-pointer"
                  title={draft.description}
                >
                  #{draft.entryNumber} - {draft.description.slice(0, 25)}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`حذف المسودة #${draft.entryNumber}؟`)) {
                      deleteJournalEntry(draft.id);
                      refreshData();
                      if (editingEntryId === draft.id) {
                        setEditingEntryId(null);
                        setViewingEntryNumber(null);
                      }
                    }
                  }}
                  className="text-rose-500 hover:text-rose-700 cursor-pointer ml-1"
                  title="حذف المسودة"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compact Unified Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2 sm:p-2.5 shadow-xs mb-3 print:hidden flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {viewingEntryNumber ? (
            <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-2">
              <span>{viewingEntryNumber.startsWith('DRAFT-') ? `تعديل مسودة #${viewingEntryNumber}` : `عرض القيد #${viewingEntryNumber}`}</span>
              <button
                type="button"
                onClick={() => {
                  setEditingEntryId(null);
                  setViewingEntryNumber(null);
                  setDate(new Date().toISOString().split('T')[0] as string);
                  setReference('');
                  setDescription('');
                  setItems([
                    { id: generateId(), accountId: '', partnerId: '', debit: '', credit: '', description: '', costCenterId: '' },
                    { id: generateId(), accountId: '', partnerId: '', debit: '', credit: '', description: '', costCenterId: '' }
                  ]);
                }}
                className="text-indigo-600 hover:text-indigo-950 underline text-[11px] font-bold cursor-pointer"
              >
                + جديد
              </button>
            </div>
          ) : (
            <span className="px-2.5 py-1 text-xs font-bold rounded-lg border bg-blue-50 text-blue-900 border-blue-200 shadow-2xs">
              سند قيد جديد (مسودة)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="submit"
            disabled={!isBalanced || !isNonZero || isSaving}
            className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer transition-all"
          >
            {isSaving ? 'جاري الترحيل...' : 'ترحيل القيد'}
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            className="h-8 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold shadow-2xs cursor-pointer"
          >
            حفظ كمسودة
          </button>
          <button
            type="button"
            onClick={() => navigateToAccountMovements('')}
            className="h-8 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer"
            title="الانتقال إلى كشف حركة الحسابات"
          >
            <Scale size={13} />
            <span>حركة الحسابات</span>
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'trialBalance' } }))}
            className="h-8 px-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
            title="ميزان المراجعة"
          >
            <span>ميزان المراجعة ←</span>
          </button>
          <PrintDropdown />
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{getSystemSettings().company?.nameAr || 'شركة لوجوستريا'}</h1>
        <p className="text-sm text-slate-500">{getSystemSettings().company?.branchName ? `${getSystemSettings().company.branchName} - ` : ''}{getSystemSettings().company?.address || getSystemSettings().company?.city || 'المملكة العربية السعودية'}</p>
        <h2 className="text-xl font-bold mt-4 border-b pb-2 inline-block">سند قيد يومية</h2>
        <div className="mt-4 text-sm flex justify-between px-10 text-slate-600">
          <span>تاريخ الطباعة: {new Date().toLocaleDateString('ar-SA')}</span>
          <span>رقم القيد: {viewingEntryNumber || 'مسودة'}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 print:border-none print:shadow-none flex flex-col overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 p-2.5 sm:p-3 border-b border-slate-200 bg-slate-50/80 print:bg-transparent print:p-0 print:mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">رقم القيد</label>
            <input 
              type="text" 
              disabled 
              value={viewingEntryNumber ? `#${viewingEntryNumber}` : 'تلقائي (جديد)'} 
              className={`border p-2 rounded text-sm font-mono font-bold ${
                viewingEntryNumber 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-900' 
                  : 'bg-slate-100 border-slate-200 text-slate-600'
              }`} 
            />
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
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">رقم المرجع / المستند</label>
            <input 
              type="text"
              placeholder="مثال: INV-102 أو سند يدوي"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="border border-slate-200 p-2 rounded text-sm focus:outline-none focus:border-blue-500" 
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">البيان العام للقيد</label>
            <input 
              type="text"
              required
              placeholder="مثال: سداد إيجار المكتب أو تسوية عهدة"
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
                <th className="px-3 py-3 w-10 text-center">#</th>
                <th className="px-3 py-3 min-w-[210px]">الحساب الفرعي (COA)</th>
                <th className="px-3 py-3 min-w-[190px]">
                  <div className="flex items-center gap-1.5 text-blue-800">
                    <UserCheck size={13} className="text-blue-600" />
                    <span>الأستاذ المساعد (عميل / مورد / موظف)</span>
                  </div>
                </th>
                <th className="px-3 py-3 min-w-[160px]">
                  <div className="flex items-center gap-1 text-emerald-800">
                    <Building2 size={13} className="text-emerald-600" />
                    <span>مركز التكلفة</span>
                  </div>
                </th>
                <th className="px-3 py-3 min-w-[150px]">بيان السطر (اختياري)</th>
                <th className="px-3 py-3 w-28 text-left">مدين (Debit)</th>
                <th className="px-3 py-3 w-28 text-left">دائن (Credit)</th>
                <th className="px-3 py-3 w-10 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {items.map((item, index) => {
                const ctrlInfo = getAccountControlInfo(item.accountId);
                const isControl = !!ctrlInfo?.isControl;
                const isCustomerControl = ctrlInfo?.controlType === 'CUSTOMER';
                const isVendorControl = ctrlInfo?.controlType === 'VENDOR';
                const isEmployeeControl = ctrlInfo?.controlType === 'EMPLOYEE';

                const partnerOptions = isCustomerControl
                  ? customers
                  : isVendorControl
                  ? vendors
                  : isEmployeeControl
                  ? employees
                  : [...customers, ...vendors, ...employees];

                return (
                  <tr key={item.id} className={`hover:bg-slate-50 ${isControl ? 'bg-amber-50/20' : ''}`}>
                    <td className="px-3 py-3.5 font-mono text-slate-400 text-center text-xs">
                      {String(index + 1).padStart(2, '0')}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex flex-col gap-1">
                        <select
                          value={item.accountId}
                          onChange={(e) => handleItemChange(item.id, 'accountId', e.target.value)}
                          className="w-full bg-transparent border-dashed border-b border-slate-300 py-1 text-slate-900 text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-500"
                        >
                          <option value="">-- اختر الحساب الفرعي --</option>
                          {accounts.filter(acc => (!acc.isGroup && (acc as any).type !== 'main' && acc.isActive !== false) || acc.id === item.accountId).map(acc => (
                            <option key={acc.id} value={acc.id}>
                              {acc.code} - {acc.name} {(acc.isControlAccount || acc.code === '1205' || acc.code === '2201') ? ' [حساب مراقبة]' : ''} {acc.isActive === false ? ' (معطل)' : ''}
                            </option>
                          ))}
                        </select>
                        {item.accountId && (
                          <div className="flex items-center justify-between">
                            {isControl ? (
                              <div className="flex items-center gap-1 text-[10px] text-amber-700 font-medium">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                <span>
                                  {isEmployeeControl ? 'مراقبة موظفين' : isCustomerControl ? 'مراقبة عملاء' : 'مراقبة موردين'}
                                </span>
                              </div>
                            ) : <span />}
                            <button
                              type="button"
                              onClick={() => {
                                const acc = accounts.find(a => a.id === item.accountId);
                                if (acc) navigateToAccountMovements(acc.code);
                              }}
                              className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title="عرض كشف حركة هذا الحساب"
                            >
                              <Scale size={11} />
                              <span>حركة الحساب</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      {isControl ? (
                        <div className="flex flex-col gap-1">
                          <select
                            value={item.partnerId || ''}
                            onChange={(e) => handleItemChange(item.id, 'partnerId', e.target.value)}
                            className={`w-full bg-white border rounded px-2 py-1 text-xs font-medium focus:outline-none shadow-2xs ${
                              !item.partnerId 
                                ? 'border-amber-400 bg-amber-50/40 text-amber-900 ring-1 ring-amber-300' 
                                : 'border-slate-300 text-slate-800'
                            }`}
                          >
                            <option value="">
                              {isCustomerControl 
                                ? '⚠️ اختر العميل (إلزامي)...' 
                                : isVendorControl 
                                ? '⚠️ اختر المورد (إلزامي)...' 
                                : isEmployeeControl
                                ? '⚠️ اختر الموظف (إلزامي)...'
                                : '⚠️ اختر الشريك (الأستاذ المساعد)...'}
                            </option>
                            {partnerOptions.map(partner => (
                              <option key={partner.id} value={partner.id}>
                                {partner.type === 'CUSTOMER' ? '👤 عميل: ' : partner.type === 'VENDOR' ? '🏢 مورد: ' : '👨‍💼 موظف: '}
                                {partner.name} {partner.code ? `(${partner.code})` : ''}
                              </option>
                            ))}
                          </select>
                          {!item.partnerId && (
                            <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                              <ShieldAlert size={11} /> يلزم ربط السطر بـ {isEmployeeControl ? 'الموظف' : isCustomerControl ? 'العميل' : 'المورد'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">حساب عام (بدون شريك)</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      <select
                        value={item.costCenterId || ''}
                        onChange={(e) => handleItemChange(item.id, 'costCenterId', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">-- بدون مركز تكلفة --</option>
                        {costCenters.filter(c => c.status === 'ACTIVE').map(cc => (
                          <option key={cc.id} value={cc.id}>
                            {cc.code} - {cc.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3.5">
                      <input
                        type="text"
                        placeholder="شرح السطر..."
                        value={item.description || ''}
                        onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                        className="w-full bg-transparent border-b border-dashed border-slate-200 py-1 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="px-3 py-3.5 text-left">
                      <input
                        type="text"
                        placeholder="0.00"
                        dir="ltr"
                        value={item.debit}
                        onFocus={e => e.target.select()}
                        onChange={(e) => handleItemChange(item.id, 'debit', e.target.value)}
                        className="w-full bg-transparent text-left font-mono font-medium text-blue-600 focus:outline-none placeholder:text-slate-300"
                      />
                    </td>
                    <td className="px-3 py-3.5 text-left">
                      <input
                        type="text"
                        placeholder="0.00"
                        dir="ltr"
                        value={item.credit}
                        onFocus={e => e.target.select()}
                        onChange={(e) => handleItemChange(item.id, 'credit', e.target.value)}
                        className="w-full bg-transparent text-left font-mono font-medium text-red-600 focus:outline-none placeholder:text-slate-300"
                      />
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={items.length <= 2}
                        className="text-slate-400 hover:text-red-600 disabled:opacity-50 transition-colors cursor-pointer"
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

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-4 flex-wrap print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddItem}
              className="btn-3d btn-3d-white px-3.5 py-1.5 text-xs font-black flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} /> إضافة سطر
            </button>
            {!isBalanced && isNonZero && (
              <button
                type="button"
                onClick={handleAutoBalance}
                className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                title="إدراج فرق التوازن تلقائياً في السطر الفارغ"
              >
                <Sparkles size={13} />
                <span>موازنة القيد تلقائياً ({Math.abs(totalDebit - totalCredit).toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
              </button>
            )}
          </div>
          <span className="text-[11px] text-slate-500">
            يمكنك ربط أي سطر بمركز تكلفة (فرع/مشروع) ليظهر تلقائياً في تقارير ربحية مراكز التكلفة.
          </span>
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
