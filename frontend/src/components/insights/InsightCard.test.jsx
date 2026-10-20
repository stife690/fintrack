import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import InsightCard from '@/components/insights/InsightCard';

const render = (type) =>
  renderToStaticMarkup(<InsightCard insight={{ type, title: 'Título', detail: 'Detalle con cifras' }} />);

describe('InsightCard (FT-0007)', () => {
  it.each([
    ['saving_opportunity', 'Oportunidad de ahorro'],
    ['overspending_alert', 'Ojo con este gasto'],
    ['positive_trend', 'Buena tendencia'],
    ['general_tip', 'Consejo'],
  ])('tipo %s muestra su etiqueta', (type, label) => {
    const html = render(type);
    expect(html).toContain(label);
    expect(html).toContain('Título');
    expect(html).toContain('Detalle con cifras');
  });

  it('un tipo desconocido se muestra como consejo general', () => {
    expect(render('inventado')).toContain('Consejo');
  });
});
