import { config } from '../config.js';
import {
  buildTemplateCsv,
  getImportSpec,
  importCsv,
  previewCsv,
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

export async function postImportPreview(req, res) {
  const { csv, sede, forzarAduana, almacen } = req.body || {};
  if (!csv?.trim()) {
    return res.status(400).json({ error: 'Enviá el contenido CSV en el campo "csv"' });
  }
  const resultado = await previewCsv(csv, {
    sede: sede || req.user?.sede,
    forzarAduana: Boolean(forzarAduana),
    almacen: almacen || null,
  });
  res.json({ ok: true, ...resultado });
}

export async function postImportCsv(req, res) {
  const { csv, modo = 'agregar', sede, forzarAduana, almacen, offset, limit } = req.body || {};
  if (!csv?.trim()) {
    return res.status(400).json({ error: 'Enviá el contenido CSV en el campo "csv"' });
  }
  const resultado = await importCsv(csv, {
    modo,
    sede: sede || req.user?.sede,
    forzarAduana: Boolean(forzarAduana),
    almacen: almacen || null,
    offset,
    limit,
  });
  res.json({ ok: true, ...resultado });
}
