import { solicitarEnvio } from '../services/solicitudEnvioService.js';

export async function postSolicitudEnvio(req, res) {
  const result = await solicitarEnvio(req.body || {}, req.user);
  res.status(201).json(result);
}
