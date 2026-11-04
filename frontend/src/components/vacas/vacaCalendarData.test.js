import { describe, expect, it } from 'vitest';
import { contributionsOfMonth, initialMonth, vacaCells } from './vacaCalendarData';

// Pestaña Calendario de la vaca (FT-0043). Hoy es 3 de noviembre de 2026.
const TODAY = '2026-11-03';
const aporte = (id, date, amount, name = 'Laura') => ({ id, date, amount, name, isMe: false });

describe('calendario de la vaca (FT-0043)', () => {
  it('suma lo que aportó el grupo cada día y marca la fecha límite', () => {
    const cells = vacaCells(
      '2026-11',
      TODAY,
      [aporte('a', '2026-11-02', 50000), aporte('b', '2026-11-02', 30000, 'Andrés'), aporte('c', '2026-10-30', 10000)],
      '2026-11-20',
    );
    const day = (n) => cells.find((c) => c?.day === n);
    expect(day(2).contributed).toBe(80000);
    expect(day(3)).toMatchObject({ contributed: 0, isToday: true });
    expect(day(20).isDeadline).toBe(true);
    expect(cells.filter((c) => c?.isDeadline)).toHaveLength(1);
  });

  it('agrupa los aportes del mes por día, del más reciente al más antiguo', () => {
    const groups = contributionsOfMonth(
      [aporte('a', '2026-11-01', 1), aporte('b', '2026-11-02', 1), aporte('c', '2026-11-01', 1), aporte('d', '2026-10-31', 1)],
      '2026-11',
    );
    expect(groups.map((g) => [g.date, g.items.map((c) => c.id)])).toEqual([
      ['2026-11-02', ['b']],
      ['2026-11-01', ['a', 'c']],
    ]);
  });

  it('abre en el mes actual, o en el de la fecha límite si la vaca ya venció', () => {
    expect(initialMonth(TODAY, '2026-12-20')).toBe('2026-11');
    expect(initialMonth(TODAY, null)).toBe('2026-11');
    expect(initialMonth(TODAY, '2026-09-15')).toBe('2026-09');
  });
});
