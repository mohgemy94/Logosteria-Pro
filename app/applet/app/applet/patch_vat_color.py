with open('src/components/CertifiedInvoiceDocument.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

old_vat_row = '''            {data.taxTotal !== undefined && data.taxTotal > 0 && (
              <div className="flex justify-between items-center text-slate-700 font-medium">
                <span>{isEn ? `Value Added Tax (${effectiveVatRate}%):` : `ضريبة القيمة المضافة (${effectiveVatRate}%):`}</span>
                <span className={`font-mono font-bold ${isBw ? 'text-black' : 'text-indigo-700'}`}>
                  {data.taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currSymbol}
                </span>
              </div>
            )}'''

new_vat_row = '''            {data.taxTotal !== undefined && data.taxTotal > 0 && (
              <div className="flex justify-between items-center text-slate-900 font-bold">
                <span>{isEn ? `Value Added Tax (${effectiveVatRate}%):` : `ضريبة القيمة المضافة (${effectiveVatRate}%):`}</span>
                <span className="font-mono font-black text-slate-950">
                  {data.taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currSymbol}
                </span>
              </div>
            )}'''

text = text.replace(old_vat_row, new_vat_row)

with open('src/components/CertifiedInvoiceDocument.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("VAT text color updated to clear black successfully!")
