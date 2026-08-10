import { getSupabase } from '../db/supabase.js';
import { resolveUbicacion } from './ubicacionService.js';
import {
  getHerramientasUbicacion,
  getSedeForAlmacen,
  normalizeAlmacen,
  normalizeSede,
} from './ubicacionUtils.js';
import { getHerramientasAlmacenSede } from './sedeScope.js';
import { listInventario } from './inventarioService.js';
import { listMovimientos, listPendientes } from './movimientosService.js';
import {
  HERRAMIENTAS_ARMARIO,
  HERRAMIENTAS_CONTENEDOR,
  HERRAMIENTAS_ESTANTE,
} from './sedeBootstrap.js';

/** Info del depósito Pañol de la sede activa. */
export function getPanolInfo(sedeSession) {
  const sede = normalizeSede(sedeSession);
  const ubicacion = getHerramientasUbicacion(sede);
  const almacen = ubicacion?.almacen || getHerramientasAlmacenSede(sede);
  if (!almacen) {
    throw Object.assign(
      new Error(`No hay depósito Herramientas / Pañol configurado para ${sede}`),
      { status: 404 }
    );
  }
  return {
    sede,
    almacen,
    armario: ubicacion?.armario || HERRAMIENTAS_ARMARIO,
    estante: ubicacion?.estante || HERRAMIENTAS_ESTANTE,
    contenedor: ubicacion?.contenedor || HERRAMIENTAS_CONTENEDOR,
    nombre: `Herramientas / Pañol — ${sede}`,
  };
}

export async function listPanolStock(sedeSession, extraFilters = {}) {
  const panol = getPanolInfo(sedeSession);
  const data = await listInventario({
    ...extraFilters,
    sede: panol.sede,
    almacen: panol.almacen,
  });
  return { ...data, panol };
}

export async function listPanolPendientes(sedeSession) {
  const panol = getPanolInfo(sedeSession);
  const movimientos = await listPendientes({
    sede: panol.sede,
    almacen: panol.almacen,
  });
  return { movimientos, total: movimientos.length, panol };
}

export async function listPanolHistorial(sedeSession, filters = {}) {
  const panol = getPanolInfo(sedeSession);
  const movimientos = await listMovimientos({
    ...filters,
    sede: panol.sede,
    almacen: panol.almacen,
  });
  return { movimientos, total: movimientos.length, panol };
}

/**
 * Mueve cantidad desde un stock (depósito general u otro ALM de la sede) al Pañol.
 * No es egreso/préstamo: queda disponible en el depósito Herramientas.
 */
export async function moverAlPanol({ stockId, cantidad, sedeSession, usuario }) {
  if (!stockId) {
    throw Object.assign(new Error('stockId requerido'), { status: 400 });
  }
  const qty = Number(cantidad);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw Object.assign(new Error('Cantidad inválida'), { status: 400 });
  }

  const panol = getPanolInfo(sedeSession);
  const supabase = getSupabase();

  const { data: stockRow, error: es } = await supabase
    .from('stock')
    .select('id, item_id, contenedor_id, cantidad')
    .eq('id', stockId)
    .maybeSingle();
  if (es) throw Object.assign(new Error(es.message), { status: 500 });
  if (!stockRow) throw Object.assign(new Error('Registro de stock no encontrado'), { status: 404 });

  const available = Number(stockRow.cantidad) || 0;
  if (qty > available) {
    throw Object.assign(new Error(`Stock insuficiente (disponible: ${available})`), { status: 409 });
  }

  const { data: origenCont, error: ec } = await supabase
    .from('contenedores')
    .select('id, codigo, almacen, sede')
    .eq('id', stockRow.contenedor_id)
    .maybeSingle();
  if (ec) throw Object.assign(new Error(ec.message), { status: 500 });
  if (!origenCont) {
    throw Object.assign(new Error('Ubicación de origen no encontrada'), { status: 404 });
  }

  const origenAlm = normalizeAlmacen(origenCont.almacen);
  if (origenAlm === panol.almacen) {
    throw Object.assign(new Error('El ítem ya está en el Pañol'), { status: 400 });
  }

  const sedeOrigen = String(origenCont.sede || getSedeForAlmacen(origenAlm) || '').toUpperCase();
  if (sedeOrigen && sedeOrigen !== panol.sede) {
    throw Object.assign(
      new Error(`El stock pertenece a otra sede (${sedeOrigen}). Cambiá de sucursal.`),
      { status: 403 }
    );
  }

  const dest = await resolveUbicacion({
    sede: panol.sede,
    almacen: panol.almacen,
    armario: panol.armario,
    estante: panol.estante,
    contenedor: panol.contenedor,
  });

  const itemId = stockRow.item_id;
  const destId = dest.id;

  if (qty === available) {
    const { data: destStock, error: edq } = await supabase
      .from('stock')
      .select('id, cantidad')
      .eq('item_id', itemId)
      .eq('contenedor_id', destId)
      .maybeSingle();
    if (edq) throw Object.assign(new Error(edq.message), { status: 500 });

    if (destStock) {
      const { error: em } = await supabase
        .from('stock')
        .update({
          cantidad: Number(destStock.cantidad) + qty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', destStock.id);
      if (em) throw Object.assign(new Error(em.message), { status: 500 });
      const { error: ed } = await supabase.from('stock').delete().eq('id', stockId);
      if (ed) throw Object.assign(new Error(ed.message), { status: 500 });
    } else {
      const { error: em } = await supabase
        .from('stock')
        .update({
          contenedor_id: destId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', stockId);
      if (em) throw Object.assign(new Error(em.message), { status: 500 });
    }
  } else {
    const { error: eu } = await supabase
      .from('stock')
      .update({
        cantidad: available - qty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', stockId);
    if (eu) throw Object.assign(new Error(eu.message), { status: 500 });

    const { data: destStock, error: edq } = await supabase
      .from('stock')
      .select('id, cantidad')
      .eq('item_id', itemId)
      .eq('contenedor_id', destId)
      .maybeSingle();
    if (edq) throw Object.assign(new Error(edq.message), { status: 500 });

    if (destStock) {
      const { error: em } = await supabase
        .from('stock')
        .update({
          cantidad: Number(destStock.cantidad) + qty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', destStock.id);
      if (em) throw Object.assign(new Error(em.message), { status: 500 });
    } else {
      const { error: ei } = await supabase.from('stock').insert({
        item_id: itemId,
        contenedor_id: destId,
        cantidad: qty,
      });
      if (ei) throw Object.assign(new Error(ei.message), { status: 500 });
    }
  }

  return {
    ok: true,
    itemId,
    cantidad: qty,
    origen: { almacen: origenAlm, contenedorCodigo: origenCont.codigo },
    destino: {
      almacen: panol.almacen,
      armario: panol.armario,
      estante: panol.estante,
      contenedor: panol.contenedor,
      codigo: dest.codigo,
    },
    usuario: usuario || null,
    panol,
  };
}
