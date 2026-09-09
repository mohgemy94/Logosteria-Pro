const fs = require('fs');
let content = fs.readFileSync('src/components/PrintPreviewModal.tsx', 'utf8');

content = content.replace(
  "paymentMethod?: string | undefined;",
  "paymentMethod?: string | undefined;\n  serviceType?: string | undefined;"
);

fs.writeFileSync('src/components/PrintPreviewModal.tsx', content);
