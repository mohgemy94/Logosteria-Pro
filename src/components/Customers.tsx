import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { Plus, Search, Edit3, Trash2, Save, X, FileText, Users, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Partner } from '../types/accounting';
import AddCustomerForm from './AddCustomerForm';
import PrintDropdown from './PrintDropdown';
import PartnerStatementModal from './PartnerStatementModal';
import { 
  loadCustomers, 
  saveCustomersList, 
  getPartnerAccountStatement 
} from '../utils/partnerLedger';

export default function Customers() {
  const [customers, setCustomers] = useState<Partner[]>(() => loadCustomers());
  const [isAdding, setIsAdding] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Partner | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartnerForStatement, setSelectedPartnerForStatement] = useState<Partner | null>(null);

  useEffect(() => {
    const handleSync = () => {
      setCustomers(loadCustomers());
    };
    window.addEventListener('alpha-partner-ledger-updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('alpha-partner-ledger-updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const handleAddCustomer = (customerData: { 
    name: string; 
    taxNumber: string; 
    phone: string; 
    address?: string;
    openingBalance?: number;
  }) => {
    const newCustomer: Partner = { 
      id: `cust-${Date.now()}`, 
      type: 'CUSTOMER', 
      ...customerData 
    };
    const updated = [...customers, newCustomer];
    setCustomers(updated);
    saveCustomersList(updated);
    setIsAdding(false);
  };

  const handleUpdateCustomer = (e: FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !editingCustomer.name.trim()) return;

    const updated = customers.map(c => c.id === editingCustomer.id ? editingCustomer : c);
    setCustomers(updated);
    saveCustomersList(updated);
    setEditingCustomer(null);
  };

  const handleDeleteCustomer = (id: string, name: string) => {
    if (confirm(`هل أنت متأكد من رغبتك في حذف العميل (${name})؟`)) {
      const updated = customers.filter(c => c.id !== id);
      setCustomers(updated);
      saveCustomersList(updated);
    }
  };

  // Precalculate statements for all customers
  const customersWithStatements = useMemo(() => {
    return customers.map(c => {
      const statement = getPartnerAccountStatement(c);
      return {
        customer: c,
        statement
      };
    });
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    return customersWithStatements.filter(({ customer: c }) => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.phone && c.phone.includes(searchQuery)) ||
      (c.taxNumber && c.taxNumber.includes(searchQuery))
    );
  }, [customersWithStatements, searchQuery]);

  // Overall totals
  const overallStats = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    let netReceivables = 0;

    customersWithStatements.forEach(({ statement }) => {
      totalDebit += statement.totalDebit;
      totalCredit += statement.totalCredit;
      if (statement.balanceType === 'DEBIT') {
        netReceivables += statement.balance;
      }
    });

    return {
      count: customers.length,
      totalDebit,
      totalCredit,
      netReceivables
    };
  }, [customersWithStatements, customers.length]);

  return (
    <div className="flex flex-col flex-1">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1 text-slate-500">
            <span className="text-xs uppercase font-bold tracking-tight">العملاء والمبيعات</span>
            <span className="text-xs">/</span>
            <span className="text-xs uppercase font-bold tracking-tight">العملاء والحسابات المربوطة</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">إدارة حسابات العملاء</h2>
          <p className="text-slate-500 mt-1 text-xs sm:text-sm">
            متابعة أرصدة العملاء، ومطابقة كشوف الحسابات المربوطة بفواتير المبيعات وسندات القبض.
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
          {!isAdding && !editingCustomer && (
            <button 
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-xs text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus size={16} /> إضافة عميل جديد
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 print:hidden">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold">إجمالي عدد العملاء</span>
            <div className="text-2xl font-bold font-mono text-slate-800 mt-1">{overallStats.count} عميل</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold">إجمالي المستحقات القائمة (لنا)</span>
            <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
              {overallStats.netReceivables.toLocaleString(undefined, { minimumFractionDigits: 2 })} ريال
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <ArrowDownLeft size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold">إجمالي مبيعات العملاء (مدين)</span>
            <div className="text-2xl font-bold font-mono text-slate-800 mt-1">
              {overallStats.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })} ريال
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <ArrowUpRight size={20} />
          </div>
        </div>
      </div>

      {isAdding && (
        <AddCustomerForm 
          onSave={handleAddCustomer} 
          onCancel={() => setIsAdding(false)} 
        />
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Edit3 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">تعديل بيانات العميل</h3>
                  <p className="text-[11px] text-slate-400">تحديث الاسم أو الرقم الضريبي أو الرصيد الافتتاحي</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingCustomer(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateCustomer} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">اسم العميل / المؤسسة:</label>
                <input
                  type="text"
                  required
                  value={editingCustomer.name}
                  onChange={(e) => setEditingCustomer({...editingCustomer, name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">الرقم الضريبي (15 رقم):</label>
                <input
                  type="text"
                  value={editingCustomer.taxNumber || ''}
                  onChange={(e) => setEditingCustomer({...editingCustomer, taxNumber: e.target.value})}
                  placeholder="300000000000003"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">رقم الهاتف الجوال:</label>
                <input
                  type="text"
                  value={editingCustomer.phone || ''}
                  onChange={(e) => setEditingCustomer({...editingCustomer, phone: e.target.value})}
                  placeholder="05XXXXXXXX"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">العنوان / المقر:</label>
                <input
                  type="text"
                  value={editingCustomer.address || ''}
                  onChange={(e) => setEditingCustomer({...editingCustomer, address: e.target.value})}
                  placeholder="المدينة - الحي - الشارع"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">الرصيد الافتتاحي السابق (ريال):</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingCustomer.openingBalance || 0}
                  onChange={(e) => setEditingCustomer({...editingCustomer, openingBalance: Number(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  القيمة الموجبة تعني رصيد مدين مستحق لنا، والقيمة السالبة تعني رصيد دائن للعميل.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
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
        <h2 className="text-xl font-bold mt-4 border-b pb-2 inline-block">كشف بيانات وأرصدة العملاء</h2>
        <div className="mt-4 text-sm flex justify-between px-10 text-slate-600">
          <span>تاريخ الطباعة: {new Date().toLocaleDateString('ar-SA')}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-slate-200 print:border-none print:shadow-none overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse min-w-[680px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[10px] uppercase text-slate-500 font-bold">
                <th className="px-6 py-3.5">اسم العميل / المؤسسة</th>
                <th className="px-6 py-3.5">الرقم الضريبي</th>
                <th className="px-6 py-3.5">رقم الهاتف</th>
                <th className="px-6 py-3.5 text-center">عدد العمليات</th>
                <th className="px-6 py-3.5">الرصيد الفعلي الحالي</th>
                <th className="px-6 py-3.5 text-center print:hidden">كشف الحساب والإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredCustomers.map(({ customer: c, statement }) => (
                <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <div>
                      <span className="font-bold text-slate-800">{c.name}</span>
                      {c.address && <p className="text-[11px] text-slate-400">{c.address}</p>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-mono text-xs">{c.taxNumber || '-'}</td>
                  <td className="px-6 py-4 text-slate-600 font-mono text-xs">{c.phone || '-'}</td>
                  <td className="px-6 py-4 text-center font-mono text-xs font-bold text-slate-600">
                    <span className="bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                      {statement.transactions.length} حركات
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className={`font-mono font-bold text-sm ${
                        statement.balanceType === 'DEBIT' 
                          ? 'text-emerald-700' 
                          : statement.balanceType === 'CREDIT' 
                          ? 'text-purple-700' 
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
                        onClick={() => setSelectedPartnerForStatement(c)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors cursor-pointer border border-emerald-200"
                        title="فتح كشف حساب العميل التفصيلي المطابق"
                      >
                        <FileText size={13} />
                        <span>كشف الحساب</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCustomer(c)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                        title="تعديل بيانات العميل"
                      >
                        <Edit3 size={13} />
                        <span>تعديل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomer(c.id, c.name)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-medium transition-colors cursor-pointer"
                        title="حذف العميل"
                      >
                        <Trash2 size={13} />
                        <span>حذف</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                    لا توجد حسابات عملاء مطابقة لعملية البحث
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
