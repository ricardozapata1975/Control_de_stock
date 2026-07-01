import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';
import { mapEmpresa } from './empresasEmisorasService.js';

function mapRemitoItem(row) {
  return {
    id: row.id,
    stockId: row.stock_id || row.stockId,
    itemId: row.item_id || row.itemId,
    contenedorId: row.contenedor_id || row.contenedorId,
    cantidad: row.cantidad,
    descripcion: row.descripcion,
    nombre: row.nombre || row.items?.nombre,
  };
}

function mapUbicacionDestino(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    almacen: raw.almacen || null,
    armario: raw.armario || null,
    estante: raw.estante || null,
    contenedor: raw.contenedor || null,
    cede: raw.cede || null,
  };
}

function mapRemitoDetalle(row, empresa, cliente, items) {
  return {
    id: row.id,
    numero: row.numero,
    fecha: row.fecha,
    tipo: row.tipo || 'venta',
    estado: row.estado || 'confirmado',
    almacenOrigen: row.almacen_origen || row.almacenOrigen || null,
    almacenDestino: row.almacen_destino || row.almacenDestino || null,
    ubicacionDestino: mapUbicacionDestino(row.ubicacion_destino || row.ubicacionDestino),
    recibidoPor: row.recibido_por || row.recibidoPor || null,
    recibidoAt: row.recibido_at || row.recibidoAt || null,
    empresa,
    cliente: cliente
      ? {
          id: cliente.id,
          nombre: cliente.nombre,
          razonSocial: cliente.razon_social || cliente.razonSocial,
          iva: cliente.iva,
          domicilio: cliente.domicilio,
          localidad: cliente.localidad,
          vRef: cliente.v_ref || cliente.vRef,
          cuit: cliente.cuit,
        }
      : null,
    cantBultos: row.cant_bultos || row.cantBultos,
    transportista: row.transportista,
    transportistaCuit: row.transportista_cuit || row.transportistaCuit,
    transportistaDomicilio: row.transportista_domicilio || row.transportistaDomicilio,
    aclaracion: row.aclaracion,
    dni: row.dni,
    createdBy: row.created_by || row.createdBy,
    createdAt: row.created_at || row.createdAt,
    items: items.map(mapRemitoItem),
  };
}

export async function crearRemito(payload, createdBy) {
  if (demo.isDemoMode()) return demo.demoCrearRemito(payload, createdBy);

  const {
    tipo = 'venta',
    numero,
    fecha,
    empresaEmisoraId,
    cliente,
    cantBultos,
    transportista,
    transportistaCuit,
    transportistaDomicilio,
    aclaracion,
    dni,
    items,
    almacenOrigen,
    almacenDestino,
    ubicacionDestino,
  } = payload;

  if (!empresaEmisoraId) {
    throw Object.assign(new Error('Empresa emisora requerida'), { status: 400 });
  }
  if (!items?.length) {
    throw Object.assign(new Error('El remito debe tener al menos un ítem'), { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('crear_remito', {
    p_numero: Number(numero),
    p_fecha: fecha,
    p_empresa_emisora_id: empresaEmisoraId,
    p_cliente: cliente || {},
    p_cant_bultos: cantBultos || null,
    p_transportista: transportista || null,
    p_transportista_cuit: transportistaCuit || null,
    p_transportista_domicilio: transportistaDomicilio || null,
    p_aclaracion: aclaracion || null,
    p_dni: dni || null,
    p_created_by: createdBy || 'Sistema',
    p_items: items.map((it) => ({
      stock_id: it.stockId,
      item_id: it.itemId,
      contenedor_id: it.contenedorId,
      cantidad: Number(it.cantidad),
      descripcion: it.descripcion || null,
    })),
    p_tipo: tipo,
    p_almacen_origen: almacenOrigen || null,
    p_almacen_destino: almacenDestino || null,
    p_ubicacion_destino: ubicacionDestino || null,
  });

  if (error) {
    const status =
      error.message?.includes('insuficiente') || error.message?.includes('existe') ? 409 : 400;
    throw Object.assign(new Error(error.message), { status });
  }
  return data;
}

export async function listTransferenciasPendientes(almacenDestino) {
  if (demo.isDemoMode()) return demo.demoListTransferenciasPendientes(almacenDestino);

  const supabase = getSupabase();
  let query = supabase
    .from('remitos')
    .select('*')
    .eq('tipo', 'transferencia')
    .eq('estado', 'en_transito')
    .order('created_at', { ascending: false });

  if (almacenDestino) {
    query = query.eq('almacen_destino', almacenDestino);
  }

  const { data: remitos, error } = await query;
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!remitos?.length) return [];

  const ids = remitos.map((r) => r.id);
  const empresaIds = [...new Set(remitos.map((r) => r.empresa_emisora_id))];
  const clienteIds = [...new Set(remitos.map((r) => r.cliente_id).filter(Boolean))];

  const [itemsRes, empresasRes, clientesRes] = await Promise.all([
    supabase.from('remito_items').select('*').in('remito_id', ids),
    supabase.from('empresas_emisoras').select('*').in('id', empresaIds),
    clienteIds.length
      ? supabase.from('clientes').select('*').in('id', clienteIds)
      : { data: [], error: null },
  ]);

  if (itemsRes.error) throw Object.assign(new Error(itemsRes.error.message), { status: 500 });
  if (empresasRes.error) throw Object.assign(new Error(empresasRes.error.message), { status: 500 });
  if (clientesRes.error) throw Object.assign(new Error(clientesRes.error.message), { status: 500 });

  const itemIds = [...new Set((itemsRes.data || []).map((i) => i.item_id).filter(Boolean))];
  let itemsById = {};
  if (itemIds.length) {
    const { data: itemsData, error: itemsErr } = await supabase
      .from('items')
      .select('id, nombre')
      .in('id', itemIds);
    if (itemsErr) throw Object.assign(new Error(itemsErr.message), { status: 500 });
    itemsById = Object.fromEntries((itemsData || []).map((i) => [i.id, i]));
  }

  const empresasById = Object.fromEntries(
    (empresasRes.data || []).map((e) => [e.id, mapEmpresa(e)])
  );
  const clientesById = Object.fromEntries((clientesRes.data || []).map((c) => [c.id, c]));
  const itemsByRemito = {};
  for (const row of itemsRes.data || []) {
    if (!itemsByRemito[row.remito_id]) itemsByRemito[row.remito_id] = [];
    itemsByRemito[row.remito_id].push({
      ...row,
      nombre: itemsById[row.item_id]?.nombre,
    });
  }

  return remitos.map((row) =>
    mapRemitoDetalle(
      row,
      empresasById[row.empresa_emisora_id] || null,
      row.cliente_id ? clientesById[row.cliente_id] : null,
      itemsByRemito[row.id] || []
    )
  );
}

export async function recibirTransferencia(remitoId, payload, recibidoPor) {
  if (demo.isDemoMode()) return demo.demoRecibirTransferencia(remitoId, payload, recibidoPor);

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('recibir_transferencia', {
    p_remito_id: remitoId,
    p_recibido_por: recibidoPor || 'Sistema',
    p_ubicacion_destino: payload?.ubicacionDestino || null,
  });

  if (error) {
    const status = error.message?.includes('ya fue') ? 409 : 400;
    throw Object.assign(new Error(error.message), { status });
  }
  return data;
}

export async function getRemitoById(id) {
  if (demo.isDemoMode()) return demo.demoGetRemitoById(id);

  const supabase = getSupabase();

  const { data: remito, error } = await supabase.from('remitos').select('*').eq('id', id).maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!remito) throw Object.assign(new Error('Remito no encontrado'), { status: 404 });

  const [empresaRes, clienteRes, itemsRes] = await Promise.all([
    supabase.from('empresas_emisoras').select('*').eq('id', remito.empresa_emisora_id).maybeSingle(),
    remito.cliente_id
      ? supabase.from('clientes').select('*').eq('id', remito.cliente_id).maybeSingle()
      : { data: null, error: null },
    supabase.from('remito_items').select('*').eq('remito_id', id),
  ]);

  if (empresaRes.error) throw Object.assign(new Error(empresaRes.error.message), { status: 500 });
  if (clienteRes.error) throw Object.assign(new Error(clienteRes.error.message), { status: 500 });
  if (itemsRes.error) throw Object.assign(new Error(itemsRes.error.message), { status: 500 });

  const itemIds = [...new Set((itemsRes.data || []).map((i) => i.item_id).filter(Boolean))];
  let itemsById = {};
  if (itemIds.length) {
    const { data: itemsData, error: itemsErr } = await supabase
      .from('items')
      .select('id, nombre')
      .in('id', itemIds);
    if (itemsErr) throw Object.assign(new Error(itemsErr.message), { status: 500 });
    itemsById = Object.fromEntries((itemsData || []).map((i) => [i.id, i]));
  }

  const items = (itemsRes.data || []).map((row) => ({
    ...row,
    nombre: itemsById[row.item_id]?.nombre,
  }));

  return mapRemitoDetalle(
    remito,
    empresaRes.data ? mapEmpresa(empresaRes.data) : null,
    clienteRes.data,
    items
  );
}
