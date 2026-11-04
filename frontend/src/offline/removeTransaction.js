import { queueDelete, uncacheTransaction } from './sync';
import { deleteTransaction } from '@/services/transactionService';

/**
 * Elimina un movimiento: en el servidor si hay conexión o, sin ella, en la cola para sincronizarlo
 * después (FT-0009). Lo usan Movimientos y el detalle del movimiento, así los dos eliminan igual.
 * @param {import('@/services/transactionService').Transaction} transaction
 * @returns {Promise<{ offline: boolean }>}
 * @throws {Error} Si el servidor rechaza la eliminación.
 */
export async function removeTransaction(transaction) {
  let offline = !navigator.onLine;
  if (!offline) {
    try {
      await deleteTransaction(transaction.id);
    } catch (err) {
      if (err.code !== 'NETWORK_ERROR') throw err;
      offline = true;
    }
  }
  if (offline) await queueDelete(transaction);
  else uncacheTransaction(transaction.id).catch(() => {});
  return { offline };
}
