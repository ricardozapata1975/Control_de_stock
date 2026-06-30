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

function mapRemitoDetalle(row, empresa, cliente, items) {
  return {
    id: row.id,
    numero: row.numero,
    fecha: row.fecha,
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
  });

  if (error) {
    const status =
      error.message?.includes('insuficiente') || error.message?.includes('existe') ? 409 : 400;
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
    supabase.from('clientes').select('*').eq('id', remito.cliente_id).maybeSingle(),
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
