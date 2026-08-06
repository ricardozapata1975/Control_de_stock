import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const XLSX = require('../frontend/node_modules/xlsx');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '..', 'ejemplos');
fs.mkdirSync(dir, { recursive: true });

const headers = [
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

const rows = [
  [
    'Llave allen 10mm',
    'Stanley',
    'SA10',
    'Herramienta',
    'Juego métrico',
    'A01',
    'E01',
    'C01',
    8,
    'No aplica',
    'Set azul',
    '2026-01-15',
  ],
  [
    'Multímetro digital',
    'Fluke',
    '115',
    'Medición',
    'Uso eléctrico',
    'A01',
    'E02',
    'C03',
    2,
    'Sí - vigente 2026-08',
    'Funda amarilla',
    '2026-02-01',
  ],
  ['Resma A4', '', '', 'Consumible', '', 'A00', 'E03', '', 50, 'No aplica', 'Paquete 500 hojas', '2026-03-01'],
  [
    'Taladro percutor',
    'Bosch',
    'GSB 13 RE',
    'Herramienta',
    '13mm',
    'A01',
    'E01',
    'B01',
    1,
    'No aplica',
    'Maletín negro',
    '15/03/2026',
  ],
  ['Guantes nitrilo M', '', '', 'EPP', 'Caja x100', 'A00', 'E01', 'SC', 100, '', 'Talle M', '2026-04-01'],
];

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const csv =
  [headers.join(',')]
    .concat(rows.map((r) => r.map(csvEscape).join(',')))
    .join('\n') + '\n';

fs.writeFileSync(path.join(dir, 'plantilla-inventario-ejemplo.csv'), `\uFEFF${csv}`, 'utf8');

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
ws['!cols'] = headers.map((h) => ({ wch: Math.max(14, h.length + 2) }));
XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
XLSX.writeFile(wb, path.join(dir, 'plantilla-inventario-ejemplo.xlsx'));

console.log('Escritos en', dir);
