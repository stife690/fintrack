import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Pencil, Trash2 } from 'lucide-react';
import BankSyncForm from '@/components/cards/BankSyncForm';
import CardForm from '@/components/cards/CardForm';
import CreditCardArt from '@/components/cards/CreditCardArt';
import PayCardForm from '@/components/cards/PayCardForm';
import { paymentText, shortDate } from '@/components/cards/cardFormat';
import ConfirmButton from '@/components/common/ConfirmButton';
import Sheet from '@/components/common/Sheet';
import { MASK } from '@/components/dashboard/BalanceCard';
import Panel from '@/components/layout/Panel';
import { formatDate, formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import useHiddenAmounts from '@/hooks/useHiddenAmounts';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { deleteCard, deleteCardPayment, getCard, getCardMovements, payCard, syncCardWithBank, updateCard } from '@/services/cardService';

const INTEREST_NOTE = 'Los intereses los calcula tu banco a la fecha de corte.';

/** Una fila del historial: compra, pago (que se puede eliminar) o ajuste con el banco. */
function MovementRow({ m, money, online, onDeletePayment }) {
  const isAdjustment = m.kind === 'adjustment';
  const title =
    m.kind === 'purchase'
      ? m.description
      : m.kind === 'payment'
        ? 'Pago'
        : `Ajuste con el banco ${m.amount < 0 ? '−' : '+'}${money(Math.abs(m.amount))}`;
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="break-words font-medium">{title}</p>
        <p className="text-sm text-ink/60">
          {formatDate(m.date)}
          {m.installments > 1 && (
            <>
              {' · '}a {m.installments} cuotas
              <span title={INTEREST_NOTE} aria-hidden="true">*</span>
            </>
          )}
        </p>
        {m.installments > 1 && <p className="text-xs text-ink/60">* {INTEREST_NOTE}</p>}
      </div>
      {!isAdjustment && (
        <div className="flex shrink-0 flex-col items-end">
          <p className={`tabular-nums ${m.kind === 'payment' ? 'text-positive' : ''}`}>
            {m.kind === 'payment' ? '−' : ''}
            {money(m.amount)}
          </p>
          {m.kind === 'payment' && (
            <ConfirmButton
              label="Eliminar pago"
              question="¿Eliminar este pago? Lo usado vuelve a subir."
              confirmLabel="Sí, eliminar"
              icon={Trash2}
              disabled={!online}
              onConfirm={() => onDeletePayment(m.id)}
            />
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Contenido del detalle, sin red ni hojas (se puede probar con `renderToStaticMarkup`).
 * @param {{ card: object, movements: object[], online: boolean, hidden: boolean, onAction: (a: 'pay'|'sync'|'edit') => void, onDelete: () => Promise<void>, onDeletePayment: (paymentId: string) => Promise<void> }} props
 */
export function CardDetailView({ card, movements, online, hidden, onAction, onDelete, onDeletePayment }) {
  const money = (n) => (hidden ? MASK : formatMoney(n));
  const pct = card.limit > 0 ? Math.min(100, Math.round((card.used / card.limit) * 100)) : 0;
  return (
    <>
      <div className="flex justify-center">
        <CreditCardArt network={card.network} tier={card.tier} last4={card.last4} name={card.name} size="lg" />
      </div>
      <Panel className="mt-4">
        <div role="progressbar" aria-label={`Uso de ${card.name}`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 tabular-nums text-ink/70">
          Usado {money(card.used)} · Disponible {money(card.available)} · Cupo {money(card.limit)}
        </p>
        <p className="mt-1 font-medium">{paymentText(card)}</p>
        {card.statementTotal != null && (
          <p className="mt-1 text-sm tabular-nums text-ink/70">
            Total del extracto {money(card.statementTotal)}
            {card.statementDueDate && ` · vence el ${shortDate(card.statementDueDate)}`}
          </p>
        )}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button size="lg" disabled={!online} onClick={() => onAction('pay')}>
            Ya pagué
          </Button>
          <Button size="lg" variant="outline" disabled={!online} onClick={() => onAction('sync')}>
            Actualizar con el banco
          </Button>
          <Button variant="ghost" className="min-h-11 justify-start" disabled={!online} onClick={() => onAction('edit')}>
            <Pencil aria-hidden="true" /> Editar
          </Button>
          <ConfirmButton
            label="Eliminar"
            question="¿Eliminar esta tarjeta? Las compras se quedan en tu historial."
            confirmLabel="Sí, eliminar"
            icon={Trash2}
            disabled={!online}
            onConfirm={onDelete}
          />
        </div>
        {!online && <p className="mt-2 text-sm text-ink/60">Necesitas conexión</p>}
      </Panel>
      <h2 className="mb-1 mt-6 text-lg font-semibold">Historial</h2>
      {movements.length === 0 ? (
        <p className="text-ink/60">Aún no hay movimientos.</p>
      ) : (
        <ul aria-label="Historial de la tarjeta" className="divide-y divide-ink/10">
          {movements.map((m) => (
            <MovementRow key={`${m.kind}-${m.id}`} m={m} money={money} online={online} onDeletePayment={onDeletePayment} />
          ))}
        </ul>
      )}
    </>
  );
}

/** Página privada `/app/tarjetas/:id`: uso, pagos, ajuste con el banco e historial. */
export default function CardDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const [hidden] = useHiddenAmounts();
  const [card, setCard] = useState(null);
  const [movements, setMovements] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sheet, setSheet] = useState(null); // 'pay' | 'sync' | 'edit'
  usePageTitle(card?.name ?? 'Tarjeta');

  const load = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([getCard(id), getCardMovements(id)]);
      setCard(c);
      setMovements(m);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const close = () => setSheet(null);
  /** Corre la acción, cierra la hoja y recarga el historial. */
  const apply = async (action, message) => {
    const result = await action();
    close();
    setNotice(typeof message === 'function' ? message(result) : message);
    await load();
  };

  if (!card) {
    return error ? (
      <p role="alert" className="text-negative">
        {error}{' '}
        <button type="button" className="underline" onClick={load}>Reintentar</button>
      </p>
    ) : (
      <p className="flex items-center gap-2 py-10 text-ink/60"><Loader2 className="animate-spin" aria-hidden="true" /> Cargando…</p>
    );
  }

  return (
    <>
      {/* En el celular ya está el botón de volver arriba. */}
      <Link to="/app/tarjetas" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-ink/70 max-md:hidden">
        <ArrowLeft className="size-4" aria-hidden="true" /> Tarjetas
      </Link>
      {notice && <p role="status" className="mb-3 rounded-xl bg-positive/10 p-3 text-sm">{notice}</p>}
      {error && <p role="alert" className="mb-3 text-sm text-negative">{error}</p>}
      <CardDetailView
        card={card}
        movements={movements}
        online={online}
        hidden={hidden}
        onAction={setSheet}
        onDelete={async () => {
          await deleteCard(id);
          navigate('/app/tarjetas');
        }}
        onDeletePayment={async (paymentId) => {
          await deleteCardPayment(id, paymentId);
          setNotice('Pago eliminado.');
          await load();
        }}
      />
      <Sheet open={sheet === 'pay'} title="Ya pagué" onClose={close}>
        <PayCardForm
          suggested={card.statementTotal ?? card.used}
          disabled={!online}
          onSubmit={(v) => apply(() => payCard(id, v), 'Pago registrado.')}
        />
      </Sheet>
      <Sheet open={sheet === 'sync'} title="Actualizar con el banco" onClose={close}>
        <BankSyncForm
          card={card}
          hidden={hidden}
          disabled={!online}
          onSubmit={(v) =>
            apply(
              () => syncCardWithBank(id, v),
              (r) =>
                r.chargeTransaction
                  ? `Se registró un gasto de ${hidden ? MASK : formatMoney(r.chargeTransaction.amount)} en Cargos del banco.`
                  : 'Tarjeta actualizada con el banco.',
            )
          }
        />
      </Sheet>
      <Sheet open={sheet === 'edit'} title="Editar tarjeta" onClose={close}>
        <CardForm initial={card} disabled={!online} onSubmit={(v) => apply(() => updateCard(id, v), 'Cambios guardados.')} onCancel={close} />
      </Sheet>
    </>
  );
}
