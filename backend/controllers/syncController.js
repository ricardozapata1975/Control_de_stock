import { processBatchSync } from '../services/syncService.js';

export async function postSync(req, res) {
  const actions = Array.isArray(req.body) ? req.body : req.body?.actions;
  if (!Array.isArray(actions)) {
    return res.status(400).json({ error: 'Enviar array [{ tipo, data, clientId, timestamp }]' });
  }
  const result = await processBatchSync(actions);
  res.json(result);
}
