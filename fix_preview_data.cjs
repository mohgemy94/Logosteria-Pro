const fs = require('fs');
let content = fs.readFileSync('src/components/Sales.tsx', 'utf8');

const regex = /const currentInvoicePreviewData: PrintPreviewData = useMemo\(\(\) => \(\{[\s\S]*?\}\), \[/;

const replacement = `const currentInvoicePreviewData: PrintPreviewData = useMemo(() => ({
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
  }), [`;

content = content.replace(regex, replacement);

// And we also had duplicate keys in handleSaveInvoice where I replaced `taxTotal: totals.taxTotal,`
// Let's check handleSaveInvoice:
const regex2 = /taxTotal: totals\.taxTotal,\s+discountTotal: totals\.discountTotal,\s+discountTotal: totals\.discountTotal,/;
content = content.replace(regex2, "taxTotal: totals.taxTotal,\n        discountTotal: totals.discountTotal,");

fs.writeFileSync('src/components/Sales.tsx', content);
