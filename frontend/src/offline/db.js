import { openDB } from 'idb';

const DB_NAME = 'inventario-offline';
const STORE = 'queue';
const VERSION = 1;

export async function getDb() {
  return openDB(DB_NAME, VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('clientId', 'clientId', { unique: true });
      }
    },
  });
}
