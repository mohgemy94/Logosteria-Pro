export type PrintPaperFormat =
  | 'A4'
  | 'A5'
  | 'A6'
  | 'A7'
  | 'HALF_A4'
  | 'QUARTER_A4'
  | 'THERMAL_58'
  | 'THERMAL_80'
  | 'THERMAL_110'
  | 'CUSTOM'
  | 'RECEIPT'; // Alias for THERMAL_80 for backward compatibility

export interface CustomPaperSize {
  widthCm: number;
  heightCm: number;
}

export interface PaperFormatDef {
  id: PrintPaperFormat;
  label: string; // The exact label requested by the user
  shortName: string;
  widthMm: number;
  heightMm?: number | undefined; // undefined for continuous rolls
  isThermal: boolean;
  baseWidthPx: number;
  category: 'standard' | 'fraction' | 'thermal' | 'custom';
  description: string;
}

export const PAPER_FORMAT_LIST: PaperFormatDef[] = [
  {
    id: 'A4',
    label: 'A4: 21 × 29.7 سم',
    shortName: 'A4',
    widthMm: 210,
    heightMm: 297,
    isThermal: false,
    baseWidthPx: 794,
    category: 'standard',
    description: 'المقاس المكتبي القياسي لكافة الفواتير والتقارير الرسمية',
  },
  {
    id: 'A5',
    label: 'A5: 14.8 × 21 سم',
    shortName: 'A5',
    widthMm: 148,
    heightMm: 210,
    isThermal: false,
    baseWidthPx: 560,
    category: 'standard',
    description: 'مقاس مدمج نصف A4 مناسب للسندات والفواتير السريعة',
  },
  {
    id: 'A6',
    label: 'A6: 10.5 × 14.8 سم',
    shortName: 'A6',
    widthMm: 105,
    heightMm: 148,
    isThermal: false,
    baseWidthPx: 397,
    category: 'standard',
    description: 'مقاس الجيب لسندات القبض والصرف وبطاقات الاستلام',
  },
  {
    id: 'A7',
    label: 'A7: 7.4 × 10.5 سم',
    shortName: 'A7',
    widthMm: 74,
    heightMm: 105,
    isThermal: false,
    baseWidthPx: 280,
    category: 'standard',
    description: 'مقاس بطاقة مصغر للملصقات والبطاقات الصغيرة',
  },
  {
    id: 'HALF_A4',
    label: 'نصف A4: 14.85 × 21 سم',
    shortName: 'نصف A4',
    widthMm: 148.5,
    heightMm: 210,
    isThermal: false,
    baseWidthPx: 561,
    category: 'fraction',
    description: 'قص ورقة A4 بالنصف بدقة متناهية',
  },
  {
    id: 'QUARTER_A4',
    label: 'ربع A4: 10.5 × 14.85 سم',
    shortName: 'ربع A4',
    widthMm: 105,
    heightMm: 148.5,
    isThermal: false,
    baseWidthPx: 397,
    category: 'fraction',
    description: 'قص ربع ورقة A4 للأذونات وسندات الاستلام المختصرة',
  },
  {
    id: 'THERMAL_58',
    label: 'حراري 58 مم: 5.8 سم عرض',
    shortName: 'حراري 58 مم',
    widthMm: 58,
    heightMm: undefined,
    isThermal: true,
    baseWidthPx: 220,
    category: 'thermal',
    description: 'طابعات البلوتوث المحمولة والإيصالات الصغيرة (58mm)',
  },
  {
    id: 'THERMAL_80',
    label: 'حراري 80 مم: 8 سم عرض',
    shortName: 'حراري 80 مم',
    widthMm: 80,
    heightMm: undefined,
    isThermal: true,
    baseWidthPx: 302,
    category: 'thermal',
    description: 'طابعات نقاط البيع والكاشير المعتمدة (80mm POS)',
  },
  {
    id: 'THERMAL_110',
    label: 'حراري 110 مم: 11 سم عرض',
    shortName: 'حراري 110 مم',
    widthMm: 110,
    heightMm: undefined,
    isThermal: true,
    baseWidthPx: 416,
    category: 'thermal',
    description: 'طابعات البوالص والشحن والإيصالات العريضة (110mm)',
  },
  {
    id: 'CUSTOM',
    label: 'مقاس مخصص: حسب الحاجة',
    shortName: 'مقاس مخصص',
    widthMm: 210,
    heightMm: 297,
    isThermal: false,
    baseWidthPx: 794,
    category: 'custom',
    description: 'تحديد أبعاد مخصصة للطول والعرض بالسنتيمتر (حسب الطلب)',
  },
];

export const DEFAULT_CUSTOM_SIZE: CustomPaperSize = {
  widthCm: 21,
  heightCm: 29.7,
};

export type PrintColorMode = 'bw' | 'color';

const STORAGE_FORMAT_KEY = 'alpha_print_paper_format_v2';
const STORAGE_CUSTOM_KEY = 'alpha_print_custom_size_v2';
const STORAGE_COLOR_MODE_KEY = 'alpha_print_color_mode_v1';

export function getSavedPrintColorMode(): PrintColorMode {
  if (typeof window === 'undefined') return 'bw';
  try {
    const saved = localStorage.getItem(STORAGE_COLOR_MODE_KEY);
    if (saved === 'color') return 'color';
    return 'bw'; // Default to black-and-white high contrast
  } catch {
    return 'bw';
  }
}

export function savePrintColorMode(mode: PrintColorMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_COLOR_MODE_KEY, mode);
    window.dispatchEvent(new CustomEvent('alpha-print-color-mode-changed', { detail: { mode } }));
  } catch (err) {
    console.error('Failed to save print color mode:', err);
  }
}

export function normalizePaperFormat(fmt?: string): PrintPaperFormat {
  if (!fmt) return 'A4';
  if (fmt === 'RECEIPT') return 'THERMAL_80';
  const match = PAPER_FORMAT_LIST.find(p => p.id === fmt);
  return match ? match.id : 'A4';
}

export function getPaperFormatDef(format: PrintPaperFormat, customSize?: CustomPaperSize): PaperFormatDef {
  const norm = normalizePaperFormat(format);
  const found = PAPER_FORMAT_LIST.find(p => p.id === norm);
  const def: PaperFormatDef = found ?? PAPER_FORMAT_LIST[0]!;

  if (norm === 'CUSTOM') {
    const size = customSize || DEFAULT_CUSTOM_SIZE;
    const widthMm = Math.max(20, Math.round(size.widthCm * 10));
    const heightMm = size.heightCm ? Math.max(20, Math.round(size.heightCm * 10)) : undefined;
    const customDef: PaperFormatDef = {
      id: 'CUSTOM',
      label: `مقاس مخصص: ${size.widthCm} × ${size.heightCm} سم`,
      shortName: `مخصص ${size.widthCm}×${size.heightCm}سم`,
      widthMm,
      heightMm,
      isThermal: false,
      baseWidthPx: Math.round(widthMm * 3.7795),
      category: 'custom',
      description: 'تحديد أبعاد مخصصة للطول والعرض بالسنتيمتر (حسب الطلب)',
    };
    return customDef;
  }

  return def;
}

export function getSavedPrintPaperFormat(): {
  format: PrintPaperFormat;
  customSize: CustomPaperSize;
  def: PaperFormatDef;
} {
  if (typeof window === 'undefined') {
    const def = getPaperFormatDef('A4');
    return { format: 'A4', customSize: DEFAULT_CUSTOM_SIZE, def };
  }

  try {
    const savedFmt = localStorage.getItem(STORAGE_FORMAT_KEY);
    const savedCustom = localStorage.getItem(STORAGE_CUSTOM_KEY);
    let customSize = DEFAULT_CUSTOM_SIZE;

    if (savedCustom) {
      try {
        const parsed = JSON.parse(savedCustom);
        if (parsed && typeof parsed.widthCm === 'number' && typeof parsed.heightCm === 'number') {
          customSize = {
            widthCm: Math.max(2, parsed.widthCm),
            heightCm: Math.max(2, parsed.heightCm),
          };
        }
      } catch (e) {
        console.warn('Failed to parse saved custom paper size', e);
      }
    }

    const format = normalizePaperFormat(savedFmt || undefined);
    const def = getPaperFormatDef(format, customSize);
    return { format, customSize, def };
  } catch {
    const def = getPaperFormatDef('A4');
    return { format: 'A4', customSize: DEFAULT_CUSTOM_SIZE, def };
  }
}

/**
 * Applies the CSS @page size for native window.print()
 */
export function applyPrintPageStyle(
  format: PrintPaperFormat, 
  customSize?: CustomPaperSize,
  colorMode?: PrintColorMode
): void {
  if (typeof document === 'undefined') return;

  const def = getPaperFormatDef(format, customSize);
  const activeColorMode = colorMode || getSavedPrintColorMode();
  let styleEl = document.getElementById('dynamic-print-paper-size') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-print-paper-size';
    document.head.appendChild(styleEl);
  }

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
      /* High-contrast black & white paper print rules */
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
      .printable-invoice-doc .border-dashed,
      .printable-invoice-doc .border-dotted {
        border-color: #000000 !important;
      }
  ` : '';

  styleEl.textContent = `
    @media print {
      @page {
        size: ${sizeCss};
        margin: ${marginCss};
      }
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        background: white !important;
      }
      ${bwCss}
    }
  `;
}

/**
 * Saves and fixes ("يثبّت") the selected paper format in localStorage & dispatches a global event
 */
export function savePrintPaperFormat(format: PrintPaperFormat, customSize?: CustomPaperSize): {
  format: PrintPaperFormat;
  customSize: CustomPaperSize;
  def: PaperFormatDef;
} {
  const norm = normalizePaperFormat(format);
  const sizeToSave = customSize || DEFAULT_CUSTOM_SIZE;

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_FORMAT_KEY, norm);
      if (customSize || norm === 'CUSTOM') {
        localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(sizeToSave));
      }
      applyPrintPageStyle(norm, sizeToSave);

      window.dispatchEvent(
        new CustomEvent('alpha-paper-format-fixed', {
          detail: { format: norm, customSize: sizeToSave },
        })
      );
    } catch (err) {
      console.error('Failed to save paper format to localStorage:', err);
    }
  }

  const def = getPaperFormatDef(norm, sizeToSave);
  return { format: norm, customSize: sizeToSave, def };
}

// Automatically apply saved print style on module load in browser
if (typeof window !== 'undefined') {
  try {
    const { format, customSize } = getSavedPrintPaperFormat();
    applyPrintPageStyle(format, customSize);
  } catch {
    // ignore
  }
}
