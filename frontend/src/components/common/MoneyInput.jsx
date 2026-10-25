import { forwardRef, useLayoutEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  describeAmount,
  formatMoneyInput,
  parseMoneyInput,
  parsePastedMoney,
} from "@/lib/money";

const HINT_STYLES = {
  info: "text-ink/60",
  warning: "text-amber-600 dark:text-amber-400",
  error: "text-negative",
};

/**
 * Campo de monto en pesos con separadores de miles mientras se escribe (`1.234.567,50`) y
 * mensajes en tiempo real cuando el monto es muy grande, muy pequeño o pasa el máximo.
 *
 * El valor que entrega `onChange` y que recibe `value` es un texto crudo (`"1234567.5"`), el
 * mismo que daba el campo numérico anterior, así que los esquemas de validación y lo que se
 * envía a la API no cambian. La coma es el decimal; los puntos los pone el campo.
 *
 * @param {object} props
 * @param {string} props.value Texto crudo del monto.
 * @param {(raw: string) => void} props.onChange
 * @param {string} [props.id] Lo inyecta `FormField`, junto con `aria-invalid` y `aria-describedby`.
 * @param {string} [props.className] Clases del `<input>`.
 * @param {boolean} [props.showHint=true] Muestra la retroalimentación bajo el campo.
 */
const MoneyInput = forwardRef(function MoneyInput(
  {
    value,
    onChange,
    id,
    className,
    showHint = true,
    "aria-describedby": describedBy,
    onBlur,
    ...props
  },
  ref,
) {
  const inputRef = useRef(null);
  // Posición del cursor pendiente de restaurar después de volver a dar formato al texto.
  const caret = useRef(null);
  const hint = showHint
    ? describeAmount(value)
    : { level: "none", message: "" };
  const hintId = id ? `${id}-hint` : undefined;

  useLayoutEffect(() => {
    if (caret.current === null || !inputRef.current) return;
    inputRef.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });

  const handleChange = (event) => {
    const input = event.target;
    // Cuántos dígitos (o comas) hay a la izquierda del cursor: se conservan al reformatear.
    const meaningful = input.value
      .slice(0, input.selectionStart ?? 0)
      .replace(/[^\d,]/g, "").length;
    const raw = parseMoneyInput(input.value);
    const formatted = formatMoneyInput(raw);
    let position = 0;
    let seen = 0;
    while (position < formatted.length && seen < meaningful) {
      if (/[\d,]/.test(formatted[position])) seen += 1;
      position += 1;
    }
    caret.current = position;
    onChange(raw);
  };

  const handlePaste = (event) => {
    const text = event.clipboardData?.getData("text");
    if (!text) return;
    event.preventDefault();
    caret.current = null;
    onChange(parsePastedMoney(text));
  };

  const describedIds =
    [describedBy, hint.message ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="space-y-1.5">
      <Input
        {...props}
        id={id}
        ref={(el) => {
          inputRef.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
        }}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={formatMoneyInput(value)}
        onChange={handleChange}
        onPaste={handlePaste}
        onBlur={(event) => {
          // Un decimal sin dígitos ("12,") no aporta: se quita al salir del campo.
          if (value?.endsWith(".")) onChange(value.slice(0, -1));
          onBlur?.(event);
        }}
        aria-describedby={describedIds}
        className={className}
      />
      {hint.message && (
        <p
          id={hintId}
          aria-live="polite"
          className={cn("text-sm", HINT_STYLES[hint.level])}
        >
          {hint.message}
        </p>
      )}
    </div>
  );
});

export default MoneyInput;
