import React, { useState } from 'react';
import { Save, Truck, MapPin, DollarSign, ShieldAlert, Sparkles } from 'lucide-react';
import { useSystemCurrency } from '../utils/currency';
import { COUNTRIES_LIST } from '../utils/countries';

interface AddVendorFormProps {
  initialCode?: string;
  onSave: (vendor: { 
    code?: string;
    name: string; 
    taxNumber: string; 
    phone: string; 
    country?: string | undefined;
    address?: string | undefined;
    email?: string | undefined;
    creditLimit?: number | undefined;
    paymentTermsDays?: number | undefined;
    openingBalance?: number;
  }) => void;
  onCancel: () => void;
  formId?: string;
  hideActions?: boolean;
}

export default function AddVendorForm({ 
  initialCode, 
  onSave, 
  onCancel,
  formId = 'add-vendor-form',
  hideActions = false
}: AddVendorFormProps) {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [newVendor, setNewVendor] = useState({ 
    code: initialCode || '',
    name: '', 
    taxNumber: '', 
    phone: '', 
    country: 'SA',
    address: '',
    email: '',
    creditLimit: '',
    paymentTermsDays: '0',
    openingBalance: '',
    balanceType: 'CREDIT' as 'CREDIT' | 'DEBIT' // CREDIT (دائن - مستحق للمورد علينا) or DEBIT (مدين - دفعة مقدمة لنا)
  });
  const [errors, setErrors] = useState({ name: '', taxNumber: '', phone: '' });

  const validate = () => {
    let isValid = true;
    const newErrors = { name: '', taxNumber: '', phone: '' };

    if (!newVendor.name.trim()) {
      newErrors.name = 'اسم المورد مطلوب';
      isValid = false;
    } else if (newVendor.name.length < 2) {
      newErrors.name = 'اسم المورد يجب أن يتكون من حرفين على الأقل';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      const rawBal = Number(newVendor.openingBalance) || 0;
      // In our partner ledger system: For VENDOR, positive balance = payable (CREDIT), negative balance = advance payment (DEBIT)
      const finalBal = newVendor.balanceType === 'DEBIT' ? -Math.abs(rawBal) : Math.abs(rawBal);
      const limitVal = newVendor.creditLimit ? Number(newVendor.creditLimit) : undefined;
      const termsVal = newVendor.paymentTermsDays ? Number(newVendor.paymentTermsDays) : undefined;
      
      onSave({
        code: newVendor.code.trim(),
        name: newVendor.name.trim(),
        taxNumber: newVendor.taxNumber.trim(),
        phone: newVendor.phone.trim(),
        country: newVendor.country,
        address: newVendor.address.trim(),
        email: newVendor.email.trim() || undefined,
        creditLimit: limitVal !== undefined && !isNaN(limitVal) ? limitVal : undefined,
        paymentTermsDays: termsVal !== undefined && !isNaN(termsVal) ? termsVal : undefined,
        openingBalance: finalBal
      });
    }
  };

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 text-xs sm:text-sm animate-fadeIn">
      {/* 1. Basic Identification */}
      <div className="bg-slate-50/70 p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
          <span className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
            <Truck size={18} className="text-purple-600" />
            1. بيانات المورد والتعريف النظامي
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            {newVendor.code || 'VEND-NEW'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Code */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1 text-xs sm:text-sm">
              كود المورد
            </label>
            <input 
              value={newVendor.code} 
              onChange={e => setNewVendor({...newVendor, code: e.target.value})} 
              className="w-full px-3 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all shadow-2xs" 
              placeholder="VEND-001" 
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1 text-xs sm:text-sm">
              اسم المورد / الشركة <span className="text-red-500">*</span>
            </label>
            <input 
              value={newVendor.name} 
              onChange={e => {
                setNewVendor({...newVendor, name: e.target.value});
                if (errors.name) setErrors({...errors, name: ''});
              }} 
              className={`w-full px-3 py-2 sm:py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 transition-all shadow-2xs ${
                errors.name 
                  ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-100' 
                  : 'border-slate-300 focus:border-purple-500 focus:ring-purple-100'
              }`} 
              placeholder="مثال: شركة التوريدات المتقدمة للتجارة" 
            />
            {errors.name && <span className="text-[11px] text-red-500 font-medium block mt-1">{errors.name}</span>}
          </div>

          {/* Tax Number */}
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-slate-700 font-semibold mb-1 text-xs sm:text-sm">
              الرقم الضريبي / السجل التجاري
            </label>
            <input 
              value={newVendor.taxNumber} 
              onChange={e => setNewVendor({...newVendor, taxNumber: e.target.value})} 
              className="w-full px-3 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all shadow-2xs" 
              placeholder="300000000000005" 
            />
          </div>
        </div>
      </div>

      {/* 2. Contact & Address */}
      <div className="bg-slate-50/70 p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
          <span className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
            <MapPin size={18} className="text-blue-600" />
            2. معلومات الاتصال والمقر الجغرافي
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Phone */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1 text-xs sm:text-sm">
              رقم الهاتف / الجوال
            </label>
            <input 
              value={newVendor.phone} 
              onChange={e => setNewVendor({...newVendor, phone: e.target.value})} 
              className="w-full px-3 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all shadow-2xs" 
              placeholder="05XXXXXXXX" 
              dir="ltr"
            />
          </div>

          {/* Country */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1 text-xs sm:text-sm">
              الدولة
            </label>
            <select
              value={newVendor.country}
              onChange={e => setNewVendor({...newVendor, country: e.target.value})}
              className="w-full px-3 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all shadow-2xs cursor-pointer"
            >
              {COUNTRIES_LIST.map(c => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.nameAr} ({c.iso3})
                </option>
              ))}
            </select>
          </div>

          {/* Email */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1 text-xs sm:text-sm">
              البريد الإلكتروني
            </label>
            <input 
              type="email"
              value={newVendor.email} 
              onChange={e => setNewVendor({...newVendor, email: e.target.value})} 
              className="w-full px-3 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all shadow-2xs" 
              placeholder="vendor@company.com" 
              dir="ltr"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1 text-xs sm:text-sm">
              العنوان / المقر
            </label>
            <input 
              value={newVendor.address} 
              onChange={e => setNewVendor({...newVendor, address: e.target.value})} 
              className="w-full px-3 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all shadow-2xs" 
              placeholder="المدينة - الحي - الشارع" 
            />
          </div>
        </div>
      </div>

      {/* 3. Financial Terms & Ledger Linking */}
      <div className="bg-purple-50/40 p-3.5 sm:p-5 rounded-2xl border border-purple-200/80 space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between border-b border-purple-200/60 pb-2.5">
          <span className="font-bold text-purple-950 text-xs sm:text-sm flex items-center gap-2">
            <DollarSign size={18} className="text-purple-700" />
            3. الشروط المالية والائتمانية والربط بشجرة الحسابات
          </span>
          <span className="text-[11px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md font-semibold">
            حسابات الذمم الدائنة (211)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Credit Limit */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1 text-xs sm:text-sm">
              سقف الائتمان ({currencySymbol})
            </label>
            <div className="relative">
              <input 
                type="number"
                step="0.01"
                min="0"
                value={newVendor.creditLimit} 
                onChange={e => setNewVendor({...newVendor, creditLimit: e.target.value})} 
                className="w-full pl-10 pr-3 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all shadow-2xs" 
                placeholder="100000" 
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono pointer-events-none">
                {currencySymbol}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">سقف المشتريات الآجلة المسموح بها</span>
          </div>

          {/* Payment Terms Days */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1 text-xs sm:text-sm">
              فترة السداد المتفق عليها
            </label>
            <select
              value={newVendor.paymentTermsDays}
              onChange={e => setNewVendor({...newVendor, paymentTermsDays: e.target.value})}
              className="w-full px-3 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all shadow-2xs cursor-pointer"
            >
              <option value="0">سداد فوري / نقدي (Cash on Delivery)</option>
              <option value="15">خلال 15 يوماً</option>
              <option value="30">خلال 30 يوماً (شهر واحد)</option>
              <option value="45">خلال 45 يوماً</option>
              <option value="60">خلال 60 يوماً (شهران)</option>
              <option value="90">خلال 90 يوماً (3 أشهر)</option>
              <option value="120">خلال 120 يوماً (4 أشهر)</option>
            </select>
            <span className="text-[10px] text-slate-500 mt-1 block">تحديد مواعيد استحقاق فواتير المشتريات</span>
          </div>

          {/* Opening Balance Amount */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1 text-xs sm:text-sm">
              الرصيد الافتتاحي السابق ({currencySymbol})
            </label>
            <div className="relative">
              <input 
                type="number"
                step="0.01"
                min="0"
                value={newVendor.openingBalance} 
                onChange={e => setNewVendor({...newVendor, openingBalance: e.target.value})} 
                className="w-full pl-10 pr-3 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all shadow-2xs" 
                placeholder="0.00" 
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono pointer-events-none">
                {currencySymbol}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">رصيد أول المدة عند افتتاح الحساب</span>
          </div>

          {/* Opening Balance Type */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1 text-xs sm:text-sm">
              طبيعة الرصيد الافتتاحي
            </label>
            <select
              value={newVendor.balanceType}
              onChange={e => setNewVendor({...newVendor, balanceType: e.target.value as any})}
              className="w-full px-3 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all shadow-2xs cursor-pointer"
            >
              <option value="CREDIT">دائن (مستحق للمورد علينا - التزام)</option>
              <option value="DEBIT">مدين (دفعة مقدمة للمورد - أصل لنا)</option>
            </select>
            <span className="text-[10px] text-slate-500 mt-1 block">الأثر المحاسبي في كشف الحساب</span>
          </div>
        </div>

        {/* Informative Guidance Banner */}
        <div className="bg-white/90 border border-purple-200/90 rounded-xl p-3 flex items-start gap-2.5">
          <Sparkles size={16} className="text-purple-600 shrink-0 mt-0.5" />
          <div className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">
            <strong className="text-purple-900">الربط المحاسبي الآلي:</strong> سيتم تخصيص كود حساب فريد للمورد في دليل الحسابات وربطه تلقائياً بحساب الذمم الدائنة للموردين، وسيتم ترحيل أي رصيد افتتاحي لسند قيد الافتتاح مباشرة.
          </div>
        </div>
      </div>

      {/* Fallback Internal Actions if not hidden */}
      {!hideActions && (
        <div className="flex items-center justify-end gap-2.5 mt-5 pt-3 border-t border-slate-100 text-xs">
          <button 
            type="button" 
            onClick={onCancel} 
            className="btn-3d btn-3d-white px-5 py-2.5 text-xs font-bold text-slate-700 cursor-pointer"
          >
            إلغاء
          </button>
          <button 
            type="submit" 
            className="btn-3d btn-3d-purple px-6 py-2.5 text-xs font-bold text-white shadow-md cursor-pointer flex items-center gap-2"
          >
            <Save size={15} />
            <span>حفظ المورد وفتح الحساب ←</span>
          </button>
        </div>
      )}
    </form>
  );
}
