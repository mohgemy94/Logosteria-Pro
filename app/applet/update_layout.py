import re

def update_purchases():
    with open('src/components/Purchases.tsx', 'r', encoding='utf-8') as f:
        c = f.read()

    # Find the Parameters Section inside Purchases
    start_marker = '{/* Compact Clean Parameters Section (Eliminate Box-in-a-box) */}'
    end_marker = '{/* Invoice Items Matrix Table & Integrated Header Bar */}'
    
    start_idx = c.find(start_marker)
    end_idx = c.find(end_marker)
    assert start_idx != -1 and end_idx != -1

    new_section = '''{/* Compact Clean Parameters Section (Eliminate Box-in-a-box) */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 print:hidden">
          {/* Row 1: Vendor Selection, Invoice Number & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 text-xs mb-3">
            {/* Vendor Select with Quick Action Bar (Col Span 5) */}
            <div className="lg:col-span-5 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <User size={13} className="text-emerald-700" />
                  <span>المورد:</span>
                </label>
                <div className="flex items-center gap-2">
                  {selectedPartner?.taxNumber && (
                    <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      ضريبي: {selectedPartner.taxNumber}
                    </span>
                  )}
                  {selectedPartner && (
                    <button
                      type="button"
                      onClick={() => setSelectedPartnerForStatementModal(selectedPartner)}
                      className="text-[11px] text-emerald-800 hover:underline font-bold"
                      title="فتح كشف حساب المورد"
                    >
                      كشف حساب
                    </button>
                  )}
                  {hasPartnerError && (
                    <span className="text-rose-600 text-[10px] font-bold animate-pulse">
                      يرجى اختيار المورد
                    </span>
                  )}
                </div>
              </div>

              {/* Vendor Select and Quick Add Button (+) */}
              <div className="flex items-center gap-1.5">
                <select
                  disabled={!isEditable}
                  required
                  value={partnerId}
                  onChange={e => {
                    setPartnerId(e.target.value);
                    if (e.target.value) setHasPartnerError(false);
                  }}
                  className={`flex-1 bg-white border ${
                    hasPartnerError ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
                  } py-1.5 px-2.5 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 shadow-2xs`}
                >
                  <option value="">-- اختر المورد أو اضغط + للإضافة السريعة --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.phone ? `(${v.phone})` : ''}
                    </option>
                  ))}
                </select>

                {/* Quick Add Vendor Button */}
                {isEditable && (
                  <button
                    type="button"
                    onClick={() => setShowQuickAddVendorModal(true)}
                    className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
                    title="إضافة مورد جديد فوراً دون مغادرة الفاتورة"
                  >
                    <Plus size={14} />
                    <span className="hidden sm:inline">مورد جديد</span>
                  </button>
                )}
              </div>

              {/* Quick Vendor Live Data Bar (Balance & Credit Limit) */}
              {selectedPartner && (
                <div className="mt-1.5 flex items-center justify-between text-[11px] bg-white rounded-lg px-2.5 py-1 border border-slate-200 text-slate-700 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <span>
                      الرصيد الحالي:{' '}
                      <strong className={`font-mono font-bold ${
                        selectedPartnerStatement && selectedPartnerStatement.balance > 0 
                          ? 'text-emerald-700' 
                          : selectedPartnerStatement && selectedPartnerStatement.balance < 0 
                          ? 'text-rose-700' 
                          : 'text-slate-700'
                      }`}>
                        {selectedPartnerStatement?.balanceFormatted || '0.00'} {currencySymbol}
                        {' '}({selectedPartnerStatement && selectedPartnerStatement.balance > 0 ? 'دائن له' : 'مدين'})
                      </strong>
                    </span>
                    {selectedPartner.creditLimit ? (
                      <span>
                        | الحد الائتماني:{' '}
                        <strong className="text-slate-800 font-mono font-bold">
                          {Number(selectedPartner.creditLimit).toLocaleString()} {currencySymbol}
                        </strong>
                      </span>
                    ) : null}
                  </div>
                  {selectedPartner.phone && (
                    <span className="font-mono text-slate-500 flex items-center gap-1">
                      <Phone size={10} className="text-slate-400" />
                      {selectedPartner.phone}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Invoice Number (Col Span 3) - in Row 1 after Vendor & New Vendor button */}
            <div className="lg:col-span-3 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">رقم الفاتورة:</label>
                <span className="text-[10px] text-emerald-800 font-bold font-mono">تلقائي</span>
              </div>
              <input
                type="text"
                disabled={true}
                value={invoiceNumber}
                className="w-full bg-slate-900 border border-slate-800 py-1.5 px-3 rounded-lg font-mono font-bold text-emerald-300 text-center text-xs focus:outline-none shadow-inner"
              />
            </div>

            {/* Issue Date (Col Span 2) */}
            <div className="lg:col-span-2 flex flex-col justify-center">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                <Calendar size={13} className="text-emerald-700" />
                <span>تاريخ التوريد:</span>
              </label>
              <input
                type="date"
                disabled={!isEditable}
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-white border border-slate-300 py-1.5 px-2.5 rounded-lg text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 shadow-2xs"
              />
            </div>

            {/* Due Date (Col Span 2) */}
            <div className="lg:col-span-2 flex flex-col justify-center">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                <Calendar size={13} className="text-slate-500" />
                <span>تاريخ الاستحقاق:</span>
              </label>
              <input
                type="date"
                disabled={!isEditable}
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-white border border-slate-300 py-1.5 px-2.5 rounded-lg text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 shadow-2xs"
              />
            </div>
          </div>

          {/* Row 2: Parameters Grid (Payment Method, Safe, Classification, Warehouse Destination, Service Type) - Below Vendor Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
            {/* 1. Payment Method */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">طريقة السداد:</label>
              <select
                disabled={!isEditable}
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as any)}
                className="w-full bg-white border border-slate-300 py-1.5 px-2 rounded-lg text-slate-900 font-bold text-xs focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 shadow-2xs"
              >
                {PAYMENT_METHODS_LIST.map(pm => (
                  <option key={pm.id} value={pm.id}>{pm.label}</option>
                ))}
              </select>
            </div>

            {/* 2. Safe / Cashbox */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">خزنة الدفع والسداد:</label>
              <select
                disabled={!isEditable}
                value={safe}
                onChange={e => setSafe(e.target.value)}
                className="w-full bg-white border border-slate-300 py-1.5 px-2 rounded-lg text-slate-900 font-bold text-xs focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 shadow-2xs"
              >
                {SAFES_LIST.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* 3. Classification & Tax Rate */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">التصنيف والضريبة</label>
                {classification === 'TAX' && (
                  <span className="text-[10px] font-mono font-bold text-emerald-800">
                    %{taxRate}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  disabled={!isEditable}
                  value={classification}
                  onChange={e => {
                    const newClass = e.target.value as 'NORMAL' | 'TAX';
                    setClassification(newClass);
                    if (newClass === 'TAX') {
                      const rate = taxRate || 15;
                      setItems(prev => prev.map(it => ({ ...it, taxRate: rate })));
                    } else {
                      setItems(prev => prev.map(it => ({ ...it, taxRate: 0 })));
                    }
                  }}
                  className="w-full bg-white border border-slate-300 py-1.5 px-2 rounded-lg text-slate-900 font-bold text-xs focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 shadow-2xs"
                >
                  <option value="TAX">ضريبية</option>
                  <option value="NORMAL">عادية</option>
                </select>
                {classification === 'TAX' && (
                  <input
                    type="number"
                    min="0"
                    max="100"
                    disabled={!isEditable}
                    value={taxRate}
                    onFocus={e => e.target.select()}
                    onChange={e => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setTaxRate('');
                        setItems(prev => prev.map(it => ({ ...it, taxRate: 0 })));
                      } else {
                        const val = Number(raw);
                        setTaxRate(val);
                        setItems(prev => prev.map(it => ({ ...it, taxRate: val })));
                      }
                    }}
                    className="w-14 bg-white border border-slate-300 py-1.5 px-1 rounded-lg text-center font-mono font-bold text-xs focus:outline-none focus:border-emerald-600 shadow-2xs"
                    placeholder="15"
                  />
                )}
              </div>
            </div>

            {/* 4. Warehouse Destination */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">وجهة المخزون والتوريد</label>
              <select
                disabled={!isEditable}
                value={source}
                onChange={e => setSource(e.target.value)}
                className="w-full bg-white border border-slate-300 py-1.5 px-2 rounded-lg text-slate-900 font-bold text-xs focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 shadow-2xs"
              >
                <option value="MAIN_WAREHOUSE">المستودع الرئيسي</option>
                <option value="SHOWROOM">معرض المبيعات</option>
                <option value="BRANCH_1">فرع الرياض</option>
              </select>
            </div>

            {/* 5. Service Type */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">نوع الخدمة / العملية:</label>
              <select
                disabled={!isEditable}
                value={serviceType}
                onChange={e => setServiceType(e.target.value)}
                className="w-full bg-white border border-slate-300 py-1.5 px-2 rounded-lg text-slate-900 font-bold text-xs focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 shadow-2xs"
              >
                <option value="">-- بدون خدمة إضافية --</option>
                <option value="توريد بضائع ومخزون">توريد بضائع ومخزون</option>
                <option value="شحن ونقل">شحن ونقل</option>
                <option value="صيانة وتشغيل">صيانة وتشغيل</option>
                <option value="تركيب وتجهيز">تركيب وتجهيز</option>
                <option value="استشارات">استشارات</option>
                <option value="خدمات عامة">خدمات عامة</option>
                <option value="دعم فني">دعم فني</option>
              </select>
            </div>
          </div>
        </div>
        '''

    c = c[:start_idx] + new_section + c[end_idx:]
    with open('src/components/Purchases.tsx', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Purchases updated successfully")

def update_sales():
    with open('src/components/Sales.tsx', 'r', encoding='utf-8') as f:
        c = f.read()

    start_marker = '{/* Compact Clean Parameters Section (Eliminate Box-in-a-box) */}'
    end_marker = '{/* Invoice Items Matrix Table & Integrated Header Bar */}'
    
    start_idx = c.find(start_marker)
    end_idx = c.find(end_marker)
    assert start_idx != -1 and end_idx != -1

    new_section = '''{/* Compact Clean Parameters Section (Eliminate Box-in-a-box) */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 print:hidden">
          {/* Row 1: Customer Selection, Invoice Number & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 text-xs mb-3">
            {/* Customer Select with Quick Action Bar (Col Span 5) */}
            <div className="lg:col-span-5 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-slate-800 font-bold text-xs flex items-center gap-1">
                  <User size={13} className="text-blue-700" />
                  <span>العميل:</span>
                </label>
                <div className="flex items-center gap-2">
                  {selectedPartner?.taxNumber && (
                    <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      ضريبي: {selectedPartner.taxNumber}
                    </span>
                  )}
                  {hasPartnerError && (
                    <span className="text-rose-600 text-[10px] font-bold animate-pulse">
                      يرجى اختيار العميل
                    </span>
                  )}
                </div>
              </div>

              {/* Customer Select and Quick Add Button (+) */}
              <div className="flex items-center gap-1.5">
                <select
                  disabled={!isEditable}
                  required
                  value={partnerId}
                  onChange={e => {
                    setPartnerId(e.target.value);
                    if (e.target.value) setHasPartnerError(false);
                  }}
                  className={`flex-1 bg-white border ${
                    hasPartnerError ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
                  } focus:border-blue-600 py-1.5 px-2.5 rounded-lg text-slate-900 font-bold text-xs focus:outline-none disabled:bg-slate-100 shadow-2xs transition-colors`}
                >
                  <option value="">-- اختر العميل أو اضغط + للإضافة السريعة --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>

                {/* Quick Add Customer Button */}
                {isEditable && (
                  <button
                    type="button"
                    onClick={() => setShowQuickAddCustomerModal(true)}
                    className="h-8 px-2.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 shadow-2xs"
                    title="إضافة عميل جديد سريعاً دون مغادرة الفاتورة"
                  >
                    <Plus size={13} />
                    <span className="hidden sm:inline">عميل جديد</span>
                  </button>
                )}
              </div>

              {/* Quick Customer Statement & Credit Limit Bar */}
              {selectedPartner && (
                <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] shadow-2xs mt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-500 font-medium">الرصيد:</span>
                    <span className={`font-mono font-bold ${
                      (selectedPartnerStatement?.netBalance || 0) > 0.01 
                        ? 'text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200' 
                        : (selectedPartnerStatement?.netBalance || 0) < -0.01
                        ? 'text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200'
                        : 'text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded'
                    }`}>
                      {selectedPartnerStatement?.balanceFormatted || '0.00'} {currencySymbol}
                      {(selectedPartnerStatement?.netBalance || 0) > 0.01 ? ' (مدين عليه)' : (selectedPartnerStatement?.netBalance || 0) < -0.01 ? ' (دائن له)' : ' (خالص)'}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-500 font-medium">الحد الائتماني:</span>
                    <span className="font-mono font-bold text-slate-700">
                      {selectedPartner.creditLimit ? `${selectedPartner.creditLimit.toLocaleString()} ${currencySymbol}` : 'غير محدد'}
                    </span>
                    {selectedPartner.creditLimit && (selectedPartnerStatement?.netBalance || 0) > selectedPartner.creditLimit && (
                      <span className="text-[10px] text-rose-700 bg-rose-100 border border-rose-300 px-1.5 py-0.2 rounded font-bold animate-pulse">
                        ⚠️ تجاوز الحد!
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPartnerForStatementModal(selectedPartner)}
                    className="text-[10px] text-blue-700 hover:underline font-bold px-1 shrink-0 cursor-pointer"
                    title="فتح كشف حساب تفصيلي"
                  >
                    كشف الحساب
                  </button>
                </div>
              )}
            </div>

            {/* Invoice Number (Col Span 3) - in Row 1 after Customer & New Customer button */}
            <div className="lg:col-span-3 flex flex-col gap-1 justify-center">
              <div className="flex items-center justify-between">
                <label className="text-slate-800 font-bold text-xs">رقم الفاتورة:</label>
                {status !== 'POSTED' && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = nextCalculatedInvoiceNum;
                      setInvoiceNumber(next);
                      setInvoiceNumberError(null);
                      showToast({ type: 'info', title: `تم تعيين الرقم: ${next}` });
                    }}
                    className="text-[10px] text-blue-700 hover:underline font-bold cursor-pointer"
                    title="توليد تلقائي"
                  >
                    تلقائي
                  </button>
                )}
              </div>
              <input
                type="text"
                disabled={!isEditable}
                value={invoiceNumber}
                onChange={e => {
                  setInvoiceNumber(e.target.value);
                  setInvoiceNumberError(null);
                }}
                className={`w-full bg-slate-900 border ${
                  invoiceNumberError ? 'border-rose-500' : 'border-slate-800'
                } py-1.5 px-2.5 rounded-lg font-mono font-black text-amber-300 text-center text-xs focus:outline-none shadow-2xs`}
                placeholder="INV-XXXX"
              />
              {invoiceNumberError && (
                <span className="text-[10px] font-bold text-rose-600 block truncate">
                  {invoiceNumberError}
                </span>
              )}
            </div>

            {/* Issue Date (Col Span 2) */}
            <div className="lg:col-span-2 flex flex-col gap-1 justify-center">
              <label className="text-slate-800 font-bold text-xs flex items-center gap-1">
                <Calendar size={13} className="text-blue-700" />
                <span>تاريخ الإصدار:</span>
              </label>
              <input
                type="date"
                disabled={!isEditable}
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-blue-600 py-1.5 px-2.5 rounded-lg text-slate-900 font-mono font-bold text-xs focus:outline-none disabled:bg-slate-100 shadow-2xs transition-colors"
              />
            </div>

            {/* Due Date (Col Span 2) */}
            <div className="lg:col-span-2 flex flex-col gap-1 justify-center">
              <label className="text-slate-800 font-bold text-xs flex items-center gap-1">
                <Calendar size={13} className="text-slate-500" />
                <span>تاريخ الاستحقاق:</span>
              </label>
              <input
                type="date"
                disabled={!isEditable}
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-blue-600 py-1.5 px-2.5 rounded-lg text-slate-900 font-mono font-bold text-xs focus:outline-none disabled:bg-slate-100 shadow-2xs transition-colors"
              />
            </div>
          </div>

          {/* Row 2: Parameters Grid (Payment Method, Safe, Tax & Classification, Warehouse, Service) - Below Customer Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
            {/* 1. Payment Method */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-800 font-bold text-xs">طريقة السداد:</label>
              <select
                disabled={!isEditable}
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as any)}
                className="w-full bg-white border border-slate-300 focus:border-blue-600 py-1.5 px-2 rounded-lg text-slate-900 font-bold text-xs focus:outline-none disabled:bg-slate-100 shadow-2xs"
              >
                {PAYMENT_METHODS_LIST.map(pm => (
                  <option key={pm.id} value={pm.id}>{pm.label}</option>
                ))}
              </select>
            </div>

            {/* 2. Safe / Cashbox */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-800 font-bold text-xs">خزنة الدفع والسداد:</label>
              <select
                disabled={!isEditable}
                value={safe}
                onChange={e => setSafe(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-blue-600 py-1.5 px-2 rounded-lg text-slate-900 font-bold text-xs focus:outline-none disabled:bg-slate-100 shadow-2xs"
              >
                {SAFES_LIST.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* 3. Classification & Tax Rate */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-slate-800 font-bold text-xs">التصنيف والضريبة:</label>
                {classification === 'TAX' && (
                  <span className="text-[10px] font-mono font-bold text-blue-700">
                    %{taxRate}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <select
                  disabled={!isEditable}
                  value={classification}
                  onChange={e => {
                    const newClass = e.target.value as 'NORMAL' | 'TAX';
                    setClassification(newClass);
                    if (newClass === 'TAX') {
                      const rate = taxRate || 15;
                      setItems(prev => prev.map(it => ({ ...it, taxRate: rate })));
                    } else {
                      setItems(prev => prev.map(it => ({ ...it, taxRate: 0 })));
                    }
                  }}
                  className="w-full bg-white border border-slate-300 focus:border-blue-600 py-1.5 px-2 rounded-lg text-slate-900 font-bold text-xs focus:outline-none disabled:bg-slate-100 shadow-2xs"
                >
                  <option value="TAX">فاتورة ضريبية</option>
                  <option value="NORMAL">فاتورة مبسطة / عادية</option>
                </select>
                {classification === 'TAX' && (
                  <input
                    type="number"
                    min="0"
                    max="100"
                    disabled={!isEditable}
                    value={taxRate}
                    onFocus={e => e.target.select()}
                    onChange={e => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setTaxRate('');
                        setItems(prev => prev.map(it => ({ ...it, taxRate: 0 })));
                      } else {
                        const val = Number(raw);
                        setTaxRate(val);
                        setItems(prev => prev.map(it => ({ ...it, taxRate: val })));
                      }
                    }}
                    className="w-12 bg-white border border-slate-300 focus:border-blue-600 py-1.5 px-1 rounded-lg text-center font-mono font-bold text-xs shadow-2xs"
                    placeholder="15"
                  />
                )}
              </div>
            </div>

            {/* 4. Warehouse Source */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-800 font-bold text-xs">مستودع التوريد:</label>
              <select
                disabled={!isEditable}
                value={source}
                onChange={e => setSource(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-blue-600 py-1.5 px-2 rounded-lg text-slate-900 font-bold text-xs focus:outline-none disabled:bg-slate-100 shadow-2xs"
              >
                <option value="MAIN_WAREHOUSE">المستودع الرئيسي</option>
                <option value="SHOWROOM">معرض المبيعات</option>
                <option value="BRANCH_1">فرع الرياض</option>
              </select>
            </div>

            {/* 5. Service Type */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-800 font-bold text-xs">نوع الخدمة / العملية:</label>
              <select
                disabled={!isEditable}
                value={serviceType}
                onChange={e => setServiceType(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-blue-600 py-1.5 px-2 rounded-lg text-slate-900 font-bold text-xs focus:outline-none disabled:bg-slate-100 shadow-2xs"
              >
                <option value="">-- بدون خدمة إضافية --</option>
                <option value="استشارات">استشارات</option>
                <option value="تصميم">تصميم</option>
                <option value="برمجة">برمجة</option>
                <option value="صيانة">صيانة</option>
                <option value="تركيب">تركيب</option>
                <option value="دعم فني">دعم فني</option>
                <option value="خدمات عامة">خدمات عامة</option>
              </select>
            </div>
          </div>
        </div>
        '''

    c = c[:start_idx] + new_section + c[end_idx:]
    with open('src/components/Sales.tsx', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Sales updated successfully")

if __name__ == '__main__':
    update_purchases()
    update_sales()
