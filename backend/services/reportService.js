import { config } from '../config.js';
import { getInventario, getMovimientos, getLowStock } from './excelService.js';

/** Envoltorio JSON compatible con Power BI (patrón OData / value[]) */
function toPowerBiReport(reporte, columnas, value, extra = {}) {
  return {
    '@odata.context': `https://inventario.local/reportes/${reporte}`,
    reporte,
    generadoEn: new Date().toISOString(),
    totalRegistros: value.length,
    columnas,
    value,
    ...extra,
  };
}

function parseDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function filterMovimientosByDate(movimientos, { desde, hasta }) {
  let result = movimientos;
  if (desde) {
    const d = parseDate(desde);
    if (d) result = result.filter((m) => parseDate(m.fechaEgreso) >= d);
  }
  if (hasta) {
    const h = parseDate(hasta);
    if (h) result = result.filter((m) => parseDate(m.fechaEgreso) <= h);
  }
  return result;
}

export async function reporteUsoHerramientas(accessToken, filters = {}) {
  const [inventario, movimientos] = await Promise.all([
    getInventario(accessToken),
    getMovimientos(accessToken),
  ]);

  const movs = filterMovimientosByDate(movimientos, filters);
  const invByNombre = new Map(inventario.map((i) => [i.nombre?.toLowerCase(), i]));
  const byTool = new Map();

  for (const m of movs) {
    const key = m.nombreHerramienta || 'Sin nombre';
    if (!byTool.has(key)) {
      byTool.set(key, {
        egresos: [],
        pendientes: 0,
      });
    }
    const g = byTool.get(key);
    g.egresos.push(m);
    if (m.pendiente) g.pendientes += 1;
  }

  const value = [...byTool.entries()].map(([nombreHerramienta, g]) => {
    const cantidadTotal = g.egresos.reduce((s, m) => s + m.cantidad, 0);
    const fechas = g.egresos
      .map((m) => parseDate(m.fechaEgreso))
      .filter(Boolean)
      .sort((a, b) => a - b);
    const inv = invByNombre.get(nombreHerramienta.toLowerCase());

    return {
      Herramienta: nombreHerramienta,
      Tipo: inv?.tipo ?? '',
      Marca: inv?.marca ?? '',
      Ubicacion: inv?.ubicacion ?? g.egresos[0]?.ubicacion ?? '',
      ContenedorId: inv?.contenedorId ?? '',
      StockActual: inv?.cantidad ?? null,
      TotalEgresos: g.egresos.length,
      CantidadRetirada: cantidadTotal,
      PromedioPorEgreso: g.egresos.length ? Math.round((cantidadTotal / g.egresos.length) * 100) / 100 : 0,
      DevolucionesPendientes: g.pendientes,
      DevolucionesCompletadas: g.egresos.length - g.pendientes,
      PrimeraFechaEgreso: fechas[0]?.toISOString().slice(0, 10) ?? null,
      UltimaFechaEgreso: fechas[fechas.length - 1]?.toISOString().slice(0, 10) ?? null,
      DiasConActividad: new Set(g.egresos.map((m) => m.fechaEgreso)).size,
    };
  });

  value.sort((a, b) => b.TotalEgresos - a.TotalEgresos);

  const columnas = [
    'Herramienta',
    'Tipo',
    'Marca',
    'Ubicacion',
    'ContenedorId',
    'StockActual',
    'TotalEgresos',
    'CantidadRetirada',
    'PromedioPorEgreso',
    'DevolucionesPendientes',
    'DevolucionesCompletadas',
    'PrimeraFechaEgreso',
    'UltimaFechaEgreso',
    'DiasConActividad',
  ];

  return toPowerBiReport('uso-herramientas', columnas, value, {
    filtros: { desde: filters.desde ?? null, hasta: filters.hasta ?? null },
    umbralStock: config.lowStockThreshold,
  });
}

export async function reporteMovimientosPorPersona(accessToken, filters = {}) {
  const movimientos = filterMovimientosByDate(await getMovimientos(accessToken), filters);
  const byPerson = new Map();

  for (const m of movimientos) {
    const persona = (m.nombrePersonal || 'Sin asignar').trim();
    if (!byPerson.has(persona)) {
      byPerson.set(persona, { movs: [] });
    }
    byPerson.get(persona).movs.push(m);
  }

  const value = [...byPerson.entries()].map(([Persona, { movs }]) => {
    const egresos = movs.length;
    const ingresos = movs.filter((m) => !m.pendiente).length;
    const pendientes = movs.filter((m) => m.pendiente).length;
    const cantidadRetirada = movs.reduce((s, m) => s + m.cantidad, 0);
    const cantidadDevuelta = movs.filter((m) => !m.pendiente).reduce((s, m) => s + m.cantidad, 0);
    const herramientasUnicas = new Set(movs.map((m) => m.nombreHerramienta)).size;
    const fechas = movs.map((m) => parseDate(m.fechaEgreso)).filter(Boolean).sort((a, b) => a - b);

    return {
      Persona,
      TotalMovimientos: egresos,
      TotalEgresos: egresos,
      TotalIngresos: ingresos,
      MovimientosPendientes: pendientes,
      CantidadRetirada: cantidadRetirada,
      CantidadDevuelta: cantidadDevuelta,
      CantidadPendienteDevolucion: cantidadRetirada - cantidadDevuelta,
      HerramientasDistintas: herramientasUnicas,
      PrimeraActividad: fechas[0]?.toISOString().slice(0, 10) ?? null,
      UltimaActividad: fechas[fechas.length - 1]?.toISOString().slice(0, 10) ?? null,
      TasaDevolucionPct:
        cantidadRetirada > 0 ? Math.round((cantidadDevuelta / cantidadRetirada) * 10000) / 100 : 0,
    };
  });

  value.sort((a, b) => b.TotalMovimientos - a.TotalMovimientos);

  const columnas = [
    'Persona',
    'TotalMovimientos',
    'TotalEgresos',
    'TotalIngresos',
    'MovimientosPendientes',
    'CantidadRetirada',
    'CantidadDevuelta',
    'CantidadPendienteDevolucion',
    'HerramientasDistintas',
    'PrimeraActividad',
    'UltimaActividad',
    'TasaDevolucionPct',
  ];

  return toPowerBiReport('movimientos-por-persona', columnas, value, {
    filtros: { desde: filters.desde ?? null, hasta: filters.hasta ?? null },
  });
}

export async function reporteStockCritico(accessToken, filters = {}) {
  const inventario = await getInventario(accessToken);
  const umbral = Number(filters.umbral) || config.lowStockThreshold;
  const criticos = inventario.filter((i) => i.cantidad <= umbral);

  const value = criticos.map((i) => {
    const deficit = umbral - i.cantidad;
    let nivelCriticidad = 'Bajo';
    if (i.cantidad === 0) nivelCriticidad = 'Agotado';
    else if (i.cantidad === 1) nivelCriticidad = 'Critico';
    else if (i.cantidad <= umbral) nivelCriticidad = 'Alerta';

    return {
      Herramienta: i.nombre,
      Tipo: i.tipo,
      Marca: i.marca,
      Modelo: i.modelo,
      Ubicacion: i.ubicacion,
      Estante: i.estante,
      Contenedor: i.contenedor,
      ContenedorId: i.contenedorId,
      StockActual: i.cantidad,
      UmbralMinimo: umbral,
      Deficit: deficit > 0 ? deficit : 0,
      NivelCriticidad: nivelCriticidad,
      RequiereReposicion: i.cantidad === 0 ? 'Si' : i.cantidad <= 1 ? 'Si' : 'Revisar',
      Calibracion: i.calibracion,
      FechaRelevamiento: i.fechaRelevamiento || null,
      Comentario: i.comentario || '',
    };
  });

  value.sort((a, b) => a.StockActual - b.StockActual);

  const columnas = [
    'Herramienta',
    'Tipo',
    'Marca',
    'Modelo',
    'Ubicacion',
    'Estante',
    'Contenedor',
    'ContenedorId',
    'StockActual',
    'UmbralMinimo',
    'Deficit',
    'NivelCriticidad',
    'RequiereReposicion',
    'Calibracion',
    'FechaRelevamiento',
    'Comentario',
  ];

  return toPowerBiReport('stock-critico', columnas, value, {
    umbralMinimo: umbral,
    totalInventario: inventario.length,
    totalCriticos: value.length,
    porcentajeCritico:
      inventario.length > 0 ? Math.round((value.length / inventario.length) * 10000) / 100 : 0,
  });
}
