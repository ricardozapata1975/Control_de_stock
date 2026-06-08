import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@inventario/offline_queue';

function newClientId() {
  return `mob-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function getQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueAction({ tipo, data }) {
  const queue = await getQueue();
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
  queue.push(item);
  await saveQueue(queue);
  return item;
}

export async function removeByClientIds(clientIds) {
  const queue = await getQueue();
  const set = new Set(clientIds);
  await saveQueue(queue.filter((q) => !set.has(q.clientId)));
}

export async function updateQueueItem(clientId, updates) {
  const queue = await getQueue();
  const next = queue.map((q) => (q.clientId === clientId ? { ...q, ...updates } : q));
  await saveQueue(next);
}
