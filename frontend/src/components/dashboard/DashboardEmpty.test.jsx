import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import DashboardEmpty from '@/components/dashboard/DashboardEmpty';

const render = () =>
  renderToStaticMarkup(
    <MemoryRouter>
      <DashboardEmpty />
    </MemoryRouter>,
  );

describe('DashboardEmpty (FT-0004)', () => {
  it('invita a registrar el primer movimiento', () => {
    const html = render();
    expect(html).toContain('Registra tu primer movimiento');
    expect(html).toContain('Aún no tienes gastos ni ingresos');
  });

  it('lleva al formulario con el tipo ya elegido', () => {
    const html = render();
    expect(html).toContain('href="/app/transacciones?nuevo=gasto"');
    expect(html).toContain('href="/app/transacciones?nuevo=ingreso"');
  });

  it('anticipa lo que verá el usuario: balance, categorías y presupuestos', () => {
    const html = render();
    for (const title of ['Tu balance', 'En qué gastas', 'Tus límites']) expect(html).toContain(title);
  });
});
