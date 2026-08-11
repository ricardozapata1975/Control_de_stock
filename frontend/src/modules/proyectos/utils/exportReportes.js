import * as XLSX from 'xlsx';

function safeName(s) {
  return String(s || 'reporte')
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
 * Exporta el reporte de Proyectos (filtros activos) a .xlsx
 * @param {object} data - respuesta de api.proyectosReportes
 * @param {object} meta - { sede, proyectoNombre, desde, hasta }
 */
export function exportReportesProyectosExcel(data, meta = {}) {
  if (!data) throw new Error('No hay datos para exportar. Actualizá el reporte primero.');

  const resumen = data.resumen || {};
  const porTipo = data.porTipo || {};
  const recientes = data.recientes || [];

  const filtrosRows = [
    ['Filtro', 'Valor'],
    ['Sede', meta.sede || 'Todas'],
    ['Proyecto', meta.proyectoNombre || 'Todos'],
    ['Desde', meta.desde || '—'],
    ['Hasta', meta.hasta || '—'],
    ['Exportado', new Date().toLocaleString('es-AR')],
  ];

  const kpisRows = [
    ['Indicador', 'Valor'],
    ['Proyectos activos', resumen.proyectosActivos ?? 0],
    ['Reservas activas', resumen.reservasActivas ?? 0],
    ['Faltantes', resumen.faltantesPendientes ?? 0],
    ['Devoluciones', resumen.devoluciones ?? 0],
    ['Herramientas prestadas', resumen.herramientasPrestadas ?? 0],
    ['Movimientos (filtro)', resumen.movimientos ?? 0],
  ];

  const tiposRows = [
    ['Tipo de movimiento', 'Cantidad'],
    ...Object.entries(porTipo).map(([tipo, cant]) => [tipo, cant]),
  ];
  if (tiposRows.length === 1) tiposRows.push(['(sin datos)', 0]);

  const movRows = [
    ['Fecha', 'Tipo', 'Cantidad', 'Estado material', 'Usuario', 'Proyecto ID', 'Ítem ID', 'Notas'],
    ...recientes.map((m) => [
      m.createdAt ? new Date(m.createdAt).toLocaleString('es-AR') : '',
      m.tipo || '',
      m.cantidad ?? '',
      m.estadoMaterial || '',
      m.usuario || '',
      m.proyectoId || '',
      m.itemId || '',
      m.notas || '',
    ]),
  ];
  if (movRows.length === 1) movRows.push(['', '(sin movimientos en el filtro)', '', '', '', '', '', '']);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filtrosRows), 'Filtros');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpisRows), 'Indicadores');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tiposRows), 'Por tipo');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(movRows), 'Movimientos');

  const fileBase = safeName(
    `reporte_proyectos_${meta.proyectoNombre || 'todos'}_${meta.desde || 'inicio'}_${meta.hasta || 'fin'}_${stamp()}`
  );
  XLSX.writeFile(wb, `${fileBase}.xlsx`);
}
