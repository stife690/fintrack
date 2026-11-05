import { AppError } from '../errors/app-error.js';
import * as businesses from '../repositories/negocios.repository.js';
import * as repo from '../repositories/negocio-movements.repository.js';
import { findUserById } from '../repositories/users.repository.js';
import { todayIso } from './insights.service.js';
import { KIND_TO_DB, buildPanel, monthRange, previousMonth } from './negocio-panel.logic.js';

// Movimientos de un negocio y su panel del mes (FT-0017). Todos los socios ven; los dueños y los
// editores registran; un lector solo ve. Cada movimiento guarda quién lo registró.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = () => new AppError(404, 'NOT_FOUND', 'Negocio no encontrado');
const readOnly = () =>
  new AppError(
    403,
    'FORBIDDEN',
    'Eres lector del negocio: puedes ver, pero no registrar ni borrar',
  );

/**
 * Negocio del que el usuario es socio, o 404 (a los demás no se les dice que existe).
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<{ id: string, role: 'dueno'|'editor'|'lector' }>}
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
 * Movimientos del mes y su panel.
 * @param {string} userId
 * @param {string} id
 * @param {string|undefined} month AAAA-MM; por defecto el mes actual.
 * @returns {Promise<{ month: string, canRecord: boolean, movements: object[], panel: object }>}
 */
export async function listMonth(userId, id, month) {
  const business = await requirePartner(userId, id);
  const selected = month ?? (await today(userId)).slice(0, 7);
  const { from, to } = monthRange(selected);
  const prev = monthRange(previousMonth(selected));
  const [movements, previousMovements] = await Promise.all([
    repo.listMovements(business.id, from, to),
    repo.listMovements(business.id, prev.from, prev.to),
  ]);
  return {
    month: selected,
    canRecord: business.role !== 'lector',
    movements,
    panel: buildPanel({ month: selected, movements, previousMovements }),
  };
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
  const date = input.date ?? (await today(userId));
  if (date > (await today(userId))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'date', problem: 'No puede ser una fecha futura' },
    ]);
  }
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
 * Borra un movimiento: lo puede borrar quien lo registró o un dueño.
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
  if (business.role !== 'dueno' && movement.authorId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Solo quien lo registró o un dueño puede borrarlo');
  }
  await repo.deleteMovement(business.id, movementId);
}
