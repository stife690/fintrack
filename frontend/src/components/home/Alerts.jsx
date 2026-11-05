import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { AlertTriangle, Bell, CalendarClock } from 'lucide-react';
import { LogoMark } from '@/components/common/Logo';

/** Avisos reales de FinTrack: presupuesto al 80%, al 100% y cuenta por vencer. */
const NOTIFICATIONS = [
  { icon: Bell, tone: 'bg-amber-400 text-obsidian', title: 'Alimentación', text: 'Vas en el 80% de tu presupuesto de este mes.' },
  {
    icon: AlertTriangle,
    tone: 'bg-destructive text-white',
    title: 'Entretenimiento',
    text: 'Excediste el presupuesto (110%).',
  },
  { icon: CalendarClock, tone: 'bg-mint text-emerald-800', title: 'Mañana vence', text: 'Le debes $40.000 a Camila.' },
];

/**
 * Alertas: fondo obsidiana con los avisos cayendo uno tras otro, como en la pantalla bloqueada.
 */
export default function Alerts() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.45 });

  return (
    <section ref={ref} id="alertas" className="scroll-mt-20 overflow-hidden bg-obsidian py-24 text-white md:py-32">
      <div className="container-page grid items-center gap-14 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orchid">Alertas</p>
          <h2 className="mt-4 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.04em] md:text-6xl">
            Te avisamos antes de pasarte.
          </h2>
          <p className="mt-6 max-w-md text-lg text-white/70 md:text-xl">
            Recibe una alerta al llegar al 80% y al 100% de cada presupuesto, y un día antes de que venza una cuenta.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <p className="mb-6 text-center text-6xl font-semibold tracking-[-0.04em] text-white/90 tabular-nums">9:41</p>
          <ul className="space-y-3">
            {NOTIFICATIONS.map(({ icon: Icon, tone, title, text }, i) => (
              <motion.li
                key={title}
                initial={{ opacity: 0, y: -24, scale: 0.96 }}
                animate={inView ? { opacity: 1, y: 0, scale: 1 } : undefined}
                transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.25 + i * 0.45 }}
                className="flex items-start gap-3 rounded-3xl bg-white/[0.08] p-4 ring-1 ring-white/10 backdrop-blur"
              >
                <LogoMark className="size-10 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">FinTrack</p>
                    <span className="text-xs text-white/50">ahora</span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
                    <span className={`grid size-5 place-items-center rounded-full ${tone}`}>
                      <Icon className="size-3" aria-hidden="true" />
                    </span>
                    {title}
                  </p>
                  <p className="text-sm text-white/70">{text}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
