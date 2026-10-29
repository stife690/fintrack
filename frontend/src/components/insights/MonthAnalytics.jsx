import { Bug, CalendarClock, HeartPulse, Loader2 } from 'lucide-react';
import Panel from '@/components/layout/Panel';
import { formatMoney } from '@/components/transactions/format';
import useAsync from '@/hooks/useAsync';
import { cn } from '@/lib/utils';
import { getAnalytics } from '@/services/analyticsService';
import { LEVELS, describePart, formatNumber, projectionMessage, smallExpensesMessage } from './analytics';

const TEXT = { positive: 'text-positive', caution: 'text-caution', negative: 'text-negative' };
const BAR = { positive: 'bg-positive', caution: 'bg-caution', negative: 'bg-negative' };

/** Tono de una parte del puntaje según sus puntos (de 25). */
const partTone = (points) => (points >= 18 ? 'positive' : points >= 10 ? 'caution' : 'negative');

/** Encabezado de cada bloque: ícono y título. */
function BlockTitle({ icon: Icon, children }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-medium text-ink/70">
      <Icon className="size-4" aria-hidden="true" />
      {children}
    </h3>
  );
}

/** Puntaje de 0 a 100 en un anillo, con el nivel y las cuatro partes. */
function HealthBlock({ health }) {
  const { label, tone } = LEVELS[health.level];
  const circumference = 2 * Math.PI * 42;
  return (
    <div>
      <BlockTitle icon={HeartPulse}>Salud financiera</BlockTitle>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative size-24 shrink-0">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r="42" fill="none" strokeWidth="10" className="stroke-ink/10" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - health.score / 100)}
              className={cn('transition-[stroke-dashoffset] duration-700', {
                'stroke-positive': tone === 'positive',
                'stroke-caution': tone === 'caution',
                'stroke-negative': tone === 'negative',
              })}
            />
          </svg>
          <p className="absolute inset-0 grid place-items-center text-2xl font-semibold tabular-nums">
            <span>
              {health.score}
              <span className="sr-only"> de 100</span>
            </span>
          </p>
        </div>
        <p className={cn('text-lg font-semibold', TEXT[tone])}>{label}</p>
      </div>
      <ul className="mt-4 space-y-2.5">
        {health.parts.map((part) => {
          const { label: name, detail } = describePart(part);
          const partColor = partTone(part.points);
          return (
            <li key={part.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{name}</span>
                <span className="tabular-nums text-ink/60">
                  {formatNumber(part.points)} <span className="sr-only">de</span>
                  <span aria-hidden="true">/</span> 25
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
                <div
                  className={cn('h-full rounded-full', BAR[partColor])}
                  style={{ width: `${(part.points / 25) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-ink/60">{detail}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Proyección de fin de mes: cifra grande, frase y barra de lo gastado frente a lo proyectado. */
function ProjectionBlock({ projection, day, daysInMonth }) {
  const over = projection.expectedIncome > 0 && projection.balance < 0;
  const spentPct = projection.projected > 0 ? Math.min(100, (projection.spent / projection.projected) * 100) : 0;
  return (
    <div>
      <BlockTitle icon={CalendarClock}>Proyección a fin de mes</BlockTitle>
      <p className={cn('mt-3 text-2xl font-semibold tabular-nums', over && 'text-negative')}>
        {projection.available ? formatMoney(projection.projected) : '—'}
      </p>
      <p className="mt-1 text-sm text-ink/75">{projectionMessage(projection)}</p>
      {projection.available && (
        <>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
            <div className="h-full rounded-full bg-brand" style={{ width: `${spentPct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-ink/60">
            Llevas {formatMoney(projection.spent)} en el día {day} de {daysInMonth}.
            {projection.pendingFixed > 0 &&
              ` Incluye ${formatMoney(projection.pendingFixed)} de arriendo o servicios que aún no registras.`}
          </p>
        </>
      )}
    </div>
  );
}

/** Gastos hormiga: frase y las descripciones que más se repiten. */
function SmallExpensesBlock({ small }) {
  return (
    <div>
      <BlockTitle icon={Bug}>Gastos hormiga</BlockTitle>
      <p className={cn('mt-3 text-2xl font-semibold tabular-nums', small.flagged && 'text-caution')}>
        {formatMoney(small.total)}
      </p>
      <p className="mt-1 text-sm text-ink/75">{smallExpensesMessage(small)}</p>
      {small.top.length > 0 && (
        <ul className="mt-3 divide-y divide-ink/10 text-sm">
          {small.top.map((item) => (
            <li key={item.description} className="flex justify-between gap-3 py-1.5">
              <span className="min-w-0 truncate">
                {item.description} <span className="text-ink/60">×{item.count}</span>
              </span>
              <span className="shrink-0 tabular-nums text-ink/75">{formatMoney(item.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Insights → "Tu mes en números" (FT-0019): puntaje de salud financiera, proyección de fin de
 * mes y gastos hormiga. Los calcula el servidor con fórmulas fijas, sin IA.
 */
export default function MonthAnalytics() {
  const { data, error, loading, reload } = useAsync(getAnalytics, []);

  return (
    <Panel aria-labelledby="analitica-title">
      <h2 id="analitica-title" className="text-lg font-semibold tracking-tight">
        Tu mes en números
      </h2>
      <div className="mt-5" aria-busy={loading}>
        {loading && !data ? (
          <p className="flex items-center gap-2 py-6 text-ink/60">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Calculando…
          </p>
        ) : error && !data ? (
          <p role="alert" className="text-sm text-negative">
            {error}{' '}
            <button type="button" className="underline" onClick={reload}>
              Reintentar
            </button>
          </p>
        ) : data.empty ? (
          <p className="text-sm text-ink/70">Registra movimientos este mes para ver tu puntaje y tu proyección.</p>
        ) : (
          <div className="grid gap-8 md:grid-cols-3 md:gap-6">
            <HealthBlock health={data.health} />
            <ProjectionBlock projection={data.projection} day={data.day} daysInMonth={data.daysInMonth} />
            <SmallExpensesBlock small={data.smallExpenses} />
          </div>
        )}
      </div>
    </Panel>
  );
}
