import { listInventario } from '../services/inventarioService.js';

export async function getInventario(req, res) {
  const data = await listInventario({
    q: req.query.q,
    ubicacion: req.query.ubicacion,
    armario: req.query.armario,
    tipo: req.query.tipo,
  });
  res.json(data);
}
