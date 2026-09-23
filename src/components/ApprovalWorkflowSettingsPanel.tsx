import { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  UserCheck, 
  Stamp, 
  FileText, 
  Sliders, 
  Sparkles, 
  Layers 
} from 'lucide-react';
import { SystemSettings, ApprovalWorkflowSettings } from '../types/accounting';
import { DEFAULT_SETTINGS } from '../utils/settings';
import { countPendingApprovals } from '../utils/voucherApproval';
import VouchersApprovalCenterModal from './VouchersApprovalCenterModal';

export interface ApprovalWorkflowSettingsPanelProps {
  settings: SystemSettings;
  onChange: (field: keyof ApprovalWorkflowSettings, value: any) => void;
  onOpenApprovalCenter?: () => void;
}

export default function ApprovalWorkflowSettingsPanel({
  settings,
  onChange,
  onOpenApprovalCenter
}: ApprovalWorkflowSettingsPanelProps) {
  const workflow = settings.approvalWorkflow || DEFAULT_SETTINGS.approvalWorkflow!;
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const pendingCount = useMemo(() => countPendingApprovals(), [workflow.enabled, workflow.minAmountThreshold]);

  const applyPreset = (type: 'STANDARD' | 'STRICT' | 'ENTERPRISE') => {
    if (type === 'STANDARD') {
      onChange('enabled', true);
      onChange('minAmountThreshold', 5000);
      onChange('requireGeneralManagerForVeryLarge', true);
      onChange('veryLargeThreshold', 50000);
      onChange('blockPostingWithoutApproval', true);
      onChange('enableForInternalVouchers', true);
    } else if (type === 'STRICT') {
      onChange('enabled', true);
      onChange('minAmountThreshold', 1);
      onChange('requireGeneralManagerForVeryLarge', true);
      onChange('veryLargeThreshold', 25000);
      onChange('blockPostingWithoutApproval', true);
      onChange('enableForInternalVouchers', true);
    } else if (type === 'ENTERPRISE') {
      onChange('enabled', true);
      onChange('minAmountThreshold', 20000);
      onChange('requireGeneralManagerForVeryLarge', true);
      onChange('veryLargeThreshold', 100000);
      onChange('blockPostingWithoutApproval', true);
      onChange('enableForInternalVouchers', true);
    }
  };

  return (
    <div className="flex flex-col space-y-6" dir="rtl">
      {/* Top Banner & Main Toggle Switch */}
      <div className={`p-5 rounded-2xl border transition-all ${
        workflow.enabled 
          ? 'bg-gradient-to-l from-violet-50 to-indigo-50 border-violet-200' 
          : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
              workflow.enabled ? 'bg-violet-600 text-white shadow-violet-200' : 'bg-slate-200 text-slate-500'
            }`}>
              <ShieldCheck size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900">
                  دورة الموافقات والاعتماد الهرمي (Approval Hierarchy)
                </h3>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  workflow.enabled ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-600'
                }`}>
                  {workflow.enabled ? 'مُفعّلة حالياً' : 'معطلة'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-xl">
                تفعيل مستويات اعتماد اختيارية للسندات الكبيرة: مرحلة إدخال المحاسب (مسودة)، ثم مرحلة اعتماد المدير المالي والمدير العام، وصولاً لمرحلة الترحيل والصرف الفعلي.
              </p>
            </div>
          </div>

          {/* Master 3D Toggle Switch */}
          <div className="flex items-center gap-3 self-end sm:self-center">
            <button
              type="button"
              onClick={() => onChange('enabled', !workflow.enabled)}
              className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden shadow-inner ${
                workflow.enabled ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  workflow.enabled ? 'translate-x-0' : '-translate-x-8'
                }`}
              />
            </button>
            <span className="text-xs font-bold text-slate-700">
              {workflow.enabled ? 'تفعيل الدورة' : 'تعطيل الدورة'}
            </span>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mt-4 pt-3 border-t border-slate-200/80 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1 w-full sm:w-auto">
            <Sparkles size={13} className="text-amber-500" />
            نماذج جاهزة سريعة:
          </span>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => applyPreset('STANDARD')}
              className="btn-3d btn-3d-purple px-3 py-1.5 text-xs font-bold flex-1 sm:flex-none"
            >
              الشركات المتوسطة (من 5,000 ر.س)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('STRICT')}
              className="btn-3d btn-3d-white px-3 py-1.5 text-xs font-bold flex-1 sm:flex-none"
            >
              اعتماد صارم (كافة السندات من 1 ر.س)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('ENTERPRISE')}
              className="btn-3d btn-3d-white px-3 py-1.5 text-xs font-bold flex-1 sm:flex-none"
            >
              المؤسسات الكبرى (من 20,000 ر.س)
            </button>
          </div>
        </div>
      </div>

      {/* Visual Diagram: The 3 Approval Stages */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <h4 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
          <Layers size={16} className="text-blue-600" />
          <span>المراحل الثلاث لدورة الاعتماد الهرمية (The 3 Lifecycle Stages)</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 relative">
          {/* Stage 1 */}
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] font-black text-blue-700 uppercase bg-blue-100 px-2 py-0.5 rounded">
                  المرحلة 1
                </span>
                <FileText size={16} className="text-blue-600" />
              </div>
              <h5 className="text-xs font-black text-slate-800">إدخال المحاسب (مسودة)</h5>
              <p className="text-[11px] text-slate-600 mt-1">
                يقوم المحاسب بإدخال بيانات السند وتخصيص الفواتير والمرفقات. إذا تجاوز المبلغ حد الاعتماد، يُحفظ كمسودة بانتظار الاعتماد.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-blue-200/60 text-[10px] font-bold text-blue-800 flex items-center gap-1">
              <CheckCircle2 size={12} />
              <span>تسجيل المسودة وحساب الأثر المالي</span>
            </div>
          </div>

          {/* Stage 2 */}
          <div className="p-3.5 rounded-xl border border-violet-200 bg-violet-50/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] font-black text-violet-700 uppercase bg-violet-100 px-2 py-0.5 rounded">
                  المرحلة 2
                </span>
                <Stamp size={16} className="text-violet-600" />
              </div>
              <h5 className="text-xs font-black text-slate-800">اعتماد المدير المالي / العام</h5>
              <p className="text-[11px] text-slate-600 mt-1">
                تقوم الإدارة المالية بمراجعة السند وتدقيقه، وتمنح الموافقة الرسمية (مع توثيق اسم المعتمد، التاريخ، وملاحظات الاعتماد).
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-violet-200/60 text-[10px] font-bold text-violet-800 flex items-center gap-1">
              <UserCheck size={12} />
              <span>مراجعة المبالغ وختم الاعتماد</span>
            </div>
          </div>

          {/* Stage 3 */}
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] font-black text-emerald-700 uppercase bg-emerald-100 px-2 py-0.5 rounded">
                  المرحلة 3
                </span>
                <DollarSign size={16} className="text-emerald-600" />
              </div>
              <h5 className="text-xs font-black text-slate-800">الترحيل والصرف الفعلي</h5>
              <p className="text-[11px] text-slate-600 mt-1">
                بعد اكتمال الاعتماد الإداري، يتاح لأمين الصندوق أو المحاسب الترحيل المحاسبي النهائي والصرف الفعلي من الخزينة أو البنك.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-emerald-200/60 text-[10px] font-bold text-emerald-800 flex items-center gap-1">
              <CheckCircle2 size={12} />
              <span>تحديث الأرصدة ودفتر الأستاذ العام</span>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Form Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-5">
        <h4 className="text-sm font-black text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
          <Sliders size={16} className="text-violet-600" />
          <span>إعدادات الحدود المالية وصلاحيات المعتمدين</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Minimum Amount Threshold */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <label className="block font-black text-slate-800 mb-1">
              الحد المالي لاعتماد السندات الكبيرة (ر.س):
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              أي سند يساوي أو يتجاوز هذا المبلغ يتطلب موافقة الإدارة المالية. (ضع 0 لتطبيق الدورة على جميع السندات).
            </p>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="500"
                value={workflow.minAmountThreshold}
                onChange={(e) => onChange('minAmountThreshold', Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-sm text-slate-800 focus:ring-2 focus:ring-violet-500"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                ر.س
              </span>
            </div>
          </div>

          {/* Large threshold for General Manager */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <label className="font-black text-slate-800">
                اشتراط اعتماد المدير العام للسندات الكبرى:
              </label>
              <input
                type="checkbox"
                checked={workflow.requireGeneralManagerForVeryLarge}
                onChange={(e) => onChange('requireGeneralManagerForVeryLarge', e.target.checked)}
                className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              تفعيل موافقة المدير العام للمبالغ الضخمة جداً.
            </p>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="5000"
                disabled={!workflow.requireGeneralManagerForVeryLarge}
                value={workflow.veryLargeThreshold}
                onChange={(e) => onChange('veryLargeThreshold', Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-sm text-slate-800 focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                ر.س
              </span>
            </div>
          </div>

          {/* Approver Name */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <label className="block font-black text-slate-800 mb-1">
              اسم أو منصب المدير المالي (المعتمد الافتراضي):
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              يظهر في ختم وتوقيع الاعتماد المالي للسندات.
            </p>
            <input
              type="text"
              value={workflow.defaultApproverName}
              onChange={(e) => onChange('defaultApproverName', e.target.value)}
              placeholder="مثال: أ. د. عبد الرحمن الشهري (المدير المالي)"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-xs text-slate-800 focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* General Manager Name */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <label className="block font-black text-slate-800 mb-1">
              اسم المدير العام (للسندات الكبرى):
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              يظهر عند اعتماد السندات التي تتجاوز حد المدير العام.
            </p>
            <input
              type="text"
              value={workflow.generalManagerName}
              onChange={(e) => onChange('generalManagerName', e.target.value)}
              placeholder="مثال: م. فهد بن عبدالعزيز (المدير العام)"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-xs text-slate-800 focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        {/* Security / Posting Rules */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100">
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-violet-50/50 border border-violet-100 cursor-pointer">
            <input
              type="checkbox"
              checked={workflow.blockPostingWithoutApproval}
              onChange={(e) => onChange('blockPostingWithoutApproval', e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-violet-600 focus:ring-violet-500"
            />
            <div>
              <span className="text-xs font-black text-slate-900 block">
                منع الترحيل والصرف الفعلي منعاً باتاً قبل اكتمال الاعتماد
              </span>
              <span className="text-[11px] text-slate-500">
                عند التفعيل، لن يتمكن المحاسب أو الصراف من ترحيل السند بالحسابات أو صرف النقدية من الخزينة حتى يعتمده المدير المالي أولاً.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={workflow.enableForInternalVouchers}
              onChange={(e) => onChange('enableForInternalVouchers', e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-violet-600 focus:ring-violet-500"
            />
            <div>
              <span className="text-xs font-black text-slate-900 block">
                سريان الدورة على سندات الصرف الداخلي والعهد والمصروفات
              </span>
              <span className="text-[11px] text-slate-500">
                تطبيق دورة الاعتماد على سندات الصرف الداخلي (صرف العهد والسلف والمصروفات النثرية) بجانب سندات العملاء والموردين.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Pending Vouchers Summary Card */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Clock size={20} />
          </div>
          <div>
            <h5 className="text-xs font-black text-slate-800">مركز اعتمادات السندات المعلقة</h5>
            <p className="text-[11px] text-slate-500">
              يوجد حالياً <span className="font-bold text-amber-700 font-mono">{pendingCount}</span> سند معلق بانتظار مراجعة واعتماد الإدارة المالية.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (onOpenApprovalCenter) {
              onOpenApprovalCenter();
            } else {
              setShowApprovalModal(true);
            }
          }}
          className="btn-3d btn-3d-purple w-full sm:w-auto px-4 py-2.5 text-xs font-black flex items-center justify-center gap-1.5 self-stretch sm:self-center shrink-0"
        >
          <UserCheck size={14} />
          <span>فتح مركز الاعتمادات السريعة</span>
        </button>
      </div>

      {/* Modal */}
      {showApprovalModal && (
        <VouchersApprovalCenterModal
          isOpen={showApprovalModal}
          onClose={() => setShowApprovalModal(false)}
        />
      )}
    </div>
  );
}
