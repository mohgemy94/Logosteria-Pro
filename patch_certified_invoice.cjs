const fs = require('fs');
let content = fs.readFileSync('src/components/CertifiedInvoiceDocument.tsx', 'utf8');

const serviceCode = `
    // Service Type
    if (data.serviceType && data.serviceType.trim() !== '') {
      invoiceMetaItems.push({
        label: isEn ? 'Service Type:' : 'نوع الخدمة:',
        valueBadge: data.serviceType,
        icon: FileText,
        iconColor: 'text-indigo-600',
      });
    }

    // Invoice Classification`;

content = content.replace(
  "    // Invoice Classification",
  serviceCode
);

fs.writeFileSync('src/components/CertifiedInvoiceDocument.tsx', content);
