/**
 * Error esperado de la aplicación (regla de negocio o validación).
 * El middleware de errores lo traduce a la respuesta del contrato:
 * `{ error: { code, message, details? } }` con su código HTTP.
 *
 * @example
 * throw new AppError(409, 'EMAIL_TAKEN', 'El correo ya está registrado');
 */
export class AppError extends Error {
  /**
   * @param {number} statusCode Código HTTP (400, 401, 404, 409, 422, 429, 503).
   * @param {string} code Código del contrato (VALIDATION_ERROR, EMAIL_TAKEN, ...).
   * @param {string} message Mensaje legible para el usuario.
   * @param {Array<{ field: string, problem: string }>} [details] Campos inválidos (solo en validaciones).
   */
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
