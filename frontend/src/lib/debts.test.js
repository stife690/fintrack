import { describe, expect, it } from 'vitest';
import { dueText } from '@/lib/debts';

describe('dueText', () => {
  const today = '2026-11-04';

  it('sin fecha no dice nada', () => {
    expect(dueText(null, today)).toBeNull();
  });

  it('cerca de hoy usa palabras', () => {
    expect(dueText('2026-11-04', today)).toEqual({
      text: 'Vence hoy',
      late: false,
    });
    expect(dueText('2026-11-05', today)).toEqual({
      text: 'Vence mañana',
      late: false,
    });
    expect(dueText('2026-11-09', today)).toEqual({
      text: 'Vence en 5 días',
      late: false,
    });
    expect(dueText('2026-11-03', today)).toEqual({
      text: 'Venció ayer',
      late: true,
    });
    expect(dueText('2026-10-30', today)).toEqual({
      text: 'Venció hace 5 días',
      late: true,
    });
  });

  it('lejos muestra la fecha, con año solo si no es el actual', () => {
    expect(dueText('2026-12-15', today).text).toMatch(/^Vence el 15 dic$/);
    expect(dueText('2027-01-20', today).text).toMatch(/^Vence el 20 ene 2027$/);
  });
});
