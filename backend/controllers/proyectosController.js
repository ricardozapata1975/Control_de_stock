import * as service from '../services/proyectosService.js';

function handle(err, res) {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Error' });
}

function sedeFromReq(req) {
  return req.query.sede || req.user?.sede || null;
}

export async function getProyectosDashboard(req, res) {
  try {
    const kpis = await service.getDashboardKpis({ sede: sedeFromReq(req) });
    res.json({ kpis });
  } catch (err) {
    handle(err, res);
  }
}

export async function getProyectos(req, res) {
  try {
    const list = await service.listProyectos({
      sede: sedeFromReq(req),
      estado: req.query.estado,
      q: req.query.q,
    });
    res.json({ proyectos: list });
  } catch (err) {
    handle(err, res);
  }
}

export async function getProyectoById(req, res) {
  try {
    const data = await service.getProyecto(req.params.id);
    res.json(data);
  } catch (err) {
    handle(err, res);
  }
}

export async function postProyecto(req, res) {
  try {
    const body = req.body || {};
    const proyecto = await service.createProyecto({
      ...body,
      sede: body.sede || req.user?.sede,
      createdBy: req.user?.name || req.user?.email || body.createdBy,
    });
    res.status(201).json({ proyecto });
  } catch (err) {
    handle(err, res);
  }
}

export async function putProyecto(req, res) {
  try {
    const proyecto = await service.updateProyecto(req.params.id, req.body || {});
    res.json({ proyecto });
  } catch (err) {
    handle(err, res);
  }
}

export async function postTablero(req, res) {
  try {
    const tablero = await service.createTablero(req.params.id, req.body || {});
    res.status(201).json({ tablero });
  } catch (err) {
    handle(err, res);
  }
}

export async function putTablero(req, res) {
  try {
    const tablero = await service.updateTablero(req.params.tableroId, req.body || {});
    res.json({ tablero });
  } catch (err) {
    handle(err, res);
  }
}

export async function getReservas(req, res) {
  try {
    const reservas = await service.listReservas({
      sede: sedeFromReq(req),
      proyectoId: req.query.proyectoId,
      estado: req.query.estado,
    });
    res.json({ reservas });
  } catch (err) {
    handle(err, res);
  }
}

export async function getFaltantes(req, res) {
  try {
    const faltantes = await service.listFaltantes({
      sede: sedeFromReq(req),
      proyectoId: req.query.proyectoId,
      estado: req.query.estado,
    });
    res.json({ faltantes });
  } catch (err) {
    handle(err, res);
  }
}

export async function postLiberarReserva(req, res) {
  try {
    const reserva = await service.liberarReserva(req.params.id, {
      usuario: req.user?.name || req.user?.email,
      notas: req.body?.notas,
    });
    res.json({ reserva });
  } catch (err) {
    handle(err, res);
  }
}

export async function postReasignarReserva(req, res) {
  try {
    const result = await service.reasignarReserva(req.params.id, {
      haciaProyectoId: req.body?.haciaProyectoId,
      haciaTableroId: req.body?.haciaTableroId,
      usuario: req.user?.name || req.user?.email,
      notas: req.body?.notas,
    });
    res.json(result);
  } catch (err) {
    handle(err, res);
  }
}

export async function postPedidoMasivo(req, res) {
  try {
    const result = await service.procesarPedidoMasivo({
      proyectoId: req.body?.proyectoId,
      tableroId: req.body?.tableroId,
      lineas: req.body?.lineas,
      archivoNombre: req.body?.archivoNombre,
      usuario: req.user?.name || req.user?.email,
    });
    res.status(201).json(result);
  } catch (err) {
    handle(err, res);
  }
}

export async function getAlertas(req, res) {
  try {
    const alertas = await service.listAlertas({
      sede: sedeFromReq(req),
      soloNoLeidas: req.query.todas !== '1',
    });
    res.json({ alertas });
  } catch (err) {
    handle(err, res);
  }
}
