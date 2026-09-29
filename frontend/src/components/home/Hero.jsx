import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AiInsightCard, ReportCard } from '@/components/charts';

const BADGES = ['Reportes de ingresos y gastos', 'Análisis con IA', 'Funciona sin conexión'];

/** Entrada escalonada de los elementos del hero. */
const fadeUp = (delay) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] },
});

/**
 * Hero oscuro: insignias, titular, CTAs y la composición reporte + moneda + análisis con IA.
 */
export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-black pb-16 pt-36 text-white md:pb-24 md:pt-44">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[55%] size-[520px] -translate-x-1/2 rounded-full bg-violet/25 blur-[140px]"
      />

      <div className="container-page relative flex flex-col items-center text-center">
        <motion.ul {...fadeUp(0)} className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-white/70">
          {BADGES.map((badge) => (
            <li key={badge} className="inline-flex items-center gap-2">
              <BadgeCheck className="size-5 fill-orchid text-black" aria-hidden="true" />
              {badge}
            </li>
          ))}
        </motion.ul>

        <motion.h1
          {...fadeUp(0.1)}
          className="mt-6 max-w-4xl text-balance text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl"
        >
          Todos tus ingresos y gastos en un solo lugar
        </motion.h1>

        <motion.p {...fadeUp(0.2)} className="mt-6 max-w-xl text-pretty text-lg text-white/60">
          Registra tus movimientos en segundos, mira reportes claros de a dónde va tu dinero y recibe recomendaciones
          de ahorro con inteligencia artificial.
        </motion.p>

        <motion.div {...fadeUp(0.3)} className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Button asChild size="lg">
            <Link to="/registro">
              Crear cuenta gratis <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <a href="#funcionalidades">Ver funcionalidades</a>
          </Button>
        </motion.div>

        {/*
          Composición visual: reporte | moneda 3D (asset de la plantilla) | análisis con IA.
          Columnas separadas: ninguna tarjeta se superpone a la moneda.
          En móvil/tablet la moneda va arriba y las tarjetas debajo.
        */}
        <div className="mt-16 grid w-full max-w-6xl items-center gap-6 sm:grid-cols-2 md:mt-20 lg:grid-cols-[1fr_300px_1fr] xl:grid-cols-[1fr_360px_1fr]">
          <motion.img
            src="/images/homepage/coin.webp"
            alt=""
            aria-hidden="true"
            width="640"
            height="640"
            fetchpriority="high"
            decoding="async"
            className="mx-auto w-56 animate-float sm:col-span-2 sm:w-64 lg:order-2 lg:col-span-1 lg:w-full"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          />

          <motion.div
            className="lg:order-1"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <ReportCard />
          </motion.div>

          <motion.div
            className="lg:order-3"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <AiInsightCard />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
