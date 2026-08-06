import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';
import * as pdemo from './proyectosDemo.js';
import { countRecepcionesPendientes } from './proyectosRecepcionesService.js';
import {
  countDevolucionesPendientes,
  countHerramientasAsignadas,
} from './proyectosFase3Service.js';

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

  return {
    totalProyectosActivos: activos.length,
    proyectosCriticos: criticos.length,
    faltantesPendientes,
    materialesReservados,
    materialesEnTransito: 0,
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
