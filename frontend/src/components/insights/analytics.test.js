import { describe, expect, it } from 'vitest';
import {
  dailyAllowance,
  describePart,
  formatNumber,
  nextAction,
  paceSeries,
  projectionMessage,
  savingsDetail,
  scoreChange,
  smallExpensesMessage,
} from '@/components/insights/analytics';

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

describe('savingsDetail', () => {
  it('con gastos mayores a los ingresos no muestra un porcentaje negativo', () => {
    expect(savingsDetail(17.5)).toBe('Ahorras el 17,5 % de tus ingresos');
    expect(savingsDetail(-1482.1)).toBe('Gastas 15,8 veces lo que ingresas');
    expect(savingsDetail(-30)).toBe('Gastas un 30 % más de lo que ingresas');
    expect(savingsDetail(null)).toBe('Aún no hay ingresos este mes');
  });
});

describe('nextAction', () => {
  const part = (key, points, value = 0) => ({ key, points, value });
  const base = {
    day: 29,
    daysInMonth: 31,
    projection: { available: true, spent: 148000, projected: 158207, expectedIncome: 10000, balance: -148207 },
    smallExpenses: { threshold: 20000, total: 53000 },
  };

  it('con ingresos muy bajos frente al gasto pide registrarlos', () => {
    const action = nextAction({
      ...base,
      health: {
        parts: [
          part('savings', 0, -1482),
          part('budgets', 12.5, null),
          part('stability', 12.5, null),
          part('small_expenses', 0, 35.8),
        ],
      },
    });
    expect(action).toMatchObject({
      title: 'Registra tus ingresos del mes',
      gain: 25,
      to: '/app/transacciones?nuevo=ingreso',
    });
  });

  it('elige la parte con menos puntos', () => {
    const action = nextAction({
      ...base,
      health: { parts: [part('savings', 22, 18), part('budgets', 12.5, null), part('small_expenses', 5, 16)] },
    });
    expect(action.title).toBe('Recorta los gastos hormiga');
    expect(money(action.detail)).toMatch(/ahorras \$ 26\.500/);
    expect(action.gain).toBe(20);
  });

  it('sin presupuestos invita a crear uno; la estabilidad sin historial no cuenta', () => {
    const action = nextAction({
      ...base,
      health: {
        parts: [
          part('savings', 24, 19),
          part('budgets', 12.5, null),
          part('stability', 12.5, null),
          part('small_expenses', 25, 2),
        ],
      },
    });
    expect(action).toMatchObject({ title: 'Crea tu primer presupuesto', to: '/app/presupuestos' });
  });

  it('con todo en buen nivel no propone nada', () => {
    expect(nextAction({ ...base, health: { parts: [part('savings', 25, 30), part('budgets', 25, 2)] } })).toBeNull();
  });
});

describe('paceSeries', () => {
  it('une lo gastado hasta hoy con la proyección en línea recta', () => {
    const series = paceSeries({
      day: 2,
      daysInMonth: 4,
      daily: [
        { day: 1, total: 100 },
        { day: 2, total: 300 },
      ],
      projection: { available: true, projected: 700 },
    });
    expect(series).toEqual([
      { day: 1, real: 100 },
      { day: 2, real: 300, projection: 300 },
      { day: 3, projection: 500 },
      { day: 4, projection: 700 },
    ]);
  });

  it('sin proyección disponible solo muestra lo gastado', () => {
    const series = paceSeries({
      day: 1,
      daysInMonth: 3,
      daily: [{ day: 1, total: 50 }],
      projection: { available: false, projected: 150 },
    });
    expect(series).toEqual([{ day: 1, real: 50 }, { day: 2 }, { day: 3 }]);
  });
});

describe('dailyAllowance', () => {
  it('reparte lo que queda entre los días que faltan, hoy incluido', () => {
    const data = { day: 29, daysInMonth: 31, projection: { expectedIncome: 2_000_000, spent: 1_700_000 } };
    expect(dailyAllowance(data)).toBe(100_000);
    expect(dailyAllowance({ ...data, projection: { expectedIncome: 10_000, spent: 148_000 } })).toBe(0);
  });
});

describe('scoreChange', () => {
  it('compara con el mes pasado por su nombre', () => {
    expect(scoreChange(25, 33, '2026-10')).toEqual({ text: 'Bajó 8 puntos frente a septiembre', direction: 'down' });
    expect(scoreChange(61, 60, '2026-01')).toEqual({ text: 'Subió 1 punto frente a diciembre', direction: 'up' });
    expect(scoreChange(50, 50, '2026-10').direction).toBe('same');
    expect(scoreChange(50, null, '2026-10')).toBeNull();
  });
});
