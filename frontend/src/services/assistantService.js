/**
 * Capa del asistente financiero (chat de Insights), según `docs/api/openapi.yaml`.
 * Llama a `POST /api/v1/assistant/chat`. La conversación vive en la pantalla: no se guarda.
 */
import { apiRequest } from '@/lib/apiRequest';

/** Mensajes que acepta la API: los últimos de la conversación. */
export const MAX_MESSAGES = 10;

/** Largo máximo de una pregunta, igual que en la API. */
export const MAX_QUESTION_CHARS = 500;

/**
 * @typedef {object} ChatMessage
 * @property {'user'|'assistant'} role Quién habló.
 * @property {string} text Lo que dijo.
 */

/**
 * Recorta la conversación a lo que acepta la API: los últimos `MAX_MESSAGES` mensajes, empezando
 * por una pregunta del usuario (la IA no entiende una conversación que arranca con su respuesta).
 * @param {ChatMessage[]} messages Del más antiguo al más reciente; el último es la pregunta nueva.
 * @returns {ChatMessage[]}
 */
export function toConversation(messages) {
  const recent = messages.slice(-MAX_MESSAGES).map(({ role, text }) => ({ role, text }));
  const firstQuestion = recent.findIndex((m) => m.role === 'user');
  return firstQuestion === -1 ? [] : recent.slice(firstQuestion);
}

/**
 * Pregunta al asistente. Los errores traen `code`: `AI_UNAVAILABLE` (la IA no respondió),
 * o `RATE_LIMITED` (límite por minuto o diario); sin conexión, el mensaje de conexión de `apiRequest`.
 * @param {ChatMessage[]} messages Conversación completa; se envían los últimos mensajes.
 * @returns {Promise<{ reply: string, toolsUsed: string[] }>} Respuesta y herramientas que consultó el asistente.
 */
export async function askAssistant(messages) {
  const { reply, toolsUsed = [] } = await apiRequest('/assistant/chat', {
    method: 'POST',
    body: { messages: toConversation(messages) },
  });
  return { reply, toolsUsed };
}

/** Cómo se llama, para la persona, cada fuente que puede consultar el asistente. */
const SOURCES = {
  resumen_de_movimientos: 'Tus movimientos',
  ahorro_promedio: 'Tu ahorro promedio',
  dolar_hoy: 'TRM · Superfinanciera',
  tasas_cdt: 'Tasas de CDT · Superfinanciera',
  simular_cdt: 'Simulador de CDT',
};

/**
 * Nombres legibles de las fuentes consultadas, sin repetir y en el orden en que se usaron.
 * @param {string[]} toolsUsed
 * @returns {string[]}
 */
export function sourceLabels(toolsUsed) {
  return [...new Set(toolsUsed.map((name) => SOURCES[name]).filter(Boolean))];
}
