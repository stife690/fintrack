import { describe, expect, it } from 'vitest';
import { syncPreview } from '@/components/cards/cardFormat';

describe('syncPreview', () => {
  const card = { limit: 3000000, used: 616000 };

  it('si el banco cobra de más avisa el gasto que se registrará', () => {
    expect(syncPreview(card, '2350000', (n) => `$${n}`)).toBe('Se registrará un gasto de $34000 en Cargos del banco.');
  });

  it('si no hay cobro de más solo corrige el cupo', () => {
    expect(syncPreview(card, '2384000', String)).toBe('Se corregirá el cupo sin registrar gasto.');
    expect(syncPreview(card, '2400000', String)).toBe('Se corregirá el cupo sin registrar gasto.');
  });

  it('sin un disponible válido no dice nada', () => {
    expect(syncPreview(card, '', String)).toBe('');
    expect(syncPreview(card, 'abc', String)).toBe('');
  });
});
