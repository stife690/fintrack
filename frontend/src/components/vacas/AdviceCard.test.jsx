import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/services/vacaService', () => ({ getAdvice: vi.fn() }));
vi.mock('@/components/vacas/vacaFormat', () => ({ projectionText: () => ({ text: '', tone: 'neutral' }) }));

const { default: AdviceCard } = await import('@/components/vacas/AdviceCard');

const me = { isMe: true, remaining: 600000, status: 'le_falta' };
const render = (members) =>
  renderToStaticMarkup(
    <AdviceCard vaca={{ id: 'v1', total: 0, role: 'admin', status: 'activa', members }} online={false} onRemind={vi.fn()} />,
  );

describe('AdviceCard: recordatorio a los demás miembros', () => {
  it('sin más miembros no dice que "todos van al día"', () => {
    const html = render([me]);
    expect(html).not.toContain('Todos van al día');
    expect(html).toContain('Aún no hay más miembros');
  });

  it('con otros miembros al día lo dice de los demás, no de todos', () => {
    const html = render([me, { isMe: false, remaining: 0, status: 'cumplio' }]);
    expect(html).toContain('Los demás van al día o ya cumplieron.');
  });

  it('con alguien atrasado ofrece el botón de recordar', () => {
    const html = render([me, { isMe: false, remaining: 300000, status: 'atrasado' }]);
    expect(html).toContain('Recordar a quienes les falta');
  });
});
