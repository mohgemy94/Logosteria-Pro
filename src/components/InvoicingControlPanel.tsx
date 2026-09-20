import { useState } from 'react';
import { Receipt, Sliders, ShieldAlert, AlertTriangle, Hash, Store, Package } from 'lucide-react';
import { SystemSettings, CreditAndStockControlSettings } from '../types/accounting';
import { SequencesStore } from '../utils/sequences';

interface InvoicingControlPanelProps {
  settings: SystemSettings;
  seqs: SequencesStore;
  onTaxChange: (field: keyof SystemSettings['taxAndInvoice'], value: any) => void;
  onInvoiceDefaultsChange: (field: string, value: string) => void;
  onControlLimitsChange: (control: CreditAndStockControlSettings) => void;
}

export default function InvoicingControlPanel({
  settings,
  seqs,
  onTaxChange,
  onInvoiceDefaultsChange,
  onControlLimitsChange,
}: InvoicingControlPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'taxes_seq' | 'defaults' | 'credit_stock'>('taxes_seq');

  const controlLimits = settings.controlAndLimits || {
    enforceCreditLimit: true,
    creditLimitAction: 'WARN',
    preventNegativeStock: true,
    warnLowStock: true,
    lowStockThreshold: 5,
  };

  const handleLimitFieldChange = <K extends keyof CreditAndStockControlSettings>(
    field: K,
    val: CreditAndStockControlSettings[K]
  ) => {
    onControlLimitsChange({
      ...controlLimits,
      [field]: val,
    });
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Sub tabs navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveSubTab('taxes_seq')}
          className={`btn-3d px-4 py-2 text-xs font-bold flex items-center gap-2 ${
            activeSubTab === 'taxes_seq'
              ? 'btn-3d-emerald'
              : 'btn-3d-white text-slate-700'
          }`}
        >
          <Receipt size={15} />
          الضرائب وترقيم المستندات (ZATCA & Sequences)
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('defaults')}
          className={`btn-3d px-4 py-2 text-xs font-bold flex items-center gap-2 ${
            activeSubTab === 'defaults'
              ? 'btn-3d-indigo'
              : 'btn-3d-white text-slate-700'
          }`}
        >
          <Sliders size={15} />
          القيم الافتراضية للفواتير
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('credit_stock')}
          className={`btn-3d px-4 py-2 text-xs font-bold flex items-center gap-2 ${
            activeSubTab === 'credit_stock'
              ? 'btn-3d-amber'
              : 'btn-3d-white text-slate-700'
          }`}
        >
          <ShieldAlert size={15} />
          الرقابة على الائتمان والمخزون
        </button>
      </div>

      {/* SUB-TAB 1: TAXES & SEQUENCES */}
      {activeSubTab === 'taxes_seq' && (
        <div className="space-y-6 animate-in fade-in">
          {/* VAT & ZATCA */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h4 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Receipt size={16} className="text-emerald-600" />
              إعدادات ضريبة القيمة المضافة وهيئة الزكاة (ZATCA)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="text-xs font-bold text-slate-800">تفعيل ضريبة القيمة المضافة (VAT)</p>
                  <p className="text-[11px] text-slate-500">حساب الضريبة تلقائياً على فواتير المبيعات والمشتريات</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.taxAndInvoice.enableVat}
                  onChange={e => onTaxChange('enableVat', e.target.checked)}
                  className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نسبة الضريبة الافتراضية (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.taxAndInvoice.defaultVatRate}
                    onChange={e => onTaxChange('defaultVatRate', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-bold font-mono"
                  />
                  <span className="text-xs font-bold text-slate-500">%</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 md:col-span-2">
                <div>
                  <p className="text-xs font-bold text-slate-800">توليد رمز الاستجابة السريعة (ZATCA QR Code)</p>
                  <p className="text-[11px] text-slate-500">تضمين رمز QR المشفر المتوافق مع متطلبات المرحلة الأولى لهيئة الزكاة والضريبة والجمارك</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.taxAndInvoice.enableQrCode}
                  onChange={e => onTaxChange('enableQrCode', e.target.checked)}
                  className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Sequences */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h4 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Hash size={16} className="text-indigo-600" />
              بادئات الترقيم والتسلسل الرقمي التلقائي
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Sales Invoice */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 mb-1">فواتير المبيعات</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="INV-"
                    value={settings.taxAndInvoice.salesPrefix}
                    onChange={e => onTaxChange('salesPrefix', e.target.value)}
                    className="w-24 px-2 py-1 text-xs bg-white border border-slate-300 rounded font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">التالي: {seqs.salesInvoice || 1}</span>
                </div>
              </div>

              {/* Purchase Invoice */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 mb-1">فواتير المشتريات</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="PO-"
                    value={settings.taxAndInvoice.purchasePrefix}
                    onChange={e => onTaxChange('purchasePrefix', e.target.value)}
                    className="w-24 px-2 py-1 text-xs bg-white border border-slate-300 rounded font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">التالي: {seqs.purchaseInvoice || 1}</span>
                </div>
              </div>

              {/* Journal Entries */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 mb-1">القيود اليومية</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="JV-"
                    value={settings.taxAndInvoice.journalPrefix}
                    onChange={e => onTaxChange('journalPrefix', e.target.value)}
                    className="w-24 px-2 py-1 text-xs bg-white border border-slate-300 rounded font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">التالي: {seqs.internalVoucher || 1}</span>
                </div>
              </div>

              {/* Receipt Vouchers */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 mb-1">سندات القبض</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="RV-"
                    value={settings.taxAndInvoice.receiptVoucherPrefix}
                    onChange={e => onTaxChange('receiptVoucherPrefix', e.target.value)}
                    className="w-24 px-2 py-1 text-xs bg-white border border-slate-300 rounded font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">التالي: {seqs.receiptVoucher || 1}</span>
                </div>
              </div>

              {/* Payment Vouchers */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 mb-1">سندات الصرف</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="PV-"
                    value={settings.taxAndInvoice.paymentVoucherPrefix}
                    onChange={e => onTaxChange('paymentVoucherPrefix', e.target.value)}
                    className="w-24 px-2 py-1 text-xs bg-white border border-slate-300 rounded font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">التالي: {seqs.paymentVoucher || 1}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: INVOICE DEFAULTS */}
      {activeSubTab === 'defaults' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Sales Defaults */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h4 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Store size={16} className="text-blue-600" />
              القيم الافتراضية لفواتير المبيعات
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع المعاملة الافتراضي</label>
                <select
                  value={settings.invoiceDefaults?.salesTransactionType || 'CREDIT_SALES'}
                  onChange={e => onInvoiceDefaultsChange('salesTransactionType', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-bold"
                >
                  <option value="CREDIT_SALES">مبيعات آجلة (ذمم عملاء)</option>
                  <option value="CASH_SALES">مبيعات نقدية (كاش فوري)</option>
                  <option value="PARTIAL_SALES">مبيعات جزئية (دفعة ومؤجل)</option>
                  <option value="QUOTATION">عرض أسعار مبدئي</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المستودع الافتراضي للصرف</label>
                <select
                  value={settings.invoiceDefaults?.salesWarehouse || 'MAIN_WAREHOUSE'}
                  onChange={e => onInvoiceDefaultsChange('salesWarehouse', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-bold"
                >
                  <option value="MAIN_WAREHOUSE">المستودع الرئيسي (المركزي)</option>
                  <option value="SHOWROOM">معرض المبيعات</option>
                  <option value="BRANCH_1">مستودع فرع الرياض</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">خزنة / حساب التحصيل الافتراضي</label>
                <select
                  value={settings.invoiceDefaults?.salesSafe || 'MAIN_SAFE'}
                  onChange={e => onInvoiceDefaultsChange('salesSafe', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-bold"
                >
                  <option value="MAIN_SAFE">الصندوق الرئيسي (كاش)</option>
                  <option value="BANK_AHLI">حساب البنك الأهلي التجاري</option>
                  <option value="BANK_RAJHI">حساب مصرف الراجحي</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع الخدمة / التصنيف الافتراضي</label>
                <input
                  type="text"
                  placeholder="مثال: مبيعات سلع تجارية"
                  value={settings.invoiceDefaults?.salesServiceType || ''}
                  onChange={e => onInvoiceDefaultsChange('salesServiceType', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Purchases Defaults */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h4 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Package size={16} className="text-indigo-600" />
              القيم الافتراضية لفواتير المشتريات
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع معاملة الشراء الافتراضي</label>
                <select
                  value={settings.invoiceDefaults?.purchasesTransactionType || 'CREDIT_PURCHASE'}
                  onChange={e => onInvoiceDefaultsChange('purchasesTransactionType', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-bold"
                >
                  <option value="CREDIT_PURCHASE">مشتريات آجلة (ذمم موردين)</option>
                  <option value="CASH_PURCHASE">مشتريات نقدية (سداد فوري)</option>
                  <option value="PARTIAL_PURCHASE">مشتريات جزئية</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">مستودع الاستلام والتخزين الافتراضي</label>
                <select
                  value={settings.invoiceDefaults?.purchasesWarehouse || 'MAIN_WAREHOUSE'}
                  onChange={e => onInvoiceDefaultsChange('purchasesWarehouse', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-bold"
                >
                  <option value="MAIN_WAREHOUSE">المستودع الرئيسي (المركزي)</option>
                  <option value="SHOWROOM">معرض المبيعات</option>
                  <option value="BRANCH_1">مستودع فرع الرياض</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: CREDIT & STOCK LIMITS */}
      {activeSubTab === 'credit_stock' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h4 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <ShieldAlert size={16} className="text-amber-600" />
              الرقابة على الحد الائتماني للعملاء
            </h4>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="text-xs font-bold text-slate-800">تفعيل فحص الحد الائتماني للعميل عند إصدار الفاتورة</p>
                  <p className="text-[11px] text-slate-500">
                    التحقق من عدم تجاوز إجمالي المديونية الحالية + قيمة الفاتورة للحد الائتماني المحدد في بطاقة العميل
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={controlLimits.enforceCreditLimit}
                  onChange={e => handleLimitFieldChange('enforceCreditLimit', e.target.checked)}
                  className="w-5 h-5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                />
              </div>

              {controlLimits.enforceCreditLimit && (
                <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200">
                  <label className="block text-xs font-bold text-amber-950 mb-2">الإجراء عند تجاوز العميل للحد الائتماني:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2.5 p-3 bg-white rounded-lg border border-amber-300 cursor-pointer">
                      <input
                        type="radio"
                        name="creditAction"
                        value="BLOCK"
                        checked={controlLimits.creditLimitAction === 'BLOCK'}
                        onChange={() => handleLimitFieldChange('creditLimitAction', 'BLOCK')}
                        className="text-amber-600"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">حظر ومنع الحفظ (Strict Block)</p>
                        <p className="text-[10px] text-slate-500">منع إصدار أو ترحيل الفاتورة حتى سداد جزء من المديونية</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 p-3 bg-white rounded-lg border border-amber-300 cursor-pointer">
                      <input
                        type="radio"
                        name="creditAction"
                        value="WARN"
                        checked={controlLimits.creditLimitAction === 'WARN'}
                        onChange={() => handleLimitFieldChange('creditLimitAction', 'WARN')}
                        className="text-amber-600"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">إظهار تنبيه تحذيري فقط (Warning)</p>
                        <p className="text-[10px] text-slate-500">تنبيه البائع بالسماح بالإصدار مع إشعار بالمديونية</p>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h4 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <AlertTriangle size={16} className="text-rose-600" />
              الرقابة على رصيد المخزون ومنع البيع بالسالب
            </h4>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="text-xs font-bold text-slate-800">منع البيع بالسالب (Prevent Negative Stock)</p>
                  <p className="text-[11px] text-slate-500">
                    حظر صرف أي كميات تزيد عن الرصيد الفعلي المتوفر في المستودع المحدد
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={controlLimits.preventNegativeStock}
                  onChange={e => handleLimitFieldChange('preventNegativeStock', e.target.checked)}
                  className="w-5 h-5 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="text-xs font-bold text-slate-800">تنبيهات حد الطلب والمخزون المنخفض (Reorder Alerts)</p>
                  <p className="text-[11px] text-slate-500">
                    إظهار علامة تحذيرية في شاشات البيع والمخازن عند وصول رصيد الصنف للحد الأدنى
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={controlLimits.warnLowStock}
                  onChange={e => handleLimitFieldChange('warnLowStock', e.target.checked)}
                  className="w-5 h-5 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                />
              </div>

              {controlLimits.warnLowStock && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">الحد الافتراضي الأدنى للرصيد المنخفض (قطع):</label>
                  <input
                    type="number"
                    min="1"
                    value={controlLimits.lowStockThreshold}
                    onChange={e => handleLimitFieldChange('lowStockThreshold', parseInt(e.target.value) || 1)}
                    className="w-24 px-3 py-1 text-xs bg-white border border-slate-300 rounded font-mono font-bold text-center"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
