const fs = require('fs');
let content = fs.readFileSync('src/components/Sales.tsx', 'utf8');

// Inside handleSaveInvoice
content = content.replace(
  "safe,",
  "safe,\n      serviceType,"
);

content = content.replace(
  "taxTotal: totals.taxTotal,",
  "taxTotal: totals.taxTotal,\n        discountTotal: totals.discountTotal,"
);

// We should also find where discountTotal: 0 is hardcoded in PrintPreviewData and replace it
content = content.replace(
  "discountTotal: 0,",
  "discountTotal: totals.discountTotal,"
);

fs.writeFileSync('src/components/Sales.tsx', content);
