import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import { createAuthRateLimit } from './middlewares/rate-limit.middleware.js';
import { notFound } from './middlewares/not-found.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';

/**
 * Crea y configura la aplicación Express de FinTrack (sin iniciar el servidor).
 *
 * Registra, en orden: CORS, parser JSON, límite de intentos de login/registro,
 * rutas de la API, el manejador 404 y el manejador central de errores.
 * Se separa de `server.js` para poder probarla sin abrir un puerto fijo.
 *
 * @returns {import('express').Express} Aplicación Express lista para `listen()`.
 */
export function createApp() {
  const app = express();

  // Detrás de un proxy (Render) la IP real del cliente llega en X-Forwarded-For.
  app.set('trust proxy', env.trustProxy);

  // Sin CORS_ORIGIN (desarrollo local) se permite cualquier origen.
  app.use(cors({ origin: env.corsOrigins.length ? env.corsOrigins : true }));
  app.use(express.json());
  app.use(healthRoutes);
  app.use(['/api/v1/auth/login', '/api/v1/auth/register'], createAuthRateLimit());
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
