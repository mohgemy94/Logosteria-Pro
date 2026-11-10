with open('src/components/CertifiedInvoiceDocument.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Column 1: Notes & Terms frame thin black border
old_notes_frame = '''          {/* Column 1: Notes & Instructions */}
          <div className={`space-y-2 p-2.5 rounded-lg ${isBw ? 'bg-slate-50 border-2 border-black' : 'bg-slate-50/70 border border-slate-200'}`}>'''

new_notes_frame = '''          {/* Column 1: Notes & Instructions */}
          <div className={`space-y-2 p-2.5 rounded-lg ${isBw ? 'bg-slate-50 border border-black' : 'bg-slate-50/70 border border-black/40'}`}>'''

text = text.replace(old_notes_frame, new_notes_frame)

old_notes_text = '''              <p className={`font-medium text-[11px] leading-relaxed p-2 rounded min-h-[48px] ${isBw ? 'bg-white border-2 border-black text-black' : 'bg-white border border-slate-200 text-slate-700 shadow-2xs'}`}>'''

new_notes_text = '''              <p className={`font-medium text-[11px] leading-relaxed p-2 rounded min-h-[48px] ${isBw ? 'bg-white border border-black text-black' : 'bg-white border border-black/30 text-slate-900 shadow-2xs'}`}>'''

text = text.replace(old_notes_text, new_notes_text)

# 2. Column 2: Financial Breakdown Box thin black border & clear black text
old_fin_frame = '''          {/* Column 2: Financial Breakdown Box */}
          <div className={`p-2.5 rounded-lg space-y-1.5 text-[11px] ${isBw ? 'bg-slate-50 border-2 border-black' : 'bg-slate-50/70 border border-slate-200'}`}>'''

new_fin_frame = '''          {/* Column 2: Financial Breakdown Box */}
          <div className={`p-2.5 rounded-lg space-y-1.5 text-[11px] ${isBw ? 'bg-slate-50 border border-black' : 'bg-slate-50/70 border border-black/40'}`}>'''

text = text.replace(old_fin_frame, new_fin_frame)

# Subtotal row text color -> clear black
old_subtotal_row = '''            {data.subtotal !== undefined && (
              <div className="flex justify-between items-center text-slate-700 font-medium">
                <span>{isEn ? 'Subtotal (Excl. VAT):' : 'المجموع الفرعي (غير شامل الضريبة):'}</span>
                <span className="font-mono font-bold text-slate-900">
                  {data.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currSymbol}
                </span>
              </div>
            )}'''

new_subtotal_row = '''            {data.subtotal !== undefined && (
              <div className="flex justify-between items-center text-slate-900 font-bold">
                <span>{isEn ? 'Subtotal (Excl. VAT):' : 'المجموع الفرعي (غير شامل الضريبة):'}</span>
                <span className="font-mono font-black text-slate-950">
                  {data.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currSymbol}
                </span>
              </div>
            )}'''

text = text.replace(old_subtotal_row, new_subtotal_row)

# Discount row text color -> clear black
old_discount_row = '''            {data.discountTotal !== undefined && data.discountTotal > 0 && (
              <div className={`flex justify-between items-center font-medium ${isBw ? 'text-black' : 'text-rose-700'}`}>
                <span>{isEn ? 'Discount Applied:' : 'إجمالي الخصم الممنوح:'}</span>
                <span className="font-mono font-bold">
                  -{data.discountTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currSymbol}
                </span>
              </div>
            )}'''

new_discount_row = '''            {data.discountTotal !== undefined && data.discountTotal > 0 && (
              <div className="flex justify-between items-center font-bold text-slate-900">
                <span>{isEn ? 'Discount Applied:' : 'إجمالي الخصم الممنوح:'}</span>
                <span className="font-mono font-bold text-slate-950">
                  -{data.discountTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currSymbol}
                </span>
              </div>
            )}'''

text = text.replace(old_discount_row, new_discount_row)

# Services row text color -> clear black
old_services_row = '''            {data.servicesTotal !== undefined && data.servicesTotal > 0 && (
              <div className={`flex justify-between items-center font-medium ${isBw ? 'text-black' : 'text-cyan-700'}`}>
                <span>{isEn ? 'Services / Charges:' : 'قيمة الخدمات المضافة:'}</span>
                <span className="font-mono font-bold">
                  +{data.servicesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currSymbol}
                </span>
              </div>
            )}'''

new_services_row = '''            {data.servicesTotal !== undefined && data.servicesTotal > 0 && (
              <div className="flex justify-between items-center font-bold text-slate-900">
                <span>{isEn ? 'Services / Charges:' : 'قيمة الخدمات المضافة:'}</span>
                <span className="font-mono font-bold text-slate-950">
                  +{data.servicesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currSymbol}
                </span>
              </div>
            )}'''

text = text.replace(old_services_row, new_services_row)

# Payment breakdown box frame border & text colors
old_payment_box = '''            {/* Payment Breakdown Box */}
            {data.paidAmount !== undefined && !isVoucher && (
              <div className={`p-2 rounded-lg text-[11px] font-sans border ${
                isBw ? 'border-2 border-black bg-slate-100 text-black' : 'border-slate-200 bg-slate-50 text-slate-800'
              }`}>'''

new_payment_box = '''            {/* Payment Breakdown Box */}
            {data.paidAmount !== undefined && !isVoucher && (
              <div className={`p-2 rounded-lg text-[11px] font-sans border ${
                isBw ? 'border border-black bg-slate-100 text-black' : 'border border-black/40 bg-slate-50 text-slate-900'
              }`}>'''

text = text.replace(old_payment_box, new_payment_box)

# Paid amount & Remaining amount text colors -> clear black
old_paid_remaining = '''                <div className="space-y-1 font-mono text-[10px]">
                  <div className={`flex justify-between items-center ${isBw ? 'text-black' : 'text-slate-600'}`}>
                    <span className="font-sans">{isEn ? 'Paid Amount:' : 'المبلغ المسدد:'}</span>
                    <span className={`font-bold ${isBw ? 'text-black' : 'text-emerald-700'}`}>
                      {Number(data.paidAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currSymbol}
                    </span>
                  </div>
                  <div className={`flex justify-between items-center ${isBw ? 'text-black' : 'text-slate-600'}`}>
                    <span className="font-sans">{isEn ? 'Remaining Due:' : 'المبلغ المتبقي:'}</span>
                    <span className={`font-bold ${isBw ? 'text-black' : 'text-rose-700'}`}>
                      {(data.remainingBalance ?? Math.max(0, grandAmount - (data.paidAmount || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currSymbol}
                    </span>
                  </div>
                </div>'''

new_paid_remaining = '''                <div className="space-y-1 font-mono text-[10px]">
                  <div className="flex justify-between items-center text-slate-900 font-bold">
                    <span className="font-sans">{isEn ? 'Paid Amount:' : 'المبلغ المسدد:'}</span>
                    <span className="font-bold text-slate-950">
                      {Number(data.paidAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currSymbol}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-900 font-bold">
                    <span className="font-sans">{isEn ? 'Remaining Due:' : 'المبلغ المتبقي:'}</span>
                    <span className="font-bold text-slate-950">
                      {(data.remainingBalance ?? Math.max(0, grandAmount - (data.paidAmount || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currSymbol}
                    </span>
                  </div>
                </div>'''

text = text.replace(old_paid_remaining, new_paid_remaining)

# Partner Balance Impact box frame border & text colors -> clear black
old_partner_box = '''            {data.partnerBalanceImpact && (
              <div className={`mt-2 p-2 rounded-lg text-[11px] font-sans ${
                isBw 
                  ? 'border-2 border-black bg-slate-100 text-black' 
                  : 'border border-indigo-200 bg-indigo-50/80 text-slate-800 shadow-2xs'
              }`}>
                <div className="flex justify-between items-center font-bold mb-1 pb-1 border-b border-slate-300/80">
                  <span className="text-slate-900 font-black">
                    {isEn ? 'Account Balance Summary:' : `موقف حساب ${data.partnerType === 'VENDOR' ? 'المورد' : 'العميل'}:`}
                  </span>
                  <span className="text-[9px] font-bold text-slate-600">
                    {data.partnerName || ''}
                  </span>
                </div>
                
                <div className="space-y-1 font-mono text-[10px]">
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="font-sans">{isEn ? 'Previous Balance:' : 'الرصيد السابق قبل الفاتورة:'}</span>
                    <span className="font-bold text-slate-900">
                      {data.partnerBalanceImpact.previousBalanceFormatted} {currSymbol} ({cleanBalanceLabel(data.partnerBalanceImpact.previousBalanceLabel)})
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="font-sans">{isEn ? 'Current Invoice:' : 'قيمة الفاتورة الحالية (+):'}</span>
                    <span className="font-bold text-slate-900">
                      +{data.partnerBalanceImpact.invoiceAmountFormatted} {currSymbol}
                    </span>
                  </div>
                  {data.partnerBalanceImpact.paidAmount > 0 && (
                    <div className={`flex justify-between items-center ${isBw ? 'text-black' : 'text-slate-600'}`}>
                      <span className="font-sans">{isEn ? 'Immediate Payment:' : 'المسدد نقداً بالفاتورة (-):'}</span>
                      <span className={`font-bold ${isBw ? 'text-black' : 'text-emerald-700'}`}>
                        -{data.partnerBalanceImpact.paidAmountFormatted} {currSymbol}
                      </span>
                    </div>
                  )}
                  <div className={`flex justify-between items-center pt-1 border-t ${isBw ? 'border-black' : 'border-indigo-300/80'} font-bold`}>
                    <span className="font-sans font-black text-slate-900">
                      {isEn ? 'Balance After Invoice:' : 'موقف الحساب بعد الفاتورة:'}
                    </span>
                    <span className="text-xs font-black text-slate-950">
                      {data.partnerBalanceImpact.newBalanceFormatted} {currSymbol} ({cleanBalanceLabel(data.partnerBalanceImpact.newBalanceLabel)})
                    </span>
                  </div>
                </div>
              </div>
            )}'''

new_partner_box = '''            {data.partnerBalanceImpact && (
              <div className={`mt-2 p-2 rounded-lg text-[11px] font-sans border ${
                isBw 
                  ? 'border border-black bg-slate-100 text-black' 
                  : 'border border-black/40 bg-slate-50 text-slate-900 shadow-2xs'
              }`}>
                <div className="flex justify-between items-center font-bold mb-1 pb-1 border-b border-black/30">
                  <span className="text-slate-950 font-black">
                    {isEn ? 'Account Balance Summary:' : `موقف حساب ${data.partnerType === 'VENDOR' ? 'المورد' : 'العميل'}:`}
                  </span>
                  <span className="text-[10px] font-bold text-slate-950">
                    {data.partnerName || ''}
                  </span>
                </div>
                
                <div className="space-y-1 font-mono text-[10px]">
                  <div className="flex justify-between items-center text-slate-950 font-bold">
                    <span className="font-sans">{isEn ? 'Previous Balance:' : 'الرصيد السابق قبل الفاتورة:'}</span>
                    <span className="font-bold text-slate-950">
                      {data.partnerBalanceImpact.previousBalanceFormatted} {currSymbol} ({cleanBalanceLabel(data.partnerBalanceImpact.previousBalanceLabel)})
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-950 font-bold">
                    <span className="font-sans">{isEn ? 'Current Invoice:' : 'قيمة الفاتورة الحالية (+):'}</span>
                    <span className="font-bold text-slate-950">
                      +{data.partnerBalanceImpact.invoiceAmountFormatted} {currSymbol}
                    </span>
                  </div>
                  {data.partnerBalanceImpact.paidAmount > 0 && (
                    <div className="flex justify-between items-center text-slate-950 font-bold">
                      <span className="font-sans">{isEn ? 'Immediate Payment:' : 'المسدد نقداً بالفاتورة (-):'}</span>
                      <span className="font-bold text-slate-950">
                        -{data.partnerBalanceImpact.paidAmountFormatted} {currSymbol}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1 border-t border-black/30 font-bold">
                    <span className="font-sans font-black text-slate-950">
                      {isEn ? 'Balance After Invoice:' : 'موقف الحساب بعد الفاتورة:'}
                    </span>
                    <span className="text-xs font-black text-slate-950">
                      {data.partnerBalanceImpact.newBalanceFormatted} {currSymbol} ({cleanBalanceLabel(data.partnerBalanceImpact.newBalanceLabel)})
                    </span>
                  </div>
                </div>
              </div>
            )}'''

text = text.replace(old_partner_box, new_partner_box)

with open('src/components/CertifiedInvoiceDocument.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Summary styles patch applied successfully!")
