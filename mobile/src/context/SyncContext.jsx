import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import NetInfo from '@react-native-community/netinfo';
import { getQueue } from '../services/offlineQueue';
import { processOfflineQueue, getRetryDelayMs, executeOrQueue as execQueue } from '../services/sync';
import { api } from '../services/api';

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState(null);
  const retryTimer = useRef(null);

  const refreshPending = useCallback(async () => {
    const q = await getQueue();
    setPendingCount(q.length);
    return q;
  }, []);

  const syncNow = useCallback(async () => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      setLastError('Sin conexión');
      return { synced: 0, failed: 0 };
    }

    setSyncing(true);
    setLastError(null);
    try {
      await api.health();
      const result = await processOfflineQueue();
      await refreshPending();
      return result;
    } catch (e) {
      setLastError(e.message);
      return { synced: 0, failed: 0 };
    } finally {
      setSyncing(false);
    }
  }, [refreshPending]);

  const scheduleRetry = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    getQueue().then((q) => {
      if (!q.length) return;
      const maxRetries = Math.max(...q.map((i) => i.retries || 0), 0);
      retryTimer.current = setTimeout(syncNow, getRetryDelayMs(maxRetries));
    });
  }, [syncNow]);

  const executeOrQueue = useCallback(
    async (tipo, data) => {
      const state = await NetInfo.fetch();
      if (!state.isConnected) {
        const result = await execQueue(tipo, data);
        await refreshPending();
        scheduleRetry();
        return result;
      }
      try {
        const result = await execQueue(tipo, data);
        await refreshPending();
        if (result.offline) scheduleRetry();
        else await syncNow();
        return result;
      } catch (e) {
        throw e;
      }
    },
    [refreshPending, scheduleRetry, syncNow]
  );

  useEffect(() => {
    refreshPending();
    const unsubNet = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected;
      setIsOnline(online);
      if (online) syncNow().then(scheduleRetry);
    });
    const interval = setInterval(() => {
      NetInfo.fetch().then((s) => {
        if (s.isConnected) syncNow();
      });
    }, 30000);
    return () => {
      unsubNet();
      clearInterval(interval);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [refreshPending, scheduleRetry, syncNow]);

  const offlineLabel = !isOnline
    ? 'Sin conexión - trabajando offline'
    : pendingCount > 0
      ? `${pendingCount} pendiente(s) de sincronizar`
      : null;

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        pendingCount,
        syncing,
        lastError,
        offlineLabel,
        syncNow,
        executeOrQueue,
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
