import { AppError } from '../errors/app-error.js';
import { AUDIO_TYPES } from '../services/transcription.service.js';

/**
 * Valida `POST /voice/transcribe`: el cuerpo es el audio crudo y `Content-Type` dice su formato.
 * @param {import('express').Request} req
 * @returns {{ audio: Buffer, mimeType: string }} Formato sin parámetros (`audio/webm;codecs=opus` → `audio/webm`).
 * @throws {AppError} 415 si el formato no es de audio aceptado; 400 si llega vacío.
 */
export function parseTranscribe(req) {
  const mimeType = (req.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!(mimeType in AUDIO_TYPES)) {
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Formato de audio no soportado');
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Envía el audio de la frase');
  }
  return { audio: req.body, mimeType };
}
