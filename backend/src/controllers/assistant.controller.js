import * as assistant from '../services/assistant.service.js';
import { parseChat } from '../validators/assistant.validator.js';

/**
 * `POST /api/v1/assistant/chat`: responde una pregunta de finanzas con los datos agregados del
 * mes del usuario. La conversación la guarda el cliente; aquí no se almacena nada.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postChat(req, res) {
  const { messages } = parseChat(req.body);
  res.json(await assistant.reply(req.userId, messages));
}
