import { AppError } from '../errors/app-error.js';

/** Mensajes que se envían a la IA: los últimos de la conversación (la memoria del chat). */
export const MAX_MESSAGES = 10;

/** Largo máximo de cada mensaje, en caracteres. */
export const MAX_MESSAGE_CHARS = 500;

const ROLES = ['user', 'assistant'];

/**
 * Valida `POST /assistant/chat`: `{ messages: [{ role, text }] }`, del más antiguo al más
 * reciente, terminando en una pregunta del usuario.
 * @param {unknown} body
 * @returns {{ messages: Array<{ role: 'user'|'assistant', text: string }> }} Textos sin espacios sobrantes.
 * @throws {AppError} 400 si el cuerpo no es un objeto; 422 con el detalle si la conversación no es válida.
 */
export function parseChat(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
  }
  const { messages } = body;
  const invalid = (problem) =>
    new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [{ field: 'messages', problem }]);

  if (!Array.isArray(messages) || messages.length === 0) {
    throw invalid('Envía al menos una pregunta');
  }
  if (messages.length > MAX_MESSAGES) {
    throw invalid(`Envía como máximo los últimos ${MAX_MESSAGES} mensajes`);
  }
  const clean = messages.map((m) => ({
    role: m?.role,
    text: typeof m?.text === 'string' ? m.text.trim() : '',
  }));
  if (clean.some((m) => !ROLES.includes(m.role) || !m.text)) {
    throw invalid('Cada mensaje necesita "role" (user o assistant) y un "text" con contenido');
  }
  if (clean.some((m) => m.text.length > MAX_MESSAGE_CHARS)) {
    throw invalid(`Cada mensaje puede tener hasta ${MAX_MESSAGE_CHARS} caracteres`);
  }
  if (clean.at(-1).role !== 'user') {
    throw invalid('El último mensaje debe ser una pregunta del usuario');
  }
  return { messages: clean };
}
