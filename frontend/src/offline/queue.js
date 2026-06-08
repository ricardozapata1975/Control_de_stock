import { getDb } from './db.js';

const STORE = 'queue';

function newClientId() {
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function getQueue() {
  const db = await getDb();
  return db.getAll(STORE);
}

export async function enqueueAction({ tipo, data }) {
  const db = await getDb();
  const clientId = newClientId();
  const item = {
    id: clientId,
    clientId,
    tipo,
    data,
    timestamp: new Date().toISOString(),
    retries: 0,
    lastError: null,
  };
  await db.put(STORE, item);
  return item;
}

export async function removeByClientId(clientId) {
  const db = await getDb();
  const all = await db.getAll(STORE);
  const item = all.find((q) => q.clientId === clientId);
  if (item) await db.delete(STORE, item.id);
}

export async function removeByClientIds(clientIds) {
  for (const cid of clientIds) {
    await removeByClientId(cid);
  }
}

export async function updateQueueItem(clientId, updates) {
  const db = await getDb();
  const all = await db.getAll(STORE);
  const item = all.find((q) => q.clientId === clientId);
  if (!item) return;
  await db.put(STORE, { ...item, ...updates });
}

export async function getQueueCount() {
  const q = await getQueue();
  return q.length;
}
