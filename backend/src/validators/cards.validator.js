import { AppError } from '../errors/app-error.js';
import { NETWORKS, TIERS } from '../services/cards.logic.js';

/** Lo máximo que cabe en `numeric(12,2)`. */
const MAX_AMOUNT = 9_999_999_999.99;
const cents = (n) => Math.round(n * 100) / 100;

/**
 * @typedef {{ field: string, problem: string }} FieldProblem
 */

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
 * Lee un monto; `min0` permite el cero. Devuelve el valor redondeado a centavos.
 * @param {unknown} v
 * @param {string} field
 * @param {FieldProblem[]} details
 * @param {boolean} [allowZero]
 * @returns {number|undefined}
 */
function readMoney(v, field, details, allowZero = false) {
  const ok = typeof v === 'number' && Number.isFinite(v) && (allowZero ? v >= 0 : v > 0);
  if (!ok || v > MAX_AMOUNT || (!allowZero && cents(v) <= 0)) {
    details.push({
      field,
      problem: allowZero
        ? 'Debe ser un número mayor o igual que 0'
        : 'Debe ser un número mayor que 0',
    });
    return undefined;
  }
  return cents(v);
}

/**
 * @param {unknown} v
 * @param {string} field
 * @param {FieldProblem[]} details
 * @returns {number|undefined}
 */
function readDay(v, field, details) {
  if (!Number.isInteger(v) || v < 1 || v > 31) {
    details.push({ field, problem: 'Debe ser un día entre 1 y 31' });
    return undefined;
  }
  return v;
}

/**
 * @param {unknown} v
 * @param {string} field
 * @param {FieldProblem[]} details
 * @returns {string|undefined} Fecha AAAA-MM-DD real.
 */
function readDate(v, field, details) {
  const ok =
    typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);
  if (!ok) {
    details.push({ field, problem: 'Debe ser una fecha AAAA-MM-DD' });
    return undefined;
  }
  return v;
}

/**
 * Valida los campos de tarjeta comunes a crear y editar (los ausentes se omiten).
 * @param {object} body
 * @param {FieldProblem[]} details
 * @returns {object}
 */
function readCommon(body, details) {
  const out = {};
  if (body.network !== undefined) {
    if (NETWORKS.includes(body.network)) out.network = body.network;
    else details.push({ field: 'network', problem: `Debe ser: ${NETWORKS.join(', ')}` });
  }
  if (body.tier !== undefined) {
    if (typeof body.tier === 'string') out.tier = body.tier;
    else details.push({ field: 'tier', problem: 'Nivel no válido' });
  }
  if (body.last4 !== undefined) {
    if (typeof body.last4 === 'string' && /^\d{4}$/.test(body.last4)) out.last4 = body.last4;
    else details.push({ field: 'last4', problem: 'Deben ser exactamente 4 dígitos' });
  }
  if (body.limit !== undefined) out.limit = readMoney(body.limit, 'limit', details);
  if (body.paymentDay !== undefined)
    out.paymentDay = readDay(body.paymentDay, 'paymentDay', details);
  if (body.cutoffDay !== undefined) {
    out.cutoffDay = body.cutoffDay === null ? null : readDay(body.cutoffDay, 'cutoffDay', details);
  }
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length >= 1 && name.length <= 60) out.name = name;
    else details.push({ field: 'name', problem: 'Debe tener entre 1 y 60 caracteres' });
  }
  return out;
}

/**
 * Comprueba que el nivel corresponda a la franquicia.
 * @param {string} network
 * @param {string} tier
 * @param {FieldProblem[]} details
 * @returns {void}
 */
export function checkTier(network, tier, details) {
  if (!TIERS[network]?.includes(tier)) {
    details.push({
      field: 'tier',
      problem: `Para ${network} debe ser: ${TIERS[network]?.join(', ')}`,
    });
  }
}

/**
 * Valida `POST /cards`.
 * @param {unknown} body
 * @returns {{ network: string, tier: string, last4: string, limit: number, available: number, paymentDay: number, name?: string, cutoffDay?: number|null }}
 */
export function parseNewCard(body) {
  requireObject(body);
  const details = [];
  const data = readCommon(body, details);
  for (const f of ['network', 'tier', 'last4', 'limit', 'paymentDay']) {
    if (body[f] === undefined) details.push({ field: f, problem: 'Es obligatorio' });
  }
  if (body.available === undefined) details.push({ field: 'available', problem: 'Es obligatorio' });
  else data.available = readMoney(body.available, 'available', details, true);
  if (data.network && data.tier) checkTier(data.network, data.tier, details);
  if (data.available !== undefined && data.limit !== undefined && data.available > data.limit) {
    details.push({ field: 'available', problem: 'No puede ser mayor que el cupo' });
  }
  throwIfInvalid(details);
  return data;
}

/**
 * Valida `PUT /cards/:id` (campos opcionales; `available` se rechaza).
 * @param {unknown} body
 * @returns {object}
 */
export function parseCardChanges(body) {
  requireObject(body);
  const details = [];
  if (body.available !== undefined) {
    details.push({ field: 'available', problem: 'No se edita aquí: usa sync-with-bank' });
  }
  const data = readCommon(body, details);
  throwIfInvalid(details);
  return data;
}

/**
 * Valida `POST /cards/:id/payments`.
 * @param {unknown} body
 * @returns {{ amount: number, date?: string }}
 */
export function parsePayment(body) {
  requireObject(body);
  const details = [];
  const amount = readMoney(body.amount, 'amount', details);
  const date = body.date === undefined ? undefined : readDate(body.date, 'date', details);
  throwIfInvalid(details);
  return { amount, date };
}

/**
 * Valida `POST /cards/:id/sync-with-bank`.
 * @param {unknown} body
 * @returns {{ available: number, statementTotal?: number, statementDueDate?: string }}
 */
export function parseSync(body) {
  requireObject(body);
  const details = [];
  const available = readMoney(body.available, 'available', details, true);
  const out = { available };
  if (body.statementTotal !== undefined) {
    out.statementTotal = readMoney(body.statementTotal, 'statementTotal', details, true);
  }
  if (body.statementDueDate !== undefined) {
    out.statementDueDate = readDate(body.statementDueDate, 'statementDueDate', details);
  }
  throwIfInvalid(details);
  return out;
}
