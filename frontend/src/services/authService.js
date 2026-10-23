/**
 * Capa de autenticación del frontend, según `docs/api/openapi.yaml`.
 *
 * Llama a `POST /api/v1/auth/login`, `/auth/register`, `/auth/google`, `/auth/forgot-password` y
 * `/auth/reset-password`. Con `VITE_API_MOCKS` activo, en desarrollo MSW intercepta los que tiene
 * simulados (ver `src/mocks/handlers.js`); los demás llegan a la API real.
 * Las páginas muestran `error.message`, así que aquí se traducen los errores de la API
 * (`{ error: { code, message, details? } }`) a mensajes para el usuario.
 */
import { API_V1 } from '@/lib/api';

/**
 * @typedef {object} User
 * @property {string} id
 * @property {string} email
 */

/**
 * @typedef {object} AuthResponse
 * @property {User} user
 * @property {string} accessToken  JWT de 15 min.
 * @property {string} refreshToken Válido 30 días.
 */

const TOO_MANY = 'Demasiados intentos. Espera un momento y vuelve a intentarlo.';

/**
 * Hace un POST JSON y devuelve el cuerpo. Si la respuesta no es 2xx lanza un Error con
 * `messages[error.code]`, el primer `details[].problem` (422), el mensaje de la API o
 * `fallback`, en ese orden; el `code` de la API queda en `err.code`.
 * @param {string} path
 * @param {object} body
 * @param {{ fallback: string, messages?: Record<string, string> }} errors
 */
async function postJson(path, body, { fallback, messages = {} }) {
  let res;
  try {
    res = await fetch(`${API_V1}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('No pudimos conectar con el servidor. Revisa tu conexión.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { code, message, details } = data.error ?? {};
    const err = new Error(messages[code] || details?.[0]?.problem || message || fallback);
    err.code = code;
    throw err;
  }
  return data;
}

/**
 * Inicia sesión. Contrato: `POST /auth/login { email, password }`;
 * ante 401 `UNAUTHORIZED` la API no indica qué campo falló (REQ-004).
 * @param {{ email: string, password: string, remember: boolean }} credentials
 * @returns {Promise<AuthResponse>}
 */
export function login({ email, password }) {
  return postJson('/auth/login', { email, password }, {
    fallback: 'No pudimos iniciar sesión. Inténtalo de nuevo.',
    messages: { UNAUTHORIZED: 'Correo o contraseña incorrectos.', RATE_LIMITED: TOO_MANY },
  });
}

/**
 * Crea una cuenta. Contrato: `POST /auth/register { email, password }`;
 * responde 409 `EMAIL_TAKEN` si el correo ya existe (REQ-003)
 * y 422 `VALIDATION_ERROR` si el correo o la contraseña no cumplen las reglas.
 * @param {{ email: string, password: string }} data
 * @returns {Promise<AuthResponse>}
 */
export function register({ email, password }) {
  return postJson('/auth/register', { email, password }, {
    fallback: 'No pudimos crear tu cuenta. Inténtalo de nuevo.',
    messages: { EMAIL_TAKEN: 'Ya existe una cuenta con ese correo.', RATE_LIMITED: TOO_MANY },
  });
}

/**
 * Inicia sesión con Google (crea la cuenta si el correo es nuevo). Contrato:
 * `POST /auth/google { credential }`, donde `credential` es el id_token de Google Identity Services.
 * @param {string} credential
 * @returns {Promise<AuthResponse>}
 */
export function loginWithGoogle(credential) {
  return postJson('/auth/google', { credential }, {
    fallback: 'No pudimos iniciar sesión con Google. Inténtalo de nuevo.',
    messages: {
      GOOGLE_NOT_CONFIGURED: 'El inicio de sesión con Google no está disponible por ahora.',
      RATE_LIMITED: TOO_MANY,
    },
  });
}

/**
 * Pide el enlace para recuperar la contraseña. Contrato: `POST /auth/forgot-password { email }`;
 * responde 200 con el mismo mensaje exista o no la cuenta (no revela qué correos están registrados).
 * @param {string} email
 * @returns {Promise<{ message: string }>}
 */
export function requestPasswordReset(email) {
  return postJson('/auth/forgot-password', { email }, {
    fallback: 'No pudimos enviar el enlace. Inténtalo de nuevo.',
    messages: { RATE_LIMITED: TOO_MANY },
  });
}

/**
 * Cambia la contraseña con el token del enlace del correo. Contrato:
 * `POST /auth/reset-password { token, password }` → 204; 400 `INVALID_RESET_TOKEN` si el enlace
 * no existe, ya se usó o venció. Cierra todas las sesiones: después hay que iniciar sesión.
 * @param {{ token: string, password: string }} data
 * @returns {Promise<void>}
 */
export async function resetPassword({ token, password }) {
  await postJson('/auth/reset-password', { token, password }, {
    fallback: 'No pudimos cambiar tu contraseña. Inténtalo de nuevo.',
    messages: {
      INVALID_RESET_TOKEN: 'Este enlace ya no sirve: venció o ya se usó. Pide uno nuevo.',
      RATE_LIMITED: TOO_MANY,
    },
  });
}
