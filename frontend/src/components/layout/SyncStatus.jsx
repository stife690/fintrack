import { Link } from 'react-router-dom';
import { CloudUpload, Loader2, TriangleAlert, WifiOff } from 'lucide-react';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * Estado de la conexión y de la cola offline (FT-0008, FT-0009). Es una sola región de estado,
 * siempre montada: así el lector de pantalla anuncia cada cambio aunque no haya nada que mostrar.
 *
 * - Sin conexión: avisa que los movimientos se guardan en el dispositivo.
 * - Con conexión y pendientes: "Sincronizando…" o "se reintentará automáticamente".
 * - Con rechazados (en cualquier estado de conexión): lleva a Movimientos para descartarlos.
 * @param {object} props
 * @param {boolean} props.online
 * @param {number} props.pending Movimientos esperando enviarse.
 * @param {number} props.rejected Movimientos que el servidor rechazó y siguen en la cola.
 * @param {boolean} props.syncing Hay un envío en curso.
 */
export default function SyncStatus({ online, pending, rejected, syncing }) {
  const box = 'mx-4 mt-2 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm md:mx-8';
  return (
    <div role="status" aria-atomic="true">
      {!online ? (
        <p className={`${box} bg-caution/10 text-ink md:mt-6`}>
          <WifiOff className="size-4 shrink-0 text-caution" aria-hidden="true" />
          Sin conexión. Los movimientos nuevos se guardan en este dispositivo y se envían al volver internet
          {pending > 0 && ` (${plural(pending, 'pendiente', 'pendientes')})`}.
        </p>
      ) : (
        pending > 0 && (
          <p className={`${box} bg-brand-soft text-brand md:mt-6`}>
            {syncing ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
            ) : (
              <CloudUpload className="size-4 shrink-0" aria-hidden="true" />
            )}
            {syncing
              ? `Sincronizando ${plural(pending, 'movimiento', 'movimientos')}…`
              : `${plural(pending, 'movimiento pendiente', 'movimientos pendientes')} de sincronizar. Se reintentará automáticamente.`}
          </p>
        )
      )}
      {rejected > 0 && (
        <p className={`${box} bg-negative/10 text-ink ${online && pending === 0 ? 'md:mt-6' : ''}`}>
          <TriangleAlert className="size-4 shrink-0 text-negative" aria-hidden="true" />
          <span>
            {rejected === 1
              ? 'Un movimiento guardado sin conexión no se pudo sincronizar. '
              : `${rejected} movimientos guardados sin conexión no se pudieron sincronizar. `}
            <Link to="/app/transacciones" className="font-medium underline">
              Revisar en Movimientos
            </Link>
          </span>
        </p>
      )}
    </div>
  );
}
