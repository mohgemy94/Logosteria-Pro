import { useState, useEffect } from 'react';
import { Archive, Lock, RotateCcw } from 'lucide-react';
import { 
  getSelectedBrowsingYear, 
  getActiveFiscalYear, 
  isBrowsingArchivedYear, 
  returnToLiveActiveYear, 
  FISCAL_YEAR_CHANGED_EVENT 
} from '../utils/fiscalYearArchive';

interface FiscalYearArchiveBannerProps {
  onNavigateToYearEnd?: () => void;
}

export default function FiscalYearArchiveBanner({
  onNavigateToYearEnd
}: FiscalYearArchiveBannerProps) {
  const [browsingYear, setBrowsingYear] = useState<number>(() => getSelectedBrowsingYear());
  const [isArchived, setIsArchived] = useState<boolean>(() => isBrowsingArchivedYear());
  const activeYear = getActiveFiscalYear();

  useEffect(() => {
    const handleUpdate = () => {
      setBrowsingYear(getSelectedBrowsingYear());
      setIsArchived(isBrowsingArchivedYear());
    };

    window.addEventListener(FISCAL_YEAR_CHANGED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(FISCAL_YEAR_CHANGED_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  if (!isArchived) return null;

  return (
    <div 
      className="mb-4 bg-linear-to-r from-amber-500/15 via-amber-500/10 to-amber-600/15 border-2 border-amber-500/30 rounded-2xl p-3.5 sm:p-4 text-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
      dir="rtl"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20 font-black">
          <Archive size={20} />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-black text-sm text-slate-900">
              أنت تتصفح حالياً أرشيف السنة المالية ({browsingYear})
            </h4>
            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
              <Lock size={12} />
              وضع القراءة والطباعة فقط
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            يمكنك تصفح كشوف الحسابات وميزان المراجعة والتقارير وطباعتها. تم تعطيل الحفظ والتعديل لحماية بيانات العام المقفل. العمليات التشغيلية تتم في السنة الحالية ({activeYear}).
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
        <button
          type="button"
          onClick={() => returnToLiveActiveYear()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          <RotateCcw size={14} className="text-amber-400" />
          <span>العودة للسنة النشطة ({activeYear})</span>
        </button>

        {onNavigateToYearEnd && (
          <button
            type="button"
            onClick={onNavigateToYearEnd}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <span>شاشة الإقفال</span>
          </button>
        )}
      </div>
    </div>
  );
}
