import { describe, expect, it } from 'vitest';
import { buildMonthHighlights } from '@/components/insights/highlights';

const names = { alimentacion: 'Alimentación', transporte: 'Transporte' };
const summary = (income, expenses) => ({
  income: { total: income, byCategory: [] },
  expense: {
    total: expenses.reduce((a, e) => a + e.total, 0),
    byCategory: expenses,
  },
});
const food = { category: 'alimentacion', total: 425000, percentage: 55.4 };
const budget = (percentage, consumed, amount) => ({ category: 'alimentacion', percentage, consumed, amount });
// El formato de moneda depende del sistema (espacios, separadores): se compara sin espacios raros.
const plain = (text) => text.replace(/\s/g, ' ');

describe('buildMonthHighlights', () => {
  it('sin movimientos no muestra nada', () => {
    expect(buildMonthHighlights({ summary: summary(0, []), budgets: [], names })).toEqual([]);
  });

  it('muestra el presupuesto más cerca del límite, el mayor gasto y lo que queda', () => {
    const highlights = buildMonthHighlights({
      summary: summary(1_500_000, [food, { category: 'transporte', total: 210000, percentage: 27 }]),
      budgets: [budget(40, 80000, 200000), budget(85, 437000, 500000)],
      names,
    });
    expect(highlights.map((h) => [h.kind, h.tone])).toEqual([
      ['budget', 'caution'],
      ['top', 'neutral'],
      ['balance', 'positive'],
    ]);
    expect(highlights[0].title).toBe('Alimentación va al 85 %');
    expect(plain(highlights[0].detail)).toMatch(/Te quedan \$ ?63\.000/);
    expect(highlights[1].title).toBe('Tu mayor gasto: Alimentación');
    expect(highlights[1].detail).toMatch(/el 55 % de tus gastos/);
    expect(plain(highlights[2].title)).toMatch(/Te quedan \$ ?865\.000/);
  });

  it('avisa si se pasó del presupuesto o si gastó más de lo que entró', () => {
    const [over, , balance] = buildMonthHighlights({
      summary: summary(100000, [food]),
      budgets: [budget(106, 530000, 500000)],
      names,
    });
    expect(over).toMatchObject({ tone: 'negative', title: 'Te pasaste en Alimentación' });
    expect(balance).toMatchObject({ tone: 'negative', title: 'Gastaste más de lo que entró' });
  });

  it('justo en el límite dice que lo usó todo, no que se pasó', () => {
    const [limit] = buildMonthHighlights({
      summary: summary(100000, [food]),
      budgets: [budget(100, 300000, 300000)],
      names,
    });
    expect(limit).toMatchObject({ tone: 'caution', title: 'Ya usaste todo tu presupuesto de Alimentación' });
  });

  it('presupuestos holgados se muestran en positivo', () => {
    const [first] = buildMonthHighlights({ summary: summary(0, [food]), budgets: [budget(40, 80000, 200000)], names });
    expect(first).toMatchObject({ tone: 'positive', title: 'Tus presupuestos van bien' });
  });

  it('sin presupuestos ni ingresos muestra el mayor gasto y lo gastado', () => {
    const highlights = buildMonthHighlights({ summary: summary(0, [food]), budgets: [], names });
    expect(highlights.map((h) => h.kind)).toEqual(['top', 'balance']);
    expect(highlights[1].detail).toBe('Registra tus ingresos para ver cuánto te queda');
  });
});
