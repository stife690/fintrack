import { pool } from '../config/db.js';
import { AppError } from '../errors/app-error.js';
import * as repo from '../repositories/debts.repository.js';
import { insertTransaction } from '../repositories/transactions.repository.js';
import { findUserById } from '../repositories/users.repository.js';
import { todayIso } from './insights.service.js';

// Cuentas personales por cobrar y por pagar (FT-0046). Son una lista para recordar: no tocan
// Mi plata. Solo al saldarlas, si el usuario quiere, se crea el ingreso o el gasto.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => new AppError(404, 'NOT_FOUND', 'Cuenta no encontrada');
const alreadySettled = () => new AppError(409, 'ALREADY_SETTLED', 'Esta cuenta ya está saldada');

/**
 * El movimiento que se crea al saldar: cobrar es un ingreso; pagar, un gasto. Van en "Otros"
 * porque no se sabe en qué era el préstamo; el usuario puede cambiar la categoría después.
 * @param {{ kind: 'receivable'|'payable', person: string }} debt
 * @returns {{ type: 'ingreso'|'gasto', category: string, description: string }}
 */
export function settlementMovement({ kind, person }) {
  return kind === 'receivable'
    ? { type: 'ingreso', category: 'otros_ingresos', description: `${person} me pagó` }
    : { type: 'gasto', category: 'otros', description: `Le pagué a ${person}` };
}

/**
 * Suma lo pendiente de cada lado (lo saldado no cuenta).
 * @param {import('../repositories/debts.repository.js').DebtRecord[]} items
 * @returns {{ receivable: number, payable: number }}
 */
export function pendingTotals(items) {
  const totals = { receivable: 0, payable: 0 };
  for (const d of items) if (!d.settledAt) totals[d.kind] += d.amount;
  totals.receivable = Math.round(totals.receivable * 100) / 100;
  totals.payable = Math.round(totals.payable * 100) / 100;
  return totals;
}

/**
 * @param {string} userId
 * @returns {Promise<{ items: object[], totals: { receivable: number, payable: number } }>}
 */
export async function list(userId) {
  const items = await repo.listDebts(userId);
  return { items, totals: pendingTotals(items) };
}

/**
 * @param {string} userId
 * @param {ReturnType<import('../validators/debts.validator.js').parseNewDebt>} input
 * @returns {Promise<object>}
 */
export async function create(userId, input) {
  return repo.insertDebt({ userId, ...input });
}

/**
 * Edita una cuenta pendiente; una saldada ya no se edita (409).
 * @param {string} userId
 * @param {string} id
 * @param {object} changes
 * @returns {Promise<object>}
 */
export async function update(userId, id, changes) {
  if (!UUID_RE.test(id)) throw notFound();
  const updated = await repo.updateDebt(id, userId, changes);
  if (updated) return updated;
  throw (await repo.findDebt(id, userId)) ? alreadySettled() : notFound();
}

/**
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function remove(userId, id) {
  if (!UUID_RE.test(id) || !(await repo.deleteDebt(id, userId))) throw notFound();
}

/**
 * Salda la cuenta. Si `createTransaction`, crea el ingreso o el gasto en la misma transacción SQL,
 * así nunca queda saldada sin su movimiento ni con dos movimientos si se toca dos veces.
 * @param {string} userId
 * @param {string} id
 * @param {{ createTransaction: boolean, date?: string }} input
 * @returns {Promise<{ debt: object, transaction: object|null }>}
 */
export async function settle(userId, id, input) {
  const debt = UUID_RE.test(id) && (await repo.findDebt(id, userId));
  if (!debt) throw notFound();
  if (debt.settledAt) throw alreadySettled();
  const user = await findUserById(userId);
  const today = todayIso(new Date(), user?.timezone);
  if (input.date && input.date > today) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'date', problem: 'No puede ser una fecha futura' },
    ]);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const transaction = input.createTransaction
      ? await insertTransaction(
          {
            userId,
            amount: debt.amount,
            date: input.date ?? today,
            source: 'manual',
            ...settlementMovement(debt),
          },
          client,
        )
      : null;
    const settled = await repo.markSettled(
      { id, userId, transactionId: transaction?.id ?? null },
      client,
    );
    if (!settled) throw alreadySettled(); // otra petición la saldó mientras tanto
    await client.query('COMMIT');
    return { debt: settled, transaction };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
