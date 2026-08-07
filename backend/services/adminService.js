import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';
import { config } from '../config.js';
import { resolveUbicacion } from './ubicacionService.js';
import { mapUbicacionFields, normalizeAlmacen, getSedeForAlmacen } from './ubicacionUtils.js';
import { itemPartialUpdateFromBody, itemPayloadFromBody, mapItemCampos } from './itemFields.js';
import { publicItemImageUrl } from './itemImageService.js';
import { almacenesCodigosDeSede } from './sedeScope.js';

function isDemoMode() {
  return config.demoMode;
}

function slugId(prefix, text) {
  const base = String(text || 'item')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
  return `${prefix}-${base || 'nuevo'}-${Date.now().toString(36)}`;
}

export async function listItemsAdmin() {
  if (isDemoMode()) return demo.demoListItemsAdmin();
  const supabase = getSupabase();
  const { data: items, error: e1 } = await supabase.from('items').select('*').order('nombre');
  if (e1) throw Object.assign(new Error(e1.message), { status: 500 });

  const { data: stock, error: e2 } = await supabase.from('stock').select('id, item_id, contenedor_id, cantidad');
  if (e2) throw Object.assign(new Error(e2.message), { status: 500 });

  const { data: contenedores } = await supabase
    .from('contenedores')
    .select('id, codigo, almacen, armario, estante, contenedor, sede');

  return (items || []).map((item) => {
    const rows = (stock || []).filter((s) => s.item_id === item.id);
    const totalStock = rows.reduce((sum, s) => sum + s.cantidad, 0);
    return {
      id: item.id,
      nombre: item.nombre,
      marca: item.marca,
      modelo: item.modelo,
      tipo: item.tipo,
      detalle: item.detalle,
      ...mapItemCampos(item),
      imagenUrl: item.imagen_url || publicItemImageUrl(item.imagen_path) || '',
      activo: item.activo !== false,
      totalStock,
      ubicaciones: rows.map((s) => {
        const c = contenedores?.find((x) => x.id === s.contenedor_id);
        return {
          stockId: s.id,
          contenedorId: s.contenedor_id,
          contenedorCodigo: c?.codigo,
          cantidad: s.cantidad,
          ...mapUbicacionFields(c),
        };
      }),
    };
  });
}

function assertAlmacenEnSede(almacen, sedeSession) {
  if (!sedeSession || !almacen) return;
  const alm = normalizeAlmacen(almacen);
  const allowed = almacenesCodigosDeSede(sedeSession);
  if (allowed.length && !allowed.includes(alm)) {
    throw Object.assign(
      new Error(
        `El almacén ${alm} no pertenece a la sucursal activa (${sedeSession}). Cambiá de sucursal o elegí un almacén de esa sede.`
      ),
      { status: 403 }
    );
  }
}

export async function altaStock(body, adminName) {
  const {
    modo = 'nuevo',
    itemId,
    nombre,
    marca = '',
    modelo = '',
    tipo = '',
    detalle = '',
    calibracion = '',
    comentario = '',
    fecha_relevamiento,
    contenedorId,
    almacen,
    armario,
    estante,
    contenedor,
    cantidad,
    sede,
  } = body;

  const qty = Number(cantidad);
  if (!qty || qty <= 0) throw Object.assign(new Error('Cantidad inválida'), { status: 400 });
  if (!contenedorId && (!armario || !estante)) {
    throw Object.assign(new Error('Armario y estante son obligatorios'), { status: 400 });
  }

  const sedeTrabajo = sede || (almacen ? getSedeForAlmacen(almacen) : null);
  if (almacen) assertAlmacenEnSede(almacen, sede);

  let ubicacion;
  if (contenedorId && isDemoMode()) {
    const db = await demo.demoListContenedores();
    ubicacion = db.find((c) => c.id === contenedorId);
    if (!ubicacion) throw Object.assign(new Error('Ubicación no encontrada'), { status: 404 });
  } else if (contenedorId && !isDemoMode()) {
    const supabase = getSupabase();
    const { data: cont, error: ec } = await supabase
      .from('contenedores')
      .select('id')
      .eq('id', contenedorId)
      .maybeSingle();
    if (ec) throw Object.assign(new Error(ec.message), { status: 500 });
    if (!cont) throw Object.assign(new Error('Ubicación no encontrada'), { status: 404 });
    ubicacion = cont;
  } else {
    ubicacion = await resolveUbicacion({
      sede: sedeTrabajo,
      almacen,
      armario,
      estante,
      contenedor,
    });
  }

  const resolvedContenedorId = ubicacion.id;

  if (isDemoMode()) {
    return demo.demoAltaStock({
      modo,
      itemId,
      nombre,
      marca,
      modelo,
      tipo,
      detalle,
      calibracion,
      comentario,
      fecha_relevamiento,
      contenedorId: resolvedContenedorId,
      cantidad: qty,
      adminName,
    });
  }

  const supabase = getSupabase();

  let resolvedItemId = itemId;

  if (modo === 'nuevo' || !itemId) {
    if (!nombre?.trim()) throw Object.assign(new Error('El nombre del ítem es obligatorio'), { status: 400 });
    const { data: newItem, error: ei } = await supabase
      .from('items')
      .insert({
        nombre: nombre.trim(),
        marca: marca?.trim() || '',
        modelo: modelo?.trim() || '',
        tipo: tipo?.trim() || '',
        detalle: detalle?.trim() || '',
        calibracion: calibracion?.trim() || '',
        comentario: comentario?.trim() || '',
        fecha_relevamiento: itemPayloadFromBody({ fecha_relevamiento }).fecha_relevamiento,
        activo: true,
      })
      .select('id')
      .single();
    if (ei) throw Object.assign(new Error(ei.message), { status: 500 });
    resolvedItemId = newItem.id;
  } else {
    const { data: existing, error: ex } = await supabase
      .from('items')
      .select('id, activo')
      .eq('id', itemId)
      .maybeSingle();
    if (ex) throw Object.assign(new Error(ex.message), { status: 500 });
    if (!existing) throw Object.assign(new Error('Ítem no encontrado'), { status: 404 });
    if (!existing.activo) throw Object.assign(new Error('El ítem está dado de baja'), { status: 409 });
    resolvedItemId = existing.id;
  }

  const { data: stockRow, error: es } = await supabase
    .from('stock')
    .select('id, cantidad')
    .eq('item_id', resolvedItemId)
    .eq('contenedor_id', resolvedContenedorId)
    .maybeSingle();
  if (es) throw Object.assign(new Error(es.message), { status: 500 });

  if (stockRow) {
    const { error: eu } = await supabase
      .from('stock')
      .update({ cantidad: stockRow.cantidad + qty, updated_at: new Date().toISOString() })
      .eq('id', stockRow.id);
    if (eu) throw Object.assign(new Error(eu.message), { status: 500 });
  } else {
    const { error: ei } = await supabase.from('stock').insert({
      item_id: resolvedItemId,
      contenedor_id: resolvedContenedorId,
      cantidad: qty,
    });
    if (ei) throw Object.assign(new Error(ei.message), { status: 500 });
  }

  return {
    ok: true,
    itemId: resolvedItemId,
    cantidadAgregada: qty,
    codigoUbicacion: ubicacion.codigo,
    registradoPor: adminName,
  };
}

async function updateItemStock(itemId, { stockId, cantidad, almacen, armario, estante, contenedor, sede }) {
  if (!stockId) {
    throw Object.assign(new Error('stockId requerido para editar ubicación/cantidad'), { status: 400 });
  }

  const qty = Number(cantidad);
  if (Number.isNaN(qty) || qty < 0) {
    throw Object.assign(new Error('Cantidad inválida'), { status: 400 });
  }

  if (almacen) assertAlmacenEnSede(almacen, sede);

  const supabase = getSupabase();
  const { data: stockRow, error: es } = await supabase
    .from('stock')
    .select('id, item_id, contenedor_id, cantidad')
    .eq('id', stockId)
    .eq('item_id', itemId)
    .maybeSingle();
  if (es) throw Object.assign(new Error(es.message), { status: 500 });
  if (!stockRow) throw Object.assign(new Error('Registro de stock no encontrado'), { status: 404 });

  let targetContenedorId = stockRow.contenedor_id;
  if (armario && estante) {
    const ubicacion = await resolveUbicacion({
      sede: sede || getSedeForAlmacen(almacen),
      almacen,
      armario,
      estante,
      contenedor,
    });
    targetContenedorId = ubicacion.id;
  }

  if (targetContenedorId === stockRow.contenedor_id) {
    if (qty === 0) {
      const { error: ed } = await supabase.from('stock').delete().eq('id', stockId);
      if (ed) throw Object.assign(new Error(ed.message), { status: 500 });
    } else {
      const { error: eu } = await supabase
        .from('stock')
        .update({ cantidad: qty, updated_at: new Date().toISOString() })
        .eq('id', stockId);
      if (eu) throw Object.assign(new Error(eu.message), { status: 500 });
    }
    return;
  }

  if (qty === 0) {
    const { error: ed } = await supabase.from('stock').delete().eq('id', stockId);
    if (ed) throw Object.assign(new Error(ed.message), { status: 500 });
    return;
  }

  const { data: destStock, error: edq } = await supabase
    .from('stock')
    .select('id, cantidad')
    .eq('item_id', itemId)
    .eq('contenedor_id', targetContenedorId)
    .maybeSingle();
  if (edq) throw Object.assign(new Error(edq.message), { status: 500 });

  if (destStock) {
    const { error: em } = await supabase
      .from('stock')
      .update({ cantidad: destStock.cantidad + qty, updated_at: new Date().toISOString() })
      .eq('id', destStock.id);
    if (em) throw Object.assign(new Error(em.message), { status: 500 });
    const { error: ed } = await supabase.from('stock').delete().eq('id', stockId);
    if (ed) throw Object.assign(new Error(ed.message), { status: 500 });
  } else {
    const { error: em } = await supabase
      .from('stock')
      .update({
        contenedor_id: targetContenedorId,
        cantidad: qty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', stockId);
    if (em) throw Object.assign(new Error(em.message), { status: 500 });
  }
}

export async function updateItem(itemId, body) {
  if (!itemId) throw Object.assign(new Error('itemId requerido'), { status: 400 });
  if (isDemoMode()) return demo.demoUpdateItem(itemId, body);

  const { stockId, cantidad, almacen, armario, estante, contenedor, sede, ...itemBody } = body;
  const hasStockUpdate =
    stockId !== undefined ||
    cantidad !== undefined ||
    almacen !== undefined ||
    armario !== undefined ||
    estante !== undefined ||
    contenedor !== undefined;

  const supabase = getSupabase();

  const itemFieldKeys = [
    'nombre',
    'marca',
    'modelo',
    'tipo',
    'detalle',
    'calibracion',
    'comentario',
    'fechaRelevamiento',
    'fecha_relevamiento',
    'codigoFabricante',
    'codigo_fabricante',
  ];
  const hasItemUpdate = itemFieldKeys.some((k) => itemBody[k] !== undefined);

  if (hasItemUpdate) {
    const payload = itemPartialUpdateFromBody(itemBody);
    if (Object.keys(payload).length === 0) {
      throw Object.assign(new Error('No hay campos de ítem para actualizar'), { status: 400 });
    }
    if (payload.nombre !== undefined && !payload.nombre) {
      throw Object.assign(new Error('El nombre es obligatorio'), { status: 400 });
    }
    const { error } = await supabase.from('items').update(payload).eq('id', itemId);
    if (error) {
      if (error.code === '23505') {
        throw Object.assign(
          new Error('Ese código de fabricante ya está asignado a otro ítem'),
          { status: 409 }
        );
      }
      throw Object.assign(new Error(error.message), { status: 500 });
    }
  }

  if (hasStockUpdate) {
    await updateItemStock(itemId, { stockId, cantidad, almacen, armario, estante, contenedor, sede });
  }

  if (!hasItemUpdate && !hasStockUpdate) {
    throw Object.assign(new Error('No hay campos para actualizar'), { status: 400 });
  }

  return { ok: true, itemId };
}

export async function bajaItem(itemId, adminName) {
  if (!itemId) throw Object.assign(new Error('itemId requerido'), { status: 400 });
  if (isDemoMode()) return demo.demoBajaItem(itemId, adminName);

  const supabase = getSupabase();

  const { data: pendientes } = await supabase
    .from('v_egresos_pendientes')
    .select('id')
    .eq('item_id', itemId)
    .limit(1);
  if (pendientes?.length) {
    throw Object.assign(
      new Error('No se puede dar de baja: hay egresos pendientes de devolución'),
      { status: 409 }
    );
  }

  const { error } = await supabase.from('items').update({ activo: false }).eq('id', itemId);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });

  return { ok: true, itemId, registradoPor: adminName };
}

const PURGE_PAGE = 1000;
const PURGE_BATCH = 150;

async function fetchAllPaged(supabase, table, select, applyFilters) {
  const rows = [];
  let from = 0;
  for (;;) {
    let q = supabase.from(table).select(select).range(from, from + PURGE_PAGE - 1);
    q = applyFilters(q);
    const { data, error } = await q;
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    const chunk = data || [];
    rows.push(...chunk);
    if (chunk.length < PURGE_PAGE) break;
    from += PURGE_PAGE;
  }
  return rows;
}

async function deleteIds(supabase, table, ids) {
  let n = 0;
  for (let i = 0; i < ids.length; i += PURGE_BATCH) {
    const slice = ids.slice(i, i + PURGE_BATCH);
    const { error } = await supabase.from(table).delete().in('id', slice);
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    n += slice.length;
  }
  return n;
}

/** Lista stock de un almacén (para selección masiva en UI). */
export async function listStockByAlmacen(almacen) {
  const alm = normalizeAlmacen(almacen);
  if (isDemoMode()) {
    const items = await demo.demoListItemsAdmin();
    const rows = [];
    for (const it of items) {
      for (const u of it.ubicaciones || []) {
        if (u.almacen === alm && u.stockId) {
          rows.push({
            stockId: u.stockId,
            itemId: it.id,
            nombre: it.nombre,
            codigoFabricante: it.codigo_fabricante || '',
            cantidad: u.cantidad,
            contenedorCodigo: u.contenedorCodigo || u.codigoCompleto || '',
            almacen: u.almacen,
            armario: u.armario,
            estante: u.estante,
            sede: u.sede || '',
          });
        }
      }
    }
    return { almacen: alm, total: rows.length, rows };
  }

  const supabase = getSupabase();
  const contenedores = await fetchAllPaged(supabase, 'contenedores', 'id, codigo, almacen, armario, estante, sede', (q) =>
    q.eq('almacen', alm)
  );
  if (!contenedores.length) return { almacen: alm, total: 0, rows: [] };

  const contById = Object.fromEntries(contenedores.map((c) => [c.id, c]));
  const stockRows = [];
  const contIds = contenedores.map((c) => c.id);
  for (let i = 0; i < contIds.length; i += PURGE_BATCH) {
    const slice = contIds.slice(i, i + PURGE_BATCH);
    const chunk = await fetchAllPaged(supabase, 'stock', 'id, item_id, contenedor_id, cantidad', (q) =>
      q.in('contenedor_id', slice)
    );
    stockRows.push(...chunk);
  }

  const itemIds = [...new Set(stockRows.map((s) => s.item_id))];
  const items = [];
  for (let i = 0; i < itemIds.length; i += PURGE_BATCH) {
    const slice = itemIds.slice(i, i + PURGE_BATCH);
    const chunk = await fetchAllPaged(supabase, 'items', 'id, nombre, codigo_fabricante, activo', (q) =>
      q.in('id', slice)
    );
    items.push(...chunk);
  }
  const itemById = Object.fromEntries(items.map((it) => [it.id, it]));

  const rows = stockRows.map((s) => {
    const c = contById[s.contenedor_id];
    const it = itemById[s.item_id];
    return {
      stockId: s.id,
      itemId: s.item_id,
      nombre: it?.nombre || '',
      codigoFabricante: it?.codigo_fabricante || '',
      cantidad: s.cantidad,
      contenedorCodigo: c?.codigo || '',
      almacen: c?.almacen || alm,
      armario: c?.armario || '',
      estante: c?.estante || '',
      sede: c?.sede || '',
    };
  });

  return { almacen: alm, total: rows.length, rows };
}

/**
 * Borra stock de un almacén (todo o ids seleccionados).
 * Opcionalmente desactiva ítems huérfanos y borra contenedores vacíos.
 */
export async function purgeAlmacenStock({
  almacen,
  stockIds = null,
  deactivateOrphanItems = true,
  deleteEmptyContenedores = true,
}) {
  const alm = normalizeAlmacen(almacen);
  if (isDemoMode()) {
    throw Object.assign(new Error('Purge de almacén no disponible en modo demo'), { status: 400 });
  }

  const supabase = getSupabase();
  const listed = await listStockByAlmacen(alm);
  let target = listed.rows;
  if (Array.isArray(stockIds) && stockIds.length) {
    const want = new Set(stockIds.map(String));
    target = target.filter((r) => want.has(String(r.stockId)));
  }

  const ids = target.map((r) => r.stockId);
  const itemIds = [...new Set(target.map((r) => r.itemId))];
  const qty = target.reduce((a, r) => a + Number(r.cantidad || 0), 0);

  let stockDeleted = 0;
  if (ids.length) stockDeleted = await deleteIds(supabase, 'stock', ids);

  let itemsDeactivated = 0;
  if (deactivateOrphanItems && itemIds.length) {
    for (let i = 0; i < itemIds.length; i += PURGE_BATCH) {
      const slice = itemIds.slice(i, i + PURGE_BATCH);
      const remaining = await fetchAllPaged(supabase, 'stock', 'item_id', (q) => q.in('item_id', slice));
      const still = new Set(remaining.map((r) => r.item_id));
      const orphans = slice.filter((id) => !still.has(id));
      if (!orphans.length) continue;
      const { error } = await supabase.from('items').update({ activo: false }).in('id', orphans);
      if (error) throw Object.assign(new Error(error.message), { status: 500 });
      itemsDeactivated += orphans.length;
    }
  }

  let contenedoresDeleted = 0;
  if (deleteEmptyContenedores) {
    const contenedores = await fetchAllPaged(supabase, 'contenedores', 'id', (q) => q.eq('almacen', alm));
    const contIds = contenedores.map((c) => c.id);
    if (contIds.length) {
      const still = await fetchAllPaged(supabase, 'stock', 'contenedor_id', (q) =>
        q.in('contenedor_id', contIds)
      );
      const busy = new Set(still.map((s) => s.contenedor_id));
      const empty = contIds.filter((id) => !busy.has(id));
      if (empty.length) contenedoresDeleted = await deleteIds(supabase, 'contenedores', empty);
    }
  }

  return {
    ok: true,
    almacen: alm,
    stockDeleted,
    itemsDeactivated,
    contenedoresDeleted,
    unidades: qty,
    seleccionadas: target.length,
  };
}

export { slugId };
