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
