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
  devoluciones: [],
  auditorias: [],
  auditoriaLineas: [],
  herramientas: [],
  herramientasEventos: [],
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
  db.devoluciones = [];
  db.auditorias = [];
  db.auditoriaLineas = [];
  db.herramientas = [];
  db.herramientasEventos = [];
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
  const devolPend = db.devoluciones.filter(
    (d) => (!sede || d.sede === sede) && d.estado === 'pendiente'
  );
  const herrAsig = db.herramientas.filter(
    (h) => (!sede || h.sede === sede) && h.estado === 'prestada'
  );

  let materialesEnTransito = 0;
  try {
    const enTransito = await demoListMaterialesEnTransito({ sede });
    materialesEnTransito = enTransito.reduce((s, r) => s + (r.cantidadPendienteTotal || 0), 0);
  } catch {
    materialesEnTransito = 0;
  }

  return {
    totalProyectosActivos: activos.length,
    proyectosCriticos: criticos.length,
    faltantesPendientes: faltantes.length,
    materialesReservados: reservas.reduce((s, r) => s + Number(r.cantidad || 0), 0),
    materialesEnTransito,
    recepcionesPendientes: recepcionesPend.length,
    devolucionesPendientes: devolPend.length,
    herramientasAsignadas: herrAsig.length,
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

export async function demoGetChecklistTablero(tableroId) {
  const tablero = db.tableros.find((t) => t.id === tableroId);
  if (!tablero) throw Object.assign(new Error('Tablero no encontrado'), { status: 404 });
  const proyecto = db.proyectos.find((p) => p.id === tablero.proyecto_id);
  if (!proyecto) throw Object.assign(new Error('Proyecto no encontrado'), { status: 404 });

  const mats = db.materiales.filter((m) => m.tablero_id === tableroId);
  const lineas = mats.map((m) => {
    const pendienteReserva = db.reservas
      .filter((r) => r.tablero_id === tableroId && r.item_id === m.item_id && r.estado === 'activa')
      .reduce((a, r) => a + Number(r.cantidad || 0), 0);
    const requerido = Number(m.cantidad_requerida || 0);
    const entregado = Number(m.cantidad_entregada || 0);
    const consumido = Number(m.cantidad_consumida || 0);
    return {
      materialId: m.id,
      itemId: m.item_id,
      codigoArticulo: m.codigo_articulo,
      descripcion: m.descripcion,
      cantidadRequerida: requerido,
      cantidadReservada: Number(m.cantidad_reservada || 0),
      cantidadEntregada: entregado,
      cantidadConsumida: consumido,
      pendienteReserva,
      pendienteEntrega: Math.max(0, requerido - entregado),
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

export async function demoEscanearAProduccion(tableroId, payload = {}) {
  const cantidad = Math.max(1, Number(payload.cantidad || 1));
  const tablero = db.tableros.find((t) => t.id === tableroId);
  if (!tablero) throw Object.assign(new Error('Tablero no encontrado'), { status: 404 });
  if (['completado', 'cancelado'].includes(tablero.estado)) {
    throw Object.assign(new Error(`El tablero está ${tablero.estado}`), { status: 409 });
  }
  const proyecto = db.proyectos.find((p) => p.id === tablero.proyecto_id);
  const itemId = payload.itemId || null;
  if (!itemId) {
    throw Object.assign(new Error('En demo enviá itemId'), { status: 400 });
  }

  const activas = db.reservas.filter(
    (r) => r.tablero_id === tableroId && r.item_id === itemId && r.estado === 'activa'
  );
  let restante = cantidad;
  const usadas = [];
  for (const r of activas) {
    const tomar = Math.min(restante, Number(r.cantidad || 0));
    if (tomar <= 0) continue;
    usadas.push({ row: r, tomar });
    restante -= tomar;
    if (restante <= 0) break;
  }
  if (!usadas.length || restante > 0) {
    throw Object.assign(new Error('No hay reserva activa suficiente para este ítem'), { status: 409 });
  }

  for (const { row, tomar } of usadas) {
    const rem = Number(row.cantidad) - tomar;
    if (rem <= 0) row.estado = 'entregada';
    else row.cantidad = rem;
    row.updated_at = nowIso();
    if (row.material_id) {
      const mat = db.materiales.find((m) => m.id === row.material_id);
      if (mat) {
        mat.cantidad_reservada = Math.max(0, Number(mat.cantidad_reservada || 0) - tomar);
        mat.cantidad_entregada = Number(mat.cantidad_entregada || 0) + tomar;
        mat.estado =
          mat.cantidad_entregada >= Number(mat.cantidad_requerida || 0) ? 'completo' : 'parcial';
        mat.updated_at = nowIso();
      }
    }
    pushMovimiento({
      proyecto_id: tablero.proyecto_id,
      tablero_id: tableroId,
      reserva_id: row.id,
      material_id: row.material_id,
      item_id: itemId,
      tipo: 'entrega_produccion',
      cantidad: tomar,
      estado_material: 'Entregado al Taller',
      usuario: payload.usuario,
      notas: payload.notas,
    });
  }
  if (tablero.estado === 'pendiente') tablero.estado = 'en_curso';
  const checklist = await demoGetChecklistTablero(tableroId);
  return {
    ok: true,
    cantidad,
    item: { id: itemId },
    destino: { almacen: 'DEMO-PROD', codigo: 'DEMO-PROD-A00-E00-C01' },
    reservasConsumidas: usadas.map(({ row, tomar }) => ({ reservaId: row.id, cantidad: tomar })),
    checklist,
    proyecto: mapProyecto(proyecto),
  };
}

export async function demoCompletarProduccionTablero(tableroId, payload = {}) {
  const tablero = db.tableros.find((t) => t.id === tableroId);
  if (!tablero) throw Object.assign(new Error('Tablero no encontrado'), { status: 404 });
  const bajadas = [];
  for (const mat of db.materiales.filter((m) => m.tablero_id === tableroId)) {
    const enProd = Math.max(
      0,
      Number(mat.cantidad_entregada || 0) - Number(mat.cantidad_consumida || 0)
    );
    if (enProd > 0) bajadas.push({ itemId: mat.item_id, cantidad: enProd });
    mat.cantidad_consumida = Number(mat.cantidad_entregada || 0);
    mat.estado = 'completo';
    mat.updated_at = nowIso();
  }
  for (const r of db.reservas.filter((x) => x.tablero_id === tableroId && x.estado === 'entregada')) {
    r.estado = 'consumida';
    r.updated_at = nowIso();
  }
  tablero.estado = 'completado';
  tablero.updated_at = nowIso();
  pushMovimiento({
    proyecto_id: tablero.proyecto_id,
    tablero_id: tableroId,
    tipo: 'tablero_entregado',
    estado_material: 'Consumido',
    usuario: payload.usuario,
    notas: payload.notas || 'Entrega de tablero',
    meta: { bajadas },
  });
  return {
    ok: true,
    tablero: mapTablero(tablero),
    bajadas,
    destinoLimpiado: { almacen: 'DEMO-PROD', codigo: 'DEMO-PROD' },
  };
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

export async function demoListDevoluciones({ sede, proyectoId, estado } = {}) {
  let rows = [...db.devoluciones];
  if (sede) rows = rows.filter((d) => d.sede === sede);
  if (proyectoId) rows = rows.filter((d) => d.proyecto_id === proyectoId);
  if (estado) rows = rows.filter((d) => d.estado === estado);
  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return rows.map((d) => ({
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
    proyectoNombre: db.proyectos.find((p) => p.id === d.proyecto_id)?.nombre || null,
  }));
}

export async function demoCrearDevolucion(payload) {
  const proyecto = db.proyectos.find((p) => p.id === payload.proyectoId);
  if (!proyecto) throw Object.assign(new Error('Proyecto no encontrado'), { status: 404 });
  const cantidad = Number(payload.cantidad || 0);
  if (cantidad <= 0) throw Object.assign(new Error('Cantidad inválida'), { status: 400 });

  let reserva = null;
  if (payload.reservaId) {
    reserva = db.reservas.find((r) => r.id === payload.reservaId);
    if (!reserva || reserva.estado !== 'activa') {
      throw Object.assign(new Error('Reserva no activa'), { status: 409 });
    }
    if (cantidad > Number(reserva.cantidad)) {
      throw Object.assign(new Error('Cantidad mayor a la reserva'), { status: 400 });
    }
  }

  const row = {
    id: uuid(),
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
    created_at: nowIso(),
  };
  db.devoluciones.unshift(row);

  if (reserva) {
    if (cantidad >= Number(reserva.cantidad)) {
      reserva.estado = 'liberada';
    } else {
      reserva.cantidad = Number(reserva.cantidad) - cantidad;
    }
    reserva.updated_at = nowIso();
    if (reserva.material_id) {
      const mat = db.materiales.find((m) => m.id === reserva.material_id);
      if (mat) {
        mat.cantidad_reservada = Math.max(0, Number(mat.cantidad_reservada) - cantidad);
        mat.updated_at = nowIso();
      }
    }
  }

  pushMovimiento({
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
    cantidad: row.cantidad,
    motivo: row.motivo,
    usuario: row.usuario,
    sede: row.sede,
    estado: row.estado,
    createdAt: row.created_at,
  };
}

export async function demoListAuditorias({ sede, estado } = {}) {
  let rows = [...db.auditorias];
  if (sede) rows = rows.filter((a) => a.sede === sede);
  if (estado) rows = rows.filter((a) => a.estado === estado);
  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return rows.map((a) => ({
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
    lineasCount: db.auditoriaLineas.filter((l) => l.auditoria_id === a.id).length,
  }));
}

export async function demoGetAuditoria(id) {
  const a = db.auditorias.find((x) => x.id === id);
  if (!a) throw Object.assign(new Error('Auditoría no encontrada'), { status: 404 });
  const lineas = db.auditoriaLineas
    .filter((l) => l.auditoria_id === id)
    .map((l) => ({
      id: l.id,
      itemId: l.item_id,
      codigo: l.codigo,
      nombre: l.nombre,
      cantidadSistema: Number(l.cantidad_sistema || 0),
      cantidadFisica: l.cantidad_fisica == null ? null : Number(l.cantidad_fisica),
      diferencia: l.diferencia == null ? null : Number(l.diferencia),
      scannedAt: l.scanned_at,
    }));
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
    lineas,
  };
}

export async function demoCrearAuditoria(payload) {
  if (!payload.sede) throw Object.assign(new Error('Sede requerida'), { status: 400 });
  const row = {
    id: uuid(),
    sede: payload.sede,
    almacen: payload.almacen || null,
    armario: payload.armario || null,
    estante: payload.estante || null,
    contenedor_codigo: payload.contenedorCodigo || null,
    estado: 'abierta',
    operador: payload.operador || null,
    notas: payload.notas || null,
    resumen: null,
    created_at: nowIso(),
    closed_at: null,
  };
  db.auditorias.unshift(row);
  return demoGetAuditoria(row.id);
}

export async function demoAgregarLineaAuditoria(auditoriaId, payload, stockRows = []) {
  const aud = db.auditorias.find((a) => a.id === auditoriaId);
  if (!aud) throw Object.assign(new Error('Auditoría no encontrada'), { status: 404 });
  if (aud.estado !== 'abierta') {
    throw Object.assign(new Error('La auditoría no está abierta'), { status: 409 });
  }

  const codigo = String(payload.codigo || '').trim();
  const cantidadFisica = Number(payload.cantidadFisica);
  if (!codigo || Number.isNaN(cantidadFisica)) {
    throw Object.assign(new Error('Código y cantidad física requeridos'), { status: 400 });
  }

  let match = stockRows.find(
    (s) =>
      String(s.codigoFabricante || '').toUpperCase() === codigo.toUpperCase() ||
      String(s.nombre || '').toUpperCase() === codigo.toUpperCase() ||
      String(s.itemId || '') === codigo
  );
  const cantidadSistema = match ? Number(match.cantidad || 0) : 0;
  const diferencia = cantidadFisica - cantidadSistema;

  const ln = {
    id: uuid(),
    auditoria_id: auditoriaId,
    item_id: match?.itemId || match?.item_id || null,
    codigo,
    nombre: match?.nombre || codigo,
    cantidad_sistema: cantidadSistema,
    cantidad_fisica: cantidadFisica,
    diferencia,
    scanned_at: nowIso(),
  };
  db.auditoriaLineas.push(ln);
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

export async function demoCerrarAuditoria(id) {
  const aud = db.auditorias.find((a) => a.id === id);
  if (!aud) throw Object.assign(new Error('Auditoría no encontrada'), { status: 404 });
  const lineas = db.auditoriaLineas.filter((l) => l.auditoria_id === id);
  const faltantes = lineas.filter((l) => Number(l.diferencia) < 0).length;
  const sobrantes = lineas.filter((l) => Number(l.diferencia) > 0).length;
  const ok = lineas.filter((l) => Number(l.diferencia) === 0).length;
  aud.resumen = { total: lineas.length, faltantes, sobrantes, ok };
  aud.estado = 'cerrada';
  aud.closed_at = nowIso();
  return demoGetAuditoria(id);
}

export async function demoListHerramientas({ sede, estado } = {}) {
  let rows = [...db.herramientas];
  if (sede) rows = rows.filter((h) => h.sede === sede);
  if (estado) rows = rows.filter((h) => h.estado === estado);
  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return rows.map((h) => ({
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

export async function demoAsignarHerramienta(payload) {
  if (!String(payload.operario || '').trim()) {
    throw Object.assign(new Error('Operario requerido'), { status: 400 });
  }
  const row = {
    id: uuid(),
    item_id: payload.itemId || null,
    codigo: payload.codigo || null,
    nombre: payload.nombre || payload.codigo || 'Herramienta',
    operario: String(payload.operario).trim(),
    caja: payload.caja || null,
    sede: payload.sede || null,
    estado: 'prestada',
    fecha_entrega: nowIso(),
    fecha_devolucion: null,
    notas: payload.notas || null,
    created_by: payload.createdBy || null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.herramientas.unshift(row);
  db.herramientasEventos.push({
    id: uuid(),
    asignacion_id: row.id,
    tipo: 'prestada',
    usuario: payload.createdBy || null,
    notas: payload.notas || null,
    created_at: nowIso(),
  });
  return {
    id: row.id,
    itemId: row.item_id,
    codigo: row.codigo,
    nombre: row.nombre,
    operario: row.operario,
    caja: row.caja,
    sede: row.sede,
    estado: row.estado,
    fechaEntrega: row.fecha_entrega,
    fechaDevolucion: row.fecha_devolucion,
    notas: row.notas,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function demoEventoHerramienta(id, { tipo, usuario, notas } = {}) {
  const row = db.herramientas.find((h) => h.id === id);
  if (!row) throw Object.assign(new Error('Asignación no encontrada'), { status: 404 });
  const allowed = ['prestada', 'devuelta', 'perdida', 'rota', 'reemplazada'];
  if (!allowed.includes(tipo)) {
    throw Object.assign(new Error('Tipo de evento inválido'), { status: 400 });
  }
  row.estado = tipo;
  row.updated_at = nowIso();
  if (tipo === 'devuelta') row.fecha_devolucion = nowIso();
  db.herramientasEventos.push({
    id: uuid(),
    asignacion_id: id,
    tipo,
    usuario: usuario || null,
    notas: notas || null,
    created_at: nowIso(),
  });
  return {
    id: row.id,
    itemId: row.item_id,
    codigo: row.codigo,
    nombre: row.nombre,
    operario: row.operario,
    caja: row.caja,
    sede: row.sede,
    estado: row.estado,
    fechaEntrega: row.fecha_entrega,
    fechaDevolucion: row.fecha_devolucion,
    notas: row.notas,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function demoGetHerramienta(id) {
  const row = db.herramientas.find((h) => h.id === id);
  if (!row) throw Object.assign(new Error('Asignación no encontrada'), { status: 404 });
  const eventos = db.herramientasEventos
    .filter((e) => e.asignacion_id === id)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((e) => ({
      id: e.id,
      tipo: e.tipo,
      usuario: e.usuario,
      notas: e.notas,
      createdAt: e.created_at,
    }));
  return {
    asignacion: {
      id: row.id,
      itemId: row.item_id,
      codigo: row.codigo,
      nombre: row.nombre,
      operario: row.operario,
      caja: row.caja,
      sede: row.sede,
      estado: row.estado,
      fechaEntrega: row.fecha_entrega,
      fechaDevolucion: row.fecha_devolucion,
      notas: row.notas,
      createdBy: row.created_by,
      createdAt: row.created_at,
    },
    eventos,
  };
}

export async function demoReporte({ sede, proyectoId, desde, hasta } = {}) {
  let movs = [...db.movimientos];
  if (proyectoId) movs = movs.filter((m) => m.proyecto_id === proyectoId);
  if (sede) {
    const ids = new Set(db.proyectos.filter((p) => p.sede === sede).map((p) => p.id));
    movs = movs.filter((m) => !m.proyecto_id || ids.has(m.proyecto_id));
  }
  if (desde) movs = movs.filter((m) => String(m.created_at) >= desde);
  if (hasta) movs = movs.filter((m) => String(m.created_at) <= hasta + 'T23:59:59');

  const byTipo = {};
  for (const m of movs) {
    byTipo[m.tipo] = (byTipo[m.tipo] || 0) + Number(m.cantidad || 0);
  }

  const proyectos = sede ? db.proyectos.filter((p) => p.sede === sede) : db.proyectos;
  return {
    resumen: {
      movimientos: movs.length,
      reservasActivas: db.reservas.filter((r) => r.estado === 'activa').length,
      faltantesPendientes: db.faltantes.filter((f) => f.estado === 'pendiente' || f.estado === 'parcial').length,
      devoluciones: db.devoluciones.length,
      herramientasPrestadas: db.herramientas.filter((h) => h.estado === 'prestada').length,
      proyectosActivos: proyectos.filter((p) => p.estado === 'activo').length,
    },
    porTipo: byTipo,
    recientes: movs.slice(0, 50).map((m) => ({
      id: m.id,
      tipo: m.tipo,
      cantidad: m.cantidad,
      proyectoId: m.proyecto_id,
      itemId: m.item_id,
      estadoMaterial: m.estado_material,
      usuario: m.usuario,
      notas: m.notas,
      createdAt: m.created_at,
    })),
  };
}

/* ─── Fase 4: disponibles netos / tránsito / recepción ítem a ítem ─── */

function mapLineaDemo(ri) {
  const cantidad = Number(ri.cantidad || 0);
  const recibida = Number(ri.cantidad_recibida || 0);
  return {
    id: ri.id,
    stockId: ri.stock_id,
    itemId: ri.item_id,
    contenedorId: ri.contenedor_id,
    cantidad,
    cantidadRecibida: recibida,
    cantidadPendiente: Math.max(0, cantidad - recibida),
    descripcion: ri.descripcion,
    nombre: ri.nombre,
    codigoFabricante: ri.codigo_fabricante || null,
  };
}

function mapRemitoDemo(r) {
  const items = (r.items || []).map(mapLineaDemo);
  const pendiente = items.reduce((s, l) => s + l.cantidadPendiente, 0);
  const recibido = items.reduce((s, l) => s + l.cantidadRecibida, 0);
  return {
    id: r.id,
    numero: r.numero,
    fecha: r.fecha,
    tipo: r.tipo,
    estado: r.estado,
    almacenOrigen: r.almacen_origen,
    almacenDestino: r.almacen_destino,
    sedeOrigen: null,
    sedeDestino: r.ubicacion_destino?.sede || null,
    ubicacionDestino: r.ubicacion_destino || null,
    creadoPor: r.created_by,
    createdAt: r.created_at,
    recibidoPor: r.recibido_por,
    recibidoAt: r.recibido_at,
    recepcionInforme: r.recepcion_informe || null,
    recepcionAbiertaAt: r.recepcion_abierta_at || null,
    items,
    itemsCount: items.length,
    cantidadPendienteTotal: pendiente,
    cantidadRecibidaTotal: recibido,
    completo: pendiente <= 0 && items.length > 0,
  };
}

export async function demoListDisponiblesNetos(filters = {}) {
  const { demoListInventario } = await import('./demoService.js');
  const inv = await demoListInventario({ sede: filters.sede, q: filters.q });
  const items = Array.isArray(inv) ? inv : inv?.items || [];
  const sede = filters.sede || null;
  let reservas = db.reservas.filter((r) => r.estado === 'activa');
  if (sede) {
    const ids = new Set(db.proyectos.filter((p) => p.sede === sede).map((p) => p.id));
    reservas = reservas.filter((r) => ids.has(r.proyecto_id) || r.sede === sede);
  }
  const reservadoByItem = {};
  for (const r of reservas) {
    if (!r.item_id) continue;
    reservadoByItem[r.item_id] = (reservadoByItem[r.item_id] || 0) + Number(r.cantidad || 0);
  }
  const byItem = {};
  for (const row of items) {
    const id = row.itemId;
    if (!id) continue;
    if (!byItem[id]) {
      byItem[id] = {
        itemId: id,
        nombre: row.nombre,
        marca: row.marca,
        modelo: row.modelo,
        tipo: row.tipo,
        codigoFabricante: row.codigoFabricante || '',
        sede: sede || row.sede || null,
        cantidadFisica: 0,
        cantidadReservada: reservadoByItem[id] || 0,
        ubicaciones: [],
      };
    }
    byItem[id].cantidadFisica += Number(row.cantidad || 0);
    byItem[id].ubicaciones.push({
      stockId: row.stockId || row.id,
      contenedorCodigo: row.contenedorCodigo || row.codigo,
      almacen: row.almacen,
      armario: row.armario,
      estante: row.estante,
      contenedor: row.contenedor,
      cantidad: Number(row.cantidad || 0),
    });
  }
  for (const [itemId, qty] of Object.entries(reservadoByItem)) {
    if (!byItem[itemId]) {
      byItem[itemId] = {
        itemId,
        nombre: null,
        marca: null,
        modelo: null,
        tipo: null,
        codigoFabricante: '',
        sede,
        cantidadFisica: 0,
        cantidadReservada: qty,
        ubicaciones: [],
      };
    } else byItem[itemId].cantidadReservada = qty;
  }
  let list = Object.values(byItem).map((r) => ({
    ...r,
    cantidadDisponibleNeta: Number(r.cantidadFisica) - Number(r.cantidadReservada),
  }));
  if (filters.q) {
    const term = String(filters.q).toLowerCase();
    list = list.filter(
      (r) =>
        String(r.nombre || '').toLowerCase().includes(term) ||
        String(r.codigoFabricante || '').toLowerCase().includes(term)
    );
  }
  list.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  return list;
}

export async function demoListMaterialesEnTransito(filters = {}) {
  const demo = await import('./demoService.js');
  const map = demo.getDemoRemitosMap();
  let list = [];
  for (const r of map.values()) {
    if (r.tipo !== 'transferencia') continue;
    if (!['en_transito', 'parcial'].includes(r.estado)) continue;
    list.push(mapRemitoDemo(r));
  }
  if (filters.estado) list = list.filter((r) => r.estado === filters.estado);
  if (filters.almacenDestino) {
    const alm = String(filters.almacenDestino).toUpperCase();
    list = list.filter((r) => String(r.almacenDestino || '').toUpperCase() === alm);
  }
  return list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function demoListRemitosPendientesCierre(filters = {}) {
  const all = await demoListMaterialesEnTransito(filters);
  return all.filter(
    (r) =>
      r.estado === 'parcial' ||
      (r.estado === 'en_transito' && r.cantidadRecibidaTotal > 0) ||
      (r.recepcionAbiertaAt && !r.completo)
  );
}

export async function demoGetRemitoRecepcion(remitoId) {
  const demo = await import('./demoService.js');
  const remito = demo.demoPeekRemito(remitoId);
  if (!remito) throw Object.assign(new Error('Remito no encontrado'), { status: 404 });
  if (remito.tipo !== 'transferencia') {
    throw Object.assign(new Error('El remito no es una transferencia'), { status: 400 });
  }
  return {
    remito: mapRemitoDemo(remito),
    eventos: remito.recepcion_eventos || [],
  };
}

export async function demoValidarItemRecepcion(remitoId, payload = {}) {
  const demo = await import('./demoService.js');
  return demo.demoValidarItemRecepcionTransferencia(remitoId, payload);
}

export async function demoCerrarRecepcionParcial(remitoId, payload = {}) {
  const demo = await import('./demoService.js');
  return demo.demoCerrarRecepcionParcialTransferencia(remitoId, payload);
}
