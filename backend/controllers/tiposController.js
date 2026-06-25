import { listTipos } from '../services/tiposService.js';

export async function getTipos(_req, res) {
  const tipos = await listTipos();
  res.json({ tipos });
}
