import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Pencil, PiggyBank } from 'lucide-react';
import MoneyInput from '@/components/common/MoneyInput';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { dayMessage, planHeadline } from '@/lib/moneyPlan';
import { cn } from '@/lib/utils';
import { updateMoneyProfile } from '@/services/moneyProfileService';

/**
 * Contenido de la franja violeta con Mi plata activa: cuánta plata tiene el usuario y, en una sola
 * línea, lo que puede gastar hoy. Los avisos y el consejo solo salen cuando hay algo que decir.
 *
 * @param {object} props
 * @param {object} props.plan Respuesta de `GET /money-profile/plan` con `ready: true`.
 * @param {import('@/services/moneyProfileService').MoneyProfile} [props.profile] Hace falta para corregir el saldo.
 * @param {(value: number) => string} props.money Formatea un monto (o lo oculta).
 * @param {() => void} props.onChanged El saldo cambió: hay que recalcular.
 */
export default function PlanSummary({ plan, profile, money, onChanged }) {
  const { label, value, note, warning } = planHeadline(plan, money);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const hasDayLimit = plan.mode === 'daily' && plan.shortfall === 0;
  const percent = plan.perDay > 0 ? Math.min(100, (plan.spentToday / plan.perDay) * 100) : 100;
  const message = hasDayLimit ? dayMessage(plan, money) : '';

  const saveBalance = async (balance) => {
    setError('');
    try {
      const { incomeType, payDays } = profile;
      await updateMoneyProfile({ incomeType, payDays, balance, resetBalance: true });
      setEditing(false);
      setText('');
      onChanged();
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
    saveBalance(Number(text));
  };

  return (
    <>
      <div className="relative mt-2 flex items-center gap-2">
        <p className="text-4xl font-semibold tracking-tight tabular-nums md:text-5xl">{money(plan.money)}</p>
        {profile && !editing && (
          <button
            type="button"
            aria-label="Corregir cuánta plata tienes"
            onClick={() => setEditing(true)}
            className="grid size-9 shrink-0 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-white"
          >
            <Pencil className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {editing && (
        <form onSubmit={submit} className="relative mt-3 space-y-2 text-ink">
          <Label htmlFor="plan-balance" className="text-white">
            Suma banco, Nequi y efectivo
          </Label>
          <MoneyInput id="plan-balance" value={text} onChange={setText} placeholder="0" showHint={false} autoFocus />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" variant="outline-light">
              Guardar
            </Button>
            {plan.ledger > 0 && plan.ledger !== plan.money && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-white hover:text-white"
                onClick={() => saveBalance(plan.ledger)}
              >
                Usar mis movimientos
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-white hover:text-white"
              onClick={() => setEditing(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="relative mt-2 text-sm">
          {error}
        </p>
      )}

      <div className="relative mt-5 border-t border-white/20 pt-4">
        <Link to="/app/mi-plata" className="flex items-center gap-3 focus-visible:outline-white">
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-white/90">{label}</span>
            <span className="block text-xs text-white/70">{note}</span>
          </span>
          <span className="shrink-0 text-right text-xl font-semibold tabular-nums">
            {warning && <span className="sr-only">Atención: </span>}
            {value}
          </span>
          <ChevronRight className="size-4 shrink-0 text-white/60" aria-hidden="true" />
          <span className="sr-only">Ver Mi plata</span>
        </Link>

        {hasDayLimit && plan.spentToday > 0 && (
          <div
            role="progressbar"
            aria-label="Gastado hoy"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
            className="mt-3 h-1 overflow-hidden rounded-full bg-white/20"
          >
            <div
              className={cn('h-full rounded-full', plan.dayStatus === 'ok' ? 'bg-white' : 'bg-amber-300')}
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
        {message && (
          <p role="status" className="mt-2 text-sm font-medium text-amber-200">
            {message}
          </p>
        )}
        {plan.mode === 'goal' && (
          <p className="mt-2 text-sm text-white/80">
            Hoy llevas {money(plan.todayIncome)}
            {plan.usualIncome !== null && ` · sueles hacer ${money(plan.usualIncome)}`}
          </p>
        )}
        {plan.saveAdvice > 0 && (
          <p className="mt-2 flex items-center gap-2 text-sm text-white/90">
            <PiggyBank className="size-4 shrink-0" aria-hidden="true" />
            Podrías apartar {money(plan.saveAdvice)}
          </p>
        )}
        {!plan.hasCommitments && (
          <Link to="/app/mi-plata" className="mt-2 block text-sm text-white/80 underline underline-offset-2">
            Agrega tus pagos del mes
          </Link>
        )}
      </div>
    </>
  );
}
