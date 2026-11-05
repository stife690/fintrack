import { createContext, useContext, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Pause, Play, RotateCcw, VolumeX, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import useGuidedTour, { TOUR_DURATION, TOUR_SEGMENTS } from './useGuidedTour';

/** Nombre corto de cada sección para el reproductor. */
const LABELS = {
  inicio: 'Inicio',
  'que-es': 'Qué es',
  'como-funciona': 'Cómo funciona',
  funcionalidades: 'Funcionalidades',
  alertas: 'Alertas',
  app: 'App',
  seguridad: 'Seguridad',
  empieza: 'Empieza',
};

const TourContext = createContext({ status: 'idle', start: () => {} });

/** `start` y `status` del recorrido, para el botón "Comenzar" del hero. */
export const useTour = () => useContext(TourContext);

/**
 * Reproductor flotante: botón de pausa/seguir, la sección y la frase que suenan (subtítulos),
 * el avance por secciones y cerrar. Al terminar invita a crear la cuenta.
 */
function TourPlayer({ tour }) {
  const { status, index, progress, muted, pause, resume, start, stop } = tour;
  const playing = status === 'playing';
  const done = status === 'done';
  const segment = TOUR_SEGMENTS[index];

  return (
    <motion.div
      role="region"
      aria-label="Recorrido con voz"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto w-[calc(100%-2rem)] max-w-xl rounded-3xl bg-obsidian/95 p-3 text-white shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-md"
    >
      <div className="flex items-center gap-3">
        {done ? (
          <button
            type="button"
            onClick={start}
            aria-label="Repetir el recorrido"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          >
            <RotateCcw className="size-5" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={playing ? pause : resume}
            aria-label={playing ? 'Pausar el recorrido' : 'Seguir el recorrido'}
            className="grid size-12 shrink-0 place-items-center rounded-full bg-violet transition-[background-color,transform] hover:bg-violet-light motion-safe:active:scale-95"
          >
            {playing ? <Pause className="size-5" aria-hidden="true" /> : <Play className="size-5 translate-x-px" aria-hidden="true" />}
          </button>
        )}

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-medium text-orchid">
            {done ? 'Fin del recorrido' : LABELS[segment.id]}
            {muted && !done && (
              <span className="inline-flex items-center gap-1 text-white/50">
                <VolumeX className="size-3" aria-hidden="true" /> sin audio
              </span>
            )}
            {status === 'paused' && <span className="text-white/50">· en pausa</span>}
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-white/90">
            {done ? 'Crea tu cuenta gratis y anota tu primer gasto.' : segment.text}
          </p>
        </div>

        {done ? (
          <Link
            to="/registro"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-violet transition-colors hover:bg-white/90"
          >
            Crear cuenta <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        ) : null}
        <button
          type="button"
          onClick={stop}
          aria-label="Cerrar el recorrido"
          className="grid size-9 shrink-0 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Avance por secciones: un tramo por frase, proporcional a lo que dura. */}
      <div className="mt-3 flex gap-1 px-1" aria-hidden="true">
        {TOUR_SEGMENTS.map((s) => {
          const t = progress * TOUR_DURATION;
          const fill = Math.min(Math.max((t - s.start) / (s.end - s.start), 0), 1);
          return (
            <span key={s.id} className="h-1 overflow-hidden rounded-full bg-white/15" style={{ flexGrow: s.end - s.start }}>
              <span className={cn('block h-full rounded-full bg-violet-light')} style={{ width: `${(done ? 1 : fill) * 100}%` }} />
            </span>
          );
        })}
      </div>
    </motion.div>
  );
}

/**
 * Envuelve la landing: mantiene el estado del recorrido y muestra el reproductor.
 * La landing llega como `children`, así el avance del audio (que cambia cada cuadro)
 * solo vuelve a pintar el reproductor y no toda la página.
 */
export default function GuidedTour({ children }) {
  const tour = useGuidedTour();
  const value = useMemo(() => ({ status: tour.status, start: tour.start }), [tour.status, tour.start]);

  return (
    <TourContext.Provider value={value}>
      {children}
      <AnimatePresence>{tour.status !== 'idle' && <TourPlayer key="tour" tour={tour} />}</AnimatePresence>
    </TourContext.Provider>
  );
}
