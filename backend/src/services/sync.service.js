import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { listCategories } from '../repositories/categories.repository.js';
import * as repo from '../repositories/sync.repository.js';
import { resolveCategory } from './categorization.service.js';
import * as transactions from './transactions.service.js';

/**
 * @typedef {import('../repositories/transactions.repository.js').TransactionRecord} TransactionRecord
 * @typedef {import('../validators/sync.validator.js').SyncOperation} SyncOperation
 */

/**
 * @typedef {object} SyncResult
 * @property {Array<{ localId: string, serverId: string, transaction?: TransactionRecord }>} synced
 *   Operaciones aplicadas sin conflicto. Los `create` traen la transacción guardada, porque no
 *   vuelven en `serverChanges` y el dispositivo necesita la categoría que le quedó.
 * @property {Array<{ localId: string, serverId: string, resolution: 'server_wins'|'client_wins', serverVersion: TransactionRecord|null }>} conflicts Operaciones que chocaron con un cambio del servidor.
 * @property {TransactionRecord[]} serverChanges Lo que cambió en el servidor desde `lastSyncedAt`.
 * @property {Date} syncedAt Hora del servidor para la próxima sincronización.
 */

/**
 * Fase 1: comprueba que cada categoría elegida exista y sea del tipo de su transacción (RN-02),
 * antes de aplicar nada. En `update` sin `type`, el tipo es el que ya tiene en el servidor.
 * @param {SyncOperation[]} operations
 * @param {Map<string, TransactionRecord|null>} current Versión del servidor de cada `serverId`.
 * @returns {Promise<void>}
 * @throws {AppError} 422 con el detalle de cada categoría inválida.
 */
async function assertCategories(operations, current) {
  const typeByKey = new Map((await listCategories()).map((c) => [c.key, c.type]));
  const details = [];
  operations.forEach((operation, index) => {
    const category = operation.transaction?.category;
    if (!category) return;
    const type = operation.transaction.type ?? current.get(operation.serverId)?.type;
    if (typeByKey.get(category) !== type) {
      details.push({
        field: `operations[${index}].transaction.category`,
        problem: `No es una categoría de ${type ?? 'ese tipo'} del catálogo`,
      });
    }
  });
  if (details.length > 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', details);
  }
}

/**
 * Aplica un `create` sin duplicar: si ese `localId` ya existe, devuelve la que ya estaba.
 * La IA solo se usa mientras quede cupo (`aiQuota.left`); sin cupo queda `sin_clasificar`.
 * @param {string} userId
 * @param {SyncOperation} operation
 * @param {{ left: number }} aiQuota Se descuenta cada vez que se consulta a la IA.
 * @returns {Promise<TransactionRecord>}
 */
async function applyCreate(userId, { localId, transaction }, aiQuota) {
  const existing = await repo.findByLocalId(userId, localId);
  if (existing) return existing;

  let decided = { category: null, source: 'sin_clasificar' };
  if (transaction.category) {
    decided = { category: transaction.category, source: 'manual' };
  } else if (aiQuota.left > 0) {
    aiQuota.left -= 1;
    decided = await resolveCategory(transaction);
  }

  const inserted = await repo.insertFromDevice({ ...transaction, ...decided, userId, localId });
  // `null` solo si otra petición insertó ese localId al mismo tiempo: se devuelve esa.
  return inserted ?? repo.findByLocalId(userId, localId);
}

/**
 * Aplica un `update` o `delete` con last-write-wins (RN-07).
 * Hay conflicto si la transacción cambió en el servidor después de `lastSyncedAt`;
 * entonces gana el `updatedAt` más reciente. Un borrado en el servidor no se revierte.
 * @param {string} userId
 * @param {SyncOperation} operation
 * @param {TransactionRecord|null} current Versión actual en el servidor.
 * @param {Date|null} lastSyncedAt
 * @param {Set<string>} touched Ids ya modificados por este mismo lote: no cuentan como cambio del servidor.
 * @returns {Promise<{ synced?: { localId: string, serverId: string }, conflict?: object, touched?: string }>}
 */
async function applyChange(userId, operation, current, lastSyncedAt, touched) {
  const { localId, serverId } = operation;

  // No existe o es de otro usuario (RN-01): se le pide al dispositivo descartar el cambio.
  if (!current) {
    return { conflict: { localId, serverId, resolution: 'server_wins', serverVersion: null } };
  }

  if (current.deletedAt) {
    // Ya estaba borrada: si el dispositivo también quería borrarla, están de acuerdo.
    if (operation.op === 'delete') return { synced: { localId, serverId }, touched: serverId };
    return {
      conflict: { localId, serverId, resolution: 'server_wins', serverVersion: current },
      touched: serverId,
    };
  }

  const changedOnServer =
    !touched.has(serverId) && (lastSyncedAt === null || current.updatedAt > lastSyncedAt);
  if (changedOnServer && current.updatedAt >= operation.updatedAt) {
    return {
      conflict: { localId, serverId, resolution: 'server_wins', serverVersion: current },
      touched: serverId,
    };
  }

  if (operation.op === 'update') {
    await transactions.update(userId, serverId, operation.transaction);
  } else {
    await transactions.remove(userId, serverId);
  }

  if (!changedOnServer) return { synced: { localId, serverId }, touched: serverId };
  return {
    conflict: {
      localId,
      serverId,
      resolution: 'client_wins',
      serverVersion: await repo.findForSync(serverId, userId),
    },
    touched: serverId,
  };
}

/**
 * Sincroniza un lote de operaciones hechas offline (F8, F9 — REQ-022 a REQ-025).
 * Fase 1 valida todo (categorías incluidas); fase 2 aplica en orden; al final arma
 * `serverChanges` sin repetir lo de este lote.
 * @param {string} userId
 * @param {{ lastSyncedAt: Date|null, operations: SyncOperation[] }} batch Ya validado.
 * @returns {Promise<SyncResult>}
 */
export async function syncBatch(userId, { lastSyncedAt, operations }) {
  // Fase 1: versión del servidor de cada transacción a editar o borrar, y categorías.
  const current = new Map();
  for (const operation of operations) {
    if (operation.op !== 'create' && !current.has(operation.serverId)) {
      current.set(operation.serverId, await repo.findForSync(operation.serverId, userId));
    }
  }
  await assertCategories(operations, current);

  // Fase 2: aplicar en orden.
  const synced = [];
  const conflicts = [];
  const touched = new Set();
  const aiQuota = { left: env.syncAiMax };

  for (const operation of operations) {
    if (operation.op === 'create') {
      const record = await applyCreate(userId, operation, aiQuota);
      synced.push({ localId: operation.localId, serverId: record.id, transaction: record });
      touched.add(record.id);
    } else {
      // Se vuelve a leer: una operación anterior del lote pudo cambiarla.
      const latest = await repo.findForSync(operation.serverId, userId);
      const result = await applyChange(userId, operation, latest, lastSyncedAt, touched);
      if (result.synced) synced.push(result.synced);
      if (result.conflict) conflicts.push(result.conflict);
      if (result.touched) touched.add(result.touched);
    }
  }

  // Fase 3: lo que cambió en el servidor (otros dispositivos), sin lo de este lote.
  const syncedAt = await repo.getServerTime();
  const serverChanges = await repo.listChangedSince(userId, lastSyncedAt, [...touched]);
  return { synced, conflicts, serverChanges, syncedAt };
}
