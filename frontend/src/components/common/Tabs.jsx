import { useId, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Pestañas simples (segmentadas) para dividir una sección larga, p. ej. Miembros | Aportes.
 * Se navegan con las flechas del teclado, como pide el patrón de pestañas de WAI-ARIA.
 *
 * @param {object} props
 * @param {string} props.label Nombre del grupo de pestañas (para lectores de pantalla).
 * @param {Array<{ value: string, label: string, count?: number }>} props.tabs
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {(value: string) => React.ReactNode} props.children Contenido de la pestaña elegida.
 */
export default function Tabs({ label, tabs, value, onChange, children }) {
  const id = useId();
  const refs = useRef({});

  const move = (event, index) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    onChange(next.value);
    refs.current[next.value]?.focus();
  };

  return (
    <div className="min-w-0">
      <div role="tablist" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-ink/5 p-1">
        {tabs.map((tab, index) => (
          <button
            key={tab.value}
            ref={(el) => (refs.current[tab.value] = el)}
            type="button"
            role="tab"
            id={`${id}-${tab.value}`}
            aria-selected={value === tab.value}
            aria-controls={`${id}-panel`}
            tabIndex={value === tab.value ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => move(event, index)}
            className={cn(
              'flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors',
              value === tab.value ? 'bg-surface text-ink shadow-sm' : 'text-ink/60 hover:text-ink',
            )}
          >
            <span className="truncate">{tab.label}</span>
            {tab.count !== undefined && <span className="tabular-nums text-ink/50">{tab.count}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${value}`} className="mt-2 min-w-0">
        {children(value)}
      </div>
    </div>
  );
}
