import {
  createEmpresaEmisora,
  getNextRemitoNumero,
  listEmpresasEmisoras,
  updateEmpresaEmisora,
} from '../services/empresasEmisorasService.js';
import { deleteEmpresaAsset, uploadEmpresaAsset } from '../services/empresaAssetService.js';

export async function getEmpresasEmisoras(req, res) {
  const includeInactive =
    req.query.all === '1' || req.query.all === 'true' || req.query.includeInactive === '1';
  const empresas = await listEmpresasEmisoras({ includeInactive });
  res.json({ empresas });
}

export async function postEmpresaEmisora(req, res) {
  const empresa = await createEmpresaEmisora(req.body);
  res.status(201).json({ empresa });
}

export async function putEmpresaEmisora(req, res) {
  const empresa = await updateEmpresaEmisora(req.params.id, req.body);
  res.json({ empresa });
}

export async function postEmpresaAsset(req, res) {
  const kind = req.params.kind === 'firma' ? 'firma' : 'logo';
  const result = await uploadEmpresaAsset(req.params.id, kind, req.body);
  res.json(result);
}

export async function deleteEmpresaAssetHandler(req, res) {
  const kind = req.params.kind === 'firma' ? 'firma' : 'logo';
  const result = await deleteEmpresaAsset(req.params.id, kind);
  res.json(result);
}

export async function getProximoNumero(req, res) {
  const { empresaId } = req.query;
  if (!empresaId) {
    return res.status(400).json({ error: 'empresaId requerido' });
  }
  const numero = await getNextRemitoNumero(empresaId);
  res.json({ numero });
}
