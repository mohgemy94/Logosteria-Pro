import { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, CheckCircle2, QrCode as QrIcon } from 'lucide-react';
import { 
  generateBarcodeSvg, 
  getCachedQrCodeDataUrl, 
  buildVoucherQrPayload, 
  generateSecurityHash,
  type BarcodeSvgOptions 
} from '../utils/voucherBarcode';
import type { PrintPreviewData } from './PrintPreviewModal';
import { getSystemSettings } from '../utils/settings';

interface BarcodeImageProps extends BarcodeSvgOptions {
  value: string;
  className?: string;
  id?: string;
}

/**
 * High-resolution Code 128 Barcode rendered as inline SVG.
 * Scannable by 1D laser scanners and 2D barcode cameras.
 */
export function BarcodeImage({
  value,
  height = 36,
  barWidth = 1.35,
  includeText = true,
  barColor = '#000000',
  bgColor = '#ffffff',
  fontSize = 9,
  className = '',
  id
}: BarcodeImageProps) {
  const svgHtml = useMemo(() => {
    return generateBarcodeSvg(value, {
      height,
      barWidth,
      includeText,
      barColor,
      bgColor,
      fontSize
    });
  }, [value, height, barWidth, includeText, barColor, bgColor, fontSize]);

  return (
    <div 
      id={id}
      className={`inline-block select-none ${className}`}
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}

interface VoucherQrCodeProps {
  data: PrintPreviewData;
  size?: number;
  className?: string;
  showVerificationHash?: boolean;
  forceShow?: boolean;
}

/**
 * Dynamic QR Code image generated using the `qrcode` package with anti-tamper security hash.
 */
export function VoucherQrCodeImage({
  data,
  size = 64,
  className = '',
  showVerificationHash = false,
  forceShow = false
}: VoucherQrCodeProps) {
  const settings = getSystemSettings();
  if (!forceShow && settings?.taxAndInvoice?.enableQrCode === false) {
    return null;
  }

  const [dataUrl, setDataUrl] = useState<string>('');

  const payload = useMemo(() => {
    return buildVoucherQrPayload(data);
  }, [data]);

  const securityHash = useMemo(() => {
    const seed = `${data.docNumber}|${data.title}|${data.grandTotal ?? data.amount ?? 0}|${data.date}|${data.partnerName}`;
    return generateSecurityHash(seed);
  }, [data.docNumber, data.title, data.grandTotal, data.amount, data.date, data.partnerName]);

  useEffect(() => {
    let isMounted = true;
    getCachedQrCodeDataUrl(payload).then(url => {
      if (isMounted) {
        setDataUrl(url);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [payload]);

  return (
    <div className={`flex flex-col items-center justify-center shrink-0 ${className}`}>
      <div 
        style={{ width: `${size}px`, height: `${size}px` }} 
        className="bg-white p-1 rounded border border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs"
      >
        {dataUrl ? (
          <img 
            src={dataUrl} 
            alt={`QR Code #${data.docNumber}`} 
            width={size - 8} 
            height={size - 8} 
            className="w-full h-full object-contain"
          />
        ) : (
          <QrIcon size={size - 14} className="text-slate-700 animate-pulse" />
        )}
      </div>
      {showVerificationHash && (
        <span className="text-[7.5px] font-mono font-bold text-slate-600 mt-0.5 tracking-tight text-center">
          {securityHash}
        </span>
      )}
    </div>
  );
}

interface VoucherSecuritySealProps {
  data: PrintPreviewData;
  isBw?: boolean;
  isEn?: boolean;
  className?: string;
}

/**
 * Complete Security & Anti-Tamper Seal with Barcode and QR Code combined
 * for placement in official voucher templates.
 */
export function VoucherSecuritySeal({
  data,
  isBw = false,
  isEn = false,
  className = ''
}: VoucherSecuritySealProps) {
  const securityHash = useMemo(() => {
    const seed = `${data.docNumber}|${data.title}|${data.grandTotal ?? data.amount ?? 0}|${data.date}|${data.partnerName}`;
    return generateSecurityHash(seed);
  }, [data.docNumber, data.title, data.grandTotal, data.amount, data.date, data.partnerName]);

  return (
    <div className={`rounded-xl p-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${
      isBw 
        ? 'border-2 border-black bg-white' 
        : 'border border-slate-300 bg-slate-50/80 shadow-2xs'
    } ${className}`}>
      {/* Right: Security info & Digital Signature Hash */}
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isBw ? 'border border-black text-black' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
        }`}>
          <ShieldCheck size={18} />
        </div>
        <div>
          <div className="flex items-center gap-1.5 font-bold text-[11px]">
            <CheckCircle2 size={12} className={isBw ? 'text-black' : 'text-emerald-600'} />
            <span className={isBw ? 'text-black font-black' : 'text-slate-800'}>
              {isEn ? 'Official Anti-Tamper Digital Seal' : 'ختم التحقق والاعتماد الرقمي لمنع التلاعب'}
            </span>
          </div>
          <p className="text-[9.5px] text-slate-500 leading-tight mt-0.5">
            {isEn 
              ? 'Scannable via barcode reader & smartphone camera for real-time audit.' 
              : 'مزود برمز باركود وقراءة ضوئية سريعة للمطابقة الفورية مع السجلات المحاسبية.'}
          </p>
          <div className="flex items-center gap-2 mt-1 text-[9px] font-mono">
            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-bold text-slate-700">
              HASH: {securityHash}
            </span>
            <span className="text-slate-400">
              {data.date || new Date().toISOString().split('T')[0]}
            </span>
          </div>
        </div>
      </div>

      {/* Middle/Left: Barcode & QR Code */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="p-1 bg-white rounded border border-slate-200">
          <BarcodeImage 
            value={data.docNumber || '0000'} 
            height={34} 
            barWidth={1.25} 
            fontSize={8} 
          />
        </div>
        <VoucherQrCodeImage data={data} size={48} showVerificationHash={false} />
      </div>
    </div>
  );
}
