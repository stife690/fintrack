import { getHealthStatus } from '../services/health.service.js';

/**
 * Atiende `GET /health`: responde 200 con el estado del servicio.
 *
 * @param {import('express').Request} _req Petición (no se usa).
 * @param {import('express').Response} res Respuesta HTTP con el JSON de salud.
 * @returns {void}
 */
export function getHealth(_req, res) {
  res.json(getHealthStatus());
}
