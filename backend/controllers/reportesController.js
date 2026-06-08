import {
  reporteUsoHerramientas,
  reporteMovimientosPorPersona,
  reporteStockCritico,
} from '../services/reportService.js';

function parseFilters(query) {
  return {
    desde: query.desde || null,
    hasta: query.hasta || null,
    umbral: query.umbral || null,
  };
}

export async function getUsoHerramientas(req, res) {
  const data = await reporteUsoHerramientas(req.accessToken, parseFilters(req.query));
  res.json(data);
}

export async function getMovimientosPorPersona(req, res) {
  const data = await reporteMovimientosPorPersona(req.accessToken, parseFilters(req.query));
  res.json(data);
}

export async function getStockCritico(req, res) {
  const data = await reporteStockCritico(req.accessToken, parseFilters(req.query));
  res.json(data);
}
