import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  FileText, Search, Printer, Download, Eye, Calendar,
  ArrowRight, RefreshCw, Filter, Building2, User, Phone,
  MapPin, Hash, CheckCircle2, AlertCircle, X, ExternalLink,
  ChevronDown, ChevronRight, ChevronLeft, ChevronUp, ChevronsLeft, ChevronsRight, FileSpreadsheet, ShieldCheck,
  CreditCard, DollarSign, Clock, Layers, Users, Truck, Check,
  Share2, ZoomIn, ZoomOut, CheckCircle, Palette, Contrast,
  TrendingUp, TrendingDown, Scale, Receipt, BookOpen,
  MessageSquare, Send, Copy, Package, ListFilter, Maximize2, Minimize2,
  Percent, Tag, Sparkles, SlidersHorizontal, Smartphone, Edit3, RotateCcw,
  FileDown, Loader2
} from 'lucide-react';
import { Partner } from '../types/accounting';
import { 
  loadCustomers, 
  loadVendors,
  loadSalesInvoices, 
  loadPurchaseInvoices,
  loadReceiptVouchers,
  loadPaymentVouchers
} from '../utils/partnerLedger';
import { loadJournalEntries } from '../utils/trialBalanceStore';
import { useSystemCurrency } from '../utils/currency';
import { getSystemSettings } from '../utils/settings';
import { exportToXLSX } from '../utils/universalExport';
import { exportElementToPdf, printElementDirectly } from '../utils/pdfExport';
import { supabase } from '../services/supabaseClient';
import DocumentViewerModal from './modals/DocumentViewerModal';

export interface CustomerStatementProps {
  initialCustomerId?: string;
  initialPartnerType?: 'CUSTOMER' | 'VENDOR';
  onNavigate?: (view: string) => void;
}

export interface CustomerStatementPageChunk {
  pageNumber: number;
  totalPages: number;
  rows: DisplayRow[];
  isFirstPage: boolean;
  isLastPage: boolean;
  openingCarriedBalance: number;
  closingCarriedBalance: number;
}

interface DisplayRow {
  id: string;
  isOpeningRow: boolean;
  debit: number;
  credit: number;
  runningBalance: number;
  docNumber: string;
  date: string;
  description: string;
  rawDoc?: any;
  txType?: 'SALES_INVOICE' | 'PURCHASE_INVOICE' | 'RECEIPT_VOUCHER' | 'PAYMENT_VOUCHER' | 'JOURNAL_ENTRY' | 'OPENING';
}

export default function CustomerStatement({
  initialCustomerId,
  initialPartnerType = 'CUSTOMER',
  onNavigate
}: CustomerStatementProps) {
  const { symbol: currencySymbol, formatMoney, tafqeet, fullNameAr: currencyFullNameAr } = useSystemCurrency();
  const systemSettings = getSystemSettings();
  const company = systemSettings.company || {
    nameAr: 'شركة لوجوستريا للأنظمة المحاسبية المتكاملة',
    nameEn: 'Logustria Financial & Accounting ERP',
    taxNumber: '310123456700003',
    commercialRegister: '1010987654',
    phone: '+966 11 456 7890',
    address: 'المملكة العربية السعودية - الرياض',
    logoUrl: '',
    stampUrl: ''
  };

  // 1. Partner Type: Customer (عميل) or Vendor (مورد)
  const [partnerType, setPartnerType] = useState<'CUSTOMER' | 'VENDOR'>(() => {
    try {
      const stored = sessionStorage.getItem('selected_partner_statement_type');
      if (stored === 'CUSTOMER' || stored === 'VENDOR') return stored;
    } catch {}
    return initialPartnerType;
  });

  // 2. Partners Lists & Selection
  const [customers, setCustomers] = useState<Partner[]>(() => loadCustomers());
  const [vendors, setVendors] = useState<Partner[]>(() => loadVendors());

  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(() => {
    if (initialCustomerId) return initialCustomerId;
    try {
      const stored = sessionStorage.getItem('selected_partner_statement_id');
      if (stored) return stored;
    } catch {}
    return '';
  });

  const [partnerSearchTerm, setPartnerSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 3. Date Filters & Sorting
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-01-01`;
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    return new Date().toISOString().split('T')[0] as string;
  });
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // 4. Applied Filters State (Data is displayed ONLY when user clicks 'عرض البيانات')
  const [appliedFilter, setAppliedFilter] = useState<{
    partnerId: string;
    partnerType: 'CUSTOMER' | 'VENDOR';
    dateFrom: string;
    dateTo: string;
  } | null>(null);

  // 5. Modals & Printable Ref
  const [selectedDocForModal, setSelectedDocForModal] = useState<DisplayRow | null>(null);
  const [showPrintPreviewModal, setShowPrintPreviewModal] = useState(false);
  const [showModalMobileOptions, setShowModalMobileOptions] = useState(false);
  const [statementColorMode, setStatementColorMode] = useState<'COLOR' | 'BW'>('COLOR');
  const [printOrientation, setPrintOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>('PORTRAIT');
  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const [estimatedPages, setEstimatedPages] = useState<number>(1);
  const allPagesPrintRef = useRef<HTMLDivElement>(null);

  const calculateCustomerStatementFitZoom = useCallback(() => {
    if (typeof window === 'undefined') return 100;
    const baseW = printOrientation === 'LANDSCAPE' ? 1240 : 850;
    const availableW = window.innerWidth - (window.innerWidth < 640 ? 16 : 48);
    if (availableW < baseW) {
      const fit = Math.floor((availableW / baseW) * 100);
      return Math.min(100, Math.max(25, fit));
    }
    return 100;
  }, [printOrientation]);
  const [modalPan, setModalPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isModalDragging, setIsModalDragging] = useState(false);
  const modalDragRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number }>({ startX: 0, startY: 0, initialPanX: 0, initialPanY: 0 });

  const [mainSheetZoom, setMainSheetZoom] = useState<number>(100);
  const [mainSheetPan, setMainSheetPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isMainDragging, setIsMainDragging] = useState(false);
  const mainDragRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number }>({ startX: 0, startY: 0, initialPanX: 0, initialPanY: 0 });

  // 6. In-Statement Interactive Search & Quick Filters
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [tableTypeFilter, setTableTypeFilter] = useState<'ALL' | 'INVOICES' | 'VOUCHERS' | 'JOURNALS'>('ALL');
  const [hideZeroMovements, setHideZeroMovements] = useState(false);
  const [selectedStatementRowId, setSelectedStatementRowId] = useState<string | null>(null);

  // 7. Sub-items Expand / Collapse for Invoices
  const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});
  const [includeItemsInPrint, setIncludeItemsInPrint] = useState<boolean>(true);

  // 8. WhatsApp Share & Summary Copy
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppRecipientPhone, setWhatsAppRecipientPhone] = useState('');
  const [whatsAppMessageText, setWhatsAppMessageText] = useState('');
  const [isEditingWhatsAppText, setIsEditingWhatsAppText] = useState(false);
  const [isCopiedText, setIsCopiedText] = useState(false);
  const [isCopiedSummaryCard, setIsCopiedSummaryCard] = useState(false);

  const statementSheetRef = useRef<HTMLDivElement>(null);
  const modalSheetRef = useRef<HTMLDivElement>(null);

  // Reset zoom and pan whenever preview modal is opened or closed
  useEffect(() => {
    setPreviewZoom(100);
    setModalPan({ x: 0, y: 0 });
  }, [showPrintPreviewModal]);

  const resetModalPan = () => {
    setModalPan({ x: 0, y: 0 });
  };

  const resetMainPan = () => {
    setMainSheetPan({ x: 0, y: 0 });
  };

  // Drag handlers for Modal
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
    setIsModalDragging(true);
    modalDragRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      initialPanX: modalPan.x,
      initialPanY: modalPan.y
    };
  };

  const handleModalTouchMove = (e: React.TouchEvent) => {
    if (!isModalDragging || previewZoom <= 100) return;
    const dx = e.touches[0].clientX - modalDragRef.current.startX;
    const dy = e.touches[0].clientY - modalDragRef.current.startY;
    setModalPan({
      x: modalDragRef.current.initialPanX + dx,
      y: modalDragRef.current.initialPanY + dy
    });
  };

  const handleModalTouchEnd = () => {
    setIsModalDragging(false);
  };

  // Drag handlers for Main Sheet
  const handleMainMouseDown = (e: React.MouseEvent) => {
    if (mainSheetZoom <= 100) return;
    setIsMainDragging(true);
    mainDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: mainSheetPan.x,
      initialPanY: mainSheetPan.y
    };
  };

  const handleMainMouseMove = (e: React.MouseEvent) => {
    if (!isMainDragging || mainSheetZoom <= 100) return;
    const dx = e.clientX - mainDragRef.current.startX;
    const dy = e.clientY - mainDragRef.current.startY;
    setMainSheetPan({
      x: mainDragRef.current.initialPanX + dx,
      y: mainDragRef.current.initialPanY + dy
    });
  };

  const handleMainMouseUp = () => {
    setIsMainDragging(false);
  };

  const handleMainTouchStart = (e: React.TouchEvent) => {
    if (mainSheetZoom <= 100 || e.touches.length !== 1) return;
    setIsMainDragging(true);
    mainDragRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      initialPanX: mainSheetPan.x,
      initialPanY: mainSheetPan.y
    };
  };

  const handleMainTouchMove = (e: React.TouchEvent) => {
    if (!isMainDragging || mainSheetZoom <= 100) return;
    const dx = e.touches[0].clientX - mainDragRef.current.startX;
    const dy = e.touches[0].clientY - mainDragRef.current.startY;
    setMainSheetPan({
      x: mainDragRef.current.initialPanX + dx,
      y: mainDragRef.current.initialPanY + dy
    });
  };

  const handleMainTouchEnd = () => {
    setIsMainDragging(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen to external custom events
  useEffect(() => {
    const handlePartnerSelect = (e: Event) => {
      const ce = e as CustomEvent<{ partnerId?: string; type?: 'CUSTOMER' | 'VENDOR' }>;
      if (ce.detail?.type) {
        setPartnerType(ce.detail.type);
      }
      if (ce.detail?.partnerId) {
        setSelectedPartnerId(ce.detail.partnerId);
      }
    };
    window.addEventListener('alpha-open-partner-statement', handlePartnerSelect);
    return () => window.removeEventListener('alpha-open-partner-statement', handlePartnerSelect);
  }, []);

  // Auto-detect if initialCustomerId belongs to Customer or Vendor
  useEffect(() => {
    if (initialCustomerId) {
      const foundInCust = customers.some(c => c.id === initialCustomerId);
      const foundInVend = vendors.some(v => v.id === initialCustomerId);
      if (foundInVend && !foundInCust) {
        setPartnerType('VENDOR');
      } else if (foundInCust) {
        setPartnerType('CUSTOMER');
      }
      setSelectedPartnerId(initialCustomerId);
    }
  }, [initialCustomerId, customers, vendors]);

  // Sync / Load data from Supabase and Local Storage
  const loadData = useCallback(async () => {
    let loadedCusts = loadCustomers();
    let loadedVends = loadVendors();

    try {
      if (supabase) {
        const [custRes, vendRes] = await Promise.allSettled([
          supabase.from('customers').select('*'),
          supabase.from('vendors').select('*')
        ]);

        if (custRes.status === 'fulfilled' && !custRes.value.error && Array.isArray(custRes.value.data) && custRes.value.data.length > 0) {
          const mappedCusts: Partner[] = custRes.value.data.map((c: any) => ({
            id: c.id?.toString() || `cust-${c.code}`,
            code: c.code || `CUST-${c.id}`,
            name: c.name || 'عميل بدون اسم',
            type: 'CUSTOMER',
            phone: c.phone || '',
            taxNumber: c.tax_number || c.taxNumber || '',
            address: c.address || '',
            openingBalance: Number(c.opening_balance ?? c.openingBalance) || 0,
            openingBalanceDate: c.opening_balance_date || c.openingBalanceDate || '2026-01-01',
            openingBalanceType: c.opening_balance_type || c.openingBalanceType || 'DEBIT',
            creditLimit: Number(c.credit_limit ?? c.creditLimit) || undefined,
            isActive: c.is_active !== undefined ? Boolean(c.is_active) : true
          }));
          const existingCustIds = new Set(loadedCusts.map(x => x.id));
          loadedCusts = [...loadedCusts, ...mappedCusts.filter(m => !existingCustIds.has(m.id))];
        }

        if (vendRes.status === 'fulfilled' && !vendRes.value.error && Array.isArray(vendRes.value.data) && vendRes.value.data.length > 0) {
          const mappedVends: Partner[] = vendRes.value.data.map((v: any) => ({
            id: v.id?.toString() || `vend-${v.code}`,
            code: v.code || `VEND-${v.id}`,
            name: v.name || 'مورد بدون اسم',
            type: 'VENDOR',
            phone: v.phone || '',
            taxNumber: v.tax_number || v.taxNumber || '',
            address: v.address || '',
            openingBalance: Number(v.opening_balance ?? v.openingBalance) || 0,
            openingBalanceDate: v.opening_balance_date || v.openingBalanceDate || '2026-01-01',
            openingBalanceType: v.opening_balance_type || v.openingBalanceType || 'CREDIT',
            isActive: v.is_active !== undefined ? Boolean(v.is_active) : true
          }));
          const existingVendIds = new Set(loadedVends.map(x => x.id));
          loadedVends = [...loadedVends, ...mappedVends.filter(m => !existingVendIds.has(m.id))];
        }
      }
    } catch (e) {
      console.warn('Supabase sync skipped:', e);
    }

    setCustomers(loadedCusts);
    setVendors(loadedVends);

    // Auto-select first partner if none selected
    setSelectedPartnerId(prevId => {
      if (prevId) return prevId;
      const activeList = partnerType === 'CUSTOMER' ? loadedCusts : loadedVends;
      return activeList.length > 0 ? activeList[0].id : '';
    });
  }, [partnerType]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  // Update selection when switching between customer and vendor
  const handleSwitchPartnerType = (newType: 'CUSTOMER' | 'VENDOR') => {
    setPartnerType(newType);
    setPartnerSearchTerm('');
    setIsDropdownOpen(false);
    setAppliedFilter(null);
    try {
      sessionStorage.setItem('selected_partner_statement_type', newType);
    } catch {}

    const list = newType === 'CUSTOMER' ? customers : vendors;
    if (list.length > 0) {
      setSelectedPartnerId(list[0].id);
      try {
        sessionStorage.setItem('selected_partner_statement_id', list[0].id);
      } catch {}
    } else {
      setSelectedPartnerId('');
    }
  };

  // Save selected partner ID to sessionStorage
  useEffect(() => {
    if (selectedPartnerId) {
      try {
        sessionStorage.setItem('selected_partner_statement_id', selectedPartnerId);
        sessionStorage.setItem('selected_partner_statement_type', partnerType);
      } catch {}
    }
  }, [selectedPartnerId, partnerType]);

  // Active Partner List (Customers or Vendors)
  const currentPartnerList = useMemo(() => {
    return partnerType === 'CUSTOMER' ? customers : vendors;
  }, [partnerType, customers, vendors]);

  // Current selected partner object
  const currentPartner = useMemo(() => {
    if (!selectedPartnerId) return currentPartnerList[0] || null;
    return currentPartnerList.find(p => p.id === selectedPartnerId) || currentPartnerList[0] || null;
  }, [currentPartnerList, selectedPartnerId]);

  // Filtered partners list for dropdown search
  const filteredPartners = useMemo(() => {
    const q = partnerSearchTerm.trim().toLowerCase();
    if (!q) return currentPartnerList;
    return currentPartnerList.filter(p => 
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.code && String(p.code).toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q)) ||
      (p.taxNumber && p.taxNumber.includes(q))
    );
  }, [currentPartnerList, partnerSearchTerm]);

  // Helper Labels & Terminology
  const isVendor = partnerType === 'VENDOR';
  const partnerLabelAr = isVendor ? 'مورد' : 'عميل';
  const partnerPluralAr = isVendor ? 'الموردين' : 'العملاء';
  const partnerCodePrefix = isVendor ? 'VEND' : 'CUST';
  const statementTitleAr = isVendor ? 'كشف حساب مورد معتمد' : 'كشف حساب عميل معتمد';

  // Active Partner derived from applied filter when search has been executed
  const appliedPartner = useMemo(() => {
    if (!appliedFilter) return null;
    const list = appliedFilter.partnerType === 'CUSTOMER' ? customers : vendors;
    return list.find(p => p.id === appliedFilter.partnerId) || currentPartner;
  }, [appliedFilter, customers, vendors, currentPartner]);

  // Track if current inputs differ from executed query
  const isFilterChanged = appliedFilter !== null && (
    appliedFilter.partnerId !== selectedPartnerId ||
    appliedFilter.partnerType !== partnerType ||
    appliedFilter.dateFrom !== dateFrom ||
    appliedFilter.dateTo !== dateTo
  );

  // Core Accounting Engine: Calculates ONLY when user clicks 'عرض البيانات'
  const statementCalculation = useMemo(() => {
    if (!appliedFilter) {
      return {
        rows: [],
        periodTotals: { debit: 0, credit: 0 },
        periodNetChange: 0,
        prePeriodBalance: 0,
        finalBalance: 0,
        hasRows: false
      };
    }

    const partner = (appliedFilter.partnerType === 'CUSTOMER' ? customers : vendors).find(p => p.id === appliedFilter.partnerId) || currentPartner;
    if (!partner) {
      return {
        rows: [],
        periodTotals: { debit: 0, credit: 0 },
        periodNetChange: 0,
        prePeriodBalance: 0,
        finalBalance: 0,
        hasRows: false
      };
    }

    const calcDateFrom = appliedFilter.dateFrom;
    const calcDateTo = appliedFilter.dateTo;
    const isVendorPartner = appliedFilter.partnerType === 'VENDOR';

    const isPartnerMatch = (pId?: string, pName?: string) => {
      if (pId && partner.id && String(pId).trim() === String(partner.id).trim()) return true;
      if (pName && partner.name && String(pName).trim().toLowerCase() === String(partner.name).trim().toLowerCase()) return true;
      return false;
    };

    // 1. Gather all local transactions
    const rawSalesInvoices = loadSalesInvoices();
    const rawPurchaseInvoices = loadPurchaseInvoices();
    const rawReceiptVouchers = loadReceiptVouchers();
    const rawPaymentVouchers = loadPaymentVouchers();
    const rawJournalEntries = loadJournalEntries();

    interface RawMovement {
      id: string;
      date: string;
      createdAt: string;
      docNumber: string;
      description: string;
      debit: number;
      credit: number;
      txType: 'SALES_INVOICE' | 'PURCHASE_INVOICE' | 'RECEIPT_VOUCHER' | 'PAYMENT_VOUCHER' | 'JOURNAL_ENTRY';
      rawDoc: any;
      isPosted: boolean;
    }

    const movements: RawMovement[] = [];

    // Helper to format voucher payment method
    const getVoucherMethodLabel = (v: any) => {
      const method = String(v.paymentMethod || '').toUpperCase();
      const accId = String(v.accountId || '').toLowerCase();
      const bankInfo = v.bankName ? ` - ${v.bankName}` : '';
      const refInfo = v.referenceNo ? ` [مرجع: ${v.referenceNo}]` : '';

      if (method === 'CHECK' || method.includes('CHECK') || method === 'شيك') {
        return `شيك بنكي${bankInfo}${refInfo}`;
      }
      if (method === 'BANK_TRANSFER' || method === 'TRANSFER' || method.includes('BANK') || method === 'تحويل' || accId === 'bank' || accId.includes('bank') || accId.startsWith('1102')) {
        return `تحويل بنكي${bankInfo}${refInfo}`;
      }
      if (method === 'SPAN' || method === 'CARD' || method === 'CREDIT_CARD' || method === 'مدى' || method === 'شبكة') {
        return `شبكة / مدى${refInfo}`;
      }
      if (method === 'CASH' || method === 'نقد' || method === 'نقدا' || accId === 'cash' || accId.startsWith('1101')) {
        return 'نقداً';
      }
      return accId === 'bank' || accId.includes('bank') ? 'تحويل بنكي' : 'نقداً';
    };

    // Helper to format invoice transaction/payment method
    const getInvoiceMethodLabel = (inv: any) => {
      const type = String(inv.invoiceType || '').toUpperCase();
      if (type.includes('CASH') || type === 'نقد' || type === 'نقدي') return 'نقدي';
      if (type.includes('BANK') || type.includes('TRANSFER')) return 'تحويل بنكي';
      if (type.includes('SPAN') || type.includes('CARD') || type.includes('MADA')) return 'شبكة / مدى';
      if (type.includes('CREDIT') || type === 'اجل' || type === 'آجل') return 'آجل';
      const grandTotal = Number(inv.totals?.grandTotal ?? 0);
      const cashPaid = Number(inv.totals?.cashPaid ?? 0);
      if (cashPaid >= grandTotal && grandTotal > 0) return 'نقدي';
      if (cashPaid > 0 && cashPaid < grandTotal) return 'جزء نقدي وجزء آجل';
      return 'آجل';
    };

    // Helper to clean duplicate document numbers or prefixes from description
    const cleanExplanationText = (text: string, docNum?: string) => {
      if (!text) return '';
      let cleaned = text.trim();
      if (docNum) {
        const rawNum = docNum.replace(/^[#\s]+/, '').trim();
        if (rawNum) {
          cleaned = cleaned.split(rawNum).join('');
        }
      }
      cleaned = cleaned
        .replace(/^(فاتورة\s*(مبيعات|مشتريات)?|مرتجع\s*(مبيعات|مشتريات)?|سند\s*(قبض|صرف)(\s*نقدية)?|قيد\s*يومية)\s*[-–—:#\s]*/i, '')
        .replace(/^[#:\s\-–—]+/, '')
        .trim();
      return cleaned;
    };

    // Process Sales Invoices
    rawSalesInvoices.forEach(inv => {
      if (isPartnerMatch(inv.partnerId, inv.partnerName)) {
        const isPosted = (inv.status || 'DRAFT') === 'POSTED';
        const isReturn = inv.invoiceType?.includes('RETURN');
        const grandTotal = Number(inv.totals?.grandTotal ?? 0);
        const cashPaid = Number(inv.totals?.cashPaid ?? 0);
        const docLabel = isReturn ? 'مرتجع مبيعات' : 'فاتورة مبيعات';
        const methodLabel = getInvoiceMethodLabel(inv);
        const note = cleanExplanationText(inv.notes || inv.description || '', inv.invoiceNumber);
        const desc = note ? `${docLabel} (${methodLabel}) - ${note}` : `${docLabel} (${methodLabel})`;

        // For a Customer: Sale is Debit (owes us), Return is Credit.
        // For a Vendor (if vendor buys from us): Sale is Debit, Return is Credit.
        movements.push({
          id: `inv-${inv.id || inv.invoiceNumber}`,
          date: inv.date || '2026-01-01',
          createdAt: inv.createdAt || `${inv.date || '2026-01-01'}T00:00:00.000Z`,
          docNumber: `#${inv.invoiceNumber}`,
          description: desc,
          debit: isPosted && !isReturn ? grandTotal : 0,
          credit: isPosted && isReturn ? grandTotal : 0,
          txType: 'SALES_INVOICE',
          rawDoc: inv,
          isPosted
        });

        // Immediate cash paid recorded directly on the sales invoice
        if (cashPaid > 0 && isPosted) {
          const cashDesc = !isReturn 
            ? `سند قبض (نقداً) - دفعة مسجلة مع الفاتورة${note ? ' (' + note + ')' : ''}`
            : `سند صرف (نقداً) - دفعة مسجلة مع المرتجع${note ? ' (' + note + ')' : ''}`;

          movements.push({
            id: `inv-cash-${inv.id || inv.invoiceNumber}`,
            date: inv.date || '2026-01-01',
            createdAt: `${inv.createdAt || inv.date || '2026-01-01'}T00:00:01.000Z`,
            docNumber: `PAY-#${inv.invoiceNumber}`,
            description: cashDesc,
            debit: isReturn ? cashPaid : 0,
            credit: !isReturn ? cashPaid : 0,
            txType: 'RECEIPT_VOUCHER',
            rawDoc: inv,
            isPosted: true
          });
        }
      }
    });

    // Process Purchase Invoices
    rawPurchaseInvoices.forEach(inv => {
      if (isPartnerMatch(inv.partnerId, inv.partnerName)) {
        const isPosted = (inv.status || 'DRAFT') === 'POSTED';
        const isReturn = inv.invoiceType?.includes('RETURN');
        const grandTotal = Number(inv.totals?.grandTotal ?? 0);
        const cashPaid = Number(inv.totals?.cashPaid ?? 0);
        const docLabel = isReturn ? 'مرتجع مشتريات' : 'فاتورة مشتريات';
        const methodLabel = getInvoiceMethodLabel(inv);
        const note = cleanExplanationText(inv.notes || inv.description || '', inv.invoiceNumber);
        const desc = note ? `${docLabel} (${methodLabel}) - ${note}` : `${docLabel} (${methodLabel})`;

        // Standard accounting:
        // Purchase from vendor: Credit (increases liability/payable). Return: Debit.
        movements.push({
          id: `purch-${inv.id || inv.invoiceNumber}`,
          date: inv.date || '2026-01-01',
          createdAt: inv.createdAt || `${inv.date || '2026-01-01'}T00:00:00.000Z`,
          docNumber: `#${inv.invoiceNumber}`,
          description: desc,
          debit: isPosted && isReturn ? grandTotal : 0,
          credit: isPosted && !isReturn ? grandTotal : 0,
          txType: 'PURCHASE_INVOICE',
          rawDoc: inv,
          isPosted
        });

        // Immediate cash paid recorded directly on the purchase invoice
        if (cashPaid > 0 && isPosted) {
          const cashDesc = !isReturn
            ? `سند صرف (نقداً) - سداد مسجل مع الفاتورة${note ? ' (' + note + ')' : ''}`
            : `سند قبض (نقداً) - استرداد مسجل مع المرتجع${note ? ' (' + note + ')' : ''}`;

          movements.push({
            id: `purch-cash-${inv.id || inv.invoiceNumber}`,
            date: inv.date || '2026-01-01',
            createdAt: `${inv.createdAt || inv.date || '2026-01-01'}T00:00:01.000Z`,
            docNumber: `PAY-PO-#${inv.invoiceNumber}`,
            description: cashDesc,
            debit: !isReturn ? cashPaid : 0,
            credit: isReturn ? cashPaid : 0,
            txType: 'PAYMENT_VOUCHER',
            rawDoc: inv,
            isPosted: true
          });
        }
      }
    });

    // Process Receipt Vouchers
    rawReceiptVouchers.forEach(v => {
      if (isPartnerMatch(v.partnerId, v.partnerName)) {
        const isPosted = (v.status || 'DRAFT') === 'POSTED';
        const amount = Number(v.amount) || 0;
        const methodLabel = getVoucherMethodLabel(v);
        const cleanDesc = cleanExplanationText(v.description || '', v.voucherNumber);
        const desc = cleanDesc ? `سند قبض (${methodLabel}) - ${cleanDesc}` : `سند قبض (${methodLabel})`;

        // Receipt: Credit to partner (reduces receivable for customer, or refund from vendor)
        movements.push({
          id: `voucher-${v.id || v.voucherNumber}`,
          date: v.date || '2026-01-01',
          createdAt: v.createdAt || `${v.date || '2026-01-01'}T00:00:00.000Z`,
          docNumber: `#${v.voucherNumber}`,
          description: desc,
          debit: 0,
          credit: isPosted ? amount : 0,
          txType: 'RECEIPT_VOUCHER',
          rawDoc: v,
          isPosted
        });
      }
    });

    // Process Payment Vouchers
    rawPaymentVouchers.forEach(v => {
      if (isPartnerMatch(v.partnerId, v.partnerName)) {
        const isPosted = (v.status || 'DRAFT') === 'POSTED';
        const amount = Number(v.amount) || 0;
        const methodLabel = getVoucherMethodLabel(v);
        const cleanDesc = cleanExplanationText(v.description || '', v.voucherNumber);
        const desc = cleanDesc ? `سند صرف (${methodLabel}) - ${cleanDesc}` : `سند صرف (${methodLabel})`;

        // Payment: Debit to partner (reduces payable for vendor, or refund/deposit for customer)
        movements.push({
          id: `voucher-${v.id || v.voucherNumber}`,
          date: v.date || '2026-01-01',
          createdAt: v.createdAt || `${v.date || '2026-01-01'}T00:00:00.000Z`,
          docNumber: `#${v.voucherNumber}`,
          description: desc,
          debit: isPosted ? amount : 0,
          credit: 0,
          txType: 'PAYMENT_VOUCHER',
          rawDoc: v,
          isPosted
        });
      }
    });

    // Process Journal Entries (Linked via subledger)
    (rawJournalEntries || []).forEach(entry => {
      if (entry.status !== 'POSTED') return;
      (entry.items || []).forEach((item, itemIdx) => {
        if (isPartnerMatch(item.partnerId, item.partnerName)) {
          const debitAmt = Number(item.debit) || 0;
          const creditAmt = Number(item.credit) || 0;
          const cleanDesc = cleanExplanationText(item.description || entry.description || '', entry.entryNumber);
          const desc = cleanDesc ? `قيد يومية - ${cleanDesc}` : 'قيد يومية';

          movements.push({
            id: `je-${entry.id || entry.entryNumber}-${itemIdx}`,
            date: entry.date || '2026-01-01',
            createdAt: `${entry.date}T00:00:${String(itemIdx).padStart(2, '0')}.000Z`,
            docNumber: `#${entry.entryNumber}`,
            description: desc,
            debit: debitAmt,
            credit: creditAmt,
            txType: 'JOURNAL_ENTRY',
            rawDoc: entry,
            isPosted: true
          });
        }
      });
    });

    // Chronological Sort for running balance calculation
    movements.sort((a, b) => {
      const cmpDate = a.date.localeCompare(b.date);
      if (cmpDate !== 0) return cmpDate;
      return a.createdAt.localeCompare(b.createdAt);
    });

    // Partner Opening Balance (from card)
    let cardOpening = Number(partner.openingBalance) || 0;
    if (isVendorPartner) {
      // For Vendor: standard opening balance is Credit (we owe them) unless DEBIT explicitly stated
      if (partner.openingBalanceType === 'DEBIT') {
        cardOpening = Math.abs(cardOpening);
      } else {
        cardOpening = -Math.abs(cardOpening); // Credit balance
      }
    } else {
      // For Customer: standard opening balance is Debit (they owe us) unless CREDIT explicitly stated
      if (partner.openingBalanceType === 'CREDIT') {
        cardOpening = -Math.abs(cardOpening);
      } else {
        cardOpening = Math.abs(cardOpening);
      }
    }

    // Split movements into: Before Period vs Within Period
    let prePeriodRunning = cardOpening;
    const periodMovements: RawMovement[] = [];

    movements.forEach(m => {
      if (!m.isPosted) return;
      if (m.date < calcDateFrom) {
        prePeriodRunning += (m.debit - m.credit);
      } else if (m.date <= calcDateTo) {
        periodMovements.push(m);
      }
    });

    // Build Final Display Rows
    const displayRows: DisplayRow[] = [];
    let currentBalance = prePeriodRunning;

    // Row 1: Opening Balance Row
    const openingBalDesc = isVendorPartner
      ? (prePeriodRunning < 0 
          ? `رصيد سابق منقول دائن (مستحق للمورد)` 
          : prePeriodRunning > 0 
          ? `رصيد سابق منقول مدين (دفعة مقدمة للمورد)` 
          : 'رصيد سابق منقول (حساب متزن)')
      : (prePeriodRunning > 0 
          ? `رصيد سابق منقول مدين (مستحق على العميل)` 
          : prePeriodRunning < 0 
          ? `رصيد سابق منقول دائن (لصالح العميل)` 
          : 'رصيد سابق منقول (حساب متزن)');

    displayRows.push({
      id: 'row-opening',
      isOpeningRow: true,
      debit: prePeriodRunning > 0 ? prePeriodRunning : 0,
      credit: prePeriodRunning < 0 ? Math.abs(prePeriodRunning) : 0,
      runningBalance: currentBalance,
      docNumber: 'OP-001',
      date: calcDateFrom,
      description: openingBalDesc,
      txType: 'OPENING'
    });

    let periodDebitSum = 0;
    let periodCreditSum = 0;

    periodMovements.forEach(m => {
      periodDebitSum += m.debit;
      periodCreditSum += m.credit;
      currentBalance += (m.debit - m.credit);

      displayRows.push({
        id: m.id,
        isOpeningRow: false,
        debit: m.debit,
        credit: m.credit,
        runningBalance: currentBalance,
        docNumber: m.docNumber,
        date: m.date,
        description: m.description,
        rawDoc: m.rawDoc,
        txType: m.txType
      });
    });

    const periodNetChange = periodDebitSum - periodCreditSum;
    const finalBalance = currentBalance;

    return {
      rows: displayRows,
      periodTotals: {
        debit: periodDebitSum,
        credit: periodCreditSum
      },
      periodNetChange,
      prePeriodBalance: prePeriodRunning,
      finalBalance,
      hasRows: displayRows.length > 1
    };
  }, [appliedFilter, customers, vendors, currentPartner, refreshKey]);

  // Balance Interpretation text & badges
  const finalBalanceFormatted = `${Math.abs(statementCalculation.finalBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencySymbol}`;
  const finalBalanceLabel = useMemo(() => {
    const bal = statementCalculation.finalBalance;
    if (bal === 0) return 'حساب متزن';
    const isVendorPartner = appliedFilter ? appliedFilter.partnerType === 'VENDOR' : isVendor;
    if (isVendorPartner) {
      return bal < 0 ? 'دائن مستحق للمورد (مطلوب سداده)' : 'مدين (دفعة مقدمة لصالحنا طرف المورد)';
    }
    return bal > 0 ? 'مدين مستحق على العميل' : 'دائن لصالح العميل';
  }, [statementCalculation.finalBalance, appliedFilter, isVendor]);

  // Recalculate estimated print pages accurately
  useEffect(() => {
    const timer = setTimeout(() => {
      const targetEl = modalSheetRef.current || statementSheetRef.current;
      if (targetEl && targetEl.scrollHeight > 100) {
        const pageHeight = printOrientation === 'LANDSCAPE' ? 710 : 1020;
        const calculated = Math.max(1, Math.ceil((targetEl.scrollHeight - 10) / pageHeight));
        setEstimatedPages(calculated);
        return;
      }

      // Mathematical fallback based on rows & items
      let totalPoints = 330;
      if (statementCalculation && statementCalculation.rows) {
        statementCalculation.rows.forEach(row => {
          totalPoints += 38;
          if (includeItemsInPrint && row.rawDoc && (row.rawDoc.items || row.rawDoc.lines)) {
            const itemsCount = (row.rawDoc.items || row.rawDoc.lines).length;
            totalPoints += itemsCount * 28;
          }
        });
      }
      const pageCapacity = printOrientation === 'LANDSCAPE' ? 710 : 1020;
      const pages = Math.max(1, Math.ceil(totalPoints / pageCapacity));
      setEstimatedPages(pages);
    }, 150);

    return () => clearTimeout(timer);
  }, [
    showPrintPreviewModal,
    printOrientation,
    includeItemsInPrint,
    statementCalculation
  ]);

  // Movement counts by transaction type for quick filter badges
  const movementCounts = useMemo(() => {
    const rawRows = statementCalculation.rows.filter(r => !r.isOpeningRow);
    const invoices = rawRows.filter(r => r.txType === 'SALES_INVOICE' || r.txType === 'PURCHASE_INVOICE').length;
    const vouchers = rawRows.filter(r => r.txType === 'RECEIPT_VOUCHER' || r.txType === 'PAYMENT_VOUCHER').length;
    const journals = rawRows.filter(r => r.txType === 'JOURNAL_ENTRY').length;
    return {
      all: rawRows.length,
      invoices,
      vouchers,
      journals
    };
  }, [statementCalculation.rows]);

  // Filtered rows for live display and search inside table
  const displayedRows = useMemo(() => {
    let rows = statementCalculation.rows;
    if (tableTypeFilter === 'INVOICES') {
      rows = rows.filter(r => r.isOpeningRow || r.txType === 'SALES_INVOICE' || r.txType === 'PURCHASE_INVOICE');
    } else if (tableTypeFilter === 'VOUCHERS') {
      rows = rows.filter(r => r.isOpeningRow || r.txType === 'RECEIPT_VOUCHER' || r.txType === 'PAYMENT_VOUCHER');
    } else if (tableTypeFilter === 'JOURNALS') {
      rows = rows.filter(r => r.isOpeningRow || r.txType === 'JOURNAL_ENTRY');
    }

    if (tableSearchQuery.trim()) {
      const q = tableSearchQuery.trim().toLowerCase();
      rows = rows.filter(r => {
        if (r.isOpeningRow) return true;
        const doc = (r.docNumber || '').toLowerCase();
        const desc = (r.description || '').toLowerCase();
        const d = (r.date || '').toLowerCase();
        return doc.includes(q) || desc.includes(q) || d.includes(q);
      });
    }

    if (hideZeroMovements) {
      rows = rows.filter(r => r.isOpeningRow || r.debit > 0 || r.credit > 0);
    }

    return rows;
  }, [statementCalculation.rows, tableTypeFilter, tableSearchQuery, hideZeroMovements]);

  // List of invoice rows in the current table that contain multiple items
  const invoiceRowsWithItems = useMemo(() => {
    return displayedRows.filter(r => {
      if (r.isOpeningRow) return false;
      if (r.txType !== 'SALES_INVOICE' && r.txType !== 'PURCHASE_INVOICE') return false;
      const rawItems = Array.isArray(r.rawDoc?.items) && r.rawDoc.items.length > 0
        ? r.rawDoc.items
        : Array.isArray(r.rawDoc?.lines) && r.rawDoc.lines.length > 0
        ? r.rawDoc.lines
        : [];
      return rawItems.length > 0;
    });
  }, [displayedRows]);

  const areAllInvoicesExpanded = useMemo(() => {
    if (invoiceRowsWithItems.length === 0) return false;
    return invoiceRowsWithItems.every(r => expandedInvoices[r.id]);
  }, [invoiceRowsWithItems, expandedInvoices]);

  const toggleInvoiceExpand = (rowId: string) => {
    setExpandedInvoices(prev => ({
      ...prev,
      [rowId]: !prev[rowId]
    }));
  };

  const expandAllInvoices = () => {
    const next: Record<string, boolean> = {};
    invoiceRowsWithItems.forEach(r => {
      next[r.id] = true;
    });
    setExpandedInvoices(next);
    setIncludeItemsInPrint(true);
  };

  const collapseAllInvoices = () => {
    setExpandedInvoices({});
    setIncludeItemsInPrint(false);
  };

  // A4 Smart Pagination Engine for Customer / Vendor Statement: Partitions statement rows into physical discrete pages
  const paginatedChunks = useMemo<CustomerStatementPageChunk[]>(() => {
    const rows = displayedRows;
    const isLandscape = printOrientation === 'LANDSCAPE';
    // Calibrated capacities for professional A4 pagination:
    // Page 1 has full company header + partner & period box (~320px)
    const firstPageCapacity = isLandscape ? 11 : 15;
    // Continuing pages have compact running header (~80px)
    const otherPageCapacity = isLandscape ? 17 : 24;

    if (rows.length === 0) {
      return [{
        pageNumber: 1,
        totalPages: 1,
        rows: [],
        isFirstPage: true,
        isLastPage: true,
        openingCarriedBalance: statementCalculation.prePeriodBalance,
        closingCarriedBalance: statementCalculation.finalBalance
      }];
    }

    const getRowWeight = (r: DisplayRow) => {
      const rawItems = Array.isArray(r.rawDoc?.items) && r.rawDoc.items.length > 0
        ? r.rawDoc.items
        : Array.isArray(r.rawDoc?.lines) && r.rawDoc.lines.length > 0
        ? r.rawDoc.lines
        : [];
      const hasItems = !r.isOpeningRow && 
        (r.txType === 'SALES_INVOICE' || r.txType === 'PURCHASE_INVOICE') && 
        rawItems.length > 0;
      if (includeItemsInPrint && hasItems) {
        // Master row + items table header + item rows + summary
        return 1 + 1 + Math.ceil(rawItems.length * 0.8) + 1;
      }
      return 1;
    };

    const pagesRows: DisplayRow[][] = [];
    let currentBatch: DisplayRow[] = [];
    let currentWeight = 0;
    let limit = firstPageCapacity;

    rows.forEach((row) => {
      const w = getRowWeight(row);
      if (currentBatch.length > 0 && currentWeight + w > limit) {
        pagesRows.push(currentBatch);
        currentBatch = [row];
        currentWeight = w;
        limit = otherPageCapacity;
      } else {
        currentBatch.push(row);
        currentWeight += w;
      }
    });

    if (currentBatch.length > 0) {
      pagesRows.push(currentBatch);
    }

    const totalPages = pagesRows.length;
    let runningBal = statementCalculation.prePeriodBalance;

    return pagesRows.map((pRows, pIdx) => {
      const isFirst = pIdx === 0;
      const isLast = pIdx === totalPages - 1;
      const openingBal = isFirst ? statementCalculation.prePeriodBalance : runningBal;

      const lastRow = pRows[pRows.length - 1];
      if (lastRow) {
        runningBal = lastRow.runningBalance;
      }

      return {
        pageNumber: pIdx + 1,
        totalPages,
        rows: pRows,
        isFirstPage: isFirst,
        isLastPage: isLast,
        openingCarriedBalance: openingBal,
        closingCarriedBalance: runningBal
      };
    });
  }, [displayedRows, printOrientation, includeItemsInPrint, statementCalculation]);

  // Sync estimatedPages with paginated chunks
  useEffect(() => {
    setEstimatedPages(paginatedChunks.length);
  }, [paginatedChunks.length]);

  // Handle explicit click of 'عرض البيانات'
  const handleExecuteFetch = () => {
    if (!currentPartner) {
      alert(`يرجى اختيار ${partnerLabelAr} أولاً`);
      return;
    }

    setIsLoadingData(true);

    // Give visual feedback with the spinner during processing, then bind directly to data display
    setTimeout(() => {
      try {
        const loadedCusts = loadCustomers();
        const loadedVends = loadVendors();
        setCustomers(loadedCusts);
        setVendors(loadedVends);

        setAppliedFilter({
          partnerId: currentPartner.id,
          partnerType,
          dateFrom,
          dateTo
        });
        setRefreshKey(k => k + 1);
      } catch (err) {
        console.error('Error fetching statement data:', err);
      } finally {
        setIsLoadingData(false);
      }
    }, 250);
  };

  // Quick Date Range Helpers
  const setQuickRange = (range: 'THIS_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR' | 'ALL') => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();

    if (range === 'THIS_MONTH') {
      const firstDay = new Date(y, m, 1).toISOString().split('T')[0];
      const lastDay = new Date(y, m + 1, 0).toISOString().split('T')[0];
      setDateFrom(firstDay);
      setDateTo(lastDay);
    } else if (range === 'THIS_QUARTER') {
      const qStartMonth = Math.floor(m / 3) * 3;
      const firstDay = new Date(y, qStartMonth, 1).toISOString().split('T')[0];
      const lastDay = new Date(y, qStartMonth + 3, 0).toISOString().split('T')[0];
      setDateFrom(firstDay);
      setDateTo(lastDay);
    } else if (range === 'THIS_YEAR') {
      setDateFrom(`${y}-01-01`);
      setDateTo(`${y}-12-31`);
    } else if (range === 'ALL') {
      setDateFrom('2020-01-01');
      setDateTo(new Date().toISOString().split('T')[0]);
    }
  };

  // Direct Print Handler: Uses isolated iframe print with complete official header & stamp
  const handleDirectPrint = (targetPageOnly?: boolean) => {
    if (!appliedFilter || !appliedPartner) {
      alert(`يرجى الضغط على زر «عرض البيانات» أولاً لعرض كشف الحساب قبل الطباعة.`);
      return;
    }
    try {
      const target = (targetPageOnly && modalSheetRef.current) 
        ? modalSheetRef.current 
        : (allPagesPrintRef.current || modalSheetRef.current || statementSheetRef.current);
      const orientationParam = printOrientation === 'LANDSCAPE' ? 'landscape' : 'portrait';
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
    if (!appliedFilter || !appliedPartner) {
      alert(`يرجى الضغط على زر «عرض البيانات» أولاً لعرض كشف الحساب قبل التصدير.`);
      return;
    }

    const isSinglePage = typeof targetPageOnly === 'boolean' && targetPageOnly === true;

    let target: HTMLElement | null = null;
    if (isSinglePage && modalSheetRef.current) {
      target = modalSheetRef.current.querySelector<HTMLElement>('[data-statement-sheet="true"]') || (modalSheetRef.current.firstElementChild as HTMLElement) || modalSheetRef.current;
    } else {
      // Export ALL pages: use allPagesPrintRef.current directly (which contains all paginated page chunks)
      target = allPagesPrintRef.current
        || (showPrintPreviewModal && modalSheetRef.current ? modalSheetRef.current : null)
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
      const isVendorPartner = appliedFilter.partnerType === 'VENDOR';
      const cleanPartnerName = (appliedPartner.name || (isVendorPartner ? 'مورد' : 'عميل')).replace(/\s+/g, '_');
      const filename = `كشف_حساب_${isVendorPartner ? 'مورد' : 'عميل'}_${cleanPartnerName}_${appliedFilter.dateFrom}_إلى_${appliedFilter.dateTo}.pdf`;

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

  // Export to Excel: Builds comprehensive official spreadsheet with company branding & stamp note
  const handleExportExcel = () => {
    if (!appliedFilter || !appliedPartner) {
      alert(`يرجى الضغط على زر «عرض البيانات» أولاً لعرض كشف الحساب قبل التصدير.`);
      return;
    }

    try {
      setIsExportingExcel(true);
      const isVendorPartner = appliedFilter.partnerType === 'VENDOR';
      const roleLabel = isVendorPartner ? 'مورد' : 'عميل';
      const cleanPartnerName = (appliedPartner.name || roleLabel).replace(/\s+/g, '_');
      const filename = `كشف_حساب_${roleLabel}_${cleanPartnerName}_${appliedFilter.dateFrom}_إلى_${appliedFilter.dateTo}`;
      const statementTitle = isVendorPartner ? 'كشف حساب مورد معتمد' : 'كشف حساب عميل معتمد';

      exportToXLSX({
        filename,
        sheetName: statementTitle,
        title: `${statementTitle}: ${appliedPartner.name}`,
        subtitle: `اسم ال${roleLabel}: ${appliedPartner.name} | كود: ${appliedPartner.code || '-'} | الهاتف: ${appliedPartner.phone || '-'} | الرقم الضريبي: ${appliedPartner.taxNumber || '-'} | نطاق الفترة: من ${appliedFilter.dateFrom} إلى ${appliedFilter.dateTo}`,
        headers: ['مدين (Debit)', 'دائن (Credit)', 'الرصيد التراكمي', 'حالة الرصيد', 'رقم القيد / المستند', 'تاريخ القيد', 'البيان والشرح المحاسبي'],
        rows: statementCalculation.rows.map(r => {
          let balType = 'متزن';
          if (r.runningBalance !== 0) {
            if (isVendorPartner) {
              balType = r.runningBalance < 0 ? 'دائن للمورد' : 'مدين للمورد';
            } else {
              balType = r.runningBalance > 0 ? 'مدين على العميل' : 'دائن للعميل';
            }
          }
          return [
            r.debit > 0 ? r.debit : 0,
            r.credit > 0 ? r.credit : 0,
            Math.abs(r.runningBalance),
            balType,
            r.docNumber,
            r.date,
            r.description
          ];
        }),
        summaryRows: [
          [
            statementCalculation.periodTotals.debit,
            statementCalculation.periodTotals.credit,
            '-',
            '-',
            '-',
            '-',
            'إجمالي حركات الفترة المحددة'
          ],
          [
            statementCalculation.periodNetChange > 0 ? statementCalculation.periodNetChange : 0,
            statementCalculation.periodNetChange < 0 ? Math.abs(statementCalculation.periodNetChange) : 0,
            Math.abs(statementCalculation.periodNetChange),
            statementCalculation.periodNetChange >= 0 ? 'صافي مدين' : 'صافي دائن',
            '-',
            '-',
            'صافي حركة الحساب خلال الفترة'
          ],
          [
            statementCalculation.finalBalance > 0 ? statementCalculation.finalBalance : 0,
            statementCalculation.finalBalance < 0 ? Math.abs(statementCalculation.finalBalance) : 0,
            Math.abs(statementCalculation.finalBalance),
            finalBalanceLabel,
            '-',
            '-',
            `الرصيد الختامي النهائي المطلوب سداده (${finalBalanceLabel})`
          ],
          [],
          ['كشف حساب رسمي معتمد صادر من الإدارة المالية', '', '', '', '', '', `المنشأة: ${company.nameAr}`],
          ['إعداد: المحاسب', 'مراجعة الحسابات', 'المدير المالي', `اعتماد ومطابقة ${roleLabel}`, '', '', 'الختم المالي: معتمد ومطابق']
        ]
      });
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('حدث خطأ أثناء تصدير ملف Excel، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Generate WhatsApp formatted financial message
  const generateWhatsAppMessage = useCallback(() => {
    if (!appliedFilter || !appliedPartner) return '';
    const isVendorPartner = appliedFilter.partnerType === 'VENDOR';
    const partnerTypeLabel = isVendorPartner ? 'مورد' : 'عميل';
    const balanceNum = statementCalculation.finalBalance;
    const balanceText = `${Math.abs(balanceNum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencySymbol}`;
    
    // Clean tafqeet to strictly ensure "... فقط لا غير" without duplicate "فقط" or "لا غير"
    const rawTafqeet = balanceNum !== 0 ? tafqeet(Math.abs(balanceNum)).trim() : '';
    const cleanTafqeetBody = rawTafqeet
      .replace(/^فقط\s+/i, '')
      .replace(/\s+فقط\s+لا\s+غير$/i, '')
      .replace(/\s+لا\s+غير$/i, '')
      .trim();
    const tafqeetText = balanceNum !== 0 
      ? `${cleanTafqeetBody} فقط لا غير` 
      : `صفر ${currencyFullNameAr || 'ريال سعودي'} فقط لا غير (حساب متزن ومطابق)`;

    return `🏢 *${company.nameAr || 'الشركة'}*
📄 *كشف حساب ${partnerTypeLabel} رسمي*
━━━━━━━━━━━━━━━━━━━━
👤 *الاسم:* ${appliedPartner.name}
🏷️ *كود الحساب:* ${appliedPartner.code || appliedPartner.id}
📅 *الفترة:* من ${appliedFilter.dateFrom} إلى ${appliedFilter.dateTo}

📊 *الملخص المالي والمحاسبي:*
• رصيد سابق (أول المدة): ${Math.abs(statementCalculation.openingBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencySymbol}
• إجمالي حركات المدين: ${statementCalculation.periodTotals.debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencySymbol}
• إجمالي حركات الدائن: ${statementCalculation.periodTotals.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencySymbol}
━━━━━━━━━━━━━━━━━━━━
💰 *صافي الرصيد المستحق:* ${balanceText} (${finalBalanceLabel})
✍️ *المبلغ بالحروف:* ${tafqeetText}

يرجى التكرم بمراجعة ومطابقة الرصيد.
شاكرين ومقدرين حسن تعاونكم معنا.`;
  }, [appliedFilter, appliedPartner, statementCalculation, company, currencySymbol, currencyFullNameAr, finalBalanceLabel, tafqeet]);

  const handleOpenWhatsAppModal = () => {
    if (!appliedFilter || !appliedPartner) {
      alert(`يرجى الضغط على زر «عرض البيانات» أولاً لعرض كشف الحساب.`);
      return;
    }
    const cleanPhone = (appliedPartner.phone || '').replace(/[^\d+]/g, '');
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
    if (!appliedFilter || !appliedPartner) return;
    try {
      setIsGeneratingPdfForWhatsApp(true);
      const isVendor = appliedFilter.partnerType === 'VENDOR';
      const partnerTypeLabel = isVendor ? 'مورد' : 'عميل';
      const cleanPartnerName = (appliedPartner.name || partnerTypeLabel).replace(/\s+/g, '_');
      const filename = `كشف_حساب_${isVendor ? 'مورد' : 'عميل'}_${cleanPartnerName}_${appliedFilter.dateFrom}_إلى_${appliedFilter.dateTo}.pdf`;

      const target = allPagesPrintRef.current
        || (showPrintPreviewModal && modalSheetRef.current ? modalSheetRef.current : null)
        || statementSheetRef.current
        || document.querySelector<HTMLElement>('[data-statement-sheet="true"]');

      if (!target) {
        throw new Error('تعذر العثور على نموذج كشف الحساب المعتمد لتصدير PDF');
      }

      const balanceText = `${Math.abs(statementCalculation.finalBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currencySymbol}`;
      const companionText = `مرحباً بك، مرفق لكم كشف حساب ${partnerTypeLabel} رسمي معتمد لـ (${appliedPartner.name}) للفترة من ${appliedFilter.dateFrom} إلى ${appliedFilter.dateTo} بصافي رصيد مستحق قدره ${balanceText} (${finalBalanceLabel}).`;

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
              title: `كشف حساب ${partnerTypeLabel} - ${appliedPartner.name}`,
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

      alert('تم تصدير ملف كشف الحساب PDF بنجاح 📄. تم فتح محادثة الواتساب لإرفاقه مباشرة.');
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
      alert('تم إعداد النص بنجاح.');
    }
  };

  const handleResetWhatsAppMessage = () => {
    setWhatsAppMessageText(generateWhatsAppMessage());
  };

  // Direct redirection to the original document screen & record
  const handleOpenOriginalDocument = (row: DisplayRow) => {
    if (!row || row.isOpeningRow || !row.rawDoc) return;

    const doc = row.rawDoc;
    const txType = row.txType;
    const docNumber = (row.docNumber || '').replace(/^#/, '').trim();
    const docId = String(doc?.id || row.id || '');

    // Sales Invoices
    if (txType === 'SALES_INVOICE' || doc?.invoiceType?.includes('SALES') || doc?.invoiceNumber?.startsWith?.('INV') || (doc?.items && doc?.totals && !doc?.supplierRef)) {
      try {
        sessionStorage.setItem('alpha_target_sales_invoice_id', docId);
        sessionStorage.setItem('alpha_target_sales_invoice_number', doc?.invoiceNumber || docNumber);
      } catch {}
      if (onNavigate) {
        onNavigate('sales');
        return;
      }
    }

    // Purchase Invoices
    if (txType === 'PURCHASE_INVOICE' || doc?.invoiceType?.includes('PURCHASE') || doc?.supplierRef || doc?.invoiceNumber?.startsWith?.('PO')) {
      try {
        sessionStorage.setItem('alpha_target_purchase_invoice_id', docId);
        sessionStorage.setItem('alpha_target_purchase_invoice_number', doc?.invoiceNumber || docNumber);
      } catch {}
      if (onNavigate) {
        onNavigate('purchases');
        return;
      }
    }

    // Receipts / Payments / Journals
    if (txType === 'RECEIPT_VOUCHER') {
      try {
        sessionStorage.setItem('alpha_target_voucher_id', docId);
        sessionStorage.setItem('alpha_target_voucher_number', doc?.voucherNumber || docNumber);
      } catch {}
      if (onNavigate) {
        onNavigate('externalReceipt');
      } else {
        window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'externalReceipt' } }));
      }
      return;
    }
    if (txType === 'PAYMENT_VOUCHER') {
      try {
        sessionStorage.setItem('alpha_target_voucher_id', docId);
        sessionStorage.setItem('alpha_target_voucher_number', doc?.voucherNumber || docNumber);
      } catch {}
      if (onNavigate) {
        onNavigate('externalPayment');
      } else {
        window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'externalPayment' } }));
      }
      return;
    }
    if (txType === 'JOURNAL_ENTRY') {
      try {
        sessionStorage.setItem('alpha_target_journal_entry_id', docId);
        sessionStorage.setItem('alpha_target_journal_entry_number', doc?.entryNumber || docNumber);
      } catch {}
      if (onNavigate) {
        onNavigate('journal');
      } else {
        window.dispatchEvent(new CustomEvent('alpha-navigate', { detail: { view: 'journal' } }));
      }
      return;
    }

    // Fallback: View in modal
    setSelectedDocForModal(row);
  };

  // Render a Single Discrete Physical A4 Page for Customer / Vendor Statement
  const renderOfficialStatementPage = (chunk: CustomerStatementPageChunk, isForModal: boolean = false) => {
    const activePartner = appliedPartner || currentPartner;
    if (!activePartner) return null;

    const isBW = statementColorMode === 'BW';
    const isLandscape = printOrientation === 'LANDSCAPE';
    const isVendorPartner = appliedFilter ? appliedFilter.partnerType === 'VENDOR' : isVendor;
    const activePartnerLabelAr = isVendorPartner ? 'مورد' : 'عميل';
    const activeStatementTitleAr = isVendorPartner ? 'كشف حساب مورد معتمد' : 'كشف حساب عميل معتمد';
    const activeCodePrefix = isVendorPartner ? 'VEND' : 'CUST';
    const activeDateFrom = appliedFilter ? appliedFilter.dateFrom : dateFrom;
    const activeDateTo = appliedFilter ? appliedFilter.dateTo : dateTo;

    const nowStr = new Date().toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const nowTimeStr = new Date().toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit'
    });

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
            ? 'p-6 sm:p-8 w-full max-w-[1240px] shadow-sm rounded-2xl'
            : isForModal 
              ? 'p-6 sm:p-8 w-full max-w-4xl shadow-md rounded-xl' 
              : 'p-6 sm:p-10 w-full max-w-[1020px] shadow-sm rounded-2xl'
        }`}
        style={{ fontFamily: "'Cairo', 'IBM Plex Sans Arabic', Tahoma, system-ui, -apple-system, sans-serif" }}
        dir="rtl"
      >
        {/* 1. Header with Company Branding & Document Badge */}
        {chunk.isFirstPage ? (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b-2 border-slate-700 mb-6">
              <div className="flex items-center gap-3.5">
                {company.logoUrl ? (
                  <img 
                    src={company.logoUrl} 
                    alt="Logo" 
                    className={`w-16 h-16 object-contain rounded-lg border border-slate-200 p-1 ${isBW ? 'filter grayscale contrast-125' : ''}`} 
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-700 text-white flex items-center justify-center font-black text-xl shrink-0 shadow-xs">
                    {company.nameAr ? company.nameAr.charAt(0) : 'L'}
                  </div>
                )}
                <div>
                  <h1 
                    className="text-lg sm:text-xl font-black text-slate-950 leading-tight"
                    style={{ letterSpacing: 'normal', fontFeatureSettings: '"liga" 1, "calt" 1' }}
                  >
                    {company.nameAr}
                  </h1>
                  {company.nameEn && (
                    <p className="text-xs text-slate-500 font-medium tracking-wide">
                      {company.nameEn}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-slate-600 mt-1 font-semibold flex-wrap">
                    {company.taxNumber && (
                      <span>الرقم الضريبي: <b className="font-mono text-slate-900">{company.taxNumber}</b></span>
                    )}
                    {company.commercialRegister && (
                      <span>س.ت: <b className="font-mono text-slate-900">{company.commercialRegister}</b></span>
                    )}
                    {company.phone && (
                      <span dir="ltr">{company.phone}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right sm:text-left self-stretch sm:self-auto shrink-0 flex flex-col items-start sm:items-end">
                <div className="inline-block bg-slate-700 text-white text-xs sm:text-sm font-black px-4 py-1.5 rounded-lg shadow-2xs">
                  {activeStatementTitleAr}
                </div>
                <div className="text-[10px] text-slate-500 mt-1.5 font-medium space-y-0.5">
                  <div>تاريخ الإصدار: <span className="font-bold text-slate-700">{nowStr}</span></div>
                  <div>وقت الإصدار: <span className="font-mono font-bold text-slate-700">{nowTimeStr}</span></div>
                  <div className="flex items-center gap-1 justify-end text-slate-700">
                    <span className="text-slate-500">عدد الصفحات:</span>
                    <span className={`font-bold font-mono px-1.5 py-0.2 rounded text-[10px] ${
                      isBW 
                        ? 'text-slate-800 bg-slate-100 border border-slate-300' 
                        : 'text-blue-900 bg-blue-50 border border-blue-200'
                    }`}>
                      {chunk.totalPages} {chunk.totalPages === 1 ? 'صفحة A4' : chunk.totalPages === 2 ? 'صفحتان A4' : 'صفحات A4'}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-xs">
              <div className="space-y-1.5 border-b md:border-b-0 md:border-l md:border-slate-200 pb-3 md:pb-0 md:pl-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-bold">اسم {activePartnerLabelAr}:</span>
                  <span className="font-black text-slate-900 text-sm">{activePartner.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-bold">كود الحساب:</span>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                    isBW 
                      ? 'bg-slate-200 text-slate-900 border border-slate-300' 
                      : 'text-blue-800 bg-blue-100/70'
                  }`}>
                    {activePartner.code || `${activeCodePrefix}-${activePartner.id}`}
                  </span>
                </div>
                {activePartner.phone && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-bold">رقم الهاتف:</span>
                    <span className="font-mono font-bold text-slate-800" dir="ltr">{activePartner.phone}</span>
                  </div>
                )}
                {activePartner.address && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-bold">العنوان:</span>
                    <span className="text-slate-700">{activePartner.address}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-bold">نطاق فترة الكشف:</span>
                  <span className="font-mono font-bold text-slate-800">من {activeDateFrom} إلى {activeDateTo}</span>
                </div>
                {activePartner.taxNumber ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-bold">الرقم الضريبي لل{activePartnerLabelAr}:</span>
                    <span className="font-mono font-bold text-slate-800">{activePartner.taxNumber}</span>
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
                      ? 'bg-slate-100 text-slate-950 border border-slate-900'
                      : statementCalculation.finalBalance !== 0
                        ? isVendor 
                          ? statementCalculation.finalBalance < 0 ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                          : statementCalculation.finalBalance > 0 ? 'bg-rose-100 text-rose-900' : 'bg-emerald-100 text-emerald-900'
                        : 'bg-slate-200 text-slate-800'
                  }`}>
                    {finalBalanceFormatted}
                  </span>
                  <span className="text-[11px] font-bold text-slate-600">({finalBalanceLabel})</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Compact Running Header on Continuation Pages (Page 2+) */
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b-2 border-slate-700 mb-5 text-xs">
            <div className="flex items-center gap-2.5">
              {company.logoUrl ? (
                <img 
                  src={company.logoUrl} 
                  alt="Logo" 
                  className={`w-9 h-9 object-contain rounded border border-slate-200 p-0.5 ${isBW ? 'filter grayscale' : ''}`} 
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-slate-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {company.nameAr ? company.nameAr.charAt(0) : 'L'}
                </div>
              )}
              <div>
                <span className="font-black text-slate-900 block leading-tight">{company.nameAr}</span>
                <span className="text-[10px] text-slate-500 font-medium">{activeStatementTitleAr}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-700 flex-wrap">
              <div className="flex items-center gap-1.5 font-bold">
                <span className="text-slate-500">ال{activePartnerLabelAr}:</span>
                <span className="text-slate-950 font-black">{activePartner.name}</span>
                <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  {activePartner.code || `${activeCodePrefix}-${activePartner.id}`}
                </span>
              </div>
              <div className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                isBW ? 'text-slate-800 bg-slate-100 border border-slate-300' : 'text-blue-900 bg-blue-50 border border-blue-200'
              }`}>
                صفحة {chunk.pageNumber} من {chunk.totalPages}
              </div>
            </div>
          </div>
        )}

        {/* 3. Accounting Statement Table */}
        <div className="overflow-x-auto border-2 border-slate-500 rounded-xl mb-6 shadow-2xs">
          <table className="w-full text-right border-collapse text-[11px] sm:text-xs">
            <thead>
              <tr className={`font-black text-center divide-x divide-x-reverse ${
                isBW 
                  ? 'bg-slate-100 text-slate-800 border-b-2 border-slate-500 divide-slate-400' 
                  : 'bg-slate-700 text-white divide-slate-500'
              }`}>
                <th className={`py-2.5 px-3 w-28 ${isBW ? 'bg-slate-100 text-slate-800 border-l border-slate-400' : 'bg-rose-900/90'}`}>
                  مدين (Debit)
                </th>
                <th className={`py-2.5 px-3 w-28 ${isBW ? 'bg-slate-100 text-slate-800 border-l border-slate-400' : 'bg-emerald-900/90'}`}>
                  دائن (Credit)
                </th>
                <th className={`py-2.5 px-3.5 w-36 ${isBW ? 'bg-slate-100 text-slate-800 border-l border-slate-400' : 'bg-slate-700 border-l border-slate-500'}`}>
                  الرصيد التراكمي
                </th>
                <th className={`py-2.5 px-3 w-28 ${isBW ? 'bg-slate-100 text-slate-800 border-l border-slate-400' : 'bg-slate-700 text-white border-l border-slate-500'}`}>
                  رقم المستند / القيد
                </th>
                <th className={`py-2.5 px-3 w-24 ${isBW ? 'bg-slate-100 text-slate-800 border-l border-slate-400' : 'bg-slate-700 text-white border-l border-slate-500'}`}>
                  التاريخ
                </th>
                <th className={`py-2.5 px-4 text-right ${isBW ? 'bg-slate-100 text-slate-800' : 'bg-slate-700 text-white'}`}>
                  البيان والشرح المحاسبي
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-400">
              {/* Opening Carried Balance Row on Continuation Pages */}
              {!chunk.isFirstPage && (
                <tr className={`font-bold border-b-2 text-xs ${
                  isBW ? 'bg-slate-100 border-slate-500 text-slate-900' : 'bg-amber-50/80 border-amber-300 text-slate-950'
                }`}>
                  <td className="py-2 px-3 text-center font-mono border-l border-slate-400 text-slate-400">-</td>
                  <td className="py-2 px-3 text-center font-mono border-l border-slate-400 text-slate-400">-</td>
                  <td className={`py-2 px-3 text-center font-mono font-black border-l border-slate-400 ${
                    isBW ? 'text-slate-900 bg-slate-200/80' : 'text-blue-900 bg-blue-50/60'
                  }`}>
                    {Math.abs(chunk.openingCarriedBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-3 text-center font-mono font-bold text-slate-500 border-l border-slate-400">-</td>
                  <td className="py-2 px-3 text-center font-mono text-slate-500 border-l border-slate-400">-</td>
                  <td className={`py-2 px-4 text-right font-black ${isBW ? 'text-slate-800' : 'text-amber-900'}`}>
                    ↳ رصيد منقول / مرحل من الصفحة السابقة (صفحة {chunk.pageNumber - 1})
                  </td>
                </tr>
              )}

              {chunk.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-bold text-xs bg-slate-50">
                    لا توجد حركات مسجلة لهذا الحساب خلال الفترة المحددة
                  </td>
                </tr>
              ) : (
                chunk.rows.map((row, idx) => {
                  const bal = row.runningBalance;
                  let balBadgeText = 'متزن';
                  let balBadgeClass = 'text-slate-500';

                  if (bal !== 0) {
                    if (isBW) {
                      balBadgeText = isVendor ? (bal < 0 ? 'دائن' : 'مدين') : (bal > 0 ? 'مدين' : 'دائن');
                      balBadgeClass = 'text-slate-800 font-bold';
                    } else if (isVendor) {
                      if (bal < 0) {
                        balBadgeText = 'دائن';
                        balBadgeClass = 'text-emerald-700 font-bold';
                      } else {
                        balBadgeText = 'مدين';
                        balBadgeClass = 'text-rose-700 font-bold';
                      }
                    } else {
                      if (bal > 0) {
                        balBadgeText = 'مدين';
                        balBadgeClass = 'text-rose-700 font-bold';
                      } else {
                        balBadgeText = 'دائن';
                        balBadgeClass = 'text-emerald-700 font-bold';
                      }
                    }
                  }

                  const rawItemsList = Array.isArray(row.rawDoc?.items) && row.rawDoc.items.length > 0
                    ? row.rawDoc.items
                    : Array.isArray(row.rawDoc?.lines) && row.rawDoc.lines.length > 0
                    ? row.rawDoc.lines
                    : [];
                  const hasItems = !row.isOpeningRow && (row.txType === 'SALES_INVOICE' || row.txType === 'PURCHASE_INVOICE') && rawItemsList.length > 0;
                  const isExpanded = hasItems && (includeItemsInPrint || areAllInvoicesExpanded || Boolean(expandedInvoices[row.id]));

                  const isSelected = selectedStatementRowId === row.id;

                  return (
                    <React.Fragment key={row.id || idx}>
                      <tr 
                        onClick={() => setSelectedStatementRowId(isSelected ? null : row.id)}
                        className={`group cursor-pointer transition-all duration-200 origin-center relative select-none ${
                          row.isOpeningRow 
                            ? isBW 
                              ? 'bg-slate-100 font-bold border-b-2 border-slate-500 text-slate-800'
                              : 'bg-amber-50/80 font-bold border-b-2 border-amber-300' 
                            : isSelected
                            ? 'scale-[1.018] -translate-y-0.5 z-30 shadow-2xl ring-2 ring-indigo-600 bg-indigo-50/95 font-bold'
                            : 'hover:scale-[1.018] hover:-translate-y-0.5 hover:z-20 hover:shadow-xl hover:ring-2 hover:ring-indigo-400 hover:bg-white ' + (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60')
                        }`}
                        title="انقر أو قف على الحركة لتكبيرها وتوضيح تفاصيلها"
                      >
                        {/* مدين */}
                        <td className={`py-2 px-3 text-center font-mono border-l border-slate-400 ${
                          row.debit > 0 
                            ? (isBW ? 'text-slate-800 font-bold' : 'text-rose-800 font-black') 
                            : 'text-slate-300'
                        }`}>
                          {row.debit > 0 ? (
                            <span className="group-hover:scale-115 inline-block transition-transform">
                              {row.debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : '-'}
                        </td>

                        {/* دائن */}
                        <td className={`py-2 px-3 text-center font-mono border-l border-slate-400 ${
                          row.credit > 0 
                            ? (isBW ? 'text-slate-800 font-bold' : 'text-emerald-800 font-black') 
                            : 'text-slate-300'
                        }`}>
                          {row.credit > 0 ? (
                            <span className="group-hover:scale-115 inline-block transition-transform">
                              {row.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : '-'}
                        </td>

                        {/* الرصيد التراكمي */}
                        <td className="py-2 px-3 text-center font-mono font-bold border-l border-slate-400">
                          <span className={`inline-block group-hover:scale-110 transition-transform ${isBW ? 'text-slate-900 font-bold' : ''}`}>
                            {Math.abs(row.runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className={`text-[10px] mr-1 ${balBadgeClass}`}>({balBadgeText})</span>
                        </td>

                        {/* رقم القيد / المستند */}
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-800 border-l border-slate-400 group-hover:scale-105 transition-transform">
                          {row.docNumber || '-'}
                        </td>

                        {/* التاريخ */}
                        <td className="py-2 px-3 text-center font-mono text-slate-700 border-l border-slate-400 whitespace-nowrap group-hover:scale-105 transition-transform">
                          {row.date || '-'}
                        </td>

                        {/* البيان والشرح مع إمكانية طي وفرد الأصناف */}
                        <td className="py-2 px-4 text-right text-slate-800 font-medium group-hover:text-slate-950 group-hover:font-bold transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <span className="leading-relaxed">{row.description || '-'}</span>
                            {hasItems && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleInvoiceExpand(row.id);
                                }}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer print:hidden shrink-0 ${
                                  isExpanded 
                                    ? (isBW ? 'bg-slate-200 text-slate-800 border-slate-400' : 'bg-indigo-100 text-indigo-900 border-indigo-300 shadow-2xs')
                                    : (isBW ? 'bg-slate-100 text-slate-700 border-slate-400 hover:bg-slate-200' : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200')
                                }`}
                                title={isExpanded ? 'طي بنود وأصناف الفاتورة' : 'فرد وعرض تفاصيل أصناف الفاتورة'}
                              >
                                {isExpanded ? <ChevronUp size={11} className={isBW ? 'text-slate-700' : 'text-indigo-700'} /> : <ChevronDown size={11} className={isBW ? 'text-slate-600' : 'text-indigo-600'} />}
                                <span>{rawItemsList.length} صنف</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* تفاصيل الأصناف التابعة للفاتورة بصرياً (Expandable Sub-items Card) */}
                      {hasItems && isExpanded && (
                        <tr className={isBW ? 'bg-slate-50' : 'bg-indigo-50/25'}>
                          <td colSpan={6} className="p-2 sm:p-3 border-b-2 border-slate-400">
                            <div className={`rounded-xl p-3 border-2 shadow-2xs text-xs ${
                              isBW 
                                ? 'bg-white border-slate-400 border-r-4 border-r-slate-500' 
                                : 'bg-white border-slate-300 border-r-4 border-r-indigo-600'
                            }`}>
                              <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-300 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <Package size={14} className={isBW ? 'text-slate-600' : 'text-indigo-600'} />
                                  <span className="font-bold text-slate-800 text-xs">
                                    محتويات تفصيلية لـ {row.txType === 'SALES_INVOICE' ? 'فاتورة المبيعات' : 'فاتورة المشتريات'} ({row.docNumber})
                                  </span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    isBW ? 'bg-slate-100 text-slate-700 border-slate-400' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  }`}>
                                    {rawItemsList.length} أصناف
                                  </span>
                                </div>
                                <div className="text-[11px] font-medium text-slate-500">
                                  تاريخ الفاتورة: <span className="font-mono text-slate-700" dir="ltr">{row.date}</span>
                                </div>
                              </div>

                              {/* جدول تفاصيل الأصناف والضريبة والخصومات */}
                              <div className="overflow-x-auto border border-slate-400 rounded-lg">
                                <table className="w-full text-right border-collapse text-[11px]">
                                  <thead>
                                    <tr className={`font-bold border-b border-slate-400 text-center ${
                                      isBW ? 'bg-slate-100 text-slate-800' : 'bg-slate-100 text-slate-700'
                                    }`}>
                                      <th className="py-1.5 px-2 w-8 border-l border-slate-400">#</th>
                                      <th className="py-1.5 px-3 text-right border-l border-slate-400">اسم الصنف / البيان</th>
                                      <th className="py-1.5 px-2 w-16 border-l border-slate-400">الكمية</th>
                                      <th className="py-1.5 px-2.5 w-24 border-l border-slate-400">سعر الوحدة</th>
                                      <th className="py-1.5 px-2 w-20 border-l border-slate-400">الخصم</th>
                                      <th className="py-1.5 px-2.5 w-24 border-l border-slate-400">الضريبة (15%)</th>
                                      <th className="py-1.5 px-3 w-28 text-left">الإجمالي شامل الضريبة</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-300">
                                    {rawItemsList.map((item: any, itIdx: number) => {
                                      const qty = Number(item.quantity ?? item.qty ?? 1);
                                      const price = Number(item.unitPrice ?? item.price ?? 0);
                                      const discount = Number(item.discount ?? item.discountAmount ?? 0);
                                      const taxRate = Number(item.taxRate ?? item.vatRate ?? item.tax ?? 15);
                                      const lineSubtotal = (qty * price) - discount;
                                      const taxAmount = Number(item.taxAmount ?? (lineSubtotal * (taxRate / 100)));
                                      const lineTotal = Number(item.total ?? item.netTotal ?? (lineSubtotal + taxAmount));
                                      const itemName = item.name || item.productName || item.itemName || item.description || `صنف #${itIdx + 1}`;
                                      const itemCode = item.code || item.productCode || item.sku || '';

                                      return (
                                        <tr key={itIdx} className="hover:bg-slate-50/60">
                                          <td className="py-1.5 px-2 text-center text-slate-400 font-mono border-l border-slate-300">{itIdx + 1}</td>
                                          <td className="py-1.5 px-3 text-right font-medium text-slate-800 border-l border-slate-300">
                                            <span>{itemName}</span>
                                            {itemCode && (
                                              <span className="text-[10px] font-mono text-slate-400 mr-1.5">[{itemCode}]</span>
                                            )}
                                          </td>
                                          <td className="py-1.5 px-2 text-center font-mono text-slate-700 border-l border-slate-300">{qty}</td>
                                          <td className="py-1.5 px-2.5 text-center font-mono text-slate-700 border-l border-slate-300">
                                            {price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </td>
                                          <td className="py-1.5 px-2 text-center font-mono text-slate-500 border-l border-slate-300">
                                            {discount > 0 ? discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                          </td>
                                          <td className="py-1.5 px-2.5 text-center font-mono text-slate-600 border-l border-slate-300">
                                            {taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </td>
                                          <td className="py-1.5 px-3 text-left font-mono font-bold text-slate-900">
                                            {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                  <tfoot className={`border-t-2 border-slate-400 font-bold text-[10px] ${
                                    isBW ? 'bg-slate-50 text-slate-700' : 'bg-indigo-50/50'
                                  }`}>
                                    <tr>
                                      <td colSpan={3} className="py-1.5 px-3 text-right text-slate-700 border-l border-slate-400">
                                        ملخص مبالغ الفاتورة:
                                      </td>
                                      <td className="py-1.5 px-2 text-center font-mono text-slate-700 border-l border-slate-400">
                                        قبل الضريبة: {(Number(row.rawDoc?.totals?.subtotal ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="py-1.5 px-2 text-center font-mono text-slate-600 border-l border-slate-400">
                                        الخصم: {(Number(row.rawDoc?.totals?.totalDiscount ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="py-1.5 px-2 text-center font-mono text-slate-700 border-l border-slate-400">
                                        الضريبة: {(Number(row.rawDoc?.totals?.taxAmount ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className={`py-1.5 px-3 text-left font-mono font-bold ${
                                        isBW ? 'text-slate-900' : 'text-indigo-900'
                                      }`}>
                                        {(Number(row.rawDoc?.totals?.grandTotal ?? (row.debit || row.credit))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* Tfoot Totals: Carried balance row if not last page; Full summary if last page */}
            {!chunk.isLastPage ? (
              <tfoot className={`font-bold border-t-2 ${isBW ? 'bg-slate-50 border-slate-500' : 'bg-slate-100 border-slate-700'}`}>
                <tr className="text-xs">
                  <td className="py-2.5 px-3 text-center font-mono text-slate-400 border-l border-slate-400">-</td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-400 border-l border-slate-400">-</td>
                  <td className={`py-2.5 px-3 text-center font-mono font-bold border-l border-slate-400 ${isBW ? 'text-slate-900 bg-slate-100' : 'text-blue-900 bg-blue-50/80'}`}>
                    {Math.abs(chunk.closingCarriedBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-400 border-l border-slate-400">-</td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-400 border-l border-slate-400">-</td>
                  <td className="py-2.5 px-4 text-right text-slate-900 font-bold">
                    ↳ رصيد مرحل للصفحة التالية (صفحة {chunk.pageNumber + 1})
                  </td>
                </tr>
              </tfoot>
            ) : (
              <tfoot className={`font-bold border-t-2 divide-y divide-slate-400 ${isBW ? 'bg-slate-50 border-slate-500' : 'bg-slate-100 border-slate-700'}`}>
                {/* 1. إجمالي حركات الفترة */}
                <tr>
                  <td className={`py-2.5 px-3 text-center font-mono font-bold border-l border-slate-400 ${
                    isBW ? 'text-slate-800' : 'text-rose-800 font-black'
                  }`}>
                    {statementCalculation.periodTotals.debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`py-2.5 px-3 text-center font-mono font-bold border-l border-slate-400 ${
                    isBW ? 'text-slate-800' : 'text-emerald-800 font-black'
                  }`}>
                    {statementCalculation.periodTotals.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-center border-l border-slate-400 text-slate-400 font-mono">-</td>
                  <td colSpan={3} className="py-2.5 px-4 text-right text-slate-800 font-bold">
                    إجمالي حركات الفترة المحددة (مجموع حركات المدين والدائن)
                  </td>
                </tr>

                {/* 2. صافي حركة الفترة */}
                <tr className="bg-slate-50/60">
                  <td colSpan={2} className="py-2 px-3 text-center font-mono font-bold border-l border-slate-400 text-slate-800">
                    {Math.abs(statementCalculation.periodNetChange).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                    <span className="text-[10px] mr-1 text-slate-600">
                      ({statementCalculation.periodNetChange >= 0 ? 'صافي مدين' : 'صافي دائن'})
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center border-l border-slate-400 text-slate-400 font-mono">-</td>
                  <td colSpan={3} className="py-2.5 px-4 text-right text-slate-700 font-medium">
                    صافي حركة الحساب خلال الفترة المحددة فقط
                  </td>
                </tr>

                {/* 3. صف المبلغ المتبقي (سواء دائن أو مدين) */}
                <tr className={`border-t-2 ${
                  isBW 
                    ? 'border-slate-500 bg-slate-100 text-slate-800 font-bold' 
                    : statementCalculation.finalBalance > 0
                      ? 'border-slate-700 bg-rose-50/90 text-rose-950'
                      : statementCalculation.finalBalance < 0
                        ? 'border-slate-700 bg-emerald-50/90 text-emerald-950'
                        : 'border-slate-700 bg-slate-100 text-slate-900'
                }`}>
                  {/* مدين: إذا كان الرصيد المتبقي مدين */}
                  <td className={`py-3 px-3 text-center font-mono font-bold text-xs sm:text-sm border-l border-slate-400 ${
                    statementCalculation.finalBalance > 0 
                      ? (isBW ? 'text-slate-900 font-bold' : 'text-rose-700 font-black') 
                      : 'text-slate-400 font-mono'
                  }`}>
                    {statementCalculation.finalBalance > 0
                      ? statementCalculation.finalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '-'}
                  </td>

                  {/* دائن: إذا كان الرصيد المتبقي دائن */}
                  <td className={`py-3 px-3 text-center font-mono font-bold text-xs sm:text-sm border-l border-slate-400 ${
                    statementCalculation.finalBalance < 0 
                      ? (isBW ? 'text-slate-900 font-bold' : 'text-emerald-700 font-black') 
                      : 'text-slate-400 font-mono'
                  }`}>
                    {statementCalculation.finalBalance < 0
                      ? Math.abs(statementCalculation.finalBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '-'}
                  </td>

                  {/* عمود الرصيد المتبقي الإجمالي مع الشارة */}
                  <td className="py-3 px-3 text-center font-mono font-bold text-xs sm:text-sm border-l border-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <span className={isBW ? 'text-slate-900' : 'text-blue-900 font-black'}>
                        {finalBalanceFormatted}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${
                        isBW
                          ? 'bg-slate-200 text-slate-800 border border-slate-400'
                          : statementCalculation.finalBalance > 0
                            ? 'bg-rose-100 text-rose-800'
                            : statementCalculation.finalBalance < 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                      }`}>
                        {statementCalculation.finalBalance > 0 ? 'رصيد متبقي (مدين)' : statementCalculation.finalBalance < 0 ? 'رصيد متبقي (دائن)' : 'حساب متزن'}
                      </span>
                    </div>
                  </td>

                  {/* البيان والشرح */}
                  <td colSpan={3} className="py-3 px-4 text-right">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-bold text-xs sm:text-sm text-slate-800">
                        المبلغ المتبقي المستحق ({statementCalculation.finalBalance > 0 ? 'مدين' : statementCalculation.finalBalance < 0 ? 'دائن' : 'متزن'}):
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        isBW 
                          ? 'bg-slate-200 text-slate-800 border border-slate-400' 
                          : statementCalculation.finalBalance > 0 
                            ? 'bg-rose-200/80 text-rose-900' 
                            : statementCalculation.finalBalance < 0 
                              ? 'bg-emerald-200/80 text-emerald-900' 
                              : 'bg-slate-200 text-slate-800'
                      }`}>
                        {finalBalanceLabel}
                      </span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* 3.5 Official Certified Tafqeet in Arabic Words (On Last Page) */}
        {chunk.isLastPage && (
          <div className={`rounded-xl p-3.5 mb-5 border ${
            isBW 
              ? 'bg-slate-50 border-slate-300 text-slate-800' 
              : statementCalculation.finalBalance > 0
                ? 'bg-rose-50/70 border-rose-200 text-slate-900'
                : statementCalculation.finalBalance < 0
                  ? 'bg-emerald-50/70 border-emerald-200 text-slate-900'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
          }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText size={14} className={isBW ? 'text-slate-600' : 'text-blue-700'} />
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
                    <span className={`font-bold px-3 py-1 rounded-lg border text-xs sm:text-sm font-mono ${
                      isBW 
                        ? 'bg-white border-slate-300 text-slate-800' 
                        : 'bg-white border-slate-300 text-slate-900 shadow-2xs'
                    }`}>
                      {displayTafqeet}
                    </span>
                  );
                })()}
              </div>

              <div className="flex items-center gap-2 text-[11px] font-bold">
                <span className="text-slate-500">حالة المطابقة:</span>
                <span className={`px-2.5 py-0.5 rounded-full font-bold ${
                  isBW 
                    ? 'bg-slate-100 text-slate-800 border border-slate-300' 
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
        )}

        {/* 4. Official Signatures and Certified Stamp (On Last Page) */}
        {chunk.isLastPage && (
          <div className={`flex flex-col sm:flex-row justify-between items-center gap-6 pt-6 border-t-2 ${isBW ? 'border-slate-300' : 'border-slate-300'} text-xs text-slate-700`}>
            {/* 4 Official Signature Blocks */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 text-center w-full sm:w-auto">
              <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/60">
                <p className="font-bold text-slate-800">إعداد / المحاسب</p>
                <div className="h-10 border-b border-dashed border-slate-400 mt-2 mb-1"></div>
                <p className="text-[10px] text-slate-500">التوقيع والتاريخ</p>
              </div>

              <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/60">
                <p className="font-bold text-slate-800">مراجعة وتدقيق</p>
                <div className="h-10 border-b border-dashed border-slate-400 mt-2 mb-1"></div>
                <p className="text-[10px] text-slate-500">التوقيع والتاريخ</p>
              </div>

              <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/60">
                <p className="font-bold text-slate-800">المدير المالي</p>
                <div className="h-10 border-b border-dashed border-slate-400 mt-2 mb-1"></div>
                <p className="text-[10px] text-slate-500">الاعتماد الرسمي</p>
              </div>

              <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/60">
                <p className="font-bold text-slate-800">اعتماد ومطابقة {activePartnerLabelAr}</p>
                <div className="h-10 border-b border-dashed border-slate-400 mt-2 mb-1"></div>
                <p className="text-[10px] text-slate-500">التوقيع / الختم</p>
              </div>
            </div>

            {/* Official Certified Stamp */}
            <div className="shrink-0 flex items-center justify-center">
              {company.stampUrl ? (
                <img 
                  src={company.stampUrl} 
                  alt="Official Stamp" 
                  className={`w-28 h-28 object-contain rotate-[-4deg] ${isBW ? 'grayscale contrast-100 opacity-90' : ''}`} 
                />
              ) : isBW ? (
                <div className="w-28 h-28 rounded-full border-2 border-dashed border-slate-400 flex flex-col items-center justify-center text-center p-2 bg-white text-slate-700 shadow-2xs rotate-[-4deg] select-none">
                  <span className="text-[8px] font-bold text-slate-800 leading-tight line-clamp-1" style={{ letterSpacing: 'normal', fontFeatureSettings: '"liga" 1, "calt" 1' }}>
                    {company.nameAr || 'لوجوستريا للأنظمة المحاسبية'}
                  </span>
                  <div className="my-0.5 px-2 py-0.5 bg-slate-200 text-slate-800 text-[8px] font-bold rounded-xs border border-slate-300">
                    معتمد
                  </div>
                  <span className="text-[7px] font-medium text-slate-600 leading-tight">
                    قسم الإدارة المالية
                  </span>
                  {company.taxNumber && (
                    <span className="text-[6px] font-mono text-slate-600 mt-0.5">ض: {company.taxNumber}</span>
                  )}
                  <span className="text-[6px] text-slate-700 mt-0.5 font-bold">
                    ★ مُعتمد ومُطابق ★
                  </span>
                </div>
              ) : (
                <div className="w-28 h-28 rounded-full border-4 border-double border-blue-900 flex flex-col items-center justify-center text-center p-2 bg-blue-50/50 text-blue-950 shadow-xs rotate-[-4deg] select-none">
                  <span className="text-[8px] font-black text-blue-900 leading-tight line-clamp-1" style={{ letterSpacing: 'normal', fontFeatureSettings: '"liga" 1, "calt" 1' }}>
                    {company.nameAr || 'لوجوستريا للأنظمة المحاسبية'}
                  </span>
                  <div className="my-0.5 px-2 py-0.5 bg-blue-900 text-white text-[8px] font-black rounded-xs">
                    معتمد
                  </div>
                  <span className="text-[7px] font-bold text-blue-800 leading-tight">
                    قسم الإدارة المالية
                  </span>
                  {company.taxNumber && (
                    <span className="text-[6px] font-mono text-slate-600 mt-0.5">ض: {company.taxNumber}</span>
                  )}
                  <span className="text-[6px] text-blue-950 mt-0.5 font-bold">
                    ★ مُعتمد ومُطابق ★
                  </span>
                </div>
              )}
            </div>
          </div>
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

  // Render the Official Certified Statement A4 Document (for modal single-page, multi-page, or direct print)
  const renderOfficialStatementSheet = (isForModal: boolean = false, targetChunk?: CustomerStatementPageChunk) => {
    const activePartner = appliedPartner || currentPartner;
    if (!activePartner) {
      return (
        <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          يرجى اختيار {partnerLabelAr} لعرض كشف حسابه
        </div>
      );
    }

    if (targetChunk) {
      return renderOfficialStatementPage(targetChunk, isForModal);
    }

    return (
      <div className="flex flex-col items-center w-full space-y-8 print:space-y-0" data-statement-all-pages="true">
        {paginatedChunks.map((chunk) => (
          <div key={`stmt-page-wrap-${chunk.pageNumber}`} className="w-full print:break-after-page page-sheet-wrapper">
            {renderOfficialStatementPage(chunk, isForModal)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-3 sm:p-6 space-y-5 max-w-7xl mx-auto" dir="rtl">
      
      {/* 1. Header Bar: Partner Type Tabs + Title */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
            <FileText size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-slate-900">
                كشف حساب عميل أو مورد
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                {partnerType === 'CUSTOMER' ? 'كشف حساب عميل' : 'كشف حساب مورد'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              كشف تفصيلي معتمد بالحركات والأرصدة التراكمية مع إمكانية التصدير والطباعة بالختم الرسمي
            </p>
          </div>
        </div>

        {/* Mode Switcher Tabs: كشف حساب عميل | كشف حساب مورد (3D) */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start md:self-auto">
          <button
            type="button"
            onClick={() => handleSwitchPartnerType('CUSTOMER')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              partnerType === 'CUSTOMER'
                ? 'bg-gradient-to-b from-blue-600 to-blue-800 text-white shadow-[0_3px_0_0_#1e3a8a,0_2px_4px_rgba(0,0,0,0.2)] border-t border-blue-400/40 active:translate-y-[2px]'
                : 'bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-700 border border-slate-300 shadow-[0_2px_0_0_#cbd5e1] active:translate-y-[1px]'
            }`}
          >
            <User size={15} />
            <span>كشف حساب عميل</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchPartnerType('VENDOR')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              partnerType === 'VENDOR'
                ? 'bg-gradient-to-b from-emerald-600 to-emerald-800 text-white shadow-[0_3px_0_0_#064e3b,0_2px_4px_rgba(0,0,0,0.2)] border-t border-emerald-400/40 active:translate-y-[2px]'
                : 'bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-700 border border-slate-300 shadow-[0_2px_0_0_#cbd5e1] active:translate-y-[1px]'
            }`}
          >
            <Truck size={15} />
            <span>كشف حساب مورد</span>
          </button>
        </div>
      </div>

      {/* 2. Top Filter & Control Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 print:hidden">
        
        {/* Row 1: Partner Selector Dropdown & Show Data on Right + Partner Profile Card on Left */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          
          {/* Partner Dropdown with Live Search + Show Data Button on Same Line */}
          <div className="flex-1 max-w-2xl">
            <label className="block text-xs font-black text-slate-800 mb-1.5 flex items-center justify-between">
              <span>اختيار ال{partnerLabelAr} (البحث بالاسم أو الكود أو الهاتف أو الضريبي)</span>
              {currentPartner && (
                <span className="text-[11px] font-mono text-blue-700 font-bold">
                  كود: {currentPartner.code || `${partnerCodePrefix}-${currentPartner.id}`}
                </span>
              )}
            </label>

            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(prev => !prev)}
                  className="w-full h-11 px-4 bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 hover:from-slate-50 hover:via-slate-150 hover:to-slate-250 border-2 border-slate-300 border-t-slate-200 border-b-slate-400 rounded-xl flex items-center justify-between text-right text-xs sm:text-sm font-black text-slate-900 transition-all cursor-pointer shadow-[0_4px_0_0_#64748b,0_5px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_5px_0_0_#475569,0_7px_12px_rgba(0,0,0,0.16)] hover:-translate-y-0.5 active:shadow-[0_1px_0_0_#64748b] active:translate-y-[3px]"
                >
                  <div className="flex items-center gap-2 truncate">
                    {isVendor ? (
                      <Truck size={16} className="text-slate-600 shrink-0" />
                    ) : (
                      <User size={16} className="text-slate-600 shrink-0" />
                    )}
                    {currentPartner ? (
                      <span className="truncate">
                        <span className="text-blue-800 font-mono font-black ml-1.5">
                          [{currentPartner.code || `${partnerCodePrefix}-${currentPartner.id}`}]
                        </span>
                        {currentPartner.name}
                      </span>
                    ) : (
                      <span className="text-slate-500 font-bold">اختر ال{partnerLabelAr} المطلوب...</span>
                    )}
                  </div>
                  <ChevronDown size={16} className="text-slate-600 shrink-0 mr-1" />
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute top-full right-0 left-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="p-2 border-b border-slate-100 bg-slate-50">
                      <div className="relative">
                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                        <input
                          type="text"
                          placeholder={`بحث باسم ال${partnerLabelAr} أو الكود أو الهاتف...`}
                          value={partnerSearchTerm}
                          onChange={(e) => setPartnerSearchTerm(e.target.value)}
                          className="w-full pr-9 pl-3 py-2 text-xs bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 border-2 border-slate-300 border-t-slate-200 border-b-slate-400 rounded-xl font-black text-slate-900 placeholder-slate-600 shadow-[0_3px_0_0_#64748b] focus:bg-white focus:outline-none focus:border-slate-500 transition-all"
                          autoFocus
                        />
                      </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                      {filteredPartners.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 font-medium">
                          لا يوجد {partnerLabelAr} مطابق لبحثك
                        </div>
                      ) : (
                        filteredPartners.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedPartnerId(p.id);
                              setIsDropdownOpen(false);
                              setPartnerSearchTerm('');
                              setAppliedFilter(null);
                            }}
                            className={`w-full px-3.5 py-2.5 text-right flex items-center justify-between text-xs hover:bg-blue-50 transition-colors cursor-pointer ${
                              selectedPartnerId === p.id ? 'bg-blue-50/70 font-bold text-blue-900' : 'text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                                {p.code || `${partnerCodePrefix}-${p.id}`}
                              </span>
                              <span className="truncate">{p.name}</span>
                            </div>
                            {selectedPartnerId === p.id && (
                              <CheckCircle2 size={14} className="text-blue-600 shrink-0 mr-2" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* زر عرض البيانات 3D في نفس سطر خانة اختيار العميل/المورد */}
              <button
                type="button"
                onClick={handleExecuteFetch}
                disabled={isLoadingData || !currentPartner}
                className="h-11 px-5 sm:px-6 bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white font-black rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all shadow-[0_4px_0_0_#1e3a8a,0_6px_10px_rgba(0,0,0,0.2)] hover:shadow-[0_5px_0_0_#1e3a8a] active:shadow-[0_1px_0_0_#1e3a8a] active:translate-y-[3px] border-t border-blue-400/50 cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                title="احتساب وعرض كشف الحساب"
              >
                <RefreshCw size={15} className={isLoadingData ? 'animate-spin' : ''} />
                <span className="whitespace-nowrap">{isLoadingData ? 'جاري التحميل...' : 'عرض البيانات'}</span>
              </button>
            </div>
          </div>

          {/* Partner Profile Badge on Left */}
          {currentPartner ? (
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 bg-slate-50 border border-slate-200 p-2 sm:p-2.5 px-3 sm:px-4 rounded-xl shadow-2xs">
              <div className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900">{currentPartner.name}</span>
                  {currentPartner.taxNumber && (
                    <span className="text-[10px] text-slate-500 hidden sm:inline">
                      الضريبي: <span className="font-mono font-bold text-slate-700">{currentPartner.taxNumber}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-slate-500 mt-0.5">
                  {currentPartner.phone && (
                    <span>الهاتف: <span className="font-mono font-bold text-slate-700" dir="ltr">{currentPartner.phone}</span></span>
                  )}
                  {appliedFilter ? (
                    <>
                      <span>•</span>
                      <span>الرصيد الختامي: <span className="font-mono font-black text-blue-800">{finalBalanceFormatted}</span></span>
                    </>
                  ) : (
                    <>
                      <span>•</span>
                      <span className="text-slate-400 font-medium">الرصيد: (اضغط عرض البيانات)</span>
                    </>
                  )}
                </div>
              </div>

              <div className="w-px h-8 bg-slate-200" />

              {/* Action Button: ملف العميل / ملف المورد (3D) */}
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate(isVendor ? 'vendors' : 'customers')}
                  className="px-3.5 py-2 bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 shadow-[0_3px_0_0_#1e3a8a] active:shadow-[0_1px_0_0_#1e3a8a] active:translate-y-[2px] border-t border-blue-400/50"
                  title={`الانتقال إلى بطاقة وملف ال${partnerLabelAr}`}
                >
                  {isVendor ? <Truck size={14} /> : <User size={14} />}
                  <span>ملف ال{partnerLabelAr}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400 font-medium self-center">
              يرجى اختيار {partnerLabelAr} لعرض كشف حسابه
            </div>
          )}
        </div>

        {/* Row 2: Date Filters (3D Prominent Gray) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <label className="block text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-700" />
              <span>من تاريخ:</span>
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
          <div className="space-y-1">
            <label className="block text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-700" />
              <span>إلى تاريخ:</span>
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
        </div>

        {/* Row 3: Action Buttons (3D tactile styling) */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          {/* Quick Date Presets (3D styling) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-black text-slate-600 ml-1">فترات سريعة:</span>
            <button
              type="button"
              onClick={() => setQuickRange('THIS_MONTH')}
              className="px-3 py-1.5 text-xs font-black rounded-xl bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-800 border border-slate-300 shadow-[0_2px_0_0_#cbd5e1] active:translate-y-[1px] transition-all cursor-pointer"
            >
              هذا الشهر
            </button>
            <button
              type="button"
              onClick={() => setQuickRange('THIS_QUARTER')}
              className="px-3 py-1.5 text-xs font-black rounded-xl bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-800 border border-slate-300 shadow-[0_2px_0_0_#cbd5e1] active:translate-y-[1px] transition-all cursor-pointer"
            >
              الربع الحالي
            </button>
            <button
              type="button"
              onClick={() => setQuickRange('THIS_YEAR')}
              className="px-3 py-1.5 text-xs font-black rounded-xl bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-800 border border-slate-300 shadow-[0_2px_0_0_#cbd5e1] active:translate-y-[1px] transition-all cursor-pointer"
            >
              العام الحالي
            </button>
            <button
              type="button"
              onClick={() => setQuickRange('ALL')}
              className="px-3 py-1.5 text-xs font-black rounded-xl bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-800 border border-slate-300 shadow-[0_2px_0_0_#cbd5e1] active:translate-y-[1px] transition-all cursor-pointer"
            >
              كل الحركات
            </button>

            {/* Quick Switcher for Black & White / Colors (3D) */}
            <div className="flex items-center bg-slate-100 border border-slate-300 rounded-xl p-0.5 mr-2 shadow-2xs">
              <button
                type="button"
                onClick={() => setStatementColorMode('COLOR')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                  statementColorMode === 'COLOR'
                    ? 'bg-gradient-to-b from-blue-600 to-blue-800 text-white shadow-[0_2px_0_0_#1e3a8a]'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="نمط ملون"
              >
                <Palette size={12} />
                <span>ألوان</span>
              </button>
              <button
                type="button"
                onClick={() => setStatementColorMode('BW')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                  statementColorMode === 'BW'
                    ? 'bg-gradient-to-b from-slate-800 to-slate-950 text-white shadow-[0_2px_0_0_#0f172a]'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="نمط أبيض وأسود"
              >
                <Contrast size={12} />
                <span>أبيض وأسود</span>
              </button>
            </div>

            {isFilterChanged && (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl">
                تم تغيير المعايير (اضغط عرض البيانات للتحديث)
              </span>
            )}
          </div>

          {/* Core Action Buttons (3D Tactile Buttons) */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 1. معاينة (Preview Modal) 3D */}
            <button
              type="button"
              onClick={() => {
                if (!appliedFilter) {
                  alert(`يرجى الضغط على زر «عرض البيانات» أولاً لعرض كشف الحساب قبل المعاينة.`);
                  return;
                }
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setPreviewZoom(calculateCustomerStatementFitZoom());
                } else {
                  setPreviewZoom(100);
                }
                setModalPan({ x: 0, y: 0 });
                setShowPrintPreviewModal(true);
              }}
              disabled={!appliedFilter}
              className="h-10 px-4 rounded-xl bg-gradient-to-b from-slate-700 to-slate-900 hover:from-slate-600 hover:to-slate-800 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-[0_4px_0_0_#0f172a,0_6px_10px_rgba(0,0,0,0.25)] hover:shadow-[0_5px_0_0_#0f172a] active:shadow-[0_1px_0_0_#0f172a] active:translate-y-[3px] border-t border-slate-500/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="معاينة نموذج الطباعة الرسمي A4 بالختم"
            >
              <Eye size={14} />
              <span>معاينة</span>
            </button>

            {/* 2. طباعة (Print) 3D */}
            <button
              type="button"
              onClick={handleDirectPrint}
              disabled={!appliedFilter}
              className="h-10 px-4 rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-[0_4px_0_0_#064e3b,0_6px_10px_rgba(0,0,0,0.25)] hover:shadow-[0_5px_0_0_#064e3b] active:shadow-[0_1px_0_0_#064e3b] active:translate-y-[3px] border-t border-emerald-400/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="طباعة كشف الحساب مباشرة بنموذج A4 الرسمي"
            >
              <Printer size={15} />
              <span>طباعة</span>
            </button>

            {/* 3. تصدير PDF 3D */}
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExportingPDF || !appliedFilter}
              className="h-10 px-4 rounded-xl bg-gradient-to-b from-rose-600 to-rose-800 hover:from-rose-500 hover:to-rose-700 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-[0_4px_0_0_#881337,0_6px_10px_rgba(0,0,0,0.25)] hover:shadow-[0_5px_0_0_#881337] active:shadow-[0_1px_0_0_#881337] active:translate-y-[3px] border-t border-rose-400/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="تصدير كشف الحساب الرسمي كملف PDF بكافة بيانات الشركة والختم"
            >
              {isExportingPDF ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              <span>{isExportingPDF ? 'جاري التصدير...' : 'تصدير PDF'}</span>
            </button>

            {/* 4. تصدير Excel 3D */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExportingExcel || !appliedFilter}
              className="h-10 px-4 rounded-xl bg-gradient-to-b from-emerald-700 to-emerald-900 hover:from-emerald-600 hover:to-emerald-800 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-[0_4px_0_0_#064e3b,0_6px_10px_rgba(0,0,0,0.25)] hover:shadow-[0_5px_0_0_#064e3b] active:shadow-[0_1px_0_0_#064e3b] active:translate-y-[3px] border-t border-emerald-500/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="تصدير كشف الحساب كملف إكسيل Excel معتمد"
            >
              {isExportingExcel ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={15} />
              )}
              <span>{isExportingExcel ? 'جاري التصدير...' : 'تصدير Excel'}</span>
            </button>

            {/* 5. مشاركة واتساب (WhatsApp) 3D */}
            <button
              type="button"
              onClick={handleOpenWhatsAppModal}
              disabled={!appliedFilter}
              className="h-10 px-4 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-[0_4px_0_0_#047857,0_6px_10px_rgba(0,0,0,0.25)] hover:shadow-[0_5px_0_0_#047857] active:shadow-[0_1px_0_0_#047857] active:translate-y-[3px] border-t border-emerald-300/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="مشاركة كشف الحساب والملخص المالي مباشرة عبر الواتساب"
            >
              <MessageSquare size={15} />
              <span>واتساب</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. The Official Statement Sheet (Shown only after clicking "عرض البيانات") */}
      <div 
        id="official-partner-statement-printable"
        ref={statementSheetRef}
        className="w-full"
      >
        {appliedFilter ? (
          <div className="flex flex-col items-center w-full">
            {/* Executive KPI Summary Cards (بطاقات ملخص الحساب التنفيذي) */}
            <div className="w-full max-w-[1020px] grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 print:hidden">
              {/* Card 1: Opening Balance */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-bold">رصيد أول المدة (سابق)</span>
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                    <Clock size={14} />
                  </div>
                </div>
                <div className="font-mono font-black text-slate-900 text-base sm:text-lg">
                  {Math.abs(statementCalculation.openingBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-slate-500">{currencySymbol}</span>
                </div>
                <div className="text-[10px] font-bold mt-1 text-slate-500">
                  {statementCalculation.openingBalance > 0 ? '(رصيد مدين سابق)' : statementCalculation.openingBalance < 0 ? '(رصيد دائن سابق)' : '(رصيد افتتاحي متزن)'}
                </div>
              </div>

              {/* Card 2: Period Debits */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-bold">{isVendor ? 'إجمالي المدين (سدادات)' : 'إجمالي المدين (مبيعات)'}</span>
                  <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
                    <TrendingUp size={14} />
                  </div>
                </div>
                <div className="font-mono font-black text-rose-700 text-base sm:text-lg">
                  {statementCalculation.periodTotals.debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-slate-500">{currencySymbol}</span>
                </div>
                <div className="text-[10px] font-bold mt-1 text-slate-500">
                  حركات مدين مسجلة بالفترة
                </div>
              </div>

              {/* Card 3: Period Credits */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-bold">{isVendor ? 'إجمالي الدائن (مشتريات)' : 'إجمالي الدائن (تحصيلات)'}</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <TrendingDown size={14} />
                  </div>
                </div>
                <div className="font-mono font-black text-emerald-700 text-base sm:text-lg">
                  {statementCalculation.periodTotals.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-slate-500">{currencySymbol}</span>
                </div>
                <div className="text-[10px] font-bold mt-1 text-slate-500">
                  حركات دائن مسجلة بالفترة
                </div>
              </div>

              {/* Card 4: Final Balance */}
              <div className={`border rounded-xl p-3.5 shadow-2xs ${
                statementCalculation.finalBalance > 0
                  ? 'bg-rose-50/60 border-rose-200'
                  : statementCalculation.finalBalance < 0
                    ? 'bg-emerald-50/60 border-emerald-200'
                    : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between text-slate-600 mb-1">
                  <span className="text-xs font-bold">الرصيد النهائي المستحق</span>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    statementCalculation.finalBalance > 0
                      ? 'bg-rose-100 text-rose-800'
                      : statementCalculation.finalBalance < 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-700'
                  }`}>
                    <Scale size={14} />
                  </div>
                </div>
                <div className={`font-mono font-black text-base sm:text-lg ${
                  statementCalculation.finalBalance > 0 ? 'text-rose-800' : statementCalculation.finalBalance < 0 ? 'text-emerald-800' : 'text-slate-900'
                }`}>
                  {Math.abs(statementCalculation.finalBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-slate-600">{currencySymbol}</span>
                </div>
                <div className="text-[10px] font-bold mt-1 truncate" title={finalBalanceLabel}>
                  {finalBalanceLabel}
                </div>
              </div>
            </div>

            {/* Quick Action & Zoom Toolbar on Main Statement Sheet */}
            <div className={`w-full flex items-center justify-between gap-3 mb-4 px-1 print:hidden flex-wrap ${
              printOrientation === 'LANDSCAPE' ? 'max-w-[1240px]' : 'max-w-[1020px]'
            }`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-600">نمط العرض:</span>
                <div className="flex items-center bg-white border border-slate-300 rounded-xl p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setStatementColorMode('COLOR')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      statementColorMode === 'COLOR'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="عرض بألوان النظام الكاملة"
                  >
                    <Palette size={13} />
                    <span>ألوان</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatementColorMode('BW')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      statementColorMode === 'BW'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="عرض بنمط أبيض وأسود للطباعة الموفرة للحبر"
                  >
                    <Contrast size={13} />
                    <span>أبيض وأسود</span>
                  </button>
                </div>

                <span className="text-xs font-bold text-slate-600 mr-1">الاتجاه:</span>
                <div className="flex items-center bg-white border border-slate-300 rounded-xl p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setPrintOrientation('PORTRAIT')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      printOrientation === 'PORTRAIT'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="الطباعة بالوضع الطولي القياسي (Portrait)"
                  >
                    <FileText size={13} />
                    <span>طولي</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintOrientation('LANDSCAPE')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      printOrientation === 'LANDSCAPE'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="الطباعة بعرض الورقة (Landscape) لتفاصيل وجداول واسعة"
                  >
                    <FileSpreadsheet size={13} />
                    <span>بعرض الورقة</span>
                  </button>
                </div>
              </div>

              {/* أداة التكبير والتصغير المرنة بأي قيمة (Flexible Zoom Control with Slider & Stepper) */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setMainSheetZoom(z => Math.max(z - 15, 30))}
                  className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="تصغير (-15%)"
                >
                  <ZoomOut size={14} />
                </button>

                <input
                  type="range"
                  min="30"
                  max="220"
                  step="5"
                  value={mainSheetZoom}
                  onChange={(e) => setMainSheetZoom(Number(e.target.value))}
                  className="w-20 sm:w-28 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  title={`نسبة التكبير: ${mainSheetZoom}% (اسحب للتحكم بأي قيمة)`}
                />

                <button
                  type="button"
                  onClick={() => setMainSheetZoom(z => Math.min(z + 15, 220))}
                  className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="تكبير (+15%)"
                >
                  <ZoomIn size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMainSheetZoom(100);
                    resetMainPan();
                  }}
                  className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                    mainSheetZoom === 100 
                      ? 'bg-slate-100 text-slate-700' 
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                  title="إعادة ضبط المعاينة إلى 100%"
                >
                  {mainSheetZoom}%
                </button>
              </div>
            </div>

            {/* In-Statement Table Filter & Search Toolbar */}
            <div className={`w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 mb-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 print:hidden ${
              printOrientation === 'LANDSCAPE' ? 'max-w-[1240px]' : 'max-w-[1020px]'
            }`}>
              {/* Search input (3D Prominent Gray) */}
              <div className="relative flex-1">
                <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-700 pointer-events-none" />
                <input
                  type="text"
                  value={tableSearchQuery}
                  onChange={(e) => setTableSearchQuery(e.target.value)}
                  placeholder="ابحث داخل الكشف برقم المستند، البيان، أو التاريخ..."
                  className="w-full h-11 pr-10 pl-8 rounded-xl border-2 border-slate-300 border-t-slate-200 border-b-slate-400 bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 text-xs font-black text-slate-900 placeholder-slate-600 shadow-[0_4px_0_0_#64748b,0_5px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_5px_0_0_#475569,0_7px_12px_rgba(0,0,0,0.16)] hover:-translate-y-0.5 focus:bg-white focus:outline-none focus:border-slate-500 focus:shadow-[0_2px_0_0_#64748b,inset_0_2px_4px_rgba(0,0,0,0.1)] focus:translate-y-[2px] transition-all"
                />
                {tableSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTableSearchQuery('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 cursor-pointer p-0.5"
                    title="مسح البحث"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Document Type Filter Pills (3D Buttons) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setTableTypeFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    tableTypeFilter === 'ALL'
                      ? 'bg-gradient-to-b from-blue-600 to-blue-800 text-white shadow-[0_3px_0_0_#1e3a8a] border-t border-blue-400/40 active:translate-y-[2px]'
                      : 'bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-800 border border-slate-300 shadow-[0_2px_0_0_#cbd5e1] active:translate-y-[1px]'
                  }`}
                >
                  الكل ({movementCounts.all})
                </button>
                <button
                  type="button"
                  onClick={() => setTableTypeFilter('INVOICES')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    tableTypeFilter === 'INVOICES'
                      ? 'bg-gradient-to-b from-blue-600 to-blue-800 text-white shadow-[0_3px_0_0_#1e3a8a] border-t border-blue-400/40 active:translate-y-[2px]'
                      : 'bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-800 border border-slate-300 shadow-[0_2px_0_0_#cbd5e1] active:translate-y-[1px]'
                  }`}
                >
                  فواتير ({movementCounts.invoices})
                </button>
                <button
                  type="button"
                  onClick={() => setTableTypeFilter('VOUCHERS')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    tableTypeFilter === 'VOUCHERS'
                      ? 'bg-gradient-to-b from-blue-600 to-blue-800 text-white shadow-[0_3px_0_0_#1e3a8a] border-t border-blue-400/40 active:translate-y-[2px]'
                      : 'bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-800 border border-slate-300 shadow-[0_2px_0_0_#cbd5e1] active:translate-y-[1px]'
                  }`}
                >
                  سندات ({movementCounts.vouchers})
                </button>
                <button
                  type="button"
                  onClick={() => setTableTypeFilter('JOURNALS')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    tableTypeFilter === 'JOURNALS'
                      ? 'bg-gradient-to-b from-blue-600 to-blue-800 text-white shadow-[0_3px_0_0_#1e3a8a] border-t border-blue-400/40 active:translate-y-[2px]'
                      : 'bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 hover:to-slate-200 text-slate-800 border border-slate-300 shadow-[0_2px_0_0_#cbd5e1] active:translate-y-[1px]'
                  }`}
                >
                  قيود ({movementCounts.journals})
                </button>

                {/* Hide zero movements checkbox */}
                <label className="flex items-center gap-1.5 text-xs font-black text-slate-800 bg-white border border-slate-300 px-3 py-1.5 rounded-xl shadow-[0_2px_0_0_#cbd5e1] cursor-pointer hover:bg-slate-50 select-none">
                  <input
                    type="checkbox"
                    checked={hideZeroMovements}
                    onChange={(e) => setHideZeroMovements(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span>إخفاء الحركات الصفرية</span>
                </label>

                {/* Expand / Collapse All Invoices Button (3D) */}
                {invoiceRowsWithItems.length > 0 && (
                  <button
                    type="button"
                    onClick={areAllInvoicesExpanded ? collapseAllInvoices : expandAllInvoices}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 select-none ${
                      areAllInvoicesExpanded
                        ? 'bg-gradient-to-b from-indigo-700 to-indigo-900 text-white shadow-[0_3px_0_0_#312e81] border-t border-indigo-400/40 active:translate-y-[2px]'
                        : 'bg-gradient-to-b from-indigo-50 to-indigo-100 hover:from-indigo-100 hover:to-indigo-200 text-indigo-900 border border-indigo-300 shadow-[0_2px_0_0_#c7d2fe] active:translate-y-[1px]'
                    }`}
                    title={areAllInvoicesExpanded ? 'طي جميع تفاصيل وأصناف الفواتير' : 'فرد وعرض أصناف جميع الفواتير في الكشف'}
                  >
                    {areAllInvoicesExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    <span>{areAllInvoicesExpanded ? 'طي جميع الأصناف' : 'فرد جميع الأصناف'} ({invoiceRowsWithItems.length})</span>
                  </button>
                )}
              </div>
            </div>

            <div 
              className={`w-full flex justify-center transition-transform duration-100 origin-top overflow-x-auto select-none ${
                mainSheetZoom > 100 
                  ? (isMainDragging ? 'cursor-grabbing' : 'cursor-grab') 
                  : 'cursor-default'
              }`}
              onMouseDown={handleMainMouseDown}
              onMouseMove={handleMainMouseMove}
              onMouseUp={handleMainMouseUp}
              onMouseLeave={handleMainMouseUp}
              onTouchStart={handleMainTouchStart}
              onTouchMove={handleMainTouchMove}
              onTouchEnd={handleMainTouchEnd}
              style={{
                transform: `translate3d(${mainSheetPan.x}px, ${mainSheetPan.y}px, 0px) scale(${mainSheetZoom / 100})`,
                transformOrigin: 'top center',
                marginBottom: mainSheetZoom > 100 ? `${(mainSheetZoom - 100) * 8}px` : '0px'
              }}
            >
              {renderOfficialStatementSheet(true)}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-14 text-center shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-2xs">
              <FileText size={32} />
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-800 mb-1.5">
              جاهز لاحتساب وعرض كشف الحساب
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
              قم باختيار ال{partnerLabelAr} وتحديد الفترة الزمنية المطلوبة، ثم اضغط على زر 
              <span className="font-bold text-blue-700 mx-1">«عرض البيانات»</span> 
              لعرض حركات الحساب واحتساب الأرصدة التراكمية.
            </p>
            <button
              type="button"
              onClick={handleExecuteFetch}
              disabled={!currentPartner || isLoadingData}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={15} className={isLoadingData ? 'animate-spin' : ''} />
              <span>{isLoadingData ? 'جاري جلب واحتساب البيانات...' : 'عرض البيانات الآن'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. Document Details Modal */}
      <DocumentViewerModal
        isOpen={!!selectedDocForModal}
        onClose={() => setSelectedDocForModal(null)}
        documentId={selectedDocForModal?.docNumber || selectedDocForModal?.id}
        documentType={
          selectedDocForModal?.txType === 'SALES_INVOICE' 
            ? 'invoice' 
            : selectedDocForModal?.txType === 'PURCHASE_INVOICE'
              ? 'purchase_invoice'
              : selectedDocForModal?.txType === 'RECEIPT_VOUCHER' 
                ? 'receipt' 
                : selectedDocForModal?.txType === 'PAYMENT_VOUCHER'
                  ? 'payment'
                  : 'journal_entry'
        }
      />

      {/* 5. Print Preview Modal (A4 Print Preview Modal with Print, PDF & Excel controls) */}
      {showPrintPreviewModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-5 animate-in fade-in duration-150">
          <div className={`bg-white rounded-3xl w-full max-h-[94vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 transition-all ${
            printOrientation === 'LANDSCAPE' ? 'max-w-[96vw]' : 'max-w-5xl'
          }`}>
            
            {/* Modal Toolbar */}
            <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2 min-w-0">
                  <Printer size={18} className="text-blue-700 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-black text-slate-900 text-xs sm:text-base leading-tight truncate">
                      معاينة كشف الحساب A4
                      <span className="hidden sm:inline font-normal text-slate-500 text-xs mr-1">
                        ({printOrientation === 'LANDSCAPE' ? 'بعرض الورقة' : 'طولي'})
                      </span>
                    </h3>
                  </div>
                </div>

                {/* Page Count Badge (Desktop & Mobile) */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-300 rounded-xl shadow-2xs text-xs font-bold text-slate-800 shrink-0" title="عدد صفحات A4 المتوقعة عند الطباعة أو تصدير PDF">
                  <Layers size={13} className="text-blue-600 shrink-0" />
                  <span className="text-slate-500 font-normal hidden md:inline">عدد الصفحات:</span>
                  <span className="font-black text-blue-700 font-mono">
                    {paginatedChunks.length} {paginatedChunks.length === 1 ? 'صفحة' : paginatedChunks.length === 2 ? 'صفحتان' : paginatedChunks.length >= 3 && paginatedChunks.length <= 10 ? 'صفحات' : 'صفحة'} A4
                  </span>
                </div>

                {/* Mobile Header Quick Actions */}
                <div className="flex items-center gap-1.5 sm:hidden shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowModalMobileOptions(!showModalMobileOptions)}
                    className={`p-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                      showModalMobileOptions
                        ? 'bg-blue-600 border-blue-400 text-white'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                    title="خيارات الورقة والألوان"
                  >
                    <SlidersHorizontal size={14} />
                    <span className="text-[10px]">خيارات</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const fit = calculateCustomerStatementFitZoom();
                      if (previewZoom === fit) {
                        setPreviewZoom(100);
                      } else {
                        setPreviewZoom(fit);
                      }
                      setModalPan({ x: 0, y: 0 });
                    }}
                    className="p-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-mono font-bold cursor-pointer"
                    title="التبديل بين احتواء الشاشة وحجم 100%"
                  >
                    {previewZoom}%
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPrintPreviewModal(false)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                    title="إغلاق المعاينة"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Options Toolbar: visible always on desktop, collapsible on mobile */}
              <div className={`${showModalMobileOptions ? 'flex' : 'hidden sm:flex'} flex-wrap items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200`}>
                {/* تبديل بين الأبيض والأسود وكذلك الألوان */}
                <div className="flex items-center bg-white border border-slate-300 rounded-xl p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setStatementColorMode('COLOR')}
                    className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      statementColorMode === 'COLOR'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="عرض بألوان الشاشة الكاملة"
                  >
                    <Palette size={13} />
                    <span>ألوان</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatementColorMode('BW')}
                    className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      statementColorMode === 'BW'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="عرض بنمط أبيض وأسود للطباعة الأحادية والمستندات الرسمية"
                  >
                    <Contrast size={13} />
                    <span>أبيض/أسود</span>
                  </button>
                </div>

                {/* خيار اتجاه الورقة (طولي / بعرض الورقة) */}
                <div className="flex items-center bg-white border border-slate-300 rounded-xl p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => {
                      setPrintOrientation('PORTRAIT');
                      if (typeof window !== 'undefined' && window.innerWidth < 768) {
                        setPreviewZoom(calculateCustomerStatementFitZoom());
                      }
                    }}
                    className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      printOrientation === 'PORTRAIT'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="الطباعة بالوضع الطولي القياسي (A4 Portrait)"
                  >
                    <FileText size={13} />
                    <span>طولي</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPrintOrientation('LANDSCAPE');
                      if (typeof window !== 'undefined' && window.innerWidth < 768) {
                        setPreviewZoom(calculateCustomerStatementFitZoom());
                      }
                    }}
                    className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      printOrientation === 'LANDSCAPE'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="الطباعة بعرض الورقة (A4 Landscape) لتفاصيل وجداول أوسع"
                  >
                    <FileSpreadsheet size={13} />
                    <span>بعرض الورقة</span>
                  </button>
                </div>

                {/* أداة التكبير والتصغير المرنة بأي قيمة */}
                <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2 py-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(z => Math.max(z - 15, 25))}
                    className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="تصغير (-15%)"
                  >
                    <ZoomOut size={13} />
                  </button>

                  <input
                    type="range"
                    min="25"
                    max="220"
                    step="5"
                    value={previewZoom}
                    onChange={(e) => setPreviewZoom(Number(e.target.value))}
                    className="w-16 sm:w-24 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    title={`نسبة التكبير: ${previewZoom}%`}
                  />

                  <button
                    type="button"
                    onClick={() => setPreviewZoom(z => Math.min(z + 15, 220))}
                    className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="تكبير (+15%)"
                  >
                    <ZoomIn size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPreviewZoom(calculateCustomerStatementFitZoom());
                      setModalPan({ x: 0, y: 0 });
                    }}
                    className="text-[10px] text-blue-600 hover:underline px-1 font-bold"
                    title="احتواء الشاشة"
                  >
                    ملائمة
                  </button>
                </div>

                {/* خيار تضمين أو استبعاد تفاصيل الأصناف عند الطباعة والتصدير */}
                {invoiceRowsWithItems.length > 0 && (
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl cursor-pointer hover:bg-slate-100 select-none shadow-2xs">
                    <input
                      type="checkbox"
                      checked={includeItemsInPrint}
                      onChange={(e) => setIncludeItemsInPrint(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <span>أصناف الفواتير</span>
                  </label>
                )}

                {/* Desktop Action Buttons */}
                <div className="hidden sm:flex items-center gap-1.5">
                  <div className="h-6 w-px bg-slate-300 mx-0.5" />

                  <button
                    type="button"
                    onClick={() => handleDirectPrint()}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs active:scale-95"
                    title="طباعة جميع صفحات كشف الحساب"
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
                    {isExportingPDF ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <Download size={13} />
                    )}
                    <span>PDF للكل ({paginatedChunks.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportExcel}
                    disabled={isExportingExcel}
                    className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                  >
                    {isExportingExcel ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <FileSpreadsheet size={13} />
                    )}
                    <span>Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenWhatsAppModal}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs active:scale-95"
                    title="مشاركة كشف الحساب عبر الواتساب"
                  >
                    <MessageSquare size={13} />
                    <span>واتساب</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPrintPreviewModal(false)}
                    className="w-8 h-8 rounded-xl bg-white hover:bg-slate-200 border border-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                    title="إغلاق المعاينة"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* A4 Sheet Simulation View with Zoom Scaling & Multi-Directional Pan */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-200/70">
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
                      setPreviewZoom(calculateCustomerStatementFitZoom());
                      setModalPan({ x: 0, y: 0 });
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                      previewZoom === calculateCustomerStatementFitZoom()
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
                      setModalPan({ x: 0, y: 0 });
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
                className={`p-3 sm:p-6 overflow-auto flex flex-col justify-start items-center flex-1 min-h-[400px] select-none pb-24 sm:pb-8 ${
                  previewZoom > 100 
                    ? (isModalDragging ? 'cursor-grabbing' : 'cursor-grab') 
                    : 'cursor-default'
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
                  {renderOfficialStatementSheet(true)}
                </div>
              </div>
            </div>

            {/* Mobile Sticky Bottom Action Bar - Convenient 1-Thumb Reach */}
            <div className="sm:hidden p-2 bg-white border-t border-slate-200 shadow-lg flex items-center justify-between gap-1.5 shrink-0 z-10">
              <button
                type="button"
                onClick={handleDirectPrint}
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
      {showWhatsAppModal && appliedPartner && (
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
                  <p className="text-[11px] text-emerald-100">{appliedPartner.name}</p>
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

      {/* Off-Screen Complete Statement Document with ALL Pages for Printing & PDF Export */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '1020px', minWidth: '1020px', pointerEvents: 'none' }} aria-hidden="true">
        <div ref={allPagesPrintRef} data-statement-all-pages="true">
          {renderOfficialStatementSheet(false)}
        </div>
      </div>
    </div>
  );
}
