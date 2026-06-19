import { config } from '../config.js';
import * as demo from './demoService.js';
import { getSupabase } from '../db/supabase.js';
import { resolveUbicacion } from './ubicacionService.js';
import {
  ALMACEN_DEFAULT,
  getArmariosMapSync,
  normalizeArmario,
  normalizeContenedor,
  normalizeEstante,
} from './ubicacionUtils.js';
import { itemCamposFromCsv } from './itemFields.js';

const REQUIRED_COLUMNS = ['nombre', 'armario', 'estante', 'cantidad'];
const OPTIONAL_COLUMNS = [
  'marca',
  'modelo',
  'tipo',
  'detalle',
  'contenedor',
  'calibracion',
  'comentario',
  'fecha_relevamiento',
];
const ALL_COLUMNS = [
  'nombre',
  'marca',
  'modelo',
  'tipo',
  'detalle',
  'armario',
  'estante',
  'contenedor',
  'cantidad',
  'calibracion',
  'comentario',
  'fecha_relevamiento',
];

export function getImportSpec() {
  return {
    formato: 'CSV UTF-8, separador coma (,). Primera fila = encabezados.',
    columnas: [
      { nombre: 'nombre', obligatorio: true, ejemplo: 'Llave allen 10mm', descripcion: 'Nombre de la herramienta' },
      { nombre: 'marca', obligatorio: false, ejemplo: 'Stanley', descripcion: 'Marca' },
      { nombre: 'modelo', obligatorio: false, ejemplo: 'SA10', descripcion: 'Modelo' },
      { nombre: 'tipo', obligatorio: false, ejemplo: 'Herramienta', descripcion: 'Categoría' },
      { nombre: 'detalle', obligatorio: false, ejemplo: 'Juego métrico', descripcion: 'Notas' },
      {
        nombre: 'armario',
        obligatorio: true,
        ejemplo: 'A01',
        descripcion: `Código de armario en ${ALMACEN_DEFAULT}: ${Object.keys(getArmariosMapSync(ALMACEN_DEFAULT)).join(', ')}`,
      },
      {
        nombre: 'estante',
        obligatorio: true,
        ejemplo: 'E01',
        descripcion: 'Estante E01–E09 (también acepta 1–9)',
      },
      {
        nombre: 'contenedor',
        obligatorio: false,
        ejemplo: 'C01',
        descripcion: 'C01–C99, B00–B99, H01–H99 o SC. Vacío = suelto en estante',
      },
      { nombre: 'cantidad', obligatorio: true, ejemplo: '5', descripcion: 'Unidades en stock (entero ≥ 0)' },
      {
        nombre: 'calibracion',
        obligatorio: false,
        ejemplo: 'Sí - vigente 2026-08',
        descripcion: 'Si requiere calibración y estado',
      },
      {
        nombre: 'comentario',
        obligatorio: false,
        ejemplo: 'Mango verde',
        descripcion: 'Dato distintivo (color, forma, etc.)',
      },
      {
        nombre: 'fecha_relevamiento',
        obligatorio: false,
        ejemplo: '2026-03-15',
        descripcion: 'Fecha alta/actualización. AAAA-MM-DD o DD/MM/AAAA (ej. 21/5/2026). Vacío = hoy',
      },
    ],
    armarios: getArmariosMapSync(ALMACEN_DEFAULT),
    modos: {
      agregar: 'Suma stock si ya existe el ítem en la misma ubicación; crea ítem/ubicación si no existen.',
      reemplazar: 'Solo modo demo: borra inventario actual e importa el CSV desde cero.',
    },
    plantillaUrl: '/api/admin/import/plantilla.csv',
  };
}

export function buildTemplateCsv() {
  const header = ALL_COLUMNS.join(',');
  const rows = [
    'Llave allen 10mm,Stanley,SA10,Herramienta,Juego métrico,A01,E01,C01,8,No aplica,Set azul,2026-01-15',
    'Multímetro digital,Fluke,115,Medición,Uso eléctrico,A01,E02,C03,2,Sí - vigente 2026-08,Funda amarilla,2026-02-01',
    'Resma A4,,,Consumible,,A00,E03,,50,No aplica,Paquete 500 hojas,2026-03-01',
  ];
  return `${header}\n${rows.join('\n')}\n`;
}

const HEADER_ALIASES = {
  fecha_relevamiento_: 'fecha_relevamiento',
  fecha_de_relevamiento: 'fecha_relevamiento',
  fecha: 'fecha_relevamiento',
};

function normalizeCsvHeader(h) {
  const key = String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/_+$/, '');
  return HEADER_ALIASES[key] || key;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseCsv(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!raw) throw Object.assign(new Error('El archivo CSV está vacío'), { status: 400 });

  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    throw Object.assign(new Error('El CSV debe tener encabezado y al menos una fila de datos'), { status: 400 });
  }

  const headers = parseCsvLine(lines[0])
    .map((h) => normalizeCsvHeader(h))
    .filter(Boolean);
  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length) {
    throw Object.assign(
      new Error(`Faltan columnas obligatorias: ${missing.join(', ')}. Requeridas: ${REQUIRED_COLUMNS.join(', ')}`),
      { status: 400 }
    );
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.every((v) => !v)) continue;
    const row = { linea: i + 1 };
    headers.forEach((h, idx) => {
      if (h) row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }

  if (!rows.length) throw Object.assign(new Error('No hay filas de datos'), { status: 400 });
  return rows;
}

function validateRow(row) {
  if (!row.nombre?.trim()) throw new Error('nombre vacío');
  const cantidad = Number(row.cantidad);
  if (Number.isNaN(cantidad) || cantidad < 0 || !Number.isInteger(cantidad)) {
    throw new Error('cantidad debe ser un entero ≥ 0');
  }
  normalizeArmario(row.armario, ALMACEN_DEFAULT);
  normalizeEstante(row.estante);
  if (row.contenedor?.trim()) normalizeContenedor(row.contenedor);
  return {
    nombre: row.nombre.trim(),
    marca: row.marca?.trim() || '',
    modelo: row.modelo?.trim() || '',
    tipo: row.tipo?.trim() || '',
    detalle: row.detalle?.trim() || '',
    armario: normalizeArmario(row.armario, ALMACEN_DEFAULT),
    estante: normalizeEstante(row.estante),
    contenedor: row.contenedor?.trim() ? normalizeContenedor(row.contenedor) : null,
    cantidad,
    ...itemCamposFromCsv(row),
  };
}

async function findOrCreateItemDemo(db, data) {
  let item = db.items.find((i) => i.nombre.toLowerCase() === data.nombre.toLowerCase() && i.activo !== false);
  if (!item) {
    item = {
      id: `item-${data.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}-${Date.now().toString(36)}`,
      nombre: data.nombre,
      marca: data.marca,
      modelo: data.modelo,
      tipo: data.tipo,
      detalle: data.detalle,
      calibracion: data.calibracion,
      comentario: data.comentario,
      fecha_relevamiento: data.fecha_relevamiento,
      activo: true,
    };
    db.items.push(item);
  } else {
    item.marca = data.marca || item.marca;
    item.modelo = data.modelo || item.modelo;
    item.tipo = data.tipo || item.tipo;
    item.detalle = data.detalle || item.detalle;
    if (data.calibracion) item.calibracion = data.calibracion;
    if (data.comentario) item.comentario = data.comentario;
    if (data.fecha_relevamiento) item.fecha_relevamiento = data.fecha_relevamiento;
  }
  return item;
}

async function importRowDemo(db, data, modo) {
  const cont = demo.demoResolveUbicacionInMemory(db, {
    armario: data.armario,
    estante: data.estante,
    contenedor: data.contenedor,
  });
  const item = await findOrCreateItemDemo(db, data);
  let stock = db.stock.find((s) => s.item_id === item.id && s.contenedor_id === cont.id);
  if (stock) {
    stock.cantidad = modo === 'reemplazar' ? data.cantidad : stock.cantidad + data.cantidad;
  } else {
    db.stock.push({
      id: `stk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      item_id: item.id,
      contenedor_id: cont.id,
      cantidad: data.cantidad,
    });
  }
  return { itemId: item.id, codigo: cont.codigo };
}

async function importRowSupabase(data, modo) {
  const cont = await resolveUbicacion({
    armario: data.armario,
    estante: data.estante,
    contenedor: data.contenedor,
  });
  const supabase = getSupabase();

  const { data: items } = await supabase
    .from('items')
    .select('id')
    .ilike('nombre', data.nombre)
    .eq('activo', true)
    .limit(1);

  let itemId = items?.[0]?.id;
  const itemRow = {
    nombre: data.nombre,
    marca: data.marca,
    modelo: data.modelo,
    tipo: data.tipo,
    detalle: data.detalle,
    calibracion: data.calibracion,
    comentario: data.comentario,
    fecha_relevamiento: data.fecha_relevamiento,
    activo: true,
  };
  if (!itemId) {
    const { data: created, error } = await supabase.from('items').insert(itemRow).select('id').single();
    if (error) throw new Error(error.message);
    itemId = created.id;
  } else {
    const { error } = await supabase.from('items').update(itemRow).eq('id', itemId);
    if (error) throw new Error(error.message);
  }

  const { data: stockRow } = await supabase
    .from('stock')
    .select('id, cantidad')
    .eq('item_id', itemId)
    .eq('contenedor_id', cont.id)
    .maybeSingle();

  if (stockRow) {
    const nueva = modo === 'reemplazar' ? data.cantidad : stockRow.cantidad + data.cantidad;
    const { error } = await supabase.from('stock').update({ cantidad: nueva }).eq('id', stockRow.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('stock').insert({
      item_id: itemId,
      contenedor_id: cont.id,
      cantidad: data.cantidad,
    });
    if (error) throw new Error(error.message);
  }

  return { itemId, codigo: cont.codigo };
}

export async function importCsv(csvText, { modo = 'agregar' } = {}) {
  if (modo === 'reemplazar' && !config.demoMode) {
    throw Object.assign(
      new Error('El modo reemplazar solo está disponible con DEMO_MODE=true'),
      { status: 400 }
    );
  }

  const parsed = parseCsv(csvText);
  const resultado = {
    ok: 0,
    errores: [],
    filas: parsed.length,
    modo,
    codigos: [],
  };

  if (config.demoMode && modo === 'reemplazar') {
    await demo.demoResetInventario();
  }

  if (config.demoMode) {
    const db = await demo.demoLoadRaw();
    for (const row of parsed) {
      try {
        const data = validateRow(row);
        const r = await importRowDemo(db, data, modo);
        resultado.ok++;
        resultado.codigos.push(r.codigo);
      } catch (e) {
        resultado.errores.push({ linea: row.linea, error: e.message });
      }
    }
    await demo.demoSaveRaw(db);
    return resultado;
  }

  for (const row of parsed) {
    try {
      const data = validateRow(row);
      const r = await importRowSupabase(data, modo);
      resultado.ok++;
      resultado.codigos.push(r.codigo);
    } catch (e) {
      resultado.errores.push({ linea: row.linea, error: e.message });
    }
  }
  return resultado;
}
