import { InstallmentContract, PromissoryNote } from '../types/installment';
import { tafqeetArabic } from '../utils/tafqeet';

export const STORAGE_KEY_INSTALLMENTS = 'alpha_accounting_installments_v1';
export const STORAGE_KEY_PROMISSORY_NOTES = 'alpha_accounting_promissory_notes_v1';

export const INITIAL_INSTALLMENT_CONTRACTS: InstallmentContract[] = [
  {
    id: 'cnt-101',
    contractNumber: 'INS-2026-001',
    date: '2026-01-15',
    customerId: '1',
    customerName: 'شركة التقنية الحديثة (المهندس أحمد سمير)',
    customerPhone: '0500000001',
    customerNationalId: '1088492019',
    customerAddress: 'الرياض - حي الملز - شارع الستين',
    guarantorName: 'خالد عبد الله المنصور',
    guarantorPhone: '0551122334',
    guarantorNationalId: '1099384726',
    guarantorAddress: 'الرياض - حي النخيل',
    itemDescription: 'توريد عدد 10 أجهزة لابتوب ديل انسبايرون مواصفات عالية + ملحقات الشبكة',
    cashPrice: 20000,
    downPayment: 5000,
    profitRate: 10,
    profitAmount: 1500,
    totalFinanced: 16500, // (20000 - 5000) + 1500 = 16500
    monthsCount: 6,
    installmentFrequency: 'MONTHLY',
    installmentAmount: 2750, // 16500 / 6
    startDate: '2026-02-15',
    status: 'ACTIVE',
    totalPaid: 8250,
    totalRemaining: 8250,
    notes: 'تم استلام الدفعة المقدمة بموجب سند قبض رقم RC-0012 والكمبيالات موقعة.',
    schedule: [
      {
        id: 'sch-101-1',
        contractId: 'cnt-101',
        installmentNumber: 1,
        dueDate: '2026-02-15',
        principalAmount: 2500,
        profitAmount: 250,
        totalAmount: 2750,
        paidAmount: 2750,
        remainingAmount: 0,
        status: 'PAID',
        paidDate: '2026-02-14',
        paymentMethod: 'BANK_TRANSFER',
        receiptVoucherNumber: 'RC-2026-081',
        promissoryNoteId: 'PN-2026-001',
        notes: 'تم السداد بتحويل عبر مصرف الراجحي'
      },
      {
        id: 'sch-101-2',
        contractId: 'cnt-101',
        installmentNumber: 2,
        dueDate: '2026-03-15',
        principalAmount: 2500,
        profitAmount: 250,
        totalAmount: 2750,
        paidAmount: 2750,
        remainingAmount: 0,
        status: 'PAID',
        paidDate: '2026-03-15',
        paymentMethod: 'CASH',
        receiptVoucherNumber: 'RC-2026-112',
        promissoryNoteId: 'PN-2026-002',
        notes: 'سداد نقدي في الخزينة الرئيسية'
      },
      {
        id: 'sch-101-3',
        contractId: 'cnt-101',
        installmentNumber: 3,
        dueDate: '2026-04-15',
        principalAmount: 2500,
        profitAmount: 250,
        totalAmount: 2750,
        paidAmount: 2750,
        remainingAmount: 0,
        status: 'PAID',
        paidDate: '2026-04-12',
        paymentMethod: 'CARD',
        receiptVoucherNumber: 'RC-2026-145',
        promissoryNoteId: 'PN-2026-003',
        notes: 'سداد عبر جهاز مدى'
      },
      {
        id: 'sch-101-4',
        contractId: 'cnt-101',
        installmentNumber: 4,
        dueDate: '2026-05-15',
        principalAmount: 2500,
        profitAmount: 250,
        totalAmount: 2750,
        paidAmount: 0,
        remainingAmount: 2750,
        status: 'OVERDUE',
        promissoryNoteId: 'PN-2026-004',
        penaltyAmount: 100,
        notes: 'مستحق ومرسل إشعار تذكير عبر الهاتف'
      },
      {
        id: 'sch-101-5',
        contractId: 'cnt-101',
        installmentNumber: 5,
        dueDate: '2026-06-15',
        principalAmount: 2500,
        profitAmount: 250,
        totalAmount: 2750,
        paidAmount: 0,
        remainingAmount: 2750,
        status: 'PENDING',
        promissoryNoteId: 'PN-2026-005',
        notes: 'قسط قادم'
      },
      {
        id: 'sch-101-6',
        contractId: 'cnt-101',
        installmentNumber: 6,
        dueDate: '2026-07-15',
        principalAmount: 2500,
        profitAmount: 250,
        totalAmount: 2750,
        paidAmount: 0,
        remainingAmount: 2750,
        status: 'PENDING',
        promissoryNoteId: 'PN-2026-006',
        notes: 'القسط الأخير'
      }
    ]
  },
  {
    id: 'cnt-102',
    contractNumber: 'INS-2026-002',
    date: '2026-03-01',
    customerId: '2',
    customerName: 'مؤسسة البناء العمراني للمقاولات',
    customerPhone: '0500000002',
    customerNationalId: '1077281903',
    customerAddress: 'جدة - طريق الملك فهد',
    guarantorName: 'سلطان فهد القحطاني',
    guarantorPhone: '0567788990',
    guarantorNationalId: '1066543210',
    guarantorAddress: 'جدة - حي الروضة',
    itemDescription: 'شراء خط تجهيز مكتبي وطابعات ليزر عملاقة ومعدات مكتبية',
    cashPrice: 36000,
    downPayment: 6000,
    profitRate: 12,
    profitAmount: 3600,
    totalFinanced: 33600,
    monthsCount: 12,
    installmentFrequency: 'MONTHLY',
    installmentAmount: 2800,
    startDate: '2026-04-01',
    status: 'ACTIVE',
    totalPaid: 5600,
    totalRemaining: 28000,
    notes: 'تم إصدار سند لأمر مالي شامل ومصدق ومحفوظ في الخزنة.',
    schedule: Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const dueDate = new Date(2026, 3 + i, 1).toISOString().slice(0, 10);
      const isPaid = monthNum <= 2;
      return {
        id: `sch-102-${monthNum}`,
        contractId: 'cnt-102',
        installmentNumber: monthNum,
        dueDate,
        principalAmount: 2500,
        profitAmount: 300,
        totalAmount: 2800,
        paidAmount: isPaid ? 2800 : 0,
        remainingAmount: isPaid ? 0 : 2800,
        status: isPaid ? 'PAID' : monthNum === 3 ? 'OVERDUE' : 'PENDING',
        paidDate: isPaid ? dueDate : undefined,
        paymentMethod: isPaid ? 'BANK_TRANSFER' : undefined,
        promissoryNoteId: `PN-2026-01${monthNum}`,
      };
    })
  }
];

export const INITIAL_PROMISSORY_NOTES: PromissoryNote[] = [
  {
    id: 'pn-101',
    noteNumber: 'PN-2026-001',
    contractId: 'cnt-101',
    contractNumber: 'INS-2026-001',
    installmentNumber: 1,
    type: 'PROMISSORY_NOTE',
    issueDate: '2026-01-15',
    dueDate: '2026-02-15',
    amount: 2750,
    amountInWords: tafqeetArabic(2750),
    currency: 'ريال سعودي',
    drawee: 'شركة التقنية الحديثة (المهندس أحمد سمير)',
    draweeNationalId: '1088492019',
    draweePhone: '0500000001',
    draweeAddress: 'الرياض - حي الملز',
    drawer: 'شركة لوجوستريا للأنظمة المحاسبية والتجارية',
    payee: 'شركة لوجوستريا للأنظمة المحاسبية والتجارية',
    guarantor: 'خالد عبد الله المنصور',
    guarantorNationalId: '1099384726',
    guarantorPhone: '0551122334',
    placeOfPayment: 'الرياض - الحساب البنكي الرئيسي',
    bankName: 'مصرف الراجحي',
    status: 'COLLECTED',
    collectionDate: '2026-02-14',
    legalText: 'أتعهد أنا الموقع أدناه بأن أدفع بموجب هذا السند لأمر دون قيد أو شرط لأمر / شركة لوجوستريا للأنظمة المحاسبية والتجارية، المبلغ الموضح أعلاه في ميعاد الاستحقاق المحدد.',
    notes: 'تم تحصيل السند وإيداعه في الحساب البنكي'
  },
  {
    id: 'pn-102',
    noteNumber: 'PN-2026-002',
    contractId: 'cnt-101',
    contractNumber: 'INS-2026-001',
    installmentNumber: 2,
    type: 'PROMISSORY_NOTE',
    issueDate: '2026-01-15',
    dueDate: '2026-03-15',
    amount: 2750,
    amountInWords: tafqeetArabic(2750),
    currency: 'ريال سعودي',
    drawee: 'شركة التقنية الحديثة (المهندس أحمد سمير)',
    draweeNationalId: '1088492019',
    draweePhone: '0500000001',
    draweeAddress: 'الرياض - حي الملز',
    drawer: 'شركة لوجوستريا للأنظمة المحاسبية والتجارية',
    payee: 'شركة لوجوستريا للأنظمة المحاسبية والتجارية',
    guarantor: 'خالد عبد الله المنصور',
    guarantorNationalId: '1099384726',
    guarantorPhone: '0551122334',
    placeOfPayment: 'الرياض - الصندوق الرئيسي',
    status: 'COLLECTED',
    collectionDate: '2026-03-15',
    legalText: 'أتعهد أنا الموقع أدناه بأن أدفع بموجب هذا السند لأمر دون قيد أو شرط لأمر / شركة لوجوستريا للأنظمة المحاسبية والتجارية، المبلغ الموضح أعلاه في ميعاد الاستحقاق المحدد.',
    notes: 'تم التحصيل نقداً'
  },
  {
    id: 'pn-103',
    noteNumber: 'PN-2026-004',
    contractId: 'cnt-101',
    contractNumber: 'INS-2026-001',
    installmentNumber: 4,
    type: 'PROMISSORY_NOTE',
    issueDate: '2026-01-15',
    dueDate: '2026-05-15',
    amount: 2750,
    amountInWords: tafqeetArabic(2750),
    currency: 'ريال سعودي',
    drawee: 'شركة التقنية الحديثة (المهندس أحمد سمير)',
    draweeNationalId: '1088492019',
    draweePhone: '0500000001',
    draweeAddress: 'الرياض - حي الملز',
    drawer: 'شركة لوجوستريا للأنظمة المحاسبية والتجارية',
    payee: 'شركة لوجوستريا للأنظمة المحاسبية والتجارية',
    guarantor: 'خالد عبد الله المنصور',
    guarantorNationalId: '1099384726',
    guarantorPhone: '0551122334',
    placeOfPayment: 'الرياض',
    status: 'SENT_FOR_COLLECTION',
    bankName: 'البنك الأهلي السعودي',
    legalText: 'أتعهد أنا الموقع أدناه بأن أدفع بموجب هذا السند لأمر دون قيد أو شرط لأمر / شركة لوجوستريا للأنظمة المحاسبية والتجارية، المبلغ الموضح أعلاه في ميعاد الاستحقاق المحدد.',
    notes: 'الكمبيالة مرسلة برسم التحصيل لدى البنك'
  },
  {
    id: 'pn-104',
    noteNumber: 'PN-2026-005',
    contractId: 'cnt-101',
    contractNumber: 'INS-2026-001',
    installmentNumber: 5,
    type: 'PROMISSORY_NOTE',
    issueDate: '2026-01-15',
    dueDate: '2026-06-15',
    amount: 2750,
    amountInWords: tafqeetArabic(2750),
    currency: 'ريال سعودي',
    drawee: 'شركة التقنية الحديثة (المهندس أحمد سمير)',
    draweeNationalId: '1088492019',
    draweePhone: '0500000001',
    draweeAddress: 'الرياض - حي الملز',
    drawer: 'شركة لوجوستريا للأنظمة المحاسبية والتجارية',
    payee: 'شركة لوجوستريا للأنظمة المحاسبية والتجارية',
    guarantor: 'خالد عبد الله المنصور',
    guarantorNationalId: '1099384726',
    guarantorPhone: '0551122334',
    placeOfPayment: 'الرياض',
    status: 'PORTFOLIO',
    legalText: 'أتعهد أنا الموقع أدناه بأن أدفع بموجب هذا السند لأمر دون قيد أو شرط لأمر / شركة لوجوستريا للأنظمة المحاسبية والتجارية، المبلغ الموضح أعلاه في ميعاد الاستحقاق المحدد.',
    notes: 'في محفظة الأوراق التجارية بالخزينة'
  }
];

export function getStoredInstallments(): InstallmentContract[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INSTALLMENTS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse installments storage', e);
  }
  return INITIAL_INSTALLMENT_CONTRACTS;
}

export function saveStoredInstallments(contracts: InstallmentContract[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_INSTALLMENTS, JSON.stringify(contracts));
    window.dispatchEvent(new Event('alpha-installments-updated'));
  } catch (e) {
    console.error('Failed to save installments', e);
  }
}

export function getStoredPromissoryNotes(): PromissoryNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROMISSORY_NOTES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse promissory notes storage', e);
  }
  return INITIAL_PROMISSORY_NOTES;
}

export function saveStoredPromissoryNotes(notes: PromissoryNote[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PROMISSORY_NOTES, JSON.stringify(notes));
    window.dispatchEvent(new Event('alpha-promissory-notes-updated'));
  } catch (e) {
    console.error('Failed to save promissory notes', e);
  }
}
