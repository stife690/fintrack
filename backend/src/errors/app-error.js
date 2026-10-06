/**
 * Error de aplicación con estado HTTP y código estable, alineado con el
 * formato de errores del Contrato de API v2.0:
 * `{ "error": { "code", "message", "details"? } }`.
 */
export class AppError extends Error {
  /**
   * @param {number} status Código de estado HTTP.
   * @param {string} code Código de error estable (p. ej. `VALIDATION_ERROR`).
   * @param {string} message Mensaje legible para el cliente.
   * @param {unknown} [details] Información adicional (p. ej. errores por campo).
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** @param {string} [message] @param {unknown} [details] */
export const badRequest = (message = 'Solicitud inválida', details) =>
  new AppError(400, 'BAD_REQUEST', message, details);

/** @param {string} [message] */
export const unauthorized = (message = 'No autenticado') =>
  new AppError(401, 'UNAUTHORIZED', message);

/** @param {string} [message] */
export const tokenExpired = (message = 'El token ha expirado') =>
  new AppError(401, 'TOKEN_EXPIRED', message);

/** @param {string} [message] */
export const notFoundError = (message = 'Recurso no encontrado') =>
  new AppError(404, 'NOT_FOUND', message);

/** @param {string} [message] */
export const conflict = (message = 'Conflicto con el estado actual del recurso') =>
  new AppError(409, 'CONFLICT', message);

/** @param {string} [message] @param {unknown} [details] */
export const validationError = (message = 'Datos inválidos', details) =>
  new AppError(422, 'VALIDATION_ERROR', message, details);

/** @param {string} [message] */
export const rateLimited = (message = 'Demasiadas solicitudes') =>
  new AppError(429, 'RATE_LIMITED', message);

/** @param {string} [message] */
export const aiUnavailable = (message = 'El servicio de IA no está disponible') =>
  new AppError(503, 'AI_UNAVAILABLE', message);
