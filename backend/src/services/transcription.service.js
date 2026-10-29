import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

/** API de transcripción de Groq (compatible con la de OpenAI). */
const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

/** Audio máximo que se acepta: unos 15 s de voz comprimida ocupan bastante menos. */
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

/** Formatos que graban los navegadores y acepta Whisper, con la extensión que espera el archivo. */
export const AUDIO_TYPES = {
  'audio/webm': 'webm', // Chrome, Edge, Firefox
  'video/webm': 'webm',
  'audio/mp4': 'm4a', // Safari (iPhone y Mac)
  'video/mp4': 'mp4',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'm4a',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

/**
 * Pista para Whisper: con este vocabulario escribe los montos como los decimos en Colombia
 * ("15 mil", "1,2 millones") en vez de inventar otras formas.
 */
const PROMPT =
  'Registro de gastos e ingresos en pesos colombianos: almuerzo 15 mil, me pagaron 1,2 millones, ' +
  '20 lucas, medio palo, ayer, el 12 de octubre.';

/**
 * Frases que Whisper inventa cuando solo hay silencio o ruido (vienen de los subtítulos con los
 * que se entrenó). Si la transcripción es solo eso, no se dijo nada.
 */
const SILENCE_HALLUCINATIONS = [
  /amara\.org/i,
  /subt[ií]tulos/i,
  /^\W*gracias( por ver)?\W*$/i,
  /^\W*$/,
];

/** @returns {AppError} 503: el dictado por servidor no está disponible. */
function unavailable() {
  return new AppError(
    503,
    'TRANSCRIPTION_UNAVAILABLE',
    'El dictado no está disponible en este momento',
  );
}

/**
 * Convierte en texto el audio de una frase con Whisper (en Groq). Solo se envía el audio: nunca
 * datos del usuario. Sin `GROQ_API_KEY` responde 503 y el cliente usa el dictado del navegador.
 *
 * @param {Buffer} audio
 * @param {string} mimeType Uno de {@link AUDIO_TYPES}, sin parámetros (`audio/webm`).
 * @returns {Promise<string>} Lo dicho, o `''` si solo hubo silencio.
 * @throws {AppError} 503 `TRANSCRIPTION_UNAVAILABLE`, o 429 `RATE_LIMITED` si se agotó la cuota.
 */
export async function transcribeAudio(audio, mimeType) {
  if (!env.groqApiKey) {
    console.error('Dictado por servidor desactivado: falta GROQ_API_KEY en backend/.env');
    throw unavailable();
  }

  const form = new FormData();
  form.append('file', new Blob([audio], { type: mimeType }), `voz.${AUDIO_TYPES[mimeType]}`);
  form.append('model', env.sttModel);
  form.append('language', 'es');
  form.append('prompt', PROMPT);
  form.append('response_format', 'json');
  form.append('temperature', '0');

  let response;
  try {
    response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.groqApiKey}` },
      body: form,
      signal: AbortSignal.timeout(env.sttTimeoutMs),
    });
  } catch (err) {
    console.error('Fallo al contactar a Groq:', err.name);
    throw unavailable();
  }

  if (!response.ok) {
    // El motivo de Groq (cuota, clave inválida…) ayuda a diagnosticar; no trae la clave ni audio.
    const reason = await response
      .json()
      .then((data) => data?.error?.message)
      .catch(() => undefined);
    console.error('Groq respondió con estado', response.status, reason ?? '');
    if (response.status === 429) {
      throw new AppError(
        429,
        'RATE_LIMITED',
        'Se usó mucho el dictado. Espera un momento o escribe el movimiento.',
      );
    }
    throw unavailable();
  }

  const data = await response.json().catch(() => null);
  if (typeof data?.text !== 'string') {
    console.error('Respuesta de Groq con formato inesperado');
    throw unavailable();
  }
  const text = data.text.trim();
  return SILENCE_HALLUCINATIONS.some((pattern) => pattern.test(text)) ? '' : text;
}
