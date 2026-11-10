import React, { useState, useEffect } from 'react';
import { 
  Building, Briefcase, Globe, Users, Package, 
  MapPin, Map, Star, BookOpen, PieChart, UserPlus, X, Plus, Edit2, Trash2, Search
} from 'lucide-react';
import { loadChartOfAccounts, saveChartOfAccounts } from '../utils/trialBalanceStore';
import { loadCostCenters, saveCostCenters, CostCenter } from '../utils/costCenterStore';
import { getDynamicWarehousesList, CUSTOM_WAREHOUSES_STORAGE_KEY, dispatchStockUpdatedEvent } from '../utils/itemsStore';
import { loadCustomers, loadVendors, saveCustomers, saveVendors } from '../utils/partnerLedger';
import { AccountType, BalanceType } from '../types/accounting';

const EMPTY_MASTER_DATA = {
  departments: [] as { code: string; name: string; status?: string }[],
  jobs: [] as { code: string; title: string; status?: string }[],
  nationalities: [] as { code: string; name: string; status?: string }[],
  employees: [] as { code: string; name: string; department?: string; job?: string; status?: string }[],
  warehouses: [] as { code: string; name: string; status?: string }[],
  regions: [] as { code: string; name: string; status?: string }[],
  cities: [] as { code: string; name: string; region?: string; status?: string }[],
  customerGrades: [] as { code: string; name: string; discount?: string; status?: string }[],
  subAccounts: [] as any[],
  analyticAccounts: [] as any[],
  entities: [] as { code: string; name: string; type: string; status?: string }[],
};

function mapAccountTypeToArabic(type: AccountType, code: string): string {
  if (type === AccountType.Asset) {
    return code.startsWith('15') || code.startsWith('16') || code.startsWith('12') && code.length <= 4 ? 'أصول غير متداولة' : 'أصول متداولة';
  }
  if (type === AccountType.Liability) {
    return code.startsWith('25') || code.startsWith('26') ? 'خصوم غير متداولة' : 'خصوم متداولة';
  }
  if (type === AccountType.Equity) return 'حقوق ملكية';
  if (type === AccountType.Revenue) return 'إيرادات';
  return 'مصروفات';
}

function mapArabicToAccountType(label: string): AccountType {
  if (label.includes('أصول')) return AccountType.Asset;
  if (label.includes('خصوم')) return AccountType.Liability;
  if (label.includes('ملكية')) return AccountType.Equity;
  if (label.includes('إيراد')) return AccountType.Revenue;
  return AccountType.Expense;
}

function loadLiveMasterDatabase() {
  let savedCustom: any = {};
  try {
    const raw = localStorage.getItem('alpha_master_database_settings_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        savedCustom = parsed;
      }
    }
  } catch {}

  // 1. Employees from real payroll store
  let realEmployees: any[] = [];
  try {
    const rawEmp = localStorage.getItem('alpha_payroll_employees_v1') || localStorage.getItem('alpha_accounting_employees_v1');
    if (rawEmp) {
      const parsedEmp = JSON.parse(rawEmp);
      if (Array.isArray(parsedEmp)) {
        realEmployees = parsedEmp.map((e: any, idx: number) => ({
          code: e.code || e.id || `EMP-${idx + 1}`,
          name: e.name || '',
          department: e.department || '',
          job: e.jobTitle || e.job || '',
          status: e.status === 'INACTIVE' ? 'معلق / موقوف' : 'نشط'
        }));
      }
    }
  } catch {}

  // 2. Warehouses from real dynamic warehouses store
  const dynamicWhs = getDynamicWarehousesList();
  const realWarehouses = dynamicWhs.map((w, idx) => ({
    code: w.id === 'MAIN_WAREHOUSE' ? 'W01' : (w.id.startsWith('W') ? w.id : `W0${idx + 1}`),
    id: w.id,
    name: w.label,
    status: 'نشط'
  }));

  // 3. Sub-Accounts from real Chart of Accounts
  const chart = loadChartOfAccounts();
  const realSubAccounts = chart.map(acc => {
    const parent = chart.find(p => p.id === acc.parentId || p.code === acc.parentId);
    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      type: mapAccountTypeToArabic(acc.type, acc.code),
      nature: acc.balanceType === BalanceType.Debit ? 'مدين' : 'دائن',
      parentAccount: parent ? `${parent.code} - ${parent.name}` : (acc.parentId || ''),
      level: acc.level ? `مستوى ${acc.level}` : 'مستوى 4',
      status: acc.isActive === false ? 'معلق / موقوف' : 'نشط'
    };
  });

  // 4. Analytic Accounts from real Cost Centers store
  const costCenters = loadCostCenters();
  const realAnalyticAccounts = costCenters.map(cc => ({
    id: cc.id,
    code: cc.code,
    name: cc.name,
    type: cc.type === 'BRANCH' ? 'مركز ربحية' : cc.type === 'PROJECT' ? 'مشروع تعاقدي' : cc.type === 'FLEET' ? 'أسطول نقليات ولوجستيات' : 'مركز تكلفة إداري',
    dimension: cc.type === 'BRANCH' ? 'الفروع والأقاليم' : cc.type === 'PROJECT' ? 'المشاريع والعقود' : cc.type === 'FLEET' ? 'النقليات واللوجستيات' : 'الإدارات والأقسام',
    budget: cc.budget ? `${Number(cc.budget).toLocaleString()} ر.س` : '0 ر.س',
    manager: cc.manager || '',
    status: cc.status === 'INACTIVE' ? 'معلق / موقوف' : 'نشط'
  }));

  // 5. Entities from real Customers & Vendors stores
  const customers = loadCustomers();
  const vendors = loadVendors();
  const realEntities = [
    ...customers.map(c => ({ id: c.id, code: c.code || c.id, name: c.name, type: 'عميل', status: c.isActive === false ? 'معلق / موقوف' : 'نشط' })),
    ...vendors.map(v => ({ id: v.id, code: v.code || v.id, name: v.name, type: 'مورد', status: v.isActive === false ? 'معلق / موقوف' : 'نشط' }))
  ];

  return {
    departments: Array.isArray(savedCustom.departments) ? savedCustom.departments : EMPTY_MASTER_DATA.departments,
    jobs: Array.isArray(savedCustom.jobs) ? savedCustom.jobs : EMPTY_MASTER_DATA.jobs,
    nationalities: Array.isArray(savedCustom.nationalities) ? savedCustom.nationalities : EMPTY_MASTER_DATA.nationalities,
    regions: Array.isArray(savedCustom.regions) ? savedCustom.regions : EMPTY_MASTER_DATA.regions,
    cities: Array.isArray(savedCustom.cities) ? savedCustom.cities : EMPTY_MASTER_DATA.cities,
    customerGrades: Array.isArray(savedCustom.customerGrades) ? savedCustom.customerGrades : EMPTY_MASTER_DATA.customerGrades,
    employees: realEmployees,
    warehouses: realWarehouses,
    subAccounts: realSubAccounts,
    analyticAccounts: realAnalyticAccounts,
    entities: realEntities,
  };
}

export default function MasterDatabaseSettings() {
  const [dbData, setDbData] = useState<any>(() => loadLiveMasterDatabase());

  useEffect(() => {
    const handleSync = () => {
      setDbData(loadLiveMasterDatabase());
    };

    window.addEventListener('alpha-master-data-updated', handleSync);
    window.addEventListener('alpha-chart-of-accounts-updated', handleSync);
    window.addEventListener('alpha-cost-centers-updated', handleSync);
    window.addEventListener('alpha-items-updated', handleSync);
    window.addEventListener('alpha-payroll-updated', handleSync);
    window.addEventListener('alpha-partners-updated', handleSync);
    window.addEventListener('alpha-system-reset-completed', handleSync);
    window.addEventListener('alpha-data-changed', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('alpha-master-data-updated', handleSync);
      window.removeEventListener('alpha-chart-of-accounts-updated', handleSync);
      window.removeEventListener('alpha-cost-centers-updated', handleSync);
      window.removeEventListener('alpha-items-updated', handleSync);
      window.removeEventListener('alpha-payroll-updated', handleSync);
      window.removeEventListener('alpha-partners-updated', handleSync);
      window.removeEventListener('alpha-system-reset-completed', handleSync);
      window.removeEventListener('alpha-data-changed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const saveCustomMetadata = (updatedState: any) => {
    try {
      const toStore = {
        departments: updatedState.departments || [],
        jobs: updatedState.jobs || [],
        nationalities: updatedState.nationalities || [],
        regions: updatedState.regions || [],
        cities: updatedState.cities || [],
        customerGrades: updatedState.customerGrades || [],
      };
      localStorage.setItem('alpha_master_database_settings_v1', JSON.stringify(toStore));
    } catch {}
  };

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const categories = [
    { id: 'departments', title: 'أكواد إدارات الشركة', icon: Building, colorClass: 'text-blue-600 bg-blue-100', data: dbData.departments },
    { id: 'jobs', title: 'أكواد الوظائف في الشركة', icon: Briefcase, colorClass: 'text-indigo-600 bg-indigo-100', data: dbData.jobs },
    { id: 'nationalities', title: 'جنسية الموظفين', icon: Globe, colorClass: 'text-teal-600 bg-teal-100', data: dbData.nationalities },
    { id: 'employees', title: 'قاعدة بيانات الموظفين', icon: Users, colorClass: 'text-emerald-600 bg-emerald-100', data: dbData.employees },
    { id: 'warehouses', title: 'أسماء المخازن التابعة للشركة', icon: Package, colorClass: 'text-amber-600 bg-amber-100', data: dbData.warehouses },
    { id: 'regions', title: 'أكواد المنطقة التابع لها المورد أو العميل', icon: MapPin, colorClass: 'text-orange-600 bg-orange-100', data: dbData.regions },
    { id: 'cities', title: 'أكواد المدينة التابع لها المورد أو العميل', icon: Map, colorClass: 'text-red-600 bg-red-100', data: dbData.cities },
    { id: 'customerGrades', title: 'تصنيف درجة العميل', icon: Star, colorClass: 'text-yellow-600 bg-yellow-100', data: dbData.customerGrades },
    { id: 'subAccounts', title: 'أكواد الحسابات المالية الفرعية', icon: BookOpen, colorClass: 'text-purple-600 bg-purple-100', data: dbData.subAccounts },
    { id: 'analyticAccounts', title: 'أكواد الحسابات المالية التحليلية', icon: PieChart, colorClass: 'text-pink-600 bg-pink-100', data: dbData.analyticAccounts },
    { id: 'entities', title: 'الجهات والأفراد التي تتعامل معها الشركة', icon: UserPlus, colorClass: 'text-cyan-600 bg-cyan-100', data: dbData.entities },
  ];

  const handleAddNew = () => {
    setEditingItem(null);
    setIsFormOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleDelete = (code: string) => {
    setItemToDelete(code);
  };

  const confirmDelete = () => {
    if (!activeCategory || !itemToDelete) return;

    if (activeCategory === 'subAccounts') {
      const currentChart = loadChartOfAccounts().filter(a => a.code !== itemToDelete);
      saveChartOfAccounts(currentChart);
    } else if (activeCategory === 'analyticAccounts') {
      const currentCC = loadCostCenters().filter(c => c.code !== itemToDelete);
      saveCostCenters(currentCC);
    } else if (activeCategory === 'warehouses') {
      const remaining = dbData.warehouses.filter((x: any) => x.code !== itemToDelete).map((x: any) => ({ id: x.name, name: x.name }));
      localStorage.setItem(CUSTOM_WAREHOUSES_STORAGE_KEY, JSON.stringify(remaining));
      dispatchStockUpdatedEvent();
    } else if (activeCategory === 'employees') {
      try {
        const raw = localStorage.getItem('alpha_payroll_employees_v1') || '[]';
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((e: any) => e.code !== itemToDelete && e.id !== itemToDelete);
          localStorage.setItem('alpha_payroll_employees_v1', JSON.stringify(filtered));
          localStorage.setItem('alpha_accounting_employees_v1', JSON.stringify(filtered));
          window.dispatchEvent(new CustomEvent('alpha-payroll-updated'));
        }
      } catch {}
    } else if (activeCategory === 'entities') {
      const custs = loadCustomers().filter(c => c.code !== itemToDelete && c.id !== itemToDelete);
      const vends = loadVendors().filter(v => v.code !== itemToDelete && v.id !== itemToDelete);
      saveCustomers(custs);
      saveVendors(vends);
    }

    setDbData((prev: any) => {
      const updated = {
        ...prev,
        [activeCategory]: prev[activeCategory].filter((x: any) => x.code !== itemToDelete)
      };
      saveCustomMetadata(updated);
      return updated;
    });
    setItemToDelete(null);
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeCategory) return;
    
    const formData = new FormData(e.currentTarget);
    const data: Record<string, any> = Object.fromEntries(formData.entries());

    if (activeCategory === 'subAccounts') {
      const chart = loadChartOfAccounts();
      const accType = mapArabicToAccountType(String(data.type || 'أصول متداولة'));
      const balType = data.nature === 'دائن' ? BalanceType.Credit : BalanceType.Debit;
      const existingIdx = chart.findIndex(a => a.code === (editingItem?.code || data.code));
      if (existingIdx >= 0) {
        const existingAcc = chart[existingIdx]!;
        chart[existingIdx] = {
          ...existingAcc,
          name: String(data.name || existingAcc.name),
          type: accType,
          balanceType: balType,
          isActive: data.status !== 'معلق / موقوف'
        };
      } else {
        chart.push({
          id: `acc-${data.code}`,
          code: String(data.code),
          name: String(data.name),
          type: accType,
          balanceType: balType,
          isActive: data.status !== 'معلق / موقوف',
          isPosting: true
        });
      }
      saveChartOfAccounts(chart);
    } else if (activeCategory === 'analyticAccounts') {
      const ccs = loadCostCenters();
      const numericBudget = Number(String(data.budget || '0').replace(/[^0-9.]/g, '')) || 0;
      const typeStr = String(data.type || '');
      const ccType: CostCenter['type'] = typeStr.includes('ربحية') || typeStr.includes('فرع') ? 'BRANCH' : typeStr.includes('مشروع') ? 'PROJECT' : typeStr.includes('أسطول') || typeStr.includes('نقليات') ? 'FLEET' : 'DEPARTMENT';
      const ccStatus: CostCenter['status'] = data.status === 'معلق / موقوف' ? 'INACTIVE' : 'ACTIVE';
      const existingIdx = ccs.findIndex(c => c.code === (editingItem?.code || data.code));
      if (existingIdx >= 0) {
        const existingCC = ccs[existingIdx]!;
        ccs[existingIdx] = {
          ...existingCC,
          name: String(data.name || existingCC.name),
          type: ccType,
          manager: String(data.manager || ''),
          budget: numericBudget,
          status: ccStatus,
          updatedAt: new Date().toISOString()
        };
      } else {
        ccs.push({
          id: `cc-${Date.now()}`,
          code: String(data.code),
          name: String(data.name),
          type: ccType,
          manager: String(data.manager || ''),
          budget: numericBudget,
          status: ccStatus,
          createdAt: new Date().toISOString().split('T')[0] || ''
        });
      }
      saveCostCenters(ccs);
    } else if (activeCategory === 'warehouses') {
      const updatedList = [...dbData.warehouses];
      if (editingItem) {
        const idx = updatedList.findIndex(x => x.code === editingItem.code);
        if (idx >= 0) updatedList[idx] = data;
      } else {
        updatedList.push(data);
      }
      const customToSave = updatedList.map(w => ({ id: w.name, name: w.name }));
      localStorage.setItem(CUSTOM_WAREHOUSES_STORAGE_KEY, JSON.stringify(customToSave));
      dispatchStockUpdatedEvent();
    } else if (activeCategory === 'employees') {
      try {
        const raw = localStorage.getItem('alpha_payroll_employees_v1') || '[]';
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? [...parsed] : [];
        const existingIdx = list.findIndex((emp: any) => emp.code === (editingItem?.code || data.code) || emp.id === (editingItem?.code || data.code));
        if (existingIdx >= 0) {
          list[existingIdx] = {
            ...list[existingIdx],
            name: data.name,
            department: data.department || '',
            jobTitle: data.job || ''
          };
        } else {
          list.push({
            id: `emp-${Date.now()}`,
            code: data.code,
            name: data.name,
            department: data.department || '',
            jobTitle: data.job || '',
            basicSalary: 0,
            housingAllowance: 0,
            transportAllowance: 0,
            otherAllowances: 0,
            deductions: 0,
            status: 'ACTIVE'
          });
        }
        localStorage.setItem('alpha_payroll_employees_v1', JSON.stringify(list));
        localStorage.setItem('alpha_accounting_employees_v1', JSON.stringify(list));
        window.dispatchEvent(new CustomEvent('alpha-payroll-updated'));
      } catch {}
    } else if (activeCategory === 'entities') {
      if (data.type === 'مورد') {
        const vendors = loadVendors();
        const idx = vendors.findIndex(v => v.code === (editingItem?.code || data.code));
        if (idx >= 0) {
          vendors[idx] = { ...vendors[idx]!, name: String(data.name) };
        } else {
          vendors.push({ id: `vend-${Date.now()}`, code: String(data.code), name: String(data.name), type: 'VENDOR', openingBalance: 0, isActive: true });
        }
        saveVendors(vendors);
      } else {
        const customers = loadCustomers();
        const idx = customers.findIndex(c => c.code === (editingItem?.code || data.code));
        if (idx >= 0) {
          customers[idx] = { ...customers[idx]!, name: String(data.name) };
        } else {
          customers.push({ id: `cust-${Date.now()}`, code: String(data.code), name: String(data.name), type: 'CUSTOMER', openingBalance: 0, isActive: true });
        }
        saveCustomers(customers);
      }
    }

    setDbData((prev: any) => {
      const catData = [...prev[activeCategory]];
      if (editingItem) {
        const idx = catData.findIndex(x => x.code === editingItem.code);
        if (idx >= 0) catData[idx] = data;
      } else {
        catData.push(data);
      }
      const nextState = { ...prev, [activeCategory]: catData };
      saveCustomMetadata(nextState);
      return nextState;
    });
    
    setIsFormOpen(false);
  };

  const renderFormFields = () => {
    const isTitle = activeCategory === 'jobs';
    const hasDept = activeCategory === 'employees';
    const hasJob = activeCategory === 'employees';
    const hasRegion = activeCategory === 'cities';
    const hasDiscount = activeCategory === 'customerGrades';
    const hasType = activeCategory === 'entities' || activeCategory === 'subAccounts' || activeCategory === 'analyticAccounts';
    const isSubAccount = activeCategory === 'subAccounts';
    const isAnalytic = activeCategory === 'analyticAccounts';

    return (
      <div className="space-y-4 text-right max-h-[70vh] overflow-y-auto px-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">الكود / الرقم</label>
            <input 
              name="code" 
              defaultValue={editingItem?.code} 
              required 
              readOnly={!!editingItem}
              className={`w-full border rounded-lg p-2.5 outline-none transition-all ${editingItem ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'}`} 
              dir="ltr" 
              placeholder={isSubAccount ? 'مثال: 1105' : isAnalytic ? 'مثال: CC-106' : 'مثال: C01'}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              {isSubAccount || isAnalytic ? 'الحالة' : 'الحالة العامة'}
            </label>
            <select name="status" defaultValue={editingItem?.status || 'نشط'} className="w-full border rounded-lg p-2.5 text-right outline-none transition-all focus:border-blue-500 bg-white">
              <option value="نشط">نشط</option>
              <option value="مكتمل">مكتمل</option>
              <option value="قيد الإنشاء">قيد الإنشاء</option>
              <option value="معلق / موقوف">معلق / موقوف</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">{isTitle ? 'المسمى الوظيفي' : isSubAccount ? 'اسم الحساب المالي' : isAnalytic ? 'اسم المركز أو المشروع التحليلي' : 'الاسم / الوصف'}</label>
          <input 
            name={isTitle ? 'title' : 'name'} 
            defaultValue={editingItem?.name || editingItem?.title} 
            required 
            className="w-full border rounded-lg p-2.5 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" 
            placeholder="أدخل الاسم أو الوصف التفصيلي"
          />
        </div>

        {hasType && (
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              {activeCategory === 'subAccounts' ? 'تصنيف الحساب في القوائم المالية' : activeCategory === 'analyticAccounts' ? 'التصنيف التحليلي' : 'النوع'}
            </label>
            <select name="type" defaultValue={editingItem?.type || ''} className="w-full border rounded-lg p-2.5 text-right outline-none transition-all focus:border-blue-500 bg-white">
              {activeCategory === 'entities' && (
                <>
                  <option value="عميل">عميل</option>
                  <option value="مورد">مورد</option>
                  <option value="فرد/عميل">فرد/عميل</option>
                </>
              )}
              {activeCategory === 'subAccounts' && (
                <>
                  <option value="أصول متداولة">أصول متداولة</option>
                  <option value="أصول غير متداولة">أصول غير متداولة</option>
                  <option value="خصوم متداولة">خصوم متداولة</option>
                  <option value="خصوم غير متداولة">خصوم غير متداولة</option>
                  <option value="حقوق ملكية">حقوق ملكية</option>
                  <option value="إيرادات">إيرادات</option>
                  <option value="مصروفات">مصروفات</option>
                </>
              )}
              {activeCategory === 'analyticAccounts' && (
                <>
                  <option value="مركز تكلفة إداري">مركز تكلفة إداري</option>
                  <option value="مركز تكلفة تشغيلي">مركز تكلفة تشغيلي</option>
                  <option value="مركز ربحية">مركز ربحية</option>
                  <option value="مشروع تعاقدي">مشروع تعاقدي</option>
                  <option value="أصل ثابت متتبع">أصل ثابت متتبع</option>
                  <option value="فعالية/حملة تسويقية">فعالية/حملة تسويقية</option>
                </>
              )}
            </select>
          </div>
        )}

        {isSubAccount && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">طبيعة الحساب</label>
                <select name="nature" defaultValue={editingItem?.nature || 'مدين'} className="w-full border rounded-lg p-2.5 text-right outline-none transition-all focus:border-blue-500 bg-white">
                  <option value="مدين">مدين (Debit)</option>
                  <option value="دائن">دائن (Credit)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">مستوى الحساب</label>
                <select name="level" defaultValue={editingItem?.level || 'مستوى 4'} className="w-full border rounded-lg p-2.5 text-right outline-none transition-all focus:border-blue-500 bg-white">
                  <option value="مستوى 3">مستوى 3 - فرعي رئيسي</option>
                  <option value="مستوى 4">مستوى 4 - تشغيلي تفصيلي</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">الحساب الرئيسي المتبوع له</label>
              <input 
                name="parentAccount" 
                defaultValue={editingItem?.parentAccount || ''} 
                className="w-full border rounded-lg p-2.5 outline-none transition-all focus:border-blue-500" 
                placeholder="مثال: 1100 - النقدية وما في حكمها" 
              />
            </div>
          </>
        )}

        {isAnalytic && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">البُعد التحليلي</label>
                <select name="dimension" defaultValue={editingItem?.dimension || 'الإدارات والأقسام'} className="w-full border rounded-lg p-2.5 text-right outline-none transition-all focus:border-blue-500 bg-white">
                  <option value="الإدارات والأقسام">الإدارات والأقسام</option>
                  <option value="الفروع والأقاليم">الفروع والأقاليم</option>
                  <option value="المشاريع والعقود">المشاريع والعقود</option>
                  <option value="الأصول والأسطول">الأصول والأسطول</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">الموازنة التقديرية</label>
                <input 
                  name="budget" 
                  defaultValue={editingItem?.budget || ''} 
                  className="w-full border rounded-lg p-2.5 outline-none transition-all focus:border-blue-500" 
                  placeholder="مثال: 500,000 ر.س" 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">المسؤول / المشرف على المركز</label>
              <input 
                name="manager" 
                defaultValue={editingItem?.manager || ''} 
                className="w-full border rounded-lg p-2.5 outline-none transition-all focus:border-blue-500" 
                placeholder="أدخل اسم المسؤول..." 
              />
            </div>
          </>
        )}

        {hasDept && (
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">الإدارة التابع لها</label>
            <input name="department" defaultValue={editingItem?.department} className="w-full border rounded-lg p-2.5 outline-none transition-all focus:border-blue-500" placeholder="مثال: الإدارة المالية" />
          </div>
        )}
        {hasJob && (
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">المسمى الوظيفي</label>
            <input name="job" defaultValue={editingItem?.job} className="w-full border rounded-lg p-2.5 outline-none transition-all focus:border-blue-500" placeholder="مثال: محاسب عام" />
          </div>
        )}
        {hasRegion && (
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">المنطقة</label>
            <input name="region" defaultValue={editingItem?.region} className="w-full border rounded-lg p-2.5 outline-none transition-all focus:border-blue-500" placeholder="مثال: المنطقة الغربية" />
          </div>
        )}
        {hasDiscount && (
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">نسبة الخصم</label>
            <input name="discount" defaultValue={editingItem?.discount} className="w-full border rounded-lg p-2.5 outline-none transition-all focus:border-blue-500" dir="ltr" placeholder="مثال: 15%" />
          </div>
        )}
      </div>
    );
  };

  const activeCategoryData = categories.find(c => c.id === activeCategory);

  return (
    <div className="flex flex-col gap-6 w-full pb-8">
      {/* Category Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categories.map(cat => {
          const Icon = cat.icon;
          return (
            <div 
              key={cat.id} 
              onClick={() => {
                setActiveCategory(cat.id);
                setSearchTerm('');
              }}
              className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-md cursor-pointer transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className={`p-2.5 rounded-xl transition-transform group-hover:scale-105 ${cat.colorClass}`}>
                  <Icon size={20} />
                </div>
                <h4 className="font-bold text-sm leading-tight pt-1 text-slate-700 group-hover:text-blue-800 transition-colors">
                  {cat.title}
                </h4>
              </div>
              <div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-auto">
                <p className="text-[11px] text-slate-500 font-medium">يتضمن {cat.data.length} سجل / كود</p>
                <span className="btn-3d btn-3d-white text-[10px] px-2.5 py-0.5 font-bold group-hover:btn-3d-blue">
                  فتح السجل
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Primary List Modal */}
      {activeCategory && activeCategoryData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 sm:px-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${activeCategoryData.colorClass}`}>
                  <activeCategoryData.icon size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {activeCategoryData.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">إدارة وتعديل السجلات المرتبطة مباشرة بقواعد بيانات النظام</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleAddNew}
                  className="btn-3d btn-3d-blue px-4 py-1.5 text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus size={16} />
                  إضافة جديد
                </button>
                <button 
                  onClick={() => {
                    setActiveCategory(null);
                    setSearchTerm('');
                  }}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-white">
              {/* Search Bar */}
              <div className="relative mb-4">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث سريع برقم الكود، الاسم، التصنيف، الحساب الرئيسي أو المركز..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-10 text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all text-right"
                />
                <Search className="absolute right-3.5 top-3 text-slate-400" size={18} />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="absolute left-3.5 top-2.5 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors"
                    title="مسح البحث"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                <table className="w-full text-sm text-right">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 bg-slate-100/50 w-32">الكود / الرقم</th>
                      <th className="px-4 py-3">الوصف / الاسم / التفاصيل المحاسبية</th>
                      <th className="px-4 py-3 w-32 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredData = (activeCategoryData.data || []).filter((item: any) => {
                        if (!searchTerm.trim()) return true;
                        const q = searchTerm.toLowerCase();
                        return (
                          item.code?.toLowerCase().includes(q) ||
                          item.name?.toLowerCase().includes(q) ||
                          item.title?.toLowerCase().includes(q) ||
                          item.type?.toLowerCase().includes(q) ||
                          item.nature?.toLowerCase().includes(q) ||
                          item.parentAccount?.toLowerCase().includes(q) ||
                          item.dimension?.toLowerCase().includes(q) ||
                          item.manager?.toLowerCase().includes(q) ||
                          item.budget?.toLowerCase().includes(q) ||
                          item.department?.toLowerCase().includes(q) ||
                          item.job?.toLowerCase().includes(q) ||
                          item.region?.toLowerCase().includes(q)
                        );
                      });

                      if (filteredData.length === 0) {
                        return (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-slate-500 text-sm">
                              {searchTerm ? 'لا توجد نتائج مطابقة لبحثك.' : 'لا توجد سجلات مضافة في هذه القاعدة حتى الآن.'}
                            </td>
                          </tr>
                        );
                      }

                      return filteredData.map((item: any, idx: number) => (
                        <tr key={item.code || idx} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-slate-700 font-bold bg-slate-50/40 text-xs sm:text-sm">{item.code}</td>
                          <td className="px-4 py-3 text-slate-800">
                            <span className="block text-sm font-bold">{item.name || item.title}</span>
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              {item.nature && (
                                <span className={`text-[11px] px-2 py-0.5 rounded font-bold border ${
                                  item.nature === 'مدين' 
                                    ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                    : 'bg-purple-50 text-purple-700 border-purple-200'
                                }`}>
                                  طبيعة الحساب: {item.nature}
                                </span>
                              )}
                              {item.type && (
                                <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold border border-slate-200">
                                  {activeCategory === 'subAccounts' ? 'التصنيف: ' : activeCategory === 'analyticAccounts' ? 'النوع: ' : ''}{item.type}
                                </span>
                              )}
                              {item.parentAccount && (
                                <span className="text-[11px] px-2 py-0.5 bg-sky-50 text-sky-800 rounded font-medium border border-sky-200">
                                  الرئيسي: {item.parentAccount}
                                </span>
                              )}
                              {item.level && (
                                <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-medium border border-slate-200">
                                  {item.level}
                                </span>
                              )}
                              {item.dimension && (
                                <span className="text-[11px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-bold border border-indigo-200">
                                  البُعد: {item.dimension}
                                </span>
                              )}
                              {item.budget && (
                                <span className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold border border-emerald-200">
                                  الموازنة: {item.budget}
                                </span>
                              )}
                              {item.manager && (
                                <span className="text-[11px] px-2 py-0.5 bg-amber-50 text-amber-800 rounded font-medium border border-amber-200">
                                  المشرف: {item.manager}
                                </span>
                              )}
                              {item.status && (
                                <span className={`text-[11px] px-2 py-0.5 rounded font-bold border ${
                                  item.status === 'نشط' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : item.status === 'مكتمل'
                                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {item.status}
                                </span>
                              )}
                              {item.department && <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">{item.department}{item.job ? ` - ${item.job}` : ''}</span>}
                              {item.region && <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">المنطقة: {item.region}</span>}
                              {item.discount && <span className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold border border-emerald-100">الخصم: {item.discount}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button 
                                onClick={() => handleEdit(item)}
                                className="btn-3d btn-3d-primary-soft p-1.5"
                                title="تعديل"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={() => handleDelete(item.code)}
                                className="btn-3d btn-3d-danger-soft p-1.5"
                                title="حذف"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Secondary Form Modal (Add / Edit) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Form Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800">
                {editingItem ? 'تعديل سجل' : 'إضافة سجل جديد'}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Form Body */}
            <form onSubmit={handleSave} className="p-5">
              {renderFormFields()}
              
              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsFormOpen(false)}
                  className="btn-3d btn-3d-white px-4 py-2 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="btn-3d btn-3d-blue px-5 py-2 text-xs font-bold"
                >
                  {editingItem ? 'حفظ التعديلات' : 'إضافة السجل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">تأكيد الحذف</h3>
              <p className="text-sm text-slate-500 font-medium">
                هل أنت متأكد من حذف السجل المختار؟
                <br />لا يمكن التراجع عن هذه الخطوة.
              </p>
            </div>
            <div className="flex items-center gap-3 p-5 pt-0">
              <button 
                onClick={() => setItemToDelete(null)}
                className="btn-3d btn-3d-white flex-1 py-2 text-xs font-bold"
              >
                تراجع
              </button>
              <button 
                onClick={confirmDelete}
                className="btn-3d btn-3d-danger flex-1 py-2 text-xs font-bold"
              >
                نعم، احذف
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
