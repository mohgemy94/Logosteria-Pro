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
  orientation?: 'portrait' | 'landscape';
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
  colorMode?: PrintColorMode,
  orientation: 'portrait' | 'landscape' = 'portrait'
): void {
  if (typeof window === 'undefined') return;

  const target = element || document.getElementById('certified-invoice-document');
  const activeColorMode = colorMode || getSavedPrintColorMode();
  applyPrintPageStyle(format, customSize, activeColorMode, orientation);

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
    if (orientation === 'landscape') {
      const w = Math.max(def.widthMm, def.heightMm);
      const h = Math.min(def.widthMm, def.heightMm);
      sizeCss = `${w}mm ${h}mm landscape`;
      marginCss = '5mm';
    } else {
      sizeCss = `${def.widthMm}mm ${def.heightMm}mm portrait`;
      marginCss = def.widthMm <= 110 ? '3mm' : def.widthMm <= 150 ? '4mm' : '6mm';
    }
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
  const activeColorMode = colorMode || getSavedPrintColorMode();
  const isLandscape = options.orientation === 'landscape';
  const targetWidthPx = isLandscape ? 1320 : 1020;

  // Check if target contains multiple discrete page sheets (like multi-page customer/detailed statements)
  let discretePageNodes: HTMLElement[] = [];
  if (target.getAttribute('data-statement-sheet') === 'true') {
    const parentContainer = target.closest('[data-statement-all-pages="true"]') || target.parentElement;
    const siblingSheets = parentContainer ? Array.from(parentContainer.querySelectorAll<HTMLElement>('[data-statement-sheet="true"]')) : [];
    if (siblingSheets.length > 1) {
      discretePageNodes = siblingSheets;
    } else {
      discretePageNodes = [target];
    }
  } else {
    discretePageNodes = Array.from(
      target.querySelectorAll<HTMLElement>('[data-statement-sheet="true"]')
    );
    if (discretePageNodes.length === 0) {
      discretePageNodes = Array.from(
        target.querySelectorAll<HTMLElement>('.page-sheet-wrapper')
      );
    }
  }

  // If discretePageNodes has only 1 or 0 sheets, check if there is an all-pages container in the DOM
  if (discretePageNodes.length <= 1) {
    const allPagesRoot = document.querySelector<HTMLElement>('[data-statement-all-pages="true"]');
    if (allPagesRoot) {
      const sheets = Array.from(allPagesRoot.querySelectorAll<HTMLElement>('[data-statement-sheet="true"]'));
      if (sheets.length > discretePageNodes.length) {
        discretePageNodes = sheets;
      }
    }
  }

  // DISCRETE PAGE EXPORT: If document has discrete page sheets, render every single page cleanly to its own PDF page
  if (discretePageNodes.length >= 1) {
    const widthMm = isLandscape ? Math.max(def.widthMm, def.heightMm || 297) : def.widthMm;
    const pageHeightMm = isLandscape ? Math.min(def.widthMm, def.heightMm || 210) : (def.heightMm ?? 297);
    const orientation: 'portrait' | 'landscape' = isLandscape ? 'landscape' : 'portrait';
    const safeFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: [widthMm, pageHeightMm],
      compress: true,
    });

    if (document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {}
    }

    let firstPageImgData = '';

    for (let pageIdx = 0; pageIdx < discretePageNodes.length; pageIdx++) {
      const pageNode = discretePageNodes[pageIdx];
      if (!pageNode) continue;

      const pageSandbox = document.createElement('div');
      pageSandbox.style.position = 'absolute';
      pageSandbox.style.left = '-99999px';
      pageSandbox.style.top = '0';
      pageSandbox.style.width = `${targetWidthPx}px`;
      pageSandbox.style.minWidth = `${targetWidthPx}px`;
      pageSandbox.style.minHeight = 'auto';
      pageSandbox.style.height = 'auto';
      pageSandbox.style.overflow = 'visible';
      pageSandbox.style.zIndex = '-99999';
      pageSandbox.style.backgroundColor = '#ffffff';
      pageSandbox.style.opacity = '1';
      pageSandbox.style.pointerEvents = 'none';

      const pageClone = pageNode.cloneNode(true) as HTMLElement;
      pageClone.style.width = `${targetWidthPx}px`;
      pageClone.style.minWidth = `${targetWidthPx}px`;
      pageClone.style.maxWidth = `${targetWidthPx}px`;
      pageClone.style.minHeight = 'auto';
      pageClone.style.height = 'auto';
      pageClone.style.overflow = 'visible';
      pageClone.style.transform = 'none';
      pageClone.style.zoom = '1';
      pageClone.style.boxShadow = 'none';
      pageClone.style.margin = '0 auto';
      pageClone.style.marginTop = '0px';
      pageClone.style.marginBottom = '0px';
      pageClone.style.backgroundColor = '#ffffff';

      if (activeColorMode === 'bw') {
        pageClone.classList.add('print-bw-mode');
      }

      pageClone.querySelectorAll('*').forEach((node) => {
        if (node instanceof HTMLElement) {
          node.style.maxHeight = 'none';
          if (
            node.classList.contains('overflow-x-auto') || 
            node.classList.contains('overflow-y-auto') || 
            node.classList.contains('overflow-hidden') ||
            node.classList.contains('overflow-auto') ||
            node.style.overflow ||
            node.style.overflowX ||
            node.style.overflowY
          ) {
            node.style.overflow = 'visible';
            node.style.overflowX = 'visible';
            node.style.overflowY = 'visible';
          }
          if (node.tagName === 'TABLE') {
            node.style.width = '100%';
            node.style.minWidth = '100%';
            node.style.maxWidth = 'none';
            node.style.tableLayout = 'auto';
          }
        }
      });

      pageSandbox.appendChild(pageClone);
      document.body.appendChild(pageSandbox);

      try {
        const imgElements = Array.from(pageClone.querySelectorAll('img'));
        await Promise.all(
          imgElements.map((img) => {
            if (img.complete) return Promise.resolve(null);
            return new Promise((resolve) => {
              img.onload = () => resolve(null);
              img.onerror = () => resolve(null);
              setTimeout(resolve, 1500);
            });
          })
        );

        await new Promise((resolve) => setTimeout(resolve, 60));

        const pageScrollH = pageClone.scrollHeight;
        const pageOffsetH = pageClone.offsetHeight;
        const pageClientH = pageClone.clientHeight;
        const pageRectH = Math.ceil(pageClone.getBoundingClientRect().height);
        const pageHeight = Math.max(pageScrollH, pageOffsetH, pageClientH, pageRectH, 600) + 15;

        const pageCanvas = await html2canvas(pageClone, {
          scale: Math.max(scale, 2.5),
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          imageTimeout: 15000,
          width: targetWidthPx,
          height: pageHeight,
          windowWidth: targetWidthPx + 150,
          windowHeight: Math.max(window.innerHeight, pageHeight + 350),
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDoc: Document) => {
            const arabicStyle = clonedDoc.createElement('style');
            arabicStyle.textContent = `
              * {
                letter-spacing: normal !important;
                word-spacing: normal !important;
              }
              h1, h2, h3, h4, h5, h6, span, p, div, b, strong, th, td, a {
                letter-spacing: normal !important;
                font-feature-settings: "liga" 1, "dlig" 1, "calt" 1 !important;
                text-rendering: geometricPrecision !important;
              }
              .overflow-x-auto, .overflow-y-auto, .overflow-hidden, .overflow-auto {
                overflow: visible !important;
                max-height: none !important;
              }
              .print-bw-mode {
                filter: grayscale(100%) !important;
                color: #1e293b !important;
                background-color: #ffffff !important;
              }
              .print-bw-mode * {
                border-color: #cbd5e1 !important;
              }
              .print-bw-mode th, .print-bw-mode thead tr, .print-bw-mode thead th {
                background-color: #f1f5f9 !important;
                color: #0f172a !important;
                border-color: #94a3b8 !important;
              }
              .print-bw-mode .bg-slate-950,
              .print-bw-mode .bg-slate-900, 
              .print-bw-mode .bg-slate-800, 
              .print-bw-mode .bg-slate-700, 
              .print-bw-mode .bg-black {
                background-color: #f1f5f9 !important;
                color: #1e293b !important;
                border-color: #94a3b8 !important;
              }
              .print-bw-mode .text-white {
                color: #1e293b !important;
              }
              .print-bw-mode .text-rose-700,
              .print-bw-mode .text-rose-800,
              .print-bw-mode .text-emerald-700,
              .print-bw-mode .text-emerald-800,
              .print-bw-mode .text-blue-700,
              .print-bw-mode .text-blue-800,
              .print-bw-mode .text-amber-700,
              .print-bw-mode .text-amber-800 {
                color: #334155 !important;
              }
            `;
            clonedDoc.head.appendChild(arabicStyle);
          },
        });

        if (pageIdx > 0) {
          pdf.addPage([widthMm, pageHeightMm], orientation);
        }

        const pageImgData = pageCanvas.toDataURL('image/png');
        if (pageIdx === 0) {
          firstPageImgData = pageImgData;
        }

        const imgWidth = widthMm;
        const imgHeight = widthMm * (pageCanvas.height / pageCanvas.width);

        if (imgHeight <= pageHeightMm) {
          pdf.addImage(pageImgData, 'PNG', 0, 0, imgWidth, imgHeight, undefined, 'SLOW');
        } else {
          const scaleRatio = pageHeightMm / imgHeight;
          const scaledWidth = imgWidth * scaleRatio;
          const offsetX = (widthMm - scaledWidth) / 2;
          pdf.addImage(pageImgData, 'PNG', offsetX, 0, scaledWidth, pageHeightMm, undefined, 'SLOW');
        }
      } finally {
        if (document.body.contains(pageSandbox)) {
          document.body.removeChild(pageSandbox);
        }
      }
    }

    const pdfBlob = pdf.output('blob');
    const saveRes = await saveOrShareBlob(pdfBlob, safeFilename, 'application/pdf');
    return {
      ...saveRes,
      imgData: firstPageImgData,
      blob: pdfBlob,
      filename: safeFilename
    };
  }

  // Create an isolated sandbox attached directly to document.body
  // This completely eliminates any modal dialog clipping, viewport clipping, or overflow-y-auto truncation
  const sandbox = document.createElement('div');
  sandbox.style.position = 'absolute';
  sandbox.style.left = '-99999px';
  sandbox.style.top = '0';
  sandbox.style.width = `${targetWidthPx}px`;
  sandbox.style.minWidth = `${targetWidthPx}px`;
  sandbox.style.minHeight = 'auto';
  sandbox.style.height = 'auto';
  sandbox.style.maxHeight = 'none';
  sandbox.style.overflow = 'visible';
  sandbox.style.zIndex = '-99999';
  sandbox.style.backgroundColor = '#ffffff';
  sandbox.style.opacity = '1';
  sandbox.style.pointerEvents = 'none';

  // Clone target into sandbox
  const clone = target.cloneNode(true) as HTMLElement;
  clone.style.width = `${targetWidthPx}px`;
  clone.style.minWidth = `${targetWidthPx}px`;
  clone.style.maxWidth = `${targetWidthPx}px`;
  clone.style.minHeight = 'auto';
  clone.style.height = 'auto';
  clone.style.maxHeight = 'none';
  clone.style.overflow = 'visible';
  clone.style.transform = 'none';
  clone.style.zoom = '1';
  clone.style.boxShadow = 'none';
  clone.style.margin = '0 auto';
  clone.style.backgroundColor = '#ffffff';

  // Unconstrain all descendants inside the clone (table scrolling, overflow wrappers)
  clone.querySelectorAll('*').forEach((node) => {
    if (node instanceof HTMLElement) {
      node.style.maxHeight = 'none';
      if (
        node.classList.contains('overflow-x-auto') || 
        node.classList.contains('overflow-y-auto') || 
        node.classList.contains('overflow-hidden') ||
        node.classList.contains('overflow-auto') ||
        node.style.overflow ||
        node.style.overflowX ||
        node.style.overflowY
      ) {
        node.style.overflow = 'visible';
        node.style.overflowX = 'visible';
        node.style.overflowY = 'visible';
      }
      if (node.tagName === 'TABLE') {
        node.style.width = '100%';
        node.style.minWidth = '100%';
        node.style.maxWidth = 'none';
        node.style.tableLayout = 'auto';
      }
    }
  });

  if (activeColorMode === 'bw') {
    clone.classList.add('print-bw-mode');
  }

  sandbox.appendChild(clone);
  document.body.appendChild(sandbox);

  let canvas: HTMLCanvasElement;
  try {
    // Wait for fonts and all images to load
    if (document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {}
    }

    const imgElements = Array.from(clone.querySelectorAll('img'));
    await Promise.all(
      imgElements.map((img) => {
        if (img.complete) return Promise.resolve(null);
        return new Promise((resolve) => {
          img.onload = () => resolve(null);
          img.onerror = () => resolve(null);
          setTimeout(resolve, 1500);
        });
      })
    );

    // Allow DOM reflow tick
    await new Promise((resolve) => setTimeout(resolve, 100));

    const scrollH = clone.scrollHeight;
    const offsetH = clone.offsetHeight;
    const clientH = clone.clientHeight;
    const rectH = Math.ceil(clone.getBoundingClientRect().height);
    const fullHeight = Math.max(scrollH, offsetH, clientH, rectH, 600) + 30;
    const fullWidth = targetWidthPx;

    canvas = await html2canvas(clone, {
      scale: Math.max(scale, 2.5),
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 15000,
      width: fullWidth,
      height: fullHeight,
      windowWidth: fullWidth + 150,
      windowHeight: Math.max(window.innerHeight, fullHeight + 350),
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc: Document) => {
        // Enforce normal letter-spacing and standard ligatures to prevent broken/separated Arabic letters
        const arabicStyle = clonedDoc.createElement('style');
        arabicStyle.textContent = `
          * {
            letter-spacing: normal !important;
            word-spacing: normal !important;
          }
          h1, h2, h3, h4, h5, h6, span, p, div, b, strong, th, td, a {
            letter-spacing: normal !important;
            font-feature-settings: "liga" 1, "dlig" 1, "calt" 1 !important;
            text-rendering: geometricPrecision !important;
          }
          .overflow-x-auto, .overflow-y-auto, .overflow-hidden, .overflow-auto {
            overflow: visible !important;
            max-height: none !important;
          }
          .print-bw-mode {
            filter: grayscale(100%) !important;
            color: #1e293b !important;
            background-color: #ffffff !important;
          }
          .print-bw-mode * {
            border-color: #cbd5e1 !important;
          }
          .print-bw-mode th, .print-bw-mode thead tr, .print-bw-mode thead th {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            border-color: #94a3b8 !important;
          }
          .print-bw-mode .bg-slate-950,
          .print-bw-mode .bg-slate-900, 
          .print-bw-mode .bg-slate-800, 
          .print-bw-mode .bg-slate-700, 
          .print-bw-mode .bg-black {
            background-color: #f1f5f9 !important;
            color: #1e293b !important;
            border-color: #94a3b8 !important;
          }
          .print-bw-mode .text-white {
            color: #1e293b !important;
          }
          .print-bw-mode .text-rose-700,
          .print-bw-mode .text-rose-800,
          .print-bw-mode .text-emerald-700,
          .print-bw-mode .text-emerald-800,
          .print-bw-mode .text-blue-700,
          .print-bw-mode .text-blue-800,
          .print-bw-mode .text-amber-700,
          .print-bw-mode .text-amber-800 {
            color: #334155 !important;
          }
        `;
        clonedDoc.head.appendChild(arabicStyle);
      },
    });
  } finally {
    if (document.body.contains(sandbox)) {
      document.body.removeChild(sandbox);
    }
  }

  let widthMm = isLandscape ? Math.max(def.widthMm, def.heightMm || 297) : def.widthMm;
  const isContinuous = def.isThermal || !def.heightMm;
  let pageHeightMm = isContinuous 
    ? (widthMm * (canvas.height / canvas.width)) 
    : (isLandscape ? Math.min(def.widthMm, def.heightMm || 210) : (def.heightMm ?? 297));
  const orientation: 'portrait' | 'landscape' = isLandscape ? 'landscape' : (widthMm > pageHeightMm ? 'landscape' : 'portrait');
  const safeFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [widthMm, pageHeightMm],
    compress: true,
  });

  if (isContinuous || !def.heightMm) {
    // Thermal or Continuous roll receipt
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, widthMm, pageHeightMm, undefined, 'SLOW');
  } else {
    // Standard A4 / Multi-page document
    const pageHeightPx = Math.floor(canvas.width * (pageHeightMm / widthMm));

    if (canvas.height <= pageHeightPx + 15) {
      // Entire statement fits on one page
      const actualHeightMm = Math.min(pageHeightMm, widthMm * (canvas.height / canvas.width));
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, widthMm, actualHeightMm, undefined, 'SLOW');
    } else {
      // Multi-page statement: slice canvas cleanly page by page so no content is ever clipped
      const totalPages = Math.ceil(canvas.height / pageHeightPx);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) {
          pdf.addPage([widthMm, pageHeightMm], orientation);
        }

        const sourceY = page * pageHeightPx;
        const sourceHeight = Math.min(pageHeightPx, canvas.height - sourceY);

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = pageHeightPx;
        const pageCtx = pageCanvas.getContext('2d');
        if (pageCtx) {
          pageCtx.fillStyle = '#ffffff';
          pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          pageCtx.drawImage(
            canvas,
            0, sourceY, canvas.width, sourceHeight,
            0, 0, canvas.width, sourceHeight
          );
          const pageImgData = pageCanvas.toDataURL('image/png');
          pdf.addImage(pageImgData, 'PNG', 0, 0, widthMm, pageHeightMm, undefined, 'SLOW');
        }
      }
    }
  }

  const pdfBlob = pdf.output('blob');
  const saveRes = await saveOrShareBlob(pdfBlob, safeFilename, 'application/pdf');
  return {
    ...saveRes,
    imgData: canvas.toDataURL('image/png'),
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
