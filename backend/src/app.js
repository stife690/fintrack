import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import healthRoutes from './routes/health.routes.js';
import { notFound } from './middlewares/not-found.middleware.js';

/**
 * Crea y configura la aplicación Express de FinTrack (sin iniciar el servidor).
 *
 * Registra, en orden: CORS, parser JSON, rutas de la API y el manejador 404.
 * Se separa de `server.js` para poder probarla sin abrir un puerto fijo.
 *
 * @returns {import('express').Express} Aplicación Express lista para `listen()`.
 */
export function createApp() {
  const app = express();

  // Sin CORS_ORIGIN (desarrollo local) se permite cualquier origen.
  app.use(cors({ origin: env.corsOrigins.length ? env.corsOrigins : true }));
  app.use(express.json());
  app.use(healthRoutes);
  app.use(notFound);

  return app;
}
