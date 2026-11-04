import { AppError } from '../errors/app-error.js';

/** Lo máximo que cabe en `usuarios.nombre` (varchar(60)). */
export const MAX_NAME_LENGTH = 60;

/**
 * Valida el cuerpo de `PATCH /users/me`: `{ name }`.
 * El nombre se recorta y los espacios repetidos se dejan en uno; `null` o `""` lo borran.
 * @param {unknown} body
 * @returns {{ name: string|null }} Datos limpios.
 */
export function parseUpdateProfile(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
  }
  if (!('name' in body)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'name', problem: 'Es obligatorio (usa null para borrarlo)' },
    ]);
  }

  const { name } = body;
  if (name === null) return { name: null };
  if (typeof name !== 'string') {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'name', problem: 'Debe ser un texto o null' },
    ]);
  }

  const clean = name.trim().replace(/\s+/g, ' ');
  if (clean.length > MAX_NAME_LENGTH) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'name', problem: `Máximo ${MAX_NAME_LENGTH} caracteres` },
    ]);
  }
  return { name: clean || null };
}

/**
 * Valida el cuerpo de `DELETE /users/me` (FT-0017): `{ password }` o `{ googleCredential }`, uno
 * solo. Con qué se confirma lo decide quien usa la app (las cuentas de Google no saben su clave).
 * @param {unknown} body
 * @returns {{ password: string }|{ googleCredential: string }}
 */
export function parseDeleteAccount(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
  }
  const { password, googleCredential } = body;
  const hasPassword = typeof password === 'string' && password.length > 0;
  const hasGoogle = typeof googleCredential === 'string' && googleCredential.length > 0;
  if (hasPassword === hasGoogle) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'password', problem: 'Confirma con tu contraseña o con Google (solo uno)' },
    ]);
  }
  // Más largo que esto no es una contraseña de FinTrack ni un token de Google: no se gasta bcrypt.
  if ((hasPassword && password.length > 200) || (hasGoogle && googleCredential.length > 4096)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: hasPassword ? 'password' : 'googleCredential', problem: 'Es demasiado largo' },
    ]);
  }
  return hasPassword ? { password } : { googleCredential };
}
