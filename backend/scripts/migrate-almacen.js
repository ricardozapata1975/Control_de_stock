#!/usr/bin/env node
/**
 * Migración local: asigna ALM01 a todos los contenedores sin almacén.
 * Uso: node backend/scripts/migrate-almacen.js [ruta-a-demo-db.json]
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultPath = path.join(__dirname, '../data/demo-db.seed.json');

const target = process.argv[2] || defaultPath;

const raw = await fs.readFile(target, 'utf8');
const db = JSON.parse(raw);

let updated = 0;
if (Array.isArray(db.contenedores)) {
  db.contenedores = db.contenedores.map((c) => {
    if (!c.almacen) {
      updated += 1;
      return { ...c, almacen: 'ALM01' };
    }
    return c;
  });
}

await fs.writeFile(target, JSON.stringify(db, null, 2));
console.log(`[migrate-almacen] ${path.basename(target)}: ${updated} contenedores actualizados a ALM01`);
