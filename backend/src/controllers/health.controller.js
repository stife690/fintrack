import { getHealthStatus } from '../services/health.service.js';

export function getHealth(_req, res) {
  res.json(getHealthStatus());
}
