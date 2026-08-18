import * as XLSX from 'xlsx';
import { siemensCatalogUrl } from '../../../utils/siemensCatalog';

function safeName(s) {
  return String(s || 'reservas')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .trim()
    .slice(0, 80);
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/**
 * Exporta reservas activas (filtro activo).
 * @param {object[]} rows
 * @param {object} meta - { sede, proveedor, proyectoNombre, tableroNombre }
 */
export function exportReservasExcel(rows, meta = {}) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) throw new Error('No hay reservas para exportar con el filtro actual.');

  const filtrosRows = [
    ['Filtro', 'Valor'],
    ['Sede', meta.sede || 'Todas'],
    ['Proveedor', meta.proveedor || 'Todos'],
    ['Proyecto', meta.proyectoNombre || 'Todos'],
    ['Tablero', meta.tableroNombre || 'Todos'],
    ['Exportado', new Date().toLocaleString('es-AR')],
    ['Líneas', list.length],
    ['Cantidad', list.reduce((a, r) => a + Number(r.cantidad || 0), 0)],
  ];

  const dataRows = [
    [
      'Proveedor',
      'Codigo',
      'Descripcion',
      'Detalle',
      'Marca',
      'Modelo',
      'Cantidad',
      'Ubicacion',
      'Proyecto',
      'Tablero',
      'Estado',
      'Ficha Siemens',
    ],
    ...list.map((r) => {
      const codigo = r.codigoFabricante || r.codigoArticulo || '';
      return [
        r.proveedor || 'Sin proveedor',
        codigo,
        r.nombre || '',
        r.detalle || '',
        r.marca || '',
        r.modelo || '',
        r.cantidad ?? '',
        r.contenedorCodigo || '',
        r.proyectoNombre || '',
        r.tableroNombre || '',
        r.estado || '',
        siemensCatalogUrl(codigo) || '',
      ];
    }),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filtrosRows), 'Filtros');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dataRows), 'Reservas');

  const fileBase = safeName(
    `reservas_limbo_${meta.proveedor || 'todos'}_${meta.proyectoNombre || 'todos'}_${meta.tableroNombre || 'todos'}_${stamp()}`
  );
  XLSX.writeFile(wb, `${fileBase}.xlsx`);
}
