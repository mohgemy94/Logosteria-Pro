with open('src/components/CertifiedInvoiceDocument.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. Customer & Invoice details outer border and dividers
lines[830] = "          <div className={`mb-2.5 rounded-lg overflow-hidden border ${\n"
lines[832] = "              ? 'border-black bg-white'\n"
lines[834] = "              ? 'border-blue-950 bg-white shadow-2xs'\n"
lines[840] = "                ? 'bg-slate-200 text-black border-b border-black'\n"
lines[842] = "                ? 'bg-blue-950 text-white border-b border-blue-950'\n"

lines[867] = "            <div className={`divide-y text-xs ${isBw ? 'divide-black/40' : 'divide-slate-200'}`}>\n"
lines[875] = "                    className={`grid grid-cols-2 divide-x ${isEn ? '' : 'divide-x-reverse'} ${isBw ? 'divide-black/60' : 'divide-slate-300'}`}\n"

# 2. Items Table outer container & headers
lines[1323] = "            <div className={`mb-2.5 overflow-x-auto overflow-y-hidden rounded-lg border ${\n"
lines[1325] = "                ? 'border-black'\n"
lines[1327] = "                ? 'border-blue-950 shadow-2xs'\n"

lines[1332] = "                  <tr className={`${docTheme.tableHeader} font-bold border-b ${isBw ? 'border-black' : 'border-slate-300'}`}>\n"
lines[1333] = "                    <th className={`py-1.5 px-2 w-7 text-center ${isEn ? 'border-r' : 'border-l'} ${isBw ? 'border-black/50' : 'border-slate-300/80'}`}>#</th>\n"
lines[1334] = "                    <th className={`py-1.5 px-2 ${isEn ? 'border-r' : 'border-l'} ${isBw ? 'border-black/50' : 'border-slate-300/80'}`}>\n"
lines[1337] = "                    <th className={`py-1.5 px-2 text-center w-16 ${isEn ? 'border-r' : 'border-l'} ${isBw ? 'border-black/50' : 'border-slate-300/80'}`}>\n"
lines[1340] = "                    <th className={`py-1.5 px-2 ${isEn ? 'text-right' : 'text-left'} w-20 ${isEn ? 'border-r' : 'border-l'} ${isBw ? 'border-black/50' : 'border-slate-300/80'}`}>\n"
lines[1344] = "                      <th className={`py-1.5 px-2 text-center w-14 ${isEn ? 'border-r' : 'border-l'} ${isBw ? 'border-black/50' : 'border-slate-300/80'}`}>\n"

# 3. Items Table tbody & cells
lines[1353] = "                <tbody className={`divide-y ${isBw ? 'divide-black/30' : 'divide-slate-200'}`}>\n"
lines[1357] = "                      <tr key={idx} className={`${isBw ? 'even:bg-slate-50/60' : 'even:bg-slate-50/50 hover:bg-slate-50'}`}>\n"

lines[1358] = "                        <td className={`py-1.5 px-2 text-center font-mono font-bold ${isEn ? 'border-r' : 'border-l'} ${isBw ? 'text-black border-black/30' : 'text-slate-800 border-slate-200'}`}>\n"
lines[1361] = "                        <td className={`py-1.5 px-2 font-bold ${isEn ? 'border-r' : 'border-l'} ${isBw ? 'text-black border-black/30' : 'text-slate-900 border-slate-200'}`}>\n"
lines[1364] = "                        <td className={`py-1.5 px-2 text-center font-mono font-bold ${isEn ? 'border-r' : 'border-l'} ${isBw ? 'text-black border-black/30' : 'text-slate-800 border-slate-200'}`}>\n"
lines[1367] = "                        <td className={`py-1.5 px-2 ${isEn ? 'text-right' : 'text-left'} font-mono font-bold ${isEn ? 'border-r' : 'border-l'} ${isBw ? 'text-black border-black/30' : 'text-slate-800 border-slate-200'}`}>\n"
lines[1371] = "                          <td className={`py-1.5 px-2 text-center font-mono font-bold ${isEn ? 'border-r' : 'border-l'} ${isBw ? 'text-black border-black/30' : 'text-slate-700 border-slate-200'}`}>\n"

with open('src/components/CertifiedInvoiceDocument.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("CertifiedInvoiceDocument thin lines updated successfully.")
