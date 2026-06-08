import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getQueueCount } from '../offline/queue';
import { executeOrQueue, isBrowserOnline, processOfflineQueue } from '../offline/syncManager';

const SyncContext = createContext(null);

const SYNC_INTERVAL_MS = 30000;

export function SyncProvider({ children }) {
  const [isOnline, setIsOnline] = useState(isBrowserOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const retryTimer = useRef(null);

  const refreshPending = useCallback(async () => {
    const count = await getQueueCount();
    setPendingCount(count);
    return count;
  }, []);

  const syncNow = useCallback(async () => {
    if (!isBrowserOnline()) return { synced: 0, failed: 0 };
    setSyncing(true);
    try {
      const result = await processOfflineQueue();
      await refreshPending();
      return result;
    } catch {
      return { synced: 0, failed: 0 };
    } finally {
      setSyncing(false);
    }
  }, [refreshPending]);

  const scheduleRetry = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(syncNow, 5000);
  }, [syncNow]);

  const runExecuteOrQueue = useCallback(
    async (tipo, data) => {
      const result = await executeOrQueue(tipo, data);
      await refreshPending();
      if (result.offline) scheduleRetry();
      else await syncNow();
      return result;
    },
    [refreshPending, scheduleRetry, syncNow]
  );

  useEffect(() => {
    refreshPending();

    const onOnline = () => {
      setIsOnline(true);
      syncNow().then(scheduleRetry);
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const interval = setInterval(() => {
      if (navigator.onLine) syncNow();
    }, SYNC_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(interval);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [refreshPending, scheduleRetry, syncNow]);

  const offlineLabel =
    !isOnline || pendingCount > 0
      ? pendingCount > 0 && isOnline
        ? `${pendingCount} pendiente(s) de sincronizar`
        : 'Sin conexión - trabajando offline'
      : null;

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        pendingCount,
        syncing,
        offlineLabel,
        syncNow,
        executeOrQueue: runExecuteOrQueue,
        refreshPending,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync requiere SyncProvider');
  return ctx;
}
