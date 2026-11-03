import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CreditCardArt from './CreditCardArt';

describe('CreditCardArt', () => {
  it('muestra solo los últimos 4 y el aria-label', () => {
    const html = renderToStaticMarkup(<CreditCardArt network="amex" tier="blue" last4="1234" name="Mi Amex" />);
    expect(html).toContain('•••• 1234');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Amex Blue terminada en 1234"');
    expect(html).toContain('motion-safe:');
  });
});
