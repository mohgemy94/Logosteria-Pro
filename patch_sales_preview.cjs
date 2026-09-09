const fs = require('fs');
let content = fs.readFileSync('src/components/Sales.tsx', 'utf8');

const newPreviewData = `
    paymentMethod: getInvoiceTypeName(invoiceType),
    serviceType: serviceType || undefined,
    discountTotal: totals.discountTotal,
    subtotal: totals.subtotal,
    taxTotal: totals.taxTotal,
    grandTotal: totals.grandTotal,
    paidAmount: paidAmount,
    remainingAmount: totals.remainingBalance,
    paymentStatus: paidAmount >= totals.grandTotal - 0.001 && totals.grandTotal > 0 ? 'PAID' : paidAmount > 0.001 ? 'PARTIAL' : 'UNPAID',
    notes: notes,
    items: items.map(it => ({
`;

content = content.replace(
  "    paymentMethod: getInvoiceTypeName(invoiceType),\n    items: items.map(it => ({",
  newPreviewData.trim()
);

// We should also patch the setCustomPreviewData inside the history table
content = content.replace(
  "paymentMethod: getInvoiceTypeName(inv.invoiceType)",
  "paymentMethod: getInvoiceTypeName(inv.invoiceType),\n                                serviceType: inv.serviceType,\n                                discountTotal: inv.totals.discountTotal"
);

fs.writeFileSync('src/components/Sales.tsx', content);
