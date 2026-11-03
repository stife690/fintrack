import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import MoneyInput from '@/components/common/MoneyInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NETWORK_LABELS, TIERS, cardLabel } from '@/lib/cardStyles';
import { cardEditSchema, cardSchema } from '@/lib/validation/card';
import CreditCardArt from './CreditCardArt';

/** @param {object|null} initial */
function toDefaults(initial) {
  return {
    network: initial?.network ?? 'visa',
    tier: initial?.tier ?? 'clasica',
    last4: initial?.last4 ?? '',
    name: initial?.name ?? '',
    limit: initial ? String(initial.limit) : '',
    available: '',
    paymentDay: initial ? String(initial.paymentDay) : '',
    cutoffDay: initial?.cutoffDay ? String(initial.cutoffDay) : '',
  };
}

/**
 * Galería de tarjetas dibujadas agrupadas por franquicia; tocar una elige el tipo.
 * @param {{ network: string, tier: string, last4: string, disabled?: boolean, onPick: (network: string, tier: string) => void }} props
 */
function CardGallery({ network, tier, last4, disabled, onPick }) {
  return (
    <fieldset className="min-w-0 space-y-3" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium text-ink/80">Tipo de tarjeta</legend>
      {Object.entries(TIERS).map(([net, tiers]) => (
        <div key={net}>
          <p className="mb-1 text-xs font-medium text-ink/60">{NETWORK_LABELS[net]}</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {tiers.map((t) => {
              const selected = net === network && t === tier;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={selected}
                  aria-label={cardLabel(net, t)}
                  onClick={() => onPick(net, t)}
                  className={`min-h-11 shrink-0 rounded-2xl p-0.5 focus-visible:outline-2 focus-visible:outline-violet ${selected ? 'ring-2 ring-brand' : 'opacity-70'}`}
                >
                  <CreditCardArt network={net} tier={t} last4={last4 || '0000'} size="sm" />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </fieldset>
  );
}

/**
 * Formulario de tarjeta de crédito: una sola pantalla con 5 campos; nombre y día de corte
 * quedan en "Más detalles". En edición no pide "Cupo disponible hoy".
 *
 * @param {object} props
 * @param {object|null} [props.initial] Tarjeta a editar.
 * @param {boolean} [props.disabled] Sin conexión.
 * @param {(values: object) => Promise<void>} props.onSubmit Debe lanzar un `Error` si falla.
 * @param {() => void} [props.onCancel]
 */
export default function CardForm({ initial = null, disabled = false, onSubmit, onCancel }) {
  const [serverError, setServerError] = useState('');
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(initial ? cardEditSchema : cardSchema), defaultValues: toDefaults(initial) });

  useEffect(() => {
    reset(toDefaults(initial));
    setServerError('');
  }, [initial, reset]);

  const [network, tier, last4, name] = watch(['network', 'tier', 'last4', 'name']);
  const digits = /^\d{4}$/.test(last4) ? last4 : '····';

  const submit = handleSubmit(async (v) => {
    setServerError('');
    const data = {
      network: v.network,
      tier: v.tier,
      last4: v.last4,
      limit: v.limit,
      paymentDay: v.paymentDay,
      ...(v.name && { name: v.name }),
    };
    if (initial) data.cutoffDay = v.cutoffDay === '' ? null : v.cutoffDay;
    else {
      data.available = v.available;
      if (v.cutoffDay !== '') data.cutoffDay = v.cutoffDay;
    }
    try {
      await onSubmit(data);
    } catch (err) {
      for (const [field, problem] of Object.entries(err.fields ?? {})) {
        if (field in toDefaults(null)) setError(field, { message: problem });
      }
      setServerError(err.message);
    }
  });

  const money = (nameKey, id, label, hint) => (
    <Controller
      control={control}
      name={nameKey}
      render={({ field }) => (
        <FormField id={id} label={label} error={errors[nameKey]?.message}>
          <MoneyInput name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} placeholder="0" disabled={disabled} />
        </FormField>
      )}
    />
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-5" aria-label={initial ? 'Editar tarjeta' : 'Nueva tarjeta'}>
      <div className="flex justify-center">
        <CreditCardArt network={network} tier={tier} last4={digits} name={name || `${cardLabel(network, tier)} ••${digits}`} size="lg" />
      </div>
      <CardGallery
        network={network}
        tier={tier}
        last4={/^\d{4}$/.test(last4) ? last4 : ''}
        disabled={disabled}
        onPick={(n, t) => {
          setValue('network', n);
          setValue('tier', t, { shouldValidate: true });
        }}
      />
      {errors.tier && <p className="text-sm text-negative">{errors.tier.message}</p>}

      <FormField id="card-last4" label="Últimos 4 dígitos" error={errors.last4?.message}>
        <Input inputMode="numeric" autoComplete="off" maxLength={4} placeholder="1234" disabled={disabled} {...register('last4')} />
      </FormField>
      {money('limit', 'card-limit', 'Cupo total')}
      {!initial && (
        <>
          {money('available', 'card-available', 'Cupo disponible hoy')}
          <p className="-mt-3 text-sm text-ink/60">Los ves en la app de tu banco</p>
        </>
      )}
      <FormField id="card-payment-day" label="Día de pago" error={errors.paymentDay?.message}>
        <Input inputMode="numeric" autoComplete="off" maxLength={2} placeholder="15" disabled={disabled} {...register('paymentDay')} />
      </FormField>

      <details className="rounded-xl border border-ink/10 p-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">Más detalles</summary>
        <div className="mt-3 space-y-5">
          <FormField id="card-name" label="Nombre (opcional)" error={errors.name?.message}>
            <Input maxLength={40} placeholder={`${cardLabel(network, tier)} ••${digits}`} disabled={disabled} {...register('name')} />
          </FormField>
          <FormField id="card-cutoff-day" label="Día de corte (opcional)" error={errors.cutoffDay?.message}>
            <Input inputMode="numeric" autoComplete="off" maxLength={2} placeholder="1" disabled={disabled} {...register('cutoffDay')} />
          </FormField>
        </div>
      </details>

      {disabled && <p className="text-sm text-ink/60">Necesitas conexión</p>}
      {serverError && (
        <p role="alert" className="text-sm text-negative">
          {serverError}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" size="lg" className="flex-1" disabled={disabled || isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Guardando…' : initial ? 'Guardar cambios' : 'Agregar tarjeta'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
