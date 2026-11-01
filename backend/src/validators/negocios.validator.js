import { AppError } from '../errors/app-error.js';
import { parseEmail } from './vacas.validator.js';

export { parseCode, parseEmail, parseJoin } from './vacas.validator.js';

const MAX_NAME_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 200;
const MAX_NIT_LENGTH = 20;
/** Dígitos, puntos, guiones y espacios (p. ej. `900.123.456-7`). */
const NIT_RE = /^[0-9][0-9.\- ]*$/;
export const ROLES = ['dueno', 'editor', 'lector'];

/**
 * @typedef {{ field: string, problem: string }} FieldProblem
 */

/** @returns {AppError} 400: el cuerpo no es un objeto JSON. */
function invalidBody() {
  return new AppError(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
}

/**
 * @param {FieldProblem[]} details
 * @returns {void}
 * @throws {AppError} 422 con el detalle por campo si hay problemas.
 */
function throwIfInvalid(details) {
  if (details.length > 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', details);
  }
}

/**
 * @param {unknown} body
 * @returns {boolean} `true` si es un objeto normal (no `null`, no una lista).
 */
function isObject(body) {
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

/**
 * Texto opcional: `null`, `undefined` o vacío quedan en `null`.
 * @param {unknown} value
 * @param {string} field
 * @param {number} max
 * @param {FieldProblem[]} details
 * @returns {string|null|undefined} `undefined` si no es válido.
 */
function readOptionalText(value, field, max, details) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    details.push({ field, problem: 'Debe ser texto' });
    return undefined;
  }
  const clean = value.trim();
  if (clean.length > max) {
    details.push({ field, problem: `Máximo ${max} caracteres` });
    return undefined;
  }
  return clean || null;
}

/**
 * Lee los campos de un negocio presentes en `body` (todos opcionales aquí).
 * @param {Record<string, unknown>} body
 * @param {FieldProblem[]} details
 * @returns {{ name?: string, description?: string|null, nit?: string|null }}
 */
function readBusinessFields(body, details) {
  const out = {};
  if ('name' in body) {
    if (typeof body.name !== 'string' || body.name.trim() === '') {
      details.push({ field: 'name', problem: 'Es obligatorio' });
    } else if (body.name.trim().length > MAX_NAME_LENGTH) {
      details.push({ field: 'name', problem: `Máximo ${MAX_NAME_LENGTH} caracteres` });
    } else {
      out.name = body.name.trim();
    }
  }
  if ('description' in body) {
    const description = readOptionalText(
      body.description,
      'description',
      MAX_DESCRIPTION_LENGTH,
      details,
    );
    if (description !== undefined) out.description = description;
  }
  if ('nit' in body) {
    const nit = readOptionalText(body.nit, 'nit', MAX_NIT_LENGTH, details);
    if (nit && !NIT_RE.test(nit)) {
      details.push({ field: 'nit', problem: 'Solo números, puntos y guiones' });
    } else if (nit !== undefined) {
      out.nit = nit;
    }
  }
  return out;
}

/**
 * Valida el cuerpo de `POST /businesses`: `{ name, description?, nit? }`.
 * @param {unknown} body
 * @returns {{ name: string, description: string|null, nit: string|null }}
 */
export function parseNewBusiness(body) {
  if (!isObject(body)) throw invalidBody();
  const details = [];
  if (!('name' in body)) details.push({ field: 'name', problem: 'Es obligatorio' });
  const fields = readBusinessFields(body, details);
  throwIfInvalid(details);
  return { description: null, nit: null, ...fields };
}

/**
 * Valida el cuerpo de `PATCH /businesses/:id`: los mismos campos, todos opcionales (al menos uno).
 * @param {unknown} body
 * @returns {{ name?: string, description?: string|null, nit?: string|null }}
 */
export function parseBusinessChanges(body) {
  if (!isObject(body)) throw invalidBody();
  const details = [];
  const fields = readBusinessFields(body, details);
  throwIfInvalid(details);
  if (Object.keys(fields).length === 0) {
    throwIfInvalid([{ field: 'body', problem: 'Envía al menos un campo para cambiar' }]);
  }
  return fields;
}

/**
 * @param {unknown} role
 * @param {FieldProblem[]} details
 * @returns {'dueno'|'editor'|'lector'|undefined}
 */
function readRole(role, details) {
  if (!ROLES.includes(role)) {
    details.push({ field: 'role', problem: 'Debe ser "dueno", "editor" o "lector"' });
    return undefined;
  }
  return role;
}

/**
 * Valida el cuerpo de `POST /businesses/:id/invitations`: `{ email, role? }` (editor por defecto).
 * @param {unknown} body
 * @returns {{ email: string, role: 'dueno'|'editor'|'lector' }}
 */
export function parseInvitation(body) {
  if (!isObject(body)) throw invalidBody();
  const details = [];
  const role = body.role === undefined ? 'editor' : readRole(body.role, details);
  throwIfInvalid(details);
  return { email: parseEmail(body.email), role };
}

/**
 * Valida el cuerpo de `PATCH /businesses/:id/partners/:userId`: `{ role?, share? }`.
 * `share` es el % de participación (0 a 100, dos decimales); `null` lo quita.
 * @param {unknown} body
 * @returns {{ role?: 'dueno'|'editor'|'lector', share?: number|null }}
 */
export function parsePartnerChanges(body) {
  if (!isObject(body)) throw invalidBody();
  const details = [];
  const out = {};
  if ('role' in body) {
    const role = readRole(body.role, details);
    if (role) out.role = role;
  }
  if ('share' in body) {
    if (body.share === null) {
      out.share = null;
    } else if (
      typeof body.share !== 'number' ||
      !Number.isFinite(body.share) ||
      body.share < 0 ||
      body.share > 100
    ) {
      details.push({ field: 'share', problem: 'Debe ser un porcentaje entre 0 y 100' });
    } else {
      out.share = Math.round(body.share * 100) / 100;
    }
  }
  throwIfInvalid(details);
  if (Object.keys(out).length === 0) {
    throwIfInvalid([{ field: 'body', problem: 'Envía role o share' }]);
  }
  return out;
}
