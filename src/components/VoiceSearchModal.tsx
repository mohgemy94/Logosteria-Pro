import { useState, useEffect, useRef } from 'react';
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
  AlertCircle,
  CornerDownLeft
} from 'lucide-react';
import { loadChartOfAccounts } from '../utils/trialBalanceStore';
import { Account } from '../types/accounting';

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
    id: 'settings',
    titleAr: 'إعدادات النظام والنسخ الاحتياطي',
    titleEn: 'System Settings & Backups',
    category: 'عام',
    keywords: ['إعدادات', 'خيارات', 'تخصيص', 'نسخ احتياطي', 'استعادة', 'settings', 'backup'],
    description: 'ضبط خيارات النظام العامة، الضرائب، المجلدات والنسخ الاحتياطي'
  }
];

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
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [matchedScreens, setMatchedScreens] = useState<SystemScreenItem[]>([]);
  const [matchedAccounts, setMatchedAccounts] = useState<Account[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'screens' | 'accounts'>('all');

  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load chart of accounts
  useEffect(() => {
    try {
      const accList = loadChartOfAccounts();
      setAccounts(accList || []);
    } catch {
      setAccounts([]);
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

  // Filter logic whenever transcript or input changes
  useEffect(() => {
    const query = transcript.trim().toLowerCase();
    if (!query) {
      setMatchedScreens(SYSTEM_SCREENS.slice(0, 5));
      setMatchedAccounts(accounts.slice(0, 5));
      return;
    }

    // Filter screens
    const filteredScreens = SYSTEM_SCREENS.filter(screen => {
      const matchTitleAr = screen.titleAr.toLowerCase().includes(query);
      const matchTitleEn = screen.titleEn.toLowerCase().includes(query);
      const matchDesc = screen.description.toLowerCase().includes(query);
      const matchKeywords = screen.keywords.some(k => query.includes(k) || k.includes(query));
      return matchTitleAr || matchTitleEn || matchDesc || matchKeywords;
    });

    // Filter accounts
    const filteredAccounts = accounts.filter(acc => {
      const codeMatch = acc.code.toLowerCase().includes(query);
      const nameMatch = acc.name.toLowerCase().includes(query);
      return codeMatch || nameMatch;
    });

    setMatchedScreens(filteredScreens);
    setMatchedAccounts(filteredAccounts);
  }, [transcript, accounts]);

  // Clean voice search command words like "افتح", "اذهب الى", "شاشة", "حساب"
  const cleanSpokenCommand = (text: string) => {
    let clean = text;
    const prefixes = [
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
      'ابحث عن حساب',
      'ابحث عن',
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
      recognition.lang = 'ar-SA'; // Arabic Saudi Arabia
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
          setVoiceError('تم رفض إذن الوصول إلى الميكروفون. يرجى السماح للمتصفح بالوصول للميكروفون من شريط العنوان.');
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

  // Trigger listen on open if supported
  useEffect(() => {
    if (isOpen) {
      setTranscript('');
      setInterimText('');
      setVoiceError(null);
      setTimeout(() => {
        inputRef.current?.focus();
        startListening();
      }, 300);
    } else {
      stopListening();
    }

    return () => {
      stopListening();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle navigate to screen
  const handleSelectScreen = (screenId: string) => {
    stopListening();
    onClose();
    if (screenId === 'dashboard') {
      onNavigate(null);
    } else {
      onNavigate(screenId);
    }
  };

  // Handle select account
  const handleSelectAccount = (acc: Account) => {
    stopListening();
    onClose();
    if (onSelectAccount) {
      onSelectAccount(acc);
    } else {
      // Navigate to Chart of Accounts Tree or Trial Balance with custom search query
      onNavigate('chartTree');
      // Dispatch custom event to highlight or filter account in tree
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('alpha-select-account', { detail: { account: acc } }));
      }, 200);
    }
  };

  // Quick preset voice queries
  const presetQueries = [
    { label: 'شجرة الحسابات', query: 'شجرة الحسابات' },
    { label: 'فواتير المبيعات', query: 'مبيعات' },
    { label: 'سند قبض', query: 'سند قبض' },
    { label: 'أرصدة العملاء', query: 'أرصدة العملاء' },
    { label: 'حساب الصندوق', query: '1101' },
    { label: 'حساب البنك', query: 'بنك' },
    { label: 'إدارة التقسيط', query: 'تقسيط' },
    { label: 'الجرد المخزني', query: 'جرد' }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-fadeIn print-preview-modal-root"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] text-right font-sans animate-scaleUp"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0 border-b border-indigo-950/60">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner transition-all duration-300 ${
              isListening 
                ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/50' 
                : 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
            }`}>
              {isListening ? <Mic size={20} /> : <Sparkles size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white tracking-wide">
                  البحث الصوتي الذكي
                </h3>
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-2.5 py-0.5 rounded-full border border-indigo-400/30 font-bold">
                  Voice Assistant
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تحدث باسم أي شاشة أو رقم أو اسم حساب للوصول الفوري
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="إغلاق (Esc)"
          >
            <X size={20} />
          </button>
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
              placeholder={isListening ? 'جارٍ الاستماع إليك... تحدث الآن' : 'تحدث أو اكتب اسم الشاشة أو الحساب (مثال: مبيعات، سند قبض، 1101)...'}
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
                <span>الميكروفون نشط... تحدث بأي أمر أو اسم شاشة الآن</span>
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
            <span className="text-slate-400 text-[11px] shrink-0 font-medium ml-1">اقتراحات سريعة:</span>
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

        {/* Filter Tabs */}
        <div className="flex items-center px-4 sm:px-6 border-b border-slate-200 bg-white shrink-0 text-xs sm:text-sm font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`py-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>الكل</span>
            <span className="bg-slate-100 text-slate-600 text-[11px] px-1.5 py-0.5 rounded-full font-mono">
              {matchedScreens.length + matchedAccounts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('screens')}
            className={`py-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'screens'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutDashboard size={14} />
            <span>شاشات النظام</span>
            <span className="bg-indigo-50 text-indigo-700 text-[11px] px-1.5 py-0.5 rounded-full font-mono">
              {matchedScreens.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('accounts')}
            className={`py-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'accounts'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderTree size={14} />
            <span>حسابات الشجرة</span>
            <span className="bg-emerald-50 text-emerald-700 text-[11px] px-1.5 py-0.5 rounded-full font-mono">
              {matchedAccounts.length}
            </span>
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-slate-50/50">
          {/* Section: Screens */}
          {(activeTab === 'all' || activeTab === 'screens') && matchedScreens.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <LayoutDashboard size={14} className="text-indigo-600" />
                  شاشات ووحدات النظام ({matchedScreens.length})
                </span>
                <span className="text-[11px] text-slate-400">انقر للفتح المباشر</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {matchedScreens.map((screen) => (
                  <div
                    key={screen.id}
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

          {/* Section: Chart Accounts */}
          {(activeTab === 'all' || activeTab === 'accounts') && matchedAccounts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FolderTree size={14} className="text-emerald-600" />
                  حسابات شجرة ودليل الحسابات ({matchedAccounts.length})
                </span>
                <span className="text-[11px] text-slate-400">انقر للذهاب إلى الحساب</span>
              </div>

              <div className="space-y-2">
                {matchedAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    onClick={() => handleSelectAccount(acc)}
                    className="group bg-white p-3 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-mono font-bold text-xs shrink-0 border border-emerald-200">
                        {acc.code}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-800 group-hover:text-emerald-700 transition-colors truncate">
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

                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>عرض في الشجرة</span>
                      <CornerDownLeft size={14} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {matchedScreens.length === 0 && matchedAccounts.length === 0 && (
            <div className="py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Search size={24} />
              </div>
              <h4 className="font-bold text-slate-700 text-base mb-1">
                لا توجد نتائج مطابقة لـ "{transcript}"
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                جرب التحدث بكلمات أخرى مثل: "مبيعات"، "سند صرف"، "أرصدة العملاء"، أو اذكر رقم الكود المحاسبي.
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
              أمثلة صوتية: <strong>«افتح شجرة الحسابات»</strong> • <strong>«سند قبض»</strong> • <strong>«حساب البنك»</strong>
            </span>
          </div>
          <div className="flex items-center gap-3 mr-auto text-[11px] text-slate-400">
            <span>مدعوم بمحرك التعرف الصوتي الذكي Web Speech API</span>
          </div>
        </div>
      </div>
    </div>
  );
}
