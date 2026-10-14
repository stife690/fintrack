import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

/** @returns {AppError} 503: el proveedor de IA no está disponible. */
function aiUnavailable() {
  return new AppError(503, 'AI_UNAVAILABLE', 'El servicio de IA no está disponible');
}

/**
 * Arma la petición HTTP para Gemini (`generateContent`). La clave va en una cabecera,
 * nunca en la URL, para que no quede en logs ni en historiales.
 * @param {{ system: string, prompt: string, maxTokens: number }} request
 * @returns {{ url: string, headers: Record<string, string>, body: object, readText: (data: object) => unknown }}
 */
function buildGeminiRequest({ system, prompt, maxTokens }) {
  // Margen de sobra para modelos que razonan antes de responder. No se envía `thinkingConfig`:
  // los modelos "lite" lo rechazan con 400 y su formato cambia entre versiones.
  const generationConfig = { maxOutputTokens: Math.max(maxTokens, 256), temperature: 0 };
  return {
    url:
      env.aiApiUrl ??
      `https://generativelanguage.googleapis.com/v1beta/models/${env.aiModel}:generateContent`,
    headers: { 'x-goog-api-key': env.aiApiKey },
    body: {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    },
    readText: (data) => data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text,
  };
}

/**
 * Arma la petición HTTP para la API de mensajes de Anthropic (proveedor alternativo).
 * @param {{ system: string, prompt: string, maxTokens: number }} request
 * @returns {{ url: string, headers: Record<string, string>, body: object, readText: (data: object) => unknown }}
 */
function buildAnthropicRequest({ system, prompt, maxTokens }) {
  return {
    url: env.aiApiUrl ?? 'https://api.anthropic.com/v1/messages',
    headers: { 'x-api-key': env.aiApiKey, 'anthropic-version': '2023-06-01' },
    body: {
      model: env.aiModel,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    },
    readText: (data) => data.content?.find((block) => block.type === 'text')?.text,
  };
}

/** Intentos totales por petición: el original más un reintento. */
const MAX_ATTEMPTS = 2;

/**
 * Envía un prompt al proveedor de IA configurado (`AI_PROVIDER`: Gemini por defecto,
 * o Anthropic) y devuelve el texto de la respuesta. Cualquier fallo (sin clave, red,
 * tiempo agotado, respuesta no válida) se convierte en `AI_UNAVAILABLE` (503), tras un reintento
 * si el fallo es transitorio (red, tiempo agotado o 5xx); los
 * detalles solo van al log del servidor, sin incluir la clave.
 *
 * @param {{ system: string, prompt: string, maxTokens?: number }} request
 * @returns {Promise<string>} Texto generado por el modelo.
 * @throws {AppError} 503 `AI_UNAVAILABLE`.
 */
export async function completeText({ system, prompt, maxTokens = 64 }) {
  if (!env.aiApiKey) {
    console.error('IA desactivada: falta AI_API_KEY en backend/.env');
    throw aiUnavailable();
  }

  const build = env.aiProvider === 'anthropic' ? buildAnthropicRequest : buildGeminiRequest;
  const { url, headers, body, readText } = build({ system, prompt, maxTokens });

  const send = () =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(env.aiTimeoutMs),
    });

  // Arquitectura de IA §4: un (1) reintento automático ante un fallo transitorio (error de red,
  // tiempo agotado o 5xx del proveedor) antes de aplicar el fallback.
  let response;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      response = await send();
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        console.error('Fallo al contactar al proveedor de IA:', err.name);
        throw aiUnavailable();
      }
      continue;
    }
    if (response.status < 500 || attempt === MAX_ATTEMPTS) break;
  }

  if (!response.ok) {
    // El motivo que devuelve el proveedor (cuota, facturación, modelo inexistente...) ayuda a
    // diagnosticar. Es un texto de Google, no contiene la clave ni datos del usuario.
    const reason = await response
      .json()
      .then((data) => data?.error?.message)
      .catch(() => undefined);
    console.error('El proveedor de IA respondió con estado', response.status, reason ?? '');
    throw aiUnavailable();
  }

  try {
    const text = readText(await response.json());
    if (typeof text !== 'string') throw new Error('sin texto');
    return text;
  } catch {
    console.error('Respuesta del proveedor de IA con formato inesperado');
    throw aiUnavailable();
  }
}
