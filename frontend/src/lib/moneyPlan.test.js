import { describe, expect, it } from 'vitest';
import { dayAndMonth, planHeadline } from '@/lib/moneyPlan';

const money = (value) => `$${value}`;

describe('planHeadline', () => {
  it('con fecha fija dice cuánto puede gastar hoy', () => {
    const plan = { mode: 'daily', shortfall: 0, perDay: 10000, days: 15, nextPay: '2026-12-01' };
    expect(planHeadline(plan, money)).toMatchObject({ label: 'Puedes gastar hoy', value: '$10000' });
    expect(planHeadline(plan, money).note).toContain('en 15 días');
  });

  it('con fecha fija avisa si no alcanza', () => {
    const plan = { mode: 'daily', shortfall: 120000, perDay: 0, days: 2, nextPay: '2026-12-01' };
    expect(planHeadline(plan, money)).toMatchObject({ label: 'Te faltan', value: '$120000', warning: true });
  });

  it('sin fecha fija da la meta del día', () => {
    const plan = { mode: 'goal', shortfall: 75000, goal: 45400, days: 1, until: 'Arriendo' };
    expect(planHeadline(plan, money)).toEqual({
      label: 'Para cubrir todo necesitas hacer',
      value: '$45400 al día',
      note: 'Hasta Arriendo, en 1 día',
    });
  });

  it('sin deudas pendientes dice para cuánto le alcanza', () => {
    const plan = { mode: 'runway', shortfall: 0, runwayDays: 12, pace: 40000 };
    expect(planHeadline(plan, money)).toMatchObject({ value: '12 días', note: 'A tu ritmo de $40000 al día' });
  });

  it('sin historial solo muestra la plata libre', () => {
    const plan = { mode: 'runway', shortfall: 0, runwayDays: null, free: 500000 };
    expect(planHeadline(plan, money)).toMatchObject({ label: 'Tienes libres', value: '$500000' });
  });

  it('nunca dice que alcanza si gastó más de lo que tenía', () => {
    const plan = { mode: 'runway', shortfall: 20000, runwayDays: 0, pace: 40000 };
    expect(planHeadline(plan, money)).toMatchObject({ label: 'Te faltan', warning: true });
  });
});

describe('dayAndMonth', () => {
  it('escribe el día y el mes', () => {
    expect(dayAndMonth('2026-11-30')).toBe('30 de noviembre');
  });
});
