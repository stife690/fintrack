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

/**
 * Configuración del backend.
 * @type {{ port: number, nodeEnv: string, corsOrigins: string[], databaseUrl: string|undefined, dbPoolMax: number }}
 * @property {number} port Puerto HTTP (`PORT`, por defecto 3000).
 * @property {string} nodeEnv Entorno de ejecución (`NODE_ENV`, por defecto "development").
 * @property {string[]} corsOrigins Orígenes permitidos por CORS.
 * @property {string|undefined} databaseUrl Cadena de conexión a PostgreSQL (`DATABASE_URL`).
 * @property {number} dbPoolMax Máximo de conexiones del pool (`DB_POOL_MAX`, por defecto 10).
 */
export const env = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins,
  databaseUrl: process.env.DATABASE_URL,
  dbPoolMax: Number(process.env.DB_POOL_MAX) || 10,
};

