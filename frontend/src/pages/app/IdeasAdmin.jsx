import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Inbox, Loader2, Pencil, Plus } from 'lucide-react';
import Sheet from '@/components/common/Sheet';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { formatRelativeDay } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import useAsync from '@/hooks/useAsync';
import usePageTitle from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import { MAX_IDEA_LENGTH, isValidIdea } from '@/pages/app/Roadmap';
import { createAdminIdea, getAdminIdeas, updateAdminIdea } from '@/services/ideasService';

export const STATUS_OPTIONS = [
  { value: 'revision', label: 'En revisión' },
  { value: 'planeada', label: 'Planeada' },
  { value: 'en_progreso', label: 'En progreso' },
  { value: 'lista', label: 'Disponible' },
  { value: 'descartada', label: 'Descartada' },
];

export const FILTERS = [
  { key: 'review', label: 'Por revisar', statuses: ['revision'] },
  { key: 'published', label: 'Publicadas', statuses: ['planeada', 'en_progreso'] },
  { key: 'done', label: 'Disponibles', statuses: ['lista'] },
  { key: 'discarded', label: 'Descartadas', statuses: ['descartada'] },
];

/**
 * Ideas de un filtro.
 * @param {Array<{ status: string }>} ideas
 * @param {string} key Clave de `FILTERS`.
 * @returns {Array<{ status: string }>}
 */
export function filterIdeas(ideas, key) {
  const { statuses } = FILTERS.find((filter) => filter.key === key);
  return ideas.filter(({ status }) => statuses.includes(status));
}

/** Ventana para agregar una idea o corregir el título y el estado de una existente. */
function IdeaForm({ idea, open, onClose, onSaved }) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('planeada');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(idea?.title ?? '');
    setStatus(idea?.status ?? 'planeada');
    setError('');
  }, [open, idea]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = { title: title.trim(), status };
      await (idea ? updateAdminIdea(idea.id, data) : createAdminIdea(data));
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} title={idea ? 'Editar idea' : 'Agregar idea'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <textarea
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="Título de la idea"
          maxLength={MAX_IDEA_LENGTH}
          rows={3}
          className="w-full resize-none rounded-xl bg-field p-3 text-base text-ink ring-1 ring-field-line focus:outline-none focus:ring-brand/50"
        />
        <StatusSelect label="Estado" value={status} onChange={setStatus} className="h-12 w-full" />
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={saving || !isValidIdea(title)}>
          {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Sheet>
  );
}

/** Selector de estado de una idea. */
function StatusSelect({ label, value, onChange, disabled, className }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      aria-label={label}
      className={cn('rounded-xl bg-field px-3 text-sm text-ink ring-1 ring-field-line disabled:opacity-60', className)}
    >
      {STATUS_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Página `/app/lo-que-viene/admin` (FT-0027), para el equipo: ver lo que piden los usuarios,
 * publicarlo, moverlo de estado o agregar ideas. La seguridad está en la API, que responde 403
 * a quien no esté en `ADMIN_EMAILS`.
 */
export default function IdeasAdmin() {
  usePageTitle('Administrar ideas');
  const { data, error, loading, reload } = useAsync(getAdminIdeas, []);
  const [filter, setFilter] = useState('review');
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [changing, setChanging] = useState(null);
  const [changeError, setChangeError] = useState('');
  const all = data?.ideas ?? [];
  const ideas = filterIdeas(all, filter);

  const changeStatus = async (idea, status) => {
    setChanging(idea.id);
    setChangeError('');
    try {
      await updateAdminIdea(idea.id, { status });
      reload();
    } catch (err) {
      setChangeError(err.message);
    } finally {
      setChanging(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/app/lo-que-viene"
        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-ink/60 transition-colors hover:text-brand"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Lo que viene
      </Link>
      <PageHeader
        title="Administrar ideas"
        description="Revisa lo que piden y decide qué se publica."
        actions={
          !error && (
            <Button onClick={() => setAdding(true)}>
              <Plus aria-hidden="true" />
              Agregar idea
            </Button>
          )
        }
      />

      {error ? (
        <Panel>
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        </Panel>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-ink/5 p-1 sm:grid-cols-4">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={cn(
                  'h-10 rounded-lg px-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-violet',
                  filter === key ? 'bg-surface text-ink shadow-sm' : 'text-ink/60 hover:text-ink',
                )}
              >
                {label} <span className="tabular-nums text-ink/60">{filterIdeas(all, key).length}</span>
              </button>
            ))}
          </div>

          <Panel>
            {changeError && (
              <p role="alert" className="mb-2 text-sm text-negative">
                {changeError}
              </p>
            )}
            {loading && !data && (
              <p className="flex items-center gap-2 text-sm text-ink/60">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Cargando…
              </p>
            )}
            {data && ideas.length === 0 && (
              <div className="py-6 text-center">
                <Inbox className="mx-auto size-6 text-brand" aria-hidden="true" />
                <p className="mt-2 text-sm text-ink/60">No hay ideas aquí.</p>
              </div>
            )}
            {ideas.length > 0 && (
              <ul className="-my-3 divide-y divide-ink/10">
                {ideas.map((idea) => (
                  <li key={idea.id} className="py-3">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 break-words text-[15px] font-medium">{idea.title}</p>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditing(idea)}
                        aria-label={`Editar ${idea.title}`}
                        className="shrink-0"
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs tabular-nums text-ink/60">
                        {formatRelativeDay(idea.createdAt.slice(0, 10))} · {idea.votes}{' '}
                        {idea.votes === 1 ? 'voto' : 'votos'}
                      </p>
                      <StatusSelect
                        label={`Estado de ${idea.title}`}
                        value={idea.status}
                        onChange={(status) => changeStatus(idea, status)}
                        disabled={changing === idea.id}
                        className="h-10"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}

      <IdeaForm
        idea={editing}
        open={adding || editing !== null}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        onSaved={reload}
      />
    </div>
  );
}
