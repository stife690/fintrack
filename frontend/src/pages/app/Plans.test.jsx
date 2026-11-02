import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Plans, { PRO_MONTHLY, PRO_YEARLY, formatPrice, yearlySavings } from '@/pages/app/Plans';

describe('Plans', () => {
  it('escribe los precios sin decimales', () => {
    expect(formatPrice(PRO_MONTHLY)).toBe('$ 9.000');
    expect(formatPrice(PRO_YEARLY)).toBe('$ 79.000');
  });

  it('calcula el ahorro del pago anual', () => {
    expect(yearlySavings(PRO_MONTHLY, PRO_YEARLY)).toBe(27);
  });

  it('avisa que no se cobra y no tiene acciones de pago', () => {
    const html = renderToStaticMarkup(<Plans />);
    expect(html).toContain('aún no se cobra');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<a ');
  });
});
