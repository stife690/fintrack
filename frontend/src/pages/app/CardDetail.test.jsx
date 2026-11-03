import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import PayCardForm from '@/components/cards/PayCardForm';
import { CardDetailView } from '@/pages/app/CardDetail';

const card = { id: 7, name: 'Mi Visa', network: 'visa', tier: 'gold', last4: '1234', limit: 3000000, used: 616000, available: 2384000, paymentDay: 15, daysToPayment: 5, nextPaymentDate: '2026-11-15', paidThisCycle: false, statementTotal: null, statementDueDate: null };
const movements = [
  { kind: 'purchase', id: 1, date: '2026-10-20', amount: 600000, description: 'Nevera', installments: 12 },
  { kind: 'payment', id: 2, date: '2026-10-25', amount: 100000 },
  { kind: 'adjustment', id: 3, date: '2026-10-26', amount: -34000 },
];
const noop = () => {};
const render = (props) =>
  renderToStaticMarkup(
    <MemoryRouter><CardDetailView card={card} movements={movements} online hidden={false} onAction={noop} onDelete={noop} {...props} /></MemoryRouter>,
  ).replace(/&nbsp;|[  ]/g, ' ').replace(/\$ /g, '$');

describe('CardDetail', () => {
  it('muestra las acciones y el uso', () => {
    const html = render();
    for (const t of ['Ya pagué', 'Actualizar con el banco', 'Editar', 'Eliminar', 'Usado $616.000', 'Disponible $2.384.000', 'Pagas en 5 días (15 nov)']) expect(html).toContain(t);
  });

  it('compra a cuotas: "*" y la nota exacta', () => {
    const html = render();
    expect(html).toContain('a 12 cuotas');
    expect(html).toContain('Los intereses los calcula tu banco a la fecha de corte.');
  });

  it('ajuste negativo: "Ajuste con el banco −$34.000"', () => {
    expect(render()).toContain('Ajuste con el banco −$34.000');
  });

  it('muestra el extracto cuando existe y respeta el ojo', () => {
    expect(render({ card: { ...card, statementTotal: 700000, statementDueDate: '2026-11-15' } })).toContain('$700.000');
    expect(render({ hidden: true })).not.toContain('616');
  });

  it('sin conexión: acciones deshabilitadas y aviso', () => {
    const html = render({ online: false });
    expect(html).toMatch(/<button[^>]*disabled[^>]*>(<svg.*?<\/svg>)? ?Ya pagué/);
    expect(html).toContain('Necesitas conexión');
  });
});

describe('PayCardForm', () => {
  it('sugiere el monto indicado', () => {
    expect(renderToStaticMarkup(<PayCardForm suggested={700000} onSubmit={noop} />)).toContain('700.000');
  });
});
