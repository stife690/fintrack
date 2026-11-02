import { AppError } from '../errors/app-error.js';

export const MIN_TITLE_LENGTH = 5;
export const MAX_TITLE_LENGTH = 120;

/**
 * Valida el cuerpo de `POST /ideas`.
 * @param {unknown} body
 * @returns {{ title: string }} Título sin espacios sobrantes.
 * @throws {AppError} 400 si no es un objeto; 422 si el título no sirve.
 */
export function parseNewIdea(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
  }
  const title = typeof body.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : '';
  if (title.length < MIN_TITLE_LENGTH || title.length > MAX_TITLE_LENGTH) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'title', problem: `Debe tener entre ${MIN_TITLE_LENGTH} y ${MAX_TITLE_LENGTH} caracteres` },
    ]);
  }
  return { title };
}
