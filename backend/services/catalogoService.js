import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ALMACEN_TIPOS, applyCatalogo } from './ubicacionUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOGO_PATH = path.join(__dirname, '../data/catalogo.json');

const DEFAULT = {
  almacenes: {
    ALM01: { tipo: 'Oficina', nombre: 'Oficina principal' },
  },
  nextAlmacenNum: 2,
  armarios: {
    A00: 'Armario Papelería',
    A01: 'Armario Herramientas',
    A02: 'Armario Electrónica',
  },
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

export async function loadCatalogo() {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(CATALOGO_PATH, 'utf-8');
    cache = { ...DEFAULT, ...JSON.parse(raw) };
    if (!cache.almacenes) cache.almacenes = { ...DEFAULT.almacenes };
    if (!cache.nextAlmacenNum) {
      cache.nextAlmacenNum = Object.keys(cache.almacenes).length + 1;
    }
  } catch {
    cache = { ...DEFAULT };
  }
  return cache;
}

export async function saveCatalogo(data) {
  cache = { ...DEFAULT, ...data };
  if (!cache.almacenes) cache.almacenes = { ...DEFAULT.almacenes };
  await fs.mkdir(path.dirname(CATALOGO_PATH), { recursive: true });
  await fs.writeFile(CATALOGO_PATH, JSON.stringify(cache, null, 2));
  return cache;
}

export async function getArmariosMap() {
  const c = await loadCatalogo();
  return c.armarios || DEFAULT.armarios;
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
  c.almacenes[codigo] = { tipo: tipoNorm, nombre: nombreNorm };
  c.nextAlmacenNum = num + 1;
  await saveCatalogo(c);
  applyCatalogo(c);
  return { codigo, tipo: tipoNorm, nombre: nombreNorm };
}

export function invalidateCatalogoCache() {
  cache = null;
}
