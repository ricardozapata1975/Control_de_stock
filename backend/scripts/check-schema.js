/**
 * Verifica esquema Supabase vía API (service_role).
 * Uso: npm run db:check-schema
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en backend/.env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function check(name, fn) {
  const result = await fn();
  const ok = result.ok;
  console.log(`${ok ? 'OK' : 'FAIL'} - ${name}${result.detail ? ` (${result.detail})` : ''}`);
  return ok;
}

const checks = await Promise.all([
  check('contenedores table', async () => {
    const { error } = await supabase.from('contenedores').select('id').limit(1);
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return { ok: false, detail: 'tabla no existe — ejecutá full-setup.sql' };
    }
    if (error && error.code !== 'PGRST116') return { ok: false, detail: `${error.code}: ${error.message}` };
    return { ok: true };
  }),
  check('contenedores.armario', async () => {
    const { error } = await supabase.from('contenedores').select('armario').limit(1);
    if (error?.code === 'PGRST204' || error?.code === '42703') {
      return { ok: false, detail: 'columna faltante — ejecutá patch-partial-schema.sql' };
    }
    if (error && error.code !== 'PGRST116') return { ok: false, detail: `${error.code}: ${error.message}` };
    return { ok: true };
  }),
  check('items.activo', async () => {
    const { error } = await supabase.from('items').select('activo').limit(1);
    if (error?.code === 'PGRST204' || error?.code === '42703') {
      return { ok: false, detail: 'columna faltante — ejecutá patch-partial-schema.sql' };
    }
    if (error && error.code !== 'PGRST116') return { ok: false, detail: `${error.code}: ${error.message}` };
    return { ok: true };
  }),
  check('users table', async () => {
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error?.code === 'PGRST205') {
      return { ok: false, detail: 'tabla no existe — ejecutá patch-partial-schema.sql' };
    }
    if (error && error.code !== 'PGRST116') return { ok: false, detail: `${error.code}: ${error.message}` };
    return { ok: true };
  }),
  check('stock table', async () => {
    const { error } = await supabase.from('stock').select('id').limit(1);
    if (error?.code === '42P01' || error?.code === 'PGRST205') {
      return { ok: false, detail: 'tabla no existe' };
    }
    if (error && error.code !== 'PGRST116') return { ok: false, detail: `${error.code}: ${error.message}` };
    return { ok: true };
  }),
  check('movimientos table', async () => {
    const { error } = await supabase.from('movimientos').select('id').limit(1);
    if (error?.code === '42P01' || error?.code === 'PGRST205') {
      return { ok: false, detail: 'tabla no existe' };
    }
    if (error && error.code !== 'PGRST116') return { ok: false, detail: `${error.code}: ${error.message}` };
    return { ok: true };
  }),
]);

const allOk = checks.every(Boolean);
console.log('');
console.log(allOk ? 'Esquema completo. Podés correr: npm run db:migrate-supabase' : 'Esquema incompleto. Aplicá el parche antes de migrar.');
process.exit(allOk ? 0 : 1);
