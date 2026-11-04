import { describe, expect, it } from 'vitest';
import { timeAgo } from '@/lib/timeAgo';

describe('timeAgo (FT-0045)', () => {
  const now = new Date('2026-11-03T15:00:00');
  const before = (ms) => new Date(now.getTime() - ms);

  it('dice cuánto hace en minutos, horas o días', () => {
    expect(timeAgo(before(20_000), now)).toBe('ahora');
    expect(timeAgo(before(5 * 60_000), now)).toBe('hace 5 min');
    expect(timeAgo(before(3 * 3_600_000), now)).toBe('hace 3 h');
    expect(timeAgo(before(30 * 3_600_000), now)).toBe('ayer');
    expect(timeAgo(before(4 * 86_400_000), now)).toBe('hace 4 días');
  });

  it('pasada una semana muestra la fecha', () => {
    expect(timeAgo(new Date('2026-10-12T10:00:00'), now)).toMatch(/12/);
  });
});
