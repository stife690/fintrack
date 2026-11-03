import { describe, expect, it } from 'vitest';
import { CARD_STYLES, TIERS, cardLabel, contrastRatio } from './cardStyles';

describe('cardStyles', () => {
  it('cardLabel junta franquicia y nivel', () => {
    expect(cardLabel('amex', 'blue')).toBe('Amex Blue');
    expect(cardLabel('visa', 'clasica')).toBe('Visa Clásica');
  });

  it('cada combinación de TIERS tiene estilo con contraste AA (>= 4.5)', () => {
    for (const [network, tiers] of Object.entries(TIERS)) {
      for (const tier of tiers) {
        const s = CARD_STYLES[network][tier];
        expect(s.background).toContain('gradient');
        expect(contrastRatio(s.foreground, s.dominant), `${network} ${tier}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
