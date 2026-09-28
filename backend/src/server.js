import { createApp } from './app.js';
import { env } from './config/env.js';

/**
 * Punto de entrada del backend: arranca el servidor HTTP.
 * El puerto viene de `PORT` (lo define Render) o 3000 por defecto.
 */
createApp().listen(env.port, () => {
  console.log(`FinTrack API escuchando en el puerto ${env.port}`);
});
