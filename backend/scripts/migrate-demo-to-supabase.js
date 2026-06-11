/**
 * Migra demo-db.seed.json a Supabase.
 * Requiere tablas creadas (supabase/full-setup.sql en SQL Editor).
 */
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedJson = path.join(__dirname, '../data/demo-db.seed.json');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en backend/.env');
  console.error('Supabase → Project Settings → API');
  process.exit(1);
}

const supabase = createClient(url, key);
const raw = JSON.parse(fs.readFileSync(seedJson, 'utf-8'));

function dedupeItems(items) {
  const byId = new Map();
  for (const item of items || []) byId.set(item.id, item);
  return [...byId.values()];
}

const data = {
  ...raw,
  items: dedupeItems(raw.items),
};

function toUuid(id) {
  if (/^[0-9a-f-]{36}$/i.test(id)) return id;
  const hash = createHash('sha256').update(String(id)).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

async function assertSchema() {
  const { error: usersErr } = await supabase.from('users').select('id').limit(1);
  if (usersErr?.code === 'PGRST205') {
    throw new Error(
      'Falta la tabla users. Ejecutá supabase/patch-partial-schema.sql en el SQL Editor de Supabase.'
    );
  }

  const { error: armarioErr } = await supabase.from('contenedores').select('armario').limit(1);
  if (armarioErr?.code === 'PGRST204' || armarioErr?.code === '42703') {
    throw new Error(
      'El esquema está incompleto (falta columna armario). Ejecutá supabase/patch-partial-schema.sql en el SQL Editor.'
    );
  }

  const { error } = await supabase.from('contenedores').select('id').limit(1);
  if (error?.message?.includes('does not exist') || error?.code === '42P01') {
    throw new Error(
      'Las tablas no existen. Ejecutá supabase/full-setup.sql en el SQL Editor de Supabase primero.'
    );
  }
  if (error && error.code !== 'PGRST116') {
    throw new Error(`No se pudo conectar a Supabase: ${error.message}`);
  }
}

async function clearTables() {
  for (const table of ['movimientos', 'stock', 'items', 'contenedores']) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
  }
}

async function seedAdmin() {
  const { count } = await supabase.from('users').select('id', { count: 'exact', head: true });
  if (count > 0) {
    console.log('Usuarios ya existen, omitiendo seed admin.');
    return;
  }
  const password_hash = await bcrypt.hash(config.admin.password, 12);
  const { error } = await supabase.from('users').insert({
    username: config.admin.username.toLowerCase(),
    display_name: config.admin.displayName,
    password_hash,
    role: 'admin',
    must_change_password: false,
    is_active: true,
  });
  if (error) throw error;
  console.log(`Admin creado: ${config.admin.username}`);
}

async function run() {
  console.log('Conectando a', url);
  await assertSchema();

  console.log('Limpiando tablas...');
  await clearTables();

  const contMap = new Map();
  console.log('Contenedores...');
  for (const c of data.contenedores || []) {
    const id = toUuid(c.id);
    contMap.set(c.id, id);
    const { error } = await supabase.from('contenedores').insert({
      id,
      codigo: c.codigo,
      armario: c.armario,
      estante: c.estante,
      contenedor: c.contenedor,
      ubicacion: c.ubicacion,
    });
    if (error) throw error;
  }

  const itemMap = new Map();
  console.log('Items...', data.items.length);
  for (const i of data.items) {
    const id = toUuid(i.id);
    itemMap.set(i.id, id);
    const { error } = await supabase.from('items').insert({
      id,
      nombre: i.nombre,
      marca: i.marca || '',
      modelo: i.modelo || '',
      tipo: i.tipo || '',
      detalle: i.detalle || '',
      calibracion: i.calibracion || '',
      comentario: i.comentario || '',
      fecha_relevamiento: i.fecha_relevamiento || null,
      activo: i.activo !== false,
    });
    if (error) throw error;
  }

  console.log('Stock...', data.stock?.length);
  for (const s of data.stock || []) {
    const itemId = itemMap.get(s.item_id);
    const contId = contMap.get(s.contenedor_id);
    if (!itemId || !contId) continue;
    const { error } = await supabase.from('stock').insert({
      id: toUuid(s.id),
      item_id: itemId,
      contenedor_id: contId,
      cantidad: s.cantidad,
    });
    if (error) throw error;
  }

  const movMap = new Map();
  console.log('Movimientos egreso...');
  for (const m of data.movimientos || []) {
    if (m.tipo !== 'egreso') continue;
    const id = toUuid(m.id);
    movMap.set(m.id, id);
    const { error } = await supabase.from('movimientos').insert({
      id,
      item_id: itemMap.get(m.item_id),
      contenedor_id: contMap.get(m.contenedor_id),
      tipo: 'egreso',
      cantidad: m.cantidad,
      usuario: m.usuario,
      fecha: m.fecha,
      offline_id: m.offline_id || null,
    });
    if (error) throw error;
  }

  console.log('Movimientos ingreso...');
  for (const m of data.movimientos || []) {
    if (m.tipo !== 'ingreso') continue;
    const { error } = await supabase.from('movimientos').insert({
      id: toUuid(m.id),
      item_id: itemMap.get(m.item_id),
      contenedor_id: contMap.get(m.contenedor_id),
      tipo: 'ingreso',
      cantidad: m.cantidad,
      usuario: m.usuario,
      fecha: m.fecha,
      egreso_movimiento_id: movMap.get(m.egreso_movimiento_id) || null,
      offline_id: m.offline_id || null,
    });
    if (error) throw error;
  }

  await seedAdmin();

  const { count } = await supabase.from('items').select('id', { count: 'exact', head: true });
  console.log('Migración OK:', {
    contenedores: data.contenedores?.length,
    items: data.items.length,
    stock: data.stock?.length,
    movimientos: data.movimientos?.length,
    itemsEnSupabase: count,
  });
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
