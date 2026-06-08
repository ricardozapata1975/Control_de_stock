import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';

export async function listMovimientos(filters = {}) {
  if (demo.isDemoMode()) return demo.demoListMovimientos(filters);

  const supabase = getSupabase();
  if (filters.pendiente === true || filters.pendiente === 'true') {
    return listPendientes();
  }

  let query = supabase
    .from('movimientos')
    .select(`*, items (nombre, marca, modelo, tipo), contenedores (codigo, ubicacion, estante, contenedor)`)
    .eq('tipo', 'egreso')
    .order('fecha', { ascending: false });

  if (filters.usuario || filters.persona) {
    query = query.ilike('usuario', `%${filters.usuario || filters.persona}%`);
  }
  if (filters.desde) query = query.gte('fecha', filters.desde);
  if (filters.hasta) query = query.lte('fecha', `${filters.hasta}T23:59:59`);

  const { data, error } = await query;
  if (error) throw Object.assign(new Error(error.message), { status: 500 });

  const egresoRows = data || [];
  const egresoIds = egresoRows.map((r) => r.id);
  let ingresoByEgreso = {};

  if (egresoIds.length) {
    const { data: ingresos, error: errIng } = await supabase
      .from('movimientos')
      .select('egreso_movimiento_id, fecha, usuario')
      .eq('tipo', 'ingreso')
      .in('egreso_movimiento_id', egresoIds);
    if (errIng) throw Object.assign(new Error(errIng.message), { status: 500 });
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
    .select(`*, items (nombre, marca, modelo, tipo), contenedores (codigo, ubicacion, estante, contenedor)`)
    .in('id', ids.map((r) => r.id));

  if (err2) throw Object.assign(new Error(err2.message), { status: 500 });
  return (data || []).map((m) => mapMovimiento(m, null));
}

function mapMovimiento(row, ingresoRow = null) {
  const item = row.items || {};
  const cont = row.contenedores || {};
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
    ubicacion: cont.ubicacion,
    estante: cont.estante,
    contenedor: cont.contenedor,
    contenedorCodigo: cont.codigo,
    pendiente: !ingresoRow,
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
