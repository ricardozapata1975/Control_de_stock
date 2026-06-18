import {
  listMovimientos,
  listPendientes,
  registrarEgreso,
  registrarIngreso,
} from '../services/movimientosService.js';
import { listInventario } from '../services/inventarioService.js';

export async function getMovimientos(req, res) {
  const movimientos = await listMovimientos({
    usuario: req.query.usuario || req.query.persona,
    desde: req.query.desde,
    hasta: req.query.hasta,
    pendiente: req.query.pendiente,
  });
  res.json({ movimientos, total: movimientos.length });
}

export async function getPendientes(req, res) {
  const movimientos = await listPendientes();
  res.json({ movimientos, total: movimientos.length });
}

export async function postEgreso(req, res) {
  const { itemId, contenedorId, cantidad, usuario, nombrePersonal, inventarioId } = req.body;

  let resolvedItemId = itemId;
  let resolvedContenedorId = contenedorId;

  if ((!resolvedItemId || !resolvedContenedorId) && inventarioId) {
    const { items } = await listInventario();
    const row = items.find((i) => i.id === inventarioId || i.stockId === inventarioId);
    if (row) {
      resolvedItemId = row.itemId;
      resolvedContenedorId = row.contenedorId;
    }
  }

  const bodyUsuario = String(usuario || nombrePersonal || '').trim();
  let resolvedUsuario = req.user?.name || bodyUsuario;
  if (req.user?.role === 'admin' && bodyUsuario) {
    resolvedUsuario = bodyUsuario;
  }

  const result = await registrarEgreso({
    itemId: resolvedItemId,
    contenedorId: resolvedContenedorId,
    cantidad,
    usuario: resolvedUsuario,
  });
  res.status(201).json(result);
}

export async function postIngreso(req, res) {
  const { movimientoId, egresoMovimientoId, usuario, nombrePersonal } = req.body;
  const result = await registrarIngreso({
    movimientoId,
    egresoMovimientoId,
    usuario: req.user?.name || usuario || nombrePersonal,
  });
  res.json(result);
}
