import React, { useState } from 'react';
import { Save, Users, MapPin, DollarSign, Sparkles } from 'lucide-react';
import { useSystemCurrency } from '../utils/currency';
import { COUNTRIES_LIST } from '../utils/countries';

interface AddCustomerFormProps {
  initialCode?: string;
  onSave: (customer: { 
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

export default function AddCustomerForm({ 
  initialCode, 
  onSave, 
  onCancel,
  formId = 'add-customer-form',
  hideActions = false
}: AddCustomerFormProps) {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [newCustomer, setNewCustomer] = useState({ 
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
    balanceType: 'DEBIT' as 'DEBIT' | 'CREDIT' // DEBIT (مدين - عليه مبالغ لنا) or CREDIT (دائن - له رصيد مقدم علينا)
  });
  const [errors, setErrors] = useState({ name: '', taxNumber: '', phone: '' });

  const validate = () => {
    let isValid = true;
    const newErrors = { name: '', taxNumber: '', phone: '' };

    if (!newCustomer.name.trim()) {
      newErrors.name = 'اسم العميل مطلوب';
      isValid = false;
    } else if (newCustomer.name.length < 3) {
      newErrors.name = 'اسم العميل يجب أن يتكون من 3 أحرف على الأقل';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      const rawBal = Number(newCustomer.openingBalance) || 0;
      // In our partner ledger system: For CUSTOMER, positive balance = receivable (DEBIT), negative balance = advance payment (CREDIT)
      const finalBal = newCustomer.balanceType === 'CREDIT' ? -Math.abs(rawBal) : Math.abs(rawBal);
      const limitVal = newCustomer.creditLimit ? Number(newCustomer.creditLimit) : undefined;
      const termsVal = newCustomer.paymentTermsDays ? Number(newCustomer.paymentTermsDays) : undefined;
      onSave({
        code: newCustomer.code.trim(),
        name: newCustomer.name.trim(),
        taxNumber: newCustomer.taxNumber.trim(),
        phone: newCustomer.phone.trim(),
        country: newCustomer.country,
        address: newCustomer.address.trim(),
        email: newCustomer.email.trim() || undefined,
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
            <Users size={18} className="text-blue-600" />
            1. بيانات العميل والتعريف النظامي
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            {newCustomer.code || 'CUST-NEW'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Code */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1 text-xs sm:text-sm">
              كود العميل
            </label>
            <input 
              value={newCustomer.code} 
              onChange={e => setNewCustomer({...newCustomer, code: e.target.value})} 
              className="w-full px-3 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs" 
              placeholder="CUST-001" 
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1 text-xs sm:text-sm">
              اسم العميل / المنشأة <span className="text-red-500">*</span>
            </label>
            <input 
              value={newCustomer.name} 
              onChange={e => {
                setNewCustomer({...newCustomer, name: e.target.value});
                if (errors.name) setErrors({...errors, name: ''});
              }} 
              className={`w-full px-3 py-2 sm:py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 transition-all shadow-2xs ${
                errors.name 
                  ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-100' 
                  : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
              }`} 
              placeholder="اسم العميل أو المؤسسة" 
            />
            {errors.name && <span className="text-[11px] text-red-500 font-medium block mt-1">{errors.name}</span>}
          </div>

          {/* Tax Number */}
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-slate-700 font-semibold mb-1 text-xs sm:text-sm">
              الرقم الضريبي / السجل التجاري
            </label>
            <input 
              value={newCustomer.taxNumber} 
              onChange={e => {
                setNewCustomer({...newCustomer, taxNumber: e.target.value});
                if (errors.taxNumber) setErrors({...errors, taxNumber: ''});
              }} 
              className={`w-full px-3 py-2 sm:py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 transition-all shadow-2xs ${
                errors.taxNumber 
                  ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-100' 
                  : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
              }`} 
              placeholder="300000000000003" 
            />
            {errors.taxNumber && <span className="text-[11px] text-red-500 font-medium block mt-1">{errors.taxNumber}</span>}
          </div>
        </div>
      </div>

      {/* 2. Contact & Location */}
      <div className="bg-slate-50/70 p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
          <span className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
            <MapPin size={18} className="text-emerald-600" />
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
              value={newCustomer.phone} 
              onChange={e => {
                setNewCustomer({...newCustomer, phone: e.target.value});
                if (errors.phone) setErrors({...errors, phone: ''});
              }} 
              className={`w-full px-3 py-2 sm:py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 transition-all shadow-2xs ${
                errors.phone 
                  ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-100' 
                  : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
              }`} 
              placeholder="05XXXXXXXX" 
              dir="ltr"
            />
            {errors.phone && <span className="text-[11px] text-red-500 font-medium block mt-1">{errors.phone}</span>}
          </div>

          {/* Country */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1 text-xs sm:text-sm">
              الدولة
            </label>
            <select
              value={newCustomer.country}
              onChange={e => setNewCustomer({...newCustomer, country: e.target.value})}
              className="w-full px-3 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs cursor-pointer"
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
              value={newCustomer.email} 
              onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} 
              className="w-full px-3 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs" 
              placeholder="customer@company.com" 
              dir="ltr"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1 text-xs sm:text-sm">
              العنوان / المقر
            </label>
            <input 
              value={newCustomer.address} 
              onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} 
              className="w-full px-3 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs" 
              placeholder="المدينة - الحي - الشارع" 
            />
          </div>
        </div>
      </div>

      {/* 3. Financial Terms & Ledger Linking */}
      <div className="bg-blue-50/40 p-3.5 sm:p-5 rounded-2xl border border-blue-200/80 space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between border-b border-blue-200/60 pb-2.5">
          <span className="font-bold text-blue-950 text-xs sm:text-sm flex items-center gap-2">
            <DollarSign size={18} className="text-blue-700" />
            3. الشروط المالية والائتمانية والربط بشجرة الحسابات
          </span>
          <span className="text-[11px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md font-semibold">
            حسابات الذمم المدينة (112)
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
                value={newCustomer.creditLimit} 
                onChange={e => setNewCustomer({...newCustomer, creditLimit: e.target.value})} 
                className="w-full pl-10 pr-3 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs" 
                placeholder="50000" 
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono pointer-events-none">
                {currencySymbol}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">الحد الأقصى للمبيعات الآجلة للعميل</span>
          </div>

          {/* Payment Terms Days */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1 text-xs sm:text-sm">
              فترة السداد الممنوحة
            </label>
            <select
              value={newCustomer.paymentTermsDays}
              onChange={e => setNewCustomer({...newCustomer, paymentTermsDays: e.target.value})}
              className="w-full px-3 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs cursor-pointer"
            >
              <option value="0">سداد فوري / كاش (Cash)</option>
              <option value="15">خلال 15 يوماً</option>
              <option value="30">خلال 30 يوماً (شهر واحد)</option>
              <option value="45">خلال 45 يوماً</option>
              <option value="60">خلال 60 يوماً (شهران)</option>
              <option value="90">خلال 90 يوماً (3 أشهر)</option>
              <option value="120">خلال 120 يوماً (4 أشهر)</option>
            </select>
            <span className="text-[10px] text-slate-500 mt-1 block">مهلة السداد المسموح بها في الفواتير</span>
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
                value={newCustomer.openingBalance} 
                onChange={e => setNewCustomer({...newCustomer, openingBalance: e.target.value})} 
                className="w-full pl-10 pr-3 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs" 
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
              value={newCustomer.balanceType}
              onChange={e => setNewCustomer({...newCustomer, balanceType: e.target.value as any})}
              className="w-full px-3 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs cursor-pointer"
            >
              <option value="DEBIT">مدين (مستحق لنا في ذمة العميل - أصل)</option>
              <option value="CREDIT">دائن (دفعة مقدمة من العميل - التزام علينا)</option>
            </select>
            <span className="text-[10px] text-slate-500 mt-1 block">الأثر المحاسبي في كشف الحساب</span>
          </div>
        </div>

        {/* Informative Guidance Banner */}
        <div className="bg-white/90 border border-blue-200/90 rounded-xl p-3 flex items-start gap-2.5">
          <Sparkles size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">
            <strong className="text-blue-900">الربط المحاسبي الآلي:</strong> سيتم تخصيص كود حساب فريد للعميل في دليل الحسابات وربطه تلقائياً بحساب الذمم المدينة للعملاء، وتوليد قيد افتتاحي بأي رصيد مدخل.
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
            className="btn-3d btn-3d-blue px-6 py-2.5 text-xs font-bold text-white shadow-md cursor-pointer flex items-center gap-2"
          >
            <Save size={15} />
            <span>حفظ العميل وفتح الحساب ←</span>
          </button>
        </div>
      )}
    </form>
  );
}
