/**
 * Base de datos local del dispositivo (IndexedDB, con Dexie). FT-0009.
 *
 * - `pending`: operaciones hechas sin conexión que esperan enviarse a `POST /sync/batch`.
 *   Cada una guarda el `userId` de la sesión con que se hizo, para no enviarla con otra cuenta.
 * - `transactions`: copia del historial de cada usuario, para verlo sin conexión. Se llena con
 *   `serverChanges` de `/sync/batch` (la primera vez, todo el historial; después, solo lo que cambió).
 * - `meta`: datos sueltos por llave: `lastSyncedAt:<userId>` y la copia del catálogo `categories`.
 */
import Dexie from 'dexie';

/**
 * @typedef {object} PendingOperation
 * @property {string} localId Id generado en el dispositivo; el servidor lo usa para no duplicar.
 * @property {string} userId Dueño de la operación.
 * @property {'create'} op Por ahora solo se registran movimientos nuevos sin conexión.
 * @property {{ amount: number, description: string, type: string, date: string, category: string|null }} transaction
 * @property {string} createdAt Hora del dispositivo en que se registró (ISO 8601).
 */

/**
 * @typedef {import('@/services/transactionService').Transaction & { userId: string, createdAt: string, updatedAt: string }} CachedTransaction
 *   Transacción tal como la devuelve el servidor, guardada en el dispositivo.
 */

export const db = new Dexie('fintrack');

// `localId` es la llave; `userId` y `createdAt` son índices para filtrar y ordenar.
db.version(1).stores({
  pending: 'localId, userId, createdAt',
  meta: 'key',
});

// v2 (FT-0009, conflictos): agrega la copia del historial. Las tablas de v1 se conservan.
db.version(2)
  .stores({ transactions: 'id, userId' })
  // Quien ya sincronizó con v1 tiene `lastSyncedAt`: se borra para que la próxima vez llegue
  // todo el historial y no solo lo que cambió (la copia local nace vacía).
  .upgrade((tx) => tx.table('meta').where('key').startsWith('lastSyncedAt:').delete());
