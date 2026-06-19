import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';
import { config } from '../config.js';
import { resolveUbicacion } from './ubicacionService.js';
import { mapUbicacionFields } from './ubicacionUtils.js';
import { itemPayloadFromBody, mapItemCampos } from './itemFields.js';

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

  const { data: contenedores } = await supabase.from('contenedores').select('id, codigo, almacen, armario, estante, contenedor');

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
  } = body;

  const qty = Number(cantidad);
  if (!qty || qty <= 0) throw Object.assign(new Error('Cantidad inválida'), { status: 400 });
  if (!contenedorId && (!armario || !estante)) {
    throw Object.assign(new Error('Armario y estante son obligatorios'), { status: 400 });
  }

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
    ubicacion = await resolveUbicacion({ almacen, armario, estante, contenedor });
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

async function updateItemStock(itemId, { stockId, cantidad, almacen, armario, estante, contenedor }) {
  if (!stockId) {
    throw Object.assign(new Error('stockId requerido para editar ubicación/cantidad'), { status: 400 });
  }

  const qty = Number(cantidad);
  if (Number.isNaN(qty) || qty < 0) {
    throw Object.assign(new Error('Cantidad inválida'), { status: 400 });
  }

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
    const ubicacion = await resolveUbicacion({ almacen, armario, estante, contenedor });
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

  const { stockId, cantidad, almacen, armario, estante, contenedor, ...itemBody } = body;
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
  ];
  const hasItemUpdate = itemFieldKeys.some((k) => itemBody[k] !== undefined);

  if (hasItemUpdate) {
    const payload = itemPayloadFromBody(itemBody);
    if (!payload.nombre) throw Object.assign(new Error('El nombre es obligatorio'), { status: 400 });
    const { error } = await supabase.from('items').update(payload).eq('id', itemId);
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
  }

  if (hasStockUpdate) {
    await updateItemStock(itemId, { stockId, cantidad, almacen, armario, estante, contenedor });
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

export { slugId };
