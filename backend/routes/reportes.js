import { Router } from 'express';
import {
  getUsoHerramientas,
  getMovimientosPorPersona,
  getStockCritico,
} from '../controllers/reportesController.js';

const router = Router();

router.get('/uso-herramientas', getUsoHerramientas);
router.get('/movimientos-por-persona', getMovimientosPorPersona);
router.get('/stock-critico', getStockCritico);

export default router;
