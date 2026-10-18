import { useState } from 'react';
import ChipGroup from '@/components/common/ChipGroup';
import { Input } from '@/components/ui/input';
import { today } from '@/lib/validation/transaction';

/** Ayer en la zona del dispositivo, como AAAA-MM-DD. */
function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA');
}

const OPTIONS = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'other', label: 'Otra fecha' },
];

/** Qué pastilla corresponde a una fecha. */
function modeOf(date) {
  if (date === today()) return 'today';
  if (date === yesterday()) return 'yesterday';
  return 'other';
}

/**
 * Fecha del movimiento: "Hoy" y "Ayer" con un toque (los casos más comunes) y
 * "Otra fecha" abre el calendario nativo.
 *
 * @param {object} props
 * @param {string} props.value AAAA-MM-DD
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.error]
 */
export default function DateQuickPick({ value, onChange, error }) {
  // "Otra fecha" puede estar elegida aunque la fecha coincida con hoy (el usuario va a cambiarla).
  const [forceOther, setForceOther] = useState(false);
  const mode = forceOther ? 'other' : modeOf(value);

  const pick = (next) => {
    setForceOther(next === 'other');
    if (next === 'today') onChange(today());
    if (next === 'yesterday') onChange(yesterday());
  };

  return (
    <div className="space-y-2">
      <ChipGroup legend="Fecha" options={OPTIONS} value={mode} onChange={pick} />
      {mode === 'other' && (
        <Input
          type="date"
          aria-label="Fecha del movimiento"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
        />
      )}
      {error && <p className="text-sm text-negative">{error}</p>}
    </div>
  );
}
