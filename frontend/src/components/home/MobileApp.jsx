import { Link } from 'react-router-dom';
import { ArrowDownLeft, Bus, Download, Sparkles, UtensilsCrossed } from 'lucide-react';
import SectionHeading from '@/components/common/SectionHeading';
import Reveal from '@/components/common/Reveal';
import { CategoryDonut } from '@/components/charts';
import { Button } from '@/components/ui/button';
import useInstallPrompt from '@/hooks/useInstallPrompt';
import { cn } from '@/lib/utils';

/** Últimos movimientos; `ai` marca la categoría asignada automáticamente (FT-0003). */
const MOVEMENTS = [
  { icon: UtensilsCrossed, label: 'Almuerzo', detail: 'Alimentación · Hoy', amount: '-$18.000', ai: true },
  { icon: ArrowDownLeft, label: 'Pago monitoría', detail: 'Ingreso · Ayer', amount: '+$350.000', income: true },
  { icon: Bus, label: 'Recarga bus', detail: 'Transporte · Ayer', amount: '-$20.000', ai: true },
];

const POINTS = [
  {
    icon: '/images/icons/click.svg',
    title: 'Instálala desde el navegador',
    description: 'Sin tiendas de apps: agrégala a tu pantalla de inicio y ábrela como cualquier otra aplicación.',
  },
  {
    icon: '/images/icons/shield-green.svg',
    title: 'Funciona sin internet',
    description: 'Registra gastos en el bus o en el metro; se sincronizan solos cuando recuperas la conexión.',
  },
];

/**
 * Maqueta de teléfono en CSS (reemplaza la imagen de la plantilla, que tenía la marca Revio):
 * balance, dona de gastos por categoría y últimos movimientos.
 */
function PhoneMock() {
  return (
    <div className="relative mx-auto w-full max-w-[330px] rounded-t-[48px] border-[10px] border-b-0 border-[#2a2a2a] bg-black px-4 pb-0 pt-3 shadow-violet-glow">
      <div className="flex items-center justify-between px-3 text-xs font-medium text-white">
        <span>9:41</span>
        <span className="h-6 w-24 rounded-full bg-[#1b1b1b]" />
        <span>100%</span>
      </div>

      <div className="mt-6 rounded-3xl bg-[#1b1b1b] p-5">
        <p className="text-sm text-white/60">Balance</p>
        <p className="mt-1 flex items-center gap-2 text-3xl font-semibold text-mint">
          $2.450.000
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-xs font-medium text-white/80">+2,09%</span>
        </p>
      </div>

      <p className="mt-5 px-1 text-sm text-white/70">Gastos por categoría</p>
      <CategoryDonut className="mt-2" />

      <p className="mt-5 px-1 text-sm text-white/70">Últimos movimientos</p>
      <ul className="mt-2 space-y-2 pb-6">
        {MOVEMENTS.map(({ icon: Icon, label, detail, amount, income, ai }) => (
          <li key={label} className="flex items-center gap-3 rounded-2xl bg-[#1b1b1b] px-3 py-2.5">
            <span
              className={cn(
                'grid size-8 place-items-center rounded-xl',
                income ? 'bg-success/15 text-success' : 'bg-white/10 text-white',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <p className="text-sm text-white">{label}</p>
              <p className="flex items-center gap-1.5 text-[11px] text-white/45">
                {detail}
                {ai && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-violet/25 px-1 text-[10px] font-medium text-violet-light">
                    <Sparkles className="size-2.5" aria-hidden="true" /> IA
                  </span>
                )}
              </p>
            </div>
            <span className={cn('text-sm font-medium', income ? 'text-success' : 'text-white')}>{amount}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Sección negra de la app móvil. Si el navegador permite instalar la PWA,
 * muestra el botón "Instalar app"; si no, invita a crear la cuenta.
 */
export default function MobileApp() {
  const { canInstall, isInstalled, install } = useInstallPrompt();

  return (
    <section id="app" className="scroll-mt-20 overflow-hidden bg-black pt-12 text-white md:pt-20 xl:pt-32">
      <div className="container-page grid items-end gap-12 lg:grid-cols-2">
        <div className="space-y-10 pb-12 md:pb-20 xl:pb-32">
          <SectionHeading
            dark
            align="left"
            eyebrow="App instalable"
            title="Tus finanzas, en el bolsillo."
            description="FinTrack es una aplicación web progresiva: rápida, liviana y lista para usarse sin conexión."
          />

          <ul className="space-y-6">
            {POINTS.map((point, i) => (
              <Reveal as="li" key={point.title} delay={0.1 + i * 0.1} className="flex gap-4">
                <img src={point.icon} alt="" aria-hidden="true" width="40" height="40" loading="lazy" className="size-10" />
                <div>
                  <h3 className="text-lg font-medium">{point.title}</h3>
                  <p className="text-white/55">{point.description}</p>
                </div>
              </Reveal>
            ))}
          </ul>

          <Reveal delay={0.3}>
            {isInstalled ? (
              <p className="text-mint">Ya tienes FinTrack instalada en este dispositivo.</p>
            ) : canInstall ? (
              <Button size="lg" onClick={install}>
                <Download /> Instalar app
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link to="/registro">Empieza gratis</Link>
              </Button>
            )}
          </Reveal>
        </div>

        <Reveal y={60}>
          <PhoneMock />
        </Reveal>
      </div>
    </section>
  );
}
