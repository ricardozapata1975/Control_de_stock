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

export async function postPedidoMasivoPreview(req, res) {
  try {
    const result = await service.previewPedidoMasivo({
      proyectoId: req.body?.proyectoId,
      lineas: req.body?.lineas,
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
      crearItemsFaltantes: Boolean(req.body?.crearItemsFaltantes),
      usuario: req.user?.name || req.user?.email,
    });
    res.status(201).json(result);
  } catch (err) {
    handle(err, res);
  }
}

export async function getTableros(req, res) {
  try {
    const tableros = await service.listTableros({
      sede: sedeFromReq(req),
      q: req.query.q,
    });
    res.json({ tableros });
  } catch (err) {
    handle(err, res);
  }
}

export async function getMaterialesBom(req, res) {
  try {
    const materiales = await service.listMaterialesBom({
      sede: sedeFromReq(req),
      proyectoId: req.query.proyectoId,
      tableroId: req.query.tableroId,
      q: req.query.q,
    });
    res.json({ materiales });
  } catch (err) {
    handle(err, res);
  }
}

export async function getChecklistTablero(req, res) {
  try {
    const data = await service.getChecklistTablero(req.params.tableroId);
    res.json(data);
  } catch (err) {
    handle(err, res);
  }
}

export async function postEscanearProduccion(req, res) {
  try {
    const result = await service.escanearAProduccion(req.params.tableroId, {
      itemId: req.body?.itemId,
      codigo: req.body?.codigo,
      scan: req.body?.scan,
      cantidad: req.body?.cantidad,
      stockId: req.body?.stockId,
      notas: req.body?.notas,
      usuario: req.user?.name || req.user?.email,
    });
    res.json(result);
  } catch (err) {
    handle(err, res);
  }
}

export async function postCompletarProduccionTablero(req, res) {
  try {
    const result = await service.completarProduccionTablero(req.params.tableroId, {
      notas: req.body?.notas,
      usuario: req.user?.name || req.user?.email,
    });
    res.json(result);
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

export async function getRecepciones(req, res) {
  try {
    const { listRecepciones } = await import('../services/proyectosRecepcionesService.js');
    const recepciones = await listRecepciones({
      sede: sedeFromReq(req),
      estado: req.query.estado,
    });
    res.json({ recepciones });
  } catch (err) {
    handle(err, res);
  }
}

export async function getRecepcionById(req, res) {
  try {
    const { getRecepcion } = await import('../services/proyectosRecepcionesService.js');
    const data = await getRecepcion(req.params.id);
    res.json(data);
  } catch (err) {
    handle(err, res);
  }
}

export async function postRecepcion(req, res) {
  try {
    const { crearRecepcion } = await import('../services/proyectosRecepcionesService.js');
    const body = req.body || {};
    const result = await crearRecepcion({
      ...body,
      sede: body.sede || req.user?.sede,
      operador: body.operador || req.user?.name || req.user?.email,
    });
    res.status(201).json(result);
  } catch (err) {
    handle(err, res);
  }
}

export async function postAceptarSugerencia(req, res) {
  try {
    const { aceptarSugerencia } = await import('../services/proyectosRecepcionesService.js');
    const sugerencia = await aceptarSugerencia(req.params.id, {
      usuario: req.user?.name || req.user?.email,
    });
    res.json({ sugerencia });
  } catch (err) {
    handle(err, res);
  }
}

export async function postRechazarSugerencia(req, res) {
  try {
    const { rechazarSugerencia } = await import('../services/proyectosRecepcionesService.js');
    const sugerencia = await rechazarSugerencia(req.params.id);
    res.json({ sugerencia });
  } catch (err) {
    handle(err, res);
  }
}

export async function postSugerenciasPorItems(req, res) {
  try {
    const { sugerirPorItems } = await import('../services/proyectosRecepcionesService.js');
    const sugerencias = await sugerirPorItems({
      itemIds: req.body?.itemIds || [],
      cantidades: req.body?.cantidades || {},
      sede: req.body?.sede || req.user?.sede,
    });
    res.json({ sugerencias });
  } catch (err) {
    handle(err, res);
  }
}

async function f3() {
  return import('../services/proyectosFase3Service.js');
}

async function f4() {
  return import('../services/proyectosFase4Service.js');
}

export async function getDisponiblesNetos(req, res) {
  try {
    const s = await f4();
    const items = await s.listDisponiblesNetos({
      sede: sedeFromReq(req),
      q: req.query.q,
    });
    res.json({ items });
  } catch (err) {
    handle(err, res);
  }
}

export async function getMaterialesEnTransito(req, res) {
  try {
    const s = await f4();
    const remitos = await s.listMaterialesEnTransito({
      sede: sedeFromReq(req),
      almacenDestino: req.query.almacenDestino,
      estado: req.query.estado,
    });
    res.json({ remitos });
  } catch (err) {
    handle(err, res);
  }
}

export async function getRemitosPendientesCierre(req, res) {
  try {
    const s = await f4();
    const remitos = await s.listRemitosPendientesCierre({
      sede: sedeFromReq(req),
      almacenDestino: req.query.almacenDestino,
    });
    res.json({ remitos });
  } catch (err) {
    handle(err, res);
  }
}

export async function getRemitoRecepcion(req, res) {
  try {
    const s = await f4();
    const data = await s.getRemitoRecepcion(req.params.id);
    res.json(data);
  } catch (err) {
    handle(err, res);
  }
}

export async function postValidarItemRecepcion(req, res) {
  try {
    const s = await f4();
    const body = req.body || {};
    const result = await s.validarItemRecepcion(req.params.id, {
      ...body,
      usuario: body.usuario || req.user?.name || req.user?.email,
    });
    res.json(result);
  } catch (err) {
    handle(err, res);
  }
}

export async function postCerrarRecepcionParcial(req, res) {
  try {
    const s = await f4();
    const body = req.body || {};
    const data = await s.cerrarRecepcionParcial(req.params.id, {
      ...body,
      usuario: body.usuario || req.user?.name || req.user?.email,
    });
    res.json(data);
  } catch (err) {
    handle(err, res);
  }
}

export async function getDevoluciones(req, res) {
  try {
    const s = await f3();
    const devoluciones = await s.listDevoluciones({
      sede: sedeFromReq(req),
      proyectoId: req.query.proyectoId,
      estado: req.query.estado,
    });
    res.json({ devoluciones });
  } catch (err) {
    handle(err, res);
  }
}

export async function postDevolucion(req, res) {
  try {
    const s = await f3();
    const body = req.body || {};
    const devolucion = await s.crearDevolucion({
      ...body,
      sede: body.sede || req.user?.sede,
      usuario: body.usuario || req.user?.name || req.user?.email,
    });
    res.status(201).json({ devolucion });
  } catch (err) {
    handle(err, res);
  }
}

export async function getAuditorias(req, res) {
  try {
    const s = await f3();
    const auditorias = await s.listAuditorias({
      sede: sedeFromReq(req),
      estado: req.query.estado,
    });
    res.json({ auditorias });
  } catch (err) {
    handle(err, res);
  }
}

export async function getAuditoriaById(req, res) {
  try {
    const s = await f3();
    const data = await s.getAuditoria(req.params.id);
    res.json(data);
  } catch (err) {
    handle(err, res);
  }
}

export async function postAuditoria(req, res) {
  try {
    const s = await f3();
    const body = req.body || {};
    const data = await s.crearAuditoria({
      ...body,
      sede: body.sede || req.user?.sede,
      operador: body.operador || req.user?.name || req.user?.email,
    });
    res.status(201).json(data);
  } catch (err) {
    handle(err, res);
  }
}

export async function postAuditoriaLinea(req, res) {
  try {
    const s = await f3();
    const linea = await s.agregarLineaAuditoria(req.params.id, req.body || {});
    res.status(201).json({ linea });
  } catch (err) {
    handle(err, res);
  }
}

export async function postCerrarAuditoria(req, res) {
  try {
    const s = await f3();
    const data = await s.cerrarAuditoria(req.params.id);
    res.json(data);
  } catch (err) {
    handle(err, res);
  }
}

export async function getHerramientas(req, res) {
  try {
    const s = await f3();
    const herramientas = await s.listHerramientas({
      sede: sedeFromReq(req),
      estado: req.query.estado,
    });
    res.json({ herramientas });
  } catch (err) {
    handle(err, res);
  }
}

export async function getHerramientaById(req, res) {
  try {
    const s = await f3();
    const data = await s.getHerramienta(req.params.id);
    res.json(data);
  } catch (err) {
    handle(err, res);
  }
}

export async function postHerramienta(req, res) {
  try {
    const s = await f3();
    const body = req.body || {};
    const herramienta = await s.asignarHerramienta({
      ...body,
      sede: body.sede || req.user?.sede,
      createdBy: req.user?.name || req.user?.email,
    });
    res.status(201).json({ herramienta });
  } catch (err) {
    handle(err, res);
  }
}

export async function postHerramientaEvento(req, res) {
  try {
    const s = await f3();
    const herramienta = await s.eventoHerramienta(req.params.id, {
      tipo: req.body?.tipo,
      notas: req.body?.notas,
      usuario: req.user?.name || req.user?.email,
    });
    res.json({ herramienta });
  } catch (err) {
    handle(err, res);
  }
}

export async function getReporteProyectos(req, res) {
  try {
    const s = await f3();
    const reporte = await s.getReporte({
      sede: sedeFromReq(req),
      proyectoId: req.query.proyectoId,
      desde: req.query.desde,
      hasta: req.query.hasta,
    });
    res.json(reporte);
  } catch (err) {
    handle(err, res);
  }
}
