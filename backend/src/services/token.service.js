import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Crea un access token (JWT) firmado, de vida corta, para un usuario.
 * @param {string} userId
 * @returns {string} JWT con el id del usuario en `sub`.
 */
export function signAccessToken(userId) {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: env.accessTokenTtl });
}

/**
 * Verifica la firma y la vigencia de un access token.
 * @param {string} token
 * @returns {{ sub: string }} Contenido del token; lanza un error si es inválido o venció.
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

/**
 * Genera un refresh token: texto aleatorio imposible de adivinar, sin datos adentro.
 * @returns {string}
 */
export function generateRefreshToken() {
  return randomBytes(48).toString('base64url');
}

/**
 * Calcula la huella (SHA-256) de un refresh token; es lo único que se guarda en la BD.
 * @param {string} token
 * @returns {string}
 */
export function hashRefreshToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
