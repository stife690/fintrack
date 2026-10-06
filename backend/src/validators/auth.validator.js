import { AppError } from '../errors/app-error.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/** @returns {AppError} 400: el cuerpo no tiene la forma esperada. */
function invalidBody() {
  return new AppError(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
}

/**
 * Comprueba que el cuerpo traiga `email` y `password` como texto (login).
 * @param {unknown} body
 * @returns {{ email: string, password: string }}
 */
export function parseCredentials(body) {
  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
    throw invalidBody();
  }
  return { email: body.email, password: body.password };
}

/**
 * Igual que `parseCredentials`, y además exige las reglas de una cuenta nueva (registro).
 * @param {unknown} body
 * @returns {{ email: string, password: string }}
 */
export function parseNewCredentials(body) {
  const { email, password } = parseCredentials(body);
  const details = [];
  if (!EMAIL_RE.test(email.trim())) {
    details.push({ field: 'email', problem: 'Debe ser un correo válido' });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    details.push({ field: 'password', problem: 'Debe tener al menos 8 caracteres' });
  }
  if (details.length > 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', details);
  }
  return { email, password };
}

/**
 * Comprueba que el cuerpo traiga un `refreshToken` de texto.
 * @param {unknown} body
 * @returns {string}
 */
export function parseRefreshToken(body) {
  if (!body || typeof body.refreshToken !== 'string' || body.refreshToken === '') {
    throw invalidBody();
  }
  return body.refreshToken;
}
