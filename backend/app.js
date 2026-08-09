import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import { config, assertConfig } from './config.js';
import { getEmailStatus } from './services/emailService.js';
import { errorHandler } from './middleware/errorHandler.js';
import { getInventario } from './controllers/inventarioController.js';
import { getContenedor, getContenedores } from './controllers/contenedorController.js';
import {
  getMovimientos,
  getPendientes,
  postEgreso,
  postEgresoContenedor,
  postIngreso,
  postIngresoLote,
  getEgresoLoteHandler,
} from './controllers/movimientosController.js';
import { postSync } from './controllers/syncController.js';
import { getMe, postFirstLogin, postForgotPassword, postLogin, postResetPassword as postAuthResetPassword, postSetPassword, postSwitchSede } from './controllers/authController.js';
import { getUsers, postUser, putUser, deleteUserHandler, postResetPassword, postSendWelcome, getUsersImportSpecHandler, postUsersImportPreview, postUsersImport } from './controllers/userController.js';
import { requireAuth, requireAdmin, optionalAuth } from './middleware/auth.js';
import { ensureSeedAdmin } from './services/userService.js';
import { getAdminItems, getStockByAlmacen, postAltaStock, postBajaItem, postPurgeAlmacenStock, putUpdateItem, postItemImagen, deleteItemImagen } from './controllers/adminController.js';
import { getCatalogo, postAlmacen, postArmario, postSede, patchAlmacenSede } from './controllers/ubicacionController.js';
import { getTipos } from './controllers/tiposController.js';
import docsRouter from './routes/docs.js';
import {
  getEspecificacion,
  getPlantilla,
  postImportCsv,
  postImportPreview,
} from './controllers/importController.js';
import {
  deleteDbRow,
  getDbSchema,
  getDbTable,
  postDbRow,
  putDbRow,
} from './controllers/dbAdminController.js';
import { getEmpresasEmisoras, getProximoNumero, postEmpresaEmisora, putEmpresaEmisora, postEmpresaAsset, deleteEmpresaAssetHandler } from './controllers/empresasEmisorasController.js';
import { getClientes, postClientes, putCliente, deleteClienteHandler } from './controllers/clientesController.js';
import {
  getRemito,
  getTransferenciasPendientes,
  postRecibirTransferencia,
  postRemito,
} from './controllers/remitosController.js';
import { postSolicitudEnvio } from './controllers/solicitudEnvioController.js';
import {
  getProyectosDashboard,
  getProyectos,
  getProyectoById,
  postProyecto,
  putProyecto,
  postTablero,
  putTablero,
  getReservas,
  getFaltantes,
  postLiberarReserva,
  postReasignarReserva,
  postPedidoMasivo,
  postPedidoMasivoPreview,
  getAlertas,
  getRecepciones,
  getRecepcionById,
  postRecepcion,
  postAceptarSugerencia,
  postRechazarSugerencia,
  postSugerenciasPorItems,
  getDevoluciones,
  postDevolucion,
  getAuditorias,
  getAuditoriaById,
  postAuditoria,
  postAuditoriaLinea,
  postCerrarAuditoria,
  getHerramientas,
  getHerramientaById,
  postHerramienta,
  postHerramientaEvento,
  getReporteProyectos,
  getDisponiblesNetos,
  getMaterialesEnTransito,
  getRemitosPendientesCierre,
  getRemitoRecepcion,
  postValidarItemRecepcion,
  postCerrarRecepcionParcial,
} from './controllers/proyectosController.js';
import { loadCatalogo } from './services/catalogoService.js';
import { applyCatalogo } from './services/ubicacionUtils.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  assertConfig();
} catch (e) {
  console.error('[Config]', e.message);
  console.error('Copiá backend/.env.example → backend/.env y completá Supabase.');
}

const catalogo = await loadCatalogo();
applyCatalogo(catalogo);

const app = express();

const allowedOrigins = [config.frontendUrl, ...config.corsOrigins].filter(Boolean);

function isVercelOrigin(origin) {
  if (!origin) return false;
  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

function isLocalNetworkOrigin(origin) {
  if (!origin) return true;
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    );
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (isVercelOrigin(origin)) return callback(null, true);
      if (config.nodeEnv !== 'production' && isLocalNetworkOrigin(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS bloqueado: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '3mb' }));

// Documentación estática
app.use('/docs', docsRouter);

app.get('/', (_req, res) => {
  res.json({
    service: 'Inventario Px Control API',
    health: '/api/health',
    docs: '/docs',
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    db: config.demoMode ? 'demo-local' : 'supabase',
    demoMode: config.demoMode,
    email: getEmailStatus(),
    timestamp: new Date().toISOString(),
  });
});

// Catálogo de ubicación (almacén / armario / estante / contenedor)
app.get('/api/ubicacion/catalogo', optionalAuth, getCatalogo);

app.get('/api/inventario', optionalAuth, getInventario);
app.get('/inventario', optionalAuth, getInventario);
app.get('/api/tipos', getTipos);
app.post('/api/admin/catalogo/almacen', requireAuth, requireAdmin, postAlmacen);
app.post('/api/admin/catalogo/armario', requireAuth, requireAdmin, postArmario);
app.post('/api/admin/catalogo/sede', requireAuth, requireAdmin, postSede);
app.patch('/api/admin/catalogo/almacen-sede', requireAuth, requireAdmin, patchAlmacenSede);

// Contenedores / QR
app.get('/api/contenedor', getContenedores);
app.get('/api/contenedor/:codigo', getContenedor);
app.get('/contenedor/:codigo', getContenedor);

// Movimientos
app.get('/api/movimientos', optionalAuth, getMovimientos);
app.get('/movimientos', optionalAuth, getMovimientos);
app.get('/api/movimientos/pendientes', optionalAuth, getPendientes);

app.post('/api/egreso', requireAuth, postEgreso);
app.post('/egreso', requireAuth, postEgreso);
app.post('/api/egreso/contenedor', requireAuth, postEgresoContenedor);
app.get('/api/egreso/lotes/:loteId', requireAuth, getEgresoLoteHandler);
app.post('/api/egreso/lotes/:loteId/devolver', requireAuth, postIngresoLote);
app.post('/api/ingreso/lote', requireAuth, postIngresoLote);
app.post('/api/ingreso', requireAuth, postIngreso);
app.post('/ingreso', requireAuth, postIngreso);

// Remitos y clientes
app.get('/api/clientes', requireAuth, getClientes);
app.post('/api/clientes', requireAuth, postClientes);
app.put('/api/clientes/:id', requireAuth, putCliente);
app.delete('/api/clientes/:id', requireAuth, deleteClienteHandler);
app.get('/api/empresas-emisoras', requireAuth, getEmpresasEmisoras);
app.get('/api/empresas-emisoras/proximo-numero', requireAuth, getProximoNumero);
app.post('/api/empresas-emisoras', requireAuth, postEmpresaEmisora);
app.put('/api/empresas-emisoras/:id', requireAuth, putEmpresaEmisora);
app.post('/api/empresas-emisoras/:id/:kind', requireAuth, postEmpresaAsset);
app.delete('/api/empresas-emisoras/:id/:kind', requireAuth, deleteEmpresaAssetHandler);
app.post('/api/remitos', requireAuth, postRemito);
app.get('/api/remitos/transferencias/pendientes', requireAuth, getTransferenciasPendientes);
app.post('/api/remitos/:id/recibir', requireAuth, postRecibirTransferencia);
app.get('/api/remitos/:id', requireAuth, getRemito);

app.post('/api/solicitudes-envio', requireAuth, postSolicitudEnvio);

// Módulo Proyectos (desacoplado)
app.get('/api/proyectos/dashboard', requireAuth, getProyectosDashboard);
app.get('/api/proyectos/reservas', requireAuth, getReservas);
app.get('/api/proyectos/faltantes', requireAuth, getFaltantes);
app.get('/api/proyectos/alertas', requireAuth, getAlertas);
app.get('/api/proyectos/recepciones', requireAuth, getRecepciones);
app.post('/api/proyectos/recepciones', requireAuth, postRecepcion);
app.get('/api/proyectos/recepciones/:id', requireAuth, getRecepcionById);
app.post('/api/proyectos/sugerencias/:id/aceptar', requireAuth, postAceptarSugerencia);
app.post('/api/proyectos/sugerencias/:id/rechazar', requireAuth, postRechazarSugerencia);
app.post('/api/proyectos/sugerencias/por-items', requireAuth, postSugerenciasPorItems);
app.get('/api/proyectos/devoluciones', requireAuth, getDevoluciones);
app.post('/api/proyectos/devoluciones', requireAuth, postDevolucion);
app.get('/api/proyectos/auditorias', requireAuth, getAuditorias);
app.post('/api/proyectos/auditorias', requireAuth, postAuditoria);
app.get('/api/proyectos/auditorias/:id', requireAuth, getAuditoriaById);
app.post('/api/proyectos/auditorias/:id/lineas', requireAuth, postAuditoriaLinea);
app.post('/api/proyectos/auditorias/:id/cerrar', requireAuth, postCerrarAuditoria);
app.get('/api/proyectos/herramientas', requireAuth, getHerramientas);
app.post('/api/proyectos/herramientas', requireAuth, postHerramienta);
app.get('/api/proyectos/herramientas/:id', requireAuth, getHerramientaById);
app.post('/api/proyectos/herramientas/:id/evento', requireAuth, postHerramientaEvento);
app.get('/api/proyectos/reportes', requireAuth, getReporteProyectos);
app.get('/api/proyectos/disponibles-netos', requireAuth, getDisponiblesNetos);
app.get('/api/proyectos/transito', requireAuth, getMaterialesEnTransito);
app.get('/api/proyectos/remitos-pendientes-cierre', requireAuth, getRemitosPendientesCierre);
app.get('/api/proyectos/transferencias/:id', requireAuth, getRemitoRecepcion);
app.post('/api/proyectos/transferencias/:id/validar-item', requireAuth, postValidarItemRecepcion);
app.post('/api/proyectos/transferencias/:id/cerrar-parcial', requireAuth, postCerrarRecepcionParcial);
app.get('/api/proyectos', requireAuth, getProyectos);
app.post('/api/proyectos', requireAuth, postProyecto);
app.get('/api/proyectos/:id', requireAuth, getProyectoById);
app.put('/api/proyectos/:id', requireAuth, putProyecto);
app.post('/api/proyectos/:id/tableros', requireAuth, postTablero);
app.put('/api/proyectos/tableros/:tableroId', requireAuth, putTablero);
app.post('/api/proyectos/reservas/:id/liberar', requireAuth, postLiberarReserva);
app.post('/api/proyectos/reservas/:id/reasignar', requireAuth, postReasignarReserva);
app.post('/api/proyectos/pedidos-masivos/preview', requireAuth, postPedidoMasivoPreview);
app.post('/api/proyectos/pedidos-masivos', requireAuth, postPedidoMasivo);

app.post('/api/sync', postSync);
app.post('/sync', postSync);

// Autenticación
app.get('/api/auth/me', requireAuth, getMe);
app.post('/api/auth/login', postLogin);
app.post('/api/auth/first-login', postFirstLogin);
app.post('/api/auth/set-password', postSetPassword);
app.post('/api/auth/sede', requireAuth, postSwitchSede);
app.post('/api/auth/forgot-password', postForgotPassword);
app.post('/api/auth/reset-password', postAuthResetPassword);

// Administración (solo admin)
app.get('/api/admin/items', requireAdmin, getAdminItems);
app.get('/api/admin/stock/by-almacen', requireAdmin, getStockByAlmacen);
app.post('/api/admin/stock/purge', requireAdmin, postPurgeAlmacenStock);
app.post('/api/admin/stock/alta', requireAdmin, postAltaStock);
app.put('/api/admin/items/:itemId', requireAdmin, putUpdateItem);
app.post('/api/admin/items/:itemId/baja', requireAdmin, postBajaItem);
app.post('/api/admin/items/:itemId/imagen', requireAuth, postItemImagen);
app.delete('/api/admin/items/:itemId/imagen', requireAuth, deleteItemImagen);
app.get('/api/admin/import/especificacion', requireAdmin, getEspecificacion);
app.get('/api/admin/import/plantilla.csv', requireAdmin, getPlantilla);
app.post('/api/admin/import/preview', requireAdmin, postImportPreview);
app.post('/api/admin/import/csv', requireAdmin, postImportCsv);

// Editor de tablas (admin)
app.get('/api/admin/db/schema', requireAdmin, getDbSchema);
app.get('/api/admin/db/:table', requireAdmin, getDbTable);
app.post('/api/admin/db/:table', requireAdmin, postDbRow);
app.put('/api/admin/db/:table/:id', requireAdmin, putDbRow);
app.delete('/api/admin/db/:table/:id', requireAdmin, deleteDbRow);

// Usuarios (admin)
app.get('/api/admin/users', requireAdmin, getUsers);
app.post('/api/admin/users', requireAdmin, postUser);
app.put('/api/admin/users/:id', requireAdmin, putUser);
app.delete('/api/admin/users/:id', requireAdmin, deleteUserHandler);
app.post('/api/admin/users/:id/reset-password', requireAdmin, postResetPassword);
app.post('/api/admin/users/:id/send-welcome', requireAdmin, postSendWelcome);
app.get('/api/admin/users/import/especificacion', requireAdmin, getUsersImportSpecHandler);
app.post('/api/admin/users/import/preview', requireAdmin, postUsersImportPreview);
app.post('/api/admin/users/import', requireAdmin, postUsersImport);

app.get('/admin/db', (_req, res) => {
  res.sendFile(path.join(__dirname, 'docs/site/admin-db.html'));
});

app.use(errorHandler);

if (config.demoMode) {
  const { initSqliteDatabase } = await import('./db/sqlite.js');
  await initSqliteDatabase();
}
await ensureSeedAdmin();

const server = app.listen(config.port, () => {
  console.log(`API http://localhost:${config.port}`);
  console.log(`Docs  http://localhost:${config.port}/docs`);
  console.log(`DB    http://localhost:${config.port}/admin/db`);
  console.log(`Base de datos: ${config.demoMode ? 'Demo local' : 'Supabase'}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Puerto ${config.port} en uso. Cambiá PORT en .env o liberá el proceso.`);
    process.exit(1);
  }
  throw err;
});
