import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Loader2 } from 'lucide-react';
import Sheet from '@/components/common/Sheet';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { timeAgo } from '@/lib/timeAgo';
import { cn } from '@/lib/utils';
import { getNotifications, markNotificationsRead } from '@/services/notificationService';

/** Cada cuánto se revisa si llegó algo nuevo mientras la app está abierta. */
const REFRESH_MS = 60_000;

/** `9+` cuando son muchos: el número exacto no cabe ni aporta. */
const badgeText = (count) => (count > 9 ? '9+' : String(count));

/**
 * Campana del centro de notificaciones (FT-0045): muestra cuántos avisos no ha leído y, al tocarla,
 * la lista. Abrirla los marca como leídos. Se actualiza al abrir la app, al volver a la pestaña y
 * cada minuto; sin conexión no pregunta.
 * @param {{ className?: string, label?: boolean }} props `label`: muestra "Avisos" al lado (menú lateral).
 */
export default function NotificationBell({ className, label = false }) {
  const online = useOnlineStatus();
  const [data, setData] = useState({ items: [], unread: 0 });
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await getNotifications());
      setStatus('ready');
    } catch {
      setStatus((s) => (s === 'ready' ? s : 'error'));
    }
  }, []);

  useEffect(() => {
    if (!online) return undefined;
    load();
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [online, load]);

  const openInbox = () => {
    setOpen(true);
    if (data.unread > 0) {
      // Se marcan en el servidor; en pantalla siguen resaltados hasta cerrar, para ver cuáles eran nuevos.
      markNotificationsRead().catch(() => {});
    }
  };

  const close = () => {
    setOpen(false);
    setData((d) => ({ unread: 0, items: d.items.map((n) => ({ ...n, read: true })) }));
  };

  const unread = data.unread;
  return (
    <>
      <button
        type="button"
        onClick={openInbox}
        aria-label={unread > 0 ? `Avisos, ${unread} sin leer` : 'Avisos'}
        className={cn(
          'relative flex items-center gap-3 rounded-xl text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-violet',
          className,
        )}
      >
        <span className="relative grid size-10 place-items-center">
          <Bell className="size-5" aria-hidden="true" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-4 text-white"
            >
              {badgeText(unread)}
            </span>
          )}
        </span>
        {label && <span className="text-[15px] font-medium max-lg:sr-only">Avisos</span>}
      </button>

      <Sheet open={open} title="Avisos" onClose={close}>
        {status === 'loading' && <Loader2 className="mx-auto animate-spin text-ink/40" aria-label="Cargando avisos" />}
        {status === 'error' && (
          <p role="alert" className="text-sm text-ink/60">
            No pudimos cargar tus avisos. Revisa tu conexión.
          </p>
        )}
        {status === 'ready' && data.items.length === 0 && (
          <p className="text-sm text-ink/60">
            Aún no tienes avisos. Aquí verás lo de tus vacas, negocios, tarjetas y presupuestos.
          </p>
        )}
        {status === 'ready' && data.items.length > 0 && (
          <ul className="-mx-2 flex flex-col gap-1">
            {data.items.map((n) => {
              const content = (
                <>
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-medium">{n.title}</span>
                    <span className="shrink-0 text-xs text-ink/50">{timeAgo(n.createdAt)}</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-ink/70">{n.body}</span>
                </>
              );
              const itemClass = cn('block rounded-xl px-3 py-3', !n.read && 'bg-brand-soft');
              return (
                <li key={n.id}>
                  {n.url ? (
                    <Link to={n.url} onClick={close} className={cn(itemClass, 'transition-colors hover:bg-ink/5')}>
                      {!n.read && <span className="sr-only">Nuevo: </span>}
                      {content}
                    </Link>
                  ) : (
                    <div className={itemClass}>
                      {!n.read && <span className="sr-only">Nuevo: </span>}
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>
    </>
  );
}
