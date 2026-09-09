import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { Plus, Truck, Save, Edit3, Trash2, Search, X, FileText, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Partner } from '../types/accounting';
import PrintDropdown from './PrintDropdown';
import PartnerStatementModal from './PartnerStatementModal';
import { 
  loadVendors, 
  saveVendorsList, 
  getPartnerAccountStatement 
} from '../utils/partnerLedger';

export default function Vendors() {
  const [vendors, setVendors] = useState<Partner[]>(() => loadVendors());
  const [isAdding, setIsAdding] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Partner | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newVendor, setNewVendor] = useState({ 
    name: '', 
    taxNumber: '', 
    phone: '', 
    address: '', 
    openingBalance: '',
    balanceType: 'CREDIT' // CREDIT (دائن - له مستحقات علينا) or DEBIT (مدين - دفعة مقدمة لنا)
  });
  const [selectedPartnerForStatement, setSelectedPartnerForStatement] = useState<Partner | null>(null);

  useEffect(() => {
    const handleSync = () => {
      setVendors(loadVendors());
    };
    window.addEventListener('alpha-partner-ledger-updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('alpha-partner-ledger-updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!newVendor.name.trim()) return;
    
    const rawBal = Number(newVendor.openingBalance) || 0;
    // For vendor: positive opening balance in partner object represents standard credit/payable balance
    const finalBal = newVendor.balanceType === 'DEBIT' ? -Math.abs(rawBal) : Math.abs(rawBal);

    const added: Partner = { 
      id: `vend-${Date.now()}`, 
      type: 'VENDOR', 
      name: newVendor.name.trim(),
      taxNumber: newVendor.taxNumber.trim(),
      phone: newVendor.phone.trim(),
      address: newVendor.address.trim(),
      openingBalance: finalBal
    };
    const updated = [...vendors, added];
    setVendors(updated);
    saveVendorsList(updated);
    setNewVendor({ name: '', taxNumber: '', phone: '', address: '', openingBalance: '', balanceType: 'CREDIT' });
    setIsAdding(false);
  };

  const handleUpdate = (e: FormEvent) => {
    e.preventDefault();
    if (!editingVendor || !editingVendor.name.trim()) return;

    const updated = vendors.map(v => v.id === editingVendor.id ? editingVendor : v);
    setVendors(updated);
    saveVendorsList(updated);
    setEditingVendor(null);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`هل أنت متأكد من رغبتك في حذف المورد (${name})؟`)) {
      const updated = vendors.filter(v => v.id !== id);
      setVendors(updated);
      saveVendorsList(updated);
    }
  };

  // Precalculate statements for all vendors
  const vendorsWithStatements = useMemo(() => {
    return vendors.map(v => {
      const statement = getPartnerAccountStatement(v);
      return {
        vendor: v,
        statement
      };
    });
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    return vendorsWithStatements.filter(({ vendor: v }) => 
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.phone && v.phone.includes(searchQuery)) ||
      (v.taxNumber && v.taxNumber.includes(searchQuery))
    );
  }, [vendorsWithStatements, searchQuery]);

  // Overall totals
  const overallStats = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    let netPayables = 0;

    vendorsWithStatements.forEach(({ statement }) => {
      totalDebit += statement.totalDebit;
      totalCredit += statement.totalCredit;
      if (statement.balanceType === 'CREDIT') {
        netPayables += statement.balance;
      }
    });

    return {
      count: vendors.length,
      totalDebit,
      totalCredit,
      netPayables
    };
  }, [vendorsWithStatements, vendors.length]);

  return (
    <div className="flex flex-col flex-1">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1 text-slate-500">
            <span className="text-xs uppercase font-bold tracking-tight">الموردون والمشتريات</span>
            <span className="text-xs">/</span>
            <span className="text-xs uppercase font-bold tracking-tight">الموردون والحسابات المربوطة</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">إدارة حسابات الموردين</h2>
          <p className="text-slate-500 mt-1 text-xs sm:text-sm">
            متابعة التزامات وأرصدة الموردين، ومطابقة كشوف الحسابات المربوطة بفواتير المشتريات وسندات الصرف.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
          <PrintDropdown />
          <div className="relative print:hidden flex-1 sm:flex-none">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="بحث بالاسم أو الهاتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-4 pr-10 py-2 w-full sm:w-64 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 shadow-xs"
            />
          </div>
          {!isAdding && !editingVendor && (
            <button 
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-xs text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus size={16} /> إضافة مورد جديد
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 print:hidden">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold">إجمالي عدد الموردين</span>
            <div className="text-2xl font-bold font-mono text-slate-800 mt-1">{overallStats.count} مورد</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Truck size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold">إجمالي التزامات الموردين (علينا)</span>
            <div className="text-2xl font-bold font-mono text-rose-600 mt-1">
              {overallStats.netPayables.toLocaleString(undefined, { minimumFractionDigits: 2 })} ريال
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <ArrowUpRight size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold">إجمالي مشتريات الموردين (دائن)</span>
            <div className="text-2xl font-bold font-mono text-slate-800 mt-1">
              {overallStats.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })} ريال
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <ArrowDownLeft size={20} />
          </div>
        </div>
      </div>

      {/* Add Vendor Form */}
      {isAdding && (
        <form onSubmit={handleAdd} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6 animate-fadeIn">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm sm:text-base">
            <Truck size={18} className="text-purple-600" /> تسجيل مورد جديد وربط الحساب
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">اسم المورد / المنشأة <span className="text-red-500">*</span></label>
              <input required value={newVendor.name} onChange={e => setNewVendor({...newVendor, name: e.target.value})} className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500" placeholder="اسم الشركة أو المؤسسة" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">الرقم الضريبي (15 رقم)</label>
              <input value={newVendor.taxNumber} onChange={e => setNewVendor({...newVendor, taxNumber: e.target.value})} className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 font-mono" placeholder="300000000000005" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">رقم الهاتف الجوال</label>
              <input value={newVendor.phone} onChange={e => setNewVendor({...newVendor, phone: e.target.value})} className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 font-mono" placeholder="05XXXXXXXX" dir="ltr" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">العنوان / المقر</label>
              <input value={newVendor.address} onChange={e => setNewVendor({...newVendor, address: e.target.value})} className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500" placeholder="المدينة - الحي - الشارع" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">الرصيد الافتتاحي السابق (ريال)</label>
              <input 
                type="number"
                step="0.01"
                min="0"
                value={newVendor.openingBalance} 
                onChange={e => setNewVendor({...newVendor, openingBalance: e.target.value})} 
                className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 font-mono" 
                placeholder="0.00" 
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">طبيعة الرصيد الافتتاحي</label>
              <select
                value={newVendor.balanceType}
                onChange={e => setNewVendor({...newVendor, balanceType: e.target.value})}
                className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
              >
                <option value="CREDIT">دائن (مستحق للمورد علينا)</option>
                <option value="DEBIT">مدين (دفعة مقدمة سابقة للمورد)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2.5 mt-5 pt-3 border-t border-slate-100 text-xs">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer">إلغاء</button>
            <button type="submit" className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm cursor-pointer"><Save size={15} /> حفظ المورد وفتح الحساب</button>
          </div>
        </form>
      )}

      {/* Edit Vendor Modal */}
      {editingVendor && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Edit3 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">تعديل بيانات المورد</h3>
                  <p className="text-[11px] text-slate-400">تحديث بيانات المورد ({editingVendor.name})</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingVendor(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">اسم المورد / الشركة:</label>
                <input
                  type="text"
                  required
                  value={editingVendor.name}
                  onChange={(e) => setEditingVendor({...editingVendor, name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">الرقم الضريبي (15 رقم):</label>
                <input
                  type="text"
                  value={editingVendor.taxNumber || ''}
                  onChange={(e) => setEditingVendor({...editingVendor, taxNumber: e.target.value})}
                  placeholder="300000000000005"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">رقم الهاتف الجوال:</label>
                <input
                  type="text"
                  value={editingVendor.phone || ''}
                  onChange={(e) => setEditingVendor({...editingVendor, phone: e.target.value})}
                  placeholder="05XXXXXXXX"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">العنوان / المقر:</label>
                <input
                  type="text"
                  value={editingVendor.address || ''}
                  onChange={(e) => setEditingVendor({...editingVendor, address: e.target.value})}
                  placeholder="المدينة - الحي - الشارع"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">الرصيد الافتتاحي السابق (ريال):</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingVendor.openingBalance || 0}
                  onChange={(e) => setEditingVendor({...editingVendor, openingBalance: Number(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  القيمة الموجبة تعني رصيد دائن للمورد علينا، والقيمة السالبة تعني رصيد مدين له (دفعة مقدمة).
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingVendor(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors shadow-sm cursor-pointer"
                >
                  <Save size={15} />
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Header */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900">لوجوستريا للمحاسبة</h1>
        <p className="text-sm text-slate-500">الفرع الرئيسي - الرياض</p>
        <h2 className="text-xl font-bold mt-4 border-b pb-2 inline-block">كشف بيانات وأرصدة الموردين</h2>
        <div className="mt-4 text-sm flex justify-between px-10 text-slate-600">
          <span>تاريخ الطباعة: {new Date().toLocaleDateString('ar-SA')}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-slate-200 print:border-none print:shadow-none overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse min-w-[680px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[10px] uppercase text-slate-500 font-bold">
                <th className="px-6 py-3.5">اسم المورد / الشركة</th>
                <th className="px-6 py-3.5">الرقم الضريبي</th>
                <th className="px-6 py-3.5">رقم الهاتف</th>
                <th className="px-6 py-3.5 text-center">عدد العمليات</th>
                <th className="px-6 py-3.5">الرصيد الفعلي الحالي</th>
                <th className="px-6 py-3.5 text-center print:hidden">كشف الحساب والإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredVendors.map(({ vendor: v, statement }) => (
                <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <div>
                      <span className="font-bold text-slate-800">{v.name}</span>
                      {v.address && <p className="text-[11px] text-slate-400">{v.address}</p>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-mono text-xs">{v.taxNumber || '-'}</td>
                  <td className="px-6 py-4 text-slate-600 font-mono text-xs">{v.phone || '-'}</td>
                  <td className="px-6 py-4 text-center font-mono text-xs font-bold text-slate-600">
                    <span className="bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                      {statement.transactions.length} حركات
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className={`font-mono font-bold text-sm ${
                        statement.balanceType === 'CREDIT' 
                          ? 'text-rose-700' 
                          : statement.balanceType === 'DEBIT' 
                          ? 'text-emerald-700' 
                          : 'text-slate-500'
                      }`}>
                        {statement.balanceFormatted} ريال
                      </span>
                      <span className="text-[10px] text-slate-500">{statement.balanceLabel}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 print:hidden text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPartnerForStatement(v)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors cursor-pointer border border-emerald-200"
                        title="فتح كشف حساب المورد التفصيلي المطابق"
                      >
                        <FileText size={13} />
                        <span>كشف الحساب</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingVendor(v)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                        title="تعديل بيانات المورد"
                      >
                        <Edit3 size={13} />
                        <span>تعديل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(v.id, v.name)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-medium transition-colors cursor-pointer"
                        title="حذف المورد"
                      >
                        <Trash2 size={13} />
                        <span>حذف</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredVendors.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                    لا توجد حسابات موردين مطابقة لعملية البحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Partner Statement Modal */}
      <PartnerStatementModal
        partner={selectedPartnerForStatement}
        isOpen={Boolean(selectedPartnerForStatement)}
        onClose={() => setSelectedPartnerForStatement(null)}
      />
    </div>
  );
}
