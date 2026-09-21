import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { 
  type PrintPaperFormat, 
  type CustomPaperSize, 
  type PrintColorMode,
  getPaperFormatDef,
  applyPrintPageStyle,
  getSavedPrintColorMode
} from './printPaperFormats';

export interface PdfExportOptions {
  filename?: string;
  format?: PrintPaperFormat;
  customSize?: CustomPaperSize;
  colorMode?: PrintColorMode;
  scale?: number;
  quality?: number;
}

/**
 * Directly prints an HTML element in an isolated, dedicated iframe.
 * Eliminates all blank print issues, overflow-clipping, and background UI interference.
 */
export function printElementDirectly(
  element?: HTMLElement | null,
  format: PrintPaperFormat = 'A4',
  customSize?: CustomPaperSize,
  colorMode?: PrintColorMode
): void {
  if (typeof window === 'undefined') return;

  const target = element || document.getElementById('certified-invoice-document');
  if (!target) {
    window.print();
    return;
  }

  const def = getPaperFormatDef(format, customSize);
  const activeColorMode = colorMode || getSavedPrintColorMode();

  // Create isolated iframe with actual viewport dimensions, positioned invisibly
  const iframe = document.createElement('iframe');
  iframe.id = 'alpha-isolated-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.width = '100vw';
  iframe.style.height = '100vh';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.zIndex = '-99999';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    applyPrintPageStyle(format, customSize, activeColorMode);
    window.print();
    return;
  }

  // Collect head styles (Tailwind, fonts, custom styles)
  let stylesHtml = '';
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    stylesHtml += node.outerHTML;
  });

  let sizeCss = '';
  let marginCss = '5mm';

  if (def.isThermal) {
    sizeCss = `${def.widthMm}mm auto`;
    marginCss = '2mm';
  } else if (def.heightMm) {
    sizeCss = `${def.widthMm}mm ${def.heightMm}mm`;
    marginCss = def.widthMm <= 110 ? '3mm' : def.widthMm <= 150 ? '4mm' : '6mm';
  } else {
    sizeCss = `${def.widthMm}mm auto`;
  }

  const bwCss = activeColorMode === 'bw' ? `
    .printable-invoice-doc,
    .printable-invoice-doc * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .printable-invoice-doc {
      color: #000000 !important;
      background-color: #ffffff !important;
    }
    .printable-invoice-doc table {
      border-color: #000000 !important;
      border-collapse: collapse !important;
    }
    .printable-invoice-doc th {
      background-color: #f1f5f9 !important;
      color: #000000 !important;
      border: 1.5px solid #000000 !important;
      font-weight: 800 !important;
    }
    .printable-invoice-doc td {
      border: 1px solid #334155 !important;
      color: #000000 !important;
    }
  ` : '';

  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html dir="${document.documentElement.dir || 'rtl'}" lang="${document.documentElement.lang || 'ar'}">
      <head>
        <meta charset="utf-8">
        <title>${document.title || 'Invoice'}</title>
        ${stylesHtml}
        <style>
          @page {
            size: ${sizeCss};
            margin: ${marginCss};
          }
          * {
            box-sizing: border-box;
          }
          html, body {
            background-color: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .printable-wrap {
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            margin: 0;
            padding: 0;
          }
          ${bwCss}
        </style>
      </head>
      <body>
        <div class="printable-wrap">
          ${target.outerHTML}
        </div>
      </body>
    </html>
  `);
  iframeDoc.close();

  // Allow styles, web fonts, and layout to settle, then print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.warn('Iframe print error, falling back to native print:', err);
      applyPrintPageStyle(format, customSize, activeColorMode);
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 60000);
    }
  }, 350);
}

/**
 * Exports the invoice directly to a downloaded PDF file using jsPDF and html2canvas.
 * Captures full Arabic typography, tables, badges, QR codes, and styling with zero empty pages.
 */
export async function exportElementToPdf(
  element?: HTMLElement | null,
  options: PdfExportOptions = {}
): Promise<void> {
  const {
    filename = 'invoice.pdf',
    format = 'A4',
    customSize,
    scale = 2,
  } = options;

  const target = element || document.getElementById('certified-invoice-document');
  if (!target) {
    throw new Error('Printable document element not found');
  }

  // Ensure document fonts are fully loaded
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch (e) {
      console.warn('Font loading check skipped:', e);
    }
  }

  const def = getPaperFormatDef(format, customSize);

  // Render element to high-res canvas
  const canvas = await html2canvas(target, {
    scale: Math.max(1.5, scale),
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    imageTimeout: 15000,
    onclone: (clonedDoc, clonedElement) => {
      // 1. Extract and inline ALL stylesheet CSS rules directly into clonedDoc.head
      // This solves the Desktop/Electron file:// protocol issue where linked stylesheets are blocked by CORS/security
      try {
        let allCssRules = '';
        Array.from(document.styleSheets).forEach((sheet) => {
          try {
            const rules = sheet.cssRules || sheet.rules;
            if (rules) {
              Array.from(rules).forEach((rule) => {
                allCssRules += rule.cssText + '\n';
              });
            }
          } catch (e) {
            if (sheet.ownerNode) {
              clonedDoc.head.appendChild(sheet.ownerNode.cloneNode(true));
            }
          }
        });

        if (allCssRules) {
          const styleEl = clonedDoc.createElement('style');
          styleEl.textContent = allCssRules;
          clonedDoc.head.appendChild(styleEl);
        }
      } catch (err) {
        console.warn('Styles extraction warning:', err);
      }

      // 2. Clone all existing <style> and <link> elements into head
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach((styleNode) => {
        clonedDoc.head.appendChild(styleNode.cloneNode(true));
      });

      // 3. Strip transforms or zoom from preview container
      clonedElement.style.transform = 'none';
      clonedElement.style.margin = '0 auto';
      clonedElement.style.boxShadow = 'none';

      // Ensure all parents in the clone are visible
      let curr: HTMLElement | null = clonedElement.parentElement;
      while (curr && curr !== clonedDoc.body) {
        curr.style.transform = 'none';
        curr.style.overflow = 'visible';
        curr.style.width = 'auto';
        curr.style.height = 'auto';
        curr.style.maxHeight = 'none';
        curr = curr.parentElement;
      }
    },
  });

  const imgData = canvas.toDataURL('image/png', 0.95);
  const canvasAspect = canvas.height / canvas.width;

  const widthMm = def.widthMm;
  const isContinuous = def.isThermal || !def.heightMm;
  const calculatedHeightMm = widthMm * canvasAspect;

  const safeFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;

  if (isContinuous || !def.heightMm || calculatedHeightMm <= (def.heightMm + 2)) {
    // Single page document (Thermal roll, or document fits in 1 page)
    const pageHeightMm = isContinuous ? calculatedHeightMm : (def.heightMm ?? 297);
    const orientation: 'portrait' | 'landscape' = widthMm > pageHeightMm ? 'landscape' : 'portrait';

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: [widthMm, pageHeightMm],
      compress: true,
    });

    pdf.addImage(imgData, 'PNG', 0, 0, widthMm, isContinuous ? pageHeightMm : calculatedHeightMm, undefined, 'FAST');
    pdf.save(safeFilename);
  } else {
    // Multi-page document (e.g. multi-page invoice or long statement of account)
    const pageHeightMm = def.heightMm ?? 297;
    const orientation: 'portrait' | 'landscape' = widthMm > pageHeightMm ? 'landscape' : 'portrait';

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: [widthMm, pageHeightMm],
      compress: true,
    });

    let heightLeftMm = calculatedHeightMm;
    let positionMm = 0;

    pdf.addImage(imgData, 'PNG', 0, positionMm, widthMm, calculatedHeightMm, undefined, 'FAST');
    heightLeftMm -= pageHeightMm;

    while (heightLeftMm > 2) {
      positionMm -= pageHeightMm;
      pdf.addPage([widthMm, pageHeightMm], orientation);
      pdf.addImage(imgData, 'PNG', 0, positionMm, widthMm, calculatedHeightMm, undefined, 'FAST');
      heightLeftMm -= pageHeightMm;
    }

    pdf.save(safeFilename);
  }
}

