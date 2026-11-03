import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import {
  claimUnverifiedAccount,
  createUser,
  findUserByEmail,
  findUserById,
} from '../repositories/users.repository.js';
import {
  consumeRefreshToken,
  revokeRefreshToken,
  saveRefreshToken,
} from '../repositories/refresh-tokens.repository.js';
import {
  createPasswordResetToken,
  resetPasswordWithToken,
} from '../repositories/password-reset-tokens.repository.js';
import {
  createEmailVerificationToken,
  verifyEmailWithToken,
} from '../repositories/email-verification-tokens.repository.js';
import { googleVerifier } from './google-auth.service.js';
import { sendPasswordResetEmail, sendVerificationEmail } from './mail.service.js';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from './token.service.js';

/** Costo de bcrypt: cada +1 duplica el tiempo de cifrado (10 ≈ decenas de ms). */
const BCRYPT_ROUNDS = 10;

/** Hash de relleno para que el login tarde lo mismo exista o no el correo. */
const DUMMY_HASH = bcrypt.hashSync('relleno-sin-uso', BCRYPT_ROUNDS);

const DAY_MS = 24 * 60 * 60 * 1000;

/** Minutos que dura el enlace para recuperar la contraseña (el correo dice lo mismo). */
export const RESET_TOKEN_MINUTES = 30;

/** Horas que dura el enlace para verificar el correo (el correo dice lo mismo). */
export const VERIFY_TOKEN_HOURS = 24;

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
 * Crea un enlace de verificación nuevo (anula los anteriores) y lo envía al correo del usuario.
 * El correo sale sin esperarlo, como el de recuperar la contraseña: si falla el envío, solo queda
 * en el log y el usuario puede pedir otro.
 * @param {{ id: string, email: string }} user
 * @param {typeof sendVerificationEmail} mailer
 * @returns {Promise<void>}
 */
async function sendVerificationLink(user, mailer) {
  const token = randomBytes(32).toString('base64url');
  await createEmailVerificationToken({
    userId: user.id,
    tokenHash: hashRefreshToken(token),
    expiresAt: new Date(Date.now() + VERIFY_TOKEN_HOURS * 60 * 60 * 1000),
  });
  // Después de "#": el navegador no envía esa parte al servidor, así el token no queda en logs.
  const link = `${env.appUrl}/verificar#token=${token}`;
  mailer({ to: user.email, link, hours: VERIFY_TOKEN_HOURS }).catch((err) => {
    console.error(`No se pudo enviar el correo de verificación (${err.message})`);
  });
}

/**
 * Registra un usuario nuevo y le envía el correo de verificación (REQ-001, FT-0016). No abre
 * sesión: hasta que abra el enlace no puede entrar, para que nadie use un correo que no es suyo.
 * @param {{ email: string, password: string }} data Datos ya validados.
 * @param {typeof sendVerificationEmail} [mailer] Envía el correo; las pruebas pasan uno falso.
 * @returns {Promise<{ email: string, verificationRequired: true }>}
 */
export async function register({ email, password }, mailer = sendVerificationEmail) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await createUser({ email: email.trim().toLowerCase(), passwordHash });
  if (!user) {
    throw new AppError(409, 'EMAIL_TAKEN', 'El correo ya está registrado');
  }
  await sendVerificationLink(user, mailer);
  return { email: user.email, verificationRequired: true };
}

/**
 * Inicia sesión. No revela si falló el correo o la contraseña (REQ-004). Solo con la contraseña
 * correcta dice que falta verificar el correo: así no revela qué correos están registrados.
 * @param {{ email: string, password: string }} data Datos ya validados.
 * @returns {Promise<{ user: { id: string, email: string, name: string|null }, accessToken: string, refreshToken: string }>}
 */
export async function login({ email, password }) {
  const user = await findUserByEmail(email.trim().toLowerCase());
  const matches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !matches) {
    throw new AppError(401, 'UNAUTHORIZED', 'Correo o contraseña incorrectos');
  }
  if (!user.emailVerified) {
    throw new AppError(
      403,
      'EMAIL_NOT_VERIFIED',
      'Confirma tu correo para entrar. Revisa tu bandeja o pide un enlace nuevo.',
    );
  }
  return {
    user: { id: user.id, email: user.email, name: user.name },
    ...(await issueTokens(user.id)),
  };
}

/**
 * Inicia sesión con una cuenta de Google. Si el correo ya tiene cuenta en FinTrack, entra a esa
 * misma cuenta; si no, la crea (con el nombre de Google). Las cuentas creadas así no tienen
 * contraseña utilizable: se guarda el hash de una cadena aleatoria que nadie conoce.
 *
 * Google garantiza que el correo es de quien entra. Si la cuenta existente no estaba verificada,
 * pudo registrarla otra persona con este correo (FT-0016): pasa a quien entra con Google, queda
 * verificada y su contraseña se cambia por una aleatoria, así la del otro deja de servir.
 * @param {string} credential `id_token` de Google Identity Services, ya validado como texto.
 * @param {{ verify: (credential: string) => Promise<{ email: string, name: string|null }> }} [verifier]
 * @returns {Promise<{ user: { id: string, email: string, name: string|null }, accessToken: string, refreshToken: string }>}
 */
export async function loginWithGoogle(credential, verifier = googleVerifier) {
  const { email, name } = await verifier.verify(credential);
  let user = await findUserByEmail(email);
  const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), BCRYPT_ROUNDS);
  if (!user) {
    // Si otra petición creó la cuenta en este instante, `createUser` devuelve null: se vuelve a buscar.
    user =
      (await createUser({ email, passwordHash, name, verified: true })) ??
      (await findUserByEmail(email));
  }
  if (!user.emailVerified) {
    // Si otra petición la reclamó en este instante, `claimUnverifiedAccount` devuelve null.
    user = (await claimUnverifiedAccount({ id: user.id, passwordHash })) ?? user;
  }
  return {
    user: { id: user.id, email: user.email, name: user.name },
    ...(await issueTokens(user.id)),
  };
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

/**
 * Envía, si el correo tiene cuenta, un enlace para crear una contraseña nueva. Termina igual
 * exista o no la cuenta, para no revelar qué correos están registrados (como el login, REQ-004).
 * El correo sale sin esperarlo: si se esperara, la respuesta tardaría más con un correo registrado
 * y por el tiempo se sabría cuál existe. Si falla el envío, solo queda en el log.
 * @param {string} email Correo ya validado.
 * @param {typeof sendPasswordResetEmail} [mailer] Envía el correo; las pruebas pasan uno falso.
 * @returns {Promise<void>}
 */
export async function requestPasswordReset(email, mailer = sendPasswordResetEmail) {
  const user = await findUserByEmail(email.trim().toLowerCase());
  if (!user) return;

  const token = randomBytes(32).toString('base64url');
  await createPasswordResetToken({
    userId: user.id,
    tokenHash: hashRefreshToken(token),
    expiresAt: new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000),
  });
  // Después de "#": el navegador no envía esa parte al servidor, así el token no queda en logs.
  const link = `${env.appUrl}/restablecer#token=${token}`;
  mailer({ to: user.email, link, minutes: RESET_TOKEN_MINUTES }).catch((err) => {
    console.error(`No se pudo enviar el correo para recuperar la contraseña (${err.message})`);
  });
}

/**
 * Cambia la contraseña con el token del enlace. Cierra todas las sesiones del usuario:
 * después debe iniciar sesión con la contraseña nueva.
 * @param {{ token: string, password: string }} data Datos ya validados.
 * @returns {Promise<void>}
 * @throws {AppError} 400 `INVALID_RESET_TOKEN` si el enlace no existe, ya se usó o venció.
 */
export async function resetPassword({ token, password }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const userId = await resetPasswordWithToken({ tokenHash: hashRefreshToken(token), passwordHash });
  if (!userId) {
    throw new AppError(
      400,
      'INVALID_RESET_TOKEN',
      'El enlace no es válido o ya venció. Pide uno nuevo.',
    );
  }
}

/**
 * Verifica el correo con el token del enlace y abre sesión (FT-0016): quien abre el enlace ya
 * demostró que el correo es suyo, no tiene que escribir la contraseña otra vez.
 * @param {string} token Token del enlace, ya validado como texto.
 * @returns {Promise<{ user: { id: string, email: string, name: string|null }, accessToken: string, refreshToken: string }>}
 * @throws {AppError} 400 `INVALID_VERIFICATION_TOKEN` si el enlace no existe, ya se usó o venció.
 */
export async function verifyEmail(token) {
  const userId = await verifyEmailWithToken(hashRefreshToken(token));
  if (!userId) {
    throw new AppError(
      400,
      'INVALID_VERIFICATION_TOKEN',
      'El enlace no es válido o ya venció. Pide uno nuevo.',
    );
  }
  const user = await findUserById(userId);
  return {
    user: { id: user.id, email: user.email, name: user.name },
    ...(await issueTokens(user.id)),
  };
}

/**
 * Envía otro enlace de verificación si el correo tiene una cuenta sin verificar. Termina igual en
 * cualquier caso (no existe, ya verificada), para no revelar qué correos están registrados.
 * @param {string} email Correo ya validado.
 * @param {typeof sendVerificationEmail} [mailer] Envía el correo; las pruebas pasan uno falso.
 * @returns {Promise<void>}
 */
export async function resendVerification(email, mailer = sendVerificationEmail) {
  const user = await findUserByEmail(email.trim().toLowerCase());
  if (!user || user.emailVerified) return;
  await sendVerificationLink(user, mailer);
}
