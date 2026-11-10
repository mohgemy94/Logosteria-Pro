import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  FileSpreadsheet, FileText, Printer, Search, Filter, Calendar, 
  ArrowDownLeft, ArrowUpRight, ArrowRight, CheckCircle2, RotateCcw, 
  RefreshCw, ChevronDown, ChevronRight, ChevronLeft, ChevronUp, Check, AlertCircle, 
  ExternalLink, X, Scale, Layers, Eye, Percent, Tag,
  Contrast, ZoomIn, ZoomOut, Maximize2, Minimize2, Palette,
  CheckCircle, Download, Sliders, Share2, LayoutGrid, List, MessageSquare, Copy,
  Smartphone, SlidersHorizontal, Package, ChevronsLeft, ChevronsRight, BookOpen,
  Phone, Send, Edit3, FileDown, Loader2
} from 'lucide-react';
import { Partner } from '../types/accounting';
import { 
  loadCustomers, 
  loadVendors, 
  getPartnerAccountStatement, 
  PartnerStatement, 
  PartnerLedgerTx 
} from '../utils/partnerLedger';
import { loadStoredItems, Item } from '../utils/itemsStore';
import { useSystemCurrency } from '../utils/currency';
import { getSystemSettings } from '../utils/settings';
import { exportToXLSX } from '../utils/universalExport';
import { exportElementToPdf, printElementDirectly } from '../utils/pdfExport';
import DocumentViewerModal from './modals/DocumentViewerModal';

interface DetailedStatementScreenProps {
  initialPartnerId?: string;
  onNavigate?: (view: string) => void;
}

/**
 * Single detail row inside a document block (e.g. an invoice item line or voucher detail)
 */
export interface BlockDetailLine {
  id: string;
  typeLabel: string;
  docNumber: string;
  date: string;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  taxAmount?: number | null;
  taxRate?: number | null;
  discount?: number | null;
  total: number;
  debit: number | null;
  credit: number | null;
}

/**
 * Document block representing one complete transaction grouped with its lines
 */
export interface StatementDocBlock {
  id: string;
  docType: 'SALES_INVOICE' | 'PURCHASE_INVOICE' | 'RECEIPT_VOUCHER' | 'PAYMENT_VOUCHER' | 'JOURNAL_ENTRY' | 'OPENING';
  docTypeLabel: string;
  docNumber: string;
  date: string;
  status: 'POSTED' | 'DRAFT';
  isMultiLine: boolean;
  lines: BlockDetailLine[];
  totalQuantity: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  docTotal: number;
  totalDebit: number;
  totalCredit: number;
  runningBalance: number;
  runningBalanceType: 'DEBIT' | 'CREDIT' | 'ZERO';
  rawDoc?: any;
}

/**
 * Represents an exact discrete printed A4 page of the statement
 */
export interface StatementPageChunk {
  pageNumber: number;
  totalPages: number;
  blocks: StatementDocBlock[];
  isFirstPage: boolean;
  isLastPage: boolean;
  openingCarriedBalance: number;
  openingCarriedBalanceType: 'DEBIT' | 'CREDIT' | 'ZERO';
  closingCarriedBalance: number;
  closingCarriedBalanceType: 'DEBIT' | 'CREDIT' | 'ZERO';
}

export default function DetailedStatementScreen({
  initialPartnerId,
  onNavigate
}: DetailedStatementScreenProps) {
  const { symbol: currencySymbol, fullNameAr: currencyFullNameAr, tafqeet } = useSystemCurrency();
  const systemSettings = getSystemSettings();
  const companyName = systemSettings?.company?.nameAr || systemSettings?.company?.nameEn || 'لوجوستريا للمحاسبة';

  // Partner selection states
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(() => {
    if (initialPartnerId) return initialPartnerId;
    try {
      const stored = sessionStorage.getItem('selected_statement_partner_id');
      if (stored) return stored;
    } catch {
      // ignore
    }
    return '';
  });
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(Boolean(initialPartnerId));
  const [partnerSearchTerm, setPartnerSearchTerm] = useState('');
  const [isPartnerDropdownOpen, setIsPartnerDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const partnerSearchInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'ALL' | 'INVOICES' | 'RECEIPTS' | 'PAYMENTS' | 'JOURNALS'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'POSTED' | 'DRAFT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Print & Export States
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printOrientation, setPrintOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>('LANDSCAPE');
  const [statementColorMode, setStatementColorMode] = useState<'COLOR' | 'BW'>('COLOR');
  const [statementDetailLevel, setStatementDetailLevel] = useState<'DETAILED' | 'SUMMARY'>('DETAILED');
  const [includeItemsInPrint, setIncludeItemsInPrint] = useState(true);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [estimatedPages, setEstimatedPages] = useState(1);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const modalSheetRef = useRef<HTMLDivElement>(null);
  const statementSheetRef = useRef<HTMLDivElement>(null);
  const allPagesPrintRef = useRef<HTMLDivElement>(null);

  // Modal Pan & Drag States
  const [modalPan, setModalPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isModalDragging, setIsModalDragging] = useState(false);
  const modalDragRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number }>({
    startX: 0,
    startY: 0,
    initialPanX: 0,
    initialPanY: 0
  });

  const resetModalPan = () => {
    setModalPan({ x: 0, y: 0 });
  };

  const handleModalMouseDown = (e: React.MouseEvent) => {
    if (previewZoom <= 100) return;
    setIsModalDragging(true);
    modalDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: modalPan.x,
      initialPanY: modalPan.y
    };
  };

  const handleModalMouseMove = (e: React.MouseEvent) => {
    if (!isModalDragging || previewZoom <= 100) return;
    const dx = e.clientX - modalDragRef.current.startX;
    const dy = e.clientY - modalDragRef.current.startY;
    setModalPan({
      x: modalDragRef.current.initialPanX + dx,
      y: modalDragRef.current.initialPanY + dy
    });
  };

  const handleModalMouseUp = () => {
    setIsModalDragging(false);
  };

  const handleModalTouchStart = (e: React.TouchEvent) => {
    if (previewZoom <= 100 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setIsModalDragging(true);
    modalDragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      initialPanX: modalPan.x,
      initialPanY: modalPan.y
    };
  };

  const handleModalTouchMove = (e: React.TouchEvent) => {
    if (!isModalDragging || previewZoom <= 100) return;
    const touch = e.touches[0];
    const dx = touch.clientX - modalDragRef.current.startX;
    const dy = touch.clientY - modalDragRef.current.startY;
    setModalPan({
      x: modalDragRef.current.initialPanX + dx,
      y: modalDragRef.current.initialPanY + dy
    });
  };

  const handleModalTouchEnd = () => {
    setIsModalDragging(false);
  };

  // WhatsApp Share States
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppRecipientPhone, setWhatsAppRecipientPhone] = useState('');
  const [whatsAppMessageText, setWhatsAppMessageText] = useState('');
  const [isEditingWhatsAppText, setIsEditingWhatsAppText] = useState(false);
  const [isCopiedText, setIsCopiedText] = useState(false);

  // Document Viewer Modal States
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerDocId, setViewerDocId] = useState<string | null>(null);
  const [viewerDocType, setViewerDocType] = useState<string | null>(null);

  // Direct navigation to original document or modal viewer fallback
  const handleOpenViewer = (docId: string, docType?: string, rawDoc?: any) => {
    if (!docId && !rawDoc) return;
    
    const docNumber = rawDoc?.invoiceNumber || rawDoc?.voucherNumber || rawDoc?.entryNumber || rawDoc?.referenceNo || '';
    const cleanNum = docNumber ? String(docNumber).replace(/^#+/, '').trim() : '';
    const cleanId = String(docId).replace(/^(inv-|voucher-|je-|pi-|si-)/i, '').trim();

    let targetView = '';

    if (docType === 'SALES_INVOICE' || docType === 'invoice') {
      targetView = 'sales';
      try {
        sessionStorage.setItem('alpha_target_sales_invoice_id', String(docId));
        if (cleanId) sessionStorage.setItem('alpha_target_sales_invoice_id', cleanId);
        if (docNumber) sessionStorage.setItem('alpha_target_sales_invoice_number', String(docNumber));
        if (cleanNum) sessionStorage.setItem('alpha_target_sales_invoice_number', cleanNum);
      } catch (e) {}
    } else if (docType === 'PURCHASE_INVOICE' || docType === 'purchase_invoice') {
      targetView = 'purchases';
      try {
        sessionStorage.setItem('alpha_target_purchase_invoice_id', String(docId));
        if (cleanId) sessionStorage.setItem('alpha_target_purchase_invoice_id', cleanId);
        if (docNumber) sessionStorage.setItem('alpha_target_purchase_invoice_number', String(docNumber));
        if (cleanNum) sessionStorage.setItem('alpha_target_purchase_invoice_number', cleanNum);
      } catch (e) {}
    } else if (docType === 'RECEIPT_VOUCHER' || docType === 'receipt') {
      targetView = 'externalReceipt';
      try {
        sessionStorage.setItem('alpha_target_voucher_id', String(docId));
        if (cleanId) sessionStorage.setItem('alpha_target_voucher_id', cleanId);
        if (docNumber) sessionStorage.setItem('alpha_target_voucher_number', String(docNumber));
        if (cleanNum) sessionStorage.setItem('alpha_target_voucher_number', cleanNum);
      } catch (e) {}
    } else if (docType === 'PAYMENT_VOUCHER' || docType === 'payment') {
      targetView = 'externalPayment';
      try {
        sessionStorage.setItem('alpha_target_voucher_id', String(docId));
        if (cleanId) sessionStorage.setItem('alpha_target_voucher_id', cleanId);
        if (docNumber) sessionStorage.setItem('alpha_target_voucher_number', String(docNumber));
        if (cleanNum) sessionStorage.setItem('alpha_target_voucher_number', cleanNum);
      } catch (e) {}
    } else if (docType === 'JOURNAL_ENTRY' || docType === 'journal_entry') {
      targetView = 'journal';
      try {
        sessionStorage.setItem('alpha_target_journal_entry_id', String(docId));
        if (cleanId) sessionStorage.setItem('alpha_target_journal_entry_id', cleanId);
        if (docNumber) sessionStorage.setItem('alpha_target_journal_entry_number', String(docNumber));
        if (cleanNum) sessionStorage.setItem('alpha_target_journal_entry_number', cleanNum);
      } catch (e) {}
    } else if (docType === 'INTERNAL_RECEIPT' || docType === 'internal_receipt') {
      targetView = 'internalReceipt';
      try {
        sessionStorage.setItem('alpha_target_internal_receipt_id', String(docId));
        if (cleanId) sessionStorage.setItem('alpha_target_internal_receipt_id', cleanId);
        if (docNumber) sessionStorage.setItem('alpha_target_internal_receipt_number', String(docNumber));
      } catch (e) {}
    } else if (docType === 'INTERNAL_PAYMENT' || docType === 'internal_payment') {
      targetView = 'internalPayment';
      try {
        sessionStorage.setItem('alpha_target_internal_payment_id', String(docId));
        if (cleanId) sessionStorage.setItem('alpha_target_internal_payment_id', cleanId);
        if (docNumber) sessionStorage.setItem('alpha_target_internal_payment_number', String(docNumber));
      } catch (e) {}
    }

    if (targetView) {
      if (onNavigate) {
        onNavigate(targetView);
      } else {
        window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: targetView } }));
      }
      return;
    }

    let normalizedType = 'invoice';
    if (docType === 'SALES_INVOICE') normalizedType = 'invoice';
    else if (docType === 'PURCHASE_INVOICE') normalizedType = 'purchase_invoice';
    else if (docType === 'RECEIPT_VOUCHER') normalizedType = 'receipt';
    else if (docType === 'PAYMENT_VOUCHER') normalizedType = 'payment';
    else if (docType === 'JOURNAL_ENTRY') normalizedType = 'journal_entry';
    else normalizedType = docType || 'invoice';

    setViewerDocId(docId);
    setViewerDocType(normalizedType);
    setIsViewerOpen(true);
  };

  // Mobile Responsiveness States
  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [previewDisplayMode, setPreviewDisplayMode] = useState<'CARDS' | 'ALL_PAGES'>(
    () => (typeof window !== 'undefined' && window.innerWidth < 768) ? 'CARDS' : 'ALL_PAGES'
  );
  const [mainTableMode, setMainTableMode] = useState<'CARDS' | 'TABLE'>(() => (typeof window !== 'undefined' && window.innerWidth < 768) ? 'CARDS' : 'TABLE');
  const [showMobileOptions, setShowMobileOptions] = useState(false);

  const calculateModalFitZoom = useCallback(() => {
    if (typeof window === 'undefined') return 100;
    const isLandscape = printOrientation === 'LANDSCAPE';
    const baseW = isLandscape ? 1240 : 850;
    const availableW = window.innerWidth - (window.innerWidth < 640 ? 16 : 48);
    if (availableW < baseW) {
      const fit = Math.floor((availableW / baseW) * 100);
      return Math.min(100, Math.max(25, fit));
    }
    return 100;
  }, [printOrientation]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobileScreen(mobile);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Block Expanding (Multi-item Invoices)
  const [expandedBlockIds, setExpandedBlockIds] = useState<Record<string, boolean>>({});
  const [expandAllBlocks, setExpandAllBlocks] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const toggleBlockExpand = (blockId: string) => {
    setExpandedBlockIds(prev => ({
      ...prev,
      [blockId]: prev[blockId] === undefined ? !expandAllBlocks : !prev[blockId]
    }));
  };

  const toggleExpandAll = () => {
    const nextState = !expandAllBlocks;
    setExpandAllBlocks(nextState);
    const updated: Record<string, boolean> = {};
    (statementCalculation.documentBlocks || []).forEach(b => {
      if (b.isMultiLine) {
        updated[b.id] = nextState;
      }
    });
    setExpandedBlockIds(updated);
  };

  // Helper to format clean document number without redundant prefixes or multiple #
  const formatCleanDocNumber = (rawNum?: string): string => {
    if (!rawNum) return '-';
    let str = String(rawNum).trim();
    str = str.replace(/^#+/, '').replace(/#+$/, '');
    str = str.replace(/^INV-PAY-#/i, 'PAY-');
    str = str.replace(/^INV-PAY-/i, 'PAY-');
    str = str.replace(/^PAY-#/i, 'PAY-');
    str = str.replace(/^INV-#/i, 'INV-');
    return str ? `#${str}` : '-';
  };

  // Refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsPartnerDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen to ledger update events
  useEffect(() => {
    const handleUpdate = () => {
      setRefreshKey(prev => prev + 1);
    };
    window.addEventListener('alpha-partner-ledger-updated', handleUpdate);
    window.addEventListener('partnerLedgerUpdated', handleUpdate);
    window.addEventListener('alpha-data-changed', handleUpdate);
    window.addEventListener('alpha-items-updated', handleUpdate);

    // External navigation with partner selection
    const handleSelectPartner = (e: Event) => {
      const ce = e as CustomEvent<{ partnerId?: string; type?: 'CUSTOMER' | 'VENDOR' }>;
      if (ce.detail?.partnerId) {
        setSelectedPartnerId(ce.detail.partnerId);
      }
    };
    window.addEventListener('alpha-open-partner-statement', handleSelectPartner);

    return () => {
      window.removeEventListener('alpha-partner-ledger-updated', handleUpdate);
      window.removeEventListener('partnerLedgerUpdated', handleUpdate);
      window.removeEventListener('alpha-data-changed', handleUpdate);
      window.removeEventListener('alpha-items-updated', handleUpdate);
      window.removeEventListener('alpha-open-partner-statement', handleSelectPartner);
    };
  }, []);

  // Save selected partner to session storage
  useEffect(() => {
    if (selectedPartnerId) {
      try {
        sessionStorage.setItem('selected_statement_partner_id', selectedPartnerId);
      } catch {
        // ignore
      }
    }
  }, [selectedPartnerId]);

  // Load all customers and vendors
  const allPartners = useMemo(() => {
    const customers = loadCustomers();
    const vendors = loadVendors();
    return [...customers, ...vendors];
  }, [refreshKey]);

  // Catalog items map for resolving product names from ids/codes
  const productsMap = useMemo(() => {
    const items = loadStoredItems();
    const map: Record<string, Item> = {};
    items.forEach(it => {
      if (it.id) map[it.id] = it;
      if (it.code) map[it.code] = it;
    });
    return map;
  }, [refreshKey]);

  // Filtered partners list for dropdown selector
  const availablePartners = useMemo(() => {
    if (!partnerSearchTerm.trim()) return allPartners;
    const q = partnerSearchTerm.toLowerCase().trim();
    return allPartners.filter(p => {
      const matchName = p.name.toLowerCase().includes(q);
      const matchCode = (p.code || '').toLowerCase().includes(q);
      const matchPhone = (p.phone || '').toLowerCase().includes(q);
      const matchTax = (p.taxNumber || '').toLowerCase().includes(q);
      return matchName || matchCode || matchPhone || matchTax;
    });
  }, [allPartners, partnerSearchTerm]);

  // Ensure an active partner is always selected
  useEffect(() => {
    if (!selectedPartnerId && availablePartners.length > 0) {
      const first = availablePartners[0];
      if (first) {
        setSelectedPartnerId(first.id);
      }
    }
  }, [selectedPartnerId, availablePartners]);

  // Currently selected partner
  const selectedPartner = useMemo(() => {
    return allPartners.find(p => p.id === selectedPartnerId) || allPartners[0] || null;
  }, [allPartners, selectedPartnerId]);

  // Raw full statement from ledger engine
  const fullStatement: PartnerStatement | null = useMemo(() => {
    if (!selectedPartner) return null;
    return getPartnerAccountStatement(selectedPartner);
  }, [selectedPartner, refreshKey]);

  // Handler for "عرض البيانات" button linked to customer search
  const handleFetchPartnerData = (partnerIdToApply?: string) => {
    let targetId = partnerIdToApply || selectedPartnerId;
    if (isPartnerDropdownOpen && partnerSearchTerm.trim() && availablePartners.length > 0) {
      targetId = availablePartners[0].id;
    }
    if (targetId) {
      setSelectedPartnerId(targetId);
      try {
        sessionStorage.setItem('selected_statement_partner_id', targetId);
      } catch {}
    }
    setIsDataLoaded(true);
    setIsPartnerDropdownOpen(false);
    setPartnerSearchTerm('');
    setRefreshKey(prev => prev + 1);
  };

  // Quick Date Range Presets
  const applyDatePreset = (preset: 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'ALL') => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const today = `${y}-${m}-${d}`;

    switch (preset) {
      case 'TODAY':
        setDateFrom(today);
        setDateTo(today);
        break;
      case 'WEEK': {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        const wy = weekAgo.getFullYear();
        const wm = String(weekAgo.getMonth() + 1).padStart(2, '0');
        const wd = String(weekAgo.getDate()).padStart(2, '0');
        setDateFrom(`${wy}-${wm}-${wd}`);
        setDateTo(today);
        break;
      }
      case 'MONTH': {
        setDateFrom(`${y}-${m}-01`);
        setDateTo(today);
        break;
      }
      case 'QUARTER': {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const quarterStartMonth = String(currentQuarter * 3 + 1).padStart(2, '0');
        setDateFrom(`${y}-${quarterStartMonth}-01`);
        setDateTo(today);
        break;
      }
      case 'YEAR':
        setDateFrom(`${y}-01-01`);
        setDateTo(today);
        break;
      case 'ALL':
        setDateFrom('');
        setDateTo('');
        break;
    }
  };

  /**
   * Helper to format payment method into readable Arabic text
   */
  const getPaymentMethodLabel = (method?: string): string => {
    switch (method) {
      case 'CASH': return 'نقدي';
      case 'BANK_TRANSFER': return 'تحويل بنكي';
      case 'CHECK': return 'شيك مصرفي';
      case 'SPAN': return 'شبكة / نقاط بيع';
      case 'OTHER': return 'طريقة أخرى';
      default: return 'نقدي';
    }
  };

  /**
   * Compute prior balance, filter period transactions, and build Document Blocks
   */
  const statementCalculation = useMemo(() => {
    if (!fullStatement || !selectedPartner) {
      return {
        priorBalance: 0,
        priorBalanceType: 'ZERO' as 'DEBIT' | 'CREDIT' | 'ZERO',
        periodTransactions: [] as PartnerLedgerTx[],
        documentBlocks: [] as StatementDocBlock[],
        totalDebitPeriod: 0,
        totalCreditPeriod: 0,
        totalQuantityPeriod: 0,
        netPeriodChange: 0,
        finalBalance: 0,
        finalBalanceType: 'ZERO' as 'DEBIT' | 'CREDIT' | 'ZERO',
        invoicesCount: 0,
        receiptsCount: 0,
        paymentsCount: 0,
        journalsCount: 0
      };
    }

    const isCustomer = selectedPartner.type === 'CUSTOMER';
    const allTx = fullStatement.transactions || [];

    // 1. Calculate prior balance for transactions strictly before dateFrom
    let priorBal = 0;
    if (dateFrom) {
      allTx.forEach(tx => {
        if (tx.date < dateFrom) {
          const isPosted = tx.status === 'POSTED' || !tx.status;
          if (isPosted) {
            priorBal += isCustomer ? (tx.debit - tx.credit) : (tx.credit - tx.debit);
          }
        }
      });
    }

    const priorBalanceType: 'DEBIT' | 'CREDIT' | 'ZERO' = 
      priorBal > 0.001 
        ? (isCustomer ? 'DEBIT' : 'CREDIT')
        : priorBal < -0.001 
        ? (isCustomer ? 'CREDIT' : 'DEBIT')
        : 'ZERO';

    // 2. Filter transactions for the requested date and criteria
    const filteredPeriodTx = allTx.filter(tx => {
      // Date filtering
      if (dateFrom && tx.date < dateFrom) return false;
      if (dateTo && tx.date > dateTo) return false;

      // Status filtering
      if (statusFilter === 'POSTED' && tx.status === 'DRAFT') return false;
      if (statusFilter === 'DRAFT' && tx.status === 'POSTED') return false;

      // Transaction type filtering
      if (txTypeFilter === 'INVOICES') {
        if (tx.type !== 'SALES_INVOICE' && tx.type !== 'PURCHASE_INVOICE') return false;
      } else if (txTypeFilter === 'RECEIPTS') {
        if (tx.type !== 'RECEIPT_VOUCHER') return false;
      } else if (txTypeFilter === 'PAYMENTS') {
        if (tx.type !== 'PAYMENT_VOUCHER') return false;
      } else if (txTypeFilter === 'JOURNALS') {
        if (tx.type !== 'JOURNAL_ENTRY') return false;
      }

      // Text search inside description, doc number, docTypeLabel, reference, notes, and items
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const cleanQ = q.replace(/^#+/, '').trim();
        const cleanDocNum = (tx.docNumber || '').toLowerCase().replace(/^#+/, '').trim();
        const matchDesc = (tx.description || '').toLowerCase().includes(q);
        const matchNum = cleanDocNum.includes(cleanQ) || (tx.docNumber || '').toLowerCase().includes(q);
        const matchLabel = (tx.docTypeLabel || '').toLowerCase().includes(q);
        const matchRef = (tx.rawDoc?.referenceNo || '').toLowerCase().includes(q);
        const matchNotes = (tx.rawDoc?.notes || '').toLowerCase().includes(q);
        const matchBank = (tx.rawDoc?.bankName || '').toLowerCase().includes(q);
        
        // Also search inside invoice line items
        let matchItems = false;
        const rawItems = Array.isArray(tx.rawDoc?.items) && tx.rawDoc.items.length > 0
          ? tx.rawDoc.items
          : Array.isArray(tx.rawDoc?.lines) && tx.rawDoc.lines.length > 0
          ? tx.rawDoc.lines
          : [];

        if (rawItems.length > 0) {
          matchItems = rawItems.some((it: any) => {
            const catalogItem = (it.itemId && productsMap[it.itemId]) || (it.itemCode && productsMap[it.itemCode]);
            const pName = (it.productName || it.name || it.description || catalogItem?.name || '').toLowerCase();
            const pCode = (it.itemCode || it.itemId || catalogItem?.code || '').toLowerCase();
            return pName.includes(q) || pCode.includes(q);
          });
        }

        if (!matchDesc && !matchNum && !matchLabel && !matchRef && !matchNotes && !matchBank && !matchItems) return false;
      }

      return true;
    });

    // 3. Step-by-step running balance & block structuring
    let running = priorBal;
    let totalDebitPeriod = 0;
    let totalCreditPeriod = 0;
    let totalQuantityPeriod = 0;
    let invoicesCount = 0;
    let receiptsCount = 0;
    let paymentsCount = 0;
    let journalsCount = 0;

    const periodTransactions: PartnerLedgerTx[] = [];
    const documentBlocks: StatementDocBlock[] = [];

    filteredPeriodTx.forEach((tx, docIdx) => {
      const isPosted = tx.status === 'POSTED' || !tx.status;
      if (isPosted) {
        running += isCustomer ? (tx.debit - tx.credit) : (tx.credit - tx.debit);
        totalDebitPeriod += tx.debit;
        totalCreditPeriod += tx.credit;
      }

      if (tx.type === 'SALES_INVOICE' || tx.type === 'PURCHASE_INVOICE') invoicesCount++;
      if (tx.type === 'RECEIPT_VOUCHER') receiptsCount++;
      if (tx.type === 'PAYMENT_VOUCHER') paymentsCount++;
      if (tx.type === 'JOURNAL_ENTRY') journalsCount++;

      const currentRunningType: 'DEBIT' | 'CREDIT' | 'ZERO' = 
        running > 0.001 
          ? (isCustomer ? 'DEBIT' : 'CREDIT') 
          : running < -0.001 
          ? (isCustomer ? 'CREDIT' : 'DEBIT') 
          : 'ZERO';

      const enrichedTx: PartnerLedgerTx = {
        ...tx,
        runningBalance: Math.abs(running),
        runningBalanceType: currentRunningType
      };
      periodTransactions.push(enrichedTx);

      // Construct Detail Lines for this Document Block
      const rawDoc = tx.rawDoc || {};
      const lines: BlockDetailLine[] = [];
      let blockTotalQuantity = 0;
      let blockDocTotal = 0;
      let blockSubtotal = 0;
      let blockTaxAmount = 0;
      let blockDiscountAmount = 0;
      let isMultiLine = false;

      const cleanDocNumber = formatCleanDocNumber(tx.docNumber);
      const docLabel = tx.docTypeLabel.replace(/\(.*\)/, '').trim() || 'مستند';

      if (tx.type === 'SALES_INVOICE' || tx.type === 'PURCHASE_INVOICE') {
        const rawItems = Array.isArray(rawDoc.items) && rawDoc.items.length > 0
          ? rawDoc.items
          : Array.isArray(rawDoc.lines) && rawDoc.lines.length > 0
          ? rawDoc.lines
          : [];
        isMultiLine = rawItems.length > 0;

        blockTaxAmount = Number(rawDoc.totals?.taxTotal ?? rawDoc.tax_amount ?? rawDoc.taxTotal ?? 0);
        blockDiscountAmount = Number(rawDoc.totals?.discountTotal ?? rawDoc.discount_amount ?? rawDoc.discount ?? 0);
        blockSubtotal = Number(rawDoc.totals?.subtotal ?? rawDoc.subtotal ?? 0);

        if (rawItems.length > 0) {
          rawItems.forEach((item: any, itemIdx: number) => {
            const catalogItem = (item.itemId && productsMap[item.itemId]) || (item.itemCode && productsMap[item.itemCode]);
            const itemName = item.productName || item.name || item.description || catalogItem?.name || `صنف #${itemIdx + 1}`;
            const qty = Number(item.quantity ?? item.qty ?? 1);
            const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
            const lineTotal = Number(item.total ?? (qty * unitPrice));
            const itemTax = Number(item.taxAmount ?? item.tax ?? 0);
            const itemDiscount = Number(item.discount ?? item.discountAmount ?? 0);

            blockTotalQuantity += qty;
            blockDocTotal += lineTotal;

            lines.push({
              id: `${tx.id || docIdx}-line-${itemIdx}`,
              typeLabel: docLabel,
              docNumber: cleanDocNumber,
              date: tx.date,
              description: itemName,
              quantity: qty,
              unitPrice: unitPrice,
              taxAmount: itemTax > 0 ? itemTax : null,
              taxRate: itemTax > 0 ? 15 : null,
              discount: itemDiscount > 0 ? itemDiscount : null,
              total: lineTotal,
              debit: null,
              credit: null
            });
          });
        } else {
          // Fallback if no line items
          const invTotal = tx.debit > 0 ? tx.debit : tx.credit;
          blockTotalQuantity = 1;
          blockDocTotal = invTotal;

          lines.push({
            id: `${tx.id || docIdx}-line-0`,
            typeLabel: docLabel,
            docNumber: cleanDocNumber,
            date: tx.date,
            description: rawDoc.notes || tx.description || 'فاتورة مسجلة بدون تفاصيل أصناف',
            quantity: 1,
            unitPrice: invTotal,
            taxAmount: blockTaxAmount > 0 ? blockTaxAmount : null,
            taxRate: blockTaxAmount > 0 ? 15 : null,
            discount: blockDiscountAmount > 0 ? blockDiscountAmount : null,
            total: invTotal,
            debit: null,
            credit: null
          });
        }

        // If blockDocTotal is 0 (or totals grandTotal available), use invoice totals
        if (rawDoc.totals?.grandTotal) {
          blockDocTotal = Number(rawDoc.totals.grandTotal);
        } else if (blockDocTotal === 0) {
          blockDocTotal = tx.debit > 0 ? tx.debit : tx.credit;
        }

        if (blockSubtotal === 0) {
          blockSubtotal = blockDocTotal - blockTaxAmount + blockDiscountAmount;
        }

        totalQuantityPeriod += blockTotalQuantity;
      } else if (tx.type === 'RECEIPT_VOUCHER') {
        isMultiLine = false;
        const methodLabel = getPaymentMethodLabel(rawDoc.paymentMethod);
        const refInfo = rawDoc.referenceNo ? ` - مرجع: ${rawDoc.referenceNo}` : '';
        const bankInfo = rawDoc.bankName ? ` - ${rawDoc.bankName}` : '';
        const voucherDesc = rawDoc.description ? ` - ${rawDoc.description}` : '';
        const fullDesc = `سند قبض [تحصيل ${methodLabel}]${bankInfo}${refInfo}${voucherDesc}`;

        const voucherAmount = Number(rawDoc.amount) || tx.credit || tx.debit || 0;
        blockDocTotal = voucherAmount;
        blockSubtotal = voucherAmount;

        lines.push({
          id: `${tx.id || docIdx}-line-0`,
          typeLabel: 'سند قبض',
          docNumber: cleanDocNumber,
          date: tx.date,
          description: fullDesc,
          quantity: null,
          unitPrice: null,
          taxAmount: null,
          taxRate: null,
          discount: null,
          total: voucherAmount,
          debit: tx.debit,
          credit: tx.credit
        });
      } else if (tx.type === 'PAYMENT_VOUCHER') {
        isMultiLine = false;
        const methodLabel = getPaymentMethodLabel(rawDoc.paymentMethod);
        const refInfo = rawDoc.referenceNo ? ` - مرجع: ${rawDoc.referenceNo}` : '';
        const bankInfo = rawDoc.bankName ? ` - ${rawDoc.bankName}` : '';
        const voucherDesc = rawDoc.description ? ` - ${rawDoc.description}` : '';
        const fullDesc = `سند صرف [سداد ${methodLabel}]${bankInfo}${refInfo}${voucherDesc}`;

        const voucherAmount = Number(rawDoc.amount) || tx.debit || tx.credit || 0;
        blockDocTotal = voucherAmount;
        blockSubtotal = voucherAmount;

        lines.push({
          id: `${tx.id || docIdx}-line-0`,
          typeLabel: 'سند صرف',
          docNumber: cleanDocNumber,
          date: tx.date,
          description: fullDesc,
          quantity: null,
          unitPrice: null,
          taxAmount: null,
          taxRate: null,
          discount: null,
          total: voucherAmount,
          debit: tx.debit,
          credit: tx.credit
        });
      } else if (tx.type === 'JOURNAL_ENTRY') {
        isMultiLine = false;
        const entryDesc = tx.description || 'تسوية وقيد محاسبي';
        const entryAmount = tx.debit > 0 ? tx.debit : tx.credit;
        blockDocTotal = entryAmount;
        blockSubtotal = entryAmount;

        lines.push({
          id: `${tx.id || docIdx}-line-0`,
          typeLabel: 'قيد يومية',
          docNumber: cleanDocNumber,
          date: tx.date,
          description: entryDesc,
          quantity: null,
          unitPrice: null,
          taxAmount: null,
          taxRate: null,
          discount: null,
          total: entryAmount,
          debit: tx.debit,
          credit: tx.credit
        });
      } else {
        // Opening balance or other
        isMultiLine = false;
        const amount = tx.debit > 0 ? tx.debit : tx.credit;
        blockDocTotal = amount;
        blockSubtotal = amount;

        lines.push({
          id: `${tx.id || docIdx}-line-0`,
          typeLabel: docLabel,
          docNumber: cleanDocNumber,
          date: tx.date,
          description: tx.description || 'حركة افتتاحية',
          quantity: null,
          unitPrice: null,
          taxAmount: null,
          taxRate: null,
          discount: null,
          total: amount,
          debit: tx.debit,
          credit: tx.credit
        });
      }

      documentBlocks.push({
        id: tx.id || `doc-block-${docIdx}`,
        docType: tx.type,
        docTypeLabel: docLabel,
        docNumber: cleanDocNumber,
        date: tx.date,
        status: (tx.status as 'POSTED' | 'DRAFT') || 'POSTED',
        isMultiLine,
        lines,
        totalQuantity: blockTotalQuantity,
        subtotal: blockSubtotal,
        taxAmount: blockTaxAmount,
        discountAmount: blockDiscountAmount,
        docTotal: blockDocTotal,
        totalDebit: tx.debit,
        totalCredit: tx.credit,
        runningBalance: Math.abs(running),
        runningBalanceType: currentRunningType,
        rawDoc
      });
    });

    const netPeriodChange = totalDebitPeriod - totalCreditPeriod;
    const finalBalance = Math.abs(running);
    const finalBalanceType: 'DEBIT' | 'CREDIT' | 'ZERO' = 
      running > 0.001 
        ? (isCustomer ? 'DEBIT' : 'CREDIT') 
        : running < -0.001 
        ? (isCustomer ? 'CREDIT' : 'DEBIT') 
        : 'ZERO';

    return {
      priorBalance: Math.abs(priorBal),
      priorBalanceType,
      periodTransactions,
      documentBlocks,
      totalDebitPeriod,
      totalCreditPeriod,
      totalQuantityPeriod,
      netPeriodChange,
      finalBalance,
      finalBalanceType,
      invoicesCount,
      receiptsCount,
      paymentsCount,
      journalsCount
    };
  }, [fullStatement, selectedPartner, dateFrom, dateTo, statusFilter, txTypeFilter, searchQuery, productsMap]);

  // A4 Smart Pagination Engine: Partitions document blocks into physical discrete pages
  const paginatedChunks = useMemo<StatementPageChunk[]>(() => {
    const blocks = statementCalculation.documentBlocks || [];
    const isLandscape = printOrientation === 'LANDSCAPE';
    // Calibrated capacities for professional A4 pagination:
    // Page 1 has full company header + partner box + 4 KPI cards (~340px)
    const firstPageCapacity = isLandscape ? 10 : 14;
    // Continuing pages have compact running header (~90px)
    const otherPageCapacity = isLandscape ? 16 : 22;

    if (blocks.length === 0) {
      return [{
        pageNumber: 1,
        totalPages: 1,
        blocks: [],
        isFirstPage: true,
        isLastPage: true,
        openingCarriedBalance: statementCalculation.priorBalance,
        openingCarriedBalanceType: statementCalculation.priorBalanceType,
        closingCarriedBalance: statementCalculation.finalBalance,
        closingCarriedBalanceType: statementCalculation.finalBalanceType
      }];
    }

    const getBlockWeight = (b: StatementDocBlock) => {
      if (includeItemsInPrint && b.isMultiLine && b.lines && b.lines.length > 1) {
        return 1 + b.lines.length + 1; // Master row + items + closing total
      }
      return 1;
    };

    const pagesBlocks: StatementDocBlock[][] = [];
    let currentBatch: StatementDocBlock[] = [];
    let currentWeight = 0;
    let limit = firstPageCapacity;

    blocks.forEach((block) => {
      const w = getBlockWeight(block);
      if (currentBatch.length > 0 && currentWeight + w > limit) {
        pagesBlocks.push(currentBatch);
        currentBatch = [block];
        currentWeight = w;
        limit = otherPageCapacity;
      } else {
        currentBatch.push(block);
        currentWeight += w;
      }
    });

    if (currentBatch.length > 0) {
      pagesBlocks.push(currentBatch);
    }

    const totalPages = pagesBlocks.length;
    let runningBal = statementCalculation.priorBalance;
    let runningBalType = statementCalculation.priorBalanceType;

    return pagesBlocks.map((pBlocks, pIdx) => {
      const isFirst = pIdx === 0;
      const isLast = pIdx === totalPages - 1;
      const openingBal = isFirst ? statementCalculation.priorBalance : runningBal;
      const openingBalType = isFirst ? statementCalculation.priorBalanceType : runningBalType;

      const lastBlock = pBlocks[pBlocks.length - 1];
      if (lastBlock) {
        runningBal = lastBlock.runningBalance;
        runningBalType = lastBlock.runningBalanceType;
      }

      return {
        pageNumber: pIdx + 1,
        totalPages,
        blocks: pBlocks,
        isFirstPage: isFirst,
        isLastPage: isLast,
        openingCarriedBalance: openingBal,
        openingCarriedBalanceType: openingBalType,
        closingCarriedBalance: runningBal,
        closingCarriedBalanceType: runningBalType
      };
    });
  }, [statementCalculation, includeItemsInPrint, printOrientation]);

  // Sync estimatedPages with paginated chunks
  useEffect(() => {
    setEstimatedPages(paginatedChunks.length);
  }, [paginatedChunks.length]);

  // Direct Print Handler: Uses isolated iframe print with complete official header & stamp
  const handleDirectPrint = (orientationOverride?: 'PORTRAIT' | 'LANDSCAPE', targetPageOnly?: boolean) => {
    if (!selectedPartner) {
      alert('يرجى اختيار العميل أو المورد أولاً.');
      return;
    }
    const targetOrientation = orientationOverride || printOrientation;
    try {
      // If user specifically requested current page, use modalSheetRef; otherwise use allPagesPrintRef to ensure all pages print
      const target = (targetPageOnly && modalSheetRef.current)
        ? modalSheetRef.current
        : (allPagesPrintRef.current || modalSheetRef.current || statementSheetRef.current);
      const orientationParam = targetOrientation === 'LANDSCAPE' ? 'landscape' : 'portrait';
      if (target) {
        printElementDirectly(target, 'A4', undefined, statementColorMode === 'BW' ? 'bw' : 'color', orientationParam);
      } else {
        window.print();
      }
    } catch (err) {
      console.error('Print error:', err);
      window.print();
    }
  };

  // Export to PDF: Uses exportElementToPdf directly on the rendered official statement sheet
  const handleExportPDF = async (targetPageOnly?: boolean | React.MouseEvent) => {
    if (!selectedPartner) {
      alert('يرجى اختيار العميل أو المورد أولاً.');
      return;
    }

    const isSinglePage = typeof targetPageOnly === 'boolean' && targetPageOnly === true;

    let target: HTMLElement | null = null;
    if (isSinglePage && modalSheetRef.current) {
      target = modalSheetRef.current.querySelector<HTMLElement>('[data-statement-sheet="true"]') || (modalSheetRef.current.firstElementChild as HTMLElement) || modalSheetRef.current;
    } else {
      // Export ALL pages: use allPagesPrintRef.current directly (which contains all paginated page chunks)
      target = allPagesPrintRef.current
        || (showPrintModal && modalSheetRef.current ? modalSheetRef.current : null)
        || statementSheetRef.current;
    }
    if (!target) {
      target = document.querySelector<HTMLElement>('[data-statement-sheet="true"]');
    }
    if (!target) {
      alert('تعذر تحديد نموذج كشف الحساب للتصدير.');
      return;
    }

    try {
      setIsExportingPDF(true);
      const isCust = selectedPartner.type === 'CUSTOMER';
      const cleanPartnerName = (selectedPartner.name || (isCust ? 'عميل' : 'مورد')).replace(/\s+/g, '_');
      const filename = `كشف_حساب_تفصيلي_${isCust ? 'عميل' : 'مورد'}_${cleanPartnerName}_${dateFrom || 'البداية'}_إلى_${dateTo || 'اليوم'}.pdf`;

      await exportElementToPdf(target, {
        filename,
        format: 'A4',
        scale: 2.8,
        colorMode: statementColorMode === 'BW' ? 'bw' : 'color',
        orientation: printOrientation === 'LANDSCAPE' ? 'landscape' : 'portrait'
      });
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('حدث خطأ أثناء تصدير ملف PDF، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Export to Excel handler
  const handleExportExcel = () => {
    if (!selectedPartner) return;
    const isCust = selectedPartner.type === 'CUSTOMER';
    const filename = `كشف_حساب_تفصيلي_${isCust ? 'عميل' : 'مورد'}_${selectedPartner.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;

    const isDetailed = statementDetailLevel === 'DETAILED';
    const headers = isDetailed ? [
      'النوع',
      'رقم المستند',
      'التاريخ',
      'البيان والشرح المحاسبي',
      'كمية',
      'سعر الوحدة',
      'الضريبة / الخصم',
      'الإجمالي',
      'مدين (+)',
      'دائن (-)',
      'الرصيد التراكمي'
    ] : [
      'النوع',
      'رقم المستند',
      'التاريخ',
      'البيان والشرح المحاسبي',
      'كمية',
      'سعر الوحدة',
      'الإجمالي',
      'مدين (+)',
      'دائن (-)',
      'الرصيد التراكمي'
    ];

    const rows: (string | number)[][] = [];

    // Prior balance row
    if (dateFrom && statementCalculation.priorBalance > 0) {
      if (isDetailed) {
        rows.push([
          'رصيد سابق',
          '-',
          dateFrom,
          `رصيد ما قبل تاريخ ${dateFrom}`,
          '-',
          '-',
          '-',
          statementCalculation.priorBalance,
          statementCalculation.priorBalanceType === 'DEBIT' ? statementCalculation.priorBalance : 0,
          statementCalculation.priorBalanceType === 'CREDIT' ? statementCalculation.priorBalance : 0,
          statementCalculation.priorBalance
        ]);
      } else {
        rows.push([
          'رصيد سابق',
          '-',
          dateFrom,
          `رصيد ما قبل تاريخ ${dateFrom}`,
          '-',
          '-',
          statementCalculation.priorBalance,
          statementCalculation.priorBalanceType === 'DEBIT' ? statementCalculation.priorBalance : 0,
          statementCalculation.priorBalanceType === 'CREDIT' ? statementCalculation.priorBalance : 0,
          statementCalculation.priorBalance
        ]);
      }
    }

    (statementCalculation.documentBlocks || []).forEach(block => {
      const isMulti = Boolean(block.isMultiLine && block.lines && block.lines.length > 1);
      const shouldIncludeItems = isMulti && includeItemsInPrint;

      if (!shouldIncludeItems) {
        const line = block.lines[0] || {
          description: block.docTypeLabel,
          quantity: null,
          unitPrice: null,
          total: block.docTotal
        };
        const desc = isMulti ? `إجمالي ${block.docTypeLabel} (${block.lines.length} أصناف)` : line.description;
        if (isDetailed) {
          rows.push([
            block.docTypeLabel,
            block.docNumber,
            block.date,
            desc,
            line.quantity !== null && line.quantity !== undefined ? line.quantity : (isMulti && block.totalQuantity > 0 ? block.totalQuantity : '-'),
            line.unitPrice !== null && line.unitPrice !== undefined ? line.unitPrice : '-',
            block.taxAmount > 0 ? block.taxAmount : '-',
            block.docTotal,
            block.totalDebit > 0 ? block.totalDebit : 0,
            block.totalCredit > 0 ? block.totalCredit : 0,
            block.runningBalance
          ]);
        } else {
          rows.push([
            block.docTypeLabel,
            block.docNumber,
            block.date,
            desc,
            line.quantity !== null && line.quantity !== undefined ? line.quantity : (isMulti && block.totalQuantity > 0 ? block.totalQuantity : '-'),
            line.unitPrice !== null && line.unitPrice !== undefined ? line.unitPrice : '-',
            block.docTotal,
            block.totalDebit > 0 ? block.totalDebit : 0,
            block.totalCredit > 0 ? block.totalCredit : 0,
            block.runningBalance
          ]);
        }
      } else {
        // Multi-line invoice with items included
        if (isDetailed) {
          // 1. Detail items first (11 columns)
          block.lines.forEach((line, lIdx) => {
            rows.push([
              `بند #${lIdx + 1}`,
              block.docNumber,
              line.date,
              `  ↳ ${line.description}`,
              line.quantity !== null && line.quantity !== undefined ? line.quantity : '-',
              line.unitPrice !== null && line.unitPrice !== undefined ? line.unitPrice : '-',
              line.taxAmount ? line.taxAmount : '-',
              line.total,
              '-',
              '-',
              '-'
            ]);
          });

          // 2. Invoice Subtotal / Total row underneath the items (11 columns)
          rows.push([
            `إجمالي ${block.docTypeLabel}`,
            block.docNumber,
            block.date,
            `مجموع ${block.docTypeLabel} (${block.lines.length} أصناف)`,
            block.totalQuantity > 0 ? block.totalQuantity : '-',
            '-',
            block.taxAmount > 0 ? block.taxAmount : '-',
            block.docTotal,
            block.totalDebit > 0 ? block.totalDebit : 0,
            block.totalCredit > 0 ? block.totalCredit : 0,
            block.runningBalance
          ]);
        } else {
          // 1. Detail items first (9 columns)
          block.lines.forEach((line, lIdx) => {
            rows.push([
              `بند #${lIdx + 1}`,
              block.docNumber,
              line.date,
              `  ↳ ${line.description}`,
              line.quantity !== null && line.quantity !== undefined ? line.quantity : '-',
              line.unitPrice !== null && line.unitPrice !== undefined ? line.unitPrice : '-',
              line.total,
              '-',
              '-',
              '-'
            ]);
          });

          // 2. Invoice Subtotal / Total row underneath the items (9 columns)
          rows.push([
            `إجمالي ${block.docTypeLabel}`,
            block.docNumber,
            block.date,
            `مجموع ${block.docTypeLabel} (${block.lines.length} أصناف)`,
            block.totalQuantity > 0 ? block.totalQuantity : '-',
            '-',
            block.docTotal,
            block.totalDebit > 0 ? block.totalDebit : 0,
            block.totalCredit > 0 ? block.totalCredit : 0,
            block.runningBalance
          ]);
        }
      }
    });

    const summaryRows = isDetailed ? [
      [
        'الإجمالي العام لكشف الحساب',
        '',
        '',
        `إجمالي حركات الفترة (${statementCalculation.documentBlocks.length} مستند)`,
        statementCalculation.totalQuantityPeriod > 0 ? statementCalculation.totalQuantityPeriod : '-',
        '',
        '',
        '',
        statementCalculation.totalDebitPeriod,
        statementCalculation.totalCreditPeriod,
        statementCalculation.finalBalance
      ]
    ] : [
      [
        'الإجمالي العام لكشف الحساب',
        '',
        '',
        `إجمالي حركات الفترة (${statementCalculation.documentBlocks.length} مستند)`,
        statementCalculation.totalQuantityPeriod > 0 ? statementCalculation.totalQuantityPeriod : '-',
        '',
        '',
        statementCalculation.totalDebitPeriod,
        statementCalculation.totalCreditPeriod,
        statementCalculation.finalBalance
      ]
    ];

    try {
      setIsExportingExcel(true);
      exportToXLSX({
        filename,
        sheetName: 'كشف حساب',
        title: `كشف حساب - ${isCust ? 'عميل' : 'مورد'}: ${selectedPartner.name}`,
        subtitle: `الفترة: ${dateFrom ? 'من ' + dateFrom : 'من البداية'} إلى ${dateTo || 'تاريخ اليوم'} | كود الطرف: ${selectedPartner.code || selectedPartner.id} | هاتف: ${selectedPartner.phone || '-'}`,
        filterSummary: `الفلترة: نوع الحركة: ${txTypeFilter} | الحالة: ${statusFilter}`,
        headers,
        rows,
        summaryRows
      });
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('حدث خطأ أثناء تصدير ملف Excel، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Clean tafqeet helper: strictly ensures "... فقط لا غير" without duplicate "فقط" or "لا غير"
  const cleanTafqeet = (amount: number) => {
    if (amount === 0) return `صفر ${currencyFullNameAr || 'ريال سعودي'} فقط لا غير`;
    const raw = tafqeet(Math.abs(amount)).trim();
    const cleanBody = raw
      .replace(/^فقط\s+/i, '')
      .replace(/\s+فقط\s+لا\s+غير$/i, '')
      .replace(/\s+لا\s+غير$/i, '')
      .trim();
    return `${cleanBody} فقط لا غير`;
  };

  // Generate WhatsApp formatted financial message
  const generateWhatsAppMessage = () => {
    if (!selectedPartner) return '';
    const isCust = selectedPartner.type === 'CUSTOMER';
    const partnerTypeLabel = isCust ? 'عميل' : 'مورد';
    const balanceNum = statementCalculation.finalBalance;
    const balanceText = `${Math.abs(balanceNum).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currencySymbol}`;
    const tafqeetText = cleanTafqeet(balanceNum);

    return `🏢 *${companyName || 'الشركة'}*
📄 *كشف حساب ${partnerTypeLabel} رسمي معتمد*
━━━━━━━━━━━━━━━━━━━━
👤 *الاسم:* ${selectedPartner.name}
🏷️ *كود الحساب:* ${selectedPartner.code || selectedPartner.id}
📅 *الفترة:* من ${dateFrom || 'بداية التعامل'} إلى ${dateTo || 'تاريخ اليوم'}

📊 *الملخص المالي والمحاسبي:*
• رصيد سابق (ما قبل الفترة): ${Math.abs(statementCalculation.priorBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currencySymbol}
• إجمالي المدين: ${statementCalculation.totalDebitPeriod.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currencySymbol}
• إجمالي الدائن: ${statementCalculation.totalCreditPeriod.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currencySymbol}
━━━━━━━━━━━━━━━━━━━━
💰 *صافي الرصيد المستحق:* ${balanceText} (${statementCalculation.finalBalanceType === 'DEBIT' ? 'مدين - مستحق لنا' : statementCalculation.finalBalanceType === 'CREDIT' ? 'دائن - له دفعة' : 'حساب متزن'})
✍️ *المبلغ بالحروف:* ${tafqeetText}

يرجى التكرم بمراجعة ومطابقة الرصيد.
شاكرين ومقدرين حسن تعاونكم معنا.`;
  };

  const handleOpenWhatsAppModal = () => {
    if (!selectedPartner) {
      alert(`يرجى اختيار عميل أو مورد أولاً.`);
      return;
    }
    const cleanPhone = (selectedPartner.phone || '').replace(/[^\d+]/g, '');
    setWhatsAppRecipientPhone(cleanPhone);
    setWhatsAppMessageText(generateWhatsAppMessage());
    setIsEditingWhatsAppText(false);
    setIsCopiedText(false);
    setShowWhatsAppModal(true);
  };

  const handleSendWhatsApp = () => {
    const text = whatsAppMessageText || generateWhatsAppMessage();
    let phone = whatsAppRecipientPhone.replace(/[^\d]/g, '');
    if (phone.startsWith('05') && phone.length === 10) {
      phone = '966' + phone.substring(1);
    }
    const waUrl = phone 
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleSendWhatsAppPdf = async () => {
    if (!selectedPartner) return;
    try {
      setIsGeneratingPdfForWhatsApp(true);
      const isCust = selectedPartner.type === 'CUSTOMER';
      const partnerTypeLabel = isCust ? 'عميل' : 'مورد';
      const cleanPartnerName = (selectedPartner.name || partnerTypeLabel).replace(/\s+/g, '_');
      const filename = `كشف_حساب_تفصيلي_${isCust ? 'عميل' : 'مورد'}_${cleanPartnerName}_${dateFrom || 'البداية'}_إلى_${dateTo || 'اليوم'}.pdf`;

      const target = allPagesPrintRef.current
        || (showPrintModal && modalSheetRef.current ? modalSheetRef.current : null)
        || statementSheetRef.current
        || document.querySelector<HTMLElement>('[data-statement-sheet="true"]');

      if (!target) {
        throw new Error('تعذر العثور على نموذج كشف الحساب المعتمد لتصدير PDF');
      }

      const balanceText = `${Math.abs(statementCalculation.finalBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currencySymbol}`;
      const balanceLabel = statementCalculation.finalBalanceType === 'DEBIT' ? 'مدين - مستحق لنا' : statementCalculation.finalBalanceType === 'CREDIT' ? 'دائن - له دفعة' : 'حساب متزن';
      const companionText = `مرحباً بك، مرفق لكم كشف حساب تفصيلي رسمي معتمد لـ (${selectedPartner.name}) للفترة من ${dateFrom || 'بداية التعامل'} إلى ${dateTo || 'تاريخ اليوم'} بصافي رصيد مستحق قدره ${balanceText} (${balanceLabel}).`;

      let phone = whatsAppRecipientPhone.replace(/[^\d]/g, '');
      if (phone.startsWith('05') && phone.length === 10) {
        phone = '966' + phone.substring(1);
      }

      const result = await exportElementToPdf(target, {
        filename,
        format: 'A4',
        scale: 2.8,
        colorMode: statementColorMode === 'BW' ? 'bw' : 'color',
        orientation: printOrientation === 'LANDSCAPE' ? 'landscape' : 'portrait'
      });

      // If Web Share API with files is supported (Mobile / Modern Browsers):
      if (result.blob && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
        try {
          const pdfFile = new File([result.blob], filename, { type: 'application/pdf' });
          if (navigator.canShare({ files: [pdfFile] })) {
            await navigator.share({
              title: `كشف حساب تفصيلي - ${selectedPartner.name}`,
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

      alert('تم تصدير ملف كشف الحساب التفصيلي PDF بنجاح 📄. تم فتح محادثة الواتساب لإرفاقه مباشرة.');
    } catch (err: any) {
      console.error('PDF WhatsApp share error:', err);
      alert(err.message || 'حدث خطأ أثناء تصدير ملف كشف الحساب كـ PDF.');
    } finally {
      setIsGeneratingPdfForWhatsApp(false);
    }
  };

  const handleCopyStatementSummary = async () => {
    const text = whatsAppMessageText || generateWhatsAppMessage();
    try {
      await navigator.clipboard.writeText(text);
      setIsCopiedText(true);
      setTimeout(() => setIsCopiedText(false), 2500);
    } catch {
      alert('تم نسخ النص بنجاح.');
    }
  };

  const handleResetWhatsAppMessage = () => {
    setWhatsAppMessageText(generateWhatsAppMessage());
  };

  // Render a Single Printed A4 Page of the Statement (True WYSIWYG)
  const renderDetailedStatementPage = (chunk: StatementPageChunk, isForModal: boolean = false) => {
    if (!selectedPartner) return null;

    const isBW = statementColorMode === 'BW';
    const isLandscape = printOrientation === 'LANDSCAPE';
    const isDetailed = statementDetailLevel === 'DETAILED';
    const isCust = selectedPartner.type === 'CUSTOMER';
    const activePartnerLabelAr = isCust ? 'عميل' : 'مورد';
    const activeStatementTitleAr = isDetailed
      ? (isCust ? (includeItemsInPrint ? 'كشف حساب عميل تفصيلي بالأصناف' : 'كشف حساب عميل تفصيلي (إجمالي المستندات)') : (includeItemsInPrint ? 'كشف حساب مورد تفصيلي بالأصناف' : 'كشف حساب مورد تفصيلي (إجمالي المستندات)'))
      : (isCust ? (includeItemsInPrint ? 'كشف حساب عميل مالي معتمد (بالأصناف)' : 'كشف حساب عميل مالي معتمد') : (includeItemsInPrint ? 'كشف حساب مورد مالي معتمد (بالأصناف)' : 'كشف حساب مورد مالي معتمد'));
    const activeCode = selectedPartner.code || (isCust ? `CUST-${selectedPartner.id}` : `VEND-${selectedPartner.id}`);

    const nowStr = new Date().toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const nowTimeStr = new Date().toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const finalBalanceFormatted = `${Math.abs(statementCalculation.finalBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currencySymbol}`;
    const finalBalanceLabel = statementCalculation.finalBalance > 0
      ? (isCust ? 'مدين (مستحق لنا)' : 'مدين (دفعة مسددة للمورد بالزيادة)')
      : statementCalculation.finalBalance < 0
        ? (isCust ? 'دائن (دفعة مقدمة للعميل)' : 'دائن (مستحق للمورد)')
        : 'حساب متزن (مطابق)';

    return (
      <div 
        key={`stmt-page-${chunk.pageNumber}`}
        data-statement-sheet="true"
        className={`bg-white text-slate-900 mx-auto transition-all printable-invoice-doc relative ${
          chunk.pageNumber > 1 ? 'mt-8 print:mt-0 print:break-before-page' : ''
        } ${
          isBW ? 'border-2 border-slate-700 print-bw-mode' : 'border border-slate-300'
        } ${
          isLandscape
            ? 'p-5 sm:p-7 w-full max-w-[1240px] shadow-md rounded-2xl'
            : isForModal 
              ? 'p-5 sm:p-7 w-full max-w-4xl shadow-md rounded-xl' 
              : 'p-5 sm:p-8 w-full max-w-[1020px] shadow-md rounded-2xl'
        }`}
        style={{ fontFamily: "'Cairo', 'IBM Plex Sans Arabic', Tahoma, system-ui, -apple-system, sans-serif" }}
        dir="rtl"
      >
        {/* Page Top Header */}
        {chunk.isFirstPage ? (
          /* 1. Official Header with Company Branding & Document Badge (Page 1) */
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b-2 border-slate-800 mb-5">
              <div className="flex items-center gap-3.5">
                {systemSettings?.company?.logoUrl ? (
                  <img 
                    src={systemSettings.company.logoUrl} 
                    alt="Logo" 
                    className={`w-16 h-16 object-contain rounded-lg border border-slate-200 p-1 ${isBW ? 'filter grayscale contrast-125' : ''}`} 
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-800 text-white flex items-center justify-center font-black text-xl shrink-0 shadow-xs">
                    {companyName ? companyName.charAt(0) : 'L'}
                  </div>
                )}
                <div>
                  <h1 className="text-lg sm:text-xl font-black text-slate-950 leading-tight">
                    {companyName}
                  </h1>
                  {systemSettings?.company?.nameEn && (
                    <p className="text-xs text-slate-500 font-medium tracking-wide">
                      {systemSettings.company.nameEn}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-slate-600 mt-1 font-semibold flex-wrap">
                    {systemSettings?.company?.taxNumber && (
                      <span>الرقم الضريبي: <b className="font-mono text-slate-900">{systemSettings.company.taxNumber}</b></span>
                    )}
                    {systemSettings?.company?.commercialRegister && (
                      <span>س.ت: <b className="font-mono text-slate-900">{systemSettings.company.commercialRegister}</b></span>
                    )}
                    {systemSettings?.company?.phone && (
                      <span dir="ltr">{systemSettings.company.phone}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right sm:text-left self-stretch sm:self-auto shrink-0 flex flex-col items-start sm:items-end">
                <div className={`inline-block text-xs sm:text-sm font-black px-4 py-1.5 rounded-lg shadow-2xs ${
                  isBW ? 'bg-slate-100 text-slate-900 border border-slate-400' : 'bg-slate-800 text-white'
                }`}>
                  {activeStatementTitleAr}
                </div>
                <div className="text-[10px] text-slate-500 mt-1.5 font-medium space-y-0.5">
                  <div>تاريخ الإصدار: <span className="font-bold text-slate-700">{nowStr}</span></div>
                  <div>وقت الإصدار: <span className="font-mono font-bold text-slate-700">{nowTimeStr}</span></div>
                  <div className="flex items-center gap-1 justify-end text-slate-700">
                    <span className="text-slate-500">صفحة:</span>
                    <span className={`font-bold font-mono px-1.5 py-0.2 rounded text-[10px] ${
                      isBW 
                        ? 'text-slate-800 bg-slate-100 border border-slate-300' 
                        : 'text-blue-900 bg-blue-50 border border-blue-200'
                    }`}>
                      {chunk.pageNumber} من {chunk.totalPages}
                    </span>
                  </div>
                  <div className={`${isBW ? 'text-slate-800' : 'text-emerald-700'} font-bold flex items-center gap-1 justify-end pt-0.5`}>
                    <CheckCircle size={10} />
                    <span>معتمد رسمياً من النظام المحاسبي</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Partner & Period Information Box */}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl p-3.5 mb-5 text-xs ${
              isBW ? 'bg-slate-50/80 border border-slate-300' : 'bg-slate-50 border border-slate-200'
            }`}>
              <div className="space-y-1.5 border-b md:border-b-0 md:border-l md:border-slate-200 pb-3 md:pb-0 md:pl-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-bold">اسم {activePartnerLabelAr}:</span>
                  <span className="font-black text-slate-900 text-sm">{selectedPartner.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-bold">كود الحساب:</span>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                    isBW 
                      ? 'bg-slate-200 text-slate-900 border border-slate-300' 
                      : 'text-blue-800 bg-blue-100/70'
                  }`}>
                    {activeCode}
                  </span>
                </div>
                {selectedPartner.phone && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-bold">رقم الهاتف:</span>
                    <span className="font-mono font-bold text-slate-800" dir="ltr">{selectedPartner.phone}</span>
                  </div>
                )}
                {selectedPartner.address && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-bold">العنوان:</span>
                    <span className="text-slate-700">{selectedPartner.address}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-bold">نطاق فترة الكشف:</span>
                  <span className="font-mono font-bold text-slate-800">
                    من {dateFrom || 'بداية التعامل'} إلى {dateTo || 'تاريخ اليوم'}
                  </span>
                </div>
                {selectedPartner.taxNumber ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-bold">الرقم الضريبي لل{activePartnerLabelAr}:</span>
                    <span className="font-mono font-bold text-slate-800">{selectedPartner.taxNumber}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <span>الرقم الضريبي: غير مسجل</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-slate-500 font-bold">الرصيد الختامي المستحق:</span>
                  <span className={`font-mono font-black text-sm px-2.5 py-0.5 rounded ${
                    isBW
                      ? 'bg-slate-100 text-slate-950 border border-slate-400'
                      : statementCalculation.finalBalance !== 0
                        ? isCust
                          ? statementCalculation.finalBalance > 0 ? 'bg-rose-100 text-rose-900' : 'bg-emerald-100 text-emerald-900'
                          : statementCalculation.finalBalance < 0 ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                        : 'bg-slate-200 text-slate-800'
                  }`}>
                    {finalBalanceFormatted}
                  </span>
                  <span className="text-[11px] font-bold text-slate-600">({finalBalanceLabel})</span>
                </div>
              </div>
            </div>

            {/* 2.5 KPI Summary Cards (4 Cards) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5 text-xs">
              {/* Card 1: Prior Balance */}
              <div className={`p-2.5 rounded-xl border ${isBW ? 'border border-slate-300 bg-slate-50' : 'border-slate-200 bg-slate-50'}`}>
                <span className="text-[10px] font-bold text-slate-600 block mb-0.5">رصيد ما قبل الفترة</span>
                <div className="font-mono font-black text-sm text-slate-900">
                  {statementCalculation.priorBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol}
                </div>
                <span className="text-[9px] font-bold text-slate-500">
                  {statementCalculation.priorBalanceType === 'DEBIT' ? 'مدين (لنا)' : statementCalculation.priorBalanceType === 'CREDIT' ? 'دائن (له)' : 'متزن'}
                </span>
              </div>

              {/* Card 2: Total Debits */}
              <div className={`p-2.5 rounded-xl border ${isBW ? 'border border-slate-300 bg-slate-50' : 'border-blue-200 bg-blue-50/50'}`}>
                <span className={`text-[10px] font-bold block mb-0.5 ${isBW ? 'text-slate-800' : 'text-blue-900'}`}>إجمالي المدين (+)</span>
                <div className={`font-mono font-black text-sm ${isBW ? 'text-slate-950' : 'text-blue-950'}`}>
                  {statementCalculation.totalDebitPeriod.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol}
                </div>
                <span className={`text-[9px] ${isBW ? 'text-slate-600' : 'text-blue-800'}`}>
                  {isCust ? 'فواتير ومسحوبات الفترة' : 'سدادات مسددة للمورد'}
                </span>
              </div>

              {/* Card 3: Total Credits */}
              <div className={`p-2.5 rounded-xl border ${isBW ? 'border border-slate-300 bg-slate-50' : 'border-emerald-200 bg-emerald-50/50'}`}>
                <span className={`text-[10px] font-bold block mb-0.5 ${isBW ? 'text-slate-800' : 'text-emerald-900'}`}>إجمالي الدائن (-)</span>
                <div className={`font-mono font-black text-sm ${isBW ? 'text-slate-950' : 'text-emerald-950'}`}>
                  {statementCalculation.totalCreditPeriod.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol}
                </div>
                <span className={`text-[9px] ${isBW ? 'text-slate-600' : 'text-emerald-800'}`}>
                  {isCust ? 'سندات قبض وتحصيلات' : 'فواتير وتوريدات الفترة'}
                </span>
              </div>

              {/* Card 4: Net Balance */}
              <div className={`p-2.5 rounded-xl border ${isBW ? 'border border-slate-400 bg-slate-100 text-slate-950' : 'border-slate-900 bg-slate-900 text-white'}`}>
                <span className={`text-[10px] font-bold block mb-0.5 ${isBW ? 'text-slate-800' : 'text-slate-300'}`}>الرصيد الختامي الصافي</span>
                <div className={`font-mono font-black text-sm ${isBW ? 'text-slate-950' : 'text-white'}`}>
                  {statementCalculation.finalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol}
                </div>
                <span className={`text-[9px] font-bold ${isBW ? 'text-slate-700' : 'text-amber-300'}`}>
                  {statementCalculation.finalBalanceType === 'DEBIT' ? 'مدين (مستحق لنا)' : statementCalculation.finalBalanceType === 'CREDIT' ? 'دائن (له دفعة)' : 'رصيد متزن'}
                </span>
              </div>
            </div>
          </>
        ) : (
          /* Compact Continuing Header for Pages 2, 3... */
          <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b-2 mb-4 p-3 rounded-xl text-xs ${
            isBW ? 'bg-slate-50/80 border-slate-400' : 'bg-slate-50 border-slate-700'
          }`}>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-slate-900">{companyName}</span>
              <span className="text-slate-400">|</span>
              <span className={`font-bold text-xs px-2 py-0.5 rounded border ${
                isBW ? 'bg-slate-100 text-slate-800 border-slate-300' : 'text-blue-900 bg-blue-50 border-blue-200'
              }`}>{activeStatementTitleAr}</span>
            </div>
            <div className="text-xs text-slate-600 font-medium">
              <span>{activePartnerLabelAr}: <strong className="text-slate-900">{selectedPartner.name}</strong></span>
              <span className="mx-2 text-slate-300">•</span>
              <span>كود: <strong className="font-mono text-slate-900">{activeCode}</strong></span>
              <span className="mx-2 text-slate-300">•</span>
              <span>الفترة: <strong className="font-mono text-slate-800">من {dateFrom || 'البداية'} إلى {dateTo || 'اليوم'}</strong></span>
            </div>
            <div className={`flex items-center gap-1.5 font-bold font-mono text-xs px-2.5 py-1 rounded-lg border shadow-2xs ${
              isBW ? 'bg-slate-100 text-slate-900 border-slate-300' : 'text-blue-900 bg-blue-100/80 border-blue-300'
            }`}>
              <FileText size={13} />
              <span>صفحة {chunk.pageNumber} من {chunk.totalPages}</span>
            </div>
          </div>
        )}

        {/* 3. Accounting Statement Table (11 Columns or 9 Columns depending on detail level) */}
        <div className="overflow-x-auto border-2 border-slate-500 rounded-xl mb-5 shadow-2xs">
          <table className="w-full text-right border-collapse text-[10px] sm:text-[11px]">
            <thead>
              {isDetailed ? (
                /* 11 Columns Full Detailed Header */
                <tr className={`border-b-2 font-black select-none ${isBW ? 'bg-slate-100 text-slate-950 border-slate-500' : 'bg-slate-800 text-white border-slate-900'}`}>
                  <th className={`py-2 px-2.5 w-24 whitespace-nowrap border text-right ${isBW ? 'border-slate-400 text-slate-900' : 'border-slate-700 text-white'}`}>النوع</th>
                  <th className={`py-2 px-2.5 w-24 whitespace-nowrap border text-right ${isBW ? 'border-slate-400 text-slate-900' : 'border-slate-700 text-white'}`}>رقم المستند</th>
                  <th className={`py-2 px-2 w-20 whitespace-nowrap border text-right ${isBW ? 'border-slate-400 text-slate-900' : 'border-slate-700 text-white'}`}>التاريخ</th>
                  <th className={`py-2 px-3 min-w-[170px] border text-right ${isBW ? 'border-slate-400 text-slate-900' : 'border-slate-700 text-white'}`}>البيان والشرح المحاسبي</th>
                  <th className={`py-2 px-2 w-14 text-center whitespace-nowrap border ${isBW ? 'border-slate-400 text-slate-900' : 'border-slate-700 text-white'}`}>كمية</th>
                  <th className={`py-2 px-2 text-left whitespace-nowrap w-20 border ${isBW ? 'border-slate-400 text-slate-900' : 'border-slate-700 text-white'}`}>سعر الوحدة</th>
                  <th className={`py-2 px-2 text-center whitespace-nowrap w-20 border text-[10px] ${isBW ? 'border-slate-400 text-slate-900' : 'border-slate-700 text-white'}`}>الضريبة / الخصم</th>
                  <th className={`py-2 px-2 text-left whitespace-nowrap w-20 border ${isBW ? 'border-slate-400 text-slate-900' : 'border-slate-700 text-white'}`}>الإجمالي</th>
                  <th className={`py-2 px-2 text-left whitespace-nowrap w-24 border ${isBW ? 'border-slate-400 text-slate-900 font-bold' : 'border-slate-700 text-rose-300'}`}>مدين (+)</th>
                  <th className={`py-2 px-2 text-left whitespace-nowrap w-24 border ${isBW ? 'border-slate-400 text-slate-900 font-bold' : 'border-slate-700 text-emerald-300'}`}>دائن (-)</th>
                  <th className={`py-2 px-2.5 text-center whitespace-nowrap w-32 border ${isBW ? 'bg-slate-200 text-slate-950 border-slate-400 font-black' : 'border-slate-700 bg-slate-900 text-amber-300'}`}>الرصيد التراكمي</th>
                </tr>
              ) : (
                /* 9 Columns Standard Financial Ledger Header */
                <tr className={`border-b-2 font-black select-none ${isBW ? 'bg-slate-100 text-slate-950 border-slate-500' : 'bg-slate-800 text-white border-slate-900'}`}>
                  <th className={`py-2.5 px-2.5 w-24 whitespace-nowrap border text-right ${isBW ? 'border-slate-400 text-slate-900' : 'border-slate-700 text-white'}`}>النوع</th>
                  <th className={`py-2.5 px-2.5 w-24 whitespace-nowrap border text-right ${isBW ? 'border-slate-400 text-slate-900' : 'border-slate-700 text-white'}`}>رقم المستند</th>
                  <th className={`py-2.5 px-2 w-20 whitespace-nowrap border text-right ${isBW ? 'border-slate-400 text-slate-900' : 'border-slate-700 text-white'}`}>التاريخ</th>
                  <th className={`py-2.5 px-3 min-w-[170px] border text-right ${isBW ? 'border-slate-400 text-slate-900' : 'border-slate-700 text-white'}`}>البيان والشرح المحاسبي</th>
                  <th className={`py-2.5 px-2 w-14 text-center whitespace-nowrap border ${isBW ? 'border-slate-400 text-slate-900' : 'border-slate-700 text-white'}`}>كمية</th>
                  <th className={`py-2.5 px-2 text-left whitespace-nowrap w-20 border ${isBW ? 'border-slate-400 text-slate-900' : 'border-slate-700 text-white'}`}>سعر الوحدة</th>
                  <th className={`py-2.5 px-2 text-left whitespace-nowrap w-20 border ${isBW ? 'border-slate-400 text-slate-900' : 'border-slate-700 text-white'}`}>الإجمالي</th>
                  <th className={`py-2.5 px-2 text-left whitespace-nowrap w-24 border ${isBW ? 'border-slate-400 text-slate-900 font-bold' : 'border-slate-700 text-rose-300'}`}>مدين (+)</th>
                  <th className={`py-2.5 px-2 text-left whitespace-nowrap w-24 border ${isBW ? 'border-slate-400 text-slate-900 font-bold' : 'border-slate-700 text-emerald-300'}`}>دائن (-)</th>
                  <th className={`py-2.5 px-2.5 text-center whitespace-nowrap w-32 border ${isBW ? 'bg-slate-200 text-slate-950 border-slate-400 font-black' : 'border-slate-700 bg-slate-900 text-amber-300'}`}>الرصيد التراكمي</th>
                </tr>
              )}
            </thead>

            {/* 1. Prior balance row ONLY on first page if exists */}
            {chunk.isFirstPage && dateFrom && statementCalculation.priorBalance > 0 && (
              <tbody className={`border-b-2 ${isBW ? 'border-slate-500 bg-slate-100' : 'border-slate-300 bg-amber-50/60'}`}>
                <tr className="font-bold">
                  <td className="py-2 px-2.5 whitespace-nowrap border border-slate-400">
                    <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                      isBW ? 'bg-slate-200 text-slate-800 border border-slate-400' : 'bg-amber-200 text-amber-900'
                    }`}>
                      رصيد سابق
                    </span>
                  </td>
                  <td className="py-2 px-2.5 font-mono text-slate-400 whitespace-nowrap border border-slate-400 text-center" dir="ltr">-</td>
                  <td className="py-2 px-2 font-mono text-slate-700 whitespace-nowrap border border-slate-400">{dateFrom}</td>
                  <td className="py-2 px-3 text-slate-800 font-semibold border border-slate-400">
                    رصيد ما قبل تاريخ {dateFrom} المنقول للفترة الحالية
                  </td>
                  <td className="py-2 px-2 text-center text-slate-400 border border-slate-400">-</td>
                  <td className="py-2 px-2 text-left text-slate-400 border border-slate-400">-</td>
                  {isDetailed && (
                    <td className="py-2 px-2 text-center text-slate-400 border border-slate-400">-</td>
                  )}
                  <td className="py-2 px-2 font-mono text-left font-bold text-slate-900 border border-slate-400">
                    {statementCalculation.priorBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className={`py-2 px-2 font-mono text-left font-black border border-slate-400 ${
                    isBW ? 'text-slate-900 font-bold' : 'text-rose-700'
                  }`}>
                    {statementCalculation.priorBalanceType === 'DEBIT' ? statementCalculation.priorBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                  </td>
                  <td className={`py-2 px-2 font-mono text-left font-black border border-slate-400 ${
                    isBW ? 'text-slate-900 font-bold' : 'text-emerald-700'
                  }`}>
                    {statementCalculation.priorBalanceType === 'CREDIT' ? statementCalculation.priorBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                  </td>
                  <td className={`py-2 px-2.5 font-mono text-center font-black border border-slate-400 ${
                    isBW ? 'bg-slate-100 text-slate-900' : 'bg-amber-100/70 text-slate-900'
                  }`}>
                    <span>{statementCalculation.priorBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    <span className="text-[9px] mr-1 text-slate-600 font-bold">
                      ({statementCalculation.priorBalanceType === 'DEBIT' ? 'مدين' : statementCalculation.priorBalanceType === 'CREDIT' ? 'دائن' : 'متزن'})
                    </span>
                  </td>
                </tr>
              </tbody>
            )}

            {/* 2. Carried Forward Opening Balance row if NOT first page */}
            {!chunk.isFirstPage && (
              <tbody className={`border-b-2 font-black ${
                isBW ? 'border-slate-500 bg-slate-100 text-slate-900' : 'border-amber-300 bg-amber-100/70 text-amber-950'
              }`}>
                <tr>
                  <td className={`py-2 px-2.5 whitespace-nowrap border text-center ${isBW ? 'border-slate-400' : 'border-amber-300'}`}>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black ${
                      isBW ? 'bg-slate-200 text-slate-800 border border-slate-400' : 'bg-amber-600 text-white shadow-xs'
                    }`}>
                      رصيد منقول
                    </span>
                  </td>
                  <td className={`py-2 px-2.5 font-mono text-slate-400 border text-center ${isBW ? 'border-slate-400' : 'border-amber-300'}`} dir="ltr">-</td>
                  <td className={`py-2 px-2 font-mono text-slate-400 border text-center ${isBW ? 'border-slate-400' : 'border-amber-300'}`}>-</td>
                  <td className={`py-2 px-3 border font-black ${isBW ? 'border-slate-400 text-slate-900' : 'border-amber-300 text-slate-950'}`}>
                    رصيد منقول من الصفحة السابقة (صفحة {chunk.pageNumber - 1})
                  </td>
                  <td className={`py-2 px-2 text-center text-slate-400 border font-mono ${isBW ? 'border-slate-400' : 'border-amber-300'}`}>-</td>
                  <td className={`py-2 px-2 text-center text-slate-400 border font-mono ${isBW ? 'border-slate-400' : 'border-amber-300'}`}>-</td>
                  {isDetailed && <td className={`py-2 px-2 text-center text-slate-400 border font-mono ${isBW ? 'border-slate-400' : 'border-amber-300'}`}>-</td>}
                  <td className={`py-2 px-2 text-center text-slate-400 border font-mono ${isBW ? 'border-slate-400' : 'border-amber-300'}`}>-</td>
                  <td className={`py-2 px-2 text-center text-slate-400 border font-mono ${isBW ? 'border-slate-400' : 'border-amber-300'}`}>-</td>
                  <td className={`py-2 px-2 text-center text-slate-400 border font-mono ${isBW ? 'border-slate-400' : 'border-amber-300'}`}>-</td>
                  <td className={`py-2 px-2.5 font-mono text-center font-black border ${
                    isBW ? 'border-slate-400 bg-slate-200 text-slate-900' : 'border-amber-300 bg-amber-200/80 text-slate-950'
                  }`}>
                    <span>{chunk.openingCarriedBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    <span className="text-[9px] mr-1 text-slate-700 font-bold">
                      ({chunk.openingCarriedBalanceType === 'DEBIT' ? 'مدين' : chunk.openingCarriedBalanceType === 'CREDIT' ? 'دائن' : 'متزن'})
                    </span>
                  </td>
                </tr>
              </tbody>
            )}

            {/* Empty State */}
            {chunk.blocks.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={isDetailed ? 11 : 10} className="py-10 text-center text-slate-400 border border-slate-400 font-bold text-xs bg-slate-50">
                    لا توجد حركات مالية مسجلة لهذا الحساب خلال الفترة المحددة
                  </td>
                </tr>
              </tbody>
            ) : (
              chunk.blocks.map((block, bIdx) => {
                const isMulti = Boolean(block.isMultiLine && block.lines && block.lines.length > 1);
                const shouldShowChildren = includeItemsInPrint;
                const balText = block.runningBalanceType === 'DEBIT' ? 'مدين' : block.runningBalanceType === 'CREDIT' ? 'دائن' : 'متزن';
                const balClass = isBW ? 'text-slate-800 font-bold' : (block.runningBalanceType === 'DEBIT' ? 'text-rose-800' : block.runningBalanceType === 'CREDIT' ? 'text-emerald-800' : 'text-slate-700');

                const badgeColor = isBW
                  ? 'bg-slate-100 text-slate-800 border-slate-400'
                  : block.docType === 'SALES_INVOICE' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                  block.docType === 'PURCHASE_INVOICE' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                  block.docType === 'RECEIPT_VOUCHER' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                  block.docType === 'PAYMENT_VOUCHER' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                  'bg-slate-100 text-slate-800 border-slate-200';

                // Alternating block shading per document/movement
                const isEvenBlock = bIdx % 2 === 0;

                // 1. Single Line Document (or Multi-line when children are not expanded/included)
                if (!isMulti || !shouldShowChildren) {
                  const line = block.lines[0] || {
                    typeLabel: block.docTypeLabel,
                    docNumber: block.docNumber,
                    date: block.date,
                    description: block.docTypeLabel,
                    quantity: null,
                    unitPrice: null,
                    total: block.docTotal
                  };

                  const descText = isMulti 
                    ? `${block.docTypeLabel} (${block.lines.length} أصناف)${block.rawDoc?.notes ? ' - ' + block.rawDoc.notes : ''}`
                    : line.description;

                  return (
                    <tbody 
                      key={block.id || `doc-block-${bIdx}`}
                      className={`border-b-2 border-slate-400 transition-colors ${
                        isEvenBlock ? 'bg-white hover:bg-slate-50/90' : 'bg-slate-100/60 hover:bg-slate-200/60'
                      }`}
                    >
                      <tr className={`transition-colors ${isBW ? (isEvenBlock ? 'hover:bg-slate-50' : 'hover:bg-slate-100') : (isEvenBlock ? 'hover:bg-blue-50/20' : 'hover:bg-blue-50/30')}`}>
                        <td className="py-2 px-2.5 whitespace-nowrap border border-slate-400">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border shadow-2xs ${badgeColor}`}>
                            {block.docTypeLabel}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 whitespace-nowrap font-mono font-bold text-slate-900 border border-slate-400 text-right" dir="ltr">
                          {block.docNumber}
                        </td>
                        <td className="py-2 px-2 font-mono font-medium text-slate-600 whitespace-nowrap border border-slate-400">
                          {block.date}
                        </td>
                        <td className="py-2 px-3 text-slate-800 border border-slate-400">
                          <div className="font-semibold text-slate-900 leading-snug">
                            {descText}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-slate-800 font-semibold border border-slate-400">
                          {isMulti ? (block.totalQuantity > 0 ? block.totalQuantity.toLocaleString('en-US') : '-') : (line.quantity !== null && line.quantity !== undefined ? line.quantity.toLocaleString('en-US') : '-')}
                        </td>
                        <td className="py-2 px-2 font-mono text-left text-slate-700 border border-slate-400">
                          {isMulti ? '-' : (line.unitPrice !== null && line.unitPrice !== undefined ? line.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-')}
                        </td>
                        {isDetailed && (
                          <td className="py-2 px-2 text-center text-slate-500 border border-slate-400 text-[10px]">
                            {block.taxAmount > 0 ? (
                              <span className={`font-bold px-1 py-0.5 rounded border ${
                                isBW ? 'bg-slate-100 text-slate-800 border-slate-400' : 'text-amber-800 bg-amber-50 border-amber-200/60'
                              }`}>
                                ض: {block.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            ) : '-'}
                          </td>
                        )}
                        <td className="py-2 px-2 font-mono text-left font-bold text-slate-900 whitespace-nowrap border border-slate-400">
                          {block.docTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`py-2 px-2 font-mono text-left whitespace-nowrap border border-slate-400 ${
                          isBW 
                            ? (isEvenBlock ? 'bg-white text-slate-900 font-bold' : 'bg-slate-50 text-slate-900 font-bold') 
                            : (isEvenBlock ? 'bg-rose-50/30 text-rose-700 font-black' : 'bg-rose-100/40 text-rose-700 font-black')
                        }`}>
                          {block.totalDebit > 0 ? block.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className={`py-2 px-2 font-mono text-left whitespace-nowrap border border-slate-400 ${
                          isBW 
                            ? (isEvenBlock ? 'bg-white text-slate-900 font-bold' : 'bg-slate-50 text-slate-900 font-bold') 
                            : (isEvenBlock ? 'bg-emerald-50/30 text-emerald-700 font-black' : 'bg-emerald-100/40 text-emerald-700 font-black')
                        }`}>
                          {block.totalCredit > 0 ? block.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className={`py-2 px-2.5 font-mono text-center font-black text-slate-900 border border-slate-400 ${
                          isBW ? (isEvenBlock ? 'bg-slate-50' : 'bg-slate-100') : (isEvenBlock ? 'bg-slate-50/80' : 'bg-slate-200/70')
                        }`}>
                          <span className="text-slate-950 font-bold">{block.runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          <span className={`text-[9px] mr-1 font-bold ${balClass}`}>({balText})</span>
                        </td>
                      </tr>
                    </tbody>
                  );
                }

                // 2. Multi-Item Invoice Block (Expanded child items in both 11-column & 9-column formats)
                return (
                  <tbody 
                    key={block.id || `doc-block-${bIdx}`}
                    className={`border-b-2 border-slate-500 ${isEvenBlock ? 'bg-white' : 'bg-slate-100/50'}`}
                  >
                    {/* 1. Master Invoice Opening Header */}
                    <tr className={`font-bold text-slate-900 border-t-2 border-slate-500 ${
                      isBW 
                        ? (isEvenBlock ? 'bg-slate-100' : 'bg-slate-200') 
                        : (isEvenBlock ? 'bg-slate-100/90 hover:bg-slate-200/60' : 'bg-slate-200/90 hover:bg-slate-300/60')
                    }`}>
                      <td className="py-2 px-2.5 whitespace-nowrap border border-slate-400">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border shadow-2xs ${badgeColor}`}>
                          {block.docTypeLabel}
                        </span>
                      </td>
                      <td className={`py-2 px-2.5 whitespace-nowrap font-mono font-black border border-slate-400 text-right ${isBW ? 'text-slate-900' : 'text-blue-900'}`} dir="ltr">
                        {block.docNumber}
                      </td>
                      <td className="py-2 px-2 font-mono text-slate-700 whitespace-nowrap border border-slate-400">
                        {block.date}
                      </td>
                      <td className="py-2 px-3 text-slate-900 font-black border border-slate-400" colSpan={isDetailed ? 7 : 6}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-950 font-bold">
                            {block.docTypeLabel} ({block.lines.length} أصناف)
                            {block.rawDoc?.notes ? ` - ${block.rawDoc.notes}` : ''}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border shadow-2xs hidden sm:inline-flex items-center gap-1 ${
                            isBW ? 'bg-slate-100 text-slate-700 border-slate-400' : 'text-slate-500 bg-white/80 border-slate-200'
                          }`}>
                            <span className={isBW ? 'text-slate-700 font-bold' : 'text-blue-600 font-bold'}>↳</span>
                            <span>تفاصيل بنود وأصناف الفاتورة:</span>
                          </span>
                        </div>
                      </td>
                      <td className={`py-2 px-2.5 font-mono text-center text-slate-400 border border-slate-400 ${
                        isEvenBlock ? 'bg-slate-50/50' : 'bg-slate-200/50'
                      }`}>
                        -
                      </td>
                    </tr>

                    {/* 2. Child Item Detail Lines */}
                    {shouldShowChildren && block.lines.map((line, lIdx) => (
                      <tr 
                        key={line.id || `b-${bIdx}-l-${lIdx}`}
                        className={`text-slate-700 border-b border-slate-300 text-[10px] transition-colors ${
                          isBW 
                            ? (isEvenBlock ? 'bg-slate-50/40 hover:bg-slate-100/50' : 'bg-slate-100/40 hover:bg-slate-200/50 text-slate-800')
                            : (isEvenBlock ? 'bg-slate-50/40 hover:bg-blue-50/30' : 'bg-slate-100/40 hover:bg-blue-50/40 text-slate-800')
                        }`}
                      >
                        <td className="py-1.5 px-2.5 text-center text-slate-500 border border-slate-300">
                          <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] border ${
                            isEvenBlock ? 'bg-slate-100 text-slate-600 border-slate-300' : 'bg-slate-200 text-slate-700 border-slate-300'
                          }`}>
                            بند #{lIdx + 1}
                          </span>
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-slate-400 border border-slate-300 text-right" dir="ltr">
                          <span className="text-slate-400 text-[9px]">↳</span> {block.docNumber}
                        </td>
                        <td className="py-1.5 px-2 font-mono text-slate-400 border border-slate-300">
                          {line.date}
                        </td>
                        <td className="py-1.5 pr-5 pl-2 text-slate-900 font-semibold border border-slate-300">
                          <span className={`font-bold select-none ml-1 ${isBW ? 'text-slate-700' : 'text-blue-500'}`}>↳</span>
                          <span>{line.description}</span>
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-800 border border-slate-300">
                          {line.quantity !== null && line.quantity !== undefined ? line.quantity.toLocaleString('en-US') : '-'}
                        </td>
                        <td className="py-1.5 px-2 font-mono text-left text-slate-700 border border-slate-300">
                          {line.unitPrice !== null && line.unitPrice !== undefined ? line.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        {isDetailed && (
                          <td className="py-1.5 px-2 text-center text-slate-500 border border-slate-300">
                            {line.taxAmount ? `+${line.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'معفى'}
                          </td>
                        )}
                        <td className="py-1.5 px-2 font-mono text-left font-bold text-slate-900 border border-slate-300">
                          {line.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-1.5 px-2 text-center text-slate-300 border border-slate-300">-</td>
                        <td className="py-1.5 px-2 text-center text-slate-300 border border-slate-300">-</td>
                        <td className={`py-1.5 px-2.5 text-center text-slate-300 border border-slate-300 ${
                          isEvenBlock ? 'bg-slate-50/40' : 'bg-slate-200/40'
                        }`}>-</td>
                      </tr>
                    ))}

                    {/* 3. Closing Totals Row underneath items */}
                    <tr className={`font-black text-slate-900 border-t-2 border-slate-500 ${
                      isBW 
                        ? (isEvenBlock ? 'bg-slate-100' : 'bg-slate-200')
                        : (isEvenBlock ? 'bg-slate-100/90 hover:bg-slate-200/80' : 'bg-slate-200/95 hover:bg-slate-300/80')
                    }`}>
                      <td className="py-2 px-2.5 whitespace-nowrap border border-slate-400 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black ${
                          isBW ? 'bg-slate-200 text-slate-800 border border-slate-400' : 'bg-slate-900 text-white shadow-xs'
                        }`}>
                          إجمالي الفاتورة
                        </span>
                      </td>
                      <td className={`py-2 px-2.5 whitespace-nowrap font-mono font-black border border-slate-400 text-right ${
                        isBW ? 'text-slate-900' : 'text-blue-950'
                      }`} dir="ltr">
                        {block.docNumber}
                      </td>
                      <td className="py-2 px-2 font-mono text-slate-700 whitespace-nowrap border border-slate-400">
                        {block.date}
                      </td>
                      <td className="py-2 px-3 text-slate-950 font-black border border-slate-400">
                        <span className="font-black text-slate-950">
                          مجموع {block.docTypeLabel} ({block.lines.length} أصناف)
                        </span>
                      </td>
                      <td className={`py-2 px-2 text-center font-mono font-black text-slate-950 border border-slate-400 ${
                        isBW ? 'bg-slate-100' : 'bg-amber-50/60'
                      }`}>
                        <span className={`px-1.5 py-0.5 rounded border font-mono font-black text-[11px] ${
                          isBW ? 'bg-slate-100 text-slate-900 border-slate-400' : 'bg-amber-100/80 text-amber-950 border-amber-200'
                        }`}>
                          {block.totalQuantity > 0 ? block.totalQuantity.toLocaleString('en-US') : '-'}
                        </span>
                      </td>
                      <td className={`py-2 px-2 text-center text-slate-400 border border-slate-400 ${
                        isEvenBlock ? 'bg-slate-50/50' : 'bg-slate-200/50'
                      }`}>-</td>
                      {isDetailed && (
                        <td className={`py-2 px-2 text-center border border-slate-400 text-[10px] leading-tight ${
                          isEvenBlock ? 'bg-slate-50/50' : 'bg-slate-200/50'
                        }`}>
                          {block.taxAmount > 0 ? (
                            <div className={`px-1.5 py-0.5 rounded border font-black ${
                              isBW ? 'bg-slate-100 text-slate-800 border-slate-400' : 'text-amber-900 bg-amber-100/80 border-amber-200'
                            }`}>
                              ض: {block.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                          ) : '-'}
                        </td>
                      )}
                      <td className={`py-2 px-2 font-mono text-left font-black text-slate-950 whitespace-nowrap border border-slate-400 ${
                        isBW ? 'bg-slate-100' : 'bg-blue-50/60'
                      }`}>
                        <span className={`px-1.5 py-0.5 rounded border font-mono font-black ${
                          isBW ? 'bg-slate-100 text-slate-900 border-slate-400' : 'bg-blue-100/80 text-blue-950 border-blue-200'
                        }`}>
                          {block.docTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className={`py-2 px-2 font-mono text-left font-black whitespace-nowrap border border-slate-400 ${
                        isBW ? 'bg-slate-100 text-slate-900' : 'bg-rose-50/60 text-rose-700'
                      }`}>
                        {block.totalDebit > 0 ? (
                          <span className={`px-1.5 py-0.5 rounded border font-mono font-black ${
                            isBW ? 'bg-slate-100 text-slate-900 border-slate-400 font-bold' : 'bg-rose-100/90 text-rose-950 border-rose-200'
                          }`}>
                            +{block.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        ) : '-'}
                      </td>
                      <td className={`py-2 px-2 font-mono text-left font-black whitespace-nowrap border border-slate-400 ${
                        isBW ? 'bg-slate-100 text-slate-900' : 'bg-emerald-50/60 text-emerald-700'
                      }`}>
                        {block.totalCredit > 0 ? (
                          <span className={`px-1.5 py-0.5 rounded border font-mono font-black ${
                            isBW ? 'bg-slate-100 text-slate-900 border-slate-400 font-bold' : 'bg-emerald-100/90 text-emerald-950 border-emerald-200'
                          }`}>
                            -{block.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        ) : '-'}
                      </td>
                      <td className={`py-2 px-2.5 font-mono text-center font-black text-slate-950 border border-slate-400 ${
                        isBW ? (isEvenBlock ? 'bg-slate-100' : 'bg-slate-200') : (isEvenBlock ? 'bg-slate-200/90' : 'bg-slate-300/80')
                      }`}>
                        <span className="font-mono font-black text-slate-950 text-[11px]">{block.runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        <span className={`text-[9px] mr-1 font-bold ${balClass}`}>({balText})</span>
                      </td>
                    </tr>
                  </tbody>
                );
              })
            )}

            {/* 3. Carried Forward Closing Balance row if NOT last page */}
            {!chunk.isLastPage && (
              <tbody className={`border-t-2 font-black ${
                isBW ? 'border-slate-500 bg-slate-100 text-slate-900' : 'border-blue-300 bg-blue-100/70 text-blue-950'
              }`}>
                <tr>
                  <td className={`py-2 px-2.5 whitespace-nowrap border text-center ${isBW ? 'border-slate-400' : 'border-blue-300'}`}>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black ${
                      isBW ? 'bg-slate-200 text-slate-800 border border-slate-400' : 'bg-blue-600 text-white shadow-xs'
                    }`}>
                      رصيد مرحل
                    </span>
                  </td>
                  <td className={`py-2 px-2.5 font-mono text-slate-400 border text-center ${isBW ? 'border-slate-400' : 'border-blue-300'}`} dir="ltr">-</td>
                  <td className={`py-2 px-2 font-mono text-slate-400 border text-center ${isBW ? 'border-slate-400' : 'border-blue-300'}`}>-</td>
                  <td className={`py-2 px-3 border font-black ${isBW ? 'border-slate-400 text-slate-900' : 'border-blue-300 text-slate-950'}`}>
                    رصيد مرحل إلى الصفحة التالية (صفحة {chunk.pageNumber + 1})
                  </td>
                  <td className={`py-2 px-2 text-center text-slate-400 border font-mono ${isBW ? 'border-slate-400' : 'border-blue-300'}`}>-</td>
                  <td className={`py-2 px-2 text-center text-slate-400 border font-mono ${isBW ? 'border-slate-400' : 'border-blue-300'}`}>-</td>
                  {isDetailed && <td className={`py-2 px-2 text-center text-slate-400 border font-mono ${isBW ? 'border-slate-400' : 'border-blue-300'}`}>-</td>}
                  <td className={`py-2 px-2 text-center text-slate-400 border font-mono ${isBW ? 'border-slate-400' : 'border-blue-300'}`}>-</td>
                  <td className={`py-2 px-2 text-center text-slate-400 border font-mono ${isBW ? 'border-slate-400' : 'border-blue-300'}`}>-</td>
                  <td className={`py-2 px-2 text-center text-slate-400 border font-mono ${isBW ? 'border-slate-400' : 'border-blue-300'}`}>-</td>
                  <td className={`py-2 px-2.5 font-mono text-center font-black border ${
                    isBW ? 'border-slate-400 bg-slate-200 text-slate-900' : 'border-blue-300 bg-blue-200/80 text-slate-950'
                  }`}>
                    <span>{chunk.closingCarriedBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    <span className="text-[9px] mr-1 text-slate-700 font-bold">
                      ({chunk.closingCarriedBalanceType === 'DEBIT' ? 'مدين' : chunk.closingCarriedBalanceType === 'CREDIT' ? 'دائن' : 'متزن'})
                    </span>
                  </td>
                </tr>
              </tbody>
            )}

            {/* Grand Totals Table Footer - Rendered ONLY on the Last Page */}
            {chunk.isLastPage && statementCalculation.documentBlocks.length > 0 && (
              <tfoot>
                <tr className={`font-black text-[11px] ${
                  isBW 
                    ? 'bg-slate-100 text-slate-900 border-t-2 border-slate-500' 
                    : 'bg-slate-900 text-white border-t-2 border-slate-950'
                }`}>
                  <td colSpan={4} className={`py-2.5 px-3 border ${isBW ? 'border-slate-400 text-slate-900' : 'border-slate-800 text-slate-100'}`}>
                    الإجمالي العام لكشف الحساب ({statementCalculation.documentBlocks.length} مستند)
                  </td>
                  <td className={`py-2.5 px-2 text-center font-mono font-black whitespace-nowrap border ${
                    isBW ? 'border-slate-400 text-slate-900' : 'border-slate-800 text-white'
                  }`}>
                    {statementCalculation.totalQuantityPeriod > 0 ? statementCalculation.totalQuantityPeriod.toLocaleString('en-US') : '-'}
                  </td>
                  <td className={`py-2.5 px-2 text-center text-slate-400 border ${isBW ? 'border-slate-400' : 'border-slate-800'}`}>-</td>
                  {isDetailed && (
                    <td className={`py-2.5 px-2 text-center text-slate-400 border ${isBW ? 'border-slate-400' : 'border-slate-800'}`}>-</td>
                  )}
                  <td className={`py-2.5 px-2 text-center text-slate-400 border ${isBW ? 'border-slate-400' : 'border-slate-800'}`}>-</td>
                  <td className={`py-2.5 px-2 font-mono text-left whitespace-nowrap font-black border ${
                    isBW ? 'border-slate-400 text-slate-900 font-bold' : 'border-slate-800 text-rose-300'
                  }`}>
                    {statementCalculation.totalDebitPeriod.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className={`py-2.5 px-2 font-mono text-left whitespace-nowrap font-black border ${
                    isBW ? 'border-slate-400 text-slate-900 font-bold' : 'border-slate-800 text-emerald-300'
                  }`}>
                    {statementCalculation.totalCreditPeriod.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className={`py-2.5 px-2.5 font-mono text-center whitespace-nowrap font-black border ${
                    isBW ? 'border-slate-400 bg-slate-200 text-slate-900' : 'border-slate-800 bg-black text-amber-300'
                  }`}>
                    <div className="flex flex-col items-center justify-center">
                      <span>{statementCalculation.finalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      <span className={`text-[9px] font-bold mt-0.5 ${isBW ? 'text-slate-700' : 'text-amber-400'}`}>
                        ({statementCalculation.finalBalanceType === 'DEBIT' ? 'صافي مدين' : statementCalculation.finalBalanceType === 'CREDIT' ? 'صافي دائن' : 'حساب متزن'})
                      </span>
                    </div>
                  </td>
                </tr>

                {/* 2. Comprehensive Financial Totals & Balance Reconciliation Footer Row */}
                <tr className={`${isBW ? 'bg-slate-50 text-slate-950 border-t-2 border-slate-500' : 'bg-slate-950 text-white border-t-2 border-slate-800'}`}>
                  <td colSpan={isDetailed ? 11 : 10} className={`p-3 sm:p-4 border ${isBW ? 'border-slate-400' : 'border-slate-700'}`}>
                    <div className="flex flex-col gap-3">
                      {/* Financial Metrics Cards Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {/* 1. إجمالي المدين */}
                        <div className={`p-2.5 rounded-lg border ${isBW ? 'bg-white border-slate-400 text-slate-950' : 'bg-slate-900 border-blue-500/40 text-white'}`}>
                          <span className={`text-[10px] font-bold block ${isBW ? 'text-slate-700' : 'text-blue-300'}`}>إجمالي المدين (+)</span>
                          <span className="font-mono font-black text-sm block my-0.5">
                            {statementCalculation.totalDebitPeriod.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol}
                          </span>
                          <span className="text-[9px] text-slate-400 block">
                            {isCust ? 'فواتير ومسحوبات' : 'سدادات للمورد'}
                          </span>
                        </div>

                        {/* 2. إجمالي الدائن */}
                        <div className={`p-2.5 rounded-lg border ${isBW ? 'bg-white border-slate-400 text-slate-950' : 'bg-slate-900 border-emerald-500/40 text-white'}`}>
                          <span className={`text-[10px] font-bold block ${isBW ? 'text-slate-700' : 'text-emerald-300'}`}>إجمالي الدائن (-)</span>
                          <span className="font-mono font-black text-sm block my-0.5">
                            {statementCalculation.totalCreditPeriod.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol}
                          </span>
                          <span className="text-[9px] text-slate-400 block">
                            {isCust ? 'سندات قبض وتحصيلات' : 'فواتير وتوريدات'}
                          </span>
                        </div>

                        {/* 3. صافي الحركة */}
                        <div className={`p-2.5 rounded-lg border ${isBW ? 'bg-white border-slate-400 text-slate-950' : 'bg-slate-900 border-indigo-500/40 text-white'}`}>
                          <span className={`text-[10px] font-bold block ${isBW ? 'text-slate-700' : 'text-indigo-300'}`}>صافي حركة الفترة</span>
                          <span className="font-mono font-black text-sm block my-0.5">
                            {Math.abs(statementCalculation.netPeriodChange).toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol}
                          </span>
                          <span className="text-[9px] font-bold block">
                            {statementCalculation.netPeriodChange > 0 
                              ? '▲ حركة مدينة (+)' 
                              : statementCalculation.netPeriodChange < 0 
                              ? '▼ حركة دائنة (-)' 
                              : '• حركة متوازنة'}
                          </span>
                        </div>

                        {/* 4. المتبقي الصافي */}
                        <div className={`p-2.5 rounded-lg border-2 ${
                          isBW 
                            ? 'bg-slate-100 border-slate-500 text-slate-950' 
                            : statementCalculation.finalBalanceType === 'DEBIT'
                            ? 'bg-rose-950/80 border-rose-500 text-white'
                            : statementCalculation.finalBalanceType === 'CREDIT'
                            ? 'bg-emerald-950/80 border-emerald-500 text-white'
                            : 'bg-slate-900 border-slate-600 text-white'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold">المتبقي الصافي</span>
                            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                              isBW 
                                ? 'bg-slate-200 text-slate-900 border border-slate-400' 
                                : statementCalculation.finalBalanceType === 'DEBIT' 
                                ? 'bg-rose-500 text-white' 
                                : statementCalculation.finalBalanceType === 'CREDIT' 
                                ? 'bg-emerald-500 text-white' 
                                : 'bg-slate-700 text-white'
                            }`}>
                              {statementCalculation.finalBalanceType === 'DEBIT' ? 'مدين' : statementCalculation.finalBalanceType === 'CREDIT' ? 'دائن' : 'متزن'}
                            </span>
                          </div>
                          <span className="font-mono font-black text-base block my-0.5">
                            {Math.abs(statementCalculation.finalBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol}
                          </span>
                          <span className={`text-[9px] font-bold block ${isBW ? 'text-slate-700' : 'text-amber-300'}`}>
                            {statementCalculation.finalBalanceType === 'DEBIT' 
                              ? (isCust ? 'مستحق لنا' : 'مسدد بالزيادة') 
                              : statementCalculation.finalBalanceType === 'CREDIT' 
                              ? (isCust ? 'دفعة مقدمة' : 'مستحق للمورد') 
                              : 'حساب متزن'}
                          </span>
                        </div>
                      </div>

                      {/* Text Summary Banner */}
                      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 rounded-lg border text-xs ${
                        isBW 
                          ? 'bg-white border-slate-400 text-slate-950' 
                          : 'bg-slate-900 border-slate-800 text-slate-200'
                      }`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black">المتبقي الصافي النهائي:</span>
                          <span className={`font-mono font-black px-2 py-0.5 rounded border text-xs sm:text-sm ${
                            isBW ? 'bg-slate-100 border-slate-400 text-slate-950' : 'bg-black/60 border-slate-700 text-amber-300'
                          }`}>
                            {Math.abs(statementCalculation.finalBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol}
                          </span>
                          <span className={`px-2 py-0.5 rounded font-black text-[11px] border ${
                            isBW 
                              ? 'bg-slate-100 border-slate-400 text-slate-900' 
                              : statementCalculation.finalBalanceType === 'DEBIT'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                              : statementCalculation.finalBalanceType === 'CREDIT'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                              : 'bg-slate-700 text-slate-200 border-slate-600'
                          }`}>
                            {statementCalculation.finalBalanceType === 'DEBIT'
                              ? `رصيد مدين (${isCust ? 'مستحق السداد لصالحنا في ذمة العميل' : 'دفعة مسددة للمورد بالزيادة'})`
                              : statementCalculation.finalBalanceType === 'CREDIT'
                              ? `رصيد دائن (${isCust ? 'دفعة مقدمة للعميل' : 'مستحق السداد لصالح المورد'})`
                              : 'حساب متزن ومطابق (0.00)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* 3.5 Official Certified Tafqeet in Arabic Words (Last Page only) */}
        {chunk.isLastPage && (
          <>
            <div className={`rounded-xl p-3 mb-5 border ${
              isBW 
                ? 'bg-slate-100 border-slate-900 text-slate-950' 
                : statementCalculation.finalBalance > 0
                  ? 'bg-rose-50/70 border-rose-200 text-slate-900'
                  : statementCalculation.finalBalance < 0
                    ? 'bg-emerald-50/70 border-emerald-200 text-slate-900'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-slate-800 flex items-center gap-1.5">
                    <FileText size={14} className={isBW ? 'text-slate-900' : 'text-blue-700'} />
                    المبلغ المتبقي كتابةً:
                  </span>
                  {(() => {
                    const bal = Math.abs(statementCalculation.finalBalance);
                    const raw = statementCalculation.finalBalance !== 0 ? tafqeet(bal).trim() : '';
                    const cleanBody = raw
                      .replace(/^فقط\s+/i, '')
                      .replace(/\s+فقط\s+لا\s+غير$/i, '')
                      .replace(/\s+لا\s+غير$/i, '')
                      .trim();
                    const displayTafqeet = statementCalculation.finalBalance !== 0
                      ? `${cleanBody} فقط لا غير`
                      : `صفر ${currencyFullNameAr || 'ريال سعودي'} فقط لا غير (الحساب متزن تماماً ومطابق)`;

                    return (
                      <span className={`font-black px-3 py-1 rounded-lg border text-xs sm:text-sm font-mono ${
                        isBW 
                          ? 'bg-white border-slate-900 text-slate-950' 
                          : 'bg-white border-slate-300 text-slate-900 shadow-2xs'
                      }`}>
                        {displayTafqeet}
                      </span>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-2 text-[11px] font-bold">
                  <span className="text-slate-500">حالة المطابقة:</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-black ${
                    isBW 
                      ? 'bg-slate-200 text-slate-900' 
                      : statementCalculation.finalBalance > 0
                        ? 'bg-rose-100 text-rose-800'
                        : statementCalculation.finalBalance < 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-800'
                  }`}>
                    {finalBalanceLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Official Signatures and Certified Stamp */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t-2 border-slate-300 text-xs text-slate-700">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 text-center w-full sm:w-auto">
                <div className="border border-slate-200 rounded-lg p-2 bg-slate-50/60">
                  <p className="font-bold text-slate-800">إعداد / المحاسب</p>
                  <div className="h-8 border-b border-dashed border-slate-400 mt-1.5 mb-1"></div>
                  <p className="text-[10px] text-slate-500">التوقيع والتاريخ</p>
                </div>

                <div className="border border-slate-200 rounded-lg p-2 bg-slate-50/60">
                  <p className="font-bold text-slate-800">مراجعة وتدقيق</p>
                  <div className="h-8 border-b border-dashed border-slate-400 mt-1.5 mb-1"></div>
                  <p className="text-[10px] text-slate-500">التوقيع والتاريخ</p>
                </div>

                <div className="border border-slate-200 rounded-lg p-2 bg-slate-50/60">
                  <p className="font-bold text-slate-800">المدير المالي</p>
                  <div className="h-8 border-b border-dashed border-slate-400 mt-1.5 mb-1"></div>
                  <p className="text-[10px] text-slate-500">التوقيع والاعتماد</p>
                </div>

                <div className="border border-slate-200 rounded-lg p-2 bg-slate-50/60">
                  <p className="font-bold text-slate-800">اعتماد {activePartnerLabelAr}</p>
                  <div className="h-8 border-b border-dashed border-slate-400 mt-1.5 mb-1"></div>
                  <p className="text-[10px] text-slate-500">المصادقة والتوقيع</p>
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/80 w-32 h-20 text-center select-none">
                <span className="text-[10px] text-slate-400 font-bold">الختم المالي الرسمي</span>
                <span className="text-[9px] text-slate-400 font-mono mt-0.5">Official Stamp</span>
              </div>
            </div>
          </>
        )}

        {/* Page Running Footer on Every Page */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-3 mt-4 border-t border-slate-200">
          <div>كشف حساب معتمد رسمياً • طُبع بتاريخ {nowStr} - {nowTimeStr}</div>
          <div className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            صفحة {chunk.pageNumber} من {chunk.totalPages}
          </div>
        </div>
      </div>
    );
  };

  // Render the Official Detailed Statement Sheet Document (for modal single-page, multi-page, or direct print)
  const renderDetailedStatementSheet = (isForModal: boolean = false, targetChunk?: StatementPageChunk) => {
    if (!selectedPartner) {
      return (
        <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          يرجى اختيار عميل أو مورد لعرض كشف حسابه التفصيلي
        </div>
      );
    }

    if (targetChunk) {
      return renderDetailedStatementPage(targetChunk, isForModal);
    }

    return (
      <div className="flex flex-col items-center w-full space-y-8 print:space-y-0" data-statement-all-pages="true">
        {paginatedChunks.map((chunk) => (
          <div key={`stmt-page-wrap-${chunk.pageNumber}`} className="w-full print:break-after-page page-sheet-wrapper">
            {renderDetailedStatementPage(chunk, isForModal)}
          </div>
        ))}
      </div>
    );
  };

  // Render Mobile-Friendly Responsive Statement Cards (حل مشكلة شاشات الموبايل: بطاقات سهلة ومريحة بدون سحب أفقي أو تصغير)
  const renderMobileStatementCards = (isForModal: boolean = false) => {
    if (!selectedPartner) {
      return (
        <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          يرجى اختيار عميل أو مورد لعرض كشف حسابه
        </div>
      );
    }

    const isCust = selectedPartner.type === 'CUSTOMER';
    const partnerLabelAr = isCust ? 'عميل' : 'مورد';
    const activeCode = selectedPartner.code || (isCust ? `CUST-${selectedPartner.id}` : `VEND-${selectedPartner.id}`);
    const finalBalText = Math.abs(statementCalculation.finalBalance).toLocaleString('en-US', { minimumFractionDigits: 2 });
    const finalBalLabel = statementCalculation.finalBalanceType === 'DEBIT'
      ? (isCust ? 'مدين (مستحق لنا)' : 'مدين (مسدد للمورد بالزيادة)')
      : statementCalculation.finalBalanceType === 'CREDIT'
      ? (isCust ? 'دائن (دفعة مقدمة)' : 'دائن (مستحق للمورد)')
      : 'رصيد متزن';

    return (
      <div className="space-y-3.5 w-full max-w-2xl mx-auto text-xs select-text">
        {/* Mobile Experience Explanation Badge */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 flex items-center justify-between gap-2 text-blue-900 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Smartphone size={14} />
            </div>
            <div className="min-w-0">
              <span className="font-black text-xs block leading-tight truncate">نمط الجوال الذكي (بدون تمرير أفقي)</span>
              <span className="text-[10px] text-blue-700 block leading-tight truncate">
                مرتب في بطاقات رأسية مريحة لإبهام اليد مع إمكانية التبديل لورقة A4
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isForModal) {
                setPreviewDisplayMode('A4_SHEET');
                setPreviewZoom(calculateModalFitZoom());
              } else {
                setMainTableMode('TABLE');
              }
            }}
            className="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-lg text-[10px] font-bold shrink-0 transition-colors cursor-pointer"
            title="التبديل إلى عرض الجدول والورقة الرسمية"
          >
            {isForModal ? 'ورقة A4' : 'الجدول الكامل'}
          </button>
        </div>

        {/* 1. Header Information Card */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              {systemSettings?.company?.logoUrl ? (
                <img src={systemSettings.company.logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded-lg border border-slate-200 p-0.5" />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm">
                  {companyName?.charAt(0) || 'L'}
                </div>
              )}
              <div>
                <h3 className="font-black text-slate-900 text-sm">{companyName}</h3>
                <p className="text-[10px] text-slate-500">كشف حساب {partnerLabelAr} تفصيلي</p>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-lg font-mono font-black text-xs border ${
              statementCalculation.finalBalanceType === 'DEBIT'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : statementCalculation.finalBalanceType === 'CREDIT'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-slate-100 text-slate-800 border-slate-200'
            }`}>
              {finalBalText} {currencySymbol}
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-bold">اسم ال{partnerLabelAr}:</span>
              <span className="font-black text-slate-900 text-sm">{selectedPartner.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-bold">كود الحساب:</span>
              <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px]">{activeCode}</span>
            </div>
            {selectedPartner.phone && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">رقم الهاتف:</span>
                <span className="font-mono font-bold text-slate-800" dir="ltr">{selectedPartner.phone}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-bold">الفترة:</span>
              <span className="font-mono font-semibold text-slate-700 text-[11px]">
                {dateFrom || 'البداية'} ⟵ {dateTo || 'تاريخ اليوم'}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <span className="text-slate-500 font-bold">طبيعة الرصيد:</span>
              <span className="font-bold text-slate-900">{finalBalLabel}</span>
            </div>
          </div>
        </div>

        {/* 2. Quick Financial Cards Grid (2x2 on Mobile) */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 block mb-0.5">رصيد سابق</span>
            <div className="font-mono font-black text-sm text-slate-800">
              {statementCalculation.priorBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              <span className="text-[10px] font-normal text-slate-400 mr-1">{currencySymbol}</span>
            </div>
            <span className="text-[9px] text-slate-400 block mt-0.5">
              {statementCalculation.priorBalanceType === 'DEBIT' ? 'مدين (لنا)' : statementCalculation.priorBalanceType === 'CREDIT' ? 'دائن (له)' : 'متزن'}
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-blue-200 bg-blue-50/20 shadow-2xs">
            <span className="text-[10px] font-bold text-blue-700 block mb-0.5">إجمالي المدين (+)</span>
            <div className="font-mono font-black text-sm text-blue-950">
              {statementCalculation.totalDebitPeriod.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              <span className="text-[10px] font-normal text-blue-400 mr-1">{currencySymbol}</span>
            </div>
            <span className="text-[9px] text-blue-600 block mt-0.5">
              {isCust ? 'فواتير ومسحوبات' : 'سدادات للمورد'}
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-700 block mb-0.5">إجمالي الدائن (-)</span>
            <div className="font-mono font-black text-sm text-emerald-950">
              {statementCalculation.totalCreditPeriod.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              <span className="text-[10px] font-normal text-emerald-400 mr-1">{currencySymbol}</span>
            </div>
            <span className="text-[9px] text-emerald-600 block mt-0.5">
              {isCust ? 'سندات قبض' : 'فواتير وتوريدات'}
            </span>
          </div>

          <div className={`p-3 rounded-xl border-2 shadow-2xs ${
            statementCalculation.finalBalanceType === 'DEBIT'
              ? 'bg-rose-50 border-rose-300 text-rose-950'
              : statementCalculation.finalBalanceType === 'CREDIT'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-slate-50 border-slate-300 text-slate-900'
          }`}>
            <span className="text-[10px] font-bold block mb-0.5">الرصيد الختامي</span>
            <div className="font-mono font-black text-sm">
              {finalBalText}
              <span className="text-[10px] font-normal mr-1">{currencySymbol}</span>
            </div>
            <span className="text-[9px] font-bold block mt-0.5">
              {finalBalLabel}
            </span>
          </div>
        </div>

        {/* 3. Mobile Transaction Cards Feed */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs px-1 text-slate-500 font-bold">
            <span>سجل الحركات المالية ({statementCalculation.documentBlocks.length} مستند)</span>
            <span>مرتب تاريخياً</span>
          </div>

          {/* Prior balance card if exists */}
          {dateFrom && statementCalculation.priorBalance > 0 && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-bold text-[10px]">رصيد ما قبل الفترة</span>
                <span className="font-mono text-[11px] text-amber-800">{dateFrom}</span>
              </div>
              <p className="text-slate-800 font-medium text-xs mb-2">رصيد سابق منقول للفترة الحالية</p>
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-amber-200/60 font-mono">
                <span className="text-slate-500 text-[11px]">قيمة الرصيد المنقول:</span>
                <span className="font-black text-slate-900">
                  {statementCalculation.priorBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol}
                  <span className="text-[10px] font-sans mr-1 text-amber-800">({statementCalculation.priorBalanceType === 'DEBIT' ? 'مدين' : 'دائن'})</span>
                </span>
              </div>
            </div>
          )}

          {statementCalculation.documentBlocks.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-slate-400 border border-slate-200">
              لا توجد حركات مالية مسجلة في هذه الفترة
            </div>
          ) : (
            statementCalculation.documentBlocks.map((block, idx) => {
              const isMulti = Boolean(block.isMultiLine && block.lines && block.lines.length > 1);
              const isExpanded = expandedBlockIds[block.id] !== undefined ? expandedBlockIds[block.id] : expandAllBlocks;
              const balText = block.runningBalanceType === 'DEBIT' ? 'مدين' : block.runningBalanceType === 'CREDIT' ? 'دائن' : 'متزن';
              const balBadgeColor = block.runningBalanceType === 'DEBIT' 
                ? 'bg-rose-50 text-rose-800 border-rose-200' 
                : block.runningBalanceType === 'CREDIT' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-slate-100 text-slate-700 border-slate-200';

              const badgeColor = 
                block.docType === 'SALES_INVOICE' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                block.docType === 'PURCHASE_INVOICE' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                block.docType === 'RECEIPT_VOUCHER' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                block.docType === 'PAYMENT_VOUCHER' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                'bg-slate-100 text-slate-800 border-slate-200';

              const firstLineDesc = block.lines?.[0]?.description || block.docTypeLabel;

              return (
                <div key={block.id || idx} className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs hover:shadow-xs transition-shadow">
                  {/* Card Header: Type, DocNumber, Date & Quick View */}
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeColor}`}>
                        {block.docTypeLabel}
                      </span>
                      <span className="font-mono font-black text-slate-900 text-xs" dir="ltr">
                        {block.docNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-slate-500">{block.date}</span>
                      <button
                        type="button"
                        onClick={() => handleOpenViewer(block.id, block.docType, block.rawDoc)}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                        title="معاينة المستند"
                      >
                        <ExternalLink size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Statement / Description */}
                  <div className="text-slate-800 font-medium text-xs mb-3 leading-relaxed">
                    {isMulti ? (
                      <span>
                        {block.docTypeLabel} ({block.lines.length} أصناف)
                        {block.rawDoc?.notes ? ` - ${block.rawDoc.notes}` : ''}
                      </span>
                    ) : (
                      firstLineDesc
                    )}
                  </div>

                  {/* Financial Metrics Strip in Card */}
                  <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 flex items-center justify-between gap-2 text-xs font-mono">
                    <div>
                      {block.totalDebit > 0 ? (
                        <div>
                          <span className="text-[10px] text-slate-400 font-sans block">مدين (+)</span>
                          <span className="font-black text-rose-700 text-xs">
                            +{block.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ) : block.totalCredit > 0 ? (
                        <div>
                          <span className="text-[10px] text-slate-400 font-sans block">دائن (-)</span>
                          <span className="font-black text-emerald-700 text-xs">
                            -{block.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-[10px] text-slate-400 font-sans block">القيمة</span>
                          <span className="font-bold text-slate-800 text-xs">
                            {block.docTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="text-left border-r pr-3 border-slate-200">
                      <span className="text-[10px] text-slate-400 font-sans block">الرصيد بعد الحركة</span>
                      <div className="flex items-center gap-1 justify-end">
                        <span className="font-black text-slate-900 text-xs">
                          {block.runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`text-[9px] font-sans font-bold px-1.5 py-0.2 rounded border ${balBadgeColor}`}>
                          {balText}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Item Breakdown Accordion on Mobile */}
                  {isMulti && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => toggleBlockExpand(block.id)}
                        className="flex items-center justify-between w-full py-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        <span className="flex items-center gap-1">
                          <Layers size={13} />
                          <span>تفاصيل أصناف الفاتورة ({block.lines.length} أصناف - {block.totalQuantity} وحدة)</span>
                        </span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-1.5 bg-slate-50/70 p-2 rounded-lg border border-slate-200">
                          {block.lines.map((line, lIdx) => (
                            <div key={line.id || lIdx} className="bg-white p-2 rounded-md border border-slate-200 flex items-center justify-between gap-2 text-[11px]">
                              <div className="flex-1 truncate">
                                <span className="font-semibold text-slate-900 block truncate">{line.description}</span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {line.quantity} × {line.unitPrice?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  {line.taxAmount ? ` (ض: ${line.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })})` : ''}
                                </span>
                              </div>
                              <div className="font-mono font-bold text-slate-900 whitespace-nowrap text-xs">
                                {line.total.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 4. Comprehensive Totals & Reconciliation Card at Bottom */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 space-y-3.5 shadow-md">
          <h4 className="font-black text-sm text-slate-100 border-b border-slate-800 pb-2 flex items-center justify-between">
            <span>ملخص مطابقة الحساب النهائي</span>
            <span className="text-[10px] font-mono font-normal text-slate-400">
              {statementCalculation.documentBlocks.length} حركة مسجلة
            </span>
          </h4>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-400 font-sans">إجمالي المدين (+):</span>
              <span className="font-bold text-rose-300">
                {statementCalculation.totalDebitPeriod.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol}
              </span>
            </div>
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-400 font-sans">إجمالي الدائن (-):</span>
              <span className="font-bold text-emerald-300">
                {statementCalculation.totalCreditPeriod.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol}
              </span>
            </div>
            <div className="flex items-center justify-between font-mono pt-1 border-t border-slate-800">
              <span className="text-slate-400 font-sans">صافي حركة الفترة:</span>
              <span className="font-bold text-slate-200">
                {Math.abs(statementCalculation.netPeriodChange).toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol}
                <span className="text-[10px] font-sans mr-1 text-slate-400">
                  ({statementCalculation.netPeriodChange > 0 ? 'زيادة مدينة' : statementCalculation.netPeriodChange < 0 ? 'زيادة دائنة' : 'متزنة'})
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between font-mono pt-2 border-t-2 border-slate-800">
              <span className="text-white font-bold font-sans text-xs sm:text-sm">الرصيد الصافي المتبقي:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-amber-300 text-sm sm:text-base">
                  {finalBalText} {currencySymbol}
                </span>
                <span className={`text-[10px] font-sans font-bold px-2 py-0.5 rounded ${
                  statementCalculation.finalBalanceType === 'DEBIT' ? 'bg-rose-500 text-white' :
                  statementCalculation.finalBalanceType === 'CREDIT' ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-white'
                }`}>
                  {statementCalculation.finalBalanceType === 'DEBIT' ? 'مدين' : statementCalculation.finalBalanceType === 'CREDIT' ? 'دائن' : 'متزن'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 font-bold">
            <span className="text-slate-400">المبلغ كتابةً: </span>
            <span className="text-amber-300 font-mono">{cleanTafqeet(statementCalculation.finalBalance)}</span>
          </div>

          {/* 4 Official Signatures Grid */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[10px] text-center text-slate-300">
            <div className="border border-slate-800 rounded-lg p-2 bg-slate-950/40">
              <p className="font-bold text-slate-200">إعداد / المحاسب</p>
              <div className="h-6 border-b border-dashed border-slate-700 my-1"></div>
              <p className="text-[9px] text-slate-500">التوقيع والتاريخ</p>
            </div>
            <div className="border border-slate-800 rounded-lg p-2 bg-slate-950/40">
              <p className="font-bold text-slate-200">المدير المالي</p>
              <div className="h-6 border-b border-dashed border-slate-700 my-1"></div>
              <p className="text-[9px] text-slate-500">الاعتماد والتوقيع</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const isCustomer = selectedPartner?.type === 'CUSTOMER';

  return (
    <div className="flex flex-col flex-1 space-y-4 sm:space-y-6 pb-12 print:p-0 print:space-y-3" dir="rtl">
      {/* 1. Page Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1 text-slate-500">
            <span className="p-1 bg-amber-100 text-amber-800 rounded-lg shadow-2xs">
              <Layers size={18} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              الذمم المالية والحسابات الجارية
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            كشف حساب تفصيلي (نظام الكتل)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            عرض تفصيلي لبنود وأسطر كل فاتورة وسند قبض وصرف في كتل مستقلة مع مجاميع الكميات والأسعار والمطابقة المحاسبية.
          </p>
        </div>

        {/* Global Action & Export Buttons (3D tactile styling) */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-b from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-[0_4px_0_0_#064e3b,0_6px_10px_rgba(0,0,0,0.25)] hover:shadow-[0_5px_0_0_#064e3b,0_8px_12px_rgba(0,0,0,0.3)] active:shadow-[0_1px_0_0_#064e3b] active:translate-y-[3px] transition-all cursor-pointer min-h-[42px] border-t border-emerald-400/50"
            title="تصدير كشف الحساب التفصيلي مع تفاصيل الأصناف إلى Excel"
          >
            <FileSpreadsheet size={16} />
            <span>تصدير Excel</span>
          </button>

          <button
            type="button"
            onClick={handleOpenWhatsAppModal}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white rounded-xl text-xs sm:text-sm font-black shadow-[0_4px_0_0_#047857,0_6px_10px_rgba(0,0,0,0.25)] hover:shadow-[0_5px_0_0_#047857,0_8px_12px_rgba(0,0,0,0.3)] active:shadow-[0_1px_0_0_#047857] active:translate-y-[3px] transition-all cursor-pointer min-h-[42px] border-t border-emerald-300/50"
            title="مشاركة كشف الحساب والملخص المالي مباشرة عبر الواتساب"
          >
            <MessageSquare size={16} />
            <span>واتساب</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-b from-rose-600 to-rose-800 hover:from-rose-500 hover:to-rose-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-[0_4px_0_0_#881337,0_6px_10px_rgba(0,0,0,0.25)] hover:shadow-[0_5px_0_0_#881337,0_8px_12px_rgba(0,0,0,0.3)] active:shadow-[0_1px_0_0_#881337] active:translate-y-[3px] transition-all cursor-pointer min-h-[42px] border-t border-rose-400/50"
            title="تصدير كشف حساب رسمي معتمد بتنسيق PDF"
          >
            <FileText size={16} />
            <span>تصدير PDF</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
              setIsMobileScreen(isMobile);
              if (isMobile) {
                setPreviewDisplayMode('CARDS');
                setPreviewZoom(calculateModalFitZoom());
              } else {
                setPreviewDisplayMode('A4_SHEET');
                setPreviewZoom(100);
              }
              resetModalPan();
              setShowPrintModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-b from-slate-700 to-slate-900 hover:from-slate-600 hover:to-slate-800 text-white rounded-xl text-xs sm:text-sm font-black shadow-[0_4px_0_0_#0f172a,0_6px_10px_rgba(0,0,0,0.25)] hover:shadow-[0_5px_0_0_#0f172a,0_8px_12px_rgba(0,0,0,0.3)] active:shadow-[0_1px_0_0_#0f172a] active:translate-y-[3px] transition-all cursor-pointer min-h-[42px] border-t border-slate-500/50"
            title="طباعة كشف الحساب مع الترويسة والختم والباركود"
          >
            <Printer size={16} />
            <span>معاينة وطباعة</span>
          </button>

          <button
            type="button"
            onClick={() => setRefreshKey(prev => prev + 1)}
            className="p-3 bg-gradient-to-b from-slate-100 to-slate-200 hover:from-white hover:to-slate-150 text-slate-800 rounded-xl border border-slate-300 shadow-[0_4px_0_0_#94a3b8,0_6px_10px_rgba(0,0,0,0.15)] hover:shadow-[0_5px_0_0_#94a3b8] active:shadow-[0_1px_0_0_#94a3b8] active:translate-y-[3px] transition-all cursor-pointer min-h-[42px] border-t border-white"
            title="تحديث البيانات وإعادة احتساب الأرصدة"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Print-Only Header */}
      <div className="hidden print:block bg-white p-4 border-b-2 border-slate-800 mb-2">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black text-slate-900">{companyName}</h1>
            <h2 className="text-sm font-bold text-slate-700">كشف حساب تفصيلي - {isCustomer ? 'العميل' : 'المورد'}: {selectedPartner?.name}</h2>
            <p className="text-xs text-slate-500">
              الفترة: {dateFrom ? `من ${dateFrom}` : 'من البداية'} إلى {dateTo || 'تاريخ اليوم'} | الهاتف: {selectedPartner?.phone || '-'}
            </p>
          </div>
          <div className="text-left font-mono text-xs text-slate-600">
            <div>تاريخ الطباعة: {new Date().toISOString().split('T')[0]}</div>
            <div>كود الطرف: {selectedPartner?.code || selectedPartner?.id}</div>
          </div>
        </div>
      </div>

      {/* 2. Partner Selector Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Quick Partner Switcher / Dropdown with Action Button in the same line */}
          <div className="relative flex-1 w-full" ref={dropdownRef}>
            <div className="flex items-center gap-2">
              <div 
                onClick={() => setIsPartnerDropdownOpen(!isPartnerDropdownOpen)}
                className="flex-1 min-w-0 h-11 px-4 bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 hover:from-slate-50 hover:via-slate-150 hover:to-slate-250 border-2 border-slate-300 border-t-slate-200 border-b-slate-400 rounded-xl flex items-center justify-between text-xs text-right transition-all cursor-pointer shadow-[0_4px_0_0_#64748b,0_5px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_5px_0_0_#475569,0_7px_12px_rgba(0,0,0,0.16)] hover:-translate-y-0.5 active:shadow-[0_1px_0_0_#64748b] active:translate-y-[3px]"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={`px-2 py-0.5 text-[10px] font-black rounded-md border ${
                    isCustomer ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-amber-100 text-amber-800 border-amber-200'
                  }`}>
                    {isCustomer ? 'عميل' : 'مورد'}
                  </span>
                  <span className="font-black text-slate-900 text-sm truncate">
                    {selectedPartner ? selectedPartner.name : 'اختر العميل أو المورد...'}
                  </span>
                  {selectedPartner?.code && (
                    <span className="text-xs text-slate-600 font-mono font-bold">({selectedPartner.code})</span>
                  )}
                </div>
                <ChevronDown size={16} className={`text-slate-600 transition-transform ${isPartnerDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {/* زر عرض البيانات 3D في نفس سطر البحث عن العميل */}
              <button
                type="button"
                onClick={() => handleFetchPartnerData()}
                className="h-11 px-5 bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-[0_4px_0_0_#1e3a8a,0_6px_10px_rgba(0,0,0,0.2)] hover:shadow-[0_5px_0_0_#1e3a8a] active:shadow-[0_1px_0_0_#1e3a8a] active:translate-y-[3px] border-t border-blue-400/50 cursor-pointer shrink-0"
                title="عرض واستدعاء بيانات كشف الحساب للعميل المختار"
              >
                <Search size={14} />
                <span>عرض البيانات</span>
              </button>
            </div>

            {/* Dropdown Menu */}
            {isPartnerDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 overflow-hidden animate-fadeIn">
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                    <input
                      ref={partnerSearchInputRef}
                      type="text"
                      value={partnerSearchTerm}
                      onChange={(e) => setPartnerSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleFetchPartnerData();
                        }
                      }}
                      placeholder="ابحث بالاسم، الهاتف، الكود، أو السجل الضريبي..."
                      className="w-full pr-9 pl-3 py-2 text-xs bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 border-2 border-slate-300 border-t-slate-200 border-b-slate-400 rounded-xl font-black text-slate-900 placeholder-slate-600 shadow-[0_3px_0_0_#64748b] focus:bg-white focus:outline-hidden focus:border-slate-500 transition-all"
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFetchPartnerData()}
                    className="px-4 py-2 bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white rounded-xl text-xs font-black shrink-0 transition-all shadow-[0_3px_0_0_#1e3a8a] active:shadow-[0_1px_0_0_#1e3a8a] active:translate-y-[2px] border-t border-blue-400/40 cursor-pointer"
                  >
                    عرض
                  </button>
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                  {availablePartners.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400">
                      لا يوجد عميل أو مورد يطابق البحث
                    </div>
                  ) : (
                    availablePartners.map(p => {
                      const isSel = p.id === selectedPartnerId;
                      const isCust = p.type === 'CUSTOMER';
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedPartnerId(p.id);
                            setIsDataLoaded(false);
                            setIsPartnerDropdownOpen(false);
                            setPartnerSearchTerm('');
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-colors ${
                            isSel ? 'bg-blue-50/80 font-bold text-blue-900' : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isCust ? 'bg-blue-500' : 'bg-amber-500'}`} />
                            <span className="font-semibold">{p.name}</span>
                            {p.phone && <span className="text-[11px] text-slate-400 font-mono">({p.phone})</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              isCust ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {isCust ? 'عميل' : 'مورد'}
                            </span>
                            {isSel && <Check size={14} className="text-blue-600" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Left Aligned Customer/Vendor Profile Link (3D) */}
          {selectedPartner && (
            <button
              type="button"
              onClick={() => {
                if (onNavigate) {
                  onNavigate(isCustomer ? 'customers' : 'vendors');
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-b from-white to-blue-50 hover:from-blue-50 hover:to-blue-100 border-2 border-blue-200 text-xs text-blue-800 hover:text-blue-950 font-black flex items-center gap-1.5 transition-all shadow-[0_3px_0_0_#93c5fd] active:shadow-[0_1px_0_0_#93c5fd] active:translate-y-[2px] cursor-pointer shrink-0"
              title={`الانتقال إلى ملف ${isCustomer ? 'العميل' : 'المورد'}`}
            >
              <span>ملف {isCustomer ? 'العميل' : 'المورد'}</span>
              <ExternalLink size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 3. Advanced Filtering Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col gap-3.5 print:hidden">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Filter size={15} className="text-blue-600" />
            <span>فلترة حركات كشف الحساب التفصيلي</span>
          </div>

          {/* Quick Date Presets (3D styling) */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => applyDatePreset('ALL')}
              className={`px-3 py-1.5 rounded-xl font-black transition-all cursor-pointer ${
                !dateFrom && !dateTo 
                  ? 'bg-gradient-to-b from-blue-600 to-blue-800 text-white shadow-[0_3px_0_0_#1e3a8a,0_2px_4px_rgba(0,0,0,0.2)] border-t border-blue-400/40 active:translate-y-[2px]' 
                  : 'bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-700 border border-slate-300 shadow-[0_2px_0_0_#cbd5e1] active:translate-y-[1px]'
              }`}
            >
              كامل السجل
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('TODAY')}
              className="px-3 py-1.5 rounded-xl font-black bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-700 border border-slate-300 shadow-[0_2px_0_0_#cbd5e1] active:translate-y-[1px] transition-all cursor-pointer"
            >
              اليوم
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('WEEK')}
              className="px-3 py-1.5 rounded-xl font-black bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-700 border border-slate-300 shadow-[0_2px_0_0_#cbd5e1] active:translate-y-[1px] transition-all cursor-pointer"
            >
              آخر 7 أيام
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('MONTH')}
              className="px-3 py-1.5 rounded-xl font-black bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-700 border border-slate-300 shadow-[0_2px_0_0_#cbd5e1] active:translate-y-[1px] transition-all cursor-pointer"
            >
              هذا الشهر
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('QUARTER')}
              className="px-3 py-1.5 rounded-xl font-black bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-700 border border-slate-300 shadow-[0_2px_0_0_#cbd5e1] active:translate-y-[1px] transition-all cursor-pointer"
            >
              الربع الحالي
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('YEAR')}
              className="px-3 py-1.5 rounded-xl font-black bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-700 border border-slate-300 shadow-[0_2px_0_0_#cbd5e1] active:translate-y-[1px] transition-all cursor-pointer"
            >
              السنة المالية
            </button>
          </div>
        </div>

        {/* Filters Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Date From */}
          <div className="space-y-1">
            <label className="block text-xs font-black text-slate-800">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="text-slate-700" />
                <span>من تاريخ:</span>
              </span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-300 border-t-slate-200 border-b-slate-400 bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 text-xs font-mono font-black text-slate-900 shadow-[0_4px_0_0_#64748b,0_5px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_5px_0_0_#475569,0_7px_12px_rgba(0,0,0,0.16)] hover:-translate-y-0.5 focus:bg-white focus:outline-none focus:border-slate-500 focus:shadow-[0_2px_0_0_#64748b,inset_0_2px_4px_rgba(0,0,0,0.1)] focus:translate-y-[2px] transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Date To */}
          <div className="space-y-1">
            <label className="block text-xs font-black text-slate-800">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="text-slate-700" />
                <span>إلى تاريخ:</span>
              </span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-300 border-t-slate-200 border-b-slate-400 bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 text-xs font-mono font-black text-slate-900 shadow-[0_4px_0_0_#64748b,0_5px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_5px_0_0_#475569,0_7px_12px_rgba(0,0,0,0.16)] hover:-translate-y-0.5 focus:bg-white focus:outline-none focus:border-slate-500 focus:shadow-[0_2px_0_0_#64748b,inset_0_2px_4px_rgba(0,0,0,0.1)] focus:translate-y-[2px] transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Transaction Type Filter */}
          <div className="space-y-1">
            <label className="block text-xs font-black text-slate-800">
              نوع الحركة المالية:
            </label>
            <select
              value={txTypeFilter}
              onChange={(e) => setTxTypeFilter(e.target.value as any)}
              className="w-full h-11 px-3 bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 border-2 border-slate-300 border-t-slate-200 border-b-slate-400 rounded-xl font-black text-xs text-slate-900 shadow-[0_4px_0_0_#64748b,0_5px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_5px_0_0_#475569] focus:outline-none focus:bg-white focus:border-slate-500 transition-all cursor-pointer"
            >
              <option value="ALL">جميع أنواع الحركات</option>
              <option value="INVOICES">فواتير فقط (مبيعات / مشتريات)</option>
              <option value="RECEIPTS">سندات قبض فقط (تحصيل نقدية)</option>
              <option value="PAYMENTS">سندات صرف فقط (سداد ودفعات)</option>
              <option value="JOURNALS">قيود يومية وتسويات</option>
            </select>
          </div>

          {/* Posting Status Filter */}
          <div className="space-y-1">
            <label className="block text-xs font-black text-slate-800">
              حالة الترحيل:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full h-11 px-3 bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 border-2 border-slate-300 border-t-slate-200 border-b-slate-400 rounded-xl font-black text-xs text-slate-900 shadow-[0_4px_0_0_#64748b,0_5px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_5px_0_0_#475569] focus:outline-none focus:bg-white focus:border-slate-500 transition-all cursor-pointer"
            >
              <option value="ALL">جميع الحالات (مرحل ومسودة)</option>
              <option value="POSTED">مرحلة ومعتمدة فقط (بالحسابات)</option>
              <option value="DRAFT">مسودات فقط (غير مرحلة)</option>
            </select>
          </div>

          {/* Text Search (3D Gray) */}
          <div className="space-y-1">
            <label className="block text-xs font-black text-slate-800">
              بحث بالبيان أو رقم السند:
            </label>
            <div className="relative">
              <Search size={16} className="absolute right-3.5 top-3.5 text-slate-700 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="رقم الفاتورة، السند، الصنف..."
                className="w-full h-11 pr-10 pl-8 rounded-xl border-2 border-slate-300 border-t-slate-200 border-b-slate-400 bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 text-xs font-black text-slate-900 placeholder-slate-600 shadow-[0_4px_0_0_#64748b,0_5px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_5px_0_0_#475569,0_7px_12px_rgba(0,0,0,0.16)] hover:-translate-y-0.5 focus:bg-white focus:outline-none focus:border-slate-500 focus:shadow-[0_2px_0_0_#64748b,inset_0_2px_4px_rgba(0,0,0,0.1)] focus:translate-y-[2px] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-3 text-slate-500 hover:text-slate-800"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Filters Summary */}
        {(dateFrom || dateTo || txTypeFilter !== 'ALL' || statusFilter !== 'ALL' || searchQuery) && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-500 font-semibold">الفلاتر المطبقة:</span>
              {dateFrom && (
                <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded-md font-mono text-[11px]">
                  من: {dateFrom}
                </span>
              )}
              {dateTo && (
                <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded-md font-mono text-[11px]">
                  إلى: {dateTo}
                </span>
              )}
              {txTypeFilter !== 'ALL' && (
                <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md text-[11px] font-bold">
                  نوع: {txTypeFilter}
                </span>
              )}
              {statusFilter !== 'ALL' && (
                <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md text-[11px] font-bold">
                  حالة: {statusFilter === 'POSTED' ? 'مرحل' : 'مسودة'}
                </span>
              )}
              {searchQuery && (
                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px]">
                  بحث: «{searchQuery}»
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setTxTypeFilter('ALL');
                setStatusFilter('ALL');
                setSearchQuery('');
              }}
              className="text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 text-[11px] cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>إعادة ضبط الفلاتر</span>
            </button>
          </div>
        )}
      </div>

      {!isDataLoaded ? (
        /* Empty State Prompt: Only show data when clicking "عرض البيانات" */
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 sm:p-14 text-center shadow-xs">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-xs">
            <Search size={30} />
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-800 mb-2">
            يرجى الضغط على زر «عرض البيانات» لاستدعاء كشف الحساب
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
            تم تحديد {isCustomer ? 'العميل' : 'المورد'}: <span className="font-bold text-slate-800">{selectedPartner?.name || 'اختر من القائمة'}</span>. اضغط على زر عرض البيانات لتحميل الفواتير والسندات والأرصدة التفصيلية.
          </p>
          <button
            type="button"
            onClick={() => handleFetchPartnerData()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md hover:shadow-blue-500/25 cursor-pointer"
          >
            <Search size={16} />
            <span>عرض البيانات الآن</span>
          </button>
        </div>
      ) : (
        <>
          {/* 4. Financial KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 print:grid print:grid-cols-4">
        {/* Card 1: Prior Balance */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">رصيد ما قبل الفترة</span>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-100">
              {dateFrom ? `قبل ${dateFrom}` : 'افتتاحي'}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-lg sm:text-2xl font-black text-slate-800 font-mono">
              {statementCalculation.priorBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-500 font-bold">{currencySymbol}</span>
          </div>
          <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
            <span>طبيعة الرصيد:</span>
            <span className={`font-bold ${
              statementCalculation.priorBalanceType === 'DEBIT' ? 'text-blue-700' :
              statementCalculation.priorBalanceType === 'CREDIT' ? 'text-amber-700' : 'text-emerald-700'
            }`}>
              {statementCalculation.priorBalanceType === 'DEBIT' 
                ? (isCustomer ? 'مدين (مستحق لنا)' : 'مدين (دفعة مقدمة للمورد)')
                : statementCalculation.priorBalanceType === 'CREDIT' 
                ? (isCustomer ? 'دائن (دفعة مقدمة له)' : 'دائن (مستحق للمورد)') 
                : 'متزن'}
            </span>
          </div>
        </div>

        {/* Card 2: Total Debits */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-blue-200 bg-blue-50/20 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-900 mb-1">
            <span className="text-xs font-bold">إجمالي المدين (+)</span>
            <ArrowUpRight size={16} className="text-blue-600" />
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-lg sm:text-2xl font-black text-blue-900 font-mono">
              {statementCalculation.totalDebitPeriod.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-blue-700 font-bold">{currencySymbol}</span>
          </div>
          <div className="text-[11px] text-blue-800 font-medium">
            {isCustomer ? 'فواتير مبيعات ومسحوبات الفترة' : 'سدادات ومدفوعات مسددة للمورد'}
          </div>
        </div>

        {/* Card 3: Total Credits */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-900 mb-1">
            <span className="text-xs font-bold">إجمالي الدائن (-)</span>
            <ArrowDownLeft size={16} className="text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-lg sm:text-2xl font-black text-emerald-900 font-mono">
              {statementCalculation.totalCreditPeriod.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-emerald-700 font-bold">{currencySymbol}</span>
          </div>
          <div className="text-[11px] text-emerald-800 font-medium">
            {isCustomer ? 'سندات قبض وتحصيلات وسداد' : 'فواتير مشتريات وتوريدات الفترة'}
          </div>
        </div>

        {/* Card 4: Net Final Balance */}
        <div className={`p-3.5 sm:p-4 rounded-2xl border shadow-xs flex flex-col justify-between ${
          statementCalculation.finalBalanceType === 'DEBIT'
            ? 'bg-blue-950 text-white border-blue-900'
            : statementCalculation.finalBalanceType === 'CREDIT'
            ? 'bg-amber-950 text-white border-amber-900'
            : 'bg-emerald-950 text-white border-emerald-900'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-300">الرصيد الختامي الصافي</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
              statementCalculation.finalBalanceType === 'DEBIT' ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40' :
              statementCalculation.finalBalanceType === 'CREDIT' ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40' :
              'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
            }`}>
              {statementCalculation.finalBalanceType === 'DEBIT' ? (isCustomer ? 'عليه (مدين)' : 'له مسدد بالزيادة') :
               statementCalculation.finalBalanceType === 'CREDIT' ? (isCustomer ? 'له دفعة مقدمة' : 'له مستحق (دائن)') : 'رصيد متزن (صفر)'}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white">
              {statementCalculation.finalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-300 font-bold">{currencySymbol}</span>
          </div>
          <div className="text-[10px] text-slate-300 truncate" title={cleanTafqeet(statementCalculation.finalBalance)}>
            {cleanTafqeet(statementCalculation.finalBalance)}
          </div>
        </div>
      </div>

      {/* 5. Detailed Block Statement Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-300 overflow-hidden">
        {/* Table Top Controls Bar (Expand / Collapse All & Mobile Mode Toggle) */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-700">طريقة العرض:</span>
            {/* View Mode Toggle: Cards vs Table */}
            <div className="flex items-center bg-white border border-slate-300 rounded-xl p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setMainTableMode('CARDS')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  mainTableMode === 'CARDS'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="عرض ميسر على شكل بطاقات سهلة للموبايل والشاشات الصغيرة بدون سحب أفقي"
              >
                <Smartphone size={13} />
                <span>بطاقات ميسرة</span>
              </button>
              <button
                type="button"
                onClick={() => setMainTableMode('TABLE')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  mainTableMode === 'TABLE'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="عرض جدول محاسبي كامل بـ 11 عمود"
              >
                <LayoutGrid size={13} />
                <span>جدول كامل</span>
              </button>
            </div>

            {mainTableMode === 'TABLE' && (
              <button
                type="button"
                onClick={toggleExpandAll}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                {expandAllBlocks ? <ChevronUp size={14} className="text-blue-600" /> : <ChevronDown size={14} className="text-blue-600" />}
                <span>{expandAllBlocks ? 'طي تفاصيل أصناف الفواتير' : 'فرد تفاصيل أصناف الفواتير'}</span>
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-500 font-medium hidden sm:flex items-center gap-3">
            <span>عدد الحركات: <strong className="font-mono text-slate-800">{statementCalculation.documentBlocks.length}</strong></span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              <span>مدين (+)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <span>دائن (-)</span>
            </span>
          </div>
        </div>

        {mainTableMode === 'CARDS' ? (
          <div className="p-3 sm:p-5">
            {renderMobileStatementCards(false)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-right border-collapse border border-slate-300 text-xs">
            {/* Table Header */}
            <thead>
              <tr className="bg-slate-800 text-white font-black border-b-2 border-slate-900 text-xs select-none">
                <th className="py-3 px-3 w-28 whitespace-nowrap border border-slate-700 text-right">النوع</th>
                <th className="py-3 px-3 w-28 whitespace-nowrap border border-slate-700 text-right">رقم المستند</th>
                <th className="py-3 px-3 w-24 whitespace-nowrap border border-slate-700 text-right">التاريخ</th>
                <th className="py-3 px-3 min-w-[200px] border border-slate-700 text-right">البيان والشرح المحاسبي</th>
                <th className="py-3 px-2.5 w-16 text-center whitespace-nowrap border border-slate-700">كمية</th>
                <th className="py-3 px-3 w-24 text-left whitespace-nowrap border border-slate-700">سعر الوحدة</th>
                <th className="py-3 px-2.5 w-24 text-center whitespace-nowrap border border-slate-700 text-[11px]">الضريبة / الخصم</th>
                <th className="py-3 px-3 w-24 text-left whitespace-nowrap border border-slate-700">الإجمالي</th>
                <th className="py-3 px-3 w-28 text-left whitespace-nowrap border border-slate-700 text-rose-300">مدين (+)</th>
                <th className="py-3 px-3 w-28 text-left whitespace-nowrap border border-slate-700 text-emerald-300">دائن (-)</th>
                <th className="py-3 px-3.5 w-36 text-center whitespace-nowrap border border-slate-700 bg-slate-900 text-amber-300">الرصيد التراكمي</th>
                <th className="py-3 px-2 w-12 text-center whitespace-nowrap border border-slate-700 print:hidden">معاينة</th>
              </tr>
            </thead>

            {/* Prior Balance Block Row (if dateFrom specified and priorBalance > 0) */}
            {dateFrom && statementCalculation.priorBalance > 0 && (
              <tbody className="border-b-2 border-slate-300 bg-amber-50/60">
                <tr className="font-bold">
                  <td className="py-2.5 px-3 whitespace-nowrap border border-slate-300">
                    <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-bold text-[11px] border border-amber-300">
                      رصيد سابق
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap border border-slate-300 text-center" dir="ltr">-</td>
                  <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap border border-slate-300">{dateFrom}</td>
                  <td className="py-2.5 px-3 text-slate-800 font-semibold border border-slate-300">
                    رصيد ما قبل تاريخ {dateFrom} المنقول للفترة الحالية
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-400 border border-slate-300">-</td>
                  <td className="py-2.5 px-3 text-left text-slate-400 border border-slate-300">-</td>
                  <td className="py-2.5 px-3 text-center text-slate-400 border border-slate-300">-</td>
                  <td className="py-2.5 px-3 font-mono text-left font-bold text-slate-900 border border-slate-300">
                    {statementCalculation.priorBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-left font-black text-rose-700 border border-slate-300">
                    {statementCalculation.priorBalanceType === 'DEBIT' ? statementCalculation.priorBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-left font-black text-emerald-700 border border-slate-300">
                    {statementCalculation.priorBalanceType === 'CREDIT' ? statementCalculation.priorBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                  </td>
                  {/* Running Balance Column */}
                  <td className="py-2.5 px-3 font-mono text-center font-black text-slate-900 border border-slate-300 bg-amber-100/70">
                    <span>{statementCalculation.priorBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    <span className="text-[10px] mr-1 text-slate-600 font-bold">
                      ({statementCalculation.priorBalanceType === 'DEBIT' ? 'مدين' : statementCalculation.priorBalanceType === 'CREDIT' ? 'دائن' : 'متزن'})
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-center text-slate-300 border border-slate-300 print:hidden">-</td>
                </tr>
              </tbody>
            )}

            {/* Empty State */}
            {statementCalculation.documentBlocks.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400 border border-slate-300">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle size={28} className="text-slate-300" />
                      <p className="font-bold text-sm text-slate-600">لا توجد حركات مالية تطابق خيارات الفلترة المحددة</p>
                      <p className="text-xs text-slate-400">جرب توسيع نطاق التاريخ أو تغيير نوع الحركة لإظهار المزيد</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : (
              /* Render Document Blocks */
              statementCalculation.documentBlocks.map((block, bIdx) => {
                const isDraft = block.status === 'DRAFT';
                const isExpanded = expandedBlockIds[block.id] !== undefined ? expandedBlockIds[block.id] : expandAllBlocks;
                const isSelected = selectedBlockId === block.id;

                const badgeColor = 
                  block.docType === 'SALES_INVOICE' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                  block.docType === 'PURCHASE_INVOICE' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                  block.docType === 'RECEIPT_VOUCHER' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                  block.docType === 'PAYMENT_VOUCHER' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                  'bg-slate-100 text-slate-800 border-slate-200';

                const balBadgeClass = 
                  block.runningBalanceType === 'DEBIT' ? 'text-rose-700 bg-rose-50 border-rose-200' :
                  block.runningBalanceType === 'CREDIT' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                  'text-slate-600 bg-slate-50 border-slate-200';

                const balBadgeText = 
                  block.runningBalanceType === 'DEBIT' ? 'مدين' :
                  block.runningBalanceType === 'CREDIT' ? 'دائن' : 'متزن';

                // 1. SINGLE-LINE DOCUMENT (سندات القبض، سندات الصرف، قيود اليومية، أو فواتير الصنف الواحد)
                if (!block.isMultiLine) {
                  const line = block.lines[0] || {
                    typeLabel: block.docTypeLabel,
                    docNumber: block.docNumber,
                    date: block.date,
                    description: block.docTypeLabel,
                    quantity: null,
                    unitPrice: null,
                    total: block.docTotal
                  };

                  return (
                    <tbody 
                      key={block.id || `doc-block-${bIdx}`}
                      onClick={() => setSelectedBlockId(isSelected ? null : block.id)}
                      className={`group border-b border-slate-300 transition-all duration-200 cursor-pointer origin-center relative select-none ${
                        isSelected
                          ? 'scale-[1.018] -translate-y-0.5 z-30 shadow-2xl ring-2 ring-indigo-600 bg-indigo-50/95'
                          : 'hover:scale-[1.018] hover:-translate-y-0.5 hover:z-20 hover:shadow-xl hover:ring-2 hover:ring-indigo-400 hover:bg-white ' + (isDraft ? 'bg-amber-50/20' : 'bg-white')
                      }`}
                      title="انقر أو قف على الحركة لتكبيرها وتوضيح تفاصيلها"
                    >
                      <tr className={isDraft ? 'bg-amber-50/20' : ''}>
                        {/* 1. النوع */}
                        <td className="py-2.5 px-3 whitespace-nowrap border border-slate-300">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border transition-transform group-hover:scale-105 ${badgeColor}`}>
                            {block.docTypeLabel}
                            {isDraft && <span className="text-[9px] text-amber-700 font-normal">(مسودة)</span>}
                          </span>
                        </td>

                        {/* 2. رقم المستند */}
                        <td className="py-2.5 px-3 whitespace-nowrap border border-slate-300">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenViewer(block.id, block.docType, block.rawDoc);
                            }}
                            className="font-mono font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer flex items-center gap-1 group-hover:scale-105 transition-transform"
                            dir="ltr"
                            title="عرض تفاصيل المستند الأصلي"
                          >
                            <span>{block.docNumber}</span>
                          </button>
                        </td>

                        {/* 3. التاريخ */}
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-700 whitespace-nowrap border border-slate-300 group-hover:text-slate-900 group-hover:scale-105 transition-all">
                          {block.date}
                        </td>

                        {/* 4. البيان والشرح */}
                        <td className="py-2.5 px-3 text-slate-800 border border-slate-300">
                          <div className="font-bold text-slate-900 group-hover:text-slate-950 text-xs sm:text-[13px] leading-snug transition-colors">
                            {line.description}
                          </div>
                        </td>

                        {/* 5. كمية */}
                        <td className="py-2.5 px-2 text-center font-mono text-slate-700 border border-slate-300 group-hover:font-black transition-all">
                          {line.quantity !== null && line.quantity !== undefined ? line.quantity.toLocaleString('en-US') : '-'}
                        </td>

                        {/* 6. سعر الوحدة */}
                        <td className="py-2.5 px-3 font-mono text-left text-slate-700 border border-slate-300 group-hover:font-black transition-all">
                          {line.unitPrice !== null && line.unitPrice !== undefined ? line.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                        </td>

                        {/* 7. الضريبة / الخصم */}
                        <td className="py-2.5 px-2 text-center text-slate-400 border border-slate-300 text-[11px]">
                          {block.taxAmount > 0 ? (
                            <span className="text-amber-700 font-semibold">ض.ق.م ({block.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })})</span>
                          ) : '-'}
                        </td>

                        {/* 8. الإجمالي */}
                        <td className="py-2.5 px-3 font-mono text-left font-bold text-slate-900 whitespace-nowrap border border-slate-300">
                          <span className="group-hover:scale-110 group-hover:font-black inline-block transition-transform">
                            {block.docTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* 9. مدين (+) */}
                        <td className="py-2.5 px-3 font-mono text-left font-black text-rose-700 whitespace-nowrap border border-slate-300">
                          {block.totalDebit > 0 ? (
                            <span className="group-hover:text-sm group-hover:scale-115 inline-block transition-transform">
                              {block.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          ) : '-'}
                        </td>

                        {/* 10. دائن (-) */}
                        <td className="py-2.5 px-3 font-mono text-left font-black text-emerald-700 whitespace-nowrap border border-slate-300">
                          {block.totalCredit > 0 ? (
                            <span className="group-hover:text-sm group-hover:scale-115 inline-block transition-transform">
                              {block.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          ) : '-'}
                        </td>

                        {/* 11. الرصيد التراكمي */}
                        <td className="py-2.5 px-3 font-mono text-center font-black text-slate-900 border border-slate-300 bg-slate-50">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <span className="group-hover:scale-110 inline-block transition-transform">
                              {block.runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded border font-bold ${balBadgeClass}`}>
                              {balBadgeText}
                            </span>
                          </div>
                        </td>

                        {/* 12. زر المعاينة السريعة */}
                        <td className="py-2.5 px-2 text-center border border-slate-300 print:hidden">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenViewer(block.id, block.docType, block.rawDoc);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                            title="معاينة المستند"
                          >
                            <ExternalLink size={13} />
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  );
                }

                // 2. MULTI-ITEM INVOICE (فواتير متعددة الأصناف: الأصناف أولاً ثم إجمالي الفاتورة أسفل الأصناف)
                return (
                  <tbody 
                    key={block.id || `doc-block-${bIdx}`}
                    className="border-b-2 border-slate-400 bg-white"
                  >
                    {/* 1. Master Invoice Opening Header Row */}
                    <tr 
                      onClick={() => setSelectedBlockId(isSelected ? null : block.id)}
                      className={`group cursor-pointer font-bold text-slate-900 border-t border-slate-300 transition-all duration-200 origin-center relative select-none ${
                        isSelected
                          ? 'scale-[1.018] -translate-y-0.5 z-30 shadow-2xl ring-2 ring-indigo-600 bg-indigo-50/95'
                          : 'hover:scale-[1.018] hover:-translate-y-0.5 hover:z-20 hover:shadow-xl hover:ring-2 hover:ring-indigo-400 hover:bg-white bg-slate-100/90'
                      }`}
                      title="انقر أو قف على الفاتورة لتكبيرها وتوضيح تفاصيلها"
                    >
                      {/* 1. النوع مع زر الطي/الفرد */}
                      <td className="py-2.5 px-3 whitespace-nowrap border border-slate-300">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBlockExpand(block.id);
                            }}
                            className="p-0.5 rounded text-slate-500 hover:text-blue-700 hover:bg-white transition-colors cursor-pointer"
                            title={isExpanded ? 'طي بنود الفاتورة' : 'عرض تفاصيل الأصناف'}
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border transition-transform group-hover:scale-105 ${badgeColor}`}>
                            {block.docTypeLabel}
                          </span>
                        </div>
                      </td>

                      {/* 2. رقم الفاتورة */}
                      <td className="py-2.5 px-3 whitespace-nowrap border border-slate-300">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenViewer(block.id, block.docType, block.rawDoc);
                          }}
                          className="font-mono font-black text-blue-700 hover:text-blue-900 hover:underline cursor-pointer group-hover:scale-105 transition-transform"
                          dir="ltr"
                          title="عرض الفاتورة الأصلية"
                        >
                          {block.docNumber}
                        </button>
                      </td>

                      {/* 3. التاريخ */}
                      <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap border border-slate-300 group-hover:scale-105 transition-all">
                        {block.date}
                      </td>

                      {/* 4. البيان التمهيدي للفاتورة */}
                      <td className="py-2.5 px-3 text-slate-900 font-black border border-slate-300" colSpan={isExpanded ? 8 : 1}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-bold text-slate-950 group-hover:text-black group-hover:text-sm transition-all">
                            {block.docTypeLabel} ({block.lines.length} أصناف)
                            {block.rawDoc?.notes ? ` - ${block.rawDoc.notes}` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBlockExpand(block.id);
                            }}
                            className="text-[10px] text-blue-700 hover:underline font-bold cursor-pointer print:hidden"
                          >
                            {isExpanded ? 'طي تفاصيل الأصناف' : `عرض ${block.lines.length} أصناف`}
                          </button>
                        </div>
                      </td>

                      {/* If collapsed, show totals on the same line */}
                      {!isExpanded && (
                        <>
                          <td className="py-2.5 px-2 text-center font-mono font-black text-slate-900 border border-slate-300">
                            {block.totalQuantity > 0 ? block.totalQuantity.toLocaleString('en-US') : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-400 border border-slate-300">-</td>
                          <td className="py-2.5 px-2 text-center border border-slate-300 text-[10px] leading-tight">
                            {block.taxAmount > 0 && (
                              <div className="text-amber-800 font-bold">
                                ض: {block.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </div>
                            )}
                            {block.discountAmount > 0 && (
                              <div className="text-emerald-800 font-bold">
                                خصم: {block.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </div>
                            )}
                            {block.taxAmount === 0 && block.discountAmount === 0 && (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-left font-black text-slate-900 whitespace-nowrap border border-slate-300">
                            <span className="group-hover:scale-110 inline-block transition-transform">
                              {block.docTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-left font-black text-rose-700 whitespace-nowrap text-sm border border-slate-300">
                            {block.totalDebit > 0 ? (
                              <span className="group-hover:scale-115 inline-block transition-transform">
                                {block.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-left font-black text-emerald-700 whitespace-nowrap text-sm border border-slate-300">
                            {block.totalCredit > 0 ? (
                              <span className="group-hover:scale-115 inline-block transition-transform">
                                {block.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-center font-black text-slate-900 border border-slate-300 bg-slate-200/70">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <span className="group-hover:scale-110 inline-block transition-transform">
                                {block.runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded border font-bold ${balBadgeClass}`}>
                                {balBadgeText}
                              </span>
                            </div>
                          </td>
                        </>
                      )}

                      {/* زر المعاينة */}
                      <td className="py-2.5 px-2 text-center border border-slate-300 print:hidden">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenViewer(block.id, block.docType, block.rawDoc);
                          }}
                          className="p-1 text-slate-500 hover:text-blue-700 hover:bg-white rounded transition-colors cursor-pointer"
                          title="معاينة الفاتورة"
                        >
                          <ExternalLink size={13} />
                        </button>
                      </td>
                    </tr>

                    {/* 2. Child Item Detail Lines (تظهر في الوسط عند فرد الفاتورة) */}
                    {isExpanded && block.lines.map((line, lIdx) => (
                      <tr 
                        key={line.id || `b-${bIdx}-l-${lIdx}`}
                        className="bg-slate-50/70 hover:bg-slate-100/80 text-slate-700 border-b border-slate-200 text-xs transition-colors"
                      >
                        {/* 1. مسافة تابعة */}
                        <td className="py-1.5 px-3 text-center text-slate-400 border border-slate-200 text-[10px]">
                          <span className="text-slate-400">بند #{lIdx + 1}</span>
                        </td>

                        {/* 2. رقم المستند */}
                        <td className="py-1.5 px-3 font-mono text-slate-400 border border-slate-200 text-[11px]" dir="ltr">
                          ↳ {block.docNumber}
                        </td>

                        {/* 3. التاريخ */}
                        <td className="py-1.5 px-3 font-mono text-slate-400 border border-slate-200 text-[11px]">
                          {line.date}
                        </td>

                        {/* 4. اسم الصنف التفصيلي مع إزاحة */}
                        <td className="py-1.5 pr-6 pl-3 text-slate-900 border border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 select-none">↳</span>
                            <span className="font-semibold">{line.description}</span>
                          </div>
                        </td>

                        {/* 5. الكمية */}
                        <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-800 border border-slate-200">
                          {line.quantity !== null && line.quantity !== undefined ? line.quantity.toLocaleString('en-US') : '-'}
                        </td>

                        {/* 6. سعر الوحدة قبل الضريبة */}
                        <td className="py-1.5 px-3 font-mono text-left text-slate-800 border border-slate-200">
                          {line.unitPrice !== null && line.unitPrice !== undefined ? line.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                        </td>

                        {/* 7. ضريبة الصنف */}
                        <td className="py-1.5 px-2 text-center text-slate-500 border border-slate-200 text-[11px]">
                          {line.taxAmount ? `+${line.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} (15%)` : 'معفى'}
                        </td>

                        {/* 8. إجمالي الصنف */}
                        <td className="py-1.5 px-3 font-mono text-left font-bold text-slate-900 border border-slate-200">
                          {line.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        {/* 9, 10, 11: فارغة في أسطر الأصناف الفرعية */}
                        <td className="py-1.5 px-3 text-center text-slate-300 border border-slate-200">-</td>
                        <td className="py-1.5 px-3 text-center text-slate-300 border border-slate-200">-</td>
                        <td className="py-1.5 px-3 text-center text-slate-300 border border-slate-200 bg-slate-50/40">-</td>
                        <td className="py-1.5 px-2 text-center text-slate-300 border border-slate-200 print:hidden">-</td>
                      </tr>
                    ))}

                    {/* 3. Closing Totals Row (أسفل الأصناف كما طلب المستخدم تماماً) */}
                    {isExpanded && (
                      <tr className="bg-slate-200/90 hover:bg-slate-300/80 font-black text-slate-900 border-t-2 border-slate-400 border-b border-slate-300 transition-colors">
                        {/* 1. النوع: إجمالي الفاتورة */}
                        <td className="py-2.5 px-3 whitespace-nowrap border border-slate-300 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-slate-900 text-white shadow-2xs">
                            إجمالي الفاتورة
                          </span>
                        </td>

                        {/* 2. رقم الفاتورة */}
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-black border border-slate-300 text-right text-blue-950" dir="ltr">
                          {block.docNumber}
                        </td>

                        {/* 3. التاريخ */}
                        <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap border border-slate-300">
                          {block.date}
                        </td>

                        {/* 4. البيان */}
                        <td className="py-2.5 px-3 text-slate-950 font-black border border-slate-300">
                          <span className="font-black text-slate-950">
                            مجموع {block.docTypeLabel} ({block.lines.length} أصناف)
                          </span>
                        </td>

                        {/* 5. مجموع الكميات */}
                        <td className="py-2.5 px-2 text-center font-mono font-black text-slate-950 border border-slate-300 bg-amber-50/70">
                          <span className="px-1.5 py-0.5 rounded border border-amber-300 bg-amber-100 text-amber-950 text-[11px]">
                            {block.totalQuantity > 0 ? block.totalQuantity.toLocaleString('en-US') : '-'}
                          </span>
                        </td>

                        {/* 6. سعر الوحدة */}
                        <td className="py-2.5 px-3 text-center text-slate-400 border border-slate-300">-</td>

                        {/* 7. الضريبة والخصم */}
                        <td className="py-2.5 px-2 text-center border border-slate-300 text-[10px] leading-tight bg-slate-100/50">
                          {block.taxAmount > 0 && (
                            <div className="text-amber-900 font-black">
                              ض: {block.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                          )}
                          {block.discountAmount > 0 && (
                            <div className="text-emerald-900 font-black">
                              خصم: {block.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                          )}
                          {block.taxAmount === 0 && block.discountAmount === 0 && (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* 8. إجمالي الفاتورة النهائي */}
                        <td className="py-2.5 px-3 font-mono text-left font-black text-slate-950 whitespace-nowrap border border-slate-300 bg-blue-50/70">
                          <span className="px-1.5 py-0.5 rounded border border-blue-300 bg-blue-100 text-blue-950">
                            {block.docTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* 9. مدين (+) */}
                        <td className="py-2.5 px-3 font-mono text-left font-black text-rose-700 whitespace-nowrap text-sm border border-slate-300 bg-rose-50/50">
                          {block.totalDebit > 0 ? block.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                        </td>

                        {/* 10. دائن (-) */}
                        <td className="py-2.5 px-3 font-mono text-left font-black text-emerald-700 whitespace-nowrap text-sm border border-slate-300 bg-emerald-50/50">
                          {block.totalCredit > 0 ? block.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                        </td>

                        {/* 11. الرصيد التراكمي */}
                        <td className="py-2.5 px-3 font-mono text-center font-black text-slate-900 border border-slate-300 bg-slate-200/90">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <span className="font-black text-slate-950">{block.runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded border font-bold ${balBadgeClass}`}>
                              {balBadgeText}
                            </span>
                          </div>
                        </td>

                        {/* 12. زر المعاينة */}
                        <td className="py-2.5 px-2 text-center border border-slate-300 print:hidden">
                          <button
                            type="button"
                            onClick={() => handleOpenViewer(block.id, block.docType, block.rawDoc)}
                            className="p-1 text-slate-600 hover:text-blue-700 hover:bg-white rounded transition-colors cursor-pointer"
                            title="معاينة الفاتورة"
                          >
                            <ExternalLink size={13} />
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })
            )}

            {/* Grand Totals Table Footer */}
            {statementCalculation.documentBlocks.length > 0 && (
              <tfoot>
                {/* 1. Column-Aligned Totals Row */}
                <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-950 text-xs">
                  <td colSpan={4} className="py-3 px-4 text-slate-100 border border-slate-800">
                    الإجمالي العام لكشف الحساب ({statementCalculation.documentBlocks.length} مستند)
                  </td>
                  <td className="py-3 px-2 text-center font-mono font-black text-white text-sm whitespace-nowrap border border-slate-800">
                    {statementCalculation.totalQuantityPeriod > 0 ? statementCalculation.totalQuantityPeriod.toLocaleString('en-US') : '-'}
                  </td>
                  <td className="py-3 px-3 text-center text-slate-400 border border-slate-800">-</td>
                  <td className="py-3 px-2 text-center text-slate-400 border border-slate-800">-</td>
                  <td className="py-3 px-3 text-center text-slate-400 border border-slate-800">-</td>
                  <td className="py-3 px-3 font-mono text-left text-rose-300 text-sm whitespace-nowrap font-black border border-slate-800">
                    {statementCalculation.totalDebitPeriod.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 font-mono text-left text-emerald-300 text-sm whitespace-nowrap font-black border border-slate-800">
                    {statementCalculation.totalCreditPeriod.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  {/* Final Running Balance in Footer */}
                  <td className="py-3 px-3 font-mono text-center text-amber-300 text-sm whitespace-nowrap font-black border border-slate-800 bg-black">
                    <div className="flex flex-col items-center justify-center">
                      <span>{statementCalculation.finalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      <span className="text-[10px] text-amber-400 font-bold mt-0.5">
                        ({statementCalculation.finalBalanceType === 'DEBIT' ? 'صافي مدين' : statementCalculation.finalBalanceType === 'CREDIT' ? 'صافي دائن' : 'حساب متزن'})
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center text-slate-400 border border-slate-800 print:hidden">-</td>
                </tr>

                {/* 2. Comprehensive Financial Totals & Balance Reconciliation Footer Row */}
                <tr className="bg-slate-950 text-white border-t-2 border-slate-800">
                  <td colSpan={12} className="p-4 sm:p-5 border border-slate-800">
                    <div className="flex flex-col gap-4">
                      {/* Financial Metrics Cards Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        {/* 1. إجمالي المدين */}
                        <div className="bg-slate-900/90 border border-blue-500/40 rounded-xl p-3 flex flex-col justify-between shadow-xs">
                          <div className="flex items-center justify-between text-blue-300 mb-1">
                            <span className="font-bold text-[11px]">إجمالي المدين (+)</span>
                            <ArrowUpRight size={15} className="text-blue-400" />
                          </div>
                          <div className="font-mono font-black text-base sm:text-lg text-white my-0.5">
                            {statementCalculation.totalDebitPeriod.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            <span className="text-xs text-blue-300 font-normal mr-1">{currencySymbol}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {isCustomer ? 'فواتير ومسحوبات الفترة' : 'سدادات ومدفوعات للمورد'}
                          </span>
                        </div>

                        {/* 2. إجمالي الدائن */}
                        <div className="bg-slate-900/90 border border-emerald-500/40 rounded-xl p-3 flex flex-col justify-between shadow-xs">
                          <div className="flex items-center justify-between text-emerald-300 mb-1">
                            <span className="font-bold text-[11px]">إجمالي الدائن (-)</span>
                            <ArrowDownLeft size={15} className="text-emerald-400" />
                          </div>
                          <div className="font-mono font-black text-base sm:text-lg text-white my-0.5">
                            {statementCalculation.totalCreditPeriod.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            <span className="text-xs text-emerald-300 font-normal mr-1">{currencySymbol}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {isCustomer ? 'سندات قبض وتحصيلات' : 'فواتير وتوريدات الفترة'}
                          </span>
                        </div>

                        {/* 3. صافي الحركة */}
                        <div className="bg-slate-900/90 border border-indigo-500/40 rounded-xl p-3 flex flex-col justify-between shadow-xs">
                          <div className="flex items-center justify-between text-indigo-300 mb-1">
                            <span className="font-bold text-[11px]">صافي حركة الفترة</span>
                            <Scale size={15} className="text-indigo-400" />
                          </div>
                          <div className="font-mono font-black text-base sm:text-lg text-white my-0.5">
                            {Math.abs(statementCalculation.netPeriodChange).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            <span className="text-xs text-indigo-300 font-normal mr-1">{currencySymbol}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                              statementCalculation.netPeriodChange > 0 
                                ? 'bg-blue-900/60 text-blue-200 border-blue-600'
                                : statementCalculation.netPeriodChange < 0 
                                ? 'bg-emerald-900/60 text-emerald-200 border-emerald-600'
                                : 'bg-slate-800 text-slate-300 border-slate-600'
                            }`}>
                              {statementCalculation.netPeriodChange > 0 
                                ? '▲ حركة مدينة (+)' 
                                : statementCalculation.netPeriodChange < 0 
                                ? '▼ حركة دائنة (-)' 
                                : '• حركة متوازنة (0.00)'}
                            </span>
                          </div>
                        </div>

                        {/* 4. المتبقي الصافي النهائي والشارة التوضيحية */}
                        <div className={`rounded-xl p-3 flex flex-col justify-between shadow-sm border-2 ${
                          statementCalculation.finalBalanceType === 'DEBIT'
                            ? 'bg-rose-950/70 border-rose-500 text-rose-100'
                            : statementCalculation.finalBalanceType === 'CREDIT'
                            ? 'bg-emerald-950/70 border-emerald-500 text-emerald-100'
                            : 'bg-slate-800 border-slate-600 text-slate-100'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-[11px]">المتبقي الصافي النهائي</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border shadow-2xs ${
                              statementCalculation.finalBalanceType === 'DEBIT'
                                ? 'bg-rose-500 text-white border-rose-400'
                                : statementCalculation.finalBalanceType === 'CREDIT'
                                ? 'bg-emerald-500 text-white border-emerald-400'
                                : 'bg-slate-600 text-white border-slate-500'
                            }`}>
                              {statementCalculation.finalBalanceType === 'DEBIT'
                                ? 'مدين'
                                : statementCalculation.finalBalanceType === 'CREDIT'
                                ? 'دائن'
                                : 'متزن'}
                            </span>
                          </div>
                          <div className="font-mono font-black text-lg sm:text-xl text-white my-0.5">
                            {Math.abs(statementCalculation.finalBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            <span className="text-xs font-bold mr-1">{currencySymbol}</span>
                          </div>
                          <span className="text-[10px] font-bold text-amber-300">
                            {statementCalculation.finalBalanceType === 'DEBIT'
                              ? (isCustomer ? 'مستحق لنا في ذمة العميل' : 'دفعة مسددة للمورد بالزيادة')
                              : statementCalculation.finalBalanceType === 'CREDIT'
                              ? (isCustomer ? 'دفعة مقدمة مسجلة للعميل' : 'مستحق للمورد واجب السداد')
                              : 'الحساب مطابق تماماً ومتزن'}
                          </span>
                        </div>
                      </div>

                      {/* Financial Text Statement Banner (نص المتبقي الصافي بخط عريض وشارة توضيحية) */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-black text-slate-200 text-xs sm:text-sm">
                            الرصيد الصافي المتبقي:
                          </span>
                          <span className="font-mono font-black text-sm sm:text-base text-amber-300 bg-black/60 px-3 py-1 rounded-lg border border-slate-700">
                            {Math.abs(statementCalculation.finalBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol}
                          </span>
                          <span className={`px-3 py-1 rounded-lg font-black text-xs border flex items-center gap-1.5 ${
                            statementCalculation.finalBalanceType === 'DEBIT'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                              : statementCalculation.finalBalanceType === 'CREDIT'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                              : 'bg-slate-700 text-slate-200 border-slate-600'
                          }`}>
                            <span className={`w-2.5 h-2.5 rounded-full ${
                              statementCalculation.finalBalanceType === 'DEBIT' ? 'bg-rose-400' :
                              statementCalculation.finalBalanceType === 'CREDIT' ? 'bg-emerald-400' : 'bg-slate-400'
                            }`}></span>
                            <span>
                              {statementCalculation.finalBalanceType === 'DEBIT'
                                ? `رصيد مدين (${isCustomer ? 'مستحق السداد لصالحنا في ذمة العميل' : 'دفعة مسددة للمورد بالزيادة'})`
                                : statementCalculation.finalBalanceType === 'CREDIT'
                                ? `رصيد دائن (${isCustomer ? 'دفعة مقدمة مسجلة لصالح العميل' : 'مستحق السداد لصالح المورد'})`
                                : 'حساب متزن ومطابق (0.00)'}
                            </span>
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-300 font-bold bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 max-w-xl truncate" title={cleanTafqeet(statementCalculation.finalBalance)}>
                          <span>المبلغ كتابةً: </span>
                          <span className="text-white font-mono">{cleanTafqeet(statementCalculation.finalBalance)}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* 6. Dedicated High-Fidelity Pre-Print Preview Modal - Mobile & Desktop Optimized */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center z-50 p-1 sm:p-5 animate-in fade-in duration-150">
          <div className={`bg-white rounded-2xl sm:rounded-3xl w-full max-h-[96vh] sm:max-h-[94vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 transition-all ${
            printOrientation === 'LANDSCAPE' ? 'max-w-[96vw]' : 'max-w-5xl'
          }`}>
            {/* Modal Top Header Bar */}
            <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-100 shrink-0 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Printer size={18} className="text-blue-700 shrink-0" />
                  <div className="truncate">
                    <h3 className="font-black text-slate-900 text-xs sm:text-base leading-tight truncate">
                      معاينة كشف الحساب
                      <span className="hidden sm:inline font-normal text-slate-500 text-xs mr-1">
                        ({statementDetailLevel === 'DETAILED' ? 'تفصيلي 11 عمود' : 'مالي 9 أعمدة'} {includeItemsInPrint ? '• مع الأصناف' : '• إجمالي'} - {printOrientation === 'LANDSCAPE' ? 'أفقي' : 'طولي'})
                      </span>
                    </h3>
                  </div>
                </div>

                {/* Primary Mode Toggle & Page Count Badge */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Estimated Page Count Badge */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-300 rounded-xl shadow-2xs text-xs font-bold text-slate-800" title="عدد صفحات A4 المتوقعة عند الطباعة أو تصدير PDF">
                    <Layers size={13} className="text-blue-600 shrink-0" />
                    <span className="text-slate-500 font-normal hidden md:inline">عدد الصفحات:</span>
                    <span className="font-black text-blue-700 font-mono">
                      {estimatedPages} {estimatedPages === 1 ? 'صفحة' : estimatedPages === 2 ? 'صفحتان' : estimatedPages >= 3 && estimatedPages <= 10 ? 'صفحات' : 'صفحة'} A4
                    </span>
                  </div>

                  <div className="flex items-center bg-white border border-slate-300 rounded-xl p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setPreviewDisplayMode('CARDS')}
                      className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        previewDisplayMode === 'CARDS'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                      title="عرض ميسر على شكل بطاقات سهلة للموبايل والشاشات الصغيرة بدون سحب أفقي"
                    >
                      <Smartphone size={13} />
                      <span className="inline">بطاقات الجوال</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDisplayMode('ALL_PAGES')}
                      className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        previewDisplayMode === 'ALL_PAGES'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                      title="عرض جميع صفحات كشف الحساب الرسمية متتالية A4 (مطابقة للطباعة)"
                    >
                      <Layers size={13} />
                      <span className="inline">معاينة الورقة الرسمية (A4)</span>
                    </button>
                  </div>

                  {/* Settings toggle button on mobile */}
                  <button
                    type="button"
                    onClick={() => setShowMobileOptions(!showMobileOptions)}
                    className={`p-1.5 rounded-xl border transition-colors cursor-pointer sm:hidden ${
                      showMobileOptions ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-white text-slate-700 border-slate-300'
                    }`}
                    title="خيارات الطباعة والألوان"
                  >
                    <SlidersHorizontal size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPrintModal(false)}
                    className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
                    title="إغلاق المعاينة"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Collapsible / Responsive Options Bar */}
              <div className={`${showMobileOptions ? 'flex' : 'hidden sm:flex'} flex-wrap items-center justify-between gap-2 pt-1.5 border-t sm:border-t-0 border-slate-200/80`}>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs">
                  {/* Detail Level Toggle */}
                  <div className="flex items-center bg-white border border-slate-300 rounded-xl p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => {
                        setStatementDetailLevel('DETAILED');
                        setPrintOrientation('LANDSCAPE');
                        setIncludeItemsInPrint(true);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        statementDetailLevel === 'DETAILED'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <LayoutGrid size={12} />
                      <span>تفصيلي 11 عمود</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStatementDetailLevel('SUMMARY');
                        setPrintOrientation('PORTRAIT');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        statementDetailLevel === 'SUMMARY'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <List size={12} />
                      <span>مالي 9 أعمدة</span>
                    </button>
                  </div>

                  {/* Orientation Toggle */}
                  <div className="flex items-center bg-white border border-slate-300 rounded-xl p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setPrintOrientation('PORTRAIT')}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        printOrientation === 'PORTRAIT'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      طولي
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintOrientation('LANDSCAPE')}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        printOrientation === 'LANDSCAPE'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      بعرض الورقة
                    </button>
                  </div>

                  {/* Color Mode Toggle */}
                  <div className="flex items-center bg-white border border-slate-300 rounded-xl p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setStatementColorMode('COLOR')}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        statementColorMode === 'COLOR'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      ألوان
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatementColorMode('BW')}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        statementColorMode === 'BW'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      أبيض/أسود
                    </button>
                  </div>

                  {/* Include Items Checkbox (available for both 11-column and 9-column formats) */}
                  <label 
                    className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-xl cursor-pointer select-none shadow-2xs transition-all border ${
                      includeItemsInPrint 
                        ? 'bg-blue-50 text-blue-900 border-blue-300' 
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                    title={statementDetailLevel === 'SUMMARY' ? 'عرض أصناف وبنود كل فاتورة في أسطر تفصيلية بالجدول المالي 9 أعمدة' : 'عرض أصناف وبنود الفواتير في أسطر تفصيلية'}
                  >
                    <input
                      type="checkbox"
                      checked={includeItemsInPrint}
                      onChange={(e) => setIncludeItemsInPrint(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="flex items-center gap-1">
                      <Package size={12} className={includeItemsInPrint ? 'text-blue-600' : 'text-slate-400'} />
                      <span>أصناف الفواتير</span>
                    </span>
                  </label>

                  {/* Zoom controls only when in sheet mode */}
                  {previewDisplayMode !== 'CARDS' && (
                    <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2 py-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setPreviewZoom(z => Math.max(z - 15, 30))}
                        className="p-1 text-slate-600 hover:text-slate-900 rounded"
                        title="تصغير"
                      >
                        <ZoomOut size={13} />
                      </button>
                      <span className="font-mono text-xs font-bold px-1 text-slate-700">{previewZoom}%</span>
                      <button
                        type="button"
                        onClick={() => setPreviewZoom(z => Math.min(z + 15, 220))}
                        className="p-1 text-slate-600 hover:text-slate-900 rounded"
                        title="تكبير"
                      >
                        <ZoomIn size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewZoom(100);
                          resetModalPan();
                        }}
                        className="text-[10px] text-blue-600 hover:underline px-1"
                      >
                        100%
                      </button>
                    </div>
                  )}
                </div>

                {/* Desktop Action Buttons in Header (Hidden on Mobile) */}
                <div className="hidden sm:flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDirectPrint()}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs active:scale-95"
                    title="طباعة جميع الصفحات"
                  >
                    <Printer size={13} />
                    <span>طباعة الكل ({paginatedChunks.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportPDF()}
                    disabled={isExportingPDF}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                    title={`تصدير جميع صفحات كشف الحساب (${paginatedChunks.length} صفحات) كملف PDF`}
                  >
                    {isExportingPDF ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
                    <span>PDF للكل ({paginatedChunks.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    disabled={isExportingExcel}
                    className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                  >
                    <FileSpreadsheet size={13} />
                    <span>Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenWhatsAppModal}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs active:scale-95"
                  >
                    <MessageSquare size={13} />
                    <span>واتساب</span>
                  </button>
                </div>
              </div>
            </div>

              {/* Modal Body Canvas */}
            <div className="overflow-auto bg-slate-200/70 flex-1 min-h-[350px] relative">
              {previewDisplayMode === 'CARDS' ? (
                <div className="p-3 sm:p-6 pb-20 sm:pb-6">
                  {renderMobileStatementCards(true)}
                </div>
              ) : (
                <div className="flex flex-col min-h-full">
                  {/* Mobile Screen Helper Bar for A4 Sheet */}
                  <div className="sm:hidden bg-slate-900 text-white px-3 py-2 text-xs flex items-center justify-between gap-2 shadow-xs border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-300 min-w-0">
                      <Smartphone size={13} className="text-amber-400 shrink-0" />
                      <span className="truncate">💡 أدر هاتفك أفقياً، أو اضغط:</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewZoom(calculateModalFitZoom());
                          resetModalPan();
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                          previewZoom === calculateModalFitZoom()
                            ? 'bg-blue-600 text-white border-blue-400'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                        title="ملاءمة الورقة لكامل عرض شاشة الهاتف"
                      >
                        احتواء الشاشة
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewZoom(100);
                          resetModalPan();
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                          previewZoom === 100
                            ? 'bg-blue-600 text-white border-blue-400'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                        title="عرض الحجم الطبيعي 100%"
                      >
                        100%
                      </button>
                    </div>
                  </div>

                  <div 
                    className={`p-2 sm:p-6 flex flex-col justify-start items-center min-h-[420px] select-none pb-24 sm:pb-8 ${
                      previewZoom > 100 ? (isModalDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
                    }`}
                    onMouseDown={handleModalMouseDown}
                    onMouseMove={handleModalMouseMove}
                    onMouseUp={handleModalMouseUp}
                    onMouseLeave={handleModalMouseUp}
                    onTouchStart={handleModalTouchStart}
                    onTouchMove={handleModalTouchMove}
                    onTouchEnd={handleModalTouchEnd}
                  >
                    <div 
                      ref={modalSheetRef} 
                      className="transition-transform duration-100 origin-top flex justify-center w-full pointer-events-auto"
                      style={{
                        transform: `translate3d(${modalPan.x}px, ${modalPan.y}px, 0px) scale(${previewZoom / 100})`,
                        transformOrigin: 'top center',
                        marginBottom: previewZoom > 100 ? `${(previewZoom - 100) * 8}px` : '0px'
                      }}
                    >
                      {renderDetailedStatementSheet(true)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Sticky Bottom Action Bar - Convenient 1-Thumb Reach on Mobile */}
            <div className="sm:hidden p-2 bg-white border-t border-slate-200 shadow-lg flex items-center justify-between gap-1.5 shrink-0 z-10">
              <button
                type="button"
                onClick={() => handleDirectPrint()}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 active:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              >
                <Printer size={14} />
                <span>طباعة</span>
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={isExportingPDF}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 active:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isExportingPDF ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                <span>حفظ PDF</span>
              </button>
              <button
                type="button"
                onClick={handleOpenWhatsAppModal}
                className="py-2.5 px-3 rounded-xl bg-emerald-500 active:bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                title="واتساب"
              >
                <MessageSquare size={14} />
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={isExportingExcel}
                className="py-2.5 px-3 rounded-xl bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
                title="تصدير Excel"
              >
                <FileSpreadsheet size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Share & Summary Modal (نافذة مشاركة كشف الحساب والملخص المالي عبر الواتساب) */}
      {showWhatsAppModal && selectedPartner && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">إرسال كشف الحساب عبر الواتساب</h3>
                  <p className="text-[11px] text-emerald-100">
                    {selectedPartner.type === 'CUSTOMER' ? 'العميل' : 'المورد'}: {selectedPartner.name}
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
                  <span>رقم هاتف المستلم (واتساب)</span>
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
                  سيتم فتح تطبيق الواتساب أو واتساب ويب مع الرقم والرسالة المجهزة مباشرة.
                </p>
              </div>

              {/* Message Preview & Editor */}
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <FileText size={13} className="text-slate-600" />
                    <span className="text-xs font-bold text-slate-700">نص الرسالة المالية</span>
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
                      title={isEditingWhatsAppText ? 'اعتماد التعديلات ومعاينة النص' : 'تعديل نص الرسالة وإضافة ملاحظات أو شروط'}
                    >
                      {isEditingWhatsAppText ? <Check size={12} /> : <Edit3 size={12} className="text-emerald-600" />}
                      <span>{isEditingWhatsAppText ? 'تم التعديل' : 'تعديل النص'}</span>
                    </button>

                    {/* زر إعادة ضبط النص الأصلي */}
                    <button
                      type="button"
                      onClick={handleResetWhatsAppMessage}
                      className="text-xs text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg border border-slate-200 transition-colors"
                      title="استعادة النص التلقائي الأصلي لكشف الحساب"
                    >
                      <RotateCcw size={12} />
                      <span className="hidden sm:inline">إعادة ضبط</span>
                    </button>

                    {/* زر نسخ النص */}
                    <button
                      type="button"
                      onClick={handleCopyStatementSummary}
                      className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200"
                    >
                      {isCopiedText ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>{isCopiedText ? 'تم النسخ!' : 'نسخ'}</span>
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
                    {whatsAppMessageText || generateWhatsAppMessage()}
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
                  onClick={handleCopyStatementSummary}
                  className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Copy size={14} />
                  <span>{isCopiedText ? 'تم النسخ بنجاح' : 'نسخ للحافظة'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
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

      {/* 7. Document Viewer Modal (معاينة المستندات الأصلية الفورية) */}
      <DocumentViewerModal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        documentId={viewerDocId}
        documentType={viewerDocType}
      />

      {/* 8. Off-Screen Complete Statement Document with ALL Pages for Printing & PDF Export */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '1020px', minWidth: '1020px', pointerEvents: 'none' }} aria-hidden="true">
        <div ref={allPagesPrintRef} data-statement-all-pages="true">
          {renderDetailedStatementSheet(false)}
        </div>
      </div>
    </div>
  );
}
