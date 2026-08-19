import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';
import * as pdemo from './proyectosDemo.js';

function isDemo() {
  return demo.isDemoMode();
}

function schemaMissing(err) {
  return /proyecto_recepcion|schema cache|does not exist/i.test(err?.message || '');
}

function throwSchemaHint(err) {
  throw Object.assign(
    new Error(
      'Ejecutá supabase/patch-proyectos-fase2.sql en Supabase para habilitar recepciones'
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
    documento: row.documento,
    fecha: row.fecha,
    operador: row.operador,
    estado: row.estado,
    notas: row.notas,
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
    cantidadAsignada: Number(row.cantidad_asignada || 0),
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
  const codes = [...new Set(lineas.map((l) => String(l.codigo || '').trim().toUpperCase()).filter(Boolean))];
  const itemsByCodigo = new Map();
  for (const code of codes) {
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
    if (found) itemsByCodigo.set(code, found);
  }
  return itemsByCodigo;
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
  const { sede, tipo, proveedor, documento, fecha, operador, notas, lineas } = payload;
  if (!sede) throw Object.assign(new Error('Sede requerida'), { status: 400 });
  if (!Array.isArray(lineas) || !lineas.length) {
    throw Object.assign(new Error('Se requieren líneas de recepción'), { status: 400 });
  }

  if (isDemo()) {
    const inv = await demo.demoListInventario({});
    const itemsByCodigo = new Map();
    for (const row of inv.items || []) {
      const item = { id: row.itemId || row.item_id, nombre: row.nombre };
      if (!item.id) continue;
      for (const key of [row.codigoFabricante, row.sku, row.codigo, row.nombre]) {
        if (key) itemsByCodigo.set(String(key).trim().toUpperCase(), item);
      }
    }
    return pdemo.demoCrearRecepcion({ ...payload, itemsByCodigo });
  }

  const supabase = getSupabase();
  const itemsByCodigo = await resolveItemsByCodigo(lineas);

  const { data: recepcion, error } = await supabase
    .from('proyecto_recepciones')
    .insert({
      sede,
      tipo: tipo || 'manual',
      proveedor: proveedor || null,
      documento: documento || null,
      fecha: fecha || new Date().toISOString().slice(0, 10),
      operador: operador || null,
      estado: 'pendiente_asignacion',
      notas: notas || null,
    })
    .select('*')
    .single();
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }

  const mappedLineas = [];
  const allSugs = [];

  for (const line of lineas) {
    const codigo = String(line.codigo || '').trim();
    const cantidad = Number(line.cantidad || 0);
    const item = codigo ? itemsByCodigo.get(codigo.toUpperCase()) : null;
    const validado = Boolean(item) && cantidad > 0;
    const { data: ln, error: el } = await supabase
      .from('proyecto_recepcion_lineas')
      .insert({
        recepcion_id: recepcion.id,
        item_id: item?.id || null,
        codigo_articulo: codigo || null,
        descripcion: item?.nombre || line.descripcion || null,
        cantidad,
        contenedor_id: line.contenedorId || null,
        validado,
        error: !codigo || cantidad <= 0 ? 'Código o cantidad inválidos' : !item ? 'Artículo no encontrado' : null,
      })
      .select('*')
      .single();
    if (el) throw Object.assign(new Error(el.message), { status: 500 });
    mappedLineas.push(ln);

    if (validado) {
      const sugs = await createSugerenciasForLinea(supabase, recepcion, ln, sede);
      allSugs.push(...sugs);
    }
  }

  if (!allSugs.length) {
    await supabase
      .from('proyecto_recepciones')
      .update({ estado: 'cerrada', updated_at: new Date().toISOString() })
      .eq('id', recepcion.id);
    recepcion.estado = 'cerrada';
  }

  await supabase.from('proyecto_movimientos').insert({
    tipo: 'recepcion',
    cantidad: mappedLineas.reduce((s, l) => s + Number(l.cantidad || 0), 0),
    estado_material: 'Disponible',
    usuario: operador,
    notas: `Recepción ${documento || recepcion.id}`,
    meta: { recepcion_id: recepcion.id },
  });

  return {
    recepcion: mapRecepcion(recepcion),
    lineas: mappedLineas.map(mapLinea),
    sugerencias: await enrichSugerencias(supabase, allSugs),
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
    contenedor_id: linea?.contenedor_id || null,
    cantidad: qty,
    estado: 'activa',
    sede: proy?.sede || recepcion?.sede,
    notas: `Asignado desde recepción ${recepcion?.documento || sug.recepcion_id}`,
    created_by: usuario || null,
  });

  if (sug.material_id) {
    const { data: mat } = await supabase
      .from('proyecto_materiales')
      .select('*')
      .eq('id', sug.material_id)
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
        .eq('id', sug.material_id);
    }
  }

  if (sug.faltante_id) {
    const { data: fal } = await supabase
      .from('proyecto_faltantes')
      .select('*')
      .eq('id', sug.faltante_id)
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
        .eq('id', sug.faltante_id);
    }
  }

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

  const { data: faltantes, error } = await supabase
    .from('proyecto_faltantes')
    .select('*')
    .in('item_id', ids)
    .in('estado', ['pendiente', 'parcial']);
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }

  let list = (faltantes || []).filter(
    (f) => Number(f.cantidad) - Number(f.cantidad_cubierta || 0) > 0
  );
  const proyectoIds = [...new Set(list.map((f) => f.proyecto_id))];
  const { data: proyectos } = await supabase
    .from('proyectos')
    .select('id, nombre, prioridad, sede')
    .in('id', proyectoIds.length ? proyectoIds : ['00000000-0000-0000-0000-000000000000']);
  const byId = Object.fromEntries((proyectos || []).map((p) => [p.id, p]));
  if (sede) list = list.filter((f) => !byId[f.proyecto_id] || byId[f.proyecto_id].sede === sede);

  list.sort((a, b) => {
    const pa = byId[a.proyecto_id]?.prioridad || a.prioridad;
    const pb = byId[b.proyecto_id]?.prioridad || b.prioridad;
    return (PRIORIDAD_RANK[pa] ?? 9) - (PRIORIDAD_RANK[pb] ?? 9);
  });

  const restantePorItem = {};
  for (const id of ids) {
    const c = Number(cantidades?.[id] || 0);
    restantePorItem[id] = c > 0 ? c : Number.POSITIVE_INFINITY;
  }

  const out = [];
  for (const f of list) {
    let restante = restantePorItem[f.item_id];
    if (restante <= 0) continue;
    const pend = Number(f.cantidad) - Number(f.cantidad_cubierta || 0);
    const qty = Number.isFinite(restante) ? Math.min(restante, pend) : pend;
    out.push({
      faltanteId: f.id,
      proyectoId: f.proyecto_id,
      tableroId: f.tablero_id,
      materialId: f.material_id,
      itemId: f.item_id,
      codigoArticulo: f.codigo_articulo,
      cantidadSugerida: qty,
      proyectoNombre: byId[f.proyecto_id]?.nombre || null,
      proyectoPrioridad: byId[f.proyecto_id]?.prioridad || f.prioridad,
      fechaLimite: f.fecha_limite,
    });
    if (Number.isFinite(restante)) restantePorItem[f.item_id] = restante - qty;
  }
  return out;
}

export async function countRecepcionesPendientes(sede) {
  if (isDemo()) {
    const list = await pdemo.demoListRecepciones({ sede });
    return list.filter((r) =>
      ['pendiente_asignacion', 'parcial', 'borrador'].includes(r.estado)
    ).length;
  }
  const supabase = getSupabase();
  let q = supabase
    .from('proyecto_recepciones')
    .select('*', { count: 'exact', head: true })
    .in('estado', ['pendiente_asignacion', 'parcial', 'borrador']);
  if (sede) q = q.eq('sede', sede);
  const { count, error } = await q;
  if (error) {
    if (schemaMissing(error)) return 0;
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  return count || 0;
}
