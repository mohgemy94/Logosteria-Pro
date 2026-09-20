import { useState } from 'react';
import { FileSpreadsheet, FileText, FileDown, Loader2 } from 'lucide-react';
import { 
  exportToXLSX, 
  exportToCSV, 
  exportToPDF, 
  type UniversalExportOptions 
} from '../utils/universalExport';

export interface ExportButtonGroupProps {
  /**
   * Title of data/report for automatic export
   */
  title?: string;
  subtitle?: string;
  filename?: string;
  headers?: string[];
  rows?: (string | number | boolean | null | undefined)[][];
  summaryRows?: (string | number | boolean | null | undefined)[][];
  filterSummary?: string;
  elementToCapture?: HTMLElement | null;
  orientation?: 'portrait' | 'landscape';
  
  /**
   * Custom callbacks if the caller prefers to handle export logic manually
   */
  onExportXLSX?: () => void | Promise<void>;
  onExportCSV?: () => void | Promise<void>;
  onExportPDF?: () => void | Promise<void>;

  /**
   * Visual customizations
   */
  size?: 'sm' | 'md' | 'xs';
  showLabels?: boolean;
  className?: string;
  disabled?: boolean;
}

export default function ExportButtonGroup({
  title = 'تصدير البيانات',
  subtitle,
  filename = 'بيانات_النظام',
  headers = [],
  rows = [],
  summaryRows = [],
  filterSummary,
  elementToCapture,
  orientation = 'landscape',
  onExportXLSX,
  onExportCSV,
  onExportPDF,
  size = 'sm',
  showLabels = true,
  className = '',
  disabled = false,
}: ExportButtonGroupProps) {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const getExportOptions = (): UniversalExportOptions => ({
    filename: `${filename}_${new Date().toISOString().slice(0, 10)}`,
    title,
    subtitle,
    headers,
    rows,
    summaryRows,
    filterSummary,
    elementToCapture,
    orientation,
  });

  const handleXLSX = async () => {
    if (disabled || isExportingXlsx) return;
    try {
      setIsExportingXlsx(true);
      if (onExportXLSX) {
        await onExportXLSX();
      } else {
        exportToXLSX(getExportOptions());
      }
    } catch (err) {
      console.error('Failed to export XLSX:', err);
    } finally {
      setIsExportingXlsx(false);
    }
  };

  const handleCSV = async () => {
    if (disabled || isExportingCsv) return;
    try {
      setIsExportingCsv(true);
      if (onExportCSV) {
        await onExportCSV();
      } else {
        exportToCSV(getExportOptions());
      }
    } catch (err) {
      console.error('Failed to export CSV:', err);
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handlePDF = async () => {
    if (disabled || isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      if (onExportPDF) {
        await onExportPDF();
      } else {
        await exportToPDF(getExportOptions());
      }
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const btnPadding = size === 'xs' 
    ? 'px-2.5 py-1 text-[11px] font-black rounded-lg gap-1' 
    : size === 'md' 
    ? 'px-4 py-2 text-xs sm:text-sm font-black rounded-xl gap-2 shadow-sm' 
    : 'px-3 py-1.5 text-xs font-black rounded-lg gap-1.5 shadow-xs';

  const iconSize = size === 'xs' ? 12 : size === 'md' ? 16 : 14;

  return (
    <div className={`flex items-center gap-1.5 sm:gap-2 flex-wrap ${className}`} dir="rtl">
      {/* 1. Dedicated 3D Excel Export Button */}
      <button
        type="button"
        onClick={handleXLSX}
        disabled={disabled || isExportingXlsx}
        title="تصدير جدول البيانات بتنسيق Microsoft Excel"
        className={`btn-3d btn-3d-emerald cursor-pointer ${btnPadding}`}
      >
        {isExportingXlsx ? (
          <Loader2 size={iconSize} className="animate-spin text-white" />
        ) : (
          <FileSpreadsheet size={iconSize} className="text-emerald-100" />
        )}
        {showLabels && (
          <span className="font-bold tracking-wide">{isExportingXlsx ? 'جاري Excel...' : 'EXCEL'}</span>
        )}
      </button>

      {/* 2. Dedicated 3D CSV Export Button */}
      <button
        type="button"
        onClick={handleCSV}
        disabled={disabled || isExportingCsv}
        title="تصدير جدول البيانات بتنسيق CSV"
        className={`btn-3d btn-3d-blue cursor-pointer ${btnPadding}`}
      >
        {isExportingCsv ? (
          <Loader2 size={iconSize} className="animate-spin text-white" />
        ) : (
          <FileText size={iconSize} className="text-sky-100" />
        )}
        {showLabels && (
          <span className="font-bold tracking-wide">{isExportingCsv ? 'جاري CSV...' : 'CSV'}</span>
        )}
      </button>

      {/* 3. Dedicated 3D PDF Export Button */}
      <button
        type="button"
        onClick={handlePDF}
        disabled={disabled || isExportingPdf}
        title="تصدير وحفظ المستند / التقرير بصيغة PDF معتمدة"
        className={`btn-3d btn-3d-rose cursor-pointer ${btnPadding}`}
      >
        {isExportingPdf ? (
          <Loader2 size={iconSize} className="animate-spin text-white" />
        ) : (
          <FileDown size={iconSize} className="text-rose-100" />
        )}
        {showLabels && (
          <span className="font-bold tracking-wide">{isExportingPdf ? 'جاري PDF...' : 'PDF'}</span>
        )}
      </button>
    </div>
  );
}
