const fs = require('fs');
let content = fs.readFileSync('src/components/Sales.tsx', 'utf8');

const discountUI = `
            <div className="flex justify-between items-center text-xs text-slate-300">
              <span className="font-bold text-rose-300">الخصم الإجمالي (قيمة):</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={!isEditable}
                  value={discount === 0 ? '' : discount}
                  onChange={e => setDiscount(Number(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-24 text-right bg-slate-800 border-2 border-rose-900/50 rounded-lg px-2 py-1 text-sm font-mono font-bold text-rose-300 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 disabled:opacity-50"
                />
                <span className="text-[10px] font-bold">{currencySymbol}</span>
              </div>
            </div>
`;

content = content.replace(
  "            {classification === 'TAX' && (",
  discountUI + "\n            {classification === 'TAX' && ("
);

fs.writeFileSync('src/components/Sales.tsx', content);
