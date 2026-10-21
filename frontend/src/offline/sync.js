/**
 * Cola de movimientos registrados sin conexión y su envío a `POST /sync/batch`. FT-0009.
 *
 * Flujo: `queueCreate` guarda el movimiento en IndexedDB → al volver la conexión `syncNow`
 * envía la cola en un lote → lo que el servidor confirma en `synced` se borra de la cola.
 * Si la respuesta se pierde, reenviar el mismo `localId` no duplica (el servidor lo reconoce).
 *
 * `syncNow` también trae lo que cambió en el servidor (`serverChanges`) aunque no haya pendientes,
 * y lo guarda en la copia local del historial (`db.transactions`) para poder verlo sin conexión.
 *
 * Cada cambio se anuncia en `window` con `SYNC_EVENT` para que la interfaz se actualice.
 */
import { db } from './db';
import { apiRequest } from '@/lib/apiRequest';
import { getSession } from '@/auth/tokenStorage';

/** Evento en `window`: `detail` es `{ pending, syncing, synced?, rejected? }`. */
export const SYNC_EVENT = 'fintrack:sync';

/** Etiqueta de Background Sync; el service worker la recibe en `public/push-sw.js`. */
export const SYNC_TAG = 'fintrack-sync';

/** Máximo de operaciones por lote que acepta el servidor (contrato). */
const MAX_BATCH = 200;

/** Envío en curso: si se pide otro a la vez, se comparte el mismo. */
let running = null;

function currentUserId() {
  return getSession()?.user?.id ?? null;
}

/**
 * Movimientos pendientes del usuario actual, del más antiguo al más reciente.
 * @returns {Promise<import('./db').PendingOperation[]>}
 */
export async function listPending() {
  const userId = currentUserId();
  if (!userId) return [];
  return db.pending.where('userId').equals(userId).sortBy('createdAt');
}

async function announce(extra = {}) {
  const pending = (await listPending()).length;
  window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { pending, syncing: Boolean(running), ...extra } }));
}

/**
 * Pide al navegador que avise al service worker cuando haya conexión (Background Sync).
 * Solo existe en navegadores basados en Chromium; en los demás basta el evento `online`.
 */
async function requestBackgroundSync() {
  try {
    const registration = await navigator.serviceWorker?.ready;
    await registration?.sync?.register(SYNC_TAG);
  } catch {
    // Sin service worker o sin permiso: la sincronización igual ocurre con el evento `online`.
  }
}

/**
 * Guarda en el dispositivo un movimiento registrado sin conexión.
 * @param {{ amount: number, description: string, type: string, date: string, category?: string|null }} values
 * @returns {Promise<import('./db').PendingOperation>}
 */
export async function queueCreate(values) {
  const userId = currentUserId();
  if (!userId) throw new Error('Tu sesión venció. Inicia sesión de nuevo.');

  const operation = {
    localId: crypto.randomUUID(),
    userId,
    op: 'create',
    transaction: { ...values, category: values.category ?? null },
    createdAt: new Date().toISOString(),
  };
  await db.pending.add(operation);
  await announce();
  requestBackgroundSync();
  return operation;
}

/**
 * Envía la cola al servidor y trae lo que cambió allá. Sin conexión o sin sesión no hace nada.
 * @returns {Promise<void>}
 */
export function syncNow() {
  running ??= doSync().finally(() => {
    running = null;
    announce();
  });
  return running;
}

/**
 * Guarda en la copia local una transacción que el servidor acaba de devolver (crear o editar con
 * conexión), sin pedir otra sincronización: `/sync/batch` comparte el límite de 30 peticiones
 * por minuto con crear y editar.
 * @param {import('./db').CachedTransaction} transaction
 * @returns {Promise<void>}
 */
export async function cacheTransaction(transaction) {
  const userId = currentUserId();
  if (userId) await db.transactions.put({ ...transaction, userId });
}

/**
 * Borra la copia del historial de un usuario al cerrar sesión, para no dejar sus datos en un
 * dispositivo compartido. La cola `pending` se conserva: son movimientos que aún no llegan al
 * servidor y se envían cuando ese usuario vuelva a entrar.
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function clearCachedHistory(userId) {
  await db.transactions.where('userId').equals(userId).delete();
  await db.meta.delete(`lastSyncedAt:${userId}`);
}

/**
 * Quita de la copia local una transacción eliminada con conexión.
 * @param {string} id
 * @returns {Promise<void>}
 */
export function uncacheTransaction(id) {
  return db.transactions.delete(id);
}

async function doSync() {
  const userId = currentUserId();
  if (!userId || !navigator.onLine) return;

  // Sin pendientes se envía un lote vacío: sirve para traer los cambios del servidor.
  const queue = (await listPending()).slice(0, MAX_BATCH);
  if (queue.length > 0) await announce();

  const metaKey = `lastSyncedAt:${userId}`;
  const lastSyncedAt = (await db.meta.get(metaKey))?.value ?? null;

  let result;
  try {
    result = await apiRequest('/sync/batch', {
      method: 'POST',
      body: {
        lastSyncedAt,
        operations: queue.map(({ op, localId, transaction }) => ({ op, localId, transaction })),
      },
    });
  } catch (err) {
    // 422: el lote se rechaza completo; se quitan las operaciones inválidas para que el resto pase.
    if (err.code === 'VALIDATION_ERROR' && err.fields) {
      const invalid = rejectedIndexes(err.fields).map((i) => queue[i]).filter(Boolean);
      if (invalid.length > 0) {
        await db.pending.bulkDelete(invalid.map((o) => o.localId));
        await announce({ rejected: invalid });
        return doSync();
      }
    }
    // Sin red o servidor caído: la cola se conserva y se reintenta en la próxima conexión.
    return;
  }

  const confirmed = result.synced.map((s) => s.localId);
  // Lo creado en este lote no vuelve en `serverChanges`: se toma de `synced[].transaction`.
  const created = result.synced.map((s) => s.transaction).filter(Boolean);
  const changes = [...created, ...result.serverChanges];
  await db.transaction('rw', db.pending, db.meta, db.transactions, async () => {
    await db.pending.bulkDelete(confirmed);
    await db.transactions.bulkPut(
      changes.filter((t) => !t.deletedAt).map((t) => ({ ...t, userId })),
    );
    await db.transactions.bulkDelete(changes.filter((t) => t.deletedAt).map((t) => t.id));
    await db.meta.put({ key: metaKey, value: result.syncedAt });
  });
  if (confirmed.length > 0) await announce({ synced: result.synced });

  // Si había más de un lote, se envía el siguiente.
  if (queue.length === MAX_BATCH) return doSync();
}

/**
 * Posiciones de las operaciones con problemas, según los campos del 422
 * (`operations[3].transaction.amount` → 3).
 * @param {Record<string, string>} fields
 * @returns {number[]}
 */
function rejectedIndexes(fields) {
  const indexes = Object.keys(fields)
    .map((field) => /^operations\[(\d+)\]/.exec(field)?.[1])
    .filter((i) => i !== undefined)
    .map(Number);
  return [...new Set(indexes)];
}

/**
 * Historial guardado en el dispositivo, con los mismos filtros, orden y paginación que
 * `GET /transactions`. Se usa cuando no hay conexión.
 * @param {{ type?: string, category?: string, q?: string, from?: string, to?: string, page?: number, pageSize?: number }} [filters]
 * @returns {Promise<{ data: import('./db').CachedTransaction[], page: number, pageSize: number, total: number, syncedAt: string|null }>}
 */
export async function listCached({ type, category, q, from, to, page = 1, pageSize = 20 } = {}) {
  const userId = currentUserId();
  if (!userId) return { data: [], page, pageSize, total: 0, syncedAt: null };

  const text = q?.toLowerCase();
  const rows = (await db.transactions.where('userId').equals(userId).toArray())
    .filter((t) => !type || t.type === type)
    .filter((t) => !category || t.category === category)
    .filter((t) => !text || t.description.toLowerCase().includes(text))
    .filter((t) => !from || t.date >= from)
    .filter((t) => !to || t.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const syncedAt = (await db.meta.get(`lastSyncedAt:${userId}`))?.value ?? null;
  return {
    data: rows.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: rows.length,
    syncedAt,
  };
}
