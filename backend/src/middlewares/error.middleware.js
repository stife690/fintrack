import { AppError } from '../errors/app-error.js';
import { env } from '../config/env.js';

/**
 * Manejador central de errores. Debe registrarse al final de la cadena.
 *
 * Responde siempre con `{ error: { code, message, details? } }`:
 * - `AppError`: usa su estado, código y detalles.
 * - JSON mal formado (body-parser): 400 `INVALID_JSON`.
 * - Cualquier otro error: 500 `INTERNAL_ERROR`; fuera de desarrollo no se
 *   expone el mensaje original para no filtrar información interna.
 *
 * @param {unknown} err Error recibido.
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    const body = { code: err.code, message: err.message };
    if (err.details !== undefined) body.details = err.details;
    return res.status(err.status).json({ error: body });
  }

  if (err?.type === 'entity.parse.failed') {
    return res
      .status(400)
      .json({ error: { code: 'INVALID_JSON', message: 'El cuerpo de la solicitud no es JSON válido' } });
  }

  if (err?.type === 'entity.too.large') {
    return res
      .status(413)
      .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'El cuerpo de la solicitud es demasiado grande' } });
  }

  console.error(err);
  const expose = env.nodeEnv === 'development' && err?.message;
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: expose ? err.message : 'Error interno del servidor' },
  });
}
