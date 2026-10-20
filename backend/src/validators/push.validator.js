import { AppError } from '../errors/app-error.js';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** @returns {AppError} 400: el cuerpo no tiene la forma esperada. */
function invalidBody() {
  return new AppError(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
}

/**
 * @param {unknown} value
 * @returns {boolean} `true` si es un objeto simple (no nulo ni arreglo).
 */
function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {boolean} `true` si es una URL https válida.
 */
function isHttpsUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * @param {unknown} value
 * @returns {boolean} `true` si es un texto no vacío.
 */
function isFilledString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Comprueba que `value` sea una suscripción Web Push: `endpoint` https y llaves `p256dh` y `auth`.
 * @param {unknown} body Cuerpo de `POST /push/subscribe`.
 * @returns {{ endpoint: string, keys: { p256dh: string, auth: string } }}
 */
export function parseSubscribeBody(body) {
  const subscription = isObject(body) ? body.subscription : undefined;
  if (!isObject(subscription) || !isHttpsUrl(subscription.endpoint)) throw invalidBody();
  const keys = subscription.keys;
  if (!isObject(keys) || !isFilledString(keys.p256dh) || !isFilledString(keys.auth)) {
    throw invalidBody();
  }
  return { endpoint: subscription.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

/**
 * Comprueba que el cuerpo de `DELETE /push/subscribe` traiga un `endpoint` de texto.
 * @param {unknown} body
 * @returns {string}
 */
export function parseUnsubscribeBody(body) {
  if (!isObject(body) || !isFilledString(body.endpoint)) throw invalidBody();
  return body.endpoint;
}

/**
 * @param {string} timezone
 * @returns {boolean} `true` si es una zona horaria IANA que el servidor reconoce.
 */
export function isValidTimezone(timezone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** Máximo de recordatorios por día. */
export const MAX_REMINDERS_PER_DAY = 5;

/**
 * Valida el cuerpo de `PUT /users/me/reminder-settings`.
 * Acepta `times` (arreglo de horas HH:mm, hasta 5; vacío lo desactiva) o, por compatibilidad con
 * clientes anteriores, `time` (una hora o `null`). Las horas repetidas se unifican y se ordenan.
 * Tipos incorrectos → 400; horas, cantidad o zona horaria inválidas → 422 con `details`.
 * @param {unknown} body
 * @returns {{ times: string[], timezone: string }}
 */
export function parseReminderSettings(body) {
  if (!isObject(body) || typeof body.timezone !== 'string') throw invalidBody();

  let raw;
  let field = 'times';
  if (Array.isArray(body.times)) {
    if (!body.times.every((value) => typeof value === 'string')) throw invalidBody();
    raw = body.times;
  } else if (body.times === undefined && (body.time === null || typeof body.time === 'string')) {
    field = 'time';
    raw = body.time === null ? [] : [body.time];
  } else {
    throw invalidBody();
  }

  const details = [];
  const invalid = raw.filter((value) => !TIME_RE.test(value));
  if (invalid.length > 0) {
    details.push({
      field,
      problem: `Cada hora debe tener el formato HH:mm (00:00 a 23:59); no válidas: ${invalid.join(', ')}`,
    });
  }
  const times = [...new Set(raw)].sort();
  if (times.length > MAX_REMINDERS_PER_DAY) {
    details.push({
      field,
      problem: `Máximo ${MAX_REMINDERS_PER_DAY} recordatorios al día`,
    });
  }
  if (!isValidTimezone(body.timezone)) {
    details.push({
      field: 'timezone',
      problem: 'Debe ser una zona horaria válida, p. ej. America/Bogota',
    });
  }
  if (details.length > 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', details);
  }
  return { times, timezone: body.timezone };
}
