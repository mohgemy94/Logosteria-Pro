import { BillOfMaterials, ManufacturingOrder, WorkCenter } from '../types/manufacturing';

export const STORAGE_KEY_BOM = 'alpha_accounting_bom_v1';
export const STORAGE_KEY_WORK_ORDERS = 'alpha_accounting_work_orders_v1';
export const STORAGE_KEY_WORK_CENTERS = 'alpha_accounting_work_centers_v1';

export const INITIAL_WORK_CENTERS: WorkCenter[] = [
  {
    id: 'wc-1',
    code: 'WC-01',
    name: 'خط التقطيع والتشكيل الميكانيكي',
    capacityPerHour: 20,
    costPerHour: 45,
    supervisor: 'م. سامح عبد الفتاح',
    status: 'ACTIVE'
  },
  {
    id: 'wc-2',
    code: 'WC-02',
    name: 'خط التجميع والتركيب الإلكتروني',
    capacityPerHour: 15,
    costPerHour: 60,
    supervisor: 'م. طارق العسيري',
    status: 'ACTIVE'
  },
  {
    id: 'wc-3',
    code: 'WC-03',
    name: 'قسم الفحص وضبط الجودة والتغليف',
    capacityPerHour: 40,
    costPerHour: 35,
    supervisor: 'أ. منى الزهراني',
    status: 'ACTIVE'
  }
];

export const INITIAL_BOMS: BillOfMaterials[] = [
  {
    id: 'bom-101',
    bomCode: 'BOM-2026-001',
    name: 'معيار تصنيع جهاز كمبيوتر مكتبي Alpha Core i7',
    finalProductId: 'prod-desktop-01',
    finalProductName: 'حاسب آلي مكتبي Alpha Pro Max (Core i7 / 32GB RAM / 1TB SSD)',
    targetOutputQuantity: 10,
    outputUnit: 'جهاز / وحدة',
    version: '1.2',
    isActive: true,
    directLaborCost: 800, // 80 ريال لكل جهاز
    overheadCost: 400, // 40 ريال لكل جهاز (طاقة واستهلاك)
    scrapExpectedPercent: 2,
    rawMaterials: [
      {
        id: 'mat-1',
        itemId: '101',
        itemCode: 'RAW-001',
        itemName: 'معالج إنتل Core i7 الجيل 14',
        unit: 'قطعة',
        standardQuantity: 10,
        unitCost: 1100,
        totalCost: 11000
      },
      {
        id: 'mat-2',
        itemId: '102',
        itemCode: 'RAW-002',
        itemName: 'لوحة أم متطورة ASUS Gaming Pro',
        unit: 'قطعة',
        standardQuantity: 10,
        unitCost: 450,
        totalCost: 4500
      },
      {
        id: 'mat-3',
        itemId: '103',
        itemCode: 'RAW-003',
        itemName: 'ذاكرة عشوائية RAM 16GB DDR5 (2x16)',
        unit: 'قطعة',
        standardQuantity: 20,
        unitCost: 150,
        totalCost: 3000
      },
      {
        id: 'mat-4',
        itemId: '104',
        itemCode: 'RAW-004',
        itemName: 'قرص تخزين فائق السرعة 1TB NVMe M.2',
        unit: 'قطعة',
        standardQuantity: 10,
        unitCost: 220,
        totalCost: 2200
      },
      {
        id: 'mat-5',
        itemId: '105',
        itemCode: 'RAW-005',
        itemName: 'كيسة حاسوب احترافية مزودة بمزود طاقة 750W',
        unit: 'قطعة',
        standardQuantity: 10,
        unitCost: 280,
        totalCost: 2800
      }
    ],
    totalEstimatedCost: 24700, // 23500 مواد + 800 عمالة + 400 إضافية
    costPerUnit: 2470,
    notes: 'المعيار المعتمد لأجهزة الجيل الحديث للشركات والمؤسسات'
  },
  {
    id: 'bom-102',
    bomCode: 'BOM-2026-002',
    name: 'تعبئة وتغليف عبوات عسل سدر طبيعي 1 كجم فاخر',
    finalProductId: 'prod-honey-01',
    finalProductName: 'كرتونة عسل سدر بري مصفى فاخر (12 برطمان × 1 كجم)',
    targetOutputQuantity: 50,
    outputUnit: 'كرتونة',
    version: '2.0',
    isActive: true,
    directLaborCost: 1200,
    overheadCost: 600,
    scrapExpectedPercent: 1.5,
    rawMaterials: [
      {
        id: 'mat-201',
        itemId: '201',
        itemCode: 'RAW-HON-01',
        itemName: 'عسل سدر بري خام نقي (براميل)',
        unit: 'كيلوجرام',
        standardQuantity: 600,
        unitCost: 45,
        totalCost: 27000
      },
      {
        id: 'mat-202',
        itemId: '202',
        itemCode: 'RAW-GLS-01',
        itemName: 'برطمانات زجاجية معقمة سعة 1 كجم مع غطاء ذهبي',
        unit: 'برطمان',
        standardQuantity: 600,
        unitCost: 2.5,
        totalCost: 1500
      },
      {
        id: 'mat-203',
        itemId: '203',
        itemCode: 'RAW-PKG-01',
        itemName: 'كرتون مقوى مع طباعة وشعار الشركة الفاخر',
        unit: 'كرتونة',
        standardQuantity: 50,
        unitCost: 8,
        totalCost: 400
      },
      {
        id: 'mat-204',
        itemId: '204',
        itemCode: 'RAW-LBL-01',
        itemName: 'استيكر باركود وضمان الجودة مقاوم للرطوبة',
        unit: 'ملصق',
        standardQuantity: 600,
        unitCost: 0.5,
        totalCost: 300
      }
    ],
    totalEstimatedCost: 31000,
    costPerUnit: 620, // 31000 / 50 = 620 للكرتونة (أو 51.6 للبرطمان)
    notes: 'خط إنتاج المواد الغذائية مع شهادة مطابقة الجودة'
  }
];

export const INITIAL_MANUFACTURING_ORDERS: ManufacturingOrder[] = [
  {
    id: 'mo-2026-001',
    orderNumber: 'MO-2026-001',
    bomId: 'bom-101',
    bomCode: 'BOM-2026-001',
    bomName: 'معيار تصنيع جهاز كمبيوتر مكتبي Alpha Core i7',
    finalProductId: 'prod-desktop-01',
    finalProductName: 'حاسب آلي مكتبي Alpha Pro Max (Core i7 / 32GB RAM / 1TB SSD)',
    plannedQuantity: 20,
    actualQuantityProduced: 20,
    defectiveQuantity: 0,
    unit: 'جهاز / وحدة',
    workCenter: 'خط التجميع والتركيب الإلكتروني',
    supervisor: 'م. طارق العسيري',
    startDate: '2026-02-01',
    targetEndDate: '2026-02-08',
    actualEndDate: '2026-02-07',
    status: 'COMPLETED',
    priority: 'HIGH',
    directLaborCost: 1600,
    machineHoursCost: 350,
    overheadAllocatedCost: 800,
    totalProductionCost: 49750,
    actualCostPerUnit: 2487.5,
    inventoryTransferred: true,
    materialsConsumed: [
      {
        id: 'cmat-1',
        itemId: '101',
        itemName: 'معالج إنتل Core i7 الجيل 14',
        unit: 'قطعة',
        plannedQuantity: 20,
        actualQuantity: 20,
        unitCost: 1100,
        totalCost: 22000,
        variance: 0
      },
      {
        id: 'cmat-2',
        itemId: '102',
        itemName: 'لوحة أم متطورة ASUS Gaming Pro',
        unit: 'قطعة',
        plannedQuantity: 20,
        actualQuantity: 20,
        unitCost: 450,
        totalCost: 9000,
        variance: 0
      },
      {
        id: 'cmat-3',
        itemId: '103',
        itemName: 'ذاكرة عشوائية RAM 16GB DDR5 (2x16)',
        unit: 'قطعة',
        plannedQuantity: 40,
        actualQuantity: 40,
        unitCost: 150,
        totalCost: 6000,
        variance: 0
      },
      {
        id: 'cmat-4',
        itemId: '104',
        itemName: 'قرص تخزين فائق السرعة 1TB NVMe M.2',
        unit: 'قطعة',
        plannedQuantity: 20,
        actualQuantity: 20,
        unitCost: 220,
        totalCost: 4400,
        variance: 0
      },
      {
        id: 'cmat-5',
        itemId: '105',
        itemName: 'كيسة حاسوب احترافية مزودة بمزود طاقة 750W',
        unit: 'قطعة',
        plannedQuantity: 20,
        actualQuantity: 20,
        unitCost: 280,
        totalCost: 5600,
        variance: 0
      }
    ],
    stages: [
      { id: 'st-1', stageName: 'صرف وتجهيز المكونات من مستودع الخامات', orderIndex: 1, status: 'DONE', technician: 'خالد الزهراني', completedAt: '2026-02-01' },
      { id: 'st-2', stageName: 'تجميع اللوحات الأم والمعالجات والذواكر', orderIndex: 2, status: 'DONE', technician: 'أحمد ماهر', completedAt: '2026-02-03' },
      { id: 'st-3', stageName: 'تثبيت نظام التبريد والكابلات ومزود الطاقة', orderIndex: 3, status: 'DONE', technician: 'سالم الدوسري', completedAt: '2026-02-05' },
      { id: 'st-4', stageName: 'فحص الإجهاد الحراري وجودة التشغيل والتغليف', orderIndex: 4, status: 'DONE', technician: 'م. طارق العسيري', completedAt: '2026-02-07' }
    ],
    notes: 'تم إنهاء التشغيل بنجاح وبأعلى معايير الجودة وتم توريد الكمية لمخزن البضاعة التامة.'
  },
  {
    id: 'mo-2026-002',
    orderNumber: 'MO-2026-002',
    bomId: 'bom-102',
    bomCode: 'BOM-2026-002',
    bomName: 'تعبئة وتغليف عبوات عسل سدر طبيعي 1 كجم فاخر',
    finalProductId: 'prod-honey-01',
    finalProductName: 'كرتونة عسل سدر بري مصفى فاخر (12 برطمان × 1 كجم)',
    plannedQuantity: 100,
    actualQuantityProduced: 75,
    defectiveQuantity: 2,
    unit: 'كرتونة',
    workCenter: 'قسم الفحص وضبط الجودة والتغليف',
    supervisor: 'أ. منى الزهراني',
    startDate: '2026-03-01',
    targetEndDate: '2026-03-10',
    status: 'IN_PROGRESS',
    priority: 'URGENT',
    directLaborCost: 2400,
    machineHoursCost: 700,
    overheadAllocatedCost: 1200,
    totalProductionCost: 62400,
    actualCostPerUnit: 624,
    inventoryTransferred: false,
    materialsConsumed: [
      {
        id: 'cmat-201',
        itemId: '201',
        itemName: 'عسل سدر بري خام نقي (براميل)',
        unit: 'كيلوجرام',
        plannedQuantity: 1200,
        actualQuantity: 1210,
        unitCost: 45,
        totalCost: 54450,
        variance: 10
      },
      {
        id: 'cmat-202',
        itemId: '202',
        itemName: 'برطمانات زجاجية معقمة سعة 1 كجم مع غطاء ذهبي',
        unit: 'برطمان',
        plannedQuantity: 1200,
        actualQuantity: 1205,
        unitCost: 2.5,
        totalCost: 3012.5,
        variance: 5
      },
      {
        id: 'cmat-203',
        itemId: '203',
        itemName: 'كرتون مقوى مع طباعة وشعار الشركة الفاخر',
        unit: 'كرتونة',
        plannedQuantity: 100,
        actualQuantity: 100,
        unitCost: 8,
        totalCost: 800,
        variance: 0
      }
    ],
    stages: [
      { id: 'st-21', stageName: 'تصفية وبسترة العسل الخام معملياً', orderIndex: 1, status: 'DONE', technician: 'ياسر العتيبي', completedAt: '2026-03-02' },
      { id: 'st-22', stageName: 'التعبئة الآلية في البرطمانات المعقمة', orderIndex: 2, status: 'IN_PROGRESS', technician: 'حسام ناصر' },
      { id: 'st-23', stageName: 'إحكام الغلق ووضع ملصق الضمان والباركود', orderIndex: 3, status: 'PENDING' },
      { id: 'st-24', stageName: 'الرص في الكراتين وتجهيز البالتات', orderIndex: 4, status: 'PENDING' }
    ],
    notes: 'طلبية عاجلة لصالح كبار العملاء'
  }
];

export function getStoredBOMs(): BillOfMaterials[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BOM);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse BOM storage', e);
  }
  return INITIAL_BOMS;
}

export function saveStoredBOMs(boms: BillOfMaterials[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_BOM, JSON.stringify(boms));
    window.dispatchEvent(new Event('alpha-bom-updated'));
  } catch (e) {
    console.error('Failed to save BOM', e);
  }
}

export function getStoredWorkOrders(): ManufacturingOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WORK_ORDERS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse Work Orders storage', e);
  }
  return INITIAL_MANUFACTURING_ORDERS;
}

export function saveStoredWorkOrders(orders: ManufacturingOrder[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_WORK_ORDERS, JSON.stringify(orders));
    window.dispatchEvent(new Event('alpha-work-orders-updated'));
  } catch (e) {
    console.error('Failed to save Work Orders', e);
  }
}

export function getStoredWorkCenters(): WorkCenter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WORK_CENTERS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse Work Centers storage', e);
  }
  return INITIAL_WORK_CENTERS;
}

export function saveStoredWorkCenters(centers: WorkCenter[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_WORK_CENTERS, JSON.stringify(centers));
    window.dispatchEvent(new Event('alpha-work-centers-updated'));
  } catch (e) {
    console.error('Failed to save Work Centers', e);
  }
}
