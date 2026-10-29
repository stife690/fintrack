import { transcribeAudio } from '../services/transcription.service.js';
import { parseTranscribe } from '../validators/voice.validator.js';

/**
 * `POST /api/v1/voice/transcribe`: convierte en texto el audio de una frase (registro por voz,
 * FT-0013). Responde `{ text }`; el cliente lo interpreta igual que el dictado del navegador.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postTranscribe(req, res) {
  const { audio, mimeType } = parseTranscribe(req);
  res.json({ text: await transcribeAudio(audio, mimeType) });
}
