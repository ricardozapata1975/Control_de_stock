/**
 * Aplica supabase/patch-partial-schema.sql vía conexión directa PostgreSQL.
 * Requiere DATABASE_URL en backend/.env (contraseña de la base, no la API secret).
 *
 * Supabase → Project Settings → Database → Connection string → URI
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const patchPath = path.join(__dirname, '../../supabase/patch-partial-schema.sql');
const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error('Falta DATABASE_URL en backend/.env');
  console.error('');
  console.error('Supabase → Project Settings → Database → Connection string → URI');
  console.error('Ejemplo: postgresql://postgres:TU_PASSWORD@db.lxkkguclaumcjxksjywh.supabase.co:5432/postgres');
  console.error('');
  console.error('Alternativa más simple: pegá patch-partial-schema.sql en el SQL Editor del dashboard.');
  process.exit(1);
}

const sql = fs.readFileSync(patchPath, 'utf-8');
const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  console.log('Conectando a PostgreSQL...');
  await client.connect();
  console.log('Aplicando parche de esquema...');
  await client.query(sql);
  console.log('Parche aplicado correctamente.');
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
} finally {
  await client.end();
}
