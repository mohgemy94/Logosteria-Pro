import React, { useState } from 'react';
import { Users, Save } from 'lucide-react';

interface AddCustomerFormProps {
  onSave: (customer: { 
    name: string; 
    taxNumber: string; 
    phone: string; 
    address?: string;
    openingBalance?: number;
  }) => void;
  onCancel: () => void;
}

export default function AddCustomerForm({ onSave, onCancel }: AddCustomerFormProps) {
  const [newCustomer, setNewCustomer] = useState({ 
    name: '', 
    taxNumber: '', 
    phone: '', 
    address: '',
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

    if (newCustomer.taxNumber && !/^\d{15}$/.test(newCustomer.taxNumber)) {
      newErrors.taxNumber = 'الرقم الضريبي يجب أن يكون 15 رقماً';
      isValid = false;
    }

    if (newCustomer.phone && !/^05\d{8}$/.test(newCustomer.phone)) {
      newErrors.phone = 'رقم الهاتف يجب أن يبدأ بـ 05 ويتكون من 10 أرقام';
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
      onSave({
        name: newCustomer.name.trim(),
        taxNumber: newCustomer.taxNumber.trim(),
        phone: newCustomer.phone.trim(),
        address: newCustomer.address.trim(),
        openingBalance: finalBal
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6 animate-fadeIn">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm sm:text-base">
        <Users size={18} className="text-blue-600" /> تسجيل عميل جديد وربط الحساب
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        
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
          <label className="text-[10px] font-bold uppercase text-slate-500">الرقم الضريبي (15 رقم)</label>
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
          <label className="text-[10px] font-bold uppercase text-slate-500">رقم الهاتف الجوال</label>
          <input 
            value={newCustomer.phone} 
            onChange={e => {
              setNewCustomer({...newCustomer, phone: e.target.value});
              if (errors.phone) setErrors({...errors, phone: ''});
            }} 
            className={`border p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 font-mono ${errors.phone ? 'border-red-400 bg-red-50' : 'border-slate-200'}`} 
            placeholder="05XXXXXXXX" 
            dir="ltr"
          />
          {errors.phone && <span className="text-[10px] text-red-500 text-right">{errors.phone}</span>}
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
          className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer font-medium"
        >
          إلغاء
        </button>
        <button 
          type="submit" 
          className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors shadow-sm cursor-pointer"
        >
          <Save size={15} />
          <span>حفظ العميل وفتح الحساب</span>
        </button>
      </div>
    </form>
  );
}
