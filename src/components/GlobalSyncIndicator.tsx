import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getDatabase, getSyncQueueItems, SyncQueueItem } from '../services/DatabaseProvider';
import { getSetting, SETTINGS_KEYS } from '../services/DriveAuthService';

export const GlobalSyncIndicator: React.FC = () => {
  const [outboxItems, setOutboxItems] = useState<SyncQueueItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Poll database or listen to event
  const checkStatus = async () => {
    try {
      const items = await getSyncQueueItems();
      setOutboxItems(items);
      
      // Basic check: do we have a folder ID and token?
      const db = getDatabase();
      const folderId = await getSetting(db, SETTINGS_KEYS.GOOGLE_FOLDER_ID);
      const rToken = await getSetting(db, SETTINGS_KEYS.GOOGLE_REFRESH_TOKEN);
      
      setIsConnected(!!(folderId && rToken));
    } catch (e) {
      console.warn('Sync indicator check failed:', e);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    checkStatus();

    // Listen to our custom local storage/IDB events
    window.addEventListener('alpha-db-changed', checkStatus);
    // Also periodically poll just in case background SyncEngine processes items silently
    const interval = setInterval(checkStatus, 5000);

    return () => {
      window.removeEventListener('alpha-db-changed', checkStatus);
      clearInterval(interval);
    };
  }, []);

  if (isInitializing) return null;

  const pendingCount = outboxItems.filter((i) => i.sync_status === 'PENDING' || i.sync_status === 'FAILED').length;
  const syncingCount = outboxItems.filter((i) => i.sync_status === 'SYNCING').length;
  
  if (!isConnected) {
    return (
      <div 
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-[11px] font-medium"
        title="غير متصل بالسحابة"
      >
        <CloudOff size={14} />
        <span className="hidden sm:inline">أوفلاين</span>
      </div>
    );
  }

  if (syncingCount > 0) {
    return (
      <div 
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[11px] font-medium"
        title="جاري المزامنة الآن..."
      >
        <RefreshCw size={14} className="animate-spin" />
        <span className="hidden sm:inline">جاري الرفع</span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div 
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-medium"
        title={`${pendingCount} سجلات بانتظار المزامنة`}
      >
        <AlertCircle size={14} />
        <span className="font-bold">{pendingCount}</span>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium"
      title="كل البيانات متزامنة مع السحابة"
    >
      <Cloud size={14} />
      <CheckCircle2 size={12} className="text-emerald-500 hidden sm:inline" />
      <span className="hidden sm:inline">متزامن</span>
    </div>
  );
};
