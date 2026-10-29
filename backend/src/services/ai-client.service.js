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
 * @typedef {object} AiTool
 * @property {string} name Nombre que el modelo usa para pedirla.
 * @property {string} description Para qué sirve; el modelo decide con esto cuándo usarla.
 * @property {object} parameters Esquema JSON de sus argumentos.
 * @property {(args: object) => Promise<object>} run La ejecuta el servidor y devuelve datos.
 */

/** Vueltas máximas de herramientas por pregunta: evita bucles si el modelo pide sin parar. */
export const MAX_TOOL_STEPS = 4;

/**
 * Conversación con herramientas (Gemini): el modelo puede pedir datos que el servidor busca
 * (movimientos del usuario, TRM, tasas de CDT...) antes de responder, en vez de inventarlos.
 * El servidor ejecuta cada herramienta pedida, le devuelve el resultado y repite hasta que el
 * modelo responde con texto o se llega a `MAX_TOOL_STEPS`. Con Anthropic responde sin herramientas.
 *
 * @param {{ system: string, messages: ChatTurn[], tools: AiTool[], maxTokens?: number, temperature?: number }} request
 * @returns {Promise<{ text: string, toolsUsed: string[] }>} Respuesta final y herramientas usadas, en orden.
 * @throws {AppError} 503 `AI_UNAVAILABLE`.
 */
export async function chatWithTools({
  system,
  messages,
  tools,
  maxTokens = 1024,
  temperature = 0.4,
}) {
  const base = { system, messages, maxTokens, temperature, model: env.assistantModel };
  if (env.aiProvider !== 'gemini') return { text: await generate(base), toolsUsed: [] };

  const { url, headers, body } = buildGeminiRequest(base);
  body.tools = [
    {
      functionDeclarations: tools.map(({ name, description, parameters }) => ({
        name,
        description,
        parameters,
      })),
    },
  ];
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const toolsUsed = [];

  for (let step = 0; step <= MAX_TOOL_STEPS; step += 1) {
    // En la última vuelta ya no se ofrecen herramientas: el modelo debe responder con lo que tiene.
    if (step === MAX_TOOL_STEPS) delete body.tools;
    const data = await send(url, headers, body);
    const content = data.candidates?.[0]?.content;
    const calls = (content?.parts ?? []).filter((part) => part.functionCall);
    if (calls.length === 0) {
      const text = content?.parts
        ?.filter((part) => part.text)
        .map((part) => part.text)
        .join('');
      if (typeof text !== 'string' || !text) {
        console.error('Respuesta del proveedor de IA con formato inesperado');
        throw aiUnavailable();
      }
      return { text, toolsUsed };
    }
    // El turno del modelo va tal cual: Gemini exige recibir de vuelta su `thoughtSignature`.
    body.contents.push(content);
    const responses = [];
    for (const { functionCall } of calls) {
      toolsUsed.push(functionCall.name);
      const tool = byName.get(functionCall.name);
      let response;
      try {
        response = tool
          ? await tool.run(functionCall.args ?? {})
          : { error: 'Esa herramienta no existe' };
      } catch (err) {
        console.error('Falló la herramienta', functionCall.name, err.message);
        response = { error: 'El dato no está disponible en este momento' };
      }
      responses.push({
        functionResponse: {
          name: functionCall.name,
          ...(functionCall.id && { id: functionCall.id }),
          response,
        },
      });
    }
    body.contents.push({ role: 'user', parts: responses });
  }
  throw aiUnavailable();
}

/**
 * Hace la petición al proveedor con un reintento ante fallos transitorios y devuelve el texto.
 * @param {AiRequest} request
 * @returns {Promise<string>}
 * @throws {AppError} 503 `AI_UNAVAILABLE`.
 */
async function generate(request) {
  const build = env.aiProvider === 'anthropic' ? buildAnthropicRequest : buildGeminiRequest;
  const { url, headers, body, readText } = build(request);
  const data = await send(url, headers, body);
  try {
    const text = readText(data);
    if (typeof text !== 'string') throw new Error('sin texto');
    return text;
  } catch {
    console.error('Respuesta del proveedor de IA con formato inesperado');
    throw aiUnavailable();
  }
}

/**
 * Envía el cuerpo al proveedor y devuelve su JSON. Arquitectura de IA §4: un (1) reintento
 * automático ante un fallo transitorio (error de red, tiempo agotado o 5xx del proveedor).
 * @param {string} url
 * @param {Record<string, string>} headers
 * @param {object} body
 * @returns {Promise<object>}
 * @throws {AppError} 503 `AI_UNAVAILABLE`.
 */
async function send(url, headers, body) {
  if (!env.aiApiKey) {
    console.error('IA desactivada: falta AI_API_KEY en backend/.env');
    throw aiUnavailable();
  }
  const post = () =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(env.aiTimeoutMs),
    });

  let response;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      response = await post();
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
    return await response.json();
  } catch {
    console.error('Respuesta del proveedor de IA con formato inesperado');
    throw aiUnavailable();
  }
}
