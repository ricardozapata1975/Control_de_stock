import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, 'schema.sqlite.sql');
const SEED_PATH = path.join(__dirname, '../data/demo-db.seed.json');

let dbInstance = null;

export function getSqlitePath() {
  return config.sqlite.path;
}

export function getDb() {
  if (!dbInstance) {
    const dir = path.dirname(getSqlitePath());
    fs.mkdirSync(dir, { recursive: true });
    dbInstance = new Database(getSqlitePath());
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
  }
  return dbInstance;
}

function runSchema() {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  getDb().exec(sql);
}

function tableCount(table) {
  const row = getDb().prepare(`SELECT COUNT(*) AS n FROM ${table}`).get();
  return row?.n || 0;
}

function importSeedFromJson() {
  if (!fs.existsSync(SEED_PATH)) return false;
  const data = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
  saveInventoryData(data);
  return true;
}

export function saveInventoryData(data) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM movimientos').run();
    db.prepare('DELETE FROM stock').run();
    db.prepare('DELETE FROM items').run();
    db.prepare('DELETE FROM contenedores').run();

    const insCont = db.prepare(
      `INSERT OR REPLACE INTO contenedores (id, codigo, armario, estante, contenedor, ubicacion, created_at)
       VALUES (@id, @codigo, @armario, @estante, @contenedor, @ubicacion, @created_at)`
    );
    for (const row of data.contenedores || []) {
      insCont.run({
        id: row.id,
        codigo: row.codigo,
        armario: row.armario,
        estante: row.estante,
        contenedor: row.contenedor ?? null,
        ubicacion: row.ubicacion,
        created_at: row.created_at || new Date().toISOString(),
      });
    }

    const insItem = db.prepare(
      `INSERT OR REPLACE INTO items (id, nombre, marca, modelo, tipo, detalle, calibracion, comentario, fecha_relevamiento, activo, created_at)
       VALUES (@id, @nombre, @marca, @modelo, @tipo, @detalle, @calibracion, @comentario, @fecha_relevamiento, @activo, @created_at)`
    );
    for (const row of data.items || []) {
      insItem.run({
        id: row.id,
        nombre: row.nombre,
        marca: row.marca || '',
        modelo: row.modelo || '',
        tipo: row.tipo || '',
        detalle: row.detalle || '',
        calibracion: row.calibracion || '',
        comentario: row.comentario || '',
        fecha_relevamiento: row.fecha_relevamiento || null,
        activo: row.activo === false ? 0 : 1,
        created_at: row.created_at || new Date().toISOString(),
      });
    }

    const insStock = db.prepare(
      `INSERT OR REPLACE INTO stock (id, item_id, contenedor_id, cantidad, updated_at)
       VALUES (@id, @item_id, @contenedor_id, @cantidad, @updated_at)`
    );
    for (const row of data.stock || []) {
      insStock.run({
        id: row.id,
        item_id: row.item_id,
        contenedor_id: row.contenedor_id,
        cantidad: row.cantidad,
        updated_at: row.updated_at || new Date().toISOString(),
      });
    }

    const insMov = db.prepare(
      `INSERT OR REPLACE INTO movimientos (id, item_id, contenedor_id, tipo, cantidad, usuario, fecha, sync_status, offline_id, egreso_movimiento_id, created_at)
       VALUES (@id, @item_id, @contenedor_id, @tipo, @cantidad, @usuario, @fecha, @sync_status, @offline_id, @egreso_movimiento_id, @created_at)`
    );
    for (const row of data.movimientos || []) {
      insMov.run({
        id: row.id,
        item_id: row.item_id,
        contenedor_id: row.contenedor_id,
        tipo: row.tipo,
        cantidad: row.cantidad,
        usuario: row.usuario,
        fecha: row.fecha || new Date().toISOString(),
        sync_status: row.sync_status || 'synced',
        offline_id: row.offline_id || null,
        egreso_movimiento_id: row.egreso_movimiento_id || null,
        created_at: row.created_at || new Date().toISOString(),
      });
    }
  });
  tx();
}

export function loadInventoryData() {
  const db = getDb();
  return {
    contenedores: db.prepare('SELECT * FROM contenedores').all(),
    items: db.prepare('SELECT * FROM items').all().map((row) => ({
      ...row,
      activo: row.activo !== 0,
    })),
    stock: db.prepare('SELECT * FROM stock').all(),
    movimientos: db.prepare('SELECT * FROM movimientos').all(),
  };
}

export function exportSeedDatabase(targetPath = config.sqlite.seedPath) {
  fs.copyFileSync(getSqlitePath(), targetPath);
  return targetPath;
}

export function resetSqliteDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  const dbPath = getSqlitePath();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  runSchema();
}

export function initSqliteDatabase() {
  const dbPath = getSqlitePath();
  const seedDb = config.sqlite.seedPath;
  if (!fs.existsSync(dbPath) && fs.existsSync(seedDb)) {
    fs.copyFileSync(seedDb, dbPath);
    console.log('[SQLite] Base restaurada desde inventario.seed.sqlite');
  }
  runSchema();
  if (tableCount('contenedores') === 0 && tableCount('items') === 0) {
    const imported = importSeedFromJson();
    if (!imported) {
      console.warn('[SQLite] Sin datos. Colocá demo-db.seed.json o importá CSV.');
    } else {
      console.log('[SQLite] Inventario inicial cargado desde demo-db.seed.json');
    }
  }
  console.log(`[SQLite] Base de datos: ${getSqlitePath()}`);
}
