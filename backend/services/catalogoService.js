import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOGO_PATH = path.join(__dirname, '../data/catalogo.json');

const DEFAULT = {
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
  } catch {
    cache = { ...DEFAULT };
  }
  return cache;
}

export async function saveCatalogo(data) {
  cache = { ...DEFAULT, ...data };
  await fs.mkdir(path.dirname(CATALOGO_PATH), { recursive: true });
  await fs.writeFile(CATALOGO_PATH, JSON.stringify(cache, null, 2));
  return cache;
}

export async function getArmariosMap() {
  const c = await loadCatalogo();
  return c.armarios || DEFAULT.armarios;
}

export function invalidateCatalogoCache() {
  cache = null;
}
