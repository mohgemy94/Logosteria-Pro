sed -i '/^    <\/div>$/i \
      {/* Account Ledger Movement Detail Modal */}\
      {selectedLedgerAccount && (\
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs print:hidden overflow-y-auto">\
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-none sm:max-h-[85vh] flex flex-col sm:overflow-hidden overflow-y-auto my-auto">\
            {/* Modal Header */}\
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between static sm:sticky sm:top-0 z-10">\
              <div className="flex items-center gap-2.5">\
                <div className="p-1.5 bg-blue-600 rounded-lg">\
                  <BookOpen size={18} />\
                </div>\
                <div>\
                  <h3 className="font-bold text-sm sm:text-base">\
                    كشف حركة الحساب: <span className="text-blue-300 font-mono">{selectedLedgerAccount.account.code}</span> - {selectedLedgerAccount.account.name}\
                  </h3>\
                  <p className="text-[11px] text-slate-400">\
                    تصنيف الحساب: {getAccountTypeLabel(selectedLedgerAccount.account.type)}\
                  </p>\
                </div>\
              </div>\
              <button\
                type="button"\
                onClick={() => setSelectedLedgerAccount(null)}\
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"\
              >\
                <X size={18} />\
              </button>\
            </div>\
\
            {/* Account Summary Strip */}\
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 border-b border-slate-200 text-xs">\
              <div className="p-2 bg-white rounded-xl border border-slate-200">\
                <span className="text-slate-500 block text-[10px] font-bold">إجمالي حركة المدين</span>\
                <span className="font-mono font-black text-slate-900">\
                  {selectedLedgerAccount.debitMovement.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}\
                </span>\
              </div>\
              <div className="p-2 bg-white rounded-xl border border-slate-200">\
                <span className="text-slate-500 block text-[10px] font-bold">إجمالي حركة الدائن</span>\
                <span className="font-mono font-black text-slate-900">\
                  {selectedLedgerAccount.creditMovement.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}\
                </span>\
              </div>\
              <div className="p-2 bg-white rounded-xl border border-slate-200">\
                <span className="text-slate-500 block text-[10px] font-bold">صافي الرصيد النهائي</span>\
                <span className={`font-mono font-black ${selectedLedgerAccount.netMovement >= 0 ? "text-emerald-700" : "text-purple-700"}`}>\
                  {Math.abs(selectedLedgerAccount.netMovement).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}\
                </span>\
              </div>\
              <div className="p-2 bg-white rounded-xl border border-slate-200">\
                <span className="text-slate-500 block text-[10px] font-bold">طبيعة الرصيد</span>\
                <span className="font-bold text-slate-800">\
                  {selectedLedgerAccount.netMovement > 0 ? "مدين (Debit)" : selectedLedgerAccount.netMovement < 0 ? "دائن (Credit)" : "متوازن (Zero)"}\
                </span>\
              </div>\
            </div>\
\
            {/* Ledger Movements Table */}\
            <div className="flex-1 overflow-y-auto p-4">\
              {selectedLedgerItems.length === 0 ? (\
                <div className="py-12 text-center text-slate-400">\
                  <p className="font-bold text-sm">لا توجد تفاصيل حركات مسجلة لهذا الحساب خلال الفترة المحددة</p>\
                </div>\
              ) : (\
                <table className="w-full text-right border-collapse text-xs">\
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">\
                    <tr>\
                      <th className="py-2 px-3 border-b border-slate-200 w-24">التاريخ</th>\
                      <th className="py-2 px-3 border-b border-slate-200 w-28">رقم القيد</th>\
                      <th className="py-2 px-3 border-b border-slate-200 w-28">مصدر الحركة</th>\
                      <th className="py-2 px-3 border-b border-slate-200">البيان / الوصف</th>\
                      <th className="py-2 px-3 border-b border-slate-200 text-left w-28 text-blue-700">مدين</th>\
                      <th className="py-2 px-3 border-b border-slate-200 text-left w-28 text-purple-700">دائن</th>\
                      <th className="py-2 px-3 border-b border-slate-200 text-left w-28">الرصيد التراكمي</th>\
                      <th className="py-2 px-3 border-b border-slate-200 text-center w-24">الشاشة المصدر</th>\
                    </tr>\
                  </thead>\
                  <tbody className="divide-y divide-slate-100">\
                    {selectedLedgerItems.map((item) => {\
                      const getSourceBadge = (source?: string) => {\
                        if (source === "SALES_INVOICE" || source === "فواتير المبيعات" || item.source === "SALES") {\
                          return { label: item.sourceLabel || "فاتورة مبيعات", view: "sales", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };\
                        }\
                        if (source === "PURCHASE_INVOICE" || source === "فواتير المشتريات" || item.source === "PURCHASE") {\
                          return { label: item.sourceLabel || "فاتورة مشتريات", view: "purchases", color: "bg-rose-50 text-rose-700 border-rose-200" };\
                        }\
                        switch (source) {\
                          case "EXTERNAL_RECEIPT":\
                            return { label: "سند قبض عميل", view: "externalReceipt", color: "bg-blue-50 text-blue-700 border-blue-200" };\
                          case "EXTERNAL_PAYMENT":\
                            return { label: "سند صرف مورد", view: "externalPayment", color: "bg-amber-50 text-amber-700 border-amber-200" };\
                          case "INTERNAL_RECEIPT":\
                            return { label: "قبض داخلي", view: "internalReceipt", color: "bg-indigo-50 text-indigo-700 border-indigo-200" };\
                          case "INTERNAL_PAYMENT":\
                            return { label: "صرف داخلي", view: "internalPayment", color: "bg-orange-50 text-orange-700 border-orange-200" };\
                          case "INVENTORY_AUDIT":\
                            return { label: "تسوية جرد", view: "inventoryCount", color: "bg-purple-50 text-purple-700 border-purple-200" };\
                          case "PAYROLL":\
                            return { label: "مسير رواتب", view: "payroll", color: "bg-teal-50 text-teal-700 border-teal-200" };\
                          case "MANUFACTURING":\
                            return { label: "أمر تصنيع", view: "manufacturing", color: "bg-cyan-50 text-cyan-700 border-cyan-200" };\
                          default:\
                            return { label: "قيد يومية عام", view: "journal", color: "bg-slate-100 text-slate-700 border-slate-200" };\
                        }\
                      };\
                      const src = getSourceBadge(item.sourceModule);\
                      return (\
                        <tr key={item.id} className="hover:bg-slate-50">\
                          <td className="py-2 px-3 font-mono text-slate-600">{item.date}</td>\
                          <td className="py-2 px-3 font-mono font-bold text-blue-700">{item.entryNumber}</td>\
                          <td className="py-2 px-3">\
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${src.color}`}>\
                              {src.label}\
                            </span>\
                          </td>\
                          <td className="py-2 px-3 text-slate-800 font-medium">{item.description}</td>\
                          <td className="py-2 px-3 font-mono font-bold text-left text-blue-700">\
                            {item.debit > 0 ? item.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}\
                          </td>\
                          <td className="py-2 px-3 font-mono font-bold text-left text-purple-700">\
                            {item.credit > 0 ? item.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}\
                          </td>\
                          <td className="py-2 px-3 font-mono font-bold text-left text-slate-900">\
                            {item.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}\
                            <span className="text-[10px] text-slate-400 mr-1">\
                              ({item.balanceType === "DEBIT" ? "مدين" : item.balanceType === "CREDIT" ? "دائن" : "-"})\
                            </span>\
                          </td>\
                          <td className="py-2 px-3 text-center">\
                            <button\
                              type="button"\
                              onClick={() => {\
                                setSelectedLedgerAccount(null);\
                                if (onNavigate) onNavigate(src.view);\
                              }}\
                              className="px-2 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 rounded-md text-[10px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"\
                              title={`الانتقال إلى شاشة ${src.label}`}\
                            >\
                              <span>فتح</span>\
                              <ExternalLink size={10} />\
                            </button>\
                          </td>\
                        </tr>\
                      );\
                    })}\
                  </tbody>\
                </table>\
              )}\
            </div>\
            {/* Modal Footer */}\
            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end">\
              <button\
                type="button"\
                onClick={() => setSelectedLedgerAccount(null)}\
                className="px-4 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-colors cursor-pointer"\
              >\
                إغلاق\
              </button>\
            </div>\
          </div>\
        </div>\
      )}' src/components/FinancialReportsScreen.tsx
