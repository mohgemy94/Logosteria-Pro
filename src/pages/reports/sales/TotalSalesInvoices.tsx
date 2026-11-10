import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar, 
  Users, 
  Search, 
  Printer, 
  FileSpreadsheet, 
  FileText, 
  RotateCcw, 
  DollarSign, 
  ArrowRight, 
  ArrowLeft,
  Filter,
  CheckCircle2,
  FileBarChart,
  UserCheck,
  CheckCircle,
  Clock,
  Wallet,
  AlertCircle,
  CreditCard,
  Receipt,
  Banknote,
  Scale,
  Landmark,
  Warehouse,
  Briefcase
} from 'lucide-react';
import { supabase } from '../../../services/supabaseClient';
import { loadCustomers } from '../../../utils/partnerLedger';
import { exportToXLSX, exportToPDF } from '../../../utils/universalExport';
import { useSystemCurrency } from '../../../utils/currency';
import { useLanguage } from '../../../i18n/LanguageContext';
import { getUnifiedSalesInvoices, getDynamicSalesRepsList, doesInvoiceMatchSalesRep } from '../../../utils/salesReportsUnifiedStore';
import { loadChartOfAccounts } from '../../../utils/trialBalanceStore';
import { isCashOrBankAccount } from '../../../utils/accountingIntegration';
import { getDynamicWarehousesList, getWarehouseLabel } from '../../../utils/itemsStore';

interface TotalSalesInvoicesProps {
  onNavigate?: (view: string | null) => void;
}

interface CustomerOption {
  id: string;
  name: string;
  code?: string;
  phone?: string;
}

export const TotalSalesInvoices: React.FC<TotalSalesInvoicesProps> = ({ onNavigate }) => {
  const { symbol: currencySymbol } = useSystemCurrency();
  const { language, isRtl } = useLanguage();
  const reportRef = useRef<HTMLDivElement>(null);

  const todayStr = new Date().toISOString().substring(0, 10);
  
  // حقول الفلترة الزمنية
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // أول الشهر الحالي افتراضياً
    return d.toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(todayStr);
  
  // الفلتر 1: العميل (Customer Filter)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('ALL');
  const [customersList, setCustomersList] = useState<CustomerOption[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');

  // الفلتر 2: حالة الفاتورة وحالة السداد (Invoice & Payment Status Filter)
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // الفلتر 3: نوع الفاتورة وطريقة التعامل (Invoice Type & Payment Method Filter)
  const [selectedInvoiceType, setSelectedInvoiceType] = useState<string>('ALL');

  // الفلتر 4: نطاق مبلغ الفاتورة (Invoice Amount Range Filter)
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  
  // الفلتر 5: التصنيف الضريبي والمالي (Tax Classification Filter)
  const [selectedClassification, setSelectedClassification] = useState<string>('ALL');
  
  // الفلتر 6: خزينة التحصيل والحساب المالي (Safe & Treasury Filter)
  const [selectedSafe, setSelectedSafe] = useState<string>('ALL');
  
  // الفلتر 7: مستودع التوريد والفرع (Warehouse & Branch Filter)
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  
  // الفلتر 8: نوع الخدمة والنشاط (Service Type & Business Activity Filter)
  const [selectedServiceType, setSelectedServiceType] = useState<string>('ALL');
  
  // الفلتر 9: مندوب المبيعات / منشئ الفاتورة (Sales Rep & Creator Filter)
  const [selectedSalesRep, setSelectedSalesRep] = useState<string>('ALL');
  
  // البيانات والحالة
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // تحميل قائمة العملاء من قاعدة البيانات والتخزين المحلي
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const localCustomers = loadCustomers();
        const mappedLocal: CustomerOption[] = (localCustomers || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          code: c.code || '',
          phone: c.phone || ''
        }));

        // محاولة جلب العملاء من Supabase
        const { data, error } = await supabase
          .from('customers')
          .select('id, name, code, phone')
          .order('name');

        if (!error && data && data.length > 0) {
          const mergedMap = new Map<string, CustomerOption>();
          (mappedLocal || []).forEach(c => mergedMap.set(c.id, c));
          (data || []).forEach(c => mergedMap.set(c.id, { id: c.id, name: c.name, code: c.code || '', phone: c.phone || '' }));
          setCustomersList(Array.from(mergedMap.values()));
        } else {
          // بديل: فحص جدول partners إذا كان موجوداً
          const { data: partnersData } = await supabase
            .from('partners')
            .select('id, name, code, phone')
            .eq('type', 'CUSTOMER')
            .order('name');

          if (partnersData && partnersData.length > 0) {
            const mergedMap = new Map<string, CustomerOption>();
            (mappedLocal || []).forEach(c => mergedMap.set(c.id, c));
            (partnersData || []).forEach(c => mergedMap.set(c.id, { id: c.id, name: c.name, code: c.code || '', phone: c.phone || '' }));
            setCustomersList(Array.from(mergedMap.values()));
          } else {
            setCustomersList(mappedLocal);
          }
        }
      } catch (err) {
        console.warn('Error loading customers:', err);
        const fallback = loadCustomers();
        setCustomersList(fallback.map((c: any) => ({ id: c.id, name: c.name, code: c.code, phone: c.phone })));
      }
    };

    fetchCustomers();
  }, []);

  // اسم العميل المحدد حالياً
  const selectedCustomerObj = useMemo(() => {
    if (selectedCustomerId === 'ALL') return null;
    return customersList.find(c => c.id === selectedCustomerId) || null;
  }, [selectedCustomerId, customersList]);

  // تسمية الحالة المحددة حالياً
  const selectedStatusLabel = useMemo(() => {
    switch (selectedStatus) {
      case 'POSTED': return language === 'ar' ? 'فواتير مرحلة ومعتمدة' : 'Posted Invoices';
      case 'DRAFT': return language === 'ar' ? 'مسودات غير مرحلة' : 'Draft Invoices';
      case 'PAID': return language === 'ar' ? 'مسددة بالكامل' : 'Fully Paid';
      case 'PARTIALLY_PAID': return language === 'ar' ? 'مسددة جزئياً' : 'Partially Paid';
      case 'UNPAID': return language === 'ar' ? 'غير مسددة / آجلة' : 'Unpaid / Pending';
      default: return null;
    }
  }, [selectedStatus, language]);

  // تسمية نوع الفاتورة المحدد حالياً
  const selectedInvoiceTypeLabel = useMemo(() => {
    switch (selectedInvoiceType) {
      case 'CASH_SALES': return language === 'ar' ? 'مبيعات نقدية (كاش)' : 'Cash Sales';
      case 'CREDIT_SALES': return language === 'ar' ? 'مبيعات آجلة (ذمم)' : 'Credit Sales';
      case 'PARTIAL_SALES': return language === 'ar' ? 'مبيعات دفع جزئي' : 'Partial Sales';
      case 'RETURNS': return language === 'ar' ? 'مرتجعات المبيعات' : 'Sales Returns';
      case 'QUOTATION': return language === 'ar' ? 'عروض أسعار' : 'Quotations';
      default: return null;
    }
  }, [selectedInvoiceType, language]);

  // تسمية التصنيف الضريبي المحدد حالياً
  const selectedClassificationLabel = useMemo(() => {
    switch (selectedClassification) {
      case 'TAX': return language === 'ar' ? 'فواتير ضريبية (VAT)' : 'Tax Invoices (VAT)';
      case 'NORMAL': return language === 'ar' ? 'فواتير عادية / مبسطة' : 'Simplified / Non-Tax';
      default: return null;
    }
  }, [selectedClassification, language]);

  const cashBankOptions = useMemo(() => {
    const chart = loadChartOfAccounts();
    const list = chart.filter(a => isCashOrBankAccount(a, chart));
    return list.map(a => ({ id: a.code || a.id, label: `${a.code} - ${a.name}`, name: a.name }));
  }, []);

  const dynamicWarehouses = useMemo(() => {
    return getDynamicWarehousesList([selectedSource !== 'ALL' ? selectedSource : '']);
  }, [selectedSource]);

  // تسمية خزينة التحصيل المحددة حالياً
  const selectedSafeLabel = useMemo(() => {
    if (selectedSafe === 'ALL') return null;
    const found = cashBankOptions.find(a => a.id === selectedSafe);
    if (found) return found.label;
    if (selectedSafe === 'MAIN_SAFE' || selectedSafe === '1101') return language === 'ar' ? 'الصندوق الرئيسي (1101)' : 'Main Safe (1101)';
    if (selectedSafe === 'BANK_AHLI' || selectedSafe === '1102') return language === 'ar' ? 'الحساب البنكي (1102)' : 'Bank Account (1102)';
    return selectedSafe;
  }, [selectedSafe, language, cashBankOptions]);

  // تنسيق بيانات الخزينة للعرض
  const formatSafeInfo = (safeKey?: string) => {
    if (!safeKey || safeKey === 'MAIN_SAFE' || safeKey === '1101') {
      const found1101 = cashBankOptions.find(a => a.id === '1101');
      return { labelAr: found1101?.name || 'الصندوق الرئيسي', labelEn: 'Main Safe', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    }
    const found = cashBankOptions.find(a => a.id === safeKey || a.name === safeKey);
    if (found) {
      return { labelAr: found.name, labelEn: found.name, color: 'bg-teal-50 text-teal-800 border-teal-200' };
    }
    const s = safeKey.toUpperCase();
    if (s.includes('AHLI') || s.includes('أهلي') || s === '1102') {
      return { labelAr: 'الحساب البنكي', labelEn: 'Bank Account', color: 'bg-teal-50 text-teal-800 border-teal-200' };
    }
    return { labelAr: safeKey, labelEn: safeKey, color: 'bg-slate-100 text-slate-700 border-slate-200' };
  };

  // تسمية مستودع التوريد المحدد حالياً
  const selectedSourceLabel = useMemo(() => {
    if (selectedSource === 'ALL') return null;
    return getWarehouseLabel(selectedSource);
  }, [selectedSource]);

  // تنسيق بيانات مستودع التوريد والفرع للعرض
  const formatSourceInfo = (sourceKey?: string) => {
    const label = getWarehouseLabel(sourceKey);
    if (!sourceKey || sourceKey === 'MAIN_WAREHOUSE') {
      return { labelAr: label, labelEn: 'Main Warehouse', color: 'bg-cyan-50 text-cyan-800 border-cyan-200' };
    }
    return { labelAr: label, labelEn: label, color: 'bg-violet-50 text-violet-800 border-violet-200' };
  };

  // تسمية نوع الخدمة والنشاط المحدد حالياً
  const selectedServiceTypeLabel = useMemo(() => {
    switch (selectedServiceType) {
      case 'NONE': return language === 'ar' ? 'مبيعات منتجات / بدون خدمة' : 'Goods / Non-Service';
      case 'استشارات': return language === 'ar' ? 'خدمات استشارية' : 'Consulting';
      case 'تصميم': return language === 'ar' ? 'خدمات تصميم' : 'Design';
      case 'برمجة': return language === 'ar' ? 'برمجة وحلول تقنية' : 'Software & IT';
      case 'صيانة': return language === 'ar' ? 'خدمات صيانة' : 'Maintenance';
      case 'تركيب': return language === 'ar' ? 'خدمات تركيب وتجهيز' : 'Installation';
      case 'دعم فني': return language === 'ar' ? 'دعم فني وتقني' : 'Technical Support';
      case 'خدمات عامة': return language === 'ar' ? 'خدمات عامة وتشغيلية' : 'General Services';
      default: return selectedServiceType !== 'ALL' ? selectedServiceType : null;
    }
  }, [selectedServiceType, language]);

  // تنسيق بيانات نوع الخدمة والنشاط للعرض
  const formatServiceTypeInfo = (serviceKey?: string) => {
    if (!serviceKey || serviceKey === 'NONE' || serviceKey === '' || serviceKey === '-- بدون خدمة محددة --') {
      return { labelAr: 'مبيعات منتجات / بدون خدمة', labelEn: 'Goods / None', color: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
    const s = serviceKey.toLowerCase();
    if (s.includes('استشارات') || s.includes('consult')) {
      return { labelAr: 'استشارات', labelEn: 'Consulting', color: 'bg-blue-50 text-blue-800 border-blue-200' };
    }
    if (s.includes('تصميم') || s.includes('design')) {
      return { labelAr: 'تصميم', labelEn: 'Design', color: 'bg-pink-50 text-pink-800 border-pink-200' };
    }
    if (s.includes('برمج') || s.includes('software') || s.includes('code') || s.includes('dev')) {
      return { labelAr: 'برمجة وحلول تقنية', labelEn: 'Software & IT', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
    }
    if (s.includes('صيان') || s.includes('maint')) {
      return { labelAr: 'صيانة', labelEn: 'Maintenance', color: 'bg-amber-50 text-amber-800 border-amber-200' };
    }
    if (s.includes('تركيب') || s.includes('install')) {
      return { labelAr: 'تركيب وتجهيز', labelEn: 'Installation', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    }
    if (s.includes('دعم') || s.includes('support')) {
      return { labelAr: 'دعم فني', labelEn: 'Tech Support', color: 'bg-cyan-50 text-cyan-800 border-cyan-200' };
    }
    if (s.includes('خدمات عامة') || s.includes('general')) {
      return { labelAr: 'خدمات عامة', labelEn: 'General Services', color: 'bg-teal-50 text-teal-800 border-teal-200' };
    }
    return { labelAr: serviceKey, labelEn: serviceKey, color: 'bg-purple-50 text-purple-800 border-purple-200' };
  };

  const salesRepsList = useMemo(() => getDynamicSalesRepsList(), []);

  // تسمية مندوب المبيعات المحدد حالياً
  const selectedSalesRepLabel = useMemo(() => {
    if (selectedSalesRep === 'ALL') return null;
    const found = salesRepsList.find(r => r.id === selectedSalesRep);
    return found ? found.label : selectedSalesRep;
  }, [selectedSalesRep, salesRepsList]);

  // تنسيق بيانات مندوب المبيعات للعرض
  const formatSalesRepInfo = (repName?: string) => {
    if (!repName || repName === 'GENERAL_REP' || repName === 'فني المبيعات العام' || repName === 'المبيعات العامة' || repName === 'مندوب المبيعات العام') {
      return { labelAr: 'مندوب المبيعات العام', labelEn: 'General Sales Rep', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
    return { labelAr: repName, labelEn: repName, color: 'bg-blue-50 text-blue-800 border-blue-200' };
  };

  // تصفية قائمة العملاء المعروضة داخل القائمة المنسدلة
  const filteredCustomersDropdown = useMemo(() => {
    if (!customerSearchQuery.trim()) return customersList;
    const q = customerSearchQuery.toLowerCase();
    return customersList.filter(c => 
      (c.name || '').toLowerCase().includes(q) || 
      (c.code && (c.code || '').toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  }, [customersList, customerSearchQuery]);

  // تنسيق نوع الفاتورة للعرض
  const formatInvoiceType = (type?: string, paymentStatus?: string) => {
    if (!type && !paymentStatus) return { labelAr: 'مبيعات عامة', labelEn: 'General Sales', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    const t = (type || '').toUpperCase();

    if (t.includes('RETURN') || t.includes('مرتجع')) {
      return { labelAr: 'مرتجع مبيعات', labelEn: 'Sales Return', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: RotateCcw };
    }
    if (t.includes('CREDIT') || t.includes('آجل') || paymentStatus === 'UNPAID') {
      return { labelAr: 'مبيعات آجلة', labelEn: 'Credit Sales', color: 'bg-amber-50 text-amber-800 border-amber-200', icon: CreditCard };
    }
    if (t.includes('PARTIAL') || paymentStatus === 'PARTIAL') {
      return { labelAr: 'مبيعات جزئية', labelEn: 'Partial Sales', color: 'bg-blue-50 text-blue-800 border-blue-200', icon: Receipt };
    }
    if (t.includes('QUOTATION') || t.includes('عرض')) {
      return { labelAr: 'عرض أسعار', labelEn: 'Quotation', color: 'bg-purple-50 text-purple-800 border-purple-200', icon: FileText };
    }
    return { labelAr: 'مبيعات نقدية', labelEn: 'Cash Sales', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: Banknote };
  };

  // تنفيذ البحث والاستعلام مع تطبيق كافة الفلاتر المتقدمة
  const handleSearch = async () => {
    if (!startDate || !endDate) {
      alert(language === 'ar' ? 'يرجى تحديد الفترة الزمنية' : 'Please select a date range');
      return;
    }

    setLoading(true);

    try {
      const allUnified = await getUnifiedSalesInvoices();

      const filtered = allUnified.filter(inv => {
        const invDate = (inv.date || inv.createdAt || '').substring(0, 10);
        if (invDate < startDate || invDate > endDate) return false;

        // فلتر 1: العميل
        if (selectedCustomerId !== 'ALL') {
          const matchId = inv.partnerId === selectedCustomerId;
          const matchName = selectedCustomerObj && (inv.partnerName || '').toLowerCase().includes((selectedCustomerObj.name || '').toLowerCase());
          if (!matchId && !matchName) return false;
        }

        // فلتر 2: الحالة وحالة السداد
        if (selectedStatus === 'POSTED' && inv.statusCode !== 'POSTED') return false;
        if (selectedStatus === 'DRAFT' && inv.statusCode !== 'DRAFT') return false;
        if (selectedStatus === 'PAID' && inv.paymentStatus !== 'PAID') return false;
        if (selectedStatus === 'PARTIALLY_PAID' && inv.paymentStatus !== 'PARTIAL') return false;
        if (selectedStatus === 'UNPAID' && inv.paymentStatus !== 'UNPAID') return false;

        // فلتر 3: نوع الفاتورة وطريقة التعامل
        if (selectedInvoiceType !== 'ALL') {
          const t = (inv.invoiceType || '').toUpperCase();
          if (selectedInvoiceType === 'CASH_SALES' && !t.includes('CASH') && inv.paymentStatus !== 'PAID') return false;
          if (selectedInvoiceType === 'CREDIT_SALES' && !t.includes('CREDIT') && inv.paymentStatus !== 'UNPAID') return false;
          if (selectedInvoiceType === 'PARTIAL_SALES' && !t.includes('PARTIAL') && inv.paymentStatus !== 'PARTIAL') return false;
          if (selectedInvoiceType === 'RETURNS' && !inv.isReturn && !t.includes('RETURN') && !t.includes('مرتجع')) return false;
          if (selectedInvoiceType === 'QUOTATION' && !t.includes('QUOTATION')) return false;
        }

        // فلتر 4: نطاق المبلغ
        const grandTotal = inv.totals.grandTotal;
        if (minAmount && !isNaN(Number(minAmount)) && grandTotal < Number(minAmount)) return false;
        if (maxAmount && !isNaN(Number(maxAmount)) && grandTotal > Number(maxAmount)) return false;

        // فلتر 5: التصنيف الضريبي
        if (selectedClassification === 'TAX' && inv.classification !== 'TAX' && inv.totals.taxTotal <= 0) return false;
        if (selectedClassification === 'NORMAL' && (inv.classification === 'TAX' || inv.totals.taxTotal > 0)) return false;

        // فلتر 6: الخزينة
        if (selectedSafe !== 'ALL') {
          const s = (inv.safe || 'MAIN_SAFE').toUpperCase();
          if (s !== selectedSafe.toUpperCase()) return false;
        }

        // فلتر 7: المستودع / الفرع
        if (selectedSource !== 'ALL') {
          const src = (inv.source || 'MAIN_WAREHOUSE').toUpperCase();
          if (src !== selectedSource.toUpperCase()) return false;
        }

        // فلتر 8: نوع الخدمة
        if (selectedServiceType === 'NONE') {
          const srv = (inv.serviceType || '').trim();
          if (srv && srv !== '-- بدون خدمة محددة --') return false;
        } else if (selectedServiceType !== 'ALL') {
          const srv = (inv.serviceType || '').trim().toLowerCase();
          if (srv !== selectedServiceType.trim().toLowerCase()) return false;
        }

        // فلتر 9: مندوب المبيعات
        if (!doesInvoiceMatchSalesRep(inv.salesRepName, selectedSalesRep)) return false;

        return true;
      });

      const mapped = filtered.map(inv => ({
        id: inv.id,
        invoice_number: inv.invoiceNumber,
        created_at: inv.date || inv.createdAt,
        customer_name: inv.partnerName || 'عميل نقدي',
        customer_id: inv.partnerId,
        net_amount: inv.totals.grandTotal,
        total_amount: inv.totals.grandTotal,
        tax_amount: inv.totals.taxTotal,
        paid_amount: inv.totals.cashPaid,
        remaining_amount: inv.totals.remainingBalance,
        status: inv.statusCode === 'POSTED' ? (language === 'ar' ? 'معتمدة / مرحلة' : 'Posted') : (language === 'ar' ? 'مسودة' : 'Draft'),
        statusCode: inv.statusCode,
        invoice_type: inv.invoiceType,
        paymentStatus: inv.paymentStatus,
        classification: inv.classification,
        safe: inv.safe,
        source: inv.source,
        service_type: inv.serviceType,
        sales_rep_name: inv.salesRepName
      }));

      setInvoices(mapped);

    } catch (error: any) {
      console.error('Error fetching sales invoices:', error);
      alert(`خطأ: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // تشغيل البحث التلقائي عند بدء التشغيل
  useEffect(() => {
    handleSearch();
  }, []);

  // حساب الإجماليات
  const grandTotal = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + Number(inv.net_amount || inv.total_amount || 0), 0);
  }, [invoices]);

  const grandTaxTotal = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + Number(inv.tax_amount || 0), 0);
  }, [invoices]);

  const grandPaidTotal = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0);
  }, [invoices]);

  const grandRemainingTotal = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + Number(inv.remaining_amount || 0), 0);
  }, [invoices]);

  // إعادة التعيين
  const handleReset = () => {
    const d = new Date();
    d.setDate(1);
    setStartDate(d.toISOString().substring(0, 10));
    setEndDate(todayStr);
    setSelectedCustomerId('ALL');
    setSelectedStatus('ALL');
    setSelectedInvoiceType('ALL');
    setSelectedClassification('ALL');
    setSelectedSafe('ALL');
    setSelectedSource('ALL');
    setSelectedServiceType('ALL');
    setSelectedSalesRep('ALL');
    setMinAmount('');
    setMaxAmount('');
    setCustomerSearchQuery('');
  };

  // نص ملخص الفلاتر النشطة لملفات التصدير
  const filterSummaryText = useMemo(() => {
    const parts = [
      `العميل: ${selectedCustomerObj ? selectedCustomerObj.name : 'جميع العملاء'}`,
      `الحالة: ${selectedStatusLabel || 'كافة الحالات'}`,
      `النوع: ${selectedInvoiceTypeLabel || 'كافة الأنواع'}`
    ];
    if (selectedClassification !== 'ALL' && selectedClassificationLabel) {
      parts.push(`التصنيف: ${selectedClassificationLabel}`);
    }
    if (selectedServiceType !== 'ALL' && selectedServiceTypeLabel) {
      parts.push(`الخدمة/النشاط: ${selectedServiceTypeLabel}`);
    }
    if (selectedSafe !== 'ALL' && selectedSafeLabel) {
      parts.push(`الخزينة/الحساب: ${selectedSafeLabel}`);
    }
    if (selectedSource !== 'ALL' && selectedSourceLabel) {
      parts.push(`المستودع/الفرع: ${selectedSourceLabel}`);
    }
    if (selectedSalesRep !== 'ALL' && selectedSalesRepLabel) {
      parts.push(`مندوب المبيعات: ${selectedSalesRepLabel}`);
    }
    if (minAmount || maxAmount) {
      parts.push(`نطاق المبلغ: ${minAmount ? `من ${minAmount}` : ''} ${maxAmount ? `إلى ${maxAmount}` : ''} ${currencySymbol}`);
    }
    return parts.join(' | ');
  }, [selectedCustomerObj, selectedStatusLabel, selectedInvoiceTypeLabel, selectedClassification, selectedClassificationLabel, selectedServiceType, selectedServiceTypeLabel, selectedSafe, selectedSafeLabel, selectedSource, selectedSourceLabel, selectedSalesRep, selectedSalesRepLabel, minAmount, maxAmount, currencySymbol]);

  // تصدير Excel
  const handleExportExcel = () => {
    if (invoices.length === 0) return;
    const headers = [
      'م', 'رقم الفاتورة', 'التصنيف', 'نوع الخدمة / النشاط', 'المستودع / الفرع', 'خزينة التحصيل', 'مندوب المبيعات', 'التاريخ', 'العميل', 'نوع الفاتورة',
      'المبلغ الصافي', 'الضريبة', 'المسدد', 'المتبقي', 'حالة السداد', 'الاعتماد'
    ];
    const rows = invoices.map((inv, idx) => {
      const typeInfo = formatInvoiceType(inv.invoice_type, inv.paymentStatus);
      const safeInfo = formatSafeInfo(inv.safe);
      const sourceInfo = formatSourceInfo(inv.source);
      const serviceInfo = formatServiceTypeInfo(inv.service_type);
      const repInfo = formatSalesRepInfo(inv.sales_rep_name);
      return [
        idx + 1,
        inv.invoice_number,
        inv.classification === 'TAX' ? 'فاتورة ضريبية' : 'فاتورة عادية',
        serviceInfo.labelAr,
        sourceInfo.labelAr,
        safeInfo.labelAr,
        repInfo.labelAr,
        new Date(inv.created_at).toLocaleDateString('ar-EG'),
        inv.customer_name,
        typeInfo.labelAr,
        Number(inv.net_amount || 0),
        Number(inv.tax_amount || 0),
        Number(inv.paid_amount || 0),
        Number(inv.remaining_amount || 0),
        inv.paymentStatus === 'PAID' ? 'مسددة بالكامل' : inv.paymentStatus === 'PARTIAL' ? 'مسددة جزئياً' : 'غير مسددة',
        inv.status
      ];
    });

    exportToXLSX({
      filename: `تقرير_إجمالي_فواتير_المبيعات_${startDate}_${endDate}`,
      title: `تقرير إجمالي فواتير المبيعات`,
      subtitle: `الفترة من: ${startDate} إلى: ${endDate}`,
      filterSummary: filterSummaryText,
      headers,
      rows,
      summaryRows: [
        ['الإجمالي العام', '', '', '', '', '', '', '', '', '', grandTotal, grandTaxTotal, grandPaidTotal, grandRemainingTotal, '', '']
      ]
    });
  };

  // تصدير PDF
  const handleExportPDF = () => {
    if (!reportRef.current || invoices.length === 0) return;
    exportToPDF({
      filename: `تقرير_إجمالي_فواتير_المبيعات_${startDate}_إلى_${endDate}`,
      title: 'تقرير إجمالي فواتير المبيعات',
      subtitle: `الفترة من: ${startDate} إلى: ${endDate}`,
      filterSummary: filterSummaryText,
      headers: ['م', 'رقم الفاتورة', 'التصنيف', 'نوع الخدمة', 'المستودع', 'الخزينة', 'المندوب', 'التاريخ', 'العميل', 'نوع الفاتورة', 'الصافي', 'المسدد', 'المتبقي', 'حالة السداد'],
      rows: invoices.map((inv, idx) => {
        const typeInfo = formatInvoiceType(inv.invoice_type, inv.paymentStatus);
        const safeInfo = formatSafeInfo(inv.safe);
        const sourceInfo = formatSourceInfo(inv.source);
        const serviceInfo = formatServiceTypeInfo(inv.service_type);
        const repInfo = formatSalesRepInfo(inv.sales_rep_name);
        return [
          idx + 1,
          inv.invoice_number,
          inv.classification === 'TAX' ? 'ضريبية' : 'عادية',
          serviceInfo.labelAr,
          sourceInfo.labelAr,
          safeInfo.labelAr,
          repInfo.labelAr,
          new Date(inv.created_at).toLocaleDateString('ar-EG'),
          inv.customer_name,
          typeInfo.labelAr,
          Number(inv.net_amount || 0),
          Number(inv.paid_amount || 0),
          Number(inv.remaining_amount || 0),
          inv.paymentStatus === 'PAID' ? 'مسددة' : inv.paymentStatus === 'PARTIAL' ? 'جزئياً' : 'آجل'
        ];
      }),
      elementToCapture: reportRef.current
    });
  };

  // الطباعة
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-slate-50 min-h-screen rtl" dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* شريط العنوان والتنقل العلوي */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate ? onNavigate('reportsHub') : window.history.back()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-bold text-xs shadow-2xs transition cursor-pointer"
            title="العودة لمركز تقارير المبيعات"
          >
            {isRtl ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
            <span>{language === 'ar' ? 'مركز تقارير المبيعات' : 'Sales Reports Hub'}</span>
          </button>
          
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 flex items-center gap-2">
              <FileBarChart className="text-blue-600" size={28} />
              <span>{language === 'ar' ? 'إجمالي فواتير المبيعات' : 'Total Sales Invoices'}</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {language === 'ar' 
                ? 'استعراض وتحليل شامل لفواتير المبيعات الصادرة مع فلترة متقدمة حسب العميل، حالة الفاتورة، نوع التعامل، والفترة الزمنية' 
                : 'Comprehensive audit of sales invoices with dedicated customer, status, payment type, and date filters'}
            </p>
          </div>
        </div>

        {/* أزرار الإجراءات والتصدير */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportExcel}
            disabled={invoices.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
          >
            <FileSpreadsheet size={16} />
            <span>Excel</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={invoices.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
          >
            <FileText size={16} />
            <span>PDF</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={invoices.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
          >
            <Printer size={16} />
            <span>{language === 'ar' ? 'طباعة' : 'Print'}</span>
          </button>
        </div>
      </div>

      {/* لوحة الفلاتر والبحث (تتضمن الفلاتر 1 و 2 و 3) */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6 print:hidden">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <Filter size={18} className="text-blue-600" />
            <span>{language === 'ar' ? 'فلاتر تقرير المبيعات المتقدمة' : 'Advanced Sales Report Filters'}</span>
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>{language === 'ar' ? 'إعادة ضبط' : 'Reset'}</span>
          </button>
        </div>

        {/* شبكة الفلاتر: توزيع منسق على صفين مريحين */}
        <div className="space-y-4">
          
          {/* الصف الأول من الفلاتر: الأطراف والأنواع والحالات والتصنيف وخزينة التحصيل والمستودع ونوع الخدمة ومندوب المبيعات */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
            
            {/* فلتر 1: العميل (Customer Filter) */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users size={14} className="text-blue-600" />
                  <span>{language === 'ar' ? 'العميل' : 'Customer'}</span>
                </span>
                {selectedCustomerId !== 'ALL' && (
                  <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-bold">
                    {language === 'ar' ? 'محدد' : 'Filtered'}
                  </span>
                )}
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none transition shadow-2xs cursor-pointer"
              >
                <option value="ALL">
                  {language === 'ar' ? '👥 جميع العملاء (بدون تحديد)' : '👥 All Customers'}
                </option>
                {filteredCustomersDropdown.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* فلتر 2: حالة الفاتورة وحالة السداد (Invoice & Payment Status) */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Wallet size={14} className="text-indigo-600" />
                  <span>{language === 'ar' ? 'حالة الفاتورة والسداد' : 'Invoice & Payment Status'}</span>
                </span>
                {selectedStatus !== 'ALL' && (
                  <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-bold">
                    {language === 'ar' ? 'مفلتر' : 'Active'}
                  </span>
                )}
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none transition shadow-2xs cursor-pointer"
              >
                <option value="ALL">{language === 'ar' ? '📋 جميع الحالات' : '📋 All Statuses'}</option>
                <option value="POSTED">{language === 'ar' ? '✅ معتمدة ومرحّلة فقط' : '✅ Posted Only'}</option>
                <option value="DRAFT">{language === 'ar' ? '📝 مسودة غير مرحّلة' : '📝 Draft Only'}</option>
                <option value="PAID">{language === 'ar' ? '💰 مسددة بالكامل' : '💰 Fully Paid'}</option>
                <option value="PARTIALLY_PAID">{language === 'ar' ? '⚖️ مسددة جزئياً (متبقي رصيد)' : '⚖️ Partially Paid'}</option>
                <option value="UNPAID">{language === 'ar' ? '⏳ غير مسددة / آجلة' : '⏳ Unpaid / Credit'}</option>
              </select>
            </div>

            {/* فلتر 3: نوع الفاتورة وطريقة التعامل (Invoice Type & Method) */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Receipt size={14} className="text-emerald-600" />
                  <span>{language === 'ar' ? 'نوع الفاتورة والتعامل' : 'Invoice & Payment Type'}</span>
                </span>
                {selectedInvoiceType !== 'ALL' && (
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                    {language === 'ar' ? 'مفلتر' : 'Active'}
                  </span>
                )}
              </label>
              <select
                value={selectedInvoiceType}
                onChange={(e) => setSelectedInvoiceType(e.target.value)}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none transition shadow-2xs cursor-pointer"
              >
                <option value="ALL">{language === 'ar' ? '🧾 جميع أنواع الفواتير' : '🧾 All Invoice Types'}</option>
                <option value="CASH_SALES">{language === 'ar' ? '💵 مبيعات نقدية (كاش)' : '💵 Cash Sales'}</option>
                <option value="CREDIT_SALES">{language === 'ar' ? '💳 مبيعات آجلة (ذمم)' : '💳 Credit Sales'}</option>
                <option value="PARTIAL_SALES">{language === 'ar' ? '📑 مبيعات دفع جزئي' : '📑 Partial Sales'}</option>
                <option value="RETURNS">{language === 'ar' ? '↩️ مرتجعات المبيعات' : '↩️ Sales Returns'}</option>
                <option value="QUOTATION">{language === 'ar' ? '📋 عروض أسعار' : '📋 Quotations'}</option>
              </select>
            </div>

            {/* فلتر 5: التصنيف الضريبي والمالي (Tax Classification Filter) */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Scale size={14} className="text-purple-600" />
                  <span>{language === 'ar' ? 'التصنيف الضريبي' : 'Tax Classification'}</span>
                </span>
                {selectedClassification !== 'ALL' && (
                  <span className="text-[10px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full font-bold">
                    {language === 'ar' ? 'مفلتر' : 'Active'}
                  </span>
                )}
              </label>
              <select
                value={selectedClassification}
                onChange={(e) => setSelectedClassification(e.target.value)}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none transition shadow-2xs cursor-pointer"
              >
                <option value="ALL">{language === 'ar' ? '📑 جميع التصنيفات' : '📑 All Classifications'}</option>
                <option value="TAX">{language === 'ar' ? '🏢 فواتير ضريبية رسمية (VAT)' : '🏢 Tax Invoices (VAT)'}</option>
                <option value="NORMAL">{language === 'ar' ? '📄 فواتير عادية / مبسطة' : '📄 Simplified / Normal'}</option>
              </select>
            </div>

            {/* فلتر 6: خزينة التحصيل والحساب المالي (Safe & Treasury Filter) */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Landmark size={14} className="text-teal-600" />
                  <span>{language === 'ar' ? 'خزينة التحصيل' : 'Safe / Treasury'}</span>
                </span>
                {selectedSafe !== 'ALL' && (
                  <span className="text-[10px] text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full font-bold">
                    {language === 'ar' ? 'مفلتر' : 'Active'}
                  </span>
                )}
              </label>
              <select
                value={selectedSafe}
                onChange={(e) => setSelectedSafe(e.target.value)}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-teal-500 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none transition shadow-2xs cursor-pointer"
              >
                <option value="ALL">{language === 'ar' ? '🏦 جميع الخزائن والحسابات' : '🏦 All Safes & Accounts'}</option>
                {cashBankOptions.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.label}</option>
                ))}
              </select>
            </div>

            {/* فلتر 7: مستودع التوريد والفرع (Warehouse & Branch Filter) */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Warehouse size={14} className="text-cyan-600" />
                  <span>{language === 'ar' ? 'مستودع التوريد / الفرع' : 'Warehouse / Branch'}</span>
                </span>
                {selectedSource !== 'ALL' && (
                  <span className="text-[10px] text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full font-bold">
                    {language === 'ar' ? 'مفلتر' : 'Active'}
                  </span>
                )}
              </label>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-cyan-500 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none transition shadow-2xs cursor-pointer"
              >
                <option value="ALL">{language === 'ar' ? '🏢 جميع المستودعات والفروع' : '🏢 All Warehouses & Branches'}</option>
                {dynamicWarehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.label}</option>
                ))}
              </select>
            </div>

            {/* فلتر 8: نوع الخدمة والنشاط (Service Type & Activity Filter) */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Briefcase size={14} className="text-amber-600" />
                  <span>{language === 'ar' ? 'نوع الخدمة والنشاط' : 'Service / Activity'}</span>
                </span>
                {selectedServiceType !== 'ALL' && (
                  <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-bold">
                    {language === 'ar' ? 'مفلتر' : 'Active'}
                  </span>
                )}
              </label>
              <select
                value={selectedServiceType}
                onChange={(e) => setSelectedServiceType(e.target.value)}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none transition shadow-2xs cursor-pointer"
              >
                <option value="ALL">{language === 'ar' ? '💼 جميع الخدمات والأنشطة' : '💼 All Services & Activities'}</option>
                <option value="NONE">{language === 'ar' ? '📦 مبيعات بضائع فقط (بدون خدمة)' : '📦 Goods Only (Non-Service)'}</option>
                <option value="استشارات">{language === 'ar' ? '💡 استشارات' : '💡 Consulting'}</option>
                <option value="تصميم">{language === 'ar' ? '🎨 تصميم' : '🎨 Design'}</option>
                <option value="برمجة">{language === 'ar' ? '💻 برمجة وحلول تقنية' : '💻 Software & IT'}</option>
                <option value="صيانة">{language === 'ar' ? '🔧 صيانة' : '🔧 Maintenance'}</option>
                <option value="تركيب">{language === 'ar' ? '🛠️ تركيب وتجهيز' : '🛠️ Installation'}</option>
                <option value="دعم فني">{language === 'ar' ? '🎧 دعم فني وتقني' : '🎧 Tech Support'}</option>
                <option value="خدمات عامة">{language === 'ar' ? '⚙️ خدمات عامة وتشغيلية' : '⚙️ General Services'}</option>
              </select>
            </div>

            {/* فلتر 9: مندوب المبيعات ومنشئ الفاتورة (Sales Rep & Creator Filter) */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <UserCheck size={14} className="text-rose-600" />
                  <span>{language === 'ar' ? 'مندوب المبيعات / المنشئ' : 'Sales Rep / Creator'}</span>
                </span>
                {selectedSalesRep !== 'ALL' && (
                  <span className="text-[10px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full font-bold">
                    {language === 'ar' ? 'مفلتر' : 'Active'}
                  </span>
                )}
              </label>
              <select
                value={selectedSalesRep}
                onChange={(e) => setSelectedSalesRep(e.target.value)}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-rose-500 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none transition shadow-2xs cursor-pointer"
              >
                <option value="ALL">{language === 'ar' ? '👤 جميع المناديب والمسؤولين' : '👤 All Sales Reps'}</option>
                {salesRepsList.map(rep => (
                  <option key={rep.id} value={rep.id}>{rep.label}</option>
                ))}
              </select>
            </div>

          </div>

          {/* الصف الثاني: التواريخ ونطاق المبلغ وزر التنفيذ */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end pt-2 border-t border-slate-100">
            
            {/* فلتر التاريخ: من */}
            <div className="md:col-span-3 flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-500" />
                <span>{language === 'ar' ? 'من تاريخ' : 'From Date'}</span>
              </label>
              <input 
                type="date" 
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 outline-none transition shadow-2xs" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
              />
            </div>

            {/* فلتر التاريخ: إلى */}
            <div className="md:col-span-3 flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-500" />
                <span>{language === 'ar' ? 'إلى تاريخ' : 'To Date'}</span>
              </label>
              <input 
                type="date" 
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 outline-none transition shadow-2xs" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
              />
            </div>

            {/* فلتر 4: نطاق المبلغ (الحد الأدنى والأقصى) */}
            <div className="md:col-span-2 flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <DollarSign size={13} className="text-amber-600" />
                  <span>{language === 'ar' ? 'أدنى مبلغ' : 'Min Amount'}</span>
                </span>
                {minAmount && (
                  <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1 rounded">≥</span>
                )}
              </label>
              <input 
                type="number"
                min="0"
                step="any"
                placeholder={`0.00 ${currencySymbol}`}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-amber-500 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 outline-none transition shadow-2xs" 
                value={minAmount} 
                onChange={(e) => setMinAmount(e.target.value)} 
              />
            </div>

            <div className="md:col-span-2 flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <DollarSign size={13} className="text-amber-600" />
                  <span>{language === 'ar' ? 'أقصى مبلغ' : 'Max Amount'}</span>
                </span>
                {maxAmount && (
                  <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1 rounded">≤</span>
                )}
              </label>
              <input 
                type="number"
                min="0"
                step="any"
                placeholder={`مبلغ أقصى...`}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-amber-500 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 outline-none transition shadow-2xs" 
                value={maxAmount} 
                onChange={(e) => setMaxAmount(e.target.value)} 
              />
            </div>

            {/* زر التطبيق والبحث */}
            <div className="md:col-span-2 flex items-end">
              <button 
                onClick={handleSearch} 
                disabled={loading} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center justify-center gap-1.5 text-xs sm:text-sm disabled:opacity-50"
              >
                <Search size={16} />
                <span>{loading ? (language === 'ar' ? 'جاري البحث...' : 'Loading...') : (language === 'ar' ? 'بحث وتطبيق' : 'Apply')}</span>
              </button>
            </div>

          </div>

        </div>

        {/* شريط الفلاتر النشطة (Active Filters Chips) */}
        {(selectedCustomerObj || selectedStatus !== 'ALL' || selectedInvoiceType !== 'ALL' || selectedClassification !== 'ALL' || selectedSafe !== 'ALL' || selectedSource !== 'ALL' || selectedServiceType !== 'ALL' || selectedSalesRep !== 'ALL' || minAmount || maxAmount) && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-500 font-bold">{language === 'ar' ? 'الفلاتر النشطة:' : 'Active Filters:'}</span>
              
              {selectedCustomerObj && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 font-bold border border-blue-200">
                  <UserCheck size={14} />
                  <span>{language === 'ar' ? 'العميل:' : 'Customer:'} {selectedCustomerObj.name}</span>
                  <button 
                    onClick={() => setSelectedCustomerId('ALL')} 
                    className="mr-1 text-blue-600 hover:text-rose-600 font-bold cursor-pointer"
                    title="حذف فلتر العميل"
                  >
                    ×
                  </button>
                </span>
              )}

              {selectedStatus !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 font-bold border border-indigo-200">
                  <Wallet size={14} />
                  <span>{language === 'ar' ? 'الحالة:' : 'Status:'} {selectedStatusLabel}</span>
                  <button 
                    onClick={() => setSelectedStatus('ALL')} 
                    className="mr-1 text-indigo-600 hover:text-rose-600 font-bold cursor-pointer"
                    title="حذف فلتر الحالة"
                  >
                    ×
                  </button>
                </span>
              )}

              {selectedInvoiceType !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                  <Receipt size={14} />
                  <span>{language === 'ar' ? 'النوع:' : 'Type:'} {selectedInvoiceTypeLabel}</span>
                  <button 
                    onClick={() => setSelectedInvoiceType('ALL')} 
                    className="mr-1 text-emerald-600 hover:text-rose-600 font-bold cursor-pointer"
                    title="حذف فلتر نوع الفاتورة"
                  >
                    ×
                  </button>
                </span>
              )}

              {selectedClassification !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-900 font-bold border border-purple-200">
                  <Scale size={14} className="text-purple-600" />
                  <span>{language === 'ar' ? 'التصنيف:' : 'Classification:'} {selectedClassificationLabel}</span>
                  <button 
                    onClick={() => setSelectedClassification('ALL')} 
                    className="mr-1 text-purple-700 hover:text-rose-600 font-bold cursor-pointer"
                    title="حذف فلتر التصنيف الضريبي"
                  >
                    ×
                  </button>
                </span>
              )}

              {selectedSafe !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-900 font-bold border border-teal-200">
                  <Landmark size={14} className="text-teal-600" />
                  <span>{language === 'ar' ? 'الخزينة:' : 'Safe:'} {selectedSafeLabel}</span>
                  <button 
                    onClick={() => setSelectedSafe('ALL')} 
                    className="mr-1 text-teal-700 hover:text-rose-600 font-bold cursor-pointer"
                    title="حذف فلتر الخزينة"
                  >
                    ×
                  </button>
                </span>
              )}

              {selectedSource !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-900 font-bold border border-cyan-200">
                  <Warehouse size={14} className="text-cyan-600" />
                  <span>{language === 'ar' ? 'المستودع:' : 'Warehouse:'} {selectedSourceLabel}</span>
                  <button 
                    onClick={() => setSelectedSource('ALL')} 
                    className="mr-1 text-cyan-700 hover:text-rose-600 font-bold cursor-pointer"
                    title="حذف فلتر المستودع"
                  >
                    ×
                  </button>
                </span>
              )}

              {selectedServiceType !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 font-bold border border-amber-200">
                  <Briefcase size={14} className="text-amber-600" />
                  <span>{language === 'ar' ? 'الخدمة/النشاط:' : 'Service:'} {selectedServiceTypeLabel}</span>
                  <button 
                    onClick={() => setSelectedServiceType('ALL')} 
                    className="mr-1 text-amber-700 hover:text-rose-600 font-bold cursor-pointer"
                    title="حذف فلتر نوع الخدمة"
                  >
                    ×
                  </button>
                </span>
              )}

              {selectedSalesRep !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-900 font-bold border border-rose-200">
                  <UserCheck size={14} className="text-rose-600" />
                  <span>{language === 'ar' ? 'المندوب:' : 'Sales Rep:'} {selectedSalesRepLabel}</span>
                  <button 
                    onClick={() => setSelectedSalesRep('ALL')} 
                    className="mr-1 text-rose-700 hover:text-rose-900 font-bold cursor-pointer"
                    title="حذف فلتر مندوب المبيعات"
                  >
                    ×
                  </button>
                </span>
              )}

              {(minAmount || maxAmount) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 font-bold border border-amber-200">
                  <DollarSign size={14} className="text-amber-700" />
                  <span>
                    {language === 'ar' ? 'المبلغ:' : 'Amount:'}{' '}
                    {minAmount ? `${language === 'ar' ? 'من' : 'From'} ${minAmount}` : ''}{' '}
                    {maxAmount ? `${language === 'ar' ? 'إلى' : 'To'} ${maxAmount}` : ''} {currencySymbol}
                  </span>
                  <button 
                    onClick={() => { setMinAmount(''); setMaxAmount(''); }} 
                    className="mr-1 text-amber-700 hover:text-rose-600 font-bold cursor-pointer"
                    title="حذف فلتر نطاق المبلغ"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>

            <button
              onClick={handleReset}
              className="text-xs text-rose-600 hover:underline font-bold cursor-pointer"
            >
              {language === 'ar' ? 'إلغاء جميع الفلاتر' : 'Clear All Filters'}
            </button>
          </div>
        )}
      </div>

      {/* بطاقات الإحصائيات السريعة (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">
              {language === 'ar' ? 'إجمالي المبيعات' : 'Total Net Sales'}
            </p>
            <h3 className="text-xl sm:text-2xl font-black text-blue-600">
              {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">
              {language === 'ar' ? 'المبالغ المحصلة' : 'Paid Collected'}
            </p>
            <h3 className="text-xl sm:text-2xl font-black text-emerald-600">
              {grandPaidTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">
              {language === 'ar' ? 'المتبقي والآجل' : 'Remaining / Credit'}
            </p>
            <h3 className="text-xl sm:text-2xl font-black text-amber-600">
              {grandRemainingTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">
              {language === 'ar' ? 'عدد الفواتير الصادرة' : 'Issued Invoices Count'}
            </p>
            <h3 className="text-xl sm:text-2xl font-black text-slate-800">
              {invoices.length} <span className="text-xs font-semibold text-slate-500">{language === 'ar' ? 'فاتورة' : 'inv'}</span>
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <FileBarChart size={24} />
          </div>
        </div>
      </div>

      {/* جدول عرض النتائج */}
      <div ref={reportRef} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* ترويسة التقرير في الطباعة */}
        <div className="hidden print:block p-6 border-b text-center">
          <h2 className="text-xl font-bold text-slate-900">تقرير إجمالي فواتير المبيعات</h2>
          <p className="text-sm text-slate-600 mt-1">
            الفترة من: {startDate} إلى: {endDate} | {filterSummaryText}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 text-xs font-bold">
              <tr>
                <th className="p-4 w-12 text-center">#</th>
                <th className="p-4">{language === 'ar' ? 'رقم الفاتورة' : 'Invoice #'}</th>
                <th className="p-4">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="p-4">{language === 'ar' ? 'العميل' : 'Customer'}</th>
                <th className="p-4 text-center">{language === 'ar' ? 'نوع الفاتورة' : 'Invoice Type'}</th>
                <th className="p-4 text-center">{language === 'ar' ? 'نوع الخدمة / النشاط' : 'Service / Activity'}</th>
                <th className="p-4 text-center">{language === 'ar' ? 'المستودع / الفرع' : 'Warehouse / Branch'}</th>
                <th className="p-4 text-center">{language === 'ar' ? 'الخزينة / الحساب' : 'Safe / Treasury'}</th>
                <th className="p-4 text-center">{language === 'ar' ? 'مندوب المبيعات' : 'Sales Rep'}</th>
                <th className="p-4 text-left">{language === 'ar' ? 'المبلغ الصافي' : 'Net Amount'}</th>
                <th className="p-4 text-left">{language === 'ar' ? 'المسدد' : 'Paid'}</th>
                <th className="p-4 text-left">{language === 'ar' ? 'المتبقي' : 'Remaining'}</th>
                <th className="p-4 text-center">{language === 'ar' ? 'حالة السداد' : 'Payment'}</th>
                <th className="p-4 text-center">{language === 'ar' ? 'الاعتماد' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-12 text-center">
                    <div className="max-w-xs mx-auto text-slate-400">
                      <AlertCircle size={40} className="mx-auto mb-3 opacity-40 text-slate-400" />
                      <p className="font-bold text-slate-700 text-base mb-1">
                        {language === 'ar' ? 'لا توجد فواتير مطابقة' : 'No matching invoices found'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {language === 'ar' 
                          ? 'جرب تعديل الفلاتر المحددة (العميل، الحالة، نوع الفاتورة، أو الفترة) والضغط على بحث.' 
                          : 'Try adjusting the active filters and apply again.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map((inv, idx) => {
                  const typeInfo = formatInvoiceType(inv.invoice_type, inv.paymentStatus);
                  const TypeIcon = typeInfo.icon || Receipt;
                  const safeInfo = formatSafeInfo(inv.safe);
                  const sourceInfo = formatSourceInfo(inv.source);
                  const serviceInfo = formatServiceTypeInfo(inv.service_type);
                  const repInfo = formatSalesRepInfo(inv.sales_rep_name);

                  return (
                    <tr key={inv.id || inv.invoice_number || idx} className="hover:bg-blue-50/40 transition">
                      <td className="p-4 text-center text-xs text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-4 font-mono font-bold text-slate-900">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{inv.invoice_number}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                            inv.classification === 'TAX'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {inv.classification === 'TAX' 
                              ? (language === 'ar' ? 'ضريبية' : 'Tax')
                              : (language === 'ar' ? 'عادية' : 'Normal')}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-600 text-xs">
                        {new Date(inv.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="p-4 font-semibold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Users size={14} className="text-slate-400 shrink-0" />
                          <span className="truncate max-w-[160px]">{inv.customer_name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${typeInfo.color}`}>
                          <TypeIcon size={11} />
                          <span>{language === 'ar' ? typeInfo.labelAr : typeInfo.labelEn}</span>
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${serviceInfo.color}`}>
                          <Briefcase size={11} />
                          <span>{language === 'ar' ? serviceInfo.labelAr : serviceInfo.labelEn}</span>
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${sourceInfo.color}`}>
                          <Warehouse size={11} />
                          <span>{language === 'ar' ? sourceInfo.labelAr : sourceInfo.labelEn}</span>
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${safeInfo.color}`}>
                          <Landmark size={11} />
                          <span>{language === 'ar' ? safeInfo.labelAr : safeInfo.labelEn}</span>
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${repInfo.color}`}>
                          <UserCheck size={11} />
                          <span>{language === 'ar' ? repInfo.labelAr : repInfo.labelEn}</span>
                        </span>
                      </td>
                      <td className="p-4 text-left font-bold text-blue-700 font-mono">
                        {Number(inv.net_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                      </td>
                      <td className="p-4 text-left text-emerald-700 font-bold text-xs font-mono">
                        {Number(inv.paid_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                      </td>
                      <td className="p-4 text-left text-amber-700 font-bold text-xs font-mono">
                        {Number(inv.remaining_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          inv.paymentStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : inv.paymentStatus === 'PARTIAL'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {inv.paymentStatus === 'PAID' ? (
                            <>
                              <CheckCircle size={10} />
                              <span>{language === 'ar' ? 'مسددة بالكامل' : 'Paid'}</span>
                            </>
                          ) : inv.paymentStatus === 'PARTIAL' ? (
                            <>
                              <Clock size={10} />
                              <span>{language === 'ar' ? 'مسددة جزئياً' : 'Partial'}</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle size={10} />
                              <span>{language === 'ar' ? 'غير مسددة' : 'Unpaid'}</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          inv.status === 'معتمدة / مرحلة' || inv.statusCode === 'POSTED' || inv.statusCode === 'PAID'
                            ? 'bg-slate-100 text-slate-700 border border-slate-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          <CheckCircle2 size={10} />
                          <span>{inv.status}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {invoices.length > 0 && (
              <tfoot className="bg-slate-50 font-black border-t-2 border-slate-200 text-slate-800">
                <tr>
                  <td colSpan={9} className="p-4 text-right">
                    {language === 'ar' ? 'إجمالي المبالغ للفترة المحددة:' : 'Totals for Selected Range:'}
                  </td>
                  <td className="p-4 text-left text-sm text-blue-700 font-black font-mono">
                    {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                  </td>
                  <td className="p-4 text-left text-xs text-emerald-700 font-black font-mono">
                    {grandPaidTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                  </td>
                  <td className="p-4 text-left text-xs text-amber-700 font-black font-mono">
                    {grandRemainingTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                  </td>
                  <td colSpan={2} className="p-4 text-center text-xs text-slate-500">
                    {invoices.length} {language === 'ar' ? 'فاتورة' : 'inv'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  );
};

export default TotalSalesInvoices;
