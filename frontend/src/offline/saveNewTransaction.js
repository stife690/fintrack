import { cacheTransaction, queueCreate } from './sync';
import { createTransaction } from '@/services/transactionService';

/**
 * Registra un movimiento nuevo: lo envía al servidor y, sin conexión, lo deja en la cola para
 * sincronizarlo después (FT-0009). Lo usan el formulario de Movimientos y el registro por voz
 * (FT-0013), así los dos guardan igual.
 *
 * El mismo `localId` en el envío directo y en la cola: si el POST llegó al servidor pero la
 * respuesta se perdió, al sincronizar el servidor lo reconoce y no lo duplica.
 *
 * @param {{ type: string, amount: number, description: string, date: string, category: string|null }} values
 * @returns {Promise<{ transaction: import('@/services/transactionService').Transaction|null, alert: import('@/services/transactionService').TransactionAlert|null, offline: boolean }>}
 *   Sin conexión `transaction` y `alert` son `null`: la categoría y la alerta las calcula el servidor.
 * @throws {Error} Si el servidor rechaza el movimiento (por ejemplo, un dato inválido).
 */
export async function saveNewTransaction(values) {
  const localId = crypto.randomUUID();
  let created;
  try {
    if (!navigator.onLine) throw Object.assign(new Error(), { code: 'NETWORK_ERROR' });
    created = await createTransaction({ ...values, localId });
  } catch (err) {
    if (err.code !== 'NETWORK_ERROR') throw err;
    await queueCreate(values, localId);
    return { transaction: null, alert: null, offline: true };
  }
  // La copia local es un respaldo: si falla, se corrige en la próxima sincronización.
  cacheTransaction(created.transaction).catch(() => {});
  return { transaction: created.transaction, alert: created.alert, offline: false };
}
