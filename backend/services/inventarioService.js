import { config } from '../config.js';
import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';
import { mapUbicacionFields, parseCodigo, codigoLookupVariants } from './ubicacionUtils.js';
import { mapItemCampos } from './itemFields.js';
import { publicItemImageUrl } from './itemImageService.js';

function mapInventarioRow(row) {
  const ubi = mapUbicacionFields({
    codigo: row.contenedor_codigo || row.contenedorCodigo,
    almacen: row.almacen,
    armario: row.armario,
    estante: row.estante,
    contenedor: row.contenedor,
    ubicacion: row.ubicacion,
  });
  const campos = mapItemCampos(row);
  const imagenUrl =
    campos.imagenUrl || publicItemImageUrl(row.imagen_path || row.imagenPath) || '';
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
    ...campos,
    imagenUrl,
    cantidad: row.cantidad,
    codigo: row.contenedor_codigo || row.contenedorCodigo,
    codigoFabricante: row.codigo_fabricante || row.codigoFabricante || campos.codigoFabricante || '',
  };
}

export async function listInventario(filters = {}) {
  if (demo.isDemoMode()) return demo.demoListInventario(filters);

  const supabase = getSupabase();
  let query = supabase.from('v_inventario').select('*').order('nombre');

  if (filters.codigo) {
    const parsed = parseCodigo(filters.codigo);
    if (parsed?.almacen && !parsed.armario) {
      query = query.eq('almacen', parsed.almacen);
    } else if (parsed?.armario && !parsed.estante) {
      query = query.eq('armario', parsed.armario);
      if (parsed.almacen) query = query.eq('almacen', parsed.almacen);
    } else if (parsed?.estante && !parsed.contenedor) {
      query = query.eq('armario', parsed.armario).eq('estante', parsed.estante);
      if (parsed.almacen) query = query.eq('almacen', parsed.almacen);
    } else if (parsed?.codigo) {
      const variants = codigoLookupVariants(parsed);
      if (variants.length === 1) {
        query = query.eq('contenedor_codigo', variants[0]);
      } else {
        query = query.in('contenedor_codigo', variants);
      }
    }
  } else {
    if (filters.almacen) query = query.eq('almacen', filters.almacen);
    if (filters.ubicacion) query = query.ilike('ubicacion', filters.ubicacion);
    if (filters.armario) {
      query = query.eq('armario', filters.armario);
      if (filters.almacen) query = query.eq('almacen', filters.almacen);
    }
  }
  if (filters.tipo) query = query.ilike('tipo', filters.tipo);

  const codigoFab = String(filters.codigoFabricante || filters.codigo_fabricante || '').trim();
  if (codigoFab) {
    query = query.eq('codigo_fabricante', codigoFab);
  }

  if (filters.itemId) {
    query = query.eq('item_id', filters.itemId);
  }

  if (filters.q) {
    const term = `%${filters.q}%`;
    query = query.or(
      `nombre.ilike.${term},marca.ilike.${term},tipo.ilike.${term},ubicacion.ilike.${term},comentario.ilike.${term},calibracion.ilike.${term},codigo_fabricante.ilike.${term}`
    );
  }

  const { data, error } = await query;
  if (error) {
    // Vista aún sin columna: degradar búsqueda de texto sin tumbar el listado
    if (
      filters.q &&
      /codigo_fabricante/i.test(error.message || '') &&
      !codigoFab
    ) {
      let fallback = supabase.from('v_inventario').select('*').order('nombre');
      if (filters.tipo) fallback = fallback.ilike('tipo', filters.tipo);
      if (filters.almacen) fallback = fallback.eq('almacen', filters.almacen);
      if (filters.armario) fallback = fallback.eq('armario', filters.armario);
      const term = `%${filters.q}%`;
      fallback = fallback.or(
        `nombre.ilike.${term},marca.ilike.${term},tipo.ilike.${term},ubicacion.ilike.${term},comentario.ilike.${term},calibracion.ilike.${term}`
      );
      const { data: data2, error: err2 } = await fallback;
      if (err2) throw Object.assign(new Error(err2.message), { status: 500 });
      const items = (data2 || []).map(mapInventarioRow);
      return {
        items,
        total: items.length,
        lowStock: items.filter((i) => Number(i.cantidad) === 0),
        lowStockThreshold: config.lowStockThreshold,
      };
    }
    throw Object.assign(new Error(error.message), { status: 500 });
  }

  const items = (data || []).map(mapInventarioRow);
  const lowStock = items.filter((i) => Number(i.cantidad) === 0);

  return {
    items,
    total: items.length,
    lowStock,
    lowStockThreshold: config.lowStockThreshold,
  };
}
