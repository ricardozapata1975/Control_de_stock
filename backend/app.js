import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import { config, assertConfig } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { getInventario } from './controllers/inventarioController.js';
import { getContenedor, getContenedores } from './controllers/contenedorController.js';
import {
  getMovimientos,
  getPendientes,
  postEgreso,
  postIngreso,
} from './controllers/movimientosController.js';
import { postSync } from './controllers/syncController.js';
import { postLogin } from './controllers/authController.js';
import { getAdminItems, postAltaStock, postBajaItem, putUpdateItem } from './controllers/adminController.js';
import { requireAdmin } from './middleware/auth.js';
import { getCatalogo } from './controllers/ubicacionController.js';
import docsRouter from './routes/docs.js';
import {
  getEspecificacion,
  getPlantilla,
  postImportCsv,
} from './controllers/importController.js';
import {
  deleteDbRow,
  getDbSchema,
  getDbTable,
  postDbRow,
  putDbRow,
} from './controllers/dbAdminController.js';
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
app.use(express.json({ limit: '2mb' }));

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
    timestamp: new Date().toISOString(),
  });
});

// Catálogo de ubicación (armario / estante / contenedor)
app.get('/api/ubicacion/catalogo', getCatalogo);

// Inventario
app.get('/api/inventario', getInventario);
app.get('/inventario', getInventario);

// Contenedores / QR
app.get('/api/contenedor', getContenedores);
app.get('/api/contenedor/:codigo', getContenedor);
app.get('/contenedor/:codigo', getContenedor);

// Movimientos
app.get('/api/movimientos', getMovimientos);
app.get('/movimientos', getMovimientos);
app.get('/api/movimientos/pendientes', getPendientes);

app.post('/api/egreso', postEgreso);
app.post('/egreso', postEgreso);
app.post('/api/ingreso', postIngreso);
app.post('/ingreso', postIngreso);

app.post('/api/sync', postSync);
app.post('/sync', postSync);

// Autenticación
app.post('/api/auth/login', postLogin);

// Administración (solo admin)
app.get('/api/admin/items', requireAdmin, getAdminItems);
app.post('/api/admin/stock/alta', requireAdmin, postAltaStock);
app.put('/api/admin/items/:itemId', requireAdmin, putUpdateItem);
app.post('/api/admin/items/:itemId/baja', requireAdmin, postBajaItem);
app.get('/api/admin/import/especificacion', requireAdmin, getEspecificacion);
app.get('/api/admin/import/plantilla.csv', requireAdmin, getPlantilla);
app.post('/api/admin/import/csv', requireAdmin, postImportCsv);

// Editor de tablas (admin)
app.get('/api/admin/db/schema', requireAdmin, getDbSchema);
app.get('/api/admin/db/:table', requireAdmin, getDbTable);
app.post('/api/admin/db/:table', requireAdmin, postDbRow);
app.put('/api/admin/db/:table/:id', requireAdmin, putDbRow);
app.delete('/api/admin/db/:table/:id', requireAdmin, deleteDbRow);

app.get('/admin/db', (_req, res) => {
  res.sendFile(path.join(__dirname, 'docs/site/admin-db.html'));
});

app.use(errorHandler);

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
