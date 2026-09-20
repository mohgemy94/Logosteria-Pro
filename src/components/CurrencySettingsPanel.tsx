import { useState } from 'react';
import { Landmark, Plus, Trash2, Check } from 'lucide-react';
import { CurrencySetting } from '../types/accounting';

interface CurrencySettingsPanelProps {
  currencies: CurrencySetting[];
  baseCurrency: string;
  onCurrenciesChange: (currencies: CurrencySetting[]) => void;
  onBaseCurrencyChange: (baseCode: string) => void;
}

export default function CurrencySettingsPanel({
  currencies,
  baseCurrency,
  onCurrenciesChange,
  onBaseCurrencyChange,
}: CurrencySettingsPanelProps) {
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [newRate, setNewRate] = useState('1.0');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleToggleCurrency = (code: string) => {
    const updated = currencies.map(c => {
      if (c.code === code) {
        if (c.isBase) return c; // Cannot disable base currency
        return { ...c, isEnabled: !c.isEnabled };
      }
      return c;
    });
    onCurrenciesChange(updated);
  };

  const handleRateChange = (code: string, newRateVal: number) => {
    if (isNaN(newRateVal) || newRateVal <= 0) return;
    const updated = currencies.map(c => {
      if (c.code === code) {
        return { ...c, rateAgainstBase: newRateVal };
      }
      return c;
    });
    onCurrenciesChange(updated);
  };

  const handleSetAsBase = (code: string) => {
    const updated = currencies.map(c => ({
      ...c,
      isBase: c.code === code,
      isEnabled: c.code === code ? true : c.isEnabled,
      rateAgainstBase: c.code === code ? 1.0 : c.rateAgainstBase
    }));
    onCurrenciesChange(updated);
    onBaseCurrencyChange(code);
  };

  const handleAddCurrency = () => {
    if (!newCode.trim() || !newName.trim()) return;
    const codeUpper = newCode.trim().toUpperCase();
    if (currencies.some(c => c.code === codeUpper)) {
      alert('رمز العملة مسجل مسبقاً');
      return;
    }

    const rate = parseFloat(newRate) || 1.0;
    const newEntry: CurrencySetting = {
      code: codeUpper,
      nameAr: newName.trim(),
      symbol: newSymbol.trim() || codeUpper,
      rateAgainstBase: rate,
      isBase: false,
      isEnabled: true,
    };

    onCurrenciesChange([...currencies, newEntry]);
    setNewCode('');
    setNewName('');
    setNewSymbol('');
    setNewRate('1.0');
    setShowAddForm(false);
  };

  const handleDeleteCurrency = (code: string) => {
    const target = currencies.find(c => c.code === code);
    if (target?.isBase) {
      alert('لا يمكن حذف العملة الأساسية للنظام');
      return;
    }
    onCurrenciesChange(currencies.filter(c => c.code !== code));
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Overview Info Banner */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
          <Landmark size={18} />
        </div>
        <div className="flex-1 text-xs text-indigo-900 leading-relaxed">
          <p className="font-bold text-sm text-indigo-950 mb-0.5">
            إدارة العملات المتعددة وأسعار الصرف (Multi-Currency Support)
          </p>
          <p className="text-slate-600">
            تتيح لك هذه اللوحة تفعيل إصدار الفواتير وسندات القبض والصرف بعملات متعددة، مع تحديد سعر الصرف اليومي مقابل العملة الأساسية للمنشأة (
            <span className="font-bold text-indigo-700">{baseCurrency}</span>
            ). يتم تقييم القيود المالية تلقائياً بالعملة الأساسية.
          </p>
        </div>
      </div>

      {/* Currencies Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-800">قائمة العملات المعتمدة وأسعار الصرف</span>
            <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
              {currencies.filter(c => c.isEnabled).length} عملات نشطة
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-3d btn-3d-indigo px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5"
          >
            <Plus size={14} />
            إضافة عملة جديدة
          </button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="p-4 bg-indigo-50/50 border-b border-indigo-100 flex flex-wrap items-end gap-3 animate-in fade-in">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">رمز العملة (ISO)</label>
              <input
                type="text"
                placeholder="مثال: GBP"
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                className="w-24 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg uppercase font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم العملة بالعربية</label>
              <input
                type="text"
                placeholder="مثال: جنيه إسترليني"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-40 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">رمز العملة (Symbol)</label>
              <input
                type="text"
                placeholder="مثال: £"
                value={newSymbol}
                onChange={e => setNewSymbol(e.target.value)}
                className="w-20 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">سعر الصرف مقابل الأساس</label>
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                value={newRate}
                onChange={e => setNewRate(e.target.value)}
                className="w-32 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddCurrency}
                className="btn-3d btn-3d-emerald px-3.5 py-1.5 text-xs font-bold"
              >
                حفظ وإضافة
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn-3d btn-3d-white px-3 py-1.5 text-xs font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">العملة</th>
                <th className="p-3">الرمز والرمز المختصر</th>
                <th className="p-3">سعر الصرف (مقابل {baseCurrency})</th>
                <th className="p-3 text-center">العملة الأساسية</th>
                <th className="p-3 text-center">الحالة</th>
                <th className="p-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currencies.map(curr => {
                const isBase = curr.isBase || curr.code === baseCurrency;
                return (
                  <tr key={curr.code} className={`hover:bg-slate-50/80 transition-colors ${!curr.isEnabled ? 'opacity-60 bg-slate-50/40' : ''}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs font-mono shadow-xs ${
                          isBase ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {curr.code}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{curr.nameAr}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{curr.code}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-3">
                      <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200">
                        {curr.symbol}
                      </span>
                    </td>

                    <td className="p-3">
                      {isBase ? (
                        <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 text-xs">
                          1.0000 (العملة الأساسية)
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.0001"
                            min="0.0001"
                            value={curr.rateAgainstBase}
                            onChange={e => handleRateChange(curr.code, parseFloat(e.target.value))}
                            className="w-28 px-2.5 py-1 text-xs bg-white border border-slate-300 rounded font-mono font-bold text-slate-800 text-center"
                          />
                          <span className="text-[10px] text-slate-400">
                            1 {curr.code} = {curr.rateAgainstBase} {baseCurrency}
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      {isBase ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                          <Check size={12} /> العملة الرئيسية
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetAsBase(curr.code)}
                          className="btn-3d btn-3d-primary-soft text-[10px] px-2.5 py-1 font-bold"
                        >
                          تعيين كأساسية
                        </button>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      {isBase ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">مفعلة دائماً</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleCurrency(curr.code)}
                          className={`btn-3d text-[10px] px-2.5 py-0.5 font-bold ${
                            curr.isEnabled
                              ? 'btn-3d-emerald'
                              : 'btn-3d-white text-slate-500'
                          }`}
                        >
                          {curr.isEnabled ? 'مفعلة' : 'معطلة'}
                        </button>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      {!isBase && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCurrency(curr.code)}
                          className="btn-3d btn-3d-danger-soft p-1.5"
                          title="حذف العملة"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
