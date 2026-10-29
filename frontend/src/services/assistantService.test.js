import { describe, expect, it } from 'vitest';
import { MAX_MESSAGES, toConversation } from '@/services/assistantService';

const user = (text) => ({ role: 'user', text });
const assistant = (text) => ({ role: 'assistant', text });

describe('toConversation', () => {
  it('envía la conversación tal cual si es corta', () => {
    const messages = [user('hola'), assistant('¿En qué te ayudo?'), user('¿Voy bien?')];
    expect(toConversation(messages)).toEqual(messages);
  });

  it('solo envía los últimos mensajes que acepta la API', () => {
    const messages = Array.from({ length: 15 }, (_, i) => (i % 2 === 0 ? user(`p${i}`) : assistant(`r${i}`)));
    const sent = toConversation(messages);
    expect(sent.length).toBeLessThanOrEqual(MAX_MESSAGES);
    expect(sent.at(-1)).toEqual(user('p14'));
  });

  it('nunca empieza con una respuesta del asistente', () => {
    // Con 11 mensajes, el recorte deja una respuesta al principio: se quita.
    const messages = [user('p0'), ...Array.from({ length: 5 }, (_, i) => [assistant(`r${i}`), user(`p${i + 1}`)]).flat()];
    const sent = toConversation(messages);
    expect(sent[0].role).toBe('user');
    expect(sent.at(-1)).toEqual(user('p5'));
  });

  it('no envía campos de más', () => {
    expect(toConversation([{ role: 'user', text: 'hola', id: 7 }])).toEqual([user('hola')]);
  });
});
