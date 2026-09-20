import { useState, useMemo, useEffect } from 'react';
import { 
  Save, Plus, Trash2, CheckCircle2, RotateCcw, 
  History, Printer, Calendar, User, X, Edit3, Eye, Lock,
  FileDown, Loader2, Keyboard, FileText, CreditCard,
  AlertCircle, AlertTriangle, Info, RefreshCw, BarChart3,
  ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft
} from 'lucide-react';
import PrintDropdown from './PrintDropdown';
import PrintPreviewModal, { PrintPreviewData } from './PrintPreviewModal';
import PartnerStatementModal from './PartnerStatementModal';
import ItemAnalyticsModal from './ItemAnalyticsModal';
import { 
  getNextSequentialNumber, 
  advanceSequenceAfterSave, 
  DB_SALES_INVOICES_KEY,
  DB_ITEMS_KEY
} from '../utils/sequences';
import { notifyDataChanged } from '../utils/localFolderBackup';
import { Partner } from '../types/accounting';
import ItemAutocomplete from './ItemAutocomplete';
import { Item } from './Items';
import { loadStoredItems } from '../utils/itemsStore';
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

export function resolveItemStockAndCost(item: InvoiceItem, catalog: Item[]): { stock: number; costPrice: number; unit: string; matched: boolean } {
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
        (sItem.description && it.name.trim().toLowerCase() === sItem.description.trim().toLowerCase())
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
        (sItem.description && it.name.trim().toLowerCase() === sItem.description.trim().toLowerCase())
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
  const [selectedPartnerForStatementModal, setSelectedPartnerForStatementModal] = useState<Partner | null>(null);

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
    return () => {
      window.removeEventListener('alpha-partner-ledger-updated', handleSync);
      window.removeEventListener('alpha-system-reset-completed', handleSync);
      window.removeEventListener('alpha-sales-invoices-updated', handleSync);
      window.removeEventListener('alpha-items-updated', handleSync);
      window.removeEventListener('alpha-device-id-changed', handleSync);
      window.removeEventListener('alpha-sequences-updated', handleSync);
      window.removeEventListener('storage', handleSync);
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
  const [customPreviewData, setCustomPreviewData] = useState<PrintPreviewData | null>(null);
  const [analyticItemId, setAnalyticItemId] = useState<string | null>(null);

  // In-App Toast & Confirmation Modal States (eliminates browser popup issues)
  const [toast, setToast] = useState<{ id: number; type: 'success' | 'error' | 'warning' | 'info'; title: string; message?: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; invoiceId?: string | null | undefined; invoiceNumber: string; isNewDraft?: boolean } | null>(null);
  const [hasPartnerError, setHasPartnerError] = useState<boolean>(false);
  const [invoiceNumberError, setInvoiceNumberError] = useState<string | null>(null);

  const showToast = (t: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message?: string }) => {
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
  const [classification, setClassification] = useState<'NORMAL' | 'TAX'>((defaultInvoiceSettings.salesClassification as 'NORMAL' | 'TAX') || 'TAX');
  const [taxRate, setTaxRate] = useState<number>(defaultSysTaxRate);
  const [invoiceType, setInvoiceType] = useState<string>(defaultInvoiceSettings.salesTransactionType || 'CREDIT_SALES');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [source, setSource] = useState<string>(defaultInvoiceSettings.salesWarehouse || 'MAIN_WAREHOUSE');
  const [safe, setSafe] = useState<string>(defaultInvoiceSettings.salesSafe || 'MAIN_SAFE');
  const [serviceType, setServiceType] = useState<string>(defaultInvoiceSettings.salesServiceType || '');
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: 'item-' + Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: defaultSysTaxRate, availableStock: 0, costPrice: 0 }
  ]);

  const selectedPartner = useMemo(() => {
    return customers.find(c => c.id === partnerId || c.name === partnerId);
  }, [customers, partnerId]);

  // Live account statement for selected customer
  const selectedPartnerStatement = useMemo(() => {
    if (!selectedPartner) return null;
    return getPartnerAccountStatement(selectedPartner);
  }, [selectedPartner, savedInvoices]);

  const handleNewInvoice = (customList?: StoredSalesInvoice[] | unknown) => {
    const currSettings = getSystemSettings();
    const currentDefaults = currSettings.invoiceDefaults || {};
    const sysTax = currSettings.taxAndInvoice?.defaultVatRate !== undefined ? currSettings.taxAndInvoice.defaultVatRate : 15;
    setEditingInvoiceId(null);
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
    setClassification((currentDefaults.salesClassification as 'NORMAL' | 'TAX') || 'TAX');
    setTaxRate(sysTax);
    setInvoiceType(currentDefaults.salesTransactionType || 'CREDIT_SALES');
    setSource(currentDefaults.salesWarehouse || 'MAIN_WAREHOUSE');
    setSafe(currentDefaults.salesSafe || 'MAIN_SAFE');
    setServiceType(currentDefaults.salesServiceType || '');
    setPaidAmount(0);
    setDiscount(0);
    setItems([{ id: 'item-' + Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: sysTax, availableStock: 0, costPrice: 0 }]);
    setItemsCatalog(loadStoredItems());
  };

  const handleEditInvoice = (inv: StoredSalesInvoice) => {
    setEditingInvoiceId(inv.id);
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
    setNotes(inv.notes || '');
    setStatus(inv.status);
    // If draft, open directly in edit mode for immediate editing; if posted, lock
    setIsEditMode(inv.status !== 'POSTED');
    const initialPaid = inv.totals?.cashPaid !== undefined 
      ? inv.totals.cashPaid 
      : (inv.invoiceType === 'CASH_SALES' ? inv.totals.grandTotal : 0);
    setPaidAmount(initialPaid);
    setDiscount(inv.totals?.discountTotal || 0);
    setItems(inv.items.length > 0 ? inv.items : [{ id: 'item-' + Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: resolvedTaxRate, availableStock: 0, costPrice: 0 }]);
    setItemsCatalog(loadStoredItems());
    setShowInvoicesHistory(false);
  };

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
    let totalCost = 0;

    items.forEach(item => {
      const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      const taxRate = classification === 'TAX' ? (Number(item.taxRate) || 0) : 0;
      const lineTax = lineTotal * (taxRate / 100);
      subtotal += lineTotal;
      taxTotal += lineTax;

      const itemInfo = resolveItemStockAndCost(item, itemsCatalog);
      totalCost += (Number(item.quantity) || 0) * itemInfo.costPrice;
    });

    const discountTotal = Math.max(0, Number(discount) || 0);
    const grandTotal = Math.max(0, subtotal + taxTotal - discountTotal);
    const grossProfit = subtotal - totalCost - discountTotal;
    const profitMargin = subtotal > 0 ? (grossProfit / subtotal) * 100 : 0;
    const cleanPaid = Math.max(0, Math.min(grandTotal, Number(paidAmount) || 0));
    const remainingBalance = Math.max(0, grandTotal - cleanPaid);

    return { 
      subtotal, 
      taxTotal, 
      discountTotal,
      grandTotal,
      totalCost,
      grossProfit,
      profitMargin,
      cashPaid: cleanPaid,
      remainingBalance
    };
  }, [items, classification, itemsCatalog, paidAmount, discount]);

  // Handler when user edits paid amount
  const handlePaidAmountChange = (val: number) => {
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
    subtitle: status === 'POSTED' ? 'فاتورة مرحلة ومعتمدة نظامياً' : 'مسودة فاتورة قيد الإعداد',
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
    const invoiceRecord: StoredSalesInvoice = {
      id: newId,
      invoiceNumber: finalNumber,
      date,
      dueDate,
      partnerId,
      partnerName: partnerObj?.name || 'عميل نقدي',
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
      const updatedList = deductItemsStockOnSale(items);
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
    if (status === 'POSTED') {
      showToast({
        type: 'error',
        title: '🔒 لا يمكن حذف فاتورة مرحلة!',
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
        message: 'تمت إفراغ الحقول والبدء بفاتورة جديدة فارغة.'
      });
    } else {
      const targetNumber = deleteModal.invoiceNumber;
      const targetId = deleteModal.invoiceId;
      const targetInv = savedInvoices.find(i => (targetId && i.id === targetId) || (i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === targetNumber.trim().toLowerCase()));
      if (targetInv && targetInv.status === 'POSTED') {
        showToast({
          type: 'error',
          title: '🔒 لا يمكن حذف فاتورة مرحلة!',
          message: 'الفاتورة مرحلة ومعتمدة نظامياً. يرجى إلغاء ترحيل الفاتورة أولاً لتتمكن من حذفها.'
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
        title: `تم حذف الفاتورة رقم (${targetNumber}) نهائياً بنجاح!`
      });
    }
    setDeleteModal(null);
  };

  // Global Keyboard Shortcuts (Ctrl+S, Ctrl+P, Ctrl+N, Ctrl+Enter, F2, Ctrl+H, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    <div className="flex flex-col flex-1 h-full max-w-7xl mx-auto w-full">
      {/* Top Application Bar */}
      {/* Top Application Bar */}
      <div className="flex flex-col gap-3 mb-4 print:hidden">
        {/* Breadcrumb & Screen Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2 mb-1 text-blue-900/80 text-xs font-bold">
              <span>العملاء والمبيعات</span>
              <span>/</span>
              <span className="text-blue-950 font-extrabold">فواتير المبيعات</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900 bg-clip-text text-transparent">
                فاتورة المبيعات
              </h1>
              <span className={`px-2.5 py-1 text-xs font-black rounded-lg border shadow-2xs ${
                status === 'POSTED' 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                  : isEditMode
                  ? 'bg-blue-50 text-blue-950 border-blue-950'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}>
                {status === 'POSTED' ? 'مرحلة ومعتمدة' : isEditMode ? 'مسودة قيد التحرير' : 'مسودة (وضع العرض)'}
              </span>
              {editingInvoiceId && (
                <span className="px-2.5 py-1 text-xs font-black rounded-lg bg-blue-50 text-blue-900 border border-blue-950 flex items-center gap-1 shadow-2xs">
                  <Edit3 size={12} className="text-blue-900" /> تعديل #{invoiceNumber}
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
                    className="p-1.5 text-slate-600 hover:text-blue-950 hover:bg-slate-200/60 disabled:opacity-30 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                    title="الفاتورة الأولى (الأقدم)"
                  >
                    <ChevronsRight size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNavigatePrevious}
                    disabled={!canGoPrevious}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-black text-blue-950 bg-white hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-200 shadow-2xs"
                    title="تراجع للخلف - الفاتورة السابقة (PageUp / Alt+Right)"
                  >
                    <ChevronRight size={14} className="text-blue-900" />
                    <span>تراجع للخلف</span>
                  </button>

                  <div className="px-2.5 py-1 text-[11px] font-mono font-black text-blue-950 bg-blue-50/80 rounded-lg mx-0.5 select-none border border-blue-200 whitespace-nowrap">
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
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-black text-blue-950 bg-white hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-200 shadow-2xs"
                    title="تقديم للأمام - الفاتورة التالية (PageDown / Alt+Left)"
                  >
                    <span>تقديم للأمام</span>
                    <ChevronLeft size={14} className="text-blue-900" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNavigateLast}
                    disabled={!canGoLast}
                    className="p-1.5 text-slate-600 hover:text-blue-950 hover:bg-slate-200/60 disabled:opacity-30 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
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
                  title="تصدير الفاتورة الحالية بتنسيقها المعتمد كملف PDF"
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
                <History size={14} className={showInvoicesHistory ? 'text-blue-300' : 'text-blue-700'} />
                <span>سجل الفواتير ({savedInvoices.length})</span>
                <kbd className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-mono border border-slate-300">Ctrl+H</kbd>
              </button>

              {/* 2. إضافة فاتورة جديدة */}
              <button
                type="button"
                onClick={handleNewInvoice}
                className="btn-3d btn-3d-blue h-9 sm:h-10 px-2.5 sm:px-3.5 text-xs font-black"
                title="إضافة فاتورة جديدة (Ctrl+N)"
              >
                <Plus size={15} />
                <span>إضافة فاتورة جديدة</span>
                <kbd className="text-[9px] bg-blue-900/60 text-blue-100 px-1 py-0.5 rounded font-mono border border-blue-400/30">Ctrl+N</kbd>
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
                    className="btn-3d btn-3d-white h-9 sm:h-10 px-2.5 sm:px-3.5 text-xs font-black text-blue-950"
                    title="حفظ مسودة (Ctrl+S)"
                  >
                    <Save size={14} className="text-blue-700" />
                    <span>حفظ مسودة</span>
                    <kbd className="text-[9px] bg-blue-50 text-blue-950 px-1 py-0.5 rounded font-mono border border-blue-200">Ctrl+S</kbd>
                  </button>
                )
              )}

              {/* 4. حذف */}
              <button
                type="button"
                onClick={handleDelete}
                disabled={status === 'POSTED'}
                className="btn-3d btn-3d-danger-soft h-9 sm:h-10 px-2.5 sm:px-3 text-xs font-black"
                title={status === 'POSTED' ? 'الفاتورة مرحلة ومقفلة نظامياً. يجب إلغاء الترحيل أولاً لحذفها' : 'حذف الفاتورة أو إفراغ المسودة'}
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
                  className="p-1.5 text-slate-600 hover:text-blue-950 hover:bg-slate-200/60 disabled:opacity-30 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title="الفاتورة الأولى (الأقدم)"
                >
                  <ChevronsRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleNavigatePrevious}
                  disabled={!canGoPrevious}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-black text-blue-950 bg-white hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-200 shadow-2xs"
                  title="تراجع للخلف - الفاتورة السابقة"
                >
                  <ChevronRight size={14} className="text-blue-900" />
                  <span>السابق</span>
                </button>

                <div className="px-2 py-1 text-[11px] font-mono font-black text-blue-950 bg-blue-50/80 rounded-lg mx-0.5 select-none border border-blue-200 whitespace-nowrap">
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
                  className="flex items-center gap-1 px-2 py-1 text-xs font-black text-blue-950 bg-white hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-200 shadow-2xs"
                  title="تقديم للأمام - الفاتورة التالية"
                >
                  <span>التالي</span>
                  <ChevronLeft size={14} className="text-blue-900" />
                </button>
                <button
                  type="button"
                  onClick={handleNavigateLast}
                  disabled={!canGoLast}
                  className="p-1.5 text-slate-600 hover:text-blue-950 hover:bg-slate-200/60 disabled:opacity-30 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
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
                <History size={14} className={showInvoicesHistory ? 'text-blue-300' : 'text-blue-700'} />
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
                className="btn-3d btn-3d-blue h-9 px-3 text-xs font-black"
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
                      className="btn-3d btn-3d-white h-9 px-3 text-xs font-black text-blue-950"
                    >
                      <Save size={14} className="text-blue-700" />
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
                      <td className="py-2.5 font-mono font-bold text-blue-600">#{inv.invoiceNumber}</td>
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
                                discountTotal: inv.totals.discountTotal
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
                                  title: '🔒 لا يمكن حذف فاتورة مرحلة!',
                                  message: `الفاتورة رقم #${inv.invoiceNumber} مرحلة ومعتمدة نظامياً. يرجى فتح الفاتورة وإلغاء الترحيل أولاً لحذفها.`
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
                            title={inv.status === 'POSTED' ? 'الفاتورة مرحلة ومقفلة. يجب إلغاء الترحيل أولاً لحذفها' : 'حذف الفاتورة'}
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
      <div className={`bg-white rounded-3xl shadow-sm border-2 ${
        status === 'POSTED' ? 'border-slate-800' : 'border-blue-950'
      } overflow-hidden flex flex-col flex-1 print:border-none print:shadow-none`}>
        
        {/* Print Header (Visible Only on Print) */}
        <div className="hidden print:block p-8 border-b-2 border-slate-800">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">شركة لوجوستريا التجارية</h1>
              <p className="text-xs text-slate-500">المملكة العربية السعودية - الرياض</p>
              <p className="text-xs text-slate-500 font-mono">الرقم الضريبي: 300000000000003</p>
            </div>
            <div className="text-left">
              <h2 className="text-xl font-bold text-slate-900">
                {classification === 'TAX' ? 'فاتورة ضريبية' : 'فاتورة مبيعات'}
              </h2>
              <p className="text-sm font-bold font-mono text-slate-900 mt-1">رقم الفاتورة: #{invoiceNumber}</p>
              <p className="text-xs text-slate-500 font-mono">تاريخ الإصدار: {date}</p>
            </div>
          </div>
        </div>

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
          <div className="bg-emerald-50 border-b-2 border-emerald-300 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-900 print:hidden">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-emerald-200 text-emerald-950 font-black border border-emerald-400">✏️ وضع التعديل نشط</span>
              <span className="font-bold">
                يمكنك الآن إضافة أو حذف وتعديل الأصناف والأسعار في الفاتورة بحرية.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-3 py-1.5 bg-white border border-emerald-400 text-emerald-900 hover:bg-emerald-100 rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-2xs"
              >
                حفظ التعديلات
              </button>
            </div>
          </div>
        )}

        {/* Modern Settings / Control Strip - Colorized & Navy Blue Styled Boxes */}
        <div className="bg-slate-100/90 border-b-2 border-blue-950 p-4 sm:p-5 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5 text-xs">
            {/* Invoice Number */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-blue-950 shadow-2xs space-y-1.5 ring-2 ring-blue-50">
              <div className="flex items-center justify-between">
                <label className="text-blue-950 font-black text-[11px] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-900 inline-block"></span>
                  رقم الفاتورة
                </label>
                <div className="flex items-center gap-1">
                  {status === 'POSTED' ? (
                    <span className="text-[10px] text-slate-700 font-mono bg-slate-100 border border-blue-950 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1">
                      <Lock size={10} className="text-slate-500" />
                      <span>مقفل</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const next = nextCalculatedInvoiceNum;
                        setInvoiceNumber(next);
                        setInvoiceNumberError(null);
                        showToast({ type: 'info', title: `تم تعيين الرقم التسلسلي: ${next}` });
                      }}
                      className="text-[10px] text-blue-900 hover:text-blue-950 bg-blue-50 hover:bg-blue-100 border border-blue-950 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="استعادة الترقيم التسلسلي التلقائي التالي"
                    >
                      <RefreshCw size={10} className="text-blue-900" />
                      <span>توليد تلقائي</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleNavigatePrevious}
                  disabled={!canGoPrevious}
                  className="p-1.5 bg-blue-50 text-blue-950 hover:bg-blue-100 border border-blue-950 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  title="تراجع للخلف (السابق)"
                >
                  <ChevronRight size={14} />
                </button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    disabled={!isEditable}
                    value={invoiceNumber}
                    onChange={e => {
                      setInvoiceNumber(e.target.value);
                      setInvoiceNumberError(null);
                    }}
                    className={`w-full bg-gradient-to-r from-slate-900 to-blue-950 border ${
                      invoiceNumberError ? 'border-rose-500 ring-2 ring-rose-400' : 'border-blue-950'
                    } py-1.5 px-6 rounded-xl font-mono font-black text-blue-200 text-center select-all focus:outline-none focus:ring-2 focus:ring-blue-800 shadow-inner disabled:opacity-85 disabled:cursor-not-allowed text-xs`}
                    placeholder="INV-XXXX"
                    title="يمكنك تعديل رقم الفاتورة أو الضغط على زر توليد تلقائي"
                  />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-400 font-mono font-bold text-xs">
                    #
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleNavigateNext}
                  disabled={!canGoNext}
                  className="p-1.5 bg-blue-50 text-blue-950 hover:bg-blue-100 border border-blue-950 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  title="تقديم للأمام (التالي)"
                >
                  <ChevronLeft size={14} />
                </button>
              </div>
              {invoiceNumberError && (
                <span className="text-[10px] font-bold text-rose-600 block text-right">
                  {invoiceNumberError}
                </span>
              )}
            </div>

            {/* Classification */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-blue-950 shadow-2xs space-y-1.5 ring-2 ring-blue-50">
              <label className="text-blue-950 font-black text-[11px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-900 inline-block"></span>
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
                className="w-full bg-blue-50/40 border-2 border-blue-950 p-1.5 rounded-xl text-blue-950 font-bold focus:outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 disabled:bg-slate-100 disabled:border-slate-300"
              >
                <option value="TAX">فاتورة ضريبية</option>
                <option value="NORMAL">فاتورة عادية</option>
              </select>
            </div>

            {/* Tax Rate Percentage Field */}
            {classification === 'TAX' && (
              <div className="bg-white p-2.5 rounded-2xl border-2 border-blue-950 shadow-2xs space-y-1.5 ring-2 ring-blue-50">
                <label className="text-blue-950 font-black text-[11px] flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-900 inline-block"></span>
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
                    className="w-full bg-blue-50/40 border-2 border-blue-950 p-1.5 pr-3 pl-7 rounded-xl text-blue-950 font-bold font-mono focus:outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 disabled:bg-slate-100 disabled:border-slate-300 text-center"
                    placeholder="15"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-blue-900 pointer-events-none">%</span>
                </div>
              </div>
            )}

            {/* Invoice Type */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-blue-950 shadow-2xs space-y-1.5 ring-2 ring-blue-50">
              <label className="text-blue-950 font-black text-[11px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-900 inline-block"></span>
                نوع المعاملة
              </label>
              <select
                disabled={!isEditable}
                value={invoiceType}
                onChange={e => handleInvoiceTypeChange(e.target.value)}
                className="w-full bg-blue-50/40 border-2 border-blue-950 p-1.5 rounded-xl text-blue-950 font-bold focus:outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 disabled:bg-slate-100 disabled:border-slate-300"
              >
                <option value="CASH_SALES">مبيعات نقدية</option>
                <option value="CREDIT_SALES">مبيعات آجلة</option>
                <option value="PARTIAL_SALES">مبيعات جزئية</option>
                <option value="CASH_RETURN">مرتجع مبيعات نقدي</option>
                <option value="CREDIT_RETURN">مرتجع مبيعات آجل</option>
                <option value="QUOTATION">عرض أسعار</option>
              </select>
            </div>

            {/* Service Type */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-blue-950 shadow-2xs space-y-1.5 ring-2 ring-blue-50">
              <label className="text-blue-950 font-black text-[11px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-900 inline-block"></span>
                نوع الخدمة
              </label>
              <select
                disabled={!isEditable}
                value={serviceType}
                onChange={e => setServiceType(e.target.value)}
                className="w-full bg-blue-50/40 border-2 border-blue-950 p-1.5 rounded-xl text-blue-950 font-bold focus:outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 disabled:bg-slate-100 disabled:border-slate-300"
              >
                <option value="">-- بدون خدمة محددة --</option>
                <option value="استشارات">استشارات</option>
                <option value="تصميم">تصميم</option>
                <option value="برمجة">برمجة</option>
                <option value="صيانة">صيانة</option>
                <option value="تركيب">تركيب</option>
                <option value="دعم فني">دعم فني</option>
                <option value="خدمات عامة">خدمات عامة</option>
              </select>
            </div>

            {/* Source / Warehouse */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-blue-950 shadow-2xs space-y-1.5 ring-2 ring-blue-50">
              <label className="text-blue-950 font-black text-[11px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-900 inline-block"></span>
                مستودع التوريد
              </label>
              <select
                disabled={!isEditable}
                value={source}
                onChange={e => setSource(e.target.value)}
                className="w-full bg-blue-50/40 border-2 border-blue-950 p-1.5 rounded-xl text-blue-950 font-bold focus:outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 disabled:bg-slate-100 disabled:border-slate-300"
              >
                <option value="MAIN_WAREHOUSE">المستودع الرئيسي</option>
                <option value="SHOWROOM">معرض المبيعات</option>
                <option value="BRANCH_1">فرع الرياض</option>
              </select>
            </div>

            {/* Safe / Cashbox */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-blue-950 shadow-2xs space-y-1.5 ring-2 ring-blue-50">
              <label className="text-blue-950 font-black text-[11px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-900 inline-block"></span>
                خزنة التحصيل
              </label>
              <select
                disabled={!isEditable}
                value={safe}
                onChange={e => setSafe(e.target.value)}
                className="w-full bg-blue-50/40 border-2 border-blue-950 p-1.5 rounded-xl text-blue-950 font-bold focus:outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 disabled:bg-slate-100 disabled:border-slate-300"
              >
                <option value="MAIN_SAFE">الصندوق الرئيسي (كاش)</option>
                <option value="BANK_AHLI">حساب البنك الأهلي</option>
                <option value="BANK_RAJHI">حساب بنك الراجحي</option>
              </select>
            </div>
          </div>
        </div>

        {/* Customer & Dates Section - Navy Blue Bordered Boxes */}
        <div className="p-5 sm:p-6 border-b-2 border-blue-950 grid grid-cols-1 md:grid-cols-12 gap-5 bg-slate-50/40">
          {/* Customer Selection Card */}
          <div className="md:col-span-7 bg-white rounded-2xl border-2 border-blue-950 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-blue-900 via-blue-950 to-slate-950 px-4 py-2.5 border-b-2 border-blue-950 flex items-center justify-between text-white">
              <span className="text-xs font-black text-white flex items-center gap-2">
                <span className="p-1 rounded-lg bg-blue-800 text-white shadow-2xs">
                  <User size={14} />
                </span>
                <span>بيانات العميل (المشتري)</span>
              </span>
              {selectedPartner?.taxNumber && (
                <span className="text-[11px] font-mono font-black text-blue-950 bg-white px-2 py-0.5 rounded-lg border border-blue-950 shadow-2xs">
                  ضريبي: {selectedPartner.taxNumber}
                </span>
              )}
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-extrabold text-blue-950 mb-1 flex items-center justify-between">
                    <span>اسم العميل المسجل بالحساب:</span>
                    {hasPartnerError && (
                      <span className="text-rose-600 text-[11px] font-bold flex items-center gap-1 animate-pulse">
                        <AlertCircle size={13} /> يجب اختيار العميل لحفظ الفاتورة
                      </span>
                    )}
                  </label>
                  <select
                    id="sales-partner-select"
                    disabled={!isEditable}
                    required
                    value={partnerId}
                    onChange={e => {
                      setPartnerId(e.target.value);
                      if (e.target.value) setHasPartnerError(false);
                    }}
                    className={`w-full bg-white border-2 ${
                      hasPartnerError 
                        ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50/20' 
                        : 'border-blue-950'
                    } p-2.5 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 disabled:bg-slate-100 disabled:border-slate-300`}
                  >
                    <option value="">-- حدد العميل من القائمة --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPartner && (
                  <>
                    <div className="text-xs text-slate-800 bg-blue-50/50 p-2 rounded-xl border border-blue-950 flex items-center justify-between">
                      <span className="text-blue-950 font-bold">الهاتف:</span>
                      <span className="font-mono font-bold text-slate-900">{selectedPartner.phone || 'غير مسجل'}</span>
                    </div>
                    <div className="text-xs text-slate-800 bg-blue-50/50 p-2 rounded-xl border border-blue-950 flex items-center justify-between">
                      <span className="text-blue-950 font-bold">الرصيد الفعلي الحالي:</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`font-mono font-black ${
                          selectedPartnerStatement?.balanceType === 'DEBIT' 
                            ? 'text-emerald-700' 
                            : selectedPartnerStatement?.balanceType === 'CREDIT' 
                            ? 'text-blue-800' 
                            : 'text-slate-600'
                        }`}>
                          {selectedPartnerStatement?.balanceFormatted || '0.00'} {currencySymbol}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">({selectedPartnerStatement?.balanceLabel || 'متزن'})</span>
                      </div>
                    </div>
                    <div className="sm:col-span-2 flex items-center justify-between bg-blue-50/60 p-2 rounded-xl border border-blue-950 text-xs">
                      <div className="flex items-center gap-2 text-blue-950">
                        <User size={13} className="text-blue-900" />
                        <span className="font-bold">كشف حساب العميل والعمليات السابقة:</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPartnerForStatementModal(selectedPartner)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-950 rounded-lg font-black border border-blue-950 text-[11px] transition-colors cursor-pointer shadow-2xs"
                        title="عرض كشف حساب العميل التفصيلي وحركات الفواتير والسندات"
                      >
                        <FileText size={13} />
                        <span>فتح كشف الحساب</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Dates & Reference Card */}
          <div className="md:col-span-5 bg-white rounded-2xl border-2 border-blue-950 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-blue-900 via-blue-950 to-slate-950 px-4 py-2.5 border-b-2 border-blue-950 flex items-center justify-between text-white">
              <span className="text-xs font-black text-white flex items-center gap-2">
                <span className="p-1 rounded-lg bg-blue-800 text-white shadow-2xs">
                  <Calendar size={14} />
                </span>
                <span>تاريخ الفاتورة والاستحقاق</span>
              </span>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-blue-950 font-bold text-[11px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-900"></span>
                    تاريخ الإصدار
                  </label>
                  <input
                    type="date"
                    disabled={!isEditable}
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-white border-2 border-blue-950 p-2 rounded-xl text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 disabled:bg-slate-100 disabled:border-slate-300"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-blue-950 font-bold text-[11px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-900"></span>
                    تاريخ الاستحقاق
                  </label>
                  <input
                    type="date"
                    disabled={!isEditable}
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full bg-white border-2 border-blue-950 p-2 rounded-xl text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 disabled:bg-slate-100 disabled:border-slate-300"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Items Matrix Table - Sky & Indigo Winter Grid System */}
        <div className="overflow-x-auto min-h-[220px] border-b-2 border-blue-950 bg-white">
          <table className="w-full text-right border-collapse min-w-[820px]">
            <thead>
              <tr className="bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 border-y-2 border-blue-950 text-[11px] font-bold text-slate-100 uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center border-l border-blue-950 bg-slate-950 text-blue-200 font-mono font-black">#</th>
                <th className="py-3 px-4 border-l border-blue-950 min-w-[200px] text-white font-black">الصنف / الخدمة</th>
                <th className="py-3 px-3 w-28 text-center border-l border-blue-950 bg-slate-900/80 text-blue-200 print:hidden" title="الكمية المتوفرة حالياً في المخزن">
                  الكمية بالمخزن
                </th>
                <th className="py-3 px-3 w-28 text-left border-l border-blue-950 bg-slate-900/80 text-blue-200 print:hidden" title="متوسط سعر التكلفة المرجح (م.س.ت) للوحدة">
                  (م.س.ت) {currencySymbol}
                </th>
                <th className="py-3 px-3 w-24 text-center border-l border-blue-950 text-slate-100">الكمية</th>
                <th className="py-3 px-3 w-28 text-left border-l border-blue-950 text-blue-200 font-black">سعر البيع</th>
                {classification === 'TAX' && (
                  <th className="py-3 px-3 w-20 text-center border-l border-blue-950 text-blue-200 font-bold">الضريبة %</th>
                )}
                <th className="py-3 px-4 w-32 text-left border-l border-blue-950 text-white font-black">الإجمالي ({currencySymbol})</th>
                <th className="py-3 px-3 w-14 text-center print:hidden border-l border-blue-950 text-blue-300">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 text-xs">
              {items.map((item, index) => {
                const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                const itemInfo = resolveItemStockAndCost(item, itemsCatalog);
                const requestedQty = Number(item.quantity) || 0;
                const isOverStock = itemInfo.matched && requestedQty > itemInfo.stock;
                const unitSellingPrice = Number(item.unitPrice) || 0;
                const unitMargin = unitSellingPrice - itemInfo.costPrice;

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
                                unit: selectedItem.unit || 'حبة',
                                unitPrice: salePrice > 0 ? salePrice : (Number(item.unitPrice) || 0),
                                ...(classification === 'TAX' && selectedItem.taxRate !== undefined ? { taxRate: selectedItem.taxRate } : {})
                              });
                            }}
                            placeholder="ابحث بالحرف أو الكود عن الصنف..."
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
                            title="تحليل الصنف وأسعار البيع ومعدلات السحب والربحية"
                          >
                            <BarChart3 size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (!isEditable) {
                              if (status === 'POSTED') {
                                alert('🔒 الفاتورة مرحلة ومعتمدة!\n\nلا يمكن حذف أو إضافة أو تعديل أي صنف إلا بإلغاء الترحيل أولاً ثم الضغط على زر [تعديل الفاتورة].');
                              } else {
                                alert('⚠️ الفاتورة في وضع المعاينة الآمنة.\n\nاضغط على زر [تعديل الفاتورة] بالأعلى لتفعيل إمكانية حذف الأصناف وتعديلها.');
                              }
                              return;
                            }
                            handleRemoveItem(item.id);
                          }}
                          disabled={!isEditable}
                          className={`p-1.5 rounded-xl border transition-all shrink-0 print:hidden flex items-center justify-center ${
                            isEditable
                              ? 'text-rose-600 hover:text-white hover:bg-rose-600 bg-rose-50 border-rose-300 cursor-pointer shadow-2xs'
                              : 'text-slate-300 bg-slate-100 border-slate-300 cursor-not-allowed opacity-50'
                          }`}
                          title={isEditable ? `حذف الصنف #${index + 1} (${item.description || 'فارغ'})` : (status === 'POSTED' ? 'الفاتورة مرحلة ومقفلة' : 'تعديل الفاتورة مطلوب للحذف')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>

                    {/* الكمية في المخزون (Stock Quantity) */}
                    <td className="py-2 px-3 text-center border-l border-slate-300 bg-slate-100/60 print:hidden">
                      {itemInfo.matched ? (
                        <div className="flex flex-col items-center justify-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-xs font-bold border ${
                            itemInfo.stock <= 0
                              ? 'bg-rose-50 text-rose-800 border-rose-400'
                              : itemInfo.stock <= 5
                              ? 'bg-amber-50 text-amber-800 border-amber-400'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-400'
                          }`}>
                            <span>{itemInfo.stock.toLocaleString()}</span>
                            <span className="text-[10px] font-bold text-slate-600">{itemInfo.unit}</span>
                          </span>
                          {isOverStock && (
                            <span className="text-[9px] text-rose-700 font-extrabold mt-0.5 whitespace-nowrap">تجاوز المخزون!</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono font-bold">-</span>
                      )}
                    </td>

                    {/* متوسط سعر التكلفة (م.س.ت) (Average Cost Price) */}
                    <td className="py-2 px-3 text-left border-l border-slate-300 bg-slate-100/60 print:hidden" dir="ltr">
                      {itemInfo.matched ? (
                        <div className="flex flex-col items-start justify-center">
                          <span className="font-mono text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-400 shadow-2xs">
                            {itemInfo.costPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          {unitSellingPrice > 0 && itemInfo.costPrice > 0 && (
                            <span className={`text-[9px] font-bold mt-0.5 whitespace-nowrap ${
                              unitMargin >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}>
                              {unitMargin >= 0 ? `+${unitMargin.toFixed(1)} ${currencySymbol}` : `${unitMargin.toFixed(1)} ${currencySymbol}`}
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
                        className={`w-full bg-white p-1.5 rounded-xl border-2 text-center font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-100 disabled:border-slate-300 ${
                          isOverStock ? 'border-rose-500 bg-rose-50 text-rose-900' : 'border-slate-500'
                        }`}
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
                        onClick={() => {
                          if (!isEditable) {
                            if (status === 'POSTED') {
                              alert('🔒 الفاتورة مرحلة ومعتمدة!\n\nلا يمكن حذف أو إضافة أو تعديل أي صنف إلا بإلغاء الترحيل أولاً ثم الضغط على زر [تعديل الفاتورة].');
                            } else {
                              alert('⚠️ الفاتورة في وضع المعاينة الآمنة.\n\nاضغط على زر [تعديل الفاتورة] بالأعلى لتفعيل إمكانية حذف الأصناف وتعديلها.');
                            }
                            return;
                          }
                          handleRemoveItem(item.id);
                        }}
                        disabled={!isEditable}
                        className={`p-1.5 rounded-xl border transition-all flex items-center justify-center mx-auto ${
                          isEditable
                            ? 'text-rose-600 hover:text-white hover:bg-rose-600 active:bg-rose-700 bg-rose-50 border-rose-300 cursor-pointer shadow-2xs group'
                            : 'text-slate-300 bg-slate-100 border-slate-300 cursor-not-allowed opacity-50'
                        }`}
                        title={
                          !isEditable
                            ? (status === 'POSTED'
                                ? 'الفاتورة مرحلة ومقفلة - قم بإلغاء الترحيل ثم اضغط تعديل الفاتورة للحذف'
                                : 'اضغط على زر [تعديل الفاتورة] بالأعلى لتفعيل الحذف')
                            : `حذف الصنف #${index + 1} (${item.description || 'فارغ'})`
                        }
                      >
                        {isEditable ? (
                          <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
                        ) : (
                          <Lock size={12} className="text-slate-400" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add Item Action Bar - Modern & Eye-Comfort Navy Blue */}
        {isEditable ? (
          <div className="p-4 border-t-2 border-blue-950 bg-blue-50/50 print:hidden flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-900 to-blue-950 hover:from-blue-950 hover:to-slate-950 active:bg-slate-950 text-white rounded-xl text-xs font-black transition-all shadow-xs hover:shadow cursor-pointer border border-blue-950"
                title="إضافة بند جديد للفاتورة (F2 أو Insert)"
              >
                <Plus size={16} />
                <span>إضافة بند جديد للفاتورة</span>
                <kbd className="text-[10px] bg-blue-950 text-blue-200 px-1.5 py-0.5 rounded font-mono border border-blue-950">F2</kbd>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-950 font-bold bg-white px-3.5 py-1.5 rounded-xl border-2 border-blue-950 shadow-2xs">
                عدد البنود: <strong className="text-blue-900 font-mono text-sm font-black">{items.length}</strong>
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3.5 border-t-2 border-blue-950 bg-slate-50 print:hidden flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Lock size={15} className="text-slate-700 shrink-0" />
              <span className="font-bold">
                {status === 'POSTED'
                  ? '🔒 الفاتورة مرحلة ومقفلة: لا يمكن إضافة أي صنف أو حذف أي صنف أو التعديل إلا بإلغاء الترحيل أولاً ثم الضغط على زر تعديل الفاتورة.'
                  : '👁️ الفاتورة في وضع المعاينة الآمنة: اضغط على زر [تعديل الفاتورة] بالأعلى للتمكن من إضافة وحذف الأصناف وتعديل الأسعار.'}
              </span>
            </div>
            {status === 'POSTED' ? (
              <button
                type="button"
                onClick={handleUnpost}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer border border-amber-800"
              >
                <RotateCcw size={13} />
                <span>إلغاء الترحيل</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartEditInvoice}
                className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-blue-900 to-blue-950 hover:from-blue-950 hover:to-slate-950 text-white rounded-lg text-xs font-black transition-colors shadow-2xs cursor-pointer border border-blue-950"
              >
                <Edit3 size={13} />
                <span>تعديل الفاتورة</span>
              </button>
            )}
          </div>
        )}

        {/* Summary & Totals Footer - Navy Blue Styling */}
        <div className="p-5 sm:p-6 border-t-2 border-blue-950 bg-slate-100/50 grid grid-cols-1 md:grid-cols-12 gap-6 items-start mt-auto">
          {/* Notes Section - Defined Winter Box */}
          <div className="md:col-span-7 space-y-2">
            <label className="text-xs font-black text-blue-950 block">ملاحظات وشروط الدفع والتسليم:</label>
            <textarea
              disabled={!isEditable}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="اكتب هنا أي شروط أو تفاصيل إضافية متعلقة بالدفع أو التسليم أو الضمان..."
              className="w-full bg-white border-2 border-blue-950 rounded-2xl p-3 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 min-h-[95px] resize-none disabled:bg-slate-100 disabled:border-slate-300 shadow-2xs"
            />
          </div>

          {/* Calculations Matrix Card - Deep Navy Blue Dark Box */}
          <div className="md:col-span-5 bg-gradient-to-b from-slate-950 via-slate-900 to-blue-950 text-white p-5 rounded-2xl border-2 border-blue-950 shadow-lg space-y-3">
            <div className="flex justify-between items-center text-xs text-slate-300">
              <span className="font-bold text-blue-200">المجموع الخاضع للضريبة:</span>
              <span className="font-mono font-black text-white text-sm">
                {totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
              </span>
            </div>

            {classification === 'TAX' && (
              <div className="flex justify-between items-center text-xs text-slate-300">
                <span className="font-bold text-blue-300">ضريبة القيمة المضافة (VAT {taxRate}%):</span>
                <span className="font-mono font-black text-blue-200 text-sm">
                  {totals.taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center text-xs text-slate-300 pt-1">
              <span className="font-bold text-rose-300">الخصم الممنوح (قيمة):</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={!isEditable}
                  value={discount === 0 ? '' : discount}
                  onChange={e => setDiscount(Number(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-24 text-right bg-slate-900 border border-rose-500/60 rounded-lg px-2 py-1 text-xs font-mono font-bold text-rose-300 focus:outline-none focus:border-rose-400 disabled:opacity-50"
                />
                <span className="text-[10px] font-bold text-rose-400">{currencySymbol}</span>
              </div>
            </div>

            {totals.totalCost > 0 && (
              <div className="pt-2 border-t border-dashed border-blue-950 space-y-1.5 print:hidden">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span className="flex items-center gap-1 font-bold text-blue-200">
                    <span>إجمالي التكلفة التقديرية</span>
                    <span className="text-[10px] bg-slate-800 text-blue-300 border border-blue-950 px-1 py-0.5 rounded font-mono font-bold">م.س.ت</span>
                    <span>:</span>
                  </span>
                  <span className="font-mono font-bold text-slate-200">
                    {totals.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-blue-200 font-bold">الربح التقديري (قبل الضريبة):</span>
                  <span className={`font-mono font-black ${totals.grossProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {totals.grossProfit >= 0 ? '+' : ''}{totals.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol} 
                    <span className="text-[11px] font-normal mr-1">({totals.profitMargin.toFixed(1)}%)</span>
                  </span>
                </div>
              </div>
            )}

            <div className="border-t-2 border-blue-950 pt-3.5 flex justify-between items-center">
              <span className="text-sm font-black text-blue-200">صافي القيمة الإجمالية:</span>
              <div className="text-left">
                <span className="text-xl sm:text-2xl font-mono font-black text-blue-100 block">
                  {totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-blue-300 font-extrabold uppercase tracking-wider">{currencyFullNameAr}</span>
              </div>
            </div>

            {/* المبلغ كتابة بالحروف (تفقيط المبلغ الإجمالي) - أسفل خانة صافي المبلغ الإجمالي */}
            <div className="bg-slate-900/90 rounded-xl p-2.5 border border-blue-950 text-xs">
              <span className="text-[10px] text-blue-300 font-bold block mb-1">المبلغ كتابة بالحروف:</span>
              <p className={`font-black leading-relaxed font-sans text-xs ${
                totals.grandTotal === 0 || tafqeet(totals.grandTotal).includes('صفر')
                  ? 'text-amber-400 font-black tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]'
                  : 'text-amber-300'
              }`}>
                {tafqeet(totals.grandTotal)}
              </p>
            </div>

            {/* خانة السداد ومبلغ الدفع وتحديد نوع الفاتورة */}
            <div className="pt-3 border-t-2 border-blue-950 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-black text-blue-200 flex items-center gap-1.5">
                  <CreditCard size={14} className="text-blue-400" />
                  <span>المبلغ المسدد (السداد النقدي):</span>
                </span>
                <div className="flex flex-wrap items-center gap-1 w-full sm:w-auto">
                  <button
                    type="button"
                    disabled={!isEditable}
                    onClick={() => handlePaidAmountChange(totals.grandTotal)}
                    className="flex-1 sm:flex-none px-2 py-0.5 bg-blue-950/90 hover:bg-blue-900 text-blue-200 rounded text-[10px] font-bold border border-blue-950 disabled:opacity-50 transition-colors"
                  >
                    100% نقدي
                  </button>
                  <button
                    type="button"
                    disabled={!isEditable}
                    onClick={() => handlePaidAmountChange(Number((totals.grandTotal * 0.5).toFixed(2)))}
                    className="flex-1 sm:flex-none px-2 py-0.5 bg-blue-900/90 hover:bg-blue-800 text-blue-200 rounded text-[10px] font-bold border border-blue-950 disabled:opacity-50 transition-colors"
                  >
                    50% جزئي
                  </button>
                  <button
                    type="button"
                    disabled={!isEditable}
                    onClick={() => handlePaidAmountChange(0)}
                    className="flex-1 sm:flex-none px-2 py-0.5 bg-slate-950/90 hover:bg-slate-900 text-slate-300 rounded text-[10px] font-bold border border-blue-950 disabled:opacity-50 transition-colors"
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
                  className="w-full bg-slate-900/90 border-2 border-blue-950 focus:border-blue-700 focus:ring-1 focus:ring-blue-700 rounded-xl px-3 py-2 text-base font-mono font-black text-blue-100 disabled:bg-slate-950 disabled:border-slate-800 disabled:text-slate-500 transition-all text-left"
                />
                <span className="absolute right-3 top-2.5 text-xs text-blue-300 font-bold pointer-events-none">
                  {currencySymbol} مسدد
                </span>
              </div>

              {/* Dynamic Status / Type Badge & Remaining Amount */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/90 p-2 rounded-xl border border-blue-950 flex flex-col justify-center">
                  <span className="text-[10px] text-blue-300 font-bold">نوع الفاتورة التلقائي:</span>
                  <span className={`text-xs font-black mt-0.5 ${
                    paidAmount >= totals.grandTotal - 0.001 && totals.grandTotal > 0
                      ? 'text-emerald-400'
                      : paidAmount > 0.001
                      ? 'text-amber-400'
                      : 'text-blue-300'
                  }`}>
                    {paidAmount >= totals.grandTotal - 0.001 && totals.grandTotal > 0
                      ? '🟢 فاتورة نقدية (مسددة بالكامل)'
                      : paidAmount > 0.001
                      ? '🟡 فاتورة جزئية (سداد جزء)'
                      : '🔵 فاتورة آجلة (غير مسددة)'}
                  </span>
                </div>

                <div className="bg-slate-900/90 p-2 rounded-xl border border-blue-950 flex flex-col justify-center">
                  <span className="text-[10px] text-blue-300 font-bold">المبلغ المتبقي:</span>
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
              <div className="mt-3 pt-3 border-t border-blue-950 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-200 font-bold flex items-center gap-1.5">
                    <User size={13} className="text-blue-400" />
                    <span>موقف حساب العميل:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPartnerForStatementModal(selectedPartner)}
                    className="flex items-center gap-1 px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-blue-200 rounded font-bold text-[10px] border border-blue-950 transition-colors cursor-pointer"
                    title="عرض كشف حساب العميل التفصيلي وحركات الفواتير والسندات"
                  >
                    <FileText size={11} />
                    <span>كشف الحساب</span>
                  </button>
                </div>

                <div className="bg-slate-900/90 rounded-xl p-3 border border-blue-950 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between items-center text-slate-300 text-[11px]">
                    <span className="font-sans text-blue-200">الرصيد السابق قبل الفاتورة:</span>
                    <span className="font-bold text-slate-100">
                      {partnerBalanceImpact.previousBalanceFormatted} {currencySymbol} ({partnerBalanceImpact.previousBalanceLabel})
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300 text-[11px]">
                    <span className="font-sans text-blue-200">قيمة الفاتورة الحالية (+):</span>
                    <span className="font-bold text-slate-100">
                      +{partnerBalanceImpact.invoiceAmountFormatted} {currencySymbol}
                    </span>
                  </div>
                  {partnerBalanceImpact.paidAmount > 0 && (
                    <div className="flex justify-between items-center text-slate-300 text-[11px]">
                      <span className="font-sans text-blue-200">المسدد نقداً بالفاتورة (-):</span>
                      <span className="font-bold text-emerald-400">
                        -{partnerBalanceImpact.paidAmountFormatted} {currencySymbol}
                      </span>
                    </div>
                  )}
                  {partnerBalanceImpact.remainingAmount > 0 && partnerBalanceImpact.paidAmount > 0 && (
                    <div className="flex justify-between items-center text-slate-300 text-[11px]">
                      <span className="font-sans text-blue-200">صافي الإضافة لحساب العميل:</span>
                      <span className="font-bold text-blue-200">
                        +{partnerBalanceImpact.remainingAmountFormatted} {currencySymbol}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-blue-900 flex justify-between items-center">
                    <span className="text-blue-200 font-bold text-xs font-sans">الموقف النهائي بعد الفاتورة:</span>
                    <div className="text-left">
                      <span className={`text-base font-black ${
                        partnerBalanceImpact.newBalanceType === 'DEBIT' 
                          ? 'text-blue-200' 
                          : partnerBalanceImpact.newBalanceType === 'CREDIT' 
                          ? 'text-blue-300' 
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
            <p className="font-bold mb-14 text-sm">توقيع وختم البائع</p>
            <div className="border-b-2 border-dashed border-slate-400 w-3/4 mx-auto"></div>
          </div>
          <div>
            <p className="font-bold mb-14 text-sm">توقيع واستلام العميل</p>
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

      {/* Universal Print Preview Modal */}
      <PrintPreviewModal
        isOpen={showPrintPreview}
        onClose={() => {
          setShowPrintPreview(false);
          setCustomPreviewData(null);
        }}
        data={customPreviewData || currentInvoicePreviewData}
      />

      {/* In-App Delete Confirmation Modal (100% reliable in any iframe) */}
      {deleteModal && deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-2 border-slate-300 text-right space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-1 shadow-inner">
              <Trash2 size={28} />
            </div>
            <h3 className="text-base font-black text-slate-900 text-center">
              {deleteModal.isNewDraft ? 'إفراغ مسودة الفاتورة الحالية' : 'تأكيد حذف الفاتورة نهائياً'}
            </h3>
            <p className="text-xs text-slate-600 text-center leading-relaxed">
              {deleteModal.isNewDraft ? (
                <>هل ترغب حقاً في إفراغ كافة البيانات وإعادة تعيين هذه الفاتورة للبدء بمسودة جديدة فارغة؟</>
              ) : (
                <>
                  هل أنت متأكد من رغبتك في حذف الفاتورة رقم{' '}
                  <span className="font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                    {deleteModal.invoiceNumber}
                  </span>{' '}
                  نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء بعد تنفيذه.
                </>
              )}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
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

      {/* Floating In-App Toast Notification */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[92%] sm:w-auto min-w-[340px] animate-slideDown pointer-events-auto">
          <div className={`p-4 rounded-2xl shadow-2xl border-2 flex items-start gap-3.5 ${
            toast.type === 'success' 
              ? 'bg-emerald-950 text-white border-emerald-500'
              : toast.type === 'error'
              ? 'bg-rose-950 text-white border-rose-500'
              : toast.type === 'warning'
              ? 'bg-amber-950 text-white border-amber-500'
              : 'bg-sky-950 text-white border-sky-500'
          }`}>
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 size={20} className="text-emerald-400" />}
              {toast.type === 'error' && <AlertTriangle size={20} className="text-rose-400" />}
              {toast.type === 'warning' && <AlertCircle size={20} className="text-amber-400" />}
              {toast.type === 'info' && <Info size={20} className="text-sky-400" />}
            </div>
            <div className="flex-1 text-right">
              <h4 className="text-xs font-black tracking-wide">{toast.title}</h4>
              {toast.message && (
                <p className="text-[11px] opacity-90 mt-1 leading-relaxed text-slate-200">
                  {toast.message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-white/70 hover:text-white p-1 rounded-lg transition-colors cursor-pointer shrink-0"
              title="إغلاق التنبيه"
            >
              <X size={15} />
            </button>
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
