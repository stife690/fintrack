import { AppError } from '../errors/app-error.js';

const MAX_DESCRIPTION_LENGTH = 200;
const MAX_AMOUNT = 9_999_999_999.99;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = ['ingreso', 'gasto'];
const PERIODS = ['week', 'month', 'year'];

function isValidPeriod(value) {
  return PERIODS.includes(value);
}
/**
 * @typedef {{ field: string, problem: string }} FieldProblem
 */

/**
 * @param {string} value
 * @returns {boolean} `true` si es una fecha de calendario real con formato AAAA-MM-DD.
 */
function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
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
 * Valida cada campo de una transacción que venga presente en `body`.
 * @param {Record<string, unknown>} body
 * @param {FieldProblem[]} details Lista a la que se añaden los problemas.
 * @returns {Record<string, unknown>} Valores ya limpios (monto redondeado a 2 decimales, texto recortado).
 */
function readFields(body, details) {
  const out = {};

  if ('amount' in body) {
    const amount = body.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      details.push({ field: 'amount', problem: 'Debe ser un número mayor que 0' });
    } else if (amount > MAX_AMOUNT) {
      details.push({ field: 'amount', problem: 'Es demasiado grande' });
    } else {
      const rounded = Math.round(amount * 100) / 100;
      if (rounded <= 0) details.push({ field: 'amount', problem: 'Debe ser al menos 0.01' });
      else out.amount = rounded;
    }
  }

  if ('description' in body) {
    const description = body.description;
    if (typeof description !== 'string' || description.trim() === '') {
      details.push({ field: 'description', problem: 'Es obligatoria' });
    } else if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
      details.push({
        field: 'description',
        problem: `Máximo ${MAX_DESCRIPTION_LENGTH} caracteres`,
      });
    } else {
      out.description = description.trim();
    }
  }

  if ('type' in body) {
    if (!TYPES.includes(body.type)) {
      details.push({ field: 'type', problem: 'Debe ser "ingreso" o "gasto"' });
    } else {
      out.type = body.type;
    }
  }

  if ('date' in body) {
    if (!isValidDate(body.date)) {
      details.push({ field: 'date', problem: 'Debe ser una fecha válida AAAA-MM-DD' });
    } else {
      out.date = body.date;
    }
  }

  if ('category' in body) {
    const category = body.category;
    if (category === null || category === undefined || category === '') {
      out.category = null;
    } else if (typeof category !== 'string') {
      details.push({ field: 'category', problem: 'Debe ser la clave de una categoría' });
    } else {
      out.category = category.trim();
    }
  }

  return out;
}

/**
 * Valida el cuerpo de `POST /transactions`. `amount`, `description`, `type` y `date`
 * son obligatorios; `category` es opcional (vacío → categorización con IA).
 * @param {unknown} body
 * @returns {{ amount: number, description: string, type: 'ingreso'|'gasto', date: string, category: string|null }}
 * @throws {AppError} 422 `VALIDATION_ERROR`.
 */
export function parseCreateTransaction(body) {
  const source = body && typeof body === 'object' ? body : {};
  const details = [];
  for (const field of ['amount', 'description', 'type', 'date']) {
    if (!(field in source)) details.push({ field, problem: 'Es obligatorio' });
  }
  const values = readFields(source, details);
  throwIfInvalid(details);
  return { category: null, ...values };
}

/**
 * Valida el cuerpo de `PUT /transactions/:id`: todos los campos son opcionales,
 * pero debe venir al menos uno. `category` solo aparece en el resultado si vino en el cuerpo.
 * @param {unknown} body
 * @returns {{ amount?: number, description?: string, type?: 'ingreso'|'gasto', date?: string, category?: string|null }}
 * @throws {AppError} 422 `VALIDATION_ERROR`.
 */
export function parseUpdateTransaction(body) {
  const source = body && typeof body === 'object' ? body : {};
  const known = ['amount', 'description', 'type', 'date', 'category'];
  const details = [];
  if (!known.some((field) => field in source)) {
    details.push({ field: 'body', problem: 'Envía al menos un campo para modificar' });
  }
  const values = readFields(source, details);
  throwIfInvalid(details);
  return values;
}

/**
 * Valida los filtros de `GET /transactions` (todos opcionales).
 * @param {Record<string, unknown>} query Parámetros de la URL.
 * @returns {{ type?: 'ingreso'|'gasto', category?: string, from?: string, to?: string, page: number, pageSize: number }}
 * @throws {AppError} 422 `VALIDATION_ERROR`.
 */
export function parseListQuery(query) {
  const details = [];
  const out = {};

  if (query.type !== undefined) {
    if (TYPES.includes(query.type)) out.type = query.type;
    else details.push({ field: 'type', problem: 'Debe ser "ingreso" o "gasto"' });
  }
  if (query.category !== undefined) {
    if (typeof query.category === 'string' && query.category !== '') out.category = query.category;
    else details.push({ field: 'category', problem: 'Debe ser la clave de una categoría' });
  }
  for (const field of ['from', 'to']) {
    if (query[field] === undefined) continue;
    if (isValidDate(query[field])) out[field] = query[field];
    else details.push({ field, problem: 'Debe ser una fecha válida AAAA-MM-DD' });
  }
  if (out.from && out.to && out.from > out.to) {
    details.push({ field: 'from', problem: 'No puede ser posterior a "to"' });
  }

  const number = (field, fallback, max) => {
    if (query[field] === undefined) return fallback;
    const value = Number(query[field]);
    if (!Number.isInteger(value) || value < 1 || (max && value > max)) {
      details.push({
        field,
        problem: max ? `Debe ser un entero entre 1 y ${max}` : 'Debe ser un entero mayor que 0',
      });
      return fallback;
    }
    return value;
  };
  out.page = number('page', 1);
  out.pageSize = number('pageSize', DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  throwIfInvalid(details);
  return out;
}
/**
 * Valida los parámetros de `GET /transactions/summary`. Si no llega `date`, usa la fecha
 * de hoy en Colombia.
 * @param {Record<string, unknown>} query Parámetros de la URL.
 * @returns {{ period: 'week'|'month'|'year', date: string }}
 * @throws {AppError} 422 `VALIDATION_ERROR`.
 */
export function parseSummaryQuery(query) {
  const details = [];
  if (!isValidPeriod(query.period)) {
    details.push({ field: 'period', problem: 'Debe ser "week", "month" o "year"' });
  }
  if (query.date !== undefined && !isValidDate(query.date)) {
    details.push({ field: 'date', problem: 'Debe ser una fecha válida AAAA-MM-DD' });
  }
  throwIfInvalid(details);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const date = query.date || today;
  return { period: query.period, date };
}
