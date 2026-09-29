/**
 * URL base del backend, sin barra final.
 * En Vercel se define `VITE_API_URL` con la URL pública de Render;
 * en local usa `http://localhost:3000`.
 * @type {string}
 */
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
