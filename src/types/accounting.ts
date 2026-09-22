export enum AccountType {
  Asset = 'ASSET',
  Liability = 'LIABILITY',
  Equity = 'EQUITY',
  Revenue = 'REVENUE',
  Expense = 'EXPENSE'
}

export enum BalanceType {
  Debit = 'DEBIT',
  Credit = 'CREDIT'
}

export type AccountControlType = 'CUSTOMER' | 'VENDOR' | 'EMPLOYEE' | 'NONE';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  balanceType: BalanceType;
  parentId?: string | undefined;
  isControlAccount?: boolean | undefined;
  controlType?: AccountControlType | undefined;
}

/**
 * Ensures numbers are treated conceptually as strictly positive or zero.
 * In runtime, this relies on validations, but at compile time it helps document intent.
 */
export type PositiveNumber = number;

export interface JournalItem {
  id: string;
  accountId: string;
  partnerId?: string | undefined;
  partnerName?: string | undefined;
  partnerType?: 'CUSTOMER' | 'VENDOR' | 'EMPLOYEE' | undefined;
  costCenterId?: string | undefined;
  costCenterName?: string | undefined;
  debit: PositiveNumber;
  credit: PositiveNumber;
}

export enum JournalEntryStatus {
  Draft = 'DRAFT',
  Posted = 'POSTED'
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string; // ISO String (YYYY-MM-DD)
  status: JournalEntryStatus;
  reference: string;
  description: string;
  items: JournalItem[];
}

export enum InvoiceType {
  Customer = 'CUSTOMER',
  Vendor = 'VENDOR'
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  partnerId: string;
  date: string;
  total: PositiveNumber;
  tax: PositiveNumber;
}

export interface Partner {
  id: string;
  code?: string | undefined;
  name: string;
  type: 'CUSTOMER' | 'VENDOR' | 'EMPLOYEE';
  taxNumber?: string | undefined;
  phone?: string | undefined;
  country?: string | undefined;
  address?: string | undefined;
  email?: string | undefined;
  creditLimit?: number | undefined;
  paymentTermsDays?: number | undefined;
  openingBalance?: number | undefined;
  openingBalanceDate?: string | undefined;
  openingBalanceType?: 'DEBIT' | 'CREDIT' | undefined;
  isActive?: boolean | undefined;
}

export enum VoucherType {
  Receipt = 'RECEIPT', // سند قبض
  Payment = 'PAYMENT', // سند صرف
  InternalTransfer = 'INTERNAL_TRANSFER' // سند داخلي
}

export interface Voucher {
  id: string;
  voucherNumber: string;
  type: VoucherType;
  date: string;
  partnerId?: string;
  fromAccountId: string;
  toAccountId: string;
  costCenterId?: string | undefined;
  costCenterName?: string | undefined;
  amount: PositiveNumber;
  description: string;
}

import type { PrintPaperFormat, PrintColorMode } from '../utils/printPaperFormats';

export type VoucherApprovalStatus = 'NOT_REQUIRED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface ApprovalWorkflowSettings {
  enabled: boolean;
  minAmountThreshold: number;
  requireGeneralManagerForVeryLarge: boolean;
  veryLargeThreshold: number;
  defaultApproverName: string;
  defaultApproverRole: string;
  generalManagerName: string;
  blockPostingWithoutApproval: boolean;
  enableForInternalVouchers: boolean;
}

export interface CurrencySetting {
  code: string;
  nameAr: string;
  symbol: string;
  rateAgainstBase: number;
  isBase: boolean;
  isEnabled: boolean;
}

export interface UserPermission {
  id: string;
  username: string;
  displayName: string;
  role: 'ADMIN' | 'ACCOUNTANT' | 'CASHIER' | 'STOREKEEPER' | 'AUDITOR';
  branch: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPost: boolean;
  canPrint: boolean;
  canExport: boolean;
  isActive: boolean;
}

export interface CreditAndStockControlSettings {
  enforceCreditLimit: boolean;
  creditLimitAction: 'BLOCK' | 'WARN';
  preventNegativeStock: boolean;
  warnLowStock: boolean;
  lowStockThreshold: number;
}

export interface BrandingSettings {
  primaryColor: string;
  fontFamily: 'Tajawal' | 'Cairo' | 'Arial' | 'Amiri';
  showTermsAndConditions: boolean;
  termsText: string;
  stampUrl?: string;
  invoiceTitleAr?: string;
}

export interface SystemSettings {
  company: {
    nameAr: string;
    nameEn: string;
    taxNumber: string;
    commercialRegister: string;
    branchName: string;
    phone: string;
    email: string;
    website: string;
    address: string;
    city: string;
    postalCode: string;
    country?: string;
    logoUrl?: string;
    stampUrl?: string;
  };
  financial: {
    currency: string;
    currencySymbol: string;
    fiscalYear: string;
    fiscalYearStart: string;
    fiscalYearEnd: string;
    isFiscalYearClosed: boolean;
    costMethod: 'FIFO' | 'WEIGHTED_AVG' | 'LIFO';
    decimalPlaces: number;
    allowNegativeStock: boolean;
  };
  currencies?: CurrencySetting[];
  controlAndLimits?: CreditAndStockControlSettings;
  branding?: BrandingSettings;
  users?: UserPermission[];
  taxAndInvoice: {
    enableVat: boolean;
    defaultVatRate: number;
    salesPrefix: string;
    purchasePrefix: string;
    journalPrefix: string;
    receiptVoucherPrefix: string;
    paymentVoucherPrefix: string;
    enableQrCode: boolean;
  };
  printing: {
    defaultFormat: PrintPaperFormat;
    customPaperSize?: { widthCm: number; heightCm: number };
    colorMode?: PrintColorMode;
    headerNotes: string;
    footerNotes: string;
    showCompanyLogo: boolean;
    showSignatures: boolean;
  };
  approvalWorkflow?: ApprovalWorkflowSettings;
  invoiceDefaults?: {
    salesTransactionType?: string; // 'CASH_SALES' | 'CREDIT_SALES' | 'PARTIAL_SALES' | 'CASH_RETURN' | 'CREDIT_RETURN' | 'QUOTATION'
    salesClassification?: 'TAX' | 'NORMAL';
    salesWarehouse?: string; // 'MAIN_WAREHOUSE' | 'SHOWROOM' | 'BRANCH_1'
    salesSafe?: string; // 'MAIN_SAFE' | 'BANK_AHLI' | 'BANK_RAJHI'
    salesServiceType?: string; // '' | 'استشارات' | 'تصميم' | 'برمجة' | 'صيانة' | 'تركيب' | 'دعم فني' | 'خدمات عامة'
    purchasesTransactionType?: string; // 'CASH_PURCHASE' | 'CREDIT_PURCHASE' | 'PARTIAL_PURCHASE' | 'CASH_RETURN' | 'CREDIT_RETURN'
    purchasesClassification?: 'TAX' | 'NORMAL';
    purchasesWarehouse?: string; // 'MAIN_WAREHOUSE' | 'SHOWROOM' | 'BRANCH_1'
    purchasesSafe?: string; // 'MAIN_SAFE' | 'BANK_AHLI' | 'BANK_RAJHI'
    purchasesServiceType?: string;
  };
}
