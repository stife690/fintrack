import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/app-error.js';
import * as businesses from '../repositories/negocios.repository.js';
import * as repo from '../repositories/negocio-movements.repository.js';
import { findUserById } from '../repositories/users.repository.js';
import { todayIso } from './insights.service.js';
import {
  KIND_TO_DB,
  WITHDRAWAL_CATEGORY,
  buildPanel,
  distribution,
  monthRange,
  previousMonth,
} from './negocio-panel.logic.js';
import * as transactions from './transactions.service.js';

// Movimientos de un negocio y su panel del mes (FT-0017), retiros y reparto (FT-0018). Todos los
// socios ven; los dueños y los editores registran; un lector solo ve. Cada movimiento guarda quién
// lo registró. Un retiro también entra a las finanzas personales de quien lo hace: por eso solo
// ese socio lo registra o lo deshace, como los aportes de las vacas.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = () => new AppError(404, 'NOT_FOUND', 'Negocio no encontrado');
const readOnly = () =>
  new AppError(
    403,
    'FORBIDDEN',
    'Eres lector del negocio: puedes ver, pero no registrar ni borrar',
  );
const futureDate = () =>
  new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
    { field: 'date', problem: 'No puede ser una fecha futura' },
  ]);

/**
 * Negocio del que el usuario es socio, o 404 (a los demás no se les dice que existe).
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<{ id: string, name: string, nit: string|null, role: 'dueno'|'editor'|'lector' }>}
 */
async function requirePartner(userId, id) {
  const business = UUID_RE.test(id) && (await businesses.findBusinessForMember(id, userId));
  if (!business) throw notFound();
  return business;
}

/**
 * @param {string} userId
 * @returns {Promise<string>} Hoy en la zona horaria del usuario.
 */
async function today(userId) {
  const user = await findUserById(userId);
  return todayIso(new Date(), user?.timezone);
}

/**
 * Movimientos, panel y propuesta de reparto de un mes.
 * @param {{ id: string }} business
 * @param {string} month AAAA-MM.
 * @returns {Promise<{ movements: object[], panel: object, distribution: object }>}
 */
async function loadMonth(business, month) {
  const { from, to } = monthRange(month);
  const prev = monthRange(previousMonth(month));
  const [movements, previousMovements, partners] = await Promise.all([
    repo.listMovements(business.id, from, to),
    repo.listMovements(business.id, prev.from, prev.to),
    businesses.listPartners(business.id),
  ]);
  const panel = buildPanel({ month, movements, previousMovements });
  const withdrawals = movements
    .filter((m) => m.kind === 'withdrawal')
    .map((m) => ({ userId: m.registeredBy?.id ?? null, amount: m.amount }));
  return {
    movements,
    panel,
    distribution: distribution({ netProfit: panel.netProfit, partners, withdrawals }),
  };
}

/**
 * Movimientos del mes, su panel y el reparto propuesto.
 * @param {string} userId
 * @param {string} id
 * @param {string|undefined} month AAAA-MM; por defecto el mes actual.
 * @returns {Promise<{ month: string, canRecord: boolean, movements: object[], panel: object, distribution: object }>}
 */
export async function listMonth(userId, id, month) {
  const business = await requirePartner(userId, id);
  const selected = month ?? (await today(userId)).slice(0, 7);
  return {
    month: selected,
    canRecord: business.role !== 'lector',
    ...(await loadMonth(business, selected)),
  };
}

/**
 * Datos del mes para exportar. Todos los socios pueden, también el lector (p. ej. el contador).
 * @param {string} userId
 * @param {string} id
 * @param {string|undefined} month
 * @returns {Promise<{ business: object, month: string, movements: object[], panel: object, distribution: object }>}
 */
export async function monthReport(userId, id, month) {
  const business = await requirePartner(userId, id);
  const selected = month ?? (await today(userId)).slice(0, 7);
  return { business, month: selected, ...(await loadMonth(business, selected)) };
}

/**
 * Registra un movimiento. Si el celular reenvía el mismo `localId`, devuelve el que ya estaba.
 * @param {string} userId
 * @param {string} id
 * @param {ReturnType<import('../validators/negocio-movements.validator.js').parseNewMovement>} input
 * @returns {Promise<{ movement: object, created: boolean }>}
 */
export async function record(userId, id, input) {
  const business = await requirePartner(userId, id);
  if (business.role === 'lector') throw readOnly();
  if (input.localId) {
    const existing = await repo.findByLocalId(business.id, input.localId);
    if (existing) return { movement: existing, created: false };
  }
  const now = await today(userId);
  const date = input.date ?? now;
  if (date > now) throw futureDate();
  const movement = await repo.insertMovement({
    businessId: business.id,
    userId,
    kindDb: KIND_TO_DB[input.kind],
    category: input.category,
    amount: input.amount,
    description: input.description,
    date,
    localId: input.localId,
  });
  if (movement) return { movement, created: true };
  // Otra petición con el mismo `localId` ganó la carrera.
  return { movement: await repo.findByLocalId(business.id, input.localId), created: false };
}

/**
 * Retiro del socio: sale del negocio y entra como ingreso en sus finanzas personales (categoría
 * Otros ingresos). Reenviar el mismo `localId` no duplica ni el retiro ni el ingreso.
 * @param {string} userId
 * @param {string} id
 * @param {ReturnType<import('../validators/negocio-movements.validator.js').parseWithdrawal>} input
 * @returns {Promise<{ movement: object, transaction: object|null, created: boolean }>}
 */
export async function withdraw(userId, id, input) {
  const business = await requirePartner(userId, id);
  if (business.role === 'lector') throw readOnly();
  const localId = input.localId ?? randomUUID();
  const existing = await repo.findByLocalId(business.id, localId);
  if (existing) {
    const found = await repo.findMovement(business.id, existing.id);
    const transaction = found?.transactionId
      ? await transactions.get(userId, found.transactionId).catch(() => null)
      : null;
    return { movement: existing, transaction, created: false };
  }
  const user = await findUserById(userId);
  const now = todayIso(new Date(), user?.timezone);
  const date = input.date ?? now;
  if (date > now) throw futureDate();

  // Primero el ingreso personal (idempotente por localId) y después el retiro que lo enlaza.
  const transaction = await transactions.create(userId, {
    amount: input.amount,
    description: `Retiro de "${business.name}"`.slice(0, 200),
    type: 'ingreso',
    date,
    category: 'otros_ingresos',
    localId: `retiro-${localId}`,
  });
  const movement = await repo.insertMovement({
    businessId: business.id,
    userId,
    kindDb: KIND_TO_DB.withdrawal,
    category: WITHDRAWAL_CATEGORY,
    amount: input.amount,
    description: input.note ?? `Retiro de ${user?.name || 'un socio'}`.slice(0, 120),
    date,
    localId,
    transactionId: transaction.id,
  });
  return {
    movement: movement ?? (await repo.findByLocalId(business.id, localId)),
    transaction,
    created: Boolean(movement),
  };
}

/**
 * Borra un movimiento: lo puede borrar quien lo registró o un dueño. Un retiro solo lo deshace
 * el socio que lo hizo, y también se borra el ingreso que dejó en sus movimientos.
 * @param {string} userId
 * @param {string} id
 * @param {string} movementId
 * @returns {Promise<void>}
 */
export async function remove(userId, id, movementId) {
  const business = await requirePartner(userId, id);
  if (business.role === 'lector') throw readOnly();
  const movement = UUID_RE.test(movementId) && (await repo.findMovement(business.id, movementId));
  if (!movement) throw new AppError(404, 'NOT_FOUND', 'Movimiento no encontrado');
  if (movement.kind === 'withdrawal') {
    if (movement.authorId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Solo el socio que hizo el retiro puede deshacerlo');
    }
  } else if (business.role !== 'dueno' && movement.authorId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Solo quien lo registró o un dueño puede borrarlo');
  }
  await repo.deleteMovement(business.id, movementId);
  if (movement.kind === 'withdrawal' && movement.transactionId) {
    // Si ya lo había borrado en Movimientos, no hay nada más que hacer.
    await transactions.remove(userId, movement.transactionId).catch((err) => {
      if (err.statusCode !== 404) throw err;
    });
  }
}
