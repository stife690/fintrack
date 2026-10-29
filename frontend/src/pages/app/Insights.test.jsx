import { describe, expect, it } from 'vitest';
import { insightsTitle } from '@/pages/app/Insights';

describe('insightsTitle', () => {
  it('con consejos de la semana dice desde qué lunes', () => {
    expect(insightsTitle({ period: 'week', month: '2026-10', from: '2026-10-19' })).toBe(
      'Esta semana, desde el lunes 19 de octubre',
    );
  });

  it('con consejos del mes muestra el mes', () => {
    expect(insightsTitle({ period: 'month', month: '2026-10', from: '2026-10-01' })).toMatch(/octubre/);
  });
});
