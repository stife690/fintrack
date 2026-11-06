import { useState } from 'react';
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import MonthGrid from '@/components/common/MonthGrid';
import { Button } from '@/components/ui/button';
import { dayLabel, monthLabel, shiftMonth } from '@/lib/calendar';
import { cn } from '@/lib/utils';
import { shortMoney } from '@/lib/paymentCalendar';
import { MEMBER_STATUS, deadlineText, formatPesos, todayIso } from './vacaFormat';
import { contributionsOfMonth, initialMonth, vacaCells } from './vacaCalendarData';

/** Lo mismo que el backend devuelve como máximo en `contributions` (CONTRIBUTIONS_LIMIT). */
const CONTRIBUTIONS_SHOWN = 50;

/**
 * Pestaña Calendario de una vaca (FT-0043): en qué días aportó el grupo, la fecha límite y cuánto
 * le falta a cada miembro. Diseño básico; Nicolás lo pule en FT-0052.
 * @param {{ vaca: object }} props El detalle de `getVaca`.
 */
export default function VacaCalendar({ vaca }) {
  const today = todayIso();
  const [month, setMonth] = useState(() => initialMonth(today, vaca.deadline));
  const groups = contributionsOfMonth(vaca.contributions, month);

  return (
    <div className="flex flex-col gap-4 pt-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" aria-label="Mes anterior" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft />
        </Button>
        <p className="font-medium" aria-live="polite">
          {monthLabel(month)}
        </p>
        <Button variant="ghost" size="icon" aria-label="Mes siguiente" onClick={() => setMonth(shiftMonth(month, 1))}>
          <ChevronRight />
        </Button>
      </div>

      <MonthGrid
        label={`Aportes de ${monthLabel(month)}`}
        className="border-0 bg-transparent p-0 md:p-0"
        cells={vacaCells(month, today, vaca.contributions, vaca.deadline)}
        renderMark={(cell) => {
          if (cell.isDeadline) return { text: 'Meta', className: 'text-caution', title: 'Fecha límite' };
          if (cell.contributed > 0) return { text: shortMoney(cell.contributed), className: 'text-positive' };
          return null;
        }}
      />

      <p className="flex items-center gap-2 rounded-xl bg-caution/10 px-3 py-2 text-sm text-ink/80">
        <Flag className="size-4 flex-none text-caution" aria-hidden="true" />
        {deadlineText(vaca)}
      </p>

      <section aria-labelledby="vaca-cal-falta">
        <h3 id="vaca-cal-falta" className="mb-2 text-sm font-semibold">
          Cuánto le falta a cada uno
        </h3>
        <ul className="flex flex-col gap-1">
          {vaca.members.map((m) => {
            const status = MEMBER_STATUS[m.status];
            return (
              <li key={m.userId} className="flex min-h-10 items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-8 flex-none place-items-center rounded-full bg-ink/5 text-sm font-semibold text-violet-light"
                >
                  {m.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{m.isMe ? 'Tú' : m.name}</span>
                <span className="text-sm tabular-nums">{m.remaining > 0 ? formatPesos(m.remaining) : 'Nada'}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', status.chip)}>{status.label}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="vaca-cal-aportes">
        <h3 id="vaca-cal-aportes" className="mb-2 text-sm font-semibold">
          Aportes de {monthLabel(month).toLowerCase()}
        </h3>
        {groups.length === 0 ? (
          <p className="text-sm text-ink/60">Nadie aportó este mes.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {groups.map((g) => (
              <li key={g.date}>
                <p className="text-xs font-semibold text-ink/60">{dayLabel(g.date)}</p>
                <ul>
                  {g.items.map((c) => (
                    <li key={c.id} className="flex justify-between gap-3 text-sm">
                      <span className="truncate">{c.isMe ? 'Tú' : c.name}</span>
                      <span className="font-medium tabular-nums text-positive">+{formatPesos(c.amount)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {vaca.contributions.length >= CONTRIBUTIONS_SHOWN && (
          <p className="mt-2 text-xs text-ink/60">Se ven los últimos {CONTRIBUTIONS_SHOWN} aportes.</p>
        )}
      </section>
    </div>
  );
}
