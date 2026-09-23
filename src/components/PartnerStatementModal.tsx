import { useState, useMemo, useEffect } from 'react';
import { 
  X, Eye, FileText,
  Building2, ShieldCheck, CheckCircle2, RotateCcw
} from 'lucide-react';
import { Partner } from '../types/accounting';
import { getPartnerAccountStatement, PartnerStatement, setVoucherPostingStatus, PartnerLedgerTx } from '../utils/partnerLedger';
import PrintPreviewModal, { PrintPreviewData } from './PrintPreviewModal';
import { mobileNavigationController } from '../utils/mobileNavigation';
import { useSystemCurrency } from '../utils/currency';
import ExportButtonGroup from './ExportButtonGroup';

interface PartnerStatementModalProps {
  partner: Partner | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PartnerStatementModal({
  partner,
  isOpen,
  onClose
}: PartnerStatementModalProps) {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INVOICES' | 'VOUCHERS'>('ALL');
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const handleUpdate = () => {
      setRefreshTrigger(prev => prev + 1);
    };
    window.addEventListener('partnerLedgerUpdated', handleUpdate);
    return () => window.removeEventListener('partnerLedgerUpdated', handleUpdate);
  }, []);

  // Hardware & gesture back button on mobile closes statement modal first
  useEffect(() => {
    if (!isOpen || !partner) return;
    const modalId = `modal-partner-statement-${partner.id}`;
    const unregister = mobileNavigationController.registerModal(modalId, () => {
      onClose();
    });
    return () => unregister();
  }, [isOpen, partner, onClose]);

  const statement: PartnerStatement | null = useMemo(() => {
    if (!partner) return null;
    return getPartnerAccountStatement(partner);
  }, [partner, refreshTrigger]);

  const handleToggleVoucherPosting = (tx: PartnerLedgerTx) => {
    if (!tx.rawDoc || !partner) return;
    const v = tx.rawDoc;
    const isPosted = tx.status === 'POSTED' || !tx.status;
    const targetStatus = isPosted ? 'DRAFT' : 'POSTED';

    if (isPosted) {
      if (!confirm(`هل أنت متأكد من رغبتك في إلغاء ترحيل ${tx.docTypeLabel} رقم (${tx.docNumber}) وإعادته كمسودة؟\n\n⚠️ سيتم إلغاء تأثيره المالي فوراً من كشف حساب (${partner.name}) وتحديث الرصيد.`)) {
        return;
      }
    }

    const res = setVoucherPostingStatus(v.id, v.type, targetStatus);
    if (res.success) {
      setRefreshTrigger(prev => prev + 1);
      if (targetStatus === 'DRAFT') {
        alert(`📝 تم إلغاء ترحيل السند (${tx.docNumber}) بنجاح وإعادته كمسودة (غير مرحل). تم إيقاف أثره في كشف الحساب.`);
      } else {
        alert(`✅ تم ترحيل السند (${tx.docNumber}) بنجاح وتحديث كشف الحساب.`);
      }
    }
  };

  const filteredTransactions = useMemo(() => {
    if (!statement) return [];
    return statement.transactions.filter(tx => {
      if (dateFrom && tx.date < dateFrom) return false;
      if (dateTo && tx.date > dateTo) return false;
      if (typeFilter === 'INVOICES') {
        return tx.type === 'SALES_INVOICE' || tx.type === 'PURCHASE_INVOICE';
      }
      if (typeFilter === 'VOUCHERS') {
        return tx.type === 'RECEIPT_VOUCHER' || tx.type === 'PAYMENT_VOUCHER';
      }
      return true;
    });
  }, [statement, dateFrom, dateTo, typeFilter]);

  if (!isOpen || !partner || !statement) return null;

  const isCustomer = partner.type === 'CUSTOMER';

  const previewData: PrintPreviewData = {
    title: `كشف حساب ${isCustomer ? 'عميل' : 'مورد'} تفصيلي ومطابقة أرصدة`,
    subtitle: `بيان بحركات الفواتير وسندات القبض والصرف - ${partner.name}`,
    docNumber: `STMT-${partner.id.toUpperCase()}-${new Date().getFullYear()}`,
    date: new Date().toISOString().split('T')[0] as string,
    partnerName: partner.name,
    partnerType: partner.type,
    partnerTaxNo: partner.taxNumber,
    paymentMethod: `الرصيد الصافي: ${statement.balanceFormatted} ${currencySymbol} (${statement.balanceLabel})`,
    notes: `الرصيد الافتتاحي: ${Math.abs(statement.openingBalance).toLocaleString()} ${currencySymbol} | إجمالي المسحوبات/الفواتير: ${statement.totalWithdrawals.toLocaleString()} ${currencySymbol} | إجمالي المقبوضات/المدفوعات: ${statement.totalPayments.toLocaleString()} ${currencySymbol}`,
    subtotal: statement.totalWithdrawals,
    taxTotal: 0,
    grandTotal: statement.netBalance,
    paidAmount: statement.totalPayments,
    remainingAmount: statement.netBalance,
    items: filteredTransactions.map(tx => ({
      description: `[${tx.date}] ${tx.docTypeLabel} (${tx.docNumber}) - ${tx.description}`,
      quantity: 1,
      unitPrice: tx.debit > 0 ? tx.debit : tx.credit,
      taxRate: 0,
      total: tx.debit > 0 ? tx.debit : -tx.credit
    }))
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] md:max-h-[90vh] animate-modalIn text-right"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Mobile Handle */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header (Fixed) */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-3.5 sm:p-5 flex items-center justify-between gap-3 shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border shadow-sm shrink-0 ${
              isCustomer 
                ? 'bg-blue-600/30 text-blue-300 border-blue-500/40' 
                : 'bg-purple-600/30 text-purple-300 border-purple-500/40'
            }`}>
              {isCustomer ? <Building2 size={22} /> : <FileText size={22} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base md:text-lg text-white truncate">كشف حساب مالي تفصيلي ومطابقة أرصدة</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${
                  isCustomer 
                    ? 'bg-blue-500/20 text-blue-300 border-blue-400/40' 
                    : 'bg-purple-500/20 text-purple-300 border-purple-400/40'
                }`}>
                  {isCustomer ? 'حساب عميل' : 'حساب مورد'}
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-300 mt-0.5 flex-wrap truncate">
                <span className="font-bold text-white truncate">{partner.name}</span>
                {partner.taxNumber && <span className="hidden sm:inline">الرقم الضريبي: {partner.taxNumber}</span>}
                {partner.phone && <span className="hidden xs:inline">الهاتف: {partner.phone}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowPrintPreview(true)}
              className="btn-3d btn-3d-indigo px-3 py-1.5 text-xs font-black hover:scale-105 active:scale-95 transition-all"
              title="معاينة كشف الحساب والطباعة الرسمية"
            >
              <Eye size={14} /> <span className="hidden sm:inline">معاينة وطباعة</span>
            </button>
            <div className="hidden sm:block">
              <ExportButtonGroup
                title={`كشف حساب تفصيلي - ${partner.name}`}
                filename={`كشف_حساب_${partner.name.replace(/\s+/g, '_')}`}
                headers={[
                  'التاريخ',
                  'نوع الحركة',
                  'رقم المستند',
                  'البيان',
                  'مدين (مسحوبات)',
                  'دائن (مدفوعات)',
                  'الرصيد التراكمي',
                  'حالة الرصيد'
                ]}
                rows={filteredTransactions.map(tx => [
                  tx.date,
                  tx.docTypeLabel,
                  tx.docNumber,
                  tx.description,
                  tx.debit,
                  tx.credit,
                  tx.runningBalance,
                  tx.runningBalanceType === 'DEBIT' ? 'مدين' : tx.runningBalanceType === 'CREDIT' ? 'دائن' : 'متزن'
                ])}
                filterSummary={`الطرف التجاري: ${partner.name} | الرقم الضريبي: ${partner.taxNumber || 'غير متوفر'} | الرصيد الحالي: ${statement.balanceFormatted} ${currencySymbol} (${statement.balanceLabel})`}
                size="xs"
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-800 text-slate-200 hover:text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
              title="إغلاق"
              aria-label="إغلاق"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-3 sm:p-5 overflow-y-auto flex flex-col gap-3 sm:gap-4 bg-slate-50/50 flex-1">
          
          {/* Quick Financial Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            
            {/* Opening Balance */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <span className="text-slate-400 font-medium">الرصيد الافتتاحي:</span>
              <span className="font-bold font-mono text-slate-800 text-sm sm:text-base mt-1">
                {Math.abs(statement.openingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                {statement.openingBalance > 0 ? 'مدين افتتاحي' : statement.openingBalance < 0 ? 'دائن افتتاحي' : 'بدون رصيد سابق'}
              </span>
            </div>

            {/* Total Invoices / Withdrawals */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <span className="text-blue-600 font-semibold flex items-center justify-between">
                <span>{isCustomer ? 'إجمالي المبيعات' : 'إجمالي المشتريات'}</span>
                <span className="font-mono bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded text-[10px]">
                  {isCustomer ? statement.totalSalesInvoices : statement.totalPurchaseInvoices} فاتورة
                </span>
              </span>
              <span className="font-bold font-mono text-blue-700 text-sm sm:text-base mt-1">
                {statement.totalWithdrawals.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                {isCustomer ? 'مسحوبات وفواتير صادرة' : 'توريدات وفواتير واردة'}
              </span>
            </div>

            {/* Total Payments / Receipts */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <span className="text-emerald-600 font-semibold flex items-center justify-between">
                <span>{isCustomer ? 'إجمالي المقبوضات' : 'إجمالي المدفوعات'}</span>
                <span className="font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded text-[10px]">
                  {isCustomer ? statement.totalReceiptVouchers : statement.totalPaymentVouchers} سند
                </span>
              </span>
              <span className="font-bold font-mono text-emerald-700 text-sm sm:text-base mt-1">
                {statement.totalPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                {isCustomer ? 'سندات قبض وسدادات نقدية' : 'سندات صرف وسدادات مسددة'}
              </span>
            </div>

            {/* Current Net Balance */}
            <div className={`p-3.5 rounded-xl border shadow-2xs flex flex-col justify-between ${
              statement.balanceType === 'DEBIT' 
                ? 'bg-emerald-50/70 border-emerald-300' 
                : statement.balanceType === 'CREDIT' 
                  ? 'bg-amber-50/70 border-amber-300' 
                  : 'bg-slate-100 border-slate-200'
            }`}>
              <span className="text-slate-600 font-bold text-[11px] flex items-center justify-between">
                <span>الرصيد الصافي المستحق:</span>
                <ShieldCheck size={14} className={statement.balanceType === 'DEBIT' ? 'text-emerald-600' : 'text-amber-600'} />
              </span>
              <span className={`font-bold font-mono text-base sm:text-lg mt-1 ${
                statement.balanceType === 'DEBIT' ? 'text-emerald-700' : statement.balanceType === 'CREDIT' ? 'text-amber-700' : 'text-slate-700'
              }`}>
                {statement.balanceFormatted} {currencySymbol}
              </span>
              <span className="text-[10px] font-bold text-slate-600 mt-0.5">
                {statement.balanceLabel}
              </span>
            </div>

          </div>

          {/* Filtering Bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-semibold">تصفية الحركات:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTypeFilter('ALL')}
                  className={`px-2.5 py-1 text-xs rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                    typeFilter === 'ALL' ? 'btn-3d btn-3d-blue text-white' : 'btn-3d btn-3d-white text-slate-600'
                  }`}
                >
                  كافة الحركات ({statement.transactions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('INVOICES')}
                  className={`px-2.5 py-1 text-xs rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                    typeFilter === 'INVOICES' ? 'btn-3d btn-3d-indigo text-white' : 'btn-3d btn-3d-white text-slate-600'
                  }`}
                >
                  الفواتير فقط ({statement.totalSalesInvoices + statement.totalPurchaseInvoices})
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('VOUCHERS')}
                  className={`px-2.5 py-1 text-xs rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                    typeFilter === 'VOUCHERS' ? 'btn-3d btn-3d-success text-white' : 'btn-3d btn-3d-white text-slate-600'
                  }`}
                >
                  السندات المالية فقط ({statement.totalReceiptVouchers + statement.totalPaymentVouchers})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-[11px]">من:</span>
                <input 
                  type="date" 
                  value={dateFrom} 
                  onChange={e => setDateFrom(e.target.value)} 
                  className="border border-slate-200 rounded px-2 py-1 bg-white text-xs text-slate-700 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-[11px]">إلى:</span>
                <input 
                  type="date" 
                  value={dateTo} 
                  onChange={e => setDateTo(e.target.value)} 
                  className="border border-slate-200 rounded px-2 py-1 bg-white text-xs text-slate-700 focus:outline-none focus:border-indigo-500"
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="btn-3d btn-3d-white px-2 py-1 text-[11px] text-indigo-700 font-semibold cursor-pointer hover:scale-105 active:scale-95 transition-all"
                  title="إلغاء تصفية التاريخ"
                >
                  إعادة ضبط
                </button>
              )}
            </div>
          </div>

          {/* Transactions Ledger Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="p-3 bg-slate-100/80 border-b border-slate-200 font-bold text-xs text-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-indigo-600" />
                <span>حركات دفتر الأستاذ والمطابقة المالية المترابطة</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                {filteredTransactions.length} حركة مسجلة
              </span>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-right text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600 border-b border-slate-200 z-10">
                  <tr>
                    <th className="p-3 text-right">التاريخ</th>
                    <th className="p-3 text-right">نوع الحركة</th>
                    <th className="p-3 text-right">رقم المستند</th>
                    <th className="p-3 text-right">البيان والتفاصيل</th>
                    <th className="p-3 text-left font-mono text-blue-700">مدين (مسحوبات)</th>
                    <th className="p-3 text-left font-mono text-emerald-700">دائن (سدادات)</th>
                    <th className="p-3 text-left font-mono text-slate-900">الرصيد التراكمي</th>
                    <th className="p-3 text-center">إجراءات السند</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-mono text-slate-600 whitespace-nowrap">{tx.date}</td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          tx.type === 'SALES_INVOICE' 
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : tx.type === 'PURCHASE_INVOICE'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : tx.type === 'RECEIPT_VOUCHER'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : tx.type === 'PAYMENT_VOUCHER'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}>
                          {tx.docTypeLabel}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">{tx.docNumber}</td>
                      <td className="p-3 text-slate-700 max-w-xs">{tx.description}</td>
                      <td className="p-3 text-left font-mono font-bold text-blue-700 whitespace-nowrap">
                        {tx.debit > 0 ? tx.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="p-3 text-left font-mono font-bold text-emerald-700 whitespace-nowrap">
                        {tx.credit > 0 ? tx.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="p-3 text-left font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span>{tx.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <span className="text-[10px] text-slate-400 mr-1 font-normal">
                          ({tx.runningBalanceType === 'DEBIT' ? 'مدين' : tx.runningBalanceType === 'CREDIT' ? 'دائن' : '0'})
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {(tx.type === 'RECEIPT_VOUCHER' || tx.type === 'PAYMENT_VOUCHER') && tx.rawDoc ? (
                          (tx.status === 'POSTED' || !tx.status) ? (
                            <button
                              type="button"
                              onClick={() => handleToggleVoucherPosting(tx)}
                              className="btn-3d btn-3d-warning px-2.5 py-1 text-[11px] font-black cursor-pointer hover:scale-105 active:scale-95 transition-all"
                              title="إلغاء ترحيل هذا السند فوراً وإعادته كمسودة وإيقاف أثره من كشف الحساب"
                            >
                              <RotateCcw size={11} />
                              <span>إلغاء الترحيل</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleVoucherPosting(tx)}
                              className="btn-3d btn-3d-success px-2.5 py-1 text-[11px] font-black cursor-pointer hover:scale-105 active:scale-95 transition-all"
                              title="ترحيل السند واعتماده في كشف الحساب"
                            >
                              <CheckCircle2 size={11} />
                              <span>ترحيل السند</span>
                            </button>
                          )
                        ) : (
                          <span className="text-[10px] text-slate-400 font-normal">معتمد</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        لا توجد حركات مسجلة لهذا الطرف وفق معايير التصفية المختارة.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="sticky bottom-0 bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-800 text-xs">
                  <tr>
                    <td colSpan={4} className="p-3 text-right">
                      الإجمالي لحركات الفترة المحددة:
                    </td>
                    <td className="p-3 text-left font-mono text-blue-700">
                      {filteredTransactions.reduce((acc, t) => acc + t.debit, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-left font-mono text-emerald-700">
                      {filteredTransactions.reduce((acc, t) => acc + t.credit, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-left font-mono text-indigo-800 font-bold">
                      {statement.balanceFormatted} {currencySymbol}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>

        {/* Footer (Fixed) */}
        <div className="p-3.5 sm:p-4 bg-slate-50/95 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <span className="text-slate-500 flex items-center gap-1.5 text-[11px] sm:text-xs">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            <span>حساب مترابط آلياً مع فواتير المبيعات، المشتريات، وسندات القبض والصرف</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto btn-3d btn-3d-slate px-5 py-2.5 sm:py-2 text-white text-xs font-bold hover:scale-105 active:scale-95 transition-all"
          >
            إغلاق
          </button>
        </div>

      </div>

      {/* Print Preview Modal */}
      <PrintPreviewModal
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        data={previewData}
      />
    </div>
  );
}
