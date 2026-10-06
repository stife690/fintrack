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

const nodeEnv = process.env.NODE_ENV || 'development';

// En producción el secreto es obligatorio: con uno conocido, cualquiera podría
// fabricar tokens válidos de otro usuario. Mejor no arrancar que arrancar inseguro.
if (nodeEnv === 'production' && !process.env.JWT_SECRET) {
  throw new Error('Falta la variable de entorno JWT_SECRET');
}

/**
 * Configuración del backend.
 * @type {{ port: number, nodeEnv: string, corsOrigins: string[], databaseUrl: string|undefined, dbPoolMax: number, jwtSecret: string, accessTokenTtl: string, refreshTokenTtlDays: number }}
 * @property {number} port Puerto HTTP (`PORT`, por defecto 3000).
 * @property {string} nodeEnv Entorno de ejecución (`NODE_ENV`, por defecto "development").
 * @property {string[]} corsOrigins Orígenes permitidos por CORS.
 * @property {string|undefined} databaseUrl Cadena de conexión a PostgreSQL (`DATABASE_URL`).
 * @property {number} dbPoolMax Máximo de conexiones del pool (`DB_POOL_MAX`, por defecto 10).
 * @property {string} jwtSecret Secreto que firma los access tokens (`JWT_SECRET`; obligatorio en producción).
 * @property {string} accessTokenTtl Duración del access token (`ACCESS_TOKEN_TTL`, por defecto "15m").
 * @property {number} refreshTokenTtlDays Días de vida del refresh token (`REFRESH_TOKEN_TTL_DAYS`, por defecto 30).
 */
export const env = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv,
  corsOrigins,
  databaseUrl: process.env.DATABASE_URL,
  dbPoolMax: Number(process.env.DB_POOL_MAX) || 10,
  jwtSecret: process.env.JWT_SECRET || 'secreto-solo-para-desarrollo-local',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30,
};
