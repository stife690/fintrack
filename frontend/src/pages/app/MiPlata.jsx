import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import MoneyInput from '@/components/common/MoneyInput';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import IncomeFields from '@/components/money/IncomeFields';
import { formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useAsync from '@/hooks/useAsync';
import usePageTitle from '@/hooks/usePageTitle';
import { balanceProposal, incomeSummary, readCommitmentForm, toProfileData } from '@/lib/moneyProfile';
import {
  createCommitment,
  deleteCommitment,
  getMoneyProfile,
  updateCommitment,
  updateMoneyProfile,
} from '@/services/moneyProfileService';

const EMPTY_COMMITMENT = { id: null, name: '', amount: '', dayOfMonth: '' };

/** Encabezado de una sección, con su botón a la derecha. */
function SectionTitle({ id, title, action }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {action}
    </div>
  );
}

/** Mensaje de error de un formulario. */
function FormError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-negative">
      {message}
    </p>
  );
}

/**
 * Cómo le entra la plata al usuario: una línea, y al tocar Cambiar (o Configurar, si aún no lo dijo), las opciones.
 * @param {{ profile: import('@/services/moneyProfileService').MoneyProfile, onSave: (changes: object) => Promise<void> }} props
 */
function IncomeSection({ profile, onSave }) {
  const [income, setIncome] = useState(null); // `null`: no se está editando
  const [error, setError] = useState('');

  const save = async (event) => {
    event.preventDefault();
    if (income.incomeType === 'fecha_fija' && income.payDays.length === 0) {
      setError('Elige al menos un día de pago.');
      return;
    }
    setError('');
    try {
      await onSave(income);
      setIncome(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const edit = () => setIncome({ incomeType: profile.incomeType ?? '', payDays: profile.payDays });

  return (
    <Panel aria-labelledby="mi-plata-ingreso">
      <SectionTitle
        id="mi-plata-ingreso"
        title="Cómo recibes la plata"
        action={
          !income && (
            <Button variant="ghost" size="sm" onClick={edit}>
              {profile.incomeType ? 'Cambiar' : 'Configurar'}
            </Button>
          )
        }
      />
      {income ? (
        <form onSubmit={save} className="mt-4 space-y-4">
          <IncomeFields
            incomeType={income.incomeType}
            payDays={income.payDays}
            onChange={(changes) => setIncome((current) => ({ ...current, ...changes }))}
          />
          <FormError message={error} />
          <div className="flex gap-2">
            <Button type="submit">Guardar</Button>
            <Button type="button" variant="ghost" onClick={() => setIncome(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-1 text-ink/60">{incomeSummary(profile)}</p>
      )}
    </Panel>
  );
}

/**
 * Para quien aún no dice cuánta plata tiene; después se ve y se corrige en la ficha del inicio. Si
 * sus movimientos dan un número, se lo propone en vez de pedirle que escriba uno de memoria.
 * @param {{ profile: import('@/services/moneyProfileService').MoneyProfile, onSave: (changes: object) => Promise<void> }} props
 */
function BalanceSection({ profile, onSave }) {
  const proposal = balanceProposal(profile.totals);
  const [typing, setTyping] = useState(proposal === null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const save = async (balance) => {
    setError('');
    try {
      await onSave({ balance: String(balance), resetBalance: true });
    } catch (err) {
      setError(err.message);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    if (text === '') {
      setError('Escribe cuánta plata tienes.');
      return;
    }
    save(text);
  };

  return (
    <Panel aria-labelledby="mi-plata-saldo">
      <SectionTitle id="mi-plata-saldo" title="Cuánta plata tienes" />

      {!typing && (
        <div className="mt-4 rounded-2xl bg-ink/5 p-4">
          <p className="text-sm text-ink/60">Según tus movimientos</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums">{formatMoney(proposal)}</p>
          <p className="text-sm text-ink/60">
            Entró {formatMoney(profile.totals.income)} y salió {formatMoney(profile.totals.expense)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => save(proposal)}>
              Sí, tengo eso
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setTyping(true)}>
              No, tengo otra cantidad
            </Button>
          </div>
        </div>
      )}

      {typing && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="money-balance">Suma banco, Nequi y efectivo</Label>
            <MoneyInput id="money-balance" value={text} onChange={setText} placeholder="0" autoFocus />
          </div>
          <div className="flex gap-2">
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      )}
      <FormError message={error} />
    </Panel>
  );
}

/**
 * Ventana para agregar o editar un pago. Usa `<dialog>`: el navegador mantiene el foco adentro y
 * la tecla Escape la cierra.
 * @param {{ form: typeof EMPTY_COMMITMENT, onClose: () => void, onSaved: () => void }} props
 */
function CommitmentDialog({ form: initial, onClose, onSaved }) {
  const dialog = useRef(null);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dialog.current.showModal();
  }, []);

  const change = (changes) => setForm((current) => ({ ...current, ...changes }));

  const save = async (event) => {
    event.preventDefault();
    const { data, error: problem } = readCommitmentForm(form);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (form.id) await updateCommitment(form.id, data);
      else await createCommitment(data);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="pago-titulo"
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-surface p-5 text-ink backdrop:bg-black/50"
    >
      <form onSubmit={save} className="space-y-4">
        <h2 id="pago-titulo" className="text-lg font-semibold tracking-tight">
          {form.id ? 'Editar pago' : 'Nuevo pago'}
        </h2>
        <div className="space-y-2">
          <Label htmlFor="commitment-name">Nombre</Label>
          <Input
            id="commitment-name"
            maxLength={60}
            placeholder="Arriendo"
            value={form.name}
            onChange={(e) => change({ name: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-3">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="commitment-amount">Monto</Label>
            <MoneyInput
              id="commitment-amount"
              value={form.amount}
              showHint={false}
              onChange={(amount) => change({ amount })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="commitment-day">Día</Label>
            <Input
              id="commitment-day"
              inputMode="numeric"
              maxLength={2}
              placeholder="30"
              value={form.dayOfMonth}
              onChange={(e) => change({ dayOfMonth: e.target.value.replace(/\D/g, '') })}
            />
          </div>
        </div>
        <FormError message={error} />
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
            Guardar pago
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </dialog>
  );
}

/**
 * Lista de pagos de cada mes. El formulario solo aparece en una ventana al agregar o editar.
 * @param {{ commitments: import('@/services/moneyProfileService').Commitment[], onChanged: () => void }} props
 */
function PaymentsSection({ commitments, onChanged }) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  const remove = async (commitment) => {
    setError('');
    try {
      await deleteCommitment(commitment.id);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const edit = ({ id, name, amount, dayOfMonth }) =>
    setForm({ id, name, amount: String(amount), dayOfMonth: String(dayOfMonth) });

  return (
    <Panel aria-labelledby="mi-plata-pagos">
      <SectionTitle
        id="mi-plata-pagos"
        title="Pagos de cada mes"
        action={
          <Button variant="soft" size="sm" onClick={() => setForm(EMPTY_COMMITMENT)}>
            <Plus aria-hidden="true" />
            Agregar pago
          </Button>
        }
      />
      {commitments.length === 0 ? (
        <p className="mt-2 text-sm text-ink/60">Agrega lo que pagas cada mes, como arriendo, internet o celular.</p>
      ) : (
        <ul className="mt-2 divide-y divide-ink/10">
          {commitments.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.name}</p>
                <p className="text-sm text-ink/60">
                  {formatMoney(c.amount)} · día {c.dayOfMonth}
                </p>
              </div>
              <Button variant="ghost" size="icon" aria-label={`Editar ${c.name}`} onClick={() => edit(c)}>
                <Pencil aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" aria-label={`Eliminar ${c.name}`} onClick={() => remove(c)}>
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <FormError message={error} />
      {form && (
        <CommitmentDialog
          form={form}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            onChanged();
          }}
        />
      )}
    </Panel>
  );
}

/**
 * Página privada `/app/mi-plata` (FT-0041): cómo recibe la plata el usuario y qué paga cada mes. De
 * aquí salen los números de la ficha del inicio, donde se ve y se corrige cuánta plata tiene.
 */
export default function MiPlata() {
  usePageTitle('Mi plata');
  const profile = useAsync(getMoneyProfile, []);
  const data = profile.data;

  /** Guarda un cambio sin tocar lo demás del perfil. */
  const save = async ({ resetBalance = false, ...changes }) => {
    const form = {
      incomeType: data.incomeType ?? '',
      payDays: data.payDays,
      balance: data.balance === null ? '' : String(data.balance),
      ...changes,
    };
    await updateMoneyProfile({ ...toProfileData(form), resetBalance });
    profile.reload();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Mi plata" description="Con esto calculamos cuánto puedes gastar." />
      {profile.error && !data && (
        <p role="alert" className="text-sm text-negative">
          {profile.error}{' '}
          <button type="button" className="underline" onClick={profile.reload}>
            Reintentar
          </button>
        </p>
      )}
      {data && (
        <div className="flex flex-col gap-5">
          <IncomeSection profile={data} onSave={save} />
          {data.money === null && <BalanceSection profile={data} onSave={save} />}
          <PaymentsSection commitments={data.commitments} onChanged={profile.reload} />
          <Panel className="p-0 md:hidden">
            <Link
              to="/app/calendario"
              className="flex items-center gap-3 rounded-2xl p-4 transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-violet"
            >
              <CalendarDays className="size-5 shrink-0 text-brand" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Calendario</span>
                <span className="block text-sm text-ink/60">Cuánto te queda después de cada pago</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-ink/40" aria-hidden="true" />
            </Link>
          </Panel>
        </div>
      )}
    </div>
  );
}
