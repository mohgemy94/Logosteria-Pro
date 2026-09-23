import { useEffect, useState } from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { mobileNavigationController } from '../utils/mobileNavigation';
import { useLanguage } from '../i18n/LanguageContext';

interface MobileBackButtonProps {
  onBack?: () => void;
  activeView: string | null;
  className?: string;
  variant?: 'floating' | 'header' | 'inline';
}

/**
 * Responsive Mobile Back Button
 * - Automatically detects when back navigation is possible
 * - Displays in the mobile header or bottom corner
 * - Adapts icon according to text direction (RTL / LTR)
 * - Interacts cleanly with hardware back gestures and history
 */
export default function MobileBackButton({
  onBack,
  activeView,
  className = '',
  variant = 'header'
}: MobileBackButtonProps) {
  const { isRtl, language } = useLanguage();
  const [canGoBack, setCanGoBack] = useState(() => mobileNavigationController.canGoBack());

  useEffect(() => {
    setCanGoBack(mobileNavigationController.canGoBack());
  }, [activeView]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      mobileNavigationController.goBack();
    }
  };

  // Only show if we are not on the root landing screen or if history exists
  const isRootLanding = activeView === 'companyProfile';
  if (isRootLanding && !canGoBack) {
    return null;
  }

  const Icon = isRtl ? ArrowRight : ArrowLeft;

  if (variant === 'header') {
    return (
      <button
        type="button"
        onClick={handleBack}
        className={`md:hidden flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-amber-300 hover:text-white border border-amber-400/40 shadow-xs transition-all cursor-pointer ${className}`}
        title={language === 'ar' ? 'رجوع للشاشة السابقة' : 'Go Back'}
        aria-label={language === 'ar' ? 'رجوع' : 'Back'}
      >
        <Icon size={17} className="shrink-0" />
        <span className="text-[11px] font-bold">
          {language === 'ar' ? 'رجوع' : 'Back'}
        </span>
      </button>
    );
  }

  // Floating button (bottom-start corner above bottom navigation)
  return (
    <button
      type="button"
      onClick={handleBack}
      className={`md:hidden fixed bottom-16 ${isRtl ? 'right-4' : 'left-4'} z-40 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-900/90 hover:bg-slate-800 text-amber-300 border border-amber-400/40 shadow-xl backdrop-blur-md transition-all active:scale-95 cursor-pointer ${className}`}
      title={language === 'ar' ? 'رجوع' : 'Back'}
    >
      <Icon size={18} />
      <span className="text-xs font-bold">
        {language === 'ar' ? 'رجوع' : 'Back'}
      </span>
    </button>
  );
}
