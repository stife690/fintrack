import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BadgeCheck, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AiInsightCard, ReportCard } from '@/components/charts';
import { ReceiptPaper, ReceiptRow, ReceiptStamp } from './Receipt';

const BADGES = ['Reportes de ingresos y gastos', 'Análisis con IA', 'Funciona sin conexión'];

/** Movimientos de ejemplo de la tirilla: los mismos datos que muestran la app y la sección móvil. */
const RECEIPT_ROWS = [
  { label: 'Pago monitoría', detail: 'Ingreso', value: '+$350.000' },
  { label: 'Almuerzo', detail: 'Alimentación · categoría con IA', value: '-$18.000' },
  { label: 'Recarga bus', detail: 'Transporte · categoría con IA', value: '-$20.000' },
  { label: 'Presupuesto alimentación', detail: 'Te avisamos al 80% y al 100%', value: '96%' },
];

/** Entrada escalonada de los elementos del hero. */
const fadeUp = (delay) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] },
});

/**
 * Impresora con la tirilla del mes: el papel sale de la ranura y al final cae el sello.
 * "Imprimir de nuevo" vuelve a montar el papel para repetir la animación.
 */
function ReceiptPrinter() {
  const [run, setRun] = useState(0);

  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div className="relative z-10 flex h-16 items-center justify-between rounded-t-[28px] rounded-b-xl bg-[#0b0b0b] px-5 ring-1 ring-white/10">
        <span className="text-sm font-medium text-white/70">Tu mes, impreso</span>
        <button
          type="button"
          onClick={() => setRun((n) => n + 1)}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-[background-color,transform] hover:bg-white/20 motion-safe:active:scale-95"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" /> Imprimir de nuevo
        </button>
        {/* Ranura por la que sale el papel. */}
        <span aria-hidden="true" className="absolute inset-x-6 -bottom-1 h-2 rounded-full bg-black" />
      </div>

      <div className="-mt-1 overflow-hidden px-3">
        <div key={run} className="relative motion-safe:animate-paper-feed">
          <ReceiptPaper>
            <p className="pt-1 text-xl font-bold tracking-tight">FINTRACK</p>
            <p className="mb-6 text-xs text-obsidian/60">Reporte de septiembre</p>
            {RECEIPT_ROWS.map((row) => (
              <ReceiptRow key={row.label} {...row} />
            ))}
            <ReceiptRow strong label="Ahorrado este mes" value="$830.000" className="mt-3 pt-3" />
            <ReceiptStamp className="absolute right-2 top-2 motion-safe:animate-stamp motion-safe:[animation-delay:2.2s]">
              Categorizado con IA
            </ReceiptStamp>
          </ReceiptPaper>
        </div>
      </div>
    </div>
  );
}

/**
 * Hero oscuro: insignias, titular, CTAs y la composición reporte + tirilla + análisis con IA.
 */
export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-black pb-16 pt-[calc(9rem+env(safe-area-inset-top))] text-white md:pb-24 md:pt-44">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[58%] size-[560px] -translate-x-1/2 rounded-full bg-violet/25 blur-[140px]"
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

        {/* Sin animación de entrada: es el elemento más grande (LCP) y debe pintarse de inmediato. */}
        <h1 className="mt-6 max-w-5xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-6xl md:text-7xl lg:text-[5.5rem]">
          Todos tus ingresos y gastos en un solo lugar
        </h1>

        <motion.p {...fadeUp(0.2)} className="mt-6 max-w-xl text-pretty text-lg text-white/65 md:text-xl">
          Registra tus movimientos en segundos, mira reportes claros de a dónde va tu dinero y recibe recomendaciones
          de ahorro con inteligencia artificial.
        </motion.p>

        <motion.div {...fadeUp(0.3)} className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          <Button
            asChild
            size="lg"
            className="w-full rounded-full px-7 sm:w-auto motion-safe:transition-[background-color,transform] motion-safe:active:scale-[0.98] [&_svg]:transition-transform hover:[&_svg]:translate-x-0.5"
          >
            <Link to="/registro">
              Crear cuenta gratis <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="text-white/70 hover:text-white">
            <a href="#funcionalidades">Ver funcionalidades</a>
          </Button>
        </motion.div>

        {/*
          Composición: reporte | tirilla del mes | análisis con IA.
          En celular la tirilla va primero y sola; las tarjetas aparecen desde tablet.
        */}
        <div className="mt-16 grid w-full max-w-6xl items-start gap-6 sm:grid-cols-2 md:mt-20 lg:grid-cols-[1fr_340px_1fr]">
          <motion.div
            className="sm:col-span-2 lg:order-2 lg:col-span-1"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <ReceiptPrinter />
          </motion.div>

          <motion.div
            className="hidden sm:block lg:order-1 lg:mt-24"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <ReportCard />
          </motion.div>

          <motion.div
            className="hidden sm:block lg:order-3 lg:mt-24"
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
