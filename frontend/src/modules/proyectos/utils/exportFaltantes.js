import * as XLSX from 'xlsx';
import { siemensCatalogUrl } from '../../../utils/siemensCatalog';

function safeName(s) {
  return String(s || 'faltantes')
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
 * Exporta faltantes (filtro activo) para gestiones de compra.
 * @param {object[]} rows
 * @param {object} meta - { sede, proveedor, proyectoNombre, tableroNombre }
 */
export function exportFaltantesExcel(rows, meta = {}) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) throw new Error('No hay faltantes para exportar con el filtro actual.');

  const filtrosRows = [
    ['Filtro', 'Valor'],
    ['Sede', meta.sede || 'Todas'],
    ['Proveedor', meta.proveedor || 'Todos'],
    ['Proyecto', meta.proyectoNombre || 'Todos'],
    ['Tablero', meta.tableroNombre || 'Todos'],
    ['Exportado', new Date().toLocaleString('es-AR')],
    ['Líneas', list.length],
    [
      'Cantidad pendiente',
      list.reduce((a, r) => a + Number(r.cantidadPendiente ?? r.cantidad ?? 0), 0),
    ],
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
      'Cubierta',
      'Pendiente',
      'Unidad',
      'Precio lista',
      'Moneda',
      'Proyecto',
      'Tablero',
      'Prioridad',
      'Fecha limite',
      'Estado',
      'Ficha Siemens',
    ],
    ...list.map((f) => {
      const codigo = f.codigoArticulo || f.codigoFabricante || '';
      return [
        f.proveedor || 'Sin proveedor',
        codigo,
        f.descripcion || f.nombre || '',
        f.detalle || '',
        f.marca || '',
        f.modelo || '',
        f.cantidad ?? '',
        f.cantidadCubierta ?? '',
        f.cantidadPendiente ?? Math.max(0, Number(f.cantidad || 0) - Number(f.cantidadCubierta || 0)),
        f.unidad || '',
        f.precioLista ?? '',
        f.moneda || '',
        f.proyectoNombre || '',
        f.tableroNombre || '',
        f.prioridad || '',
        f.fechaLimite || '',
        f.estado || '',
        siemensCatalogUrl(codigo) || '',
      ];
    }),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filtrosRows), 'Filtros');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dataRows), 'Faltantes');

  const fileBase = safeName(
    `faltantes_compra_${meta.proveedor || 'todos'}_${meta.proyectoNombre || 'todos'}_${meta.tableroNombre || 'todos'}_${stamp()}`
  );
  XLSX.writeFile(wb, `${fileBase}.xlsx`);
}
