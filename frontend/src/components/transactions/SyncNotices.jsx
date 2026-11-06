import { CloudUpload, WifiOff } from 'lucide-react';
import { formatDate, formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import { discardPending } from '@/offline/sync';

/**
 * Aviso de que el historial viene de la copia guardada en el dispositivo (FT-0009).
 * @param {{ syncedAt: string }} props Hora ISO de la última actualización, o `''` si nunca se llenó.
 */
export function CachedNotice({ syncedAt }) {
  const when =
    syncedAt &&
    new Date(syncedAt).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  return (
    <p className="mt-2 flex items-start gap-2 rounded-xl bg-ink/5 px-3 py-2 text-sm text-ink/70">
      <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {when
        ? `Sin conexión: ves la copia guardada en este dispositivo (actualizada el ${when}).`
        : 'Sin conexión: ves lo que está guardado en este dispositivo.'}
    </p>
  );
}

/**
 * Movimientos registrados sin conexión que esperan sincronizarse (FT-0009).
 * @param {{ operations: import('@/offline/db').PendingOperation[], onError: (message: string) => void }} props
 */
export function PendingList({ operations, onError }) {
  const waiting = operations.filter((o) => !o.rejected).length;
  return (
    <section aria-labelledby="pending-title" className="mt-4 rounded-xl bg-brand-soft/60 p-4">
      <h3 id="pending-title" className="flex items-center gap-2 text-sm font-medium text-brand">
        <CloudUpload className="size-4" aria-hidden="true" />
        Pendientes de sincronizar ({waiting})
      </h3>
      <ul className="mt-2 divide-y divide-ink/10">
        {operations.map(({ localId, op, transaction, preview, rejected }) => {
          // En `update` y `delete` se muestra cómo queda el movimiento, no solo lo que cambió.
          const t = preview ?? transaction;
          return (
            <li key={localId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm">
              <span className="min-w-0 break-words">
                {op !== 'create' && (
                  <span className="mr-1 font-medium">{op === 'delete' ? 'Eliminar:' : 'Editar:'}</span>
                )}
                <span className={op === 'delete' ? 'line-through' : undefined}>{t.description}</span>{' '}
                <span className="text-ink/60">· {formatDate(t.date)}</span>
                {rejected && (
                  <span className="block text-negative">No se pudo sincronizar: {rejected}</span>
                )}
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="sr-only">{t.type === 'ingreso' ? 'Ingreso de ' : 'Gasto de '}</span>
                <span aria-hidden="true">{t.type === 'ingreso' ? '+' : '−'}</span>
                {formatMoney(t.amount)}
              </span>
              {rejected && (
                <Button size="sm" variant="outline" onClick={() => discardPending(localId).catch((err) => onError(err.message))}>
                  Descartar<span className="sr-only"> {t.description}</span>
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
