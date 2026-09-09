import { useState, useMemo, type FormEvent } from 'react';
import { Plus, Search, Save, PackagePlus, BarChart3, TrendingUp, X, AlertTriangle, Edit3, Trash2 } from 'lucide-react';
import PrintDropdown from './PrintDropdown';
import ItemAnalyticsModal, { type AnalyticItem } from './ItemAnalyticsModal';
import { 
  getNextSequentialNumber, 
  isCodeOrNumberDuplicated, 
  advanceSequenceAfterSave, 
  DB_ITEMS_KEY 
} from '../utils/sequences';
import { notifyDataChanged } from '../utils/localFolderBackup';
import { loadStoredItems } from '../utils/itemsStore';

export type Item = AnalyticItem;

export default function Items() {
  const [items, setItems] = useState<Item[]>(() => loadStoredItems());
  const [isAdding, setIsAdding] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [analyticsItemId, setAnalyticsItemId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [customUnitName, setCustomUnitName] = useState('');
  
  const [newItem, setNewItem] = useState<Partial<Item>>(() => ({
    code: getNextSequentialNumber('itemCode', items.map(i => i.code)).formatted, 
    name: '', 
    barcode: '', 
    category: 'عام', 
    unit: 'حبة / قطعة', 
    costPrice: 0, 
    wholesalePrice: 0, 
    retailPrice: 0, 
    consumerPrice: 0, 
    salePrice: 0, 
    stock: 0, 
    minReorderLevel: 10,
    taxRate: 15, 
    isActive: true
  }));

  // Calculate next sequential code dynamically from items list
  const nextCalculatedCode = useMemo(() => {
    return getNextSequentialNumber('itemCode', items.map(i => i.code)).formatted;
  }, [items]);

  // Check if currently entered code is already taken
  const isCodeDuplicate = useMemo(() => {
    if (!newItem.code) return false;
    return isCodeOrNumberDuplicated(newItem.code, 'itemCode', items.map(i => i.code));
  }, [newItem.code, items]);

  const handleStartAdding = () => {
    const nextCode = getNextSequentialNumber('itemCode', items.map(i => i.code)).formatted;
    setNewItem({
      code: nextCode,
      name: '',
      barcode: '',
      category: 'عام',
      unit: 'حبة / قطعة',
      costPrice: 0,
      wholesalePrice: 0,
      retailPrice: 0,
      consumerPrice: 0,
      salePrice: 0,
      stock: 0,
      taxRate: 15,
      isActive: true
    });
    setIsCustomUnit(false);
    setCustomUnitName('');
    setIsAdding(true);
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!newItem.name) return;
    
    const finalUnit = isCustomUnit 
      ? (customUnitName.trim() || 'وحدة') 
      : (newItem.unit || 'حبة / قطعة');

    const wholesale = Number(newItem.wholesalePrice) || 0;
    const retail = Number(newItem.retailPrice) || 0;
    const consumer = Number(newItem.consumerPrice) || 0;
    const baseSale = consumer || retail || wholesale || Number(newItem.salePrice) || 0;
    const finalCode = newItem.code?.trim() || nextCalculatedCode;

    // Strict non-duplication check against all existing items
    const isDuplicate = items.some(it => String(it.code).trim().toLowerCase() === finalCode.toLowerCase());
    if (isDuplicate) {
      alert(`⚠️ كود الصنف (${finalCode}) مستخدم مسبقاً في قاعدة البيانات! يُرجى استخدام كود فريد أو النقر على الزر لتطبيق الرقم التسلسلي التالي (#${nextCalculatedCode}).`);
      setNewItem(prev => ({ ...prev, code: nextCalculatedCode }));
      return;
    }

    const itemToAdd: Item = {
      id: Date.now().toString(),
      code: finalCode,
      name: newItem.name,
      barcode: newItem.barcode || '',
      category: newItem.category || 'عام',
      unit: finalUnit,
      costPrice: Number(newItem.costPrice) || 0,
      wholesalePrice: wholesale,
      retailPrice: retail,
      consumerPrice: consumer,
      salePrice: baseSale,
      stock: Number(newItem.stock) || 0,
      minReorderLevel: Number(newItem.minReorderLevel) || 10,
      taxRate: newItem.taxRate !== undefined ? newItem.taxRate : 15,
      isActive: true,
    };
    
    const updatedItems = [itemToAdd, ...items];
    setItems(updatedItems);
    try {
      localStorage.setItem(DB_ITEMS_KEY, JSON.stringify(updatedItems));
      notifyDataChanged();
    } catch (err) {
      console.error(err);
    }

    // Advance sequence past the used code
    advanceSequenceAfterSave('itemCode', finalCode);
    const subsequentCode = getNextSequentialNumber('itemCode', updatedItems.map(i => i.code)).formatted;

    setIsAdding(false);
    setIsCustomUnit(false);
    setCustomUnitName('');
    setNewItem({ 
      code: subsequentCode, 
      name: '', 
      barcode: '', 
      category: 'عام', 
      unit: 'حبة / قطعة', 
      costPrice: 0, 
      wholesalePrice: 0, 
      retailPrice: 0, 
      consumerPrice: 0, 
      salePrice: 0, 
      stock: 0, 
      minReorderLevel: 10,
      taxRate: 15, 
      isActive: true 
    });
  };

  const handleOpenEdit = (item: Item) => {
    setEditingItem(JSON.parse(JSON.stringify(item)));
    setIsEditModalOpen(true);
  };

  const handleUpdateItem = (e: FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.name.trim()) return;

    const wholesale = Number(editingItem.wholesalePrice) || 0;
    const retail = Number(editingItem.retailPrice) || 0;
    const consumer = Number(editingItem.consumerPrice) || 0;
    const baseSale = consumer || retail || wholesale || Number(editingItem.salePrice) || 0;

    const updatedItem: Item = {
      ...editingItem,
      name: editingItem.name.trim(),
      costPrice: Number(editingItem.costPrice) || 0,
      wholesalePrice: wholesale,
      retailPrice: retail,
      consumerPrice: consumer,
      salePrice: baseSale,
      stock: Number(editingItem.stock) || 0,
      minReorderLevel: editingItem.minReorderLevel !== undefined ? Number(editingItem.minReorderLevel) : 10,
      taxRate: editingItem.taxRate !== undefined ? Number(editingItem.taxRate) : 15,
    };

    const updatedList = items.map(it => it.id === editingItem.id ? updatedItem : it);
    setItems(updatedList);
    try {
      localStorage.setItem(DB_ITEMS_KEY, JSON.stringify(updatedList));
      notifyDataChanged();
    } catch (err) {
      console.error(err);
    }
    setIsEditModalOpen(false);
    setEditingItem(null);
  };

  const handleDeleteItem = (id: string, name: string) => {
    if (confirm(`هل أنت متأكد من رغبتك في حذف الصنف (${name}) نهائياً من قاعدة البيانات والمخزون؟`)) {
      const updatedList = items.filter(it => it.id !== id);
      setItems(updatedList);
      try {
        localStorage.setItem(DB_ITEMS_KEY, JSON.stringify(updatedList));
        notifyDataChanged();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.barcode.includes(searchQuery)
    );
  }, [items, searchQuery]);

  return (
    <div className="flex flex-col flex-1 h-full">
      <div className="flex justify-between items-end mb-6 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1 text-slate-500">
            <span className="text-xs uppercase font-bold tracking-tight">المخزون والأصناف</span>
            <span className="text-xs">/</span>
            <span className="text-xs uppercase font-bold tracking-tight">إدارة الأصناف</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-800">بطاقات الأصناف</h2>
          <p className="text-slate-500 mt-1 text-sm">إضافة واستعراض الأصناف والخدمات، وتحديد أسعارها.</p>
        </div>
        <div className="flex items-center gap-4">
          <PrintDropdown />
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="بحث بالاسم، الكود، الباركود..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-4 pr-10 py-2 w-64 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500 shadow-sm"
            />
          </div>
          <button 
            type="button"
            onClick={handleStartAdding}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded shadow-sm text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus size={16} /> إضافة صنف
          </button>
        </div>
      </div>

      {/* Two Prominent Action Cards requested by user */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 print:hidden">
        {/* Card 1: بطاقة إضافة صنف */}
        <div 
          role="button"
          tabIndex={0}
          onClick={handleStartAdding}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleStartAdding(); }}
          className="group bg-gradient-to-br from-white to-blue-50/50 hover:to-blue-100/60 p-5 rounded-2xl border-2 border-blue-100 hover:border-blue-400 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <PackagePlus size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                  بطاقة إضافة صنف
                </h3>
                <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold border border-blue-200">
                  صنف جديد
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                إضافة صنف جديد بالترقيم التسلسلي، تحديد وحدات القياس (شيكارة، شوال...) وأسعار البيع الثلاثية والضريبة.
              </p>
            </div>
          </div>
          <div className="shrink-0 mr-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold group-hover:bg-blue-700 shadow-sm transition-colors">
              <Plus size={14} /> إضافة صنف
            </span>
          </div>
        </div>

        {/* Card 2: بطاقة تحليل الأصناف */}
        <div 
          role="button"
          tabIndex={0}
          onClick={() => setIsAnalyticsOpen(true)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setIsAnalyticsOpen(true); }}
          className="group bg-gradient-to-br from-white to-indigo-50/50 hover:to-indigo-100/60 p-5 rounded-2xl border-2 border-indigo-100 hover:border-indigo-400 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <BarChart3 size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                  بطاقة تحليل الأصناف
                </h3>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold border border-indigo-200">
                  تحليل دوري شامل
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                تحليل حركة الصنف والمبيعات والأرباح والكميات عبر: شهر، ربع سنوي، نصف سنوي، ثلاث أرباع السنة، وسنة.
              </p>
            </div>
          </div>
          <div className="shrink-0 mr-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold group-hover:bg-indigo-700 shadow-sm transition-colors">
              <TrendingUp size={14} /> استعراض التحليل
            </span>
          </div>
        </div>
      </div>

      {/* Add Item Modal Popup */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] overflow-y-auto my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                  <PackagePlus size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold">إضافة صنف جديد</h3>
                  <span className="text-xs text-slate-300">تكويد الصنف، تحديد وحدات القياس، وهيكل الأسعار الثلاثية</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="إغلاق"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-[10px] font-bold uppercase text-slate-500">اسم الصنف <span className="text-red-500">*</span></label>
                  <input required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="border border-slate-200 p-2 rounded text-sm focus:outline-none focus:border-blue-500" placeholder="اسم المنتج أو الخدمة" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase text-slate-500">كود الصنف <span className="text-red-500">*</span></label>
                    <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium border border-emerald-200">تسلسلي تلقائي فريد</span>
                  </div>
                  <div className="relative">
                    <input 
                      required 
                      value={newItem.code || ''} 
                      onChange={e => setNewItem({...newItem, code: e.target.value})} 
                      className={`w-full border p-2 rounded text-sm focus:outline-none font-mono font-bold ${
                        isCodeDuplicate 
                          ? 'border-red-400 bg-red-50/50 text-red-900 focus:border-red-500' 
                          : 'border-slate-200 focus:border-blue-500 text-slate-800'
                      }`} 
                      placeholder="1" 
                    />
                    <button
                      type="button"
                      onClick={() => setNewItem({ ...newItem, code: nextCalculatedCode })}
                      title="توليد وتطبيق الكود التسلسلي التالي تلقائياً"
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded font-bold transition-colors cursor-pointer"
                    >
                      #{nextCalculatedCode}
                    </button>
                  </div>
                  {isCodeDuplicate && (
                    <div className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded p-1.5 flex items-center justify-between mt-1 animate-pulse">
                      <span className="flex items-center gap-1 font-bold">
                        <AlertTriangle size={12} />
                        الكود مستخدم مسبقاً!
                      </span>
                      <button
                        type="button"
                        onClick={() => setNewItem({ ...newItem, code: nextCalculatedCode })}
                        className="text-[10px] font-bold text-blue-700 underline hover:text-blue-900 cursor-pointer"
                      >
                        اضغط لتطبيق #{nextCalculatedCode}
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">الباركود</label>
                  <input value={newItem.barcode} onChange={e => setNewItem({...newItem, barcode: e.target.value})} className="border border-slate-200 p-2 rounded text-sm focus:outline-none focus:border-blue-500 font-mono" placeholder="رقم الباركود" />
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">التصنيف</label>
                  <input value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="border border-slate-200 p-2 rounded text-sm focus:outline-none focus:border-blue-500" placeholder="مثال: إلكترونيات" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">وحدة القياس <span className="text-red-500">*</span></label>
                  {!isCustomUnit ? (
                    <select 
                      value={newItem.unit} 
                      onChange={e => {
                        if (e.target.value === '__CUSTOM__') {
                          setIsCustomUnit(true);
                          setCustomUnitName('');
                        } else {
                          setNewItem({...newItem, unit: e.target.value});
                        }
                      }} 
                      className="border border-slate-200 p-2 rounded text-sm focus:outline-none focus:border-blue-500 bg-white"
                    >
                      <optgroup label="وحدات العدد والتجزئة والتعبئة">
                        <option value="حبة / قطعة">حبة / قطعة</option>
                        <option value="كرتون">كرتون</option>
                        <option value="صندوق">صندوق</option>
                        <option value="باكت / علبة">باكت / علبة</option>
                        <option value="طرد / رزمة">طرد / رزمة</option>
                        <option value="درزن (12 حبة)">درزن (12 حبة)</option>
                        <option value="كيس">كيس</option>
                        <option value="شوال">شوال</option>
                        <option value="شيكارة">شيكارة</option>
                        <option value="طقم / مجموعة">طقم / مجموعة</option>
                        <option value="باليت / طبلية">باليت / طبلية</option>
                        <option value="لفة / رول">لفة / رول</option>
                        <option value="برميل">برميل</option>
                        <option value="جالون">جالون</option>
                        <option value="عبوة">عبوة</option>
                        <option value="صفيحة / تنكة">صفيحة / تنكة</option>
                        <option value="لوح / شيت">لوح / شيت</option>
                        <option value="زوج (Pair)">زوج (Pair)</option>
                        <option value="شريط / ستريب">شريط / ستريب</option>
                        <option value="قارورة / زجاجة">قارورة / زجاجة</option>
                        <option value="بكرة / بوبينة">بكرة / بوبينة</option>
                      </optgroup>
                      <optgroup label="وحدات الوزن والكتلة">
                        <option value="كيلو جرام (كجم)">كيلو جرام (كجم)</option>
                        <option value="جرام (جم)">جرام (جم)</option>
                        <option value="مليجرام (مجم)">مليجرام (مجم)</option>
                        <option value="طن متري">طن متري</option>
                        <option value="أوقية / أونصة">أوقية / أونصة</option>
                        <option value="رطل / باوند">رطل / باوند</option>
                        <option value="قنطار">قنطار</option>
                      </optgroup>
                      <optgroup label="وحدات الطول والمقاسات">
                        <option value="متر (م)">متر (م)</option>
                        <option value="سنتيمتر (سم)">سنتيمتر (سم)</option>
                        <option value="مليمتر (مم)">مليمتر (مم)</option>
                        <option value="كيلومتر (كم)">كيلومتر (كم)</option>
                        <option value="بوصة / إنش">بوصة / إنش</option>
                        <option value="قدم">قدم</option>
                        <option value="ياردة">ياردة</option>
                        <option value="متر طولي">متر طولي</option>
                      </optgroup>
                      <optgroup label="وحدات المساحة والحجم والسوائل">
                        <option value="متر مربع (م²)">متر مربع (م²)</option>
                        <option value="سنتيمتر مربع (سم²)">سنتيمتر مربع (سم²)</option>
                        <option value="متر مكعب (م³)">متر مكعب (م³)</option>
                        <option value="لتر (ل)">لتر (ل)</option>
                        <option value="مللي لتر (مل)">مللي لتر (مل)</option>
                        <option value="جالون أمريكي">جالون أمريكي</option>
                      </optgroup>
                      <optgroup label="وحدات الخدمات والوقت والمشاريع">
                        <option value="خدمة">خدمة</option>
                        <option value="ساعة">ساعة</option>
                        <option value="يوم">يوم</option>
                        <option value="أسبوع">أسبوع</option>
                        <option value="شهر">شهر</option>
                        <option value="سنة">سنة</option>
                        <option value="مشروع / مقطوعية">مشروع / مقطوعية</option>
                        <option value="زيارة / كشف">زيارة / كشف</option>
                        <option value="استشارة">استشارة</option>
                        <option value="رخصة / اشتراك">رخصة / اشتراك</option>
                        <option value="تذكرة">تذكرة</option>
                      </optgroup>
                      <optgroup label="تخصيص يدوي">
                        <option value="__CUSTOM__">✍️ وحدة مخصصة أخرى (كتابة يدوية)...</option>
                      </optgroup>
                    </select>
                  ) : (
                    <div className="flex gap-1.5">
                      <input 
                        type="text" 
                        autoFocus
                        required
                        value={customUnitName} 
                        onChange={e => setCustomUnitName(e.target.value)} 
                        placeholder="اكتب اسم الوحدة..." 
                        className="border border-blue-400 p-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full bg-white" 
                      />
                      <button 
                        type="button" 
                        onClick={() => { setIsCustomUnit(false); setNewItem({...newItem, unit: 'حبة / قطعة'}); }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs shrink-0 cursor-pointer"
                        title="الرجوع للقائمة"
                      >
                        إلغاء
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">الرصيد الافتتاحي (المخزون)</label>
                  <input type="number" value={newItem.stock} onChange={e => setNewItem({...newItem, stock: Number(e.target.value)})} className="border border-slate-200 p-2 rounded text-sm focus:outline-none focus:border-blue-500 font-mono" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-amber-700 flex items-center justify-between">
                    <span>حد الطلب (الحد الأدنى)</span>
                    <span className="text-[9px] text-slate-400 font-normal">للتنبيهات الذكية</span>
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    value={newItem.minReorderLevel ?? 10} 
                    onChange={e => setNewItem({...newItem, minReorderLevel: Number(e.target.value)})} 
                    placeholder="10" 
                    className="border border-amber-200 bg-amber-50/20 p-2 rounded text-sm focus:outline-none focus:border-amber-500 font-mono" 
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">الضريبة % (إدخال يدوي)</label>
                  <div className="relative flex items-center">
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      max="100" 
                      value={newItem.taxRate ?? ''} 
                      onChange={e => {
                        const val = e.target.value;
                        setNewItem({ ...newItem, taxRate: val === '' ? 0 : Number(val) });
                      }} 
                      placeholder="15" 
                      className="border border-slate-200 p-2 pl-8 rounded text-sm focus:outline-none focus:border-blue-500 font-mono w-full bg-white" 
                    />
                    <span className="absolute left-2.5 text-xs text-slate-400 font-bold pointer-events-none">%</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-slate-400">خيارات سريعة:</span>
                    {[15, 5, 0].map(rate => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setNewItem({ ...newItem, taxRate: rate })}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                          newItem.taxRate === rate
                            ? 'bg-blue-50 border-blue-300 text-blue-600 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* قسم مستويات الأسعار المتعددة */}
                <div className="md:col-span-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200 mt-2">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-slate-700">هيكل الأسعار ومستويات البيع</span>
                    <span className="text-[11px] text-slate-400">تحديد أسعار البيع حسب الشريحة (جملة - قطاعي - جمهور)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {/* سعر التكلفة */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase text-slate-600">سعر التكلفة (الشراء)</label>
                      <input 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        value={newItem.costPrice || ''} 
                        onChange={e => setNewItem({...newItem, costPrice: Number(e.target.value)})} 
                        placeholder="0.00" 
                        className="border border-slate-200 p-2 rounded text-sm focus:outline-none focus:border-blue-500 font-mono bg-white" 
                      />
                    </div>

                    {/* سعر البيع جملة */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase text-blue-700 flex items-center justify-between">
                        <span>سعر البيع جملة</span>
                        <span className="text-red-500 font-normal">*</span>
                      </label>
                      <input 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        required 
                        value={newItem.wholesalePrice || ''} 
                        onChange={e => setNewItem({...newItem, wholesalePrice: Number(e.target.value)})} 
                        placeholder="0.00" 
                        className="border border-blue-200 p-2 rounded text-sm focus:outline-none focus:border-blue-500 font-mono bg-white font-semibold text-blue-700" 
                      />
                    </div>

                    {/* سعر البيع قطاعي / تجزئة */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase text-emerald-700 flex items-center justify-between">
                        <span>سعر البيع قطاعي / تجزئة</span>
                        <span className="text-red-500 font-normal">*</span>
                      </label>
                      <input 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        required 
                        value={newItem.retailPrice || ''} 
                        onChange={e => setNewItem({...newItem, retailPrice: Number(e.target.value)})} 
                        placeholder="0.00" 
                        className="border border-emerald-200 p-2 rounded text-sm focus:outline-none focus:border-emerald-500 font-mono bg-white font-semibold text-emerald-700" 
                      />
                    </div>

                    {/* سعر البيع للجمهور */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase text-purple-700 flex items-center justify-between">
                        <span>سعر البيع للجمهور</span>
                        <span className="text-red-500 font-normal">*</span>
                      </label>
                      <input 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        required 
                        value={newItem.consumerPrice || ''} 
                        onChange={e => setNewItem({...newItem, consumerPrice: Number(e.target.value)})} 
                        placeholder="0.00" 
                        className="border border-purple-200 p-2 rounded text-sm focus:outline-none focus:border-purple-500 font-mono bg-white font-semibold text-purple-700" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsAdding(false)} 
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-sm font-medium hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                >
                  <Save size={16} /> حفظ الصنف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Header */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900">لوجوستريا للمحاسبة</h1>
        <p className="text-sm text-slate-500">الفرع الرئيسي - الرياض</p>
        <h2 className="text-xl font-bold mt-4 border-b pb-2 inline-block">قائمة الأصناف والخدمات</h2>
        <div className="mt-4 text-sm flex justify-between px-10 text-slate-600">
          <span>تاريخ الطباعة: {new Date().toLocaleDateString('ar-SA')}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 print:border-none print:shadow-none">
        <div className="overflow-x-auto h-full">
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr className="text-[10px] uppercase text-slate-500 font-bold">
                <th className="px-4 py-4">الكود</th>
                <th className="px-4 py-4">اسم الصنف</th>
                <th className="px-3 py-4 text-center">التصنيف</th>
                <th className="px-3 py-4 text-center">الوحدة</th>
                <th className="px-3 py-4 text-center">المخزون</th>
                <th className="px-3 py-4 text-left">التكلفة</th>
                <th className="px-3 py-4 text-left text-blue-700 font-bold">سعر جملة</th>
                <th className="px-3 py-4 text-left text-emerald-700 font-bold">سعر قطاعي</th>
                <th className="px-3 py-4 text-left text-purple-700 font-bold">سعر الجمهور</th>
                <th className="px-3 py-4 text-center">الضريبة</th>
                <th className="px-3 py-4 text-center print:hidden">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredItems.map((c) => (
                <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${!c.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-4 font-mono text-slate-500 text-xs">{c.code}</td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-900">{c.name}</div>
                    {c.barcode && <div className="text-[10px] text-slate-400 font-mono">{c.barcode}</div>}
                  </td>
                  <td className="px-3 py-4 text-center text-slate-600 text-xs">{c.category}</td>
                  <td className="px-3 py-4 text-center text-slate-700 font-medium text-xs">
                    <span className="px-2 py-0.5 bg-slate-100 rounded-full border border-slate-200">{c.unit}</span>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                        c.stock <= 0 
                          ? 'bg-red-50 text-red-600 border border-red-200' 
                          : c.stock <= (c.minReorderLevel ?? 10)
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'text-slate-700'
                      }`}>
                        {c.stock}
                      </span>
                      {c.stock <= (c.minReorderLevel ?? 10) && (
                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50/80 px-1 rounded" title={`الحد الأدنى للطلب: ${c.minReorderLevel ?? 10}`}>
                          {c.stock <= 0 ? 'نفاد' : `حد: ${c.minReorderLevel ?? 10}`}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-left font-mono text-slate-500 text-xs">{c.costPrice.toFixed(2)}</td>
                  <td className="px-3 py-4 text-left font-mono font-bold text-blue-600 text-xs">
                    {c.wholesalePrice ? c.wholesalePrice.toFixed(2) : '-'}
                  </td>
                  <td className="px-3 py-4 text-left font-mono font-bold text-emerald-600 text-xs">
                    {c.retailPrice ? c.retailPrice.toFixed(2) : '-'}
                  </td>
                  <td className="px-3 py-4 text-left font-mono font-bold text-purple-600 text-xs">
                    {c.consumerPrice ? c.consumerPrice.toFixed(2) : (c.salePrice ? c.salePrice.toFixed(2) : '-')}
                  </td>
                  <td className="px-3 py-4 text-center font-mono text-slate-500 text-xs">{c.taxRate}%</td>
                  <td className="px-3 py-4 text-center print:hidden">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setAnalyticsItemId(c.id);
                          setIsAnalyticsOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-200 transition-colors shadow-2xs cursor-pointer"
                        title="تحليل بيانات ومبيعات الصنف"
                      >
                        <BarChart3 size={12} />
                        <span>تحليل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(c)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
                        title="تعديل بيانات الصنف والأسعار"
                      >
                        <Edit3 size={12} />
                        <span>تعديل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(c.id, c.name)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-semibold border border-rose-200 transition-colors cursor-pointer"
                        title="حذف الصنف"
                      >
                        <Trash2 size={12} />
                        <span>حذف</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-slate-400">
                    {searchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'لا يوجد أصناف مضافة بعد'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Item Analytics Modal */}
      <ItemAnalyticsModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        items={items}
        selectedItemId={analyticsItemId || (items.length > 0 && items[0] ? items[0].id : '')}
        onSelectItem={(id) => setAnalyticsItemId(id)}
      />

      {/* Edit Item Modal */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">تعديل بيانات الصنف والأسعار</h3>
                  <p className="text-xs text-slate-400">تحديث كود، اسم، تصنيف، أسعار ومخزون الصنف</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => { setIsEditModalOpen(false); setEditingItem(null); }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateItem} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">كود الصنف:</label>
                  <input
                    type="text"
                    required
                    value={editingItem.code}
                    onChange={(e) => setEditingItem({...editingItem, code: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-600 font-bold mb-1">اسم الصنف / الخدمة:</label>
                  <input
                    type="text"
                    required
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">الباركود الدولي:</label>
                  <input
                    type="text"
                    value={editingItem.barcode || ''}
                    onChange={(e) => setEditingItem({...editingItem, barcode: e.target.value})}
                    placeholder="رقم الباركود"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">التصنيف:</label>
                  <input
                    type="text"
                    value={editingItem.category || ''}
                    onChange={(e) => setEditingItem({...editingItem, category: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">الوحدة:</label>
                  <input
                    type="text"
                    value={editingItem.unit || ''}
                    onChange={(e) => setEditingItem({...editingItem, unit: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Pricing Matrix */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 block">مستويات التسعير والتكلفة</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-500 text-[11px] font-bold mb-1">سعر التكلفة:</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={editingItem.costPrice || 0}
                      onChange={(e) => setEditingItem({...editingItem, costPrice: Number(e.target.value)})}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-700 text-[11px] font-bold mb-1">سعر جملة:</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={editingItem.wholesalePrice || 0}
                      onChange={(e) => setEditingItem({...editingItem, wholesalePrice: Number(e.target.value)})}
                      className="w-full px-2.5 py-1.5 border border-blue-200 rounded-lg bg-white font-mono text-blue-700 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-emerald-700 text-[11px] font-bold mb-1">سعر قطاعي:</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={editingItem.retailPrice || 0}
                      onChange={(e) => setEditingItem({...editingItem, retailPrice: Number(e.target.value)})}
                      className="w-full px-2.5 py-1.5 border border-emerald-200 rounded-lg bg-white font-mono text-emerald-700 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-purple-700 text-[11px] font-bold mb-1">سعر الجمهور:</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={editingItem.consumerPrice || 0}
                      onChange={(e) => setEditingItem({...editingItem, consumerPrice: Number(e.target.value)})}
                      className="w-full px-2.5 py-1.5 border border-purple-200 rounded-lg bg-white font-mono text-purple-700 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Stock, Reorder Level, and Tax */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">الرصيد بالمخزن:</label>
                  <input
                    type="number"
                    value={editingItem.stock || 0}
                    onChange={(e) => setEditingItem({...editingItem, stock: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-amber-700 font-bold mb-1">حد الطلب (التنبيه الذكي):</label>
                  <input
                    type="number"
                    min={0}
                    value={editingItem.minReorderLevel !== undefined ? editingItem.minReorderLevel : 10}
                    onChange={(e) => setEditingItem({...editingItem, minReorderLevel: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-amber-200 bg-amber-50/20 rounded-xl focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">نسبة الضريبة %:</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    value={editingItem.taxRate !== undefined ? editingItem.taxRate : 15}
                    onChange={(e) => setEditingItem({...editingItem, taxRate: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setEditingItem(null); }}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-sm cursor-pointer"
                >
                  <Save size={15} />
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
