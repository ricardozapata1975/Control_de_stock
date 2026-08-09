import * as XLSX from 'xlsx';

function normCode(c) {
  return String(c || '')
    .trim()
    .toUpperCase();
}

function parseSiemensPrice(raw) {
  const s = String(raw ?? '');
  const m = s.replace(/\s/g, '').match(/(\d+[.,]\d{1,4}|\d+)/);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function formatVigencia(val) {
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  const s = String(val ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime()) && /gmt|utc|\d{4}/i.test(s)) {
    return d.toISOString().slice(0, 10);
  }
  return s.slice(0, 80);
}

function parseNum(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(String(raw).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Detecta y parsea Lista Siemens AR (Tema, Familia, Subfamilia, Código, Descripción, Precio).
 */
export function parseSiemensSheet(rows) {
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 40); i += 1) {
    const r = rows[i] || [];
    const joined = r.map((c) => String(c).toLowerCase()).join('|');
    if (joined.includes('código') || joined.includes('codigo')) {
      if (joined.includes('descrip') || joined.includes('precio') || joined.includes('familia')) {
        headerIdx = i;
        break;
      }
    }
  }
  if (headerIdx < 0) return { rows: [], vigencia: '' };

  let vigencia = '';
  for (let i = 0; i < headerIdx; i += 1) {
    const t = String(rows[i]?.[0] || '');
    if (/vigencia/i.test(t)) vigencia = formatVigencia(t.replace(/^vigencia:\s*/i, '').trim());
  }

  const out = [];
  for (const r of rows.slice(headerIdx + 1)) {
    const codigo = normCode(r[3]);
    if (!codigo || codigo.length < 4) continue;
    const precio = parseSiemensPrice(r[5]);
    out.push({
      codigo,
      nombre: String(r[4] || '').trim(),
      tema: String(r[0] || '').trim(),
      familia: String(r[1] || '').trim(),
      subfamilia: String(r[2] || '').trim(),
      precioLista: precio,
      moneda: 'USD',
      catalogoFuente: 'siemens_ar',
      catalogoVigencia: vigencia,
    });
  }
  return { rows: out, vigencia, fuente: 'siemens_ar' };
}

/**
 * Parsea pricelist Sivacon S8 (Order-Number / MLFB + designation + price + weight).
 */
export function parseSivaconSheet(rows) {
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 40); i += 1) {
    const c0 = String(rows[i]?.[0] || '').toLowerCase();
    if (c0 === 'order-number' || c0 === 'mlfb') {
      // Prefer the English header row with Designation
      const c2 = String(rows[i]?.[2] || '').toLowerCase();
      if (c2.includes('designation') || c0 === 'order-number') {
        headerIdx = i;
        if (c2.includes('designation')) break;
      }
    }
  }
  if (headerIdx < 0) return { rows: [], vigencia: '' };

  let vigencia = '';
  for (let i = 0; i < headerIdx; i += 1) {
    const a = String(rows[i]?.[0] || '');
    const b = String(rows[i]?.[1] || '');
    if (/edited|ausgabestand/i.test(a) && b) vigencia = formatVigencia(b);
  }

  const out = [];
  for (const r of rows.slice(headerIdx + 1)) {
    const codigo = normCode(r[0]);
    if (!codigo || !/^[0-9A-Z]/.test(codigo) || codigo.length < 5) continue;
    if (codigo === 'ORDER-NUMBER' || codigo === 'MLFB') continue;
    const designation = String(r[2] || '').trim();
    const bezeichnung = String(r[1] || '').trim();
    out.push({
      codigo,
      nombre: designation || bezeichnung,
      unidad: String(r[3] || '').trim(),
      packing: String(r[4] || '').trim(),
      precioLista: parseNum(r[5]),
      moneda: 'EUR',
      pesoKg: parseNum(r[6]),
      catalogoFuente: 'sivacon_s8',
      catalogoVigencia: vigencia,
    });
  }
  return { rows: out, vigencia, fuente: 'sivacon_s8' };
}

/** Tornillería Boellhoff del mismo workbook Sivacon. */
export function parseBoellhoffSheet(rows) {
  const out = [];
  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i] || [];
    const codigo = normCode(r[0]);
    if (!codigo.startsWith('8PQ')) continue;
    out.push({
      codigo,
      nombre: String(r[1] || '').trim(),
      packing: String(r[2] || '').trim(),
      precioLista: parseNum(r[3]),
      moneda: 'EUR',
      catalogoFuente: 'sivacon_s8',
    });
  }
  return out;
}

/**
 * Lee workbook y elige parser según contenido / tip hint.
 * @returns {{ fuente, vigencia, rows }}
 */
export function parseCatalogWorkbook(arrayBuffer, tip = 'auto') {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const tipNorm = String(tip || 'auto').toLowerCase();

  if (tipNorm.includes('siemens') || tipNorm === 'siemens_ar') {
    const sh = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '' });
    return parseSiemensSheet(rows);
  }

  if (tipNorm.includes('sivacon') || tipNorm === 'sivacon_s8') {
    return parseSivaconWorkbook(wb);
  }

  // auto-detect
  const firstName = wb.SheetNames[0] || '';
  if (/siemens/i.test(firstName)) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[firstName], { header: 1, defval: '' });
    return parseSiemensSheet(rows);
  }
  if (wb.SheetNames.some((n) => /sivacon|pricelist/i.test(n))) {
    return parseSivaconWorkbook(wb);
  }

  // sniff first sheet
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', sheetRows: 30 });
  const flat = rows.flat().map((c) => String(c).toLowerCase()).join(' ');
  if (flat.includes('familia') && (flat.includes('código') || flat.includes('codigo'))) {
    const full = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
    return parseSiemensSheet(full);
  }
  return parseSivaconWorkbook(wb);
}

function parseSivaconWorkbook(wb) {
  const priceName =
    wb.SheetNames.find((n) => /pricelist|sivacon/i.test(n)) || wb.SheetNames[0];
  const priceRows = XLSX.utils.sheet_to_json(wb.Sheets[priceName], { header: 1, defval: '' });
  const main = parseSivaconSheet(priceRows);

  const bohName = wb.SheetNames.find((n) => /boellhoff|standard parts/i.test(n));
  if (bohName) {
    const bohRows = XLSX.utils.sheet_to_json(wb.Sheets[bohName], { header: 1, defval: '' });
    const boh = parseBoellhoffSheet(bohRows);
    const seen = new Set(main.rows.map((r) => r.codigo));
    for (const r of boh) {
      if (!seen.has(r.codigo)) {
        main.rows.push({ ...r, catalogoVigencia: main.vigencia });
        seen.add(r.codigo);
      }
    }
  }
  return main;
}

/** Filtra filas del catálogo a códigos presentes en stock. */
export function filterRowsToStock(catalogRows, itemCodesSet) {
  const matched = [];
  let unmatched = 0;
  for (const row of catalogRows || []) {
    const code = normCode(row.codigo);
    if (itemCodesSet.has(code)) matched.push(row);
    else unmatched += 1;
  }
  return { matched, unmatched };
}
