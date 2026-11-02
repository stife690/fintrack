import { useState } from 'react';
import { ChevronUp, Lightbulb, Loader2, Plus } from 'lucide-react';
import Sheet from '@/components/common/Sheet';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { Button } from '@/components/ui/button';
import useAsync from '@/hooks/useAsync';
import usePageTitle from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import { getIdeas, sendIdea, setVote } from '@/services/ideasService';

export const MIN_IDEA_LENGTH = 5;
export const MAX_IDEA_LENGTH = 120;

const TABS = [
  { key: 'upcoming', label: 'Próximamente' },
  { key: 'done', label: 'Ya disponible' },
];

const STATUS = {
  planeada: { label: 'Planeada', className: 'bg-ink/5 text-ink/70' },
  en_progreso: { label: 'En progreso', className: 'bg-brand-soft text-brand' },
  lista: { label: 'Disponible', className: 'bg-positive/12 text-positive' },
};

/**
 * ¿La idea se puede enviar? Mismo límite que la API.
 * @param {string} text
 * @returns {boolean}
 */
export function isValidIdea(text) {
  const { length } = text.trim();
  return length >= MIN_IDEA_LENGTH && length <= MAX_IDEA_LENGTH;
}

/** Ventana para enviar una idea. Al enviarla muestra el agradecimiento en vez del formulario. */
function IdeaSheet({ open, onClose }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    onClose();
    setSent(false);
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    setError('');
    try {
      await sendIdea(text.trim());
      setText('');
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} title="Pedir una función" description="¿Qué le falta a FinTrack?" onClose={close}>
      {sent ? (
        <div role="status">
          <p className="text-sm text-ink/70">
            Gracias por tu idea. La revisamos y, si entra al plan, aparecerá aquí para que todos la voten.
          </p>
          <Button size="lg" className="mt-5 w-full" onClick={close}>
            Listo
          </Button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-label="Tu idea"
            placeholder="Por ejemplo: recordarme pagar el arriendo"
            maxLength={MAX_IDEA_LENGTH}
            rows={3}
            className="w-full resize-none rounded-xl bg-field p-3 text-base text-ink ring-1 ring-field-line placeholder:text-ink/45 focus:outline-none focus:ring-brand/50"
          />
          <p className="mt-1 text-right text-xs tabular-nums text-ink/60">
            {text.length} de {MAX_IDEA_LENGTH}
          </p>
          {error && (
            <p role="alert" className="mt-1 text-sm text-negative">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="mt-3 w-full" disabled={sending || !isValidIdea(text)}>
            {sending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {sending ? 'Enviando…' : 'Enviar idea'}
          </Button>
        </form>
      )}
    </Sheet>
  );
}

/** Una idea con su estado y, si aún no está lista, el botón para votar. */
function IdeaRow({ idea, busy, onVote }) {
  const status = STATUS[idea.status];
  return (
    <li className="flex items-center gap-3 py-3">
      {idea.status !== 'lista' && (
        <button
          type="button"
          onClick={() => onVote(idea)}
          disabled={busy}
          aria-pressed={idea.voted}
          aria-label={`Votar por ${idea.title}. ${idea.votes} votos`}
          className={cn(
            'grid h-14 w-12 shrink-0 place-items-center rounded-xl text-sm font-semibold tabular-nums ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-violet disabled:opacity-60',
            idea.voted ? 'bg-brand-soft text-brand ring-brand/40' : 'ring-ink/15 hover:bg-ink/5',
          )}
        >
          <ChevronUp className="size-5" aria-hidden="true" />
          {idea.votes}
        </button>
      )}
      <div className="min-w-0 flex-1">
        <p className="break-words text-[15px] font-medium">{idea.title}</p>
        <span className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium', status.className)}>
          {status.label}
        </span>
      </div>
    </li>
  );
}

/**
 * Página privada `/app/lo-que-viene` (FT-0026): lo que viene y lo que ya está disponible. Se vota
 * por lo que aún no está y se piden funciones nuevas, que el equipo revisa antes de publicar.
 */
export default function Roadmap() {
  usePageTitle('Lo que viene');
  const { data, error, loading, reload } = useAsync(getIdeas, []);
  const [tab, setTab] = useState('upcoming');
  const [asking, setAsking] = useState(false);
  const [voting, setVoting] = useState(null);
  const [voteError, setVoteError] = useState('');
  const ideas = data?.[tab] ?? [];

  const vote = async (idea) => {
    setVoting(idea.id);
    setVoteError('');
    try {
      await setVote(idea.id, !idea.voted);
      reload();
    } catch (err) {
      setVoteError(err.message);
    } finally {
      setVoting(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Lo que viene"
        description="Vota por lo que quieres primero."
        actions={
          <Button onClick={() => setAsking(true)}>
            <Plus aria-hidden="true" />
            Pedir una función
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-ink/5 p-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={cn(
              'h-10 rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-violet',
              tab === key ? 'bg-surface text-ink shadow-sm' : 'text-ink/60 hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Panel>
        {voteError && (
          <p role="alert" className="mb-2 text-sm text-negative">
            {voteError}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        {!error && loading && !data && (
          <p className="flex items-center gap-2 text-sm text-ink/60">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Cargando…
          </p>
        )}
        {data && ideas.length === 0 && (
          <div className="py-6 text-center">
            <Lightbulb className="mx-auto size-6 text-brand" aria-hidden="true" />
            <p className="mt-2 text-sm text-ink/60">
              {tab === 'upcoming' ? 'Aún no hay ideas publicadas. Cuéntanos la tuya.' : 'Pronto verás aquí las novedades.'}
            </p>
          </div>
        )}
        {ideas.length > 0 && (
          <ul className="-my-3 divide-y divide-ink/10">
            {ideas.map((idea) => (
              <IdeaRow key={idea.id} idea={idea} busy={voting === idea.id} onVote={vote} />
            ))}
          </ul>
        )}
      </Panel>

      <IdeaSheet open={asking} onClose={() => setAsking(false)} />
    </div>
  );
}
