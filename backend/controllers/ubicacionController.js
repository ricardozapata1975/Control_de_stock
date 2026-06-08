import { getCatalogoUbicacion } from '../services/ubicacionService.js';

export async function getCatalogo(req, res) {
  res.json(getCatalogoUbicacion());
}
