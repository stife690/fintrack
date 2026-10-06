import { env } from '../config/env.js';
import { pingDatabase } from '../repositories/health.repository.js';

/**
 * @typedef {object} HealthStatus
 * @property {'ok'|'error'} status Estado general del servicio.
 * @property {string} service Nombre del servicio.
 * @property {string} message Mensaje de bienvenida (hello world).
 * @property {string} env Entorno de ejecución actual.
 * @property {'up'|'down'} database Estado de la conexión con PostgreSQL.
 * @property {string} time Fecha y hora del servidor en formato ISO 8601.
 */

/**
 * Construye el estado de salud del servicio, verificando la base de datos.
 * Lógica de negocio pura: no conoce `req` ni `res`.
 *
 * @returns {Promise<HealthStatus>} Estado actual del servicio.
 */
export async function getHealthStatus() {
  let database = 'up';
  try {
    await pingDatabase();
  } catch (err) {
    database = 'down';
    console.error('Health check: PostgreSQL no responde:', err.message);
  }

  return {
    status: database === 'up' ? 'ok' : 'error',
    service: 'fintrack-api',
    message: 'Hello world desde el backend de FinTrack',
    env: env.nodeEnv,
    database,
    time: new Date().toISOString(),
  };
}
