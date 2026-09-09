const fs = require('fs');
const content = fs.readFileSync('src/components/Sales.tsx', 'utf8').split('\n');
let start = content.findIndex(l => l.includes('export interface StoredSalesInvoice {'));
console.log(content.slice(start, start + 30).join('\n'));
