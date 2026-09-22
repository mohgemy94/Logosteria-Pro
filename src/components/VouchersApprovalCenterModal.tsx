import { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Stamp, 
  Sliders, 
  Search, 
  Calendar 
} from 'lucide-react';
import { getSystemSettings } from '../utils/settings';
import { 
  loadAllPendingApprovals, 
  approveVoucherRecord, 
  rejectVoucherRecord, 
  PendingApprovalItem 
} from '../utils/voucherApproval';
import { SystemSettings } from '../types/accounting';
import { useSystemCurrency } from '../utils/currency';

export interface VouchersApprovalCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemSettings?: SystemSettings;
  onOpenSettings?: () => void;
  onSelectVoucher?: (voucher: PendingApprovalItem) => void;
}

export default function VouchersApprovalCenterModal({
  isOpen,
  onClose,
  systemSettings,
  onOpenSettings,
  onSelectVoucher
}: VouchersApprovalCenterModalProps) {
  const { symbol: currencySymbol } = useSystemCurrency();
  const [settings] = useState<SystemSettings>(() => systemSettings || getSystemSettings());
  const workflow = settings.approvalWorkflow;
  const [pendingItems, setPendingItems] = useState<PendingApprovalItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'EXTERNAL' | 'INTERNAL'>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'المدير المالي' | 'المدير العام'>('ALL');

  // Selected item for fast approve / reject
  const [activeItem, setActiveItem] = useState<PendingApprovalItem | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [approverName, setApproverName] = useState(() => workflow?.defaultApproverName || 'المدير المالي');

  const reloadData = () => {
    setPendingItems(loadAllPendingApprovals());
  };

  useEffect(() => {
    if (isOpen) {
      reloadData();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleUpdated = () => {
      reloadData();
    };
    window.addEventListener('alpha-voucher-approval-updated', handleUpdated);
    window.addEventListener('alpha-vouchers-updated', handleUpdated);
    return () => {
      window.removeEventListener('alpha-voucher-approval-updated', handleUpdated);
      window.removeEventListener('alpha-vouchers-updated', handleUpdated);
    };
  }, []);

  const filteredItems = useMemo(() => {
    return pendingItems.filter(item => {
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (roleFilter !== 'ALL' && item.requiredRole !== roleFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matches = 
          item.voucherNumber.toLowerCase().includes(q) ||
          item.partyName.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.amount.toString().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [pendingItems, categoryFilter, roleFilter, searchTerm]);

  const totalPendingAmount = useMemo(() => {
    return filteredItems.reduce((acc, curr) => acc + curr.amount, 0);
  }, [filteredItems]);

  const handleExecuteAction = () => {
    if (!activeItem || !actionType) return;

    if (actionType === 'APPROVE') {
      const res = approveVoucherRecord({
        voucherId: activeItem.id,
        voucherType: activeItem.voucherType,
        approverName: approverName.trim() || 'المدير المالي',
        approverRole: activeItem.requiredRole,
        notes: actionNotes.trim() || undefined
      });
      if (res.success) {
        setActiveItem(null);
        setActionType(null);
        setActionNotes('');
        reloadData();
      } else {
        alert(res.error || 'فشل اعتماد السند');
      }
    } else if (actionType === 'REJECT') {
      if (!actionNotes.trim()) {
        alert('يرجى تحديد سبب الرفض');
        return;
      }
      const res = rejectVoucherRecord({
        voucherId: activeItem.id,
        voucherType: activeItem.voucherType,
        rejectorName: approverName.trim() || 'المدير المالي',
        reason: actionNotes.trim()
      });
      if (res.success) {
        setActiveItem(null);
        setActionType(null);
        setActionNotes('');
        reloadData();
      } else {
        alert(res.error || 'فشل رفض السند');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-fadeIn" 
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-t-3xl sm:rounded-2xl max-w-4xl w-full border border-slate-200/90 shadow-2xl overflow-hidden animate-modalIn flex flex-col max-h-[92vh] sm:max-h-[88vh] md:max-h-[90vh] text-right"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Mobile Handle */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header */}
        <div className="p-3.5 sm:p-5 bg-gradient-to-l from-violet-900 via-slate-900 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-violet-600/30 border border-violet-400/30 flex items-center justify-center text-violet-300 shrink-0">
              <ShieldCheck size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base md:text-lg font-black tracking-tight truncate">مركز اعتمادات وموافقات السندات</h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono shrink-0">
                  {pendingItems.length} بانتظار الاعتماد
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 truncate sm:overflow-visible sm:whitespace-normal">
                دورة الاعتماد الهرمية (Approval Hierarchy): اعتماد المدير المالي والمدير العام للسندات الكبيرة قبل الصرف الفعلي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer hover:scale-105 active:scale-95"
                title="إعدادات دورة الاعتماد"
                aria-label="إعدادات دورة الاعتماد"
              >
                <Sliders size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer hover:scale-105 active:scale-95"
              aria-label="إغلاق"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-slate-50 border-b border-slate-200">
          <div className="p-2.5 bg-white rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 block">إجمالي السندات المعلقة</span>
            <span className="text-lg font-black text-slate-800 font-mono">{filteredItems.length}</span>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 block">المبالغ بانتظار الاعتماد</span>
            <span className="text-lg font-black text-emerald-700 font-mono">
              {totalPendingAmount.toLocaleString()} <span className="text-xs font-bold">ر.س</span>
            </span>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 block">اعتماد المدير المالي</span>
            <span className="text-lg font-black text-violet-700 font-mono">
              {filteredItems.filter(i => i.requiredRole === 'المدير المالي').length}
            </span>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 block">اعتماد المدير العام (كبيرة)</span>
            <span className="text-lg font-black text-rose-700 font-mono">
              {filteredItems.filter(i => i.requiredRole === 'المدير العام').length}
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث برقم السند، الطرف، البيان أو المبلغ..."
              className="w-full pr-9 pl-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setCategoryFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                categoryFilter === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              الكل ({pendingItems.length})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('EXTERNAL')}
              className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                categoryFilter === 'EXTERNAL' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              سندات خارجية ({pendingItems.filter(i => i.category === 'EXTERNAL').length})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('INTERNAL')}
              className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                categoryFilter === 'INTERNAL' ? 'bg-purple-600 text-white border-purple-600' : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              سندات داخلية ({pendingItems.filter(i => i.category === 'INTERNAL').length})
            </button>
            
            <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block" />

            <button
              type="button"
              onClick={() => setRoleFilter(roleFilter === 'المدير المالي' ? 'ALL' : 'المدير المالي')}
              className={`px-2 py-1 rounded-lg border text-[11px] transition-colors cursor-pointer ${
                roleFilter === 'المدير المالي' ? 'bg-violet-600 text-white border-violet-600' : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
              }`}
            >
              اعتماد المدير المالي
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter(roleFilter === 'المدير العام' ? 'ALL' : 'المدير العام')}
              className={`px-2 py-1 rounded-lg border text-[11px] transition-colors cursor-pointer ${
                roleFilter === 'المدير العام' ? 'bg-rose-600 text-white border-rose-600' : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              }`}
            >
              اعتماد المدير العام
            </button>
          </div>
        </div>

        {/* List of pending vouchers */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 size={42} className="mx-auto text-emerald-500 mb-2.5 opacity-80" />
              <h4 className="text-sm font-black text-slate-700">لا توجد سندات معلقة بانتظار الاعتماد حالياً!</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                كافة السندات التي تتجاوز حد الاعتماد تم اعتمادها وترحيلها أو لا توجد سندات تتطلب مراجعة.
              </p>
            </div>
          ) : (
            filteredItems.map(item => (
              <div 
                key={`${item.voucherType}-${item.id}`}
                className="p-3.5 bg-white hover:bg-slate-50/80 rounded-xl border border-slate-200 shadow-2xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                {/* Info block */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                      #{item.voucherNumber}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      {item.typeLabel}
                    </span>
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                      item.requiredRole === 'المدير العام' 
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-violet-50 text-violet-700 border border-violet-200'
                    }`}>
                      مطلوب اعتماد: {item.requiredRole}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-auto">
                      <Calendar size={12} /> {item.date}
                    </span>
                  </div>

                  <div className="text-xs font-black text-slate-800 truncate mb-1">
                    {item.partyName}
                  </div>
                  {item.description && (
                    <p className="text-[11px] text-slate-500 truncate max-w-xl">
                      {item.description}
                    </p>
                  )}
                  <div className="text-[10px] text-slate-400 mt-1">
                    المدخل (المحاسب): {item.preparedBy}
                  </div>
                </div>

                {/* Amount & Actions */}
                <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                  <div className="text-left md:text-right">
                    <span className="text-[10px] text-slate-400 block">مبلغ السند</span>
                    <span className="text-base font-black text-emerald-700 font-mono">
                      {item.amount.toLocaleString()} <span className="text-xs">{currencySymbol}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {onSelectVoucher && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectVoucher(item);
                          onClose();
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="عرض وتعديل السند في الشاشة الرئيسية"
                      >
                        معاينة
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setActiveItem(item);
                        setActionType('APPROVE');
                        setApproverName(item.requiredRole === 'المدير العام' ? (workflow?.generalManagerName || 'المدير العام') : (workflow?.defaultApproverName || 'المدير المالي'));
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                      title="اعتماد السند والموافقة"
                    >
                      <Stamp size={14} />
                      <span>اعتماد</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveItem(item);
                        setActionType('REJECT');
                        setApproverName(workflow?.defaultApproverName || 'المدير المالي');
                      }}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="رفض السند أو إرجاعه"
                    >
                      <XCircle size={14} />
                      <span>رفض</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer (Fixed) */}
        <div className="p-3.5 sm:p-4 bg-slate-50/95 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <span className="text-slate-500 font-medium hidden sm:inline">
            المبالغ المعتمدة تصبح مؤهلة فوراً للصرف الفعلي والترحيل المحاسبي.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-bold cursor-pointer transition-all hover:scale-105 active:scale-95"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* Action Dialog (Approve / Reject) */}
      {activeItem && actionType && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div 
            className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-4 sm:p-5 border border-slate-200 shadow-2xl animate-modalIn text-right" 
            dir="rtl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
              <div className="flex items-center gap-2">
                {actionType === 'APPROVE' ? (
                  <Stamp size={20} className="text-emerald-600" />
                ) : (
                  <XCircle size={20} className="text-rose-600" />
                )}
                <h4 className="text-sm font-black text-slate-800">
                  {actionType === 'APPROVE' ? 'اعتماد وموافقة السند' : 'رفض السند وإرجاعه للمحاسب'}
                </h4>
              </div>
              <button 
                type="button" 
                onClick={() => { setActiveItem(null); setActionType(null); }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex justify-between font-bold mb-1">
                  <span>رقم السند:</span>
                  <span className="font-mono font-black">#{activeItem.voucherNumber}</span>
                </div>
                <div className="flex justify-between font-bold mb-1">
                  <span>الطرف:</span>
                  <span>{activeItem.partyName}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>المبلغ:</span>
                  <span className="font-mono text-emerald-700 font-black">{activeItem.amount.toLocaleString()} {currencySymbol}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المعتمد / المنصب:</label>
                <input
                  type="text"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {actionType === 'APPROVE' ? 'ملاحظات الاعتماد (اختياري):' : 'سبب الرفض والملاحظات للمحاسب (إلزامي):'}
                </label>
                <textarea
                  rows={2}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder={actionType === 'APPROVE' ? 'تم التدقيق والموافقة...' : 'سبب الرفض...'}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setActiveItem(null); setActionType(null); }}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleExecuteAction}
                  className={`px-4 py-1.5 text-white rounded-lg font-black flex items-center gap-1 shadow-sm cursor-pointer ${
                    actionType === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {actionType === 'APPROVE' ? <Stamp size={15} /> : <XCircle size={15} />}
                  <span>{actionType === 'APPROVE' ? 'تأكيد الاعتماد' : 'تأكيد الرفض'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
