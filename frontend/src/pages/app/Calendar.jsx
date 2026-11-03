import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import MonthGrid from '@/components/common/MonthGrid';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import useAsync from '@/hooks/useAsync';
import usePageTitle from '@/hooks/usePageTitle';
import { dayLabel, monthLabel, shiftMonth } from '@/lib/calendar';
import { FILTERS, STATUS_TEXT, calendarCells, filterEvents, groupByDate, shortMoney } from '@/lib/paymentCalendar';
import { cn } from '@/lib/utils';
import { getPaymentCalendar } from '@/services/moneyProfileService';

/** Color de cada tono de la cuadrícula y del saldo. */
const TONE_CLASS = {
  negativo: 'text-negative',
  riesgo: 'text-caution',
  pago: 'text-violet-light',
  ingreso: 'text-positive',
};

const RISK_TEXT = {
  negativo: 'No te alcanza',
  riesgo: 'Te queda poco',
};

/**
 * Cuadrícula del mes con el total por pagar de cada día, del color de lo más grave.
 * @param {{ month: string, events: object[], today: string }} props
 */
function PaymentGrid({ month, events, today }) {
  return (
    <MonthGrid
      label={`Pagos de ${monthLabel(month)}`}
      cells={calendarCells(month, events, today)}
      renderMark={(cell) =>
        cell.tone && { text: cell.total > 0 ? shortMoney(cell.total) : '•', className: TONE_CLASS[cell.tone] }
      }
    />
  );
}

/**
 * Un pago (o día de pago) de la lista, con cuánto queda después.
 * @param {{ event: object }} props
 */
function EventRow({ event }) {
  const income = event.kind === 'ingreso';
  const paid = event.status === 'pagado';
  let detail = income ? 'Te entra plata' : STATUS_TEXT[event.status];
  if (event.kind === 'vaca' && !paid) detail = `${detail} · tu aporte a la vaca`;
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-3">
      <span
        aria-hidden="true"
        className={cn(
          'grid size-10 flex-none place-items-center rounded-full bg-ink/5 font-bold',
          income ? 'text-positive' : event.kind === 'vaca' ? 'text-caution' : 'text-violet-light',
        )}
      >
        {income ? '$' : event.name[0].toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate font-medium', paid && 'text-ink/50 line-through')}>{event.name}</p>
        <p className={cn('text-xs text-ink/60', event.status === 'atrasado' && 'text-negative')}>{detail}</p>
        {event.balanceAfter !== null && (
          <p className={cn('text-xs', TONE_CLASS[event.risk] ?? 'text-ink/60')}>
            {RISK_TEXT[event.risk] ? `${RISK_TEXT[event.risk]}: ` : 'Te quedan '}
            {formatMoney(event.balanceAfter)}
          </p>
        )}
      </div>
      {event.amount !== null && (
        <span className={cn('font-semibold tabular-nums', paid && 'text-ink/50')}>-{formatMoney(event.amount)}</span>
      )}
    </li>
  );
}

/**
 * Calendario de pagos (FT-0025): compromisos de Mi plata, días de pago y aportes a vacas del mes,
 * con cuánto le queda al usuario después de cada pago y cuáles lo dejan en riesgo. Diseño básico;
 * Nicolás lo pule en FT-0052.
 */
export default function Calendar() {
  usePageTitle('Calendario');
  // `undefined`: el mes actual, que decide la API con la zona horaria del usuario.
  const [month, setMonth] = useState();
  const [filter, setFilter] = useState('todo');
  const calendar = useAsync(() => getPaymentCalendar(month), [month]);
  const data = calendar.data;
  const shown = data?.month;

  const events = data ? filterEvents(data.events, filter) : [];
  const unknownAfter = data?.projectedUntil && events.some((e) => e.kind !== 'ingreso' && e.date >= data.projectedUntil);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Calendario"
        description="Tus pagos del mes y cuánto te queda después de cada uno."
        actions={
          shown && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Mes anterior" onClick={() => setMonth(shiftMonth(shown, -1))}>
                <ChevronLeft />
              </Button>
              <span className="min-w-36 text-center font-medium" aria-live="polite">
                {monthLabel(shown)}
              </span>
              <Button variant="ghost" size="icon" aria-label="Mes siguiente" onClick={() => setMonth(shiftMonth(shown, 1))}>
                <ChevronRight />
              </Button>
            </div>
          )
        }
      />

      {calendar.error && !data && (
        <p role="alert" className="text-sm text-negative">
          {calendar.error}{' '}
          <button type="button" className="underline" onClick={calendar.reload}>
            Reintentar
          </button>
        </p>
      )}
      {!data && !calendar.error && (
        <p className="flex justify-center py-10" role="status" aria-label="Cargando el calendario">
          <Loader2 className="animate-spin text-ink/50" aria-hidden="true" />
        </p>
      )}

      {data && (
        <div className={cn('flex flex-col gap-4', calendar.loading && 'opacity-60')}>
          <div className="grid grid-cols-2 gap-3">
            <Panel className="p-4 md:p-4">
              <p className="text-xs text-ink/60">Por pagar este mes</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{formatMoney(data.totals.pending)}</p>
            </Panel>
            <Panel className="p-4 md:p-4">
              <p className="text-xs text-ink/60">Tienes hoy</p>
              {data.money === null ? (
                <Link to="/app/mi-plata" className="mt-1 block text-sm font-medium text-violet-light underline-offset-4 hover:underline">
                  Dinos cuánto tienes
                </Link>
              ) : (
                <p className="mt-1 text-xl font-bold tabular-nums">{formatMoney(data.money)}</p>
              )}
            </Panel>
          </div>

          <div role="radiogroup" aria-label="Qué pagos mostrar" className="flex gap-1 rounded-2xl bg-ink/5 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'h-11 flex-1 rounded-xl text-sm font-semibold transition-colors',
                  filter === f.id ? 'bg-violet text-white' : 'text-ink/70 hover:text-ink',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <PaymentGrid month={data.month} events={events} today={data.today} />

          {events.length === 0 ? (
            <Panel className="text-center">
              <p className="font-medium">No hay pagos este mes.</p>
              <p className="mt-1 text-sm text-ink/60">
                Agrega tus pagos de cada mes (arriendo, servicios, cuotas) en{' '}
                <Link to="/app/mi-plata" className="font-medium text-violet-light underline-offset-4 hover:underline">
                  Mi plata
                </Link>{' '}
                y aquí verás cuánto te queda después de cada uno.
              </p>
            </Panel>
          ) : (
            <div className="flex flex-col gap-4">
              {groupByDate(events).map((group) => (
                <section key={group.date} aria-label={dayLabel(group.date)}>
                  <h2 className="mb-2 text-sm font-semibold text-ink/70">
                    {group.date === data.today ? 'Hoy' : dayLabel(group.date)}
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {group.events.map((event) => (
                      <EventRow key={`${event.kind}-${event.id ?? 'pago'}-${event.date}`} event={event} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {unknownAfter && (
            <p className="text-center text-xs text-ink/50">
              Después del {dayLabel(data.projectedUntil)} no calculamos cuánto te queda: todavía no sabemos cuánto
              te van a pagar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
