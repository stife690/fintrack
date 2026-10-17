import { AppError } from '../errors/app-error.js';

/** AAAA-MM con un mes real: 01 a 12. */
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Lo máximo que cabe en `presupuestos.monto_limite` (numeric(12,2)). */
const MAX_AMOUNT = 9_999_999_999.99;

/**
 * @typedef {{ field: string, problem: string }} FieldProblem
 */

/** @returns {AppError} 400: el cuerpo no es un objeto JSON. */
function invalidBody() {
  return new AppError(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
}

/**
 * Lanza un 422 con el detalle por campo si se encontró algún problema.
 * @param {FieldProblem[]} details
 * @returns {void}
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
 * Valida un monto y lo devuelve redondeado a 2 decimales.
 * @param {unknown} value
 * @param {FieldProblem[]} details Lista a la que se añade el problema, si lo hay.
 * @returns {number|undefined} El monto limpio, o `undefined` si no es válido.
 */
function readAmount(value, details) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    details.push({ field: 'amount', problem: 'Debe ser un número mayor que 0' });
    return undefined;
  }
  if (value > MAX_AMOUNT) {
    details.push({ field: 'amount', problem: 'Es demasiado grande' });
    return undefined;
  }
  const rounded = Math.round(value * 100) / 100;
  if (rounded <= 0) {
    details.push({ field: 'amount', problem: 'Debe ser al menos 0.01' });
    return undefined;
  }
  return rounded;
}
/**
 * Valida el cuerpo de `POST /budgets`: `{ category, month, amount }`.
 * @param {unknown} body
 * @returns {{ category: string, month: string, amount: number }} Datos limpios.
 */
export function parseNewBudget(body) {
  if (!isObject(body)) throw invalidBody();

  const details = [];
  const { category, month, amount } = body;

  if (typeof category !== 'string' || category.trim() === '') {
    details.push({ field: 'category', problem: 'Es obligatoria' });
  }
  if (typeof month !== 'string' || !MONTH_RE.test(month)) {
    details.push({ field: 'month', problem: 'Debe tener el formato AAAA-MM' });
  }
  const cleanAmount = readAmount(amount, details);

  throwIfInvalid(details);
  return { category: category.trim(), month, amount: cleanAmount };
}
/**
 * Valida el cuerpo de `PUT /budgets/:id`: `{ amount }`.
 * @param {unknown} body
 * @returns {number} El monto limpio.
 */
export function parseBudgetAmount(body) {
  if (!isObject(body)) throw invalidBody();

  const details = [];
  const amount = readAmount(body.amount, details);

  throwIfInvalid(details);
  return amount;
}

/**
 * Valida el `?month=` opcional de `GET /budgets`.
 * @param {Record<string, unknown>} query
 * @returns {string|undefined} El mes, o `undefined` si no se indicó (el service usa el actual).
 */
export function parseMonthQuery(query) {
  const { month } = query;
  if (month === undefined) return undefined;
  if (typeof month !== 'string' || !MONTH_RE.test(month)) {
    throwIfInvalid([{ field: 'month', problem: 'Debe tener el formato AAAA-MM' }]);
  }
  return month;
}