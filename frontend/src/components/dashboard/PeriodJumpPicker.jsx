import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { periodRange, shiftPeriod, todayIso } from '@/lib/period';
import { cn } from '@/lib/utils';

/** Años que se ven a la vez en el panel de "Año". */
const YEARS_PER_PAGE = 12;

/**
 * Botón pequeño de flecha dentro del panel.
 * @param {{ label: string, onClick: () => void, disabled?: boolean, children: import('react').ReactNode }} props
 */
function NavButton({ label, onClick, disabled = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-8 place-items-center rounded-full text-ink/70 hover:bg-ink/6 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/**
 * Una opción de la cuadrícula (un mes o un año). La elegida va resaltada.
 * @param {{ label: string, selected: boolean, disabled: boolean, onClick: () => void }} props
 */
function GridOption({ label, selected, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'h-9 rounded-xl text-sm font-medium transition-colors first-letter:uppercase',
        'disabled:cursor-not-allowed disabled:opacity-30',
        selected ? 'bg-brand text-white' : 'text-ink/80 hover:bg-ink/6 hover:text-ink',
      )}
    >
      {label}
    </button>
  );
}

/** Meses del año: 12 botones; los meses futuros quedan desactivados. */
function MonthGrid({ date, onPick }) {
  const [today] = useState(todayIso);
  const [nowYear, nowMonth] = today.split('-').map(Number);
  const [selYear, selMonth] = date.split('-').map(Number);
  // Año que se está mirando en el panel (se mueve con las flechas sin elegir nada todavía).
  const [year, setYear] = useState(selYear);

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <NavButton label="Año anterior" onClick={() => setYear((y) => y - 1)}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </NavButton>
        <p className="text-sm font-semibold">{year}</p>
        <NavButton label="Año siguiente" onClick={() => setYear((y) => y + 1)} disabled={year >= nowYear}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </NavButton>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 12 }, (_, i) => {
          const month = i + 1;
          const name = new Date(year, i, 1).toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
          return (
            <GridOption
              key={month}
              label={name}
              selected={year === selYear && month === selMonth}
              disabled={year > nowYear || (year === nowYear && month > nowMonth)}
              onClick={() => onPick(`${year}-${String(month).padStart(2, '0')}-01`)}
            />
          );
        })}
      </div>
    </>
  );
}

/** Años: 12 a la vez, terminando en el año actual; las flechas pasan de 12 en 12. */
function YearGrid({ date, onPick }) {
  const nowYear = new Date().getFullYear();
  const selYear = Number(date.slice(0, 4));
  // Último año de la página visible. Arranca en la página que contiene el año elegido.
  const [lastYear, setLastYear] = useState(
    () => nowYear - Math.floor((nowYear - selYear) / YEARS_PER_PAGE) * YEARS_PER_PAGE,
  );
  const firstYear = lastYear - YEARS_PER_PAGE + 1;

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <NavButton label="Años anteriores" onClick={() => setLastYear((y) => y - YEARS_PER_PAGE)}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </NavButton>
        <p className="text-sm font-semibold">
          {firstYear} – {lastYear}
        </p>
        <NavButton
          label="Años siguientes"
          onClick={() => setLastYear((y) => y + YEARS_PER_PAGE)}
          disabled={lastYear >= nowYear}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </NavButton>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: YEARS_PER_PAGE }, (_, i) => {
          const year = firstYear + i;
          return (
            <GridOption
              key={year}
              label={String(year)}
              selected={year === selYear}
              disabled={year > nowYear}
              onClick={() => onPick(`${year}-01-01`)}
            />
          );
        })}
      </div>
    </>
  );
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/**
 * Semana: un calendario del mes donde cada fila es una semana (de lunes a domingo).
 * Al pasar el mouse se resalta la fila completa y al tocarla se elige esa semana.
 * Las semanas que empiezan en el futuro quedan desactivadas.
 */
function WeekGrid({ date, onPick }) {
  const [today] = useState(todayIso);
  const selectedFrom = periodRange('week', date).from;
  const [selYear, selMonth] = date.split('-').map(Number);
  // Mes que se está mirando: { year, month } con month de 0 a 11.
  const [view, setView] = useState({ year: selYear, month: selMonth - 1 });
  const [nowYear, nowMonth] = today.split('-').map(Number);
  const atLastMonth = view.year > nowYear || (view.year === nowYear && view.month >= nowMonth - 1);

  const move = (delta) =>
    setView(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  // Filas del calendario: desde el lunes de la semana del día 1 hasta cubrir el último día del mes.
  const firstOfMonth = `${view.year}-${String(view.month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(view.year, view.month + 1, 0).getDate();
  const weeks = [];
  let monday = periodRange('week', firstOfMonth).from;
  while (monday <= `${firstOfMonth.slice(0, 8)}${String(lastDay).padStart(2, '0')}`) {
    const [y, m, d] = monday.split('-').map(Number);
    weeks.push({
      from: monday,
      days: Array.from({ length: 7 }, (_, i) => new Date(y, m - 1, d + i)),
    });
    monday = shiftPeriod('week', monday, 1);
  }

  const title = new Date(view.year, view.month, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <NavButton label="Mes anterior" onClick={() => move(-1)}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </NavButton>
        <p className="text-sm font-semibold first-letter:uppercase">{title}</p>
        <NavButton label="Mes siguiente" onClick={() => move(1)} disabled={atLastMonth}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </NavButton>
      </div>
      <div className="mb-1 grid grid-cols-7 text-center text-xs text-ink/50" aria-hidden="true">
        {WEEKDAYS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="space-y-1">
        {weeks.map((week) => {
          const selected = week.from === selectedFrom;
          const end = week.days[6];
          return (
            <button
              key={week.from}
              type="button"
              onClick={() => onPick(week.from)}
              disabled={week.from > today}
              aria-pressed={selected}
              aria-label={`Semana del ${week.days[0].toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })} al ${end.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}`}
              className={cn(
                'grid h-9 w-full grid-cols-7 items-center rounded-xl text-sm tabular-nums transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-30',
                selected ? 'bg-brand text-white' : 'text-ink/80 hover:bg-ink/6 hover:text-ink',
              )}
            >
              {week.days.map((day) => {
                const iso = day.toLocaleDateString('en-CA');
                // Los días de otro mes se ven más tenues; el día de hoy, en negrita.
                const outside = day.getMonth() !== view.month;
                return (
                  <span
                    key={iso}
                    className={cn(outside && !selected && 'opacity-40', iso === today && 'font-bold underline underline-offset-4')}
                  >
                    {day.getDate()}
                  </span>
                );
              })}
            </button>
          );
        })}
      </div>
    </>
  );
}

/**
 * Nombre del periodo que, al tocarlo, abre un panel para saltar directo a otro periodo
 * (por ejemplo de septiembre a enero sin pasar mes por mes):
 * - Mes: cuadrícula de meses con flechas para cambiar de año.
 * - Año: cuadrícula de años.
 * - Semana: calendario del mes donde cada fila es una semana.
 * Se cierra al elegir, con Escape o tocando fuera del panel.
 *
 * @param {object} props
 * @param {'week'|'month'|'year'} props.period
 * @param {string} props.date AAAA-MM-DD del periodo actual.
 * @param {string} props.label Texto del botón, p. ej. `septiembre`.
 * @param {(date: string) => void} props.onPick Recibe un día del periodo elegido.
 */
export default function PeriodJumpPicker({ period, date, label, onPick }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);

  // Mientras el panel está abierto: cerrar con Escape o con un toque fuera de él.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    // La función que devuelve el efecto "limpia": quita los escuchas al cerrar el panel.
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const pick = (next) => {
    onPick(next);
    setOpen(false);
  };

  const Grid = period === 'year' ? YearGrid : period === 'month' ? MonthGrid : WeekGrid;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex h-9 min-w-36 items-center justify-center gap-1 rounded-full px-3 text-sm font-medium hover:bg-ink/6"
      >
        {/* aria-live: el lector de pantalla anuncia el periodo nuevo al cambiarlo. */}
        <span aria-live="polite" className="first-letter:uppercase">
          {label}
        </span>
        <ChevronDown className={cn('size-4 text-ink/50 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Ir a otro periodo"
          className="absolute left-0 top-full z-30 mt-2 w-64 rounded-2xl border border-ink/10 bg-surface p-3 shadow-xl sm:left-1/2 sm:-translate-x-1/2"
        >
          {/* key: al cambiar de periodo el panel se monta de nuevo, con su estado inicial. */}
          <Grid key={`${period}-${date}`} date={date} onPick={pick} />
        </div>
      )}
    </div>
  );
}
