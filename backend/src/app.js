import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import transactionsRoutes from './routes/transactions.routes.js';
import budgetsRoutes from './routes/budgets.routes.js';
import syncRoutes from './routes/sync.routes.js';
import pushRoutes from './routes/push.routes.js';
import insightsRoutes from './routes/insights.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import { createAiRateLimit, createAuthRateLimit } from './middlewares/rate-limit.middleware.js';
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
  app.use(
    cors({
      origin: env.corsOrigins.length ? env.corsOrigins : true,
      // El frontend lee el nombre del archivo de las descargas (GET /reports/export).
      exposedHeaders: ['Content-Disposition'],
    }),
  );
  app.use(express.json());
  app.use(healthRoutes);
  app.use(['/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/google'], createAuthRateLimit());
  // Crear y editar pueden pedir la categoría a la IA: llevan límite de peticiones (contrato §1).
  const aiRateLimit = createAiRateLimit();
  app.post('/api/v1/transactions', aiRateLimit);
  app.put('/api/v1/transactions/:id', aiRateLimit);
  app.post('/api/v1/sync/batch', aiRateLimit);
  app.get('/api/v1/insights', aiRateLimit);
  app.use('/api/v1/sync', syncRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/categories', categoriesRoutes);
  app.use('/api/v1/transactions', transactionsRoutes);
  app.use('/api/v1/budgets', budgetsRoutes);
  app.use('/api/v1/push', pushRoutes);
  app.use('/api/v1/insights', insightsRoutes);
  app.use('/api/v1/reports', reportsRoutes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
