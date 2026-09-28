import { env } from '../config/env.js';

/**
 * @typedef {Object} HealthStatus
 * @property {'ok'} status Estado del servicio.
 * @property {string} service Nombre del servicio.
 * @property {string} message Mensaje de bienvenida (hello world).
 * @property {string} env Entorno de ejecución actual.
 * @property {string} time Fecha y hora del servidor en formato ISO 8601.
 */

/**
 * Construye el estado de salud del servicio.
 * Lógica de negocio pura: no conoce `req` ni `res`.
 *
 * @returns {HealthStatus} Estado actual del servicio.
 */
export function getHealthStatus() {
  return {
    status: 'ok',
    service: 'fintrack-api',
    message: 'Hello world desde el backend de FinTrack',
    env: env.nodeEnv,
    time: new Date().toISOString(),
  };
}
