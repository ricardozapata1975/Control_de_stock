import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';
import { config } from '../config.js';

const BATCH = 80;

function isDemo() {
  return config.demoMode;
}

function normCode(c) {
  return String(c || '')
    .trim()
    .toUpperCase();
}

function parseNum(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(String(val).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Normaliza una fila de catálogo (ya parseada en el cliente).
 */
export function normalizeEnrichRow(raw, fuente) {
  const codigo = normCode(raw.codigo || raw.codigoFabricante || raw.mlfb);
  if (!codigo) return null;
  const row = {
    codigo,
    nombre: String(raw.nombre || raw.descripcion || raw.designation || raw.bezeichnung || '').trim(),
    unidad: String(raw.unidad || raw.unit || '').trim(),
    packing: String(raw.packing || '').trim(),
    precioLista: parseNum(raw.precioLista ?? raw.precio_lista ?? raw.precio ?? raw.listPrice),
    moneda: String(raw.moneda || '').trim().toUpperCase(),
    pesoKg: parseNum(raw.pesoKg ?? raw.peso_kg ?? raw.weight),
    familia: String(raw.familia || '').trim(),
    subfamilia: String(raw.subfamilia || '').trim(),
    tema: String(raw.tema || '').trim(),
    catalogoFuente: String(raw.catalogoFuente || raw.catalogo_fuente || fuente || '').trim(),
    catalogoVigencia: String(raw.catalogoVigencia || raw.catalogo_vigencia || raw.vigencia || '').trim(),
  };
  if (!row.moneda) {
    if (String(fuente).includes('siemens')) row.moneda = 'USD';
    if (String(fuente).includes('sivacon')) row.moneda = 'EUR';
  }
  if (!row.catalogoFuente) row.catalogoFuente = fuente || '';
  return row;
}

function buildUpdate(item, row, modo) {
  const rellenar = modo === 'rellenar' || !modo;
  const forzar = modo === 'forzar';
  const updates = {};

  const setIf = (dbKey, camelKey, value, isNum = false) => {
    if (value === undefined || value === null || value === '') return;
    if (isNum && !Number.isFinite(Number(value))) return;
    const current = item[camelKey] ?? item[dbKey];
    const empty =
      current === undefined ||
      current === null ||
      current === '' ||
      (isNum && !Number.isFinite(Number(current)));
    if (rellenar && !empty) return;
    updates[dbKey] = isNum ? Number(value) : value;
  };

  // Nombre: no pisar descripción SISCOM salvo modo forzar o nombre vacío/genérico
  if (row.nombre) {
    const cur = String(item.nombre || '').trim();
    const emptyName =
      !cur || /^item\b/i.test(cur) || cur.toUpperCase() === String(item.codigo_fabricante || '').toUpperCase();
    if (forzar || emptyName) updates.nombre = row.nombre;
  }

  setIf('unidad', 'unidad', row.unidad);
  setIf('packing', 'packing', row.packing);
  setIf('precio_lista', 'precioLista', row.precioLista, true);
  setIf('moneda', 'moneda', row.moneda);
  setIf('peso_kg', 'pesoKg', row.pesoKg, true);
  setIf('familia', 'familia', row.familia);
  setIf('subfamilia', 'subfamilia', row.subfamilia);
  setIf('tema', 'tema', row.tema);

  if (row.catalogoFuente) {
    const curFuente = item.catalogoFuente || item.catalogo_fuente || '';
    if (forzar || !rellenar || !curFuente) updates.catalogo_fuente = row.catalogoFuente;
  }
  if (row.catalogoVigencia) {
    const curV = item.catalogoVigencia || item.catalogo_vigencia || '';
    if (forzar || !rellenar || !curV) updates.catalogo_vigencia = row.catalogoVigencia;
  }

  if ((!item.marca || !String(item.marca).trim()) && (row.catalogoFuente || forzar)) {
    updates.marca = 'Siemens';
  }

  return updates;
}

async function loadItemsByCodigo() {
  if (isDemo()) {
    const inv = await demo.demoListInventario({});
    const map = new Map();
    for (const row of inv.items || []) {
      const code = normCode(row.codigoFabricante);
      if (!code) continue;
      map.set(code, {
        id: row.itemId,
        nombre: row.nombre,
        marca: row.marca,
        codigo_fabricante: code,
        unidad: row.unidad,
        packing: row.packing,
        precioLista: row.precioLista,
        moneda: row.moneda,
        pesoKg: row.pesoKg,
        familia: row.familia,
        subfamilia: row.subfamilia,
        tema: row.tema,
        catalogoFuente: row.catalogoFuente,
        catalogoVigencia: row.catalogoVigencia,
      });
    }
    return map;
  }

  const supabase = getSupabase();
  const map = new Map();
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('items')
      .select(
        'id, nombre, marca, codigo_fabricante, unidad, packing, precio_lista, moneda, peso_kg, familia, subfamilia, tema, catalogo_fuente, catalogo_vigencia, activo'
      )
      .not('codigo_fabricante', 'is', null)
      .neq('codigo_fabricante', '')
      .range(from, from + PAGE - 1);
    if (error) {
      if (/unidad|packing|precio_lista|catalogo_fuente|column/i.test(error.message || '')) {
        throw Object.assign(
          new Error(
            'Faltan columnas de catálogo en ítems. Ejecutá supabase/patch-item-catalogo.sql en Supabase.'
          ),
          { status: 503 }
        );
      }
      throw Object.assign(new Error(error.message), { status: 500 });
    }
    const chunk = data || [];
    for (const it of chunk) {
      if (it.activo === false) continue;
      const code = normCode(it.codigo_fabricante);
      if (!code) continue;
      map.set(code, {
        id: it.id,
        nombre: it.nombre,
        marca: it.marca,
        codigo_fabricante: code,
        unidad: it.unidad,
        packing: it.packing,
        precioLista: it.precio_lista,
        moneda: it.moneda,
        pesoKg: it.peso_kg,
        familia: it.familia,
        subfamilia: it.subfamilia,
        tema: it.tema,
        catalogoFuente: it.catalogo_fuente,
        catalogoVigencia: it.catalogo_vigencia,
      });
    }
    if (chunk.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

/**
 * Preview: cruza filas de catálogo con ítems por codigo_fabricante.
 */
export async function previewCatalogEnrich({ fuente, vigencia, modo = 'rellenar', rows }) {
  if (!Array.isArray(rows) || !rows.length) {
    throw Object.assign(new Error('Sin filas de catálogo'), { status: 400 });
  }
  const itemsByCode = await loadItemsByCodigo();
  const matched = [];
  const unmatchedSample = [];
  let unmatched = 0;
  let withChanges = 0;
  let withoutChanges = 0;

  for (const raw of rows) {
    const row = normalizeEnrichRow(raw, fuente);
    if (!row) continue;
    if (vigencia && !row.catalogoVigencia) row.catalogoVigencia = vigencia;
    const item = itemsByCode.get(row.codigo);
    if (!item) {
      unmatched += 1;
      if (unmatchedSample.length < 30) unmatchedSample.push(row.codigo);
      continue;
    }
    const updates = buildUpdate(item, row, modo);
    const keys = Object.keys(updates);
    if (keys.length) withChanges += 1;
    else withoutChanges += 1;
    if (matched.length < 200 || keys.length) {
      matched.push({
        codigo: row.codigo,
        itemId: item.id,
        nombreActual: item.nombre,
        nombreCatalogo: row.nombre || null,
        campos: keys,
        preview: updates,
      });
    }
  }

  return {
    fuente: fuente || null,
    modo,
    itemsEnStockConCodigo: itemsByCode.size,
    filasCatalogo: rows.length,
    matched: withChanges + withoutChanges,
    conCambios: withChanges,
    sinCambios: withoutChanges,
    unmatched,
    unmatchedSample,
    sample: matched.filter((m) => m.campos.length).slice(0, 80),
  };
}

/**
 * Aplica enrichment a ítems existentes.
 */
export async function applyCatalogEnrich({ fuente, vigencia, modo = 'rellenar', rows }) {
  if (!Array.isArray(rows) || !rows.length) {
    throw Object.assign(new Error('Sin filas de catálogo'), { status: 400 });
  }
  const itemsByCode = await loadItemsByCodigo();
  const toApply = [];

  for (const raw of rows) {
    const row = normalizeEnrichRow(raw, fuente);
    if (!row) continue;
    if (vigencia && !row.catalogoVigencia) row.catalogoVigencia = vigencia;
    const item = itemsByCode.get(row.codigo);
    if (!item) continue;
    const updates = buildUpdate(item, row, modo);
    if (!Object.keys(updates).length) continue;
    toApply.push({ itemId: item.id, codigo: row.codigo, updates });
  }

  if (isDemo()) {
    return {
      ok: toApply.length,
      actualizados: toApply.length,
      sinMatch: rows.length - toApply.length,
      sample: toApply.slice(0, 20).map((t) => ({ codigo: t.codigo, campos: Object.keys(t.updates) })),
    };
  }

  const supabase = getSupabase();
  let ok = 0;
  const errors = [];

  for (let i = 0; i < toApply.length; i += BATCH) {
    const slice = toApply.slice(i, i + BATCH);
    for (const row of slice) {
      const { error } = await supabase.from('items').update(row.updates).eq('id', row.itemId);
      if (error) {
        errors.push({ codigo: row.codigo, error: error.message });
      } else {
        ok += 1;
      }
    }
  }

  return {
    ok,
    actualizados: ok,
    candidatos: toApply.length,
    errores: errors.slice(0, 40),
    erroresCount: errors.length,
    fuente: fuente || null,
    modo,
  };
}
