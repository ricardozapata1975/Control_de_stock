import { getCatalogoUbicacion } from '../services/ubicacionService.js';
import { addAlmacen, addArmario } from '../services/catalogoService.js';

export async function getCatalogo(req, res) {
  const almacen = req.query?.almacen || '';
  res.json(getCatalogoUbicacion(almacen || undefined));
}

export async function postAlmacen(req, res) {
  const { tipo, nombre } = req.body || {};
  const created = await addAlmacen({ tipo, nombre });
  res.status(201).json({ ok: true, almacen: created, catalogo: getCatalogoUbicacion() });
}

export async function postArmario(req, res) {
  const { almacen, tipo, nombre } = req.body || {};
  const created = await addArmario({ almacen, tipo, nombre });
  res.status(201).json({ ok: true, armario: created, catalogo: getCatalogoUbicacion() });
}
