import React, { useState, useEffect } from 'react';
import { 
  Building, Briefcase, Globe, Users, Package, 
  MapPin, Map, Star, BookOpen, PieChart, UserPlus, X, Plus, Edit2, Trash2, Search
} from 'lucide-react';

const INITIAL_MOCK_DATA = {
  departments: [
    { code: 'D01', name: 'الإدارة المالية' },
    { code: 'D02', name: 'الموارد البشرية' },
    { code: 'D03', name: 'المبيعات' },
    { code: 'D04', name: 'تقنية المعلومات' },
  ],
  jobs: [
    { code: 'J01', title: 'مدير مالي' },
    { code: 'J02', title: 'محاسب عام' },
    { code: 'J03', title: 'أخصائي مبيعات' },
    { code: 'J04', title: 'مهندس برمجيات' },
  ],
  nationalities: [
    { code: 'SA', name: 'سعودي' },
    { code: 'EG', name: 'مصري' },
    { code: 'JO', name: 'أردني' },
    { code: 'IN', name: 'هندي' },
  ],
  employees: [
    { code: 'E001', name: 'أحمد محمد', department: 'الإدارة المالية', job: 'مدير مالي' },
    { code: 'E002', name: 'سارة خالد', department: 'الموارد البشرية', job: 'مسؤول توظيف' },
    { code: 'E003', name: 'محمود عبدلله', department: 'تقنية المعلومات', job: 'مهندس برمجيات' },
  ],
  warehouses: [
    { code: 'W01', name: 'المستودع الرئيسي - الرياض' },
    { code: 'W02', name: 'مستودع التبريد - جدة' },
    { code: 'W03', name: 'مستودع قطع الغيار - الدمام' },
  ],
  regions: [
    { code: 'R01', name: 'المنطقة الوسطى' },
    { code: 'R02', name: 'المنطقة الغربية' },
    { code: 'R03', name: 'المنطقة الشرقية' },
    { code: 'R04', name: 'المنطقة الجنوبية' },
  ],
  cities: [
    { code: 'C01', name: 'الرياض', region: 'المنطقة الوسطى' },
    { code: 'C02', name: 'جدة', region: 'المنطقة الغربية' },
    { code: 'C03', name: 'الدمام', region: 'المنطقة الشرقية' },
    { code: 'C04', name: 'أبها', region: 'المنطقة الجنوبية' },
  ],
  customerGrades: [
    { code: 'G01', name: 'كبار العملاء (VIP)', discount: '15%' },
    { code: 'G02', name: 'عميل مميز (A)', discount: '10%' },
    { code: 'G03', name: 'عميل عادي (B)', discount: '5%' },
    { code: 'G04', name: 'عميل جديد (C)', discount: '0%' },
  ],
  subAccounts: [
    // 1. الأصول المتداولة
    { code: '1101', name: 'النقدية بالصندوق الرئيسي', type: 'أصول متداولة', nature: 'مدين', parentAccount: '1100 - النقدية وما في حكمها', level: 'مستوى 4', status: 'نشط' },
    { code: '1102', name: 'النقدية بالصندوق - فرع جدة', type: 'أصول متداولة', nature: 'مدين', parentAccount: '1100 - النقدية وما في حكمها', level: 'مستوى 4', status: 'نشط' },
    { code: '1103', name: 'حساب البنك الجاري - العمليات المحلية', type: 'أصول متداولة', nature: 'مدين', parentAccount: '1100 - النقدية وما في حكمها', level: 'مستوى 4', status: 'نشط' },
    { code: '1104', name: 'العهد النقدية المستديمة للموظفين', type: 'أصول متداولة', nature: 'مدين', parentAccount: '1100 - النقدية وما في حكمها', level: 'مستوى 4', status: 'نشط' },
    { code: '1201', name: 'ذمم العملاء التجارية - قطاع الشركات', type: 'أصول متداولة', nature: 'مدين', parentAccount: '1200 - العملاء والمدينون', level: 'مستوى 4', status: 'نشط' },
    { code: '1202', name: 'ذمم العملاء - قطاع التجزئة والأفراد', type: 'أصول متداولة', nature: 'مدين', parentAccount: '1200 - العملاء والمدينون', level: 'مستوى 4', status: 'نشط' },
    { code: '1203', name: 'أوراق القبض (شيكات برسم التحصيل)', type: 'أصول متداولة', nature: 'مدين', parentAccount: '1200 - العملاء والمدينون', level: 'مستوى 4', status: 'نشط' },
    { code: '1209', name: 'مخصص الديون المشكوك في تحصيلها (ECL)', type: 'أصول متداولة', nature: 'دائن', parentAccount: '1200 - مخصصات الذمم المدينة', level: 'مستوى 4', status: 'نشط' },
    { code: '1301', name: 'مخزون البضاعة التامة بغرض البيع', type: 'أصول متداولة', nature: 'مدين', parentAccount: '1300 - المخزون السلعي', level: 'مستوى 4', status: 'نشط' },
    { code: '1302', name: 'بضاعة بالطريق واعتمادات مستندية', type: 'أصول متداولة', nature: 'مدين', parentAccount: '1300 - المخزون السلعي', level: 'مستوى 4', status: 'نشط' },
    { code: '1401', name: 'مصروفات تشغيلية مدفوعة مقدماً (إيجارات وتأمينات)', type: 'أصول متداولة', nature: 'مدين', parentAccount: '1400 - أرصدة مدينة أخرى', level: 'مستوى 4', status: 'نشط' },
    { code: '1402', name: 'إيرادات مستحقة القبض غير مفوترة', type: 'أصول متداولة', nature: 'مدين', parentAccount: '1400 - أرصدة مدينة أخرى', level: 'مستوى 4', status: 'نشط' },

    // 2. الأصول غير المتداولة
    { code: '1501', name: 'الأراضي والمباني الإدارية', type: 'أصول غير متداولة', nature: 'مدين', parentAccount: '1500 - الأصول الثابتة الملموسة', level: 'مستوى 4', status: 'نشط' },
    { code: '1502', name: 'الآلات ومعدات المستودعات والتشغيل', type: 'أصول غير متداولة', nature: 'مدين', parentAccount: '1500 - الأصول الثابتة الملموسة', level: 'مستوى 4', status: 'نشط' },
    { code: '1503', name: 'أسطول سيارات النقل والتوزيع', type: 'أصول غير متداولة', nature: 'مدين', parentAccount: '1500 - الأصول الثابتة الملموسة', level: 'مستوى 4', status: 'نشط' },
    { code: '1504', name: 'أجهزة الحاسب الآلي وتجهيزات تقنية المعلومات', type: 'أصول غير متداولة', nature: 'مدين', parentAccount: '1500 - الأصول الثابتة الملموسة', level: 'مستوى 4', status: 'نشط' },
    { code: '1509', name: 'مجمع الإهلاك المتراكم للأصول الثابتة', type: 'أصول غير متداولة', nature: 'دائن', parentAccount: '1500 - مجمعات الاستهلاك', level: 'مستوى 4', status: 'نشط' },
    { code: '1601', name: 'أصول غير ملموسة (برمجيات ورخص سحابية)', type: 'أصول غير متداولة', nature: 'مدين', parentAccount: '1600 - الأصول غير الملموسة', level: 'مستوى 4', status: 'نشط' },

    // 3. الخصوم المتداولة
    { code: '2101', name: 'ذمم الموردين التجارية المحليين', type: 'خصوم متداولة', nature: 'دائن', parentAccount: '2100 - الموردون والدائنون', level: 'مستوى 4', status: 'نشط' },
    { code: '2102', name: 'ذمم الموردين الخارجيين - استيراد', type: 'خصوم متداولة', nature: 'دائن', parentAccount: '2100 - الموردون والدائنون', level: 'مستوى 4', status: 'نشط' },
    { code: '2103', name: 'أوراق الدفع وشيكات مؤجلة الصرف', type: 'خصوم متداولة', nature: 'دائن', parentAccount: '2100 - الموردون والدائنون', level: 'مستوى 4', status: 'نشط' },
    { code: '2201', name: 'ضريبة القيمة المضافة المستحقة للإقرار (ZATCA)', type: 'خصوم متداولة', nature: 'دائن', parentAccount: '2200 - الالتزامات والضرائب الحكومية', level: 'مستوى 4', status: 'نشط' },
    { code: '2202', name: 'مستحقات المؤسسة العامة للتأمينات الاجتماعية (GOSI)', type: 'خصوم متداولة', nature: 'دائن', parentAccount: '2200 - الالتزامات والضرائب الحكومية', level: 'مستوى 4', status: 'نشط' },
    { code: '2301', name: 'رواتب وأجور وبدلات مستحقة الصرف', type: 'خصوم متداولة', nature: 'دائن', parentAccount: '2300 - أرصدة دائنة ومستحقات أخرى', level: 'مستوى 4', status: 'نشط' },
    { code: '2302', name: 'إيرادات خدمات مقبوضة مقدماً (غير مكتسبة)', type: 'خصوم متداولة', nature: 'دائن', parentAccount: '2300 - أرصدة دائنة ومستحقات أخرى', level: 'مستوى 4', status: 'نشط' },

    // 4. الخصوم غير المتداولة
    { code: '2501', name: 'مخصص مكافأة نهاية الخدمة للموظفين (IFRS-19)', type: 'خصوم غير متداولة', nature: 'دائن', parentAccount: '2500 - مخصصات والتزامات طويلة الأجل', level: 'مستوى 4', status: 'نشط' },
    { code: '2601', name: 'تسهيلات وتمويلات بنكية إسلامية طويلة الأجل', type: 'خصوم غير متداولة', nature: 'دائن', parentAccount: '2600 - تمويل وقروض بنكية', level: 'مستوى 4', status: 'نشط' },

    // 5. حقوق الملكية
    { code: '3101', name: 'رأس المال الأساسي المصرح والمدفوع', type: 'حقوق ملكية', nature: 'دائن', parentAccount: '3100 - رأس المال', level: 'مستوى 4', status: 'نشط' },
    { code: '3201', name: 'الاحتياطي النظامي الإلزامي (10%)', type: 'حقوق ملكية', nature: 'دائن', parentAccount: '3200 - الاحتياطيات القانونية', level: 'مستوى 4', status: 'نشط' },
    { code: '3301', name: 'الأرباح (أو الخسائر) المبقاة والمدورة', type: 'حقوق ملكية', nature: 'دائن', parentAccount: '3300 - الأرباح المبقاة', level: 'مستوى 4', status: 'نشط' },
    { code: '3401', name: 'جاري الشركاء / مسحوبات أصحاب المنشأة', type: 'حقوق ملكية', nature: 'مدين', parentAccount: '3400 - الحسابات الجارية للشركاء', level: 'مستوى 4', status: 'نشط' },

    // 6. الإيرادات
    { code: '4101', name: 'إيرادات مبيعات البضائع والمنتجات الرئيسية', type: 'إيرادات', nature: 'دائن', parentAccount: '4100 - إيرادات النشاط الرئيسي', level: 'مستوى 4', status: 'نشط' },
    { code: '4102', name: 'إيرادات تقديم الخدمات الاستشارية والصيانة', type: 'إيرادات', nature: 'دائن', parentAccount: '4100 - إيرادات النشاط الرئيسي', level: 'مستوى 4', status: 'نشط' },
    { code: '4201', name: 'خصم مسموح به ومردودات ومسموحات المبيعات', type: 'إيرادات', nature: 'مدين', parentAccount: '4200 - تسويات وخصومات المبيعات', level: 'مستوى 4', status: 'نشط' },
    { code: '4301', name: 'إيرادات أرباح الودائع البنكية والمرابحات', type: 'إيرادات', nature: 'دائن', parentAccount: '4300 - إيرادات أخرى غير تشغيلية', level: 'مستوى 4', status: 'نشط' },
    { code: '4302', name: 'أرباح فروق تسوية أسعار صرف العملات الأجنبية', type: 'إيرادات', nature: 'دائن', parentAccount: '4300 - إيرادات أخرى غير تشغيلية', level: 'مستوى 4', status: 'نشط' },

    // 7. تكلفة النشاط والمصروفات
    { code: '5101', name: 'تكلفة البضاعة المباعة (COGS)', type: 'مصروفات', nature: 'مدين', parentAccount: '5100 - تكلفة الإيرادات والإنتاج', level: 'مستوى 4', status: 'نشط' },
    { code: '5102', name: 'تكاليف الشحن والنقل للمشتريات (Freight In)', type: 'مصروفات', nature: 'مدين', parentAccount: '5100 - تكلفة الإيرادات والإنتاج', level: 'مستوى 4', status: 'نشط' },
    { code: '5201', name: 'مصروفات الرواتب والأجور والبدلات الشهرية', type: 'مصروفات', nature: 'مدين', parentAccount: '5200 - المصروفات الإدارية والعمومية', level: 'مستوى 4', status: 'نشط' },
    { code: '5202', name: 'مصروفات إيجارات المكاتب والمستودعات', type: 'مصروفات', nature: 'مدين', parentAccount: '5200 - المصروفات الإدارية والعمومية', level: 'مستوى 4', status: 'نشط' },
    { code: '5203', name: 'مصروفات الاتصالات والإنترنت والاشتراكات السحابية', type: 'مصروفات', nature: 'مدين', parentAccount: '5200 - المصروفات الإدارية والعمومية', level: 'مستوى 4', status: 'نشط' },
    { code: '5204', name: 'مصروفات استهلاك الأصول الثابتة وإطفاء البرمجيات', type: 'مصروفات', nature: 'مدين', parentAccount: '5200 - المصروفات الإدارية والعمومية', level: 'مستوى 4', status: 'نشط' },
    { code: '5301', name: 'مصروفات الحملات التسويقية والإعلانات الرقمية', type: 'مصروفات', nature: 'مدين', parentAccount: '5300 - المصاريف البيعية والتسويقية', level: 'مستوى 4', status: 'نشط' },
    { code: '5302', name: 'عمولات وكلاء ومناديب المبيعات', type: 'مصروفات', nature: 'مدين', parentAccount: '5300 - المصاريف البيعية والتسويقية', level: 'مستوى 4', status: 'نشط' },
    { code: '5401', name: 'المصروفات والعمولات البنكية ورسوم بوابات الدفع', type: 'مصروفات', nature: 'مدين', parentAccount: '5400 - أعباء تمويلية وبنكية', level: 'مستوى 4', status: 'نشط' },
  ],
  analyticAccounts: [
    // 1. مراكز تكلفة إدارية وخدمية
    { code: 'CC-101', name: 'الإدارة التنفيذية العليا', type: 'مركز تكلفة إداري', dimension: 'الإدارات والأقسام', budget: '350,000 ر.س', manager: 'م. خالد المنصور', status: 'نشط' },
    { code: 'CC-102', name: 'إدارة الموارد البشرية والشؤون الإدارية', type: 'مركز تكلفة إداري', dimension: 'الإدارات والأقسام', budget: '180,000 ر.س', manager: 'أ. سارة الشمري', status: 'نشط' },
    { code: 'CC-103', name: 'إدارة الشؤون المالية والمحاسبة والمراجعة', type: 'مركز تكلفة إداري', dimension: 'الإدارات والأقسام', budget: '220,000 ر.س', manager: 'أ. أحمد رضوان', status: 'نشط' },
    { code: 'CC-104', name: 'إدارة تقنية المعلومات والتحول الرقمي', type: 'مركز تكلفة إداري', dimension: 'الإدارات والأقسام', budget: '450,000 ر.س', manager: 'م. فيصل العتيبي', status: 'نشط' },
    { code: 'CC-105', name: 'قسم الدعم الفني وخدمة العملاء', type: 'مركز تكلفة تشغيلي', dimension: 'الإدارات والأقسام', budget: '160,000 ر.س', manager: 'أ. نورة القحطاني', status: 'نشط' },

    // 2. مراكز ربحية ومنافذ وفروع بيعية
    { code: 'PC-201', name: 'مركز مبيعات فرع الرياض الرئيسي', type: 'مركز ربحية', dimension: 'الفروع والأقاليم', budget: '2,500,000 ر.س', manager: 'أ. تركي القحطاني', status: 'نشط' },
    { code: 'PC-202', name: 'مركز مبيعات فرع جدة والمنطقة الغربية', type: 'مركز ربحية', dimension: 'الفروع والأقاليم', budget: '1,800,000 ر.س', manager: 'أ. وائل السالم', status: 'نشط' },
    { code: 'PC-203', name: 'مركز مبيعات فرع الدمام والمنطقة الشرقية', type: 'مركز ربحية', dimension: 'الفروع والأقاليم', budget: '1,400,000 ر.س', manager: 'أ. حسام الغامدي', status: 'نشط' },
    { code: 'PC-204', name: 'منصة التجارة الإلكترونية والتوزيع السريع', type: 'مركز ربحية', dimension: 'الفروع والأقاليم', budget: '900,000 ر.س', manager: 'م. ريان الشهري', status: 'نشط' },

    // 3. مشاريع وعقود تعاقدية
    { code: 'PRJ-301', name: 'مشروع توريد وتجهيز حلول المستشفيات (عقد 44)', type: 'مشروع تعاقدي', dimension: 'المشاريع والعقود', budget: '1,250,000 ر.س', manager: 'م. عماد الفهد', status: 'نشط' },
    { code: 'PRJ-302', name: 'مشروع رقمنة الأرشيف السحابي الداخلي', type: 'مشروع تعاقدي', dimension: 'المشاريع والعقود', budget: '280,000 ر.س', manager: 'م. فيصل العتيبي', status: 'مكتمل' },
    { code: 'PRJ-303', name: 'توسعة وتجهيز المستودع اللوجستي المركزي الجديد', type: 'مشروع تعاقدي', dimension: 'المشاريع والعقود', budget: '750,000 ر.س', manager: 'م. وليد الصالح', status: 'قيد الإنشاء' },

    // 4. أصول متتبعة وأسطول تشغيلي
    { code: 'AST-401', name: 'شاحنة النقل الثقيل المبردة (أ ب ج 5521)', type: 'أصل ثابت متتبع', dimension: 'الأصول والأسطول', budget: '85,000 ر.س', manager: 'مشرف الحركة والنقل', status: 'نشط' },
    { code: 'AST-402', name: 'مركبة التوزيع السريع للمدن (د هـ و 3312)', type: 'أصل ثابت متتبع', dimension: 'الأصول والأسطول', budget: '60,000 ر.س', manager: 'مشرف الحركة والنقل', status: 'نشط' },
    { code: 'AST-403', name: 'خط التغليف الآلي ومعدات المستودع المركزي', type: 'أصل ثابت متتبع', dimension: 'الأصول والأسطول', budget: '120,000 ر.س', manager: 'مهندس الصيانة', status: 'نشط' },

    // 5. حملات وفعاليات تسويقية
    { code: 'MKT-501', name: 'حملة التسويق الرقمي والمؤتمرات السنوية', type: 'فعالية/حملة تسويقية', dimension: 'الإدارات والأقسام', budget: '140,000 ر.س', manager: 'أ. هند العمري', status: 'نشط' },
  ],
  entities: [
    { code: 'EN01', name: 'شركة التوريدات العالمية', type: 'مورد' },
    { code: 'EN02', name: 'مؤسسة الأفق للتجارة', type: 'عميل' },
    { code: 'EN03', name: 'خالد عبدالعزيز', type: 'فرد/عميل' },
  ],
};

export default function MasterDatabaseSettings() {
  const [dbData, setDbData] = useState<any>(() => {
    try {
      const raw = localStorage.getItem('alpha_master_database_settings_v1');
      if (raw) return JSON.parse(raw);
    } catch {}
    return INITIAL_MOCK_DATA;
  });

  useEffect(() => {
    const handleSync = () => {
      try {
        const raw = localStorage.getItem('alpha_master_database_settings_v1');
        if (raw) {
          setDbData(JSON.parse(raw));
        } else {
          setDbData(INITIAL_MOCK_DATA);
        }
      } catch {
        setDbData(INITIAL_MOCK_DATA);
      }
    };

    window.addEventListener('alpha-master-data-updated', handleSync);
    window.addEventListener('alpha-system-reset-completed', handleSync);
    window.addEventListener('alpha-data-changed', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('alpha-master-data-updated', handleSync);
      window.removeEventListener('alpha-system-reset-completed', handleSync);
      window.removeEventListener('alpha-data-changed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  useEffect(() => {
    if (dbData) {
      try {
        localStorage.setItem('alpha_master_database_settings_v1', JSON.stringify(dbData));
      } catch {}
    }
  }, [dbData]);

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
    setDbData((prev: any) => ({
      ...prev,
      [activeCategory]: prev[activeCategory].filter((x: any) => x.code !== itemToDelete)
    }));
    setItemToDelete(null);
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeCategory) return;
    
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    setDbData((prev: any) => {
      const catData = [...prev[activeCategory]];
      if (editingItem) {
        const idx = catData.findIndex(x => x.code === editingItem.code);
        if (idx >= 0) catData[idx] = data;
      } else {
        catData.push(data);
      }
      return { ...prev, [activeCategory]: catData };
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
              readOnly={!!editingItem} // Cannot edit code for existing item
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

        {/* الحقول المتقدمة للحسابات الفرعية */}
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

        {/* الحقول المتقدمة للحسابات التحليلية ومراكز التكلفة */}
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
                placeholder="مثال: م. أحمد المنصور" 
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
                  <p className="text-xs text-slate-500 font-medium">إدارة وتعديل السجلات في هذه القاعدة</p>
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

