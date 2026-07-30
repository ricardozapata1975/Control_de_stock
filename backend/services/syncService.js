import { registrarEgreso, registrarEgresoContenedor, registrarIngreso, registrarIngresoLote } from './movimientosService.js';
import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';

export async function processBatchSync(actions) {
  if (!Array.isArray(actions)) {
    throw Object.assign(new Error('Se esperaba un array'), { status: 400 });
  }

  const sorted = [...actions].sort(
    (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
  );

  const results = [];

  for (const raw of sorted) {
    const tipo = raw.tipo || raw.type;
    const data = raw.data || raw.payload || {};
    const clientId = raw.clientId || raw.id;
    const timestamp = raw.timestamp || new Date().toISOString();

    if (!clientId || !tipo) {
      results.push({ clientId, ok: false, error: 'clientId y tipo requeridos', kept: true });
      continue;
    }

    if (!demo.isDemoMode() && tipo !== 'egreso_contenedor') {
      const supabase = getSupabase();
      const { data: existing } = await supabase
        .from('movimientos')
        .select('id')
        .eq('offline_id', clientId)
        .maybeSingle();
      if (existing) {
        results.push({ clientId, ok: true, duplicate: true, movimientoId: existing.id });
        continue;
      }
    }

    try {
      const payload = normalizePayload(tipo, data);
      if (tipo === 'egreso') {
        const result = await registrarEgreso({ ...payload, offlineId: clientId });
        results.push({ clientId, ok: true, tipo, result, timestamp });
      } else if (tipo === 'egreso_contenedor') {
        const result = await registrarEgresoContenedor({ ...payload, offlineId: clientId });
        results.push({ clientId, ok: true, tipo, result, timestamp });
      } else if (tipo === 'ingreso_lote') {
        const result = await registrarIngresoLote({ ...payload, offlineId: clientId });
        results.push({ clientId, ok: true, tipo, result, timestamp });
      } else if (tipo === 'ingreso') {
        const result = await registrarIngreso({ ...payload, offlineId: clientId });
        results.push({ clientId, ok: true, tipo, result, timestamp });
      } else {
        results.push({ clientId, ok: false, error: `Tipo desconocido: ${tipo}`, kept: true });
      }
    } catch (err) {
      results.push({
        clientId,
        ok: false,
        error: err.message,
        status: err.status || 500,
        kept: true,
        timestamp,
      });
    }
  }

  return {
    results,
    synced: results.filter((r) => r.ok && !r.duplicate).length,
    failed: results.filter((r) => !r.ok).length,
    skipped: results.filter((r) => r.duplicate).length,
    total: results.length,
  };
}

/** Compatibilidad: API antigua (inventarioId) y nueva (itemId + contenedorId) */
function normalizePayload(tipo, data) {
  if (tipo === 'egreso') {
    return {
      itemId: data.itemId,
      contenedorId: data.contenedorId,
      cantidad: data.cantidad,
      usuario: data.usuario || data.nombrePersonal,
    };
  }
  if (tipo === 'egreso_contenedor') {
    return {
      contenedorId: data.contenedorId,
      codigo: data.codigo,
      usuario: data.usuario || data.nombrePersonal,
      egresoLoteId: data.egresoLoteId,
    };
  }
  if (tipo === 'ingreso_lote') {
    return {
      egresoLoteId: data.egresoLoteId || data.loteId,
      usuario: data.usuario || data.nombrePersonal,
    };
  }
  return {
    movimientoId: data.movimientoId || data.egresoMovimientoId,
    egresoMovimientoId: data.egresoMovimientoId || data.movimientoId,
    usuario: data.usuario || data.nombrePersonal,
  };
}
