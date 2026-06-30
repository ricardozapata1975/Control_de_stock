import { crearRemito, getRemitoById } from '../services/remitosService.js';

export async function postRemito(req, res) {
  const createdBy = req.user?.name || req.user?.username || 'Sistema';
  const result = await crearRemito(req.body, createdBy);
  res.status(201).json(result);
}

export async function getRemito(req, res) {
  const remito = await getRemitoById(req.params.id);
  res.json({ remito });
}
