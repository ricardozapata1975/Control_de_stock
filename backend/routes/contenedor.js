import { Router } from 'express';
import { getContenedor, getAllContenedores } from '../controllers/contenedorController.js';

const router = Router();
router.get('/', getAllContenedores);
router.get('/:id', getContenedor);
export default router;
