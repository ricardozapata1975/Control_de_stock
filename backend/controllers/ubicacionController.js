import { getCatalogoUbicacion } from '../services/ubicacionService.js';
import { addAlmacen } from '../services/catalogoService.js';

export async function getCatalogo(req, res) {
  res.json(getCatalogoUbicacion());
}

export async function postAlmacen(req, res) {
  const { tipo, nombre } = req.body || {};
  const created = await addAlmacen({ tipo, nombre });
  res.status(201).json({ ok: true, almacen: created, catalogo: getCatalogoUbicacion() });
}
