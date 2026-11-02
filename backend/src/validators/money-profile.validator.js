import { AppError } from '../errors/app-error.js';

const INCOME_TYPES = ['fecha_fija', 'sin_fecha'];

/** Lo máximo que cabe en `compromisos.monto` y `perfiles_financieros.saldo_inicial`. */
const MAX_AMOUNT = 9_999_999_999.99;

const MAX_NAME_LENGTH = 60;

/** Días de pago por mes: cubre pagos semanales con fecha fija. */
const MAX_PAY_DAYS = 4;

/** Lo mismo que limita el servicio: la bienvenida no llena más compromisos que una cuenta. */
export const MAX_COMMITMENTS = 30;

/** @typedef {{ field: string, problem: string }} FieldProblem */

/** @typedef {{ name: string, amount: number, dayOfMonth: number }} NewCommitment */

/** @typedef {{ incomeType: 'fecha_fija'|'sin_fecha'|null, payDays: number[], balance: number|null, resetBalance?: boolean }} ProfileData */

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
 * @param {unknown} value
 * @returns {boolean} `true` si es un día del mes (1 a 31).
 */
function isDayOfMonth(value) {
  return Number.isInteger(value) && value >= 1 && value <= 31;
}

/**
 * Valida un compromiso. Con `prefix` el campo se nombra dentro de una lista.
 * @param {unknown} source
 * @param {FieldProblem[]} details Lista a la que se añaden los problemas.
 * @param {string} [prefix]
 * @returns {NewCommitment} Datos limpios; solo sirven si `details` sigue vacío.
 */
function readCommitment(source, details, prefix = '') {
  const { name, amount, dayOfMonth } = isObject(source) ? source : {};
  if (typeof name !== 'string' || name.trim() === '') {
    details.push({ field: `${prefix}name`, problem: 'Es obligatorio' });
  } else if (name.trim().length > MAX_NAME_LENGTH) {
    details.push({ field: `${prefix}name`, problem: `Máximo ${MAX_NAME_LENGTH} caracteres` });
  }
  const rounded = typeof amount === 'number' ? Math.round(amount * 100) / 100 : NaN;
  if (!Number.isFinite(rounded) || rounded <= 0) {
    details.push({ field: `${prefix}amount`, problem: 'Debe ser un número mayor que 0' });
  } else if (rounded > MAX_AMOUNT) {
    details.push({ field: `${prefix}amount`, problem: 'Es demasiado grande' });
  }
  if (!isDayOfMonth(dayOfMonth)) {
    details.push({ field: `${prefix}dayOfMonth`, problem: 'Debe ser un día entre 1 y 31' });
  }
  return { name: name?.trim?.(), amount: rounded, dayOfMonth };
}

/**
 * Valida cómo le entra la plata al usuario y cuánta tiene. Todo se puede dejar sin responder;
 * los días de pago solo se piden y se guardan con fecha fija.
 * @param {Record<string, unknown>} source
 * @param {FieldProblem[]} details Lista a la que se añaden los problemas.
 * @returns {ProfileData} Datos limpios; solo sirven si `details` sigue vacío.
 */
function readProfile(source, details) {
  const { incomeType = null, payDays = [], balance = null } = source;
  if (incomeType !== null && !INCOME_TYPES.includes(incomeType)) {
    details.push({ field: 'incomeType', problem: 'Debe ser "fecha_fija" o "sin_fecha"' });
  }
  const fixed = incomeType === 'fecha_fija';
  if (fixed) {
    const valid = Array.isArray(payDays) && payDays.length > 0 && payDays.length <= MAX_PAY_DAYS && payDays.every(isDayOfMonth);
    if (!valid) details.push({ field: 'payDays', problem: `Elige de 1 a ${MAX_PAY_DAYS} días entre 1 y 31` });
  }
  const cleanBalance = typeof balance === 'number' ? Math.round(balance * 100) / 100 : balance;
  if (
    cleanBalance !== null &&
    (typeof cleanBalance !== 'number' || !Number.isFinite(cleanBalance) || cleanBalance < 0 || cleanBalance > MAX_AMOUNT)
  ) {
    details.push({ field: 'balance', problem: 'Debe ser un número desde 0' });
  }
  return {
    incomeType,
    payDays: fixed && Array.isArray(payDays) ? [...new Set(payDays)].sort((a, b) => a - b) : [],
    balance: cleanBalance,
  };
}

/**
 * Valida el cuerpo de `PUT /money-profile`: `{ incomeType, payDays, balance, resetBalance }`.
 * `resetBalance` dice que el usuario corrigió el saldo, aunque sea al mismo número de antes.
 * @param {unknown} body
 * @returns {ProfileData}
 * @throws {AppError} 400 o 422 `VALIDATION_ERROR`.
 */
export function parseProfile(body) {
  if (!isObject(body)) throw invalidBody();
  const details = [];
  const profile = readProfile(body, details);
  throwIfInvalid(details);
  return { ...profile, resetBalance: body.resetBalance === true };
}

/**
 * Valida el cuerpo de `POST /money-profile/welcome`. Un cuerpo vacío significa que el usuario
 * omitió la bienvenida. Los compromisos con el mismo nombre se toman como uno solo.
 * @param {unknown} body
 * @returns {ProfileData & { commitments: NewCommitment[] }}
 * @throws {AppError} 400 o 422 `VALIDATION_ERROR`.
 */
export function parseWelcome(body) {
  const source = body ?? {};
  if (!isObject(source)) throw invalidBody();
  const details = [];
  const profile = readProfile(source, details);
  const { commitments = [] } = source;
  if (!Array.isArray(commitments) || commitments.length > MAX_COMMITMENTS) {
    details.push({ field: 'commitments', problem: `Debe ser una lista de hasta ${MAX_COMMITMENTS}` });
    throwIfInvalid(details);
  }
  const clean = commitments.map((item, i) => readCommitment(item, details, `commitments[${i}].`));
  throwIfInvalid(details);
  return { ...profile, commitments: clean };
}

/**
 * Valida el cuerpo de `POST /money-profile/commitments` y de `PUT .../:id`.
 * @param {unknown} body
 * @returns {NewCommitment}
 * @throws {AppError} 400 o 422 `VALIDATION_ERROR`.
 */
export function parseCommitment(body) {
  if (!isObject(body)) throw invalidBody();
  const details = [];
  const commitment = readCommitment(body, details);
  throwIfInvalid(details);
  return commitment;
}
