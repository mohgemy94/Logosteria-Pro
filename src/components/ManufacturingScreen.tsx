import { useState, useMemo, useEffect } from 'react';
import {
  Factory,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  X,
  Eye,
  Settings2,
  TrendingUp,
  Cpu,
  Package,
  Wrench,
  Sparkles,
  ClipboardList
} from 'lucide-react';
import {
  BillOfMaterials,
  ManufacturingOrder,
  WorkCenter,
  BOMMaterialItem,
  ProductionStageItem
} from '../types/manufacturing';
import {
  getStoredBOMs,
  saveStoredBOMs,
  getStoredWorkOrders,
  saveStoredWorkOrders,
  getStoredWorkCenters,
  saveStoredWorkCenters
} from '../data/mockManufacturing';
import { useSystemCurrency } from '../utils/currency';

export default function ManufacturingScreen() {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [activeTab, setActiveTab] = useState<'orders' | 'bom' | 'workCenters' | 'costAnalysis'>('orders');
  const [workOrders, setWorkOrders] = useState<ManufacturingOrder[]>(() => getStoredWorkOrders());
  const [boms, setBoms] = useState<BillOfMaterials[]>(() => getStoredBOMs());
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>(() => getStoredWorkCenters());

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedOrderForView, setSelectedOrderForView] = useState<ManufacturingOrder | null>(null);

  // Modals
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isNewBOMModalOpen, setIsNewBOMModalOpen] = useState(false);

  // Form State: New Work Order
  const [newOrder, setNewOrder] = useState({
    bomId: '',
    plannedQuantity: 10,
    workCenter: 'خط التجميع والتركيب الإلكتروني',
    supervisor: 'م. طارق العسيري',
    startDate: new Date().toISOString().slice(0, 10),
    targetEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    priority: 'HIGH' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    notes: ''
  });

  // Form State: New BOM
  const [newBOM, setNewBOM] = useState({
    name: '',
    finalProductName: '',
    targetOutputQuantity: 10,
    outputUnit: 'قطعة / وحدة',
    directLaborCost: 500,
    overheadCost: 300,
    scrapExpectedPercent: 2,
    notes: '',
    materials: [
      { id: '1', itemName: 'مادة خام رئيسية 1', unit: 'كجم', standardQuantity: 10, unitCost: 50, totalCost: 500 },
      { id: '2', itemName: 'مستلزم تجميع وتغليف', unit: 'قطعة', standardQuantity: 10, unitCost: 15, totalCost: 150 }
    ] as BOMMaterialItem[]
  });

  // Sync with localStorage updates
  useEffect(() => {
    const handleUpdate = () => {
      setWorkOrders(getStoredWorkOrders());
      setBoms(getStoredBOMs());
      setWorkCenters(getStoredWorkCenters());
    };
    window.addEventListener('alpha-work-orders-updated', handleUpdate);
    window.addEventListener('alpha-bom-updated', handleUpdate);
    window.addEventListener('alpha-work-centers-updated', handleUpdate);
    return () => {
      window.removeEventListener('alpha-work-orders-updated', handleUpdate);
      window.removeEventListener('alpha-bom-updated', handleUpdate);
      window.removeEventListener('alpha-work-centers-updated', handleUpdate);
    };
  }, []);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalOrders = workOrders.length;
    const inProgressCount = workOrders.filter(o => o.status === 'IN_PROGRESS' || o.status === 'QUALITY_CHECK').length;
    const completedCount = workOrders.filter(o => o.status === 'COMPLETED').length;
    const totalCostOfOrders = workOrders.reduce((sum, o) => sum + o.totalProductionCost, 0);
    const totalItemsProduced = workOrders.reduce((sum, o) => sum + (o.actualQuantityProduced || 0), 0);

    return {
      totalOrders,
      inProgressCount,
      completedCount,
      totalCostOfOrders,
      totalItemsProduced,
      bomsCount: boms.length,
      workCentersCount: workCenters.length
    };
  }, [workOrders, boms, workCenters]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return workOrders.filter(o => {
      const matchSearch =
        o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.finalProductName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.supervisor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.workCenter.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [workOrders, searchQuery, statusFilter]);

  // Filtered BOMs
  const filteredBOMs = useMemo(() => {
    return boms.filter(b => {
      return (
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.bomCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.finalProductName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [boms, searchQuery]);

  // Handle Create Work Order
  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedBOM = boms.find(b => b.id === newOrder.bomId) || boms[0];
    if (!selectedBOM) {
      alert('يرجى اختيار معيار تصنيع BOM صالح');
      return;
    }

    const orderNumber = `MO-${new Date().getFullYear()}-${String(workOrders.length + 1).padStart(3, '0')}`;
    const ratio = newOrder.plannedQuantity / selectedBOM.targetOutputQuantity;

    // Calculate materials required
    const consumedMaterials = selectedBOM.rawMaterials.map((mat, idx) => ({
      id: `cmat-${Date.now()}-${idx}`,
      itemId: mat.itemId,
      itemName: mat.itemName,
      unit: mat.unit,
      plannedQuantity: Math.round(mat.standardQuantity * ratio * 100) / 100,
      actualQuantity: Math.round(mat.standardQuantity * ratio * 100) / 100,
      unitCost: mat.unitCost,
      totalCost: Math.round(mat.totalCost * ratio * 100) / 100,
      variance: 0
    }));

    const labor = Math.round(selectedBOM.directLaborCost * ratio);
    const overhead = Math.round(selectedBOM.overheadCost * ratio);
    const materialsTotal = consumedMaterials.reduce((s, m) => s + m.totalCost, 0);
    const totalCost = materialsTotal + labor + overhead;
    const costPerUnit = newOrder.plannedQuantity > 0 ? Math.round((totalCost / newOrder.plannedQuantity) * 100) / 100 : 0;

    const defaultStages: ProductionStageItem[] = [
      { id: 'st-1', stageName: 'صرف المواد وتجهيز خط التشغيل', orderIndex: 1, status: 'DONE', technician: newOrder.supervisor, completedAt: newOrder.startDate },
      { id: 'st-2', stageName: 'مرحلة التصنيع والتشغيل الفعلي', orderIndex: 2, status: 'IN_PROGRESS', technician: newOrder.supervisor },
      { id: 'st-3', stageName: 'الفحص المخبري وضبط الجودة', orderIndex: 3, status: 'PENDING' },
      { id: 'st-4', stageName: 'التغليف والتوريد لمخزن البضاعة التامة', orderIndex: 4, status: 'PENDING' }
    ];

    const createdOrder: ManufacturingOrder = {
      id: 'mo-' + Date.now(),
      orderNumber,
      bomId: selectedBOM.id,
      bomCode: selectedBOM.bomCode,
      bomName: selectedBOM.name,
      finalProductId: selectedBOM.finalProductId,
      finalProductName: selectedBOM.finalProductName,
      plannedQuantity: Number(newOrder.plannedQuantity),
      actualQuantityProduced: Number(newOrder.plannedQuantity),
      defectiveQuantity: 0,
      unit: selectedBOM.outputUnit,
      workCenter: newOrder.workCenter,
      supervisor: newOrder.supervisor,
      startDate: newOrder.startDate,
      targetEndDate: newOrder.targetEndDate,
      status: 'IN_PROGRESS',
      priority: newOrder.priority,
      directLaborCost: labor,
      machineHoursCost: 150,
      overheadAllocatedCost: overhead,
      totalProductionCost: totalCost,
      actualCostPerUnit: costPerUnit,
      inventoryTransferred: false,
      materialsConsumed: consumedMaterials,
      stages: defaultStages,
      notes: newOrder.notes
    };

    const updated = [createdOrder, ...workOrders];
    saveStoredWorkOrders(updated);
    setWorkOrders(updated);
    setIsNewOrderModalOpen(false);
    alert(`تم إنشاء أمر التشغيل والإنتاج ${orderNumber} بنجاح!`);
  };

  // Handle Advance Stage / Complete Order
  const handleUpdateOrderStatus = (orderId: string, newStatus: ManufacturingOrder['status']) => {
    const updated = workOrders.map(o => {
      if (o.id !== orderId) return o;
      const isCompleted = newStatus === 'COMPLETED';
      return {
        ...o,
        status: newStatus,
        inventoryTransferred: isCompleted ? true : o.inventoryTransferred,
        actualEndDate: isCompleted ? new Date().toISOString().slice(0, 10) : o.actualEndDate,
        stages: isCompleted ? o.stages.map(s => ({ ...s, status: 'DONE' as const })) : o.stages
      };
    });

    saveStoredWorkOrders(updated);
    setWorkOrders(updated);

    if (selectedOrderForView && selectedOrderForView.id === orderId) {
      const refreshed = updated.find(o => o.id === orderId);
      if (refreshed) setSelectedOrderForView(refreshed);
    }
  };

  // Handle Add Material Row in New BOM Modal
  const handleAddBOMMaterialRow = () => {
    setNewBOM(prev => ({
      ...prev,
      materials: [
        ...prev.materials,
        {
          id: String(Date.now()),
          itemId: 'item-' + Date.now(),
          itemCode: 'RAW-' + Math.floor(100 + Math.random() * 900),
          itemName: '',
          unit: 'قطعة',
          standardQuantity: 1,
          unitCost: 10,
          totalCost: 10
        }
      ]
    }));
  };

  // Handle Save New BOM
  const handleSaveBOM = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBOM.name.trim() || !newBOM.finalProductName.trim()) {
      alert('يرجى إدخال اسم المعيار واسم المنتج التام');
      return;
    }

    const bomCode = `BOM-${new Date().getFullYear()}-${String(boms.length + 1).padStart(3, '0')}`;
    const materialsTotal = newBOM.materials.reduce((sum, m) => sum + (Number(m.standardQuantity) * Number(m.unitCost)), 0);
    const totalEst = materialsTotal + Number(newBOM.directLaborCost) + Number(newBOM.overheadCost);
    const costPerUnit = newBOM.targetOutputQuantity > 0 ? Math.round((totalEst / newBOM.targetOutputQuantity) * 100) / 100 : 0;

    const formattedMaterials = newBOM.materials.map(m => ({
      ...m,
      itemId: m.itemId || 'itm-' + Math.random(),
      itemCode: m.itemCode || 'RAW-00',
      standardQuantity: Number(m.standardQuantity),
      unitCost: Number(m.unitCost),
      totalCost: Number(m.standardQuantity) * Number(m.unitCost)
    }));

    const createdBOM: BillOfMaterials = {
      id: 'bom-' + Date.now(),
      bomCode,
      name: newBOM.name,
      finalProductId: 'prod-' + Date.now(),
      finalProductName: newBOM.finalProductName,
      targetOutputQuantity: Number(newBOM.targetOutputQuantity),
      outputUnit: newBOM.outputUnit,
      version: '1.0',
      isActive: true,
      directLaborCost: Number(newBOM.directLaborCost),
      overheadCost: Number(newBOM.overheadCost),
      scrapExpectedPercent: Number(newBOM.scrapExpectedPercent),
      rawMaterials: formattedMaterials,
      totalEstimatedCost: totalEst,
      costPerUnit,
      notes: newBOM.notes
    };

    const updated = [createdBOM, ...boms];
    saveStoredBOMs(updated);
    setBoms(updated);
    setIsNewBOMModalOpen(false);
    alert(`تم حفظ معيار التصنيع ${bomCode} بنجاح!`);
  };

  return (
    <div className="flex flex-col flex-1 space-y-5" dir="rtl">
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">نظام إدارة الإنتاج والتكاليف الصناعية</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2.5">
            <Factory className="text-blue-600" size={28} />
            إدارة التصنيع وأوامر التشغيل وتكاليف الإنتاج
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            قوائم مواد التكاليف (BOM)، أوامر الإنتاج والتشغيل، تكاليف الخامات والأجور، ومراقبة الجودة والتوريد للمخازن.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (boms.length > 0 && boms[0]) {
                setNewOrder(prev => ({ ...prev, bomId: boms[0]?.id || '' }));
              }
              setIsNewOrderModalOpen(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={16} />
            <span>إنشاء أمر تشغيل (MO) جديد</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewBOMModalOpen(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Settings2 size={16} />
            <span>إضافة معيار تصنيع (BOM)</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:hidden">
        {/* Total Cost of Orders */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">إجمالي تكاليف التشغيل</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900">
              {metrics.totalCostOfOrders.toLocaleString()} <span className="text-xs text-slate-500 font-normal">{currencySymbol}</span>
            </div>
            <div className="text-[11px] text-blue-600 font-medium mt-1">
              عبر {metrics.totalOrders} أوامر تشغيل صناعية
            </div>
          </div>
        </div>

        {/* Active Work Orders */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">أوامر تشغيل قيد الإنتاج</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-amber-600">
              {metrics.inProgressCount} <span className="text-xs text-slate-500 font-normal">أمر جاري</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              جاهز ومكتمل: {metrics.completedCount} أوامر
            </div>
          </div>
        </div>

        {/* Total Quantity Produced */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">إجمالي المنتجات التامة</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Package size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-600">
              {metrics.totalItemsProduced.toLocaleString()} <span className="text-xs text-slate-500 font-normal">قطعة / وحدة</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              جاهزة للتوريد والبيع في المخزن
            </div>
          </div>
        </div>

        {/* BOM & Work Centers Count */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">المعايير وخطوط الإنتاج</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Cpu size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-purple-700">
              {metrics.bomsCount} <span className="text-xs text-slate-500 font-normal">معايير (BOM)</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              يعمل على {metrics.workCentersCount} خطوط إنتاج
            </div>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="bg-white rounded-2xl border border-slate-200 p-1.5 shadow-xs flex items-center gap-1 overflow-x-auto print:hidden">
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'orders'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ClipboardList size={16} />
          <span>أوامر التشغيل والإنتاج ({workOrders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bom')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'bom'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Settings2 size={16} />
          <span>قوائم مواد التكاليف - BOM ({boms.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('workCenters')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'workCenters'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Wrench size={16} />
          <span>خطوط الإنتاج ومراكز العمل ({workCenters.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('costAnalysis')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'costAnalysis'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Sparkles size={16} />
          <span>تحليل هيكل تكاليف التصنيع</span>
        </button>
      </div>

      {/* TAB 1: WORK ORDERS LIST */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Filter Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث برقم أمر التشغيل، المنتج التام، المشرف، أو خط الإنتاج..."
                className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">جميع الحالات</option>
                <option value="IN_PROGRESS">قيد التشغيل والإنتاج</option>
                <option value="QUALITY_CHECK">فحص وضبط الجودة</option>
                <option value="COMPLETED">مكتمل ومورد للمخزن</option>
                <option value="DRAFT">مسودة / تجهيز</option>
              </select>
            </div>
          </div>

          {/* Orders Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3.5 px-4">رقم الأمر</th>
                  <th className="py-3.5 px-4">المنتج التام المراد تصنيعه</th>
                  <th className="py-3.5 px-4">الكمية المستهدفة</th>
                  <th className="py-3.5 px-4">خط الإنتاج والمشرف</th>
                  <th className="py-3.5 px-4">التاريخ المستهدف</th>
                  <th className="py-3.5 px-4">إجمالي التكلفة</th>
                  <th className="py-3.5 px-4">تكلفة الوحدة</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      لا توجد أوامر تشغيل مطابقة للبحث
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {order.orderNumber}
                        <div className="text-[10px] text-slate-400 font-normal">بدء: {order.startDate}</div>
                      </td>
                      <td className="py-3.5 px-4 max-w-[220px]">
                        <div className="font-semibold text-slate-900 truncate" title={order.finalProductName}>
                          {order.finalProductName}
                        </div>
                        <div className="text-[11px] text-blue-600 font-mono">{order.bomName}</div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {order.plannedQuantity} {order.unit}
                        {order.actualQuantityProduced > 0 && order.status === 'COMPLETED' && (
                          <div className="text-[10px] text-emerald-600">منجز: {order.actualQuantityProduced}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-medium">{order.workCenter}</div>
                        <div className="text-[11px] text-slate-400">{order.supervisor}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {order.targetEndDate}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {order.totalProductionCost.toLocaleString()} {currencySymbol}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-emerald-700">
                        {order.actualCostPerUnit.toLocaleString()} {currencySymbol}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            order.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : order.status === 'IN_PROGRESS'
                              ? 'bg-blue-100 text-blue-800'
                              : order.status === 'QUALITY_CHECK'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {order.status === 'COMPLETED'
                            ? 'مكتمل ومورد للمخزن'
                            : order.status === 'IN_PROGRESS'
                            ? 'قيد الإنتاج والتشغيل'
                            : order.status === 'QUALITY_CHECK'
                            ? 'فحص وضبط الجودة'
                            : 'مسودة'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderForView(order)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="عرض تفاصيل أمر التشغيل وتكاليف الخامات"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrderForView(order);
                              setTimeout(() => window.print(), 200);
                            }}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="طباعة أمر التشغيل وبطاقة المتابعة"
                          >
                            <Printer size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: BILL OF MATERIALS (BOM) */}
      {activeTab === 'bom' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث باسم المعيار أو المنتج التام..."
                className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setIsNewBOMModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              <Plus size={15} />
              <span>إضافة معيار جديد</span>
            </button>
          </div>

          {/* BOM Cards Grid */}
          <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBOMs.map(bom => (
              <div key={bom.id} className="border border-slate-200 rounded-2xl p-5 hover:border-blue-300 transition-all bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
                      {bom.bomCode} (إصدار {bom.version})
                    </span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      نشط ومعتمد
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mb-1">{bom.name}</h4>
                  <p className="text-xs text-slate-600 mb-3">{bom.finalProductName}</p>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 grid grid-cols-3 gap-2 text-center text-xs mb-3">
                    <div>
                      <span className="text-slate-400 text-[10px]">الدفعة المعيارية</span>
                      <div className="font-bold text-slate-800 mt-0.5">{bom.targetOutputQuantity} {bom.outputUnit}</div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">التكلفة الإجمالية</span>
                      <div className="font-bold text-blue-700 mt-0.5">{bom.totalEstimatedCost.toLocaleString()} {currencySymbol}</div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">تكلفة الوحدة</span>
                      <div className="font-bold text-emerald-700 mt-0.5">{bom.costPerUnit.toLocaleString()} {currencySymbol}</div>
                    </div>
                  </div>

                  {/* Raw materials snippet */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-slate-700 mb-1">الخامات ومستلزمات الإنتاج ({bom.rawMaterials.length} عناصر):</div>
                    {bom.rawMaterials.slice(0, 3).map(m => (
                      <div key={m.id} className="flex justify-between text-xs text-slate-600 py-0.5 border-b border-slate-100">
                        <span>• {m.itemName}</span>
                        <span className="font-mono text-slate-500">{m.standardQuantity} {m.unit} ({m.totalCost.toLocaleString()} {currencySymbol})</span>
                      </div>
                    ))}
                    {bom.rawMaterials.length > 3 && (
                      <div className="text-[10px] text-slate-400 pt-1">+ {bom.rawMaterials.length - 3} خامات إضافية أخرى...</div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500">
                    أجور: {bom.directLaborCost} {currencySymbol} | مصاريف: {bom.overheadCost} {currencySymbol}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewOrder(prev => ({ ...prev, bomId: bom.id, plannedQuantity: bom.targetOutputQuantity }));
                      setIsNewOrderModalOpen(true);
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                  >
                    <span>إصدار أمر تشغيل ←</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: WORK CENTERS */}
      {activeTab === 'workCenters' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">خطوط الإنتاج ومراكز العمل (Work Centers)</h3>
              <p className="text-xs text-slate-500">توزيع المهام، الطاقة التشغيلية بالساعة، وتكاليف التشغيل الثابتة والمتغيرة.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const name = prompt('أدخل اسم خط الإنتاج / مركز العمل:');
                if (name) {
                  const newWc: WorkCenter = {
                    id: 'wc-' + Date.now(),
                    code: `WC-0${workCenters.length + 1}`,
                    name,
                    capacityPerHour: 25,
                    costPerHour: 50,
                    supervisor: 'مشرف تشغيل',
                    status: 'ACTIVE'
                  };
                  const updated = [...workCenters, newWc];
                  saveStoredWorkCenters(updated);
                  setWorkCenters(updated);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold cursor-pointer"
            >
              <Plus size={15} />
              <span>إضافة مركز عمل جديد</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {workCenters.map(wc => (
              <div key={wc.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-800">{wc.code}</span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">جاهز للعمل</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">{wc.name}</h4>
                <div className="text-xs text-slate-600 space-y-1">
                  <div>المشرف المسؤول: <strong className="text-slate-800">{wc.supervisor}</strong></div>
                  <div>الطاقة الإنتاجية: <strong className="text-slate-800">{wc.capacityPerHour} وحدة / ساعة</strong></div>
                  <div>تكلفة التشغيل: <strong className="text-slate-800">{wc.costPerHour} {currencySymbol} / ساعة</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: COST STRUCTURE ANALYSIS */}
      {activeTab === 'costAnalysis' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="text-blue-600" size={20} />
              تحليل وتوزيع تكاليف الإنتاج
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              توزيع ثلاثي الأبعاد للتكاليف الصناعية: الخامات المباشرة (Direct Materials)، أجور العمالة وساعات التشغيل (Direct Labor)، والمصاريف الصناعية غير المباشرة (Overheads).
            </p>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
              <div className="font-bold text-slate-800">مكونات التكلفة القياسية في النظام:</div>
              <div className="flex items-center gap-2 text-slate-700">
                <span className="w-3 h-3 rounded-full bg-blue-600" />
                <span>الخامات المباشرة: <strong>75% - 85%</strong> من إجمالي التكلفة</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <span className="w-3 h-3 rounded-full bg-emerald-600" />
                <span>أجور العمالة وساعات العمل: <strong>10% - 15%</strong></span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <span className="w-3 h-3 rounded-full bg-purple-600" />
                <span>المصاريف الصناعية غير المباشرة: <strong>5% - 10%</strong></span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
            <h4 className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-2">
              سجل كفاءة التكلفة لأوامر الإنتاج المنفذة
            </h4>

            <div className="space-y-3">
              {workOrders.map(o => (
                <div key={o.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-bold text-slate-900 text-xs sm:text-sm">
                      {o.orderNumber}: {o.finalProductName}
                    </div>
                    <span className="font-bold text-blue-700 text-xs sm:text-sm">
                      {o.totalProductionCost.toLocaleString()} {currencySymbol}
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                    <div className="bg-blue-600 h-full" style={{ width: '75%' }} title="تكلفة الخامات" />
                    <div className="bg-emerald-500 h-full" style={{ width: '15%' }} title="تكلفة الأجور" />
                    <div className="bg-purple-500 h-full" style={{ width: '10%' }} title="المصاريف الإضافية" />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-500 mt-2">
                    <span>الكمية: {o.plannedQuantity} {o.unit}</span>
                    <span>تكلفة القطعة الواحدة: <strong className="text-emerald-700">{o.actualCostPerUnit.toLocaleString()} {currencySymbol}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE NEW WORK ORDER */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-auto text-right">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Factory className="text-blue-600" size={20} />
                إنشاء أمر تصنيع وتشغيل (Manufacturing Order)
              </h3>
              <button
                type="button"
                onClick={() => setIsNewOrderModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">اختر معيار التصنيع (BOM) *</label>
                <select
                  required
                  value={newOrder.bomId}
                  onChange={e => setNewOrder({ ...newOrder, bomId: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  {boms.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.bomCode} - {b.name} ({b.finalProductName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">الكمية المستهدفة للإنتاج *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newOrder.plannedQuantity}
                    onChange={e => setNewOrder({ ...newOrder, plannedQuantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">درجة الأولوية</label>
                  <select
                    value={newOrder.priority}
                    onChange={e => setNewOrder({ ...newOrder, priority: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  >
                    <option value="LOW">منخفضة</option>
                    <option value="MEDIUM">عادية</option>
                    <option value="HIGH">مرتفعة</option>
                    <option value="URGENT">عاجلة وفورية</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">خط الإنتاج / ورشة التشغيل</label>
                  <select
                    value={newOrder.workCenter}
                    onChange={e => setNewOrder({ ...newOrder, workCenter: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  >
                    {workCenters.map(wc => (
                      <option key={wc.id} value={wc.name}>
                        {wc.name} ({wc.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">المشرف المسؤول على التشغيل</label>
                  <input
                    type="text"
                    value={newOrder.supervisor}
                    onChange={e => setNewOrder({ ...newOrder, supervisor: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">تاريخ البدء</label>
                  <input
                    type="date"
                    value={newOrder.startDate}
                    onChange={e => setNewOrder({ ...newOrder, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">تاريخ التسليم المستهدف</label>
                  <input
                    type="date"
                    value={newOrder.targetEndDate}
                    onChange={e => setNewOrder({ ...newOrder, targetEndDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">ملاحظات وتعليمات التشغيل</label>
                <textarea
                  rows={2}
                  value={newOrder.notes}
                  onChange={e => setNewOrder({ ...newOrder, notes: e.target.value })}
                  placeholder="تعليمات الجودة، أو معايير الفحص"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewOrderModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors"
                >
                  إصدار أمر التشغيل وحجز الخامات ←
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD NEW BOM */}
      {isNewBOMModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-auto text-right">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Settings2 className="text-blue-600" size={20} />
                إضافة معيار تصنيع وقائمة مواد تكاليف (BOM)
              </h3>
              <button
                type="button"
                onClick={() => setIsNewBOMModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBOM} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">اسم المعيار / التركيبة *</label>
                  <input
                    type="text"
                    required
                    value={newBOM.name}
                    onChange={e => setNewBOM({ ...newBOM, name: e.target.value })}
                    placeholder="مثال: معيار تصنيع طاولة خشبية فاخرة"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">اسم المنتج النهائي التام *</label>
                  <input
                    type="text"
                    required
                    value={newBOM.finalProductName}
                    onChange={e => setNewBOM({ ...newBOM, finalProductName: e.target.value })}
                    placeholder="اسم الصنف التام كما يظهر في الفاتورة"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">الكمية الناتجة</label>
                  <input
                    type="number"
                    value={newBOM.targetOutputQuantity}
                    onChange={e => setNewBOM({ ...newBOM, targetOutputQuantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">وحدة القياس</label>
                  <input
                    type="text"
                    value={newBOM.outputUnit}
                    onChange={e => setNewBOM({ ...newBOM, outputUnit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">أجور عمالة ({currencySymbol})</label>
                  <input
                    type="number"
                    value={newBOM.directLaborCost}
                    onChange={e => setNewBOM({ ...newBOM, directLaborCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">مصاريف غير مباشرة</label>
                  <input
                    type="number"
                    value={newBOM.overheadCost}
                    onChange={e => setNewBOM({ ...newBOM, overheadCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none"
                  />
                </div>
              </div>

              {/* Raw Materials Table */}
              <div className="space-y-2 border border-slate-200 p-3 rounded-2xl bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">قائمة الخامات ومستلزمات الإنتاج:</span>
                  <button
                    type="button"
                    onClick={handleAddBOMMaterialRow}
                    className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    <Plus size={14} /> إضافة خامة جديدة
                  </button>
                </div>

                <div className="space-y-2">
                  {newBOM.materials.map((mat, idx) => (
                    <div key={mat.id} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-xl border border-slate-200">
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={mat.itemName}
                          onChange={e => {
                            setNewBOM(prev => ({
                              ...prev,
                              materials: prev.materials.map((m, i) => i === idx ? { ...m, itemName: e.target.value } : m)
                            }));
                          }}
                          placeholder="اسم الخامة / المستلزم"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={mat.unit}
                          onChange={e => {
                            setNewBOM(prev => ({
                              ...prev,
                              materials: prev.materials.map((m, i) => i === idx ? { ...m, unit: e.target.value } : m)
                            }));
                          }}
                          placeholder="الوحدة"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={mat.standardQuantity}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setNewBOM(prev => ({
                              ...prev,
                              materials: prev.materials.map((m, i) => i === idx ? { ...m, standardQuantity: val, totalCost: val * m.unitCost } : m)
                            }));
                          }}
                          placeholder="الكمية"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={mat.unitCost}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setNewBOM(prev => ({
                              ...prev,
                              materials: prev.materials.map((m, i) => i === idx ? { ...m, unitCost: val, totalCost: m.standardQuantity * val } : m)
                            }));
                          }}
                          placeholder="تكلفة الوحدة"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (newBOM.materials.length > 1) {
                              setNewBOM(prev => ({ ...prev, materials: prev.materials.filter((_, i) => i !== idx) }));
                            }
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewBOMModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors"
                >
                  حفظ معيار التصنيع ←
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW SINGLE WORK ORDER DETAIL & PRINT */}
      {selectedOrderForView && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-auto text-right">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200 print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Factory size={20} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                    بطاقة أمر تشغيل وإنتاج رقم: {selectedOrderForView.orderNumber}
                  </h3>
                  <div className="text-xs text-slate-500">
                    خط الإنتاج: {selectedOrderForView.workCenter} | المشرف: {selectedOrderForView.supervisor}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedOrderForView.status !== 'COMPLETED' && (
                  <button
                    type="button"
                    onClick={() => handleUpdateOrderStatus(selectedOrderForView.id, 'COMPLETED')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <CheckCircle2 size={16} />
                    <span>إتمام الإنتاج والتوريد للمخزن</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Printer size={15} />
                  <span>طباعة بطاقة التشغيل</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrderForView(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Work Order Content Sheet */}
            <div className="space-y-6 text-xs sm:text-sm">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <span className="text-slate-400 text-[11px]">المنتج التام المصنع:</span>
                  <div className="font-bold text-slate-900 mt-1">{selectedOrderForView.finalProductName}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">الكمية المطلوبة:</span>
                  <div className="font-bold text-blue-700 mt-1">{selectedOrderForView.plannedQuantity} {selectedOrderForView.unit}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">إجمالي تكلفة الأمر:</span>
                  <div className="font-bold text-emerald-700 mt-1">{selectedOrderForView.totalProductionCost.toLocaleString()} {currencySymbol}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">التكلفة الفعلية للقطعة:</span>
                  <div className="font-bold text-slate-900 mt-1">{selectedOrderForView.actualCostPerUnit.toLocaleString()} {currencySymbol}</div>
                </div>
              </div>

              {/* Consumed Materials Table */}
              <div>
                <h5 className="font-bold text-slate-900 mb-2">إذن صرف وتكاليف المواد الخام والمدخلات:</h5>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="py-2.5 px-3">الخامة / الصنف</th>
                        <th className="py-2.5 px-3">الوحدة</th>
                        <th className="py-2.5 px-3">الكمية المخططة</th>
                        <th className="py-2.5 px-3">الكمية المصروفة فعلياً</th>
                        <th className="py-2.5 px-3">تكلفة الوحدة</th>
                        <th className="py-2.5 px-3">إجمالي التكلفة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrderForView.materialsConsumed.map(mat => (
                        <tr key={mat.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{mat.itemName}</td>
                          <td className="py-2.5 px-3 text-slate-500">{mat.unit}</td>
                          <td className="py-2.5 px-3 font-mono">{mat.plannedQuantity}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{mat.actualQuantity}</td>
                          <td className="py-2.5 px-3 font-mono">{mat.unitCost} {currencySymbol}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{mat.totalCost.toLocaleString()} {currencySymbol}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Stages Checklist */}
              <div>
                <h5 className="font-bold text-slate-900 mb-2">مراحل خط الإنتاج والفحص:</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedOrderForView.stages.map(st => (
                    <div key={st.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          st.status === 'DONE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {st.orderIndex}
                        </div>
                        <span className="font-semibold text-slate-800 text-xs">{st.stageName}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        st.status === 'DONE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {st.status === 'DONE' ? 'مكتمل' : 'قيد التنفيذ'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-200 text-center">
                <div>
                  <div className="text-xs font-bold text-slate-700">توقيع مسؤول التخطيط والتشغيل</div>
                  <div className="h-12 flex items-end justify-center text-slate-300 text-xs">.........................</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-700">توقيع مشرف ضبط الجودة (QC)</div>
                  <div className="h-12 flex items-end justify-center text-slate-300 text-xs">.........................</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-700">توقيع أمين مستودع البضاعة التامة</div>
                  <div className="h-12 flex items-end justify-center text-slate-300 text-xs">.........................</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
