import * as insights from '../services/insights.service.js';

/**
 * `GET /api/v1/insights`: insights del mes actual generados por IA con datos agregados.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getInsights(req, res) {
  res.json(await insights.getInsights(req.userId));
}
