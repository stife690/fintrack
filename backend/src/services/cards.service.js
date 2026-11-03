import { pool } from '../config/db.js';
import { AppError } from '../errors/app-error.js';
import * as repo from '../repositories/cards.repository.js';
import { insertTransaction } from '../repositories/transactions.repository.js';
import { findUserById } from '../repositories/users.repository.js';
import { checkTier } from '../validators/cards.validator.js';
import { bankAdjustment, cardState } from './cards.logic.js';
import { todayIso } from './insights.service.js';

const LABELS = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'Amex',
  otra: 'Otra',
  clasica: 'Clásica',
  gold: 'Gold',
  platinum: 'Platinum',
  black: 'Black',
  green: 'Green',
  blue: 'Blue',
};

const notFound = () => new AppError(404, 'NOT_FOUND', 'Tarjeta no encontrada');

/**
 * Hoy en la zona horaria del usuario.
 * @param {string} userId
 * @returns {Promise<string>}
 */
async function todayOf(userId) {
  const user = await findUserById(userId);
  return todayIso(new Date(), user?.timezone);
}

/**
 * Arma la tarjeta de la respuesta con lo usado, disponible y próximo pago.
 * @param {import('../repositories/cards.repository.js').CardRecord} card
 * @param {string} today AAAA-MM-DD
 * @returns {Promise<object>}
 */
async function present(card, today) {
  const [purchases, payments] = await Promise.all([
    repo.purchasesSince(card.id, card.userId),
    repo.paymentsSince(card.id, card.userId),
  ]);
  const state = cardState({ card, purchases, payments, today });
  return {
    id: card.id,
    name: card.name,
    network: card.network,
    tier: card.tier,
    last4: card.last4,
    limit: card.limit,
    used: state.used,
    available: state.available,
    paymentDay: card.paymentDay,
    cutoffDay: card.cutoffDay,
    statementTotal: card.statementTotal,
    statementDueDate: card.statementDueDate,
    nextPaymentDate: state.nextPaymentDate,
    daysToPayment: state.daysToPayment,
    paidThisCycle: state.paidThisCycle,
    reminderSentFor: card.reminderSentFor,
  };
}

/**
 * Busca la tarjeta del usuario o lanza 404.
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<import('../repositories/cards.repository.js').CardRecord>}
 */
async function owned(id, userId) {
  const card = await repo.findCard(id, userId);
  if (!card) throw notFound();
  return card;
}

/**
 * Ejecuta `fn` y traduce el choque del índice único de últimos 4 en 409 `CARD_EXISTS`.
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function guardDuplicate(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'ux_tarjetas_usuario_ultimos4') {
      throw new AppError(409, 'CARD_EXISTS', 'Ya tienes una tarjeta con esos últimos 4 dígitos');
    }
    throw err;
  }
}

/**
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export async function list(userId) {
  const [cards, today] = await Promise.all([repo.listCards(userId), todayOf(userId)]);
  return Promise.all(cards.map((c) => present(c, today)));
}

/**
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function get(userId, id) {
  return present(await owned(id, userId), await todayOf(userId));
}

/**
 * Crea la tarjeta; la deuda base es lo usado hoy (cupo − disponible).
 * @param {string} userId
 * @param {ReturnType<import('../validators/cards.validator.js').parseNewCard>} input
 * @returns {Promise<object>}
 */
export async function create(userId, input) {
  const { available, ...data } = input;
  const card = await guardDuplicate(() =>
    repo.insertCard({
      ...data,
      userId,
      name: data.name ?? `${LABELS[data.network]} ${LABELS[data.tier]} ••${data.last4}`,
      debtBase: Math.round((data.limit - available) * 100) / 100,
    }),
  );
  return present(card, await todayOf(userId));
}

/**
 * Edita la tarjeta. Cambiar el cupo conserva `debtBase`, pero no puede quedar bajo lo usado.
 * @param {string} userId
 * @param {string} id
 * @param {object} changes
 * @returns {Promise<object>}
 */
export async function update(userId, id, changes) {
  const card = await owned(id, userId);
  const today = await todayOf(userId);
  const details = [];
  if (changes.network || changes.tier) {
    checkTier(changes.network ?? card.network, changes.tier ?? card.tier, details);
  }
  if (changes.limit !== undefined) {
    const { used } = await present(card, today);
    if (changes.limit < used) {
      details.push({ field: 'limit', problem: 'No puede ser menor que lo que ya usas' });
    }
  }
  if (details.length > 0) throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', details);
  const updated = await guardDuplicate(() => repo.updateCard(id, userId, changes));
  if (!updated) throw notFound();
  return present(updated, today);
}

/**
 * Borrado lógico; los gastos conservan su `tarjeta_id`.
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function remove(userId, id) {
  if (!(await repo.softDeleteCard(id, userId))) throw notFound();
}

/**
 * Registra un pago (hoy por defecto) y devuelve la tarjeta recalculada.
 * @param {string} userId
 * @param {string} id
 * @param {{ amount: number, date?: string }} input
 * @returns {Promise<{ payment: object, card: object }>}
 */
export async function pay(userId, id, input) {
  const card = await owned(id, userId);
  const today = await todayOf(userId);
  const payment = await repo.insertPayment({
    userId,
    cardId: id,
    amount: input.amount,
    date: input.date ?? today,
  });
  return { payment, card: await present(card, today) };
}

/**
 * Borra un pago.
 * @param {string} userId
 * @param {string} id
 * @param {string} paymentId
 * @returns {Promise<void>}
 */
export async function removePayment(userId, id, paymentId) {
  await owned(id, userId);
  if (!(await repo.softDeletePayment(paymentId, id, userId))) {
    throw new AppError(404, 'NOT_FOUND', 'Pago no encontrado');
  }
}

/**
 * Ajusta la tarjeta a lo que dice el banco. Si el banco cobra más, crea el gasto de cargos; el gasto,
 * el ajuste y la nueva base van en una sola transacción SQL, y la base es la hora de esa transacción
 * (`created_at` del gasto no es posterior; se pasa como texto para no perder los microsegundos), así que el gasto no se cuenta dos veces.
 * @param {string} userId
 * @param {string} id
 * @param {{ available: number, statementTotal?: number, statementDueDate?: string }} input
 * @returns {Promise<{ card: object, chargeTransaction: object|null }>}
 */
export async function syncWithBank(userId, id, input) {
  const card = await owned(id, userId);
  const today = await todayOf(userId);
  if (input.available > card.limit) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'available', problem: 'No puede ser mayor que el cupo' },
    ]);
  }
  const { used } = await present(card, today);
  const { difference, newDebtBase } = bankAdjustment({
    used,
    limit: card.limit,
    available: input.available,
  });
  const client = await pool.connect();
  let rebased;
  let charge = null;
  try {
    await client.query('BEGIN');
    if (difference > 0) {
      charge = await insertTransaction(
        {
          userId,
          amount: difference,
          description: `Cargos del banco · ${card.name}`,
          type: 'gasto',
          date: today,
          category: 'otros',
          source: 'manual',
          card: id,
          installments: 1,
        },
        client,
      );
    }
    if (difference !== 0) {
      await repo.insertAdjustment(
        { userId, cardId: id, difference, transactionId: charge?.id },
        client,
      );
    }
    const { rows } = await client.query('SELECT now()::text AS now');
    rebased = await repo.rebaseCard(
      id,
      userId,
      {
        debtBase: newDebtBase,
        baseAt: rows[0].now,
        statementTotal: input.statementTotal,
        statementDueDate: input.statementDueDate,
      },
      client,
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return { card: await present(rebased, today), chargeTransaction: charge };
}

/**
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<object[]>}
 */
export async function movements(userId, id) {
  await owned(id, userId);
  return repo.listMovements(id, userId);
}
