const fs = require('fs');
const content = fs.readFileSync('src/components/PrintPreviewModal.tsx', 'utf8').split('\n');
let start = content.findIndex(l => l.includes('export interface PrintPreviewData'));
console.log(content.slice(start, start + 50).join('\n'));
