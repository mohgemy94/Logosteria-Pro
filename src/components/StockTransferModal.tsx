import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  ArrowRightLeft, 
  Printer, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Warehouse, 
  FileText, 
  Calendar, 
  User, 
  Truck, 
  Package, 
  Eye,
  Search,
  ArrowRight
} from 'lucide-react';
import { 
  loadStoredItems, 
  getDynamicWarehousesList, 
  type Item 
} from '../utils/itemsStore';
import { 
  loadStockTransfers, 
  executeStockTransfer, 
  getNextStockTransferNumber, 
  type StockTransfer 
} from '../utils/stockTransferStore';
import { getSystemSettings } from '../utils/settings';

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSourceWarehouse?: string;
  onSuccess?: () => void;
}

interface TransferLineItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number | string;
  availableStock: number;
  notes: string;
}

export default function StockTransferModal({
  isOpen,
  onClose,
  defaultSourceWarehouse = 'المستودع الرئيسي',
  onSuccess
}: StockTransferModalProps) {
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [sourceWarehouse, setSourceWarehouse] = useState<string>(defaultSourceWarehouse);
  const [destinationWarehouse, setDestinationWarehouse] = useState<string>('');
  const [senderName, setSenderName] = useState<string>('');
  const [receiverName, setReceiverName] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [items, setItems] = useState<TransferLineItem[]>([
    { id: '1', itemId: '', itemCode: '', itemName: '', unit: 'حبة / قطعة', quantity: 1, availableStock: 0, notes: '' }
  ]);

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [printingTransfer, setPrintingTransfer] = useState<StockTransfer | null>(null);
  const [historyList, setHistoryList] = useState<StockTransfer[]>([]);
  const [searchHistoryQuery, setSearchHistoryQuery] = useState<string>('');

  // Load warehouses and items catalog
  const [catalogItems, setCatalogItems] = useState<Item[]>([]);
  const companyInfo = useMemo(() => getSystemSettings().company, []);

  const warehouses = useMemo(() => {
    return getDynamicWarehousesList();
  }, []);

  const refreshData = () => {
    setCatalogItems(loadStoredItems());
    setHistoryList(loadStockTransfers());
  };

  useEffect(() => {
    if (isOpen) {
      refreshData();
      if (!destinationWarehouse) {
        const other = warehouses.find(w => w.label !== sourceWarehouse);
        if (other) setDestinationWarehouse(other.label);
      }
    }
  }, [isOpen, sourceWarehouse, warehouses]);

  // Filter items available in source warehouse
  const availableSourceItems = useMemo(() => {
    return catalogItems.filter(it => 
      (it.warehouseName === sourceWarehouse || (!it.warehouseName && sourceWarehouse === 'المستودع الرئيسي')) &&
      it.stock > 0
    );
  }, [catalogItems, sourceWarehouse]);

  const handleAddItemRow = () => {
    setItems(prev => [
      ...prev,
      { 
        id: Date.now().toString(), 
        itemId: '', 
        itemCode: '', 
        itemName: '', 
        unit: 'حبة / قطعة', 
        quantity: 1, 
        availableStock: 0, 
        notes: '' 
      }
    ]);
  };

  const handleRemoveItemRow = (id: string) => {
    setItems(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
  };

  const handleItemSelect = (rowId: string, itemId: string) => {
    const selected = catalogItems.find(i => i.id === itemId);
    if (!selected) return;

    setItems(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      return {
        ...row,
        itemId: selected.id,
        itemCode: selected.code,
        itemName: selected.name,
        unit: selected.unit || 'حبة / قطعة',
        availableStock: selected.stock,
        quantity: row.quantity && Number(row.quantity) > 0 ? Math.min(Number(row.quantity), selected.stock) : 1
      };
    }));
  };

  const handleQuantityChange = (rowId: string, val: string) => {
    setItems(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      return { ...row, quantity: val };
    }));
  };

  const handleNotesChange = (rowId: string, val: string) => {
    setItems(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      return { ...row, notes: val };
    }));
  };

  const handleSubmitTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!sourceWarehouse || !destinationWarehouse) {
      setErrorMsg('يرجى تحديد مستودع الصرف ومستودع الاستلام');
      return;
    }
    if (sourceWarehouse.trim() === destinationWarehouse.trim()) {
      setErrorMsg('لا يمكن التحويل إلى نفس المستودع، يرجى اختيار مستودعين مختلفين');
      return;
    }

    const validItems = items.filter(it => it.itemId && Number(it.quantity) > 0);
    if (validItems.length === 0) {
      setErrorMsg('يرجى اختيار صنف واحد على الأقل وتحديد كمية أكبر من صفر');
      return;
    }

    // Check stock availability
    for (const line of validItems) {
      if (Number(line.quantity) > line.availableStock) {
        setErrorMsg(`الكمية المطلوبة للصنف (${line.itemName}) تتجاوز الرصيد المتاح (${line.availableStock})`);
        return;
      }
    }

    const result = executeStockTransfer({
      date,
      sourceWarehouse,
      destinationWarehouse,
      senderName: senderName.trim() || undefined,
      receiverName: receiverName.trim() || undefined,
      driverName: driverName.trim() || undefined,
      vehicleNumber: vehicleNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      items: validItems.map(vi => ({
        itemId: vi.itemId,
        itemCode: vi.itemCode,
        itemName: vi.itemName,
        unit: vi.unit,
        quantity: Number(vi.quantity),
        notes: vi.notes.trim() || undefined
      }))
    });

    if (!result.success || !result.transfer) {
      setErrorMsg(result.error || 'حدث خطأ أثناء تنفيذ التحويل المخزني');
      return;
    }

    // Successful transfer
    setPrintingTransfer(result.transfer);
    refreshData();
    if (onSuccess) onSuccess();

    // Reset form
    setItems([{ id: '1', itemId: '', itemCode: '', itemName: '', unit: 'حبة / قطعة', quantity: 1, availableStock: 0, notes: '' }]);
    setNotes('');
  };

  const filteredHistory = useMemo(() => {
    if (!searchHistoryQuery.trim()) return historyList;
    const q = searchHistoryQuery.trim().toLowerCase();
    return historyList.filter(t => 
      t.transferNumber.toLowerCase().includes(q) ||
      t.sourceWarehouse.toLowerCase().includes(q) ||
      t.destinationWarehouse.toLowerCase().includes(q) ||
      (t.notes && t.notes.toLowerCase().includes(q)) ||
      t.items.some(i => i.itemName.toLowerCase().includes(q) || i.itemCode.toLowerCase().includes(q))
    );
  }, [historyList, searchHistoryQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-linear-to-r from-blue-700 via-indigo-700 to-blue-800 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-xs">
              <ArrowRightLeft className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">إذن صرف وتحويل مخزني مباشر</h2>
              <p className="text-xs text-blue-100">تحويل كميات الأصناف بين المستودعات والفروع مع إمكانية طباعة الإذن الرسمي</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Tab switch */}
            <div className="bg-black/20 p-1 rounded-xl flex items-center gap-1 border border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab('NEW')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'NEW' ? 'bg-white text-blue-700 shadow-xs' : 'text-blue-100 hover:text-white'
                }`}
              >
                تحويل جديد
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('HISTORY')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'HISTORY' ? 'bg-white text-blue-700 shadow-xs' : 'text-blue-100 hover:text-white'
                }`}
              >
                سجل التحويلات ({historyList.length})
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'NEW' ? (
            <form onSubmit={handleSubmitTransfer} className="space-y-5">
              {/* Warehouse Selection & Header Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {/* Source Warehouse */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <Warehouse size={13} className="text-blue-600" />
                    <span>مستودع الصرف (المصدر) *</span>
                  </label>
                  <select
                    value={sourceWarehouse}
                    onChange={e => setSourceWarehouse(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-bold bg-white text-slate-800 focus:outline-none focus:border-blue-600"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.label}>{w.label}</option>
                    ))}
                  </select>
                </div>

                {/* Destination Warehouse */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <Warehouse size={13} className="text-emerald-600" />
                    <span>مستودع الاستلام (الوجهة) *</span>
                  </label>
                  <select
                    value={destinationWarehouse}
                    onChange={e => setDestinationWarehouse(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-bold bg-white text-slate-800 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="">-- اختر المستودع الوجهة --</option>
                    {warehouses.filter(w => w.label !== sourceWarehouse).map(w => (
                      <option key={w.id} value={w.label}>{w.label}</option>
                    ))}
                  </select>
                </div>

                {/* Transfer Date */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <Calendar size={13} className="text-indigo-600" />
                    <span>تاريخ التحويل *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-bold bg-white text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>

                {/* Auto Sequence Number */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <FileText size={13} className="text-slate-500" />
                    <span>رقم الإذن التسلسلي</span>
                  </label>
                  <input
                    type="text"
                    disabled
                    value={getNextStockTransferNumber()}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs font-mono font-bold bg-slate-100 text-slate-600"
                  />
                </div>
              </div>

              {/* Responsible Persons & Logistics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <User size={13} className="text-slate-500" />
                    <span>مسؤول الصرف (المُسلِّم)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="اسم أمين مستودع الصرف"
                    value={senderName}
                    onChange={e => setSenderName(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <User size={13} className="text-slate-500" />
                    <span>مسؤول الاستلام (المُستلِم)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="اسم أمين مستودع الاستلام"
                    value={receiverName}
                    onChange={e => setReceiverName(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <Truck size={13} className="text-slate-500" />
                    <span>اسم السائق / الناقل</span>
                  </label>
                  <input
                    type="text"
                    placeholder="اسم السائق"
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <Truck size={13} className="text-slate-500" />
                    <span>رقم لوحة المركبة</span>
                  </label>
                  <input
                    type="text"
                    placeholder="رقم اللوحة"
                    value={vehicleNumber}
                    onChange={e => setVehicleNumber(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Transfer Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Package size={14} className="text-blue-600" />
                    <span>جدول الأصناف المحولة</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>إضافة صنف</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3 min-w-[200px]">الصنف المطلوب تحويله *</th>
                        <th className="py-2.5 px-3">الوحدة</th>
                        <th className="py-2.5 px-3 text-center">الرصيد المتاح</th>
                        <th className="py-2.5 px-3 text-center w-28">الكمية المحولة *</th>
                        <th className="py-2.5 px-3 min-w-[150px]">ملاحظات</th>
                        <th className="py-2.5 px-2 text-center w-12">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <select
                              value={row.itemId}
                              onChange={e => handleItemSelect(row.id, e.target.value)}
                              className="w-full h-8 px-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 bg-white"
                            >
                              <option value="">-- اختر الصنف من المستودع --</option>
                              {availableSourceItems.map(it => (
                                <option key={it.id} value={it.id}>
                                  {it.code} - {it.name} (متاح: {it.stock})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-semibold">{row.unit}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-700">
                            {row.availableStock}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min="1"
                              max={row.availableStock || 99999}
                              value={row.quantity}
                              onChange={e => handleQuantityChange(row.id, e.target.value)}
                              className="w-full h-8 px-2 text-center font-mono font-bold text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-blue-600 bg-white"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              placeholder="ملاحظات الصنف..."
                              value={row.notes}
                              onChange={e => handleNotesChange(row.id, e.target.value)}
                              className="w-full h-8 px-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 bg-white"
                            />
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(row.id)}
                              className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* General Notes */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">ملاحظات عامة حول إذن التحويل</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="سبب التحويل، أو أي تعليمات خاصة بالتسليم والاستلام..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-blue-600 bg-white"
                />
              </div>

              {/* Modal Footer / Submit */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <div className="text-xs text-slate-500 font-semibold">
                  <span>إجمالي الأصناف: </span>
                  <span className="font-bold text-slate-800">{items.filter(i => i.itemId).length}</span>
                  <span className="mx-2">|</span>
                  <span>إجمالي الكميات: </span>
                  <span className="font-bold text-blue-700">
                    {items.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <CheckCircle2 size={16} />
                    <span>تأكيد التحويل وطباعة الإذن</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* History Tab */
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchHistoryQuery}
                    onChange={e => setSearchHistoryQuery(e.target.value)}
                    placeholder="بحث في سجل التحويلات برقم الإذن، المستودع، أو الصنف..."
                    className="w-full h-9 pr-9 pl-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {filteredHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <ArrowRightLeft size={36} className="mx-auto mb-2 opacity-40" />
                  <p>لا توجد تحويلات مخزنية مسجلة حتى الآن</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">رقم الإذن</th>
                        <th className="py-2.5 px-3">التاريخ</th>
                        <th className="py-2.5 px-3">من مستودع</th>
                        <th className="py-2.5 px-3">إلى مستودع</th>
                        <th className="py-2.5 px-3 text-center">عدد الأصناف</th>
                        <th className="py-2.5 px-3 text-center">إجمالي الكمية</th>
                        <th className="py-2.5 px-3 text-center">طباعة / معاينة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredHistory.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{item.transferNumber}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{item.date}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{item.sourceWarehouse}</td>
                          <td className="py-2.5 px-3 font-semibold text-emerald-700">{item.destinationWarehouse}</td>
                          <td className="py-2.5 px-3 text-center font-bold">{item.items.length}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-700">{item.totalQuantity}</td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setPrintingTransfer(item)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-blue-700 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Printer size={13} />
                              <span>طباعة الإذن</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Printable Transfer Voucher Modal */}
      {printingTransfer && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[95vh]">
            
            {/* Top Toolbar (Non-printable) */}
            <div className="p-3 bg-slate-800 text-white flex items-center justify-between shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <Printer size={16} className="text-amber-400" />
                <span className="text-xs font-bold">معاينة إذن الصرف والتحويل المخزني ({printingTransfer.transferNumber})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer size={14} />
                  <span>طباعة الآن</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintingTransfer(null)}
                  className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Voucher Document Print Body */}
            <div className="p-8 overflow-y-auto print:p-0 print:m-0 text-slate-900 bg-white" dir="rtl" id="printable-stock-transfer-voucher">
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-4 mb-5 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black text-slate-900">{companyInfo.nameAr || 'الشركة'}</h1>
                  <p className="text-xs text-slate-600 font-semibold">{companyInfo.branchName || 'الفرع الرئيسي'}</p>
                  {companyInfo.vatNumber && (
                    <p className="text-xs text-slate-600 font-mono">الرقم الضريبي: {companyInfo.vatNumber}</p>
                  )}
                </div>

                <div className="text-center border-2 border-slate-900 rounded-xl px-4 py-2 bg-slate-50">
                  <h2 className="text-base font-black text-slate-900">إذن صرف وتحويل مخزني</h2>
                  <p className="text-xs font-mono font-bold text-blue-800 mt-0.5">{printingTransfer.transferNumber}</p>
                </div>

                <div className="text-left font-mono text-xs text-slate-600">
                  <p>التاريخ: <span className="font-bold text-slate-900">{printingTransfer.date}</span></p>
                  <p>الوقت: <span className="font-bold text-slate-900">{new Date(printingTransfer.createdAt).toLocaleTimeString('ar-SA')}</span></p>
                </div>
              </div>

              {/* Warehouse Route Card */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 text-xs">
                <div className="border-l border-slate-200 pl-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">مستودع الصرف (المصدر)</span>
                  <span className="text-sm font-black text-blue-800 block">{printingTransfer.sourceWarehouse}</span>
                  {printingTransfer.senderName && (
                    <span className="text-slate-600 block mt-1">المُسلِّم: {printingTransfer.senderName}</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">مستودع الاستلام (الوجهة)</span>
                  <span className="text-sm font-black text-emerald-800 block">{printingTransfer.destinationWarehouse}</span>
                  {printingTransfer.receiverName && (
                    <span className="text-slate-600 block mt-1">المُستلِم: {printingTransfer.receiverName}</span>
                  )}
                </div>
              </div>

              {/* Logistics */}
              {(printingTransfer.driverName || printingTransfer.vehicleNumber || printingTransfer.notes) && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-5 text-xs flex flex-wrap gap-4 text-slate-700">
                  {printingTransfer.driverName && <span>الناقل / السائق: <strong>{printingTransfer.driverName}</strong></span>}
                  {printingTransfer.vehicleNumber && <span>رقم اللوحة: <strong>{printingTransfer.vehicleNumber}</strong></span>}
                  {printingTransfer.notes && <span className="w-full">ملاحظات: <em>{printingTransfer.notes}</em></span>}
                </div>
              )}

              {/* Items Table */}
              <div className="border border-slate-300 rounded-xl overflow-hidden mb-6">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-10">م</th>
                      <th className="py-2.5 px-3">كود الصنف</th>
                      <th className="py-2.5 px-4">اسم الصنف والمواصفات</th>
                      <th className="py-2.5 px-3 text-center">الوحدة</th>
                      <th className="py-2.5 px-3 text-center w-28">الكمية المحولة</th>
                      <th className="py-2.5 px-3">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {printingTransfer.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-700">{it.itemCode}</td>
                        <td className="py-2 px-4 font-bold text-slate-900">{it.itemName}</td>
                        <td className="py-2 px-3 text-center text-slate-700">{it.unit}</td>
                        <td className="py-2 px-3 text-center font-mono font-black text-slate-900 text-sm bg-slate-50">
                          {it.quantity}
                        </td>
                        <td className="py-2 px-3 text-slate-500">{it.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 border-t border-slate-300 font-bold text-slate-900">
                    <tr>
                      <td colSpan={4} className="py-2 px-4 text-left">إجمالي الكميات المحولة:</td>
                      <td className="py-2 px-3 text-center font-mono font-black text-blue-900 text-sm">
                        {printingTransfer.totalQuantity}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signatures Block */}
              <div className="grid grid-cols-4 gap-4 pt-6 border-t border-slate-200 text-center text-xs">
                <div>
                  <span className="font-bold block mb-8">أمين مستودع الصرف (المُسلِّم)</span>
                  <div className="border-b border-dashed border-slate-400 mx-4"></div>
                  <span className="text-[10px] text-slate-500 mt-1 block">{printingTransfer.senderName || 'التوقيع'}</span>
                </div>

                <div>
                  <span className="font-bold block mb-8">السائق / الناقل</span>
                  <div className="border-b border-dashed border-slate-400 mx-4"></div>
                  <span className="text-[10px] text-slate-500 mt-1 block">{printingTransfer.driverName || 'التوقيع'}</span>
                </div>

                <div>
                  <span className="font-bold block mb-8">أمين مستودع الاستلام (المُستلِم)</span>
                  <div className="border-b border-dashed border-slate-400 mx-4"></div>
                  <span className="text-[10px] text-slate-500 mt-1 block">{printingTransfer.receiverName || 'التوقيع'}</span>
                </div>

                <div>
                  <span className="font-bold block mb-8">المدير المالي / الاعتماد</span>
                  <div className="border-b border-dashed border-slate-400 mx-4"></div>
                  <span className="text-[10px] text-slate-500 mt-1 block">التوقيع والختم</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
