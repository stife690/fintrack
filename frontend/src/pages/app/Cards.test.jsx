import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CardsList } from '@/pages/app/Cards';

const card = { id: 7, name: 'Mi Visa', network: 'visa', tier: 'gold', last4: '1234', limit: 3000000, used: 616000, available: 2384000, paymentDay: 15, daysToPayment: 5, nextPaymentDate: '2026-11-15', paidThisCycle: false };
const render = (props) =>
  renderToStaticMarkup(<MemoryRouter><CardsList cards={[]} online hidden={false} onAdd={() => {}} {...props} /></MemoryRouter>).replace(/&nbsp;| /g, ' ');

describe('Cards', () => {
  it('lista vacía: invita a agregar la primera', () => {
    expect(render()).toContain('Agregar mi primera tarjeta');
  });

  it('con una tarjeta: uso, disponible y días para pagar', () => {
    const html = render({ cards: [card] }).replace(/\$ /g, '$');
    expect(html).toContain('Usado $616.000 de $3.000.000');
    expect(html).toContain('Pagas en 5 días (15 nov)');
    expect(html).toContain('href="/app/tarjetas/7"');
  });

  it('oculta los montos con el ojo cerrado', () => {
    expect(render({ cards: [card], hidden: true })).not.toContain('616');
  });

  it('sin conexión: botón deshabilitado y "Necesitas conexión"', () => {
    const html = render({ online: false });
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Agregar mi primera tarjeta/);
    expect(html).toContain('Necesitas conexión');
  });
});
