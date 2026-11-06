import { describe, expect, it } from 'vitest';
import { expenseSlices, formatShare } from '@/lib/expenseSlices';

const names = { alimentacion: 'Alimentación', transporte: 'Transporte', vivienda: 'Vivienda', salud: 'Salud', educacion: 'Educación', tecnologia: 'Tecnología', otros: 'Otros' };
const row = (category, total) => ({ category, total });

describe('expenseSlices', () => {
  it('muestra 4 categorías y junta el resto en Otras', () => {
    const slices = expenseSlices(
      [row('alimentacion', 50), row('transporte', 20), row('vivienda', 10), row('salud', 10), row('educacion', 5), row('tecnologia', 5)],
      names,
    );
    expect(slices.map((s) => s.name)).toEqual(['Alimentación', 'Transporte', 'Vivienda', 'Salud', 'Otras']);
    expect(slices.at(-1)).toMatchObject({ total: 10, share: 10, hue: null });
  });

  it('una sola categoría sobrante conserva su nombre', () => {
    const slices = expenseSlices([row('alimentacion', 90), row(null, 10)], names);
    expect(slices.map((s) => s.name)).toEqual(['Alimentación', 'Sin clasificar']);
  });

  it('Otros y sin clasificar nunca ocupan un lugar con color', () => {
    const slices = expenseSlices([row('otros', 80), row(null, 10), row('salud', 10)], names);
    expect(slices.map((s) => s.name)).toEqual(['Salud', 'Otras']);
    expect(slices[1]).toMatchObject({ total: 90, hue: null });
  });

  it('una categoría conserva su tono aunque cambie de posición', () => {
    const hue = (rows) => expenseSlices(rows, names).find((s) => s.key === 'salud').hue;
    expect(hue([row('salud', 90), row('transporte', 10)])).toBe(hue([row('transporte', 90), row('salud', 10)]));
  });

  it('dos categorías del mismo gráfico nunca comparten tono', () => {
    const rows = ['propia_a', 'propia_b', 'propia_c', 'propia_d'].map((key) => row(key, 10));
    const hues = expenseSlices(rows, {}).map((s) => s.hue);
    expect(new Set(hues).size).toBe(4);
  });

  it('sin gastos no hay partes, y los montos en cero no cuentan', () => {
    expect(expenseSlices([], names)).toEqual([]);
    expect(expenseSlices([row('salud', 0)], names)).toEqual([]);
  });
});

describe('formatShare', () => {
  it('redondea y no muestra 0 % en una parte pequeña', () => {
    expect(formatShare(37.6)).toBe('38 %');
    expect(formatShare(0.4)).toBe('<1 %');
  });
});
