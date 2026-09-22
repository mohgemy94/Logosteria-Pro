import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ResponsiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  headerActions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /**
   * Max width breakpoint for desktop / tablet view
   * default: 'max-w-4xl'
   */
  maxWidthClass?: string;
  /**
   * Custom backdrop / overlay style
   */
  overlayClassName?: string;
  /**
   * Custom header background and text styling
   */
  headerClassName?: string;
  /**
   * Custom body padding and styling
   */
  bodyClassName?: string;
  /**
   * Hide the built-in header if the modal provides a fully custom top bar
   */
  hideHeader?: boolean;
  /**
   * Hide the close (X) button
   */
  hideCloseButton?: boolean;
  /**
   * Extra classes for the modal container
   */
  className?: string;
  /**
   * Direction (default: 'rtl')
   */
  dir?: 'rtl' | 'ltr';
  /**
   * Data test or id attribute for targeting
   */
  id?: string;
}

/**
 * ResponsiveModal - نافذة منبثقة متجاوبة بنسبة 100% لكافة المنصات
 * 
 * سلوك النوافذ:
 * 1. التقلص والتمدد الديناميكي (Fluid Sizing): لا تستخدم أطوال أو عروض ثابتة، بل تستخدم max-w و max-h ديناميكية.
 * 2. التمرير الداخلي الآمن (Safe Scrolling): Header و Footer ثابتان تماماً، بينما المحتوى الداخلي فقط يمتلك (overflow-y: auto).
 * 3. التكيف مع المنصات (Platform Adaptation):
 *    - Desktop / Electron: نافذة عريضة وفسيحة في المنتصف مع خلفية مظللة فخمة وزوايا مستديرة (rounded-2xl).
 *    - Mobile / Android (Capacitor): تتحول إلى Bottom Sheet أو تملأ 100% من العرض مع حواف مدورة علوية ومساحات لمس واسعة للأصابع (touch-friendly padding).
 * 4. الأنيميشن: حركات دخول وخروج مدروسة (Fade-in و Scale-up للديسكتوب، و Slide-up للموبايل).
 */
export default function ResponsiveModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  badge,
  headerActions,
  footer,
  children,
  maxWidthClass = 'max-w-4xl',
  overlayClassName = '',
  headerClassName = '',
  bodyClassName = '',
  hideHeader = false,
  hideCloseButton = false,
  className = '',
  dir = 'rtl',
  id
}: ResponsiveModalProps) {
  // Lock body scroll and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      id={id ? `${id}-overlay` : undefined}
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-xs transition-opacity duration-200 animate-fadeIn ${overlayClassName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        id={id}
        dir={dir}
        onClick={(e) => e.stopPropagation()}
        className={`bg-white w-full ${maxWidthClass} rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[92vh] sm:max-h-[88vh] md:max-h-[90vh] overflow-hidden transition-all duration-200 animate-modalIn text-right font-sans ${className}`}
        style={{
          width: 'min(100vw, var(--modal-max-width, 100%))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* 1. FIXED HEADER */}
        {!hideHeader && (
          <header
            className={`px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-200/90 flex items-center justify-between gap-3 shrink-0 select-none bg-slate-50/90 ${headerClassName}`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {icon && (
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center shrink-0">
                  {icon}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {typeof title === 'string' ? (
                    <h3 className="text-sm sm:text-base md:text-lg font-black text-slate-900 truncate">
                      {title}
                    </h3>
                  ) : (
                    title
                  )}
                  {badge && <div className="shrink-0">{badge}</div>}
                </div>

                {subtitle && (
                  <div className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-1 sm:line-clamp-2">
                    {subtitle}
                  </div>
                )}
              </div>
            </div>

            {/* Header Right Actions & Close Button */}
            <div className="flex items-center gap-2 shrink-0">
              {headerActions}

              {!hideCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 touch-manipulation"
                  title="إغلاق (Esc)"
                  aria-label="إغلاق النافذة"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </header>
        )}

        {/* 2. SAFE SCROLLABLE BODY */}
        <main
          className={`flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 custom-scrollbar text-slate-800 focus:outline-none ${bodyClassName}`}
          tabIndex={-1}
        >
          {children}
        </main>

        {/* 3. FIXED FOOTER */}
        {footer && (
          <footer className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-50/95 border-t border-slate-200/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}
