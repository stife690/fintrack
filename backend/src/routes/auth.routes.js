import { Router } from 'express';
import { postLogin, postRefresh, postRegister } from '../controllers/auth.controller.js';

/**
 * Rutas de autenticación (se montan en `/api/v1/auth`).
 * - `POST /register` → crea una cuenta.
 * - `POST /login`    → inicia sesión.
 * - `POST /refresh`  → renueva los tokens.
 */
const router = Router();

router.post('/register', postRegister);
router.post('/login', postLogin);
router.post('/refresh', postRefresh);

export default router;
