import { useState, useMemo } from 'react';
import { 
  X, Eye, FileText, Download,
  Building2, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { Partner } from '../types/accounting';
import { getPartnerAccountStatement, PartnerStatement } from '../utils/partnerLedger';
import PrintPreviewModal, { PrintPreviewData } from './PrintPreviewModal';
import { useSystemCurrency } from '../utils/currency';

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

  const statement: PartnerStatement | null = useMemo(() => {
    if (!partner) return null;
    return getPartnerAccountStatement(partner);
  }, [partner]);

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

  const handleExportCSV = () => {
    const headers = [
      'التاريخ',
      'نوع الحركة',
      'رقم المستند',
      'البيان',
      'مدين (مسحوبات)',
      'دائن (مدفوعات)',
      'الرصيد التراكمي',
      'حالة الرصيد'
    ];

    const rows = filteredTransactions.map(tx => [
      tx.date,
      `"${tx.docTypeLabel}"`,
      `"${tx.docNumber}"`,
      `"${tx.description.replace(/"/g, '""')}"`,
      tx.debit.toFixed(2),
      tx.credit.toFixed(2),
      tx.runningBalance.toFixed(2),
      tx.runningBalanceType === 'DEBIT' ? 'مدين' : tx.runningBalanceType === 'CREDIT' ? 'دائن' : 'متزن'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + 
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `كشف_حساب_${partner.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center border shadow-sm ${
              isCustomer 
                ? 'bg-blue-600/30 text-blue-300 border-blue-500/40' 
                : 'bg-purple-600/30 text-purple-300 border-purple-500/40'
            }`}>
              {isCustomer ? <Building2 size={22} /> : <FileText size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-white">كشف حساب مالي تفصيلي ومطابقة أرصدة</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                  isCustomer 
                    ? 'bg-blue-500/20 text-blue-300 border-blue-400/40' 
                    : 'bg-purple-500/20 text-purple-300 border-purple-400/40'
                }`}>
                  {isCustomer ? 'حساب عميل' : 'حساب مورد'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300 mt-1 flex-wrap">
                <span className="font-bold text-white">{partner.name}</span>
                {partner.taxNumber && <span>الرقم الضريبي: {partner.taxNumber}</span>}
                {partner.phone && <span>الهاتف: {partner.phone}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPrintPreview(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-sm"
              title="معاينة كشف الحساب والطباعة الرسمية"
            >
              <Eye size={14} /> معاينة وطباعة
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              title="تصدير إكسل / CSV"
            >
              <Download size={14} /> تصدير
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer mr-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex flex-col gap-4 bg-slate-50/50">
          
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
              <div className="flex bg-slate-100 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setTypeFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    typeFilter === 'ALL' ? 'bg-white text-slate-800 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  كافة الحركات ({statement.transactions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('INVOICES')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    typeFilter === 'INVOICES' ? 'bg-white text-blue-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  الفواتير فقط ({statement.totalSalesInvoices + statement.totalPurchaseInvoices})
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('VOUCHERS')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    typeFilter === 'VOUCHERS' ? 'bg-white text-emerald-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
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
                  className="text-indigo-600 hover:underline text-[11px] font-semibold cursor-pointer"
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
                    </tr>
                  ))}

                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
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
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-600" />
            حساب مترابط آلياً مع فواتير المبيعات، المشتريات، وسندات القبض والصرف
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
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
