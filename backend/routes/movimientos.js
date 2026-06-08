import { Router } from 'express';
import {
  listMovimientos,
  postEgreso,
  postIngreso,
} from '../controllers/movimientosController.js';

const router = Router();
router.get('/', listMovimientos);
router.post('/egreso', postEgreso);
router.post('/ingreso', postIngreso);
export default router;
