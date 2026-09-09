export type Language = 'ar' | 'en';

export interface TranslationDictionary {
  [key: string]: {
    ar: string;
    en: string;
  };
}

export const translations: TranslationDictionary = {
  // App Branding
  appName: {
    ar: 'لوجوستريا',
    en: 'Logustria',
  },
  appSubtitle: {
    ar: 'لوجوستريا للمحاسبة والأنظمة المالية',
    en: 'Logustria ERP & Financial Systems',
  },
  appTagline: {
    ar: 'النظام المالي والمحاسبي المتكامل',
    en: 'Enterprise Financial & Accounting ERP',
  },
  mainBranch: {
    ar: 'الفرع الرئيسي',
    en: 'Main Branch',
  },
  fiscalYearLabel: {
    ar: 'السنة المالية',
    en: 'Fiscal Year',
  },
  yearOpen: {
    ar: 'مفتوحة',
    en: 'Open',
  },
  yearClosed: {
    ar: 'مغلقة',
    en: 'Closed',
  },
  systemMenu: {
    ar: 'قائمة النظام المحاسبي',
    en: 'ERP Navigation Menu',
  },
  systemSettingsBtn: {
    ar: 'إعدادات النظام',
    en: 'System Settings',
  },
  homeOverview: {
    ar: 'الواجهة الرئيسية (بيانات الشركة)',
    en: 'Main Overview (Company Profile)',
  },
  backToOverview: {
    ar: 'العودة إلى الواجهة الرئيسية (بيانات الشركة)',
    en: 'Back to Main Overview (Company Profile)',
  },
  goToDashboard: {
    ar: 'الانتقال إلى لوحة المؤشرات المالية',
    en: 'Go to Financial Dashboard',
  },
  dashboardTitle: {
    ar: 'لوحة المؤشرات',
    en: 'Dashboard',
  },

  // Navigation Groups & Items
  nav_general: {
    ar: 'الرئيسية وبيانات المنشأة',
    en: 'Overview & Company Profile',
  },
  nav_companyProfile: {
    ar: 'الواجهة الرئيسية (بيانات الشركة)',
    en: 'Company Profile & Info',
  },
  nav_dashboard: {
    ar: 'لوحة المؤشرات المالية',
    en: 'Financial Dashboard',
  },
  nav_generalAccounting: {
    ar: 'المحاسبة العامة',
    en: 'General Ledger',
  },
  nav_journal: {
    ar: 'القيود اليومية',
    en: 'Journal Entries',
  },
  nav_trialBalance: {
    ar: 'ميزان المراجعة',
    en: 'Trial Balance',
  },
  nav_salesGroup: {
    ar: 'العملاء والمبيعات والتقسيط',
    en: 'Sales, Clients & Installments',
  },
  nav_customers: {
    ar: 'إدارة العملاء',
    en: 'Customer Management',
  },
  nav_sales: {
    ar: 'فواتير المبيعات',
    en: 'Sales Invoices',
  },
  nav_installments: {
    ar: 'التقسيط والكمبيالات والسندات',
    en: 'Installments & Promissory Notes',
  },
  nav_purchasesGroup: {
    ar: 'الموردون والمشتريات',
    en: 'Vendors & Purchasing',
  },
  nav_vendors: {
    ar: 'إدارة الموردين',
    en: 'Vendor Management',
  },
  nav_purchases: {
    ar: 'فواتير المشتريات',
    en: 'Purchase Invoices',
  },
  nav_balancesGroup: {
    ar: 'الأرصدة والذمم المالية',
    en: 'Partner & Financial Balances',
  },
  nav_partnerBalances: {
    ar: 'أرصدة العملاء والموردين',
    en: 'Customer & Vendor Balances',
  },
  nav_inventoryGroup: {
    ar: 'المخزون والتصنيع والأصناف',
    en: 'Inventory, Manufacturing & Items',
  },
  nav_warehouseBalances: {
    ar: 'أرصدة المخزن',
    en: 'Warehouse Stock Balances',
  },
  nav_items: {
    ar: 'إدارة الأصناف',
    en: 'Item Catalog & Products',
  },
  nav_manufacturing: {
    ar: 'إدارة التصنيع والإنتاج (BOM)',
    en: 'Manufacturing & BOM Orders',
  },
  nav_hrGroup: {
    ar: 'الموارد البشرية والأجور',
    en: 'Human Resources & Payroll',
  },
  nav_payroll: {
    ar: 'الموظفون والأجور والبدلات',
    en: 'Employees, Payroll & Deductions',
  },
  nav_treasuryGroup: {
    ar: 'الخزينة والبنوك',
    en: 'Treasury & Cash Vouchers',
  },
  nav_external: {
    ar: 'سندات خارجية (قبض/صرف)',
    en: 'Receipt & Payment Vouchers',
  },
  nav_internal: {
    ar: 'سندات داخلية (تحويلات)',
    en: 'Internal Transfer Vouchers',
  },
  nav_adminGroup: {
    ar: 'الإدارة والنظام',
    en: 'System Administration',
  },
  nav_settings: {
    ar: 'إعدادات النظام',
    en: 'System & Company Settings',
  },

  // Mobile Bottom Navigation
  mob_company: {
    ar: 'المنشأة',
    en: 'Company',
  },
  mob_dashboard: {
    ar: 'المؤشرات',
    en: 'Dashboard',
  },
  mob_journal: {
    ar: 'القيود',
    en: 'Journal',
  },
  mob_sales: {
    ar: 'المبيعات',
    en: 'Sales',
  },
  mob_warehouse: {
    ar: 'المخزن',
    en: 'Stock',
  },
  mob_more: {
    ar: 'المزيد',
    en: 'More',
  },

  // Common UI Actions
  save: {
    ar: 'حفظ',
    en: 'Save',
  },
  cancel: {
    ar: 'إلغاء',
    en: 'Cancel',
  },
  delete: {
    ar: 'حذف',
    en: 'Delete',
  },
  edit: {
    ar: 'تعديل',
    en: 'Edit',
  },
  search: {
    ar: 'بحث...',
    en: 'Search...',
  },
  print: {
    ar: 'طباعة',
    en: 'Print',
  },
  preview: {
    ar: 'معاينة',
    en: 'Preview',
  },
  exportPdf: {
    ar: 'تصدير PDF',
    en: 'Export PDF',
  },
  exportExcel: {
    ar: 'تصدير Excel',
    en: 'Export Excel',
  },
  filter: {
    ar: 'تصفية',
    en: 'Filter',
  },
  all: {
    ar: 'الكل',
    en: 'All',
  },
  close: {
    ar: 'إغلاق',
    en: 'Close',
  },
  addNew: {
    ar: 'إضافة جديد',
    en: 'Add New',
  },
  actions: {
    ar: 'الإجراءات',
    en: 'Actions',
  },
  status: {
    ar: 'الحالة',
    en: 'Status',
  },
  date: {
    ar: 'التاريخ',
    en: 'Date',
  },
  amount: {
    ar: 'المبلغ',
    en: 'Amount',
  },
  debit: {
    ar: 'مدين',
    en: 'Debit',
  },
  credit: {
    ar: 'دائن',
    en: 'Credit',
  },
  balance: {
    ar: 'الرصيد',
    en: 'Balance',
  },
  total: {
    ar: 'الإجمالي',
    en: 'Total',
  },
  subtotal: {
    ar: 'المجموع الفرعي',
    en: 'Subtotal',
  },
  taxVat: {
    ar: 'ضريبة القيمة المضافة',
    en: 'VAT (Tax)',
  },
  discount: {
    ar: 'الخصم',
    en: 'Discount',
  },
  netTotal: {
    ar: 'الصافي النهائي',
    en: 'Net Total',
  },
  quantity: {
    ar: 'الكمية',
    en: 'Quantity',
  },
  unitPrice: {
    ar: 'سعر الوحدة',
    en: 'Unit Price',
  },
  itemDescription: {
    ar: 'بيان الصنف / الوصف',
    en: 'Item Description',
  },
  notes: {
    ar: 'ملاحظات',
    en: 'Notes',
  },
  currency: {
    ar: 'ر.س',
    en: 'SAR',
  },
  customer: {
    ar: 'العميل',
    en: 'Customer',
  },
  vendor: {
    ar: 'المورد',
    en: 'Vendor',
  },
  invoiceNo: {
    ar: 'رقم الفاتورة',
    en: 'Invoice #',
  },
  itemCount: {
    ar: 'عدد البنود',
    en: 'Items Count',
  },
  itemRowNumber: {
    ar: 'رقم الصنف',
    en: 'Row #',
  },
  deleteItemBtn: {
    ar: 'حذف الصنف',
    en: 'Delete Line',
  },
  addItemBtn: {
    ar: 'إضافة بند جديد للفاتورة',
    en: 'Add New Line Item',
  },
  switchLanguage: {
    ar: 'تغيير اللغة إلى English',
    en: 'Switch language to العربية',
  },
  languageName: {
    ar: 'العربية',
    en: 'English',
  },
  autoSystemGenerated: {
    ar: 'تم استخراج هذا المستند إلكترونياً من نظام لوجوستريا المحاسبي المتكامل',
    en: 'This document was automatically generated by Logustria ERP System',
  },
};
