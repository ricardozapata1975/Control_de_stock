import { config } from '../config.js';
import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';
import { loadCatalogo, saveCatalogo, invalidateCatalogoCache } from './catalogoService.js';
import { applyCatalogo } from './ubicacionUtils.js';

const TABLES = {
  catalogo: {
    label: 'Catálogo (armarios / rangos)',
    editable: true,
    virtual: true,
  },
  contenedores: {
    label: 'Contenedores / ubicaciones',
    fields: ['id', 'codigo', 'armario', 'estante', 'contenedor', 'ubicacion'],
  },
  items: {
    label: 'Ítems (herramientas)',
    fields: [
      'id',
      'nombre',
      'marca',
      'modelo',
      'tipo',
      'detalle',
      'calibracion',
      'comentario',
      'fecha_relevamiento',
      'activo',
    ],
  },
  stock: {
    label: 'Stock',
    fields: ['id', 'item_id', 'contenedor_id', 'cantidad'],
  },
  movimientos: {
    label: 'Movimientos (solo lectura recomendada)',
    fields: ['id', 'item_id', 'contenedor_id', 'tipo', 'cantidad', 'usuario', 'fecha'],
    readOnly: true,
  },
};

export function listTablesMeta() {
  return Object.entries(TABLES).map(([name, meta]) => ({ name, ...meta }));
}

export async function getTableRows(table) {
  if (table === 'catalogo') {
    const c = await loadCatalogo();
    applyCatalogo(c);
    return { rows: [c], total: 1 };
  }

  if (config.demoMode) {
    const db = await demo.demoLoadRaw();
    const rows = db[table] || [];
    return { rows, total: rows.length };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from(table).select('*').limit(500);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return { rows: data || [], total: data?.length || 0 };
}

export async function saveTableRow(table, row, id) {
  if (table === 'catalogo') {
    await saveCatalogo(row);
    invalidateCatalogoCache();
    const c = await loadCatalogo();
    applyCatalogo(c);
    return row;
  }

  if (TABLES[table]?.readOnly) {
    throw Object.assign(new Error('Tabla de solo lectura'), { status: 403 });
  }

  if (config.demoMode) {
    const db = await demo.demoLoadRaw();
    if (!db[table]) throw Object.assign(new Error('Tabla no encontrada'), { status: 404 });

    if (id) {
      const idx = db[table].findIndex((r) => r.id === id);
      if (idx < 0) throw Object.assign(new Error('Registro no encontrado'), { status: 404 });
      db[table][idx] = { ...db[table][idx], ...row, id };
      await demo.demoSaveRaw(db);
      return db[table][idx];
    }

    const newRow = {
      id: row.id || `${table.slice(0, 3)}-${Date.now().toString(36)}`,
      ...row,
    };
    db[table].push(newRow);
    await demo.demoSaveRaw(db);
    return newRow;
  }

  const supabase = getSupabase();
  if (id) {
    const { data, error } = await supabase.from(table).update(row).eq('id', id).select('*').single();
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    return data;
  }
  const { data, error } = await supabase.from(table).insert(row).select('*').single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}

export async function deleteTableRow(table, id) {
  if (table === 'catalogo') {
    throw Object.assign(new Error('No se puede eliminar el catálogo completo'), { status: 400 });
  }
  if (TABLES[table]?.readOnly) {
    throw Object.assign(new Error('Tabla de solo lectura'), { status: 403 });
  }

  if (config.demoMode) {
    const db = await demo.demoLoadRaw();
    const before = db[table]?.length || 0;
    db[table] = (db[table] || []).filter((r) => r.id !== id);
    if (db[table].length === before) throw Object.assign(new Error('Registro no encontrado'), { status: 404 });
    await demo.demoSaveRaw(db);
    return { ok: true };
  }

  const supabase = getSupabase();
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return { ok: true };
}
