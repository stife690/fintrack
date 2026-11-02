import { AppError } from '../errors/app-error.js';
import * as repo from '../repositories/money-profile.repository.js';
import { MAX_COMMITMENTS } from '../validators/money-profile.validator.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @returns {AppError} 404 sin revelar si el compromiso existe pero es de otro (RN-01). */
function notFound() {
  return new AppError(404, 'NOT_FOUND', 'Compromiso no encontrado');
}

/** @returns {AppError} 409: el nombre identifica el pago en los movimientos del mes. */
function duplicated() {
  return new AppError(409, 'COMMITMENT_EXISTS', 'Ya tienes un compromiso con ese nombre');
}

/**
 * Perfil del usuario con sus compromisos. Quien no ha respondido recibe un perfil vacío.
 * @param {string} userId
 * @returns {Promise<object>} Ver `GET /api/v1/money-profile` en `docs/api/openapi.yaml`.
 */
export async function get(userId) {
  const [profile, commitments] = await Promise.all([repo.findProfile(userId), repo.listCommitments(userId)]);
  return {
    incomeType: profile?.incomeType ?? null,
    payDays: profile?.payDays ?? [],
    balance: profile?.balance ?? null,
    balanceAt: profile?.balanceAt ?? null,
    welcomeDone: Boolean(profile?.welcomeAt),
    commitments,
  };
}

/**
 * Cambia cómo le entra la plata al usuario y cuánta tiene.
 * @param {string} userId
 * @param {import('../validators/money-profile.validator.js').ProfileData} data
 * @returns {Promise<object>} El perfil actualizado.
 */
export async function update(userId, data) {
  await repo.saveProfile(userId, data);
  return get(userId);
}

/**
 * Guarda lo respondido en la bienvenida, o solo que se omitió.
 * @param {string} userId
 * @param {import('../validators/money-profile.validator.js').ProfileData & { commitments: import('../validators/money-profile.validator.js').NewCommitment[] }} data
 * @returns {Promise<object>} El perfil actualizado.
 */
export async function finishWelcome(userId, data) {
  const current = await repo.findProfile(userId);
  // Omitir no borra lo que ya estaba: quien ya respondió pudo cambiarlo en Cuenta.
  const answered = data.incomeType !== null || data.balance !== null;
  await repo.saveWelcome(userId, answered || !current ? data : { ...current, commitments: data.commitments });
  return get(userId);
}

/**
 * Crea un compromiso.
 * @param {string} userId
 * @param {import('../validators/money-profile.validator.js').NewCommitment} data
 * @returns {Promise<import('../repositories/money-profile.repository.js').CommitmentRecord>}
 * @throws {AppError} 409 `COMMITMENT_LIMIT` o `COMMITMENT_EXISTS`.
 */
export async function createCommitment(userId, data) {
  if ((await repo.countCommitments(userId)) >= MAX_COMMITMENTS) {
    throw new AppError(409, 'COMMITMENT_LIMIT', `Puedes tener hasta ${MAX_COMMITMENTS} compromisos`);
  }
  const commitment = await repo.insertCommitment(userId, data);
  if (!commitment) throw duplicated();
  return commitment;
}

/**
 * Cambia un compromiso propio.
 * @param {string} userId
 * @param {string} id
 * @param {import('../validators/money-profile.validator.js').NewCommitment} data
 * @returns {Promise<import('../repositories/money-profile.repository.js').CommitmentRecord>}
 * @throws {AppError} 404 `NOT_FOUND` o 409 `COMMITMENT_EXISTS`.
 */
export async function updateCommitment(userId, id, data) {
  if (!UUID_RE.test(id)) throw notFound();
  const commitment = await repo.updateCommitment(id, userId, data);
  if (commitment === 'duplicate') throw duplicated();
  if (!commitment) throw notFound();
  return commitment;
}

/**
 * Elimina un compromiso propio.
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<void>}
 * @throws {AppError} 404 `NOT_FOUND`.
 */
export async function removeCommitment(userId, id) {
  if (!UUID_RE.test(id) || !(await repo.deleteCommitment(id, userId))) throw notFound();
}
