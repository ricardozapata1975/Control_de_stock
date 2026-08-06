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
  recepciones: [],
  recepcionLineas: [],
  sugerencias: [],
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
  db.recepciones = [];
  db.recepcionLineas = [];
  db.sugerencias = [];
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
  const recepcionesPend = db.recepciones.filter(
    (r) =>
      (!sede || r.sede === sede) &&
      (r.estado === 'pendiente_asignacion' || r.estado === 'parcial' || r.estado === 'borrador')
  );

  return {
    totalProyectosActivos: activos.length,
    proyectosCriticos: criticos.length,
    faltantesPendientes: faltantes.length,
    materialesReservados: reservas.reduce((s, r) => s + Number(r.cantidad || 0), 0),
    materialesEnTransito: 0,
    recepcionesPendientes: recepcionesPend.length,
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
  };
}

function mapRecepcionLinea(row) {
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

function mapSugerencia(row) {
  const proyecto = db.proyectos.find((p) => p.id === row.proyecto_id);
  const faltante = db.faltantes.find((f) => f.id === row.faltante_id);
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
    proyectoNombre: proyecto?.nombre || null,
    proyectoPrioridad: proyecto?.prioridad || faltante?.prioridad || null,
    codigoArticulo: faltante?.codigo_articulo || null,
    fechaLimite: faltante?.fecha_limite || null,
    createdAt: row.created_at,
  };
}

function buildSugerenciasForLinea(recepcionId, linea, sede) {
  if (!linea.item_id || !linea.validado) return [];
  let restante = Number(linea.cantidad || 0);
  const faltantes = db.faltantes
    .filter(
      (f) =>
        f.item_id === linea.item_id &&
        (f.estado === 'pendiente' || f.estado === 'parcial') &&
        Number(f.cantidad) - Number(f.cantidad_cubierta || 0) > 0
    )
    .filter((f) => {
      const p = db.proyectos.find((x) => x.id === f.proyecto_id);
      return !sede || !p || p.sede === sede;
    })
    .sort((a, b) => {
      const ra = PRIORIDAD_RANK[a.prioridad] ?? 9;
      const rb = PRIORIDAD_RANK[b.prioridad] ?? 9;
      if (ra !== rb) return ra - rb;
      return String(a.fecha_limite || '9999').localeCompare(String(b.fecha_limite || '9999'));
    });

  const created = [];
  for (const f of faltantes) {
    if (restante <= 0) break;
    const pendiente = Number(f.cantidad) - Number(f.cantidad_cubierta || 0);
    const qty = Math.min(restante, pendiente);
    if (qty <= 0) continue;
    const sug = {
      id: uuid(),
      recepcion_id: recepcionId,
      linea_id: linea.id,
      faltante_id: f.id,
      proyecto_id: f.proyecto_id,
      tablero_id: f.tablero_id,
      material_id: f.material_id,
      item_id: f.item_id || linea.item_id,
      cantidad_sugerida: qty,
      estado: 'pendiente',
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.sugerencias.push(sug);
    created.push(sug);
    restante -= qty;

    const proy = db.proyectos.find((p) => p.id === f.proyecto_id);
    if (proy && (proy.prioridad === 'critica' || proy.prioridad === 'alta')) {
      db.alertas.unshift({
        id: uuid(),
        proyecto_id: f.proyecto_id,
        tipo: 'material_recibido',
        severidad: proy.prioridad === 'critica' ? 'critical' : 'warning',
        mensaje: `Material recibido (${linea.codigo_articulo}): se sugieren ${qty} u. para ${proy.nombre}`,
        leida: false,
        meta: { recepcionId, sugerenciaId: sug.id, cantidad: qty },
        created_at: nowIso(),
      });
    }
  }
  return created;
}

function refreshRecepcionEstado(recepcionId) {
  const rec = db.recepciones.find((r) => r.id === recepcionId);
  if (!rec || rec.estado === 'cancelada') return;
  const sugs = db.sugerencias.filter((s) => s.recepcion_id === recepcionId);
  const pend = sugs.filter((s) => s.estado === 'pendiente').length;
  const acept = sugs.filter((s) => s.estado === 'aceptada').length;
  if (!sugs.length || pend === 0) rec.estado = 'cerrada';
  else if (acept > 0) rec.estado = 'parcial';
  else rec.estado = 'pendiente_asignacion';
  rec.updated_at = nowIso();
}

export async function demoListRecepciones({ sede, estado } = {}) {
  let rows = [...db.recepciones];
  if (sede) rows = rows.filter((r) => r.sede === sede);
  if (estado) rows = rows.filter((r) => r.estado === estado);
  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return rows.map((r) => ({
    ...mapRecepcion(r),
    lineasCount: db.recepcionLineas.filter((l) => l.recepcion_id === r.id).length,
    sugerenciasPendientes: db.sugerencias.filter(
      (s) => s.recepcion_id === r.id && s.estado === 'pendiente'
    ).length,
  }));
}

export async function demoGetRecepcion(id) {
  const row = db.recepciones.find((r) => r.id === id);
  if (!row) throw Object.assign(new Error('Recepción no encontrada'), { status: 404 });
  return {
    recepcion: mapRecepcion(row),
    lineas: db.recepcionLineas.filter((l) => l.recepcion_id === id).map(mapRecepcionLinea),
    sugerencias: db.sugerencias.filter((s) => s.recepcion_id === id).map(mapSugerencia),
  };
}

export async function demoCrearRecepcion({
  sede,
  tipo,
  proveedor,
  documento,
  fecha,
  operador,
  notas,
  lineas,
  itemsByCodigo,
}) {
  if (!sede) throw Object.assign(new Error('Sede requerida'), { status: 400 });
  if (!Array.isArray(lineas) || !lineas.length) {
    throw Object.assign(new Error('Se requieren líneas de recepción'), { status: 400 });
  }

  const recepcion = {
    id: uuid(),
    sede,
    tipo: tipo || 'manual',
    proveedor: proveedor || null,
    documento: documento || null,
    fecha: fecha || nowIso().slice(0, 10),
    operador: operador || null,
    estado: 'pendiente_asignacion',
    notas: notas || null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.recepciones.unshift(recepcion);

  const allSugs = [];
  const mappedLineas = [];

  for (const line of lineas) {
    const codigo = String(line.codigo || '').trim();
    const cantidad = Number(line.cantidad || 0);
    const item = codigo ? itemsByCodigo?.get(codigo.toUpperCase()) : null;
    const ln = {
      id: uuid(),
      recepcion_id: recepcion.id,
      item_id: item?.id || null,
      codigo_articulo: codigo || null,
      descripcion: item?.nombre || line.descripcion || null,
      cantidad,
      cantidad_asignada: 0,
      contenedor_id: line.contenedorId || null,
      validado: Boolean(item) && cantidad > 0,
      error: !codigo || cantidad <= 0 ? 'Código o cantidad inválidos' : !item ? 'Artículo no encontrado' : null,
      created_at: nowIso(),
    };
    db.recepcionLineas.push(ln);
    mappedLineas.push(ln);
    if (ln.validado) allSugs.push(...buildSugerenciasForLinea(recepcion.id, ln, sede));
  }

  if (!allSugs.length) {
    recepcion.estado = 'cerrada';
  }

  pushMovimiento({
    tipo: 'recepcion',
    cantidad: mappedLineas.reduce((s, l) => s + Number(l.cantidad || 0), 0),
    estado_material: 'Disponible',
    usuario: operador,
    notas: `Recepción ${documento || recepcion.id}`,
    meta: { recepcion_id: recepcion.id },
  });

  return {
    recepcion: mapRecepcion(recepcion),
    lineas: mappedLineas.map(mapRecepcionLinea),
    sugerencias: allSugs.map(mapSugerencia),
  };
}

export async function demoAceptarSugerencia(id, { usuario } = {}) {
  const sug = db.sugerencias.find((s) => s.id === id);
  if (!sug) throw Object.assign(new Error('Sugerencia no encontrada'), { status: 404 });
  if (sug.estado !== 'pendiente') {
    throw Object.assign(new Error('La sugerencia ya fue resuelta'), { status: 409 });
  }

  const qty = Number(sug.cantidad_sugerida);
  const faltante = db.faltantes.find((f) => f.id === sug.faltante_id);
  const proyecto = db.proyectos.find((p) => p.id === sug.proyecto_id);
  const linea = db.recepcionLineas.find((l) => l.id === sug.linea_id);
  const recepcion = db.recepciones.find((r) => r.id === sug.recepcion_id);

  db.reservas.push({
    id: uuid(),
    proyecto_id: sug.proyecto_id,
    tablero_id: sug.tablero_id,
    material_id: sug.material_id,
    item_id: sug.item_id,
    stock_id: null,
    contenedor_id: linea?.contenedor_id || null,
    cantidad: qty,
    estado: 'activa',
    sede: proyecto?.sede || recepcion?.sede,
    notas: `Asignado desde recepción ${recepcion?.documento || sug.recepcion_id}`,
    created_by: usuario || null,
    created_at: nowIso(),
    updated_at: nowIso(),
  });

  if (sug.material_id) {
    const mat = db.materiales.find((m) => m.id === sug.material_id);
    if (mat) {
      mat.cantidad_reservada = Number(mat.cantidad_reservada || 0) + qty;
      mat.cantidad_faltante = Math.max(0, Number(mat.cantidad_faltante || 0) - qty);
      mat.estado =
        mat.cantidad_faltante === 0 ? 'completo' : mat.cantidad_reservada > 0 ? 'parcial' : 'pendiente';
      mat.updated_at = nowIso();
    }
  }

  if (faltante) {
    faltante.cantidad_cubierta = Number(faltante.cantidad_cubierta || 0) + qty;
    const pend = Number(faltante.cantidad) - Number(faltante.cantidad_cubierta);
    faltante.estado = pend <= 0 ? 'cubierto' : 'parcial';
    faltante.updated_at = nowIso();
  }

  if (linea) linea.cantidad_asignada = Number(linea.cantidad_asignada || 0) + qty;

  sug.estado = 'aceptada';
  sug.updated_at = nowIso();

  pushMovimiento({
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

  refreshRecepcionEstado(sug.recepcion_id);
  return mapSugerencia(sug);
}

export async function demoRechazarSugerencia(id) {
  const sug = db.sugerencias.find((s) => s.id === id);
  if (!sug) throw Object.assign(new Error('Sugerencia no encontrada'), { status: 404 });
  if (sug.estado !== 'pendiente') {
    throw Object.assign(new Error('La sugerencia ya fue resuelta'), { status: 409 });
  }
  sug.estado = 'rechazada';
  sug.updated_at = nowIso();
  refreshRecepcionEstado(sug.recepcion_id);
  return mapSugerencia(sug);
}

export async function demoSugerirPorItems({ itemIds, sede, cantidadPorItem } = {}) {
  const ids = [...new Set((itemIds || []).filter(Boolean))];
  const out = [];
  for (const itemId of ids) {
    const dispon = Number(cantidadPorItem?.get?.(itemId) ?? cantidadPorItem?.[itemId] ?? 0);
    let restante = dispon > 0 ? dispon : Number.POSITIVE_INFINITY;
    const faltantes = db.faltantes
      .filter(
        (f) =>
          f.item_id === itemId &&
          (f.estado === 'pendiente' || f.estado === 'parcial') &&
          Number(f.cantidad) - Number(f.cantidad_cubierta || 0) > 0
      )
      .filter((f) => {
        const p = db.proyectos.find((x) => x.id === f.proyecto_id);
        return !sede || !p || p.sede === sede;
      })
      .sort((a, b) => (PRIORIDAD_RANK[a.prioridad] ?? 9) - (PRIORIDAD_RANK[b.prioridad] ?? 9));

    for (const f of faltantes) {
      if (restante <= 0) break;
      const pend = Number(f.cantidad) - Number(f.cantidad_cubierta || 0);
      const qty = Number.isFinite(restante) ? Math.min(restante, pend) : pend;
      out.push({
        faltanteId: f.id,
        proyectoId: f.proyecto_id,
        tableroId: f.tablero_id,
        materialId: f.material_id,
        itemId,
        codigoArticulo: f.codigo_articulo,
        cantidadSugerida: qty,
        proyectoNombre: db.proyectos.find((p) => p.id === f.proyecto_id)?.nombre || null,
        proyectoPrioridad: f.prioridad,
        fechaLimite: f.fecha_limite,
      });
      if (Number.isFinite(restante)) restante -= qty;
    }
  }
  return out;
}
