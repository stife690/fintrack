import { env } from '../config/env.js';

export function getHealthStatus() {
  return {
    status: 'ok',
    service: 'fintrack-api',
    message: 'Hello world desde el backend de FinTrack',
    env: env.nodeEnv,
    time: new Date().toISOString(),
  };
}
