/**
 * Migra demo-db.seed.json (o inventario SQLite) a Supabase.
 * Uso: DEMO_MODE=false node scripts/migrate-demo-to-supabase.js
 */
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedJson = path.join(__dirname, '../data/demo-db.seed.json');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Configurá SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en backend/.env');
  process.exit(1);
}

const supabase = createClient(url, key);
const data = JSON.parse(fs.readFileSync(seedJson, 'utf-8'));

async function clearTables() {
  await supabase.from('movimientos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('stock').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('contenedores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

function toUuid(id) {
  if (/^[0-9a-f-]{36}$/i.test(id)) return id;
  const hash = createHash('sha256').update(String(id)).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

async function run() {
  console.log('Limpiando tablas Supabase...');
  await clearTables();

  const contMap = new Map();
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
  for (const i of data.items || []) {
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

  for (const s of data.stock || []) {
    const { error } = await supabase.from('stock').insert({
      id: toUuid(s.id),
      item_id: itemMap.get(s.item_id),
      contenedor_id: contMap.get(s.contenedor_id),
      cantidad: s.cantidad,
    });
    if (error) throw error;
  }

  const movMap = new Map();
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

  for (const m of data.movimientos || []) {
    if (m.tipo !== 'ingreso') continue;
    const egresoId = movMap.get(m.egreso_movimiento_id);
    const { error } = await supabase.from('movimientos').insert({
      id: toUuid(m.id),
      item_id: itemMap.get(m.item_id),
      contenedor_id: contMap.get(m.contenedor_id),
      tipo: 'ingreso',
      cantidad: m.cantidad,
      usuario: m.usuario,
      fecha: m.fecha,
      egreso_movimiento_id: egresoId || null,
      offline_id: m.offline_id || null,
    });
    if (error) throw error;
  }

  console.log('Migración completada:', {
    contenedores: data.contenedores?.length,
    items: data.items?.length,
    stock: data.stock?.length,
    movimientos: data.movimientos?.length,
  });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
