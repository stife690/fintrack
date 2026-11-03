import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import BalanceCard from '@/components/dashboard/BalanceCard';

const render = (totals, hidden = false) =>
  renderToStaticMarkup(
    <BalanceCard periodLabel="noviembre" totals={totals} hidden={hidden} onToggleHidden={() => {}} />,
  );

describe('BalanceCard: el ahorro se resta aparte', () => {
  it('con ahorro, dice cuánto se apartó y no lo suma a los gastos', () => {
    const html = render({ income: 3200000, expense: 55600, savings: 200000, balance: 2944400 });
    expect(html).toContain('menos lo que has gastado y lo que apartaste para ahorro');
    expect(html).toContain('Ahorro');
    expect(html).toMatch(/200\.000/);
  });

  it('sin ahorro, el texto y las tarjetas quedan como antes', () => {
    const html = render({ income: 3200000, expense: 55600, savings: 0, balance: 3144400 });
    expect(html).toContain('Lo que te ha entrado menos lo que has gastado.');
    expect(html).not.toContain('Ahorro');
  });

  it('con los montos ocultos, el ahorro también se oculta', () => {
    const html = render({ income: 3200000, expense: 55600, savings: 200000, balance: 2944400 }, true);
    expect(html).not.toMatch(/200\.000/);
  });
});
