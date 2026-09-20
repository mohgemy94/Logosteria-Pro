import React, { useState } from 'react';
import { Save } from 'lucide-react';

interface AddCustomerFormProps {
  initialCode?: string;
  onSave: (customer: { 
    code?: string;
    name: string; 
    taxNumber: string; 
    phone: string; 
    address?: string | undefined;
    email?: string | undefined;
    creditLimit?: number | undefined;
    paymentTermsDays?: number | undefined;
    openingBalance?: number;
  }) => void;
  onCancel: () => void;
}

export default function AddCustomerForm({ initialCode, onSave, onCancel }: AddCustomerFormProps) {
  const [newCustomer, setNewCustomer] = useState({ 
    code: initialCode || '',
    name: '', 
    taxNumber: '', 
    phone: '', 
    address: '',
    email: '',
    creditLimit: '',
    paymentTermsDays: '0',
    openingBalance: '',
    balanceType: 'DEBIT' // DEBIT (مدين - عليه مبالغ) or CREDIT (دائن - له رصيد مقدم)
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
      const finalBal = newCustomer.balanceType === 'CREDIT' ? -Math.abs(rawBal) : Math.abs(rawBal);
      const limitVal = newCustomer.creditLimit ? Number(newCustomer.creditLimit) : undefined;
      const termsVal = newCustomer.paymentTermsDays ? Number(newCustomer.paymentTermsDays) : undefined;
      onSave({
        code: newCustomer.code.trim(),
        name: newCustomer.name.trim(),
        taxNumber: newCustomer.taxNumber.trim(),
        phone: newCustomer.phone.trim(),
        address: newCustomer.address.trim(),
        email: newCustomer.email.trim() || undefined,
        creditLimit: limitVal !== undefined && !isNaN(limitVal) ? limitVal : undefined,
        paymentTermsDays: termsVal !== undefined && !isNaN(termsVal) ? termsVal : undefined,
        openingBalance: finalBal
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="animate-fadeIn">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        
        {/* Code */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">كود العميل</label>
          <input 
            value={newCustomer.code} 
            onChange={e => setNewCustomer({...newCustomer, code: e.target.value})} 
            className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 font-mono" 
            placeholder="CUST-001" 
          />
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">اسم العميل / المنشأة <span className="text-red-500">*</span></label>
          <input 
            value={newCustomer.name} 
            onChange={e => {
              setNewCustomer({...newCustomer, name: e.target.value});
              if (errors.name) setErrors({...errors, name: ''});
            }} 
            className={`border p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 ${errors.name ? 'border-red-400 bg-red-50' : 'border-slate-200'}`} 
            placeholder="اسم الشركة أو المؤسسة" 
          />
          {errors.name && <span className="text-[10px] text-red-500">{errors.name}</span>}
        </div>

        {/* Tax Number */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">الرقم الضريبي</label>
          <input 
            value={newCustomer.taxNumber} 
            onChange={e => {
              setNewCustomer({...newCustomer, taxNumber: e.target.value});
              if (errors.taxNumber) setErrors({...errors, taxNumber: ''});
            }} 
            className={`border p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 font-mono ${errors.taxNumber ? 'border-red-400 bg-red-50' : 'border-slate-200'}`} 
            placeholder="300000000000003" 
          />
          {errors.taxNumber && <span className="text-[10px] text-red-500">{errors.taxNumber}</span>}
        </div>

        {/* Phone */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">رقم الهاتف الجوال / تليفون</label>
          <input 
            value={newCustomer.phone} 
            onChange={e => {
              setNewCustomer({...newCustomer, phone: e.target.value});
              if (errors.phone) setErrors({...errors, phone: ''});
            }} 
            className={`border p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 font-mono ${errors.phone ? 'border-red-400 bg-red-50' : 'border-slate-200'}`} 
            placeholder="رقم الهاتف" 
            dir="ltr"
          />
          {errors.phone && <span className="text-[10px] text-red-500 text-right">{errors.phone}</span>}
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">البريد الإلكتروني</label>
          <input 
            type="email"
            value={newCustomer.email} 
            onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} 
            className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 font-mono" 
            placeholder="billing@example.com" 
            dir="ltr"
          />
        </div>

        {/* Address */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">العنوان / المقر</label>
          <input 
            value={newCustomer.address} 
            onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} 
            className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500" 
            placeholder="المدينة - الحي - الشارع" 
          />
        </div>

        {/* Credit Limit */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">حد الائتمان المسموح (ريال)</label>
          <input 
            type="number"
            step="0.01"
            min="0"
            value={newCustomer.creditLimit} 
            onChange={e => setNewCustomer({...newCustomer, creditLimit: e.target.value})} 
            className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 font-mono" 
            placeholder="مثال: 50000" 
          />
          <span className="text-[9px] text-slate-400">سقف المديونية الآمنة، اتركه فارغاً إذا كان غير محدد</span>
        </div>

        {/* Payment Terms Days */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">فترة الائتمان / السداد</label>
          <select
            value={newCustomer.paymentTermsDays}
            onChange={e => setNewCustomer({...newCustomer, paymentTermsDays: e.target.value})}
            className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
          >
            <option value="0">سداد فوري / نقدي (Cash on Delivery)</option>
            <option value="15">خلال 15 يوماً</option>
            <option value="30">خلال 30 يوماً (شهر)</option>
            <option value="45">خلال 45 يوماً</option>
            <option value="60">خلال 60 يوماً (شهران)</option>
            <option value="90">خلال 90 يوماً (3 أشهر)</option>
          </select>
        </div>

        {/* Opening Balance Amount */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">الرصيد الافتتاحي السابق (ريال)</label>
          <input 
            type="number"
            step="0.01"
            min="0"
            value={newCustomer.openingBalance} 
            onChange={e => setNewCustomer({...newCustomer, openingBalance: e.target.value})} 
            className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 font-mono" 
            placeholder="0.00" 
          />
        </div>

        {/* Opening Balance Type */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">طبيعة الرصيد الافتتاحي</label>
          <select
            value={newCustomer.balanceType}
            onChange={e => setNewCustomer({...newCustomer, balanceType: e.target.value})}
            className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
          >
            <option value="DEBIT">مدين (مستحق لنا على العميل)</option>
            <option value="CREDIT">دائن (رصيد مدفوع مقدماً للعميل)</option>
          </select>
        </div>

      </div>

      <div className="flex items-center justify-end gap-2.5 mt-5 pt-3 border-t border-slate-100 text-xs">
        <button 
          type="button" 
          onClick={onCancel} 
          className="btn-3d btn-3d-white px-4 py-2 text-xs font-black hover:scale-105 active:scale-95 transition-all"
        >
          إلغاء
        </button>
        <button 
          type="submit" 
          className="btn-3d btn-3d-blue px-5 py-2 text-xs font-black hover:scale-105 active:scale-95 transition-all"
        >
          <Save size={15} />
          <span>حفظ العميل وفتح الحساب</span>
        </button>
      </div>
    </form>
  );
}
