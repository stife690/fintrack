/**
 * Base de datos local del dispositivo (IndexedDB, con Dexie). FT-0009.
 *
 * - `pending`: operaciones hechas sin conexión que esperan enviarse a `POST /sync/batch`.
 *   Cada una guarda el `userId` de la sesión con que se hizo, para no enviarla con otra cuenta.
 * - `transactions`: copia del historial de cada usuario, para verlo sin conexión. Se llena con
 *   `serverChanges` de `/sync/batch` (la primera vez, todo el historial; después, solo lo que cambió).
 * - `vacaPending`: aportes a vacas hechos sin conexión (FT-0014); ver `vacaQueue.js`.
 * - `meta`: datos sueltos por llave: `lastSyncedAt:<userId>`, `conflicts:<userId>` (avisos de conflicto
 *   que el usuario aún no ha visto) y la copia del catálogo `categories`.
 */
import Dexie from 'dexie';

/**
 * @typedef {object} PendingOperation
 * @property {string} localId Id generado en el dispositivo; el servidor lo usa para no duplicar.
 * @property {string} userId Dueño de la operación.
 * @property {'create'|'update'|'delete'} op
 * @property {object} [transaction] En `create`, la transacción completa; en `update`, solo los
 *   campos que cambian; no va en `delete`.
 * @property {string} [serverId] Solo en `update` y `delete`: id de la transacción en el servidor.
 * @property {string} [updatedAt] Solo en `update` y `delete`: hora del cambio en el dispositivo
 *   (el servidor la compara con la suya: last-write-wins).
 * @property {object} [preview] Solo en `update` y `delete`: cómo queda la transacción, para mostrarla.
 * @property {object} [original] Solo en `update` y `delete`: cómo estaba antes, para restaurar la
 *   copia local si el servidor rechaza el cambio y el usuario lo descarta.
 * @property {string} createdAt Hora del dispositivo en que se registró (ISO 8601).
 * @property {string} [rejected] Motivo si el servidor la rechazó (422): ya no se envía y se le
 *   muestra al usuario para que la descarte o la vuelva a registrar.
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

// v3 (FT-0014, La Vaca Inteligente): aportes a vacas hechos sin conexión. Van aparte de `pending`
// porque se envían a `POST /vacas/:id/contributions`, no a `/sync/batch`. La copia de las vacas
// para verlas sin conexión vive en `meta` (`vacas:<userId>` y `vaca:<userId>:<id>`).
db.version(3).stores({ vacaPending: 'localId, userId, vacaId, createdAt' });
