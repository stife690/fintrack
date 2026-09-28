import express from 'express';
import healthRoutes from './routes/health.routes.js';
import { notFound } from './middlewares/not-found.middleware.js';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(healthRoutes);
  app.use(notFound);

  return app;
}
