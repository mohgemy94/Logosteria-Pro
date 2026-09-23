import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Calendar, 
  ChevronDown, 
  Check, 
  Lock, 
  Sparkles, 
  Archive, 
  ArrowRightLeft,
  Search,
  X
} from 'lucide-react';
import { 
  getActiveFiscalYear, 
  getAllDiscoveredFiscalYears, 
  getSelectedBrowsingYear, 
  setSelectedBrowsingYear, 
  isYearArchived, 
  FISCAL_YEAR_CHANGED_EVENT 
} from '../utils/fiscalYearArchive';
import { useLanguage } from '../i18n/LanguageContext';

export interface FiscalYearSelectorProps {
  compact?: boolean;
  fullWidth?: boolean;
  placement?: 'auto' | 'top' | 'bottom';
  className?: string;
  onNavigateToYearEnd?: () => void;
}

export default function FiscalYearSelector({ 
  compact = false,
  fullWidth = false,
  placement = 'auto',
  className = '',
  onNavigateToYearEnd 
}: FiscalYearSelectorProps) {
  const { language, isRtl, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(() => getSelectedBrowsingYear());
  const [availableYears, setAvailableYears] = useState<number[]>(() => getAllDiscoveredFiscalYears());
  const [searchQuery, setSearchQuery] = useState('');
  const [computedPlacement, setComputedPlacement] = useState<'top' | 'bottom'>('top');
  
  const activeYear = getActiveFiscalYear();
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync state on change events
  useEffect(() => {
    const handleFiscalYearChanged = () => {
      setSelectedYear(getSelectedBrowsingYear());
      setAvailableYears(getAllDiscoveredFiscalYears());
    };

    window.addEventListener(FISCAL_YEAR_CHANGED_EVENT, handleFiscalYearChanged);
    window.addEventListener('alpha-settings-updated', handleFiscalYearChanged);
    window.addEventListener('storage', handleFiscalYearChanged);
    return () => {
      window.removeEventListener(FISCAL_YEAR_CHANGED_EVENT, handleFiscalYearChanged);
      window.removeEventListener('alpha-settings-updated', handleFiscalYearChanged);
      window.removeEventListener('storage', handleFiscalYearChanged);
    };
  }, []);

  // Compute smart vertical placement (open top if near bottom of viewport)
  useEffect(() => {
    if (isOpen && containerRef.current) {
      if (placement === 'auto') {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        // In sidebars or bottom toolbars, spaceBelow is usually limited (< 280px)
        if (spaceBelow < 280 && spaceAbove > spaceBelow) {
          setComputedPlacement('top');
        } else {
          setComputedPlacement('bottom');
        }
      } else {
        setComputedPlacement(placement);
      }
    }
  }, [isOpen, placement]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelectYear = (year: number) => {
    setSelectedBrowsingYear(year);
    setSelectedYear(year);
    setIsOpen(false);
    setSearchQuery('');
  };

  const isCurrentSelectionArchived = isYearArchived(selectedYear);

  // Filtered years by search query
  const filteredYears = useMemo(() => {
    if (!searchQuery.trim()) return availableYears;
    const q = searchQuery.trim().toLowerCase();
    return availableYears.filter(yr => yr.toString().includes(q));
  }, [availableYears, searchQuery]);

  // Labels
  const fiscalYearLabel = t('fiscalYearLabel', 'السنة المالية');
  const currentBadgeText = language === 'ar' ? 'حالية' : 'Active';
  const archiveBadgeText = language === 'ar' ? 'أرشيف' : 'Archived';
  const currentFullBadge = language === 'ar' ? 'النشطة الحالية' : 'Current Active';
  const archiveFullBadge = language === 'ar' ? 'أرشيف مقفل' : 'Archived Lock';

  return (
    <div 
      ref={containerRef}
      className={`relative ${fullWidth ? 'w-full' : 'inline-block'} ${className}`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Trigger: Full-Width Sidebar Card Mode */}
      {fullWidth ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs select-none ${
            isCurrentSelectionArchived
              ? 'bg-amber-950/40 text-amber-200 border-amber-500/50 hover:bg-amber-900/50 hover:border-amber-400'
              : 'bg-slate-800/70 text-slate-200 border-slate-700/60 hover:bg-slate-700/80 hover:border-slate-600 hover:text-white'
          }`}
          title={
            isCurrentSelectionArchived 
              ? `${fiscalYearLabel}: ${selectedYear} (${archiveBadgeText}) - انقر للتبديل`
              : `${fiscalYearLabel}: ${selectedYear} (${currentBadgeText}) - انقر للتبديل`
          }
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
              isCurrentSelectionArchived 
                ? 'bg-amber-500/20 text-amber-400' 
                : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {isCurrentSelectionArchived ? (
                <Archive size={14} />
              ) : (
                <Calendar size={14} />
              )}
            </div>
            
            <div className="text-start truncate">
              <div className="text-[10px] text-slate-400 font-medium">
                {fiscalYearLabel}
              </div>
              <div className="font-mono font-bold text-slate-100 text-xs">
                {selectedYear}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Status Badge */}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
              isCurrentSelectionArchived 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            }`}>
              {selectedYear === activeYear ? currentBadgeText : archiveBadgeText}
            </span>

            <ChevronDown 
              size={14} 
              className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-white' : ''}`} 
            />
          </div>
        </button>
      ) : (
        /* Trigger: Compact Button Mode */
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className={`flex items-center gap-2 rounded-xl transition-all cursor-pointer font-bold select-none border shadow-2xs ${
            isCurrentSelectionArchived
              ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border-amber-500/40 hover:border-amber-400'
              : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 hover:text-white border-slate-700/70 hover:border-slate-600'
          } ${compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs sm:text-sm'}`}
          title={
            isCurrentSelectionArchived 
              ? `${fiscalYearLabel}: ${selectedYear} (${archiveBadgeText})`
              : `${fiscalYearLabel}: ${selectedYear} (${currentBadgeText})`
          }
        >
          <div className="flex items-center gap-1.5">
            {isCurrentSelectionArchived ? (
              <Archive size={15} className="text-amber-400 shrink-0" />
            ) : (
              <Calendar size={15} className="text-emerald-400 shrink-0" />
            )}
            <span className="font-mono tracking-tight font-black">{selectedYear}</span>
          </div>

          <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold shrink-0 border ${
            isCurrentSelectionArchived 
              ? 'bg-amber-500/25 text-amber-300 border-amber-500/40' 
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          }`}>
            {selectedYear === activeYear ? currentBadgeText : archiveBadgeText}
          </span>

          <ChevronDown 
            size={14} 
            className={`transition-transform duration-200 opacity-60 ${isOpen ? 'rotate-180 opacity-100' : ''}`} 
          />
        </button>
      )}

      {/* Responsive Dropdown / Dropup Menu */}
      {isOpen && (
        <div 
          ref={dropdownRef}
          className={`
            absolute z-50
            /* Responsive Fluid Width: Shrinks on mobile screens, fits container on desktop */
            ${fullWidth 
              ? 'w-full min-w-[220px] max-w-full start-0 end-0' 
              : 'w-[min(18rem,calc(100vw-2rem))] start-0'}
            /* Smart Vertical Orientation: Top (Dropup) or Bottom (Dropdown) */
            ${computedPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}
            rounded-2xl bg-slate-900/98 backdrop-blur-md
            border border-slate-700/90 shadow-2xl shadow-slate-950/60
            overflow-hidden text-start
            animate-in fade-in zoom-in-95 duration-150
            ring-1 ring-white/10
          `}
        >
          {/* Header */}
          <div className="px-3.5 py-2.5 bg-slate-800/90 border-b border-slate-700/60 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <ArrowRightLeft size={13} />
              </div>
              <span className="text-xs font-bold text-white truncate">
                {language === 'ar' ? 'السنوات المالية' : 'Fiscal Years'}
              </span>
            </div>
            
            <span className="text-[10px] text-slate-400 font-mono bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-700/40 shrink-0">
              {availableYears.length} {language === 'ar' ? 'سنوات' : 'years'}
            </span>
          </div>

          {/* Quick Search if more than 3 years exist */}
          {availableYears.length > 3 && (
            <div className="p-2 border-b border-slate-800/80 bg-slate-950/40">
              <div className="relative">
                <Search size={13} className="absolute top-1/2 -translate-y-1/2 start-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={language === 'ar' ? 'بحث برقم السنة...' : 'Search year...'}
                  className="w-full bg-slate-900 text-slate-200 text-xs rounded-lg ps-8 pe-6 py-1.5 border border-slate-700/70 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute top-1/2 -translate-y-1/2 end-2 text-slate-400 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* List of Years (Scrollable & Responsive Touch Targets) */}
          <div className="p-1.5 max-h-56 sm:max-h-64 overflow-y-auto space-y-1 overscroll-contain">
            {filteredYears.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                {language === 'ar' ? 'لا توجد سنوات مطابقة للبحث' : 'No matching years found'}
              </div>
            ) : (
              filteredYears.map((yr) => {
                const isActiveYear = yr === activeYear;
                const isArchived = isYearArchived(yr);
                const isSelected = yr === selectedYear;

                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => handleSelectYear(yr)}
                    className={`w-full flex items-center justify-between p-2 sm:p-2.5 rounded-xl text-xs transition-all text-start cursor-pointer group ${
                      isSelected
                        ? 'bg-indigo-600/35 text-white border border-indigo-500/60 font-bold shadow-xs'
                        : 'hover:bg-slate-800/90 text-slate-300 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Year badge indicator */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 transition-transform group-hover:scale-105 ${
                        isActiveYear
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}>
                        {yr}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-100">{yr}</span>
                          
                          {isActiveYear && (
                            <span className="text-[9px] bg-emerald-950/80 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-600/50">
                              {currentFullBadge}
                            </span>
                          )}
                          
                          {isArchived && !isActiveYear && (
                            <span className="text-[9px] bg-amber-950/80 text-amber-300 px-1.5 py-0.2 rounded border border-amber-600/50 flex items-center gap-0.5">
                              <Lock size={9} />
                              {archiveFullBadge}
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                          {isActiveYear 
                            ? (language === 'ar' ? 'العمليات الحية والفواتير والقيود' : 'Live invoices & operational journals')
                            : (language === 'ar' ? 'للقراءة والتقارير وميزان المراجعة' : 'Read-only reports & audit balances')}
                        </div>
                      </div>
                    </div>

                    {/* Selected Checkmark */}
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 ms-1 shadow-xs">
                        <Check size={12} />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Year-End Closing Footer link */}
          <div className="p-2 border-t border-slate-800/90 bg-slate-950/70">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (onNavigateToYearEnd) {
                  onNavigateToYearEnd();
                } else if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('alpha-navigate', {
                    detail: { view: 'yearEndClosing' }
                  }));
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-800 hover:bg-indigo-900/40 text-slate-200 hover:text-indigo-200 text-xs font-bold transition-all border border-slate-700/80 hover:border-indigo-600/50 cursor-pointer group"
            >
              <Sparkles size={13} className="text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="truncate">
                {language === 'ar' ? 'إقفال وترحيل سنة مالية جديدة...' : 'Year-End Roll-Forward...'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
