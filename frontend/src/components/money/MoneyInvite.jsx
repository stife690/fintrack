import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import Panel from '@/components/layout/Panel';
import { Button } from '@/components/ui/button';
import { finishWelcome } from '@/services/moneyProfileService';

/**
 * Invitación del inicio a responder la bienvenida. Es para quien ya usaba la app: a las cuentas
 * sin movimientos se les muestra la bienvenida directamente.
 * @param {{ onDone: () => void }} props `onDone`: el usuario eligió "Ahora no".
 */
export default function MoneyInvite({ onDone }) {
  const [error, setError] = useState('');

  const dismiss = () => finishWelcome().then(onDone, (err) => setError(err.message));

  return (
    <Panel aria-labelledby="money-invite-title" className="flex flex-wrap items-center gap-4">
      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Wallet className="size-5" />
      </span>
      <div className="min-w-40 flex-1">
        <h2 id="money-invite-title" className="font-semibold tracking-tight">
          Cuéntanos cómo te entra la plata
        </h2>
        <p className="text-sm text-ink/60">Son tres preguntas y las puedes cambiar cuando quieras.</p>
        {error && (
          <p role="alert" className="mt-1 text-sm text-negative">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button asChild size="sm">
          <Link to="/app/bienvenida">Responder</Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={dismiss}>
          Ahora no
        </Button>
      </div>
    </Panel>
  );
}
