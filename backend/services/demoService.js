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
import { mapItemCampos, itemCamposFromCsv, itemPartialUpdateFromBody, itemPayloadFromBody, parseFechaRelevamiento } from './itemFields.js';

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
        i.ubicacion?.toLowerCase().includes(t) ||
        i.codigoFabricante?.toLowerCase().includes(t)
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
    const cont = String(filters.contenedor || '').trim().toUpperCase();
    if (cont) {
      items = items.filter((i) => String(i.contenedor || '').trim().toUpperCase() === cont);
    }
  }
  if (filters.tipo) items = items.filter((i) => i.tipo === filters.tipo);
  if (filters.itemId) items = items.filter((i) => i.itemId === filters.itemId);
  const codigoFab = String(filters.codigoFabricante || filters.codigo_fabricante || '').trim();
  if (codigoFab) {
    items = items.filter(
      (i) => String(i.codigoFabricante || '').trim().toLowerCase() === codigoFab.toLowerCase()
    );
  }
  const sede = String(filters.sede || '').trim().toUpperCase();
  if (sede) {
    items = items.filter((i) => {
      if (i.sede) return String(i.sede).toUpperCase() === sede;
      const alms = new Set(
        Object.entries(db.catalogo?.almacenes || {})
          .filter(([, info]) => (info?.sede || 'SED001') === sede)
          .map(([c]) => c)
      );
      // demo: filtrar por almacén del contenedor si hay catálogo; si no, dejar pasar SED001 default
      return !i.almacen || i.almacen.startsWith('ALM') ? true : alms.size ? alms.has(i.almacen) : true;
    });
  }

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

function computeEstadoHistorial(m, ingreso, itemTipo) {
  if (m.estado === 'en_transito') return 'en_transito';
  if (m.estado === 'transferido') return 'transferido';
  if (m.remito_id || m.estado === 'vendido') return 'vendido';
  if (m.estado === 'consumido' || String(itemTipo || '').toLowerCase() === 'consumible') {
    return 'consumido';
  }
  if (ingreso) return 'completado';
  return 'pendiente_devolucion';
}

function demoMapMovimiento(db, m, ingreso = null) {
  const item = db.items.find((i) => i.id === m.item_id);
  const cont = db.contenedores.find((c) => c.id === m.contenedor_id);
  const estadoHistorial = computeEstadoHistorial(m, ingreso, item?.tipo);
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
    itemTipo: item?.tipo,
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

export async function demoRegistrarEgresoContenedor({
  contenedorId,
  codigo,
  usuario,
  offlineId,
  egresoLoteId,
}) {
  const user = String(usuario || '').trim();
  if (!user) throw Object.assign(new Error('Usuario requerido'), { status: 400 });

  const db = await load();
  let cont = null;
  if (contenedorId) {
    cont = db.contenedores.find((c) => c.id === contenedorId);
  } else if (codigo) {
    const parsed = parseCodigo(codigo);
    const variants = codigoLookupVariants(parsed);
    cont = db.contenedores.find((c) => variants.includes(c.codigo));
  }
  if (!cont) throw Object.assign(new Error('Contenedor no encontrado'), { status: 404 });

  const rows = db.stock.filter((s) => s.contenedor_id === cont.id && s.cantidad > 0);
  if (!rows.length) {
    throw Object.assign(new Error('El contenedor no tiene stock para retirar'), { status: 400 });
  }

  const loteId =
    String(egresoLoteId || '').trim() ||
    `lote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const fecha = new Date().toISOString();

  const egresos = [];
  for (const row of rows) {
    const qty = Number(row.cantidad);
    const lineOfflineId = offlineId ? `${offlineId}:${row.item_id}` : null;
    const result = await demoRegistrarEgreso({
      itemId: row.item_id,
      contenedorId: cont.id,
      cantidad: qty,
      usuario: user,
      offlineId: lineOfflineId,
    });
    const db2 = await load();
    const mov = db2.movimientos.find((m) => m.id === result.movimiento_id);
    if (mov) {
      mov.egreso_lote_id = loteId;
      await save(db2);
    }
    const item = db2.items.find((i) => i.id === row.item_id);
    egresos.push({
      movimientoId: result.movimiento_id,
      itemId: row.item_id,
      nombre: item?.nombre || null,
      marca: item?.marca || null,
      modelo: item?.modelo || null,
      tipo: item?.tipo || null,
      cantidad: qty,
      result,
    });
  }

  return {
    ok: true,
    egresoLoteId: loteId,
    contenedorId: cont.id,
    contenedorCodigo: cont.codigo,
    usuario: user,
    fecha,
    totalItems: egresos.length,
    totalUnidades: egresos.reduce((s, e) => s + e.cantidad, 0),
    egresos,
    qrPayload: `inv://d/${loteId}`,
  };
}

export async function demoGetEgresoLote(loteId) {
  const id = String(loteId || '').trim();
  const db = await load();
  const movs = db.movimientos.filter((m) => m.tipo === 'egreso' && m.egreso_lote_id === id);
  if (!movs.length) throw Object.assign(new Error('Lote de egreso no encontrado'), { status: 404 });

  const first = movs[0];
  const cont = db.contenedores.find((c) => c.id === first.contenedor_id);
  const lineas = movs.map((m) => {
    const mapped = demoMapMovimiento(
      db,
      m,
      db.movimientos.find((i) => i.tipo === 'ingreso' && i.egreso_movimiento_id === m.id)
    );
    return {
      ...mapped,
      pendiente: mapped.estadoHistorial === 'pendiente_devolucion',
    };
  });
  const pendientes = lineas.filter((l) => l.pendiente);
  return {
    id,
    contenedorId: first.contenedor_id,
    contenedorCodigo: cont?.codigo || null,
    usuario: first.usuario,
    fecha: first.fecha,
    totalItems: lineas.length,
    totalUnidades: lineas.reduce((s, l) => s + Number(l.cantidad || 0), 0),
    pendientesCount: pendientes.length,
    completoDevuelto: lineas.length > 0 && pendientes.length === 0,
    lineas,
    pendientes,
    qrPayload: `inv://d/${id}`,
  };
}

export async function demoRegistrarIngresoLote({ egresoLoteId, usuario, offlineId }) {
  const lote = await demoGetEgresoLote(egresoLoteId);
  if (!lote.pendientes?.length) {
    throw Object.assign(new Error('Este lote ya fue devuelto o no tiene egresos pendientes'), {
      status: 409,
    });
  }
  const resultados = [];
  for (const line of lote.pendientes) {
    const result = await demoRegistrarIngreso({
      movimientoId: line.id,
      usuario: usuario || 'Sistema',
      offlineId: offlineId ? `${offlineId}:${line.id}` : null,
    });
    resultados.push({
      movimientoId: line.id,
      itemId: line.itemId,
      nombre: line.nombreHerramienta,
      result,
    });
  }
  return {
    ok: true,
    egresoLoteId: lote.id,
    totalDevueltos: resultados.length,
    resultados,
  };
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
    'codigoFabricante',
    'codigo_fabricante',
  ];
  const hasItemUpdate = itemFieldKeys.some((k) => itemBody[k] !== undefined);

  if (hasItemUpdate) {
    const payload = itemPartialUpdateFromBody(itemBody);
    if (payload.nombre !== undefined && !payload.nombre) {
      throw Object.assign(new Error('El nombre es obligatorio'), { status: 400 });
    }
    if (payload.codigo_fabricante) {
      const clash = db.items.find(
        (i) =>
          i.id !== itemId &&
          String(i.codigo_fabricante || '').trim().toLowerCase() ===
            String(payload.codigo_fabricante).trim().toLowerCase()
      );
      if (clash) {
        throw Object.assign(
          new Error('Ese código de fabricante ya está asignado a otro ítem'),
          { status: 409 }
        );
      }
    }
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

export async function demoUploadItemImage(itemId, { dataUrl }) {
  const db = await load();
  const item = db.items.find((i) => i.id === itemId);
  if (!item) throw Object.assign(new Error('Ítem no encontrado'), { status: 404 });
  item.imagen_url = dataUrl;
  item.imagen_path = `demo/${itemId}.jpg`;
  await save(db);
  return { ok: true, itemId, imagenUrl: dataUrl, imagenPath: item.imagen_path };
}

export async function demoDeleteItemImage(itemId) {
  const db = await load();
  const item = db.items.find((i) => i.id === itemId);
  if (!item) throw Object.assign(new Error('Ítem no encontrado'), { status: 404 });
  item.imagen_url = null;
  item.imagen_path = null;
  await save(db);
  return { ok: true, itemId };
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
    sedeCodigo: 'SED001',
    notas: '',
    logoUrl: '',
    firmaUrl: '',
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
    sedeCodigo: 'SED001',
    notas: '',
    logoUrl: '',
    firmaUrl: '',
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
    sedeCodigo: '',
    notas: '',
    logoUrl: '',
    firmaUrl: '',
    activo: true,
  },
];

const demoClientes = [];
const demoRemitos = new Map();

export async function demoListEmpresasEmisoras({ includeInactive = false } = {}) {
  return DEMO_EMPRESAS.filter((e) => includeInactive || e.activo !== false).map((e) => ({ ...e }));
}

export async function demoGetEmpresaEmisoraById(id) {
  const found = DEMO_EMPRESAS.find((e) => e.id === id);
  return found ? { ...found } : null;
}

export async function demoCreateEmpresaEmisora(payload) {
  const nombre = String(payload?.nombre || '').trim();
  if (!nombre) {
    throw Object.assign(new Error('Nombre de la oficina/empresa requerido'), { status: 400 });
  }
  const empresa = {
    id: `demo-emp-${Date.now()}`,
    nombre,
    razonSocial: payload.razonSocial || payload.razon_social || nombre,
    cuit: payload.cuit || '',
    ingBrutos: payload.ingBrutos || payload.ing_brutos || '',
    domicilio: payload.domicilio || '',
    localidad: payload.localidad || '',
    telefono: payload.telefono || '',
    fax: payload.fax || '',
    email: payload.email || '',
    web: payload.web || '',
    fechaInicioActividades: payload.fechaInicioActividades || payload.fecha_inicio_actividades || '',
    codigoDocumento: payload.codigoDocumento || payload.codigo_documento || '91',
    sedeCodigo: payload.sedeCodigo || payload.sede_codigo || '',
    notas: payload.notas || '',
    logoUrl: '',
    firmaUrl: '',
    activo: payload.activo !== false,
  };
  DEMO_EMPRESAS.push(empresa);
  return { ...empresa };
}

export async function demoUpdateEmpresaEmisora(id, payload) {
  const empresa = DEMO_EMPRESAS.find((e) => e.id === id);
  if (!empresa) throw Object.assign(new Error('Empresa no encontrada'), { status: 404 });
  const aliases = {
    razon_social: 'razonSocial',
    ing_brutos: 'ingBrutos',
    fecha_inicio_actividades: 'fechaInicioActividades',
    codigo_documento: 'codigoDocumento',
    sede_codigo: 'sedeCodigo',
  };
  for (const [k, v] of Object.entries(payload || {})) {
    const dest = aliases[k] || k;
    if (
      [
        'nombre',
        'razonSocial',
        'cuit',
        'ingBrutos',
        'domicilio',
        'localidad',
        'telefono',
        'fax',
        'email',
        'web',
        'fechaInicioActividades',
        'codigoDocumento',
        'sedeCodigo',
        'notas',
        'activo',
      ].includes(dest)
    ) {
      empresa[dest] = v;
    }
  }
  return { ...empresa };
}

export async function demoUploadEmpresaAsset(empresaId, kind, dataUrl) {
  const empresa = DEMO_EMPRESAS.find((e) => e.id === empresaId);
  if (!empresa) throw Object.assign(new Error('Empresa no encontrada'), { status: 404 });
  if (kind === 'logo') empresa.logoUrl = dataUrl;
  else empresa.firmaUrl = dataUrl;
  return {
    ok: true,
    empresaId,
    kind,
    url: dataUrl,
    ...(kind === 'logo' ? { logoUrl: dataUrl } : { firmaUrl: dataUrl }),
  };
}

export async function demoDeleteEmpresaAsset(empresaId, kind) {
  const empresa = DEMO_EMPRESAS.find((e) => e.id === empresaId);
  if (!empresa) throw Object.assign(new Error('Empresa no encontrada'), { status: 404 });
  if (kind === 'logo') empresa.logoUrl = '';
  else empresa.firmaUrl = '';
  return { ok: true, empresaId, kind };
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

export async function demoSearchClientes(q = '', { includeInactive = false, limit = 20 } = {}) {
  const term = String(q || '').trim().toLowerCase();
  let list = demoClientes.filter((c) => includeInactive || c.activo !== false);
  if (term) {
    list = list.filter((c) =>
      [c.nombre, c.razonSocial, c.cuit, c.localidad]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }
  return list.slice(0, limit).map((c) => ({ ...c }));
}

export async function demoGetClienteById(id) {
  const found = demoClientes.find((c) => c.id === id);
  return found ? { ...found } : null;
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
    telefono: payload.telefono || '',
    email: payload.email || '',
    contacto: payload.contacto || '',
    notas: payload.notas || '',
    activo: payload.activo !== false,
  };
  demoClientes.push(cliente);
  return { ...cliente };
}

export async function demoUpdateCliente(id, payload) {
  const cliente = demoClientes.find((c) => c.id === id);
  if (!cliente) throw Object.assign(new Error('Cliente no encontrado'), { status: 404 });
  const keys = [
    'nombre',
    'razonSocial',
    'iva',
    'domicilio',
    'localidad',
    'vRef',
    'cuit',
    'telefono',
    'email',
    'contacto',
    'notas',
    'activo',
  ];
  for (const k of keys) {
    if (payload?.[k] !== undefined) cliente[k] = payload[k];
  }
  if (payload?.razon_social !== undefined) cliente.razonSocial = payload.razon_social;
  if (payload?.v_ref !== undefined) cliente.vRef = payload.v_ref;
  return { ...cliente };
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
    tipo = 'venta',
    almacenOrigen,
    almacenDestino,
    ubicacionDestino,
  } = payload;

  if (!empresaEmisoraId) {
    throw Object.assign(new Error('Empresa emisora requerida'), { status: 400 });
  }
  if (!items?.length) {
    throw Object.assign(new Error('El remito debe tener al menos un ítem'), { status: 400 });
  }

  const remitoTipo = String(tipo || 'venta').toLowerCase();
  if (remitoTipo === 'transferencia') {
    if (!almacenOrigen?.trim() || !almacenDestino?.trim()) {
      throw Object.assign(new Error('Almacén origen y destino requeridos'), { status: 400 });
    }
    if (almacenOrigen.trim().toUpperCase() === almacenDestino.trim().toUpperCase()) {
      throw Object.assign(new Error('El almacén destino debe ser distinto del origen'), { status: 400 });
    }
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
      throw Object.assign(new Error('Nombre del destinatario requerido'), { status: 400 });
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
  const isTransferencia = remitoTipo === 'transferencia';
  const estadoMov = isTransferencia ? 'en_transito' : 'vendido';
  const motivoMov = isTransferencia ? 'Transferencia entre almacenes' : 'Vendido a cliente';
  const estadoRemito = isTransferencia ? 'en_transito' : 'confirmado';

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
      estado: estadoMov,
      motivo: motivoMov,
      remito_id: remitoId,
    });

    remitoItems.push({
      id: `ri-${movId}`,
      stock_id: it.stockId,
      item_id: it.itemId,
      contenedor_id: it.contenedorId,
      cantidad: qty,
      cantidad_recibida: 0,
      descripcion: it.descripcion || '',
      nombre: db.items.find((i) => i.id === it.itemId)?.nombre,
      codigo_fabricante: db.items.find((i) => i.id === it.itemId)?.codigo_fabricante || null,
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
    tipo: remitoTipo,
    almacen_origen: isTransferencia ? almacenOrigen.trim() : null,
    almacen_destino: isTransferencia ? almacenDestino.trim() : null,
    ubicacion_destino: isTransferencia ? ubicacionDestino || null : null,
    estado: estadoRemito,
    recibido_por: null,
    recibido_at: null,
    items: remitoItems,
  };
  demoRemitos.set(remitoId, remitoRecord);

  return {
    ok: true,
    remito_id: remitoId,
    numero: Number(numero),
    cliente_id: clienteId,
    tipo: remitoTipo,
    estado: estadoRemito,
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
    tipo: remito.tipo || 'venta',
    estado: remito.estado || 'confirmado',
    almacenOrigen: remito.almacen_origen || null,
    almacenDestino: remito.almacen_destino || null,
    ubicacionDestino: remito.ubicacion_destino || null,
    recibidoPor: remito.recibido_por || null,
    recibidoAt: remito.recibido_at || null,
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

export function getDemoRemitosMap() {
  return demoRemitos;
}

export function demoPeekRemito(id) {
  return demoRemitos.get(id) || null;
}

export async function demoListTransferenciasPendientes(almacenDestino) {
  const term = String(almacenDestino || '').trim().toUpperCase();
  const list = [];
  for (const r of demoRemitos.values()) {
    if (r.tipo !== 'transferencia' || !['en_transito', 'parcial'].includes(r.estado)) continue;
    if (term && String(r.almacen_destino || '').toUpperCase() !== term) continue;
    const empresa = DEMO_EMPRESAS.find((e) => e.id === r.empresa_emisora_id);
    const cliente = demoClientes.find((c) => c.id === r.cliente_id);
    list.push({
      id: r.id,
      numero: r.numero,
      fecha: r.fecha,
      almacenOrigen: r.almacen_origen,
      almacenDestino: r.almacen_destino,
      ubicacionDestino: r.ubicacion_destino || null,
      createdBy: r.created_by,
      createdAt: r.created_at,
      empresa: empresa ? { id: empresa.id, nombre: empresa.nombre } : null,
      destinatario: cliente?.nombre || r.almacen_destino,
      items: r.items || [],
      itemsCount: (r.items || []).length,
    });
  }
  return list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function demoRecibirTransferencia(remitoId, payload, recibidoPor) {
  const remito = demoRemitos.get(remitoId);
  if (!remito) throw Object.assign(new Error('Remito no encontrado'), { status: 404 });
  if (remito.tipo !== 'transferencia') {
    throw Object.assign(new Error('El remito no es una transferencia'), { status: 400 });
  }
  if (!['en_transito', 'parcial'].includes(remito.estado)) {
    throw Object.assign(new Error('La transferencia no está pendiente de recepción'), { status: 409 });
  }

  const ubicacion = payload?.ubicacionDestino || remito.ubicacion_destino;
  if (!ubicacion?.armario || !ubicacion?.estante) {
    throw Object.assign(new Error('Ubicación destino requerida (armario y estante)'), { status: 400 });
  }

  const contDest = await demoResolveUbicacion({
    almacen: remito.almacen_destino,
    armario: ubicacion.armario,
    estante: ubicacion.estante,
    contenedor: ubicacion.contenedor || null,
  });

  const db = await load();
  let itemsRecibidos = 0;

  for (const ri of remito.items || []) {
    const pendiente = Math.max(0, Number(ri.cantidad || 0) - Number(ri.cantidad_recibida || 0));
    if (pendiente <= 0) continue;

    const movEgreso = db.movimientos.find(
      (m) =>
        m.remito_id === remitoId &&
        m.item_id === ri.item_id &&
        m.contenedor_id === ri.contenedor_id &&
        m.tipo === 'egreso' &&
        m.estado === 'en_transito'
    );

    let stockDest = db.stock.find(
      (s) => s.item_id === ri.item_id && s.contenedor_id === contDest.id
    );
    if (stockDest) {
      stockDest.cantidad += pendiente;
    } else {
      stockDest = {
        id: `stock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        item_id: ri.item_id,
        contenedor_id: contDest.id,
        cantidad: pendiente,
      };
      db.stock.push(stockDest);
    }

    if (movEgreso) {
      movEgreso.estado = 'transferido';
      movEgreso.motivo = `Transferencia recibida en ${remito.almacen_destino}`;
    }

    db.movimientos.push({
      id: `mov-ing-trans-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      item_id: ri.item_id,
      contenedor_id: contDest.id,
      tipo: 'ingreso',
      cantidad: pendiente,
      usuario: recibidoPor || 'Sistema',
      fecha: new Date().toISOString(),
      offline_id: null,
      estado: 'transferido',
      motivo: 'Ingreso por transferencia',
      remito_id: remitoId,
      egreso_movimiento_id: movEgreso?.id || null,
    });

    ri.cantidad_recibida = Number(ri.cantidad || 0);
    itemsRecibidos += 1;
  }

  await save(db);

  remito.estado = 'recibido';
  remito.recibido_por = recibidoPor || 'Sistema';
  remito.recibido_at = new Date().toISOString();
  remito.ubicacion_destino = ubicacion;
  remito.recepcion_informe = {
    ...(remito.recepcion_informe || {}),
    cierre: 'completo',
    cerrado_at: new Date().toISOString(),
  };

  return {
    ok: true,
    remito_id: remitoId,
    items_recibidos: itemsRecibidos,
    contenedor_destino_id: contDest.id,
    estado: 'recibido',
    demo: true,
  };
}

function pushRecepcionEvento(remito, ev) {
  if (!remito.recepcion_eventos) remito.recepcion_eventos = [];
  const row = {
    id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    ...ev,
  };
  remito.recepcion_eventos.unshift(row);
  return row;
}

export async function demoValidarItemRecepcionTransferencia(remitoId, payload = {}) {
  const remito = demoRemitos.get(remitoId);
  if (!remito) throw Object.assign(new Error('Remito no encontrado'), { status: 404 });
  if (remito.tipo !== 'transferencia') {
    throw Object.assign(new Error('El remito no es una transferencia'), { status: 400 });
  }
  if (!['en_transito', 'parcial'].includes(remito.estado)) {
    throw Object.assign(new Error('El remito no admite recepción'), { status: 409 });
  }

  const cantidad = Math.max(1, Number(payload.cantidad || 1));
  const usuario = payload.usuario || 'Sistema';
  const scan = String(payload.scan || payload.codigo || '').trim();
  let targetItemId = payload.itemId || null;

  const db = await load();
  if (!targetItemId && scan) {
    if (/^[0-9a-f-]{36}$/i.test(scan) || scan.startsWith('demo-') || scan.startsWith('item-')) {
      targetItemId = scan;
    } else {
      const found = db.items.find(
        (i) => String(i.codigo_fabricante || '').toUpperCase() === scan.toUpperCase()
      );
      if (found) targetItemId = found.id;
    }
  }

  const mapRemito = () => {
    const items = (remito.items || []).map((ri) => {
      const cant = Number(ri.cantidad || 0);
      const rec = Number(ri.cantidad_recibida || 0);
      return {
        id: ri.id,
        itemId: ri.item_id,
        cantidad: cant,
        cantidadRecibida: rec,
        cantidadPendiente: Math.max(0, cant - rec),
        nombre: ri.nombre,
        codigoFabricante: ri.codigo_fabricante,
      };
    });
    const pendiente = items.reduce((s, l) => s + l.cantidadPendiente, 0);
    const recibido = items.reduce((s, l) => s + l.cantidadRecibida, 0);
    return {
      id: remito.id,
      numero: remito.numero,
      estado: remito.estado,
      almacenOrigen: remito.almacen_origen,
      almacenDestino: remito.almacen_destino,
      ubicacionDestino: remito.ubicacion_destino,
      items,
      itemsCount: items.length,
      cantidadPendienteTotal: pendiente,
      cantidadRecibidaTotal: recibido,
      completo: pendiente <= 0 && items.length > 0,
      recepcionInforme: remito.recepcion_informe,
      recepcionAbiertaAt: remito.recepcion_abierta_at,
    };
  };

  if (!targetItemId) {
    pushRecepcionEvento(remito, {
      tipo: 'extra_no_listado',
      codigo: scan,
      cantidad,
      notas: 'Ítem escaneado no pertenece al remito',
      usuario,
    });
    if (!remito.recepcion_abierta_at) remito.recepcion_abierta_at = new Date().toISOString();
    remito.estado = 'parcial';
    return { ok: false, tipo: 'extra_no_listado', mensaje: 'El ítem no figura en el remito', remito: mapRemito() };
  }

  const linea = (remito.items || []).find(
    (ri) =>
      ri.item_id === targetItemId &&
      Number(ri.cantidad || 0) - Number(ri.cantidad_recibida || 0) > 0
  );
  if (!linea) {
    const ya = (remito.items || []).some((ri) => ri.item_id === targetItemId);
    pushRecepcionEvento(remito, {
      tipo: ya ? 'exceso' : 'extra_no_listado',
      itemId: targetItemId,
      codigo: scan,
      cantidad,
      usuario,
    });
    return {
      ok: false,
      tipo: ya ? 'exceso' : 'extra_no_listado',
      mensaje: ya ? 'Ese ítem ya está completo' : 'El ítem no figura en el remito',
      remito: mapRemito(),
    };
  }

  const pendiente = Number(linea.cantidad) - Number(linea.cantidad_recibida || 0);
  const aplicar = Math.min(cantidad, pendiente);

  const ubi = payload.ubicacionDestino || remito.ubicacion_destino || {};
  if (!ubi.armario || !ubi.estante) {
    throw Object.assign(new Error('Ubicación destino requerida (armario y estante)'), { status: 400 });
  }
  const contDest = await demoResolveUbicacion({
    almacen: remito.almacen_destino,
    armario: ubi.armario,
    estante: ubi.estante,
    contenedor: ubi.contenedor || null,
  });

  let stockDest = db.stock.find((s) => s.item_id === linea.item_id && s.contenedor_id === contDest.id);
  if (stockDest) stockDest.cantidad += aplicar;
  else {
    db.stock.push({
      id: `stock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      item_id: linea.item_id,
      contenedor_id: contDest.id,
      cantidad: aplicar,
    });
  }

  linea.cantidad_recibida = Number(linea.cantidad_recibida || 0) + aplicar;

  if (linea.cantidad_recibida >= Number(linea.cantidad)) {
    const movEgreso = db.movimientos.find(
      (m) =>
        m.remito_id === remitoId &&
        m.item_id === linea.item_id &&
        m.contenedor_id === linea.contenedor_id &&
        m.tipo === 'egreso' &&
        m.estado === 'en_transito'
    );
    if (movEgreso) {
      movEgreso.estado = 'transferido';
      movEgreso.motivo = 'Transferencia — recibido ítem a ítem';
    }
  }

  db.movimientos.push({
    id: `mov-ing-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    item_id: linea.item_id,
    contenedor_id: contDest.id,
    tipo: 'ingreso',
    cantidad: aplicar,
    usuario,
    fecha: new Date().toISOString(),
    offline_id: null,
    estado: 'transferido',
    motivo: 'Recepción transferencia (ítem)',
    remito_id: remitoId,
  });
  await save(db);

  pushRecepcionEvento(remito, {
    tipo: 'validado',
    remitoItemId: linea.id,
    itemId: linea.item_id,
    codigo: scan,
    cantidad: aplicar,
    usuario,
  });

  if (!remito.recepcion_abierta_at) remito.recepcion_abierta_at = new Date().toISOString();
  const todos = (remito.items || []).every(
    (ri) => Number(ri.cantidad_recibida || 0) >= Number(ri.cantidad || 0)
  );
  if (todos) {
    remito.estado = 'recibido';
    remito.recibido_por = usuario;
    remito.recibido_at = new Date().toISOString();
    remito.recepcion_informe = { cierre: 'completo', modo: 'item_a_item', cerrado_at: new Date().toISOString() };
  } else {
    remito.estado = 'parcial';
  }
  remito.ubicacion_destino = { ...remito.ubicacion_destino, ...ubi };

  return {
    ok: true,
    tipo: 'validado',
    cantidadAplicada: aplicar,
    lineaId: linea.id,
    remito: mapRemito(),
    cerradoCompleto: todos,
  };
}

export async function demoCerrarRecepcionParcialTransferencia(remitoId, payload = {}) {
  const remito = demoRemitos.get(remitoId);
  if (!remito) throw Object.assign(new Error('Remito no encontrado'), { status: 404 });
  if (!['en_transito', 'parcial'].includes(remito.estado)) {
    throw Object.assign(new Error('El remito no está abierto'), { status: 409 });
  }

  const faltantes = (remito.items || [])
    .map((ri) => {
      const cant = Number(ri.cantidad || 0);
      const rec = Number(ri.cantidad_recibida || 0);
      return {
        remitoItemId: ri.id,
        itemId: ri.item_id,
        nombre: ri.nombre,
        cantidad: cant,
        cantidadRecibida: rec,
        cantidadPendiente: Math.max(0, cant - rec),
      };
    })
    .filter((f) => f.cantidadPendiente > 0);

  const informe = {
    cierre: faltantes.length ? 'parcial' : 'completo',
    cerrado_at: new Date().toISOString(),
    notas: payload.notas || null,
    usuario: payload.usuario || 'Sistema',
    faltantes,
    extras: (remito.recepcion_eventos || []).filter(
      (e) => e.tipo === 'extra_no_listado' || e.tipo === 'exceso'
    ),
  };

  remito.estado = faltantes.length ? 'parcial' : 'recibido';
  remito.recepcion_informe = informe;
  if (!faltantes.length) {
    remito.recibido_por = payload.usuario || 'Sistema';
    remito.recibido_at = new Date().toISOString();
  }
  pushRecepcionEvento(remito, {
    tipo: 'cierre_parcial',
    notas: payload.notas || null,
    usuario: payload.usuario || 'Sistema',
    meta: informe,
  });

  const items = (remito.items || []).map((ri) => {
    const cant = Number(ri.cantidad || 0);
    const rec = Number(ri.cantidad_recibida || 0);
    return {
      id: ri.id,
      itemId: ri.item_id,
      cantidad: cant,
      cantidadRecibida: rec,
      cantidadPendiente: Math.max(0, cant - rec),
      nombre: ri.nombre,
    };
  });
  return {
    remito: {
      id: remito.id,
      numero: remito.numero,
      estado: remito.estado,
      items,
      cantidadPendienteTotal: items.reduce((s, i) => s + i.cantidadPendiente, 0),
      cantidadRecibidaTotal: items.reduce((s, i) => s + i.cantidadRecibida, 0),
      completo: faltantes.length === 0,
      recepcionInforme: informe,
    },
    eventos: remito.recepcion_eventos || [],
  };
}
