import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { createUser, findUserByEmail } from '../repositories/users.repository.js';
import {
  consumeRefreshToken,
  revokeRefreshToken,
  saveRefreshToken,
} from '../repositories/refresh-tokens.repository.js';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from './token.service.js';

/** Costo de bcrypt: cada +1 duplica el tiempo de cifrado (10 ≈ decenas de ms). */
const BCRYPT_ROUNDS = 10;

/** Hash de relleno para que el login tarde lo mismo exista o no el correo. */
const DUMMY_HASH = bcrypt.hashSync('relleno-sin-uso', BCRYPT_ROUNDS);

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Emite un access token y un refresh token nuevos para un usuario,
 * y guarda la huella del refresh token.
 * @param {string} userId
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
async function issueTokens(userId) {
  const refreshToken = generateRefreshToken();
  await saveRefreshToken({
    userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + env.refreshTokenTtlDays * DAY_MS),
  });
  return { accessToken: signAccessToken(userId), refreshToken };
}

/**
 * Registra un usuario nuevo y le abre sesión (REQ-001, REQ-003).
 * @param {{ email: string, password: string }} data Datos ya validados.
 * @returns {Promise<{ user: { id: string, email: string }, accessToken: string, refreshToken: string }>}
 */
export async function register({ email, password }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await createUser({ email: email.trim().toLowerCase(), passwordHash });
  if (!user) {
    throw new AppError(409, 'EMAIL_TAKEN', 'El correo ya está registrado');
  }
  return { user: { id: user.id, email: user.email }, ...(await issueTokens(user.id)) };
}

/**
 * Inicia sesión. No revela si falló el correo o la contraseña (REQ-004).
 * @param {{ email: string, password: string }} data Datos ya validados.
 * @returns {Promise<{ user: { id: string, email: string }, accessToken: string, refreshToken: string }>}
 */
export async function login({ email, password }) {
  const user = await findUserByEmail(email.trim().toLowerCase());
  const matches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !matches) {
    throw new AppError(401, 'UNAUTHORIZED', 'Correo o contraseña incorrectos');
  }
  return { user: { id: user.id, email: user.email }, ...(await issueTokens(user.id)) };
}

/**
 * Cambia un refresh token válido por un par de tokens nuevo (rotación).
 * El token usado queda revocado.
 * @param {string} refreshToken
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
export async function refresh(refreshToken) {
  const userId = await consumeRefreshToken(hashRefreshToken(refreshToken));
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Refresh token inválido, vencido o revocado');
  }
  return issueTokens(userId);
}

/**
 * Cierra una sesión: revoca el refresh token del usuario autenticado.
 * @param {{ userId: string, refreshToken: string }} data
 * @returns {Promise<void>}
 */
export async function logout({ userId, refreshToken }) {
  await revokeRefreshToken({ userId, tokenHash: hashRefreshToken(refreshToken) });
}
