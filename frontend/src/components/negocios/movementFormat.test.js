import { describe, expect, it } from 'vitest';
import { changeText, monthLabel, shiftMonth } from '@/components/negocios/movementFormat';

describe('movementFormat', () => {
  it('shiftMonth cruza años', () => {
    expect(shiftMonth('2026-11', 1)).toBe('2026-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('monthLabel muestra el año solo si no es el actual', () => {
    expect(monthLabel('2026-11', '2026-11')).toBe('noviembre');
    expect(monthLabel('2025-12', '2026-11')).toBe('diciembre 2025');
  });

  it('changeText describe el cambio', () => {
    expect(changeText(12.5, 'octubre')).toBe('+12,5 % que octubre');
    expect(changeText(-30, 'octubre')).toBe('−30 % que octubre');
    expect(changeText(0, 'octubre')).toBe('Igual que octubre');
    expect(changeText(null, 'octubre')).toBeNull();
  });
});
