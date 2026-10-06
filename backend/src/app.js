import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import { notFound } from './middlewares/not-found.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';

/**
 * Crea y configura la aplicación Express de FinTrack (sin iniciar el servidor).
 *
 * Registra, en orden: CORS, parser JSON, rutas de la API, el manejador 404
 * y el manejador central de errores.
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
  app.use('/api/v1/auth', authRoutes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
