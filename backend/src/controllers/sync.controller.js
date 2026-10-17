import { syncBatch } from '../services/sync.service.js';
import { parseSyncBatch } from '../validators/sync.validator.js';

/**
 * `POST /api/v1/sync/batch`: sincroniza un lote de operaciones hechas offline.
 * Responde 200 con `{ synced, conflicts, serverChanges, syncedAt }`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postSyncBatch(req, res) {
  const batch = parseSyncBatch(req.body);
  res.json(await syncBatch(req.userId, batch));
}