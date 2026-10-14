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

/**
 * Crea el limitador de los endpoints que consumen la IA (contrato §1): evita que un bucle del
 * frontend agote la cuota de la clave. Responde 429 `RATE_LIMITED` al superar el tope por IP
 * en un minuto.
 * @param {{ limit?: number }} [options] `limit` sustituye al valor de `AI_RATE_LIMIT_MAX` (pruebas).
 * @returns {import('express').RequestHandler}
 */
export function createAiRateLimit({ limit = env.aiRateLimitMax } = {}) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(
        new AppError(
          429,
          'RATE_LIMITED',
          'Demasiadas solicitudes. Espera un momento y vuelve a intentarlo.',
        ),
      );
    },
  });
}
