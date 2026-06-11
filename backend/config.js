import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

export const config = {
  port: Number(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  demoMode:
    process.env.DEMO_MODE === 'true' ||
    (process.env.DEMO_MODE !== 'false' && !process.env.SUPABASE_URL),
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  sqlite: {
    path: process.env.SQLITE_PATH || path.join(DATA_DIR, 'inventario.sqlite'),
    seedPath: path.join(DATA_DIR, 'inventario.seed.sqlite'),
  },
  lowStockThreshold: Number(process.env.LOW_STOCK_THRESHOLD) || 2,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    displayName: process.env.ADMIN_DISPLAY_NAME || 'Administrador',
  },
  jwtSecret: process.env.JWT_SECRET || 'cambiar-en-produccion-inventario-taller',
};

export function assertConfig() {
  if (config.demoMode) return;
  const missing = [];
  if (!config.supabase.url) missing.push('SUPABASE_URL');
  if (!config.supabase.serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length) {
    throw new Error(`Variables requeridas: ${missing.join(', ')}`);
  }
}
