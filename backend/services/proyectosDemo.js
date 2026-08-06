/**
 * Persistencia en memoria para DEMO_MODE del módulo Proyectos.
 * Desacoplado de demoService.js para no alterar el inventario existente.
 */

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `prj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

const db = {
  proyectos: [],
  tableros: [],
  materiales: [],
  reservas: [],
  faltantes: [],
  movimientos: [],
  pedidos: [],
  pedidoLineas: [],
  alertas: [],
};

export function proyectosDemoReset() {
  db.proyectos = [];
  db.tableros = [];
  db.materiales = [];
  db.reservas = [];
  db.faltantes = [];
  db.movimientos = [];
  db.pedidos = [];
  db.pedidoLineas = [];
  db.alertas = [];
}

export function proyectosDemoDb() {
  return db;
}

function mapProyecto(row) {
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

function pushMovimiento(partial) {
  const row = {
    id: uuid(),
    created_at: nowIso(),
    ...partial,
  };
  db.movimientos.unshift(row);
  return row;
}

export async function demoListProyectos({ sede, estado, q } = {}) {
  let rows = [...db.proyectos];
  if (sede) rows = rows.filter((p) => p.sede === sede);
  if (estado) rows = rows.filter((p) => p.estado === estado);
  if (q) {
    const s = String(q).toLowerCase();
    rows = rows.filter(
      (p) =>
        String(p.nombre || '').toLowerCase().includes(s) ||
        String(p.codigo || '').toLowerCase().includes(s)
    );
  }
  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return rows.map((p) => ({
    ...mapProyecto(p),
    tablerosCount: db.tableros.filter((t) => t.proyecto_id === p.id).length,
    faltantesCount: db.faltantes.filter(
      (f) => f.proyecto_id === p.id && f.estado === 'pendiente'
    ).length,
    reservasActivas: db.reservas
      .filter((r) => r.proyecto_id === p.id && r.estado === 'activa')
      .reduce((s, r) => s + Number(r.cantidad || 0), 0),
  }));
}

export async function demoGetProyecto(id) {
  const p = db.proyectos.find((x) => x.id === id);
  if (!p) throw Object.assign(new Error('Proyecto no encontrado'), { status: 404 });
  const tableros = db.tableros.filter((t) => t.proyecto_id === id).map(mapTablero);
  const materiales = db.materiales.filter((m) => m.proyecto_id === id).map(mapMaterial);
  const reservas = db.reservas.filter((r) => r.proyecto_id === id).map(mapReserva);
  const faltantes = db.faltantes.filter((f) => f.proyecto_id === id).map(mapFaltante);
  return {
    proyecto: mapProyecto(p),
    tableros,
    materiales,
    reservas,
    faltantes,
  };
}

export async function demoCreateProyecto(payload) {
  const row = {
    id: uuid(),
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
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  if (!row.nombre) throw Object.assign(new Error('Nombre requerido'), { status: 400 });
  if (!row.sede) throw Object.assign(new Error('Sede requerida'), { status: 400 });
  db.proyectos.unshift(row);
  pushMovimiento({
    proyecto_id: row.id,
    tipo: 'proyecto_creado',
    usuario: payload.createdBy,
    notas: row.nombre,
  });
  return mapProyecto(row);
}

export async function demoUpdateProyecto(id, patch) {
  const row = db.proyectos.find((x) => x.id === id);
  if (!row) throw Object.assign(new Error('Proyecto no encontrado'), { status: 404 });
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
  row.updated_at = nowIso();
  return mapProyecto(row);
}

export async function demoCreateTablero(proyectoId, payload) {
  const p = db.proyectos.find((x) => x.id === proyectoId);
  if (!p) throw Object.assign(new Error('Proyecto no encontrado'), { status: 404 });
  const row = {
    id: uuid(),
    proyecto_id: proyectoId,
    codigo: payload.codigo || null,
    nombre: String(payload.nombre || '').trim(),
    prioridad: payload.prioridad || p.prioridad || 'media',
    estado: payload.estado || 'pendiente',
    fecha_objetivo: payload.fechaObjetivo || null,
    notas: payload.notas || null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  if (!row.nombre) throw Object.assign(new Error('Nombre de tablero requerido'), { status: 400 });
  db.tableros.push(row);
  return mapTablero(row);
}

export async function demoUpdateTablero(id, patch) {
  const row = db.tableros.find((x) => x.id === id);
  if (!row) throw Object.assign(new Error('Tablero no encontrado'), { status: 404 });
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
  row.updated_at = nowIso();
  return mapTablero(row);
}

export async function demoDashboardKpis({ sede } = {}) {
  const proyectos = sede ? db.proyectos.filter((p) => p.sede === sede) : db.proyectos;
  const ids = new Set(proyectos.map((p) => p.id));
  const activos = proyectos.filter((p) => p.estado === 'activo');
  const criticos = activos.filter((p) => p.prioridad === 'critica');
  const faltantes = db.faltantes.filter(
    (f) => ids.has(f.proyecto_id) && (f.estado === 'pendiente' || f.estado === 'parcial')
  );
  const reservas = db.reservas.filter((r) => ids.has(r.proyecto_id) && r.estado === 'activa');
  const alertas = db.alertas.filter((a) => !a.leida && (!a.proyecto_id || ids.has(a.proyecto_id)));

  return {
    totalProyectosActivos: activos.length,
    proyectosCriticos: criticos.length,
    faltantesPendientes: faltantes.length,
    materialesReservados: reservas.reduce((s, r) => s + Number(r.cantidad || 0), 0),
    materialesEnTransito: 0,
    recepcionesPendientes: 0,
    devolucionesPendientes: 0,
    herramientasAsignadas: 0,
    alertasActivas: alertas.length,
  };
}

export async function demoListReservas({ sede, proyectoId, estado = 'activa' } = {}) {
  let rows = [...db.reservas];
  if (estado) rows = rows.filter((r) => r.estado === estado);
  if (proyectoId) rows = rows.filter((r) => r.proyecto_id === proyectoId);
  if (sede) {
    const ids = new Set(db.proyectos.filter((p) => p.sede === sede).map((p) => p.id));
    rows = rows.filter((r) => ids.has(r.proyecto_id));
  }
  return rows.map(mapReserva);
}

export async function demoListFaltantes({ sede, proyectoId, estado } = {}) {
  let rows = [...db.faltantes];
  if (proyectoId) rows = rows.filter((f) => f.proyecto_id === proyectoId);
  if (estado) rows = rows.filter((f) => f.estado === estado);
  else rows = rows.filter((f) => f.estado === 'pendiente' || f.estado === 'parcial');
  if (sede) {
    const ids = new Set(db.proyectos.filter((p) => p.sede === sede).map((p) => p.id));
    rows = rows.filter((f) => ids.has(f.proyecto_id));
  }
  return rows.map(mapFaltante);
}

export async function demoLiberarReserva(id, { usuario, notas } = {}) {
  const row = db.reservas.find((r) => r.id === id);
  if (!row) throw Object.assign(new Error('Reserva no encontrada'), { status: 404 });
  if (row.estado !== 'activa') {
    throw Object.assign(new Error('La reserva no está activa'), { status: 409 });
  }
  row.estado = 'liberada';
  row.updated_at = nowIso();
  if (row.material_id) {
    const mat = db.materiales.find((m) => m.id === row.material_id);
    if (mat) {
      mat.cantidad_reservada = Math.max(0, Number(mat.cantidad_reservada) - Number(row.cantidad));
      mat.updated_at = nowIso();
    }
  }
  pushMovimiento({
    proyecto_id: row.proyecto_id,
    tablero_id: row.tablero_id,
    reserva_id: row.id,
    material_id: row.material_id,
    item_id: row.item_id,
    tipo: 'liberacion',
    cantidad: row.cantidad,
    estado_material: 'Disponible',
    usuario,
    notas,
  });
  return mapReserva(row);
}

export async function demoReasignarReserva(id, { haciaProyectoId, haciaTableroId, usuario, notas } = {}) {
  const row = db.reservas.find((r) => r.id === id);
  if (!row) throw Object.assign(new Error('Reserva no encontrada'), { status: 404 });
  if (row.estado !== 'activa') {
    throw Object.assign(new Error('La reserva no está activa'), { status: 409 });
  }
  const dest = db.proyectos.find((p) => p.id === haciaProyectoId);
  if (!dest) throw Object.assign(new Error('Proyecto destino no encontrado'), { status: 404 });

  const fromProyecto = row.proyecto_id;
  row.estado = 'reasignada';
  row.updated_at = nowIso();

  if (row.material_id) {
    const mat = db.materiales.find((m) => m.id === row.material_id);
    if (mat) {
      mat.cantidad_reservada = Math.max(0, Number(mat.cantidad_reservada) - Number(row.cantidad));
      mat.updated_at = nowIso();
    }
  }

  const nueva = {
    id: uuid(),
    proyecto_id: haciaProyectoId,
    tablero_id: haciaTableroId || null,
    material_id: null,
    item_id: row.item_id,
    stock_id: row.stock_id,
    contenedor_id: row.contenedor_id,
    cantidad: row.cantidad,
    estado: 'activa',
    sede: dest.sede,
    notas: notas || `Reasignada desde ${fromProyecto}`,
    created_by: usuario || null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.reservas.push(nueva);

  pushMovimiento({
    proyecto_id: fromProyecto,
    reserva_id: row.id,
    item_id: row.item_id,
    tipo: 'reasignacion',
    cantidad: row.cantidad,
    desde_proyecto_id: fromProyecto,
    hacia_proyecto_id: haciaProyectoId,
    estado_material: 'Reservado',
    usuario,
    notas,
  });

  return { origen: mapReserva(row), destino: mapReserva(nueva) };
}

/**
 * Pedido masivo: valida códigos contra items demo, crea materiales, reserva lo posible, genera faltantes.
 * stockByItem: Map<itemId, { cantidad, stockId, contenedorId }>
 * itemsByCodigo: Map<codeUpper, item>
 */
export async function demoProcesarPedidoMasivo({
  proyectoId,
  tableroId,
  lineas,
  itemsByCodigo,
  stockByItem,
  usuario,
  archivoNombre,
}) {
  const proyecto = db.proyectos.find((p) => p.id === proyectoId);
  if (!proyecto) throw Object.assign(new Error('Proyecto no encontrado'), { status: 404 });

  const pedido = {
    id: uuid(),
    proyecto_id: proyectoId,
    tablero_id: tableroId || null,
    nombre: `Pedido ${new Date().toLocaleString('es-AR')}`,
    archivo_nombre: archivoNombre || null,
    estado: 'procesado',
    resumen: null,
    created_by: usuario || null,
    created_at: nowIso(),
  };
  db.pedidos.unshift(pedido);

  let ok = 0;
  let invalidos = 0;
  let totalReservado = 0;
  let totalFaltante = 0;
  const resultLineas = [];

  for (const line of lineas || []) {
    const codigo = String(line.codigo || '').trim();
    const cantidad = Number(line.cantidad || 0);
    const item = codigo ? itemsByCodigo.get(codigo.toUpperCase()) : null;
    const pl = {
      id: uuid(),
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
      pl.error = 'Código o cantidad inválidos';
      invalidos += 1;
      db.pedidoLineas.push(pl);
      resultLineas.push(pl);
      continue;
    }
    if (!item) {
      pl.error = 'Artículo no encontrado';
      invalidos += 1;
      db.pedidoLineas.push(pl);
      resultLineas.push(pl);
      continue;
    }

    const stockInfo = stockByItem.get(item.id) || { cantidad: 0 };
    const disponible = Math.max(0, Number(stockInfo.cantidad || 0));
    // Restar reservas activas del mismo item
    const yaReservado = db.reservas
      .filter((r) => r.item_id === item.id && r.estado === 'activa')
      .reduce((s, r) => s + Number(r.cantidad || 0), 0);
    const neto = Math.max(0, disponible - yaReservado);
    const aReservar = Math.min(cantidad, neto);
    const aFaltar = Math.max(0, cantidad - aReservar);

    const mat = {
      id: uuid(),
      proyecto_id: proyectoId,
      tablero_id: tableroId || null,
      item_id: item.id,
      codigo_articulo: codigo,
      descripcion: item.nombre || codigo,
      cantidad_requerida: cantidad,
      cantidad_reservada: aReservar,
      cantidad_faltante: aFaltar,
      cantidad_entregada: 0,
      cantidad_consumida: 0,
      estado: aFaltar === 0 ? 'completo' : aReservar > 0 ? 'parcial' : 'pendiente',
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.materiales.push(mat);
    pl.material_id = mat.id;
    pl.reservado = aReservar;
    pl.faltante = aFaltar;

    if (aReservar > 0) {
      db.reservas.push({
        id: uuid(),
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
        created_at: nowIso(),
        updated_at: nowIso(),
      });
      totalReservado += aReservar;
      pushMovimiento({
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
    }

    if (aFaltar > 0) {
      db.faltantes.push({
        id: uuid(),
        proyecto_id: proyectoId,
        tablero_id: tableroId || null,
        material_id: mat.id,
        item_id: item.id,
        codigo_articulo: codigo,
        cantidad: aFaltar,
        cantidad_cubierta: 0,
        fecha_limite: proyecto.fecha_objetivo || null,
        prioridad: proyecto.prioridad || 'media',
        estado: 'pendiente',
        created_at: nowIso(),
        updated_at: nowIso(),
      });
      totalFaltante += aFaltar;
      pushMovimiento({
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
        db.alertas.unshift({
          id: uuid(),
          proyecto_id: proyectoId,
          tipo: 'faltante_critico',
          severidad: proyecto.prioridad === 'critica' ? 'critical' : 'warning',
          mensaje: `Faltan ${aFaltar} u. de ${codigo} en ${proyecto.nombre}`,
          leida: false,
          meta: { codigo, cantidad: aFaltar },
          created_at: nowIso(),
        });
      }
    }

    ok += 1;
    db.pedidoLineas.push(pl);
    resultLineas.push(pl);
  }

  pedido.resumen = {
    lineas: resultLineas.length,
    validas: ok,
    invalidas: invalidos,
    totalReservado,
    totalFaltante,
  };

  return {
    pedido: {
      id: pedido.id,
      proyectoId,
      tableroId: tableroId || null,
      nombre: pedido.nombre,
      archivoNombre: pedido.archivo_nombre,
      estado: pedido.estado,
      resumen: pedido.resumen,
      createdBy: pedido.created_by,
      createdAt: pedido.created_at,
    },
    lineas: resultLineas.map((l) => ({
      id: l.id,
      codigo: l.codigo,
      cantidad: l.cantidad,
      itemId: l.item_id,
      validado: l.validado,
      error: l.error,
      materialId: l.material_id,
      reservado: l.reservado,
      faltante: l.faltante,
    })),
  };
}

export async function demoListAlertas({ sede, soloNoLeidas = true } = {}) {
  let rows = [...db.alertas];
  if (soloNoLeidas) rows = rows.filter((a) => !a.leida);
  if (sede) {
    const ids = new Set(db.proyectos.filter((p) => p.sede === sede).map((p) => p.id));
    rows = rows.filter((a) => !a.proyecto_id || ids.has(a.proyecto_id));
  }
  return rows.map((a) => ({
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
