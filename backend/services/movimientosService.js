import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';

/** PostgREST embed falla si movimientos no tiene FK a items/contenedores (producción legacy). */
async function enrichMovimientosRows(supabase, rows) {
  if (!rows?.length) return rows;

  const itemIds = [...new Set(rows.map((r) => r.item_id).filter(Boolean))];
  const contIds = [...new Set(rows.map((r) => r.contenedor_id).filter(Boolean))];

  const [itemsRes, contRes] = await Promise.all([
    itemIds.length
      ? supabase.from('items').select('id, nombre, marca, modelo, tipo').in('id', itemIds)
      : { data: [], error: null },
    contIds.length
      ? supabase
          .from('contenedores')
          .select('id, codigo, ubicacion, estante, contenedor')
          .in('id', contIds)
      : { data: [], error: null },
  ]);

  if (itemsRes.error) throw Object.assign(new Error(itemsRes.error.message), { status: 500 });
  if (contRes.error) throw Object.assign(new Error(contRes.error.message), { status: 500 });

  const itemsById = Object.fromEntries((itemsRes.data || []).map((i) => [i.id, i]));
  const contById = Object.fromEntries((contRes.data || []).map((c) => [c.id, c]));

  return rows.map((row) => ({
    ...row,
    items: itemsById[row.item_id] || null,
    contenedores: contById[row.contenedor_id] || null,
  }));
}

export function computeEstadoMovimiento(row, ingresoRow, itemTipo) {
  if (row.remito_id || row.estado === 'vendido') return 'vendido';
  if (ingresoRow) return 'completado';
  if (row.estado === 'consumido' || String(itemTipo || '').toLowerCase() === 'consumible') {
    return 'consumido';
  }
  return 'pendiente';
}

function toEstadoHistorial(estado) {
  if (estado === 'pendiente') return 'pendiente_devolucion';
  return estado;
}

export async function listMovimientos(filters = {}) {
  if (demo.isDemoMode()) return demo.demoListMovimientos(filters);

  const supabase = getSupabase();
  if (filters.pendiente === true || filters.pendiente === 'true') {
    return listPendientes();
  }

  let query = supabase
    .from('movimientos')
    .select('*')
    .eq('tipo', 'egreso')
    .order('fecha', { ascending: false });

  if (filters.usuario || filters.persona) {
    query = query.ilike('usuario', `%${filters.usuario || filters.persona}%`);
  }
  if (filters.desde) query = query.gte('fecha', filters.desde);
  if (filters.hasta) query = query.lte('fecha', `${filters.hasta}T23:59:59`);

  const { data, error } = await query;
  if (error) throw Object.assign(new Error(error.message), { status: 500 });

  const egresoRows = await enrichMovimientosRows(supabase, data || []);
  const egresoIds = egresoRows.map((r) => r.id);
  let ingresoByEgreso = {};

  if (egresoIds.length) {
    const { data: ingresos, error: errIng } = await supabase
      .from('movimientos')
      .select('egreso_movimiento_id, fecha, usuario')
      .eq('tipo', 'ingreso')
      .in('egreso_movimiento_id', egresoIds);
    if (errIng) throw Object.assign(new Error(errIng.error?.message || errIng.message), { status: 500 });
    ingresoByEgreso = Object.fromEntries(
      (ingresos || []).map((i) => [i.egreso_movimiento_id, i])
    );
  }

  return egresoRows.map((row) => mapMovimiento(row, ingresoByEgreso[row.id]));
}

export async function listPendientes() {
  if (demo.isDemoMode()) return demo.demoListMovimientos({ pendiente: true });

  const supabase = getSupabase();
  const { data: ids, error } = await supabase.from('v_egresos_pendientes').select('id');
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!ids?.length) return [];

  const { data, error: err2 } = await supabase
    .from('movimientos')
    .select('*')
    .in('id', ids.map((r) => r.id));

  if (err2) throw Object.assign(new Error(err2.message), { status: 500 });
  const rows = await enrichMovimientosRows(supabase, data || []);
  return rows.map((m) => mapMovimiento(m, null));
}

function mapMovimiento(row, ingresoRow = null) {
  const item = row.items || {};
  const cont = row.contenedores || {};
  const estado = computeEstadoMovimiento(row, ingresoRow, item.tipo);
  return {
    id: row.id,
    itemId: row.item_id,
    contenedorId: row.contenedor_id,
    tipo: row.tipo,
    cantidad: row.cantidad,
    usuario: row.usuario,
    nombrePersonal: row.usuario,
    fecha: row.fecha,
    fechaEgreso: row.fecha?.slice?.(0, 10),
    fechaIngreso: ingresoRow?.fecha?.slice?.(0, 10) || null,
    nombreHerramienta: item.nombre,
    itemTipo: item.tipo,
    ubicacion: cont.ubicacion,
    estante: cont.estante,
    contenedor: cont.contenedor,
    contenedorCodigo: cont.codigo,
    pendiente: estado === 'pendiente',
    estado: row.estado || null,
    motivo: row.motivo,
    remitoId: row.remito_id,
    estadoHistorial: toEstadoHistorial(estado),
  };
}

export async function registrarEgreso(payload) {
  if (demo.isDemoMode()) return demo.demoRegistrarEgreso(payload);

  const { itemId, contenedorId, cantidad, usuario, offlineId } = payload;
  if (!itemId || !contenedorId || !usuario?.trim()) {
    throw Object.assign(new Error('Faltan itemId, contenedorId o usuario'), { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('registrar_egreso', {
    p_item_id: itemId,
    p_contenedor_id: contenedorId,
    p_cantidad: Number(cantidad),
    p_usuario: usuario,
    p_offline_id: offlineId || null,
  });

  if (error) {
    const status = error.message?.includes('insuficiente') ? 409 : 400;
    throw Object.assign(new Error(error.message), { status });
  }
  return data;
}

export async function registrarIngreso(payload) {
  if (demo.isDemoMode()) return demo.demoRegistrarIngreso(payload);

  const { movimientoId, egresoMovimientoId, usuario, offlineId } = payload;
  const egresoId = egresoMovimientoId || movimientoId;
  if (!egresoId) throw Object.assign(new Error('movimientoId requerido'), { status: 400 });

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('registrar_ingreso', {
    p_egreso_movimiento_id: egresoId,
    p_usuario: usuario || 'Sistema',
    p_offline_id: offlineId || null,
  });

  if (error) {
    const status = error.message?.includes('devuelto') ? 409 : 400;
    throw Object.assign(new Error(error.message), { status });
  }
  return data;
}
