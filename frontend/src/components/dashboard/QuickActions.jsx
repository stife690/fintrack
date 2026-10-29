import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mic, Minus, Plus, Target } from 'lucide-react';
import VoiceEntry from '@/components/transactions/VoiceEntry';
import { getSpeechRecognition } from '@/lib/speech';
import { cn } from '@/lib/utils';

const ACTIONS = [
  { to: '/app/transacciones?nuevo=gasto', label: 'Gasto', icon: Minus, tone: 'bg-negative/12 text-negative' },
  { to: '/app/transacciones?nuevo=ingreso', label: 'Ingreso', icon: Plus, tone: 'bg-positive/12 text-positive' },
  { to: '/app/presupuestos', label: 'Presupuesto', icon: Target, tone: 'bg-brand-soft text-brand' },
];

const TILE =
  'flex h-full w-full flex-col items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-0.5 py-4 text-sm font-medium transition-colors hover:border-ink/20 sm:flex-row sm:justify-center sm:gap-3 sm:px-2';

/**
 * Accesos rápidos del inicio: registrar un gasto o un ingreso, dictarlo por voz (FT-0013) o ir a
 * presupuestos. "Voz" solo aparece si el navegador sabe dictar (Firefox no).
 * @param {{ onSaved?: () => void, names?: Record<string, string> }} props
 *   `onSaved` recarga el inicio tras guardar por voz; `names`, el nombre de cada categoría.
 */
export default function QuickActions({ onSaved, names }) {
  const navigate = useNavigate();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const canDictate = getSpeechRecognition() !== null;

  // "Editar antes de guardar": lo dictado viaja a Movimientos y llena el formulario.
  const editDictation = (draft) => {
    setVoiceOpen(false);
    if (draft) navigate('/app/transacciones', { state: { voiceDraft: draft } });
    else navigate('/app/transacciones?nuevo=gasto');
  };

  return (
    <nav aria-label="Accesos rápidos">
      {/* Con "Voz" son 4 columnas: en celular las etiquetas bajan a 12px para que "Presupuesto" quepa en 360px. */}
      <ul className={cn('grid gap-3', canDictate ? 'grid-cols-4 gap-2 max-sm:[&_a]:text-xs max-sm:[&_button]:text-xs sm:gap-3' : 'grid-cols-3')}>
        {ACTIONS.slice(0, 2).map((action) => (
          <ActionLink key={action.to} {...action} />
        ))}
        {canDictate && (
          <li>
            <button type="button" onClick={() => setVoiceOpen(true)} className={cn(TILE, 'border-brand/30')}>
              <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand">
                <Mic className="size-[18px]" strokeWidth={2.25} />
              </span>
              <span>
                <span className="sr-only">Registrar por </span>Voz
              </span>
            </button>
          </li>
        )}
        <ActionLink {...ACTIONS[2]} />
      </ul>
      <VoiceEntry
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onEdit={editDictation}
        onSaved={onSaved}
        names={names}
      />
    </nav>
  );
}

function ActionLink({ to, label, icon: Icon, tone }) {
  return (
    <li>
      <Link to={to} className={TILE}>
        <span aria-hidden="true" className={cn('grid size-9 place-items-center rounded-full', tone)}>
          <Icon className="size-[18px]" strokeWidth={2.25} />
        </span>
        <span>
          <span className="sr-only">Registrar </span>
          {label}
        </span>
      </Link>
    </li>
  );
}
