import { Info, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { conflictMessage } from '@/offline/conflictMessage';

/**
 * Conflictos de sincronización que el usuario aún no ha visto (FT-0009): un cambio hecho sin
 * conexión chocó con otro de un dispositivo distinto y el servidor resolvió con last-write-wins.
 * Cada aviso se queda hasta que el usuario toca "Entendido".
 * @param {object} props
 * @param {import('@/offline/conflictMessage').SyncConflict[] & Array<{ localId: string }>} props.conflicts
 * @param {(localIds?: string[]) => void} props.onDismiss Sin argumento descarta todos.
 */
export default function ConflictList({ conflicts, onDismiss }) {
  return (
    <section aria-labelledby="conflicts-title" className="mt-4 rounded-xl border border-ink/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="conflicts-title" className="text-sm font-medium">
          Conflictos de sincronización ({conflicts.length})
        </h3>
        {conflicts.length > 1 && (
          <Button size="sm" variant="ghost" onClick={() => onDismiss()}>
            Entendido todos
          </Button>
        )}
      </div>
      <p className="mt-1 text-sm text-ink/60">
        Cambiaste estos movimientos sin conexión y otro dispositivo también los cambió. Se conserva el cambio más
        reciente.
      </p>
      <ul className="mt-2 divide-y divide-ink/10">
        {conflicts.map((conflict) => {
          const { tone, text } = conflictMessage(conflict);
          const Icon = tone === 'warning' ? TriangleAlert : Info;
          return (
            <li key={conflict.localId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2 text-sm">
              <span className="flex min-w-0 flex-1 basis-60 items-start gap-2">
                <Icon
                  className={`mt-0.5 size-4 shrink-0 ${tone === 'warning' ? 'text-caution' : 'text-brand'}`}
                  aria-hidden="true"
                />
                <span className="break-words">{text}</span>
              </span>
              <Button size="sm" variant="outline" onClick={() => onDismiss([conflict.localId])}>
                Entendido
                <span className="sr-only">: {text}</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
