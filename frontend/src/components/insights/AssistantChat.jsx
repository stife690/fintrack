import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUp, RotateCcw, Sparkles } from 'lucide-react';
import Panel from '@/components/layout/Panel';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import { askAssistant, MAX_QUESTION_CHARS } from '@/services/assistantService';

/** Preguntas para empezar: se tocan y se envían. */
export const SUGGESTIONS = [
  '¿En qué gasto más?',
  '¿Cuánto puedo ahorrar este mes?',
  '¿Voy bien con mis presupuestos?',
  '¿Cómo armo un fondo de emergencia?',
];

/**
 * Texto del error para la persona.
 * @param {Error & { code?: string }} err
 * @param {boolean} online
 * @returns {string}
 */
function errorText(err, online) {
  if (!online) return 'Sin conexión. El asistente necesita internet.';
  if (err.code === 'AI_UNAVAILABLE') return 'El asistente no está disponible ahora. Inténtalo en unos minutos.';
  return err.message;
}

/**
 * Chat con el asistente financiero dentro de Insights. Responde con los totales del mes del
 * usuario (la API nunca le pasa descripciones a la IA). La conversación vive solo en esta
 * pantalla: al salir se borra.
 * @param {{ className?: string }} props
 */
export default function AssistantChat({ className }) {
  const online = useOnlineStatus();
  const titleId = useId();
  const [messages, setMessages] = useState([]); // ChatMessage[]
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const logRef = useRef(null);
  const inputRef = useRef(null);

  // La lista crece hacia abajo: se baja sola para mostrar lo último.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, pending, error]);

  /** Envía la conversación con la pregunta nueva (o reintenta la última si no hay pregunta). */
  async function send(conversation) {
    setMessages(conversation);
    setPending(true);
    setError(null);
    try {
      const reply = await askAssistant(conversation);
      setMessages([...conversation, { role: 'assistant', text: reply }]);
    } catch (err) {
      setError(errorText(err, online));
    } finally {
      setPending(false);
    }
  }

  function ask(question) {
    const text = question.trim();
    if (!text || pending) return;
    setDraft('');
    send([...messages, { role: 'user', text }]);
    inputRef.current?.focus();
  }

  function restart() {
    setMessages([]);
    setError(null);
    setDraft('');
    inputRef.current?.focus();
  }

  return (
    <Panel aria-labelledby={titleId} className={cn('flex flex-col', className)}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            Pregúntale a FinTrack
          </h2>
          <p className="text-sm text-ink/70">Responde con los totales de tu mes.</p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={restart}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
          >
            <RotateCcw className="size-4" aria-hidden="true" /> Nueva
          </button>
        )}
      </div>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-busy={pending}
        className="mt-4 flex max-h-[26rem] min-h-40 flex-col gap-3 overflow-y-auto overscroll-contain py-1"
      >
        {messages.length === 0 ? (
          <div className="my-auto">
            <p className="text-sm text-ink/70">Prueba con una de estas preguntas:</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => ask(suggestion)}
                    className="rounded-full border border-ink/15 px-3.5 py-2 text-left text-sm text-ink/80 transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet motion-safe:active:scale-[0.98]"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          messages.map((message, index) => (
            <p
              key={index}
              className={cn(
                'max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed motion-safe:animate-fade-up',
                message.role === 'user'
                  ? 'self-end rounded-br-md bg-primary text-primary-foreground'
                  : 'self-start rounded-bl-md bg-surface-muted text-ink',
              )}
            >
              <span className="sr-only">{message.role === 'user' ? 'Tú: ' : 'FinTrack: '}</span>
              {message.text}
            </p>
          ))
        )}

        {pending && (
          <p className="flex items-center gap-1 self-start rounded-2xl rounded-bl-md bg-surface-muted px-4 py-3">
            <span className="sr-only">FinTrack está escribiendo…</span>
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                aria-hidden="true"
                className="size-1.5 rounded-full bg-ink/40 motion-safe:animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </p>
        )}

        {error && (
          <p role="alert" className="self-start text-sm text-negative">
            {error}{' '}
            <button type="button" className="underline" onClick={() => send(messages)}>
              Reintentar
            </button>
          </p>
        )}
      </div>

      <form
        className="mt-4 flex items-center gap-2 rounded-full border border-ink/15 bg-canvas py-1.5 pl-4 pr-1.5 focus-within:border-brand/50"
        onSubmit={(event) => {
          event.preventDefault();
          ask(draft);
        }}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Escribe tu pregunta"
          placeholder="¿Cuánto llevo en domicilios?"
          maxLength={MAX_QUESTION_CHARS}
          enterKeyHint="send"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-base text-ink placeholder:text-ink/45 focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Enviar pregunta"
          disabled={pending || !draft.trim()}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-[transform,opacity] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet disabled:opacity-40 motion-safe:active:scale-95"
        >
          <ArrowUp className="size-5" aria-hidden="true" />
        </button>
      </form>
      <p className="mt-2 text-xs text-ink/55">
        Es orientación, no asesoría financiera. No escribas cédulas ni números de cuenta.
      </p>
    </Panel>
  );
}
