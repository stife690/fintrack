import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { ArrowDownLeft, Bus, CheckCheck, Mic, PenLine, SendHorizontal, Sparkles, UtensilsCrossed } from 'lucide-react';
import { LogoMark } from '@/components/common/Logo';

const STEPS = [
  { icon: PenLine, title: 'Escribe o dicta el gasto', detail: '“almuerzo 18 mil” es suficiente.' },
  { icon: Sparkles, title: 'La IA le pone la categoría', detail: 'Siempre puedes corregirla.' },
  { icon: CheckCheck, title: 'Queda en tu panel', detail: 'Incluso sin internet: se sincroniza solo.' },
];

/** Movimientos anteriores de la pantalla (los mismos datos de ejemplo de la app). */
const HISTORY = [
  { icon: ArrowDownLeft, label: 'Pago monitoría', detail: 'Ingreso · Ayer', amount: '+$350.000', income: true },
  { icon: Bus, label: 'Recarga bus', detail: 'Transporte · Ayer', amount: '-$20.000' },
];

const TYPED = 'almuerzo 18 mil';

/**
 * Celular de demostración: se escribe "almuerzo 18 mil", la IA "piensa" y aparece el movimiento
 * ya categorizado. Arriba deja un hueco (`data-logo-slot`) donde aterriza el logo 3D.
 */
function PhoneDemo() {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.5 });
  const [chars, setChars] = useState(0);
  const [phase, setPhase] = useState('typing'); // typing → thinking → done

  useEffect(() => {
    if (!inView) {
      setChars(0);
      setPhase('typing');
      return undefined;
    }
    const timers = [];
    for (let i = 1; i <= TYPED.length; i += 1) timers.push(setTimeout(() => setChars(i), 500 + i * 70));
    const typedAt = 500 + TYPED.length * 70;
    timers.push(setTimeout(() => setPhase('thinking'), typedAt + 350));
    timers.push(setTimeout(() => setPhase('done'), typedAt + 1300));
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  return (
    <div ref={ref} className="mx-auto w-full max-w-[330px] rounded-[3rem] bg-obsidian p-3 shadow-[0_40px_80px_-30px_rgba(20,20,20,0.55)]">
      <div className="relative overflow-hidden rounded-[2.4rem] bg-white px-4 pb-5 pt-4 text-obsidian">
        <div className="mx-auto h-6 w-24 rounded-full bg-obsidian" aria-hidden="true" />

        {/* Hueco del logo: el 3D aterriza aquí al bajar. */}
        <div className="mt-5 flex flex-col items-center gap-2">
          <div data-logo-slot className="size-16">
            {/* Sin 3D (equipo modesto o aún cargando) se ve el logo plano; con 3D, aterriza el otro encima. */}
            <LogoMark className="size-16 rounded-2xl transition-opacity duration-500 group-data-[scene=on]/stage:opacity-0" />
          </div>
          <p className="text-sm font-semibold">FinTrack</p>
        </div>

        <ul className="mt-5 space-y-2">
          <AnimatePresence initial={false}>
            {phase === 'done' && (
              <motion.li
                key="nuevo"
                initial={{ opacity: 0, y: -12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                className="flex items-center gap-3 rounded-2xl bg-pink/70 px-3 py-2.5 ring-1 ring-violet/25"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-violet text-white">
                  <UtensilsCrossed className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Almuerzo</p>
                  <p className="flex items-center gap-1 text-xs text-violet">
                    <Sparkles className="size-3" aria-hidden="true" /> Alimentación
                  </p>
                </div>
                <span className="text-sm font-semibold">-$18.000</span>
              </motion.li>
            )}
          </AnimatePresence>
          {HISTORY.map(({ icon: Icon, label, detail, amount, income }) => (
            <li key={label} className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2.5">
              <span className={`grid size-9 place-items-center rounded-xl ${income ? 'bg-mint text-emerald-700' : 'bg-white text-obsidian'}`}>
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{detail}</p>
              </div>
              <span className={`text-sm font-semibold ${income ? 'text-emerald-700' : ''}`}>{amount}</span>
            </li>
          ))}
        </ul>

        {/* Campo de registro rápido con el texto que se va escribiendo. */}
        <div className="mt-5 flex items-center gap-2 rounded-full bg-card py-1.5 pl-4 pr-1.5">
          <p className="min-h-5 flex-1 truncate text-sm" aria-live="polite">
            {TYPED.slice(0, chars)}
            {phase === 'typing' && <span className="ml-px inline-block h-4 w-px translate-y-0.5 animate-pulse bg-obsidian" />}
            {phase === 'thinking' && <span className="ml-2 text-violet">clasificando…</span>}
          </p>
          <span className="grid size-8 place-items-center rounded-full text-muted-foreground">
            <Mic className="size-4" aria-hidden="true" />
          </span>
          <span className="grid size-8 place-items-center rounded-full bg-violet text-white">
            <SendHorizontal className="size-4" aria-hidden="true" />
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * "Cómo funciona": vive dentro del escenario 3D. El fondo ya es lavanda y el logo
 * baja hasta la pantalla del celular.
 */
export default function HowItWorks() {
  return (
    <section
      id="como-funciona"
      data-stage="how"
      // Fondo propio que se funde desde transparente: el texto oscuro nunca queda sobre el negro del
      // escenario aunque el color animado aún no haya cambiado (p. ej. al saltar con un enlace).
      className="relative z-10 scroll-mt-20 bg-[linear-gradient(to_bottom,transparent,#f6e2f8_20svh)] pb-24 pt-[20svh] text-obsidian md:pb-32"
    >
      <div className="container-page grid items-center gap-14 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet">Cómo funciona</p>
          <h2 className="mt-4 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.04em] md:text-6xl lg:text-7xl">
            Registra en segundos.
          </h2>
          <p className="mt-6 max-w-md text-lg text-obsidian/70 md:text-xl">
            Escribe el monto y una descripción; la inteligencia artificial clasifica el gasto automáticamente. Siempre
            puedes corregirla.
          </p>
          <ol className="mt-10 space-y-6">
            {STEPS.map(({ icon: Icon, title, detail }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-obsidian text-white">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-lg font-semibold">{title}</p>
                  <p className="text-obsidian/65">{detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <PhoneDemo />
      </div>
    </section>
  );
}
