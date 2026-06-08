/**
 * Modo demo local (sin Supabase) — misma forma de datos que la API Supabase.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import {
  buildCodigo,
  buildDbId,
  getArmarioNombre,
  mapUbicacionFields,
  parseCodigo,
} from './ubicacionUtils.js';
import { mapItemCampos, itemCamposFromCsv, itemPayloadFromBody, parseFechaRelevamiento } from './itemFields.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../data/demo-db.json');

async function load() {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return seed();
  }
}

async function save(data) {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2));
}

function seed() {
  const c1 = {
    id: buildDbId('A01-E01-C01'),
    codigo: 'A01-E01-C01',
    armario: 'A01',
    estante: 'E01',
    contenedor: 'C01',
    ubicacion: getArmarioNombre('A01'),
  };
  const c2 = {
    id: buildDbId('A01-E02-C03'),
    codigo: 'A01-E02-C03',
    armario: 'A01',
    estante: 'E02',
    contenedor: 'C03',
    ubicacion: getArmarioNombre('A01'),
  };
  const c3 = {
    id: buildDbId('A02-E01-C02'),
    codigo: 'A02-E01-C02',
    armario: 'A02',
    estante: 'E01',
    contenedor: 'C02',
    ubicacion: getArmarioNombre('A02'),
  };
  const c4 = {
    id: buildDbId('A00-E03'),
    codigo: 'A00-E03',
    armario: 'A00',
    estante: 'E03',
    contenedor: null,
    ubicacion: getArmarioNombre('A00'),
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
  if (filters.ubicacion) items = items.filter((i) => i.ubicacion === filters.ubicacion);
  if (filters.armario) items = items.filter((i) => i.armario === filters.armario);
  if (filters.tipo) items = items.filter((i) => i.tipo === filters.tipo);

  const lowStock = items.filter((i) => Number(i.cantidad) === 0);
  return { items, total: items.length, lowStock, lowStockThreshold: config.lowStockThreshold };
}

export async function demoGetContenedor(codigo) {
  const db = await load();
  const parsed = parseCodigo(codigo);
  const normalized = parsed?.codigo || codigo.toUpperCase();

  if (parsed?.armario && !parsed.estante) {
    const items = db.stock
      .map((s) => mapStockRow(db, s))
      .filter((i) => i && i.armario === parsed.armario);
    const cont = {
      id: `arm-${parsed.armario}`,
      codigo: parsed.armario,
      armario: parsed.armario,
      estante: null,
      contenedor: null,
      ubicacion: getArmarioNombre(parsed.armario),
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

  let cont = db.contenedores.find((c) => c.codigo === normalized);
  if (!cont && parsed) {
    cont = await demoResolveUbicacion({ codigo: normalized });
  }
  if (!cont) throw Object.assign(new Error('Ubicación no encontrada'), { status: 404 });

  let items;
  if (parsed?.estante && !parsed.contenedor) {
    items = db.stock
      .map((s) => mapStockRow(db, s))
      .filter((i) => i && i.armario === parsed.armario && i.estante === parsed.estante);
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
    movs = movs.filter((m) => !ingresoByEgreso.has(m.id));
  }

  return movs.map((m) => demoMapMovimiento(db, m, ingresoByEgreso.get(m.id)));
}

function demoMapMovimiento(db, m, ingreso = null) {
  const item = db.items.find((i) => i.id === m.item_id);
  const cont = db.contenedores.find((c) => c.id === m.contenedor_id);
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
    pendiente: !ingreso,
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
  const mov = {
    id: `mov-${Date.now()}`,
    item_id: itemId,
    contenedor_id: contenedorId,
    tipo: 'egreso',
    cantidad: qty,
    usuario: usuario.trim(),
    fecha: new Date().toISOString(),
    offline_id: offlineId || null,
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

/** Vacía inventario demo antes de importar CSV en modo reemplazar */
export async function demoResetInventario() {
  await save({ contenedores: [], items: [], stock: [], movimientos: [] });
}

export function demoResolveUbicacionInMemory(db, { armario, estante, contenedor, codigo }) {
  let parsed = codigo ? parseCodigo(codigo) : null;
  if (!parsed && armario && estante) {
    parsed = {
      armario,
      estante,
      contenedor: contenedor ?? null,
      codigo: buildCodigo(armario, estante, contenedor),
    };
  }
  if (!parsed) throw Object.assign(new Error('Ubicación inválida'), { status: 400 });

  let cont = db.contenedores.find((c) => c.codigo === parsed.codigo);
  if (!cont) {
    cont = {
      id: buildDbId(parsed.codigo),
      codigo: parsed.codigo,
      armario: parsed.armario,
      estante: parsed.estante,
      contenedor: parsed.contenedor,
      ubicacion: getArmarioNombre(parsed.armario),
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
        return { contenedorCodigo: c?.codigo, cantidad: s.cantidad, ...mapUbicacionFields(c) };
      }),
    };
  });
}

export async function demoResolveUbicacion({ armario, estante, contenedor, codigo }) {
  const db = await load();
  let parsed = codigo ? parseCodigo(codigo) : null;
  if (!parsed && armario && estante) {
    parsed = {
      armario,
      estante,
      contenedor: contenedor ?? null,
      codigo: buildCodigo(armario, estante, contenedor),
    };
  }
  if (!parsed) throw Object.assign(new Error('Ubicación inválida'), { status: 400 });

  let cont = db.contenedores.find((c) => c.codigo === parsed.codigo);
  if (!cont) {
    cont = {
      id: buildDbId(parsed.codigo),
      codigo: parsed.codigo,
      armario: parsed.armario,
      estante: parsed.estante,
      contenedor: parsed.contenedor,
      ubicacion: getArmarioNombre(parsed.armario),
    };
    db.contenedores.push(cont);
    await save(db);
  }
  return cont;
}

export async function demoAltaStock({
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
}) {
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

  const payload = itemPayloadFromBody({ ...item, ...body, nombre: body.nombre ?? item.nombre });
  if (!payload.nombre) throw Object.assign(new Error('El nombre es obligatorio'), { status: 400 });

  Object.assign(item, payload);
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
