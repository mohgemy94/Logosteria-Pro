# ==========================================
# 1. Update InternalPaymentVoucher.tsx
# ==========================================
with open('src/components/InternalPaymentVoucher.tsx', 'r', encoding='utf-8') as f:
    lines_ip = f.readlines()

ip_form_labeled = """        <form onSubmit={handleSave} className="space-y-4">
          {/* Row 1: [يصرف إلى / المستلم] | [رقم السند] | [تاريخ السند] */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* 1. Payee / Recipient */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <UserCheck size={14} className="text-blue-600 shrink-0" />
                <span>المستلم / يصرف إلى (مدفوع إلى)</span>
              </label>
              <input
                type="text"
                value={paidTo}
                onChange={(e) => setPaidTo(e.target.value)}
                placeholder="اسم الموظف / المستفيد / جهة الصرف..."
                list="employees-list"
                className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 outline-none transition-all"
              />
              <datalist id="employees-list">
                {employees.map(emp => (
                  <option key={emp.id} value={emp.name}>
                    {emp.name} {emp.jobTitle ? `(${emp.jobTitle})` : ''}
                  </option>
                ))}
                <option value="صندوق مبيعات المعرض" />
                <option value="أمين عهدة المشتريات" />
                <option value="مندوب التوزيع" />
              </datalist>
            </div>

            {/* 2. Voucher Number */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Hash size={14} className="text-slate-600 shrink-0" />
                <span>رقم السند</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={voucherNumber}
                  onChange={(e) => setVoucherNumber(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl text-xs font-mono font-bold border border-slate-200 bg-slate-50 text-slate-900 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setVoucherNumber(nextCalculatedVoucherNum)}
                  className="px-2.5 py-2 text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 shrink-0 cursor-pointer"
                >
                  تلقائي
                </button>
              </div>
            </div>

            {/* 3. Voucher Date */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Calendar size={14} className="text-amber-600 shrink-0" />
                <span>تاريخ السند</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-rose-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Row 2: [المبلغ المصروف] | [مركز التكلفة] | [الصندوق / البنك] | [طريقة السداد/الصرف] */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Amount */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-rose-950 mb-1.5">
                <Banknote size={14} className="text-emerald-600 shrink-0" />
                <span>المبلغ المصروف ({currencySymbol})</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onFocus={e => e.target.select()}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full py-2 px-3 rounded-xl text-base font-mono font-black border border-rose-300 bg-rose-50/40 text-rose-950 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 outline-none transition-all text-left"
                dir="ltr"
              />
            </div>

            {/* 2. Cost Center */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Building2 size={14} className="text-indigo-600 shrink-0" />
                <span>مركز التكلفة</span>
              </label>
              <select
                value={costCenterId}
                onChange={(e) => setCostCenterId(e.target.value)}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-rose-500 outline-none transition-all"
              >
                <option value="">-- بدون تحديد (عام) --</option>
                {costCenters.map(cc => (
                  <option key={cc.id} value={cc.id}>[{cc.code}] {cc.name}</option>
                ))}
              </select>
            </div>

            {/* 3. Disbursing Safe / Bank Account */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Wallet size={14} className="text-indigo-600 shrink-0" />
                <span>الصندوق / البنك المصروف منه</span>
              </label>
              <select
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-rose-500 outline-none transition-all"
              >
                {internalAccountsList.map(a => (
                  <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>
                ))}
              </select>
            </div>

            {/* 4. Payment Method */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <CreditCard size={14} className="text-purple-600 shrink-0" />
                <span>طريقة السداد / الصرف</span>
              </label>
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                    paymentMethod === 'CASH'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Banknote size={13} />
                  <span>نقد</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('BANK_TRANSFER')}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                    paymentMethod === 'BANK_TRANSFER'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Landmark size={13} />
                  <span>تحويل</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CHECK')}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                    paymentMethod === 'CHECK'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <FileText size={13} />
                  <span>شيك</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('SPAN')}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                    paymentMethod === 'SPAN'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <CreditCard size={13} />
                  <span>مدى</span>
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: [البيان والشرح المحاسبي] */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
              <FileText size={14} className="text-slate-600 shrink-0" />
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

          {/* Linked Transfer / Check details strip */}
          {(paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CHECK' || paymentMethod === 'SPAN') && (
            <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-fadeIn">
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-950 mb-1.5">
                  <Landmark size={13} className="text-indigo-600 shrink-0" />
                  <span>اسم البنك المحول منه</span>
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  placeholder="الراجحي / الأهلي..."
                  className="w-full py-1.5 px-2.5 rounded-lg border border-indigo-200 bg-white text-xs font-bold"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-950 mb-1.5">
                  <Hash size={13} className="text-indigo-600 shrink-0" />
                  <span>رقم المرجع / الحوالة / الشيك</span>
                </label>
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
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-amber-950 mb-1.5">
                    <Calendar size={13} className="text-amber-600 shrink-0" />
                    <span>تاريخ استحقاق الشيك</span>
                  </label>
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
        </form>
""".splitlines(True)

# Update Lucide imports in InternalPaymentVoucher.tsx
for idx, l in enumerate(lines_ip):
  if 'Building2, Scan, FileSpreadsheet' in l:
    lines_ip[idx] = l.replace('Building2, Scan, FileSpreadsheet', 'Building2, Scan, FileSpreadsheet, Hash, Users')

start_idx_ip = None
end_idx_ip = None
for idx, line in enumerate(lines_ip):
    if '<form onSubmit={handleSave}' in line:
        start_idx_ip = idx
    if start_idx_ip is not None and '</form>' in line:
        end_idx_ip = idx
        break

if start_idx_ip is not None and end_idx_ip is not None:
    lines_ip[start_idx_ip:end_idx_ip+1] = ip_form_labeled
    with open('src/components/InternalPaymentVoucher.tsx', 'w', encoding='utf-8') as f:
        f.writelines(lines_ip)
    print("Updated InternalPaymentVoucher.tsx labeled fields!")


# ==========================================
# 2. Update InternalReceiptVoucher.tsx
# ==========================================
with open('src/components/InternalReceiptVoucher.tsx', 'r', encoding='utf-8') as f:
    lines_ir = f.readlines()

ir_form_labeled = """        <form onSubmit={handleSave} className="space-y-4">
          {/* Row 1: [المسلّم / مستلم من] | [رقم السند] | [تاريخ السند] */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* 1. Received From */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <UserCheck size={14} className="text-teal-600 shrink-0" />
                <span>المسلّم / المورد الداخلي</span>
              </label>
              <input
                type="text"
                value={receivedFrom}
                onChange={(e) => setReceivedFrom(e.target.value)}
                placeholder="اسم الموظف / العهدة / الجهة المسلّمة..."
                list="employees-list"
                className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 outline-none transition-all"
              />
              <datalist id="employees-list">
                {employees.map(emp => (
                  <option key={emp.id} value={emp.name}>
                    {emp.name} {emp.jobTitle ? `(${emp.jobTitle})` : ''}
                  </option>
                ))}
                <option value="صندوق مبيعات المعرض" />
                <option value="أمين عهدة المشتريات" />
                <option value="مندوب التوزيع" />
              </datalist>
            </div>

            {/* 2. Voucher Number */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Hash size={14} className="text-slate-600 shrink-0" />
                <span>رقم السند</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={voucherNumber}
                  onChange={(e) => setVoucherNumber(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl text-xs font-mono font-bold border border-slate-200 bg-slate-50 text-slate-900 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setVoucherNumber(nextCalculatedVoucherNum)}
                  className="px-2.5 py-2 text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 shrink-0 cursor-pointer"
                >
                  تلقائي
                </button>
              </div>
            </div>

            {/* 3. Voucher Date */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Calendar size={14} className="text-amber-600 shrink-0" />
                <span>تاريخ السند</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-teal-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Row 2: [المبلغ المقبوض] | [مركز التكلفة] | [الصندوق / البنك] | [طريقة السداد/الصرف] */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Amount */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-teal-950 mb-1.5">
                <Banknote size={14} className="text-emerald-600 shrink-0" />
                <span>المبلغ المقبوض ({currencySymbol})</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onFocus={e => e.target.select()}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full py-2 px-3 rounded-xl text-base font-mono font-black border border-teal-300 bg-teal-50/40 text-teal-950 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 outline-none transition-all text-left"
                dir="ltr"
              />
            </div>

            {/* 2. Cost Center */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Building2 size={14} className="text-indigo-600 shrink-0" />
                <span>مركز التكلفة</span>
              </label>
              <select
                value={costCenterId}
                onChange={(e) => setCostCenterId(e.target.value)}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-teal-500 outline-none transition-all"
              >
                <option value="">-- بدون تحديد (عام) --</option>
                {costCenters.map(cc => (
                  <option key={cc.id} value={cc.id}>[{cc.code}] {cc.name}</option>
                ))}
              </select>
            </div>

            {/* 3. Deposit Safe / Bank Account */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Wallet size={14} className="text-indigo-600 shrink-0" />
                <span>الصندوق / البنك المودع فيه</span>
              </label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-teal-500 outline-none transition-all"
              >
                {internalAccountsList.map(a => (
                  <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>
                ))}
              </select>
            </div>

            {/* 4. Payment Method */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <CreditCard size={14} className="text-purple-600 shrink-0" />
                <span>طريقة السداد / القبض</span>
              </label>
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                    paymentMethod === 'CASH'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Banknote size={13} />
                  <span>نقد</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('BANK_TRANSFER')}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                    paymentMethod === 'BANK_TRANSFER'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Landmark size={13} />
                  <span>تحويل</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CHECK')}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                    paymentMethod === 'CHECK'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <FileText size={13} />
                  <span>شيك</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('SPAN')}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                    paymentMethod === 'SPAN'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <CreditCard size={13} />
                  <span>مدى</span>
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: [البيان والشرح المحاسبي] */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
              <FileText size={14} className="text-slate-600 shrink-0" />
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

          {/* Linked Transfer / Check details strip */}
          {(paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CHECK' || paymentMethod === 'SPAN' || sourceType === 'bank_to_cash' || sourceType === 'transfer_in') && (
            <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-fadeIn">
              {(sourceType === 'bank_to_cash' || sourceType === 'transfer_in') && (
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-950 mb-1.5">
                    <Wallet size={13} className="text-indigo-600 shrink-0" />
                    <span>الحساب المسحوب منه</span>
                  </label>
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
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-950 mb-1.5">
                      <Landmark size={13} className="text-indigo-600 shrink-0" />
                      <span>اسم البنك المحول منه</span>
                    </label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                      placeholder="الراجحي / الأهلي..."
                      className="w-full py-1.5 px-2.5 rounded-lg border border-indigo-200 bg-white text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-950 mb-1.5">
                      <Hash size={13} className="text-indigo-600 shrink-0" />
                      <span>رقم المرجع / الحوالة</span>
                    </label>
                    <input
                      type="text"
                      value={transferRef}
                      onChange={e => setTransferRef(e.target.value)}
                      placeholder="TRX-123456"
                      className="w-full py-1.5 px-2.5 rounded-lg border border-indigo-200 bg-white text-xs font-mono font-bold"
                    />
                  </div>
                </>
              )}
              {paymentMethod === 'CHECK' && (
                <>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-amber-950 mb-1.5">
                      <Hash size={13} className="text-amber-600 shrink-0" />
                      <span>رقم الشيك</span>
                    </label>
                    <input
                      type="text"
                      value={checkNumber}
                      onChange={e => setCheckNumber(e.target.value)}
                      placeholder="CHK-0001"
                      className="w-full py-1.5 px-2.5 rounded-lg border border-amber-200 bg-white text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-amber-950 mb-1.5">
                      <Calendar size={13} className="text-amber-600 shrink-0" />
                      <span>تاريخ الاستحقاق</span>
                    </label>
                    <input
                      type="date"
                      value={checkDueDate}
                      onChange={e => setCheckDueDate(e.target.value)}
                      className="w-full py-1.5 px-2.5 rounded-lg border border-amber-200 bg-white text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-amber-950 mb-1.5">
                      <Landmark size={13} className="text-amber-600 shrink-0" />
                      <span>البنك المسحوب عليه</span>
                    </label>
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
        </form>
""".splitlines(True)

# Update Lucide imports in InternalReceiptVoucher.tsx
for idx, l in enumerate(lines_ir):
  if 'Building2, Scan, FileSpreadsheet' in l:
    lines_ir[idx] = l.replace('Building2, Scan, FileSpreadsheet', 'Building2, Scan, FileSpreadsheet, Hash, Users')

start_idx_ir = None
end_idx_ir = None
for idx, line in enumerate(lines_ir):
    if '<form onSubmit={handleSave}' in line:
        start_idx_ir = idx
    if start_idx_ir is not None and '</form>' in line:
        end_idx_ir = idx
        break

if start_idx_ir is not None and end_idx_ir is not None:
    lines_ir[start_idx_ir:end_idx_ir+1] = ir_form_labeled
    with open('src/components/InternalReceiptVoucher.tsx', 'w', encoding='utf-8') as f:
        f.writelines(lines_ir)
    print("Updated InternalReceiptVoucher.tsx labeled fields!")


# ==========================================
# 3. Update ExternalVouchers.tsx
# ==========================================
with open('src/components/ExternalVouchers.tsx', 'r', encoding='utf-8') as f:
    lines_ev = f.readlines()

ev_form_labeled = """      <form onSubmit={handleSave} className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs mb-6 space-y-4">
          {/* Row 1: [يصرف إلى / المستلم / العميل] | [رقم السند] | [تاريخ السند] */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* 1. Party Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <UserCheck size={14} className="text-blue-600 shrink-0" />
                  <span>{isReceipt ? 'مستلم من (العميل / الطرف الخارجي)' : 'يصرف إلى (المورد / الطرف الخارجي)'}</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setPartnerFilterCategory(partnerFilterCategory === 'ALL' ? 'AUTO' : 'ALL')}
                  disabled={isCurrentVoucherPosted}
                  className="text-[10px] text-indigo-700 hover:underline font-bold cursor-pointer"
                >
                  {partnerFilterCategory === 'ALL' ? 'تلقائي' : 'الكل'}
                </button>
              </div>

              <select
                required
                value={partnerId}
                onChange={e => setPartnerId(e.target.value)}
                disabled={isCurrentVoucherPosted}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold border focus:outline-none transition-all ${
                  isReceipt ? 'border-emerald-300 text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500/10' : 'border-rose-300 text-slate-900 bg-white focus:ring-2 focus:ring-rose-500/10'
                } disabled:bg-slate-100 disabled:text-slate-500`}
              >
                <option value="">-- اختر الطرف الخارجي --</option>
                {availablePartners.map(p => (
                  <option key={`${p.type}-${p.id}`} value={p.id}>
                    [{p.type === 'CUSTOMER' ? 'عميل' : 'مورد'}] {p.name}
                  </option>
                ))}
              </select>

              {/* Party Remaining Balance Badge */}
              {selectedPartner && (
                <div className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-[11px] animate-fadeIn">
                  <span className="text-slate-600 font-bold truncate">المتبقي للطرف:</span>
                  <span className={`font-mono font-black ${
                    (selectedPartner.balance || 0) > 0 ? 'text-rose-700' : (selectedPartner.balance || 0) < 0 ? 'text-emerald-700' : 'text-slate-700'
                  }`}>
                    {Math.abs(selectedPartner.balance || 0).toLocaleString()} {currencySymbol}
                  </span>
                </div>
              )}
            </div>

            {/* 2. Voucher Number */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Hash size={14} className="text-slate-600 shrink-0" />
                <span>رقم السند</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  required
                  value={voucherNumber}
                  onChange={e => setVoucherNumber(e.target.value)}
                  disabled={isCurrentVoucherPosted}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-mono font-bold border ${
                    isVoucherDuplicate
                      ? 'border-red-500 text-red-700 bg-red-50'
                      : 'border-slate-200 bg-slate-50 text-slate-900 focus:bg-white'
                  }`}
                />
                {!isCurrentVoucherPosted && (
                  <button
                    type="button"
                    onClick={() => setVoucherNumber(nextCalculatedVoucherNum)}
                    className="px-2.5 py-2 text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 shrink-0 cursor-pointer"
                  >
                    تلقائي
                  </button>
                )}
              </div>
            </div>

            {/* 3. Voucher Date */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Calendar size={14} className="text-amber-600 shrink-0" />
                <span>تاريخ السند</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                disabled={isCurrentVoucherPosted}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-blue-600 outline-none transition-all disabled:bg-slate-100"
              />
            </div>
          </div>

          {/* Row 2: [المبلغ المصروف / المقبوض] | [مركز التكلفة] | [الصندوق / البنك] | [طريقة السداد/الصرف] */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Amount */}
            <div>
              <label className={`flex items-center gap-1.5 text-xs font-bold mb-1.5 ${isReceipt ? 'text-emerald-950' : 'text-rose-950'}`}>
                <Banknote size={14} className="text-emerald-600 shrink-0" />
                <span>{isReceipt ? 'المبلغ المقبوض' : 'المبلغ المصروف'} ({currencySymbol})</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                disabled={isCurrentVoucherPosted}
                onFocus={e => e.target.select()}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className={`w-full py-2 px-3 rounded-xl text-base font-mono font-black text-left border focus:outline-none transition-all ${
                  isReceipt ? 'border-emerald-300 bg-emerald-50/40 text-emerald-950 focus:ring-2 focus:ring-emerald-500/10' : 'border-rose-300 bg-rose-50/40 text-rose-950 focus:ring-2 focus:ring-rose-500/10'
                } disabled:bg-slate-100 disabled:text-slate-500`}
                dir="ltr"
              />
            </div>

            {/* 2. Cost Center */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Building2 size={14} className="text-indigo-600 shrink-0" />
                <span>مركز التكلفة</span>
              </label>
              <select
                value={costCenterId}
                onChange={e => setCostCenterId(e.target.value)}
                disabled={isCurrentVoucherPosted}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-blue-600 outline-none transition-all disabled:bg-slate-100"
              >
                <option value="">-- بدون تحديد (عام) --</option>
                {costCenters.map(cc => (
                  <option key={cc.id} value={cc.id}>
                    [{cc.code}] {cc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Safe / Bank */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Wallet size={14} className="text-indigo-600 shrink-0" />
                <span>الصندوق / البنك</span>
              </label>
              <select
                required
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                disabled={isCurrentVoucherPosted}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-blue-600 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500"
              >
                {cashAndBankAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    [{acc.code}] {acc.name}
                  </option>
                ))}
                {accountId === 'cash' && <option value="cash">الصندوق الرئيسي</option>}
                {accountId === 'bank' && <option value="bank">البنك الأهلي</option>}
              </select>
            </div>

            {/* 4. Payment Method */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <CreditCard size={14} className="text-purple-600 shrink-0" />
                <span>طريقة السداد / الصرف</span>
              </label>
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  disabled={isCurrentVoucherPosted}
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                    paymentMethod === 'CASH'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Banknote size={13} />
                  <span>نقد</span>
                </button>
                <button
                  type="button"
                  disabled={isCurrentVoucherPosted}
                  onClick={() => setPaymentMethod('BANK_TRANSFER')}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                    paymentMethod === 'BANK_TRANSFER'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Landmark size={13} />
                  <span>تحويل</span>
                </button>
                <button
                  type="button"
                  disabled={isCurrentVoucherPosted}
                  onClick={() => setPaymentMethod('CHECK')}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                    paymentMethod === 'CHECK'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <FileText size={13} />
                  <span>شيك</span>
                </button>
                <button
                  type="button"
                  disabled={isCurrentVoucherPosted}
                  onClick={() => setPaymentMethod('SPAN')}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                    paymentMethod === 'SPAN'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <CreditCard size={13} />
                  <span>مدى</span>
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: [البيان والشرح المحاسبي] */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
              <FileText size={14} className="text-slate-600 shrink-0" />
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

          {/* Linked Transfer / Check / Mada details */}
          {(paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CHECK' || paymentMethod === 'SPAN') && (
            <div className="p-3.5 bg-indigo-50/40 rounded-xl border border-indigo-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-fadeIn">
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-950 mb-1.5">
                  <Hash size={13} className="text-indigo-600 shrink-0" />
                  <span>{paymentMethod === 'CHECK' ? 'رقم الشيك' : 'رقم الحوالة / المرجع'}</span>
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
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-950 mb-1.5">
                  <Landmark size={13} className="text-indigo-600 shrink-0" />
                  <span>اسم البنك</span>
                </label>
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
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-amber-950 mb-1.5">
                    <Calendar size={13} className="text-amber-600 shrink-0" />
                    <span>تاريخ استحقاق الشيك</span>
                  </label>
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

          {/* Invoice Allocations / Matching Section if partner selected */}
          {selectedPartner && (
            <div className="pt-2 border-t border-slate-100">
              <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-blue-600" />
                    <span className="font-bold text-xs text-slate-800">تسوية وتخصيص السند على فواتير ({selectedPartner.name})</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setAllocationMode('GENERAL_ON_ACCOUNT')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        allocationMode === 'GENERAL_ON_ACCOUNT' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      دفعة عامة على الحساب
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllocationMode('AUTO_ALLOCATE')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        allocationMode === 'AUTO_ALLOCATE' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ربط بفواتير معينة
                    </button>
                  </div>
                </div>

                {allocationMode === 'GENERAL_ON_ACCOUNT' ? (
                  <p className="text-xs text-slate-600 font-medium">
                    سيتم قيد هذا السند كـ <strong>دفعة عامة على الحساب</strong> لـ ({selectedPartner.name}) دون تخصيص لفواتير محددة.
                  </p>
                ) : pendingInvoices.length === 0 ? (
                  <p className="text-xs text-emerald-700 font-medium bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                    لا توجد فواتير معلقة لـ ({selectedPartner.name}) حالياً. سيقيد السند بالكامل على الحساب العام.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">الفواتير المعلقة ({pendingInvoices.length}):</span>
                      <button
                        type="button"
                        onClick={handleAutoDistributeFifo}
                        className="text-xs text-indigo-700 hover:underline font-bold"
                      >
                        توزيع تلقائي (FIFO)
                      </button>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {pendingInvoices.map(inv => (
                        <div key={inv.id} className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs gap-2">
                          <div>
                            <span className="font-bold text-slate-800">فاتورة #{inv.invoiceNumber}</span>
                            <span className="text-[10px] text-slate-500 mr-2">المتبقي: {inv.remainingBeforeCurrent.toLocaleString()} {currencySymbol}</span>
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            value={allocationsMap[inv.id] ?? ''}
                            onChange={e => setAllocationsMap(prev => ({ ...prev, [inv.id]: e.target.value }))}
                            placeholder="0.00"
                            className="w-24 py-1 px-2 rounded-lg border border-slate-300 font-mono text-xs font-bold text-left"
                            dir="ltr"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
""".splitlines(True)

start_idx_ev = None
end_idx_ev = None
for idx, line in enumerate(lines_ev):
    if '<form onSubmit={handleSave}' in line:
        start_idx_ev = idx
    if start_idx_ev is not None and '</form>' in line:
        end_idx_ev = idx
        break

if start_idx_ev is not None and end_idx_ev is not None:
    lines_ev[start_idx_ev:end_idx_ev+1] = ev_form_labeled
    with open('src/components/ExternalVouchers.tsx', 'w', encoding='utf-8') as f:
        f.writelines(lines_ev)
    print("Updated ExternalVouchers.tsx labeled fields!")

