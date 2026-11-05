import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Download, Laptop, Smartphone, Tablet, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/common/Logo';
import useInstallPrompt from '@/hooks/useInstallPrompt';
import { cn } from '@/lib/utils';
import { handleTabKeys } from './tabKeys';

/** Dispositivos: cambia la proporción del marco con una transición de layout. */
const DEVICES = [
  { id: 'computador', icon: Laptop, label: 'Computador', frame: 'aspect-[16/10] w-full rounded-[1.5rem] p-2.5' },
  { id: 'tablet', icon: Tablet, label: 'Tablet', frame: 'aspect-[4/5] w-[68%] rounded-[2rem] p-3' },
  { id: 'celular', icon: Smartphone, label: 'Celular', frame: 'aspect-[9/19] w-[40%] rounded-[2.4rem] p-2.5' },
];

const STEPS = [
  'Abre FinTrack en el navegador',
  'Agrégala a tu pantalla de inicio',
  'Ábrela como cualquier otra app, incluso sin internet',
];

/** Pantalla de inicio simplificada de la app: balance y gastos por categoría. */
function AppScreen({ compact }) {
  const cats = [
    ['Alimentación', 38, 'bg-violet'],
    ['Transporte', 22, 'bg-violet-light'],
    ['Vivienda', 20, 'bg-orchid'],
    ['Otros', 20, 'bg-mint'],
  ];
  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden rounded-[inherit] bg-black p-4 text-white">
      <div className="flex items-center gap-2">
        <LogoMark className="size-6" />
        <span className="text-sm font-semibold">FinTrack</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
          <WifiOff className="size-3" aria-hidden="true" />
          {!compact && <span className="whitespace-nowrap">Sin conexión</span>}
        </span>
      </div>
      <div className="rounded-2xl bg-[#1b1b1b] p-3">
        <p className="text-xs text-white/60">Balance</p>
        <p className="text-2xl font-semibold text-mint">$2.450.000</p>
      </div>
      <div className={cn('grid flex-1 gap-2', compact ? 'grid-cols-1' : 'grid-cols-2')}>
        {cats.map(([name, pct, tone]) => (
          <div key={name} className="rounded-2xl bg-[#1b1b1b] p-3">
            <div className="flex justify-between text-xs">
              <span className="text-white/70">{name}</span>
              <span>{pct}%</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white/10">
              <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct * 2.2}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * "Tus finanzas, en el bolsillo": la misma app en computador, tablet y celular (PWA).
 * Si el navegador permite instalarla muestra "Instalar app"; si no, invita a crear la cuenta.
 */
export default function AppDevices() {
  const [device, setDevice] = useState(DEVICES[0]);
  const { canInstall, isInstalled, install } = useInstallPrompt();

  return (
    <section id="app" className="scroll-mt-20 bg-white py-24 md:py-32">
      <div className="container-page grid items-center gap-14 lg:grid-cols-[1fr_1.2fr]">
        <div className="text-obsidian">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet">App instalable</p>
          <h2 className="mt-4 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.04em] md:text-6xl">
            Tus finanzas, en el bolsillo.
          </h2>
          <p className="mt-6 max-w-md text-lg text-muted-foreground md:text-xl">
            FinTrack es una aplicación web progresiva: rápida, liviana y lista para usarse sin conexión.
          </p>
          <ol className="mt-9 space-y-4">
            {STEPS.map((step) => (
              <li key={step} className="flex items-center gap-3 text-lg">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet text-white">
                  <Check className="size-4" aria-hidden="true" />
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-10">
            {isInstalled ? (
              <p className="font-medium text-emerald-700">Ya tienes FinTrack instalada en este dispositivo.</p>
            ) : canInstall ? (
              <Button size="lg" className="rounded-full px-7" onClick={install}>
                <Download /> Instalar app
              </Button>
            ) : (
              <Button asChild size="lg" className="rounded-full px-7">
                <Link to="/registro">Empieza gratis</Link>
              </Button>
            )}
          </div>
        </div>

        <div>
          <div
            role="tablist"
            aria-label="Dispositivo"
            onKeyDown={(e) => handleTabKeys(e, DEVICES.indexOf(device), DEVICES.length, (i) => setDevice(DEVICES[i]))}
            className="mx-auto flex w-fit gap-1 rounded-full bg-card p-1"
          >
            {DEVICES.map((d) => (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={d.id === device.id}
                tabIndex={d.id === device.id ? 0 : -1}
                onClick={() => setDevice(d)}
                className={cn(
                  'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                  d.id === device.id ? 'bg-obsidian text-white' : 'text-obsidian hover:bg-pink',
                )}
              >
                <d.icon className="size-4" aria-hidden="true" />
                {d.label}
              </button>
            ))}
          </div>
          <div className="mt-8 flex h-[420px] items-center justify-center rounded-[2rem] bg-pink/60 p-6 sm:h-[460px]">
            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 220, damping: 28 }}
              className={cn('max-h-full bg-obsidian shadow-[0_30px_60px_-25px_rgba(20,20,20,0.6)]', device.frame)}
            >
              <AppScreen compact={device.id === 'celular'} />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
