import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

/** @returns {AppError} 503: el proveedor de IA no está disponible. */
function aiUnavailable() {
  return new AppError(503, 'AI_UNAVAILABLE', 'El servicio de IA no está disponible');
}

/**
 * @typedef {object} ChatTurn
 * @property {'user'|'assistant'} role Quién habló.
 * @property {string} text Lo que dijo.
 */

/**
 * @typedef {object} AiRequest
 * @property {string} system Instrucciones del sistema.
 * @property {ChatTurn[]} messages Conversación, del más antiguo al más reciente.
 * @property {number} maxTokens Tope de la respuesta.
 * @property {number} temperature 0 para respuestas estables; más alto suena más natural.
 * @property {string} model Modelo del proveedor.
 */

/**
 * Arma la petición HTTP para Gemini (`generateContent`). La clave va en una cabecera,
 * nunca en la URL, para que no quede en logs ni en historiales.
 * @param {AiRequest} request
 * @returns {{ url: string, headers: Record<string, string>, body: object, readText: (data: object) => unknown }}
 */
function buildGeminiRequest({ system, messages, maxTokens, temperature, model }) {
  // Margen de sobra para modelos que razonan antes de responder. No se envía `thinkingConfig`:
  // los modelos "lite" lo rechazan con 400 y su formato cambia entre versiones.
  const generationConfig = { maxOutputTokens: Math.max(maxTokens, 256), temperature };
  return {
    url:
      env.aiApiUrl ??
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    headers: { 'x-goog-api-key': env.aiApiKey },
    body: {
      systemInstruction: { parts: [{ text: system }] },
      // Gemini llama "model" a los turnos de la IA.
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text }],
      })),
      generationConfig,
    },
    readText: (data) => data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text,
  };
}

/**
 * Arma la petición HTTP para la API de mensajes de Anthropic (proveedor alternativo).
 * @param {AiRequest} request
 * @returns {{ url: string, headers: Record<string, string>, body: object, readText: (data: object) => unknown }}
 */
function buildAnthropicRequest({ system, messages, maxTokens, temperature, model }) {
  return {
    url: env.aiApiUrl ?? 'https://api.anthropic.com/v1/messages',
    headers: { 'x-api-key': env.aiApiKey, 'anthropic-version': '2023-06-01' },
    body: {
      model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.text })),
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
export function completeText({ system, prompt, maxTokens = 64 }) {
  return generate({
    system,
    messages: [{ role: 'user', text: prompt }],
    maxTokens,
    temperature: 0,
    model: env.aiModel,
  });
}

/**
 * Como `completeText`, pero con una conversación de varios turnos (asistente financiero). Usa su
 * propio modelo (`ASSISTANT_MODEL`) para no gastar la cuota de la categorización.
 *
 * @param {{ system: string, messages: ChatTurn[], maxTokens?: number, temperature?: number }} request
 * @returns {Promise<string>} Respuesta del modelo al último mensaje.
 * @throws {AppError} 503 `AI_UNAVAILABLE`.
 */
export function chatText({ system, messages, maxTokens = 1024, temperature = 0.4 }) {
  return generate({ system, messages, maxTokens, temperature, model: env.assistantModel });
}

/**
 * Hace la petición al proveedor con un reintento ante fallos transitorios.
 * @param {AiRequest} request
 * @returns {Promise<string>}
 * @throws {AppError} 503 `AI_UNAVAILABLE`.
 */
async function generate(request) {
  if (!env.aiApiKey) {
    console.error('IA desactivada: falta AI_API_KEY en backend/.env');
    throw aiUnavailable();
  }

  const build = env.aiProvider === 'anthropic' ? buildAnthropicRequest : buildGeminiRequest;
  const { url, headers, body, readText } = build(request);

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
