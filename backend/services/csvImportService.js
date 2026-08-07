import { config } from '../config.js';
import * as demo from './demoService.js';
import { getSupabase } from '../db/supabase.js';
import { ensureArmarioCodigo } from './catalogoService.js';
import { resolveUbicacion } from './ubicacionService.js';
import {
  ALMACEN_DEFAULT,
  getAduanaUbicacion,
  getArmariosMapSync,
  listAlmacenes,
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
        ejemplo: 'A11',
        descripcion:
          'Obligatorio en formato nativo (A00–A99). En SISCOM se deriva de DEPOSITO (11.41 → A11).',
      },
      {
        nombre: 'estante',
        obligatorio: false,
        ejemplo: 'E41',
        descripcion:
          'Obligatorio en formato nativo (E00–E99). En SISCOM se deriva de DEPOSITO (11.41 → E41).',
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
        'IDARTICULO, CODART, DESCRIPCIO, DEPOSITO, EXISTENCIA → DEPOSITO 11.41 se mapea a A11-E41 en el almacén elegido (crea gabinetes si faltan)',
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

function formatArmarioNum(n) {
  return `A${String(n).padStart(2, '0')}`;
}

function formatEstanteNum(n) {
  return `E${String(n).padStart(2, '0')}`;
}

/**
 * SISCOM DEPOSITO "11.41" → gabinete/estantería 11 + estante/gaveta 41 → A11 + E41.
 * Acepta "11.41", "11,41", "A11-E41".
 */
export function parseDepositoSiscom(raw) {
  const s = String(raw ?? '')
    .trim()
    .replace(',', '.')
    .replace(/\s+/g, '');
  if (!s || s === '-' || s === '.') return null;

  const dotted = s.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (dotted) {
    const arm = parseInt(dotted[1], 10);
    const est = parseInt(dotted[2], 10);
    if (arm < 0 || arm > 99 || est < 0 || est > 99) return null;
    return { armario: formatArmarioNum(arm), estante: formatEstanteNum(est), origen: s };
  }

  const coded = s.match(/^A(\d{1,2})-E(\d{1,2})$/i);
  if (coded) {
    const arm = parseInt(coded[1], 10);
    const est = parseInt(coded[2], 10);
    if (arm > 99 || est > 99) return null;
    return { armario: formatArmarioNum(arm), estante: formatEstanteNum(est), origen: s };
  }

  const slash = s.match(/^(\d{1,2})[\/_](\d{1,2})$/);
  if (slash) {
    const arm = parseInt(slash[1], 10);
    const est = parseInt(slash[2], 10);
    if (arm > 99 || est > 99) return null;
    return { armario: formatArmarioNum(arm), estante: formatEstanteNum(est), origen: s };
  }

  const onlyInt = s.match(/^(\d{1,2})$/);
  if (onlyInt) {
    const arm = parseInt(onlyInt[1], 10);
    return { armario: formatArmarioNum(arm), estante: 'E00', origen: s };
  }

  return null;
}

function resolveAduanaDefaults(sede) {
  const code = String(sede || SEDE_DEFAULT).trim().toUpperCase() || SEDE_DEFAULT;
  const aduana = getAduanaUbicacion(code);
  if (!aduana?.almacen || !aduana?.armario || !aduana?.estante) {
    throw Object.assign(
      new Error(
        `La sede ${code} no tiene aduana de recepción configurada. Creá la sede/aduana en Locaciones antes de importar.`
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

/** Almacén de destino: el pedido, o el primero de la sede que no sea aduana. */
export function resolveAlmacenDestino(sede, almacenOpt) {
  const sedeCode = String(sede || SEDE_DEFAULT).trim().toUpperCase() || SEDE_DEFAULT;
  const aduana = getAduanaUbicacion(sedeCode);
  const alms = listAlmacenes(sedeCode);

  if (almacenOpt) {
    const code = String(almacenOpt).trim().toUpperCase();
    const found = alms.find((a) => a.codigo === code) || listAlmacenes().find((a) => a.codigo === code);
    if (!found) {
      throw Object.assign(new Error(`Almacén no registrado: ${code}`), { status: 400 });
    }
    return code;
  }

  const noAduana = alms.filter((a) => a.codigo !== aduana?.almacen);
  if (noAduana.length) return noAduana[0].codigo;
  if (alms.length) return alms[0].codigo;
  if (aduana?.almacen) return aduana.almacen;
  return ALMACEN_DEFAULT;
}

/**
 * Extrae Axx/Exx del row: DEPOSITO SISCOM, columnas nativas, o calibración mal mapeada (11.41).
 */
function extractArmarioEstanteFromRow(row) {
  if (row.deposito_origen) {
    const parsed = parseDepositoSiscom(row.deposito_origen);
    if (parsed) return parsed;
  }

  const armRaw = String(row.armario || '').trim();
  const estRaw = String(row.estante || '').trim();
  if (armRaw && estRaw) {
    const am = armRaw.toUpperCase().replace(/\s+/g, '').match(/^A?(\d{1,2})$/i);
    const em = estRaw.toUpperCase().replace(/\s+/g, '').match(/^E?(\d{1,2})$/i);
    if (am && em) {
      return {
        armario: formatArmarioNum(parseInt(am[1], 10)),
        estante: formatEstanteNum(parseInt(em[1], 10)),
        origen: `${armRaw}/${estRaw}`,
      };
    }
    return { armario: armRaw, estante: estRaw, origen: `${armRaw}/${estRaw}` };
  }

  // Excel convertido a medias: calibracion = "11.41"
  const cal = String(row.calibracion || '').trim();
  if (cal && /^\d{1,2}[.,]\d{1,2}$/.test(cal)) {
    const parsed = parseDepositoSiscom(cal);
    if (parsed) return { ...parsed, fromCalibracion: true };
  }

  if (row.deposito_origen) {
    throw new Error(
      `Depósito SISCOM no mapeable: "${row.deposito_origen}". Esperado NN.NN (ej. 11.41 → A11-E41)`
    );
  }
  return null;
}

function validateRow(row, { sede, ubicacionDefault, forzarAduana = false, almacenDestino = null } = {}) {
  if (!row.nombre?.trim()) throw new Error('nombre vacío');
  const cantidad = parseCantidad(row.cantidad);
  const formato = row._formato || 'nativo';

  let ubicacion;
  let mappedFromDeposito = null;
  let clearCalibracion = false;

  if (forzarAduana) {
    ubicacion = ubicacionDefault || resolveAduanaDefaults(sede);
  } else {
    const extracted = extractArmarioEstanteFromRow(row);
    if (!extracted?.armario || !extracted?.estante) {
      throw new Error('Faltan armario/estante (o DEPOSITO SISCOM tipo 11.41)');
    }
    mappedFromDeposito = extracted;
    if (extracted.fromCalibracion) clearCalibracion = true;

    // El almacén elegido en la UI manda; en SISCOM se ignora cualquier columna almacen del archivo
    // (si no, filas con ALM01 residual validan contra A00–A02 y fallan el resto).
    const almFromFile =
      formato === 'siscom' ? '' : String(row.almacen || '').trim().toUpperCase();
    const alm =
      (almacenDestino && String(almacenDestino).trim().toUpperCase()) ||
      almFromFile ||
      ubicacionDefault?.almacen ||
      ALMACEN_DEFAULT;

    ubicacion = {
      sede: sede || ubicacionDefault?.sede || null,
      almacen: alm,
      armario: extracted.armario,
      estante: extracted.estante,
      contenedor: row.contenedor?.trim() ? normalizeContenedor(row.contenedor) : null,
    };
  }

  const campos = itemCamposFromCsv(row);
  const codigoFab =
    normalizeCodigoFabricante(row.codigo_fabricante) ||
    normalizeCodigoFabricante(row.codart) ||
    null;

  let comentario = campos.comentario || '';
  let calibracion = clearCalibracion ? '' : campos.calibracion || '';

  // En conversiones a medias, "calibracion" suele traer el depósito (11.41)
  if (!clearCalibracion && calibracion && /^\d{1,2}([.,]\d{1,2})$/.test(calibracion.trim())) {
    const tag = `Depósito SISCOM: ${calibracion.trim()}`;
    comentario = comentario ? `${comentario} · ${tag}` : tag;
    calibracion = '';
  }

  if (formato === 'siscom') {
    comentario = buildComentarioSiscom(row, comentario);
  } else if (forzarAduana) {
    const origenParts = [];
    if (row.armario) origenParts.push(`armario ${String(row.armario).trim()}`);
    if (row.estante) origenParts.push(`estante ${String(row.estante).trim()}`);
    if (row.contenedor) origenParts.push(`cont. ${String(row.contenedor).trim()}`);
    if (calibracion && /^\d+(\.\d+)?$/.test(calibracion)) {
      origenParts.push(`depósito origen ${calibracion}`);
      calibracion = '';
    }
    if (origenParts.length) {
      const tag = `Origen archivo: ${origenParts.join(', ')}`;
      comentario = comentario ? `${comentario} · ${tag}` : tag;
    }
  } else if (mappedFromDeposito?.origen && formato === 'nativo' && clearCalibracion) {
    const tag = `Depósito SISCOM: ${mappedFromDeposito.origen}`;
    comentario = comentario ? `${comentario} · ${tag}` : tag;
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
    calibracion,
    comentario,
    fecha_relevamiento: campos.fecha_relevamiento,
    deposito_origen: row.deposito_origen ? String(row.deposito_origen).trim() : null,
    id_origen: row.id_origen ? String(row.id_origen).trim() : null,
    formato: forzarAduana && formato === 'nativo' ? 'nativo_aduana' : formato,
    mapeo: mappedFromDeposito
      ? `${mappedFromDeposito.origen || ''} → ${ubicacion.armario}-${ubicacion.estante}`
      : null,
    _needsNormalize: !forzarAduana,
  };
}

/** Normaliza armario/estante contra el catálogo (tras ensureArmario). */
function finalizeUbicacion(data) {
  if (!data._needsNormalize) {
    const { _needsNormalize, ...rest } = data;
    return rest;
  }
  const armario = normalizeArmario(data.armario, data.almacen);
  const estante = normalizeEstante(data.estante);
  const origen = data.mapeo ? String(data.mapeo).split('→')[0].trim() : '';
  const { _needsNormalize, ...rest } = data;
  return {
    ...rest,
    armario,
    estante,
    mapeo: origen ? `${origen} → ${armario}-${estante}` : null,
  };
}

async function ensureArmariosFromRows(rows, { sede, almacenDestino, forzarAduana }) {
  if (forzarAduana) return { creados: [], almacen: null };
  const alm = almacenDestino || resolveAlmacenDestino(sede, null);
  const codes = new Set();
  for (const row of rows) {
    try {
      const extracted = extractArmarioEstanteFromRow(row);
      if (extracted?.armario) {
        const code = String(extracted.armario)
          .trim()
          .toUpperCase()
          .replace(/\s+/g, '');
        const m = code.match(/^A?(\d{1,2})$/i);
        if (m) codes.add(formatArmarioNum(parseInt(m[1], 10)));
        else if (/^A\d{2}$/i.test(code)) codes.add(code.toUpperCase());
      }
    } catch {
      // fila inválida: se reporta en validate
    }
  }
  const creados = [];
  for (const codigo of [...codes].sort()) {
    const r = await ensureArmarioCodigo({
      almacen: alm,
      codigo,
      tipo: 'Gabinete',
      nombre: `Gabinete SISCOM ${codigo.replace(/^A/, '')}`,
    });
    if (!r.existed) creados.push(codigo);
  }
  return { creados, almacen: alm };
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
  const forzarAduana = Boolean(options.forzarAduana);
  let ubicacionDefault = null;
  try {
    ubicacionDefault = resolveAduanaDefaults(sede);
  } catch {
    ubicacionDefault = null;
  }
  let almacenDestino = null;
  if (!forzarAduana) {
    try {
      almacenDestino = resolveAlmacenDestino(sede, options.almacen || null);
    } catch {
      almacenDestino = options.almacen || null;
    }
  }
  return {
    sede,
    ubicacionDefault,
    modo: options.modo || 'agregar',
    forzarAduana,
    almacenDestino,
  };
}

function aggregateErrores(errores) {
  const counts = {};
  for (const e of errores) {
    const key = e.error || 'Error desconocido';
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([error, count]) => ({ error, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function buildUbicacionLabel(u) {
  if (!u?.almacen || !u?.armario || !u?.estante) return null;
  return `${u.almacen}-${u.armario}-${u.estante}${u.contenedor ? `-${u.contenedor}` : ''}`;
}

export async function importCsv(csvText, options = {}) {
  const { sede, ubicacionDefault, modo, forzarAduana, almacenDestino } = prepareOptions(options);

  if (modo === 'reemplazar' && !config.demoMode) {
    throw Object.assign(
      new Error('El modo reemplazar solo está disponible con DEMO_MODE=true'),
      { status: 400 }
    );
  }

  const { rows, formato } = parseCsv(csvText);
  if (forzarAduana && !ubicacionDefault) {
    throw Object.assign(
      new Error(
        `Se requiere aduana de recepción para la sede ${sede}. Configurala en Locaciones.`
      ),
      { status: 400 }
    );
  }

  const ensure = await ensureArmariosFromRows(rows, { sede, almacenDestino, forzarAduana });
  const almFinal = forzarAduana ? ubicacionDefault?.almacen : ensure.almacen || almacenDestino;

  const resultado = {
    ok: 0,
    errores: [],
    filas: rows.length,
    modo,
    formato: forzarAduana && formato === 'nativo' ? 'nativo_aduana' : formato,
    forzarAduana,
    sede,
    almacen: almFinal,
    armariosCreados: ensure.creados,
    ubicacionDestino: forzarAduana
      ? buildUbicacionLabel(ubicacionDefault)
      : `${almFinal}-{Axx}-{Exx} (según DEPOSITO / archivo)`,
    codigos: [],
  };

  if (config.demoMode && modo === 'reemplazar') {
    await demo.demoResetInventario();
  }

  const rowOpts = { sede, ubicacionDefault, forzarAduana, almacenDestino: almFinal };

  if (config.demoMode) {
    const db = await demo.demoLoadRaw();
    for (const row of rows) {
      try {
        const data = finalizeUbicacion(validateRow(row, rowOpts));
        const r = await importRowDemo(db, data, modo);
        resultado.ok++;
        resultado.codigos.push(r.codigo);
      } catch (e) {
        resultado.errores.push({ linea: row.linea, error: e.message });
      }
    }
    await demo.demoSaveRaw(db);
    resultado.erroresFrecuentes = aggregateErrores(resultado.errores);
    return resultado;
  }

  for (const row of rows) {
    try {
      const data = finalizeUbicacion(validateRow(row, rowOpts));
      const r = await importRowSupabase(data, modo);
      resultado.ok++;
      resultado.codigos.push(r.codigo);
    } catch (e) {
      resultado.errores.push({ linea: row.linea, error: e.message });
    }
  }
  resultado.erroresFrecuentes = aggregateErrores(resultado.errores);
  return resultado;
}

/** Analiza el CSV/Excel sin escribir stock (sí puede crear gabinetes faltantes Axx). */
export async function previewCsv(csvText, options = {}) {
  const { sede, ubicacionDefault, forzarAduana, almacenDestino } = prepareOptions(options);
  const { rows, formato } = parseCsv(csvText);

  if (forzarAduana && !ubicacionDefault) {
    throw Object.assign(
      new Error(
        `Se requiere aduana de recepción para la sede ${sede}. Configurala en Locaciones.`
      ),
      { status: 400 }
    );
  }

  const ensure = await ensureArmariosFromRows(rows, { sede, almacenDestino, forzarAduana });
  const almFinal = forzarAduana ? ubicacionDefault?.almacen : ensure.almacen || almacenDestino;
  const rowOpts = { sede, ubicacionDefault, forzarAduana, almacenDestino: almFinal };

  const preview = [];
  const errores = [];
  const mapeos = {};

  for (const row of rows) {
    try {
      const data = finalizeUbicacion(validateRow(row, rowOpts));
      if (data.mapeo) {
        mapeos[data.mapeo] = (mapeos[data.mapeo] || 0) + 1;
      }
      preview.push({
        linea: row.linea,
        ok: true,
        nombre: data.nombre,
        codigoFabricante: data.codigo_fabricante || '',
        marca: data.marca,
        modelo: data.modelo,
        tipo: data.tipo,
        almacen: data.almacen,
        armario: data.armario,
        estante: data.estante,
        contenedor: data.contenedor || '',
        cantidad: data.cantidad,
        depositoOrigen: data.deposito_origen || '',
        mapeo: data.mapeo || '',
        ubicacion: buildUbicacionLabel(data),
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
        armarioArchivo: row.armario || '',
        estanteArchivo: row.estante || '',
        depositoOrigen: row.deposito_origen || '',
      });
    }
  }

  const erroresFrecuentes = aggregateErrores(errores);
  const mapeosFrecuentes = Object.entries(mapeos)
    .map(([mapeo, count]) => ({ mapeo, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  let nota = null;
  if (forzarAduana) {
    nota =
      'Forzaste aduana: el stock entra en la recepción de la sede. El origen queda en el comentario.';
  } else if (formato === 'siscom') {
    nota =
      'DEPOSITO SISCOM (ej. 11.41) se mapea a gabinete A11 + estante/gaveta E41 en el almacén elegido. Se crean gabinetes faltantes automáticamente.';
  } else if (mapeosFrecuentes.length) {
    nota =
      'Se detectaron depósitos tipo NN.NN (o Axx/Exx) y se mapearon a la codificación de la app.';
  }

  return {
    filas: rows.length,
    validas: preview.filter((r) => r.ok).length,
    invalidas: errores.length,
    formato: forzarAduana && formato === 'nativo' ? 'nativo_aduana' : formato,
    forzarAduana,
    sede,
    almacen: almFinal,
    armariosCreados: ensure.creados,
    ubicacionDestino: forzarAduana
      ? buildUbicacionLabel(ubicacionDefault)
      : almFinal
        ? `${almFinal} (ubicaciones según DEPOSITO / armario-estante)`
        : null,
    sugerirAduana: false,
    nota,
    errores,
    erroresFrecuentes,
    mapeosFrecuentes,
    preview,
  };
}
