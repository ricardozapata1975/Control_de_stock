import { config } from '../config.js';
import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';
import { mapUbicacionFields } from './ubicacionUtils.js';
import { mapItemCampos } from './itemFields.js';

function mapInventarioRow(row) {
  const ubi = mapUbicacionFields({
    codigo: row.contenedor_codigo || row.contenedorCodigo,
    armario: row.armario,
    estante: row.estante,
    contenedor: row.contenedor,
    ubicacion: row.ubicacion,
  });
  return {
    id: row.stock_id || row.id,
    stockId: row.stock_id || row.id,
    itemId: row.item_id || row.itemId,
    contenedorId: row.contenedor_id || row.contenedorId,
    contenedorCodigo: row.contenedor_codigo || row.contenedorCodigo,
    ...ubi,
    nombre: row.nombre,
    marca: row.marca,
    modelo: row.modelo,
    tipo: row.tipo,
    detalle: row.detalle,
    ...mapItemCampos(row),
    cantidad: row.cantidad,
    codigo: row.contenedor_codigo || row.contenedorCodigo,
  };
}

export async function listInventario(filters = {}) {
  if (demo.isDemoMode()) return demo.demoListInventario(filters);

  const supabase = getSupabase();
  let query = supabase.from('v_inventario').select('*').order('nombre');

  if (filters.ubicacion) query = query.ilike('ubicacion', filters.ubicacion);
  if (filters.armario) query = query.eq('armario', filters.armario);
  if (filters.tipo) query = query.ilike('tipo', filters.tipo);
  if (filters.q) {
    const term = `%${filters.q}%`;
    query = query.or(
      `nombre.ilike.${term},marca.ilike.${term},tipo.ilike.${term},ubicacion.ilike.${term},comentario.ilike.${term},calibracion.ilike.${term}`
    );
  }

  const { data, error } = await query;
  if (error) throw Object.assign(new Error(error.message), { status: 500 });

  const items = (data || []).map(mapInventarioRow);
  const lowStock = items.filter((i) => Number(i.cantidad) === 0);

  return {
    items,
    total: items.length,
    lowStock,
    lowStockThreshold: config.lowStockThreshold,
  };
}
