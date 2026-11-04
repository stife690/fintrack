import { createHash, randomBytes } from 'node:crypto';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { listCategories } from '../repositories/categories.repository.js';
import * as defaultRepo from '../repositories/pending-payments.repository.js';
import { insertTransaction } from '../repositories/transactions.repository.js';
import { findUserById } from '../repositories/users.repository.js';
import { resolveCategory } from './categorization.service.js';
import { todayIso } from './insights.service.js';
import { pushService } from './push.service.js';
import { money } from './whatsapp.service.js';

// Pagos con Apple Pay que llegan desde Atajos del iPhone (FT-0047). El iPhone no deja que otras
// apps lean Wallet, pero una automatización de Atajos sí puede mandar el comercio y el monto de
// cada pago. Llegan a "Por confirmar": nada entra a los movimientos sin que el usuario lo apruebe.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Prefijo para reconocer el token si alguien lo pega donde no es. */
export const TOKEN_PREFIX = 'ftk_';
/** Tope de pagos esperando: si alguien roba el token no puede llenar la base. */
export const MAX_PENDING = 200;

const notFound = () => new AppError(404, 'NOT_FOUND', 'Pago no encontrado');
const alreadyResolved = () =>
  new AppError(409, 'ALREADY_RESOLVED', 'Este pago ya se confirmó o se descartó');
const disabled = () =>
  new AppError(403, 'FEATURE_DISABLED', 'Los pagos desde el iPhone todavía no están disponibles');

/**
 * @param {string} text
 * @returns {string} SHA-256 en hexadecimal.
 */
export const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/**
 * Llave para no guardar dos veces el mismo pago. Si el Atajo manda un id se usa ese; si no,
 * comercio + monto + minuto (o el día, si no trae hora). Dos cafés iguales en el mismo minuto
 * quedarían como uno: es raro y el usuario lo puede anotar a mano.
 * @param {{ merchant: string, amount: number, date: string, minute: string|null, externalId: string|null }} p
 * @returns {string}
 */
export function paymentKey({ merchant, amount, date, minute, externalId }) {
  if (externalId) return sha256(`id:${externalId}`);
  return sha256(`${merchant.toLowerCase()}|${amount.toFixed(2)}|${minute ?? date}`);
}

/**
 * Aviso que llega al celular y a la campana cuando entra un pago.
 * @param {{ merchant: string, amount: number }} payment
 * @returns {{ title: string, body: string, url: string }}
 */
export function pendingPaymentPayload({ merchant, amount }) {
  return {
    title: 'Pago por confirmar',
    body: `${merchant}: ${money(amount)}. Confírmalo para anotarlo en tus movimientos.`,
    url: '/app/por-confirmar',
  };
}

/**
 * @param {object} [deps] Dependencias reemplazables en las pruebas.
 * @param {typeof defaultRepo} [deps.repository]
 * @param {typeof env} [deps.config]
 * @param {(userId: string, payload: object) => Promise<unknown>} [deps.notify]
 * @returns {object} `isEnabledFor`, `getToken`, `createToken`, `revokeToken`, `authenticate`, `receive`, `list`, `confirm` y `discard`.
 */
export function createPendingPaymentsService(deps = {}) {
  const repo = deps.repository ?? defaultRepo;
  const config = deps.config ?? env;
  const notify = deps.notify ?? ((userId, payload) => pushService.sendToUser(userId, payload));

  /**
   * ¿Puede este correo mandar pagos desde el iPhone? Mismo criterio que los soportes: en
   * producción solo los de `SHORTCUTS_ALLOWED_EMAILS` (o `*`); fuera de producción, vacío es todos.
   * @param {string} email
   * @returns {boolean}
   */
  function isEnabledFor(email) {
    const allowed = config.shortcutsAllowedEmails;
    if (allowed.length === 0) return config.nodeEnv !== 'production';
    return allowed.includes('*') || allowed.includes(email.toLowerCase());
  }

  /**
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async function ensureEnabled(userId) {
    const user = await findUserById(userId);
    if (!user || !isEnabledFor(user.email)) throw disabled();
  }

  /**
   * @param {string} userId
   * @param {string} id
   * @returns {Promise<object>} El pago, si sigue pendiente.
   */
  async function findOpen(userId, id) {
    const payment = UUID_RE.test(id) && (await repo.findPayment(id, userId));
    if (!payment) throw notFound();
    if (payment.status !== 'pending') throw alreadyResolved();
    return payment;
  }

  return {
    isEnabledFor,

    /**
     * Si la función está activa para el usuario y si ya tiene token (nunca devuelve el token).
     * @param {string} userId
     * @returns {Promise<{ enabled: boolean, token: { createdAt: Date, lastUsedAt: Date|null }|null }>}
     */
    async getToken(userId) {
      const user = await findUserById(userId);
      const enabled = Boolean(user && isEnabledFor(user.email));
      return { enabled, token: await repo.findToken(userId) };
    },

    /**
     * Crea un token nuevo y deja sin efecto el anterior. Es la única vez que se ve el token:
     * en la base solo queda su hash.
     * @param {string} userId
     * @returns {Promise<{ token: string, createdAt: Date, lastUsedAt: null }>}
     */
    async createToken(userId) {
      await ensureEnabled(userId);
      const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
      const saved = await repo.saveToken(userId, sha256(token));
      return { token, createdAt: saved.createdAt, lastUsedAt: null };
    },

    /**
     * @param {string} userId
     * @returns {Promise<void>}
     */
    async revokeToken(userId) {
      await repo.deleteToken(userId);
    },

    /**
     * Identifica al dueño de un token del Atajo.
     * @param {string|undefined} token
     * @returns {Promise<{ userId: string, email: string, timezone: string }>}
     * @throws {AppError} 401 si no sirve; 403 si la función no está activa para ese usuario.
     */
    async authenticate(token) {
      const owner = token?.startsWith(TOKEN_PREFIX) && (await repo.useToken(sha256(token)));
      if (!owner) throw new AppError(401, 'UNAUTHORIZED', 'Token del Atajo inválido o revocado');
      if (!isEnabledFor(owner.email)) throw disabled();
      return owner;
    },

    /**
     * Guarda el pago que mandó el Atajo y avisa al usuario. Si es el mismo pago otra vez, no
     * lo duplica: devuelve el que ya estaba.
     * @param {{ userId: string, timezone: string }} owner
     * @param {ReturnType<import('../validators/pending-payments.validator.js').parseIncomingPayment>} input
     * @returns {Promise<{ payment: object, duplicate: boolean }>}
     */
    async receive(owner, input) {
      const date = input.date ?? todayIso(new Date(), owner.timezone);
      const key = paymentKey({ ...input, date });
      const existing = await repo.findPaymentByKey(owner.userId, key);
      if (existing) return { payment: existing, duplicate: true };
      if ((await repo.countPending(owner.userId)) >= MAX_PENDING) {
        throw new AppError(
          429,
          'TOO_MANY_PENDING',
          `Tienes ${MAX_PENDING} pagos sin revisar. Confirma o descarta algunos primero.`,
        );
      }
      const payment = await repo.insertPayment({
        userId: owner.userId,
        merchant: input.merchant,
        amount: input.amount,
        date,
        card: input.card,
        key,
      });
      // Llegó otra petición igual al mismo tiempo: se devuelve la que ganó.
      if (!payment)
        return { payment: await repo.findPaymentByKey(owner.userId, key), duplicate: true };
      await Promise.resolve(notify(owner.userId, pendingPaymentPayload(payment))).catch((err) => {
        console.error(`No se avisó el pago por confirmar ${payment.id} (${err.message})`);
      });
      return { payment, duplicate: false };
    },

    /**
     * @param {string} userId
     * @returns {Promise<{ items: object[] }>}
     */
    async list(userId) {
      return { items: await repo.listPending(userId) };
    },

    /**
     * Confirma el pago: crea el gasto y lo deja enlazado, todo en una transacción SQL. Sin
     * categoría, la elige la IA con la descripción (si falla, queda sin clasificar).
     * @param {string} userId
     * @param {string} id
     * @param {{ category?: string, description?: string }} input
     * @returns {Promise<{ payment: object, transaction: object }>}
     */
    async confirm(userId, id, input) {
      const payment = await findOpen(userId, id);
      const description = input.description ?? payment.merchant;
      if (input.category) {
        const match = (await listCategories(userId)).find((c) => c.key === input.category);
        if (!match || match.type !== 'gasto') {
          throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
            { field: 'category', problem: 'No es una categoría de gasto del catálogo' },
          ]);
        }
      }
      const { category, source } = await resolveCategory({
        category: input.category,
        description,
        type: 'gasto',
        userId,
      });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const transaction = await insertTransaction(
          {
            userId,
            amount: payment.amount,
            description,
            type: 'gasto',
            date: payment.date,
            category,
            source,
          },
          client,
        );
        const confirmed = await repo.resolvePayment(
          { id, userId, status: 'confirmado', transactionId: transaction.id },
          client,
        );
        if (!confirmed) throw alreadyResolved(); // otra petición lo cerró mientras tanto
        await client.query('COMMIT');
        return { payment: confirmed, transaction };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    /**
     * Descarta el pago: no se anota en ningún lado.
     * @param {string} userId
     * @param {string} id
     * @returns {Promise<object>}
     */
    async discard(userId, id) {
      await findOpen(userId, id);
      const discarded = await repo.resolvePayment({ id, userId, status: 'descartado' });
      if (!discarded) throw alreadyResolved();
      return discarded;
    },
  };
}

export const pendingPayments = createPendingPaymentsService();
