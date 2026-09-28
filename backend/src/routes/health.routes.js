import { Router } from 'express';
import { getHealth } from '../controllers/health.controller.js';

/**
 * Rutas de salud del servicio.
 * - `GET /health` → estado del backend (lo usan Render y el smoke test).
 */
const router = Router();

router.get('/health', getHealth);

export default router;
