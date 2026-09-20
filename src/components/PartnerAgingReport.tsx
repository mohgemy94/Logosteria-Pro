import { useState, useMemo } from 'react';
import { 
  Users, 
  Truck, 
  Search, 
  Eye, 
  AlertTriangle, 
  Clock, 
  ShieldAlert, 
  ShieldCheck, 
  FileCheck, 
  ArrowDownLeft,
  ArrowUpRight,
  Calendar
} from 'lucide-react';
import { PartnerBalanceItem } from './PartnerBalances';
import { useSystemCurrency } from '../utils/currency';
import ExportButtonGroup from './ExportButtonGroup';

interface PartnerAgingReportProps {
  partners: PartnerBalanceItem[];
  currencySymbol?: string;
  onOpenStatement: (partner: PartnerBalanceItem) => void;
  onOpenConfirmation: (partner: PartnerBalanceItem) => void;
  onQuickVoucher: (partner: PartnerBalanceItem, actionType: 'RECEIPT' | 'PAYMENT') => void;
}

export interface AgingBucketItem {
  partner: PartnerBalanceItem;
  totalBalance: number;
  balanceType: 'DEBIT' | 'CREDIT' | 'ZERO';
  bucketCurrent: number;   // 1 - 30 days
  bucket30to60: number;    // 31 - 60 days
  bucket60to90: number;    // 61 - 90 days
  bucketOver90: number;    // > 90 days
  oldestDate: string;
  newestDate: string;
  daysOldest: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isOverLimit: boolean;
}

export default function PartnerAgingReport({
  partners,
  currencySymbol: customCurrency,
  onOpenStatement,
  onOpenConfirmation,
  onQuickVoucher
}: PartnerAgingReportProps) {
  const { symbol: defaultCurrency } = useSystemCurrency();
  const currencySymbol = customCurrency || defaultCurrency;
  const [searchQuery, setSearchQuery] = useState('');
  const [partnerTypeFilter, setPartnerTypeFilter] = useState<'ALL' | 'CUSTOMER' | 'VENDOR'>('ALL');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('ALL');
  const [onlyOverLimit, setOnlyOverLimit] = useState(false);

  // Helper to compute aging buckets for each partner
  const agingData = useMemo(() => {
    const today = new Date();

    return partners
      .filter(p => p.calc.balanceAmount > 0.001) // only accounts with active balance
      .map(p => {
        const totalBalance = p.calc.balanceAmount;
        const balanceType = p.calc.balanceType;

        // Collect transactions or approximate from lastTransactionDate
        let bucketCurrent = 0;
        let bucket30to60 = 0;
        let bucket60to90 = 0;
        let bucketOver90 = 0;

        // If partner has explicit transactions array, apply FIFO backward allocation
        const txs = (p.transactions || []).filter(tx => {
          if (balanceType === 'DEBIT') return tx.debit > 0;
          if (balanceType === 'CREDIT') return tx.credit > 0;
          return true;
        });

        if (txs.length > 0) {
          // Sort transactions descending by date (newest first)
          const sortedTxs = [...txs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          let unallocated = totalBalance;

          for (const tx of sortedTxs) {
            if (unallocated <= 0.001) break;
            const txAmt = balanceType === 'DEBIT' ? tx.debit : tx.credit;
            if (txAmt <= 0) continue;

            const alloc = Math.min(unallocated, txAmt);
            const txDate = new Date(tx.date);
            const diffDays = Math.max(0, Math.floor((today.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24)));

            if (diffDays <= 30) {
              bucketCurrent += alloc;
            } else if (diffDays <= 60) {
              bucket30to60 += alloc;
            } else if (diffDays <= 90) {
              bucket60to90 += alloc;
            } else {
              bucketOver90 += alloc;
            }

            unallocated -= alloc;
          }

          // If there is still unallocated balance, it goes to the oldest bucket (>90 days)
          if (unallocated > 0.001) {
            bucketOver90 += unallocated;
          }
        } else {
          // Fallback based on lastTransactionDate or opening balance
          const dateStr = p.lastTransactionDate || '2024-01-01';
          const lastDate = new Date(dateStr);
          const diffDays = Math.max(0, Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)));

          if (diffDays <= 30) {
            bucketCurrent = totalBalance * 0.7;
            bucket30to60 = totalBalance * 0.3;
          } else if (diffDays <= 60) {
            bucket30to60 = totalBalance * 0.6;
            bucket60to90 = totalBalance * 0.4;
          } else if (diffDays <= 90) {
            bucket60to90 = totalBalance * 0.7;
            bucketOver90 = totalBalance * 0.3;
          } else {
            bucketOver90 = totalBalance;
          }
        }

        // Determine days of oldest debt
        let daysOldest = 0;
        if (p.lastTransactionDate) {
          daysOldest = Math.max(0, Math.floor((today.getTime() - new Date(p.lastTransactionDate).getTime()) / (1000 * 60 * 60 * 24)));
        }

        // Risk Level Evaluation:
        // - CRITICAL: Over 90 days has majority (> 40%) or > 60 days has > 60%
        // - HIGH: 61-90 days has > 30%
        // - MEDIUM: 31-60 days has > 40%
        // - LOW: mostly in 1-30 days
        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
        const over90Ratio = bucketOver90 / totalBalance;
        const over60Ratio = (bucket60to90 + bucketOver90) / totalBalance;

        if (over90Ratio > 0.35 || bucketOver90 > 25000) {
          riskLevel = 'CRITICAL';
        } else if (over60Ratio > 0.4 || bucket60to90 > 15000) {
          riskLevel = 'HIGH';
        } else if (bucket30to60 / totalBalance > 0.35) {
          riskLevel = 'MEDIUM';
        } else {
          riskLevel = 'LOW';
        }

        // Credit Limit check
        const isOverLimit = !!(p.notes?.includes('creditLimit') || (p as any).creditLimit && totalBalance > (p as any).creditLimit);

        return {
          partner: p,
          totalBalance,
          balanceType,
          bucketCurrent,
          bucket30to60,
          bucket60to90,
          bucketOver90,
          oldestDate: p.lastTransactionDate || '-',
          newestDate: p.lastTransactionDate || '-',
          daysOldest,
          riskLevel,
          isOverLimit
        };
      });
  }, [partners]);

  // Overall Aggregate KPIs
  const summaryTotals = useMemo(() => {
    let sumTotal = 0;
    let sumCurrent = 0;
    let sum30to60 = 0;
    let sum60to90 = 0;
    let sumOver90 = 0;
    let criticalCount = 0;

    agingData.forEach(item => {
      sumTotal += item.totalBalance;
      sumCurrent += item.bucketCurrent;
      sum30to60 += item.bucket30to60;
      sum60to90 += item.bucket60to90;
      sumOver90 += item.bucketOver90;
      if (item.riskLevel === 'CRITICAL' || item.riskLevel === 'HIGH') {
        criticalCount++;
      }
    });

    return {
      sumTotal,
      sumCurrent,
      sum30to60,
      sum60to90,
      sumOver90,
      criticalCount,
      count: agingData.length
    };
  }, [agingData]);

  // Filtered Aging List
  const filteredAging = useMemo(() => {
    return agingData.filter(item => {
      if (partnerTypeFilter !== 'ALL' && item.partner.type !== partnerTypeFilter) return false;
      if (riskFilter !== 'ALL' && item.riskLevel !== riskFilter) return false;
      if (onlyOverLimit && !item.isOverLimit) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.partner.name.toLowerCase().includes(q);
        const matchCode = item.partner.code.toLowerCase().includes(q);
        const matchPhone = item.partner.phone && item.partner.phone.includes(q);
        return matchName || matchCode || matchPhone;
      }
      return true;
    });
  }, [agingData, partnerTypeFilter, riskFilter, onlyOverLimit, searchQuery]);

  const getRiskBadge = (level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
            <ShieldAlert size={11} /> حرج (+90 يوم)
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle size={11} /> متأخر (60-90)
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock size={11} /> متوسط (30-60)
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <ShieldCheck size={11} /> جاري (&lt;30 يوم)
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* 4 Main Aging KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Bucket 1: 1 - 30 Days (Current) */}
        <div className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">1 - 30 يوماً (ديون جارية)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-emerald-700">
              {summaryTotals.sumCurrent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              <span className="text-xs font-normal text-slate-400 mr-1.5">{currencySymbol}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
              <span>النسبة من الإجمالي:</span>
              <span className="font-bold font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                {summaryTotals.sumTotal > 0 ? Math.round((summaryTotals.sumCurrent / summaryTotals.sumTotal) * 100) : 0}%
              </span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>حركات حديثة ضمن فترة الائتمان الطبيعية</span>
          </div>
        </div>

        {/* Bucket 2: 31 - 60 Days */}
        <div className="bg-white rounded-2xl border border-blue-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">31 - 60 يوماً (متوسطة الأجل)</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-blue-700">
              {summaryTotals.sum30to60.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              <span className="text-xs font-normal text-slate-400 mr-1.5">{currencySymbol}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
              <span>النسبة من الإجمالي:</span>
              <span className="font-bold font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                {summaryTotals.sumTotal > 0 ? Math.round((summaryTotals.sum30to60 / summaryTotals.sumTotal) * 100) : 0}%
              </span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>تستوجب التذكير والإشعار قبل نهاية الشهر</span>
          </div>
        </div>

        {/* Bucket 3: 61 - 90 Days */}
        <div className="bg-white rounded-2xl border border-amber-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">61 - 90 يوماً (متأخرة السداد)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-amber-700">
              {summaryTotals.sum60to90.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              <span className="text-xs font-normal text-slate-400 mr-1.5">{currencySymbol}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
              <span>النسبة من الإجمالي:</span>
              <span className="font-bold font-mono bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                {summaryTotals.sumTotal > 0 ? Math.round((summaryTotals.sum60to90 / summaryTotals.sumTotal) * 100) : 0}%
              </span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-amber-700 font-semibold flex items-center gap-1">
            <AlertTriangle size={12} className="text-amber-500" />
            <span>تتطلب متابعة هاتفية وتوجيه خطابات مطالبة</span>
          </div>
        </div>

        {/* Bucket 4: > 90 Days (Critical) */}
        <div className="bg-white rounded-2xl border border-rose-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-800">أكثر من 90 يوماً (ديون راكدة)</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <ShieldAlert size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-rose-700">
              {summaryTotals.sumOver90.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              <span className="text-xs font-normal text-slate-400 mr-1.5">{currencySymbol}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
              <span>نسبة المخاطر:</span>
              <span className="font-bold font-mono bg-rose-100 text-rose-800 px-2 py-0.5 rounded">
                {summaryTotals.sumTotal > 0 ? Math.round((summaryTotals.sumOver90 / summaryTotals.sumTotal) * 100) : 0}%
              </span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-rose-100 text-[10px] text-rose-700 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
            <span>تستدعي إيقاف التعامل وإصدار مصادقات فورية</span>
          </div>
        </div>

      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
        
        {/* Search Input */}
        <div className="relative w-full lg:w-80">
          <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم، الكود، الهاتف..."
            className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Filter Badges & Selects */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          
          {/* Partner Type */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setPartnerTypeFilter('ALL')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                partnerTypeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل
            </button>
            <button
              type="button"
              onClick={() => setPartnerTypeFilter('CUSTOMER')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                partnerTypeFilter === 'CUSTOMER' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={12} /> عملاء
            </button>
            <button
              type="button"
              onClick={() => setPartnerTypeFilter('VENDOR')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                partnerTypeFilter === 'VENDOR' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck size={12} /> موردون
            </button>
          </div>

          {/* Risk Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-semibold">المخاطر:</span>
            <select
              value={riskFilter}
              onChange={e => setRiskFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="ALL">كافة المستويات ({agingData.length})</option>
              <option value="CRITICAL">حرج (&gt;90 يوماً)</option>
              <option value="HIGH">متأخر (60-90 يوماً)</option>
              <option value="MEDIUM">متوسط (30-60 يوماً)</option>
              <option value="LOW">جاري (&lt;30 يوماً)</option>
            </select>
          </div>

          {/* Over Limit Toggle */}
          <button
            type="button"
            onClick={() => setOnlyOverLimit(prev => !prev)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
              onlyOverLimit
                ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle size={13} className={onlyOverLimit ? 'text-rose-600' : 'text-slate-400'} />
            <span>تجاوز الحد فقط</span>
          </button>

          {/* Export Buttons */}
          <ExportButtonGroup
            title="تقرير أعمار الديون ومصفوفة تعمير الذمم المالية"
            filename="اعمار_الديون_والذمم"
            headers={[
              'الكود',
              'الاسم',
              'النوع',
              'الهاتف',
              'طبيعة الرصيد',
              'إجمالي الرصيد',
              '1 - 30 يوماً (جاري)',
              '31 - 60 يوماً',
              '61 - 90 يوماً',
              'أكثر من 90 يوماً (راكد)',
              'مستوى المخاطر'
            ]}
            rows={filteredAging.map(item => [
              item.partner.code,
              item.partner.name,
              item.partner.type === 'CUSTOMER' ? 'عميل' : 'مورد',
              item.partner.phone || '-',
              item.balanceType === 'DEBIT' ? 'مدين (لنا)' : 'دائن (له)',
              item.totalBalance,
              item.bucketCurrent,
              item.bucket30to60,
              item.bucket60to90,
              item.bucketOver90,
              item.riskLevel === 'CRITICAL' ? 'حرج' : item.riskLevel === 'HIGH' ? 'مرتفع' : item.riskLevel === 'MEDIUM' ? 'متوسط' : 'منخفض'
            ])}
            size="sm"
          />

          <button
            type="button"
            onClick={() => window.print()}
            className="btn-3d btn-3d-blue px-3.5 py-1.5 text-xs font-black flex items-center gap-1.5"
            title="طباعة تقرير أعمار الديون"
          >
            <span>طباعة التقرير</span>
          </button>

        </div>
      </div>

      {/* Main Aging Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={17} className="text-indigo-600" />
            <h4 className="font-bold text-slate-800 text-sm">
              جدول مصفوفة أعمار الديون والذمم وتوزيع الفترات الزمنية
            </h4>
            <span className="text-xs bg-slate-200/80 px-2 py-0.5 rounded-full font-mono text-slate-600">
              {filteredAging.length} طرف تعامل
            </span>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> 1-30 يوم
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> 31-60 يوم
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 61-90 يوم
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> &gt;90 يوم
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                <th className="p-3.5 text-right">كود الحساب</th>
                <th className="p-3.5 text-right">الاسم التجاري / الطرف</th>
                <th className="p-3.5 text-center">النوع</th>
                <th className="p-3.5 text-left font-mono text-slate-900 font-black">إجمالي الرصيد</th>
                <th className="p-3.5 text-left font-mono text-emerald-700 font-bold bg-emerald-50/50">1 - 30 يوماً</th>
                <th className="p-3.5 text-left font-mono text-blue-700 font-bold bg-blue-50/50">31 - 60 يوماً</th>
                <th className="p-3.5 text-left font-mono text-amber-700 font-bold bg-amber-50/50">61 - 90 يوماً</th>
                <th className="p-3.5 text-left font-mono text-rose-700 font-bold bg-rose-50/50">&gt; 90 يوماً (راكد)</th>
                <th className="p-3.5 text-center">المخاطر</th>
                <th className="p-3.5 text-center print:hidden">إجراءات المتابعة والتحصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAging.map(item => {
                const isDebit = item.balanceType === 'DEBIT';
                const isCustomer = item.partner.type === 'CUSTOMER';
                return (
                  <tr key={item.partner.id} className="hover:bg-slate-50/80 transition-colors">
                    
                    <td className="p-3.5 font-mono text-slate-500 font-semibold">{item.partner.code}</td>
                    
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{item.partner.name}</span>
                        {item.isOverLimit && (
                          <span className="text-[10px] font-black bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded border border-rose-200">
                            تجاوز الحد
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                        {item.partner.phone && <span>هاتف: {item.partner.phone}</span>}
                        {item.partner.lastTransactionDate && <span>آخر تعامل: {item.partner.lastTransactionDate}</span>}
                      </div>
                    </td>

                    <td className="p-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        isCustomer 
                          ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}>
                        {isCustomer ? <Users size={11} /> : <Truck size={11} />}
                        {isCustomer ? 'عميل' : 'مورد'}
                      </span>
                    </td>

                    <td className="p-3.5 text-left font-mono font-black text-sm">
                      <span className={isDebit ? 'text-emerald-700' : 'text-amber-700'}>
                        {item.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] font-normal text-slate-400 mr-1">{currencySymbol}</span>
                      <span className="block text-[10px] font-normal text-slate-400">
                        {isDebit ? '(مدين - لنا)' : '(دائن - له)'}
                      </span>
                    </td>

                    {/* Bucket 1: 1 - 30 */}
                    <td className="p-3.5 text-left font-mono font-bold text-emerald-700 bg-emerald-50/20">
                      {item.bucketCurrent > 0.01 ? item.bucketCurrent.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </td>

                    {/* Bucket 2: 31 - 60 */}
                    <td className="p-3.5 text-left font-mono font-bold text-blue-700 bg-blue-50/20">
                      {item.bucket30to60 > 0.01 ? item.bucket30to60.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </td>

                    {/* Bucket 3: 61 - 90 */}
                    <td className="p-3.5 text-left font-mono font-bold text-amber-700 bg-amber-50/20">
                      {item.bucket60to90 > 0.01 ? item.bucket60to90.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </td>

                    {/* Bucket 4: > 90 */}
                    <td className="p-3.5 text-left font-mono font-black text-rose-700 bg-rose-50/20">
                      {item.bucketOver90 > 0.01 ? item.bucketOver90.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </td>

                    {/* Risk Badge */}
                    <td className="p-3.5 text-center whitespace-nowrap">
                      {getRiskBadge(item.riskLevel)}
                    </td>

                    {/* Quick Follow-up Actions */}
                    <td className="p-3.5 text-center print:hidden whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        
                        {/* Quick Receipt (if Debit) or Quick Payment (if Credit) */}
                        {isDebit ? (
                          <button
                            type="button"
                            onClick={() => onQuickVoucher(item.partner, 'RECEIPT')}
                            className="btn-3d btn-3d-success-soft px-2 py-1 text-[11px] font-black flex items-center gap-1"
                            title="إنشاء سند قبض فوري للتحصيل"
                          >
                            <ArrowDownLeft size={12} /> قبض
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onQuickVoucher(item.partner, 'PAYMENT')}
                            className="btn-3d btn-3d-warning-soft px-2 py-1 text-[11px] font-black flex items-center gap-1"
                            title="إنشاء سند صرف فوري للسداد"
                          >
                            <ArrowUpRight size={12} /> صرف
                          </button>
                        )}

                        {/* Balance Confirmation Letter */}
                        <button
                          type="button"
                          onClick={() => onOpenConfirmation(item.partner)}
                          className="btn-3d btn-3d-white px-2 py-1 text-[11px] font-bold flex items-center gap-1 text-slate-700 hover:text-indigo-600"
                          title="إصدار خطاب مصادقة وتأكيد رصيد"
                        >
                          <FileCheck size={12} className="text-indigo-600" />
                          <span>مصادقة</span>
                        </button>

                        {/* Statement View */}
                        <button
                          type="button"
                          onClick={() => onOpenStatement(item.partner)}
                          className="btn-3d btn-3d-blue px-2 py-1 text-[11px] font-bold flex items-center gap-1"
                          title="عرض كشف الحساب التفصيلي"
                        >
                          <Eye size={12} />
                          <span>كشف</span>
                        </button>

                      </div>
                    </td>

                  </tr>
                );
              })}

              {filteredAging.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 text-sm">
                    لا توجد أرصدة مطابقة لمعايير البحث الحالية.
                  </td>
                </tr>
              )}
            </tbody>

            {/* Table Footer Summary */}
            <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
              <tr>
                <td colSpan={3} className="p-3.5 text-right font-bold text-xs">
                  إجمالي الأرصدة القائمة ({filteredAging.length} طرف):
                </td>
                <td className="p-3.5 text-left font-mono text-slate-900 text-xs">
                  {filteredAging.reduce((acc, i) => acc + i.totalBalance, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                </td>
                <td className="p-3.5 text-left font-mono text-emerald-700 text-xs">
                  {filteredAging.reduce((acc, i) => acc + i.bucketCurrent, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="p-3.5 text-left font-mono text-blue-700 text-xs">
                  {filteredAging.reduce((acc, i) => acc + i.bucket30to60, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="p-3.5 text-left font-mono text-amber-700 text-xs">
                  {filteredAging.reduce((acc, i) => acc + i.bucket60to90, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="p-3.5 text-left font-mono text-rose-700 text-xs">
                  {filteredAging.reduce((acc, i) => acc + i.bucketOver90, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>

    </div>
  );
}
