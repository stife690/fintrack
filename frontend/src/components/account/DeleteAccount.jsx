import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import Sheet from '@/components/common/Sheet';
import Panel from '@/components/layout/Panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/auth/AuthContext';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { GOOGLE_CLIENT_ID, loadGoogleIdentity } from '@/lib/google';

/** Lo que se borra y lo que sigue para los demás, en palabras del usuario. */
const WHAT_HAPPENS = [
  'Tus movimientos, presupuestos, tarjetas, soportes y Mi plata.',
  'Tus ajustes, recordatorios y la conexión con WhatsApp.',
  'Las vacas y negocios donde estás solo.',
];

/**
 * Botón oficial de Google para confirmar la identidad (cuentas creadas con Google, que no tienen
 * una contraseña que sepan). Al elegir la cuenta entrega el `credential`.
 * @param {{ disabled: boolean, onCredential: (credential: string) => void }} props
 */
function GoogleConfirm({ disabled, onCredential }) {
  const ref = useRef(null);
  const callback = useRef(onCredential);
  callback.current = onCredential;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !ref.current) return;
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: ({ credential }) => callback.current(credential),
          ux_mode: 'popup',
        });
        google.accounts.id.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          locale: 'es',
          width: Math.min(ref.current.clientWidth || 320, 400),
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return <p className="text-sm text-ink/60">No pudimos cargar Google. Revisa tu conexión.</p>;
  return (
    <div
      ref={ref}
      aria-disabled={disabled}
      className={disabled ? 'pointer-events-none min-h-11 opacity-40' : 'min-h-11'}
    />
  );
}

/**
 * "Eliminar mi cuenta" en `/app/cuenta` (FT-0017). Abre una ventana que explica qué se borra, pide
 * marcar que se entiende que no se puede deshacer y confirmar con la contraseña (o con Google).
 * Al terminar, el login muestra el aviso.
 */
export default function DeleteAccount() {
  const { deleteAccount } = useAuth();
  const online = useOnlineStatus();
  const checkId = useId();
  const passwordId = useId();
  const [open, setOpen] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    if (busy) return;
    setOpen(false);
    setUnderstood(false);
    setPassword('');
    setError('');
  };

  const confirm = async (confirmation) => {
    setBusy(true);
    setError('');
    try {
      await deleteAccount(confirmation); // sin sesión, la ruta protegida lleva al login
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const ready = understood && online && !busy;

  return (
    <Panel className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Eliminar mi cuenta</h2>
        <p className="mt-1 text-sm text-ink/60">Borra tu cuenta y todos tus datos. No se puede deshacer.</p>
      </div>
      <Button
        variant="outline"
        className="border-destructive/40 text-destructive hover:bg-destructive/10"
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden="true" />
        Eliminar mi cuenta
      </Button>

      <Sheet open={open} title="¿Eliminar tu cuenta?" onClose={close}>
        <div className="space-y-5">
          <div className="space-y-2 text-sm">
            <p className="font-medium">Se borra para siempre:</p>
            <ul className="list-disc space-y-1 pl-5 text-ink/70">
              {WHAT_HAPPENS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="text-ink/60">
              En las vacas y negocios compartidos, tus aportes quedan sin tu nombre para que las cuentas del grupo
              sigan cuadrando, y otro miembro pasa a administrarlos.
            </p>
          </div>

          <label htmlFor={checkId} className="flex items-start gap-3 rounded-xl bg-destructive/10 p-3 text-sm">
            <input
              id={checkId}
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--color-destructive)]"
            />
            <span>Entiendo que mi cuenta y mis datos se borran y no se pueden recuperar.</span>
          </label>

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready && password) confirm({ password });
            }}
          >
            <label htmlFor={passwordId} className="block text-sm font-medium">
              Escribe tu contraseña para confirmar
            </label>
            <Input
              id={passwordId}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? `${passwordId}-error` : undefined}
            />
            <Button
              type="submit"
              className="w-full bg-destructive text-white hover:bg-destructive/90"
              disabled={!ready || !password}
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
              {busy ? 'Eliminando…' : 'Eliminar mi cuenta para siempre'}
            </Button>
          </form>

          {GOOGLE_CLIENT_ID && (
            <div className="space-y-2">
              <p className="text-sm text-ink/60">¿Creaste la cuenta con Google? Confirma con Google:</p>
              <GoogleConfirm disabled={!ready} onCredential={(googleCredential) => confirm({ googleCredential })} />
            </div>
          )}

          {!online && <p className="text-sm text-ink/60">Necesitas conexión para eliminar la cuenta.</p>}
          {error && (
            <p id={`${passwordId}-error`} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </Sheet>
    </Panel>
  );
}
