import os

with open('src/components/CertifiedInvoiceDocument.tsx', 'r') as f:
    text = f.read()

# Let's restore from git or view original and fix cleanly
import subprocess
subprocess.run(['git', 'checkout', 'src/components/CertifiedInvoiceDocument.tsx'], check=False)

with open('src/components/CertifiedInvoiceDocument.tsx', 'r') as f:
    text = f.read()

# 1. Vertical black line separator between Customer side (right) and Invoice details side (left)
text = text.replace(
    '''<div className={`divide-y text-xs ${isBw ? 'divide-black' : 'divide-slate-100'}`}>''',
    '''<div className="divide-y divide-black text-xs">'''
)

text = text.replace(
    '''className={`grid grid-cols-2 divide-x ${isEn ? '' : 'divide-x-reverse'} ${isBw ? 'divide-black' : 'divide-slate-200'}`}''',
    '''className={`grid grid-cols-2 divide-x-2 ${isEn ? '' : 'divide-x-reverse'} divide-black`}'''
)

# 2. Black border lines between Quantity, Unit Price, Total columns and between item rows
old_th_num = '''<th className={`py-1.5 px-2 w-7 text-center ${isBw ? (isEn ? 'border-r-2 border-black' : 'border-l-2 border-black') : (isEn ? 'border-r border-slate-700/60' : 'border-l border-slate-700/60')}`}>#</th>'''
new_th_num = '''<th className={`py-1.5 px-2 w-7 text-center ${isEn ? 'border-r-2 border-black' : 'border-l-2 border-black'}`}>#</th>'''
text = text.replace(old_th_num, new_th_num)

old_th_item = '''<th className={`py-1.5 px-2 ${isBw ? (isEn ? 'border-r-2 border-black' : 'border-l-2 border-black') : (isEn ? 'border-r border-slate-700/60' : 'border-l border-slate-700/60')}`}>'''
new_th_item = '''<th className={`py-1.5 px-2 ${isEn ? 'border-r-2 border-black' : 'border-l-2 border-black'}`}>'''
text = text.replace(old_th_item, new_th_item)

old_th_qty = '''<th className={`py-1.5 px-2 text-center w-16 ${isBw ? (isEn ? 'border-r-2 border-black' : 'border-l-2 border-black') : (isEn ? 'border-r border-slate-700/60' : 'border-l border-slate-700/60')}`}>'''
new_th_qty = '''<th className={`py-1.5 px-2 text-center w-16 ${isEn ? 'border-r-2 border-black' : 'border-l-2 border-black'}`}>'''
text = text.replace(old_th_qty, new_th_qty)

old_th_price = '''<th className={`py-1.5 px-2 ${isEn ? 'text-right' : 'text-left'} w-20 ${isBw ? (isEn ? 'border-r-2 border-black' : 'border-l-2 border-black') : (isEn ? 'border-r border-slate-700/60' : 'border-l border-slate-700/60')}`}>'''
new_th_price = '''<th className={`py-1.5 px-2 ${isEn ? 'text-right' : 'text-left'} w-20 ${isEn ? 'border-r-2 border-black' : 'border-l-2 border-black'}`}>'''
text = text.replace(old_th_price, new_th_price)

old_th_vat = '''<th className={`py-1.5 px-2 text-center w-14 ${isBw ? (isEn ? 'border-r-2 border-black' : 'border-l-2 border-black') : (isEn ? 'border-r border-slate-700/60' : 'border-l border-slate-700/60')}`}>'''
new_th_vat = '''<th className={`py-1.5 px-2 text-center w-14 ${isEn ? 'border-r-2 border-black' : 'border-l-2 border-black'}`}>'''
text = text.replace(old_th_vat, new_th_vat)

# Body divide-y and cell borders
old_tbody = '''<tbody className={`divide-y ${isBw ? 'divide-slate-300' : 'divide-slate-100'}`}>'''
new_tbody = '''<tbody className="divide-y-2 divide-black border-b-2 border-black">'''
text = text.replace(old_tbody, new_tbody)

old_tr = '''<tr key={idx} className={`${isBw ? 'even:bg-slate-50/60' : 'even:bg-slate-50/50 hover:bg-slate-50'}`}>'''
new_tr = '''<tr key={idx} className={`border-b-2 border-black ${isBw ? 'even:bg-slate-50/60' : 'even:bg-slate-50/50 hover:bg-slate-50'}`}>'''
text = text.replace(old_tr, new_tr)

old_td_num = '''<td className={`py-1.5 px-2 text-center font-mono font-bold ${isBw ? (isEn ? 'text-black border-r border-slate-400' : 'text-black border-l border-slate-400') : (isEn ? 'text-slate-500 border-r border-slate-100' : 'text-slate-500 border-l border-slate-100')}`}>'''
new_td_num = '''<td className={`py-1.5 px-2 text-center font-mono font-bold ${isEn ? 'text-slate-800 border-r-2 border-black' : 'text-slate-800 border-l-2 border-black'}`}>'''
text = text.replace(old_td_num, new_td_num)

old_td_desc = '''<td className={`py-1.5 px-2 font-bold ${isBw ? (isEn ? 'text-black border-r border-slate-400' : 'text-black border-l border-slate-400') : (isEn ? 'text-slate-900 border-r border-slate-100' : 'text-slate-900 border-l border-slate-100')}`}>'''
new_td_desc = '''<td className={`py-1.5 px-2 font-bold ${isEn ? 'text-slate-900 border-r-2 border-black' : 'text-slate-900 border-l-2 border-black'}`}>'''
text = text.replace(old_td_desc, new_td_desc)

old_td_qty = '''<td className={`py-1.5 px-2 text-center font-mono font-bold ${isBw ? (isEn ? 'text-black border-r border-slate-400' : 'text-black border-l border-slate-400') : (isEn ? 'text-slate-800 border-r border-slate-100' : 'text-slate-800 border-l border-slate-100')}`}>'''
new_td_qty = '''<td className={`py-1.5 px-2 text-center font-mono font-bold ${isEn ? 'text-slate-800 border-r-2 border-black' : 'text-slate-800 border-l-2 border-black'}`}>'''
text = text.replace(old_td_qty, new_td_qty)

old_td_price = '''<td className={`py-1.5 px-2 ${isEn ? 'text-right' : 'text-left'} font-mono font-bold ${isBw ? (isEn ? 'text-black border-r border-slate-400' : 'text-black border-l border-slate-400') : (isEn ? 'text-slate-800 border-r border-slate-100' : 'text-slate-800 border-l border-slate-100')}`}>'''
new_td_price = '''<td className={`py-1.5 px-2 ${isEn ? 'text-right' : 'text-left'} font-mono font-bold ${isEn ? 'text-slate-800 border-r-2 border-black' : 'text-slate-800 border-l-2 border-black'}`}>'''
text = text.replace(old_td_price, new_td_price)

old_td_vat = '''<td className={`py-1.5 px-2 text-center font-mono font-bold ${isBw ? (isEn ? 'text-black border-r border-slate-400' : 'text-black border-l border-slate-400') : (isEn ? 'text-slate-700 border-r border-slate-100' : 'text-slate-700 border-l border-slate-100')}`}>'''
new_td_vat = '''<td className={`py-1.5 px-2 text-center font-mono font-bold ${isEn ? 'text-slate-700 border-r-2 border-black' : 'text-slate-700 border-l-2 border-black'}`}>'''
text = text.replace(old_td_vat, new_td_vat)

# Clean up cleanBalanceLabel
text = text.replace(
    '''({data.partnerBalanceImpact.previousBalanceLabel})''',
    '''({cleanBalanceLabel(data.partnerBalanceImpact.previousBalanceLabel)})'''
)
text = text.replace(
    '''({data.partnerBalanceImpact.newBalanceLabel?.replace('مدين (مطلوب من العميل)', 'مدين')})''',
    '''({cleanBalanceLabel(data.partnerBalanceImpact.newBalanceLabel)})'''
)

with open('src/components/CertifiedInvoiceDocument.tsx', 'w') as f:
    f.write(text)

print("Done updating CertifiedInvoiceDocument.tsx")
