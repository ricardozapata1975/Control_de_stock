import { config } from '../config.js';
import {
  buildTemplateCsv,
  getImportSpec,
  importCsv,
} from '../services/csvImportService.js';

export function getEspecificacion(_req, res) {
  res.json({
    ...getImportSpec(),
    demoMode: config.demoMode,
    db: config.demoMode ? 'demo-local' : 'supabase',
  });
}

export function getPlantilla(_req, res) {
  const csv = buildTemplateCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla-inventario.csv"');
  res.send('\uFEFF' + csv);
}

export async function postImportCsv(req, res) {
  const { csv, modo = 'agregar' } = req.body;
  if (!csv?.trim()) {
    return res.status(400).json({ error: 'Enviá el contenido CSV en el campo "csv"' });
  }
  const resultado = await importCsv(csv, { modo });
  res.json({ ok: true, ...resultado });
}
