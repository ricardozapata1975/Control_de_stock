import { getSupabase } from '../db/supabase.js';
import { canonicalAlmacenCode, migrateCatalogoStructure, SEDE_DEFAULT } from './ubicacionUtils.js';
import { bootstrapSedesCatalog } from './sedeBootstrap.js';

const CONFIG_KEYS = [
  'nextAlmacenNum',
  'nextSedeNum',
  'estanteMin',
  'estanteMax',
  'contenedorReglas',
  'contenedorEspecial',
];

function rowToConfigValue(key, value) {
  if (value === undefined || value === null) return null;
  if (key === 'contenedorEspecial') return JSON.stringify(String(value));
  return JSON.stringify(value);
}

export function normalizeAlmacenCode(code) {
  return canonicalAlmacenCode(code);
}

function buildCatalogoFromRows(sedesRows, almacenesRows, armariosRows, configRows) {
  const config = {};
  for (const row of configRows || []) {
    config[row.key] = row.value;
  }

  const sedes = {};
  for (const s of sedesRows || []) {
    sedes[s.codigo] = {
      nombre: s.nombre,
      aduana: s.aduana || null,
    };
  }

  const almacenes = {};
  for (const a of almacenesRows || []) {
    almacenes[a.codigo] = {
      sede: a.sede_codigo || 'SED001',
      tipo: a.tipo,
      nombre: a.nombre,
      nextArmarioNum: a.next_armario_num ?? 0,
      armarios: {},
    };
  }

  for (const ar of armariosRows || []) {
    if (!almacenes[ar.almacen_codigo]) continue;
    almacenes[ar.almacen_codigo].armarios[ar.codigo] = {
      nombre: ar.nombre,
      tipo: ar.tipo,
    };
  }

  return bootstrapSedesCatalog(
    migrateCatalogoStructure({
      sedes,
      almacenes,
      nextAlmacenNum: config.nextAlmacenNum ?? 2,
      nextSedeNum: config.nextSedeNum ?? 2,
      estanteMin: config.estanteMin ?? 1,
      estanteMax: config.estanteMax ?? 9,
      contenedorReglas: config.contenedorReglas,
      contenedorEspecial: config.contenedorEspecial ?? 'SC',
    })
  );
}

function catalogoToDbPayload(catalogo) {
  const migrated = migrateCatalogoStructure(catalogo);
  const almacenesRows = Object.entries(migrated.almacenes || {}).map(([codigo, info]) => ({
    codigo,
    sede_codigo: info.sede || 'SED001',
    tipo: info.tipo || 'Almacén',
    nombre: info.nombre || codigo,
    next_armario_num: info.nextArmarioNum ?? 0,
  }));

  const sedesRows = Object.entries(migrated.sedes || {}).map(([codigo, info]) => ({
    codigo,
    nombre: info.nombre || codigo,
    aduana: info.aduana || null,
  }));

  const armariosRows = [];
  for (const [almCode, info] of Object.entries(migrated.almacenes || {})) {
    for (const [codigo, val] of Object.entries(info.armarios || {})) {
      armariosRows.push({
        almacen_codigo: almCode,
        codigo,
        nombre: typeof val === 'string' ? val : val.nombre || codigo,
        tipo: typeof val === 'string' ? 'armario' : val.tipo || 'armario',
      });
    }
  }

  const configRows = CONFIG_KEYS.map((key) => {
    const value = rowToConfigValue(key, migrated[key]);
    return value != null ? { key, value: JSON.parse(value) } : null;
  }).filter(Boolean);

  return { sedesRows, almacenesRows, armariosRows, configRows, migrated };
}

async function isCatalogoDbAvailable() {
  const supabase = getSupabase();
  const { error } = await supabase.from('catalogo_almacenes').select('codigo').limit(1);
  if (!error) return true;
  if (error.code === '42P01' || /does not exist/i.test(error.message || '')) {
    console.warn(
      '[Catalogo] Tablas catalogo_* no encontradas en Supabase. Ejecutá supabase/patch-catalogo.sql'
    );
    return false;
  }
  throw Object.assign(new Error(error.message), { status: 500 });
}

export async function loadCatalogoFromDb() {
  const available = await isCatalogoDbAvailable();
  if (!available) return null;

  const supabase = getSupabase();
  const [sedRes, almRes, armRes, cfgRes] = await Promise.all([
    supabase.from('catalogo_sedes').select('*').order('codigo'),
    supabase.from('catalogo_almacenes').select('*').order('codigo'),
    supabase.from('catalogo_armarios').select('*').order('almacen_codigo').order('codigo'),
    supabase.from('catalogo_config').select('*'),
  ]);

  if (sedRes.error && sedRes.error.code !== '42P01') {
    throw Object.assign(new Error(sedRes.error.message), { status: 500 });
  }
  if (almRes.error) throw Object.assign(new Error(almRes.error.message), { status: 500 });
  if (armRes.error) throw Object.assign(new Error(armRes.error.message), { status: 500 });
  if (cfgRes.error) throw Object.assign(new Error(cfgRes.error.message), { status: 500 });

  return buildCatalogoFromRows(sedRes.data, almRes.data, armRes.data, cfgRes.data);
}

export async function saveCatalogoToDb(catalogo) {
  const available = await isCatalogoDbAvailable();
  if (!available) {
    throw Object.assign(
      new Error('Catálogo en Supabase no configurado. Ejecutá supabase/patch-catalogo.sql'),
      { status: 503 }
    );
  }

  const supabase = getSupabase();
  const { sedesRows, almacenesRows, armariosRows, configRows, migrated } = catalogoToDbPayload(catalogo);

  const desiredSedes = new Set(sedesRows.map((r) => r.codigo));
  const desiredAlmacenes = new Set(almacenesRows.map((r) => r.codigo));
  const desiredArmarios = new Set(armariosRows.map((r) => `${r.almacen_codigo}:${r.codigo}`));

  const { data: existingAlm } = await supabase.from('catalogo_almacenes').select('codigo');
  const { data: existingArm } = await supabase.from('catalogo_armarios').select('almacen_codigo, codigo');

  for (const row of existingArm || []) {
    const key = `${row.almacen_codigo}:${row.codigo}`;
    if (!desiredArmarios.has(key)) {
      const { error } = await supabase
        .from('catalogo_armarios')
        .delete()
        .eq('almacen_codigo', row.almacen_codigo)
        .eq('codigo', row.codigo);
      if (error) throw Object.assign(new Error(error.message), { status: 500 });
    }
  }

  for (const row of existingAlm || []) {
    if (!desiredAlmacenes.has(row.codigo)) {
      const { error } = await supabase.from('catalogo_almacenes').delete().eq('codigo', row.codigo);
      if (error) throw Object.assign(new Error(error.message), { status: 500 });
    }
  }

  if (sedesRows.length) {
    const { error } = await supabase.from('catalogo_sedes').upsert(sedesRows, { onConflict: 'codigo' });
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
  }

  if (almacenesRows.length) {
    const { error } = await supabase.from('catalogo_almacenes').upsert(almacenesRows, { onConflict: 'codigo' });
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
  }

  if (armariosRows.length) {
    const { error } = await supabase
      .from('catalogo_armarios')
      .upsert(armariosRows, { onConflict: 'almacen_codigo,codigo' });
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
  }

  for (const row of configRows) {
    const { error } = await supabase.from('catalogo_config').upsert(row, { onConflict: 'key' });
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
  }

  return migrated;
}

export async function insertSedeToDb({ codigo, nombre, aduana }) {
  const supabase = getSupabase();
  const { error } = await supabase.from('catalogo_sedes').insert({
    codigo,
    nombre,
    aduana: aduana || null,
  });
  if (error) throw Object.assign(new Error(error.message), { status: error.code === '23505' ? 409 : 500 });
}

export async function updateSedeAduanaInDb(codigo, aduana) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('catalogo_sedes')
    .update({ aduana, nombre: undefined })
    .eq('codigo', codigo);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
}

export async function updateAlmacenSedeInDb(almacen, sedeCodigo) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('catalogo_almacenes')
    .update({ sede_codigo: sedeCodigo })
    .eq('codigo', almacen);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
}

export async function updateNextSedeNumInDb(nextNum) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('catalogo_config')
    .upsert({ key: 'nextSedeNum', value: nextNum }, { onConflict: 'key' });
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
}

export async function insertAlmacenToDb({ codigo, tipo, nombre, sedeCodigo = 'SED001', nextArmarioNum = 0 }) {
  const supabase = getSupabase();
  const { error } = await supabase.from('catalogo_almacenes').insert({
    codigo,
    sede_codigo: sedeCodigo,
    tipo,
    nombre,
    next_armario_num: nextArmarioNum,
  });
  if (error) throw Object.assign(new Error(error.message), { status: error.code === '23505' ? 409 : 500 });
}

export async function updateNextAlmacenNumInDb(nextNum) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('catalogo_config')
    .upsert({ key: 'nextAlmacenNum', value: nextNum }, { onConflict: 'key' });
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
}

export async function insertArmarioToDb({ almacen, codigo, nombre, tipo }) {
  const supabase = getSupabase();
  const { error } = await supabase.from('catalogo_armarios').insert({
    almacen_codigo: almacen,
    codigo,
    nombre,
    tipo,
  });
  if (error) throw Object.assign(new Error(error.message), { status: error.code === '23505' ? 409 : 500 });
}

export async function updateNextArmarioNumInDb(almacen, nextNum) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('catalogo_almacenes')
    .update({ next_armario_num: nextNum })
    .eq('codigo', almacen);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
}

export async function syncMissingFromContenedores(catalogo) {
  const available = await isCatalogoDbAvailable();
  if (!available) return catalogo;

  const supabase = getSupabase();
  const { data, error } = await supabase.from('contenedores').select('almacen, armario, ubicacion');
  if (error) throw Object.assign(new Error(error.message), { status: 500 });

  let changed = false;
  const c = migrateCatalogoStructure({ ...catalogo });
  c.almacenes = c.almacenes || {};

  for (const row of data || []) {
    const alm = normalizeAlmacenCode(row.almacen);
    if (!alm) continue;

    if (!c.almacenes[alm]) {
      c.almacenes[alm] = {
        sede: SEDE_DEFAULT,
        tipo: 'Almacén',
        nombre: `Almacén ${alm} (recuperado)`,
        armarios: {},
        nextArmarioNum: 0,
      };
      changed = true;
    }

    const arm = String(row.armario || '')
      .trim()
      .toUpperCase();
    if (arm && !c.almacenes[alm].armarios?.[arm]) {
      c.almacenes[alm].armarios = c.almacenes[alm].armarios || {};
      const nombre = String(row.ubicacion || '').trim() || `Armario ${arm}`;
      c.almacenes[alm].armarios[arm] = { nombre, tipo: 'armario' };
      const armNum = parseInt(arm.replace(/^A/i, ''), 10);
      if (!Number.isNaN(armNum)) {
        c.almacenes[alm].nextArmarioNum = Math.max(c.almacenes[alm].nextArmarioNum || 0, armNum + 1);
      }
      changed = true;
    }
  }

  if (!changed) return catalogo;
  const saved = await saveCatalogoToDb(c);
  console.log('[Catalogo] Entradas recuperadas desde contenedores en Supabase');
  return saved;
}

export async function ensureCatalogoSeededInDb(defaultCatalogo) {
  const available = await isCatalogoDbAvailable();
  if (!available) {
    return migrateCatalogoStructure(defaultCatalogo);
  }

  const current = await loadCatalogoFromDb();
  if (current && Object.keys(current.almacenes || {}).length > 0) {
    const bootstrapped = bootstrapSedesCatalog(current);
    const needsSave =
      JSON.stringify(bootstrapped.sedes) !== JSON.stringify(current.sedes) ||
      JSON.stringify(bootstrapped.almacenes) !== JSON.stringify(current.almacenes);
    if (needsSave) {
      await saveCatalogoToDb(bootstrapped);
      console.log('[Catalogo] Sedes/aduanas bootstrap aplicado en Supabase');
    }
    return syncMissingFromContenedores(bootstrapped);
  }

  const seeded = bootstrapSedesCatalog(migrateCatalogoStructure(defaultCatalogo));
  await saveCatalogoToDb(seeded);
  console.log('[Catalogo] Seed inicial escrito en Supabase');
  return syncMissingFromContenedores(seeded);
}
