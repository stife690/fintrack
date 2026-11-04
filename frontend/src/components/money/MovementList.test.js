import { describe, expect, it } from 'vitest';
import { groupByDay } from '@/components/money/MovementList';
import { formatRelativeDay } from '@/components/transactions/format';

describe('groupByDay', () => {
  it('junta los movimientos seguidos del mismo día, con su nombre corto', () => {
    const now = new Date(2026, 10, 4);
    const groups = groupByDay(
      [
        { id: 'a', date: '2026-11-04' },
        { id: 'b', date: '2026-11-04' },
        { id: 'c', date: '2026-11-03' },
        { id: 'd', date: '2026-11-01' },
      ],
      now,
    );
    expect(groups.map((g) => [g.day, g.items.map((t) => t.id)])).toEqual([
      ['Hoy', ['a', 'b']],
      ['Ayer', ['c']],
      [formatRelativeDay('2026-11-01', now), ['d']],
    ]);
  });
});
