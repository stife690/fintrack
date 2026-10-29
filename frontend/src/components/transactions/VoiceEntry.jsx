import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { Keyboard, Lock, Mic, MicOff, RotateCcw, Sparkles, WifiOff, X } from 'lucide-react';
import { formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import useSpeechRecognition from '@/hooks/useSpeechRecognition';
import { cn } from '@/lib/utils';
import { parseSpokenTransaction } from '@/lib/voiceEntry';

const EXAMPLES = ['almuerzo 15 mil', 'taxi 12 mil', 'me pagaron 1,2 millones'];

/** Qué decir en cada error del dictado y si tiene sentido volver a intentar. */
const PROBLEMS = {
  denied: {
    icon: MicOff,
    title: 'FinTrack no puede usar el micrófono',
    text: 'Permítelo en los ajustes del navegador (el ícono junto a la dirección) y vuelve a intentarlo.',
    retry: true,
  },
  offline: {
    icon: WifiOff,
    title: 'Dictar necesita internet',
    text: 'Escribiendo sí funciona sin conexión: se guarda en tu dispositivo y se sincroniza después.',
    retry: false,
  },
  'no-speech': {
    icon: Mic,
    title: 'No te escuchamos',
    text: 'Acércate al micrófono y di el movimiento, por ejemplo “almuerzo 15 mil”.',
    retry: true,
  },
  'no-mic': {
    icon: MicOff,
    title: 'No encontramos un micrófono',
    text: 'Conecta uno o escribe el movimiento.',
    retry: false,
  },
  unavailable: {
    icon: MicOff,
    title: 'No se pudo usar el dictado',
    text: 'Intenta de nuevo o escribe el movimiento.',
    retry: true,
  },
};

/** Curva tipo iOS para hojas y ventanas: arranca rápido y frena suave. */
const EASE_DRAWER = [0.32, 0.72, 0, 1];

/**
 * Registro por voz (FT-0013). En celular es una hoja que sube desde abajo; desde tablet, una
 * ventana centrada. La persona dice el movimiento, revisa lo que se entendió y con "Usar estos
 * datos" se llena el formulario de siempre, que es el que guarda (con o sin conexión).
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(draft: { type: 'gasto'|'ingreso', amount: number|null, description: string }|null) => void} props.onUse
 *   Recibe lo que se entendió, o `null` si la persona prefiere escribir.
 */
export default function VoiceEntry({ open, onClose, onUse }) {
  // Se dibuja fuera de la página (portal): dentro de un panel `sticky` quedaría debajo de los
  // demás paneles. Va al contenedor con `data-theme` para conservar el tema claro u oscuro.
  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>{open && <VoiceDialog key="voz" onClose={onClose} onUse={onUse} />}</AnimatePresence>
    </MotionConfig>,
    document.querySelector('[data-theme]') ?? document.body,
  );
}

function VoiceDialog({ onClose, onUse }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const speech = useSpeechRecognition();
  // Se guarda al montar, antes de que `autoFocus` mueva el foco a la ventana.
  const [opener] = useState(() => document.activeElement);

  // La última versión de onClose, para no reiniciar el efecto si el padre pasa otra función.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Mientras está abierta: la página no se desplaza, Escape cierra, Tab no sale de la ventana
  // y al cerrar el foco vuelve al botón que la abrió.
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab') return;
      const focusable = [...panelRef.current.querySelectorAll('button:not([disabled])')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKeyDown);
      opener?.focus?.();
    };
  }, [opener]);

  let content;
  if (speech.status === 'listening') {
    content = <Listening titleId={titleId} transcript={speech.transcript} onStop={speech.stop} onCancel={speech.reset} />;
  } else if (speech.status === 'done') {
    content = <Result key={speech.transcript} titleId={titleId} transcript={speech.transcript} onRetry={speech.start} onUse={onUse} />;
  } else if (speech.status === 'error') {
    content = <Problem titleId={titleId} code={speech.error} onRetry={speech.start} onWrite={() => onUse(null)} />;
  } else {
    content = <Ready titleId={titleId} onStart={speech.start} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24, transition: { duration: 0.18 } }}
        transition={{ duration: 0.32, ease: EASE_DRAWER }}
        className="relative w-full max-w-md rounded-t-3xl bg-canvas px-6 pb-[calc(1.75rem+env(safe-area-inset-bottom))] pt-3 text-center text-ink shadow-2xl ring-1 ring-ink/10 md:rounded-3xl md:pb-7 md:pt-7"
      >
        <div aria-hidden="true" className="mx-auto mb-6 h-1 w-10 rounded-full bg-ink/20 md:hidden" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-violet"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
        {content}
      </motion.div>
    </div>
  );
}

/** Antes de hablar: qué decir y el aviso de privacidad. */
function Ready({ titleId, onStart }) {
  return (
    <>
      <MicOrb />
      <h2 id={titleId} className="mt-5 text-xl font-semibold tracking-tight">
        Toca y di tu movimiento
      </h2>
      <p className="mt-1 text-sm text-ink/60">Como se lo dirías a un amigo.</p>
      <ul className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Ejemplos">
        {EXAMPLES.map((example) => (
          <li key={example} className="rounded-full bg-brand-soft px-3 py-1 text-xs text-brand">
            “{example}”
          </li>
        ))}
      </ul>
      <Button size="lg" className="mt-6 w-full" onClick={onStart} autoFocus>
        <Mic aria-hidden="true" />
        Empezar a hablar
      </Button>
      <p className="mt-4 flex items-start justify-center gap-1.5 text-xs text-ink/50">
        <Lock className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        Tu navegador convierte la voz en texto. FinTrack no guarda el audio.
      </p>
    </>
  );
}

/** Mientras escucha: el texto aparece a medida que se habla. */
function Listening({ titleId, transcript, onStop, onCancel }) {
  return (
    <>
      <MicOrb listening />
      <Wave />
      <h2 id={titleId} className="sr-only">
        Escuchando
      </h2>
      <p className="mt-4 min-h-10 text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">
        {transcript || <span className="text-ink/35">Te escucho…</span>}
      </p>
      <p className="mt-1 text-sm text-ink/55">Se detiene sola cuando dejas de hablar.</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="outline" size="lg" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="lg" onClick={onStop} autoFocus>
          Listo
        </Button>
      </div>
    </>
  );
}

/** Lo que se entendió. Si se dijo una cantidad ("2 almuerzos de 12 mil"), la persona elige el monto. */
function Result({ titleId, transcript, onRetry, onUse }) {
  const parsed = useMemo(() => parseSpokenTransaction(transcript), [transcript]);
  const mustChoose = parsed.options.length > 1;
  const [amount, setAmount] = useState(mustChoose ? null : parsed.amount);
  const income = parsed.type === 'ingreso';

  let shownAmount = <span className="text-ink/35">¿Cuánto?</span>;
  if (amount !== null) shownAmount = formatMoney(amount);
  else if (mustChoose) shownAmount = <span className="text-ink/35">Elige abajo</span>;

  return (
    <>
      <h2 id={titleId} className="text-sm font-normal text-ink/55 [overflow-wrap:anywhere]">
        “{transcript}”
      </h2>
      <div className="mt-4 rounded-2xl bg-surface-muted p-4 text-left ring-1 ring-brand/30" role="status">
        <div className="flex items-center justify-between gap-3">
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium',
              income ? 'bg-positive/12 text-positive' : 'bg-negative/12 text-negative',
            )}
          >
            {income ? 'Ingreso' : 'Gasto'}
          </span>
          <span className="text-3xl font-semibold tabular-nums tracking-tight">{shownAmount}</span>
        </div>
        <p className="mt-2 text-[15px]">
          {parsed.description || <span className="text-ink/45">Sin descripción</span>} · hoy
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink/55">
          <Sparkles className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
          La IA elige la categoría al guardar.
        </p>
      </div>

      {mustChoose && (
        <fieldset className="mt-4">
          <legend className="mx-auto mb-2 text-sm text-ink/70">Dijiste más de un número. ¿Cuánto fue?</legend>
          <div className="grid grid-cols-2 gap-2">
            {parsed.options.map((value, index) => (
              <button
                key={value}
                type="button"
                aria-pressed={amount === value}
                onClick={() => setAmount(value)}
                className={cn(
                  'rounded-xl px-3 py-2.5 text-sm font-medium tabular-nums ring-1 transition-[background-color,box-shadow,transform] duration-150 focus-visible:outline-2 focus-visible:outline-violet motion-safe:active:scale-[0.97]',
                  amount === value ? 'bg-brand-soft text-brand ring-brand/40' : 'ring-ink/15 hover:bg-ink/5',
                )}
              >
                {formatMoney(value)}
                {index === 1 && (
                  <span className="block text-xs font-normal text-ink/55">
                    {value / parsed.options[0]} × {formatMoney(parsed.options[0])}
                  </span>
                )}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {parsed.amount === null && (
        <p className="mt-3 text-sm text-ink/60">No escuchamos el monto: repítelo o escríbelo en el formulario.</p>
      )}

      <div className="mt-6 grid grid-cols-[1fr_1.4fr] gap-3">
        <Button variant="outline" size="lg" onClick={onRetry}>
          <RotateCcw aria-hidden="true" />
          Repetir
        </Button>
        <Button
          size="lg"
          autoFocus={!mustChoose}
          disabled={mustChoose && amount === null}
          onClick={() => onUse({ type: parsed.type, amount, description: parsed.description })}
        >
          Usar estos datos
        </Button>
      </div>
    </>
  );
}

/** Algo impidió dictar: qué pasó y la salida (intentar de nuevo o escribir). */
function Problem({ titleId, code, onRetry, onWrite }) {
  const { icon: Icon, title, text, retry } = PROBLEMS[code] ?? PROBLEMS.unavailable;
  return (
    <>
      <div className="mx-auto grid size-20 place-items-center rounded-full bg-ink/5 text-ink/70">
        <Icon className="size-8" aria-hidden="true" />
      </div>
      <h2 id={titleId} className="mt-5 text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-2 text-sm text-ink/60">{text}</p>
      <div className="mt-6 grid gap-3">
        {retry && (
          <Button size="lg" onClick={onRetry} autoFocus>
            <Mic aria-hidden="true" />
            Intentar de nuevo
          </Button>
        )}
        <Button size="lg" variant={retry ? 'outline' : 'default'} onClick={onWrite} autoFocus={!retry}>
          <Keyboard aria-hidden="true" />
          Escribir en vez de hablar
        </Button>
      </div>
    </>
  );
}

/** Círculo del micrófono; mientras escucha, dos anillos se expanden como ondas. */
function MicOrb({ listening = false }) {
  return (
    <div className="relative mx-auto grid size-20 place-items-center">
      {listening && (
        <>
          <span className="absolute inset-0 rounded-full border-2 border-brand opacity-0 motion-safe:animate-voice-ring" />
          <span className="absolute inset-0 rounded-full border-2 border-brand opacity-0 motion-safe:animate-voice-ring [animation-delay:0.55s]" />
        </>
      )}
      <span
        className={cn(
          'relative grid size-20 place-items-center rounded-full transition-colors duration-200',
          listening ? 'bg-brand text-white' : 'bg-brand-soft text-brand',
        )}
      >
        <Mic className="size-8" aria-hidden="true" />
      </span>
    </div>
  );
}

/** Barras de onda decorativas mientras se escucha (solo se mueven con transform). */
function Wave() {
  return (
    <div aria-hidden="true" className="mt-5 flex h-6 items-center justify-center gap-1">
      {[0, 0.15, 0.3, 0.1, 0.25, 0.05, 0.2].map((delay) => (
        <span
          key={delay}
          className="h-6 w-1 origin-center scale-y-[0.3] rounded-full bg-brand motion-safe:animate-voice-wave"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}
