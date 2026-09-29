import { getHealthStatus } from '../services/health.service.js';

/**
 * Atiende `GET /health`: 200 si el servicio y la BD están bien,
 * 503 si la base de datos no responde.
 *
 * @param {import('express').Request} _req Petición (no se usa).
 * @param {import('express').Response} res Respuesta HTTP con el JSON de salud.
 * @returns {Promise<void>}
 */
export async function getHealth(_req, res) {
  const health = await getHealthStatus();
  res.status(health.status === 'ok' ? 200 : 503).json(health);
}
