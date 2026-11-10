with open('src/components/CertifiedInvoiceDocument.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line 876:
lines[875] = "                    className={`grid grid-cols-2 divide-x-2 ${isEn ? '' : 'divide-x-reverse'} divide-black`}\n"

# Lines 1334 - 1348 (Table Headers):
lines[1333] = "                    <th className={`py-1.5 px-2 w-7 text-center ${isEn ? 'border-r-2 border-black' : 'border-l-2 border-black'}`}>#</th>\n"
lines[1334] = "                    <th className={`py-1.5 px-2 ${isEn ? 'border-r-2 border-black' : 'border-l-2 border-black'}`}>\n"
lines[1337] = "                    <th className={`py-1.5 px-2 text-center w-16 ${isEn ? 'border-r-2 border-black' : 'border-l-2 border-black'}`}>\n"
lines[1340] = "                    <th className={`py-1.5 px-2 ${isEn ? 'text-right' : 'text-left'} w-20 ${isEn ? 'border-r-2 border-black' : 'border-l-2 border-black'}`}>\n"
lines[1344] = "                      <th className={`py-1.5 px-2 text-center w-14 ${isEn ? 'border-r-2 border-black' : 'border-l-2 border-black'}`}>\n"

# Line 1358 (Table Row) & Cells (1359, 1362, 1365, 1368, 1372):
lines[1357] = "                      <tr key={idx} className={`border-b-2 border-black ${isBw ? 'even:bg-slate-50/60' : 'even:bg-slate-50/50 hover:bg-slate-50'}`}>\n"
lines[1358] = "                        <td className={`py-1.5 px-2 text-center font-mono font-bold ${isEn ? 'text-black border-r-2 border-black' : 'text-black border-l-2 border-black'}`}>\n"
lines[1361] = "                        <td className={`py-1.5 px-2 font-bold ${isEn ? 'text-black border-r-2 border-black' : 'text-black border-l-2 border-black'}`}>\n"
lines[1364] = "                        <td className={`py-1.5 px-2 text-center font-mono font-bold ${isEn ? 'text-black border-r-2 border-black' : 'text-black border-l-2 border-black'}`}>\n"
lines[1367] = "                        <td className={`py-1.5 px-2 ${isEn ? 'text-right' : 'text-left'} font-mono font-bold ${isEn ? 'text-black border-r-2 border-black' : 'text-black border-l-2 border-black'}`}>\n"
lines[1371] = "                          <td className={`py-1.5 px-2 text-center font-mono font-bold ${isEn ? 'text-black border-r-2 border-black' : 'border-l-2 border-black'}`}>\n"

with open('src/components/CertifiedInvoiceDocument.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("CertifiedInvoiceDocument.tsx repaired successfully.")
