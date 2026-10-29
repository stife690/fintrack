import { describe, expect, it } from 'vitest';
import { describePart, formatNumber, projectionMessage, smallExpensesMessage } from '@/components/insights/analytics';

// Según la versión de ICU, Node escribe los pesos con o sin ",00": se quitan para comparar.
const money = (text) => text.replace(/\s/g, ' ').replace(/,00/g, '');

describe('projectionMessage', () => {
  it('los primeros días explica desde cuándo hay proyección', () => {
    expect(projectionMessage({ available: false })).toMatch(/día 3/);
  });

  it('dice si sobra o falta frente a los ingresos', () => {
    const base = { available: true, projected: 2000000, expectedIncome: 2500000 };
    expect(money(projectionMessage({ ...base, balance: 500000 }))).toMatch(/te sobrarían \$ 500\.000/);
    expect(money(projectionMessage({ ...base, balance: -300000 }))).toMatch(/te faltarían \$ 300\.000/);
  });
});

describe('smallExpensesMessage', () => {
  const base = { threshold: 20000, total: 90000, share: 6, yearly: 1080000 };
  it('sin gastos pequeños o con pocos no alarma', () => {
    expect(smallExpensesMessage({ ...base, count: 0, flagged: false })).toMatch(/no tienes gastos/);
    expect(smallExpensesMessage({ ...base, count: 2, flagged: false })).toMatch(/vas bien/);
  });

  it('con 5 o más muestra el total, el porcentaje y el año', () => {
    const text = money(smallExpensesMessage({ ...base, count: 9, flagged: true }));
    expect(text).toMatch(/9 gastos de \$ 20\.000 o menos suman \$ 90\.000 \(6 %/);
    expect(text).toMatch(/\$ 1\.080\.000 en un año/);
  });
});

describe('describePart', () => {
  it('explica cada parte del puntaje, también sin datos', () => {
    expect(describePart({ key: 'savings', value: 12 }).detail).toBe('Ahorras el 12 % de tus ingresos');
    expect(describePart({ key: 'budgets', value: null }).detail).toMatch(/Crea presupuestos/);
    expect(describePart({ key: 'stability', value: -8 }).detail).toBe('Gastas 8 % menos que tu promedio');
    expect(describePart({ key: 'small_expenses', value: 4 }).label).toBe('Gastos hormiga');
  });
});

describe('formatNumber', () => {
  it('usa coma decimal y a lo sumo un decimal', () => {
    expect(formatNumber(17.5)).toBe('17,5');
    expect(formatNumber(12.345)).toBe('12,3');
    expect(formatNumber(25)).toBe('25');
  });
});
