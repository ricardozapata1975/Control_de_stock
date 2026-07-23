import { listInventario } from '../services/inventarioService.js';

export async function getInventario(req, res) {
  const data = await listInventario({
    q: typeof req.query.q === 'string' ? req.query.q.trim() : req.query.q,
    ubicacion: req.query.ubicacion,
    almacen: req.query.almacen,
    armario: req.query.armario,
    tipo: req.query.tipo,
    codigo: req.query.codigo,
    itemId: req.query.itemId,
    codigoFabricante:
      typeof req.query.codigoFabricante === 'string'
        ? req.query.codigoFabricante.trim()
        : req.query.codigoFabricante || req.query.codigo_fabricante,
  });
  res.json(data);
}
