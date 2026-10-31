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
import { clearVacaCache, flushContributions } from './vacaQueue';
import { apiRequest } from '@/lib/apiRequest';
import { getSession } from '@/auth/tokenStorage';

/**
 * Evento en `window`: `detail` es `{ pending, syncing, synced?, rejected?, conflicts? }`.
 * `conflicts` trae lo que resolvió el servidor (`server_wins`/`client_wins`, con `serverVersion`).
 */
export const SYNC_EVENT = 'fintrack:sync';

/** Etiqueta de Background Sync; el service worker la recibe en `public/push-sw.js`. */
export const SYNC_TAG = 'fintrack-sync';

/** Nombre legible de los campos que puede señalar un 422, para el motivo del rechazo. */
const FIELD_LABELS = {
  amount: 'Monto',
  description: 'Descripción',
  type: 'Tipo',
  date: 'Fecha',
  category: 'Categoría',
  serverId: 'Movimiento',
  updatedAt: 'Hora del cambio',
};

/** Máximo de operaciones por lote que acepta el servidor (contrato). */
const MAX_BATCH = 200;

/** Envío en curso: si se pide otro a la vez, se comparte el mismo. */
let running = null;
/** `localId` de las operaciones del lote que se está enviando: no se modifican mientras tanto. */
const sending = new Set();

/** Esperas antes de reintentar si el envío falla con pendientes (servidor caído, 429…). */
const RETRY_DELAYS_MS = [5_000, 15_000, 60_000];
let retries = 0;
let retryTimer = null;

/** Programa otro intento; la espera crece hasta 1 minuto mientras siga fallando. */
function scheduleRetry() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(syncNow, RETRY_DELAYS_MS[Math.min(retries, RETRY_DELAYS_MS.length - 1)]);
  retries += 1;
}

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
  const pending = (await listPending()).filter((o) => !o.rejected).length;
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
 * @param {string} [localId] El que ya se usó en un `POST /transactions` que falló, para no duplicar.
 * @returns {Promise<import('./db').PendingOperation>}
 */
export async function queueCreate(values, localId = crypto.randomUUID()) {
  const userId = currentUserId();
  if (!userId) throw new Error('Tu sesión venció. Inicia sesión de nuevo.');

  const operation = {
    localId,
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
 * Guarda una edición hecha sin conexión y la aplica de una vez a la copia local.
 * Varias ediciones del mismo movimiento se juntan en una sola operación.
 * @param {import('./db').CachedTransaction} current Cómo está el movimiento ahora.
 * @param {object} changes Solo los campos que cambian.
 * @returns {Promise<void>}
 */
export async function queueUpdate(current, changes) {
  const userId = currentUserId();
  if (!userId) throw new Error('Tu sesión venció. Inicia sesión de nuevo.');

  // Sin categoría la IA la sugiere al sincronizar; mientras tanto se ve "Sin clasificar".
  const source = 'category' in changes ? (changes.category ? 'manual' : 'sin_clasificar') : current.source;
  const preview = { ...current, ...changes, source };
  const updatedAt = new Date().toISOString();
  // Se junta con una edición anterior solo si no se está enviando: si no, el servidor confirmaría
  // la versión vieja y se borraría de la cola con el cambio nuevo adentro.
  const earlier = (await listPending()).find(
    (o) => o.op === 'update' && o.serverId === current.id && !o.rejected && !sending.has(o.localId),
  );

  await db.transaction('rw', db.pending, db.transactions, async () => {
    if (earlier) {
      await db.pending.update(earlier.localId, {
        transaction: { ...earlier.transaction, ...changes },
        updatedAt,
        preview,
      });
    } else {
      await db.pending.add({
        localId: crypto.randomUUID(),
        userId,
        op: 'update',
        serverId: current.id,
        transaction: changes,
        updatedAt,
        preview,
        original: current,
        createdAt: updatedAt,
      });
    }
    await db.transactions.put({ ...preview, userId });
  });
  await announce();
  requestBackgroundSync();
}

/**
 * Guarda una eliminación hecha sin conexión y quita el movimiento de la copia local.
 * Si había una edición pendiente de ese movimiento, ya no hace falta enviarla.
 * @param {import('./db').CachedTransaction} current
 * @returns {Promise<void>}
 */
export async function queueDelete(current) {
  const userId = currentUserId();
  if (!userId) throw new Error('Tu sesión venció. Inicia sesión de nuevo.');

  const updatedAt = new Date().toISOString();
  const edits = (await listPending()).filter((o) => o.op === 'update' && o.serverId === current.id);
  await db.transaction('rw', db.pending, db.transactions, async () => {
    await db.pending.bulkDelete(edits.map((o) => o.localId));
    await db.pending.add({
      localId: crypto.randomUUID(),
      userId,
      op: 'delete',
      serverId: current.id,
      updatedAt,
      preview: current,
      original: edits[0]?.original ?? current,
      createdAt: updatedAt,
    });
    await db.transactions.delete(current.id);
  });
  await announce();
  requestBackgroundSync();
}

/**
 * Envía la cola al servidor y trae lo que cambió allá. Sin conexión o sin sesión no hace nada.
 * @returns {Promise<void>}
 */
export function syncNow() {
  // `navigator.locks`: con varias pestañas abiertas, envían por turnos y no el mismo lote a la vez.
  running ??= (navigator.locks ? navigator.locks.request('fintrack-sync', doSync) : doSync())
    .catch((err) => console.error('No se pudo sincronizar', err)) // p. ej. IndexedDB no disponible
    .finally(() => {
      running = null;
      announce().catch(() => {});
    });
  return running;
}

/**
 * Conflictos de sincronización que el usuario todavía no ha visto, del más antiguo al más reciente.
 * Cada uno trae `op`, `name`, `resolution` y `serverVersion` para armar el mensaje (`conflictMessage`).
 * @returns {Promise<Array<import('./conflictMessage').SyncConflict & { localId: string, serverId: string, at: string }>>}
 */
export async function listConflicts() {
  const userId = currentUserId();
  if (!userId) return [];
  return (await db.meta.get(`conflicts:${userId}`))?.value ?? [];
}

/**
 * Marca avisos de conflicto como vistos. Sin `localIds` descarta todos los del usuario.
 * @param {string[]} [localIds]
 * @returns {Promise<void>}
 */
export async function dismissConflicts(localIds) {
  const userId = currentUserId();
  if (!userId) return;
  const key = `conflicts:${userId}`;
  await db.transaction('rw', db.meta, async () => {
    const earlier = (await db.meta.get(key))?.value ?? [];
    const left = localIds ? earlier.filter((c) => !localIds.includes(c.localId)) : [];
    if (left.length > 0) await db.meta.put({ key, value: left });
    else await db.meta.delete(key);
  });
  await announce();
}

/**
 * Descarta un movimiento que el servidor rechazó (el usuario decide).
 * @param {string} localId
 * @returns {Promise<void>}
 */
export async function discardPending(localId) {
  const op = await db.pending.get(localId);
  await db.transaction('rw', db.pending, db.transactions, async () => {
    await db.pending.delete(localId);
    // Edición o borrado rechazado: la copia local vuelve a como estaba antes del cambio.
    if (op?.original) await db.transactions.put({ ...op.original, userId: op.userId });
  });
  await announce();
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
  if (userId && !transaction.deletedAt) await db.transactions.put({ ...transaction, userId });
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
  await clearVacaCache(userId);
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
  const queue = (await listPending()).filter((o) => !o.rejected).slice(0, MAX_BATCH);
  if (queue.length > 0) await announce();

  const metaKey = `lastSyncedAt:${userId}`;
  const lastSyncedAt = (await db.meta.get(metaKey))?.value ?? null;
  queue.forEach((o) => sending.add(o.localId));
  try {
    await sendBatch(userId, queue, metaKey, lastSyncedAt);
  } finally {
    sending.clear();
  }
  // Después del lote: los aportes a vacas hechos sin conexión (FT-0014) van por su propia ruta.
  await flushContributions();
}

/** Envía un lote a `/sync/batch` y aplica la respuesta a la cola y a la copia local. */
async function sendBatch(userId, queue, metaKey, lastSyncedAt) {
  let result;
  try {
    result = await apiRequest('/sync/batch', {
      method: 'POST',
      body: {
        lastSyncedAt,
        operations: queue.map(({ op, localId, transaction, serverId, updatedAt }) => ({
          op,
          localId,
          ...(transaction && { transaction }),
          ...(serverId && { serverId, updatedAt }),
        })),
      },
    });
  } catch (err) {
    // 422: el lote se rechaza completo. Nada se borra: se arregla o se aparta lo inválido y se reenvía.
    if (err.code === 'VALIDATION_ERROR' && err.fields) {
      retries = 0; // el servidor respondió: no es una caída
      if ('lastSyncedAt' in err.fields) {
        await db.meta.delete(metaKey); // valor dañado: se vuelve a pedir todo el historial
        return doSync();
      }
      const rejected = [];
      let changed = 0;
      for (const [i, problems] of rejectedOperations(err.fields)) {
        const op = queue[i];
        if (!op) continue;
        const onlyCategory = problems.every(([field]) => field.endsWith('.transaction.category'));
        if (onlyCategory && op.transaction.category) {
          // Catálogo guardado desactualizado: se envía sin categoría y la IA la sugiere.
          await db.pending.update(op.localId, { transaction: { ...op.transaction, category: null } });
        } else {
          const [field, problem] = problems[0];
          const label = FIELD_LABELS[field.split('.').pop()] ?? field;
          await db.pending.update(op.localId, { rejected: `${label}: ${problem}` });
          rejected.push(op);
        }
        changed += 1;
      }
      if (rejected.length > 0) await announce({ rejected });
      // Solo se reintenta si algo cambió: si no, el mismo lote volvería a fallar sin fin.
      return changed > 0 ? doSync() : undefined;
    }
    // Sin red, servidor caído o 429: la cola se conserva y se reintenta sola.
    if (queue.length > 0) scheduleRetry();
    return;
  }
  retries = 0;
  clearTimeout(retryTimer);

  // Con conflicto el servidor ya decidió (last-write-wins): esas operaciones también salen de la cola.
  const confirmed = [...result.synced, ...result.conflicts].map((s) => s.localId);
  // Lo de este lote no vuelve en `serverChanges`: se toma de `synced[].transaction` (create y update)
  // y de `conflicts[].serverVersion` (la versión que quedó en el servidor).
  const changes = [
    ...result.synced.map((s) => s.transaction).filter(Boolean),
    ...result.conflicts.map((c) => c.serverVersion).filter(Boolean),
    ...result.serverChanges,
  ];
  // Borradas: los conflictos sin versión (ya no existen) y lo que llega con `deletedAt`.
  // (Un `delete` propio ya se quitó de la copia en `queueDelete`.)
  const gone = [
    ...result.conflicts.filter((c) => !c.serverVersion).map((c) => c.serverId),
    ...changes.filter((t) => t.deletedAt).map((t) => t.id),
  ];
  // Para avisarle al usuario hace falta saber qué había hecho (editar o eliminar) y de qué movimiento:
  // el servidor no lo repite, pero la cola todavía lo tiene (se borra en la transacción de abajo).
  const sentAt = new Date().toISOString();
  const sent = new Map(queue.map((o) => [o.localId, o]));
  const conflicts = result.conflicts.map((c) => {
    const o = sent.get(c.localId);
    return {
      ...c,
      op: o?.op ?? 'update',
      name: o?.original?.description ?? o?.preview?.description ?? c.serverVersion?.description,
      at: sentAt,
    };
  });
  await db.transaction('rw', db.pending, db.meta, db.transactions, async () => {
    await db.pending.bulkDelete(confirmed);
    await db.transactions.bulkPut(
      changes.filter((t) => !t.deletedAt).map((t) => ({ ...t, userId })),
    );
    await db.transactions.bulkDelete(gone);
    await db.meta.put({ key: metaKey, value: result.syncedAt });
    // Los avisos se guardan en el dispositivo hasta que el usuario los descarte: el evento se dispara
    // una sola vez y puede llegar cuando no hay ninguna pantalla que lo escuche.
    if (conflicts.length > 0) {
      const key = `conflicts:${userId}`;
      const earlier = (await db.meta.get(key))?.value ?? [];
      const ids = new Set(conflicts.map((c) => c.localId));
      await db.meta.put({ key, value: [...earlier.filter((c) => !ids.has(c.localId)), ...conflicts] });
    }
  });
  if (confirmed.length > 0) {
    await announce({ synced: result.synced, ...(conflicts.length && { conflicts }) });
  }

  // Si había más de un lote, se envía el siguiente.
  if (queue.length === MAX_BATCH) return doSync();
}

/**
 * Problemas del 422 agrupados por operación
 * (`operations[3].transaction.amount` → 3 → [[campo, problema], …]).
 * @param {Record<string, string>} fields
 * @returns {Map<number, Array<[string, string]>>}
 */
function rejectedOperations(fields) {
  const byIndex = new Map();
  for (const [field, problem] of Object.entries(fields)) {
    const i = /^operations\[(\d+)\]/.exec(field)?.[1];
    if (i === undefined) continue;
    byIndex.set(Number(i), [...(byIndex.get(Number(i)) ?? []), [field, problem]]);
  }
  return byIndex;
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
