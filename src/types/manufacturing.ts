export interface BOMMaterialItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  standardQuantity: number;
  unitCost: number;
  totalCost: number;
  wastePercentage?: number | undefined;
}

export interface BillOfMaterials {
  id: string;
  bomCode: string;
  name: string;
  finalProductId: string;
  finalProductName: string;
  targetOutputQuantity: number;
  outputUnit: string;
  rawMaterials: BOMMaterialItem[];
  directLaborCost: number; // تكلفة أجور العمالة المباشرة
  overheadCost: number; // مصاريف صناعية غير مباشرة (طاقة، صيانة، إهلاك)
  scrapExpectedPercent: number; // نسبة الهالك المتوقع
  totalEstimatedCost: number;
  costPerUnit: number;
  isActive: boolean;
  version: string;
  notes?: string | undefined;
}

export interface ManufacturingConsumedMaterial {
  id: string;
  itemId: string;
  itemName: string;
  unit: string;
  plannedQuantity: number;
  actualQuantity: number;
  unitCost: number;
  totalCost: number;
  variance: number; // الفرق بين الفعلي والمخطط
}

export interface ProductionStageItem {
  id: string;
  stageName: string;
  orderIndex: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE';
  technician?: string | undefined;
  completedAt?: string | undefined;
  notes?: string | undefined;
}

export interface ManufacturingOrder {
  id: string;
  orderNumber: string;
  bomId: string;
  bomCode: string;
  bomName: string;
  finalProductId: string;
  finalProductName: string;
  plannedQuantity: number;
  actualQuantityProduced: number;
  defectiveQuantity: number; // هالك / معيب
  unit: string;
  workCenter: string; // خط الإنتاج / الورشة
  supervisor: string;
  startDate: string;
  targetEndDate: string;
  actualEndDate?: string | undefined;
  status: 'DRAFT' | 'RELEASED' | 'IN_PROGRESS' | 'QUALITY_CHECK' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  materialsConsumed: ManufacturingConsumedMaterial[];
  directLaborCost: number;
  machineHoursCost: number;
  overheadAllocatedCost: number;
  totalProductionCost: number;
  actualCostPerUnit: number;
  inventoryTransferred: boolean; // هل تم توريد المنتج لمخزن البضاعة التامة
  stages: ProductionStageItem[];
  notes?: string | undefined;
}

export interface WorkCenter {
  id: string;
  code: string;
  name: string;
  capacityPerHour: number;
  costPerHour: number;
  supervisor: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'IDLE';
}
