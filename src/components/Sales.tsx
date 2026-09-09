import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Save, Plus, Trash2, CheckCircle2, RotateCcw, 
  History, Printer, Calendar, User, X, Edit3, Eye, Lock,
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
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const pdfInvoiceDocRef = useRef<HTMLDivElement>(null);
  
  // Is current invoice actively editable
  const isEditable = status !== 'POSTED' && isEditMode;
  
  // Classification and categorization
  const [classification, setClassification] = useState<'NORMAL' | 'TAX'>('TAX');
  const [invoiceType, setInvoiceType] = useState<string>('CASH_SALES');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [source, setSource] = useState<string>('MAIN_WAREHOUSE');
  const [safe, setSafe] = useState<string>('MAIN_SAFE');
  const [serviceType, setServiceType] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: 'item-' + Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: 15, availableStock: 0, costPrice: 0 }
  ]);

  const selectedPartner = useMemo(() => {
    return customers.find(c => c.id === partnerId || c.name === partnerId);
  }, [customers, partnerId]);

  // Live account statement for selected customer
  const selectedPartnerStatement = useMemo(() => {
    if (!selectedPartner) return null;
    return getPartnerAccountStatement(selectedPartner);
  }, [selectedPartner, savedInvoices]);

  const handleNewInvoice = () => {
    setEditingInvoiceId(null);
    const list = Array.isArray(savedInvoices) ? savedInvoices : [];
    const nextSeq = getNextSequentialNumber('salesInvoice', list.map(i => i.invoiceNumber)).formatted;
    setInvoiceNumber(nextSeq);
    setStatus('DRAFT');
    setIsEditMode(true);
    setPartnerId('');
    setDueDate('');
    setNotes('');
    setClassification('TAX');
    setInvoiceType('CASH_SALES');
    setPaidAmount(0);
    setItems([{ id: 'item-' + Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: 15, availableStock: 0, costPrice: 0 }]);
    setItemsCatalog(loadStoredItems());
  };

  const handleEditInvoice = (inv: StoredSalesInvoice) => {
    setEditingInvoiceId(inv.id);
    setInvoiceNumber(inv.invoiceNumber);
    setDate(inv.date);
    setDueDate(inv.dueDate || '');
    setPartnerId(inv.partnerId);
    setClassification(inv.classification);
    setInvoiceType(inv.invoiceType);
    setSource(inv.source);
    setSafe(inv.safe);
    setNotes(inv.notes || '');
    setStatus(inv.status);
    // When opening an invoice: if posted, editMode is false. If draft, editMode is false until user clicks "تعديل الفاتورة"
    setIsEditMode(false);
    const initialPaid = inv.totals?.cashPaid !== undefined 
      ? inv.totals.cashPaid 
      : (inv.invoiceType === 'CASH_SALES' ? inv.totals.grandTotal : 0);
    setPaidAmount(initialPaid);
    setItems(inv.items.length > 0 ? inv.items : [{ id: 'item-' + Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: 15, availableStock: 0, costPrice: 0 }]);
    setItemsCatalog(loadStoredItems());
    setShowInvoicesHistory(false);
  };

  const handleStartEditInvoice = () => {
    if (status === 'POSTED') {
      alert('⚠️ لا يمكن تعديل الفاتورة أو إضافة/حذف أي صنف وهي مرحلة ومعتمدة!\n\nيرجى أولاً الضغط على زر [إلغاء الترحيل]، ثم الضغط على زر [تعديل الفاتورة].');
      return;
    }
    setIsEditMode(true);
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
        taxRate: classification === 'TAX' ? 15 : 0,
        availableStock: 0,
        costPrice: 0
      }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (!isEditable) {
      if (status === 'POSTED') {
        alert('⚠️ لا يمكن حذف أي صنف لأن الفاتورة مرحلة ومقفلة!\n\nيرجى أولاً الضغط على زر [إلغاء الترحيل] ثم الضغط على [تعديل الفاتورة].');
      } else {
        alert('⚠️ الفاتورة في وضع المعاينة الآمنة. يرجى الضغط على زر [تعديل الفاتورة] بالأعلى أولاً لتفعيل الحذف.');
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
      status === 'POSTED' ? invoiceNumber : undefined,
      'CUSTOMER',
      selectedPartnerStatement
    );
  }, [selectedPartner, totals.grandTotal, paidAmount, status, invoiceNumber, selectedPartnerStatement]);

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

  const handleExportPdf = async () => {
    if (isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      // Wait a tick to allow the offscreen certified document to render in DOM
      await new Promise(resolve => setTimeout(resolve, 80));
      if (!pdfInvoiceDocRef.current) {
        throw new Error('PDF container not ready');
      }
      const safeNumber = invoiceNumber.trim() || 'DRAFT';
      await exportElementToPdf(pdfInvoiceDocRef.current, {
        filename: `فاتورة_مبيعات_${safeNumber}.pdf`,
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
      alert("يرجى اختيار العميل أولاً");
      return false;
    }

    const finalNumber = invoiceNumber.trim() || nextCalculatedInvoiceNum;
    
    // Check duplication
    if (!editingInvoiceId) {
      const isDuplicate = savedInvoices.some(i => i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === finalNumber.toLowerCase());
      if (isDuplicate) {
        alert(`⚠️ رقم الفاتورة (${finalNumber}) مستخدم مسبقاً! تم اقتراح الرقم التسلسلي التالي (#${nextCalculatedInvoiceNum}).`);
        setInvoiceNumber(nextCalculatedInvoiceNum);
        return false;
      }
    } else {
      const isDuplicate = savedInvoices.some(i => i.id !== editingInvoiceId && i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === finalNumber.toLowerCase());
      if (isDuplicate) {
        alert(`⚠️ رقم الفاتورة (${finalNumber}) مستخدم مسبقاً في فاتورة أخرى!`);
        return false;
      }
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
      setIsEditMode(false);
      alert(`تم حفظ فاتورة المبيعات رقم (${invoiceNumber}) كمسودة بنجاح!`);
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
      alert(`تم ترحيل فاتورة المبيعات رقم (${invoiceNumber}) بنجاح وقفلها ضد التعديل.\n\n🔒 لا يمكن إضافة أو حذف أو تعديل أي صنف في الفاتورة إلا بإلغاء الترحيل أولاً ثم الضغط على زر [تعديل الفاتورة].`);
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
    setIsEditMode(false); // Retain safe view mode until clicking "تعديل الفاتورة"

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

    alert('✅ تم إلغاء ترحيل الفاتورة وإعادتها كمسودة بنجاح واسترجاع كميات المخزون.\n\n⚠️ الفاتورة حالياً في وضع المعاينة الآمنة. للبدء في إضافة أو حذف الأصناف وتعديل البيانات، يرجى الضغط على زر [تعديل الفاتورة].');
  };

  const handleDelete = () => {
    if (confirm(`هل أنت متأكد من رغبتك في حذف الفاتورة رقم (${invoiceNumber}) نهائياً؟`)) {
      const updated = savedInvoices.filter(i => i.invoiceNumber !== invoiceNumber && (!editingInvoiceId || i.id !== editingInvoiceId));
      setSavedInvoices(updated);
      try {
        localStorage.setItem(DB_SALES_INVOICES_KEY, JSON.stringify(updated));
        notifyDataChanged();
        dispatchPartnerLedgerUpdated();
      } catch (err) {
        console.error(err);
      }
      handleNewInvoice();
      alert('تم حذف الفاتورة بنجاح.');
    }
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
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1 text-sky-700/80 text-xs font-bold">
            <span>العملاء والمبيعات</span>
            <span>/</span>
            <span className="text-indigo-900 font-extrabold">فواتير المبيعات</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-sky-600 via-indigo-700 to-blue-900 bg-clip-text text-transparent">
              فاتورة المبيعات
            </h1>
            <span className={`px-2.5 py-1 text-xs font-black rounded-lg border ${
              status === 'POSTED' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                : isEditMode
                ? 'bg-sky-50 text-indigo-900 border-sky-300'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}>
              {status === 'POSTED' ? 'مرحلة ومعتمدة' : isEditMode ? 'مسودة قيد التحرير' : 'مسودة (وضع العرض)'}
            </span>
            {editingInvoiceId && (
              <span className="px-2.5 py-1 text-xs font-black rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-300 flex items-center gap-1 shadow-2xs">
                <Edit3 size={12} className="text-indigo-600" /> تعديل #{invoiceNumber}
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
                ? 'bg-indigo-100 border-indigo-300 text-indigo-950' 
                : 'bg-white border-slate-300 text-slate-700 hover:bg-sky-50/50'
            }`}
            title="سجل الفواتير (Ctrl+H)"
          >
            <History size={14} className="text-indigo-600" />
            <span>سجل الفواتير ({savedInvoices.length})</span>
            <kbd className="hidden sm:inline-block text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono border border-slate-300">Ctrl+H</kbd>
          </button>

          <button
            type="button"
            onClick={handleNewInvoice}
            className="flex items-center gap-1.5 px-3 py-2 bg-sky-50 text-indigo-900 hover:bg-sky-100 border-2 border-sky-300 rounded-xl text-xs font-black transition-colors cursor-pointer shadow-2xs"
            title="فاتورة جديدة (Ctrl+N)"
          >
            <Plus size={14} className="text-sky-600" />
            <span>فاتورة جديدة #{nextCalculatedInvoiceNum}</span>
            <kbd className="hidden sm:inline-block text-[9px] bg-sky-100 text-indigo-950 px-1.5 py-0.5 rounded font-mono font-black border border-sky-300">Ctrl+N</kbd>
          </button>

          {status === 'DRAFT' ? (
            <>
              {!isEditMode ? (
                <button
                  type="button"
                  onClick={handleStartEditInvoice}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-sky-600 to-indigo-700 hover:from-sky-700 hover:to-indigo-800 text-white rounded-xl text-xs font-black transition-colors cursor-pointer shadow-sm border border-indigo-900"
                  title="تعديل الفاتورة (Ctrl+S)"
                >
                  <Edit3 size={14} />
                  <span>تعديل الفاتورة</span>
                  <kbd className="hidden sm:inline-block text-[9px] bg-indigo-900 text-sky-200 px-1.5 py-0.5 rounded font-mono">Ctrl+S</kbd>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white border-2 border-sky-400 text-indigo-950 hover:bg-sky-50 rounded-xl text-xs font-black transition-colors cursor-pointer shadow-2xs"
                  title="حفظ مسودة (Ctrl+S)"
                >
                  <Save size={14} className="text-sky-600" />
                  <span>حفظ مسودة</span>
                  <kbd className="hidden sm:inline-block text-[9px] bg-sky-50 text-indigo-900 px-1.5 py-0.5 rounded font-mono border border-sky-300">Ctrl+S</kbd>
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
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
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
              title="تصدير الفاتورة الحالية بتنسيقها المعتمد كملف PDF"
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
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من رغبتك في حذف الفاتورة رقم (${inv.invoiceNumber})؟`)) {
                                const updated = savedInvoices.filter(i => i.id !== inv.id);
                                setSavedInvoices(updated);
                                localStorage.setItem(DB_SALES_INVOICES_KEY, JSON.stringify(updated));
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

      {/* Main Invoice Card */}
      <div className={`bg-white rounded-3xl shadow-sm border-2 ${
        status === 'POSTED' ? 'border-slate-800' : 'border-slate-700'
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

        {/* Modern Settings / Control Strip - Colorized & Sky/Indigo Winter Styled Boxes */}
        <div className="bg-slate-100/90 border-b-2 border-slate-700 p-4 sm:p-5 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5 text-xs">
            {/* Invoice Number (Sequential & Read-Only) */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-sky-500 shadow-2xs space-y-1.5 ring-2 ring-sky-50">
              <div className="flex items-center justify-between">
                <label className="text-indigo-950 font-black text-[11px] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-sky-600 inline-block"></span>
                  رقم الفاتورة
                </label>
                <span className="text-[10px] text-sky-900 font-mono bg-sky-50 border border-sky-300 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1">
                  <Lock size={10} className="text-sky-600" />
                  <span>تلقائي</span>
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={invoiceNumber}
                  className="w-full bg-gradient-to-r from-slate-900 to-indigo-950 border border-indigo-900 py-1.5 px-4 rounded-xl font-mono font-black text-cyan-300 text-center select-all focus:outline-none cursor-not-allowed shadow-inner"
                  title="رقم الفاتورة يتولد تسلسلياً تلقائياً من النظام ومحمي من التعديل"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sky-400 font-mono font-bold text-xs">
                  #
                </span>
              </div>
            </div>

            {/* Classification */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-indigo-500 shadow-2xs space-y-1.5 ring-2 ring-indigo-50">
              <label className="text-indigo-950 font-black text-[11px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block"></span>
                تصنيف الفاتورة
              </label>
              <select
                disabled={!isEditable}
                value={classification}
                onChange={e => setClassification(e.target.value as 'NORMAL' | 'TAX')}
                className="w-full bg-indigo-50/40 border-2 border-indigo-300 p-1.5 rounded-xl text-indigo-950 font-bold focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 disabled:bg-slate-100 disabled:border-slate-300"
              >
                <option value="TAX">فاتورة ضريبية (15%)</option>
                <option value="NORMAL">فاتورة عادية (0%)</option>
              </select>
            </div>

            {/* Invoice Type */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-sky-600 shadow-2xs space-y-1.5 ring-2 ring-sky-50">
              <label className="text-sky-950 font-black text-[11px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-600 inline-block"></span>
                نوع المعاملة
              </label>
              <select
                disabled={!isEditable}
                value={invoiceType}
                onChange={e => handleInvoiceTypeChange(e.target.value)}
                className="w-full bg-sky-50/40 border-2 border-sky-300 p-1.5 rounded-xl text-sky-950 font-bold focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 disabled:bg-slate-100 disabled:border-slate-300"
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
            <div className="bg-white p-2.5 rounded-2xl border-2 border-emerald-500 shadow-2xs space-y-1.5 ring-2 ring-emerald-50">
              <label className="text-emerald-950 font-black text-[11px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                نوع الخدمة
              </label>
              <select
                disabled={!isEditable}
                value={serviceType}
                onChange={e => setServiceType(e.target.value)}
                className="w-full bg-emerald-50/40 border-2 border-emerald-300 p-1.5 rounded-xl text-emerald-950 font-bold focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 disabled:border-slate-300"
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
            <div className="bg-white p-2.5 rounded-2xl border-2 border-indigo-500 shadow-2xs space-y-1.5 ring-2 ring-indigo-50">
              <label className="text-indigo-950 font-black text-[11px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
                مستودع التوريد
              </label>
              <select
                disabled={!isEditable}
                value={source}
                onChange={e => setSource(e.target.value)}
                className="w-full bg-indigo-50/40 border-2 border-indigo-300 p-1.5 rounded-xl text-indigo-950 font-bold focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 disabled:bg-slate-100 disabled:border-slate-300"
              >
                <option value="MAIN_WAREHOUSE">المستودع الرئيسي</option>
                <option value="SHOWROOM">معرض المبيعات</option>
                <option value="BRANCH_1">فرع الرياض</option>
              </select>
            </div>

            {/* Safe / Cashbox */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-sky-500 shadow-2xs space-y-1.5 ring-2 ring-sky-50">
              <label className="text-sky-950 font-black text-[11px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-500 inline-block"></span>
                خزنة التحصيل
              </label>
              <select
                disabled={!isEditable}
                value={safe}
                onChange={e => setSafe(e.target.value)}
                className="w-full bg-sky-50/40 border-2 border-sky-300 p-1.5 rounded-xl text-sky-950 font-bold focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 disabled:bg-slate-100 disabled:border-slate-300"
              >
                <option value="MAIN_SAFE">الصندوق الرئيسي (كاش)</option>
                <option value="BANK_AHLI">حساب البنك الأهلي</option>
                <option value="BANK_RAJHI">حساب بنك الراجحي</option>
              </select>
            </div>
          </div>
        </div>

        {/* Customer & Dates Section - Sky & Indigo Winter Bordered Boxes */}
        <div className="p-5 sm:p-6 border-b-2 border-slate-700 grid grid-cols-1 md:grid-cols-12 gap-5 bg-slate-50/40">
          {/* Customer Selection Card */}
          <div className="md:col-span-7 bg-white rounded-2xl border-2 border-sky-400 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-sky-200 via-sky-100 to-indigo-100 px-4 py-2.5 border-b-2 border-sky-300 flex items-center justify-between">
              <span className="text-xs font-black text-indigo-950 flex items-center gap-2">
                <span className="p-1 rounded-lg bg-sky-600 text-white shadow-2xs">
                  <User size={14} />
                </span>
                <span>بيانات العميل (المشتري)</span>
              </span>
              {selectedPartner?.taxNumber && (
                <span className="text-[11px] font-mono font-black text-indigo-950 bg-white px-2 py-0.5 rounded-lg border border-sky-300 shadow-2xs">
                  ضريبي: {selectedPartner.taxNumber}
                </span>
              )}
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-extrabold text-indigo-950 mb-1 block">اسم العميل المسجل بالحساب:</label>
                  <select
                    disabled={!isEditable}
                    required
                    value={partnerId}
                    onChange={e => setPartnerId(e.target.value)}
                    className="w-full bg-white border-2 border-slate-400 p-2.5 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 disabled:bg-slate-100 disabled:border-slate-300"
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
                    <div className="text-xs text-slate-800 bg-sky-50/50 p-2 rounded-xl border border-sky-200 flex items-center justify-between">
                      <span className="text-indigo-950 font-bold">الهاتف:</span>
                      <span className="font-mono font-bold text-slate-900">{selectedPartner.phone || 'غير مسجل'}</span>
                    </div>
                    <div className="text-xs text-slate-800 bg-sky-50/50 p-2 rounded-xl border border-sky-200 flex items-center justify-between">
                      <span className="text-indigo-950 font-bold">الرصيد الفعلي الحالي:</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`font-mono font-black ${
                          selectedPartnerStatement?.balanceType === 'DEBIT' 
                            ? 'text-emerald-700' 
                            : selectedPartnerStatement?.balanceType === 'CREDIT' 
                            ? 'text-indigo-700' 
                            : 'text-slate-600'
                        }`}>
                          {selectedPartnerStatement?.balanceFormatted || '0.00'} {currencySymbol}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">({selectedPartnerStatement?.balanceLabel || 'متزن'})</span>
                      </div>
                    </div>
                    <div className="sm:col-span-2 flex items-center justify-between bg-sky-50/60 p-2 rounded-xl border border-sky-200 text-xs">
                      <div className="flex items-center gap-2 text-indigo-950">
                        <User size={13} className="text-sky-600" />
                        <span className="font-bold">كشف حساب العميل والعمليات السابقة:</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPartnerForStatementModal(selectedPartner)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-sky-100 text-indigo-900 rounded-lg font-black border border-sky-300 text-[11px] transition-colors cursor-pointer shadow-2xs"
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
          <div className="md:col-span-5 bg-white rounded-2xl border-2 border-indigo-400 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-200 via-sky-100 to-indigo-100 px-4 py-2.5 border-b-2 border-indigo-300 flex items-center justify-between">
              <span className="text-xs font-black text-indigo-950 flex items-center gap-2">
                <span className="p-1 rounded-lg bg-indigo-600 text-white shadow-2xs">
                  <Calendar size={14} />
                </span>
                <span>تاريخ الفاتورة والاستحقاق</span>
              </span>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-indigo-950 font-bold text-[11px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-600"></span>
                    تاريخ الإصدار
                  </label>
                  <input
                    type="date"
                    disabled={!isEditable}
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-white border-2 border-sky-200 p-2 rounded-xl text-slate-900 font-mono font-bold focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 disabled:bg-slate-100 disabled:border-slate-300"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-indigo-950 font-bold text-[11px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                    تاريخ الاستحقاق
                  </label>
                  <input
                    type="date"
                    disabled={!isEditable}
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full bg-white border-2 border-indigo-200 p-2 rounded-xl text-slate-900 font-mono font-bold focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 disabled:bg-slate-100 disabled:border-slate-300"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Items Matrix Table - Sky & Indigo Winter Grid System */}
        <div className="overflow-x-auto min-h-[220px] border-b-2 border-slate-700 bg-white">
          <table className="w-full text-right border-collapse min-w-[820px]">
            <thead>
              <tr className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 border-y-2 border-indigo-900 text-[11px] font-bold text-slate-100 uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center border-l border-indigo-900 bg-slate-950 text-sky-300 font-mono font-black">#</th>
                <th className="py-3 px-4 border-l border-indigo-900 min-w-[200px] text-sky-300 font-black">الصنف / الخدمة</th>
                <th className="py-3 px-3 w-28 text-center border-l border-indigo-900 bg-slate-900/80 text-sky-200 print:hidden" title="الكمية المتوفرة حالياً في المخزن">
                  الكمية بالمخزن
                </th>
                <th className="py-3 px-3 w-28 text-left border-l border-indigo-900 bg-slate-900/80 text-indigo-200 print:hidden" title="متوسط سعر التكلفة المرجح (م.س.ت) للوحدة">
                  (م.س.ت) {currencySymbol}
                </th>
                <th className="py-3 px-3 w-24 text-center border-l border-indigo-900 text-sky-100">الكمية</th>
                <th className="py-3 px-3 w-28 text-left border-l border-indigo-900 text-cyan-300 font-black">سعر البيع</th>
                {classification === 'TAX' && (
                  <th className="py-3 px-3 w-20 text-center border-l border-indigo-900 text-indigo-300 font-bold">الضريبة %</th>
                )}
                <th className="py-3 px-4 w-32 text-left border-l border-indigo-900 text-sky-300 font-black">الإجمالي ({currencySymbol})</th>
                <th className="py-3 px-3 w-14 text-center print:hidden border-l border-indigo-900 text-sky-400">حذف</th>
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

        {/* Add Item Action Bar - Modern & Eye-Comfort Sky/Indigo */}
        {isEditable ? (
          <div className="p-4 border-t border-slate-200 bg-sky-50/50 print:hidden flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-700 hover:from-sky-700 hover:to-indigo-800 active:bg-indigo-900 text-white rounded-xl text-xs font-black transition-all shadow-xs hover:shadow cursor-pointer border border-indigo-900"
                title="إضافة بند جديد للفاتورة (F2 أو Insert)"
              >
                <Plus size={16} />
                <span>إضافة بند جديد للفاتورة</span>
                <kbd className="text-[10px] bg-indigo-900 text-sky-200 px-1.5 py-0.5 rounded font-mono">F2</kbd>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-indigo-950 font-bold bg-white px-3.5 py-1.5 rounded-xl border-2 border-sky-300 shadow-2xs">
                عدد البنود: <strong className="text-indigo-700 font-mono text-sm font-black">{items.length}</strong>
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3.5 border-t border-slate-200 bg-slate-50 print:hidden flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
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
                className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-sky-700 to-indigo-800 hover:from-sky-800 hover:to-indigo-900 text-white rounded-lg text-xs font-black transition-colors shadow-2xs cursor-pointer border border-indigo-950"
              >
                <Edit3 size={13} />
                <span>تعديل الفاتورة</span>
              </button>
            )}
          </div>
        )}

        {/* Summary & Totals Footer - Sky & Indigo Styling */}
        <div className="p-5 sm:p-6 border-t-2 border-slate-700 bg-slate-100/50 grid grid-cols-1 md:grid-cols-12 gap-6 items-start mt-auto">
          {/* Notes Section - Defined Winter Box */}
          <div className="md:col-span-7 space-y-2">
            <label className="text-xs font-black text-indigo-950 block">ملاحظات وشروط الدفع والتسليم:</label>
            <textarea
              disabled={!isEditable}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="اكتب هنا أي شروط أو تفاصيل إضافية متعلقة بالدفع أو التسليم أو الضمان..."
              className="w-full bg-white border-2 border-slate-400 rounded-2xl p-3 text-xs font-semibold text-slate-900 focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 min-h-[95px] resize-none disabled:bg-slate-100 disabled:border-slate-300 shadow-2xs"
            />
          </div>

          {/* Calculations Matrix Card - Deep Indigo & Slate Dark Box */}
          <div className="md:col-span-5 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white p-5 rounded-2xl border-2 border-indigo-800 shadow-lg space-y-3">
            <div className="flex justify-between items-center text-xs text-slate-300">
              <span className="font-bold text-sky-200">المجموع الخاضع للضريبة:</span>
              <span className="font-mono font-black text-white text-sm">
                {totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
              </span>
            </div>

            {classification === 'TAX' && (
              <div className="flex justify-between items-center text-xs text-slate-300">
                <span className="font-bold text-sky-300">ضريبة القيمة المضافة (VAT 15%):</span>
                <span className="font-mono font-black text-cyan-300 text-sm">
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
              <div className="pt-2 border-t border-dashed border-indigo-800/80 space-y-1.5 print:hidden">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span className="flex items-center gap-1 font-bold text-sky-200">
                    <span>إجمالي التكلفة التقديرية</span>
                    <span className="text-[10px] bg-slate-800 text-sky-300 border border-indigo-700 px-1 py-0.5 rounded font-mono font-bold">م.س.ت</span>
                    <span>:</span>
                  </span>
                  <span className="font-mono font-bold text-slate-200">
                    {totals.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-sky-200 font-bold">الربح التقديري (قبل الضريبة):</span>
                  <span className={`font-mono font-black ${totals.grossProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {totals.grossProfit >= 0 ? '+' : ''}{totals.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol} 
                    <span className="text-[11px] font-normal mr-1">({totals.profitMargin.toFixed(1)}%)</span>
                  </span>
                </div>
              </div>
            )}

            <div className="border-t-2 border-indigo-800 pt-3.5 flex justify-between items-center">
              <span className="text-sm font-black text-sky-300">صافي القيمة الإجمالية:</span>
              <div className="text-left">
                <span className="text-xl sm:text-2xl font-mono font-black text-cyan-300 block">
                  {totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-sky-400 font-extrabold uppercase tracking-wider">{currencyFullNameAr}</span>
              </div>
            </div>

            {/* المبلغ كتابة بالحروف (تفقيط المبلغ الإجمالي) - أسفل خانة صافي المبلغ الإجمالي */}
            <div className="bg-slate-900/90 rounded-xl p-2.5 border border-indigo-700/80 text-xs">
              <span className="text-[10px] text-sky-300 font-bold block mb-1">المبلغ كتابة بالحروف:</span>
              <p className="font-bold text-cyan-200 leading-relaxed font-sans text-xs">
                {tafqeet(totals.grandTotal)}
              </p>
            </div>

            {/* خانة السداد ومبلغ الدفع وتحديد نوع الفاتورة */}
            <div className="pt-3 border-t-2 border-indigo-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-sky-200 flex items-center gap-1.5">
                  <CreditCard size={14} className="text-sky-400" />
                  <span>المبلغ المسدد (السداد النقدي):</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={!isEditable}
                    onClick={() => handlePaidAmountChange(totals.grandTotal)}
                    className="px-2 py-0.5 bg-sky-950/90 hover:bg-sky-900 text-sky-300 rounded text-[10px] font-bold border border-sky-600/70 disabled:opacity-50 transition-colors"
                  >
                    100% نقدي
                  </button>
                  <button
                    type="button"
                    disabled={!isEditable}
                    onClick={() => handlePaidAmountChange(Number((totals.grandTotal * 0.5).toFixed(2)))}
                    className="px-2 py-0.5 bg-indigo-950/90 hover:bg-indigo-900 text-indigo-300 rounded text-[10px] font-bold border border-indigo-600/70 disabled:opacity-50 transition-colors"
                  >
                    50% جزئي
                  </button>
                  <button
                    type="button"
                    disabled={!isEditable}
                    onClick={() => handlePaidAmountChange(0)}
                    className="px-2 py-0.5 bg-slate-950/90 hover:bg-slate-900 text-slate-300 rounded text-[10px] font-bold border border-slate-700 disabled:opacity-50 transition-colors"
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
                  className="w-full bg-slate-900/90 border-2 border-indigo-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-3 py-2 text-base font-mono font-black text-cyan-300 disabled:bg-slate-950 disabled:border-slate-800 disabled:text-slate-500 transition-all text-left"
                />
                <span className="absolute right-3 top-2.5 text-xs text-sky-300 font-bold pointer-events-none">
                  {currencySymbol} مسدد
                </span>
              </div>

              {/* Dynamic Status / Type Badge & Remaining Amount */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/90 p-2 rounded-xl border border-indigo-800 flex flex-col justify-center">
                  <span className="text-[10px] text-sky-300 font-bold">نوع الفاتورة التلقائي:</span>
                  <span className={`text-xs font-black mt-0.5 ${
                    paidAmount >= totals.grandTotal - 0.001 && totals.grandTotal > 0
                      ? 'text-emerald-400'
                      : paidAmount > 0.001
                      ? 'text-amber-400'
                      : 'text-sky-300'
                  }`}>
                    {paidAmount >= totals.grandTotal - 0.001 && totals.grandTotal > 0
                      ? '🟢 فاتورة نقدية (مسددة بالكامل)'
                      : paidAmount > 0.001
                      ? '🟡 فاتورة جزئية (سداد جزء)'
                      : '🔵 فاتورة آجلة (غير مسددة)'}
                  </span>
                </div>

                <div className="bg-slate-900/90 p-2 rounded-xl border border-indigo-800 flex flex-col justify-center">
                  <span className="text-[10px] text-sky-300 font-bold">المبلغ المتبقي:</span>
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
              <div className="mt-3 pt-3 border-t border-indigo-800/90 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-sky-200 font-bold flex items-center gap-1.5">
                    <User size={13} className="text-sky-400" />
                    <span>موقف حساب العميل:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPartnerForStatementModal(selectedPartner)}
                    className="flex items-center gap-1 px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-sky-300 rounded font-bold text-[10px] border border-indigo-700 transition-colors cursor-pointer"
                    title="عرض كشف حساب العميل التفصيلي وحركات الفواتير والسندات"
                  >
                    <FileText size={11} />
                    <span>كشف الحساب</span>
                  </button>
                </div>

                <div className="bg-slate-900/90 rounded-xl p-3 border border-indigo-800/90 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between items-center text-slate-300 text-[11px]">
                    <span className="font-sans text-sky-200">الرصيد السابق قبل الفاتورة:</span>
                    <span className="font-bold text-slate-100">
                      {partnerBalanceImpact.previousBalanceFormatted} {currencySymbol} ({partnerBalanceImpact.previousBalanceLabel})
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300 text-[11px]">
                    <span className="font-sans text-sky-200">قيمة الفاتورة الحالية (+):</span>
                    <span className="font-bold text-slate-100">
                      +{partnerBalanceImpact.invoiceAmountFormatted} {currencySymbol}
                    </span>
                  </div>
                  {partnerBalanceImpact.paidAmount > 0 && (
                    <div className="flex justify-between items-center text-slate-300 text-[11px]">
                      <span className="font-sans text-sky-200">المسدد نقداً بالفاتورة (-):</span>
                      <span className="font-bold text-emerald-400">
                        -{partnerBalanceImpact.paidAmountFormatted} {currencySymbol}
                      </span>
                    </div>
                  )}
                  {partnerBalanceImpact.remainingAmount > 0 && partnerBalanceImpact.paidAmount > 0 && (
                    <div className="flex justify-between items-center text-slate-300 text-[11px]">
                      <span className="font-sans text-sky-200">صافي الإضافة لحساب العميل:</span>
                      <span className="font-bold text-cyan-300">
                        +{partnerBalanceImpact.remainingAmountFormatted} {currencySymbol}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-indigo-800 flex justify-between items-center">
                    <span className="text-sky-300 font-bold text-xs font-sans">الموقف النهائي بعد الفاتورة:</span>
                    <div className="text-left">
                      <span className={`text-base font-black ${
                        partnerBalanceImpact.newBalanceType === 'DEBIT' 
                          ? 'text-cyan-300' 
                          : partnerBalanceImpact.newBalanceType === 'CREDIT' 
                          ? 'text-indigo-300' 
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

      {/* Offscreen Certified Document for Instant Pixel-Perfect PDF Export (rendered on demand) */}
      {isExportingPdf && (
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
      )}

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
