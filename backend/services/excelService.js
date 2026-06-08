import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import {
  createGraphClient,
  workbookBasePath,
  createWorkbookSession,
  closeWorkbookSession,
} from './graphClient.js';
import { withLock, LOCK_KEYS } from './concurrencyLock.js';
import { buildContenedorId, matchesContenedorId } from './contenedorUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_DATA_PATH = path.join(__dirname, '../data/demo-data.json');

const INVENTARIO_HEADERS = [
  'UBICACION',
  'ESTANTE',
  'CONTENEDOR',
  'CANTIDAD',
  'NOMBRE',
  'MARCA',
  'MODELO',
  'TIPO',
  'CALIBRACION',
  'DETALLE',
  'COMENTARIO',
  'FECHA RELEVAMIENTO',
];

const MOVIMIENTOS_HEADERS = [
  'Ubicacion',
  'Estante',
  'Contenedor',
  'Cantidad',
  'Nombre herramienta',
  'Nombre personal',
  'Fecha de egreso',
  'Fecha de ingreso',
  'Firma',
];

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function rowToInventarioItem(row, rowIndex) {
  const map = {};
  INVENTARIO_HEADERS.forEach((h, i) => {
    map[h] = row[i] ?? '';
  });
  const cantidad = Number(map.CANTIDAD) || 0;
  return {
    id: `inv-${rowIndex}`,
    rowIndex,
    ubicacion: map.UBICACION,
    estante: map.ESTANTE,
    contenedor: map.CONTENEDOR,
    cantidad,
    nombre: map.NOMBRE,
    marca: map.MARCA,
    modelo: map.MODELO,
    tipo: map.TIPO,
    calibracion: map.CALIBRACION,
    detalle: map.DETALLE,
    comentario: map.COMENTARIO,
    fechaRelevamiento: map['FECHA RELEVAMIENTO'],
    codigo: `${map.UBICACION}|${map.ESTANTE}|${map.CONTENEDOR}|${map.NOMBRE}`.toUpperCase(),
    contenedorId: buildContenedorId(map.UBICACION, map.ESTANTE, map.CONTENEDOR),
  };
}

function rowToMovimiento(row, rowIndex) {
  const values = {};
  MOVIMIENTOS_HEADERS.forEach((h, i) => {
    values[h] = row[i] ?? '';
  });
  const fechaIngreso = values['Fecha de ingreso'];
  return {
    id: `mov-${rowIndex}`,
    rowIndex,
    ubicacion: values.Ubicacion,
    estante: values.Estante,
    contenedor: values.Contenedor,
    cantidad: Number(values.Cantidad) || 0,
    nombreHerramienta: values['Nombre herramienta'],
    nombrePersonal: values['Nombre personal'],
    fechaEgreso: values['Fecha de egreso'],
    fechaIngreso,
    firma: values.Firma,
    pendiente: !fechaIngreso || String(fechaIngreso).trim() === '',
  };
}

async function readDemoData() {
  try {
    const raw = await fs.readFile(DEMO_DATA_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    const seed = {
      inventario: [
        ['Taller A', 'E1', 'C1', 5, 'Llave allen 10mm', 'Stanley', 'SA10', 'Herramienta', 'No', 'Juego métrico', '', '2025-01-15'],
        ['Taller A', 'E2', 'C3', 2, 'Multímetro digital', 'Fluke', '115', 'Medición', 'Sí', 'Uso eléctrico', 'Revisar pilas', '2025-02-01'],
        ['Depósito', 'E1', 'C2', 1, 'Taladro percutor', 'Bosch', 'GSB 13', 'Eléctrica', 'No', '220V', '', '2025-03-10'],
      ],
      movimientos: [],
    };
    await fs.mkdir(path.dirname(DEMO_DATA_PATH), { recursive: true });
    await fs.writeFile(DEMO_DATA_PATH, JSON.stringify(seed, null, 2));
    return seed;
  }
}

async function writeDemoData(data) {
  await fs.writeFile(DEMO_DATA_PATH, JSON.stringify(data, null, 2));
}

async function graphGetUsedRange(client, sessionId, sheetName) {
  const base = workbookBasePath();
  const encoded = encodeURIComponent(sheetName);
  let req = client.api(`${base}/worksheets('${encoded}')/usedRange`);
  if (sessionId) req = req.header('workbook-session-id', sessionId);
  const range = await req.get();
  return range;
}

async function graphUpdateCell(client, sessionId, sheetName, address, values) {
  const base = workbookBasePath();
  const encoded = encodeURIComponent(sheetName);
  let req = client
    .api(`${base}/worksheets('${encoded}')/range(address='${address}')`)
    .patch({ values });
  if (sessionId) req = req.header('workbook-session-id', sessionId);
  return req;
}

async function graphAppendRow(client, sessionId, sheetName, values) {
  const base = workbookBasePath();
  const encoded = encodeURIComponent(sheetName);
  const range = await graphGetUsedRange(client, sessionId, sheetName);
  const nextRow = (range.rowIndex || 0) + (range.rowCount || 1) + 1;
  const colEnd = String.fromCharCode(64 + values.length);
  const address = `A${nextRow}:${colEnd}${nextRow}`;
  return graphUpdateCell(client, sessionId, sheetName, address, [values]);
}

async function loadInventarioGraph(accessToken) {
  const client = createGraphClient(accessToken);
  const range = await graphGetUsedRange(client, null, config.sharepoint.sheetInventario);
  const rows = range.values || [];
  if (rows.length < 2) return [];
  return rows.slice(1).map((row, i) => rowToInventarioItem(row, i + 2));
}

async function loadMovimientosGraph(accessToken) {
  const client = createGraphClient(accessToken);
  const range = await graphGetUsedRange(client, null, config.sharepoint.sheetMovimientos);
  const rows = range.values || [];
  if (rows.length < 2) return [];
  return rows.slice(1).map((row, i) => rowToMovimiento(row, i + 2));
}

export async function getInventario(accessToken) {
  if (config.demoMode) {
    const data = await readDemoData();
    return data.inventario.map((row, i) => rowToInventarioItem(row, i + 2));
  }
  return loadInventarioGraph(accessToken);
}

export async function getMovimientos(accessToken, filters = {}) {
  let items;
  if (config.demoMode) {
    const data = await readDemoData();
    items = data.movimientos.map((row, i) => rowToMovimiento(row, i + 2));
  } else {
    items = await loadMovimientosGraph(accessToken);
  }

  let result = items;
  if (filters.pendiente === true || filters.pendiente === 'true') {
    result = result.filter((m) => m.pendiente);
  }
  if (filters.persona) {
    const p = filters.persona.toLowerCase();
    result = result.filter((m) => m.nombrePersonal?.toLowerCase().includes(p));
  }
  if (filters.desde) {
    const desde = new Date(filters.desde);
    result = result.filter((m) => new Date(m.fechaEgreso) >= desde);
  }
  if (filters.hasta) {
    const hasta = new Date(filters.hasta);
    result = result.filter((m) => new Date(m.fechaEgreso) <= hasta);
  }
  return result.sort((a, b) => new Date(b.fechaEgreso) - new Date(a.fechaEgreso));
}

export async function registrarEgreso(accessToken, payload) {
  const { inventarioId, cantidad, nombrePersonal, firma = '' } = payload;
  const qty = Number(cantidad);
  if (!inventarioId || !nombrePersonal?.trim()) {
    throw Object.assign(new Error('Datos incompletos'), { status: 400 });
  }
  if (!qty || qty <= 0) {
    throw Object.assign(new Error('Cantidad inválida'), { status: 400 });
  }

  return withLock(LOCK_KEYS.GLOBAL, async () => {
    if (config.demoMode) {
      const data = await readDemoData();
      const idx = data.inventario.findIndex((_, i) => `inv-${i + 2}` === inventarioId);
      if (idx < 0) throw Object.assign(new Error('Herramienta no encontrada'), { status: 404 });
      const row = data.inventario[idx];
      const stock = Number(row[3]) || 0;
      if (qty > stock) {
        throw Object.assign(new Error(`Stock insuficiente. Disponible: ${stock}`), { status: 409 });
      }
      row[3] = stock - qty;
      const fecha = new Date().toISOString().slice(0, 10);
      data.movimientos.push([
        row[0],
        row[1],
        row[2],
        qty,
        row[4],
        nombrePersonal.trim(),
        fecha,
        '',
        firma,
      ]);
      await writeDemoData(data);
      const inv = rowToInventarioItem(row, idx + 2);
      const mov = rowToMovimiento(data.movimientos[data.movimientos.length - 1], data.movimientos.length + 1);
      return { inventario: inv, movimiento: mov };
    }

    const client = createGraphClient(accessToken);
    const sessionId = await createWorkbookSession(client);
    try {
      const invRange = await graphGetUsedRange(client, sessionId, config.sharepoint.sheetInventario);
      const invRows = invRange.values || [];
      const dataRows = invRows.slice(1);
      const targetIndex = dataRows.findIndex((_, i) => `inv-${i + 2}` === inventarioId);
      if (targetIndex < 0) throw Object.assign(new Error('Herramienta no encontrada'), { status: 404 });

      const row = dataRows[targetIndex];
      const stock = Number(row[3]) || 0;
      if (qty > stock) {
        throw Object.assign(new Error(`Stock insuficiente. Disponible: ${stock}`), { status: 409 });
      }
      row[3] = stock - qty;
      const excelRow = targetIndex + 2;
      await graphUpdateCell(
        client,
        sessionId,
        config.sharepoint.sheetInventario,
        `D${excelRow}`,
        [[row[3]]]
      );

      const fecha = new Date().toISOString().slice(0, 10);
      const movRow = [row[0], row[1], row[2], qty, row[4], nombrePersonal.trim(), fecha, '', firma];
      await graphAppendRow(client, sessionId, config.sharepoint.sheetMovimientos, movRow);

      return {
        inventario: rowToInventarioItem(row, excelRow),
        movimiento: rowToMovimiento(movRow, -1),
      };
    } finally {
      await closeWorkbookSession(client, sessionId);
    }
  });
}

export async function registrarIngreso(accessToken, payload) {
  const { movimientoId, fechaIngreso } = payload;
  if (!movimientoId) {
    throw Object.assign(new Error('Movimiento requerido'), { status: 400 });
  }
  const fecha = fechaIngreso || new Date().toISOString().slice(0, 10);

  return withLock(LOCK_KEYS.GLOBAL, async () => {
    if (config.demoMode) {
      const data = await readDemoData();
      const movIdx = data.movimientos.findIndex((_, i) => `mov-${i + 2}` === movimientoId);
      if (movIdx < 0) throw Object.assign(new Error('Movimiento no encontrado'), { status: 404 });
      const mov = data.movimientos[movIdx];
      if (mov[7] && String(mov[7]).trim()) {
        throw Object.assign(new Error('El movimiento ya fue devuelto'), { status: 409 });
      }
      mov[7] = fecha;

      const invIdx = data.inventario.findIndex(
        (r) =>
          r[0] === mov[0] &&
          r[1] === mov[1] &&
          r[2] === mov[2] &&
          String(r[4]).toLowerCase() === String(mov[4]).toLowerCase()
      );
      if (invIdx < 0) throw Object.assign(new Error('Ítem de inventario no encontrado'), { status: 404 });
      const qty = Number(mov[3]) || 0;
      data.inventario[invIdx][3] = (Number(data.inventario[invIdx][3]) || 0) + qty;
      await writeDemoData(data);
      return {
        inventario: rowToInventarioItem(data.inventario[invIdx], invIdx + 2),
        movimiento: rowToMovimiento(mov, movIdx + 2),
      };
    }

    const client = createGraphClient(accessToken);
    const sessionId = await createWorkbookSession(client);
    try {
      const movRange = await graphGetUsedRange(client, sessionId, config.sharepoint.sheetMovimientos);
      const movRows = movRange.values || [];
      const dataMov = movRows.slice(1);
      const movIndex = dataMov.findIndex((_, i) => `mov-${i + 2}` === movimientoId);
      if (movIndex < 0) throw Object.assign(new Error('Movimiento no encontrado'), { status: 404 });

      const mov = dataMov[movIndex];
      if (mov[7] && String(mov[7]).trim()) {
        throw Object.assign(new Error('El movimiento ya fue devuelto'), { status: 409 });
      }
      mov[7] = fecha;
      const movExcelRow = movIndex + 2;
      await graphUpdateCell(
        client,
        sessionId,
        config.sharepoint.sheetMovimientos,
        `H${movExcelRow}`,
        [[fecha]]
      );

      const invRange = await graphGetUsedRange(client, sessionId, config.sharepoint.sheetInventario);
      const invRows = invRange.values || [];
      const dataInv = invRows.slice(1);
      const invIndex = dataInv.findIndex(
        (r) =>
          r[0] === mov[0] &&
          r[1] === mov[1] &&
          r[2] === mov[2] &&
          String(r[4]).toLowerCase() === String(mov[4]).toLowerCase()
      );
      if (invIndex < 0) throw Object.assign(new Error('Ítem de inventario no encontrado'), { status: 404 });

      const invRow = dataInv[invIndex];
      const qty = Number(mov[3]) || 0;
      invRow[3] = (Number(invRow[3]) || 0) + qty;
      const invExcelRow = invIndex + 2;
      await graphUpdateCell(
        client,
        sessionId,
        config.sharepoint.sheetInventario,
        `D${invExcelRow}`,
        [[invRow[3]]]
      );

      return {
        inventario: rowToInventarioItem(invRow, invExcelRow),
        movimiento: rowToMovimiento(mov, movExcelRow),
      };
    } finally {
      await closeWorkbookSession(client, sessionId);
    }
  });
}

export function filterInventario(items, { q, ubicacion, tipo }) {
  let result = items;
  if (q) {
    const term = q.toLowerCase();
    result = result.filter(
      (i) =>
        i.nombre?.toLowerCase().includes(term) ||
        i.ubicacion?.toLowerCase().includes(term) ||
        i.tipo?.toLowerCase().includes(term) ||
        i.marca?.toLowerCase().includes(term)
    );
  }
  if (ubicacion) {
    result = result.filter((i) => i.ubicacion?.toLowerCase() === ubicacion.toLowerCase());
  }
  if (tipo) {
    result = result.filter((i) => i.tipo?.toLowerCase() === tipo.toLowerCase());
  }
  return result;
}

export function getLowStock(items) {
  return items.filter((i) => i.cantidad <= config.lowStockThreshold);
}

export async function getContenedorInventario(accessToken, contenedorId) {
  const items = await getInventario(accessToken);
  const filtered = items.filter((i) => matchesContenedorId(i, contenedorId));
  const first = filtered[0];
  return {
    contenedor: {
      id: contenedorId,
      ubicacion: first?.ubicacion ?? '',
      estante: first?.estante ?? '',
      contenedor: first?.contenedor ?? '',
      itemCount: filtered.length,
      totalStock: filtered.reduce((sum, i) => sum + i.cantidad, 0),
    },
    items: filtered,
    total: filtered.length,
  };
}

export async function listContenedores(accessToken) {
  const items = await getInventario(accessToken);
  const map = new Map();

  for (const item of items) {
    const id = item.contenedorId || buildContenedorId(item.ubicacion, item.estante, item.contenedor);
    if (!map.has(id)) {
      map.set(id, {
        id,
        ubicacion: item.ubicacion,
        estante: item.estante,
        contenedor: item.contenedor,
        itemCount: 0,
        totalStock: 0,
      });
    }
    const c = map.get(id);
    c.itemCount += 1;
    c.totalStock += item.cantidad;
  }

  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}
