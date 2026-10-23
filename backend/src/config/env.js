/**
 * Lectura centralizada de variables de entorno.
 * Ningún otro módulo debe leer `process.env` directamente.
 */

/**
 * Orígenes permitidos por CORS, tomados de `CORS_ORIGIN`
 * (uno o varios separados por coma, sin barra final).
 * Vacío significa "sin restricción" (solo desarrollo local).
 * @type {string[]}
 */
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

/** Modelo económico por defecto de cada proveedor (se puede cambiar con `AI_MODEL`). */
const DEFAULT_MODELS = {
  gemini: 'gemini-flash-lite-latest',
  anthropic: 'claude-haiku-4-5-20251001',
};

const aiProvider = process.env.AI_PROVIDER === 'anthropic' ? 'anthropic' : 'gemini';

const nodeEnv = process.env.NODE_ENV || 'development';

// En producción el secreto es obligatorio: con uno conocido, cualquiera podría
// fabricar tokens válidos de otro usuario. Mejor no arrancar que arrancar inseguro.
if (nodeEnv === 'production' && !process.env.JWT_SECRET) {
  throw new Error('Falta la variable de entorno JWT_SECRET');
}

/**
 * Configuración del backend.
 * @type {{ aiProvider: 'gemini'|'anthropic', aiApiKey: string|undefined, aiApiUrl: string|undefined, aiModel: string, aiTimeoutMs: number, port: number, nodeEnv: string, corsOrigins: string[], databaseUrl: string|undefined, dbPoolMax: number, jwtSecret: string, accessTokenTtl: string, refreshTokenTtlDays: number, authRateLimitMax: number, aiRateLimitMax: number, trustProxy: number, vapidPublicKey: string|undefined, vapidPrivateKey: string|undefined, vapidSubject: string, remindersEnabled: boolean, reminderCheckIntervalMs: number, syncAiMax: number, googleClientId: string|undefined, emailApiKey: string|undefined, emailFrom: string|undefined, appUrl: string }}
 * @property {'gemini'|'anthropic'} aiProvider Proveedor de IA (`AI_PROVIDER`, por defecto "gemini").
 * @property {string|undefined} aiApiKey Clave del proveedor de IA (`AI_API_KEY`). Sin ella la IA queda desactivada y todo cae en "Sin clasificar".
 * @property {string|undefined} aiApiUrl Endpoint personalizado (`AI_API_URL`); si falta se usa el oficial del proveedor.
 * @property {string} aiModel Modelo usado para categorizar (`AI_MODEL`; por defecto uno económico del proveedor).
 * @property {number} aiTimeoutMs Tiempo máximo de espera al proveedor (`AI_TIMEOUT_MS`, por defecto 8000).
 * @property {number} port Puerto HTTP (`PORT`, por defecto 3000).
 * @property {string} nodeEnv Entorno de ejecución (`NODE_ENV`, por defecto "development").
 * @property {string[]} corsOrigins Orígenes permitidos por CORS.
 * @property {string|undefined} databaseUrl Cadena de conexión a PostgreSQL (`DATABASE_URL`).
 * @property {number} dbPoolMax Máximo de conexiones del pool (`DB_POOL_MAX`, por defecto 10).
 * @property {string} jwtSecret Secreto que firma los access tokens (`JWT_SECRET`; obligatorio en producción).
 * @property {string} accessTokenTtl Duración del access token (`ACCESS_TOKEN_TTL`, por defecto "15m").
 * @property {number} refreshTokenTtlDays Días de vida del refresh token (`REFRESH_TOKEN_TTL_DAYS`, por defecto 30).
 * @property {number} authRateLimitMax Intentos de login/registro por IP cada 15 min (`AUTH_RATE_LIMIT_MAX`, por defecto 20).
 * @property {number} aiRateLimitMax Peticiones por IP y minuto a los endpoints que consumen la IA (`AI_RATE_LIMIT_MAX`, por defecto 30).
 * @property {number} trustProxy Cantidad de proxies delante del servidor (`TRUST_PROXY`, por defecto 0).
 * @property {string|undefined} vapidPublicKey Llave pública VAPID de las notificaciones push (`VAPID_PUBLIC_KEY`).
 * @property {string|undefined} vapidPrivateKey Llave privada VAPID (`VAPID_PRIVATE_KEY`). Sin las dos llaves el push queda desactivado.
 * @property {string} vapidSubject Contacto del servidor push (`VAPID_SUBJECT`, un `mailto:` o URL https).
 * @property {string|undefined} googleClientId ID de cliente OAuth de Google (`GOOGLE_CLIENT_ID`). Sin él, `POST /auth/google` responde 503.
 * @property {boolean} remindersEnabled Si corre el programador del recordatorio diario (`REMINDERS_ENABLED`, por defecto sí; "false" lo apaga).
 * @property {number} reminderCheckIntervalMs Cada cuánto revisa los recordatorios, en ms (`REMINDER_CHECK_INTERVAL_MS`, por defecto 60000).
 * @property {number} syncAiMax Máximo de transacciones de un lote de /sync/batch que se categorizan con IA (`SYNC_AI_MAX`, por defecto 20; 0 la desactiva).
 * @property {string|undefined} emailApiKey Clave de la API de Brevo (`EMAIL_API_KEY`). Sin ella no se envían correos: en desarrollo el enlace sale en la consola.
 * @property {string|undefined} emailFrom Remitente de los correos (`EMAIL_FROM`); debe estar verificado en Brevo.
 * @property {string} appUrl Dirección del frontend para armar los enlaces de los correos (`APP_URL`, por defecto http://localhost:5173, sin barra final).
 */
export const env = {
  aiProvider,
  aiApiKey: process.env.AI_API_KEY || undefined,
  aiApiUrl: process.env.AI_API_URL || undefined,
  aiModel: process.env.AI_MODEL || DEFAULT_MODELS[aiProvider],
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS) || 8000,
  port: Number(process.env.PORT) || 3000,
  nodeEnv,
  corsOrigins,
  databaseUrl: process.env.DATABASE_URL,
  dbPoolMax: Number(process.env.DB_POOL_MAX) || 10,
  jwtSecret: process.env.JWT_SECRET || 'secreto-solo-para-desarrollo-local',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30,
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  aiRateLimitMax: Number(process.env.AI_RATE_LIMIT_MAX) || 30,
  trustProxy: Number(process.env.TRUST_PROXY) || 0,
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || undefined,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || undefined,
  vapidSubject: process.env.VAPID_SUBJECT || 'mailto:fintrack@example.com',
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || undefined,
  remindersEnabled: process.env.REMINDERS_ENABLED !== 'false',
  reminderCheckIntervalMs: Number(process.env.REMINDER_CHECK_INTERVAL_MS) || 60_000,
  syncAiMax: Number(process.env.SYNC_AI_MAX ?? 20),
  emailApiKey: process.env.EMAIL_API_KEY?.trim() || undefined,
  emailFrom: process.env.EMAIL_FROM?.trim() || undefined,
  appUrl: (process.env.APP_URL || 'http://localhost:5173').trim().replace(/\/$/, ''),
};
