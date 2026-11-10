with open('src/components/CertifiedInvoiceDocument.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Thermal receipt subtotal condition
old_thermal_subtotal = '''          {/* Totals */}
          <div className="py-2 border-b-2 border-dashed border-black space-y-1 font-mono text-[11px] font-bold text-black">
            {data.subtotal !== undefined && ('''

new_thermal_subtotal = '''          {/* Totals */}
          <div className="py-2 border-b-2 border-dashed border-black space-y-1 font-mono text-[11px] font-bold text-black">
            {data.classification === 'TAX' && data.subtotal !== undefined && ('''

text = text.replace(old_thermal_subtotal, new_thermal_subtotal)

# 2. Standard paper format subtotal condition
old_paper_subtotal = '''          {/* Column 2: Financial Breakdown Box */}
          <div className={`p-2.5 rounded-lg space-y-1.5 text-[11px] ${isBw ? 'bg-slate-50 border border-black' : 'bg-slate-50/70 border border-black/40'}`}>
            {data.subtotal !== undefined && ('''

new_paper_subtotal = '''          {/* Column 2: Financial Breakdown Box */}
          <div className={`p-2.5 rounded-lg space-y-1.5 text-[11px] ${isBw ? 'bg-slate-50 border border-black' : 'bg-slate-50/70 border border-black/40'}`}>
            {data.classification === 'TAX' && data.subtotal !== undefined && ('''

text = text.replace(old_paper_subtotal, new_paper_subtotal)

with open('src/components/CertifiedInvoiceDocument.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Tax subtotal conditions updated successfully!")
