import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Save, Plus, Trash2, CheckCircle2, RotateCcw, 
  History, Printer, Calendar, Truck, X, Edit3, Eye, Lock,
  FileDown, Loader2, Keyboard, FileText, CreditCard, BarChart3,
  ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft,
  Mic, MicOff, Sparkles, Volume2
} from 'lucide-react';
import PrintDropdown from './PrintDropdown';
import PrintPreviewModal, { PrintPreviewData } from './PrintPreviewModal';
import PartnerStatementModal from './PartnerStatementModal';
import ItemAnalyticsModal from './ItemAnalyticsModal';
import { 
  getNextSequentialNumber, 
  advanceSequenceAfterSave, 
  DB_PURCHASES_INVOICES_KEY,
  DB_ITEMS_KEY 
} from '../utils/sequences';
import { notifyDataChanged } from '../utils/localFolderBackup';
import { Partner } from '../types/accounting';
import ItemAutocomplete from './ItemAutocomplete';
import { Item } from './Items';
import { loadStoredItems } from '../utils/itemsStore';
import { useSystemCurrency } from '../utils/currency';
import { 
  loadVendors, 
  getPartnerAccountStatement, 
  calculateInvoicePartnerImpact,
  dispatchPartnerLedgerUpdated 
} from '../utils/partnerLedger';

import { 
  loadStoredPurchaseInvoices, 
  saveStoredPurchaseInvoices, 
  type StoredPurchaseInvoice 
} from '../utils/purchasesStore';
import { getSystemSettings } from '../utils/settings';
import { checkDateIsLocked } from '../utils/periodLock';
import { parseVoiceItemsFromText } from '../utils/voiceCommandParser';
export type { StoredPurchaseInvoice };

export interface InvoiceItem {
  id: string;
  itemId?: string;
  itemCode?: string;
  description: string;
  availableStock?: number;
  costPrice?: number;
  unit?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export function resolvePurchaseItemStockAndCost(item: InvoiceItem, catalog: Item[]): { stock: number; costPrice: number; unit: string; matched: boolean } {
  let matchedItem: Item | undefined;
  if (item.itemId) {
    matchedItem = catalog.find(i => i.id === item.itemId);
  }
  if (!matchedItem && item.itemCode) {
    matchedItem = catalog.find(i => i.code === item.itemCode);
  }
  if (!matchedItem && item.description) {
    const cleanDesc = item.description.trim().toLowerCase();
    matchedItem = catalog.find(i => i.name.trim().toLowerCase() === cleanDesc);
  }

  if (matchedItem) {
    return {
      stock: Number(matchedItem.stock) || 0,
      costPrice: Number(matchedItem.costPrice) || 0,
      unit: matchedItem.unit || 'حبة',
      matched: true
    };
  }

  return {
    stock: item.availableStock !== undefined ? Number(item.availableStock) : 0,
    costPrice: item.costPrice !== undefined ? Number(item.costPrice) : 0,
    unit: item.unit || 'حبة',
    matched: item.availableStock !== undefined || item.costPrice !== undefined
  };
}

function addItemsStockAndRecalculateCostOnPurchase(purchaseItems: InvoiceItem[]): Item[] {
  try {
    const raw = localStorage.getItem(DB_ITEMS_KEY);
    if (!raw) return [];
    const itemsList: Item[] = JSON.parse(raw);
    let changed = false;

    purchaseItems.forEach(pItem => {
      const pQty = Number(pItem.quantity) || 0;
      const pPrice = Number(pItem.unitPrice) || 0;
      if (pQty <= 0) return;

      const idx = itemsList.findIndex(it => 
        (pItem.itemId && it.id === pItem.itemId) ||
        (pItem.itemCode && it.code === pItem.itemCode) ||
        (pItem.description && it.name.trim().toLowerCase() === pItem.description.trim().toLowerCase())
      );

      if (idx !== -1) {
        const it = itemsList[idx];
        if (it) {
          const oldStock = Number(it.stock) || 0;
          const oldCost = Number(it.costPrice) || 0;
          const newStock = oldStock + pQty;
          
          // Weighted Average Cost formula (م.س.ت)
          const newCostPrice = newStock > 0 
            ? ((oldStock * oldCost) + (pQty * pPrice)) / newStock 
            : pPrice;

          itemsList[idx] = {
            ...it,
            stock: newStock,
            costPrice: Math.round(newCostPrice * 100) / 100
          };
          changed = true;
        }
      }
    });

    if (changed) {
      localStorage.setItem(DB_ITEMS_KEY, JSON.stringify(itemsList));
      notifyDataChanged();
      return itemsList;
    }
  } catch (err) {
    console.error('Failed to update stock and cost on purchase:', err);
  }
  return [];
}

function deductItemsStockOnPurchaseUnpost(purchaseItems: InvoiceItem[]): Item[] {
  try {
    const raw = localStorage.getItem(DB_ITEMS_KEY);
    if (!raw) return [];
    const itemsList: Item[] = JSON.parse(raw);
    let changed = false;

    purchaseItems.forEach(pItem => {
      const pQty = Number(pItem.quantity) || 0;
      if (pQty <= 0) return;

      const idx = itemsList.findIndex(it => 
        (pItem.itemId && it.id === pItem.itemId) ||
        (pItem.itemCode && it.code === pItem.itemCode) ||
        (pItem.description && it.name.trim().toLowerCase() === pItem.description.trim().toLowerCase())
      );

      if (idx !== -1) {
        const it = itemsList[idx];
        if (it) {
          const currentStock = Number(it.stock) || 0;
          itemsList[idx] = {
            ...it,
            stock: Math.max(0, currentStock - pQty)
          };
          changed = true;
        }
      }
    });

    if (changed) {
      localStorage.setItem(DB_ITEMS_KEY, JSON.stringify(itemsList));
      return itemsList;
    }
  } catch (err) {
    console.error('Failed to reverse stock on purchase unpost:', err);
  }
  return [];
}

function getInvoiceTypeName(type: string): string {
  switch(type) {
    case 'CASH_PURCHASE': return 'مشتريات نقدية';
    case 'CREDIT_PURCHASE': return 'مشتريات آجلة';
    case 'PARTIAL_PURCHASE': return 'مشتريات جزئية';
    case 'CASH_RETURN': return 'مرتجع مشتريات نقدي';
    case 'CREDIT_RETURN': return 'مرتجع مشتريات آجل';
    case 'PURCHASE_ORDER': return 'أمر شراء (PO)';
    case 'INVENTORY_SURPLUS': return 'زيادة جرد مخزن';
    case 'INVENTORY_DEFICIT': return 'عجز جرد مخزن';
    case 'OPENING_BALANCE': return 'رصيد أول المدة';
    default: return type;
  }
}

export default function Purchases() {
  const { symbol: currencySymbol, fullNameAr: currencyFullNameAr, tafqeet } = useSystemCurrency();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [savedInvoices, setSavedInvoices] = useState<StoredPurchaseInvoice[]>([]);
  const [vendors, setVendors] = useState<Partner[]>([]);
  const [itemsCatalog, setItemsCatalog] = useState<Item[]>([]);
  const [selectedPartnerForStatementModal, setSelectedPartnerForStatementModal] = useState<Partner | null>(null);

  // Voice Dictation for Purchase Items
  const [isDictatingItems, setIsDictatingItems] = useState<boolean>(false);
  const [dictationTranscript, setDictationTranscript] = useState<string>('');
  const dictationRecognitionRef = useRef<any>(null);

  const startItemsDictation = () => {
    if (!isEditable) {
      showToast({
        type: 'warning',
        title: 'تعديل الفاتورة مطلوب',
        message: 'اضغط على زر [تعديل الفاتورة] بالأعلى للتمكن من إملاء أصناف المشتريات بالصوت.'
      });
      return;
    }
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast({
        type: 'error',
        title: 'المتصفح لا يدعم التعرف الصوتي',
        message: 'يمكنك كتابة أسماء وأكواد الأصناف في الجدول مباشرة.'
      });
      return;
    }

    try {
      if (dictationRecognitionRef.current) {
        try { dictationRecognitionRef.current.stop(); } catch {}
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsDictatingItems(true);
        setDictationTranscript('');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setDictationTranscript(final || interim);
        if (final) {
          const parsed = parseVoiceItemsFromText(final, itemsCatalog);
          if (parsed && parsed.length > 0) {
            setItems(prev => {
              const cleanPrev = prev.filter(p => (p.description && p.description.trim()) || (p.itemId));
              const newItemsMapped = parsed.map((p, idx) => ({
                id: 'item-' + Date.now() + '-' + idx,
                itemId: p.item?.id,
                itemCode: p.item?.code || '',
                description: p.name || p.item?.name || '',
                quantity: p.quantity || 1,
                unitPrice: p.unitPrice !== undefined ? p.unitPrice : (p.item?.costPrice || p.item?.salePrice || 0),
                taxRate: classification === 'TAX' ? taxRate : 0,
                availableStock: p.item?.stock || 0,
                costPrice: p.item?.costPrice || 0
              }));
              return [...cleanPrev, ...newItemsMapped];
            });
            showToast({
              type: 'success',
              title: `🎙️ تم إدراج ${parsed.length} صنف/أصناف شراء بالصوت بنجاح!`,
              message: parsed.map(p => `${p.name} (كمية: ${p.quantity})`).join(' ، ')
            });
          } else {
            showToast({
              type: 'info',
              title: 'لم يتم التعرف على بنود محددة',
              message: `النص الملتقط: "${final}". يمكنك نطق: "10 كراتين زيت بسعر 85"`
            });
          }
        }
      };

      recognition.onerror = () => {
        setIsDictatingItems(false);
      };

      recognition.onend = () => {
        setIsDictatingItems(false);
      };

      dictationRecognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsDictatingItems(false);
    }
  };

  const stopItemsDictation = () => {
    if (dictationRecognitionRef.current) {
      try { dictationRecognitionRef.current.stop(); } catch {}
    }
    setIsDictatingItems(false);
  };

  // Initial non-blocking load: deferred to render view immediately without UI lag
  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      try {
        const storedInvs = loadStoredPurchaseInvoices();
        const storedVendors = loadVendors();
        const storedItems = loadStoredItems();

        if (isMounted) {
          setSavedInvoices(storedInvs);
          setVendors(storedVendors);
          setItemsCatalog(storedItems);
          const nextSeq = getNextSequentialNumber('purchaseInvoice', storedInvs.map(i => i.invoiceNumber)).formatted;
          setInvoiceNumber(nextSeq);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to initialize purchase data:', err);
        if (isMounted) setIsLoading(false);
      }
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const handleSync = () => {
      try {
        setVendors(loadVendors());
        setSavedInvoices(loadStoredPurchaseInvoices());
        setItemsCatalog(loadStoredItems());
        setAnalyticItemId(null);
      } catch (err) {
        console.error(err);
      }
    };
    window.addEventListener('alpha-partner-ledger-updated', handleSync);
    window.addEventListener('alpha-system-reset-completed', handleSync);
    window.addEventListener('alpha-purchases-invoices-updated', handleSync);
    window.addEventListener('alpha-items-updated', handleSync);
    window.addEventListener('alpha-device-id-changed', handleSync);
    window.addEventListener('alpha-sequences-updated', handleSync);
    window.addEventListener('storage', handleSync);

    const handleCreateVoicePurchase = (e: any) => {
      const payload = e.detail;
      handleNewInvoice();
      if (payload?.partner?.id) {
        setPartnerId(payload.partner.id);
      } else if (payload?.partnerId) {
        setPartnerId(payload.partnerId);
      }
      if (payload?.items && Array.isArray(payload.items) && payload.items.length > 0) {
        const mappedItems = payload.items.map((it: any, index: number) => ({
          id: 'item-' + Date.now() + '-' + index,
          itemId: it.item?.id,
          itemCode: it.item?.code || '',
          description: it.name || it.item?.name || '',
          quantity: it.quantity || 1,
          unitPrice: it.unitPrice || it.item?.costPrice || it.item?.salePrice || 0,
          taxRate: 15,
          availableStock: it.item?.stock || 0,
          costPrice: it.item?.costPrice || 0
        }));
        setItems(mappedItems);
      }
      showToast({
        type: 'success',
        title: 'تم تجهيز مسودة فاتورة مشتريات بالصوت',
        message: payload?.partner?.name ? `المورد المحدد: ${payload.partner.name}` : 'جاهزة لإضافة الأصناف الموردة'
      });
    };

    const handleHighlightPurchase = (e: any) => {
      const invoice = e.detail?.invoice;
      if (invoice) {
        handleEditInvoice(invoice);
        showToast({
          type: 'info',
          title: `تم فتح فاتورة المشتريات #${invoice.invoiceNumber}`
        });
      }
    };

    window.addEventListener('alpha-voice-create-purchase-invoice', handleCreateVoicePurchase);
    window.addEventListener('alpha-highlight-purchase-invoice', handleHighlightPurchase);

    return () => {
      window.removeEventListener('alpha-partner-ledger-updated', handleSync);
      window.removeEventListener('alpha-system-reset-completed', handleSync);
      window.removeEventListener('alpha-purchases-invoices-updated', handleSync);
      window.removeEventListener('alpha-items-updated', handleSync);
      window.removeEventListener('alpha-device-id-changed', handleSync);
      window.removeEventListener('alpha-sequences-updated', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('alpha-voice-create-purchase-invoice', handleCreateVoicePurchase);
      window.removeEventListener('alpha-highlight-purchase-invoice', handleHighlightPurchase);
    };
  }, []);

  // Derive next sequential purchase invoice number based on stored invoices
  const nextCalculatedInvoiceNum = useMemo(() => {
    return getNextSequentialNumber('purchaseInvoice', savedInvoices.map(i => i.invoiceNumber)).formatted;
  }, [savedInvoices]);

  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [supplierRef, setSupplierRef] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0] as string);
  const [dueDate, setDueDate] = useState<string>('');
  const [partnerId, setPartnerId] = useState<string>('');
  const [status, setStatus] = useState<'DRAFT' | 'POSTED'>('DRAFT');
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const isEditable = status !== 'POSTED' && isEditMode;
  const [showInvoicesHistory, setShowInvoicesHistory] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [customPreviewData, setCustomPreviewData] = useState<PrintPreviewData | null>(null);
  const [analyticItemId, setAnalyticItemId] = useState<string | null>(null);

  // In-App Toast & Confirmation Modal States
  const [toast, setToast] = useState<{ id: number; type: 'success' | 'error' | 'warning' | 'info'; title: string; message?: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; invoiceId?: string | null | undefined; invoiceNumber: string; isNewDraft?: boolean } | null>(null);

  const showToast = (t: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message?: string }) => {
    const toastId = Date.now();
    setToast({ id: toastId, ...t });
    setTimeout(() => {
      setToast(prev => (prev?.id === toastId ? null : prev));
    }, 4000);
  };
  
  // Classification and categorization (initialized with system default settings)
  const systemSettings = getSystemSettings();
  const defaultInvoiceSettings = systemSettings.invoiceDefaults || {};
  const defaultSysTaxRate = systemSettings.taxAndInvoice?.defaultVatRate !== undefined ? systemSettings.taxAndInvoice.defaultVatRate : 15;
  const [classification, setClassification] = useState<'NORMAL' | 'TAX'>((defaultInvoiceSettings.purchasesClassification as 'NORMAL' | 'TAX') || 'TAX');
  const [taxRate, setTaxRate] = useState<number>(defaultSysTaxRate);
  const [discount, setDiscount] = useState<number>(0);
  const [invoiceType, setInvoiceType] = useState<string>(defaultInvoiceSettings.purchasesTransactionType || 'CREDIT_PURCHASE');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [source, setSource] = useState<string>(defaultInvoiceSettings.purchasesWarehouse || 'MAIN_WAREHOUSE');
  const [safe, setSafe] = useState<string>(defaultInvoiceSettings.purchasesSafe || 'MAIN_SAFE');
  const [notes, setNotes] = useState<string>('');
  
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: 'item-' + Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: defaultSysTaxRate, availableStock: 0, costPrice: 0 }
  ]);

  const selectedPartner = useMemo(() => {
    return vendors.find(v => v.id === partnerId || v.name === partnerId);
  }, [vendors, partnerId]);

  // Live account statement for selected vendor
  const selectedPartnerStatement = useMemo(() => {
    if (!selectedPartner) return null;
    return getPartnerAccountStatement(selectedPartner);
  }, [selectedPartner, savedInvoices]);

  const handleStartEditInvoice = () => {
    if (status === 'POSTED') {
      alert('⚠️ الفاتورة مرحلة حالياً ومقفلة بالكامل.\n\nيجب الضغط على زر [إلغاء الترحيل] أولاً لإعادة فتح الفاتورة، ثم الضغط على زر [تعديل الفاتورة] للبدء بالتعديل.');
      return;
    }
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
  };

  const handleNewInvoice = (customList?: StoredPurchaseInvoice[] | unknown) => {
    const currSettings = getSystemSettings();
    const currentDefaults = currSettings.invoiceDefaults || {};
    const sysTax = currSettings.taxAndInvoice?.defaultVatRate !== undefined ? currSettings.taxAndInvoice.defaultVatRate : 15;
    setEditingInvoiceId(null);
    const invoiceList = Array.isArray(customList) ? customList : savedInvoices;
    const nextSeq = getNextSequentialNumber('purchaseInvoice', invoiceList.map(i => i.invoiceNumber)).formatted;
    setInvoiceNumber(nextSeq);
    setSupplierRef('');
    setStatus('DRAFT');
    setIsEditMode(true);
    setPartnerId('');
    setDueDate('');
    setNotes('');
    setClassification((currentDefaults.purchasesClassification as 'NORMAL' | 'TAX') || 'TAX');
    setTaxRate(sysTax);
    setDiscount(0);
    setInvoiceType(currentDefaults.purchasesTransactionType || 'CREDIT_PURCHASE');
    setSource(currentDefaults.purchasesWarehouse || 'MAIN_WAREHOUSE');
    setSafe(currentDefaults.purchasesSafe || 'MAIN_SAFE');
    setPaidAmount(0);
    setItems([{ id: 'item-' + Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: sysTax, availableStock: 0, costPrice: 0 }]);
    setItemsCatalog(loadStoredItems());
  };

  const handleEditInvoice = (inv: StoredPurchaseInvoice) => {
    setEditingInvoiceId(inv.id);
    setInvoiceNumber(inv.invoiceNumber);
    setSupplierRef(inv.supplierRef || '');
    setDate(inv.date);
    setDueDate(inv.dueDate || '');
    setPartnerId(inv.partnerId);
    setClassification(inv.classification);
    const resolvedTaxRate = inv.taxRate !== undefined ? inv.taxRate : (inv.items?.[0]?.taxRate ?? 15);
    setTaxRate(resolvedTaxRate);
    setDiscount(Number(inv.totals?.discountTotal ?? (inv as unknown as { discountTotal?: number }).discountTotal ?? 0));
    setInvoiceType(inv.invoiceType);
    setSource(inv.source);
    setSafe(inv.safe);
    setNotes(inv.notes || '');
    setStatus(inv.status);
    setIsEditMode(false); // starts in safe view-only mode
    const initialPaid = inv.totals?.cashPaid !== undefined 
      ? inv.totals.cashPaid 
      : (inv.invoiceType === 'CASH_PURCHASE' ? inv.totals.grandTotal : 0);
    setPaidAmount(initialPaid);
    setItems(inv.items.length > 0 ? inv.items : [{ id: 'item-' + Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: resolvedTaxRate, availableStock: 0, costPrice: 0 }]);
    setItemsCatalog(loadStoredItems());
    setShowInvoicesHistory(false);
  };

  // Chronologically sorted list of invoices (oldest to newest) for sequential ERP browsing
  const chronologicallyOrderedInvoices = useMemo(() => {
    if (!Array.isArray(savedInvoices)) return [];
    return [...savedInvoices].sort((a, b) => {
      const dateCmp = (a.date || '').localeCompare(b.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.invoiceNumber || '').localeCompare(b.invoiceNumber || '', undefined, { numeric: true });
    });
  }, [savedInvoices]);

  const currentInvoiceIndex = useMemo(() => {
    if (!editingInvoiceId) return -1;
    return chronologicallyOrderedInvoices.findIndex(inv => inv.id === editingInvoiceId);
  }, [editingInvoiceId, chronologicallyOrderedInvoices]);

  const handleNavigatePrevious = () => {
    if (chronologicallyOrderedInvoices.length === 0) return;
    if (currentInvoiceIndex === -1) {
      // From new draft, go to latest saved invoice
      const target = chronologicallyOrderedInvoices[chronologicallyOrderedInvoices.length - 1];
      if (target) handleEditInvoice(target);
    } else if (currentInvoiceIndex > 0) {
      const target = chronologicallyOrderedInvoices[currentInvoiceIndex - 1];
      if (target) handleEditInvoice(target);
    }
  };

  const handleNavigateNext = () => {
    if (chronologicallyOrderedInvoices.length === 0) return;
    if (currentInvoiceIndex >= 0 && currentInvoiceIndex < chronologicallyOrderedInvoices.length - 1) {
      const target = chronologicallyOrderedInvoices[currentInvoiceIndex + 1];
      if (target) handleEditInvoice(target);
    } else if (currentInvoiceIndex === chronologicallyOrderedInvoices.length - 1) {
      handleNewInvoice();
    }
  };

  const handleNavigateFirst = () => {
    if (chronologicallyOrderedInvoices.length > 0) {
      const first = chronologicallyOrderedInvoices[0];
      if (first) handleEditInvoice(first);
    }
  };

  const handleNavigateLast = () => {
    if (chronologicallyOrderedInvoices.length > 0) {
      const last = chronologicallyOrderedInvoices[chronologicallyOrderedInvoices.length - 1];
      if (last) handleEditInvoice(last);
    }
  };

  const canGoPrevious = chronologicallyOrderedInvoices.length > 0 && (currentInvoiceIndex === -1 || currentInvoiceIndex > 0);
  const canGoNext = chronologicallyOrderedInvoices.length > 0 && currentInvoiceIndex !== -1;
  const canGoFirst = chronologicallyOrderedInvoices.length > 0 && currentInvoiceIndex !== 0;
  const canGoLast = chronologicallyOrderedInvoices.length > 0 && (currentInvoiceIndex === -1 || currentInvoiceIndex < chronologicallyOrderedInvoices.length - 1);

  const handleAddItem = () => {
    if (!isEditable) {
      if (status === 'POSTED') {
        alert('🔒 الفاتورة مرحلة ومقفلة!\n\nلا يمكن إضافة أي صنف إلا بعد إلغاء الترحيل أولاً ثم الضغط على زر [تعديل الفاتورة].');
      } else {
        alert('⚠️ الفاتورة في وضع المعاينة الآمنة.\n\nاضغط على زر [تعديل الفاتورة] بالأعلى للتمكن من إضافة أصناف جديدة.');
      }
      return;
    }
    const newItemId = 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    setItems(prev => [
      ...prev,
      {
        id: newItemId,
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxRate: classification === 'TAX' ? taxRate : 0,
        availableStock: 0,
        costPrice: 0
      }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (status === 'POSTED') {
      alert('🔒 الفاتورة مرحلة ومقفلة!\n\nلا يمكن حذف أي صنف إلا بعد إلغاء الترحيل أولاً ثم تعديل الفاتورة.');
      return;
    }
    if (!isEditMode) {
      setIsEditMode(true);
    }
    setItems(prev => {
      if (prev.length <= 1) {
        // Reset the single item row to empty state
        return [{
          id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          description: '',
          quantity: 1,
          unitPrice: 0,
          taxRate: classification === 'TAX' ? taxRate : 0,
          availableStock: 0,
          costPrice: 0
        }];
      }
      return prev.filter(item => item.id !== id);
    });
  };

  const handleUpdateItem = (id: string, updates: Partial<InvoiceItem>) => {
    if (!isEditable) return;
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleItemChange = (id: string, field: keyof InvoiceItem, value: string | number) => {
    if (!isEditable) return;
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    items.forEach(item => {
      const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      const taxRate = classification === 'TAX' ? (Number(item.taxRate) || 0) : 0;
      const lineTax = lineTotal * (taxRate / 100);
      subtotal += lineTotal;
      taxTotal += lineTax;
    });
    const discountTotal = Math.max(0, Number(discount) || 0);
    const grandTotal = Math.max(0, (subtotal + taxTotal) - discountTotal);
    const cleanPaid = Math.max(0, Math.min(grandTotal, Number(paidAmount) || 0));
    const remainingBalance = Math.max(0, grandTotal - cleanPaid);

    return { 
      subtotal, 
      taxTotal, 
      discountTotal,
      grandTotal,
      cashPaid: cleanPaid,
      remainingBalance
    };
  }, [items, classification, discount, paidAmount]);

  // Handler when user edits paid amount
  const handlePaidAmountChange = (val: number) => {
    const safeVal = Math.max(0, Number(val) || 0);
    setPaidAmount(safeVal);

    if (totals.grandTotal > 0) {
      if (safeVal >= totals.grandTotal - 0.001) {
        setInvoiceType('CASH_PURCHASE');
      } else if (safeVal > 0.001) {
        setInvoiceType('PARTIAL_PURCHASE');
      } else {
        setInvoiceType('CREDIT_PURCHASE');
      }
    }
  };

  // Handler when user selects invoiceType manually from dropdown
  const handleInvoiceTypeChange = (typeVal: string) => {
    setInvoiceType(typeVal);
    if (typeVal === 'CASH_PURCHASE' || typeVal === 'CASH_RETURN') {
      setPaidAmount(totals.grandTotal);
    } else if (typeVal === 'CREDIT_PURCHASE' || typeVal === 'CREDIT_RETURN' || typeVal === 'PURCHASE_ORDER') {
      setPaidAmount(0);
    } else if (typeVal === 'PARTIAL_PURCHASE' || typeVal === 'PARTIAL_RETURN') {
      if (paidAmount <= 0 || paidAmount >= totals.grandTotal) {
        setPaidAmount(Number((totals.grandTotal * 0.5).toFixed(2)));
      }
    }
  };

  // Accurate balance impact before and after invoice
  const partnerBalanceImpact = useMemo(() => {
    if (!selectedPartner) return null;
    return calculateInvoicePartnerImpact(
      selectedPartner,
      totals.grandTotal,
      paidAmount,
      invoiceNumber || undefined,
      'VENDOR',
      selectedPartnerStatement,
      invoiceType?.includes('RETURN') || false
    );
  }, [selectedPartner, totals.grandTotal, paidAmount, invoiceNumber, selectedPartnerStatement, invoiceType]);

  const currentInvoicePreviewData: PrintPreviewData = useMemo(() => ({
    title: classification === 'TAX' ? 'فاتورة مشتريات ضريبية' : 'فاتورة مشتريات عامة',
    subtitle: status === 'POSTED' ? 'فاتورة شراء مرحلة ومستلمة بالمستودع' : 'مسودة فاتورة توريد قيد التدقيق',
    docNumber: invoiceNumber,
    date: date,
    dueDate: dueDate,
    partnerName: selectedPartner?.name || 'مورد نقدي',
    partnerTaxNo: selectedPartner?.taxNumber,
    partnerPhone: selectedPartner?.phone,
    partnerAddress: (selectedPartner as { address?: string })?.address,
    partnerType: 'VENDOR',
    classification: classification,
    taxRate: classification === 'TAX' ? taxRate : 0,
    paymentMethod: getInvoiceTypeName(invoiceType),
    items: items.map(it => ({
      description: it.description || 'صنف مشتريات',
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      taxRate: it.taxRate,
      taxAmount: classification === 'TAX' ? (it.quantity * it.unitPrice * (it.taxRate / 100)) : 0,
      total: (it.quantity * it.unitPrice) * (1 + (classification === 'TAX' ? (it.taxRate / 100) : 0))
    })),
    subtotal: totals.subtotal,
    taxTotal: totals.taxTotal,
    discountTotal: totals.discountTotal,
    grandTotal: totals.grandTotal,
    paidAmount: paidAmount,
    remainingBalance: Math.max(0, totals.grandTotal - paidAmount),
    paymentStatus: paidAmount >= totals.grandTotal - 0.001 && totals.grandTotal > 0 ? 'PAID' : paidAmount > 0.001 ? 'PARTIAL' : 'UNPAID',
    notes: notes,
    partnerBalanceImpact: partnerBalanceImpact
  }), [classification, status, invoiceNumber, date, dueDate, selectedPartner, invoiceType, items, totals, paidAmount, notes, partnerBalanceImpact]);

  const handleExportPdf = () => {
    setCustomPreviewData(null);
    setShowPrintPreview(true);
  };

  const saveInvoiceToDb = (isPosting: boolean) => {
    if (!partnerId) {
      alert("يرجى اختيار المورد أولاً");
      return false;
    }

    // Check fiscal period lock
    const lockCheck = checkDateIsLocked(date);
    if (lockCheck.isLocked) {
      alert(`🔒 تنبيه رقابي - الفترة المالية مقفلة ومحمية:\n${lockCheck.reason}`);
      return false;
    }

    const finalNumber = invoiceNumber.trim() || nextCalculatedInvoiceNum;
    
    // Check duplication
    if (!editingInvoiceId) {
      const isDuplicate = savedInvoices.some(i => i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === finalNumber.toLowerCase());
      if (isDuplicate) {
        alert(`⚠️ رقم فاتورة المشتريات (${finalNumber}) مستخدم مسبقاً! تم اقتراح الرقم التسلسلي التالي (#${nextCalculatedInvoiceNum}).`);
        setInvoiceNumber(nextCalculatedInvoiceNum);
        return false;
      }
    } else {
      const isDuplicate = savedInvoices.some(i => i.id !== editingInvoiceId && i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === finalNumber.toLowerCase());
      if (isDuplicate) {
        alert(`⚠️ رقم فاتورة المشتريات (${finalNumber}) مستخدم مسبقاً في فاتورة أخرى!`);
        return false;
      }
    }

    const newId = editingInvoiceId || 'pinv-' + Date.now();
    setEditingInvoiceId(newId);
    const partnerObj = vendors.find(p => p.id === partnerId);
    const invoiceRecord: StoredPurchaseInvoice = {
      id: newId,
      invoiceNumber: finalNumber,
      supplierRef: supplierRef.trim(),
      date,
      dueDate,
      partnerId,
      partnerName: partnerObj?.name || 'مورد عام',
      classification,
      taxRate: classification === 'TAX' ? taxRate : 0,
      invoiceType,
      source,
      safe,
      items,
      totals,
      status: isPosting ? 'POSTED' : 'DRAFT',
      notes,
      createdAt: new Date().toISOString()
    };

    let updatedInvoices: StoredPurchaseInvoice[];
    if (editingInvoiceId) {
      updatedInvoices = savedInvoices.map(inv => inv.id === editingInvoiceId ? invoiceRecord : inv);
    } else {
      updatedInvoices = [
        invoiceRecord,
        ...savedInvoices.filter(i => i.invoiceNumber.trim().toLowerCase() !== finalNumber.toLowerCase())
      ];
      advanceSequenceAfterSave('purchaseInvoice', finalNumber);
    }

    setSavedInvoices(updatedInvoices);
    try {
      localStorage.setItem(DB_PURCHASES_INVOICES_KEY, JSON.stringify(updatedInvoices));
      notifyDataChanged();
      dispatchPartnerLedgerUpdated();
    } catch (err) {
      console.error(err);
    }

    return true;
  };

  const handleSaveDraft = () => {
    if (saveInvoiceToDb(false)) {
      setStatus('DRAFT');
      setIsEditMode(false);
      alert(`تم حفظ فاتورة المشتريات رقم (${invoiceNumber}) كمسودة بنجاح!`);
    }
  };

  const handlePost = () => {
    if (saveInvoiceToDb(true)) {
      setStatus('POSTED');
      setIsEditMode(false);
      const updatedList = addItemsStockAndRecalculateCostOnPurchase(items);
      if (updatedList.length > 0) {
        setItemsCatalog(updatedList);
      }
      alert(`تم ترحيل فاتورة المشتريات رقم (${invoiceNumber}) بنجاح وتحديث حسابات الموردين وإضافة الكميات وتحديث متوسط سعر التكلفة (م.س.ت)!`);
    }
  };

  const handleUnpost = () => {
    if (status !== 'POSTED') return;
    setStatus('DRAFT');
    setIsEditMode(false);
    const revertedList = deductItemsStockOnPurchaseUnpost(items);
    if (revertedList.length > 0) {
      setItemsCatalog(revertedList);
    }
    
    const finalNumber = invoiceNumber.trim();
    const updatedInvoices = savedInvoices.map(inv => {
      if ((editingInvoiceId && inv.id === editingInvoiceId) || inv.invoiceNumber === finalNumber) {
        return { ...inv, status: 'DRAFT' as const };
      }
      return inv;
    });
    setSavedInvoices(updatedInvoices);
    try {
      localStorage.setItem(DB_PURCHASES_INVOICES_KEY, JSON.stringify(updatedInvoices));
      notifyDataChanged();
      dispatchPartnerLedgerUpdated();
    } catch (err) {
      console.error(err);
    }

    alert('تم إلغاء ترحيل فاتورة المشتريات بنجاح وإعادتها كمسودة!\n\nلتعديل الأصناف أو الأسعار أو إضافة/حذف بنود، يرجى الضغط الآن على زر [تعديل الفاتورة].');
  };

  const handleDelete = () => {
    if (status === 'POSTED') {
      showToast({
        type: 'error',
        title: '🔒 لا يمكن حذف فاتورة مشتريات مرحلة!',
        message: 'الفاتورة مرحلة ومعتمدة نظامياً ومقفلة. يجب أولاً الضغط على زر [إلغاء الترحيل] لإعادتها كمسودة قبل الحذف.'
      });
      return;
    }
    const isExisting = editingInvoiceId || savedInvoices.some(i => i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === invoiceNumber.trim().toLowerCase());
    setDeleteModal({
      isOpen: true,
      invoiceId: editingInvoiceId || undefined,
      invoiceNumber: invoiceNumber.trim() || 'المسودة الحالية',
      isNewDraft: !isExisting
    });
  };

  const confirmExecuteDelete = () => {
    if (!deleteModal) return;

    if (deleteModal.isNewDraft) {
      handleNewInvoice();
      showToast({
        type: 'info',
        title: 'تم إفراغ وإعادة ضبط المسودة',
        message: 'تم تفريغ كافة الحقول والبدء بفاتورة مشتريات جديدة فارغة.'
      });
    } else {
      const targetNumber = deleteModal.invoiceNumber;
      const targetId = deleteModal.invoiceId;
      const targetInv = savedInvoices.find(i => (targetId && i.id === targetId) || (i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === targetNumber.trim().toLowerCase()));
      if (targetInv && targetInv.status === 'POSTED') {
        showToast({
          type: 'error',
          title: '🔒 لا يمكن حذف فاتورة مرحلة!',
          message: 'فاتورة المشتريات مرحلة ومعتمدة نظامياً. يرجى إلغاء ترحيل الفاتورة أولاً لتتمكن من حذفها.'
        });
        setDeleteModal(null);
        return;
      }
      const updated = savedInvoices.filter(i => {
        if (targetId && i.id === targetId) return false;
        if (i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === targetNumber.trim().toLowerCase()) return false;
        return true;
      });
      setSavedInvoices(updated);
      saveStoredPurchaseInvoices(updated);
      if (editingInvoiceId === targetId || invoiceNumber.trim().toLowerCase() === targetNumber.trim().toLowerCase()) {
        handleNewInvoice(updated);
      }
      showToast({
        type: 'success',
        title: `تم حذف فاتورة المشتريات رقم (${targetNumber}) نهائياً بنجاح!`
      });
    }
    setDeleteModal(null);
  };

  // Global Keyboard Shortcuts (Ctrl+S, Ctrl+P, Ctrl+N, Ctrl+Enter, F2, Ctrl+H, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Ctrl + S / Cmd + S: Save Draft or Start Edit
      if (isCtrlOrCmd && key === 's') {
        e.preventDefault();
        if (status === 'POSTED') {
          alert('⚠️ الفاتورة مرحلة ومقفلة نظامياً!\n\nيجب أولاً الضغط على زر [إلغاء الترحيل]، ثم تعديل الفاتورة وحفظها.');
        } else if (isEditMode) {
          handleSaveDraft();
        } else {
          handleStartEditInvoice();
        }
        return;
      }

      // Ctrl + Enter / Cmd + Enter: Post Invoice
      if (isCtrlOrCmd && e.key === 'Enter') {
        e.preventDefault();
        if (status === 'DRAFT') {
          handlePost();
        }
        return;
      }

      // Ctrl + P / Cmd + P: Print
      if (isCtrlOrCmd && key === 'p') {
        e.preventDefault();
        if (e.shiftKey) {
          setCustomPreviewData(null);
          setShowPrintPreview(true);
        } else {
          window.print();
        }
        return;
      }

      // PageUp / Alt+Right: Previous Invoice (تراجع للخلف)
      if (e.key === 'PageUp' || (e.altKey && e.key === 'ArrowRight')) {
        e.preventDefault();
        handleNavigatePrevious();
        return;
      }

      // PageDown / Alt+Left: Next Invoice (تقديم للأمام)
      if (e.key === 'PageDown' || (e.altKey && e.key === 'ArrowLeft')) {
        e.preventDefault();
        handleNavigateNext();
        return;
      }

      // Ctrl + N / Cmd + N or Alt + N: New Invoice
      if ((isCtrlOrCmd || e.altKey) && key === 'n') {
        e.preventDefault();
        handleNewInvoice();
        return;
      }

      // F2 or Insert or Alt + I: Add Item Row
      if (e.key === 'F2' || e.key === 'Insert' || ((isCtrlOrCmd || e.altKey) && key === 'i')) {
        e.preventDefault();
        handleAddItem();
        return;
      }

      // Ctrl + H / Cmd + H or Alt + H: Toggle Invoices History
      if ((isCtrlOrCmd || e.altKey) && key === 'h') {
        e.preventDefault();
        setShowInvoicesHistory(prev => !prev);
        return;
      }

      // Esc: Close modal / drawer or cancel edit
      if (e.key === 'Escape') {
        if (showPrintPreview) {
          setShowPrintPreview(false);
          setCustomPreviewData(null);
        } else if (showInvoicesHistory) {
          setShowInvoicesHistory(false);
        } else if (editingInvoiceId && isEditMode) {
          handleCancelEdit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    status,
    isEditMode,
    editingInvoiceId,
    showPrintPreview,
    showInvoicesHistory,
    partnerId,
    invoiceNumber,
    supplierRef,
    items,
    date,
    dueDate,
    classification,
    invoiceType,
    source,
    safe,
    notes,
    totals,
    savedInvoices
  ]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[380px] w-full bg-white rounded-3xl p-8 border-2 border-slate-200 shadow-xs animate-fadeIn">
        <Loader2 size={36} className="text-emerald-600 animate-spin mb-3" />
        <h3 className="text-sm font-bold text-slate-800">جاري فتح شاشة فواتير المشتريات...</h3>
        <p className="text-xs text-slate-400 mt-1">يتم قراءة سجل الفواتير والموردين والأصناف بأمان وسلاسة</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full max-w-7xl mx-auto w-full">
      {/* Top Application Bar */}
      <div className="flex flex-col gap-3 mb-4 print:hidden">
        {/* Breadcrumb & Screen Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2 mb-1 text-emerald-900/80 text-xs font-bold">
              <span>الموردين والمشتريات</span>
              <span>/</span>
              <span className="text-emerald-950 font-extrabold">فواتير المشتريات</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-emerald-900 via-green-950 to-slate-900 bg-clip-text text-transparent">
                فاتورة المشتريات
              </h1>
              <span className={`px-2.5 py-1 text-xs font-black rounded-lg border shadow-2xs ${
                status === 'POSTED' 
                  ? 'bg-emerald-50 text-emerald-950 border-emerald-950' 
                  : isEditMode
                  ? 'bg-emerald-50 text-emerald-950 border-emerald-950'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}>
                {status === 'POSTED' ? 'مرحلة ومعتمدة' : isEditMode ? 'مسودة قيد التحرير' : 'مسودة (وضع العرض)'}
              </span>
              {editingInvoiceId && (
                <span className="px-2.5 py-1 text-xs font-black rounded-lg bg-emerald-50 text-emerald-950 border border-emerald-950 flex items-center gap-1 shadow-2xs">
                  <Edit3 size={12} className="text-emerald-800" /> تعديل #{invoiceNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Global 3D Responsive Invoice Actions Toolbar */}
        <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-2 sm:p-2.5 shadow-xs flex flex-col gap-2.5">
          
          {/* DESKTOP VIEW (hidden on mobile, visible on lg and above) */}
          <div className="hidden lg:flex flex-col gap-2.5">
            {/* Sub-row: Navigation Stepper (Right) & Print/Export (Left) */}
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-200/70">
              {/* Right: ERP Navigation Stepper */}
              <div className="flex items-center gap-2">
                <div className="nav-3d-segment">
                  <button
                    type="button"
                    onClick={handleNavigateFirst}
                    disabled={!canGoFirst}
                    className="p-1.5 text-slate-600 hover:text-emerald-950 hover:bg-slate-200/60 disabled:opacity-30 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                    title="الفاتورة الأولى (الأقدم)"
                  >
                    <ChevronsRight size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNavigatePrevious}
                    disabled={!canGoPrevious}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-black text-emerald-950 bg-white hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-200 shadow-2xs"
                    title="تراجع للخلف - الفاتورة السابقة (PageUp / Alt+Right)"
                  >
                    <ChevronRight size={14} className="text-emerald-900" />
                    <span>تراجع للخلف</span>
                  </button>

                  <div className="px-2.5 py-1 text-[11px] font-mono font-black text-emerald-950 bg-emerald-50/80 rounded-lg mx-0.5 select-none border border-emerald-200 whitespace-nowrap">
                    {currentInvoiceIndex >= 0 ? (
                      <span>{currentInvoiceIndex + 1} / {chronologicallyOrderedInvoices.length}</span>
                    ) : (
                      <span className="text-emerald-700 font-sans font-bold">مسودة جديدة +</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleNavigateNext}
                    disabled={!canGoNext}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-black text-emerald-950 bg-white hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-200 shadow-2xs"
                    title="تقديم للأمام - الفاتورة التالية (PageDown / Alt+Left)"
                  >
                    <span>تقديم للأمام</span>
                    <ChevronLeft size={14} className="text-emerald-900" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNavigateLast}
                    disabled={!canGoLast}
                    className="p-1.5 text-slate-600 hover:text-emerald-950 hover:bg-slate-200/60 disabled:opacity-30 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                    title="الفاتورة الأخيرة (الأحدث)"
                  >
                    <ChevronsLeft size={15} />
                  </button>
                </div>

                {editingInvoiceId && isEditMode && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="btn-3d btn-3d-white h-9 px-2.5 text-xs font-black text-slate-700 hover:text-slate-900"
                  >
                    <X size={14} /> <span>إلغاء التعديل</span>
                  </button>
                )}
              </div>

              {/* Left: Print & Export Group */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-3d btn-3d-slate h-9 px-2.5 sm:px-3 text-xs font-black"
                  title="طباعة سريعة مباشرة (Ctrl+P)"
                >
                  <Printer size={14} className="shrink-0" />
                  <span>طباعة مباشرة</span>
                  <kbd className="text-[9px] bg-slate-900 text-slate-300 px-1 py-0.5 rounded font-mono border border-slate-700">Ctrl+P</kbd>
                </button>

                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="btn-3d btn-3d-rose h-9 px-2.5 sm:px-3 text-xs font-black"
                  title="تصدير فاتورة المشتريات الحالية بتنسيقها المعتمد كملف PDF"
                >
                  <FileDown size={14} className="shrink-0" />
                  <span>تصدير PDF</span>
                </button>

                <PrintDropdown 
                  onPreview={() => {
                    setCustomPreviewData(null);
                    setShowPrintPreview(true);
                  }}
                />
              </div>
            </div>

            {/* Main Action Line (Desktop):
                سجل الفواتير -> إضافة فاتورة جديدة -> حفظ مسودة -> حذف -> معاينة -> ترحيل الفاتورة
            */}
            <div className="flex items-center gap-2 flex-wrap xl:flex-nowrap w-full">
              {/* 1. سجل الفواتير */}
              <button
                type="button"
                onClick={() => setShowInvoicesHistory(!showInvoicesHistory)}
                className={`btn-3d h-9 sm:h-10 px-2.5 sm:px-3 text-xs font-black ${
                  showInvoicesHistory ? 'btn-3d-active' : 'btn-3d-white'
                }`}
                title="سجل الفواتير (Ctrl+H)"
              >
                <History size={14} className={showInvoicesHistory ? 'text-emerald-300' : 'text-emerald-700'} />
                <span>سجل الفواتير ({savedInvoices.length})</span>
                <kbd className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-mono border border-slate-300">Ctrl+H</kbd>
              </button>

              {/* 2. إضافة فاتورة جديدة */}
              <button
                type="button"
                onClick={handleNewInvoice}
                className="btn-3d btn-3d-emerald h-9 sm:h-10 px-2.5 sm:px-3.5 text-xs font-black"
                title="إضافة فاتورة جديدة (Ctrl+N)"
              >
                <Plus size={15} />
                <span>إضافة فاتورة جديدة</span>
                <kbd className="text-[9px] bg-emerald-900/60 text-emerald-100 px-1 py-0.5 rounded font-mono border border-emerald-400/30">Ctrl+N</kbd>
              </button>

              {/* 3. حفظ مسودة (أو تعديل الفاتورة) */}
              {status === 'DRAFT' && (
                !isEditMode ? (
                  <button
                    type="button"
                    onClick={handleStartEditInvoice}
                    className="btn-3d btn-3d-indigo h-9 sm:h-10 px-2.5 sm:px-3.5 text-xs font-black"
                    title="تعديل الفاتورة (Ctrl+S)"
                  >
                    <Edit3 size={14} />
                    <span>تعديل الفاتورة</span>
                    <kbd className="text-[9px] bg-blue-950/60 text-blue-200 px-1 py-0.5 rounded font-mono border border-blue-500/30">Ctrl+S</kbd>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="btn-3d btn-3d-white h-9 sm:h-10 px-2.5 sm:px-3.5 text-xs font-black text-emerald-950"
                    title="حفظ مسودة (Ctrl+S)"
                  >
                    <Save size={14} className="text-emerald-700" />
                    <span>حفظ مسودة</span>
                    <kbd className="text-[9px] bg-emerald-50 text-emerald-950 px-1 py-0.5 rounded font-mono border border-emerald-200">Ctrl+S</kbd>
                  </button>
                )
              )}

              {/* 4. حذف */}
              <button
                type="button"
                onClick={handleDelete}
                disabled={status === 'POSTED'}
                className="btn-3d btn-3d-danger-soft h-9 sm:h-10 px-2.5 sm:px-3 text-xs font-black"
                title={status === 'POSTED' ? 'الفاتورة مرحلة ومقفلة نظامياً. يجب إلغاء الترحيل أولاً لحذفها' : 'حذف الفاتورة نهائياً أو إفراغ المسودة'}
              >
                <Trash2 size={14} />
                <span>حذف</span>
              </button>

              {/* 5. معاينة */}
              <button
                type="button"
                onClick={() => {
                  setCustomPreviewData(null);
                  setShowPrintPreview(true);
                  showToast({
                    type: 'info',
                    title: 'معاينة الفاتورة للطباعة',
                    message: 'يتم الآن عرض الفاتورة بالكامل لمعاينتها قبل الطباعة'
                  });
                }}
                className="btn-3d btn-3d-indigo h-9 sm:h-10 px-2.5 sm:px-3 text-xs font-black"
                title="معاينة الفاتورة قبل الطباعة"
              >
                <Eye size={14} className="shrink-0" />
                <span>معاينة</span>
              </button>

              {/* 6. ترحيل الفاتورة (أو إلغاء الترحيل) مباشرة بعد معاينة */}
              {status === 'DRAFT' ? (
                <button
                  type="button"
                  onClick={handlePost}
                  className="btn-3d btn-3d-emerald h-9 sm:h-10 px-3 sm:px-4 text-xs font-black"
                  title="ترحيل الفاتورة (Ctrl+Enter)"
                >
                  <CheckCircle2 size={15} />
                  <span>ترحيل الفاتورة</span>
                  <kbd className="text-[9px] bg-emerald-900/60 text-emerald-100 px-1 py-0.5 rounded font-mono border border-emerald-400/30">Ctrl+↵</kbd>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleUnpost}
                  className="btn-3d btn-3d-amber h-9 sm:h-10 px-3 sm:px-4 text-xs font-black"
                  title="إلغاء ترحيل الفاتورة وإعادتها لمسودة"
                >
                  <RotateCcw size={14} />
                  <span>إلغاء الترحيل</span>
                </button>
              )}
            </div>
          </div>

          {/* MOBILE VIEW (< lg): Flex wrapped for smaller screens */}
          <div className="flex lg:hidden flex-col gap-3">
            {/* Cluster 1: Sequential ERP Navigation & History */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 w-full">
              <div className="nav-3d-segment">
                <button
                  type="button"
                  onClick={handleNavigateFirst}
                  disabled={!canGoFirst}
                  className="p-1.5 text-slate-600 hover:text-emerald-950 hover:bg-slate-200/60 disabled:opacity-30 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title="الفاتورة الأولى (الأقدم)"
                >
                  <ChevronsRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleNavigatePrevious}
                  disabled={!canGoPrevious}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-black text-emerald-950 bg-white hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-200 shadow-2xs"
                  title="تراجع للخلف - الفاتورة السابقة"
                >
                  <ChevronRight size={14} className="text-emerald-900" />
                  <span>السابق</span>
                </button>

                <div className="px-2 py-1 text-[11px] font-mono font-black text-emerald-950 bg-emerald-50/80 rounded-lg mx-0.5 select-none border border-emerald-200 whitespace-nowrap">
                  {currentInvoiceIndex >= 0 ? (
                    <span>{currentInvoiceIndex + 1} / {chronologicallyOrderedInvoices.length}</span>
                  ) : (
                    <span className="text-emerald-700 font-sans font-bold">مسودة جديدة +</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleNavigateNext}
                  disabled={!canGoNext}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-black text-emerald-950 bg-white hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-200 shadow-2xs"
                  title="تقديم للأمام - الفاتورة التالية"
                >
                  <span>التالي</span>
                  <ChevronLeft size={14} className="text-emerald-900" />
                </button>
                <button
                  type="button"
                  onClick={handleNavigateLast}
                  disabled={!canGoLast}
                  className="p-1.5 text-slate-600 hover:text-emerald-950 hover:bg-slate-200/60 disabled:opacity-30 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title="الفاتورة الأخيرة"
                >
                  <ChevronsLeft size={15} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowInvoicesHistory(!showInvoicesHistory)}
                className={`btn-3d h-9 px-2.5 text-xs font-black ${
                  showInvoicesHistory ? 'btn-3d-active' : 'btn-3d-white'
                }`}
                title="سجل الفواتير (Ctrl+H)"
              >
                <History size={14} className={showInvoicesHistory ? 'text-emerald-300' : 'text-emerald-700'} />
                <span>سجل الفواتير ({savedInvoices.length})</span>
              </button>

              {editingInvoiceId && isEditMode && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="btn-3d btn-3d-white h-9 px-2.5 text-xs font-black text-slate-700"
                >
                  <X size={14} /> <span>إلغاء</span>
                </button>
              )}
            </div>

            {/* Cluster 2: Actions on Mobile */}
            <div className="flex flex-wrap items-center justify-center gap-2 w-full">
              <button
                type="button"
                onClick={handleNewInvoice}
                className="btn-3d btn-3d-emerald h-9 px-3 text-xs font-black"
              >
                <Plus size={15} />
                <span>فاتورة جديدة</span>
              </button>

              {status === 'DRAFT' ? (
                <>
                  {!isEditMode ? (
                    <button
                      type="button"
                      onClick={handleStartEditInvoice}
                      className="btn-3d btn-3d-indigo h-9 px-3 text-xs font-black"
                    >
                      <Edit3 size={14} />
                      <span>تعديل</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      className="btn-3d btn-3d-white h-9 px-3 text-xs font-black text-emerald-950"
                    >
                      <Save size={14} className="text-emerald-700" />
                      <span>حفظ مسودة</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handlePost}
                    className="btn-3d btn-3d-emerald h-9 px-3 text-xs font-black"
                  >
                    <CheckCircle2 size={15} />
                    <span>ترحيل الفاتورة</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleUnpost}
                  className="btn-3d btn-3d-amber h-9 px-3 text-xs font-black"
                >
                  <RotateCcw size={14} />
                  <span>إلغاء الترحيل</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDelete}
                disabled={status === 'POSTED'}
                className="btn-3d btn-3d-danger-soft h-9 px-2.5 text-xs font-black"
              >
                <Trash2 size={14} />
                <span>حذف</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCustomPreviewData(null);
                  setShowPrintPreview(true);
                }}
                className="btn-3d btn-3d-indigo h-9 px-2.5 text-xs font-black"
              >
                <Eye size={14} />
                <span>معاينة</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="btn-3d btn-3d-slate h-9 px-2.5 text-xs font-black"
              >
                <Printer size={14} />
                <span>طباعة</span>
              </button>

              <button
                type="button"
                onClick={handleExportPdf}
                className="btn-3d btn-3d-rose h-9 px-2.5 text-xs font-black"
              >
                <FileDown size={14} />
                <span>PDF</span>
              </button>

              <PrintDropdown 
                onPreview={() => {
                  setCustomPreviewData(null);
                  setShowPrintPreview(true);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Keyboard Shortcuts Helper Bar */}
      <div className="hidden lg:flex items-center justify-between gap-2 px-3.5 py-1.5 mb-4 bg-slate-100/80 border border-slate-200/80 rounded-xl text-[11px] text-slate-600 print:hidden">
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
          <Keyboard size={13} className="text-slate-500" />
          <span>اختصارات لوحة المفاتيح:</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="bg-white border border-slate-300 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold text-slate-800 shadow-2xs">Ctrl+S</kbd>
            <span>حفظ / تعديل</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-white border border-slate-300 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold text-slate-800 shadow-2xs">Ctrl+Enter</kbd>
            <span>ترحيل الفاتورة</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-white border border-slate-300 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold text-slate-800 shadow-2xs">Ctrl+P</kbd>
            <span>طباعة</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-white border border-slate-300 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold text-slate-800 shadow-2xs">Ctrl+N</kbd>
            <span>فاتورة جديدة</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-white border border-slate-300 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold text-slate-800 shadow-2xs">F2</kbd>
            <span>إضافة صنف</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-white border border-slate-300 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold text-slate-800 shadow-2xs">Ctrl+H</kbd>
            <span>السجل</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-white border border-slate-300 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold text-slate-800 shadow-2xs">Esc</kbd>
            <span>إغلاق / إلغاء</span>
          </span>
        </div>
      </div>

      {/* History Drawer */}
      {showInvoicesHistory && (
        <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm animate-fadeIn print:hidden">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <History size={16} className="text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">سجل فواتير المشتريات المسجلة</h3>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">{savedInvoices.length} فواتير</span>
            </div>
            <button 
              type="button" 
              onClick={() => setShowInvoicesHistory(false)}
              className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              إغلاق
            </button>
          </div>

          {savedInvoices.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">لا توجد فواتير مشتريات سابقة محفوظة بعد. الفاتورة القادمة ستبدأ برقم #{nextCalculatedInvoiceNum}.</p>
          ) : (
            <div className="overflow-x-auto max-h-60">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400">
                    <th className="pb-2 font-semibold">رقم الفاتورة</th>
                    <th className="pb-2 font-semibold">مرجع المورد</th>
                    <th className="pb-2 font-semibold">المورد</th>
                    <th className="pb-2 font-semibold">التاريخ</th>
                    <th className="pb-2 font-semibold">النوع</th>
                    <th className="pb-2 font-semibold">الإجمالي</th>
                    <th className="pb-2 font-semibold">الحالة</th>
                    <th className="pb-2 font-semibold text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {savedInvoices.map(inv => (
                    <tr key={inv.id} className={`hover:bg-slate-50 transition-colors ${editingInvoiceId === inv.id ? 'bg-rose-50/50' : ''}`}>
                      <td className="py-2.5 font-mono font-bold text-rose-600">#{inv.invoiceNumber}</td>
                      <td className="py-2.5 text-slate-500 font-mono">{inv.supplierRef || '-'}</td>
                      <td className="py-2.5 text-slate-800 font-medium">{inv.partnerName}</td>
                      <td className="py-2.5 text-slate-500 font-mono">{inv.date}</td>
                      <td className="py-2.5 text-slate-600">{getInvoiceTypeName(inv.invoiceType)}</td>
                      <td className="py-2.5 font-mono font-bold text-slate-900">{inv.totals.grandTotal.toLocaleString()} {currencySymbol}</td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.status === 'POSTED' 
                            ? 'bg-emerald-50 text-emerald-950 border border-emerald-900' 
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {inv.status === 'POSTED' ? 'مرحلة' : 'مسودة'}
                        </span>
                      </td>
                      <td className="py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setCustomPreviewData({
                                title: inv.classification === 'TAX' ? 'فاتورة مشتريات ضريبية' : 'فاتورة مشتريات عادية',
                                docNumber: inv.invoiceNumber,
                                date: inv.date,
                                dueDate: inv.dueDate,
                                partnerName: inv.partnerName,
                                partnerType: 'VENDOR',
                                classification: inv.classification,
                                items: inv.items.map(it => ({
                                  description: it.description || 'بند توريد ومشتريات',
                                  quantity: it.quantity,
                                  unitPrice: it.unitPrice,
                                  taxRate: it.taxRate,
                                  total: (it.quantity * it.unitPrice) * (1 + (inv.classification === 'TAX' ? (it.taxRate / 100) : 0))
                                })),
                                subtotal: inv.totals.subtotal,
                                taxTotal: inv.totals.taxTotal,
                                grandTotal: inv.totals.grandTotal,
                                notes: inv.notes,
                                paymentMethod: getInvoiceTypeName(inv.invoiceType)
                              });
                              setShowPrintPreview(true);
                            }}
                            className="flex items-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                            title="معاينة فاتورة المشتريات قبل الطباعة"
                          >
                            <Eye size={12} /> معاينة
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditInvoice(inv)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            disabled={inv.status === 'POSTED'}
                            onClick={() => {
                              if (inv.status === 'POSTED') {
                                showToast({
                                  type: 'error',
                                  title: '🔒 لا يمكن حذف فاتورة مشتريات مرحلة!',
                                  message: `فاتورة المشتريات رقم #${inv.invoiceNumber} مرحلة ومعتمدة نظامياً. يرجى فتح الفاتورة وإلغاء الترحيل أولاً لحذفها.`
                                });
                                return;
                              }
                              setDeleteModal({
                                isOpen: true,
                                invoiceId: inv.id,
                                invoiceNumber: inv.invoiceNumber,
                                isNewDraft: false
                              });
                            }}
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              inv.status === 'POSTED'
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50 border border-slate-200'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer'
                            }`}
                            title={inv.status === 'POSTED' ? 'فاتورة المشتريات مرحلة ومقفلة. يجب إلغاء الترحيل أولاً لحذفها' : 'حذف الفاتورة'}
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Main Invoice Card - Deep Very Dark Green Border */}
      <div className={`bg-white rounded-3xl shadow-sm border-2 ${
        status === 'POSTED' ? 'border-slate-800' : 'border-emerald-950'
      } overflow-hidden flex flex-col flex-1 print:border-none print:shadow-none`}>
        
        {/* Invoice Status & Locking Notice Banner */}
        {status === 'POSTED' ? (
          <div className="bg-amber-50 border-b-2 border-amber-300 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 print:hidden">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-amber-200/80 text-amber-950 font-black border border-amber-400">🔒 الفاتورة مرحلة ومقفلة نظامياً</span>
              <span className="font-bold">
                لا يمكن إضافة أي صنف إلى الفاتورة أو حذف أي صنف أو التعديل إلا بإلغاء الترحيل أولاً ثم الضغط على زر تعديل الفاتورة.
              </span>
            </div>
            <button
              type="button"
              onClick={handleUnpost}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer border border-amber-800"
            >
              <RotateCcw size={13} />
              <span>إلغاء الترحيل الآن</span>
            </button>
          </div>
        ) : !isEditMode ? (
          <div className="bg-slate-100 border-b-2 border-slate-700 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-900 print:hidden">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-slate-200 text-slate-950 font-black border border-slate-400">👁️ وضع المعاينة الآمنة (مسودة)</span>
              <span className="font-bold">
                الفاتورة مقفلة حالياً ضد التعديلات غير المقصودة. لتعديل الأسعار أو إضافة/حذف أصناف اضغط زر التعديل.
              </span>
            </div>
            <button
              type="button"
              onClick={handleStartEditInvoice}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer border border-slate-950"
            >
              <Edit3 size={13} />
              <span>تعديل الفاتورة</span>
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50 border-b-2 border-emerald-950 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-950 print:hidden">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-emerald-100 text-emerald-950 font-black border border-emerald-950">✏️ وضع التعديل نشط</span>
              <span className="font-bold">
                يمكنك الآن إضافة أو حذف وتعديل الأصناف والأسعار في الفاتورة بحرية.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-3 py-1.5 bg-white border border-emerald-950 text-emerald-950 hover:bg-emerald-100 rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-2xs"
              >
                حفظ التعديلات
              </button>
            </div>
          </div>
        )}

        {/* Print Header (Visible Only on Print) */}
        <div className="hidden print:block p-8 border-b-2 border-slate-800">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">شركة لوجوستريا للتجارة والمقاولات</h1>
              <p className="text-xs text-slate-500">المملكة العربية السعودية - الرياض</p>
              <p className="text-xs text-slate-500 font-mono">الرقم الضريبي: 300000000000003</p>
            </div>
            <div className="text-left">
              <h2 className="text-xl font-bold text-slate-900">
                {classification === 'TAX' ? 'فاتورة مشتريات ضريبية' : 'فاتورة مشتريات'}
              </h2>
              <p className="text-sm font-bold font-mono text-slate-900 mt-1">رقم الفاتورة: #{invoiceNumber}</p>
              {supplierRef && <p className="text-xs text-slate-500 font-mono">مرجع المورد: {supplierRef}</p>}
              <p className="text-xs text-slate-500 font-mono">تاريخ الإصدار: {date}</p>
            </div>
          </div>
        </div>

        {/* Modern Settings / Control Strip - Colorized & Very Dark Green Styled Boxes */}
        <div className="bg-slate-100/90 border-b-2 border-slate-700 p-4 sm:p-5 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 text-xs">
            {/* Invoice Number (Sequential & Read-Only) */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-emerald-950 shadow-2xs space-y-1.5 ring-2 ring-emerald-950/10">
              <div className="flex items-center justify-between">
                <label className="text-emerald-950 font-black text-[11px] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-900 inline-block"></span>
                  رقم الفاتورة
                </label>
                <span className="text-[10px] text-emerald-950 font-mono bg-emerald-50 border border-emerald-950 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1">
                  <Lock size={10} className="text-emerald-900" />
                  <span>تلقائي</span>
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleNavigatePrevious}
                  disabled={!canGoPrevious}
                  className="p-1.5 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 border border-emerald-950 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  title="تراجع للخلف (السابق)"
                >
                  <ChevronRight size={14} />
                </button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={invoiceNumber}
                    className="w-full bg-gradient-to-r from-slate-900 to-emerald-950 border border-emerald-950 py-1.5 px-6 rounded-xl font-mono font-black text-amber-300 text-center select-all focus:outline-none cursor-not-allowed shadow-inner text-xs"
                    title="رقم الفاتورة يتولد تسلسلياً تلقائياً من النظام ومحمي من التعديل"
                  />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-400 font-mono font-bold text-xs">
                    #
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleNavigateNext}
                  disabled={!canGoNext}
                  className="p-1.5 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 border border-emerald-950 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  title="تقديم للأمام (التالي)"
                >
                  <ChevronLeft size={14} />
                </button>
              </div>
            </div>

            {/* Classification */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-emerald-950 shadow-2xs space-y-1.5 ring-2 ring-emerald-950/10">
              <label className="text-emerald-950 font-black text-[11px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-900 inline-block"></span>
                تصنيف الفاتورة
              </label>
              <select
                disabled={!isEditable}
                value={classification}
                onChange={e => {
                  const newClass = e.target.value as 'NORMAL' | 'TAX';
                  setClassification(newClass);
                  if (newClass === 'TAX') {
                    const rate = taxRate || 15;
                    setItems(prev => prev.map(it => ({ ...it, taxRate: rate })));
                  } else {
                    setItems(prev => prev.map(it => ({ ...it, taxRate: 0 })));
                  }
                }}
                className="w-full bg-emerald-50/40 border-2 border-emerald-950 p-1.5 rounded-xl text-emerald-950 font-bold focus:outline-none focus:border-emerald-900 focus:ring-1 focus:ring-emerald-900 disabled:bg-slate-100 disabled:border-slate-300"
              >
                <option value="TAX">فاتورة ضريبية</option>
                <option value="NORMAL">فاتورة عادية</option>
              </select>
            </div>

            {/* Tax Rate Percentage Field */}
            {classification === 'TAX' && (
              <div className="bg-white p-2.5 rounded-2xl border-2 border-emerald-950 shadow-2xs space-y-1.5 ring-2 ring-emerald-950/10">
                <label className="text-emerald-950 font-black text-[11px] flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-900 inline-block"></span>
                    النسبة الضريبية
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    disabled={!isEditable}
                    value={taxRate}
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                      setTaxRate(val);
                      setItems(prev => prev.map(it => ({ ...it, taxRate: val })));
                    }}
                    className="w-full bg-emerald-50/40 border-2 border-emerald-950 p-1.5 pr-3 pl-7 rounded-xl text-emerald-950 font-bold font-mono focus:outline-none focus:border-emerald-900 focus:ring-1 focus:ring-emerald-900 disabled:bg-slate-100 disabled:border-slate-300 text-center"
                    placeholder="15"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-emerald-900 pointer-events-none">%</span>
                </div>
              </div>
            )}

            {/* Invoice Type */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-emerald-950 shadow-2xs space-y-1.5 ring-2 ring-emerald-950/10">
              <label className="text-emerald-950 font-black text-[11px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-900 inline-block"></span>
                نوع المعاملة
              </label>
              <select
                disabled={!isEditable}
                value={invoiceType}
                onChange={e => handleInvoiceTypeChange(e.target.value)}
                className="w-full bg-emerald-50/40 border-2 border-emerald-950 p-1.5 rounded-xl text-emerald-950 font-bold focus:outline-none focus:border-emerald-900 focus:ring-1 focus:ring-emerald-900 disabled:bg-slate-100 disabled:border-slate-300"
              >
                <option value="CASH_PURCHASE">مشتريات نقدية</option>
                <option value="CREDIT_PURCHASE">مشتريات آجلة</option>
                <option value="PARTIAL_PURCHASE">مشتريات جزئية</option>
                <option value="CASH_RETURN">مرتجع مشتريات نقدي</option>
                <option value="CREDIT_RETURN">مرتجع مشتريات آجل</option>
                <option value="PURCHASE_ORDER">أمر شراء (PO)</option>
                <option value="INVENTORY_SURPLUS">زيادة جرد مخزن</option>
                <option value="INVENTORY_DEFICIT">عجز جرد مخزن</option>
                <option value="OPENING_BALANCE">رصيد أول المدة</option>
              </select>
            </div>

            {/* Source / Warehouse Destination */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-emerald-950 shadow-2xs space-y-1.5 ring-2 ring-emerald-950/10">
              <label className="text-emerald-950 font-black text-[11px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-900 inline-block"></span>
                وجهة المخزون
              </label>
              <select
                disabled={!isEditable}
                value={source}
                onChange={e => setSource(e.target.value)}
                className="w-full bg-emerald-50/40 border-2 border-emerald-950 p-1.5 rounded-xl text-emerald-950 font-bold focus:outline-none focus:border-emerald-900 focus:ring-1 focus:ring-emerald-900 disabled:bg-slate-100 disabled:border-slate-300"
              >
                <option value="MAIN_WAREHOUSE">المستودع الرئيسي</option>
                <option value="SHOWROOM">معرض المبيعات</option>
                <option value="BRANCH_1">فرع الرياض</option>
              </select>
            </div>

            {/* Safe / Cashbox */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-emerald-950 shadow-2xs space-y-1.5 ring-2 ring-emerald-950/10">
              <label className="text-emerald-950 font-black text-[11px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-900 inline-block"></span>
                خزنة الدفع والسداد
              </label>
              <select
                disabled={!isEditable}
                value={safe}
                onChange={e => setSafe(e.target.value)}
                className="w-full bg-emerald-50/40 border-2 border-emerald-950 p-1.5 rounded-xl text-emerald-950 font-bold focus:outline-none focus:border-emerald-900 focus:ring-1 focus:ring-emerald-900 disabled:bg-slate-100 disabled:border-slate-300"
              >
                <option value="MAIN_SAFE">الصندوق الرئيسي (كاش)</option>
                <option value="BANK_AHLI">حساب البنك الأهلي</option>
                <option value="BANK_RAJHI">حساب بنك الراجحي</option>
              </select>
            </div>
          </div>
        </div>

        {/* Vendor & Dates Section - Bordered Boxes in Very Dark Green */}
        <div className="p-5 sm:p-6 border-b-2 border-slate-700 grid grid-cols-1 md:grid-cols-12 gap-5 bg-slate-50/40">
          {/* Vendor Selection Card */}
          <div className="md:col-span-7 bg-white rounded-2xl border-2 border-emerald-950 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-950 via-green-950 to-slate-950 text-white px-4 py-2.5 border-b-2 border-emerald-900 flex items-center justify-between">
              <span className="text-xs font-black text-white flex items-center gap-2">
                <span className="p-1 rounded-lg bg-emerald-900 text-emerald-200 shadow-2xs border border-emerald-800">
                  <Truck size={14} />
                </span>
                <span>بيانات المورد (البائع)</span>
              </span>
              {selectedPartner?.taxNumber && (
                <span className="text-[11px] font-mono font-bold text-emerald-200 bg-emerald-900/60 px-2 py-0.5 rounded-lg border border-emerald-700 shadow-2xs">
                  ضريبي: {selectedPartner.taxNumber}
                </span>
              )}
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-extrabold text-emerald-950 mb-1 block">اسم المورد المسجل بالحساب:</label>
                  <select
                    disabled={!isEditable}
                    required
                    value={partnerId}
                    onChange={e => setPartnerId(e.target.value)}
                    className="w-full bg-white border-2 border-emerald-950 p-2.5 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-900 focus:ring-1 focus:ring-emerald-900 disabled:bg-slate-100 disabled:border-slate-300"
                  >
                    <option value="">-- حدد المورد من القائمة --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} {v.phone ? `(${v.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-xs text-slate-800 bg-emerald-50/50 p-2 rounded-xl border border-emerald-900 flex items-center justify-between">
                  <span className="text-emerald-950 font-bold">رقم فاتورة المورد:</span>
                  <input
                    type="text"
                    disabled={!isEditable}
                    value={supplierRef}
                    onChange={e => setSupplierRef(e.target.value)}
                    placeholder="مثال: INV-9821"
                    className="font-mono font-bold text-slate-900 text-left outline-none border-b-2 border-emerald-950 focus:border-emerald-900 bg-white px-1.5 py-0.5 rounded w-28 disabled:cursor-not-allowed"
                    dir="ltr"
                  />
                </div>

                <div className="text-xs text-slate-800 bg-emerald-50/50 p-2 rounded-xl border border-emerald-900 flex items-center justify-between">
                  <span className="text-emerald-950 font-bold">الرصيد الفعلي الحالي:</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-mono font-black ${
                      selectedPartnerStatement?.balanceType === 'CREDIT' 
                        ? 'text-emerald-900' 
                        : selectedPartnerStatement?.balanceType === 'DEBIT' 
                        ? 'text-emerald-950' 
                        : 'text-slate-600'
                    }`}>
                      {selectedPartnerStatement?.balanceFormatted || '0.00'} {currencySymbol}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">({selectedPartnerStatement?.balanceLabel || 'متزن'})</span>
                  </div>
                </div>

                {selectedPartner && (
                  <div className="sm:col-span-2 flex items-center justify-between bg-emerald-50/70 p-2 rounded-xl border border-emerald-900 text-xs">
                    <div className="flex items-center gap-2 text-emerald-950">
                      <Truck size={13} className="text-emerald-900" />
                      <span className="font-bold">كشف حساب المورد والعمليات السابقة:</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPartnerForStatementModal(selectedPartner)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-950 rounded-lg font-bold border border-emerald-950 text-[11px] transition-colors cursor-pointer shadow-2xs"
                      title="عرض كشف حساب المورد التفصيلي وحركات الفواتير والسندات"
                    >
                      <FileText size={13} className="text-emerald-900" />
                      <span>فتح كشف الحساب</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dates & Reference Card */}
          <div className="md:col-span-5 bg-white rounded-2xl border-2 border-emerald-950 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-950 via-green-950 to-slate-950 text-white px-4 py-2.5 border-b-2 border-emerald-900 flex items-center justify-between">
              <span className="text-xs font-black text-white flex items-center gap-2">
                <span className="p-1 rounded-lg bg-emerald-900 text-emerald-200 shadow-2xs border border-emerald-800">
                  <Calendar size={14} />
                </span>
                <span>تاريخ الفاتورة والاستحقاق</span>
              </span>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-emerald-950 font-bold text-[11px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-900"></span>
                    تاريخ الشراء / التوريد
                  </label>
                  <input
                    type="date"
                    disabled={!isEditable}
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-white border-2 border-emerald-950 p-2 rounded-xl text-slate-900 font-mono font-bold focus:outline-none focus:border-emerald-900 focus:ring-1 focus:ring-emerald-900 disabled:bg-slate-100 disabled:border-slate-300"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-emerald-950 font-bold text-[11px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-900"></span>
                    تاريخ الاستحقاق
                  </label>
                  <input
                    type="date"
                    disabled={!isEditable}
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full bg-white border-2 border-emerald-950 p-2 rounded-xl text-slate-900 font-mono font-bold focus:outline-none focus:border-emerald-900 focus:ring-1 focus:ring-emerald-900 disabled:bg-slate-100 disabled:border-slate-300"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Items Matrix Table - Winter Grid System in Green/Emerald */}
        <div className="overflow-x-auto min-h-[220px] border-b-2 border-slate-700 bg-white">
          <table className="w-full text-right border-collapse min-w-[820px]">
            <thead>
              <tr className="bg-slate-900 border-y-2 border-slate-800 text-[11px] font-bold text-slate-100 uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center border-l border-slate-700 bg-slate-950 text-slate-300">#</th>
                <th className="py-3 px-4 border-l border-slate-700 min-w-[200px] text-emerald-300">الصنف / المادة المشتراة</th>
                <th className="py-3 px-3 w-28 text-center border-l border-slate-700 bg-slate-850 text-teal-300 print:hidden" title="الكمية المتوفرة حالياً في المخزن">
                  الكمية بالمخزن
                </th>
                <th className="py-3 px-3 w-28 text-left border-l border-slate-700 bg-slate-850 text-emerald-300 print:hidden" title="متوسط سعر التكلفة المرجح الحالي للصنف بالمخزن">
                  (م.س.ت) الحالي
                </th>
                <th className="py-3 px-3 w-24 text-center border-l border-slate-700 text-white">الكمية</th>
                <th className="py-3 px-3 w-28 text-left border-l border-slate-700 text-teal-300">سعر الشراء</th>
                {classification === 'TAX' && (
                  <th className="py-3 px-3 w-20 text-center border-l border-slate-700 text-emerald-300">الضريبة %</th>
                )}
                <th className="py-3 px-4 w-32 text-left border-l border-slate-700 text-emerald-400">الإجمالي ({currencySymbol})</th>
                <th className="py-3 px-3 w-14 text-center print:hidden border-l border-slate-700 text-rose-300">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 text-xs">
              {items.map((item, index) => {
                const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                const itemInfo = resolvePurchaseItemStockAndCost(item, itemsCatalog);
                const unitPurchasePrice = Number(item.unitPrice) || 0;
                const costDiff = unitPurchasePrice - itemInfo.costPrice;

                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-300">
                    <td className="py-3 px-3 text-center text-slate-800 font-mono font-black border-l border-slate-300 bg-slate-100">
                      #{index + 1}
                    </td>
                    <td className="py-2 px-3 border-l border-slate-300">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 border-2 border-slate-400 hover:border-slate-600 focus-within:border-slate-900 focus-within:ring-1 focus-within:ring-slate-900 rounded-xl px-2 py-0.5 bg-white transition-colors shadow-2xs">
                          <ItemAutocomplete
                            value={item.description}
                            disabled={!isEditable}
                            mode="PURCHASE"
                            itemsList={itemsCatalog}
                            onChange={val => handleItemChange(item.id, 'description', val)}
                            onSelectItem={(selectedItem: Item) => {
                              const purchasePrice = selectedItem.costPrice || 0;
                              handleUpdateItem(item.id, {
                                itemId: selectedItem.id,
                                itemCode: selectedItem.code,
                                description: selectedItem.name,
                                availableStock: selectedItem.stock ?? 0,
                                costPrice: selectedItem.costPrice ?? 0,
                                unit: selectedItem.unit || 'حبة',
                                unitPrice: purchasePrice > 0 ? purchasePrice : (Number(item.unitPrice) || 0),
                                ...(classification === 'TAX' && selectedItem.taxRate !== undefined ? { taxRate: selectedItem.taxRate } : {})
                              });
                            }}
                            placeholder="ابحث بالحرف أو الكود عن الصنف أو المادة..."
                          />
                        </div>
                        {itemInfo.matched && (
                          <button
                            type="button"
                            onClick={() => {
                              const targetId = item.itemId || itemsCatalog.find(i => i.code === item.itemCode || i.name.trim().toLowerCase() === (item.description || '').trim().toLowerCase())?.id;
                              if (targetId) setAnalyticItemId(targetId);
                            }}
                            className="p-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 transition-all shrink-0 print:hidden flex items-center justify-center cursor-pointer shadow-2xs"
                            title="تحليل أسعار التوريد، التكلفة، ومعدلات السحب والربحية"
                          >
                            <BarChart3 size={13} />
                          </button>
                        )}
                        {/* Delete button beside the item input */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className={`p-1.5 rounded-xl border transition-all cursor-pointer shadow-2xs flex-shrink-0 flex items-center justify-center ${
                            isEditable
                              ? 'text-rose-600 hover:text-white hover:bg-rose-600 bg-rose-50 border-rose-300'
                              : 'text-slate-300 bg-slate-100 border-slate-300 cursor-not-allowed opacity-50'
                          }`}
                          title={isEditable ? `حذف الصنف #${index + 1}` : 'الفاتورة مقفلة. ألغِ الترحيل ثم اضغط تعديل الفاتورة لحذف الصنف'}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>

                    {/* الكمية في المخزون (Stock Quantity) */}
                    <td className="py-2 px-3 text-center border-l border-slate-300 bg-slate-100/60 print:hidden">
                      {itemInfo.matched ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-xs font-bold border ${
                          itemInfo.stock <= 0
                            ? 'bg-rose-50 text-rose-800 border-rose-400'
                            : itemInfo.stock <= 5
                            ? 'bg-amber-50 text-amber-800 border-amber-400'
                            : 'bg-emerald-50 text-emerald-950 border-emerald-950'
                        }`}>
                          <span>{itemInfo.stock.toLocaleString()}</span>
                          <span className="text-[10px] font-bold text-slate-600">{itemInfo.unit}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono font-bold">-</span>
                      )}
                    </td>

                    {/* متوسط سعر التكلفة الحالي (م.س.ت) (Current Cost Price) */}
                    <td className="py-2 px-3 text-left border-l border-slate-300 bg-slate-100/60 print:hidden" dir="ltr">
                      {itemInfo.matched ? (
                        <div className="flex flex-col items-start justify-center">
                          <span className="font-mono text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-400 shadow-2xs">
                            {itemInfo.costPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          {unitPurchasePrice > 0 && itemInfo.costPrice > 0 && (
                            <span className={`text-[9px] font-bold mt-0.5 whitespace-nowrap ${
                              costDiff > 0 ? 'text-amber-800' : costDiff < 0 ? 'text-emerald-800' : 'text-slate-600'
                            }`}>
                              {costDiff > 0 ? `+${costDiff.toFixed(1)} ${currencySymbol}` : costDiff < 0 ? `${costDiff.toFixed(1)} ${currencySymbol}` : 'مطابق'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono font-bold">-</span>
                      )}
                    </td>

                    <td className="py-2 px-3 text-center border-l border-slate-300">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        disabled={!isEditable}
                        value={item.quantity}
                        onChange={e => handleItemChange(item.id, 'quantity', e.target.value)}
                        className="w-full bg-white p-1.5 rounded-xl border-2 border-slate-500 text-center font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-100 disabled:border-slate-300"
                      />
                    </td>
                    <td className="py-2 px-3 text-left border-l border-slate-300">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={!isEditable}
                        value={item.unitPrice || ''}
                        onChange={e => handleItemChange(item.id, 'unitPrice', e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-white p-1.5 rounded-xl border-2 border-slate-500 text-left font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dir-ltr disabled:bg-slate-100 disabled:border-slate-300"
                      />
                    </td>
                    {classification === 'TAX' && (
                      <td className="py-2 px-3 text-center border-l border-slate-300">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          disabled={!isEditable}
                          value={item.taxRate}
                          onChange={e => handleItemChange(item.id, 'taxRate', Number(e.target.value))}
                          className="w-full bg-white p-1.5 rounded-xl border-2 border-slate-500 font-mono text-center font-bold text-slate-900 focus:outline-none focus:border-slate-900 disabled:bg-slate-100 disabled:border-slate-300"
                        />
                      </td>
                    )}
                    <td className="py-2 px-4 text-left font-mono font-black text-slate-950 text-sm border-l border-slate-300 bg-slate-50/70">
                      {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-center print:hidden border-l border-slate-300">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className={`p-1.5 rounded-xl border transition-all shadow-2xs group flex items-center justify-center mx-auto ${
                          isEditable 
                            ? 'text-rose-600 hover:text-white hover:bg-rose-600 active:bg-rose-700 bg-rose-50 border-rose-300 cursor-pointer' 
                            : 'text-slate-300 bg-slate-100 border-slate-300 cursor-not-allowed opacity-50'
                        }`}
                        title={
                          isEditable 
                            ? `حذف الصنف #${index + 1} (${item.description || 'فارغ'})` 
                            : 'الفاتورة مقفلة ضد التعديل والحذف. اضغط [تعديل الفاتورة] أو [إلغاء الترحيل] أولاً.'
                        }
                      >
                        {isEditable ? (
                          <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
                        ) : (
                          <Lock size={13} className="text-slate-400" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add Item Action Bar - Very Dark Green Styled */}
        <div className="p-4 border-t-2 border-slate-700 bg-emerald-50/40 print:hidden flex flex-wrap items-center justify-between gap-3">
          {isEditable ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-900 to-slate-950 hover:from-emerald-950 hover:to-slate-900 active:from-slate-950 active:to-emerald-950 text-white rounded-xl text-xs font-black transition-all shadow-xs hover:shadow cursor-pointer border border-emerald-950"
                  title="إضافة صنف مشتريات جديد (F2 أو Insert)"
                >
                  <Plus size={16} />
                  <span>إضافة صنف مشتريات جديد</span>
                  <kbd className="text-[10px] bg-emerald-950 text-emerald-100 px-1.5 py-0.5 rounded font-mono border border-emerald-900">F2</kbd>
                </button>

                {/* Smart Voice Dictation for Purchase Items */}
                <button
                  type="button"
                  onClick={isDictatingItems ? stopItemsDictation : startItemsDictation}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-xs hover:shadow cursor-pointer border ${
                    isDictatingItems
                      ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-800 animate-pulse'
                      : 'bg-emerald-800 hover:bg-emerald-900 text-white border-emerald-950'
                  }`}
                  title="إملاء أصناف المشتريات والكميات بالصوت (مثال: 10 كراتين زيت بسعر 85)"
                >
                  {isDictatingItems ? (
                    <>
                      <MicOff size={16} className="animate-spin text-rose-200" />
                      <span>إيقاف الإملاء الصوتي</span>
                      <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                    </>
                  ) : (
                    <>
                      <Mic size={16} className="text-emerald-200" />
                      <span>إملاء أصناف الشراء بالصوت</span>
                      <Sparkles size={14} className="text-amber-300" />
                    </>
                  )}
                </button>
              </div>

              {isDictatingItems && (
                <div className="flex-1 min-w-[200px] max-w-md bg-white border border-rose-300 rounded-xl px-3 py-1.5 flex items-center gap-2 animate-fadeIn">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0"></span>
                  <span className="text-xs text-slate-700 font-bold truncate">
                    {dictationTranscript ? `جاري السماع: "${dictationTranscript}"` : 'تحدث الآن بإملاء أصناف المشتريات والكميات وأسعار التوريد...'}
                  </span>
                </div>
              )}

              <span className="text-xs text-emerald-950 font-black bg-white px-3.5 py-1.5 rounded-xl border-2 border-emerald-950 shadow-2xs">
                عدد الأصناف: <strong className="text-emerald-900 font-mono text-sm">{items.length}</strong>
              </span>
            </>
          ) : (
            <div className="w-full flex items-center justify-between text-xs text-slate-700 py-1 font-bold">
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-emerald-800" />
                <span>
                  {status === 'POSTED' 
                    ? 'الأصناف مقفلة لأن الفاتورة مرحلة. لإضافة أو حذف أو تعديل الأصناف اضغط على [إلغاء الترحيل] بالأعلى.' 
                    : 'الأصناف في وضع العرض الآمن. اضغط على [تعديل الفاتورة] بالأعلى للبدء بالتعديل أو الحذف.'}
                </span>
              </div>
              {status === 'POSTED' ? (
                <button
                  type="button"
                  onClick={handleUnpost}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer border border-amber-800"
                >
                  إلغاء الترحيل للتحرير
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartEditInvoice}
                  className="px-3 py-1 bg-emerald-900 hover:bg-emerald-950 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer border border-emerald-950"
                >
                  تعديل الفاتورة الآن
                </button>
              )}
            </div>
          )}
        </div>

        {/* Summary & Totals Footer - Winter Charcoal & Emerald Styling */}
        <div className="p-5 sm:p-6 border-t-2 border-slate-700 bg-slate-100/70 grid grid-cols-1 md:grid-cols-12 gap-6 items-start mt-auto">
          {/* Notes Section - Defined Winter Box */}
          <div className="md:col-span-7 space-y-2">
            <label className="text-xs font-black text-emerald-950 block">ملاحظات الفاتورة والتسليم والمخزن:</label>
            <textarea
              disabled={!isEditable}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="اكتب هنا أي ملاحظات بخصوص الشحنة أو بوالص الشحن أو شروط السداد للمورد..."
              className="w-full bg-white border-2 border-emerald-950 rounded-2xl p-3 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-900 focus:ring-1 focus:ring-emerald-900 min-h-[95px] resize-none disabled:bg-slate-100 disabled:border-slate-300 shadow-2xs"
            />
          </div>

          {/* Calculations Matrix Card - Deep Winter Dark Box with Emerald Accents */}
          <div className="md:col-span-5 bg-slate-900 text-white p-5 rounded-2xl border-2 border-emerald-950 shadow-lg space-y-3">
            <div className="flex justify-between items-center text-xs text-slate-300">
              <span className="font-bold">المجموع الخاضع للضريبة:</span>
              <span className="font-mono font-black text-white text-sm">
                {totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
              </span>
            </div>

            {classification === 'TAX' && (
              <div className="flex justify-between items-center text-xs text-slate-300">
                <span className="font-bold">ضريبة القيمة المضافة (VAT {taxRate}%):</span>
                <span className="font-mono font-black text-emerald-300 text-sm">
                  {totals.taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                </span>
              </div>
            )}

            {/* الخصم المكتسب من المورد */}
            <div className="flex justify-between items-center text-xs text-slate-300 pt-1">
              <span className="font-bold text-emerald-300">الخصم المكتسب (من المورد):</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={!isEditable}
                  value={discount === 0 ? '' : discount}
                  onChange={e => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0.00"
                  className="w-24 text-right bg-slate-800 border border-emerald-500/60 rounded-lg px-2 py-1 text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:border-emerald-400 disabled:opacity-50"
                />
                <span className="text-[10px] font-bold text-emerald-400">{currencySymbol}</span>
              </div>
            </div>

            <div className="border-t-2 border-slate-700 pt-3.5 flex justify-between items-center">
              <span className="text-sm font-black text-white">إجمالي فاتورة الشراء المستحقة:</span>
              <div className="text-left">
                <span className="text-xl sm:text-2xl font-mono font-black text-emerald-400 block">
                  {totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-emerald-300/80 font-extrabold uppercase tracking-wider">{currencyFullNameAr}</span>
              </div>
            </div>

            {/* المبلغ كتابة بالحروف (تفقيط المبلغ الإجمالي) - أسفل خانة صافي المبلغ الإجمالي */}
            <div className="bg-slate-800/90 rounded-xl p-2.5 border border-emerald-900 text-xs">
              <span className="text-[10px] text-emerald-300 font-bold block mb-1">المبلغ كتابة بالحروف:</span>
              <p className="font-bold text-amber-300 leading-relaxed font-sans text-xs">
                {tafqeet(totals.grandTotal)}
              </p>
            </div>

            {/* خانة السداد ومبلغ الدفع وتحديد نوع الفاتورة */}
            <div className="pt-3 border-t-2 border-slate-700/90 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <CreditCard size={14} className="text-emerald-400" />
                  <span>المبلغ المسدد للمورد (السداد النقدي):</span>
                </span>
                <div className="flex flex-wrap items-center gap-1 w-full sm:w-auto">
                  <button
                    type="button"
                    disabled={!isEditable}
                    onClick={() => handlePaidAmountChange(totals.grandTotal)}
                    className="flex-1 sm:flex-none px-2 py-0.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 rounded text-[10px] font-bold border border-emerald-900 disabled:opacity-50 transition-colors"
                  >
                    100% نقدي
                  </button>
                  <button
                    type="button"
                    disabled={!isEditable}
                    onClick={() => handlePaidAmountChange(Number((totals.grandTotal * 0.5).toFixed(2)))}
                    className="flex-1 sm:flex-none px-2 py-0.5 bg-amber-950/80 hover:bg-amber-900 text-amber-300 rounded text-[10px] font-bold border border-amber-700/60 disabled:opacity-50 transition-colors"
                  >
                    50% جزئي
                  </button>
                  <button
                    type="button"
                    disabled={!isEditable}
                    onClick={() => handlePaidAmountChange(0)}
                    className="flex-1 sm:flex-none px-2 py-0.5 bg-teal-950/80 hover:bg-teal-900 text-teal-300 rounded text-[10px] font-bold border border-emerald-900 disabled:opacity-50 transition-colors"
                  >
                    آجل (0)
                  </button>
                </div>
              </div>

              {/* Input for Paid Amount */}
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={totals.grandTotal}
                  disabled={!isEditable}
                  value={paidAmount === 0 ? '0' : paidAmount}
                  onChange={e => handlePaidAmountChange(parseFloat(e.target.value) || 0)}
                  placeholder="أدخل المبلغ المسدد..."
                  className="w-full bg-slate-800/90 border-2 border-emerald-950 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 rounded-xl px-3 py-2 text-base font-mono font-black text-amber-300 disabled:bg-slate-900/80 disabled:border-slate-700 disabled:text-slate-400 transition-all text-left"
                />
                <span className="absolute right-3 top-2.5 text-xs text-emerald-300/80 font-bold pointer-events-none">
                  {currencySymbol} مسدد
                </span>
              </div>

              {/* Dynamic Status / Type Badge & Remaining Amount */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700 flex flex-col justify-center">
                  <span className="text-[10px] text-slate-400 font-bold">نوع الفاتورة التلقائي:</span>
                  <span className={`text-xs font-black mt-0.5 ${
                    paidAmount >= totals.grandTotal - 0.001 && totals.grandTotal > 0
                      ? 'text-emerald-400'
                      : paidAmount > 0.001
                      ? 'text-amber-400'
                      : 'text-teal-400'
                  }`}>
                    {paidAmount >= totals.grandTotal - 0.001 && totals.grandTotal > 0
                      ? '🟢 مشتريات نقدية (مسددة)'
                      : paidAmount > 0.001
                      ? '🟡 مشتريات جزئية (سداد جزء)'
                      : '🔵 مشتريات آجلة (غير مسددة)'}
                  </span>
                </div>

                <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700 flex flex-col justify-center">
                  <span className="text-[10px] text-slate-400 font-bold">المتبقي للمورد:</span>
                  <span className={`text-xs font-mono font-black mt-0.5 ${
                    totals.remainingBalance > 0.001 ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {totals.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                  </span>
                </div>
              </div>
            </div>

            {/* موقف الحساب بعد الفاتورة - أسفل صافي القيمة الإجمالية والسداد */}
            {selectedPartner && partnerBalanceImpact && (
              <div className="mt-3 pt-3 border-t border-slate-700/90 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                    <Truck size={13} className="text-emerald-400" />
                    <span>موقف حساب المورد:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPartnerForStatementModal(selectedPartner)}
                    className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded font-bold text-[10px] border border-emerald-900 transition-colors cursor-pointer"
                    title="عرض كشف حساب المورد التفصيلي وحركات الفواتير والسندات"
                  >
                    <FileText size={11} />
                    <span>كشف الحساب</span>
                  </button>
                </div>

                <div className="bg-slate-800/90 rounded-xl p-3 border border-emerald-950 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span className="font-sans">الرصيد السابق قبل الفاتورة:</span>
                    <span className="font-bold text-slate-200">
                      {partnerBalanceImpact.previousBalanceFormatted} {currencySymbol} ({partnerBalanceImpact.previousBalanceLabel})
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span className="font-sans">قيمة الفاتورة الحالية (+):</span>
                    <span className="font-bold text-slate-200">
                      +{partnerBalanceImpact.invoiceAmountFormatted} {currencySymbol}
                    </span>
                  </div>
                  {partnerBalanceImpact.paidAmount > 0 && (
                    <div className="flex justify-between items-center text-slate-400 text-[11px]">
                      <span className="font-sans">المسدد نقداً للمورد (-):</span>
                      <span className="font-bold text-emerald-400">
                        -{partnerBalanceImpact.paidAmountFormatted} {currencySymbol}
                      </span>
                    </div>
                  )}
                  {partnerBalanceImpact.remainingAmount > 0 && partnerBalanceImpact.paidAmount > 0 && (
                    <div className="flex justify-between items-center text-slate-400 text-[11px]">
                      <span className="font-sans">صافي الإضافة لحساب المورد:</span>
                      <span className="font-bold text-emerald-300">
                        +{partnerBalanceImpact.remainingAmountFormatted} {currencySymbol}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-700 flex justify-between items-center">
                    <span className="text-white font-bold text-xs font-sans">الموقف النهائي بعد الفاتورة:</span>
                    <div className="text-left">
                      <span className={`text-base font-black ${
                        partnerBalanceImpact.newBalanceType === 'CREDIT' 
                          ? 'text-emerald-300' 
                          : partnerBalanceImpact.newBalanceType === 'DEBIT' 
                          ? 'text-teal-300' 
                          : 'text-slate-300'
                      }`}>
                        {partnerBalanceImpact.newBalanceFormatted} {currencySymbol}
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans block mr-1 font-bold">
                        ({partnerBalanceImpact.newBalanceLabel})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Print Signatures Block */}
        <div className="hidden print:grid grid-cols-2 gap-12 p-10 mt-10 text-center text-slate-800 border-t border-slate-300">
          <div>
            <p className="font-bold mb-14 text-sm">توقيع مندوب المورد</p>
            <div className="border-b-2 border-dashed border-slate-400 w-3/4 mx-auto"></div>
          </div>
          <div>
            <p className="font-bold mb-14 text-sm">أمين المستودع والمحاسب المسؤول</p>
            <div className="border-b-2 border-dashed border-slate-400 w-3/4 mx-auto"></div>
          </div>
        </div>
      </div>

      {/* Partner Statement Modal */}
      <PartnerStatementModal
        partner={selectedPartnerForStatementModal}
        isOpen={Boolean(selectedPartnerForStatementModal)}
        onClose={() => setSelectedPartnerForStatementModal(null)}
      />

      {/* In-App Delete Confirmation Modal (100% reliable in any iframe) */}
      {deleteModal && deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-2 border-slate-300 text-right space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-1 shadow-inner">
              <Trash2 size={28} />
            </div>
            <h3 className="text-base font-black text-slate-900 text-center">
              {deleteModal.isNewDraft ? 'إفراغ مسودة الفاتورة الحالية' : 'تأكيد حذف فاتورة المشتريات نهائياً'}
            </h3>
            <p className="text-xs text-slate-600 text-center leading-relaxed">
              {deleteModal.isNewDraft ? (
                <>هل ترغب حقاً في إفراغ كافة البيانات وإعادة تعيين هذه الفاتورة للبدء بمسودة جديدة فارغة؟</>
              ) : (
                <>
                  هل أنت متأكد من رغبتك في حذف فاتورة المشتريات رقم{' '}
                  <span className="font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                    {deleteModal.invoiceNumber}
                  </span>{' '}
                  نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء بعد تنفيذه.
                </>
              )}
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={confirmExecuteDelete}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-md transition-colors cursor-pointer border border-rose-800 flex items-center justify-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>{deleteModal.isNewDraft ? 'نعم، إفراغ المسودة' : 'نعم، حذف الفاتورة نهائياً'}</span>
              </button>
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer border border-slate-300"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-60 animate-bounce">
          <div className={`px-5 py-3 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-2 ${
            toast.type === 'success' 
              ? 'bg-emerald-950 text-white border-emerald-900' 
              : toast.type === 'error'
              ? 'bg-rose-900 text-white border-rose-500'
              : 'bg-slate-900 text-white border-slate-700'
          }`}>
            <CheckCircle2 size={16} className={toast.type === 'success' ? 'text-emerald-400' : 'text-slate-300'} />
            <span>{toast.title}</span>
          </div>
        </div>
      )}

      {/* Universal Print Preview Modal */}
      <PrintPreviewModal
        isOpen={showPrintPreview}
        onClose={() => {
          setShowPrintPreview(false);
          setCustomPreviewData(null);
        }}
        data={customPreviewData || currentInvoicePreviewData}
      />

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
