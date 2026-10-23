import { Router } from 'express';
import {
  postForgotPassword,
  postLogin,
  postGoogle,
  postLogout,
  postRefresh,
  postRegister,
  postResetPassword,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de autenticación (se montan en `/api/v1/auth`).
 * - `POST /register` → crea una cuenta.
 * - `POST /login`    → inicia sesión.
 * - `POST /google`   → inicia sesión (o crea la cuenta) con Google.
 * - `POST /refresh`  → renueva los tokens.
 * - `POST /logout`   → cierra la sesión (exige access token).
 * - `POST /forgot-password` → envía el enlace para recuperar la contraseña.
 * - `POST /reset-password`  → cambia la contraseña con el token del enlace.
 */
const router = Router();

router.post('/register', postRegister);
router.post('/login', postLogin);
router.post('/google', postGoogle);
router.post('/refresh', postRefresh);
router.post('/logout', requireAuth, postLogout);
router.post('/forgot-password', postForgotPassword);
router.post('/reset-password', postResetPassword);

export default router;
