const fs = require('fs');

let content = fs.readFileSync('src/components/PrintPreviewModal.tsx', 'utf8');

// Add pdfExportRef
content = content.replace(
  "const printAreaRef = useRef<HTMLDivElement>(null);",
  "const printAreaRef = useRef<HTMLDivElement>(null);\n  const pdfExportRef = useRef<HTMLDivElement>(null);"
);

// Update handleExportPdf
content = content.replace(
  "if (!printAreaRef.current || isExportingPdf) return;",
  "if (!pdfExportRef.current || isExportingPdf) return;"
);

content = content.replace(
  "await exportElementToPdf(printAreaRef.current, {",
  "await exportElementToPdf(pdfExportRef.current, {"
);

// Add the hidden element
const hiddenElement = `
      {/* Hidden Unscaled Copy for PDF Export */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
        <CertifiedInvoiceDocument
          ref={pdfExportRef}
          data={data}
          format={format}
          customSize={customSize}
          colorMode={colorMode}
          language={language}
        />
      </div>

      {/* Custom Size Configuration Dialog */}
`;

content = content.replace(
  "{/* Custom Size Configuration Dialog */}",
  hiddenElement
);

fs.writeFileSync('src/components/PrintPreviewModal.tsx', content);
