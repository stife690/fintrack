import { CloudCheck, Smartphone, Sparkles, WifiOff } from 'lucide-react';
import Reveal from '@/components/common/Reveal';
import { cn } from '@/lib/utils';

/** Barras del reporte: gastos de abril a septiembre (miles de pesos), los mismos de la tarjeta del hero. */
const SPENDING = [
  { month: 'Abr', value: 1650 },
  { month: 'May', value: 1900 },
  { month: 'Jun', value: 1500 },
  { month: 'Jul', value: 2050 },
  { month: 'Ago', value: 1750 },
  { month: 'Sep', value: 1620 },
];
const MAX_SPENDING = Math.max(...SPENDING.map((m) => m.value));

/** Presupuesto: consumido vs. límite. */
function BudgetVisual() {
  return (
    <div className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-white/70">Alimentación</span>
        <span className="text-sm text-white/60">$432.000 / $450.000</span>
      </div>
      <p className="mt-2 text-5xl font-semibold tracking-[-0.04em] tabular-nums">$18.000</p>
      <p className="text-white/60">te quedan este mes</p>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-[96%] rounded-full bg-amber-400" />
      </div>
      <p className="mt-2 text-sm font-medium text-amber-400">Vas en el 96% del límite</p>
    </div>
  );
}

/** Reporte: barras de gasto por mes. */
function ReportVisual() {
  return (
    <div
      className="flex h-40 items-end gap-2 rounded-2xl bg-white p-4"
      role="img"
      aria-label="Gastos por mes de abril a septiembre"
    >
      {SPENDING.map(({ month, value }, i) => (
        <div key={month} className="flex flex-1 flex-col items-center gap-2">
          <div
            className={cn('w-full rounded-lg', i === SPENDING.length - 1 ? 'bg-violet' : 'bg-orchid')}
            style={{ height: `${Math.round((value / MAX_SPENDING) * 96)}px` }}
          />
          <span className="text-xs text-muted-foreground">{month}</span>
        </div>
      ))}
    </div>
  );
}

/** IA: categoría asignada a partir de la descripción. */
function AiVisual() {
  return (
    <div className="space-y-3">
      <p className="ml-auto w-fit rounded-2xl rounded-br-sm bg-white px-4 py-2.5 text-obsidian">Almuerzo $18.000</p>
      <p className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-sm bg-black/25 px-4 py-2.5">
        <Sparkles className="size-4 text-pink" aria-hidden="true" />
        Categoría: Alimentación
      </p>
    </div>
  );
}

/** Sincronización: lo guardado sin conexión sube solo al volver la señal. */
function SyncVisual() {
  const steps = [
    { icon: WifiOff, label: 'Sin conexión', detail: 'Guardado en tu dispositivo' },
    { icon: Smartphone, label: 'Vuelve la señal', detail: 'Se sincroniza solo' },
    { icon: CloudCheck, label: 'En todos tus dispositivos', detail: 'Celular y computador' },
  ];
  return (
    <ol className="space-y-2">
      {steps.map(({ icon: Icon, label, detail }) => (
        <li key={label} className="flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3">
          <Icon className="size-5 shrink-0 text-emerald-700" aria-hidden="true" />
          <div>
            <p className="font-medium text-obsidian">{label}</p>
            <p className="text-sm text-obsidian/60">{detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

const ITEMS = [
  {
    tag: 'Presupuestos',
    title: 'Sabe cuánto te queda, siempre',
    description: 'Define límites por categoría, mira cuánto llevas gastado y recibe alertas antes de pasarte.',
    visual: BudgetVisual,
    className: 'bg-obsidian text-white lg:col-span-7',
    muted: 'text-white/65',
    tagColor: 'text-orchid',
  },
  {
    tag: 'Sincronización',
    title: 'Tus datos en todos tus dispositivos',
    description: 'Registra sin internet: FinTrack guarda todo localmente y sincroniza cuando vuelves a estar en línea.',
    visual: SyncVisual,
    className: 'bg-mint text-obsidian lg:col-span-5',
    muted: 'text-obsidian/70',
    tagColor: 'text-emerald-700',
  },
  {
    tag: 'Reportes',
    title: 'Entiende a dónde va tu dinero',
    description: 'Dashboard por categoría y periodo, y exportación de tus reportes en Excel, PDF o CSV.',
    visual: ReportVisual,
    className: 'bg-card text-obsidian lg:col-span-5',
    muted: 'text-muted-foreground',
    tagColor: 'text-violet',
  },
  {
    tag: 'Inteligencia artificial',
    title: 'Recomendaciones hechas para ti',
    description: 'La IA categoriza tus gastos automáticamente y analiza tus hábitos para sugerirte dónde ahorrar.',
    visual: AiVisual,
    className: 'bg-violet text-white lg:col-span-7',
    muted: 'text-white/75',
    tagColor: 'text-pink',
  },
];

/**
 * Beneficios en mosaico: cada uno con su propio campo de color y una pieza que lo explica
 * (medidor, pasos de sincronización, barras del reporte, conversación con la IA).
 */
export default function Highlights() {
  return (
    <section className="pb-16 md:pb-24 xl:pb-32" aria-label="Beneficios">
      <div className="container-page grid gap-6 lg:grid-cols-12">
        {ITEMS.map(({ tag, title, description, visual: Visual, className, muted, tagColor }, i) => (
          <Reveal
            key={title}
            delay={(i % 2) * 0.1}
            className={cn(
              'flex flex-col justify-between gap-8 rounded-[2rem] p-7 sm:p-9 motion-safe:transition-transform motion-safe:duration-500 lg:hover:-translate-y-1',
              className,
            )}
          >
            <div className="max-w-md space-y-3">
              <p className={cn('text-sm font-medium', tagColor)}>{tag}</p>
              <h3 className="text-balance text-3xl font-semibold tracking-[-0.03em]">{title}</h3>
              <p className={muted}>{description}</p>
            </div>
            <Visual />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
