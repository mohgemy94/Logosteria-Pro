# 1. InternalReceiptVoucher.tsx
file_rcpt = 'src/components/InternalReceiptVoucher.tsx'
with open(file_rcpt, 'r', encoding='utf-8') as f:
    c_rcpt = f.read()

# Replace from Row 3 comment down to </form>
old_rcpt_area_pattern = r"\{/\* Linked Transfer / Check details strip \*/\}[\s\S]*?</form>"

new_rcpt_area = """{/* Linked Transfer / Check details strip */}
          {(paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CHECK' || paymentMethod === 'SPAN' || sourceType === 'bank_to_cash' || sourceType === 'transfer_in') && (
            <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-fadeIn">
              {(sourceType === 'bank_to_cash' || sourceType === 'transfer_in') && (
                <div>
                  <label className="block text-[11px] font-bold text-indigo-950 mb-1">الحساب المسحوب منه</label>
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                    className="w-full py-1.5 px-2.5 rounded-lg border border-indigo-200 bg-white text-xs font-bold"
                  >
                    <option value="">-- اختر الحساب المسحوب منه --</option>
                    {internalAccountsList.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {paymentMethod === 'BANK_TRANSFER' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-indigo-950 mb-1">اسم البنك المحول منه</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                      placeholder="الراجحي / الأهلي..."
                      className="w-full py-1.5 px-2.5 rounded-lg border border-indigo-200 bg-white text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-indigo-950 mb-1">رقم المرجع / الحوالة</label>
                    <input
                      type="text"
                      value={referenceNo}
                      onChange={e => setReferenceNo(e.target.value)}
                      placeholder="TRX-123456"
                      className="w-full py-1.5 px-2.5 rounded-lg border border-indigo-200 bg-white text-xs font-mono font-bold"
                    />
                  </div>
                </>
              )}
              {paymentMethod === 'CHECK' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-950 mb-1">رقم الشيك</label>
                    <input
                      type="text"
                      value={referenceNo}
                      onChange={e => setReferenceNo(e.target.value)}
                      placeholder="CHK-0001"
                      className="w-full py-1.5 px-2.5 rounded-lg border border-amber-200 bg-white text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-950 mb-1">تاريخ الاستحقاق</label>
                    <input
                      type="date"
                      value={checkDueDate}
                      onChange={e => setCheckDueDate(e.target.value)}
                      className="w-full py-1.5 px-2.5 rounded-lg border border-amber-200 bg-white text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-950 mb-1">البنك المسحوب عليه</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                      placeholder="مصرف الراجحي..."
                      className="w-full py-1.5 px-2.5 rounded-lg border border-amber-200 bg-white text-xs font-bold"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Row 3: [البيان والشرح المحاسبي] */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
              <AlignLeft size={14} className="text-slate-600 shrink-0" />
              <span>البيان والشرح المحاسبي</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="استرداد عهدة / سلفة / الشرح المحاسبي للعملية..."
              className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 outline-none transition-all resize-none"
            />
          </div>
        </form>"""

import re
c_rcpt_new, count_rcpt = re.subn(old_rcpt_area_pattern, new_rcpt_area, c_rcpt)
print(f"InternalReceiptVoucher: {count_rcpt}")
with open(file_rcpt, 'w', encoding='utf-8') as f:
    f.write(c_rcpt_new)


# 2. InternalPaymentVoucher.tsx
file_pmt = 'src/components/InternalPaymentVoucher.tsx'
with open(file_pmt, 'r', encoding='utf-8') as f:
    c_pmt = f.read()

old_pmt_area_pattern = r"\{/\* Linked Transfer / Check details strip \*/\}[\s\S]*?</form>"

new_pmt_area = """{/* Linked Transfer / Check details strip */}
          {(paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CHECK' || paymentMethod === 'SPAN') && (
            <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-fadeIn">
              <div>
                <label className="block text-[11px] font-bold text-indigo-950 mb-1">اسم البنك المحول منه</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  placeholder="الراجحي / الأهلي..."
                  className="w-full py-1.5 px-2.5 rounded-lg border border-indigo-200 bg-white text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-indigo-950 mb-1">رقم المرجع / الحوالة / الشيك</label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={e => setReferenceNo(e.target.value)}
                  placeholder="TRX / CHK..."
                  className="w-full py-1.5 px-2.5 rounded-lg border border-indigo-200 bg-white text-xs font-mono font-bold"
                />
              </div>
              {paymentMethod === 'CHECK' && (
                <div>
                  <label className="block text-[11px] font-bold text-amber-950 mb-1">تاريخ استحقاق الشيك</label>
                  <input
                    type="date"
                    value={checkDueDate}
                    onChange={e => setCheckDueDate(e.target.value)}
                    className="w-full py-1.5 px-2.5 rounded-lg border border-amber-200 bg-white text-xs font-bold"
                  />
                </div>
              )}
            </div>
          )}

          {/* Row 3: [البيان والشرح المحاسبي] */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
              <AlignLeft size={14} className="text-slate-600 shrink-0" />
              <span>البيان والشرح المحاسبي</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مصروفات نثرية / صيانة / الشرح المحاسبي للعملية..."
              className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 outline-none transition-all resize-none"
            />
          </div>
        </form>"""

c_pmt_new, count_pmt = re.subn(old_pmt_area_pattern, new_pmt_area, c_pmt)
print(f"InternalPaymentVoucher: {count_pmt}")
with open(file_pmt, 'w', encoding='utf-8') as f:
    f.write(c_pmt_new)


# 3. ExternalVouchers.tsx
file_ext = 'src/components/ExternalVouchers.tsx'
with open(file_ext, 'r', encoding='utf-8') as f:
    c_ext = f.read()

old_ext_area_pattern = r"\{/\* Linked Transfer / Check / Mada details \*/\}[\s\S]*?(?=\{/\* Invoice Allocations)"

new_ext_area = """{/* Linked Transfer / Check / Mada details */}
          {(paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CHECK' || paymentMethod === 'SPAN') && (
            <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-fadeIn">
              <div>
                <label className="block text-[11px] font-bold text-indigo-950 mb-1">
                  {paymentMethod === 'CHECK' ? 'رقم الشيك' : 'رقم الحوالة / المرجع'}
                </label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={e => setReferenceNo(e.target.value)}
                  disabled={isCurrentVoucherPosted}
                  placeholder="Ref / Check No..."
                  className="w-full py-1.5 px-2.5 rounded-lg border border-indigo-200 bg-white text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-indigo-950 mb-1">اسم البنك</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  disabled={isCurrentVoucherPosted}
                  placeholder="مصرف الراجحي / البنك الأهلي..."
                  className="w-full py-1.5 px-2.5 rounded-lg border border-indigo-200 bg-white text-xs font-bold"
                />
              </div>
              {paymentMethod === 'CHECK' && (
                <div>
                  <label className="block text-[11px] font-bold text-amber-950 mb-1">تاريخ استحقاق الشيك</label>
                  <input
                    type="date"
                    value={checkDueDate}
                    onChange={e => setCheckDueDate(e.target.value)}
                    disabled={isCurrentVoucherPosted}
                    className="w-full py-1.5 px-2.5 rounded-lg border border-amber-200 bg-white text-xs font-bold"
                  />
                </div>
              )}
            </div>
          )}

          {/* Row 3: [البيان والشرح المحاسبي] */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
              <AlignLeft size={14} className="text-slate-600 shrink-0" />
              <span>البيان والشرح المحاسبي</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={isCurrentVoucherPosted}
              placeholder="بيان الشرح المحاسبي والسبب التفصيلي للعملية..."
              className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all resize-none disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>

          """

c_ext_new, count_ext = re.subn(old_ext_area_pattern, new_ext_area, c_ext)
print(f"ExternalVouchers: {count_ext}")
with open(file_ext, 'w', encoding='utf-8') as f:
    f.write(c_ext_new)
