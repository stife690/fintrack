import { MonitorSmartphone, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/ThemeProvider';

const OPTIONS = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Automático', icon: MonitorSmartphone },
];

/**
 * Selector del tema de la app. Son radios nativos (teclado con flechas y lector de pantalla
 * incluidos) con aspecto de tarjetas. El cambio se aplica al instante y se guarda en este dispositivo.
 */
export default function ThemeSelector() {
  const { preference, setPreference } = useTheme();

  return (
    <fieldset>
      <legend className="sr-only">Tema de la app</legend>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-xl border px-2 py-4 text-sm font-medium transition-colors',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-violet',
              preference === value
                ? 'border-brand bg-brand-soft text-brand'
                : 'border-ink/10 text-ink/70 hover:border-ink/20 hover:text-ink',
            )}
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={preference === value}
              onChange={() => setPreference(value)}
              className="sr-only"
            />
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </label>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink/50">
        {preference === 'system'
          ? 'Sigue el modo claro u oscuro de tu dispositivo.'
          : 'Se guarda en este dispositivo.'}
      </p>
    </fieldset>
  );
}
