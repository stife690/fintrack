import { AppError } from '../errors/app-error.js';

/** Lo máximo que cabe en `numeric(12,2)`. */
const MAX_AMOUNT = 9_999_999_999.99;
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
 * Lee el monto como lo manda el iPhone: un número o un texto como "$12.500", "COP 12.500,50" o
 * "12,500.50". El último separador seguido de 1 o 2 cifras es el decimal; si va seguido de 3
 * cifras, es de miles (en pesos casi nunca hay centavos).
 * @param {unknown} value
 * @returns {number|null} El monto, o `null` si no se entiende.
 */
export function parseAmountText(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.replace(/[^\d.,]/g, '');
  if (!/\d/.test(text)) return null;
  const last = Math.max(text.lastIndexOf('.'), text.lastIndexOf(','));
  const decimals = last === -1 ? '' : text.slice(last + 1);
  const isDecimal = last !== -1 && decimals.length >= 1 && decimals.length <= 2;
  const whole = (isDecimal ? text.slice(0, last) : text).replace(/[.,]/g, '');
  const n = Number(isDecimal ? `${whole || '0'}.${decimals}` : whole);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lee la fecha del pago: AAAA-MM-DD o fecha y hora ISO 8601 ("2026-11-04T14:03:00-05:00"). Atajos
 * manda la hora local del iPhone, así que los primeros 10 caracteres ya son la fecha del usuario.
 * @param {unknown} value
 * @returns {{ date: string, minute: string|null }|null} `minute` (AAAA-MM-DDTHH:MM) solo si trae hora.
 */
export function parsePaymentDate(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const date = text.slice(0, 10);
  if (!isDate(date)) return null;
  if (text.length === 10) return { date, minute: null };
  const time = /^T(\d{2}):(\d{2})/.exec(text.slice(10));
  return time ? { date, minute: `${date}T${time[1]}:${time[2]}` } : null;
}

/**
 * Valida `POST /shortcuts/payments` (lo que manda el Atajo del iPhone).
 * @param {unknown} body
 * @returns {{ merchant: string, amount: number, date: string|null, minute: string|null, card: string|null, externalId: string|null }}
 */
export function parseIncomingPayment(body) {
  requireObject(body);
  const details = [];
  const merchant = typeof body.merchant === 'string' ? body.merchant.trim() : '';
  if (merchant.length < 1 || merchant.length > 80) {
    details.push({ field: 'merchant', problem: 'Debe tener entre 1 y 80 caracteres' });
  }
  const amount = parseAmountText(body.amount);
  if (amount === null || cents(amount) <= 0 || amount > MAX_AMOUNT) {
    details.push({ field: 'amount', problem: 'Debe ser un monto mayor que 0' });
  }
  let when = { date: null, minute: null };
  if (body.date !== undefined && body.date !== null && body.date !== '') {
    when = parsePaymentDate(body.date);
    if (!when)
      details.push({ field: 'date', problem: 'Debe ser AAAA-MM-DD o fecha y hora ISO 8601' });
  }
  let card = null;
  if (body.card !== undefined && body.card !== null && body.card !== '') {
    card = typeof body.card === 'string' ? body.card.trim().slice(0, 40) || null : null;
    if (typeof body.card !== 'string') details.push({ field: 'card', problem: 'Debe ser texto' });
  }
  let externalId = null;
  if (body.id !== undefined && body.id !== null && body.id !== '') {
    if (typeof body.id === 'string' && body.id.length <= 100) externalId = body.id;
    else details.push({ field: 'id', problem: 'Debe ser texto de máximo 100 caracteres' });
  }
  throwIfInvalid(details);
  return { merchant, amount: cents(amount), ...when, card, externalId };
}

/**
 * Valida `POST /pending-payments/:id/confirm`. Todo es opcional: sin categoría la elige la IA y
 * sin descripción se usa el comercio.
 * @param {unknown} body Puede venir vacío.
 * @returns {{ category?: string, description?: string }}
 */
export function parseConfirm(body) {
  const input = body ?? {};
  requireObject(input);
  const details = [];
  const out = {};
  if (input.category !== undefined && input.category !== null && input.category !== '') {
    if (typeof input.category === 'string') out.category = input.category;
    else details.push({ field: 'category', problem: 'Debe ser la clave de una categoría' });
  }
  if (input.description !== undefined && input.description !== null) {
    const d = typeof input.description === 'string' ? input.description.trim() : '';
    if (d.length >= 1 && d.length <= 200) out.description = d;
    else details.push({ field: 'description', problem: 'Debe tener entre 1 y 200 caracteres' });
  }
  throwIfInvalid(details);
  return out;
}
