import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import BudgetAlert from '@/components/transactions/BudgetAlert';

const render = (alert, categoryName) =>
  renderToStaticMarkup(<BudgetAlert alert={alert} categoryName={categoryName} />);

describe('BudgetAlert (FT-0006)', () => {
  it('escenario 80 %: muestra la advertencia con el porcentaje y la categoría', () => {
    const html = render({ level: 'warning_80', percentage: 85 }, 'Alimentación');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Cerca del límite');
    expect(html).toContain('85 %');
    expect(html).toContain('Alimentación');
    expect(html).toContain('text-caution');
  });

  it('escenario 100 %: muestra que el presupuesto se superó, en rojo', () => {
    const html = render({ level: 'exceeded_100', percentage: 106.25 }, 'Transporte');
    expect(html).toContain('Presupuesto superado');
    expect(html).toContain('106,25 %');
    expect(html).toContain('text-negative');
  });

  it('exactamente en el límite (100 %) también es "superado"', () => {
    expect(render({ level: 'exceeded_100', percentage: 100 })).toContain('Presupuesto superado');
  });

  it('sin nombre de categoría no deja un hueco en el texto', () => {
    const html = render({ level: 'warning_80', percentage: 80 });
    expect(html).toContain('del presupuesto de este mes');
  });

  it('no muestra nada si el presupuesto está bien (none)', () => {
    expect(render({ level: 'none', percentage: 20 })).toBe('');
  });

  it('no muestra nada si no hay alerta (gasto sin presupuesto o ingreso)', () => {
    expect(render(null)).toBe('');
    expect(render(undefined)).toBe('');
  });

  it('ignora un nivel desconocido en vez de fallar', () => {
    expect(render({ level: 'otro', percentage: 50 })).toBe('');
  });
});
