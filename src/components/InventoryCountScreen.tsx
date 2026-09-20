import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ClipboardCheck, 
  Plus, 
  Search, 
  Printer, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Warehouse, 
  PackageCheck, 
  ShieldCheck, 
  Eye, 
  Trash2, 
  History, 
  FileText, 
  Check, 
  X, 
  RotateCcw,
  Building2,
  Calendar,
  Users,
  Info,
  ExternalLink,
  BarChart3,
  ScanBarcode,
  Volume2,
  VolumeX,
  Upload,
  Download,
  Tag,
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  PlusCircle,
  FileSpreadsheet
} from 'lucide-react';
import ItemAnalyticsModal from './ItemAnalyticsModal';
import ExportButtonGroup from './ExportButtonGroup';
import { InventoryAuditRecord, InventoryCountLine } from '../types/inventoryCount';
import { 
  loadInventoryAudits, 
  saveInventoryAudit, 
  deleteInventoryAudit, 
  createDraftAuditSession, 
  postInventoryAuditAndReconcile,
  calculateAuditTotals
} from '../utils/inventoryAuditStore';
import { useSystemCurrency } from '../utils/currency';
import { getSystemSettings } from '../utils/settings';
import { loadJournalEntries } from '../utils/trialBalanceStore';
import { loadStoredItems, type Item } from '../utils/itemsStore';
import { JournalEntry } from '../types/accounting';

interface InventoryCountScreenProps {
  onNavigate?: (view: string) => void;
}

const QUICK_VARIANCE_REASONS = [
  'تلف / كسر في المستودع',
  'خطأ توريد أو استلام سابق',
  'عينات مجانية أو ترويجية',
  'فرق عبوات وتعبئة وتغليف',
  'عجز مجهول قيد التحقيق',
  'صلاحية منتهية ومستبعدة'
];

export default function InventoryCountScreen({ onNavigate }: InventoryCountScreenProps) {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [systemSettings] = useState(() => getSystemSettings());

  // All audit sessions
  const [audits, setAudits] = useState<InventoryAuditRecord[]>(() => loadInventoryAudits());
  
  // Currently active audit session ID
  const [activeAuditId, setActiveAuditId] = useState<string>(() => {
    const list = loadInventoryAudits();
    return list.length > 0 ? (list[0]?.id as string) : '';
  });

  // Mode: 'CURRENT' (viewing/editing an audit session) or 'HISTORY' (browsing all audit sessions)
  const [viewMode, setViewMode] = useState<'CURRENT' | 'HISTORY'>('CURRENT');

  // Display layout mode: 'TABLE' or 'CARDS' (useful for mobile/tablet warehouse walking)
  const [displayLayout, setDisplayLayout] = useState<'TABLE' | 'CARDS'>('TABLE');

  // Filter & search within the current audit items table
  const [itemSearch, setItemSearch] = useState('');
  const [varianceFilter, setVarianceFilter] = useState<'ALL' | 'VARIANCE_ONLY' | 'SHORTAGE_ONLY' | 'SURPLUS_ONLY' | 'MATCHED_ONLY'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Barcode quick scanner state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanMode, setScanMode] = useState<'INCREMENT' | 'LOCATE'>('INCREMENT');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scannedHighlightId, setScannedHighlightId] = useState<string | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Print mode: 'OFFICIAL' (full financial discrepancy report) or 'BLIND' (blind count sheet for workers)
  const [printMode, setPrintMode] = useState<'OFFICIAL' | 'BLIND'>('OFFICIAL');
  const [printDropdownOpen, setPrintDropdownOpen] = useState(false);

  // Modal / confirmation states
  const [confirmPostModalOpen, setConfirmPostModalOpen] = useState(false);
  const [viewJeModalEntry, setViewJeModalEntry] = useState<JournalEntry | null>(null);
  const [analyticItemId, setAnalyticItemId] = useState<string | null>(null);
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [activeReasonPickerLineId, setActiveReasonPickerLineId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Audio tone generator using Web Audio API
  const playAudioFeedback = (type: 'success' | 'error') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.11);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.setValueAtTime(160, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.16);
      }
    } catch {
      // Ignore audio failure in silent environments
    }
  };

  // Sync with global events & reset
  useEffect(() => {
    const handleSync = () => {
      const refreshed = loadInventoryAudits();
      setAudits(refreshed);
      if (!refreshed.some(a => a.id === activeAuditId)) {
        setActiveAuditId(refreshed.length > 0 ? (refreshed[0]?.id as string) : '');
      }
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('alpha-inventory-audits-updated', handleSync);
    window.addEventListener('alpha-system-reset-completed', handleSync);
    window.addEventListener('alpha-data-changed', handleSync);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('alpha-inventory-audits-updated', handleSync);
      window.removeEventListener('alpha-system-reset-completed', handleSync);
      window.removeEventListener('alpha-data-changed', handleSync);
    };
  }, [activeAuditId]);

  // Active audit record
  const currentAudit = useMemo(() => {
    return audits.find(a => a.id === activeAuditId) || null;
  }, [audits, activeAuditId]);

  // Dynamic list of warehouses
  const warehousesList = useMemo(() => {
    const items = loadStoredItems();
    const whs = new Set<string>();
    whs.add('المستودع الرئيسي - الرياض');
    whs.add('مستودع فرع جدة');
    whs.add('المستودع المركزي - الدمام');
    whs.add('كافة المستودعات والفروع');
    items.forEach(i => {
      if (i.warehouseName) whs.add(i.warehouseName);
    });
    return Array.from(whs);
  }, []);

  // Categories present in active audit
  const categoriesList = useMemo(() => {
    if (!currentAudit) return [];
    const cats = new Set<string>();
    currentAudit.lines.forEach(l => {
      if (l.category) cats.add(l.category);
    });
    return Array.from(cats);
  }, [currentAudit]);

  // Handler to start a new audit
  const handleStartNewAudit = () => {
    const newSession = createDraftAuditSession('المستودع الرئيسي - الرياض');
    saveInventoryAudit(newSession);
    setAudits(prev => [newSession, ...prev]);
    setActiveAuditId(newSession.id);
    setViewMode('CURRENT');
    showToast(`تم فتح جلسة جرد دوري جديدة برقم ${newSession.auditNumber}`);
  };

  // Handler to update audit header metadata
  const handleUpdateAuditHeader = (field: keyof InventoryAuditRecord, value: any) => {
    if (!currentAudit || currentAudit.status === 'POSTED') return;
    const updated = { ...currentAudit, [field]: value };
    saveInventoryAudit(updated);
    setAudits(prev => prev.map(a => a.id === updated.id ? updated : a));
  };

  // Handler to update actual counted quantity on a specific line
  const handleLineActualChange = (lineId: string, actualQtyStr: string) => {
    if (!currentAudit || currentAudit.status === 'POSTED') return;
    const newQty = parseFloat(actualQtyStr);
    const validQty = isNaN(newQty) || newQty < 0 ? 0 : newQty;

    const updatedLines = currentAudit.lines.map(line => {
      if (line.id === lineId) {
        const varianceQty = validQty - line.bookQuantity;
        const varianceVal = varianceQty * line.unitCostPrice;
        return {
          ...line,
          actualQuantity: validQty,
          varianceQuantity: varianceQty,
          varianceValue: varianceVal
        };
      }
      return line;
    });

    const totals = calculateAuditTotals(updatedLines);

    const updatedAudit: InventoryAuditRecord = {
      ...currentAudit,
      lines: updatedLines,
      totals
    };

    saveInventoryAudit(updatedAudit);
    setAudits(prev => prev.map(a => a.id === updatedAudit.id ? updatedAudit : a));
  };

  // Quick increment/decrement helper for touch screens
  const handleStepLineActual = (lineId: string, delta: number) => {
    if (!currentAudit || currentAudit.status === 'POSTED') return;
    const line = currentAudit.lines.find(l => l.id === lineId);
    if (!line) return;
    const newQty = Math.max(0, (line.actualQuantity || 0) + delta);
    handleLineActualChange(lineId, String(newQty));
  };

  // Handler to update notes/reason on a specific line
  const handleLineNotesChange = (lineId: string, notes: string) => {
    if (!currentAudit || currentAudit.status === 'POSTED') return;
    const updatedLines = currentAudit.lines.map(line => {
      if (line.id === lineId) {
        return { ...line, notes };
      }
      return line;
    });
    const updatedAudit = { ...currentAudit, lines: updatedLines };
    saveInventoryAudit(updatedAudit);
    setAudits(prev => prev.map(a => a.id === updatedAudit.id ? updatedAudit : a));
  };

  // Helper: Match all actual to book in one click
  const handleSetAllToBook = () => {
    if (!currentAudit || currentAudit.status === 'POSTED') return;
    const updatedLines = currentAudit.lines.map(line => ({
      ...line,
      actualQuantity: line.bookQuantity,
      varianceQuantity: 0,
      varianceValue: 0
    }));

    const totals = calculateAuditTotals(updatedLines);
    const updatedAudit: InventoryAuditRecord = {
      ...currentAudit,
      lines: updatedLines,
      totals
    };
    saveInventoryAudit(updatedAudit);
    setAudits(prev => prev.map(a => a.id === updatedAudit.id ? updatedAudit : a));
    showToast('تمت مطابقة جميع الكميات الفعلية مع الأرصدة الدفترية بنجاح.');
  };

  // Helper: Reset all actual to zero (blind inventory count)
  const handleResetAllToZero = () => {
    if (!currentAudit || currentAudit.status === 'POSTED') return;
    const updatedLines = currentAudit.lines.map(line => {
      const varianceQty = -line.bookQuantity;
      return {
        ...line,
        actualQuantity: 0,
        varianceQuantity: varianceQty,
        varianceValue: varianceQty * line.unitCostPrice
      };
    });

    const totals = calculateAuditTotals(updatedLines);
    const updatedAudit: InventoryAuditRecord = {
      ...currentAudit,
      lines: updatedLines,
      totals
    };
    saveInventoryAudit(updatedAudit);
    setAudits(prev => prev.map(a => a.id === updatedAudit.id ? updatedAudit : a));
    showToast('تم تصفير الكميات الفعلية للبدء في العد المخزني من الصفر.');
  };

  // Quick Barcode Scanning Handler
  const handleBarcodeScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim() || !currentAudit || currentAudit.status === 'POSTED') return;
    const raw = barcodeInput.trim().toLowerCase();

    // Look for match by barcode or itemCode
    const matchedLine = currentAudit.lines.find(l => 
      (l.barcode && l.barcode.toLowerCase() === raw) ||
      l.itemCode.toLowerCase() === raw
    );

    if (!matchedLine) {
      playAudioFeedback('error');
      showToast(`لم يتم العثور على صنف بالباركود أو الكود: "${barcodeInput}" في هذا المحضر.`, 'error');
      setBarcodeInput('');
      return;
    }

    playAudioFeedback('success');
    setScannedHighlightId(matchedLine.id);
    setTimeout(() => setScannedHighlightId(null), 2500);

    if (scanMode === 'INCREMENT') {
      const nextQty = matchedLine.actualQuantity + 1;
      handleLineActualChange(matchedLine.id, String(nextQty));
      showToast(`+1 "${matchedLine.itemName}" (الكمية الفعلية: ${nextQty})`);
    } else {
      showToast(`تم تحديد "${matchedLine.itemName}" - أدخل الكمية`);
      // Scroll to row and focus input
      const rowElem = document.getElementById(`audit-row-${matchedLine.id}`);
      if (rowElem) {
        rowElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const inputElem = rowElem.querySelector('input[type="number"]') as HTMLInputElement;
        if (inputElem) {
          inputElem.focus();
          inputElem.select();
        }
      }
    }

    setBarcodeInput('');
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  // CSV Export with UTF-8 BOM for perfect Excel compatibility
  const handleExportCSV = (mode: 'FULL' | 'BLIND') => {
    if (!currentAudit) return;
    const isBlind = mode === 'BLIND';
    let csvContent = '\uFEFF'; // BOM

    if (isBlind) {
      csvContent += 'رقم,كود الصنف,اسم الصنف,الباركود,التصنيف,الوحدة,الموقع والرف,الكمية الفعلية المعدودة,ملاحظات الجرد\n';
      currentAudit.lines.forEach((l, idx) => {
        csvContent += `"${idx + 1}","${l.itemCode}","${(l.itemName || '').replace(/"/g, '""')}","${l.barcode || ''}","${l.category || ''}","${l.unit || 'قطعة'}","${l.shelfLocation || ''}","",""\n`;
      });
    } else {
      csvContent += 'رقم,كود الصنف,اسم الصنف,الباركود,التصنيف,الوحدة,الموقع والرف,الرصيد الدفتري,الرصيد الفعلي,فارق الكمية,تكلفة الوحدة,القيمة المالية للفارق,الملاحظات وسبب الفارق\n';
      currentAudit.lines.forEach((l, idx) => {
        csvContent += `"${idx + 1}","${l.itemCode}","${(l.itemName || '').replace(/"/g, '""')}","${l.barcode || ''}","${l.category || ''}","${l.unit || 'قطعة'}","${l.shelfLocation || ''}","${l.bookQuantity}","${l.actualQuantity}","${l.varianceQuantity}","${l.unitCostPrice}","${l.varianceValue}","${(l.notes || '').replace(/"/g, '""')}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${isBlind ? 'كشف_جرد_أعمى' : 'محضر_تسوية_الجرد'}_${currentAudit.auditNumber}_${currentAudit.date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(isBlind ? 'تم تصدير كشف الجرد الأعمى (Excel/CSV) بنجاح' : 'تم تصدير تقرير الفوارق المالية الكامل بنجاح');
  };

  // CSV Import to Batch Update Actual Quantities
  const handleImportFile = (file: File) => {
    if (!currentAudit || currentAudit.status === 'POSTED') return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) return;
        const rows = text.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
        if (rows.length < 2) {
          showToast('الملف فارغ أو لا يحتوي على صفوف صالحة.', 'error');
          return;
        }

        let updatedCount = 0;
        const newLines = [...currentAudit.lines];

        // Skip header
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          // Split by comma or semicolon
          const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)|;/).map(c => c.replace(/^"|"$/g, '').trim());
          if (cols.length < 2) continue;

          // Search for item match by code (col 1 or 0) or barcode
          const possibleCode = cols[1] || cols[0];
          const possibleBarcode = cols[3];
          
          // Locate quantity: find last numeric column or column 7 (actualQty in export)
          let parsedQty: number | null = null;
          for (let c = cols.length - 1; c >= 1; c--) {
            const val = parseFloat(cols[c] || '');
            if (!isNaN(val) && val >= 0) {
              parsedQty = val;
              break;
            }
          }

          if (parsedQty === null) continue;

          const lineIdx = newLines.findIndex(l => 
            (possibleCode && l.itemCode.toLowerCase() === possibleCode.toLowerCase()) ||
            (possibleBarcode && l.barcode && l.barcode.toLowerCase() === possibleBarcode.toLowerCase()) ||
            (cols[0] && l.itemCode.toLowerCase() === cols[0].toLowerCase())
          );

          if (lineIdx >= 0) {
            const line = newLines[lineIdx];
            if (line) {
              const varianceQty = parsedQty - line.bookQuantity;
              const varianceVal = varianceQty * line.unitCostPrice;
              newLines[lineIdx] = {
                ...line,
                actualQuantity: parsedQty,
                varianceQuantity: varianceQty,
                varianceValue: varianceVal
              };
              updatedCount++;
            }
          }
        }

        if (updatedCount > 0) {
          const totals = calculateAuditTotals(newLines);
          const updatedAudit: InventoryAuditRecord = {
            ...currentAudit,
            lines: newLines,
            totals
          };
          saveInventoryAudit(updatedAudit);
          setAudits(prev => prev.map(a => a.id === updatedAudit.id ? updatedAudit : a));
          showToast(`تم استيراد وتحديث الكميات الفعلية لـ (${updatedCount}) صنف بنجاح!`);
          setImportModalOpen(false);
        } else {
          showToast('لم يتم العثور على أصناف متطابقة بالأكواد في الملف المرفق.', 'error');
        }
      } catch {
        showToast('حدث خطأ أثناء معالجة ملف CSV.', 'error');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Add Unlisted Item to Current Audit
  const handleAddCatalogItem = (item: Item) => {
    if (!currentAudit || currentAudit.status === 'POSTED') return;
    if (currentAudit.lines.some(l => l.itemId === item.id || l.itemCode === item.code)) {
      showToast('هذا الصنف مدرج بالفعل في محضر الجرد الحالي.', 'info');
      return;
    }

    const newLine: InventoryCountLine = {
      id: `aud-line-${item.id}-${Math.random().toString(36).substring(2, 7)}`,
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      barcode: item.barcode,
      category: item.category,
      unit: item.unit || 'قطعة',
      warehouseName: currentAudit.targetWarehouse,
      shelfLocation: item.shelfLocation || 'A-01',
      bookQuantity: Number(item.stock || 0),
      actualQuantity: Number(item.stock || 0),
      varianceQuantity: 0,
      unitCostPrice: Number(item.costPrice || 0),
      varianceValue: 0,
      notes: 'صنف مضاف يدوياً أثناء الجرد'
    };

    const updatedLines = [newLine, ...currentAudit.lines];
    const totals = calculateAuditTotals(updatedLines);
    const updatedAudit: InventoryAuditRecord = {
      ...currentAudit,
      lines: updatedLines,
      totals
    };

    saveInventoryAudit(updatedAudit);
    setAudits(prev => prev.map(a => a.id === updatedAudit.id ? updatedAudit : a));
    showToast(`تمت إضافة "${item.name}" إلى محضر الجرد بنجاح.`);
    setAddItemModalOpen(false);
  };

  // Final Action: Post and Reconcile with Journal Entry
  const handlePostAudit = () => {
    if (!currentAudit) return;
    const result = postInventoryAuditAndReconcile(currentAudit.id, 'مدير الحسابات والمخازن');
    if (result.success) {
      setConfirmPostModalOpen(false);
      const reloaded = loadInventoryAudits();
      setAudits(reloaded);
      showToast(
        result.journalEntry 
          ? `تم اعتماد الجرد وترحيل قيد التسوية المخزنية رقم (${result.journalEntry.entryNumber}) وتحديث أرصدة المخازن بنجاح!`
          : 'تم اعتماد الجرد وتأكيد مطابقة الأرصدة الدفترية مع الفعلية بنجاح.'
      );
    } else {
      showToast(result.error || 'فشل ترحيل الجرد', 'error');
    }
  };

  // View Journal Entry in Modal
  const handleOpenJournalEntry = (jeNumberOrId?: string) => {
    if (!jeNumberOrId) return;
    const entries = loadJournalEntries();
    const match = entries.find(e => e.id === jeNumberOrId || e.entryNumber === jeNumberOrId);
    if (match) {
      setViewJeModalEntry(match);
    } else {
      showToast('لم يتم العثور على القيد المحاسبي في الدفاتر.', 'info');
    }
  };

  // Delete draft audit
  const handleDeleteAudit = (id: string) => {
    if (confirm('هل أنت متأكد من حذف محضر الجرد هذا نهائياً؟')) {
      deleteInventoryAudit(id);
      const remaining = loadInventoryAudits();
      setAudits(remaining);
      if (activeAuditId === id) {
        setActiveAuditId(remaining.length > 0 ? (remaining[0]?.id as string) : '');
      }
      showToast('تم حذف محضر الجرد بنجاح.');
    }
  };

  // Print execution helper
  const triggerPrint = (mode: 'OFFICIAL' | 'BLIND') => {
    setPrintMode(mode);
    setPrintDropdownOpen(false);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Filtered lines for display
  const filteredLines = useMemo(() => {
    if (!currentAudit) return [];
    return currentAudit.lines.filter(line => {
      // Category Filter
      if (selectedCategory !== 'ALL' && line.category !== selectedCategory) return false;

      // Variance Filter
      if (varianceFilter === 'VARIANCE_ONLY' && line.varianceQuantity === 0) return false;
      if (varianceFilter === 'SHORTAGE_ONLY' && line.varianceQuantity >= 0) return false;
      if (varianceFilter === 'SURPLUS_ONLY' && line.varianceQuantity <= 0) return false;
      if (varianceFilter === 'MATCHED_ONLY' && line.varianceQuantity !== 0) return false;

      // Search Query
      if (itemSearch.trim()) {
        const q = itemSearch.trim().toLowerCase();
        const name = (line.itemName || '').toLowerCase();
        const code = (line.itemCode || '').toLowerCase();
        const barcode = (line.barcode || '').toLowerCase();
        const cat = (line.category || '').toLowerCase();
        const loc = (line.shelfLocation || '').toLowerCase();
        return name.includes(q) || code.includes(q) || barcode.includes(q) || cat.includes(q) || loc.includes(q);
      }
      return true;
    });
  }, [currentAudit, selectedCategory, varianceFilter, itemSearch]);

  // Catalog items for add unlisted item modal
  const allCatalogItems = useMemo(() => {
    return loadStoredItems().filter(i => i.isActive !== false);
  }, [addItemModalOpen]);

  const unlistedCatalogItems = useMemo(() => {
    if (!currentAudit) return [];
    const existingIds = new Set(currentAudit.lines.map(l => l.itemId));
    return allCatalogItems.filter(i => !existingIds.has(i.id));
  }, [allCatalogItems, currentAudit]);

  const [catalogSearch, setCatalogSearch] = useState('');
  const filteredCatalogItems = useMemo(() => {
    if (!catalogSearch.trim()) return unlistedCatalogItems;
    const q = catalogSearch.toLowerCase();
    return unlistedCatalogItems.filter(i => 
      i.name.toLowerCase().includes(q) || 
      i.code.toLowerCase().includes(q) || 
      (i.barcode && i.barcode.toLowerCase().includes(q))
    );
  }, [unlistedCatalogItems, catalogSearch]);

  return (
    <div className="space-y-6 pb-16">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          {toastMessage.type === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-400" />
          ) : toastMessage.type === 'error' ? (
            <AlertTriangle size={18} className="text-red-400" />
          ) : (
            <Info size={18} className="text-blue-400" />
          )}
          <span className="text-sm font-medium">{toastMessage.text}</span>
        </div>
      )}

      {/* TOP HEADER & TITLE */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm">
              <ClipboardCheck size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                الجرد المخزني الدوري والتسويات الدفترية
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                مطابقة الكميات الفعلية مع الأرصدة الدفترية، وتوليد قيود تسوية الفوارق آلياً
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'CURRENT' ? 'HISTORY' : 'CURRENT')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'HISTORY'
                ? 'bg-gradient-to-b from-slate-700 to-slate-800 text-white border border-slate-700 border-b-4 border-b-slate-950 shadow-md active:translate-y-0.5 active:border-b-2'
                : 'bg-gradient-to-b from-white to-slate-100 text-slate-700 border border-slate-200 border-b-4 border-b-slate-300 shadow-sm hover:from-slate-50 hover:to-slate-200 active:translate-y-0.5 active:border-b-2'
            }`}
          >
            <History size={15} className={viewMode === 'HISTORY' ? 'text-blue-400' : 'text-slate-500'} />
            <span>سجل المحاضر السابقة ({audits.length})</span>
          </button>

          <button
            type="button"
            onClick={handleStartNewAudit}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl text-xs font-bold border border-blue-500 border-b-4 border-b-blue-800 shadow-md shadow-blue-500/20 active:translate-y-0.5 active:border-b-2 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>محضر جرد جديد</span>
          </button>

          {/* Export / Import Dropdown Controls */}
          {currentAudit && (
            <div className="flex items-center gap-1.5">
              <ExportButtonGroup
                title={`محضر جرد وتسوية المخزون رقم ${currentAudit.auditNumber}`}
                filename={`محضر_جرد_${currentAudit.auditNumber}`}
                headers={[
                  'رقم',
                  'كود الصنف',
                  'اسم الصنف',
                  'الباركود',
                  'التصنيف',
                  'الوحدة',
                  'الموقع والرف',
                  'الرصيد الدفتري',
                  'الرصيد الفعلي',
                  'فارق الكمية',
                  'تكلفة الوحدة',
                  'القيمة المالية للفارق',
                  'الملاحظات وسبب الفارق'
                ]}
                rows={currentAudit.lines.map((l, idx) => [
                  idx + 1,
                  l.itemCode,
                  l.itemName || '',
                  l.barcode || '',
                  l.category || '',
                  l.unit || 'قطعة',
                  l.shelfLocation || '',
                  l.bookQuantity,
                  l.actualQuantity,
                  l.varianceQuantity,
                  l.unitCostPrice,
                  l.varianceValue,
                  l.notes || ''
                ])}
                filterSummary={`المستودع: ${currentAudit.targetWarehouse} | التاريخ: ${currentAudit.date} | الحالة: ${currentAudit.status === 'POSTED' ? 'مرحل ومعتمد' : 'مسودة قيد الجرد'}`}
                size="sm"
              />

              {currentAudit.status === 'DRAFT' && (
                <button
                  type="button"
                  onClick={() => setImportModalOpen(true)}
                  className="btn-3d btn-3d-white flex items-center gap-1.5 px-3 py-1.5 text-indigo-700 text-xs font-black shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  title="استيراد الكميات الفعلية المعدودة من ملف CSV / Excel"
                >
                  <Upload size={14} className="text-indigo-600" />
                  <span className="hidden sm:inline">استيراد كشف</span>
                </button>
              )}
            </div>
          )}

          {/* Print Modes Dropdown */}
          {currentAudit && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setPrintDropdownOpen(!printDropdownOpen)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-b from-white to-slate-50 hover:from-slate-50 hover:to-slate-100 text-slate-700 border border-slate-200 border-b-4 border-b-slate-300 rounded-xl text-xs font-bold shadow-sm active:translate-y-0.5 active:border-b-2 transition-all cursor-pointer"
              >
                <Printer size={15} className="text-blue-600" />
                <span>طباعة المحضر</span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {printDropdownOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 z-40 text-xs text-right animate-in fade-in">
                  <button
                    type="button"
                    onClick={() => triggerPrint('BLIND')}
                    className="w-full text-right px-4 py-2.5 hover:bg-slate-50 flex items-start gap-2.5 transition-colors"
                  >
                    <FileText size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-slate-900">كشف جرد أعمى (للعمال واللجنة)</div>
                      <div className="text-[11px] text-slate-500">بدون إظهار الرصيد الدفتري لمنع التخمين والتلاعب الميداني</div>
                    </div>
                  </button>

                  <div className="border-t border-slate-100 my-1"></div>

                  <button
                    type="button"
                    onClick={() => triggerPrint('OFFICIAL')}
                    className="w-full text-right px-4 py-2.5 hover:bg-slate-50 flex items-start gap-2.5 transition-colors"
                  >
                    <ShieldCheck size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-slate-900">محضر التسوية والفوارق المالية المعتمد</div>
                      <div className="text-[11px] text-slate-500">التقرير الرقابي الشامل مع قيم التكلفة وأثر القيد المحاسبي</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('warehouseBalances')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-b from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-700 border border-slate-300 border-b-4 border-b-slate-400 rounded-xl text-xs font-semibold shadow-sm active:translate-y-0.5 active:border-b-2 transition-all cursor-pointer"
              title="العودة إلى شاشة أرصدة المخازن"
            >
              <Warehouse size={14} className="text-slate-500" />
              <span>أرصدة المخزن</span>
            </button>
          )}
        </div>
      </div>

      {/* VIEW MODE: AUDIT HISTORY ARCHIVE */}
      {viewMode === 'HISTORY' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 print:hidden">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">سجل محاضر الجرد الدوري السابقة</h2>
              <p className="text-xs text-slate-500">استعراض محاضر الجرد، حالات الاعتماد، والقيود المحاسبية الصادرة</p>
            </div>
            <button
              type="button"
              onClick={() => setViewMode('CURRENT')}
              className="text-xs text-blue-600 hover:underline font-bold"
            >
              العودة للمحضر النشط &larr;
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">رقم المحضر</th>
                  <th className="py-3 px-3">تاريخ الجرد</th>
                  <th className="py-3 px-3">عنوان المحضر</th>
                  <th className="py-3 px-3">المستودع</th>
                  <th className="py-3 px-3 text-center">الحالة</th>
                  <th className="py-3 px-3 text-center">أصناف مطابقة</th>
                  <th className="py-3 px-3 text-center">أصناف بها عجز</th>
                  <th className="py-3 px-3 text-center">أصناف بها زيادة</th>
                  <th className="py-3 px-3 text-center">صافي الأثر المالي</th>
                  <th className="py-3 px-3">قيد التسوية</th>
                  <th className="py-3 px-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {audits.map(audit => (
                  <tr key={audit.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-blue-600">
                      {audit.auditNumber}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">{audit.date}</td>
                    <td className="py-3 px-3 font-semibold text-slate-900">{audit.auditTitle}</td>
                    <td className="py-3 px-3 text-slate-600">{audit.targetWarehouse}</td>
                    <td className="py-3 px-3 text-center">
                      {audit.status === 'POSTED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 size={11} />
                          معتمد ومرحل
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <FileText size={11} />
                          مسودة قيد التدقيق
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-emerald-600 font-bold">
                      {audit.totals.matchedCount}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-red-600 font-bold">
                      {audit.totals.shortageCount}
                      {audit.totals.totalShortageValue > 0 && (
                        <span className="block text-[10px] text-red-500 font-normal">
                          (-{audit.totals.totalShortageValue.toLocaleString()})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-blue-600 font-bold">
                      {audit.totals.surplusCount}
                      {audit.totals.totalSurplusValue > 0 && (
                        <span className="block text-[10px] text-blue-500 font-normal">
                          (+{audit.totals.totalSurplusValue.toLocaleString()})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold">
                      <span className={audit.totals.netVarianceValue < 0 ? 'text-red-600' : audit.totals.netVarianceValue > 0 ? 'text-blue-600' : 'text-slate-500'}>
                        {audit.totals.netVarianceValue > 0 ? '+' : ''}
                        {audit.totals.netVarianceValue.toLocaleString()} {currencySymbol}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {audit.journalEntryNumber ? (
                        <button
                          type="button"
                          onClick={() => handleOpenJournalEntry(audit.journalEntryNumber)}
                          className="inline-flex items-center gap-1 font-mono text-blue-600 hover:text-blue-800 underline font-bold cursor-pointer"
                          title="عرض القيد المحاسبي"
                        >
                          <ExternalLink size={12} />
                          {audit.journalEntryNumber}
                        </button>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveAuditId(audit.id);
                            setViewMode('CURRENT');
                          }}
                          className="p-1.5 text-blue-700 bg-gradient-to-b from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border border-blue-200 border-b-2 border-b-blue-400 rounded-lg shadow-2xs active:translate-y-0.5 active:border-b-0 transition-all cursor-pointer"
                          title="فتح المحضر"
                        >
                          <Eye size={15} />
                        </button>
                        {audit.status === 'DRAFT' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteAudit(audit.id)}
                            className="p-1.5 text-red-700 bg-gradient-to-b from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 border border-red-200 border-b-2 border-b-red-400 rounded-lg shadow-2xs active:translate-y-0.5 active:border-b-0 transition-all cursor-pointer"
                            title="حذف المسودة"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW MODE: ACTIVE AUDIT SESSION */}
      {viewMode === 'CURRENT' && currentAudit && (
        <div className="space-y-6">
          {/* AUDIT DETAILS HEADER CARD */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 print:border-none print:shadow-none print:p-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-100 text-blue-600">
                  <FileText size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black text-blue-600">
                      {currentAudit.auditNumber}
                    </span>
                    {currentAudit.status === 'POSTED' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 size={13} />
                        معتمد ومرحل بالدفاتر
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        <AlertTriangle size={13} />
                        مسودة - قيد الإدخال والتدقيق
                      </span>
                    )}
                  </div>
                  <h2 className="text-sm font-semibold text-slate-800 mt-0.5">
                    {currentAudit.auditTitle}
                  </h2>
                </div>
              </div>

              {/* Journal entry button if posted */}
              {currentAudit.journalEntryNumber && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl text-xs text-emerald-800 print:hidden">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  <span>تم ترحيل قيد التسوية رقم: </span>
                  <button
                    type="button"
                    onClick={() => handleOpenJournalEntry(currentAudit.journalEntryNumber)}
                    className="font-mono font-bold text-emerald-700 underline hover:text-emerald-900 cursor-pointer"
                  >
                    {currentAudit.journalEntryNumber}
                  </button>
                </div>
              )}
            </div>

            {/* Editable Fields if Draft */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  <span className="flex items-center gap-1">
                    <Calendar size={13} className="text-slate-400" />
                    تاريخ الجرد
                  </span>
                </label>
                {currentAudit.status === 'POSTED' ? (
                  <div className="font-mono py-1.5 text-slate-800 font-bold">{currentAudit.date}</div>
                ) : (
                  <input
                    type="date"
                    value={currentAudit.date}
                    onChange={e => handleUpdateAuditHeader('date', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                )}
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  <span className="flex items-center gap-1">
                    <Building2 size={13} className="text-slate-400" />
                    المستودع الخاضع للجرد
                  </span>
                </label>
                {currentAudit.status === 'POSTED' ? (
                  <div className="py-1.5 text-slate-800 font-bold">{currentAudit.targetWarehouse}</div>
                ) : (
                  <select
                    value={currentAudit.targetWarehouse}
                    onChange={e => handleUpdateAuditHeader('targetWarehouse', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    {warehousesList.map(wh => (
                      <option key={wh} value={wh}>{wh}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  <span className="flex items-center gap-1">
                    <Users size={13} className="text-slate-400" />
                    لجنة الجرد والمطابقة
                  </span>
                </label>
                {currentAudit.status === 'POSTED' ? (
                  <div className="py-1.5 text-slate-800 font-medium truncate" title={currentAudit.committeeMembers}>
                    {currentAudit.committeeMembers}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={currentAudit.committeeMembers}
                    onChange={e => handleUpdateAuditHeader('committeeMembers', e.target.value)}
                    placeholder="أسماء أعضاء اللجنة أو المدقق"
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                )}
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">عنوان المحضر / المناسبة</label>
                {currentAudit.status === 'POSTED' ? (
                  <div className="py-1.5 text-slate-800 font-medium truncate">{currentAudit.auditTitle}</div>
                ) : (
                  <input
                    type="text"
                    value={currentAudit.auditTitle}
                    onChange={e => handleUpdateAuditHeader('auditTitle', e.target.value)}
                    placeholder="مثال: جرد نهاية العام المالي"
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                )}
              </div>
            </div>
          </div>

          {/* 🌟 STATISTICAL SUMMARY & FINANCIAL IMPACT KPIS 🌟 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 print:grid-cols-5">
            {/* Total Items */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span>إجمالي الأصناف بالمحضر</span>
                <PackageCheck size={16} className="text-blue-600" />
              </div>
              <div className="text-xl font-bold font-mono text-slate-900">
                {currentAudit.totals.totalItems} <span className="text-xs font-normal text-slate-500">صنف</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">خاضعة للمطابقة والتدقيق</span>
            </div>

            {/* Matched Count */}
            <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
              <div className="flex items-center justify-between text-emerald-700 text-xs mb-1">
                <span>أصناف مطابقة تماماً (0)</span>
                <CheckCircle2 size={16} className="text-emerald-600" />
              </div>
              <div className="text-xl font-bold font-mono text-emerald-600">
                {currentAudit.totals.matchedCount} <span className="text-xs font-normal text-emerald-700">صنف</span>
              </div>
              <span className="text-[11px] text-emerald-700/70 mt-0.5 block">لا توجد أي فوارق كمية</span>
            </div>

            {/* Shortages Deficit */}
            <div className="bg-white p-4 rounded-xl border border-red-200 bg-red-50/20 shadow-xs">
              <div className="flex items-center justify-between text-red-700 text-xs mb-1">
                <span>أصناف بها عجز (نقص)</span>
                <TrendingDown size={16} className="text-red-600" />
              </div>
              <div className="text-xl font-bold font-mono text-red-600">
                {currentAudit.totals.shortageCount} <span className="text-xs font-normal text-red-700">صنف</span>
              </div>
              <span className="text-[11px] text-red-600/80 mt-0.5 block font-mono">
                قيمة العجز: {currentAudit.totals.totalShortageValue.toLocaleString()} {currencySymbol}
              </span>
            </div>

            {/* Surpluses */}
            <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-xs">
              <div className="flex items-center justify-between text-blue-700 text-xs mb-1">
                <span>أصناف بها زيادة (فائض)</span>
                <TrendingUp size={16} className="text-blue-600" />
              </div>
              <div className="text-xl font-bold font-mono text-blue-600">
                {currentAudit.totals.surplusCount} <span className="text-xs font-normal text-blue-700">صنف</span>
              </div>
              <span className="text-[11px] text-blue-600/80 mt-0.5 block font-mono">
                قيمة الفائض: {currentAudit.totals.totalSurplusValue.toLocaleString()} {currencySymbol}
              </span>
            </div>

            {/* Net Financial Adjustment Impact */}
            <div className="bg-white p-4 rounded-xl border border-slate-300 col-span-2 sm:col-span-1 shadow-xs bg-slate-900 text-white">
              <div className="flex items-center justify-between text-slate-300 text-xs mb-1">
                <span>صافي أثر التسوية</span>
                <Layers size={16} className="text-amber-400" />
              </div>
              <div className={`text-xl font-bold font-mono ${
                currentAudit.totals.netVarianceValue < 0 
                  ? 'text-red-400' 
                  : currentAudit.totals.netVarianceValue > 0 
                    ? 'text-emerald-400' 
                    : 'text-slate-200'
              }`}>
                {currentAudit.totals.netVarianceValue > 0 ? '+' : ''}
                {currentAudit.totals.netVarianceValue.toLocaleString()} <span className="text-xs text-slate-400">{currencySymbol}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {currentAudit.totals.netVarianceValue < 0 ? 'صافي خسارة عجز مخزني' : currentAudit.totals.netVarianceValue > 0 ? 'صافي أرباح تسوية زيادة' : 'متطابق محاسبياً'}
              </span>
            </div>
          </div>

          {/* 🌟 BARCODE QUICK SCANNER TOOLBAR (DRAFT MODE) 🌟 */}
          {currentAudit.status === 'DRAFT' && (
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-4 shadow-md border border-blue-800/40 print:hidden">
              <form onSubmit={handleBarcodeScanSubmit} className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 rounded-xl text-blue-300 shrink-0">
                    <ScanBarcode size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">ماسح الباركود السريع للجرد</span>
                      <span className="bg-blue-500/30 text-blue-200 text-[10px] font-mono px-2 py-0.5 rounded-full">
                        قارئ يدوي / ماسح لاسلكي
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      امسح باركود الصنف أو اكتبه واضغط Enter لزيادة الكمية تلقائياً
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-1 max-w-xl">
                  <div className="relative flex-1">
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={barcodeInput}
                      onChange={e => setBarcodeInput(e.target.value)}
                      placeholder="امسح أو اكتب الباركود أو كود الصنف..."
                      className="w-full pl-3 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 text-xs font-mono focus:ring-2 focus:ring-blue-400 focus:outline-hidden focus:bg-white/20 transition-all"
                    />
                  </div>

                  {/* Mode toggle */}
                  <div className="flex items-center bg-white/10 rounded-xl p-1 border border-white/10 text-xs shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setScanMode('INCREMENT')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                        scanMode === 'INCREMENT'
                          ? 'bg-gradient-to-b from-blue-500 to-blue-600 text-white border border-blue-500 border-b-2 border-b-blue-800 shadow-sm active:translate-y-0.5 active:border-b-0'
                          : 'text-slate-300 hover:text-white'
                      }`}
                      title="كل مسحة تضيف +1 إلى الرصيد الفعلي"
                    >
                      عد تراكمي (+1)
                    </button>
                    <button
                      type="button"
                      onClick={() => setScanMode('LOCATE')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                        scanMode === 'LOCATE'
                          ? 'bg-gradient-to-b from-blue-500 to-blue-600 text-white border border-blue-500 border-b-2 border-b-blue-800 shadow-sm active:translate-y-0.5 active:border-b-0'
                          : 'text-slate-300 hover:text-white'
                      }`}
                      title="القفز وتحديد خانة الكمية لإدخال العدد الإجمالي"
                    >
                      تحديد مباشر
                    </button>
                  </div>

                  {/* Sound toggle */}
                  <button
                    type="button"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="p-2.5 rounded-xl bg-gradient-to-b from-white/20 to-white/10 hover:from-white/30 hover:to-white/15 text-slate-200 border border-white/20 border-b-3 border-b-black/40 shadow-xs active:translate-y-0.5 active:border-b-1 transition-all shrink-0 cursor-pointer"
                    title={soundEnabled ? 'كتم التنبيه الصوتي' : 'تفعيل التنبيه الصوتي'}
                  >
                    {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TABLE & CONTROLS CONTAINER */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Table Control Bar */}
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 print:hidden">
              {/* Search & Category Filter */}
              <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={itemSearch}
                    onChange={e => setItemSearch(e.target.value)}
                    placeholder="ابحث بالاسم، كود الصنف، الباركود، أو الرف..."
                    className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  {itemSearch && (
                    <button
                      type="button"
                      onClick={() => setItemSearch('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Category Filter Dropdown */}
                {categoriesList.length > 1 && (
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="ALL">كافة التصنيفات ({categoriesList.length})</option>
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Variance Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setVarianceFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    varianceFilter === 'ALL'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  الكل ({currentAudit.lines.length})
                </button>
                <button
                  type="button"
                  onClick={() => setVarianceFilter('VARIANCE_ONLY')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    varianceFilter === 'VARIANCE_ONLY'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  الفوارق ({currentAudit.totals.shortageCount + currentAudit.totals.surplusCount})
                </button>
                <button
                  type="button"
                  onClick={() => setVarianceFilter('SHORTAGE_ONLY')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    varianceFilter === 'SHORTAGE_ONLY'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-white text-red-700 hover:bg-red-50 border border-red-200'
                  }`}
                >
                  عجز ({currentAudit.totals.shortageCount})
                </button>
                <button
                  type="button"
                  onClick={() => setVarianceFilter('SURPLUS_ONLY')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    varianceFilter === 'SURPLUS_ONLY'
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
                  }`}
                >
                  زيادة ({currentAudit.totals.surplusCount})
                </button>
                <button
                  type="button"
                  onClick={() => setVarianceFilter('MATCHED_ONLY')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    varianceFilter === 'MATCHED_ONLY'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                  }`}
                >
                  مطابق ({currentAudit.totals.matchedCount})
                </button>
              </div>

              {/* Convenience actions & View mode toggles */}
              <div className="flex items-center gap-2">
                {currentAudit.status === 'DRAFT' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setAddItemModalOpen(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      title="إضافة صنف غير مسجل في المحضر"
                    >
                      <PlusCircle size={14} />
                      <span className="hidden sm:inline">إضافة صنف</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSetAllToBook}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                      title="تعبئة كل الكميات الفعلية لتطابق الرصيد الدفتري"
                    >
                      <Check size={13} className="text-emerald-600" />
                      <span className="hidden sm:inline">مطابقة الكل</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetAllToZero}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                      title="تصفير الأرصدة للبدء في العد الأعمى"
                    >
                      <RotateCcw size={13} className="text-slate-500" />
                      <span className="hidden sm:inline">عد من الصفر</span>
                    </button>
                  </>
                )}

                {/* View switcher: Table vs Cards for mobile/tablets */}
                <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setDisplayLayout('TABLE')}
                    className={`p-1.5 rounded-md transition-colors ${
                      displayLayout === 'TABLE' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="عرض الجدول القياسي"
                  >
                    <TableIcon size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayLayout('CARDS')}
                    className={`p-1.5 rounded-md transition-colors ${
                      displayLayout === 'CARDS' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="عرض بطاقات لمسية للجوال والأجهزة اللوحية"
                  >
                    <LayoutGrid size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Reason Picker Popup (if active) */}
            {activeReasonPickerLineId && (
              <div className="p-3 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-amber-900 flex items-center gap-1">
                  <Tag size={13} />
                  اختر سبب الفارق السريع:
                </span>
                {QUICK_VARIANCE_REASONS.map(reason => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => {
                      handleLineNotesChange(activeReasonPickerLineId, reason);
                      setActiveReasonPickerLineId(null);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg font-medium shadow-xs transition-colors cursor-pointer"
                  >
                    {reason}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setActiveReasonPickerLineId(null)}
                  className="px-2 py-1 text-slate-500 hover:text-slate-800 text-xs font-bold mr-auto"
                >
                  إلغاء ×
                </button>
              </div>
            )}

            {/* LAYOUT 1: CARDS VIEW (Mobile & Tablet Ergonomics) */}
            {displayLayout === 'CARDS' ? (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 print:hidden">
                {filteredLines.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-400">
                    لا توجد أصناف تطابق معايير الفلترة المحددة.
                  </div>
                ) : (
                  filteredLines.map((line, idx) => {
                    const isShortage = line.varianceQuantity < 0;
                    const isSurplus = line.varianceQuantity > 0;
                    const isMatched = line.varianceQuantity === 0;
                    const isHighlighted = scannedHighlightId === line.id;

                    return (
                      <div
                        id={`audit-row-${line.id}`}
                        key={line.id}
                        className={`rounded-xl border p-3.5 transition-all ${
                          isHighlighted 
                            ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400'
                            : isShortage 
                              ? 'bg-red-50/30 border-red-200' 
                              : isSurplus 
                                ? 'bg-blue-50/30 border-blue-200' 
                                : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 font-mono text-xs">#{idx + 1}</span>
                              <span className="font-bold text-slate-900 text-sm">{line.itemName}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                              <span>كود: {line.itemCode}</span>
                              {line.barcode && <span>• {line.barcode}</span>}
                              {line.shelfLocation && (
                                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-sans text-[10px]">
                                  رف: {line.shelfLocation}
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setAnalyticItemId(line.itemId)}
                            className="p-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 transition-all cursor-pointer shrink-0"
                            title="تحليل الصنف ومؤشراته"
                          >
                            <BarChart3 size={14} />
                          </button>
                        </div>

                        {/* Stock comparison & touch counter */}
                        <div className="grid grid-cols-3 gap-2 py-3 text-center border-b border-slate-100">
                          <div className="bg-slate-50 rounded-lg p-2">
                            <span className="block text-[10px] text-slate-500 mb-0.5">الرصيد الدفتري</span>
                            <span className="font-mono font-bold text-sm text-slate-800">
                              {line.bookQuantity.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-400 mr-1">{line.unit || 'قطعة'}</span>
                          </div>

                          <div className="bg-blue-50/60 rounded-lg p-2 border border-blue-200">
                            <span className="block text-[10px] text-blue-800 font-bold mb-0.5">الفعلي المعدود</span>
                            {currentAudit.status === 'POSTED' ? (
                              <span className="font-mono font-bold text-base text-slate-900">
                                {line.actualQuantity.toLocaleString()}
                              </span>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={line.actualQuantity}
                                onChange={e => handleLineActualChange(line.id, e.target.value)}
                                className="w-full text-center font-mono font-black text-base bg-white border border-blue-400 rounded-md py-0.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                              />
                            )}
                          </div>

                          <div className={`rounded-lg p-2 ${
                            isMatched ? 'bg-emerald-50 text-emerald-700' : isShortage ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            <span className="block text-[10px] mb-0.5">الفارق</span>
                            <span className="font-mono font-black text-sm">
                              {isSurplus ? `+${line.varianceQuantity}` : line.varianceQuantity}
                            </span>
                            <span className="block text-[10px] mt-0.5 font-mono">
                              {isSurplus ? '+' : ''}{line.varianceValue.toLocaleString()} {currencySymbol}
                            </span>
                          </div>
                        </div>

                        {/* Touch quick stepper buttons (Draft mode) */}
                        {currentAudit.status === 'DRAFT' && (
                          <div className="flex items-center justify-between gap-1.5 pt-2.5">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStepLineActual(line.id, -1)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono font-bold rounded-lg text-xs"
                                title="-1"
                              >
                                -1
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStepLineActual(line.id, 1)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-mono font-bold rounded-lg text-xs"
                                title="+1"
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStepLineActual(line.id, 5)}
                                className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono font-bold rounded-lg text-xs"
                                title="+5"
                              >
                                +5
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStepLineActual(line.id, 10)}
                                className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono font-bold rounded-lg text-xs"
                                title="+10"
                              >
                                +10
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => setActiveReasonPickerLineId(line.id)}
                              className="text-xs text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1"
                            >
                              <Tag size={12} />
                              <span>{line.notes || 'سبب الفارق'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* LAYOUT 2: STANDARD DATA TABLE */
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100/80 text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center">#</th>
                      <th className="py-3 px-3">بيانات الصنف والباركود</th>
                      <th className="py-3 px-3">الموقع / الرف</th>
                      <th className="py-3 px-3 text-center">الوحدة</th>
                      <th className="py-3 px-3 text-center bg-slate-200/50">الرصيد الدفتري (النظام)</th>
                      <th className="py-3 px-3 text-center bg-blue-50/60 font-bold text-blue-950">
                        الرصيد الفعلي (المعدود)
                      </th>
                      <th className="py-3 px-3 text-center">فارق الكمية</th>
                      <th className="py-3 px-3 text-center">تكلفة الوحدة</th>
                      <th className="py-3 px-3 text-center">القيمة المالية للفارق</th>
                      <th className="py-3 px-3 min-w-[200px]">سبب الفارق / ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredLines.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          لا توجد أصناف تطابق معايير الفلترة المحددة.
                        </td>
                      </tr>
                    ) : (
                      filteredLines.map((line, idx) => {
                        const isShortage = line.varianceQuantity < 0;
                        const isSurplus = line.varianceQuantity > 0;
                        const isMatched = line.varianceQuantity === 0;
                        const isHighlighted = scannedHighlightId === line.id;

                        return (
                          <tr 
                            id={`audit-row-${line.id}`}
                            key={line.id} 
                            className={`transition-colors ${
                              isHighlighted
                                ? 'bg-amber-100 ring-2 ring-amber-400'
                                : isShortage 
                                  ? 'bg-red-50/20 hover:bg-red-50/40' 
                                  : isSurplus 
                                    ? 'bg-blue-50/20 hover:bg-blue-50/40' 
                                    : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>

                            {/* Item Info */}
                            <td className="py-3 px-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-bold text-slate-900">{line.itemName}</div>
                                <button
                                  type="button"
                                  onClick={() => setAnalyticItemId(line.itemId)}
                                  className="p-1 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 transition-all shrink-0 flex items-center justify-center cursor-pointer"
                                  title="تحليل الصنف ومؤشراته وحركاته السابقة"
                                >
                                  <BarChart3 size={13} />
                                </button>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                                <span>كود: {line.itemCode}</span>
                                {line.barcode && <span>• {line.barcode}</span>}
                                {line.category && (
                                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-sans text-[10px]">
                                    {line.category}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Shelf Location */}
                            <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                              {line.shelfLocation || 'A-01'}
                            </td>

                            {/* Unit */}
                            <td className="py-3 px-3 text-center text-slate-600">
                              {line.unit || 'قطعة'}
                            </td>

                            {/* Book Quantity */}
                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-800 bg-slate-50">
                              {line.bookQuantity.toLocaleString()}
                            </td>

                            {/* Actual Quantity (Editable if DRAFT) */}
                            <td className="py-3 px-3 text-center bg-blue-50/30">
                              {currentAudit.status === 'POSTED' ? (
                                <span className="font-mono font-bold text-slate-900 text-sm">
                                  {line.actualQuantity.toLocaleString()}
                                </span>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStepLineActual(line.id, -1)}
                                    className="w-6 h-7 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold"
                                    title="-1"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={line.actualQuantity}
                                    onChange={e => handleLineActualChange(line.id, e.target.value)}
                                    className="w-20 text-center font-mono font-bold text-sm bg-white border border-blue-300 rounded-lg px-2 py-1 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleStepLineActual(line.id, 1)}
                                    className="w-6 h-7 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-bold"
                                    title="+1"
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                            </td>

                            {/* Variance Quantity Badge */}
                            <td className="py-3 px-3 text-center">
                              {isMatched ? (
                                <span className="inline-flex items-center gap-1 font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full text-xs">
                                  <Check size={11} />
                                  0
                                </span>
                              ) : isShortage ? (
                                <span className="inline-flex items-center gap-1 font-mono text-red-700 font-black bg-red-100 px-2 py-0.5 rounded-full text-xs">
                                  <TrendingDown size={11} />
                                  {line.varianceQuantity}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-mono text-blue-700 font-black bg-blue-100 px-2 py-0.5 rounded-full text-xs">
                                  <TrendingUp size={11} />
                                  +{line.varianceQuantity}
                                </span>
                              )}
                            </td>

                            {/* Unit Cost */}
                            <td className="py-3 px-3 text-center font-mono text-slate-600">
                              {line.unitCostPrice.toLocaleString()} {currencySymbol}
                            </td>

                            {/* Financial Variance Amount */}
                            <td className="py-3 px-3 text-center font-mono font-bold">
                              <span className={isShortage ? 'text-red-600' : isSurplus ? 'text-blue-600' : 'text-slate-400'}>
                                {isSurplus ? '+' : ''}
                                {line.varianceValue.toLocaleString()} {currencySymbol}
                              </span>
                            </td>

                            {/* Notes / Reason */}
                            <td className="py-3 px-3">
                              {currentAudit.status === 'POSTED' ? (
                                <span className="text-slate-600 text-xs">{line.notes || '-'}</span>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={line.notes || ''}
                                    onChange={e => handleLineNotesChange(line.id, e.target.value)}
                                    placeholder="سبب الفارق..."
                                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setActiveReasonPickerLineId(line.id)}
                                    className="p-1 text-slate-400 hover:text-amber-600 rounded-md hover:bg-slate-100"
                                    title="اختيار سبب جاهز بنقرة واحدة"
                                  >
                                    <Tag size={13} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 🌟 AUTOMATIC JOURNAL ENTRY PREVIEW & POSTING ACTION (IF DRAFT) 🌟 */}
          {currentAudit.status === 'DRAFT' && (
            <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-blue-800/40 print:hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 mb-4 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
                    <ShieldCheck size={16} />
                    <span>توليد قيد التسوية المخزنية التلقائي</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    معاينة أطراف القيد المحاسبي المتوازن قبل الاعتماد والترحيل
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    سيقوم النظام بتوليد قيد اليومية وتحديث أرصدة بطاقات الأصناف تلقائياً لمطابقة الواقع الفعلي 100%.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmPostModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-900/40 transition-all cursor-pointer whitespace-nowrap"
                >
                  <CheckCircle2 size={18} />
                  <span>اعتماد وترحيل الجرد وتوليد القيد</span>
                </button>
              </div>

              {/* Accounting Journal Lines Preview Table */}
              <div className="bg-black/20 rounded-xl border border-white/10 overflow-hidden text-xs">
                <table className="w-full text-right">
                  <thead className="bg-white/5 text-slate-300 border-b border-white/10">
                    <tr>
                      <th className="py-2.5 px-3">طرف القيد / الحساب المالي</th>
                      <th className="py-2.5 px-3">رقم الحساب</th>
                      <th className="py-2.5 px-3 text-center">طبيعة الحساب</th>
                      <th className="py-2.5 px-3 text-center font-mono">مدين ({currencySymbol})</th>
                      <th className="py-2.5 px-3 text-center font-mono">دائن ({currencySymbol})</th>
                      <th className="py-2.5 px-3">البيان والشرح التلقائي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {/* If Shortage exists */}
                    {currentAudit.totals.totalShortageValue > 0 && (
                      <>
                        <tr className="hover:bg-white/5 text-red-200">
                          <td className="py-2.5 px-3 font-bold font-sans">
                            من حـ/ مصروفات وخسائر عجز وتلف المخزون
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">5107</td>
                          <td className="py-2.5 px-3 text-center text-slate-400 font-sans">مصروفات / خسائر</td>
                          <td className="py-2.5 px-3 text-center font-bold text-red-300">
                            {currentAudit.totals.totalShortageValue.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-500">0.00</td>
                          <td className="py-2.5 px-3 text-slate-300 font-sans">
                            إثبات العجز والتلف المخزني لمحضر ({currentAudit.auditNumber})
                          </td>
                        </tr>
                        <tr className="hover:bg-white/5 text-slate-200">
                          <td className="py-2.5 px-3 font-bold font-sans">
                            إلى حـ/ المخزون السلعي (المستودع الرئيسي)
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">1301</td>
                          <td className="py-2.5 px-3 text-center text-slate-400 font-sans">أصول متداولة</td>
                          <td className="py-2.5 px-3 text-center text-slate-500">0.00</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-200">
                            {currentAudit.totals.totalShortageValue.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 font-sans">
                            تخفيض الرصيد الدفتري للمخزون بالقيمة الفعلية
                          </td>
                        </tr>
                      </>
                    )}

                    {/* If Surplus exists */}
                    {currentAudit.totals.totalSurplusValue > 0 && (
                      <>
                        <tr className="hover:bg-white/5 text-emerald-200">
                          <td className="py-2.5 px-3 font-bold font-sans">
                            من حـ/ المخزون السلعي (المستودع الرئيسي)
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">1301</td>
                          <td className="py-2.5 px-3 text-center text-slate-400 font-sans">أصول متداولة</td>
                          <td className="py-2.5 px-3 text-center font-bold text-emerald-300">
                            {currentAudit.totals.totalSurplusValue.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-500">0.00</td>
                          <td className="py-2.5 px-3 text-slate-300 font-sans">
                            إثبات الزيادة المخزنية الفعلية لمحضر ({currentAudit.auditNumber})
                          </td>
                        </tr>
                        <tr className="hover:bg-white/5 text-blue-200">
                          <td className="py-2.5 px-3 font-bold font-sans">
                            إلى حـ/ أرباح وفروقات تسوية زيادة المخزون
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">4202</td>
                          <td className="py-2.5 px-3 text-center text-slate-400 font-sans">إيرادات أخرى</td>
                          <td className="py-2.5 px-3 text-center text-slate-500">0.00</td>
                          <td className="py-2.5 px-3 text-center font-bold text-blue-300">
                            {currentAudit.totals.totalSurplusValue.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 font-sans">
                            تسوية إيرادات وأرباح فروقات الزيادة المخزنية
                          </td>
                        </tr>
                      </>
                    )}

                    {/* If NO variances */}
                    {currentAudit.totals.totalShortageValue === 0 && currentAudit.totals.totalSurplusValue === 0 && (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-emerald-400 font-sans font-semibold">
                          ✓ جميع الأرصدة الفعلية متطابقة تماماً 100% مع الأرصدة الدفترية! لا يتطلب إصدار قيد تسوية مالية.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {/* Balance Check */}
                  {(currentAudit.totals.totalShortageValue > 0 || currentAudit.totals.totalSurplusValue > 0) && (
                    <tfoot className="bg-white/10 font-mono font-bold text-white border-t border-white/20">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3 font-sans">إجمالي ميزان القيد (توازن محاسبي تام):</td>
                        <td className="py-2.5 px-3 text-center text-emerald-300">
                          {(currentAudit.totals.totalShortageValue + currentAudit.totals.totalSurplusValue).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-center text-emerald-300">
                          {(currentAudit.totals.totalShortageValue + currentAudit.totals.totalSurplusValue).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-emerald-400 font-sans text-[11px]">
                          ✓ متزن ومطابق لمعايير القيد المزدوج
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* 🌟 PRINTABLE REPORT 1: BLIND INVENTORY COUNT SHEET (PRINT ONLY) 🌟 */}
          {/* ============================================================== */}
          {printMode === 'BLIND' && (
            <div className="hidden print:block text-black p-6 space-y-4">
              <div className="text-center border-b-2 border-black pb-4">
                <h2 className="text-xl font-bold">{systemSettings.company.nameAr || systemSettings.company.nameEn || 'الشركة'}</h2>
                <h3 className="text-lg font-bold mt-1">كشف تفريغ الجرد المخزني الفعلي (الجرد الأعمى الميداني)</h3>
                <p className="text-xs text-slate-600 mt-1">
                  المطلوب من لجنة الجرد: حصر وعد الكميات الفعلية الموجودة على الرفوف وتدوينها بخط اليد في خانة [الكمية الفعلية المعدودة].
                </p>
                <div className="flex justify-between text-xs mt-3 font-mono border-t border-slate-300 pt-2">
                  <span>رقم المحضر: {currentAudit.auditNumber}</span>
                  <span>تاريخ الجرد: {currentAudit.date}</span>
                  <span>المستودع: {currentAudit.targetWarehouse}</span>
                </div>
              </div>

              <div className="text-xs space-y-1">
                <p><strong>أعضاء لجنة الجرد الميدانية:</strong> {currentAudit.committeeMembers}</p>
                <p><strong>تنبيه رقابي:</strong> تم إخفاء الأرصدة الدفترية وقيم التكلفة عمداً لضمان النزاهة والمطابقة الميدانية الحقيقية.</p>
              </div>

              {/* Blind Table */}
              <table className="w-full text-right text-xs border border-black border-collapse">
                <thead>
                  <tr className="bg-slate-200 border-b border-black text-center font-bold">
                    <th className="p-2 border border-black w-10">#</th>
                    <th className="p-2 border border-black">كود الصنف</th>
                    <th className="p-2 border border-black">اسم الصنف والمواصفات</th>
                    <th className="p-2 border border-black">الباركود</th>
                    <th className="p-2 border border-black">الموقع / الرف</th>
                    <th className="p-2 border border-black">الوحدة</th>
                    <th className="p-2 border-2 border-black bg-slate-100 min-w-[140px] text-black">
                      الكمية الفعلية المعدودة (تعبأ يدوياً)
                    </th>
                    <th className="p-2 border border-black min-w-[120px]">ملاحظات المدقق</th>
                  </tr>
                </thead>
                <tbody>
                  {currentAudit.lines.map((line, idx) => (
                    <tr key={line.id} className="border-b border-black">
                      <td className="p-2 text-center border border-black font-mono">{idx + 1}</td>
                      <td className="p-2 border border-black font-mono">{line.itemCode}</td>
                      <td className="p-2 border border-black font-bold">{line.itemName}</td>
                      <td className="p-2 border border-black font-mono">{line.barcode || '-'}</td>
                      <td className="p-2 border border-black text-center font-mono">{line.shelfLocation || '-'}</td>
                      <td className="p-2 border border-black text-center">{line.unit || 'قطعة'}</td>
                      <td className="p-2 border-2 border-black bg-slate-50 text-center font-mono font-bold text-sm">
                        {/* Empty box for manual pen entry */}
                      </td>
                      <td className="p-2 border border-black text-[11px] text-slate-500"></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Signatures */}
              <div className="pt-10 grid grid-cols-3 gap-6 text-center text-xs">
                <div className="border-t border-black pt-2">
                  <p className="font-bold">القائم بالعد الميداني</p>
                  <p className="mt-8">التوقيع: .....................</p>
                </div>
                <div className="border-t border-black pt-2">
                  <p className="font-bold">أمين المستودع</p>
                  <p className="mt-8">التوقيع: .....................</p>
                </div>
                <div className="border-t border-black pt-2">
                  <p className="font-bold">رئيس لجنة الجرد والتسليم</p>
                  <p className="mt-8">التوقيع: .....................</p>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* 🌟 PRINTABLE REPORT 2: OFFICIAL DISCREPANCY & VALUATION AUDIT (PRINT ONLY) 🌟 */}
          {/* ============================================================== */}
          {printMode === 'OFFICIAL' && (
            <div className="hidden print:block text-black p-6 space-y-4">
              <div className="text-center border-b-2 border-black pb-4">
                <h2 className="text-xl font-bold">{systemSettings.company.nameAr || systemSettings.company.nameEn || 'الشركة'}</h2>
                <h3 className="text-lg font-bold mt-1">محضر الجرد المخزني الفعلي والتسويات الدفترية المعتمد</h3>
                <div className="flex justify-between text-xs mt-3 font-mono border-t border-slate-300 pt-2">
                  <span>رقم المحضر: {currentAudit.auditNumber}</span>
                  <span>تاريخ الجرد: {currentAudit.date}</span>
                  <span>المستودع: {currentAudit.targetWarehouse}</span>
                </div>
              </div>

              <div className="text-xs space-y-1">
                <p><strong>لجنة الجرد:</strong> {currentAudit.committeeMembers}</p>
                <p><strong>حالة المحضر:</strong> {currentAudit.status === 'POSTED' ? `معتمد ومرحل بالدفاتر بقيد تسوية رقم (${currentAudit.journalEntryNumber || '-'})` : 'مسودة قيد التدقيق والمراجعة'}</p>
                <p><strong>إحصائيات الفوارق:</strong> أصناف مطابقة: ({currentAudit.totals.matchedCount}) • أصناف بها عجز: ({currentAudit.totals.shortageCount}) بقيمة: ({currentAudit.totals.totalShortageValue.toLocaleString()} {currencySymbol}) • أصناف بها زيادة: ({currentAudit.totals.surplusCount}) بقيمة: ({currentAudit.totals.totalSurplusValue.toLocaleString()} {currencySymbol})</p>
              </div>

              <table className="w-full text-right text-xs border border-black border-collapse">
                <thead>
                  <tr className="bg-slate-200 border-b border-black text-center font-bold">
                    <th className="p-1.5 border border-black w-8">#</th>
                    <th className="p-1.5 border border-black">كود الصنف</th>
                    <th className="p-1.5 border border-black">اسم الصنف</th>
                    <th className="p-1.5 border border-black">الرصيد الدفتري</th>
                    <th className="p-1.5 border border-black">الرصيد الفعلي</th>
                    <th className="p-1.5 border border-black">فارق الكمية</th>
                    <th className="p-1.5 border border-black">سعر التكلفة</th>
                    <th className="p-1.5 border border-black">قيمة الفارق ({currencySymbol})</th>
                    <th className="p-1.5 border border-black">سبب الفارق</th>
                  </tr>
                </thead>
                <tbody>
                  {currentAudit.lines.map((line, idx) => (
                    <tr key={line.id} className="border-b border-black text-center">
                      <td className="p-1.5 border border-black font-mono">{idx + 1}</td>
                      <td className="p-1.5 border border-black font-mono">{line.itemCode}</td>
                      <td className="p-1.5 border border-black font-bold text-right">{line.itemName}</td>
                      <td className="p-1.5 border border-black font-mono">{line.bookQuantity}</td>
                      <td className="p-1.5 border border-black font-mono font-bold">{line.actualQuantity}</td>
                      <td className="p-1.5 border border-black font-mono font-bold">
                        {line.varianceQuantity > 0 ? `+${line.varianceQuantity}` : line.varianceQuantity}
                      </td>
                      <td className="p-1.5 border border-black font-mono">{line.unitCostPrice.toLocaleString()}</td>
                      <td className="p-1.5 border border-black font-mono font-bold">
                        {line.varianceValue.toLocaleString()}
                      </td>
                      <td className="p-1.5 border border-black text-right text-[10px]">{line.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="font-bold border-t-2 border-black bg-slate-100">
                  <tr>
                    <td colSpan={7} className="p-2 border border-black text-right">صافي الأثر المالي للتسوية:</td>
                    <td className="p-2 border border-black text-center font-mono font-bold">
                      {currentAudit.totals.netVarianceValue > 0 ? '+' : ''}{currentAudit.totals.netVarianceValue.toLocaleString()} {currencySymbol}
                    </td>
                    <td className="p-2 border border-black"></td>
                  </tr>
                </tfoot>
              </table>

              {/* Signatures */}
              <div className="pt-10 grid grid-cols-4 gap-4 text-center text-xs">
                <div className="border-t border-black pt-2">
                  <p className="font-bold">أمين المستودع</p>
                  <p className="mt-8">التوقيع: .....................</p>
                </div>
                <div className="border-t border-black pt-2">
                  <p className="font-bold">رئيس لجنة الجرد</p>
                  <p className="mt-8">التوقيع: .....................</p>
                </div>
                <div className="border-t border-black pt-2">
                  <p className="font-bold">المدقق المالي</p>
                  <p className="mt-8">التوقيع: .....................</p>
                </div>
                <div className="border-t border-black pt-2">
                  <p className="font-bold">المدير العام / الاعتماد</p>
                  <p className="mt-8">التوقيع: .....................</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONFIRMATION MODAL TO POST AUDIT */}
      {confirmPostModalOpen && currentAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">تأكيد اعتماد وترحيل محضر الجرد</h3>
                <p className="text-xs text-slate-500">محضر رقم {currentAudit.auditNumber}</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 bg-slate-50 p-4 rounded-xl mb-5 leading-relaxed">
              <p className="font-semibold text-slate-800">
                عند تأكيد الترحيل، سيقوم النظام بالعمليات الآتية فوراً:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-700">
                <li>
                  تعديل وتحديث أرصدة المخزون الدفترية في بطاقات الأصناف لتتطابق تماماً مع الكميات الفعلية المجرودة.
                </li>
                {currentAudit.totals.totalShortageValue > 0 || currentAudit.totals.totalSurplusValue > 0 ? (
                  <li>
                    توليد قيد يومية محاسبي تلقائي متوازن لمعالجة الفوارق المالية (حساب عجز المخزون 5107، أو حساب زيادة المخزون 4202 مقابل المخزون السلعي 1301).
                  </li>
                ) : (
                  <li>
                    تثبيت تطابق الأرصدة بدون قيود مالية لعدم وجود أي فوارق.
                  </li>
                )}
                <li>
                  إغلاق المحضر وتحويل حالته إلى <strong>معتمد ومرحل (POSTED)</strong> لمنع التعديل اللاحق.
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmPostModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء وتراجع
              </button>
              <button
                type="button"
                onClick={handlePostAudit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-800/30 transition-all cursor-pointer"
              >
                تأكيد واعتماد الترحيل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW JOURNAL ENTRY MODAL */}
      {viewJeModalEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    قيد اليومية المحاسبي ({viewJeModalEntry.entryNumber})
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    التاريخ: {viewJeModalEntry.date} • المرجع: {viewJeModalEntry.reference}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewJeModalEntry(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl mb-4 font-medium">
              <strong>البيان:</strong> {viewJeModalEntry.description}
            </p>

            <div className="overflow-x-auto mb-5">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">رقم / كود الحساب</th>
                    <th className="py-2 px-3 text-center">مدين ({currencySymbol})</th>
                    <th className="py-2 px-3 text-center">دائن ({currencySymbol})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {viewJeModalEntry.items.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">
                        {item.accountId === 'acc-5107' 
                          ? '5107 - مصروفات وخسائر عجز وتلف المخزون'
                          : item.accountId === 'acc-1301'
                            ? '1301 - المخزون السلعي (المستودع الرئيسي)'
                            : item.accountId === 'acc-4202'
                              ? '4202 - أرباح وفروقات تسوية زيادة المخزون'
                              : item.accountId}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                        {item.debit > 0 ? item.debit.toLocaleString() : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                        {item.credit > 0 ? item.credit.toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    setViewJeModalEntry(null);
                    onNavigate('journalEntries');
                  }}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                >
                  <span>فتح شاشة قيود اليومية العامة</span>
                  <ExternalLink size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewJeModalEntry(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold mr-auto cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD UNLISTED ITEM TO AUDIT SESSION */}
      {addItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <PlusCircle size={20} className="text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">إضافة صنف غير مدرج إلى محضر الجرد</h3>
              </div>
              <button
                type="button"
                onClick={() => setAddItemModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              ابحث في دليل الأصناف لإدراج الأصناف المتبقية أو المعثور عليها فعلياً على الرف:
            </p>

            <div className="relative mb-4">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                placeholder="ابحث بالاسم، الكود، أو الباركود..."
                className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 mb-4 divide-y divide-slate-100">
              {filteredCatalogItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  جميع أصناف الدليل مدرجة بالفعل في هذا المحضر أو لا تطابق البحث.
                </div>
              ) : (
                filteredCatalogItems.map(item => (
                  <div key={item.id} className="pt-2 flex items-center justify-between gap-3 hover:bg-slate-50 p-2 rounded-xl">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{item.name}</div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                        <span>كود: {item.code}</span>
                        {item.barcode && <span>• باركود: {item.barcode}</span>}
                        <span>• الرصيد الحالي: {item.stock} {item.unit || 'قطعة'}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddCatalogItem(item)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shrink-0 transition-colors cursor-pointer"
                    >
                      إضافة للمحضر
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setAddItemModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: IMPORT COUNTED QUANTITIES CSV */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={20} className="text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">استيراد كشف الجرد الفعلي (CSV / Excel)</h3>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2 mb-4 bg-blue-50/60 p-3.5 rounded-xl border border-blue-100">
              <p className="font-bold text-blue-900">إرشادات الاستيراد التلقائي:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-700">
                <li>يمكنك استيراد نفس ملف كشف الجرد المصدر بعد ملء خانة الكمية الفعلية.</li>
                <li>يقوم النظام بمطابقة السجلات عبر (كود الصنف) أو (الباركود) وتحديث الكمية الفعلية تلقائياً.</li>
              </ul>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-blue-500 transition-colors bg-slate-50 mb-4">
              <Upload size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-xs font-bold text-slate-700 mb-1">اختر ملف CSV من جهازك</p>
              <p className="text-[11px] text-slate-400 mb-3">صيغة .csv مدعومة لبرنامج Excel</p>
              <input
                type="file"
                accept=".csv"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleImportFile(file);
                }}
                className="text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
              />
            </div>

            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={() => handleExportCSV('BLIND')}
                className="text-xs text-blue-600 hover:underline font-bold flex items-center gap-1"
              >
                <Download size={13} />
                <span>تحميل قالب كشف الجرد الفارغ أولاً</span>
              </button>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Analytics Modal */}
      {analyticItemId && (
        <ItemAnalyticsModal
          isOpen={true}
          selectedItemId={analyticItemId}
          onClose={() => setAnalyticItemId(null)}
        />
      )}
    </div>
  );
}
