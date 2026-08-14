import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';
import * as pdemo from './proyectosDemo.js';

function isDemo() {
  return demo.isDemoMode();
}

function schemaMissing(err) {
  return /proyecto_devoluc|proyecto_auditor|proyecto_herramient|schema cache|does not exist/i.test(
    err?.message || ''
  );
}

function throwSchemaHint(err) {
  throw Object.assign(
    new Error('Ejecutá supabase/patch-proyectos-fase3.sql en Supabase para habilitar la Fase 3'),
    { status: 503, cause: err?.message }
  );
}

function mapMovimientoReporte(m, item, mat) {
  const it = item || {};
  const mt = mat || {};
  const nombre = it.nombre || mt.descripcion || mt.codigo_articulo || it.codigo_fabricante || null;
  let descripcion = it.detalle || null;
  if (!descripcion && mt.descripcion && mt.descripcion !== nombre) {
    descripcion = mt.descripcion;
  }
  return {
    id: m.id,
    tipo: m.tipo,
    cantidad: m.cantidad,
    proyectoId: m.proyecto_id,
    itemId: m.item_id,
    nombre,
    descripcion,
    codigoArticulo: mt.codigo_articulo || it.codigo_fabricante || null,
    estadoMaterial: m.estado_material,
    usuario: m.usuario,
    notas: m.notas,
    createdAt: m.created_at,
  };
}

async function enrichMovimientosReporte(supabase, rows) {
  const itemIds = [...new Set(rows.map((r) => r.item_id).filter(Boolean))];
  const materialIds = [...new Set(rows.map((r) => r.material_id).filter(Boolean))];
  const [itemsRes, matsRes] = await Promise.all([
    itemIds.length
      ? supabase.from('items').select('id, nombre, detalle, codigo_fabricante').in('id', itemIds)
      : Promise.resolve({ data: [] }),
    materialIds.length
      ? supabase
          .from('proyecto_materiales')
          .select('id, codigo_articulo, descripcion')
          .in('id', materialIds)
      : Promise.resolve({ data: [] }),
  ]);
  const itemsById = Object.fromEntries((itemsRes.data || []).map((i) => [i.id, i]));
  const matsById = Object.fromEntries((matsRes.data || []).map((x) => [x.id, x]));
  return rows.map((m) => mapMovimientoReporte(m, itemsById[m.item_id], matsById[m.material_id]));
}

export async function listDevoluciones(filters = {}) {
  if (isDemo()) return pdemo.demoListDevoluciones(filters);
  const supabase = getSupabase();
  let q = supabase.from('proyecto_devoluciones').select('*').order('created_at', { ascending: false });
  if (filters.sede) q = q.eq('sede', filters.sede);
  if (filters.proyectoId) q = q.eq('proyecto_id', filters.proyectoId);
  if (filters.estado) q = q.eq('estado', filters.estado);
  const { data, error } = await q;
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  const proyectoIds = [...new Set((data || []).map((d) => d.proyecto_id))];
  const nombres = {};
  if (proyectoIds.length) {
    const { data: ps } = await supabase.from('proyectos').select('id, nombre').in('id', proyectoIds);
    for (const p of ps || []) nombres[p.id] = p.nombre;
  }
  return (data || []).map((d) => ({
    id: d.id,
    proyectoId: d.proyecto_id,
    tableroId: d.tablero_id,
    materialId: d.material_id,
    reservaId: d.reserva_id,
    itemId: d.item_id,
    codigoArticulo: d.codigo_articulo,
    cantidad: Number(d.cantidad || 0),
    motivo: d.motivo,
    usuario: d.usuario,
    sede: d.sede,
    estado: d.estado,
    createdAt: d.created_at,
    proyectoNombre: nombres[d.proyecto_id] || null,
  }));
}

export async function crearDevolucion(payload) {
  if (isDemo()) return pdemo.demoCrearDevolucion(payload);

  const supabase = getSupabase();
  const cantidad = Number(payload.cantidad || 0);
  if (cantidad <= 0) throw Object.assign(new Error('Cantidad inválida'), { status: 400 });

  const { data: proyecto, error: ep } = await supabase
    .from('proyectos')
    .select('id, sede')
    .eq('id', payload.proyectoId)
    .maybeSingle();
  if (ep) {
    if (schemaMissing(ep)) throwSchemaHint(ep);
    throw Object.assign(new Error(ep.message), { status: 500 });
  }
  if (!proyecto) throw Object.assign(new Error('Proyecto no encontrado'), { status: 404 });

  let reserva = null;
  if (payload.reservaId) {
    const { data: r } = await supabase
      .from('proyecto_reservas')
      .select('*')
      .eq('id', payload.reservaId)
      .maybeSingle();
    if (!r || r.estado !== 'activa') {
      throw Object.assign(new Error('Reserva no activa'), { status: 409 });
    }
    if (cantidad > Number(r.cantidad)) {
      throw Object.assign(new Error('Cantidad mayor a la reserva'), { status: 400 });
    }
    reserva = r;
  }

  const { data: row, error } = await supabase
    .from('proyecto_devoluciones')
    .insert({
      proyecto_id: payload.proyectoId,
      tablero_id: payload.tableroId || reserva?.tablero_id || null,
      material_id: payload.materialId || reserva?.material_id || null,
      reserva_id: reserva?.id || null,
      item_id: payload.itemId || reserva?.item_id || null,
      codigo_articulo: payload.codigoArticulo || null,
      cantidad,
      motivo: payload.motivo || null,
      usuario: payload.usuario || null,
      sede: payload.sede || proyecto.sede,
      estado: 'registrada',
    })
    .select('*')
    .single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });

  if (reserva) {
    if (cantidad >= Number(reserva.cantidad)) {
      await supabase
        .from('proyecto_reservas')
        .update({ estado: 'liberada', updated_at: new Date().toISOString() })
        .eq('id', reserva.id);
    } else {
      await supabase
        .from('proyecto_reservas')
        .update({
          cantidad: Number(reserva.cantidad) - cantidad,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reserva.id);
    }
    if (reserva.material_id) {
      const { data: mat } = await supabase
        .from('proyecto_materiales')
        .select('cantidad_reservada')
        .eq('id', reserva.material_id)
        .maybeSingle();
      if (mat) {
        await supabase
          .from('proyecto_materiales')
          .update({
            cantidad_reservada: Math.max(0, Number(mat.cantidad_reservada) - cantidad),
            updated_at: new Date().toISOString(),
          })
          .eq('id', reserva.material_id);
      }
    }
  }

  await supabase.from('proyecto_movimientos').insert({
    proyecto_id: row.proyecto_id,
    tablero_id: row.tablero_id,
    material_id: row.material_id,
    item_id: row.item_id,
    tipo: 'devolucion',
    cantidad,
    estado_material: 'Devuelto',
    usuario: payload.usuario,
    notas: payload.motivo || 'Devolución a disponible (módulo)',
    meta: { devolucion_id: row.id },
  });

  return {
    id: row.id,
    proyectoId: row.proyecto_id,
    tableroId: row.tablero_id,
    materialId: row.material_id,
    reservaId: row.reserva_id,
    itemId: row.item_id,
    codigoArticulo: row.codigo_articulo,
    cantidad: Number(row.cantidad),
    motivo: row.motivo,
    usuario: row.usuario,
    sede: row.sede,
    estado: row.estado,
    createdAt: row.created_at,
  };
}

export async function listAuditorias(filters = {}) {
  if (isDemo()) return pdemo.demoListAuditorias(filters);
  const supabase = getSupabase();
  let q = supabase.from('proyecto_auditorias').select('*').order('created_at', { ascending: false });
  if (filters.sede) q = q.eq('sede', filters.sede);
  if (filters.estado) q = q.eq('estado', filters.estado);
  const { data, error } = await q;
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  const ids = (data || []).map((a) => a.id);
  const counts = {};
  if (ids.length) {
    const { data: lines } = await supabase
      .from('proyecto_auditoria_lineas')
      .select('auditoria_id')
      .in('auditoria_id', ids);
    for (const l of lines || []) counts[l.auditoria_id] = (counts[l.auditoria_id] || 0) + 1;
  }
  return (data || []).map((a) => ({
    id: a.id,
    sede: a.sede,
    almacen: a.almacen,
    armario: a.armario,
    estante: a.estante,
    contenedorCodigo: a.contenedor_codigo,
    estado: a.estado,
    operador: a.operador,
    notas: a.notas,
    resumen: a.resumen,
    createdAt: a.created_at,
    closedAt: a.closed_at,
    lineasCount: counts[a.id] || 0,
  }));
}

export async function getAuditoria(id) {
  if (isDemo()) return pdemo.demoGetAuditoria(id);
  const supabase = getSupabase();
  const { data: a, error } = await supabase
    .from('proyecto_auditorias')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  if (!a) throw Object.assign(new Error('Auditoría no encontrada'), { status: 404 });
  const { data: lineas } = await supabase
    .from('proyecto_auditoria_lineas')
    .select('*')
    .eq('auditoria_id', id)
    .order('scanned_at', { ascending: false });
  return {
    auditoria: {
      id: a.id,
      sede: a.sede,
      almacen: a.almacen,
      armario: a.armario,
      estante: a.estante,
      contenedorCodigo: a.contenedor_codigo,
      estado: a.estado,
      operador: a.operador,
      notas: a.notas,
      resumen: a.resumen,
      createdAt: a.created_at,
      closedAt: a.closed_at,
    },
    lineas: (lineas || []).map((l) => ({
      id: l.id,
      itemId: l.item_id,
      codigo: l.codigo,
      nombre: l.nombre,
      cantidadSistema: Number(l.cantidad_sistema || 0),
      cantidadFisica: l.cantidad_fisica == null ? null : Number(l.cantidad_fisica),
      diferencia: l.diferencia == null ? null : Number(l.diferencia),
      scannedAt: l.scanned_at,
    })),
  };
}

export async function crearAuditoria(payload) {
  if (isDemo()) return pdemo.demoCrearAuditoria(payload);
  const supabase = getSupabase();
  if (!payload.sede) throw Object.assign(new Error('Sede requerida'), { status: 400 });
  const { data, error } = await supabase
    .from('proyecto_auditorias')
    .insert({
      sede: payload.sede,
      almacen: payload.almacen || null,
      armario: payload.armario || null,
      estante: payload.estante || null,
      contenedor_codigo: payload.contenedorCodigo || null,
      operador: payload.operador || null,
      notas: payload.notas || null,
      estado: 'abierta',
    })
    .select('*')
    .single();
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  return getAuditoria(data.id);
}

export async function agregarLineaAuditoria(auditoriaId, payload) {
  let stockRows = [];
  if (isDemo()) {
    const inv = await demo.demoListInventario({});
    stockRows = inv.items || [];
    return pdemo.demoAgregarLineaAuditoria(auditoriaId, payload, stockRows);
  }

  const supabase = getSupabase();
  const { data: aud, error } = await supabase
    .from('proyecto_auditorias')
    .select('*')
    .eq('id', auditoriaId)
    .maybeSingle();
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  if (!aud) throw Object.assign(new Error('Auditoría no encontrada'), { status: 404 });
  if (aud.estado !== 'abierta') {
    throw Object.assign(new Error('La auditoría no está abierta'), { status: 409 });
  }

  const codigo = String(payload.codigo || '').trim();
  const cantidadFisica = Number(payload.cantidadFisica);
  if (!codigo || Number.isNaN(cantidadFisica)) {
    throw Object.assign(new Error('Código y cantidad física requeridos'), { status: 400 });
  }

  let item = null;
  let cantidadSistema = 0;
  try {
    const { data: items } = await supabase
      .from('items')
      .select('id, nombre, codigo_fabricante')
      .or(`codigo_fabricante.eq.${codigo},nombre.ilike.${codigo}`)
      .limit(1);
    item = items?.[0] || null;
  } catch {
    /* ignore */
  }
  if (item) {
    let sq = supabase.from('stock').select('cantidad').eq('item_id', item.id).gt('cantidad', 0);
    if (aud.almacen) {
      // stock no tiene almacen directo; usamos vista si existe
    }
    const { data: stocks } = await sq;
    cantidadSistema = (stocks || []).reduce((s, r) => s + Number(r.cantidad || 0), 0);
  }

  const diferencia = cantidadFisica - cantidadSistema;
  const { data: ln, error: el } = await supabase
    .from('proyecto_auditoria_lineas')
    .insert({
      auditoria_id: auditoriaId,
      item_id: item?.id || null,
      codigo,
      nombre: item?.nombre || codigo,
      cantidad_sistema: cantidadSistema,
      cantidad_fisica: cantidadFisica,
      diferencia,
    })
    .select('*')
    .single();
  if (el) throw Object.assign(new Error(el.message), { status: 500 });

  return {
    id: ln.id,
    itemId: ln.item_id,
    codigo: ln.codigo,
    nombre: ln.nombre,
    cantidadSistema,
    cantidadFisica,
    diferencia,
    scannedAt: ln.scanned_at,
  };
}

export async function cerrarAuditoria(id) {
  if (isDemo()) return pdemo.demoCerrarAuditoria(id);
  const supabase = getSupabase();
  const detail = await getAuditoria(id);
  const lineas = detail.lineas || [];
  const resumen = {
    total: lineas.length,
    faltantes: lineas.filter((l) => Number(l.diferencia) < 0).length,
    sobrantes: lineas.filter((l) => Number(l.diferencia) > 0).length,
    ok: lineas.filter((l) => Number(l.diferencia) === 0).length,
  };
  const { error } = await supabase
    .from('proyecto_auditorias')
    .update({
      estado: 'cerrada',
      resumen,
      closed_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return getAuditoria(id);
}

export async function listHerramientas(filters = {}) {
  if (isDemo()) return pdemo.demoListHerramientas(filters);
  const supabase = getSupabase();
  let q = supabase
    .from('proyecto_herramientas_asignaciones')
    .select('*')
    .order('created_at', { ascending: false });
  if (filters.sede) q = q.eq('sede', filters.sede);
  if (filters.estado) q = q.eq('estado', filters.estado);
  const { data, error } = await q;
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  return (data || []).map((h) => ({
    id: h.id,
    itemId: h.item_id,
    codigo: h.codigo,
    nombre: h.nombre,
    operario: h.operario,
    caja: h.caja,
    sede: h.sede,
    estado: h.estado,
    fechaEntrega: h.fecha_entrega,
    fechaDevolucion: h.fecha_devolucion,
    notas: h.notas,
    createdBy: h.created_by,
    createdAt: h.created_at,
  }));
}

export async function asignarHerramienta(payload) {
  if (isDemo()) return pdemo.demoAsignarHerramienta(payload);
  const supabase = getSupabase();
  if (!String(payload.operario || '').trim()) {
    throw Object.assign(new Error('Operario requerido'), { status: 400 });
  }
  const { data, error } = await supabase
    .from('proyecto_herramientas_asignaciones')
    .insert({
      item_id: payload.itemId || null,
      codigo: payload.codigo || null,
      nombre: payload.nombre || payload.codigo || 'Herramienta',
      operario: String(payload.operario).trim(),
      caja: payload.caja || null,
      sede: payload.sede || null,
      estado: 'prestada',
      notas: payload.notas || null,
      created_by: payload.createdBy || null,
    })
    .select('*')
    .single();
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  await supabase.from('proyecto_herramientas_eventos').insert({
    asignacion_id: data.id,
    tipo: 'prestada',
    usuario: payload.createdBy || null,
    notas: payload.notas || null,
  });
  return {
    id: data.id,
    itemId: data.item_id,
    codigo: data.codigo,
    nombre: data.nombre,
    operario: data.operario,
    caja: data.caja,
    sede: data.sede,
    estado: data.estado,
    fechaEntrega: data.fecha_entrega,
    fechaDevolucion: data.fecha_devolucion,
    notas: data.notas,
    createdBy: data.created_by,
    createdAt: data.created_at,
  };
}

export async function eventoHerramienta(id, payload) {
  if (isDemo()) return pdemo.demoEventoHerramienta(id, payload);
  const supabase = getSupabase();
  const tipo = payload.tipo;
  const allowed = ['prestada', 'devuelta', 'perdida', 'rota', 'reemplazada'];
  if (!allowed.includes(tipo)) {
    throw Object.assign(new Error('Tipo de evento inválido'), { status: 400 });
  }
  const patch = { estado: tipo, updated_at: new Date().toISOString() };
  if (tipo === 'devuelta') patch.fecha_devolucion = new Date().toISOString();
  const { data, error } = await supabase
    .from('proyecto_herramientas_asignaciones')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!data) throw Object.assign(new Error('Asignación no encontrada'), { status: 404 });
  await supabase.from('proyecto_herramientas_eventos').insert({
    asignacion_id: id,
    tipo,
    usuario: payload.usuario || null,
    notas: payload.notas || null,
  });
  return {
    id: data.id,
    itemId: data.item_id,
    codigo: data.codigo,
    nombre: data.nombre,
    operario: data.operario,
    caja: data.caja,
    sede: data.sede,
    estado: data.estado,
    fechaEntrega: data.fecha_entrega,
    fechaDevolucion: data.fecha_devolucion,
    notas: data.notas,
    createdBy: data.created_by,
    createdAt: data.created_at,
  };
}

export async function getHerramienta(id) {
  if (isDemo()) return pdemo.demoGetHerramienta(id);
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('proyecto_herramientas_asignaciones')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  if (!data) throw Object.assign(new Error('Asignación no encontrada'), { status: 404 });
  const { data: eventos } = await supabase
    .from('proyecto_herramientas_eventos')
    .select('*')
    .eq('asignacion_id', id)
    .order('created_at', { ascending: false });
  return {
    asignacion: {
      id: data.id,
      itemId: data.item_id,
      codigo: data.codigo,
      nombre: data.nombre,
      operario: data.operario,
      caja: data.caja,
      sede: data.sede,
      estado: data.estado,
      fechaEntrega: data.fecha_entrega,
      fechaDevolucion: data.fecha_devolucion,
      notas: data.notas,
      createdBy: data.created_by,
      createdAt: data.created_at,
    },
    eventos: (eventos || []).map((e) => ({
      id: e.id,
      tipo: e.tipo,
      usuario: e.usuario,
      notas: e.notas,
      createdAt: e.created_at,
    })),
  };
}

export async function getReporte(filters = {}) {
  if (isDemo()) return pdemo.demoReporte(filters);
  const supabase = getSupabase();
  let mq = supabase.from('proyecto_movimientos').select('*').order('created_at', { ascending: false }).limit(200);
  if (filters.proyectoId) mq = mq.eq('proyecto_id', filters.proyectoId);
  if (filters.desde) mq = mq.gte('created_at', filters.desde);
  if (filters.hasta) mq = mq.lte('created_at', `${filters.hasta}T23:59:59`);
  const { data: movs, error } = await mq;
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }

  let list = movs || [];
  if (filters.sede) {
    const { data: proyectos } = await supabase.from('proyectos').select('id').eq('sede', filters.sede);
    const ids = new Set((proyectos || []).map((p) => p.id));
    list = list.filter((m) => !m.proyecto_id || ids.has(m.proyecto_id));
  }

  const byTipo = {};
  for (const m of list) {
    byTipo[m.tipo] = (byTipo[m.tipo] || 0) + Number(m.cantidad || 0);
  }

  let pq = supabase.from('proyectos').select('id, estado', { count: 'exact' });
  if (filters.sede) pq = pq.eq('sede', filters.sede);
  const { data: proyectos } = await pq;

  const { count: reservasActivas } = await supabase
    .from('proyecto_reservas')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'activa');
  const { count: faltantesPendientes } = await supabase
    .from('proyecto_faltantes')
    .select('*', { count: 'exact', head: true })
    .in('estado', ['pendiente', 'parcial']);
  const { count: devoluciones } = await supabase
    .from('proyecto_devoluciones')
    .select('*', { count: 'exact', head: true });
  const { count: herramientasPrestadas } = await supabase
    .from('proyecto_herramientas_asignaciones')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'prestada');

  return {
    resumen: {
      movimientos: list.length,
      reservasActivas: reservasActivas || 0,
      faltantesPendientes: faltantesPendientes || 0,
      devoluciones: devoluciones || 0,
      herramientasPrestadas: herramientasPrestadas || 0,
      proyectosActivos: (proyectos || []).filter((p) => p.estado === 'activo').length,
    },
    porTipo: byTipo,
    recientes: await enrichMovimientosReporte(supabase, list.slice(0, 50)),
  };
}

export async function countDevolucionesPendientes(sede) {
  if (isDemo()) {
    const list = await pdemo.demoListDevoluciones({ sede, estado: 'pendiente' });
    return list.length;
  }
  const supabase = getSupabase();
  let q = supabase
    .from('proyecto_devoluciones')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'pendiente');
  if (sede) q = q.eq('sede', sede);
  const { count, error } = await q;
  if (error) {
    if (schemaMissing(error)) return 0;
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  return count || 0;
}

export async function countHerramientasAsignadas(sede) {
  if (isDemo()) {
    const list = await pdemo.demoListHerramientas({ sede, estado: 'prestada' });
    return list.length;
  }
  const supabase = getSupabase();
  let q = supabase
    .from('proyecto_herramientas_asignaciones')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'prestada');
  if (sede) q = q.eq('sede', sede);
  const { count, error } = await q;
  if (error) {
    if (schemaMissing(error)) return 0;
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  return count || 0;
}
