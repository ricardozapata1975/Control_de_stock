import { Router } from 'express';
import { postSync } from '../controllers/syncController.js';

const router = Router();
router.post('/', postSync);
export default router;
