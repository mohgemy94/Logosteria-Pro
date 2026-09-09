const fs = require('fs');
let content = fs.readFileSync('src/components/Sales.tsx', 'utf8');

const serviceDropdown = `
            {/* Service Type */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-emerald-500 shadow-2xs space-y-1.5 ring-2 ring-emerald-50">
              <label className="text-emerald-950 font-black text-[11px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                نوع الخدمة
              </label>
              <select
                disabled={!isEditable}
                value={serviceType}
                onChange={e => setServiceType(e.target.value)}
                className="w-full bg-emerald-50/40 border-2 border-emerald-300 p-1.5 rounded-xl text-emerald-950 font-bold focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 disabled:border-slate-300"
              >
                <option value="">-- بدون خدمة محددة --</option>
                <option value="استشارات">استشارات</option>
                <option value="تصميم">تصميم</option>
                <option value="برمجة">برمجة</option>
                <option value="صيانة">صيانة</option>
                <option value="تركيب">تركيب</option>
                <option value="دعم فني">دعم فني</option>
                <option value="خدمات عامة">خدمات عامة</option>
              </select>
            </div>
`;

content = content.replace(
  "            {/* Source / Warehouse */}",
  serviceDropdown + "\n            {/* Source / Warehouse */}"
);

// We should also adjust grid cols if needed.
// `<div className="grid grid-cols-2 md:grid-cols-4 gap-4">` -> Let's see what the container is.
fs.writeFileSync('src/components/Sales.tsx', content);
