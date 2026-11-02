import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus } from 'lucide-react';
import Sheet from '@/components/common/Sheet';
import { QuickEntryForm, useKeyboardInset, useQuickEntry } from '@/components/transactions/QuickEntryBar';
import VoiceEntry from '@/components/transactions/VoiceEntry';

const MANUAL = [
  { to: '/app/transacciones?nuevo=gasto', label: 'Gasto', icon: Minus, tone: 'bg-negative/12 text-negative' },
  { to: '/app/transacciones?nuevo=ingreso', label: 'Ingreso', icon: Plus, tone: 'bg-positive/12 text-positive' },
];

/** Ventana del [+]: anotar con una frase o por voz, o ir al formulario completo. */
function QuickAddSheet({ open, onClose }) {
  const { form, voice } = useQuickEntry({ onFinish: onClose });
  const keyboard = useKeyboardInset();
  return (
    <>
      <Sheet
        open={open}
        title="Agregar movimiento"
        description="Escríbelo como se lo dirías a un amigo o usa el micrófono."
        onClose={onClose}
        keyboardInset={keyboard > 80 ? keyboard : undefined}
      >
        <QuickEntryForm {...form} />
        <p className="mb-2 mt-5 text-sm text-ink/60">O llena el formulario</p>
        <ul className="grid grid-cols-2 gap-3">
          {MANUAL.map(({ to, label, icon: Icon, tone }) => (
            <li key={to}>
              <Link
                to={to}
                onClick={onClose}
                className="flex h-12 items-center gap-2.5 rounded-xl bg-surface-muted px-3 text-sm font-medium ring-1 ring-ink/10 transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-violet"
              >
                <span className={`grid size-7 place-items-center rounded-full ${tone}`}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
      <VoiceEntry {...voice} />
    </>
  );
}

/**
 * Botón [+] de la barra del celular. La ventana se monta al abrirla por primera vez: sus
 * categorías solo hacen falta si la persona va a anotar.
 */
export default function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setUsed(true);
          setOpen(true);
        }}
        aria-label="Agregar movimiento"
        aria-haspopup="dialog"
        className="-mt-5 grid size-14 place-items-center rounded-full bg-brand text-white shadow-lg ring-4 ring-canvas transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet motion-safe:active:scale-95"
      >
        <Plus className="size-7" aria-hidden="true" />
      </button>
      {used && <QuickAddSheet open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
