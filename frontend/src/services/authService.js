/**
 * Capa de autenticación del frontend.
 *
 * Por ahora es una SIMULACIÓN: el backend todavía no expone endpoints de auth.
 * Cuando existan (`POST /auth/login` y `POST /auth/register`), basta con
 * reemplazar el cuerpo de estas funciones por un `fetch` a `${API_URL}/auth/...`;
 * las páginas ya consumen esta interfaz y manejan los errores que lancen.
 */

/** Latencia simulada de red, en ms. */
const FAKE_LATENCY = 900;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @typedef {object} User
 * @property {string} email
 */

/**
 * Inicia sesión (simulado). Contrato: `POST /auth/login { email, password }`;
 * ante 401 la API no indica qué campo falló (REQ-004), así que el error debe ser genérico.
 * @param {{ email: string, password: string, remember: boolean }} credentials
 * @returns {Promise<{ user: User }>}
 */
export async function login({ email }) {
  await wait(FAKE_LATENCY);
  return { user: { email } };
}

/**
 * Crea una cuenta (simulado). Contrato: `POST /auth/register { email, password }`;
 * responde 409 si el correo ya existe (REQ-003).
 * @param {{ email: string, password: string }} data
 * @returns {Promise<{ user: User }>}
 */
export async function register({ email }) {
  await wait(FAKE_LATENCY);
  return { user: { email } };
}
