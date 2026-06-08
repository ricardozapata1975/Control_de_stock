import { api } from './api';
import { getQueue, removeByClientIds, updateQueueItem, enqueueAction } from './offlineQueue';

const RETRY_BASE_MS = 3000;

export async function processOfflineQueue(onProgress) {
  const queue = await getQueue();
  if (!queue.length) return { synced: 0, failed: 0 };

  const batch = queue.map((q) => ({
    clientId: q.clientId,
    tipo: q.tipo || q.type,
    data: q.data || q.payload,
    timestamp: q.timestamp || q.createdAt,
  }));

  const response = await api.sync(batch);
  const toRemove = [];
  let failed = 0;

  for (const r of response.results || []) {
    if (r.ok) {
      toRemove.push(r.clientId);
      onProgress?.({ synced: toRemove.length, failed, item: r });
    } else {
      failed += 1;
      await updateQueueItem(r.clientId, {
        retries: (queue.find((q) => q.clientId === r.clientId)?.retries || 0) + 1,
        lastError: r.error,
      });
      onProgress?.({ synced: toRemove.length, failed, error: r.error });
    }
  }

  await removeByClientIds(toRemove);
  return { synced: toRemove.length, failed, skipped: response.skipped || 0 };
}

export function getRetryDelayMs(retries) {
  return Math.min(RETRY_BASE_MS * 2 ** retries, 120000);
}

export async function executeOrQueue(tipo, data) {
  const action = {
    clientId: `mob-direct-${Date.now()}`,
    tipo,
    data,
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await api.sync([action]);
    const first = res.results?.[0];
    if (first?.ok) return { ok: true, offline: false };
    if (first && !first.ok && first.status && first.status < 500) {
      throw new Error(first.error);
    }
  } catch (e) {
    if (!String(e.message).match(/fetch|network|abort/i)) throw e;
  }

  await enqueueAction({ tipo, data });
  return { ok: true, offline: true };
}
