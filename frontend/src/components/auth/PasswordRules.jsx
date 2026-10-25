import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Requisitos de la contraseña nueva, iguales a los de `newPassword` en `lib/validation/auth.js`. */
const PASSWORD_RULES = [
  { label: '8 caracteres o más', test: (v) => v.length >= 8 },
  { label: 'Una letra', test: (v) => /[A-Za-z]/.test(v) },
  { label: 'Un número', test: (v) => /\d/.test(v) },
];

/**
 * Lista en vivo de los requisitos de la contraseña (registro y recuperación): cada uno se pinta
 * de verde al cumplirse.
 * @param {{ password?: string }} props
 */
export default function PasswordRules({ password = '' }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Requisitos de la contraseña">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li
            key={rule.label}
            className={cn('inline-flex items-center gap-1 transition-colors', ok ? 'text-success' : 'text-white/55')}
          >
            <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
            {rule.label}
            <span className="sr-only">{ok ? '(cumplido)' : '(pendiente)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
