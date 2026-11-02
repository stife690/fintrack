import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { BudgetAlert } from '@/components/dashboard/BudgetOverview';

const names = { vivienda: 'Vivienda', transporte: 'Transporte' };
const budget = (category, level, percentage) => ({ category, percentage, alert: { level, percentage } });
const render = (budgets) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <BudgetAlert budgets={budgets} names={names} />
    </MemoryRouter>,
  );

describe('BudgetAlert del inicio', () => {
  it('gastar exactamente el límite no se muestra como pasarse', () => {
    const html = render([budget('vivienda', 'exceeded_100', 100)]);
    expect(html).toContain('Ya usaste todo tu presupuesto de Vivienda.');
    expect(html).not.toContain('Te pasaste');
    expect(html).toContain('bg-caution/10');
  });

  it('por encima del límite sí avisa que se pasó', () => {
    const html = render([budget('vivienda', 'exceeded_100', 120)]);
    expect(html).toContain('Te pasaste del presupuesto de Vivienda.');
    expect(html).toContain('bg-negative/10');
  });

  it('si hay de los dos, avisa primero el que se pasó', () => {
    const html = render([budget('vivienda', 'exceeded_100', 100), budget('transporte', 'exceeded_100', 120)]);
    expect(html).toContain('Te pasaste del presupuesto de Transporte.');
  });

  it('sin alertas no muestra nada', () => {
    expect(render([budget('vivienda', 'none', 20)])).toBe('');
  });
});
