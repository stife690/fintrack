import { AppError } from '../errors/app-error.js';

/** Lo máximo que cabe en `numeric(12,2)`. */
const MAX_AMOUNT = 9_999_999_999.99;
const KINDS = ['receivable', 'payable'];
const cents = (n) => Math.round(n * 100) / 100;

/** @typedef {{ field: string, problem: string }} FieldProblem */

/**
 * @param {unknown} body
 * @returns {void} Lanza 400 si no es un objeto JSON.
 */
function requireObject(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
  }
}

/**
 * @param {FieldProblem[]} details
 * @returns {void} Lanza 422 si hay problemas.
 */
function throwIfInvalid(details) {
  if (details.length > 0) throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', details);
}

/**
 * @param {unknown} v
 * @returns {boolean} Si es una fecha AAAA-MM-DD que existe.
 */
const isDate = (v) =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

/**
 * Lee los campos editables que vengan (los ausentes se omiten).
 * @param {object} body
 * @param {FieldProblem[]} details
 * @returns {{ person?: string, amount?: number, dueDate?: string|null, note?: string|null }}
 */
function readFields(body, details) {
  const out = {};
  if (body.person !== undefined) {
    const person = typeof body.person === 'string' ? body.person.trim() : '';
    if (person.length >= 1 && person.length <= 60) out.person = person;
    else details.push({ field: 'person', problem: 'Debe tener entre 1 y 60 caracteres' });
  }
  if (body.amount !== undefined) {
    const ok = typeof body.amount === 'number' && Number.isFinite(body.amount);
    if (ok && cents(body.amount) > 0 && body.amount <= MAX_AMOUNT) out.amount = cents(body.amount);
    else details.push({ field: 'amount', problem: 'Debe ser un número mayor que 0' });
  }
  if (body.dueDate !== undefined) {
    if (body.dueDate === null || body.dueDate === '') out.dueDate = null;
    else if (isDate(body.dueDate)) out.dueDate = body.dueDate;
    else details.push({ field: 'dueDate', problem: 'Debe ser una fecha AAAA-MM-DD' });
  }
  if (body.note !== undefined) {
    const note = typeof body.note === 'string' ? body.note.trim() : body.note;
    if (note === null || note === '') out.note = null;
    else if (typeof note === 'string' && note.length <= 200) out.note = note;
    else details.push({ field: 'note', problem: 'Máximo 200 caracteres' });
  }
  return out;
}

/**
 * Valida `POST /debts`.
 * @param {unknown} body
 * @returns {{ kind: 'receivable'|'payable', person: string, amount: number, dueDate?: string|null, note?: string|null }}
 */
export function parseNewDebt(body) {
  requireObject(body);
  const details = [];
  if (!KINDS.includes(body.kind)) {
    details.push({ field: 'kind', problem: `Debe ser: ${KINDS.join(', ')}` });
  }
  const data = readFields(body, details);
  for (const f of ['person', 'amount']) {
    if (body[f] === undefined) details.push({ field: f, problem: 'Es obligatorio' });
  }
  throwIfInvalid(details);
  return { kind: body.kind, ...data };
}

/**
 * Valida `PUT /debts/:id` (todo opcional; el tipo no se cambia).
 * @param {unknown} body
 * @returns {{ person?: string, amount?: number, dueDate?: string|null, note?: string|null }}
 */
export function parseDebtChanges(body) {
  requireObject(body);
  const details = [];
  if (body.kind !== undefined) {
    details.push({ field: 'kind', problem: 'No se cambia: borra la cuenta y créala de nuevo' });
  }
  const data = readFields(body, details);
  if (Object.keys(data).length === 0 && details.length === 0) {
    details.push({ field: 'body', problem: 'No hay nada que cambiar' });
  }
  throwIfInvalid(details);
  return data;
}

/**
 * Valida `POST /debts/:id/settle`.
 * @param {unknown} body Puede venir vacío.
 * @returns {{ createTransaction: boolean, date?: string }}
 */
export function parseSettle(body) {
  const input = body ?? {};
  requireObject(input);
  const details = [];
  const out = { createTransaction: true };
  if (input.createTransaction !== undefined) {
    if (typeof input.createTransaction === 'boolean')
      out.createTransaction = input.createTransaction;
    else details.push({ field: 'createTransaction', problem: 'Debe ser true o false' });
  }
  if (input.date !== undefined) {
    if (isDate(input.date)) out.date = input.date;
    else details.push({ field: 'date', problem: 'Debe ser una fecha AAAA-MM-DD' });
  }
  throwIfInvalid(details);
  return out;
}
