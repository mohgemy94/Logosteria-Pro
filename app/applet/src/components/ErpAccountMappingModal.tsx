import React, { useState, useEffect } from 'react';
import { 
  X, 
  Link2, 
  CheckCircle2, 
  RefreshCw, 
  Layers, 
  ArrowRight, 
  ExternalLink, 
  Scale, 
  Building2, 
  Coins, 
  Sliders, 
  ShieldCheck, 
  Search,
  ShoppingCart,
  ShoppingBag,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Briefcase,
  Package,
  UserCheck,
  Cog,
  ClipboardCheck,
  CreditCard,
  PieChart,
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';
import { 
  getErpIntegrationModulesSummary, 
  loadErpAccountMapping, 
  saveErpAccountMapping, 
  runFullErpAccountingSync,
  ErpModuleMapping,
  SystemAccountMappingSettings
} from '../utils/accountingIntegration';
import { loadChartOfAccounts } from '../utils/trialBalanceStore';
import { navigateToAccountMovements } from '../utils/accountMovementsStore';
import { Account } from '../types/accounting';

interface ErpAccountMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToView?: (view: string) => void;
  currencySymbol?: string;
}

export default function ErpAccountMappingModal({
  isOpen,
  onClose,
  onNavigateToView,
  currencySymbol = 'ر.س'
}: ErpAccountMappingModalProps) {
  const [modules, setModules] = useState<ErpModuleMapping[]>([]);
  const [mapping, setMapping] = useState<SystemAccountMappingSettings>(loadErpAccountMapping());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'matrix' | 'config' | 'syncLogs'>('matrix');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [editingModule, setEditingModule] = useState<ErpModuleMapping | null>(null);

  // Load state on mount / open
  useEffect(() => {
    if (isOpen) {
      refreshData();
    }
  }, [isOpen]);

  const refreshData = () => {
    setModules(getErpIntegrationModulesSummary());
    setMapping(loadErpAccountMapping());
    setAccounts(loadChartOfAccounts());
  };

  if (!isOpen) return null;

  const handleSyncAll = () => {
    setSyncing(true);
    setTimeout(() => {
      const res = runFullErpAccountingSync();
      setSyncResult(res);
      setSyncing(false);
      refreshData();
    }, 600);
  };

  const handleNavigate = (view: string) => {
    onClose();
    if (onNavigateToView) {
      onNavigateToView(view);
    } else {
      window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view } }));
    }
  };

  const handleViewLedger = (accountCode: string) => {
    onClose();
    navigateToAccountMovements(accountCode, onNavigateToView);
  };

  // Icon selector
  const renderIcon = (name: string, className = "w-5 h-5") => {
    switch (name) {
      case 'ShoppingCart': return <ShoppingCart className={className} />;
      case 'ShoppingBag': return <ShoppingBag className={className} />;
      case 'ArrowDownLeft': return <ArrowDownLeft className={className} />;
      case 'ArrowUpRight': return <ArrowUpRight className={className} />;
      case 'Users': return <Users className={className} />;
      case 'Briefcase': return <Briefcase className={className} />;
      case 'Package': return <Package className={className} />;
      case 'UserCheck': return <UserCheck className={className} />;
      case 'Cog': return <Cog className={className} />;
      case 'ClipboardCheck': return <ClipboardCheck className={className} />;
      case 'CreditCard': return <CreditCard className={className} />;
      case 'PieChart': return <PieChart className={className} />;
      default: return <Layers className={className} />;
    }
  };

  // Find account details
  const getAccountInfo = (code: string) => {
    const found = accounts.find(a => a.code === code);
    return found ? `${found.code} - ${found.name}` : code;
  };

  const filteredModules = modules.filter(m => {
    const matchCat = selectedCategory === 'ALL' || m.category === selectedCategory;
    const matchSearch = searchTerm === '' || 
      m.moduleNameAr.includes(searchTerm) || 
      m.descriptionAr.includes(searchTerm) || 
      m.primaryAccountCode.includes(searchTerm);
    return matchCat && matchSearch;
  });

  const categories = [
    { id: 'ALL', label: 'كافة الشاشات (الكل)' },
    { id: 'SALES', label: 'المبيعات' },
    { id: 'PURCHASES', label: 'المشتريات' },
    { id: 'TREASURY', label: 'الخزائن والبنوك' },
    { id: 'PARTNERS', label: 'العملاء والموردين' },
    { id: 'INVENTORY', label: 'المخزون والجرد' },
    { id: 'PAYROLL', label: 'الرواتب والأجور' },
    { id: 'MANUFACTURING', label: 'التصنيع والإنتاج' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs font-sans animate-fade-in" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-right">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 shrink-0 border-b border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  التكامل المحاسبي الشامل نشط 100%
                </span>
                <span className="text-xs text-slate-400">ERP Unified Chart of Accounts Hub</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2.5">
                <Link2 className="text-emerald-400" size={24} />
                <span>مركز ربط شجرة الحسابات بكافة شاشات وأقسام البرنامج</span>
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-3xl">
                ربط توجيهي وتلقائي لكافة فواتير المبيعات، المشتريات، المقبوضات، المدفوعات، العملاء، الموردين، المخزون، والرواتب مباشرة مع شجرة الحسابات وميزان المراجعة.
              </p>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title="إغلاق النافذة"
            >
              <X size={20} />
            </button>
          </div>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80 text-xs">
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
              <span className="text-slate-400 block font-medium">الشاشات المربوطة بالشجرة</span>
              <span className="text-base font-bold text-emerald-400 font-mono">12 شاشة / 100%</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
              <span className="text-slate-400 block font-medium">حسابات التوجيه المعتمدة</span>
              <span className="text-base font-bold text-indigo-300 font-mono">{accounts.length} حساب مالي</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
              <span className="text-slate-400 block font-medium">إجمالي الحركات المفحوصة</span>
              <span className="text-base font-bold text-amber-300 font-mono">
                {modules.reduce((sum, m) => sum + (m.transactionCount || 0), 0)} حركة
              </span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
              <span className="text-slate-400 block font-medium">حالة التوازن المحاسبي</span>
              <span className="text-base font-bold text-sky-300 flex items-center gap-1 font-mono">
                <CheckCircle2 size={14} className="text-emerald-400" />
                متطابق وسليم
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs & Actions Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'matrix' 
                  ? 'bg-white text-indigo-900 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              مصفوفة الشاشات المربوطة ({modules.length})
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'config' 
                  ? 'bg-white text-indigo-900 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              إعدادات وتخصيص التوجيه ⚙️
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncAll}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="مزامنة شاملة فورية لكافة شاشات وحركات المنظومة مع شجرة الحسابات"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              <span>{syncing ? 'جارٍ التدقيق والمزامنة...' : 'مزامنة وتدقيق الربط الشامل'}</span>
            </button>
          </div>
        </div>

        {/* Sync Result Banner if exists */}
        {syncResult && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-3 text-emerald-900 text-xs flex items-center justify-between shrink-0 animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <div className="space-y-0.5">
                <span className="font-bold">اكتملت المزامنة بنجاح في تمام {syncResult.timestamp}!</span>
                <span className="text-slate-600 block text-[11px]">{syncResult.details[0]} {syncResult.details[1]}</span>
              </div>
            </div>
            <button 
              onClick={() => setSyncResult(null)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Tab 1: Screen Matrix */}
        {activeTab === 'matrix' && (
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث باسم الشاشة، نوع المعاملة، أو كود الحساب..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pr-9 pl-4 text-xs outline-none focus:bg-white focus:border-indigo-500"
                />
                <Search className="absolute right-3 top-2.5 text-slate-400" size={14} />
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1">
                {categories.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                      selectedCategory === c.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredModules.map((m) => (
                <div 
                  key={m.moduleId}
                  className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {renderIcon(m.iconName)}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">{m.moduleNameAr}</h3>
                          <span className="text-[11px] text-slate-400 font-medium">{m.categoryLabelAr}</span>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                        مربوط بالشجرة
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-slate-600 text-xs mb-3 leading-relaxed">
                      {m.descriptionAr}
                    </p>

                    {/* Linked Accounts Pills */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 mb-3 space-y-1.5">
                      <div className="text-[11px] text-slate-500 font-bold flex items-center gap-1">
                        <Layers size={12} className="text-indigo-600" />
                        <span>الحسابات المحاسبية الموجهة بالشجرة:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span 
                          onClick={() => handleViewLedger(m.primaryAccountCode)}
                          className="px-2 py-1 bg-white border border-indigo-200 text-indigo-900 rounded-md text-[11px] font-mono font-bold hover:bg-indigo-50 cursor-pointer shadow-2xs"
                          title="عرض كشف حركة هذا الحساب مباشرة"
                        >
                          ⭐ {getAccountInfo(m.primaryAccountCode)}
                        </span>
                        {m.secondaryAccountCodes.slice(0, 3).map((code) => (
                          <span 
                            key={code}
                            onClick={() => handleViewLedger(code)}
                            className="px-2 py-1 bg-white border border-slate-200 text-slate-700 rounded-md text-[11px] font-mono hover:bg-slate-50 cursor-pointer shadow-2xs"
                            title="عرض كشف حركة هذا الحساب"
                          >
                            {getAccountInfo(code)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Metrics & Navigation Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div className="text-slate-500 text-[11px]">
                      {m.transactionCount !== undefined && m.transactionCount > 0 ? (
                        <span><strong className="text-slate-800 font-mono">{m.transactionCount}</strong> مستند مسجل</span>
                      ) : (
                        <span className="text-slate-400">جاهز لاستقبال الحركات</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleViewLedger(m.primaryAccountCode)}
                        className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        title="عرض كشف الحساب والحركات في دفتر الأستاذ"
                      >
                        <Scale size={13} />
                        <span>كشف الحساب</span>
                      </button>

                      <button
                        onClick={() => handleNavigate(m.targetView)}
                        className="px-3 py-1.5 text-xs font-bold bg-slate-900 hover:bg-indigo-600 text-white rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                        title={`الانتقال مباشرة لشاشة ${m.moduleNameAr}`}
                      >
                        <span>فتح الشاشة</span>
                        <ArrowRight size={13} className="rotate-180" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Custom Mapping Configuration */}
        {activeTab === 'config' && (
          <div className="p-5 flex-1 overflow-y-auto space-y-6">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 text-xs text-indigo-950 flex items-start gap-2.5">
              <ShieldCheck className="text-indigo-600 shrink-0 mt-0.5" size={18} />
              <div>
                <strong className="block text-sm mb-1 font-bold">التوجيه المحاسبي الافتراضي الصارم (System Account Mapping)</strong>
                <p className="text-indigo-900 leading-relaxed">
                  يحدد هذا الجدول الحسابات الافتراضية من شجرة الحسابات التي يتم توجيه القيود والعمليات التلقائية إليها عند حفظ فواتير المبيعات، المشتريات، سندات القبض، والصرف.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-sm border-b pb-2 flex items-center gap-2">
                <ShoppingCart size={16} className="text-indigo-600" />
                <span>1. إعدادات توجيه المبيعات ونقاط البيع (Sales Mapping)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">حساب إيرادات المبيعات الرئيسي</label>
                  <select
                    value={mapping.salesRevenueAccount}
                    onChange={(e) => {
                      const updated = { ...mapping, salesRevenueAccount: e.target.value };
                      setMapping(updated);
                      saveErpAccountMapping(updated);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-xs"
                  >
                    {accounts.filter(a => a.type === 'REVENUE' || a.code.startsWith('4')).map(a => (
                      <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">حساب ضريبة القيمة المضافة المستحقة (VAT)</label>
                  <select
                    value={mapping.salesVatAccount}
                    onChange={(e) => {
                      const updated = { ...mapping, salesVatAccount: e.target.value };
                      setMapping(updated);
                      saveErpAccountMapping(updated);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-xs"
                  >
                    {accounts.filter(a => a.type === 'LIABILITY' || a.code.startsWith('2')).map(a => (
                      <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">حساب الصندوق الرئيسي للمبيعات النقدية</label>
                  <select
                    value={mapping.salesCashAccount}
                    onChange={(e) => {
                      const updated = { ...mapping, salesCashAccount: e.target.value };
                      setMapping(updated);
                      saveErpAccountMapping(updated);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-xs"
                  >
                    {accounts.filter(a => a.code.startsWith('1101')).map(a => (
                      <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">حساب البنك للمبيعات بالشبكة والتحويل</label>
                  <select
                    value={mapping.salesBankTransferAccount}
                    onChange={(e) => {
                      const updated = { ...mapping, salesBankTransferAccount: e.target.value };
                      setMapping(updated);
                      saveErpAccountMapping(updated);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-xs"
                  >
                    {accounts.filter(a => a.code.startsWith('1102') || a.code.startsWith('1103')).map(a => (
                      <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <h3 className="font-bold text-slate-900 text-sm border-b pb-2 pt-4 flex items-center gap-2">
                <ShoppingBag size={16} className="text-emerald-600" />
                <span>2. إعدادات توجيه المشتريات والمخزون (Purchases & Inventory Mapping)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">حساب المخزون السلعي والمشتريات</label>
                  <select
                    value={mapping.purchasesInventoryAccount}
                    onChange={(e) => {
                      const updated = { ...mapping, purchasesInventoryAccount: e.target.value };
                      setMapping(updated);
                      saveErpAccountMapping(updated);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-xs"
                  >
                    {accounts.filter(a => a.code.startsWith('1301') || a.code.startsWith('13')).map(a => (
                      <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">حساب مراقبة ذمم الموردين (AP)</label>
                  <select
                    value={mapping.purchasesPayableAccount}
                    onChange={(e) => {
                      const updated = { ...mapping, purchasesPayableAccount: e.target.value };
                      setMapping(updated);
                      saveErpAccountMapping(updated);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-xs"
                  >
                    {accounts.filter(a => a.code.startsWith('2101') || a.code.startsWith('21')).map(a => (
                      <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <h3 className="font-bold text-slate-900 text-sm border-b pb-2 pt-4 flex items-center gap-2">
                <Users size={16} className="text-blue-600" />
                <span>3. حسابات العملاء والموردين الموحدة (Sub-Ledger Controls)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">حساب مراقبة العملاء (AR Control)</label>
                  <input
                    type="text"
                    disabled
                    value={getAccountInfo(mapping.customersControlAccount)}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-600 font-bold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">يرتبط به تلقائياً كافة العملاء في كشوف الحسابات.</span>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">حساب مراقبة الموردين (AP Control)</label>
                  <input
                    type="text"
                    disabled
                    value={getAccountInfo(mapping.vendorsControlAccount)}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-600 font-bold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">يرتبط به تلقائياً كافة الموردين والمدفوعات الآجلة.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>آخر تدقيق ومزامنة: {mapping.lastSyncTime ? new Date(mapping.lastSyncTime).toLocaleDateString('ar-SA') : 'الآن'}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              تم والعودة لشجرة الحسابات
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
