import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  Bus,
  CalendarClock,
  HandCoins,
  PiggyBank,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { ReportCard } from '@/components/charts';
import { cn } from '@/lib/utils';
import { handleTabKeys } from './tabKeys';

const cop = (n) => `$${Math.abs(n).toLocaleString('es-CO')}`;

/** Gastos e ingresos (FT-0002): los mismos movimientos de ejemplo de la app. */
function MovementsPreview() {
  const rows = [
    { icon: ArrowDownLeft, label: 'Pago monitoría', detail: 'Ingreso · Ayer', amount: 350000 },
    { icon: UtensilsCrossed, label: 'Almuerzo', detail: 'Alimentación · Hoy', amount: -18000 },
    { icon: Bus, label: 'Recarga bus', detail: 'Transporte · Ayer', amount: -20000 },
  ];
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1 rounded-2xl bg-mint p-4">
          <p className="text-sm text-emerald-800">Ingresos</p>
          <p className="text-2xl font-semibold tracking-tight text-obsidian">$2.450.000</p>
        </div>
        <div className="flex-1 rounded-2xl bg-pink p-4">
          <p className="text-sm text-violet">Gastos</p>
          <p className="text-2xl font-semibold tracking-tight text-obsidian">$1.620.000</p>
        </div>
      </div>
      {rows.map(({ icon: Icon, label, detail, amount }) => (
        <div key={label} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
          <span
            className={cn(
              'grid size-10 place-items-center rounded-xl',
              amount > 0 ? 'bg-mint text-emerald-700' : 'bg-card text-obsidian',
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <p className="font-medium">{label}</p>
            <p className="text-sm text-muted-foreground">{detail}</p>
          </div>
          <p className={cn('font-semibold tabular-nums', amount > 0 && 'text-emerald-700')}>
            {amount > 0 ? '+' : '-'}
            {cop(amount)}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Presupuestos con alertas al 80% y 100% (FT-0005/0006). */
function BudgetsPreview() {
  const budgets = [
    { name: 'Alimentación', spent: 432000, limit: 450000 },
    { name: 'Transporte', spent: 140000, limit: 200000 },
    { name: 'Entretenimiento', spent: 165000, limit: 150000 },
  ];
  return (
    <div className="space-y-3">
      {budgets.map(({ name, spent, limit }, i) => {
        const pct = Math.round((spent / limit) * 100);
        const level = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
        return (
          <div key={name} className="rounded-2xl bg-white p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium">{name}</p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {cop(spent)} / {cop(limit)}
              </p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-card">
              <motion.div
                className={cn(
                  'h-full rounded-full',
                  level === 'over' ? 'bg-destructive' : level === 'warn' ? 'bg-amber-400' : 'bg-violet',
                )}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(pct, 100)}%` }}
                transition={{ duration: 0.9, delay: 0.1 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            {level !== 'ok' && (
              <p
                className={cn(
                  'mt-2 inline-flex items-center gap-1.5 text-sm font-medium',
                  level === 'over' ? 'text-destructive' : 'text-amber-700',
                )}
              >
                <AlertTriangle className="size-4" aria-hidden="true" />
                {level === 'over' ? `Excediste el presupuesto (${pct}%)` : `Vas en el ${pct}% del límite`}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Cuentas por pagar y por cobrar (FT-0046): aviso un día antes; al saldar se registra el movimiento. */
function DebtsPreview() {
  const rows = [
    { icon: ArrowUpRight, who: 'Le debes a Camila', amount: 40000, due: 'Vence mañana', tone: 'bg-pink text-violet' },
    { icon: ArrowDownLeft, who: 'Te debe Sebastián', amount: 25000, due: 'Vence el viernes', tone: 'bg-mint text-emerald-700' },
  ];
  return (
    <div className="space-y-3">
      {rows.map(({ icon: Icon, who, amount, due, tone }) => (
        <div key={who} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-4">
          <span className={cn('grid size-10 place-items-center rounded-xl', tone)}>
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <p className="font-medium">{who}</p>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <CalendarClock className="size-3.5" aria-hidden="true" /> {due}
            </p>
          </div>
          <p className="font-semibold tabular-nums">{cop(amount)}</p>
        </div>
      ))}
      <p className="rounded-2xl bg-obsidian px-4 py-3 text-sm text-white/80">
        Al saldarla, FinTrack registra el ingreso o el gasto por ti.
      </p>
    </div>
  );
}

/** Negocios (FT-0017/0018): el mes del negocio y el reparto entre socios. */
function BusinessPreview() {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white p-4">
        <p className="text-sm text-muted-foreground">Negocio · noviembre</p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            ['Ventas', '$480.000', 'text-emerald-700'],
            ['Gastos', '$190.000', 'text-obsidian'],
            ['Utilidad', '$290.000', 'text-violet'],
          ].map(([label, value, tone]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn('text-lg font-semibold tabular-nums', tone)}>{value}</p>
            </div>
          ))}
        </div>
      </div>
      {['Socio 1 · 50%', 'Socio 2 · 50%'].map((s) => (
        <div key={s} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
          <span className="grid size-10 place-items-center rounded-xl bg-card">
            <Users className="size-5" aria-hidden="true" />
          </span>
          <p className="flex-1 font-medium">{s}</p>
          <p className="font-semibold tabular-nums">$145.000</p>
        </div>
      ))}
    </div>
  );
}

const TABS = [
  {
    id: 'movimientos',
    icon: HandCoins,
    label: 'Gastos e ingresos',
    title: 'Todo en un solo lugar.',
    text: 'Salario, mesada o pagos recibidos, y cada gasto con su categoría. Ves en qué se va tu dinero sin hacer cuentas.',
    Preview: MovementsPreview,
  },
  {
    id: 'presupuestos',
    icon: PiggyBank,
    label: 'Presupuestos',
    title: 'Presupuestos con alertas.',
    text: 'Define un límite por categoría y recibe una alerta antes de pasarte, no cuando ya es tarde.',
    Preview: BudgetsPreview,
  },
  {
    id: 'reportes',
    icon: BarChart3,
    label: 'Reportes',
    title: 'Entiende a dónde va tu dinero.',
    text: 'Dashboard por categoría y periodo, y exportación de tus reportes en Excel, PDF o CSV.',
    Preview: () => <ReportCard className="shadow-none" />,
  },
  {
    id: 'cuentas',
    icon: CalendarClock,
    label: 'Cuentas por pagar',
    title: 'Lo que debes y lo que te deben.',
    text: 'Anota quién te debe y a quién le debes. Te avisamos un día antes de que venza.',
    Preview: DebtsPreview,
  },
  {
    id: 'negocios',
    icon: Briefcase,
    label: 'Negocios',
    title: 'Las cuentas de tu negocio, aparte.',
    text: 'Ventas, gastos y utilidad del mes, con el reparto entre socios y el cierre para exportar.',
    Preview: BusinessPreview,
  },
];

const AUTO_MS = 6000;

/**
 * Funcionalidades en pestañas: cada una muestra una vista real de la app.
 * Avanzan solas mientras la sección está en pantalla; al tocar una, se detiene el avance.
 */
export default function Features() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReducedMotion();
  const running = auto && inView && !reduced;

  useEffect(() => {
    if (!running) return undefined;
    const id = setTimeout(() => setActive((i) => (i + 1) % TABS.length), AUTO_MS);
    return () => clearTimeout(id);
  }, [running, active]);

  const tab = TABS[active];

  return (
    <section ref={ref} id="funcionalidades" className="scroll-mt-20 bg-[linear-gradient(to_bottom,#f6e2f8,#fff_10rem)] pb-24 pt-40 md:pb-32 md:pt-48">
      <div className="container-page">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet">Funcionalidades</p>
            <h2 className="mt-4 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-obsidian md:text-6xl">
              Toma el control total de tu dinero.
            </h2>
          </div>
          <p className="text-lg text-muted-foreground lg:pb-2">
            Desde el primer gasto hasta el cierre del mes: todo organizado, categorizado y en un solo lugar.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Funcionalidades"
          onKeyDown={(e) =>
            handleTabKeys(e, active, TABS.length, (i) => {
              setActive(i);
              setAuto(false);
            })
          }
          className="mt-12 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]"
        >
          {TABS.map(({ id, icon: Icon, label }, i) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={i === active}
              aria-controls={`panel-${id}`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => {
                setActive(i);
                setAuto(false);
              }}
              className={cn(
                'relative flex shrink-0 items-center gap-2 overflow-hidden rounded-full px-5 py-3 font-medium transition-colors',
                i === active ? 'bg-obsidian text-white' : 'bg-card text-obsidian hover:bg-pink',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
              {i === active && running && (
                <motion.span
                  key={`p-${active}`}
                  className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-violet-light"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: AUTO_MS / 1000, ease: 'linear' }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-8 rounded-[2rem] bg-card p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab.id}
              id={`panel-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="text-obsidian"
            >
              <span className="grid size-14 place-items-center rounded-2xl bg-violet text-white">
                <tab.icon className="size-6" aria-hidden="true" />
              </span>
              <h3 className="mt-6 text-3xl font-semibold tracking-[-0.03em] md:text-4xl">{tab.title}</h3>
              <p className="mt-4 max-w-md text-lg text-muted-foreground">{tab.text}</p>
            </motion.div>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="text-obsidian"
              aria-hidden="true"
            >
              <tab.Preview />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
