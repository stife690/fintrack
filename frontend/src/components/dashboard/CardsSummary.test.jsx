import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import CardsSummary from '@/components/dashboard/CardsSummary';

const render = (cards, hidden = false) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <CardsSummary cards={cards} hidden={hidden} />
    </MemoryRouter>,
  );

const two = [
  { used: 616000, daysToPayment: 5, paidThisCycle: false },
  { used: 100000, daysToPayment: 9, paidThisCycle: false },
];

describe('CardsSummary', () => {
  it('sin tarjetas no renderiza nada', () => {
    expect(render([])).toBe('');
    expect(render(undefined)).toBe('');
  });

  it('suma lo usado, usa el pago más cercano y enlaza a Tarjetas', () => {
    const html = render(two);
    expect(html).toMatch(/Debes .*716\.000.* en tarjetas/);
    expect(html).toContain('próximo pago en 5 días');
    expect(html).toContain('href="/app/tarjetas"');
  });

  it('ignora las pagadas al buscar el próximo pago y dice hoy/mañana', () => {
    const paid = { used: 1, daysToPayment: 0, paidThisCycle: true };
    expect(render([paid, { ...two[0], daysToPayment: 1 }])).toContain('próximo pago mañana');
    expect(render([{ ...two[0], daysToPayment: 0 }])).toContain('próximo pago hoy');
  });

  it('con un pago atrasado lo dice en vez de los días', () => {
    expect(render([{ ...two[0], daysToPayment: -2 }, two[1]])).toContain('tienes un pago atrasado');
  });

  it('con todas pagadas lo indica', () => {
    expect(render([{ ...two[0], paidThisCycle: true }])).toContain('todas pagadas este mes');
  });

  it('con montos ocultos muestra la máscara', () => {
    const html = render(two, true);
    expect(html).toContain('$ ••••••');
    expect(html).not.toContain('716.000');
  });
});
