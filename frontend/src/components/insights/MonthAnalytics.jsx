import { lazy, Suspense, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bug,
  CalendarClock,
  ChevronDown,
  CircleCheck,
  HeartPulse,
  Lightbulb,
  Loader2,
  Minus,
} from 'lucide-react';
import Panel from '@/components/layout/Panel';
import { formatMoney } from '@/components/transactions/format';
import useAsync from '@/hooks/useAsync';
import { cn } from '@/lib/utils';
import { getAnalytics } from '@/services/analyticsService';
import {
  LEVELS,
  PART_FORMULAS,
  describePart,
  formatNumber,
  nextAction,
  paceSeries,
  projectionMessage,
  scoreChange,
  smallExpensesMessage,
} from './analytics';

// Recharts va en un chunk aparte, como en Inicio: el panel se pinta sin esperarlo.
const SpendingPaceLines = lazy(() => import('./SpendingPaceLines'));

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

const CHANGE = {
  up: { icon: ArrowUpRight, className: 'text-positive' },
  down: { icon: ArrowDownRight, className: 'text-negative' },
  same: { icon: Minus, className: 'text-ink/60' },
};

/** Puntaje de 0 a 100 en un anillo, con su nivel y cuánto cambió frente al mes pasado. */
function ScoreBlock({ health, previousScore, month }) {
  const { label, tone } = LEVELS[health.level];
  const change = scoreChange(health.score, previousScore, month);
  const ChangeIcon = change && CHANGE[change.direction].icon;
  const circumference = 2 * Math.PI * 42;
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-ink/10 p-4">
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
      <div>
        <BlockTitle icon={HeartPulse}>Salud financiera</BlockTitle>
        <p className={cn('mt-1 text-xl font-semibold', TEXT[tone])}>{label}</p>
        {change && (
          <p className={cn('mt-1 flex items-center gap-1 text-xs font-medium', CHANGE[change.direction].className)}>
            <ChangeIcon className="size-3.5" aria-hidden="true" />
            {change.text}
          </p>
        )}
      </div>
    </div>
  );
}

/** La acción que más sube el puntaje, con a dónde ir para hacerla. */
function ActionBlock({ action }) {
  if (!action) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-positive/10 p-4">
        <CircleCheck className="mt-0.5 size-5 shrink-0 text-positive" aria-hidden="true" />
        <div>
          <p className="font-semibold">Vas muy bien</p>
          <p className="mt-1 text-sm text-ink/75">Todas las partes de tu puntaje están en buen nivel. Sigue así.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-brand-soft/60 p-4 sm:flex-row sm:items-start">
      <Lightbulb className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-brand">Lo que más te sube el puntaje</p>
        <p className="mt-1 font-semibold">{action.title}</p>
        <p className="mt-1 text-sm text-ink/75">{action.detail}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-brand">
            Hasta +{action.gain} puntos
          </span>
          {action.to && (
            <Link
              to={action.to}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-violet"
            >
              {action.cta}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/** Las cuatro partes del puntaje; cada una se abre para mostrar cómo se calcula. */
function PartsBlock({ parts }) {
  return (
    <div>
      <BlockTitle icon={HeartPulse}>Cómo se arma tu puntaje</BlockTitle>
      <ul className="mt-3 space-y-2">
        {parts.map((part) => {
          const { label: name, detail } = describePart(part);
          return (
            <li key={part.key}>
              <details className="group [&_summary::-webkit-details-marker]:hidden">
                <summary className="cursor-pointer list-none rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1 font-medium">
                      {name}
                      <ChevronDown
                        className="size-3.5 text-ink/50 transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="tabular-nums text-ink/60">
                      {formatNumber(part.points)} <span className="sr-only">de</span>
                      <span aria-hidden="true">/</span> 25
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
                    <div
                      className={cn('h-full rounded-full', BAR[partTone(part.points)])}
                      style={{ width: `${(part.points / 25) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink/60">{detail}</p>
                </summary>
                <p className="mt-2 rounded-lg bg-ink/5 px-3 py-2 text-xs leading-relaxed text-ink/75">
                  {PART_FORMULAS[part.key]}
                </p>
              </details>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-ink/55">Cada parte vale 25 puntos. Toca una para ver la fórmula.</p>
    </div>
  );
}

/**
 * Ritmo de gasto: la proyección en texto y el gráfico de lo gastado día a día, la proyección
 * hasta fin de mes y los ingresos. El gráfico es una imagen para el lector de pantalla; el texto
 * de arriba ya dice lo importante.
 */
function PaceBlock({ data }) {
  const { projection, day, daysInMonth, month } = data;
  const series = useMemo(() => paceSeries(data), [data]);
  const over = projection.expectedIncome > 0 && projection.balance < 0;
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-xl">
          <BlockTitle icon={CalendarClock}>Proyección a fin de mes</BlockTitle>
          <p className={cn('mt-2 text-2xl font-semibold tabular-nums', over && 'text-negative')}>
            {projection.available ? formatMoney(projection.projected) : '—'}
          </p>
          <p className="mt-1 text-sm text-ink/75">{projectionMessage(projection)}</p>
          <p className="mt-1 text-xs text-ink/60">
            Llevas {formatMoney(projection.spent)} en el día {day} de {daysInMonth}.
            {projection.pendingFixed > 0 &&
              ` Incluye ${formatMoney(projection.pendingFixed)} de arriendo o servicios que aún no registras.`}
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/70" aria-hidden="true">
          <li className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-brand" /> Gastado
          </li>
          {projection.available && (
            <li className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-brand" /> Proyección
            </li>
          )}
          {projection.expectedIncome > 0 && (
            <li className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-chart-income" /> Ingresos
            </li>
          )}
        </ul>
      </div>
      <div role="img" aria-label="Gráfico del gasto acumulado del mes y su proyección" className="mt-4 h-56">
        <Suspense fallback={<div className="h-full rounded-xl bg-ink/5" />}>
          <SpendingPaceLines data={series} income={projection.expectedIncome} month={month} />
        </Suspense>
      </div>
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
        <ul className="mt-4 space-y-3 text-sm">
          {small.top.map((item) => (
            <li key={item.description}>
              <div className="flex justify-between gap-3">
                <span className="min-w-0 truncate">
                  {item.description} <span className="text-ink/60">×{item.count}</span>
                </span>
                <span className="shrink-0 tabular-nums text-ink/75">{formatMoney(item.total)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-caution"
                  style={{ width: `${(item.total / small.top[0].total) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Insights → "Tu mes en números" (FT-0019): puntaje de salud financiera con la acción que más lo
 * sube y su cambio frente al mes pasado, el ritmo de gasto con la proyección de fin de mes,
 * gastos hormiga y cómo se arma el puntaje. Los calcula el
 * servidor con fórmulas fijas, sin IA; la acción recomendada sale de `nextAction`.
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
          <div className="space-y-8">
            <div className="grid gap-4 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
              <ScoreBlock health={data.health} previousScore={data.previousScore} month={data.month} />
              <ActionBlock action={nextAction(data)} />
            </div>
            <PaceBlock data={data} />
            <div className="grid gap-8 md:grid-cols-2 md:gap-10">
              <SmallExpensesBlock small={data.smallExpenses} />
              <PartsBlock parts={data.health.parts} />
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
