sed -i '584a \
              {selectedReport === "RATIOS" && (\
                <div className="max-w-5xl mx-auto">\
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">\
                    \
                    {/* Net Profit Margin */}\
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">\
                      <div className="flex justify-between items-start mb-4">\
                        <div>\
                          <p className="text-slate-500 text-xs font-bold mb-1">هامش صافي الربح</p>\
                          <h4 className="text-2xl font-black text-slate-800">{netProfitMargin.toFixed(1)}%</h4>\
                        </div>\
                        <div className={`p-2 rounded-xl ${netProfitMargin >= 10 ? "bg-emerald-100 text-emerald-600" : netProfitMargin > 0 ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"}`}>\
                          <Percent size={20} />\
                        </div>\
                      </div>\
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">\
                        <div className={`h-1.5 rounded-full ${netProfitMargin >= 10 ? "bg-emerald-500" : netProfitMargin > 0 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${Math.min(Math.max(netProfitMargin, 0), 100)}%` }}></div>\
                      </div>\
                      <p className="text-[10px] text-slate-400 font-medium">\
                        المثالي: > 10% | يمثل نسبة الأرباح الصافية من إجمالي الإيرادات\
                      </p>\
                    </div>\
\
                    {/* Gross Profit Margin */}\
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">\
                      <div className="flex justify-between items-start mb-4">\
                        <div>\
                          <p className="text-slate-500 text-xs font-bold mb-1">هامش مجمل الربح</p>\
                          <h4 className="text-2xl font-black text-slate-800">{grossProfitMargin.toFixed(1)}%</h4>\
                        </div>\
                        <div className={`p-2 rounded-xl ${grossProfitMargin >= 20 ? "bg-emerald-100 text-emerald-600" : grossProfitMargin > 0 ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"}`}>\
                          <TrendingUp size={20} />\
                        </div>\
                      </div>\
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">\
                        <div className={`h-1.5 rounded-full ${grossProfitMargin >= 20 ? "bg-emerald-500" : grossProfitMargin > 0 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${Math.min(Math.max(grossProfitMargin, 0), 100)}%` }}></div>\
                      </div>\
                      <p className="text-[10px] text-slate-400 font-medium">\
                        مدى الكفاءة في تسعير المنتجات والتحكم في تكلفة المبيعات\
                      </p>\
                    </div>\
\
                    {/* Current Ratio */}\
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">\
                      <div className="flex justify-between items-start mb-4">\
                        <div>\
                          <p className="text-slate-500 text-xs font-bold mb-1">نسبة التداول (السيولة)</p>\
                          <h4 className="text-2xl font-black text-slate-800">{currentRatio === Infinity ? "ممتاز" : currentRatio.toFixed(2)}</h4>\
                        </div>\
                        <div className={`p-2 rounded-xl ${currentRatio >= 1.5 || currentRatio === Infinity ? "bg-blue-100 text-blue-600" : currentRatio >= 1.0 ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"}`}>\
                          <Activity size={20} />\
                        </div>\
                      </div>\
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">\
                        <div className={`h-1.5 rounded-full ${currentRatio >= 1.5 || currentRatio === Infinity ? "bg-blue-500" : currentRatio >= 1.0 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${Math.min(currentRatio === Infinity ? 100 : (currentRatio / 3) * 100, 100)}%` }}></div>\
                      </div>\
                      <p className="text-[10px] text-slate-400 font-medium">\
                        المثالي: 1.5 إلى 2 | قدرة الشركة على سداد التزاماتها قصيرة الأجل\
                      </p>\
                    </div>\
\
                    {/* Debt Ratio */}\
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">\
                      <div className="flex justify-between items-start mb-4">\
                        <div>\
                          <p className="text-slate-500 text-xs font-bold mb-1">نسبة المديونية</p>\
                          <h4 className="text-2xl font-black text-slate-800">{debtRatio.toFixed(1)}%</h4>\
                        </div>\
                        <div className={`p-2 rounded-xl ${debtRatio <= 40 ? "bg-emerald-100 text-emerald-600" : debtRatio <= 60 ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"}`}>\
                          <Scale size={20} />\
                        </div>\
                      </div>\
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">\
                        <div className={`h-1.5 rounded-full ${debtRatio <= 40 ? "bg-emerald-500" : debtRatio <= 60 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${Math.min(Math.max(debtRatio, 0), 100)}%` }}></div>\
                      </div>\
                      <p className="text-[10px] text-slate-400 font-medium">\
                        المثالي: < 50% | نسبة تمويل الأصول عن طريق الديون\
                      </p>\
                    </div>\
\
                    {/* Return on Equity (ROE) */}\
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">\
                      <div className="flex justify-between items-start mb-4">\
                        <div>\
                          <p className="text-slate-500 text-xs font-bold mb-1">العائد على حقوق الملكية</p>\
                          <h4 className="text-2xl font-black text-slate-800">{roe.toFixed(1)}%</h4>\
                        </div>\
                        <div className={`p-2 rounded-xl ${roe >= 15 ? "bg-emerald-100 text-emerald-600" : roe > 0 ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"}`}>\
                          <Target size={20} />\
                        </div>\
                      </div>\
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">\
                        <div className={`h-1.5 rounded-full ${roe >= 15 ? "bg-emerald-500" : roe > 0 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${Math.min(Math.max(roe, 0), 100)}%` }}></div>\
                      </div>\
                      <p className="text-[10px] text-slate-400 font-medium">\
                        المثالي: > 15% | كفاءة الشركة في توليد أرباح من استثمارات الملاك\
                      </p>\
                    </div>\
\
                  </div>\
\
                  {/* Detailed Explanation Section */}\
                  <div className="mt-8 bg-blue-50/50 rounded-2xl p-6 border border-blue-100">\
                    <h3 className="text-blue-900 font-black mb-4 flex items-center gap-2">\
                      <Activity size={18} />\
                      قراءة تحليلية سريعة\
                    </h3>\
                    <ul className="space-y-3 text-sm text-blue-800 font-medium">\
                      <li className="flex items-start gap-2">\
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></span>\
                        {netProfitMargin >= 10 ? "هامش الربح ممتاز، مما يدل على كفاءة عالية في إدارة التكاليف التشغيلية." : netProfitMargin > 0 ? "الشركة تحقق أرباحاً، لكن يُنصح بمراجعة التكاليف لتحسين الهامش." : "الشركة تحقق خسائر، هناك حاجة ماسة لخفض التكاليف أو زيادة الإيرادات."}\
                      </li>\
                      <li className="flex items-start gap-2">\
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></span>\
                        {currentRatio >= 1.5 || currentRatio === Infinity ? "مستوى السيولة آمن جداً، الشركة قادرة على الوفاء بالتزاماتها بسهولة." : currentRatio >= 1 ? "السيولة مقبولة، لكن يجب الحذر في إدارة النقدية." : "يوجد خطر نقص سيولة محتمل للوفاء بالالتزامات قصيرة الأجل."}\
                      </li>\
                      <li className="flex items-start gap-2">\
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></span>\
                        {debtRatio > 60 ? "نسبة المديونية مرتفعة، مما قد يشكل مخاطرة مالية في حالة تقلب الإيرادات." : "هيكل رأس المال متوازن ولا يوجد اعتماد مفرط على الديون."}\
                      </li>\
                    </ul>\
                  </div>\
                </div>\
              )}' src/components/FinancialReportsScreen.tsx
