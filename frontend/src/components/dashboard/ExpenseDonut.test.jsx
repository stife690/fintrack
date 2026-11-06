import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import ExpenseDonut from '@/components/dashboard/ExpenseDonut';

const expense = { total: 100000, byCategory: [{ category: 'salud', total: 60000 }, { category: 'ocio', total: 40000 }] };
const render = (props) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <ExpenseDonut names={{ salud: 'Salud', ocio: 'Ocio' }} hidden={false} periodLabel="noviembre" {...props} />
    </MemoryRouter>,
  );

describe('ExpenseDonut', () => {
  it('muestra el total y el peso de cada categoría, y lleva a Gastos', () => {
    const html = render({ expense });
    expect(html).toContain('100.000');
    expect(html).toContain('60 %');
    expect(html).toContain('href="/app/gastos"');
  });

  it('con montos ocultos conserva los porcentajes y no deja ver la plata', () => {
    const html = render({ expense, hidden: true, large: true });
    expect(html).toContain('60 %');
    expect(html).not.toContain('100.000');
    expect(html).not.toContain('60.000');
  });

  it('sin gastos lo dice en vez de dibujar una dona vacía', () => {
    expect(render({ expense: { total: 0, byCategory: [] } })).toContain('Aún no hay gastos en noviembre');
  });

  it('mientras carga no muestra datos', () => {
    expect(render({ expense: undefined })).toContain('aria-busy="true"');
  });
});
