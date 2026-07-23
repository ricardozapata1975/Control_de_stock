import { getCatalogoUbicacion } from '../services/ubicacionService.js';
import { addAlmacen, addArmario, addSede, assignAlmacenSede } from '../services/catalogoService.js';
import { almacenesCodigosDeSede } from '../services/sedeScope.js';
import { normalizeAlmacen } from '../services/ubicacionUtils.js';

export async function getCatalogo(req, res) {
  const almacen = req.query?.almacen || '';
  const sede = req.query?.sede || req.user?.sede || '';
  res.json(getCatalogoUbicacion(almacen || undefined, sede || undefined));
}

export async function postAlmacen(req, res) {
  const { tipo, nombre, sede } = req.body || {};
  const sedeCode = sede || req.user?.sede || 'SED001';
  const created = await addAlmacen({ tipo, nombre, sede: sedeCode });
  const scopeSede = req.user?.sede || sedeCode;
  res.status(201).json({
    ok: true,
    almacen: { ...created, sede: sedeCode },
    catalogo: getCatalogoUbicacion(undefined, scopeSede),
  });
}

export async function postArmario(req, res) {
  const { almacen, tipo, nombre } = req.body || {};
  const sessionSede = req.user?.sede || '';
  if (sessionSede && almacen) {
    const alm = normalizeAlmacen(almacen);
    const allowed = almacenesCodigosDeSede(sessionSede);
    if (allowed.length && !allowed.includes(alm)) {
      return res.status(403).json({
        error: `El almacén ${alm} no pertenece a la sucursal activa (${sessionSede})`,
      });
    }
  }
  const created = await addArmario({ almacen, tipo, nombre });
  res.status(201).json({
    ok: true,
    armario: created,
    catalogo: getCatalogoUbicacion(undefined, sessionSede || undefined),
  });
}

export async function postSede(req, res) {
  const { nombre } = req.body || {};
  const created = await addSede({ nombre });
  res.status(201).json({ ok: true, sede: created, catalogo: getCatalogoUbicacion() });
}

export async function patchAlmacenSede(req, res) {
  const { almacen, sede } = req.body || {};
  const result = await assignAlmacenSede({ almacen, sede });
  res.json({
    ok: true,
    ...result,
    catalogo: getCatalogoUbicacion(undefined, req.user?.sede || undefined),
  });
}
