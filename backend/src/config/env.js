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
const DEFAULT_MODELS = { gemini: 'gemini-flash-lite-latest', anthropic: 'claude-haiku-4-5-20251001' };

const aiProvider = process.env.AI_PROVIDER === 'anthropic' ? 'anthropic' : 'gemini';

const nodeEnv = process.env.NODE_ENV || 'development';

// En producción el secreto es obligatorio: con uno conocido, cualquiera podría
// fabricar tokens válidos de otro usuario. Mejor no arrancar que arrancar inseguro.
if (nodeEnv === 'production' && !process.env.JWT_SECRET) {
  throw new Error('Falta la variable de entorno JWT_SECRET');
}

/**
 * Configuración del backend.
 * @type {{ aiProvider: 'gemini'|'anthropic', aiApiKey: string|undefined, aiApiUrl: string|undefined, aiModel: string, aiTimeoutMs: number, port: number, nodeEnv: string, corsOrigins: string[], databaseUrl: string|undefined, dbPoolMax: number, jwtSecret: string, accessTokenTtl: string, refreshTokenTtlDays: number, authRateLimitMax: number, aiRateLimitMax: number, trustProxy: number }}
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
};
