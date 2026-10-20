import { AppError } from '../errors/app-error.js';
import { listCategories } from '../repositories/categories.repository.js';
import {
  findTransaction,
  insertTransaction,
  listTransactions,
  softDeleteTransaction,
  updateTransaction,
} from '../repositories/transactions.repository.js';
import { resolveCategory } from './categorization.service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * @param {{ insertTransaction: typeof insertTransaction, findTransaction: typeof findTransaction, listTransactions: typeof listTransactions, updateTransaction: typeof updateTransaction, softDeleteTransaction: typeof softDeleteTransaction }} [deps.repository]
 * @returns {{
 *   create: (userId: string, input: object) => Promise<object>,
 *   list: (userId: string, filters: object) => Promise<{ data: object[], page: number, pageSize: number, total: number }>,
 *   get: (userId: string, id: string) => Promise<object>,
 *   update: (userId: string, id: string, changes: object) => Promise<object>,
 *   remove: (userId: string, id: string) => Promise<void>
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
  };

  /**
   * Comprueba que la categoría elegida por el usuario exista y sea del tipo de la transacción (RN-02).
   * @param {string} key
   * @param {'ingreso'|'gasto'} type
   * @returns {Promise<void>}
   */
  async function assertCategory(key, type) {
    const match = (await getCategories()).find((c) => c.key === key);
    if (!match || match.type !== type) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
        { field: 'category', problem: `No es una categoría de ${type} del catálogo` },
      ]);
    }
  }

  /**
   * Decide la categoría final: la del usuario (`manual`) o la sugerida por la IA (REQ-010/011).
   * @param {{ category?: string|null, description: string, type: 'ingreso'|'gasto' }} input
   * @returns {Promise<{ category: string|null, source: 'manual'|'ia'|'sin_clasificar' }>}
   */
  async function decideCategory({ category, description, type }) {
    if (category) await assertCategory(category, type);
    return resolve({ category, description, type });
  }

  /**
   * Registra una transacción del usuario. Si no trae categoría, se pide a la IA;
   * si la IA falla queda `sin_clasificar` y la transacción se guarda igual.
   * @param {string} userId
   * @param {{ amount: number, description: string, type: 'ingreso'|'gasto', date: string, category: string|null }} input
   * @returns {Promise<object>}
   */
  async function create(userId, input) {
    const { category, source } = await decideCategory(input);
    const record = await repo.insertTransaction({ ...input, userId, category, source });
    return present(record);
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

  return { create, list, get, update, remove };
}

const service = createTransactionService();

/** Servicio con las dependencias reales (BD e IA). */
export const { create, list, get, update, remove } = service;
