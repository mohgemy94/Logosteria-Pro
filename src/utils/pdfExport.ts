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
import { saveOrShareBlob, isMobileDevice, type SaveResult } from './fileSaver';

export interface PdfExportOptions {
  filename?: string;
  format?: PrintPaperFormat;
  customSize?: CustomPaperSize;
  colorMode?: PrintColorMode;
  scale?: number;
  quality?: number;
}

export interface PdfExportResult extends SaveResult {
  imgData?: string;
  blob?: Blob;
  filename?: string;
}

/**
 * Directly prints an HTML element.
 * For mobile / Android APK: Uses direct window.print() so Android Print Spooler (Save as PDF) opens.
 * For desktop: Uses isolated iframe to prevent UI clipping.
 */
export function printElementDirectly(
  element?: HTMLElement | null,
  format: PrintPaperFormat = 'A4',
  customSize?: CustomPaperSize,
  colorMode?: PrintColorMode
): void {
  if (typeof window === 'undefined') return;

  const target = element || document.getElementById('certified-invoice-document');
  const activeColorMode = colorMode || getSavedPrintColorMode();
  applyPrintPageStyle(format, customSize, activeColorMode);

  // Mobile / Android APK: Main window print triggers the native OS Print Spooler
  if (isMobileDevice() || !target) {
    window.focus();
    window.print();
    return;
  }

  // Desktop: Isolated iframe print
  const def = getPaperFormatDef(format, customSize);
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
    window.print();
    return;
  }

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

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
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
 * Exports the invoice directly to a PDF file using jsPDF and html2canvas.
 */
export async function exportElementToPdf(
  element?: HTMLElement | null,
  options: PdfExportOptions = {}
): Promise<PdfExportResult> {
  const {
    filename = 'invoice.pdf',
    format = 'A4',
    customSize,
    colorMode,
    scale = 2.5,
  } = options;

  const target = element || document.getElementById('certified-invoice-document');
  if (!target) {
    throw new Error('Target printable document element not found');
  }

  const def = getPaperFormatDef(format, customSize);

  // Temporarily reset CSS transforms on ancestors for crisp html2canvas rasterization
  const transformedAncestors: Array<{ el: HTMLElement; transform: string }> = [];
  let curr: HTMLElement | null = target.parentElement;
  while (curr && curr !== document.body) {
    const style = window.getComputedStyle(curr);
    if (style.transform && style.transform !== 'none') {
      transformedAncestors.push({ el: curr, transform: curr.style.transform });
      curr.style.transform = 'none';
    }
    curr = curr.parentElement;
  }

  const activeColorMode = colorMode || getSavedPrintColorMode();
  if (activeColorMode === 'bw') {
    target.classList.add('print-bw-mode');
  }

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(target, {
      scale: Math.max(scale, 2),
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 15000,
      onclone: (clonedDoc: Document) => {
        const clonedTarget = clonedDoc.getElementById(target.id) || clonedDoc.querySelector('.printable-invoice-doc');
        if (clonedTarget instanceof HTMLElement) {
          clonedTarget.style.transform = 'none';
          clonedTarget.style.margin = '0 auto';
          clonedTarget.style.boxShadow = 'none';
          clonedTarget.style.border = 'none';
          clonedTarget.style.backgroundColor = '#ffffff';
          if (activeColorMode === 'bw') {
            clonedTarget.classList.add('print-bw-mode');
          }
        }
      },
    });
  } finally {
    if (activeColorMode === 'bw') {
      target.classList.remove('print-bw-mode');
    }
    transformedAncestors.forEach(({ el, transform }) => {
      el.style.transform = transform;
    });
  }

  const imgData = canvas.toDataURL('image/png');
  const canvasAspect = canvas.height / canvas.width;

  const widthMm = def.widthMm;
  const isContinuous = def.isThermal || !def.heightMm;
  const calculatedHeightMm = widthMm * canvasAspect;

  const safeFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;

  let pdfBlob: Blob;
  if (isContinuous || !def.heightMm || calculatedHeightMm <= (def.heightMm + 2)) {
    const pageHeightMm = isContinuous ? calculatedHeightMm : (def.heightMm ?? 297);
    const orientation: 'portrait' | 'landscape' = widthMm > pageHeightMm ? 'landscape' : 'portrait';

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: [widthMm, pageHeightMm],
      compress: true,
    });

    pdf.addImage(imgData, 'PNG', 0, 0, widthMm, isContinuous ? pageHeightMm : calculatedHeightMm, undefined, 'SLOW');
    pdfBlob = pdf.output('blob');
  } else {
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

    pdf.addImage(imgData, 'PNG', 0, positionMm, widthMm, calculatedHeightMm, undefined, 'SLOW');
    heightLeftMm -= pageHeightMm;

    while (heightLeftMm > 2) {
      positionMm -= pageHeightMm;
      pdf.addPage([widthMm, pageHeightMm], orientation);
      pdf.addImage(imgData, 'PNG', 0, positionMm, widthMm, calculatedHeightMm, undefined, 'SLOW');
      heightLeftMm -= pageHeightMm;
    }

    pdfBlob = pdf.output('blob');
  }

  const saveRes = await saveOrShareBlob(pdfBlob, safeFilename, 'application/pdf');
  return {
    ...saveRes,
    imgData,
    blob: pdfBlob,
    filename: safeFilename
  };
}

export async function saveOrSharePdf(pdf: jsPDF, filename: string): Promise<PdfExportResult> {
  const safeFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  const pdfBlob = pdf.output('blob');
  const saveRes = await saveOrShareBlob(pdfBlob, safeFilename, 'application/pdf');
  return {
    ...saveRes,
    blob: pdfBlob,
    filename: safeFilename
  };
}
