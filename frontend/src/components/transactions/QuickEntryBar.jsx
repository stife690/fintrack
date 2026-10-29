import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, Mic, Zap } from 'lucide-react';
import VoiceEntry from '@/components/transactions/VoiceEntry';
import useAsync from '@/hooks/useAsync';
import { canDictate as browserCanDictate } from '@/hooks/useSpeechRecognition';
import { cn } from '@/lib/utils';
import { getCategories } from '@/services/transactionService';

/**
 * Alto del teclado del celular sobre la página (0 si está cerrado). En iPhone el teclado tapa los
 * elementos fijos de abajo en vez de empujarlos: con esto la barra se sube justo encima.
 * @returns {number} Píxeles.
 */
function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const update = () =>
      setInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}

/**
 * Barra rápida para anotar un movimiento (FT-0013), fija abajo en Inicio y Movimientos. Se
 * escribe la frase ("almuerzo 15 mil") o se toca el micrófono; en los dos casos se abre la misma
 * tarjeta para revisar y guardar. Sin texto el botón es el micrófono; con texto, la flecha de enviar.
 * Escribir funciona sin conexión: se guarda en el dispositivo y se sincroniza después.
 */
export default function QuickEntryBar() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [text, setText] = useState('');
  // Qué abre la ventana: la frase escrita, o el micrófono escuchando de una vez.
  const [entry, setEntry] = useState(null);
  // "Escribir en vez de hablar": el cursor va a la barra cuando la ventana termina de cerrarse.
  const focusOnClose = useRef(false);
  const keyboard = useKeyboardInset();
  const canDictate = browserCanDictate();
  const hasText = text.trim().length > 0;

  const categories = useAsync(getCategories, []);
  const names = useMemo(() => {
    const all = categories.data ? [...categories.data.expense, ...categories.data.income] : [];
    return Object.fromEntries(all.map((c) => [c.key, c.name]));
  }, [categories.data]);

  const submit = (event) => {
    event.preventDefault();
    if (!hasText) {
      inputRef.current?.focus();
      return;
    }
    inputRef.current?.blur(); // cierra el teclado antes de abrir la tarjeta
    setEntry({ text });
  };

  // "Editar antes de guardar" lleva al formulario de Movimientos; "Escribir" vuelve a la barra.
  const edit = (draft) => {
    setEntry(null);
    if (draft) navigate('/app/transacciones', { state: { voiceDraft: draft } });
    else focusOnClose.current = true;
  };

  return (
    <>
      <form
        onSubmit={submit}
        aria-label="Anotar un movimiento"
        style={keyboard > 80 ? { bottom: keyboard + 8 } : undefined}
        className={cn(
          'fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-2xl items-center gap-2 rounded-full',
          'bg-surface-muted py-1.5 pl-4 pr-1.5 ring-1 ring-ink/10 backdrop-blur-xl transition-[box-shadow,background-color] duration-200',
          'focus-within:ring-brand/50 md:bottom-6 md:left-[calc(76px+2rem)] md:right-8 lg:left-[calc(16rem+2rem)]',
        )}
      >
        <Zap className="size-4 shrink-0 text-brand" aria-hidden="true" />
        <input
          ref={inputRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Anota: almuerzo 15 mil"
          aria-label="Anota un gasto o ingreso"
          autoComplete="off"
          enterKeyHint="send"
          maxLength={200}
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink placeholder:text-ink/45 focus:outline-none"
        />
        {hasText || !canDictate ? (
          <button
            type="submit"
            aria-label="Revisar y guardar"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-white transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet motion-safe:active:scale-95"
          >
            <ArrowUp className="size-5" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEntry({ autoStart: true })}
            aria-label="Dictar un movimiento"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand transition-[transform,background-color] duration-150 hover:bg-brand/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet motion-safe:active:scale-95"
          >
            <Mic className="size-5" aria-hidden="true" />
          </button>
        )}
      </form>
      <VoiceEntry
        open={entry !== null}
        onClose={() => setEntry(null)}
        onEdit={edit}
        onSaved={() => setText('')}
        names={names}
        text={entry?.text}
        autoStart={entry?.autoStart}
        onClosed={() => {
          if (!focusOnClose.current) return;
          focusOnClose.current = false;
          inputRef.current?.focus();
        }}
      />
    </>
  );
}
