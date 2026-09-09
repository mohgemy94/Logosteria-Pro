import { useState, useRef, useEffect, useMemo, type KeyboardEvent, type ChangeEvent } from 'react';
import { Package, Tag, Check, Layers } from 'lucide-react';
import { Item } from './Items';
import { searchItems, loadStoredItems } from '../utils/itemsStore';

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
}

export default function ItemAutocomplete({
  value,
  onChange,
  onSelectItem,
  placeholder = 'ابحث عن الصنف بالاسم أو الكود...',
  disabled = false,
  mode = 'SALES',
  className = '',
  itemsList
}: ItemAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [cachedItems, setCachedItems] = useState<Item[]>(() => (itemsList && itemsList.length > 0 ? itemsList : loadStoredItems()));
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync when parent provides updated items list
  useEffect(() => {
    if (itemsList && itemsList.length > 0) {
      setCachedItems(itemsList);
    }
  }, [itemsList]);

  // Reload latest items on focus only if not provided by parent
  const handleFocus = () => {
    if (disabled) return;
    if (!itemsList || itemsList.length === 0) {
      setCachedItems(loadStoredItems());
    }
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  // Filter items matching typed query
  const filteredItems = useMemo(() => {
    return searchItems(value, cachedItems);
  }, [value, cachedItems]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full bg-transparent p-1 border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-none text-slate-900 font-medium placeholder:text-slate-300 disabled:opacity-80 text-xs transition-colors ${className}`}
        />
        {value && !disabled && (
          <span 
            className="text-[10px] text-slate-400 hover:text-blue-600 px-1 cursor-pointer font-mono shrink-0 select-none"
            title="بحث متطور في دليل الأصناف"
            onClick={() => {
              setCachedItems(loadStoredItems());
              setIsOpen(prev => !prev);
              inputRef.current?.focus();
            }}
          >
            🔍
          </span>
        )}
      </div>

      {/* Floating Autocomplete Dropdown */}
      {isOpen && !disabled && (
        <div 
          id="item-autocomplete-dropdown"
          className="absolute z-50 right-0 top-full mt-1.5 w-80 sm:w-96 max-h-72 overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 animate-fadeIn"
          style={{ minWidth: '280px' }}
        >
          {/* Header info */}
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span className="flex items-center gap-1">
              <Package size={13} className="text-blue-600" />
              <span>دليل الأصناف ({filteredItems.length})</span>
            </span>
            <span className="text-[10px] text-slate-400 font-normal">اختر صنفاً أو اكتب بالكامل</span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-slate-500 font-medium">لم يتم العثور على أصناف تطابق "{value}"</p>
              <p className="text-[10px] text-slate-400 mt-1">سيتم حفظ البيان كبند مخصص للفاتورة</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filteredItems.map((item, idx) => {
                const isHighlighted = idx === highlightedIndex;
                const isExactMatch = item.name === value;
                const displayPrice = mode === 'SALES' 
                  ? (item.salePrice || item.retailPrice || item.consumerPrice || 0)
                  : (item.costPrice || 0);

                return (
                  <div
                    key={item.id || item.code || idx}
                    onMouseDown={(e) => {
                      // Prevent input blur before selection completes
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
                    className={`px-3 py-2.5 cursor-pointer transition-colors text-right flex items-center justify-between gap-2 ${
                      isHighlighted ? 'bg-blue-50/90 text-blue-950' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold truncate text-slate-900">{item.name}</span>
                        {isExactMatch && (
                          <Check size={12} className="text-emerald-600 shrink-0" />
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 flex-wrap">
                        <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-semibold">
                          #{item.code}
                        </span>
                        {item.category && (
                          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <Tag size={9} /> {item.category}
                          </span>
                        )}
                        {item.stock !== undefined && (
                          <span className={`px-1.5 py-0.2 rounded flex items-center gap-0.5 font-medium ${
                            item.stock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            <Layers size={9} /> مخزون: {item.stock} {item.unit || ''}
                          </span>
                        )}
                        {item.costPrice !== undefined && (
                          <span className="bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded flex items-center gap-0.5 font-mono font-medium" title="متوسط سعر التكلفة (م.س.ت)">
                            م.س.ت: {item.costPrice.toLocaleString()} ر.س
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-left shrink-0 pl-1">
                      <div className="text-xs font-bold font-mono text-blue-700">
                        {displayPrice.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">ر.س</span>
                      </div>
                      <div className="text-[9px] text-slate-400">
                        {mode === 'SALES' ? 'سعر البيع' : 'سعر الشراء'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
