import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';
import { almacenesCodigosDeSede } from './sedeScope.js';

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
          .select('id, codigo, ubicacion, estante, contenedor, almacen, sede')
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
  if (row.estado === 'en_transito') return 'en_transito';
  if (row.estado === 'transferido') return 'transferido';
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
  const sede = String(filters.sede || '').trim().toUpperCase();
  const almacenFilter = String(filters.almacen || '').trim().toUpperCase();
  let scopedRows = sede
    ? egresoRows.filter((row) => {
        const cont = row.contenedores;
        if (!cont) return false;
        if (cont.sede) return String(cont.sede).toUpperCase() === sede;
        // fallback: almacén de la sede
        const alms = almacenesCodigosDeSede(sede);
        return alms.includes(String(cont.almacen || '').toUpperCase());
      })
    : egresoRows;
  if (almacenFilter) {
    scopedRows = scopedRows.filter(
      (row) => String(row.contenedores?.almacen || '').toUpperCase() === almacenFilter
    );
  }

  const egresoIds = scopedRows.map((r) => r.id);
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

  return scopedRows.map((row) => mapMovimiento(row, ingresoByEgreso[row.id]));
}

export async function listPendientes(filters = {}) {
  if (demo.isDemoMode()) return demo.demoListMovimientos({ pendiente: true, ...filters });

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
  const sede = String(filters.sede || '').trim().toUpperCase();
  const almacenFilter = String(filters.almacen || '').trim().toUpperCase();
  let scoped = sede
    ? rows.filter((row) => {
        const cont = row.contenedores;
        if (!cont) return false;
        if (cont.sede) return String(cont.sede).toUpperCase() === sede;
        const alms = almacenesCodigosDeSede(sede);
        return alms.includes(String(cont.almacen || '').toUpperCase());
      })
    : rows;
  if (almacenFilter) {
    scoped = scoped.filter(
      (row) => String(row.contenedores?.almacen || '').toUpperCase() === almacenFilter
    );
  }
  return scoped.map((m) => mapMovimiento(m, null));
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
    almacen: cont.almacen || null,
    sede: cont.sede || null,
    pendiente: estado === 'pendiente',
    estado: row.estado || null,
    motivo: row.motivo,
    remitoId: row.remito_id,
    egresoLoteId: row.egreso_lote_id || null,
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

/**
 * Retira todo el stock de un contenedor físico (kit): un egreso por cada ítem con cantidad > 0.
 * Agrupa los movimientos en un egreso_lote para remito interno + QR de devolución.
 */
export async function registrarEgresoContenedor(payload) {
  if (demo.isDemoMode()) return demo.demoRegistrarEgresoContenedor(payload);

  const { contenedorId, codigo, usuario, offlineId, egresoLoteId } = payload;
  const user = String(usuario || '').trim();
  if (!user) {
    throw Object.assign(new Error('Usuario requerido'), { status: 400 });
  }

  let resolvedId = contenedorId;
  const supabase = getSupabase();

  if (!resolvedId && codigo) {
    const { getByCodigo } = await import('./contenedorService.js');
    const data = await getByCodigo(codigo);
    const id = data?.contenedor?.id;
    if (!id || String(id).startsWith('alm-') || String(id).startsWith('arm-')) {
      throw Object.assign(
        new Error(
          'Escaneá o elegí un contenedor concreto (ej. C01). No se puede retirar un almacén o armario completo.'
        ),
        { status: 400 }
      );
    }
    resolvedId = id;
  }

  if (!resolvedId) {
    throw Object.assign(new Error('contenedorId o codigo requerido'), { status: 400 });
  }
  if (String(resolvedId).startsWith('alm-') || String(resolvedId).startsWith('arm-')) {
    throw Object.assign(
      new Error('Solo se puede retirar un contenedor físico completo, no un almacén o armario'),
      { status: 400 }
    );
  }

  const { data: cont, error: ec } = await supabase
    .from('contenedores')
    .select('id, codigo, contenedor, armario, estante, almacen')
    .eq('id', resolvedId)
    .maybeSingle();
  if (ec) throw Object.assign(new Error(ec.message), { status: 500 });
  if (!cont) throw Object.assign(new Error('Contenedor no encontrado'), { status: 404 });

  const { data: stockRows, error: es } = await supabase
    .from('stock')
    .select('id, item_id, contenedor_id, cantidad, items(id, nombre, marca, modelo, tipo)')
    .eq('contenedor_id', resolvedId)
    .gt('cantidad', 0);
  if (es) {
    const { data: plain, error: e2 } = await supabase
      .from('stock')
      .select('id, item_id, contenedor_id, cantidad')
      .eq('contenedor_id', resolvedId)
      .gt('cantidad', 0);
    if (e2) throw Object.assign(new Error(e2.message), { status: 500 });
    return egresarStockRows(plain || [], resolvedId, cont, user, offlineId, egresoLoteId);
  }

  return egresarStockRows(stockRows || [], resolvedId, cont, user, offlineId, egresoLoteId);
}

function newLoteId(preferred) {
  const raw = String(preferred || '').trim();
  if (raw && /^[0-9a-f-]{36}$/i.test(raw)) return raw.toLowerCase();
  return crypto.randomUUID();
}

async function egresarStockRows(stockRows, contenedorId, cont, usuario, offlineId, preferredLoteId) {
  const rows = (stockRows || []).filter((s) => Number(s.cantidad) > 0);
  if (!rows.length) {
    throw Object.assign(new Error('El contenedor no tiene stock para retirar'), { status: 400 });
  }

  const supabase = getSupabase();
  const loteId = newLoteId(preferredLoteId);
  const fecha = new Date().toISOString();

  const { error: elErr } = await supabase.from('egreso_lotes').insert({
    id: loteId,
    contenedor_id: contenedorId,
    contenedor_codigo: cont?.codigo || null,
    usuario,
    created_at: fecha,
  });
  if (elErr) {
    if (/egreso_lotes|schema cache|does not exist/i.test(elErr.message || '')) {
      throw Object.assign(
        new Error('Ejecutá supabase/patch-egreso-lote.sql en Supabase para habilitar retiro con remito/QR'),
        { status: 503 }
      );
    }
    throw Object.assign(new Error(elErr.message), { status: 500 });
  }

  const egresos = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const qty = Number(row.cantidad);
    const lineOfflineId = offlineId ? `${offlineId}:${row.item_id}` : null;
    const result = await registrarEgreso({
      itemId: row.item_id,
      contenedorId,
      cantidad: qty,
      usuario,
      offlineId: lineOfflineId,
    });
    const movId = result?.movimiento_id || result?.movimientoId || null;
    if (movId) {
      const { error: upErr } = await supabase
        .from('movimientos')
        .update({ egreso_lote_id: loteId })
        .eq('id', movId);
      if (upErr && !/egreso_lote|column/i.test(upErr.message || '')) {
        console.warn('[egreso_lote] no se pudo asociar movimiento', upErr.message);
      }
    }
    egresos.push({
      movimientoId: movId,
      itemId: row.item_id,
      nombre: row.items?.nombre || null,
      marca: row.items?.marca || null,
      modelo: row.items?.modelo || null,
      tipo: row.items?.tipo || null,
      cantidad: qty,
      result,
    });
  }

  return {
    ok: true,
    egresoLoteId: loteId,
    contenedorId,
    contenedorCodigo: cont?.codigo || null,
    usuario,
    fecha,
    totalItems: egresos.length,
    totalUnidades: egresos.reduce((s, e) => s + e.cantidad, 0),
    egresos,
    qrPayload: `inv://d/${loteId}`,
  };
}

export async function getEgresoLote(loteId) {
  if (demo.isDemoMode()) return demo.demoGetEgresoLote(loteId);

  const id = String(loteId || '').trim();
  if (!id) throw Object.assign(new Error('loteId requerido'), { status: 400 });

  const supabase = getSupabase();
  const { data: lote, error: e1 } = await supabase
    .from('egreso_lotes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (e1) {
    if (/egreso_lotes|schema cache|does not exist/i.test(e1.message || '')) {
      throw Object.assign(
        new Error('Ejecutá supabase/patch-egreso-lote.sql en Supabase'),
        { status: 503 }
      );
    }
    throw Object.assign(new Error(e1.message), { status: 500 });
  }
  if (!lote) throw Object.assign(new Error('Lote de egreso no encontrado'), { status: 404 });

  const { data: movs, error: e2 } = await supabase
    .from('movimientos')
    .select('*')
    .eq('tipo', 'egreso')
    .eq('egreso_lote_id', id)
    .order('fecha', { ascending: true });
  if (e2) throw Object.assign(new Error(e2.message), { status: 500 });

  const enriched = await enrichMovimientosRows(supabase, movs || []);
  const egresoIds = enriched.map((r) => r.id);
  let ingresoByEgreso = {};
  if (egresoIds.length) {
    const { data: ingresos, error: e3 } = await supabase
      .from('movimientos')
      .select('egreso_movimiento_id, fecha, usuario')
      .eq('tipo', 'ingreso')
      .in('egreso_movimiento_id', egresoIds);
    if (e3) throw Object.assign(new Error(e3.message), { status: 500 });
    ingresoByEgreso = Object.fromEntries(
      (ingresos || []).map((i) => [i.egreso_movimiento_id, i])
    );
  }

  const lineas = enriched.map((row) => {
    const mapped = mapMovimiento(row, ingresoByEgreso[row.id]);
    return {
      ...mapped,
      pendiente: !ingresoByEgreso[row.id] && mapped.estadoHistorial === 'pendiente_devolucion',
    };
  });
  const pendientes = lineas.filter((l) => l.pendiente);

  return {
    id: lote.id,
    contenedorId: lote.contenedor_id,
    contenedorCodigo: lote.contenedor_codigo,
    usuario: lote.usuario,
    fecha: lote.created_at,
    totalItems: lineas.length,
    totalUnidades: lineas.reduce((s, l) => s + Number(l.cantidad || 0), 0),
    pendientesCount: pendientes.length,
    completoDevuelto: lineas.length > 0 && pendientes.length === 0,
    lineas,
    pendientes,
    qrPayload: `inv://d/${lote.id}`,
  };
}

export async function registrarIngresoLote(payload) {
  if (demo.isDemoMode()) return demo.demoRegistrarIngresoLote(payload);

  const { egresoLoteId, usuario, offlineId } = payload;
  const lote = await getEgresoLote(egresoLoteId);
  if (!lote.pendientes?.length) {
    throw Object.assign(new Error('Este lote ya fue devuelto o no tiene egresos pendientes'), {
      status: 409,
    });
  }

  const resultados = [];
  for (const line of lote.pendientes) {
    const lineOfflineId = offlineId ? `${offlineId}:${line.id}` : null;
    const result = await registrarIngreso({
      movimientoId: line.id,
      usuario: usuario || 'Sistema',
      offlineId: lineOfflineId,
    });
    resultados.push({ movimientoId: line.id, itemId: line.itemId, nombre: line.nombreHerramienta, result });
  }

  return {
    ok: true,
    egresoLoteId: lote.id,
    totalDevueltos: resultados.length,
    resultados,
  };
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
