import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Loader2 } from 'lucide-react';
import { useNotifications } from '@/components/layout/NotificationsProvider';
import usePageTitle from '@/hooks/usePageTitle';
import { timeAgo } from '@/lib/timeAgo';
import { cn } from '@/lib/utils';

/** Un aviso; si tiene a dónde llevar, toda la fila es un enlace. */
function Item({ item, fresh }) {
  const content = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className={cn('min-w-0', fresh ? 'font-semibold' : 'font-medium')}>{item.title}</span>
        <span className="shrink-0 text-xs text-ink/70">{timeAgo(item.createdAt)}</span>
      </span>
      <span className="mt-0.5 block text-sm text-ink/70">{item.body}</span>
    </>
  );
  const itemClass = cn('block px-3.5 py-3', fresh && 'bg-brand-soft');
  return (
    <li>
      {item.url ? (
        <Link to={item.url} className={cn(itemClass, 'focus-visible:outline-2 focus-visible:outline-violet')}>
          {content}
        </Link>
      ) : (
        <div className={itemClass}>{content}</div>
      )}
    </li>
  );
}

function Group({ title, items, fresh = false }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title} className="mt-5">
      <h2 className="mb-2 text-sm font-medium text-ink/70">{title}</h2>
      <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-surface">
        {items.map((item) => (
          <Item key={item.id} item={item} fresh={fresh} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Página privada `/app/notificaciones`, a la que lleva la campana del inicio. Al abrirla, los avisos
 * quedan leídos; siguen en "Nuevas" durante esta visita para ver cuáles eran.
 */
export default function Notifications() {
  usePageTitle('Notificaciones');
  const { items, unread, status, markRead, clearHighlights } = useNotifications();
  const clear = useRef(clearHighlights);
  clear.current = clearHighlights;
  // Los que llegaron sin leer siguen en "Nuevas" toda la visita, aunque ya queden marcados como leídos.
  const fresh = useRef(new Set());
  items.forEach((n) => !n.read && fresh.current.add(n.id));

  useEffect(() => {
    if (unread > 0) markRead();
  }, [unread, markRead]);

  useEffect(() => () => clear.current(), []);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-[28px] font-semibold tracking-tight">Notificaciones</h1>
      {status === 'loading' && (
        <p className="flex items-center gap-2 py-8 text-ink/60" aria-busy="true">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" /> Cargando…
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className="mt-4 text-sm text-negative">
          No pudimos cargar tus avisos. Revisa tu conexión.
        </p>
      )}
      {status === 'ready' && items.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-1.5 rounded-2xl border border-ink/10 bg-surface p-6 text-center">
          <Bell className="size-6 text-ink/60" aria-hidden="true" />
          <p className="font-medium">No tienes notificaciones</p>
          <p className="text-sm text-ink/70">Aquí verás tus pagos, tarjetas y presupuestos.</p>
        </div>
      )}
      {status === 'ready' && (
        <>
          <Group title="Nuevas" fresh items={items.filter((n) => fresh.current.has(n.id))} />
          <Group title="Anteriores" items={items.filter((n) => !fresh.current.has(n.id))} />
        </>
      )}
    </div>
  );
}
