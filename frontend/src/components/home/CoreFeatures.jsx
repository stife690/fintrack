import { AlertTriangle, ArrowDownLeft, ArrowUpRight, FileDown, PiggyBank } from 'lucide-react';
import SectionHeading from '@/components/common/SectionHeading';
import Reveal from '@/components/common/Reveal';
import { cn } from '@/lib/utils';

/** Acciones principales (FT-0002 registro, FT-0005 presupuestos, FT-0012 exportación). */
const QUICK_ACTIONS = [
  { icon: ArrowUpRight, title: 'Registrar gasto', detail: 'La IA le asigna la categoría por ti' },
  { icon: ArrowDownLeft, title: 'Registrar ingreso', detail: 'Salario, mesada o pagos recibidos', active: true },
  { icon: PiggyBank, title: 'Crear presupuesto', detail: 'Un límite mensual por categoría' },
  { icon: FileDown, title: 'Exportar reporte', detail: 'Descárgalo en PDF o CSV' },
];

/** Presupuestos del mes: consumido vs. límite (FT-0005) con alertas al 80% y 100% (FT-0006). */
const BUDGETS = [
  { name: 'Alimentación', spent: 432000, limit: 450000 },
  { name: 'Transporte', spent: 140000, limit: 200000 },
  { name: 'Entretenimiento', spent: 165000, limit: 150000 },
];

const cop = (n) => `$${n.toLocaleString('es-CO')}`;

/** Maqueta de acciones rápidas (recreada de la plantilla, en español). */
function QuickActionsMock() {
  return (
    <div className="space-y-2 rounded-3xl border border-border bg-white p-3 shadow-card sm:p-4">
      {QUICK_ACTIONS.map(({ icon: Icon, title, detail, active }) => (
        <div
          key={title}
          className={cn(
            'flex items-center gap-4 rounded-2xl border px-4 py-3',
            active ? 'border-violet/50 bg-pink/50' : 'border-transparent',
          )}
        >
          <Icon className={cn('size-6 shrink-0', active ? 'text-violet' : 'text-obsidian')} aria-hidden="true" />
          <div>
            <p className="font-medium text-obsidian">{title}</p>
            <p className="text-sm text-muted-foreground">{detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Maqueta de presupuestos con barras de progreso y alertas. */
function BudgetsMock() {
  return (
    <div className="rounded-3xl border border-border bg-white p-5 shadow-card sm:p-6">
      <p className="text-xl font-semibold text-obsidian">Presupuestos de septiembre</p>
      <p className="text-sm text-muted-foreground">Te avisamos al llegar al 80% y al 100%.</p>

      <ul className="mt-5 space-y-5">
        {BUDGETS.map(({ name, spent, limit }) => {
          const pct = Math.round((spent / limit) * 100);
          const level = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
          return (
            <li key={name}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-obsidian">{name}</span>
                <span className="text-muted-foreground">
                  {cop(spent)} / {cop(limit)}
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-card">
                <div
                  className={cn(
                    'h-full rounded-full',
                    level === 'over' ? 'bg-destructive' : level === 'warn' ? 'bg-amber-400' : 'bg-violet',
                  )}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              {level !== 'ok' && (
                <p
                  className={cn(
                    'mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
                    level === 'over' ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-700',
                  )}
                >
                  <AlertTriangle className="size-3.5" aria-hidden="true" />
                  {level === 'over' ? `Excediste el presupuesto (${pct}%)` : `Vas en el ${pct}% del límite`}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const CARDS = [
  {
    title: 'Registra en segundos.',
    description:
      'Escribe el monto y una descripción; la inteligencia artificial clasifica el gasto automáticamente. Siempre puedes corregirla.',
    mock: QuickActionsMock,
  },
  {
    title: 'Presupuestos con alertas.',
    description: 'Define un límite por categoría y recibe una alerta antes de pasarte, no cuando ya es tarde.',
    mock: BudgetsMock,
  },
];

/** Sección "Core Features": dos tarjetas grandes con maqueta + texto. */
export default function CoreFeatures() {
  return (
    <section id="funcionalidades" className="scroll-mt-20 py-12 md:py-20 xl:py-32">
      <div className="container-page">
        <SectionHeading
          eyebrow="Funcionalidades"
          title="Toma el control total de tu dinero."
          description="Desde el primer gasto hasta el cierre del mes: todo organizado, categorizado y en un solo lugar."
        />

        <div className="mt-12 grid gap-6 md:mt-16 md:grid-cols-2">
          {CARDS.map(({ title, description, mock: Mock }, i) => (
            <Reveal key={title} delay={i * 0.1} className="flex flex-col gap-8 rounded-3xl bg-card p-6 sm:p-10">
              <div className="mx-auto w-full max-w-sm">
                <Mock />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold tracking-tight text-obsidian">{title}</h3>
                <p className="text-muted-foreground">{description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
