import { describe, expect, it } from 'vitest';
import { dayLabel, monthLabel, shiftMonth } from '@/lib/calendar';
import { calendarCells, filterEvents, groupByDate, shortMoney } from '@/lib/paymentCalendar';

const event = (date, kind, amount, extra = {}) => ({ date, kind, amount, status: 'pendiente', risk: 'ok', ...extra });

describe('calendario de pagos (FT-0025)', () => {
  it('noviembre de 2026 empieza el domingo: seis celdas vacías antes del 1', () => {
    const cells = calendarCells('2026-11', [], '2026-11-03');
    expect(cells.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(cells[6]).toMatchObject({ day: 1, isPast: true });
    expect(cells.filter(Boolean)).toHaveLength(30);
    expect(cells.find((c) => c?.isToday).day).toBe(3);
  });

  it('cada día suma lo que falta pagar y toma el color de lo más grave', () => {
    const cells = calendarCells(
      '2026-11',
      [
        event('2026-11-10', 'compromiso', 850000, { risk: 'riesgo' }),
        event('2026-11-10', 'vaca', 100000, { risk: 'negativo' }),
        event('2026-11-05', 'compromiso', 89000, { status: 'pagado' }),
        event('2026-11-15', 'ingreso', null, { status: null, risk: null }),
      ],
      '2026-11-03',
    );
    const day = (n) => cells.find((c) => c?.day === n);
    expect(day(10)).toMatchObject({ total: 950000, tone: 'negativo' });
    expect(day(5)).toMatchObject({ total: 0, tone: null }, 'lo pagado no se marca');
    expect(day(15)).toMatchObject({ total: 0, tone: 'ingreso' });
  });

  it('filtra los pagos propios y los de las vacas', () => {
    const events = [event('2026-11-05', 'compromiso', 1), event('2026-11-06', 'vaca', 1), event('2026-11-15', 'ingreso', null)];
    expect(filterEvents(events, 'todo')).toHaveLength(3);
    expect(filterEvents(events, 'mios').map((e) => e.kind)).toEqual(['compromiso', 'ingreso']);
    expect(filterEvents(events, 'vacas').map((e) => e.kind)).toEqual(['vaca']);
  });

  it('agrupa por fecha conservando el orden', () => {
    const groups = groupByDate([event('2026-11-05', 'a', 1), event('2026-11-05', 'b', 1), event('2026-11-09', 'c', 1)]);
    expect(groups.map((g) => [g.date, g.events.length])).toEqual([
      ['2026-11-05', 2],
      ['2026-11-09', 1],
    ]);
  });

  it('cambia de mes cruzando el año', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(monthLabel('2026-11')).toBe('Noviembre 2026');
    expect(dayLabel('2026-11-09')).toBe('9 nov');
  });

  it('acorta los montos para que quepan en la cuadrícula', () => {
    expect(shortMoney(89000)).toBe('89 mil');
    expect(shortMoney(1250000)).toBe('1,3 M');
    expect(shortMoney(2000000)).toBe('2 M');
    expect(shortMoney(500)).toBe('500');
  });
});
