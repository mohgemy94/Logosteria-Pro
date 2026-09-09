import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { 
  type PrintPaperFormat, 
  type CustomPaperSize, 
  getPaperFormatDef 
} from './printPaperFormats';

export interface PdfExportOptions {
  filename?: string;
  format?: PrintPaperFormat;
  customSize?: CustomPaperSize;
  scale?: number;
  quality?: number;
}

/**
 * Exports any DOM element to a professional, high-resolution PDF document in the browser.
 * Preserves native Arabic typography, RTL alignment, tables, colors, borders, and QR codes.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  options: PdfExportOptions = {}
): Promise<void> {
  const {
    filename = 'invoice.pdf',
    format = 'A4',
    customSize,
    scale = 2, // 2x gives crystal clear vector-like sharpness for text
  } = options;

  try {
    const def = getPaperFormatDef(format, customSize);

    // 1. Capture element to high-res canvas with oklch & modern color sanitizer
    const canvas = await html2canvas(element, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: def.baseWidthPx,
      width: def.baseWidthPx,
      onclone: (clonedDoc, clonedElement) => {
        try {
          clonedElement.style.width = `${def.baseWidthPx}px`;
          clonedElement.style.maxWidth = 'none';
          clonedElement.style.transform = 'none';
          clonedElement.style.margin = '0';

          // Helper canvas for converting modern browser color spaces (oklch, oklab, lch) to standard rgb/hex
          const tempCanvas = clonedDoc.createElement('canvas');
          tempCanvas.width = 1;
          tempCanvas.height = 1;
          const ctx = tempCanvas.getContext('2d');

          const convertColor = (val: string): string => {
            if (!val || typeof val !== 'string') return val;
            if (!val.includes('oklch') && !val.includes('oklab') && !val.includes('lch')) return val;
            if (ctx) {
              try {
                ctx.fillStyle = '#000000'; // fallback reset
                ctx.fillStyle = val;
                return ctx.fillStyle; // Browser native 2D context resolves oklch to rgb(...)
              } catch {
                return '#1e293b';
              }
            }
            return '#1e293b';
          };

          // Sanitize inline style properties that may hold oklch
          const allElements = clonedElement.querySelectorAll('*');
          const colorProperties = [
            'color',
            'backgroundColor',
            'borderColor',
            'borderTopColor',
            'borderRightColor',
            'borderBottomColor',
            'borderLeftColor',
            'outlineColor',
            'fill',
            'stroke'
          ];

          allElements.forEach(el => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.style) {
              for (const prop of colorProperties) {
                const styleVal = (htmlEl.style as any)[prop];
                if (styleVal && typeof styleVal === 'string' && (styleVal.includes('oklch') || styleVal.includes('oklab') || styleVal.includes('lch'))) {
                  (htmlEl.style as any)[prop] = convertColor(styleVal);
                }
              }
            }
          });

          // Sanitize any <style> tags within clonedDoc that might contain oklch(...)
          const styleTags = clonedDoc.querySelectorAll('style');
          styleTags.forEach(st => {
            if (st.textContent && (st.textContent.includes('oklch') || st.textContent.includes('oklab'))) {
              st.textContent = st.textContent.replace(/oklch\([^)]+\)/gi, (match) => convertColor(match));
            }
          });
        } catch (cloneErr) {
          console.warn('PDF export color sanitizer warning:', cloneErr);
        }
      },
    });

    // 2. Setup jsPDF page format using the exact paper size definition
    const pdfWidthMm = def.widthMm;
    let pdfHeightMm = def.heightMm || 297;
    const orientation: 'p' | 'l' = 'p';

    if (def.isThermal) {
      // For thermal rolls, height dynamically adapts to the rendered content
      const dynamicReceiptHeight = Math.max((canvas.height * pdfWidthMm) / canvas.width, 60);
      pdfHeightMm = dynamicReceiptHeight;
    }

    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: [pdfWidthMm, pdfHeightMm],
      compress: true,
    });

    const imgData = canvas.toDataURL('image/png', 0.95);
    const contentHeightMm = (canvas.height * pdfWidthMm) / canvas.width;

    if (def.isThermal || contentHeightMm <= pdfHeightMm + 2) {
      // Fits comfortably on a single continuous page
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidthMm, contentHeightMm, undefined, 'FAST');
    } else {
      // Multi-page document handling for long invoices / statements
      let heightLeft = contentHeightMm;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidthMm, contentHeightMm, undefined, 'FAST');
      heightLeft -= pdfHeightMm;

      while (heightLeft > 0) {
        position -= pdfHeightMm;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidthMm, contentHeightMm, undefined, 'FAST');
        heightLeft -= pdfHeightMm;
      }
    }

    // 3. Save the PDF file
    const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(safeFilename);
  } catch (error) {
    console.error('Failed to export PDF:', error);
    throw error;
  }
}
