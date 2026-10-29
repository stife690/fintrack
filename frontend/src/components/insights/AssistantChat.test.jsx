import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AssistantChat, { SUGGESTIONS } from '@/components/insights/AssistantChat';

describe('AssistantChat', () => {
  let html;
  // `useOnlineStatus` lee `navigator.onLine`; Node 20 (el del CI) no trae `navigator`.
  beforeAll(() => {
    vi.stubGlobal('navigator', { onLine: true });
    html = renderToStaticMarkup(<AssistantChat />);
  });
  afterAll(() => vi.unstubAllGlobals());

  it('sin conversación muestra las preguntas sugeridas', () => {
    for (const suggestion of SUGGESTIONS) expect(html).toContain(suggestion);
  });

  it('avisa que es orientación y que no se escriban datos sensibles', () => {
    expect(html).toContain('no asesoría financiera');
    expect(html).toContain('No escribas cédulas ni números de cuenta');
  });

  it('anuncia las respuestas nuevas a los lectores de pantalla', () => {
    expect(html).toContain('role="log"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-label="Escribe tu pregunta"');
  });
});
