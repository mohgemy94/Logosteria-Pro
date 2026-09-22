import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { getSystemSettings } from './settings';
import { saveOrShareBlob } from './fileSaver';

export interface ExportColumnDef {
  header: string;
  key?: string;
  width?: number; // approx character width for Excel
  align?: 'left' | 'center' | 'right';
  format?: (value: any, row: any) => string | number;
}

export interface UniversalExportOptions {
  filename: string;
  sheetName?: string | undefined;
  title: string;
  subtitle?: string | undefined;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  columns?: ExportColumnDef[] | undefined;
  columnWidths?: number[] | undefined;
  summaryRows?: (string | number | boolean | null | undefined)[][] | undefined;
  filterSummary?: string | undefined;
  elementToCapture?: HTMLElement | null | undefined;
  orientation?: 'portrait' | 'landscape' | undefined;
}

/**
 * Universal XLSX (Excel) Exporter with Arabic RTL and styling support
 */
export function exportToXLSX(options: UniversalExportOptions): void {
  const {
    filename,
    sheetName = 'البيانات',
    title,
    subtitle = '',
    headers,
    rows,
    columnWidths,
    summaryRows = [],
    filterSummary = ''
  } = options;

  const settings = getSystemSettings();
  const companyName = settings?.company?.nameAr || settings?.company?.nameEn || 'لوجوستريا للمحاسبة';
  const taxNumber = settings?.company?.taxNumber || '';
  const nowStr = new Date().toLocaleString('ar-SA');

  const sheetData: any[][] = [
    [companyName],
    [title],
    [`تاريخ الاستخراج: ${nowStr} ${taxNumber ? `| الرقم الضريبي: ${taxNumber}` : ''}`],
  ];

  if (subtitle || filterSummary) {
    sheetData.push([filterSummary ? `الفلترة: ${filterSummary}` : subtitle]);
  }

  sheetData.push([]); // blank separator
  sheetData.push(headers); // Table header row

  // Data rows
  rows.forEach(row => {
    sheetData.push(row.map(cell => (cell === null || cell === undefined ? '' : cell)));
  });

  // Summary rows
  if (summaryRows.length > 0) {
    sheetData.push([]);
    summaryRows.forEach(sRow => {
      sheetData.push(sRow.map(cell => (cell === null || cell === undefined ? '' : cell)));
    });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Set Right-to-Left for native Arabic display
  ws['!views'] = [{ RTL: true }];

  // Compute or apply column widths
  if (columnWidths && columnWidths.length > 0) {
    ws['!cols'] = columnWidths.map(w => ({ wch: Math.max(w, 10) }));
  } else {
    // Auto-calculate column widths based on content
    const calculatedCols: { wch: number }[] = headers.map((h, i) => {
      let maxLen = (h ? String(h).length : 5);
      rows.forEach(r => {
        const cell = r[i];
        if (cell !== undefined && cell !== null) {
          const len = String(cell).length;
          if (len > maxLen) maxLen = len;
        }
      });
      return { wch: Math.min(Math.max(maxLen + 4, 12), 45) };
    });
    ws['!cols'] = calculatedCols;
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' 
  });

  const safeFilename = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  downloadBlob(blob, safeFilename);
}

/**
 * Universal CSV Exporter with UTF-8 BOM for Arabic compatibility in Excel/Sheets
 */
export function exportToCSV(options: UniversalExportOptions): void {
  const {
    filename,
    title,
    headers,
    rows,
    summaryRows = [],
    filterSummary = ''
  } = options;

  const settings = getSystemSettings();
  const companyName = settings?.company?.nameAr || settings?.company?.nameEn || 'لوجوستريا للمحاسبة';
  const nowStr = new Date().toLocaleString('ar-SA');

  const escapeCSV = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const lines: string[] = [
    `# ${companyName}`,
    `# ${title}`,
    `# تاريخ واستخراج: ${nowStr}`,
    filterSummary ? `# نطاق الفلترة: ${filterSummary}` : '',
    ''
  ].filter(Boolean);

  // Headers
  lines.push(headers.map(escapeCSV).join(','));

  // Data rows
  rows.forEach(row => {
    lines.push(row.map(escapeCSV).join(','));
  });

  // Summary rows
  if (summaryRows.length > 0) {
    lines.push('');
    summaryRows.forEach(sRow => {
      lines.push(sRow.map(escapeCSV).join(','));
    });
  }

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  const safeFilename = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;
  downloadBlob(blob, safeFilename);
}

/**
 * Universal PDF Exporter:
 * If an HTML element is provided, it uses html2canvas and jsPDF to capture the styled view.
 * Otherwise, it generates a clean, styled HTML report with company branding and table layout.
 */
export async function exportToPDF(options: UniversalExportOptions): Promise<void> {
  const {
    filename,
    title,
    subtitle = '',
    headers,
    rows,
    summaryRows = [],
    filterSummary = '',
    elementToCapture,
    orientation = 'landscape'
  } = options;

  const safeFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;

  // Option 1: Direct element capture
  if (elementToCapture) {
    await captureAndSavePdf(elementToCapture, safeFilename, orientation);
    return;
  }

  // Option 2: Build beautifully formatted off-screen container
  const settings = getSystemSettings();
  const companyName = settings?.company?.nameAr || settings?.company?.nameEn || 'لوجوستريا للمحاسبة';
  const taxNumber = settings?.company?.taxNumber || '';
  const commercialRegister = settings?.company?.commercialRegister || '';
  const nowStr = new Date().toLocaleString('ar-SA');

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = orientation === 'landscape' ? '1120px' : '820px';
  container.style.backgroundColor = '#ffffff';
  container.style.padding = '24px';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Cairo, system-ui, -apple-system, sans-serif';
  container.dir = 'rtl';

  let tableRowsHtml = '';
  rows.forEach((row, idx) => {
    const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    tableRowsHtml += `
      <tr style="background: ${bg}; border-bottom: 1px solid #e2e8f0;">
        ${row.map(cell => `
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 11px; text-align: right;">
            ${cell !== null && cell !== undefined ? String(cell) : '-'}
          </td>
        `).join('')}
      </tr>
    `;
  });

  let summaryHtml = '';
  if (summaryRows.length > 0) {
    summaryHtml = `
      <tfoot>
        ${summaryRows.map(sRow => `
          <tr style="background: #f1f5f9; font-weight: bold; border-top: 2px solid #0f172a;">
            ${sRow.map(cell => `
              <td style="padding: 7px 8px; border: 1px solid #cbd5e1; font-size: 11px; text-align: right;">
                ${cell !== null && cell !== undefined ? String(cell) : ''}
              </td>
            `).join('')}
          </tr>
        `).join('')}
      </tfoot>
    `;
  }

  container.innerHTML = `
    <div style="font-family: 'Cairo', system-ui, sans-serif; direction: rtl; color: #0f172a; width: 100%;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px;">
        <div>
          <h1 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 900; color: #0f172a;">${companyName}</h1>
          <div style="font-size: 11px; color: #475569; line-height: 1.5;">
            ${taxNumber ? `<span>الرقم الضريبي: <b>${taxNumber}</b></span> | ` : ''}
            ${commercialRegister ? `<span>س.ت: <b>${commercialRegister}</b></span> | ` : ''}
            <span>نظام لوجوستريا المحاسبي</span>
          </div>
        </div>
        <div style="text-align: left;">
          <div style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 14px; border-radius: 8px; text-align: center;">
            <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${title}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">تاريخ الاستخراج: ${nowStr}</div>
          </div>
        </div>
      </div>

      <!-- Filter/Subtitle bar -->
      ${(subtitle || filterSummary) ? `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 14px; font-size: 11px;">
          <span style="color: #64748b;">نطاق التقرير: </span>
          <b style="color: #0f172a;">${filterSummary || subtitle}</b>
          <span style="float: left; color: #475569;">إجمالي السجلات: <b>${rows.length}</b></span>
        </div>
      ` : ''}

      <!-- Main Data Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff; text-align: right;">
            ${headers.map(h => `
              <th style="padding: 7px 8px; border: 1px solid #0f172a; font-weight: bold; font-size: 11px;">${h}</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
        ${summaryHtml}
      </table>

      <!-- Signatures Footer -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 25px; padding-top: 15px; border-top: 1px dashed #cbd5e1; font-size: 11px;">
        <div style="text-align: center; width: 160px;">
          <div>إعداد / المحاسب</div>
          <div style="margin-top: 30px; border-top: 1px solid #64748b; padding-top: 4px;">التوقيع</div>
        </div>
        <div style="text-align: center; width: 160px;">
          <div>المراجعة والتدقيق</div>
          <div style="margin-top: 30px; border-top: 1px solid #64748b; padding-top: 4px;">التوقيع</div>
        </div>
        <div style="text-align: center; width: 160px;">
          <div>الاعتماد والختم الرسمي</div>
          <div style="margin-top: 30px; border-top: 1px solid #64748b; padding-top: 4px;">الختم المالي</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    await captureAndSavePdf(container, safeFilename, orientation);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

async function captureAndSavePdf(element: HTMLElement, filename: string, orientation: 'portrait' | 'landscape'): Promise<void> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Font readiness fallback
    }
  }

  const canvas = await html2canvas(element, {
    scale: 3.2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    imageTimeout: 15000,
    onclone: (clonedDoc) => {
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
        console.warn('Styles extraction warning in universalExport:', err);
      }

      document.querySelectorAll('style, link[rel="stylesheet"]').forEach((styleNode) => {
        clonedDoc.head.appendChild(styleNode.cloneNode(true));
      });

      const highResStyle = clonedDoc.createElement('style');
      highResStyle.textContent = `
        * {
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
          text-rendering: optimizeLegibility !important;
        }
        .text-slate-900, .text-slate-800, .text-black, h1, h2, h3, h4, th, strong, b {
          color: #000000 !important;
        }
        .text-slate-700, .text-slate-600 {
          color: #1e293b !important;
        }
        .text-slate-500 {
          color: #334155 !important;
        }
        .border-slate-300, .border-slate-200 {
          border-color: #94a3b8 !important;
        }
        .border-slate-100 {
          border-color: #cbd5e1 !important;
        }
        img, canvas, svg {
          image-rendering: -webkit-optimize-contrast !important;
          image-rendering: crisp-edges !important;
        }
      `;
      clonedDoc.head.appendChild(highResStyle);
    },
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth - 16; // 8mm margin each side
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 8; // top margin

  pdf.addImage(imgData, 'PNG', 8, position, imgWidth, imgHeight, undefined, 'SLOW');
  heightLeft -= (pageHeight - 16);

  while (heightLeft > 5) {
    position = heightLeft - imgHeight + 8;
    pdf.addPage('a4', orientation);
    pdf.addImage(imgData, 'PNG', 8, position, imgWidth, imgHeight, undefined, 'SLOW');
    heightLeft -= (pageHeight - 16);
  }

  const pdfBlob = pdf.output('blob');
  await saveOrShareBlob(pdfBlob, filename, 'application/pdf');
}

async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  await saveOrShareBlob(blob, filename);
}
