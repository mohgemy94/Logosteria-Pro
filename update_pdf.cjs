const fs = require('fs');

let content = fs.readFileSync('src/utils/pdfExport.ts', 'utf8');

// Move def up
content = content.replace(
  "try {",
  "try {\n    const def = getPaperFormatDef(format, customSize);\n"
);

content = content.replace(
  "    // 2. Setup jsPDF page format using the exact paper size definition\n    const def = getPaperFormatDef(format, customSize);",
  "    // 2. Setup jsPDF page format using the exact paper size definition"
);

content = content.replace(
  "windowWidth: element.scrollWidth || 1200,",
  "windowWidth: def.baseWidthPx,\n      width: def.baseWidthPx,"
);

// Add to onclone
content = content.replace(
  "onclone: (clonedDoc, clonedElement) => {\n        try {",
  "onclone: (clonedDoc, clonedElement) => {\n        try {\n          clonedElement.style.width = `${def.baseWidthPx}px`;\n          clonedElement.style.maxWidth = 'none';\n          clonedElement.style.transform = 'none';\n          clonedElement.style.margin = '0';\n"
);

fs.writeFileSync('src/utils/pdfExport.ts', content);
