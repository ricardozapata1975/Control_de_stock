import { api } from '../api/client';
import { enqueueAction, getQueue, removeByClientIds, updateQueueItem } from './queue';

export function isBrowserOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export async function processOfflineQueue() {
  const queue = await getQueue();
  if (!queue.length) return { synced: 0, failed: 0 };

  const batch = queue.map((q) => ({
    clientId: q.clientId,
    tipo: q.tipo,
    data: q.data,
    timestamp: q.timestamp,
  }));

  const response = await api.sync(batch);
  const toRemove = [];

  for (const r of response.results || []) {
    if (r.ok) {
      toRemove.push(r.clientId);
    } else {
      const item = queue.find((q) => q.clientId === r.clientId);
      await updateQueueItem(r.clientId, {
        retries: (item?.retries || 0) + 1,
        lastError: r.error,
      });
    }
  }

  await removeByClientIds(toRemove);
  return { synced: toRemove.length, failed: response.failed || 0 };
}

export async function executeOrQueue(tipo, data) {
  if (isBrowserOnline()) {
    try {
      const batch = [{ clientId: `direct-${Date.now()}`, tipo, data, timestamp: new Date().toISOString() }];
      const res = await api.sync(batch);
      if (res.results?.[0]?.ok) return { ok: true, offline: false };
      const fail = res.results?.[0];
      if (fail && !fail.ok) {
        throw new Error(fail.error || 'Error al sincronizar');
      }
    } catch (e) {
      if (!/fetch|network|Failed/i.test(e.message)) throw e;
    }
  }
  await enqueueAction({ tipo, data });
  return { ok: true, offline: true };
}
