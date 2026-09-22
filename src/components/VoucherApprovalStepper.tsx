import { useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  XCircle, 
  ShieldCheck, 
  UserCheck, 
  FileText, 
  Stamp, 
  Check, 
  X, 
  Sliders, 
  DollarSign 
} from 'lucide-react';
import { SystemSettings, VoucherApprovalStatus } from '../types/accounting';
import { getSystemSettings } from '../utils/settings';
import { useSystemCurrency } from '../utils/currency';
import { 
  isApprovalRequired, 
  approveVoucherRecord, 
  rejectVoucherRecord, 
  resetVoucherApproval 
} from '../utils/voucherApproval';

export interface VoucherApprovalStepperProps {
  amount?: number | undefined;
  voucherId?: string | null | undefined;
  voucherNumber?: string | undefined;
  voucherType?: string | undefined; // 'RECEIPT' | 'PAYMENT' | 'INTERNAL_PAYMENT' | 'INTERNAL_RECEIPT' | 'INTERNAL_TRANSFER'
  isPosted?: boolean | undefined;
  postedAt?: string | undefined;
  approvalStatus?: VoucherApprovalStatus | undefined;
  approvedBy?: string | undefined;
  approvedAt?: string | undefined;
  approvalRole?: string | undefined;
  approvalNotes?: string | undefined;
  rejectedBy?: string | undefined;
  rejectedAt?: string | undefined;
  rejectionReason?: string | undefined;
  preparedBy?: string | undefined;
  date?: string | undefined;
  voucher?: any | undefined;
  systemSettings?: SystemSettings | undefined;
  onApprovalChanged?: (() => void) | undefined;
  onOpenSettings?: (() => void) | undefined;
  onOpenApprovalCenter?: (() => void) | undefined;
  onApprove?: ((notes?: string) => void) | undefined;
  onReject?: ((reason: string) => void) | undefined;
  onPost?: (() => void) | undefined;
  onUnpost?: (() => void) | undefined;
}

export default function VoucherApprovalStepper(props: VoucherApprovalStepperProps) {
  const { symbol: currencySymbol } = useSystemCurrency();
  const {
    onApprovalChanged,
    onOpenSettings,
    onOpenApprovalCenter,
    onApprove,
    onReject
  } = props;

  const settings: SystemSettings = props.systemSettings || getSystemSettings();
  const workflow = settings.approvalWorkflow;
  const isWorkflowEnabled = Boolean(workflow?.enabled);

  const amount = props.amount ?? (props.voucher ? Number(props.voucher.amount) || 0 : 0);
  const voucherId = props.voucherId ?? props.voucher?.id ?? null;
  const voucherNumber = props.voucherNumber ?? props.voucher?.voucherNumber ?? '';
  const voucherType = props.voucherType ?? props.voucher?.type ?? 'PAYMENT';
  const isPosted = props.isPosted ?? (props.voucher?.status === 'POSTED');
  const postedAt = props.postedAt ?? props.voucher?.postedAt;
  const approvalStatus: VoucherApprovalStatus = props.approvalStatus ?? props.voucher?.approvalStatus ?? 'NOT_REQUIRED';
  const approvedBy = props.approvedBy ?? props.voucher?.approvedBy;
  const approvedAt = props.approvedAt ?? props.voucher?.approvedAt;
  const approvalRole = props.approvalRole ?? props.voucher?.approvalRole;
  const approvalNotes = props.approvalNotes ?? props.voucher?.approvalNotes;
  const rejectedBy = props.rejectedBy ?? props.voucher?.rejectedBy;
  const rejectionReason = props.rejectionReason ?? props.voucher?.rejectionReason;
  const preparedBy = props.preparedBy ?? props.voucher?.partnerName;
  const date = props.date ?? props.voucher?.date;

  // Check requirements
  const check = useMemo(() => {
    return isApprovalRequired(amount, settings);
  }, [amount, settings]);

  // Modal for Approving
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approverNameInput, setApproverNameInput] = useState(() => {
    if (check.requiredRole === 'المدير العام') {
      return workflow?.generalManagerName || 'المدير العام';
    }
    return workflow?.defaultApproverName || 'أ. د. عبد الرحمن الشهري (المدير المالي)';
  });
  const [approvalNotesInput, setApprovalNotesInput] = useState('');

  // Modal for Rejecting
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectorNameInput, setRejectorNameInput] = useState(() => workflow?.defaultApproverName || 'المدير المالي');
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  // Derived effective status
  const effectiveStatus: VoucherApprovalStatus = useMemo(() => {
    if (!isWorkflowEnabled || !check.required) {
      return 'NOT_REQUIRED';
    }
    if (approvalStatus === 'APPROVED' || approvalStatus === 'REJECTED') {
      return approvalStatus;
    }
    return 'PENDING_APPROVAL';
  }, [isWorkflowEnabled, check.required, approvalStatus]);

  const isApproved = effectiveStatus === 'APPROVED';
  const isRejected = effectiveStatus === 'REJECTED';
  const isPending = effectiveStatus === 'PENDING_APPROVAL';
  const isNotRequired = effectiveStatus === 'NOT_REQUIRED';

  const handleApprove = () => {
    if (onApprove) {
      onApprove(approvalNotesInput.trim() || undefined);
      setShowApproveDialog(false);
      setApprovalNotesInput('');
      return;
    }

    if (!voucherId) {
      alert('يرجى حفظ السند أولاً قبل اعتماده رسمياً.');
      return;
    }

    const res = approveVoucherRecord({
      voucherId,
      voucherType,
      approverName: approverNameInput.trim() || 'المدير المالي',
      approverRole: check.requiredRole || 'المدير المالي',
      notes: approvalNotesInput.trim() || undefined
    });

    if (res.success) {
      setShowApproveDialog(false);
      setApprovalNotesInput('');
      if (onApprovalChanged) onApprovalChanged();
    } else {
      alert(res.error || 'فشل اعتماد السند');
    }
  };

  const handleReject = () => {
    if (!rejectionReasonInput.trim()) {
      alert('يرجى كتابة سبب الرفض أو ملاحظات التعديل المطلوبة من المحاسب.');
      return;
    }

    if (onReject) {
      onReject(rejectionReasonInput.trim());
      setShowRejectDialog(false);
      setRejectionReasonInput('');
      return;
    }

    if (!voucherId) {
      alert('يرجى حفظ السند أولاً.');
      return;
    }

    const res = rejectVoucherRecord({
      voucherId,
      voucherType,
      rejectorName: rejectorNameInput.trim() || 'المدير المالي',
      reason: rejectionReasonInput.trim()
    });

    if (res.success) {
      setShowRejectDialog(false);
      setRejectionReasonInput('');
      if (onApprovalChanged) onApprovalChanged();
    } else {
      alert(res.error || 'فشل رفض السند');
    }
  };

  const handleReset = () => {
    if (!voucherId) return;
    if (!confirm('هل أنت متأكد من رغبتك في إلغاء حالة الاعتماد وإعادة السند إلى قيد المراجعة؟')) return;

    const res = resetVoucherApproval(voucherId, voucherType);
    if (res.success && onApprovalChanged) {
      onApprovalChanged();
    }
  };

  // If approval workflow is disabled in system settings, completely hide the stepper
  if (!isWorkflowEnabled) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3.5 sm:p-4 mb-4 transition-all">
      {/* Header bar of the approval block */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            isWorkflowEnabled ? 'bg-violet-50 text-violet-700 border border-violet-200' : 'bg-slate-100 text-slate-500'
          }`}>
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-800">
                دورة الموافقات والاعتماد الهرمي (Approval Hierarchy)
              </span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isWorkflowEnabled 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                {isWorkflowEnabled ? 'مُفعّلة بالنظام' : 'معطلة (اختيارية)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isWorkflowEnabled 
                ? `تتطلب السندات بمبلغ ${workflow?.minAmountThreshold?.toLocaleString()} ${currencySymbol} فأكثر موافقة المدير المالي/العام قبل الترحيل والصرف.`
                : 'يمكنك تفعيل دورة المستويات الثلاثية من شاشة إعدادات النظام للمبالغ الكبيرة.'}
            </p>
          </div>
        </div>

        {/* Quick buttons */}
        <div className="flex items-center gap-1.5">
          {onOpenApprovalCenter && isWorkflowEnabled && (
            <button
              type="button"
              onClick={onOpenApprovalCenter}
              className="px-2.5 py-1 text-[11px] font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
            >
              <UserCheck size={12} />
              <span>مركز الاعتمادات المعلقة</span>
            </button>
          )}

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-blue-700 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
              title="تعديل حد الاعتماد وإعدادات الدورة"
            >
              <Sliders size={12} />
              <span className="hidden sm:inline">إعدادات الدورة</span>
            </button>
          )}
        </div>
      </div>

      {/* The 3-Stage Lifecycle Stepper */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
        {/* Stage 1: Accountant Entry */}
        <div className={`p-3 rounded-xl border relative transition-all ${
          voucherId 
            ? 'bg-blue-50/50 border-blue-200 text-blue-900' 
            : 'bg-slate-50/70 border-slate-200 text-slate-700'
        }`}>
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase text-blue-700 bg-blue-100/60 px-1.5 py-0.5 rounded">
              المرحلة 1
            </span>
            {voucherId ? (
              <span className="flex items-center gap-1 text-[11px] font-black text-blue-700">
                <CheckCircle2 size={13} /> تم الإدخال
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                <Clock size={13} /> قيد التحرير
              </span>
            )}
          </div>
          <h4 className="text-xs font-black text-slate-800 flex items-center gap-1">
            <FileText size={14} className="text-blue-600" />
            إدخال المحاسب (مسودة)
          </h4>
          <p className="text-[11px] text-slate-600 mt-1">
            {voucherId 
              ? `المسودة جاهزة برقم #${voucherNumber || ''}`
              : 'يقوم المحاسب بإدخال تفاصيل السند والمبالغ ومرفقات الفواتير.'}
          </p>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between border-t border-blue-100/80 pt-1.5">
            <span>المدخل: {preparedBy || 'المحاسب المسؤول'}</span>
            <span>{date || new Date().toISOString().split('T')[0]}</span>
          </div>
        </div>

        {/* Stage 2: Management Approval */}
        <div className={`p-3 rounded-xl border relative transition-all ${
          isApproved 
            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950 shadow-2xs' 
            : isRejected
              ? 'bg-rose-50/60 border-rose-200 text-rose-950 shadow-2xs'
              : isPending
                ? 'bg-amber-50/70 border-amber-200 text-amber-950 ring-1 ring-amber-300 shadow-xs'
                : 'bg-slate-50/50 border-slate-200 text-slate-500'
        }`}>
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className={`text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded ${
              isApproved 
                ? 'text-emerald-800 bg-emerald-100' 
                : isRejected 
                  ? 'text-rose-800 bg-rose-100'
                  : isPending
                    ? 'text-amber-800 bg-amber-100'
                    : 'text-slate-600 bg-slate-200'
            }`}>
              المرحلة 2
            </span>
            
            {isApproved && (
              <span className="flex items-center gap-1 text-[11px] font-black text-emerald-700">
                <Stamp size={14} className="text-emerald-600" /> معتمد رسمياً
              </span>
            )}
            {isRejected && (
              <span className="flex items-center gap-1 text-[11px] font-black text-rose-700">
                <XCircle size={14} /> مرفوض
              </span>
            )}
            {isPending && (
              <span className="flex items-center gap-1 text-[11px] font-black text-amber-700 animate-pulse">
                <Clock size={13} /> بانتظار الاعتماد
              </span>
            )}
            {isNotRequired && (
              <span className="text-[11px] font-bold text-slate-400">
                اعتماد مباشر (غير ملزم)
              </span>
            )}
          </div>

          <h4 className="text-xs font-black text-slate-800 flex items-center gap-1">
            <UserCheck size={14} className={isApproved ? 'text-emerald-600' : isRejected ? 'text-rose-600' : 'text-amber-600'} />
            اعتماد {check.requiredRole === 'المدير العام' ? 'المدير العام' : 'المدير المالي'}
          </h4>

          {isApproved ? (
            <div className="mt-1">
              <p className="text-[11px] font-bold text-emerald-800">
                معتمد من: {approvedBy || workflow?.defaultApproverName}
              </p>
              {approvalNotes && (
                <p className="text-[10px] text-emerald-700 italic mt-0.5">
                  &quot;{approvalNotes}&quot;
                </p>
              )}
              <div className="mt-2 text-[10px] text-emerald-600 flex items-center justify-between border-t border-emerald-200/80 pt-1.5">
                <span>الاعتماد: {approvalRole || check.requiredRole}</span>
                <span>{approvedAt ? new Date(approvedAt).toLocaleDateString('ar-SA') : ''}</span>
              </div>
            </div>
          ) : isRejected ? (
            <div className="mt-1">
              <p className="text-[11px] font-bold text-rose-800">
                تم الرفض بواسطة: {rejectedBy || 'الإدارة المالية'}
              </p>
              <p className="text-[10px] text-rose-700 mt-0.5 font-semibold">
                السبب: {rejectionReason || 'يرجى مراجعة المبلغ والحسابات'}
              </p>
              <div className="mt-2 pt-1 border-t border-rose-200/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[10px] text-rose-800 underline font-bold hover:text-rose-900 cursor-pointer"
                >
                  إعادة التقديم للمراجعة
                </button>
              </div>
            </div>
          ) : isPending ? (
            <div className="mt-1">
              <p className="text-[11px] text-amber-900 font-bold">
                يتطلب مراجعة واعتماد {check.requiredRole}
              </p>
              <p className="text-[10px] text-amber-700 mt-0.5">
                المبلغ ({Number(amount || 0).toLocaleString()} ر.س) يتجاوز حد {check.threshold.toLocaleString()} ر.س.
              </p>
              {/* Approval Actions buttons */}
              <div className="mt-2.5 flex items-center gap-1.5 border-t border-amber-200 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApproveDialog(true)}
                  className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-2xs transition-colors cursor-pointer"
                  title="اعتماد السند كمدير مالي أو مدير عام"
                >
                  <Check size={12} />
                  <span>اعتماد السند</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectDialog(true)}
                  className="py-1 px-2 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="رفض السند أو إرجاعه للمحاسب"
                >
                  <X size={12} />
                  <span>رفض</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-1">
              <p className="text-[11px] text-slate-500">
                {isWorkflowEnabled 
                  ? `المبلغ أقل من حد الاعتماد (${workflow?.minAmountThreshold?.toLocaleString()} ر.س). يمكن الترحيل مباشرة.` 
                  : 'الاعتماد الإداري غير مفعل حالياً في الإعدادات.'}
              </p>
              <div className="mt-2 text-[10px] text-slate-400 border-t border-slate-100 pt-1.5">
                جاهز للمرحلة الثالثة مباشرة
              </div>
            </div>
          )}
        </div>

        {/* Stage 3: Actual Disbursement & Posting */}
        <div className={`p-3 rounded-xl border relative transition-all ${
          isPosted 
            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-xs' 
            : isApproved
              ? 'bg-amber-50/60 border-amber-200 text-amber-950'
              : 'bg-slate-50/50 border-slate-200 text-slate-600'
        }`}>
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
              المرحلة 3
            </span>
            {isPosted ? (
              <span className="flex items-center gap-1 text-[11px] font-black text-emerald-700">
                <CheckCircle2 size={13} /> مرحل ومصروف فعلياً
              </span>
            ) : isApproved ? (
              <span className="flex items-center gap-1 text-[11px] font-black text-amber-700">
                <Clock size={13} /> جاهز للصرف والترحيل
              </span>
            ) : (
              <span className="text-[11px] font-bold text-slate-400">
                بانتظار اكتمال الاعتماد
              </span>
            )}
          </div>
          <h4 className="text-xs font-black text-slate-800 flex items-center gap-1">
            <DollarSign size={14} className={isPosted ? 'text-emerald-600' : 'text-slate-500'} />
            الترحيل والصرف الفعلي
          </h4>
          <p className="text-[11px] text-slate-600 mt-1">
            {isPosted 
              ? 'تم الترحيل النهائي وتحديث أرصدة الخزينة والحسابات ودفتر الأستاذ العام.'
              : isApproved 
                ? 'تم استيفاء كافة الموافقات المطلوبة، ويمكن لأمين الصندوق أو المحاسب الترحيل والصرف.'
                : 'محظور الترحيل والصرف الفعلي حتى يتم اعتماد السند من الإدارة المالية.'}
          </p>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-200/80 pt-1.5">
            <span>الحالة: {isPosted ? 'مرحل بالحسابات' : 'مسودة'}</span>
            <span>{postedAt ? new Date(postedAt).toLocaleDateString('ar-SA') : 'غير مرحل'}</span>
          </div>
        </div>
      </div>

      {/* Dialog for Approving */}
      {showApproveDialog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl animate-in zoom-in-95" dir="rtl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <Stamp size={20} />
                <h3 className="text-base font-black text-slate-900">اعتماد وموافقة الإدارة المالية</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowApproveDialog(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold">رقم السند:</span>
                  <span className="font-mono font-black text-sm">#{voucherNumber || 'غير محدد'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold">مبلغ السند:</span>
                  <span className="font-mono font-black text-sm text-emerald-800">
                    {Number(amount || 0).toLocaleString()} ر.س
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المعتمد / المنصب:</label>
                <input
                  type="text"
                  value={approverNameInput}
                  onChange={(e) => setApproverNameInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-xs font-semibold"
                  placeholder="اسم المعتمد"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">مستوى الاعتماد:</label>
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-bold">
                  {check.requiredRole}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات الاعتماد (اختياري):</label>
                <textarea
                  rows={2}
                  value={approvalNotesInput}
                  onChange={(e) => setApprovalNotesInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-xs"
                  placeholder="تمت مطابقة الفواتير والمرفقات وموافقة الصرف..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowApproveDialog(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Stamp size={16} />
                  <span>تأكيد الاعتماد والموافقة</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog for Rejecting */}
      {showRejectDialog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl animate-in zoom-in-95" dir="rtl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-rose-700">
                <XCircle size={20} />
                <h3 className="text-base font-black text-slate-900">رفض السند أو إرجاعه للمحاسب</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowRejectDialog(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المسؤول عن الرفض:</label>
                <input
                  type="text"
                  value={rejectorNameInput}
                  onChange={(e) => setRejectorNameInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 text-rose-700">سبب الرفض والتعديلات المطلوبة (إلزامي):</label>
                <textarea
                  rows={3}
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  className="w-full px-3 py-2 border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500 text-xs"
                  placeholder="مثال: يرجى إرفاق الفاتورة الأصلية أو تعديل مركز التكلفة..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRejectDialog(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 cursor-pointer"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <XCircle size={16} />
                  <span>تأكيد الرفض وإرجاع السند</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
