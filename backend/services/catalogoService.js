import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { ALMACEN_TIPOS, ARMARIO_TIPOS, applyCatalogo, migrateCatalogoStructure } from './ubicacionUtils.js';
import {
  ensureCatalogoSeededInDb,
  insertAlmacenToDb,
  insertArmarioToDb,
  insertSedeToDb,
  saveCatalogoToDb,
  updateAlmacenSedeInDb,
  updateNextAlmacenNumInDb,
  updateNextArmarioNumInDb,
  updateNextSedeNumInDb,
} from './catalogoDb.js';
import {
  ADUANA_ARMARIO,
  ADUANA_CONTENEDOR,
  ADUANA_ESTANTE,
  bootstrapSedesCatalog,
  createAduanaForSede,
  nextSedeCode,
} from './sedeBootstrap.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOGO_PATH = path.join(__dirname, '../data/catalogo.json');

const DEFAULT = {
  sedes: {
    SED001: {
      nombre: 'Oficina Ballester',
      aduana: { almacen: 'ALM02', armario: 'A00', estante: 'E01', contenedor: 'C01' },
    },
  },
  almacenes: {
    ALM01: {
      sede: 'SED001',
      tipo: 'Oficina',
      nombre: 'Oficina principal',
      nextArmarioNum: 3,
      armarios: {
        A00: { nombre: 'Armario Papelería', tipo: 'armario' },
        A01: { nombre: 'Armario Herramientas', tipo: 'armario' },
        A02: { nombre: 'Armario Electrónica', tipo: 'armario' },
      },
    },
    ALM02: {
      sede: 'SED001',
      tipo: 'Depósito',
      nombre: 'Recepción tránsito — Oficina Ballester',
      esAduana: true,
      nextArmarioNum: 1,
      armarios: {
        A00: { nombre: 'Gabinete recepción (Aduana)', tipo: 'gabinete' },
      },
    },
  },
  nextSedeNum: 2,
  nextAlmacenNum: 3,
  estanteMin: 0,
  estanteMax: 99,
  contenedorReglas: {
    C: { min: 1, max: 99 },
    B: { min: 0, max: 99 },
    H: { min: 1, max: 99 },
  },
  contenedorEspecial: 'SC',
};

let cache = null;

function useSupabaseCatalogo() {
  return !config.demoMode;
}

function normalizeArmarioTipo(tipo) {
  const t = String(tipo || '').trim();
  if (!ARMARIO_TIPOS.includes(t)) {
    throw Object.assign(
      new Error(`Tipo inválido. Usá: ${ARMARIO_TIPOS.join(', ')}`),
      { status: 400 }
    );
  }
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

async function loadCatalogoFromFile() {
  try {
    const raw = await fs.readFile(CATALOGO_PATH, 'utf-8');
    const data = bootstrapSedesCatalog(migrateCatalogoStructure({ ...DEFAULT, ...JSON.parse(raw) }));
    if (!data.nextAlmacenNum) {
      data.nextAlmacenNum = Object.keys(data.almacenes || {}).length + 1;
    }
    return data;
  } catch {
    return bootstrapSedesCatalog(migrateCatalogoStructure({ ...DEFAULT }));
  }
}

async function saveCatalogoToFile(data) {
  const migrated = bootstrapSedesCatalog(migrateCatalogoStructure({ ...DEFAULT, ...data }));
  await fs.mkdir(path.dirname(CATALOGO_PATH), { recursive: true });
  await fs.writeFile(CATALOGO_PATH, JSON.stringify(migrated, null, 2));
  return migrated;
}

export async function loadCatalogo() {
  if (cache) return cache;

  if (useSupabaseCatalogo()) {
    cache = await ensureCatalogoSeededInDb(DEFAULT);
    return cache;
  }

  cache = await loadCatalogoFromFile();
  return cache;
}

export async function saveCatalogo(data) {
  const migrated = migrateCatalogoStructure({ ...DEFAULT, ...data });

  if (useSupabaseCatalogo()) {
    cache = await saveCatalogoToDb(migrated);
    return cache;
  }

  cache = await saveCatalogoToFile(migrated);
  return cache;
}

export async function getArmariosMap(almacen) {
  const c = await loadCatalogo();
  const alm = almacen || 'ALM01';
  const info = c.almacenes?.[alm];
  if (!info?.armarios) return {};
  const map = {};
  for (const [codigo, val] of Object.entries(info.armarios)) {
    map[codigo] = typeof val === 'string' ? val : val.nombre;
  }
  return map;
}

export async function getAlmacenesMap() {
  const c = await loadCatalogo();
  return c.almacenes || DEFAULT.almacenes;
}

export async function addAlmacen({ tipo, nombre, sede }) {
  const tipoNorm = String(tipo || '').trim();
  const nombreNorm = String(nombre || '').trim();
  if (!ALMACEN_TIPOS.includes(tipoNorm)) {
    throw Object.assign(
      new Error(`Tipo inválido. Usá: ${ALMACEN_TIPOS.join(', ')}`),
      { status: 400 }
    );
  }
  if (!nombreNorm) {
    throw Object.assign(new Error('El nombre del almacén es obligatorio'), { status: 400 });
  }

  const c = await loadCatalogo();
  const num = c.nextAlmacenNum || Object.keys(c.almacenes || {}).length + 1;
  const codigo = `ALM${String(num).padStart(2, '0')}`;
  c.almacenes = c.almacenes || {};
  if (c.almacenes[codigo]) {
    throw Object.assign(new Error(`Código ${codigo} ya existe`), { status: 409 });
  }

  const sedeCode = sede ? String(sede).trim().toUpperCase() : 'SED001';

  c.almacenes[codigo] = {
    sede: sedeCode,
    tipo: tipoNorm,
    nombre: nombreNorm,
    armarios: {},
    nextArmarioNum: 0,
  };
  c.nextAlmacenNum = num + 1;

  if (useSupabaseCatalogo()) {
    await insertAlmacenToDb({
      codigo,
      tipo: tipoNorm,
      nombre: nombreNorm,
      sedeCodigo: sedeCode,
      nextArmarioNum: 0,
    });
    await updateNextAlmacenNumInDb(c.nextAlmacenNum);
    invalidateCatalogoCache();
    const fresh = await loadCatalogo();
    applyCatalogo(fresh);
  } else {
    await saveCatalogoToFile(c);
    cache = c;
    applyCatalogo(c);
  }

  return { codigo, tipo: tipoNorm, nombre: nombreNorm };
}

export async function addArmario({ almacen, tipo, nombre }) {
  const almCode = String(almacen || '').trim().toUpperCase();
  const nombreNorm = String(nombre || '').trim();
  const tipoKey = normalizeArmarioTipo(tipo);

  if (!nombreNorm) {
    throw Object.assign(new Error('El nombre es obligatorio'), { status: 400 });
  }

  const c = await loadCatalogo();
  c.almacenes = c.almacenes || {};
  if (!c.almacenes[almCode]) {
    throw Object.assign(new Error(`Almacén no registrado: ${almCode}`), { status: 400 });
  }

  const alm = c.almacenes[almCode];
  alm.armarios = alm.armarios || {};
  const num = alm.nextArmarioNum ?? Object.keys(alm.armarios).length;
  const codigo = `A${String(num).padStart(2, '0')}`;

  if (alm.armarios[codigo]) {
    throw Object.assign(new Error(`Código ${codigo} ya existe en ${almCode}`), { status: 409 });
  }

  alm.armarios[codigo] = { nombre: nombreNorm, tipo: tipoKey };
  alm.nextArmarioNum = num + 1;

  if (useSupabaseCatalogo()) {
    await insertArmarioToDb({ almacen: almCode, codigo, nombre: nombreNorm, tipo: tipoKey });
    await updateNextArmarioNumInDb(almCode, alm.nextArmarioNum);
    invalidateCatalogoCache();
    const fresh = await loadCatalogo();
    applyCatalogo(fresh);
  } else {
    await saveCatalogoToFile(c);
    cache = c;
    applyCatalogo(c);
  }

  return { codigo, nombre: nombreNorm, tipo: tipoKey, almacen: almCode };
}

/**
 * Asegura un armario con código explícito (ej. A11 desde depósito SISCOM 11.xx).
 * No pisa si ya existe.
 */
export async function ensureArmarioCodigo({
  almacen,
  codigo,
  nombre,
  tipo = 'Gabinete',
}) {
  const almCode = String(almacen || '').trim().toUpperCase();
  const armCode = String(codigo || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!/^A\d{1,3}$/.test(armCode)) {
    throw Object.assign(new Error(`Código de armario inválido: ${codigo}`), { status: 400 });
  }
  const padded = `A${String(parseInt(armCode.replace(/^A/i, ''), 10)).padStart(2, '0')}`;
  // A100 stays A100 (padStart 2 on 100 = "100")
  const finalCode =
    parseInt(armCode.replace(/^A/i, ''), 10) > 99
      ? `A${parseInt(armCode.replace(/^A/i, ''), 10)}`
      : padded;

  const c = await loadCatalogo();
  c.almacenes = c.almacenes || {};
  if (!c.almacenes[almCode]) {
    throw Object.assign(new Error(`Almacén no registrado: ${almCode}`), { status: 400 });
  }
  const alm = c.almacenes[almCode];
  alm.armarios = alm.armarios || {};
  if (alm.armarios[finalCode]) {
    return { codigo: finalCode, nombre: alm.armarios[finalCode].nombre, existed: true, almacen: almCode };
  }

  const tipoKey = normalizeArmarioTipo(tipo);
  const nombreNorm =
    String(nombre || '').trim() || `Gabinete SISCOM ${finalCode.replace(/^A/, '')}`;
  alm.armarios[finalCode] = { nombre: nombreNorm, tipo: tipoKey };
  const num = parseInt(finalCode.replace(/^A/i, ''), 10);
  if (!Number.isNaN(num)) {
    alm.nextArmarioNum = Math.max(alm.nextArmarioNum || 0, num + 1);
  }

  if (useSupabaseCatalogo()) {
    // Aplicar en memoria ya, para que el import no dependa del round-trip a DB
    cache = c;
    applyCatalogo(c);
    try {
      await insertArmarioToDb({
        almacen: almCode,
        codigo: finalCode,
        nombre: nombreNorm,
        tipo: tipoKey,
      });
      await updateNextArmarioNumInDb(almCode, alm.nextArmarioNum);
    } catch (e) {
      // Si ya existe en DB (carrera), seguimos con el catálogo en memoria
      if (e?.status !== 409) throw e;
    }
    invalidateCatalogoCache();
    const fresh = await loadCatalogo();
    // Fusionar por si el reload no trae aún el alta
    if (fresh?.almacenes?.[almCode]) {
      fresh.almacenes[almCode].armarios = fresh.almacenes[almCode].armarios || {};
      if (!fresh.almacenes[almCode].armarios[finalCode]) {
        fresh.almacenes[almCode].armarios[finalCode] = { nombre: nombreNorm, tipo: tipoKey };
      }
    }
    applyCatalogo(fresh);
  } else {
    await saveCatalogoToFile(c);
    cache = c;
    applyCatalogo(c);
  }

  return { codigo: finalCode, nombre: nombreNorm, existed: false, almacen: almCode };
}

export function invalidateCatalogoCache() {
  cache = null;
}

export async function addSede({ nombre }) {
  const nombreNorm = String(nombre || '').trim();
  if (!nombreNorm) {
    throw Object.assign(new Error('El nombre de la sede es obligatorio'), { status: 400 });
  }

  const c = await loadCatalogo();
  c.sedes = c.sedes || {};
  const codigo = nextSedeCode(c);
  if (c.sedes[codigo]) {
    throw Object.assign(new Error(`Código ${codigo} ya existe`), { status: 409 });
  }

  c.sedes[codigo] = { nombre: nombreNorm };
  const aduana = createAduanaForSede(c, codigo, nombreNorm);

  if (useSupabaseCatalogo()) {
    await insertSedeToDb({ codigo, nombre: nombreNorm, aduana });
    const alm = c.almacenes[aduana.almacen];
    await insertAlmacenToDb({
      codigo: aduana.almacen,
      tipo: alm.tipo,
      nombre: alm.nombre,
      sedeCodigo: codigo,
      nextArmarioNum: alm.nextArmarioNum,
      esAduana: true,
    });
    await insertArmarioToDb({
      almacen: aduana.almacen,
      codigo: ADUANA_ARMARIO,
      nombre: alm.armarios[ADUANA_ARMARIO].nombre,
      tipo: alm.armarios[ADUANA_ARMARIO].tipo,
    });
    await updateNextAlmacenNumInDb(c.nextAlmacenNum);
    await updateNextSedeNumInDb(c.nextSedeNum);
    invalidateCatalogoCache();
    const fresh = await loadCatalogo();
    applyCatalogo(fresh);
  } else {
    await saveCatalogoToFile(c);
    cache = c;
    applyCatalogo(c);
  }

  return { codigo, nombre: nombreNorm, aduana };
}

export async function assignAlmacenSede({ almacen, sede }) {
  const almCode = String(almacen || '').trim().toUpperCase();
  const sedeCode = String(sede || '').trim().toUpperCase();
  const c = await loadCatalogo();
  if (!c.almacenes?.[almCode]) {
    throw Object.assign(new Error(`Almacén no registrado: ${almCode}`), { status: 404 });
  }
  if (!c.sedes?.[sedeCode]) {
    throw Object.assign(new Error(`Sede no registrada: ${sedeCode}`), { status: 404 });
  }
  c.almacenes[almCode].sede = sedeCode;

  if (useSupabaseCatalogo()) {
    await updateAlmacenSedeInDb(almCode, sedeCode);
    invalidateCatalogoCache();
    const fresh = await loadCatalogo();
    applyCatalogo(fresh);
  } else {
    await saveCatalogoToFile(c);
    cache = c;
    applyCatalogo(c);
  }

  return { almacen: almCode, sede: sedeCode };
}
