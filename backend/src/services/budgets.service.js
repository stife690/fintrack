import { AppError } from '../errors/app-error.js';
import { findCategoryByKey } from '../repositories/categories.repository.js';
import { findUserById } from '../repositories/users.repository.js';
import * as repo from '../repositories/budgets.repository.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Umbrales de alerta del presupuesto (RN-04), en porcentaje consumido. */
const WARNING_THRESHOLD = 80;
const EXCEEDED_THRESHOLD = 100;

/** Zona horaria por defecto (la misma que usa la tabla `usuarios`). */
const DEFAULT_TIMEZONE = 'America/Bogota';

/** @returns {AppError} 404 sin revelar si el presupuesto existe pero es de otro (RN-01). */
function notFound() {
  return new AppError(404, 'NOT_FOUND', 'Presupuesto no encontrado');
}

/**
 * @typedef {object} BudgetStatus
 * @property {number} percentage Porcentaje consumido, con 2 decimales.
 * @property {{ level: 'none'|'warning_80'|'exceeded_100', percentage: number }} alert Nivel de alerta.
 */

/**
 * Calcula el porcentaje consumido y el nivel de alerta de un presupuesto (RN-04).
 * Es una función pura y exportada: la reutiliza el aviso al registrar transacciones (FT-0006).
 * @param {number} amount Monto límite (siempre mayor que 0).
 * @param {number} consumed Lo gastado.
 * @returns {BudgetStatus}
 */
export function buildBudgetStatus(amount, consumed) {
  const percentage = Math.round((consumed / amount) * 100 * 100) / 100;

  let level = 'none';
  if (percentage >= EXCEEDED_THRESHOLD) {
    level = 'exceeded_100';
  } else if (percentage >= WARNING_THRESHOLD) {
    level = 'warning_80';
  }

  return { percentage, alert: { level, percentage } };
}
/**
 * Agrega el porcentaje y la alerta a un presupuesto leído de la base de datos.
 * @param {import('../repositories/budgets.repository.js').BudgetRecord} record
 * @returns {import('../repositories/budgets.repository.js').BudgetRecord & BudgetStatus}
 */
function toBudget(record) {
  return { ...record, ...buildBudgetStatus(record.amount, record.consumed) };
}

/**
 * Mes actual (AAAA-MM) en la zona horaria del usuario.
 * @param {string} timeZone Zona IANA, p. ej. "America/Bogota".
 * @returns {string}
 */
function currentMonth(timeZone) {
  const format = (tz) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).format(
      new Date(),
    );
  try {
    return format(timeZone);
  } catch {
    return format(DEFAULT_TIMEZONE);
  }
}

/**
 * Presupuestos del usuario en un mes, con lo gastado, el porcentaje y la alerta.
 * Si no se indica el mes, usa el mes actual en la zona horaria del usuario.
 * @param {string} userId
 * @param {string} [month] AAAA-MM (ya validado).
 * @returns {Promise<Array<import('../repositories/budgets.repository.js').BudgetRecord & BudgetStatus>>}
 */
export async function list(userId, month) {
  let target = month;
  if (!target) {
    const user = await findUserById(userId);
    target = currentMonth(user?.timezone ?? DEFAULT_TIMEZONE);
  }
  const records = await repo.listBudgets(userId, target);
  return records.map(toBudget);
}

/**
 * Crea un presupuesto para una categoría de gasto en un mes (RN-03: uno por categoría y mes).
 * @param {string} userId
 * @param {{ category: string, month: string, amount: number }} data Datos ya validados.
 * @returns {Promise<{ id: string, category: string, month: string, amount: number }>}
 */
export async function create(userId, { category, month, amount }) {
  const found = await findCategoryByKey(category);
  if (!found || found.type !== 'gasto') {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'category', problem: 'Debe ser una categoría de gasto del catálogo' },
    ]);
  }

  const created = await repo.insertBudget({ userId, categoryId: found.id, month, amount });
  if (!created) {
    throw new AppError(409, 'BUDGET_EXISTS', 'Ya existe un presupuesto para esa categoría en ese mes');
  }

  return { id: created.id, category: found.key, month: created.month, amount: created.amount };
}

/**
 * Cambia el monto de un presupuesto propio y lo devuelve con el porcentaje recalculado (REQ-017).
 * @param {string} userId
 * @param {string} id
 * @param {number} amount Ya validado.
 * @returns {Promise<import('../repositories/budgets.repository.js').BudgetRecord & BudgetStatus>}
 */
export async function updateAmount(userId, id, amount) {
  if (!UUID_RE.test(id) || !(await repo.updateBudgetAmount(id, userId, amount))) {
    throw notFound();
  }
  return toBudget(await repo.findBudget(id, userId));
}

/**
 * Elimina un presupuesto propio.
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function remove(userId, id) {
  if (!UUID_RE.test(id) || !(await repo.deleteBudget(id, userId))) {
    throw notFound();
  }
}