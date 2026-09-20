import { SystemSettings, VoucherApprovalStatus, VoucherType } from '../types/accounting';
import { getSystemSettings } from './settings';
import { 
  DB_RECEIPT_VOUCHERS_KEY, 
  DB_PAYMENT_VOUCHERS_KEY,
  DB_INTERNAL_PAYMENT_VOUCHERS_KEY,
  DB_INTERNAL_RECEIPT_VOUCHERS_KEY,
  DB_INTERNAL_VOUCHERS_KEY
} from './sequences';
import { dispatchPartnerLedgerUpdated } from './partnerLedger';

export type VoucherCategory = 'EXTERNAL' | 'INTERNAL';

export interface ApprovalCheckResult {
  required: boolean;
  requiredRole: 'المدير المالي' | 'المدير العام' | 'لا يتطلب اعتماد';
  threshold: number;
  reason: string;
}

export interface ApprovalActionPayload {
  voucherId: string;
  voucherType: string; // 'RECEIPT' | 'PAYMENT' | 'INTERNAL_TRANSFER' | 'INTERNAL_PAYMENT' | 'INTERNAL_RECEIPT'
  approverName: string;
  approverRole?: string | undefined;
  notes?: string | undefined;
}

export interface RejectionActionPayload {
  voucherId: string;
  voucherType: string;
  rejectorName: string;
  reason: string;
}

export interface PendingApprovalItem {
  id: string;
  voucherNumber: string;
  voucherType: string;
  category: VoucherCategory;
  categoryLabel: string;
  typeLabel: string;
  amount: number;
  date: string;
  partyName: string;
  description: string;
  approvalStatus: VoucherApprovalStatus;
  requiredRole: string;
  preparedBy?: string;
  createdAt?: string;
  status?: 'DRAFT' | 'POSTED';
}

/**
 * Checks if a voucher requires management approval based on SystemSettings and amount
 */
export function isApprovalRequired(amount: number, customSettings?: SystemSettings): ApprovalCheckResult {
  const settings = customSettings || getSystemSettings();
  const workflow = settings.approvalWorkflow;

  if (!workflow || !workflow.enabled) {
    return {
      required: false,
      requiredRole: 'لا يتطلب اعتماد',
      threshold: 0,
      reason: 'دورة الموافقات والاعتماد معطلة في إعدادات النظام'
    };
  }

  const numAmount = Number(amount) || 0;
  const minThreshold = Number(workflow.minAmountThreshold) || 0;

  if (numAmount < minThreshold) {
    return {
      required: false,
      requiredRole: 'لا يتطلب اعتماد',
      threshold: minThreshold,
      reason: `المبلغ (${numAmount.toLocaleString()} ر.س) أقل من حد الاعتماد الإلزامي (${minThreshold.toLocaleString()} ر.س)`
    };
  }

  // Check if it qualifies for General Manager approval (very large threshold)
  const veryLargeThreshold = Number(workflow.veryLargeThreshold) || (minThreshold * 10);
  if (workflow.requireGeneralManagerForVeryLarge && numAmount >= veryLargeThreshold) {
    return {
      required: true,
      requiredRole: 'المدير العام',
      threshold: veryLargeThreshold,
      reason: `المبلغ (${numAmount.toLocaleString()} ر.س) تجاوز حد السندات الكبرى (${veryLargeThreshold.toLocaleString()} ر.س) ويتطلب اعتماد المدير العام`
    };
  }

  return {
    required: true,
    requiredRole: 'المدير المالي',
    threshold: minThreshold,
    reason: `المبلغ (${numAmount.toLocaleString()} ر.س) يساوي أو يتجاوز حد الاعتماد (${minThreshold.toLocaleString()} ر.س) ويتطلب اعتماد المدير المالي`
  };
}

/**
 * Checks if a voucher can be posted to accounting ledger and treasury
 */
export function canVoucherBePosted(
  voucher: { 
    amount: number; 
    approvalStatus?: VoucherApprovalStatus | string | undefined; 
    status?: string | undefined;
    [key: string]: any;
  }, 
  customSettings?: SystemSettings
): { canPost: boolean; reason?: string } {
  const settings = customSettings || getSystemSettings();
  const workflow = settings.approvalWorkflow;

  // If approval workflow is disabled or posting is not blocked, can post
  if (!workflow || !workflow.enabled || !workflow.blockPostingWithoutApproval) {
    return { canPost: true };
  }

  const check = isApprovalRequired(voucher.amount, settings);
  if (!check.required) {
    return { canPost: true };
  }

  // If approval is required, must have status APPROVED
  if (voucher.approvalStatus === 'APPROVED') {
    return { canPost: true };
  }

  if (voucher.approvalStatus === 'REJECTED') {
    return {
      canPost: false,
      reason: 'لا يمكن ترحيل أو صرف السند لأنه تم رفضه من قبل الإدارة المالية. يرجى مراجعة سبب الرفض وتعديله.'
    };
  }

  return {
    canPost: false,
    reason: `السند بمبلغ (${Number(voucher.amount || 0).toLocaleString()} ر.س) يتطلب اعتماد ${check.requiredRole} أولاً قبل إمكانية الترحيل والصرف الفعلي.`
  };
}

/**
 * Determines storage key for voucher type
 */
function getStorageKeyForType(type: string): string {
  const t = (type || '').toUpperCase();
  if (t === 'RECEIPT' || t === VoucherType.Receipt) return DB_RECEIPT_VOUCHERS_KEY;
  if (t === 'PAYMENT' || t === VoucherType.Payment) return DB_PAYMENT_VOUCHERS_KEY;
  if (t === 'INTERNAL_PAYMENT' || t === 'INTERNAL_PAYMENT_VOUCHER') return DB_INTERNAL_PAYMENT_VOUCHERS_KEY;
  if (t === 'INTERNAL_RECEIPT' || t === 'INTERNAL_RECEIPT_VOUCHER') return DB_INTERNAL_RECEIPT_VOUCHERS_KEY;
  if (t === 'INTERNAL_TRANSFER' || t === 'INTERNAL_VOUCHER') return DB_INTERNAL_VOUCHERS_KEY;
  return DB_PAYMENT_VOUCHERS_KEY;
}

/**
 * Approves a voucher by ID and Type, setting approvalStatus to 'APPROVED' with audit metadata
 */
export function approveVoucherRecord(
  payloadOrId: ApprovalActionPayload | string,
  voucherType?: string,
  options?: { approverName?: string | undefined; approverRole?: string | undefined; notes?: string | undefined }
): { success: boolean; error?: string; message?: string; voucher?: any } {
  if (typeof window === 'undefined') return { success: false, error: 'Window not defined' };

  let payload: ApprovalActionPayload;
  if (typeof payloadOrId === 'string') {
    payload = {
      voucherId: payloadOrId,
      voucherType: voucherType || 'PAYMENT',
      approverName: options?.approverName || 'المدير المالي',
      approverRole: options?.approverRole || 'المدير المالي',
      notes: options?.notes
    };
  } else {
    payload = payloadOrId;
  }

  try {
    const key = getStorageKeyForType(payload.voucherType);
    const raw = localStorage.getItem(key);
    if (!raw) return { success: false, error: 'قائمة السندات فارغة' };

    const list: any[] = JSON.parse(raw);
    const index = list.findIndex(v => v.id === payload.voucherId);

    if (index === -1) {
      return { success: false, error: 'لم يتم العثور على السند المطلوب' };
    }

    const nowIso = new Date().toISOString();
    const updatedVoucher = {
      ...list[index],
      approvalStatus: 'APPROVED' as VoucherApprovalStatus,
      approvedBy: payload.approverName || 'المدير المالي',
      approvedAt: nowIso,
      approvalRole: payload.approverRole || 'المدير المالي',
      approvalNotes: payload.notes || undefined,
      rejectedBy: undefined,
      rejectedAt: undefined,
      rejectionReason: undefined,
    };

    list[index] = updatedVoucher;
    localStorage.setItem(key, JSON.stringify(list));

    // Dispatch system events
    dispatchPartnerLedgerUpdated();
    window.dispatchEvent(new CustomEvent('alpha-voucher-approval-updated', { detail: { voucherId: payload.voucherId, action: 'APPROVE', voucher: updatedVoucher } }));
    window.dispatchEvent(new Event('alpha-vouchers-updated'));

    return { success: true, message: 'تم اعتماد السند بنجاح', voucher: updatedVoucher };
  } catch (err: any) {
    console.error('Failed to approve voucher:', err);
    return { success: false, error: err?.message || 'فشل اعتماد السند' };
  }
}

/**
 * Rejects a voucher with notes/reason
 */
export function rejectVoucherRecord(
  payloadOrId: RejectionActionPayload | string,
  voucherType?: string,
  options?: { rejectorName?: string | undefined; reason?: string | undefined }
): { success: boolean; error?: string; message?: string; voucher?: any } {
  if (typeof window === 'undefined') return { success: false, error: 'Window not defined' };

  let payload: RejectionActionPayload;
  if (typeof payloadOrId === 'string') {
    payload = {
      voucherId: payloadOrId,
      voucherType: voucherType || 'PAYMENT',
      rejectorName: options?.rejectorName || 'الإدارة المالية',
      reason: options?.reason || 'تم رفض السند بواسطة الإدارة المالية'
    };
  } else {
    payload = payloadOrId;
  }

  try {
    const key = getStorageKeyForType(payload.voucherType);
    const raw = localStorage.getItem(key);
    if (!raw) return { success: false, error: 'قائمة السندات فارغة' };

    const list: any[] = JSON.parse(raw);
    const index = list.findIndex(v => v.id === payload.voucherId);

    if (index === -1) {
      return { success: false, error: 'لم يتم العثور على السند المطلوب' };
    }

    const nowIso = new Date().toISOString();
    const updatedVoucher = {
      ...list[index],
      approvalStatus: 'REJECTED' as VoucherApprovalStatus,
      status: 'DRAFT', // If rejected, cannot remain posted
      postedAt: undefined,
      rejectedBy: payload.rejectorName || 'الإدارة المالية',
      rejectedAt: nowIso,
      rejectionReason: payload.reason || 'تم الرفض بواسطة الإدارة المالية لمراجعة البيانات والمبالغ',
      approvedBy: undefined,
      approvedAt: undefined,
    };

    list[index] = updatedVoucher;
    localStorage.setItem(key, JSON.stringify(list));

    dispatchPartnerLedgerUpdated();
    window.dispatchEvent(new CustomEvent('alpha-voucher-approval-updated', { detail: { voucherId: payload.voucherId, action: 'REJECT', voucher: updatedVoucher } }));
    window.dispatchEvent(new Event('alpha-vouchers-updated'));

    return { success: true, message: 'تم رفض السند بنجاح', voucher: updatedVoucher };
  } catch (err: any) {
    console.error('Failed to reject voucher:', err);
    return { success: false, error: err?.message || 'فشل رفض السند' };
  }
}

/**
 * Resets a voucher approval status back to PENDING_APPROVAL or DRAFT
 */
export function resetVoucherApproval(voucherId: string, voucherType: string): { success: boolean; error?: string } {
  if (typeof window === 'undefined') return { success: false };

  try {
    const key = getStorageKeyForType(voucherType);
    const raw = localStorage.getItem(key);
    if (!raw) return { success: false };

    const list: any[] = JSON.parse(raw);
    const index = list.findIndex(v => v.id === voucherId);
    if (index === -1) return { success: false };

    const voucher = list[index];
    const check = isApprovalRequired(voucher.amount);

    list[index] = {
      ...voucher,
      approvalStatus: check.required ? 'PENDING_APPROVAL' : 'NOT_REQUIRED',
      approvedBy: undefined,
      approvedAt: undefined,
      approvalRole: undefined,
      approvalNotes: undefined,
      rejectedBy: undefined,
      rejectedAt: undefined,
      rejectionReason: undefined,
    };

    localStorage.setItem(key, JSON.stringify(list));
    dispatchPartnerLedgerUpdated();
    window.dispatchEvent(new CustomEvent('alpha-voucher-approval-updated', { detail: { voucherId, action: 'RESET' } }));
    window.dispatchEvent(new Event('alpha-vouchers-updated'));

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * Loads all vouchers waiting for approval across external and internal vouchers
 */
export function loadAllPendingApprovals(customSettings?: SystemSettings): PendingApprovalItem[] {
  if (typeof window === 'undefined') return [];

  const settings = customSettings || getSystemSettings();
  const workflow = settings.approvalWorkflow;
  if (!workflow || !workflow.enabled) return [];

  const results: PendingApprovalItem[] = [];

  const readList = (key: string, vType: string, category: VoucherCategory, categoryLabel: string, typeLabel: string) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const list: any[] = JSON.parse(raw);
      if (!Array.isArray(list)) return;

      for (const v of list) {
        const amt = Number(v.amount) || 0;
        const check = isApprovalRequired(amt, settings);

        // If it requires approval and is either pending or not approved yet and not posted
        const approvalStatus: VoucherApprovalStatus = v.approvalStatus || (check.required ? 'PENDING_APPROVAL' : 'NOT_REQUIRED');

        if (check.required && approvalStatus === 'PENDING_APPROVAL') {
          const party = v.partnerName || v.paidTo || v.receivedFrom || v.fromAccountName || 'طرف داخلي / خارجي';
          results.push({
            id: v.id,
            voucherNumber: v.voucherNumber,
            voucherType: vType,
            category,
            categoryLabel,
            typeLabel,
            amount: amt,
            date: v.date || '',
            partyName: party,
            description: v.description || '',
            approvalStatus,
            requiredRole: check.requiredRole,
            preparedBy: v.preparedBy || v.disbursedBy || 'المحاسب',
            createdAt: v.createdAt,
            status: v.status || 'DRAFT'
          });
        }
      }
    } catch (e) {
      console.error(`Failed to read pending approvals for ${key}:`, e);
    }
  };

  // External
  readList(DB_RECEIPT_VOUCHERS_KEY, 'RECEIPT', 'EXTERNAL', 'سندات خارجية', 'سند قبض خارجي');
  readList(DB_PAYMENT_VOUCHERS_KEY, 'PAYMENT', 'EXTERNAL', 'سندات خارجية', 'سند صرف خارجي');

  // Internal (if enabled for internal vouchers)
  if (workflow.enableForInternalVouchers !== false) {
    readList(DB_INTERNAL_PAYMENT_VOUCHERS_KEY, 'INTERNAL_PAYMENT', 'INTERNAL', 'سندات داخلية', 'سند صرف داخلي ومصروفات');
    readList(DB_INTERNAL_RECEIPT_VOUCHERS_KEY, 'INTERNAL_RECEIPT', 'INTERNAL', 'سندات داخلية', 'سند قبض وتوريد داخلي');
    readList(DB_INTERNAL_VOUCHERS_KEY, 'INTERNAL_TRANSFER', 'INTERNAL', 'سندات داخلية', 'تحويل داخلي بين الخزائن');
  }

  // Sort by date descending
  return results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

/**
 * Quick count of pending approvals
 */
export function countPendingApprovals(): number {
  return loadAllPendingApprovals().length;
}
