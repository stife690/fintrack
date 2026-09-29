import { cloneElement } from 'react';
import { Label } from '@/components/ui/label';

/**
 * Etiqueta + control + mensaje de error accesible.
 * Conecta el control con `id`, `aria-invalid` y `aria-describedby`.
 *
 * @param {object} props
 * @param {string} props.id
 * @param {string} props.label
 * @param {string} [props.error] Mensaje de error de validación.
 * @param {React.ReactElement} props.children Control del formulario (Input, PasswordInput…).
 */
export default function FormField({ id, label, error, children }) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? errorId : undefined,
      })}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
