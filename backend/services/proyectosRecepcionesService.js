import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';
import * as pdemo from './proyectosDemo.js';
import { createProveedor } from './proveedoresService.js';
import { resolveUbicacion } from './ubicacionService.js';
import { getAduanaUbicacion, mapUbicacionFields } from './ubicacionUtils.js';

function isDemo() {
  return demo.isDemoMode();
}

function schemaMissing(err) {
  return /proyecto_recepcion|proveedor_cuit|cantidad_confirmada|es_extra|operador_ingreso|schema cache|does not exist/i.test(
    err?.message || ''
  );
}

function throwSchemaHint(err) {
  throw Object.assign(
    new Error(
      'Ejecutá supabase/patch-proyectos-fase2.sql y supabase/patch-proyectos-recepcion-flujo.sql en Supabase para habilitar recepciones'
    ),
    { status: 503, cause: err?.message }
  );
}

const PRIORIDAD_RANK = { critica: 0, alta: 1, media: 2, baja: 3 };

function mapRecepcion(row) {
  return {
    id: row.id,
    sede: row.sede,
    tipo: row.tipo,
    proveedor: row.proveedor,
    proveedorId: row.proveedor_id || null,
    proveedorCuit: row.proveedor_cuit || null,
    proveedorDomicilio: row.proveedor_domicilio || null,
    proveedorLocalidad: row.proveedor_localidad || null,
    proveedorIva: row.proveedor_iva || null,
    documento: row.documento,
    fecha: row.fecha,
    operador: row.operador,
    operadorIngreso: row.operador_ingreso || null,
    estado: row.estado,
    notas: row.notas,
    cierreNotas: row.cierre_notas || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lineasCount: row.lineas_count,
    sugerenciasPendientes: row.sugerencias_pendientes,
  };
}

function mapLinea(row) {
  return {
    id: row.id,
    recepcionId: row.recepcion_id,
    itemId: row.item_id,
    codigoArticulo: row.codigo_articulo,
    descripcion: row.descripcion,
    cantidad: Number(row.cantidad || 0),
    cantidadConfirmada: Number(row.cantidad_confirmada || 0),
    cantidadAsignada: Number(row.cantidad_asignada || 0),
    unidad: row.unidad || null,
    motivo: row.motivo || null,
    esExtra: Boolean(row.es_extra),
    stockId: row.stock_id || null,
    notasIngreso: row.notas_ingreso || null,
    contenedorId: row.contenedor_id,
    validado: row.validado,
    error: row.error,
  };
}

function mapSugerencia(row, extras = {}) {
  return {
    id: row.id,
    recepcionId: row.recepcion_id,
    lineaId: row.linea_id,
    faltanteId: row.faltante_id,
    proyectoId: row.proyecto_id,
    tableroId: row.tablero_id,
    materialId: row.material_id,
    itemId: row.item_id,
    cantidadSugerida: Number(row.cantidad_sugerida || 0),
    estado: row.estado,
    proyectoNombre: extras.proyectoNombre || null,
    proyectoPrioridad: extras.proyectoPrioridad || null,
    codigoArticulo: extras.codigoArticulo || null,
    fechaLimite: extras.fechaLimite || null,
    createdAt: row.created_at,
  };
}

async function resolveItemsByCodigo(lineas) {
  const supabase = getSupabase();
  const codes = [
    ...new Set(lineas.map((l) => String(l.codigo || '').trim().toUpperCase()).filter(Boolean)),
  ];
  const itemIds = [...new Set(lineas.map((l) => l.itemId || l.item_id).filter(Boolean))];
  const itemsByCodigo = new Map();
  const itemsById = new Map();

  if (itemIds.length) {
    const { data } = await supabase
      .from('items')
      .select('id, nombre, codigo_fabricante')
      .in('id', itemIds);
    for (const it of data || []) {
      itemsById.set(it.id, it);
      if (it.codigo_fabricante) {
        itemsByCodigo.set(String(it.codigo_fabricante).trim().toUpperCase(), it);
      }
    }
  }

  for (const code of codes) {
    if (itemsByCodigo.has(code)) continue;
    let found = null;
    for (const tryFn of [
      () =>
        supabase.from('items').select('id, nombre, codigo_fabricante').eq('codigo_fabricante', code).limit(1),
      () => supabase.from('items').select('id, nombre, codigo_fabricante').ilike('nombre', code).limit(1),
    ]) {
      try {
        const { data } = await tryFn();
        if (data?.[0]) {
          found = data[0];
          break;
        }
      } catch {
        /* ignore */
      }
    }
    if (found) {
      itemsByCodigo.set(code, found);
      itemsById.set(found.id, found);
    }
  }
  return { itemsByCodigo, itemsById };
}

async function resolveItemFromScan(supabase, { scan, codigo, itemId }) {
  if (itemId) {
    const { data } = await supabase
      .from('items')
      .select('id, nombre, codigo_fabricante')
      .eq('id', itemId)
      .maybeSingle();
    if (data) return data;
  }
  const raw = String(scan || codigo || '').trim();
  if (!raw) return null;
  if (/^[0-9a-f-]{36}$/i.test(raw)) {
    const { data } = await supabase
      .from('items')
      .select('id, nombre, codigo_fabricante')
      .eq('id', raw)
      .maybeSingle();
    if (data) return data;
  }
  const code = raw.toUpperCase();
  const { data: byCode } = await supabase
    .from('items')
    .select('id, nombre, codigo_fabricante')
    .eq('codigo_fabricante', code)
    .limit(1);
  if (byCode?.[0]) return byCode[0];
  const { data: byName } = await supabase
    .from('items')
    .select('id, nombre, codigo_fabricante')
    .ilike('nombre', code)
    .limit(1);
  return byName?.[0] || null;
}

async function enrichSugerencias(supabase, rows) {
  const proyectoIds = [...new Set(rows.map((r) => r.proyecto_id).filter(Boolean))];
  const faltanteIds = [...new Set(rows.map((r) => r.faltante_id).filter(Boolean))];
  const proyectos = {};
  const faltantes = {};
  if (proyectoIds.length) {
    const { data } = await supabase.from('proyectos').select('id, nombre, prioridad').in('id', proyectoIds);
    for (const p of data || []) proyectos[p.id] = p;
  }
  if (faltanteIds.length) {
    const { data } = await supabase
      .from('proyecto_faltantes')
      .select('id, codigo_articulo, fecha_limite, prioridad')
      .in('id', faltanteIds);
    for (const f of data || []) faltantes[f.id] = f;
  }
  return rows.map((r) =>
    mapSugerencia(r, {
      proyectoNombre: proyectos[r.proyecto_id]?.nombre,
      proyectoPrioridad: proyectos[r.proyecto_id]?.prioridad || faltantes[r.faltante_id]?.prioridad,
      codigoArticulo: faltantes[r.faltante_id]?.codigo_articulo,
      fechaLimite: faltantes[r.faltante_id]?.fecha_limite,
    })
  );
}

async function refreshRecepcionEstado(supabase, recepcionId) {
  const { data: rec } = await supabase
    .from('proyecto_recepciones')
    .select('estado')
    .eq('id', recepcionId)
    .maybeSingle();
  if (rec && ['pendiente_ingreso', 'ingreso_en_curso', 'pendiente_cierre', 'en_aduana'].includes(rec.estado)) {
    return;
  }

  const { data: sugs } = await supabase
    .from('proyecto_recepcion_sugerencias')
    .select('estado')
    .eq('recepcion_id', recepcionId);
  const list = sugs || [];
  const pend = list.filter((s) => s.estado === 'pendiente').length;
  const acept = list.filter((s) => s.estado === 'aceptada').length;
  let estado = 'pendiente_asignacion';
  if (!list.length || pend === 0) estado = 'cerrada';
  else if (acept > 0) estado = 'parcial';
  await supabase
    .from('proyecto_recepciones')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', recepcionId);
}

async function ensureProveedorId(payload) {
  let proveedorId = payload.proveedorId || payload.proveedor_id || null;
  const proveedorNombre =
    typeof payload.proveedor === 'string'
      ? payload.proveedor.trim()
      : String(payload.proveedor?.nombre || '').trim();

  if (proveedorId) return { proveedorId, proveedorNombre: proveedorNombre || null };

  if (!proveedorNombre) return { proveedorId: null, proveedorNombre: null };

  try {
    const created = await createProveedor({
      nombre: proveedorNombre,
      cuit: payload.proveedorCuit || payload.proveedor_cuit || payload.proveedor?.cuit,
      domicilio: payload.proveedorDomicilio || payload.proveedor_domicilio || payload.proveedor?.domicilio,
      localidad: payload.proveedorLocalidad || payload.proveedor_localidad || payload.proveedor?.localidad,
      iva: payload.proveedorIva || payload.proveedor_iva || payload.proveedor?.iva,
    });
    return { proveedorId: created.id, proveedorNombre: created.nombre || proveedorNombre };
  } catch (err) {
    if (err?.status === 503) {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('proveedores')
        .insert({
          nombre: proveedorNombre,
          razon_social: proveedorNombre,
          cuit: payload.proveedorCuit || payload.proveedor_cuit || null,
          domicilio: payload.proveedorDomicilio || payload.proveedor_domicilio || null,
          localidad: payload.proveedorLocalidad || payload.proveedor_localidad || null,
          iva: payload.proveedorIva || payload.proveedor_iva || null,
          activo: true,
        })
        .select('id, nombre')
        .single();
      if (error) throw Object.assign(new Error(error.message), { status: 500 });
      return { proveedorId: data.id, proveedorNombre: data.nombre };
    }
    throw err;
  }
}

async function loadRecepcionOrThrow(supabase, id) {
  const { data: row, error } = await supabase
    .from('proyecto_recepciones')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  if (!row) throw Object.assign(new Error('Recepción no encontrada'), { status: 404 });
  return row;
}

async function upsertStockEnContenedor(supabase, { itemId, contenedorId, cantidad }) {
  const qty = Math.round(Number(cantidad || 0));
  if (!Number.isFinite(qty) || qty <= 0) {
    throw Object.assign(new Error('Cantidad de stock inválida'), { status: 400 });
  }

  const { data: existing } = await supabase
    .from('stock')
    .select('id, cantidad')
    .eq('item_id', itemId)
    .eq('contenedor_id', contenedorId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('stock')
      .update({
        cantidad: Number(existing.cantidad) + qty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    return data;
  }

  const { data, error } = await supabase
    .from('stock')
    .insert({ item_id: itemId, contenedor_id: contenedorId, cantidad: qty })
    .select('*')
    .single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}

async function listFaltantesFifo(supabase, { itemId, sede, cantidadDisponible } = {}) {
  if (!itemId) return [];

  const { data: faltantesRaw, error } = await supabase
    .from('proyecto_faltantes')
    .select('*')
    .eq('item_id', itemId)
    .in('estado', ['pendiente', 'parcial']);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });

  let faltantes = (faltantesRaw || []).filter(
    (f) => Number(f.cantidad) - Number(f.cantidad_cubierta || 0) > 0
  );

  const proyectoIds = [...new Set(faltantes.map((f) => f.proyecto_id).filter(Boolean))];
  let byId = {};
  if (proyectoIds.length) {
    const { data: proyectos } = await supabase
      .from('proyectos')
      .select('id, sede, nombre, prioridad')
      .in('id', proyectoIds);
    byId = Object.fromEntries((proyectos || []).map((p) => [p.id, p]));
  }

  if (sede) {
    faltantes = faltantes.filter((f) => {
      const p = byId[f.proyecto_id];
      return !p || p.sede === sede;
    });
  }

  faltantes.sort((a, b) => {
    const pa = byId[a.proyecto_id]?.prioridad || a.prioridad;
    const pb = byId[b.proyecto_id]?.prioridad || b.prioridad;
    const ra = PRIORIDAD_RANK[pa] ?? 9;
    const rb = PRIORIDAD_RANK[pb] ?? 9;
    if (ra !== rb) return ra - rb;
    return String(a.fecha_limite || '9999').localeCompare(String(b.fecha_limite || '9999'));
  });

  let restante = Number.isFinite(Number(cantidadDisponible))
    ? Number(cantidadDisponible)
    : Number.POSITIVE_INFINITY;

  const out = [];
  for (const f of faltantes) {
    if (restante <= 0) break;
    const pend = Number(f.cantidad) - Number(f.cantidad_cubierta || 0);
    const qty = Number.isFinite(restante) ? Math.min(restante, pend) : pend;
    if (qty <= 0) continue;
    out.push({
      faltanteId: f.id,
      proyectoId: f.proyecto_id,
      tableroId: f.tablero_id,
      materialId: f.material_id,
      itemId: f.item_id,
      codigoArticulo: f.codigo_articulo,
      cantidadPendiente: pend,
      cantidadSugerida: qty,
      proyectoNombre: byId[f.proyecto_id]?.nombre || null,
      proyectoPrioridad: byId[f.proyecto_id]?.prioridad || f.prioridad,
      fechaLimite: f.fecha_limite,
      prioridad: f.prioridad,
    });
    if (Number.isFinite(restante)) restante -= qty;
  }
  return out;
}

async function cubrirFaltanteYMaterial(supabase, { faltanteId, materialId, qty }) {
  if (materialId) {
    const { data: mat } = await supabase
      .from('proyecto_materiales')
      .select('*')
      .eq('id', materialId)
      .maybeSingle();
    if (mat) {
      const reservada = Number(mat.cantidad_reservada || 0) + qty;
      const faltante = Math.max(0, Number(mat.cantidad_faltante || 0) - qty);
      await supabase
        .from('proyecto_materiales')
        .update({
          cantidad_reservada: reservada,
          cantidad_faltante: faltante,
          estado: faltante === 0 ? 'completo' : reservada > 0 ? 'parcial' : 'pendiente',
          updated_at: new Date().toISOString(),
        })
        .eq('id', materialId);
    }
  }

  if (faltanteId) {
    const { data: fal } = await supabase
      .from('proyecto_faltantes')
      .select('*')
      .eq('id', faltanteId)
      .maybeSingle();
    if (fal) {
      const cubierta = Number(fal.cantidad_cubierta || 0) + qty;
      const pend = Number(fal.cantidad) - cubierta;
      await supabase
        .from('proyecto_faltantes')
        .update({
          cantidad_cubierta: cubierta,
          estado: pend <= 0 ? 'cubierto' : 'parcial',
          updated_at: new Date().toISOString(),
        })
        .eq('id', faltanteId);
    }
  }
}

function lineaTieneDiscrepancia(ln) {
  if (ln.es_extra || ln.motivo === 'extra') return true;
  if (ln.motivo === 'faltante_fisico' || ln.motivo === 'diferencia') return true;
  const conf = Number(ln.cantidad_confirmada || 0);
  const cant = Number(ln.cantidad || 0);
  if (conf !== cant) return true;
  return false;
}

export async function listRecepciones({ sede, estado } = {}) {
  if (isDemo()) return pdemo.demoListRecepciones({ sede, estado });

  const supabase = getSupabase();
  let query = supabase.from('proyecto_recepciones').select('*').order('created_at', { ascending: false });
  if (sede) query = query.eq('sede', sede);
  if (estado) query = query.eq('estado', estado);
  const { data, error } = await query;
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }

  const ids = (data || []).map((r) => r.id);
  const lineasCount = {};
  const sugsCount = {};
  if (ids.length) {
    const { data: lines } = await supabase
      .from('proyecto_recepcion_lineas')
      .select('recepcion_id')
      .in('recepcion_id', ids);
    for (const l of lines || []) lineasCount[l.recepcion_id] = (lineasCount[l.recepcion_id] || 0) + 1;
    const { data: sugs } = await supabase
      .from('proyecto_recepcion_sugerencias')
      .select('recepcion_id')
      .in('recepcion_id', ids)
      .eq('estado', 'pendiente');
    for (const s of sugs || []) sugsCount[s.recepcion_id] = (sugsCount[s.recepcion_id] || 0) + 1;
  }

  return (data || []).map((r) =>
    mapRecepcion({
      ...r,
      lineas_count: lineasCount[r.id] || 0,
      sugerencias_pendientes: sugsCount[r.id] || 0,
    })
  );
}

export async function getRecepcion(id) {
  if (isDemo()) return pdemo.demoGetRecepcion(id);

  const supabase = getSupabase();
  const row = await loadRecepcionOrThrow(supabase, id);

  const [{ data: lineas }, { data: sugs }] = await Promise.all([
    supabase.from('proyecto_recepcion_lineas').select('*').eq('recepcion_id', id),
    supabase.from('proyecto_recepcion_sugerencias').select('*').eq('recepcion_id', id).order('created_at'),
  ]);

  return {
    recepcion: mapRecepcion(row),
    lineas: (lineas || []).map(mapLinea),
    sugerencias: await enrichSugerencias(supabase, sugs || []),
  };
}

export async function crearRecepcion(payload) {
  const { sede, tipo, documento, fecha, operador, notas, lineas } = payload;
  if (!sede) throw Object.assign(new Error('Sede requerida'), { status: 400 });
  if (!Array.isArray(lineas) || !lineas.length) {
    throw Object.assign(new Error('Se requieren líneas de recepción'), { status: 400 });
  }

  if (isDemo()) {
    const inv = await demo.demoListInventario({});
    const itemsByCodigo = new Map();
    const itemsById = new Map();
    for (const row of inv.items || []) {
      const item = { id: row.itemId || row.item_id, nombre: row.nombre };
      if (!item.id) continue;
      itemsById.set(item.id, item);
      for (const key of [row.codigoFabricante, row.sku, row.codigo, row.nombre]) {
        if (key) itemsByCodigo.set(String(key).trim().toUpperCase(), item);
      }
    }
    return pdemo.demoCrearRecepcion({ ...payload, itemsByCodigo, itemsById });
  }

  const supabase = getSupabase();
  const { proveedorId, proveedorNombre } = await ensureProveedorId(payload);
  const { itemsByCodigo, itemsById } = await resolveItemsByCodigo(lineas);

  const { data: recepcion, error } = await supabase
    .from('proyecto_recepciones')
    .insert({
      sede,
      tipo: tipo || 'manual',
      proveedor: proveedorNombre || payload.proveedor || null,
      proveedor_id: proveedorId,
      proveedor_cuit: payload.proveedorCuit || payload.proveedor_cuit || null,
      proveedor_domicilio: payload.proveedorDomicilio || payload.proveedor_domicilio || null,
      proveedor_localidad: payload.proveedorLocalidad || payload.proveedor_localidad || null,
      proveedor_iva: payload.proveedorIva || payload.proveedor_iva || null,
      documento: documento || null,
      fecha: fecha || new Date().toISOString().slice(0, 10),
      operador: operador || null,
      estado: 'pendiente_ingreso',
      notas: notas || null,
    })
    .select('*')
    .single();
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }

  const mappedLineas = [];

  for (const line of lineas) {
    const codigo = String(line.codigo || line.codigoArticulo || '').trim();
    const cantidad = Number(line.cantidad || 0);
    const itemId = line.itemId || line.item_id || null;
    const item =
      (itemId && itemsById.get(itemId)) ||
      (codigo ? itemsByCodigo.get(codigo.toUpperCase()) : null) ||
      null;
    const validado = Boolean(item) && cantidad > 0;
    const { data: ln, error: el } = await supabase
      .from('proyecto_recepcion_lineas')
      .insert({
        recepcion_id: recepcion.id,
        item_id: item?.id || itemId || null,
        codigo_articulo: codigo || item?.codigo_fabricante || null,
        descripcion: item?.nombre || line.descripcion || null,
        cantidad,
        cantidad_confirmada: 0,
        unidad: line.unidad || null,
        contenedor_id: line.contenedorId || line.contenedor_id || null,
        validado,
        es_extra: false,
        error:
          (!codigo && !itemId) || cantidad <= 0
            ? 'Código/ítem o cantidad inválidos'
            : !item
              ? 'Artículo no encontrado'
              : null,
      })
      .select('*')
      .single();
    if (el) {
      if (schemaMissing(el)) throwSchemaHint(el);
      throw Object.assign(new Error(el.message), { status: 500 });
    }
    mappedLineas.push(ln);
  }

  await supabase.from('proyecto_movimientos').insert({
    tipo: 'recepcion',
    cantidad: mappedLineas.reduce((s, l) => s + Number(l.cantidad || 0), 0),
    estado_material: 'Pendiente ingreso',
    usuario: operador,
    notas: `Remito ${documento || recepcion.id} — pendiente de ingreso físico`,
    meta: { recepcion_id: recepcion.id, flujo: 'v2' },
  });

  return {
    recepcion: mapRecepcion(recepcion),
    lineas: mappedLineas.map(mapLinea),
    sugerencias: [],
  };
}

export async function confirmarScan(recepcionId, payload = {}) {
  if (isDemo()) return pdemo.demoConfirmarScan(recepcionId, payload);

  const supabase = getSupabase();
  const recepcion = await loadRecepcionOrThrow(supabase, recepcionId);
  if (!['pendiente_ingreso', 'ingreso_en_curso'].includes(recepcion.estado)) {
    throw Object.assign(new Error('La recepción no admite ingreso físico en este estado'), {
      status: 409,
    });
  }

  const cantidad = Math.max(1, Number(payload.cantidad || 1));
  const item = await resolveItemFromScan(supabase, payload);
  if (!item) {
    throw Object.assign(new Error('Ítem no reconocido. Usá agregar-extra si es material no listado.'), {
      status: 404,
    });
  }

  const { data: lineas, error: el } = await supabase
    .from('proyecto_recepcion_lineas')
    .select('*')
    .eq('recepcion_id', recepcionId);
  if (el) throw Object.assign(new Error(el.message), { status: 500 });

  const candidatos = (lineas || []).filter((ln) => {
    if (ln.es_extra) return false;
    if (ln.motivo === 'faltante_fisico') return false;
    if (ln.item_id !== item.id) return false;
    return Number(ln.cantidad_confirmada || 0) < Number(ln.cantidad || 0);
  });

  if (!candidatos.length) {
    const yaListado = (lineas || []).some((ln) => ln.item_id === item.id && !ln.es_extra);
    throw Object.assign(
      new Error(
        yaListado
          ? 'Cantidad del remito ya confirmada para este ítem. Marcá diferencia o agregá extra.'
          : 'Ítem no figura en el remito. Usá agregar-extra.'
      ),
      { status: 409, code: yaListado ? 'completo' : 'no_listado' }
    );
  }

  const linea = candidatos[0];
  const pendiente = Number(linea.cantidad) - Number(linea.cantidad_confirmada || 0);
  const aplicar = Math.min(cantidad, pendiente);
  const nuevaConf = Number(linea.cantidad_confirmada || 0) + aplicar;

  const { data: updated, error: eu } = await supabase
    .from('proyecto_recepcion_lineas')
    .update({
      cantidad_confirmada: nuevaConf,
      item_id: linea.item_id || item.id,
      codigo_articulo: linea.codigo_articulo || item.codigo_fabricante,
      descripcion: linea.descripcion || item.nombre,
      validado: true,
      error: null,
    })
    .eq('id', linea.id)
    .select('*')
    .single();
  if (eu) {
    if (schemaMissing(eu)) throwSchemaHint(eu);
    throw Object.assign(new Error(eu.message), { status: 500 });
  }

  if (recepcion.estado === 'pendiente_ingreso') {
    await supabase
      .from('proyecto_recepciones')
      .update({ estado: 'ingreso_en_curso', updated_at: new Date().toISOString() })
      .eq('id', recepcionId);
    recepcion.estado = 'ingreso_en_curso';
  }

  return {
    ok: true,
    aplicado: aplicar,
    linea: mapLinea(updated),
    recepcion: mapRecepcion(recepcion),
  };
}

export async function marcarLinea(recepcionId, payload = {}) {
  if (isDemo()) return pdemo.demoMarcarLinea(recepcionId, payload);

  const { lineaId, motivo, cantidadConfirmada, notas } = payload;
  if (!lineaId) throw Object.assign(new Error('lineaId requerido'), { status: 400 });
  if (!['faltante_fisico', 'diferencia'].includes(motivo)) {
    throw Object.assign(new Error("motivo debe ser 'faltante_fisico' o 'diferencia'"), { status: 400 });
  }

  const supabase = getSupabase();
  const recepcion = await loadRecepcionOrThrow(supabase, recepcionId);
  if (!['pendiente_ingreso', 'ingreso_en_curso'].includes(recepcion.estado)) {
    throw Object.assign(new Error('La recepción no admite marcas de ingreso en este estado'), {
      status: 409,
    });
  }

  const { data: linea, error } = await supabase
    .from('proyecto_recepcion_lineas')
    .select('*')
    .eq('id', lineaId)
    .eq('recepcion_id', recepcionId)
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!linea) throw Object.assign(new Error('Línea no encontrada'), { status: 404 });

  const patch = {
    motivo,
    notas_ingreso: notas != null ? notas : linea.notas_ingreso,
  };
  if (motivo === 'faltante_fisico') {
    patch.cantidad_confirmada = 0;
  } else if (cantidadConfirmada != null) {
    const conf = Number(cantidadConfirmada);
    if (Number.isNaN(conf) || conf < 0) {
      throw Object.assign(new Error('cantidadConfirmada inválida'), { status: 400 });
    }
    patch.cantidad_confirmada = conf;
  }

  const { data: updated, error: eu } = await supabase
    .from('proyecto_recepcion_lineas')
    .update(patch)
    .eq('id', lineaId)
    .select('*')
    .single();
  if (eu) {
    if (schemaMissing(eu)) throwSchemaHint(eu);
    throw Object.assign(new Error(eu.message), { status: 500 });
  }

  if (recepcion.estado === 'pendiente_ingreso') {
    await supabase
      .from('proyecto_recepciones')
      .update({ estado: 'ingreso_en_curso', updated_at: new Date().toISOString() })
      .eq('id', recepcionId);
    recepcion.estado = 'ingreso_en_curso';
  }

  return { linea: mapLinea(updated), recepcion: mapRecepcion(recepcion) };
}

export async function agregarExtra(recepcionId, payload = {}) {
  if (isDemo()) return pdemo.demoAgregarExtra(recepcionId, payload);

  const cantidad = Number(payload.cantidad || 0);
  if (cantidad <= 0) throw Object.assign(new Error('cantidad requerida'), { status: 400 });

  const supabase = getSupabase();
  const recepcion = await loadRecepcionOrThrow(supabase, recepcionId);
  if (!['pendiente_ingreso', 'ingreso_en_curso'].includes(recepcion.estado)) {
    throw Object.assign(new Error('La recepción no admite extras en este estado'), { status: 409 });
  }

  const item = await resolveItemFromScan(supabase, payload);
  if (!item && !(payload.descripcion || payload.codigo)) {
    throw Object.assign(new Error('Indicá itemId, codigo o descripcion para el extra'), { status: 400 });
  }

  const { data: ln, error } = await supabase
    .from('proyecto_recepcion_lineas')
    .insert({
      recepcion_id: recepcionId,
      item_id: item?.id || payload.itemId || null,
      codigo_articulo:
        String(payload.codigo || item?.codigo_fabricante || '').trim() || null,
      descripcion: item?.nombre || payload.descripcion || 'Extra no listado',
      cantidad,
      cantidad_confirmada: cantidad,
      unidad: payload.unidad || null,
      motivo: 'extra',
      es_extra: true,
      validado: Boolean(item),
      error: item ? null : 'Artículo no encontrado en catálogo',
    })
    .select('*')
    .single();
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }

  if (recepcion.estado === 'pendiente_ingreso') {
    await supabase
      .from('proyecto_recepciones')
      .update({ estado: 'ingreso_en_curso', updated_at: new Date().toISOString() })
      .eq('id', recepcionId);
    recepcion.estado = 'ingreso_en_curso';
  }

  return { linea: mapLinea(ln), recepcion: mapRecepcion(recepcion) };
}

export async function enviarAduana(recepcionId, payload = {}) {
  if (isDemo()) return pdemo.demoEnviarAduana(recepcionId, payload);

  const supabase = getSupabase();
  const recepcion = await loadRecepcionOrThrow(supabase, recepcionId);
  if (!['pendiente_ingreso', 'ingreso_en_curso', 'pendiente_cierre'].includes(recepcion.estado)) {
    throw Object.assign(new Error('La recepción no puede enviarse a aduana en este estado'), {
      status: 409,
    });
  }

  const aduana = getAduanaUbicacion(recepcion.sede);
  if (!aduana?.almacen || !aduana?.armario || !aduana?.estante) {
    throw Object.assign(
      new Error(`La sede ${recepcion.sede} no tiene aduana configurada. Configurala en Locaciones.`),
      { status: 400 }
    );
  }

  const cont = await resolveUbicacion({
    sede: recepcion.sede,
    almacen: aduana.almacen,
    armario: aduana.armario,
    estante: aduana.estante,
    contenedor: aduana.contenedor || null,
  });

  const { data: lineas, error: el } = await supabase
    .from('proyecto_recepcion_lineas')
    .select('*')
    .eq('recepcion_id', recepcionId);
  if (el) throw Object.assign(new Error(el.message), { status: 500 });

  const stockCreados = [];
  for (const ln of lineas || []) {
    const conf = Number(ln.cantidad_confirmada || 0);
    if (conf <= 0) continue;
    if (!ln.item_id) {
      throw Object.assign(
        new Error(`Línea ${ln.codigo_articulo || ln.id} confirmada sin ítem de catálogo`),
        { status: 400 }
      );
    }
    if (ln.stock_id) continue;

    const stock = await upsertStockEnContenedor(supabase, {
      itemId: ln.item_id,
      contenedorId: cont.id,
      cantidad: conf,
    });

    const { error: eu } = await supabase
      .from('proyecto_recepcion_lineas')
      .update({ stock_id: stock.id, contenedor_id: cont.id })
      .eq('id', ln.id);
    if (eu) throw Object.assign(new Error(eu.message), { status: 500 });

    await supabase.from('movimientos').insert({
      item_id: ln.item_id,
      contenedor_id: cont.id,
      tipo: 'ingreso',
      cantidad: Math.round(conf),
      usuario: payload.operador || recepcion.operador || 'Sistema',
    });

    stockCreados.push({ lineaId: ln.id, stockId: stock.id, cantidad: conf });
    ln.stock_id = stock.id;
  }

  const tieneDisc = (lineas || []).some(lineaTieneDiscrepancia);
  const cierrePendiente = Boolean(payload.cierrePendiente) || tieneDisc;
  const nuevoEstado = cierrePendiente ? 'pendiente_cierre' : 'en_aduana';

  const { data: updatedRec, error: er } = await supabase
    .from('proyecto_recepciones')
    .update({
      estado: nuevoEstado,
      operador_ingreso: payload.operador || recepcion.operador_ingreso || recepcion.operador,
      cierre_notas: payload.notas != null ? payload.notas : recepcion.cierre_notas,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recepcionId)
    .select('*')
    .single();
  if (er) {
    if (schemaMissing(er)) throwSchemaHint(er);
    throw Object.assign(new Error(er.message), { status: 500 });
  }

  await supabase.from('proyecto_movimientos').insert({
    tipo: 'recepcion_aduana',
    cantidad: stockCreados.reduce((s, x) => s + x.cantidad, 0),
    estado_material: 'En aduana',
    usuario: payload.operador || recepcion.operador,
    notas: `Ingreso a aduana — recepción ${recepcion.documento || recepcionId}`,
    meta: {
      recepcion_id: recepcionId,
      stock: stockCreados,
      estado: nuevoEstado,
      contenedor_id: cont.id,
    },
  });

  const { data: lineasFinal } = await supabase
    .from('proyecto_recepcion_lineas')
    .select('*')
    .eq('recepcion_id', recepcionId);

  return {
    recepcion: mapRecepcion(updatedRec),
    lineas: (lineasFinal || []).map(mapLinea),
    stockCreados,
    aduana: mapUbicacionFields(cont),
  };
}

export async function listAduanaStock({ sede } = {}) {
  if (isDemo()) return pdemo.demoListAduanaStock({ sede });
  if (!sede) throw Object.assign(new Error('sede requerida'), { status: 400 });

  const supabase = getSupabase();
  const aduana = getAduanaUbicacion(sede);
  if (!aduana?.almacen) {
    throw Object.assign(new Error(`Sede ${sede} sin aduana configurada`), { status: 400 });
  }

  const { data: contenedores, error: ec } = await supabase
    .from('contenedores')
    .select('*')
    .eq('sede', sede)
    .eq('almacen', aduana.almacen);
  if (ec) throw Object.assign(new Error(ec.message), { status: 500 });

  const contIds = (contenedores || []).map((c) => c.id);
  if (!contIds.length) return { sede, aduana, items: [] };

  const contById = Object.fromEntries((contenedores || []).map((c) => [c.id, c]));

  const { data: stocks, error: es } = await supabase
    .from('stock')
    .select('*')
    .in('contenedor_id', contIds)
    .gt('cantidad', 0);
  if (es) throw Object.assign(new Error(es.message), { status: 500 });

  const itemIds = [...new Set((stocks || []).map((s) => s.item_id).filter(Boolean))];
  const stockIds = (stocks || []).map((s) => s.id);
  let itemsById = {};
  if (itemIds.length) {
    const { data: items } = await supabase
      .from('items')
      .select('id, nombre, codigo_fabricante')
      .in('id', itemIds);
    itemsById = Object.fromEntries((items || []).map((i) => [i.id, i]));
  }

  let lineasByStock = {};
  if (stockIds.length) {
    const { data: lineas } = await supabase
      .from('proyecto_recepcion_lineas')
      .select('id, stock_id, recepcion_id, codigo_articulo, descripcion, cantidad_confirmada, es_extra, motivo')
      .in('stock_id', stockIds);
    for (const ln of lineas || []) {
      if (!lineasByStock[ln.stock_id]) lineasByStock[ln.stock_id] = [];
      lineasByStock[ln.stock_id].push(ln);
    }
  }

  const recepcionIds = [
    ...new Set(Object.values(lineasByStock).flat().map((l) => l.recepcion_id).filter(Boolean)),
  ];
  let recepcionesById = {};
  if (recepcionIds.length) {
    const { data: recs } = await supabase
      .from('proyecto_recepciones')
      .select('id, documento, proveedor, estado, fecha, sede')
      .in('id', recepcionIds);
    recepcionesById = Object.fromEntries((recs || []).map((r) => [r.id, r]));
  }

  const items = (stocks || []).map((s) => {
    const item = itemsById[s.item_id] || {};
    const cont = contById[s.contenedor_id];
    const lineas = lineasByStock[s.id] || [];
    const recMeta = lineas.map((ln) => ({
      lineaId: ln.id,
      recepcionId: ln.recepcion_id,
      documento: recepcionesById[ln.recepcion_id]?.documento || null,
      proveedor: recepcionesById[ln.recepcion_id]?.proveedor || null,
      estadoRecepcion: recepcionesById[ln.recepcion_id]?.estado || null,
      esExtra: Boolean(ln.es_extra),
      motivo: ln.motivo,
    }));
    return {
      stockId: s.id,
      itemId: s.item_id,
      cantidad: Number(s.cantidad || 0),
      nombre: item.nombre || null,
      codigoFabricante: item.codigo_fabricante || null,
      unidad: null,
      contenedorId: s.contenedor_id,
      ubicacion: cont ? mapUbicacionFields(cont) : null,
      recepciones: recMeta,
    };
  });

  return { sede, aduana, items };
}

export async function opcionesAsignacion({ itemId, sede } = {}) {
  if (isDemo()) return pdemo.demoOpcionesAsignacion({ itemId, sede });
  if (!itemId) throw Object.assign(new Error('itemId requerido'), { status: 400 });

  const supabase = getSupabase();
  const opciones = await listFaltantesFifo(supabase, { itemId, sede });
  return { opciones };
}

export async function ubicarDesdeAduana(payload = {}) {
  if (isDemo()) return pdemo.demoUbicarDesdeAduana(payload);

  const { stockId, sede, almacen, armario, estante, contenedor, usuario } = payload;
  if (!stockId) throw Object.assign(new Error('stockId requerido'), { status: 400 });
  if (!almacen || !armario || !estante) {
    throw Object.assign(new Error('almacen, armario y estante son requeridos'), { status: 400 });
  }

  const supabase = getSupabase();
  const { data: stock, error } = await supabase
    .from('stock')
    .select('*')
    .eq('id', stockId)
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!stock) throw Object.assign(new Error('Stock no encontrado'), { status: 404 });
  if (Number(stock.cantidad) <= 0) {
    throw Object.assign(new Error('Stock sin cantidad'), { status: 409 });
  }

  const dest = await resolveUbicacion({
    sede: sede || undefined,
    almacen,
    armario,
    estante,
    contenedor: contenedor || null,
  });

  if (dest.id === stock.contenedor_id) {
    return {
      ok: true,
      stockId: stock.id,
      mensaje: 'El stock ya está en esa ubicación',
      ubicacion: mapUbicacionFields(dest),
    };
  }

  const qty = Number(stock.cantidad);
  const nuevo = await upsertStockEnContenedor(supabase, {
    itemId: stock.item_id,
    contenedorId: dest.id,
    cantidad: qty,
  });

  const { error: ed } = await supabase.from('stock').delete().eq('id', stockId);
  if (ed) throw Object.assign(new Error(ed.message), { status: 500 });

  await supabase
    .from('proyecto_recepcion_lineas')
    .update({ stock_id: nuevo.id, contenedor_id: dest.id })
    .eq('stock_id', stockId);

  await supabase
    .from('proyecto_reservas')
    .update({ stock_id: nuevo.id, contenedor_id: dest.id, updated_at: new Date().toISOString() })
    .eq('stock_id', stockId)
    .eq('estado', 'activa');

  await supabase.from('movimientos').insert([
    {
      item_id: stock.item_id,
      contenedor_id: stock.contenedor_id,
      tipo: 'egreso',
      cantidad: Math.round(qty),
      usuario: usuario || 'Sistema',
    },
    {
      item_id: stock.item_id,
      contenedor_id: dest.id,
      tipo: 'ingreso',
      cantidad: Math.round(qty),
      usuario: usuario || 'Sistema',
    },
  ]);

  await supabase.from('proyecto_movimientos').insert({
    tipo: 'ubicacion_aduana',
    item_id: stock.item_id,
    cantidad: qty,
    estado_material: 'Disponible',
    usuario: usuario || null,
    notas: 'Ubicación desde aduana a depósito principal',
    meta: {
      stock_origen: stockId,
      stock_destino: nuevo.id,
      desde_contenedor: stock.contenedor_id,
      hacia_contenedor: dest.id,
    },
  });

  return {
    ok: true,
    stockId: nuevo.id,
    cantidad: qty,
    ubicacion: mapUbicacionFields(dest),
  };
}

export async function asignarDesdeAduana(payload = {}) {
  if (isDemo()) return pdemo.demoAsignarDesdeAduana(payload);

  const { stockId, faltanteId, proyectoId, autoFifo, usuario } = payload;
  if (!stockId) throw Object.assign(new Error('stockId requerido'), { status: 400 });

  const supabase = getSupabase();
  const { data: stock, error } = await supabase
    .from('stock')
    .select('*')
    .eq('id', stockId)
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!stock) throw Object.assign(new Error('Stock no encontrado'), { status: 404 });

  const disponible = Number(stock.cantidad || 0);
  if (disponible <= 0) throw Object.assign(new Error('Stock sin cantidad'), { status: 409 });

  let qty = payload.cantidad != null ? Number(payload.cantidad) : disponible;
  if (!Number.isFinite(qty) || qty <= 0) {
    throw Object.assign(new Error('cantidad inválida'), { status: 400 });
  }
  if (qty > disponible) {
    throw Object.assign(new Error('Cantidad supera el stock en aduana'), { status: 409 });
  }

  let faltante = null;
  if (faltanteId) {
    const { data } = await supabase
      .from('proyecto_faltantes')
      .select('*')
      .eq('id', faltanteId)
      .maybeSingle();
    faltante = data;
  } else if (autoFifo || (!faltanteId && !proyectoId)) {
    const { data: cont } = await supabase
      .from('contenedores')
      .select('sede')
      .eq('id', stock.contenedor_id)
      .maybeSingle();
    const opciones = await listFaltantesFifo(supabase, {
      itemId: stock.item_id,
      sede: cont?.sede || payload.sede,
      cantidadDisponible: qty,
    });
    if (!opciones.length) {
      throw Object.assign(new Error('No hay faltantes pendientes para este ítem'), { status: 404 });
    }
    const { data } = await supabase
      .from('proyecto_faltantes')
      .select('*')
      .eq('id', opciones[0].faltanteId)
      .maybeSingle();
    faltante = data;
    qty = Math.min(qty, opciones[0].cantidadSugerida);
  }

  let proyecto_id = proyectoId || faltante?.proyecto_id;
  if (!proyecto_id) {
    throw Object.assign(new Error('Indicá faltanteId, proyectoId o autoFifo'), { status: 400 });
  }

  if (faltante && faltante.item_id && faltante.item_id !== stock.item_id) {
    throw Object.assign(new Error('El faltante no corresponde al ítem del stock'), { status: 400 });
  }

  if (faltante) {
    const pend = Number(faltante.cantidad) - Number(faltante.cantidad_cubierta || 0);
    qty = Math.min(qty, pend);
    if (qty <= 0) {
      throw Object.assign(new Error('El faltante ya está cubierto'), { status: 409 });
    }
  }

  const { data: proy } = await supabase
    .from('proyectos')
    .select('id, sede, nombre')
    .eq('id', proyecto_id)
    .maybeSingle();
  if (!proy) throw Object.assign(new Error('Proyecto no encontrado'), { status: 404 });

  const { data: reserva, error: er } = await supabase
    .from('proyecto_reservas')
    .insert({
      proyecto_id,
      tablero_id: faltante?.tablero_id || null,
      material_id: faltante?.material_id || null,
      item_id: stock.item_id,
      stock_id: stock.id,
      contenedor_id: stock.contenedor_id,
      cantidad: qty,
      estado: 'activa',
      sede: proy.sede,
      notas: `Asignado desde aduana (stock ${stock.id})`,
      created_by: usuario || null,
    })
    .select('*')
    .single();
  if (er) throw Object.assign(new Error(er.message), { status: 500 });

  await cubrirFaltanteYMaterial(supabase, {
    faltanteId: faltante?.id || null,
    materialId: faltante?.material_id || null,
    qty,
  });

  await supabase.from('proyecto_movimientos').insert({
    proyecto_id,
    tablero_id: faltante?.tablero_id || null,
    material_id: faltante?.material_id || null,
    item_id: stock.item_id,
    reserva_id: reserva.id,
    tipo: 'reserva',
    cantidad: qty,
    estado_material: 'Reservado',
    usuario,
    notas: 'Asignación desde aduana (limbo lógico, sin mover físico)',
    meta: { stock_id: stock.id, faltante_id: faltante?.id || null, desde_aduana: true },
  });

  return {
    ok: true,
    reserva: {
      id: reserva.id,
      proyectoId: reserva.proyecto_id,
      tableroId: reserva.tablero_id,
      materialId: reserva.material_id,
      itemId: reserva.item_id,
      stockId: reserva.stock_id,
      contenedorId: reserva.contenedor_id,
      cantidad: Number(reserva.cantidad),
      estado: reserva.estado,
      sede: reserva.sede,
      notas: reserva.notas,
    },
    faltanteId: faltante?.id || null,
    proyectoNombre: proy.nombre,
  };
}

async function createSugerenciasForLinea(supabase, recepcion, linea, sede) {
  let restante = Number(linea.cantidad || 0);
  let fq = supabase
    .from('proyecto_faltantes')
    .select('*')
    .eq('item_id', linea.item_id)
    .in('estado', ['pendiente', 'parcial']);
  const { data: faltantesRaw, error } = await fq;
  if (error) throw Object.assign(new Error(error.message), { status: 500 });

  let faltantes = (faltantesRaw || []).filter(
    (f) => Number(f.cantidad) - Number(f.cantidad_cubierta || 0) > 0
  );

  if (sede && faltantes.length) {
    const { data: proyectos } = await supabase
      .from('proyectos')
      .select('id, sede, nombre, prioridad')
      .in(
        'id',
        faltantes.map((f) => f.proyecto_id)
      );
    const byId = Object.fromEntries((proyectos || []).map((p) => [p.id, p]));
    faltantes = faltantes.filter((f) => {
      const p = byId[f.proyecto_id];
      return !p || p.sede === sede;
    });
    faltantes.sort((a, b) => {
      const pa = byId[a.proyecto_id]?.prioridad || a.prioridad;
      const pb = byId[b.proyecto_id]?.prioridad || b.prioridad;
      const ra = PRIORIDAD_RANK[pa] ?? 9;
      const rb = PRIORIDAD_RANK[pb] ?? 9;
      if (ra !== rb) return ra - rb;
      return String(a.fecha_limite || '9999').localeCompare(String(b.fecha_limite || '9999'));
    });
  } else {
    faltantes.sort((a, b) => (PRIORIDAD_RANK[a.prioridad] ?? 9) - (PRIORIDAD_RANK[b.prioridad] ?? 9));
  }

  const created = [];
  for (const f of faltantes) {
    if (restante <= 0) break;
    const pend = Number(f.cantidad) - Number(f.cantidad_cubierta || 0);
    const qty = Math.min(restante, pend);
    if (qty <= 0) continue;
    const { data: sug, error: es } = await supabase
      .from('proyecto_recepcion_sugerencias')
      .insert({
        recepcion_id: recepcion.id,
        linea_id: linea.id,
        faltante_id: f.id,
        proyecto_id: f.proyecto_id,
        tablero_id: f.tablero_id,
        material_id: f.material_id,
        item_id: f.item_id || linea.item_id,
        cantidad_sugerida: qty,
        estado: 'pendiente',
      })
      .select('*')
      .single();
    if (es) throw Object.assign(new Error(es.message), { status: 500 });
    created.push(sug);
    restante -= qty;

    const { data: proy } = await supabase
      .from('proyectos')
      .select('nombre, prioridad')
      .eq('id', f.proyecto_id)
      .maybeSingle();
    if (proy && (proy.prioridad === 'critica' || proy.prioridad === 'alta')) {
      let tableroNombre = null;
      if (f.tablero_id) {
        const { data: tab } = await supabase
          .from('proyecto_tableros')
          .select('nombre, codigo')
          .eq('id', f.tablero_id)
          .maybeSingle();
        tableroNombre = tab?.nombre || tab?.codigo || null;
      }
      await supabase.from('proyecto_alertas').insert({
        proyecto_id: f.proyecto_id,
        tipo: 'material_recibido',
        severidad: proy.prioridad === 'critica' ? 'critical' : 'warning',
        mensaje: `Material recibido (${linea.codigo_articulo}): se sugieren ${qty} u. para ${proy.nombre}`,
        meta: {
          recepcionId: recepcion.id,
          sugerenciaId: sug.id,
          cantidad: qty,
          codigo: linea.codigo_articulo,
          tableroId: f.tablero_id || null,
          tableroNombre,
        },
      });
    }
  }
  return created;
}

export async function aceptarSugerencia(id, { usuario } = {}) {
  if (isDemo()) return pdemo.demoAceptarSugerencia(id, { usuario });

  const supabase = getSupabase();
  const { data: sug, error } = await supabase
    .from('proyecto_recepcion_sugerencias')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  if (!sug) throw Object.assign(new Error('Sugerencia no encontrada'), { status: 404 });
  if (sug.estado !== 'pendiente') {
    throw Object.assign(new Error('La sugerencia ya fue resuelta'), { status: 409 });
  }

  const qty = Number(sug.cantidad_sugerida);
  const { data: proy } = await supabase.from('proyectos').select('sede').eq('id', sug.proyecto_id).maybeSingle();
  const { data: linea } = await supabase
    .from('proyecto_recepcion_lineas')
    .select('*')
    .eq('id', sug.linea_id)
    .maybeSingle();
  const { data: recepcion } = await supabase
    .from('proyecto_recepciones')
    .select('documento, sede')
    .eq('id', sug.recepcion_id)
    .maybeSingle();

  await supabase.from('proyecto_reservas').insert({
    proyecto_id: sug.proyecto_id,
    tablero_id: sug.tablero_id,
    material_id: sug.material_id,
    item_id: sug.item_id,
    stock_id: linea?.stock_id || null,
    contenedor_id: linea?.contenedor_id || null,
    cantidad: qty,
    estado: 'activa',
    sede: proy?.sede || recepcion?.sede,
    notas: `Asignado desde recepción ${recepcion?.documento || sug.recepcion_id}`,
    created_by: usuario || null,
  });

  await cubrirFaltanteYMaterial(supabase, {
    faltanteId: sug.faltante_id,
    materialId: sug.material_id,
    qty,
  });

  if (linea) {
    await supabase
      .from('proyecto_recepcion_lineas')
      .update({ cantidad_asignada: Number(linea.cantidad_asignada || 0) + qty })
      .eq('id', linea.id);
  }

  const { data: updated, error: eu } = await supabase
    .from('proyecto_recepcion_sugerencias')
    .update({ estado: 'aceptada', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (eu) throw Object.assign(new Error(eu.message), { status: 500 });

  await supabase.from('proyecto_movimientos').insert({
    proyecto_id: sug.proyecto_id,
    tablero_id: sug.tablero_id,
    material_id: sug.material_id,
    item_id: sug.item_id,
    tipo: 'reserva',
    cantidad: qty,
    estado_material: 'Reservado',
    usuario,
    notas: 'Asignación desde recepción',
    meta: { sugerencia_id: sug.id, recepcion_id: sug.recepcion_id },
  });

  await refreshRecepcionEstado(supabase, sug.recepcion_id);
  const [enriched] = await enrichSugerencias(supabase, [updated]);
  return enriched;
}

export async function rechazarSugerencia(id) {
  if (isDemo()) return pdemo.demoRechazarSugerencia(id);

  const supabase = getSupabase();
  const { data: sug, error } = await supabase
    .from('proyecto_recepcion_sugerencias')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  if (!sug) throw Object.assign(new Error('Sugerencia no encontrada'), { status: 404 });
  if (sug.estado !== 'pendiente') {
    throw Object.assign(new Error('La sugerencia ya fue resuelta'), { status: 409 });
  }

  const { data: updated, error: eu } = await supabase
    .from('proyecto_recepcion_sugerencias')
    .update({ estado: 'rechazada', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (eu) throw Object.assign(new Error(eu.message), { status: 500 });
  await refreshRecepcionEstado(supabase, sug.recepcion_id);
  const [enriched] = await enrichSugerencias(supabase, [updated]);
  return enriched;
}

export async function sugerirPorItems({ itemIds, sede, cantidades } = {}) {
  if (isDemo()) {
    const map = new Map(Object.entries(cantidades || {}));
    return pdemo.demoSugerirPorItems({ itemIds, sede, cantidadPorItem: map });
  }

  const supabase = getSupabase();
  const ids = [...new Set((itemIds || []).filter(Boolean))];
  if (!ids.length) return [];

  const out = [];
  for (const itemId of ids) {
    const c = Number(cantidades?.[itemId] || 0);
    const opciones = await listFaltantesFifo(supabase, {
      itemId,
      sede,
      cantidadDisponible: c > 0 ? c : Number.POSITIVE_INFINITY,
    });
    out.push(...opciones);
  }
  return out;
}

export async function countRecepcionesPendientes(sede) {
  if (isDemo()) {
    const list = await pdemo.demoListRecepciones({ sede });
    return list.filter((r) =>
      [
        'pendiente_asignacion',
        'parcial',
        'borrador',
        'pendiente_ingreso',
        'ingreso_en_curso',
        'pendiente_cierre',
        'en_aduana',
      ].includes(r.estado)
    ).length;
  }
  const supabase = getSupabase();
  let q = supabase
    .from('proyecto_recepciones')
    .select('*', { count: 'exact', head: true })
    .in('estado', [
      'pendiente_asignacion',
      'parcial',
      'borrador',
      'pendiente_ingreso',
      'ingreso_en_curso',
      'pendiente_cierre',
      'en_aduana',
    ]);
  if (sede) q = q.eq('sede', sede);
  const { count, error } = await q;
  if (error) {
    if (schemaMissing(error)) return 0;
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  return count || 0;
}
