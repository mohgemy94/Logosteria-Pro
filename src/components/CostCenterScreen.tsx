import { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  Printer, 
  RotateCw, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  User, 
  FolderTree, 
  Truck, 
  Compass, 
  X, 
  Edit, 
  Trash2, 
  PieChart, 
  Scale
} from 'lucide-react';
import { 
  CostCenter, 
  CostCenterType, 
  CostCenterSummary, 
  CostCenterStatus 
} from '../types/costCenter';
import { 
  loadCostCenters, 
  addCostCenter, 
  updateCostCenter, 
  deleteCostCenter, 
  calculateCostCenterAnalytics, 
  getCostCenterTypeLabel, 
  getCostCenterTypeColor 
} from '../utils/costCenterStore';
import { useSystemCurrency } from '../utils/currency';
import { getSystemSettings } from '../utils/settings';

interface CostCenterScreenProps {
  onNavigate?: (view: string) => void;
  initialCenterId?: string;
}

export default function CostCenterScreen({ onNavigate: _onNavigate, initialCenterId }: CostCenterScreenProps) {
  const { symbol: currencySymbol } = useSystemCurrency();
  const systemSettings = getSystemSettings();

  const [costCenters, setCostCenters] = useState<CostCenter[]>(() => loadCostCenters());
  const [dataVersion, setDataVersion] = useState(0);

  // Filters
  const [selectedType, setSelectedType] = useState<'ALL' | CostCenterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<CostCenter | null>(null);

  // Detail Statement Modal
  const [selectedCenterForReport, setSelectedCenterForReport] = useState<CostCenterSummary | null>(null);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'PROJECT' as CostCenterType,
    manager: '',
    budget: '',
    description: '',
    status: 'ACTIVE' as CostCenterStatus
  });

  // Sync with store and global updates
  useEffect(() => {
    const handleUpdate = () => {
      setCostCenters(loadCostCenters());
      setDataVersion(v => v + 1);
    };

    window.addEventListener('alpha-cost-centers-updated', handleUpdate);
    window.addEventListener('alpha-vouchers-updated', handleUpdate);
    window.addEventListener('alpha-partner-ledger-updated', handleUpdate);
    window.addEventListener('alpha-journal-entries-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('alpha-cost-centers-updated', handleUpdate);
      window.removeEventListener('alpha-vouchers-updated', handleUpdate);
      window.removeEventListener('alpha-partner-ledger-updated', handleUpdate);
      window.removeEventListener('alpha-journal-entries-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Calculate analytics for all centers
  const summaries: CostCenterSummary[] = useMemo(() => {
    return calculateCostCenterAnalytics(undefined, startDate || undefined, endDate || undefined);
  }, [costCenters, startDate, endDate, dataVersion]);

  // Keep selectedCenterForReport updated when data changes
  useEffect(() => {
    if (selectedCenterForReport) {
      const refreshed = summaries.find(s => s.costCenter.id === selectedCenterForReport.costCenter.id);
      if (refreshed) {
        setSelectedCenterForReport(refreshed);
      }
    }
  }, [summaries]);

  // Auto-open initialCenterId if provided
  useEffect(() => {
    if (initialCenterId && summaries.length > 0) {
      const target = summaries.find(s => s.costCenter.id === initialCenterId || s.costCenter.code === initialCenterId);
      if (target) {
        setSelectedCenterForReport(target);
      }
    }
  }, [initialCenterId, summaries]);

  // Filtered summaries
  const filteredSummaries = useMemo(() => {
    return summaries.filter(s => {
      if (selectedType !== 'ALL' && s.costCenter.type !== selectedType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = s.costCenter.name.toLowerCase().includes(q);
        const matchesCode = s.costCenter.code.toLowerCase().includes(q);
        const matchesManager = (s.costCenter.manager || '').toLowerCase().includes(q);
        const matchesDesc = (s.costCenter.description || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesManager && !matchesDesc) {
          return false;
        }
      }
      return true;
    });
  }, [summaries, selectedType, searchQuery]);

  // Overall Totals
  const overallStats = useMemo(() => {
    let totalExpenses = 0;
    let totalRevenues = 0;
    let totalBudget = 0;
    let activeCount = 0;

    summaries.forEach(s => {
      totalExpenses += s.totalExpenses;
      totalRevenues += s.totalRevenues;
      totalBudget += (s.costCenter.budget || 0);
      if (s.costCenter.status === 'ACTIVE') activeCount++;
    });

    const netIncome = totalRevenues - totalExpenses;
    const avgUtilization = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;

    return {
      totalExpenses,
      totalRevenues,
      netIncome,
      totalBudget,
      activeCount,
      totalCount: summaries.length,
      avgUtilization
    };
  }, [summaries]);

  const handleOpenAddModal = () => {
    const existingCodes = costCenters.map(c => c.code);
    let nextNum = 101;
    while (existingCodes.includes(`CC-${nextNum}`)) {
      nextNum++;
    }
    setEditingCenter(null);
    setFormData({
      code: `CC-${nextNum}`,
      name: '',
      type: 'PROJECT',
      manager: '',
      budget: '',
      description: '',
      status: 'ACTIVE'
    });
    setIsAddEditModalOpen(true);
  };

  const handleOpenEditModal = (center: CostCenter) => {
    setEditingCenter(center);
    setFormData({
      code: center.code,
      name: center.name,
      type: center.type,
      manager: center.manager || '',
      budget: center.budget ? center.budget.toString() : '',
      description: center.description || '',
      status: center.status
    });
    setIsAddEditModalOpen(true);
  };

  const handleSaveCenter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      alert('يرجى إدخال كود واسم مركز التكلفة');
      return;
    }

    const budgetNum = formData.budget ? parseFloat(formData.budget) : undefined;

    if (editingCenter) {
      updateCostCenter(editingCenter.id, {
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        type: formData.type,
        manager: formData.manager.trim() || undefined,
        budget: budgetNum && budgetNum > 0 ? budgetNum : undefined,
        description: formData.description.trim() || undefined,
        status: formData.status
      });
    } else {
      addCostCenter({
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        type: formData.type,
        manager: formData.manager.trim() || undefined,
        budget: budgetNum && budgetNum > 0 ? budgetNum : undefined,
        description: formData.description.trim() || undefined,
        status: formData.status
      });
    }

    setIsAddEditModalOpen(false);
  };

  const handleDeleteCenter = (center: CostCenter) => {
    if (confirm(`هل أنت متأكد من حذف مركز التكلفة [${center.code}] ${center.name}؟`)) {
      deleteCostCenter(center.id);
      if (selectedCenterForReport?.costCenter.id === center.id) {
        setSelectedCenterForReport(null);
      }
    }
  };

  const getTypeIcon = (type: CostCenterType) => {
    switch (type) {
      case 'BRANCH': return <Building2 size={16} className="text-emerald-600" />;
      case 'PROJECT': return <Compass size={16} className="text-indigo-600" />;
      case 'FLEET': return <Truck size={16} className="text-amber-600" />;
      case 'DEPARTMENT': return <FolderTree size={16} className="text-purple-600" />;
      default: return <Layers size={16} className="text-slate-600" />;
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-slate-50 min-h-screen text-slate-800 p-4 sm:p-6 lg:p-8 font-sans">
      {/* Top Application Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1 text-slate-500 text-xs font-bold">
            <span>المالية والحسابات</span>
            <span>/</span>
            <span className="text-slate-800 font-extrabold">مراكز التكلفة والمشاريع</span>
            <span>/</span>
            <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-bold border border-indigo-200">
              تقارير أرباح وخسائر منفصلة
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Compass size={22} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                مراكز التكلفة والمشاريع (Cost Centers)
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                توزيع المصروفات وسندات الصرف، ومتابعة الأرباح والخسائر لكل فرع أو مشروع أو أسطول على حدة
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Printer size={15} />
            <span>طباعة تقرير المراكز</span>
          </button>

          <button
            type="button"
            onClick={() => setDataVersion(v => v + 1)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <RotateCw size={15} />
            <span>تحديث</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <Plus size={16} />
            <span>إضافة مركز تكلفة جديد</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Total Centers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 mb-1">إجمالي مراكز التكلفة</div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {overallStats.totalCount} <span className="text-xs font-bold text-slate-500">مركز</span>
            </div>
            <div className="text-[11px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
              <CheckCircle2 size={12} />
              <span>{overallStats.activeCount} مراكز نشطة قيد التشغيل</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Compass size={24} />
          </div>
        </div>

        {/* Card 2: Total Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 mb-1">إجمالي المصروفات المحملة</div>
            <div className="text-2xl font-black text-rose-600 font-mono">
              {overallStats.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs font-bold text-slate-500">{currencySymbol}</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              سندات صرف وقيد على المراكز
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <TrendingDown size={24} />
          </div>
        </div>

        {/* Card 3: Total Revenues */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 mb-1">إجمالي الإيرادات المرتبطة</div>
            <div className="text-2xl font-black text-emerald-600 font-mono">
              {overallStats.totalRevenues.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs font-bold text-slate-500">{currencySymbol}</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              تحصيلات وتوريدات المراكز
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Card 4: Net P&L */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 mb-1">صافي أرباح / خسائر المراكز</div>
            <div className={`text-2xl font-black font-mono ${overallStats.netIncome >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {overallStats.netIncome >= 0 ? '+' : ''}{overallStats.netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs font-bold text-slate-500">{currencySymbol}</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {overallStats.netIncome >= 0 ? 'فائض تشغيلي مجمع' : 'عجز تشغيلي مجمع'}
            </div>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            overallStats.netIncome >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          }`}>
            <Scale size={24} />
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs mb-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 print:hidden">
        {/* Type Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <button
            type="button"
            onClick={() => setSelectedType('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedType === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            جميع المراكز ({summaries.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('PROJECT')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedType === 'PROJECT'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            <Compass size={13} />
            <span>المشاريع</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('BRANCH')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedType === 'BRANCH'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <Building2 size={13} />
            <span>الفروع</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('FLEET')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedType === 'FLEET'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <Truck size={13} />
            <span>أسطول النقليات</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('DEPARTMENT')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedType === 'DEPARTMENT'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            <FolderTree size={13} />
            <span>الأقسام الداخلية</span>
          </button>
        </div>

        {/* Date Filter & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs">
            <Calendar size={13} className="text-slate-400" />
            <span className="text-[11px] text-slate-500 font-bold">من:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-slate-700 focus:outline-none"
            />
            <span className="text-[11px] text-slate-500 font-bold mx-1">إلى:</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-slate-700 focus:outline-none"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                title="إلغاء تصفية التاريخ"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث بالكود، الاسم، المسؤول..."
              className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
            />
          </div>
        </div>
      </div>

      {/* Cost Centers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        {filteredSummaries.map(summary => {
          const { costCenter, totalExpenses, totalRevenues, netIncome, budgetUtilizationPercent, vouchersCount } = summary;
          const typeColor = getCostCenterTypeColor(costCenter.type);
          const budget = costCenter.budget || 0;
          const isOverBudget = budget > 0 && totalExpenses > budget;

          return (
            <div
              key={costCenter.id}
              className="bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-300 hover:shadow-lg transition-all duration-200 flex flex-col justify-between overflow-hidden group shadow-xs"
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black bg-slate-900 text-white px-2 py-0.5 rounded-md">
                      {costCenter.code}
                    </span>
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 ${typeColor.bg} ${typeColor.text} ${typeColor.border}`}>
                      {getTypeIcon(costCenter.type)}
                      <span>{getCostCenterTypeLabel(costCenter.type)}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(costCenter)}
                      className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      title="تعديل المركز"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCenter(costCenter)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      title="حذف المركز"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Name & Manager */}
                <h3 className="text-base font-black text-slate-900 mb-1 group-hover:text-indigo-700 transition-colors">
                  {costCenter.name}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                  <User size={13} className="text-slate-400 shrink-0" />
                  <span className="font-bold">المسؤول:</span>
                  <span className="text-slate-700 font-semibold">{costCenter.manager || 'غير محدد'}</span>
                </div>

                {costCenter.description && (
                  <p className="text-xs text-slate-500 mb-4 line-clamp-2 leading-relaxed">
                    {costCenter.description}
                  </p>
                )}

                {/* Financial Summary Numbers */}
                <div className="grid grid-cols-2 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100 mb-4">
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold">إجمالي المصروفات</div>
                    <div className="text-sm font-black text-rose-600 font-mono">
                      {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] text-slate-500">{currencySymbol}</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500 font-bold">إجمالي الإيرادات</div>
                    <div className="text-sm font-black text-emerald-600 font-mono">
                      {totalRevenues.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] text-slate-500">{currencySymbol}</span>
                    </div>
                  </div>

                  <div className="col-span-2 pt-2 border-t border-slate-200/70 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600">صافي ربح / خسارة المركز:</span>
                    <span className={`text-sm font-black font-mono ${netIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {netIncome >= 0 ? '+' : ''}{netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                    </span>
                  </div>
                </div>

                {/* Budget Utilization Progress Bar */}
                {budget > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                      <span className="text-slate-500">استهلاك الميزانية:</span>
                      <span className={`font-mono ${isOverBudget ? 'text-rose-600 font-black' : 'text-slate-700'}`}>
                        {budgetUtilizationPercent.toFixed(1)}% ({totalExpenses.toLocaleString()} / {budget.toLocaleString()} {currencySymbol})
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isOverBudget 
                            ? 'bg-rose-600' 
                            : budgetUtilizationPercent > 80 
                              ? 'bg-amber-500' 
                              : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(budgetUtilizationPercent, 100)}%` }}
                      ></div>
                    </div>
                    {isOverBudget && (
                      <div className="flex items-center gap-1 text-[10px] text-rose-600 font-bold mt-1">
                        <AlertTriangle size={11} />
                        <span>تم تجاوز الميزانية المعتمدة بـ {(totalExpenses - budget).toLocaleString()} {currencySymbol}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Card Action */}
              <div className="p-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-bold">
                  {vouchersCount} سندات وحركات مسجلة
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCenterForReport(summary)}
                  className="flex items-center gap-1 text-xs font-black text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer group-hover:underline"
                >
                  <span>كشف المصروفات والأرباح ←</span>
                </button>
              </div>
            </div>
          );
        })}

        {filteredSummaries.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300">
            <Compass size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-700 font-bold text-sm mb-1">لا توجد مراكز تكلفة مطابقة لمعايير البحث</p>
            <p className="text-slate-400 text-xs mb-4">يمكنك إضافة مركز تكلفة جديد وتعيين سندات الصرف عليه</p>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              + إضافة مركز تكلفة جديد
            </button>
          </div>
        )}
      </div>

      {/* --- Detailed Statement & P&L Report Modal for a Cost Center --- */}
      {selectedCenterForReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-3 sm:p-6 print:static print:block print:inset-auto print:bg-transparent print:p-0 animate-fadeIn">
          <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 print:max-h-none print:border-none print:shadow-none print:rounded-none">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between shrink-0 print:bg-white print:text-black print:border-b print:p-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center print:hidden">
                  <Compass size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                      تقرير أرباح وخسائر ومصروفات المركز: {selectedCenterForReport.costCenter.name}
                    </h2>
                    <span className="font-mono text-xs font-black bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded">
                      {selectedCenterForReport.costCenter.code}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>النوع: {getCostCenterTypeLabel(selectedCenterForReport.costCenter.type)}</span>
                    <span>•</span>
                    <span>المسؤول: {selectedCenterForReport.costCenter.manager || 'غير محدد'}</span>
                    {(startDate || endDate) && (
                      <>
                        <span>•</span>
                        <span>الفترة: {startDate || 'البداية'} إلى {endDate || 'اليوم'}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <Printer size={14} />
                  <span>طباعة القائمة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCenterForReport(null)}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col gap-6 print:overflow-visible print:p-0">
              
              {/* Printable Organization Header */}
              <div className="hidden print:flex items-center justify-between border-b pb-4 mb-4">
                <div>
                  <h1 className="text-2xl font-black">{systemSettings.company?.nameAr || 'لوجوستريا للأنظمة المحاسبية'}</h1>
                  <p className="text-xs text-slate-600">قائمة الأرباح والخسائر التفصيلية لمركز التكلفة</p>
                </div>
                <div className="text-left text-xs font-mono">
                  <div>كود المركز: {selectedCenterForReport.costCenter.code}</div>
                  <div>تاريخ التقرير: {new Date().toLocaleDateString('ar-SA')}</div>
                </div>
              </div>

              {/* KPI Ribbon for this center */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
                  <div className="text-xs font-bold text-rose-800 mb-1">إجمالي المصروفات (سندات الصرف)</div>
                  <div className="text-2xl font-black text-rose-700 font-mono">
                    {selectedCenterForReport.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs">{currencySymbol}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="text-xs font-bold text-emerald-800 mb-1">إجمالي الإيرادات (سندات القبض)</div>
                  <div className="text-2xl font-black text-emerald-700 font-mono">
                    {selectedCenterForReport.totalRevenues.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs">{currencySymbol}</span>
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border ${
                  selectedCenterForReport.netIncome >= 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className="text-xs font-bold text-slate-700 mb-1">صافي النتيجة (أرباح وخسائر المركز)</div>
                  <div className={`text-2xl font-black font-mono ${
                    selectedCenterForReport.netIncome >= 0 ? 'text-indigo-700' : 'text-amber-800'
                  }`}>
                    {selectedCenterForReport.netIncome >= 0 ? '+' : ''}{selectedCenterForReport.netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs">{currencySymbol}</span>
                  </div>
                </div>
              </div>

              {/* Expense Breakdown Categories */}
              {selectedCenterForReport.expenseBreakdown.length > 0 && (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
                    <PieChart size={16} className="text-indigo-600" />
                    <span>توزيع وتحليل بنود المصروفات المحملة على المركز</span>
                  </h3>
                  <div className="flex flex-col gap-2.5">
                    {selectedCenterForReport.expenseBreakdown.map((item, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-800">{item.accountName}</span>
                          <span className="font-mono text-slate-700">
                            {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol} ({item.percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full rounded-full"
                            style={{ width: `${item.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed Transactions Table */}
              <div>
                <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
                  <FileText size={16} className="text-indigo-600" />
                  <span>سجل حركات وسندات المركز التفصيلية ({selectedCenterForReport.transactions.length})</span>
                </h3>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                      <tr>
                        <th className="p-3">التاريخ</th>
                        <th className="p-3">رقم المستند</th>
                        <th className="p-3">نوع السند / القيد</th>
                        <th className="p-3">الطرف / المستفيد</th>
                        <th className="p-3">البيان والشرح المحاسبي</th>
                        <th className="p-3 text-left">المبلغ ({currencySymbol})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {selectedCenterForReport.transactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-mono text-slate-600 whitespace-nowrap">{tx.date}</td>
                          <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">#{tx.docNumber}</td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              tx.entryType === 'EXPENSE' 
                                ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {tx.docTypeLabel}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-slate-800">{tx.partnerName || '-'}</td>
                          <td className="p-3 text-slate-600">{tx.description}</td>
                          <td className={`p-3 text-left font-mono font-black text-sm whitespace-nowrap ${
                            tx.entryType === 'EXPENSE' ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            {tx.entryType === 'EXPENSE' ? '-' : '+'}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}

                      {selectedCenterForReport.transactions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                            لا توجد سندات أو قيود مسجلة لهذا المركز خلال الفترة المحددة
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-bold print:hidden">
              <span>مركز التكلفة: {selectedCenterForReport.costCenter.name}</span>
              <button
                type="button"
                onClick={() => setSelectedCenterForReport(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-colors cursor-pointer"
              >
                إغلاق التقرير
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Add / Edit Cost Center Modal --- */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass size={18} className="text-indigo-400" />
                <h3 className="font-black text-base">
                  {editingCenter ? 'تعديل بيانات مركز التكلفة' : 'إضافة مركز تكلفة جديد'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddEditModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCenter} className="p-5 flex flex-col gap-4 text-xs font-bold text-slate-700">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-800 font-black">كود المركز <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    placeholder="مثال: CC-101"
                    className="border border-slate-300 p-2 rounded-xl font-mono text-sm focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-slate-800 font-black">نوع المركز <span className="text-red-500">*</span></label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as CostCenterType })}
                    className="border border-slate-300 p-2 rounded-xl text-sm focus:outline-none focus:border-indigo-600 bg-white"
                  >
                    <option value="PROJECT">مشروع مقاولات / توريد</option>
                    <option value="BRANCH">فرع تشغيلي</option>
                    <option value="FLEET">أسطول نقليات ولوجستيات</option>
                    <option value="DEPARTMENT">قسم / إدارة داخلية</option>
                    <option value="OTHER">مركز تكلفة عام</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-800 font-black">اسم مركز التكلفة <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: مشروع أبراج العاصمة / فرع جدة"
                  className="border border-slate-300 p-2 rounded-xl text-sm focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label>مدير / مسؤول المركز</label>
                  <input
                    type="text"
                    value={formData.manager}
                    onChange={e => setFormData({ ...formData, manager: e.target.value })}
                    placeholder="مثال: م. سلطان المنصور"
                    className="border border-slate-300 p-2 rounded-xl text-sm focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label>الميزانية التقديرية المعتمدة ({currencySymbol})</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.budget}
                    onChange={e => setFormData({ ...formData, budget: e.target.value })}
                    placeholder="0.00"
                    className="border border-slate-300 p-2 rounded-xl text-sm font-mono focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label>وصف ونطاق المركز</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف الأعمال والمصروفات الخاصة بهذا المركز..."
                  className="border border-slate-300 p-2 rounded-xl text-xs focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <input
                  type="checkbox"
                  id="statusActive"
                  checked={formData.status === 'ACTIVE'}
                  onChange={e => setFormData({ ...formData, status: e.target.checked ? 'ACTIVE' : 'INACTIVE' })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="statusActive" className="text-slate-800 font-bold cursor-pointer">
                  مركز نشط وقابل لتحميل السندات والعمليات عليه
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-xs transition-colors cursor-pointer"
                >
                  {editingCenter ? 'حفظ التعديلات' : 'إضافة المركز'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
