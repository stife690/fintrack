/**
 * Middleware final: responde 404 a cualquier ruta no registrada.
 * Usa el formato único de errores de la API: `{ error: { code, message } }`.
 *
 * @param {import('express').Request} _req Petición (no se usa).
 * @param {import('express').Response} res Respuesta HTTP 404 en JSON.
 * @returns {void}
 */
export function notFound(_req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' },
  });
}
