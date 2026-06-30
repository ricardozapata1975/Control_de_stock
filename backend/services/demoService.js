/**
 * Almacenamiento local (SQLite) cuando DEMO_MODE=true — misma forma que Supabase.
 */
import { config } from '../config.js';
import { loadInventoryData, saveInventoryData } from '../db/sqlite.js';
import {
  ALMACEN_DEFAULT,
  buildCodigo,
  buildDbId,
  codigoLookupVariants,
  contenedorMatchesParsed,
  getArmarioNombre,
  mapUbicacionFields,
  parseCodigo,
} from './ubicacionUtils.js';
import { mapItemCampos, itemCamposFromCsv, itemPayloadFromBody, parseFechaRelevamiento } from './itemFields.js';

async function load() {
  return loadInventoryData();
}

async function save(data) {
  saveInventoryData(data);
}

function seed() {
  const c1 = {
    id: buildDbId('A01-E01-C01'),
    codigo: 'A01-E01-C01',
    almacen: ALMACEN_DEFAULT,
    armario: 'A01',
    estante: 'E01',
    contenedor: 'C01',
    ubicacion: getArmarioNombre('A01', ALMACEN_DEFAULT),
  };
  const c2 = {
    id: buildDbId('A01-E02-C03'),
    codigo: 'A01-E02-C03',
    almacen: ALMACEN_DEFAULT,
    armario: 'A01',
    estante: 'E02',
    contenedor: 'C03',
    ubicacion: getArmarioNombre('A01', ALMACEN_DEFAULT),
  };
  const c3 = {
    id: buildDbId('A02-E01-C02'),
    codigo: 'A02-E01-C02',
    almacen: ALMACEN_DEFAULT,
    armario: 'A02',
    estante: 'E01',
    contenedor: 'C02',
    ubicacion: getArmarioNombre('A02', ALMACEN_DEFAULT),
  };
  const c4 = {
    id: buildDbId('A00-E03'),
    codigo: 'A00-E03',
    almacen: ALMACEN_DEFAULT,
    armario: 'A00',
    estante: 'E03',
    contenedor: null,
    ubicacion: getArmarioNombre('A00', ALMACEN_DEFAULT),
  };

  const i1 = {
    id: 'item-llave',
    nombre: 'Llave allen 10mm',
    marca: 'Stanley',
    modelo: 'SA10',
    tipo: 'Herramienta',
    detalle: 'Juego métrico',
    calibracion: 'No aplica',
    comentario: 'Set métrico color azul',
    fecha_relevamiento: '2026-01-15',
    activo: true,
  };
  const i2 = {
    id: 'item-multimetro',
    nombre: 'Multímetro digital',
    marca: 'Fluke',
    modelo: '115',
    tipo: 'Medición',
    detalle: 'Uso eléctrico',
    calibracion: 'Sí - vigente hasta 2026-08',
    comentario: 'Funda amarilla',
    fecha_relevamiento: '2026-02-01',
    activo: true,
  };
  const i3 = {
    id: 'item-taladro',
    nombre: 'Taladro percutor',
    marca: 'Bosch',
    modelo: 'GSB 13',
    tipo: 'Eléctrica',
    detalle: '220V',
    calibracion: 'No aplica',
    comentario: 'Mango ergonómico verde',
    fecha_relevamiento: '2026-02-10',
    activo: true,
  };

  return {
    contenedores: [c1, c2, c3, c4],
    items: [i1, i2, i3],
    stock: [
      { id: 'stk-1', item_id: i1.id, contenedor_id: c1.id, cantidad: 8 },
      { id: 'stk-2', item_id: i2.id, contenedor_id: c2.id, cantidad: 2 },
      { id: 'stk-3', item_id: i3.id, contenedor_id: c3.id, cantidad: 1 },
    ],
    movimientos: [],
  };
}

function isItemActivo(item) {
  return item?.activo !== false;
}

function mapStockRow(db, s) {
  const item = db.items.find((i) => i.id === s.item_id);
  if (!isItemActivo(item)) return null;
  const cont = db.contenedores.find((c) => c.id === s.contenedor_id);
  const ubi = mapUbicacionFields(cont);
  return {
    id: s.id,
    stockId: s.id,
    itemId: s.item_id,
    contenedorId: s.contenedor_id,
    contenedorCodigo: cont?.codigo,
    ...ubi,
    nombre: item?.nombre,
    marca: item?.marca,
    modelo: item?.modelo,
    tipo: item?.tipo,
    detalle: item?.detalle,
    ...mapItemCampos(item),
    cantidad: s.cantidad,
    codigo: cont?.codigo,
  };
}

export async function demoListInventario(filters = {}) {
  const db = await load();
  let items = db.stock.map((s) => mapStockRow(db, s)).filter(Boolean);

  if (filters.q) {
    const t = filters.q.toLowerCase();
    items = items.filter(
      (i) =>
        i.nombre?.toLowerCase().includes(t) ||
        i.tipo?.toLowerCase().includes(t) ||
        i.comentario?.toLowerCase().includes(t) ||
        i.calibracion?.toLowerCase().includes(t) ||
        i.ubicacion?.toLowerCase().includes(t)
    );
  }
  if (filters.codigo) {
    const parsed = parseCodigo(filters.codigo);
    if (parsed?.almacen && !parsed.armario) {
      items = items.filter((i) => i.almacen === parsed.almacen);
    } else if (parsed?.armario && !parsed.estante) {
      items = items.filter((i) => i.armario === parsed.armario);
      if (parsed.almacen) items = items.filter((i) => i.almacen === parsed.almacen);
    } else if (parsed?.estante && !parsed.contenedor) {
      items = items.filter(
        (i) => i.armario === parsed.armario && i.estante === parsed.estante
      );
      if (parsed.almacen) items = items.filter((i) => i.almacen === parsed.almacen);
    } else if (parsed?.codigo) {
      const variants = new Set(codigoLookupVariants(parsed));
      items = items.filter((i) => variants.has(i.contenedorCodigo));
    }
  } else {
    if (filters.almacen) items = items.filter((i) => i.almacen === filters.almacen);
    if (filters.ubicacion) items = items.filter((i) => i.ubicacion === filters.ubicacion);
    if (filters.armario) {
      items = items.filter((i) => i.armario === filters.armario);
      if (filters.almacen) items = items.filter((i) => i.almacen === filters.almacen);
    }
  }
  if (filters.tipo) items = items.filter((i) => i.tipo === filters.tipo);

  const lowStock = items.filter((i) => Number(i.cantidad) === 0);
  return { items, total: items.length, lowStock, lowStockThreshold: config.lowStockThreshold };
}

export async function demoGetContenedor(codigo) {
  const db = await load();
  const parsed = parseCodigo(codigo);
  const normalized = parsed?.codigo || codigo.toUpperCase();

  if (parsed?.almacen && !parsed.armario) {
    const items = db.stock
      .map((s) => mapStockRow(db, s))
      .filter((i) => i && i.almacen === parsed.almacen);
    const cont = {
      id: `alm-${parsed.almacen}`,
      codigo: parsed.almacen,
      almacen: parsed.almacen,
      armario: null,
      estante: null,
      contenedor: null,
      ubicacion: parsed.almacen,
    };
    return {
      contenedor: {
        ...mapUbicacionFields(cont),
        itemCount: items.length,
        totalStock: items.reduce((sum, i) => sum + i.cantidad, 0),
      },
      items,
      total: items.length,
    };
  }

  if (parsed?.armario && !parsed.estante) {
    const items = db.stock
      .map((s) => mapStockRow(db, s))
      .filter(
        (i) =>
          i &&
          i.armario === parsed.armario &&
          (!parsed.almacen || i.almacen === parsed.almacen)
      );
    const cont = {
      id: `arm-${parsed.almacen || 'alm01'}-${parsed.armario}`,
      codigo: parsed.codigo,
      almacen: parsed.almacen,
      armario: parsed.armario,
      estante: null,
      contenedor: null,
      ubicacion: getArmarioNombre(parsed.armario, parsed.almacen || ALMACEN_DEFAULT),
    };
    return {
      contenedor: {
        ...mapUbicacionFields(cont),
        itemCount: items.length,
        totalStock: items.reduce((sum, i) => sum + i.cantidad, 0),
      },
      items,
      total: items.length,
    };
  }

  const variants = codigoLookupVariants(parsed);
  let cont = db.contenedores.find((c) => variants.includes(c.codigo) && contenedorMatchesParsed(c, parsed));
  if (!cont && parsed) {
    cont = await demoResolveUbicacion({ codigo: normalized });
  }
  if (!cont) throw Object.assign(new Error('Ubicación no encontrada'), { status: 404 });

  let items;
  if (parsed?.estante && !parsed.contenedor) {
    items = db.stock
      .map((s) => mapStockRow(db, s))
      .filter(
        (i) =>
          i &&
          i.armario === parsed.armario &&
          i.estante === parsed.estante &&
          (!parsed.almacen || i.almacen === parsed.almacen)
      );
  } else {
    items = db.stock
      .filter((s) => s.contenedor_id === cont.id)
      .map((s) => mapStockRow(db, s))
      .filter(Boolean);
  }

  return {
    contenedor: {
      id: cont.id,
      codigo: cont.codigo,
      ...mapUbicacionFields(cont),
      itemCount: items.length,
      totalStock: items.reduce((sum, i) => sum + i.cantidad, 0),
    },
    items,
    total: items.length,
  };
}

export async function demoListContenedores() {
  const db = await load();
  const { items } = await demoListInventario();
  return db.contenedores.map((c) => {
    const related = items.filter((i) => i.contenedorId === c.id);
    return {
      id: c.id,
      codigo: c.codigo,
      ...mapUbicacionFields(c),
      itemCount: related.length,
      totalStock: related.reduce((s, i) => s + i.cantidad, 0),
    };
  });
}

export async function demoListMovimientos(filters = {}) {
  const db = await load();
  const ingresoByEgreso = new Map(
    db.movimientos
      .filter((m) => m.tipo === 'ingreso' && m.egreso_movimiento_id)
      .map((m) => [m.egreso_movimiento_id, m])
  );

  let movs = db.movimientos.filter((m) => m.tipo === 'egreso');
  movs.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  if (filters.usuario) {
    const u = filters.usuario.toLowerCase();
    movs = movs.filter((m) => m.usuario.toLowerCase().includes(u));
  }
  if (filters.pendiente === true || filters.pendiente === 'true') {
    movs = movs.filter((m) => {
      const estado = m.estado || 'prestamo';
      return estado === 'prestamo' && !ingresoByEgreso.has(m.id);
    });
  }

  return movs.map((m) => demoMapMovimiento(db, m, ingresoByEgreso.get(m.id)));
}

function computeEstadoHistorial(m, ingreso) {
  const estado = m.estado || 'prestamo';
  if (estado === 'vendido') return 'vendido';
  if (estado === 'consumido') return 'consumido';
  if (ingreso) return 'completado';
  return 'pendiente_devolucion';
}

function demoMapMovimiento(db, m, ingreso = null) {
  const item = db.items.find((i) => i.id === m.item_id);
  const cont = db.contenedores.find((c) => c.id === m.contenedor_id);
  const estadoHistorial = computeEstadoHistorial(m, ingreso);
  return {
    id: m.id,
    itemId: m.item_id,
    contenedorId: m.contenedor_id,
    tipo: m.tipo,
    cantidad: m.cantidad,
    usuario: m.usuario,
    nombrePersonal: m.usuario,
    fecha: m.fecha,
    fechaEgreso: m.fecha?.slice(0, 10),
    fechaIngreso: ingreso?.fecha?.slice(0, 10) || null,
    nombreHerramienta: item?.nombre,
    ...mapUbicacionFields(cont),
    contenedorCodigo: cont?.codigo,
    pendiente: estadoHistorial === 'pendiente_devolucion',
    estado: m.estado || null,
    motivo: m.motivo || null,
    remitoId: m.remito_id || null,
    estadoHistorial,
  };
}

export async function demoRegistrarEgreso({ itemId, contenedorId, cantidad, usuario, offlineId }) {
  if (!itemId || !contenedorId || !usuario?.trim()) {
    throw Object.assign(new Error('Faltan itemId, contenedorId o usuario'), { status: 400 });
  }
  const qty = Number(cantidad);
  if (!qty || qty <= 0) throw Object.assign(new Error('Cantidad inválida'), { status: 400 });

  const db = await load();
  const stock = db.stock.find((s) => s.item_id === itemId && s.contenedor_id === contenedorId);
  if (!stock) throw Object.assign(new Error('Stock no encontrado'), { status: 404 });
  if (stock.cantidad < qty) {
    throw Object.assign(new Error(`Stock insuficiente. Disponible: ${stock.cantidad}`), { status: 409 });
  }

  if (offlineId && db.movimientos.some((m) => m.offline_id === offlineId)) {
    return { ok: true, duplicate: true };
  }

  stock.cantidad -= qty;
  const item = db.items.find((i) => i.id === itemId);
  const tipoItem = String(item?.tipo || '').toLowerCase();
  const estado = tipoItem === 'consumible' ? 'consumido' : 'prestamo';
  const motivo = estado === 'consumido' ? 'Consumible' : null;

  const mov = {
    id: `mov-${Date.now()}`,
    item_id: itemId,
    contenedor_id: contenedorId,
    tipo: 'egreso',
    cantidad: qty,
    usuario: usuario.trim(),
    fecha: new Date().toISOString(),
    offline_id: offlineId || null,
    estado,
    motivo,
    remito_id: null,
  };
  db.movimientos.push(mov);
  await save(db);
  return { ok: true, movimiento_id: mov.id, stock_restante: stock.cantidad };
}

export async function demoRegistrarIngreso({ movimientoId, egresoMovimientoId, usuario, offlineId }) {
  const egresoId = egresoMovimientoId || movimientoId;
  const db = await load();
  const egreso = db.movimientos.find((m) => m.id === egresoId && m.tipo === 'egreso');
  if (!egreso) throw Object.assign(new Error('Egreso no encontrado'), { status: 404 });
  if (db.movimientos.some((m) => m.tipo === 'ingreso' && m.egreso_movimiento_id === egresoId)) {
    throw Object.assign(new Error('Este egreso ya fue devuelto'), { status: 409 });
  }

  const stock = db.stock.find(
    (s) => s.item_id === egreso.item_id && s.contenedor_id === egreso.contenedor_id
  );
  if (!stock) throw Object.assign(new Error('Stock no encontrado'), { status: 404 });

  stock.cantidad += egreso.cantidad;
  db.movimientos.push({
    id: `mov-${Date.now()}`,
    item_id: egreso.item_id,
    contenedor_id: egreso.contenedor_id,
    tipo: 'ingreso',
    cantidad: egreso.cantidad,
    usuario: usuario || 'Sistema',
    fecha: new Date().toISOString(),
    egreso_movimiento_id: egresoId,
    offline_id: offlineId || null,
  });
  await save(db);
  return { ok: true };
}

export function isDemoMode() {
  return config.demoMode;
}

export async function demoLoadRaw() {
  return load();
}

export async function demoSaveRaw(db) {
  return save(db);
}

export async function demoResetInventario() {
  await save({ contenedores: [], items: [], stock: [], movimientos: [] });
}

export function demoResolveUbicacionInMemory(db, { almacen, armario, estante, contenedor, codigo }) {
  let parsed = codigo ? parseCodigo(codigo) : null;
  if (!parsed && armario && estante) {
    parsed = {
      almacen: almacen || ALMACEN_DEFAULT,
      armario,
      estante,
      contenedor: contenedor ?? null,
      codigo: almacen
        ? buildCodigo(almacen, armario, estante, contenedor)
        : buildCodigo(armario, estante, contenedor),
    };
  }
  if (!parsed) throw Object.assign(new Error('Ubicación inválida'), { status: 400 });

  const variants = codigoLookupVariants(parsed);
  let cont = db.contenedores.find((c) => variants.includes(c.codigo) && contenedorMatchesParsed(c, parsed));
  if (!cont) {
    cont = {
      id: buildDbId(parsed.codigo),
      codigo: parsed.codigo,
      almacen: parsed.almacen || ALMACEN_DEFAULT,
      armario: parsed.armario,
      estante: parsed.estante,
      contenedor: parsed.contenedor,
      ubicacion: getArmarioNombre(parsed.armario, parsed.almacen || ALMACEN_DEFAULT),
    };
    db.contenedores.push(cont);
  }
  return cont;
}

function newItemId(nombre) {
  const base = String(nombre || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 24);
  return `item-${base}-${Date.now().toString(36)}`;
}

export async function demoListItemsAdmin() {
  const db = await load();
  return db.items.map((item) => {
    const rows = db.stock.filter((s) => s.item_id === item.id);
    const totalStock = rows.reduce((sum, s) => sum + s.cantidad, 0);
    return {
      id: item.id,
      nombre: item.nombre,
      marca: item.marca,
      modelo: item.modelo,
      tipo: item.tipo,
      detalle: item.detalle,
      ...mapItemCampos(item),
      activo: item.activo !== false,
      totalStock,
      ubicaciones: rows.map((s) => {
        const c = db.contenedores.find((x) => x.id === s.contenedor_id);
        return {
          stockId: s.id,
          contenedorId: s.contenedor_id,
          contenedorCodigo: c?.codigo,
          cantidad: s.cantidad,
          ...mapUbicacionFields(c),
        };
      }),
    };
  });
}

export async function demoResolveUbicacion({ almacen, armario, estante, contenedor, codigo }) {
  const db = await load();
  let parsed = codigo ? parseCodigo(codigo) : null;
  if (!parsed && armario && estante) {
    parsed = {
      almacen: almacen || ALMACEN_DEFAULT,
      armario,
      estante,
      contenedor: contenedor ?? null,
      codigo: almacen
        ? buildCodigo(almacen, armario, estante, contenedor)
        : buildCodigo(armario, estante, contenedor),
    };
  }
  if (!parsed) throw Object.assign(new Error('Ubicación inválida'), { status: 400 });

  const variants = codigoLookupVariants(parsed);
  let cont = db.contenedores.find((c) => variants.includes(c.codigo) && contenedorMatchesParsed(c, parsed));
  if (!cont) {
    cont = {
      id: buildDbId(parsed.codigo),
      codigo: parsed.codigo,
      almacen: parsed.almacen || ALMACEN_DEFAULT,
      armario: parsed.armario,
      estante: parsed.estante,
      contenedor: parsed.contenedor,
      ubicacion: getArmarioNombre(parsed.armario, parsed.almacen || ALMACEN_DEFAULT),
    };
    db.contenedores.push(cont);
    await save(db);
  }
  return cont;
}

export async function demoAltaStock(payload) {
  const {
    modo,
    itemId,
    nombre,
    marca,
    modelo,
    tipo,
    detalle,
    calibracion,
    comentario,
    fecha_relevamiento,
    contenedorId,
    armario,
    estante,
    contenedor,
    cantidad,
    adminName,
  } = payload;
  const db = await load();
  let cont;
  if (contenedorId) {
    cont = db.contenedores.find((c) => c.id === contenedorId);
    if (!cont) throw Object.assign(new Error('Ubicación no encontrada'), { status: 404 });
  } else {
    cont = await demoResolveUbicacion({ armario, estante, contenedor });
  }

  let resolvedItemId = itemId;

  if (modo === 'nuevo' || !itemId) {
    if (!nombre?.trim()) throw Object.assign(new Error('El nombre del ítem es obligatorio'), { status: 400 });
    const item = {
      id: newItemId(nombre),
      nombre: nombre.trim(),
      marca: marca?.trim() || '',
      modelo: modelo?.trim() || '',
      tipo: tipo?.trim() || '',
      detalle: detalle?.trim() || '',
      calibracion: calibracion?.trim() || '',
      comentario: comentario?.trim() || '',
      fecha_relevamiento: parseFechaRelevamiento(fecha_relevamiento),
      activo: true,
    };
    db.items.push(item);
    resolvedItemId = item.id;
  } else {
    const item = db.items.find((i) => i.id === itemId);
    if (!item) throw Object.assign(new Error('Ítem no encontrado'), { status: 404 });
    if (!isItemActivo(item)) throw Object.assign(new Error('El ítem está dado de baja'), { status: 409 });
    resolvedItemId = item.id;
  }

  let stock = db.stock.find((s) => s.item_id === resolvedItemId && s.contenedor_id === cont.id);
  if (stock) {
    stock.cantidad += cantidad;
  } else {
    stock = {
      id: `stk-${Date.now().toString(36)}`,
      item_id: resolvedItemId,
      contenedor_id: cont.id,
      cantidad,
    };
    db.stock.push(stock);
  }

  await save(db);
  return {
    ok: true,
    itemId: resolvedItemId,
    cantidadAgregada: cantidad,
    codigoUbicacion: cont.codigo,
    registradoPor: adminName,
  };
}

export async function demoUpdateItem(itemId, body) {
  const db = await load();
  const item = db.items.find((i) => i.id === itemId);
  if (!item) throw Object.assign(new Error('Ítem no encontrado'), { status: 404 });
  if (!isItemActivo(item)) throw Object.assign(new Error('El ítem está dado de baja'), { status: 409 });

  const { stockId, cantidad, armario, estante, contenedor, ...itemBody } = body;
  const hasStockUpdate =
    stockId !== undefined ||
    cantidad !== undefined ||
    armario !== undefined ||
    estante !== undefined ||
    contenedor !== undefined;

  const itemFieldKeys = [
    'nombre',
    'marca',
    'modelo',
    'tipo',
    'detalle',
    'calibracion',
    'comentario',
    'fechaRelevamiento',
    'fecha_relevamiento',
  ];
  const hasItemUpdate = itemFieldKeys.some((k) => itemBody[k] !== undefined);

  if (hasItemUpdate) {
    const payload = itemPayloadFromBody({ ...item, ...itemBody, nombre: itemBody.nombre ?? item.nombre });
    if (!payload.nombre) throw Object.assign(new Error('El nombre es obligatorio'), { status: 400 });
    Object.assign(item, payload);
  }

  if (hasStockUpdate) {
    if (!stockId) {
      throw Object.assign(new Error('stockId requerido para editar ubicación/cantidad'), { status: 400 });
    }
    const qty = Number(cantidad);
    if (Number.isNaN(qty) || qty < 0) {
      throw Object.assign(new Error('Cantidad inválida'), { status: 400 });
    }

    const stockRow = db.stock.find((s) => s.id === stockId && s.item_id === itemId);
    if (!stockRow) throw Object.assign(new Error('Registro de stock no encontrado'), { status: 404 });

    let targetContenedorId = stockRow.contenedor_id;
    if (armario && estante) {
      const cont = await demoResolveUbicacion({ armario, estante, contenedor });
      targetContenedorId = cont.id;
    }

    if (targetContenedorId === stockRow.contenedor_id) {
      if (qty === 0) {
        db.stock = db.stock.filter((s) => s.id !== stockId);
      } else {
        stockRow.cantidad = qty;
      }
    } else if (qty === 0) {
      db.stock = db.stock.filter((s) => s.id !== stockId);
    } else {
      const destStock = db.stock.find(
        (s) => s.item_id === itemId && s.contenedor_id === targetContenedorId
      );
      if (destStock) {
        destStock.cantidad += qty;
        db.stock = db.stock.filter((s) => s.id !== stockId);
      } else {
        stockRow.contenedor_id = targetContenedorId;
        stockRow.cantidad = qty;
      }
    }
  }

  if (!hasItemUpdate && !hasStockUpdate) {
    throw Object.assign(new Error('No hay campos para actualizar'), { status: 400 });
  }

  await save(db);
  return { ok: true, item: { id: item.id, ...mapItemCampos(item), nombre: item.nombre } };
}

export async function demoBajaItem(itemId, adminName) {
  const db = await load();
  const item = db.items.find((i) => i.id === itemId);
  if (!item) throw Object.assign(new Error('Ítem no encontrado'), { status: 404 });
  if (!isItemActivo(item)) throw Object.assign(new Error('El ítem ya está dado de baja'), { status: 409 });

  const ingresoRefs = new Set(
    db.movimientos.filter((m) => m.tipo === 'ingreso').map((m) => m.egreso_movimiento_id)
  );
  const pendiente = db.movimientos.some(
    (m) => m.tipo === 'egreso' && m.item_id === itemId && !ingresoRefs.has(m.id)
  );
  if (pendiente) {
    throw Object.assign(
      new Error('No se puede dar de baja: hay egresos pendientes de devolución'),
      { status: 409 }
    );
  }

  item.activo = false;
  await save(db);
  return { ok: true, itemId, registradoPor: adminName };
}

const DEMO_EMPRESAS = [
  {
    id: 'demo-systelec',
    nombre: 'SYSTELEC S.A.',
    razonSocial: 'SYSTELEC S.A.',
    cuit: '30-68479873-8',
    ingBrutos: '901-68479873-8',
    domicilio: '26 de Julio 5450',
    localidad: 'Villa Ballester (1653) — San Martín, Buenos Aires',
    telefono: '(011) 4768-7677',
    fax: '(011) 4768-7677',
    email: 'contacto@systelec.com.ar',
    web: 'www.systelec.com.ar',
    fechaInicioActividades: '1996-08-02',
    codigoDocumento: '91',
    activo: true,
  },
  {
    id: 'demo-pxcontrol',
    nombre: 'PX Control',
    razonSocial: 'PX Control S.A.',
    cuit: '30-00000000-0',
    ingBrutos: '000-00000000-0',
    domicilio: '26 de Julio 5450',
    localidad: 'Villa Ballester, Buenos Aires',
    telefono: '(011) 0000-0000',
    fax: '',
    email: 'info@pxcontrol.com.ar',
    web: 'www.pxcontrol.com.ar',
    fechaInicioActividades: '2020-01-01',
    codigoDocumento: '91',
    activo: true,
  },
  {
    id: 'demo-talemec',
    nombre: 'Talemec',
    razonSocial: 'Talemec S.A.',
    cuit: '30-00000001-1',
    ingBrutos: '000-00000001-1',
    domicilio: 'Domicilio a completar',
    localidad: 'Buenos Aires',
    telefono: '(011) 0000-0001',
    fax: '',
    email: 'info@talemec.com.ar',
    web: 'www.talemec.com.ar',
    fechaInicioActividades: '2020-01-01',
    codigoDocumento: '91',
    activo: true,
  },
];

const demoClientes = [];
const demoRemitos = new Map();

export async function demoListEmpresasEmisoras() {
  return DEMO_EMPRESAS;
}

export async function demoGetEmpresaEmisoraById(id) {
  return DEMO_EMPRESAS.find((e) => e.id === id) || null;
}

export async function demoGetNextRemitoNumero(empresaEmisoraId) {
  let max = 0;
  for (const r of demoRemitos.values()) {
    if (r.empresa_emisora_id === empresaEmisoraId && r.numero > max) {
      max = r.numero;
    }
  }
  return max + 1;
}

export async function demoSearchClientes(q = '') {
  const term = String(q || '').trim().toLowerCase();
  if (!term) return demoClientes.slice(0, 20);
  return demoClientes.filter((c) => c.nombre.toLowerCase().includes(term)).slice(0, 20);
}

export async function demoGetClienteById(id) {
  return demoClientes.find((c) => c.id === id) || null;
}

export async function demoCreateCliente(payload) {
  const nombre = String(payload?.nombre || '').trim();
  if (!nombre) throw Object.assign(new Error('Nombre del cliente requerido'), { status: 400 });
  const cliente = {
    id: `demo-cli-${Date.now()}`,
    nombre,
    razonSocial: payload.razonSocial || payload.razon_social || nombre,
    iva: payload.iva || '',
    domicilio: payload.domicilio || '',
    localidad: payload.localidad || '',
    vRef: payload.vRef || payload.v_ref || '',
    cuit: payload.cuit || '',
  };
  demoClientes.push(cliente);
  return cliente;
}

export async function demoCrearRemito(payload, createdBy) {
  const {
    numero,
    fecha,
    empresaEmisoraId,
    cliente,
    cantBultos,
    transportista,
    transportistaCuit,
    transportistaDomicilio,
    aclaracion,
    dni,
    items,
  } = payload;

  if (!empresaEmisoraId) {
    throw Object.assign(new Error('Empresa emisora requerida'), { status: 400 });
  }
  if (!items?.length) {
    throw Object.assign(new Error('El remito debe tener al menos un ítem'), { status: 400 });
  }

  const db = await load();
  let clienteId = cliente?.id;

  if (clienteId) {
    const existing = demoClientes.find((c) => c.id === clienteId);
    if (!existing) throw Object.assign(new Error('Cliente no encontrado'), { status: 404 });
    Object.assign(existing, {
      nombre: cliente.nombre || existing.nombre,
      iva: cliente.iva ?? existing.iva,
      domicilio: cliente.domicilio ?? existing.domicilio,
      localidad: cliente.localidad ?? existing.localidad,
      vRef: cliente.v_ref ?? cliente.vRef ?? existing.vRef,
      cuit: cliente.cuit ?? existing.cuit,
    });
  } else {
    if (!cliente?.nombre?.trim()) {
      throw Object.assign(new Error('Nombre del cliente requerido'), { status: 400 });
    }
    clienteId = `demo-cli-${Date.now()}`;
    demoClientes.push({
      id: clienteId,
      nombre: cliente.nombre.trim(),
      razonSocial: cliente.razon_social || cliente.nombre.trim(),
      iva: cliente.iva || '',
      domicilio: cliente.domicilio || '',
      localidad: cliente.localidad || '',
      vRef: cliente.v_ref || cliente.vRef || '',
      cuit: cliente.cuit || '',
    });
  }

  const remitoId = `demo-remito-${Date.now()}`;
  const remitoItems = [];

  for (const it of items) {
    const qty = Number(it.cantidad);
    const stock = db.stock.find(
      (s) =>
        s.id === it.stockId &&
        s.item_id === it.itemId &&
        s.contenedor_id === it.contenedorId
    );
    if (!stock) {
      throw Object.assign(new Error('Stock no encontrado'), { status: 404 });
    }
    if (stock.cantidad < qty) {
      throw Object.assign(
        new Error(`Stock insuficiente. Disponible: ${stock.cantidad}`),
        { status: 409 }
      );
    }

    stock.cantidad -= qty;
    const movId = `mov-remito-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    db.movimientos.push({
      id: movId,
      item_id: it.itemId,
      contenedor_id: it.contenedorId,
      tipo: 'egreso',
      cantidad: qty,
      usuario: createdBy || 'Sistema',
      fecha: new Date().toISOString(),
      offline_id: null,
      estado: 'vendido',
      motivo: 'Vendido a cliente',
      remito_id: remitoId,
    });

    remitoItems.push({
      id: `ri-${movId}`,
      stock_id: it.stockId,
      item_id: it.itemId,
      contenedor_id: it.contenedorId,
      cantidad: qty,
      descripcion: it.descripcion || '',
      nombre: db.items.find((i) => i.id === it.itemId)?.nombre,
    });
  }

  await save(db);

  const remitoRecord = {
    id: remitoId,
    numero: Number(numero),
    fecha,
    empresa_emisora_id: empresaEmisoraId,
    cliente_id: clienteId,
    cant_bultos: cantBultos,
    transportista,
    transportista_cuit: transportistaCuit,
    transportista_domicilio: transportistaDomicilio,
    aclaracion,
    dni,
    created_by: createdBy,
    created_at: new Date().toISOString(),
    items: remitoItems,
  };
  demoRemitos.set(remitoId, remitoRecord);

  return {
    ok: true,
    remito_id: remitoId,
    numero: Number(numero),
    cliente_id: clienteId,
    demo: true,
  };
}

export async function demoGetRemitoById(id) {
  const remito = demoRemitos.get(id);
  if (!remito) throw Object.assign(new Error('Remito no encontrado'), { status: 404 });

  const empresa = DEMO_EMPRESAS.find((e) => e.id === remito.empresa_emisora_id) || null;
  const cliente = demoClientes.find((c) => c.id === remito.cliente_id) || null;

  return {
    id: remito.id,
    numero: remito.numero,
    fecha: remito.fecha,
    empresa,
    cliente,
    cantBultos: remito.cant_bultos,
    transportista: remito.transportista,
    transportistaCuit: remito.transportista_cuit,
    transportistaDomicilio: remito.transportista_domicilio,
    aclaracion: remito.aclaracion,
    dni: remito.dni,
    createdBy: remito.created_by,
    createdAt: remito.created_at,
    items: remito.items,
  };
}
