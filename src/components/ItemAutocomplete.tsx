import React, { useState, useRef, useEffect, useMemo, type KeyboardEvent, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { Package, Tag, Check, Layers, Search, ChevronDown, ChevronUp, X, Plus, AlertCircle, Warehouse, Sparkles } from 'lucide-react';
import { Item } from './Items';
import { searchItems, loadStoredItems, saveStoredItems } from '../utils/itemsStore';
import { useSystemCurrency } from '../utils/currency';

interface ItemAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectItem: (item: Item) => void;
  placeholder?: string;
  disabled?: boolean;
  mode?: 'SALES' | 'PURCHASE';
  autoFocus?: boolean;
  className?: string;
  itemsList?: Item[];
  onAddNewItem?: (newItem: Item) => void;
}

export default function ItemAutocomplete({
  value,
  onChange,
  onSelectItem,
  placeholder,
  disabled = false,
  mode = 'SALES',
  className = '',
  itemsList,
  onAddNewItem
}: ItemAutocompleteProps) {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cachedItems, setCachedItems] = useState<Item[]>(() => 
    itemsList && itemsList.length > 0 ? itemsList : loadStoredItems()
  );

  // Position coordinates for Portal Dropdown
  const [coords, setCoords] = useState<{ top: number; right: number; width: number; showAbove: boolean }>({
    top: 0,
    right: 0,
    width: 380,
    showAbove: false,
  });

  // Quick Add Item Modal State
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickCode, setQuickCode] = useState('');
  const [quickCategory, setQuickCategory] = useState('عام');
  const [quickUnit, setQuickUnit] = useState('حبة / قطعة');
  const [quickSalePrice, setQuickSalePrice] = useState<string>('');
  const [quickCostPrice, setQuickCostPrice] = useState<string>('');
  const [quickStock, setQuickStock] = useState<string>('100');

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync when parent provides updated items list or when system items update
  useEffect(() => {
    if (itemsList && itemsList.length > 0) {
      setCachedItems(itemsList);
    }
  }, [itemsList]);

  // Listen to system data change events
  useEffect(() => {
    const handleDataChange = () => {
      setCachedItems(loadStoredItems());
    };
    window.addEventListener('alpha-data-changed', handleDataChange);
    window.addEventListener('alpha-items-updated', handleDataChange);
    return () => {
      window.removeEventListener('alpha-data-changed', handleDataChange);
      window.removeEventListener('alpha-items-updated', handleDataChange);
    };
  }, []);

  // Compute exact coordinates relative to input element so portal floats unclipped outside table
  const updatePosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const estimatedDropdownHeight = 360;
      const showAbove = spaceBelow < estimatedDropdownHeight && rect.top > spaceBelow;

      setCoords({
        top: showAbove ? rect.top - 6 : rect.bottom + 4,
        right: window.innerWidth - rect.right,
        width: Math.max(rect.width, 360),
        showAbove
      });
    }
  };

  // Update dropdown position on open, window scroll, or resize
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen]);

  // Reload latest items on focus
  const handleFocus = () => {
    if (disabled) return;
    setCachedItems(loadStoredItems());
    updatePosition();
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  // Distinct categories list
  const categories = useMemo(() => {
    const catSet = new Set<string>();
    cachedItems.forEach(i => {
      if (i.category && i.category.trim() && i.isActive !== false) {
        catSet.add(i.category.trim());
      }
    });
    return ['ALL', ...Array.from(catSet)];
  }, [cachedItems]);

  // Filter items matching typed query and selected category
  const filteredItems = useMemo(() => {
    let items = cachedItems.filter(i => i.isActive !== false);
    if (selectedCategory !== 'ALL') {
      items = items.filter(i => (i.category || '').trim() === selectedCategory);
    }
    return searchItems(value, items);
  }, [value, cachedItems, selectedCategory]);

  // Ensure highlighted item is scrolled into view inside dropdown
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const dropdownEl = document.getElementById('item-autocomplete-dropdown');
      if (
        containerRef.current && 
        !containerRef.current.contains(target) &&
        dropdownEl &&
        !dropdownEl.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        updatePosition();
        setIsOpen(true);
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1 < filteredItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 >= 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      if (isOpen && filteredItems.length > 0 && highlightedIndex >= 0 && highlightedIndex < filteredItems.length) {
        e.preventDefault();
        const selected = filteredItems[highlightedIndex];
        if (selected) {
          handleSelect(selected);
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (item: Item) => {
    onChange(item.name);
    onSelectItem(item);
    setIsOpen(false);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    updatePosition();
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  // Open Quick Add Modal
  const handleOpenQuickAdd = (initialName: string = '') => {
    const existing = loadStoredItems();
    const nextNum = existing.length + 101;
    const generatedCode = `ITM-${nextNum}`;
    
    setQuickName(initialName || value || '');
    setQuickCode(generatedCode);
    setQuickCategory('عام');
    setQuickUnit('حبة / قطعة');
    setQuickSalePrice('');
    setQuickCostPrice('');
    setQuickStock('100');
    
    setShowQuickAddModal(true);
    setIsOpen(false);
  };

  // Save Quick Add Item
  const handleSaveQuickItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) return;

    const currentItems = loadStoredItems();
    const saleP = Number(quickSalePrice) || 0;
    const costP = Number(quickCostPrice) || 0;
    const stK = Number(quickStock) || 0;

    const newItem: Item = {
      id: 'item-' + Date.now(),
      code: quickCode.trim() || `ITM-${currentItems.length + 101}`,
      name: quickName.trim(),
      barcode: '',
      category: quickCategory.trim() || 'عام',
      unit: quickUnit || 'حبة / قطعة',
      costPrice: costP,
      wholesalePrice: saleP > 0 ? Math.round(saleP * 0.9) : costP,
      retailPrice: saleP,
      consumerPrice: saleP,
      salePrice: saleP,
      stock: stK,
      taxRate: 15,
      isActive: true,
      warehouseName: 'المستودع الرئيسي'
    };

    const updated = [newItem, ...currentItems];
    saveStoredItems(updated);
    setCachedItems(updated);

    // Notify system
    window.dispatchEvent(new Event('alpha-data-changed'));
    window.dispatchEvent(new Event('alpha-items-updated'));

    // Auto-select newly created item
    handleSelect(newItem);
    if (onAddNewItem) {
      onAddNewItem(newItem);
    }

    setShowQuickAddModal(false);
  };

  const defaultPlaceholder = mode === 'SALES'
    ? 'ابحث بالاسم، الكود، أو افتح القائمة...'
    : 'ابحث بالحرف، الكود، أو الصنف...';

  return (
    <div ref={containerRef} className="relative w-full font-sans" dir="rtl">
      {/* Combobox Search Input Field */}
      <div className="relative flex items-center w-full">
        {/* Search Icon */}
        <div className="absolute right-2 text-slate-400 pointer-events-none flex items-center">
          <Search size={14} className={isOpen ? 'text-blue-600' : 'text-slate-400'} />
        </div>

        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || defaultPlaceholder}
          className={`w-full bg-white py-1.5 pr-7 pl-14 border border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-lg text-slate-900 font-bold text-xs outline-none transition-all placeholder:text-slate-400 disabled:bg-slate-100 disabled:opacity-75 ${className}`}
        />

        {/* Clear Button & Dropdown Chevron Controls */}
        <div className="absolute left-1.5 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                updatePosition();
                setIsOpen(true);
                inputRef.current?.focus();
              }}
              className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              title="مسح البحث"
            >
              <X size={13} />
            </button>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                setCachedItems(loadStoredItems());
                updatePosition();
                setIsOpen(prev => !prev);
                inputRef.current?.focus();
              }
            }}
            className="p-1 text-slate-400 hover:text-blue-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer flex items-center justify-center shrink-0"
            title="فتح قائمة الأصناف المنسدلة"
          >
            {isOpen ? <ChevronUp size={14} className="text-blue-600" /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Floating Portal Dropdown rendered outside any table clipping container */}
      {isOpen && !disabled && typeof document !== 'undefined' && createPortal(
        <div 
          id="item-autocomplete-dropdown"
          className="fixed z-[99999] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden animate-fadeIn font-sans"
          dir="rtl"
          style={{
            top: coords.showAbove ? 'auto' : `${coords.top}px`,
            bottom: coords.showAbove ? `${window.innerHeight - coords.top}px` : 'auto',
            right: `${coords.right}px`,
            width: `${coords.width}px`,
            maxWidth: 'calc(100vw - 20px)',
            maxHeight: '380px'
          }}
        >
          {/* Header & Category Pills */}
          <div className="p-2.5 bg-slate-900 text-white shrink-0 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-blue-300">
                <Package size={14} className="text-blue-400" />
                <span>دليل وقائمة الأصناف ({filteredItems.length})</span>
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                mode === 'SALES' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
              }`}>
                {mode === 'SALES' ? 'نمط المبيعات' : 'نمط المشتريات'}
              </span>
            </div>

            {/* Category Filter Tabs */}
            {categories.length > 1 && (
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5 text-[11px]">
                {categories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setHighlightedIndex(0);
                    }}
                    className={`px-2 py-0.5 rounded-lg whitespace-nowrap font-bold transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {cat === 'ALL' ? 'جميع التصنيفات' : cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Scrollable Items List */}
          <div ref={listRef} className="flex-1 overflow-y-auto max-h-64 divide-y divide-slate-100 bg-white">
            {filteredItems.length === 0 ? (
              <div className="p-5 text-center space-y-2">
                <AlertCircle size={24} className="text-amber-500 mx-auto opacity-80" />
                <p className="text-xs text-slate-700 font-bold">لم نجد أصناف تطابق "{value}"</p>
                <p className="text-[11px] text-slate-500">يمكنك إضافة هذا الصنف مباشرة إلى الدليل والمستودع بضغطة زر:</p>
                
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleOpenQuickAdd(value)}
                  className="mt-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                >
                  <Plus size={14} />
                  <span>إضافة "{value || 'صنف جديد'}" للمستودع فوراً</span>
                </button>
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                const isHighlighted = idx === highlightedIndex;
                const isExactMatch = item.name === value || item.code === value;
                const salePrice = item.salePrice || item.retailPrice || item.consumerPrice || 0;
                const costPrice = item.costPrice || 0;
                const displayPrice = mode === 'SALES' ? salePrice : costPrice;
                const stockQty = item.stock ?? 0;

                return (
                  <div
                    key={item.id || item.code || idx}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(item);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(item);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`p-2.5 cursor-pointer transition-colors text-right flex items-center justify-between gap-3 border-r-4 ${
                      isHighlighted
                        ? mode === 'SALES' ? 'bg-blue-50/90 border-blue-600' : 'bg-indigo-50/90 border-indigo-600'
                        : 'hover:bg-slate-50 border-transparent text-slate-800'
                    }`}
                  >
                    {/* Right Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-900 truncate">{item.name}</span>
                        <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[10px] font-bold border border-slate-200">
                          #{item.code}
                        </span>
                        {isExactMatch && (
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 rounded flex items-center gap-0.5">
                            <Check size={10} /> مطابقة
                          </span>
                        )}
                      </div>

                      {/* Sub Badges: Category, Stock, Warehouse, Cost */}
                      <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
                        {item.category && (
                          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-medium border border-blue-100 flex items-center gap-0.5">
                            <Tag size={9} /> {item.category}
                          </span>
                        )}

                        {/* Stock Badge */}
                        <span className={`px-1.5 py-0.2 rounded font-bold border flex items-center gap-0.5 ${
                          stockQty > 5
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : stockQty > 0
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          <Layers size={9} />
                          {stockQty > 5 ? (
                            <span>مخزون: {stockQty} {item.unit || ''}</span>
                          ) : stockQty > 0 ? (
                            <span>مخزون منخفض: {stockQty} {item.unit || ''}</span>
                          ) : (
                            <span>نفذ من المخزون (0)</span>
                          )}
                        </span>

                        {/* Warehouse Label */}
                        {item.warehouseName && (
                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5">
                            <Warehouse size={9} /> {item.warehouseName}
                          </span>
                        )}

                        {/* Cost Price Badge in Sales mode */}
                        {mode === 'SALES' && costPrice > 0 && (
                          <span className="bg-amber-50 text-amber-900 px-1.5 py-0.2 rounded font-mono font-bold border border-amber-200" title="متوسط سعر التكلفة (م.س.ت)">
                            تكلفة: {costPrice.toLocaleString()} {currencySymbol}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Left Price Box */}
                    <div className="text-left shrink-0 pl-1">
                      <div className={`text-xs font-black font-mono px-2 py-1 rounded-lg border ${
                        mode === 'SALES'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                      }`}>
                        {displayPrice > 0 ? (
                          <>
                            {displayPrice.toLocaleString()} <span className="text-[9px] font-sans font-normal">{currencySymbol}</span>
                          </>
                        ) : (
                          <span className="text-slate-400 font-sans text-[10px]">غير محدد</span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-500 font-bold mt-0.5 text-center">
                        {mode === 'SALES' ? 'سعر البيع' : 'سعر الشراء'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Quick Add Action */}
          <div className="p-2 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between text-xs">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleOpenQuickAdd(value)}
              className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>إضافة صنف جديد سريعاً للمستودع</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Quick Add Item Modal Dialog */}
      {showQuickAddModal && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden text-right" dir="rtl">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm">
                <Sparkles size={16} className="text-blue-400" />
                <span>إضافة صنف جديد سريعاً وتحديده بالسطر</span>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveQuickItem} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">اسم الصنف أو الخدمة *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={quickName}
                  onChange={e => setQuickName(e.target.value)}
                  placeholder="مثال: شاشة سامسونج 55 بوصة أو صيانة سريعة..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">كود الصنف (رمز فريد)</label>
                  <input
                    type="text"
                    required
                    value={quickCode}
                    onChange={e => setQuickCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">التصنيف الرئيسي</label>
                  <input
                    type="text"
                    value={quickCategory}
                    onChange={e => setQuickCategory(e.target.value)}
                    placeholder="مثال: منتجات / خدمات / مواد..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">وحدة القياس</label>
                  <select
                    value={quickUnit}
                    onChange={e => setQuickUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-2 font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="حبة / قطعة">حبة / قطعة</option>
                    <option value="كرتون">كرتون</option>
                    <option value="طقم">طقم</option>
                    <option value="متر">متر</option>
                    <option value="كيلو">كيلو</option>
                    <option value="خدمة / عمل">خدمة / عمل</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-emerald-800 mb-1">سعر البيع ({currencySymbol})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={quickSalePrice}
                    onChange={e => setQuickSalePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-emerald-300 rounded-xl px-2.5 py-2 font-mono font-bold text-emerald-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-indigo-800 mb-1">سعر التكلفة ({currencySymbol})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={quickCostPrice}
                    onChange={e => setQuickCostPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-indigo-300 rounded-xl px-2.5 py-2 font-mono font-bold text-indigo-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">الكمية المتاحة بالمخزن الأولية</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={quickStock}
                  onChange={e => setQuickStock(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>حفظ وتحديد الصنف بالسطر 🚀</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
