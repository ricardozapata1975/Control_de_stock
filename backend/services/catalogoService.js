import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { ALMACEN_TIPOS, ARMARIO_TIPOS, applyCatalogo, migrateCatalogoStructure } from './ubicacionUtils.js';
import {
  ensureCatalogoSeededInDb,
  insertAlmacenToDb,
  insertArmarioToDb,
  saveCatalogoToDb,
  updateNextAlmacenNumInDb,
  updateNextArmarioNumInDb,
} from './catalogoDb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOGO_PATH = path.join(__dirname, '../data/catalogo.json');

const DEFAULT = {
  almacenes: {
    ALM01: {
      tipo: 'Oficina',
      nombre: 'Oficina principal',
      nextArmarioNum: 3,
      armarios: {
        A00: { nombre: 'Armario Papelería', tipo: 'armario' },
        A01: { nombre: 'Armario Herramientas', tipo: 'armario' },
        A02: { nombre: 'Armario Electrónica', tipo: 'armario' },
      },
    },
  },
  nextAlmacenNum: 2,
  estanteMin: 1,
  estanteMax: 9,
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
    const data = migrateCatalogoStructure({ ...DEFAULT, ...JSON.parse(raw) });
    if (!data.nextAlmacenNum) {
      data.nextAlmacenNum = Object.keys(data.almacenes || {}).length + 1;
    }
    return data;
  } catch {
    return migrateCatalogoStructure({ ...DEFAULT });
  }
}

async function saveCatalogoToFile(data) {
  const migrated = migrateCatalogoStructure({ ...DEFAULT, ...data });
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

export async function addAlmacen({ tipo, nombre }) {
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

  c.almacenes[codigo] = {
    tipo: tipoNorm,
    nombre: nombreNorm,
    armarios: {},
    nextArmarioNum: 0,
  };
  c.nextAlmacenNum = num + 1;

  if (useSupabaseCatalogo()) {
    await insertAlmacenToDb({ codigo, tipo: tipoNorm, nombre: nombreNorm, nextArmarioNum: 0 });
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

export function invalidateCatalogoCache() {
  cache = null;
}
