import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CircleCheck, Copy, Loader2, RefreshCw, Smartphone, Unlink } from 'lucide-react';
import ConfirmButton from '@/components/common/ConfirmButton';
import Panel from '@/components/layout/Panel';
import { Button } from '@/components/ui/button';
import useAsync from '@/hooks/useAsync';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { formatRelativeDay } from '@/components/transactions/format';
import { SHORTCUT_URL, createShortcutToken, getShortcutToken, revokeShortcutToken } from '@/services/pendingPaymentService';

/** Pasos para crear la automatización en Atajos del iPhone. */
export const SHORTCUT_STEPS = [
  'Abre la app Atajos y ve a Automatización → Nueva automatización → Wallet.',
  'Elige tus tarjetas, marca "Al tocar" y "Ejecutar inmediatamente".',
  'Agrega la acción "Obtener contenido de URL" con la dirección de abajo y método POST.',
  'En Encabezados agrega Authorization con el valor "Bearer " seguido de tu código.',
  'En Cuerpo de la solicitud elige JSON y agrega merchant (el comercio del pago), amount (el importe), card (el nombre de la tarjeta) y date (Fecha actual).',
];

/** Texto con botón para copiarlo. */
function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso para el portapapeles: el texto se puede seleccionar a mano.
    }
  };
  return (
    <div>
      <p className="text-sm text-ink/60">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 select-all break-all rounded-lg bg-surface px-3 py-2 text-sm">{value}</code>
        <Button size="icon" variant="outline" onClick={copy} aria-label={`Copiar ${label.toLowerCase()}`}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}

/** Paso con el código recién creado: es la única vez que se ve. */
function SetupStep({ token }) {
  return (
    <div className="space-y-4 rounded-xl bg-brand-soft p-4">
      <p className="text-sm font-medium text-brand">Copia tu código ahora: no lo volverás a ver.</p>
      <CopyField label="Tu código" value={token} />
      <CopyField label="Dirección" value={SHORTCUT_URL} />
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink/70">
        {SHORTCUT_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Conexión con Atajos del iPhone en Cuenta (FT-0047). Si la función no está activa para el
 * usuario no se muestra.
 */
export default function ShortcutLink() {
  const online = useOnlineStatus();
  const { data, error, reload } = useAsync(getShortcutToken, []);
  const [created, setCreated] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  if (!data?.enabled) {
    if (!error) return null;
    return (
      <Panel>
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      </Panel>
    );
  }

  const create = async () => {
    setCreating(true);
    setCreateError('');
    try {
      setCreated(await createShortcutToken());
      reload();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const revoke = async () => {
    await revokeShortcutToken();
    setCreated(null);
    reload();
  };

  const token = data.token;
  const lastUsed = token?.lastUsedAt && formatRelativeDay(new Date(token.lastUsedAt).toLocaleDateString('en-CA'));

  return (
    <Panel aria-labelledby="shortcut-title">
      <h2 id="shortcut-title" className="text-lg font-semibold tracking-tight">
        Pagos con Apple Pay
      </h2>
      <p className="mt-1 text-sm text-ink/60">
        Con Atajos del iPhone, cada pago con Wallet llega a{' '}
        <Link to="/app/por-confirmar" className="underline">
          Por confirmar
        </Link>
        . Nada se anota hasta que lo apruebes.
      </p>

      <div className="mt-5 space-y-3">
        {created && <SetupStep token={created.token} />}
        {token ? (
          <>
            <p className="flex items-center gap-2 text-sm">
              <CircleCheck className="size-5 shrink-0 text-positive" aria-hidden="true" />
              {lastUsed
                ? `Conectado · último pago recibido: ${lastUsed.toLowerCase()}`
                : 'Código creado · aún no llega ningún pago'}
            </p>
            <div className="flex flex-wrap gap-2">
              {!created && (
                <ConfirmButton
                  label="Crear código nuevo"
                  question="¿Crear un código nuevo? El de ahora deja de servir y tendrás que cambiarlo en el Atajo."
                  confirmLabel="Sí, crear otro"
                  icon={RefreshCw}
                  disabled={!online}
                  onConfirm={create}
                />
              )}
              <ConfirmButton
                label="Desconectar"
                question="¿Desconectar el iPhone? Dejarán de llegar pagos. Lo que ya anotaste no se borra."
                confirmLabel="Sí, desconectar"
                icon={Unlink}
                disabled={!online}
                onConfirm={revoke}
              />
            </div>
          </>
        ) : (
          <Button onClick={create} disabled={creating || !online}>
            {creating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Smartphone aria-hidden="true" />}
            Conectar mi iPhone
          </Button>
        )}
        {createError && (
          <p role="alert" className="text-sm text-negative">
            {createError}
          </p>
        )}
      </div>
    </Panel>
  );
}
