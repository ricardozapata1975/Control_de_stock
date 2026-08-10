import {
  getPanolInfo,
  listPanolHistorial,
  listPanolPendientes,
  listPanolStock,
  moverAlPanol,
} from '../services/herramientasService.js';

function sedeFromReq(req) {
  return req.query?.sede || req.body?.sede || req.user?.sede || '';
}

export async function getHerramientasPanol(req, res) {
  const panol = getPanolInfo(sedeFromReq(req));
  res.json({ panol });
}

export async function getHerramientasStock(req, res) {
  const data = await listPanolStock(sedeFromReq(req), {
    q: typeof req.query.q === 'string' ? req.query.q.trim() : req.query.q,
    tipo: req.query.tipo,
    codigo: req.query.codigo,
    itemId: req.query.itemId,
  });
  res.json(data);
}

export async function getHerramientasPendientes(req, res) {
  const data = await listPanolPendientes(sedeFromReq(req));
  res.json(data);
}

export async function getHerramientasHistorial(req, res) {
  const data = await listPanolHistorial(sedeFromReq(req), {
    usuario: req.query.usuario || req.query.persona,
    desde: req.query.desde,
    hasta: req.query.hasta,
    pendiente: req.query.pendiente,
  });
  res.json(data);
}

export async function postMoverAlPanol(req, res) {
  const { stockId, cantidad, usuario } = req.body || {};
  const result = await moverAlPanol({
    stockId,
    cantidad,
    sedeSession: sedeFromReq(req),
    usuario: req.user?.name || usuario,
  });
  res.status(201).json(result);
}
