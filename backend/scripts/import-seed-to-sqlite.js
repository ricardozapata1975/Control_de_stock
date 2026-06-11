import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { resetSqliteDatabase, saveInventoryData, exportSeedDatabase } from '../db/sqlite.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedJson = path.join(__dirname, '../data/demo-db.seed.json');

if (!fs.existsSync(seedJson)) {
  console.error('No existe demo-db.seed.json');
  process.exit(1);
}

resetSqliteDatabase();
const data = JSON.parse(fs.readFileSync(seedJson, 'utf-8'));
saveInventoryData(data);
const seedPath = exportSeedDatabase();
console.log('SQLite listo:', config.sqlite.path);
console.log('Seed copiado a:', seedPath);
