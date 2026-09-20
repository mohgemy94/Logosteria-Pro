sed -i '270a \
            {/* 3. Financial Ratios Indicator Card */}\
            <div \
              onClick={() => setSelectedReport("RATIOS")}\
              className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 rounded-[2rem] p-6 sm:p-8 cursor-pointer group hover:-translate-y-1 transition-all duration-300 relative overflow-hidden border border-slate-700 hover:border-fuchsia-500/30 hover:shadow-2xl hover:shadow-fuchsia-500/20"\
            >\
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl group-hover:bg-fuchsia-500/20 transition-all duration-500"></div>\
              <div className="relative z-10 flex flex-col h-full">\
                <div className="flex items-center justify-between mb-8">\
                  <div className="w-14 h-14 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center border border-fuchsia-500/20 group-hover:scale-110 transition-transform duration-300">\
                    <Activity size={28} className="text-fuchsia-400" />\
                  </div>\
                  <div className="bg-slate-800/80 px-4 py-1.5 rounded-full border border-slate-700 backdrop-blur-sm">\
                    <span className="text-xs font-bold text-slate-300 tracking-wide">النسب المالية</span>\
                  </div>\
                </div>\
                <div className="flex-1">\
                  <h3 className="text-2xl font-black text-white mb-2 tracking-tight group-hover:text-fuchsia-50 transition-colors">المؤشرات والنسب المالية</h3>\
                  <p className="text-slate-400 text-sm font-medium leading-relaxed">\
                    تحليل الأداء المالي، معدلات الربحية، ونسب السيولة\
                  </p>\
                </div>\
                <div className="mt-8 pt-6 border-t border-slate-700/50">\
                  <div className="flex items-center justify-between">\
                    <div>\
                      <div className="text-[11px] font-black text-slate-500 mb-1 uppercase tracking-wider">هامش صافي الربح</div>\
                      <div className="text-xl sm:text-2xl font-mono font-black tracking-tight text-fuchsia-400">\
                        {netProfitMargin.toFixed(1)} <span className="text-sm font-bold text-slate-500">%</span>\
                      </div>\
                    </div>\
                    <div className="px-3 py-1.5 rounded-lg text-xs font-black border bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20">\
                      مؤشر الأداء\
                    </div>\
                  </div>\
                </div>\
                <div className="mt-6 flex items-center justify-end text-fuchsia-400 text-sm font-bold gap-1 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-4 group-hover:translate-x-0 duration-300">\
                  <span>عرض المؤشرات</span>\
                  <ChevronLeft size={16} />\
                </div>\
              </div>\
            </div>' src/components/FinancialReportsScreen.tsx
