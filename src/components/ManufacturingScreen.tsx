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
  ClipboardList,
  Copy,
  Edit,
  Trash2,
  CheckSquare,
  BookOpen
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
  saveStoredWorkCenters,
  deductRawMaterialsForOrder,
  addFinishedGoodsForOrder,
  restoreRawMaterialsForOrder,
  createConsumptionJournalEntry,
  createCompletionJournalEntry
} from '../utils/manufacturingStore';
import ExportButtonGroup from './ExportButtonGroup';
import { loadStoredItems, Item } from '../utils/itemsStore';
import { loadJournalEntries } from '../utils/trialBalanceStore';
import { useSystemCurrency } from '../utils/currency';

export default function ManufacturingScreen() {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [activeTab, setActiveTab] = useState<'orders' | 'bom' | 'workCenters' | 'costAnalysis' | 'accounting'>('orders');
  const [workOrders, setWorkOrders] = useState<ManufacturingOrder[]>(() => getStoredWorkOrders());
  const [boms, setBoms] = useState<BillOfMaterials[]>(() => getStoredBOMs());
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>(() => getStoredWorkCenters());
  const [inventoryItems, setInventoryItems] = useState<Item[]>(() => loadStoredItems());

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedOrderForView, setSelectedOrderForView] = useState<ManufacturingOrder | null>(null);

  // Modals
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isBOMModalOpen, setIsBOMModalOpen] = useState(false);
  const [editingBOMId, setEditingBOMId] = useState<string | null>(null);
  const [isCompleteOrderModalOpen, setIsCompleteOrderModalOpen] = useState(false);
  const [orderToComplete, setOrderToComplete] = useState<ManufacturingOrder | null>(null);
  const [isWorkCenterModalOpen, setIsWorkCenterModalOpen] = useState(false);
  const [editingWorkCenter, setEditingWorkCenter] = useState<WorkCenter | null>(null);

  // Form State: Complete Order Inputs
  const [completeForm, setCompleteForm] = useState({
    actualQuantityProduced: 0,
    defectiveQuantity: 0,
    scrapCost: 0,
    targetWarehouse: 'المستودع الرئيسي - الرياض',
    notes: ''
  });

  // Form State: Work Center Input
  const [workCenterForm, setWorkCenterForm] = useState({
    code: '',
    name: '',
    capacityPerHour: 25,
    costPerHour: 50,
    supervisor: 'مشرف خط الإنتاج',
    status: 'ACTIVE' as WorkCenter['status']
  });

  // Form State: New Work Order
  const [newOrder, setNewOrder] = useState({
    bomId: '',
    plannedQuantity: 10,
    workCenter: 'خط التجميع والتركيب الإلكتروني',
    supervisor: 'م. طارق العسيري',
    startDate: new Date().toISOString().slice(0, 10),
    targetEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    priority: 'HIGH' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    sourceWarehouse: 'المستودع الرئيسي - الرياض',
    targetWarehouse: 'مستودع معرض المبيعات',
    autoDeductMaterials: true,
    notes: ''
  });

  // Form State: BOM (Create or Edit)
  const [bomForm, setBOMForm] = useState({
    name: '',
    finalProductName: '',
    finalProductId: '',
    targetOutputQuantity: 10,
    outputUnit: 'قطعة / وحدة',
    directLaborCost: 500,
    overheadCost: 300,
    scrapExpectedPercent: 2,
    sourceWarehouse: 'المستودع الرئيسي - الرياض',
    targetWarehouse: 'المستودع الرئيسي - الرياض',
    version: '1.0',
    isActive: true,
    notes: '',
    materials: [
      { id: '1', itemId: '', itemCode: '', itemName: 'مادة خام رئيسية', unit: 'كجم', standardQuantity: 10, unitCost: 50, totalCost: 500 }
    ] as BOMMaterialItem[]
  });

  // Sync with localStorage & app events
  useEffect(() => {
    const handleUpdate = () => {
      setWorkOrders(getStoredWorkOrders());
      setBoms(getStoredBOMs());
      setWorkCenters(getStoredWorkCenters());
      setInventoryItems(loadStoredItems());
    };
    window.addEventListener('alpha-work-orders-updated', handleUpdate);
    window.addEventListener('alpha-bom-updated', handleUpdate);
    window.addEventListener('alpha-work-centers-updated', handleUpdate);
    window.addEventListener('alpha-items-updated', handleUpdate);
    window.addEventListener('alpha-journal-entries-updated', handleUpdate);
    window.addEventListener('alpha-system-reset-completed', handleUpdate);
    window.addEventListener('alpha-data-changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('alpha-work-orders-updated', handleUpdate);
      window.removeEventListener('alpha-bom-updated', handleUpdate);
      window.removeEventListener('alpha-work-centers-updated', handleUpdate);
      window.removeEventListener('alpha-items-updated', handleUpdate);
      window.removeEventListener('alpha-journal-entries-updated', handleUpdate);
      window.removeEventListener('alpha-system-reset-completed', handleUpdate);
      window.removeEventListener('alpha-data-changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalOrders = workOrders.length;
    const inProgressCount = workOrders.filter(o => o.status === 'IN_PROGRESS' || o.status === 'QUALITY_CHECK').length;
    const completedCount = workOrders.filter(o => o.status === 'COMPLETED').length;
    const totalCostOfOrders = workOrders.reduce((sum, o) => sum + (Number(o.totalProductionCost) || 0), 0);
    const totalItemsProduced = workOrders.reduce((sum, o) => sum + (Number(o.actualQuantityProduced) || 0), 0);
    const totalScrapQty = workOrders.reduce((sum, o) => sum + (Number(o.defectiveQuantity) || 0), 0);

    return {
      totalOrders,
      inProgressCount,
      completedCount,
      totalCostOfOrders,
      totalItemsProduced,
      totalScrapQty,
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

  // Manufacturing Related Journal Entries
  const manufacturingJournals = useMemo(() => {
    const allEntries = loadJournalEntries();
    return allEntries.filter(
      e =>
        e.entryNumber.includes('MFG') ||
        e.reference?.startsWith('MO-') ||
        e.description?.includes('أمر الإنتاج') ||
        e.description?.includes('أمر التشغيل') ||
        e.items.some(it => it.accountId === 'acc-1302' || it.accountId === 'acc-1303' || it.accountId === 'acc-5108')
    );
  }, [workOrders]);

  // Handle Save / Create New Work Order
  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedBOM = boms.find(b => b.id === newOrder.bomId) || boms[0];
    if (!selectedBOM) {
      alert('يرجى اختيار معيار تصنيع BOM صالح');
      return;
    }

    const orderNumber = `MO-${new Date().getFullYear()}-${String(workOrders.length + 1).padStart(3, '0')}`;
    const ratio = newOrder.plannedQuantity / (selectedBOM.targetOutputQuantity || 1);

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
      { id: 'st-3', stageName: 'الفحص المخبري وضبط الجودة (QC)', orderIndex: 3, status: 'PENDING' },
      { id: 'st-4', stageName: 'التغليف والتوريد لمخزن البضاعة التامة', orderIndex: 4, status: 'PENDING' }
    ];

    let createdOrder: ManufacturingOrder = {
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
      materialsDeducted: false,
      finishedGoodsAdded: false,
      sourceWarehouse: newOrder.sourceWarehouse || selectedBOM.sourceWarehouse || 'المستودع الرئيسي - الرياض',
      targetWarehouse: newOrder.targetWarehouse || selectedBOM.targetWarehouse || 'مستودع معرض المبيعات',
      materialsConsumed: consumedMaterials,
      stages: defaultStages,
      notes: newOrder.notes
    };

    // Auto Deduct raw materials and generate consumption journal if enabled
    if (newOrder.autoDeductMaterials) {
      deductRawMaterialsForOrder(createdOrder);
      createdOrder.materialsDeducted = true;
      const jvId = createConsumptionJournalEntry(createdOrder);
      if (jvId) createdOrder.consumptionJournalEntryId = jvId;
    }

    const updated = [createdOrder, ...workOrders];
    saveStoredWorkOrders(updated);
    setWorkOrders(updated);
    setIsNewOrderModalOpen(false);
    alert(`تم إنشاء أمر التشغيل والإنتاج ${orderNumber} بنجاح ومزامنة حركة الخامات والقيود المحاسبية!`);
  };

  // Open Complete Order Modal
  const handleOpenCompleteModal = (order: ManufacturingOrder) => {
    setOrderToComplete(order);
    setCompleteForm({
      actualQuantityProduced: order.actualQuantityProduced || order.plannedQuantity,
      defectiveQuantity: order.defectiveQuantity || 0,
      scrapCost: order.scrapCost || 0,
      targetWarehouse: order.targetWarehouse || 'المستودع الرئيسي - الرياض',
      notes: order.notes || ''
    });
    setIsCompleteOrderModalOpen(true);
  };

  // Execute Complete Order Action
  const handleConfirmCompleteOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderToComplete) return;

    const actualQty = Number(completeForm.actualQuantityProduced);
    const defQty = Number(completeForm.defectiveQuantity);
    const scrapVal = Number(completeForm.scrapCost);

    // Calculate actual cost per unit produced
    const netCost = orderToComplete.totalProductionCost;
    const actualUnitCost = actualQty > 0 ? Math.round(((netCost - scrapVal) / actualQty) * 100) / 100 : 0;

    let updatedOrder: ManufacturingOrder = {
      ...orderToComplete,
      status: 'COMPLETED',
      actualQuantityProduced: actualQty,
      defectiveQuantity: defQty,
      scrapCost: scrapVal,
      targetWarehouse: completeForm.targetWarehouse,
      actualCostPerUnit: actualUnitCost,
      actualEndDate: new Date().toISOString().slice(0, 10),
      inventoryTransferred: true,
      stages: orderToComplete.stages.map(s => ({ ...s, status: 'DONE' as const }))
    };

    // 1. Ensure raw materials are deducted
    if (!updatedOrder.materialsDeducted) {
      deductRawMaterialsForOrder(updatedOrder);
      updatedOrder.materialsDeducted = true;
      const jvConsumptionId = createConsumptionJournalEntry(updatedOrder);
      if (jvConsumptionId) updatedOrder.consumptionJournalEntryId = jvConsumptionId;
    }

    // 2. Add finished goods to inventory
    if (!updatedOrder.finishedGoodsAdded) {
      addFinishedGoodsForOrder(updatedOrder);
      updatedOrder.finishedGoodsAdded = true;
    }

    // 3. Generate Finished Goods & Overheads Completion Journal Entry
    const jvCompletionId = createCompletionJournalEntry(updatedOrder);
    if (jvCompletionId) {
      updatedOrder.completionJournalEntryId = jvCompletionId;
    }

    const updated = workOrders.map(o => (o.id === updatedOrder.id ? updatedOrder : o));
    saveStoredWorkOrders(updated);
    setWorkOrders(updated);
    setIsCompleteOrderModalOpen(false);

    if (selectedOrderForView && selectedOrderForView.id === updatedOrder.id) {
      setSelectedOrderForView(updatedOrder);
    }

    alert(`تم إتمام أمر الإنتاج ${updatedOrder.orderNumber} بنجاح! تم توريد ${actualQty} ${updatedOrder.unit} لمخزن البضاعة التامة وتوليد القيد المحاسبي الختامي.`);
  };

  // Delete Order
  const handleDeleteOrder = (orderId: string) => {
    const target = workOrders.find(o => o.id === orderId);
    if (!target) return;
    if (confirm(`هل أنت متأكد من حذف أمر التشغيل ${target.orderNumber}؟ سيتم استرجاع الخامات للمخزن في حال تم خصمها.`)) {
      if (target.materialsDeducted && target.status !== 'COMPLETED') {
        restoreRawMaterialsForOrder(target);
      }
      const updated = workOrders.filter(o => o.id !== orderId);
      saveStoredWorkOrders(updated);
      setWorkOrders(updated);
      if (selectedOrderForView?.id === orderId) setSelectedOrderForView(null);
    }
  };

  // Open New BOM Modal
  const handleOpenNewBOMModal = () => {
    setEditingBOMId(null);
    setBOMForm({
      name: '',
      finalProductName: '',
      finalProductId: '',
      targetOutputQuantity: 10,
      outputUnit: 'قطعة / وحدة',
      directLaborCost: 500,
      overheadCost: 300,
      scrapExpectedPercent: 2,
      sourceWarehouse: 'المستودع الرئيسي - الرياض',
      targetWarehouse: 'المستودع الرئيسي - الرياض',
      version: '1.0',
      isActive: true,
      notes: '',
      materials: [
        { id: '1', itemId: '', itemCode: '', itemName: '', unit: 'قطعة', standardQuantity: 1, unitCost: 10, totalCost: 10 }
      ]
    });
    setIsBOMModalOpen(true);
  };

  // Open Edit BOM Modal
  const handleOpenEditBOMModal = (bom: BillOfMaterials) => {
    setEditingBOMId(bom.id);
    setBOMForm({
      name: bom.name,
      finalProductName: bom.finalProductName,
      finalProductId: bom.finalProductId,
      targetOutputQuantity: bom.targetOutputQuantity,
      outputUnit: bom.outputUnit,
      directLaborCost: bom.directLaborCost,
      overheadCost: bom.overheadCost,
      scrapExpectedPercent: bom.scrapExpectedPercent,
      sourceWarehouse: bom.sourceWarehouse || 'المستودع الرئيسي - الرياض',
      targetWarehouse: bom.targetWarehouse || 'المستودع الرئيسي - الرياض',
      version: bom.version,
      isActive: bom.isActive,
      notes: bom.notes || '',
      materials: bom.rawMaterials.map(m => ({ ...m }))
    });
    setIsBOMModalOpen(true);
  };

  // Duplicate BOM
  const handleDuplicateBOM = (bom: BillOfMaterials) => {
    const nextVer = (parseFloat(bom.version || '1.0') + 0.1).toFixed(1);
    const newBom: BillOfMaterials = {
      ...bom,
      id: 'bom-' + Date.now(),
      bomCode: `BOM-${new Date().getFullYear()}-${String(boms.length + 1).padStart(3, '0')}`,
      name: `${bom.name} (نسخة جديدة)`,
      version: nextVer,
      rawMaterials: bom.rawMaterials.map(m => ({ ...m, id: 'mat-' + Math.random() }))
    };
    const updated = [newBom, ...boms];
    saveStoredBOMs(updated);
    setBoms(updated);
    alert(`تم استنساخ المعيار بنجاح باسم "${newBom.name}" ورقم إصدار ${nextVer}`);
  };

  // Toggle BOM Active State
  const handleToggleBOMActive = (bomId: string) => {
    const updated = boms.map(b => (b.id === bomId ? { ...b, isActive: !b.isActive } : b));
    saveStoredBOMs(updated);
    setBoms(updated);
  };

  // Delete BOM
  const handleDeleteBOM = (bomId: string) => {
    const target = boms.find(b => b.id === bomId);
    if (!target) return;
    if (confirm(`هل أنت متأكد من حذف معيار التصنيع "${target.name}"؟`)) {
      const updated = boms.filter(b => b.id !== bomId);
      saveStoredBOMs(updated);
      setBoms(updated);
    }
  };

  // Handle Add Material Row in BOM Modal
  const handleAddBOMMaterialRow = () => {
    setBOMForm(prev => ({
      ...prev,
      materials: [
        ...prev.materials,
        {
          id: String(Date.now()),
          itemId: '',
          itemCode: '',
          itemName: '',
          unit: 'قطعة',
          standardQuantity: 1,
          unitCost: 10,
          totalCost: 10
        }
      ]
    }));
  };

  // On Select Inventory Item in BOM Material Row
  const handleSelectInventoryItemForBOM = (idx: number, itemId: string) => {
    const selectedItem = inventoryItems.find(it => it.id === itemId);
    if (!selectedItem) return;

    setBOMForm(prev => ({
      ...prev,
      materials: prev.materials.map((m, i) => {
        if (i !== idx) return m;
        const unitCost = Number(selectedItem.costPrice) || 10;
        return {
          ...m,
          itemId: selectedItem.id,
          itemCode: selectedItem.code || selectedItem.barcode || '',
          itemName: selectedItem.name,
          unit: selectedItem.unit || 'قطعة',
          unitCost: unitCost,
          totalCost: (Number(m.standardQuantity) || 1) * unitCost
        };
      })
    }));
  };

  // Handle Save / Update BOM
  const handleSaveBOM = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bomForm.name.trim() || !bomForm.finalProductName.trim()) {
      alert('يرجى إدخال اسم المعيار واسم المنتج التام');
      return;
    }

    const materialsTotal = bomForm.materials.reduce((sum, m) => sum + Number(m.standardQuantity) * Number(m.unitCost), 0);
    const totalEst = materialsTotal + Number(bomForm.directLaborCost) + Number(bomForm.overheadCost);
    const costPerUnit = bomForm.targetOutputQuantity > 0 ? Math.round((totalEst / bomForm.targetOutputQuantity) * 100) / 100 : 0;

    const formattedMaterials = bomForm.materials.map(m => ({
      ...m,
      itemId: m.itemId || 'itm-' + Math.random(),
      itemCode: m.itemCode || 'RAW-00',
      standardQuantity: Number(m.standardQuantity),
      unitCost: Number(m.unitCost),
      totalCost: Number(m.standardQuantity) * Number(m.unitCost)
    }));

    if (editingBOMId) {
      // Update Existing BOM
      const updated = boms.map(b => {
        if (b.id !== editingBOMId) return b;
        return {
          ...b,
          name: bomForm.name,
          finalProductName: bomForm.finalProductName,
          finalProductId: bomForm.finalProductId || b.finalProductId,
          targetOutputQuantity: Number(bomForm.targetOutputQuantity),
          outputUnit: bomForm.outputUnit,
          directLaborCost: Number(bomForm.directLaborCost),
          overheadCost: Number(bomForm.overheadCost),
          scrapExpectedPercent: Number(bomForm.scrapExpectedPercent),
          sourceWarehouse: bomForm.sourceWarehouse,
          targetWarehouse: bomForm.targetWarehouse,
          version: bomForm.version,
          isActive: bomForm.isActive,
          rawMaterials: formattedMaterials,
          totalEstimatedCost: totalEst,
          costPerUnit,
          notes: bomForm.notes
        };
      });
      saveStoredBOMs(updated);
      setBoms(updated);
      setIsBOMModalOpen(false);
      alert(`تم تعديل معيار التصنيع بنجاح!`);
    } else {
      // Create New BOM
      const bomCode = `BOM-${new Date().getFullYear()}-${String(boms.length + 1).padStart(3, '0')}`;
      const createdBOM: BillOfMaterials = {
        id: 'bom-' + Date.now(),
        bomCode,
        name: bomForm.name,
        finalProductId: bomForm.finalProductId || 'prod-' + Date.now(),
        finalProductName: bomForm.finalProductName,
        targetOutputQuantity: Number(bomForm.targetOutputQuantity),
        outputUnit: bomForm.outputUnit,
        version: bomForm.version || '1.0',
        isActive: bomForm.isActive !== false,
        sourceWarehouse: bomForm.sourceWarehouse,
        targetWarehouse: bomForm.targetWarehouse,
        directLaborCost: Number(bomForm.directLaborCost),
        overheadCost: Number(bomForm.overheadCost),
        scrapExpectedPercent: Number(bomForm.scrapExpectedPercent),
        rawMaterials: formattedMaterials,
        totalEstimatedCost: totalEst,
        costPerUnit,
        notes: bomForm.notes
      };
      const updated = [createdBOM, ...boms];
      saveStoredBOMs(updated);
      setBoms(updated);
      setIsBOMModalOpen(false);
      alert(`تم حفظ معيار التصنيع ${bomCode} بنجاح!`);
    }
  };

  // Save Work Center
  const handleSaveWorkCenter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workCenterForm.name.trim()) return;

    if (editingWorkCenter) {
      const updated = workCenters.map(wc =>
        wc.id === editingWorkCenter.id
          ? {
              ...wc,
              name: workCenterForm.name,
              code: workCenterForm.code,
              capacityPerHour: Number(workCenterForm.capacityPerHour),
              costPerHour: Number(workCenterForm.costPerHour),
              supervisor: workCenterForm.supervisor,
              status: workCenterForm.status
            }
          : wc
      );
      saveStoredWorkCenters(updated);
      setWorkCenters(updated);
    } else {
      const newWc: WorkCenter = {
        id: 'wc-' + Date.now(),
        code: workCenterForm.code || `WC-0${workCenters.length + 1}`,
        name: workCenterForm.name,
        capacityPerHour: Number(workCenterForm.capacityPerHour),
        costPerHour: Number(workCenterForm.costPerHour),
        supervisor: workCenterForm.supervisor,
        status: workCenterForm.status
      };
      const updated = [...workCenters, newWc];
      saveStoredWorkCenters(updated);
      setWorkCenters(updated);
    }
    setIsWorkCenterModalOpen(false);
    setEditingWorkCenter(null);
  };

  return (
    <div className="flex flex-col flex-1 space-y-5" dir="rtl">
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              نظام إدارة التصنيع والتكاليف الصناعية المتكامل (ERP Manufacturing)
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2.5">
            <Factory className="text-blue-600" size={28} />
            إدارة التصنيع وأوامر التشغيل وتكاليف الإنتاج
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            قوائم مواد التكاليف (BOM)، أوامر الإنتاج والتشغيل، الخصم والإضافة المخزنية الآلية، والقيود المحاسبية الصناعية.
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
            className="flex items-center gap-2 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer border border-blue-600 active:translate-y-0.5"
          >
            <Plus size={16} />
            <span>إنشاء أمر تشغيل (MO) جديد</span>
          </button>

          <button
            type="button"
            onClick={handleOpenNewBOMModal}
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
            <span className="text-xs font-semibold">إجمالي تكاليف التشغيل الفعلية</span>
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
              مكتمل ومورد: {metrics.completedCount} أوامر
            </div>
          </div>
        </div>

        {/* Total Quantity Produced */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">إجمالي المنتجات التامة الموردة</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Package size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-600">
              {metrics.totalItemsProduced.toLocaleString()} <span className="text-xs text-slate-500 font-normal">قطعة / وحدة</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {metrics.totalScrapQty > 0 ? `الهالك المسجل: ${metrics.totalScrapQty} وحدة` : 'جاهزة للبيع والتسليم في المخازن'}
            </div>
          </div>
        </div>

        {/* BOM & Work Centers Count */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">المعايير والربط المحاسبي</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Cpu size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-purple-700">
              {metrics.bomsCount} <span className="text-xs text-slate-500 font-normal">معايير (BOM)</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              مرتبط بـ {manufacturingJournals.length} قيود محاسبية
            </div>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="bg-white rounded-2xl border border-slate-200 p-1.5 shadow-xs flex items-center gap-1 overflow-x-auto print:hidden">
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'bom'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Settings2 size={16} />
          <span>معايير التكاليف - BOM ({boms.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('workCenters')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'costAnalysis'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Sparkles size={16} />
          <span>تحليل التكاليف والهالك والانحرافات</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('accounting')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'accounting'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BookOpen size={16} />
          <span>القيود المحاسبية الصناعية ({manufacturingJournals.length})</span>
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

              <ExportButtonGroup
                title="سجل أوامر التشغيل والإنتاج الصناعي"
                filename="اوامر_التشغيل_والانتاج"
                headers={[
                  'رقم الأمر',
                  'اسم المنتج النهائي',
                  'معيار التصنيع (BOM)',
                  'الكمية المخططة',
                  'الكمية الفعلية المنتجة',
                  'الوحدة',
                  'مركز العمل',
                  'المشرف',
                  'تاريخ البدء',
                  'تاريخ الانتهاء',
                  'إجمالي تكلفة الإنتاج',
                  'تكلفة الوحدة',
                  'الحالة'
                ]}
                rows={filteredOrders.map(o => [
                  o.orderNumber,
                  o.finalProductName,
                  o.bomName,
                  o.plannedQuantity,
                  o.actualQuantityProduced || o.plannedQuantity,
                  o.unit,
                  o.workCenter,
                  o.supervisor,
                  o.startDate,
                  o.targetEndDate,
                  o.totalProductionCost,
                  o.actualCostPerUnit,
                  o.status === 'COMPLETED' ? 'مكتمل ومورد' : o.status === 'IN_PROGRESS' ? 'قيد التشغيل' : o.status
                ])}
                size="sm"
              />
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
                  <th className="py-3.5 px-4">المخزن المستلم</th>
                  <th className="py-3.5 px-4">إجمالي التكلفة</th>
                  <th className="py-3.5 px-4">تكلفة الوحدة</th>
                  <th className="py-3.5 px-4">حالة التشغيل والمخزون</th>
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
                          <div className="text-[10px] text-emerald-600">منجز: {order.actualQuantityProduced} {order.unit}</div>
                        )}
                        {order.defectiveQuantity > 0 && (
                          <div className="text-[10px] text-red-500">هالك: {order.defectiveQuantity}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-medium">{order.workCenter}</div>
                        <div className="text-[11px] text-slate-400">{order.supervisor}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs">
                        {order.targetWarehouse || 'المستودع الرئيسي'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {order.totalProductionCost.toLocaleString()} {currencySymbol}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-emerald-700">
                        {order.actualCostPerUnit.toLocaleString()} {currencySymbol}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
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
                          {order.consumptionJournalEntryId && (
                            <div className="text-[10px] text-blue-600 font-mono">
                              ✓ قيد الصرف: {order.consumptionJournalEntryId.replace('jv-mat-', '')}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {order.status !== 'COMPLETED' && (
                            <button
                              type="button"
                              onClick={() => handleOpenCompleteModal(order)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                              title="إتمام أمر الإنتاج وإضافة البضاعة للمخزن وتوليد القيد المحاسبي"
                            >
                              <CheckSquare size={13} />
                              <span>إتمام وتوريد</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedOrderForView(order)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="عرض تفاصيل أمر التشغيل وتكاليف الخامات والقيود"
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
                            title="طباعة بطاقة أمر التشغيل"
                          >
                            <Printer size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteOrder(order.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="حذف أمر التشغيل"
                          >
                            <Trash2 size={16} />
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
            <div className="flex items-center gap-2">
              <ExportButtonGroup
                title="دليل معايير وهياكل المنتجات (BOM)"
                filename="معايير_التصنيع_BOM"
                headers={[
                  'كود المعيار',
                  'اسم المعيار',
                  'اسم المنتج النهائي',
                  'الدفعة المستهدفة',
                  'الوحدة',
                  'تكلفة الخامات',
                  'أجور العمالة المباشرة',
                  'المصاريف غير المباشرة',
                  'إجمالي التكلفة التقديرية',
                  'تكلفة الوحدة المعيارية',
                  'الإصدار',
                  'الحالة'
                ]}
                rows={filteredBOMs.map(b => {
                  const rawCost = b.rawMaterials.reduce((sum, m) => sum + (Number(m.totalCost) || 0), 0);
                  return [
                    b.bomCode,
                    b.name,
                    b.finalProductName,
                    b.targetOutputQuantity,
                    b.outputUnit,
                    rawCost,
                    b.directLaborCost,
                    b.overheadCost,
                    b.totalEstimatedCost,
                    b.costPerUnit,
                    b.version,
                    b.isActive ? 'نشط ومعتمد' : 'غير نشط'
                  ];
                })}
                size="sm"
              />

              <button
                type="button"
                onClick={handleOpenNewBOMModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                <Plus size={15} />
                <span>إضافة معيار جديد</span>
              </button>
            </div>
          </div>

          {/* BOM Cards Grid */}
          <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBOMs.map(bom => (
              <div
                key={bom.id}
                className={`border rounded-2xl p-5 transition-all flex flex-col justify-between ${
                  bom.isActive ? 'border-slate-200 hover:border-blue-300 bg-slate-50/50' : 'border-slate-200 bg-slate-100 opacity-70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
                      {bom.bomCode} (إصدار {bom.version})
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleBOMActive(bom.id)}
                        className={`text-xs font-bold px-2 py-0.5 rounded cursor-pointer ${
                          bom.isActive ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600 bg-slate-200'
                        }`}
                      >
                        {bom.isActive ? 'معتمد ونشط' : 'معطل مؤقتاً'}
                      </button>
                    </div>
                  </div>

                  <h4 className="text-base font-bold text-slate-900 mb-1">{bom.name}</h4>
                  <p className="text-xs text-slate-600 mb-3 font-semibold text-blue-900">
                    المنتج النهائي: {bom.finalProductName}
                  </p>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 grid grid-cols-3 gap-2 text-center text-xs mb-3">
                    <div>
                      <span className="text-slate-400 text-[10px]">الدفعة المعيارية</span>
                      <div className="font-bold text-slate-800 mt-0.5">
                        {bom.targetOutputQuantity} {bom.outputUnit}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">التكلفة الإجمالية</span>
                      <div className="font-bold text-blue-700 mt-0.5">
                        {bom.totalEstimatedCost.toLocaleString()} {currencySymbol}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">تكلفة الوحدة المعيارية</span>
                      <div className="font-bold text-emerald-700 mt-0.5">
                        {bom.costPerUnit.toLocaleString()} {currencySymbol}
                      </div>
                    </div>
                  </div>

                  {/* Raw materials snippet */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-slate-700 mb-1">
                      الخامات ومستلزمات الإنتاج ({bom.rawMaterials.length} عناصر):
                    </div>
                    {bom.rawMaterials.slice(0, 4).map(m => (
                      <div key={m.id} className="flex justify-between text-xs text-slate-600 py-0.5 border-b border-slate-100">
                        <span>• {m.itemName}</span>
                        <span className="font-mono text-slate-500">
                          {m.standardQuantity} {m.unit} ({m.totalCost.toLocaleString()} {currencySymbol})
                        </span>
                      </div>
                    ))}
                    {bom.rawMaterials.length > 4 && (
                      <div className="text-[10px] text-slate-400 pt-1">+ {bom.rawMaterials.length - 4} خامات إضافية أخرى...</div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-500">
                    أجور: {bom.directLaborCost} {currencySymbol} | مصاريف: {bom.overheadCost} {currencySymbol}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDuplicateBOM(bom)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                      title="استنساخ وإنشاء إصدار جديد"
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditBOMModal(bom)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                      title="تعديل معيار التصنيع"
                    >
                      <Edit size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBOM(bom.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      title="حذف المعيار"
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewOrder(prev => ({ ...prev, bomId: bom.id, plannedQuantity: bom.targetOutputQuantity }));
                        setIsNewOrderModalOpen(true);
                      }}
                      className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer bg-blue-50 px-2.5 py-1 rounded-lg"
                    >
                      <span>إصدار أمر تشغيل ←</span>
                    </button>
                  </div>
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
                setEditingWorkCenter(null);
                setWorkCenterForm({
                  code: `WC-0${workCenters.length + 1}`,
                  name: '',
                  capacityPerHour: 25,
                  costPerHour: 50,
                  supervisor: 'مشرف تشغيل',
                  status: 'ACTIVE'
                });
                setIsWorkCenterModalOpen(true);
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
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {wc.status === 'ACTIVE' ? 'جاهز للعمل' : 'صيانة'}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">{wc.name}</h4>
                <div className="text-xs text-slate-600 space-y-1">
                  <div>المشرف المسؤول: <strong className="text-slate-800">{wc.supervisor}</strong></div>
                  <div>الطاقة الإنتاجية: <strong className="text-slate-800">{wc.capacityPerHour} وحدة / ساعة</strong></div>
                  <div>تكلفة التشغيل: <strong className="text-slate-800">{wc.costPerHour} {currencySymbol} / ساعة</strong></div>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWorkCenter(wc);
                      setWorkCenterForm({
                        code: wc.code,
                        name: wc.name,
                        capacityPerHour: wc.capacityPerHour,
                        costPerHour: wc.costPerHour,
                        supervisor: wc.supervisor,
                        status: wc.status
                      });
                      setIsWorkCenterModalOpen(true);
                    }}
                    className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    تعديل المركز
                  </button>
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
              تحليل وتوزيع تكاليف الإنتاج الصناعي
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

            <div className="space-y-3 max-h-[450px] overflow-y-auto">
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
                    <span>الكمية: {o.plannedQuantity} {o.unit} {o.defectiveQuantity > 0 && <span className="text-red-500">(هالك: {o.defectiveQuantity})</span>}</span>
                    <span>تكلفة القطعة الواحدة: <strong className="text-emerald-700">{o.actualCostPerUnit.toLocaleString()} {currencySymbol}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: INDUSTRIAL ACCOUNTING JOURNALS */}
      {activeTab === 'accounting' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">سجل القيود المحاسبية الصناعية المترابطة آلياً</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                قيود صرف الخامات لحساب إنتاج تحت التشغيل (WIP)، وقيود استلام وتوريد المنتجات التامة وتحميل أجور ومصاريف التشغيل.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3 px-4">رقم القيد</th>
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">البيان والشرح المحاسبي</th>
                  <th className="py-3 px-4">رقم المرجع (أمر التشغيل)</th>
                  <th className="py-3 px-4">أطراف القيد (مدين / دائن)</th>
                  <th className="py-3 px-4 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {manufacturingJournals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      لا توجد قيود صناعية مسجلة حالياً
                    </td>
                  </tr>
                ) : (
                  manufacturingJournals.map(entry => (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">{entry.entryNumber}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{entry.date}</td>
                      <td className="py-3 px-4 text-slate-800 max-w-[280px]">{entry.description}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700">{entry.reference || '-'}</td>
                      <td className="py-3 px-4">
                        <div className="space-y-1 text-xs">
                          {entry.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between gap-4 font-mono">
                              <span className="text-slate-600">{it.accountId.replace('acc-', 'حـ/ ')}:</span>
                              <span className="font-bold">
                                {it.debit > 0 ? `مدين: ${it.debit.toLocaleString()}` : `دائن: ${it.credit.toLocaleString()}`} {currencySymbol}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          مرحل
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
                  onChange={e => {
                    const sel = boms.find(b => b.id === e.target.value);
                    setNewOrder({
                      ...newOrder,
                      bomId: e.target.value,
                      plannedQuantity: sel ? sel.targetOutputQuantity : newOrder.plannedQuantity,
                      sourceWarehouse: sel?.sourceWarehouse || newOrder.sourceWarehouse,
                      targetWarehouse: sel?.targetWarehouse || newOrder.targetWarehouse
                    });
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  {boms.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.bomCode} - {b.name} (المنتج: {b.finalProductName})
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
                  <label className="block text-slate-700 font-semibold mb-1">مخزن صرف الخامات</label>
                  <input
                    type="text"
                    value={newOrder.sourceWarehouse}
                    onChange={e => setNewOrder({ ...newOrder, sourceWarehouse: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">مخزن استلام الإنتاج التام</label>
                  <input
                    type="text"
                    value={newOrder.targetWarehouse}
                    onChange={e => setNewOrder({ ...newOrder, targetWarehouse: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs"
                  />
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

              {/* Automation Checkbox */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoDeduct"
                  checked={newOrder.autoDeductMaterials}
                  onChange={e => setNewOrder({ ...newOrder, autoDeductMaterials: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                />
                <label htmlFor="autoDeduct" className="text-xs font-bold text-blue-900 cursor-pointer">
                  خصم الخامات ومستلزمات الإنتاج آلياً من المخزن وتوليد قيد صرف التشغيل (WIP) فوراً
                </label>
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
                  className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors cursor-pointer"
                >
                  إصدار أمر التشغيل وبدء الإنتاج ←
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT BOM */}
      {isBOMModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 my-auto text-right">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Settings2 className="text-blue-600" size={20} />
                {editingBOMId ? 'تعديل معيار تصنيع (BOM)' : 'إضافة معيار تصنيع وقائمة مواد تكاليف (BOM)'}
              </h3>
              <button
                type="button"
                onClick={() => setIsBOMModalOpen(false)}
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
                    value={bomForm.name}
                    onChange={e => setBOMForm({ ...bomForm, name: e.target.value })}
                    placeholder="مثال: معيار تصنيع طاولة خشبية فاخرة"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">اسم المنتج النهائي التام *</label>
                  <input
                    type="text"
                    required
                    value={bomForm.finalProductName}
                    onChange={e => setBOMForm({ ...bomForm, finalProductName: e.target.value })}
                    placeholder="اسم الصنف التام كما يظهر في المخزن والفواتير"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">الدفعة الناتجة المعيارية</label>
                  <input
                    type="number"
                    min={1}
                    value={bomForm.targetOutputQuantity}
                    onChange={e => setBOMForm({ ...bomForm, targetOutputQuantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">وحدة القياس</label>
                  <input
                    type="text"
                    value={bomForm.outputUnit}
                    onChange={e => setBOMForm({ ...bomForm, outputUnit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">أجور عمالة مباشرة ({currencySymbol})</label>
                  <input
                    type="number"
                    value={bomForm.directLaborCost}
                    onChange={e => setBOMForm({ ...bomForm, directLaborCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none text-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">مصاريف صناعية غير مباشرة</label>
                  <input
                    type="number"
                    value={bomForm.overheadCost}
                    onChange={e => setBOMForm({ ...bomForm, overheadCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none text-purple-700"
                  />
                </div>
              </div>

              {/* Raw Materials Selection Table */}
              <div className="space-y-2 border border-slate-200 p-3.5 rounded-2xl bg-slate-50/70">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 text-xs">قائمة الخامات ومستلزمات الإنتاج:</span>
                    <span className="text-[11px] text-slate-500 mr-2">(يمكنك اختيار الخامة مباشرة من أصناف المخزن لجلب التكلفة الفعلية)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddBOMMaterialRow}
                    className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs"
                  >
                    <Plus size={14} /> إضافة خامة جديدة
                  </button>
                </div>

                <div className="space-y-2.5">
                  {bomForm.materials.map((mat, idx) => (
                    <div key={mat.id || idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                      {/* Item Selector Dropdown */}
                      <div className="col-span-4">
                        <label className="block text-[10px] text-slate-400 mb-0.5">اختر من المخزن أو اكتب يدوياً:</label>
                        <select
                          value={mat.itemId || ''}
                          onChange={e => handleSelectInventoryItemForBOM(idx, e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 mb-1"
                        >
                          <option value="">-- اختيار من أصناف المخزن --</option>
                          {inventoryItems.map(it => (
                            <option key={it.id} value={it.id}>
                              {it.name} (تكلفة: {it.costPrice} | رصيد: {it.stock})
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={mat.itemName}
                          onChange={e => {
                            setBOMForm(prev => ({
                              ...prev,
                              materials: prev.materials.map((m, i) => (i === idx ? { ...m, itemName: e.target.value } : m))
                            }));
                          }}
                          placeholder="اسم الخامة"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] text-slate-400 mb-0.5">الوحدة:</label>
                        <input
                          type="text"
                          value={mat.unit}
                          onChange={e => {
                            setBOMForm(prev => ({
                              ...prev,
                              materials: prev.materials.map((m, i) => (i === idx ? { ...m, unit: e.target.value } : m))
                            }));
                          }}
                          placeholder="الوحدة"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] text-slate-400 mb-0.5">الكمية:</label>
                        <input
                          type="number"
                          step="any"
                          value={mat.standardQuantity}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setBOMForm(prev => ({
                              ...prev,
                              materials: prev.materials.map((m, i) =>
                                i === idx ? { ...m, standardQuantity: val, totalCost: val * m.unitCost } : m
                              )
                            }));
                          }}
                          placeholder="الكمية"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] text-slate-400 mb-0.5">تكلفة الوحدة ({currencySymbol}):</label>
                        <input
                          type="number"
                          step="any"
                          value={mat.unitCost}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setBOMForm(prev => ({
                              ...prev,
                              materials: prev.materials.map((m, i) =>
                                i === idx ? { ...m, unitCost: val, totalCost: m.standardQuantity * val } : m
                              )
                            }));
                          }}
                          placeholder="تكلفة الوحدة"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-blue-700"
                        />
                      </div>

                      <div className="col-span-1 text-center">
                        <label className="block text-[10px] text-slate-400 mb-0.5">الإجمالي:</label>
                        <div className="text-xs font-bold text-slate-800 pt-1">
                          {(mat.standardQuantity * mat.unitCost).toLocaleString()}
                        </div>
                      </div>

                      <div className="col-span-1 text-center pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (bomForm.materials.length > 1) {
                              setBOMForm(prev => ({ ...prev, materials: prev.materials.filter((_, i) => i !== idx) }));
                            }
                          }}
                          className="text-red-500 hover:text-red-700 cursor-pointer"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Calculation Preview */}
              <div className="bg-slate-100 p-3.5 rounded-xl flex items-center justify-between text-xs">
                <div className="text-slate-700">
                  إجمالي تكلفة المواد الخام:{' '}
                  <strong>
                    {bomForm.materials.reduce((s, m) => s + m.standardQuantity * m.unitCost, 0).toLocaleString()} {currencySymbol}
                  </strong>
                </div>
                <div className="text-emerald-800 font-bold">
                  التكلفة التقديرية للوحدة الناتجة:{' '}
                  {bomForm.targetOutputQuantity > 0
                    ? (
                        (bomForm.materials.reduce((s, m) => s + m.standardQuantity * m.unitCost, 0) +
                          Number(bomForm.directLaborCost) +
                          Number(bomForm.overheadCost)) /
                        bomForm.targetOutputQuantity
                      ).toFixed(2)
                    : 0}{' '}
                  {currencySymbol}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsBOMModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors cursor-pointer"
                >
                  {editingBOMId ? 'تحديث المعيار' : 'حفظ معيار التصنيع ←'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: COMPLETE ORDER & RECEIVE FINISHED GOODS */}
      {isCompleteOrderModalOpen && orderToComplete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-auto text-right">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="text-emerald-600" size={20} />
                إتمام أمر الإنتاج واستلام البضاعة التامة بالمخزن
              </h3>
              <button
                type="button"
                onClick={() => setIsCompleteOrderModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmCompleteOrder} className="space-y-4 text-xs sm:text-sm">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900">{orderToComplete.orderNumber}: {orderToComplete.finalProductName}</div>
                <div className="text-xs text-slate-500">
                  الكمية المخططة: {orderToComplete.plannedQuantity} {orderToComplete.unit} | التكلفة التقديرية:{' '}
                  {orderToComplete.totalProductionCost.toLocaleString()} {currencySymbol}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">الكمية السليمة المنتجة فعلياً *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={completeForm.actualQuantityProduced}
                    onChange={e => setCompleteForm({ ...completeForm, actualQuantityProduced: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-emerald-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">كمية الهالك / المعيب (Scrap)</label>
                  <input
                    type="number"
                    min={0}
                    value={completeForm.defectiveQuantity}
                    onChange={e => setCompleteForm({ ...completeForm, defectiveQuantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-red-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">المستودع المستلم للبضاعة التامة *</label>
                  <input
                    type="text"
                    required
                    value={completeForm.targetWarehouse}
                    onChange={e => setCompleteForm({ ...completeForm, targetWarehouse: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">تكلفة الهالك غير الطبيعي المحملة ({currencySymbol})</label>
                  <input
                    type="number"
                    min={0}
                    value={completeForm.scrapCost}
                    onChange={e => setCompleteForm({ ...completeForm, scrapCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-red-700"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={15} /> الإجراءات الآلية التي سيتم تنفيذها فور التأكيد:
                </div>
                <div>• إضافة {completeForm.actualQuantityProduced} {orderToComplete.unit} إلى رصيد مخزن البضاعة التامة وتحديث متوسط التكلفة.</div>
                <div>• توليد وترحيل القيد المحاسبي الصناعي الختامي (من حـ/ مخزون الإنتاج التام إلى حـ/ تشغيل تحت التشغيل والأجور).</div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCompleteOrderModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors cursor-pointer"
                >
                  تأكيد التوريد والترحيل المحاسبي ←
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: VIEW SINGLE WORK ORDER DETAIL & PRINT */}
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
                    onClick={() => handleOpenCompleteModal(selectedOrderForView)}
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
                  <span className="text-slate-400 text-[11px]">الكمية المطلوبة / الفعلية:</span>
                  <div className="font-bold text-blue-700 mt-1">
                    {selectedOrderForView.actualQuantityProduced || selectedOrderForView.plannedQuantity} {selectedOrderForView.unit}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">إجمالي تكلفة الأمر:</span>
                  <div className="font-bold text-emerald-700 mt-1">
                    {selectedOrderForView.totalProductionCost.toLocaleString()} {currencySymbol}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">التكلفة الفعلية للقطعة:</span>
                  <div className="font-bold text-slate-900 mt-1">
                    {selectedOrderForView.actualCostPerUnit.toLocaleString()} {currencySymbol}
                  </div>
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
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            st.status === 'DONE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {st.orderIndex}
                        </div>
                        <span className="font-semibold text-slate-800 text-xs">{st.stageName}</span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          st.status === 'DONE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {st.status === 'DONE' ? 'مكتمل' : 'قيد التنفيذ'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Linked Accounting Journals Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <h5 className="font-bold text-slate-900 text-xs">القيود المحاسبية الصناعية المترابطة مع هذا الأمر:</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-[11px] font-bold text-blue-700">1. قيد صرف الخامات للتشغيل (WIP)</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-1">
                      {selectedOrderForView.consumptionJournalEntryId
                        ? `قيد رقم: JV-MFG-MAT-${selectedOrderForView.orderNumber} (مرحل)`
                        : 'لم يتم التوليد بعد'}
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-[11px] font-bold text-emerald-700">2. قيد استلام الإنتاج التام والأجور</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-1">
                      {selectedOrderForView.completionJournalEntryId
                        ? `قيد رقم: JV-MFG-FIN-${selectedOrderForView.orderNumber} (مرحل)`
                        : selectedOrderForView.status === 'COMPLETED'
                        ? 'مرحل ومورد للمخزن'
                        : 'يتم توليده تلقائياً عند إتمام الإنتاج'}
                    </div>
                  </div>
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

      {/* MODAL 5: WORK CENTER ADD/EDIT */}
      {isWorkCenterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 my-auto text-right">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Wrench className="text-blue-600" size={20} />
                {editingWorkCenter ? 'تعديل مركز العمل' : 'إضافة خط إنتاج ومركز عمل جديد'}
              </h3>
              <button
                type="button"
                onClick={() => setIsWorkCenterModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveWorkCenter} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">اسم خط الإنتاج / مركز العمل *</label>
                <input
                  type="text"
                  required
                  value={workCenterForm.name}
                  onChange={e => setWorkCenterForm({ ...workCenterForm, name: e.target.value })}
                  placeholder="مثال: ورشة التجميع واللحام الآلي"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">كود المركز</label>
                  <input
                    type="text"
                    value={workCenterForm.code}
                    onChange={e => setWorkCenterForm({ ...workCenterForm, code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">المشرف المسؤول</label>
                  <input
                    type="text"
                    value={workCenterForm.supervisor}
                    onChange={e => setWorkCenterForm({ ...workCenterForm, supervisor: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">الطاقة الإنتاجية (وحدة/ساعة)</label>
                  <input
                    type="number"
                    value={workCenterForm.capacityPerHour}
                    onChange={e => setWorkCenterForm({ ...workCenterForm, capacityPerHour: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">تكلفة التشغيل بالساعة ({currencySymbol})</label>
                  <input
                    type="number"
                    value={workCenterForm.costPerHour}
                    onChange={e => setWorkCenterForm({ ...workCenterForm, costPerHour: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none text-blue-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsWorkCenterModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors cursor-pointer"
                >
                  حفظ مركز العمل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
