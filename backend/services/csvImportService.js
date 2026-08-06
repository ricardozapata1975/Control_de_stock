import { config } from '../config.js';
import * as demo from './demoService.js';
import { getSupabase } from '../db/supabase.js';
import { resolveUbicacion } from './ubicacionService.js';
import {
  ALMACEN_DEFAULT,
  getAduanaUbicacion,
  getArmariosMapSync,
  normalizeArmario,
  normalizeContenedor,
  normalizeEstante,
  SEDE_DEFAULT,
} from './ubicacionUtils.js';
import { itemCamposFromCsv, normalizeCodigoFabricante } from './itemFields.js';

const REQUIRED_NATIVO = ['nombre', 'armario', 'estante', 'cantidad'];
const REQUIRED_SISCOM = ['nombre', 'cantidad'];

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
  'codigo_fabricante',
];

const HEADER_ALIASES = {
  fecha_relevamiento_: 'fecha_relevamiento',
  fecha_de_relevamiento: 'fecha_relevamiento',
  fecha: 'fecha_relevamiento',
  // SISCOM / exports comunes
  descripcio: 'nombre',
  descripcion: 'nombre',
  descripción: 'nombre',
  desc: 'nombre',
  existencia: 'cantidad',
  stock: 'cantidad',
  cant: 'cantidad',
  codart: 'codigo_fabricante',
  codigo: 'codigo_fabricante',
  código: 'codigo_fabricante',
  codigo_articulo: 'codigo_fabricante',
  código_artículo: 'codigo_fabricante',
  idarticulo: 'id_origen',
  id_articulo: 'id_origen',
  deposito: 'deposito_origen',
  depósito: 'deposito_origen',
  ubicacion: 'deposito_origen',
  ubicación: 'deposito_origen',
};

export function getImportSpec() {
  return {
    formato:
      'CSV UTF-8 o Excel (.xlsx / .xls). Separador coma (,). Primera hoja en Excel. Acepta plantilla nativa o export SISCOM (DESCRIPCIO, CODART, DEPOSITO, EXISTENCIA).',
    columnas: [
      { nombre: 'nombre', obligatorio: true, ejemplo: 'Llave allen 10mm', descripcion: 'Nombre (o DESCRIPCIO en SISCOM)' },
      { nombre: 'marca', obligatorio: false, ejemplo: 'Stanley', descripcion: 'Marca' },
      { nombre: 'modelo', obligatorio: false, ejemplo: 'SA10', descripcion: 'Modelo' },
      { nombre: 'tipo', obligatorio: false, ejemplo: 'Herramienta', descripcion: 'Categoría' },
      { nombre: 'detalle', obligatorio: false, ejemplo: 'Juego métrico', descripcion: 'Notas' },
      {
        nombre: 'armario',
        obligatorio: false,
        ejemplo: 'A01',
        descripcion: `Obligatorio en formato nativo. En SISCOM se usa la aduana de la sede.`,
      },
      {
        nombre: 'estante',
        obligatorio: false,
        ejemplo: 'E01',
        descripcion: 'Obligatorio en formato nativo (E01–E09). En SISCOM: aduana.',
      },
      {
        nombre: 'contenedor',
        obligatorio: false,
        ejemplo: 'C01',
        descripcion: 'C01–C99, B00–B99, H01–H99 o SC. Vacío = suelto',
      },
      { nombre: 'cantidad', obligatorio: true, ejemplo: '5', descripcion: 'EXISTENCIA en SISCOM (acepta 2.00)' },
      {
        nombre: 'codigo_fabricante',
        obligatorio: false,
        ejemplo: '03UH',
        descripcion: 'CODART en SISCOM — sirve para reimportar / buscar',
      },
      {
        nombre: 'calibracion',
        obligatorio: false,
        ejemplo: 'Sí - vigente 2026-08',
        descripcion: 'Si requiere calibración',
      },
      {
        nombre: 'comentario',
        obligatorio: false,
        ejemplo: 'Mango verde',
        descripcion: 'En SISCOM se completa con depósito/ID de origen',
      },
      {
        nombre: 'fecha_relevamiento',
        obligatorio: false,
        ejemplo: '2026-03-15',
        descripcion: 'AAAA-MM-DD o DD/MM/AAAA. Vacío = hoy',
      },
    ],
    formatosSoportados: {
      nativo: 'nombre + armario + estante + cantidad (plantilla del sistema)',
      siscom:
        'IDARTICULO, CODART, DESCRIPCIO, DEPOSITO, EXISTENCIA → ingreso a aduana de la sede; reubicá después en Editor de Stock',
    },
    armarios: getArmariosMapSync(ALMACEN_DEFAULT),
    modos: {
      agregar: 'Suma stock si ya existe el ítem en la misma ubicación; crea ítem/ubicación si no existen.',
      reemplazar: 'Solo modo demo: borra inventario actual e importa el CSV desde cero.',
    },
    plantillaUrl: '/api/admin/import/plantilla.csv',
  };
}

export function buildTemplateCsv() {
  const header = ALL_COLUMNS.filter((c) => c !== 'codigo_fabricante').join(',');
  const rows = [
    'Llave allen 10mm,Stanley,SA10,Herramienta,Juego métrico,A01,E01,C01,8,No aplica,Set azul,2026-01-15',
    'Multímetro digital,Fluke,115,Medición,Uso eléctrico,A01,E02,C03,2,Sí - vigente 2026-08,Funda amarilla,2026-02-01',
    'Resma A4,,,Consumible,,A00,E03,,50,No aplica,Paquete 500 hojas,2026-03-01',
  ];
  return `${header}\n${rows.join('\n')}\n`;
}

function normalizeCsvHeader(h) {
  const key = String(h || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

function looksLikeHeader(headers) {
  const set = new Set(headers);
  if (set.has('nombre') && set.has('cantidad')) return true;
  if (set.has('armario') && set.has('estante')) return true;
  return false;
}

function detectFormato(headers) {
  const set = new Set(headers);
  // SISCOM típico: nombre (descripcio) + cantidad (existencia) + sin armario/estante
  if (
    set.has('nombre') &&
    set.has('cantidad') &&
    (set.has('codigo_fabricante') || set.has('deposito_origen') || set.has('id_origen')) &&
    !set.has('armario') &&
    !set.has('estante')
  ) {
    return 'siscom';
  }
  return 'nativo';
}

export function parseCsv(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!raw) throw Object.assign(new Error('El archivo CSV está vacío'), { status: 400 });

  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    throw Object.assign(new Error('El CSV debe tener encabezado y al menos una fila de datos'), {
      status: 400,
    });
  }

  // Buscar fila de encabezados (SISCOM pone un título arriba)
  let headerIdx = 0;
  let headers = parseCsvLine(lines[0]).map(normalizeCsvHeader);
  if (!looksLikeHeader(headers) && lines.length > 2) {
    const candidate = parseCsvLine(lines[1]).map(normalizeCsvHeader);
    if (looksLikeHeader(candidate)) {
      headerIdx = 1;
      headers = candidate;
    }
  }

  headers = headers.filter(Boolean);
  const formato = detectFormato(headers);
  const required = formato === 'siscom' ? REQUIRED_SISCOM : REQUIRED_NATIVO;
  const missing = required.filter((c) => !headers.includes(c));
  if (missing.length) {
    throw Object.assign(
      new Error(
        `Faltan columnas obligatorias: ${missing.join(', ')}. Formato detectado: ${formato}. Requeridas: ${required.join(', ')}`
      ),
      { status: 400 }
    );
  }

  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.every((v) => !v)) continue;
    const row = { linea: i + 1, _formato: formato };
    headers.forEach((h, idx) => {
      if (h) row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }

  if (!rows.length) throw Object.assign(new Error('No hay filas de datos'), { status: 400 });
  return { rows, formato, headers };
}

function parseCantidad(raw) {
  const n = Number(String(raw ?? '').replace(',', '.').trim());
  if (Number.isNaN(n) || n < 0) throw new Error('cantidad inválida');
  const rounded = Math.round(n);
  if (rounded < 0) throw new Error('cantidad debe ser ≥ 0');
  return rounded;
}

function buildComentarioSiscom(row, base = '') {
  const parts = [];
  if (base) parts.push(base);
  if (row.deposito_origen) parts.push(`Depósito SISCOM: ${String(row.deposito_origen).trim()}`);
  if (row.id_origen) parts.push(`ID SISCOM: ${String(row.id_origen).trim()}`);
  return parts.join(' · ');
}

function resolveAduanaDefaults(sede) {
  const code = String(sede || SEDE_DEFAULT).trim().toUpperCase() || SEDE_DEFAULT;
  const aduana = getAduanaUbicacion(code);
  if (!aduana?.almacen || !aduana?.armario || !aduana?.estante) {
    throw Object.assign(
      new Error(
        `La sede ${code} no tiene aduana de recepción configurada. Creá la sede/aduana en Locaciones antes de importar SISCOM.`
      ),
      { status: 400 }
    );
  }
  return {
    sede: code,
    almacen: aduana.almacen,
    armario: aduana.armario,
    estante: aduana.estante,
    contenedor: aduana.contenedor || 'C01',
  };
}

function validateRow(row, { sede, ubicacionDefault } = {}) {
  if (!row.nombre?.trim()) throw new Error('nombre vacío');
  const cantidad = parseCantidad(row.cantidad);
  const formato = row._formato || 'nativo';

  let ubicacion;
  if (formato === 'siscom') {
    ubicacion = ubicacionDefault || resolveAduanaDefaults(sede);
  } else {
    const alm = row.almacen?.trim() || ubicacionDefault?.almacen || ALMACEN_DEFAULT;
    ubicacion = {
      sede: sede || ubicacionDefault?.sede || null,
      almacen: alm,
      armario: normalizeArmario(row.armario, alm),
      estante: normalizeEstante(row.estante),
      contenedor: row.contenedor?.trim() ? normalizeContenedor(row.contenedor) : null,
    };
  }

  const campos = itemCamposFromCsv(row);
  const codigoFab =
    normalizeCodigoFabricante(row.codigo_fabricante) ||
    normalizeCodigoFabricante(row.codart) ||
    null;

  let comentario = campos.comentario || '';
  if (formato === 'siscom') {
    comentario = buildComentarioSiscom(row, comentario);
  }

  return {
    nombre: row.nombre.trim(),
    marca: row.marca?.trim() || '',
    modelo: row.modelo?.trim() || '',
    tipo: row.tipo?.trim() || '',
    detalle: row.detalle?.trim() || '',
    codigo_fabricante: codigoFab,
    sede: ubicacion.sede,
    almacen: ubicacion.almacen,
    armario: ubicacion.armario,
    estante: ubicacion.estante,
    contenedor: ubicacion.contenedor,
    cantidad,
    calibracion: campos.calibracion,
    comentario,
    fecha_relevamiento: campos.fecha_relevamiento,
    deposito_origen: row.deposito_origen ? String(row.deposito_origen).trim() : null,
    id_origen: row.id_origen ? String(row.id_origen).trim() : null,
    formato,
  };
}

async function findOrCreateItemDemo(db, data) {
  let item = null;
  if (data.codigo_fabricante) {
    item = db.items.find(
      (i) =>
        i.activo !== false &&
        String(i.codigo_fabricante || '').trim().toLowerCase() ===
          String(data.codigo_fabricante).trim().toLowerCase()
    );
  }
  if (!item) {
    item = db.items.find(
      (i) => i.nombre.toLowerCase() === data.nombre.toLowerCase() && i.activo !== false
    );
  }
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
      codigo_fabricante: data.codigo_fabricante,
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
    if (data.codigo_fabricante) item.codigo_fabricante = data.codigo_fabricante;
  }
  return item;
}

async function importRowDemo(db, data, modo) {
  const cont = demo.demoResolveUbicacionInMemory(db, {
    sede: data.sede,
    almacen: data.almacen,
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

async function findOrCreateItemSupabase(data) {
  const supabase = getSupabase();
  let itemId = null;

  if (data.codigo_fabricante) {
    const { data: byCode } = await supabase
      .from('items')
      .select('id')
      .eq('codigo_fabricante', data.codigo_fabricante)
      .eq('activo', true)
      .limit(1);
    itemId = byCode?.[0]?.id || null;
  }

  if (!itemId) {
    const { data: byName } = await supabase
      .from('items')
      .select('id')
      .ilike('nombre', data.nombre)
      .eq('activo', true)
      .limit(1);
    itemId = byName?.[0]?.id || null;
  }

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
  if (data.codigo_fabricante) itemRow.codigo_fabricante = data.codigo_fabricante;

  if (!itemId) {
    const { data: created, error } = await supabase.from('items').insert(itemRow).select('id').single();
    if (error) throw new Error(error.message);
    return created.id;
  }

  const { error } = await supabase.from('items').update(itemRow).eq('id', itemId);
  if (error) throw new Error(error.message);
  return itemId;
}

async function importRowSupabase(data, modo) {
  const cont = await resolveUbicacion({
    sede: data.sede,
    almacen: data.almacen,
    armario: data.armario,
    estante: data.estante,
    contenedor: data.contenedor,
  });
  const supabase = getSupabase();
  const itemId = await findOrCreateItemSupabase(data);

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

function prepareOptions(options = {}) {
  const sede = String(options.sede || SEDE_DEFAULT).trim().toUpperCase() || SEDE_DEFAULT;
  let ubicacionDefault = null;
  // Siempre resolvemos aduana si hay sede: SISCOM la usa; nativo puede omitir almacén
  try {
    ubicacionDefault = resolveAduanaDefaults(sede);
  } catch {
    ubicacionDefault = null;
  }
  return { sede, ubicacionDefault, modo: options.modo || 'agregar' };
}

export async function importCsv(csvText, options = {}) {
  const { sede, ubicacionDefault, modo } = prepareOptions(options);

  if (modo === 'reemplazar' && !config.demoMode) {
    throw Object.assign(
      new Error('El modo reemplazar solo está disponible con DEMO_MODE=true'),
      { status: 400 }
    );
  }

  const { rows, formato } = parseCsv(csvText);
  if (formato === 'siscom' && !ubicacionDefault) {
    throw Object.assign(
      new Error(
        `Formato SISCOM detectado: la sede ${sede} necesita aduana de recepción (Locaciones).`
      ),
      { status: 400 }
    );
  }

  const resultado = {
    ok: 0,
    errores: [],
    filas: rows.length,
    modo,
    formato,
    sede,
    ubicacionDestino: ubicacionDefault
      ? `${ubicacionDefault.almacen}-${ubicacionDefault.armario}-${ubicacionDefault.estante}${
          ubicacionDefault.contenedor ? `-${ubicacionDefault.contenedor}` : ''
        }`
      : null,
    codigos: [],
  };

  if (config.demoMode && modo === 'reemplazar') {
    await demo.demoResetInventario();
  }

  if (config.demoMode) {
    const db = await demo.demoLoadRaw();
    for (const row of rows) {
      try {
        const data = validateRow(row, { sede, ubicacionDefault });
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

  for (const row of rows) {
    try {
      const data = validateRow(row, { sede, ubicacionDefault });
      const r = await importRowSupabase(data, modo);
      resultado.ok++;
      resultado.codigos.push(r.codigo);
    } catch (e) {
      resultado.errores.push({ linea: row.linea, error: e.message });
    }
  }
  return resultado;
}

/** Analiza el CSV/Excel sin escribir en la base. */
export function previewCsv(csvText, options = {}) {
  const { sede, ubicacionDefault } = prepareOptions(options);
  const { rows, formato } = parseCsv(csvText);

  if (formato === 'siscom' && !ubicacionDefault) {
    throw Object.assign(
      new Error(
        `Formato SISCOM detectado: la sede ${sede} necesita aduana de recepción (Locaciones).`
      ),
      { status: 400 }
    );
  }

  const preview = [];
  const errores = [];

  for (const row of rows) {
    try {
      const data = validateRow(row, { sede, ubicacionDefault });
      preview.push({
        linea: row.linea,
        ok: true,
        nombre: data.nombre,
        codigoFabricante: data.codigo_fabricante || '',
        marca: data.marca,
        modelo: data.modelo,
        tipo: data.tipo,
        armario: data.armario,
        estante: data.estante,
        contenedor: data.contenedor || '',
        cantidad: data.cantidad,
        depositoOrigen: data.deposito_origen || '',
        comentario: data.comentario || '',
      });
    } catch (e) {
      const err = { linea: row.linea, error: e.message };
      errores.push(err);
      preview.push({
        linea: row.linea,
        ok: false,
        nombre: row.nombre || '',
        error: e.message,
      });
    }
  }

  return {
    filas: rows.length,
    validas: preview.filter((r) => r.ok).length,
    invalidas: errores.length,
    formato,
    sede,
    ubicacionDestino: ubicacionDefault
      ? `${ubicacionDefault.almacen}-${ubicacionDefault.armario}-${ubicacionDefault.estante}${
          ubicacionDefault.contenedor ? `-${ubicacionDefault.contenedor}` : ''
        }`
      : null,
    nota:
      formato === 'siscom'
        ? 'SISCOM: el stock entra en la aduana de recepción de la sede. Después podés reubicarlo con Editor de Stock → Editar existente.'
        : null,
    errores,
    preview,
  };
}
