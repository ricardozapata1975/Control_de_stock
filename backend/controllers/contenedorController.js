import { getByCodigo, listContenedores } from '../services/contenedorService.js';

export async function getContenedor(req, res) {
  const data = await getByCodigo(req.params.codigo || req.params.id);
  res.json(data);
}

export async function getContenedores(req, res) {
  const contenedores = await listContenedores();
  res.json({ contenedores, total: contenedores.length });
}
