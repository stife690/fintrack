import { OctagonAlert, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const percent = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

/** Textos y colores por nivel (RN-04: aviso al 80 % y al 100 % del presupuesto). */
const LEVELS = {
  warning_80: {
    Icon: TriangleAlert,
    title: 'Cerca del límite',
    style: 'border-caution/40 bg-caution/10 text-caution',
  },
  exceeded_100: {
    Icon: OctagonAlert,
    title: 'Presupuesto superado',
    style: 'border-negative/40 bg-negative/10 text-negative',
  },
};

/**
 * Aviso que se muestra tras registrar o editar un gasto cuando la categoría llegó
 * al 80 % o al 100 % de su presupuesto del mes. No renderiza nada si no hay alerta (FT-0006).
 * @param {{ alert: import('@/services/transactionService').TransactionAlert|null, categoryName?: string, className?: string }} props
 */
export default function BudgetAlert({ alert, categoryName, className }) {
  const level = alert && LEVELS[alert.level];
  if (!level) return null;
  const { Icon, title, style } = level;
  const of = categoryName ? ` de ${categoryName}` : '';
  return (
    <div
      role="alert"
      className={cn('flex items-start gap-3 rounded-lg border p-3 text-sm', style, className)}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <p>
        <strong className="font-semibold">{title}.</strong>{' '}
        <span className="text-foreground">
          Llevas el {percent.format(alert.percentage)} % del presupuesto{of} de este mes.
        </span>
      </p>
    </div>
  );
}
