import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Save, Plus, Trash2, CheckCircle2, RotateCcw, 
  History, Printer, Calendar, User, X, Edit3, Eye, EyeOff, Lock,
  FileDown, Loader2, Keyboard, FileText, CreditCard,
  AlertCircle, AlertTriangle, Info, RefreshCw, BarChart3,
  ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft, ArrowRight,
  Mic, MicOff, Sparkles, Scan, FileSpreadsheet, Scale,
  MessageSquare, Send, Copy, Phone, Share2, Check, Download
, Hash, Landmark, Percent, Warehouse, Briefcase } from 'lucide-react';
import PrintDropdown from './PrintDropdown';
import PrintPreviewModal, { PrintPreviewData } from './PrintPreviewModal';
import { CertifiedInvoiceDocument } from './CertifiedInvoiceDocument';
import { exportElementToPdf } from '../utils/pdfExport';
import PartnerStatementModal from './PartnerStatementModal';
import ItemAnalyticsModal from './ItemAnalyticsModal';
import ItemBarcodeScannerModal from './ItemBarcodeScannerModal';
import { navigateToAccountMovements } from '../utils/accountMovementsStore';
import { 
  getNextSequentialNumber, 
  advanceSequenceAfterSave, 
  DB_SALES_INVOICES_KEY,
  DB_ITEMS_KEY
} from '../utils/sequences';
import { notifyDataChanged } from '../utils/localFolderBackup';
import { loadChartOfAccounts } from '../utils/trialBalanceStore';
import { isCashOrBankAccount } from '../utils/accountingIntegration';
import { Account } from '../types/accounting';
import { Partner } from '../types/accounting';
import ItemAutocomplete from './ItemAutocomplete';
import { Item } from './Items';
import { loadStoredItems, normalizeArabic, getWarehouseLabel, getDynamicWarehousesList } from '../utils/itemsStore';
import { 
  InvoiceItem, 
  StoredSalesInvoice, 
  loadStoredSalesInvoices 
} from '../utils/salesStore';
export type { InvoiceItem, StoredSalesInvoice };
import { useSystemCurrency } from '../utils/currency';
import { 
  loadCustomers, 
  getPartnerAccountStatement, 
  calculateInvoicePartnerImpact,
  dispatchPartnerLedgerUpdated 
} from '../utils/partnerLedger';
import { getSystemSettings } from '../utils/settings';
import { checkDateIsLocked } from '../utils/periodLock';
import { parseVoiceItemsFromText } from '../utils/voiceCommandParser';
import { getFlatCostCenters } from '../utils/costCenterStore';

const STANDARD_UNITS = ['حبة / قطعة', 'حبة', 'قطعة', 'كرتون', 'درزن', 'باكت', 'علبة', 'طقم', 'متر', 'كجم', 'لتر', 'خدمة', 'جالون', 'حزمة', 'كيس', 'طن', 'طرد', 'برميل'];
const PAYMENT_METHODS_LIST = [
  { id: 'CASH', label: 'نقداً' },
  { id: 'SPAN', label: 'مدى / شبكة' },
  { id: 'BANK_TRANSFER', label: 'تحويل بنكي' },
  { id: 'CHECK', label: 'شيك' }
];
const SAFES_LIST = [
  { id: '1101', label: 'الصندوق الرئيسي (1101)' },
  { id: '1102', label: 'الحساب البنكي الجاري (1102)' },
  { id: '1105', label: 'العهدة النقدية (1105)' }
];

export function resolveItemStockAndCost(
  item: InvoiceItem, 
  catalog: Item[], 
  selectedWarehouse?: string,
  isPostedOrViewOnly?: boolean
): { stock: number; costPrice: number; unit: string; matched: boolean; warehouseName: string } {
  const targetWhName = getWarehouseLabel(selectedWarehouse);
  let matchedItem: Item | undefined;

  if (item.itemId) {
    matchedItem = catalog.find(i => i.id === item.itemId);
  }
  if (!matchedItem && item.itemCode) {
    const code = String(item.itemCode).trim().toLowerCase();
    matchedItem = catalog.find(i => String(i.code).trim().toLowerCase() === code);
  }
  if (!matchedItem && item.description && item.description.trim()) {
    const cleanDesc = normalizeArabic ? normalizeArabic(item.description) : item.description.trim().toLowerCase();
    matchedItem = catalog.find(i => {
      const iName = normalizeArabic ? normalizeArabic(i.name || '') : (i.name || '').trim().toLowerCase();
      const iCode = (i.code || '').trim().toLowerCase();
      return iName === cleanDesc || iCode === cleanDesc;
    });
    if (!matchedItem) {
      matchedItem = catalog.find(i => {
        const iName = normalizeArabic ? normalizeArabic(i.name || '') : (i.name || '').trim().toLowerCase();
        return iName.includes(cleanDesc) || cleanDesc.includes(iName);
      });
    }
  }

  // 1. If invoice is posted or view-only AND item has a saved snapshot availableStock:
  if (isPostedOrViewOnly && item.availableStock !== undefined && item.availableStock !== null) {
    return {
      stock: Number(item.availableStock) || 0,
      costPrice: item.costPrice !== undefined ? Number(item.costPrice) : (matchedItem ? Number(matchedItem.costPrice) || 0 : 0),
      unit: item.unit || (matchedItem ? matchedItem.unit : 'حبة / قطعة'),
      matched: true,
      warehouseName: (matchedItem && matchedItem.warehouseName) || targetWhName
    };
  }

  // 2. For Posted invoices without explicit saved availableStock, reconstitute stock at invoice time:
  if (isPostedOrViewOnly && matchedItem) {
    const liveStock = Number(matchedItem.stock) || 0;
    const qty = Number(item.quantity) || 0;
    const snapshotStock = liveStock + qty;
    return {
      stock: snapshotStock,
      costPrice: Number(matchedItem.costPrice) || 0,
      unit: matchedItem.unit || 'حبة / قطعة',
      matched: true,
      warehouseName: matchedItem.warehouseName || targetWhName
    };
  }

  // 3. For NEW or EDITING Draft invoices: evaluate live catalog stock
  if (matchedItem) {
    return {
      stock: Number(matchedItem.stock) || 0,
      costPrice: Number(matchedItem.costPrice) || 0,
      unit: matchedItem.unit || 'حبة / قطعة',
      matched: true,
      warehouseName: matchedItem.warehouseName || targetWhName
    };
  }

  const fallbackStock = item.availableStock !== undefined ? Number(item.availableStock) : 0;
  return {
    stock: fallbackStock,
    costPrice: item.costPrice !== undefined ? Number(item.costPrice) : 0,
    unit: item.unit || 'حبة / قطعة',
    matched: true,
    warehouseName: targetWhName
  };
}

function deductItemsStockOnSale(saleItems: InvoiceItem[]): Item[] {
  try {
    const raw = localStorage.getItem(DB_ITEMS_KEY);
    if (!raw) return [];
    const itemsList: Item[] = JSON.parse(raw);
    let changed = false;

    saleItems.forEach(sItem => {
      const sQty = Number(sItem.quantity) || 0;
      if (sQty <= 0) return;

      const idx = itemsList.findIndex(it => 
        (sItem.itemId && it.id === sItem.itemId) ||
        (sItem.itemCode && it.code === sItem.itemCode) ||
        (sItem.description && (it.name || '').trim().toLowerCase() === (sItem.description || '').trim().toLowerCase())
      );

      if (idx !== -1) {
        const it = itemsList[idx];
        if (it) {
          const oldStock = Number(it.stock) || 0;
          const newStock = Math.max(0, oldStock - sQty);
          itemsList[idx] = {
            ...it,
            stock: newStock
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
    console.error('Failed to deduct stock on sale:', err);
  }
  return [];
}

function restoreItemsStockOnSaleUnpost(saleItems: InvoiceItem[]): Item[] {
  try {
    const raw = localStorage.getItem(DB_ITEMS_KEY);
    if (!raw) return [];
    const itemsList: Item[] = JSON.parse(raw);
    let changed = false;

    saleItems.forEach(sItem => {
      const sQty = Number(sItem.quantity) || 0;
      if (sQty <= 0) return;

      const idx = itemsList.findIndex(it => 
        (sItem.itemId && it.id === sItem.itemId) ||
        (sItem.itemCode && it.code === sItem.itemCode) ||
        (sItem.description && (it.name || '').trim().toLowerCase() === (sItem.description || '').trim().toLowerCase())
      );

      if (idx !== -1) {
        const it = itemsList[idx];
        if (it) {
          const oldStock = Number(it.stock) || 0;
          itemsList[idx] = {
            ...it,
            stock: oldStock + sQty
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
    console.error('Failed to restore stock on unpost:', err);
  }
  return [];
}



function getInvoiceTypeName(type: string): string {
  switch(type) {
    case 'CASH_SALES': return 'مبيعات نقدية';
    case 'PARTIAL_SALES': return 'مبيعات جزئية';
    case 'CREDIT_SALES': return 'مبيعات آجلة';
    case 'CASH_RETURN': return 'مرتجع مبيعات نقدي';
    case 'PARTIAL_RETURN': return 'مرتجع مبيعات جزئي';
    case 'CREDIT_RETURN': return 'مرتجع مبيعات آجل';
    case 'QUOTATION': return 'عرض أسعار';
    default: return type;
  }
}

export default function Sales() {
  const { symbol: currencySymbol, fullNameAr: currencyFullNameAr, tafqeet } = useSystemCurrency();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [savedInvoices, setSavedInvoices] = useState<StoredSalesInvoice[]>([]);
  const [customers, setCustomers] = useState<Partner[]>([]);
  const [itemsCatalog, setItemsCatalog] = useState<Item[]>([]);
  const [chartAccounts, setChartAccounts] = useState<Account[]>(() => loadChartOfAccounts());

  useEffect(() => {
    const handleSyncAccounts = () => setChartAccounts(loadChartOfAccounts());
    window.addEventListener('alpha-chart-of-accounts-updated', handleSyncAccounts);
    window.addEventListener('alpha-data-changed', handleSyncAccounts);
    return () => {
      window.removeEventListener('alpha-chart-of-accounts-updated', handleSyncAccounts);
      window.removeEventListener('alpha-data-changed', handleSyncAccounts);
    };
  }, []);

  const [costCentersList, setCostCentersList] = useState(() => getFlatCostCenters());

  useEffect(() => {
    const handleSyncCostCenters = () => setCostCentersList(getFlatCostCenters());
    window.addEventListener('alpha-cost-centers-updated', handleSyncCostCenters);
    window.addEventListener('alpha-system-reset-completed', handleSyncCostCenters);
    window.addEventListener('storage', handleSyncCostCenters);
    return () => {
      window.removeEventListener('alpha-cost-centers-updated', handleSyncCostCenters);
      window.removeEventListener('alpha-system-reset-completed', handleSyncCostCenters);
      window.removeEventListener('storage', handleSyncCostCenters);
    };
  }, []);

  const dynamicSafesList = useMemo(() => {
    const accounts = chartAccounts.filter(a => isCashOrBankAccount(a, chartAccounts));
    const options = accounts.map(a => ({
      id: a.code || a.id,
      code: a.code,
      label: a.code + ' - ' + a.name
    }));

    if (options.length === 0) {
      return [
        { id: '1101', code: '1101', label: '1101 - النقدية بالصندوق (الصندوق الرئيسي)' },
        { id: '1102', code: '1102', label: '1102 - النقدية بالبنك (الحساب البنكي الجاري)' }
      ];
    }

    return options;
  }, [chartAccounts]);
  const [selectedPartnerForStatementModal, setSelectedPartnerForStatementModal] = useState<Partner | null>(null);
  const [partnerBalanceSnapshot, setPartnerBalanceSnapshot] = useState<number | null>(null);
  const [showBarcodeScannerModal, setShowBarcodeScannerModal] = useState<boolean>(false);

  // Voice Dictation for Invoice Items
  const [isDictatingItems, setIsDictatingItems] = useState<boolean>(false);
  const [dictationTranscript, setDictationTranscript] = useState<string>('');
  const dictationRecognitionRef = useRef<any>(null);

  const startItemsDictation = () => {
    if (!isEditable) {
      showToast({
        type: 'warning',
        title: 'تعديل الفاتورة مطلوب',
        message: 'اضغط على زر [تعديل الفاتورة] بالأعلى للتمكن من إملاء الأصناف بالصوت.'
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
            // Append or replace empty first row
            setItems(prev => {
              const cleanPrev = prev.filter(p => (p.description && p.description.trim()) || (p.itemId));
              const newItemsMapped = parsed.map((p, idx) => ({
                id: 'item-' + Date.now() + '-' + idx,
                itemId: p.item?.id,
                itemCode: p.item?.code || '',
                description: p.name || p.item?.name || '',
                quantity: p.quantity || 1,
                unitPrice: p.unitPrice !== undefined ? p.unitPrice : (p.item?.salePrice || 0),
                taxRate: classification === 'TAX' ? taxRate : 0,
                availableStock: p.item?.stock || 0,
                costPrice: p.item?.costPrice || 0
              }));
              return [...cleanPrev, ...newItemsMapped];
            });
            showToast({
              type: 'success',
              title: `🎙️ تم إدراج ${parsed.length} صنف/أصناف بالصوت بنجاح!`,
              message: parsed.map(p => `${p.name} (كمية: ${p.quantity})`).join(' ، ')
            });
          } else {
            showToast({
              type: 'info',
              title: 'لم يتم التعرف على بنود محددة',
              message: `النص الملتقط: "${final}". يمكنك نطق: "5 كيبورد بسعر 100 و 2 ماوس"`
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

  // Initial non-blocking load: deferred to let navigation render instantaneously without UI freezing
  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      try {
        const storedInvs = loadStoredSalesInvoices();
        const storedCusts = loadCustomers();
        const storedItems = loadStoredItems();

        if (isMounted) {
          setSavedInvoices(storedInvs);
          setCustomers(storedCusts);
          setItemsCatalog(storedItems);
          const nextSeq = getNextSequentialNumber('salesInvoice', storedInvs.map(i => i.invoiceNumber)).formatted;
          setInvoiceNumber(nextSeq);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to initialize sales data:', err);
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
        setCustomers(loadCustomers());
        setSavedInvoices(loadStoredSalesInvoices());
        setItemsCatalog(loadStoredItems());
        setAnalyticItemId(null);
      } catch (err) {
        console.error(err);
      }
    };
    window.addEventListener('alpha-partner-ledger-updated', handleSync);
    window.addEventListener('alpha-system-reset-completed', handleSync);
    window.addEventListener('alpha-sales-invoices-updated', handleSync);
    window.addEventListener('alpha-items-updated', handleSync);
    window.addEventListener('alpha-device-id-changed', handleSync);
    window.addEventListener('alpha-sequences-updated', handleSync);
    window.addEventListener('storage', handleSync);

    const handleCreateVoiceInvoice = (e: any) => {
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
          unitPrice: it.unitPrice || it.item?.salePrice || 0,
          taxRate: defaultSysTaxRate,
          availableStock: it.item?.stock || 0,
          costPrice: it.item?.costPrice || 0
        }));
        setItems(mappedItems);
      }
      showToast({
        type: 'success',
        title: 'تم تجهيز فاتورة مبيعات جديدة بالصوت',
        message: payload?.partner?.name ? `تم اختيار العميل: ${payload.partner.name}` : 'جاهزة لإضافة الأصناف وحفظ الفاتورة'
      });
    };

    const handleHighlightInvoice = (e: any) => {
      const invoice = e.detail?.invoice;
      if (invoice) {
        handleEditInvoice(invoice);
        showToast({
          type: 'info',
          title: `تم فتح الفاتورة #${invoice.invoiceNumber}`
        });
      }
    };

    window.addEventListener('alpha-voice-create-sales-invoice', handleCreateVoiceInvoice);
    window.addEventListener('alpha-highlight-sales-invoice', handleHighlightInvoice);

    return () => {
      window.removeEventListener('alpha-partner-ledger-updated', handleSync);
      window.removeEventListener('alpha-system-reset-completed', handleSync);
      window.removeEventListener('alpha-sales-invoices-updated', handleSync);
      window.removeEventListener('alpha-items-updated', handleSync);
      window.removeEventListener('alpha-device-id-changed', handleSync);
      window.removeEventListener('alpha-sequences-updated', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('alpha-voice-create-sales-invoice', handleCreateVoiceInvoice);
      window.removeEventListener('alpha-highlight-sales-invoice', handleHighlightInvoice);
    };
  }, []);

  // Derive next sequential invoice number based on stored invoices
  const nextCalculatedInvoiceNum = useMemo(() => {
    const list = Array.isArray(savedInvoices) ? savedInvoices : [];
    return getNextSequentialNumber('salesInvoice', list.map(i => i.invoiceNumber)).formatted;
  }, [savedInvoices]);

  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0] as string);
  const [dueDate, setDueDate] = useState<string>('');
  const [partnerId, setPartnerId] = useState<string>('');
  const [status, setStatus] = useState<'DRAFT' | 'POSTED'>('DRAFT');
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [showInvoicesHistory, setShowInvoicesHistory] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [previewAutoPrint, setPreviewAutoPrint] = useState(false);
  const [previewAutoPdf, setPreviewAutoPdf] = useState(false);
  const [customPreviewData, setCustomPreviewData] = useState<PrintPreviewData | null>(null);
  const [analyticItemId, setAnalyticItemId] = useState<string | null>(null);

  // WhatsApp Share States
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppRecipientPhone, setWhatsAppRecipientPhone] = useState('');
  const [whatsAppMessageText, setWhatsAppMessageText] = useState('');
  const [isEditingWhatsAppText, setIsEditingWhatsAppText] = useState(false);
  const [whatsAppCustomInvoiceData, setWhatsAppCustomInvoiceData] = useState<PrintPreviewData | null>(null);
  const [isCopiedWhatsAppText, setIsCopiedWhatsAppText] = useState(false);
  const whatsAppPdfElementRef = useRef<HTMLDivElement>(null);

  // In-App Toast & Confirmation Modal States (eliminates browser popup issues)
  const [toast, setToast] = useState<{ id: number; type: 'success' | 'error' | 'warning' | 'info'; title: string; message?: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; invoiceId?: string | null | undefined; invoiceNumber: string; isNewDraft?: boolean; isPosted?: boolean } | null>(null);
  const [hasPartnerError, setHasPartnerError] = useState<boolean>(false);
  const [invoiceNumberError, setInvoiceNumberError] = useState<string | null>(null);

  function showToast(t: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message?: string }) {
    setToast({ id: Date.now(), ...t });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  
  // Is current invoice actively editable
  const isEditable = status !== 'POSTED' && isEditMode;
  
  // Classification and categorization (initialized with system default settings)
  const systemSettings = getSystemSettings();
  const defaultInvoiceSettings = systemSettings.invoiceDefaults || {};
  const defaultSysTaxRate = systemSettings.taxAndInvoice?.defaultVatRate !== undefined ? systemSettings.taxAndInvoice.defaultVatRate : 15;
  const vatEnabled = systemSettings.taxAndInvoice?.enableVat !== false;
  const initialSalesClassification = vatEnabled ? ((defaultInvoiceSettings.salesClassification as 'NORMAL' | 'TAX') || 'TAX') : 'NORMAL';
  const initialSalesTaxRate = initialSalesClassification === 'TAX' ? defaultSysTaxRate : 0;
  const [classification, setClassification] = useState<'NORMAL' | 'TAX'>(initialSalesClassification);
  const [taxRate, setTaxRate] = useState<number | string>(initialSalesTaxRate);
  const [invoiceType, setInvoiceType] = useState<string>(defaultInvoiceSettings.salesTransactionType || 'CREDIT_SALES');
  const [paidAmount, setPaidAmount] = useState<number | string>(0);
  const [source, setSource] = useState<string>(defaultInvoiceSettings.salesWarehouse || 'MAIN_WAREHOUSE');
  const [safe, setSafe] = useState<string>(defaultInvoiceSettings.salesSafe || '1101');
  const [serviceType, setServiceType] = useState<string>(defaultInvoiceSettings.salesServiceType || '');
  const [costCenterId, setCostCenterId] = useState<string>('');
  const [discount, setDiscount] = useState<number | string>(0);
  const [discountType, setDiscountType] = useState<'AMOUNT' | 'PERCENT'>('AMOUNT');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'SPAN' | 'BANK_TRANSFER' | 'CHECK'>('CASH');
  const [servicesFee, setServicesFee] = useState<number | string>(0);
  const [notes, setNotes] = useState<string>('');
  const [showCostPriceColumn, setShowCostPriceColumn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('alpha_sales_show_cost');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // Quick Customer Creation Modal State
  const [showQuickAddCustomerModal, setShowQuickAddCustomerModal] = useState<boolean>(false);
  const [quickCustName, setQuickCustName] = useState<string>('');
  const [quickCustPhone, setQuickCustPhone] = useState<string>('');
  const [quickCustTaxNo, setQuickCustTaxNo] = useState<string>('');
  const [quickCustCreditLimit, setQuickCustCreditLimit] = useState<number | string>('');
  const [quickCustAddress, setQuickCustAddress] = useState<string>('');
  
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: 'item-' + Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: initialSalesTaxRate, availableStock: 0, costPrice: 0 }
  ]);

  const selectedPartner = useMemo(() => {
    return customers.find(c => c.id === partnerId || c.name === partnerId);
  }, [customers, partnerId]);

  // Live account statement for selected customer
  const selectedPartnerStatement = useMemo(() => {
    if (!selectedPartner) return null;
    return getPartnerAccountStatement(selectedPartner);
  }, [selectedPartner, savedInvoices]);

  const displayPartnerBalance = useMemo(() => {
    if ((status === 'POSTED' || !isEditMode) && partnerBalanceSnapshot !== null && partnerBalanceSnapshot !== undefined) {
      return partnerBalanceSnapshot;
    }
    return selectedPartnerStatement?.netBalance ?? 0;
  }, [status, isEditMode, partnerBalanceSnapshot, selectedPartnerStatement]);

  const handleSaveQuickCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustName.trim()) {
      alert('يرجى إدخال اسم العميل أولاً');
      return;
    }
    const newCust: Partner = {
      id: 'cust-' + Date.now(),
      code: 'C-' + Math.floor(1000 + Math.random() * 9000),
      name: quickCustName.trim(),
      type: 'CUSTOMER',
      phone: quickCustPhone.trim() || undefined,
      taxNumber: quickCustTaxNo.trim() || undefined,
      creditLimit: quickCustCreditLimit ? Number(quickCustCreditLimit) : undefined,
      address: quickCustAddress.trim() || undefined,
      isActive: true
    };
    const updated = [...customers, newCust];
    setCustomers(updated);
    saveCustomersList(updated);
    dispatchPartnerLedgerUpdated();
    setPartnerId(newCust.id);
    setHasPartnerError(false);
    setShowQuickAddCustomerModal(false);
    setQuickCustName('');
    setQuickCustPhone('');
    setQuickCustTaxNo('');
    setQuickCustCreditLimit('');
    setQuickCustAddress('');
    showToast({
      type: 'success',
      title: `تمت إضافة العميل (${newCust.name}) واختياره بنجاح!`
    });
  };

  const handleNewInvoice = (customList?: StoredSalesInvoice[] | unknown) => {
    const currSettings = getSystemSettings();
    const currentDefaults = currSettings.invoiceDefaults || {};
    const vatEnabled = currSettings.taxAndInvoice?.enableVat !== false;
    const sysTax = currSettings.taxAndInvoice?.defaultVatRate !== undefined ? currSettings.taxAndInvoice.defaultVatRate : 15;
    const initialClassification = vatEnabled ? ((currentDefaults.salesClassification as 'NORMAL' | 'TAX') || 'TAX') : 'NORMAL';
    const effectiveTaxRate = initialClassification === 'TAX' ? sysTax : 0;
    setEditingInvoiceId(null);
    setPartnerBalanceSnapshot(null);
    const list = Array.isArray(customList) ? customList : (Array.isArray(savedInvoices) ? savedInvoices : []);
    const nextSeq = getNextSequentialNumber('salesInvoice', list.map(i => i.invoiceNumber)).formatted;
    setInvoiceNumber(nextSeq);
    setInvoiceNumberError(null);
    setHasPartnerError(false);
    setStatus('DRAFT');
    setIsEditMode(true);
    setPartnerId('');
    setDueDate('');
    setNotes('');
    setClassification(initialClassification);
    setTaxRate(effectiveTaxRate);
    setInvoiceType(currentDefaults.salesTransactionType || 'CREDIT_SALES');
    setSource(currentDefaults.salesWarehouse || 'MAIN_WAREHOUSE');
    setSafe(currentDefaults.salesSafe || '1101');
    setServiceType(currentDefaults.salesServiceType || '');
    setCostCenterId('');
    setPaidAmount(0);
    setDiscount(0);
    setServicesFee(0);
    setItems([{ id: 'item-' + Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: effectiveTaxRate, availableStock: 0, costPrice: 0 }]);
    setItemsCatalog(loadStoredItems());
  };

  function handleEditInvoice(inv: StoredSalesInvoice) {
    setEditingInvoiceId(inv.id);
    setPartnerBalanceSnapshot(inv.partnerBalanceSnapshot !== undefined ? inv.partnerBalanceSnapshot : null);
    setInvoiceNumber(inv.invoiceNumber);
    setInvoiceNumberError(null);
    setHasPartnerError(false);
    setDate(inv.date);
    setDueDate(inv.dueDate || '');
    setPartnerId(inv.partnerId);
    setClassification(inv.classification);
    const resolvedTaxRate = inv.taxRate !== undefined ? inv.taxRate : (inv.items?.[0]?.taxRate ?? 15);
    setTaxRate(resolvedTaxRate);
    setInvoiceType(inv.invoiceType);
    setSource(inv.source);
    setSafe(inv.safe);
    setCostCenterId(inv.costCenterId || '');
    setNotes(inv.notes || '');
    setStatus(inv.status);
    // If draft, open directly in edit mode for immediate editing; if posted, lock
    setIsEditMode(inv.status !== 'POSTED');
    const initialPaid = inv.totals?.cashPaid !== undefined 
      ? inv.totals.cashPaid 
      : (inv.invoiceType === 'CASH_SALES' ? inv.totals.grandTotal : 0);
    setPaidAmount(initialPaid);
    setDiscount(inv.totals?.discountTotal || 0);
    setServicesFee(inv.totals?.servicesTotal || 0);
    setItems(inv.items.length > 0 ? inv.items : [{ id: 'item-' + Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: resolvedTaxRate, availableStock: 0, costPrice: 0 }]);
    setItemsCatalog(loadStoredItems());
    setShowInvoicesHistory(false);
  };

  // Check for pending target invoice on mount / when savedInvoices load
  useEffect(() => {
    try {
      const targetId = sessionStorage.getItem('alpha_target_sales_invoice_id');
      const targetNum = sessionStorage.getItem('alpha_target_sales_invoice_number');
      if (targetId || targetNum) {
        sessionStorage.removeItem('alpha_target_sales_invoice_id');
        sessionStorage.removeItem('alpha_target_sales_invoice_number');
        const list = Array.isArray(savedInvoices) ? savedInvoices : [];
        const cleanNum = targetNum ? targetNum.replace(/^#/, '').trim().toLowerCase() : '';
        const found = list.find(i => 
          (targetId && String(i.id) === String(targetId)) ||
          (cleanNum && i.invoiceNumber && String(i.invoiceNumber).replace(/^#/, '').trim().toLowerCase() === cleanNum)
        );
        if (found) {
          handleEditInvoice(found);
          showToast({
            type: 'info',
            title: `تم فتح الفاتورة #${found.invoiceNumber}`
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load pending sales invoice from sessionStorage:', e);
    }
  }, [savedInvoices]);

  // Listen to system settings updates (invoicing and taxes defaults)
  useEffect(() => {
    const handleSettingsUpdated = (e: any) => {
      const updatedSettings: SystemSettings = e?.detail || getSystemSettings();
      const vatEnabled = updatedSettings.taxAndInvoice?.enableVat !== false;
      const defClass = vatEnabled ? ((updatedSettings.invoiceDefaults?.salesClassification as 'NORMAL' | 'TAX') || 'TAX') : 'NORMAL';
      const defTax = defClass === 'TAX' ? (updatedSettings.taxAndInvoice?.defaultVatRate ?? 15) : 0;
      
      // If currently on a pristine new draft, update to match new defaults
      if (editingInvoiceId === null && items.length <= 1 && (items[0]?.description === '' || !items[0]?.description)) {
        setClassification(defClass);
        setTaxRate(defTax);
        if (updatedSettings.invoiceDefaults?.salesTransactionType) {
          setInvoiceType(updatedSettings.invoiceDefaults.salesTransactionType);
        }
        if (updatedSettings.invoiceDefaults?.salesWarehouse) {
          setSource(updatedSettings.invoiceDefaults.salesWarehouse);
        }
        if (updatedSettings.invoiceDefaults?.salesSafe) {
          setSafe(updatedSettings.invoiceDefaults.salesSafe);
        }
        if (updatedSettings.invoiceDefaults?.salesServiceType) {
          setServiceType(updatedSettings.invoiceDefaults.salesServiceType);
        }
        setItems(prev => prev.map(it => ({ ...it, taxRate: defTax })));
      }
    };
    window.addEventListener('alpha-settings-updated', handleSettingsUpdated);
    return () => window.removeEventListener('alpha-settings-updated', handleSettingsUpdated);
  }, [editingInvoiceId, items]);

  const handleStartEditInvoice = () => {
    if (status === 'POSTED') {
      showToast({
        type: 'warning',
        title: 'الفاتورة مرحلة ومعتمدة',
        message: 'لا يمكن تعديل الفاتورة وهي مرحلة. يرجى أولاً إلغاء الترحيل.'
      });
      return;
    }
    setIsEditMode(true);
    showToast({
      type: 'info',
      title: 'وضع التعديل مفعل',
      message: 'يمكنك الآن إضافة أو حذف الأصناف وتعديل كافة الحقول.'
    });
  };

  const handleCancelEdit = () => {
    if (editingInvoiceId) {
      const original = savedInvoices.find(i => i.id === editingInvoiceId);
      if (original) {
        handleEditInvoice(original);
        return;
      }
    }
    setIsEditMode(false);
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
    if (chronologicallyOrderedInvoices.length === 0) {
      showToast({ type: 'info', title: 'لا توجد فواتير محفوظة للتنقل' });
      return;
    }
    if (currentInvoiceIndex === -1) {
      // From new draft, go to the latest invoice
      const target = chronologicallyOrderedInvoices[chronologicallyOrderedInvoices.length - 1];
      if (target) {
        handleEditInvoice(target);
        showToast({ type: 'info', title: `تراجع للخلف: فاتورة #${target.invoiceNumber}` });
      }
    } else if (currentInvoiceIndex > 0) {
      const target = chronologicallyOrderedInvoices[currentInvoiceIndex - 1];
      if (target) {
        handleEditInvoice(target);
        showToast({ type: 'info', title: `تراجع للخلف: فاتورة #${target.invoiceNumber} (${currentInvoiceIndex}/${chronologicallyOrderedInvoices.length})` });
      }
    } else {
      showToast({ type: 'info', title: 'أنت بالفعل عند أول فاتورة مسجلة في النظام' });
    }
  };

  const handleNavigateNext = () => {
    if (chronologicallyOrderedInvoices.length === 0) {
      showToast({ type: 'info', title: 'لا توجد فواتير محفوظة للتنقل' });
      return;
    }
    if (currentInvoiceIndex >= 0 && currentInvoiceIndex < chronologicallyOrderedInvoices.length - 1) {
      const target = chronologicallyOrderedInvoices[currentInvoiceIndex + 1];
      if (target) {
        handleEditInvoice(target);
        showToast({ type: 'info', title: `تقديم للأمام: فاتورة #${target.invoiceNumber} (${currentInvoiceIndex + 2}/${chronologicallyOrderedInvoices.length})` });
      }
    } else if (currentInvoiceIndex === chronologicallyOrderedInvoices.length - 1) {
      handleNewInvoice();
      showToast({ type: 'info', title: 'تقديم للأمام: الانتقال إلى إنشاء فاتورة جديدة' });
    } else {
      showToast({ type: 'info', title: 'أنت بالفعل عند مسودة الفاتورة الجديدة' });
    }
  };

  const handleNavigateFirst = () => {
    if (chronologicallyOrderedInvoices.length > 0) {
      const first = chronologicallyOrderedInvoices[0];
      if (first) {
        handleEditInvoice(first);
        showToast({ type: 'info', title: `الفاتورة الأولى: #${first.invoiceNumber}` });
      }
    }
  };

  const handleNavigateLast = () => {
    if (chronologicallyOrderedInvoices.length > 0) {
      const last = chronologicallyOrderedInvoices[chronologicallyOrderedInvoices.length - 1];
      if (last) {
        handleEditInvoice(last);
        showToast({ type: 'info', title: `الفاتورة الأخيرة: #${last.invoiceNumber}` });
      }
    }
  };

  const canGoPrevious = chronologicallyOrderedInvoices.length > 0 && (currentInvoiceIndex === -1 || currentInvoiceIndex > 0);
  const canGoNext = chronologicallyOrderedInvoices.length > 0 && currentInvoiceIndex !== -1;
  const canGoFirst = chronologicallyOrderedInvoices.length > 0 && currentInvoiceIndex !== 0;
  const canGoLast = chronologicallyOrderedInvoices.length > 0 && (currentInvoiceIndex === -1 || currentInvoiceIndex < chronologicallyOrderedInvoices.length - 1);

  const handleAddItem = () => {
    if (!isEditable) {
      if (status === 'POSTED') {
        alert('⚠️ لا يمكن إضافة أي صنف لأن الفاتورة مرحلة ومقفلة!\n\nيرجى أولاً الضغط على زر [إلغاء الترحيل] ثم الضغط على [تعديل الفاتورة].');
      } else {
        alert('⚠️ الفاتورة في وضع المعاينة الآمنة. يرجى الضغط على زر [تعديل الفاتورة] بالأعلى أولاً لتفعيل الإضافة.');
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

  const handleScanItem = (scannedItem: Item, quantityToAdd: number = 1) => {
    if (!isEditable) {
      if (status === 'POSTED') {
        showToast({
          type: 'warning',
          title: 'الفاتورة مرحلة ومقفلة',
          message: 'لا يمكن إضافة أي صنف لأن الفاتورة مرحلة ومقفلة. يرجى إلغاء الترحيل أولاً.'
        });
      } else {
        showToast({
          type: 'info',
          title: 'تعديل الفاتورة مطلوب',
          message: 'الفاتورة في وضع العرض الآمن. اضغط على زر [تعديل الفاتورة] لتفعيل الإضافة.'
        });
      }
      return;
    }

    const salePrice = scannedItem.salePrice || scannedItem.retailPrice || scannedItem.consumerPrice || scannedItem.costPrice || 0;
    const itemTax = classification === 'TAX' ? (scannedItem.taxRate !== undefined ? scannedItem.taxRate : taxRate) : 0;

    setItems(prev => {
      // Check if this item is already in invoice lines
      const existingIndex = prev.findIndex(line => 
        (line.itemId && line.itemId === scannedItem.id) ||
        (line.itemCode && line.itemCode.toLowerCase() === (scannedItem.code || '').toLowerCase()) ||
        (line.description && line.description.trim().toLowerCase() === scannedItem.name.trim().toLowerCase())
      );

      if (existingIndex >= 0) {
        // Increment quantity
        const updated = [...prev];
        const existingLine = updated[existingIndex];
        if (existingLine) {
          const currentQty = Number(existingLine.quantity) || 0;
          updated[existingIndex] = {
            ...existingLine,
            quantity: currentQty + quantityToAdd,
            availableStock: scannedItem.stock ?? existingLine.availableStock ?? 0,
            costPrice: scannedItem.costPrice ?? existingLine.costPrice ?? 0
          };
        }
        return updated;
      }

      // Check if the only existing row is empty placeholder
      if (prev.length === 1 && !prev[0].description && (!prev[0].unitPrice || Number(prev[0].unitPrice) === 0)) {
        return [{
          id: prev[0].id || ('item-' + Date.now()),
          itemId: scannedItem.id,
          itemCode: scannedItem.code,
          description: scannedItem.name,
          quantity: quantityToAdd,
          unitPrice: salePrice,
          taxRate: itemTax,
          availableStock: scannedItem.stock ?? 0,
          costPrice: scannedItem.costPrice ?? 0,
          unit: scannedItem.unit || 'حبة'
        }];
      }

      // Append new line
      const newItemId = 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      return [
        ...prev,
        {
          id: newItemId,
          itemId: scannedItem.id,
          itemCode: scannedItem.code,
          description: scannedItem.name,
          quantity: quantityToAdd,
          unitPrice: salePrice,
          taxRate: itemTax,
          availableStock: scannedItem.stock ?? 0,
          costPrice: scannedItem.costPrice ?? 0,
          unit: scannedItem.unit || 'حبة'
        }
      ];
    });

    showToast({
      type: 'success',
      title: 'تم مسح وإدراج الصنف',
      message: `${scannedItem.name} (كود: ${scannedItem.code}) - تم إدراجه بالفاتورة.`
    });
  };

  const handleRemoveItem = (id: string) => {
    if (!isEditable) {
      if (status === 'POSTED') {
        showToast({
          type: 'warning',
          title: 'الفاتورة مرحلة ومقفلة',
          message: 'لا يمكن حذف الأصناف من فاتورة مرحلة. يرجى إلغاء الترحيل أولاً.'
        });
      } else {
        showToast({
          type: 'info',
          title: 'تعديل الفاتورة مطلوب',
          message: 'اضغط على زر [تعديل الفاتورة] بالأعلى لتفعيل حذف وتعديل الأصناف.'
        });
      }
      return;
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

  const getCustomerDefaultPricingTier = useCallback((customerGrade?: string): 'CONSUMER' | 'SEMI_WHOLESALE' | 'WHOLESALE' => {
    if (!customerGrade) return 'CONSUMER';
    const grade = customerGrade.trim().toLowerCase();
    if (grade.includes('جملة') && !grade.includes('نصف')) return 'WHOLESALE';
    if (grade.includes('موزع') || grade.includes('نصف')) return 'SEMI_WHOLESALE';
    return 'CONSUMER';
  }, []);

  const getTierPriceForItem = useCallback((matched: Item, tier: 'CONSUMER' | 'SEMI_WHOLESALE' | 'WHOLESALE'): number => {
    if (tier === 'WHOLESALE') {
      return Number(matched.wholesalePrice) || Number(matched.retailPrice) || Number(matched.consumerPrice) || Number(matched.salePrice) || 0;
    }
    if (tier === 'SEMI_WHOLESALE') {
      return Number(matched.semiWholesalePrice) || Number(matched.wholesalePrice) || Number(matched.retailPrice) || Number(matched.consumerPrice) || Number(matched.salePrice) || 0;
    }
    return Number(matched.consumerPrice) || Number(matched.retailPrice) || Number(matched.salePrice) || 0;
  }, []);

  const handleSetRowPricingTier = (rowId: string, tier: 'CONSUMER' | 'SEMI_WHOLESALE' | 'WHOLESALE') => {
    if (!isEditable) return;
    setItems(prev => prev.map(item => {
      if (item.id !== rowId) return item;
      const matched = itemsCatalog.find(c => 
        (item.itemId && c.id === item.itemId) || 
        (item.itemCode && c.code === item.itemCode) || 
        ((c.name || '').trim().toLowerCase() === (item.description || '').trim().toLowerCase())
      );
      const newPrice = matched ? getTierPriceForItem(matched, tier) : item.unitPrice;
      return {
        ...item,
        pricingTier: tier,
        ...(newPrice > 0 ? { unitPrice: newPrice } : {})
      };
    }));
  };

  const handleUpdateItem = (id: string, updates: Partial<InvoiceItem>) => {
    if (!isEditable) return;
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleItemChange = (id: string, field: keyof InvoiceItem, value: string | number) => {
    if (!isEditable) return;
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'description' && typeof value === 'string' && value.trim()) {
        const desc = value.trim().toLowerCase();
        const matched = itemsCatalog.find(c => (c.name || '').trim().toLowerCase() === desc || (c.code || '').toLowerCase() === desc);
        if (matched) {
          if (matched.unit) updated.unit = matched.unit;
          if (matched.id) updated.itemId = matched.id;
          if (matched.code) updated.itemCode = matched.code;
          if (matched.stock !== undefined) updated.availableStock = matched.stock;
          if (matched.costPrice !== undefined) updated.costPrice = matched.costPrice;
          
          const defaultTier = updated.pricingTier || getCustomerDefaultPricingTier(selectedPartner?.customerGrade);
          updated.pricingTier = defaultTier;
          const tierPrice = getTierPriceForItem(matched, defaultTier);
          const salePrice = tierPrice > 0 ? tierPrice : (matched.salePrice || matched.retailPrice || matched.consumerPrice || matched.costPrice || 0);
          if (salePrice > 0 && (!updated.unitPrice || Number(updated.unitPrice) === 0)) {
            updated.unitPrice = salePrice;
          }
        }
      }
      return updated;
    }));
  };

  const totals = useMemo(() => {
    let grossItemsTotal = 0;
    let itemsDiscountTotal = 0;
    let subtotal = 0;
    let taxTotal = 0;
    let totalCost = 0;

    items.forEach(item => {
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const grossLine = qty * unitPrice;
      grossItemsTotal += grossLine;

      const itemDisc = Number(item.itemDiscount) || 0;
      const itemDiscAmount = item.itemDiscountType === 'PERCENT'
        ? (grossLine * (Math.max(0, Math.min(100, itemDisc)) / 100))
        : Math.min(grossLine, Math.max(0, itemDisc));
      
      const netLine = Math.max(0, grossLine - itemDiscAmount);
      itemsDiscountTotal += itemDiscAmount;
      subtotal += netLine;

      const taxRate = classification === 'TAX' ? (Number(item.taxRate) || 0) : 0;
      const lineTax = netLine * (taxRate / 100);
      taxTotal += lineTax;

      const itemInfo = resolveItemStockAndCost(item, itemsCatalog, source, status === 'POSTED' || !isEditMode);
      totalCost += qty * itemInfo.costPrice;
    });

    // Invoice level general discount
    const rawDisc = Number(discount) || 0;
    const generalDiscountAmount = discountType === 'PERCENT'
      ? (subtotal * (Math.max(0, Math.min(100, rawDisc)) / 100))
      : Math.min(subtotal, Math.max(0, rawDisc));

    const totalDiscounts = itemsDiscountTotal + generalDiscountAmount;
    const servicesTotal = Math.max(0, Number(servicesFee) || 0);

    // If general discount applied, adjust tax proportionally for TAX classification
    let effectiveTax = taxTotal;
    if (subtotal > 0 && generalDiscountAmount > 0 && classification === 'TAX') {
      const discountRatio = Math.max(0, 1 - (generalDiscountAmount / subtotal));
      effectiveTax = taxTotal * discountRatio;
    }

    const taxableBase = Math.max(0, subtotal - generalDiscountAmount + servicesTotal);
    const grandTotal = Math.max(0, taxableBase + effectiveTax);
    const grossProfit = subtotal + servicesTotal - totalCost - generalDiscountAmount;
    const profitMargin = (subtotal + servicesTotal) > 0 ? (grossProfit / (subtotal + servicesTotal)) * 100 : 0;

    const cleanPaid = Math.max(0, Math.min(grandTotal, Number(paidAmount) || 0));
    const remainingBalance = Math.max(0, grandTotal - cleanPaid);

    return { 
      grossItemsTotal,
      subtotal, // Total after item discounts
      taxTotal: effectiveTax, 
      discountTotal: generalDiscountAmount,
      itemsDiscountTotal,
      totalDiscounts,
      servicesTotal,
      taxableBase,
      grandTotal,
      totalCost,
      grossProfit,
      profitMargin,
      cashPaid: cleanPaid,
      remainingBalance
    };
  }, [items, classification, itemsCatalog, paidAmount, discount, discountType, servicesFee]);

  // Handler when user edits paid amount
  const handlePaidAmountChange = (val: number | string) => {
    if (val === '') {
      setPaidAmount('');
      return;
    }
    const safeVal = Math.max(0, Number(val) || 0);
    setPaidAmount(safeVal);

    if (totals.grandTotal > 0) {
      if (safeVal >= totals.grandTotal - 0.001) {
        setInvoiceType('CASH_SALES');
      } else if (safeVal > 0.001) {
        setInvoiceType('PARTIAL_SALES');
      } else {
        setInvoiceType('CREDIT_SALES');
      }
    }
  };

  // Handler when user selects invoiceType manually from the dropdown
  const handleInvoiceTypeChange = (typeVal: string) => {
    setInvoiceType(typeVal);
    if (typeVal === 'CASH_SALES' || typeVal === 'CASH_RETURN') {
      setPaidAmount(totals.grandTotal);
    } else if (typeVal === 'CREDIT_SALES' || typeVal === 'CREDIT_RETURN' || typeVal === 'QUOTATION') {
      setPaidAmount(0);
    } else if (typeVal === 'PARTIAL_SALES' || typeVal === 'PARTIAL_RETURN') {
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
      'CUSTOMER',
      selectedPartnerStatement,
      invoiceType?.includes('RETURN') || false
    );
  }, [selectedPartner, totals.grandTotal, paidAmount, invoiceNumber, selectedPartnerStatement, invoiceType]);

  const currentInvoicePreviewData: PrintPreviewData = useMemo(() => ({
    title: classification === 'TAX' ? 'فاتورة مبيعات ضريبية' : 'فاتورة مبيعات عامة',
    subtitle: status === 'POSTED' ? 'معتمدة ومرحّلة' : 'مسودة فاتورة قيد الإعداد',
    docNumber: invoiceNumber,
    date: date,
    dueDate: dueDate,
    partnerName: selectedPartner?.name || 'عميل نقدي',
    partnerTaxNo: selectedPartner?.taxNumber,
    partnerPhone: selectedPartner?.phone,
    partnerAddress: (selectedPartner as { address?: string })?.address,
    partnerType: 'CUSTOMER',
    classification: classification,
    taxRate: classification === 'TAX' ? taxRate : 0,
    paymentMethod: getInvoiceTypeName(invoiceType),
    serviceType: serviceType || undefined,
    items: items.map(it => ({
      description: it.description || 'صنف مبيعات',
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      taxRate: it.taxRate,
      taxAmount: classification === 'TAX' ? (it.quantity * it.unitPrice * (it.taxRate / 100)) : 0,
      total: (it.quantity * it.unitPrice) * (1 + (classification === 'TAX' ? (it.taxRate / 100) : 0))
    })),
    subtotal: totals.subtotal,
    taxTotal: totals.taxTotal,
    discountTotal: totals.discountTotal,
    servicesTotal: totals.servicesTotal,
    grandTotal: totals.grandTotal,
    paidAmount: paidAmount,
    remainingBalance: Math.max(0, totals.grandTotal - paidAmount),
    paymentStatus: paidAmount >= totals.grandTotal - 0.001 && totals.grandTotal > 0 ? 'PAID' : paidAmount > 0.001 ? 'PARTIAL' : 'UNPAID',
    notes: notes,
    partnerBalanceImpact: partnerBalanceImpact
  }), [classification, status, invoiceNumber, date, dueDate, selectedPartner, invoiceType, items, totals, paidAmount, notes, partnerBalanceImpact]);

  const targetPreviewDataForWhatsApp: PrintPreviewData = whatsAppCustomInvoiceData || currentInvoicePreviewData;

  const generateSalesInvoiceWhatsAppMessage = useCallback((customData?: PrintPreviewData | null) => {
    const data = customData || targetPreviewDataForWhatsApp;
    const isTax = data.classification === 'TAX';
    const docTitle = isTax ? 'فاتورة مبيعات ضريبية معتمدة' : 'فاتورة مبيعات رسمية';
    const docNo = data.docNumber ? `#${data.docNumber}` : 'جديدة';
    const custName = data.partnerName || 'العميل الكريم';
    const totalNum = data.grandTotal || 0;
    const totalFormatted = `${totalNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencySymbol}`;
    
    // Clean tafqeet
    const rawTafqeet = totalNum > 0 ? tafqeet(totalNum).trim() : '';
    const cleanTafqeetBody = rawTafqeet
      .replace(/^فقط\s+/i, '')
      .replace(/\s+فقط\s+لا\s+غير$/i, '')
      .replace(/\s+لا\s+غير$/i, '')
      .trim();
    const tafqeetText = totalNum > 0 ? `${cleanTafqeetBody} فقط لا غير` : `صفر ${currencyFullNameAr || 'ريال'} فقط لا غير`;

    const itemsLines = (data.items || []).map((it, idx) => {
      const q = it.quantity ?? 1;
      const p = it.unitPrice ?? 0;
      const t = it.total ?? (q * p);
      return `• ${it.description} (${q} × ${p.toLocaleString('en-US', { minimumFractionDigits: 2 })} = ${t.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currencySymbol})`;
    }).join('\n');

    const currSettings = getSystemSettings();
    const bankInfo = currSettings.bankName && (currSettings.bankAccountIban || currSettings.bankAccountNumber)
      ? `\n💳 *بيانات السداد والتحويل البنكي:*\n• البنك: ${currSettings.bankName}${currSettings.bankAccountIban ? `\n• الآيبان (IBAN): ${currSettings.bankAccountIban}` : ''}${currSettings.bankAccountNumber ? `\n• رقم الحساب: ${currSettings.bankAccountNumber}` : ''}`
      : '';

    return `🏢 *${currSettings.companyNameAr || 'منظومة المبيعات'}*
🧾 *${docTitle}*
━━━━━━━━━━━━━━━━━━━━
📄 *رقم الفاتورة:* ${docNo}
📅 *التاريخ:* ${data.date || new Date().toISOString().split('T')[0]}
👤 *العميل:* ${custName}${data.partnerTaxNo ? `\n🏷️ *الرقم الضريبي:* ${data.partnerTaxNo}` : ''}

🛒 *الأصناف والخدمات:*
${itemsLines || '• تفاصيل الفاتورة مسجلة ومرفقة'}
━━━━━━━━━━━━━━━━━━━━
📊 *الملخص المالي:*
• الإجمالي قبل الضريبة: ${(data.subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currencySymbol}
${isTax ? `• ضريبة القيمة المضافة (15%): ${(data.taxTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currencySymbol}\n` : ''}💰 *الإجمالي المستحق:* ${totalFormatted}
✍️ *المبلغ بالحروف:* ${tafqeetText}
${(data.paidAmount ?? 0) > 0 ? `• المدفوع: ${(data.paidAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currencySymbol}\n• المتبقي: ${(data.remainingBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currencySymbol}\n` : ''}${bankInfo}

يرجى مراجعة ومطابقة الفاتورة.
شاكرين ومقدرين حسن تعاملكم معنا.`;
  }, [targetPreviewDataForWhatsApp, currencySymbol, currencyFullNameAr, tafqeet]);

  const handleOpenWhatsAppModal = (invoiceOverride?: StoredSalesInvoice) => {
    let previewDataToUse: PrintPreviewData;
    let recipientPhone = '';

    if (invoiceOverride) {
      previewDataToUse = {
        title: invoiceOverride.classification === 'TAX' ? 'فاتورة مبيعات ضريبية' : 'فاتورة مبيعات عامة',
        docNumber: invoiceOverride.invoiceNumber,
        date: invoiceOverride.date,
        dueDate: invoiceOverride.dueDate,
        partnerName: invoiceOverride.partnerName,
        classification: invoiceOverride.classification,
        items: invoiceOverride.items.map(it => ({
          description: it.description || 'صنف مبيعات',
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          taxRate: it.taxRate,
          taxAmount: invoiceOverride.classification === 'TAX' ? (it.quantity * it.unitPrice * (it.taxRate / 100)) : 0,
          total: (it.quantity * it.unitPrice) * (1 + (invoiceOverride.classification === 'TAX' ? (it.taxRate / 100) : 0))
        })),
        subtotal: invoiceOverride.totals.subtotal,
        taxTotal: invoiceOverride.totals.taxTotal,
        discountTotal: invoiceOverride.totals.discountTotal,
        servicesTotal: invoiceOverride.totals.servicesTotal,
        grandTotal: invoiceOverride.totals.grandTotal,
        paidAmount: invoiceOverride.paidAmount,
        remainingBalance: Math.max(0, invoiceOverride.totals.grandTotal - (invoiceOverride.paidAmount || 0)),
        paymentStatus: (invoiceOverride.paidAmount || 0) >= invoiceOverride.totals.grandTotal - 0.001 ? 'PAID' : (invoiceOverride.paidAmount || 0) > 0.001 ? 'PARTIAL' : 'UNPAID',
        notes: invoiceOverride.notes,
        paymentMethod: getInvoiceTypeName(invoiceOverride.invoiceType),
        serviceType: invoiceOverride.serviceType
      };
      const p = customers.find(c => c.id === invoiceOverride.partnerId || c.name === invoiceOverride.partnerName);
      recipientPhone = (p?.phone || '').replace(/[^\d+]/g, '');
    } else {
      if (items.length === 0) {
        showToast({
          type: 'warning',
          title: 'الفاتورة فارغة',
          message: 'يرجى إضافة أصناف إلى الفاتورة أولاً قبل إرسالها عبر الواتساب.'
        });
        return;
      }
      previewDataToUse = currentInvoicePreviewData;
      recipientPhone = (selectedPartner?.phone || '').replace(/[^\d+]/g, '');
    }

    setWhatsAppCustomInvoiceData(previewDataToUse);
    setWhatsAppRecipientPhone(recipientPhone);
    setWhatsAppMessageText(generateSalesInvoiceWhatsAppMessage(previewDataToUse));
    setIsEditingWhatsAppText(false);
    setIsCopiedWhatsAppText(false);
    setShowWhatsAppModal(true);
  };

  const handleSendWhatsAppText = () => {
    const text = whatsAppMessageText || generateSalesInvoiceWhatsAppMessage(targetPreviewDataForWhatsApp);
    let phone = whatsAppRecipientPhone.replace(/[^\d]/g, '');
    if (phone.startsWith('05') && phone.length === 10) {
      phone = '966' + phone.substring(1);
    }
    const waUrl = phone 
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleCopyWhatsAppText = async () => {
    const text = whatsAppMessageText || generateSalesInvoiceWhatsAppMessage(targetPreviewDataForWhatsApp);
    try {
      await navigator.clipboard.writeText(text);
      setIsCopiedWhatsAppText(true);
      setTimeout(() => setIsCopiedWhatsAppText(false), 2500);
    } catch {
      showToast({ type: 'info', title: 'تم نسخ النص', message: 'تم نسخ نص الفاتورة للحافظة بنجاح.' });
    }
  };

  const handleResetWhatsAppText = () => {
    setWhatsAppMessageText(generateSalesInvoiceWhatsAppMessage(targetPreviewDataForWhatsApp));
  };

  const handleSendWhatsAppPdf = async () => {
    try {
      setIsGeneratingPdfForWhatsApp(true);
      const activeData = targetPreviewDataForWhatsApp;
      const isTax = activeData.classification === 'TAX';
      const cleanDocNo = (activeData.docNumber || 'جديدة').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanPartner = (activeData.partnerName || 'عميل').replace(/\s+/g, '_');
      const filename = `فاتورة_${isTax ? 'ضريبية_' : ''}${cleanDocNo}_${cleanPartner}.pdf`;

      const element = whatsAppPdfElementRef.current || document.getElementById('certified-invoice-document');
      if (!element) {
        throw new Error('تعذر العثور على نموذج الفاتورة المعتمد لتصدير PDF');
      }

      const companionText = `مرحباً بك، مرفق لكم ${isTax ? 'فاتورة المبيعات الضريبية' : 'فاتورة المبيعات'} رقم #${activeData.docNumber || ''} بقيمة إجمالية ${Number(activeData.grandTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currencySymbol}.`;

      let phone = whatsAppRecipientPhone.replace(/[^\d]/g, '');
      if (phone.startsWith('05') && phone.length === 10) {
        phone = '966' + phone.substring(1);
      }

      const result = await exportElementToPdf(element, {
        filename,
        format: 'A4',
        colorMode: 'color'
      });

      // If Web Share API with files is supported (Mobile / Modern Browsers):
      if (result.blob && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
        try {
          const pdfFile = new File([result.blob], filename, { type: 'application/pdf' });
          if (navigator.canShare({ files: [pdfFile] })) {
            await navigator.share({
              title: `فاتورة مبيعات #${activeData.docNumber || ''}`,
              text: companionText,
              files: [pdfFile]
            });
            setIsGeneratingPdfForWhatsApp(false);
            return;
          }
        } catch (e: any) {
          if (e.name !== 'AbortError') {
            console.warn('Web Share failed, falling back:', e);
          }
        }
      }

      // Fallback: Open WhatsApp with companion message
      const waUrl = phone 
        ? `https://wa.me/${phone}?text=${encodeURIComponent(companionText)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(companionText)}`;
      window.open(waUrl, '_blank');

      showToast({
        type: 'success',
        title: 'تم تصدير ملف الـ PDF بنجاح 📄',
        message: 'تم تنزيل ملف الفاتورة على جهازك وفتح محادثة الواتساب لإرفاقه مباشرة.'
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'تعذر تصدير الفاتورة كـ PDF',
        message: err.message || 'حدث خطأ أثناء معالجة ملف الفاتورة.'
      });
    } finally {
      setIsGeneratingPdfForWhatsApp(false);
    }
  };

  const handleExportPdf = () => {
    setCustomPreviewData(null);
    setShowPrintPreview(true);
    showToast({
      type: 'info',
      title: 'معاينة الفاتورة للطباعة والـ PDF',
      message: 'يمكنك اختيار المقاس المناسب والضغط على [طباعة الآن] أو [تصدير PDF] لحفظها فوراً دون أي تأخير.'
    });
  };

  const saveInvoiceToDb = (isPosting: boolean): boolean => {
    if (!partnerId) {
      setHasPartnerError(true);
      showToast({
        type: 'warning',
        title: 'يرجى اختيار العميل أولاً',
        message: 'حدد العميل المسجل بالحساب لإتمام حفظ أو ترحيل الفاتورة.'
      });
      const el = document.getElementById('sales-partner-select');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
      return false;
    }

    // Check fiscal period lock
    const lockCheck = checkDateIsLocked(date);
    if (lockCheck.isLocked) {
      showToast({
        type: 'error',
        title: 'الفترة المالية مقفلة ومحمية 🔒',
        message: lockCheck.reason || 'لا يمكن حفظ أو تعديل الفواتير في فترة مالية مقفلة.'
      });
      return false;
    }

    const finalNumber = (invoiceNumber || '').trim() || nextCalculatedInvoiceNum;
    if (!finalNumber) {
      showToast({
        type: 'error',
        title: 'رقم الفاتورة فارغ',
        message: 'يرجى إدخال رقم الفاتورة أو الضغط على زر توليد تلقائي.'
      });
      return false;
    }
    
    // Check duplication
    if (!editingInvoiceId) {
      const isDuplicate = savedInvoices.some(i => i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === finalNumber.toLowerCase());
      if (isDuplicate) {
        setInvoiceNumberError(`رقم الفاتورة (${finalNumber}) مستخدم مسبقاً!`);
        showToast({
          type: 'error',
          title: 'رقم الفاتورة مستخدم مسبقاً',
          message: `تم اقتراح الرقم التسلسلي التالي (#${nextCalculatedInvoiceNum}).`
        });
        setInvoiceNumber(nextCalculatedInvoiceNum);
        return false;
      }
    } else {
      const isDuplicate = savedInvoices.some(i => i.id !== editingInvoiceId && i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === finalNumber.toLowerCase());
      if (isDuplicate) {
        setInvoiceNumberError(`رقم الفاتورة (${finalNumber}) مستخدم مسبقاً في فاتورة أخرى!`);
        showToast({
          type: 'error',
          title: 'رقم الفاتورة مكرر',
          message: `رقم الفاتورة (${finalNumber}) مستخدم مسبقاً في فاتورة أخرى في النظام!`
        });
        return false;
      }
    }

    // Check items
    const hasValidItem = items.some(it => (it.description && it.description.trim()) || (it.unitPrice > 0));
    if (!hasValidItem) {
      showToast({
        type: 'warning',
        title: 'تنبيه الأصناف',
        message: 'يرجى إضافة صنف واحد على الأقل مع تحديد السعر أو الوصف.'
      });
      return false;
    }

    const newId = editingInvoiceId || 'inv-' + Date.now();
    const partnerObj = customers.find(p => p.id === partnerId);
    const sanitizedItems: InvoiceItem[] = items.map(it => ({
      ...it,
      quantity: Math.max(1, Number(it.quantity) || 1),
      unitPrice: Math.max(0, Number(it.unitPrice) || 0),
      taxRate: classification === 'TAX' ? Math.max(0, Number(it.taxRate) || 0) : 0
    }));
    const invoiceRecord: StoredSalesInvoice = {
      id: newId,
      invoiceNumber: finalNumber,
      date,
      dueDate,
      partnerId,
      partnerName: partnerObj?.name || 'عميل نقدي',
      classification,
      taxRate: classification === 'TAX' ? (Number(taxRate) || 0) : 0,
      invoiceType,
      source,
      safe,
      costCenterId: costCenterId || undefined,
      items: sanitizedItems,
      totals,
      status: isPosting ? 'POSTED' : 'DRAFT',
      notes,
      partnerBalanceSnapshot: partnerBalanceSnapshot !== null ? partnerBalanceSnapshot : (selectedPartnerStatement?.netBalance ?? 0),
        createdAt: new Date().toISOString()
    };

    let updatedInvoices: StoredSalesInvoice[];
    if (editingInvoiceId) {
      updatedInvoices = savedInvoices.map(inv => inv.id === editingInvoiceId ? invoiceRecord : inv);
    } else {
      updatedInvoices = [
        invoiceRecord,
        ...savedInvoices.filter(i => i.invoiceNumber.trim().toLowerCase() !== finalNumber.toLowerCase())
      ];
      advanceSequenceAfterSave('salesInvoice', finalNumber);
    }

    const prePostingBalance = partnerBalanceSnapshot !== null ? partnerBalanceSnapshot : (selectedPartnerStatement?.netBalance ?? 0);
    invoiceRecord.partnerBalanceSnapshot = prePostingBalance;
    setPartnerBalanceSnapshot(prePostingBalance);

    setEditingInvoiceId(newId);
    setSavedInvoices(updatedInvoices);
    try {
      localStorage.setItem(DB_SALES_INVOICES_KEY, JSON.stringify(updatedInvoices));
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
      setIsEditMode(true); // Keep in edit mode so user can continue working seamlessly
      showToast({
        type: 'success',
        title: `تم حفظ فاتورة المبيعات رقم (${invoiceNumber || nextCalculatedInvoiceNum}) كمسودة بنجاح!`,
        message: 'يمكنك مواصلة تحرير الفاتورة أو ترحيلها في أي وقت.'
      });
    }
  };

  const handlePost = () => {
    if (saveInvoiceToDb(true)) {
      setStatus('POSTED');
      setIsEditMode(false);
      const updatedList = deductItemsStockOnSale(items, source);
      if (updatedList.length > 0) {
        setItemsCatalog(updatedList);
      }
      showToast({
        type: 'success',
        title: `تم ترحيل فاتورة المبيعات رقم (${invoiceNumber || nextCalculatedInvoiceNum}) بنجاح!`,
        message: 'تم ترحيل الفاتورة وتحديث أرصدة المخزون وحساب العميل وقفلها ضد التعديل.'
      });
    }
  };

  const handleUnpost = () => {
    if (status !== 'POSTED') return;

    // Restore stock that was deducted when posted
    const restoredItems = restoreItemsStockOnSaleUnpost(items);
    if (restoredItems.length > 0) {
      setItemsCatalog(restoredItems);
    }

    setStatus('DRAFT');
    setIsEditMode(true); // Switch to edit mode immediately upon unposting

    // Persist unposted status in database
    const finalNumber = invoiceNumber.trim();
    const updatedInvoices = savedInvoices.map(inv => {
      if ((editingInvoiceId && inv.id === editingInvoiceId) || inv.invoiceNumber === finalNumber) {
        return { ...inv, status: 'DRAFT' as const };
      }
      return inv;
    });
    setSavedInvoices(updatedInvoices);
    try {
      localStorage.setItem(DB_SALES_INVOICES_KEY, JSON.stringify(updatedInvoices));
      notifyDataChanged();
      dispatchPartnerLedgerUpdated();
    } catch (err) {
      console.error(err);
    }

    showToast({
      type: 'info',
      title: 'تم إلغاء ترحيل الفاتورة بنجاح',
      message: 'تمت استعادة الفاتورة كمسودة واسترجاع كميات المخزون، والوضع مهيأ للتعديل الآن.'
    });
  };

  const handleDelete = () => {
    const isExisting = editingInvoiceId || savedInvoices.some(i => i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === invoiceNumber.trim().toLowerCase());
    const targetInv = savedInvoices.find(i => (editingInvoiceId && i.id === editingInvoiceId) || (i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === invoiceNumber.trim().toLowerCase()));
    const isPostedInvoice = status === 'POSTED' || (targetInv && targetInv.status === 'POSTED');

    setDeleteModal({
      isOpen: true,
      invoiceId: editingInvoiceId || undefined,
      invoiceNumber: invoiceNumber.trim() || 'المسودة الحالية',
      isNewDraft: !isExisting,
      isPosted: isPostedInvoice
    });
  };

  const confirmExecuteDelete = () => {
    if (!deleteModal) return;

    if (deleteModal.isNewDraft) {
      handleNewInvoice();
      setDeleteModal(null);
      showToast({
        type: 'info',
        title: 'تم إفراغ وإعادة ضبط المسودة',
        message: 'تمت إفراغ الحقول والبدء بفاتورة جديدة فارغة.'
      });
      return;
    }

    const targetNumber = deleteModal.invoiceNumber;
    const targetId = deleteModal.invoiceId;
    const targetInv = savedInvoices.find(i => (targetId && i.id === targetId) || (i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === targetNumber.trim().toLowerCase()));

    // If invoice was posted, restore items back into stock
    if (targetInv && targetInv.status === 'POSTED' && targetInv.items && targetInv.items.length > 0) {
      const restored = restoreItemsStockOnSaleUnpost(targetInv.items);
      if (restored.length > 0) {
        setItemsCatalog(restored);
      }
    }

    const updated = savedInvoices.filter(i => {
      if (targetId && i.id === targetId) return false;
      if (i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === targetNumber.trim().toLowerCase()) return false;
      return true;
    });

    setSavedInvoices(updated);
    try {
      localStorage.setItem(DB_SALES_INVOICES_KEY, JSON.stringify(updated));
      notifyDataChanged();
      dispatchPartnerLedgerUpdated();
    } catch (err) {
      console.error(err);
    }

    if (editingInvoiceId === targetId || invoiceNumber.trim().toLowerCase() === targetNumber.trim().toLowerCase()) {
      handleNewInvoice(updated);
    }

    showToast({
      type: 'success',
      title: 'تم حذف الفاتورة بنجاح',
      message: `تم حذف الفاتورة رقم (${targetNumber}) وتحديث الحسابات والمخزون.`
    });
    setDeleteModal(null);
  };

  // Global Keyboard Shortcuts (Ctrl+S, Ctrl+P, Ctrl+N, Ctrl+Enter, F2, Ctrl+H, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.key) return;
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Avoid intercepting shortcuts inside standard typing if not with ctrl/cmd/alt/function keys
      // Ctrl + S / Cmd + S: Save Draft or Start Edit
      if (isCtrlOrCmd && key === 's') {
        e.preventDefault();
        if (status === 'POSTED') {
          alert('⚠️ الفاتورة مرحلة ومعتمدة نظامياً!\n\nيجب أولاً الضغط على زر [إلغاء الترحيل]، ثم تعديل الفاتورة وحفظها.');
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

      // F3 or Alt + B: Open Camera Barcode Scanner
      if (e.key === 'F3' || ((isCtrlOrCmd || e.altKey) && key === 'b')) {
        e.preventDefault();
        setShowBarcodeScannerModal(true);
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
        if (showBarcodeScannerModal) {
          setShowBarcodeScannerModal(false);
        } else if (showPrintPreview) {
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
        <Loader2 size={36} className="text-blue-600 animate-spin mb-3" />
        <h3 className="text-sm font-bold text-slate-800">جاري فتح شاشة فواتير المبيعات...</h3>
        <p className="text-xs text-slate-400 mt-1">يتم قراءة سجل الفواتير ودليل الأصناف بأمان وسلاسة</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full w-full px-4 md:px-6" dir="rtl">
      {/* Compact Unified Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2 sm:p-2.5 shadow-xs mb-3 print:hidden">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Navigation & Status Group */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Stepper Navigation */}
            <div className="flex items-center bg-slate-100 border border-slate-300 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={handleNavigateFirst}
                disabled={!canGoFirst}
                className="p-1 text-slate-700 hover:text-blue-900 hover:bg-white disabled:opacity-30 rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
                title="الفاتورة الأولى (الأقدم)"
              >
                <ChevronsRight size={13} />
              </button>
              <button
                type="button"
                onClick={handleNavigatePrevious}
                disabled={!canGoPrevious}
                className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-slate-800 bg-white hover:bg-slate-50 hover:text-blue-900 disabled:opacity-30 rounded transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-200 shadow-2xs"
                title="الفاتورة السابقة (PageUp)"
              >
                <ChevronRight size={13} className="text-blue-700" />
                <span className="hidden sm:inline">السابق</span>
              </button>
              <div className="px-2 py-0.5 text-xs font-mono font-bold text-blue-950 bg-blue-50/90 rounded mx-0.5 select-none border border-blue-200 shadow-2xs whitespace-nowrap">
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
                className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-slate-800 bg-white hover:bg-slate-50 hover:text-blue-900 disabled:opacity-30 rounded transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-200 shadow-2xs"
                title="الفاتورة التالية (PageDown)"
              >
                <span className="hidden sm:inline">التالي</span>
                <ChevronLeft size={13} className="text-blue-700" />
              </button>
              <button
                type="button"
                onClick={handleNavigateLast}
                disabled={!canGoLast}
                className="p-1 text-slate-700 hover:text-blue-900 hover:bg-white disabled:opacity-30 rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
                title="الفاتورة الأخيرة (الأحدث)"
              >
                <ChevronsLeft size={13} />
              </button>
            </div>

            {/* Invoice Status Pill */}
            <span className={`px-2 py-1 text-xs font-bold rounded-lg border shadow-2xs ${
              status === 'POSTED'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : isEditMode
                ? 'bg-blue-50 text-blue-950 border-blue-300'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}>
              {status === 'POSTED' ? 'مرحلة ومعتمدة' : isEditMode ? 'مسودة قيد التحرير' : 'مسودة (عرض)'}
            </span>

            {editingInvoiceId && isEditMode && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="h-8 px-2 text-xs font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1 transition-all"
                title="إلغاء التعديل والعودة"
              >
                <X size={13} /> <span>إلغاء التعديل</span>
              </button>
            )}
          </div>

          {/* Action Operations Toolbar - Calm, Clear & Unified Output Group */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Primary & Secondary Workflow Actions */}
            <div className="flex items-center gap-1.5">
              {/* Post / Unpost (Primary Action) */}
              {status === 'DRAFT' ? (
                <button
                  type="button"
                  onClick={handlePost}
                  className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-black shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
                  title="ترحيل الفاتورة واعتمادها نهائياً (Ctrl+Enter)"
                >
                  <CheckCircle2 size={15} />
                  <span>ترحيل</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleUnpost}
                  className="h-8 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
                  title="إلغاء الترحيل وإعادتها لمسودة"
                >
                  <RotateCcw size={14} />
                  <span>إلغاء الترحيل</span>
                </button>
              )}

              {/* Save / Edit Draft (Secondary Action - Clean Outline) */}
              {status === 'DRAFT' && (
                !isEditMode ? (
                  <button
                    type="button"
                    onClick={handleStartEditInvoice}
                    className="h-8 px-3 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
                    title="تعديل الفاتورة (Ctrl+S)"
                  >
                    <Edit3 size={13} />
                    <span>تعديل</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
                    title="حفظ كمسودة (Ctrl+S)"
                  >
                    <Save size={14} className="text-slate-600" />
                    <span>حفظ كمسودة</span>
                  </button>
                )
              )}

              {/* New Invoice (Single clean button) */}
              <button
                type="button"
                onClick={handleNewInvoice}
                className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                title="فاتورة جديدة فارغة (Ctrl+N)"
              >
                <Plus size={14} className="text-white" />
                <span>جديد</span>
              </button>
            </div>

            {/* Unified Output Group (تجميع المخرجات بتصميم هادئ وموحد) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300 text-slate-700 shadow-2xs gap-1">
              <button
                type="button"
                onClick={() => {
                  setCustomPreviewData(null);
                  setPreviewAutoPrint(false);
                  setPreviewAutoPdf(false);
                  setShowPrintPreview(true);
                }}
                className="h-8 px-3 bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 border border-indigo-200 rounded-md text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
                title="معاينة الفاتورة قبل الطباعة"
              >
                <Eye size={14} className="text-indigo-600" />
                <span>معاينة</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomPreviewData(null);
                  setPreviewAutoPrint(true);
                  setPreviewAutoPdf(false);
                  setShowPrintPreview(true);
                }}
                className="h-8 px-2.5 hover:bg-white text-slate-700 hover:text-slate-900 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                title="طباعة الفاتورة مباشرة (Ctrl+P)"
              >
                <Printer size={14} className="text-slate-600" />
                <span>طباعة</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomPreviewData(null);
                  setPreviewAutoPrint(false);
                  setPreviewAutoPdf(true);
                  setShowPrintPreview(true);
                }}
                className="h-8 px-2.5 hover:bg-white text-slate-700 hover:text-rose-700 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                title="تصدير ملف PDF مباشر"
              >
                <FileDown size={14} className="text-rose-600" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenWhatsAppModal()}
                className="h-8 px-2.5 hover:bg-white text-slate-700 hover:text-emerald-700 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                title="إرسال الفاتورة عبر واتساب"
              >
                <MessageSquare size={14} className="text-emerald-600" />
                <span>واتساب</span>
              </button>
              <PrintDropdown
                onPreview={() => {
                  setCustomPreviewData(null);
                  setShowPrintPreview(true);
                }}
              />
            </div>

            {/* Auxiliary Tools: History & Delete */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowInvoicesHistory(!showInvoicesHistory)}
                className={`h-8 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all border ${
                  showInvoicesHistory
                    ? 'bg-blue-700 text-white border-blue-800 shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-2xs'
                }`}
                title="سجل الفواتير السابقة (Ctrl+H)"
              >
                <History size={13} />
                <span className="hidden md:inline">السجل</span>
                <span className={`px-1 py-0.2 rounded-full font-mono text-[10px] font-bold ${
                  showInvoicesHistory ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  {savedInvoices.length}
                </span>
              </button>

              <button
                type="button"
                onClick={handleDelete}
                className="h-8 px-2.5 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200 hover:border-rose-300 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                title="حذف الفاتورة أو إفراغ المسودة"
              >
                <Trash2 size={13} />
                <span>حذف</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* شريط مؤشر الربط المحاسبي المباشر بشجرة الحسابات */}
      <div className="bg-gradient-to-r from-emerald-50/90 via-teal-50/90 to-indigo-50/90 border border-emerald-200/90 rounded-2xl px-4 py-2 mb-3 flex items-center justify-between gap-3 text-xs print:hidden shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap text-emerald-950 font-medium">
          <span className="flex items-center gap-1.5 font-black text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            الربط المحاسبي المباشر بشجرة الحسابات:
          </span>
          <span className="bg-white/90 border border-emerald-200 px-2.5 py-0.5 rounded-lg text-[11px] font-mono text-slate-800 shadow-2xs">
            دائن: 4101 (إيرادات المبيعات)
          </span>
          <span className="bg-white/90 border border-emerald-200 px-2.5 py-0.5 rounded-lg text-[11px] font-mono text-slate-800 shadow-2xs">
            دائن: 2102 (ضريبة القيمة المضافة)
          </span>
          <span className="bg-white/90 border border-emerald-200 px-2.5 py-0.5 rounded-lg text-[11px] font-mono text-slate-800 shadow-2xs">
            مدين: {(invoiceType === 'CASH_SALES' || invoiceType === 'CASH' || invoiceType === 'SIMPLE_TAX_INVOICE' || paymentMethod === 'CASH') ? '1101 (الصندوق الرئيسي)' : '1201 (ذمم العملاء والمدينين)'}
          </span>
          <span className="bg-white/90 border border-emerald-200 px-2.5 py-0.5 rounded-lg text-[11px] font-mono text-slate-800 shadow-2xs">
            تكلفة المخزون: 5101 / 1301
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'chartTree' } }))}
            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 hover:underline flex items-center gap-1 cursor-pointer bg-white/70 px-2.5 py-1 rounded-lg border border-emerald-200/60"
            title="الانتقال لشجرة الحسابات المالية"
          >
            <span>شجرة الحسابات (4101) 🌳</span>
          </button>
        </div>
      </div>

{/* History Drawer */}
      {showInvoicesHistory && (
        <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm animate-fadeIn print:hidden">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <History size={16} className="text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">سجل فواتير المبيعات المسجلة</h3>
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
            <p className="text-xs text-slate-400 text-center py-6">لا توجد فواتير سابقة محفوظة بعد. الفاتورة القادمة ستبدأ برقم #{nextCalculatedInvoiceNum}.</p>
          ) : (
            <div className="overflow-x-auto max-h-60">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400">
                    <th className="pb-2 font-semibold">رقم الفاتورة</th>
                    <th className="pb-2 font-semibold">العميل</th>
                    <th className="pb-2 font-semibold">التاريخ</th>
                    <th className="pb-2 font-semibold">النوع</th>
                    <th className="pb-2 font-semibold">الإجمالي</th>
                    <th className="pb-2 font-semibold">الحالة</th>
                    <th className="pb-2 font-semibold text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {savedInvoices.map(inv => (
                    <tr key={inv.id} className={`hover:bg-slate-50 transition-colors ${editingInvoiceId === inv.id ? 'bg-blue-50/50' : ''}`}>
                      <td className="py-2.5 font-mono font-bold text-blue-600">{inv.invoiceNumber}</td>
                      <td className="py-2.5 text-slate-800 font-medium">{inv.partnerName}</td>
                      <td className="py-2.5 text-slate-500 font-mono">{inv.date}</td>
                      <td className="py-2.5 text-slate-600">{getInvoiceTypeName(inv.invoiceType)}</td>
                      <td className="py-2.5 font-mono font-bold text-slate-900">{inv.totals.grandTotal.toLocaleString()} {currencySymbol}</td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.status === 'POSTED' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
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
                                title: inv.classification === 'TAX' ? 'فاتورة مبيعات ضريبية' : 'فاتورة مبيعات عادية',
                                docNumber: inv.invoiceNumber,
                                date: inv.date,
                                dueDate: inv.dueDate,
                                partnerName: inv.partnerName,
                                classification: inv.classification,
                                items: inv.items.map(it => ({
                                  description: it.description || 'بند مبيعات',
                                  quantity: it.quantity,
                                  unitPrice: it.unitPrice,
                                  taxRate: it.taxRate,
                                  total: (it.quantity * it.unitPrice) * (1 + (inv.classification === 'TAX' ? (it.taxRate / 100) : 0))
                                })),
                                subtotal: inv.totals.subtotal,
                                taxTotal: inv.totals.taxTotal,
                                grandTotal: inv.totals.grandTotal,
                                notes: inv.notes,
                                paymentMethod: getInvoiceTypeName(inv.invoiceType),
                                serviceType: inv.serviceType,
                                discountTotal: inv.totals.discountTotal,
                                servicesTotal: inv.totals.servicesTotal
                              });
                              setShowPrintPreview(true);
                            }}
                            className="flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                            title="معاينة الفاتورة قبل الطباعة"
                          >
                            <Eye size={12} /> معاينة
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenWhatsAppModal(inv)}
                            className="flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                            title="إرسال الفاتورة عبر الواتساب (نص أو PDF)"
                          >
                            <MessageSquare size={12} /> واتساب
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
                            onClick={() => {
                              setDeleteModal({
                                isOpen: true,
                                invoiceId: inv.id,
                                invoiceNumber: inv.invoiceNumber,
                                isNewDraft: false,
                                isPosted: inv.status === 'POSTED'
                              });
                            }}
                            className="px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                            title="حذف الفاتورة من النظام"
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

      {/* Main Invoice Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1 print:border-none print:shadow-none">
        
        {/* Print Header (Visible Only on Print) */}
        <div className="hidden print:block p-8 border-b-2 border-slate-800">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{currSettings.company.nameAr || 'شركة لوجوستريا'}</h1>
              <p className="text-xs text-slate-500">{currSettings.company.branchName ? `${currSettings.company.branchName} - ` : ''}{currSettings.company.address || currSettings.company.city || 'المملكة العربية السعودية'}</p>
              {currSettings.company.vatNumber && <p className="text-xs text-slate-500 font-mono">الرقم الضريبي: {currSettings.company.vatNumber}</p>}
            </div>
            <div className="text-left">
              <h2 className="text-xl font-bold text-slate-900">
                {classification === 'TAX' ? 'فاتورة ضريبية' : 'فاتورة مبيعات'}
              </h2>
              <p className="text-sm font-bold font-mono text-slate-900 mt-1">رقم الفاتورة: {invoiceNumber}</p>
              <p className="text-xs text-slate-500 font-mono">تاريخ الإصدار: {date}</p>
            </div>
          </div>
        </div>

        {/* Clean, Flat Unified Parameters Grid (No box-in-a-box) */}
        <div className="bg-slate-50/70 border-b border-slate-200 p-3 sm:p-3.5 print:hidden">
          {/* Row 1: Customer Details, Invoice Number & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 text-xs mb-3">
            {/* Customer Select with Quick Action Bar (Col Span 5) */}
            <div className="lg:col-span-5 flex flex-col gap-1 justify-center">
              <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-slate-800 font-bold text-xs flex items-center gap-1 shrink-0">
                    <User size={13} className="text-blue-700" />
                    <span>العميل:</span>
                  </label>

                  {selectedPartner && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-slate-500 font-medium">
                        {status === 'POSTED' || !isEditMode ? 'الرصيد وقت الإصدار:' : 'الرصيد الحالي:'}
                      </span>
                      <span className={`font-mono font-bold ${
                        displayPartnerBalance > 0.01 
                          ? 'text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200' 
                          : displayPartnerBalance < -0.01
                          ? 'text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200'
                          : 'text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded'
                      }`}>
                        {Math.abs(displayPartnerBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                        {displayPartnerBalance > 0.01 ? ' (مدين عليه)' : displayPartnerBalance < -0.01 ? ' (دائن له)' : ' (خالص)'}
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="text-slate-500 font-medium">الحد الائتماني:</span>
                      <span className="font-mono font-bold text-slate-700">
                        {selectedPartner.creditLimit ? `${selectedPartner.creditLimit.toLocaleString()} ${currencySymbol}` : 'غير محدد'}
                      </span>
                      {selectedPartner.creditLimit && (selectedPartnerStatement?.netBalance || 0) > selectedPartner.creditLimit && (
                        <span className="text-[10px] text-rose-700 bg-rose-100 border border-rose-300 px-1.5 py-0.2 rounded font-bold animate-pulse">
                          ⚠️ تجاوز الحد!
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedPartnerForStatementModal(selectedPartner)}
                        className="text-[10px] text-blue-700 hover:underline font-bold px-1 shrink-0 cursor-pointer"
                        title="فتح كشف حساب تفصيلي"
                      >
                        كشف الحساب
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {selectedPartner?.customerGrade && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1 shadow-2xs">
                      <span>درجة العميل: {selectedPartner.customerGrade}</span>
                    </span>
                  )}
                  {selectedPartner?.taxNumber && (
                    <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      ضريبي: {selectedPartner.taxNumber}
                    </span>
                  )}
                  {hasPartnerError && (
                    <span className="text-rose-600 text-[10px] font-bold animate-pulse">
                      يرجى اختيار العميل
                    </span>
                  )}
                </div>
              </div>

              {/* Customer Select and Quick Add Button (+) */}
              <div className="flex items-center gap-1.5">
                <select
                  disabled={!isEditable}
                  required
                  value={partnerId}
                  onChange={e => {
                    const newId = e.target.value;
                    setPartnerId(newId);
                    if (newId) setHasPartnerError(false);
                    if (status === 'DRAFT') setPartnerBalanceSnapshot(null);

                    const newCust = customers.find(c => c.id === newId);
                    if (newCust?.customerGrade && isEditable) {
                      const newTier = getCustomerDefaultPricingTier(newCust.customerGrade);
                      setItems(prev => prev.map(row => {
                        if (!row.description || !row.description.trim()) return row;
                        const matched = itemsCatalog.find(c => 
                          (row.itemId && c.id === row.itemId) || 
                          (row.itemCode && c.code === row.itemCode) || 
                          ((c.name || '').trim().toLowerCase() === (row.description || '').trim().toLowerCase())
                        );
                        if (!matched) return row;
                        const p = getTierPriceForItem(matched, newTier);
                        return {
                          ...row,
                          pricingTier: newTier,
                          ...(p > 0 ? { unitPrice: p } : {})
                        };
                      }));
                    }
                  }}
                  className={`flex-1 h-10 bg-white border ${
                    hasPartnerError ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
                  } focus:border-blue-600 px-3 rounded-xl text-slate-900 font-bold text-xs sm:text-sm focus:outline-none disabled:bg-slate-100 shadow-2xs transition-colors`}
                >
                  <option value="">-- اختر العميل أو اضغط + للإضافة السريعة --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.customerGrade ? `(${c.customerGrade})` : ''}
                    </option>
                  ))}
                </select>
                {/* Quick Add Customer Button */}
                {isEditable && (
                  <button
                    type="button"
                    onClick={() => setShowQuickAddCustomerModal(true)}
                    className="h-10 px-3 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-2xs"
                    title="إضافة عميل جديد سريعاً دون مغادرة الفاتورة"
                  >
                    <Plus size={13} />
                    <span className="hidden sm:inline">عميل جديد</span>
                  </button>
                )}
              </div>
            </div>

            {/* Invoice Number (Col Span 3) - in Row 1 after Customer & New Customer button */}
            <div className="lg:col-span-3 flex flex-col gap-1 justify-center">
              <div className="flex items-center justify-between">
                <label className="text-slate-800 font-bold text-xs flex items-center gap-1.5">
                  <Hash size={13} className="text-indigo-600" />
                  <span>رقم الفاتورة:</span>
                </label>
                {status !== 'POSTED' && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = nextCalculatedInvoiceNum;
                      setInvoiceNumber(next);
                      setInvoiceNumberError(null);
                      showToast({ type: 'info', title: `تم تعيين الرقم: ${next}` });
                    }}
                    className="text-[10px] text-blue-700 hover:underline font-bold cursor-pointer"
                    title="توليد تلقائي"
                  >
                    تلقائي
                  </button>
                )}
              </div>
              <input
                type="text"
                disabled={!isEditable}
                value={invoiceNumber}
                onChange={e => {
                  setInvoiceNumber(e.target.value);
                  setInvoiceNumberError(null);
                }}
                className={`w-full h-10 bg-slate-100 border ${
                  invoiceNumberError ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
                } px-3 rounded-xl font-mono font-bold text-slate-900 text-center text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-blue-600 shadow-2xs transition-colors`}
                placeholder="INV-XXXX"
              />
              {invoiceNumberError && (
                <span className="text-[10px] font-bold text-rose-600 block truncate">
                  {invoiceNumberError}
                </span>
              )}
            </div>

            {/* Issue Date (Col Span 2) */}
            <div className="lg:col-span-2 flex flex-col gap-1 justify-center">
              <label className="text-slate-800 font-bold text-xs flex items-center gap-1">
                <Calendar size={13} className="text-blue-700" />
                <span>تاريخ الإصدار:</span>
              </label>
              <input
                type="date"
                disabled={!isEditable}
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 focus:border-blue-600 px-3 rounded-xl text-slate-900 font-mono font-bold text-xs sm:text-sm focus:outline-none disabled:bg-slate-100 shadow-2xs transition-colors"
              />
            </div>

            {/* Due Date (Col Span 2) */}
            <div className="lg:col-span-2 flex flex-col gap-1 justify-center">
              <label className="text-slate-800 font-bold text-xs flex items-center gap-1">
                <Calendar size={13} className="text-amber-600" />
                <span>تاريخ الاستحقاق:</span>
              </label>
              <input
                type="date"
                disabled={!isEditable}
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 focus:border-blue-600 px-3 rounded-xl text-slate-900 font-mono font-bold text-xs sm:text-sm focus:outline-none disabled:bg-slate-100 shadow-2xs transition-colors"
              />
            </div>
          </div>

          {/* Row 2: Parameters Grid (Payment Method, Safe, Tax & Classification, Warehouse, Service, Cost Center) - Below Customer Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            {/* 1. Payment Method */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-800 font-bold text-xs flex items-center gap-1.5">
                <CreditCard size={13} className="text-blue-600" />
                <span>طريقة السداد:</span>
              </label>
              <select
                disabled={!isEditable}
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as any)}
                className="w-full h-10 bg-white border border-slate-300 focus:border-blue-600 px-2.5 rounded-xl text-slate-900 font-bold text-xs sm:text-sm focus:outline-none disabled:bg-slate-100 shadow-2xs"
              >
                {PAYMENT_METHODS_LIST.map(pm => (
                  <option key={pm.id} value={pm.id}>{pm.label}</option>
                ))}
              </select>
            </div>

            {/* 2. Safe / Cashbox */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-800 font-bold text-xs flex items-center gap-1.5">
                <Landmark size={13} className="text-emerald-600" />
                <span>خزنة الدفع والسداد:</span>
              </label>
              <select
                disabled={!isEditable}
                value={safe}
                onChange={e => setSafe(e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 focus:border-blue-600 px-2.5 rounded-xl text-slate-900 font-bold text-xs sm:text-sm focus:outline-none disabled:bg-slate-100 shadow-2xs"
              >
                {dynamicSafesList.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* 3. Classification & Tax Rate */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-slate-800 font-bold text-xs flex items-center gap-1.5">
                  <Percent size={13} className="text-purple-600" />
                  <span>التصنيف والضريبة:</span>
                </label>
              </div>
              <div className="flex items-center gap-1">
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
                  className="w-full h-10 bg-white border border-slate-300 focus:border-blue-600 px-2.5 rounded-xl text-slate-900 font-bold text-xs sm:text-sm focus:outline-none disabled:bg-slate-100 shadow-2xs"
                >
                  <option value="TAX">فاتورة ضريبية</option>
                  <option value="NORMAL">فاتورة مبسطة / عادية</option>
                </select>
                {classification === 'TAX' && (
                  <input
                    type="number"
                    min="0"
                    max="100"
                    disabled={!isEditable}
                    value={taxRate}
                    onFocus={e => e.target.select()}
                    onChange={e => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setTaxRate('');
                        setItems(prev => prev.map(it => ({ ...it, taxRate: 0 })));
                      } else {
                        const val = Number(raw);
                        setTaxRate(val);
                        setItems(prev => prev.map(it => ({ ...it, taxRate: val })));
                      }
                    }}
                    className="w-14 h-10 bg-white border border-slate-300 focus:border-blue-600 px-1 rounded-xl text-center font-mono font-bold text-xs sm:text-sm shadow-2xs"
                    placeholder="15"
                  />
                )}
              </div>
            </div>

            {/* 4. Warehouse Source */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-800 font-bold text-xs flex items-center gap-1.5">
                <Warehouse size={13} className="text-amber-600" />
                <span>مستودع التوريد:</span>
              </label>
              <select
                disabled={!isEditable}
                value={source}
                onChange={e => setSource(e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 focus:border-blue-600 px-2.5 rounded-xl text-slate-900 font-bold text-xs sm:text-sm focus:outline-none disabled:bg-slate-100 shadow-2xs"
              >
                {getDynamicWarehousesList([source]).map(w => (
                  <option key={w.id} value={w.id}>{w.label}</option>
                ))}
              </select>
            </div>

            {/* 5. Service Type */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-800 font-bold text-xs flex items-center gap-1.5">
                <Briefcase size={13} className="text-teal-600" />
                <span>نوع الخدمة / العملية:</span>
              </label>
              <select
                disabled={!isEditable}
                value={serviceType}
                onChange={e => setServiceType(e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 focus:border-blue-600 px-2.5 rounded-xl text-slate-900 font-bold text-xs sm:text-sm focus:outline-none disabled:bg-slate-100 shadow-2xs"
              >
                <option value="">-- بدون خدمة إضافية --</option>
                <option value="استشارات">استشارات</option>
                <option value="تصميم">تصميم</option>
                <option value="برمجة">برمجة</option>
                <option value="صيانة">صيانة</option>
                <option value="تركيب">تركيب</option>
                <option value="دعم فني">دعم فني</option>
                <option value="خدمات عامة">خدمات عامة</option>
              </select>
            </div>

            {/* 6. Cost Center / Branch */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-800 font-bold text-xs flex items-center gap-1.5">
                <BarChart3 size={13} className="text-indigo-600" />
                <span>مركز التكلفة / الفرع:</span>
              </label>
              <select
                disabled={!isEditable}
                value={costCenterId}
                onChange={e => setCostCenterId(e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 focus:border-blue-600 px-2.5 rounded-xl text-slate-900 font-bold text-xs sm:text-sm focus:outline-none disabled:bg-slate-100 shadow-2xs"
              >
                <option value="">-- عام (بدون مركز تكلفة) --</option>
                {costCentersList.map(cc => (
                  <option key={cc.id} value={cc.id}>{cc.code} - {cc.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {/* Invoice Items Matrix Table & Integrated Header Bar */}
        <div className="border-b-2 border-blue-950 bg-white">
          {/* Table Header Action Bar (Integrated) */}
          <div className="px-3 py-1.5 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 text-white flex flex-wrap items-center justify-between gap-2 border-b border-blue-900/60 print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-blue-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                جدول بنود وأصناف فاتورة المبيعات
              </span>
              <span className="text-[10px] text-blue-200 bg-blue-900/70 border border-blue-400/30 px-2 py-0.5 rounded font-mono font-bold">
                {items.length} بنود
              </span>
            </div>

            {/* Actions: Add Item, Voice, Scanner */}
            {isEditable ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="h-7 px-2.5 bg-blue-700 hover:bg-blue-600 active:bg-blue-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer border border-blue-400/40"
                  title="إضافة بند جديد للفاتورة (F2 أو Insert)"
                >
                  <Plus size={13} />
                  <span>إضافة بند (F2)</span>
                </button>

                <button
                  type="button"
                  onClick={isDictatingItems ? stopItemsDictation : startItemsDictation}
                  className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer border ${
                    isDictatingItems
                      ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-400 animate-pulse'
                      : 'bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-400/40'
                  }`}
                  title="إملاء الأصناف والكميات بالصوت (مثال: 5 كيبورد بسعر 120 و 2 ماوس)"
                >
                  {isDictatingItems ? (
                    <>
                      <MicOff size={13} className="animate-spin text-rose-200" />
                      <span>إيقاف الإملاء</span>
                    </>
                  ) : (
                    <>
                      <Mic size={13} className="text-emerald-200" />
                      <span>إملاء صوتي</span>
                      <Sparkles size={11} className="text-amber-300" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowBarcodeScannerModal(true)}
                  className="h-7 px-2.5 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer border border-purple-400/40"
                  title="مسح باركود الأصناف بكاميرا الهاتف أو اللابتوب (F3)"
                >
                  <Scan size={13} className="text-purple-200" />
                  <span>ماسح الباركود (F3)</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[11px] text-slate-300">
                <Lock size={12} className="text-amber-400" />
                <span>الفاتورة مقفلة (اضغط تعديل لإضافة بنود)</span>
                {status === 'POSTED' ? (
                  <button
                    type="button"
                    onClick={handleUnpost}
                    className="h-6 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    إلغاء الترحيل
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartEditInvoice}
                    className="h-6 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    تعديل الفاتورة
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Voice Dictation Status */}
          {isDictatingItems && (
            <div className="bg-rose-50 border-b border-rose-200 px-3 py-1 flex items-center gap-2 animate-fadeIn print:hidden">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0"></span>
              <span className="text-xs text-rose-800 font-bold truncate">
                {dictationTranscript ? `جاري السماع: "${dictationTranscript}"` : 'تحدث الآن بإملاء الأصناف والكميات والأسعار...'}
              </span>
            </div>
          )}

          <div className="overflow-x-auto min-h-[140px] max-h-[38vh]">
            <table className="w-full text-right border-collapse min-w-[820px]">
              <thead>
                <tr className="bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 border-y-2 border-blue-950 text-[11px] font-bold text-slate-100 uppercase tracking-wider sticky top-0 z-10">
                  <th className="py-2.5 px-2.5 w-10 text-center border-l border-blue-950 bg-slate-950 text-blue-200 font-mono font-black">#</th>
                  <th className="py-2.5 px-3 border-l border-blue-950 w-64 md:w-72 lg:w-80 min-w-[180px] max-w-[320px] text-white font-black">الصنف / الخدمة</th>
                  <th className="py-2.5 px-2 w-20 text-center border-l border-blue-950 bg-slate-900/80 text-blue-200 print:hidden" title="الكمية المتوفرة حالياً بالمخزن">
                    المخزن
                  </th>
                  <th className="py-2.5 px-2.5 w-24 text-left border-l border-blue-950 bg-slate-900/80 text-blue-200 print:hidden" title="متوسط سعر التكلفة المرجح (م.س.ت)">
                    <div className="flex items-center justify-between gap-1">
                      <span>(م.س.ت)</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCostPriceColumn(prev => {
                            const next = !prev;
                            try { localStorage.setItem('alpha_sales_show_cost', String(next)); } catch {}
                            return next;
                          });
                        }}
                        className="p-0.5 hover:bg-slate-800 text-blue-300 hover:text-white rounded transition-colors cursor-pointer"
                        title={showCostPriceColumn ? 'إخفاء متوسط التكلفة عن العميل' : 'إظهار متوسط التكلفة'}
                      >
                        {showCostPriceColumn ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                    </div>
                  </th>
                  <th className="py-2.5 px-2 w-36 sm:w-40 lg:w-44 text-center border-l border-blue-950 text-slate-100 font-bold">الكمية</th>
                  <th className="py-2.5 px-2 w-20 text-center border-l border-blue-950 text-blue-200">الوحدة</th>
                  <th className="py-2.5 px-2.5 w-24 sm:w-28 lg:w-32 text-left border-l border-blue-950 text-blue-200 font-black">سعر البيع</th>
                  <th className="py-2.5 px-2 w-24 text-center border-l border-blue-950 text-rose-300">خصم البند</th>
                  {classification === 'TAX' && (
                    <th className="py-2.5 px-2 w-16 text-center border-l border-blue-950 text-blue-200 font-bold">الضريبة %</th>
                  )}
                  <th className="py-2.5 px-3 w-28 text-left border-l border-blue-950 text-white font-black">الإجمالي ({currencySymbol})</th>
                  <th className="py-2.5 px-2 w-12 text-center print:hidden border-l border-blue-950 text-rose-400">حذف</th>
                </tr>
              </thead>
            <tbody className="divide-y divide-slate-300 text-xs">
              {items.map((item, index) => {
                const qty = Number(item.quantity) || 0;
                const unitPrice = Number(item.unitPrice) || 0;
                const grossLine = qty * unitPrice;
                const itemDisc = Number(item.itemDiscount) || 0;
                const itemDiscAmount = item.itemDiscountType === 'PERCENT'
                  ? (grossLine * (Math.max(0, Math.min(100, itemDisc)) / 100))
                  : Math.min(grossLine, Math.max(0, itemDisc));
                const lineTotal = Math.max(0, grossLine - itemDiscAmount);

                const itemInfo = resolveItemStockAndCost(item, itemsCatalog, source, status === 'POSTED' || !isEditMode);
                const isOverStock = itemInfo.matched && qty > itemInfo.stock;
                const unitMargin = unitPrice - itemInfo.costPrice;

                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-300">
                    {/* Index */}
                    <td className="py-2.5 px-2 text-center text-slate-800 font-mono font-black border-l border-slate-300 bg-slate-100">
                      #{index + 1}
                    </td>

                    {/* Description Autocomplete (No redundant delete button here!) */}
                    <td className="py-2 px-2.5 border-l border-slate-300">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 border border-slate-300 hover:border-slate-500 focus-within:border-blue-700 focus-within:ring-1 focus-within:ring-blue-700 rounded-lg px-2 py-0.5 bg-white transition-colors shadow-2xs">
                          <ItemAutocomplete
                            value={item.description}
                            disabled={!isEditable}
                            mode="SALES"
                            itemsList={itemsCatalog}
                            onChange={val => handleItemChange(item.id, 'description', val)}
                            onSelectItem={(selectedItem: Item) => {
                              const salePrice = selectedItem.salePrice || selectedItem.retailPrice || selectedItem.consumerPrice || selectedItem.costPrice || 0;
                              handleUpdateItem(item.id, {
                                itemId: selectedItem.id,
                                itemCode: selectedItem.code,
                                description: selectedItem.name,
                                availableStock: selectedItem.stock ?? 0,
                                costPrice: selectedItem.costPrice ?? 0,
                                unit: selectedItem.unit || 'حبة / قطعة',
                                unitPrice: salePrice > 0 ? salePrice : (Number(item.unitPrice) || 0),
                                ...(classification === 'TAX' && selectedItem.taxRate !== undefined ? { taxRate: selectedItem.taxRate } : {})
                              });
                            }}
                            placeholder="ابحث بالحرف أو الكود..."
                          />
                        </div>
                        {itemInfo.matched && (
                          <button
                            type="button"
                            onClick={() => {
                              const targetId = item.itemId || itemsCatalog.find(i => i.code === item.itemCode || (i.name || '').trim().toLowerCase() === (item.description || '').trim().toLowerCase())?.id;
                              if (targetId) setAnalyticItemId(targetId);
                            }}
                            className="p-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 transition-all shrink-0 print:hidden flex items-center justify-center cursor-pointer shadow-2xs"
                            title="تحليل الصنف وأسعار البيع ومعدلات السحب والربحية"
                          >
                            <BarChart3 size={13} />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* المخزن (Available Stock) */}
                    <td className="py-2 px-2 text-center border-l border-slate-300 bg-slate-100/60 print:hidden">
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[10px] text-slate-600 font-bold whitespace-nowrap mb-0.5" title="المخزن المختار">
                          {itemInfo.warehouseName || getWarehouseLabel(source)}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs font-bold border ${
  itemInfo.stock <= 0
    ? 'bg-rose-50 text-rose-800 border-rose-300'
    : itemInfo.stock <= 5
    ? 'bg-amber-50 text-amber-800 border-amber-300'
    : 'bg-emerald-50 text-emerald-800 border-emerald-300'
}`}>
                          <span>{itemInfo.stock.toLocaleString()}</span>
                          <span className="text-[10px] text-slate-500">{item.unit || itemInfo.unit || 'حبة'}</span>
                        </span>
                        {isOverStock && (
                          <span className="text-[9px] text-rose-700 font-extrabold mt-0.5 whitespace-nowrap animate-pulse">⚠️ عجز بالمخزن!</span>
                        )}
                      </div>
                    </td>

                    {/* متوسط سعر التكلفة (م.س.ت) (M.S.T - With Hide/Show Masking) */}
                    <td className="py-2 px-2 text-left border-l border-slate-300 bg-slate-100/60 print:hidden" dir="ltr">
                      {itemInfo.matched ? (
                        <div className="flex flex-col items-start justify-center">
                          {showCostPriceColumn ? (
                            <span className="font-mono text-xs font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-300 shadow-2xs">
                              {itemInfo.costPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono tracking-widest text-[11px] select-none" title="التكلفة مخفية">
                              ••••••
                            </span>
                          )}
                          {showCostPriceColumn && unitPrice > 0 && itemInfo.costPrice > 0 && (
                            <span className={`text-[9px] font-bold mt-0.5 whitespace-nowrap ${
                              unitMargin >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}>
                              {unitMargin >= 0 ? `+${unitMargin.toFixed(1)}` : `${unitMargin.toFixed(1)}`}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono">-</span>
                      )}
                    </td>

                    {/* الكمية (Quantity) */}
                    <td className="py-2 px-2 text-center border-l border-slate-300 w-36 sm:w-40 lg:w-44">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        disabled={!isEditable}
                        value={item.quantity ?? ''}
                        onFocus={e => e.target.select()}
                        onChange={e => handleItemChange(item.id, 'quantity', e.target.value === '' ? ('' as any) : e.target.value)}
                        onBlur={() => {
                          if (!item.quantity || Number(item.quantity) <= 0 || isNaN(Number(item.quantity))) {
                            handleItemChange(item.id, 'quantity', 1);
                          }
                        }}
                        className={`w-full bg-white h-9 px-1 rounded-lg border text-center font-mono font-bold text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 disabled:bg-slate-100 ${
                          isOverStock ? 'border-rose-500 bg-rose-50 text-rose-900' : 'border-slate-300'
                        }`}
                      />
                    </td>

                    {/* الوحدة (Unit selection) */}
                    <td className="py-2 px-1.5 text-center border-l border-slate-300">
                      <select
                        disabled={!isEditable}
                        value={item.unit || itemInfo.unit || 'حبة / قطعة'}
                        onChange={e => handleUpdateItem(item.id, { unit: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 hover:border-slate-400 h-9 px-1 rounded-lg text-xs font-bold text-slate-800 text-center focus:outline-none disabled:bg-slate-100 shadow-2xs"
                      >
                        {Array.from(new Set([
                          item.unit,
                          itemInfo.unit,
                          ...STANDARD_UNITS
                        ])).filter(Boolean).map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>

                    {/* سعر البيع (Unit Price) with Pricing Tiers */}
                    <td className="py-2 px-2 text-left border-l border-slate-300 w-28 sm:w-32 lg:w-36">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={!isEditable}
                        value={item.unitPrice ?? ''}
                        onFocus={e => e.target.select()}
                        onChange={e => handleItemChange(item.id, 'unitPrice', e.target.value === '' ? ('' as any) : e.target.value)}
                        onBlur={() => {
                          if (item.unitPrice === ('' as any) || item.unitPrice === undefined || isNaN(Number(item.unitPrice))) {
                            handleItemChange(item.id, 'unitPrice', 0);
                          }
                        }}
                        placeholder="0.00"
                        className="w-full bg-white h-8 px-2 rounded-lg border border-slate-300 text-left font-mono font-bold text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 dir-ltr disabled:bg-slate-100"
                      />

                      {/* Interactive Tier Switcher */}
                      {isEditable && (
                        <div className="flex items-center gap-0.5 mt-1 justify-center">
                          <button
                            type="button"
                            onClick={() => handleSetRowPricingTier(item.id, 'CONSUMER')}
                            className={`px-1 py-0.5 text-[8px] font-bold rounded transition-colors ${
                              item.pricingTier === 'CONSUMER' || !item.pricingTier
                                ? 'bg-purple-100 text-purple-800 ring-1 ring-purple-400 font-black'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                            title="سعر التجزئة / المستهلك"
                          >
                            مستهلك
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetRowPricingTier(item.id, 'SEMI_WHOLESALE')}
                            className={`px-1 py-0.5 text-[8px] font-bold rounded transition-colors ${
                              item.pricingTier === 'SEMI_WHOLESALE'
                                ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-400 font-black'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                            title="سعر نصف جملة (موزع)"
                          >
                            نصف
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetRowPricingTier(item.id, 'WHOLESALE')}
                            className={`px-1 py-0.5 text-[8px] font-bold rounded transition-colors ${
                              item.pricingTier === 'WHOLESALE'
                                ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-400 font-black'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                            title="سعر تاجر جملة"
                          >
                            جملة
                          </button>
                        </div>
                      )}
                    </td>

                    {/* خصم الصنف (Item Discount with % / Amount toggle) */}
                    <td className="py-2 px-1.5 text-center border-l border-slate-300">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={!isEditable}
                          value={item.itemDiscount === 0 || item.itemDiscount === undefined ? '' : item.itemDiscount}
                          placeholder="0"
                          onFocus={e => e.target.select()}
                          onChange={e => {
                            const raw = e.target.value;
                            const val = raw === '' ? 0 : Math.max(0, Number(raw));
                            handleUpdateItem(item.id, { itemDiscount: val });
                          }}
                          className="w-full min-w-[45px] bg-white border border-slate-300 hover:border-slate-400 h-9 px-1 rounded-lg text-xs sm:text-sm font-mono font-bold text-rose-700 text-center focus:outline-none focus:border-rose-500"
                        />
                        <button
                          type="button"
                          disabled={!isEditable}
                          onClick={() => {
                            const newType = item.itemDiscountType === 'PERCENT' ? 'AMOUNT' : 'PERCENT';
                            handleUpdateItem(item.id, { itemDiscountType: newType });
                          }}
                          className={`h-9 px-2 text-[10px] font-bold rounded-lg cursor-pointer shrink-0 transition-all flex items-center justify-center ${
                            item.itemDiscountType === 'PERCENT'
                              ? 'bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300'
                              : 'bg-blue-950 hover:bg-blue-900 text-white border border-blue-900 shadow-2xs'
                          }`}
                          title="التبديل بين خصم مبلغ (ر.س) أو نسبة مئوية (%)"
                        >
                          {item.itemDiscountType === 'PERCENT' ? '%' : 'ر.س'}
                        </button>
                      </div>
                    </td>

                    {/* الضريبة % (Tax Rate) */}
                    {classification === 'TAX' && (
                      <td className="py-2 px-1.5 text-center border-l border-slate-300">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          disabled={!isEditable}
                          value={item.taxRate ?? ''}
                          onFocus={e => e.target.select()}
                          onChange={e => handleItemChange(item.id, 'taxRate', e.target.value === '' ? ('' as any) : Number(e.target.value))}
                          onBlur={() => {
                            if (item.taxRate === ('' as any) || item.taxRate === undefined || isNaN(Number(item.taxRate))) {
                              handleItemChange(item.id, 'taxRate', 0);
                            }
                          }}
                          className="w-full bg-white h-9 px-1 rounded-lg border border-slate-300 font-mono text-center font-bold text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 disabled:bg-slate-100"
                        />
                      </td>
                    )}

                    {/* إجمالي البند (Net Line Total) */}
                    <td className="py-2 px-3 text-left font-mono font-black text-slate-950 text-xs border-l border-slate-300 bg-slate-50/70">
                      {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* حذف البند المخصص (Dedicated Delete Button in Column) */}
                    <td className="py-2 px-2 text-center print:hidden border-l border-slate-300">
                      <button
                        type="button"
                        onClick={() => {
                          if (!isEditable) {
                            if (status === 'POSTED') {
                              showToast({ type: 'warning', title: 'الفاتورة مرحلة ومعتمدة! لا يمكن حذف أي صنف إلا بعد إلغاء الترحيل.' });
                            } else {
                              showToast({ type: 'info', title: 'الفاتورة في وضع المعاينة. اضغط على زر [تعديل الفاتورة] بالأعلى لتفعيل الحذف.' });
                            }
                            return;
                          }
                          handleRemoveItem(item.id);
                        }}
                        disabled={!isEditable}
                        className={`p-1.5 rounded-lg border transition-all inline-flex items-center justify-center ${
                          isEditable
                            ? 'text-rose-600 hover:text-white hover:bg-rose-600 bg-rose-50 border-rose-200 cursor-pointer shadow-2xs'
                            : 'text-slate-300 bg-slate-100 border-slate-200 cursor-not-allowed opacity-50'
                        }`}
                        title={isEditable ? `حذف الصنف #${index + 1}` : 'التعديل مطلوب للحذف'}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two-Column Footer Grid (Summary & Payments | Notes & Terms) - items-stretch for Equal Height */}
      <div className="p-3 sm:p-4 border-t border-slate-300 bg-slate-100/70 grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch mt-auto print:hidden">
        {/* Column 1: Financial Summary & Payments - Elegant Comfortable Navy Background (#0b132b) */}
        <div className="lg:col-span-8 bg-[#0b132b] text-white p-4 rounded-2xl border border-slate-700/80 shadow-md flex flex-col justify-between h-full gap-3">
          {/* Header Cards in Accounting Sequence: (1) Gross Total -> (2) Discount -> (3) Services -> (4) Tax */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs border-b border-slate-700/70 pb-3">
            {/* 1. الإجمالي قبل الخصم */}
            <div className="bg-[#131d3b] p-2.5 rounded-xl border border-slate-700/70 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 block font-bold">1. الإجمالي قبل الخصم:</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-mono font-bold text-white text-sm sm:text-base">
                  {totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">{currencySymbol}</span>
              </div>
            </div>

            {/* 2. الخصم الممنوح */}
            <div className="bg-[#131d3b] p-2.5 rounded-xl border border-slate-700/70 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] text-slate-300 font-bold">2. الخصم الممنوح:</span>
                <button
                  type="button"
                  disabled={!isEditable}
                  onClick={() => setDiscountType(prev => prev === 'AMOUNT' ? 'PERCENT' : 'AMOUNT')}
                  className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#070d1e] text-slate-300 border border-slate-700 hover:bg-slate-800 cursor-pointer transition-colors"
                  title="التبديل بين نسبة مئوية ومبلغ نقدي"
                >
                  {discountType === 'PERCENT' ? '% نسبة' : `${currencySymbol} مبلغ`}
                </button>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="number"
                  min="0"
                  max={discountType === 'PERCENT' ? 100 : totals.subtotal}
                  step="0.01"
                  disabled={!isEditable}
                  value={discount}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    const raw = e.target.value;
                    setDiscount(raw === '' ? '' : Math.max(0, Number(raw)));
                  }}
                  onBlur={() => {
                    if (discount === '' || isNaN(Number(discount))) {
                      setDiscount(0);
                    }
                  }}
                  placeholder="0.00"
                  className="w-full text-right bg-[#070d1e] border border-slate-600 focus:border-blue-400 rounded-lg px-2.5 py-1 text-sm font-mono font-bold text-white focus:outline-none disabled:opacity-50 transition-colors"
                />
              </div>
              {discountType === 'PERCENT' && Number(discount) > 0 && (
                <span className="text-[10px] text-slate-400 font-mono block mt-1 font-bold">
                  = {totals.discountTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                </span>
              )}
            </div>

            {/* 3. الخدمات / الإضافات */}
            <div className="bg-[#131d3b] p-2.5 rounded-xl border border-slate-700/70 flex flex-col justify-between">
              <span className="text-[11px] text-slate-300 block font-bold">3. الخدمات / الإضافات:</span>
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={!isEditable}
                  value={servicesFee}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    const raw = e.target.value;
                    setServicesFee(raw === '' ? '' : Math.max(0, Number(raw)));
                  }}
                  onBlur={() => {
                    if (servicesFee === '' || isNaN(Number(servicesFee))) {
                      setServicesFee(0);
                    }
                  }}
                  placeholder="0.00"
                  className="w-full text-right bg-[#070d1e] border border-slate-600 focus:border-blue-400 rounded-lg px-2.5 py-1 text-sm font-mono font-bold text-white focus:outline-none disabled:opacity-50 transition-colors"
                />
              </div>
            </div>

            {/* 4. الضريبة */}
            <div className="bg-[#131d3b] p-2.5 rounded-xl border border-slate-700/70 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 block font-bold">
                4. الضريبة {classification === 'TAX' ? `(${taxRate}%)` : '(0%)'}:
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-mono font-bold text-white text-sm sm:text-base">
                  {totals.taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">{currencySymbol}</span>
              </div>
            </div>
          </div>

          {/* Optional Estimated Cost & Profit */}
          {totals.totalCost > 0 && showCostPriceColumn && (
            <div className="grid grid-cols-2 gap-2 text-xs border-b border-slate-700/70 pb-2 print:hidden">
              <div className="bg-[#131d3b] px-2.5 py-1 rounded-lg border border-slate-700/70 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">التكلفة الإجمالية:</span>
                <span className="font-mono font-bold text-slate-200 text-xs">
                  {totals.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                </span>
              </div>
              <div className="bg-[#131d3b] px-2.5 py-1 rounded-lg border border-slate-700/70 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">الربح التقديري:</span>
                <span className={`font-mono font-bold text-xs ${totals.grossProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {totals.grossProfit >= 0 ? '+' : ''}{totals.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totals.profitMargin.toFixed(1)}%)
                </span>
              </div>
            </div>
          )}

          {/* 5. صافي القيمة الإجمالية (Grand Total Bar) - Clean & Calibrated Colors */}
          <div className="flex items-center justify-between gap-3 bg-[#131d3b] p-3 sm:p-3.5 rounded-xl border border-slate-700/80 shadow-inner">
            <div>
              <span className="text-sm font-bold text-slate-200 block">5. صافي القيمة الإجمالية:</span>
              <span className="text-xs text-slate-400 font-sans font-medium truncate max-w-[340px] block mt-0.5" title={tafqeet(totals.grandTotal)}>
                {tafqeet(totals.grandTotal)}
              </span>
            </div>
            <div className="text-left shrink-0 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
                {totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-slate-300 font-bold bg-[#070d1e] px-2 py-0.5 rounded-md border border-slate-700">{currencySymbol}</span>
            </div>
          </div>

          {/* Payment & Safe Settlement Area - Distinct Input + Quick Buttons + Clear Badge */}
          <div className="pt-2 border-t border-slate-700/70">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              {/* 1. Paid Amount Input (Col Span 7) */}
              <div className="sm:col-span-7 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <CreditCard size={13} className="text-blue-400" />
                  <span>المبلغ المسدد ({currencySymbol}):</span>
                </label>

                {/* Clear Input Box */}
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={totals.grandTotal}
                    disabled={!isEditable}
                    value={paidAmount}
                    onFocus={e => e.target.select()}
                    onChange={e => handlePaidAmountChange(e.target.value)}
                    onBlur={() => {
                      if (paidAmount === '' || isNaN(Number(paidAmount))) {
                        handlePaidAmountChange(0);
                      }
                    }}
                    placeholder="0.00"
                    className="w-full bg-[#070d1e] border-2 border-slate-600 focus:border-blue-500 rounded-xl px-3 py-1.5 text-base font-mono font-bold text-white text-left focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              {/* 2. Remaining Amount Card with Clear Status Badge (Col Span 5) */}
              <div className="sm:col-span-5 bg-[#131d3b] p-2.5 rounded-xl border border-slate-700 flex flex-col justify-between gap-1.5 h-full">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300">المبلغ المتبقي:</span>
                  {/* Status Badge */}
                  {Number(paidAmount) >= totals.grandTotal - 0.001 && totals.grandTotal > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      ✓ مسدد بالكامل
                    </span>
                  ) : Number(paidAmount) > 0.001 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      ⏳ مسدد جزئياً
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                      📋 آجل غير مسدد
                    </span>
                  )}
                </div>

                <div className="flex items-baseline justify-between mt-0.5">
                  <span className={`text-base sm:text-lg font-mono font-bold ${
                    totals.remainingBalance > 0.001 ? 'text-rose-300' : 'text-slate-300'
                  }`}>
                    {totals.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">{currencySymbol}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Notes & Customer Financial Impact - Matches Height with Column 1 (items-stretch) */}
        <div className="lg:col-span-4 flex flex-col justify-between h-full gap-2.5">
          {/* Notes Section - Expands to fill available height smoothly */}
          <div className="bg-white p-3 rounded-2xl border border-slate-300 shadow-2xs flex-1 flex flex-col justify-between min-h-[110px]">
            <div className="flex flex-col flex-1">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5">
                  <FileText size={13} className="text-slate-600" />
                  <span>ملاحظات الفاتورة والتسليم:</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">اختياري</span>
              </label>
              <textarea
                disabled={!isEditable}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="اكتب هنا أي شروط أو تفاصيل إضافية تخص الفاتورة أو التسليم..."
                className="w-full flex-1 min-h-[60px] bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white resize-none transition-colors disabled:bg-slate-100"
              />
            </div>
          </div>

          {/* Customer Statement Impact Card (Compact) */}
          {selectedPartner && partnerBalanceImpact && (
            <div className="bg-white p-3 rounded-2xl border border-slate-300 shadow-2xs text-xs space-y-2 shrink-0">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-900 font-bold flex items-center gap-1 text-[11px]">
                  <User size={12} className="text-blue-700" />
                  <span>موقف حساب العميل:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPartnerForStatementModal(selectedPartner)}
                  className="text-[10px] text-blue-700 hover:underline font-bold cursor-pointer"
                >
                  فتح كشف الحساب
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-center">
                <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                  <span className="text-[9px] text-slate-500 block font-sans">الرصيد السابق</span>
                  <span className="font-bold text-slate-800">{partnerBalanceImpact.previousBalanceFormatted}</span>
                </div>
                <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                  <span className="text-[9px] text-slate-500 block font-sans">صافي الإضافة</span>
                  <span className="font-bold text-rose-700">+{partnerBalanceImpact.remainingAmountFormatted}</span>
                </div>
                <div className="bg-rose-50 p-1.5 rounded-xl border border-rose-200">
                  <span className="text-[9px] text-rose-800 block font-sans font-bold">الرصيد النهائي</span>
                  <span className="font-black text-rose-800">{partnerBalanceImpact.newBalanceFormatted}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>    </div>

      {/* Quick Add Customer Modal */}
      {showQuickAddCustomerModal && (
        <div className="fixed inset-0 z-[99990] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-right">
            <div className="px-5 py-3.5 bg-blue-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <User size={16} />
                <span>إضافة عميل جديد سريعاً</span>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddCustomerModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveQuickCustomer} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم العميل *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={quickCustName}
                  onChange={e => setQuickCustName(e.target.value)}
                  placeholder="مثال: شركة الأفق للتجارة..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الهاتف</label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={quickCustPhone}
                    onChange={e => setQuickCustPhone(e.target.value)}
                    placeholder="05XXXXXXXX"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الرقم الضريبي</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={quickCustTaxNo}
                    onChange={e => setQuickCustTaxNo(e.target.value)}
                    placeholder="3XXXXXXXXXXXXXX"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">الحد الائتماني (اختياري)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={quickCustCreditLimit}
                  onChange={e => setQuickCustCreditLimit(e.target.value)}
                  placeholder="مثال: 50000"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">العنوان / المدينة</label>
                <input
                  type="text"
                  value={quickCustAddress}
                  onChange={e => setQuickCustAddress(e.target.value)}
                  placeholder="الرياض - حي الملز..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowQuickAddCustomerModal(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Save size={14} />
                  <span>حفظ واختيار العميل</span>
                </button>
              </div>
            </form>
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

      {/* Camera Item Barcode Scanner Modal */}
      <ItemBarcodeScannerModal
        isOpen={showBarcodeScannerModal}
        onClose={() => setShowBarcodeScannerModal(false)}
        mode="SALES"
        itemsCatalog={itemsCatalog}
        onScanItem={handleScanItem}
        currentInvoiceItemsCount={items.filter(i => Boolean(i.description)).length}
      />

      {/* WhatsApp Share & PDF Modal (نافذة إرسال فاتورة المبيعات عبر الواتساب نصاً أو PDF) */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">إرسال فاتورة المبيعات عبر الواتساب</h3>
                  <p className="text-[11px] text-emerald-100 font-mono">
                    {targetPreviewDataForWhatsApp.title} #{targetPreviewDataForWhatsApp.docNumber || 'جديدة'} | {targetPreviewDataForWhatsApp.partnerName || 'عميل'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(false)}
                className="w-8 h-8 rounded-lg bg-emerald-700/50 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Recipient Phone Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Phone size={13} className="text-emerald-600" />
                  <span>رقم هاتف العميل (واتساب)</span>
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  value={whatsAppRecipientPhone}
                  onChange={(e) => setWhatsAppRecipientPhone(e.target.value)}
                  placeholder="05XXXXXXXX أو +966XXXXXXXXX"
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  سيتم فتح تطبيق الواتساب أو واتساب ويب مع الرقم والمحتوى المجهز مباشرة.
                </p>
              </div>

              {/* Message Preview & Editor */}
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <FileText size={13} className="text-slate-600" />
                    <span className="text-xs font-bold text-slate-700">نص الرسالة المعتمدة</span>
                    {isEditingWhatsAppText ? (
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-md font-bold">
                        وضع التعديل
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-md font-bold">
                        معاينة
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* زر تعديل رسالة الواتس النصية */}
                    <button
                      type="button"
                      onClick={() => setIsEditingWhatsAppText(!isEditingWhatsAppText)}
                      className={`text-xs font-bold flex items-center gap-1 cursor-pointer px-2.5 py-1 rounded-lg border transition-all ${
                        isEditingWhatsAppText
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                      title={isEditingWhatsAppText ? 'اعتماد التعديل ومعاينة النص' : 'تعديل نص الرسالة وإضافة ملاحظات أو شروط'}
                    >
                      {isEditingWhatsAppText ? <Check size={12} /> : <Edit3 size={12} className="text-emerald-600" />}
                      <span>{isEditingWhatsAppText ? 'تم التعديل' : 'تعديل النص'}</span>
                    </button>

                    {/* زر إعادة ضبط النص الأصلي */}
                    <button
                      type="button"
                      onClick={handleResetWhatsAppText}
                      className="text-xs text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg border border-slate-200 transition-colors"
                      title="استعادة النص التلقائي الأصلي للفاتورة"
                    >
                      <RotateCcw size={12} />
                      <span className="hidden sm:inline">إعادة ضبط</span>
                    </button>

                    {/* زر نسخ النص */}
                    <button
                      type="button"
                      onClick={handleCopyWhatsAppText}
                      className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200"
                    >
                      {isCopiedWhatsAppText ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>{isCopiedWhatsAppText ? 'تم النسخ!' : 'نسخ'}</span>
                    </button>
                  </div>
                </div>

                {isEditingWhatsAppText ? (
                  <div className="space-y-1">
                    <textarea
                      value={whatsAppMessageText}
                      onChange={(e) => setWhatsAppMessageText(e.target.value)}
                      rows={8}
                      className="w-full p-3 bg-white border-2 border-emerald-500 rounded-xl text-xs font-sans text-slate-900 leading-relaxed focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden resize-y font-medium shadow-inner"
                      placeholder="اكتب أو عدل نص رسالة الواتساب هنا..."
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                      <span>💡 يمكنك تخصيص النص أو كتابة أي ملاحظات وشروط سداد قبل الإرسال.</span>
                      <button
                        type="button"
                        onClick={() => setIsEditingWhatsAppText(false)}
                        className="text-emerald-700 hover:underline font-bold"
                      >
                        معاينة ◀
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => setIsEditingWhatsAppText(true)}
                    className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 font-sans whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto select-text font-medium cursor-pointer transition-colors relative group"
                    title="انقر لتعديل الرسالة مباشرة"
                  >
                    <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 px-2 py-0.5 rounded-md border border-slate-300 text-[10px] text-slate-700 font-bold flex items-center gap-1 shadow-2xs">
                      <Edit3 size={11} className="text-emerald-600" />
                      <span>انقر للتعديل</span>
                    </div>
                    {whatsAppMessageText || generateSalesInvoiceWhatsAppMessage(targetPreviewDataForWhatsApp)}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyWhatsAppText}
                  className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Copy size={14} />
                  <span>{isCopiedWhatsAppText ? 'تم النسخ بنجاح' : 'نسخ للحافظة'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSendWhatsAppText}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-95 flex items-center gap-1.5"
                >
                  <Send size={14} />
                  <span>إرسال عبر الواتساب</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Off-screen Pristine Certified Invoice Element for WhatsApp PDF Generation */}
      <div 
        style={{ position: 'absolute', left: '-9999px', top: 0, width: '1020px', minWidth: '1020px', pointerEvents: 'none' }} 
        aria-hidden="true"
      >
        <div ref={whatsAppPdfElementRef}>
          <CertifiedInvoiceDocument 
            data={targetPreviewDataForWhatsApp} 
            format="A4" 
            colorMode="color" 
          />
        </div>
      </div>

      {/* Print Preview & PDF Modal */}
      {showPrintPreview && (
        <PrintPreviewModal
          isOpen={showPrintPreview}
          onClose={() => {
            setShowPrintPreview(false);
            setCustomPreviewData(null);
            setPreviewAutoPrint(false);
            setPreviewAutoPdf(false);
          }}
          data={customPreviewData || currentInvoicePreviewData}
          autoPrint={previewAutoPrint}
          autoExportPdf={previewAutoPdf}
        />
      )}

      {/* Partner Statement Modal */}
      {selectedPartnerForStatementModal && (
        <PartnerStatementModal
          isOpen={true}
          partner={selectedPartnerForStatementModal}
          onClose={() => setSelectedPartnerForStatementModal(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200" dir="rtl">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {deleteModal.isNewDraft ? 'تأكيد إفراغ المسودة' : 'تأكيد حذف الفاتورة'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  رقم الفاتورة: <span className="font-mono font-bold text-slate-800">{deleteModal.invoiceNumber}</span>
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-6 bg-slate-50 p-3 rounded-xl border border-slate-200">
              {deleteModal.isNewDraft
                ? 'هل أنت تأكد من رغبتك في تفريغ كافة بنود وحقول هذه المسودة والبدء من جديد؟'
                : deleteModal.isPosted
                ? `هل أنت متأكد من حذف الفاتورة رقم (${deleteModal.invoiceNumber}) نهائياً؟ تنبيه: هذه الفاتورة مرحلة ومعتمدة، وسيؤدي تأكيد الحذف إلى إلغاء ترحيلها تلقائياً، إرجاع كميات المخزون وتحديث أرصدة العميل.`
                : `هل أنت متاكد من حذف الفاتورة رقم (${deleteModal.invoiceNumber}) نهائياً من النظام؟ لا يمكن التراجع عن هذا الإجراء.`}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={confirmExecuteDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all cursor-pointer shadow-sm hover:shadow-md"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
