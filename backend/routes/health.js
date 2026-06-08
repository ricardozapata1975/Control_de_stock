import { Router } from 'express';
import { config } from '../config.js';

const router = Router();
router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    demoMode: config.demoMode,
    timestamp: new Date().toISOString(),
  });
});
export default router;
