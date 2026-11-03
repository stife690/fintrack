import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';
import CardForm from '@/components/cards/CardForm';
import CreditCardArt from '@/components/cards/CreditCardArt';
import Sheet from '@/components/common/Sheet';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { MASK } from '@/components/dashboard/BalanceCard';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/components/transactions/format';
import useHiddenAmounts from '@/hooks/useHiddenAmounts';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { createCard, listCards } from '@/services/cardService';


/** "15 nov" a partir de AAAA-MM-DD, sin pasar por UTC. */
function shortDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const month = new Date(y, m - 1, d).toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
  return `${d} ${month}`;
}

/** Cuándo toca pagar: "Pagas en 5 días (15 nov)". */
function paymentText(card) {
  if (card.paidThisCycle) return 'Pago de este mes al día';
  const when = card.nextPaymentDate ? ` (${shortDate(card.nextPaymentDate)})` : '';
  if (card.daysToPayment === 0) return `Pagas hoy${when}`;
  if (card.daysToPayment === 1) return `Pagas en 1 día${when}`;
  return `Pagas en ${card.daysToPayment} días${when}`;
}

/**
 * Lista de tarjetas (o el estado vacío). Separada de la página para poder probarla sin red.
 * @param {{ cards: object[], online: boolean, hidden: boolean, onAdd: () => void }} props
 */
export function CardsList({ cards, online, hidden, onAdd }) {
  const money = (n) => (hidden ? MASK : formatMoney(n));
  if (cards.length === 0) {
    return (
      <Panel className="mx-auto max-w-xl text-center">
        <div className="flex justify-center">
          <CreditCardArt network="visa" tier="gold" last4="1234" name="Ejemplo" size="sm" />
        </div>
        <p className="mt-4 text-lg font-semibold">Aún no tienes tarjetas</p>
        <p className="mx-auto mt-1 max-w-md text-ink/60">
          Agrega una para ver cuánto cupo te queda y cuándo toca pagar.
        </p>
        <Button className="mt-4" onClick={onAdd} disabled={!online}>
          Agregar mi primera tarjeta
        </Button>
        {!online && <p className="mt-2 text-sm text-ink/60">Necesitas conexión</p>}
      </Panel>
    );
  }
  return (
    <ul aria-label="Mis tarjetas" className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {cards.map((card) => {
        const pct = card.limit > 0 ? Math.min(100, Math.round((card.used / card.limit) * 100)) : 0;
        return (
          <li key={card.id} className="min-w-0">
            <Link
              to={`/app/tarjetas/${card.id}`}
              className="block rounded-2xl border border-ink/10 bg-surface p-4 transition-colors hover:border-brand/40"
            >
              <CreditCardArt network={card.network} tier={card.tier} last4={card.last4} name={card.name} size="lg" />
              <div
                role="progressbar"
                aria-label={`Uso de ${card.name}`}
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10"
              >
                <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-sm tabular-nums text-ink/70">
                Usado {money(card.used)} de {money(card.limit)} · Disponible {money(card.available)}
              </p>
              <p className="mt-1 text-sm font-medium">{paymentText(card)}</p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Página privada `/app/tarjetas`: tarjetas de crédito del usuario; crear se hace en una hoja. */
export default function Cards() {
  usePageTitle('Tarjetas');
  const online = useOnlineStatus();
  const [hidden] = useHiddenAmounts();
  const [cards, setCards] = useState(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(false);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    listCards()
      .then((data) => !cancelled && (setCards(data), setError('')))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [version]);

  const handleCreate = async (values) => {
    await createCard(values);
    setSheet(false);
    reload();
  };

  return (
    <>
      <PageHeader
        title="Tarjetas"
        description="Tu cupo, lo que debes y cuándo pagar."
        actions={
          <Button onClick={() => setSheet(true)} disabled={!online}>
            <Plus aria-hidden="true" /> Agregar tarjeta
          </Button>
        }
      />
      {!online && <p className="mb-3 text-sm text-ink/60">Necesitas conexión para agregar o cambiar tarjetas.</p>}
      {error && (
        <p role="alert" className="mb-3 text-sm text-negative">
          {error}{' '}
          <button type="button" className="underline" onClick={reload}>
            Reintentar
          </button>
        </p>
      )}
      {cards === null && !error ? (
        <p className="flex items-center gap-2 py-10 text-ink/60">
          <Loader2 className="animate-spin" aria-hidden="true" /> Cargando…
        </p>
      ) : (
        cards && <CardsList cards={cards} online={online} hidden={hidden} onAdd={() => setSheet(true)} />
      )}
      <Sheet open={sheet} title="Agregar tarjeta" onClose={() => setSheet(false)}>
        <CardForm disabled={!online} onSubmit={handleCreate} onCancel={() => setSheet(false)} />
      </Sheet>
    </>
  );
}
