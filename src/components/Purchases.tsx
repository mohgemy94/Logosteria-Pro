import { useState, useMemo, useEffect, useRef } from 'react';
import { Save, Plus, Trash2, CheckCircle2, RotateCcw, 
  History, Printer, Calendar, Truck, X, Edit3, Eye, EyeOff, Lock,
  FileDown, Loader2, Keyboard, FileText, CreditCard, BarChart3,
  ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft, ArrowRight,
  Mic, MicOff, Sparkles, Scan, Scale, FileSpreadsheet, MessageSquare, User, Phone, Check
, Hash, Landmark, Percent, Warehouse, Briefcase } from 'lucide-react';
import PrintDropdown from './PrintDropdown';
import PrintPreviewModal, { PrintPreviewData } from './PrintPreviewModal';
import PartnerStatementModal from './PartnerStatementModal';
import ItemAnalyticsModal from './ItemAnalyticsModal';
import ItemBarcodeScannerModal from './ItemBarcodeScannerModal';
import { navigateToAccountMovements } from '../utils/accountMovementsStore';
import { getNextSequentialNumber, 
  advanceSequenceAfterSave, 
  DB_PURCHASES_INVOICES_KEY,
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
import { useSystemCurrency } from '../utils/currency';
import { loadVendors, 
  getPartnerAccountStatement, 
  calculateInvoicePartnerImpact,
  dispatchPartnerLedgerUpdated 
} from '../utils/partnerLedger';

import { loadStoredPurchaseInvoices, 
  saveStoredPurchaseInvoices, 
  type StoredPurchaseInvoice 
} from '../utils/purchasesStore';
import { getSystemSettings } from '../utils/settings';
import { checkDateIsLocked } from '../utils/periodLock';
import { parseVoiceItemsFromText } from '../utils/voiceCommandParser';
import { getFlatCostCenters } from '../utils/costCenterStore';
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
  itemDiscount?: number;
  itemDiscountType?: 'AMOUNT' | 'PERCENT';
}

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

export function resolvePurchaseItemStockAndCost(
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

  // 2. For Posted purchase invoices without explicit saved availableStock, reconstitute stock at invoice time:
  if (isPostedOrViewOnly && matchedItem) {
    const liveStock = Number(matchedItem.stock) || 0;
    const qty = Number(item.quantity) || 0;
    const snapshotStock = Math.max(0, liveStock - qty);
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
        (pItem.description && (it.name || '').trim().toLowerCase() === (pItem.description || '').trim().toLowerCase())
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
        (pItem.description && (it.name || '').trim().toLowerCase() === (pItem.description || '').trim().toLowerCase())
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
  const [serviceType, setServiceType] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0] as string);
  const [dueDate, setDueDate] = useState<string>('');
  const [partnerId, setPartnerId] = useState<string>('');
  const [status, setStatus] = useState<'DRAFT' | 'POSTED'>('DRAFT');
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const isEditable = status !== 'POSTED' && isEditMode;
  const [showInvoicesHistory, setShowInvoicesHistory] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [previewAutoPrint, setPreviewAutoPrint] = useState(false);
  const [previewAutoPdf, setPreviewAutoPdf] = useState(false);
  const [customPreviewData, setCustomPreviewData] = useState<PrintPreviewData | null>(null);
  const [analyticItemId, setAnalyticItemId] = useState<string | null>(null);

  // In-App Toast & Confirmation Modal States
  const [toast, setToast] = useState<{ id: number; type: 'success' | 'error' | 'warning' | 'info'; title: string; message?: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; invoiceId?: string | null | undefined; invoiceNumber: string; isNewDraft?: boolean; isPosted?: boolean } | null>(null);

  function showToast(t: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message?: string }) {
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
  const vatEnabled = systemSettings.taxAndInvoice?.enableVat !== false;
  const initialPurchasesClassification = vatEnabled ? ((defaultInvoiceSettings.purchasesClassification as 'NORMAL' | 'TAX') || 'TAX') : 'NORMAL';
  const initialPurchasesTaxRate = initialPurchasesClassification === 'TAX' ? defaultSysTaxRate : 0;
  const [classification, setClassification] = useState<'NORMAL' | 'TAX'>(initialPurchasesClassification);
  const [taxRate, setTaxRate] = useState<number | string>(initialPurchasesTaxRate);
  const [discount, setDiscount] = useState<number | string>(0);
  const [discountType, setDiscountType] = useState<'AMOUNT' | 'PERCENT'>('AMOUNT');
  const [shippingCost, setShippingCost] = useState<number | string>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'SPAN' | 'BANK_TRANSFER' | 'CHECK'>('CASH');
  const [hasPartnerError, setHasPartnerError] = useState<boolean>(false);
  const [showCostPriceColumn, setShowCostPriceColumn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('alpha_purchases_show_cost');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // Quick Vendor Creation Modal State
  const [showQuickAddVendorModal, setShowQuickAddVendorModal] = useState<boolean>(false);
  const [quickVendorName, setQuickVendorName] = useState<string>('');
  const [quickVendorPhone, setQuickVendorPhone] = useState<string>('');
  const [quickVendorTaxNo, setQuickVendorTaxNo] = useState<string>('');
  const [quickVendorCreditLimit, setQuickVendorCreditLimit] = useState<number | string>('');
  const [quickVendorAddress, setQuickVendorAddress] = useState<string>('');
  const [invoiceType, setInvoiceType] = useState<string>(defaultInvoiceSettings.purchasesTransactionType || 'CREDIT_PURCHASE');
  const [paidAmount, setPaidAmount] = useState<number | string>(0);
  const [source, setSource] = useState<string>(defaultInvoiceSettings.purchasesWarehouse || 'MAIN_WAREHOUSE');
  const [safe, setSafe] = useState<string>(defaultInvoiceSettings.purchasesSafe || '1101');
  const [costCenterId, setCostCenterId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: 'item-' + Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: initialPurchasesTaxRate, availableStock: 0, costPrice: 0 }
  ]);

  const selectedPartner = useMemo(() => {
    return vendors.find(v => v.id === partnerId || v.name === partnerId);
  }, [vendors, partnerId]);

  // Live account statement for selected vendor
  const selectedPartnerStatement = useMemo(() => {
    if (!selectedPartner) return null;
    return getPartnerAccountStatement(selectedPartner);
  }, [selectedPartner, savedInvoices]);

  const displayPartnerBalance = useMemo(() => {
    if ((status === 'POSTED' || !isEditMode) && partnerBalanceSnapshot !== null && partnerBalanceSnapshot !== undefined) {
      return partnerBalanceSnapshot;
    }
    return selectedPartnerStatement?.netBalance ?? selectedPartnerStatement?.balance ?? 0;
  }, [status, isEditMode, partnerBalanceSnapshot, selectedPartnerStatement]);

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

  const handleSaveQuickVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickVendorName.trim()) {
      alert('يرجى إدخال اسم المورد أولاً');
      return;
    }
    const newVendor: Partner = {
      id: 'vendor-' + Date.now(),
      code: 'V-' + Math.floor(1000 + Math.random() * 9000),
      name: quickVendorName.trim(),
      type: 'VENDOR',
      phone: quickVendorPhone.trim() || undefined,
      taxNumber: quickVendorTaxNo.trim() || undefined,
      creditLimit: quickVendorCreditLimit ? Number(quickVendorCreditLimit) : undefined,
      address: quickVendorAddress.trim() || undefined,
      isActive: true
    };
    const updated = [...vendors, newVendor];
    setVendors(updated);
    saveVendorsList(updated);
    dispatchPartnerLedgerUpdated();
    setPartnerId(newVendor.id);
    setHasPartnerError(false);
    setShowQuickAddVendorModal(false);
    setQuickVendorName('');
    setQuickVendorPhone('');
    setQuickVendorTaxNo('');
    setQuickVendorCreditLimit('');
    setQuickVendorAddress('');
    showToast({
      type: 'success',
      title: `تمت إضافة المورد (${newVendor.name}) واختياره بنجاح!`
    });
  };

  const handleNewInvoice = (customList?: StoredPurchaseInvoice[] | unknown) => {
    const currSettings = getSystemSettings();
    const currentDefaults = currSettings.invoiceDefaults || {};
    const vatEnabled = currSettings.taxAndInvoice?.enableVat !== false;
    const sysTax = currSettings.taxAndInvoice?.defaultVatRate !== undefined ? currSettings.taxAndInvoice.defaultVatRate : 15;
    const initialClassification = vatEnabled ? ((currentDefaults.purchasesClassification as 'NORMAL' | 'TAX') || 'TAX') : 'NORMAL';
    const effectiveTaxRate = initialClassification === 'TAX' ? sysTax : 0;
    setEditingInvoiceId(null);
    setPartnerBalanceSnapshot(null);
    const invoiceList = Array.isArray(customList) ? customList : savedInvoices;
    const nextSeq = getNextSequentialNumber('purchaseInvoice', invoiceList.map(i => i.invoiceNumber)).formatted;
    setInvoiceNumber(nextSeq);
    setSupplierRef('');
    setServiceType('');
    setStatus('DRAFT');
    setIsEditMode(true);
    setPartnerId('');
    setDueDate('');
    setNotes('');
    setClassification(initialClassification);
    setTaxRate(effectiveTaxRate);
    setDiscount(0);
    setShippingCost(0);
    setInvoiceType(currentDefaults.purchasesTransactionType || 'CREDIT_PURCHASE');
    setSource(currentDefaults.purchasesWarehouse || 'MAIN_WAREHOUSE');
    setSafe(currentDefaults.purchasesSafe || '1101');
    setCostCenterId('');
    setPaidAmount(0);
    setItems([{ id: 'item-' + Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: effectiveTaxRate, availableStock: 0, costPrice: 0 }]);
    setItemsCatalog(loadStoredItems());
  };

  function handleEditInvoice(inv: StoredPurchaseInvoice) {
    setEditingInvoiceId(inv.id);
    setPartnerBalanceSnapshot(inv.partnerBalanceSnapshot !== undefined ? inv.partnerBalanceSnapshot : null);
    setInvoiceNumber(inv.invoiceNumber);
    setSupplierRef(inv.supplierRef || '');
    setServiceType(inv.serviceType || '');
    setDate(inv.date);
    setDueDate(inv.dueDate || '');
    setPartnerId(inv.partnerId);
    setClassification(inv.classification);
    const resolvedTaxRate = inv.taxRate !== undefined ? inv.taxRate : (inv.items?.[0]?.taxRate ?? 15);
    setTaxRate(resolvedTaxRate);
    setDiscount(Number(inv.totals?.discountTotal ?? (inv as unknown as { discountTotal?: number }).discountTotal ?? 0));
    setShippingCost(Number((inv as unknown as { shippingCost?: number; totals?: { shippingTotal?: number } }).shippingCost ?? inv.totals?.shippingTotal ?? 0));
    setInvoiceType(inv.invoiceType);
    setSource(inv.source);
    setSafe(inv.safe);
    setCostCenterId(inv.costCenterId || '');
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

  // Check for pending target purchase invoice on mount / when savedInvoices load
  useEffect(() => {
    try {
      const targetId = sessionStorage.getItem('alpha_target_purchase_invoice_id');
      const targetNum = sessionStorage.getItem('alpha_target_purchase_invoice_number');
      if (targetId || targetNum) {
        sessionStorage.removeItem('alpha_target_purchase_invoice_id');
        sessionStorage.removeItem('alpha_target_purchase_invoice_number');
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
            title: `تم فتح فاتورة المشتريات #${found.invoiceNumber}`
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load pending purchase invoice from sessionStorage:', e);
    }
  }, [savedInvoices]);

  // Listen to system settings updates (invoicing and taxes defaults)
  useEffect(() => {
    const handleSettingsUpdated = (e: any) => {
      const updatedSettings: SystemSettings = e?.detail || getSystemSettings();
      const vatEnabled = updatedSettings.taxAndInvoice?.enableVat !== false;
      const defClass = vatEnabled ? ((updatedSettings.invoiceDefaults?.purchasesClassification as 'NORMAL' | 'TAX') || 'TAX') : 'NORMAL';
      const defTax = defClass === 'TAX' ? (updatedSettings.taxAndInvoice?.defaultVatRate ?? 15) : 0;
      
      // If currently on a pristine new draft, update to match new defaults
      if (editingInvoiceId === null && items.length <= 1 && (items[0]?.description === '' || !items[0]?.description)) {
        setClassification(defClass);
        setTaxRate(defTax);
        if (updatedSettings.invoiceDefaults?.purchasesTransactionType) {
          setInvoiceType(updatedSettings.invoiceDefaults.purchasesTransactionType);
        }
        if (updatedSettings.invoiceDefaults?.purchasesWarehouse) {
          setSource(updatedSettings.invoiceDefaults.purchasesWarehouse);
        }
        if (updatedSettings.invoiceDefaults?.purchasesSafe) {
          setSafe(updatedSettings.invoiceDefaults.purchasesSafe);
        }
        setItems(prev => prev.map(it => ({ ...it, taxRate: defTax })));
      }
    };
    window.addEventListener('alpha-settings-updated', handleSettingsUpdated);
    return () => window.removeEventListener('alpha-settings-updated', handleSettingsUpdated);
  }, [editingInvoiceId, items]);

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

    const defaultCost = scannedItem.costPrice || scannedItem.purchasePrice || scannedItem.salePrice || 0;
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
          unitPrice: defaultCost,
          taxRate: itemTax,
          availableStock: scannedItem.stock ?? 0,
          costPrice: defaultCost,
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
          unitPrice: defaultCost,
          taxRate: itemTax,
          availableStock: scannedItem.stock ?? 0,
          costPrice: defaultCost,
          unit: scannedItem.unit || 'حبة'
        }
      ];
    });

    showToast({
      type: 'success',
      title: 'تم مسح وإدراج صنف المشتريات',
      message: `${scannedItem.name} (كود: ${scannedItem.code}) - تم إدراجه بالفاتورة.`
    });
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
          const purchasePrice = matched.costPrice || matched.salePrice || 0;
          if (purchasePrice > 0 && (!updated.unitPrice || Number(updated.unitPrice) === 0)) {
            updated.unitPrice = purchasePrice;
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

      const taxRateVal = classification === 'TAX' ? (Number(item.taxRate) || 0) : 0;
      const lineTax = netLine * (taxRateVal / 100);
      taxTotal += lineTax;
    });

    const rawDisc = Number(discount) || 0;
    const generalDiscountAmount = discountType === 'PERCENT'
      ? (subtotal * (Math.max(0, Math.min(100, rawDisc)) / 100))
      : Math.min(subtotal, Math.max(0, rawDisc));

    const totalDiscounts = itemsDiscountTotal + generalDiscountAmount;
    const shippingTotal = Math.max(0, Number(shippingCost) || 0);

    let effectiveTax = taxTotal;
    if (subtotal > 0 && generalDiscountAmount > 0 && classification === 'TAX') {
      const discountRatio = Math.max(0, 1 - (generalDiscountAmount / subtotal));
      effectiveTax = taxTotal * discountRatio;
    }

    const taxableBase = Math.max(0, subtotal - generalDiscountAmount + shippingTotal);
    const grandTotal = Math.max(0, taxableBase + effectiveTax);
    const cleanPaid = Math.max(0, Math.min(grandTotal, Number(paidAmount) || 0));
    const remainingBalance = Math.max(0, grandTotal - cleanPaid);

    return { 
      grossItemsTotal,
      subtotal, 
      taxTotal: effectiveTax, 
      discountTotal: generalDiscountAmount,
      itemsDiscountTotal,
      totalDiscounts,
      shippingTotal,
      taxableBase,
      grandTotal,
      cashPaid: cleanPaid,
      remainingBalance
    };
  }, [items, classification, discount, discountType, shippingCost, paidAmount]);

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
    subtitle: status === 'POSTED' ? 'معتمدة ومرحّلة' : 'مسودة فاتورة توريد قيد التدقيق',
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
    serviceType: serviceType || undefined,
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
  }), [classification, status, invoiceNumber, date, dueDate, selectedPartner, invoiceType, serviceType, items, totals, paidAmount, notes, partnerBalanceImpact]);

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
    const sanitizedItems: InvoiceItem[] = items.map(it => ({
      ...it,
      quantity: Math.max(1, Number(it.quantity) || 1),
      unitPrice: Math.max(0, Number(it.unitPrice) || 0),
      taxRate: classification === 'TAX' ? Math.max(0, Number(it.taxRate) || 0) : 0
    }));
    const invoiceRecord: StoredPurchaseInvoice = {
      id: newId,
      invoiceNumber: finalNumber,
      supplierRef: supplierRef.trim(),
      serviceType: serviceType.trim() || undefined,
      date,
      dueDate,
      partnerId,
      partnerName: partnerObj?.name || 'مورد عام',
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
      partnerBalanceSnapshot: partnerBalanceSnapshot !== null ? partnerBalanceSnapshot : (selectedPartnerStatement?.balance ?? 0),
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

    const prePostingBalance = partnerBalanceSnapshot !== null 
      ? partnerBalanceSnapshot 
      : (selectedPartnerStatement?.netBalance ?? selectedPartnerStatement?.balance ?? 0);
    invoiceRecord.partnerBalanceSnapshot = prePostingBalance;
    setPartnerBalanceSnapshot(prePostingBalance);

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
      const updatedList = addItemsStockAndRecalculateCostOnPurchase(items, source);
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
        message: 'تم تفريغ كافة الحقول والبدء بفاتورة مشتريات جديدة فارغة.'
      });
      return;
    }

    const targetNumber = deleteModal.invoiceNumber;
    const targetId = deleteModal.invoiceId;
    const targetInv = savedInvoices.find(i => (targetId && i.id === targetId) || (i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === targetNumber.trim().toLowerCase()));

    // If invoice was posted, revert added inventory stock
    if (targetInv && targetInv.status === 'POSTED' && targetInv.items && targetInv.items.length > 0) {
      const reverted = deductItemsStockOnPurchaseUnpost(targetInv.items);
      if (reverted.length > 0) {
        setItemsCatalog(reverted);
      }
    }

    const updated = savedInvoices.filter(i => {
      if (targetId && i.id === targetId) return false;
      if (i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === targetNumber.trim().toLowerCase()) return false;
      return true;
    });

    setSavedInvoices(updated);
    saveStoredPurchaseInvoices(updated);
    dispatchPartnerLedgerUpdated();

    if (editingInvoiceId === targetId || invoiceNumber.trim().toLowerCase() === targetNumber.trim().toLowerCase()) {
      handleNewInvoice(updated);
    }

    showToast({
      type: 'success',
      title: 'تم حذف الفاتورة بنجاح',
      message: `تم حذف فاتورة المشتريات رقم (${targetNumber}) وتحديث الحسابات والمخزون.`
    });
    setDeleteModal(null);
  };

  const handleOpenWhatsAppModal = (invoiceOverride?: StoredPurchaseInvoice) => {
    let previewDataToUse: PrintPreviewData;
    let recipientPhone = '';

    if (invoiceOverride) {
      previewDataToUse = {
        title: invoiceOverride.classification === 'TAX' ? 'فاتورة مشتريات ضريبية' : 'فاتورة مشتريات عامة',
        docNumber: invoiceOverride.invoiceNumber,
        date: invoiceOverride.date,
        dueDate: invoiceOverride.dueDate,
        partnerName: invoiceOverride.partnerName,
        classification: invoiceOverride.classification,
        items: invoiceOverride.items.map(it => ({
          description: it.description || 'صنف مشتريات',
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
        paymentStatus: (invoiceOverride.paidAmount || 0) >= invoiceOverride.totals.grandTotal ? 'FULL' : (invoiceOverride.paidAmount || 0) > 0 ? 'PARTIAL' : 'CREDIT',
        notes: invoiceOverride.notes,
        paymentMethod: getInvoiceTypeName(invoiceOverride.invoiceType),
        serviceType: invoiceOverride.serviceType
      };
      if (selectedPartner?.id === invoiceOverride.partnerId) {
        recipientPhone = selectedPartner.phone || '';
      } else {
        const partner = vendors.find(v => v.id === invoiceOverride.partnerId);
        recipientPhone = partner?.phone || '';
      }
    } else {
      previewDataToUse = {
        title: classification === 'TAX' ? 'فاتورة مشتريات ضريبية' : 'فاتورة مشتريات عامة',
        docNumber: invoiceNumber,
        date,
        dueDate,
        partnerName: selectedPartner?.name || 'مورد عام',
        classification,
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
        servicesTotal: totals.servicesTotal,
        grandTotal: totals.grandTotal,
        paidAmount,
        remainingBalance: Math.max(0, totals.grandTotal - (paidAmount || 0)),
        paymentStatus: (paidAmount || 0) >= totals.grandTotal ? 'FULL' : (paidAmount || 0) > 0 ? 'PARTIAL' : 'CREDIT',
        notes,
        paymentMethod: getInvoiceTypeName(invoiceType),
        serviceType
      };
      recipientPhone = selectedPartner?.phone || '';
    }

    setCustomPreviewData(previewDataToUse);
    setShowPrintPreview(true);
  };

  // Global Keyboard Shortcuts (Ctrl+S, Ctrl+P, Ctrl+N, Ctrl+Enter, F2, Ctrl+H, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.key) return;
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
                className="p-1 text-slate-700 hover:text-emerald-950 hover:bg-white disabled:opacity-30 rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
                title="الفاتورة الأولى (الأقدم)"
              >
                <ChevronsRight size={13} />
              </button>
              <button
                type="button"
                onClick={handleNavigatePrevious}
                disabled={!canGoPrevious}
                className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-slate-800 bg-white hover:bg-slate-50 hover:text-emerald-950 disabled:opacity-30 rounded transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-200 shadow-2xs"
                title="الفاتورة السابقة (PageUp)"
              >
                <ChevronRight size={13} className="text-emerald-700" />
                <span className="hidden sm:inline">السابق</span>
              </button>
              <div className="px-2 py-0.5 text-xs font-mono font-bold text-emerald-950 bg-emerald-50/90 rounded mx-0.5 select-none border border-emerald-200 shadow-2xs whitespace-nowrap">
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
                className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-slate-800 bg-white hover:bg-slate-50 hover:text-emerald-950 disabled:opacity-30 rounded transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-200 shadow-2xs"
                title="الفاتورة التالية (PageDown)"
              >
                <span className="hidden sm:inline">التالي</span>
                <ChevronLeft size={13} className="text-emerald-700" />
              </button>
              <button
                type="button"
                onClick={handleNavigateLast}
                disabled={!canGoLast}
                className="p-1 text-slate-700 hover:text-emerald-950 hover:bg-white disabled:opacity-30 rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
                title="الفاتورة الأخيرة (الأحدث)"
              >
                <ChevronsLeft size={13} />
              </button>
            </div>

            {/* Status Pill */}
            <span className={`px-2 py-1 text-xs font-bold rounded-lg border shadow-2xs ${
              status === 'POSTED'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : isEditMode
                ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
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
                  className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                  title="ترحيل الفاتورة واعتماد المخزون (Ctrl+Enter)"
                >
                  <CheckCircle2 size={14} className="text-emerald-200" />
                  <span>ترحيل</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleUnpost}
                  className="h-8 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                  title="إلغاء الترحيل وإعادتها لمسودة"
                >
                  <RotateCcw size={14} className="text-amber-200" />
                  <span>إلغاء الترحيل</span>
                </button>
              )}

              {/* Save / Edit Draft (Secondary Action - Outline style) */}
              {status === 'DRAFT' && (
                !isEditMode ? (
                  <button
                    type="button"
                    onClick={handleStartEditInvoice}
                    className="h-8 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
                    title="تعديل الفاتورة (Ctrl+S)"
                  >
                    <Edit3 size={13} className="text-slate-500" />
                    <span>تعديل</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="h-8 px-3 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 hover:border-emerald-400 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
                    title="حفظ مسودة (Ctrl+S)"
                  >
                    <Save size={14} className="text-emerald-600" />
                    <span>حفظ كمسودة</span>
                  </button>
                )
              )}

              {/* Single New Invoice Action */}
              <button
                type="button"
                onClick={handleNewInvoice}
                className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                title="فاتورة جديدة (Ctrl+N)"
              >
                <Plus size={14} className="text-white" />
                <span>جديد</span>
              </button>
            </div>

            {/* Unified Outputs Group (مجموعة المخرجات بتصميم أنيق ومحايد) */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-300 text-slate-700 shadow-2xs">
              {/* Preview Button - Bariz & Clear (معاينة) */}
              <button
                type="button"
                onClick={() => {
                  setCustomPreviewData(null);
                  setPreviewAutoPrint(false);
                  setPreviewAutoPdf(false);
                  setShowPrintPreview(true);
                }}
                className="h-8 px-3 bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 border border-indigo-200 rounded-md text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
                title="معاينة فاتورة المشتريات قبل الطباعة"
              >
                <Eye size={14} className="text-indigo-600" />
                <span>معاينة</span>
              </button>
              {/* Direct Print */}
              <button
                type="button"
                onClick={() => {
                  setCustomPreviewData(null);
                  setPreviewAutoPrint(true);
                  setPreviewAutoPdf(false);
                  setShowPrintPreview(true);
                }}
                className="h-8 px-2.5 hover:bg-white text-slate-700 hover:text-slate-900 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                title="طباعة فاتورة المشتريات مباشرة (Ctrl+P)"
              >
                <Printer size={14} className="text-slate-600" />
                <span>طباعة</span>
              </button>
              {/* Export PDF */}
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
              {/* WhatsApp */}
              <button
                type="button"
                onClick={() => handleOpenWhatsAppModal()}
                className="h-8 px-2.5 hover:bg-white text-slate-700 hover:text-emerald-700 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                title="إرسال الفاتورة عبر واتساب"
              >
                <MessageSquare size={14} className="text-emerald-600" />
                <span>واتساب</span>
              </button>
              {/* Print Dropdown Settings */}
              <PrintDropdown
                onPreview={() => {
                  setCustomPreviewData(null);
                  setShowPrintPreview(true);
                }}
              />
            </div>

            {/* Utility Tools */}
            <div className="flex items-center gap-1">


              {/* Invoices History Drawer Toggle */}
              <button
                type="button"
                onClick={() => setShowInvoicesHistory(!showInvoicesHistory)}
                className={`h-8 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all border ${
                  showInvoicesHistory
                    ? 'bg-slate-800 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 shadow-2xs'
                }`}
                title="سجل فواتير المشتريات (Ctrl+H)"
              >
                <History size={13} />
                <span className="hidden md:inline">السجل</span>
                <span className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold ${
                  showInvoicesHistory ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-800'
                }`}>
                  {savedInvoices.length}
                </span>
              </button>

              {/* Delete Invoice */}
              <button
                type="button"
                onClick={handleDelete}
                className="h-8 px-2 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-700 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
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
      <div className="bg-gradient-to-r from-purple-50/90 via-indigo-50/90 to-slate-50/90 border border-purple-200/90 rounded-2xl px-4 py-2 mb-3 flex items-center justify-between gap-3 text-xs print:hidden shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap text-purple-950 font-medium">
          <span className="flex items-center gap-1.5 font-black text-purple-800">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
            الربط المحاسبي المباشر بشجرة الحسابات:
          </span>
          <span className="bg-white/90 border border-purple-200 px-2.5 py-0.5 rounded-lg text-[11px] font-mono text-slate-800 shadow-2xs">
            مدين: 1301 (المخزون السلعي والمشتريات)
          </span>
          <span className="bg-white/90 border border-purple-200 px-2.5 py-0.5 rounded-lg text-[11px] font-mono text-slate-800 shadow-2xs">
            مدين: 2102 (ضريبة القيمة المضافة)
          </span>
          <span className="bg-white/90 border border-purple-200 px-2.5 py-0.5 rounded-lg text-[11px] font-mono text-slate-800 shadow-2xs">
            دائن: {(invoiceType === 'CASH_PURCHASES' || invoiceType === 'CASH' || paymentMethod === 'CASH') ? '1101 (الصندوق الرئيسي)' : '2101 (ذمم الموردين والدائنين)'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'chartTree' } }))}
            className="text-xs font-bold text-purple-800 hover:text-purple-950 hover:underline flex items-center gap-1 cursor-pointer bg-white/70 px-2.5 py-1 rounded-lg border border-purple-200/60"
            title="الانتقال لشجرة الحسابات المالية"
          >
            <span>شجرة الحسابات (1301) 🌳</span>
          </button>
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
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                    <th className="py-2.5 px-3 font-bold">رقم الفاتورة</th>
                    <th className="py-2.5 px-3 font-bold">المورد</th>
                    <th className="py-2.5 px-3 font-bold">رقم فاتورة المورد</th>
                    <th className="py-2.5 px-3 font-bold">التاريخ</th>
                    <th className="py-2.5 px-3 font-bold">الإجمالي</th>
                    <th className="py-2.5 px-3 font-bold">الحالة</th>
                    <th className="py-2.5 px-3 font-bold text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {savedInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-emerald-800">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-800">
                        {inv.partnerName}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600">
                        {inv.supplierRef || '-'}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600">
                        {inv.date}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">
                        {inv.totals?.grandTotal?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} {currencySymbol}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          inv.status === 'POSTED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {inv.status === 'POSTED' ? 'مرحلة ومعتمدة' : 'مسودة'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              handleEditInvoice(inv);
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-emerald-600 hover:text-white rounded text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
                            title="تحميل وعرض الفاتورة"
                          >
                            عرض
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomPreviewData({
                                ...inv,
                                type: 'PURCHASE',
                                title: 'فاتورة مشتريات'
                              });
                              setShowPrintPreview(true);
                            }}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white rounded text-indigo-700 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="معاينة الفاتورة قبل الطباعة"
                          >
                            <Eye size={12} />
                            <span>معاينة</span>
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
                            className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded transition-colors cursor-pointer"
                            title="حذف الفاتورة من النظام"
                          >
                            <Trash2 size={13} />
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
        
        {/* Compact Clean Parameters Section (Eliminate Box-in-a-box) */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 print:hidden">
          {/* Row 1: Vendor Selection, Invoice Number & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 text-xs mb-3">
            {/* Vendor Select with Quick Action Bar (Col Span 5) */}
            <div className="lg:col-span-5 flex flex-col justify-center">
              <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 shrink-0">
                    <Truck size={13} className="text-emerald-700" />
                    <span>المورد:</span>
                  </label>

                  {selectedPartner && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-slate-500 font-medium">
                        {status === 'POSTED' || !isEditMode ? 'الرصيد وقت الإصدار:' : 'الرصيد الحالي:'}
                      </span>
                      <span className={`font-mono font-bold ${
                        displayPartnerBalance > 0 
                          ? 'text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200' 
                          : displayPartnerBalance < 0 
                          ? 'text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200' 
                          : 'text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded'
                      }`}>
                        {Math.abs(displayPartnerBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                        {' '}({displayPartnerBalance > 0 ? 'دائن له' : displayPartnerBalance < 0 ? 'مدين عليه' : 'خالص'})
                      </span>
                      {selectedPartner.creditLimit ? (
                        <>
                          <span className="text-slate-300">|</span>
                          <span className="text-slate-500 font-medium">الحد الائتماني:</span>
                          <span className="font-mono font-bold text-slate-800">
                            {Number(selectedPartner.creditLimit).toLocaleString()} {currencySymbol}
                          </span>
                        </>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setSelectedPartnerForStatementModal(selectedPartner)}
                        className="text-[10px] font-bold text-emerald-800 hover:underline px-1 shrink-0 cursor-pointer"
                        title="فتح كشف حساب المورد"
                      >
                        كشف حساب
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {selectedPartner?.taxNumber && (
                    <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      ضريبي: {selectedPartner.taxNumber}
                    </span>
                  )}
                  {hasPartnerError && (
                    <span className="text-rose-600 text-[10px] font-bold animate-pulse">
                      يرجى اختيار المورد
                    </span>
                  )}
                </div>
              </div>

              {/* Vendor Select and Quick Add Button (+) */}
              <div className="flex items-center gap-1.5">
                <select
                  disabled={!isEditable}
                  required
                  value={partnerId}
                  onChange={e => {
                    setPartnerId(e.target.value);
                    if (e.target.value) setHasPartnerError(false);
                    if (status === 'DRAFT') setPartnerBalanceSnapshot(null);
                  }}
                  className={`flex-1 h-10 bg-white border ${
                    hasPartnerError ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
                  } px-3 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 shadow-2xs`}
                >
                  <option value="">-- اختر المورد أو اضغط + للإضافة السريعة --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                {/* Quick Add Vendor Button */}
                {isEditable && (
                  <button
                    type="button"
                    onClick={() => setShowQuickAddVendorModal(true)}
                    className="h-10 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                    title="إضافة مورد جديد فوراً دون مغادرة الفاتورة"
                  >
                    <Plus size={14} />
                    <span className="hidden sm:inline">مورد جديد</span>
                  </button>
                )}
              </div>
            </div>

            {/* Invoice Number (Col Span 3) - in Row 1 after Vendor & New Vendor button */}
            <div className="lg:col-span-3 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Hash size={13} className="text-emerald-700" />
                  <span>رقم الفاتورة:</span>
                </label>
                <span className="text-[10px] text-emerald-800 font-bold font-mono">تلقائي</span>
              </div>
              <input
                type="text"
                disabled={true}
                value={invoiceNumber}
                className="w-full h-10 bg-slate-100 border border-slate-300 px-3 rounded-xl font-mono font-bold text-slate-900 text-center text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-emerald-600 shadow-2xs transition-colors"
              />
            </div>

            {/* Issue Date (Col Span 2) */}
            <div className="lg:col-span-2 flex flex-col justify-center">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                <Calendar size={13} className="text-emerald-700" />
                <span>تاريخ التوريد:</span>
              </label>
              <input
                type="date"
                disabled={!isEditable}
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 px-3 rounded-xl text-slate-900 font-mono font-bold text-xs sm:text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 shadow-2xs"
              />
            </div>

            {/* Due Date (Col Span 2) */}
            <div className="lg:col-span-2 flex flex-col justify-center">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                <Calendar size={13} className="text-amber-600" />
                <span>تاريخ الاستحقاق:</span>
              </label>
              <input
                type="date"
                disabled={!isEditable}
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 px-3 rounded-xl text-slate-900 font-mono font-bold text-xs sm:text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 shadow-2xs"
              />
            </div>
          </div>

          {/* Row 2: Parameters Grid (Payment Method, Safe, Classification, Warehouse Destination, Service Type, Cost Center) - Below Vendor Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            {/* 1. Payment Method */}
            <div>
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                <CreditCard size={13} className="text-emerald-600" />
                <span>طريقة السداد:</span>
              </label>
              <select
                disabled={!isEditable}
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as any)}
                className="w-full h-10 bg-white border border-slate-300 px-2.5 rounded-xl text-slate-900 font-bold text-xs sm:text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 shadow-2xs"
              >
                {PAYMENT_METHODS_LIST.map(pm => (
                  <option key={pm.id} value={pm.id}>{pm.label}</option>
                ))}
              </select>
            </div>

            {/* 2. Safe / Cashbox */}
            <div>
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                <Landmark size={13} className="text-teal-600" />
                <span>خزنة الدفع والسداد:</span>
              </label>
              <select
                disabled={!isEditable}
                value={safe}
                onChange={e => setSafe(e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 px-2.5 rounded-xl text-slate-900 font-bold text-xs sm:text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 shadow-2xs"
              >
                {dynamicSafesList.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* 3. Classification & Tax Rate */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Percent size={13} className="text-purple-600" />
                  <span>التصنيف والضريبة:</span>
                </label>
              </div>
              <div className="flex items-center gap-1.5">
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
                  className="w-full h-10 bg-white border border-slate-300 px-2.5 rounded-xl text-slate-900 font-bold text-xs sm:text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 shadow-2xs"
                >
                  <option value="TAX">ضريبية</option>
                  <option value="NORMAL">عادية</option>
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
                    className="w-14 h-10 bg-white border border-slate-300 px-1 rounded-xl text-center font-mono font-bold text-xs sm:text-sm focus:outline-none focus:border-emerald-600 shadow-2xs"
                    placeholder="15"
                  />
                )}
              </div>
            </div>

            {/* 4. Warehouse Destination */}
            <div>
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                <Warehouse size={13} className="text-amber-600" />
                <span>وجهة المخزون والتوريد:</span>
              </label>
              <select
                disabled={!isEditable}
                value={source}
                onChange={e => setSource(e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 px-2.5 rounded-xl text-slate-900 font-bold text-xs sm:text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 shadow-2xs"
              >
                {getDynamicWarehousesList([source]).map(w => (
                  <option key={w.id} value={w.id}>{w.label}</option>
                ))}
              </select>
            </div>

            {/* 5. Service Type */}
            <div>
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                <Briefcase size={13} className="text-cyan-600" />
                <span>نوع الخدمة / العملية:</span>
              </label>
              <select
                disabled={!isEditable}
                value={serviceType}
                onChange={e => setServiceType(e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 px-2.5 rounded-xl text-slate-900 font-bold text-xs sm:text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 shadow-2xs"
              >
                <option value="">-- بدون خدمة إضافية --</option>
                <option value="توريد بضائع ومخزون">توريد بضائع ومخزون</option>
                <option value="شحن ونقل">شحن ونقل</option>
                <option value="صيانة وتشغيل">صيانة وتشغيل</option>
                <option value="تركيب وتجهيز">تركيب وتجهيز</option>
                <option value="استشارات">استشارات</option>
                <option value="خدمات عامة">خدمات عامة</option>
                <option value="دعم فني">دعم فني</option>
              </select>
            </div>

            {/* 6. Cost Center / Branch */}
            <div>
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                <BarChart3 size={13} className="text-indigo-600" />
                <span>مركز التكلفة / الفرع:</span>
              </label>
              <select
                disabled={!isEditable}
                value={costCenterId}
                onChange={e => setCostCenterId(e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 px-2.5 rounded-xl text-slate-900 font-bold text-xs sm:text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 shadow-2xs"
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
        <div className="border-b-2 border-slate-700 bg-white">
          {/* Table Header Action Bar (Integrated) */}
          <div className="px-3 py-1.5 bg-gradient-to-r from-slate-950 via-emerald-950 to-slate-950 text-white flex flex-wrap items-center justify-between gap-2 border-b border-emerald-900/60 print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-emerald-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                جدول بنود وأصناف فاتورة المشتريات
              </span>
              <span className="text-[10px] text-emerald-200 bg-emerald-900/70 border border-emerald-400/30 px-2 py-0.5 rounded font-mono font-bold">
                {items.length} بنود
              </span>
            </div>

            {/* Actions: Add Item, Voice, Scanner */}
            {isEditable ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="h-7 px-2.5 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer border border-emerald-400/40"
                  title="إضافة بند جديد للفاتورة (F2)"
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
                  title="إملاء الأصناف والكميات بالصوت"
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
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowBarcodeScannerModal(true)}
                  className="h-7 px-2.5 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer border border-purple-400/40"
                  title="مسح باركود الأصناف بالكاميرا (F3)"
                >
                  <Scan size={13} className="text-purple-200" />
                  <span>ماسح الباركود (F3)</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[11px] text-slate-300">
                <Lock size={12} className="text-amber-400" />
                <span>الفاتورة مقفلة (اضغط تعديل لإضافة بنود)</span>
              </div>
            )}
          </div>

          {isDictatingItems && (
            <div className="bg-rose-50 border-b border-rose-200 px-3 py-1 flex items-center gap-2 animate-fadeIn print:hidden">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0"></span>
              <span className="text-xs text-rose-800 font-bold truncate">
                {dictationTranscript ? `جاري السماع: "${dictationTranscript}"` : 'تحدث الآن بإملاء الأصناف والكميات والأسعار...'}
              </span>
            </div>
          )}

          <div className="overflow-x-auto min-h-[140px] max-h-[38vh]">
            <table className="w-full text-right border-collapse min-w-[860px]">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-[11px] font-bold text-slate-200 uppercase tracking-wider sticky top-0 z-10">
                  <th className="py-2.5 px-2.5 w-10 text-center border-l border-slate-800 bg-slate-950 text-slate-300">#</th>
                  <th className="py-2.5 px-3 border-l border-slate-800 w-64 md:w-72 lg:w-80 min-w-[180px] max-w-[320px] text-emerald-300 font-bold">الصنف / المادة المشتراة</th>
                  <th className="py-2.5 px-2.5 w-24 text-center border-l border-slate-800 bg-slate-850 text-teal-300 print:hidden" title="الكمية المتوفرة حالياً في المخزن">
                    بالمخزن
                  </th>
                  <th className="py-2.5 px-2.5 w-24 text-left border-l border-slate-800 bg-slate-850 text-emerald-300 print:hidden" title="متوسط سعر التكلفة المرجح الحالي للصنف بالمخزن">
                    <div className="flex items-center justify-between gap-1">
                      <span>(م.س.ت)</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCostPriceColumn(prev => {
                            const next = !prev;
                            try { localStorage.setItem('alpha_purchases_show_cost', String(next)); } catch {}
                            return next;
                          });
                        }}
                        className="p-0.5 hover:bg-slate-800 text-emerald-300 hover:text-white rounded transition-colors cursor-pointer"
                        title={showCostPriceColumn ? 'إخفاء متوسط التكلفة الحالي' : 'إظهار متوسط التكلفة الحالي'}
                      >
                        {showCostPriceColumn ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                    </div>
                  </th>
                  <th className="py-2.5 px-2.5 w-36 sm:w-40 lg:w-44 text-center border-l border-slate-800 text-white font-bold">الكمية</th>
                  <th className="py-2.5 px-2 w-20 text-center border-l border-slate-800 text-slate-200" title="الوحدة الأساسية للبند">
                    الوحدة
                  </th>
                  <th className="py-2.5 px-2.5 w-24 sm:w-28 lg:w-32 text-left border-l border-slate-800 text-emerald-300 font-bold">سعر الشراء</th>
                  <th className="py-2.5 px-2.5 w-28 text-center border-l border-slate-800 text-teal-200" title="خصم خاص على مستوى هذا البند فقط">
                    خصم البند
                  </th>
                  {classification === 'TAX' && (
                    <th className="py-2.5 px-2 w-16 text-center border-l border-slate-800 text-emerald-300 font-bold">الضريبة %</th>
                  )}
                  <th className="py-2.5 px-3 w-28 text-left border-l border-slate-800 text-white font-bold">الإجمالي ({currencySymbol})</th>
                  <th className="py-2.5 px-2 w-12 text-center print:hidden border-l border-slate-800 text-rose-300">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 text-xs">
              {items.map((item, index) => {
                const qty = Number(item.quantity) || 0;
                const unitPurchasePrice = Number(item.unitPrice) || 0;
                const grossLine = qty * unitPurchasePrice;
                const itemDisc = Number(item.itemDiscount) || 0;
                const itemDiscAmount = item.itemDiscountType === 'PERCENT'
                  ? (grossLine * (Math.max(0, Math.min(100, itemDisc)) / 100))
                  : Math.min(grossLine, Math.max(0, itemDisc));
                const lineTotal = Math.max(0, grossLine - itemDiscAmount);

                const itemInfo = resolvePurchaseItemStockAndCost(item, itemsCatalog, source, status === 'POSTED' || !isEditMode);
                const costDiff = unitPurchasePrice - itemInfo.costPrice;

                
  


return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-300">
                    {/* Index */}
                    <td className="py-3 px-3 text-center text-slate-800 font-mono font-black border-l border-slate-300 bg-slate-100">
                      #{index + 1}
                    </td>

                    {/* Description Autocomplete (No redundant delete button) */}
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
                                unit: selectedItem.unit || 'حبة / قطعة',
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
                              const targetId = item.itemId || itemsCatalog.find(i => i.code === item.itemCode || (i.name || '').trim().toLowerCase() === (item.description || '').trim().toLowerCase())?.id;
                              if (targetId) setAnalyticItemId(targetId);
                            }}
                            className="p-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 transition-all shrink-0 print:hidden flex items-center justify-center cursor-pointer shadow-2xs"
                            title="تحليل أسعار التوريد، التكلفة، ومعدلات السحب والربحية"
                          >
                            <BarChart3 size={13} />
                          </button>
                        )}
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
                          {showCostPriceColumn ? (
                            <span className="font-mono text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-400 shadow-2xs">
                              {itemInfo.costPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono tracking-widest text-[11px] select-none" title="التكلفة مخفية">
                              ••••••
                            </span>
                          )}
                          {showCostPriceColumn && unitPurchasePrice > 0 && itemInfo.costPrice > 0 && (
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

                    {/* الكمية */}
                    <td className="py-2 px-3 text-center border-l border-slate-300 w-36 sm:w-40 lg:w-44">
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
                        className="w-full bg-white h-9 px-1.5 rounded-xl border-2 border-slate-500 text-center font-mono font-bold text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-100 disabled:border-slate-300"
                      />
                    </td>

                    {/* الوحدة */}
                    <td className="py-2 px-2 text-center border-l border-slate-300 bg-white">
                      <select
                        disabled={!isEditable}
                        value={item.unit || itemInfo.unit || 'حبة / قطعة'}
                        onChange={e => handleUpdateItem(item.id, { unit: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg h-9 text-center font-bold text-slate-800 text-xs focus:outline-none focus:border-emerald-600 disabled:bg-slate-100 shadow-2xs"
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

                    {/* سعر الشراء */}
                    <td className="py-2 px-3 text-left border-l border-slate-300 w-24 sm:w-28 lg:w-32">
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
                        className="w-full bg-white h-9 px-2 rounded-xl border-2 border-slate-500 text-left font-mono font-bold text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dir-ltr disabled:bg-slate-100 disabled:border-slate-300"
                      />
                    </td>

                    {/* خصم البند */}
                    <td className="py-2 px-2 text-center border-l border-slate-300 bg-teal-50/20">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={!isEditable}
                          value={item.itemDiscount ?? ''}
                          onFocus={e => e.target.select()}
                          onChange={e => handleItemChange(item.id, 'itemDiscount', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                          onBlur={() => {
                            if (item.itemDiscount === '' || isNaN(Number(item.itemDiscount))) {
                              handleItemChange(item.id, 'itemDiscount', 0);
                            }
                          }}
                          placeholder="0"
                          className="w-16 bg-white h-9 px-1 rounded-lg border border-slate-400 text-center font-mono font-bold text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-emerald-600 disabled:bg-slate-100"
                        />
                        <button
                          type="button"
                          disabled={!isEditable}
                          onClick={() => {
                            const newType = item.itemDiscountType === 'PERCENT' ? 'AMOUNT' : 'PERCENT';
                            handleUpdateItem(item.id, { itemDiscountType: newType });
                          }}
                          className={`h-9 px-2 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50 cursor-pointer shrink-0 flex items-center justify-center ${
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

                    {/* الضريبة */}
                    {classification === 'TAX' && (
                      <td className="py-2 px-3 text-center border-l border-slate-300">
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
                          className="w-full bg-white h-9 px-1 rounded-xl border-2 border-slate-500 font-mono text-center font-bold text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-slate-900 disabled:bg-slate-100 disabled:border-slate-300"
                        />
                      </td>
                    )}

                    {/* الإجمالي */}
                    <td className="py-2 px-4 text-left font-mono font-black text-slate-950 text-sm border-l border-slate-300 bg-slate-50/70">
                      {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* زر الحذف الوحيد في عمود الإجراءات */}
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

                </div>

{/* Two-Column Footer Grid (Summary & Payments | Notes & Terms) - items-stretch for Equal Height */}
      <div className="p-3 sm:p-4 border-t border-slate-300 bg-slate-100/70 grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch mt-auto print:hidden">
        {/* Column 1: Financial Summary & Payments - Elegant Comfortable Navy Background (#0b132b) */}
        <div className="lg:col-span-8 bg-[#0b132b] text-white p-4 rounded-2xl border border-slate-700/80 shadow-md flex flex-col justify-between h-full gap-3">
          {/* Header Cards in Proper Accounting Sequence: (1) Gross Total -> (2) Discount -> (3) Shipping -> (4) Tax */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs border-b border-slate-700/70 pb-3">
            {/* 1. الإجمالي قبل الخصم (Gross Items Total) */}
            <div className="bg-[#131d3b] p-2.5 rounded-xl border border-slate-700/70 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 block font-bold">1. الإجمالي قبل الخصم:</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-mono font-bold text-white text-sm sm:text-base">
                  {totals.grossItemsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">{currencySymbol}</span>
              </div>
            </div>

            {/* 2. الخصم المكتسب */}
            <div className="bg-[#131d3b] p-2.5 rounded-xl border border-slate-700/70 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] text-slate-300 font-bold">2. الخصم المكتسب:</span>
                <button
                  type="button"
                  disabled={!isEditable}
                  onClick={() => setDiscountType(prev => prev === 'PERCENT' ? 'AMOUNT' : 'PERCENT')}
                  className="px-1.5 py-0.5 rounded bg-[#070d1e] text-slate-300 border border-slate-700 text-[10px] font-bold font-mono hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
                  title="التبديل بين نسبة مئوية أو مبلغ ثابت"
                >
                  {discountType === 'PERCENT' ? '% نسبة' : `${currencySymbol} مبلغ`}
                </button>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="number"
                  min="0"
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
                  className="w-full text-right bg-[#070d1e] border border-slate-600 focus:border-emerald-400 rounded-lg px-2.5 py-1 text-sm font-mono font-bold text-white focus:outline-none disabled:opacity-50 transition-colors"
                />
              </div>
              {totals.itemsDiscountTotal > 0 && (
                <span className="text-[10px] text-slate-400 font-mono block mt-1 font-bold">
                  + بنود: {totals.itemsDiscountTotal.toFixed(2)}
                </span>
              )}
            </div>

            {/* 3. مصاريف الشحن / النقل */}
            <div className="bg-[#131d3b] p-2.5 rounded-xl border border-slate-700/70 flex flex-col justify-between">
              <span className="text-[11px] text-slate-300 block font-bold">3. مصاريف الشحن:</span>
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={!isEditable}
                  value={shippingCost}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    const raw = e.target.value;
                    setShippingCost(raw === '' ? '' : Math.max(0, Number(raw)));
                  }}
                  onBlur={() => {
                    if (shippingCost === '' || isNaN(Number(shippingCost))) {
                      setShippingCost(0);
                    }
                  }}
                  placeholder="0.00"
                  className="w-full text-right bg-[#070d1e] border border-slate-600 focus:border-emerald-400 rounded-lg px-2.5 py-1 text-sm font-mono font-bold text-white focus:outline-none disabled:opacity-50 transition-colors"
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

          {/* 5. صافي القيمة الإجمالية (Grand Total) - Clean & Calibrated Colors */}
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

          {/* Payment & Settlement Area - Distinct Input + Quick Buttons + Clear Badge */}
          <div className="pt-2 border-t border-slate-700/70">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              {/* 1. Paid Amount Input (Col Span 7) */}
              <div className="sm:col-span-7 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <CreditCard size={13} className="text-emerald-400" />
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
                    className="w-full bg-[#070d1e] border-2 border-slate-600 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-base font-mono font-bold text-white text-left focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all disabled:opacity-50"
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

        {/* Column 2: Notes & Vendor Financial Impact - Matches Height with Column 1 (items-stretch) */}
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
                placeholder="اكتب هنا أي ملاحظات أو شروط للتوريد والاستلام..."
                className="w-full flex-1 min-h-[60px] bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white resize-none transition-colors disabled:bg-slate-100"
              />
            </div>
          </div>

          {/* Vendor Statement Impact Card (Compact) */}
          {selectedPartner && partnerBalanceImpact && (
            <div className="bg-white p-3 rounded-2xl border border-slate-300 shadow-2xs text-xs space-y-2 shrink-0">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-900 font-bold flex items-center gap-1 text-[11px]">
                  <Truck size={12} className="text-emerald-700" />
                  <span>موقف حساب المورد:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPartnerForStatementModal(selectedPartner)}
                  className="text-[10px] text-emerald-800 hover:underline font-bold cursor-pointer"
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
                  <span className="font-bold text-emerald-700">+{partnerBalanceImpact.remainingAmountFormatted}</span>
                </div>
                <div className="bg-emerald-50 p-1.5 rounded-xl border border-emerald-200">
                  <span className="text-[9px] text-emerald-800 block font-sans font-bold">الرصيد النهائي</span>
                  <span className="font-black text-emerald-800">{partnerBalanceImpact.newBalanceFormatted}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>    </div>

      {/* Quick Add Vendor Modal */}
      {showQuickAddVendorModal && (
        <div className="fixed inset-0 z-[99900] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <User size={18} />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">إضافة مورد جديد سريعاً</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddVendorModal(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveQuickVendor} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المورد / الشركة *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={quickVendorName}
                  onChange={e => setQuickVendorName(e.target.value)}
                  placeholder="مثال: شركة التوريدات المتقدمة"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الهاتف / الجوال</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={quickVendorPhone}
                    onChange={e => setQuickVendorPhone(e.target.value)}
                    placeholder="05XXXXXXXX"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الرقم الضريبي</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={quickVendorTaxNo}
                    onChange={e => setQuickVendorTaxNo(e.target.value)}
                    placeholder="3XXXXXXXXXXXXXX"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الحد الائتماني (اختياري)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={quickVendorCreditLimit}
                  onChange={e => setQuickVendorCreditLimit(e.target.value)}
                  placeholder="مثال: 50000"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-mono font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">العنوان / المدينة</label>
                <input
                  type="text"
                  value={quickVendorAddress}
                  onChange={e => setQuickVendorAddress(e.target.value)}
                  placeholder="جدة - المنطقة الصناعية..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowQuickAddVendorModal(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Save size={14} />
                  <span>حفظ واختيار المورد</span>
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
        mode="PURCHASES"
        itemsCatalog={itemsCatalog}
        onScanItem={handleScanItem}
        currentInvoiceItemsCount={items.filter(i => Boolean(i.description)).length}
      />

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
                ? `هل أنت متأكد من حذف فاتورة المشتريات رقم (${deleteModal.invoiceNumber}) نهائياً؟ تنبيه: هذه الفاتورة مرحلة ومعتمدة، وسيؤدي تأكيد الحذف إلى إلغاء ترحيلها تلقائياً، إرجاع كميات المخزون وتحديث أرصدة المورد.`
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
