/**
 * Aportes a vacas sin conexión y copia local de las vacas (FT-0014).
 *
 * Flujo: `saveContribution` intenta enviar el aporte; si no hay red (o el servidor no responde)
 * lo guarda en `db.vacaPending` con un `localId`. `flushContributions` los envía uno por uno a
 * `POST /vacas/:id/contributions` cuando vuelve la conexión (lo llama `syncNow` y la pantalla de
 * la vaca). Reenviar el mismo `localId` no duplica ni el aporte ni el gasto que deja.
 *
 * Si el servidor rechaza un aporte (la vaca ya no existe, ya no eres miembro, datos inválidos),
 * queda marcado con el motivo para que el usuario lo descarte; nunca se borra solo.
 *
 * Cada cambio se anuncia en `window` con `VACA_SYNC_EVENT` para que la pantalla se actualice.
 */
import { db } from './db';
import { getSession } from '@/auth/tokenStorage';
import { contribute } from '@/services/vacaService';

/**
 * Evento en `window`: `detail` es `{ vacaId?, synced?, rejected?, fromQueue? }`. `fromQueue`: el
 * aporte enviado estaba en la cola del dispositivo (se hizo sin conexión).
 */
export const VACA_SYNC_EVENT = 'fintrack:vaca-sync';

/** Códigos de error que no se arreglan reintentando: el aporte queda rechazado. */
const PERMANENT_CODES = ['VALIDATION_ERROR', 'NOT_FOUND', 'FORBIDDEN'];

/** Envío en curso: si se pide otro a la vez, se comparte el mismo. */
let running = null;

function currentUserId() {
  return getSession()?.user?.id ?? null;
}

function announce(detail = {}) {
  window.dispatchEvent(new CustomEvent(VACA_SYNC_EVENT, { detail }));
}

/**
 * Pide al navegador que avise al service worker cuando vuelva la conexión (Background Sync);
 * el aviso llega a `syncNow`, que también envía estos aportes.
 */
async function requestBackgroundSync() {
  try {
    const registration = await navigator.serviceWorker?.ready;
    await registration?.sync?.register('fintrack-sync');
  } catch {
    // Sin service worker o sin permiso: se envía con el evento `online`.
  }
}

/**
 * Guarda en el dispositivo el resultado de un aporte confirmado: el gasto que dejó (para verlo
 * en Movimientos sin conexión) y la vaca actualizada.
 * @param {string} userId
 * @param {{ transaction?: object|null, vaca?: object }} result
 * @returns {Promise<void>}
 */
async function cacheResult(userId, { transaction, vaca }) {
  if (transaction && !transaction.deletedAt) await db.transactions.put({ ...transaction, userId });
  if (vaca) await db.meta.put({ key: `vaca:${userId}:${vaca.id}`, value: vaca });
}

/**
 * Registra un aporte: lo envía si hay conexión y, si no, lo deja en la cola del dispositivo.
 * @param {string} vacaId
 * @param {{ amount: number, date: string, note?: string|null, category?: string|null }} values
 * @returns {Promise<{ queued: true } | { queued: false, result: { contribution: object, transaction: object, vaca: object } }>}
 * @throws {Error} Si el servidor lo rechaza (p. ej. 422): no se encola, el usuario lo corrige.
 */
export async function saveContribution(vacaId, values) {
  const userId = currentUserId();
  if (!userId) throw new Error('Tu sesión venció. Inicia sesión de nuevo.');
  const localId = crypto.randomUUID();

  if (navigator.onLine) {
    try {
      const result = await contribute(vacaId, { ...values, localId });
      await cacheResult(userId, result);
      announce({ vacaId, synced: 1 });
      return { queued: false, result };
    } catch (err) {
      // Con `code` respondió el servidor: es un error de los datos o de permisos.
      if (err.code && err.code !== 'RATE_LIMITED' && err.code !== 'INTERNAL_ERROR') throw err;
    }
  }

  await db.vacaPending.add({
    localId,
    userId,
    vacaId,
    contribution: { ...values, note: values.note ?? null, category: values.category ?? null },
    createdAt: new Date().toISOString(),
  });
  announce({ vacaId });
  requestBackgroundSync();
  return { queued: true };
}

/**
 * Aportes pendientes del usuario actual (todos o los de una vaca), del más antiguo al más nuevo.
 * @param {string} [vacaId]
 * @returns {Promise<Array<{ localId: string, vacaId: string, contribution: object, createdAt: string, rejected?: string }>>}
 */
export async function listPendingContributions(vacaId) {
  const userId = currentUserId();
  if (!userId) return [];
  const all = await db.vacaPending.where('userId').equals(userId).sortBy('createdAt');
  return vacaId ? all.filter((p) => p.vacaId === vacaId) : all;
}

/**
 * Descarta un aporte pendiente (el usuario decide, p. ej. tras un rechazo).
 * @param {string} localId
 * @returns {Promise<void>}
 */
export async function discardPendingContribution(localId) {
  const pending = await db.vacaPending.get(localId);
  await db.vacaPending.delete(localId);
  announce({ vacaId: pending?.vacaId });
}

async function doFlush() {
  const userId = currentUserId();
  if (!userId || !navigator.onLine) return;
  const queue = (await listPendingContributions()).filter((p) => !p.rejected);
  for (const pending of queue) {
    try {
      const result = await contribute(pending.vacaId, { ...pending.contribution, localId: pending.localId });
      await db.vacaPending.delete(pending.localId);
      await cacheResult(userId, result);
      announce({ vacaId: pending.vacaId, synced: 1, fromQueue: true });
    } catch (err) {
      if (!PERMANENT_CODES.includes(err.code)) return; // sin red, servidor caído o 429: después
      await db.vacaPending.update(pending.localId, { rejected: err.message });
      announce({ vacaId: pending.vacaId, rejected: 1 });
    }
  }
}

/**
 * Envía los aportes pendientes. Sin conexión o sin sesión no hace nada.
 * @returns {Promise<void>}
 */
export function flushContributions() {
  running ??= doFlush()
    .catch((err) => console.error('No se pudieron enviar los aportes', err))
    .finally(() => {
      running = null;
    });
  return running;
}

/**
 * Guarda la lista de vacas para verla sin conexión.
 * @param {object[]} vacas
 * @returns {Promise<void>}
 */
export async function cacheVacaList(vacas) {
  const userId = currentUserId();
  if (userId) await db.meta.put({ key: `vacas:${userId}`, value: vacas });
}

/**
 * Lista de vacas guardada en el dispositivo, o `null` si nunca se cargó.
 * @returns {Promise<object[]|null>}
 */
export async function getCachedVacaList() {
  const userId = currentUserId();
  if (!userId) return null;
  return (await db.meta.get(`vacas:${userId}`))?.value ?? null;
}

/**
 * Guarda el detalle de una vaca para verlo sin conexión.
 * @param {object} vaca
 * @returns {Promise<void>}
 */
export async function cacheVaca(vaca) {
  const userId = currentUserId();
  if (userId) await db.meta.put({ key: `vaca:${userId}:${vaca.id}`, value: vaca });
}

/**
 * Detalle guardado de una vaca, o `null`.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getCachedVaca(id) {
  const userId = currentUserId();
  if (!userId) return null;
  return (await db.meta.get(`vaca:${userId}:${id}`))?.value ?? null;
}

/**
 * Quita la copia de una vaca que se eliminó o que el usuario dejó.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function uncacheVaca(id) {
  const userId = currentUserId();
  if (userId) await db.meta.delete(`vaca:${userId}:${id}`);
}

/**
 * Borra la copia de las vacas de un usuario al cerrar sesión. Los aportes pendientes se
 * conservan: se envían cuando ese usuario vuelva a entrar.
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function clearVacaCache(userId) {
  await db.meta.where('key').startsWith(`vaca:${userId}:`).delete();
  await db.meta.delete(`vacas:${userId}`);
}
