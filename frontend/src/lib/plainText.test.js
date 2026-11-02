import { describe, expect, it } from 'vitest';
import { plainText } from '@/lib/plainText';

describe('plainText', () => {
  it('quita mayúsculas y tildes, pero conserva la ñ', () => {
    expect(plainText('Café Nómina')).toBe('cafe nomina');
    expect(plainText('PIÑA')).toBe('piña');
  });
});
