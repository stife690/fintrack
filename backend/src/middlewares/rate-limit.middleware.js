import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

const WINDOW_MS = 15 * 60 * 1000;

/**
 * Crea el limitador de intentos para login y registro: frena la fuerza bruta
 * respondiendo 429 `RATE_LIMITED` al superar el tope por IP en 15 minutos.
 * Es una fábrica para que cada app (y cada prueba) tenga su propio contador.
 * @returns {import('express').RequestHandler}
 */
export function createAuthRateLimit() {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: env.authRateLimitMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(
        new AppError(
          429,
          'RATE_LIMITED',
          'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
        ),
      );
    },
  });
}
