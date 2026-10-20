/**
 * Base de datos local del dispositivo (IndexedDB, con Dexie). FT-0009.
 *
 * - `pending`: operaciones hechas sin conexión que esperan enviarse a `POST /sync/batch`.
 *   Cada una guarda el `userId` de la sesión con que se hizo, para no enviarla con otra cuenta.
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

export const db = new Dexie('fintrack');

// `localId` es la llave; `userId` y `createdAt` son índices para filtrar y ordenar.
db.version(1).stores({
  pending: 'localId, userId, createdAt',
  meta: 'key',
});
