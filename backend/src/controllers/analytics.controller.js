import * as analytics from '../services/analytics.service.js';

/**
 * `GET /api/v1/analytics`: proyección de fin de mes, gastos hormiga y puntaje de salud financiera.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getAnalytics(req, res) {
  res.json(await analytics.getAnalytics(req.userId));
}
