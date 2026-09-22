import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  FileCode2, 
  Layers, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Building2, 
  BarChart3, 
  X,
  Loader2,
  Trash2,
  Plus,
  Edit2,
  Database,
  Mic,
  MicOff
} from 'lucide-react';
import { exportElementToPdf } from '../utils/pdfExport';
import { loadChartOfAccounts, saveChartOfAccounts } from '../utils/trialBalanceStore';
import { AccountType, BalanceType } from '../types/accounting';
import ExportButtonGroup from './ExportButtonGroup';
import { useSystemCurrency } from '../utils/currency';

export interface AccountTreeNode {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  level: number;
  isPosting: boolean;
  isActive: boolean;
  type: string;
  subLedgerType: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  children: AccountTreeNode[];
}

interface RollupModalData {
  accountCode: string;
  accountNameAr: string;
  level: number;
  total_debit: number;
  total_credit: number;
  net_balance: number;
  affectedAccountsCount: number;
}

// مكوّن العقدة الشجرية التكراري (Recursive Tree Node)
function TreeNodeItem({
  node,
  searchTerm,
  expandedIds,
  toggleExpand,
  onInspectRollup,
  onAddChild,
  onEditNode,
  currencySymbol = 'ر.س'
}: {
  node: AccountTreeNode;
  searchTerm: string;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  onInspectRollup: (code: string) => void;
  onAddChild: (node: AccountTreeNode) => void;
  onEditNode: (node: AccountTreeNode) => void;
  currencySymbol?: string;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);

  // تنسيق الأرقام المالية
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ar-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  // شارات التمييز حسب المستوى المحاسبي
  const getLevelBadge = (level: number, isPosting: boolean) => {
    switch (level) {
      case 1:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-blue-900 text-white shadow-xs">
            رئيسي (L1)
          </span>
        );
      case 2:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            عام (L2)
          </span>
        );
      case 3:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            مساعد (L3)
          </span>
        );
      case 4:
        return (
          <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-xs">
            <Building2 size={12} className="text-amber-700" />
            حساب فرعي تجميعي (L4)
          </span>
        );
      case 5:
        return (
          <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 border shadow-xs ${
            isPosting 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}>
            <CheckCircle2 size={12} className="text-emerald-600" />
            حساب تحليلي حركي (L5) • يقبل القيود
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
            مستوى {level}
          </span>
        );
    }
  };

  // تحديد ألوان الرصيد
  const getBalanceColor = (balance: number, type: string) => {
    if (balance === 0) return 'text-slate-400';
    if (['ASSET', 'EXPENSE'].includes(type)) {
      return balance > 0 ? 'text-blue-700' : 'text-rose-600';
    }
    return balance > 0 ? 'text-emerald-700' : 'text-rose-600';
  };

  return (
    <div className="select-none font-sans">
      <div 
        className={`group flex flex-col md:flex-row md:items-center justify-between py-2.5 md:py-2 px-2 md:px-3 my-1 md:my-0.5 rounded-xl transition-all duration-150 border ${
          node.level === 1 
            ? 'bg-slate-100/80 border-slate-300 font-bold hover:bg-slate-200/70' 
            : node.level === 4
            ? 'bg-amber-50/40 border-amber-200/80 hover:bg-amber-100/50'
            : node.level === 5
            ? 'bg-white border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/20'
            : 'bg-white/60 border-transparent hover:bg-slate-100/60'
        }`}
        style={{ paddingRight: `${Math.max(node.level * 12, 8)}px` }}
      >
        {/* الجانب الأيمن: زر التوسيع، الكود، الاسم، والشارات */}
        <div className="flex items-center gap-2 min-w-0 w-full md:w-auto flex-1">
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(node.id)}
              className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors cursor-pointer shrink-0"
              title={isExpanded ? 'طي الفرع' : 'فرد وتوسيع الفرع'}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <div className="w-6 shrink-0 flex items-center justify-center text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
            </div>
          )}

          {/* أيقونة الحالة */}
          <div className="shrink-0 text-slate-400 group-hover:text-blue-600 transition-colors">
            {node.level === 5 ? (
              <FileCode2 size={16} className="text-emerald-600" />
            ) : isExpanded ? (
              <FolderOpen size={16} className={node.level === 1 ? 'text-blue-700' : 'text-amber-600'} />
            ) : (
              <Folder size={16} className={node.level === 1 ? 'text-blue-700' : 'text-amber-600'} />
            )}
          </div>

          {/* الكود المحاسبي */}
          <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded tracking-wide shrink-0 ${
            node.level === 1 
              ? 'bg-slate-800 text-white' 
              : node.level === 4
              ? 'bg-amber-200 text-amber-900 border border-amber-300'
              : node.level === 5
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              : 'bg-slate-200 text-slate-700'
          }`}>
            {node.code}
          </span>

          {/* الاسم العربي */}
          <span className={`truncate text-xs sm:text-sm ${node.level === 1 ? 'text-slate-900 text-sm sm:text-base font-extrabold' : 'text-slate-800 font-semibold'}`}>
            {node.nameAr}
          </span>

          {/* شارة المستوى والميزات */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            {getLevelBadge(node.level, node.isPosting)}
            {node.subLedgerType !== 'NONE' && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-100 text-purple-800 border border-purple-200">
                أستاذ: {node.subLedgerType}
              </span>
            )}
          </div>
        </div>

        {/* الجانب الأيسر: الأرصدة (مدين، دائن، صافي) وأزرار الاستعلام */}
        <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4 shrink-0 text-xs mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-transparent border-slate-100/80">
          {/* إجمالي المدين والدائن المجمع */}
          <div className="hidden md:flex items-center gap-3 text-[11px] font-mono">
            <div className="text-left w-24">
              <span className="text-[10px] text-slate-400 block font-sans">إجمالي المدين</span>
              <span className="text-blue-600 font-bold">{formatCurrency(node.totalDebit)}</span>
            </div>
            <div className="text-left w-24">
              <span className="text-[10px] text-slate-400 block font-sans">إجمالي الدائن</span>
              <span className="text-purple-600 font-bold">{formatCurrency(node.totalCredit)}</span>
            </div>
          </div>

          {/* الرصيد التراكمي الصافي */}
          <div className="text-left flex-1 md:flex-none md:w-28 font-mono">
            <span className="text-[10px] text-slate-400 block font-sans">الرصيد الصافي</span>
            <span className={`font-extrabold text-sm ${getBalanceColor(node.balance, node.type)}`}>
              {formatCurrency(node.balance)}
              <span className="text-[10px] text-slate-400 font-sans mr-1">{currencySymbol}</span>
            </span>
          </div>

          
          {/* Action Buttons */}
          <div className="flex items-center gap-1 border-r border-slate-200 pr-2 mr-1">
            <button
              onClick={() => onEditNode(node)}
              className="p-1.5 rounded-md bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-100 transition-colors"
              title="تعديل الحساب"
            >
              <Edit2 size={13} />
            </button>
            {node.level < 5 && (
              <button
                onClick={() => onAddChild(node)}
                className="p-1.5 rounded-md bg-slate-50 text-slate-500 hover:text-emerald-600 hover:bg-emerald-100 transition-colors"
                title="إضافة حساب فرعي"
              >
                <Plus size={13} />
              </button>
            )}
          </div>
          {/* زر استعلام الـ CTE Rollup */}

          <button
            onClick={() => onInspectRollup(node.code)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all cursor-pointer print:hidden"
            title="فحص وتحليل تجميع الأرصدة التكراري (CTE Rollup)"
          >
            <BarChart3 size={15} />
          </button>
        </div>
      </div>

      {/* عرض الأبناء تكرارياً عند التوسيع */}
      {hasChildren && isExpanded && (
        <div className="relative">
          {/* خط اتصال شجري عمودي */}
          <div 
            className="absolute top-0 bottom-2 border-r-2 border-dashed border-slate-200" 
            style={{ right: `${Math.max(node.level * 16 + 11, 23)}px` }} 
          />
          <div className="space-y-0.5">
            {node.children.map(child => (
              <TreeNodeItem
                key={child.id}
                node={child}
                searchTerm={searchTerm}
                expandedIds={expandedIds}
                toggleExpand={toggleExpand}
                onInspectRollup={onInspectRollup}
                onAddChild={onAddChild}
                onEditNode={onEditNode}
                currencySymbol={currencySymbol}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChartOfAccountsTree() {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [treeData, setTreeData] = useState<AccountTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeRollup, setActiveRollup] = useState<RollupModalData | null>(null);
  const [rollupLoading, setRollupLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState<{ size: number; totalHits: number; totalMisses: number; keys: string[] } | null>(null);
  const [cacheClearing, setCacheClearing] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<AccountTreeNode | null>(null);
  const [formData, setFormData] = useState({ nameAr: '', nameEn: '', isPosting: true });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenAdd = (node: AccountTreeNode) => {
    setSelectedNode(node);
    setFormData({ nameAr: '', nameEn: '', isPosting: true });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (node: AccountTreeNode) => {
    setSelectedNode(node);
    setFormData({ nameAr: node.nameAr, nameEn: node.nameEn || '', isPosting: node.isPosting });
    setIsEditModalOpen(true);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode || !formData.nameAr.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/accounts/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentAccountId: selectedNode.id,
          nameAr: formData.nameAr,
          nameEn: formData.nameEn,
          isPosting: formData.isPosting
        })
      });
      const data = await res.json();
      
      if (data.success) {
        // Sync with LocalStorage for the rest of the app
        try {
          const newAcc = data.data;
          const localAccounts = loadChartOfAccounts();
          localAccounts.push({
            id: newAcc.id || newAcc.code,
            code: newAcc.code,
            name: newAcc.nameAr,
            type: newAcc.type as AccountType,
            balanceType: ['ASSET', 'EXPENSE'].includes(newAcc.type) ? BalanceType.Debit : BalanceType.Credit,
            parentId: newAcc.parentAccountId,
            isControlAccount: false
          });
          saveChartOfAccounts(localAccounts);
        } catch(e) { console.error('Sync error', e); }

        setIsAddModalOpen(false);

        fetchTree();
      } else {
        alert('خطأ: ' + (data.error || 'فشل في الإضافة'));
      }
    } catch (err) {
      alert('خطأ في الاتصال بالخادم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode || !formData.nameAr.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/accounts/${selectedNode.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameAr: formData.nameAr,
          nameEn: formData.nameEn,
          isPosting: formData.isPosting
        })
      });
      const data = await res.json();
      
      if (data.success) {
        // Sync with LocalStorage
        try {
          const updatedAcc = data.data;
          const localAccounts = loadChartOfAccounts();
          const accIndex = localAccounts.findIndex(a => a.id === updatedAcc.id || a.code === updatedAcc.code);
          if (accIndex >= 0) {
            localAccounts[accIndex]!.name = updatedAcc.nameAr;
            saveChartOfAccounts(localAccounts);
          }
        } catch(e) { console.error('Sync error', e); }

        setIsEditModalOpen(false);

        fetchTree();
      } else {
        alert('خطأ: ' + (data.error || 'فشل في التعديل'));
      }
    } catch (err) {
      alert('خطأ في الاتصال بالخادم');
    } finally {
      setIsSubmitting(false);
    }
  };

  
  // PDF Export State & Ref
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const treePrintRef = useRef<HTMLDivElement>(null);

  // جلب إحصائيات الكاش
  const fetchCacheStats = async () => {
    try {
      const res = await fetch('/api/accounts/cache-stats');
      const json = await res.json();
      if (json.success) {
        setCacheStats(json.data);
      }
    } catch {
      // تجاهل الخطأ الصامت
    }
  };

  // تفريغ الكاش يدوياً
  const handleClearCache = async () => {
    try {
      setCacheClearing(true);
      const res = await fetch('/api/accounts/cache-clear', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        await fetchCacheStats();
        await fetchTree();
      }
    } catch (err: any) {
      alert(err.message || 'تعذر تفريغ الكاش.');
    } finally {
      setCacheClearing(false);
    }
  };

  // جلب شجرة الحسابات من المسار GET /api/accounts/chart-tree
  const fetchTree = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch('/api/accounts/chart-tree');
      const json = await res.json();
      if (json.success) {
        setTreeData(json.data);
        // فتح المستويات 1 و 2 و 4 تلقائياً لتسهيل التصفح
        const initialExpanded = new Set<string>();
        const traverse = (nodes: AccountTreeNode[]) => {
          nodes.forEach(n => {
            if (n.level <= 4) initialExpanded.add(n.id);
            if (n.children) traverse(n.children);
          });
        };
        traverse(json.data);
        setExpandedIds(initialExpanded);
      } else {
        setErrorMsg(json.error || 'فشل تحميل شجرة الحسابات.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر الاتصال بمسار الخادم.');
    } finally {
      setLoading(false);
      fetchCacheStats();
    }
  };

  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const voiceRecognitionRef = useRef<any>(null);

  // بدء والتحكم في البحث الصوتي المباشر في شجرة الحسابات
  const toggleVoiceSearch = () => {
    if (isListeningVoice) {
      if (voiceRecognitionRef.current) {
        try { voiceRecognitionRef.current.stop(); } catch {}
      }
      setIsListeningVoice(false);
      return;
    }

    if (typeof window === 'undefined') return;
    const SpeechRecognition = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('ميزة التعرف الصوتي غير مدعومة في متصفحك الحالي، يمكنك كتابة كود أو اسم الحساب مباشرة.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListeningVoice(true);
      };

      recognition.onresult = (event: any) => {
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          }
        }
        if (final) {
          let cleaned = final.trim();
          // إزالة العبارات التمهيدية الشائعة
          const prefixes = ['ابحث عن حساب', 'ابحث عن', 'حساب رقم', 'حساب', 'أين حساب', 'كود'];
          for (const p of prefixes) {
            if (cleaned.startsWith(p)) {
              cleaned = cleaned.slice(p.length).trim();
              break;
            }
          }
          setSearchTerm(cleaned);
        }
      };

      recognition.onerror = () => {
        setIsListeningVoice(false);
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
      };

      voiceRecognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListeningVoice(false);
    }
  };

  useEffect(() => {
    fetchTree();
    fetchCacheStats();

    const handleSync = () => {
      fetchTree();
      fetchCacheStats();
    };

    // الاستماع لحدث اختيار حساب صوتياً
    const handleSelectAccountVoice = (e: Event) => {
      const custom = e as CustomEvent<{ account?: { code: string; name: string } }>;
      if (custom.detail?.account) {
        setSearchTerm(custom.detail.account.code || custom.detail.account.name);
      }
    };

    window.addEventListener('alpha-chart-of-accounts-updated', handleSync);
    window.addEventListener('alpha-journal-entries-updated', handleSync);
    window.addEventListener('alpha-system-reset-completed', handleSync);
    window.addEventListener('alpha-data-changed', handleSync);
    window.addEventListener('alpha-select-account', handleSelectAccountVoice);
    window.addEventListener('storage', handleSync);

    return () => {
      if (voiceRecognitionRef.current) {
        try { voiceRecognitionRef.current.stop(); } catch {}
      }
      window.removeEventListener('alpha-chart-of-accounts-updated', handleSync);
      window.removeEventListener('alpha-journal-entries-updated', handleSync);
      window.removeEventListener('alpha-system-reset-completed', handleSync);
      window.removeEventListener('alpha-data-changed', handleSync);
      window.removeEventListener('alpha-select-account', handleSelectAccountVoice);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // تبديل حالة الفرد والطي لعقدة معينة
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // توسيع الكل
  const expandAll = () => {
    const all = new Set<string>();
    const traverse = (nodes: AccountTreeNode[]) => {
      nodes.forEach(n => {
        all.add(n.id);
        if (n.children) traverse(n.children);
      });
    };
    traverse(treeData);
    setExpandedIds(all);
  };

  // طي الكل
  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  // تصدير شجرة الحسابات بصيغة PDF
  const handleExportPDF = async () => {
    if (!treePrintRef.current) return;
    setIsExportingPdf(true);
    // نفتح كافة العقد لضمان تصدير كامل مستويات الشجرة
    expandAll();
    
    // إعطاء مهلة قصيرة لإعادة الرندرة في الـ DOM
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      await exportElementToPdf(treePrintRef.current, {
        filename: `دليل_شجرة_الحسابات_${new Date().toISOString().split('T')[0]}.pdf`,
        format: 'A4',
        scale: 3.2
      });
    } catch (err) {
      console.error('Failed to export Chart of Accounts PDF:', err);
      alert('حدث خطأ أثناء تصدير شجرة الحسابات إلى PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // استعلام مسار GET /api/accounts/:code/rollup-balance
  const handleInspectRollup = async (code: string) => {
    try {
      setRollupLoading(true);
      const res = await fetch(`/api/accounts/${encodeURIComponent(code)}/rollup-balance`);
      const json = await res.json();
      if (json.success) {
        setActiveRollup(json.data);
      } else {
        alert(json.error || 'تعذر جلب تفاصيل الرصيد التجميعي.');
      }
    } catch (err: any) {
      alert(err.message || 'فشل الاتصال بالخادم.');
    } finally {
      setRollupLoading(false);
    }
  };

  // تصفية الشجرة بناءً على مصطلح البحث
  const filteredTree = useMemo(() => {
    if (!searchTerm.trim()) return treeData;
    const term = searchTerm.toLowerCase();

    const filterNode = (node: AccountTreeNode): AccountTreeNode | null => {
      const matches = 
        node.code.toLowerCase().includes(term) || 
        node.nameAr.toLowerCase().includes(term) ||
        (node.nameEn && node.nameEn.toLowerCase().includes(term));

      const filteredChildren = (node.children || [])
        .map(filterNode)
        .filter((child): child is AccountTreeNode => child !== null);

      if (matches || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren
        };
      }
      return null;
    };

    return treeData
      .map(filterNode)
      .filter((n): n is AccountTreeNode => n !== null);
  }, [treeData, searchTerm]);

  // عند البحث نفتح كافة العقد تلقائياً لتظهر النتائج
  useEffect(() => {
    if (searchTerm.trim()) {
      const allMatching = new Set<string>();
      const traverse = (nodes: AccountTreeNode[]) => {
        nodes.forEach(n => {
          allMatching.add(n.id);
          if (n.children) traverse(n.children);
        });
      };
      traverse(filteredTree);
      setExpandedIds(allMatching);
    }
  }, [searchTerm, filteredTree]);

  // احتساب الإجماليات الشاملة للأصول والخصوم
  const totalAssets = treeData.find(n => n.code === '1')?.balance || 0;
  const totalLiabilities = treeData.find(n => n.code === '2')?.balance || 0;
  const totalRevenue = treeData.find(n => n.code === '4')?.balance || 0;
  const totalExpenses = treeData.find(n => n.code === '5')?.balance || 0;

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      {/* رأس الشاشة ولوحة الإحصائيات التراكمية */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-xs font-bold border border-indigo-500/30">
                Recursive CTE & Rollup Engine
              </span>
              <span className="text-xs text-slate-400">PostgreSQL Rollup Service • شجرة الحسابات المالية التراكمية</span>
            </div>
            <h2 className="text-2xl font-bold flex items-center gap-2.5">
              <Layers className="text-indigo-400" size={24} />
              شجرة ودليل الحسابات المالية التفاعلي (Chart of Accounts Tree)
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-3xl">
              عرض متداخل لكافة المستويات من 1 حتى 5، مع تجميع تراكمي تلقائي صعوداً لأرصدة المدين والدائن والرصيد الصافي عبر خدمة <code>AccountRollupService</code>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
            {/* مؤشر حالة الكاش */}
            {cacheStats && (
              <div 
                className="hidden lg:flex items-center gap-2 px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs"
                title={`عناصر الكاش: ${cacheStats.size} | مرات النجاح: ${cacheStats.totalHits} | الاستعلام المباشر: ${cacheStats.totalMisses}`}
              >
                <Database size={14} className="text-emerald-400" />
                <span className="text-slate-300 font-medium">In-Memory Cache:</span>
                <span className="font-bold text-emerald-400 font-mono">{cacheStats.size} مفاتيح</span>
                <span className="text-slate-500">•</span>
                <span className="text-amber-300 font-mono font-bold" title="عدد مرات القراءة السريعة من الذاكرة">{cacheStats.totalHits} hits</span>
              </div>
            )}

            <button
              onClick={handleClearCache}
              disabled={cacheClearing || loading}
              className="flex items-center justify-center flex-1 sm:flex-none gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-rose-900/60 text-slate-200 hover:text-rose-200 border border-slate-700 hover:border-rose-700/60 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              title="تفريغ كاش شجرة الحسابات والأرصدة التراكمية وإعادة بنائها"
            >
              <Trash2 size={14} className={cacheClearing ? 'animate-spin text-rose-400' : ''} />
              <span>{cacheClearing ? 'جاري التفريغ...' : 'تفريغ الكاش'}</span>
            </button>

            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'trialBalance' } }));
              }}
              className="flex items-center justify-center flex-1 sm:flex-none gap-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer shrink-0"
              title="الانتقال إلى شاشة ميزان المراجعة بالمجاميع والأرصدة"
            >
              <BarChart3 size={15} />
              <span>ميزان المراجعة ←</span>
            </button>

            <button
              onClick={fetchTree}
              disabled={loading}
              className="flex items-center justify-center flex-1 sm:flex-none gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-xl text-sm font-bold transition-all shadow-md cursor-pointer shrink-0"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              تحديث الشجرة
            </button>
          </div>
        </div>

        {/* بطاقات الإجماليات السريعة من المستوى الأول */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-xs text-slate-400 block font-medium">إجمالي الأصول (L1: 1)</span>
            <span className="text-lg font-bold font-mono text-blue-400">
              {new Intl.NumberFormat('ar-SA').format(totalAssets)} <span className="text-xs font-sans text-slate-400">{currencySymbol}</span>
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-xs text-slate-400 block font-medium">إجمالي الخصوم (L1: 2)</span>
            <span className="text-lg font-bold font-mono text-purple-400">
              {new Intl.NumberFormat('ar-SA').format(totalLiabilities)} <span className="text-xs font-sans text-slate-400">{currencySymbol}</span>
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-xs text-slate-400 block font-medium">إجمالي الإيرادات (L1: 4)</span>
            <span className="text-lg font-bold font-mono text-emerald-400">
              {new Intl.NumberFormat('ar-SA').format(totalRevenue)} <span className="text-xs font-sans text-slate-400">{currencySymbol}</span>
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-xs text-slate-400 block font-medium">إجمالي المصروفات (L1: 5)</span>
            <span className="text-lg font-bold font-mono text-rose-400">
              {new Intl.NumberFormat('ar-SA').format(totalExpenses)} <span className="text-xs font-sans text-slate-400">{currencySymbol}</span>
            </span>
          </div>
        </div>
      </div>

      {/* شريط الأدوات والبحث والتحكم */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* شريط البحث السريع بالصوت والكتابة */}
        <div className="relative w-full sm:w-96">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isListeningVoice ? "جارٍ الاستماع إليك... تحدث الآن..." : "بحث سريع برقم الكود، اسم الحساب (مثال: 110101 أو بنك)..."}
            className={`w-full bg-slate-50 border rounded-xl py-2.5 pr-10 pl-20 text-sm outline-none transition-all text-right ${
              isListeningVoice 
                ? 'border-rose-500 ring-4 ring-rose-500/20 bg-rose-50/40' 
                : 'border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10'
            }`}
          />
          <Search className="absolute right-3.5 top-3 text-slate-400 pointer-events-none" size={18} />
          
          <div className="absolute left-2 top-1.5 flex items-center gap-1">
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                title="مسح البحث"
              >
                <X size={14} />
              </button>
            )}

            <button
              type="button"
              onClick={toggleVoiceSearch}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                isListeningVoice
                  ? 'bg-rose-600 text-white animate-bounce shadow-md shadow-rose-600/30'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200'
              }`}
              title={isListeningVoice ? 'إيقاف الاستماع' : 'البحث الصوتي عن حساب (ميكروفون)'}
            >
              {isListeningVoice ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
          </div>
        </div>

        {/* أزرار فرد وطي الشجرة ودليل الشارات وتصدير البيانات */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <ExportButtonGroup
            title="دليل شجرة الحسابات المالية (Chart of Accounts)"
            filename="دليل_شجرة_الحسابات"
            headers={[
              'كود الحساب',
              'اسم الحساب (عربي)',
              'الاسم بالإنجليزية',
              'المستوى المحاسبي',
              'طبيعة الحساب',
              'نوع الحساب',
              'الرصيد المحاسبي',
              'الحالة'
            ]}
            rows={(() => {
              const rows: (string | number)[][] = [];
              const traverse = (nodes: AccountTreeNode[]) => {
                nodes.forEach(n => {
                  rows.push([
                    n.code,
                    n.nameAr,
                    n.nameEn || '-',
                    `المستوى ${n.level}`,
                    n.isPosting ? 'فرعي (يقبل حركات)' : 'رئيسي (تجميعي)',
                    n.type,
                    n.balance,
                    n.isActive ? 'نشط' : 'معطل'
                  ]);
                  if (n.children && n.children.length > 0) {
                    traverse(n.children);
                  }
                });
              };
              traverse(treeData);
              return rows;
            })()}
            onExportPDF={handleExportPDF}
            size="sm"
          />

          <button
            onClick={expandAll}
            className="px-3 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            توسيع كافة الفروع +
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            طي الكل -
          </button>
        </div>
      </div>

      {/* دليل المستويات والشارات */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
        <span className="font-bold text-slate-700">دليل الشارات والتمييز:</span>
        <span className="px-2 py-0.5 rounded bg-blue-900 text-white font-bold text-[11px]">مستوى 1: رئيسي</span>
        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[11px]">مستوى 2: عام</span>
        <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold text-[11px]">مستوى 3: مساعد</span>
        <span className="px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px]">
          مستوى 4: حساب فرعي تجميعي (L4)
        </span>
        <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-[11px]">
          مستوى 5: حساب تحليلي حركي (L5) • يقبل القيود
        </span>
      </div>

      {/* حاوية الشجرة الهرمية المغلفة لطباعة الـ PDF */}
      <div ref={treePrintRef} id="chart-of-accounts-print-area" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm min-h-[400px]">
        {/* ترويسة رسمية خاصة بملف الـ PDF عند التصدير */}
        {isExportingPdf && (
          <div className="pb-4 mb-5 border-b border-slate-300">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-black text-slate-900">شجرة ودليل الحسابات المالية العامة</h1>
                <p className="text-xs text-slate-500 mt-1">
                  نظام لوجوستريا المحاسبي • التجميع الهرمي الصاعد (Hierarchical Rollup CTE Engine)
                </p>
              </div>
              <div className="text-left text-xs text-slate-500">
                <p>تاريخ التصدير: {new Date().toLocaleDateString('ar-SA')}</p>
                <p>عدد الحسابات في الدليل: {treeData.length > 0 ? 'مكتمل' : 'فارغ'}</p>
              </div>
            </div>
          </div>
        )}
        {loading ? (
          <div className="py-20 text-center text-slate-400 space-y-3">
            <RefreshCw size={32} className="animate-spin mx-auto text-indigo-500" />
            <p className="font-medium text-sm">جاري بناء شجرة الحسابات واحتساب الأرصدة التراكمية صعوداً...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-center">
            <p className="font-bold">{errorMsg}</p>
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <p className="font-medium text-sm">لا توجد حسابات تطابق مصطلح البحث المحدد ({searchTerm}).</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredTree.map(rootNode => (
              <TreeNodeItem
                key={rootNode.id}
                node={rootNode}
                searchTerm={searchTerm}
                expandedIds={expandedIds}
                toggleExpand={toggleExpand}
                onInspectRollup={handleInspectRollup}
                onAddChild={handleOpenAdd}
                onEditNode={handleOpenEdit}
                currencySymbol={currencySymbol}
              />
            ))}
          </div>
        )}
      </div>

      {/* مؤشر تحميل فحص الرصيد التجميعي */}
      {rollupLoading && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 shadow-xl border border-slate-200 flex items-center gap-3">
            <Loader2 className="animate-spin text-indigo-600" size={24} />
            <span className="text-sm font-bold text-slate-800">جاري حساب التجميع الهرمي (CTE Rollup)...</span>
          </div>
        </div>
      )}

      
      {/* Modals for Add/Edit Account */}
      {(isAddModalOpen || isEditModalOpen) && selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col" dir="rtl">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                {isAddModalOpen ? (
                  <><Plus size={18} className="text-emerald-600" /> إضافة حساب فرعي لـ {selectedNode.nameAr}</>
                ) : (
                  <><Edit2 size={18} className="text-blue-600" /> تعديل حساب {selectedNode.nameAr}</>
                )}
              </h3>
              <button
                onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={isAddModalOpen ? handleSubmitAdd : handleSubmitEdit} className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الحساب (عربي) *</label>
                <input
                  type="text"
                  required
                  value={formData.nameAr}
                  onChange={(e) => setFormData({...formData, nameAr: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="مثال: البنك الأهلي"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الحساب (إنجليزي)</label>
                <input
                  type="text"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({...formData, nameEn: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="e.g. Bank Name"
                />
              </div>

              {isAddModalOpen && selectedNode.level === 4 && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="isPosting"
                    checked={formData.isPosting}
                    onChange={(e) => setFormData({...formData, isPosting: e.target.checked})}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <label htmlFor="isPosting" className="text-xs font-bold text-slate-700 cursor-pointer">
                    حساب حركي (يقبل قيود يومية)
                  </label>
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-sm transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة منبثقة لفحص تحليل الـ CTE Rollup */}
      {activeRollup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BarChart3 className="text-indigo-600" size={20} />
                <h3 className="font-bold text-slate-800 text-base">
                  تحليل الرصيد المجمع صعوداً (CTE Rollup Result)
                </h3>
              </div>
              <button
                onClick={() => setActiveRollup(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">كود الحساب:</span>
                <span className="font-mono font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-800">
                  {activeRollup.accountCode}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">اسم الحساب:</span>
                <span className="font-bold text-slate-800">{activeRollup.accountNameAr}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">المستوى في الشجرة:</span>
                <span className="font-bold text-indigo-700">المستوى {activeRollup.level}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">الحسابات والأبناء المشمولة بالتجميع:</span>
                <span className="font-bold text-slate-700">{activeRollup.affectedAccountsCount} حساب</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <span className="text-[11px] text-blue-700 block font-bold mb-1">إجمالي المدين</span>
                <span className="font-mono font-extrabold text-blue-800 text-sm">
                  {new Intl.NumberFormat('ar-SA').format(activeRollup.total_debit)}
                </span>
              </div>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                <span className="text-[11px] text-purple-700 block font-bold mb-1">إجمالي الدائن</span>
                <span className="font-mono font-extrabold text-purple-800 text-sm">
                  {new Intl.NumberFormat('ar-SA').format(activeRollup.total_credit)}
                </span>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="text-[11px] text-emerald-700 block font-bold mb-1">الرصيد الصافي</span>
                <span className="font-mono font-extrabold text-emerald-800 text-sm">
                  {new Intl.NumberFormat('ar-SA').format(activeRollup.net_balance)}
                </span>
              </div>
            </div>

            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-center gap-2">
              <span className="font-mono text-indigo-700 font-bold">SQL CTE:</span>
              <span>تم استدعاء المسار <code>GET /api/accounts/{activeRollup.accountCode}/rollup-balance</code> بنجاح.</span>
            </div>

            <button
              onClick={() => setActiveRollup(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
