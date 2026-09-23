import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Mic, 
  MicOff, 
  Search, 
  X, 
  ArrowRight, 
  Sparkles, 
  FolderTree, 
  LayoutDashboard, 
  Volume2, 
  VolumeX,
  AlertCircle,
  CornerDownLeft,
  FileText,
  Receipt,
  Users,
  Building2,
  Package,
  Layers,
  Phone,
  Zap,
  Play,
  ArrowUpRight
} from 'lucide-react';
import { loadChartOfAccounts } from '../utils/trialBalanceStore';
import { Account } from '../types/accounting';
import { 
  loadCustomers, 
  loadVendors, 
  loadSalesInvoices, 
  loadPurchaseInvoices, 
  loadReceiptVouchers, 
  loadPaymentVouchers,
  StoredSalesInvoiceRecord,
  StoredPurchaseInvoiceRecord,
  StoredVoucherRecord
} from '../utils/partnerLedger';
import { loadStoredItems, Item } from '../utils/itemsStore';
import { useSystemCurrency } from '../utils/currency';
import { parseVoiceAction, ParsedVoiceAction, evaluateFinancialQA } from '../utils/voiceCommandParser';

// System screens map with Arabic and English aliases
export interface SystemScreenItem {
  id: string;
  titleAr: string;
  titleEn: string;
  category: string;
  keywords: string[];
  description: string;
}

export const SYSTEM_SCREENS: SystemScreenItem[] = [
  {
    id: 'companyProfile',
    titleAr: 'بيانات الشركة والواجهة الرئيسية',
    titleEn: 'Company Profile & Overview',
    category: 'عام',
    keywords: ['شركة', 'منشأة', 'بيانات', 'مؤسسة', 'بروفايل', 'لوجو', 'سجل', 'رئيسية', 'profile', 'company'],
    description: 'عرض وتعديل معلومات المنشأة والسجل التجاري والرقم الضريبي'
  },
  {
    id: 'dashboard',
    titleAr: 'لوحة المؤشرات والقيادة',
    titleEn: 'Dashboard & KPI Metrics',
    category: 'عام',
    keywords: ['لوحة', 'مؤشرات', 'داشبورد', 'رئيسية', 'احصائيات', 'رسوم', 'dashboard', 'kpi'],
    description: 'نظرة عامة ومؤشرات أداء مالية وتدفقات نقدية لحظية'
  },
  {
    id: 'chartTree',
    titleAr: 'شجرة ودليل الحسابات المالية',
    titleEn: 'Chart of Accounts Tree',
    category: 'المحاسبة العامة',
    keywords: ['شجرة', 'حسابات', 'دليل', 'أصول', 'خصوم', 'مصروفات', 'إيرادات', 'شجرة الحسابات', 'أستاذ', 'chart', 'accounts'],
    description: 'استعراض الهيكل الشجري للحسابات من المستوى 1 إلى 5 مع الأرصدة التراكمية'
  },
  {
    id: 'journal',
    titleAr: 'القيود اليومية وسجل اليومية',
    titleEn: 'Journal Entries',
    category: 'المحاسبة العامة',
    keywords: ['قيد', 'قيود', 'يومية', 'تسجيل قيد', 'سند قيد', 'دفتر اليومية', 'قيد مزدوج', 'journal'],
    description: 'إنشاء ومراجعة القيود اليومية بنظام القيد المزدوج المتوازن'
  },
  {
    id: 'trialBalance',
    titleAr: 'ميزان المراجعة',
    titleEn: 'Trial Balance',
    category: 'المحاسبة العامة',
    keywords: ['ميزان', 'مراجعة', 'أرصدة', 'أستاذ عام', 'مدين ودائن', 'trial', 'balance'],
    description: 'كشف ميزان المراجعة بالمجاميع والأرصدة مع كشوفات الحساب'
  },
  {
    id: 'financialReports',
    titleAr: 'التقارير المالية الختامية (قائمة الدخل والميزانية)',
    titleEn: 'Financial Statements',
    category: 'المحاسبة العامة',
    keywords: ['تقارير', 'قوائم', 'قائمة الدخل', 'ميزانية عمومية', 'أرباح وخسائر', 'مركز مالي', 'income', 'balance sheet'],
    description: 'قائمة الدخل والميزانية العمومية والمركز المالي الختامي'
  },
  {
    id: 'yearEndClosing',
    titleAr: 'الإقفال السنوي وترحيل الحسابات',
    titleEn: 'Year-End Closing',
    category: 'المحاسبة العامة',
    keywords: ['إقفال', 'سنوي', 'ترحيل', 'أرباح مدورة', 'إغلاق السنة', 'closing', 'year end'],
    description: 'إجراءات إقفال السنة المالية وترحيل الأرصدة وتصفير الإيرادات والمصروفات'
  },
  {
    id: 'costCenters',
    titleAr: 'مراكز التكلفة والمشاريع',
    titleEn: 'Cost Centers & Projects',
    category: 'المحاسبة العامة',
    keywords: ['مركز تكلفة', 'مراكز', 'تكاليف', 'مشاريع', 'مشروع', 'cost', 'centers'],
    description: 'توزيع العمليات والسندات على مراكز التكلفة والمشاريع التحليلية'
  },
  {
    id: 'customers',
    titleAr: 'إدارة العملاء',
    titleEn: 'Customers Management',
    category: 'المبيعات والعملاء',
    keywords: ['عميل', 'عملاء', 'زبائن', 'مدينين', 'كشف حساب عميل', 'customers'],
    description: 'إدارة سجلات العملاء، الحدود الائتمانية، وكشوفات الحساب والمصادقات'
  },
  {
    id: 'sales',
    titleAr: 'فواتير المبيعات',
    titleEn: 'Sales Invoices',
    category: 'المبيعات والعملاء',
    keywords: ['فاتورة مبيعات', 'بيع', 'مبيعات', 'فاتورة', 'فاتورة ضريبية', 'sales', 'invoices'],
    description: 'إنشاء فواتير المبيعات الضريبية المبسطة والمعتمدة وطباعتها'
  },
  {
    id: 'installments',
    titleAr: 'إدارة التقسيط والكمبيالات والسندات لأمر',
    titleEn: 'Installments & Promissory Notes',
    category: 'المبيعات والعملاء',
    keywords: ['تقسيط', 'أقساط', 'كمبيالة', 'كمبيالات', 'سند لأمر', 'جدولة', 'installments'],
    description: 'جدولة عقود التقسيط وإصدار ومتابعة الكمبيالات الدورية'
  },
  {
    id: 'vendors',
    titleAr: 'إدارة الموردين',
    titleEn: 'Vendors Management',
    category: 'المشتريات والموردين',
    keywords: ['مورد', 'موردين', 'تجار', 'دائنين', 'كشف حساب مورد', 'vendors', 'suppliers'],
    description: 'إدارة بيانات الموردين والمستحقات ومصادقات الأرصدة'
  },
  {
    id: 'purchases',
    titleAr: 'فواتير المشتريات',
    titleEn: 'Purchase Invoices',
    category: 'المشتريات والموردين',
    keywords: ['فاتورة مشتريات', 'شراء', 'مشتريات', 'توريد', 'purchases'],
    description: 'تسجيل واعتماد فواتير الشراء والتوريد وضريبة المدخلات'
  },
  {
    id: 'partnerBalances',
    titleAr: 'أرصدة العملاء والموردين وأعمار الديون',
    titleEn: 'Partner Balances & Aging',
    category: 'المبيعات والعملاء',
    keywords: ['أرصدة عملاء', 'أرصدة موردين', 'أعمار الديون', 'ديون', 'مستحقات', 'aging', 'balances'],
    description: 'كشف مجمع للأرصدة مع تقرير أعمار الديون وخطابات المصادقة'
  },
  {
    id: 'items',
    titleAr: 'إدارة الأصناف والمنتجات',
    titleEn: 'Items & Products Catalog',
    category: 'المخزون والمستودعات',
    keywords: ['أصناف', 'صنف', 'منتجات', 'منتج', 'بضاعة', 'تسعير', 'باركود', 'items', 'products'],
    description: 'دليل الأصناف والأسعار وأكواد الباركود ووحدات القياس'
  },
  {
    id: 'warehouseBalances',
    titleAr: 'أرصدة المخزن وحركة المستودع',
    titleEn: 'Warehouse Inventory Stock',
    category: 'المخزون والمستودعات',
    keywords: ['مخزن', 'مستودع', 'رصيد مخزون', 'جرد', 'كميات', 'stock', 'warehouse'],
    description: 'متابعة كميات المخزون وحركات الإدخال والإخراج وتكلفة البضاعة'
  },
  {
    id: 'inventoryCount',
    titleAr: 'الجرد المخزني والتسويات الدفترية',
    titleEn: 'Inventory Count & Adjustment',
    category: 'المخزون والمستودعات',
    keywords: ['جرد', 'جرد مخزني', 'تسوية جردية', 'عجز', 'زيادة', 'count', 'audit'],
    description: 'إجراء الجرد الفعلي ومطابقته دفترياً وتوليد قيود الفروقات التلقائية'
  },
  {
    id: 'manufacturing',
    titleAr: 'إدارة التصنيع والإنتاج وقوائم المواد (BOM)',
    titleEn: 'Manufacturing & BOM',
    category: 'التصنيع والإنتاج',
    keywords: ['تصنيع', 'إنتاج', 'أمر تشغيل', 'قائمة مواد', 'تكاليف تصنيع', 'bom', 'manufacturing'],
    description: 'هيكلة وصفات الإنتاج وحساب تكلفة المواد والتشغيل وإصدار أوامر الإنتاج'
  },
  {
    id: 'payroll',
    titleAr: 'شؤون الموظفين والرواتب والبدلات',
    titleEn: 'Payroll & HR Management',
    category: 'الموارد البشرية',
    keywords: ['موظف', 'موظفين', 'رواتب', 'راتب', 'بدلات', 'خصومات', 'أجور', 'payroll', 'hr'],
    description: 'سجلات الموظفين ومسيرات الرواتب واحتساب البدلات والاستقطاعات'
  },
  {
    id: 'bankChecks',
    titleAr: 'حافظة ودورة حياة الشيكات البنكية',
    titleEn: 'Check Portfolio & Clearance',
    category: 'الخزينة والمالية',
    keywords: ['شيك', 'شيكات', 'حافظة شيكات', 'تحصيل شيك', 'صرف شيك', 'ارتجاع شيك', 'checks', 'bank'],
    description: 'متابعة شيكات القبض والصرف ومراحل التحصيل والإيداع والمقاصة'
  },
  {
    id: 'externalReceipt',
    titleAr: 'سند قبض خارجي',
    titleEn: 'External Receipt Voucher',
    category: 'الخزينة والمالية',
    keywords: ['سند قبض', 'قبض', 'استلام نقدية', 'قبض عميل', 'receipt', 'voucher'],
    description: 'تحرير سندات قبض نقدية أو بنكية من العملاء والجهات الخارجية'
  },
  {
    id: 'externalPayment',
    titleAr: 'سند صرف خارجي',
    titleEn: 'External Payment Voucher',
    category: 'الخزينة والمالية',
    keywords: ['سند صرف', 'صرف', 'دفع نقدية', 'صرف مورد', 'payment', 'voucher'],
    description: 'تحرير سندات صرف للموردين أو سداد مصاريف خارجية'
  },
  {
    id: 'internalReceipt',
    titleAr: 'سند قبض داخلي (عهدة)',
    titleEn: 'Internal Receipt Voucher',
    category: 'الخزينة والمالية',
    keywords: ['قبض داخلي', 'توريد عهدة', 'قبض عهدة', 'internal receipt'],
    description: 'استلام مبالغ أو تسوية عهد نقدية داخلية بين موظفي المنشأة'
  },
  {
    id: 'internalPayment',
    titleAr: 'سند صرف داخلي (عهدة/مصروف داخلي)',
    titleEn: 'Internal Payment Voucher',
    category: 'الخزينة والمالية',
    keywords: ['صرف داخلي', 'صرف عهدة', 'تسليف', 'internal payment'],
    description: 'صرف عهد نقدية للموظفين أو سداد مصاريف نثرية داخلية'
  },
  {
    id: 'auditTrail',
    titleAr: 'سجل الأنشطة ومسارات التدقيق المالي',
    titleEn: 'Audit Trail & Activity Log',
    category: 'الإدارة والنظام',
    keywords: ['تدقيق', 'سجل أنشطة', 'مسارات تدقيق', 'سجل العمليات', 'رقابة', 'audit', 'activity', 'log', 'trail'],
    description: 'تتبع كافة الحركات والتعديلات وحالات الحذف وهوية المستخدمين وسجل التغييرات'
  },
  {
    id: 'settings',
    titleAr: 'إعدادات النظام والنسخ الاحتياطي',
    titleEn: 'System Settings & Backups',
    category: 'عام',
    keywords: ['إعدادات', 'خيارات', 'تخصيص', 'نسخ احتياطي', 'استعادة', 'settings', 'backup'],
    description: 'ضبط خيارات النظام العامة، الضرائب، المجلدات والنسخ الاحتياطي'
  }
];

export type VoiceSearchTab = 'all' | 'invoices' | 'vouchers' | 'partners' | 'items' | 'accounts' | 'screens';

interface VoiceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (viewId: string | null) => void;
  onSelectAccount?: (account: Account) => void;
}

export default function VoiceSearchModal({
  isOpen,
  onClose,
  onNavigate,
  onSelectAccount
}: VoiceSearchModalProps) {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceFeedbackEnabled, setIsVoiceFeedbackEnabled] = useState(true);

  // Loaded Data Sources
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<StoredSalesInvoiceRecord[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<StoredPurchaseInvoiceRecord[]>([]);
  const [receiptVouchers, setReceiptVouchers] = useState<StoredVoucherRecord[]>([]);
  const [paymentVouchers, setPaymentVouchers] = useState<StoredVoucherRecord[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [activeTab, setActiveTab] = useState<VoiceSearchTab>('all');

  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSpokenTextRef = useRef<string>('');

  // Arabic Text-to-Speech (TTS) Voice Synthesis
  const speakArabic = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      if (!text || !isVoiceFeedbackEnabled) return;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Select Arabic voice if available
      const voices = window.speechSynthesis.getVoices();
      const arabicVoice = voices.find(v => v.lang.startsWith('ar') || v.name.toLowerCase().includes('arabic') || v.name.toLowerCase().includes('tariq') || v.name.toLowerCase().includes('maged') || v.name.toLowerCase().includes('laila') || v.name.toLowerCase().includes('salma'));
      if (arabicVoice) {
        utterance.voice = arabicVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  // Load All Entities from Local Storage & Stores on modal open
  useEffect(() => {
    if (!isOpen) return;
    try {
      setAccounts(loadChartOfAccounts() || []);
      setCustomers(loadCustomers() || []);
      setVendors(loadVendors() || []);
      setSalesInvoices(loadSalesInvoices() || []);
      setPurchaseInvoices(loadPurchaseInvoices() || []);
      setReceiptVouchers(loadReceiptVouchers() || []);
      setPaymentVouchers(loadPaymentVouchers() || []);
      setItems(loadStoredItems() || []);
    } catch (err) {
      console.error('Failed to load search data:', err);
    }
  }, [isOpen]);

  // Check speech recognition support
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  // Clean voice search spoken command prefixes
  const cleanSpokenCommand = (text: string) => {
    let clean = text;
    const prefixes = [
      'ابحث عن فاتورة',
      'ابحث عن سند',
      'ابحث عن عميل',
      'ابحث عن مورد',
      'ابحث عن صنف',
      'ابحث عن حساب',
      'ابحث عن',
      'افتح لي شاشة',
      'افتح شاشة',
      'افتح لي',
      'افتح',
      'انتقل إلى شاشة',
      'انتقل الى شاشة',
      'انتقل إلى',
      'انتقل الى',
      'اذهب إلى شاشة',
      'اذهب الى شاشة',
      'اذهب إلى',
      'اذهب الى',
      'شاشة',
      'ودني على',
      'ودني إلى',
      'فاتورة رقم',
      'سند رقم',
      'كود صنف',
      'حساب رقم',
      'حساب'
    ];

    for (const prefix of prefixes) {
      if (clean.startsWith(prefix)) {
        clean = clean.slice(prefix.length).trim();
        break;
      }
    }
    return clean;
  };

  // Start Voice Listening
  const startListening = () => {
    setVoiceError(null);
    if (typeof window === 'undefined') return;

    const SpeechRecognition = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError('خاصية التعرف على الصوت غير مدعومة في هذا المتصفح. يمكنك كتابة الكلمات للبحث مباشرة.');
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceError(null);
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            final += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }

        if (interim) {
          setInterimText(interim);
        }

        if (final) {
          const raw = final.trim();
          const cleaned = cleanSpokenCommand(raw) || raw;
          setTranscript(cleaned);
          setInterimText('');
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setVoiceError('تم رفض إذن الوصول إلى الميكروفون. يرجى السماح للمتصفح بالوصول للميكروفون من شريط المتصفح.');
        } else if (event.error === 'no-speech') {
          setVoiceError('لم يتم التقاط أي صوت، يرجى المحاولة والتحدث بالقرب من الميكروفون.');
        } else {
          setVoiceError(`تعذر التعرف على الصوت (${event.error}). يمكنك المحاولة مجدداً أو كتابة البحث.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setIsListening(false);
      setVoiceError('حدث خطأ أثناء تشغيل الميكروفون: ' + (err.message || ''));
    }
  };

  // Stop Voice Listening
  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
  };

  // Trigger listen on open
  useEffect(() => {
    if (isOpen) {
      setTranscript('');
      setInterimText('');
      setVoiceError(null);
      lastSpokenTextRef.current = '';
      setTimeout(() => {
        inputRef.current?.focus();
        startListening();
      }, 300);
    } else {
      stopListening();
      stopSpeaking();
    }

    return () => {
      stopListening();
      stopSpeaking();
    };
  }, [isOpen]);

  // Compute Filtered Results across all entities
  const searchResults = useMemo(() => {
    const query = transcript.trim().toLowerCase();

    // 1. Screens Filter
    const matchedScreens = (!query) 
      ? SYSTEM_SCREENS.slice(0, 4)
      : SYSTEM_SCREENS.filter(screen => {
          const matchTitleAr = screen.titleAr.toLowerCase().includes(query);
          const matchTitleEn = screen.titleEn.toLowerCase().includes(query);
          const matchDesc = screen.description.toLowerCase().includes(query);
          const matchKeywords = screen.keywords.some(k => query.includes(k) || k.includes(query));
          return matchTitleAr || matchTitleEn || matchDesc || matchKeywords;
        });

    // 2. Accounts Filter
    const matchedAccounts = (!query)
      ? accounts.slice(0, 4)
      : accounts.filter(acc => 
          acc.code.toLowerCase().includes(query) || 
          acc.name.toLowerCase().includes(query)
        );

    // 3. Customers Filter
    const matchedCustomers = (!query)
      ? customers.slice(0, 4)
      : customers.filter(c => 
          (c.name && c.name.toLowerCase().includes(query)) ||
          (c.code && c.code.toLowerCase().includes(query)) ||
          (c.phone && c.phone.includes(query)) ||
          (c.taxNumber && c.taxNumber.includes(query))
        );

    // 4. Vendors Filter
    const matchedVendors = (!query)
      ? vendors.slice(0, 4)
      : vendors.filter(v => 
          (v.name && v.name.toLowerCase().includes(query)) ||
          (v.code && v.code.toLowerCase().includes(query)) ||
          (v.phone && v.phone.includes(query)) ||
          (v.taxNumber && v.taxNumber.includes(query))
        );

    // 5. Sales & Purchases Invoices Filter
    const matchedSales = (!query)
      ? salesInvoices.slice(0, 3)
      : salesInvoices.filter(inv => 
          (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(query)) ||
          (inv.partnerName && inv.partnerName.toLowerCase().includes(query)) ||
          (inv.date && inv.date.includes(query)) ||
          (inv.totals?.grandTotal && String(inv.totals.grandTotal).includes(query)) ||
          (inv.items && inv.items.some((it: any) => it.description?.toLowerCase().includes(query) || it.name?.toLowerCase().includes(query)))
        );

    const matchedPurchases = (!query)
      ? purchaseInvoices.slice(0, 3)
      : purchaseInvoices.filter(inv => 
          (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(query)) ||
          (inv.supplierRef && inv.supplierRef.toLowerCase().includes(query)) ||
          (inv.partnerName && inv.partnerName.toLowerCase().includes(query)) ||
          (inv.date && inv.date.includes(query))
        );

    // 6. Vouchers Filter
    const matchedReceipts = (!query)
      ? receiptVouchers.slice(0, 3)
      : receiptVouchers.filter(v => 
          (v.voucherNumber && v.voucherNumber.toLowerCase().includes(query)) ||
          (v.partnerName && v.partnerName.toLowerCase().includes(query)) ||
          (v.description && v.description.toLowerCase().includes(query)) ||
          (v.amount && String(v.amount).includes(query))
        );

    const matchedPayments = (!query)
      ? paymentVouchers.slice(0, 3)
      : paymentVouchers.filter(v => 
          (v.voucherNumber && v.voucherNumber.toLowerCase().includes(query)) ||
          (v.partnerName && v.partnerName.toLowerCase().includes(query)) ||
          (v.description && v.description.toLowerCase().includes(query)) ||
          (v.amount && String(v.amount).includes(query))
        );

    // 7. Items / Products Filter
    const matchedItems = (!query)
      ? items.slice(0, 4)
      : items.filter(it => 
          (it.name && it.name.toLowerCase().includes(query)) ||
          (it.code && it.code.toLowerCase().includes(query)) ||
          (it.barcode && it.barcode.toLowerCase().includes(query)) ||
          (it.category && it.category.toLowerCase().includes(query)) ||
          (it.supplierName && it.supplierName.toLowerCase().includes(query))
        );

    const totalInvoicesCount = matchedSales.length + matchedPurchases.length;
    const totalVouchersCount = matchedReceipts.length + matchedPayments.length;
    const totalPartnersCount = matchedCustomers.length + matchedVendors.length;
    const totalItemsCount = matchedItems.length;
    const totalAccountsCount = matchedAccounts.length;
    const totalScreensCount = matchedScreens.length;

    const totalResults = totalInvoicesCount + totalVouchersCount + totalPartnersCount + totalItemsCount + totalAccountsCount + totalScreensCount;

    // Detect direct Voice Action Intent
    const parsedAction = parseVoiceAction(transcript, {
      customers,
      vendors,
      items,
      accounts
    });

    // Detect direct Instant Financial Q&A
    const financialQA = evaluateFinancialQA(transcript, {
      customers,
      vendors,
      salesInvoices,
      purchaseInvoices,
      receiptVouchers,
      paymentVouchers,
      items,
      accounts,
      currencySymbol
    });

    return {
      screens: matchedScreens,
      accounts: matchedAccounts,
      customers: matchedCustomers,
      vendors: matchedVendors,
      salesInvoices: matchedSales,
      purchaseInvoices: matchedPurchases,
      receiptVouchers: matchedReceipts,
      paymentVouchers: matchedPayments,
      items: matchedItems,
      parsedAction,
      financialQA,
      counts: {
        total: totalResults,
        invoices: totalInvoicesCount,
        vouchers: totalVouchersCount,
        partners: totalPartnersCount,
        items: totalItemsCount,
        accounts: totalAccountsCount,
        screens: totalScreensCount
      }
    };
  }, [transcript, accounts, customers, vendors, salesInvoices, purchaseInvoices, receiptVouchers, paymentVouchers, items, currencySymbol]);

  // Automatically read out the answer / action result if voice feedback is enabled and transcript is final
  useEffect(() => {
    if (!isOpen || !isVoiceFeedbackEnabled) return;

    if (searchResults.financialQA) {
      const textToSpeak = `${searchResults.financialQA.answerText}. ${searchResults.financialQA.primaryValue}`;
      if (lastSpokenTextRef.current !== textToSpeak) {
        lastSpokenTextRef.current = textToSpeak;
        // Small delay to ensure smooth transition after user finishes speaking
        const timer = setTimeout(() => {
          speakArabic(textToSpeak);
        }, 350);
        return () => clearTimeout(timer);
      }
    } else if (searchResults.parsedAction) {
      const textToSpeak = `${searchResults.parsedAction.labelAr}. ${searchResults.parsedAction.summary}`;
      if (lastSpokenTextRef.current !== textToSpeak) {
        lastSpokenTextRef.current = textToSpeak;
        const timer = setTimeout(() => {
          speakArabic(textToSpeak);
        }, 350);
        return () => clearTimeout(timer);
      }
    }
  }, [searchResults.financialQA, searchResults.parsedAction, isOpen, isVoiceFeedbackEnabled]);

  if (!isOpen) return null;

  // Handlers for selection & navigation
  const handleSelectScreen = (screenId: string) => {
    stopListening();
    onClose();
    if (screenId === 'dashboard') {
      onNavigate(null);
    } else {
      onNavigate(screenId);
    }
  };

  const handleSelectAccount = (acc: Account) => {
    stopListening();
    onClose();
    if (onSelectAccount) {
      onSelectAccount(acc);
    } else {
      onNavigate('chartTree');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('alpha-select-account', { detail: { account: acc } }));
      }, 200);
    }
  };

  const handleSelectCustomer = (customer: any) => {
    stopListening();
    onClose();
    onNavigate('customers');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('alpha-highlight-customer', { detail: { customer } }));
    }, 200);
  };

  const handleSelectVendor = (vendor: any) => {
    stopListening();
    onClose();
    onNavigate('vendors');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('alpha-highlight-vendor', { detail: { vendor } }));
    }, 200);
  };

  const handleSelectSalesInvoice = (inv: StoredSalesInvoiceRecord) => {
    stopListening();
    onClose();
    onNavigate('sales');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('alpha-highlight-sales-invoice', { detail: { invoice: inv } }));
    }, 200);
  };

  const handleSelectPurchaseInvoice = (inv: StoredPurchaseInvoiceRecord) => {
    stopListening();
    onClose();
    onNavigate('purchases');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('alpha-highlight-purchase-invoice', { detail: { invoice: inv } }));
    }, 200);
  };

  const handleSelectReceiptVoucher = (voucher: StoredVoucherRecord) => {
    stopListening();
    onClose();
    onNavigate('externalReceipt');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('alpha-highlight-voucher', { detail: { voucher } }));
    }, 200);
  };

  const handleSelectPaymentVoucher = (voucher: StoredVoucherRecord) => {
    stopListening();
    onClose();
    onNavigate('externalPayment');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('alpha-highlight-voucher', { detail: { voucher } }));
    }, 200);
  };

  const handleSelectItem = (item: Item) => {
    stopListening();
    onClose();
    onNavigate('items');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('alpha-highlight-item', { detail: { item } }));
    }, 200);
  };

  // Execute Smart Voice Action (Create Invoice, Voucher, Journal, etc.)
  const handleExecuteVoiceAction = (action: ParsedVoiceAction) => {
    stopListening();
    onClose();

    if (action.type === 'CREATE_SALES_INVOICE') {
      onNavigate('sales');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('alpha-voice-create-sales-invoice', { detail: action.payload }));
      }, 250);
    } else if (action.type === 'CREATE_PURCHASE_INVOICE') {
      onNavigate('purchases');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('alpha-voice-create-purchase-invoice', { detail: action.payload }));
      }, 250);
    } else if (action.type === 'CREATE_RECEIPT_VOUCHER') {
      onNavigate('externalReceipt');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('alpha-voice-create-voucher', { detail: action.payload }));
      }, 250);
    } else if (action.type === 'CREATE_PAYMENT_VOUCHER') {
      onNavigate('externalPayment');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('alpha-voice-create-voucher', { detail: action.payload }));
      }, 250);
    } else if (action.type === 'CREATE_JOURNAL_ENTRY') {
      onNavigate('journal');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('alpha-voice-create-journal-entry', { detail: action.payload }));
      }, 250);
    }
  };

  // Quick preset voice queries, action triggers, and Financial Q&A
  const presetQueries = [
    { label: '💰 كم رصيد الصندوق؟', query: 'كم رصيد الصندوق' },
    { label: '📈 كم مبيعات اليوم؟', query: 'كم مبيعات اليوم' },
    { label: '⚠️ أصناف أوشكت على النفاد', query: 'ما هي الأصناف التي أوشكت على النفاد' },
    { label: '✨ إنشاء فاتورة مبيعات', query: 'انشئ فاتورة مبيعات جديدة' },
    { label: '✨ سند قبض نقدي', query: 'تحرير سند قبض جديد بمبلغ 1000' },
    { label: '✨ سند صرف لمورد', query: 'سند صرف جديد لمورد' },
    { label: 'فواتير المبيعات', query: 'مبيعات' },
    { label: 'سندات القبض', query: 'سند قبض' },
    { label: 'العملاء والمدينين', query: 'عملاء' },
    { label: 'الموردين والدائنين', query: 'موردين' },
    { label: 'شجرة الحسابات', query: 'شجرة الحسابات' }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] md:max-h-[90vh] text-right font-sans animate-modalIn"
        onClick={e => e.stopPropagation()}
        dir="rtl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 sm:p-5 flex items-center justify-between shrink-0 border-b border-indigo-950/60">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner transition-all duration-300 shrink-0 ${
              isListening 
                ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/50' 
                : isSpeaking
                  ? 'bg-emerald-500 text-white animate-pulse shadow-emerald-500/50'
                  : 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
            }`}>
              {isListening ? <Mic size={20} /> : isSpeaking ? <Volume2 size={20} className="animate-bounce" /> : <Sparkles size={20} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-sm sm:text-base md:text-lg text-white tracking-wide truncate">
                  البحث الصوتي الذكي الشامل
                </h3>
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-2.5 py-0.5 rounded-full border border-indigo-400/30 font-bold shrink-0">
                  Universal AI Search
                </span>
                {isSpeaking && (
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2.5 py-0.5 rounded-full border border-emerald-400/30 font-bold flex items-center gap-1 animate-pulse">
                    <Volume2 size={11} />
                    <span>جارٍ نطق الإجابة...</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate sm:overflow-visible sm:whitespace-normal">
                ابحث بالصوت أو النص في الفواتير، السندات، العملاء، الموردين، الأصناف، وشاشات النظام
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Feedback Toggle */}
            <button
              type="button"
              onClick={() => {
                if (isSpeaking) stopSpeaking();
                setIsVoiceFeedbackEnabled(!isVoiceFeedbackEnabled);
              }}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                isVoiceFeedbackEnabled 
                  ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-200 hover:bg-indigo-500/30' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
              title={isVoiceFeedbackEnabled ? 'الرد الصوتي الناطق مفعّل (انقر للتعطيل)' : 'الرد الصوتي الناطق معطل (انقر للتفعيل)'}
            >
              {isVoiceFeedbackEnabled ? <Volume2 size={15} className="text-teal-400" /> : <VolumeX size={15} />}
              <span className="hidden sm:inline">{isVoiceFeedbackEnabled ? 'الرد الصوتي' : 'كتم الصوت'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                onClose();
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
              title="إغلاق (Esc)"
              aria-label="إغلاق"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Voice Input & Search Bar Box */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200/80 shrink-0">
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={interimText ? `${transcript} (${interimText}...)` : transcript}
              onChange={(e) => {
                setTranscript(e.target.value);
                setInterimText('');
              }}
              placeholder={isListening ? 'جارٍ الاستماع إليك... تحدث باسم العميل، رقم الفاتورة، الصنف، أو السند' : 'تحدث أو اكتب للبحث (مثال: أحمد، فاتورة 001، لابتوب، سند صرف، 1101)...'}
              className={`w-full bg-white border-2 rounded-2xl py-3.5 pr-12 pl-24 text-sm sm:text-base outline-none transition-all ${
                isListening 
                  ? 'border-rose-500 ring-4 ring-rose-500/10 placeholder:text-rose-400' 
                  : 'border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10'
              }`}
            />
            
            <Search size={20} className="absolute right-4 text-slate-400 pointer-events-none" />

            <div className="absolute left-2.5 flex items-center gap-1">
              {transcript && (
                <button
                  type="button"
                  onClick={() => {
                    setTranscript('');
                    setInterimText('');
                    inputRef.current?.focus();
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="مسح النص"
                >
                  <X size={16} />
                </button>
              )}

              {/* Mic Action Button */}
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={`p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  isListening
                    ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-600/30 animate-bounce'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20'
                }`}
                title={isListening ? 'إيقاف الاستماع' : 'بدء الاستماع الصوتي'}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            </div>
          </div>

          {/* Voice Listening Feedback Waves */}
          {isListening && (
            <div className="flex items-center justify-between mt-3 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 animate-fadeIn">
              <div className="flex items-center gap-2 font-medium">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
                </span>
                <span>الميكروفون نشط... تحدث بأي اسم عميل، مورد، صنف، أو رقم فاتورة الآن</span>
              </div>
              <button
                type="button"
                onClick={stopListening}
                className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
              >
                إنهاء الاستماع
              </button>
            </div>
          )}

          {/* Unsupported Browser Notice */}
          {!isSupported && (
            <div className="flex items-start gap-2 mt-3 p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700">
              <AlertCircle size={16} className="text-slate-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>متصفحك الحالي لا يدعم التعرف الصوتي المباشر (Web Speech API). يمكنك الكتابة يدوياً في خانة البحث أعلاه.</span>
              </div>
            </div>
          )}

          {/* Voice Error Display */}
          {voiceError && (
            <div className="flex items-start gap-2 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 animate-fadeIn">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{voiceError}</span>
              </div>
              <button
                type="button"
                onClick={() => setVoiceError(null)}
                className="text-amber-600 hover:text-amber-900 p-0.5"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Quick preset chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar mt-3 pt-1 pb-0.5 text-xs">
            <span className="text-slate-400 text-[11px] shrink-0 font-medium ml-1">اقتراحات صوتية:</span>
            {presetQueries.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setTranscript(item.query);
                  inputRef.current?.focus();
                }}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 border border-slate-200 text-xs shrink-0 transition-all font-medium cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Tabs Header */}
        <div className="flex items-center gap-1 px-4 sm:px-6 border-b border-slate-200 bg-white shrink-0 text-xs sm:text-sm font-bold overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`py-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'all'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>الكل</span>
            <span className="bg-slate-100 text-slate-600 text-[11px] px-1.5 py-0.5 rounded-full font-mono">
              {searchResults.counts.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={`py-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'invoices'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText size={14} className="text-blue-500" />
            <span>الفواتير</span>
            <span className="bg-blue-50 text-blue-700 text-[11px] px-1.5 py-0.5 rounded-full font-mono">
              {searchResults.counts.invoices}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vouchers')}
            className={`py-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'vouchers'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt size={14} className="text-emerald-500" />
            <span>السندات المالية</span>
            <span className="bg-emerald-50 text-emerald-700 text-[11px] px-1.5 py-0.5 rounded-full font-mono">
              {searchResults.counts.vouchers}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('partners')}
            className={`py-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'partners'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users size={14} className="text-purple-500" />
            <span>العملاء والموردين</span>
            <span className="bg-purple-50 text-purple-700 text-[11px] px-1.5 py-0.5 rounded-full font-mono">
              {searchResults.counts.partners}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`py-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'items'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package size={14} className="text-amber-500" />
            <span>الأصناف والمنتجات</span>
            <span className="bg-amber-50 text-amber-700 text-[11px] px-1.5 py-0.5 rounded-full font-mono">
              {searchResults.counts.items}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('accounts')}
            className={`py-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'accounts'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderTree size={14} className="text-teal-500" />
            <span>شجرة الحسابات</span>
            <span className="bg-teal-50 text-teal-700 text-[11px] px-1.5 py-0.5 rounded-full font-mono">
              {searchResults.counts.accounts}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('screens')}
            className={`py-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'screens'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutDashboard size={14} className="text-slate-600" />
            <span>الشاشات</span>
            <span className="bg-slate-100 text-slate-700 text-[11px] px-1.5 py-0.5 rounded-full font-mono">
              {searchResults.counts.screens}
            </span>
          </button>
        </div>

        {/* Results List Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-slate-50/50">
          
          {/* SPECIAL SECTION: INSTANT FINANCIAL VOICE Q&A (الميزة الثانية) */}
          {searchResults.financialQA && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-white shadow-2xl border border-teal-500/40 animate-fadeIn">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-500/30 shrink-0">
                    <Sparkles size={20} className="text-teal-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-400/20 text-teal-300 border border-teal-400/30">
                        استعلام مالي صوتي فوري (Voice Q&A)
                      </span>
                      {searchResults.financialQA.statusBadge && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">
                          {searchResults.financialQA.statusBadge.text}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs text-slate-300 font-medium mt-0.5">
                      {searchResults.financialQA.answerText}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Replay Voice Audio Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isSpeaking) {
                        stopSpeaking();
                      } else {
                        speakArabic(`${searchResults.financialQA!.answerText}. ${searchResults.financialQA!.primaryValue}`);
                      }
                    }}
                    className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                      isSpeaking 
                        ? 'bg-emerald-500 text-white border-emerald-400 animate-pulse' 
                        : 'bg-white/10 hover:bg-white/20 text-slate-300 border-white/10'
                    }`}
                    title={isSpeaking ? 'إيقاف نطق الإجابة' : 'نطق الإجابة صوتياً'}
                  >
                    <Volume2 size={15} className={isSpeaking ? 'animate-bounce' : 'text-teal-300'} />
                  </button>

                  {searchResults.financialQA.navigationView && (
                    <button
                      type="button"
                      onClick={() => {
                        stopListening();
                        stopSpeaking();
                        onClose();
                        onNavigate(searchResults.financialQA!.navigationView!);
                      }}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-teal-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-white/10 cursor-pointer"
                    >
                      <span>{searchResults.financialQA.navigationLabel || 'عرض التفاصيل'}</span>
                      <ArrowUpRight size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Main Metric Banner */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 sm:p-4 mb-3">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
                    {searchResults.financialQA.primaryValue}
                  </span>
                  {searchResults.financialQA.secondaryValue && (
                    <span className="text-xs font-bold text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                      {searchResults.financialQA.secondaryValue}
                    </span>
                  )}
                </div>
              </div>

              {/* Breakdown Details Grid if present */}
              {searchResults.financialQA.details && searchResults.financialQA.details.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {searchResults.financialQA.details.map((dt, idx) => (
                    <div key={idx} className="bg-black/30 px-3 py-2 rounded-lg border border-white/5 flex items-center justify-between gap-2">
                      <span className="text-slate-400">{dt.label}</span>
                      <strong className="text-slate-100 font-medium">{dt.value}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SPECIAL SECTION: DETECTED SMART VOICE ACTION */}
          {searchResults.parsedAction && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-500/40 animate-fadeIn">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-md font-bold mt-0.5">
                    <Zap size={22} className="fill-slate-950" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="bg-amber-400/20 text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-400/40">
                        إجراء ذكي مقترح (Voice Action)
                      </span>
                      <h4 className="font-extrabold text-sm sm:text-base text-white">
                        {searchResults.parsedAction.labelAr}
                      </h4>
                    </div>
                    <p className="text-xs text-indigo-200 leading-relaxed font-medium">
                      {searchResults.parsedAction.summary}
                    </p>

                    {searchResults.parsedAction.payload.partner && (
                      <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-300 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 w-fit">
                        <Users size={14} className="text-amber-400" />
                        <span>الطرف المالي: <strong className="text-white font-bold">{searchResults.parsedAction.payload.partner.name}</strong></span>
                        {searchResults.parsedAction.payload.amount && (
                          <>
                            <span className="text-slate-500">•</span>
                            <span>المبلغ: <strong className="text-emerald-400 font-mono font-bold">{searchResults.parsedAction.payload.amount.toLocaleString()}</strong></span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Replay Action Voice Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isSpeaking) {
                        stopSpeaking();
                      } else {
                        speakArabic(`${searchResults.parsedAction!.labelAr}. ${searchResults.parsedAction!.summary}`);
                      }
                    }}
                    className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                      isSpeaking 
                        ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse' 
                        : 'bg-white/10 hover:bg-white/20 text-amber-300 border-white/10'
                    }`}
                    title={isSpeaking ? 'إيقاف نطق الإجراء' : 'نطق الإجراء المقترح صوتياً'}
                  >
                    <Volume2 size={16} className={isSpeaking ? 'animate-bounce' : ''} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      stopSpeaking();
                      handleExecuteVoiceAction(searchResults.parsedAction!);
                    }}
                    className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-950/40 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                  >
                    <Play size={15} className="fill-white" />
                    <span>تنفيذ الإجراء فوراً</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 1: INVOICES (Sales & Purchases) */}
          {(activeTab === 'all' || activeTab === 'invoices') && (searchResults.salesInvoices.length > 0 || searchResults.purchaseInvoices.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <FileText size={15} className="text-blue-600" />
                  الفواتير الضريبية والمشتريات ({searchResults.counts.invoices})
                </span>
                <span className="text-[11px] text-slate-400">انقر للفتح والمعاينة</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Sales Invoices */}
                {searchResults.salesInvoices.map((inv) => (
                  <div
                    key={`sales-${inv.id || inv.invoiceNumber}`}
                    onClick={() => handleSelectSalesInvoice(inv)}
                    className="group bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex items-start justify-between gap-3 text-right"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                          فاتورة مبيعات
                        </span>
                        <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                          #{inv.invoiceNumber}
                        </span>
                        {inv.status === 'POSTED' ? (
                          <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">مرحلة</span>
                        ) : (
                          <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">مسودة</span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                        {inv.partnerName || 'عميل نقدي'}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span>{inv.date}</span>
                        <span className="font-mono font-black text-blue-600">
                          {(inv.totals?.grandTotal || 0).toLocaleString()} {currencySymbol}
                        </span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-blue-50 group-hover:bg-blue-600 group-hover:text-white text-blue-600 flex items-center justify-center shrink-0 transition-colors mt-1">
                      <ArrowRight size={16} />
                    </div>
                  </div>
                ))}

                {/* Purchase Invoices */}
                {searchResults.purchaseInvoices.map((inv) => (
                  <div
                    key={`purch-${inv.id || inv.invoiceNumber}`}
                    onClick={() => handleSelectPurchaseInvoice(inv)}
                    className="group bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer flex items-start justify-between gap-3 text-right"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                          فاتورة مشتريات
                        </span>
                        <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                          #{inv.invoiceNumber}
                        </span>
                        {inv.supplierRef && (
                          <span className="text-[10px] text-slate-500 font-mono">مرجع: {inv.supplierRef}</span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-slate-800 group-hover:text-indigo-600 transition-colors truncate">
                        {inv.partnerName || 'مورد'}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span>{inv.date}</span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white text-indigo-600 flex items-center justify-center shrink-0 transition-colors mt-1">
                      <ArrowRight size={16} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 2: FINANCIAL VOUCHERS (Receipts & Payments) */}
          {(activeTab === 'all' || activeTab === 'vouchers') && (searchResults.receiptVouchers.length > 0 || searchResults.paymentVouchers.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Receipt size={15} className="text-emerald-600" />
                  السندات المالية وسندات القبض والصرف ({searchResults.counts.vouchers})
                </span>
                <span className="text-[11px] text-slate-400">انقر لفتح السند</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Receipts */}
                {searchResults.receiptVouchers.map((v) => (
                  <div
                    key={`rcv-${v.id || v.voucherNumber}`}
                    onClick={() => handleSelectReceiptVoucher(v)}
                    className="group bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer flex items-start justify-between gap-3 text-right"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          سند قبض
                        </span>
                        <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                          #{v.voucherNumber}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-800 group-hover:text-emerald-600 transition-colors truncate">
                        {v.partnerName || v.description || 'سند قبض مالي'}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span>{v.date}</span>
                        <span className="font-mono font-black text-emerald-600">
                          {(v.amount || 0).toLocaleString()} {currencySymbol}
                        </span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white text-emerald-600 flex items-center justify-center shrink-0 transition-colors mt-1">
                      <ArrowRight size={16} />
                    </div>
                  </div>
                ))}

                {/* Payments */}
                {searchResults.paymentVouchers.map((v) => (
                  <div
                    key={`pay-${v.id || v.voucherNumber}`}
                    onClick={() => handleSelectPaymentVoucher(v)}
                    className="group bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-rose-400 hover:shadow-md transition-all cursor-pointer flex items-start justify-between gap-3 text-right"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                          سند صرف
                        </span>
                        <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                          #{v.voucherNumber}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-800 group-hover:text-rose-600 transition-colors truncate">
                        {v.partnerName || v.description || 'سند صرف مالي'}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span>{v.date}</span>
                        <span className="font-mono font-black text-rose-600">
                          {(v.amount || 0).toLocaleString()} {currencySymbol}
                        </span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-rose-50 group-hover:bg-rose-600 group-hover:text-white text-rose-600 flex items-center justify-center shrink-0 transition-colors mt-1">
                      <ArrowRight size={16} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 3: PARTNERS (Customers & Vendors) */}
          {(activeTab === 'all' || activeTab === 'partners') && (searchResults.customers.length > 0 || searchResults.vendors.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Users size={15} className="text-purple-600" />
                  العملاء والموردين ({searchResults.counts.partners})
                </span>
                <span className="text-[11px] text-slate-400">انقر لعرض بطاقة الحساب</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Customers */}
                {searchResults.customers.map((c) => (
                  <div
                    key={`cust-${c.id || c.code}`}
                    onClick={() => handleSelectCustomer(c)}
                    className="group bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer flex items-start justify-between gap-3 text-right"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                          عميل
                        </span>
                        {c.code && (
                          <span className="font-mono font-bold text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            {c.code}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-slate-800 group-hover:text-purple-600 transition-colors truncate">
                        {c.name}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        {c.phone && <span className="flex items-center gap-1 font-mono"><Phone size={11} /> {c.phone}</span>}
                        {c.taxNumber && <span>ضريبي: {c.taxNumber}</span>}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-purple-50 group-hover:bg-purple-600 group-hover:text-white text-purple-600 flex items-center justify-center shrink-0 transition-colors mt-1">
                      <ArrowRight size={16} />
                    </div>
                  </div>
                ))}

                {/* Vendors */}
                {searchResults.vendors.map((v) => (
                  <div
                    key={`vend-${v.id || v.code}`}
                    onClick={() => handleSelectVendor(v)}
                    className="group bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all cursor-pointer flex items-start justify-between gap-3 text-right"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
                          مورد
                        </span>
                        {v.code && (
                          <span className="font-mono font-bold text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            {v.code}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-slate-800 group-hover:text-teal-600 transition-colors truncate">
                        {v.name}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        {v.phone && <span className="flex items-center gap-1 font-mono"><Phone size={11} /> {v.phone}</span>}
                        {v.taxNumber && <span>ضريبي: {v.taxNumber}</span>}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-teal-50 group-hover:bg-teal-600 group-hover:text-white text-teal-600 flex items-center justify-center shrink-0 transition-colors mt-1">
                      <ArrowRight size={16} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 4: ITEMS & PRODUCTS */}
          {(activeTab === 'all' || activeTab === 'items') && searchResults.items.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Package size={15} className="text-amber-600" />
                  الأصناف والمنتجات المخزنية ({searchResults.counts.items})
                </span>
                <span className="text-[11px] text-slate-400">انقر للذهاب إلى الصنف والتعديل</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {searchResults.items.map((it) => (
                  <div
                    key={`item-${it.id || it.code}`}
                    onClick={() => handleSelectItem(it)}
                    className="group bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex items-start justify-between gap-3 text-right"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                          {it.category || 'صنف'}
                        </span>
                        <span className="font-mono font-bold text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          كود: {it.code}
                        </span>
                        {it.stock <= 0 ? (
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">نافذ</span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            رصيد: {it.stock} {it.unit || ''}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-slate-800 group-hover:text-amber-600 transition-colors truncate">
                        {it.name}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="font-mono font-black text-emerald-700">
                          سعر البيع: {(it.salePrice || 0).toLocaleString()} {currencySymbol}
                        </span>
                        {it.barcode && (
                          <span className="text-[11px] text-slate-400 font-mono">باركود: {it.barcode}</span>
                        )}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-amber-50 group-hover:bg-amber-600 group-hover:text-white text-amber-600 flex items-center justify-center shrink-0 transition-colors mt-1">
                      <ArrowRight size={16} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 5: ACCOUNTS TREE */}
          {(activeTab === 'all' || activeTab === 'accounts') && searchResults.accounts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <FolderTree size={15} className="text-teal-600" />
                  حسابات شجرة ودليل الحسابات ({searchResults.counts.accounts})
                </span>
                <span className="text-[11px] text-slate-400">انقر للعرض في الشجرة</span>
              </div>

              <div className="space-y-2">
                {searchResults.accounts.map((acc) => (
                  <div
                    key={`acc-${acc.id || acc.code}`}
                    onClick={() => handleSelectAccount(acc)}
                    className="group bg-white p-3 rounded-2xl border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-mono font-bold text-xs shrink-0 border border-teal-200">
                        {acc.code}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-800 group-hover:text-teal-700 transition-colors truncate">
                            {acc.name}
                          </h4>
                          {acc.isControlAccount && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                              مراقبة: {acc.controlType}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-sans">
                          النوع: {acc.type} • الطبيعة: {acc.balanceType === 'DEBIT' ? 'مدين' : 'دائن'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-teal-600 font-bold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>عرض في الشجرة</span>
                      <CornerDownLeft size={14} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 6: SYSTEM SCREENS */}
          {(activeTab === 'all' || activeTab === 'screens') && searchResults.screens.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <LayoutDashboard size={15} className="text-indigo-600" />
                  شاشات ووحدات النظام ({searchResults.counts.screens})
                </span>
                <span className="text-[11px] text-slate-400">انقر للفتح المباشر</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {searchResults.screens.map((screen) => (
                  <div
                    key={`screen-${screen.id}`}
                    onClick={() => handleSelectScreen(screen.id)}
                    className="group bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer flex items-start justify-between gap-3 text-right"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                          {screen.category}
                        </span>
                        <h4 className="font-bold text-sm text-slate-800 group-hover:text-indigo-600 transition-colors truncate">
                          {screen.titleAr}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1 leading-relaxed">
                        {screen.description}
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-indigo-600 group-hover:text-white text-slate-400 flex items-center justify-center shrink-0 transition-colors mt-0.5">
                      <ArrowRight size={16} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EMPTY STATE */}
          {searchResults.counts.total === 0 && (
            <div className="py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Search size={24} />
              </div>
              <h4 className="font-bold text-slate-700 text-base mb-1">
                لا توجد نتائج مطابقة لـ "{transcript}"
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4 leading-relaxed">
                جرب التحدث بكلمات أخرى مثل: اسم العميل أو المورد، اسم الصنف أو الباركود، رقم الفاتورة أو السند.
              </p>
              <button
                type="button"
                onClick={startListening}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                <Mic size={15} />
                <span>إعادة المحاولة بالصوت</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer / Instructions */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Volume2 size={15} className="text-indigo-600 shrink-0" />
            <span className="text-[11px] sm:text-xs">
              أمثلة صوتية: <strong>«فاتورة رقم 001»</strong> • <strong>«عميل أحمد»</strong> • <strong>«سند صرف»</strong> • <strong>«صنف لابتوب»</strong>
            </span>
          </div>
          <div className="flex items-center gap-3 mr-auto text-[11px] text-slate-400">
            <span>مدعوم بمحرك البحث الصوتي الذكي Web Speech API</span>
          </div>
        </div>
      </div>
    </div>
  );
}
