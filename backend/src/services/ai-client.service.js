import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

/** @returns {AppError} 503: el proveedor de IA no está disponible. */
function aiUnavailable() {
  return new AppError(503, 'AI_UNAVAILABLE', 'El servicio de IA no está disponible');
}

/**
 * Envía un prompt al proveedor de IA externo y devuelve el texto de la respuesta.
 * Cualquier fallo (sin clave, red, tiempo agotado, respuesta no válida) se
 * convierte en `AI_UNAVAILABLE` (503); los detalles solo van al log del servidor.
 *
 * @param {{ system: string, prompt: string, maxTokens?: number }} request
 * @returns {Promise<string>} Texto generado por el modelo.
 * @throws {AppError} 503 `AI_UNAVAILABLE`.
 */
export async function completeText({ system, prompt, maxTokens = 50 }) {
  if (!env.aiApiKey) {
    throw aiUnavailable();
  }

  let response;
  try {
    response = await fetch(env.aiApiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.aiApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.aiModel,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(env.aiTimeoutMs),
    });
  } catch (err) {
    console.error('Fallo al contactar al proveedor de IA:', err.name);
    throw aiUnavailable();
  }

  if (!response.ok) {
    console.error('El proveedor de IA respondió con estado', response.status);
    throw aiUnavailable();
  }

  try {
    const data = await response.json();
    const text = data.content?.find((block) => block.type === 'text')?.text;
    if (typeof text !== 'string') throw new Error('sin texto');
    return text;
  } catch {
    console.error('Respuesta del proveedor de IA con formato inesperado');
    throw aiUnavailable();
  }
}
