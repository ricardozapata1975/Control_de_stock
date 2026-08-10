import { config } from '../config.js';
import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';
import { mapUbicacionFields, parseCodigo, codigoLookupVariants } from './ubicacionUtils.js';
import { mapItemCampos } from './itemFields.js';
import { publicItemImageUrl } from './itemImageService.js';
import { almacenesCodigosDeSede } from './sedeScope.js';

function mapInventarioRow(row) {
  const ubi = mapUbicacionFields({
    codigo: row.contenedor_codigo || row.contenedorCodigo,
    almacen: row.almacen,
    armario: row.armario,
    estante: row.estante,
    contenedor: row.contenedor,
    ubicacion: row.ubicacion,
    sede: row.sede,
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
    sede: row.sede || ubi.sede || '',
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

function applySedeViaAlmacenes(query, sede) {
  if (!sede) return query;
  const alms = almacenesCodigosDeSede(sede);
  if (!alms.length) return query.eq('almacen', '__ninguno__');
  return query.in('almacen', alms);
}

const INVENTARIO_PAGE = 1000;

/** Supabase limita a ~1000 filas por request: pagina hasta vaciar. */
async function fetchInventarioPaged(buildQuery) {
  const all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + INVENTARIO_PAGE - 1);
    if (error) return { data: null, error };
    const chunk = data || [];
    all.push(...chunk);
    if (chunk.length < INVENTARIO_PAGE) break;
    from += INVENTARIO_PAGE;
  }
  return { data: all, error: null };
}

export async function listInventario(filters = {}) {
  if (demo.isDemoMode()) return demo.demoListInventario(filters);

  const supabase = getSupabase();
  const sede = String(filters.sede || '').trim().toUpperCase();

  const applyFilters = (query) => {
    let q = query;
    if (sede) {
      // Filtrar por almacenes de la sede (más confiable que la columna sede suelta)
      q = applySedeViaAlmacenes(q, sede);
    }

    if (filters.codigo) {
      const parsed = parseCodigo(filters.codigo);
      if (parsed?.almacen && !parsed.armario) {
        q = q.eq('almacen', parsed.almacen);
      } else if (parsed?.armario && !parsed.estante) {
        q = q.eq('armario', parsed.armario);
        if (parsed.almacen) q = q.eq('almacen', parsed.almacen);
      } else if (parsed?.estante && !parsed.contenedor) {
        q = q.eq('armario', parsed.armario).eq('estante', parsed.estante);
        if (parsed.almacen) q = q.eq('almacen', parsed.almacen);
      } else if (parsed?.codigo) {
        const variants = codigoLookupVariants(parsed);
        if (variants.length === 1) {
          q = q.eq('contenedor_codigo', variants[0]);
        } else {
          q = q.in('contenedor_codigo', variants);
        }
      }
    } else {
      if (filters.almacen) q = q.eq('almacen', filters.almacen);
      if (filters.ubicacion) q = q.ilike('ubicacion', filters.ubicacion);
      if (filters.armario) {
        q = q.eq('armario', filters.armario);
        if (filters.almacen) q = q.eq('almacen', filters.almacen);
      }
      if (filters.estante) {
        q = q.eq('estante', String(filters.estante).trim().toUpperCase());
      }
      const cont = String(filters.contenedor || '').trim().toUpperCase();
      if (cont) {
        q = q.eq('contenedor', cont);
      }
    }
    if (filters.tipo) q = q.ilike('tipo', filters.tipo);

    const codigoFab = String(filters.codigoFabricante || filters.codigo_fabricante || '').trim();
    if (codigoFab) {
      q = q.eq('codigo_fabricante', codigoFab);
    }

    const familia = String(filters.familia || '').trim();
    if (familia) q = q.ilike('familia', familia);
    const subfamilia = String(filters.subfamilia || '').trim();
    if (subfamilia) q = q.ilike('subfamilia', subfamilia);
    const tema = String(filters.tema || '').trim();
    if (tema) q = q.ilike('tema', tema);

    if (filters.itemId) {
      q = q.eq('item_id', filters.itemId);
    }

    if (filters.q) {
      const term = `%${filters.q}%`;
      q = q.or(
        `nombre.ilike.${term},marca.ilike.${term},tipo.ilike.${term},ubicacion.ilike.${term},comentario.ilike.${term},calibracion.ilike.${term},codigo_fabricante.ilike.${term},familia.ilike.${term},subfamilia.ilike.${term},tema.ilike.${term}`
      );
    }
    return q;
  };

  let { data, error } = await fetchInventarioPaged(() =>
    applyFilters(supabase.from('v_inventario').select('*').order('nombre'))
  );

  if (error && sede && /sede|schema cache|column/i.test(error.message || '')) {
    ({ data, error } = await fetchInventarioPaged(() => {
      let fallback = supabase.from('v_inventario').select('*').order('nombre');
      fallback = applySedeViaAlmacenes(fallback, sede);
      if (filters.almacen) fallback = fallback.eq('almacen', filters.almacen);
      if (filters.armario) fallback = fallback.eq('armario', filters.armario);
      if (filters.estante) {
        fallback = fallback.eq('estante', String(filters.estante).trim().toUpperCase());
      }
      const contFb = String(filters.contenedor || '').trim().toUpperCase();
      if (contFb) fallback = fallback.eq('contenedor', contFb);
      if (filters.tipo) fallback = fallback.ilike('tipo', filters.tipo);
      if (filters.itemId) fallback = fallback.eq('item_id', filters.itemId);
      const codigoFab = String(filters.codigoFabricante || filters.codigo_fabricante || '').trim();
      if (codigoFab) fallback = fallback.eq('codigo_fabricante', codigoFab);
      if (filters.q) {
        const term = `%${filters.q}%`;
        fallback = fallback.or(
          `nombre.ilike.${term},marca.ilike.${term},tipo.ilike.${term},ubicacion.ilike.${term},comentario.ilike.${term},calibracion.ilike.${term}`
        );
      }
      return fallback;
    }));
  }

  if (error) {
    const codigoFab = String(filters.codigoFabricante || filters.codigo_fabricante || '').trim();
    if (filters.q && /codigo_fabricante/i.test(error.message || '') && !codigoFab) {
      const { data: data2, error: err2 } = await fetchInventarioPaged(() => {
        let fallback = supabase.from('v_inventario').select('*').order('nombre');
        if (sede) fallback = applySedeViaAlmacenes(fallback, sede);
        if (filters.tipo) fallback = fallback.ilike('tipo', filters.tipo);
        if (filters.almacen) fallback = fallback.eq('almacen', filters.almacen);
        const term = `%${filters.q}%`;
        return fallback.or(
          `nombre.ilike.${term},marca.ilike.${term},tipo.ilike.${term},ubicacion.ilike.${term},comentario.ilike.${term},calibracion.ilike.${term}`
        );
      });
      if (err2) throw Object.assign(new Error(err2.message), { status: 500 });
      const items = (data2 || []).map(mapInventarioRow);
      return {
        items,
        total: items.length,
        lowStock: items.filter((i) => Number(i.cantidad) === 0),
        lowStockThreshold: config.lowStockThreshold,
        sede: sede || null,
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
    sede: sede || null,
  };
}
