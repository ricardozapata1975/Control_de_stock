const locks = new Map();

export async function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  locks.set(
    key,
    prev.then(() => gate)
  );
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === gate) {
      locks.delete(key);
    }
  }
}

export const LOCK_KEYS = {
  INVENTARIO: 'excel-inventario',
  MOVIMIENTOS: 'excel-movimientos',
  GLOBAL: 'excel-global',
};
