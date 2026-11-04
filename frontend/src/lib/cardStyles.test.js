import { describe, expect, it } from 'vitest';
import { CARD_STYLES, TIERS, cardLabel, contrastRatio } from './cardStyles';

describe('cardStyles', () => {
  it('cardLabel junta franquicia y nivel', () => {
    expect(cardLabel('amex', 'blue')).toBe('Amex Blue');
    expect(cardLabel('visa', 'clasica')).toBe('Visa Clásica');
  });

  it('cada combinación de TIERS tiene estilo y el texto cumple AA (>= 4.5) en cada color del degradado', () => {
    for (const [network, tiers] of Object.entries(TIERS)) {
      for (const tier of tiers) {
        const s = CARD_STYLES[network][tier];
        expect(s.background).toContain('gradient');
        for (const stop of s.stops) {
          expect(contrastRatio(s.foreground, stop), `${network} ${tier} ${stop}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});
