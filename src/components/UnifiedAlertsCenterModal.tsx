import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Bell, 
  X, 
  Calendar, 
  AlertTriangle, 
  Clock, 
  CreditCard, 
  FileText, 
  Package, 
  ArrowLeft, 
  ExternalLink, 
  CheckCircle2, 
  DollarSign, 
  Search,
  Filter,
  Warehouse,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { loadBankChecks, type BankCheck } from '../utils/checkStore';
import { getStoredInstallments, getStoredPromissoryNotes } from '../data/mockInstallments';
import { type InstallmentContract, type PromissoryNote } from '../types/installment';
import { loadStoredItems, type Item } from '../utils/itemsStore';
import { loadStoredSalesInvoices, type StoredSalesInvoice } from '../utils/salesStore';
import { useSystemCurrency } from '../utils/currency';

export type AlertCategory = 'ALL' | 'CHECKS' | 'INSTALLMENTS' | 'LOW_STOCK' | 'OVERDUE_INVOICES';

export interface UnifiedAlertItem {
  id: string;
  category: 'CHECKS' | 'INSTALLMENTS' | 'LOW_STOCK' | 'OVERDUE_INVOICES';
  title: string;
  documentNumber: string;
  partyOrItemName: string;
  amountOrQuantity: string;
  numericAmount?: number;
  dueDateOrStatus: string;
  urgency: 'CRITICAL' | 'WARNING' | 'INFO';
  urgencyLabel: string;
  targetScreen: string;
  description: string;
}

export function useUnifiedAlerts() {
  const [alerts, setAlerts] = useState<UnifiedAlertItem[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const computeAlerts = useCallback(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result: UnifiedAlertItem[] = [];

    // 1. Due Checks (شيكات مستحقة اليوم أو متأخرة)
    try {
      const checks = loadBankChecks();
      checks.forEach(chk => {
        if (chk.status === 'UNDER_COLLECTION' || chk.status === 'PENDING') {
          const chkDueDate = chk.dueDate || chk.issueDate;
          if (chkDueDate && chkDueDate <= todayStr) {
            const isToday = chkDueDate === todayStr;
            const checkDate = new Date(chkDueDate);
            checkDate.setHours(0, 0, 0, 0);
            const daysDiff = Math.max(0, Math.floor((today.getTime() - checkDate.getTime()) / (1000 * 60 * 60 * 24)));

            result.push({
              id: `chk-${chk.id}`,
              category: 'CHECKS',
              title: chk.type === 'RECEIVED' ? 'شيك وارد برسم التحصيل مستحق' : 'شيك صادر مستحق الصرف',
              documentNumber: chk.checkNumber || `#${chk.id}`,
              partyOrItemName: chk.beneficiaryOrIssuer || chk.bankName,
              amountOrQuantity: `${Number(chk.amount || 0).toLocaleString()} ${chk.currency || 'ر.س'}`,
              numericAmount: Number(chk.amount || 0),
              dueDateOrStatus: isToday ? 'مستحق اليوم' : `متأخر منذ ${daysDiff} يوم (${chkDueDate})`,
              urgency: daysDiff > 0 ? 'CRITICAL' : 'WARNING',
              urgencyLabel: daysDiff > 0 ? 'متأخر التحصيل' : 'مستحق اليوم',
              targetScreen: 'checkPortfolio',
              description: `بنك: ${chk.bankName} - الطرف: ${chk.beneficiaryOrIssuer}`
            });
          }
        }
      });
    } catch (e) {
      console.error('Error computing due checks:', e);
    }

    // 2. Due Installments & Promissory Notes (أقساط وكمبيالات حالة)
    try {
      const contracts = getStoredInstallments();
      contracts.forEach(contract => {
        (contract.schedule || []).forEach(sch => {
          if ((sch.status === 'PENDING' || sch.status === 'OVERDUE') && sch.dueDate <= todayStr) {
            const isToday = sch.dueDate === todayStr;
            const dDate = new Date(sch.dueDate);
            dDate.setHours(0, 0, 0, 0);
            const daysDiff = Math.max(0, Math.floor((today.getTime() - dDate.getTime()) / (1000 * 60 * 60 * 24)));

            result.push({
              id: `inst-${contract.id}-${sch.installmentNumber}`,
              category: 'INSTALLMENTS',
              title: `قسط مستحق (${contract.contractNumber || 'عقد تقسيط'})`,
              documentNumber: `قسط #${sch.installmentNumber}`,
              partyOrItemName: contract.customerName,
              amountOrQuantity: `${Number(sch.amount || 0).toLocaleString()} ر.س`,
              numericAmount: Number(sch.amount || 0),
              dueDateOrStatus: isToday ? 'مستحق اليوم' : `متأخر منذ ${daysDiff} يوم (${sch.dueDate})`,
              urgency: daysDiff > 0 ? 'CRITICAL' : 'WARNING',
              urgencyLabel: daysDiff > 0 ? 'قسط متعثر' : 'مستحق اليوم',
              targetScreen: 'installments',
              description: `عقد: ${contract.contractNumber} - العميل: ${contract.customerName}`
            });
          }
        });
      });

      const notes = getStoredPromissoryNotes();
      notes.forEach(note => {
        if ((note.status === 'ACTIVE' || note.status === 'OVERDUE') && note.dueDate <= todayStr) {
          const isToday = note.dueDate === todayStr;
          const dDate = new Date(note.dueDate);
          dDate.setHours(0, 0, 0, 0);
          const daysDiff = Math.max(0, Math.floor((today.getTime() - dDate.getTime()) / (1000 * 60 * 60 * 24)));

          result.push({
            id: `note-${note.id}`,
            category: 'INSTALLMENTS',
            title: 'سند لأمر / كمبيالة حالة السداد',
            documentNumber: note.noteNumber || `#${note.id}`,
            partyOrItemName: note.debtorName,
            amountOrQuantity: `${Number(note.amount || 0).toLocaleString()} ر.س`,
            numericAmount: Number(note.amount || 0),
            dueDateOrStatus: isToday ? 'مستحقة اليوم' : `متأخرة منذ ${daysDiff} يوم (${note.dueDate})`,
            urgency: daysDiff > 0 ? 'CRITICAL' : 'WARNING',
            urgencyLabel: daysDiff > 0 ? 'كمبيالة متعثرة' : 'مستحقة اليوم',
            targetScreen: 'installments',
            description: `المدين: ${note.debtorName} - الاستحقاق: ${note.dueDate}`
          });
        }
      });
    } catch (e) {
      console.error('Error computing installments:', e);
    }

    // 3. Low Stock Reorder Shortages (أصناف بلغت حد الطلب)
    try {
      const items = loadStoredItems();
      items.forEach(it => {
        const stock = Number(it.stock) || 0;
        const reorderLevel = Number(it.minReorderLevel) || 10;
        if (stock <= reorderLevel) {
          const isZero = stock <= 0;
          result.push({
            id: `stock-${it.id}`,
            category: 'LOW_STOCK',
            title: isZero ? 'نفاد تام للمخزون (رصيد صفر)' : 'صنف بلغ حد إعادة الطلب الأدنى',
            documentNumber: it.code || `#${it.id}`,
            partyOrItemName: it.name,
            amountOrQuantity: `${stock} ${it.unit || 'حبة'} (حد الطلب: ${reorderLevel})`,
            numericAmount: stock,
            dueDateOrStatus: isZero ? 'رصيد نافذ 0' : `متبقي ${stock} فقط`,
            urgency: isZero ? 'CRITICAL' : 'WARNING',
            urgencyLabel: isZero ? 'نفاد تام' : 'حد الطلب',
            targetScreen: 'items',
            description: `المستودع: ${it.warehouseName || 'المستودع الرئيسي'} - كود: ${it.code}`
          });
        }
      });
    } catch (e) {
      console.error('Error computing low stock items:', e);
    }

    // 4. Overdue Credit Sales Invoices (فواتير آجلة متأخرة)
    try {
      const invoices = loadStoredSalesInvoices();
      invoices.forEach(inv => {
        if (inv.status === 'POSTED') {
          const remaining = inv.totals?.remainingBalance !== undefined 
            ? Number(inv.totals.remainingBalance) 
            : (inv.invoiceType === 'CREDIT' ? Number(inv.totals?.grandTotal || 0) : 0);

          if (remaining > 0 && inv.dueDate && inv.dueDate < todayStr) {
            const dDate = new Date(inv.dueDate);
            dDate.setHours(0, 0, 0, 0);
            const daysDiff = Math.max(1, Math.floor((today.getTime() - dDate.getTime()) / (1000 * 60 * 60 * 24)));

            result.push({
              id: `inv-${inv.id}`,
              category: 'OVERDUE_INVOICES',
              title: 'فاتورة مبيعات آجلة متأخرة السداد',
              documentNumber: inv.invoiceNumber || `#${inv.id}`,
              partyOrItemName: inv.partnerName || 'عميل',
              amountOrQuantity: `${remaining.toLocaleString()} ر.س متبقي`,
              numericAmount: remaining,
              dueDateOrStatus: `متأخرة منذ ${daysDiff} يوم (استحقاق ${inv.dueDate})`,
              urgency: daysDiff > 30 ? 'CRITICAL' : 'WARNING',
              urgencyLabel: `متأخرة ${daysDiff} يوماً`,
              targetScreen: 'sales',
              description: `العميل: ${inv.partnerName} - إجمالي الفاتورة: ${Number(inv.totals?.grandTotal || 0).toLocaleString()} ر.س`
            });
          }
        }
      });
    } catch (e) {
      console.error('Error computing overdue invoices:', e);
    }

    setAlerts(result);
    setLastRefreshed(new Date());
  }, []);

  useEffect(() => {
    computeAlerts();

    const handleDataChanged = () => computeAlerts();
    window.addEventListener('alpha-checks-updated', handleDataChanged);
    window.addEventListener('alpha-installments-updated', handleDataChanged);
    window.addEventListener('alpha-promissory-notes-updated', handleDataChanged);
    window.addEventListener('alpha-stock-updated', handleDataChanged);
    window.addEventListener('alpha-items-updated', handleDataChanged);
    window.addEventListener('alpha-sales-updated', handleDataChanged);
    window.addEventListener('alpha-data-changed', handleDataChanged);
    window.addEventListener('storage', handleDataChanged);

    return () => {
      window.removeEventListener('alpha-checks-updated', handleDataChanged);
      window.removeEventListener('alpha-installments-updated', handleDataChanged);
      window.removeEventListener('alpha-promissory-notes-updated', handleDataChanged);
      window.removeEventListener('alpha-stock-updated', handleDataChanged);
      window.removeEventListener('alpha-items-updated', handleDataChanged);
      window.removeEventListener('alpha-sales-updated', handleDataChanged);
      window.removeEventListener('alpha-data-changed', handleDataChanged);
      window.removeEventListener('storage', handleDataChanged);
    };
  }, [computeAlerts]);

  return { alerts, count: alerts.length, refreshAlerts: computeAlerts, lastRefreshed };
}

interface UnifiedAlertsCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (screen: string) => void;
}

export default function UnifiedAlertsCenterModal({
  isOpen,
  onClose,
  onNavigate
}: UnifiedAlertsCenterModalProps) {
  const { alerts, count, refreshAlerts } = useUnifiedAlerts();
  const [activeCategory, setActiveCategory] = useState<AlertCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { currencySymbol } = useSystemCurrency();

  const categoryCounts = useMemo(() => {
    return {
      ALL: alerts.length,
      CHECKS: alerts.filter(a => a.category === 'CHECKS').length,
      INSTALLMENTS: alerts.filter(a => a.category === 'INSTALLMENTS').length,
      LOW_STOCK: alerts.filter(a => a.category === 'LOW_STOCK').length,
      OVERDUE_INVOICES: alerts.filter(a => a.category === 'OVERDUE_INVOICES').length,
    };
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter(item => {
      const matchCat = activeCategory === 'ALL' || item.category === activeCategory;
      if (!matchCat) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.documentNumber.toLowerCase().includes(q) ||
        item.partyOrItemName.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [alerts, activeCategory, searchQuery]);

  const handleAlertClick = (item: UnifiedAlertItem) => {
    onNavigate(item.targetScreen);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-indigo-900/40">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl bg-indigo-600/30 flex items-center justify-center border border-indigo-500/30 shadow-xs">
              <Bell className="text-amber-400" size={20} />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-slate-900">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">مركز إشعارات الاستحقاقات الموحد</h2>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-bold">
                  {count} استحقاق وتنبيه عاجل
                </span>
              </div>
              <p className="text-xs text-slate-300">متابعة فورية للشيكات المستحقة، الأقساط والكمبيالات، نواقص المخزن، والفواتير الآجلة</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshAlerts}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700"
              title="تحديث قائمة التنبيهات الآن"
            >
              تحديث
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:px-5 space-y-3 shrink-0">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>كافة الاستحقاقات</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeCategory === 'ALL' ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {categoryCounts.ALL}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('CHECKS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'CHECKS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <CreditCard size={13} />
              <span>شيكات مستحقة</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeCategory === 'CHECKS' ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {categoryCounts.CHECKS}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('INSTALLMENTS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'INSTALLMENTS'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Calendar size={13} />
              <span>أقساط وكمبيالات</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeCategory === 'INSTALLMENTS' ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {categoryCounts.INSTALLMENTS}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('LOW_STOCK')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'LOW_STOCK'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Package size={13} />
              <span>أصناف بلغت حد الطلب</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeCategory === 'LOW_STOCK' ? 'bg-amber-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {categoryCounts.LOW_STOCK}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('OVERDUE_INVOICES')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'OVERDUE_INVOICES'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <FileText size={13} />
              <span>فواتير آجلة متأخرة</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeCategory === 'OVERDUE_INVOICES' ? 'bg-rose-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {categoryCounts.OVERDUE_INVOICES}
              </span>
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث في التنبيهات برقم المستند، اسم العميل، اسم الصنف..."
              className="w-full h-9 pr-9 pl-3 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:border-indigo-600"
            />
          </div>
        </div>

        {/* Alerts List Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <CheckCircle2 size={44} className="mx-auto mb-2 text-emerald-500 opacity-80" />
              <p className="text-sm font-bold text-slate-700">لا توجد استحقاقات أو تنبيهات معلقة حالياً</p>
              <p className="text-xs text-slate-400 mt-1">كافة الشيكات والأقساط وفواتير الآجل والمخزون في حالة ممتازة ومحدثة</p>
            </div>
          ) : (
            filteredAlerts.map(alert => (
              <div
                key={alert.id}
                onClick={() => handleAlertClick(alert)}
                className="group p-3.5 bg-white hover:bg-slate-50/90 border border-slate-200 hover:border-indigo-300 rounded-xl shadow-xs transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                    alert.category === 'CHECKS' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                    alert.category === 'INSTALLMENTS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    alert.category === 'LOW_STOCK' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {alert.category === 'CHECKS' && <CreditCard size={18} />}
                    {alert.category === 'INSTALLMENTS' && <Calendar size={18} />}
                    {alert.category === 'LOW_STOCK' && <Package size={18} />}
                    {alert.category === 'OVERDUE_INVOICES' && <FileText size={18} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-xs text-slate-900 group-hover:text-indigo-700 transition-colors">
                        {alert.title}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {alert.documentNumber}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        alert.urgency === 'CRITICAL'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {alert.urgencyLabel}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 font-semibold truncate">
                      {alert.partyOrItemName}
                    </div>

                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {alert.description}
                    </div>
                  </div>
                </div>

                {/* Amount / Quantity & Action Button */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 gap-2">
                  <div className="text-right">
                    <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 block">
                      {alert.amountOrQuantity}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {alert.dueDateOrStatus}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 group-hover:bg-indigo-600 text-indigo-700 group-hover:text-white text-xs font-bold transition-all shadow-2xs">
                    <span>انتقال للمستند</span>
                    <ChevronRight size={13} className="rotate-180" />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>انقر على أي استحقاق للانتقال المباشر لشاشته وسجله</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
