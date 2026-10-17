import { AppError } from '../errors/app-error.js';
import { parseCreateTransaction, parseUpdateTransaction } from './transactions.validator.js';

/** Máximo de operaciones por lote (contrato). */
const MAX_OPERATIONS = 200;

/** Largo máximo de `localId` (lo que cabe en `transacciones.local_id`). */
const MAX_LOCAL_ID_LENGTH = 64;

const OPERATIONS = ['create', 'update', 'delete'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * @typedef {{ field: string, problem: string }} FieldProblem
 */

/**
 * @typedef {object} SyncOperation
 * @property {'create'|'update'|'delete'} op Tipo de operación.
 * @property {string} localId Id generado en IndexedDB.
 * @property {string} [serverId] Solo en update y delete.
 * @property {Date} [updatedAt] Solo en update y delete.
 * @property {object} [transaction] Completa en create; solo los cambios en update.
 */
/**
 * @param {unknown} value
 * @returns {boolean} `true` si es un objeto normal (no `null`, no una lista).
 */
function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {boolean} `true` si es una fecha y hora ISO 8601 válida (p. ej. `2026-10-17T21:00:00Z`).
 */
function isDateTime(value) {
  return typeof value === 'string' && DATE_TIME_RE.test(value) && !Number.isNaN(Date.parse(value));
}
/**
 * Valida la transacción de una operación con el validador de transacciones y, si falla,
 * copia sus problemas a `details` indicando en qué operación están.
 * @param {(body: unknown) => object} parse `parseCreateTransaction` o `parseUpdateTransaction`.
 * @param {unknown} value La `transaction` que vino en la operación.
 * @param {string} prefix P. ej. `operations[2].transaction`.
 * @param {FieldProblem[]} details
 * @returns {object|undefined} La transacción limpia, o `undefined` si tenía problemas.
 */
function parseOperationTransaction(parse, value, prefix, details) {
  try {
    return parse(value);
  } catch (err) {
    if (!(err instanceof AppError) || !err.details) throw err;
    for (const { field, problem } of err.details) {
      details.push({ field: field === 'body' ? prefix : `${prefix}.${field}`, problem });
    }
    return undefined;
  }
}
/**
 * Valida una operación del lote y anota sus problemas en `details`.
 * @param {unknown} raw
 * @param {number} index Posición en `operations`, para nombrar los campos con problema.
 * @param {FieldProblem[]} details
 * @returns {SyncOperation|undefined}
 */
function parseOperation(raw, index, details) {
  const at = `operations[${index}]`;
  if (!isObject(raw)) {
    details.push({ field: at, problem: 'Debe ser un objeto' });
    return undefined;
  }

  const { op, localId } = raw;
  if (!OPERATIONS.includes(op)) {
    details.push({ field: `${at}.op`, problem: 'Debe ser "create", "update" o "delete"' });
  }
  if (
    typeof localId !== 'string' ||
    localId.trim() === '' ||
    localId.length > MAX_LOCAL_ID_LENGTH
  ) {
    details.push({
      field: `${at}.localId`,
      problem: `Debe ser un texto de 1 a ${MAX_LOCAL_ID_LENGTH} caracteres`,
    });
  }

  const operation = { op, localId };

  if (op === 'create') {
    operation.transaction = parseOperationTransaction(
      parseCreateTransaction,
      raw.transaction,
      `${at}.transaction`,
      details,
    );
  }

  if (op === 'update' || op === 'delete') {
    if (typeof raw.serverId !== 'string' || !UUID_RE.test(raw.serverId)) {
      details.push({
        field: `${at}.serverId`,
        problem: 'Debe ser el id (UUID) de la transacción en el servidor',
      });
    }
    if (!isDateTime(raw.updatedAt)) {
      details.push({ field: `${at}.updatedAt`, problem: 'Debe ser una fecha y hora ISO 8601' });
    }
    operation.serverId = raw.serverId;
    operation.updatedAt = new Date(raw.updatedAt);
  }

  if (op === 'update') {
    operation.transaction = parseOperationTransaction(
      parseUpdateTransaction,
      raw.transaction,
      `${at}.transaction`,
      details,
    );
  }

  return operation;
}
/**
 * Valida el cuerpo de `POST /sync/batch`. Revisa todo el lote antes de aplicar nada:
 * si algo falla responde un solo 422 con el detalle de cada operación.
 * @param {unknown} body
 * @returns {{ lastSyncedAt: Date|null, operations: SyncOperation[] }}
 * @throws {AppError} 400 si el cuerpo no es un objeto; 422 `VALIDATION_ERROR` si algo es inválido.
 */
export function parseSyncBatch(body) {
  if (!isObject(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
  }

  const details = [];
  const { lastSyncedAt, operations } = body;

  if (lastSyncedAt !== null && !isDateTime(lastSyncedAt)) {
    details.push({
      field: 'lastSyncedAt',
      problem: 'Debe ser una fecha y hora ISO 8601, o null la primera vez',
    });
  }

  let parsed = [];
  if (!Array.isArray(operations)) {
    details.push({ field: 'operations', problem: 'Debe ser una lista' });
  } else if (operations.length > MAX_OPERATIONS) {
    details.push({ field: 'operations', problem: `Máximo ${MAX_OPERATIONS} operaciones por lote` });
  } else {
    parsed = operations.map((raw, index) => parseOperation(raw, index, details));
  }

  if (details.length > 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', details);
  }

  return {
    lastSyncedAt: lastSyncedAt === null ? null : new Date(lastSyncedAt),
    operations: parsed,
  };
}