import { Router } from 'express';
import { listInventario } from '../controllers/inventarioController.js';

const router = Router();
router.get('/', listInventario);
export default router;
