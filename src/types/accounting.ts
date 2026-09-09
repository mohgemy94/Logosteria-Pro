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

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  balanceType: BalanceType;
  parentId?: string;
}

/**
 * Ensures numbers are treated conceptually as strictly positive or zero.
 * In runtime, this relies on validations, but at compile time it helps document intent.
 */
export type PositiveNumber = number;

export interface JournalItem {
  id: string;
  accountId: string;
  partnerId?: string;
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
  name: string;
  type: 'CUSTOMER' | 'VENDOR' | 'EMPLOYEE';
  taxNumber?: string;
  phone?: string;
  address?: string;
  email?: string;
  openingBalance?: number;
  openingBalanceDate?: string;
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
  amount: PositiveNumber;
  description: string;
}

import type { PrintPaperFormat, PrintColorMode } from '../utils/printPaperFormats';

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
    logoUrl?: string;
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
}
