import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { Check, Keyboard, Loader2, Lock, Mic, MicOff, RotateCcw, Sparkles, WifiOff, X } from 'lucide-react';
import BudgetAlert from '@/components/transactions/BudgetAlert';
import { formatMoney, formatRelativeDay } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import useSpeechRecognition from '@/hooks/useSpeechRecognition';
import { cn } from '@/lib/utils';
import { parseSpokenTransaction } from '@/lib/voiceEntry';
import { saveNewTransaction } from '@/offline/saveNewTransaction';

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
 * ventana centrada. La persona dice el movimiento, revisa lo que se entendió y al tocar "Guardar"
 * se registra de una vez, igual que desde el formulario (con o sin conexión); la IA del servidor
 * le pone la categoría. Para cambiar algo antes, "Editar antes de guardar" lleva al formulario.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(draft: { type: 'gasto'|'ingreso', amount: number|null, description: string, date: string }|null) => void} props.onEdit
 *   Lleva lo entendido al formulario, o `null` si la persona prefiere escribir.
 * @param {(result: Awaited<ReturnType<typeof saveNewTransaction>>) => void} [props.onSaved]
 *   Tras guardar, para refrescar la pantalla de atrás.
 * @param {Record<string, string>} [props.names] Nombre de cada categoría por su clave.
 */
export default function VoiceEntry({ open, onClose, onEdit, onSaved, names = {} }) {
  // Se dibuja fuera de la página (portal): dentro de un panel `sticky` quedaría debajo de los
  // demás paneles. Va al contenedor con `data-theme` para conservar el tema claro u oscuro.
  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && <VoiceDialog key="voz" onClose={onClose} onEdit={onEdit} onSaved={onSaved} names={names} />}
      </AnimatePresence>
    </MotionConfig>,
    document.querySelector('[data-theme]') ?? document.body,
  );
}

function VoiceDialog({ onClose, onEdit, onSaved, names }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const speech = useSpeechRecognition();
  // Se guarda al montar, antes de que `autoFocus` mueva el foco a la ventana.
  const [opener] = useState(() => document.activeElement);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(null); // { draft, result } tras guardar

  // La última versión de onClose, para no reiniciar el efecto si el padre pasa otra función.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Mismo camino que el formulario: al servidor o, sin conexión, a la cola (FT-0009).
  const save = async (draft) => {
    setSaving(true);
    setSaveError('');
    try {
      const result = await saveNewTransaction({ ...draft, category: null });
      setSaved({ draft, result });
      onSaved?.(result);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const dictateAgain = () => {
    setSaved(null);
    speech.start();
  };

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
  if (saved) {
    content = <Saved titleId={titleId} {...saved} names={names} onAgain={dictateAgain} onDone={onClose} />;
  } else if (speech.status === 'listening') {
    content = <Listening titleId={titleId} transcript={speech.transcript} onStop={speech.stop} onCancel={speech.reset} />;
  } else if (speech.status === 'done') {
    content = (
      <Result
        key={speech.transcript}
        titleId={titleId}
        transcript={speech.transcript}
        saving={saving}
        error={saveError}
        onRetry={speech.start}
        onSave={save}
        onEdit={onEdit}
      />
    );
  } else if (speech.status === 'error') {
    content = <Problem titleId={titleId} code={speech.error} onRetry={speech.start} onWrite={() => onEdit(null)} />;
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
function Result({ titleId, transcript, saving, error, onRetry, onSave, onEdit }) {
  const parsed = useMemo(() => parseSpokenTransaction(transcript), [transcript]);
  const mustChoose = parsed.options.length > 1;
  const [amount, setAmount] = useState(mustChoose ? null : parsed.amount);
  const income = parsed.type === 'ingreso';
  const draft = { type: parsed.type, amount, description: parsed.description, date: parsed.date };
  // Sin monto o sin descripción no se puede guardar directo: se completa en el formulario.
  const complete = amount !== null && Boolean(parsed.description);

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
          {parsed.description || <span className="text-ink/45">Sin descripción</span>} · {dayLabel(parsed.date)}
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

      {error && (
        <p role="alert" className="mt-3 text-sm text-negative">
          No se pudo guardar: {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-[1fr_1.4fr] gap-3">
        <Button variant="outline" size="lg" onClick={onRetry} disabled={saving}>
          <RotateCcw aria-hidden="true" />
          Repetir
        </Button>
        {mustChoose || complete ? (
          <Button size="lg" autoFocus={!mustChoose} disabled={saving || amount === null} onClick={() => onSave(draft)}>
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
            {saving ? 'Guardando…' : income ? 'Guardar ingreso' : 'Guardar gasto'}
          </Button>
        ) : (
          <Button size="lg" autoFocus onClick={() => onEdit(draft)}>
            Completar
          </Button>
        )}
      </div>
      {(mustChoose || complete) && (
        <button
          type="button"
          onClick={() => onEdit(draft)}
          disabled={saving}
          className="mt-3 rounded-lg px-2 py-1 text-sm text-ink/60 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-violet disabled:opacity-50"
        >
          Editar antes de guardar
        </button>
      )}
    </>
  );
}

/** Ya quedó guardado: monto, categoría que puso la IA y, si aplica, la alerta del presupuesto. */
function Saved({ titleId, draft, result, names, onAgain, onDone }) {
  const { transaction, alert, offline } = result;
  const categoryName = transaction ? (names[transaction.category] ?? transaction.category) : null;
  let detail;
  if (offline) detail = 'Sin conexión: se sincroniza y se clasifica cuando vuelva internet.';
  else if (transaction.source === 'sin_clasificar') detail = 'Sin clasificar: puedes elegir la categoría editándolo.';
  else detail = `${categoryName}${transaction.source === 'ia' ? ' · sugerida por IA' : ''}`;

  return (
    <>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.45, bounce: 0.3 }}
        className="mx-auto grid size-20 place-items-center rounded-full bg-positive/15 text-positive"
      >
        <Check className="size-9" strokeWidth={2.5} aria-hidden="true" />
      </motion.div>
      <h2 id={titleId} className="mt-5 text-lg font-semibold tracking-tight">
        {offline ? 'Guardado en tu dispositivo' : draft.type === 'ingreso' ? 'Ingreso guardado' : 'Gasto guardado'}
      </h2>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{formatMoney(draft.amount)}</p>
      <p className="mt-1 text-[15px]">
        {draft.description} · {dayLabel(draft.date)}
      </p>
      <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-ink/60">
        {!offline && transaction.source === 'ia' && <Sparkles className="size-3.5 shrink-0 text-brand" aria-hidden="true" />}
        {detail}
      </p>
      <BudgetAlert alert={alert} categoryName={categoryName} className="mt-4 text-left" />
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="outline" size="lg" onClick={onAgain}>
          <Mic aria-hidden="true" />
          Dictar otro
        </Button>
        <Button size="lg" onClick={onDone} autoFocus>
          Listo
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

/** "hoy", "ayer" o "12 oct", para leerlo dentro de una frase. */
function dayLabel(iso) {
  const label = formatRelativeDay(iso);
  return label === 'Hoy' || label === 'Ayer' ? label.toLowerCase() : label;
}
