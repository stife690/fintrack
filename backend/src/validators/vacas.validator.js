import { AppError } from '../errors/app-error.js';
import { isValidDate } from './transactions.validator.js';

/** Lo máximo que cabe en `vacas.meta` y `vaca_aportes.monto` (numeric(12,2)). */
const MAX_AMOUNT = 9_999_999_999.99;
const MAX_NAME_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 200;
const MAX_NOTE_LENGTH = 120;
/** El servidor le antepone "vaca-" para el gasto del aporte; `transacciones.local_id` admite 64. */
const MAX_LOCAL_ID_LENGTH = 56;
const SPLITS = ['igual', 'personalizado'];
const ROLES = ['admin', 'miembro'];
const CODE_RE = /^[A-Za-z0-9]{4,8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
 * Valida un monto mayor que 0 y lo devuelve redondeado a 2 decimales.
 * @param {unknown} value
 * @param {string} field
 * @param {FieldProblem[]} details
 * @returns {number|undefined}
 */
function readAmount(value, field, details) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    details.push({ field, problem: 'Debe ser un número mayor que 0' });
    return undefined;
  }
  if (value > MAX_AMOUNT) {
    details.push({ field, problem: 'Es demasiado grande' });
    return undefined;
  }
  const rounded = Math.round(value * 100) / 100;
  if (rounded <= 0) {
    details.push({ field, problem: 'Debe ser al menos 0.01' });
    return undefined;
  }
  return rounded;
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
 * Lee los campos de una vaca presentes en `body` (todos opcionales aquí).
 * @param {Record<string, unknown>} body
 * @param {FieldProblem[]} details
 * @returns {{ name?: string, description?: string|null, goal?: number, deadline?: string|null, split?: 'igual'|'personalizado' }}
 */
function readVacaFields(body, details) {
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
  if ('goal' in body) {
    const goal = readAmount(body.goal, 'goal', details);
    if (goal !== undefined) out.goal = goal;
  }
  if ('deadline' in body) {
    if (body.deadline === null || body.deadline === '') {
      out.deadline = null;
    } else if (!isValidDate(body.deadline)) {
      details.push({ field: 'deadline', problem: 'Debe ser una fecha válida AAAA-MM-DD' });
    } else {
      out.deadline = body.deadline;
    }
  }
  if ('split' in body) {
    if (!SPLITS.includes(body.split)) {
      details.push({ field: 'split', problem: 'Debe ser "igual" o "personalizado"' });
    } else {
      out.split = body.split;
    }
  }
  return out;
}

/**
 * Valida el cuerpo de `POST /vacas`: `{ name, goal, description?, deadline?, split? }`.
 * @param {unknown} body
 * @returns {{ name: string, description: string|null, goal: number, deadline: string|null, split: 'igual'|'personalizado' }}
 */
export function parseNewVaca(body) {
  if (!isObject(body)) throw invalidBody();
  const details = [];
  if (!('name' in body)) details.push({ field: 'name', problem: 'Es obligatorio' });
  if (!('goal' in body)) details.push({ field: 'goal', problem: 'Es obligatoria' });
  const fields = readVacaFields(body, details);
  throwIfInvalid(details);
  return { description: null, deadline: null, split: 'igual', ...fields };
}

/**
 * Valida el cuerpo de `PATCH /vacas/:id`: los mismos campos, todos opcionales (al menos uno).
 * @param {unknown} body
 * @returns {{ name?: string, description?: string|null, goal?: number, deadline?: string|null, split?: 'igual'|'personalizado' }}
 */
export function parseVacaChanges(body) {
  if (!isObject(body)) throw invalidBody();
  const details = [];
  const fields = readVacaFields(body, details);
  throwIfInvalid(details);
  if (Object.keys(fields).length === 0) {
    throwIfInvalid([{ field: 'body', problem: 'Envía al menos un campo para cambiar' }]);
  }
  return fields;
}

/**
 * Valida un código de invitación (del cuerpo de `POST /vacas/join` o de la URL).
 * @param {unknown} code
 * @returns {string} En mayúsculas: el código no distingue mayúsculas.
 */
export function parseCode(code) {
  if (typeof code !== 'string' || !CODE_RE.test(code.trim())) {
    throwIfInvalid([{ field: 'code', problem: 'El código no es válido' }]);
  }
  return code.trim().toUpperCase();
}

/**
 * Valida el cuerpo de `POST /vacas/join`: `{ code }`.
 * @param {unknown} body
 * @returns {string}
 */
export function parseJoin(body) {
  if (!isObject(body)) throw invalidBody();
  return parseCode(body.code);
}

/**
 * Valida un correo (invitar o cancelar una invitación).
 * @param {unknown} email
 * @returns {string} Sin espacios y en minúsculas.
 */
export function parseEmail(email) {
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.trim().length > 255) {
    throwIfInvalid([{ field: 'email', problem: 'Debe ser un correo válido' }]);
  }
  return email.trim().toLowerCase();
}

/**
 * Valida el cuerpo de `POST /vacas/:id/invitations`: `{ email }`.
 * @param {unknown} body
 * @returns {string}
 */
export function parseInvitation(body) {
  if (!isObject(body)) throw invalidBody();
  return parseEmail(body.email);
}

/**
 * Valida el cuerpo de `PATCH /vacas/:id/members/:userId`: `{ role?, quota? }`.
 * `quota: null` vuelve a la cuota calculada.
 * @param {unknown} body
 * @returns {{ role?: 'admin'|'miembro', quota?: number|null }}
 */
export function parseMemberChanges(body) {
  if (!isObject(body)) throw invalidBody();
  const details = [];
  const out = {};
  if ('role' in body) {
    if (!ROLES.includes(body.role)) {
      details.push({ field: 'role', problem: 'Debe ser "admin" o "miembro"' });
    } else {
      out.role = body.role;
    }
  }
  if ('quota' in body) {
    if (body.quota === null) {
      out.quota = null;
    } else if (typeof body.quota !== 'number' || !Number.isFinite(body.quota) || body.quota < 0) {
      details.push({ field: 'quota', problem: 'Debe ser un número mayor o igual a 0' });
    } else if (body.quota > MAX_AMOUNT) {
      details.push({ field: 'quota', problem: 'Es demasiado grande' });
    } else {
      out.quota = Math.round(body.quota * 100) / 100;
    }
  }
  throwIfInvalid(details);
  if (Object.keys(out).length === 0) {
    throwIfInvalid([{ field: 'body', problem: 'Envía role o quota' }]);
  }
  return out;
}

/**
 * Valida el cuerpo de `POST /vacas/:id/contributions`:
 * `{ amount, date, note?, category?, localId? }`.
 * @param {unknown} body
 * @returns {{ amount: number, date: string, note: string|null, category: string|null, localId: string|null }}
 */
export function parseContribution(body) {
  if (!isObject(body)) throw invalidBody();
  const details = [];
  const amount = readAmount(body.amount, 'amount', details);
  if (!isValidDate(body.date)) {
    details.push({ field: 'date', problem: 'Debe ser una fecha válida AAAA-MM-DD' });
  }
  const note = readOptionalText(body.note, 'note', MAX_NOTE_LENGTH, details);
  let category = null;
  if (body.category !== undefined && body.category !== null) {
    if (typeof body.category !== 'string' || body.category.trim() === '') {
      details.push({ field: 'category', problem: 'Debe ser la clave de una categoría de gasto' });
    } else {
      category = body.category.trim();
    }
  }
  let localId = null;
  if (body.localId !== undefined && body.localId !== null) {
    if (
      typeof body.localId !== 'string' ||
      body.localId.trim() === '' ||
      body.localId.length > MAX_LOCAL_ID_LENGTH
    ) {
      details.push({
        field: 'localId',
        problem: `Debe ser texto de hasta ${MAX_LOCAL_ID_LENGTH} caracteres`,
      });
    } else {
      localId = body.localId;
    }
  }
  throwIfInvalid(details);
  return { amount, date: body.date, note, category, localId };
}
