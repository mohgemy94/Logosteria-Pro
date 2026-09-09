import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Save, Plus, Trash2, CheckCircle2, RotateCcw, 
  History, Printer, Calendar, Truck, X, Edit3, Eye, Lock,
  FileDown, Loader2, Keyboard, FileText, CreditCard
} from 'lucide-react';
import PrintDropdown from './PrintDropdown';
import PrintPreviewModal, { PrintPreviewData } from './PrintPreviewModal';
import PartnerStatementModal from './PartnerStatementModal';
import { CertifiedInvoiceDocument } from './CertifiedInvoiceDocument';
import { exportElementToPdf } from '../utils/pdfExport';
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

export interface StoredPurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierRef?: string;
  date: string;
  dueDate: string;
  partnerId: string;
  partnerName: string;
  classification: 'NORMAL' | 'TAX';
  invoiceType: string;
  source: string;
  safe: string;
  items: InvoiceItem[];
  totals: {
    subtotal: number;
    taxTotal: number;
    grandTotal: number;
    cashPaid?: number;
    remainingBalance?: number;
  };
  status: 'DRAFT' | 'POSTED';
  notes?: string;
  createdAt: string;
}

function loadStoredPurchaseInvoices(): StoredPurchaseInvoice[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DB_PURCHASES_INVOICES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load purchase invoices:', e);
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
      } catch (err) {
        console.error(err);
      }
    };
    window.addEventListener('alpha-partner-ledger-updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('alpha-partner-ledger-updated', handleSync);
      window.removeEventListener('storage', handleSync);
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
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const pdfInvoiceDocRef = useRef<HTMLDivElement>(null);
  
  // Classification and categorization
  const [classification, setClassification] = useState<'NORMAL' | 'TAX'>('TAX');
  const [invoiceType, setInvoiceType] = useState<string>('CASH_PURCHASE');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [source, setSource] = useState<string>('MAIN_WAREHOUSE');
  const [safe, setSafe] = useState<string>('MAIN_SAFE');
  const [notes, setNotes] = useState<string>('');
  
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: 'item-' + Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: 15, availableStock: 0, costPrice: 0 }
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

  const handleNewInvoice = () => {
    setEditingInvoiceId(null);
    const nextSeq = getNextSequentialNumber('purchaseInvoice', savedInvoices.map(i => i.invoiceNumber)).formatted;
    setInvoiceNumber(nextSeq);
    setSupplierRef('');
    setStatus('DRAFT');
    setIsEditMode(true);
    setPartnerId('');
    setDueDate('');
    setNotes('');
    setClassification('TAX');
    setInvoiceType('CASH_PURCHASE');
    setPaidAmount(0);
    setItems([{ id: 'item-' + Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: 15, availableStock: 0, costPrice: 0 }]);
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
    setItems(inv.items.length > 0 ? inv.items : [{ id: 'item-' + Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: 15, availableStock: 0, costPrice: 0 }]);
    setItemsCatalog(loadStoredItems());
    setShowInvoicesHistory(false);
  };

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
        taxRate: classification === 'TAX' ? 15 : 0,
        availableStock: 0,
        costPrice: 0
      }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (!isEditable) {
      if (status === 'POSTED') {
        alert('🔒 الفاتورة مرحلة ومقفلة!\n\nلا يمكن حذف أي صنف إلا بعد إلغاء الترحيل أولاً ثم الضغط على زر [تعديل الفاتورة].');
      } else {
        alert('⚠️ الفاتورة في وضع المعاينة الآمنة.\n\nاضغط على زر [تعديل الفاتورة] بالأعلى للتمكن من حذف وتعديل الأصناف.');
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
          taxRate: classification === 'TAX' ? 15 : 0,
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
    const grandTotal = subtotal + taxTotal;
    const cleanPaid = Math.max(0, Math.min(grandTotal, Number(paidAmount) || 0));
    const remainingBalance = Math.max(0, grandTotal - cleanPaid);

    return { 
      subtotal, 
      taxTotal, 
      grandTotal,
      cashPaid: cleanPaid,
      remainingBalance
    };
  }, [items, classification, paidAmount]);

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
      status === 'POSTED' ? invoiceNumber : undefined,
      'VENDOR',
      selectedPartnerStatement
    );
  }, [selectedPartner, totals.grandTotal, paidAmount, status, invoiceNumber, selectedPartnerStatement]);

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
    discountTotal: 0,
    grandTotal: totals.grandTotal,
    paidAmount: paidAmount,
    remainingBalance: Math.max(0, totals.grandTotal - paidAmount),
    paymentStatus: paidAmount >= totals.grandTotal - 0.001 && totals.grandTotal > 0 ? 'PAID' : paidAmount > 0.001 ? 'PARTIAL' : 'UNPAID',
    notes: notes,
    partnerBalanceImpact: partnerBalanceImpact
  }), [classification, status, invoiceNumber, date, dueDate, selectedPartner, invoiceType, items, totals, paidAmount, notes, partnerBalanceImpact]);

  const handleExportPdf = async () => {
    if (!pdfInvoiceDocRef.current || isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      const safeNumber = invoiceNumber.trim() || 'DRAFT';
      await exportElementToPdf(pdfInvoiceDocRef.current, {
        filename: `فاتورة_مشتريات_${safeNumber}.pdf`,
        format: 'A4',
        scale: 2,
      });
    } catch (err) {
      console.error('Export PDF error:', err);
      alert('⚠️ حدث خطأ أثناء تصدير الفاتورة إلى PDF. يرجى المحاولة مرة أخرى أو استخدام زر الطباعة.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const saveInvoiceToDb = (isPosting: boolean) => {
    if (!partnerId) {
      alert("يرجى اختيار المورد أولاً");
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
    if (confirm(`هل أنت متأكد من رغبتك في حذف فاتورة المشتريات رقم (${invoiceNumber}) نهائياً؟`)) {
      const updated = savedInvoices.filter(i => i.invoiceNumber !== invoiceNumber && (!editingInvoiceId || i.id !== editingInvoiceId));
      setSavedInvoices(updated);
      try {
        localStorage.setItem(DB_PURCHASES_INVOICES_KEY, JSON.stringify(updated));
        notifyDataChanged();
        dispatchPartnerLedgerUpdated();
      } catch (err) {
        console.error(err);
      }
      handleNewInvoice();
      alert('تم حذف فاتورة المشتريات بنجاح.');
    }
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
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1 text-emerald-700/80 text-xs font-bold">
            <span>الموردون والمشتريات</span>
            <span>/</span>
            <span className="text-emerald-950 font-extrabold">فواتير المشتريات</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-emerald-600 via-teal-700 to-green-900 bg-clip-text text-transparent">
              فاتورة المشتريات
            </h1>
            <span className={`px-2.5 py-1 text-xs font-black rounded-lg border ${
              status === 'POSTED' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                : isEditMode
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}>
              {status === 'POSTED' ? 'مرحلة ومعتمدة' : isEditMode ? 'مسودة قيد التحرير' : 'مسودة (وضع العرض)'}
            </span>
            {editingInvoiceId && (
              <span className="px-2.5 py-1 text-xs font-black rounded-lg bg-teal-50 text-teal-800 border border-teal-300 flex items-center gap-1 shadow-2xs">
                <Edit3 size={12} className="text-teal-600" /> تعديل #{invoiceNumber}
              </span>
            )}
          </div>
        </div>

        {/* Global Invoice Actions Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {editingInvoiceId && isEditMode && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-300"
            >
              <X size={14} /> إلغاء التعديل
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowInvoicesHistory(!showInvoicesHistory)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              showInvoicesHistory 
                ? 'bg-emerald-100 border-emerald-300 text-emerald-950' 
                : 'bg-white border-slate-300 text-slate-700 hover:bg-emerald-50/50'
            }`}
            title="سجل الفواتير (Ctrl+H)"
          >
            <History size={14} className="text-emerald-600" />
            <span>سجل الفواتير ({savedInvoices.length})</span>
            <kbd className="hidden sm:inline-block text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono border border-slate-300">Ctrl+H</kbd>
          </button>

          <button
            type="button"
            onClick={handleNewInvoice}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 border-2 border-emerald-300 rounded-xl text-xs font-black transition-colors cursor-pointer shadow-2xs"
            title="فاتورة جديدة (Ctrl+N)"
          >
            <Plus size={14} className="text-emerald-600" />
            <span>فاتورة جديدة #{nextCalculatedInvoiceNum}</span>
            <kbd className="hidden sm:inline-block text-[9px] bg-emerald-100 text-emerald-950 px-1.5 py-0.5 rounded font-mono font-black border border-emerald-300">Ctrl+N</kbd>
          </button>

          {status === 'DRAFT' ? (
            <>
              {!isEditMode ? (
                <button
                  type="button"
                  onClick={handleStartEditInvoice}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-black transition-colors cursor-pointer shadow-sm border border-emerald-900"
                  title="تعديل الفاتورة (Ctrl+S)"
                >
                  <Edit3 size={14} />
                  <span>تعديل الفاتورة</span>
                  <kbd className="hidden sm:inline-block text-[9px] bg-emerald-900 text-emerald-200 px-1.5 py-0.5 rounded font-mono">Ctrl+S</kbd>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white border-2 border-emerald-400 text-emerald-950 hover:bg-emerald-50 rounded-xl text-xs font-black transition-colors cursor-pointer shadow-2xs"
                  title="حفظ مسودة (Ctrl+S)"
                >
                  <Save size={14} className="text-emerald-600" />
                  <span>حفظ مسودة</span>
                  <kbd className="hidden sm:inline-block text-[9px] bg-emerald-50 text-emerald-900 px-1.5 py-0.5 rounded font-mono border border-emerald-300">Ctrl+S</kbd>
                </button>
              )}
              <button
                type="button"
                onClick={handlePost}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-colors cursor-pointer shadow-sm border border-emerald-800"
                title="ترحيل الفاتورة (Ctrl+Enter)"
              >
                <CheckCircle2 size={14} />
                <span>ترحيل الفاتورة</span>
                <kbd className="hidden sm:inline-block text-[9px] bg-emerald-700 text-emerald-100 px-1.5 py-0.5 rounded font-mono font-bold">Ctrl+↵</kbd>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleUnpost}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition-colors cursor-pointer shadow-sm border border-amber-700"
            >
              <RotateCcw size={14} />
              <span>إلغاء الترحيل</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-300"
            title="حذف الفاتورة"
          >
            <Trash2 size={14} />
            <span>حذف</span>
          </button>

          <div className="flex flex-wrap items-center gap-1.5 sm:border-r sm:border-slate-200 sm:pr-2 sm:mr-1 max-w-full">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs hover:shadow-xs disabled:opacity-75 disabled:cursor-wait shrink-0"
              title="تصدير فاتورة المشتريات الحالية بتنسيقها المعتمد كملف PDF"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 size={14} className="animate-spin shrink-0" />
                  <span className="hidden sm:inline">جاري التصدير...</span>
                  <span className="sm:hidden">جاري...</span>
                </>
              ) : (
                <>
                  <FileDown size={14} className="shrink-0" />
                  <span className="hidden sm:inline">تصدير PDF</span>
                  <span className="sm:hidden">PDF</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-2xs shrink-0"
              title="طباعة سريعة مباشرة (Ctrl+P)"
            >
              <Printer size={14} className="shrink-0" />
              <span className="hidden sm:inline">طباعة مباشرة</span>
              <span className="sm:hidden">طباعة</span>
              <kbd className="hidden md:inline-block text-[9px] bg-slate-800 text-slate-300 px-1 py-0.5 rounded font-mono border border-slate-700">Ctrl+P</kbd>
            </button>
            <PrintDropdown 
              onPreview={() => {
                setCustomPreviewData(null);
                setShowPrintPreview(true);
              }}
              onExportPdf={handleExportPdf}
            />
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
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من رغبتك في حذف فاتورة المشتريات رقم (${inv.invoiceNumber})؟`)) {
                                const updated = savedInvoices.filter(i => i.id !== inv.id);
                                setSavedInvoices(updated);
                                localStorage.setItem(DB_PURCHASES_INVOICES_KEY, JSON.stringify(updated));
                                notifyDataChanged();
                                if (editingInvoiceId === inv.id) handleNewInvoice();
                              }
                            }}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
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

      {/* Main Invoice Card - Winter Deep Border */}
      <div className={`bg-white rounded-3xl shadow-sm border-2 ${
        status === 'POSTED' ? 'border-slate-800' : 'border-slate-700'
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

        {/* Modern Settings / Control Strip - Colorized & Winter Styled Boxes (Green / Emerald Palette) */}
        <div className="bg-slate-100/90 border-b-2 border-slate-700 p-4 sm:p-5 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 text-xs">
            {/* Invoice Number (Sequential & Read-Only) */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-emerald-600/70 shadow-2xs space-y-1.5 ring-2 ring-emerald-50">
              <div className="flex items-center justify-between">
                <label className="text-emerald-950 font-black text-[11px] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                  رقم الفاتورة
                </label>
                <span className="text-[10px] text-emerald-800 font-mono bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1">
                  <Lock size={10} className="text-emerald-600" />
                  <span>تلقائي</span>
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={invoiceNumber}
                  className="w-full bg-gradient-to-r from-slate-900 to-emerald-950 border border-emerald-900 py-1.5 px-4 rounded-xl font-mono font-black text-amber-300 text-center select-all focus:outline-none cursor-not-allowed shadow-inner"
                  title="رقم الفاتورة يتولد تسلسلياً تلقائياً من النظام ومحمي من التعديل"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-400 font-mono font-bold text-xs">
                  #
                </span>
              </div>
            </div>

            {/* Classification */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-teal-600/70 shadow-2xs space-y-1.5 ring-2 ring-teal-50">
              <label className="text-teal-950 font-black text-[11px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-teal-600 inline-block"></span>
                تصنيف الفاتورة
              </label>
              <select
                disabled={!isEditable}
                value={classification}
                onChange={e => setClassification(e.target.value as 'NORMAL' | 'TAX')}
                className="w-full bg-teal-50/40 border-2 border-teal-300 p-1.5 rounded-xl text-teal-950 font-bold focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 disabled:bg-slate-100 disabled:border-slate-300"
              >
                <option value="TAX">فاتورة ضريبية (15%)</option>
                <option value="NORMAL">فاتورة عادية (0%)</option>
              </select>
            </div>

            {/* Invoice Type */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-green-600/70 shadow-2xs space-y-1.5 ring-2 ring-green-50">
              <label className="text-green-950 font-black text-[11px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-600 inline-block"></span>
                نوع المعاملة
              </label>
              <select
                disabled={!isEditable}
                value={invoiceType}
                onChange={e => handleInvoiceTypeChange(e.target.value)}
                className="w-full bg-green-50/40 border-2 border-green-300 p-1.5 rounded-xl text-green-950 font-bold focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 disabled:bg-slate-100 disabled:border-slate-300"
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
            <div className="bg-white p-2.5 rounded-2xl border-2 border-emerald-700/70 shadow-2xs space-y-1.5 ring-2 ring-emerald-50">
              <label className="text-emerald-950 font-black text-[11px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                وجهة المخزون
              </label>
              <select
                disabled={!isEditable}
                value={source}
                onChange={e => setSource(e.target.value)}
                className="w-full bg-emerald-50/40 border-2 border-emerald-300 p-1.5 rounded-xl text-emerald-950 font-bold focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 disabled:border-slate-300"
              >
                <option value="MAIN_WAREHOUSE">المستودع الرئيسي</option>
                <option value="SHOWROOM">معرض المبيعات</option>
                <option value="BRANCH_1">فرع الرياض</option>
              </select>
            </div>

            {/* Safe / Cashbox */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-teal-700/70 shadow-2xs space-y-1.5 ring-2 ring-teal-50">
              <label className="text-teal-950 font-black text-[11px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-teal-600 inline-block"></span>
                خزنة الدفع والسداد
              </label>
              <select
                disabled={!isEditable}
                value={safe}
                onChange={e => setSafe(e.target.value)}
                className="w-full bg-teal-50/40 border-2 border-teal-300 p-1.5 rounded-xl text-teal-950 font-bold focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 disabled:bg-slate-100 disabled:border-slate-300"
              >
                <option value="MAIN_SAFE">الصندوق الرئيسي (كاش)</option>
                <option value="BANK_AHLI">حساب البنك الأهلي</option>
                <option value="BANK_RAJHI">حساب بنك الراجحي</option>
              </select>
            </div>
          </div>
        </div>

        {/* Vendor & Dates Section - Winter Bordered Boxes in Green/Emerald */}
        <div className="p-5 sm:p-6 border-b-2 border-slate-700 grid grid-cols-1 md:grid-cols-12 gap-5 bg-slate-50/40">
          {/* Vendor Selection Card */}
          <div className="md:col-span-7 bg-white rounded-2xl border-2 border-emerald-300 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-100 via-emerald-50 to-teal-50 px-4 py-2.5 border-b-2 border-emerald-200 flex items-center justify-between">
              <span className="text-xs font-black text-emerald-950 flex items-center gap-2">
                <span className="p-1 rounded-lg bg-emerald-600 text-white shadow-2xs">
                  <Truck size={14} />
                </span>
                <span>بيانات المورد (البائع)</span>
              </span>
              {selectedPartner?.taxNumber && (
                <span className="text-[11px] font-mono font-bold text-emerald-900 bg-white px-2 py-0.5 rounded-lg border border-emerald-300 shadow-2xs">
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
                    className="w-full bg-white border-2 border-emerald-300 p-2.5 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 disabled:border-slate-300"
                  >
                    <option value="">-- حدد المورد من القائمة --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} {v.phone ? `(${v.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-xs text-slate-800 bg-emerald-50/50 p-2 rounded-xl border border-emerald-200 flex items-center justify-between">
                  <span className="text-emerald-950 font-bold">رقم فاتورة المورد:</span>
                  <input
                    type="text"
                    disabled={!isEditable}
                    value={supplierRef}
                    onChange={e => setSupplierRef(e.target.value)}
                    placeholder="مثال: INV-9821"
                    className="font-mono font-bold text-slate-900 text-left outline-none border-b-2 border-emerald-300 focus:border-emerald-600 bg-white px-1.5 py-0.5 rounded w-28 disabled:cursor-not-allowed"
                    dir="ltr"
                  />
                </div>

                <div className="text-xs text-slate-800 bg-emerald-50/50 p-2 rounded-xl border border-emerald-200 flex items-center justify-between">
                  <span className="text-emerald-950 font-bold">الرصيد الفعلي الحالي:</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-mono font-black ${
                      selectedPartnerStatement?.balanceType === 'CREDIT' 
                        ? 'text-emerald-800' 
                        : selectedPartnerStatement?.balanceType === 'DEBIT' 
                        ? 'text-teal-700' 
                        : 'text-slate-600'
                    }`}>
                      {selectedPartnerStatement?.balanceFormatted || '0.00'} {currencySymbol}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">({selectedPartnerStatement?.balanceLabel || 'متزن'})</span>
                  </div>
                </div>

                {selectedPartner && (
                  <div className="sm:col-span-2 flex items-center justify-between bg-emerald-50/70 p-2 rounded-xl border border-emerald-200 text-xs">
                    <div className="flex items-center gap-2 text-emerald-950">
                      <Truck size={13} className="text-emerald-600" />
                      <span className="font-bold">كشف حساب المورد والعمليات السابقة:</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPartnerForStatementModal(selectedPartner)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 rounded-lg font-bold border border-emerald-300 text-[11px] transition-colors cursor-pointer shadow-2xs"
                      title="عرض كشف حساب المورد التفصيلي وحركات الفواتير والسندات"
                    >
                      <FileText size={13} className="text-emerald-600" />
                      <span>فتح كشف الحساب</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dates & Reference Card */}
          <div className="md:col-span-5 bg-white rounded-2xl border-2 border-teal-300 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-teal-100 via-teal-50 to-emerald-50 px-4 py-2.5 border-b-2 border-teal-200 flex items-center justify-between">
              <span className="text-xs font-black text-teal-950 flex items-center gap-2">
                <span className="p-1 rounded-lg bg-teal-600 text-white shadow-2xs">
                  <Calendar size={14} />
                </span>
                <span>تاريخ الفاتورة والاستحقاق</span>
              </span>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-emerald-950 font-bold text-[11px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    تاريخ الشراء / التوريد
                  </label>
                  <input
                    type="date"
                    disabled={!isEditable}
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-white border-2 border-emerald-200 p-2 rounded-xl text-slate-900 font-mono font-bold focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 disabled:border-slate-300"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-teal-950 font-bold text-[11px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
                    تاريخ الاستحقاق
                  </label>
                  <input
                    type="date"
                    disabled={!isEditable}
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full bg-white border-2 border-teal-200 p-2 rounded-xl text-slate-900 font-mono font-bold focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 disabled:bg-slate-100 disabled:border-slate-300"
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
                            : 'bg-emerald-50 text-emerald-800 border-emerald-400'
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
                        <select
                          disabled={!isEditable}
                          value={item.taxRate}
                          onChange={e => handleItemChange(item.id, 'taxRate', Number(e.target.value))}
                          className="w-full bg-white p-1.5 rounded-xl border-2 border-slate-500 font-mono text-center font-bold text-slate-900 focus:outline-none focus:border-slate-900 disabled:bg-slate-100 disabled:border-slate-300"
                        >
                          <option value="15">15%</option>
                          <option value="5">5%</option>
                          <option value="0">0%</option>
                        </select>
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

        {/* Add Item Action Bar - Green & Emerald Styled */}
        <div className="p-4 border-t-2 border-slate-700 bg-emerald-50/40 print:hidden flex flex-wrap items-center justify-between gap-3">
          {isEditable ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:from-emerald-800 active:to-teal-900 text-white rounded-xl text-xs font-black transition-all shadow-xs hover:shadow cursor-pointer border border-emerald-900"
                  title="إضافة صنف مشتريات جديد (F2 أو Insert)"
                >
                  <Plus size={16} />
                  <span>إضافة صنف مشتريات جديد</span>
                  <kbd className="text-[10px] bg-emerald-900 text-emerald-100 px-1.5 py-0.5 rounded font-mono">F2</kbd>
                </button>
              </div>
              <span className="text-xs text-emerald-950 font-black bg-white px-3.5 py-1.5 rounded-xl border-2 border-emerald-300 shadow-2xs">
                عدد الأصناف: <strong className="text-emerald-700 font-mono text-sm">{items.length}</strong>
              </span>
            </>
          ) : (
            <div className="w-full flex items-center justify-between text-xs text-slate-700 py-1 font-bold">
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-emerald-700" />
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
                  className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer border border-emerald-950"
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
              className="w-full bg-white border-2 border-emerald-300 rounded-2xl p-3 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 min-h-[95px] resize-none disabled:bg-slate-100 disabled:border-slate-300 shadow-2xs"
            />
          </div>

          {/* Calculations Matrix Card - Deep Winter Dark Box with Emerald Accents */}
          <div className="md:col-span-5 bg-slate-900 text-white p-5 rounded-2xl border-2 border-emerald-700/60 shadow-lg space-y-3">
            <div className="flex justify-between items-center text-xs text-slate-300">
              <span className="font-bold">المجموع الخاضع للضريبة:</span>
              <span className="font-mono font-black text-white text-sm">
                {totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
              </span>
            </div>

            {classification === 'TAX' && (
              <div className="flex justify-between items-center text-xs text-slate-300">
                <span className="font-bold">ضريبة القيمة المضافة (VAT 15%):</span>
                <span className="font-mono font-black text-emerald-300 text-sm">
                  {totals.taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                </span>
              </div>
            )}

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
            <div className="bg-slate-800/90 rounded-xl p-2.5 border border-emerald-700/50 text-xs">
              <span className="text-[10px] text-emerald-300 font-bold block mb-1">المبلغ كتابة بالحروف:</span>
              <p className="font-bold text-amber-300 leading-relaxed font-sans text-xs">
                {tafqeet(totals.grandTotal)}
              </p>
            </div>

            {/* خانة السداد ومبلغ الدفع وتحديد نوع الفاتورة */}
            <div className="pt-3 border-t-2 border-slate-700/90 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <CreditCard size={14} className="text-emerald-400" />
                  <span>المبلغ المسدد للمورد (السداد النقدي):</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={!isEditable}
                    onClick={() => handlePaidAmountChange(totals.grandTotal)}
                    className="px-2 py-0.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 rounded text-[10px] font-bold border border-emerald-700/60 disabled:opacity-50 transition-colors"
                  >
                    100% نقدي
                  </button>
                  <button
                    type="button"
                    disabled={!isEditable}
                    onClick={() => handlePaidAmountChange(Number((totals.grandTotal * 0.5).toFixed(2)))}
                    className="px-2 py-0.5 bg-amber-950/80 hover:bg-amber-900 text-amber-300 rounded text-[10px] font-bold border border-amber-700/60 disabled:opacity-50 transition-colors"
                  >
                    50% جزئي
                  </button>
                  <button
                    type="button"
                    disabled={!isEditable}
                    onClick={() => handlePaidAmountChange(0)}
                    className="px-2 py-0.5 bg-teal-950/80 hover:bg-teal-900 text-teal-300 rounded text-[10px] font-bold border border-teal-700/60 disabled:opacity-50 transition-colors"
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
                  className="w-full bg-slate-800/90 border-2 border-emerald-700/70 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 rounded-xl px-3 py-2 text-base font-mono font-black text-amber-300 disabled:bg-slate-900/80 disabled:border-slate-700 disabled:text-slate-400 transition-all text-left"
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
                    className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded font-bold text-[10px] border border-emerald-700/60 transition-colors cursor-pointer"
                    title="عرض كشف حساب المورد التفصيلي وحركات الفواتير والسندات"
                  >
                    <FileText size={11} />
                    <span>كشف الحساب</span>
                  </button>
                </div>

                <div className="bg-slate-800/90 rounded-xl p-3 border border-emerald-800/50 space-y-1.5 text-xs font-mono">
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

      {/* Offscreen Certified Document for Instant Pixel-Perfect PDF Export */}
      <div 
        style={{ position: 'fixed', left: '-9999px', top: '0', zIndex: -100, width: '210mm' }}
        aria-hidden="true"
      >
        <CertifiedInvoiceDocument
          ref={pdfInvoiceDocRef}
          data={currentInvoicePreviewData}
          format="A4"
        />
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
    </div>
  );
}
