import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';
import * as pdemo from './proyectosDemo.js';
import { countRecepcionesPendientes } from './proyectosRecepcionesService.js';
import {
  countDevolucionesPendientes,
  countHerramientasAsignadas,
} from './proyectosFase3Service.js';
import { resolveUbicacion } from './ubicacionService.js';
import { getProduccionUbicacion } from './ubicacionUtils.js';
import { PROYECTOS_ARMARIO, PROYECTOS_ESTANTE } from './sedeBootstrap.js';

function isDemo() {
  return demo.isDemoMode();
}

function mapProyecto(row) {
  if (!row) return null;
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    descripcion: row.descripcion,
    clienteId: row.cliente_id,
    sede: row.sede,
    prioridad: row.prioridad,
    estado: row.estado,
    fechaInicio: row.fecha_inicio,
    fechaObjetivo: row.fecha_objetivo,
    responsable: row.responsable,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tablerosCount: row.tableros_count,
    faltantesCount: row.faltantes_count,
    reservasActivas: row.reservas_activas,
  };
}

function mapTablero(row) {
  return {
    id: row.id,
    proyectoId: row.proyecto_id,
    codigo: row.codigo,
    nombre: row.nombre,
    prioridad: row.prioridad,
    estado: row.estado,
    fechaObjetivo: row.fecha_objetivo,
    notas: row.notas,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMaterial(row) {
  return {
    id: row.id,
    proyectoId: row.proyecto_id,
    tableroId: row.tablero_id,
    itemId: row.item_id,
    codigoArticulo: row.codigo_articulo,
    descripcion: row.descripcion,
    cantidadRequerida: Number(row.cantidad_requerida || 0),
    cantidadReservada: Number(row.cantidad_reservada || 0),
    cantidadFaltante: Number(row.cantidad_faltante || 0),
    cantidadEntregada: Number(row.cantidad_entregada || 0),
    cantidadConsumida: Number(row.cantidad_consumida || 0),
    estado: row.estado,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReserva(row) {
  return {
    id: row.id,
    proyectoId: row.proyecto_id,
    tableroId: row.tablero_id,
    materialId: row.material_id,
    itemId: row.item_id,
    stockId: row.stock_id,
    contenedorId: row.contenedor_id,
    cantidad: Number(row.cantidad || 0),
    estado: row.estado,
    sede: row.sede,
    notas: row.notas,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFaltante(row) {
  return {
    id: row.id,
    proyectoId: row.proyecto_id,
    tableroId: row.tablero_id,
    materialId: row.material_id,
    itemId: row.item_id,
    codigoArticulo: row.codigo_articulo,
    cantidad: Number(row.cantidad || 0),
    cantidadCubierta: Number(row.cantidad_cubierta || 0),
    fechaLimite: row.fecha_limite,
    prioridad: row.prioridad,
    estado: row.estado,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function schemaMissing(err) {
  return /proyectos|schema cache|does not exist/i.test(err?.message || '');
}

function throwSchemaHint(err) {
  throw Object.assign(
    new Error(
      'Ejecutá supabase/patch-proyectos.sql en Supabase para habilitar el módulo Proyectos'
    ),
    { status: 503, cause: err?.message }
  );
}

export async function listProyectos({ sede, estado, q } = {}) {
  if (isDemo()) return pdemo.demoListProyectos({ sede, estado, q });

  const supabase = getSupabase();
  let query = supabase.from('proyectos').select('*').order('created_at', { ascending: false });
  if (sede) query = query.eq('sede', sede);
  if (estado) query = query.eq('estado', estado);
  if (q) query = query.or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }

  const ids = (data || []).map((p) => p.id);
  let tablerosCount = {};
  let faltantesCount = {};
  let reservasActivas = {};

  if (ids.length) {
    const { data: tabs } = await supabase
      .from('proyecto_tableros')
      .select('proyecto_id')
      .in('proyecto_id', ids);
    for (const t of tabs || []) {
      tablerosCount[t.proyecto_id] = (tablerosCount[t.proyecto_id] || 0) + 1;
    }
    const { data: fals } = await supabase
      .from('proyecto_faltantes')
      .select('proyecto_id')
      .in('proyecto_id', ids)
      .eq('estado', 'pendiente');
    for (const f of fals || []) {
      faltantesCount[f.proyecto_id] = (faltantesCount[f.proyecto_id] || 0) + 1;
    }
    const { data: res } = await supabase
      .from('proyecto_reservas')
      .select('proyecto_id, cantidad')
      .in('proyecto_id', ids)
      .eq('estado', 'activa');
    for (const r of res || []) {
      reservasActivas[r.proyecto_id] =
        (reservasActivas[r.proyecto_id] || 0) + Number(r.cantidad || 0);
    }
  }

  return (data || []).map((p) =>
    mapProyecto({
      ...p,
      tableros_count: tablerosCount[p.id] || 0,
      faltantes_count: faltantesCount[p.id] || 0,
      reservas_activas: reservasActivas[p.id] || 0,
    })
  );
}

export async function getProyecto(id) {
  if (isDemo()) return pdemo.demoGetProyecto(id);

  const supabase = getSupabase();
  const { data: p, error } = await supabase.from('proyectos').select('*').eq('id', id).maybeSingle();
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  if (!p) throw Object.assign(new Error('Proyecto no encontrado'), { status: 404 });

  const [{ data: tableros }, { data: materiales }, { data: reservas }, { data: faltantes }] =
    await Promise.all([
      supabase.from('proyecto_tableros').select('*').eq('proyecto_id', id).order('created_at'),
      supabase.from('proyecto_materiales').select('*').eq('proyecto_id', id).order('created_at'),
      supabase.from('proyecto_reservas').select('*').eq('proyecto_id', id).order('created_at', { ascending: false }),
      supabase.from('proyecto_faltantes').select('*').eq('proyecto_id', id).order('created_at', { ascending: false }),
    ]);

  return {
    proyecto: mapProyecto(p),
    tableros: (tableros || []).map(mapTablero),
    materiales: (materiales || []).map(mapMaterial),
    reservas: (reservas || []).map(mapReserva),
    faltantes: (faltantes || []).map(mapFaltante),
  };
}

export async function createProyecto(payload) {
  if (isDemo()) return pdemo.demoCreateProyecto(payload);

  const supabase = getSupabase();
  const row = {
    codigo: payload.codigo || null,
    nombre: String(payload.nombre || '').trim(),
    descripcion: payload.descripcion || null,
    cliente_id: payload.clienteId || null,
    sede: payload.sede,
    prioridad: payload.prioridad || 'media',
    estado: payload.estado || 'activo',
    fecha_inicio: payload.fechaInicio || null,
    fecha_objetivo: payload.fechaObjetivo || null,
    responsable: payload.responsable || null,
    created_by: payload.createdBy || null,
  };
  if (!row.nombre) throw Object.assign(new Error('Nombre requerido'), { status: 400 });
  if (!row.sede) throw Object.assign(new Error('Sede requerida'), { status: 400 });

  const { data, error } = await supabase.from('proyectos').insert(row).select('*').single();
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  await supabase.from('proyecto_movimientos').insert({
    proyecto_id: data.id,
    tipo: 'proyecto_creado',
    usuario: payload.createdBy,
    notas: data.nombre,
  });
  return mapProyecto(data);
}

export async function updateProyecto(id, patch) {
  if (isDemo()) return pdemo.demoUpdateProyecto(id, patch);

  const supabase = getSupabase();
  const row = { updated_at: new Date().toISOString() };
  const map = {
    codigo: 'codigo',
    nombre: 'nombre',
    descripcion: 'descripcion',
    clienteId: 'cliente_id',
    prioridad: 'prioridad',
    estado: 'estado',
    fechaInicio: 'fecha_inicio',
    fechaObjetivo: 'fecha_objetivo',
    responsable: 'responsable',
  };
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) row[col] = patch[k];
  }
  const { data, error } = await supabase
    .from('proyectos')
    .update(row)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  if (!data) throw Object.assign(new Error('Proyecto no encontrado'), { status: 404 });
  return mapProyecto(data);
}

export async function createTablero(proyectoId, payload) {
  if (isDemo()) return pdemo.demoCreateTablero(proyectoId, payload);

  const supabase = getSupabase();
  const { data: p, error: ep } = await supabase
    .from('proyectos')
    .select('id, prioridad')
    .eq('id', proyectoId)
    .maybeSingle();
  if (ep) {
    if (schemaMissing(ep)) throwSchemaHint(ep);
    throw Object.assign(new Error(ep.message), { status: 500 });
  }
  if (!p) throw Object.assign(new Error('Proyecto no encontrado'), { status: 404 });

  const row = {
    proyecto_id: proyectoId,
    codigo: payload.codigo || null,
    nombre: String(payload.nombre || '').trim(),
    prioridad: payload.prioridad || p.prioridad || 'media',
    estado: payload.estado || 'pendiente',
    fecha_objetivo: payload.fechaObjetivo || null,
    notas: payload.notas || null,
  };
  if (!row.nombre) throw Object.assign(new Error('Nombre de tablero requerido'), { status: 400 });

  const { data, error } = await supabase.from('proyecto_tableros').insert(row).select('*').single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return mapTablero(data);
}

export async function updateTablero(id, patch) {
  if (isDemo()) return pdemo.demoUpdateTablero(id, patch);

  const supabase = getSupabase();
  const row = { updated_at: new Date().toISOString() };
  const map = {
    codigo: 'codigo',
    nombre: 'nombre',
    prioridad: 'prioridad',
    estado: 'estado',
    fechaObjetivo: 'fecha_objetivo',
    notas: 'notas',
  };
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) row[col] = patch[k];
  }
  const { data, error } = await supabase
    .from('proyecto_tableros')
    .update(row)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!data) throw Object.assign(new Error('Tablero no encontrado'), { status: 404 });
  return mapTablero(data);
}

export async function getDashboardKpis({ sede } = {}) {
  if (isDemo()) return pdemo.demoDashboardKpis({ sede });

  const supabase = getSupabase();
  let pq = supabase.from('proyectos').select('id, estado, prioridad');
  if (sede) pq = pq.eq('sede', sede);
  const { data: proyectos, error } = await pq;
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  const list = proyectos || [];
  const ids = list.map((p) => p.id);
  const activos = list.filter((p) => p.estado === 'activo');
  const criticos = activos.filter((p) => p.prioridad === 'critica');

  let faltantesPendientes = 0;
  let materialesReservados = 0;
  let alertasActivas = 0;

  if (ids.length) {
    const { count: fc } = await supabase
      .from('proyecto_faltantes')
      .select('*', { count: 'exact', head: true })
      .in('proyecto_id', ids)
      .in('estado', ['pendiente', 'parcial']);
    faltantesPendientes = fc || 0;

    const { data: res } = await supabase
      .from('proyecto_reservas')
      .select('cantidad')
      .in('proyecto_id', ids)
      .eq('estado', 'activa');
    materialesReservados = (res || []).reduce((s, r) => s + Number(r.cantidad || 0), 0);

    const { count: ac } = await supabase
      .from('proyecto_alertas')
      .select('*', { count: 'exact', head: true })
      .eq('leida', false);
    alertasActivas = ac || 0;
  }

  let recepcionesPendientes = 0;
  let devolucionesPendientes = 0;
  let herramientasAsignadas = 0;
  try {
    recepcionesPendientes = await countRecepcionesPendientes(sede);
  } catch {
    recepcionesPendientes = 0;
  }
  try {
    devolucionesPendientes = await countDevolucionesPendientes(sede);
  } catch {
    devolucionesPendientes = 0;
  }
  try {
    herramientasAsignadas = await countHerramientasAsignadas(sede);
  } catch {
    herramientasAsignadas = 0;
  }

  let materialesEnTransito = 0;
  try {
    const { countMaterialesEnTransito } = await import('./proyectosFase4Service.js');
    materialesEnTransito = await countMaterialesEnTransito({ sede });
  } catch {
    materialesEnTransito = 0;
  }

  return {
    totalProyectosActivos: activos.length,
    proyectosCriticos: criticos.length,
    faltantesPendientes,
    materialesReservados,
    materialesEnTransito,
    recepcionesPendientes,
    devolucionesPendientes,
    herramientasAsignadas,
    alertasActivas,
  };
}

export async function listReservas(filters) {
  if (isDemo()) return pdemo.demoListReservas(filters);

  const supabase = getSupabase();
  let query = supabase.from('proyecto_reservas').select('*').order('created_at', { ascending: false });
  if (filters?.estado) query = query.eq('estado', filters.estado);
  else query = query.eq('estado', 'activa');
  if (filters?.proyectoId) query = query.eq('proyecto_id', filters.proyectoId);

  const { data, error } = await query;
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  let rows = data || [];
  if (filters?.sede) {
    const { data: proyectos } = await supabase.from('proyectos').select('id').eq('sede', filters.sede);
    const ids = new Set((proyectos || []).map((p) => p.id));
    rows = rows.filter((r) => ids.has(r.proyecto_id));
  }
  return rows.map(mapReserva);
}

export async function listFaltantes(filters) {
  if (isDemo()) return pdemo.demoListFaltantes(filters);

  const supabase = getSupabase();
  let query = supabase.from('proyecto_faltantes').select('*').order('created_at', { ascending: false });
  if (filters?.proyectoId) query = query.eq('proyecto_id', filters.proyectoId);
  if (filters?.estado) query = query.eq('estado', filters.estado);
  else query = query.in('estado', ['pendiente', 'parcial']);

  const { data, error } = await query;
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  let rows = data || [];
  if (filters?.sede) {
    const { data: proyectos } = await supabase.from('proyectos').select('id').eq('sede', filters.sede);
    const ids = new Set((proyectos || []).map((p) => p.id));
    rows = rows.filter((f) => ids.has(f.proyecto_id));
  }
  return rows.map(mapFaltante);
}

export async function liberarReserva(id, payload) {
  if (isDemo()) return pdemo.demoLiberarReserva(id, payload);

  const supabase = getSupabase();
  const { data: row, error } = await supabase
    .from('proyecto_reservas')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!row) throw Object.assign(new Error('Reserva no encontrada'), { status: 404 });
  if (row.estado !== 'activa') {
    throw Object.assign(new Error('La reserva no está activa'), { status: 409 });
  }

  const { data: updated, error: e2 } = await supabase
    .from('proyecto_reservas')
    .update({ estado: 'liberada', updated_at: new Date().toISOString(), notas: payload?.notas || row.notas })
    .eq('id', id)
    .select('*')
    .single();
  if (e2) throw Object.assign(new Error(e2.message), { status: 500 });

  if (row.material_id) {
    const { data: mat } = await supabase
      .from('proyecto_materiales')
      .select('cantidad_reservada')
      .eq('id', row.material_id)
      .maybeSingle();
    if (mat) {
      await supabase
        .from('proyecto_materiales')
        .update({
          cantidad_reservada: Math.max(0, Number(mat.cantidad_reservada) - Number(row.cantidad)),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.material_id);
    }
  }

  await supabase.from('proyecto_movimientos').insert({
    proyecto_id: row.proyecto_id,
    tablero_id: row.tablero_id,
    reserva_id: row.id,
    material_id: row.material_id,
    item_id: row.item_id,
    tipo: 'liberacion',
    cantidad: row.cantidad,
    estado_material: 'Disponible',
    usuario: payload?.usuario || null,
    notas: payload?.notas || null,
  });

  return mapReserva(updated);
}

export async function reasignarReserva(id, payload) {
  if (isDemo()) return pdemo.demoReasignarReserva(id, payload);

  const supabase = getSupabase();
  const { data: row, error } = await supabase
    .from('proyecto_reservas')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!row) throw Object.assign(new Error('Reserva no encontrada'), { status: 404 });
  if (row.estado !== 'activa') {
    throw Object.assign(new Error('La reserva no está activa'), { status: 409 });
  }

  const haciaProyectoId = payload.haciaProyectoId;
  const { data: dest } = await supabase
    .from('proyectos')
    .select('id, sede')
    .eq('id', haciaProyectoId)
    .maybeSingle();
  if (!dest) throw Object.assign(new Error('Proyecto destino no encontrado'), { status: 404 });

  await supabase
    .from('proyecto_reservas')
    .update({ estado: 'reasignada', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (row.material_id) {
    const { data: mat } = await supabase
      .from('proyecto_materiales')
      .select('cantidad_reservada')
      .eq('id', row.material_id)
      .maybeSingle();
    if (mat) {
      await supabase
        .from('proyecto_materiales')
        .update({
          cantidad_reservada: Math.max(0, Number(mat.cantidad_reservada) - Number(row.cantidad)),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.material_id);
    }
  }

  const { data: nueva, error: e3 } = await supabase
    .from('proyecto_reservas')
    .insert({
      proyecto_id: haciaProyectoId,
      tablero_id: payload.haciaTableroId || null,
      item_id: row.item_id,
      stock_id: row.stock_id,
      contenedor_id: row.contenedor_id,
      cantidad: row.cantidad,
      estado: 'activa',
      sede: dest.sede,
      notas: payload.notas || `Reasignada desde ${row.proyecto_id}`,
      created_by: payload.usuario || null,
    })
    .select('*')
    .single();
  if (e3) throw Object.assign(new Error(e3.message), { status: 500 });

  await supabase.from('proyecto_movimientos').insert({
    proyecto_id: row.proyecto_id,
    reserva_id: row.id,
    item_id: row.item_id,
    tipo: 'reasignacion',
    cantidad: row.cantidad,
    desde_proyecto_id: row.proyecto_id,
    hacia_proyecto_id: haciaProyectoId,
    estado_material: 'Reservado',
    usuario: payload.usuario || null,
    notas: payload.notas || null,
  });

  return { origen: mapReserva({ ...row, estado: 'reasignada' }), destino: mapReserva(nueva) };
}

async function resolveItemsAndStock(lineas) {
  const supabase = getSupabase();
  const codes = [...new Set(lineas.map((l) => String(l.codigo || '').trim().toUpperCase()).filter(Boolean))];
  const itemsByCodigo = new Map();

  for (const code of codes) {
    let found = null;
    const tries = [
      () =>
        supabase.from('items').select('id, nombre, codigo_fabricante').eq('codigo_fabricante', code).limit(1),
      () =>
        supabase.from('items').select('id, nombre, codigo_fabricante').ilike('nombre', code).limit(1),
    ];
    for (const tryFn of tries) {
      try {
        const { data } = await tryFn();
        if (data?.[0]) {
          found = data[0];
          break;
        }
      } catch {
        /* columna puede no existir */
      }
    }
    if (found) itemsByCodigo.set(code, found);
  }

  const itemIds = [...new Set([...itemsByCodigo.values()].map((i) => i.id))];
  const stockByItem = new Map();
  if (itemIds.length) {
    const { data: stocks } = await supabase
      .from('stock')
      .select('id, item_id, contenedor_id, cantidad')
      .in('item_id', itemIds)
      .gt('cantidad', 0);
    for (const s of stocks || []) {
      const prev = stockByItem.get(s.item_id) || { cantidad: 0, stockId: null, contenedorId: null };
      prev.cantidad += Number(s.cantidad || 0);
      if (!prev.stockId) {
        prev.stockId = s.id;
        prev.contenedorId = s.contenedor_id;
      }
      stockByItem.set(s.item_id, prev);
    }

    const { data: reservas } = await supabase
      .from('proyecto_reservas')
      .select('item_id, cantidad')
      .in('item_id', itemIds)
      .eq('estado', 'activa');
    for (const r of reservas || []) {
      const prev = stockByItem.get(r.item_id);
      if (prev) prev.cantidad = Math.max(0, prev.cantidad - Number(r.cantidad || 0));
    }
  }

  return { itemsByCodigo, stockByItem };
}

/**
 * Dry-run de pedido masivo: match por codigo_fabricante y estimado de reserva/faltante
 * sin escribir en DB.
 */
export async function previewPedidoMasivo(payload) {
  const { proyectoId, lineas } = payload;
  if (!proyectoId) throw Object.assign(new Error('proyectoId requerido'), { status: 400 });
  if (!Array.isArray(lineas) || !lineas.length) {
    throw Object.assign(new Error('Se requieren líneas de pedido'), { status: 400 });
  }

  if (isDemo()) {
    const inv = await demo.demoListInventario({});
    const itemsByCodigo = new Map();
    const stockByItem = new Map();
    for (const row of inv.items || inv || []) {
      const item = { id: row.itemId || row.item_id, nombre: row.nombre };
      if (!item.id) continue;
      for (const key of [row.codigoFabricante, row.sku, row.codigo, row.nombre]) {
        if (key) itemsByCodigo.set(String(key).trim().toUpperCase(), item);
      }
      const prev = stockByItem.get(item.id) || { cantidad: 0 };
      prev.cantidad += Number(row.cantidad || 0);
      stockByItem.set(item.id, prev);
    }
    return buildPedidoPreview(lineas, itemsByCodigo, stockByItem);
  }

  const supabase = getSupabase();
  const { data: proyecto, error: ep } = await supabase
    .from('proyectos')
    .select('id')
    .eq('id', proyectoId)
    .maybeSingle();
  if (ep) {
    if (schemaMissing(ep)) throwSchemaHint(ep);
    throw Object.assign(new Error(ep.message), { status: 500 });
  }
  if (!proyecto) throw Object.assign(new Error('Proyecto no encontrado'), { status: 404 });

  const { itemsByCodigo, stockByItem } = await resolveItemsAndStock(lineas);
  return buildPedidoPreview(lineas, itemsByCodigo, stockByItem);
}

function buildPedidoPreview(lineas, itemsByCodigo, stockByItem) {
  const working = new Map();
  for (const [id, st] of stockByItem.entries()) {
    working.set(id, { cantidad: Number(st.cantidad || 0) });
  }

  const out = [];
  let ok = 0;
  let parcial = 0;
  let sinItem = 0;
  let totalReservable = 0;
  let totalFaltante = 0;

  for (const line of lineas || []) {
    const codigo = String(line.codigo || '')
      .trim()
      .toUpperCase();
    const cantidad = Number(line.cantidad || 0);
    if (!codigo || !(cantidad > 0)) continue;

    const item = itemsByCodigo.get(codigo);
    if (!item) {
      sinItem += 1;
      totalFaltante += cantidad;
      out.push({
        codigo,
        cantidad,
        itemId: null,
        nombre: null,
        disponible: 0,
        reservable: 0,
        faltante: cantidad,
        estado: 'sin_item',
      });
      continue;
    }

    const st = working.get(item.id) || { cantidad: 0 };
    const disponible = Number(st.cantidad || 0);
    const reservable = Math.min(cantidad, disponible);
    const faltante = Math.max(0, cantidad - reservable);
    st.cantidad = Math.max(0, disponible - reservable);
    working.set(item.id, st);

    let estado = 'ok';
    if (faltante > 0 && reservable > 0) {
      estado = 'parcial';
      parcial += 1;
    } else if (faltante > 0) {
      estado = 'faltante';
      parcial += 1;
    } else {
      ok += 1;
    }
    totalReservable += reservable;
    totalFaltante += faltante;

    out.push({
      codigo,
      cantidad,
      itemId: item.id,
      nombre: item.nombre || null,
      disponible,
      reservable,
      faltante,
      estado,
    });
  }

  return {
    lineas: out,
    resumen: {
      total: out.length,
      ok,
      parcial,
      sinItem,
      totalReservable,
      totalFaltante,
    },
  };
}

export async function procesarPedidoMasivo(payload) {
  const { proyectoId, tableroId, lineas, usuario, archivoNombre } = payload;
  if (!proyectoId) throw Object.assign(new Error('proyectoId requerido'), { status: 400 });
  if (!Array.isArray(lineas) || !lineas.length) {
    throw Object.assign(new Error('Se requieren líneas de pedido'), { status: 400 });
  }

  if (isDemo()) {
    // Resolver items desde demo inventario
    const inv = await demo.demoListInventario({});
    const itemsByCodigo = new Map();
    const stockByItem = new Map();
    for (const row of inv.items || inv || []) {
      const item = {
        id: row.itemId || row.item_id,
        nombre: row.nombre,
      };
      if (!item.id) continue;
      for (const key of [row.codigoFabricante, row.sku, row.codigo, row.nombre]) {
        if (key) itemsByCodigo.set(String(key).trim().toUpperCase(), item);
      }
      const prev = stockByItem.get(item.id) || {
        cantidad: 0,
        stockId: row.id || row.stockId,
        contenedorId: row.contenedorId,
      };
      prev.cantidad += Number(row.cantidad || 0);
      stockByItem.set(item.id, prev);
    }
    return pdemo.demoProcesarPedidoMasivo({
      proyectoId,
      tableroId,
      lineas,
      itemsByCodigo,
      stockByItem,
      usuario,
      archivoNombre,
    });
  }

  const supabase = getSupabase();
  const { data: proyecto, error: ep } = await supabase
    .from('proyectos')
    .select('*')
    .eq('id', proyectoId)
    .maybeSingle();
  if (ep) {
    if (schemaMissing(ep)) throwSchemaHint(ep);
    throw Object.assign(new Error(ep.message), { status: 500 });
  }
  if (!proyecto) throw Object.assign(new Error('Proyecto no encontrado'), { status: 404 });

  const { itemsByCodigo, stockByItem } = await resolveItemsAndStock(lineas);

  const { data: pedido, error: ePed } = await supabase
    .from('proyecto_pedidos')
    .insert({
      proyecto_id: proyectoId,
      tablero_id: tableroId || null,
      nombre: `Pedido ${new Date().toLocaleString('es-AR')}`,
      archivo_nombre: archivoNombre || null,
      estado: 'procesado',
      created_by: usuario || null,
    })
    .select('*')
    .single();
  if (ePed) throw Object.assign(new Error(ePed.message), { status: 500 });

  let ok = 0;
  let invalidos = 0;
  let totalReservado = 0;
  let totalFaltante = 0;
  const resultLineas = [];

  for (const line of lineas) {
    const codigo = String(line.codigo || '').trim();
    const cantidad = Number(line.cantidad || 0);
    const item = codigo ? itemsByCodigo.get(codigo.toUpperCase()) : null;

    const plBase = {
      pedido_id: pedido.id,
      codigo,
      cantidad,
      item_id: item?.id || null,
      validado: Boolean(item) && cantidad > 0,
      error: null,
      material_id: null,
      reservado: 0,
      faltante: 0,
    };

    if (!codigo || cantidad <= 0) {
      plBase.error = 'Código o cantidad inválidos';
      invalidos += 1;
      const { data: pl } = await supabase.from('proyecto_pedido_lineas').insert(plBase).select('*').single();
      resultLineas.push(pl);
      continue;
    }
    if (!item) {
      plBase.error = 'Artículo no encontrado';
      invalidos += 1;
      const { data: pl } = await supabase.from('proyecto_pedido_lineas').insert(plBase).select('*').single();
      resultLineas.push(pl);
      continue;
    }

    const stockInfo = stockByItem.get(item.id) || { cantidad: 0 };
    const neto = Math.max(0, Number(stockInfo.cantidad || 0));
    const aReservar = Math.min(cantidad, neto);
    const aFaltar = Math.max(0, cantidad - aReservar);
    // Consumir del mapa local para líneas siguientes
    stockInfo.cantidad = Math.max(0, neto - aReservar);
    stockByItem.set(item.id, stockInfo);

    const { data: mat, error: em } = await supabase
      .from('proyecto_materiales')
      .insert({
        proyecto_id: proyectoId,
        tablero_id: tableroId || null,
        item_id: item.id,
        codigo_articulo: codigo,
        descripcion: item.nombre || codigo,
        cantidad_requerida: cantidad,
        cantidad_reservada: aReservar,
        cantidad_faltante: aFaltar,
        estado: aFaltar === 0 ? 'completo' : aReservar > 0 ? 'parcial' : 'pendiente',
      })
      .select('*')
      .single();
    if (em) throw Object.assign(new Error(em.message), { status: 500 });

    plBase.material_id = mat.id;
    plBase.reservado = aReservar;
    plBase.faltante = aFaltar;

    if (aReservar > 0) {
      await supabase.from('proyecto_reservas').insert({
        proyecto_id: proyectoId,
        tablero_id: tableroId || null,
        material_id: mat.id,
        item_id: item.id,
        stock_id: stockInfo.stockId || null,
        contenedor_id: stockInfo.contenedorId || null,
        cantidad: aReservar,
        estado: 'activa',
        sede: proyecto.sede,
        notas: 'Pedido masivo',
        created_by: usuario || null,
      });
      await supabase.from('proyecto_movimientos').insert({
        proyecto_id: proyectoId,
        tablero_id: tableroId || null,
        material_id: mat.id,
        item_id: item.id,
        tipo: 'reserva',
        cantidad: aReservar,
        estado_material: 'Reservado',
        usuario,
        notas: 'Pedido masivo',
      });
      totalReservado += aReservar;
    }

    if (aFaltar > 0) {
      await supabase.from('proyecto_faltantes').insert({
        proyecto_id: proyectoId,
        tablero_id: tableroId || null,
        material_id: mat.id,
        item_id: item.id,
        codigo_articulo: codigo,
        cantidad: aFaltar,
        fecha_limite: proyecto.fecha_objetivo || null,
        prioridad: proyecto.prioridad || 'media',
        estado: 'pendiente',
      });
      await supabase.from('proyecto_movimientos').insert({
        proyecto_id: proyectoId,
        tablero_id: tableroId || null,
        material_id: mat.id,
        item_id: item.id,
        tipo: 'faltante',
        cantidad: aFaltar,
        estado_material: 'Disponible',
        usuario,
        notas: 'Faltante generado por pedido masivo',
      });
      if (proyecto.prioridad === 'critica' || proyecto.prioridad === 'alta') {
        await supabase.from('proyecto_alertas').insert({
          proyecto_id: proyectoId,
          tipo: 'faltante_critico',
          severidad: proyecto.prioridad === 'critica' ? 'critical' : 'warning',
          mensaje: `Faltan ${aFaltar} u. de ${codigo} en ${proyecto.nombre}`,
          meta: { codigo, cantidad: aFaltar },
        });
      }
      totalFaltante += aFaltar;
    }

    ok += 1;
    const { data: pl } = await supabase.from('proyecto_pedido_lineas').insert(plBase).select('*').single();
    resultLineas.push(pl);
  }

  const resumen = {
    lineas: resultLineas.length,
    validas: ok,
    invalidas: invalidos,
    totalReservado,
    totalFaltante,
  };
  await supabase.from('proyecto_pedidos').update({ resumen }).eq('id', pedido.id);

  return {
    pedido: {
      id: pedido.id,
      proyectoId,
      tableroId: tableroId || null,
      nombre: pedido.nombre,
      archivoNombre: pedido.archivo_nombre,
      estado: pedido.estado,
      resumen,
      createdBy: pedido.created_by,
      createdAt: pedido.created_at,
    },
    lineas: resultLineas.map((l) => ({
      id: l.id,
      codigo: l.codigo,
      cantidad: Number(l.cantidad || 0),
      itemId: l.item_id,
      validado: l.validado,
      error: l.error,
      materialId: l.material_id,
      reservado: Number(l.reservado || 0),
      faltante: Number(l.faltante || 0),
    })),
  };
}

export async function listAlertas(filters) {
  if (isDemo()) return pdemo.demoListAlertas(filters);

  const supabase = getSupabase();
  let query = supabase.from('proyecto_alertas').select('*').order('created_at', { ascending: false });
  if (filters?.soloNoLeidas !== false) query = query.eq('leida', false);
  const { data, error } = await query;
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  return (data || []).map((a) => ({
    id: a.id,
    proyectoId: a.proyecto_id,
    tipo: a.tipo,
    severidad: a.severidad,
    mensaje: a.mensaje,
    leida: a.leida,
    meta: a.meta,
    createdAt: a.created_at,
  }));
}

async function loadTableroConProyecto(tableroId) {
  const supabase = getSupabase();
  const { data: tablero, error } = await supabase
    .from('proyecto_tableros')
    .select('*')
    .eq('id', tableroId)
    .maybeSingle();
  if (error) {
    if (schemaMissing(error)) throwSchemaHint(error);
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  if (!tablero) throw Object.assign(new Error('Tablero no encontrado'), { status: 404 });

  const { data: proyecto, error: ep } = await supabase
    .from('proyectos')
    .select('*')
    .eq('id', tablero.proyecto_id)
    .maybeSingle();
  if (ep) throw Object.assign(new Error(ep.message), { status: 500 });
  if (!proyecto) throw Object.assign(new Error('Proyecto no encontrado'), { status: 404 });

  return { tablero, proyecto };
}

async function resolveItemIdFromScan(supabase, { itemId, codigo, scan }) {
  if (itemId) return itemId;

  const raw = String(codigo || scan || '').trim();
  if (!raw) return null;

  // QR interno: item:<uuid> o JSON con itemId
  const uuidMatch = raw.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
  );
  if (uuidMatch) {
    const { data } = await supabase.from('items').select('id').eq('id', uuidMatch[0]).maybeSingle();
    if (data?.id) return data.id;
  }

  const code = raw.toUpperCase();
  const tries = [
    () => supabase.from('items').select('id').eq('codigo_fabricante', code).limit(1),
    () => supabase.from('items').select('id').ilike('codigo_fabricante', code).limit(1),
    () => supabase.from('items').select('id').ilike('nombre', code).limit(1),
  ];
  for (const tryFn of tries) {
    try {
      const { data } = await tryFn();
      if (data?.[0]?.id) return data[0].id;
    } catch {
      /* columna puede no existir */
    }
  }
  return null;
}

async function resolveDestinoProduccion(sede) {
  const ref = getProduccionUbicacion(sede);
  if (!ref?.almacen) {
    throw Object.assign(
      new Error(
        'No hay almacén de producción en esta sede. Reiniciá el backend para que el bootstrap lo cree.'
      ),
      { status: 503 }
    );
  }
  const cont = await resolveUbicacion({
    sede,
    almacen: ref.almacen,
    armario: ref.armario || PROYECTOS_ARMARIO,
    estante: ref.estante || PROYECTOS_ESTANTE,
    contenedor: 'C01',
    skipArmarioCheck: true,
  });
  return { contenedor: cont, ref };
}

async function transferirStockAProduccion(supabase, {
  itemId,
  cantidad,
  stockIdPreferido,
  contenedorIdPreferido,
  destContenedorId,
}) {
  let origen = null;

  if (stockIdPreferido) {
    const { data } = await supabase
      .from('stock')
      .select('id, item_id, contenedor_id, cantidad')
      .eq('id', stockIdPreferido)
      .eq('item_id', itemId)
      .maybeSingle();
    if (data && Number(data.cantidad) >= cantidad) origen = data;
  }

  if (!origen && contenedorIdPreferido) {
    const { data } = await supabase
      .from('stock')
      .select('id, item_id, contenedor_id, cantidad')
      .eq('item_id', itemId)
      .eq('contenedor_id', contenedorIdPreferido)
      .maybeSingle();
    if (data && Number(data.cantidad) >= cantidad) origen = data;
  }

  if (!origen) {
    const { data: rows } = await supabase
      .from('stock')
      .select('id, item_id, contenedor_id, cantidad')
      .eq('item_id', itemId)
      .gt('cantidad', 0)
      .order('cantidad', { ascending: false });
    origen = (rows || []).find(
      (r) => r.contenedor_id !== destContenedorId && Number(r.cantidad) >= cantidad
    );
  }

  if (!origen) {
    throw Object.assign(
      new Error('No hay stock físico suficiente en depósito para entregar a producción'),
      { status: 409 }
    );
  }

  const nuevaOrigen = Number(origen.cantidad) - cantidad;
  if (nuevaOrigen <= 0) {
    const { error: ed } = await supabase.from('stock').delete().eq('id', origen.id);
    if (ed) throw Object.assign(new Error(ed.message), { status: 500 });
  } else {
    const { error: eu } = await supabase
      .from('stock')
      .update({ cantidad: nuevaOrigen, updated_at: new Date().toISOString() })
      .eq('id', origen.id);
    if (eu) throw Object.assign(new Error(eu.message), { status: 500 });
  }

  const { data: destStock, error: edq } = await supabase
    .from('stock')
    .select('id, cantidad')
    .eq('item_id', itemId)
    .eq('contenedor_id', destContenedorId)
    .maybeSingle();
  if (edq) throw Object.assign(new Error(edq.message), { status: 500 });

  if (destStock) {
    const { error: em } = await supabase
      .from('stock')
      .update({
        cantidad: Number(destStock.cantidad) + cantidad,
        updated_at: new Date().toISOString(),
      })
      .eq('id', destStock.id);
    if (em) throw Object.assign(new Error(em.message), { status: 500 });
  } else {
    const { error: ei } = await supabase.from('stock').insert({
      item_id: itemId,
      contenedor_id: destContenedorId,
      cantidad,
    });
    if (ei) throw Object.assign(new Error(ei.message), { status: 500 });
  }

  return {
    origenStockId: origen.id,
    origenContenedorId: origen.contenedor_id,
    destinoContenedorId: destContenedorId,
  };
}

/**
 * Checklist BOM del tablero: pedido vs reservado vs entregado a producción.
 */
export async function getChecklistTablero(tableroId) {
  if (isDemo()) return pdemo.demoGetChecklistTablero(tableroId);

  const { tablero, proyecto } = await loadTableroConProyecto(tableroId);
  const supabase = getSupabase();

  const { data: materiales, error } = await supabase
    .from('proyecto_materiales')
    .select('*')
    .eq('tablero_id', tableroId)
    .order('created_at');
  if (error) throw Object.assign(new Error(error.message), { status: 500 });

  const itemIds = [...new Set((materiales || []).map((m) => m.item_id).filter(Boolean))];
  const itemsById = new Map();
  if (itemIds.length) {
    const { data: items } = await supabase
      .from('items')
      .select('id, nombre, codigo_fabricante')
      .in('id', itemIds);
    for (const it of items || []) itemsById.set(it.id, it);
  }

  const { data: reservasActivas } = await supabase
    .from('proyecto_reservas')
    .select('item_id, cantidad, estado')
    .eq('tablero_id', tableroId)
    .eq('estado', 'activa');

  const reservadoPendiente = new Map();
  for (const r of reservasActivas || []) {
    reservadoPendiente.set(
      r.item_id,
      (reservadoPendiente.get(r.item_id) || 0) + Number(r.cantidad || 0)
    );
  }

  const lineas = (materiales || []).map((m) => {
    const item = itemsById.get(m.item_id);
    const requerido = Number(m.cantidad_requerida || 0);
    const entregado = Number(m.cantidad_entregada || 0);
    const consumido = Number(m.cantidad_consumida || 0);
    const pendienteReserva = Math.max(0, reservadoPendiente.get(m.item_id) || 0);
    const pendienteEntrega = Math.max(0, requerido - entregado);
    return {
      materialId: m.id,
      itemId: m.item_id,
      codigoArticulo: m.codigo_articulo || item?.codigo_fabricante || null,
      descripcion: m.descripcion || item?.nombre || null,
      cantidadRequerida: requerido,
      cantidadReservada: Number(m.cantidad_reservada || 0),
      cantidadEntregada: entregado,
      cantidadConsumida: consumido,
      pendienteReserva,
      pendienteEntrega,
      enProduccion: Math.max(0, entregado - consumido),
      estado: m.estado,
    };
  });

  const resumen = {
    lineas: lineas.length,
    requeridas: lineas.reduce((a, l) => a + l.cantidadRequerida, 0),
    entregadas: lineas.reduce((a, l) => a + l.cantidadEntregada, 0),
    pendientesEntrega: lineas.reduce((a, l) => a + l.pendienteEntrega, 0),
    enProduccion: lineas.reduce((a, l) => a + l.enProduccion, 0),
    completas: lineas.filter((l) => l.pendienteEntrega <= 0).length,
  };

  return {
    tablero: mapTablero(tablero),
    proyecto: mapProyecto(proyecto),
    resumen,
    lineas,
  };
}

/**
 * Escanea / ingresa una pieza a producción del tablero:
 * consume reserva activa → mueve stock físico al ALM producción.
 */
export async function escanearAProduccion(tableroId, payload = {}) {
  if (isDemo()) return pdemo.demoEscanearAProduccion(tableroId, payload);

  const cantidad = Math.max(1, Number(payload.cantidad || 1));
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw Object.assign(new Error('Cantidad inválida'), { status: 400 });
  }

  const { tablero, proyecto } = await loadTableroConProyecto(tableroId);
  if (['completado', 'cancelado'].includes(tablero.estado)) {
    throw Object.assign(
      new Error(`El tablero está ${tablero.estado}; no se puede entregar material`),
      { status: 409 }
    );
  }

  const supabase = getSupabase();
  const itemId = await resolveItemIdFromScan(supabase, payload);
  if (!itemId) {
    throw Object.assign(
      new Error('No se reconoció el ítem. Escaneá QR de artículo o ingresá el MLFB.'),
      { status: 404 }
    );
  }

  const { data: reservas, error: er } = await supabase
    .from('proyecto_reservas')
    .select('*')
    .eq('tablero_id', tableroId)
    .eq('item_id', itemId)
    .eq('estado', 'activa')
    .order('created_at', { ascending: true });
  if (er) throw Object.assign(new Error(er.message), { status: 500 });

  let restante = cantidad;
  const reservasUsadas = [];
  for (const r of reservas || []) {
    const disp = Number(r.cantidad || 0);
    if (disp <= 0) continue;
    const tomar = Math.min(restante, disp);
    reservasUsadas.push({ row: r, tomar });
    restante -= tomar;
    if (restante <= 0) break;
  }

  if (!reservasUsadas.length || restante > 0) {
    throw Object.assign(
      new Error(
        restante === cantidad
          ? 'No hay reserva activa de este ítem para el tablero. Generá el pedido masivo primero.'
          : `Solo hay ${cantidad - restante} unidad(es) reservada(s) pendientes; pediste ${cantidad}.`
      ),
      { status: 409 }
    );
  }

  const { contenedor: destCont, ref: prodRef } = await resolveDestinoProduccion(proyecto.sede);
  const movimientosStock = [];

  for (const { row, tomar } of reservasUsadas) {
    const move = await transferirStockAProduccion(supabase, {
      itemId,
      cantidad: tomar,
      stockIdPreferido: payload.stockId || row.stock_id,
      contenedorIdPreferido: row.contenedor_id,
      destContenedorId: destCont.id,
    });
    movimientosStock.push(move);

    const remanente = Number(row.cantidad) - tomar;
    if (remanente <= 0) {
      const { error: eu } = await supabase
        .from('proyecto_reservas')
        .update({ estado: 'entregada', updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (eu) throw Object.assign(new Error(eu.message), { status: 500 });
    } else {
      const { error: eu } = await supabase
        .from('proyecto_reservas')
        .update({ cantidad: remanente, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (eu) throw Object.assign(new Error(eu.message), { status: 500 });
    }

    if (row.material_id) {
      const { data: mat } = await supabase
        .from('proyecto_materiales')
        .select('*')
        .eq('id', row.material_id)
        .maybeSingle();
      if (mat) {
        const nuevaReservada = Math.max(0, Number(mat.cantidad_reservada || 0) - tomar);
        const nuevaEntregada = Number(mat.cantidad_entregada || 0) + tomar;
        const requerido = Number(mat.cantidad_requerida || 0);
        let estado = mat.estado;
        if (nuevaEntregada >= requerido && requerido > 0) estado = 'completo';
        else if (nuevaEntregada > 0) estado = 'parcial';
        await supabase
          .from('proyecto_materiales')
          .update({
            cantidad_reservada: nuevaReservada,
            cantidad_entregada: nuevaEntregada,
            estado,
            updated_at: new Date().toISOString(),
          })
          .eq('id', mat.id);
      }
    }

    await supabase.from('proyecto_movimientos').insert({
      proyecto_id: proyecto.id,
      tablero_id: tableroId,
      reserva_id: row.id,
      material_id: row.material_id,
      item_id: itemId,
      tipo: 'entrega_produccion',
      cantidad: tomar,
      estado_material: 'Entregado al Taller',
      usuario: payload.usuario || null,
      notas: payload.notas || null,
      meta: {
        origenStockId: move.origenStockId,
        origenContenedorId: move.origenContenedorId,
        destinoContenedorId: move.destinoContenedorId,
        destinoAlmacen: prodRef.almacen,
        scan: payload.scan || payload.codigo || null,
      },
    });
  }

  if (tablero.estado === 'pendiente') {
    await supabase
      .from('proyecto_tableros')
      .update({ estado: 'en_curso', updated_at: new Date().toISOString() })
      .eq('id', tableroId);
  }

  const { data: item } = await supabase
    .from('items')
    .select('id, nombre, codigo_fabricante')
    .eq('id', itemId)
    .maybeSingle();

  const checklist = await getChecklistTablero(tableroId);

  return {
    ok: true,
    cantidad,
    item: item
      ? { id: item.id, nombre: item.nombre, codigoFabricante: item.codigo_fabricante }
      : { id: itemId },
    destino: {
      almacen: prodRef.almacen,
      codigo: destCont.codigo,
      contenedorId: destCont.id,
    },
    reservasConsumidas: reservasUsadas.map(({ row, tomar }) => ({
      reservaId: row.id,
      cantidad: tomar,
    })),
    checklist,
  };
}

/**
 * Al entregar el tablero al cliente: baja el stock del ALM producción
 * (material ya instalado) y marca consumido.
 */
export async function completarProduccionTablero(tableroId, payload = {}) {
  if (isDemo()) return pdemo.demoCompletarProduccionTablero(tableroId, payload);

  const { tablero, proyecto } = await loadTableroConProyecto(tableroId);
  const supabase = getSupabase();
  const { contenedor: destCont, ref: prodRef } = await resolveDestinoProduccion(proyecto.sede);

  const { data: materiales, error } = await supabase
    .from('proyecto_materiales')
    .select('*')
    .eq('tablero_id', tableroId);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });

  const bajadas = [];
  for (const mat of materiales || []) {
    const enProd = Math.max(
      0,
      Number(mat.cantidad_entregada || 0) - Number(mat.cantidad_consumida || 0)
    );
    if (enProd <= 0 || !mat.item_id) continue;

    const { data: stockRow } = await supabase
      .from('stock')
      .select('id, cantidad')
      .eq('item_id', mat.item_id)
      .eq('contenedor_id', destCont.id)
      .maybeSingle();

    if (stockRow) {
      const quitar = Math.min(enProd, Number(stockRow.cantidad || 0));
      const nueva = Number(stockRow.cantidad) - quitar;
      if (nueva <= 0) {
        await supabase.from('stock').delete().eq('id', stockRow.id);
      } else {
        await supabase
          .from('stock')
          .update({ cantidad: nueva, updated_at: new Date().toISOString() })
          .eq('id', stockRow.id);
      }
      bajadas.push({ itemId: mat.item_id, cantidad: quitar });
    } else {
      bajadas.push({ itemId: mat.item_id, cantidad: 0, aviso: 'sin stock en producción' });
    }

    await supabase
      .from('proyecto_materiales')
      .update({
        cantidad_consumida: Number(mat.cantidad_entregada || 0),
        estado: 'completo',
        updated_at: new Date().toISOString(),
      })
      .eq('id', mat.id);
  }

  await supabase
    .from('proyecto_reservas')
    .update({ estado: 'consumida', updated_at: new Date().toISOString() })
    .eq('tablero_id', tableroId)
    .eq('estado', 'entregada');

  const { data: tableroUpd, error: et } = await supabase
    .from('proyecto_tableros')
    .update({ estado: 'completado', updated_at: new Date().toISOString() })
    .eq('id', tableroId)
    .select('*')
    .single();
  if (et) throw Object.assign(new Error(et.message), { status: 500 });

  await supabase.from('proyecto_movimientos').insert({
    proyecto_id: proyecto.id,
    tablero_id: tableroId,
    tipo: 'tablero_entregado',
    estado_material: 'Consumido',
    usuario: payload.usuario || null,
    notas: payload.notas || 'Entrega de tablero — baja de almacén producción',
    meta: { bajadas, almacen: prodRef.almacen, contenedorId: destCont.id },
  });

  return {
    ok: true,
    tablero: mapTablero(tableroUpd),
    bajadas,
    destinoLimpiado: { almacen: prodRef.almacen, codigo: destCont.codigo },
  };
}
