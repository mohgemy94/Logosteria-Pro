import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useUnifiedAlerts } from './UnifiedAlertsCenterModal';
import UnifiedAlertsCenterModal from './UnifiedAlertsCenterModal';

interface AlertsNotificationBellProps {
  onNavigate: (screen: string) => void;
  className?: string;
  iconSize?: number;
}

export default function AlertsNotificationBell({
  onNavigate,
  className = '',
  iconSize = 16
}: AlertsNotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { count } = useUnifiedAlerts();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`relative p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center ${className || 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 shadow-xs'}`}
        title={`مركز إشعارات الاستحقاقات الموحد (${count} تنبيه معلق)`}
      >
        <Bell size={iconSize} className={count > 0 ? 'text-amber-400 animate-wiggle' : 'text-slate-400'} />
        
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-600 text-white font-mono text-[10px] font-black rounded-full flex items-center justify-center px-1 border-2 border-slate-900 shadow-sm animate-pulse">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <UnifiedAlertsCenterModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onNavigate={onNavigate}
        />
      )}
    </>
  );
}
