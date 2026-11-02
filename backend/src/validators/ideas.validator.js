import { AppError } from '../errors/app-error.js';

export const MIN_TITLE_LENGTH = 5;
export const MAX_TITLE_LENGTH = 120;
export const STATUSES = ['revision', 'planeada', 'en_progreso', 'lista', 'descartada'];

/**
 * @param {unknown} body
 * @returns {void}
 * @throws {AppError} 400 si no es un objeto.
 */
function assertObject(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
  }
}

/**
 * @param {unknown} value
 * @returns {string} Título sin espacios sobrantes.
 * @throws {AppError} 422 si el título no sirve.
 */
function parseTitle(value) {
  const title = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (title.length < MIN_TITLE_LENGTH || title.length > MAX_TITLE_LENGTH) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'title', problem: `Debe tener entre ${MIN_TITLE_LENGTH} y ${MAX_TITLE_LENGTH} caracteres` },
    ]);
  }
  return title;
}

/**
 * @param {unknown} value
 * @returns {string}
 * @throws {AppError} 422 si no es un estado válido.
 */
function parseStatus(value) {
  if (!STATUSES.includes(value)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'status', problem: `Debe ser uno de: ${STATUSES.join(', ')}` },
    ]);
  }
  return value;
}

/**
 * Valida el cuerpo de `POST /ideas`.
 * @param {unknown} body
 * @returns {{ title: string }}
 * @throws {AppError} 400 si no es un objeto; 422 si el título no sirve.
 */
export function parseNewIdea(body) {
  assertObject(body);
  return { title: parseTitle(body.title) };
}

/**
 * Valida el cuerpo de `POST /ideas/admin`. Sin estado, la idea queda planeada.
 * @param {unknown} body
 * @returns {{ title: string, status: string }}
 * @throws {AppError} 400 si no es un objeto; 422 si algún campo no sirve.
 */
export function parseAdminIdea(body) {
  assertObject(body);
  return { title: parseTitle(body.title), status: parseStatus(body.status ?? 'planeada') };
}

/**
 * Valida el cuerpo de `PATCH /ideas/admin/:id`: título, estado o ambos.
 * @param {unknown} body
 * @returns {{ title?: string, status?: string }}
 * @throws {AppError} 400 si no es un objeto; 422 si no hay cambios o algún campo no sirve.
 */
export function parseIdeaChanges(body) {
  assertObject(body);
  if (body.title === undefined && body.status === undefined) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'title', problem: 'Envía el título o el estado' },
    ]);
  }
  return {
    ...(body.title !== undefined && { title: parseTitle(body.title) }),
    ...(body.status !== undefined && { status: parseStatus(body.status) }),
  };
}
