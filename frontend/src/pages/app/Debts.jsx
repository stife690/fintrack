import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import ConfirmButton from '@/components/common/ConfirmButton';
import Sheet from '@/components/common/Sheet';
import Tabs from '@/components/common/Tabs';
import DebtForm from '@/components/debts/DebtForm';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { MASK } from '@/components/dashboard/BalanceCard';
import { formatMoney } from '@/components/transactions/format';
import { todayIso } from '@/components/vacas/vacaFormat';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import useHiddenAmounts from '@/hooks/useHiddenAmounts';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { DEBT_WORDS, dueText } from '@/lib/debts';
import { cn } from '@/lib/utils';
import { createDebt, deleteDebt, listDebts, settleDebt, updateDebt } from '@/services/debtService';

/**
 * Hoja "Ya me pagó / Ya pagué": por defecto también registra el movimiento.
 * @param {{ debt: object, money: (n: number) => string, disabled: boolean, onConfirm: (createTransaction: boolean) => Promise<void> }} props
 */
function SettleForm({ debt, money, disabled, onConfirm }) {
  const words = DEBT_WORDS[debt.kind];
  const [record, setRecord] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm(record);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <p>
        {debt.kind === 'receivable' ? `${debt.person} te pagó ` : `Le pagaste a ${debt.person} `}
        <span className="font-semibold tabular-nums">{money(debt.amount)}</span>.
      </p>
      <label className="flex items-start gap-3 rounded-xl bg-ink/5 p-3 text-sm">
        <Checkbox
          checked={record}
          onCheckedChange={(v) => setRecord(v === true)}
          disabled={disabled || busy}
          className="mt-0.5"
        />
        <span>
          <span className="font-medium">{words.movement}</span>
          <span className="block text-ink/60">
            Así tu saldo de hoy queda bien. Va en {debt.kind === 'receivable' ? 'Otros ingresos' : 'Otros'}; puedes cambiar la
            categoría después.
          </span>
        </span>
      </label>
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      <Button size="lg" className="w-full" onClick={confirm} disabled={disabled || busy}>
        {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
        {words.settle}
      </Button>
    </div>
  );
}

/**
 * Una cuenta de la lista.
 * @param {{ debt: object, today: string, money: (n: number) => string, online: boolean, onSettle: () => void, onEdit: () => void }} props
 */
function DebtRow({ debt, today, money, online, onSettle, onEdit }) {
  const due = dueText(debt.dueDate, today);
  const settled = Boolean(debt.settledAt);
  return (
    <li
      className={cn('flex flex-wrap items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-4', settled && 'opacity-70')}
    >
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="break-words font-medium">{debt.person}</span>
          <span className={cn('font-semibold tabular-nums', settled && 'line-through decoration-ink/40')}>
            {money(debt.amount)}
          </span>
        </p>
        {debt.note && <p className="mt-0.5 break-words text-sm text-ink/60">{debt.note}</p>}
        {settled ? (
          <p className="mt-1 text-sm text-ink/60">
            Saldada{' '}
            {debt.transactionId && (
              <>
                ·{' '}
                <Link to="/app/transacciones" className="underline">
                  ver en Movimientos
                </Link>
              </>
            )}
          </p>
        ) : (
          due && <p className={cn('mt-1 text-sm', due.late ? 'font-medium text-negative' : 'text-ink/60')}>{due.text}</p>
        )}
      </div>
      {!settled && (
        <div className="flex w-full gap-2 sm:w-auto">
          <Button size="sm" className="flex-1 sm:flex-none" onClick={onSettle} disabled={!online}>
            <Check aria-hidden="true" /> {DEBT_WORDS[debt.kind].settle}
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit} disabled={!online} aria-label={`Editar la cuenta de ${debt.person}`}>
            <Pencil aria-hidden="true" />
          </Button>
        </div>
      )}
    </li>
  );
}

/**
 * Lista de un lado (me deben o debo): las pendientes y, debajo, las saldadas.
 * @param {{ items: object[], kind: 'receivable'|'payable', today: string, money: (n: number) => string, online: boolean, onAdd: () => void, onSettle: (d: object) => void, onEdit: (d: object) => void }} props
 */
export function DebtList({ items, kind, today, money, online, onAdd, onSettle, onEdit }) {
  const pending = items.filter((d) => !d.settledAt);
  const settled = items.filter((d) => d.settledAt);
  if (items.length === 0) {
    return (
      <Panel className="text-center">
        <p className="mx-auto max-w-md text-ink/60">{DEBT_WORDS[kind].empty}</p>
        <Button className="mt-4" onClick={onAdd} disabled={!online}>
          <Plus aria-hidden="true" /> Agregar
        </Button>
      </Panel>
    );
  }
  const row = (d) => (
    <DebtRow
      key={d.id}
      debt={d}
      today={today}
      money={money}
      online={online}
      onSettle={() => onSettle(d)}
      onEdit={() => onEdit(d)}
    />
  );
  return (
    <div className="space-y-6">
      {pending.length > 0 ? (
        <ul aria-label={`${DEBT_WORDS[kind].tab}: pendientes`} className="space-y-2">
          {pending.map(row)}
        </ul>
      ) : (
        <p className="text-ink/60">Todo está saldado.</p>
      )}
      {settled.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink/60">Saldadas</h2>
          <ul aria-label={`${DEBT_WORDS[kind].tab}: saldadas`} className="space-y-2">
            {settled.map(row)}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Página privada `/app/cuentas`: lo que te deben y lo que debes (FT-0046). */
export default function Debts() {
  usePageTitle('Cuentas');
  const online = useOnlineStatus();
  const [hidden] = useHiddenAmounts();
  const money = (n) => (hidden ? MASK : formatMoney(n));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('receivable');
  /** @type {[null | { mode: 'new' } | { mode: 'edit' | 'settle', debt: object }, Function]} */
  const [sheet, setSheet] = useState(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const today = todayIso();

  useEffect(() => {
    let cancelled = false;
    listDebts()
      .then((res) => !cancelled && (setData(res), setError('')))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [version]);

  const done = () => {
    setSheet(null);
    reload();
  };
  const handleCreate = async (values) => {
    await createDebt(values);
    setTab(values.kind);
    done();
  };
  const handleEdit = async (values) => {
    await updateDebt(sheet.debt.id, values);
    done();
  };
  const handleSettle = async (createTransaction) => {
    await settleDebt(sheet.debt.id, { createTransaction });
    done();
  };
  const handleDelete = async () => {
    await deleteDebt(sheet.debt.id);
    done();
  };

  const count = (kind) => data?.items.filter((d) => d.kind === kind && !d.settledAt).length ?? 0;
  const titles = {
    new: 'Nueva cuenta',
    edit: 'Editar cuenta',
    settle: sheet?.debt && DEBT_WORDS[sheet.debt.kind].settle,
  };

  return (
    <>
      <PageHeader
        title="Cuentas"
        description="Quién te debe y a quién le debes."
        actions={
          <Button onClick={() => setSheet({ mode: 'new' })} disabled={!online}>
            <Plus aria-hidden="true" /> Agregar
          </Button>
        }
      />
      {!online && <p className="mb-3 text-sm text-ink/60">Necesitas conexión para ver o cambiar tus cuentas.</p>}
      {error && (
        <p role="alert" className="mb-3 text-sm text-negative">
          {error}{' '}
          <button type="button" className="underline" onClick={reload}>
            Reintentar
          </button>
        </p>
      )}
      {data === null && !error && (
        <p className="flex items-center gap-2 py-10 text-ink/60">
          <Loader2 className="animate-spin" aria-hidden="true" /> Cargando…
        </p>
      )}
      {data && (
        <div className="mx-auto max-w-2xl space-y-6">
          <dl className="grid grid-cols-2 gap-3">
            <Panel>
              <dt className="text-sm text-ink/60">Te deben</dt>
              <dd
                className={cn(
                  'mt-1 text-xl font-semibold tabular-nums md:text-2xl',
                  data.totals.receivable > 0 ? 'text-positive' : 'text-ink/50',
                )}
              >
                {money(data.totals.receivable)}
              </dd>
            </Panel>
            <Panel>
              <dt className="text-sm text-ink/60">Debes</dt>
              <dd
                className={cn(
                  'mt-1 text-xl font-semibold tabular-nums md:text-2xl',
                  data.totals.payable > 0 ? 'text-negative' : 'text-ink/50',
                )}
              >
                {money(data.totals.payable)}
              </dd>
            </Panel>
          </dl>
          <Tabs
            label="Cuentas"
            tabs={['receivable', 'payable'].map((kind) => ({
              value: kind,
              label: DEBT_WORDS[kind].tab,
              count: count(kind),
            }))}
            value={tab}
            onChange={setTab}
          >
            {(kind) => (
              <DebtList
                items={data.items.filter((d) => d.kind === kind)}
                kind={kind}
                today={today}
                money={money}
                online={online}
                onAdd={() => setSheet({ mode: 'new' })}
                onSettle={(debt) => setSheet({ mode: 'settle', debt })}
                onEdit={(debt) => setSheet({ mode: 'edit', debt })}
              />
            )}
          </Tabs>
        </div>
      )}
      <Sheet open={sheet !== null} title={sheet ? titles[sheet.mode] : ''} onClose={() => setSheet(null)}>
        {sheet?.mode === 'new' && <DebtForm kind={tab} disabled={!online} onSubmit={handleCreate} />}
        {sheet?.mode === 'edit' && (
          <div className="space-y-4">
            <DebtForm key={sheet.debt.id} debt={sheet.debt} disabled={!online} onSubmit={handleEdit} />
            <ConfirmButton
              label="Borrar cuenta"
              question={`¿Borrar la cuenta de ${sheet.debt.person}? No se puede deshacer.`}
              confirmLabel="Sí, borrar"
              icon={Trash2}
              disabled={!online}
              onConfirm={handleDelete}
            />
          </div>
        )}
        {sheet?.mode === 'settle' && <SettleForm debt={sheet.debt} money={money} disabled={!online} onConfirm={handleSettle} />}
      </Sheet>
    </>
  );
}
