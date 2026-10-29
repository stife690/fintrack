import { AppError } from '../errors/app-error.js';
import { listCategories } from '../repositories/categories.repository.js';
import {
  findTransaction,
  insertTransaction,
  listTransactions,
  softDeleteTransaction,
  summarizeTransactions,
  updateTransaction,
} from '../repositories/transactions.repository.js';
import { findByLocalId } from '../repositories/sync.repository.js';
import { resolveCategory } from './categorization.service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {Date} date Fecha en UTC (solo importa el día).
 * @returns {string} La fecha como AAAA-MM-DD.
 */
function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Calcula el rango de fechas del periodo que contiene `date` (REQ-013).
 * - `week`: de lunes a domingo.
 * - `month`: del día 1 al último día del mes.
 * - `year`: del 1 de enero al 31 de diciembre.
 * @param {'week'|'month'|'year'} period
 * @param {string} date Cualquier día del periodo, AAAA-MM-DD.
 * @returns {{ from: string, to: string }}
 */
export function periodRange(period, date) {
  const [year, month, day] = date.split('-').map(Number);
  if (period === 'year') return { from: `${year}-01-01`, to: `${year}-12-31` };
  if (period === 'month') {
    // El día 0 del mes siguiente es el último día de este mes.
    const last = new Date(Date.UTC(year, month, 0));
    return { from: toIsoDate(new Date(Date.UTC(year, month - 1, 1))), to: toIsoDate(last) };
  }
  const current = new Date(Date.UTC(year, month - 1, day));
  // getUTCDay(): domingo = 0 ... sábado = 6. Se convierte para que lunes sea 0.
  const daysSinceMonday = (current.getUTCDay() + 6) % 7;
  const monday = new Date(current);
  monday.setUTCDate(current.getUTCDate() - daysSinceMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: toIsoDate(monday), to: toIsoDate(sunday) };
}

/**
 * Porcentaje de `part` sobre `whole`, con un decimal (0 si `whole` es 0).
 * @param {number} part
 * @param {number} whole
 * @returns {number}
 */
function percentOf(part, whole) {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;
}

/**
 * Suma de dinero redondeada a centavos (evita errores como 0.1 + 0.2 = 0.30000000000000004).
 * @param {number[]} values
 * @returns {number}
 */
function sumMoney(values) {
  return Math.round(values.reduce((acc, v) => acc + v, 0) * 100) / 100;
}

/** @returns {AppError} 404: no existe o pertenece a otro usuario (RN-01). */
function notFound() {
  return new AppError(404, 'NOT_FOUND', 'Transacción no encontrada');
}

/**
 * Quita `deletedAt` (siempre nulo para el cliente) del registro devuelto por la API.
 * @param {import('../repositories/transactions.repository.js').TransactionRecord} record
 * @returns {Omit<import('../repositories/transactions.repository.js').TransactionRecord, 'deletedAt'> & { deletedAt: null }}
 */
function present(record) {
  return { ...record, deletedAt: null };
}

/**
 * Crea el servicio de transacciones. Las dependencias se inyectan para probarlo sin BD ni IA.
 *
 * @param {object} [deps]
 * @param {typeof listCategories} [deps.listCategories]
 * @param {typeof resolveCategory} [deps.resolveCategory]
 * @param {{ insertTransaction: typeof insertTransaction, findTransaction: typeof findTransaction, listTransactions: typeof listTransactions, updateTransaction: typeof updateTransaction, softDeleteTransaction: typeof softDeleteTransaction, summarizeTransactions: typeof summarizeTransactions, findByLocalId?: typeof findByLocalId }} [deps.repository]
 * @returns {{
 *   create: (userId: string, input: object) => Promise<object>,
 *   list: (userId: string, filters: object) => Promise<{ data: object[], page: number, pageSize: number, total: number }>,
 *   get: (userId: string, id: string) => Promise<object>,
 *   update: (userId: string, id: string, changes: object) => Promise<object>,
 *   remove: (userId: string, id: string) => Promise<void>,
 *   summary: (userId: string, query: { period: 'week'|'month'|'year', date: string }) => Promise<object>
 * }}
 */
export function createTransactionService(deps = {}) {
  const getCategories = deps.listCategories ?? listCategories;
  const resolve = deps.resolveCategory ?? resolveCategory;
  const repo = deps.repository ?? {
    insertTransaction,
    findTransaction,
    listTransactions,
    updateTransaction,
    softDeleteTransaction,
    summarizeTransactions,
    findByLocalId,
  };

  /**
   * Comprueba que la categoría elegida por el usuario exista y sea del tipo de la transacción (RN-02).
   * @param {string} key
   * @param {'ingreso'|'gasto'} type
   * @param {string} userId Solo valen las categorías de todos y las suyas.
   * @returns {Promise<void>}
   */
  async function assertCategory(key, type, userId) {
    const match = (await getCategories(userId)).find((c) => c.key === key);
    if (!match || match.type !== type) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
        { field: 'category', problem: `No es una categoría de ${type} del catálogo` },
      ]);
    }
  }

  /**
   * Decide la categoría final: la del usuario (`manual`) o la sugerida por la IA (REQ-010/011).
   * @param {{ category?: string|null, description: string, type: 'ingreso'|'gasto', userId: string }} input
   * @returns {Promise<{ category: string|null, source: 'manual'|'ia'|'sin_clasificar' }>}
   */
  async function decideCategory({ category, description, type, userId }) {
    if (category) await assertCategory(category, type, userId);
    return resolve({ category, description, type, userId });
  }

  /**
   * Registra una transacción del usuario. Si no trae categoría, se pide a la IA;
   * si la IA falla queda `sin_clasificar` y la transacción se guarda igual.
   * @param {string} userId
   * @param {{ amount: number, description: string, type: 'ingreso'|'gasto', date: string, category: string|null }} input
   * @returns {Promise<object>}
   */
  async function create(userId, input) {
    // Reintento de un POST cuya respuesta se perdió: se devuelve la que ya existe (FT-0009).
    const existing = input.localId && (await repo.findByLocalId(userId, input.localId));
    // Si ya se había borrado, se devuelve tal cual (con `deletedAt`) en vez de revivirla.
    if (existing) return existing.deletedAt ? existing : present(existing);
    const { category, source } = await decideCategory({ ...input, userId });
    const record = await repo.insertTransaction({ ...input, userId, category, source });
    return present(record ?? (await repo.findByLocalId(userId, input.localId)));
  }

  /**
   * Lista paginada de las transacciones del usuario, con filtros opcionales.
   * @param {string} userId
   * @param {{ type?: string, category?: string, q?: string, from?: string, to?: string, page: number, pageSize: number }} filters
   * @returns {Promise<{ data: object[], page: number, pageSize: number, total: number }>}
   */
  async function list(userId, { page, pageSize, ...filters }) {
    const { rows, total } = await repo.listTransactions({
      ...filters,
      userId,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return { data: rows.map(present), page, pageSize, total };
  }

  /**
   * Obtiene una transacción puntual del usuario.
   * @param {string} userId
   * @param {string} id
   * @returns {Promise<object>}
   * @throws {AppError} 404 si no existe, está eliminada o es de otro usuario.
   */
  async function get(userId, id) {
    if (!UUID_RE.test(id)) throw notFound();
    const record = await repo.findTransaction(id, userId);
    if (!record) throw notFound();
    return present(record);
  }

  /**
   * Modifica una transacción. Si el usuario envía `category` se respeta; si cambia el tipo
   * sin enviar categoría, la anterior ya no aplica y se vuelve a categorizar.
   * @param {string} userId
   * @param {string} id
   * @param {{ amount?: number, description?: string, type?: 'ingreso'|'gasto', date?: string, category?: string|null }} changes
   * @returns {Promise<object>}
   * @throws {AppError} 404 si no existe o es de otro usuario.
   */
  async function update(userId, id, changes) {
    if (!UUID_RE.test(id)) throw notFound();
    const current = await repo.findTransaction(id, userId);
    if (!current) throw notFound();

    const patch = { ...changes };
    const type = changes.type ?? current.type;
    const typeChanged = type !== current.type;
    if ('category' in changes || typeChanged) {
      const decided = await decideCategory({
        category: 'category' in changes ? changes.category : null,
        description: changes.description ?? current.description,
        type,
        userId,
      });
      patch.category = decided.category;
      patch.source = decided.source;
    }

    const updated = await repo.updateTransaction(id, userId, patch);
    if (!updated) throw notFound();
    return present(updated);
  }

  /**
   * Borrado lógico de una transacción del usuario.
   * @param {string} userId
   * @param {string} id
   * @returns {Promise<void>}
   * @throws {AppError} 404 si no existe o es de otro usuario.
   */
  async function remove(userId, id) {
    if (!UUID_RE.test(id) || !(await repo.softDeleteTransaction(id, userId))) {
      throw notFound();
    }
  }

  /**
   * Resumen del periodo para el dashboard (F4, REQ-013/014/015), con la forma de `Summary`
   * del contrato: total y desglose por categoría de ingresos y de gastos, y una serie por día
   * (semana, mes) o por mes (año). Sin transacciones, totales en 0 y listas vacías.
   * @param {string} userId
   * @param {{ period: 'week'|'month'|'year', date: string }} query
   * @returns {Promise<object>}
   */
  async function summary(userId, { period, date }) {
    const { from, to } = periodRange(period, date);
    const groupBy = period === 'year' ? 'month' : 'day';
    const rows = await repo.summarizeTransactions({ userId, from, to, groupBy });

    // Arma { total, byCategory } de un tipo; el porcentaje es sobre el total de ese tipo.
    const block = (type) => {
      const mine = rows.byCategory.filter((r) => r.type === type);
      const total = sumMoney(mine.map((r) => r.total));
      return {
        total,
        byCategory: mine.map((r) => ({
          category: r.category,
          total: r.total,
          percentage: percentOf(r.total, total),
        })),
      };
    };

    // Junta ingreso y gasto del mismo día (o mes) en un solo punto de la serie.
    const points = new Map();
    for (const r of rows.series) {
      const point = points.get(r.date) ?? { date: r.date, income: 0, expense: 0 };
      if (r.type === 'ingreso') point.income = r.total;
      else point.expense = r.total;
      points.set(r.date, point);
    }

    return {
      period,
      from,
      to,
      income: block('ingreso'),
      expense: block('gasto'),
      timeSeries: [...points.values()],
    };
  }

  return { create, list, get, update, remove, summary };
}

const service = createTransactionService();

/** Servicio con las dependencias reales (BD e IA). */
export const { create, list, get, update, remove, summary } = service;
