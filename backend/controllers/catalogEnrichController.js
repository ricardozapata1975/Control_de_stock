import { applyCatalogEnrich, previewCatalogEnrich } from '../services/catalogEnrichService.js';

function handle(err, res) {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Error' });
}

export async function postCatalogEnrichPreview(req, res) {
  try {
    const result = await previewCatalogEnrich({
      fuente: req.body?.fuente,
      vigencia: req.body?.vigencia,
      modo: req.body?.modo || 'rellenar',
      rows: req.body?.rows,
    });
    res.json(result);
  } catch (err) {
    handle(err, res);
  }
}

export async function postCatalogEnrichApply(req, res) {
  try {
    const result = await applyCatalogEnrich({
      fuente: req.body?.fuente,
      vigencia: req.body?.vigencia,
      modo: req.body?.modo || 'rellenar',
      rows: req.body?.rows,
    });
    res.json(result);
  } catch (err) {
    handle(err, res);
  }
}
