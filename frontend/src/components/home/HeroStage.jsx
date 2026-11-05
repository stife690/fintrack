import { Component, Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown, ArrowRight, BarChart3, Play, Sparkles, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import HowItWorks from './HowItWorks';
import { useTour } from './tour/GuidedTour';

const LandingScene = lazy(() => import('./scene/LandingScene'));

const ABOUT_POINTS = [
  { icon: BarChart3, label: 'Reportes de ingresos y gastos' },
  { icon: Sparkles, label: 'Análisis con IA' },
  { icon: WifiOff, label: 'Funciona sin conexión' },
];

/** Si el navegador no tiene WebGL, se queda el logo plano en vez de romper la página. */
class SceneBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Barras del isotipo (viewBox 32×32): x, alto y opacidad, como en `LogoMark`. */
const FLAT_BARS = [
  { x: 8, h: 7, o: 0.55 },
  { x: 14, h: 12, o: 0.8 },
  { x: 20, h: 17, o: 1 },
];

/**
 * Logo plano animado: lo que se ve antes de que cargue el 3D, y en su lugar en equipos
 * modestos, con ahorro de datos o con "reducir movimiento". Llena el espacio reservado del
 * hero, el mismo donde se ubica el logo 3D, así el cambio de uno a otro casi no se nota.
 */
function FlatLogo({ animate }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 transition-opacity duration-500 group-data-[scene=on]/stage:opacity-0"
    >
      <svg viewBox="0 0 32 32" className="size-full drop-shadow-[0_30px_60px_rgba(97,66,255,0.45)] motion-safe:animate-float">
        <rect width="32" height="32" rx="9" fill="#6142ff" />
        {FLAT_BARS.map(({ x, h, o }, i) => (
          <motion.rect
            key={x}
            x={x}
            y={24 - h}
            width="4"
            height={h}
            rx="1.5"
            fill="#fff"
            opacity={o}
            style={{ transformBox: 'fill-box', originY: 1 }}
            initial={animate ? { scaleY: 0 } : false}
            animate={{ scaleY: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.3 + i * 0.15 }}
          />
        ))}
      </svg>
    </div>
  );
}

/**
 * ¿Vale la pena cargar el 3D en este equipo? No con "reducir movimiento", ahorro de datos,
 * 4 núcleos o menos, o 2 GB de memoria o menos: ahí el logo plano se ve bien y no traba.
 */
function canRun3D(reducedMotion) {
  if (reducedMotion || typeof navigator === 'undefined') return false;
  if (navigator.connection?.saveData) return false;
  if ((navigator.hardwareConcurrency ?? 8) <= 4) return false;
  if ((navigator.deviceMemory ?? 8) <= 2) return false;
  return true;
}

/** Eventos que cuentan como "la persona ya está aquí": a partir de ahí se carga el 3D. */
const FIRST_INTERACTION = ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'scroll', 'keydown'];

/**
 * Colores del escenario en RGB: obsidiana del hero, violeta profundo de "Qué es" (oscuro para
 * que el logo violeta de la marca resalte encima) y lavanda de "Cómo funciona".
 */
const BLACK = [0, 0, 0];
const DEEP_VIOLET = [28, 18, 72];
const LAVENDER = [246, 226, 248];
const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const stageColor = ([toAbout, toHow]) => {
  const [r, g, b] = mixRgb(mixRgb(BLACK, DEEP_VIOLET, toAbout), LAVENDER, toHow).map(Math.round);
  return `rgb(${r}, ${g}, ${b})`;
};

/** Entrada escalonada del texto del hero. */
const fadeUp = (delay) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] },
});

/**
 * Escenario del inicio: el hero y "Qué es" comparten un lienzo 3D fijo (sticky) con el logo
 * de FinTrack y figuras de finanzas. Al bajar, el fondo pasa de negro a violeta y el logo
 * viaja del centro a la derecha. El lienzo solo vive dentro de este bloque, así nunca tapa
 * las secciones siguientes, y deja de dibujar cuando sale de pantalla.
 */
export default function HeroStage() {
  const stageRef = useRef(null);
  const tour = useTour();
  const [active, setActive] = useState(true);
  const reducedMotion = useReducedMotion() ?? false;

  const aboutRef = useRef(null);
  const howRef = useRef(null);
  // Cada cambio de color va atado a la entrada de su sección, no al largo total del escenario.
  const { scrollYProgress: toAbout } = useScroll({ target: aboutRef, offset: ['start end', 'start 0.35'] });
  const { scrollYProgress: toHow } = useScroll({ target: howRef, offset: ['start end', 'start 0.4'] });
  const background = useTransform([toAbout, toHow], stageColor);
  const glowOpacity = useTransform(toAbout, [0, 0.6], [1, 0]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { rootMargin: '100px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // El 3D (≈225 KB y su compilación) espera a la primera interacción: así no compite con el
  // titular al cargar. En computador eso es apenas mover el mouse.
  const [load3D, setLoad3D] = useState(false);
  const [sceneOn, setSceneOn] = useState(false);
  useEffect(() => {
    if (!canRun3D(reducedMotion)) return undefined;
    const start = () => setLoad3D(true);
    FIRST_INTERACTION.forEach((type) => window.addEventListener(type, start, { once: true, passive: true }));
    return () => FIRST_INTERACTION.forEach((type) => window.removeEventListener(type, start));
  }, [reducedMotion]);

  return (
    <motion.div
      ref={stageRef}
      data-scene={sceneOn ? 'on' : 'off'}
      style={{ backgroundColor: background }}
      className="group/stage relative text-white"
    >
      {/*
        Lienzo 3D: una capa del tamaño exacto del escenario (recortada con `overflow: clip`, que a
        diferencia de `hidden` no rompe el sticky) y dentro, el lienzo pegado arriba de la pantalla.
      */}
      <div data-scene-layer className="pointer-events-none absolute inset-0 [overflow:clip]" aria-hidden="true">
        <div className="sticky top-0 h-[100svh] overflow-hidden">
        <motion.div
          style={{ opacity: glowOpacity }}
          className="absolute left-1/2 top-[30%] size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet/30 blur-[140px]"
        />
        {load3D && (
          <SceneBoundary fallback={null}>
            <Suspense fallback={null}>
              <LandingScene
                stageRef={stageRef}
                active={active}
                reducedMotion={reducedMotion}
                onReady={() => setSceneOn(true)}
              />
            </Suspense>
          </SceneBoundary>
        )}
        </div>
      </div>

      {/*
        Hero: logo, titular y acciones en una sola columna centrada. El logo tiene su propio
        espacio reservado (`data-logo-hero`) y el 3D se ubica justo ahí, así nunca tapa el texto,
        sea cual sea el tamaño de la pantalla. Si no cabe todo, el hero crece en vez de encimarse.
      */}
      <section
        id="inicio"
        data-stage="hero"
        className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center px-4 pb-12 pt-[calc(5.5rem+env(safe-area-inset-top))] text-center"
      >
        <div data-logo-hero className="relative mb-8 size-[clamp(6.5rem,20svh,12rem)] shrink-0 md:mb-10">
          <FlatLogo animate={!reducedMotion} />
        </div>
        <h1 className="max-w-5xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-6xl md:text-7xl lg:text-[5.25rem]">
          Todos tus ingresos y gastos en un solo lugar
        </h1>
        <motion.p {...fadeUp(0.15)} className="mt-6 max-w-xl text-pretty text-lg text-white/70 md:text-xl">
          Registra tus movimientos en segundos, mira reportes claros de a dónde va tu dinero y recibe recomendaciones
          de ahorro con inteligencia artificial.
        </motion.p>
        <motion.div {...fadeUp(0.3)} className="mt-9 flex flex-col items-center gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orchid">Un minuto, con voz</p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            {/* "Comenzar": la voz explica FinTrack y la página baja sola, sección por sección. */}
            <button
              type="button"
              onClick={tour.start}
              className="group inline-flex h-14 items-center gap-3 rounded-full bg-white pl-2 pr-7 text-lg font-semibold text-obsidian transition-[background-color,transform] hover:bg-pink motion-safe:active:scale-[0.98]"
            >
              <span className="grid size-10 place-items-center rounded-full bg-violet text-white transition-transform group-hover:scale-105">
                <Play className="size-5 translate-x-px" aria-hidden="true" />
              </span>
              Comenzar
            </button>
            <Button
              asChild
              size="lg"
              className="h-14 rounded-full px-7 text-lg motion-safe:transition-[background-color,transform] motion-safe:active:scale-[0.98]"
            >
              <Link to="/registro">
                Crear cuenta gratis <ArrowRight className="!size-5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <a href="#que-es" className="inline-flex items-center gap-1.5 text-white/60 transition-colors hover:text-white">
            o baja a tu ritmo <ArrowDown className="size-4 motion-safe:animate-bounce" aria-hidden="true" />
          </a>
        </motion.div>
      </section>

      {/* Qué es: texto a la izquierda; el logo 3D llega por la derecha. */}
      <section
        ref={aboutRef}
        id="que-es"
        data-stage="about"
        className="relative z-10 flex min-h-[110svh] scroll-mt-20 items-center pb-[10svh] pt-[30svh] lg:pt-0"
      >
        <div className="container-page">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">Qué es FinTrack</p>
            <h2 className="mt-4 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.04em] md:text-6xl lg:text-7xl">
              Tu plata, bajo control.
            </h2>
            <p className="mt-6 max-w-md text-lg text-white/80 md:text-xl">
              Tus gastos, ingresos y presupuestos, y hasta las cuentas de tu negocio, en una sola app que funciona
              incluso sin internet.
            </p>
            <ul className="mt-9 space-y-3">
              {ABOUT_POINTS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-lg font-medium">
                  <span className="grid size-10 place-items-center rounded-full bg-white/15">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div ref={howRef} className="relative">
        <HowItWorks />
      </div>
    </motion.div>
  );
}
