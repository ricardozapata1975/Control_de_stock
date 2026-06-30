import { getNextRemitoNumero, listEmpresasEmisoras } from '../services/empresasEmisorasService.js';

export async function getEmpresasEmisoras(req, res) {
  const empresas = await listEmpresasEmisoras();
  res.json({ empresas });
}

export async function getProximoNumero(req, res) {
  const { empresaId } = req.query;
  if (!empresaId) {
    return res.status(400).json({ error: 'empresaId requerido' });
  }
  const numero = await getNextRemitoNumero(empresaId);
  res.json({ numero });
}
