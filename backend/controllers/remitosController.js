import {
  crearRemito,
  getRemitoById,
  listTransferenciasPendientes,
  recibirTransferencia,
} from '../services/remitosService.js';

export async function postRemito(req, res) {
  const createdBy = req.user?.name || req.user?.username || 'Sistema';
  const result = await crearRemito(req.body, createdBy);
  res.status(201).json(result);
}

export async function getRemito(req, res) {
  const remito = await getRemitoById(req.params.id);
  res.json({ remito });
}

export async function getTransferenciasPendientes(req, res) {
  const almacenDestino = req.query.almacenDestino || req.query.almacen || null;
  const transferencias = await listTransferenciasPendientes(almacenDestino);
  res.json({ transferencias });
}

export async function postRecibirTransferencia(req, res) {
  const recibidoPor = req.user?.name || req.user?.username || 'Sistema';
  const result = await recibirTransferencia(req.params.id, req.body, recibidoPor);
  res.json(result);
}
