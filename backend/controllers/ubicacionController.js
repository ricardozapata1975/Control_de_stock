import { getCatalogoUbicacion } from '../services/ubicacionService.js';
import { addAlmacen, addArmario, addSede, assignAlmacenSede } from '../services/catalogoService.js';

export async function getCatalogo(req, res) {
  const almacen = req.query?.almacen || '';
  res.json(getCatalogoUbicacion(almacen || undefined));
}

export async function postAlmacen(req, res) {
  const { tipo, nombre, sede } = req.body || {};
  const created = await addAlmacen({ tipo, nombre, sede });
  res.status(201).json({ ok: true, almacen: created, catalogo: getCatalogoUbicacion() });
}

export async function postArmario(req, res) {
  const { almacen, tipo, nombre } = req.body || {};
  const created = await addArmario({ almacen, tipo, nombre });
  res.status(201).json({ ok: true, armario: created, catalogo: getCatalogoUbicacion() });
}

export async function postSede(req, res) {
  const { nombre } = req.body || {};
  const created = await addSede({ nombre });
  res.status(201).json({ ok: true, sede: created, catalogo: getCatalogoUbicacion() });
}

export async function patchAlmacenSede(req, res) {
  const { almacen, sede } = req.body || {};
  const result = await assignAlmacenSede({ almacen, sede });
  res.json({ ok: true, ...result, catalogo: getCatalogoUbicacion() });
}
