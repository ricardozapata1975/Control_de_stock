import { Router } from 'express';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { getImportSpec } from '../services/csvImportService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.join(__dirname, '../docs/site');

const router = Router();

router.get('/api/import-spec.json', (_req, res) => {
  res.json({
    ...getImportSpec(),
    demoMode: config.demoMode,
    health: '/api/health',
  });
});

router.use(express.static(siteDir));

router.get('/', (_req, res) => {
  res.sendFile(path.join(siteDir, 'index.html'));
});

export default router;
