import { apiRequest } from '@/lib/apiRequest';

/**
 * Convierte en texto el audio de una frase (registro por voz, FT-0013). El servidor lo envía a
 * Whisper y no lo guarda.
 * @param {Blob} audio Grabación con su tipo (`audio/webm`, `audio/mp4`…).
 * @returns {Promise<{ text: string }>} `text` vacío si solo hubo silencio.
 * @throws {Error} Con `code`: `TRANSCRIPTION_UNAVAILABLE` (503) si el servidor no tiene el servicio,
 *   `RATE_LIMITED` (429) si se usó demasiado.
 */
export function transcribeVoice(audio) {
  return apiRequest('/voice/transcribe', { method: 'POST', body: audio });
}
