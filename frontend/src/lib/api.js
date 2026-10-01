/**
 * URL base del backend, sin barra final.
 * En Vercel se define `VITE_API_URL` con la URL pública de Render;
 * en local usa `http://localhost:3000`.
 * @type {string}
 */
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

/**
 * Base de los endpoints versionados (`/api/v1`). `/health` queda fuera de este prefijo.
 * @type {string}
 */
export const API_V1 = `${API_URL}/api/v1`;
