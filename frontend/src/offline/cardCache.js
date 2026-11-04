/** Copia local de las tarjetas para verlas sin conexión (`db.meta`, clave `cards:<userId>`). */
import { db } from './db';
import { getSession } from '@/auth/tokenStorage';

const currentUserId = () => getSession()?.user?.id ?? null;

/** @param {object[]} cards */
export async function cacheCardList(cards) {
  const userId = currentUserId();
  if (userId) await db.meta.put({ key: `cards:${userId}`, value: cards });
}

/** @returns {Promise<object[]|null>} Tarjetas guardadas, o `null` si nunca se cargaron. */
export async function getCachedCardList() {
  const userId = currentUserId();
  if (!userId) return null;
  return (await db.meta.get(`cards:${userId}`))?.value ?? null;
}

/** Borra la copia al cerrar sesión. @param {string} userId */
export async function clearCardCache(userId) {
  await db.meta.delete(`cards:${userId}`);
}
