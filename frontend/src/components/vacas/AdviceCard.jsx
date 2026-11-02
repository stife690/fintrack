import { useEffect, useState } from 'react';
import { BellRing, Loader2, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getAdvice } from '@/services/vacaService';
import { projectionText } from './vacaFormat';

const TONES = {
  positive: 'text-positive',
  caution: 'text-caution',
  neutral: 'text-ink/70',
};

/**
 * La parte "inteligente" de la vaca (FT-0014): lectura del ritmo del grupo, consejo de la IA
 * (solo con datos agregados; si la IA no responde, uno calculado con reglas) y, para los
 * administradores, el recordatorio push a los atrasados.
 *
 * @param {object} props
 * @param {import('@/services/vacaService').Vaca} props.vaca
 * @param {boolean} props.online
 * @param {() => Promise<{ reminded: number, delivered: number }>} props.onRemind
 */
export default function AdviceCard({ vaca, online, onRemind }) {
  const [advice, setAdvice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [remindState, setRemindState] = useState({ busy: false, message: '', error: '' });
  const reading = projectionText(vaca);
  const behind = vaca.members?.filter((m) => !m.isMe && m.remaining > 0 && m.status !== 'al_dia').length ?? 0;

  // El consejo depende del total: se vuelve a pedir cuando alguien aporta. El servidor lo guarda,
  // así que pedirlo de nuevo con el mismo total no vuelve a llamar a la IA.
  useEffect(() => {
    if (!online) return undefined;
    let cancelled = false;
    setLoading(true);
    getAdvice(vaca.id)
      .then((data) => !cancelled && setAdvice(data))
      .catch(() => !cancelled && setAdvice(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [vaca.id, vaca.total, online]);

  const remind = async () => {
    setRemindState({ busy: true, message: '', error: '' });
    try {
      const { reminded, delivered } = await onRemind();
      setRemindState({
        busy: false,
        error: '',
        message:
          reminded === 0
            ? 'Nadie está atrasado: no hizo falta recordar.'
            : `Recordamos a ${reminded === 1 ? '1 miembro' : `${reminded} miembros`}${delivered === 0 ? ', pero no tienen las notificaciones activas en ningún dispositivo' : ''}.`,
      });
    } catch (err) {
      setRemindState({ busy: false, message: '', error: err.message });
    }
  };

  return (
    <div className="space-y-4">
      <p className={cn('flex items-start gap-2 font-medium', TONES[reading.tone])}>
        <TrendingUp className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        {reading.text}
      </p>

      <div className="rounded-xl bg-brand-soft/50 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand">
          <Sparkles className="size-4" aria-hidden="true" /> Consejo para el grupo
        </p>
        {!online ? (
          <p className="mt-2 text-sm text-ink/60">Sin conexión: el consejo aparece al volver internet.</p>
        ) : loading && !advice ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-ink/60">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Pensando…
          </p>
        ) : advice ? (
          <>
            <p className="mt-2 text-ink/80">{advice.advice}</p>
            <p className="mt-2 text-xs text-ink/50">
              {advice.source === 'ia'
                ? 'Generado con IA solo con los totales del grupo (sin nombres).'
                : 'Calculado con los datos del grupo.'}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink/60">No pudimos traer el consejo ahora.</p>
        )}
      </div>

      {vaca.role === 'admin' && vaca.status !== 'completada' && (
        <div>
          {behind > 0 || remindState.message ? (
            <Button variant="outline" className="w-full sm:w-auto" onClick={remind} disabled={!online || remindState.busy}>
              {remindState.busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <BellRing aria-hidden="true" />}
              Recordar a quienes les falta
            </Button>
          ) : (
            <p className="text-sm text-ink/60">Todos van al día o ya cumplieron.</p>
          )}
          <p role="status" className={cn('text-sm text-positive', remindState.message && 'mt-2')}>
            {remindState.message}
          </p>
          {remindState.error && (
            <p role="alert" className="mt-2 text-sm text-negative">
              {remindState.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
