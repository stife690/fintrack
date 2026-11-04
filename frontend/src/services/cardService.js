/** Tarjetas de crédito: llama a `/api/v1/cards`. */
import { apiRequest } from '@/lib/apiRequest';
import { cacheCardList, getCachedCardList } from '@/offline/cardCache';

/**
 * Tarjetas del usuario. Guarda copia local; sin red devuelve la última copia.
 * @returns {Promise<object[]>}
 */
export async function listCards() {
  try {
    const cards = await apiRequest('/cards');
    await cacheCardList(cards);
    return cards;
  } catch (err) {
    if (err.code !== 'NETWORK_ERROR') throw err;
    const cached = await getCachedCardList();
    if (cached) return cached;
    throw err;
  }
}

export const getCard = (id) => apiRequest(`/cards/${id}`);
export const createCard = (data) => apiRequest('/cards', { method: 'POST', body: data });
export const updateCard = (id, data) => apiRequest(`/cards/${id}`, { method: 'PUT', body: data });
export const deleteCard = (id) => apiRequest(`/cards/${id}`, { method: 'DELETE' });

/** Registra un pago. @returns {Promise<{ payment: object, card: object }>} */
export const payCard = (id, { amount, date }) =>
  apiRequest(`/cards/${id}/payments`, { method: 'POST', body: { amount, date } });

/** Borra un pago (deshace "Ya pagué"). */
export const deleteCardPayment = (id, paymentId) =>
  apiRequest(`/cards/${id}/payments/${paymentId}`, { method: 'DELETE' });

/** Ajusta con el banco. @returns {Promise<{ card: object, chargeTransaction: object|null }>} */
export const syncCardWithBank = (id, data) =>
  apiRequest(`/cards/${id}/sync-with-bank`, { method: 'POST', body: data });

/** Compras, pagos y ajustes de la tarjeta. */
export const getCardMovements = (id) => apiRequest(`/cards/${id}/movements`);
