import React, { useState } from 'react';
import { Save } from 'lucide-react';

interface AddVendorFormProps {
  initialCode?: string;
  onSave: (vendor: { 
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

export default function AddVendorForm({ initialCode, onSave, onCancel }: AddVendorFormProps) {
  const [newVendor, setNewVendor] = useState({ 
    code: initialCode || '',
    name: '', 
    taxNumber: '', 
    phone: '', 
    address: '',
    email: '',
    creditLimit: '',
    paymentTermsDays: '0',
    openingBalance: '',
    balanceType: 'CREDIT' // CREDIT (دائن - مستحق للمورد علينا) or DEBIT (مدين - دفعة مقدمة لنا)
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
        address: newVendor.address.trim(),
        email: newVendor.email.trim() || undefined,
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
          <label className="text-[10px] font-bold uppercase text-slate-500">كود المورد</label>
          <input 
            value={newVendor.code} 
            onChange={e => setNewVendor({...newVendor, code: e.target.value})} 
            className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 font-mono" 
            placeholder="VEND-001" 
          />
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">اسم المورد / الشركة <span className="text-red-500">*</span></label>
          <input 
            value={newVendor.name} 
            onChange={e => {
              setNewVendor({...newVendor, name: e.target.value});
              if (errors.name) setErrors({...errors, name: ''});
            }} 
            className={`border p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 ${errors.name ? 'border-red-400 bg-red-50' : 'border-slate-200'}`} 
            placeholder="اسم الشركة أو المورد" 
          />
          {errors.name && <span className="text-[10px] text-red-500">{errors.name}</span>}
        </div>

        {/* Tax Number */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">الرقم الضريبي / السجل التجاري</label>
          <input 
            value={newVendor.taxNumber} 
            onChange={e => setNewVendor({...newVendor, taxNumber: e.target.value})} 
            className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 font-mono" 
            placeholder="300000000000005" 
          />
        </div>

        {/* Phone */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">رقم الهاتف / الجوال</label>
          <input 
            value={newVendor.phone} 
            onChange={e => setNewVendor({...newVendor, phone: e.target.value})} 
            className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 font-mono" 
            placeholder="05XXXXXXXX" 
            dir="ltr"
          />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">البريد الإلكتروني</label>
          <input 
            type="email"
            value={newVendor.email} 
            onChange={e => setNewVendor({...newVendor, email: e.target.value})} 
            className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 font-mono" 
            placeholder="vendor@company.com" 
            dir="ltr"
          />
        </div>

        {/* Address */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">العنوان / المقر</label>
          <input 
            value={newVendor.address} 
            onChange={e => setNewVendor({...newVendor, address: e.target.value})} 
            className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500" 
            placeholder="المدينة - الحي - الشارع" 
          />
        </div>

        {/* Credit Limit (سقف الالتزام أو الائتمان الممنوح) */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">سقف الائتمان الممنوح (ريال)</label>
          <input 
            type="number"
            step="0.01"
            min="0"
            value={newVendor.creditLimit} 
            onChange={e => setNewVendor({...newVendor, creditLimit: e.target.value})} 
            className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 font-mono" 
            placeholder="مثال: 100000" 
          />
          <span className="text-[9px] text-slate-400">سقف التسهيلات الآجلة المسموح بها من المورد</span>
        </div>

        {/* Payment Terms Days */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">فترة السداد المتفق عليها</label>
          <select
            value={newVendor.paymentTermsDays}
            onChange={e => setNewVendor({...newVendor, paymentTermsDays: e.target.value})}
            className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
          >
            <option value="0">سداد فوري / نقدي (Cash / Delivery)</option>
            <option value="15">خلال 15 يوماً</option>
            <option value="30">خلال 30 يوماً (شهر)</option>
            <option value="45">خلال 45 يوماً</option>
            <option value="60">خلال 60 يوماً (شهران)</option>
            <option value="90">خلال 90 يوماً (3 أشهر)</option>
            <option value="120">خلال 120 يوماً (4 أشهر)</option>
          </select>
        </div>

        {/* Opening Balance Amount */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">الرصيد الافتتاحي السابق (ريال)</label>
          <input 
            type="number"
            step="0.01"
            min="0"
            value={newVendor.openingBalance} 
            onChange={e => setNewVendor({...newVendor, openingBalance: e.target.value})} 
            className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 font-mono" 
            placeholder="0.00" 
          />
        </div>

        {/* Opening Balance Type */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">طبيعة الرصيد الافتتاحي</label>
          <select
            value={newVendor.balanceType}
            onChange={e => setNewVendor({...newVendor, balanceType: e.target.value})}
            className="border border-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
          >
            <option value="CREDIT">دائن (مستحق للمورد علينا - التزام)</option>
            <option value="DEBIT">مدين (دفعة مقدمة سابقة للمورد - لنا)</option>
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
          <span>حفظ المورد وفتح الحساب</span>
        </button>
      </div>
    </form>
  );
}
