import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';
import * as pdemo from './proyectosDemo.js';
import { listInventario } from './inventarioService.js';
import { resolveUbicacion } from './ubicacionService.js';
import { getAduanaUbicacion, getSedeForAlmacen } from './ubicacionUtils.js';
import { almacenesGeneralesCodigosDeSede } from './sedeScope.js';

function isDemo() {
  return demo.isDemoMode();
}

function schemaMissing(err) {
  return /cantidad_recibida|remito_recepcion|recepcion_informe|schema cache|does not exist/i.test(
    err?.message || ''
  );
}

function throwSchemaHint(err) {
  throw Object.assign(
    new Error('Ejecutá supabase/patch-proyectos-fase4.sql en Supabase para habilitar la Fase 4'),
    { status: 503, cause: err?.message }
  );
}

function mapLineaRecepcion(row, itemMeta = {}) {
  const cantidad = Number(row.cantidad || 0);
  const recibida = Number(row.cantidad_recibida ?? row.cantidadRecibida ?? 0);
  return {
    id: row.id,
    stockId: row.stock_id || row.stockId,
    itemId: row.item_id || row.itemId,
    contenedorId: row.contenedor_id || row.contenedorId,
    cantidad,
    cantidadRecibida: recibida,
    cantidadPendiente: Math.max(0, cantidad - recibida),
    descripcion: row.descripcion,
    nombre: row.nombre || itemMeta.nombre || null,
    codigoFabricante: itemMeta.codigo_fabricante || itemMeta.codigoFabricante || null,
    marca: itemMeta.marca || null,
    modelo: itemMeta.modelo || null,
  };
}

function mapRemitoTransito(row, items) {
  const lineas = items.map((i) => mapLineaRecepcion(i));
  const pendiente = lineas.reduce((s, l) => s + l.cantidadPendiente, 0);
  const recibido = lineas.reduce((s, l) => s + l.cantidadRecibida, 0);
  return {
    id: row.id,
    numero: row.numero,
    fecha: row.fecha,
    tipo: row.tipo || 'transferencia',
    estado: row.estado,
    almacenOrigen: row.almacen_origen || row.almacenOrigen,
    almacenDestino: row.almacen_destino || row.almacenDestino,
    sedeOrigen: getSedeForAlmacen(row.almacen_origen || row.almacenOrigen),
    sedeDestino:
      row.ubicacion_destino?.sede ||
      row.ubicacionDestino?.sede ||
      getSedeForAlmacen(row.almacen_destino || row.almacenDestino),
    ubicacionDestino: row.ubicacion_destino || row.ubicacionDestino || null,
    creadoPor: row.created_by || row.createdBy,
    createdAt: row.created_at || row.createdAt,
    recibidoPor: row.recibido_por || row.recibidoPor,
    recibidoAt: row.recibido_at || row.recibidoAt,
    recepcionInforme: row.recepcion_informe || row.recepcionInforme || null,
    recepcionAbiertaAt: row.recepcion_abierta_at || row.recepcionAbiertaAt || null,
    items: lineas,
    itemsCount: lineas.length,
    cantidadPendienteTotal: pendiente,
    cantidadRecibidaTotal: recibido,
    completo: pendiente <= 0 && lineas.length > 0,
  };
}

/**
 * Stock físico de la sede menos reservas activas de Proyectos (por ítem).
 */
export async function listDisponiblesNetos(filters = {}) {
  if (isDemo()) return pdemo.demoListDisponiblesNetos(filters);

  const sede = String(filters.sede || '').trim().toUpperCase() || null;
  const inv = await listInventario({ sede, q: filters.q || undefined });
  const items = Array.isArray(inv) ? inv : inv?.items || [];
  const generales = new Set(sede ? almacenesGeneralesCodigosDeSede(sede) : []);

  const supabase = getSupabase();
  let reservas = [];
  try {
    let rq = supabase.from('proyecto_reservas').select('item_id, cantidad, proyecto_id, sede').eq('estado', 'activa');
    const { data, error } = await rq;
    if (error) {
      if (schemaMissing(error)) throwSchemaHint(error);
      throw Object.assign(new Error(error.message), { status: 500 });
    }
    reservas = data || [];
  } catch (err) {
    if (err.status === 503) throw err;
    reservas = [];
  }

  if (sede) {
    const { data: proyectos } = await supabase.from('proyectos').select('id').eq('sede', sede);
    const ids = new Set((proyectos || []).map((p) => p.id));
    reservas = reservas.filter((r) => ids.has(r.proyecto_id) || String(r.sede || '').toUpperCase() === sede);
  }

  const reservadoByItem = {};
  for (const r of reservas) {
    if (!r.item_id) continue;
    reservadoByItem[r.item_id] = (reservadoByItem[r.item_id] || 0) + Number(r.cantidad || 0);
  }

  const byItem = {};
  for (const row of items) {
    // Solo almacén general (no aduana / reservados / producción)
    if (generales.size && row.almacen && !generales.has(String(row.almacen).toUpperCase())) {
      continue;
    }
    const id = row.itemId;
    if (!id) continue;
    if (!byItem[id]) {
      byItem[id] = {
        itemId: id,
        nombre: row.nombre,
        marca: row.marca,
        modelo: row.modelo,
        tipo: row.tipo,
        detalle: row.detalle || '',
        codigoFabricante: row.codigoFabricante || '',
        imagenUrl: row.imagenUrl || '',
        familia: row.familia || '',
        subfamilia: row.subfamilia || '',
        tema: row.tema || '',
        unidad: row.unidad || '',
        packing: row.packing || '',
        precioLista: row.precioLista ?? null,
        moneda: row.moneda || '',
        pesoKg: row.pesoKg ?? null,
        calibracion: row.calibracion || '',
        comentario: row.comentario || '',
        fechaRelevamiento: row.fechaRelevamiento || '',
        catalogoFuente: row.catalogoFuente || '',
        catalogoVigencia: row.catalogoVigencia || '',
        sede: sede || row.sede || null,
        cantidadFisica: 0,
        cantidadReservada: reservadoByItem[id] || 0,
        ubicaciones: [],
      };
    }
    byItem[id].cantidadFisica += Number(row.cantidad || 0);
    byItem[id].ubicaciones.push({
      stockId: row.stockId || row.id,
      contenedorCodigo: row.contenedorCodigo || row.codigo,
      almacen: row.almacen,
      armario: row.armario,
      estante: row.estante,
      contenedor: row.contenedor,
      cantidad: Number(row.cantidad || 0),
    });
  }

  // Ítems solo reservados (sin físico en sede) también aparecen con neto negativo o 0
  const missingIds = Object.keys(reservadoByItem).filter((id) => !byItem[id] || !byItem[id].nombre);
  if (missingIds.length) {
    const { data: metaRows } = await supabase
      .from('items')
      .select(
        'id, nombre, marca, modelo, tipo, detalle, codigo_fabricante, familia, subfamilia, tema, unidad, packing, precio_lista, moneda, peso_kg, calibracion, comentario, fecha_relevamiento, catalogo_fuente, catalogo_vigencia, imagen_path'
      )
      .in('id', missingIds);
    for (const meta of metaRows || []) {
      const qty = reservadoByItem[meta.id] || 0;
      if (!byItem[meta.id]) {
        byItem[meta.id] = {
          itemId: meta.id,
          nombre: meta.nombre,
          marca: meta.marca,
          modelo: meta.modelo,
          tipo: meta.tipo,
          detalle: meta.detalle || '',
          codigoFabricante: meta.codigo_fabricante || '',
          imagenUrl: '',
          familia: meta.familia || '',
          subfamilia: meta.subfamilia || '',
          tema: meta.tema || '',
          unidad: meta.unidad || '',
          packing: meta.packing || '',
          precioLista: meta.precio_lista != null ? Number(meta.precio_lista) : null,
          moneda: meta.moneda || '',
          pesoKg: meta.peso_kg != null ? Number(meta.peso_kg) : null,
          calibracion: meta.calibracion || '',
          comentario: meta.comentario || '',
          fechaRelevamiento: meta.fecha_relevamiento || '',
          catalogoFuente: meta.catalogo_fuente || '',
          catalogoVigencia: meta.catalogo_vigencia || '',
          sede,
          cantidadFisica: 0,
          cantidadReservada: qty,
          ubicaciones: [],
        };
      } else if (!byItem[meta.id].nombre) {
        Object.assign(byItem[meta.id], {
          nombre: meta.nombre,
          marca: meta.marca,
          modelo: meta.modelo,
          tipo: meta.tipo,
          detalle: meta.detalle || byItem[meta.id].detalle,
          codigoFabricante: meta.codigo_fabricante || byItem[meta.id].codigoFabricante,
          familia: meta.familia || '',
          subfamilia: meta.subfamilia || '',
          tema: meta.tema || '',
          unidad: meta.unidad || '',
          packing: meta.packing || '',
          precioLista: meta.precio_lista != null ? Number(meta.precio_lista) : null,
          moneda: meta.moneda || '',
          pesoKg: meta.peso_kg != null ? Number(meta.peso_kg) : null,
          calibracion: meta.calibracion || '',
          comentario: meta.comentario || '',
          fechaRelevamiento: meta.fecha_relevamiento || '',
          catalogoFuente: meta.catalogo_fuente || '',
          catalogoVigencia: meta.catalogo_vigencia || '',
        });
      }
    }
  }

  for (const [itemId, qty] of Object.entries(reservadoByItem)) {
    if (!byItem[itemId]) {
      byItem[itemId] = {
        itemId,
        nombre: null,
        marca: null,
        modelo: null,
        tipo: null,
        codigoFabricante: '',
        sede,
        cantidadFisica: 0,
        cantidadReservada: qty,
        ubicaciones: [],
      };
    } else {
      byItem[itemId].cantidadReservada = qty;
    }
  }

  let list = Object.values(byItem).map((r) => ({
    ...r,
    cantidadDisponibleNeta: Number(r.cantidadFisica) - Number(r.cantidadReservada),
  }));

  if (filters.q) {
    const term = String(filters.q).toLowerCase();
    list = list.filter(
      (r) =>
        String(r.nombre || '').toLowerCase().includes(term) ||
        String(r.codigoFabricante || '').toLowerCase().includes(term) ||
        String(r.marca || '').toLowerCase().includes(term)
    );
  }

  list.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  return list;
}

async function loadTransferenciasTransito(filters = {}) {
  const supabase = getSupabase();
  let query = supabase
    .from('remitos')
    .select('*')
    .eq('tipo', 'transferencia')
    .in('estado', ['en_transito', 'parcial'])
    .order('created_at', { ascending: false });

  const { data: remitos, error } = await query;
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  if (!remitos?.length) return [];

  let filtered = remitos;
  const sede = String(filters.sede || '').trim().toUpperCase();
  if (sede) {
    const alms = new Set(almacenesCodigosDeSede(sede));
    filtered = remitos.filter(
      (r) =>
        alms.has(String(r.almacen_origen || '').toUpperCase()) ||
        alms.has(String(r.almacen_destino || '').toUpperCase())
    );
  }
  if (filters.almacenDestino) {
    const alm = String(filters.almacenDestino).trim().toUpperCase();
    filtered = filtered.filter((r) => String(r.almacen_destino || '').toUpperCase() === alm);
  }
  if (filters.estado) {
    filtered = filtered.filter((r) => r.estado === filters.estado);
  }
  if (!filtered.length) return [];

  const ids = filtered.map((r) => r.id);
  const { data: itemsRows, error: ei } = await supabase.from('remito_items').select('*').in('remito_id', ids);
  if (ei) {
    if (schemaMissing(ei)) throwSchemaHint(ei);
    throw Object.assign(new Error(ei.message), { status: 500 });
  }

  const itemIds = [...new Set((itemsRows || []).map((i) => i.item_id).filter(Boolean))];
  let itemsById = {};
  if (itemIds.length) {
    const { data: itemsData } = await supabase
      .from('items')
      .select('id, nombre, marca, modelo, codigo_fabricante')
      .in('id', itemIds);
    itemsById = Object.fromEntries((itemsData || []).map((i) => [i.id, i]));
  }

  const byRemito = {};
  for (const row of itemsRows || []) {
    if (!byRemito[row.remito_id]) byRemito[row.remito_id] = [];
    byRemito[row.remito_id].push({
      ...row,
      nombre: itemsById[row.item_id]?.nombre,
      codigo_fabricante: itemsById[row.item_id]?.codigo_fabricante,
      marca: itemsById[row.item_id]?.marca,
      modelo: itemsById[row.item_id]?.modelo,
    });
  }

  return filtered.map((r) => mapRemitoTransito(r, byRemito[r.id] || []));
}

/** Almacén virtual de tránsito: remitos en_transito/parcial con detalle origen→destino */
export async function listMaterialesEnTransito(filters = {}) {
  if (isDemo()) return pdemo.demoListMaterialesEnTransito(filters);
  return loadTransferenciasTransito(filters);
}

/** Remitos con recepción abierta / parcial pendientes de cierre */
export async function listRemitosPendientesCierre(filters = {}) {
  if (isDemo()) return pdemo.demoListRemitosPendientesCierre(filters);

  const all = await loadTransferenciasTransito({ ...filters, estado: undefined });
  return all.filter((r) => {
    if (r.estado === 'parcial') return true;
    if (r.estado === 'en_transito' && r.cantidadRecibidaTotal > 0) return true;
    if (r.recepcionAbiertaAt && !r.completo) return true;
    return false;
  });
}

export async function getRemitoRecepcion(remitoId) {
  if (isDemo()) return pdemo.demoGetRemitoRecepcion(remitoId);

  const supabase = getSupabase();
  const { data: remito, error } = await supabase.from('remitos').select('*').eq('id', remitoId).maybeSingle();
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  if (!remito) throw Object.assign(new Error('Remito no encontrado'), { status: 404 });
  if (remito.tipo !== 'transferencia') {
    throw Object.assign(new Error('El remito no es una transferencia'), { status: 400 });
  }

  const { data: itemsRows, error: ei } = await supabase
    .from('remito_items')
    .select('*')
    .eq('remito_id', remitoId);
  if (ei) throw Object.assign(new Error(ei.message), { status: 500 });

  const itemIds = [...new Set((itemsRows || []).map((i) => i.item_id).filter(Boolean))];
  let itemsById = {};
  if (itemIds.length) {
    const { data: itemsData } = await supabase
      .from('items')
      .select('id, nombre, marca, modelo, codigo_fabricante')
      .in('id', itemIds);
    itemsById = Object.fromEntries((itemsData || []).map((i) => [i.id, i]));
  }

  const items = (itemsRows || []).map((row) => ({
    ...row,
    ...itemsById[row.item_id],
    nombre: itemsById[row.item_id]?.nombre,
  }));

  let eventos = [];
  const { data: ev, error: ee } = await supabase
    .from('remito_recepcion_eventos')
    .select('*')
    .eq('remito_id', remitoId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (!ee) {
    eventos = (ev || []).map((e) => ({
      id: e.id,
      tipo: e.tipo,
      remitoItemId: e.remito_item_id,
      itemId: e.item_id,
      codigo: e.codigo,
      cantidad: e.cantidad != null ? Number(e.cantidad) : null,
      notas: e.notas,
      usuario: e.usuario,
      meta: e.meta,
      createdAt: e.created_at,
    }));
  }

  const mapped = mapRemitoTransito(remito, items);
  return { remito: mapped, eventos };
}

async function resolveDestinoContenedor(remito, ubicacionOverride) {
  const ubi = ubicacionOverride || remito.ubicacion_destino || remito.ubicacionDestino || {};
  const sede =
    ubi.sede ||
    remito.ubicacion_destino?.sede ||
    getSedeForAlmacen(remito.almacen_destino || remito.almacenDestino);
  let armario = ubi.armario;
  let estante = ubi.estante;
  let contenedor = ubi.contenedor || null;
  let almacen = ubi.almacen || remito.almacen_destino || remito.almacenDestino;

  if (!armario || !estante) {
    const aduana = getAduanaUbicacion(sede);
    if (aduana) {
      almacen = aduana.almacen || almacen;
      armario = aduana.armario;
      estante = aduana.estante;
      contenedor = aduana.contenedor || contenedor;
    }
  }

  if (!armario || !estante) {
    throw Object.assign(
      new Error('Ubicación destino requerida (armario y estante). Configurá aduana de la sede o indicá destino.'),
      { status: 400 }
    );
  }

  const cont = await resolveUbicacion({
    sede,
    almacen,
    armario,
    estante,
    contenedor,
  });
  return { cont, ubicacion: { sede, almacen, armario, estante, contenedor } };
}

/**
 * Valida un ítem escaneado contra el remito (recepción línea a línea).
 * payload: { scan?, itemId?, codigo?, cantidad?, ubicacionDestino?, usuario?, forzarExtra? }
 */
export async function validarItemRecepcion(remitoId, payload = {}) {
  if (isDemo()) return pdemo.demoValidarItemRecepcion(remitoId, payload);

  const supabase = getSupabase();
  const cantidad = Math.max(1, Number(payload.cantidad || 1));
  const usuario = payload.usuario || 'Sistema';

  const { data: remito, error } = await supabase
    .from('remitos')
    .select('*')
    .eq('id', remitoId)
    .maybeSingle();
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  if (!remito) throw Object.assign(new Error('Remito no encontrado'), { status: 404 });
  if (remito.tipo !== 'transferencia') {
    throw Object.assign(new Error('El remito no es una transferencia'), { status: 400 });
  }
  if (!['en_transito', 'parcial'].includes(remito.estado)) {
    throw Object.assign(new Error('El remito no admite recepción (ya cerrado o no está en tránsito)'), {
      status: 409,
    });
  }

  const { data: itemsRows, error: ei } = await supabase
    .from('remito_items')
    .select('*')
    .eq('remito_id', remitoId);
  if (ei) throw Object.assign(new Error(ei.message), { status: 500 });

  const itemIds = [...new Set((itemsRows || []).map((i) => i.item_id).filter(Boolean))];
  let itemsById = {};
  if (itemIds.length) {
    const { data: itemsData } = await supabase
      .from('items')
      .select('id, nombre, codigo_fabricante')
      .in('id', itemIds);
    itemsById = Object.fromEntries((itemsData || []).map((i) => [i.id, i]));
  }

  let targetItemId = payload.itemId || null;
  const scan = String(payload.scan || payload.codigo || '').trim();

  if (!targetItemId && scan) {
    // UUID de ítem o código fabricante
    if (/^[0-9a-f-]{36}$/i.test(scan)) {
      targetItemId = scan.toLowerCase();
    } else {
      const { data: byCode } = await supabase
        .from('items')
        .select('id')
        .eq('codigo_fabricante', scan)
        .maybeSingle();
      if (byCode) targetItemId = byCode.id;
      else {
        // buscar por código en items del remito
        const match = (itemsRows || []).find((ri) => {
          const meta = itemsById[ri.item_id];
          return (
            String(meta?.codigo_fabricante || '').toUpperCase() === scan.toUpperCase() ||
            String(ri.item_id) === scan
          );
        });
        if (match) targetItemId = match.item_id;
      }
    }
  }

  if (!targetItemId) {
    await supabase.from('remito_recepcion_eventos').insert({
      remito_id: remitoId,
      tipo: 'extra_no_listado',
      codigo: scan || null,
      cantidad,
      notas: 'Ítem escaneado no pertenece al remito',
      usuario,
      meta: { scan },
    });
    if (!remito.recepcion_abierta_at) {
      await supabase
        .from('remitos')
        .update({
          recepcion_abierta_at: new Date().toISOString(),
          estado: remito.estado === 'en_transito' ? 'parcial' : remito.estado,
        })
        .eq('id', remitoId);
    }
    return {
      ok: false,
      tipo: 'extra_no_listado',
      mensaje: 'El ítem no figura en el remito de transferencia',
      remito: (await getRemitoRecepcion(remitoId)).remito,
    };
  }

  const candidatos = (itemsRows || []).filter(
    (ri) =>
      ri.item_id === targetItemId &&
      Number(ri.cantidad || 0) - Number(ri.cantidad_recibida || 0) > 0
  );
  if (!candidatos.length) {
    const ya = (itemsRows || []).some((ri) => ri.item_id === targetItemId);
    await supabase.from('remito_recepcion_eventos').insert({
      remito_id: remitoId,
      tipo: ya ? 'exceso' : 'extra_no_listado',
      item_id: targetItemId,
      codigo: scan || null,
      cantidad,
      notas: ya ? 'Cantidad del remito ya cubierta' : 'Ítem no listado',
      usuario,
    });
    return {
      ok: false,
      tipo: ya ? 'exceso' : 'extra_no_listado',
      mensaje: ya
        ? 'Ese ítem ya está completo en el remito'
        : 'El ítem no figura en el remito de transferencia',
      remito: (await getRemitoRecepcion(remitoId)).remito,
    };
  }

  const linea = candidatos[0];
  const pendiente = Number(linea.cantidad) - Number(linea.cantidad_recibida || 0);
  const aplicar = Math.min(cantidad, pendiente);

  const { cont, ubicacion } = await resolveDestinoContenedor(remito, payload.ubicacionDestino);

  const { data: stockExist } = await supabase
    .from('stock')
    .select('id, cantidad')
    .eq('item_id', linea.item_id)
    .eq('contenedor_id', cont.id)
    .maybeSingle();

  if (stockExist) {
    const { error: eu } = await supabase
      .from('stock')
      .update({ cantidad: Number(stockExist.cantidad) + aplicar, updated_at: new Date().toISOString() })
      .eq('id', stockExist.id);
    if (eu) throw Object.assign(new Error(eu.message), { status: 500 });
  } else {
    const { error: ei2 } = await supabase.from('stock').insert({
      item_id: linea.item_id,
      contenedor_id: cont.id,
      cantidad: aplicar,
    });
    if (ei2) throw Object.assign(new Error(ei2.message), { status: 500 });
  }

  const nuevaRecibida = Number(linea.cantidad_recibida || 0) + aplicar;
  const { error: eri } = await supabase
    .from('remito_items')
    .update({ cantidad_recibida: nuevaRecibida })
    .eq('id', linea.id);
  if (eri) {
    if (schemaMissing(eri)) throwSchemaHint(eri);
    throw Object.assign(new Error(eri.message), { status: 500 });
  }

  // Si la línea quedó completa, cerrar movimiento en tránsito
  if (nuevaRecibida >= Number(linea.cantidad)) {
    const { data: movs } = await supabase
      .from('movimientos')
      .select('id')
      .eq('remito_id', remitoId)
      .eq('item_id', linea.item_id)
      .eq('contenedor_id', linea.contenedor_id)
      .eq('tipo', 'egreso')
      .eq('estado', 'en_transito');
    for (const m of movs || []) {
      await supabase
        .from('movimientos')
        .update({
          estado: 'transferido',
          motivo: 'Transferencia entre almacenes — recibido (ítem a ítem)',
        })
        .eq('id', m.id);
    }
  }

  await supabase.from('movimientos').insert({
    item_id: linea.item_id,
    contenedor_id: cont.id,
    tipo: 'ingreso',
    cantidad: aplicar,
    usuario,
    sync_status: 'synced',
    estado: 'transferido',
    motivo: 'Recepción transferencia (parcial/ítem)',
    remito_id: remitoId,
  });

  await supabase.from('remito_recepcion_eventos').insert({
    remito_id: remitoId,
    tipo: 'validado',
    remito_item_id: linea.id,
    item_id: linea.item_id,
    codigo: scan || null,
    cantidad: aplicar,
    usuario,
    meta: { ubicacion },
  });

  // Recalcular estado remito
  const { data: allItems } = await supabase.from('remito_items').select('*').eq('remito_id', remitoId);
  const todosCompletos = (allItems || []).every(
    (ri) => Number(ri.cantidad_recibida || 0) >= Number(ri.cantidad || 0)
  );
  const algunoRecibido = (allItems || []).some((ri) => Number(ri.cantidad_recibida || 0) > 0);

  const patch = {
    ubicacion_destino: {
      ...(remito.ubicacion_destino || {}),
      ...ubicacion,
    },
  };
  if (!remito.recepcion_abierta_at) {
    patch.recepcion_abierta_at = new Date().toISOString();
  }

  if (todosCompletos) {
    patch.estado = 'recibido';
    patch.recibido_por = usuario;
    patch.recibido_at = new Date().toISOString();
    patch.recepcion_informe = {
      ...(remito.recepcion_informe || {}),
      cierre: 'completo',
      cerrado_at: new Date().toISOString(),
      modo: 'item_a_item',
    };
  } else if (algunoRecibido) {
    patch.estado = 'parcial';
  }

  await supabase.from('remitos').update(patch).eq('id', remitoId);

  const detail = await getRemitoRecepcion(remitoId);
  return {
    ok: true,
    tipo: 'validado',
    cantidadAplicada: aplicar,
    lineaId: linea.id,
    remito: detail.remito,
    cerradoCompleto: todosCompletos,
  };
}

/**
 * Cierra recepción dejando remito parcial (faltan ítems) o con informe de discrepancias.
 */
export async function cerrarRecepcionParcial(remitoId, payload = {}) {
  if (isDemo()) return pdemo.demoCerrarRecepcionParcial(remitoId, payload);

  const detail = await getRemitoRecepcion(remitoId);
  const remito = detail.remito;
  if (!['en_transito', 'parcial'].includes(remito.estado)) {
    throw Object.assign(new Error('El remito no está abierto para cierre parcial'), { status: 409 });
  }

  const faltantes = remito.items.filter((i) => i.cantidadPendiente > 0);
  const supabase = getSupabase();
  const informe = {
    cierre: faltantes.length ? 'parcial' : 'completo',
    cerrado_at: new Date().toISOString(),
    notas: payload.notas || null,
    usuario: payload.usuario || 'Sistema',
    faltantes: faltantes.map((f) => ({
      remitoItemId: f.id,
      itemId: f.itemId,
      nombre: f.nombre,
      cantidadPendiente: f.cantidadPendiente,
      cantidad: f.cantidad,
      cantidadRecibida: f.cantidadRecibida,
    })),
    extras: (detail.eventos || [])
      .filter((e) => e.tipo === 'extra_no_listado' || e.tipo === 'exceso')
      .slice(0, 50),
  };

  const estado = faltantes.length ? 'parcial' : 'recibido';
  const { error } = await supabase
    .from('remitos')
    .update({
      estado,
      recepcion_informe: informe,
      recibido_por: estado === 'recibido' ? payload.usuario || 'Sistema' : remito.recibidoPor,
      recibido_at: estado === 'recibido' ? new Date().toISOString() : remito.recibidoAt,
    })
    .eq('id', remitoId);
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }

  await supabase.from('remito_recepcion_eventos').insert({
    remito_id: remitoId,
    tipo: 'cierre_parcial',
    notas: payload.notas || null,
    usuario: payload.usuario || 'Sistema',
    meta: informe,
  });

  return getRemitoRecepcion(remitoId);
}

export async function countMaterialesEnTransito(filters = {}) {
  const list = await listMaterialesEnTransito(filters);
  return list.reduce((s, r) => s + (r.cantidadPendienteTotal || 0), 0);
}
