import { useState, useMemo } from 'react';
import { 
  Printer, 
  X, 
  Search, 
  Warehouse, 
  Boxes, 
  Tag, 
  FileText, 
  MapPin
} from 'lucide-react';
import { RollForwardInventoryItem } from '../utils/yearEndRollForward';
import { generateBarcodeSvg } from '../utils/voucherBarcode';

interface OpeningStockBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: RollForwardInventoryItem[];
  companyName?: string;
  currencySymbol?: string;
}

export type LabelFormatType = 'SHELF' | 'PRODUCT' | 'A4_SHEET';

export default function OpeningStockBarcodeModal({
  isOpen,
  onClose,
  inventory,
  companyName = 'لوجوستريا للحلول المالية',
  currencySymbol = 'ر.س'
}: OpeningStockBarcodeModalProps) {
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyWithStock, setOnlyWithStock] = useState(true);
  const [formatType, setFormatType] = useState<LabelFormatType>('SHELF');
  const [quantityMode, setQuantityMode] = useState<'ONE_PER_ITEM' | 'BY_STOCK'>('ONE_PER_ITEM');

  // Warehouses list
  const warehouses = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach(item => {
      if (item.warehouseName) set.add(item.warehouseName);
    });
    return Array.from(set);
  }, [inventory]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return inventory.filter(item => {
      if (onlyWithStock && (item.stock || 0) <= 0) return false;
      if (selectedWarehouse !== 'ALL' && item.warehouseName !== selectedWarehouse) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesBarcode = (item.barcode || '').toLowerCase().includes(q);
        const matchesCode = (item.code || '').toLowerCase().includes(q);
        const matchesShelf = (item.shelfLocation || '').toLowerCase().includes(q);
        if (!matchesName && !matchesBarcode && !matchesCode && !matchesShelf) return false;
      }
      return true;
    });
  }, [inventory, selectedWarehouse, searchQuery, onlyWithStock]);

  // Total labels to be printed
  const totalLabelsCount = useMemo(() => {
    if (quantityMode === 'ONE_PER_ITEM') {
      return filteredItems.length;
    }
    return filteredItems.reduce((acc, it) => acc + Math.max(1, Math.round(Number(it.stock) || 1)), 0);
  }, [filteredItems, quantityMode]);

  // Flattened items if printing by stock quantity
  const printItemsList = useMemo(() => {
    if (quantityMode === 'ONE_PER_ITEM') {
      return filteredItems;
    }
    const result: RollForwardInventoryItem[] = [];
    for (const it of filteredItems) {
      const count = Math.min(100, Math.max(1, Math.round(Number(it.stock) || 1)));
      for (let i = 0; i < count; i++) {
        result.push(it);
      }
    }
    return result;
  }, [filteredItems, quantityMode]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 print:p-0 print:bg-white print:static">
      {/* Styles for direct clean printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #opening-stock-print-container, #opening-stock-print-container * {
            visibility: visible;
          }
          #opening-stock-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10mm;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 print:border-none print:shadow-none print:max-h-none print:rounded-none">
        
        {/* Header - Hidden on Print */}
        <div className="no-print p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <Tag size={22} />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
                <span>طباعة ملصقات الباركود ورفوف بضاعة أول المدة</span>
                <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {filteredItems.length} صنف متاح
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تجهيز ملصقات باركود الأرفف والمستودعات لليوم الأول من العام الجديد لترتيب المخزون الفعلي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={filteredItems.length === 0}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-md shadow-indigo-600/20 transition-all text-xs disabled:opacity-60 cursor-pointer"
            >
              <Printer size={16} />
              <span>طباعة فورية ({totalLabelsCount} ملصق)</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filter Controls Toolbar - Hidden on Print */}
        <div className="no-print p-4 bg-white border-b border-slate-100 flex flex-wrap items-center gap-3 text-xs">
          {/* Format selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setFormatType('SHELF')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                formatType === 'SHELF' 
                  ? 'bg-white text-indigo-700 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin size={14} />
              <span>ملصقات أرفف المستودع</span>
            </button>
            <button
              onClick={() => setFormatType('PRODUCT')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                formatType === 'PRODUCT' 
                  ? 'bg-white text-indigo-700 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tag size={14} />
              <span>ملصقات الأصناف والمنتجات</span>
            </button>
            <button
              onClick={() => setFormatType('A4_SHEET')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                formatType === 'A4_SHEET' 
                  ? 'bg-white text-indigo-700 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText size={14} />
              <span>كشف جرد تجميعي (A4)</span>
            </button>
          </div>

          {/* Warehouse filter */}
          <div className="flex items-center gap-2">
            <Warehouse size={16} className="text-slate-400" />
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-1.5 bg-slate-50 font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">جميع المستودعات والفروع ({warehouses.length})</option>
              {warehouses.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالصنف، الباركود، الكود، أو موقع الرف..."
              className="w-full pr-8 pl-3 py-1.5 border border-slate-300 rounded-xl bg-slate-50 text-xs focus:bg-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Quantity Mode */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold">الكمية:</span>
            <select
              value={quantityMode}
              onChange={(e) => setQuantityMode(e.target.value as any)}
              className="border border-slate-300 rounded-xl px-3 py-1.5 bg-slate-50 font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="ONE_PER_ITEM">ملصق واحد لكل صنف (لتسمية الرفوف)</option>
              <option value="BY_STOCK">تكرار الملصقات حسب كمية الرصيد</option>
            </select>
          </div>

          {/* Stock filter checkbox */}
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-bold select-none">
            <input
              type="checkbox"
              checked={onlyWithStock}
              onChange={(e) => setOnlyWithStock(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
            />
            <span>الكمية &gt; 0 فقط</span>
          </label>
        </div>

        {/* Content Body / Printable Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50 print:bg-white print:p-0">
          <div id="opening-stock-print-container">
            
            {/* Header info in print view */}
            <div className="hidden print:block mb-6 border-b-2 border-slate-800 pb-3 text-right">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black text-slate-900">{companyName}</h1>
                  <p className="text-xs text-slate-600">
                    ملصقات باركود بضاعة أول المدة ورفوف المستودعات - العام الجديد
                  </p>
                </div>
                <div className="text-left text-xs font-mono text-slate-600">
                  <div>تاريخ الطباعة: {new Date().toLocaleDateString('ar-SA')}</div>
                  <div>المستودع: {selectedWarehouse === 'ALL' ? 'كافة المستودعات' : selectedWarehouse}</div>
                  <div>إجمالي الأصناف: {filteredItems.length}</div>
                </div>
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                <Boxes size={48} className="mx-auto text-slate-300 mb-3" />
                <h4 className="font-bold text-slate-700 text-base mb-1">لا توجد أصناف مطابقة للبحث</h4>
                <p className="text-xs text-slate-400">
                  يرجى تغيير خيارات الفلترة أو التأكد من احتواء المخزون على أصناف مرحّلة
                </p>
              </div>
            ) : formatType === 'SHELF' ? (
              /* FORMAT 1: SHELF LOCATION LABELS (الأرفف والمستودع) */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 print:grid-cols-3 print:gap-3">
                {printItemsList.map((item, idx) => {
                  const barcodeValue = item.barcode || item.code || `ITM-${item.id}`;
                  const barcodeSvg = generateBarcodeSvg(barcodeValue, {
                    height: 38,
                    barWidth: 1.4,
                    includeText: false
                  });

                  return (
                    <div 
                      key={`${item.id}-${idx}`}
                      className="page-break-inside-avoid bg-white rounded-2xl border-2 border-slate-300 p-4 shadow-sm flex flex-col justify-between relative overflow-hidden print:border-slate-800 print:shadow-none"
                    >
                      {/* Top Warehouse & Shelf Location Banner */}
                      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200">
                        <span className="text-[11px] font-bold text-slate-600 truncate max-w-[140px]">
                          {item.warehouseName || 'المستودع الرئيسي'}
                        </span>
                        <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg text-indigo-900 font-mono font-bold text-xs">
                          <MapPin size={12} className="text-indigo-600" />
                          <span>{item.shelfLocation || 'رف غير محدد'}</span>
                        </div>
                      </div>

                      {/* Item Name & Details */}
                      <div className="mb-2">
                        <h4 className="font-black text-slate-900 text-sm leading-snug line-clamp-2">
                          {item.name}
                        </h4>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 font-mono">
                          <span>كود: {item.code}</span>
                          <span>{item.category || 'عام'}</span>
                        </div>
                      </div>

                      {/* Barcode Vector Graphic */}
                      <div className="my-1.5 flex flex-col items-center justify-center bg-slate-50 py-1.5 px-2 rounded-xl border border-slate-100 print:bg-white print:border-none">
                        <div 
                          className="w-full flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
                          dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                        />
                        <span className="font-mono text-xs font-bold text-slate-800 tracking-wider mt-0.5">
                          {barcodeValue}
                        </span>
                      </div>

                      {/* Footer: Opening Stock Quantity & Unit */}
                      <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between bg-emerald-50/60 -mx-4 -mb-4 px-4 py-2 text-xs font-bold text-emerald-900">
                        <span>رصيد أول المدة:</span>
                        <span className="font-mono text-sm">
                          {item.stock} {item.unit || 'حبة'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : formatType === 'PRODUCT' ? (
              /* FORMAT 2: STANDARD PRODUCT LABELS (38x25mm / 50x30mm) */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:grid-cols-4 print:gap-2">
                {printItemsList.map((item, idx) => {
                  const barcodeValue = item.barcode || item.code || `ITM-${item.id}`;
                  const barcodeSvg = generateBarcodeSvg(barcodeValue, {
                    height: 32,
                    barWidth: 1.25,
                    includeText: false
                  });

                  return (
                    <div 
                      key={`${item.id}-${idx}`}
                      className="page-break-inside-avoid bg-white rounded-xl border border-slate-300 p-3 shadow-sm flex flex-col justify-between text-center print:border-slate-800 print:shadow-none"
                    >
                      <div className="text-[10px] font-bold text-slate-500 truncate mb-0.5">
                        {companyName}
                      </div>

                      <h4 className="font-bold text-slate-900 text-xs line-clamp-1 mb-1">
                        {item.name}
                      </h4>

                      <div className="my-1 flex flex-col items-center justify-center">
                        <div 
                          className="w-full flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
                          dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                        />
                        <span className="font-mono text-[10px] font-bold text-slate-700 tracking-widest">
                          {barcodeValue}
                        </span>
                      </div>

                      <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                        <span className="font-mono text-slate-500">#{item.code}</span>
                        <span className="font-mono text-indigo-700">
                          {item.salePrice || item.costPrice} {currencySymbol}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* FORMAT 3: A4 INVENTORY COUNT SHEET (كشف جرد تجميعي للمطابقة) */
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm print:border-none print:shadow-none">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white font-bold">
                      <th className="py-2.5 px-3 text-center w-12">#</th>
                      <th className="py-2.5 px-3">الباركود الخطي</th>
                      <th className="py-2.5 px-3">كود الصنف</th>
                      <th className="py-2.5 px-3">اسم الصنف والمواصفات</th>
                      <th className="py-2.5 px-3">المستودع</th>
                      <th className="py-2.5 px-3">موقع الرف</th>
                      <th className="py-2.5 px-3 text-center">رصيد أول المدة</th>
                      <th className="py-2.5 px-3 text-center w-28">الجرد الفعلي</th>
                      <th className="py-2.5 px-3 text-center w-20">مطابق</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredItems.map((item, idx) => {
                      const barcodeValue = item.barcode || item.code || `ITM-${item.id}`;
                      const barcodeSvg = generateBarcodeSvg(barcodeValue, {
                        height: 24,
                        barWidth: 1.1,
                        includeText: false
                      });

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 page-break-inside-avoid">
                          <td className="py-2 px-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                          <td className="py-2 px-3 w-40">
                            <div 
                              className="w-36 [&>svg]:max-w-full [&>svg]:h-auto"
                              dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                            />
                            <div className="font-mono text-[10px] text-slate-500 mt-0.5">{barcodeValue}</div>
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-700">{item.code}</td>
                          <td className="py-2 px-3 font-bold text-slate-800">
                            <div>{item.name}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{item.category} | {item.unit}</div>
                          </td>
                          <td className="py-2 px-3 text-slate-600 font-medium">{item.warehouseName || 'المستودع الرئيسي'}</td>
                          <td className="py-2 px-3">
                            <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                              {item.shelfLocation || '-'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-indigo-700 text-sm">
                            {item.stock} {item.unit}
                          </td>
                          <td className="py-2 px-3">
                            <div className="h-7 w-20 mx-auto border-2 border-dashed border-slate-300 rounded bg-slate-50" />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="w-5 h-5 mx-auto border-2 border-slate-300 rounded" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions - Hidden on Print */}
        <div className="no-print p-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 font-medium">
            سيتم طباعة <span className="font-bold text-indigo-700 font-mono">{totalLabelsCount}</span> ملصقاً وفق تخطيط <span className="font-bold text-slate-800">{formatType === 'SHELF' ? 'ملصقات أرفف المستودع' : formatType === 'PRODUCT' ? 'ملصقات المنتجات' : 'كشف الجرد التجميعي'}</span>.
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
            >
              إغلاق
            </button>
            <button
              onClick={handlePrint}
              disabled={filteredItems.length === 0}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-md shadow-indigo-600/20 transition-all disabled:opacity-60 cursor-pointer"
            >
              <Printer size={16} />
              <span>إرسال للطابعة الآن</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
