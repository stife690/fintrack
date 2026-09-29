import { AppError } from '../errors/app-error.js';

/**
 * Manejador central de errores: todo error lanzado en la app termina aquí
 * y se responde con el formato único del contrato `{ error: { code, message } }`.
 *
 * Express lo reconoce como manejador de errores porque recibe 4 parámetros.
 *
 * @param {Error} err Error lanzado por una ruta, un middleware o Express.
 * @param {import('express').Request} _req Petición (no se usa).
 * @param {import('express').Response} res Respuesta HTTP en JSON.
 * @param {import('express').NextFunction} _next Obligatorio para que Express lo trate como manejador de errores.
 * @returns {void}
 */
export function errorHandler(err, _req, res, _next) {
  // Error esperado (regla de negocio): se responde tal cual.
  if (err instanceof AppError) {
    const error = { code: err.code, message: err.message };
    if (err.details) error.details = err.details;
    res.status(err.statusCode).json({ error });
    return;
  }

  // express.json() no pudo leer el body: JSON mal formado.
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'El cuerpo de la petición no es un JSON válido' },
    });
    return;
  }

  // Error inesperado: se registra completo en el log, pero al cliente
  // no se le envían detalles internos (stack, SQL, rutas de archivos).
  console.error('Error no controlado:', err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
  });
}
