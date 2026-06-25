import { randomUUID } from 'crypto';
import { config } from '../config.js';
import { getSupabase } from '../db/supabase.js';
import { getDb } from '../db/sqlite.js';

export const DEFAULT_TIPOS = [
  'Herramienta',
  'Medición',
  'Eléctrica',
  'Neumática',
  'Consumible',
  'Otro',
];

let cache = null;

function sortTipos(rows) {
  return [...rows]
    .filter((r) => r.activo !== false && r.activo !== 0)
    .sort((a, b) => {
      const ao = a.orden ?? 9999;
      const bo = b.orden ?? 9999;
      if (ao !== bo) return ao - bo;
      return String(a.nombre).localeCompare(String(b.nombre), 'es');
    })
    .map((r) => r.nombre);
}

function listTiposFromSqlite() {
  const db = getDb();
  const rows = db
    .prepare('SELECT nombre, activo, orden FROM item_tipos WHERE activo = 1 ORDER BY orden, nombre')
    .all();
  if (rows.length) return sortTipos(rows);

  const fromItems = db
    .prepare(
      `SELECT DISTINCT trim(tipo) AS nombre FROM items
       WHERE tipo IS NOT NULL AND trim(tipo) <> ''`
    )
    .all()
    .map((r) => ({ nombre: r.nombre, activo: 1, orden: 100 }));

  const merged = new Map();
  DEFAULT_TIPOS.forEach((nombre, i) => merged.set(nombre, { nombre, activo: 1, orden: i + 1 }));
  for (const row of fromItems) {
    if (!merged.has(row.nombre)) merged.set(row.nombre, row);
  }
  return sortTipos([...merged.values()]);
}

async function isTiposDbAvailable() {
  const supabase = getSupabase();
  const { error } = await supabase.from('item_tipos').select('id').limit(1);
  if (!error) return true;
  if (error.code === '42P01' || /does not exist/i.test(error.message || '')) {
    console.warn('[Tipos] Tabla item_tipos no encontrada. Ejecutá supabase/patch-item-tipos.sql');
    return false;
  }
  throw Object.assign(new Error(error.message), { status: 500 });
}

async function listTiposFromSupabase() {
  const available = await isTiposDbAvailable();
  if (!available) {
    return listTiposFromItemsFallback();
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('item_tipos')
    .select('nombre, activo, orden')
    .eq('activo', true)
    .order('orden', { ascending: true, nullsFirst: false })
    .order('nombre', { ascending: true });

  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (data?.length) return sortTipos(data);
  return listTiposFromItemsFallback();
}

async function listTiposFromItemsFallback() {
  if (config.demoMode) return listTiposFromSqlite();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('items')
    .select('tipo')
    .not('tipo', 'is', null);

  if (error) throw Object.assign(new Error(error.message), { status: 500 });

  const merged = new Map();
  DEFAULT_TIPOS.forEach((nombre, i) => merged.set(nombre, { nombre, activo: true, orden: i + 1 }));
  for (const row of data || []) {
    const nombre = String(row.tipo || '').trim();
    if (nombre && !merged.has(nombre)) {
      merged.set(nombre, { nombre, activo: true, orden: 100 });
    }
  }
  return sortTipos([...merged.values()]);
}

export function ensureTiposSeededInSqlite() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS item_tipos (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      activo INTEGER NOT NULL DEFAULT 1,
      orden INTEGER
    );
  `);

  const count = db.prepare('SELECT COUNT(*) AS n FROM item_tipos').get()?.n || 0;
  if (count > 0) return;

  const insert = db.prepare(
    'INSERT OR IGNORE INTO item_tipos (id, nombre, activo, orden) VALUES (@id, @nombre, 1, @orden)'
  );

  DEFAULT_TIPOS.forEach((nombre, i) => {
    insert.run({ id: randomUUID(), nombre, orden: i + 1 });
  });

  const fromItems = db
    .prepare(
      `SELECT DISTINCT trim(tipo) AS nombre FROM items
       WHERE tipo IS NOT NULL AND trim(tipo) <> ''`
    )
    .all();

  let orden = DEFAULT_TIPOS.length + 1;
  for (const row of fromItems) {
    if (!DEFAULT_TIPOS.includes(row.nombre)) {
      insert.run({ id: randomUUID(), nombre: row.nombre, orden: orden++ });
    }
  }
}

export async function listTipos() {
  if (cache) return cache;

  if (config.demoMode) {
    ensureTiposSeededInSqlite();
    cache = listTiposFromSqlite();
    return cache;
  }

  cache = await listTiposFromSupabase();
  return cache;
}

export function invalidateTiposCache() {
  cache = null;
}
